/*
 * 厳密計算コア
 * 実数値は「JS number（近似値）」または「Exact オブジェクト」で表現する。
 *  - {k:'s', t:[[n,d,r], ...]} : Σ (n/d)·√r  （r は平方因子を含まない正の BigInt、最大2項）
 *  - {k:'p', n, d}             : (n/d)·π
 * 計算できない組み合わせになった時点で近似値(number)に落とす。
 */
(function (C) {
  'use strict';
  const B = BigInt;
  const ZERO = 0n, ONE = 1n;
  const LIMIT = 10n ** 40n; // 有理数の分子・分母の上限（超えたら近似値へ）

  function babs(a) { return a < 0n ? -a : a; }
  function gcd(a, b) { a = babs(a); b = babs(b); while (b) { [a, b] = [b, a % b]; } return a; }

  function isE(x) { return x !== null && typeof x === 'object' && (x.k === 's' || x.k === 'p'); }

  function normQ(n, d) {
    if (d === 0n) throw new C.CalcError('Math');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return [n / g, d / g];
  }

  function mkS(terms) {
    // terms: [[n,d,r]] -> 正規化（同じ r をまとめ、0 を除去、r 昇順）
    const map = new Map();
    for (const [n0, d0, r] of terms) {
      const key = r.toString();
      if (map.has(key)) {
        const [n1, d1] = map.get(key).q;
        map.get(key).q = normQ(n1 * d0 + n0 * d1, d1 * d0);
      } else map.set(key, { r, q: normQ(n0, d0) });
    }
    const out = [];
    for (const { r, q } of map.values()) if (q[0] !== 0n) out.push([q[0], q[1], r]);
    out.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
    if (out.length > 2) return null;
    for (const t of out) if (babs(t[0]) > LIMIT || t[1] > LIMIT || t[2] > LIMIT) return null;
    return { k: 's', t: out };
  }

  function Q(n, d) { if (d === undefined) d = 1n; const [a, b] = normQ(B(n), B(d)); return mkS([[a, b, 1n]]) || toNumQ(a, b); }
  function PI(n, d) { if (d === undefined) d = 1n; const [a, b] = normQ(B(n), B(d)); if (a === 0n) return Q(0); return { k: 'p', n: a, d: b }; }

  function toNumQ(n, d) {
    // BigInt 有理数を高精度に number へ
    const sign = (n < 0n) !== (d < 0n) ? -1 : 1;
    n = babs(n); d = babs(d);
    if (n === 0n) return 0;
    const nl = n.toString().length, dl = d.toString().length;
    if (nl < 300 && dl < 300) {
      // 17桁程度の精度で割り算
      const shift = 20 - (nl - dl);
      let q;
      if (shift >= 0) q = (n * 10n ** B(shift)) / d; else q = n / (d * 10n ** B(-shift));
      return sign * Number(q) * Math.pow(10, -shift);
    }
    return sign * Number(n) / Number(d);
  }

  function toNum(x) {
    if (typeof x === 'number') return x;
    if (x.k === 'p') return toNumQ(x.n, x.d) * Math.PI;
    let s = 0;
    for (const [n, d, r] of x.t) s += toNumQ(n, d) * (r === 1n ? 1 : Math.sqrt(Number(r)));
    return s;
  }

  function isZero(x) { return typeof x === 'number' ? x === 0 : (x.k === 's' && x.t.length === 0); }
  function isRat(x) { return isE(x) && x.k === 's' && (x.t.length === 0 || (x.t.length === 1 && x.t[0][2] === 1n)); }
  function ratOf(x) { // [n,d] or null
    if (!isRat(x)) return null;
    if (x.t.length === 0) return [0n, 1n];
    return [x.t[0][0], x.t[0][1]];
  }
  function isInt(x) {
    if (isRat(x)) { const q = ratOf(x); return q[1] === 1n; }
    if (typeof x === 'number') return Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9 * Math.max(1, Math.abs(x)) && Math.abs(x) < 1e15;
    return false;
  }
  function bigOf(x) { // 整数値 -> BigInt
    if (isRat(x)) { const q = ratOf(x); if (q[1] === 1n) return q[0]; }
    const v = toNum(x); return B(Math.round(v));
  }

  // 平方因子の抽出: m = a^2 * s
  function squareExtract(m) {
    if (m < 0n) throw new Error('neg');
    if (m === 0n) return [0n, 1n];
    let a = 1n, s = 1n, rem = m;
    const small = [2n, 3n, 5n, 7n, 11n, 13n];
    const tryP = (p) => {
      let c = 0;
      while (rem % p === 0n) { rem /= p; c++; }
      if (c) { a *= p ** B(Math.floor(c / 2)); if (c % 2) s *= p; }
    };
    for (const p of small) tryP(p);
    for (let p = 17n; p * p <= rem && p < 200000n; p += 2n) tryP(p);
    if (rem > 1n) {
      const r = isqrt(rem);
      if (r * r === rem) a *= r; else s *= rem;
    }
    return [a, s];
  }
  function isqrt(n) {
    if (n < 0n) throw new Error('neg');
    if (n < 2n) return n;
    let x = B(Math.floor(Math.sqrt(Number(n))));
    while (x * x > n) x--;
    while ((x + 1n) * (x + 1n) <= n) x++;
    return x;
  }

  // ---- 演算 ----
  function neg(a) {
    if (typeof a === 'number') return -a;
    if (a.k === 'p') return { k: 'p', n: -a.n, d: a.d };
    return { k: 's', t: a.t.map(([n, d, r]) => [-n, d, r]) };
  }
  function add(a, b) {
    if (typeof a === 'number' || typeof b === 'number') return toNum(a) + toNum(b);
    if (isZero(a)) return b; if (isZero(b)) return a;
    if (a.k === 's' && b.k === 's') { const r = mkS(a.t.concat(b.t)); return r || (toNum(a) + toNum(b)); }
    if (a.k === 'p' && b.k === 'p') { const [n, d] = normQ(a.n * b.d + b.n * a.d, a.d * b.d); return n === 0n ? Q(0) : { k: 'p', n, d }; }
    return toNum(a) + toNum(b);
  }
  function sub(a, b) { return add(a, neg(b)); }
  function mul(a, b) {
    if (typeof a === 'number' || typeof b === 'number') return toNum(a) * toNum(b);
    if (isZero(a) || isZero(b)) return Q(0);
    if (a.k === 's' && b.k === 's') {
      const terms = [];
      for (const [n1, d1, r1] of a.t) for (const [n2, d2, r2] of b.t) {
        const g = gcd(r1, r2);
        const s = (r1 / g) * (r2 / g);
        terms.push([n1 * n2 * g, d1 * d2, s]);
      }
      const r = mkS(terms); return r || (toNum(a) * toNum(b));
    }
    if (a.k === 'p' && b.k === 's' && isRat(b)) { const q = ratOf(b); return PI(a.n * q[0], a.d * q[1]); }
    if (b.k === 'p' && a.k === 's' && isRat(a)) { const q = ratOf(a); return PI(b.n * q[0], b.d * q[1]); }
    return toNum(a) * toNum(b);
  }
  function inv(a) {
    if (typeof a === 'number') { if (a === 0) throw new C.CalcError('Math'); return 1 / a; }
    if (isZero(a)) throw new C.CalcError('Math');
    if (a.k === 'p') return 1 / toNum(a);
    if (a.t.length === 1) { const [n, d, r] = a.t[0]; return mkS([[d, n * r, r]]) || 1 / toNum(a); }
    // (p√r1 + q√r2)^-1 = (p√r1 - q√r2)/(p²r1 - q²r2)
    const [[n1, d1, r1], [n2, d2, r2]] = a.t;
    const conj = mkS([[n1, d1, r1], [-n2, d2, r2]]);
    const [dn, dd] = normQ(n1 * n1 * r1 * d2 * d2 - n2 * n2 * r2 * d1 * d1, d1 * d1 * d2 * d2);
    if (dn === 0n) throw new C.CalcError('Math');
    const res = mul(conj, Q(dd, dn));
    return res;
  }
  function div(a, b) {
    if (isZero(b)) throw new C.CalcError('Math');
    if (typeof a === 'number' || typeof b === 'number') return toNum(a) / toNum(b);
    if (a.k === 'p' && b.k === 'p') { return Q(a.n * b.d, a.d * b.n); }
    if (a.k === 'p' && isRat(b)) { const q = ratOf(b); return PI(a.n * q[1], a.d * q[0]); }
    if (b.k === 'p') return toNum(a) / toNum(b);
    return mul(a, inv(b));
  }
  function sqrt(a) {
    if (typeof a === 'number') return Math.sqrt(a);
    if (isRat(a)) {
      const [n, d] = ratOf(a);
      if (n < 0n) return NaN;
      if (n === 0n) return Q(0);
      const m = n * d;
      if (m > 10n ** 24n) return Math.sqrt(toNum(a));
      const [k, s] = squareExtract(m);
      return mkS([[k, d, s]]) || Math.sqrt(toNum(a));
    }
    // √(a+b√c) などは近似値
    const v = toNum(a);
    return Math.sqrt(v);
  }
  function powInt(a, k) {
    // k: BigInt 整数
    if (typeof a === 'number') return Math.pow(a, Number(k));
    if (k === 0n) { if (isZero(a)) throw new C.CalcError('Math'); return Q(1); }
    if (k < 0n) return inv(powInt(a, -k));
    if (k > 200n) return Math.pow(toNum(a), Number(k));
    if (isRat(a)) {
      const [n, d] = ratOf(a);
      const nn = n ** k, dd = d ** k;
      if (babs(nn) > LIMIT || dd > LIMIT) return Math.pow(toNum(a), Number(k));
      return Q(nn, dd);
    }
    let res = Q(1), base = a, e = k;
    while (e > 0n) {
      if (e & 1n) { res = mul(res, base); if (typeof res === 'number') return Math.pow(toNum(a), Number(k)); }
      e >>= 1n;
      if (e > 0n) { base = mul(base, base); if (typeof base === 'number') return Math.pow(toNum(a), Number(k)); }
    }
    return res;
  }
  function cmp(a, b) { // -1,0,1
    if (isRat(a) && isRat(b)) { const [n1, d1] = ratOf(a), [n2, d2] = ratOf(b); const l = n1 * d2, r = n2 * d1; return l < r ? -1 : l > r ? 1 : 0; }
    const x = toNum(a), y = toNum(b);
    if (Math.abs(x - y) <= 1e-13 * Math.max(Math.abs(x), Math.abs(y))) return 0;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  function sign(a) {
    if (isE(a) && a.k === 's' && a.t.length === 0) return 0;
    if (isRat(a)) return ratOf(a)[0] < 0n ? -1 : 1;
    if (isE(a) && a.k === 'p') return a.n < 0n ? -1 : 1;
    const v = toNum(a); return v < 0 ? -1 : v > 0 ? 1 : 0;
  }

  // 10進文字列 -> 厳密有理数  例: "12.5", "3E-4"
  function fromDecimal(str) {
    let s = str, exp = 0;
    const ei = s.indexOf('E');
    if (ei >= 0) { exp = parseInt(s.slice(ei + 1) || '0', 10); s = s.slice(0, ei); }
    if (s === '' || s === '.') s = (s === '' ? '1' : '0');
    let [ip, fp] = s.split('.');
    fp = fp || '';
    let n = B((ip || '0') + fp);
    let d = 10n ** B(fp.length);
    if (exp > 0) n *= 10n ** B(exp); else if (exp < 0) d *= 10n ** B(-exp);
    if (n.toString().length > 60 || d.toString().length > 60) return Number(str.replace('E', 'e'));
    return Q(n, d);
  }

  // 近似値から有理数を推定（連分数）。成功時 [n,d]
  function guessRational(x, maxDen) {
    if (!Number.isFinite(x)) return null;
    maxDen = maxDen || 1e6;
    const sign = x < 0 ? -1 : 1; x = Math.abs(x);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(b);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(x - h1 / k1) <= 1e-12 * Math.max(1, x)) return [sign * h1, k1];
      const f = b - a; if (f < 1e-15) break; b = 1 / f;
    }
    return null;
  }

  C.E = { B, gcd, isE, Q, PI, toNum, toNumQ, isZero, isRat, ratOf, isInt, bigOf, neg, add, sub, mul, div, inv, sqrt, powInt, cmp, sign, fromDecimal, squareExtract, isqrt, guessRational, mkS, normQ, babs };
})(window.C = window.C || {});
