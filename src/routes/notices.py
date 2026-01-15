# src/routes/notices.py
from flask import Blueprint, jsonify, request, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from datetime import datetime
import io
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from PyPDF2 import PdfReader, PdfWriter

notices_bp = Blueprint('notices', __name__)

def require_admin():
    """Helper to check if current user is admin"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return None
    return user

def generate_notice_pdf(notice_type, notice_data):
    """
    Generate a notice PDF using the same template system as V3 job reports.
    Returns bytes of the PDF file.
    """
    # Path to the headed template
    template_path = os.path.join(os.path.dirname(__file__), '..', 'templates', 'headed_template.pdf')
    
    # First, generate the content PDF
    content_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        content_buffer,
        pagesize=A4,
        rightMargin=1.5*cm,
        leftMargin=1.5*cm,
        topMargin=2.4*cm,  # REDUCED - fit on one page
        bottomMargin=1.0*cm  # REDUCED - fit on one page
    )
    
    # Styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='NoticeTitle',
        parent=styles['Heading1'],
        fontSize=16,  # REDUCED from 20
        spaceAfter=12,  # REDUCED from 20
        alignment=TA_CENTER,
        textColor=colors.HexColor('#ff0000'),  # Red for legal notices
        underline=1  # ADD UNDERLINE
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading2'],
        fontSize=11,  # REDUCED from 14
        spaceBefore=8,  # REDUCED from 15
        spaceAfter=6,  # REDUCED from 10
        textColor=colors.HexColor('#ff6b35')
    ))
    styles.add(ParagraphStyle(
        name='FieldLabel',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='FieldValue',
        parent=styles['Normal'],
        fontSize=9,  # REDUCED from 11
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=4  # REDUCED from 8
    ))
    styles.add(ParagraphStyle(
        name='LegalText',
        parent=styles['Normal'],
        fontSize=8.5,  # REDUCED from 10
        textColor=colors.HexColor('#333333'),
        spaceBefore=2  # REDUCED from 5
    ))
    
    elements = []
    
    if notice_type == 'notice_to_vacate':
        elements = generate_notice_to_vacate_content(notice_data, styles)
    elif notice_type == 'abandoned_vehicle':
        elements = generate_abandoned_vehicle_content(notice_data, styles)
    else:
        raise ValueError('Invalid notice type')
    
    # Build content PDF
    doc.build(elements)
    content_buffer.seek(0)
    
    # Now merge content with the headed template
    try:
        # Read the template
        template_reader = PdfReader(template_path)
        template_page = template_reader.pages[0]
        
        # Read the content we just generated
        content_reader = PdfReader(content_buffer)
        
        # Create output PDF
        output = PdfWriter()
        
        # For each page of content, merge with template
        for i, content_page in enumerate(content_reader.pages):
            # Create a copy of the template for each page
            from copy import copy
            new_page = copy(template_page)
            # Merge the content on top of the template
            new_page.merge_page(content_page)
            output.add_page(new_page)
        
        # Write to buffer
        output_buffer = io.BytesIO()
        output.write(output_buffer)
        output_buffer.seek(0)
        return output_buffer.getvalue()
    
    except Exception as merge_error:
        # If merging fails, fall back to content-only PDF
        current_app.logger.warning(f"Template merge failed, using content only: {str(merge_error)}")
        content_buffer.seek(0)
        return content_buffer.getvalue()

def generate_notice_to_vacate_content(data, styles):
    """Generate content for Notice to Vacate"""
    elements = []
    
    # Title - smaller font
    elements.append(Paragraph("LEGAL NOTICE TO VACATE PREMISES", styles['NoticeTitle']))
    elements.append(Spacer(1, 0.08*inch))  # REDUCED to fit on one page
    
    # Property Address
    elements.append(Paragraph("PROPERTY ADDRESS", styles['SectionTitle']))
    address_text = data.get('property_address', '[ADDRESS NOT PROVIDED]')
    elements.append(Paragraph(address_text, styles['FieldValue']))
    elements.append(Spacer(1, 0.05*inch))  # REDUCED to fit one page
    
    # Date
    notice_date = data.get('date', datetime.now().strftime('%d/%m/%Y'))  # Changed to DD/MM/YYYY
    date_data = [['Date:', notice_date]]
    date_table = Table(date_data, colWidths=[0.6*inch, 1.5*inch])  # Tightened - reduced gap
    date_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),  # REDUCED to fit one page
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),  # REDUCED to fit one page
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),  # Left align
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),  # Left align date value
    ]))
    elements.append(date_table)
    elements.append(Spacer(1, 0.05*inch))  # REDUCED to fit one page
    
    # To Occupiers
    elements.append(Paragraph("TO: THE OCCUPIERS", styles['SectionTitle']))
    client_name = data.get('client_name', 'the legal owner')
    intro_text = f"We are writing on behalf of {client_name} of the above property."
    elements.append(Paragraph(intro_text, styles['FieldValue']))
    elements.append(Spacer(1, 0.05*inch))  # REDUCED to fit one page
    
    # Take Notice
    elements.append(Paragraph("TAKE NOTICE:", styles['SectionTitle']))
    
    # Compact notice points - combine some to save space
    notices = [
        "1. You are currently occupying the above premises WITHOUT the permission or authority of the legal owner. Your occupation constitutes TRESPASS under English Law.",
        "",
        "2. The legal owner has NOT granted you any right, licence, or permission to occupy these premises.",
        "",
        "3. You are hereby required to VACATE THE PREMISES IMMEDIATELY and remove all of your belongings and any persons under your control.",
        "",
        "4. V3 Services Ltd has been instructed by the legal owner to take all lawful steps necessary to secure possession of this property.",
        "",
        "5. Failure to vacate will result in the legal owner pursuing formal possession proceedings through the County Court, which may result in a Court Order for possession and costs being awarded against you.",
        "",
        "6. Any damage to the property, theft, or interference with utilities will be reported to the police and may result in criminal prosecution.",
    ]
    
    for notice in notices:
        if notice:
            elements.append(Paragraph(notice, styles['LegalText']))
        else:
            elements.append(Spacer(1, 0.02*inch))  # REDUCED to fit one page
    
    elements.append(Spacer(1, 0.05*inch))  # REDUCED to fit one page
    
    # Legal Warning - more compact
    elements.append(Paragraph("LEGAL WARNING", styles['SectionTitle']))
    warning_text = """Under Section 144 of the Legal Aid, Sentencing and Punishment of Offenders Act 2012, 
    you are committing an act of trespass. The property owner is entitled to take lawful action to recover possession. 
    This notice serves as formal notification that you must leave immediately. The property owner reserves all legal rights."""
    elements.append(Paragraph(warning_text, styles['LegalText']))
    elements.append(Spacer(1, 0.08*inch))  # REDUCED to fit one page
    
    # Issued By - compact table (NO DIRECTOR LINE)
    issued_data = [
        ['Issued by:', 'V3 Services Ltd'],
        ['Contact:', data.get('contact_phone', '0203 576 1343')],
        ['Email:', data.get('contact_email', 'Info@V3-Services.com')],
    ]
    
    issued_table = Table(issued_data, colWidths=[1.5*inch, 5*inch])
    issued_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),  # REDUCED to fit one page
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),  # REDUCED to fit one page
    ]))
    elements.append(issued_table)
    
    return elements

def generate_abandoned_vehicle_content(data, styles):
    """Generate content for Abandoned Vehicle Report"""
    elements = []
    
    # Title
    elements.append(Paragraph("ABANDONED VEHICLE REPORT", styles['NoticeTitle']))
    elements.append(Spacer(1, 0.3*inch))
    
    # Report Details
    elements.append(Paragraph("REPORT DETAILS", styles['SectionTitle']))
    report_data = [
        ['Date Reported:', data.get('date', datetime.now().strftime('%d/%m/%Y'))],  # Changed to DD/MM/YYYY
        ['Location:', data.get('location', '[LOCATION NOT PROVIDED]')],
        ['Client:', data.get('client_name', '[CLIENT NAME NOT PROVIDED]')],
    ]
    
    report_table = Table(report_data, colWidths=[2*inch, 4.5*inch])
    report_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(report_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Vehicle Details
    elements.append(Paragraph("VEHICLE DETAILS", styles['SectionTitle']))
    vehicle_data = [
        ['Registration:', data.get('registration', '[REG NOT PROVIDED]')],
        ['Make/Model:', data.get('make_model', '[NOT PROVIDED]')],
        ['Colour:', data.get('colour', '[NOT PROVIDED]')],
        ['Condition:', data.get('condition', '[NOT PROVIDED]')],
    ]
    
    vehicle_table = Table(vehicle_data, colWidths=[2*inch, 4.5*inch])
    vehicle_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(vehicle_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Description
    elements.append(Paragraph("DESCRIPTION", styles['SectionTitle']))
    description = data.get('description', 'Vehicle appears to have been abandoned on the property.')
    elements.append(Paragraph(description, styles['FieldValue']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Action Taken
    elements.append(Paragraph("ACTION TAKEN", styles['SectionTitle']))
    actions = [
        "• Vehicle documented with photographs",
        "• DVLA lookup completed",
        "• Notice affixed to vehicle",
        f"• Property owner notified: {data.get('client_name', '[CLIENT]')}",
    ]
    for action in actions:
        elements.append(Paragraph(action, styles['LegalText']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Recommendations
    elements.append(Paragraph("RECOMMENDATIONS", styles['SectionTitle']))
    recommendations = [
        "• Property owner to contact local authority for removal",
        "• Continue monitoring for 7 days",
        "• If not removed, escalate to legal action",
    ]
    for rec in recommendations:
        elements.append(Paragraph(rec, styles['LegalText']))
    elements.append(Spacer(1, 0.3*inch))
    
    # Report By
    report_by_data = [
        ['Report compiled by:', 'V3 Services Ltd'],
        ['Agent:', data.get('agent_name', '[AGENT NAME]')],
        ['Contact:', '0203 576 1343'],
    ]
    
    report_by_table = Table(report_by_data, colWidths=[2*inch, 4.5*inch])
    report_by_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(report_by_table)
    
    return elements

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
    try:
        user = require_admin()
        if not user:
            current_app.logger.error("Access denied - user is not admin")
            return jsonify({'error': 'Forbidden'}), 403
        
        data = request.json
        if not data:
            current_app.logger.error("No JSON data received")
            return jsonify({'error': 'No data provided'}), 400
            
        notice_type = data.get('notice_type')
        notice_data = data.get('data', {})
        
        current_app.logger.info(f"Admin {user.email} generating notice type: {notice_type}")
        current_app.logger.info(f"Notice data: {notice_data}")
        
        # Generate PDF
        pdf_bytes = generate_notice_pdf(notice_type, notice_data)
        
        # Create buffer
        pdf_buffer = io.BytesIO(pdf_bytes)
        pdf_buffer.seek(0)
        
        # Create filename
        if notice_type == 'notice_to_vacate':
            filename = f"Notice_to_Vacate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        elif notice_type == 'abandoned_vehicle':
            filename = f"Abandoned_Vehicle_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        else:
            filename = f"Notice_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        current_app.logger.info(f"Successfully generated {filename}")
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        current_app.logger.error(f"Error generating notice: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': f'Failed to generate notice: {str(e)}'}), 500
