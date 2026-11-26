"""Builds src/assets/fonts/pixel-five-{400,500,600,700}.woff2.

Pixelify Sans's "5" is nearly a copy of its "S" (rounded top corners), so on the
site it read as an S. This redraws it as a flat-topped pixel 5 and subsets each
weight to that one glyph. index.css layers it in front of Pixelify Sans with
unicode-range U+0035. The grid edges come from each weight's own S/5 outlines,
so the strokes match. License: SIL OFL 1.1 (src/assets/fonts/OFL.txt); renamed
"Pixel Five" as a Modified Version.

Usage (needs fonttools + brotli):
  python3 scripts/pixel-five.py node_modules/@fontsource/pixelify-sans/files src/assets/fonts
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools import subset

# per weight: grid edges read from that weight's original glyphs
P = {
  400: dict(B0=-12, B1=78, I1=88,  D1=179, L0=60, L1=151, L1i=161, R1=423, R1o=433, R2=525, Mb=260, Mc=270, Mt=359, Ti=530, T=631),
  500: dict(B0=-12, B1=77, I1=100, D1=190, L0=60, L1=150, L1i=170, R1=420, R1o=440, R2=531, Mb=255, Mc=279, Mt=366, Ti=520, T=633),
  600: dict(B0=-11, B1=75, I1=113, D1=200, L0=61, L1=150, L1i=179, R1=417, R1o=446, R2=536, Mb=251, Mc=288, Mt=374, Ti=511, T=636),
  700: dict(B0=-11, B1=74, I1=125, D1=211, L0=61, L1=149, L1i=188, R1=414, R1o=453, R2=542, Mb=246, Mc=297, Mt=381, Ti=501, T=638),
}
src_dir, out_dir = sys.argv[1], sys.argv[2]
for w, p in P.items():
    f = TTFont(f"{src_dir}/pixelify-sans-latin-{w}-normal.woff2")
    g = lambda *ks: (p[ks[0]], p[ks[1]])
    pts = [g("L1","B0"), g("L1","B1"), g("L0","B1"), g("L0","D1"), g("L1i","D1"), g("L1i","I1"),
           g("R1","I1"), g("R1","Mb"), g("L0","Mb"), g("L0","T"), g("R2","T"), g("R2","Ti"),
           g("L1","Ti"), g("L1","Mt"), g("R1o","Mt"), g("R1o","Mc"), g("R2","Mc"), g("R2","B1"),
           g("R1o","B1"), g("R1o","B0")]
    pen = TTGlyphPen(None)
    pen.moveTo(pts[0])
    for pt in pts[1:]: pen.lineTo(pt)
    pen.closePath()
    f["glyf"]["five"] = pen.glyph()
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = []; opts.name_IDs = ["*"]; opts.hinting = False
    sub = subset.Subsetter(opts); sub.populate(unicodes=[0x35]); sub.subset(f)
    for rec in f["name"].names:
        if rec.nameID in (1, 3, 4, 6, 16):
            rec.string = {1: "Pixel Five", 3: f"PixelFive-{w}", 4: f"Pixel Five {w}", 6: f"PixelFive-{w}", 16: "Pixel Five"}[rec.nameID]
    f["name"].setName("Modified from Pixelify Sans (SIL OFL 1.1): redrawn digit 5", 10, 3, 1, 0x409)
    f.flavor = "woff2"
    f.save(f"{out_dir}/pixel-five-{w}.woff2")
    print(w, "ok")
