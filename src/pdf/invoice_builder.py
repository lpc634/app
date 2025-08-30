"""
V3 Services Ltd — Agent Portal
Invoice PDF Builder (ReportLab)
— Cleaner layout, job address as section title, Description = job type only —
"""

from datetime import datetime, date
from decimal import Decimal

from reportlab.lib.colors import HexColor, white
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
INK_DARK  = HexColor("#232930")
INK_MID   = HexColor("#5E6A74")
INK_FADE  = HexColor("#8FA1AE")
PAPER     = white
FILL_SOFT = HexColor("#F6F8FA")
GRID      = HexColor("#E2E8EE")
ROW_ALT   = HexColor("#F9FAFB")
TOTAL_BG  = HexColor("#E85D1F")   # orange
TOTAL_TXT = white

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
              description, job_type, and optional 'job' object with .address and .job_type
        totals: dict with 'subtotal', 'vat', 'total'
        invoice_number: V3 ref (e.g., 'INV-202508-0002')
        invoice_date: date|datetime|str
        agent_invoice_number: agent's own invoice number (int/str), optional
        invoice: optional obj with .address, .job_type, .issue_date
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

    # Resolve job info once (type + address) for section title and rows
    job_type_default, job_address = _resolve_job_info(jobs, invoice)

    story = []
    story.append(_header_band())
    story.append(Spacer(1, 6*mm))
    story.append(_top_meta_row(agent, invoice_date, invoice_number, agent_invoice_number))
    story.append(Spacer(1, 6*mm))

    # SECTION TITLE = JOB ADDRESS (fallback to "SERVICES PROVIDED" if missing)
    section_title = job_address if job_address else "SERVICES PROVIDED"
    story.append(_section_title(section_title))
    story.extend(_services_table(jobs, job_type_default))
    story.append(Spacer(1, 6*mm))

    story.append(_totals_box(totals))
    story.append(Spacer(1, 8*mm))

    story.append(_section_title("PAYMENT DETAILS"))
    story.extend(_payment_panel(agent))
    story.append(Spacer(1, 3*mm))
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
            "h2", fontName="Helvetica-Bold", fontSize=11, textColor=INK_DARK,
            leading=15, spaceBefore=0, spaceAfter=4
        ),
        "kv_label": ParagraphStyle(
            "kv_label", fontName="Helvetica-Bold", fontSize=9, textColor=INK_MID, leading=12
        ),
        "kv_value": ParagraphStyle(
            "kv_value", fontName="Helvetica", fontSize=9.2, textColor=INK_DARK, leading=12
        ),
        "small": ParagraphStyle(
            "small", fontName="Helvetica", fontSize=8.8, textColor=INK_DARK, leading=11
        ),
        "muted": ParagraphStyle(
            "muted", fontName="Helvetica", fontSize=8, textColor=INK_FADE, leading=10
        ),
        "th": ParagraphStyle(
            "th", fontName="Helvetica-Bold", fontSize=8.8, textColor=PAPER, leading=11
        ),
        "td": ParagraphStyle(
            "td", fontName="Helvetica", fontSize=8.8, textColor=INK_DARK, leading=11
        ),
        "money_bold": ParagraphStyle(
            "money_bold", fontName="Helvetica-Bold", fontSize=10.2, textColor=INK_DARK, leading=12
        ),
        "total_emph": ParagraphStyle(
            "total_emph", fontName="Helvetica-Bold", fontSize=10.2, textColor=TOTAL_TXT, leading=12
        ),
    }

def _header_band():
    s = _styles()
    return _stack([
        Paragraph("INVOICE", s["title"]),
        Spacer(1, 2*mm),
        HRFlowable(width="100%", thickness=1.4, color=V3_ORANGE, spaceBefore=0, spaceAfter=0),
    ])

