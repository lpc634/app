"""
V3 Services Ltd — Admin Portal
Job Report PDF Builder (ReportLab)
— The report an agent files for a job, laid out for sending to the client —
"""

import io
import re
from datetime import datetime, timezone
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, NextPageTemplate,
    Paragraph, Table, TableStyle, Spacer, Image, HRFlowable, KeepTogether
)

from .house_style import (
    INK, SLATE, ORANGE, MID, RULE, PANEL, W, H, STRIP, FONT, SEMIBOLD, BOLD,
    COMPANY_NAME, COMPANY_CONTACT, COMPANY_LINE, accent_strip, logo_png, Tracked
)

MARGIN = 20 * mm
COLUMN = W - 2 * MARGIN
HEADER = 34 * mm               # depth of the first page's logo and company block, below the strip

REPORT_TITLES = {
    'traveller_eviction': 'Traveller Eviction Report',
    'traveller_serve': 'Traveller Serve Report',
    'squatter_serve': 'Squatter Serve Report',
    'squatter_eviction': 'Squatter Eviction Report',
    'abandoned_vehicle': 'Abandoned Vehicle Report',
}

# ===== What the five report forms send =====
# The forms name the same thing differently (postcode / postal_zip, cad_number / police_cad ...),
# so each list holds every spelling; a report only ever contains one of them.
SITE_FIELDS = [
    'what3words', 'prior_notice_served', 'notice_prior', 'property_type', 'commercial_property',
    'commercial_property_type', 'car_park_type', 'field_type', 'property_condition',
    'locked_in', 'lock_type', 'other_lock_details', 'fly_tipping', 'fly_tipping_details',
    'property_damage', 'damage_details', 'property_damage_details',
    'aggressive', 'travellers_agressive', 'aggression_details', 'dogs_on_site', 'dog_details',
    'caravans', 'num_caravans', 'num_vehicles', 'adult_males', 'num_males',
    'adult_females', 'num_females', 'children', 'num_children',
]
VEHICLE_FIELDS = [
    'vehicle_registration', 'vehicle_make', 'vehicle_model', 'vehicle_colour', 'vehicle_vin',
    'vehicle_location', 'police_contacted', 'height_barriers', 'recovery_truck_access', 'bodyworn_cctv',
]
POLICE_FIELDS = ['police_attendance', 'cad_number', 'police_cad', 'police_force', 'police_notes']
COMPLETION_FIELDS = ['departure_time', 'completion_date', 'additional_notes', 'report_notes']
JOB_FIELDS = ['client', 'address1', 'address2', 'city', 'postcode', 'postal_zip', 'date', 'arrival_time']

LABELS = {
    'what3words': 'what3words',
    'prior_notice_served': 'Prior notice served', 'notice_prior': 'Prior notice served',
    'property_type': 'Property type', 'commercial_property': 'Commercial property type',
    'commercial_property_type': 'Commercial property type', 'car_park_type': 'Car park type',
    'field_type': 'Land type', 'property_condition': 'Property condition',
    'lock_type': 'Lock type', 'other_lock_details': 'Lock details',
    'fly_tipping': 'Fly tipping', 'fly_tipping_details': 'Fly tipping details',
    'property_damage': 'Property damage', 'damage_details': 'Damage details',
    'property_damage_details': 'Damage details', 'aggression_details': 'Aggression details',
    'dogs_on_site': 'Dogs on site', 'dog_details': 'Dog details',
    'caravans': 'Caravans', 'num_caravans': 'Caravans', 'num_vehicles': 'Vehicles',
    'adult_males': 'Adult males', 'num_males': 'Adult males',
    'adult_females': 'Adult females', 'num_females': 'Adult females',
    'children': 'Children', 'num_children': 'Children',
    'vehicle_registration': 'Registration', 'vehicle_make': 'Make', 'vehicle_model': 'Model',
    'vehicle_colour': 'Colour', 'vehicle_vin': 'VIN', 'vehicle_location': 'Vehicle location',
    'police_contacted': 'Police contacted', 'height_barriers': 'Site has height barriers',
    'recovery_truck_access': 'Large recovery truck can gain access', 'bodyworn_cctv': 'Bodyworn CCTV used',
    'police_attendance': 'Police attendance', 'cad_number': 'CAD number', 'police_cad': 'CAD number',
    'police_force': 'Police force', 'police_notes': 'Police notes',
    'departure_time': 'Departure time', 'completion_date': 'Completion date',
    'additional_notes': 'Additional notes', 'report_notes': 'Report notes',
}

