/* 計算結果の表示形式 */
(function (C) {
  'use strict';
  const E = C.E, V = C.V, B = BigInt, esc = (s) => C.esc(s);

  const ENG_SYMBOLS = { f: -15, p: -12, n: -9, 'μ': -6, m: -3, k: 3, M: 6, G: 9, T: 12, P: 15, E: 18 };
  C.ENG_SYMBOLS = ENG_SYMBOLS;
  const ENG_BY_EXP = {}; for (const k in ENG_SYMBOLS) ENG_BY_EXP[ENG_SYMBOLS[k]] = k;

  function digitsSep(intStr, s) {
    if (!s.sep) return intStr;
    const neg = intStr.startsWith('-'); let d = neg ? intStr.slice(1) : intStr;
    d = d.replace(/\B(?=(\d{3})+(?!\d))/g, s.decMark === ',' ? '.' : ',');
    return (neg ? '-' : '') + d;
  }
  function decStr(str, s) { // "123.45" -> 桁区切り・小数点記号
    let neg = str.startsWith('-'); if (neg) str = str.slice(1);
    let [ip, fp] = str.split('.');
    ip = digitsSep(ip, s);
    let out = ip + (fp !== undefined ? (s.decMark === ',' ? ',' : '.') + fp : '');
    return (neg ? '-' : '') + out;
  }
  function expHtml(mant, ex, s) { return '<span class="tk">' + esc(decStr(mant, s)) + '</span><span class="tk">×10</span><span class="sup">' + esc(String(ex).replace('-', '−')) + '</span>'; }
  const neg2 = (h) => h.replace(/^-/, '−');

  // 近似値の表示 -> {html, text}
  function fmtFloat(v, s, forceEng) {
    if (v === 0 || Object.is(v, -0)) {
      if (s.numFmt.type === 'fix') return { html: '<span class="tk">' + decStr((0).toFixed(s.numFmt.n), s) + '</span>', text: (0).toFixed(s.numFmt.n) };
      if (s.numFmt.type === 'sci') { const m = (0).toFixed(Math.max(0, (s.numFmt.n || 10) - 1)); return { html: expHtml(m, 0, s), text: m + 'E0' }; }
      return { html: '<span class="tk">0</span>', text: '0' };
    }
    const a = Math.abs(v);
    const nf = s.numFmt;
    if (forceEng !== undefined && forceEng !== false) return fmtEng(v, s, typeof forceEng === 'number' ? forceEng : 0);
    if (s.eng && nf.type === 'norm') { const r = fmtEngSym(v, s); if (r) return r; }
    if (nf.type === 'sci') {
      const n = nf.n || 10;
      let [m, e] = v.toExponential(n - 1).split('e');
      return { html: expHtml(m, parseInt(e, 10), s), text: m + 'E' + e };
    }
    if (nf.type === 'fix') {
      const r = Number(v.toPrecision(15));
      if (Math.abs(r) >= 1e10) { let [m, e] = v.toExponential(nf.n).split('e'); return { html: expHtml(m, parseInt(e, 10), s), text: m + 'E' + e }; }
      let t = r.toFixed(nf.n);
      if (/^-0\.?0*$/.test(t)) t = t.slice(1);
      return { html: '<span class="tk">' + esc(neg2(decStr(t, s))) + '</span>', text: t };
    }
    // Norm
    const r10 = Number(v.toPrecision(10));
    const ar = Math.abs(r10);
    const lo = nf.n === 2 ? 1e-9 : 1e-2;
    if (ar < lo || ar >= 1e10) {
      let [m, e] = r10.toExponential(9).split('e');
      m = m.replace(/\.?0+$/, '');
      return { html: expHtml(neg2(m), parseInt(e, 10), s), text: m + 'E' + e };
    }
    let t = r10.toPrecision(10);
    if (t.includes('e')) t = String(r10);
    if (t.includes('.')) t = t.replace(/\.?0+$/, '');
    // 10桁に収める
    const digits = t.replace(/[-.]/g, '').replace(/^0+/, '');
    if (digits.length > 10) { t = Number(t).toPrecision(10); if (t.includes('.')) t = t.replace(/\.?0+$/, ''); }
    return { html: '<span class="tk">' + esc(neg2(decStr(t, s))) + '</span>', text: t };
  }
  function fmtEng(v, s, shift) {
    if (v === 0) return { html: '<span class="tk">0</span>', text: '0' };
    const r = Number(v.toPrecision(10));
    let e = Math.floor(Math.log10(Math.abs(r)) / 3) * 3 + (shift || 0) * 3;
    let m = r / Math.pow(10, e);
    let ms = Number(m.toPrecision(10)).toString();
    if (ms.includes('e')) ms = m.toFixed(10).replace(/\.?0+$/, '');
    if (s.eng && ENG_BY_EXP[e]) return { html: '<span class="tk">' + esc(neg2(decStr(ms, s))) + ENG_BY_EXP[e] + '</span>', text: ms + ENG_BY_EXP[e] };
    return { html: expHtml(neg2(ms), e, s), text: ms + 'E' + e };
  }
  function fmtEngSym(v, s) {
    const a = Math.abs(v);
    if (a >= 1 && a < 1000) return null;
    const e = Math.floor(Math.log10(Math.abs(Number(v.toPrecision(10)))) / 3) * 3;
    if (!ENG_BY_EXP[e]) return null;
    return fmtEng(v, s, 0);
  }

  // ---- 厳密値 ----
  const ndig = (b) => E.babs(b).toString().length;
  function ratParts(x) { return E.ratOf(x); }
  function fracHtml(numH, denH) { return '<span class="frac"><span class="num"><span class="row">' + numH + '</span></span><span class="den"><span class="row">' + denH + '</span></span></span>'; }
  function tk(t) { return '<span class="tk">' + esc(t) + '</span>'; }

  // 有理数表示（数学）: 戻り値 null は小数表示へ
  function fmtRat(n, d, s, opts) {
    const math = opts.math;
    if (d === 1n) {
      if (ndig(n) > 10) return null;
      const t = digitsSep(n.toString(), s);
      return { html: tk(neg2(t)), text: n.toString() };
    }
    const mixed = opts.mixed !== undefined ? opts.mixed : s.frac === 'mixed';
    const neg = n < 0n; const an = E.babs(n);
    if (mixed && an > d) {
      const w = an / d, r = an % d;
      if (ndig(w) + ndig(r) + ndig(d) + 2 > 10) return null;
      if (math) return { html: (neg ? tk('−') : '') + tk(w.toString()) + fracHtml(tk(r.toString()), tk(d.toString())), text: (neg ? '-' : '') + w + '⌟' + r + '⌟' + d };
      return { html: tk((neg ? '−' : '') + w + '⌟' + r + '⌟' + d), text: (neg ? '-' : '') + w + '⌟' + r + '⌟' + d };
    }
    if (ndig(an) + ndig(d) + 1 > 10) return null;
    if (math) return { html: (neg ? tk('−') : '') + fracHtml(tk(an.toString()), tk(d.toString())), text: n + '/' + d };
    return { html: tk((neg ? '−' : '') + an + '⌟' + d), text: n + '⌟' + d };
  }
  function surdTerm(c, r, first) { // c: BigInt coef (signed), r radicand
    const neg = c < 0n, a = E.babs(c);
    let h = '';
    if (neg) h += tk('−'); else if (!first) h += tk('+');
    if (r === 1n) h += tk(a.toString());
    else { if (a !== 1n) h += tk(a.toString()); h += '<span class="sqrt"><span class="rad">√</span><span class="rc"><span class="row">' + tk(r.toString()) + '</span></span></span>'; }
    return h;
  }
  function fmtSurd(x, s) {
    // 共通分母
    let D = 1n; for (const [, d] of x.t) D = D * d / E.gcd(D, d);
    if (D >= 100n) return null;
    const terms = x.t.map(([n, d, r]) => [n * (D / d), r]);
    for (const [c, r] of terms) { if (E.babs(c) >= 100n && r !== 1n) return null; if (r >= 1000n) return null; if (r === 1n && ndig(c) > 6) return null; }
    // 有理項を先頭に
    terms.sort((a, b) => (a[1] === 1n ? -1 : b[1] === 1n ? 1 : 0));
    if (D === 1n) { let h = ''; terms.forEach(([c, r], i) => { h += surdTerm(c, r, i === 0); }); return { html: h, text: '√' }; }
    let sign = '';
    if (terms.length === 1 && terms[0][0] < 0n) { sign = tk('−'); terms[0][0] = -terms[0][0]; }
    let numH = ''; terms.forEach(([c, r], i) => { numH += surdTerm(c, r, i === 0); });
    return { html: sign + fracHtml(numH, tk(D.toString())), text: '√' };
  }
  function fmtPi(x, s) {
    if (Math.abs(E.toNum(x)) >= 1e6) return null;
    const n = x.n, d = x.d, an = E.babs(n);
    if (an >= 1000n || d >= 1000n) return null;
    const neg = n < 0n;
    const numH = (an === 1n ? '' : tk(an.toString())) + tk('π');
    if (d === 1n) return { html: (neg ? tk('−') : '') + numH, text: 'π' };
    return { html: (neg ? tk('−') : '') + fracHtml(numH, tk(d.toString())), text: 'π' };
  }

  // 実数を表示
  function fmtReal(x, s, mode) {
    // mode: {fmt:'std'|'dec'|..., math:bool}
    const io = s.io;
    const fmt = mode.fmt || 'std';
    const math = io === 'mm' || io === 'md';
    const allowExact = (io === 'mm' || io === 'll') && fmt !== 'dec';
    if (E.isE(x) && fmt !== 'dec' && fmt !== 'eng') {
      if (E.isRat(x) && (allowExact || fmt === 'improper' || fmt === 'mixed')) {
        const [n, d] = ratParts(x);
        const r = fmtRat(n, d, s, { math: math && io !== 'll', mixed: fmt === 'mixed' ? true : fmt === 'improper' ? false : undefined });
        if (r) return r;
      } else if (E.isRat(x)) {
        const [n, d] = ratParts(x);
        if (d === 1n && ndig(n) <= 10 && s.numFmt.type === 'norm' && !s.eng) return { html: tk(neg2(digitsSep(n.toString(), s))), text: n.toString() };
      } else if (io === 'mm' && fmt === 'std') {
        const r = x.k === 'p' ? fmtPi(x, s) : fmtSurd(x, s);
        if (r) return r;
      }
    }
    const v = E.toNum(x);
    if (fmt === 'eng') return fmtFloat(v, s, mode.engShift || 0);
    return fmtFloat(v, s);
  }

  function fmtSexa(x, s) {
    let v = E.toNum(x); const neg = v < 0; v = Math.abs(v);
    if (v > 9999999.9999) return null;
    let d = Math.floor(v); let mf = (v - d) * 60; let m = Math.floor(mf + 1e-9); let sec = (mf - m) * 60;
    sec = Math.round(sec * 100) / 100; if (sec >= 60) { sec -= 60; m++; } if (m >= 60) { m -= 60; d++; }
    let secS = Number(sec.toFixed(2)).toString();
    const t = (neg ? '−' : '') + d + '°' + m + '′' + secS + '″';
    return { html: tk(t), text: t };
  }
  function primeFactor(x) {
    if (!E.isRat(x)) return null;
    const [n, d] = E.ratOf(x);
    if (d !== 1n || n <= 1n || ndig(n) > 10) return null;
    let rem = n; const fac = [];
    for (let p = 2n; p <= 1009n && p * p <= rem; p += (p === 2n ? 1n : 2n)) { let c = 0; while (rem % p === 0n) { rem /= p; c++; } if (c) fac.push([p, c]); }
    let left = null;
    if (rem > 1n) { if (rem < 1018081n) fac.push([rem, 1]); else left = rem; }
    let h = '';
    fac.forEach(([p, c], i) => { if (i) h += tk('×'); h += tk(p.toString()); if (c > 1) h += '<span class="sup">' + c + '</span>'; });
    if (left) h += (fac.length ? tk('×') : '') + tk('(' + left + ')');
    return { html: h, text: '' };
  }
  function recurring(x, s) {
    if (!E.isRat(x)) return null;
    const [n, d] = E.ratOf(x); if (d === 1n) return null;
    const neg = n < 0n; let an = E.babs(n);
    const ip = an / d; let r = an % d;
    const seen = new Map(); let digits = '';
    while (r !== 0n && !seen.has(r)) { seen.set(r, digits.length); r *= 10n; digits += (r / d).toString(); r %= d; if (digits.length > 90) return null; }
    if (r === 0n) return null; // 有限小数
    const st = seen.get(r);
    const pre = digits.slice(0, st), rep = digits.slice(st);
    if (ip.toString().length + digits.length + 4 > 99) return null;
    const html = tk((neg ? '−' : '') + ip + '.' + pre) + '<span class="recur">' + tk(rep) + '</span>';
    return { html, text: '' };
  }

  function fmtComplex(z, s, mode) {
    const polar = mode.fmt === 'polar' || (mode.fmt !== 'rect' && s.complex === 'polar');
    if (polar) {
      const r = C.V.cx.abs(z); const th = C.polarArg(z, { angle: s.angle });
      const rh = fmtReal(r, s, mode), thh = fmtReal(th, s, mode);
      return { html: rh.html + tk('∠') + thh.html, text: rh.text + '∠' + thh.text };
    }
    let h = '';
    const reZ = E.isZero(z.re) || (typeof z.re === 'number' && Math.abs(z.re) < 1e-14 * Math.abs(E.toNum(z.im)));
    if (!reZ) h += fmtReal(z.re, s, mode).html;
    const im = z.im; const sg = E.sign(im);
    if (sg !== 0) {
      const absIm = sg < 0 ? E.neg(im) : im;
      const one = E.isRat(absIm) && E.ratOf(absIm)[0] === E.ratOf(absIm)[1];
      if (sg < 0) h += tk('−'); else if (!reZ) h += tk('+');
      if (!one) h += fmtReal(absIm, s, mode).html;
      h += '<span class="tk ital">i</span>';
    }
    if (!h) h = tk('0');
    return { html: h, text: '' };
  }

  // 値 -> 表示HTML
  function fmtValue(v, s, mode) {
    mode = mode || {};
    if (v === undefined || v === null) return { html: '', text: '' };
    if (V.isReal(v)) {
      const f = mode.fmt;
      if (f === 'sexa') { const r = fmtSexa(v, s); if (r) return r; }
      if (f === 'prime') { const r = primeFactor(v); if (r) return r; }
      if (f === 'recur') { const r = recurring(v, s); if (r) return r; }
      if (f === 'base') {
        const t = baseStr(v, mode.base || 'dec');
        if (mode.base === 'bin') { const g = t.split(' '); return { html: '<span class="list"><span class="li">' + tk(g.slice(0, 4).join(' ')) + '</span><span class="li">' + tk(g.slice(4).join(' ')) + '</span></span>', text: t }; }
        return { html: tk(t), text: t };
      }
      return fmtReal(v, s, mode);
    }
    if (V.isCx(v)) return fmtComplex(v, s, mode);
    if (V.isMat(v)) {
      let h = '<span class="mat"><span class="mtab">';
      for (const row of v.a) { h += '<span class="mrow">'; for (const e of row) h += '<span class="mcell">' + fmtReal(e, s, mode).html + '</span>'; h += '</span>'; }
      return { html: h + '</span></span>', text: '' };
    }
    if (V.isVec(v)) {
      let h = '<span class="vec">' + tk('['); v.a.forEach((e, i) => { if (i) h += tk(s.decMark === ',' ? ';' : ','); h += fmtReal(e, s, mode).html; }); return { html: h + tk(']') + '</span>', text: '' };
    }
    if (v.k === 'list') {
      const parts = v.items.map(([l, x]) => '<span class="li">' + tk(l + '=') + fmtValue(x, s, mode).html + '</span>');
      return { html: '<span class="list">' + parts.join('') + '</span>', text: '' };
    }
    if (v.k === 'divR') return { html: '<span class="list"><span class="li">' + tk('Q=') + fmtValue(v.q, s, mode).html + '</span><span class="li">' + tk('R=') + fmtValue(v.r, s, mode).html + '</span></span>', text: '' };
    if (v.k === 'bool') return { html: '<span class="tk verify">' + (v.v ? '正しい' : '誤り') + '</span>', text: '' };
    return { html: '', text: '' };
  }

  function baseStr(v, base) {
    let x = E.bigOf(v);
    if (base === 'dec') return x.toString();
    if (x < 0n) x += 4294967296n;
    const radix = { hex: 16, bin: 2, oct: 8 }[base];
    const len = { hex: 8, bin: 32, oct: 11 }[base];
    let t = x.toString(radix).toUpperCase().padStart(len, '0');
    if (base === 'bin') t = t.replace(/(.{4})(?=.)/g, '$1 ');
    return t;
  }

  // Rnd 関数用
  C.roundForDisplay = function (x, s) {
    const v = E.toNum(x);
    if (s.numFmt.type === 'fix') { const f = Math.pow(10, s.numFmt.n); return E.isRat(x) ? E.fromDecimal(v.toFixed(s.numFmt.n)) : Math.round(v * f) / f; }
    if (s.numFmt.type === 'sci') return Number(v.toPrecision(s.numFmt.n || 10));
    if (E.isRat(x)) return x;
    return Number(v.toPrecision(10));
  };

  // FORMAT メニューに出す項目の判定
  C.formatOptions = function (v, s) {
    const out = [];
    if (V.isReal(v)) {
      out.push(['std', '標準']);
      out.push(['dec', '小数']);
      if (E.isRat(v) && E.ratOf(v)[1] !== 1n) { out.push(['improper', '仮分数']); out.push(['mixed', '帯分数']); }
      out.push(['eng', 'ENG表記']);
      if (primeFactor(v)) out.push(['prime', '素因数分解']);
      out.push(['sexa', '60進数']);
      if (recurring(v, s)) out.push(['recur', '循環小数']);
    } else if (V.isCx(v)) {
      out.push(['std', '標準']); out.push(['dec', '小数']); out.push(['rect', '直交座標形式']); out.push(['polar', '極座標形式']);
    } else if (V.isMat(v) || V.isVec(v)) { out.push(['std', '標準']); out.push(['dec', '小数']); }
    return out;
  };

  C.fmtValue = fmtValue; C.fmtReal = fmtReal; C.fmtFloat = fmtFloat; C.baseStr = baseStr; C.decStr = decStr;
  // 簡易テキスト化（表計算・表などの狭いセル用）
  C.shortText = function (v, s, width) {
    width = width || 10;
    if (V.isReal(v)) {
      const x = E.toNum(v);
      if (x === 0) return '0';
      let t = Number(x.toPrecision(width - 1)).toString();
      const ax = Math.abs(x);
      if (t.length > width && ax >= 1e-3 && ax < Math.pow(10, width - 1)) {
        for (let p = width - 1; p >= 1 && t.length > width; p--) t = Number(x.toPrecision(p)).toString();
      }
      if (t.length > width || t.includes('e')) {
        let p = width - 5; let m;
        do { m = x.toExponential(Math.max(0, p)).replace(/\.?0+e/, 'e').replace('e+', 'ᴇ').replace('e-', 'ᴇ-'); p--; } while (m.length > width && p >= 0);
        t = m;
      }
      if (s && s.decMark === ',') t = t.replace('.', ',');
      return t;
    }
    if (V.isCx(v)) return 'Complex';
    return '?';
  };
})(window.C = window.C || {});
