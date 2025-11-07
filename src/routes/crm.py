"""
CRM Routes - Admin-only contact management system
Handles eviction clients, prevention prospects, and referral partners
"""

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token, get_jwt
from src.models.user import User, db
from src.models.crm_user import CRMUser
from src.models.crm_contact import CRMContact
from src.models.crm_note import CRMNote
from src.models.crm_file import CRMFile
from src.models.crm_email import CRMEmail
from src.models.crm_email_config import CRMEmailConfig
from src.services.email_sync import EmailSyncService
from src.utils.s3_client import s3_client
from datetime import datetime, date, timedelta
from sqlalchemy import or_, and_, func
import logging

crm_bp = Blueprint('crm', __name__)
logger = logging.getLogger(__name__)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def require_crm_user():
    """Ensure current user is a CRM user (separate from main admin system)"""
    try:
        claims = get_jwt()
        if not claims.get('crm_user'):
            return None

        user_id = get_jwt_identity()
        crm_user = CRMUser.query.get(int(user_id))
        return crm_user
    except Exception:
        return None


def require_super_admin():
    """Ensure current user is a CRM super admin"""
    crm_user = require_crm_user()
    if not crm_user or not crm_user.is_super_admin:
        return None
    return crm_user


def require_admin():
    """DEPRECATED: Use require_crm_user() instead. Kept for backwards compatibility."""
    return require_crm_user()


def _parse_date(date_str):
    """Parse date string to date object"""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
    except Exception:
        return None


def _parse_numeric(value):
    """Parse numeric value, converting empty strings to None"""
    if value == '' or value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


# ============================================================================
# AUTHENTICATION ENDPOINTS (CRM-specific login system)
# ============================================================================

