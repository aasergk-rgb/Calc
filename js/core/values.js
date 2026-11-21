/* 値の型（実数・複素数・行列・ベクトル）とエラー、汎用演算 */
(function (C) {
  'use strict';
  const E = C.E;

  const ERR = {
    Math: ['Math ERROR', '数学的誤りか計算範囲超えです'],
    Stack: ['Stack ERROR', '計算するスタック数超えです'],
    Syntax: ['Syntax ERROR', '入力書式に誤りがあります'],
    Argument: ['Argument ERROR', '引数の設定に誤りがあります'],
    Dimension: ['Dimension ERROR', '次元の設定に誤りがあります'],
    Variable: ['Variable ERROR', '変数入力に誤りがあります'],
    CantSolve: ['Can\'t Solve', '解を求めることができません'],
    Range: ['Range ERROR', '範囲の設定に誤りがあります'],
    TimeOut: ['Time Out', 'タイムアウトになりました'],
    Circular: ['Circular ERROR', '循環参照しています'],
    Memory: ['Memory ERROR', '使用可能メモリーの範囲超えです'],
    NotDefined: ['Not Defined', '定義されていません'],
  };
  class CalcError extends Error {
    constructor(code, pos) { super(code); this.code = code; this.pos = pos; }
    get title() { return (ERR[this.code] || ERR.Math)[0]; }
    get jp() { return (ERR[this.code] || ERR.Math)[1]; }
  }
  C.CalcError = CalcError;
  C.ERR = ERR;

  const MAXV = 9.999999999999999e99;
  function chk(v) { // 範囲チェック（近似値）
    if (typeof v === 'number') {
      if (!Number.isFinite(v) || Number.isNaN(v) || Math.abs(v) > MAXV) throw new CalcError('Math');
      if (Math.abs(v) < 1e-99) return 0;
    }
    return v;
  }
  function R(v) { return chk(v); }

  // ---- 型判定 ----
  const isReal = (x) => typeof x === 'number' || E.isE(x);
  const isCx = (x) => x && x.k === 'c';
  const isMat = (x) => x && x.k === 'm';
  const isVec = (x) => x && x.k === 'v';
  const isList = (x) => x && x.k === 'list';

  function mkC(re, im) { if (E.isZero(im) || (typeof im === 'number' && Math.abs(im) < 1e-14 * Math.max(1, Math.abs(E.toNum(re))) && im !== 0 && false)) return re; return { k: 'c', re, im }; }
  function cplx(x) { return isCx(x) ? x : { k: 'c', re: x, im: E.Q(0) }; }
  function mkM(a) { return { k: 'm', r: a.length, c: a[0].length, a }; }
  function mkV(a) { return { k: 'v', a }; }

  function realOnly(x) { if (!isReal(x)) throw new CalcError(isCx(x) ? 'Math' : 'Argument'); return x; }

  // ---- 複素数演算 ----
  const cx = {
    add: (a, b) => mkC(R(E.add(a.re, b.re)), R(E.add(a.im, b.im))),
    sub: (a, b) => mkC(R(E.sub(a.re, b.re)), R(E.sub(a.im, b.im))),
    mul: (a, b) => mkC(R(E.sub(E.mul(a.re, b.re), E.mul(a.im, b.im))), R(E.add(E.mul(a.re, b.im), E.mul(a.im, b.re)))),
    div: (a, b) => {
      const den = E.add(E.mul(b.re, b.re), E.mul(b.im, b.im));
      if (E.isZero(den) || E.toNum(den) === 0) throw new CalcError('Math');
      const re = E.div(E.add(E.mul(a.re, b.re), E.mul(a.im, b.im)), den);
      const im = E.div(E.sub(E.mul(a.im, b.re), E.mul(a.re, b.im)), den);
      return mkC(R(re), R(im));
    },
    abs: (a) => R(E.sqrt(E.add(E.mul(a.re, a.re), E.mul(a.im, a.im)))),
    arg: (a) => Math.atan2(E.toNum(a.im), E.toNum(a.re)),
    conj: (a) => mkC(a.re, E.neg(a.im)),
  };

  // ---- 汎用二項演算 ----
  function add(a, b) {
    if (isReal(a) && isReal(b)) return R(E.add(a, b));
    if ((isReal(a) || isCx(a)) && (isReal(b) || isCx(b))) return cx.add(cplx(a), cplx(b));
    if (isMat(a) && isMat(b)) { if (a.r !== b.r || a.c !== b.c) throw new CalcError('Dimension'); return mkM(a.a.map((row, i) => row.map((v, j) => R(E.add(v, b.a[i][j]))))); }
    if (isVec(a) && isVec(b)) { if (a.a.length !== b.a.length) throw new CalcError('Dimension'); return mkV(a.a.map((v, i) => R(E.add(v, b.a[i])))); }
    throw new CalcError(isMat(a) || isMat(b) || isVec(a) || isVec(b) ? 'Dimension' : 'Syntax');
  }
  function neg(a) {
    if (isReal(a)) return E.neg(a);
    if (isCx(a)) return mkC(E.neg(a.re), E.neg(a.im));
    if (isMat(a)) return mkM(a.a.map((r) => r.map(E.neg)));
    if (isVec(a)) return mkV(a.a.map(E.neg));
    throw new CalcError('Syntax');
  }
  function sub(a, b) { return add(a, neg(b)); }
  function mul(a, b) {
    if (isReal(a) && isReal(b)) return R(E.mul(a, b));
    if ((isReal(a) || isCx(a)) && (isReal(b) || isCx(b))) return cx.mul(cplx(a), cplx(b));
    if (isReal(a) && isMat(b)) return mkM(b.a.map((r) => r.map((v) => R(E.mul(a, v)))));
    if (isMat(a) && isReal(b)) return mul(b, a);
    if (isReal(a) && isVec(b)) return mkV(b.a.map((v) => R(E.mul(a, v))));
    if (isVec(a) && isReal(b)) return mul(b, a);
    if (isMat(a) && isMat(b)) {
      if (a.c !== b.r) throw new CalcError('Dimension');
      const out = [];
      for (let i = 0; i < a.r; i++) { out.push([]); for (let j = 0; j < b.c; j++) { let s = E.Q(0); for (let k = 0; k < a.c; k++) s = E.add(s, E.mul(a.a[i][k], b.a[k][j])); out[i].push(R(s)); } }
      return mkM(out);
    }
    if (isMat(a) && isVec(b)) { // 行列×列ベクトル
      if (a.c !== b.a.length) throw new CalcError('Dimension');
      return mkV(a.a.map((row) => R(row.reduce((s, v, k) => E.add(s, E.mul(v, b.a[k])), E.Q(0)))));
    }
    if (isVec(a) && isMat(b)) {
      if (b.r !== a.a.length) throw new CalcError('Dimension');
      const out = []; for (let j = 0; j < b.c; j++) { let s = E.Q(0); for (let k = 0; k < b.r; k++) s = E.add(s, E.mul(a.a[k], b.a[k][j])); out.push(R(s)); }
      return mkV(out);
    }
    if (isVec(a) && isVec(b)) return cross(a, b);
    throw new CalcError('Dimension');
  }
  function div(a, b) {
    if (isReal(a) && isReal(b)) { if (E.isZero(b) || E.toNum(b) === 0) throw new CalcError('Math'); return R(E.div(a, b)); }
    if ((isReal(a) || isCx(a)) && (isReal(b) || isCx(b))) return cx.div(cplx(a), cplx(b));
    if ((isMat(a) || isVec(a)) && isReal(b)) { const ib = E.inv(b); return mul(a, ib); }
    throw new CalcError('Dimension');
  }
  function dot(a, b) {
    if (!isVec(a) || !isVec(b)) throw new CalcError('Dimension');
    if (a.a.length !== b.a.length) throw new CalcError('Dimension');
    return R(a.a.reduce((s, v, i) => E.add(s, E.mul(v, b.a[i])), E.Q(0)));
  }
  function cross(a, b) {
    if (a.a.length !== b.a.length) throw new CalcError('Dimension');
    let [a1, a2, a3] = a.a, [b1, b2, b3] = b.a;
    if (a.a.length === 2) { a3 = E.Q(0); b3 = E.Q(0); }
    return mkV([E.sub(E.mul(a2, b3), E.mul(a3, b2)), E.sub(E.mul(a3, b1), E.mul(a1, b3)), E.sub(E.mul(a1, b2), E.mul(a2, b1))].map(R));
  }

  // ---- 行列 ----
  function det(m) {
    if (!isMat(m)) throw new CalcError('Argument');
    if (m.r !== m.c) throw new CalcError('Dimension');
    const n = m.r; const a = m.a.map((r) => r.slice());
    let d = E.Q(1);
    for (let i = 0; i < n; i++) {
      let p = -1; for (let r = i; r < n; r++) if (!isZ(a[r][i])) { p = r; break; }
      if (p < 0) return E.Q(0);
      if (p !== i) { [a[p], a[i]] = [a[i], a[p]]; d = E.neg(d); }
      d = E.mul(d, a[i][i]);
      for (let r = i + 1; r < n; r++) {
        const f = E.div(a[r][i], a[i][i]);
        for (let c = i; c < n; c++) a[r][c] = E.sub(a[r][c], E.mul(f, a[i][c]));
      }
    }
    return R(d);
  }
  function isZ(v) { return E.isZero(v) || (typeof v === 'number' && Math.abs(v) < 1e-13); }
  function inverse(m) {
    if (m.r !== m.c) throw new CalcError('Dimension');
    const n = m.r; const a = m.a.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => E.Q(i === j ? 1 : 0))));
    for (let i = 0; i < n; i++) {
      let p = -1; for (let r = i; r < n; r++) if (!isZ(a[r][i])) { p = r; break; }
      if (p < 0) throw new CalcError('Math');
      [a[p], a[i]] = [a[i], a[p]];
      const pv = a[i][i];
      for (let c = 0; c < 2 * n; c++) a[i][c] = E.div(a[i][c], pv);
      for (let r = 0; r < n; r++) if (r !== i && !isZ(a[r][i])) { const f = a[r][i]; for (let c = 0; c < 2 * n; c++) a[r][c] = E.sub(a[r][c], E.mul(f, a[i][c])); }
    }
    return mkM(a.map((r) => r.slice(n).map(R)));
  }
  function trn(m) { return mkM(m.a[0].map((_, j) => m.a.map((r) => r[j]))); }
  function ident(n) { n = Number(E.bigOf(n)); if (n < 1 || n > 4) throw new CalcError('Argument'); return mkM(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => E.Q(i === j ? 1 : 0)))); }
  function ref(m, reduced) {
    const a = m.a.map((r) => r.slice()); const R_ = m.r, Cc = m.c; let lead = 0;
    for (let r = 0; r < R_ && lead < Cc; r++) {
      let i = r;
      // ピボット選択（絶対値最大ではなく非ゼロ最初）
      while (i < R_ && isZ(a[i][lead])) { i++; if (i === R_) { i = r; lead++; if (lead === Cc) return mkM(a.map((x) => x.map(R))); } }
      [a[i], a[r]] = [a[r], a[i]];
      const pv = a[r][lead];
      for (let c = 0; c < Cc; c++) a[r][c] = E.div(a[r][c], pv);
      for (let k = reduced ? 0 : r + 1; k < R_; k++) if (k !== r) { const f = a[k][lead]; if (!isZ(f)) for (let c = 0; c < Cc; c++) a[k][c] = E.sub(a[k][c], E.mul(f, a[r][c])); }
      lead++;
    }
    return mkM(a.map((x) => x.map((v) => (isZ(v) ? E.Q(0) : R(v)))));
  }
  function matPow(m, k) {
    if (m.r !== m.c) throw new CalcError('Dimension');
    let res = ident(E.Q(m.r)); for (let i = 0; i < k; i++) res = mul(res, m); return res;
  }

  C.V = { R, chk, isReal, isCx, isMat, isVec, isList, mkC, cplx, mkM, mkV, realOnly, cx, add, sub, mul, div, neg, dot, cross, det, inverse, trn, ident, ref, matPow, isZ };
})(window.C = window.C || {});
