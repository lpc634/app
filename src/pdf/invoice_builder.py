"""
Professional Invoice PDF Builder using ReportLab Platypus
V3 Services Ltd - Agent Portal
"""

from datetime import datetime, date
from decimal import Decimal
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, 
    PageTemplate, Frame, BaseDocTemplate, NextPageTemplate, PageBreak, Flowable
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.platypus.tableofcontents import SimpleIndex


# Color Scheme
PRIMARY = HexColor('#E85D1F')      # V3 Orange
DARK = HexColor('#263238')         # Dark Grey
MUTED = HexColor('#607D8B')        # Muted Blue-Grey  
LIGHT_BG = HexColor('#F3F5F7')     # Light Background
GRID = HexColor('#DDE3E8')         # Grid Lines
BLACK = colors.black
WHITE = colors.white


def build_invoice_pdf(file_path, agent, jobs, totals, invoice_number, invoice_date, agent_invoice_number=None, invoice=None):
    """
    Build a professional invoice PDF using ReportLab Platypus.
    
    Args:
        file_path: Output file path
        agent: Agent object with name, address, contact details
        jobs: List of job dictionaries with date, address, hours, rate, amount
        totals: Dictionary with subtotal, vat, total
        invoice_number: Invoice number string
        invoice_date: Invoice date (date object)
    """
    # Create document with A4 page size and smaller margins for single-page layout
    doc = BaseDocTemplate(
        file_path,
        pagesize=A4,
        rightMargin=24,
        leftMargin=24,
        topMargin=24,
        bottomMargin=24
    )
    
    # Define frame for main content with smaller margins
    frame = Frame(
        24, 24, A4[0] - 48, A4[1] - 48,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    
    # Create page template with custom footer
    template = PageTemplate(
        id='normal',
        frames=frame,
        onPage=lambda canvas, doc: _draw_footer(canvas, doc)
    )
    doc.addPageTemplates([template])
    
    # Build story (content flowables) - professional layout
    story = []
    
    # Title with professional separator
    story.append(_create_title())
    story.append(Spacer(1, 8))
    # Add professional horizontal line
    hr = HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceBefore=5, spaceAfter=5)
    story.append(hr)
    story.append(Spacer(1, 15))  # Space after separator
    
    # Header with agent info and contact panel
    story.append(_create_header(agent))
    story.append(Spacer(1, 25))  # More space after header
    
    # Invoice meta (number and date)
    story.append(_create_invoice_meta(invoice_number, invoice_date, agent_invoice_number))
    story.append(Spacer(1, 25))  # More space after meta
    
    # Bill To section
    bill_to_items = _create_bill_to_section()
    story.extend(bill_to_items)
    story.append(Spacer(1, 20))  # More space after Bill To
    
    # Services table - use snapshotted invoice data if available
    services_items = _create_services_section(jobs, invoice)
    story.extend(services_items)
    story.append(Spacer(1, 20))  # More space after services
    
    # Totals
    story.append(_create_totals_section(totals))
    story.append(Spacer(1, 25))  # More space after totals
    
    # Payment Details with integrated tax statement
    payment_items = _create_payment_details(agent)
    story.extend(payment_items)
    
    # Build the PDF
    doc.build(story)


def _create_styles():
    """Create paragraph styles for consistent typography."""
    styles = {}
    
    # H1 - 20pt bold
    styles['h1'] = ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=DARK,
        spaceAfter=6,
        leading=24
    )
    
    # H2 - 12pt bold ALL CAPS
    styles['h2'] = ParagraphStyle(
        'H2', 
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=DARK,
        spaceAfter=8,
        leading=16
    )
    
    # Body - 10pt
    styles['body'] = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=10,
        textColor=BLACK,
        leading=12,
        spaceAfter=6
    )
    
    # Small - 9pt
    styles['small'] = ParagraphStyle(
        'Small',
        fontName='Helvetica',
        fontSize=9,
        textColor=MUTED,
        leading=11
    )
    
    # Small caps for labels
    styles['small_caps'] = ParagraphStyle(
        'SmallCaps',
        fontName='Helvetica',
        fontSize=9,
        textColor=MUTED,
        leading=11
    )
    
    return styles


def _create_title():
    """Create the main INVOICE title with professional styling."""
    styles = _create_styles()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['h1'],
        fontSize=28,  # Larger title
        textColor=PRIMARY,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,  # Center the title
        spaceAfter=0,
        spaceBefore=0
    )
    return Paragraph("INVOICE", title_style)


