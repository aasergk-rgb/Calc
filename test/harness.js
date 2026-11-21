// Node から電卓コアを読み込むためのハーネス
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, Math, BigInt, Number, JSON, Map, Set, Array, Object, String, Error, parseInt, parseFloat, isFinite };
ctx.window = ctx; vm.createContext(ctx);
const files = ['core/exact.js', 'core/values.js', 'core/editor.js', 'core/parser.js', 'core/evaluator.js', 'core/format.js', 'data/constants.js', 'data/units.js', 'data/elements.js', 'lcd.js', 'apps/more.js'];
ctx.C = { lateApps: {}, G: { s: {}, appState: {} }, APPS: [] };
for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx, { filename: f });
module.exports = ctx.C;
