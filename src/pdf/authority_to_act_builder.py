"""
V3 Services Ltd — Admin Portal
Authority to Act PDF Builder (ReportLab)
— The client's submitted instruction form, laid out section by section as the form shows it —
"""

import base64
import io
import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from xml.sax.saxutils import escape, quoteattr
from zoneinfo import ZoneInfo

from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Table, TableStyle, Spacer, Image, Flowable, HRFlowable, KeepTogether
)

from .invoice_builder import V3_ORANGE, INK_DARK, INK_MID, INK_FADE, PAPER, FILL_SOFT, GRID

LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'static', 'v3-logo.png')

COMPANY_LINE = (
    "V3 Services Limited · Registered in England No. 10653477 · "
    "Registered Office: 117 Dartford Road, Dartford DA1 3EN · VAT No. 269833460 · ICO: ZA485365"
)

# ===== Wording, as the client saw it on the form =====
PROPERTY_TYPES = {
    'open': 'Open Land',
    'commercial': 'Commercial Unit',
    'retail': 'Business / Retail Park',
    'other': 'Other',
}
AUTHORITY_ROLES = {
    'owner': 'The legal owner of the property',
    'agent': 'An authorised agent/representative of the owner',
}
SUPPORTING_DOCS = [
    ('docsLandRegistry', 'Land Registry Title'),
    ('docsLease', 'Lease Agreement'),
    ('docsManagement', 'Management Contract'),
    ('docsOther', 'Other'),
]
SITE_QUESTIONS = [
    ('premisesOccupied', 'Premises occupied?'),
    ('sitePlanAvailable', 'Site plan available?'),
    ('photosAvailable', 'Photos available?'),
    ('dogsOnSite', 'Dogs on site?'),
    ('livestockOnSite', 'Livestock on site?'),
]
SECURITY_QUESTIONS = [
    ('haveSecurity', 'Do you have security on site?'),
    ('wantSecurityQuote', 'Would you like a quote for security?'),
    ('wantWasteQuote', 'Post eviction, would you like a quote for fly-tipping / waste removal?'),
]
OWNERSHIP_NOTICE = (
    "The Client must provide proof of ownership or legal authority before V3 Services Ltd will "
    "commence any eviction services. The property must be clearly shown on a printed map, with its "
    "boundaries marked, and that map must be attached to this instruction form."
)
UNDERTAKING = "I undertake to advise V3 Services Ltd if there is a change in the number of trespassers."
TERMS = (
    "I confirm that I have received, read, understood and accept the 'Schedule of Charges' and "
    "'Terms &amp; Conditions'. I hereby instruct V3 Services Ltd and/or their nominated agent(s) to proceed."
)

# Every key the layout below places (or deliberately leaves out); anything else
# a future version of the form sends is listed under "Additional Information".
LAID_OUT = {
    'client_name', 'client_email', 'client_phone', 'property_address',
    'firstName', 'lastName', 'company', 'email', 'phone', 'clientAddress',
    'siteAddress', 'location_lat', 'location_lng', 'maps_link', 'propertyType', 'propertyTypeOther',
    'premisesOccupied', 'sitePlanAvailable', 'photosAvailable', 'trespassDescription',
    'tents', 'vehicles', 'persons', 'dogsOnSite', 'livestockOnSite', 'changeUndertaking',
    'haveSecurity', 'wantSecurityQuote', 'wantWasteQuote',
    'authorityRole', 'docsLandRegistry', 'docsLease', 'docsManagement', 'docsOther',
    'attachments', 'attachmentsNotUploaded',
    'acceptTerms', 'sigTitle', 'sigFirst', 'sigLast', 'signatureDataUrl', 'signatureDate',
    'invoiceCompany', 'invoiceAddress', 'accountsTitle', 'accountsFirst', 'accountsLast',
    'accountsEmail', 'accountsPhone', 'vatNumber', 'poNumber',
}


