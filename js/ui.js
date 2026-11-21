/* UI フレームワーク: 画面部品（メニュー・フォーム・エラー・計算画面）と共通メニュー
   すべて 192×64 ドットの液晶座標で描画する */
(function (C) {
  'use strict';
  const E = C.E, V = C.V, esc = C.esc;

  // ===== 設定・メモリー =====
  const DEFAULTS = { io: 'mm', angle: 'deg', numFmt: { type: 'norm', n: 1 }, eng: false, frac: 'improper', complex: 'rect', decMark: '.', sep: false, contrast: 1, apo: 10, qr: 11, cxRoots: true };
  const G = C.G = {
    s: JSON.parse(JSON.stringify(DEFAULTS)), vars: {}, ans: E.Q(0), preAns: E.Q(0), fdef: { f: [], g: [] },
    mats: {}, vecs: {}, ov: [], shift: false, power: true, app: null, appState: {}, verify: false,
  };
  C.DEFAULTS = DEFAULTS;
  C.APPS = [];
  C.lateApps = {};
  const VARN = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'];
  C.VARN = VARN;
  for (const v of VARN) G.vars[v] = E.Q(0);

  const rep = (k, v) => (typeof v === 'bigint' ? { $b: v.toString() } : v);
  const rev = (k, v) => (v && typeof v === 'object' && v.$b !== undefined ? BigInt(v.$b) : v);
  C.clone = (o) => JSON.parse(JSON.stringify(o, rep), rev);
  C.save = function () {
    try { localStorage.setItem('kscalc.v2', JSON.stringify({ s: G.s, vars: G.vars, ans: G.ans, preAns: G.preAns, fdef: G.fdef, mats: G.mats, vecs: G.vecs, appState: G.appState, app: G.app && G.app.id }, rep)); } catch (e) { /* 保存不可 */ }
  };
  C.load = function () {
    try {
      const raw = localStorage.getItem('kscalc.v2'); if (!raw) return null;
      const d = JSON.parse(raw, rev);
      Object.assign(G.s, d.s || {}); Object.assign(G.vars, d.vars || {});
      if (d.ans !== undefined) G.ans = d.ans; if (d.preAns !== undefined) G.preAns = d.preAns;
      if (d.fdef) G.fdef = d.fdef; if (d.mats) G.mats = d.mats; if (d.vecs) G.vecs = d.vecs; if (d.appState) G.appState = d.appState;
      return d.app;
    } catch (e) { return null; }
  };
  C.mkCtx = function (mode, extra) {
    return Object.assign({ settings: G.s, angle: G.s.angle, vars: G.vars, ans: G.ans, preAns: G.preAns, fdef: G.fdef, mats: G.mats, vecs: G.vecs, mode: mode || 'calc', flags: {} }, extra || {});
  };
  C.edMode = () => (G.s.io === 'mm' || G.s.io === 'md' ? 'math' : 'line');
  C.isMath = () => G.s.io === 'mm' || G.s.io === 'md';
  const VN = (n) => ({ x: '𝑥', y: '𝑦', z: '𝑧' }[n] || n);
  C.VN = VN;

  // ===== オーバーレイ =====
  C.push = function (ov) { G.ov.push(ov); C.render(); return ov; };
  C.pop = function (ov) { if (ov) { const i = G.ov.indexOf(ov); if (i >= 0) G.ov.splice(i, 1); } else G.ov.pop(); C.render(); };
  C.popAll = function () { G.ov.length = 0; C.render(); };
  C.popTo = function (n) { G.ov.length = Math.min(G.ov.length, n); C.render(); };
  C.top = () => G.ov[G.ov.length - 1];
  C.val = (x) => (typeof x === 'function' ? x() : x);

  // ===== メニュー（4行・反転表示・▶・ラジオボタン） =====
  class Menu {
    constructor(o) { Object.assign(this, { title: '', items: [], sel: 0, top: 0, noAC: false, cols: 1 }, o); this.noStatus = !this.status; if (this.sel >= this.items.length) this.sel = 0; }
    rowsVis() { return (this.status ? 3 : 4) - (this.title ? 1 : 0); }
    render() {
      if (this.cols === 2) return this.render2();
      const n = this.items.length, rows = this.rowsVis();
      if (this.sel < this.top) this.top = this.sel; if (this.sel >= this.top + rows) this.top = this.sel - rows + 1;
      const y0 = (this.status ? 8 : 0) + (this.title ? 16 : 0);
      let h = '<div class="mn">';
      if (this.title) h += '<div class="title" style="top:' + (this.status ? 8 : 0) + 'px">' + (this.titleHtml ? this.title : esc(this.title)) + '</div>';
      const bar = n > rows;
      for (let i = this.top; i < Math.min(n, this.top + rows); i++) {
        const it = this.items[i];
        const lab = C.val(it.label);
        const right = C.val(it.right);
        let inner = '';
        if (it.radio) inner += (C.val(it.checked) ? C.IC.radioOn : C.IC.radioOff).replace('<svg', '<svg class="radio"');
        if (it.icon) inner += it.icon;
        inner += '<span class="lb">' + (it.html ? lab : esc(lab)) + '</span>';
        if (right !== undefined) inner += '<span class="r' + (it.bigRight ? ' big' : '') + '">' + (it.rhtml ? right : esc(right)) + '</span>';
        if (it.sub) inner += '<span class="tri">' + C.IC.tri + '</span>';
        h += '<div class="mi' + (i === this.sel ? ' sel' : '') + (it.big ? ' big' : '') + (it.disabled ? ' dis' : '') + '" style="top:' + (y0 + (i - this.top) * 16) + 'px;right:' + (bar ? 4 : 1) + 'px">' + inner + '</div>';
      }
      if (bar) { const H = rows * 16; const th = Math.max(4, Math.round(H * rows / n)); h += '<div class="bar" style="top:' + (y0 + Math.round(this.top / n * H)) + 'px;height:' + th + 'px"></div>'; }
      return h + '</div>';
    }
    render2() { // 2列（科学定数・変数一覧）
      const n = this.items.length, rows = this.rows2 || 5, per = rows * 2;
      const page = Math.floor(this.sel / per) * per;
      let h = '<div class="mn">';
      for (let i = page; i < Math.min(n, page + per); i++) {
        const it = this.items[i], k = i - page;
        const lab = C.val(it.label);
        h += '<div class="mi2' + (i === this.sel ? ' sel' : '') + '" style="left:' + (k % 2 ? 96 : 1) + 'px;top:' + (2 + Math.floor(k / 2) * 12) + 'px;width:' + (k % 2 ? 92 : 92) + 'px">' + (it.html ? lab : esc(lab)) + '</div>';
      }
      if (n > per) { const H = 62; h += '<div class="bar" style="top:' + (1 + Math.round(page / n * H)) + 'px;height:' + Math.round(H * per / n) + 'px"></div>'; }
      return h + '</div>';
    }
    choose(i) {
      const it = this.items[i]; if (!it || it.disabled) return;
      if (it.sub) { const sub = it.sub(); if (sub) C.push(sub instanceof Menu ? sub : new Menu({ items: sub, cols: it.subCols || 1 })); return; }
      if (it.action) it.action(this);
      C.render();
    }
    key(k) {
      if (this.keyHook && this.keyHook(k, this)) return true;
      const n = this.items.length; if (!n) { if (k === 'back' || k === 'ac') C.pop(this); return true; }
      if (this.cols === 2) {
        if (k === 'up') { this.sel = (this.sel - 2 + n) % n; return true; }
        if (k === 'down') { this.sel = (this.sel + 2) % n; return true; }
        if (k === 'left') { this.sel = Math.max(0, this.sel - 1); return true; }
        if (k === 'right') { this.sel = Math.min(n - 1, this.sel + 1); return true; }
      } else {
        if (k === 'up') { this.sel = (this.sel - 1 + n) % n; return true; }
        if (k === 'down') { this.sel = (this.sel + 1) % n; return true; }
        if (k === 'right' && this.items[this.sel] && this.items[this.sel].sub) { this.choose(this.sel); return true; }
        if (k === 'left' && G.ov.length > 1 && !this.noLeft) { C.pop(this); return true; }
      }
      if (k === 'pgup') { const r = this.cols === 2 ? 10 : this.rowsVis(); this.sel = Math.max(0, this.sel - r); return true; }
      if (k === 'pgdn') { const r = this.cols === 2 ? 10 : this.rowsVis(); this.sel = Math.min(n - 1, this.sel + r); return true; }
      if (k === 'ok' || k === 'exe') { this.choose(this.sel); return true; }
      if (k === 'back') { C.pop(this); if (this.onBack) this.onBack(); return true; }
      if (k === 'ac' && !this.noAC) { C.popAll(); if (this.onAC) this.onAC(); return true; }
      return true;
    }
  }
  C.Menu = Menu;
  C.menu = (items, o) => C.push(new Menu(Object.assign({ items }, o || {})));

  // ===== メッセージ／エラー画面 =====
  class Msg {
    constructor(o) { Object.assign(this, o); }
    render() {
      if (this.error) return '<div class="msgbox"><div class="t">' + esc(this.text) + '</div><span class="warn">' + C.IC.warn + '</span><div class="btn">戻る</div></div>';
      return '<div class="msgbox"><div class="c">' + (this.html || esc(this.text || '')) + '</div>' + (this.btn ? '<div class="btn">' + esc(this.btn) + '</div>' : '') + '</div>';
    }
    key(k) {
      if (this.onKey && this.onKey(k)) return true;
      const close = this.error ? ['ac', 'back', 'ok', 'exe', 'left', 'right'] : ['ac', 'back', 'ok', 'exe'];
      if (close.includes(k)) { C.pop(this); if (this.onClose) this.onClose(k); return true; }
      return true;
    }
  }
  C.Msg = Msg;
  C.showError = function (e, onClose) {
    if (!(e instanceof C.CalcError)) { console.error(e); e = new C.CalcError(/Maximum call stack/.test(String(e)) ? 'Stack' : 'Math'); }
    return C.push(new Msg({ error: true, text: e.jp, onClose }));
  };
  C.info = (text, onClose) => C.push(new Msg({ text, onClose }));

  // ===== キー入力 -> 数式エディタ =====
  const SIMPLE = {
    '.': '.', 'S-exp': 'π', ans: 'Ans', 'S-ans': 'e', add: '+', sub: '-', mul: '*', div: '/',
    'S-mul': 'nPr', 'S-div': 'divR', 'S-add': 'nCr', 'S-sub': 'PreAns', lp: '(', rp: ')', 'S-lp': '%', 'S-rp': ',',
    neg: 'neg', 'S-neg': '∠', dms: 'dms', 'S-dms': 'i', x: 'x', 'S-x': '=', sin: 'sin(', cos: 'cos(', tan: 'tan(',
    'S-sin': 'asin(', 'S-cos': 'acos(', 'S-tan': 'atan(', ln: 'ln(', inv: '⁻¹', 'S-inv': '!', sq: '²', 'S-sq': '³', log: 'log(',
  };
  C.inputKey = function (ed, k, opt) {
    opt = opt || {};
    const math = ed.mode === 'math';
    if (k.startsWith('var:')) {
      const v = k.slice(4);
      if (opt.base) { if (/^[A-F]$/.test(v)) ed.insert('hx' + v); return true; }
      ed.insert(v === 'E' ? 'E_' : v); return true;
    }
    if (opt.base && ['.', 'exp', 'S-exp', 'S-ans', 'sin', 'cos', 'tan', 'ln', 'log', 'S-sin', 'S-cos', 'S-tan', 'S-ln', 'dms', 'S-dms', 'S-neg', 'inv', 'S-inv', 'S-sq', 'sq', 'pow', 'S-pow', 'sqrt', 'S-sqrt', 'frac', 'S-frac', 'logb', 'S-logb', 'S-lp', 'S-mul', 'S-add', 'S-div', 'x', 'fx'].includes(k)) return true;
    if (/^[0-9]$/.test(k)) { ed.insert(k); return true; }
    if (k === 'S-dms' && opt.mode !== 'cplx' && !opt.allowI) return true;
    if (SIMPLE[k] !== undefined) { ed.insert(SIMPLE[k]); return true; }
    switch (k) {
      case 'exp': if (math) { ed.insert('*'); ed.insert('1'); ed.insert('0'); ed.insertTpl('pow'); } else ed.insertMany(['*', '1', '0', '^(']); return true;
      case 'S-ln': if (math) { ed.insert('e'); ed.insertTpl('pow'); } else ed.insert('e^('); return true;
      case 'pow': if (math) ed.insertTpl('pow'); else ed.insert('^('); return true;
      case 'S-pow': if (math) ed.insertTpl('root'); else ed.insert('xrt('); return true;
      case 'sqrt': if (math) ed.insertTpl('sqrt'); else ed.insert('√('); return true;
      case 'frac': if (math) ed.insertTpl('frac'); else ed.insert('⌟'); return true;
      case 'S-frac': if (math) ed.insertTpl('mixed'); else ed.insert('⌟'); return true;
      case 'logb': if (math) ed.insertTpl('logb'); else ed.insert('log('); return true;
      case 'S-logb': if (math) { ed.insert('1'); ed.insert('0'); ed.insertTpl('pow'); } else ed.insert('10^('); return true;
      case 'del': ed.del(); return true;
      case 'S-del': if (math) ed.capture = true; else ed.overwrite = !ed.overwrite; return true;
      case 'left': ed.left(); return true;
      case 'right': ed.right(); return true;
      case 'up': return ed.up();
      case 'down': return ed.down();
    }
    return false;
  };
  C.INPUT_KEYS = /^([0-9]|var:.*|\.|exp|S-exp|ans|S-ans|add|sub|mul|div|S-mul|S-div|S-add|S-sub|lp|rp|S-lp|S-rp|neg|S-neg|dms|S-dms|x|S-x|sin|cos|tan|S-sin|S-cos|S-tan|ln|log|S-ln|inv|S-inv|sq|S-sq|pow|S-pow|sqrt|S-sqrt|frac|S-frac|logb|S-logb)$/;
  C.insertItem = function (ed, item) {
    const math = ed.mode === 'math';
    if (item.tpl) {
      if (math) { if (item.pre) ed.insertMany(item.pre); ed.insertTpl(item.tpl, item.preset ? JSON.parse(JSON.stringify(item.preset)) : undefined); }
      else ed.insertMany(item.line || []);
    } else if (item.toks) ed.insertMany(item.toks);
    else ed.insert(item.tok);
  };

  // ===== CATALOG（取扱説明書のメニュー構成） =====
  const T = (label, tok, o) => Object.assign({ label, tok }, o || {});
  const TP = (label, tpl, line, o) => Object.assign({ label, tpl, line }, o || {});
  const B = { big: true };
  C.CATALOG = {
    verify: () => ['真偽判別', ['=', '≠', '>', '<', '≥', '≤'].map((r) => T(r, r, B))],
    func: () => ['解析関数', [
      TP('微分(d/dx)', 'deriv', ['d/dx(']), TP('積分(∫)', 'integ', ['∫(']), TP('総和(Σ)', 'sum', ['Σ(']), TP('総積(∏)', 'prod', ['Π(']),
      T('余り計算', 'divR'), T('常用対数', 'log('), TP('対数', 'logb', ['log(']), T('自然対数', 'ln('),
    ]],
    prob: () => ['確率', [T('％', '%'), T('階乗(!)', '!'), T('順列(P)', 'nPr'), T('組合せ(C)', 'nCr'), T('小数乱数', 'Ran#'), T('整数乱数', 'RanInt#(')]],
    numeric: () => ['数値計算', [T('最大公約数', 'GCD('), T('最小公倍数', 'LCM('), TP('絶対値', 'abs', ['Abs(']), TP('循環小数', 'recur', [], { mathOnly: true }), T('整数部分の抽出', 'Int('), T('表示桁数設定丸め', 'Rnd('), T('最大の整数', 'Intg(')]],
    angle: () => ['角度/座標/度分秒', [T('度数法(D)', '°'), T('弧度法(R)', 'ʳ'), T('グラード(G)', 'ᵍ'), T('直交座標→極座標', 'Pol('), T('極座標→直交座標', 'Rec('), T('度分秒', 'dms')]],
    hyp: () => ['双曲線関数/三角関数', [T('sinh', 'sinh(', B), T('cosh', 'cosh(', B), T('tanh', 'tanh(', B), T('sinh⁻¹', 'asinh(', B), T('cosh⁻¹', 'acosh(', B), T('tanh⁻¹', 'atanh(', B), T('sin', 'sin(', B), T('cos', 'cos(', B), T('tan', 'tan(', B), T('sin⁻¹', 'asin(', B), T('cos⁻¹', 'acos(', B), T('tan⁻¹', 'atan(', B)]],
    eng: () => ['エンジニアリング記号', [['ミリ(m)', 'm'], ['マイクロ(μ)', 'μ'], ['ナノ(n)', 'n'], ['ピコ(p)', 'p'], ['フェムト(f)', 'f'], ['キロ(k)', 'k'], ['メガ(M)', 'M'], ['ギガ(G)', 'G'], ['テラ(T)', 'T'], ['ペタ(P)', 'P'], ['エクサ(E)', 'E']].map(([l, s]) => T(l, 'eng:' + s))],
    const: () => ['科学定数', null, () => C.CONST_CATS.map(([name, list]) => ({ label: name, subCols: 2, sub: () => list.map(([key, sym]) => ({ label: sym, insert: { tok: 'c:' + key } })) }))],
    unit: () => ['単位換算', null, () => C.UNIT_MENU.map(([name, , subs]) => ({ label: name, sub: () => (subs.length === 1 && subs[0][0] === '' ? unitItems(subs[0][1]) : subs.map(([sn, list]) => ({ label: sn === 'その他' ? 'その他' : sn.replace('…', '▸…'), big: sn !== 'その他' && !/[^\x00-\x7F²³…]/.test(sn), sub: () => unitItems(list) }))) }))],
    pt: () => ['周期表', null, () => [{ label: '周期表', action: () => C.openPeriodic() }, { label: '原子量', insert: { toks: ['AtWt('] } }]],
    other: () => ['その他', [T('Ans', 'Ans', B), T('PreAns', 'PreAns', B), T('π', 'π', B), T('𝑒', 'e', B), TP('√', 'sqrt', ['√('], B), TP('ˣ√', 'root', ['xrt('], B), T('⁻¹', '⁻¹', B), T('²', '²', B), TP('^(', 'pow', ['^('], B), T('-', 'neg', B), T(',', ',', B), T('(', '(', B), T(')', ')', B)]],
    cplx: () => ['複素数', [T('𝑖', 'i', B), T('∠', '∠', B), T('偏角', 'Arg('), T('共役複素数', 'Conjg('), T('実部抽出', 'ReP('), T('虚部抽出', 'ImP(')]],
    baseSel: () => ['基数の接頭辞', [T('10進数(d)', 'd:'), T('16進数(h)', 'h:'), T('2進数(b)', 'b:'), T('8進数(o)', 'o:')]],
    logic: () => ['論理演算', [T('Neg', 'Neg(', B), T('Not', 'Not(', B), T('and', 'and', B), T('or', 'or', B), T('xor', 'xor', B), T('xnor', 'xnor', B)]],
    hexdig: () => ['16進数の数値', ['A', 'B', 'C', 'D', 'E', 'F'].map((d) => T(d, 'hx' + d, B))],
    mat: () => ['行列', [T('MatA', 'MatA', B), T('MatB', 'MatB', B), T('MatC', 'MatC', B), T('MatD', 'MatD', B), T('MatAns', 'MatAns', B), { label: '行列計算', sub: () => [T('行列式', 'Det('), T('転置行列', 'Trn('), T('単位行列', 'Identity('), T('階段行列', 'Ref('), T('被約階段行列', 'Rref('), T('逆行列', '⁻¹'), T('行列の二乗', '²'), T('行列の三乗', '³')] }]],
    vec: () => ['ベクトル', [T('VctA', 'VctA', B), T('VctB', 'VctB', B), T('VctC', 'VctC', B), T('VctD', 'VctD', B), T('VctAns', 'VctAns', B), { label: 'ベクトル計算', sub: () => [T('内積', 'dot'), T('外積', '*'), T('ベクトルのなす角', 'Angle('), T('単位ベクトル', 'UnitV(')] }]],
    eqSign: () => ['方程式', [T('=', '=', B)]],
  };
  function unitItems(list) {
    return list.map((key) => { const u = C.UNIT_BY_KEY[key]; return u ? { label: u.from + '▸' + u.to, big: !/[^\x00-\x7F²³°μÅγ·]/.test(u.from + u.to), insert: { tok: 'u:' + key } } : null; }).filter(Boolean);
  }
  C.openCatalog = function (cats, ed, after) {
    const base = G.ov.length;
    const close = () => C.popTo(base);
    const conv = (items) => items.filter((it) => !(it.mathOnly && ed.mode !== 'math')).map((it) => {
      const o = { label: it.label, big: it.big };
      if (it.sub) return Object.assign(o, { sub: () => { const r = conv(it.sub()); return it.subCols === 2 ? new Menu({ items: r, cols: 2 }) : r; } });
      if (it.action) return Object.assign(o, { action: () => { close(); it.action(); } });
      const ins = it.insert || it;
      return Object.assign(o, { action: () => { close(); C.insertItem(ed, ins); if (after) after(); } });
    });
    C.menu(cats.map((c) => { const [name, list, dyn] = c(); return { label: name, sub: () => conv(list || dyn()) }; }));
  };

  // ===== 変数の値一覧（VARIABLE） =====
  C.openVariables = function (opts) {
    opts = opts || {};
    const base = G.ov.length; const close = () => C.popTo(base);
    const s1 = Object.assign({}, G.s, { numFmt: { type: 'norm', n: 1 }, io: 'ld', eng: false });
    const lbl = (n) => () => VN(n) + '=' + C.fmtValue(G.vars[n], s1).html.replace(/<[^>]+>/g, '');
    function editVar(n, firstKey) {
      const ed = new C.Editor('line');
      if (firstKey) C.inputKey(ed, firstKey, {});
      const ov = {
        noStatus: true,
        render() { return '<div class="calc" style="top:0"><div class="in line"><span class="tk">' + VN(n) + '=</span>' + ed.render(true) + '</div></div>'; },
        key(k) {
          if (k === 'exe' || k === 'ok') {
            if (ed.isEmpty()) { C.pop(ov); return true; }
            try { const v = C.evaluate(C.parse(ed.root), C.mkCtx('calc')); if (!V.isReal(v)) throw new C.CalcError('Argument'); G.vars[n] = v; C.save(); C.pop(ov); } catch (e) { C.showError(e); }
            return true;
          }
          if (k === 'back') { C.pop(ov); return true; }
          if (k === 'ac') { ed.clear(); return true; }
          C.inputKey(ed, k, {}); return true;
        },
      };
      C.push(ov);
    }
    C.push(new Menu({
      cols: 2, rows2: 5, items: VARN.map((n) => ({
        label: lbl(n),
        sub: () => [
          { label: '変数を呼び出す', disabled: !opts.onRecall, action: () => { close(); if (opts.onRecall) opts.onRecall(n === 'E' ? 'E_' : n); } },
          { label: '変数に保存する', disabled: !opts.getValue, action: () => { try { const v = opts.getValue(); if (v === undefined) { close(); return; } if (!V.isReal(v) && !V.isCx(v)) throw new C.CalcError('Argument'); G.vars[n] = v; C.save(); C.popTo(base + 1); } catch (e) { close(); C.showError(e); } } },
          { label: '変数を編集する', action: () => { C.popTo(base + 1); editVar(n, ''); } },
        ],
      })),
      keyHook: (k, mm) => {
        const n = VARN[mm.sel];
        if (/^[0-9]$/.test(k) || ['sub', 'S-sub', '.', 'S-exp', 'lp', 'neg'].includes(k)) { editVar(n, k); return true; }
        if (k === 'variable') { close(); return true; }
        return false;
      },
    }));
  };

  // ===== f(x)/g(x) =====
  C.openFxMenu = function (ed, after) {
    const base = G.ov.length;
    C.menu([
      { label: 'f(𝑥)', big: true, action: () => { C.popTo(base); ed.insert('f('); if (after) after(); } },
      { label: 'g(𝑥)', big: true, action: () => { C.popTo(base); ed.insert('g('); if (after) after(); } },
      { label: '<span class="big">f(𝑥)</span>の定義', html: true, action: () => { C.popTo(base); C.defineFn('f', after); } },
      { label: '<span class="big">g(𝑥)</span>の定義', html: true, action: () => { C.popTo(base); C.defineFn('g', after); } },
    ]);
  };
  C.defineFn = function (fn, done) {
    const ed = new C.Editor(C.edMode()); ed.setTokens(G.fdef[fn] || []);
    const ov = {
      render() { return '<div class="calc"><div class="in ' + (ed.mode === 'line' ? 'line' : '') + '"><span class="tk">' + fn + '(𝑥)=</span>' + ed.render(true) + '</div></div>'; },
      key(k) {
        if (k === 'exe' || k === 'ok') {
          if (ed.root.length) { try { C.parse(ed.root); } catch (e) { C.showError(e); return true; } }
          G.fdef[fn] = JSON.parse(JSON.stringify(ed.root)); C.save(); C.pop(ov); if (done) done(); return true;
        }
        if (k === 'back') { C.pop(ov); return true; }
        if (k === 'ac') { ed.clear(); return true; }
        if (k === 'fx') { const o = fn === 'f' ? 'g' : 'f'; C.menu([{ label: o + '(𝑥)', big: true, action: (m) => { C.pop(m); ed.insert(o + '('); } }]); return true; }
        if (k === 'catalog') { C.openCatalog(C.calcCatalog(), ed); return true; }
        if (k === 'variable') { C.openVariables({ onRecall: (t) => ed.insert(t) }); return true; }
        C.inputKey(ed, k, {}); return true;
      },
    };
    C.push(ov);
  };

  // ===== 周期表 =====
  C.openPeriodic = function (onPick) {
    let z = G.appState.ptSel || 1;
    const grid = {}; for (const el of C.ELEMENTS) grid[el.pos[0] + ',' + el.pos[1]] = el;
    const Y = (r) => (r <= 6 ? r * 5 : r === 8 ? 37 : 42);
    const ov = {
      render() {
        let h = '<div class="pt">';
        for (const el of C.ELEMENTS) { const [r, c] = el.pos; h += '<span class="e' + (el.z === z ? ' sel' : '') + '" style="left:' + (c * 6) + 'px;top:' + Y(r) + 'px"></span>'; }
        const el = C.ELEMENTS[z - 1];
        h += '</div><div class="pt-info"><div class="fb">' + el.z + '</div><div class="fb" style="margin-top:3px">' + esc(el.sym) + '</div><div class="ft" style="margin-top:4px">' + (el.br ? '[' + el.w + ']' : el.w) + '</div></div>';
        return h;
      },
      key(k) {
        const el = C.ELEMENTS[z - 1]; const [r, c] = el.pos;
        const find = (rr, cc, dr, dc) => { for (let i = 0; i < 20; i++) { rr += dr; cc += dc; if (rr < 0 || rr > 9 || cc < 0 || cc > 17) return null; if (rr === 7) continue; const e = grid[rr + ',' + cc]; if (e) return e; } return null; };
        let nx = null;
        if (k === 'left') nx = find(r, c, 0, -1) || (z > 1 ? C.ELEMENTS[z - 2] : null);
        if (k === 'right') nx = find(r, c, 0, 1) || (z < 118 ? C.ELEMENTS[z] : null);
        if (k === 'up') nx = find(r, c, -1, 0) || (r >= 8 ? grid[(r === 8 ? 5 : 6) + ',2'] : null);
        if (k === 'down') nx = find(r, c, 1, 0);
        if (nx) { z = nx.z; G.appState.ptSel = z; return true; }
        if (k === 'ok' || k === 'exe') {
          C.pop(ov);
          if (onPick) onPick(z); else { const ed = C.activeEditor && C.activeEditor(); if (ed) { ed.insert('AtWt('); for (const ch of String(z)) ed.insert(ch); } }
          C.render(); return true;
        }
        if (k === 'back' || k === 'ac') { C.pop(ov); return true; }
        return true;
      },
    };
    C.push(ov);
  };

  // ===== QR コード =====
  C.openQR = function (text) {
    if (typeof window.qrcode !== 'function') { C.info('QRコードを表示できません'); return; }
    const ver = G.s.qr === 3 ? 3 : 11;
    let qr;
    try { qr = window.qrcode(ver, 'L'); qr.addData(unescape(encodeURIComponent(text))); qr.make(); }
    catch (e) { C.info(ver === 3 ? 'バージョン3設定は非対応です' : 'QRコードを表示できません'); return; }
    const svg = qr.createSvgTag({ cellSize: 1, margin: 1, scalable: true });
    const ov = { noStatus: true, render() { return '<div class="qr">' + svg + '<div class="ft" style="align-self:flex-end;margin:0 0 3px auto;padding-right:3px">1/1</div></div>'; }, key(k) { if (['ac', 'back', 'ok', 'exe', 'S-format', 'S-dms'].includes(k)) C.pop(ov); return true; } };
    C.push(ov);
  };

  // ===== 計算画面（基本計算・複素数・n進・行列・ベクトル・統計） =====
  const CONT_KEYS = ['add', 'sub', 'mul', 'div', 'sq', 'S-sq', 'inv', 'pow', 'S-mul', 'S-div', 'S-add'];
  class CalcScreen {
    constructor(o) {
      Object.assign(this, { mode: 'calc', history: true }, o);
      this.ed = new C.Editor(C.edMode());
      this.state = 'edit'; this.result = undefined; this.fmt = undefined; this.hist = []; this.hi = -1; this.queue = null;
    }
    resetMode() { this.ed = new C.Editor(C.edMode()); this.state = 'edit'; this.hist = []; this.hi = -1; this.engMode = false; this.calcPrompt = null; }
    ctx() { return C.mkCtx(this.mode, Object.assign({ base: G.appState.base || 'dec' }, this.extraCtx ? this.extraCtx() : {})); }
    verifyOn() { return !!(this.verify && G.verify); }
    evaluate(dec) {
      const ed = this.ed;
      if (ed.isEmpty()) { if (this.state === 'result' && this.lastTokens) ed.setTokens(this.lastTokens); else return; }
      let ast;
      try { ast = C.parse(ed.root); } catch (e) { this.err(e); return; }
      const isRel = ast.t === 'rel';
      if (this.verifyOn() !== isRel) { this.err(new C.CalcError('Syntax')); return; }
      const list = ast.t === 'stmts' ? ast.list : [ast];
      if (this.queue && this.queue.tokens === ed.snapshot() && this.state === 'result' && this.queue.i < list.length - 1) this.queue.i++;
      else this.queue = { tokens: ed.snapshot(), i: 0 };
      const ctx = this.ctx();
      let v;
      try { v = C.evaluate(list[this.queue.i], ctx); if (v === undefined) throw new C.CalcError('Syntax'); } catch (e) { this.err(e); return; }
      this.result = v; this.state = 'result'; this.engMode = false;
      this.fmt = dec ? 'dec' : ctx.flags.dms ? 'sexa' : ctx.flags.polar ? 'polar' : ctx.flags.rect ? 'rect' : undefined;
      if (this.mode === 'base') { this.fmt = 'base'; this.baseShow = G.appState.base || 'dec'; }
      this.lastTokens = JSON.parse(JSON.stringify(ed.root));
      if (V.isMat(v)) G.mats.MatAns = v;
      else if (V.isVec(v)) G.vecs.VctAns = v;
      else if (V.isReal(v) || V.isCx(v)) { if (this.mode === 'calc') G.preAns = G.ans; G.ans = v; }
      else if (v.k === 'divR') { G.preAns = G.ans; G.ans = v.q; }
      else if (v.k === 'list') { G.ans = v.items[0][1]; }
      else if (v.k === 'bool') { G.ans = E.Q(v.v ? 1 : 0); }
      if (this.history && (this.queue.i === 0 || this.queue.i === list.length - 1)) {
        this.hist.push({ tokens: this.lastTokens, v, fmt: this.fmt, base: this.baseShow });
        if (this.hist.length > 30) this.hist.shift();
      }
      this.hi = this.hist.length - 1;
      if (this.onResult) this.onResult(v);
      C.save();
    }
    err(e) {
      this.state = 'edit';
      C.showError(e, (k) => { if (k === 'ac') this.ed.clear(); else this.ed.toEnd(); C.render(); });
    }
    key(k) {
      const ed = this.ed;
      if (this.calcPrompt) return this.calcKey(k);
      if (this.engMode) {
        if (k === 'left' || k === 'right') { this.engShift = (this.engShift || 0) + (k === 'left' ? 1 : -1); return true; }
        if (['ac', 'exe', 'back', 'ok'].includes(k)) { this.engMode = false; this.fmt = undefined; this.engShift = 0; return true; }
        if (k === 'format') { this.engMode = false; this.engShift = 0; this.openFormat(); return true; }
        return true;
      }
      if (k === 'exe') { this.evaluate(false); return true; }
      if (k === 'S-exe') { this.evaluate(this.mode !== 'base'); return true; }
      if (k === 'ac') { ed.clear(); this.state = 'edit'; this.queue = null; this.hi = this.hist.length - 1; this.browsing = false; return true; }
      if (k === 'format') { this.openFormat(); return true; }
      if (k === 'S⇔D') { this.toggleSD(); return true; }
      if (k === 'S-format') { this.qr(); return true; }
      if (k === 'variable') { C.openVariables({ onRecall: (t) => { this.prepInput('x'); ed.insert(t); }, getValue: () => this.valueForStore() }); return true; }
      if (k === 'fx') { this.prepInput('x'); C.openFxMenu(ed); return true; }
      if (k === 'catalog') {
        // 真偽判別：結果表示中に関係演算子を選ぶと右辺を引き継ぐ
        const carry = this.verifyOn() && this.state === 'result' ? this.rhsTokens() : null;
        this.prepInput('x');
        if (carry) ed.setTokens(carry);
        C.openCatalog(this.catalog ? this.catalog() : C.calcCatalog(), ed);
        return true;
      }
      if (this.state === 'result') {
        if (k === 'up' || k === 'down' || k === 'pgup' || k === 'pgdn') {
          const n = this.hist.length; if (!n) return true;
          this.hi = Math.max(0, Math.min(n - 1, this.hi + (k === 'up' || k === 'pgup' ? -1 : 1)));
          const h = this.hist[this.hi]; ed.setTokens(h.tokens); this.result = h.v; this.fmt = h.fmt; this.baseShow = h.base; this.lastTokens = h.tokens; this.queue = null;
          return true;
        }
        if (k === 'left' || k === 'right' || k === 'del' || k === 'S-del') { this.state = 'edit'; if (k === 'right') ed.toStart(); else ed.toEnd(); if (k === 'del') ed.del(); return true; }
        if (k === 'ok') return true;
      }
      if (this.state === 'edit' && (k === 'up' || k === 'down') && ed.cur.row === ed.root && this.hist.length && (ed.isEmpty() || this.browsing)) {
        this.hi = Math.max(0, Math.min(this.hist.length - 1, this.hi + (k === 'up' ? (this.browsing ? -1 : 0) : 1)));
        this.browsing = true;
        const h = this.hist[this.hi]; ed.setTokens(h.tokens); this.result = h.v; this.fmt = h.fmt; this.baseShow = h.base; this.state = 'result'; this.lastTokens = h.tokens;
        return true;
      }
      if (k === 'ok') return true;
      if (this.state === 'result') { if (!C.INPUT_KEYS.test(k)) return false; this.prepInput(k); }
      this.browsing = false;
      return C.inputKey(ed, k, { mode: this.mode, base: this.mode === 'base' });
    }
    rhsTokens() { // 関係式の右辺
      const row = this.lastTokens || []; let idx = -1;
      for (let i = row.length - 1; i >= 0; i--) if (['=', '≠', '<', '>', '≤', '≥'].includes(row[i])) { idx = i; break; }
      return idx >= 0 ? JSON.parse(JSON.stringify(row.slice(idx + 1))) : [];
    }
    prepInput(k) {
      if (this.state !== 'result') return;
      this.state = 'edit'; this.queue = null;
      if (CONT_KEYS.includes(k) && !this.verifyOn()) this.ed.setTokens(['Ans']); else this.ed.clear();
    }
    valueForStore() {
      if (this.state === 'result' && this.result !== undefined) { const v = this.result; return v.k === 'divR' ? v.q : v.k === 'list' ? v.items[0][1] : v.k === 'bool' ? undefined : v; }
      return undefined;
    }
    toggleSD() {
      if (this.state !== 'result') { this.evaluate(false); if (this.state !== 'result') return; }
      const opts = C.formatOptions(this.result, G.s).map((x) => x[0]);
      if (!opts.includes('dec')) return;
      this.fmt = this.fmt === 'dec' ? undefined : 'dec';
    }
    openFormat() {
      if (this.mode === 'base') { // n進: FORMAT で基数を切り替える
        const order = ['dec', 'hex', 'bin', 'oct'];
        G.appState.base = order[(order.indexOf(G.appState.base || 'dec') + 1) % 4];
        if (this.state === 'result') this.baseShow = G.appState.base;
        C.save(); return;
      }
      if (this.state !== 'result') return;
      const opts = C.formatOptions(this.result, G.s, this.mode);
      if (!opts.length) return;
      C.menu(opts.map(([key, lab]) => ({ label: lab, action: () => {
        C.popAll();
        if (key === 'eng') { this.engMode = true; this.engShift = 0; this.fmt = 'eng'; return; }
        this.fmt = key === 'std' ? undefined : key;
      } })));
    }
    qr() {
      const s = Object.assign({}, G.s, { io: 'ld' });
      C.openQR('[KS-900JP] ' + C.tokensText(this.ed.root) + (this.state === 'result' ? ' = ' + C.fmtValue(this.result, s, { fmt: this.fmt }).html.replace(/<[^>]+>/g, '') : ''));
    }
    // ---- CALC（変数に値を代入して計算） ----
    startCALC() {
      if (this.ed.isEmpty()) return;
      let ast; try { ast = C.parse(this.ed.root); } catch (e) { this.err(e); return; }
      const vars = []; const walk = (n) => { if (!n || typeof n !== 'object') return; if (n.t === 'var' && !vars.includes(n.n)) vars.push(n.n); for (const k in n) if (typeof n[k] === 'object') walk(n[k]); };
      walk(ast);
      const ordered = VARN.filter((v) => vars.includes(v));
      if (!ordered.length) { this.evaluate(false); return; }
      this.calcPrompt = { vars: ordered, i: 0, ed: new C.Editor('line') };
      this.state = 'edit';
    }
    calcKey(k) {
      const cp = this.calcPrompt;
      if (cp.done) {
        if (k === 'exe' || k === 'ok') { cp.done = false; cp.i = 0; cp.ed = new C.Editor('line'); this.state = 'edit'; return true; }
        if (k === 'ac' || k === 'back') { this.calcPrompt = null; this.state = 'result'; return true; }
        return true;
      }
      if (k === 'exe' || k === 'ok') {
        const n = cp.vars[cp.i];
        if (!cp.ed.isEmpty()) { try { G.vars[n] = C.evaluate(C.parse(cp.ed.root), C.mkCtx('calc')); C.save(); } catch (e) { C.showError(e); return true; } }
        cp.i++; cp.ed = new C.Editor('line');
        if (cp.i >= cp.vars.length) { const save = this.history; this.history = false; this.state = 'edit'; this.evaluate(false); this.history = save; cp.done = this.state === 'result'; if (!cp.done) this.calcPrompt = null; }
        return true;
      }
      if (k === 'ac' || k === 'back') { this.calcPrompt = null; this.state = 'edit'; return true; }
      if (k === 'up') { cp.i = Math.max(0, cp.i - 1); cp.ed = new C.Editor('line'); return true; }
      if (k === 'down') { cp.i = Math.min(cp.vars.length - 1, cp.i + 1); cp.ed = new C.Editor('line'); return true; }
      C.inputKey(cp.ed, k, {}); return true;
    }
    // ---- 描画 ----
    render() {
      const ed = this.ed, line = ed.mode === 'line';
      let h = '<div class="calc">';
      let inTop = 2;
      if (this.header) { h += '<div class="in fb" style="top:1px">' + this.header() + '</div>'; inTop = 15; }
      const showCur = this.state === 'edit' && !(this.calcPrompt && !this.calcPrompt.done);
      h += '<div class="in' + (line ? ' line' : '') + (ed.overwrite ? ' ovw' : '') + '" style="top:' + inTop + 'px">' + ed.render(showCur) + '</div>';
      if (this.calcPrompt && !this.calcPrompt.done) {
        const cp = this.calcPrompt, n = cp.vars[cp.i];
        const cur = C.fmtValue(G.vars[n], Object.assign({}, G.s, { io: 'ld', numFmt: { type: 'norm', n: 1 } })).html.replace(/<[^>]+>/g, '');
        h += '<div class="fr sel" style="top:41px;left:1px;right:1px;--vx:30px"><span class="lb big">' + VN(n) + '</span><span class="vl"><span class="tk">=</span>' + (cp.ed.isEmpty() ? esc(cur) + '<span class="cur"></span>' : cp.ed.render(true)) + '</span></div>';
      } else if (this.state === 'result') {
        const r = C.fmtValue(this.result, G.s, { fmt: this.fmt, base: this.baseShow, engShift: this.engShift });
        if (r.extra) h += '<div class="out" style="bottom:15px">' + r.html + '</div><div class="in" style="top:auto;bottom:1px"><span class="tk">' + r.extra.label + '</span></div><div class="out">' + r.extra.html + '</div>';
        else h += '<div class="out"><div class="ln">' + r.html + (this.engMode ? '<span class="eng">' + C.IC.engR + '</span>' : '') + '</div></div>';
      } else if (this.emptyLabel && ed.isEmpty()) {
        h += '<div class="label-r fj" style="line-height:13px">' + this.emptyLabel() + '</div>';
      }
      return h + '</div>';
    }
    status() {
      const n = this.hist.length; let up = false, dn = false;
      if (n && !this.calcPrompt) { up = this.state === 'edit' ? true : this.hi > 0; dn = this.state === 'result' && this.hi < n - 1; }
      return { up, down: dn };
    }
  }
  C.CalcScreen = CalcScreen;
  C.calcCatalog = () => [C.CATALOG.func, C.CATALOG.prob, C.CATALOG.numeric, C.CATALOG.angle, C.CATALOG.hyp, C.CATALOG.eng, C.CATALOG.const, C.CATALOG.unit, C.CATALOG.pt, C.CATALOG.other];

  function tokensText(row) {
    return row.map((t) => {
      if (typeof t === 'string') return C.tokenText(t);
      const f = (r) => tokensText(r);
      switch (t.k) {
        case 'frac': return '(' + f(t.a) + ')/(' + f(t.b) + ')';
        case 'mixed': return f(t.w) + '⌟' + f(t.a) + '⌟' + f(t.b);
        case 'sqrt': return '√(' + f(t.a) + ')';
        case 'root': return f(t.n) + 'ˣ√(' + f(t.a) + ')';
        case 'pow': return '^(' + f(t.e) + ')';
        case 'logb': return 'log(' + f(t.b) + ',' + f(t.a) + ')';
        case 'abs': return 'Abs(' + f(t.a) + ')';
        case 'integ': return '∫(' + f(t.a) + ',' + f(t.lo) + ',' + f(t.hi) + ')';
        case 'deriv': return 'd/dx(' + f(t.a) + ',' + f(t.at) + ')';
        case 'sum': return 'Σ(' + f(t.a) + ',' + f(t.lo) + ',' + f(t.hi) + ')';
        case 'prod': return 'Π(' + f(t.a) + ',' + f(t.lo) + ',' + f(t.hi) + ')';
        case 'recur': return '[' + f(t.a) + ']';
      }
      return '';
    }).join('');
  }
  C.tokensText = tokensText;

  // ===== パラメーター入力画面（「▶実行する」付き） =====
  // fields: {label, big?, html?, value?, def?, choices?: [[v,label]], sub?(form), check?(v)}
  class Form {
    constructor(o) {
      Object.assign(this, { title: '', btn: '実行する', vx: 72, sel: 0, top: 0 }, o);
      this.fields = o.fields.map((f) => Object.assign({}, f));
      for (const f of this.fields) { f.ed = new C.Editor('line'); f.editing = false; if (f.value !== undefined) f.val = f.value; }
    }
    count() { return this.fields.length + (this.btn ? 1 : 0); }
    render() {
      const n = this.count(), rows = this.title ? 3 : 4;
      if (this.sel < this.top) this.top = this.sel; if (this.sel >= this.top + rows) this.top = this.sel - rows + 1;
      let h = '<div class="fm" style="--vx:' + this.vx + 'px">';
      const y0 = this.title ? 14 : 0;
      if (this.title) h += '<div class="title">' + (this.titleHtml ? this.title : esc(this.title)) + '</div>';
      for (let i = this.top; i < Math.min(n, this.top + rows); i++) {
        const y = y0 + (i - this.top) * 14;
        if (i === this.fields.length) { h += '<div class="fr' + (i === this.sel ? ' sel' : '') + '" style="top:' + y + 'px;right:1px">' + (this.btnDisabled ? C.IC.minus : C.IC.play) + '<span style="margin-left:1px">' + esc(this.btn) + '</span></div>'; continue; }
        const f = this.fields[i];
        let val;
        if (f.editing) val = f.ed.render(true);
        else if (f.choices) { const c = f.choices.find((x) => x[0] === f.val); val = esc(c ? c[1] : ''); }
        else if (f.display) val = f.display(f.val);
        else if (f.val !== undefined) val = esc(C.shortText(f.val, G.s, 12));
        else val = '';
        h += '<div class="fr' + (i === this.sel ? ' sel' : '') + '" style="top:' + y + 'px">' + '<span class="lb' + (f.big ? ' big' : '') + '">' + (f.html ? f.label : esc(f.label)) + '</span><span class="vl"><span class="tk">:</span>' + val + '</span>' + (f.choices || f.sub ? '<span class="tri">' + C.IC.tri + '</span>' : '') + '</div>';
      }
      if (n > rows) { const H = rows * 14; h += '<div class="bar" style="top:' + (y0 + Math.round(this.top / n * H)) + 'px;height:' + Math.round(H * rows / n) + 'px"></div>'; }
      return h + '</div>';
    }
    commit() {
      const f = this.fields[this.sel]; if (!f || !f.editing) return true;
      if (f.ed.isEmpty()) { f.editing = false; return true; }
      try {
        const v = C.evaluate(C.parse(f.ed.root), C.mkCtx('calc'));
        if (!V.isReal(v)) throw new C.CalcError('Argument');
        if (f.check) f.check(v);
        f.val = v; f.editing = false; return true;
      } catch (e) { C.showError(e); return false; }
    }
    values() { return this.fields.map((f) => (f.val !== undefined ? f.val : f.def)); }
    key(k) {
      const n = this.count(); const f = this.fields[this.sel];
      if (f && f.editing) {
        if (k === 'exe' || k === 'ok' || k === 'down' || k === 'up') { if (this.commit()) { if (k === 'up') this.sel = Math.max(0, this.sel - 1); else this.sel = Math.min(n - 1, this.sel + 1); } return true; }
        if (k === 'ac') { f.ed.clear(); return true; }
        if (k === 'back') { f.editing = false; return true; }
        if (k === 'variable') { C.openVariables({ onRecall: (t) => f.ed.insert(t) }); return true; }
        if (k === 'catalog') { C.openCatalog([C.CATALOG.prob, C.CATALOG.numeric, C.CATALOG.angle, C.CATALOG.hyp, C.CATALOG.const, C.CATALOG.other], f.ed); return true; }
        C.inputKey(f.ed, k, {}); return true;
      }
      if (k === 'up') { this.sel = (this.sel - 1 + n) % n; return true; }
      if (k === 'down') { this.sel = (this.sel + 1) % n; return true; }
      if (k === 'exe' || k === 'ok') {
        if (this.sel === this.fields.length) { if (this.btnDisabled) return true; try { this.onSubmit(this.values(), this); } catch (e) { C.showError(e); } return true; }
        if (f.choices) { C.push(new Menu({ items: f.choices.map(([v, l]) => ({ label: l, big: f.bigChoices, action: (m) => { C.pop(m); f.val = v; if (f.onPick) f.onPick(v, this); } })) })); return true; }
        if (f.sub) { f.sub(this); return true; }
        f.editing = true; f.ed.clear(); return true;
      }
      if (k === 'back') { if (this.onBack) this.onBack(); else C.pop(this); return true; }
      if (k === 'ac') { if (this.onAC) this.onAC(); return true; }
      if (!f || f.choices || f.sub) return true;
      if (C.INPUT_KEYS.test(k)) { f.editing = true; f.ed.clear(); C.inputKey(f.ed, k, {}); return true; }
      return true;
    }
  }
  C.Form = Form;

  // 値 -> トークン列
  C.valueToTokens = function (v) {
    if (v === undefined || v === null) return [];
    if (E.isRat(v)) { const [n, d] = E.ratOf(v); if (d === 1n) return chars(n.toString()); }
    return chars(Number(E.toNum(v).toPrecision(15)).toString().replace('e+', 'E').replace('e', 'E'));
  };
  function chars(s) { const out = []; for (const ch of s) out.push(ch === '-' ? 'neg' : ch); return out; }
})(window.C = window.C || {});
