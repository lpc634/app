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
    # Create document with A4 page size and minimal margins for single-page layout
    doc = BaseDocTemplate(
        file_path,
        pagesize=A4,
        rightMargin=18,  # Reduced from 24
        leftMargin=18,   # Reduced from 24
        topMargin=15,    # Reduced from 24
        bottomMargin=15  # Reduced from 24
    )
    
    # Define frame for main content with minimal margins
    frame = Frame(
        18, 15, A4[0] - 36, A4[1] - 30,  # More content area
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    
    # Create page template with custom footer
    template = PageTemplate(
        id='normal',
        frames=frame,
        onPage=lambda canvas, doc: _draw_footer(canvas, doc)
    )
    doc.addPageTemplates([template])
    
    # Build story (content flowables) - compact single-page layout
    story = []
    
    # Compact title with minimal separator
    story.append(_create_title())
    story.append(Spacer(1, 4))  # Reduced from 8
    # Add thin horizontal line
    hr = HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceBefore=2, spaceAfter=2)
    story.append(hr)
    story.append(Spacer(1, 8))  # Reduced from 15
    
    # Compact header with agent info and contact panel
    story.append(_create_header(agent))
    story.append(Spacer(1, 12))  # Reduced from 25
    
    # Invoice meta (number and date)
    story.append(_create_invoice_meta(invoice_number, invoice_date, agent_invoice_number))
    story.append(Spacer(1, 12))  # Reduced from 25
    
    # Bill To section
    bill_to_items = _create_bill_to_section()
    story.extend(bill_to_items)
    story.append(Spacer(1, 10))  # Reduced from 20
    
    # Services table - use snapshotted invoice data if available
    services_items = _create_services_section(jobs, invoice)
    story.extend(services_items)
    story.append(Spacer(1, 10))  # Reduced from 20
    
    # Totals
    story.append(_create_totals_section(totals))
    story.append(Spacer(1, 12))  # Reduced from 25
    
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
    """Create the main INVOICE title with compact styling."""
    styles = _create_styles()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['h1'],
        fontSize=26,  # Slightly larger for stronger hierarchy
        textColor=PRIMARY,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,  # Center the title
        spaceAfter=0,
        spaceBefore=0
    )
    return Paragraph("INVOICE", title_style)


def _create_header(agent):
    """Create compact header with agent details on left and contact panel on right."""
    styles = _create_styles()
    
    # Agent name - more compact
    agent_name = f"{_safe_str(agent.first_name)} {_safe_str(agent.last_name)}".strip()
    if not agent_name:
        agent_name = "Agent"
    
    # Agent address with compact formatting
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
    
    # Create compact agent info - name and address together
    agent_info_style = ParagraphStyle(
        'CompactAgentInfo',
        parent=styles['body'],
        fontSize=9,  # Smaller font
        leading=11,  # Tight line spacing
        textColor=BLACK
    )
    
    agent_full_info = f"<b>{agent_name}</b><br/>{('<br/>'.join(agent_address_lines))}"
    agent_info_para = Paragraph(agent_full_info, agent_info_style)
    
    # Compact contact panel 
    contact_style = ParagraphStyle(
        'CompactContact',
        parent=styles['small'],
        fontSize=8,  # Even smaller
        leading=10,
        textColor=BLACK
    )
    
    contact_info = f"<b>Email:</b> {_safe_str(agent.email)}<br/><b>Phone:</b> {_safe_str(agent.phone)}<br/><b>UTR:</b> {_safe_str(agent.utr_number)}"
    contact_para = Paragraph(contact_info, contact_style)
    
    contact_table = Table([[contact_para]], colWidths=[160])
    contact_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),   # Reduced padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),  # Reduced padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),    # Reduced padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Reduced padding
        ('BOX', (0, 0), (-1, -1), 1, GRID),     # Thinner border
    ]))
    
    # Combine in compact table structure
    header_data = [[agent_info_para, contact_table]]
    header_table = Table(header_data, colWidths=[320, 160])  # Adjusted proportions
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return header_table