def _create_header(agent):
    """Create professional header with agent details on left and contact panel on right."""
    styles = _create_styles()
    
    # Agent name (larger, bold)
    agent_name = f"{_safe_str(agent.first_name)} {_safe_str(agent.last_name)}".strip()
    if not agent_name:
        agent_name = "Agent"
    
    # Create professional agent name style
    name_style = ParagraphStyle(
        'AgentName',
        parent=styles['body'],
        fontSize=14,
        textColor=DARK,
        fontName='Helvetica-Bold',
        spaceAfter=8
    )
    
    agent_name_para = Paragraph(agent_name, name_style)
    
    # Agent address with better formatting
    agent_address_lines = []
    if agent.address_line_1:
        agent_address_lines.append(_safe_str(agent.address_line_1))
    if agent.address_line_2:
        agent_address_lines.append(_safe_str(agent.address_line_2))
    if agent.city:
        agent_address_lines.append(_safe_str(agent.city))
    if agent.postcode:
        agent_address_lines.append(_safe_str(agent.postcode))
    
    if not agent_address_lines:
        agent_address_lines = ["Address not provided"]
    
    # Create address with proper line spacing
    address_style = ParagraphStyle(
        'Address',
        parent=styles['body'],
        fontSize=10,
        leading=14,
        spaceAfter=4
    )
    
    agent_address = "<br/>".join(agent_address_lines)
    agent_address_para = Paragraph(agent_address, address_style)
    
    # Create left column with name and address
    left_column_data = [[agent_name_para], [agent_address_para]]
    left_column_table = Table(left_column_data, colWidths=[280])
    left_column_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    # Contact panel (right side) with better styling
    contact_data = [
        [Paragraph("<b>Email:</b>", styles['small_caps']), Paragraph(_safe_str(agent.email), styles['small'])],
        [Paragraph("<b>Phone:</b>", styles['small_caps']), Paragraph(_safe_str(agent.phone), styles['small'])],
        [Paragraph("<b>UTR:</b>", styles['small_caps']), Paragraph(_safe_str(agent.utr_number), styles['small'])]
    ]
    
    contact_table = Table(contact_data, colWidths=[60, 120])  # Better proportions
    contact_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),   # More padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),  # More padding
        ('TOPPADDING', (0, 0), (-1, -1), 6),     # More padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),  # More padding
        ('BOX', (0, 0), (-1, -1), 1.5, GRID),   # Thicker border
        ('GRID', (0, 0), (-1, -1), 0.5, GRID)   # Internal grid
    ]))
    
    # Combine in a table structure with proper spacing
    header_data = [[left_column_table, contact_table]]
    header_table = Table(header_data, colWidths=[300, 200])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return header_table


def _create_invoice_meta(invoice_number, invoice_date, agent_invoice_number=None):
    """Create right-aligned professional meta box with invoice number and date."""
    styles = _create_styles()
    
    formatted_date = fmt_date(invoice_date)
    
    meta_data = [
        [Paragraph("<b>Invoice Date:</b>", styles['small_caps']), Paragraph(formatted_date, styles['body'])]
    ]
    
    # Add Invoice Number if provided (agent's own invoice number)
    if agent_invoice_number is not None:
        meta_data.insert(0, [
            Paragraph("<b>Invoice Number:</b>", styles['small_caps']), 
            Paragraph(str(agent_invoice_number), styles['body'])
        ])
    
    # Add internal reference as a smaller secondary line
    meta_data.append([
        Paragraph("<b>Reference:</b>", styles['small_caps']), 
        Paragraph(invoice_number, styles['body'])
    ])
    
    meta_table = Table(meta_data, colWidths=[100, 110])  # Better proportions
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1.5, DARK),  # Darker, thicker border
        ('GRID', (0, 0), (-1, -1), 0.5, GRID), # Internal grid lines
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),  # More padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 10), # More padding
        ('TOPPADDING', (0, 0), (-1, -1), 8),    # More padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8), # More padding
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),     # Left align values
    ]))
    
    # Right-align the meta table with better spacing
    container_data = [["", meta_table]]
    container_table = Table(container_data, colWidths=[290, 210])
    container_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return container_table


