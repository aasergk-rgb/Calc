/* 基本計算・複素数・n進・行列・ベクトル・比例 / 汎用セルエディタ */
(function (C) {
  'use strict';
  const G = C.G, E = C.E, V = C.V, esc = C.esc, CAT = C.CATALOG;

  // ===== 汎用セルグリッド =====
  class CellGrid {
    constructor(o) {
      Object.assign(this, { r: 0, c: 0, top: 0, left: 0, visRows: 5, visCols: 4, advance: 'right' }, o);
      this.ed = null;
    }
    nRows() { return typeof this.rows === 'function' ? this.rows() : this.rows; }
    nCols() { return typeof this.cols === 'function' ? this.cols() : this.cols; }
    render() {
      const R = this.nRows(), Cc = this.nCols();
      if (this.r < this.top) this.top = this.r; if (this.r >= this.top + this.visRows) this.top = this.r - this.visRows + 1;
      if (this.c < this.left) this.left = this.c; if (this.c >= this.left + this.visCols) this.left = this.c - this.visCols + 1;
      let h = (this.title ? '<div class="lbl-sm" style="display:flex;justify-content:space-between"><span>' + esc(this.title) + '</span><span>' + (this.titleRight ? this.titleRight() : '') + '</span></div>' : '');
      h += '<table class="grid"><tr><th class="rh"></th>';
      for (let c = this.left; c < Math.min(Cc, this.left + this.visCols); c++) h += '<th>' + esc(this.colLabel(c)) + '</th>';
      h += '</tr>';
      for (let r = this.top; r < this.top + this.visRows; r++) {
        if (r >= R + (this.growable ? 1 : 0)) { if (!this.padRows) break; h += '<tr><th class="rh"></th>' + '<td></td>'.repeat(Math.min(Cc, this.visCols)) + '</tr>'; continue; }
        h += '<tr><th class="rh">' + esc(this.rowLabel ? this.rowLabel(r) : String(r + 1)) + '</th>';
        for (let c = this.left; c < Math.min(Cc, this.left + this.visCols); c++) {
          const sel = r === this.r && c === this.c;
          const mark = this.isMarked && this.isMarked(r, c);
          h += '<td class="' + (sel ? 'sel' : '') + (mark ? ' mark' : '') + '">' + esc(this.cellText(r, c)) + '</td>';
        }
        h += '</tr>';
      }
      h += '</table>';
      const box = this.ed ? this.ed.render(true) : this.boxHtml ? this.boxHtml(this.r, this.c) : this.cellFull(this.r, this.c);
      h += '<div class="editbox' + (this.ed ? ' editing' : '') + '">' + box + '</div>';
      return h;
    }
    cellFull(r, c) { const v = this.get(r, c); return v === undefined ? '' : C.fmtValue(v, G.s, {}).html; }
    cellText(r, c) { const v = this.get(r, c); return v === undefined ? '' : C.shortText(v, G.s, 8); }
    startEdit(k) { this.ed = new C.Editor('line'); if (k) C.inputKey(this.ed, k, { allowI: this.allowCx, mode: this.allowCx ? 'cplx' : 'calc' }); }
    commit() {
      const ed = this.ed; if (!ed) return true;
      if (ed.isEmpty()) { this.ed = null; return true; }
      let v;
      try { v = C.evaluate(C.parse(ed.root), C.mkCtx(this.allowCx ? 'cplx' : 'calc')); if (!V.isReal(v) && !(this.allowCx && V.isCx(v))) throw new C.CalcError('Argument'); }
      catch (e) { C.showError(e, (kk) => { if (kk === 'ac') this.ed = null; C.render(); }); return false; }
      this.set(this.r, this.c, v); this.ed = null; return true;
    }
    move(dr, dc) {
      const R = this.nRows() + (this.growable ? 1 : 0), Cc = this.nCols();
      this.r = Math.max(0, Math.min(Math.min(R, this.maxRows || 1e9) - 1, this.r + dr));
      this.c = Math.max(0, Math.min(Cc - 1, this.c + dc));
    }
    advanceNext() {
      if (this.advance === 'down') this.move(1, 0);
      else { if (this.c < this.nCols() - 1) this.c++; else if (this.r < this.nRows() - 1) { this.c = 0; this.r++; } }
    }
    key(k) {
      if (this.ed) {
        if (k === 'exe' || k === 'ok') { if (this.commit()) this.advanceNext(); return true; }
        if (k === 'ac') { this.ed.clear(); return true; }
        if (k === 'back') { this.ed = null; return true; }
        if ((k === 'up' || k === 'down') && this.commit()) { this.move(k === 'up' ? -1 : 1, 0); return true; }
        if (k === 'variable') { C.openVariables({ onRecall: (t) => this.ed.insert(t), getValue: () => undefined }); return true; }
        if (k === 'catalog') { C.openCatalog([CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.const, CAT.other], this.ed); return true; }
        C.inputKey(this.ed, k, { allowI: this.allowCx, mode: this.allowCx ? 'cplx' : 'calc' }); return true;
      }
      if (k === 'up') { this.move(-1, 0); return true; }
      if (k === 'down') { this.move(1, 0); return true; }
      if (k === 'left') { this.move(0, -1); return true; }
      if (k === 'right') { this.move(0, 1); return true; }
      if (k === 'del' && this.onDel) { this.onDel(this.r, this.c); return true; }
      if (/^[0-9]$/.test(k) || ['.', 'neg', 'sub', 'exp', 'S-exp', 'ans', 'S-ans', 'lp', 'sqrt', 'frac', 'sin', 'cos', 'tan', 'ln', 'logb', 'S-sin', 'S-cos', 'S-tan', 'S-ln', 'S-logb', 'S-sqrt', 'S-dms', 'S-0', 'x', 'log', 'logb', 'S-exp', 'S-sub', 'S-pow'].includes(k) || k.startsWith('var:')) {
        if (this.canEdit && !this.canEdit(this.r, this.c)) return true;
        this.startEdit(k); return true;
      }
      return false;
    }
  }
  C.CellGrid = CellGrid;

  const commonCats = () => [CAT.func, CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.unit, CAT.const, CAT.pt, CAT.eng, CAT.other];

  function calcApp(o) {
    const app = Object.assign({
      init() { this.cs = new C.CalcScreen({ mode: o.mode, app: this, extraCtx: o.extraCtx }); },
      enter() { if (!this.cs) this.init(); },
      render() { return this.cs.render(); },
      key(k) { if (k === 'tools') return false; if (k === 'S⇔D') { sd(this.cs); return true; } if (o.keyHook && o.keyHook.call(this, k)) return true; return this.cs.key(k); },
      status() { return this.cs.status(); },
      editor() { return this.cs.ed; },
      onIO() { this.cs.resetMode(); },
      reset() { this.cs = null; this.init(); },
      tools() { return [{ label: '元に戻す', action: () => { C.popAll(); this.cs.ed.undo(); this.cs.state = 'edit'; } }, { label: '計算履歴の削除', action: () => { this.cs.hist = []; this.cs.hi = -1; C.popAll(); } }].concat(o.extraTools ? o.extraTools.call(this) : []); },
    }, o);
    return app;
  }
  function sd(cs) {
    if (cs.state !== 'result') { cs.evaluate(false); if (cs.state !== 'result') return; }
    const opts = C.formatOptions(cs.result, G.s).map((x) => x[0]);
    if (!opts.includes('dec')) return;
    cs.fmt = cs.fmt === 'dec' ? undefined : 'dec';
  }
  C.sdToggle = sd;

  // ===== 基本計算 =====
  const calc = calcApp({
    id: 'calc', name: '基本計算', short: '基本計算', icon: '<span style="font-size:15px">1+2</span>', mode: 'calc',
    catalog: commonCats,
    extraTools() {
      return [{ label: '真偽判別', right: () => (G.s.verify ? 'する' : 'しない'), sub: () => [[true, 'する'], [false, 'しない']].map(([v, l]) => ({ label: l, checked: () => G.s.verify === v, action: () => { G.s.verify = v; C.save(); C.popAll(); } })) }];
    },
    keyHook(k) {
      if (k === 'exe' || k === 'S-exe') {
        this.cs.key(k);
        const r = this.cs.result;
        if (this.cs.state === 'result' && r && r.k === 'bool' && !G.s.verify) { this.cs.state = 'edit'; C.showError(new C.CalcError('Syntax')); }
        return true;
      }
      return false;
    },
  });

  // ===== 複素数 =====
  const cplx = calcApp({
    id: 'cplx', name: '複素数計算', short: '複素数', icon: '<i>a</i>+<i>bi</i>', mode: 'cplx',
    catalog: () => [CAT.cplx].concat(commonCats().filter((c) => c !== CAT.unit && c !== CAT.pt)),
  });

  // ===== n進 =====
  const BASES = [['dec', '10進数', 'Dec'], ['hex', '16進数', 'Hex'], ['bin', '2進数', 'Bin'], ['oct', '8進数', 'Oct']];
  const base = calcApp({
    id: 'base', name: 'n進計算', short: 'n進', icon: '<span style="font-size:12px">0x1F</span>', mode: 'base',
    extraCtx: () => ({ base: G.appState.base || 'dec' }),
    catalog: () => [CAT.baseSel, CAT.logic],
    status() { const b = BASES.find((x) => x[0] === (G.appState.base || 'dec')); return this.cs.status() + ' ' + b[2]; },
    extraTools() { return BASES.map(([k, l]) => ({ label: l, checked: () => (G.appState.base || 'dec') === k, action: () => { setBase(k); C.popAll(); } })); },
    keyHook(k) {
      // SHIFT+ sin/cos/tan/ln で基数切替（DEC/HEX/BIN/OCT）
      const map = { 'S-sin': 'dec', 'S-cos': 'hex', 'S-tan': 'bin', ln: 'oct' };
      if (map[k]) { setBase(map[k]); return true; }
      return false;
    },
  });
  function setBase(k) { G.appState.base = k; if (base.cs) { base.cs.baseShow = k; } C.save(); }

  // ===== 行列 =====
  const MATS = ['MatA', 'MatB', 'MatC', 'MatD'];
  function dimStr(m) { return m ? (m.r + '×' + m.c) : '未定義'; }
  function zeros(r, c) { return V.mkM(Array.from({ length: r }, () => Array.from({ length: c }, () => E.Q(0)))); }
  function openMatEditor(name, store, isVec) {
    const get = () => store[name];
    const grid = new CellGrid({
      title: name, rows: () => (isVec ? 1 : get().r), cols: () => (isVec ? get().a.length : get().c), visRows: 4, visCols: 4,
      colLabel: (c) => String(c + 1), rowLabel: (r) => String(r + 1),
      get: (r, c) => (isVec ? get().a[c] : get().a[r][c]),
      set: (r, c, v) => { if (isVec) get().a[c] = v; else get().a[r][c] = v; C.save(); },
      canEdit: () => name !== 'MatAns' && name !== 'VctAns',
    });
    const ov = {
      render: () => grid.render(),
      key(k) {
        if (!grid.ed && (k === 'back' || k === 'ac')) { C.pop(ov); return true; }
        if (!grid.ed && k === 'tools' && (name === 'MatAns' || name === 'VctAns')) {
          C.menu('コピー', (isVec ? ['VctA', 'VctB', 'VctC', 'VctD'] : MATS).map((m) => ({ label: m + 'へ保存', action: () => { store[m] = JSON.parse(JSON.stringify(get(), (kk, v) => (typeof v === 'bigint' ? { $b: v.toString() } : v)), (kk, v) => (v && v.$b !== undefined ? BigInt(v.$b) : v)); C.save(); C.popAll(); } })));
          return true;
        }
        grid.key(k); return true;
      },
    };
    C.push(ov);
  }
  function defineMat(name, after) {
    const pick = (title, cb) => C.menu(title, [1, 2, 3, 4].map((n) => ({ label: n + (title === '行数' ? '行' : '列'), action: () => cb(n) })));
    pick('行数', (r) => pick('列数', (c) => { G.mats[name] = zeros(r, c); C.save(); C.popAll(); openMatEditor(name, G.mats); if (after) after(); }));
  }
  function defineVec(name) {
    C.menu('次元', [2, 3].map((n) => ({ label: n + '次元', action: () => { G.vecs[name] = V.mkV(Array.from({ length: n }, () => E.Q(0))); C.save(); C.popAll(); openMatEditor(name, G.vecs, true); } })));
  }
  function matListMenu(ed, isVec) {
    const names = isVec ? ['VctA', 'VctB', 'VctC', 'VctD', 'VctAns'] : MATS.concat(['MatAns']);
    const store = isVec ? G.vecs : G.mats;
    C.menu(isVec ? 'ベクトル変数' : '行列変数', names.map((n) => ({
      label: n, right: () => (store[n] ? (isVec ? store[n].a.length + '次元' : dimStr(store[n])) : '未定義'),
      sub: () => [
        { label: '入力', action: () => { C.popAll(); ed(n); } },
        { label: '編集', disabled: false, action: () => { if (!store[n]) { if (n.endsWith('Ans')) return; isVec ? defineVec(n) : defineMat(n); return; } C.popAll(); openMatEditor(n, store, isVec); } },
      ].concat(n.endsWith('Ans') ? [] : [{ label: '新規定義', action: () => (isVec ? defineVec(n) : defineMat(n)) }]),
    })));
  }
  const matrix = calcApp({
    id: 'mat', name: '行列計算', short: '行列', icon: '<span style="font-size:13px">[▦]</span>', mode: 'mat',
    catalog: () => [CAT.mat, CAT.func, CAT.prob, CAT.numeric, CAT.other],
    extraTools() { return [{ label: '行列の定義', sub: () => MATS.map((n) => ({ label: n, right: dimStr(G.mats[n]), action: () => defineMat(n) })) }, { label: '行列の編集', sub: () => MATS.concat(['MatAns']).filter((n) => G.mats[n]).map((n) => ({ label: n, right: dimStr(G.mats[n]), action: () => { C.popAll(); openMatEditor(n, G.mats); } })) }]; },
    keyHook(k) {
      if (k === 'variable') { matListMenu((n) => { this.cs.prepInput('x'); this.cs.ed.insert(n); }, false); return true; }
      if (k === 'ok' && this.cs.state === 'result' && V.isMat(this.cs.result)) { openMatEditor('MatAns', G.mats); return true; }
      return false;
    },
  });
  const vector = calcApp({
    id: 'vec', name: 'ベクトル計算', short: 'ベクトル', icon: '<span style="font-size:14px"><i>v</i>⃗→</span>', mode: 'vec',
    catalog: () => [CAT.vec, CAT.func, CAT.prob, CAT.numeric, CAT.other],
    extraTools() { return [{ label: 'ベクトルの定義', sub: () => ['VctA', 'VctB', 'VctC', 'VctD'].map((n) => ({ label: n, right: G.vecs[n] ? G.vecs[n].a.length + '次元' : '未定義', action: () => defineVec(n) })) }]; },
    keyHook(k) {
      if (k === 'variable') { matListMenu((n) => { this.cs.prepInput('x'); this.cs.ed.insert(n); }, true); return true; }
      return false;
    },
  });

  // ===== 比例 =====
  const ratio = {
    id: 'ratio', name: '比例計算', short: '比例', icon: '<i>a</i>:<i>b</i>',
    init() { this.type = G.appState.ratioType || 0; this.vals = [E.Q(1), E.Q(1), E.Q(1)]; this.form = null; this.res = null; },
    enter() { if (this.vals === undefined) this.init(); this.menu(); },
    menu() {
      C.menu('比例計算', [{ label: 'a:b=X:d', action: () => { this.type = 0; this.open(); } }, { label: 'a:b=c:X', action: () => { this.type = 1; this.open(); } }], { noAC: true });
    },
    open() {
      G.appState.ratioType = this.type; C.popAll(); this.res = null;
      const names = this.type === 0 ? ['a', 'b', 'd'] : ['a', 'b', 'c'];
      this.form = new C.Form({ title: this.type === 0 ? 'a : b = X : d' : 'a : b = c : X', fields: names.map((n, i) => ({ label: n, value: this.vals[i] })), onSubmit: (v) => this.solve(v) });
    },
    solve(v) {
      this.vals = v;
      const [a, b, cd] = v;
      try {
        let X;
        if (this.type === 0) { if (E.isZero(b)) throw new C.CalcError('Math'); X = V.div(V.mul(a, cd), b); }
        else { if (E.isZero(a)) throw new C.CalcError('Math'); X = V.div(V.mul(b, cd), a); }
        G.ans = X; this.res = X; C.save();
      } catch (e) { C.showError(e); }
    },
    render() {
      if (!this.form) return '';
      if (this.res !== null && this.res !== undefined) return '<div class="calc"><div class="input lbl-sm">' + esc(this.form.title) + '</div><div class="output"><span class="tk">X=</span>' + C.fmtValue(this.res, G.s, {}).html + '</div></div>';
      return this.form.render();
    },
    key(k) {
      if (!this.form) return false;
      if (this.res !== null && this.res !== undefined) {
        if (['exe', 'ok', 'back', 'ac', 'left', 'right', 'up', 'down'].includes(k)) { this.res = null; return true; }
        if (k === 'variable') { C.openVariables({ onRecall: () => {}, getValue: () => this.res }); return true; }
        return true;
      }
      if (k === 'tools') return false;
      if (k === 'back') return true;
      this.form.key(k); return true;
    },
    tools() { return [{ label: '比例式の種類', action: () => this.menu() }]; },
    reset() { this.init(); },
  };

  C.APPS.push(calc);
  Object.assign(C.lateApps, { cplx, base, matrix, vector, ratio });
})(window.C = window.C || {});
