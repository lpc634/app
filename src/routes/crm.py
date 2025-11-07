"""
CRM Routes - Admin-only contact management system
Handles eviction clients, prevention prospects, and referral partners
"""

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, db
from src.models.crm_contact import CRMContact
from src.models.crm_note import CRMNote
from src.models.crm_file import CRMFile
from src.models.crm_email_config import CRMEmailConfig
from src.utils.s3_client import s3_client
from datetime import datetime, date, timedelta
from sqlalchemy import or_, and_, func
import logging

crm_bp = Blueprint('crm', __name__)
logger = logging.getLogger(__name__)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def require_admin():
    """Ensure current user is admin"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(int(current_user_id)) if current_user_id is not None else None
        if not user or user.role != 'admin':
            return None
        return user
    except Exception:
        return None


def _parse_date(date_str):
    """Parse date string to date object"""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
    except Exception:
        return None


# ============================================================================
# CONTACT ENDPOINTS
# ============================================================================

@crm_bp.route('/contacts', methods=['GET'])
@jwt_required()
def list_contacts():
    """
    List CRM contacts with filtering
    Query params:
    - view: 'my' (only my contacts) or 'team' (all contacts)
    - type: 'eviction_client', 'prevention_prospect', 'referral_partner'
    - status: 'active', 'won', 'lost', 'dormant'
    - search: search in name, email, company
    """
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

    try:
        # Base query
        query = CRMContact.query

        # View filter (personal vs team)
        view = request.args.get('view', 'my')
        if view == 'my':
            query = query.filter(CRMContact.owner_id == user.id)

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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
            potential_value=data.get('potential_value'),
            owner_id=user.id  # Set current admin as owner
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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
            contact.potential_value = data['potential_value']
        if 'total_revenue' in data:
            contact.total_revenue = data['total_revenue']

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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
# FILE UPLOAD ENDPOINTS
# ============================================================================

@crm_bp.route('/contacts/<int:contact_id>/files', methods=['POST'])
@jwt_required()
def upload_file(contact_id):
    """Upload file for contact (uses S3)"""
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

    try:
        view = request.args.get('view', 'my')

        # Base query
        if view == 'my':
            base_query = CRMContact.query.filter_by(owner_id=user.id)
        else:
            base_query = CRMContact.query

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
            CRMContact.owner_id == user.id if view == 'my' else True,
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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

    try:
        config = CRMEmailConfig.query.filter_by(admin_id=user.id).first()
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
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden - Admin access required'}), 403

    try:
        data = request.json

        if not data.get('email_address') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        # Get or create config
        config = CRMEmailConfig.query.filter_by(admin_id=user.id).first()
        if not config:
            config = CRMEmailConfig(admin_id=user.id)
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
