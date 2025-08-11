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


def build_invoice_pdf(file_path, agent, jobs, totals, invoice_number, invoice_date):
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
    # Create document with A4 page size and 36pt margins
    doc = BaseDocTemplate(
        file_path,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    # Define frame for main content
    frame = Frame(
        36, 36, A4[0] - 72, A4[1] - 72,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    
    # Create page template with custom footer
    template = PageTemplate(
        id='normal',
        frames=frame,
        onPage=lambda canvas, doc: _draw_footer(canvas, doc)
    )
    doc.addPageTemplates([template])
    
    # Build story (content flowables)
    story = []
    
    # Title
    story.append(_create_title())
    story.append(Spacer(1, 12))
    
    # Header with agent info and contact panel
    story.append(_create_header(agent))
    story.append(Spacer(1, 16))
    
    # Invoice meta (number and date)
    story.append(_create_invoice_meta(invoice_number, invoice_date))
    story.append(Spacer(1, 20))
    
    # Bill To section
    bill_to_items = _create_bill_to_section()
    story.extend(bill_to_items)
    story.append(Spacer(1, 20))
    
    # Services table
    services_items = _create_services_section(jobs)
    story.extend(services_items)
    story.append(Spacer(1, 16))
    
    # Totals
    story.append(_create_totals_section(totals))
    story.append(Spacer(1, 20))
    
    # Check space for payment details - if less than 120pt, add page break
    story.append(_conditional_page_break(120))
    
    # Payment Details with tax statement
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
    
    contact_table = Table(contact_data, colWidths=[60, 120])
    contact_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
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


def _create_invoice_meta(invoice_number, invoice_date):
    """Create right-aligned meta box with invoice number and date."""
    styles = _create_styles()
    
    formatted_date = fmt_date(invoice_date)
    
    meta_data = [
        [Paragraph("<b>Invoice Number:</b>", styles['small_caps']), Paragraph(invoice_number, styles['body'])],
        [Paragraph("<b>Invoice Date:</b>", styles['small_caps']), Paragraph(formatted_date, styles['body'])]
    ]
    
    meta_table = Table(meta_data, colWidths=[100, 100])
    meta_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
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
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    
    return [title, Spacer(1, 8), v3_table]


def _create_services_section(jobs):
    """Create services table with proper formatting and pagination."""
    styles = _create_styles()
    
    # Section title
    title = Paragraph("SERVICES PROVIDED:", styles['h2'])
    
    if not jobs:
        # Handle empty jobs case
        no_jobs = Paragraph("No services recorded", styles['body'])
        return [title, Spacer(1, 8), no_jobs]
    
    # Table headers
    headers = [
        Paragraph("<b>Date</b>", styles['small']),
        Paragraph("<b>Address</b>", styles['small']),
        Paragraph("<b>Hours</b>", styles['small']), 
        Paragraph("<b>Rate</b>", styles['small']),
        Paragraph("<b>Amount</b>", styles['small'])
    ]
    
    # Table data
    table_data = [headers]
    
    for i, job in enumerate(jobs):
        # Format job data
        job_date = fmt_date(job.get('date') or job.get('arrival_time'))
        job_address = _safe_str(job.get('address', 'Address not provided'))
        job_hours = fmt_hours(job.get('hours', 0))
        job_rate = fmt_money(job.get('rate', 0))
        job_amount = fmt_money(job.get('amount', 0))
        
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
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        
        # Data rows
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        
        # Amount column right-aligned
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        
        # Grid lines
        ('GRID', (0, 0), (-1, -1), 0.5, GRID),
        
        # Zebra striping for data rows (very light)
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, HexColor('#FAFBFC')])
    ]
    
    services_table.setStyle(TableStyle(table_style))
    
    return [title, Spacer(1, 8), services_table]


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
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
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
    
    # Add tax responsibility statement
    tax_label = Paragraph("<b>Tax Responsibility Statement:</b>", 
                         ParagraphStyle('TaxLabel', parent=styles['body'], 
                                       fontName='Helvetica-Bold', fontSize=11, 
                                       spaceAfter=4, textColor=DARK))
    
    tax_statement = Paragraph(
        "I confirm that I am responsible for any Tax or National Insurance "
        "due on all invoices that I have submitted to V3 Services Ltd.",
        ParagraphStyle('TaxStatement', parent=styles['body'], 
                      fontSize=10, leading=13, spaceAfter=6)
    )
    
    # Add tax statement as a spanning row
    payment_rows.append([tax_label, ""])
    payment_rows.append([tax_statement, ""])
    
    payment_table = Table(payment_rows, colWidths=[120, 240])
    payment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        # Span tax statement across both columns
        ('SPAN', (0, -2), (1, -2)),  # Tax label spans both columns
        ('SPAN', (0, -1), (1, -1)),  # Tax statement spans both columns
    ]))
    
    return [title, Spacer(1, 8), payment_table]


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