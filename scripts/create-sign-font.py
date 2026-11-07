"""Build our original geometric sign alphabet; no third-party font is redistributed."""
import base64
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from pathlib import Path
from math import hypot

# Hand-drawn strokes on a 10 x 10 grid, in screen coordinates.
strokes = {
    '香': [(2,1,8,0.5),(5,1,5,5),(1,2.5,9,2.5),(5,2.5,1,5),(5,2.5,9,5),(2.5,5,7.5,5),(2.5,5,2.5,9),(7.5,5,7.5,9),(2.5,7,7.5,7),(2.5,9,7.5,9)],
    '港': [(1,1,2,2),(0.5,4,1.7,4.5),(1,9,2.2,6),(3,2,9,2),(4.5,0.7,4.5,4),(7.5,0.7,7.5,4),(3,4,9,4),(5,4,3,6),(7,4,9,6),(4,6,8,6),(8,6,8,7.5),(4,7.5,8,7.5),(4,6,4,9),(4,9,9,9),(9,9,9,8)],
    '茶': [(1,2,9,2),(3,0.5,3,3),(7,0.5,7,3),(5,3,1,5.5),(5,3,9,5.5),(2,6,8,6),(5,5,5,9.5),(3.5,7,1.5,9),(6.5,7,8.5,9)],
    '夜': [(4.5,0.5,5.5,1.5),(1,2,9,2),(3.5,3,1,6),(2.5,4.5,2.5,9.5),(6,3,4,6),(5,4,8.5,4),(8.5,4,7,7),(6,5,7,6),(4.5,6,6,8),(6,8,9,9.5),(7,7,4,9.5)],
    '電': [(2,1,8,1),(5,1,5,5),(1,2.5,9,2.5),(1,2.5,1,4.5),(9,2.5,9,4.5),(2,3.5,4,3.5),(6,3.5,8,3.5),(2,4.5,4,4.5),(6,4.5,8,4.5),(2,5.5,8,5.5),(2,5.5,2,8.5),(8,5.5,8,8.5),(2,7,8,7),(2,8.5,8,8.5),(5,5.5,5,9.5),(5,9.5,9,9.5),(9,9.5,9,8.5)],
    '城': [(0.5,4,3.5,4),(2,1.5,2,8.5),(0.5,9,3.5,8),(4,3,9.5,3),(4,3,4,7),(4,7,3,9.5),(4,5,6,5),(6,5,6,8),(6,8,5,8.5),(7,0.5,7,5),(7,5,8.5,9),(8.5,9,9.5,8),(8,5,5.5,9.5),(8.5,1,9,2)],
}
builder = FontBuilder(1000, isTTF=True)
order = ['.notdef', 'space'] + [f'uni{ord(c):04X}' for c in strokes]
builder.setupGlyphOrder(order)
glyphs = {}
for name in order:
    pen = TTGlyphPen(None)
    char = next((c for c in strokes if name == f'uni{ord(c):04X}'), None)
    for x1, y1, x2, y2 in strokes.get(char, []):
        ax, ay, bx, by = x1*82+90, 900-y1*82, x2*82+90, 900-y2*82
        length = hypot(bx-ax, by-ay)
        nx, ny = -(by-ay)/length*22, (bx-ax)/length*22
        pen.moveTo((ax+nx, ay+ny))
        pen.lineTo((bx+nx, by+ny))
        pen.lineTo((bx-nx, by-ny))
        pen.lineTo((ax-nx, ay-ny))
        pen.closePath()
    glyphs[name] = pen.glyph()
builder.setupGlyf(glyphs)
builder.setupHorizontalMetrics({name: (1000, 0) for name in order})
builder.setupHorizontalHeader(ascent=1000, descent=-100)
builder.setupCharacterMap({32: 'space', **{ord(c): f'uni{ord(c):04X}' for c in strokes}})
builder.setupNameTable({'familyName': 'After Hours Signs', 'styleName': 'Regular', 'uniqueFontIdentifier': 'AfterHoursSigns-1', 'fullName': 'After Hours Signs', 'psName': 'AfterHoursSigns'})
builder.setupOS2(sTypoAscender=1000, sTypoDescender=-100, usWinAscent=1000, usWinDescent=100)
builder.setupPost()
builder.setupMaxp()
from io import BytesIO
buffer = BytesIO()
builder.save(buffer)
Path('scripts/sign-font-base64.txt').write_text(base64.b64encode(buffer.getvalue()).decode())
print(f'Generated original embedded sign font: {len(buffer.getvalue())} bytes')
