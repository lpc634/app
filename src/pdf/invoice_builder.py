"""
V3 Services Ltd - Agent Portal
Professional Invoice PDF Builder (ReportLab Platypus)
- Clean corporate layout, preserved fields, UK formats, no Flask dependency -
"""

from datetime import datetime, date
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Table, TableStyle, Spacer, Flowable, HRFlowable
)

# ===== Branding / colours =====
V3_ORANGE = HexColor("#E85D1F")
INK_DARK  = HexColor("#263238")
INK_MID   = HexColor("#607D8B")
INK_FADE  = HexColor("#8FA1AE")
PAPER     = colors.white
FILL_SOFT = HexColor("#F3F5F7")
GRID      = HexColor("#DDE3E8")

# ===== Public API (signature unchanged) =====
def build_invoice_pdf(
    file_path,
    agent,
    jobs,
    totals,
    invoice_number,
    invoice_date,
    agent_invoice_number=None,
    invoice=None
):
    """
    Build a professional single-page invoice PDF.

    Args:
        file_path: output path
        agent: obj with first_name,last_name,address_line_1,address_line_2,city,postcode,
               email, phone, utr_number, bank_name, bank_account_number, bank_sort_code
        jobs: list of dicts. Each may contain: date, arrival_time, hours, rate, amount,
              description, and optional 'job' object with .address and .job_type
        totals: dict with 'subtotal', 'vat', 'total'
        invoice_number: V3 ref (e.g., 'INV-202508-0002')
        invoice_date: date|datetime|str
        agent_invoice_number: agent's own invoice number (int/str), optional
        invoice: optional obj with .address, .job_type, .issue_date

    Side Effects:
        Creates a PDF invoice file at the specified file_path.
    """
    doc = BaseDocTemplate(
        file_path,
        pagesize=A4,
        leftMargin=14*mm,
        rightMargin=14*mm,
        topMargin=14*mm,
        bottomMargin=16*mm,
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin, doc.width, doc.height,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    doc.addPageTemplates([
        PageTemplate(id="invoice", frames=[frame], onPage=_draw_footer)
    ])

    story = []
    story.append(_header_band())
    story.append(Spacer(1, 5*mm))
    story.append(_top_meta_row(agent, invoice_date, invoice_number, agent_invoice_number))
    story.append(Spacer(1, 5*mm))

    story.append(_section_title("SERVICES PROVIDED"))
    story.extend(_services_table(jobs, invoice))
    story.append(Spacer(1, 4*mm))

    story.append(_totals_box(totals))
    story.append(Spacer(1, 6*mm))

    story.append(_section_title("PAYMENT DETAILS"))
    story.extend(_payment_panel(agent))
    story.append(Spacer(1, 2*mm))
    story.append(_tax_statement())

    doc.build(story)


# ===== Layout pieces =====
def _styles():
    return {
        "title": ParagraphStyle(
            "title", fontName="Helvetica-Bold", fontSize=22, textColor=V3_ORANGE,
            alignment=TA_CENTER, leading=26
        ),
        "h2": ParagraphStyle(
            "h2", fontName="Helvetica-Bold", fontSize=10.5, textColor=INK_DARK,
            leading=14, spaceBefore=0, spaceAfter=3
        ),
        "kv_label": ParagraphStyle(
            "kv_label", fontName="Helvetica-Bold", fontSize=8.5, textColor=INK_MID, leading=11
        ),
        "kv_value": ParagraphStyle(
            "kv_value", fontName="Helvetica", fontSize=9, textColor=INK_DARK, leading=12
        ),
        "small": ParagraphStyle(
            "small", fontName="Helvetica", fontSize=8.5, textColor=INK_DARK, leading=11
        ),
        "muted": ParagraphStyle(
            "muted", fontName="Helvetica", fontSize=8, textColor=INK_FADE, leading=10
        ),
        "th": ParagraphStyle(
            "th", fontName="Helvetica-Bold", fontSize=8.5, textColor=PAPER, leading=11
        ),
        "td": ParagraphStyle(
            "td", fontName="Helvetica", fontSize=8.5, textColor=INK_DARK, leading=11
        ),
        "money_bold": ParagraphStyle(
            "money_bold", fontName="Helvetica-Bold", fontSize=10, textColor=V3_ORANGE, leading=12
        ),
    }

def _header_band():
    s = _styles()
    return _stack([
        Paragraph("INVOICE", s["title"]),
        Spacer(1, 2*mm),
        HRFlowable(width="100%", thickness=1.2, color=V3_ORANGE, spaceBefore=0, spaceAfter=0),
    ])

def _top_meta_row(agent, invoice_date, invoice_number, agent_invoice_number):
    s = _styles()

    # FROM (Agent)
    agent_name = f"{_s(agent.first_name)} {_s(agent.last_name)}".strip() or "Agent"
    from_block = _boxed([
        Paragraph("<b>FROM</b>", s["kv_label"]),
        Spacer(1, 1*mm),
        Paragraph(agent_name, s["kv_value"]),
        Paragraph(_join_lines([
            _s(agent.address_line_1),
            _s(agent.address_line_2),
            _s(agent.city),
            _s(agent.postcode)
        ]), s["small"]),
        Spacer(1, 1.2*mm),
        Paragraph(f"<b>Email:</b> {_s(agent.email)}", s["small"]),
        Paragraph(f"<b>Phone:</b> {_s(agent.phone)}", s["small"]),
        Paragraph(f"<b>UTR:</b> {_s(agent.utr_number)}", s["small"]),
    ], col_width=70*mm)

    # BILL TO (V3)
    to_block = _boxed([
        Paragraph("<b>BILL TO</b>", s["kv_label"]),
        Spacer(1, 1*mm),
        Paragraph("V3 SERVICES LTD", s["kv_value"]),
        Paragraph("117 Dartford Road<br/>Dartford, England<br/>DA1 3EN", s["small"]),
    ], col_width=60*mm)

    # META
    meta_rows = []
    if agent_invoice_number is not None:
        meta_rows.append([Paragraph("Invoice Number", s["kv_label"]), Paragraph(str(agent_invoice_number), s["kv_value"])])
    meta_rows.append([Paragraph("Invoice Date", s["kv_label"]), Paragraph(fmt_date(invoice_date), s["kv_value"])])
    meta_rows.append([Paragraph("V3 Ref", s["kv_label"]), Paragraph(str(invoice_number), s["kv_value"])])

    meta = Table(meta_rows, colWidths=[30*mm, 35*mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), FILL_SOFT),
        ("BOX",        (0,0), (-1,-1), 0.8, GRID),
        ("INNERGRID",  (0,0), (-1,-1), 0.5, GRID),
        ("LEFTPADDING",(0,0), (-1,-1), 4),
        ("RIGHTPADDING",(0,0),(-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
    ]))

    row = Table([[from_block, to_block, meta]], colWidths=[70*mm, 60*mm, None])
    row.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",(0,0), (-1,-1), 0),
        ("RIGHTPADDING",(0,0), (-1,-1), 0),
        ("TOPPADDING",(0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0), (-1,-1), 0),
    ]))
    return row

