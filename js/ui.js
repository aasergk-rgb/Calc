/* UI フレームワーク: 画面・メニュー・フォーム・計算画面・共通メニュー */
(function (C) {
  'use strict';
  const E = C.E, V = C.V, esc = C.esc;

  // ===== 設定 =====
  const DEFAULTS = { io: 'mm', angle: 'deg', numFmt: { type: 'norm', n: 1 }, eng: false, frac: 'improper', complex: 'rect', decMark: '.', sep: false, recur: false, contrast: 1, apo: 10, font: 'normal', qr: 11, verify: false, cxRoots: true };
  const G = C.G = {
    s: JSON.parse(JSON.stringify(DEFAULTS)), vars: {}, ans: E.Q(0), preAns: E.Q(0), fdef: { f: [], g: [] },
    mats: {}, vecs: {}, ov: [], shift: false, power: true, app: null, appState: {},
  };
  C.DEFAULTS = DEFAULTS;
  C.APPS = [];
  C.lateApps = {};
  for (const v of ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z']) G.vars[v] = E.Q(0);

  // BigInt を含む値の保存
  const rep = (k, v) => (typeof v === 'bigint' ? { $b: v.toString() } : v);
  const rev = (k, v) => (v && typeof v === 'object' && v.$b !== undefined ? BigInt(v.$b) : v);
  C.save = function () {
    try {
      localStorage.setItem('kscalc.v1', JSON.stringify({ s: G.s, vars: G.vars, ans: G.ans, preAns: G.preAns, fdef: G.fdef, mats: G.mats, vecs: G.vecs, appState: G.appState, app: G.app && G.app.id }, rep));
    } catch (e) { /* 保存不可 */ }
  };
  C.load = function () {
    try {
      const raw = localStorage.getItem('kscalc.v1'); if (!raw) return null;
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

  // ===== オーバーレイ =====
  C.push = function (ov) { G.ov.push(ov); C.render(); return ov; };
  C.pop = function (ov) { if (ov) { const i = G.ov.indexOf(ov); if (i >= 0) G.ov.splice(i, 1); } else G.ov.pop(); C.render(); };
  C.popAll = function () { G.ov.length = 0; C.render(); };
  C.popTo = function (n) { G.ov.length = Math.min(G.ov.length, n); C.render(); };
  C.top = () => G.ov[G.ov.length - 1];

  // ===== メニュー =====
  class Menu {
    constructor(o) { this.title = o.title || ''; this.items = o.items || []; this.sel = o.sel || 0; this.onBack = o.onBack; this.scrollTop = 0; this.rows = 6; this.hint = o.hint; this.noAC = o.noAC; this.keyHook = o.keyHook; this.after = o.after; }
    render() {
      const n = this.items.length, rows = this.rows;
      if (this.sel < this.scrollTop) this.scrollTop = this.sel;
      if (this.sel >= this.scrollTop + rows) this.scrollTop = this.sel - rows + 1;
      let h = '<div class="menu"><div class="title"><span>' + esc(this.title) + '</span><span>' + (n > rows ? (this.sel + 1) + '/' + n : '') + '</span></div><div class="items">';
      for (let i = this.scrollTop; i < Math.min(n, this.scrollTop + rows); i++) {
        const it = this.items[i];
        const lab = typeof it.label === 'function' ? it.label() : it.label;
        const right = typeof it.right === 'function' ? it.right() : it.right;
        const chk = typeof it.checked === 'function' ? it.checked() : it.checked;
        h += '<div class="it' + (i === this.sel ? ' sel' : '') + '"><span' + (chk ? ' class="chk"' : '') + '>' + (it.html ? lab : esc(lab)) + '</span>' + (right !== undefined ? '<span class="r">' + (it.rhtml ? right : esc(right)) + (it.sub ? ' ▶' : '') + '</span>' : it.sub ? '<span class="r">▶</span>' : '') + '</div>';
      }
      if (n > rows) { const hgt = Math.max(10, 126 * rows / n); h += '<div class="scroll" style="top:' + (this.scrollTop / n * 126) + 'px;height:' + hgt + 'px"></div>'; }
      h += '</div>' + (this.hint ? '<div class="hint">' + esc(this.hint) + '</div>' : '') + '</div>';
      return h;
    }
    choose(i) {
      const it = this.items[i]; if (!it || it.disabled) return;
      if (it.sub) { const sub = it.sub(); if (sub) C.push(sub instanceof Menu ? sub : new Menu({ title: it.title || (typeof it.label === 'string' ? it.label : ''), items: sub })); return; }
      if (it.action) it.action(this);
      C.render();
    }
    key(k) {
      if (this.keyHook && this.keyHook(k, this)) return true;
      const n = this.items.length;
      if (k === 'up') { this.sel = (this.sel - 1 + n) % n; return true; }
      if (k === 'down') { this.sel = (this.sel + 1) % n; return true; }
      if (k === 'left') { this.sel = Math.max(0, this.sel - this.rows); return true; }
      if (k === 'right') { this.sel = Math.min(n - 1, this.sel + this.rows); return true; }
      if (k === 'ok' || k === 'exe') { this.choose(this.sel); return true; }
      if (/^[0-9]$/.test(k)) {
        const exact = this.items.findIndex((it) => it.label === k);
        if (exact >= 0) { this.sel = exact; this.choose(exact); return true; }
        if (k !== '0' && +k <= n) { this.sel = +k - 1; this.choose(this.sel); return true; }
      }
      if (k === 'back') { C.pop(this); if (this.onBack) this.onBack(); return true; }
      if (k === 'ac' && !this.noAC) { C.popAll(); return true; }
      return true;
    }
  }
  C.Menu = Menu;
  C.menu = (title, items, o) => C.push(new Menu(Object.assign({ title, items }, o || {})));

  // ===== メッセージ =====
  class Msg {
    constructor(o) { Object.assign(this, o); }
    render() { return '<div class="msg"><div class="t">' + esc(this.title || '') + '</div>' + (this.text ? '<div class="d">' + esc(this.text) + '</div>' : '') + (this.hint ? '<div class="h">' + esc(this.hint) + '</div>' : '') + '</div>'; }
    key(k) {
      if (this.onKey) { if (this.onKey(k)) return true; }
      if (['ac', 'back', 'ok', 'exe', 'left', 'right'].includes(k)) { C.pop(this); if (this.onClose) this.onClose(k); return true; }
      return true;
    }
  }
  C.Msg = Msg;
  C.showError = function (e, onClose) {
    if (!(e instanceof C.CalcError)) { console.error(e); e = new C.CalcError(/Maximum call stack/.test(String(e)) ? 'Stack' : 'Math'); }
    return C.push(new Msg({ title: e.title, text: e.jp, hint: '[AC] キャンセル  [◀][▶] 戻る', onClose }));
  };
  C.confirm = function (title, text, yes) {
    C.menu(title, [{ label: 'はい', action: (m) => { C.pop(m); yes(); } }, { label: 'キャンセル', action: (m) => C.pop(m) }], { hint: text });
  };

  // ===== キー入力 -> 数式エディタ =====
  const SIMPLE = {
    '.': '.', exp: 'E', 'S-exp': 'π', ans: 'Ans', 'S-ans': 'e', add: '+', sub: '-', mul: '*', div: '/',
    'S-mul': 'nPr', 'S-div': 'divR', 'S-add': 'nCr', 'S-sub': 'PreAns', lp: '(', rp: ')', 'S-lp': '%', 'S-rp': ',',
    neg: 'neg', 'S-neg': '∠', dms: 'dms', 'S-dms': 'i', x: 'x', 'S-x': '=', sin: 'sin(', cos: 'cos(', tan: 'tan(',
    'S-sin': 'asin(', 'S-cos': 'acos(', 'S-tan': 'atan(', ln: 'ln(', inv: '⁻¹', 'S-inv': '!', sq: '²', 'S-sq': '³', 'S-0': 'Ran#',
  };
  C.inputKey = function (ed, k, opt) {
    opt = opt || {};
    const math = ed.mode === 'math';
    if (opt.base) {
      const hx = { x: 'A', frac: 'B', sqrt: 'C', sq: 'D', pow: 'E', logb: 'F' };
      if (hx[k]) { ed.insert('hx' + hx[k]); return true; }
      if (['.', 'exp', 'S-exp', 'S-ans', 'sin', 'cos', 'tan', 'ln', 'S-sin', 'S-cos', 'S-tan', 'S-ln', 'dms', 'S-dms', 'S-neg', 'inv', 'S-inv', 'S-sq', 'S-pow', 'S-sqrt', 'S-frac', 'S-logb', 'S-0', 'S-.', 'S-lp', 'S-mul', 'S-add', 'S-div'].includes(k)) return true;
    }
    if (/^[0-9]$/.test(k)) { ed.insert(k); return true; }
    if (SIMPLE[k] !== undefined) {
      if (k === 'S-dms' && opt.mode !== 'cplx') { /* i は複素数のみ */ if (!opt.allowI) return true; }
      ed.insert(SIMPLE[k]); return true;
    }
    switch (k) {
      case 'S-ln': if (math) { ed.insert('e'); ed.insertTpl('pow'); } else ed.insert('e^('); return true;
      case 'pow': if (math) ed.insertTpl('pow'); else ed.insert('^('); return true;
      case 'S-pow': if (math) ed.insertTpl('root'); else ed.insert('xrt('); return true;
      case 'sqrt': if (math) ed.insertTpl('sqrt'); else ed.insert('√('); return true;
      case 'S-sqrt': if (math) { ed.insertTpl('root', { n: ['3'] }); const t = ed.cur.row; const p = ed.findParent(t); if (p) ed.cur = { row: p.node.a, i: p.node.a.length }; } else ed.insert('∛('); return true;
      case 'frac': if (math) ed.insertTpl('frac'); else ed.insert('⌟'); return true;
      case 'S-frac': if (math) ed.insertTpl('mixed'); else ed.insert('⌟'); return true;
      case 'logb': if (math) ed.insertTpl('logb'); else ed.insert('log('); return true;
      case 'S-logb': if (math) { ed.insert('1'); ed.insert('0'); ed.insertTpl('pow'); } else ed.insert('10^('); return true;
      case 'S-.': if (math) ed.insertTpl('recur'); return true;
      case 'del': ed.del(); return true;
      case 'S-del': if (math) ed.capture = true; else ed.overwrite = !ed.overwrite; return true;
      case 'left': ed.left(); return true;
      case 'right': ed.right(); return true;
      case 'up': return ed.up();
      case 'down': return ed.down();
    }
    return false;
  };
  // カタログ項目の挿入
  C.insertItem = function (ed, item) {
    const math = ed.mode === 'math';
    if (item.tpl) {
      if (math) { if (item.pre) ed.insertMany(item.pre); ed.insertTpl(item.tpl, item.preset ? JSON.parse(JSON.stringify(item.preset)) : undefined); }
      else ed.insertMany(item.line || []);
    } else if (item.toks) ed.insertMany(item.toks);
    else ed.insert(item.tok);
  };

  // ===== カタログ =====
  const T = (label, tok, right) => ({ label, tok, right });
  const TP = (label, tpl, line, right, pre, preset) => ({ label, tpl, line, right, pre, preset });
  C.CATALOG = {
    func: () => ['関数解析', [
      TP('∫ 積分', 'integ', ['∫('], ''), TP('d/dx 微分', 'deriv', ['d/dx('], ''), TP('Σ 総和', 'sum', ['Σ('], ''), TP('Π 総積', 'prod', ['Π('], ''),
      T('log(', 'log('), TP('logₐb', 'logb', ['log(']), TP('|x| 絶対値', 'abs', ['Abs(']),
      T('f(x)', 'f('), T('g(x)', 'g('),
    ]],
    prob: () => ['確率', [T('%', '%'), T('x! 階乗', '!'), T('nPr 順列', 'nPr'), T('nCr 組合せ', 'nCr'), T('Ran# 乱数', 'Ran#'), T('RanInt#( 整数乱数', 'RanInt#(')]],
    numeric: () => ['数値計算', [TP('Abs 絶対値', 'abs', ['Abs(']), T('Rnd( 丸め', 'Rnd('), T('Int( 整数部', 'Int('), T('Intg( 最大整数', 'Intg('), T('GCD( 最大公約数', 'GCD('), T('LCM( 最小公倍数', 'LCM('), T('÷R 余り計算', 'divR')]],
    angle: () => ['角度/座標/60進', [T('° 度', '°'), T('ʳ ラジアン', 'ʳ'), T('ᵍ グラード', 'ᵍ'), T('Pol( 極座標変換', 'Pol('), T('Rec( 直交座標変換', 'Rec('), T('°′″ 度分秒', 'dms')]],
    hyp: () => ['双曲線関数', [T('sinh(', 'sinh('), T('cosh(', 'cosh('), T('tanh(', 'tanh('), T('sinh⁻¹(', 'asinh('), T('cosh⁻¹(', 'acosh('), T('tanh⁻¹(', 'atanh(')]],
    eng: () => ['エンジニアリング記号', ['k', 'M', 'G', 'T', 'P', 'E', 'm', 'μ', 'n', 'p', 'f'].map((s) => T(s, 'eng:' + s, '×10^' + C.ENG_SYMBOLS[s]))],
    unit: () => ['単位換算', null, () => C.UNIT_MENU.map(([name, , subs]) => ({ label: name, sub: () => (subs.length === 1 && subs[0][0] === '' ? unitItems(subs[0][1]) : subs.map(([sn, list]) => ({ label: sn, sub: () => unitItems(list) }))) }))],
    const: () => ['科学定数', null, () => C.CONST_CATS.map(([name, list]) => ({ label: name, sub: () => list.map(([key, sym, nm]) => ({ label: sym, right: nm, insert: { tok: 'c:' + key } })) }))],
    pt: () => ['周期表', null, () => [{ label: '周期表', action: () => C.openPeriodic() }, { label: '原子量 AtWt(', insert: { tok: 'AtWt(' } }]],
    other: () => ['その他', [T('Ans', 'Ans'), T('PreAns', 'PreAns'), T('π', 'π'), T('e', 'e'), TP('10^■', 'pow', ['10^('], '', ['1', '0']), TP('e^■', 'pow', ['e^('], '', ['e']), TP('∛ 立方根', 'root', ['∛('], '', null, { n: ['3'] }), TP('ˣ√ べき乗根', 'root', ['xrt(']), T('x⁻¹', '⁻¹'), T('= ', '='), T('≠', '≠'), T('<', '<'), T('>', '>'), T('≤', '≤'), T('≥', '≥'), T(': 区切り', ':'), T(',', ','), T('(', '('), T(')', ')')]],
    cplx: () => ['複素数計算', [T('i 虚数単位', 'i'), T('∠ 偏角記号', '∠'), T('Arg( 偏角', 'Arg('), T('Conjg( 共役複素数', 'Conjg('), T('ReP( 実部', 'ReP('), T('ImP( 虚部', 'ImP('), TP('Abs 絶対値', 'abs', ['Abs(']), T('▸r∠θ 極座標形式', '▶r∠θ'), T('▸a+bi 直交座標形式', '▶a+bi')]],
    baseSel: () => ['基数指定', [T('d 10進数', 'd:'), T('h 16進数', 'h:'), T('b 2進数', 'b:'), T('o 8進数', 'o:')]],
    logic: () => ['論理演算', [T('and', 'and'), T('or', 'or'), T('xor', 'xor'), T('xnor', 'xnor'), T('Not(', 'Not('), T('Neg(', 'Neg(')]],
    mat: () => ['行列', [T('MatA', 'MatA'), T('MatB', 'MatB'), T('MatC', 'MatC'), T('MatD', 'MatD'), T('MatAns', 'MatAns'), T('Det( 行列式', 'Det('), T('Trn( 転置行列', 'Trn('), T('Identity( 単位行列', 'Identity('), T('Ref( 階段行列', 'Ref('), T('Rref( 被約階段行列', 'Rref('), TP('Abs 絶対値', 'abs', ['Abs('])]],
    vec: () => ['ベクトル', [T('VctA', 'VctA'), T('VctB', 'VctB'), T('VctC', 'VctC'), T('VctD', 'VctD'), T('VctAns', 'VctAns'), T('• 内積', 'dot'), T('× 外積', '*'), T('Angle( なす角', 'Angle('), T('UnitV( 単位ベクトル', 'UnitV('), TP('Abs 絶対値', 'abs', ['Abs('])]],
  };
  function unitItems(list) { return list.map((key) => { const u = C.UNIT_BY_KEY[key]; return u ? { label: u.from + '▸' + u.to, insert: { tok: 'u:' + key } } : null; }).filter(Boolean); }
  C.openCatalog = function (cats, ed, after) {
    const base = G.ov.length;
    const close = () => C.popTo(base);
    const mk = (entry) => {
      const [name, list, dyn] = entry;
      const conv = (items) => items.map((it) => {
        if (it.sub) return { label: it.label, right: it.right, sub: () => conv(it.sub()) };
        if (it.action) return { label: it.label, right: it.right, action: () => { close(); it.action(); } };
        const ins = it.insert || it;
        return { label: it.label, right: it.right, action: () => { close(); C.insertItem(ed, ins); if (after) after(); } };
      });
      return { label: name, sub: () => conv(list || dyn()) };
    };
    C.menu('カタログ', cats.map((c) => mk(c())));
  };

  // ===== 変数メニュー =====
  C.openVariables = function (opts) {
    // opts: {onRecall(tok), getValue() => value to store}
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'];
    const base = G.ov.length; const close = () => C.popTo(base);
    const s1 = Object.assign({}, G.s, { numFmt: { type: 'norm', n: 1 }, io: 'ld' });
    C.menu('変数', names.map((n) => ({
      label: n + '=', right: () => C.fmtValue(G.vars[n], s1).html.replace(/<[^>]+>/g, ''),
      sub: () => [
        { label: '呼び出し', action: () => { close(); opts.onRecall(n === 'E' ? 'E_' : n); } },
        { label: '保存', action: () => { try { const v = opts.getValue(); if (v === undefined) return; if (!V.isReal(v) && !V.isCx(v)) throw new C.CalcError('Argument'); G.vars[n] = v; C.save(); close(); C.push(new Msg({ title: n + ' に保存しました', text: C.fmtValue(v, s1).html.replace(/<[^>]+>/g, '') })); } catch (e) { close(); C.showError(e); } } },
      ],
    })));
  };

  // ===== f(x)/g(x) の定義 =====
  C.openFxMenu = function (ed, after) {
    const base = G.ov.length;
    C.menu('f(x)/g(x)', [
      { label: 'f(x)の定義', action: () => C.defineFn('f', after) },
      { label: 'g(x)の定義', action: () => C.defineFn('g', after) },
      { label: 'f(x)', right: '入力', action: () => { C.popTo(base); ed.insert('f('); if (after) after(); } },
      { label: 'g(x)', right: '入力', action: () => { C.popTo(base); ed.insert('g('); if (after) after(); } },
    ]);
  };
  C.defineFn = function (fn, done) {
    G.ov.length = 0;
    const ed = new C.Editor(C.edMode()); ed.setTokens(G.fdef[fn] || []);
    const ov = {
      render() { return '<div class="calc"><div class="lbl-sm">' + fn + '(x)=</div><div class="input ' + ed.mode + '">' + ed.render(true) + '</div><div class="hint lbl-sm" style="text-align:right">[EXE] 定義</div></div>'; },
      key(k) {
        if (k === 'exe' || k === 'ok') {
          if (ed.root.length) { try { C.parse(ed.root); } catch (e) { C.showError(e); return true; } }
          G.fdef[fn] = JSON.parse(JSON.stringify(ed.root)); C.save(); C.pop(ov); if (done) done(); return true;
        }
        if (k === 'back') { C.pop(ov); return true; }
        if (k === 'ac') { ed.clear(); return true; }
        if (k === 'fx' || k === 'S-fx') return true;
        C.inputKey(ed, k, {}); return true;
      },
    };
    C.push(ov);
  };

  // ===== 周期表 =====
  C.openPeriodic = function (onPick) {
    let z = G.appState.ptSel || 1;
    const grid = {}; for (const el of C.ELEMENTS) grid[el.pos[0] + ',' + el.pos[1]] = el;
    const ov = {
      render() {
        let h = '<div class="pt">';
        for (let r = 0; r < 10; r++) for (let c = 0; c < 18; c++) {
          const el = grid[r + ',' + c];
          if (r === 7) { h += '<div></div>'; continue; }
          h += el ? '<div class="e' + (el.z === z ? ' sel' : '') + '">' + el.sym + '</div>' : '<div></div>';
        }
        const el = C.ELEMENTS[z - 1];
        h += '</div><div class="pt-info"><span>' + el.z + ' ' + el.sym + ' ' + esc(el.name) + '</span><span>' + (el.br ? '[' + el.w + ']' : el.w) + '</span></div>';
        return h;
      },
      key(k) {
        const el = C.ELEMENTS[z - 1]; let [r, c] = el.pos;
        const find = (rr, cc, dr, dc) => { for (let i = 0; i < 20; i++) { rr += dr; cc += dc; if (rr < 0 || rr > 9 || cc < 0 || cc > 17) return null; if (rr === 7) continue; const e = grid[rr + ',' + cc]; if (e) return e; } return null; };
        let nx = null;
        if (k === 'left') nx = find(r, c, 0, -1) || (z > 1 ? C.ELEMENTS[z - 2] : null);
        if (k === 'right') nx = find(r, c, 0, 1) || (z < 118 ? C.ELEMENTS[z] : null);
        if (k === 'up') { nx = find(r, c, -1, 0); if (!nx && r >= 8) nx = find(r === 8 ? 5 : 6, Math.min(c, 2) === 2 ? 2 : c, 0, 0) || grid[(r === 8 ? 5 : 6) + ',2']; }
        if (k === 'down') nx = find(r, c, 1, 0);
        if (nx) { z = nx.z; G.appState.ptSel = z; return true; }
        if (k === 'ok' || k === 'exe') { C.pop(ov); if (onPick) onPick(z); else if (C.activeEditor) { const ed = C.activeEditor(); if (ed) { ed.insert('AtWt('); for (const ch of String(z)) ed.insert(ch); ed.insert(')'); } } C.render(); return true; }
        if (k === 'back' || k === 'ac') { C.pop(ov); return true; }
        return true;
      },
    };
    C.push(ov);
  };

  // ===== QR コード =====
  C.openQR = function (text) {
    if (typeof window.qrcode !== 'function') { C.push(new Msg({ title: 'QRコード', text: 'QRコードライブラリを読み込めません（オフライン）' })); return; }
    const ver = G.s.qr === 3 ? 3 : 11;
    let qr;
    try { qr = window.qrcode(ver, 'L'); qr.addData(unescape(encodeURIComponent(text))); qr.make(); }
    catch (e) { C.push(new Msg({ title: 'QRコード', text: ver === 3 ? 'バージョン3設定は非対応です' : 'データが大きすぎます' })); return; }
    const svg = qr.createSvgTag({ cellSize: 2, margin: 2, scalable: true });
    const ov = { render() { return '<div class="qr">' + svg + '<div class="lbl-sm">Ver.' + ver + '<br>1/1</div></div>'; }, key(k) { if (['ac', 'back', 'ok', 'exe', 'S-format'].includes(k)) C.pop(ov); return true; } };
    C.push(ov);
  };

  // ===== 計算画面 =====
  const CONT_KEYS = ['add', 'sub', 'mul', 'div', 'sq', 'S-sq', 'inv', 'S-inv', 'pow', 'S-lp', 'S-mul', 'S-div', 'S-add', 'dms'];
  class CalcScreen {
    constructor(o) {
      this.mode = o.mode || 'calc'; this.app = o.app; this.ed = new C.Editor(C.edMode());
      this.state = 'edit'; this.result = undefined; this.fmt = undefined; this.hist = []; this.hi = -1; this.queue = null;
      this.extraCtx = o.extraCtx; this.onResult = o.onResult; this.baseFlags = {};
    }
    resetMode() { this.ed = new C.Editor(C.edMode()); this.state = 'edit'; this.hist = []; this.hi = -1; }
    ctx() { return C.mkCtx(this.mode, Object.assign({ base: G.appState.base || 'dec' }, this.extraCtx ? this.extraCtx() : {})); }
    evaluate(dec) {
      const ed = this.ed;
      if (ed.isEmpty()) { if (this.state === 'result' && this.lastTokens) ed.setTokens(this.lastTokens); else return; }
      let ast;
      try { ast = C.parse(ed.root, { sheet: false }); } catch (e) { this.err(e); return; }
      const list = ast.t === 'stmts' ? ast.list : [ast];
      if (this.queue && this.queue.tokens === ed.snapshot() && this.state === 'result' && this.queue.i < list.length - 1) this.queue.i++;
      else this.queue = { tokens: ed.snapshot(), i: 0 };
      const node = list[this.queue.i];
      const ctx = this.ctx();
      let v;
      try {
        v = C.evaluate(node, ctx);
        if (v === undefined) throw new C.CalcError('Syntax');
      } catch (e) { this.err(e); return; }
      this.flags = ctx.flags;
      this.result = v; this.state = 'result';
      this.fmt = dec ? 'dec' : ctx.flags.dms ? 'sexa' : ctx.flags.polar ? 'polar' : ctx.flags.rect ? 'rect' : undefined;
      if (this.mode === 'base') { this.fmt = 'base'; this.baseShow = ctx.flags.base || G.appState.base || 'dec'; }
      this.lastTokens = JSON.parse(JSON.stringify(ed.root));
      // Ans の更新
      if (V.isMat(v)) G.mats.MatAns = v;
      else if (V.isVec(v)) G.vecs.VctAns = v;
      else if (V.isReal(v) || V.isCx(v)) { if (this.mode === 'calc') G.preAns = G.ans; G.ans = v; }
      else if (v.k === 'divR') { G.preAns = G.ans; G.ans = v.q; }
      else if (v.k === 'list') { G.ans = v.items[0][1]; }
      if (this.queue.i === 0 || this.queue.i === list.length - 1) {
        this.hist.push({ tokens: this.lastTokens, v, fmt: this.fmt, base: this.baseShow });
        if (this.hist.length > 30) this.hist.shift();
      }
      this.hi = this.hist.length - 1;
      if (this.onResult) this.onResult(v);
      C.save();
    }
    err(e) {
      this.state = 'edit';
      C.showError(e, (k) => { if (k === 'ac') { this.ed.clear(); } else { this.ed.toEnd(); } C.render(); });
    }
    key(k) {
      const ed = this.ed;
      if (k === 'exe') { this.evaluate(false); return true; }
      if (k === 'S-exe') { this.evaluate(true); return true; }
      if (k === 'ac') { ed.clear(); this.state = 'edit'; this.queue = null; this.hi = this.hist.length - 1; this.browsing = false; return true; }
      if (k === 'format') { this.openFormat(); return true; }
      if (k === 'S-format') { this.qr(); return true; }
      if (k === 'variable') { C.openVariables({ onRecall: (t) => { this.prepInput('x'); ed.insert(t); }, getValue: () => this.valueForStore() }); return true; }
      if (k === 'fx') { this.prepInput('x'); C.openFxMenu(ed); return true; }
      if (k === 'S-fx') { this.prepInput('x'); ed.insert('g('); return true; }
      if (k === 'catalog') { this.prepInput('x'); C.openCatalog(this.app.catalog(), ed); return true; }
      if (this.state === 'result') {
        if (k === 'up' || k === 'down') {
          const n = this.hist.length; if (!n) return true;
          this.hi = Math.max(0, Math.min(n - 1, this.hi + (k === 'up' ? -1 : 1)));
          const h = this.hist[this.hi]; ed.setTokens(h.tokens); this.result = h.v; this.fmt = h.fmt; this.baseShow = h.base; this.lastTokens = h.tokens; this.queue = null;
          return true;
        }
        if (k === 'left' || k === 'right' || k === 'del' || k === 'S-del') { this.state = 'edit'; if (k === 'right') ed.toStart(); else ed.toEnd(); if (k === 'del') ed.del(); return true; }
        if (this.mode === 'base' && ['dec', 'hex', 'bin', 'oct'].includes(k)) { this.baseShow = k; return true; }
      }
      if (this.state === 'edit' && (k === 'up' || k === 'down') && (ed.isEmpty() || !ed.findParent(ed.cur.row))) {
        if (ed.cur.row === ed.root && this.hist.length) {
          // 計算履歴を呼び出す
          if (ed.isEmpty() || this.browsing) {
            this.hi = Math.max(0, Math.min(this.hist.length - 1, this.hi + (k === 'up' ? (this.browsing ? -1 : 0) : 1)));
            this.browsing = true;
            const h = this.hist[this.hi]; ed.setTokens(h.tokens); this.result = h.v; this.fmt = h.fmt; this.baseShow = h.base; this.state = 'result'; this.lastTokens = h.tokens;
            return true;
          }
        }
      }
      // 入力系
      const before = this.state;
      if (before === 'result') {
        const isInput = this.isInputKey(k);
        if (!isInput) return false;
        this.prepInput(k);
      }
      this.browsing = false;
      return C.inputKey(ed, k, { mode: this.mode, base: this.mode === 'base' });
    }
    isInputKey(k) { return /^[0-9]$/.test(k) || ['.', 'exp', 'S-exp', 'ans', 'S-ans', 'add', 'sub', 'mul', 'div', 'S-mul', 'S-div', 'S-add', 'S-sub', 'lp', 'rp', 'S-lp', 'S-rp', 'neg', 'S-neg', 'dms', 'S-dms', 'x', 'S-x', 'sin', 'cos', 'tan', 'S-sin', 'S-cos', 'S-tan', 'ln', 'S-ln', 'inv', 'S-inv', 'sq', 'S-sq', 'pow', 'S-pow', 'sqrt', 'S-sqrt', 'frac', 'S-frac', 'logb', 'S-logb', 'S-.', 'S-0'].includes(k); }
    prepInput(k) {
      if (this.state !== 'result') return;
      this.state = 'edit'; this.queue = null;
      if (CONT_KEYS.includes(k)) this.ed.setTokens(['Ans']); else this.ed.clear();
    }
    valueForStore() {
      if (this.state === 'result' && this.result !== undefined) {
        const v = this.result; return v.k === 'divR' ? v.q : v.k === 'list' ? v.items[0][1] : v;
      }
      if (this.ed.isEmpty()) return G.ans;
      this.evaluate(false);
      if (this.state === 'result') return this.result;
      return undefined;
    }
    openFormat() {
      if (this.state !== 'result') { if (!this.ed.isEmpty()) this.evaluate(false); if (this.state !== 'result') return; }
      const v = this.result;
      if (this.mode === 'base') {
        C.menu('基数変換', [['dec', '10進数'], ['hex', '16進数'], ['bin', '2進数'], ['oct', '8進数']].map(([key, lab]) => ({ label: lab, action: () => { this.baseShow = key; C.popAll(); } })));
        return;
      }
      const opts = C.formatOptions(v, G.s);
      if (!opts.length) return;
      C.menu('フォーマット', opts.map(([key, lab]) => ({ label: lab, checked: () => (this.fmt || 'std') === key, action: () => { this.fmt = key === 'std' ? undefined : key; C.popAll(); } })));
    }
    qr() {
      const s = Object.assign({}, G.s, { io: 'ld' });
      const txt = '[KS-900JP] ' + tokensText(this.ed.root) + (this.state === 'result' ? ' = ' + C.fmtValue(this.result, s, { fmt: this.fmt }).html.replace(/<[^>]+>/g, '') : '');
      C.openQR(txt);
    }
    render() {
      const ed = this.ed;
      const small = ed.mode === 'line' && G.s.font === 'small';
      let h = '<div class="calc"><div class="input ' + ed.mode + (small ? ' small' : '') + (ed.overwrite ? ' ovw' : '') + '">' + ed.render(this.state === 'edit') + '</div>';
      if (this.state === 'result') {
        const r = C.fmtValue(this.result, G.s, { fmt: this.fmt, base: this.baseShow });
        h += '<div class="output">' + r.html + '</div>';
      }
      return h + '</div>';
    }
    status() { const n = this.hist.length; let up = false, dn = false; if (n) { up = this.state === 'edit' ? true : this.hi > 0; dn = this.state === 'result' && this.hi < n - 1; } return (up ? '▲' : '') + (dn ? '▼' : ''); }
  }
  C.CalcScreen = CalcScreen;
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

  // ===== フォーム（複数の入力欄） =====
  class Form {
    constructor(o) {
      this.title = o.title; this.fields = o.fields.map((f) => Object.assign({}, f)); this.sel = 0; this.onSubmit = o.onSubmit; this.onBack = o.onBack;
      this.btn = o.btn; // 実行ボタンの文言
      for (const f of this.fields) { f.ed = new C.Editor(f.math ? C.edMode() : 'line'); if (f.value !== undefined) f.ed.setTokens(C.valueToTokens(f.value)); else if (f.tokens) f.ed.setTokens(f.tokens); f.editing = false; }
      this.rows = o.rows || 5; this.scrollTop = 0;
    }
    count() { return this.fields.length + (this.btn ? 1 : 0); }
    render() {
      const n = this.count();
      if (this.sel < this.scrollTop) this.scrollTop = this.sel;
      if (this.sel >= this.scrollTop + this.rows) this.scrollTop = this.sel - this.rows + 1;
      let h = '<div class="menu form">' + (this.title ? '<div class="title"><span>' + esc(this.title) + '</span><span></span></div>' : '') + '<div class="items">';
      for (let i = this.scrollTop; i < Math.min(n, this.scrollTop + this.rows); i++) {
        if (i === this.fields.length) { h += '<div class="fld btn' + (i === this.sel ? ' sel' : '') + '">' + esc(this.btn) + '</div>'; continue; }
        const f = this.fields[i];
        let val;
        if (f.editing) val = f.ed.render(true);
        else if (f.ed.isEmpty()) val = '';
        else { try { const v = this.valueOf(i); val = C.fmtValue(v, G.s, {}).html; } catch (e) { val = f.ed.render(false); } }
        h += '<div class="fld' + (i === this.sel ? ' sel' : '') + '"><span class="lb">' + esc(f.label) + '</span><span class="vl">' + val + '</span></div>';
      }
      return h + '</div></div>';
    }
    valueOf(i) {
      const f = this.fields[i];
      if (f.ed.isEmpty()) { if (f.def !== undefined) return f.def; throw new C.CalcError('Syntax'); }
      const v = C.evaluate(C.parse(f.ed.root), C.mkCtx(f.mode || 'calc'));
      if (!V.isReal(v) && !(f.allowCx && V.isCx(v))) throw new C.CalcError('Argument');
      return v;
    }
    values() { return this.fields.map((_, i) => this.valueOf(i)); }
    commit() {
      const f = this.fields[this.sel]; if (!f) return true;
      if (f.editing) { try { if (!f.ed.isEmpty()) this.valueOf(this.sel); } catch (e) { C.showError(e); return false; } f.editing = false; }
      return true;
    }
    key(k) {
      const n = this.count();
      const f = this.fields[this.sel];
      if (k === 'up' || k === 'down') { if (!this.commit()) return true; this.sel = (this.sel + (k === 'up' ? -1 : 1) + n) % n; return true; }
      if (k === 'exe' || k === 'ok') {
        if (!this.commit()) return true;
        if (this.btn && this.sel < this.fields.length && k === 'exe') { this.sel++; return true; }
        if (!this.btn && this.sel < this.fields.length - 1 && k === 'exe') { this.sel++; return true; }
        if (this.btn && this.sel < this.fields.length && k === 'ok') { this.fields[this.sel].editing = true; return true; }
        try { const vals = this.values(); this.onSubmit(vals, this); } catch (e) { C.showError(e); }
        return true;
      }
      if (k === 'back') { if (f && f.editing) { f.editing = false; return true; } C.pop(this); if (this.onBack) this.onBack(); return true; }
      if (!f) return true;
      if (k === 'ac') { f.ed.clear(); f.editing = true; return true; }
      if (k === 'variable') { C.openVariables({ onRecall: (t) => { f.editing = true; f.ed.insert(t); }, getValue: () => { try { return this.valueOf(this.sel); } catch (e) { return undefined; } } }); return true; }
      if (k === 'catalog') { f.editing = true; C.openCatalog([C.CATALOG.prob, C.CATALOG.numeric, C.CATALOG.angle, C.CATALOG.hyp, C.CATALOG.const, C.CATALOG.other], f.ed); return true; }
      if (k === 'left' || k === 'right') { if (!f.editing) { f.editing = true; if (k === 'right') f.ed.toStart(); else f.ed.toEnd(); return true; } C.inputKey(f.ed, k, {}); return true; }
      if (!f.editing) {
        if (k === 'del') { f.ed.clear(); return true; }
        if (/^[0-9]$/.test(k) || ['.', 'neg', 'sub', 'exp', 'S-exp', 'ans', 'lp', 'sqrt', 'frac', 'sin', 'cos', 'tan', 'ln', 'logb', 'x', 'S-ans', 'S-0'].includes(k)) { f.ed.clear(); f.editing = true; }
        else return true;
      }
      C.inputKey(f.ed, k, { allowI: f.allowCx, mode: f.allowCx ? 'cplx' : 'calc' });
      return true;
    }
  }
  C.Form = Form;

  // 値 -> トークン列（フォームの初期値用）
  C.valueToTokens = function (v) {
    if (v === undefined || v === null) return [];
    let t;
    if (E.isRat(v)) { const [n, d] = E.ratOf(v); t = d === 1n ? n.toString() : null; if (t === null) { const s = E.toNum(v); return numToks(s); } return numToks2(t); }
    return numToks(E.toNum(v));
  };
  function numToks2(s) { const out = []; for (const ch of s) out.push(ch === '-' ? 'neg' : ch); return out; }
  function numToks(x) {
    let s = Number(x.toPrecision(15)).toString().replace('e+', 'E').replace('e', 'E');
    const out = []; for (const ch of s) out.push(ch === '-' ? 'neg' : ch); return out;
  }
})(window.C = window.C || {});
