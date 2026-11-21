/* 本体: キー配列・描画・HOME・設定・電源 */
(function (C) {
  'use strict';
  const G = C.G, esc = C.esc;

  // ===== キー配列（実機の配置に準拠） =====
  // [物理キーID, キートップ, SHIFT表示, クラス]
  const SV = (vb, inner, w) => '<svg viewBox="' + vb + '" width="' + (w || 20) + '" height="' + (w || 20) + '" aria-hidden="true">' + inner + '</svg>';
  const STROKE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    home: SV('0 0 24 24', '<path d="M4.5 11.2 12 4.8l7.5 6.4V19.5h-15z" ' + STROKE + ' stroke-width="2.1"/>'),
    back: SV('0 0 24 24', '<path d="M8.5 5.5 4.5 9.5l4 4M4.8 9.5H14a5 5 0 0 1 0 10H9" ' + STROKE + ' stroke-width="2.1"/>'),
    settings: SV('0 0 24 24', '<path d="M4 6.5h16M4 12h16M4 17.5h16" ' + STROKE + ' stroke-width="1.9"/><rect x="7.3" y="4" width="3.4" height="5" rx="1.2" fill="currentColor"/><rect x="13.6" y="9.5" width="3.4" height="5" rx="1.2" fill="currentColor"/><rect x="6.2" y="15" width="3.4" height="5" rx="1.2" fill="currentColor"/>'),
    variable: SV('0 0 34 24', '<path d="M2.5 8.5h9M8.5 5.5l3 3-3 3M11.5 15.5h-9M5.5 12.5l-3 3 3 3" ' + STROKE + ' stroke-width="1.6"/><rect x="14.5" y="3" width="17" height="18" rx="2.5" ' + STROKE + ' stroke-width="1.6"/><text x="23" y="17.2" text-anchor="middle" font-family="STIX Two Text, serif" font-style="italic" font-size="15" fill="currentColor">x</text>', 30),
    catalog: SV('0 0 24 24', '<path d="M12 6.4C9.3 4.6 6.4 4.4 3.5 5.2v13.4c2.9-.8 5.8-.6 8.5 1.2 2.7-1.8 5.6-2 8.5-1.2V5.2c-2.9-.8-5.8-.6-8.5 1.2zM12 6.4v13.2" ' + STROKE + ' stroke-width="1.8"/>', 22),
    tools: SV('0 0 30 10', '<circle cx="5" cy="5" r="3" ' + STROKE + ' stroke-width="1.7"/><circle cx="15" cy="5" r="3" ' + STROKE + ' stroke-width="1.7"/><circle cx="25" cy="5" r="3" ' + STROKE + ' stroke-width="1.7"/>', 26),
    dms: '<span style="font:600 19px/1 var(--f-ui);letter-spacing:1px;position:relative;top:-3px">°′″</span>',
    frac: SV('0 0 24 24', '<rect x="7" y="3" width="10" height="7.2" rx="1.2" fill="currentColor"/><rect x="4.5" y="11.3" width="15" height="1.7" rx=".8" fill="currentColor"/><rect x="7.8" y="14.6" width="8.4" height="6" rx="1" ' + STROKE + ' stroke-width="1.6"/>', 22),
    sqrt: SV('0 0 28 24', '<path d="M2.5 13.5h3l3.5 7L14 3.5h12" ' + STROKE + ' stroke-width="1.8"/><rect x="16" y="7.5" width="8.5" height="11" rx="1.2" fill="currentColor"/>', 26),
    pow: SV('0 0 24 24', '<rect x="3" y="8" width="12" height="13" rx="1.5" fill="currentColor"/><rect x="16.5" y="3" width="5.5" height="6.5" rx="1" ' + STROKE + ' stroke-width="1.5"/>', 22),
    sq: SV('0 0 24 24', '<rect x="3" y="8" width="12" height="13" rx="1.5" fill="currentColor"/><text x="19.3" y="10" text-anchor="middle" font-family="Barlow, sans-serif" font-weight="700" font-size="10" fill="currentColor">2</text>', 22),
    del: SV('0 0 30 20', '<path d="M10 2.5h16.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H10L2.5 10z" fill="currentColor"/><path d="M14 6.5l7 7M21 6.5l-7 7" stroke="#3a3b40" stroke-width="2.4" stroke-linecap="round"/>', 28),
    format: '<span class="fmt">' + SV('0 0 44 44', '<path d="M9 15a15 15 0 0 1 26 0M35 29a15 15 0 0 1-26 0" ' + STROKE + ' stroke-width="2"/><path d="M35 15l-.5-5M35 15l-4.8-1.5M9 29l.5 5M9 29l4.8 1.5" ' + STROKE + ' stroke-width="2"/>', 44) + '<b>FORMAT</b></span>',
    shift: SV('0 0 24 24', '<path d="M12 4.2 20 12.4h-4.5v7.4h-7v-7.4H4z" fill="#2a271e"/>', 22),
    up: SV('0 0 16 16', '<path d="M3.5 10.5 8 6l4.5 4.5" ' + STROKE + ' stroke-width="2"/>'),
    down: SV('0 0 16 16', '<path d="M3.5 5.5 8 10l4.5-4.5" ' + STROKE + ' stroke-width="2"/>'),
    left: SV('0 0 16 16', '<path d="M10.5 3.5 6 8l4.5 4.5" ' + STROKE + ' stroke-width="2"/>'),
    right: SV('0 0 16 16', '<path d="M5.5 3.5 10 8l-4.5 4.5" ' + STROKE + ' stroke-width="2"/>'),
    pgup: SV('0 0 16 16', '<path d="M3 8.5 8 3.5l5 5M3 13 8 8l5 5" ' + STROKE + ' stroke-width="1.9"/>'),
    pgdn: SV('0 0 16 16', '<path d="M3 3 8 8l5-5M3 7.5 8 12.5l5-5" ' + STROKE + ' stroke-width="1.9"/>'),
  };
  const ROW_A = [['shift', I.shift, '', 'shift'], ['x', '<i>x</i>', '<i>f</i>(<i>x</i>)'], ['variable', I.variable, '', '', 'VARIABLE'], null, ['catalog', I.catalog, '', '', '<span class="g">☰</span> CATALOG'], ['tools', I.tools, '', '', 'TOOLS']];
  const ROW_B = [['dms', I.dms, 'QR'], ['frac', I.frac, '▪<sup>▭</sup>⁄<sub>▭</sub>'], ['sqrt', I.sqrt, '<sup>▪</sup>√▫'], ['pow', I.pow, '▪<sup>−1</sup>'], ['sq', I.sq, 'log<sub>▪</sub>▫'], ['log', 'log', 'ln', 'word']];
  const ROW_C = [['ans', 'Ans', 'PreAns', 'word'], ['sin', 'sin', 'sin<sup>−1</sup>', 'word'], ['cos', 'cos', 'cos<sup>−1</sup>', 'word'], ['tan', 'tan', 'tan<sup>−1</sup>', 'word'], ['lp', '(', '='], ['rp', ')', ',']];
  const NUM_ROWS = [
    [['7', '7', '<i>π</i>'], ['8', '8', '∠'], ['9', '9', '<i>i</i>'], ['del', I.del, 'INS'], ['ac', 'AC', '<span class="offpill">OFF</span>']],
    [['4', '4', 'A'], ['5', '5', 'B'], ['6', '6', 'C'], ['mul', '×', '<i>e</i>', 'op'], ['div', '÷', '<i>e</i><sup>▪</sup>', 'op']],
    [['1', '1', 'D'], ['2', '2', 'E'], ['3', '3', 'F'], ['add', '+', '÷R', 'op'], ['sub', '−', '(−)', 'op']],
    [['0', '0', '<i>x</i>'], ['.', '.', '<i>y</i>'], ['exp', '×10<sup>▪</sup>', '<i>z</i>'], ['format', I.format, '↻'], ['exe', '=', 'S+', 'op']],
  ];
  // 物理キー（SHIFTなし／あり）→ 論理キー
  const PHYS = { log: 'log' };
  const PHYS_S = {
    x: 'fx', dms: 'S-format', frac: 'S-frac', sqrt: 'S-pow', pow: 'inv', sq: 'logb', log: 'ln', ans: 'S-sub',
    sin: 'S-sin', cos: 'S-cos', tan: 'S-tan', lp: 'S-x', rp: 'S-rp', 7: 'S-exp', 8: 'S-neg', 9: 'S-dms', del: 'S-del', ac: 'S-ac',
    4: 'var:A', 5: 'var:B', 6: 'var:C', mul: 'S-ans', div: 'S-ln', 1: 'var:D', 2: 'var:E', 3: 'var:F', add: 'S-div', sub: 'neg',
    0: 'var:x', '.': 'var:y', exp: 'var:z', format: 'S⇔D', exe: 'S-exe', catalog: 'catalog', tools: 'tools', variable: 'variable',
    home: 'home', settings: 'settings', back: 'back', ok: 'ok', up: 'up', down: 'down', left: 'left', right: 'right', pgup: 'pgup', pgdn: 'pgdn', on: 'on',
  };
  C.translateKey = (k, shift) => (shift ? (PHYS_S[k] || 'S-' + k) : (PHYS[k] || k));

  function keyHtml(def) {
    if (!def) return '<div class="kw"></div>';
    const [id, lbl, sl, kcls, top] = def;
    const label = top ? '<span class="tl">' + top + '</span>' : '<span class="sl">' + (sl ? sl + '<span class="hook"></span>' : '') + '</span>';
    return '<div class="kw">' + label + '<button type="button" class="k ' + (kcls || '') + '" data-k="' + id + '" aria-label="' + id + '">' + lbl + '</button></div>';
  }
  const rk = (id, lbl, cls, aria) => '<button type="button" class="k round ' + (cls || '') + '" data-k="' + id + '" aria-label="' + aria + '">' + lbl + '</button>';
  function buildKeys() {
    const top = '<div class="top">' +
      '<div class="tc"><span class="tl">ON</span>' + rk('on', '<span class="knob"></span>', 'on', 'ON') + '<span class="tl">SETTINGS</span>' + rk('settings', I.settings, '', 'SETTINGS') + '</div>' +
      '<div class="tc"><span class="tl">HOME</span>' + rk('home', I.home, '', 'HOME') + '<span class="tl"></span>' + rk('back', I.back, '', 'BACK') + '</div>' +
      '<div class="pad"><button type="button" class="up" data-k="up" aria-label="上">' + I.up + '</button><button type="button" class="left" data-k="left" aria-label="左">' + I.left + '</button><button type="button" class="ok" data-k="ok">OK</button><button type="button" class="right" data-k="right" aria-label="右">' + I.right + '</button><button type="button" class="down" data-k="down" aria-label="下">' + I.down + '</button></div>' +
      '<div class="pg"><button type="button" data-k="pgup" aria-label="前のページ">' + I.pgup + '</button><button type="button" data-k="pgdn" aria-label="次のページ">' + I.pgdn + '</button></div>' +
      '</div>';
    const row = (r) => '<div class="fn">' + r.map((k) => keyHtml(k)).join('') + '</div>';
    let nm = '<div class="num">'; for (const r of NUM_ROWS) for (const k of r) nm += keyHtml(k); nm += '</div>';
    document.getElementById('keys').innerHTML = top + row(ROW_A) + row(ROW_B) + row(ROW_C) + nm;
  }

  // ===== 画面に合わせて本体を拡大縮小 =====
  function fit() {
    const dev = document.getElementById('device'), box = document.getElementById('fit');
    if (!dev || !box) return;
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
    const full = vw < 560 && vh / vw > 1.35;   // スマホ縦持ち
    document.body.classList.toggle('full', full);
    dev.style.height = ''; dev.style.setProperty('--lcd-h', '150px');
    const w = dev.offsetWidth, natural = dev.offsetHeight;
    let sc;
    if (full) {
      sc = vw / w;
      const designH = vh / sc;
      if (designH >= natural) {
        const extra = designH - natural;
        dev.style.setProperty('--lcd-h', Math.round(150 + Math.min(46, extra * 0.4)) + 'px');
        dev.style.height = designH + 'px';
      } else sc = vh / natural;
      box.style.width = vw + 'px';
      dev.style.left = Math.max(0, (vw - w * sc) / 2) + 'px';
    } else {
      const cs = getComputedStyle(box.parentElement);
      const availW = vw - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const availH = vh - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      sc = Math.max(0.5, Math.min(availW / w, availH / natural, 1.45));
      box.style.width = w * sc + 'px'; dev.style.left = '0px';
    }
    dev.style.transform = 'scale(' + sc + ')';
    box.style.height = dev.offsetHeight * sc + 'px';
  }
  C.fit = fit;

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
      { label: '使い方', action: () => { C.popAll(); document.getElementById('helpBtn').click(); } },
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
        if (!G.power) return;
    const top = C.top();
    let body = '';
    try { body = top ? top.render() : G.app.render(); } catch (e) { console.error(e); body = '<div class="msg">表示エラー</div>'; }
    document.getElementById('screen').innerHTML = body;
    document.getElementById('status').innerHTML = statusHtml(top);
    const sk = document.querySelector('.k.shift'); if (sk) sk.classList.toggle('on-shift', !!G.shift);
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
  // 物理キー押下（画面上のボタン）
  C.press = function (k) {
    if (k === 'shift' || k === 'on') return C.pressLogical(k);
    const sh = G.shift; if (sh) G.shift = false;
    return C.pressLogical(C.translateKey(k, sh));
  };
  // 論理キー押下
  C.pressLogical = function (k) {
    resetApo();
    if (k === 'on') { if (!G.power) { G.power = true; G.shift = false; C.render(); return; } G.shift = false; C.render(); return; }
    if (!G.power) return;
    if (k === 'shift') { G.shift = !G.shift; C.render(); return; }
    let key = k;
    if (G.shift && !k.startsWith('S-')) { key = 'S-' + k; G.shift = false; }
    if (key === 'S-ac') { G.power = false; G.ov.length = 0; C.save(); C.render(); return; }
    if (key === 'S-on') key = 'on';
    try {
      const top = C.top();
      if (key === 'pgup' || key === 'pgdn') key = top instanceof C.Menu ? (key === 'pgup' ? 'left' : 'right') : (key === 'pgup' ? 'up' : 'down');
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
      if (ev.type === 'touchstart') { lastTouch = Date.now(); ev.preventDefault(); b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 110); try { if (navigator.vibrate) navigator.vibrate(7); } catch (e) { /* */ } }
      else if (Date.now() - lastTouch < 600) return;
      C.press(b.dataset.k);
    };
    keys.addEventListener('touchstart', handler, { passive: false });
    keys.addEventListener('click', handler);
    const KB = {
      Enter: 'exe', '=': 'exe', Backspace: 'del', Delete: 'ac', Escape: 'back', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '(': 'lp', ')': 'rp', '^': 'pow', '.': '.', ',': 'S-rp', '%': 'S-lp', '!': 'S-inv',
      s: 'sin', c: 'cos', t: 'tan', l: 'ln', L: 'log', g: 'logb', S: 'shift', r: 'sqrt', x: 'x', e: 'exp', p: 'S-exp', a: 'ans', f: 'frac', i: 'S-dms', h: 'home', o: 'ok',
      v: 'variable', k: 'catalog', T: 'tools', F: 'format', m: 'settings', n: 'neg', q: 'sq', Tab: 'shift', b: 'back', d: 'dms', u: 'fx', E: 'S-exe',
    };
    // 使い方シート
    const sheet = document.getElementById('help');
    const openHelp = () => { sheet.hidden = false; sheet.querySelector('.close').focus(); };
    const closeHelp = () => { sheet.hidden = true; };
    document.getElementById('helpBtn').addEventListener('click', openHelp);
    sheet.querySelector('.close').addEventListener('click', closeHelp);
    sheet.addEventListener('click', (ev) => { if (ev.target === sheet) closeHelp(); });
    window.addEventListener('resize', fit);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    document.addEventListener('keydown', (ev) => {
      if (!sheet.hidden) { if (ev.key === 'Escape') { ev.preventDefault(); closeHelp(); } return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      let k = KB[ev.key];
      if (/^[0-9]$/.test(ev.key)) k = ev.key;
      if (!k) return;
      ev.preventDefault();
      C.pressLogical(k);
      const btn = document.querySelector('[data-k="' + CSS.escape(k) + '"]'); if (btn) { btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 90); }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    try { const th = localStorage.getItem('kscalc.theme'); if (th && th !== 'auto') document.documentElement.dataset.theme = th; } catch (e) { /* */ }
    buildKeys(); bindUI(); fit();
    const last = C.load();
    for (const a of C.APPS) if (a.init) a.init();
    G.app = appById(last) || C.APPS[0];
    G.app.enter(true);
    resetApo();
    C.render();
  });
})(window.C = window.C || {});
