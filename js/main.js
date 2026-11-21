/* 本体: キー配列・描画・HOME・設定・電源 */
(function (C) {
  'use strict';
  const G = C.G, esc = C.esc;

  // ===== キー配列 =====
  // [id, 表示, SHIFT表示, クラス, n進表示]
  const FN_ROWS = [
    [['x', '<i>x</i>', '='], ['frac', '<span style="font-size:10px">▭</span>/<span style="font-size:10px">▭</span>', '帯分数'], ['sqrt', '√▭', '∛▭'], ['sq', '<i>x</i><sup>2</sup>', '<i>x</i><sup>3</sup>'], ['pow', '<i>x</i><sup>▪</sup>', '<sup>▪</sup>√▭'], ['logb', 'log<sub>▪</sub>▭', '10<sup>▪</sup>']],
    [['fx', '<i>f</i>(<i>x</i>)', '<i>g</i>(<i>x</i>)', 'sm'], ['sin', 'sin', 'sin⁻¹'], ['cos', 'cos', 'cos⁻¹'], ['tan', 'tan', 'tan⁻¹'], ['ln', 'ln', 'e<sup>▪</sup>'], ['inv', '<i>x</i><sup>−1</sup>', '<i>x</i>!']],
    [['neg', '(−)', '∠'], ['dms', '°′″', '<i>i</i>'], ['lp', '(', '%'], ['rp', ')', ','], ['sd', 'S⇔D', ''], ['format', 'FORMAT', 'QR', 'sm']],
  ];
  const BASE_LBL = { x: 'A', frac: 'B', sqrt: 'C', sq: 'D', pow: 'E', logb: 'F' };
  const NUM_ROWS = [
    [['7', '7', ''], ['8', '8', ''], ['9', '9', ''], ['del', 'DEL', 'INS', 'del'], ['ac', 'AC', 'OFF', 'ac']],
    [['4', '4', ''], ['5', '5', ''], ['6', '6', ''], ['mul', '×', '<i>n</i>P<i>r</i>', 'op'], ['div', '÷', '÷R', 'op']],
    [['1', '1', ''], ['2', '2', ''], ['3', '3', ''], ['add', '+', '<i>n</i>C<i>r</i>', 'op'], ['sub', '−', 'PreAns', 'op']],
    [['0', '0', 'Ran#'], ['.', '.', '循環'], ['exp', '×10<sup><i>x</i></sup>', 'π', 'sm'], ['ans', 'Ans', '<i>e</i>', 'sm'], ['exe', 'EXE', '≈', 'exe']],
  ];
  function keyHtml([id, lbl, sl, cls], extraCls) {
    return '<div class="kw"><span class="sl">' + (sl || '') + '</span><button class="k ' + (cls || '') + ' ' + (extraCls || '') + '" data-k="' + id + '">' + lbl + '</button>' + (BASE_LBL[id] ? '<span class="bx">' + BASE_LBL[id] + '</span>' : '') + '</div>';
  }
  function buildKeys() {
    const top = '<div class="top">' +
      keyHtml(['shift', 'SHIFT', '', 'sm shift']) + keyHtml(['catalog', 'CATALOG', '', 'sm']) +
      '<div class="pad"><button class="up" data-k="up">▲</button><button class="left" data-k="left">◀</button><button class="ok" data-k="ok">OK</button><button class="right" data-k="right">▶</button><button class="down" data-k="down">▼</button></div>' +
      keyHtml(['home', 'HOME', '', 'sm']) + keyHtml(['settings', 'SETTINGS', '', 'sm']) +
      keyHtml(['variable', 'VARIABLE', '', 'sm']) + keyHtml(['tools', 'TOOLS', '', 'sm']) +
      keyHtml(['back', 'BACK', '', 'sm']) + keyHtml(['on', 'ON', '', 'sm on']) + '</div>';
    let fn = '<div class="fn">'; for (const r of FN_ROWS) for (const k of r) fn += keyHtml(k); fn += '</div>';
    let nm = '<div class="num">'; for (const r of NUM_ROWS) for (const k of r) nm += keyHtml(k); nm += '</div>';
    document.getElementById('keys').innerHTML = top + fn + nm;
  }

  // ===== アプリ =====
  C.APPS = C.APPS || [];
  const appById = (id) => C.APPS.find((a) => a.id === id);
  C.switchApp = function (id) {
    const a = appById(id); if (!a) return;
    G.ov.length = 0;
    G.app = a; a.enter(); C.save(); C.render();
  };
  C.activeEditor = () => (G.app && G.app.editor ? G.app.editor() : null);

  // ===== HOME =====
  let homeSel = 0, homeTop = 0;
  const HomeOv = {
    render() {
      const cols = 4, rowsVis = 3;
      const row = Math.floor(homeSel / cols);
      if (row < homeTop) homeTop = row; if (row >= homeTop + rowsVis) homeTop = row - rowsVis + 1;
      let h = '<div class="home">';
      C.APPS.forEach((a, i) => {
        const r = Math.floor(i / cols); if (r < homeTop || r >= homeTop + rowsVis) return;
        h += '<div class="app' + (i === homeSel ? ' sel' : '') + '"><div class="ic">' + a.icon + '</div></div>';
      });
      h += '</div><div class="home-name">' + esc(C.APPS[homeSel].name) + '</div>';
      return h;
    },
    key(k) {
      const n = C.APPS.length;
      if (k === 'left') homeSel = (homeSel - 1 + n) % n;
      else if (k === 'right') homeSel = (homeSel + 1) % n;
      else if (k === 'up') homeSel = homeSel - 4 >= 0 ? homeSel - 4 : homeSel;
      else if (k === 'down') homeSel = Math.min(n - 1, homeSel + 4);
      else if (k === 'ok' || k === 'exe') { const a = C.APPS[homeSel]; C.switchApp(a.id); }
      else if (k === 'back' || k === 'home' || k === 'ac') C.pop(HomeOv);
      else if (k === 'settings') { C.pop(HomeOv); openSettings(); }
      return true;
    },
    status: () => '',
  };
  function openHome() { G.ov.length = 0; homeSel = Math.max(0, C.APPS.indexOf(G.app)); C.push(HomeOv); }

  // ===== 設定 =====
  function opt(label, getter, setter, choices) {
    return {
      label, right: () => { const v = getter(); const c = choices.find((x) => JSON.stringify(x[0]) === JSON.stringify(v)); return c ? c[2] || c[1] : ''; },
      sub: () => new C.Menu({ title: label, sel: Math.max(0, choices.findIndex((x) => JSON.stringify(x[0]) === JSON.stringify(getter()))), items: choices.map(([v, l]) => ({ label: l, checked: () => JSON.stringify(getter()) === JSON.stringify(v), action: (m) => { setter(v); C.save(); C.pop(m); C.onSettingsChanged(); } })) }),
    };
  }
  const S = G.s;
  function openSettings() {
    const s = G.s;
    const set = (k) => (v) => { s[k] = v; };
    const get = (k) => () => s[k];
    const digitMenu = (type, title) => ({
      label: title, sub: () => new C.Menu({ title, items: Array.from({ length: 10 }, (_, i) => ({ label: type === 'sci' && i === 0 ? '10' : String(i), action: () => { s.numFmt = { type, n: i }; C.save(); C.popAll(); C.onSettingsChanged(); } })) }),
    });
    C.menu('設定', [
      { label: '計算設定', sub: () => [
        opt('入力/出力', get('io'), (v) => { s.io = v; C.onIOChanged(); }, [['mm', '数学自然表示入出力', 'MathI/MathO'], ['md', '数学自然表示入力/小数出力', 'MathI/DecO'], ['ll', 'ライン表示入出力', 'LineI/LineO'], ['ld', 'ライン表示入力/小数出力', 'LineI/DecO']]),
        opt('角度単位', get('angle'), set('angle'), [['deg', '度数法(D)', 'D'], ['rad', '弧度法(R)', 'R'], ['gra', 'グラード(G)', 'G']]),
        { label: '表示桁数', right: () => (s.numFmt.type === 'norm' ? 'Norm' + s.numFmt.n : s.numFmt.type === 'fix' ? 'Fix' + s.numFmt.n : 'Sci' + (s.numFmt.n || 10)), sub: () => [
          digitMenu('fix', '小数点以下桁数(Fix)'), digitMenu('sci', '有効桁数(Sci)'),
          { label: '指数表示範囲(Norm)', sub: () => [1, 2].map((n) => ({ label: 'Norm ' + n, right: n === 1 ? '10⁻²>|x|,|x|≧10¹⁰' : '10⁻⁹>|x|,|x|≧10¹⁰', checked: () => s.numFmt.type === 'norm' && s.numFmt.n === n, action: () => { s.numFmt = { type: 'norm', n }; C.save(); C.popAll(); C.onSettingsChanged(); } })) },
        ] },
        opt('エンジニアリング記号', get('eng'), set('eng'), [[true, 'する'], [false, 'しない']]),
        opt('分数表示', get('frac'), set('frac'), [['mixed', '帯分数(ab/c)', '帯分数'], ['improper', '仮分数(d/c)', '仮分数']]),
        opt('複素数表示', get('complex'), set('complex'), [['rect', '直交座標形式(a+bi)', 'a+bi'], ['polar', '極座標形式(r∠θ)', 'r∠θ']]),
        opt('小数点表示', get('decMark'), set('decMark'), [['.', 'ドット'], [',', 'カンマ']]),
        opt('3桁区切り', get('sep'), set('sep'), [[true, 'する'], [false, 'しない']]),
      ] },
      { label: 'システム設定', sub: () => [
        { label: 'コントラスト', right: () => String(Math.round(s.contrast * 10)), action: () => openContrast() },
        opt('オートパワーオフ', get('apo'), set('apo'), [[10, '10分'], [60, '60分']]),
        opt('ライン表示フォント', get('font'), set('font'), [['normal', '標準フォント'], ['small', '小さいフォント']]),
        opt('QRコード', get('qr'), set('qr'), [[3, 'バージョン3'], [11, 'バージョン11']]),
        { label: '表示テーマ(画面外)', right: () => ({ auto: '自動', light: 'ライト', dark: 'ダーク' }[document.documentElement.dataset.theme || 'auto']), sub: () => [['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']].map(([v, l]) => ({ label: l, action: () => { if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v; try { localStorage.setItem('kscalc.theme', v); } catch (e) { /* */ } C.popAll(); } })) },
      ] },
      { label: 'リセット', sub: () => [
        { label: '設定とデータ', action: () => C.confirm('設定とデータ', '設定とデータを初期化しますか？', () => { resetSettings(); resetData(); done('設定とデータを初期化しました'); }) },
        { label: '変数メモリー', action: () => C.confirm('変数メモリー', '変数メモリーをクリアしますか？', () => { for (const v in G.vars) G.vars[v] = C.E.Q(0); done('変数メモリーをクリアしました'); }) },
        { label: 'すべてを初期化', action: () => C.confirm('すべてを初期化', 'すべてを初期化しますか？', () => { resetSettings(true); resetData(); for (const v in G.vars) G.vars[v] = C.E.Q(0); G.ans = C.E.Q(0); G.preAns = C.E.Q(0); G.fdef = { f: [], g: [] }; G.mats = {}; G.vecs = {}; done('初期化しました'); }) },
      ] },
      { label: 'はじめに', action: () => C.push(new C.Msg({ title: 'KS-900JP', text: 'HOMEで計算アプリを選び、OKで起動します。SETTINGSで各種設定を変更できます。', hint: '[OK] 閉じる' })) },
    ]);
  }
  function done(msg) { C.save(); C.popAll(); C.switchApp(G.app.id); C.push(new C.Msg({ title: msg, hint: '[OK]' })); }
  function resetSettings(all) {
    const keep = all ? {} : { contrast: G.s.contrast, apo: G.s.apo };
    const d = JSON.parse(JSON.stringify(C.DEFAULTS)); for (const k in G.s) delete G.s[k]; Object.assign(G.s, d, keep);
  }
  function resetData() { G.appState = {}; for (const a of C.APPS) if (a.reset) a.reset(); }
  function openContrast() {
    const ov = {
      render() { const v = Math.round(G.s.contrast * 10); return '<div class="msg"><div class="t">コントラスト</div><div class="d">◀ ' + '■'.repeat(Math.max(1, v - 4)) + '□'.repeat(Math.max(0, 12 - v)) + ' ▶</div><div class="h">[◀][▶] 調整  [OK] 終了</div></div>'; },
      key(k) { if (k === 'left') G.s.contrast = Math.max(0.6, +(G.s.contrast - 0.1).toFixed(1)); else if (k === 'right') G.s.contrast = Math.min(1.6, +(G.s.contrast + 0.1).toFixed(1)); else if (['ok', 'exe', 'back', 'ac'].includes(k)) { C.save(); C.pop(ov); } return true; },
    };
    C.push(ov);
  }
  C.onSettingsChanged = function () { if (G.app && G.app.onSettings) G.app.onSettings(); C.render(); };
  C.onIOChanged = function () { for (const a of C.APPS) if (a.onIO) a.onIO(); };

  // ===== 描画 =====
  C.render = function () {
    const lcd = document.getElementById('lcd');
    if (!lcd) return;
    lcd.classList.toggle('off', !G.power);
    document.documentElement.style.setProperty('--contrast', G.s.contrast);
    document.querySelector('.device').classList.toggle('base', !!(G.app && G.app.id === 'base'));
    if (!G.power) return;
    const top = C.top();
    let body = '';
    try { body = top ? top.render() : G.app.render(); } catch (e) { console.error(e); body = '<div class="msg">表示エラー</div>'; }
    document.getElementById('screen').innerHTML = body;
    document.getElementById('status').innerHTML = statusHtml(top);
    // カーソルを表示範囲内に
    const cur = lcd.querySelector('.cur');
    if (cur) {
      let box = cur.closest('.input, .vl, .editbox');
      if (box) {
        const br = box.getBoundingClientRect(), cr = cur.getBoundingClientRect();
        if (cr.right > br.right - 4) box.scrollLeft += cr.right - br.right + 12;
        if (cr.left < br.left + 2) box.scrollLeft -= br.left - cr.left + 12;
        if (box.classList.contains('input') && box.scrollHeight > box.clientHeight) { const off = cr.top - br.top; if (off > box.clientHeight - 20 || off < 0) box.scrollTop += off - box.clientHeight / 2; }
      }
    }
  };
  function statusHtml(top) {
    const s = G.s; const ind = [];
    if (G.shift) ind.push('<span class="ind box">S</span>');
    ind.push('<span class="ind box">' + { deg: 'D', rad: 'R', gra: 'G' }[s.angle] + '</span>');
    if (s.numFmt.type === 'fix') ind.push('<span class="ind">FIX</span>');
    if (s.numFmt.type === 'sci') ind.push('<span class="ind">SCI</span>');
    if (s.eng) ind.push('<span class="ind">E</span>');
    if (G.app && G.app.id === 'cplx') ind.push('<span class="ind">' + (s.complex === 'polar' ? '∠' : '<i>i</i>') + '</span>');
    if (G.app && G.app.id === 'calc' && s.verify) ind.push('<span class="ind">VERIFY</span>');
    ind.push('<span class="ind">' + (s.io === 'mm' || s.io === 'md' ? 'Math' : 'Line') + '</span>');
    const appSt = !top && G.app && G.app.status ? G.app.status() : '';
    ind.push('<span class="sp"></span>');
    if (appSt) ind.push('<span class="ind">' + appSt + '</span>');
    ind.push('<span class="ind">' + esc(top === HomeOv ? 'HOME' : G.app ? G.app.short || G.app.name : '') + '</span>');
    return ind.join('');
  }

  // ===== キー処理 =====
  let apoTimer = null;
  function resetApo() { clearTimeout(apoTimer); apoTimer = setTimeout(() => { G.power = false; G.shift = false; C.render(); }, G.s.apo * 60000); }
  C.press = function (k) {
    resetApo();
    if (k === 'on') { if (!G.power) { G.power = true; G.shift = false; C.render(); return; } G.shift = false; C.render(); return; }
    if (!G.power) return;
    if (k === 'shift') { G.shift = !G.shift; C.render(); return; }
    let key = k;
    if (G.shift) { key = 'S-' + k; G.shift = false; }
    if (key === 'S-ac') { G.power = false; G.ov.length = 0; C.save(); C.render(); return; }
    if (key === 'S-on') key = 'on';
    if (key === 'sd') key = 'S⇔D';
    if (key === 'S-sd') key = 'S⇔D';
    try {
      const top = C.top();
      if (key === 'home') { openHome(); C.render(); return; }
      if (key === 'settings' && !top) { openSettings(); C.render(); return; }
      if (top) {
        if (key === 'settings') { C.popAll(); openSettings(); C.render(); return; }
        top.key(key);
      } else {
        const handled = G.app.key(key);
        if (!handled) {
          if (key === 'tools') { const items = G.app.tools ? G.app.tools() : null; if (items) C.menu('ツール', items); }
          else if (key === 'catalog' && G.app.catalog) { const ed = C.activeEditor(); if (ed) C.openCatalog(G.app.catalog(), ed); }
          else if (key === 'back' && G.app.id !== 'calc') { /* 何もしない */ }
        }
      }
    } catch (e) { C.showError(e); }
    C.render();
  };

  function bindUI() {
    const keys = document.getElementById('keys');
    let lastTouch = 0;
    const handler = (ev) => {
      const b = ev.target.closest('[data-k]'); if (!b) return;
      if (ev.type === 'touchstart') { lastTouch = Date.now(); ev.preventDefault(); b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 90); }
      else if (Date.now() - lastTouch < 600) return;
      C.press(b.dataset.k);
    };
    keys.addEventListener('touchstart', handler, { passive: false });
    keys.addEventListener('click', handler);
    const KB = {
      Enter: 'exe', '=': 'exe', Backspace: 'del', Delete: 'ac', Escape: 'back', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '(': 'lp', ')': 'rp', '^': 'pow', '.': '.', ',': 'S-rp', '%': 'S-lp', '!': 'S-inv',
      s: 'sin', c: 'cos', t: 'tan', l: 'ln', g: 'logb', r: 'sqrt', x: 'x', e: 'exp', p: 'S-exp', a: 'ans', f: 'frac', i: 'S-dms', h: 'home', o: 'ok',
      v: 'variable', k: 'catalog', T: 'tools', F: 'format', m: 'settings', n: 'neg', q: 'sq', Tab: 'shift', b: 'back', d: 'dms', u: 'fx', E: 'S-exe',
    };
    document.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      let k = KB[ev.key];
      if (/^[0-9]$/.test(ev.key)) k = ev.key;
      if (!k) return;
      ev.preventDefault();
      if (k.startsWith('S-')) { G.shift = true; k = k.slice(2); }
      C.press(k);
      const btn = document.querySelector('[data-k="' + CSS.escape(k) + '"]'); if (btn) { btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 90); }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    try { const th = localStorage.getItem('kscalc.theme'); if (th && th !== 'auto') document.documentElement.dataset.theme = th; } catch (e) { /* */ }
    buildKeys(); bindUI();
    const last = C.load();
    for (const a of C.APPS) if (a.init) a.init();
    G.app = appById(last) || C.APPS[0];
    G.app.enter(true);
    resetApo();
    C.render();
  });
})(window.C = window.C || {});
