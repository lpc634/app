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
    
    # Build story (content flowables) - optimized for single page
    story = []
    
    # Title
    story.append(_create_title())
    story.append(Spacer(1, 8))  # Reduced from 12
    
    # Header with agent info and contact panel
    story.append(_create_header(agent))
    story.append(Spacer(1, 10))  # Reduced from 16
    
    # Invoice meta (number and date)
    story.append(_create_invoice_meta(invoice_number, invoice_date, agent_invoice_number))
    story.append(Spacer(1, 12))  # Reduced from 20
    
    # Bill To section
    bill_to_items = _create_bill_to_section()
    story.extend(bill_to_items)
    story.append(Spacer(1, 12))  # Reduced from 20
    
    # Services table - use snapshotted invoice data if available
    services_items = _create_services_section(jobs, invoice)
    story.extend(services_items)
    story.append(Spacer(1, 10))  # Reduced from 16
    
    # Totals
    story.append(_create_totals_section(totals))
    story.append(Spacer(1, 12))  # Reduced from 20
    
    # Payment Details with tax statement (no page break check - keep on same page)
    payment_items = _create_payment_details(agent)
    story.extend(payment_items)
    
    # Add tax statement flowable after payment details
    # Estimate payment table height (6 rows * 20 points + padding)
    payment_table_height = 120
    tax_statement = TaxStatementFlowable(payment_table_height)
    story.append(tax_statement)
    
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
    """Create the main INVOICE title."""
    styles = _create_styles()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['h1'],
        fontSize=24,
        textColor=PRIMARY,
        spaceAfter=0
    )
    return Paragraph("INVOICE", title_style)


def _create_header(agent):
    """Create header with agent details on left and contact panel on right."""
    styles = _create_styles()
    
    # Agent name and address (left side)
    agent_name = f"{_safe_str(agent.first_name)} {_safe_str(agent.last_name)}".strip()
    if not agent_name:
        agent_name = "Agent"
    
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
        
    agent_address = "<br/>".join(agent_address_lines)
    
    agent_info = f"<b>{agent_name}</b><br/>{agent_address}"
    agent_para = Paragraph(agent_info, styles['body'])
    
    # Contact panel (right side) - light background table
    contact_data = [
        [Paragraph("<b>Email:</b>", styles['small_caps']), Paragraph(_safe_str(agent.email), styles['small'])],
        [Paragraph("<b>Phone:</b>", styles['small_caps']), Paragraph(_safe_str(agent.phone), styles['small'])],
        [Paragraph("<b>UTR:</b>", styles['small_caps']), Paragraph(_safe_str(agent.utr_number), styles['small'])]
    ]
    
    contact_table = Table(contact_data, colWidths=[50, 110])  # Reduced widths
    contact_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),  # Reduced padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),  # Reduced padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),   # Reduced padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Reduced padding
        ('BOX', (0, 0), (-1, -1), 1, GRID)
    ]))
    
    # Combine in a table structure
    header_data = [[agent_para, contact_table]]
    header_table = Table(header_data, colWidths=[300, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return header_table


def _create_invoice_meta(invoice_number, invoice_date, agent_invoice_number=None):
    """Create right-aligned meta box with invoice number and date."""
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
    
    meta_table = Table(meta_data, colWidths=[90, 90])  # Reduced widths
    meta_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),  # Reduced padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 6), # Reduced padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),   # Reduced padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Reduced padding
    ]))
    
    # Right-align the meta table
    container_data = [["", meta_table]]
    container_table = Table(container_data, colWidths=[280, 200])
    container_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return container_table


def _create_bill_to_section():
    """Create the fixed BILL TO section for V3 Services Ltd."""
    styles = _create_styles()
    
    # Section title
    title = Paragraph("BILL TO:", styles['h2'])
    
    # Fixed V3 Services information
    v3_info = [
        [Paragraph("<b>V3 SERVICES LTD</b><br/>117 Dartford Road<br/>Dartford, England<br/>DA1 3EN", styles['body'])]
    ]
    
    v3_table = Table(v3_info, colWidths=[300])
    v3_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),   # Reduced padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),  # Reduced padding
        ('TOPPADDING', (0, 0), (-1, -1), 6),    # Reduced padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6), # Reduced padding
    ]))
    
    return [title, Spacer(1, 6), v3_table]  # Reduced spacing