def _create_bill_to_section():
    """Create the professional BILL TO section for V3 Services Ltd."""
    styles = _create_styles()
    
    # Enhanced section title
    title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['h2'],
        fontSize=13,
        textColor=DARK,
        fontName='Helvetica-Bold',
        spaceAfter=10,
        borderWidth=0,
        borderColor=DARK,
        borderPadding=0
    )
    title = Paragraph("BILL TO:", title_style)
    
    # Enhanced V3 Services information with better formatting
    company_style = ParagraphStyle(
        'CompanyInfo',
        parent=styles['body'],
        fontSize=11,
        leading=16,
        textColor=BLACK
    )
    
    v3_info = [
        [Paragraph("<b>V3 SERVICES LTD</b><br/>117 Dartford Road<br/>Dartford, England<br/>DA1 3EN", company_style)]
    ]
    
    v3_table = Table(v3_info, colWidths=[350])
    v3_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1.5, DARK),   # Thicker, darker border
        ('LEFTPADDING', (0, 0), (-1, -1), 15),  # More padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 15), # More padding
        ('TOPPADDING', (0, 0), (-1, -1), 12),   # More padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12), # More padding
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    return [title, Spacer(1, 10), v3_table]  # Better spacing


def _create_services_section(jobs, invoice=None):
    """Create services table with proper formatting and pagination."""
    from flask import current_app
    styles = _create_styles()
    
    # DEBUG: Log the actual data structure we receive
    current_app.logger.info(f"PDF DEBUG: jobs data structure: {jobs}")
    current_app.logger.info(f"PDF DEBUG: invoice data: {invoice}")
    if jobs:
        current_app.logger.info(f"PDF DEBUG: first job: {jobs[0]}")
        current_app.logger.info(f"PDF DEBUG: first job keys: {list(jobs[0].keys()) if isinstance(jobs[0], dict) else 'Not a dict'}")
        if isinstance(jobs[0], dict) and 'job' in jobs[0]:
            job_obj = jobs[0]['job']
            current_app.logger.info(f"PDF DEBUG: job object: {job_obj}")
            current_app.logger.info(f"PDF DEBUG: job.address: {getattr(job_obj, 'address', 'NO ADDRESS ATTR')}")
            current_app.logger.info(f"PDF DEBUG: job.job_type: {getattr(job_obj, 'job_type', 'NO JOB_TYPE ATTR')}")
    else:
        current_app.logger.warning("PDF DEBUG: No jobs data provided")
    
    # Enhanced section title
    title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['h2'],
        fontSize=13,
        textColor=DARK,
        fontName='Helvetica-Bold',
        spaceAfter=10,
    )
    title = Paragraph("SERVICES PROVIDED:", title_style)
    
    # Extract job details with fallbacks
    job_address = ""
    service = ""
    
    if invoice:
        # Use snapshotted data first
        job_address = getattr(invoice, 'address', None) or ""
        service = getattr(invoice, 'job_type', None) or ""
        current_app.logger.info(f"PDF: Using snapshotted invoice data - service: '{service}', address: '{job_address}'")
    
    # Fallback to job data if snapshotted data is missing
    if (not service or not job_address) and jobs:
        first_job = jobs[0]
        job_obj = first_job.get('job') if isinstance(first_job, dict) else None
        if job_obj:
            if not job_address:
                job_address = getattr(job_obj, 'address', '') or ""
            if not service:
                service = getattr(job_obj, 'job_type', '') or ""
        current_app.logger.info(f"PDF: Applied fallback from job data - service: '{service}', address: '{job_address}'")
    
    # Check if we should show "No services recorded"
    if not jobs or (not service and not job_address):
        current_app.logger.warning(f"PDF: Showing 'No services recorded' - jobs: {bool(jobs)}, service: '{service}', address: '{job_address}'")
        no_jobs = Paragraph("No services recorded", styles['body'])
        return [title, Spacer(1, 8), no_jobs]
    
    # Create service description subheading if service exists
    story_items = [title, Spacer(1, 10)]  # Better spacing
    if service:
        service_style = ParagraphStyle(
            'ServiceDesc',
            parent=styles['body'],
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=PRIMARY,  # Use V3 orange color
            spaceAfter=6
        )
        service_desc = Paragraph(f"{service}", service_style)
        story_items.extend([service_desc, Spacer(1, 8)])  # Better spacing
        current_app.logger.info(f"PDF: Added service description: '{service}'")
    
    # Table headers
    headers = [
        Paragraph("<b>Date</b>", styles['small']),
        Paragraph("<b>Address</b>", styles['small']),
        Paragraph("<b>Hours</b>", styles['small']), 
        Paragraph("<b>Rate</b>", styles['small']),
        Paragraph("<b>Amount</b>", styles['small'])
    ]
    
    # Table data - use invoice data if available
    table_data = [headers]
    
    if jobs:
        # Use first job for table data (assuming single job per invoice for now)
        first_job = jobs[0]
        
        # Extract actual job date - normalized jobs have 'date' at top level
        job_date = fmt_date(first_job.get('date') or first_job.get('arrival_time'))
        
        # If no date in normalized data, fall back to invoice date
        if not job_date and invoice and hasattr(invoice, 'issue_date'):
            job_date = fmt_date(invoice.issue_date)
            current_app.logger.warning(f"PDF: No job date found, using invoice date as fallback: {job_date}")
        
        # Ensure we always have a date - if still missing, use today
        if not job_date:
            job_date = "Date not provided"
            current_app.logger.warning(f"PDF: No job date available, using fallback: {job_date}")
        else:
            current_app.logger.info(f"PDF: Using job date: {job_date}")
        
        # For address, use normalized job data first, then fallback to snapshotted data
        normalized_address = first_job.get('address', '')
        if normalized_address:
            job_address = normalized_address
            current_app.logger.info(f"PDF: Using normalized job address: '{job_address}'")
        
        # Ensure we always have an address - if still missing, use fallback
        if not job_address:
            job_address = "Address not provided"
            current_app.logger.warning(f"PDF: No job address available, using fallback: {job_address}")
        
        # Extract job details
        job_hours = fmt_hours(first_job.get('hours', 0))
        job_rate = fmt_money(first_job.get('rate', 0))
        job_amount = fmt_money(first_job.get('amount', 0))
        
        # Log the final values being used in the PDF
        current_app.logger.info(f"PDF: Final row data - Date: '{job_date}', Address: '{job_address}', Hours: '{job_hours}', Rate: '{job_rate}', Amount: '{job_amount}'")
        
        # Create table row
        row = [
            Paragraph(job_date, styles['small']),
            Paragraph(job_address, styles['small']),
            Paragraph(job_hours, styles['small']),
            Paragraph(job_rate, styles['small']),
            Paragraph(job_amount, styles['small'])
        ]
        table_data.append(row)
    
    # Create professional table with better column widths: Date(80), Address(flexible), Hours(60), Rate(75), Amount(85)
    services_table = Table(table_data, colWidths=[80, None, 60, 75, 85], repeatRows=1)
    
    # Professional table styling with enhanced borders and spacing
    table_style = [
        # Header styling - darker background and white text
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),   # Center header text
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),  # More padding
        ('TOPPADDING', (0, 0), (-1, 0), 8),     # More padding
        
        # Data rows with better formatting
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 6),    # More padding
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6), # More padding
        ('LEFTPADDING', (0, 0), (-1, -1), 8),   # More padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),  # More padding
        
        # Column-specific alignment
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),   # Date column centered
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),     # Address column left
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),   # Hours column centered
        ('ALIGN', (3, 1), (3, -1), 'CENTER'),   # Rate column centered
        ('ALIGN', (4, 1), (4, -1), 'RIGHT'),    # Amount column right
        
        # Professional borders
        ('BOX', (0, 0), (-1, -1), 2, DARK),     # Outer border - thick and dark
        ('LINEBELOW', (0, 0), (-1, 0), 2, DARK), # Header bottom border
        ('GRID', (0, 1), (-1, -1), 0.5, GRID),  # Internal grid - thin
        
        # Professional alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, HexColor('#F8F9FA')]),
        
        # Value alignment and formatting
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),  # Vertical center alignment
    ]
    
    services_table.setStyle(TableStyle(table_style))
    story_items.append(services_table)
    
    return story_items


