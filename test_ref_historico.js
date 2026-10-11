// Pruebas de apps_script_11_oct_26_ref_historico.js con un Sheet simulado (usa una copia real de Hoja1).
// Uso: node test_ref_historico.js <hoja1_filas.json>
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const FILAS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const SRC = fs.readFileSync(__dirname + '/apps_script_11_oct_26_ref_historico.js', 'utf8');
let ok = 0, fail = 0;
function t(n, f) { try { f(); ok++; console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n      ' + e.message.split('\n')[0]); } }

function nuevoEntorno(datos, opciones) {
  opciones = opciones || {};
  const hojas = {};
  function Hoja(nombre, matriz, maxCols) {
    this.nombre = nombre; this.m = matriz; this.maxCols = maxCols || (matriz[0] ? matriz[0].length : 1);
  }
  Hoja.prototype.getLastRow = function () { let u = 0; this.m.forEach((f, i) => { if (f.some(x => String(x) !== '')) u = i + 1; }); return u; };
  Hoja.prototype.getMaxColumns = function () { return this.maxCols; };
  Hoja.prototype.insertColumnsAfter = function (c, n) { this.maxCols += n; this.m.forEach(f => { while (f.length < this.maxCols) f.push(''); }); };
  Hoja.prototype.clear = function () { this.m.length = 0; };
  Hoja.prototype.getRange = function (r, c, nr, nc) {
    const h = this; nr = nr || 1; nc = nc || 1;
    return {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = h.m[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(f[c - 1 + j] === undefined ? '' : f[c - 1 + j]); o.push(x); } return o; },
      setValues(v) { for (let i = 0; i < nr; i++) { while (h.m.length < r + i) h.m.push([]); const f = h.m[r - 1 + i]; for (let j = 0; j < nc; j++) { while (f.length < c + j) f.push(''); f[c - 1 + j] = v[i][j]; } } if (c - 1 + nc > h.maxCols) h.maxCols = c - 1 + nc; }
    };
  };
  hojas['Hoja1'] = new Hoja('Hoja1', datos.map(f => f.slice()), 24);
  const ss = {
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = new Hoja(n, [], 7)),
    getSpreadsheetTimeZone: () => 'America/Chihuahua'
  };
  const ctx = { SpreadsheetApp: { getActiveSpreadsheet: () => ss }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, Logger: { log() {} }, console, Date, Math, Object, String, Number, isNaN, parseInt };
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  return { ctx, hojas, ss };
}
const copia = () => FILAS.map(f => f.slice());
const col = (m, c) => m.slice(1).map(f => String(f[c - 1] === undefined ? '' : f[c - 1]));

console.log('\n── Ref histórico ──');
const orig = copia();
const { ctx, hojas } = nuevoEntorno(orig);