# Free-text answers get the full width; everything else sits in a three-column grid
LONG_FIELDS = re.compile(r'(_details|_notes|^vehicle_location)$')

# Switches the forms use to show or hide parts of themselves; not information about the job
FORM_SWITCHES = re.compile(
    r'^(more_than_10|need_more_entries|need_more_photos|photo_of_serve|extra_photos_\d+|p\d+'
    r'|day\d+(_enabled|_same_agents)?)$'
)


# ===== Public API =====
def build_report_pdf(file_obj, form_type, data, reference=None, submitted_by=None, submitted_at=None,
                     photos=None, photos_missing=0):
    """
    Build the PDF of a job report.

    Args:
        file_obj: output path or file-like object
        form_type: e.g. 'squatter_eviction' (V3JobReport.form_type)
        data: the submitted form (V3JobReport.report_data)
        reference: report id, shown under the title and in the footer
        submitted_by: name of the agent who filed the report
        submitted_at: naive UTC datetime of the submission
        photos: image files as bytes, in the order to show them
        photos_missing: how many photos could not be fetched, so the report says so
    """
    data = data or {}
    data = data.get('formData') if isinstance(data.get('formData'), dict) else data
    form_type = str(form_type or '').replace('-', '_')     # the forms save their slug, e.g. 'squatter-eviction'
    s = _styles()
    title = REPORT_TITLES.get(form_type) or f"{(form_type or 'Job').replace('_', ' ').title()} Report"
    used = set(JOB_FIELDS)

    doc = BaseDocTemplate(
        file_obj,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=STRIP + 11 * mm,
        bottomMargin=STRIP + 15 * mm,
        title=title,
        author=COMPANY_NAME,
    )

    def frame(top):
        return Frame(MARGIN, doc.bottomMargin, COLUMN, top - doc.bottomMargin,
                     leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)

    def furniture(canvas, _doc, first=False):
        _draw_page(canvas, title, reference, first)

    doc.addPageTemplates([
        PageTemplate(id="first", frames=[frame(H - STRIP - HEADER - 7 * mm)],
                     onPage=lambda c, d: furniture(c, d, first=True)),
        PageTemplate(id="later", frames=[frame(H - doc.topMargin)], onPage=furniture),
    ])

    story = [NextPageTemplate("later")]

    # ---- title and the facts a reader wants first ----
    kicker = "JOB REPORT" if reference is None else f"JOB REPORT  ·  REF {reference}"
    story.append(Tracked(kicker, SEMIBOLD, 9.5, 3.2, ORANGE, centre=True, space_after=3 * mm))
    story.append(Tracked(title.upper(), BOLD, 22, 0.5, SLATE, centre=True, space_after=7 * mm))
    story.append(_summary(data, submitted_by, submitted_at, s))

    # ---- who attended ----
    agents = _agents(data, used)
    if agents:
        story.extend(_section("Agents on Site", _grid(agents, s), s))

    # ---- the site ----
    people = 'Squatters' if 'squatter' in str(form_type) else 'Travellers' if 'traveller' in str(form_type) else 'Occupants'
    labels = dict(LABELS, locked_in=f'{people} locked in', aggressive=f'{people} aggressive',
                  travellers_agressive=f'{people} aggressive')
    site = _fields(data, SITE_FIELDS, labels, used, s)
    if site:
        story.extend(_section("Property Details" if 'squatter' in str(form_type) else "Site Details", site, s))

    vehicle = _fields(data, VEHICLE_FIELDS, labels, used, s)
    if vehicle:
        story.extend(_section("Vehicle Details", vehicle, s))

    # ---- what happened, day by day ----
    timeline = _timeline(data, used, s)
    if timeline:
        story.extend(_section("Timeline", timeline, s))

    police = _fields(data, POLICE_FIELDS, labels, used, s)
    if police:
        story.extend(_section("Police Details", police, s))

    completion = _fields(data, COMPLETION_FIELDS, labels, used, s)
    if completion:
        story.extend(_section("Completion", completion, s))

    # ---- anything a form sends that this layout does not know yet ----
    extra = [key for key in data if key not in used and not FORM_SWITCHES.match(key)]
    other = _fields(data, extra, labels, used, s)
    if other:
        story.extend(_section("Additional Details", other, s))

    # ---- photographs ----
    gallery, unreadable = _photos(photos or [])
    photos_missing += unreadable
    if gallery or photos_missing:
        count = len(photos or []) + photos_missing - unreadable
        body = gallery
        if photos_missing:
            body = body + [Paragraph(
                f"{photos_missing} photo{'s' if photos_missing != 1 else ''} could not be loaded into this "
                "document; see the online report.", s["muted"])]
        story.extend(_section(f"Photos & Evidence ({count})", body, s))

    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph(f"Report generated on {_fmt_moment(datetime.utcnow())}", s["generated"]))

    doc.build(story)