# ===== Public API =====
def build_authority_to_act_pdf(file_obj, data, form_type=None, submitted_at=None, reference=None):
    """
    Build the Authority to Act PDF for one submission.

    Args:
        file_obj: output path or file-like object
        data: the submitted form (AuthorityToActToken.submission_data)
        form_type: e.g. 'authority-to-act-squatter-eviction'
        submitted_at: naive UTC datetime of the submission
        reference: submission id, shown in the footer
    """
    data = data or {}
    s = _styles()

    doc = BaseDocTemplate(
        file_obj,
        pagesize=A4,
        leftMargin=16*mm,
        rightMargin=16*mm,
        topMargin=14*mm,
        bottomMargin=22*mm,
        title="Authority to Act",
        author="V3 Services Ltd",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin, doc.width, doc.height,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0
    )
    doc.addPageTemplates([
        PageTemplate(id="authority", frames=[frame], onPage=lambda canvas, d: _draw_footer(canvas, d, reference))
    ])
    w = doc.width

    client_name = data.get('client_name') or _join_words(data.get('firstName'), data.get('lastName'))
    site_address = _address(data.get('siteAddress')) or data.get('property_address')

    story = []
    story.extend(_header(_form_name(form_type), s, w))
    story.append(Spacer(1, 5*mm))
    story.append(_summary(client_name, data.get('company'), site_address, submitted_at, s, w))

    story.extend(_section("Client Details", [
        _field_row([("Name", client_name), ("Company", data.get('company'))], s, w),
        _field_row([("Email", data.get('email') or data.get('client_email')),
                    ("Phone", data.get('phone') or data.get('client_phone'))], s, w),
        _field_row([("Client address", _address(data.get('clientAddress')))], s, w),
    ], s))

    story.extend(_section("Site Details", [
        _field_row([("Site address", site_address)], s, w),
        _field_row([("Property type", _property_type(data)),
                    ("Location of site entrance", _entrance(data))], s, w, markup=True),
        _field_row([("Number of tents/shelters", data.get('tents')),
                    ("Number of motor vehicles", data.get('vehicles')),
                    ("Number of persons", data.get('persons'))], s, w),
        *_long_field("Description of trespass", data.get('trespassDescription'), s),
        _yes_no_rows(SITE_QUESTIONS, data, s, w),
        Spacer(1, 3*mm),
        _statement(UNDERTAKING, data.get('changeUndertaking'), s, w),
    ], s))

    story.extend(_section("Site Security and Waste Removal", [
        _yes_no_rows(SECURITY_QUESTIONS, data, s, w),
    ], s))

    docs = [label for key, label in SUPPORTING_DOCS if data.get(key)]
    story.extend(_section("Ownership / Authority Declaration", [
        Paragraph(OWNERSHIP_NOTICE, s["muted"]),
        _field_row([("I confirm that I am", AUTHORITY_ROLES.get(data.get('authorityRole'), data.get('authorityRole')))], s, w),
        _field_row([("Supporting documentation", ', '.join(docs) or 'None indicated')], s, w),
        *_attachment_rows(data, s, w),
        Spacer(1, 3*mm),
        _statement(TERMS, data.get('acceptTerms'), s, w),
        Spacer(1, 4*mm),
        _signature_block(data, s, w),
    ], s))

    story.extend(_section("Invoicing Details", [
        _field_row([("Company / name (for invoicing)", data.get('invoiceCompany'))], s, w),
        _field_row([("Invoice address", _address(data.get('invoiceAddress')))], s, w),
        _field_row([("Accounts contact", _join_words(data.get('accountsTitle'), data.get('accountsFirst'), data.get('accountsLast'))),
                    ("Accounts email address", data.get('accountsEmail')),
                    ("Accounts contact number", data.get('accountsPhone'))], s, w),
        _field_row([("VAT registration number", data.get('vatNumber')),
                    ("Purchase order number", data.get('poNumber'))], s, w),
    ], s))

    extra = [(key, value) for key, value in data.items()
             if key not in LAID_OUT and value not in (None, '', {}, [])]
    if extra:
        story.extend(_section("Additional Information", [
            piece for key, value in extra for piece in _long_field(_label_from_key(key), _plain(value), s)
        ], s))

    doc.build(story)


# ===== Layout pieces =====