def _create_invoice_meta(invoice_number, invoice_date, agent_invoice_number=None):
    """Create compact right-aligned meta box with invoice number and date."""
    styles = _create_styles()
    
    formatted_date = fmt_date(invoice_date)
    
    # Compact style for meta labels and values
    meta_style = ParagraphStyle(
        'CompactMeta',
        parent=styles['small'],
        fontSize=8,
        leading=10,
        textColor=BLACK
    )
    
    meta_data = [
        [Paragraph("<b>Invoice Date:</b>", meta_style), Paragraph(formatted_date, meta_style)]
    ]
    
    # Add Invoice Number if provided (agent's own invoice number)
    if agent_invoice_number is not None:
        meta_data.insert(0, [
            Paragraph("<b>Invoice Number:</b>", meta_style), 
            Paragraph(str(agent_invoice_number), meta_style)
        ])
    
    # Add internal reference
    meta_data.append([
        Paragraph("<b>V3 Ref:</b>", meta_style), 
        Paragraph(invoice_number, meta_style)
    ])
    
    meta_table = Table(meta_data, colWidths=[80, 90])  # Smaller proportions
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, DARK),     # Thinner border
        ('GRID', (0, 0), (-1, -1), 0.5, GRID), # Internal grid lines
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),   # Less padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),  # Less padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),    # Less padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Less padding
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),     # Left align values
    ]))
    
    # Right-align the meta table with compact spacing
    container_data = [["", meta_table]]
    container_table = Table(container_data, colWidths=[310, 170])  # Adjusted
    container_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return container_table