# ===== Layout pieces =====

def _styles():
    return {
        "label": ParagraphStyle("label", fontName=SEMIBOLD, fontSize=7, leading=10, textColor=MID),
        # above a block of free text: stays on the same page as the text's first lines
        "label_above": ParagraphStyle("label_above", fontName=SEMIBOLD, fontSize=7, leading=10, textColor=MID,
                                      keepWithNext=True),
        "value": ParagraphStyle("value", fontName=FONT, fontSize=10, leading=14.5, textColor=INK),
        "strong": ParagraphStyle("strong", fontName=SEMIBOLD, fontSize=10, leading=14.5, textColor=INK),
        "day": ParagraphStyle("day", fontName=SEMIBOLD, fontSize=9, leading=13, textColor=ORANGE,
                              spaceBefore=2, spaceAfter=3),
        "entry": ParagraphStyle("entry", fontName=FONT, fontSize=9.8, leading=14.5, textColor=INK,
                                leftIndent=17 * mm, bulletIndent=0, bulletFontName=SEMIBOLD,
                                bulletFontSize=9.8, bulletColor=ORANGE),
        "muted": ParagraphStyle("muted", fontName=FONT, fontSize=8.5, leading=12, textColor=MID),
        "generated": ParagraphStyle("generated", fontName=FONT, fontSize=7.5, leading=10, textColor=MID,
                                    alignment=TA_RIGHT),
        "company": ParagraphStyle("company", fontName=FONT, fontSize=8.3, leading=12, textColor=MID,
                                  alignment=TA_RIGHT),
    }


def _draw_page(c, title, reference, first):
    """Strips and footer on every page; the logo and company details at the top of the first."""
    accent_strip(c, H - STRIP)
    accent_strip(c, 0, flip=True)

    if first:
        top = H - STRIP - 8 * mm
        logo = logo_png()
        if logo:
            from reportlab.lib.utils import ImageReader
            c.drawImage(ImageReader(io.BytesIO(logo)), MARGIN, top - 21 * mm, width=30 * mm, height=21 * mm,
                        preserveAspectRatio=True, anchor='sw')
        c.setFillColor(SLATE)
        c.setFont(BOLD, 11.5)
        c.drawRightString(W - MARGIN, top - 4 * mm, COMPANY_NAME)
        c.setFillColor(MID)
        c.setFont(FONT, 8.3)
        for i, line in enumerate(COMPANY_CONTACT):
            c.drawRightString(W - MARGIN, top - 9 * mm - i * 4.1 * mm, line)
        c.setStrokeColor(SLATE)
        c.setLineWidth(1.3)
        c.line(MARGIN, H - STRIP - HEADER, W - MARGIN, H - STRIP - HEADER)

    c.setStrokeColor(RULE)
    c.setLineWidth(0.7)
    c.line(MARGIN, STRIP + 11 * mm, W - MARGIN, STRIP + 11 * mm)
    c.setFillColor(MID)
    c.setFont(FONT, 7.5)
    left = f"{COMPANY_NAME} — {title}"
    if reference is not None:
        left += f" · Ref {reference}"
    c.drawString(MARGIN, STRIP + 7 * mm, left)
    c.drawRightString(W - MARGIN, STRIP + 7 * mm, f"Page {c.getPageNumber()}")
    c.setFont(FONT, 5.9)
    c.drawCentredString(W / 2, STRIP + 3 * mm, COMPANY_LINE)


