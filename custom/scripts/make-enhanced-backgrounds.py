#!/usr/bin/env python3
"""ATV fork: derive the widescreen + enhanced backgrounds from the ATV art.

The ATV set (TV.zip) has no *-wide-enhanced files, so in widescreen + enhanced mode the
screens that widen to 854px (Current Conditions, Latest Observations, Local Forecast,
Regional, Climate, Hourly Graph, Almanac) fell back to upstream's blue/orange art.

  atv/1-wide-enhanced.png  atv/1-wide.png with its dark panel widened to upstream's
                           enhanced panel (x 52-797, y 90-399)
  atv/3-wide-enhanced.png  atv/5.png (Almanac) stretched to 854px, edges kept crisp,
                           inside the header and bottom bar of atv/1-wide.png

Requires Pillow (pip install pillow). Run from the repo root:
  python3 custom/scripts/make-enhanced-backgrounds.py
Replace the outputs with designer-made files at any time; nothing else depends on this script.
"""
from pathlib import Path

from PIL import Image

ART = Path('server/images/backgrounds/atv')
W, H = 854, 480
HEADER_BOTTOM, FOOTER_TOP = 90, 400  # rows 0-89 header band, 400-479 bottom bar
ENHANCED_PANEL = (52, 798)  # upstream 1-wide-enhanced.png panel columns (end exclusive)


def stretch_x(img, edge, width):
    """Resize horizontally to `width`, keeping `edge` px at each side unscaled (3-slice)."""
    w, h = img.size
    out = Image.new(img.mode, (width, h))
    out.paste(img.crop((0, 0, edge, h)), (0, 0))
    out.paste(img.crop((w - edge, 0, w, h)), (width - edge, 0))
    middle = img.crop((edge, 0, w - edge, h)).resize((width - 2 * edge, h), Image.LANCZOS)
    out.paste(middle, (edge, 0))
    return out


def find_panel(img, y):
    """Columns of the dark panel on row y in atv/1-wide.png."""
    row = [img.getpixel((x, y)) for x in range(img.width)]
    dark = [x for x, (r, g, b, *_) in enumerate(row) if r + g + b < 120]
    return dark[0], dark[-1] + 1


def main():
    wide = Image.open(ART / '1-wide.png').convert('RGBA')
    assert wide.size == (W, H), wide.size

    # 1-wide-enhanced: widen the panel, keep the frame (header, bottom bar, side art)
    x0, x1 = find_panel(wide, 250)
    panel = wide.crop((x0, HEADER_BOTTOM, x1, FOOTER_TOP))
    enhanced = wide.copy()
    left, right = ENHANCED_PANEL
    enhanced.paste(stretch_x(panel, 8, right - left), (left, HEADER_BOTTOM))
    enhanced.convert('RGB').save(ART / '1-wide-enhanced.png', optimize=True)
    print(f'1-wide-enhanced.png: panel {x0}-{x1 - 1} widened to {left}-{right - 1}')

    # 3-wide-enhanced: Almanac art, full width between the widescreen header and bottom bar
    almanac = Image.open(ART / '5.png').convert('RGBA')
    assert almanac.size == (640, H), almanac.size
    body = stretch_x(almanac.crop((0, HEADER_BOTTOM, 640, FOOTER_TOP)), 10, W)
    almanac_wide = wide.copy()
    almanac_wide.paste(body, (0, HEADER_BOTTOM))
    almanac_wide.convert('RGB').save(ART / '3-wide-enhanced.png', optimize=True)
    print('3-wide-enhanced.png: 5.png body stretched to 854px')


if __name__ == '__main__':
    main()