def _create_totals_section(totals):
    """Create professional right-aligned totals box."""
    styles = _create_styles()
    
    subtotal = totals.get('subtotal', totals.get('total', 0))
    vat = totals.get('vat', 0)
    total = totals.get('total', 0)
    
    # Create enhanced styles for totals
    total_label_style = ParagraphStyle(
        'TotalLabel',
        parent=styles['body'],
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=DARK
    )
    
    total_value_style = ParagraphStyle(
        'TotalValue',
        parent=styles['body'],
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=DARK
    )
    
    final_total_style = ParagraphStyle(
        'FinalTotal',
        parent=styles['body'],
        fontSize=12,
        fontName='Helvetica-Bold',
        textColor=PRIMARY  # Use V3 orange for emphasis
    )
    
    totals_data = [
        [Paragraph("Subtotal:", styles['body']), Paragraph(fmt_money(subtotal), styles['body'])],
        [Paragraph("VAT (0%):", styles['body']), Paragraph(fmt_money(vat), styles['body'])],
        [Paragraph("TOTAL:", final_total_style), Paragraph(fmt_money(total), final_total_style)]
    ]
    
    totals_table = Table(totals_data, colWidths=[100, 100])  # Better proportions
    totals_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 2, DARK),     # Thicker border
        ('BACKGROUND', (0, 0), (-1, -2), LIGHT_BG),  # Light background for subtotal/VAT
        ('BACKGROUND', (0, -1), (-1, -1), HexColor('#FFF3E0')),  # Orange tint for total
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),  # More padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 12), # More padding
        ('TOPPADDING', (0, 0), (-1, -1), 8),    # More padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8), # More padding
        # Emphasize total row with thicker line
        ('LINEABOVE', (0, -1), (-1, -1), 2.5, DARK),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Internal lines
        ('GRID', (0, 0), (-1, -2), 0.5, GRID),  # Thin internal lines
    ]))
    
    # Right-align the totals table with better proportions
    container_data = [["", totals_table]]
    container_table = Table(container_data, colWidths=[300, 200])
    container_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return container_table