@crm_bp.route('/auth/register', methods=['POST'])
def crm_register():
    """Self-service CRM account registration"""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['username', 'email', 'password', 'imap_server', 'imap_port', 'imap_email', 'imap_password']
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400

        # Extract data
        username = data.get('username', '').strip().lower()
        email = data.get('email', '').strip().lower()
        password = data.get('password')
        imap_server = data.get('imap_server', '').strip()
        imap_port = data.get('imap_port')
        imap_email = data.get('imap_email', '').strip()
        imap_password = data.get('imap_password')
        imap_use_ssl = data.get('imap_use_ssl', True)

        # Validate username (alphanumeric only, 3-50 chars)
        if not username or len(username) < 3 or len(username) > 50:
            return jsonify({'error': 'Username must be 3-50 characters'}), 400

        if not username.replace('_', '').replace('-', '').isalnum():
            return jsonify({'error': 'Username can only contain letters, numbers, hyphens, and underscores'}), 400

        # Validate email format
        if not email or '@' not in email:
            return jsonify({'error': 'Valid email address required'}), 400

        # Validate password strength (min 8 chars)
        if not password or len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        # Check if username already exists
        existing_user = CRMUser.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'Username already taken'}), 409

        # Check if email already exists
        existing_email = CRMUser.query.filter_by(email=email).first()
        if existing_email:
            return jsonify({'error': 'Email already registered'}), 409

        # Create new CRM user
        crm_user = CRMUser(
            username=username,
            email=email,
            is_super_admin=False,  # Regular admin by default
            imap_server=imap_server,
            imap_port=int(imap_port),
            imap_email=imap_email,
            imap_password=imap_password,  # TODO: Encrypt this
            imap_use_ssl=imap_use_ssl
        )
        crm_user.set_password(password)

        db.session.add(crm_user)
        db.session.commit()

        # Create JWT token for immediate login
        access_token = create_access_token(
            identity=str(crm_user.id),
            additional_claims={
                'crm_user': True,
                'is_super_admin': False
            }
        )

        logger.info(f"New CRM user registered: {username}")

        return jsonify({
            'message': 'Account created successfully',
            'access_token': access_token,
            'user': crm_user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Error during CRM registration: %s", e)
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@crm_bp.route('/auth/login', methods=['POST'])
def crm_login():
    """Login to CRM (separate from main admin login)"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400

        crm_user = CRMUser.query.filter_by(username=username).first()

        if not crm_user or not crm_user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401

        # Create separate JWT token for CRM with special claims
        access_token = create_access_token(
            identity=str(crm_user.id),
            additional_claims={
                'crm_user': True,
                'is_super_admin': crm_user.is_super_admin
            }
        )

        logger.info(f"CRM user {username} logged in successfully")

        return jsonify({
            'access_token': access_token,
            'user': crm_user.to_dict()
        }), 200

    except Exception as e:
        logger.exception("Error during CRM login: %s", e)
        return jsonify({'error': 'Login failed'}), 500


@crm_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def crm_current_user():
    """Get current CRM user"""
    try:
        claims = get_jwt()
        if not claims.get('crm_user'):
            return jsonify({'error': 'Not a CRM user'}), 403

        user_id = get_jwt_identity()
        crm_user = CRMUser.query.get(int(user_id))

        if not crm_user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify(crm_user.to_dict(include_email_config=True)), 200

    except Exception as e:
        logger.exception("Error getting current CRM user: %s", e)
        return jsonify({'error': 'Failed to get user'}), 500


@crm_bp.route('/auth/logout', methods=['POST'])
@jwt_required()
def crm_logout():
    """Logout from CRM (JWT is stateless, so just tell frontend to remove token)"""
    return jsonify({'message': 'Logged out successfully'}), 200


@crm_bp.route('/auth/email-settings', methods=['PUT'])
@jwt_required()
def update_email_settings():
    """Update email IMAP settings for current user"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['imap_server', 'imap_port', 'imap_email', 'imap_password']
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400

        # Update user's IMAP settings
        crm_user.imap_server = data.get('imap_server', '').strip()
        crm_user.imap_port = int(data.get('imap_port'))
        crm_user.imap_email = data.get('imap_email', '').strip()
        crm_user.imap_password = data.get('imap_password')  # TODO: Encrypt
        crm_user.imap_use_ssl = data.get('imap_use_ssl', True)

        db.session.commit()

        logger.info(f"Email settings updated for CRM user: {crm_user.username}")

        return jsonify({
            'message': 'Email settings updated successfully',
            'user': crm_user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.exception("Error updating email settings: %s", e)
        return jsonify({'error': f'Failed to update settings: {str(e)}'}), 500


# ============================================================================
# CONTACT ENDPOINTS
# ============================================================================

@crm_bp.route('/contacts', methods=['GET'])
@jwt_required()
def list_contacts():
    """
    List CRM contacts with filtering
    Query params:
    - view: 'my' (only my contacts) or 'team' (all contacts - super admin only)
    - type: 'eviction_client', 'prevention_prospect', 'referral_partner'
    - status: 'active', 'won', 'lost', 'dormant'
    - search: search in name, email, company
    """
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        # Base query
        query = CRMContact.query

        # View filter (personal vs team)
        view = request.args.get('view', 'my')
        if view == 'team':
            # Team view - only super admins can see all contacts
            if not crm_user.is_super_admin:
                return jsonify({'error': 'Super admin access required for team view'}), 403
            # Show all contacts for super admin
        else:
            # My view - show only user's contacts
            query = query.filter(CRMContact.owner_id == crm_user.id)

        # Type filter
        contact_type = request.args.get('type')
        if contact_type:
            query = query.filter(CRMContact.contact_type == contact_type)

        # Status filter
        status = request.args.get('status')
        if status:
            query = query.filter(CRMContact.status == status)

        # Search filter
        search = request.args.get('search', '').strip()
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    CRMContact.name.ilike(search_pattern),
                    CRMContact.email.ilike(search_pattern),
                    CRMContact.company_name.ilike(search_pattern)
                )
            )

        # Order by next follow-up date (nulls last), then most recently updated
        contacts = query.order_by(
            CRMContact.next_followup_date.asc().nullslast(),
            CRMContact.updated_at.desc()
        ).all()

        return jsonify({
            'contacts': [c.to_dict() for c in contacts],
            'count': len(contacts)
        })

    except Exception as e:
        logger.exception("Error listing CRM contacts: %s", e)
        return jsonify({'error': 'Failed to fetch contacts'}), 500


@crm_bp.route('/contacts/<int:contact_id>', methods=['GET'])
@jwt_required()
def get_contact(contact_id):
    """Get single contact with full details including notes and files"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        contact = CRMContact.query.get(contact_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        # Get notes and files
        notes = CRMNote.query.filter_by(contact_id=contact_id)\
            .order_by(CRMNote.created_at.desc()).all()
        files = CRMFile.query.filter_by(contact_id=contact_id)\
            .order_by(CRMFile.created_at.desc()).all()

        result = contact.to_dict()
        result['notes'] = [n.to_dict() for n in notes]
        result['files'] = [f.to_dict() for f in files]

        return jsonify(result)

    except Exception as e:
        logger.exception("Error getting contact %s: %s", contact_id, e)
        return jsonify({'error': 'Failed to fetch contact'}), 500


@crm_bp.route('/contacts', methods=['POST'])
@jwt_required()
def create_contact():
    """Create new CRM contact"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        data = request.json

        # Required fields
        if not data.get('name') or not data.get('email') or not data.get('contact_type'):
            return jsonify({'error': 'Missing required fields: name, email, contact_type'}), 400

        # Create contact
        contact = CRMContact(
            name=data['name'],
            email=data['email'],
            phone=data.get('phone'),
            company_name=data.get('company_name'),
            contact_type=data['contact_type'],
            how_found_us=data.get('how_found_us'),
            referral_partner_name=data.get('referral_partner_name'),
            property_address=data.get('property_address'),
            service_type=data.get('service_type'),
            urgency_level=data.get('urgency_level'),
            current_stage=data.get('current_stage', 'new_inquiry'),
            status=data.get('status', 'active'),
            next_followup_date=_parse_date(data.get('next_followup_date')),
            potential_value=_parse_numeric(data.get('potential_value')),
            owner_id=crm_user.id  # Set current CRM user as owner
        )

        db.session.add(contact)
        db.session.commit()

        return jsonify({
            'message': 'Contact created successfully',
            'contact': contact.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Error creating contact: %s", e)
        return jsonify({'error': 'Failed to create contact'}), 500


@crm_bp.route('/contacts/<int:contact_id>', methods=['PUT'])
@jwt_required()
def update_contact(contact_id):
    """Update existing contact"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        contact = CRMContact.query.get(contact_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        data = request.json

        # Update fields
        if 'name' in data:
            contact.name = data['name']
        if 'email' in data:
            contact.email = data['email']
        if 'phone' in data:
            contact.phone = data['phone']
        if 'company_name' in data:
            contact.company_name = data['company_name']
        if 'contact_type' in data:
            contact.contact_type = data['contact_type']
        if 'how_found_us' in data:
            contact.how_found_us = data['how_found_us']
        if 'referral_partner_name' in data:
            contact.referral_partner_name = data['referral_partner_name']
        if 'property_address' in data:
            contact.property_address = data['property_address']
        if 'service_type' in data:
            contact.service_type = data['service_type']
        if 'urgency_level' in data:
            contact.urgency_level = data['urgency_level']
        if 'current_stage' in data:
            contact.current_stage = data['current_stage']
        if 'status' in data:
            contact.status = data['status']
        if 'next_followup_date' in data:
            contact.next_followup_date = _parse_date(data['next_followup_date'])
        if 'potential_value' in data:
            contact.potential_value = _parse_numeric(data['potential_value'])
        if 'total_revenue' in data:
            contact.total_revenue = _parse_numeric(data['total_revenue'])

        db.session.commit()

        return jsonify({
            'message': 'Contact updated successfully',
            'contact': contact.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        logger.exception("Error updating contact %s: %s", contact_id, e)
        return jsonify({'error': 'Failed to update contact'}), 500


@crm_bp.route('/contacts/<int:contact_id>', methods=['DELETE'])
@jwt_required()
def delete_contact(contact_id):
    """Delete contact (and cascade delete notes/files)"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        contact = CRMContact.query.get(contact_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        db.session.delete(contact)
        db.session.commit()

        return jsonify({'message': 'Contact deleted successfully'})

    except Exception as e:
        db.session.rollback()
        logger.exception("Error deleting contact %s: %s", contact_id, e)
        return jsonify({'error': 'Failed to delete contact'}), 500


# ============================================================================
# NOTES ENDPOINTS
# ============================================================================

@crm_bp.route('/contacts/<int:contact_id>/notes', methods=['POST'])
@jwt_required()
def add_note(contact_id):
    """Add note to contact"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        contact = CRMContact.query.get(contact_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        data = request.json
        if not data.get('content'):
            return jsonify({'error': 'Note content is required'}), 400

        note = CRMNote(
            contact_id=contact_id,
            note_type=data.get('note_type', 'internal'),
            content=data['content'],
            created_by=user.id
        )

        db.session.add(note)
        db.session.commit()

        return jsonify({
            'message': 'Note added successfully',
            'note': note.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Error adding note to contact %s: %s", contact_id, e)
        return jsonify({'error': 'Failed to add note'}), 500


@crm_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    """Delete note"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        note = CRMNote.query.get(note_id)
        if not note:
            return jsonify({'error': 'Note not found'}), 404

        db.session.delete(note)
        db.session.commit()

        return jsonify({'message': 'Note deleted successfully'})

    except Exception as e:
        db.session.rollback()
        logger.exception("Error deleting note %s: %s", note_id, e)
        return jsonify({'error': 'Failed to delete note'}), 500


# ============================================================================
# EMAIL SYNC ENDPOINTS
# ============================================================================

@crm_bp.route('/contacts/<int:contact_id>/sync-emails', methods=['POST'])
@jwt_required()
def sync_contact_emails(contact_id):
    """Sync emails for a specific contact"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        # Get contact
        contact = CRMContact.query.get(contact_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        # Check ownership
        if contact.owner_id != crm_user.id and not crm_user.is_super_admin:
            return jsonify({'error': 'Access denied'}), 403

        # Check email configuration
        if not crm_user.imap_server or not crm_user.imap_email:
            return jsonify({'error': 'Email not configured. Please set up email in Settings.'}), 400

        # Sync emails
        results = EmailSyncService.sync_contact_emails(crm_user, contact)

        if results['success']:
            return jsonify({
                'message': f"Synced successfully! Found {results['new_emails']} new emails.",
                'new_emails': results['new_emails'],
                'total_emails': results['total_emails']
            }), 200
        else:
            return jsonify({'error': results['error']}), 500

    except Exception as e:
        logger.exception("Error syncing emails for contact %s: %s", contact_id, e)
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500


@crm_bp.route('/contacts/<int:contact_id>/emails', methods=['GET'])
@jwt_required()
def get_contact_emails(contact_id):
    """Get all emails for a contact"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        # Get contact
        contact = CRMContact.query.get(contact_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        # Check ownership
        if contact.owner_id != crm_user.id and not crm_user.is_super_admin:
            return jsonify({'error': 'Access denied'}), 403

        # Get emails, ordered by date descending
        emails = CRMEmail.query.filter_by(
            contact_id=contact_id,
            user_id=crm_user.id
        ).order_by(CRMEmail.date.desc()).all()

        return jsonify({
            'emails': [email.to_dict() for email in emails],
            'count': len(emails)
        }), 200

    except Exception as e:
        logger.exception("Error getting emails for contact %s: %s", contact_id, e)
        return jsonify({'error': 'Failed to load emails'}), 500


# ============================================================================
# FILE UPLOAD ENDPOINTS
# ============================================================================

@crm_bp.route('/contacts/<int:contact_id>/files', methods=['POST'])
@jwt_required()
def upload_file(contact_id):
    """Upload file for contact (uses S3)"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        contact = CRMContact.query.get(contact_id)
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404

        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Generate S3 key
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        s3_key = f"crm/contact_{contact_id}/{timestamp}_{file.filename}"

        # Upload to S3
        s3_url = s3_client.upload_file(file, s3_key)

        if not s3_url:
            return jsonify({'error': 'Failed to upload file to S3'}), 500

        # Save file record
        crm_file = CRMFile(
            contact_id=contact_id,
            file_name=file.filename,
            file_type=file.content_type,
            file_size=len(file.read()),
            s3_url=s3_url,
            category=request.form.get('category', 'other'),
            description=request.form.get('description'),
            uploaded_by=user.id
        )

        db.session.add(crm_file)
        db.session.commit()

        return jsonify({
            'message': 'File uploaded successfully',
            'file': crm_file.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Error uploading file for contact %s: %s", contact_id, e)
        return jsonify({'error': 'Failed to upload file'}), 500


@crm_bp.route('/files/<int:file_id>', methods=['DELETE'])
@jwt_required()
def delete_file(file_id):
    """Delete file"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        crm_file = CRMFile.query.get(file_id)
        if not crm_file:
            return jsonify({'error': 'File not found'}), 404

        # Optionally delete from S3 (implement if needed)
        # s3_client.delete_file(crm_file.s3_url)

        db.session.delete(crm_file)
        db.session.commit()

        return jsonify({'message': 'File deleted successfully'})

    except Exception as e:
        db.session.rollback()
        logger.exception("Error deleting file %s: %s", file_id, e)
        return jsonify({'error': 'Failed to delete file'}), 500


# ============================================================================
# DASHBOARD & STATISTICS
# ============================================================================

@crm_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    """
    Get CRM dashboard statistics
    Query params:
    - view: 'my' or 'team'
    """
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        view = request.args.get('view', 'my')

        # Base query
        if view == 'my':
            base_query = CRMContact.query.filter_by(owner_id=crm_user.id)
        elif view == 'team':
            # Team view - super admin only
            if not crm_user.is_super_admin:
                return jsonify({'error': 'Super admin access required for team view'}), 403
            base_query = CRMContact.query
        else:
            base_query = CRMContact.query.filter_by(owner_id=crm_user.id)

        today = date.today()

        # Follow-ups due today
        followups_today = base_query.filter(
            CRMContact.next_followup_date == today,
            CRMContact.status == 'active'
        ).count()

        # Overdue follow-ups
        overdue_followups = base_query.filter(
            CRMContact.next_followup_date < today,
            CRMContact.status == 'active'
        ).count()

        # Quotes awaiting response
        quotes_pending = base_query.filter(
            CRMContact.current_stage.in_(['quote_sent', 'thinking_about_it']),
            CRMContact.status == 'active'
        ).count()

        # Jobs in progress
        jobs_in_progress = base_query.filter(
            CRMContact.current_stage.in_(['job_booked', 'job_in_progress']),
            CRMContact.contact_type == 'eviction_client'
        ).count()

        # Potential revenue this month (active contacts only)
        potential_revenue = db.session.query(
            func.sum(CRMContact.potential_value)
        ).filter(
            CRMContact.owner_id == crm_user.id if view == 'my' else True,
            CRMContact.status == 'active',
            CRMContact.potential_value.isnot(None)
        ).scalar() or 0

        # Total active contacts
        active_contacts = base_query.filter(CRMContact.status == 'active').count()

        # Breakdown by type
        eviction_clients = base_query.filter(
            CRMContact.contact_type == 'eviction_client',
            CRMContact.status == 'active'
        ).count()

        prevention_prospects = base_query.filter(
            CRMContact.contact_type == 'prevention_prospect',
            CRMContact.status == 'active'
        ).count()

        referral_partners = base_query.filter(
            CRMContact.contact_type == 'referral_partner',
            CRMContact.status == 'active'
        ).count()

        return jsonify({
            'followups_today': followups_today,
            'overdue_followups': overdue_followups,
            'quotes_pending': quotes_pending,
            'jobs_in_progress': jobs_in_progress,
            'potential_revenue': float(potential_revenue),
            'active_contacts': active_contacts,
            'breakdown': {
                'eviction_clients': eviction_clients,
                'prevention_prospects': prevention_prospects,
                'referral_partners': referral_partners
            }
        })

    except Exception as e:
        logger.exception("Error getting CRM dashboard: %s", e)
        return jsonify({'error': 'Failed to fetch dashboard data'}), 500


# ============================================================================
# EMAIL CONFIGURATION (FUTURE FEATURE)
# ============================================================================

@crm_bp.route('/email-config', methods=['GET'])
@jwt_required()
def get_email_config():
    """Get current admin's email configuration"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        config = CRMEmailConfig.query.filter_by(admin_id=crm_user.id).first()
        if not config:
            return jsonify({'configured': False, 'config': None})

        return jsonify({
            'configured': True,
            'config': config.to_dict(include_password=False)
        })

    except Exception as e:
        logger.exception("Error getting email config: %s", e)
        return jsonify({'error': 'Failed to fetch email config'}), 500


@crm_bp.route('/email-config', methods=['POST'])
@jwt_required()
def save_email_config():
    """Save or update email configuration"""
    crm_user = require_crm_user()
    if not crm_user:
        return jsonify({'error': 'CRM access required'}), 403

    try:
        data = request.json

        if not data.get('email_address') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        # Get or create config
        config = CRMEmailConfig.query.filter_by(admin_id=crm_user.id).first()
        if not config:
            config = CRMEmailConfig(admin_id=crm_user.id)
            db.session.add(config)

        # Update config
        config.email_address = data['email_address']
        config.imap_server = data.get('imap_server', 'nebula.galaxywebsolutions.com')
        config.imap_port = data.get('imap_port', 993)
        config.set_password(data['password'])
        config.is_active = True

        db.session.commit()

        return jsonify({
            'message': 'Email configuration saved successfully',
            'config': config.to_dict(include_password=False)
        })

    except Exception as e:
        db.session.rollback()
        logger.exception("Error saving email config: %s", e)
        return jsonify({'error': 'Failed to save email configuration'}), 500
