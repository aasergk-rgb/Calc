/* 単位換算（NIST SP811 / 計量法準拠の換算係数） */
(function (C) {
  'use strict';
  const E = C.E;
  // 各カテゴリの基準単位への係数
  const F = {
    len: { cm: 0.01, in: 0.0254, m: 1, ft: 0.3048, yd: 0.9144, km: 1000, mile: 1609.344, 'n mile': 1852, pc: 3.0856775814913673e16, 'Å': 1e-10, fm: 1e-15, ch: 20.1168, ua: 149597870700, 'l.y.': 9.4607304725808e15, mil: 2.54e-5, fath: 1.8288, mm: 0.001,
      '尺': 10 / 33, '寸': 1 / 33, '分': 1 / 330, '厘': 1 / 3300, '毛': 1 / 33000, '間': 20 / 11, '町': 1200 / 11, '里': 43200 / 11, '海里': 1852, '丈': 100 / 33 },
    area: { acre: 4046.8564224, mile2: 2589988.110336, m2: 1, b: 1e-28, a: 100, ha: 10000, cm2: 1e-4, ft2: 0.09290304, in2: 6.4516e-4, km2: 1e6,
      '坪': 400 / 121, '畝': 12000 / 121, '反': 120000 / 121, '町': 1200000 / 121, '勺': 4 / 121, '合': 40 / 121, '歩': 400 / 121 },
    vol: { 'gal(UK)': 4.54609e-3, bu: 0.03523907016688, L: 1e-3, 'gal(US)': 3.785411784e-3, m3: 1, bbl: 0.158987294928, mL: 1e-6, 'fl oz(US)': 2.95735295625e-5, 'fl oz(UK)': 2.84130625e-5,
      ton: 2.8316846592, ft3: 0.028316846592, in3: 1.6387064e-5, cm3: 1e-6, '升': 2401 / 1331000, '斗': 24010 / 1331000, '石': 240100 / 1331000, '勺': 24.01 / 1331000, '合': 240.1 / 1331000 },
    ang: { r: 2 * Math.PI, rad: 1 },
    mass: { oz: 0.028349523125, lb: 0.45359237, 'ton(long)': 1016.0469088, 'ton(short)': 907.18474, g: 1e-3, kg: 1, mton: 1000, mg: 1e-6, mcarat: 2e-4,
      '貫': 3.75, '匁': 3.75e-3, '斤': 0.6, '分': 3.75e-4, '厘': 3.75e-5, '毛': 3.75e-6 },
    time: { 't-yr': 31556925.9747, s: 1, min: 60, h: 3600, day: 86400 },
    speed: { 'm/s': 1, 'km/h': 1 / 3.6, 'mile/h': 0.44704, knot: 1852 / 3600 },
    acc: { Gal: 0.01, 'm/s2': 1 },
    mom: { 'N・m': 1, 'dyn・cm': 1e-7 },
    force: { N: 1, dyn: 1e-5, lbf: 4.4482216152605, kgf: 9.80665 },
    pres: { Pa: 1, kPa: 1000, atm: 101325, mmHg: 133.322387415, 'kgf/cm2': 98066.5, 'lbf/in2': 6894.757293168, bar: 1e5, 'dyn/cm2': 0.1, cmH2O: 98.0665, inHg: 3386.388640341 },
    energy: { J: 1, 'kgf・m': 9.80665, cal: 4.1855, erg: 1e-7, eV: 1.602176634e-19, Btu: 1055.05585262, calIT: 4.1868, calth: 4.184, 'W・h': 3600 },
    power: { hp: 745.69987158227022, kW: 1000 },
    heat: { 'Btu/h': 0.29307107017222, W: 1 },
    sheat: { 'calth/(g・K)': 4184, 'J/(kg・K)': 1 },
    visc: { P: 0.1, 'Pa・s': 1 },
    kvisc: { St: 1e-4, 'm2/s': 1 },
    mag: { G: 1e-4, T: 1, 'γ': 1e-9 },
    magH: { Oe: 1000 / (4 * Math.PI), 'A/m': 1 },
    flux: { Mx: 1e-8, Wb: 1 },
    lum: { sb: 1e4, 'cd/m2': 1 },
    illu: { ph: 1e4, lx: 1 },
    act: { Ci: 3.7e10, Bq: 1 },
    dose: { rad: 0.01, Gy: 1 },
    deq: { rem: 0.01, Sv: 1 },
    expo: { R: 2.58e-4, 'C/kg': 1 },
  };
  // メニュー構成（取扱説明書のリファレンスシートに準拠）
  const L = (sub, list) => [sub, list];
  const MENU = [
    ['長さ', 'len', [
      L('m…', ['cm>in', 'm>ft', 'm>yd', 'km>mile', 'm>n mile', 'km>pc', 'm>Å', 'm>fm', 'm>ch', 'm>ua', 'm>l.y.', 'm>mil', 'm>fath', 'm>尺', 'cm>寸', 'mm>分', 'm>間', 'm>町', 'km>里', 'km>海里', 'm>丈', 'mm>毛', 'mm>厘']),
      L('in…', ['in>cm', 'in>ft', 'in>yd', 'in>ch', 'in>mil', 'in>fath']),
      L('ft…', ['ft>m', 'ft>in', 'ft>yd', 'ft>mile', 'ft>n mile', 'ft>ch', 'ft>fath']),
      L('yd…', ['yd>m', 'yd>in', 'yd>ft', 'yd>mile', 'yd>ch', 'yd>fath']),
      L('mile…', ['mile>km', 'mile>ft', 'mile>yd', 'mile>ch']),
      L('ch…', ['ch>m', 'ch>in', 'ch>ft', 'ch>yd', 'ch>mile']),
      L('fath…', ['fath>m', 'fath>in', 'fath>ft', 'fath>yd']),
      L('n mile…', ['n mile>m', 'n mile>ft']),
      L('mil…', ['mil>m', 'mil>in']),
      L('尺…', ['尺>m', '尺>寸', '尺>間', '尺>町', '尺>海里', '尺>丈']),
      L('間…', ['間>m', '間>尺', '間>町', '間>里']),
      L('町…', ['町>m', '町>尺', '町>間', '町>里']),
      L('里…', ['里>km', '里>間', '里>町']),
      L('寸…', ['寸>cm', '寸>尺']),
      L('海里…', ['海里>km', '海里>尺']),
      L('丈…', ['丈>m', '丈>尺']),
      L('その他', ['pc>km', 'Å>m', 'fm>m', 'ua>m', 'l.y.>m', '分>mm', '毛>mm', '厘>mm']),
    ]],
    ['面積', 'area', [
      L('acre…', ['acre>m2', 'acre>mile2']),
      L('m²…', ['m2>acre', 'm2>b', 'm2>a', 'm2>ha', 'cm2>ft2', 'cm2>in2', 'km2>mile2', 'm2>坪', 'm2>畝', 'm2>反', 'm2>町', 'm2>勺', 'm2>合', 'm2>歩']),
      L('a…', ['a>m2', 'a>ha']),
      L('ha…', ['ha>m2', 'ha>a']),
      L('mile²…', ['mile2>km2', 'mile2>acre']),
      L('坪…', ['坪>m2', '坪>畝']),
      L('畝…', ['畝>m2', '畝>坪', '畝>反']),
      L('反…', ['反>m2', '反>畝', '反>町']),
      L('町…', ['町>m2', '町>反']),
      L('その他', ['b>m2', 'ft2>cm2', 'in2>cm2', '勺>m2', '合>m2', '歩>m2']),
    ]],
    ['体積', 'vol', [
      L('gal(UK)…', ['gal(UK)>L', 'gal(UK)>bu']),
      L('L…', ['L>gal(US)', 'L>gal(UK)', 'L>m3', 'L>bu', 'L>bbl', 'mL>fl oz(US)', 'mL>fl oz(UK)', 'L>升', 'L>斗', 'L>石', 'L>勺', 'L>合']),
      L('m³…', ['m3>L', 'm3>ton', 'm3>ft3', 'm3>in3', 'cm3>合']),
      L('bu…', ['bu>L', 'bu>gal(UK)']),
      L('升…', ['升>L', '升>合', '升>斗']),
      L('合…', ['合>cm3', '合>L', '合>升', '合>勺']),
      L('斗…', ['斗>L', '斗>升', '斗>石']),
      L('石…', ['石>L', '石>斗']),
      L('勺…', ['勺>L', '勺>合']),
      L('その他', ['gal(US)>L', 'bbl>L', 'ton>m3', 'fl oz(US)>mL', 'fl oz(UK)>mL', 'ft3>m3', 'in3>m3']),
    ]],
    ['平面角', 'ang', [L('', ['r>rad', 'rad>r'])]],
    ['質量', 'mass', [
      L('oz…', ['oz>g', 'oz>lb', 'oz>ton(long)', 'oz>ton(short)']),
      L('g…', ['g>oz', 'kg>lb', 'kg>mton', 'kg>ton(long)', 'kg>ton(short)', 'mg>mcarat', 'kg>貫', 'g>匁', 'g>斤', 'g>毛', 'g>厘', 'g>分']),
      L('lb…', ['lb>kg', 'lb>oz', 'lb>ton(long)', 'lb>ton(short)']),
      L('ton(long)…', ['ton(long)>kg', 'ton(long)>oz', 'ton(long)>lb']),
      L('ton(short)…', ['ton(short)>kg', 'ton(short)>oz', 'ton(short)>lb']),
      L('貫…', ['貫>kg', '貫>匁', '貫>斤']),
      L('斤…', ['斤>g', '斤>貫', '斤>匁']),
      L('匁…', ['匁>g', '匁>貫', '匁>斤']),
      L('その他', ['mton>kg', 'mcarat>mg', '毛>g', '厘>g', '分>g']),
    ]],
    ['時間', 'time', [L('s…', ['s>t-yr', 's>min', 's>h', 's>day']), L('その他', ['t-yr>s', 'min>s', 'h>s', 'day>s'])]],
    ['速度', 'speed', [L('m/s…', ['m/s>km/h', 'm/s>mile/h', 'm/s>knot']), L('その他', ['km/h>m/s', 'mile/h>m/s', 'knot>m/s'])]],
    ['加速度', 'acc', [L('', ['Gal>m/s2', 'm/s2>Gal'])]],
    ['力のモーメント', 'mom', [L('', ['N・m>dyn・cm', 'dyn・cm>N・m'])]],
    ['力', 'force', [L('N…', ['N>dyn', 'N>lbf', 'N>kgf']), L('その他', ['dyn>N', 'lbf>N', 'kgf>N'])]],
    ['圧力', 'pres', [
      L('Pa…', ['Pa>atm', 'Pa>mmHg', 'Pa>kgf/cm2', 'kPa>lbf/in2', 'Pa>bar', 'Pa>dyn/cm2', 'Pa>lbf/in2', 'Pa>cmH2O', 'Pa>inHg']),
      L('その他', ['atm>Pa', 'mmHg>Pa', 'kgf/cm2>Pa', 'lbf/in2>kPa', 'bar>Pa', 'dyn/cm2>Pa', 'lbf/in2>Pa', 'cmH2O>Pa', 'inHg>Pa']),
    ]],
    ['エネルギー', 'energy', [
      L('J…', ['J>kgf・m', 'J>cal', 'J>erg', 'J>eV', 'J>Btu', 'J>calIT', 'J>calth', 'J>W・h']),
      L('その他', ['kgf・m>J', 'cal>J', 'erg>J', 'eV>J', 'Btu>J', 'calIT>J', 'calth>J', 'W・h>J']),
    ]],
    ['仕事率', 'power', [L('', ['hp>kW', 'kW>hp'])]],
    ['熱流', 'heat', [L('', ['Btu/h>W', 'W>Btu/h'])]],
    ['温度', 'temp', [L('', ['°F>°C', '°C>°F'])]],
    ['比熱', 'sheat', [L('', ['calth/(g・K)>J/(kg・K)', 'J/(kg・K)>calth/(g・K)'])]],
    ['粘度', 'visc', [L('', ['P>Pa・s', 'Pa・s>P'])]],
    ['動粘度', 'kvisc', [L('', ['St>m2/s', 'm2/s>St'])]],
    ['磁気', 'magx', [L('', ['G>T', 'T>G', 'Oe>A/m', 'A/m>Oe', 'Mx>Wb', 'Wb>Mx', 'γ>T', 'T>γ'])]],
    ['光', 'light', [L('', ['sb>cd/m2', 'cd/m2>sb', 'ph>lx', 'lx>ph'])]],
    ['放射線に関する量', 'rad', [L('', ['Ci>Bq', 'Bq>Ci', 'rad>Gy', 'Gy>rad', 'rem>Sv', 'Sv>rem', 'R>C/kg', 'C/kg>R'])]],
  ];
  const MULTI = { magx: ['mag', 'magH', 'flux'], light: ['lum', 'illu'], rad: ['act', 'dose', 'deq', 'expo'] };
  const disp = (u) => u.replace('m2', 'm²').replace('m3', 'm³').replace('ft2', 'ft²').replace('in2', 'in²').replace('ft3', 'ft³').replace('in3', 'in³').replace('mile2', 'mile²').replace('/s2', '/s²').replace('cm2', 'cm²').replace('cmH2O', 'cmH₂O');

  C.UNIT_MENU = MENU;
  C.UNIT_BY_KEY = {};
  for (const [, cat, subs] of MENU) for (const [, list] of subs) for (const key of list) {
    const [from, to] = key.split('>');
    let fn;
    if (cat === 'temp') {
      fn = from === '°F' ? (x) => E.div(E.mul(E.sub(x, E.Q(32)), E.Q(5)), E.Q(9)) : (x) => E.add(E.div(E.mul(x, E.Q(9)), E.Q(5)), E.Q(32));
    } else {
      const tables = MULTI[cat] ? MULTI[cat].map((k) => F[k]) : [F[cat]];
      const tbl = tables.find((t) => t[from] !== undefined && t[to] !== undefined);
      if (!tbl) { console.warn('unit missing', key); continue; }
      const r = tbl[from] / tbl[to];
      fn = (x) => E.toNum(x) * r;
    }
    C.UNIT_BY_KEY[key] = { key, from: disp(from), to: disp(to), fn };
  }
})(window.C = window.C || {});