def _create_payment_details(agent):
    """Create professional payment details panel."""
    styles = _create_styles()
    
    # Enhanced section title
    title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['h2'],
        fontSize=13,
        textColor=DARK,
        fontName='Helvetica-Bold',
        spaceAfter=10,
    )
    title = Paragraph("PAYMENT DETAILS:", title_style)
    
    # Payment details data with better formatting
    payment_rows = [
        kv_row("Payment Method:", "BACS Transfer Only"),
        kv_row("Account Name:", f"{_safe_str(agent.first_name)} {_safe_str(agent.last_name)}".strip() or "Not provided"),
        kv_row("Bank Name:", _safe_str(agent.bank_name)),
        kv_row("Account Number:", _safe_str(agent.bank_account_number)),
        kv_row("Sort Code:", _safe_str(agent.bank_sort_code)),
        kv_row("UTR Number:", _safe_str(agent.utr_number))
    ]
    
    payment_table = Table(payment_rows, colWidths=[140, 220])  # Better proportions
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1.5, DARK),   # Thicker border
        ('GRID', (0, 0), (-1, -1), 0.5, GRID),  # Internal grid
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),  # More padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 12), # More padding
        ('TOPPADDING', (0, 0), (-1, -1), 8),    # More padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8), # More padding
    ]))
    
    # Add professional tax statement as separate element
    tax_statement_style = ParagraphStyle(
        'TaxStatement',
        parent=styles['body'],
        fontSize=9,
        leading=12,
        textColor=MUTED,
        leftIndent=0,
        rightIndent=0,
        spaceAfter=6
    )
    
    tax_text = ("I confirm that I am responsible for any Tax or National Insurance "
                "due on all invoices that I have submitted to V3 Services Ltd.")
    
    tax_statement = Paragraph(tax_text, tax_statement_style)
    
    # Create bordered tax statement
    tax_container = Table([[tax_statement]], colWidths=[480])
    tax_container.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F8F9FA')),
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    return [title, Spacer(1, 10), payment_table, Spacer(1, 15), tax_container]


