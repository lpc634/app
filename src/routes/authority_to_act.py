from flask import Blueprint, jsonify, request, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from src.models.authority_to_act import AuthorityToActToken
from src.extensions import db
from datetime import datetime
import logging
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
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

        # Get form type from query params (default to squatter-eviction)
        form_type = request.args.get('form_type', 'authority-to-act-squatter-eviction')

        # Look for existing permanent token for this form type
        permanent_token = AuthorityToActToken.query.filter_by(
            status='permanent',
            form_type=form_type
        ).first()

        if not permanent_token:
            # Create permanent token
            token = AuthorityToActToken.generate_token()
            permanent_token = AuthorityToActToken(
                token=token,
                form_type=form_type,
                created_by=user.id,
                status='permanent',
                expires_at=None  # Never expires
            )
            db.session.add(permanent_token)
            db.session.commit()
            logger.info(f"Permanent Authority to Act link created by admin {user.id} for form type {form_type}")

        # Generate public URL
        base_url = current_app.config.get('PUBLIC_BASE_URL', 'https://v3-app.herokuapp.com')
        public_url = f"{base_url}/form/{permanent_token.token}"

        return jsonify({
            'url': public_url,
            'token': permanent_token.token,
            'form_type': form_type
        }), 200

    except Exception as e:
        logger.error(f"Error getting permanent link: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500


@authority_bp.route('/admin/authority-to-act/send-email', methods=['POST'])
@jwt_required()
def send_form_link_email():
    """Send form link via email with custom message."""
    try:
        user = require_admin()
        if not user:
            return jsonify({"error": "Forbidden"}), 403

        # Check if email is configured
        if not current_app.config.get('MAIL_SERVER') or not current_app.config.get('MAIL_USERNAME'):
            logger.error("Email not configured - missing MAIL_SERVER or MAIL_USERNAME")
            return jsonify({"error": "Email not configured on server"}), 500

        data = request.get_json()
        recipient_email = data.get('recipient_email')
        message_body = data.get('message_body', '')
        form_link = data.get('form_link')
        form_type_label = data.get('form_type_label')

        if not recipient_email or not form_link or not form_type_label:
            return jsonify({"error": "Missing required fields"}), 400

        # Create email
        msg = MIMEMultipart()
        mail_sender = current_app.config.get('MAIL_DEFAULT_SENDER')
        msg['From'] = formataddr(mail_sender) if isinstance(mail_sender, tuple) else mail_sender
        msg['To'] = recipient_email
        msg['Subject'] = form_type_label

        # Build email body
        email_body = f"{message_body}\n\n"
        email_body += f"Please complete the form by clicking the link below:\n\n"
        email_body += f"{form_link}\n\n"
        email_body += f"Thank you,\nV3 Services"

        msg.attach(MIMEText(email_body, 'plain'))

        # Send email
        server = smtplib.SMTP(current_app.config['MAIL_SERVER'], current_app.config['MAIL_PORT'])
        if current_app.config.get('MAIL_USE_TLS'):
            server.starttls()
        server.login(current_app.config['MAIL_USERNAME'], current_app.config['MAIL_PASSWORD'])
        server.send_message(msg)
        server.quit()

        logger.info(f"Form link email sent to {recipient_email} by admin {user.id}")
        return jsonify({"message": "Email sent successfully"}), 200

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {e}")
        return jsonify({"error": "Email authentication failed. Check email credentials."}), 500
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {e}")
        return jsonify({"error": f"Email server error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Error sending form link email: {e}", exc_info=True)
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500


@authority_bp.route('/admin/authority-to-act/submissions', methods=['GET'])
@jwt_required()
def list_submissions():
    """List all Authority to Act form submissions."""
    try:
        user = require_admin()
        if not user:
            return jsonify({"error": "Forbidden"}), 403

        # Get form type from query params
        form_type = request.args.get('form_type')

        # Get all submissions (status='submitted') filtered by form type
        query = AuthorityToActToken.query.filter_by(status='submitted')
        if form_type:
            query = query.filter_by(form_type=form_type)

        submissions = query.order_by(AuthorityToActToken.submitted_at.desc()).all()

        result = []
        for sub in submissions:
            data = sub.submission_data or {}
            result.append({
                'id': sub.id,
                'client_name': data.get('client_name'),
                'client_email': data.get('client_email'),
                'property_address': data.get('property_address'),
                'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
                'submission_data': data,
                'is_read': sub.is_read,
                'form_type': sub.form_type
            })

        return jsonify({'submissions': result}), 200

    except Exception as e:
        logger.error(f"Error listing submissions: {e}")
        return jsonify({"error": "Internal server error"}), 500


@authority_bp.route('/admin/authority-to-act/submissions/<int:submission_id>/mark-read', methods=['POST'])
@jwt_required()
def mark_submission_read(submission_id):
    """Mark a submission as read."""
    try:
        user = require_admin()
        if not user:
            return jsonify({"error": "Forbidden"}), 403

        submission = AuthorityToActToken.query.get(submission_id)
        if not submission or submission.status != 'submitted':
            return jsonify({"error": "Submission not found"}), 404

        submission.is_read = True
        db.session.commit()

        return jsonify({"message": "Marked as read"}), 200

    except Exception as e:
        logger.error(f"Error marking submission as read: {e}")
        db.session.rollback()
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


@authority_bp.route('/form/<token>', methods=['GET'])
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


@authority_bp.route('/form/<token>/submit', methods=['POST'])
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
            form_type=permanent_token.form_type,  # Inherit form type from permanent token
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