def _styles():
    return {
        "title": ParagraphStyle(
            "title", fontName="Helvetica-Bold", fontSize=20, textColor=INK_DARK,
            alignment=TA_RIGHT, leading=24
        ),
        "subtitle": ParagraphStyle(
            "subtitle", fontName="Helvetica-Bold", fontSize=10.5, textColor=V3_ORANGE,
            alignment=TA_RIGHT, leading=14
        ),
        "h2": ParagraphStyle(
            "h2", fontName="Helvetica-Bold", fontSize=10.5, textColor=INK_DARK, leading=14
        ),
        "label": ParagraphStyle(
            "label", fontName="Helvetica-Bold", fontSize=7, textColor=INK_MID, leading=10
        ),
        "value": ParagraphStyle(
            "value", fontName="Helvetica", fontSize=10, textColor=INK_DARK, leading=13.5
        ),
        "answer": ParagraphStyle(
            "answer", fontName="Helvetica-Bold", fontSize=10, textColor=INK_DARK,
            alignment=TA_RIGHT, leading=13.5
        ),
        "small": ParagraphStyle(
            "small", fontName="Helvetica", fontSize=9, textColor=INK_DARK, leading=12.5
        ),
        "muted": ParagraphStyle(
            "muted", fontName="Helvetica", fontSize=8.5, textColor=INK_MID, leading=12, spaceAfter=3
        ),
    }


def _header(form_name, s, width):
    title = [
        Paragraph("AUTHORITY TO ACT", s["title"]),
        Paragraph(f"Client Instruction Form — {form_name}", s["subtitle"]),
    ]
    logo = _logo_png()
    logo_cell = Image(io.BytesIO(logo), width=30*mm, height=22*mm, kind='proportional', hAlign='LEFT') if logo else ''
    row = Table([[logo_cell, title]], colWidths=[36*mm, width - 36*mm])
    row.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ]))
    return [
        row,
        Spacer(1, 3*mm),
        HRFlowable(width="100%", thickness=1.4, color=V3_ORANGE, spaceBefore=0, spaceAfter=0),
    ]


def _summary(client_name, company, site_address, submitted_at, s, width):
    """The three facts someone filing this needs first: who, where, when."""
    client = "<br/>".join(_text(line) for line in (client_name, company) if line)
    band = Table([[
        _field("Client", client, s, markup=True),
        _field("Site", site_address, s),
        _field("Submitted", _fmt_submitted(submitted_at), s),
    ]], colWidths=[width * 0.30, width * 0.42, width * 0.28])
    band.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), FILL_SOFT),
        ("BOX",           (0,0), (-1,-1), 0.9, GRID),
        ("INNERGRID",     (0,0), (-1,-1), 0.5, GRID),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
        ("RIGHTPADDING",  (0,0), (-1,-1), 7),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return band


