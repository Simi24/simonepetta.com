"""Writes public/favicon.svg: the "S" of Host Grotesk Bold as an outlined path on an ink square.

The self-hosted font is a variable woff2 (wght 300-800): it is pinned to 700, the glyph is
taken as a path and fitted into the square. A favicon cannot load web fonts, hence the path.
Needs fontTools and brotli; run through `scripts/favicon/generate.sh`.
"""

import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONT, OUT = sys.argv[1], sys.argv[2]

SIZE = 64  # viewBox side
RADIUS = 10  # slightly rounded corners
GLYPH_HEIGHT = 48  # tall enough to stay legible at 16 px, with a margin that keeps the corners clear
OPTICAL_SHIFT_Y = 0  # tuned by eye on the 16 px rendering

font = instantiateVariableFont(TTFont(FONT), {"wght": 700})
glyphs = font.getGlyphSet()
glyph = glyphs["S"]

bounds = BoundsPen(glyphs)
glyph.draw(bounds)
x_min, y_min, x_max, y_max = bounds.bounds

scale = GLYPH_HEIGHT / (y_max - y_min)
# Font y points up, SVG y points down: flip while centering the bounding box in the square.
offset_x = (SIZE - (x_max - x_min) * scale) / 2 - x_min * scale
offset_y = (SIZE + GLYPH_HEIGHT) / 2 + y_min * scale + OPTICAL_SHIFT_Y

path = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
glyph.draw(TransformPen(path, (scale, 0, 0, -scale, offset_x, offset_y)))

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">
<rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="#161616"/>
<path fill="#ededeb" d="{path.getCommands()}"/>
</svg>
"""
with open(OUT, "w") as out:
    out.write(svg)
