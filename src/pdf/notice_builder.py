"""
V3 Services Ltd — Admin Portal
Notice Builder (ReportLab)
— Notices served on site. They name only the landowner: no company name, logo or contact details —
"""

import re
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib.colors import white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from .house_style import (
    INK, SLATE, ORANGE, MID, RULE, PANEL, W, H, STRIP, FONT, SEMIBOLD, BOLD, accent_strip, spaced
)

LEFT = 25 * mm
RIGHT = W - 25 * mm
COLUMN = RIGHT - LEFT

# ===== Questions a notice can ask, in the order the form shows them =====
LANDOWNER = {'name': 'landowner', 'label': 'Landowner / client', 'type': 'text', 'max': 150}
ADDRESS = {'name': 'address', 'label': 'Property address', 'type': 'textarea', 'max': 300}
DATE = {'name': 'date', 'label': 'Date on the notice', 'type': 'date', 'max': 40}

# ===== The notices =====
# `sections` is the wording: (heading, paragraph). A paragraph may use {field} for an answer
# and <b>, <super> markup. A notice without `sections` is listed but cannot be generated yet.
NOTICES = {
    'traveller_eviction': {'label': 'Traveller Eviction Notice'},
    'traveller_serve': {'label': 'Traveller Serve Notice'},
    'squatter_serve': {'label': 'Squatter Serve Notice'},
    'squatter_eviction': {
        'label': 'Squatter Eviction Notice',
        'kicker': 'Common Law Notice',
        'title': 'Notice to Vacate',
        'badge': 'This is Private Property',
        'to': 'Occupants / Persons Unknown',
        'fields': [LANDOWNER, ADDRESS, DATE],
        'sections': [
            ('TAKE NOTICE THAT',
             "<b>{landowner}</b> is the Landowner / Landlord of the premises on which you are trespassing "
             "and require you to leave. You are here without permission, licence or consent and should "
             "therefore leave with all your belongings immediately."),
            ('RIGHT OF REMOVAL',
             "If you fail to do so the Landowner will exercise its rights of self-help to remove and have "
             "instructed Bailiffs to do so on its behalf. This right, under common law, is set out in "
             "Halsbury’s Laws of England (Volume 97 (2010) 5<super>th</super> Edition)."),
            ('POLICE ATTENDANCE',
             "The police will be informed and asked to attend whilst the Landowner exercises its right of "
             "removal to ensure that there is no breach of the peace."),
        ],
    },
    'abandoned_vehicle': {'label': 'Abandoned Vehicle Notice'},
}


# ===== Public API =====
def notice_types():
    """The notices the form can offer: key, label, whether the wording exists yet, and the questions to ask."""
    return [
        {
            'key': key,
            'label': notice['label'],
            'available': bool(notice.get('sections')),
            'fields': notice.get('fields', []),
        }
        for key, notice in NOTICES.items()
    ]