def _top_meta_row(agent, invoice_date, invoice_number, agent_invoice_number):
    s = _styles()

    # FROM (Agent)
    agent_name = f"{_safe(agent.first_name)} {_safe(agent.last_name)}".strip() or "Agent"
    from_block = _boxed([
        Paragraph("<b>FROM</b>", s["kv_label"]),
        Spacer(1, 1*mm),
        Paragraph(agent_name, s["kv_value"]),
        Paragraph(_join_lines([
            _safe(agent.address_line_1),
            _safe(agent.address_line_2),
            _safe(agent.city),
            _safe(agent.postcode)
        ]), s["small"]),
        Spacer(1, 1.2*mm),
        Paragraph(f"<b>Email:</b> {_safe(agent.email)}", s["small"]),
        Paragraph(f"<b>Phone:</b> {_safe(agent.phone)}", s["small"]),
        Paragraph(f"<b>UTR:</b> {_safe(agent.utr_number)}", s["small"]),
    ], col_width=72*mm)

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
    meta_rows.append([Paragraph("Invoice Date", s["kv_label"]), Paragraph(_fmt_date(invoice_date), s["kv_value"])])
    # V3 Ref: AgentName-YYMM-AgentInvoiceNumber (or fallback to system ref)
    try:
        name_slug = f"{_safe(agent.first_name)}-{_safe(agent.last_name)}".replace(" ", "-").strip("-")
        dt = _coerce_date(invoice_date)
        yymm = dt.strftime("%y%m") if dt else datetime.utcnow().strftime("%y%m")
        agent_ref = f"{str(agent_invoice_number)}" if agent_invoice_number not in [None, ""] else None
        v3_ref_display = f"{name_slug}-{yymm}-{agent_ref}" if agent_ref else str(invoice_number)
    except Exception:
        v3_ref_display = str(invoice_number)
    meta_rows.append([Paragraph("V3 Ref", s["kv_label"]), Paragraph(v3_ref_display, s["kv_value"])])

    meta = Table(meta_rows, colWidths=[32*mm, 36*mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), FILL_SOFT),
        ("BOX",        (0,0), (-1,-1), 0.9, GRID),
        ("INNERGRID",  (0,0), (-1,-1), 0.5, GRID),
        ("LEFTPADDING",(0,0), (-1,-1), 5),
        ("RIGHTPADDING",(0,0),(-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
    ]))

    row = Table([[from_block, to_block, meta]], colWidths=[72*mm, 60*mm, None])
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
    # Title pill with subtle underline
    band = Table([[Paragraph(text, s["h2"])]], colWidths=[None])
    band.setStyle(TableStyle([
        ("LINEBELOW", (0,0), (-1,0), 1.0, GRID),
        ("BOTTOMPADDING",(0,0), (-1,-1), 2),
    ]))
    return band

def _services_table(jobs, job_type_default):
    """
    Columns: Date | Description (job type only) | Hours | Rate (£) | Amount (£)
    The section title already shows the job address.
    """
    s = _styles()
    
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
            # Date: prefer explicit date/arrival_time
            dt = line.get("date") or line.get("arrival_time")
            date_txt = _fmt_date(dt)

            # job type only for Description
            desc = (line.get("job_type") or job_type_default or line.get("description") or "Service")

            rows.append([
                Paragraph(date_txt, s["td"]),
                Paragraph(desc, s["td"]),
                Paragraph(_fmt_hours(line.get("hours", 0)), s["td"]),
                Paragraph(_fmt_money(line.get("rate", 0)), s["td"]),
                Paragraph(_fmt_money(line.get("amount", 0)), s["td"]),
            ])

    tbl = Table(rows, colWidths=[28*mm, None, 22*mm, 25*mm, 28*mm], repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0,0), (-1,0), INK_DARK),
        ("TEXTCOLOR",  (0,0), (-1,0), PAPER),
        ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
        ("ALIGN",      (0,0), (-1,0), "CENTER"),
        ("BOTTOMPADDING", (0,0), (-1,0), 5),
        ("TOPPADDING",    (0,0), (-1,0), 5),

        # Body
        ("GRID",     (0,0), (-1,-1), 0.45, GRID),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [PAPER, ROW_ALT]),
        ("VALIGN",   (0,1), (-1,-1), "MIDDLE"),
        ("FONTNAME", (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE", (0,1), (-1,-1), 8.8),

        # Alignment
        ("ALIGN", (0,1), (0,-1), "CENTER"),
        ("ALIGN", (2,1), (2,-1), "CENTER"),
        ("ALIGN", (3,1), (3,-1), "RIGHT"),
        ("ALIGN", (4,1), (4,-1), "RIGHT"),

        # Padding
        ("LEFTPADDING",  (0,1), (-1,-1), 6),
        ("RIGHTPADDING", (0,1), (-1,-1), 6),
        ("TOPPADDING",   (0,1), (-1,-1), 3),
        ("BOTTOMPADDING",(0,1), (-1,-1), 3),
    ]))
    return [tbl]

