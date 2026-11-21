/* 評価器: AST -> 値 */
(function (C) {
  'use strict';
  const E = C.E, V = C.V, B = BigInt;
  const Err = (c) => new C.CalcError(c);
  const Q = E.Q;
  const num = E.toNum;

  // ---- 角度 ----
  function toDegExact(x, unit) { // 度に換算した厳密有理数 [n,d] or null
    if (unit === 'deg' && E.isRat(x)) return E.ratOf(x);
    if (unit === 'rad' && E.isE(x) && x.k === 'p') return E.normQ(x.n * 180n, x.d);
    if (unit === 'rad' && E.isZero(x)) return [0n, 1n];
    if (unit === 'gra' && E.isRat(x)) { const [n, d] = E.ratOf(x); return E.normQ(n * 9n, d * 10n); }
    return null;
  }
  function toRad(x, unit) { const v = num(x); return unit === 'deg' ? v * Math.PI / 180 : unit === 'gra' ? v * Math.PI / 200 : v; }
  function fromDeg(degQ, unit) { // 有理数の度 -> 現在単位の値
    const [n, d] = degQ;
    if (unit === 'deg') return Q(n, d);
    if (unit === 'rad') return E.PI(n, d * 180n);
    return Q(n * 10n, d * 9n);
  }
  function fromRad(r, unit) { return unit === 'deg' ? r * 180 / Math.PI : unit === 'gra' ? r * 200 / Math.PI : r; }

  const S2 = () => E.mkS([[1n, 2n, 2n]]), S3 = () => E.mkS([[1n, 2n, 3n]]);
  function sinTab(k) { // k*15°, 0<=k<=6
    switch (k) {
      case 0: return Q(0);
      case 1: return E.mkS([[1n, 4n, 6n], [-1n, 4n, 2n]]);
      case 2: return Q(1, 2);
      case 3: return S2();
      case 4: return S3();
      case 5: return E.mkS([[1n, 4n, 6n], [1n, 4n, 2n]]);
      case 6: return Q(1);
    }
  }
  function sinDegExact(dq) {
    const [n, d] = dq;
    if (d !== 1n || n % 15n !== 0n) return null;
    let k = Number(((n / 15n) % 24n + 24n) % 24n); // 0..23
    let sgn = 1;
    if (k >= 12) { k -= 12; sgn = -1; }
    if (k > 6) k = 12 - k;
    const v = sinTab(k);
    return sgn < 0 ? E.neg(v) : v;
  }
  function trigRangeCheck(x, unit) {
    const v = Math.abs(num(x));
    if ((unit === 'deg' && v >= 9e9) || (unit === 'rad' && v >= 157079632.7) || (unit === 'gra' && v >= 1e10)) throw Err('Math');
  }
  function sinF(x, ctx) {
    const u = ctx.angle; trigRangeCheck(x, u);
    const dq = toDegExact(x, u); if (dq) { const r = sinDegExact(dq); if (r) return r; }
    return Math.sin(toRad(x, u));
  }
  function cosF(x, ctx) {
    const u = ctx.angle; trigRangeCheck(x, u);
    const dq = toDegExact(x, u); if (dq) { const r = sinDegExact([dq[0] + 90n * dq[1], dq[1]]); if (r) return r; }
    return Math.cos(toRad(x, u));
  }
  function tanF(x, ctx) {
    const u = ctx.angle; trigRangeCheck(x, u);
    const dq = toDegExact(x, u);
    if (dq) {
      const s = sinDegExact(dq), c = sinDegExact([dq[0] + 90n * dq[1], dq[1]]);
      if (s && c) { if (E.isZero(c)) throw Err('Math'); return E.div(s, c); }
    }
    const r = toRad(x, u); const c = Math.cos(r);
    if (Math.abs(c) < 1e-15) throw Err('Math');
    return Math.tan(r);
  }
  // 逆三角関数（厳密値）
  const ASIN_TAB = [[0, 0], [1 / 2, 30], [Math.SQRT1_2, 45], [Math.sqrt(3) / 2, 60], [1, 90], [(Math.sqrt(6) - Math.sqrt(2)) / 4, 15], [(Math.sqrt(6) + Math.sqrt(2)) / 4, 75]];
  const ATAN_TAB = [[0, 0], [1 / Math.sqrt(3), 30], [1, 45], [Math.sqrt(3), 60], [2 - Math.sqrt(3), 15], [2 + Math.sqrt(3), 75]];
  function exactAngle(x, tab) {
    if (!E.isE(x)) return null;
    const v = num(x), a = Math.abs(v);
    for (const [val, deg] of tab) if (Math.abs(a - val) < 1e-13) return v < 0 ? -deg : deg;
    return null;
  }
  function asinF(x, ctx) {
    const v = num(x); if (Math.abs(v) > 1 + 1e-15) throw Err('Math');
    const d = exactAngle(x, ASIN_TAB); if (d !== null) return fromDeg([B(d), 1n], ctx.angle);
    return fromRad(Math.asin(Math.max(-1, Math.min(1, v))), ctx.angle);
  }
  function acosF(x, ctx) {
    const v = num(x); if (Math.abs(v) > 1 + 1e-15) throw Err('Math');
    const d = exactAngle(x, ASIN_TAB); if (d !== null) return fromDeg([B(90 - d), 1n], ctx.angle);
    return fromRad(Math.acos(Math.max(-1, Math.min(1, v))), ctx.angle);
  }
  function atanF(x, ctx) {
    const d = exactAngle(x, ATAN_TAB); if (d !== null) return fromDeg([B(d), 1n], ctx.angle);
    return fromRad(Math.atan(num(x)), ctx.angle);
  }

  // ---- 整数関数 ----
  function needInt(x) { if (!V.isReal(x) || !E.isInt(x)) throw Err('Math'); return E.bigOf(x); }
  function fact(x) {
    const n = needInt(x); if (n < 0n || n > 69n) throw Err('Math');
    let r = 1n; for (let i = 2n; i <= n; i++) r *= i; return Q(r);
  }
  function nPr(a, b) {
    const n = needInt(a), r = needInt(b); if (n < 0n || r < 0n || r > n || n >= 10n ** 10n) throw Err('Math');
    let v = 1n; for (let i = 0n; i < r; i++) { v *= (n - i); if (v >= 10n ** 100n) throw Err('Math'); } return Q(v);
  }
  function nCr(a, b) {
    const n = needInt(a); let r = needInt(b); if (n < 0n || r < 0n || r > n || n >= 10n ** 10n) throw Err('Math');
    if (r > n - r) r = n - r; let v = 1n; for (let i = 0n; i < r; i++) { v = v * (n - i) / (i + 1n); if (v >= 10n ** 100n) throw Err('Math'); } return Q(v);
  }

  // ---- べき乗 ----
  function intRoot(n, k) { // n>=0 BigInt, k-th root exact or null
    if (n < 2n) return n;
    let x = B(Math.round(Math.pow(Number(n), 1 / Number(k))));
    for (const c of [x - 1n, x, x + 1n]) if (c >= 0n && c ** k === n) return c;
    return null;
  }
  function powV(a, b, ctx) {
    if (V.isMat(a)) { if (!E.isInt(b)) throw Err('Argument'); const k = Number(E.bigOf(b)); if (k === -1) return V.inverse(a); if (k < 0) throw Err('Math'); return V.matPow(a, k); }
    if (V.isCx(a) || V.isCx(b)) return cpow(V.cplx(a), V.cplx(b), ctx);
    a = V.realOnly(a); b = V.realOnly(b);
    if (E.isInt(b) && E.isE(b)) {
      if (E.isZero(a) && E.sign(b) <= 0) throw Err('Math');
      return V.R(E.powInt(a, E.bigOf(b)));
    }
    const av = num(a), bv = num(b);
    // 有理数乗の厳密計算
    if (E.isRat(b) && E.isRat(a)) {
      const [p, q] = E.ratOf(b); const [an, ad] = E.ratOf(a);
      if (q <= 10n) {
        let neg = an < 0n;
        if (neg && q % 2n === 0n) { if (ctx.mode === 'cplx') return cpow(V.cplx(a), V.cplx(b), ctx); throw Err('Math'); }
        const rn = intRoot(E.babs(an), q), rd = intRoot(ad, q);
        if (rn !== null && rd !== null) { let base = Q(neg ? -rn : rn, rd); return V.R(E.powInt(base, p)); }
        if (q === 2n && !neg) return V.R(E.powInt(E.sqrt(a), p));
        if (neg) { const r = Math.pow(-av, bv); return V.R((p % 2n !== 0n) ? -r : r); }
      }
    }
    if (av < 0) {
      // 負の底: 指数が奇数分母の有理数なら可
      const g = E.guessRational(bv, 1000);
      if (g && g[1] % 2 === 1) { const r = Math.pow(-av, bv); return V.R(g[0] % 2 !== 0 ? -r : r); }
      if (ctx.mode === 'cplx') return cpow(V.cplx(a), V.cplx(b), ctx);
      throw Err('Math');
    }
    if (av === 0 && bv <= 0) throw Err('Math');
    return V.R(Math.pow(av, bv));
  }
  function cpow(a, b, ctx) {
    if (E.isZero(b.im) && E.isInt(b.re)) {
      const k = E.bigOf(b.re);
      if (E.babs(k) > 10n ** 10n) throw Err('Math');
      if (E.babs(k) <= 64n) {
        let res = V.cplx(Q(1)), base = a, e = E.babs(k);
        while (e > 0n) { if (e & 1n) res = V.cplx(V.cx.mul(res, base)); e >>= 1n; if (e) base = V.cplx(V.cx.mul(base, base)); }
        return k < 0n ? V.cx.div(V.cplx(Q(1)), res) : V.mkC(res.re, res.im);
      }
    }
    const r = num(V.cx.abs(a)), th = V.cx.arg(a);
    if (r === 0) { return Q(0); }
    const lr = Math.log(r), br = num(b.re), bi = num(b.im);
    const mag = Math.exp(br * lr - bi * th), ang = bi * lr + br * th;
    return V.mkC(clean(mag * Math.cos(ang)), clean(mag * Math.sin(ang)));
  }
  function clean(v) { return Math.abs(v) < 1e-14 ? 0 : v; }
  function sqrtV(a, ctx) {
    if (V.isCx(a)) return cpow(a, V.cplx(Q(1, 2)), ctx);
    a = V.realOnly(a);
    if (E.sign(a) < 0) {
      if (ctx.mode === 'cplx') { const r = E.sqrt(E.neg(a)); return V.mkC(Q(0), r); }
      throw Err('Math');
    }
    return V.R(E.sqrt(a));
  }

  // ---- 対数 ----
  function logb(base, x) {
    base = V.realOnly(base); x = V.realOnly(x);
    const bv = num(base), xv = num(x);
    if (bv <= 0 || bv === 1 || xv <= 0) throw Err('Math');
    if (E.isRat(base) && E.isRat(x)) {
      const k = Math.round(Math.log(xv) / Math.log(bv));
      if (Math.abs(k) < 400 && E.cmp(E.powInt(base, B(k)), x) === 0 && E.isRat(E.powInt(base, B(k)))) { const t = E.powInt(base, B(k)); if (JSON.stringify(t, rep) === JSON.stringify(x, rep)) return Q(k); }
      // x^m = base -> 1/m
      const m = Math.round(Math.log(bv) / Math.log(xv));
      if (m !== 0 && Math.abs(m) < 400) { const t = E.powInt(x, B(m)); if (JSON.stringify(t, rep) === JSON.stringify(base, rep)) return Q(1, m); }
    }
    return V.R(Math.log(xv) / Math.log(bv));
  }
  function rep(k, v) { return typeof v === 'bigint' ? v.toString() : v; }

  // ---- 数値積分 (Gauss–Kronrod 7-15 適応) ----
  const GK = {
    xk: [0.991455371120812639, 0.949107912342758525, 0.864864423359769073, 0.741531185599394440, 0.586087235467691130, 0.405845151377397167, 0.207784955007898468, 0],
    wk: [0.022935322010529225, 0.063092092629978553, 0.104790010322250184, 0.140653259715525919, 0.169004726639267903, 0.190350578064785410, 0.204432940075298892, 0.209482141084727828],
    wg: [0.129484966168869693, 0.279705391489276668, 0.381830050505118945, 0.417959183673469388],
  };
  function gk15(f, a, b) {
    const c = (a + b) / 2, h = (b - a) / 2;
    let rk = GK.wk[7] * f(c), rg = GK.wg[3] * f(c);
    for (let j = 0; j < 7; j++) {
      const x = h * GK.xk[j]; const f1 = f(c - x), f2 = f(c + x);
      rk += GK.wk[j] * (f1 + f2);
      if (j % 2 === 1) rg += GK.wg[(j - 1) / 2] * (f1 + f2);
    }
    return [rk * h, Math.abs((rk - rg) * h)];
  }
  function integrate(f, a, b, tol) {
    let sign = 1; if (a > b) { [a, b] = [b, a]; sign = -1; }
    if (a === b) return 0;
    let stack = [[a, b]], total = 0, count = 0;
    const segs = [];
    while (stack.length) {
      const [lo, hi] = stack.pop();
      const [v, err] = gk15(f, lo, hi);
      count++;
      if (count > 2000) throw Err('TimeOut');
      if (err <= Math.max(tol * Math.abs(v), tol * 1e-3) || hi - lo < 1e-12 * Math.max(1, Math.abs(lo))) total += v;
      else { const m = (lo + hi) / 2; stack.push([lo, m], [m, hi]); }
      if (!Number.isFinite(v)) throw Err('Math');
    }
    return sign * total;
  }
  function derivative(f, a, tol) {
    // Ridders 法
    let h = Math.max(Math.abs(a) * 1e-2, 1e-2);
    const NTAB = 10, CON = 1.4, CON2 = CON * CON;
    const tab = [];
    let ans = NaN, err = Infinity;
    tab[0] = [(f(a + h) - f(a - h)) / (2 * h)];
    for (let i = 1; i < NTAB; i++) {
      h /= CON; tab[i] = [(f(a + h) - f(a - h)) / (2 * h)];
      let fac = CON2;
      for (let j = 1; j <= i; j++) {
        tab[i][j] = (tab[i][j - 1] * fac - tab[i - 1][j - 1]) / (fac - 1); fac *= CON2;
        const e = Math.max(Math.abs(tab[i][j] - tab[i][j - 1]), Math.abs(tab[i][j] - tab[i - 1][j - 1]));
        if (e <= err) { err = e; ans = tab[i][j]; }
      }
      if (Math.abs(tab[i][i] - tab[i - 1][i - 1]) >= 2 * err) break;
    }
    if (!Number.isFinite(ans)) throw Err('Math');
    if (err > Math.max(1e-6, (tol || 1e-10) * 1e4) * Math.max(1, Math.abs(ans))) throw Err('TimeOut');
    return ans;
  }

  // ---- 正規分布 ----
  function erf(x) { // 高精度 erf
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? y : -y;
  }
  function normCdf(z) { // Φ(z) 高精度（連分数/級数）
    if (z < -38) return 0; if (z > 38) return 1;
    const a = Math.abs(z);
    let p;
    if (a < 3) { // 級数展開
      let sum = a, term = a; const a2 = a * a;
      for (let n = 1; n < 200; n++) { term *= a2 / (2 * n + 1); sum += term; if (term < 1e-17 * sum) break; }
      p = 0.5 + sum * Math.exp(-a2 / 2) / Math.sqrt(2 * Math.PI);
      return z >= 0 ? p : 1 - p;
    }
    // 連分数（上側確率）
    let f = 0; for (let n = 60; n >= 1; n--) f = n / (a + f);
    const q = Math.exp(-a * a / 2) / Math.sqrt(2 * Math.PI) / (a + f);
    return z >= 0 ? 1 - q : q;
  }
  C.normCdf = normCdf; C.erf = erf;

  // ---- 評価 ----
  function ev(n, ctx) {
    ctx.depth = (ctx.depth || 0) + 1;
    if (ctx.depth > 200) throw Err('Stack');
    try { return ev2(n, ctx); } finally { ctx.depth--; }
  }

  function numLit(n, ctx) {
    if (ctx.mode === 'base') {
      const radix = n.base ? { d: 10, h: 16, b: 2, o: 8 }[n.base] : ({ dec: 10, hex: 16, bin: 2, oct: 8 }[ctx.base] || 10);
      const s = n.s;
      if (/[.E]/.test(s)) throw Err('Syntax');
      const valid = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9A-F]+$/ }[radix];
      if (!valid.test(s)) throw Err('Syntax');
      let v = 0n; for (const ch of s) v = v * B(radix) + B(parseInt(ch, 16));
      if (radix === 10) { if (v > 2147483647n) throw Err('Math'); }
      else { if (v >= 4294967296n) throw Err('Math'); if (v >= 2147483648n) v -= 4294967296n; }
      return Q(v);
    }
    if (n.recur) {
      const [ip, fp] = n.s.split('.');
      const r = n.recur, k = (fp || '').length;
      // x = ip.fp + 0.(fp_len zeros)rrrr...
      const base = E.fromDecimal(n.s.endsWith('.') ? n.s + '0' : n.s);
      const rep = Q(B(r), (10n ** B(r.length) - 1n) * 10n ** B(k));
      return E.add(base, rep);
    }
    if (n.hex) throw Err('Syntax');
    return V.R(E.fromDecimal(n.s));
  }
  function base32(v) { // 基数計算での切り捨てと範囲チェック
    if (!V.isReal(v)) throw Err('Math');
    let x;
    if (E.isRat(v)) { const [p, q] = E.ratOf(v); x = p / q; } else x = B(Math.trunc(num(v)));
    if (x > 2147483647n || x < -2147483648n) throw Err('Math');
    return Q(x);
  }
  function u32(v) { let x = E.bigOf(v); if (x < 0n) x += 4294967296n; return x; }
  function s32(x) { x &= 0xFFFFFFFFn; if (x >= 2147483648n) x -= 4294967296n; return Q(x); }

  function bin(op, a, b, ctx, node) {
    switch (op) {
      case '+': return V.add(a, b);
      case '-': return V.sub(a, b);
      case '*': case 'imp':
        if (V.isVec(a) && V.isVec(b) && op === 'imp') throw Err('Syntax');
        return V.mul(a, b);
      case '/': return V.div(a, b);
      case 'dot': return V.dot(a, b);
      case 'nPr': return nPr(a, b);
      case 'nCr': return nCr(a, b);
      case '∠': { // 極形式 r∠θ
        a = V.realOnly(a); b = V.realOnly(b);
        const c = cosF(b, ctx), s = sinF(b, ctx);
        return V.mkC(V.R(E.mul(a, c)), V.R(E.mul(a, s)));
      }
      case 'divR': {
        if (V.isReal(a) && V.isReal(b) && E.isInt(a) && E.isInt(b)) {
          const x = E.bigOf(a), y = E.bigOf(b);
          if (x > 0n && y > 0n && x < 10n ** 10n && y < 10n ** 10n) return { k: 'divR', q: Q(x / y), r: Q(x % y) };
        }
        return V.div(a, b);
      }
      case 'and': return s32(u32(a) & u32(b));
      case 'or': return s32(u32(a) | u32(b));
      case 'xor': return s32(u32(a) ^ u32(b));
      case 'xnor': return s32(~(u32(a) ^ u32(b)));
    }
    throw Err('Syntax');
  }

  function rel(op, a, b) {
    const d = num(V.realOnly(V.sub(a, b)));
    const tol = 1e-10 * Math.max(1, Math.abs(num(a)), Math.abs(num(b)));
    const eq = Math.abs(d) <= tol;
    switch (op) {
      case '=': return eq; case '≠': return !eq;
      case '<': return !eq && d < 0; case '>': return !eq && d > 0;
      case '≤': return eq || d < 0; case '≥': return eq || d > 0;
    }
  }

  function withX(ctx, val, fn) {
    const old = ctx.vars.x; ctx.vars.x = val;
    try { return fn(); } finally { ctx.vars.x = old; }
  }

  function callFn(f, args, ctx) {
    const A = () => args.map((a) => ev(a, ctx));
    const one = () => { if (args.length !== 1) throw Err(args.length ? 'Syntax' : 'Syntax'); return ev(args[0], ctx); };
    const realArg = () => V.realOnly(one());
    switch (f) {
      case 'sin': return trigC(one(), ctx, sinF, 'sin');
      case 'cos': return trigC(one(), ctx, cosF, 'cos');
      case 'tan': return trigC(one(), ctx, tanF, 'tan');
      case 'asin': return asinF(realArg(), ctx);
      case 'acos': return acosF(realArg(), ctx);
      case 'atan': return atanF(realArg(), ctx);
      case 'sinh': { const v = num(realArg()); if (Math.abs(v) > 230.2585092) throw Err('Math'); return V.R(Math.sinh(v)); }
      case 'cosh': { const v = num(realArg()); if (Math.abs(v) > 230.2585092) throw Err('Math'); return V.R(Math.cosh(v)); }
      case 'tanh': return V.R(Math.tanh(num(realArg())));
      case 'asinh': return V.R(Math.asinh(num(realArg())));
      case 'acosh': { const v = num(realArg()); if (v < 1) throw Err('Math'); return V.R(Math.acosh(v)); }
      case 'atanh': { const v = num(realArg()); if (Math.abs(v) >= 1) throw Err('Math'); return V.R(Math.atanh(v)); }
      case 'log': {
        if (args.length === 2) { const [b, x] = A(); return logb(b, x); }
        const x = one(); if (V.isCx(x)) return clog(x, Math.LN10);
        return logb(Q(10), x);
      }
      case 'ln': {
        const x = one(); if (V.isCx(x)) return clog(x, 1);
        const v = num(V.realOnly(x)); if (v <= 0) { if (ctx.mode === 'cplx' && v < 0) return clog(V.cplx(x), 1); throw Err('Math'); }
        if (E.isRat(x) && v === 1) return Q(0);
        return V.R(Math.log(v));
      }
      case 'e^': return expV(one(), ctx);
      case '10^': return powV(Q(10), one(), ctx);
      case '√': return sqrtV(one(), ctx);
      case '∛': return powV(one(), Q(1, 3), ctx);
      case 'Abs': {
        const x = one();
        if (V.isCx(x)) return V.cx.abs(x);
        if (V.isMat(x)) return V.mkM(x.a.map((r) => r.map((v) => (E.sign(v) < 0 ? E.neg(v) : v))));
        if (V.isVec(x)) return V.R(E.sqrt(x.a.reduce((s, v) => E.add(s, E.mul(v, v)), Q(0))));
        return E.sign(x) < 0 ? E.neg(x) : x;
      }
      case 'Pol': {
        if (args.length !== 2) throw Err('Syntax');
        const [x, y] = A().map(V.realOnly);
        const r = V.R(E.sqrt(E.add(E.mul(x, x), E.mul(y, y))));
        let th;
        if (E.isZero(x) && E.isZero(y)) th = Q(0);
        else {
          const xv = num(x), yv = num(y);
          if (E.isE(x) && E.isE(y) && xv !== 0) {
            const t = E.div(y, x); const d = exactAngle(t, ATAN_TAB);
            if (d !== null) { let deg = d; if (xv < 0) deg += yv >= 0 ? 180 : -180; th = fromDeg([B(deg), 1n], ctx.angle); }
          } else if (xv === 0 && E.isE(y)) th = fromDeg([yv > 0 ? 90n : -90n, 1n], ctx.angle);
          if (th === undefined) th = V.R(fromRad(Math.atan2(yv, xv), ctx.angle));
        }
        ctx.vars.x = r; ctx.vars.y = th;
        return { k: 'list', items: [['r', r], ['θ', th]] };
      }
      case 'Rec': {
        if (args.length !== 2) throw Err('Syntax');
        const [r, th] = A().map(V.realOnly);
        const x = V.R(E.mul(r, cosF(th, ctx))), y = V.R(E.mul(r, sinF(th, ctx)));
        ctx.vars.x = x; ctx.vars.y = y;
        return { k: 'list', items: [['x', x], ['y', y]] };
      }
      case 'Int': { const x = realArg(); if (E.isRat(x)) { const [n, d] = E.ratOf(x); return Q(n / d); } return Math.trunc(num(x)); }
      case 'Intg': { const x = realArg(); if (E.isRat(x)) { const [n, d] = E.ratOf(x); let q = n / d; if (n % d !== 0n && n < 0n) q -= 1n; return Q(q); } return Math.floor(num(x)); }
      case 'Rnd': { const x = realArg(); return C.roundForDisplay(x, ctx.settings); }
      case 'GCD': case 'LCM': {
        if (args.length < 2) throw Err('Syntax');
        const vs = A().map(needInt);
        for (const v of vs) if (E.babs(v) >= 10n ** 10n) throw Err('Math');
        let r = vs[0];
        for (let i = 1; i < vs.length; i++) r = f === 'GCD' ? E.gcd(r, vs[i]) : (r === 0n || vs[i] === 0n ? 0n : E.babs(r * vs[i]) / E.gcd(r, vs[i]));
        if (f === 'LCM') for (const v of vs) if (v < 0n) throw Err('Math');
        return Q(r);
      }
      case 'RanInt#': {
        if (args.length !== 2) throw Err('Syntax');
        const [a, b] = A().map(needInt);
        if (a >= b) throw Err('Math');
        return Q(a + B(Math.floor(Math.random() * Number(b - a + 1n))));
      }
      case 'Conjg': { const x = one(); return V.isCx(x) ? V.cx.conj(x) : x; }
      case 'Arg': { const x = V.cplx(one()); if (E.isZero(x.re) && E.isZero(x.im)) return Q(0); const pr = polarArg(x, ctx); return pr; }
      case 'ReP': { const x = one(); return V.isCx(x) ? x.re : x; }
      case 'ImP': { const x = one(); return V.isCx(x) ? x.im : Q(0); }
      case 'Det': { const m = one(); if (!V.isMat(m)) throw Err('Argument'); return V.det(m); }
      case 'Trn': { const m = one(); if (!V.isMat(m)) throw Err('Argument'); return V.trn(m); }
      case 'Identity': return V.ident(realArg());
      case 'Ref': { const m = one(); if (!V.isMat(m)) throw Err('Argument'); return V.ref(m, false); }
      case 'Rref': { const m = one(); if (!V.isMat(m)) throw Err('Argument'); return V.ref(m, true); }
      case 'UnitV': {
        const v = one(); if (!V.isVec(v)) throw Err('Argument');
        const n2 = v.a.reduce((s, x) => E.add(s, E.mul(x, x)), Q(0)); if (E.isZero(n2)) throw Err('Math');
        const nn = E.sqrt(n2); return V.mkV(v.a.map((x) => V.R(E.div(x, nn))));
      }
      case 'Angle': {
        if (args.length !== 2) throw Err('Syntax');
        const [a, b] = A(); if (!V.isVec(a) || !V.isVec(b)) throw Err('Argument');
        const d = V.dot(a, b);
        const na = E.sqrt(a.a.reduce((s, x) => E.add(s, E.mul(x, x)), Q(0))), nb = E.sqrt(b.a.reduce((s, x) => E.add(s, E.mul(x, x)), Q(0)));
        const den = E.mul(na, nb); if (E.isZero(den) || num(den) === 0) throw Err('Math');
        let c = E.div(d, den); if (num(c) > 1) c = Q(1); if (num(c) < -1) c = Q(-1);
        return acosF(c, ctx);
      }
      case 'f': case 'g': {
        const def = ctx.fdef && ctx.fdef[f];
        if (!def || !def.length) throw Err('NotDefined');
        ctx.fdepth = (ctx.fdepth || 0) + 1;
        if (ctx.fdepth > 4) { ctx.fdepth = 0; throw Err('Circular'); }
        try {
          const ast = C.parse(def, { sheet: false });
          if (args.length === 0) return ev(ast, ctx);
          const xv = one();
          return withX(ctx, xv, () => ev(ast, ctx));
        } finally { ctx.fdepth--; }
      }
      case '∫': {
        if (args.length < 3) throw Err('Syntax');
        const lo = num(V.realOnly(ev(args[1], ctx))), hi = num(V.realOnly(ev(args[2], ctx)));
        const tol = args[3] ? num(ev(args[3], ctx)) : 1e-5;
        const fn = (t) => withX(ctx, t, () => num(V.realOnly(ev(args[0], ctx))));
        return V.R(clean2(integrate(fn, lo, hi, Math.max(tol, 1e-14))));
      }
      case 'd/dx': {
        if (args.length < 2) throw Err('Syntax');
        const a = num(V.realOnly(ev(args[1], ctx)));
        const tol = args[2] ? num(ev(args[2], ctx)) : 1e-10;
        const fn = (t) => withX(ctx, t, () => num(V.realOnly(ev(args[0], ctx))));
        return V.R(clean2(derivative(fn, a, tol)));
      }
      case 'Σ': case 'Π': {
        if (args.length !== 3) throw Err('Syntax');
        const a = needInt(ev(args[1], ctx)), b = needInt(ev(args[2], ctx));
        if (a > b || E.babs(a) >= 10n ** 10n || E.babs(b) >= 10n ** 10n) throw Err('Math');
        if (b - a > 100000n) throw Err('TimeOut');
        let acc = f === 'Σ' ? Q(0) : Q(1);
        for (let k = a; k <= b; k++) {
          const v = withX(ctx, Q(k), () => ev(args[0], ctx));
          acc = f === 'Σ' ? V.add(acc, v) : V.mul(acc, v);
        }
        return acc;
      }
      case 'AtWt': {
        const n = Number(needInt(one()));
        const el = C.ELEMENTS && C.ELEMENTS[n - 1]; if (!el) throw Err('Argument');
        return V.R(E.fromDecimal(String(el.w)));
      }
      case 'P': case 'Q': case 'R': {
        const z = num(realArg()); const p = normCdf(z);
        const v = f === 'P' ? p : f === 'R' ? 1 - p : p - 0.5;
        return V.R(Number(v.toPrecision(10)));
      }
      case 'Not': return s32(~u32(one()));
      case 'Neg': return s32(-E.bigOf(one()));
      case 'Min': case 'Max': case 'Mean': case 'Sum': {
        if (!ctx.sheet) throw Err('Syntax');
        if (args.length !== 1 || args[0].t !== 'range') throw Err('Syntax');
        const vals = ctx.sheet.range(args[0].a, args[0].b);
        if (!vals.length) throw Err('Math');
        if (f === 'Sum') return vals.reduce((s, v) => V.add(s, v), Q(0));
        if (f === 'Mean') return V.div(vals.reduce((s, v) => V.add(s, v), Q(0)), Q(vals.length));
        return vals.reduce((m, v) => ((f === 'Min' ? E.cmp(v, m) < 0 : E.cmp(v, m) > 0) ? v : m));
      }
    }
    throw Err('Syntax');
  }
  function clean2(v) { return Math.abs(v) < 1e-13 ? 0 : v; }
  function trigC(x, ctx, fn, name) {
    if (V.isCx(x)) { // 複素三角関数（ラジアン）
      const a = num(x.re), b = num(x.im);
      if (name === 'sin') return V.mkC(clean(Math.sin(a) * Math.cosh(b)), clean(Math.cos(a) * Math.sinh(b)));
      if (name === 'cos') return V.mkC(clean(Math.cos(a) * Math.cosh(b)), clean(-Math.sin(a) * Math.sinh(b)));
      throw Err('Math');
    }
    return V.R(fn(V.realOnly(x), ctx));
  }
  function clog(x, div) { const r = num(V.cx.abs(x)), th = V.cx.arg(x); return V.mkC(clean(Math.log(r) / div), clean(th / div)); }
  function expV(x, ctx) {
    if (V.isCx(x)) { const m = Math.exp(num(x.re)), b = num(x.im); return V.mkC(clean(m * Math.cos(b)), clean(m * Math.sin(b))); }
    x = V.realOnly(x); const v = num(x);
    if (v > 230.2585092) throw Err('Math');
    if (E.isZero(x)) return Q(1);
    return V.R(Math.exp(v));
  }
  function polarArg(x, ctx) {
    // 厳密角度
    const re = x.re, im = x.im; const rv = num(re), iv = num(im);
    if (E.isZero(re)) return fromDeg([iv > 0 ? 90n : -90n, 1n], ctx.angle);
    if (E.isZero(im)) return rv > 0 ? Q(0) : fromDeg([180n, 1n], ctx.angle);
    if (E.isE(re) && E.isE(im)) {
      const d = exactAngle(E.div(im, re), ATAN_TAB);
      if (d !== null) { let deg = d; if (rv < 0) deg += iv >= 0 ? 180 : -180; return fromDeg([B(deg), 1n], ctx.angle); }
    }
    return V.R(fromRad(Math.atan2(iv, rv), ctx.angle));
  }
  C.polarArg = polarArg;

  function post(op, a, ctx) {
    switch (op) {
      case '²': return V.isMat(a) ? V.matPow(a, 2) : powV(a, Q(2), ctx);
      case '³': return V.isMat(a) ? V.matPow(a, 3) : powV(a, Q(3), ctx);
      case '⁻¹': if (V.isMat(a)) return V.inverse(a); return V.div(Q(1), a);
      case '!': return fact(a);
      case '%': return V.div(a, Q(100));
      case '°': return convAngle(a, 'deg', ctx);
      case 'ʳ': return convAngle(a, 'rad', ctx);
      case 'ᵍ': return convAngle(a, 'gra', ctx);
      case 't': { const st = ctx.stats; if (!st) throw Err('Syntax'); return V.R((num(a) - st.val('xbar')) / st.val('sx_pop')); }
      case '▶r∠θ': ctx.flags.polar = true; return a;
      case '▶a+bi': ctx.flags.rect = true; return a;
      case 'xh': case 'yh': case 'xh1': case 'xh2': { const st = ctx.stats; if (!st) throw Err('Syntax'); return V.R(st.estimate(op, num(V.realOnly(a)))); }
      case '▶Dec': case '▶Hex': case '▶Bin': case '▶Oct': ctx.flags.base = op.slice(1).toLowerCase(); return a;
    }
    if (op.startsWith('eng:')) { const m = C.ENG_SYMBOLS[op.slice(4)]; return V.mul(a, E.fromDecimal('1E' + m)); }
    if (op.startsWith('u:')) { const u = C.UNIT_BY_KEY[op.slice(2)]; if (!u) throw Err('Syntax'); return V.R(u.fn(V.realOnly(a))); }
    throw Err('Syntax');
  }
  function convAngle(a, from, ctx) {
    a = V.realOnly(a);
    const to = ctx.angle; if (from === to) return a;
    // from -> deg -> to
    let deg;
    if (from === 'deg') deg = a; else if (from === 'rad') deg = E.isE(a) && a.k === 'p' ? Q(a.n * 180n, a.d) : num(a) * 180 / Math.PI; else deg = E.mul(a, Q(9, 10));
    if (to === 'deg') return V.R(deg);
    if (to === 'gra') return V.R(E.mul(deg, Q(10, 9)));
    if (E.isRat(deg)) { const [n, d] = E.ratOf(deg); return E.PI(n, d * 180n); }
    return V.R(num(deg) * Math.PI / 180);
  }

  function ev2(n, ctx) {
    switch (n.t) {
      case 'num': return numLit(n, ctx);
      case 'paren': return ev(n.a, ctx);
      case 'var': { const v = ctx.vars[n.n]; return v === undefined ? Q(0) : v; }
      case 'atom': {
        switch (n.n) {
          case 'π': return E.PI(1);
          case 'e': return Math.E;
          case 'i': if (ctx.mode !== 'cplx' && !ctx.allowI) throw Err('Syntax'); return V.mkC(Q(0), Q(1));
          case 'Ran#': return Q(Math.floor(Math.random() * 1000), 1000);
          case 'Ans': return ctx.ans === undefined ? Q(0) : ctx.ans;
          case 'PreAns': return ctx.preAns === undefined ? Q(0) : ctx.preAns;
        }
        if (/^Mat/.test(n.n)) { const m = ctx.mats && ctx.mats[n.n]; if (!m) throw Err('Dimension'); return m; }
        if (/^Vct/.test(n.n)) { const m = ctx.vecs && ctx.vecs[n.n]; if (!m) throw Err('Dimension'); return m; }
        throw Err('Syntax');
      }
      case 'const': { const c = C.CONST_BY_KEY[n.n]; if (!c) throw Err('Syntax'); return c.v; }
      case 'statvar': { if (!ctx.stats) throw Err('Syntax'); return ctx.stats.get(n.n); }
      case 'un': {
        const a = ev(n.a, ctx);
        if (ctx.mode === 'base') return base32(V.neg(a));
        return V.neg(a);
      }
      case 'bin': {
        const a = ev(n.a, ctx), b = ev(n.b, ctx);
        if (V.isList(a) || V.isList(b) || (a && a.k === 'divR') || (b && b.k === 'divR')) throw Err('Syntax');
        if (ctx.mode === 'base' && !['and', 'or', 'xor', 'xnor'].includes(n.op)) {
          if (n.op === '/' && E.isZero(b)) throw Err('Math');
          return base32(bin(n.op, a, b, ctx, n));
        }
        if (['and', 'or', 'xor', 'xnor'].includes(n.op) && ctx.mode !== 'base') throw Err('Syntax');
        return bin(n.op, a, b, ctx, n);
      }
      case 'rel': {
        const vals = n.terms.map((t) => ev(t, ctx));
        let ok = true;
        for (let i = 0; i < n.ops.length; i++) {
          const a = vals[i], b = vals[i + 1];
          if (V.isCx(a) || V.isCx(b)) { if (n.ops[i] !== '=' && n.ops[i] !== '≠') throw Err('Math'); const d = V.sub(a, b); const z = Math.abs(num(V.cplx(d).re)) < 1e-10 && Math.abs(num(V.cplx(d).im)) < 1e-10; if ((n.ops[i] === '=') !== z) ok = false; continue; }
          if (!rel(n.ops[i], a, b)) ok = false;
        }
        return { k: 'bool', v: ok };
      }
      case 'post': { const a = ev(n.a, ctx); return post(n.op, a, ctx); }
      case 'pow': { const a = ev(n.a, ctx), b = ev(n.b, ctx); return powV(a, b, ctx); }
      case 'frac': {
        const a = ev(n.a, ctx), b = ev(n.b, ctx);
        if (ctx.mode === 'base') return base32(V.div(a, b));
        return V.div(a, b);
      }
      case 'mixed': {
        const w = V.realOnly(ev(n.w, ctx)), a = V.realOnly(ev(n.a, ctx)), b = V.realOnly(ev(n.b, ctx));
        const f = V.div(a, b);
        return E.sign(w) < 0 ? V.sub(w, f) : V.add(w, f);
      }
      case 'sqrt': return sqrtV(ev(n.a, ctx), ctx);
      case 'root': {
        const k = V.realOnly(ev(n.n, ctx)), a = ev(n.a, ctx);
        if (E.isZero(k)) throw Err('Math');
        return powV(a, V.div(Q(1), k), ctx);
      }
      case 'call': return callFn(n.f, n.args, ctx);
      case 'dms': {
        ctx.flags.dms = true;
        let v = V.realOnly(ev(n.d, ctx));
        if (n.m) v = V.add(v, V.div(ev(n.m, ctx), Q(60)));
        if (n.s) v = V.add(v, V.div(ev(n.s, ctx), Q(3600)));
        return v;
      }
      case 'cell': { if (!ctx.sheet) throw Err('Syntax'); return ctx.sheet.cell(n); }
      case 'range': throw Err('Syntax');
      case 'stmts': { let r; for (const s of n.list) r = ev(s, ctx); return r; }
    }
    throw Err('Syntax');
  }

  C.evaluate = function (ast, ctx) {
    ctx.flags = ctx.flags || {};
    ctx.depth = 0;
    const v = ev(ast, ctx);
    return v;
  };
  C.evalHelpers = { sinF, cosF, tanF, powV, sqrtV, fromRad, toRad, integrate, derivative, normCdf, expV, logb, fact, nCr };
})(window.C = window.C || {});
