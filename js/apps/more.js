/* 数表作成・方程式・不等式・Math Box */
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

  // ===== 結果のページ表示 =====
  function pages(title, list, onClose) {
    // list: [{label, v, html}]
    let i = 0;
    const ov = {
      render() {
        const it = list[i];
        const body = it.html !== undefined ? it.html : '<span class="tk">' + esc(it.label) + '</span>' + fv(it.v);
        return '<div class="calc"><div class="input lbl-sm" style="display:flex;justify-content:space-between"><span>' + esc(it.title || title) + '</span><span>' + (list.length > 1 ? (i + 1) + '/' + list.length : '') + '</span></div><div class="output">' + body + '</div></div>';
      },
      key(k) {
        if (k === 'down' || k === 'ok' || k === 'exe') { if (i < list.length - 1) { i++; return true; } if (k === 'down') return true; C.pop(ov); if (onClose) onClose(); return true; }
        if (k === 'up') { i = Math.max(0, i - 1); return true; }
        if (k === 'variable') { const it = list[i]; if (it.v !== undefined) C.openVariables({ onRecall: () => {}, getValue: () => it.v }); return true; }
        if (k === 'format' || k === 'S⇔D') { const it = list[i]; if (it.v !== undefined) { it.dec = !it.dec; it.html = it.dec ? '<span class="tk">' + esc(it.label) + '</span>' + C.fmtValue(it.v, G.s, { fmt: 'dec' }).html : undefined; } return true; }
        if (k === 'back' || k === 'ac') { C.pop(ov); if (onClose) onClose(); return true; }
        return true;
      },
    };
    C.push(ov);
  }

  // ===== 方程式 =====
  const UNK = ['x', 'y', 'z', 't'];
  const eq = {
    id: 'eq', name: '方程式/関数', short: '方程式', icon: '<span style="font-size:14px"><i>x</i>=?</span>',
    init() { const st = G.appState.eq || {}; this.kind = st.kind || null; this.n = st.n || 2; this.coef = st.coef || null; this.grid = null; this.solver = null; },
    persist() { G.appState.eq = { kind: this.kind, n: this.n, coef: this.coef }; C.save(); },
    enter() { if (this.kind === undefined) this.init(); this.chooseKind(); },
    reset() { delete G.appState.eq; this.init(); },
    chooseKind() {
      C.menu('方程式/関数', [
        { label: '連立方程式', sub: () => [2, 3, 4].map((n) => ({ label: n + '元', action: () => { this.setup('simul', n); } })) },
        { label: '高次方程式', sub: () => [2, 3, 4].map((n) => ({ label: n + '次', right: ['', '', 'ax²+bx+c', 'ax³+…+d', 'ax⁴+…+e'][n], action: () => { this.setup('poly', n); } })) },
        { label: 'ソルバー', action: () => { this.setup('solver'); } },
      ], { noAC: true });
    },
    setup(kind, n) {
      C.popAll();
      if (kind !== this.kind || n !== this.n || !this.coef) {
        this.kind = kind; this.n = n || 0;
        if (kind === 'simul') this.coef = Array.from({ length: n }, () => Array(n + 1).fill(Q(0)));
        else if (kind === 'poly') this.coef = [Array(n + 1).fill(Q(0))];
        else this.coef = null;
      }
      this.kind = kind; this.persist();
      if (kind === 'solver') { this.openSolver(); return; }
      this.mkGrid();
    },
    mkGrid() {
      const self = this;
      const cols = this.kind === 'simul' ? UNK.slice(0, this.n).concat(['=']) : 'abcde'.slice(0, this.n + 1).split('');
      this.grid = new C.CellGrid({
        rows: () => self.coef.length, cols: cols.length, colLabel: (c) => cols[c], visRows: 4, visCols: 4,
        rowLabel: (r) => (self.kind === 'simul' ? String(r + 1) : ''),
        get: (r, c) => self.coef[r][c], set: (r, c, v) => { self.coef[r][c] = v; self.persist(); },
        titleRight: () => '', title: this.kind === 'simul' ? '連立方程式 ' + this.n + '元' : this.n + '次方程式  ' + ['', '', 'ax²+bx+c=0', 'ax³+bx²+cx+d=0', 'ax⁴+bx³+cx²+dx+e=0'][this.n],
      });
    },
    solve() {
      try {
        if (this.kind === 'simul') {
          const r = gaussSolve(this.coef);
          if (r.none) { C.push(new C.Msg({ title: '解なし', hint: '[OK] 戻る' })); return; }
          if (r.inf) { C.push(new C.Msg({ title: '解が無数にあります', hint: '[OK] 戻る' })); return; }
          pages('連立方程式', r.sol.map((v, i) => ({ label: UNK[i] + '=', v })));
          return;
        }
        const cs = this.coef[0];
        const { reals, cxs } = solvePoly(cs);
        const list = [];
        const showCx = G.s.cxRoots !== false;
        const roots = showCx ? reals.concat(cxs) : reals;
        if (!roots.length) { C.push(new C.Msg({ title: '実数解なし', hint: '[OK] 戻る' })); return; }
        roots.forEach((v, i) => list.push({ label: (roots.length > 1 ? 'x' + sub(i + 1) : 'x') + '=', v }));
        // 極値
        if (this.n === 2) {
          const [a, b, c] = cs; const x0 = V.div(V.neg(b), V.mul(Q(2), a)); const y0 = horner(cs, x0);
          const t = E.sign(a) > 0 ? '極小値' : '極大値';
          list.push({ title: t + ' (x座標)', label: 'x=', v: x0 }, { title: t + ' (y座標)', label: 'y=', v: y0 });
        } else if (this.n === 3) {
          const [a, b, c] = cs;
          const D = V.sub(V.mul(b, b), V.mul(Q(3), V.mul(a, c)));
          if (E.sign(D) <= 0) list.push({ title: '極値', html: '<span class="tk">極値はありません</span>' });
          else {
            const s = E.sqrt(D); const x1 = V.div(V.add(V.neg(b), s), V.mul(Q(3), a)), x2 = V.div(V.sub(V.neg(b), s), V.mul(Q(3), a));
            const pts = [[x1, horner(cs, x1)], [x2, horner(cs, x2)]].sort((p, q) => num(q[1]) - num(p[1]));
            list.push({ title: '極大値 (x座標)', label: 'x=', v: pts[0][0] }, { title: '極大値 (y座標)', label: 'y=', v: pts[0][1] }, { title: '極小値 (x座標)', label: 'x=', v: pts[1][0] }, { title: '極小値 (y座標)', label: 'y=', v: pts[1][1] });
          }
        }
        pages(this.n + '次方程式', list);
      } catch (e) { C.showError(e); }
    },
    openSolver() {
      this.solver = { ed: new C.Editor(C.edMode()), view: 'eq' };
      const st = G.appState.solverEq; if (st) this.solver.ed.setTokens(st);
    },
    solverVars(ast) {
      const set = new Set();
      const walk = (n) => { if (!n || typeof n !== 'object') return; if (n.t === 'var') set.add(n.n); for (const k in n) if (typeof n[k] === 'object') walk(n[k]); };
      walk(ast); return ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'M'].filter((v) => set.has(v));
    },
    solverStart() {
      const sv = this.solver;
      let ast; try { ast = C.parse(sv.ed.root); } catch (e) { C.showError(e); return; }
      if (ast.t === 'stmts') { C.showError(new C.CalcError('Syntax')); return; }
      const vars = this.solverVars(ast);
      if (!vars.length) { C.showError(new C.CalcError('Variable')); return; }
      G.appState.solverEq = JSON.parse(JSON.stringify(sv.ed.root)); C.save();
      sv.ast = ast; sv.target = sv.target && vars.includes(sv.target) ? sv.target : vars.includes('x') ? 'x' : vars[0];
      const self = this;
      const mkForm = () => new C.Form({
        title: '解く変数: ' + sv.target + '  [TOOLS]変更', btn: '実行',
        fields: vars.map((v) => ({ label: v + (v === sv.target ? ' (初期値)' : ''), value: G.vars[v === 'E' ? 'E' : v] || Q(0), key: v })),
        onSubmit: (vals) => { vars.forEach((v, i) => { G.vars[v] = vals[i]; }); self.runSolver(); },
      });
      sv.form = mkForm(); sv.vars = vars; sv.mkForm = mkForm; sv.view = 'vars';
    },
    runSolver() {
      const sv = this.solver; const t = sv.target;
      const ast = sv.ast;
      const f = (xv) => {
        const ctx = C.mkCtx('calc'); const old = G.vars[t]; G.vars[t] = xv;
        try { if (ast.t === 'rel') { if (ast.op !== '=') throw new C.CalcError('Syntax'); return num(V.realOnly(V.sub(C.evaluate(ast.a, ctx), C.evaluate(ast.b, C.mkCtx('calc'))))); } return num(V.realOnly(C.evaluate(ast, ctx))); }
        finally { G.vars[t] = old; }
      };
      let x = num(G.vars[t] || Q(0));
      let ok = false;
      try {
        for (let it = 0; it < 150; it++) {
          const fx = f(x);
          if (Math.abs(fx) < 1e-14) { ok = true; break; }
          const h = Math.max(1e-7, Math.abs(x) * 1e-7);
          const d = (f(x + h) - f(x - h)) / (2 * h);
          if (!Number.isFinite(d) || d === 0) { x += 0.5 + Math.abs(x) * 0.1; continue; }
          let nx = x - fx / d;
          // ダンピング
          let lam = 1; while (lam > 1e-4 && Math.abs(f(nx)) > Math.abs(fx) * 1.5) { lam /= 2; nx = x - lam * fx / d; }
          if (Math.abs(nx - x) < 1e-14 * Math.max(1, Math.abs(x))) { x = nx; ok = Math.abs(f(x)) < 1e-9 * Math.max(1, Math.abs(x)); break; }
          x = nx;
        }
        if (!ok) ok = Math.abs(f(x)) < 1e-9;
      } catch (e) { C.showError(e.code ? e : new C.CalcError('CantSolve')); return; }
      if (!ok || !Number.isFinite(x)) { C.showError(new C.CalcError('CantSolve')); return; }
      x = Number(x.toPrecision(15)); if (Math.abs(x) < 1e-13) x = 0;
      G.vars[t] = x; G.ans = x; C.save();
      let lr = f(x); if (Math.abs(lr) < 1e-12 * Math.max(1, Math.abs(x))) lr = 0;
      sv.res = { x, lr }; sv.view = 'res';
    },
    render() {
      if (this.kind === 'solver' && this.solver) {
        const sv = this.solver;
        if (sv.view === 'eq') return '<div class="calc"><div class="lbl-sm">ソルバー: 方程式を入力 [EXE]</div><div class="input ' + sv.ed.mode + '">' + sv.ed.render(true) + '</div></div>';
        if (sv.view === 'vars') return sv.form.render();
        if (sv.view === 'res') {
          return '<div class="calc"><div class="input ' + sv.ed.mode + '">' + sv.ed.render(false) + '</div><div class="output" style="font-size:15px"><div><span class="tk">' + esc(sv.target) + '=</span>' + C.fmtValue(sv.res.x, G.s, { fmt: 'dec' }).html + '</div><div class="lbl-sm"><span class="tk">左辺−右辺=</span>' + C.fmtValue(Number(sv.res.lr.toPrecision(10)), G.s, { fmt: 'dec' }).html + '</div></div></div>';
        }
      }
      if (this.grid) return this.grid.render();
      return '';
    },
    key(k) {
      if (k === 'tools') return false;
      if (this.kind === 'solver' && this.solver) {
        const sv = this.solver;
        if (sv.view === 'eq') {
          if (k === 'exe' || k === 'ok') { this.solverStart(); return true; }
          if (k === 'ac') { sv.ed.clear(); return true; }
          if (k === 'back') { this.chooseKind(); return true; }
          if (k === 'variable') { C.openVariables({ onRecall: (t) => sv.ed.insert(t), getValue: () => undefined }); return true; }
          if (k === 'catalog') { C.openCatalog([CAT.func, CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.const, CAT.other], sv.ed); return true; }
          if (k === 'fx') { C.openFxMenu(sv.ed); return true; }
          C.inputKey(sv.ed, k, {}); return true;
        }
        if (sv.view === 'vars') { if (k === 'back') { sv.view = 'eq'; return true; } sv.form.key(k); return true; }
        if (sv.view === 'res') {
          if (k === 'variable') { C.openVariables({ onRecall: () => {}, getValue: () => sv.res.x }); return true; }
          if (k === 'exe') { this.solverStart(); this.runSolver(); return true; }
          if (['back', 'ac', 'ok', 'left', 'right'].includes(k)) { sv.view = 'eq'; return true; }
          return true;
        }
      }
      if (!this.grid) return true;
      if (!this.grid.ed) {
        if (k === 'exe' && this.grid.r === this.coef.length - 1 && this.grid.c === this.coef[0].length - 1 || k === 'ok') { this.solve(); return true; }
        if (k === 'ac') { this.coef = this.coef.map((r) => r.map(() => Q(0))); this.persist(); return true; }
        if (k === 'back') { this.chooseKind(); return true; }
        if (k === 'exe') { this.grid.advanceNext(); return true; }
      }
      return this.grid.key(k) || true;
    },
    tools() {
      const t = [{ label: '方程式の種類', action: () => this.chooseKind() }];
      if (this.kind === 'poly') t.push({ label: '複素数解', right: () => (G.s.cxRoots !== false ? 'する' : 'しない'), sub: () => [[true, 'する'], [false, 'しない']].map(([v, l]) => ({ label: l, checked: () => (G.s.cxRoots !== false) === v, action: () => { G.s.cxRoots = v; C.save(); C.popAll(); } })) });
      if (this.kind === 'solver' && this.solver && this.solver.view === 'vars') t.push({ label: '解く変数', sub: () => this.solver.vars.map((v) => ({ label: v, checked: () => this.solver.target === v, action: () => { this.solver.target = v; this.solver.form = this.solver.mkForm(); C.popAll(); } })) });
      return t;
    },
    status() { return ''; },
    editor() { if (this.kind === 'solver' && this.solver) return this.solver.view === 'eq' ? this.solver.ed : null; return this.grid ? this.grid.ed : null; },
    onIO() { if (this.solver) this.solver.ed = new C.Editor(C.edMode()); },
  };
  const sub = (n) => '₀₁₂₃₄₅'[n];

  // ===== 不等式 =====
  const INEQ_OPS = ['>', '<', '≥', '≤'];
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
  function ineqHtml(res) {
    const { rs, segs } = res;
    if (!segs.length) return ['<span class="tk">解なし</span>'];
    if (segs.length === 1 && segs[0].lo === null && segs[0].hi === null) return ['<span class="tk">すべての実数</span>'];
    const X = '<span class="tk ital">x</span>';
    const rel = (inc) => '<span class="tk">' + (inc ? '≤' : '<') + '</span>';
    return segs.map((s) => {
      if (s.lo !== null && s.hi !== null && s.lo === s.hi) return X + '<span class="tk">=</span>' + fv(rs[s.lo]);
      if (s.lo === null) return X + '<span class="tk">' + (s.hiIn ? '≤' : '<') + '</span>' + fv(rs[s.hi]);
      if (s.hi === null) return fv(rs[s.lo]) + rel(s.loIn) + X;
      return fv(rs[s.lo]) + rel(s.loIn) + X + rel(s.hiIn) + fv(rs[s.hi]);
    });
  }
  const ineq = {
    id: 'ineq', name: '不等式', short: '不等式', icon: '<span style="font-size:14px"><i>x</i>²&gt;0</span>',
    init() { const st = G.appState.ineq || {}; this.n = st.n || 2; this.op = st.op || '>'; this.coef = st.coef || null; this.grid = null; this.res = null; },
    persist() { G.appState.ineq = { n: this.n, op: this.op, coef: this.coef }; C.save(); },
    enter() { if (this.n === undefined) this.init(); this.choose(); },
    reset() { delete G.appState.ineq; this.init(); },
    poly(n) { return ['', '', 'ax²+bx+c', 'ax³+bx²+cx+d', 'ax⁴+bx³+cx²+dx+e'][n]; },
    choose() {
      C.menu('不等式の次数', [2, 3, 4].map((n) => ({
        label: n + '次不等式', sub: () => INEQ_OPS.map((op) => ({ label: this.poly(n) + op + '0', action: () => { if (n !== this.n || !this.coef) this.coef = Array(n + 1).fill(Q(0)); this.n = n; this.op = op; this.persist(); C.popAll(); this.mkGrid(); } })),
      })), { noAC: true });
    },
    mkGrid() {
      const self = this; this.res = null;
      this.grid = new C.CellGrid({ rows: 1, cols: this.n + 1, colLabel: (c) => 'abcde'[c], rowLabel: () => '', visRows: 1, visCols: 5, get: (r, c) => self.coef[c], set: (r, c, v) => { self.coef[c] = v; self.persist(); }, title: this.poly(this.n) + this.op + '0' });
    },
    render() {
      if (this.res) {
        const parts = ineqHtml(this.res);
        return '<div class="calc"><div class="input lbl-sm">' + esc(this.poly(this.n) + this.op + '0') + '</div><div class="output" style="white-space:normal;line-height:1.5">' + parts.map((p) => '<span class="expr">' + p + '</span>').join('<span class="tk">, </span>') + '</div></div>';
      }
      return this.grid ? this.grid.render() : '';
    },
    key(k) {
      if (k === 'tools') return false;
      if (this.res) { if (['back', 'ac', 'ok', 'exe', 'left', 'right'].includes(k)) this.res = null; return true; }
      if (!this.grid) return true;
      if (!this.grid.ed) {
        if (k === 'ok' || (k === 'exe' && this.grid.c === this.n)) { try { if (E.isZero(this.coef[0])) throw new C.CalcError('Math'); this.res = ineqSolve(this.coef, this.op); } catch (e) { C.showError(e); } return true; }
        if (k === 'ac') { this.coef = this.coef.map(() => Q(0)); this.persist(); return true; }
        if (k === 'back') { this.choose(); return true; }
      }
      return this.grid.key(k) || true;
    },
    tools() { return [{ label: '不等式の種類', action: () => this.choose() }]; },
    status() { return ''; },
    editor() { return this.grid ? this.grid.ed : null; },
  };

  // ===== 数表作成 =====
  const table = {
    id: 'table', name: '数表作成', short: '数表', icon: '<span style="font-size:13px"><i>f</i>(<i>x</i>)▦</span>',
    init() { const st = G.appState.table || {}; this.type = st.type || 'fg'; this.range = st.range || [1, 5, 1]; this.xs = (st.xs || []).map((x) => x); this.view = st.xs ? 'table' : 'def'; this.which = 'f'; this.eds = null; this.mkEds(); },
    persist() { G.appState.table = { type: this.type, range: this.range, xs: this.view === 'table' ? this.xs : null }; C.save(); },
    mkEds() { this.eds = { f: new C.Editor(C.edMode()), g: new C.Editor(C.edMode()) }; this.eds.f.setTokens(G.fdef.f || []); this.eds.g.setTokens(G.fdef.g || []); },
    enter() { if (!this.eds) this.init(); this.mkEds(); if (this.view === 'table') this.mkGrid(); },
    reset() { delete G.appState.table; this.init(); },
    onIO() { this.mkEds(); },
    maxRows() { return this.type === 'fg' ? 30 : 45; },
    cols() { return this.type === 'fg' ? ['x', 'f(x)', 'g(x)'] : this.type === 'f' ? ['x', 'f(x)'] : ['x', 'g(x)']; },
    evalAt(fn, x) {
      const def = G.fdef[fn]; if (!def || !def.length) return undefined;
      try { const ctx = C.mkCtx('calc'); const old = G.vars.x; G.vars.x = x; try { return V.realOnly(C.evaluate(C.parse(def), ctx)); } finally { G.vars.x = old; } } catch (e) { return 'ERROR'; }
    },
    generate() {
      const [s, e, st] = this.range;
      if (st === 0 || (e - s) / st < 0) throw new C.CalcError('Range');
      const cnt = Math.floor((e - s) / st + 1e-9) + 1;
      if (cnt > this.maxRows()) throw new C.CalcError('Range');
      this.xs = []; for (let i = 0; i < cnt; i++) { const x = E.add(E.fromDecimal(String(s)), E.mul(E.fromDecimal(String(st)), Q(i))); this.xs.push(x); }
      if (this.xs.length) G.vars.x = this.xs[this.xs.length - 1];
      this.view = 'table'; this.mkGrid(); this.persist();
    },
    mkGrid() {
      const self = this; const cols = this.cols();
      this.grid = new C.CellGrid({
        rows: () => self.xs.length, cols: cols.length, colLabel: (c) => cols[c], visRows: 5, visCols: 3, advance: 'down', growable: true, maxRows: self.maxRows() + 1,
        get: (r, c) => { if (r >= self.xs.length) return undefined; const x = self.xs[r]; if (c === 0) return x; const fn = cols[c][0]; return self.evalAt(fn, x); },
        cellText(r, c) { const v = this.get(r, c); return v === undefined ? '' : v === 'ERROR' ? 'ERROR' : C.shortText(v, G.s, 9); },
        cellFull(r, c) { const v = this.get(r, c); return v === undefined ? '' : v === 'ERROR' ? '<span class="tk">ERROR</span>' : C.fmtValue(v, G.s, {}).html; },
        canEdit: (r, c) => c === 0,
        set: (r, c, v) => { if (r >= self.maxRows()) { C.showError(new C.CalcError('Range')); return; } if (r >= self.xs.length) self.xs.push(v); else self.xs[r] = v; G.vars.x = v; self.persist(); },
        onDel: (r) => { if (r < self.xs.length) { self.xs.splice(r, 1); self.persist(); } },
      });
    },
    openRange() {
      const f = new C.Form({
        title: '数表範囲', btn: '実行', fields: [['開始値', 0], ['終了値', 1], ['ステップ', 2]].map(([l, i]) => ({ label: l, value: E.fromDecimal(String(this.range[i]).replace('e+', 'E').replace('e', 'E')) })),
        onSubmit: (vals) => { this.range = vals.map(num); try { this.generate(); C.pop(f); } catch (e) { C.showError(e); } },
      });
      C.push(f);
    },
    render() {
      if (this.view === 'def') {
        const row = (fn) => '<div style="display:flex;align-items:center;gap:2px;min-height:44%;' + (this.which === fn ? '' : 'opacity:.75') + '"><span class="tk">' + fn + '(<i>x</i>)=</span><div class="input ' + this.eds[fn].mode + '" style="overflow:hidden;white-space:nowrap">' + this.eds[fn].render(this.which === fn) + '</div></div>';
        const showF = this.type !== 'g', showG = this.type !== 'f';
        return '<div class="calc">' + (showF ? row('f') : '') + (showG ? row('g') : '') + '<div class="lbl-sm" style="text-align:right">[EXE] 数表範囲へ</div></div>';
      }
      return this.grid.render();
    },
    key(k) {
      if (k === 'tools') return false;
      if (this.view === 'def') {
        const ed = this.eds[this.which];
        if (k === 'exe' || k === 'ok' || ((k === 'down' || k === 'up') && !ed.findParent(ed.cur.row))) {
          G.fdef[this.which] = JSON.parse(JSON.stringify(ed.root)); C.save();
          const both = this.type === 'fg';
          if (k === 'up' || k === 'down') { if (both) this.which = this.which === 'f' ? 'g' : 'f'; return true; }
          if (both && this.which === 'f' && k === 'exe') { this.which = 'g'; return true; }
          for (const fn of ['f', 'g']) { if (this.eds[fn].root.length) { try { C.parse(this.eds[fn].root); } catch (e) { this.which = fn; C.showError(e); return true; } } }
          G.fdef.f = JSON.parse(JSON.stringify(this.eds.f.root)); G.fdef.g = JSON.parse(JSON.stringify(this.eds.g.root)); C.save();
          this.which = this.type === 'g' ? 'g' : 'f';
          this.openRange(); return true;
        }
        if (k === 'ac') { ed.clear(); return true; }
        if (k === 'back') return true;
        if (k === 'variable') { C.openVariables({ onRecall: (t) => ed.insert(t), getValue: () => undefined }); return true; }
        if (k === 'catalog') { C.openCatalog([CAT.func, CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.const, CAT.other], ed); return true; }
        if (k === 'fx') return true;
        C.inputKey(ed, k, {}); return true;
      }
      // 数表
      const g = this.grid;
      if (!g.ed) {
        if (k === 'back' || k === 'ac') { this.view = 'def'; this.persist(); return true; }
        if ((k === 'add' || k === 'sub' || k === 'exe') && g.c === 0 && g.r > 0 && g.r <= this.xs.length) {
          if (k === 'exe' && g.r < this.xs.length) { g.move(1, 0); return true; }
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
        { label: '数表の種類', right: () => ({ fg: 'f(x)/g(x)', f: 'f(x)', g: 'g(x)' }[this.type]), sub: () => [['fg', 'f(x)/g(x)'], ['f', 'f(x)'], ['g', 'g(x)']].map(([v, l]) => ({ label: l, checked: () => this.type === v, action: () => { this.type = v; this.which = v === 'g' ? 'g' : 'f'; if (this.view === 'table') { if (this.xs.length > this.maxRows()) this.xs = this.xs.slice(0, this.maxRows()); this.mkGrid(); } this.persist(); C.popAll(); } })) },
        { label: 'f(x)/g(x)の定義', action: () => { C.popAll(); this.view = 'def'; this.mkEds(); } },
        { label: '数表範囲', action: () => { C.popAll(); this.openRange(); } },
        { label: '編集', sub: () => [
          { label: '行の挿入', action: () => { if (this.view === 'table' && this.xs.length < this.maxRows()) { this.xs.splice(this.grid.r, 0, Q(0)); this.persist(); } C.popAll(); } },
          { label: 'すべてのデータを削除', action: () => { this.xs = []; if (this.grid) this.grid.r = 0; this.persist(); C.popAll(); } },
        ] },
        { label: '再計算', action: () => { C.popAll(); } },
      ];
    },
    status() { return ''; },
    editor() { return this.view === 'def' ? this.eds[this.which] : this.grid && this.grid.ed; },
  };

  // ===== Math Box =====
  function svgNumberLine(lines) {
    // lines: [{type, a, b}] 値は number
    const vals = []; for (const l of lines) if (l) { vals.push(l.a); if (l.b !== undefined) vals.push(l.b); }
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (!vals.length) { lo = -5; hi = 5; }
    if (lo === hi) { lo -= 5; hi += 5; }
    const span = hi - lo; lo -= span * 0.35; hi += span * 0.35;
    const W = 300, H = 110, X = (v) => 10 + (v - lo) / (hi - lo) * (W - 20);
    let s = '<svg class="fig" width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="max-height:96px">';
    const ay = 85;
    s += '<line x1="4" y1="' + ay + '" x2="' + (W - 4) + '" y2="' + ay + '" stroke="currentColor" stroke-width="1.5"/>';
    // 目盛り
    const stepRaw = (hi - lo) / 8; const p = Math.pow(10, Math.floor(Math.log10(stepRaw))); const step = [1, 2, 5, 10].map((m) => m * p).find((m) => m >= stepRaw);
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) { const x = X(t); s += '<line x1="' + x + '" y1="' + (ay - 3) + '" x2="' + x + '" y2="' + (ay + 3) + '" stroke="currentColor"/><text x="' + x + '" y="' + (ay + 15) + '" font-size="10" text-anchor="middle" fill="currentColor">' + Number(t.toPrecision(6)) + '</text>'; }
    lines.forEach((l, i) => {
      if (!l) return;
      const y = ay - 20 - i * 26;
      const dot = (v, closed) => '<circle cx="' + X(v) + '" cy="' + y + '" r="4" fill="' + (closed ? 'currentColor' : 'var(--lcd-bg)') + '" stroke="currentColor" stroke-width="1.5"/><line x1="' + X(v) + '" y1="' + y + '" x2="' + X(v) + '" y2="' + ay + '" stroke="currentColor" stroke-dasharray="2 2"/>';
      const seg = (x1, x2) => '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="currentColor" stroke-width="3"/>';
      const t = l.type;
      if (t === 'x<a' || t === 'x≤a') s += seg(4, X(l.a)) + dot(l.a, t === 'x≤a');
      else if (t === 'x>a' || t === 'x≥a') s += seg(X(l.a), W - 4) + dot(l.a, t === 'x≥a');
      else { s += seg(X(l.a), X(l.b)) + dot(l.a, t[1] === '≤') + dot(l.b, t[3] === '≤'); }
      s += '<text x="4" y="' + (y - 6) + '" font-size="10" fill="currentColor">' + '①②'[i] + '</text>';
    });
    return s + '</svg>';
  }
  function svgCircle(thRad, half) {
    const W = 300, H = 132, R = half ? 100 : 56, cx = half ? 150 : 100, cy = half ? 116 : 64;
    const px = cx + R * Math.cos(thRad), py = cy - R * Math.sin(thRad);
    let s = '<svg class="fig" width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="max-height:128px">';
    s += '<line x1="' + (cx - R - 10) + '" y1="' + cy + '" x2="' + (cx + R + 10) + '" y2="' + cy + '" stroke="currentColor"/>';
    s += '<line x1="' + cx + '" y1="' + (half ? cy : cy + R + 6) + '" x2="' + cx + '" y2="' + (cy - R - 6) + '" stroke="currentColor"/>';
    s += half ? '<path d="M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy + '" fill="none" stroke="currentColor" stroke-width="1.5"/>' : '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="currentColor" stroke-width="1.5"/>';
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + px + '" y2="' + py + '" stroke="currentColor" stroke-width="2"/>';
    s += '<line x1="' + px + '" y1="' + py + '" x2="' + px + '" y2="' + cy + '" stroke="currentColor" stroke-dasharray="3 2"/>';
    const a1 = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, thRad)); const r0 = 14;
    s += '<path d="M ' + (cx + r0) + ' ' + cy + ' A ' + r0 + ' ' + r0 + ' 0 ' + (Math.abs(a1) % (2 * Math.PI) > Math.PI ? 1 : 0) + ' ' + (a1 >= 0 ? 0 : 1) + ' ' + (cx + r0 * Math.cos(a1)) + ' ' + (cy - r0 * Math.sin(a1)) + '" fill="none" stroke="currentColor"/>';
    s += '<circle cx="' + px + '" cy="' + py + '" r="3" fill="currentColor"/><text x="' + (px + 5) + '" y="' + (py - 4) + '" font-size="10" fill="currentColor">P</text>';
    s += '<text x="' + (cx + R + 2) + '" y="' + (cy + 11) + '" font-size="9" fill="currentColor">1</text>';
    return s + '</svg>';
  }
  const mbox = {
    id: 'mbox', name: 'Math Box', short: 'Math Box', icon: '<span style="font-size:13px">⚀ ◐</span>',
    init() { const st = G.appState.mbox || {}; this.dice = st.dice || { n: 1, tries: 10 }; this.coin = st.coin || { n: 1, tries: 10 }; this.nl = st.nl || [null, null]; this.circ = st.circ || { th: 30, half: false }; this.view = 'menu'; this.res = null; this.page = 0; this.top = 0; },
    persist() { G.appState.mbox = { dice: this.dice, coin: this.coin, nl: this.nl, circ: this.circ }; C.save(); },
    enter() { if (!this.dice) this.init(); this.menu(); },
    reset() { delete G.appState.mbox; this.init(); },
    menu() {
      C.menu('Math Box', [
        { label: 'サイコロ', action: () => { C.popAll(); this.simForm('dice'); } },
        { label: 'コイントス', action: () => { C.popAll(); this.simForm('coin'); } },
        { label: '数直線', action: () => { C.popAll(); this.view = 'nl'; } },
        { label: '円', action: () => { C.popAll(); this.view = 'circ'; } },
      ], { noAC: true });
    },
    simForm(kind) {
      const cfg = this[kind];
      this.view = 'form'; this.kind = kind;
      this.form = new C.Form({
        title: kind === 'dice' ? 'サイコロ' : 'コイントス', btn: '実行',
        fields: [{ label: '試行回数', value: Q(cfg.tries) }, { label: kind === 'dice' ? 'サイコロの数' : 'コインの数', value: Q(cfg.n) }],
        onSubmit: (vals) => {
          const [tr, n] = vals;
          if (!E.isInt(tr) || !E.isInt(n) || num(tr) < 1 || num(tr) > 250 || num(n) < 1 || num(n) > 3) { C.showError(new C.CalcError('Range')); return; }
          cfg.tries = num(tr); cfg.n = num(n); this.persist(); this.run();
        },
      });
    },
    run() {
      const kind = this.kind, cfg = this[kind];
      const trials = [];
      for (let i = 0; i < cfg.tries; i++) {
        const faces = Array.from({ length: cfg.n }, () => (kind === 'dice' ? 1 + Math.floor(Math.random() * 6) : Math.random() < 0.5 ? 1 : 0));
        trials.push(faces);
      }
      const lo = kind === 'dice' ? cfg.n : 0, hi = kind === 'dice' ? 6 * cfg.n : cfg.n;
      const counts = {}; for (let v = lo; v <= hi; v++) counts[v] = 0;
      for (const t of trials) counts[t.reduce((a, b) => a + b, 0)]++;
      this.res = { trials, counts, lo, hi }; this.view = 'res'; this.page = 0; this.top = 0;
    },
    render() {
      if (this.view === 'form') return this.form.render();
      if (this.view === 'res') {
        const r = this.res, kind = this.kind, tries = this[kind].tries;
        let h = '<div class="lbl-sm" style="display:flex;justify-content:space-between"><span>' + (this.page === 0 ? '相対度数' : '試行結果') + '</span><span>[◀][▶]切替 [EXE]再試行</span></div><table class="grid">';
        if (this.page === 0) {
          h += '<tr><th>' + (kind === 'dice' ? (this[kind].n > 1 ? '目の和' : '出目') : '表の枚数') + '</th><th>回数</th><th>相対度数</th></tr>';
          const keys = Object.keys(r.counts).map(Number);
          const vis = keys.slice(this.top, this.top + 5);
          for (const k of vis) h += '<tr><td>' + k + '</td><td>' + r.counts[k] + '</td><td>' + Number((r.counts[k] / tries).toPrecision(6)) + '</td></tr>';
        } else {
          h += '<tr><th class="rh">回</th><th>' + (kind === 'dice' ? '出目' : '表/裏') + '</th><th>' + (kind === 'dice' ? '和' : '表の枚数') + '</th></tr>';
          for (let i = this.top; i < Math.min(r.trials.length, this.top + 5); i++) {
            const t = r.trials[i];
            h += '<tr><th class="rh">' + (i + 1) + '</th><td>' + (kind === 'dice' ? t.join(',') : t.map((x) => (x ? '表' : '裏')).join(',')) + '</td><td>' + t.reduce((a, b) => a + b, 0) + '</td></tr>';
          }
        }
        return h + '</table>';
      }
      if (this.view === 'nl') {
        const lab = (l) => (l ? l.type.replace('a', fmtN(l.a)).replace('b', l.b !== undefined ? fmtN(l.b) : '') : '（未設定）');
        return '<div class="lbl-sm">数直線  ①' + esc(lab(this.nl[0])) + '  ②' + esc(lab(this.nl[1])) + '</div>' + svgNumberLine(this.nl) + '<div class="lbl-sm" style="text-align:right">[1][2] 不等式を設定</div>';
      }
      if (this.view === 'circ') {
        const c = this.circ; const ctx = C.mkCtx('calc');
        const th = E.fromDecimal(String(c.th));
        const H = C.evalHelpers; let sv, cv, tv;
        try { sv = fv(V.R(H.sinF(th, ctx))); } catch (e) { sv = 'ERROR'; }
        try { cv = fv(V.R(H.cosF(th, ctx))); } catch (e) { cv = 'ERROR'; }
        try { tv = fv(V.R(H.tanF(th, ctx))); } catch (e) { tv = '<span class="tk">ERROR</span>'; }
        const rad = H.toRad(th, G.s.angle);
        return '<div style="display:flex;gap:4px;align-items:center;height:100%"><div style="flex:1.2">' + svgCircle(rad, c.half) + '</div><div class="circ-vals"><div>θ=' + fv(th) + '</div><div>sinθ=' + sv + '</div><div>cosθ=' + cv + '</div><div>tanθ=' + tv + '</div><div class="lbl-sm">[◀][▶]±15° [OK]θ入力</div></div></div>';
      }
      return '';
    },
    key(k) {
      if (k === 'tools') return false;
      if (this.view === 'form') { if (k === 'back') { this.menu(); return true; } this.form.key(k); return true; }
      if (this.view === 'res') {
        if (k === 'left' || k === 'right') { this.page = 1 - this.page; this.top = 0; return true; }
        const total = this.page === 0 ? Object.keys(this.res.counts).length : this.res.trials.length;
        if (k === 'down') { this.top = Math.min(Math.max(0, total - 5), this.top + 1); return true; }
        if (k === 'up') { this.top = Math.max(0, this.top - 1); return true; }
        if (k === 'exe') { this.run(); return true; }
        if (k === 'back' || k === 'ac' || k === 'ok') { this.simForm(this.kind); return true; }
        return true;
      }
      if (this.view === 'nl') {
        if (k === '1' || k === '2') { this.setLine(+k - 1); return true; }
        if (k === 'del') { this.nl = [null, null]; this.persist(); return true; }
        if (k === 'back' || k === 'ac') { this.menu(); return true; }
        if (k === 'ok' || k === 'exe') { this.setLine(this.nl[0] ? 1 : 0); return true; }
        return true;
      }
      if (this.view === 'circ') {
        const step = G.s.angle === 'deg' ? 15 : G.s.angle === 'gra' ? 50 / 3 : Math.PI / 12;
        if (k === 'left' || k === 'right') { this.circ.th = Number((this.circ.th + (k === 'right' ? step : -step)).toPrecision(12)); this.persist(); return true; }
        if (k === 'ok' || k === 'exe') {
          const f = new C.Form({ title: '角度 θ', fields: [{ label: 'θ', value: E.fromDecimal(String(this.circ.th)) }], onSubmit: (v) => { this.circ.th = num(v[0]); this.persist(); C.pop(f); } });
          C.push(f); return true;
        }
        if (k === 'back' || k === 'ac') { this.menu(); return true; }
        return true;
      }
      return true;
    },
    setLine(i) {
      const types = ['x<a', 'x≤a', 'x>a', 'x≥a', 'a<x<b', 'a≤x<b', 'a<x≤b', 'a≤x≤b'];
      C.menu('不等式 ' + '①②'[i], types.map((t) => ({
        label: t, action: () => {
          const two = t.startsWith('a');
          const cur = this.nl[i] || {};
          const f = new C.Form({
            title: t, fields: [{ label: 'a', value: E.fromDecimal(String(cur.a !== undefined ? cur.a : 0)) }].concat(two ? [{ label: 'b', value: E.fromDecimal(String(cur.b !== undefined ? cur.b : 1)) }] : []),
            onSubmit: (v) => { const a = num(v[0]), b = two ? num(v[1]) : undefined; if (two && !(a < b)) { C.showError(new C.CalcError('Argument')); return; } this.nl[i] = { type: t, a, b }; this.persist(); C.popAll(); },
          });
          C.popAll(); C.push(f);
        },
      })).concat([{ label: '削除', action: () => { this.nl[i] = null; this.persist(); C.popAll(); } }]));
    },
    tools() {
      const t = [{ label: 'Math Box メニュー', action: () => this.menu() }];
      if (this.view === 'circ') t.push({ label: '表示', right: () => (this.circ.half ? '半円' : '単位円'), sub: () => [[false, '単位円'], [true, '半円']].map(([v, l]) => ({ label: l, checked: () => this.circ.half === v, action: () => { this.circ.half = v; this.persist(); C.popAll(); } })) });
      return t;
    },
    status() { return ''; },
    editor() { return null; },
  };
  function fmtN(v) { return String(Number(v.toPrecision(8))); }

  Object.assign(C.lateApps, { eq, ineq, table, mbox });
})(window.C = window.C || {});
