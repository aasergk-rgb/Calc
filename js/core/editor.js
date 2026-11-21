/*
 * 数式エディタ（数学自然表示／ライン表示）
 * 行(Row) = 要素の配列。要素は「トークン文字列」または「テンプレート」{k, ...フィールド(Row)}
 */
(function (C) {
  'use strict';

  // テンプレート定義: フィールド順（左右移動順）、上下移動
  const TPL = {
    frac: { f: ['a', 'b'], up: { b: 'a' }, down: { a: 'b' } },
    mixed: { f: ['w', 'a', 'b'], up: { b: 'a' }, down: { a: 'b' } },
    sqrt: { f: ['a'] },
    root: { f: ['n', 'a'] },
    pow: { f: ['e'] },
    logb: { f: ['b', 'a'] },
    abs: { f: ['a'] },
    integ: { f: ['a', 'lo', 'hi'], up: { lo: 'hi', a: 'hi' }, down: { hi: 'lo', a: 'lo' } },
    deriv: { f: ['a', 'at'] },
    sum: { f: ['a', 'lo', 'hi'], up: { lo: 'hi', a: 'hi' }, down: { hi: 'lo', a: 'lo' } },
    prod: { f: ['a', 'lo', 'hi'], up: { lo: 'hi', a: 'hi' }, down: { hi: 'lo', a: 'lo' } },
    recur: { f: ['a'] }, // 循環節
  };
  C.TPL = TPL;

  function mkTpl(k) { const t = { k }; for (const f of TPL[k].f) t[f] = []; return t; }
  const isTpl = (x) => x && typeof x === 'object' && TPL[x.k];

  // ---- トークンの表示 ----
  const DISP = {
    '*': '×', '/': '÷', '-': '−', '+': '+', neg: '-', E: 'ᴇ', nPr: 'P', nCr: 'C', divR: '÷R', dot: '•', '∠': '∠',
    'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(', 'asinh(': 'sinh⁻¹(', 'acosh(': 'cosh⁻¹(', 'atanh(': 'tanh⁻¹(',
    '⁻¹': '⁻¹', dms: '°', 'ʳ': 'ʳ', 'ᵍ': 'ᵍ', '°': '°', t: '▸t', and: ' and ', or: ' or ', xor: ' xor ', xnor: ' xnor ',
    'd:': 'd', 'h:': 'h', 'b:': 'b', 'o:': 'o', '⌟': '⌟', 'xrt(': 'ˣ√(', 'e^(': 'e^(', '10^(': '10^(',
    '▶r∠θ': '▸r∠θ', '▶a+bi': '▸a+bi', 'xh': 'x̂', 'yh': 'ŷ', 'xh1': 'x̂₁', 'xh2': 'x̂₂', ':': ':', '$': '$',
    'Ran#': 'Ran#', E_: 'E', '?': '?', '≠': '≠', '≤': '≤', '≥': '≥', '%': '%', '!': '!', 'Ans': 'Ans', 'PreAns': 'PreAns',
  };
  C.tokenText = function (t) {
    if (DISP[t] !== undefined) return DISP[t];
    if (t.startsWith('eng:')) return t.slice(4);
    if (t.startsWith('c:')) { const c = C.CONST_BY_KEY && C.CONST_BY_KEY[t.slice(2)]; return c ? c.sym : t.slice(2); }
    if (t.startsWith('u:')) { const u = C.UNIT_BY_KEY && C.UNIT_BY_KEY[t.slice(2)]; return u ? u.from + '▸' + u.to : t; }
    if (t.startsWith('sv:')) return C.STATVAR_DISP ? (C.STATVAR_DISP[t.slice(3)] || t.slice(3)) : t.slice(3);
    if (t.startsWith('hx')) return t.slice(2);
    return t;
  };
  const SUPS = { '²': '2', '³': '3', '⁻¹': '−1' };
  // 根号（内容の高さに合わせて伸縮する）
  C.RAD = '<svg class="rad" viewBox="0 0 7 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 11.5 L1.6 10.5 L3.6 19.5 L6.6 0.5 L7 0.5" fill="none" stroke="currentColor" stroke-width="1.1" vector-effect="non-scaling-stroke" stroke-linejoin="miter"/></svg>';
  // 液晶上の文字（変数などは数式用イタリック）
  const ITAL = { x: '𝑥', y: '𝑦', z: '𝑧', e: '𝑒', i: '𝑖' };
  C.lcdText = function (t) { return ITAL[t] || C.tokenText(t); };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  C.esc = esc;

  class Editor {
    constructor(mode) { this.mode = mode || 'math'; this.clear(); this.overwrite = false; this.capture = false; this.undoStack = []; }
    clear() { this.root = []; this.cur = { row: this.root, i: 0 }; }
    isEmpty() { return this.root.length === 0; }
    snapshot() { return JSON.stringify(this.root); }
    pushUndo() { this.undoStack.push(this.snapshot()); if (this.undoStack.length > 30) this.undoStack.shift(); }
    undo() {
      if (!this.undoStack.length) return;
      const s = this.undoStack.pop();
      this.root = JSON.parse(s); this.cur = { row: this.root, i: this.root.length };
    }
    setTokens(arr) { this.root = JSON.parse(JSON.stringify(arr)); this.cur = { row: this.root, i: this.root.length }; }
    // 親探索
    findParent(row, base, path) {
      base = base || this.root;
      for (let i = 0; i < base.length; i++) {
        const el = base[i];
        if (isTpl(el)) for (const f of TPL[el.k].f) {
          if (el[f] === row) return { node: el, field: f, prow: base, pi: i };
          const r = this.findParent(row, el[f]); if (r) return r;
        }
      }
      return null;
    }
    // ---- 入力 ----
    insert(tok) {
      this.pushUndo();
      if (this.mode === 'line' && this.overwrite && this.cur.i < this.cur.row.length) this.cur.row.splice(this.cur.i, 1);
      this.cur.row.splice(this.cur.i, 0, tok); this.cur.i++;
    }
    insertMany(toks) { for (const t of toks) this.insert(t); }
    insertTpl(k, preset) {
      this.pushUndo();
      const t = mkTpl(k);
      if (preset) for (const f in preset) t[f] = preset[f];
      const row = this.cur.row;
      if (k === 'pow') { row.splice(this.cur.i, 0, t); this.cur = { row: t.e, i: 0 }; return; }
      if (this.capture) {
        // カーソル右側のオペランドを関数の引数として取り込む（INS）
        this.capture = false;
        const end = this.operandEnd(row, this.cur.i);
        const grabbed = row.splice(this.cur.i, end - this.cur.i);
        const fld = TPL[k].f[k === 'root' || k === 'logb' ? 1 : 0];
        t[fld] = grabbed;
        row.splice(this.cur.i, 0, t);
        this.cur = { row: t[fld], i: t[fld].length };
        return;
      }
      row.splice(this.cur.i, 0, t);
      const first = TPL[k].f[0];
      this.cur = { row: t[first], i: t[first].length };
    }
    operandEnd(row, i) {
      let j = i;
      if (j < row.length && isTpl(row[j])) return j + 1;
      if (j < row.length && typeof row[j] === 'string' && (row[j] === '(' || (row[j].endsWith('(') && row[j].length > 1))) {
        let depth = 0;
        for (let k = j; k < row.length; k++) {
          if (row[k] === ')') { depth--; if (depth === 0) return k + 1; }
          else if (typeof row[k] === 'string' && row[k].endsWith('(')) depth++;
        }
        return row.length;
      }
      while (j < row.length && typeof row[j] === 'string' && /^[0-9.]$|^[A-Fxyz]$|^E$|^E_$|^π$|^Ans$/.test(row[j])) j++;
      return j;
    }
    operandStart(row, i) {
      let j = i;
      if (j > 0 && isTpl(row[j - 1])) return j - 1;
      if (j > 0 && row[j - 1] === ')') {
        let depth = 0;
        for (let k = j - 1; k >= 0; k--) {
          if (row[k] === ')') depth++;
          else if (typeof row[k] === 'string' && row[k].endsWith('(')) { depth--; if (depth === 0) return k; }
        }
        return 0;
      }
      while (j > 0 && typeof row[j - 1] === 'string' && /^[0-9.]$|^[A-Fxyz]$|^E$/.test(row[j - 1])) j--;
      return j;
    }
    del() {
      const row = this.cur.row;
      if (this.mode === 'line' && this.overwrite && this.cur.i < row.length) { this.pushUndo(); row.splice(this.cur.i, 1); return; }
      if (this.cur.i > 0) {
        const el = row[this.cur.i - 1];
        if (isTpl(el)) {
          this.pushUndo();
          // テンプレート解除: 主フィールドの内容を残す
          const main = el.k === 'root' || el.k === 'logb' ? el.a : el.k === 'mixed' ? el.w.concat(el.a.length || el.b.length ? [] : []) : el[TPL[el.k].f[0]];
          row.splice(this.cur.i - 1, 1, ...main);
          this.cur.i = this.cur.i - 1 + main.length;
          return;
        }
        this.pushUndo();
        row.splice(this.cur.i - 1, 1); this.cur.i--;
        return;
      }
      // フィールド先頭: 親テンプレートを解除
      const p = this.findParent(row);
      if (p) {
        const flds = TPL[p.node.k].f; const idx = flds.indexOf(p.field);
        if (idx > 0) { const prev = p.node[flds[idx - 1]]; this.cur = { row: prev, i: prev.length }; return; }
        this.pushUndo();
        const content = flds.reduce((acc, f) => acc.concat(p.node[f]), []);
        p.prow.splice(p.pi, 1, ...content);
        this.cur = { row: p.prow, i: p.pi };
      }
    }
    // ---- カーソル移動 ----
    left() {
      const { row, i } = this.cur;
      if (i > 0) {
        const el = row[i - 1];
        if (isTpl(el)) { const fs = TPL[el.k].f; const last = el[fs[fs.length - 1]]; this.cur = { row: last, i: last.length }; return true; }
        this.cur.i--; return true;
      }
      const p = this.findParent(row);
      if (!p) { this.cur.i = row.length; return false; } // 先頭→末尾へ回り込み
      const fs = TPL[p.node.k].f; const idx = fs.indexOf(p.field);
      if (idx > 0) { const pr = p.node[fs[idx - 1]]; this.cur = { row: pr, i: pr.length }; }
      else this.cur = { row: p.prow, i: p.pi };
      return true;
    }
    right() {
      const { row, i } = this.cur;
      if (i < row.length) {
        const el = row[i];
        if (isTpl(el)) { const first = el[TPL[el.k].f[0]]; this.cur = { row: first, i: 0 }; return true; }
        this.cur.i++; return true;
      }
      const p = this.findParent(row);
      if (!p) { this.cur.i = 0; return false; }
      const fs = TPL[p.node.k].f; const idx = fs.indexOf(p.field);
      if (idx < fs.length - 1) this.cur = { row: p.node[fs[idx + 1]], i: 0 };
      else this.cur = { row: p.prow, i: p.pi + 1 };
      return true;
    }
    vert(dir) {
      let row = this.cur.row;
      for (let p = this.findParent(row); p; p = this.findParent(p.prow)) {
        const map = TPL[p.node.k][dir];
        if (map && map[p.field]) { const tgt = p.node[map[p.field]]; this.cur = { row: tgt, i: Math.min(this.cur.i, tgt.length) }; if (this.cur.row !== row) this.cur.i = tgt.length; return true; }
      }
      return false;
    }
    up() { return this.vert('up'); }
    down() { return this.vert('down'); }
    toEnd() { this.cur = { row: this.root, i: this.root.length }; }
    toStart() { this.cur = { row: this.root, i: 0 }; }
    byteCount() { return JSON.stringify(this.root).length; }

    // ---- 描画 ----
    render(showCursor) { return renderRow(this.root, showCursor ? this.cur : null, this.mode, true); }
  }

  function renderRow(row, cur, mode, top) {
    let h = '';
    const curHere = cur && cur.row === row;
    if (row.length === 0 && !top) {
      return '<span class="row empty">' + (curHere ? '<span class="cur"></span>' : '') + '<span class="ph"></span></span>';
    }
    for (let i = 0; i <= row.length; i++) {
      if (curHere && cur.i === i) h += '<span class="cur"></span>';
      if (i === row.length) break;
      h += renderEl(row[i], cur, mode, row, i);
    }
    return '<span class="row">' + h + '</span>';
  }

  function renderEl(el, cur, mode, row, i) {
    if (typeof el === 'string') {
      if (mode === 'math' && SUPS[el]) return '<span class="sup">' + SUPS[el] + '</span>';
      if (el === 'E') return '<span class="x10">×10</span>';
      const t = C.lcdText(el);
      return '<span class="tk">' + esc(t) + '</span>';
    }
    const R = (f) => renderRow(el[f], cur, mode, false);
    switch (el.k) {
      case 'frac': return '<span class="frac"><span class="num">' + R('a') + '</span><span class="den">' + R('b') + '</span></span>';
      case 'mixed': return '<span class="mixed">' + R('w') + '<span class="frac"><span class="num">' + R('a') + '</span><span class="den">' + R('b') + '</span></span></span>';
      case 'sqrt': return '<span class="sqrt">' + C.RAD + '<span class="rc">' + R('a') + '</span></span>';
      case 'root': return '<span class="sqrt"><span class="idx">' + R('n') + '</span>' + C.RAD + '<span class="rc">' + R('a') + '</span></span>';
      case 'pow': return '<span class="sup">' + R('e') + '</span>';
      case 'logb': return '<span class="tk">log</span><span class="sub">' + R('b') + '</span><span class="paren">(</span>' + R('a') + '<span class="paren">)</span>';
      case 'abs': return '<span class="abs">' + R('a') + '</span>';
      case 'integ': return '<span class="bigop"><span class="lim hi">' + R('hi') + '</span><span class="sym int">∫</span><span class="lim lo">' + R('lo') + '</span></span>' + R('a') + '<span class="tk">d𝑥</span>';
      case 'deriv': return '<span class="frac sm"><span class="num"><span class="tk">d</span></span><span class="den"><span class="tk">d𝑥</span></span></span><span class="paren">(</span>' + R('a') + '<span class="paren">)</span><span class="evalat"><span class="bar"></span><span class="sub"><span class="tk">𝑥=</span>' + R('at') + '</span></span>';
      case 'sum': case 'prod': return '<span class="bigop"><span class="lim hi">' + R('hi') + '</span><span class="sym">' + (el.k === 'sum' ? 'Σ' : '∏') + '</span><span class="lim lo"><span class="tk">𝑥=</span>' + R('lo') + '</span></span><span class="paren">(</span>' + R('a') + '<span class="paren">)</span>';
      case 'recur': return '<span class="recur"><span class="dot" style="left:4px"></span><span class="dot" style="right:4px"></span>' + R('a') + '</span>';
    }
    return '';
  }
  C.renderRow = renderRow;
  C.Editor = Editor;
  C.mkTpl = mkTpl;
  C.isTpl = isTpl;
})(window.C = window.C || {});
