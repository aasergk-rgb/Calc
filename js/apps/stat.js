/* 統計計算・分布計算 */
(function (C) {
  'use strict';
  const G = C.G, E = C.E, V = C.V, esc = C.esc, CAT = C.CATALOG, Q = E.Q;
  const num = E.toNum;

  // ===== 統計変数 =====
  const SV = {
    n: 'n', xbar: 'x̄', sx: 'Σx', sx2: 'Σx²', varx: 'σ²x', sdx: 'σx', svarx: 's²x', ssdx: 'sx',
    ybar: 'ȳ', sy: 'Σy', sy2: 'Σy²', vary: 'σ²y', sdy: 'σy', svary: 's²y', ssdy: 'sy',
    sxy: 'Σxy', sx3: 'Σx³', sx2y: 'Σx²y', sx4: 'Σx⁴',
    minx: 'min(x)', maxx: 'max(x)', miny: 'min(y)', maxy: 'max(y)', q1: 'Q₁', med: 'Med', q3: 'Q₃',
    a: 'a', b: 'b', c: 'c', r: 'r',
  };
  C.STATVAR_DISP = SV;
  const REGS = [
    ['lin', 'y=a+bx'], ['quad', 'y=a+bx+cx²'], ['log', 'y=a+b·ln(x)'], ['eexp', 'y=a·e^(bx)'], ['abexp', 'y=a·b^x'], ['pow', 'y=a·x^b'], ['inv', 'y=a+b/x'],
  ];

  function Stats(data, two, regType) {
    // data: {x:[],y:[],f:[]} 値は実数
    const n = data.x.length;
    const fr = (i) => (data.f && data.f[i] !== undefined ? data.f[i] : Q(1));
    const cache = {};
    const sum = (fn) => { let s = Q(0); for (let i = 0; i < n; i++) s = V.add(s, V.mul(fr(i), fn(i))); return s; };
    const X = (i) => data.x[i], Y = (i) => data.y[i];
    const self = {
      get(name) {
        if (cache[name] !== undefined) return cache[name];
        const v = compute(name); cache[name] = v; return v;
      },
      val(name) { const m = { xbar: 'xbar', sx_pop: 'sdx' }; return num(self.get(m[name] || name)); },
      estimate(op, v) {
        const reg = regType || 'lin';
        const a = num(self.get('a')), b = num(self.get('b'));
        if (op === 'yh') {
          switch (reg) {
            case 'lin': return a + b * v; case 'quad': return a + b * v + num(self.get('c')) * v * v; case 'log': if (v <= 0) throw new C.CalcError('Math'); return a + b * Math.log(v);
            case 'eexp': return a * Math.exp(b * v); case 'abexp': return a * Math.pow(b, v); case 'pow': return a * Math.pow(v, b); case 'inv': if (v === 0) throw new C.CalcError('Math'); return a + b / v;
          }
        }
        if (reg === 'quad') {
          const c = num(self.get('c'));
          const d = b * b - 4 * c * (a - v); if (d < 0 || c === 0) throw new C.CalcError('Math');
          const r1 = (-b + Math.sqrt(d)) / (2 * c), r2 = (-b - Math.sqrt(d)) / (2 * c);
          if (op === 'xh1') return r1;
          if (op === 'xh2') return r2;
          throw new C.CalcError('Syntax');
        }
        if (op !== 'xh') throw new C.CalcError('Syntax');
        if (b === 0 && reg !== 'eexp') throw new C.CalcError('Math');
        switch (reg) {
          case 'lin': return (v - a) / b; case 'log': return Math.exp((v - a) / b);
          case 'eexp': if (v / a <= 0 || b === 0) throw new C.CalcError('Math'); return Math.log(v / a) / b;
          case 'abexp': return Math.log(v / a) / Math.log(b); case 'pow': return Math.pow(v / a, 1 / b); case 'inv': return b / (v - a);
        }
      },
    };
    function need2() { if (!two) throw new C.CalcError('Syntax'); }
    function cnt() { const c = sum(() => Q(1)); if (E.isZero(c)) throw new C.CalcError('Math'); return c; }
    function sorted() {
      const arr = [];
      for (let i = 0; i < n; i++) { const f = fr(i); if (!E.isInt(f) || E.sign(f) < 0) throw new C.CalcError('Math'); for (let k = 0; k < Number(E.bigOf(f)); k++) arr.push(X(i)); }
      if (!arr.length) throw new C.CalcError('Math');
      return arr.sort((a, b) => E.cmp(a, b));
    }
    const median = (a) => { const m = a.length; return m % 2 ? a[(m - 1) / 2] : V.div(V.add(a[m / 2 - 1], a[m / 2]), Q(2)); };
    function reg() {
      if (cache.__reg) return cache.__reg;
      need2();
      const t = regType || 'lin';
      const tx = (i) => (t === 'log' || t === 'pow' ? lnv(X(i)) : t === 'inv' ? V.div(Q(1), X(i)) : X(i));
      const ty = (i) => (t === 'eexp' || t === 'abexp' || t === 'pow' ? lnv(Y(i)) : Y(i));
      const N = cnt();
      let res;
      if (t === 'quad') {
        const S = (fx) => sum(fx);
        const sx = S(X), sx2 = S((i) => V.mul(X(i), X(i))), sx3 = S((i) => V.mul(V.mul(X(i), X(i)), X(i))), sx4 = S((i) => { const q = V.mul(X(i), X(i)); return V.mul(q, q); });
        const sy = S(Y), sxy = S((i) => V.mul(X(i), Y(i))), sx2y = S((i) => V.mul(V.mul(X(i), X(i)), Y(i)));
        const M = V.mkM([[N, sx, sx2], [sx, sx2, sx3], [sx2, sx3, sx4]]);
        let inv; try { inv = V.inverse(M); } catch (e) { throw new C.CalcError('Math'); }
        const sol = V.mul(inv, V.mkV([sy, sxy, sx2y]));
        res = { a: sol.a[0], b: sol.a[1], c: sol.a[2] };
      } else {
        const sx = sum(tx), sy = sum(ty), sxx = sum((i) => V.mul(tx(i), tx(i))), syy = sum((i) => V.mul(ty(i), ty(i))), sxy = sum((i) => V.mul(tx(i), ty(i)));
        const Sxx = V.sub(V.mul(N, sxx), V.mul(sx, sx)), Syy = V.sub(V.mul(N, syy), V.mul(sy, sy)), Sxy = V.sub(V.mul(N, sxy), V.mul(sx, sy));
        if (E.isZero(Sxx) || num(Sxx) === 0) throw new C.CalcError('Math');
        let b = V.div(Sxy, Sxx); let a = V.div(V.sub(sy, V.mul(b, sx)), N);
        const den = V.mul(Sxx, Syy);
        const r = E.isZero(den) || num(den) <= 0 ? Q(0) : V.div(Sxy, E.sqrt(den));
        if (t === 'eexp') a = Math.exp(num(a));
        if (t === 'abexp') { a = Math.exp(num(a)); b = Math.exp(num(b)); }
        if (t === 'pow') a = Math.exp(num(a));
        res = { a, b, r };
      }
      cache.__reg = res; return res;
    }
    function lnv(v) { const x = num(v); if (x <= 0) throw new C.CalcError('Math'); return Math.log(x); }
    function compute(name) {
      if (n === 0) throw new C.CalcError('Math');
      switch (name) {
        case 'n': return cnt();
        case 'sx': return sum(X);
        case 'sx2': return sum((i) => V.mul(X(i), X(i)));
        case 'xbar': return V.div(self.get('sx'), cnt());
        case 'varx': { const m = self.get('xbar'); return V.div(sum((i) => { const d = V.sub(X(i), m); return V.mul(d, d); }), cnt()); }
        case 'sdx': return V.R(E.sqrt(self.get('varx')));
        case 'svarx': { const c = cnt(); if (E.cmp(c, Q(1)) <= 0) throw new C.CalcError('Math'); return V.div(V.mul(self.get('varx'), c), V.sub(c, Q(1))); }
        case 'ssdx': return V.R(E.sqrt(self.get('svarx')));
        case 'minx': { let m = X(0); for (let i = 1; i < n; i++) if (E.cmp(X(i), m) < 0) m = X(i); return m; }
        case 'maxx': { let m = X(0); for (let i = 1; i < n; i++) if (E.cmp(X(i), m) > 0) m = X(i); return m; }
        case 'med': return median(sorted());
        case 'q1': case 'q3': {
          if (two) throw new C.CalcError('Syntax');
          const a = sorted(); const m = a.length; if (m === 1) return a[0];
          const h = Math.floor(m / 2);
          return name === 'q1' ? median(a.slice(0, h)) : median(a.slice(m - h));
        }
      }
      need2();
      switch (name) {
        case 'sy': return sum(Y);
        case 'sy2': return sum((i) => V.mul(Y(i), Y(i)));
        case 'sxy': return sum((i) => V.mul(X(i), Y(i)));
        case 'sx3': return sum((i) => V.mul(V.mul(X(i), X(i)), X(i)));
        case 'sx2y': return sum((i) => V.mul(V.mul(X(i), X(i)), Y(i)));
        case 'sx4': return sum((i) => { const q = V.mul(X(i), X(i)); return V.mul(q, q); });
        case 'ybar': return V.div(self.get('sy'), cnt());
        case 'vary': { const m = self.get('ybar'); return V.div(sum((i) => { const d = V.sub(Y(i), m); return V.mul(d, d); }), cnt()); }
        case 'sdy': return V.R(E.sqrt(self.get('vary')));
        case 'svary': { const c = cnt(); if (E.cmp(c, Q(1)) <= 0) throw new C.CalcError('Math'); return V.div(V.mul(self.get('vary'), c), V.sub(c, Q(1))); }
        case 'ssdy': return V.R(E.sqrt(self.get('svary')));
        case 'miny': { let m = Y(0); for (let i = 1; i < n; i++) if (E.cmp(Y(i), m) < 0) m = Y(i); return m; }
        case 'maxy': { let m = Y(0); for (let i = 1; i < n; i++) if (E.cmp(Y(i), m) > 0) m = Y(i); return m; }
        case 'a': case 'b': return reg()[name];
        case 'c': { const r = reg(); if (r.c === undefined) throw new C.CalcError('Syntax'); return r.c; }
        case 'r': { const r = reg(); if (r.r === undefined) throw new C.CalcError('Syntax'); return r.r; }
      }
      throw new C.CalcError('Syntax');
    }
    return self;
  }
  C.Stats = Stats;

  // ===== 統計値の一覧画面 =====
  function resultList(rows, opts) {
    opts = opts || {};
    let top = 0; const vis = opts.title ? 4 : 5;
    const ds = Object.assign({}, G.s, { io: 'ld' });
    const ov = {
      render() {
        let h = '<div class="ls">';
        let y = 1;
        if (opts.title) { h += '<div class="r" style="top:1px"><span class="a">' + esc(opts.title) + '</span></div>'; y = 11; }
        for (let i = top; i < Math.min(rows.length, top + vis); i++) {
          let v; try { v = C.fmtValue(rows[i][1](), ds, { fmt: 'dec' }).html.replace(/<[^>]+>/g, ''); } catch (e) { v = 'ERROR'; }
          h += '<div class="r" style="top:' + (y + (i - top) * 10) + 'px"><span class="a" style="left:' + (opts.title ? 44 : 30) + 'px">' + esc(rows[i][0]) + '</span><span class="b" style="left:' + (opts.title ? 56 : 66) + 'px">' + (opts.title ? '' : '') + '=' + esc(v) + '</span></div>';
        }
        if (rows.length > vis) h += '<div class="bar" style="top:' + (y + Math.round(top / rows.length * 50)) + 'px;height:' + Math.round(50 * vis / rows.length) + 'px"></div>';
        return h + '</div>';
      },
      key(k) {
        if (k === 'up') top = Math.max(0, top - 1);
        else if (k === 'down') top = Math.min(Math.max(0, rows.length - vis), top + 1);
        else if (k === 'pgup') top = Math.max(0, top - vis);
        else if (k === 'pgdn') top = Math.min(Math.max(0, rows.length - vis), top + vis);
        else if (['back', 'ac', 'ok', 'exe'].includes(k)) { C.pop(ov); if (opts.onClose) opts.onClose(); }
        return true;
      },
    };
    C.push(ov);
  }
  C.resultList = resultList;

  // ===== 統計アプリ =====
  const stat = {
    id: 'stat', name: '統計',
    init() {
      const st = G.appState.stat;
      this.two = st ? st.two : false; this.freq = st ? st.freq : false; this.regType = st ? st.reg : 'lin';
      this.data = st ? st.data : { x: [], y: [], f: [] };
      this.view = 'editor'; this.cs = null; this.started = false;
      this.mkGrid();
    },
    persist() { G.appState.stat = { two: this.two, freq: this.freq, reg: this.regType, data: this.data }; C.save(); },
    cols() { const c = ['x']; if (this.two) c.push('y'); if (this.freq) c.push('Freq'); return c; },
    maxRows() { return [160, 80, 53][this.cols().length - 1]; },
    colKey(c) { const n = this.cols()[c]; return n === 'Freq' ? 'f' : n; },
    mkGrid() {
      const self = this;
      this.grid = new C.TableGrid({
        rows: () => self.data.x.length, growable: true, maxRows: self.maxRows(), padRows: true,
        cols: () => self.cols().map((n) => ({ label: n, html: n === 'x' ? '𝑥' : n === 'y' ? '𝑦' : 'Freq', w: 34 })),
        get: (r, c) => { if (r >= self.data.x.length) return undefined; const k = self.colKey(c); return k === 'f' ? (self.data.f[r] === undefined ? E.Q(1) : self.data.f[r]) : self.data[k][r]; },
        set: (r, c, v) => {
          const k = self.colKey(c);
          if (r >= self.data.x.length) { self.data.x.push(E.Q(0)); if (self.two) self.data.y.push(E.Q(0)); self.data.f.push(E.Q(1)); }
          self.data[k][r] = v; self.persist();
        },
        onDel: (r) => { if (r < self.data.x.length) { for (const k of ['x', 'y', 'f']) self.data[k].splice(r, 1); self.persist(); } },
      });
    },
    enter() { if (!this.grid) this.init(); this.chooseType(); },
    chooseType() {
      C.menu([
        { label: '<span class="big">1</span>変数統計', html: true, action: () => this.setType(false) },
        { label: '<span class="big">2</span>変数統計', html: true, action: () => this.setType(true) },
      ], { noAC: true, sel: this.two ? 1 : 0, onBack: () => C.openHome() });
    },
    setType(two) {
      if (two !== this.two) this.data = { x: [], y: [], f: [] };
      this.two = two; this.view = 'editor'; this.mkGrid(); this.persist(); C.popAll();
    },
    stats() { return Stats(this.data, this.two, this.regType); },
    oneTwoList() {
      const s = this.stats();
      const L = (k) => [SV[k], () => s.get(k)];
      const one = ['xbar', 'sx', 'sx2', 'varx', 'sdx', 'svarx', 'ssdx', 'n', 'minx', 'q1', 'med', 'q3', 'maxx'];
      const two = ['xbar', 'sx', 'sx2', 'varx', 'sdx', 'svarx', 'ssdx', 'n', 'ybar', 'sy', 'sy2', 'vary', 'sdy', 'svary', 'ssdy', 'sxy', 'sx3', 'sx2y', 'sx4', 'minx', 'maxx', 'miny', 'maxy'];
      resultList((this.two ? two : one).map(L));
    },
    regMenu(then) {
      C.menu(REGS.map(([k, l]) => ({ label: l, big: true, action: () => { this.regType = k; this.persist(); C.popAll(); then(k, l); } })), { sel: Math.max(0, REGS.findIndex((r) => r[0] === this.regType)) });
    },
    regResults() {
      this.regMenu((k, l) => {
        const s = this.stats();
        const rows = [['a', () => s.get('a')], ['b', () => s.get('b')]];
        rows.push(k === 'quad' ? ['c', () => s.get('c')] : ['r', () => s.get('r')]);
        resultList(rows, { title: l });
      });
    },
    openCalc() {
      this.view = 'calc';
      if (!this.cs) {
        this.cs = new C.CalcScreen({ mode: 'stat', app: this, history: false, extraCtx: () => ({ stats: this.stats() }), catalog: () => this.catalog() });
        this.cs.emptyLabel = () => '統計計算<br>' + (this.two ? '<span class="big">' + REGS.find((r) => r[0] === this.regType)[1] + '</span>' : '<span class="big">1</span>変数統計');
      }
    },
    okMenu() {
      const items = [{ label: '<span class="big">' + (this.two ? '2' : '1') + '</span>変数統計計算一覧', html: true, action: () => { C.popAll(); this.oneTwoList(); } }];
      if (this.two) items.push({ label: '回帰計算結果', sub: () => { this.regResults(); return null; } });
      items.push({ label: '統計計算', sub: this.two ? () => { this.regMenu(() => this.openCalc()); return null; } : undefined, action: this.two ? undefined : () => { C.popAll(); this.openCalc(); } });
      C.menu(items);
    },
    render() { return this.view === 'calc' ? this.cs.render() : this.grid.render(); },
    key(k) {
      if (this.view === 'calc') {
        if (k === 'tools') return false;
        if (k === 'back') { this.view = 'editor'; return true; }
        return this.cs.key(k);
      }
      if (this.grid.ed) return this.grid.key(k) || true;
      if (k === 'ok' || k === 'exe') { this.okMenu(); return true; }
      if (k === 'back') { this.chooseType(); return true; }
      if (k === 'tools') return false;
      return this.grid.key(k) || true;
    },
    tools() {
      if (this.view === 'calc') {
        const t = [{ label: '<span class="big">' + (this.two ? '2' : '1') + '</span>変数統計計算一覧', html: true, action: () => { C.popAll(); this.oneTwoList(); } }];
        if (this.two) { t.push({ label: '回帰計算結果', action: () => this.regResults() }); t.push({ label: '回帰式の選択', action: () => this.regMenu(() => this.openCalc()) }); }
        t.push({ label: '統計エディター', action: () => { C.popAll(); this.view = 'editor'; } });
        return t;
      }
      const yn = (get, set) => [[true, 'する'], [false, 'しない']].map(([v, l]) => ({ label: l, radio: true, checked: () => get() === v, action: () => { set(v); C.popAll(); } }));
      return [
        { label: '度数表示', sub: () => yn(() => this.freq, (v) => { if (this.freq !== v) { this.freq = v; this.data = { x: [], y: [], f: [] }; this.mkGrid(); this.persist(); } }) },
        { label: '並べ替え', sub: () => [['x', 1, 'x列の昇順'], ['x', -1, 'x列の降順']].concat(this.two ? [['y', 1, 'y列の昇順'], ['y', -1, 'y列の降順']] : []).concat(this.freq ? [['f', 1, 'Freq列の昇順'], ['f', -1, 'Freq列の降順']] : []).map(([k, d, l]) => ({ label: l, action: () => { this.sort(k, d); C.popAll(); } })) },
        { label: '編集', sub: () => [
          { label: '行の挿入', action: () => { const r = Math.min(this.grid.r, this.data.x.length); if (this.data.x.length < this.maxRows()) { this.data.x.splice(r, 0, E.Q(0)); if (this.two) this.data.y.splice(r, 0, E.Q(0)); this.data.f.splice(r, 0, E.Q(1)); this.persist(); } C.popAll(); } },
          { label: 'すべてのデータをクリア', action: () => { this.data = { x: [], y: [], f: [] }; this.grid.r = 0; this.persist(); C.popAll(); } },
        ] },
      ];
    },
    sort(k, d) {
      const idx = this.data.x.map((_, i) => i).sort((a, b) => d * E.cmp(this.data[k][a] || E.Q(1), this.data[k][b] || E.Q(1)));
      for (const key of ['x', 'y', 'f']) if (this.data[key].length) this.data[key] = idx.map((i) => this.data[key][i]);
      this.persist();
    },
    catalog() {
      const T = (k) => ({ label: SV[k], tok: 'sv:' + k, big: true });
      const statCat = () => ['統計計算', null, () => {
        const items = [
          { label: '総和', sub: () => (this.two ? ['sx', 'sx2', 'sy', 'sy2', 'sxy', 'sx3', 'sx2y', 'sx4'] : ['sx', 'sx2']).map(T) },
          { label: '平均/分散/標準偏差...', sub: () => (this.two ? ['xbar', 'varx', 'sdx', 'svarx', 'ssdx', 'ybar', 'vary', 'sdy', 'svary', 'ssdy', 'n'] : ['xbar', 'varx', 'sdx', 'svarx', 'ssdx', 'n']).map(T) },
        ];
        if (this.two) {
          items.push({ label: '最小値/最大値', sub: () => ['minx', 'maxx', 'miny', 'maxy'].map(T) });
          items.push({ label: '回帰計算', sub: () => (this.regType === 'quad' ? ['a', 'b', 'c'] : ['a', 'b', 'r']).map(T).concat(this.regType === 'quad' ? [{ label: 'x̂₁', tok: 'xh1', big: true }, { label: 'x̂₂', tok: 'xh2', big: true }, { label: 'ŷ', tok: 'yh', big: true }] : [{ label: 'x̂', tok: 'xh', big: true }, { label: 'ŷ', tok: 'yh', big: true }]) });
        } else {
          items.push({ label: '最小値/最大値/四分位', sub: () => ['minx', 'q1', 'med', 'q3', 'maxx'].map(T) });
          items.push({ label: '正規分布', sub: () => [{ label: 'P(', tok: 'P(', big: true }, { label: 'Q(', tok: 'Q(', big: true }, { label: 'R(', tok: 'R(', big: true }, { label: '▸t', tok: 't', big: true }] });
        }
        return items;
      }];
      return [statCat, CAT.func, CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.eng, CAT.const, CAT.unit, CAT.pt, CAT.other];
    },
    status() { return this.view === 'calc' ? this.cs.status() : null; },
    editor() { return this.view === 'calc' ? this.cs.ed : this.grid.ed; },
    onIO() { if (this.cs) this.cs.resetMode(); },
    reset() { delete G.appState.stat; this.init(); },
  };

  // ===== 確率分布アプリ =====
  // ===== 分布計算 =====
  const lgam = (z) => { // Lanczos
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgam(1 - z);
    z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  };
  const lfact = (n) => { if (n < 170) { let r = 0; for (let i = 2; i <= n; i++) r += Math.log(i); return r; } return lgam(n + 1); };
  function binPd(x, N, p) {
    if (x < 0 || x > N) return 0;
    if (p === 0) return x === 0 ? 1 : 0; if (p === 1) return x === N ? 1 : 0;
    return Math.exp(lfact(N) - lfact(x) - lfact(N - x) + x * Math.log(p) + (N - x) * Math.log(1 - p));
  }
  function poiPd(x, l) { if (x < 0) return 0; if (l === 0) return x === 0 ? 1 : 0; return Math.exp(-l + x * Math.log(l) - lfact(x)); }
  function invNorm(p) {
    if (p <= 0 || p >= 1) throw new C.CalcError('Math');
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    let q, r, x;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    for (let i = 0; i < 3; i++) { const e = C.normCdf(x) - p; const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2); }
    return x;
  }
  const DISTS = [
    ['bpd', '二項分布の確率質量', [['x', 'x'], ['N', 'N'], ['p', 'p']], true],
    ['bcd', '二項分布の累積分布', [['x', 'x'], ['N', 'N'], ['p', 'p']], true],
    ['npd', '正規分布の確率密度', [['x', 'x'], ['μ', 'mu'], ['σ', 'sigma']], false],
    ['ncd', '正規分布の累積分布', [['下限', 'lo'], ['上限', 'hi'], ['μ', 'mu'], ['σ', 'sigma']], false],
    ['inv', '正規分布の累積分布逆関数', [['P値', 'area'], ['μ', 'mu'], ['σ', 'sigma']], false],
    ['ppd', 'ポアソン分布の確率質量', [['x', 'x'], ['λ', 'lam']], true],
    ['pcd', 'ポアソン分布の累積分布', [['x', 'x'], ['λ', 'lam']], true],
  ];
  const DEFP = { x: 0, mu: 0, sigma: 1, lo: -1e99, hi: 1e99, area: 0.5, N: 1, p: 0.5, lam: 1 };
  function distCalc(type, p) {
    const chkSig = () => { if (!(p.sigma > 0)) throw new C.CalcError('Math'); };
    const isInt = (v) => Number.isInteger(v);
    let r;
    switch (type) {
      case 'npd': chkSig(); r = Math.exp(-((p.x - p.mu) ** 2) / (2 * p.sigma ** 2)) / (p.sigma * Math.sqrt(2 * Math.PI)); break;
      case 'ncd': chkSig(); { if (p.lo > p.hi) throw new C.CalcError('Math'); const zl = (p.lo - p.mu) / p.sigma, zh = (p.hi - p.mu) / p.sigma; r = zl > 0 ? (1 - C.normCdf(zl)) - (1 - C.normCdf(zh)) : C.normCdf(zh) - C.normCdf(zl); } break;
      case 'inv': chkSig(); if (p.area < 0 || p.area > 1) throw new C.CalcError('Math'); r = p.mu + p.sigma * invNorm(p.area); break;
      case 'bpd': case 'bcd': {
        if (!isInt(p.N) || p.N < 0 || p.p < 0 || p.p > 1) throw new C.CalcError('Math');
        if (type === 'bpd') { if (!isInt(p.x)) throw new C.CalcError('Math'); r = binPd(p.x, p.N, p.p); }
        else { const xm = Math.floor(p.x); r = 0; for (let k = 0; k <= Math.min(xm, p.N); k++) r += binPd(k, p.N, p.p); r = Math.min(1, r); }
        break;
      }
      case 'ppd': case 'pcd': {
        if (!(p.lam > 0)) throw new C.CalcError('Math');
        if (type === 'ppd') { if (!isInt(p.x)) throw new C.CalcError('Math'); r = poiPd(p.x, p.lam); }
        else { const xm = Math.floor(p.x); r = 0; for (let k = 0; k <= xm; k++) { r += poiPd(k, p.lam); if (k > 1e5) throw new C.CalcError('TimeOut'); } r = Math.min(1, r); }
        break;
      }
    }
    if (!Number.isFinite(r)) throw new C.CalcError('Math');
    return Number(r.toPrecision(10));
  }
  C.distCalc = distCalc;
  const dist = {
    id: 'dist', name: '確率分布',
    init() { const st = G.appState.dist || {}; this.type = st.type || 'bpd'; this.params = st.params || {}; this.list = st.list || []; this.useList = !!st.useList; this.view = 'menu'; this.res = null; this.listRes = null; },
    persist() { G.appState.dist = { type: this.type, params: this.params, list: this.list, useList: this.useList }; C.save(); },
    enter() { if (!this.view) this.init(); this.list = []; this.listRes = null; this.chooseType(); },
    def() { return DISTS.find((d) => d[0] === this.type); },
    chooseType() {
      this.view = 'menu';
      C.menu(DISTS.map(([k, l, , listable]) => {
        const pick = (useList) => { this.type = k; this.useList = useList; this.res = null; this.listRes = null; this.persist(); C.popAll(); if (useList) this.openList(); else this.openForm(); };
        return listable
          ? { label: l, sub: () => [{ label: '一括計算(リストデータ)', action: () => pick(true) }, { label: '単一計算(1つのデータ)', action: () => pick(false) }] }
          : { label: l, action: () => pick(false) };
      }), { noAC: true, sel: Math.max(0, DISTS.findIndex((d) => d[0] === this.type)), onBack: () => C.openHome() });
    },
    openForm() {
      const [, title, fields] = this.def();
      const fl = fields.filter((f) => !(this.useList && f[1] === 'x'));
      this.view = 'form';
      const val = (key) => (this.params[key] !== undefined ? this.params[key] : DEFP[key]);
      this.form = new C.Form({
        title, vx: 64, fields: fl.map(([lab, key]) => ({ label: lab, big: /^[A-Za-zμσλ]/.test(lab), value: E.fromDecimal(String(val(key)).replace('e+', 'E').replace('e', 'E')), key })),
        onSubmit: (vals) => {
          fl.forEach(([, key], i) => { this.params[key] = E.toNum(vals[i]); });
          this.persist();
          try {
            if (this.useList) { this.listRes = this.list.map((x) => { try { return distCalc(this.type, Object.assign({}, this.params, { x: E.toNum(x) })); } catch (e) { return 'ERROR'; } }); this.view = 'list'; this.grid.c = 1; }
            else { this.res = distCalc(this.type, this.params); G.ans = this.res; this.view = 'res'; C.save(); }
          } catch (e) { C.showError(e); }
        },
        onBack: () => { if (this.useList) this.view = 'list'; else this.chooseType(); },
      });
    },
    openList() {
      const self = this; this.view = 'list'; this.listRes = null;
      const t = this.def()[1];
      this.grid = new C.TableGrid({
        rows: () => self.list.length, growable: true, maxRows: 45, padRows: true,
        cols: () => [{ label: 'x', html: '𝑥', w: 36 }, { label: 'P', w: 40 }],
        side: () => esc(t.slice(0, 5)) + '<br>' + esc(t.slice(5)),
        get: (r, c) => (c === 0 ? self.list[r] : self.listRes ? self.listRes[r] : undefined),
        set: (r, c, v) => { if (c !== 0) return; if (r >= self.list.length) self.list.push(v); else self.list[r] = v; self.listRes = null; self.persist(); },
        canEdit: (r, c) => c === 0,
        onDel: (r) => { self.list.splice(r, 1); self.listRes = null; self.persist(); },
      });
    },
    render() {
      if (this.view === 'res') {
        const lab = this.type === 'inv' ? 'xInv=' : 'p=';
        return '<div class="calc"><div class="in fb">' + lab + '</div><div class="out">' + C.fmtValue(this.res, G.s, { fmt: 'dec' }).html + '</div></div>';
      }
      if (this.view === 'form' && this.form) return this.form.render();
      if (this.view === 'list' && this.grid) return this.grid.render();
      return '';
    },
    key(k) {
      if (k === 'tools') return false;
      if (this.view === 'res') {
        if (k === 'variable') { C.openVariables({ getValue: () => this.res }); return true; }
        if (['exe', 'ok', 'back', 'ac'].includes(k)) { this.openForm(); return true; }
        return true;
      }
      if (this.view === 'form') { this.form.key(k); return true; }
      if (this.view === 'list') {
        if (!this.grid.ed && (k === 'ok' || (k === 'exe' && this.grid.r >= this.list.length))) { if (!this.list.length) return true; this.openForm(); return true; }
        if (!this.grid.ed && k === 'back') { this.chooseType(); return true; }
        if (!this.grid.ed && this.listRes && C.INPUT_KEYS.test(k)) this.listRes = null;
        return this.grid.key(k) || true;
      }
      return true;
    },
    tools() {
      if (this.view === 'list') return [{ label: '編集', sub: () => [{ label: '行の挿入', action: () => { if (this.list.length < 45) { this.list.splice(this.grid.r, 0, E.Q(0)); this.listRes = null; this.persist(); } C.popAll(); } }, { label: 'すべてのデータをクリア', action: () => { this.list = []; this.listRes = null; this.persist(); C.popAll(); } }] }];
      return [];
    },
    status() { return null; },
    editor() { return this.form && this.view === 'form' ? (this.form.fields[this.form.sel] || {}).ed : null; },
    reset() { delete G.appState.dist; this.init(); },
  };

  C.lateApps.stat = stat; C.lateApps.dist = dist;
})(window.C = window.C || {});