def _create_bill_to_section():
    """Create compact BILL TO section for V3 Services Ltd."""
    styles = _create_styles()
    
    # Compact section title
    title_style = ParagraphStyle(
        'CompactSectionTitle',
        parent=styles['h2'],
        fontSize=10,  # Smaller
        textColor=DARK,
        fontName='Helvetica-Bold',
        spaceAfter=4,  # Less space
    )
    title = Paragraph("BILL TO:", title_style)
    
    # Compact V3 Services information
    company_style = ParagraphStyle(
        'CompactCompanyInfo',
        parent=styles['body'],
        fontSize=9,   # Smaller font
        leading=11,   # Tighter line spacing
        textColor=BLACK
    )
    
    v3_info = [
        [Paragraph("<b>V3 SERVICES LTD</b><br/>117 Dartford Road<br/>Dartford, England<br/>DA1 3EN", company_style)]
    ]
    
    v3_table = Table(v3_info, colWidths=[300])  # Narrower
    v3_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, DARK),     # Thinner border
        ('LEFTPADDING', (0, 0), (-1, -1), 8),   # Less padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),  # Less padding
        ('TOPPADDING', (0, 0), (-1, -1), 6),    # Less padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6), # Less padding
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    return [title, Spacer(1, 4), v3_table]  # Reduced spacing


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
    
    # Compact section title
    title_style = ParagraphStyle(
        'CompactSectionTitle',
        parent=styles['h2'],
        fontSize=10,  # Smaller
        textColor=DARK,
        fontName='Helvetica-Bold',
        spaceAfter=4,  # Less space
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
    
    # Create compact subheading with JOB ADDRESS; job type will be in table
    story_items = [title, Spacer(1, 4)]  # Reduced spacing
    if job_address:
        service_style = ParagraphStyle(
            'CompactServiceDesc',
            parent=styles['body'],
            fontSize=9,   # Smaller
            fontName='Helvetica-Bold',
            textColor=PRIMARY,  # Use V3 orange color
            spaceAfter=2  # Less space
        )
        service_desc = Paragraph(f"{job_address}", service_style)
        story_items.extend([service_desc, Spacer(1, 4)])  # Reduced spacing
        current_app.logger.info(f"PDF: Added address subheading: '{job_address}'")
    
    # Compact table headers
    header_style = ParagraphStyle(
        'CompactHeader',
        parent=styles['small'],
        fontSize=8,  # Smaller
        fontName='Helvetica-Bold',
        textColor=WHITE,
        leading=10
    )
    
    headers = [
        Paragraph("Date", header_style),
        Paragraph("Job Type", header_style),
        Paragraph("Hours", header_style), 
        Paragraph("Rate (£)", header_style),
        Paragraph("Amount (£)", header_style)
    ]
    
    # Table data - use invoice data if available
    table_data = [headers]
    
    if jobs:
        # For one job per invoice we may still have multiple line items (first hour vs remaining)
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
        
        # Determine job type for table column
        job_type = service or ''
        if not job_type and isinstance(first_job, dict) and first_job.get('service'):
            job_type = first_job.get('service') or ''
        if not job_type:
            job_type = "Service"
        
        # Create rows for each line item (supports split first hour)
        row_style = ParagraphStyle(
            'CompactRow',
            parent=styles['small'],
            fontSize=8,
            leading=10,
            textColor=BLACK
        )

        for line in jobs:
            # Use the same date for each line
            line_hours = fmt_hours(line.get('hours', 0))
            line_rate = fmt_money(line.get('rate', 0))
            line_amount = fmt_money(line.get('amount', 0))
            current_app.logger.info(f"PDF: Row - Date: '{job_date}', JobType: '{job_type}', Hours: '{line_hours}', Rate: '{line_rate}', Amount: '{line_amount}'")
            table_data.append([
                Paragraph(job_date, row_style),
                Paragraph(job_type, row_style),
                Paragraph(line_hours, row_style),
                Paragraph(line_rate, row_style),
                Paragraph(line_amount, row_style)
            ])
    
    # Create compact table with optimized column widths: Date(70), Job Type(flexible), Hours(50), Rate(65), Amount(75)
    services_table = Table(table_data, colWidths=[70, None, 50, 65, 75], repeatRows=1)
    
    # Compact table styling with professional appearance
    table_style = [
        # Compact header styling
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),       # Smaller header font
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),   # Center header text
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),  # Less padding
        ('TOPPADDING', (0, 0), (-1, 0), 4),     # Less padding
        
        # Compact data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),      # Smaller font
        ('TOPPADDING', (0, 1), (-1, -1), 3),    # Less padding
        ('BOTTOMPADDING', (0, 1), (-1, -1), 3), # Less padding
        ('LEFTPADDING', (0, 0), (-1, -1), 4),   # Less padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),  # Less padding
        
        # Column-specific alignment
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),   # Date column centered
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),     # Job Type column left
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),   # Hours column centered
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),    # Rate column right
        ('ALIGN', (4, 1), (4, -1), 'RIGHT'),    # Amount column right
        
        # Professional but compact borders
        ('BOX', (0, 0), (-1, -1), 1.5, DARK),   # Thinner outer border
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, DARK), # Header bottom border
        ('GRID', (0, 1), (-1, -1), 0.5, GRID),  # Internal grid - thin
        
        # Alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, HexColor('#F8F9FA')]),
        
        # Compact vertical alignment
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),  # Vertical center alignment
    ]
    
    services_table.setStyle(TableStyle(table_style))
    story_items.append(services_table)
    
    return story_items


def _create_totals_section(totals):
    """Create compact right-aligned totals box."""
    styles = _create_styles()
    
    subtotal = totals.get('subtotal', totals.get('total', 0))
    vat = totals.get('vat', 0)
    total = totals.get('total', 0)
    
    # Compact styles for totals
    total_label_style = ParagraphStyle(
        'CompactTotalLabel',
        parent=styles['body'],
        fontSize=9,   # Smaller
        fontName='Helvetica-Bold',
        textColor=DARK
    )
    
    final_total_style = ParagraphStyle(
        'CompactFinalTotal',
        parent=styles['body'],
        fontSize=10,  # Slightly smaller
        fontName='Helvetica-Bold',
        textColor=PRIMARY  # Use V3 orange for emphasis
    )
    
    totals_data = [
        [Paragraph("Subtotal:", total_label_style), Paragraph(fmt_money(subtotal), total_label_style)],
        [Paragraph("VAT (0%):", total_label_style), Paragraph(fmt_money(vat), total_label_style)],
        [Paragraph("TOTAL:", final_total_style), Paragraph(fmt_money(total), final_total_style)]
    ]
    
    totals_table = Table(totals_data, colWidths=[80, 80])  # Smaller proportions
    totals_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, DARK),  # Thinner border
        ('BACKGROUND', (0, 0), (-1, -2), LIGHT_BG),  # Light background for subtotal/VAT
        ('BACKGROUND', (0, -1), (-1, -1), HexColor('#FFF3E0')),  # Orange tint for total
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),   # Less padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),  # Less padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),    # Less padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Less padding
        # Emphasize total row
        ('LINEABOVE', (0, -1), (-1, -1), 2, DARK),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Internal lines
        ('GRID', (0, 0), (-1, -2), 0.5, GRID),  # Thin internal lines
    ]))
    
    # Right-align the totals table with compact proportions
    container_data = [["", totals_table]]
    container_table = Table(container_data, colWidths=[320, 160])
    container_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return container_table


