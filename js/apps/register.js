/* 計算アプリの登録（HOME 画面の並び順） */
(function (C) {
  'use strict';
  const L = C.lateApps;
  // 基本計算は basic.js で先頭に登録済み
  C.APPS.push(L.stat, L.dist, L.sheet, L.table, L.eq, L.ineq, L.cplx, L.base, L.matrix, L.vector, L.ratio, L.mbox);
})(window.C = window.C || {});
