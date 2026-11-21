"""LCD 用ドットフォントの生成スクリプト

DejaVu Sans Mono（Bitstream Vera ライセンス）を指定ピクセルサイズでラスタライズし、
1 ピクセル = 1 正方形のアウトラインに変換した TrueType フォントを作る。
出力: fonts/ksdot-*.woff2 と css/fonts.css（base64 埋め込み）
"""
import base64, io, os, sys
from PIL import Image, ImageDraw, ImageFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = '/usr/share/fonts/truetype/dejavu/'
UNIT = 64  # 1 ピクセルのフォント単位

BASE = [chr(c) for c in range(0x20, 0x7F)] + list('×÷−±√πθ∠°′″≤≥≠≈←→↑↓▲▼◀▶·•…∞μλσΣΠ∑∏∫ΔαβγεφΦΩħ∂') + ['′', '″']
ITAL = {'\U0001D465': 'x', '\U0001D466': 'y', '\U0001D467': 'z', '\U0001D452': 'e', '\U0001D456': 'i', '\U0001D45F': 'r', '\U0001D45B': 'n', '\U0001D453': 'f', '\U0001D454': 'g', '\U0001D461': 't', '\U0001D44E': 'a', '\U0001D44F': 'b', '\U0001D450': 'c', '\U0001D451': 'd'}


def raster(fontfile, ch, size, adv_px, xoff=0, thresh=110):
    """1文字をラスタライズし、(x, y上向き) のピクセル座標（ベースライン y=0）を返す"""
    f = ImageFont.truetype(fontfile, size)
    W, H, BL = adv_px * 3, 40, 30
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    # 送り幅の中央に寄せる
    w = d.textlength(ch, font=f)
    x0 = adv_px + (adv_px - w) / 2 + xoff
    d.text((x0, BL), ch, font=f, fill=255, anchor='ls')
    px = im.load()
    return [(x - adv_px, BL - y - 1) for y in range(H) for x in range(W) if px[x, y] >= thresh]


CUSTOM = {
    # 分数記号（ライン表示）: 右下のかぎ形
    '⌟': [(6, y) for y in range(0, 8)] + [(5, y) for y in range(0, 8)] + [(x, 0) for x in range(1, 7)] + [(x, 1) for x in range(1, 7)],
    '▸': [(1, y) for y in range(1, 8)] + [(2, y) for y in range(2, 7)] + [(3, y) for y in range(3, 6)] + [(4, 4)],
    'ᴇ': [(x, y) for x in (1, 2) for y in range(0, 8)] + [(x, y) for x in range(1, 7) for y in (0, 1, 7)] + [(x, 4) for x in range(1, 6)],
}


def build(name, fontfile, italfile, size, em_px, base_px, adv_px, outname, thresh=110):
    glyphs = {}
    for ch in BASE:
        glyphs[ch] = [] if ch == ' ' else raster(fontfile, ch, size, adv_px, thresh=thresh)
    for k, v in ITAL.items():
        glyphs[k] = raster(italfile, v, size, adv_px, xoff=-0.5, thresh=thresh)
    scale = 1 if em_px >= 14 else 0.7
    for ch, pts in CUSTOM.items():
        glyphs[ch] = sorted(set((round(x * scale), round(y * scale)) for x, y in pts))
    fb = FontBuilder(em_px * UNIT, isTTF=True)
    names = ['.notdef'] + ['uni%04X' % ord(c) if ord(c) < 0x10000 else 'u%X' % ord(c) for c in glyphs]
    cmap, tt, metrics = {}, {}, {}
    for (ch, pts), gname in zip(glyphs.items(), names[1:]):
        cmap[ord(ch)] = gname
        pen = TTGlyphPen(None)
        for x, y in pts:
            X, Y = x * UNIT, y * UNIT
            pen.moveTo((X, Y)); pen.lineTo((X, Y + UNIT)); pen.lineTo((X + UNIT, Y + UNIT)); pen.lineTo((X + UNIT, Y)); pen.closePath()
        tt[gname] = pen.glyph()
        metrics[gname] = (adv_px * UNIT, 0)
    tt['.notdef'] = TTGlyphPen(None).glyph(); metrics['.notdef'] = (adv_px * UNIT, 0)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(tt)
    fb.setupHorizontalMetrics(metrics)
    asc = base_px * UNIT; desc = -(em_px - base_px) * UNIT
    fb.setupHorizontalHeader(ascent=asc, descent=desc)
    fb.setupNameTable({'familyName': name, 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, usWinAscent=asc, usWinDescent=-desc, sTypoLineGap=0)
    fb.setupPost()
    fb.font.flavor = 'woff2'
    buf = io.BytesIO(); fb.font.save(buf)
    data = buf.getvalue()
    os.makedirs(os.path.join(ROOT, 'fonts'), exist_ok=True)
    open(os.path.join(ROOT, 'fonts', outname), 'wb').write(data)
    return data


if __name__ == '__main__':
    css = ['/* 生成ファイル: tools/build_font.py（DejaVu Sans Mono 派生のドットフォント） */']
    specs = [
        # family, 元フォント, 斜体元, サイズ(px), em(px), ベースライン上の高さ(px), 送り幅(px), ファイル, しきい値
        ('KSDot', 'DejaVuSansMono-Bold.ttf', 'DejaVuSansMono-BoldOblique.ttf', 14.5, 14, 11, 10, 'ksdot.woff2', 100),
        ('KSDotSmall', 'DejaVuSansMono-Bold.ttf', 'DejaVuSansMono-BoldOblique.ttf', 9.4, 9, 7, 6, 'ksdot-small.woff2', 125),
        ('KSDotThin', 'DejaVuSansMono.ttf', 'DejaVuSansMono-Oblique.ttf', 10.6, 10, 8, 6, 'ksdot-thin.woff2', 120),
    ]
    for fam, src, ital, size, em, base, adv, out, th in specs:
        data = build(fam, SRC + src, SRC + ital, size, em, base, adv, out, th)
        css.append("@font-face { font-family: '%s'; src: url(data:font/woff2;base64,%s) format('woff2'); font-display: block; }" % (fam, base64.b64encode(data).decode()))
        print(fam, len(data), 'bytes')
    open(os.path.join(ROOT, 'css', 'fonts.css'), 'w').write('\n'.join(css) + '\n')
