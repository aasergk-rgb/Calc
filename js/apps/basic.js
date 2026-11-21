/* 共通の表エディター・行列エディター / 基本計算・複素数・n進計算・行列・ベクトル */
(function (C) {
  'use strict';
  const G = C.G, E = C.E, V = C.V, esc = C.esc, CAT = C.CATALOG;

  // ===== 表（統計エディター形式） =====
  // cols(): [{label, w}], rows(), get(r,c), set(r,c,v), canEdit(r,c), onDel(r), side(), bottom()
  class TableGrid {
    constructor(o) { Object.assign(this, { r: 0, c: 0, top: 0, visRows: 4, growable: false, maxRows: 999, rnW: 13 }, o); this.ed = null; }
    nRows() { return C.val(this.rows); }
    render() {
      const cols = C.val(this.cols), R = this.nRows();
      const total = Math.min(this.maxRows, R + (this.growable ? 1 : 0));
      if (this.r < this.top) this.top = this.r; if (this.r >= this.top + this.visRows) this.top = this.r - this.visRows + 1;
      let h = '<div class="tb">';
      // 行番号
      const lastRow = Math.min(Math.max(total, this.top + this.visRows), this.top + this.visRows);
      if (this.rnW) h += '<div class="col" style="left:0;width:' + this.rnW + 'px"></div>';
      for (let r = this.top; r < this.top + this.visRows && this.rnW; r++) {
        if (r >= Math.max(total, 1) && !this.padRows) break;
        h += '<div class="rn" style="left:0;width:' + (this.rnW - 2) + 'px;top:' + (11 + (r - this.top) * 10) + 'px">' + (r + 1) + '</div>';
      }
      let x = this.rnW + 1;
      cols.forEach((col, c) => {
        h += '<div class="col" style="left:' + x + 'px;width:' + col.w + 'px"></div><div class="hd" style="left:' + x + 'px;width:' + col.w + 'px">' + (col.html || esc(col.label)) + '</div>';
        for (let r = this.top; r < this.top + this.visRows; r++) {
          if (r >= total) break;
          const sel = r === this.r && c === this.c;
          const t = this.cellText ? this.cellText(r, c) : this.defText(r, c);
          h += '<div class="cell' + (sel ? ' sel' : '') + '" style="left:' + x + 'px;width:' + (col.w - 1) + 'px;top:' + (11 + (r - this.top) * 10) + 'px">' + esc(t) + '</div>';
        }
        x += col.w + 1;
      });
      if (this.side) h += '<div class="side fj" style="left:' + (x + 3) + 'px">' + this.side() + '</div>';
      if (this.ed) h += '<div class="edit" style="background:var(--lcd-bg)">' + this.ed.render(true) + '</div>';
      else { const b = this.bottom ? this.bottom() : this.defBottom(); if (b) h += b; }
      return h + '</div>';
    }
    defText(r, c) { const v = this.get(r, c); return v === undefined || v === null ? '' : typeof v === 'string' ? v : C.shortText(v, G.s, 6); }
    defBottom() { const v = this.get(this.r, this.c); if (v === undefined || v === null || typeof v === 'string') return ''; return '<div class="val">' + C.fmtValue(v, Object.assign({}, G.s, { io: G.s.io === 'mm' ? 'md' : G.s.io === 'll' ? 'ld' : G.s.io }), {}).html + '</div>'; }
    startEdit(k) { this.ed = new C.Editor('line'); if (k) C.inputKey(this.ed, k, {}); }
    commit() {
      const ed = this.ed; if (!ed) return true;
      if (ed.isEmpty()) { this.ed = null; return true; }
      let v;
      try { v = C.evaluate(C.parse(ed.root), C.mkCtx('calc')); if (!V.isReal(v)) throw new C.CalcError('Argument'); }
      catch (e) { C.showError(e, (kk) => { if (kk === 'ac') this.ed = null; C.render(); }); return false; }
      this.set(this.r, this.c, v); this.ed = null; return true;
    }
    move(dr, dc) {
      const cols = C.val(this.cols).length, total = Math.min(this.maxRows, this.nRows() + (this.growable ? 1 : 0));
      this.r = Math.max(0, Math.min(Math.max(total, 1) - 1, this.r + dr));
      this.c = Math.max(0, Math.min(cols - 1, this.c + dc));
    }
    key(k) {
      if (this.ed) {
        if (k === 'exe' || k === 'ok' || k === 'down') { if (this.commit()) this.move(1, 0); return true; }
        if (k === 'up') { if (this.commit()) this.move(-1, 0); return true; }
        if (k === 'ac') { this.ed.clear(); return true; }
        if (k === 'back') { this.ed = null; return true; }
        if (k === 'catalog') { C.openCatalog([CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.const, CAT.other], this.ed); return true; }
        if (k === 'variable') { C.openVariables({ onRecall: (t) => this.ed.insert(t) }); return true; }
        C.inputKey(this.ed, k, {}); return true;
      }
      if (k === 'up') { this.move(-1, 0); return true; }
      if (k === 'down') { this.move(1, 0); return true; }
      if (k === 'left') { this.move(0, -1); return true; }
      if (k === 'right') { this.move(0, 1); return true; }
      if (k === 'pgup') { this.move(-4, 0); return true; }
      if (k === 'pgdn') { this.move(4, 0); return true; }
      if (k === 'del' && this.onDel) { this.onDel(this.r, this.c); return true; }
      if (k === 'variable') { const v = this.get(this.r, this.c); C.openVariables({ getValue: () => (V.isReal(v) ? v : undefined) }); return true; }
      if (C.INPUT_KEYS.test(k)) { if (this.canEdit && !this.canEdit(this.r, this.c)) return true; this.startEdit(k); return true; }
      return false;
    }
  }
  C.TableGrid = TableGrid;

  // ===== 行列・ベクトルエディター =====
  function matEditor(name, store, opts) {
    opts = opts || {};
    const isVec = name.startsWith('Vct');
    const get = () => store[name];
    let r = 0, c = 0, ed = null;
    const R = () => (isVec ? get().a.length : get().r), Cn = () => (isVec ? 1 : get().c);
    const cell = (i, j) => (isVec ? get().a[i] : get().a[i][j]);
    const readOnly = name.endsWith('Ans');
    const ov = {
      passStatus: false,
      render() {
        const rows = R(), cols = Cn();
        const cw = cols <= 2 ? 42 : cols === 3 ? 34 : 27;
        const top = Math.max(0, Math.min(r - 3, rows - 4));
        let h = '<div class="me"><div class="nm">' + esc(name) + '=</div>';
        const vis = Math.min(4, rows);
        const left = 8, bh = vis * 10 + 1;
        h += '<div class="brk l" style="left:' + left + 'px;height:' + bh + 'px"></div><div class="brk r" style="left:' + (left + 4 + cols * cw) + 'px;height:' + bh + 'px"></div>';
        for (let i = top; i < top + vis; i++) for (let j = 0; j < cols; j++) {
          const sel = i === r && j === c;
          h += '<div class="cell' + (sel ? ' sel' : '') + '" style="left:' + (left + 3 + j * cw) + 'px;width:' + (cw - 2) + 'px;top:' + (12 + (i - top) * 10) + 'px">' + esc(C.shortText(cell(i, j), G.s, 7)) + '</div>';
        }
        if (ed) h += '<div class="tb"><div class="edit" style="background:var(--lcd-bg)">' + ed.render(true) + '</div></div>';
        else h += '<div class="tb"><div class="val">' + C.fmtValue(cell(r, c), Object.assign({}, G.s, { io: G.s.io === 'mm' ? 'md' : G.s.io }), {}).html + '</div></div>';
        return h + '</div>';
      },
      key(k) {
        if (ed) {
          if (k === 'exe' || k === 'ok') {
            if (!ed.isEmpty()) {
              try { const v = C.evaluate(C.parse(ed.root), C.mkCtx('calc')); if (!V.isReal(v)) throw new C.CalcError('Argument'); if (isVec) get().a[r] = v; else get().a[r][c] = v; C.save(); }
              catch (e) { C.showError(e); return true; }
            }
            ed = null;
            if (c < Cn() - 1) c++; else if (r < R() - 1) { c = 0; r++; }
            return true;
          }
          if (k === 'ac') { ed.clear(); return true; }
          if (k === 'back') { ed = null; return true; }
          C.inputKey(ed, k, {}); return true;
        }
        if (k === 'up') { r = Math.max(0, r - 1); return true; }
        if (k === 'down') { r = Math.min(R() - 1, r + 1); return true; }
        if (k === 'left') { c = Math.max(0, c - 1); return true; }
        if (k === 'right') { c = Math.min(Cn() - 1, c + 1); return true; }
        if (['back', 'ac', 'exe'].includes(k)) { C.pop(ov); if (opts.onClose) opts.onClose(k); return true; }
        if (k === 'tools' && readOnly) {
          const names = isVec ? ['VctA', 'VctB', 'VctC', 'VctD'] : ['MatA', 'MatB', 'MatC', 'MatD'];
          C.menu([{ label: '変数に保存', sub: () => names.map((n) => ({ label: n, big: true, action: () => { store[n] = C.clone(get()); C.save(); C.pop(); C.pop(); } })) }]);
          return true;
        }
        if (k === 'variable') { const v = cell(r, c); C.openVariables({ getValue: () => v }); return true; }
        if (readOnly) { if (opts.onOperator && C.INPUT_KEYS.test(k)) { C.pop(ov); opts.onOperator(k); } return true; }
        if (C.INPUT_KEYS.test(k)) { ed = new C.Editor('line'); C.inputKey(ed, k, {}); return true; }
        return true;
      },
    };
    C.push(ov);
    return ov;
  }
  C.matEditor = matEditor;

  // ===== 計算系アプリの共通部 =====
  function calcApp(o) {
    return Object.assign({
      init() { this.cs = new C.CalcScreen(Object.assign({ mode: o.mode, app: this }, o.screen || {})); },
      enter() { if (!this.cs) this.init(); },
      render() { return this.cs.render(); },
      key(k) {
        if (k === 'tools') return false;
        if (o.keyHook && o.keyHook.call(this, k)) return true;
        return this.cs.key(k);
      },
      status() { return this.cs.status(); },
      editor() { return this.cs.ed; },
      onIO() { this.cs.resetMode(); },
      reset() { this.cs = null; this.init(); },
      tools() { return (o.preTools ? o.preTools.call(this) : []).concat([{ label: '元に戻す', action: () => { C.popAll(); this.cs.ed.undo(); this.cs.state = 'edit'; } }]).concat(this.verifiable ? [verifyToggle(this)] : []).concat(o.extraTools ? o.extraTools.call(this) : []); },
    }, o);
  }
  function verifyToggle(app) {
    return { label: () => (G.verify ? '真偽判別を無効化' : '真偽判別を有効化'), action: () => { G.verify = !G.verify; app.cs.hist = []; app.cs.hi = -1; app.cs.ed.clear(); app.cs.state = 'edit'; C.popAll(); } };
  }
  C.verifyToggle = verifyToggle;

  // ===== 基本計算 =====
  const calc = calcApp({
    id: 'calc', name: '基本計算', mode: 'calc', verifiable: true,
    screen: { verify: true },
    preTools() { return [{ label: 'CALC', big: true, action: () => { C.popAll(); this.cs.startCALC(); } }]; },
    init() { this.cs = new C.CalcScreen({ mode: 'calc', app: this, verify: true, catalog: () => (G.verify ? [CAT.verify] : []).concat(C.calcCatalog()) }); },
  });

  // ===== 複素数 =====
  const cplx = calcApp({
    id: 'cplx', name: '複素数', mode: 'cplx', verifiable: true,
    init() { this.cs = new C.CalcScreen({ mode: 'cplx', app: this, verify: true, catalog: () => (G.verify ? [CAT.verify] : []).concat([CAT.cplx, CAT.func, CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.eng, CAT.const, CAT.unit, CAT.pt, CAT.other]) }); },
  });

  // ===== n進計算 =====
  const BASEJ = { dec: '10進数', hex: '16進数', bin: '2進数', oct: '8進数' };
  const base = calcApp({
    id: 'base', name: 'n進計算', mode: 'base',
    init() {
      this.cs = new C.CalcScreen({ mode: 'base', app: this, catalog: () => [CAT.baseSel, CAT.logic, CAT.hexdig], header: () => '[' + BASEJ[G.appState.base || 'dec'] + ']', extraCtx: () => ({ base: G.appState.base || 'dec' }) });
      this.cs.emptyLabel = () => (this.cs.hist.length ? '' : '<span class="fb">[FORMAT]</span>を押して<br>基数を変更します');
    },
    enter() { if (!this.cs) this.init(); },
  });
  base.tools = function () { return [{ label: '元に戻す', action: () => { C.popAll(); this.cs.ed.undo(); this.cs.state = 'edit'; } }]; };

  // ===== 行列 =====
  const MATS = ['MatA', 'MatB', 'MatC', 'MatD'];
  function zeros(r, c) { return V.mkM(Array.from({ length: r }, () => Array.from({ length: c }, () => E.Q(0)))); }
  function defineMatForm(name, isVec, after) {
    const f = new C.Form(isVec ? {
      title: '次元を指定して下さい', btn: '確定する', vx: 84,
      fields: [{ label: '次元', value: 2, choices: [[2, '2'], [3, '3']], bigChoices: true, display: (v) => '<span class="tk">' + v + '</span>' }],
      onSubmit: ([d]) => { G.vecs[name] = V.mkV(Array.from({ length: d }, () => E.Q(0))); C.save(); C.popAll(); C.matEditor(name, G.vecs); if (after) after(); },
    } : {
      title: '行数と列数を指定して下さい', btn: '確定する', vx: 84,
      fields: [{ label: '行数', value: 2, choices: [1, 2, 3, 4].map((n) => [n, n + '行']), display: (v) => '<span class="tk">' + v + '</span>' }, { label: '列数', value: 2, choices: [1, 2, 3, 4].map((n) => [n, n + '列']), display: (v) => '<span class="tk">' + v + '</span>' }],
      onSubmit: ([rr, cc]) => { G.mats[name] = zeros(rr, cc); C.save(); C.popAll(); C.matEditor(name, G.mats); if (after) after(); },
    });
    f.titleHtml = false;
    C.push(f);
  }
  function memList(isVec) {
    const names = isVec ? ['VctA', 'VctB', 'VctC', 'VctD'] : MATS;
    const store = isVec ? G.vecs : G.mats;
    const desc = (n) => (store[n] ? (isVec ? store[n].a.length + '次元' : store[n].r + '×' + store[n].c) : '未定義');
    C.menu(names.map((n) => ({
      label: () => '<span class="big">' + n + ':</span>' + desc(n), html: true,
      action: () => {
        if (!store[n]) { defineMatForm(n, isVec); return; }
        C.menu([{ label: '編集', action: () => { C.popAll(); C.matEditor(n, store); } }, { label: '新規定義', action: () => defineMatForm(n, isVec) }]);
      },
    })));
  }
  function matVecApp(id, name, isVec) {
    const app = calcApp({
      id, name, mode: isVec ? 'vec' : 'mat',
      init() {
        this.cs = new C.CalcScreen({ mode: isVec ? 'vec' : 'mat', app: this, history: false, catalog: () => [isVec ? CAT.vec : CAT.mat, CAT.func, CAT.prob, CAT.numeric, CAT.angle, CAT.other] });
        const store = isVec ? G.vecs : G.mats;
        this.cs.emptyLabel = () => ((isVec ? ['VctA', 'VctB', 'VctC', 'VctD'] : MATS).some((n) => store[n]) ? '' : '<span class="fb">[TOOLS]</span>を押して<br>' + (isVec ? 'ベクトル' : '行列') + 'を定義して下さい');
        this.cs.onResult = (v) => {
          if (V.isMat(v) || V.isVec(v)) {
            const nm = isVec ? 'VctAns' : 'MatAns';
            const cs = this.cs;
            C.matEditor(nm, isVec ? G.vecs : G.mats, {
              onClose: (k) => { cs.state = 'edit'; if (k === 'ac') cs.ed.clear(); },
              onOperator: (k) => { cs.state = 'edit'; cs.ed.setTokens([nm]); C.inputKey(cs.ed, k, {}); },
            });
          }
        };
      },
      preTools() { return [{ label: isVec ? 'ベクトルの定義画面' : '行列の定義画面', action: () => { C.popAll(); memList(isVec); } }]; },
    });
    app.tools = function () { return [{ label: isVec ? 'ベクトルの定義画面' : '行列の定義画面', action: () => { C.popAll(); memList(isVec); } }, { label: '元に戻す', action: () => { C.popAll(); this.cs.ed.undo(); } }]; };
    return app;
  }
  const matrix = matVecApp('mat', '行列', false);
  const vector = matVecApp('vec', 'ベクトル', true);

  C.APPS.push(calc);
  Object.assign(C.lateApps, { cplx, base, matrix, vector });
})(window.C = window.C || {});
