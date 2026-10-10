"""
V3 Services Ltd — Admin Portal
House style for PDFs (ReportLab)
— The colours, typeface and page furniture shared by the notice and report builders —
"""

import io
import os
from functools import lru_cache

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable

# ===== Colours =====
INK = HexColor("#2B2E31")      # body text
SLATE = HexColor("#45494D")    # charcoal of the logo
ORANGE = HexColor("#EE722E")
MID = HexColor("#6B7278")
RULE = HexColor("#C9CDD1")
PANEL = HexColor("#F5F6F7")

W, H = A4
STRIP = 9 * mm                 # height of the accent strips at the page edges

# ===== Typeface =====
# Poppins (SIL Open Font License, see fonts/OFL.txt) is bundled so PDFs look the same on any server
FONT_DIR = os.path.join(os.path.dirname(__file__), 'fonts')
FONT, SEMIBOLD, BOLD = "Poppins", "Poppins-SemiBold", "Poppins-Bold"
for _name, _file in ((FONT, "Poppins-Regular.ttf"), (SEMIBOLD, "Poppins-SemiBold.ttf"), (BOLD, "Poppins-Bold.ttf")):
    pdfmetrics.registerFont(TTFont(_name, os.path.join(FONT_DIR, _file)))
pdfmetrics.registerFontFamily(FONT, normal=FONT, bold=SEMIBOLD, italic=FONT, boldItalic=SEMIBOLD)

# ===== Company details, for documents that go to clients (never for notices served on site) =====
LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'static', 'v3-logo.png')
COMPANY_NAME = "V3 Services Ltd"
COMPANY_CONTACT = [
    "117 Dartford Road, Dartford, DA1 3EN",
    "Tel: 0203 576 1343",
    "www.V3-Services.com",
    "Info@V3-Services.com",
]
COMPANY_LINE = (
    "V3 Services Limited · Registered in England No. 10653477 · "
    "Registered Office: 117 Dartford Road, Dartford DA1 3EN · VAT No. 269833460 · ICO: ZA485365"
)


def accent_strip(c, y, height=STRIP, flip=False):
    """Edge strip in the house colours: charcoal with a slanted orange end."""
    c.setFillColor(SLATE)
    c.rect(0, y, W, height, stroke=0, fill=1)
    slant, length = height * 0.9, 62 * mm
    p = c.beginPath()
    if not flip:    # orange at the right-hand end
        p.moveTo(W - length, y)
        p.lineTo(W, y)
        p.lineTo(W, y + height)
        p.lineTo(W - length + slant, y + height)
    else:           # orange at the left-hand end
        p.moveTo(0, y)
        p.lineTo(length - slant, y)
        p.lineTo(length, y + height)
        p.lineTo(0, y + height)
    p.close()
    c.setFillColor(ORANGE)
    c.drawPath(p, stroke=0, fill=1)


def spaced(c, text, x, y, font, size, tracking, colour, centre=False):
    """Draw letter-spaced text; `centre` centres it on x."""
    if centre:
        x -= (c.stringWidth(text, font, size) + tracking * (len(text) - 1)) / 2
    t = c.beginText(x, y)
    t.setFont(font, size)
    t.setCharSpace(tracking)
    t.setFillColor(colour)
    t.textOut(text)
    t.setCharSpace(0)  # tracking is PDF text state; reset it or it carries into everything drawn next
    c.drawText(t)


class Tracked(Flowable):
    """One line of letter-spaced text for a flowing document (Paragraph has no letter-spacing)."""

    def __init__(self, text, font, size, tracking, colour, centre=False, space_after=0):
        super().__init__()
        self.text, self.font, self.size, self.tracking = text, font, size, tracking
        self.colour, self.centre, self.space_after = colour, centre, space_after

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return (availWidth, self.size * 1.15 + self.space_after)

    def draw(self):
        x = self.width / 2 if self.centre else 0
        spaced(self.canv, self.text, x, self.space_after + self.size * 0.22, self.font, self.size,
               self.tracking, self.colour, self.centre)


@lru_cache(maxsize=1)
def logo_png():
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
