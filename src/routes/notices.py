# src/routes/notices.py
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from datetime import datetime
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib import colors
from reportlab.pdfgen import canvas
import os

notices_bp = Blueprint('notices', __name__)

def require_admin():
    """Helper to check if current user is admin"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return None
    return user

def create_notice_header(c, width, height):
    """Create V3 Services header on PDF"""
    # Add V3 logo if exists
    logo_path = 'static/v3_logo.png'
    if os.path.exists(logo_path):
        c.drawImage(logo_path, 50, height - 100, width=80, height=80, preserveAspectRatio=True, mask='auto')
    
    # Company details - right aligned
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - 50, height - 50, "V3 Services Ltd")
    
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 50, height - 65, "117 Dartford Road")
    c.drawRightString(width - 50, height - 78, "Dartford, DA1 3EN")
    c.drawRightString(width - 50, height - 91, "Tel: 0203 576 1343")
    c.drawRightString(width - 50, height - 104, "www.V3-Services.com")
    
    # Services line at top
    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    services_text = "Investigation | Surveillance | Traveller Evictions | Squatter Evictions | Security | CCTV"
    c.drawCentredString(width/2, height - 30, services_text)
    
    # Horizontal line
    c.setStrokeColorRGB(0.8, 0.8, 0.8)
    c.line(50, height - 120, width - 50, height - 120)
    
    # Footer services line
    c.setFont("Helvetica", 7)
    c.setFillColorRGB(1, 0, 0)  # Red text
    c.drawCentredString(width/2, 50, services_text)
    
    c.setFillColorRGB(0, 0, 0)  # Reset to black

def generate_notice_to_vacate_pdf(data):
    """Generate Notice to Vacate PDF"""
    buffer = io.BytesIO()
    
    # Create PDF
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Add header
    create_notice_header(c, width, height)
    
    # Start content below header
    y_position = height - 160
    
    # Title
    c.setFont("Helvetica-Bold", 18)
    c.setFillColorRGB(1, 0, 0)  # Red
    title = "LEGAL NOTICE TO VACATE PREMISES"
    c.drawCentredString(width/2, y_position, title)
    c.setFillColorRGB(0, 0, 0)  # Back to black
    y_position -= 40
    
    # Property Address
    c.setFont("Helvetica-Bold", 11)
    c.drawString(80, y_position, "PROPERTY ADDRESS:")
    y_position -= 15
    c.setFont("Helvetica", 10)
    c.drawString(80, y_position, data.get('property_address', '[ADDRESS]'))
    y_position -= 30
    
    # Date
    c.setFont("Helvetica-Bold", 10)
    c.drawString(80, y_position, f"DATE: {data.get('date', datetime.now().strftime('%d %B %Y'))}")
    y_position -= 30
    
    # To Occupiers
    c.setFont("Helvetica-Bold", 11)
    c.drawString(80, y_position, "TO: THE OCCUPIERS")
    y_position -= 25
    
    c.setFont("Helvetica", 10)
    c.drawString(80, y_position, f"We are writing on behalf of {data.get('client_name', 'the legal owner')} of the above property.")
    y_position -= 30
    
    # TAKE NOTICE
    c.setFont("Helvetica-Bold", 11)
    c.drawString(80, y_position, "TAKE NOTICE:")
    y_position -= 20
    
    # Notice points
    c.setFont("Helvetica", 10)
    notices = [
        "1. You are currently occupying the above premises WITHOUT the permission or",
        "   authority of the legal owner.",
        "",
        "2. Your occupation constitutes TRESPASS under English Law.",
        "",
        "3. The legal owner has NOT granted you any right, licence, or permission to occupy",
        "   these premises.",
        "",
        "4. You are hereby required to VACATE THE PREMISES IMMEDIATELY and remove",
        "   all of your belongings and any persons under your control.",
        "",
        "5. V3 Services Ltd has been instructed by the legal owner to take all lawful steps",
        "   necessary to secure possession of this property.",
        "",
        "6. Failure to vacate will result in the legal owner pursuing formal possession",
        "   proceedings through the County Court, which may result in a Court Order for",
        "   possession and costs being awarded against you.",
        "",
        "7. Any damage to the property, theft, or interference with utilities will be reported",
        "   to the police and may result in criminal prosecution.",
    ]
    
    for notice in notices:
        c.drawString(80, y_position, notice)
        y_position -= 14
    
    y_position -= 10
    
    # Legal Warning
    c.setFont("Helvetica-Bold", 11)
    c.drawString(80, y_position, "LEGAL WARNING:")
    y_position -= 18
    
    c.setFont("Helvetica", 9)
    warning_text = [
        "Under Section 144 of the Legal Aid, Sentencing and Punishment of Offenders Act 2012,",
        "whilst this property is non-residential, you are still committing an act of trespass. The",
        "property owner is entitled to take lawful action to recover possession.",
        "",
        "This notice serves as formal notification that you must leave immediately. The property",
        "owner reserves all legal rights and remedies available.",
    ]
    
    for line in warning_text:
        c.drawString(80, y_position, line)
        y_position -= 12
    
    y_position -= 20
    
    # Issued by
    c.setFont("Helvetica", 10)
    c.drawString(80, y_position, "Issued by:")
    y_position -= 15
    c.setFont("Helvetica-Bold", 10)
    c.drawString(80, y_position, "V3 Services Ltd")
    y_position -= 15
    c.setFont("Helvetica", 9)
    c.drawString(80, y_position, f"Director: {data.get('director_name', 'Lance Johnson')}")
    y_position -= 12
    c.drawString(80, y_position, f"Contact: {data.get('contact_phone', '0203 576 1343')}")
    y_position -= 12
    c.drawString(80, y_position, f"Email: {data.get('contact_email', 'Info@V3-Services.com')}")
    
    # Finish PDF
    c.save()
    buffer.seek(0)
    return buffer

def generate_abandoned_vehicle_pdf(data):
    """Generate Abandoned Vehicle Report PDF"""
    buffer = io.BytesIO()
    
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Add header
    create_notice_header(c, width, height)
    
    y_position = height - 160
    
    # Title
    c.setFont("Helvetica-Bold", 18)
    c.setFillColorRGB(1, 0, 0)
    title = "ABANDONED VEHICLE REPORT"
    c.drawCentredString(width/2, y_position, title)
    c.setFillColorRGB(0, 0, 0)
    y_position -= 40
    
    # Report details
    c.setFont("Helvetica-Bold", 11)
    c.drawString(80, y_position, "REPORT DETAILS")
    y_position -= 20
    
    c.setFont("Helvetica", 10)
    details = [
        f"Date Reported: {data.get('date', datetime.now().strftime('%d %B %Y'))}",
        f"Location: {data.get('location', '[LOCATION]')}",
        f"Client: {data.get('client_name', '[CLIENT NAME]')}",
        "",
        "VEHICLE DETAILS",
        f"Registration: {data.get('registration', '[REG]')}",
        f"Make/Model: {data.get('make_model', '[MAKE/MODEL]')}",
        f"Colour: {data.get('colour', '[COLOUR]')}",
        f"Condition: {data.get('condition', '[CONDITION]')}",
        "",
        "DESCRIPTION",
        f"{data.get('description', 'Vehicle appears to have been abandoned on the property.')}",
        "",
        "ACTION TAKEN",
        "• Vehicle documented with photographs",
        "• DVLA lookup completed",
        "• Notice affixed to vehicle",
        f"• Property owner notified: {data.get('client_name', '[CLIENT]')}",
        "",
        "RECOMMENDATIONS",
        "• Property owner to contact local authority for removal",
        "• Continue monitoring for 7 days",
        "• If not removed, escalate to legal action",
    ]
    
    for detail in details:
        if detail.startswith("VEHICLE DETAILS") or detail.startswith("DESCRIPTION") or detail.startswith("ACTION TAKEN") or detail.startswith("RECOMMENDATIONS"):
            c.setFont("Helvetica-Bold", 11)
            y_position -= 5
        else:
            c.setFont("Helvetica", 10)
        
        c.drawString(80, y_position, detail)
        y_position -= 14
    
    y_position -= 20
    
    # Report by
    c.setFont("Helvetica", 10)
    c.drawString(80, y_position, "Report compiled by:")
    y_position -= 15
    c.setFont("Helvetica-Bold", 10)
    c.drawString(80, y_position, "V3 Services Ltd")
    y_position -= 15
    c.setFont("Helvetica", 9)
    c.drawString(80, y_position, f"Agent: {data.get('agent_name', '[AGENT NAME]')}")
    y_position -= 12
    c.drawString(80, y_position, f"Contact: 0203 576 1343")
    
    c.save()
    buffer.seek(0)
    return buffer

@notices_bp.route('/admin/notices/types', methods=['GET'])
@jwt_required()
def get_notice_types():
    """Get available notice types"""
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden'}), 403
    
    notice_types = [
        {
            'id': 'notice_to_vacate',
            'name': 'Notice to Vacate',
            'description': 'Legal notice for squatters to vacate commercial property',
            'fields': [
                {'name': 'property_address', 'label': 'Property Address', 'type': 'textarea', 'required': True},
                {'name': 'client_name', 'label': 'Client Name', 'type': 'text', 'required': True},
                {'name': 'date', 'label': 'Date Notice Served', 'type': 'date', 'required': True},
                {'name': 'director_name', 'label': 'Director Name', 'type': 'text', 'required': False, 'default': 'Lance Johnson'},
                {'name': 'contact_phone', 'label': 'Contact Phone', 'type': 'text', 'required': False, 'default': '0203 576 1343'},
                {'name': 'contact_email', 'label': 'Contact Email', 'type': 'email', 'required': False, 'default': 'Info@V3-Services.com'},
            ]
        },
        {
            'id': 'abandoned_vehicle',
            'name': 'Abandoned Vehicle Report',
            'description': 'Report for abandoned vehicles on client property',
            'fields': [
                {'name': 'location', 'label': 'Location', 'type': 'textarea', 'required': True},
                {'name': 'client_name', 'label': 'Client Name', 'type': 'text', 'required': True},
                {'name': 'registration', 'label': 'Vehicle Registration', 'type': 'text', 'required': True},
                {'name': 'make_model', 'label': 'Make/Model', 'type': 'text', 'required': True},
                {'name': 'colour', 'label': 'Colour', 'type': 'text', 'required': True},
                {'name': 'condition', 'label': 'Vehicle Condition', 'type': 'text', 'required': True},
                {'name': 'description', 'label': 'Description', 'type': 'textarea', 'required': True},
                {'name': 'agent_name', 'label': 'Agent Name', 'type': 'text', 'required': True},
                {'name': 'date', 'label': 'Report Date', 'type': 'date', 'required': True},
            ]
        }
    ]
    
    return jsonify(notice_types)

@notices_bp.route('/admin/notices/generate', methods=['POST'])
@jwt_required()
def generate_notice():
    """Generate a notice PDF"""
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden'}), 403
    
    data = request.json
    notice_type = data.get('notice_type')
    notice_data = data.get('data', {})
    
    # Generate PDF based on notice type
    if notice_type == 'notice_to_vacate':
        pdf_buffer = generate_notice_to_vacate_pdf(notice_data)
        filename = f"Notice_to_Vacate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    elif notice_type == 'abandoned_vehicle':
        pdf_buffer = generate_abandoned_vehicle_pdf(notice_data)
        filename = f"Abandoned_Vehicle_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    else:
        return jsonify({'error': 'Invalid notice type'}), 400
    
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=filename
    )
