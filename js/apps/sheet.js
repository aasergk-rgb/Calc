/* 表計算（45行×5列） */
(function (C) {
  'use strict';
  const G = C.G, E = C.E, V = C.V, esc = C.esc, CAT = C.CATALOG, Q = E.Q;
  const ROWS = 45, COLS = 5, CAP = 1700;
  const COLTOK = ['A', 'B', 'C', 'D', 'E_'];
  const colName = (c) => 'ABCDE'[c];

  // トークン列内のセル参照を走査してシフト
  function shiftRefs(toks, dr, dc) {
    const out = []; let bad = false;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      let j = i, absC = false;
      if (t === '$') { absC = true; j++; }
      const ct = toks[j];
      if (typeof ct === 'string' && COLTOK.includes(ct) && (toks[j + 1] === '$' || /^[0-9]$/.test(toks[j + 1]))) {
        let k = j + 1, absR = false;
        if (toks[k] === '$') { absR = true; k++; }
        let ds = ''; while (/^[0-9]$/.test(toks[k])) ds += toks[k++];
        if (ds) {
          let c = COLTOK.indexOf(ct), r = parseInt(ds, 10) - 1;
          if (!absC) c += dc; if (!absR) r += dr;
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { out.push('?'); bad = true; }
          else { if (absC) out.push('$'); out.push(COLTOK[c]); if (absR) out.push('$'); for (const ch of String(r + 1)) out.push(ch); }
          i = k - 1; continue;
        }
      }
      out.push(t);
    }
    return { toks: out, bad };
  }
  function parseRange(toks) {
    const s = toks.map((t) => (t === 'E_' ? 'E' : t)).join('');
    const m = /^([A-E])([0-9]+):([A-E])([0-9]+)$/.exec(s);
    if (!m) throw new C.CalcError('Range');
    const c1 = m[1].charCodeAt(0) - 65, r1 = +m[2] - 1, c2 = m[3].charCodeAt(0) - 65, r2 = +m[4] - 1;
    if ([r1, r2].some((r) => r < 0 || r >= ROWS)) throw new C.CalcError('Range');
    return { c1: Math.min(c1, c2), c2: Math.max(c1, c2), r1: Math.min(r1, r2), r2: Math.max(r1, r2) };
  }

  const sheet = {
    id: 'sheet', name: '表計算',
    init() {
      const st = G.appState.sheet;
      this.cells = st ? st.cells : Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      this.auto = st ? st.auto : true; this.showVal = st ? st.showVal : false;
      this.vals = Array.from({ length: ROWS }, () => Array(COLS).fill(undefined));
      this.r = 0; this.c = 0; this.top = 0; this.left = 0; this.ed = null; this.clip = null; this.grab = null;
      this.recalc();
    },
    persist() { G.appState.sheet = { cells: this.cells, auto: this.auto, showVal: this.showVal }; C.save(); },
    enter() { if (!this.cells) this.init(); },
    reset() { delete G.appState.sheet; this.init(); },
    bytes() { let b = 0; for (const row of this.cells) for (const c of row) if (c) b += c.kind === 'f' ? c.src.length + 11 : 10; return b; },
    // ---- 評価 ----
    ctxFor(visiting) {
      const self = this;
      return C.mkCtx('calc', {
        sheet: {
          cell(n) { return self.cellVal(n.r, n.c, visiting); },
          range(a, b) { const out = []; for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) { if (self.cells[r] && self.cells[r][c]) out.push(self.cellVal(r, c, visiting)); } return out; },
        },
      });
    },
    cellVal(r, c, visiting) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) throw new C.CalcError('Range');
      const cell = this.cells[r][c];
      if (!cell) return Q(0);
      if (cell.kind === 'v') return cell.v;
      const key = r * COLS + c;
      if (visiting.has(key)) throw new C.CalcError('Circular');
      if (visiting.size > 60) throw new C.CalcError('Memory');
      visiting.add(key);
      try {
        if (cell.src.includes('?')) throw new C.CalcError('Syntax');
        const v = C.evaluate(C.parse(cell.src, { sheet: true }), this.ctxFor(visiting));
        if (!V.isReal(v)) throw new C.CalcError('Argument');
        return v;
      } finally { visiting.delete(key); }
    },
    recalc() {
      let err = null;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (!cell) { this.vals[r][c] = undefined; continue; }
        if (cell.kind === 'v') { this.vals[r][c] = cell.v; continue; }
        try { this.vals[r][c] = this.cellVal(r, c, new Set()); } catch (e) { this.vals[r][c] = 'ERROR'; if (e.code === 'Circular' && !err) err = e; }
      }
      return err;
    },
    afterChange() { if (this.auto) { const e = this.recalc(); if (e) C.showError(e); } this.persist(); },
    // ---- 入力確定 ----
    commitTo(r, c, toks) {
      if (!toks.length) { this.ed = null; return true; }
      let cell;
      if (toks[0] === '=') {
        const src = toks.slice(1);
        try { C.parse(src, { sheet: true }); } catch (e) { C.showError(e); return false; }
        cell = { kind: 'f', src };
      } else {
        let v;
        try { v = C.evaluate(C.parse(toks, { sheet: true }), this.ctxFor(new Set())); if (!V.isReal(v)) throw new C.CalcError('Argument'); }
        catch (e) { C.showError(e); return false; }
        if (E.isE(v) && !E.isRat(v)) v = E.toNum(v);
        if (typeof v === 'number') v = Number(v.toPrecision(10));
        cell = { kind: 'v', v };
      }
      const old = this.cells[r][c]; this.cells[r][c] = cell;
      if (this.bytes() > CAP) { this.cells[r][c] = old; C.showError(new C.CalcError('Memory')); return false; }
      this.afterChange(); return true;
    },
    cellTokens(r, c) {
      const cell = this.cells[r][c]; if (!cell) return [];
      if (cell.kind === 'f') return ['='].concat(cell.src);
      return C.valueToTokens(cell.v);
    },
    // ---- 描画（表計算画面） ----
    render() {
      const visR = 4, visC = 4, CW = 43, RW = 13;
      const cr = this.grab ? this.grab.r : this.r, cc = this.grab ? this.grab.c : this.c;
      if (cr < this.top) this.top = cr; if (cr >= this.top + visR) this.top = cr - visR + 1;
      if (cc < this.left) this.left = cc; if (cc >= this.left + visC) this.left = cc - visC + 1;
      let h = '<div class="tb ss">';
      for (let c = this.left; c < this.left + visC; c++) {
        const x = RW + 1 + (c - this.left) * (CW + 1);
        h += '<div class="hcell' + (c === cc ? ' on' : '') + '" style="left:' + x + 'px;width:' + CW + 'px">' + colName(c) + '</div>';
      }
      for (let r = this.top; r < this.top + visR; r++) {
        const y = 10 + (r - this.top) * 10;
        h += '<div class="rcell' + (r === cr ? ' on' : '') + '" style="top:' + y + 'px">' + (r + 1) + '</div>';
        for (let c = this.left; c < this.left + visC; c++) {
          const v = this.vals[r][c];
          const t = v === undefined ? '' : v === 'ERROR' ? 'ERROR' : C.shortText(v, G.s, 7);
          const x = RW + 1 + (c - this.left) * (CW + 1);
          const mark = this.clip && this.clip.r === r && this.clip.c === c;
          h += '<div class="scell' + (r === cr && c === cc ? ' sel' : '') + (mark ? ' mark' : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + (CW + 1) + 'px">' + esc(t) + '</div>';
        }
      }
      if (this.grab) h += '<div class="msg">決定:<span class="fb">[OK]</span></div>';
      else if (this.ed) h += '<div class="edit" style="background:var(--lcd-bg)">' + this.ed.render(true) + '</div>';
      else if (this.clip) h += '<div class="msg">貼り付け:<span class="fb">[OK]</span></div>';
      else {
        const cell = this.cells[this.r][this.c];
        if (cell) {
          let box;
          if (cell.kind === 'f' && !this.showVal) box = C.renderRow(['='].concat(cell.src), null, 'line', true);
          else { const v = this.vals[this.r][this.c]; box = v === 'ERROR' ? '<span class="tk">ERROR</span>' : C.fmtValue(v, Object.assign({}, G.s, { io: 'ld' }), {}).html; }
          h += '<div class="val">' + box + '</div>';
        }
      }
      return h + '</div>';
    },
    status() { return null; },
    editor() { return this.ed; },
    // ---- キー ----
    key(k) {
      if (this.grab) {
        const g = this.grab;
        if (k === 'up') g.r = Math.max(0, g.r - 1); else if (k === 'down') g.r = Math.min(ROWS - 1, g.r + 1);
        else if (k === 'left') g.c = Math.max(0, g.c - 1); else if (k === 'right') g.c = Math.min(COLS - 1, g.c + 1);
        else if (k === 'ok' || k === 'exe') { this.ed.insert(COLTOK[g.c]); for (const ch of String(g.r + 1)) this.ed.insert(ch); this.grab = null; }
        else if (k === 'back' || k === 'ac') this.grab = null;
        return true;
      }
      if (this.ed) {
        if (k === 'exe' || k === 'ok') { if (this.commitTo(this.r, this.c, this.ed.root)) { this.ed = null; this.r = Math.min(ROWS - 1, this.r + 1); } return true; }
        if (k === 'ac') { this.ed.clear(); return true; }
        if (k === 'back') { this.ed = null; return true; }
        if (k === 'variable') { C.openVariables({ onRecall: (t) => this.ed.insert(t), getValue: () => undefined }); return true; }
        if (k === 'catalog') { this.openCat(); return true; }
        if (k === 'tools') return false;
        if (k === 'up' || k === 'down') return true;
        C.inputKey(this.ed, k, {}); return true;
      }
      if (this.clip) {
        if (k === 'ok' || k === 'exe') { this.paste(); return true; }
        if (k === 'ac' || k === 'back') { this.clip = null; return true; }
      }
      if (k === 'up') { this.r = Math.max(0, this.r - 1); return true; }
      if (k === 'down') { this.r = Math.min(ROWS - 1, this.r + 1); return true; }
      if (k === 'left') { this.c = Math.max(0, this.c - 1); return true; }
      if (k === 'right') { this.c = Math.min(COLS - 1, this.c + 1); return true; }
      if (k === 'del') { this.cells[this.r][this.c] = null; this.afterChange(); return true; }
      if (k === 'ac') return true;
      if (k === 'variable') { this.ed = new C.Editor('line'); C.openVariables({ onRecall: (t) => this.ed.insert(t), getValue: () => { const v = this.vals[this.r][this.c]; return v === 'ERROR' ? undefined : v; } }); return true; }
      if (k === 'catalog') { this.ed = new C.Editor('line'); this.openCat(); return true; }
      if (k === 'tools' || k === 'home' || k === 'settings') return false;
      if (['back', 'ok', 'exe', 'format', 'S-format', 'fx', 'S-fx'].includes(k)) return true;
      // 入力開始
      this.ed = new C.Editor('line');
      if (!C.inputKey(this.ed, k, {})) this.ed = null;
      return true;
    },
    openCat() {
      const sheetCat = () => ['表計算', null, () => [{ label: '最小値', tok: 'Min(' }, { label: '最大値', tok: 'Max(' }, { label: '平均値', tok: 'Mean(' }, { label: '総和', tok: 'Sum(' }, { label: ':', tok: ':', big: true }, { label: '$', tok: '$', big: true }, { label: '参照するセルの選択', action: () => { this.grab = { r: this.r, c: this.c }; } }]];
      C.openCatalog([sheetCat, CAT.func, CAT.prob, CAT.numeric, CAT.angle, CAT.hyp, CAT.eng, CAT.const, CAT.unit, CAT.pt, CAT.other], this.ed);
    },
    paste() {
      const { r: sr, c: sc, cell, cut } = this.clip;
      let nc = null;
      if (cell) {
        if (cell.kind === 'f' && !cut) { const s = shiftRefs(cell.src, this.r - sr, this.c - sc); nc = { kind: 'f', src: s.toks }; }
        else nc = JSON.parse(JSON.stringify(cell, (k, v) => (typeof v === 'bigint' ? { $b: v.toString() } : v)), (k, v) => (v && v.$b !== undefined ? BigInt(v.$b) : v));
      }
      const old = this.cells[this.r][this.c];
      this.cells[this.r][this.c] = nc;
      if (cut) { if (sr !== this.r || sc !== this.c) this.cells[sr][sc] = null; this.clip = null; }
      if (this.bytes() > CAP) { this.cells[this.r][this.c] = old; C.showError(new C.CalcError('Memory')); return; }
      this.afterChange();
    },
    fill(asFormula) {
      const self = this;
      const eds = [new C.Editor('line'), new C.Editor('line')];
      // 初期範囲 = 現在セル
      for (const ch of colName(this.c) + (this.r + 1) + ':' + colName(this.c) + (this.r + 1)) eds[1].insert(ch === 'E' ? 'E_' : /[A-D]/.test(ch) ? ch : ch === ':' ? ':' : ch);
      let sel = 0;
      const ov = {
        render() {
          const row = (i, lb, inner) => '<div class="fr' + (i === sel ? ' sel' : '') + '" style="top:' + (14 + i * 14) + 'px"><span class="lb">' + lb + '</span><span class="vl"><span class="tk">:</span>' + inner + '</span></div>';
          return '<div class="fm" style="--vx:56px"><div class="title">' + (asFormula ? '一括入力(数式)' : '一括入力(値)') + '</div>' +
            row(0, asFormula ? '数式' : '値', (asFormula ? '<span class="tk">=</span>' : '') + eds[0].render(sel === 0)) + row(1, '範囲', eds[1].render(sel === 1)) +
            '<div class="fr' + (sel === 2 ? ' sel' : '') + '" style="top:42px;right:1px">' + C.IC.play + '<span style="margin-left:1px">確定する</span></div></div>';
        },
        key(k) {
          if (k === 'up') { sel = (sel + 2) % 3; return true; }
          if (k === 'down') { sel = (sel + 1) % 3; return true; }
          if (k === 'back') { C.pop(ov); return true; }
          if ((k === 'exe' || k === 'ok') && sel < 2) { sel++; return true; }
          if (k === 'exe' || k === 'ok') {
            let rg; try { rg = parseRange(eds[1].root); } catch (e) { C.showError(e); return true; }
            const src = eds[0].root; if (!src.length) { C.showError(new C.CalcError('Syntax')); return true; }
            const backup = JSON.stringify(self.cells, (kk, v) => (typeof v === 'bigint' ? { $b: v.toString() } : v));
            try {
              for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) {
                const s = shiftRefs(src, r - rg.r1, c - rg.c1).toks;
                if (asFormula) { C.parse(s, { sheet: true }); self.cells[r][c] = { kind: 'f', src: s }; }
                else { let v = C.evaluate(C.parse(s, { sheet: true }), self.ctxFor(new Set())); if (!V.isReal(v)) throw new C.CalcError('Argument'); self.cells[r][c] = { kind: 'v', v }; }
              }
              if (self.bytes() > CAP) throw new C.CalcError('Memory');
            } catch (e) { self.cells = JSON.parse(backup, (kk, v) => (v && v.$b !== undefined ? BigInt(v.$b) : v)); C.showError(e); return true; }
            C.pop(ov); self.afterChange(); return true;
          }
          if (sel < 2) {
            if (k === 'ac') { eds[sel].clear(); return true; }
            if (k === 'variable') { C.openVariables({ onRecall: (t) => eds[sel].insert(t), getValue: () => undefined }); return true; }
            if (k === 'catalog') { C.openCatalog([() => ['表計算', [{ label: 'Min(', tok: 'Min(' }, { label: 'Max(', tok: 'Max(' }, { label: 'Mean(', tok: 'Mean(' }, { label: 'Sum(', tok: 'Sum(' }, { label: ':', tok: ':' }, { label: '$', tok: '$' }]], CAT.numeric, CAT.other], eds[sel]); return true; }
            C.inputKey(eds[sel], k, {});
          }
          return true;
        },
      };
      C.push(ov);
    },
    tools() {
      const yn = (get, set, a, b) => [[true, a], [false, b]].map(([v, l]) => ({ label: l, radio: true, checked: () => get() === v, action: () => { set(v); this.persist(); C.popAll(); } }));
      return [
        { label: '一括入力(数式)', action: () => { C.popAll(); this.fill(true); } },
        { label: '一括入力(値)', action: () => { C.popAll(); this.fill(false); } },
        { label: 'セルの編集', action: () => { C.popAll(); this.ed = new C.Editor('line'); this.ed.setTokens(this.cellTokens(this.r, this.c)); } },
        { label: '切り取り&貼り付け', action: () => { this.clip = { r: this.r, c: this.c, cell: this.cells[this.r][this.c], cut: true }; C.popAll(); } },
        { label: 'コピー&貼り付け', action: () => { this.clip = { r: this.r, c: this.c, cell: this.cells[this.r][this.c], cut: false }; C.popAll(); } },
        { label: '再計算', action: () => { C.popAll(); const e = this.recalc(); if (e) C.showError(e); } },
        { label: '自動計算', sub: () => yn(() => this.auto, (v) => { this.auto = v; if (v) this.recalc(); }, 'する', 'しない') },
        { label: 'エディットボックス表示', sub: () => yn(() => this.showVal, (v) => { this.showVal = v; }, '値', '数式') },
        { label: 'すべてのデータをクリア', action: () => { this.cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); this.afterChange(); C.popAll(); } },
        { label: '空き容量表示', action: () => { C.popAll(); C.info('空き容量: ' + (CAP - this.bytes()) + 'バイト'); } },
      ];
    },
  };
  C.lateApps.sheet = sheet;
  C.sheetHelpers = { shiftRefs, parseRange };
})(window.C = window.C || {});