def _section(title, flowables, s):
    """Section title plus its content; the title is kept with the first row so it is never stranded at a page foot."""
    head = Table([[Paragraph(title.upper(), s["h2"])]], colWidths=["*"])
    head.setStyle(TableStyle([
        ("LINEBELOW",     (0,0), (-1,0), 1.0, V3_ORANGE),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    return [Spacer(1, 6*mm), KeepTogether([head, Spacer(1, 1.5*mm), flowables[0]])] + flowables[1:]


def _field(label, value, s, markup=False):
    """A form field: small label above its value. `markup` means the value is already Paragraph markup."""
    if value in (None, ''):
        shown = "—"
    else:
        shown = value if markup else _text(value)
    return [Paragraph(escape(label.upper()), s["label"]), Paragraph(shown, s["value"])]


def _field_row(pairs, s, width, markup=False):
    """One row of fields in equal columns, ruled off underneath."""
    row = Table([[_field(label, value, s, markup) for label, value in pairs]],
                colWidths=[width / len(pairs)] * len(pairs))
    row.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("LINEBELOW",     (0,0), (-1,-1), 0.5, GRID),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    return row


def _long_field(label, value, s):
    """A field whose answer may run to several pages: plain paragraphs, which can split, then the rule."""
    return [
        Spacer(1, 4),
        Paragraph(escape(label.upper()), s["label"]),
        Paragraph(_text(value) if value not in (None, '') else "—", s["value"]),
        HRFlowable(width="100%", thickness=0.5, color=GRID, spaceBefore=5, spaceAfter=0),
    ]


def _attachment_rows(data, s, width):
    """Names of the files sent with the form, and of any the client's browser failed to send."""
    attached = [item.get('name') for item in data.get('attachments') or []
                if isinstance(item, dict) and item.get('key')]
    rows = [_field_row([("Files attached", ', '.join(str(name) for name in attached) or 'None')], s, width)]
    failed = data.get('attachmentsNotUploaded')
    if isinstance(failed, list) and failed:
        rows.append(_field_row([("Files the client could not upload", ', '.join(str(name) for name in failed))], s, width))
    return rows


def _yes_no_rows(questions, data, s, width):
    rows = [[Paragraph(question, s["value"]), Paragraph("Yes" if data.get(key) else "No", s["answer"])]
            for key, question in questions]
    table = Table(rows, colWidths=[width - 20*mm, 20*mm])
    table.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("LINEBELOW",     (0,0), (-1,-1), 0.5, GRID),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    return table


def _statement(text, ticked, s, width):
    """A declaration the client ticked (or left unticked) on the form."""
    box = Table([[_TickBox(ticked), Paragraph(text, s["small"])]],
                colWidths=[8*mm, width - 8*mm])
    box.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), FILL_SOFT),
        ("BOX",           (0,0), (-1,-1), 0.9, GRID),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0), (-1,-1), 7),
        ("RIGHTPADDING",  (0,0), (-1,-1), 7),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    return box


class _TickBox(Flowable):
    """A checkbox as the client left it. Drawn rather than typed, so it looks the same in every PDF viewer."""
    size = 3.6*mm

    def __init__(self, ticked):
        super().__init__()
        self.ticked = bool(ticked)

    def wrap(self, availWidth, availHeight):
        return (self.size, self.size)

    def draw(self):
        c, size = self.canv, self.size
        c.setLineWidth(0.8)
        if not self.ticked:
            c.setStrokeColor(INK_MID)
            c.roundRect(0, 0, size, size, 0.6*mm, stroke=1, fill=0)
            return
        c.setStrokeColor(V3_ORANGE)
        c.setFillColor(V3_ORANGE)
        c.roundRect(0, 0, size, size, 0.6*mm, stroke=1, fill=1)
        c.setStrokeColor(PAPER)
        c.setLineWidth(1.3)
        c.setLineCap(1)
        c.setLineJoin(1)
        tick = c.beginPath()
        tick.moveTo(size * 0.22, size * 0.52)
        tick.lineTo(size * 0.43, size * 0.28)
        tick.lineTo(size * 0.79, size * 0.74)
        c.drawPath(tick, stroke=1, fill=0)


def _signature_block(data, s, width):
    signature = _signature_image(data.get('signatureDataUrl'))
    pad = Table([[signature or Paragraph("No signature captured", s["muted"])]],
                colWidths=[86*mm], rowHeights=[30*mm])
    pad.setStyle(TableStyle([
        ("BOX",           (0,0), (-1,-1), 0.9, GRID),
        ("BACKGROUND",    (0,0), (-1,-1), PAPER),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
    ]))
    signed_by = _join_words(data.get('sigTitle'), data.get('sigFirst'), data.get('sigLast'))
    details = [
        _field_row([("Signed by", signed_by)], s, width - 92*mm),
        _field_row([("Date of signature", _fmt_date(data.get('signatureDate')))], s, width - 92*mm),
    ]
    block = Table([[[Paragraph("SIGNATURE", s["label"]), Spacer(1, 1*mm), pad], details]],
                  colWidths=[92*mm, width - 92*mm])
    block.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ]))
    return KeepTogether([block])


def _draw_footer(canvas, doc, reference):
    canvas.saveState()
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 16*mm, doc.leftMargin + doc.width, 16*mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(INK_FADE)
    left = "V3 Services Ltd — Authority to Act"
    if reference is not None:
        left += f" · Ref {reference}"
    canvas.drawString(doc.leftMargin, 12*mm, left)
    canvas.drawRightString(doc.leftMargin + doc.width, 12*mm, f"Page {canvas.getPageNumber()}")
    canvas.setFont("Helvetica", 6.5)
    canvas.drawCentredString(doc.leftMargin + doc.width / 2, 8*mm, COMPANY_LINE)
    canvas.restoreState()


