/* 方程式・不等式・数表作成・Math Box */
(function (C) {
  'use strict';
  const G = C.G, E = C.E, V = C.V, esc = C.esc, CAT = C.CATALOG, Q = E.Q, B = BigInt;
  const num = E.toNum;
  const fv = (v) => C.fmtValue(v, G.s, {}).html;

  // ===== 多項式の求解 =====
  function horner(cs, x) { let r = Q(0); for (const c of cs) r = V.add(V.mul(r, x), c); return r; }
  function deflate(cs, r) { const out = [cs[0]]; for (let i = 1; i < cs.length - 1; i++) out.push(V.add(cs[i], V.mul(out[i - 1], r))); return out; }
  function divisors(n) {
    n = E.babs(n); if (n === 0n) return [0n]; if (n > 10n ** 12n) return null;
    const out = []; for (let i = 1n; i * i <= n; i++) if (n % i === 0n) { out.push(i); if (i * i !== n) out.push(n / i); if (out.length > 4000) return null; }
    return out;
  }
  function rationalRoots(cs) {
    // 係数がすべて有理数のとき
    if (!cs.every(E.isRat)) return [];
    let L = 1n; for (const c of cs) { const d = E.ratOf(c)[1]; L = L * d / E.gcd(L, d); }
    let ints = cs.map((c) => { const [n, d] = E.ratOf(c); return n * (L / d); });
    const roots = [];
    // x=0 の根
    while (ints.length > 1 && ints[ints.length - 1] === 0n) { roots.push(Q(0)); ints = ints.slice(0, -1); }
    const p = divisors(ints[ints.length - 1]), q = divisors(ints[0]);
    if (!p || !q || ints.length < 2) return roots;
    const cand = []; const seen = new Set();
    for (const a of p) for (const b of q) for (const s of [1n, -1n]) { const v = Q(s * a, b); const key = JSON.stringify(E.ratOf(v), (k, x) => (typeof x === 'bigint' ? x.toString() : x)); if (!seen.has(key)) { seen.add(key); cand.push(v); } }
    let cur = ints.map((x) => Q(x));
    for (const r of cand) {
      while (cur.length > 1 && E.isZero(horner(cur, r))) { roots.push(r); cur = deflate(cur, r); }
    }
    return roots;
  }
  function quadRoots(a, b, c) {
    const D = V.sub(V.mul(b, b), V.mul(Q(4), V.mul(a, c)));
    const two_a = V.mul(Q(2), a);
    const re = V.div(V.neg(b), two_a);
    if (E.sign(D) >= 0) {
      const s = V.div(E.sqrt(D), two_a);
      if (E.isZero(D)) return [re];
      const r1 = V.add(re, s), r2 = V.sub(re, s);
      return E.toNum(r1) >= E.toNum(r2) ? [r1, r2] : [r2, r1];
    }
    const im = V.div(E.sqrt(E.neg(D)), two_a); const ai = E.sign(im) < 0 ? E.neg(im) : im;
    return [V.mkC(re, ai), V.mkC(re, E.neg(ai))];
  }
  function durandKerner(cs) {
    const n = cs.length - 1; const a0 = num(cs[0]);
    const c = cs.map((x) => num(x) / a0);
    let z = Array.from({ length: n }, (_, k) => ({ re: Math.cos(2 * Math.PI * k / n + 0.4) * 1.2, im: Math.sin(2 * Math.PI * k / n + 0.4) * 1.2 }));
    const mul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
    const sub = (p, q) => ({ re: p.re - q.re, im: p.im - q.im });
    const div = (p, q) => { const d = q.re * q.re + q.im * q.im; return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d }; };
    const ev = (x) => { let r = { re: 1, im: 0 }; for (let i = 1; i <= n; i++) r = { re: r.re * x.re - r.im * x.im + c[i], im: r.re * x.im + r.im * x.re }; return r; };
    for (let it = 0; it < 500; it++) {
      let delta = 0;
      z = z.map((zi, i) => { let den = { re: 1, im: 0 }; z.forEach((zj, j) => { if (i !== j) den = mul(den, sub(zi, zj)); }); const w = div(ev(zi), den); delta = Math.max(delta, Math.hypot(w.re, w.im)); return sub(zi, w); });
      if (delta < 1e-15) break;
    }
    return z.map((r) => { const sc = Math.max(1, Math.hypot(r.re, r.im)); return Math.abs(r.im) < 1e-9 * sc ? Number(r.re.toPrecision(15)) : V.mkC(Number(r.re.toPrecision(15)), Number(r.im.toPrecision(15))); });
  }
  function solvePoly(cs) {
    // cs: 降べき順の係数
    if (E.isZero(cs[0]) || num(cs[0]) === 0) throw new C.CalcError('Math');
    let roots = rationalRoots(cs);
    let cur = cs;
    if (roots.length) { cur = cs; for (const r of roots) cur = deflate(cur, r); }
    let rest = [];
    if (cur.length === 3) rest = quadRoots(cur[0], cur[1], cur[2]);
    else if (cur.length === 2) rest = [V.div(V.neg(cur[1]), cur[0])];
    else if (cur.length > 3) rest = durandKerner(cur);
    const all = roots.concat(rest);
    // 重複除去
    const uniq = [];
    for (const r of all) {
      if (!uniq.some((u) => (V.isReal(u) && V.isReal(r) ? Math.abs(num(u) - num(r)) < 1e-9 * Math.max(1, Math.abs(num(r))) : V.isCx(u) && V.isCx(r) && Math.abs(num(u.re) - num(r.re)) < 1e-9 && Math.abs(num(u.im) - num(r.im)) < 1e-9))) uniq.push(r);
    }
    const reals = uniq.filter(V.isReal).sort((a, b) => num(b) - num(a));
    const cxs = uniq.filter(V.isCx).sort((a, b) => num(b.re) - num(a.re) || num(b.im) - num(a.im));
    return { reals, cxs };
  }
  C.solvePoly = solvePoly;

  function gaussSolve(M) { // M: n×(n+1)
    const n = M.length; const a = M.map((r) => r.slice());
    let rank = 0; const piv = [];
    for (let c = 0; c < n && rank < n; c++) {
      let p = -1; for (let r = rank; r < n; r++) if (!V.isZ(a[r][c])) { p = r; break; }
      if (p < 0) continue;
      [a[p], a[rank]] = [a[rank], a[p]];
      const pv = a[rank][c];
      for (let k = c; k <= n; k++) a[rank][k] = V.div(a[rank][k], pv);
      for (let r = 0; r < n; r++) if (r !== rank && !V.isZ(a[r][c])) { const f = a[r][c]; for (let k = c; k <= n; k++) a[r][k] = V.sub(a[r][k], V.mul(f, a[rank][k])); }
      piv.push(c); rank++;
    }
    if (rank < n) {
      for (let r = rank; r < n; r++) if (!V.isZ(a[r][n])) return { none: true };
      return { inf: true };
    }
    return { sol: a.map((r) => (V.isZ(r[n]) ? Q(0) : r[n])) };
  }
  C.gaussSolve = gaussSolve;
  C.hornerEval = horner;

  function ineqSolve(cs, op) {
    const { reals } = solvePoly(cs);
    const rs = reals.slice().sort((a, b) => num(a) - num(b));
    const pts = rs.map(num);
    const sign = (x) => { const v = num(horner(cs, x)); return Math.abs(v) < 1e-12 ? 0 : v > 0 ? 1 : -1; };
    const want = (s) => (op === '>' ? s > 0 : op === '<' ? s < 0 : op === '≥' ? s >= 0 : s <= 0);
    // 区間 (−∞,p0),(p0,p1),...,(pn,∞)
    const ivs = [];
    for (let i = 0; i <= pts.length; i++) {
      const lo = i === 0 ? -Infinity : pts[i - 1], hi = i === pts.length ? Infinity : pts[i];
      const mid = lo === -Infinity ? (hi === Infinity ? 0 : hi - 1 - Math.abs(hi)) : hi === Infinity ? lo + 1 + Math.abs(lo) : (lo + hi) / 2;
      ivs.push(want(sign(mid)));
    }
    const ptIn = rs.map(() => op === '≥' || op === '≤');
    // 連結して区間リストを作る
    const segs = []; // {lo, loIn, hi, hiIn} lo/hi: index of root or null(∞)
    let cur = null;
    for (let i = 0; i <= rs.length; i++) {
      if (ivs[i]) { if (!cur) cur = { lo: i === 0 ? null : i - 1, loIn: i === 0 ? false : ptIn[i - 1] }; }
      if (i < rs.length) {
        if (cur) {
          if (ptIn[i] && ivs[i + 1]) continue; // 点を含んで継続
          cur.hi = i; cur.hiIn = ptIn[i]; segs.push(cur); cur = null;
          if (!ivs[i] && ptIn[i]) { /* 処理済み */ }
        } else if (ptIn[i]) {
          if (ivs[i + 1]) { cur = { lo: i, loIn: true }; } else segs.push({ lo: i, hi: i, loIn: true, hiIn: true });
        }
      } else if (cur) { cur.hi = null; segs.push(cur); cur = null; }
    }
    return { rs, segs };
  }
  C.ineqSolve = ineqSolve;

  const SUBN = (n) => '₀₁₂₃₄₅'[n];
  const VNI = (n) => ({ x: '𝑥', y: '𝑦', z: '𝑧', t: '𝑡' }[n] || n);
  const dsLine = () => Object.assign({}, G.s, { io: G.s.io === 'mm' ? 'md' : G.s.io === 'll' ? 'ld' : G.s.io });

  // ===== 係数エディター（方程式・不等式） =====
  // layout: 'simul' | 'poly'; header: html（左上の小さい式）
  function coefEditor(o) {
    let r = 0, c = 0, ed = null;
    const rows = () => o.coef.length, cols = () => o.coef[0].length;
    const ov = {
      render() {
        const R = rows(), Cc = cols();
        let h = '<div class="tb">';
        if (o.layout === 'simul') {
          const cw = Math.floor(180 / Cc);
          h += '<svg class="fig" style="left:1px;top:2px" width="5" height="' + (R * 10 + 2) + '" viewBox="0 0 5 ' + (R * 10 + 2) + '"><path d="M4.5 0.5 Q2 0.5 2 3 L2 ' + (R * 5 - 2) + ' L0.5 ' + (R * 5 + 1) + ' L2 ' + (R * 5 + 4) + ' L2 ' + (R * 10 - 1) + ' Q2 ' + (R * 10 + 1.5) + ' 4.5 ' + (R * 10 + 1.5) + '" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
          for (let i = 0; i < R; i++) for (let j = 0; j < Cc; j++) {
            const x = 6 + j * cw, y = 2 + i * 10;
            const lab = j < Cc - 1 ? o.unk[j] + (j < Cc - 2 ? '+' : '=') : '';
            h += '<div class="cell' + (i === r && j === c ? ' sel' : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + (cw - (lab ? 14 : 2)) + 'px">' + esc(C.shortText(o.coef[i][j], G.s, 6)) + '</div>';
            if (lab) h += '<div class="rn" style="left:' + (x + cw - 13) + 'px;top:' + y + 'px;width:13px;text-align:left;white-space:nowrap">' + lab + '</div>';
          }
        } else {
          h += '<div class="rn ft" style="left:1px;top:1px;width:180px;text-align:left;white-space:nowrap">' + o.header + '</div>';
          const n = Cc - 1, cw = Math.floor(188 / Cc);
          for (let j = 0; j < Cc; j++) {
            const pw = n - j;
            const lab = pw > 1 ? 'x' + '⁰¹²³⁴'[pw] + '+' : pw === 1 ? 'x+' : (o.suffix || '');
            const x = 2 + j * cw;
            h += '<div class="cell' + (j === c ? ' sel' : '') + '" style="left:' + x + 'px;top:13px;width:' + (cw - (lab ? 16 : 2)) + 'px">' + esc(C.shortText(o.coef[0][j], G.s, 6)) + '</div>';
            if (lab) h += '<div class="rn" style="left:' + (x + cw - 15) + 'px;top:13px;width:16px;text-align:left;white-space:nowrap">' + lab + '</div>';
          }
        }
        if (ed) h += '<div class="edit" style="background:var(--lcd-bg)">' + ed.render(true) + '</div>';
        else h += '<div class="val">' + C.fmtValue(o.coef[r][c], dsLine(), {}).html + '</div>';
        return h + '</div>';
      },
      key(k) {
        if (ed) {
          if (k === 'exe' || k === 'ok') {
            if (!ed.isEmpty()) { try { const v = C.evaluate(C.parse(ed.root), C.mkCtx('calc')); if (!V.isReal(v)) throw new C.CalcError('Argument'); o.coef[r][c] = v; o.persist(); } catch (e) { C.showError(e); return true; } }
            ed = null; if (c < cols() - 1) c++; else if (r < rows() - 1) { r++; c = 0; } return true;
          }
          if (k === 'ac') { ed.clear(); return true; }
          if (k === 'back') { ed = null; return true; }
          C.inputKey(ed, k, {}); return true;
        }
        if (k === 'up') { r = Math.max(0, r - 1); return true; }
        if (k === 'down') { r = Math.min(rows() - 1, r + 1); return true; }
        if (k === 'left') { c = Math.max(0, c - 1); return true; }
        if (k === 'right') { c = Math.min(cols() - 1, c + 1); return true; }
        if (k === 'ac') { for (const row of o.coef) for (let j = 0; j < row.length; j++) row[j] = Q(0); o.persist(); return true; }
        if (k === 'exe' || k === 'ok') { o.solve(); return true; }
        if (k === 'back') { o.onBack(); return true; }
        if (k === 'tools') return false;
        if (k === 'variable') { const v = o.coef[r][c]; C.openVariables({ getValue: () => v }); return true; }
        if (C.INPUT_KEYS.test(k)) { ed = new C.Editor('line'); C.inputKey(ed, k, {}); return true; }
        return true;
      },
    };
    return ov;
  }

  // ===== 計算結果のページ表示（▲▼） =====
  // list: [{lines: [html], v?, msg?}]
  function resultPages(list, o) {
    let i = 0;
    const ov = {
      fmt: undefined,
      render() {
        const it = list[i];
        let h = '<div class="calc">' + it.lines.map((l, j) => '<div class="in fb" style="top:' + (2 + j * 14) + 'px">' + l + '</div>').join('');
        if (it.v !== undefined) h += '<div class="out"><div class="ln">' + C.fmtValue(it.v, G.s, { fmt: ov.fmt }).html + '</div></div>';
        if (it.msg) h += '<div class="out fj">' + esc(it.msg) + '</div>';
        return h + '</div>';
      },
      status() { return { up: i > 0, down: i < list.length - 1 }; },
      key(k) {
        if (k === 'down' || k === 'exe' || k === 'ok') { if (i < list.length - 1) { i++; ov.fmt = undefined; } else if (k !== 'down') { C.pop(ov); if (o && o.onEnd) o.onEnd(); } return true; }
        if (k === 'up') { if (i > 0) { i--; ov.fmt = undefined; } return true; }
        if (k === 'variable') { const v = list[i].v; if (v !== undefined) C.openVariables({ getValue: () => v }); return true; }
        if (k === 'format') {
          const v = list[i].v; if (v === undefined) return true;
          const opts = C.formatOptions(v, G.s, 'eq').filter((x) => !['eng', 'sexa'].includes(x[0]));
          C.menu(opts.map(([key, lab]) => ({ label: lab, action: (m) => { C.pop(m); ov.fmt = key === 'std' ? undefined : key; } })));
          return true;
        }
        if (k === 'back' || k === 'ac') { C.pop(ov); if (o && o.onEnd) o.onEnd(); return true; }
        return true;
      },
    };
    C.push(ov);
  }

  // ===== 方程式 =====
  const UNK = ['x', 'y', 'z', 't'];
  const POLYS = ['', '', 'ax²+bx+c', 'ax³+bx²+cx+d', 'ax⁴+bx³+cx²+dx+e'];
  const eq = {
    id: 'eq', name: '方程式',
    init() { const st = G.appState.eq || {}; this.kind = st.kind || null; this.n = st.n || 2; this.coef = st.coef || null; this.view = 'menu'; this.solver = null; },
    persist() { G.appState.eq = { kind: this.kind, n: this.n, coef: this.coef }; C.save(); },
    isPoly() { return this.kind === 'poly' && this.view !== 'menu'; },
    enter() { if (this.kind === undefined) this.init(); this.mainMenu(); },
    reset() { delete G.appState.eq; this.init(); },
    mainMenu() {
      this.view = 'menu';
      C.menu([
        { label: '連立方程式', action: () => C.menu([2, 3, 4].map((n) => ({ label: '<span class="big">' + n + '</span>元連立方程式', html: true, action: () => this.setup('simul', n) }))) },
        { label: '高次方程式', action: () => C.menu([2, 3, 4].map((n) => ({ label: POLYS[n], big: true, action: () => this.setup('poly', n) }))) },
        { label: 'ソルブ機能', action: () => this.setup('solver') },
      ], { noAC: true, onBack: () => C.openHome() });
    },
    setup(kind, n) {
      C.popAll();
      if (kind !== this.kind || n !== this.n || !this.coef) {
        if (kind === 'simul') this.coef = Array.from({ length: n }, () => Array(n + 1).fill(Q(0)));
        else if (kind === 'poly') this.coef = [Array(n + 1).fill(Q(0))];
      }
      this.kind = kind; this.n = n || 0; this.persist();
      if (kind === 'solver') { this.view = 'solver'; this.solver = { ed: new C.Editor(C.edMode()) }; if (G.appState.solverEq) this.solver.ed.setTokens(G.appState.solverEq); return; }
      this.view = 'coef';
      this.ce = coefEditor({
        layout: kind, coef: this.coef, unk: UNK.slice(0, n), header: POLYS[n], persist: () => this.persist(),
        solve: () => this.solve(), onBack: () => this.mainMenu(),
      });
    },
    solve() {
      try {
        if (this.kind === 'simul') {
          const r = C.gaussSolve(this.coef);
          if (r.none) { C.info('解なし'); return; }
          if (r.inf) { C.info('無数の解'); return; }
          resultPages(r.sol.map((v, i) => ({ lines: [VNI(UNK[i]) + '='], v })));
          return;
        }
        const cs = this.coef[0];
        const { reals, cxs } = C.solvePoly(cs);
        const showCx = G.s.cxRoots !== false;
        const roots = showCx ? reals.concat(cxs) : reals;
        const head = POLYS[this.n] + '=0';
        if (!roots.length) { C.info('実数解なし'); return; }
        const list = roots.map((v, i) => ({ lines: [head, (roots.length > 1 ? '𝑥' + SUBN(i + 1) : '𝑥') + '='], v }));
        if (this.n === 2) {
          const [a, b] = cs; const x0 = V.div(V.neg(b), V.mul(Q(2), a)); const y0 = C.hornerEval(cs, x0);
          const t = 'y=' + POLYS[2] + (E.sign(a) > 0 ? 'の最小値' : 'の最大値');
          list.push({ lines: [t, '𝑥='], v: x0 }, { lines: [t, '𝑦='], v: y0 });
        } else if (this.n === 3) {
          const [a, b, c] = cs;
          const D = V.sub(V.mul(b, b), V.mul(Q(3), V.mul(a, c)));
          if (E.sign(D) <= 0) list.push({ lines: ['y=' + POLYS[3]], msg: '極値をもたない' });
          else {
            const s = E.sqrt(D); const x1 = V.div(V.add(V.neg(b), s), V.mul(Q(3), a)), x2 = V.div(V.sub(V.neg(b), s), V.mul(Q(3), a));
            const pts = [[x1, C.hornerEval(cs, x1)], [x2, C.hornerEval(cs, x2)]].sort((p, q) => num(q[1]) - num(p[1]));
            const t = 'y=' + POLYS[3];
            list.push({ lines: [t + 'の極大値', '𝑥='], v: pts[0][0] }, { lines: [t + 'の極大値', '𝑦='], v: pts[0][1] }, { lines: [t + 'の極小値', '𝑥='], v: pts[1][0] }, { lines: [t + 'の極小値', '𝑦='], v: pts[1][1] });
          }
        }
        for (const it of list) it.lines = it.lines.map((l) => l.replace(/(?<![𝑥𝑦])x/g, 'x'));
        resultPages(list);
      } catch (e) { C.showError(e); }
    },
    solverVars(ast) {
      const set = new Set();
      const walk = (n) => { if (!n || typeof n !== 'object') return; if (n.t === 'var') set.add(n.n); for (const k in n) if (typeof n[k] === 'object') walk(n[k]); };
      walk(ast); return C.VARN.filter((v) => set.has(v));
    },
    solverStart() {
      const sv = this.solver;
      let ast; try { ast = C.parse(sv.ed.root); } catch (e) { C.showError(e); return; }
      if (ast.t === 'stmts' || (ast.t === 'rel' && (ast.ops.length > 1 || ast.ops[0] !== '='))) { C.showError(new C.CalcError('Syntax')); return; }
      const vars = this.solverVars(ast);
      if (!vars.length) { C.showError(new C.CalcError('Variable')); return; }
      G.appState.solverEq = JSON.parse(JSON.stringify(sv.ed.root)); C.save();
      sv.ast = ast;
      C.menu(vars.map((v) => ({ label: VNI(v), big: true, action: () => { C.popAll(); sv.target = v; this.initForm(); } })), { title: '求めたい変数を選択して下さい', sel: Math.max(0, vars.indexOf(sv.target || 'x')) });
    },
    initForm() {
      const sv = this.solver, t = sv.target;
      C.push(new C.Form({
        title: '初期値を入力して下さい', vx: 24,
        fields: [{ label: VNI(t), big: true, value: G.vars[t] || Q(0) }],
        onSubmit: ([v]) => { G.vars[t] = v; C.popAll(); this.runSolver(); },
        onBack: () => { C.popAll(); },
      }));
    },
    runSolver(cont) {
      const sv = this.solver, t = sv.target, ast = sv.ast;
      const f = (xv) => {
        const old = G.vars[t]; G.vars[t] = xv;
        try {
          if (ast.t === 'rel') return num(V.realOnly(V.sub(C.evaluate(ast.terms[0], C.mkCtx('calc')), C.evaluate(ast.terms[1], C.mkCtx('calc')))));
          return num(V.realOnly(C.evaluate(ast, C.mkCtx('calc'))));
        } finally { G.vars[t] = old; }
      };
      let x = num(G.vars[t] || Q(0)), ok = false;
      try {
        for (let it = 0; it < 120; it++) {
          const fx = f(x);
          if (Math.abs(fx) < 1e-15) { ok = true; break; }
          const h = Math.max(1e-8, Math.abs(x) * 1e-8);
          const d = (f(x + h) - f(x - h)) / (2 * h);
          if (!Number.isFinite(d) || d === 0) { x += 0.5 + Math.abs(x) * 0.1; continue; }
          let nx = x - fx / d, lam = 1;
          while (lam > 1e-4 && Math.abs(f(nx)) > Math.abs(fx) * 1.5) { lam /= 2; nx = x - lam * fx / d; }
          if (Math.abs(nx - x) < 1e-15 * Math.max(1, Math.abs(x))) { x = nx; break; }
          x = nx;
        }
        ok = ok || Math.abs(f(x)) < 1e-10 * Math.max(1, Math.abs(x));
      } catch (e) { C.showError(e.code ? e : new C.CalcError('CantSolve')); return; }
      if (!Number.isFinite(x)) { C.showError(new C.CalcError('CantSolve')); return; }
      x = Number(x.toPrecision(15)); if (Math.abs(x) < 1e-14) x = 0;
      let lr = f(x); if (Math.abs(lr) < 1e-14 * Math.max(1, Math.abs(x))) lr = 0;
      G.vars[t] = x; G.ans = x; C.save();
      sv.res = { x, lr };
      if (!ok) {
        C.menu([{ label: '継続する', action: () => { C.popAll(); this.runSolver(true); } }, { label: '終了する', action: () => { C.popAll(); this.view = 'solres'; } }], {
          status: true, title: '<span class="big">' + VNI(t) + '=' + esc(C.shortText(x, G.s, 10)) + '</span>', titleHtml: true,
        });
        return;
      }
      this.view = 'solres';
    },
    render() {
      if (this.view === 'coef' && this.ce) return this.ce.render();
      if (this.view === 'solver') return '<div class="calc"><div class="in' + (this.solver.ed.mode === 'line' ? ' line' : '') + '">' + this.solver.ed.render(true) + '</div></div>';
      if (this.view === 'solres') {
        const r = this.solver.res, d = (v) => C.fmtValue(v, G.s, { fmt: 'dec' }).html;
        return '<div class="calc"><div class="in fb">' + VNI(this.solver.target) + '=</div><div class="out" style="bottom:auto;top:2px">' + d(r.x) + '</div><div class="in fb" style="top:16px">L−R=</div><div class="out" style="bottom:auto;top:16px">' + d(r.lr) + '</div></div>';
      }
      return '';
    },
    key(k) {
      if (this.view === 'coef' && this.ce) return this.ce.key(k);
      if (this.view === 'solver') {
        const ed = this.solver.ed;
        if (k === 'exe') { if (!ed.isEmpty()) this.solverStart(); return true; }
        if (k === 'ac') { ed.clear(); return true; }
        if (k === 'back') { this.mainMenu(); return true; }
        if (k === 'variable') { C.openVariables({ onRecall: (t) => ed.insert(t) }); return true; }
        if (k === 'catalog') { C.openCatalog([CAT.eqSign, CAT.func, CAT.numeric, CAT.angle, CAT.hyp, CAT.eng, CAT.const, CAT.unit, CAT.pt, CAT.other], ed); return true; }
        if (k === 'fx') { C.openFxMenu(ed); return true; }
        if (k === 'tools') return false;
        C.inputKey(ed, k, {}); return true;
      }
      if (this.view === 'solres') {
        if (k === 'exe') { this.view = 'solver'; this.solverStart(); return true; }
        if (k === 'variable') { const x = this.solver.res.x; C.openVariables({ getValue: () => x }); return true; }
        if (['back', 'ac', 'left', 'right'].includes(k)) { this.view = 'solver'; return true; }
        return true;
      }
      return true;
    },
    tools() {
      if (this.view === 'coef' && this.kind === 'poly') return [{ label: '虚数結果表示', sub: () => [[true, 'する'], [false, 'しない']].map(([v, l]) => ({ label: l, radio: true, checked: () => (G.s.cxRoots !== false) === v, action: () => { G.s.cxRoots = v; C.save(); C.popAll(); } })) }];
      if (this.view === 'solver') return [{ label: '元に戻す', action: () => { C.popAll(); this.solver.ed.undo(); } }];
      return [];
    },
    status() { return null; },
    editor() { return this.view === 'solver' ? this.solver.ed : null; },
    onIO() { if (this.solver) this.solver.ed = new C.Editor(C.edMode()); },
  };

  // ===== 不等式 =====
  const INEQ_OPS = ['>', '<', '≥', '≤'];
  function ineqDisplay(res) {
    const { rs, segs } = res;
    if (!segs.length) return { form: '', sol: '解なし', vals: [] };
    if (segs.length === 1 && segs[0].lo === null && segs[0].hi === null) return { form: '', sol: 'すべての実数', vals: [] };
    const letters = 'abcdefgh'; let li = 0; const vals = [];
    const L = (idx) => { const ch = letters[li++]; vals.push([ch, rs[idx]]); return ch; };
    const X = '𝑥', rel = (inc) => (inc ? '≤' : '<');
    const formParts = [], solParts = [];
    for (const s of segs) {
      if (s.lo !== null && s.hi !== null && s.lo === s.hi) { const a = L(s.lo); formParts.push(X + '=' + a); solParts.push([X + '=', rs[s.lo]]); continue; }
      if (s.lo === null) { const a = L(s.hi); formParts.push(X + rel(s.hiIn) + a); solParts.push([X + rel(s.hiIn), rs[s.hi]]); continue; }
      if (s.hi === null) { const a = L(s.lo); formParts.push(a + rel(s.loIn) + X); solParts.push([null, rs[s.lo], rel(s.loIn) + X]); continue; }
      const a = L(s.lo), b = L(s.hi); formParts.push(a + rel(s.loIn) + X + rel(s.hiIn) + b); solParts.push([null, rs[s.lo], rel(s.loIn) + X + rel(s.hiIn), rs[s.hi]]);
    }
    return { form: formParts.join(','), solParts, vals };
  }
  const ineq = {
    id: 'ineq', name: '不等式',
    init() { const st = G.appState.ineq || {}; this.n = st.n || 2; this.op = st.op || '>'; this.coef = st.coef || null; this.view = 'menu'; },
    persist() { G.appState.ineq = { n: this.n, op: this.op, coef: this.coef }; C.save(); },
    enter() { if (this.n === undefined) this.init(); this.choose(); },
    reset() { delete G.appState.ineq; this.init(); },
    choose() {
      this.view = 'menu';
      C.menu([2, 3, 4].map((n) => ({
        label: POLYS[n], big: true, action: () => C.menu(INEQ_OPS.map((op) => ({ label: POLYS[n] + op + '0', big: true, action: () => { if (n !== this.n || !this.coef) this.coef = [Array(n + 1).fill(Q(0))]; this.n = n; this.op = op; this.persist(); C.popAll(); this.mk(); } }))),
      })), { noAC: true, onBack: () => C.openHome() });
    },
    mk() {
      this.view = 'coef';
      if (!Array.isArray(this.coef[0])) this.coef = [this.coef];
      this.ce = coefEditor({ layout: 'poly', coef: this.coef, header: POLYS[this.n] + this.op + '0', suffix: this.op + '0', persist: () => this.persist(), solve: () => this.solve(), onBack: () => this.choose() });
    },
    solve() {
      try {
        const cs = this.coef[0];
        if (E.isZero(cs[0])) throw new C.CalcError('Math');
        const d = ineqDisplay(C.ineqSolve(cs, this.op));
        const math = G.s.io === 'mm';
        const ov = {
          render() {
            if (!d.solParts) return '<div class="calc"><div class="out fj">' + esc(d.sol) + '</div></div>';
            if (!math) {
              let h = '<div class="ls"><div class="r" style="top:1px">' + esc(d.form) + '</div>';
              d.vals.forEach(([ch, v], i) => { h += '<div class="r" style="top:' + (11 + i * 10) + 'px">' + ch + '=<span style="position:absolute;right:2px">' + esc(C.shortText(v, G.s, 12)) + '</span></div>'; });
              return h + '</div>';
            }
            const parts = d.solParts.map((p) => p.map((x) => (x === null ? '' : typeof x === 'string' ? '<span class="tk">' + esc(x) + '</span>' : C.fmtValue(x, G.s, {}).html)).join(''));
            return '<div class="calc"><div class="in fb">' + esc(d.form) + '</div><div class="out" style="white-space:normal;max-width:190px;flex-direction:row;flex-wrap:wrap;justify-content:flex-end">' + parts.join('<span class="tk">,</span>') + '</div></div>';
          },
          key(k) { if (['back', 'ac', 'exe', 'ok'].includes(k)) C.pop(ov); return true; },
        };
        C.push(ov);
      } catch (e) { C.showError(e); }
    },
    render() { return this.view === 'coef' && this.ce ? this.ce.render() : ''; },
    key(k) { if (this.view === 'coef' && this.ce) return this.ce.key(k); return true; },
    tools() { return []; },
    status() { return null; },
    editor() { return null; },
  };

  // ===== 数表作成 =====
  const table = {
    id: 'table', name: '数表作成',
    init() { const st = G.appState.table || {}; this.type = st.type || 'fg'; this.range = st.range || [1, 5, 1]; this.xs = st.xs || []; this.mkGrid(); },
    persist() { G.appState.table = { type: this.type, range: this.range, xs: this.xs }; C.save(); },
    enter() { if (!this.grid) this.init(); },
    reset() { delete G.appState.table; this.init(); },
    maxRows() { return this.type === 'fg' ? 30 : 45; },
    colsDef() { return this.type === 'fg' ? ['x', 'f', 'g'] : this.type === 'f' ? ['x', 'f'] : ['x', 'g']; },
    defined(fn) { return G.fdef[fn] && G.fdef[fn].length; },
    evalAt(fn, x) {
      if (!this.defined(fn)) return undefined;
      try { const old = G.vars.x; G.vars.x = x; try { return V.realOnly(C.evaluate(C.parse(G.fdef[fn]), C.mkCtx('calc'))); } finally { G.vars.x = old; } } catch (e) { return 'ERROR'; }
    },
    mkGrid() {
      const self = this;
      this.grid = new C.TableGrid({
        rows: () => self.xs.length, growable: true, maxRows: () => self.maxRows(), padRows: true,
        cols: () => self.colsDef().map((k) => ({ label: k, html: k === 'x' ? '𝑥' : k + '(𝑥)', w: 44 })),
        get: (r, c) => { if (r >= self.xs.length) return undefined; const k = self.colsDef()[c]; return k === 'x' ? self.xs[r] : self.evalAt(k, self.xs[r]); },
        set: (r, c, v) => { if (r >= self.maxRows()) { C.showError(new C.CalcError('Range')); return; } if (r >= self.xs.length) self.xs.push(v); else self.xs[r] = v; G.vars.x = v; self.persist(); },
        canEdit: (r, c) => c === 0,
        onDel: (r) => { if (r < self.xs.length) { self.xs.splice(r, 1); self.persist(); } },
        bottom: () => {
          const undef = self.colsDef().slice(1).some((k) => !self.defined(k));
          if (self.grid.r >= self.xs.length && undef) return '<div class="msg">' + (self.type === 'fg' ? 'f(𝑥)/g(𝑥)' : self.type + '(𝑥)') + ':未定義</div>';
          const v = self.grid.get(self.grid.r, self.grid.c);
          if (v === 'ERROR') return '<div class="val">ERROR</div>';
          return v === undefined ? '' : '<div class="val">' + C.fmtValue(v, dsLine(), {}).html + '</div>';
        },
      });
      this.grid.maxRows = 46;
    },
    generate() {
      const [s, e, st] = this.range;
      if (st === 0 || (e - s) / st < 0) throw new C.CalcError('Range');
      const cnt = Math.floor((e - s) / st + 1e-9) + 1;
      if (cnt > this.maxRows()) throw new C.CalcError('Range');
      this.xs = []; for (let i = 0; i < cnt; i++) this.xs.push(E.add(E.fromDecimal(String(s)), E.mul(E.fromDecimal(String(st)), Q(i))));
      G.vars.x = E.fromDecimal(String(e)); this.grid.r = 0; this.grid.c = 0; this.persist();
    },
    openRange() {
      const f = new C.Form({
        title: '数表の範囲', vx: 72, fields: [['開始値', 0], ['終了値', 1], ['ステップ値', 2]].map(([l, i]) => ({ label: l, value: E.fromDecimal(String(this.range[i]).replace('e+', 'E').replace('e', 'E')) })),
        onSubmit: (vals) => { this.range = vals.map(num); try { this.generate(); C.pop(f); } catch (e) { C.showError(e); } },
      });
      C.push(f);
    },
    render() { return this.grid.render(); },
    key(k) {
      const g = this.grid;
      if (k === 'tools') return false;
      if (k === 'fx') { const base = G.ov.length; C.menu([{ label: '<span class="big">f(𝑥)</span>の定義', html: true, action: () => { C.popTo(base); C.defineFn('f'); } }, { label: '<span class="big">g(𝑥)</span>の定義', html: true, action: () => { C.popTo(base); C.defineFn('g'); } }]); return true; }
      if (!g.ed) {
        if (k === 'ok') return true;
        if ((k === 'add' || k === 'sub' || k === 'exe') && g.c === 0 && g.r > 0 && g.r <= this.xs.length) {
          if (k === 'exe' && g.r < this.xs.length) { g.move(1, 0); return true; }
          if (k === 'exe') return true;
          const st = E.fromDecimal(String(this.range[2]));
          const nv = k === 'sub' ? E.sub(this.xs[g.r - 1], st) : E.add(this.xs[g.r - 1], st);
          if (g.r >= this.maxRows()) { C.showError(new C.CalcError('Range')); return true; }
          if (g.r >= this.xs.length) this.xs.push(nv); else this.xs[g.r] = nv; this.persist(); g.move(1, 0); return true;
        }
      }
      return g.key(k) || true;
    },
    tools() {
      return [
        { label: '数表の範囲', action: () => { C.popAll(); this.openRange(); } },
        { label: 'f(𝑥)/g(𝑥)の定義', sub: () => [{ label: '<span class="big">f(𝑥)</span>の定義', html: true, action: () => { C.popAll(); C.defineFn('f'); } }, { label: '<span class="big">g(𝑥)</span>の定義', html: true, action: () => { C.popAll(); C.defineFn('g'); } }] },
        { label: '数表タイプ', sub: () => [['fg', 'f(𝑥)/g(𝑥)'], ['f', 'f(𝑥)'], ['g', 'g(𝑥)']].map(([v, l]) => ({ label: l, radio: true, big: true, checked: () => this.type === v, action: () => { if (this.type !== v) { this.type = v; this.xs = []; this.grid.r = 0; this.grid.c = 0; this.persist(); } C.popAll(); } })) },
        { label: '編集', sub: () => [
          { label: '行の挿入', action: () => { if (this.xs.length < this.maxRows()) { this.xs.splice(this.grid.r, 0, Q(0)); this.persist(); } C.popAll(); } },
          { label: 'すべてのデータをクリア', action: () => { this.xs = []; this.grid.r = 0; this.persist(); C.popAll(); } },
        ] },
        { label: '再計算', action: () => C.popAll() },
      ];
    },
    status() { return null; },
    editor() { return this.grid.ed; },
    onIO() { G.fdef = { f: [], g: [] }; },
  };

  // ===== Math Box =====
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const dicePix = C.PIX(['#######', '#.....#', '#.#...#', '#.....#', '#...#.#', '#.....#', '#######']);
  const coinPix = C.PIX(['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..']);
  const linePix = C.PIX(['.......', '.......', '##.....', '#######', '##.....', '.......', '.......']);
  const circPix = C.PIX(['..###..', '.#.#.#.', '#..#..#', '#######', '#..#..#', '.#.#.#.', '..###..']);

  function fmtTrigLine(v) { // √(2)⌟2 形式（ライン表示）
    return C.fmtValue(v, Object.assign({}, G.s, { io: 'll' }), {}).html.replace(/<svg class="rad"[\s\S]*?<\/svg>/g, '√').replace(/<[^>]+>/g, '');
  }
  function angleText(deg) { // 度 -> 現在の角度単位の文字列
    const u = G.s.angle; const v = u === 'deg' ? deg : u === 'rad' ? deg * Math.PI / 180 : deg * 10 / 9;
    return String(Number(v.toPrecision(10)));
  }

  const mbox = {
    id: 'mbox', name: 'Math Box',
    init() { const st = G.appState.mbox || {}; this.dice = st.dice || { n: 1, tries: 5, spec: 0 }; this.coin = st.coin || { n: 1, tries: 5, spec: 0 }; this.nl = st.nl || [null, null, null]; this.circ = st.circ || { type: 'unit', t1: 45, t2: null }; this.view = 'menu'; this.res = null; this.nlSel = 0; this.view2 = null; this.clock = { h: 3, m: 0 }; this.axis = null; },
    persist() { G.appState.mbox = { dice: this.dice, coin: this.coin, nl: this.nl, circ: this.circ }; C.save(); },
    enter() { if (!this.dice) this.init(); this.menu(); },
    reset() { delete G.appState.mbox; this.init(); },
    menu() {
      this.view = 'menu';
      C.menu([
        { label: 'サイコロ', icon: dicePix, action: () => { C.popAll(); this.simForm('dice'); } },
        { label: 'コイントス', icon: coinPix, action: () => { C.popAll(); this.simForm('coin'); } },
        { label: '数直線', icon: linePix, action: () => { C.popAll(); this.nlForm(); } },
        { label: '円', icon: circPix, action: () => { C.popAll(); this.circForm(); } },
      ], { noAC: true, onBack: () => C.openHome() });
    },
    // ---- サイコロ・コイントス ----
    simForm(kind) {
      const cfg = this[kind]; this.kind = kind; this.view = 'form';
      const f = new C.Form({
        vx: 96,
        fields: [
          { label: kind === 'dice' ? 'サイコロ' : 'コイン', value: cfg.n, choices: [1, 2, 3].map((n) => [n, n + (kind === 'dice' ? '個' : '枚')]), display: (v) => '<span class="tk">' + v + '</span>' },
          { label: '試行回数', value: E.Q(cfg.tries), check: (v) => { if (!E.isInt(v) || num(v) < 1 || num(v) > 250) throw new C.CalcError('Range'); } },
          { label: '試行結果の指定', value: cfg.spec, choices: [[0, 'オフ'], [1, '#1'], [2, '#2'], [3, '#3']] },
        ],
        onSubmit: ([n, tr, spec]) => { cfg.n = n; cfg.tries = num(tr); cfg.spec = spec; this.persist(); C.popAll(); this.run(); },
        onBack: () => { C.popAll(); this.menu(); },
      });
      this.form = f;
    },
    run() {
      const kind = this.kind, cfg = this[kind];
      const rand = cfg.spec ? rng(cfg.spec * 1000 + cfg.n * 300 + cfg.tries + (kind === 'dice' ? 7 : 13)) : Math.random;
      const trials = [];
      for (let i = 0; i < cfg.tries; i++) trials.push(Array.from({ length: cfg.n }, () => (kind === 'dice' ? 1 + Math.floor(rand() * 6) : (rand() < 0.5 ? 1 : 0))));
      this.res = { trials };
      this.fmtMenu();
    },
    fmtMenu() {
      const kind = this.kind, n = this[kind].n;
      this.view = 'fmtmenu';
      const rel = (mode) => () => { C.popAll(); this.showRel(mode); };
      const items = [{ label: '一覧表', action: () => { C.popAll(); this.showList(); } }];
      if (kind === 'dice' && n === 2) items.push({ label: '相対度数表', sub: () => [{ label: '出た目の和', action: rel('sum') }, { label: '出た目の差', action: rel('diff') }] });
      else items.push({ label: '相対度数表', action: rel(kind === 'dice' ? 'sum' : 'heads') });
      C.menu(items, { title: '試行結果の表示形式を選択', noAC: true, onBack: () => { this.res = null; this.simForm(kind); } });
    },
    showList() {
      const kind = this.kind, n = this[kind].n, tr = this.res.trials;
      let cols;
      if (kind === 'dice') cols = n === 1 ? ['A'] : n === 2 ? ['A', 'B', 'Sum', 'Diff'] : ['A', 'B', 'C', 'Sum'];
      else cols = n === 1 ? ['A'] : ['A', 'B', 'C'].slice(0, n).concat(['●']);
      const val = (r, c) => {
        const t = tr[r], k = cols[c];
        if (k === 'Sum') return String(t.reduce((a, b) => a + b, 0));
        if (k === 'Diff') return String(Math.abs(t[0] - t[1]));
        if (k === '●') return String(t.reduce((a, b) => a + b, 0));
        const i = 'ABC'.indexOf(k); return kind === 'dice' ? String(t[i]) : t[i] ? '●' : '○';
      };
      this.view = 'table';
      this.tgrid = new C.TableGrid({ rows: tr.length, cols: cols.map((k) => ({ label: k, w: kind === 'dice' ? 38 : 38 })), get: (r, c) => val(r, c), bottom: () => '' });
    },
    showRel(mode) {
      const kind = this.kind, n = this[kind].n, tr = this.res.trials;
      const key = (t) => (mode === 'diff' ? Math.abs(t[0] - t[1]) : t.reduce((a, b) => a + b, 0));
      let lo, hi;
      if (mode === 'diff') { lo = 0; hi = 5; } else if (kind === 'dice') { lo = n; hi = 6 * n; } else { lo = 0; hi = n; }
      const vals = []; for (let v = lo; v <= hi; v++) vals.push(v);
      if (kind === 'coin' && n === 1) vals.reverse();
      const cnt = vals.map((v) => tr.filter((t) => key(t) === v).length);
      const rel = cnt.map((c) => Number((c / tr.length).toPrecision(6)));
      const head = mode === 'diff' ? 'Diff' : kind === 'coin' ? 'Side' : 'Sum';
      const lab = (v) => (kind === 'coin' && n === 1 ? (v ? '●' : '○') : kind === 'coin' ? '●×' + v : String(v));
      this.view = 'table';
      const self = this;
      this.tgrid = new C.TableGrid({
        rows: vals.length, cols: [{ label: head, w: 24 }, { label: 'Freq', w: 26 }, { label: 'Rel Fr', w: 38 }], rnW: 0,
        get: (r, c) => (c === 0 ? lab(vals[r]) : c === 1 ? String(cnt[r]) : E.fromDecimal(String(rel[r]))),
        side: () => '試行回数<br><span class="big">' + self[kind].tries + '</span>',
        bottom: () => '<div class="val">' + C.fmtValue(E.fromDecimal(String(rel[self.tgrid.r])), dsLine(), { fmt: 'dec' }).html + '</div>',
      });
      this.tgrid.c = 2;
    },
    // ---- 数直線 ----
    nlTypes: ['x<a', 'x≤a', 'x=a', 'x>a', 'x≥a', 'a<x<b', 'a≤x<b', 'a<x≤b', 'a≤x≤b'],
    nlText(l) { if (!l) return ''; return l.type.replace('a', fmtN(l.a)).replace('b', l.b !== undefined ? fmtN(l.b) : '').replace(/x/g, 'x'); },
    nlForm() {
      this.view = 'nlform';
      const names = ['A', 'B', 'C'];
      const self = this;
      const f = new C.Form({
        vx: 14,
        fields: names.map((nm, i) => ({ label: nm, big: true, display: () => '<span class="tk">' + esc(self.nlText(self.nl[i])) + '</span>', sub: () => self.nlEdit(i) })),
        onSubmit: () => { if (!this.nl.some(Boolean)) return; C.popAll(); this.axis = null; this.nlSel = this.nl.findIndex(Boolean); this.view = 'nl'; },
        onBack: () => { C.popAll(); this.nl = [null, null, null]; this.persist(); this.menu(); },
      });
      f.key = (function (orig) { return function (k) { if (k === 'del' && this.sel < 3) { self.nl[this.sel] = null; self.persist(); return true; } return orig.call(this, k); }; })(f.key);
      this.form = f;
    },
    nlEdit(i) {
      const pickType = () => C.menu(this.nlTypes.map((t) => ({ label: t, big: true, action: () => { C.pop(); this.nlValues(i, t, {}); } })));
      if (!this.nl[i]) { pickType(); return; }
      C.menu([{ label: '編集', action: () => { C.pop(); this.nlValues(i, this.nl[i].type, this.nl[i]); } }, { label: '新規定義', action: () => { C.pop(); pickType(); } }]);
    },
    nlValues(i, t, cur) {
      const two = t.startsWith('a');
      const lim = (v) => { if (Math.abs(num(v)) > 1e10) throw new C.CalcError('Range'); };
      C.push(new C.Form({
        title: t, titleHtml: false, btn: '確定する', vx: 14,
        fields: [{ label: 'a', big: true, value: cur.a !== undefined ? E.fromDecimal(String(cur.a)) : undefined, check: lim }].concat(two ? [{ label: 'b', big: true, value: cur.b !== undefined ? E.fromDecimal(String(cur.b)) : undefined, check: lim }] : []),
        onSubmit: (v) => {
          if (v[0] === undefined || (two && v[1] === undefined)) return;
          const a = num(v[0]), b = two ? num(v[1]) : undefined;
          if (two && !(a < b)) { C.showError(new C.CalcError('Argument')); return; }
          this.nl[i] = { type: t, a, b }; this.persist(); C.pop();
        },
      }));
    },
    nlAxis() {
      if (this.axis) return this.axis;
      const vs = []; for (const l of this.nl) if (l) { vs.push(l.a); if (l.b !== undefined) vs.push(l.b); }
      let lo = Math.min(...vs), hi = Math.max(...vs);
      const span = Math.max(hi - lo, Math.abs(hi) * 0.5, 1);
      const raw = span / 8; const p = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = [1, 2, 5, 10].map((m) => m * p).find((m) => m >= raw);
      const center = Math.round(((lo + hi) / 2) / step) * step;
      this.axis = { step, center }; return this.axis;
    },
    renderNL() {
      const { step, center } = this.nlAxis();
      const lo = center - 8 * step, hi = center + 8 * step;
      const X = (v) => 8 + (v - lo) / (hi - lo) * 176;
      let s = '<svg class="fig" style="left:0;top:8px" width="192" height="42" viewBox="0 0 192 42" shape-rendering="crispEdges">';
      const ay = 31;
      s += '<line x1="2" y1="' + (ay + 0.5) + '" x2="190" y2="' + (ay + 0.5) + '" stroke="currentColor"/>' + '<path d="M1 ' + (ay + .5) + ' L5 ' + (ay - 2) + ' L5 ' + (ay + 3) + 'Z M191 ' + (ay + .5) + ' L187 ' + (ay - 2) + ' L187 ' + (ay + 3) + 'Z" fill="currentColor"/>';
      for (let k = -8; k <= 8; k++) { const x = Math.round(X(center + k * step)) + 0.5; s += '<line x1="' + x + '" y1="' + (ay - 1) + '" x2="' + x + '" y2="' + (ay + 2) + '" stroke="currentColor"/>'; }
      const lab = (v, x, anchor) => '<text x="' + x + '" y="' + (ay + 10) + '" font-size="10" text-anchor="' + anchor + '" fill="currentColor">' + fmtN(v) + '</text>';
      s += lab(lo + step, X(lo + step), 'middle') + lab(center, X(center), 'middle') + lab(hi - step, X(hi - step), 'middle');
      this.nl.forEach((l, i) => {
        if (!l) return;
        const y = 4 + i * 9 + 0.5, w = i === this.nlSel ? 2 : 1;
        const dot = (v, closed) => '<circle cx="' + X(v) + '" cy="' + y + '" r="2.2" fill="' + (closed ? 'currentColor' : 'var(--lcd-bg)') + '" stroke="currentColor" stroke-width="1" shape-rendering="auto"/>';
        const seg = (x1, x2) => '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="currentColor" stroke-width="' + w + '"/>';
        const arrowL = '<path d="M1 ' + y + ' L5 ' + (y - 2.5) + ' L5 ' + (y + 2.5) + 'Z" fill="currentColor"/>', arrowR = '<path d="M191 ' + y + ' L187 ' + (y - 2.5) + ' L187 ' + (y + 2.5) + 'Z" fill="currentColor"/>';
        const t = l.type;
        if (t === 'x=a') s += dot(l.a, true);
        else if (t === 'x<a' || t === 'x≤a') s += seg(3, X(l.a)) + arrowL + dot(l.a, t === 'x≤a');
        else if (t === 'x>a' || t === 'x≥a') s += seg(X(l.a), 189) + arrowR + dot(l.a, t === 'x≥a');
        else s += seg(X(l.a), X(l.b)) + dot(l.a, t[1] === '≤') + dot(l.b, t[3] === '≤');
      });
      s += '</svg>';
      const sel = this.nl[this.nlSel];
      return s + '<div class="calc"><div class="in fb" style="top:auto;bottom:0">' + 'ABC'[this.nlSel] + ':' + esc(this.nlText(sel)) + '</div></div>';
    },
    // ---- 円 ----
    circForm() {
      this.view = 'circform';
      const c = this.circ;
      const f = new C.Form({
        vx: 52,
        fields: [
          { label: '種類', value: c.type, choices: [['unit', '単位円'], ['half', '半円'], ['clock', '時計']], onPick: (v) => { c.type = v; } },
          { label: 'θ1', big: true, value: c.t1 !== null ? E.fromDecimal(String(c.t1)) : undefined },
          { label: 'θ2', big: true, value: c.t2 !== null && c.t2 !== undefined ? E.fromDecimal(String(c.t2)) : undefined },
        ],
        onSubmit: ([type, t1, t2]) => {
          c.type = type;
          if (type !== 'clock') { if (t1 === undefined) return; c.t1 = num(t1); c.t2 = t2 === undefined ? null : num(t2); }
          this.persist(); C.popAll(); this.view = 'circ'; this.circIdx = 0;
        },
        onBack: () => { C.popAll(); this.menu(); },
      });
      this.form = f;
    },
    renderCirc() {
      const c = this.circ;
      if (c.type === 'clock') return this.renderClock();
      const half = c.type === 'half';
      const cx = 34, cy = half ? 50 : 34, R = half ? 30 : 24;
      const toRad = (v) => C.evalHelpers.toRad(v, G.s.angle);
      const angs = [c.t1].concat(c.t2 !== null && c.t2 !== undefined ? [c.t2] : []);
      let s = '<svg class="fig" style="left:0;top:8px" width="80" height="56" viewBox="0 8 80 56">';
      s += '<line x1="' + (cx - R - 6) + '" y1="' + cy + '" x2="' + (cx + R + 6) + '" y2="' + cy + '" stroke="currentColor" stroke-dasharray="1 1" stroke-width=".8"/><path d="M' + (cx + R + 7) + ' ' + cy + ' l-3 -2 v4z" fill="currentColor"/>';
      s += '<line x1="' + cx + '" y1="' + (half ? cy : cy + R + 4) + '" x2="' + cx + '" y2="' + (cy - R - 5) + '" stroke="currentColor" stroke-dasharray="1 1" stroke-width=".8"/><path d="M' + cx + ' ' + (cy - R - 6) + ' l-2 3 h4z" fill="currentColor"/>';
      s += half ? '<path d="M' + (cx - R) + ' ' + cy + ' A' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy + '" fill="none" stroke="currentColor" stroke-width="1.6"/>' : '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="currentColor" stroke-width="1.6"/>';
      angs.forEach((a, i) => {
        const r = toRad(E.fromDecimal(String(a))); const px = cx + R * Math.cos(r), py = cy - R * Math.sin(r);
        s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + px + '" y2="' + py + '" stroke="currentColor" stroke-width="' + (i === (this.circIdx || 0) ? 2.6 : 1) + '"/>';
        s += '<line x1="' + px + '" y1="' + py + '" x2="' + px + '" y2="' + cy + '" stroke="currentColor" stroke-width=".7"/>';
        s += '<text x="' + (px + (Math.cos(r) >= 0 ? 2 : -12)) + '" y="' + (py - 2) + '" font-size="9" fill="currentColor">θ' + (i + 1) + '</text>';
      });
      s += '</svg>';
      const i = this.circIdx || 0; const a = angs[i];
      const th = E.fromDecimal(String(a)); const ctx = C.mkCtx('calc'); const H = C.evalHelpers;
      const f = (fn) => { try { return fmtTrigLine(V.R(fn(th, ctx))); } catch (e) { return 'ERROR'; } };
      const n = 'θ' + (i + 1);
      let h = s + '<div class="ft" style="position:absolute;left:84px;top:12px;line-height:11px;white-space:nowrap">sin' + n + '=' + esc(f(H.sinF)) + '<br>cos' + n + '=' + esc(f(H.cosF)) + '<br>tan' + n + '=' + esc(f(H.tanF)) + '</div>';
      h += '<div class="fb" style="position:absolute;left:84px;bottom:1px">' + n + ':' + esc(fmtN(a)) + '</div>';
      if (angs.length > 1) h += '<div class="mn"><div class="bar" style="top:' + (10 + i * 26) + 'px;height:26px"></div></div>';
      return h;
    },
    renderClock() {
      const { h, m } = this.clock;
      const cx = 34, cy = 36, R = 25;
      const ma = m * 6, ha = (h % 12) * 30 + m * 0.5;
      const P = (deg, r) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];
      let s = '<svg class="fig" style="left:0;top:8px" width="80" height="56" viewBox="0 8 80 56"><circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="currentColor" stroke-width="1.6"/>';
      for (let k = 0; k < 12; k++) { const [x1, y1] = P(k * 30, R - 1), [x2, y2] = P(k * 30, R - 5); s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="currentColor" stroke-width="' + (k % 3 ? 1 : 1.8) + '"/>'; }
      const [mx, my] = P(ma, R - 5), [hx, hy] = P(ha, R - 11);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + mx + '" y2="' + my + '" stroke="currentColor" stroke-width="2.2"/><line x1="' + cx + '" y1="' + cy + '" x2="' + hx + '" y2="' + hy + '" stroke="currentColor" stroke-width="3"/></svg>';
      let d = Math.abs(ma - ha) % 360; const t1 = Math.min(d, 360 - d), t2 = 360 - t1;
      const ud = C.PIX(['..#..', '.###.', '#####', '.....', '#####', '.###.', '..#..']);
      return s + '<span style="position:absolute;left:86px;top:12px">' + ud + '</span><div class="fb" style="position:absolute;left:96px;top:10px;line-height:14px">' + h + ':' + String(m).padStart(2, '0') + '<br>θ1:' + angleText(t1) + '<br>θ2:' + angleText(t2) + '</div><div class="fb" style="position:absolute;left:96px;bottom:1px">' + (t1 === t2 ? 'θ1=θ2' : 'θ1<θ2') + '</div>';
    },
    // ---- 描画・キー ----
    render() {
      if ((this.view === 'form' || this.view === 'nlform' || this.view === 'circform') && this.form) return this.form.render();
      if (this.view === 'table' && this.tgrid) return this.tgrid.render();
      if (this.view === 'nl') return this.renderNL();
      if (this.view === 'circ') return this.renderCirc();
      return '';
    },
    key(k) {
      if (k === 'tools') return false;
      if ((this.view === 'form' || this.view === 'nlform' || this.view === 'circform') && this.form) { this.form.key(k); return true; }
      if (this.view === 'table') {
        if (k === 'back' || k === 'ac') { this.fmtMenu(); return true; }
        if (k === 'variable') { const v = this.tgrid.get(this.tgrid.r, this.tgrid.c); if (V.isReal(v)) C.openVariables({ getValue: () => v }); return true; }
        if (k === 'up' || k === 'down' || k === 'pgup' || k === 'pgdn') { this.tgrid.key(k); return true; }
        if (k === 'left' || k === 'right') { if (this.tgrid.cols().length > 3 || !this.tgrid.side) this.tgrid.key(k); return true; }
        return true;
      }
      if (this.view === 'nl') {
        const n = this.nl.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
        if (k === 'up' || k === 'down') { const p = n.indexOf(this.nlSel); this.nlSel = n[(p + (k === 'up' ? -1 : 1) + n.length) % n.length]; return true; }
        if (k === 'left' || k === 'right') { const a = this.nlAxis(); a.center += (k === 'left' ? -1 : 1) * a.step; return true; }
        if (k === 'back' || k === 'ac') { this.nlForm(); return true; }
        return true;
      }
      if (this.view === 'circ') {
        if (this.circ.type === 'clock') {
          const add = (mins) => { let t = (this.clock.h % 12) * 60 + this.clock.m + mins; t = ((t % 720) + 720) % 720; this.clock = { h: Math.floor(t / 60) || 12, m: t % 60 }; };
          if (k === 'up') { add(1); return true; } if (k === 'down') { add(-1); return true; }
          if (k === 'pgup') { add(60); return true; } if (k === 'pgdn') { add(-60); return true; }
        } else if (k === 'up' || k === 'down') { if (this.circ.t2 !== null && this.circ.t2 !== undefined) this.circIdx = (this.circIdx || 0) ? 0 : 1; return true; }
        if (k === 'back' || k === 'ac' || k === 'exe' || k === 'ok') { this.circForm(); return true; }
        return true;
      }
      return true;
    },
    tools() {
      if (this.view === 'nl') return [
        { label: '表示領域の変更', action: () => { C.popAll(); const a = this.nlAxis(); C.push(new C.Form({ vx: 72, fields: [{ label: '目盛り幅', value: E.fromDecimal(String(a.step)), check: (v) => { if (!(num(v) >= 1e-10 && num(v) <= 1e10)) throw new C.CalcError('Range'); } }, { label: '中心', value: E.fromDecimal(String(a.center)), check: (v) => { if (Math.abs(num(v)) > 1e10) throw new C.CalcError('Range'); } }], onSubmit: ([st, ce]) => { this.axis = { step: num(st), center: num(ce) }; C.pop(); } })); } },
        { label: '表示領域のリセット', action: () => { this.axis = null; C.popAll(); } },
      ];
      return [];
    },
    status() { return null; },
    noStatusFn() { return false; },
    editor() { return null; },
  };
  function fmtN(v) { return String(Number(Number(v).toPrecision(8))); }

  Object.assign(C.lateApps, { eq, ineq, table, mbox });
})(window.C = window.C || {});