def _section_title(text):
    s = _styles()
    return Paragraph(text, s["h2"])

def _services_table(jobs, invoice):
    """
    Columns: Date | Description | Hours | Rate (£) | Amount (£)
    Description prefers per-row 'description'. If missing, uses
    'job_type — address' from invoice or jobs[0].job.
    """
    s = _styles()

    # Resolve job_type & address fallbacks
    job_type = getattr(invoice, "job_type", "") if invoice else ""
    job_address = getattr(invoice, "address", "") if invoice else ""

    if (not job_type or not job_address) and jobs:
        first = jobs[0]
        if isinstance(first, dict) and first.get("job"):
            job_type = job_type or getattr(first["job"], "job_type", "") or ""
            job_address = job_address or getattr(first["job"], "address", "") or ""

    headers = [
        Paragraph("Date", s["th"]),
        Paragraph("Description", s["th"]),
        Paragraph("Hours", s["th"]),
        Paragraph("Rate (£)", s["th"]),
        Paragraph("Amount (£)", s["th"]),
    ]
    rows = [headers]

    if jobs:
        for line in jobs:
            # Date fallback: line.date or line.arrival_time or invoice.issue_date
            dt = line.get("date") or line.get("arrival_time")
            if not dt and invoice and hasattr(invoice, "issue_date"):
                dt = getattr(invoice, "issue_date")
            date_txt = fmt_date(dt)

            # Description: prefer explicit line description
            desc = line.get("description") or (job_type or "Service")
            if desc and job_address:
                desc = f"{desc} — {job_address}"

            rows.append([
                Paragraph(date_txt, s["td"]),
                Paragraph(desc or "Not provided", s["td"]),
                Paragraph(fmt_hours(line.get("hours", 0)), s["td"]),
                Paragraph(fmt_money(line.get("rate", 0)), s["td"]),
                Paragraph(fmt_money(line.get("amount", 0)), s["td"]),
            ])

    tbl = Table(rows, colWidths=[28*mm, None, 22*mm, 25*mm, 28*mm], repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0,0), (-1,0), INK_DARK),
        ("TEXTCOLOR",  (0,0), (-1,0), PAPER),
        ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
        ("ALIGN",      (0,0), (-1,0), "CENTER"),
        ("BOTTOMPADDING", (0,0), (-1,0), 4),
        ("TOPPADDING",    (0,0), (-1,0), 4),

        # Body
        ("FONTNAME", (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE", (0,1), (-1,-1), 8.5),
        ("GRID",     (0,0), (-1,-1), 0.4, GRID),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [PAPER, HexColor("#F7F8FA")]),
        ("VALIGN",   (0,1), (-1,-1), "MIDDLE"),

        # Alignment
        ("ALIGN", (0,1), (0,-1), "CENTER"),
        ("ALIGN", (2,1), (2,-1), "CENTER"),
        ("ALIGN", (3,1), (3,-1), "RIGHT"),
        ("ALIGN", (4,1), (4,-1), "RIGHT"),

        # Padding
        ("LEFTPADDING",  (0,1), (-1,-1), 5),
        ("RIGHTPADDING", (0,1), (-1,-1), 5),
        ("TOPPADDING",   (0,1), (-1,-1), 2.5),
        ("BOTTOMPADDING",(0,1), (-1,-1), 2.5),
    ]))
    return [tbl]