# ===== Images =====

@lru_cache(maxsize=1)
def _logo_png():
    """The logo file is a 2500px original; shrink it once so each PDF stays small."""
    try:
        from PIL import Image as PILImage
        logo = PILImage.open(LOGO_PATH).convert('RGBA')
        logo.thumbnail((480, 480))
        flat = PILImage.new('RGB', logo.size, 'white')
        flat.paste(logo, mask=logo.getchannel('A'))
        png = io.BytesIO()
        flat.save(png, format='PNG')
        return png.getvalue()
    except Exception:
        return None


def _signature_image(data_url):
    """Turn the form's signature (a PNG data URL) into an image for the PDF.

    The signature pad draws near-white strokes on a transparent canvas, which
    would be invisible on paper, so the strokes are re-inked black on white.
    """
    if not data_url:
        return None
    try:
        from PIL import Image as PILImage
        drawn = PILImage.open(io.BytesIO(base64.b64decode(data_url.split(',', 1)[1]))).convert('RGBA')
        inked = PILImage.new('RGB', drawn.size, 'white')
        inked.paste(PILImage.new('RGB', drawn.size, 'black'), mask=drawn.getchannel('A'))
        png = io.BytesIO()
        inked.save(png, format='PNG')
        png.seek(0)
        return Image(png, width=80*mm, height=26*mm, kind='proportional')
    except Exception:
        return None


# ===== Helpers =====

def _text(value):
    """A submitted value as safe Paragraph markup."""
    return escape(_plain(value)).replace('\n', '<br/>')


def _plain(value):
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, dict):
        return _address(value) or ', '.join(str(v) for v in value.values() if v)
    return str(value).strip()


def _address(value):
    if not isinstance(value, dict):
        return value or ''
    parts = [str(value.get(key) or '').strip() for key in ('line1', 'line2', 'city', 'region', 'postcode', 'country')]
    return ', '.join(part for part in parts if part)


def _join_words(*words):
    return ' '.join(str(word).strip() for word in words if word and str(word).strip())


def _form_name(form_type):
    return (form_type or '').replace('authority-to-act-', '').replace('-', ' ').title() or 'Squatter Eviction'


def _property_type(data):
    kind = data.get('propertyType')
    label = PROPERTY_TYPES.get(kind, kind)
    if kind == 'other' and data.get('propertyTypeOther'):
        label = f"Other — {data.get('propertyTypeOther')}"
    return _text(label) if label else None


def _entrance(data):
    """Pin dropped on the map for the site entrance, with a link when there is one."""
    lat, lng = data.get('location_lat'), data.get('location_lng')
    if lat is None or lng is None:
        return "Not marked"
    try:
        shown = f"{float(lat):.6f}, {float(lng):.6f}"
    except (TypeError, ValueError):
        shown = _text(f"{lat}, {lng}")
    link = str(data.get('maps_link') or '')
    if link.startswith('https://'):
        shown += f'<br/><a href={quoteattr(link)} color="#E85D1F">Open in Google Maps</a>'
    return shown


def _label_from_key(key):
    return re.sub(r'(?<=[a-z0-9])(?=[A-Z])', ' ', str(key)).replace('_', ' ').capitalize()


def _fmt_submitted(submitted_at):
    """Stored as naive UTC; shown in UK time."""
    if not submitted_at:
        return None
    try:
        local = submitted_at.replace(tzinfo=timezone.utc).astimezone(ZoneInfo('Europe/London'))
    except Exception:  # no time zone database available
        return f"{submitted_at.day} {submitted_at:%B %Y} at {submitted_at:%H:%M} UTC"
    return f"{local.day} {local:%B %Y} at {local:%H:%M}"


def _fmt_date(value):
    """The form's date input sends YYYY-MM-DD."""
    try:
        parsed = datetime.strptime(str(value), '%Y-%m-%d')
        return f"{parsed.day} {parsed:%B %Y}"
    except (TypeError, ValueError):
        return value