def _create_payment_details(agent):
    """Create compact payment details panel."""
    styles = _create_styles()
    
    # Compact section title
    title_style = ParagraphStyle(
        'CompactSectionTitle',
        parent=styles['h2'],
        fontSize=10,  # Smaller
        textColor=DARK,
        fontName='Helvetica-Bold',
        spaceAfter=4,  # Less space
    )
    title = Paragraph("PAYMENT DETAILS:", title_style)
    
    # Compact payment details - combine into single paragraph
    payment_style = ParagraphStyle(
        'CompactPayment',
        parent=styles['body'],
        fontSize=8,   # Smaller font
        leading=10,   # Tight line spacing
        textColor=BLACK,
        leftIndent=0,
        rightIndent=0
    )
    
    agent_name = f"{_safe_str(agent.first_name)} {_safe_str(agent.last_name)}".strip() or "Not provided"
    
    payment_info = (f"<b>Payment Method:</b> BACS Transfer Only<br/>"
                   f"<b>Account Name:</b> {agent_name}<br/>"
                   f"<b>Bank Name:</b> {_safe_str(agent.bank_name)}<br/>"
                   f"<b>Account Number:</b> {_safe_str(agent.bank_account_number)}<br/>"
                   f"<b>Sort Code:</b> {_safe_str(agent.bank_sort_code)}<br/>"
                   f"<b>UTR Number:</b> {_safe_str(agent.utr_number)}")
    
    payment_para = Paragraph(payment_info, payment_style)
    
    payment_table = Table([[payment_para]], colWidths=[350])  # Single column
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, DARK),     # Thinner border
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),   # Less padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),  # Less padding
        ('TOPPADDING', (0, 0), (-1, -1), 6),    # Less padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6), # Less padding
    ]))
    
    # Compact tax statement
    tax_statement_style = ParagraphStyle(
        'CompactTaxStatement',
        parent=styles['body'],
        fontSize=7,   # Even smaller
        leading=9,    # Very tight
        textColor=MUTED,
        leftIndent=0,
        rightIndent=0
    )
    
    tax_text = ("I confirm that I am responsible for any Tax or National Insurance "
                "due on all invoices that I have submitted to V3 Services Ltd.")
    
    tax_statement = Paragraph(tax_text, tax_statement_style)
    
    # Create compact tax statement container
    tax_container = Table([[tax_statement]], colWidths=[480])
    tax_container.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F8F9FA')),
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),   # Less padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),  # Less padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),    # Less padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Less padding
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    return [title, Spacer(1, 4), payment_table, Spacer(1, 6), tax_container]  # Reduced spacing


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
    """Create a compact key-value row for tables."""
    styles = _create_styles()
    
    # Compact label style
    label_style = ParagraphStyle(
        'CompactKeyLabel',
        parent=styles['small_caps'],
        fontSize=8,   # Smaller
        fontName='Helvetica-Bold',
        textColor=DARK,
        spaceAfter=1  # Less space
    )
    
    # Compact value style
    value_style = ParagraphStyle(
        'CompactKeyValue',
        parent=styles['small'],
        fontSize=8,   # Smaller
        textColor=BLACK,
        spaceAfter=1  # Less space
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