def _totals_box(totals):
    s = _styles()
    subtotal = totals.get("subtotal", totals.get("total", 0))
    vat      = totals.get("vat", 0)
    total    = totals.get("total", 0)

    rows = [
        [Paragraph("Subtotal", s["kv_label"]), Paragraph(fmt_money(subtotal), s["kv_value"])],
        [Paragraph("VAT (0%)", s["kv_label"]), Paragraph(fmt_money(vat),      s["kv_value"])],
        [Paragraph("TOTAL",    s["kv_label"]), Paragraph(fmt_money(total),    s["money_bold"])],
    ]
    tbl = Table(rows, colWidths=[30*mm, 30*mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-2), FILL_SOFT),
        ("BACKGROUND", (0,-1), (-1,-1), HexColor("#FFF4EC")),
        ("BOX",        (0,0), (-1,-1), 1.0, INK_DARK),
        ("INNERGRID",  (0,0), (-1,-2), 0.5, GRID),
        ("ALIGN",      (1,0), (1,-1), "RIGHT"),
        ("LEFTPADDING",(0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0),(-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))

    container = Table([["", tbl]], colWidths=[None, 70*mm])
    container.setStyle(TableStyle([
        ("LEFTPADDING",(0,0), (-1,-1), 0),
        ("RIGHTPADDING",(0,0),(-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 0),
    ]))
    return container

def _payment_panel(agent):
    s = _styles()
    name = f"{_s(agent.first_name)} {_s(agent.last_name)}".strip() or "Not provided"

    info = [
        Paragraph("<b>Payment Method:</b> BACS Transfer Only", s["small"]),
        Paragraph(f"<b>Account Name:</b> {name}", s["small"]),
        Paragraph(f"<b>Bank Name:</b> {_s(agent.bank_name)}", s["small"]),
        Paragraph(f"<b>Account Number:</b> {_s(agent.bank_account_number)}", s["small"]),
        Paragraph(f"<b>Sort Code:</b> {_s(agent.bank_sort_code)}", s["small"]),
        Paragraph(f"<b>UTR Number:</b> {_s(agent.utr_number)}", s["small"]),
    ]
    panel = _boxed(info, shaded=True)
    return [panel]

def _tax_statement():
    s = _styles()
    txt = ("I confirm that I am responsible for any Tax or National Insurance "
           "due on all invoices that I have submitted to V3 Services Ltd.")
    box = Table([[Paragraph(txt, s["muted"])]], colWidths=[None])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), HexColor("#F8F9FA")),
        ("BOX",        (0,0), (-1,-1), 0.8, GRID),
        ("LEFTPADDING",(0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0),(-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))
    return box