class TaxStatementFlowable(Flowable):
    """Custom flowable to draw tax statement inside the payment box."""
    
    def __init__(self, payment_table_height):
        Flowable.__init__(self)
        self.payment_table_height = payment_table_height
    
    def wrap(self, availWidth, availHeight):
        # Reserve space for the tax statement
        return (availWidth, 30)  # 30 points height for tax statement
    
    def draw(self):
        canvas = self.canv
        canvas.saveState()
        
        # Tax statement text
        tax_statement = (
            "I confirm that I am responsible for any Tax or National Insurance "
            "due on all invoices that I have submitted to V3 Services Ltd."
        )
        
        # Position the tax statement inside the payment box
        # The payment box is positioned at the right side of the page
        left_margin = 24  # Page left margin
        right_margin = A4[0] - 24  # Page right margin
        
        # Payment box position (right-aligned, 160 points wide)
        payment_box_left = right_margin - 160
        payment_box_right = right_margin
        
        # Inner box area (with padding)
        inner_left = payment_box_left + 15
        inner_right = payment_box_right - 15
        inner_width = inner_right - inner_left
        
        # Position below the UTR line (approximately 30 points below the table)
        tax_y = self.payment_table_height + 30
        
        # Draw tax statement
        canvas.setFont("Helvetica", 10)
        canvas.setFillColor(BLACK)
        
        # Text wrapping for the tax statement
        words = tax_statement.split()
        lines = []
        current_line = ""
        
        for word in words:
            test_line = current_line + " " + word if current_line else word
            if canvas.stringWidth(test_line, "Helvetica", 10) <= inner_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
        
        # Draw each line
        for i, line in enumerate(lines):
            y_pos = tax_y - (i * 12)  # 12 points line spacing
            canvas.drawString(inner_left, y_pos, line)
        
        canvas.restoreState()


def _conditional_page_break(min_space):
    """Add page break if less than min_space points remaining."""
    class ConditionalPageBreak(Flowable):
        def __init__(self, min_space):
            Flowable.__init__(self)
            self.min_space = min_space
        
        def wrap(self, availWidth, availHeight):
            if availHeight < self.min_space:
                return (0, availHeight)  # Force page break
            return (0, 0)  # No space needed
        
        def draw(self):
            pass  # Nothing to draw
    
    return ConditionalPageBreak(min_space)


def _draw_footer(canvas, doc):
    """Draw footer on every page with V3 Services info and page numbers."""
    canvas.saveState()
    
    # Footer line
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.5)
    canvas.line(36, 60, A4[0] - 36, 60)
    
    # Left footer text
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(36, 45, "V3 Services Ltd — Agent Portal")
    
    # Right footer text (page numbers)  
    # Note: Total page count not available until after build, so just show current page
    page_text = f"Page {canvas.getPageNumber()}"
    canvas.drawRightString(A4[0] - 36, 45, page_text)
    
    canvas.restoreState()


# Helper Functions

def fmt_date(dt):
    """Format date as DD/MM/YYYY."""
    if dt is None:
        return "Not provided"
    
    if isinstance(dt, str):
        try:
            # Try parsing common date formats
            for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y']:
                try:
                    dt = datetime.strptime(dt, fmt).date()
                    break
                except ValueError:
                    continue
            else:
                return "Invalid date"
        except:
            return "Invalid date"
    
    if isinstance(dt, datetime):
        dt = dt.date()
    
    if isinstance(dt, date):
        return dt.strftime('%d/%m/%Y')
    
    return "Invalid date"


def fmt_money(amount):
    """Format amount as £{x:,.2f}."""
    if amount is None:
        return "£0.00"
    
    try:
        if isinstance(amount, str):
            amount = float(amount)
        elif isinstance(amount, Decimal):
            amount = float(amount)
        
        return f"£{amount:,.2f}"
    except (ValueError, TypeError):
        return "£0.00"


def fmt_hours(hours):
    """Format hours as X.Xh."""
    if hours is None:
        return "0.0h"
    
    try:
        if isinstance(hours, str):
            hours = float(hours)
        elif isinstance(hours, Decimal):
            hours = float(hours)
        
        return f"{hours:.1f}h"
    except (ValueError, TypeError):
        return "0.0h"


def kv_row(label, value):
    """Create a professional key-value row for tables."""
    styles = _create_styles()
    
    # Enhanced label style
    label_style = ParagraphStyle(
        'KeyLabel',
        parent=styles['small_caps'],
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=DARK,
        spaceAfter=2
    )
    
    # Enhanced value style
    value_style = ParagraphStyle(
        'KeyValue',
        parent=styles['small'],
        fontSize=10,
        textColor=BLACK,
        spaceAfter=2
    )
    
    label_para = Paragraph(f"{label}", label_style)
    value_para = Paragraph(_safe_str(value), value_style)
    
    return [label_para, value_para]


def _safe_str(value):
    """Safely convert value to string, handling None values."""
    if value is None:
        return "Not provided"
    
    str_value = str(value).strip()
    return str_value if str_value else "Not provided"