def _create_services_section(jobs, invoice=None):
    """Create services table with proper formatting and pagination."""
    from flask import current_app
    styles = _create_styles()
    
    # DEBUG: Log the actual data structure we receive
    current_app.logger.error(f"PDF DEBUG: jobs data structure: {jobs}")
    current_app.logger.error(f"PDF DEBUG: invoice data: {invoice}")
    if jobs:
        current_app.logger.error(f"PDF DEBUG: first job: {jobs[0]}")
    
    # Section title
    title = Paragraph("SERVICES PROVIDED:", styles['h2'])
    
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
    if not service and not job_address:
        no_jobs = Paragraph("No services recorded", styles['body'])
        current_app.logger.info("PDF: Showing 'No services recorded' because both service and address are empty")
        return [title, Spacer(1, 8), no_jobs]
    
    # Create service description subheading if service exists
    story_items = [title, Spacer(1, 6)]  # Reduced spacing
    if service:
        service_desc = Paragraph(f"<b>{service}</b>", styles['body'])
        story_items.extend([service_desc, Spacer(1, 4)])  # Reduced spacing
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
    
    # Create table with column widths: Date(70), Address(flex), Hours(60), Rate(70), Amount(85)
    services_table = Table(table_data, colWidths=[70, None, 60, 70, 85], repeatRows=1)
    
    # Table styling with zebra striping
    table_style = [
        # Header styling
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 5),  # Reduced padding
        ('TOPPADDING', (0, 0), (-1, 0), 5),     # Reduced padding
        
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 4),    # Reduced padding
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4), # Reduced padding
        ('LEFTPADDING', (0, 0), (-1, -1), 6),   # Reduced padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),  # Reduced padding
        
        # Amount column right-aligned
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        
        # Grid lines
        ('GRID', (0, 0), (-1, -1), 0.5, GRID),
        
        # Zebra striping for data rows (very light)
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, HexColor('#FAFBFC')])
    ]
    
    services_table.setStyle(TableStyle(table_style))
    story_items.append(services_table)
    
    return story_items


def _create_totals_section(totals):
    """Create right-aligned totals box."""
    styles = _create_styles()
    
    subtotal = totals.get('subtotal', totals.get('total', 0))
    vat = totals.get('vat', 0)
    total = totals.get('total', 0)
    
    totals_data = [
        [Paragraph("Subtotal:", styles['body']), Paragraph(fmt_money(subtotal), styles['body'])],
        [Paragraph("VAT (0%):", styles['body']), Paragraph(fmt_money(vat), styles['body'])],
        [Paragraph("<b>TOTAL:</b>", styles['body']), Paragraph(f"<b>{fmt_money(total)}</b>", styles['body'])]
    ]
    
    totals_table = Table(totals_data, colWidths=[80, 80])
    totals_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),   # Reduced padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),  # Reduced padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),    # Reduced padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Reduced padding
        # Emphasize total row
        ('LINEABOVE', (0, -1), (-1, -1), 2, DARK),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor('#E8F4FD'))
    ]))
    
    # Right-align the totals table
    container_data = [["", totals_table]]
    container_table = Table(container_data, colWidths=[320, 160])
    container_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return container_table


def _create_payment_details(agent):
    """Create payment details panel with tax statement."""
    styles = _create_styles()
    
    # Section title
    title = Paragraph("PAYMENT DETAILS:", styles['h2'])
    
    # Payment details data
    payment_rows = [
        kv_row("Payment Method:", "BACS Transfer Only"),
        kv_row("Account Name:", f"{_safe_str(agent.first_name)} {_safe_str(agent.last_name)}".strip() or "Not provided"),
        kv_row("Bank Name:", _safe_str(agent.bank_name)),
        kv_row("Account Number:", _safe_str(agent.bank_account_number)),
        kv_row("Sort Code:", _safe_str(agent.bank_sort_code)),
        kv_row("UTR Number:", _safe_str(agent.utr_number))
    ]
    
    # Tax statement will be drawn inside the payment box using canvas drawing
    
    payment_table = Table(payment_rows, colWidths=[120, 240])
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),   # Reduced padding
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),  # Reduced padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),    # Reduced padding
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4), # Reduced padding
    ]))
    
    # Create a container that includes the payment table
    # The tax statement will be drawn inside the payment box using canvas drawing
    container_data = [["", payment_table]]
    container_table = Table(container_data, colWidths=[320, 160])
    container_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    return [title, Spacer(1, 6), container_table]  # Reduced spacing


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
    """Create a key-value row for tables."""
    styles = _create_styles()
    
    label_para = Paragraph(f"<b>{label}</b>", styles['small_caps'])
    value_para = Paragraph(_safe_str(value), styles['small'])
    
    return [label_para, value_para]


def _safe_str(value):
    """Safely convert value to string, handling None values."""
    if value is None:
        return "Not provided"
    
    str_value = str(value).strip()
    return str_value if str_value else "Not provided"