def _cell(label, value, s, style="value"):
    """A field: small label above its value."""
    shown = _text(value) if value not in (None, '') else "—"
    return [Paragraph(escape(label.upper()), s["label"]), Paragraph(shown, s[style])]


def _summary(data, submitted_by, submitted_at, s):
    """Client, site and timings in a panel under the title."""
    site = ', '.join(str(part).strip() for part in (
        data.get('address1'), data.get('address2'), data.get('city'),
        data.get('postcode') or data.get('postal_zip')) if part and str(part).strip())
    rows = [
        [_cell("Client", data.get('client'), s, "strong"), _cell("Date", _fmt_date(data.get('date')), s)],
        [_cell("Site address", site, s, "strong"), _cell("Arrival time", data.get('arrival_time'), s)],
        [_cell("Report by", submitted_by, s),
         _cell("Submitted", _fmt_moment(submitted_at) if submitted_at else None, s)],
    ]
    panel = Table(rows, colWidths=[COLUMN * 0.6, COLUMN * 0.4])
    panel.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), PANEL),
        ("LINEBEFORE",    (0, 0), (0, -1), 4, ORANGE, 0),   # 0 = square ends, flush with the panel
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6 * mm),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING",    (0, 0), (-1, -1), 3.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("TOPPADDING",    (0, 0), (-1, 0), 5 * mm),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 5 * mm),
    ]))
    return panel


def _section(title, flowables, s):
    """A ruled-off section; the heading stays with what follows it so it is never stranded at a page foot."""
    head = [
        Spacer(1, 6.5 * mm),
        HRFlowable(width="100%", thickness=0.7, color=RULE, spaceBefore=0, spaceAfter=5 * mm),
        Tracked(title.upper(), SEMIBOLD, 9.5, 1.3, SLATE, space_after=3.2 * mm),
    ]
    return [KeepTogether(head + flowables[:1])] + flowables[1:]


def _grid(pairs, s, columns=3):
    """Short fields, three to a row."""
    flowables = []
    for i in range(0, len(pairs), columns):
        row = [_cell(label, value, s) for label, value in pairs[i:i + columns]]
        row += [''] * (columns - len(row))
        table = Table([row], colWidths=[COLUMN / columns] * columns)
        table.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4 * mm),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.4 * mm),
        ]))
        flowables.append(table)
    return flowables


def _fields(data, keys, labels, used, s):
    """The answered fields among `keys`: short ones in the grid, free text at full width (it can run long)."""
    flowables, short = [], []
    for key in keys:
        if key in used or key not in data:
            continue
        used.add(key)
        value = data[key]
        if value is None or value == '' or value == {} or value == []:
            continue
        label = labels.get(key) or str(key).replace('_', ' ').capitalize()
        if 'date' in str(key):
            value = _fmt_date(value)
        if LONG_FIELDS.search(str(key)) or (isinstance(value, str) and len(value) > 70):
            flowables.extend(_grid(short, s))
            short = []
            flowables.append(Paragraph(escape(label.upper()), s["label_above"]))
            flowables.append(Paragraph(_text(value), s["value"]))
            flowables.append(Spacer(1, 3.4 * mm))
        else:
            short.append((label, value))
    return flowables + _grid(short, s)


def _agents(data, used):
    """Day-one agents. The forms name them agent_1.., lead_agent + a2.. / agent2.., or enforcement_manager."""
    agents = []
    for key, label in (('agent_1', 'Lead agent'), ('lead_agent', 'Lead agent'),
                       ('enforcement_manager', 'Enforcement manager')):
        used.add(key)
        if data.get(key):
            agents.append((label, data[key]))
    for n in range(2, 21):
        for key in (f'agent_{n}', f'a{n}', f'agent{n}'):
            used.add(key)
            if data.get(key):
                agents.append((f'Agent {n}', data[key]))
    return agents