def build_notice_pdf(file_obj, notice_type, values):
    """
    Build a one-page A4 notice.

    Args:
        file_obj: output path or file-like object
        notice_type: a key of NOTICES whose wording exists
        values: answers to that notice's questions, by field name; `date` is YYYY-MM-DD

    Returns:
        str: a file name for the notice (without extension)
    """
    notice = NOTICES[notice_type]
    answers = {name: escape(str(value).strip()) for name, value in values.items()}
    address = str(values.get('address', '')).strip()

    c = canvas.Canvas(file_obj, pagesize=A4)
    c.setTitle(notice['title'])
    c.setSubject(notice['kicker'])
    kicker, title, badge = notice['kicker'].upper(), notice['title'].upper(), notice['badge'].upper()

    accent_strip(c, H - STRIP)
    accent_strip(c, 0, flip=True)

    # ---- title ----
    y = H - STRIP - 19 * mm
    spaced(c, kicker, W / 2, y, SEMIBOLD, 10, 3.2, ORANGE, centre=True)
    y -= 15 * mm
    spaced(c, title, W / 2, y, BOLD, 30, 0.6, SLATE, centre=True)
    y -= 14 * mm
    badge_size, badge_track = 11, 2.1
    badge_w = c.stringWidth(badge, SEMIBOLD, badge_size) + badge_track * (len(badge) - 1) + 14 * mm
    c.setFillColor(SLATE)
    c.roundRect(W / 2 - badge_w / 2, y - 2.8 * mm, badge_w, 8.6 * mm, 1.4 * mm, stroke=0, fill=1)
    spaced(c, badge, W / 2, y, SEMIBOLD, badge_size, badge_track, white, centre=True)
    y -= 11 * mm
    c.setStrokeColor(SLATE)
    c.setLineWidth(1.3)
    c.line(LEFT, y, RIGHT, y)

    # ---- who and where ----
    y -= 9 * mm
    label = ParagraphStyle("label", fontName=SEMIBOLD, fontSize=7.6, leading=11, textColor=MID)
    value = ParagraphStyle("value", fontName=FONT, fontSize=11, leading=15.5, textColor=INK)
    label_w, pad, row_gap = 31 * mm, 6 * mm, 3.2 * mm
    rows = [
        (Paragraph("TO", label), Paragraph(escape(notice['to']), value)),
        (Paragraph("PROPERTY", label), Paragraph(f"<b>{escape(_keep_postcode_together(address))}</b>", value)),
    ]
    heights = [val.wrap(COLUMN - label_w - 2 * pad, H)[1] for _, val in rows]
    panel_h = sum(heights) + row_gap * (len(rows) - 1) + 11 * mm
    c.setFillColor(PANEL)
    c.rect(LEFT, y - panel_h, COLUMN, panel_h, stroke=0, fill=1)
    c.setFillColor(ORANGE)
    c.rect(LEFT, y - panel_h, 1.5 * mm, panel_h, stroke=0, fill=1)
    row_y = y - 5.5 * mm
    for (lab, val), height in zip(rows, heights):
        lab.wrap(label_w, H)
        lab.drawOn(c, LEFT + pad, row_y - 11.4)
        val.drawOn(c, LEFT + pad + label_w, row_y - height)
        row_y -= height + row_gap
    y -= panel_h

    # ---- the wording: the largest text that fits above the date (it is read standing at a gate) ----
    foot = STRIP + 15 * mm
    top = y - 11 * mm
    available = top - (foot + 14 * mm)
    for size in (12.5, 12, 11.5, 11, 10.5, 10, 9.5, 9):
        body = ParagraphStyle("body", fontName=FONT, fontSize=size, leading=size * 1.55, textColor=INK)
        head_gap, section_gap = size * 0.85, size * 2.3
        paragraphs = [Paragraph(_fill(text, answers, size), body) for _, text in notice['sections']]
        text_h = [p.wrap(COLUMN, H)[1] for p in paragraphs]
        total = sum(text_h) + len(paragraphs) * (size + head_gap) + section_gap * (len(paragraphs) - 1)
        if total <= available:
            break

    y = top
    for i, ((heading, _), p, height) in enumerate(zip(notice['sections'], paragraphs, text_h)):
        if i:
            c.setStrokeColor(RULE)
            c.setLineWidth(0.7)
            c.line(LEFT, y + section_gap / 2, RIGHT, y + section_gap / 2)
        spaced(c, heading, LEFT, y - size * 0.82, SEMIBOLD, size * 0.88, 1.1, SLATE)
        y -= size + head_gap
        p.drawOn(c, LEFT, y - height)
        y -= height + section_gap

    # ---- date ----
    c.setStrokeColor(SLATE)
    c.setLineWidth(1.3)
    c.line(LEFT, foot + 9 * mm, RIGHT, foot + 9 * mm)
    dated = ParagraphStyle("dated", fontName=SEMIBOLD, fontSize=11.5, leading=16, textColor=SLATE)
    p = Paragraph(f"Dated: {_fmt_date(values.get('date'), 11.5)}", dated)
    _, height = p.wrap(COLUMN, H)
    p.drawOn(c, LEFT, foot + 4.5 * mm - height)

    c.showPage()
    c.save()

    return re.sub(r'[\\/:*?"<>|\r\n]+', ' ', f"{notice['label']} - {address}").strip()[:120]


# ===== Helpers =====

def _raised(text, size):
    """Small superscript sized to the surrounding text; the default <super> is nearly full size."""
    return f'<super rise="{size * 0.36:.1f}" size="{size * 0.58:.1f}">{text}</super>'


def _fill(text, answers, size):
    """Put the (escaped) answers into a paragraph of wording and size its superscripts."""
    text = re.sub(r'\{(\w+)\}', lambda m: answers.get(m.group(1), m.group(0)), text)
    return re.sub(r'<super>(.*?)</super>', lambda m: _raised(m.group(1), size), text)


def _keep_postcode_together(address):
    """Stop a trailing UK postcode (e.g. 'SW9 0JJ') being split across two lines."""
    return re.sub(r"([A-Za-z]{1,2}\d[A-Za-z\d]?) (\d[A-Za-z]{2})\s*$",
                  lambda m: m.group(1) + " " + m.group(2), address.strip())


def _fmt_date(value, size):
    """'2026-10-11' (the form's date input) -> '11th October 2026' with a raised ordinal."""
    try:
        parsed = datetime.strptime(str(value), '%Y-%m-%d')
    except (TypeError, ValueError):
        return escape(str(value or ''))
    day = parsed.day
    suffix = "th" if 10 <= day % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{_raised(suffix, size)} {parsed:%B %Y}"