def _boxed(flowables, col_width=None, shaded=False):
    """Reusable light card container."""
    bg = FILL_SOFT if shaded else PAPER
    t = Table([[_stack(flowables)]], colWidths=[col_width or None])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("BOX",        (0,0), (-1,-1), 0.8, GRID),
        ("LEFTPADDING",(0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0),(-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0),(-1,-1), 6),
    ]))
    return t

def _stack(items):
    return Table([[items]], colWidths=["*"], style=TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),0),
        ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0),
        ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))

def _draw_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 20*mm, doc.leftMargin + doc.width, 20*mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(INK_FADE)
    canvas.drawString(doc.leftMargin, 18*mm, "V3 Services Ltd — Agent Portal")
    canvas.drawRightString(doc.leftMargin + doc.width, 18*mm, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


# ===== Formatting and Utility Helper Functions =====
def fmt_date(dt):
    """Return DD/MM/YYYY (UK), with robust parsing."""
    if dt is None:
        return "Not provided"
    if isinstance(dt, datetime):
        dt = dt.date()
    if isinstance(dt, date):
        return dt.strftime("%d/%m/%Y")
    if isinstance(dt, str):
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"):
            try:
                return datetime.strptime(dt, fmt).strftime("%d/%m/%Y")
            except ValueError:
                continue
        return "Invalid date"
    return "Invalid date"

def fmt_money(x):
    try:
        if x is None: return "£0.00"
        if isinstance(x, Decimal): x = float(x)
        if isinstance(x, str): x = float(x)
        return f"£{x:,.2f}"
    except Exception:
        return "£0.00"

def fmt_hours(x):
    try:
        if x is None: return "0.0h"
        if isinstance(x, Decimal): x = float(x)
        if isinstance(x, str): x = float(x)
        return f"{x:.1f}h"
    except Exception:
        return "0.0h"

def _s(val):
    """Safe string with 'Not provided' fallback."""
    if val is None: return "Not provided"
    txt = str(val).strip()
    return txt if txt else "Not provided"
def _join_lines(lines):
    return "<br/>".join([l for l in lines if l and l != "Not provided"])


# ===== (Optional) utilities preserved for parity =====
class ConditionalPageBreak(Flowable):
    """Only breaks page if there isn't enough room left (kept for future multi-page needs)."""
    def __init__(self, min_space):
        super().__init__()
        self.min_space = min_space
    def wrap(self, availWidth, availHeight):
        return (0, availHeight if availHeight < self.min_space else 0)
    def draw(self):  # no-op
        pass