def _timeline(data, used, s):
    """Each day's entries, with who attended when that changed from day one."""
    flowables = []
    for day in range(1, 8):
        entries = data.get(f'timeline_day{day}')
        used.add(f'timeline_day{day}')
        attending = []
        for key in [f'day{day}_lead_agent'] + [f'day{day}_a{n}' for n in range(2, 11)] + [f'day{day}_attending_agents']:
            used.add(key)
            if data.get(key):
                attending.append(str(data[key]).strip())
        entries = sorted((time, text) for time, text in (entries.items() if isinstance(entries, dict) else [])
                         if text and str(text).strip())
        if not entries:
            continue
        flowables.append(Paragraph(f"DAY {day}", s["day"]))
        if attending:
            flowables.append(Paragraph(f"Agents: {_text(', '.join(attending))}", s["muted"]))
            flowables.append(Spacer(1, 2 * mm))
        for time, text in entries:
            flowables.append(Paragraph(_entry_text(text), s["entry"], bulletText=str(time)))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=RULE, spaceBefore=2.4 * mm,
                                        spaceAfter=2.4 * mm))
        flowables.append(Spacer(1, 2 * mm))
    return flowables


def _photos(photos):
    """Two photographs to a row, each scaled to fit an identical frame so mixed shapes still line up.

    Returns the flowables and how many of the files were not readable images.
    """
    gap, pad, box_h = 5 * mm, 2 * mm, 62 * mm
    frame_w = (COLUMN - gap) / 2
    framed = []
    for raw in photos:
        image = _photo(raw, frame_w - 2 * pad, box_h)
        if image:
            frame = Table([[image]], colWidths=[frame_w], rowHeights=[box_h + 2 * pad])
            frame.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), PANEL),
                ("BOX",           (0, 0), (-1, -1), 0.7, RULE),
                ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                ("TOPPADDING",    (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            framed.append(frame)
    unreadable = len(photos) - len(framed)
    rows = [framed[i:i + 2] + [''] * (2 - len(framed[i:i + 2])) for i in range(0, len(framed), 2)]
    if not rows:
        return [], unreadable
    table = Table(rows, colWidths=[frame_w + gap, frame_w], rowHeights=[box_h + 2 * pad + gap] * len(rows))
    table.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "LEFT"),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [table], unreadable


def _photo(raw, box_w, box_h):
    """A photograph turned upright, shrunk to print size and fitted to the frame; None if it is not an image."""
    try:
        from PIL import Image as PILImage, ImageOps
        picture = ImageOps.exif_transpose(PILImage.open(io.BytesIO(raw)))
        picture.thumbnail((1400, 1400))     # phone photos are several MB; this keeps the PDF emailable
        if picture.mode != 'RGB':
            picture = picture.convert('RGB')
        jpeg = io.BytesIO()
        picture.save(jpeg, format='JPEG', quality=82)
        jpeg.seek(0)
        # Fit the frame, but never enlarge a small picture past about 110 dpi, where it turns blocky
        scale = min(box_w / picture.width, box_h / picture.height, 72 / 110)
        return Image(jpeg, width=picture.width * scale, height=picture.height * scale)
    except Exception:
        return None


# ===== Helpers =====

def _text(value):
    """A submitted value as safe Paragraph markup."""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return escape(str(value).strip()).replace('\n', '<br/>')


def _entry_text(text):
    """A timeline entry, with any times inside it in bold and each on its own line."""
    text = re.sub(r'(\d{1,2}:\d{2})', r'<b>\1</b>', escape(str(text).strip()).replace('\n', '<br/>'))
    return re.sub(r'(\s)(<b>\d{1,2}:\d{2}</b>\s)', r'<br/><br/>\2', text)


def _fmt_date(value):
    """The forms' date inputs send YYYY-MM-DD."""
    try:
        parsed = datetime.strptime(str(value), '%Y-%m-%d')
        return f"{parsed.day} {parsed:%B %Y}"
    except (TypeError, ValueError):
        return value


def _fmt_moment(moment):
    """A naive UTC datetime, shown in UK time."""
    try:
        local = moment.replace(tzinfo=timezone.utc).astimezone(ZoneInfo('Europe/London'))
    except Exception:  # no time zone database available
        return f"{moment.day} {moment:%B %Y} at {moment:%H:%M} UTC"
    return f"{local.day} {local:%B %Y} at {local:%H:%M}"