def _totals_box(totals):
    s = _styles()
    subtotal = totals.get("subtotal", totals.get("total", 0))
    vat      = totals.get("vat", 0)
    total    = totals.get("total", 0)

    # Two-row card: (Subtotal, VAT) + highlighted TOTAL
    top = Table([
        [Paragraph("Subtotal", s["kv_label"]), Paragraph(_fmt_money(subtotal), s["kv_value"])],
        [Paragraph("VAT (0%)", s["kv_label"]), Paragraph(_fmt_money(vat), s["kv_value"])],
    ], colWidths=[35*mm, 35*mm])
    top.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), FILL_SOFT),
        ("BOX",        (0,0), (-1,-1), 0.9, GRID),
        ("INNERGRID",  (0,0), (-1,-1), 0.5, GRID),
        ("LEFTPADDING",(0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0),(-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("ALIGN",      (1,0), (1,-1), "RIGHT"),
    ]))

    bottom = Table([
        [Paragraph("TOTAL", s["total_emph"]), Paragraph(_fmt_money(total), s["total_emph"])]
    ], colWidths=[35*mm, 35*mm])
    bottom.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), TOTAL_BG),
        ("BOX",        (0,0), (-1,-1), 0.9, TOTAL_BG),
        ("LEFTPADDING",(0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0),(-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ("ALIGN",      (1,0), (1,-1), "RIGHT"),
    ]))

    stack = Table([[top],[bottom]], colWidths=[70*mm])
    stack.setStyle(TableStyle([
        ("LEFTPADDING",(0,0), (-1,-1), 0),
        ("RIGHTPADDING",(0,0),(-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 0),
    ]))

    container = Table([["", stack]], colWidths=[None, 72*mm])
    container.setStyle(TableStyle([
        ("LEFTPADDING",(0,0), (-1,-1), 0),
        ("RIGHTPADDING",(0,0),(-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0),(-1,-1), 0),
    ]))
    return container

def _payment_panel(agent):
    s = _styles()
    name = f"{_safe(agent.first_name)} {_safe(agent.last_name)}".strip() or "Not provided"

    info = [
        Paragraph("<b>Payment Method:</b> BACS Transfer Only", s["small"]),
        Paragraph(f"<b>Account Name:</b> {name}", s["small"]),
        Paragraph(f"<b>Bank Name:</b> {_safe(agent.bank_name)}", s["small"]),
        Paragraph(f"<b>Account Number:</b> {_safe(agent.bank_account_number)}", s["small"]),
        Paragraph(f"<b>Sort Code:</b> {_safe(agent.bank_sort_code)}", s["small"]),
        Paragraph(f"<b>UTR Number:</b> {_safe(agent.utr_number)}", s["small"]),
    ]
    panel = _boxed(info, shaded=True)
    return [panel]

def _tax_statement():
    s = _styles()
    txt = ("I confirm that I am responsible for any Tax or National Insurance "
           "due on all invoices that I have submitted to V3 Services Ltd.")
    # Render disclaimer in solid black for print legibility
    black_style = ParagraphStyle(
        "disclaimer_black",
        parent=s["small"],
        textColor=HexColor("#000000"),
    )
    box = Table([[Paragraph(txt, black_style)]], colWidths=[None])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), HexColor("#F1F5F9")),
        ("BOX",        (0,0), (-1,-1), 0.8, GRID),
        ("LEFTPADDING",(0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0),(-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ]))
    return box

def _boxed(flowables, col_width=None, shaded=False):
    bg = FILL_SOFT if shaded else PAPER
    t = Table([[_stack(flowables)]], colWidths=[col_width or None])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("BOX",        (0,0), (-1,-1), 0.9, GRID),
        ("LEFTPADDING",(0,0), (-1,-1), 7),
        ("RIGHTPADDING",(0,0),(-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0),(-1,-1), 7),
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


# ===== Helpers =====
def _resolve_job_info(jobs, invoice):
    """Return (job_type, job_address) from invoice or jobs[0].job / row fields."""
    job_type = getattr(invoice, "job_type", "") if invoice else ""
    job_address = getattr(invoice, "address", "") if invoice else ""

    if (not job_type or not job_address) and jobs:
        first = jobs[0]
        # Row-level hints
        job_type = job_type or first.get("job_type") or ""
        # Embedded job object
        job_obj = first.get("job")
        if job_obj:
            job_type = job_type or getattr(job_obj, "job_type", "") or ""
            job_address = job_address or getattr(job_obj, "address", "") or ""

        # Fallback: parse address from any row with 'address'
        if not job_address:
            for ln in jobs:
                if ln.get("address"):
                    job_address = ln["address"]
                    break

    return (job_type, job_address)

def _fmt_date(dt):
    """Return DD/MM/YYYY (UK), robust parsing."""
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

def _fmt_money(x):
    try:
        if x is None: return "£0.00"
        if isinstance(x, Decimal): x = float(x)
        if isinstance(x, str): x = float(x)
        return f"£{x:,.2f}"
    except Exception:
        return "£0.00"

def _fmt_hours(x):
    try:
        if x is None: return "0.0h"
        if isinstance(x, Decimal): x = float(x)
        if isinstance(x, str): x = float(x)
        return f"{x:.1f}h"
    except Exception:
        return "0.0h"

def _safe(val):
    if val is None: return "Not provided"
    txt = str(val).strip()
    return txt if txt else "Not provided"
def _join_lines(lines):
    return "<br/>".join([l for l in lines if l and l != "Not provided"])


# ===== (Optional) utility kept for parity =====
class ConditionalPageBreak(Flowable):
    """Only breaks page if there isn't enough room left."""
    def __init__(self, min_space):
        super().__init__()
        self.min_space = min_space
    def wrap(self, availWidth, availHeight):
        return (0, availHeight if availHeight < self.min_space else 0)
    def draw(self):  # no-op
        pass
