from flask import Blueprint, jsonify, request, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from src.models.authority_to_act import AuthorityToActToken
from src.extensions import db
from datetime import datetime
import logging
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

authority_bp = Blueprint('authority', __name__)
logger = logging.getLogger(__name__)


def require_admin():
    """Helper function to require admin role."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or user.role not in ['admin', 'manager']:
            return None
        return user
    except Exception:
        return None


@authority_bp.route('/admin/authority-to-act/permanent-link', methods=['GET'])
@jwt_required()
def get_permanent_link():
    """Get or create the permanent Authority to Act form link."""
    try:
        user = require_admin()
        if not user:
            return jsonify({"error": "Forbidden"}), 403

        # Look for existing permanent token
        permanent_token = AuthorityToActToken.query.filter_by(
            status='permanent'
        ).first()

        if not permanent_token:
            # Create permanent token
            token = AuthorityToActToken.generate_token()
            permanent_token = AuthorityToActToken(
                token=token,
                created_by=user.id,
                status='permanent',
                expires_at=None  # Never expires
            )
            db.session.add(permanent_token)
            db.session.commit()
            logger.info(f"Permanent Authority to Act link created by admin {user.id}")

        # Generate public URL
        base_url = current_app.config.get('PUBLIC_BASE_URL', 'https://v3-app.herokuapp.com')
        public_url = f"{base_url}/public/authority-to-act/{permanent_token.token}"

        return jsonify({
            'url': public_url,
            'token': permanent_token.token
        }), 200

    except Exception as e:
        logger.error(f"Error getting permanent link: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500


@authority_bp.route('/admin/authority-to-act/submissions', methods=['GET'])
@jwt_required()
def list_submissions():
    """List all Authority to Act form submissions."""
    try:
        user = require_admin()
        if not user:
            return jsonify({"error": "Forbidden"}), 403

        # Get all submissions (status='submitted')
        submissions = AuthorityToActToken.query.filter_by(
            status='submitted'
        ).order_by(AuthorityToActToken.submitted_at.desc()).all()

        result = []
        for sub in submissions:
            data = sub.submission_data or {}
            result.append({
                'id': sub.id,
                'client_name': data.get('client_name'),
                'client_email': data.get('client_email'),
                'property_address': data.get('property_address'),
                'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
                'submission_data': data
            })

        return jsonify({'submissions': result}), 200

    except Exception as e:
        logger.error(f"Error listing submissions: {e}")
        return jsonify({"error": "Internal server error"}), 500


@authority_bp.route('/admin/authority-to-act/submissions/<int:submission_id>/pdf', methods=['GET'])
@jwt_required()
def download_submission_pdf(submission_id):
    """Generate and download PDF for a specific submission."""
    try:
        user = require_admin()
        if not user:
            return jsonify({"error": "Forbidden"}), 403

        submission = AuthorityToActToken.query.get(submission_id)
        if not submission or submission.status != 'submitted':
            return jsonify({"error": "Submission not found"}), 404

        # Generate PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=72, leftMargin=72,
                                topMargin=72, bottomMargin=18)

        # Container for the PDF elements
        elements = []
        styles = getSampleStyleSheet()

        # Title style
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=1  # Center
        )

        # Heading style
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#2563eb'),
            spaceAfter=12,
            spaceBefore=12
        )

        # Body style
        body_style = ParagraphStyle(
            'CustomBody',
            parent=styles['BodyText'],
            fontSize=11,
            leading=16
        )

        # Title
        elements.append(Paragraph("Authority to Act", title_style))
        elements.append(Paragraph("Squatter Eviction Services", styles['Heading3']))
        elements.append(Spacer(1, 0.3 * inch))

        # Submission details
        data = submission.submission_data or {}

        # Build data table
        details = [
            ['Submission Date:', submission.submitted_at.strftime('%d %B %Y at %H:%M') if submission.submitted_at else 'N/A'],
            ['', ''],
            ['Client Information', ''],
        ]

        if data.get('client_name'):
            details.append(['Client Name:', data.get('client_name')])
        if data.get('client_email'):
            details.append(['Email:', data.get('client_email')])
        if data.get('client_phone'):
            details.append(['Phone:', data.get('client_phone')])
        if data.get('property_address'):
            details.append(['Property Address:', data.get('property_address')])

        details.append(['', ''])
        details.append(['Form Details', ''])

        # Add all other form fields
        for key, value in data.items():
            if key not in ['client_name', 'client_email', 'client_phone', 'property_address']:
                # Convert key to readable format
                readable_key = key.replace('_', ' ').title()
                details.append([readable_key + ':', str(value)])

        # Create table
        table = Table(details, colWidths=[2.5*inch, 4*inch])
        table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONT', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1f2937')),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb'))
        ]))

        elements.append(table)
        elements.append(Spacer(1, 0.5 * inch))

        # Footer
        footer_text = f"Generated by V3 Services on {datetime.utcnow().strftime('%d %B %Y')}"
        elements.append(Paragraph(footer_text, styles['Italic']))

        # Build PDF
        doc.build(elements)

        # Prepare for download
        buffer.seek(0)

        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'authority-to-act-{submission_id}.pdf'
        )

    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        return jsonify({"error": "Failed to generate PDF"}), 500


@authority_bp.route('/public/authority-to-act/<token>', methods=['GET'])
def get_authority_form_data(token):
    """Get form data for a specific token (public endpoint, no auth required)."""
    try:
        # Find permanent token
        auth_token = AuthorityToActToken.query.filter_by(
            token=token,
            status='permanent'
        ).first()

        if not auth_token:
            return jsonify({"error": "Invalid link"}), 404

        # Return basic info (permanent link is always valid)
        return jsonify({
            'token': auth_token.token,
            'status': 'active',
        }), 200

    except Exception as e:
        logger.error(f"Error fetching authority form data: {e}")
        return jsonify({"error": "Internal server error"}), 500


@authority_bp.route('/public/authority-to-act/<token>/submit', methods=['POST'])
def submit_authority_form(token):
    """Submit Authority to Act form (public endpoint, no auth required)."""
    try:
        # Validate permanent token
        permanent_token = AuthorityToActToken.query.filter_by(
            token=token,
            status='permanent'
        ).first()

        if not permanent_token:
            return jsonify({"error": "Invalid link"}), 404

        data = request.get_json() or {}

        # Create a new submission record
        submission = AuthorityToActToken(
            token=AuthorityToActToken.generate_token(),  # Generate unique token for this submission
            created_by=permanent_token.created_by,
            status='submitted',
            submitted_at=datetime.utcnow(),
            submission_data=data
        )

        db.session.add(submission)
        db.session.commit()

        logger.info(f"Authority to Act form submitted via token {token}")

        # Send Telegram notification to admin group
        try:
            from src.integrations.telegram_client import send_telegram_notification

            client_name = data.get('client_name', 'Unknown')
            property_address = data.get('property_address', 'Not specified')

            message = (
                f"🔔 *New Authority to Act Form Submitted*\n\n"
                f"*Client:* {client_name}\n"
                f"*Property:* {property_address}\n"
                f"*Submitted:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n\n"
                f"View full details in the admin dashboard."
            )

            send_telegram_notification(message, parse_mode='Markdown')
            logger.info("Telegram notification sent for Authority to Act submission")

        except Exception as telegram_error:
            logger.error(f"Failed to send Telegram notification: {telegram_error}")
            # Don't fail the submission if Telegram fails

        return jsonify({
            'message': 'Form submitted successfully',
            'submission_id': submission.id
        }), 200

    except Exception as e:
        logger.error(f"Error submitting authority form: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500