t('F1 PRUEBA no modifica Hoja1', () => {
  const antes = JSON.stringify(hojas.Hoja1.m);
  const r = ctx.refHistorico_PRUEBA();
  assert.strictEqual(JSON.stringify(hojas.Hoja1.m), antes);
  assert.strictEqual(r.totalBloques, 1966); assert.strictEqual(r.yaTienen, 67); assert.strictEqual(r.nuevas, 1899);
});
t('F2 la vista previa lista las 1,899 cotizaciones con su Ref', () => {
  const v = hojas['Vista previa Ref histórico'].m;
  assert.strictEqual(v.length, 1900); assert.strictEqual(v[1][0], 'SE ESCRIBIRÍA');
});
t('F3 PRUEBA es determinista (dos corridas dan los mismos Ref)', () => {
  const a = hojas['Vista previa Ref histórico'].m.map(f => f[5]).join();
  ctx.refHistorico_PRUEBA();
  assert.strictEqual(hojas['Vista previa Ref histórico'].m.map(f => f[5]).join(), a);
});
t('F4 formato MMDD-XXXXX, MMDD coincide con la fecha (día/mes), sin repetidos ni choques con los existentes', () => {
  const v = hojas['Vista previa Ref histórico'].m.slice(1);
  const existentes = new Set(col(orig, 19).filter(Boolean));
  const vistos = new Set();
  v.forEach(f => {
    assert.ok(/^\d{4}-[A-Z2-9]{5}$/.test(f[5]), 'formato ' + f[5]);
    const m = /^(\d+)\/(\d+)\//.exec(f[3]);
    assert.strictEqual(f[5].slice(0, 4), ('0' + m[2]).slice(-2) + ('0' + m[1]).slice(-2), 'MMDD ' + f[3] + ' ' + f[5]);
    assert.ok(!vistos.has(f[5]) && !existentes.has(f[5]), 'repetido ' + f[5]); vistos.add(f[5]);
  });
});
t('F5 APLICAR escribe Ref=Grupo y Versión 1 en TODOS los renglones de cada cotización', () => {
  const r = ctx.refHistorico_APLICAR();
  assert.ok(r.escritas > 0 && !r.abortado, r.resumen);
  const m = hojas.Hoja1.m;
  let starts = [];
  for (let i = 1; i < m.length; i++) if (String(m[i][0]).trim()) starts.push(i);
  starts.forEach((s, k) => {
    const fin = k + 1 < starts.length ? starts[k + 1] : m.length;
    const ref = String(m[s][18]); assert.ok(ref, 'sin Ref fila ' + (s + 1));
    let teniaRef = false; for (let i = s; i < fin; i++) if (String(orig[i][18]).trim() || String(orig[i][19]).trim()) teniaRef = true;
    for (let i = s; i < fin; i++) {
      assert.strictEqual(String(m[i][18]), ref, 'Ref distinto en fila ' + (i + 1));
      if (!teniaRef) { assert.strictEqual(String(m[i][19]), ref, 'Grupo fila ' + (i + 1)); assert.strictEqual(String(m[i][20]), '1', 'Versión fila ' + (i + 1)); }
    }
  });
  assert.strictEqual(r.cotizaciones, 1899);
});
t('F6 las 67 cotizaciones que ya tenían Ref quedan IGUALES; ninguna otra columna cambió', () => {
  const m = hojas.Hoja1.m;
  for (let i = 0; i < orig.length; i++) for (let c = 0; c < 24; c++) {
    if (c >= 18 && c <= 20 && !String(orig[i][c]).trim() && i > 0) continue;
    assert.strictEqual(String(m[i][c] === undefined ? '' : m[i][c]), String(orig[i][c]), 'fila ' + (i + 1) + ' col ' + (c + 1));
  }
});
t('F7 los folios EXPCARE (columna R) y Vigente (V) no se tocaron', () => {
  assert.deepStrictEqual(col(hojas.Hoja1.m, 18), col(orig, 18));
  assert.deepStrictEqual(col(hojas.Hoja1.m, 22), col(orig, 22));
});
t('F8 la fila 1220 (#ERROR!, sin fecha) queda en la misma cotización que la 1219', () => {
  const m = hojas.Hoja1.m; assert.strictEqual(String(m[1219][18]), String(m[1218][18]));
});
t('F9 segunda corrida de APLICAR no escribe nada más', () => {
  const r = ctx.refHistorico_APLICAR(); assert.strictEqual(r.escritas, 0);
});
t('F10 DESHACER deja la hoja exactamente como estaba', () => {
  const r = ctx.refHistorico_DESHACER();
  assert.strictEqual(r.omitidas, 0);
  const m = hojas.Hoja1.m;
  for (let i = 0; i < orig.length; i++) for (let c = 0; c < 24; c++)
    assert.strictEqual(String(m[i][c] === undefined ? '' : m[i][c]), String(orig[i][c]), 'fila ' + (i + 1) + ' col ' + (c + 1));
});
t('F11 APLICAR sin PRUEBA previa no escribe nada', () => {
  const e = nuevoEntorno(copia()); const r = e.ctx.refHistorico_APLICAR();
  assert.strictEqual(r.escritas, 0); assert.strictEqual(JSON.stringify(e.hojas.Hoja1.m), JSON.stringify(copia()));
});
t('F12 si la hoja cambia entre la PRUEBA y APLICAR, aborta y no escribe', () => {
  const e = nuevoEntorno(copia()); e.ctx.refHistorico_PRUEBA();
  e.hojas.Hoja1.m.splice(5, 0, new Array(24).fill('')); // se inserta un renglón vacío arriba: todo se recorre
  const antes = JSON.stringify(e.hojas.Hoja1.m);
  const r = e.ctx.refHistorico_APLICAR();
  assert.ok(r.abortado); assert.strictEqual(JSON.stringify(e.hojas.Hoja1.m), antes);
});
t('F13 nunca pisa un valor existente en S, T o U', () => {
  const d = copia(); d[10][18] = 'MANUAL-1';   // un renglón suelto de una cotización sin Ref ya trae algo
  const e = nuevoEntorno(d); e.ctx.refHistorico_PRUEBA();
  const r = e.ctx.refHistorico_APLICAR();
  assert.strictEqual(String(e.hojas.Hoja1.m[10][18]), 'MANUAL-1');
});
t('F14 acepta fechas tipo Date y texto', () => {
  assert.strictEqual(ctx.refHist_mmdd_('17/7/2026 10:53 a.m.'), '0717');
  assert.strictEqual(ctx.refHist_mmdd_('8/10/2026 11:02 a.m.'), '1008');
  assert.strictEqual(ctx.refHist_mmdd_(new Date(2026, 6, 17, 10, 53)), '0717');
  assert.strictEqual(ctx.refHist_mmdd_('basura'), null);
});
t('F15 si el Sheet no tiene los encabezados S–V, APLICAR los pone', () => {
  const d = copia(); d[0][18] = d[0][19] = d[0][20] = d[0][21] = '';
  for (let i = 1; i < d.length; i++) { d[i][18] = d[i][19] = d[i][20] = d[i][21] = ''; }
  const e = nuevoEntorno(d); e.ctx.refHistorico_PRUEBA(); e.ctx.refHistorico_APLICAR();
  assert.deepStrictEqual(e.hojas.Hoja1.m[0].slice(18, 22), ['Ref', 'Grupo', 'Versión', 'Vigente']);
});
console.log('\n' + ok + ' pasaron, ' + fail + ' fallaron');
process.exit(fail ? 1 : 0);
