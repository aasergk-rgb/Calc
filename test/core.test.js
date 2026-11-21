// 電卓コアのテスト:  node test/core.test.js
const C = require('./harness');
const assert = require('assert');
const S = { io: 'mm', angle: 'deg', numFmt: { type: 'norm', n: 1 }, eng: false, frac: 'improper', complex: 'rect', decMark: '.', sep: false };

// テスト用の簡易トークナイザ（長いトークンから順に照合）
const TOK = ['RanInt#(', 'Identity(', 'Rref(', 'Ref(', 'UnitV(', 'Angle(', 'Conjg(', 'asin(', 'acos(', 'atan(', 'sinh(', 'd/dx(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'Abs(', 'Pol(', 'Rec(', 'GCD(', 'LCM(', 'Int(', 'Intg(', 'Det(', 'Trn(', 'Arg(', 'xrt(', 'e^(', '^(', '√(', '∛(', 'Σ(', 'Π(', '∫(',
  'MatA', 'MatB', 'VctA', 'VctB', 'nPr', 'nCr', 'divR', 'neg', 'dms', 'dot', 'and', 'xor', 'or', 'Ans', 'π', '²', '³', '⁻¹', '!', '⌟', 'i', '∠', '=', '<', '>', '≤', '≥', '%', '°', 'ʳ'];
function tok(str) {
  const out = [];
  for (let i = 0; i < str.length;) {
    if (str[i] === ' ') { i++; continue; }
    const m = TOK.find((t) => str.startsWith(t, i));
    if (m) { out.push(m); i += m.length; continue; }
    out.push(str[i]); i++;
  }
  return out;
}
function calc(str, opt) {
  const ctx = Object.assign({ settings: S, angle: 'deg', vars: { x: C.E.Q(0) }, mode: 'calc' }, opt || {});
  return C.evaluate(C.parse(tok(str)), ctx);
}
const text = (v, mode) => C.fmtValue(v, S, mode || {}).html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
let pass = 0, fail = 0;
function t(expr, expected, opt) {
  let got;
  try { got = text(calc(expr, opt), opt ? { fmt: opt.fmt, base: opt.base } : {}); } catch (e) { got = 'ERR ' + (e.code || e.message); }
  if (got === expected) pass++; else { fail++; console.log('FAIL', expr, '=>', JSON.stringify(got), 'expected', JSON.stringify(expected)); }
}
// 基本・分数
t('1+2*3', '7'); t('1/3+1/6', '1 2'); t('2⌟3+1⌟1⌟2', '13 6'); t('6/2(1+2)', '1'); t('neg2²', '−4'); t('(neg2)²', '4');
t('0.1+0.2', '3 10'); t('1/0', 'ERR Math'); t('1+', 'ERR Syntax');
// √ と π
t('√(8)', '2 √ 8'.replace('8', '2')); t('√(2)*√(8)', '4'); t('2+√(12)', '2 + 2 √ 3'); t('1/√(2)', '√ 2 2'); t('(1+√(2))²', '3 + 2 √ 2'); t('π/6', 'π 6'); t('2π', '2 π');
// 三角関数（厳密値）
t('sin(30)', '1 2'); t('sin(45)', '√ 2 2'); t('cos(15)', '√ 2 + √ 6 4'); t('tan(60)', '√ 3'); t('tan(90)', 'ERR Math'); t('asin(1/2)', '30'); t('acos(neg1/2)', '120');
t('sin(π/6)', '1 2', { angle: 'rad' }); t('asin(1)', 'π 2', { angle: 'rad' }); t('90°', 'π 2', { angle: 'rad' });
// 対数・指数・べき
t('log(2,16)', '4'); t('log(1000)', '3'); t('log(4,2)', '1 2'); t('ln(1)', '0'); t('2^(10)', '1024'); t('8^(1/3)', '2'); t('3xrt(27)', '3'); t('∛(neg27)', '−3'); t('e^(0)', '1');
// 整数関数
t('5!', '120'); t('70!', 'ERR Math'); t('10nPr4', '5040'); t('10nCr4', '210'); t('GCD(28,35)', '7'); t('LCM(9,15)', '45'); t('Int(neg3.5)', '−3'); t('Intg(neg3.5)', '−4'); t('5divR2', 'Q= 2 R= 1');
// 座標変換・60進
t('Pol(√(2),√(2))', 'r= 2 θ= 45'); t('Rec(2,60)', 'x= 1 y= √ 3'); t('2dms30dms', '2°30′0″', { fmt: 'sexa' });
// 微積分・総和
t('∫(x²,0,3)', '9'); t('d/dx(x³,2)', '12'); t('Σ(x+1,1,5)', '20'); t('Π(x,1,5)', '120');
// 複素数
t('(1+i)^(4)+(1-i)²', '−4 − 2 i', { mode: 'cplx' }); t('2∠45', '√ 2 + √ 2 i', { mode: 'cplx' }); t('√(neg4)', '2 i', { mode: 'cplx' }); t('Arg(1+i)', '45', { mode: 'cplx' });
// 表示形式
t('1E10', '1 ×10 10'); t('123456789012', '1.23456789 ×10 11'); t('1/7', '0. 142857', { fmt: 'recur' }); t('1014', '2 × 3 × 13 2', { fmt: 'prime' });
// 関係式（真偽判別）
t('√(8)=2√(2)', '正しい'); t('1>2', '誤り');
// 行列・ベクトル
const M = (a) => C.V.mkM(a.map((r) => r.map((x) => C.E.Q(x))));
const Vv = (a) => C.V.mkV(a.map((x) => C.E.Q(x)));
const mats = { MatA: M([[2, 1], [1, 1]]), MatB: M([[2, -1], [-1, 2]]) };
const vecs = { VctA: Vv([1, 2]), VctB: Vv([3, 4]) };
t('MatA*MatB', '3 0 1 1', { mode: 'mat', mats }); t('Det(MatA)', '1', { mode: 'mat', mats }); t('MatA⁻¹', '1 −1 −1 2', { mode: 'mat', mats });
t('VctA dot VctB', '11', { mode: 'vec', vecs }); t('VctA+VctB', '[ 4 , 6 ]', { mode: 'vec', vecs });
// n進
t('1+1', '0000 0000 0000 0000 0000 0000 0000 0010', { mode: 'base', base: 'bin', fmt: 'base' });
// 方程式・不等式
const Q = C.E.Q;
const roots = (cs) => { const r = C.solvePoly(cs.map((x) => Q(x))); return r.reals.concat(r.cxs).map((v) => text(v)).join(' | '); };
if (C.solvePoly) {
  assert.strictEqual(roots([1, 2, -2]), '− 1 + √ 3 | − 1 − √ 3');
  assert.strictEqual(roots([1, -6, 11, -6]), '3 | 2 | 1');
  assert.strictEqual(roots([1, 0, 1]), 'i | − i');
  pass += 3;
}
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
