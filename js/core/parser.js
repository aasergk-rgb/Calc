/* 構文解析: エディタの行(Row) -> AST */
(function (C) {
  'use strict';
  const Err = (c) => new C.CalcError(c || 'Syntax');

  const BIN_LEVEL = {
    '=': 0, '≠': 0, '<': 0, '>': 0, '≤': 0, '≥': 0,
    or: 1, xor: 1, xnor: 1,
    and: 2,
    '+': 3, '-': 3,
    '*': 4, '/': 4, divR: 4,
    dot: 5,
    nPr: 6, nCr: 6, '∠': 6,
  };
  const POSTFIX = new Set(['²', '³', '⁻¹', '!', '%', '°', 'ʳ', 'ᵍ', 't', '▶r∠θ', '▶a+bi', 'xh', 'yh', 'xh1', 'xh2', '▶Dec', '▶Hex', '▶Bin', '▶Oct']);
  const ATOMS = new Set(['π', 'e', 'i', 'Ran#', 'Ans', 'PreAns', 'A', 'B', 'C', 'D', 'E_', 'F', 'x', 'y', 'z', 'M', 'MatA', 'MatB', 'MatC', 'MatD', 'MatAns', 'VctA', 'VctB', 'VctC', 'VctD', 'VctAns']);
  const VARS = new Set(['A', 'B', 'C', 'D', 'F', 'x', 'y', 'z', 'M']);
  const isDigit = (t) => typeof t === 'string' && (/^[0-9]$/.test(t) || t === '.' || /^hx[A-F]$/.test(t));
  const isFn = (t) => typeof t === 'string' && t.length > 1 && t.endsWith('(') && t !== 'xrt(';

  class Parser {
    constructor(row, opt) { this.row = row; this.p = 0; this.opt = opt || {}; }
    peek(o) { return this.row[this.p + (o || 0)]; }
    next() { return this.row[this.p++]; }
    eof() { return this.p >= this.row.length; }

    parseTop() {
      const stmts = [this.parseExpr()];
      while (this.peek() === ':') { this.next(); stmts.push(this.parseExpr()); }
      if (!this.eof()) throw Err();
      return stmts.length === 1 ? stmts[0] : { t: 'stmts', list: stmts };
    }
    parseExpr() { return this.parseBin(0); }
    parseBin(level) {
      if (level > 6) return this.parseImp();
      let a = this.parseBin(level + 1);
      for (;;) {
        const t = this.peek();
        if (typeof t === 'string' && BIN_LEVEL[t] === level) {
          this.next();
          const b = this.parseBin(level + 1);
          if (level === 0) a = { t: 'rel', op: t, a, b };
          else a = { t: 'bin', op: t, a, b };
          if (level === 0) { // 連続関係式は不可
            const t2 = this.peek(); if (typeof t2 === 'string' && BIN_LEVEL[t2] === 0) throw Err();
          }
        } else break;
      }
      return a;
    }
    startsOperand(t) {
      if (t === undefined) return false;
      if (C.isTpl(t)) return t.k !== 'pow';
      if (isDigit(t)) return true;
      if (isFn(t) || t === '(') return true;
      if (ATOMS.has(t) || VARS.has(t)) return true;
      if (t.startsWith('c:') || t.startsWith('sv:') || t === '$') return true;
      if (t === 'd:' || t === 'h:' || t === 'b:' || t === 'o:') return true;
      return false;
    }
    parseImp() {
      let a = this.parseUnary();
      while (this.startsOperand(this.peek())) {
        const b = this.parseUnary();
        a = { t: 'bin', op: 'imp', a, b };
      }
      return a;
    }
    parseUnary() {
      const t = this.peek();
      if (t === 'neg' || t === '-') { this.next(); return { t: 'un', op: 'neg', a: this.parseUnary() }; }
      if (t === '+') { this.next(); return this.parseUnary(); }
      if (t === 'd:' || t === 'h:' || t === 'b:' || t === 'o:') { this.next(); const n = this.peek(); if (!isDigit(n)) throw Err(); return { t: 'num', s: this.readDigits(), base: t[0] }; }
      return this.parseFrac();
    }
    parseFrac() {
      const a = this.parsePost();
      if (this.peek() === '⌟') {
        this.next(); const b = this.parsePost();
        if (this.peek() === '⌟') { this.next(); const c = this.parsePost(); return { t: 'mixed', w: a, a: b, b: c }; }
        return { t: 'frac', a, b };
      }
      return a;
    }
    parsePost() {
      let a = this.parsePrimary();
      for (;;) {
        const t = this.peek();
        if (t === undefined) break;
        if (C.isTpl(t) && t.k === 'pow') { this.next(); a = { t: 'pow', a, b: sub(t.e, this.opt) }; continue; }
        if (t === '^(') { this.next(); const e = this.parseExpr(); this.close(); a = { t: 'pow', a, b: e }; continue; }
        if (t === 'xrt(') { this.next(); const e = this.parseExpr(); this.close(); a = { t: 'root', n: a, a: e }; continue; }
        if (t === 'dms') { // 度分秒
          this.next();
          const parts = [a];
          while (parts.length < 3 && isDigit(this.peek())) {
            const save = this.p; const v = this.parsePrimary();
            if (this.peek() === 'dms') { this.next(); parts.push(v); } else { this.p = save; break; }
          }
          a = { t: 'dms', d: parts[0], m: parts[1] || null, s: parts[2] || null };
          continue;
        }
        if (typeof t === 'string' && (POSTFIX.has(t) || t.startsWith('eng:') || t.startsWith('u:'))) { this.next(); a = { t: 'post', op: t, a }; continue; }
        break;
      }
      return a;
    }
    close() { if (this.peek() === ')') this.next(); else if (!this.eof() && this.peek() !== ':') { /* 閉じ括弧省略は末尾のみ */ if (this.peek() !== ',') throw Err(); } }
    readDigits() {
      let s = '';
      while (isDigit(this.peek())) { const t = this.next(); if (t.startsWith('hx')) this.hex = true; s += t.startsWith('hx') ? t.slice(2) : t; }
      return s;
    }
    parseArgs() {
      const args = [];
      if (this.peek() === ')') { this.next(); return args; }
      if (this.eof()) return args;
      args.push(this.parseExpr());
      while (this.peek() === ',') { this.next(); args.push(this.parseExpr()); }
      if (this.peek() === ')') this.next(); else if (!this.eof() && this.peek() !== ':') throw Err();
      return args;
    }
    parsePrimary() {
      const t = this.peek();
      if (t === undefined) throw Err();
      if (C.isTpl(t)) { this.next(); return tplAst(t, this.opt); }
      if (isDigit(t)) {
        this.hex = false;
        let s = this.readDigits();
        if (this.hex) return { t: 'num', s, hex: true };
        // 循環小数
        if (C.isTpl(this.peek()) && this.peek().k === 'recur') {
          const r = this.next(); const rs = r.a.join('');
          if (!/^[0-9]+$/.test(rs)) throw Err();
          if (!s.includes('.')) s += '.';
          return { t: 'num', s, recur: rs };
        }
        if (this.peek() === 'E') {
          this.next(); let es = '';
          if (this.peek() === 'neg' || this.peek() === '-') { this.next(); es = '-'; }
          const d = this.readDigits(); if (!/^[0-9]+$/.test(d)) throw Err();
          s += 'E' + es + d;
        }
        if ((s.match(/\./g) || []).length > 1) throw Err();
        return { t: 'num', s };
      }
      if (t === 'E') { // ×10^n 単独
        this.next(); let es = '';
        if (this.peek() === 'neg' || this.peek() === '-') { this.next(); es = '-'; }
        const d = this.readDigits(); if (!/^[0-9]+$/.test(d)) throw Err();
        return { t: 'num', s: 'E' + es + d };
      }
      if (t === '(') { this.next(); if (this.eof()) throw Err(); const e = this.parseExpr(); if (this.peek() === ')') this.next(); else if (!this.eof() && this.peek() !== ':') throw Err(); return { t: 'paren', a: e }; }
      // 表計算セル参照
      if (this.opt.sheet && (t === '$' || /^[A-E]$|^E_$/.test(t))) {
        const save = this.p; let absC = false, absR = false;
        if (this.peek() === '$') { this.next(); absC = true; }
        const col = this.peek();
        if (/^[A-E]$|^E_$/.test(col)) {
          this.next();
          if (this.peek() === '$') { this.next(); absR = true; }
          if (/^[0-9]$/.test(this.peek())) {
            let r = ''; while (/^[0-9]$/.test(this.peek())) r += this.next();
            const cell = { t: 'cell', c: col[0].charCodeAt(0) - 65, r: parseInt(r, 10) - 1, absC, absR };
            if (this.peek() === ':') {
              const save2 = this.p; this.next();
              try { const c2 = this.parsePrimary(); if (c2.t === 'cell') return { t: 'range', a: cell, b: c2 }; } catch (e) { /* */ }
              this.p = save2;
            }
            return cell;
          }
        }
        this.p = save;
      }
      if (isFn(t)) {
        this.next();
        const args = this.parseArgs();
        return { t: 'call', f: t.slice(0, -1), args };
      }
      this.next();
      if (t === 'E_') return { t: 'var', n: 'E' };
      if (VARS.has(t)) return { t: 'var', n: t };
      if (ATOMS.has(t)) return { t: 'atom', n: t };
      if (t.startsWith('c:')) return { t: 'const', n: t.slice(2) };
      if (t.startsWith('sv:')) return { t: 'statvar', n: t.slice(3) };
      throw Err();
    }
  }

  function sub(row, opt) {
    if (!row || row.length === 0) throw Err();
    const p = new Parser(row, opt); const e = p.parseExpr(); if (!p.eof()) throw Err(); return e;
  }
  function tplAst(t, opt) {
    const S = (r) => sub(r, opt);
    switch (t.k) {
      case 'frac': return { t: 'frac', a: S(t.a), b: S(t.b) };
      case 'mixed': return { t: 'mixed', w: S(t.w), a: S(t.a), b: S(t.b) };
      case 'sqrt': return { t: 'sqrt', a: S(t.a) };
      case 'root': return { t: 'root', n: S(t.n), a: S(t.a) };
      case 'logb': return { t: 'call', f: 'log', args: [S(t.b), S(t.a)] };
      case 'abs': return { t: 'call', f: 'Abs', args: [S(t.a)] };
      case 'integ': return { t: 'call', f: '∫', args: [S(t.a), S(t.lo), S(t.hi)] };
      case 'deriv': return { t: 'call', f: 'd/dx', args: [S(t.a), S(t.at)] };
      case 'sum': return { t: 'call', f: 'Σ', args: [S(t.a), S(t.lo), S(t.hi)] };
      case 'prod': return { t: 'call', f: 'Π', args: [S(t.a), S(t.lo), S(t.hi)] };
      case 'recur': throw Err();
    }
    throw Err();
  }

  C.parse = function (row, opt) {
    if (!row.length) throw Err();
    return new Parser(row, opt).parseTop();
  };
  C.Parser = Parser;
})(window.C = window.C || {});
