// ── TEST SUITE — Apps Script: columna "Marca" (W) en Hoja1 ─────────────────────────────
// Archivo: test_apps_script_opciones.js
// Uso: node test_apps_script_opciones.js [script_nuevo]
// Varias OPCIONES de llantas: total por opción en la columna P (primer renglón de cada opción) y número de opción en la columna X.
// Lo demás debe quedar IDÉNTICO al script que ya está en uso.
const fs = require('fs'), vm = require('vm');
const NUEVO = process.argv[2] || './apps_script_9_oct_26_opciones.js';
const VIGENTE = './apps_script_8_oct_26_marca_columna.js';   // el que ya está en uso
const ANTERIOR = './apps_script_3_ago_26_reporte_diario_4.js';
const CSV = process.argv[3] || '';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); failed++; } }

function hojaFalsa(nombre, grid, cols) {
  const h = { nombre, grid: grid || [], maxCols: cols || 26, bordes: [],
    getMaxColumns() { return h.maxCols; }, insertColumnsAfter(p, n) { h.maxCols += n; },
    appendRow(f) { h.grid.push(f.slice()); }, getLastRow() { return h.grid.length; }, clear() { h.grid.length = 0; },
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1;
      if (c - 1 + nc > h.maxCols) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      return {
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = []; for (let j = 0; j < nc; j++) { const x = (h.grid[r - 1 + i] || [])[c - 1 + j]; f.push(x === undefined ? '' : x); } o.push(f); } return o; },
        setValues(v) { for (let i = 0; i < nr; i++) { while (h.grid.length < r + i) h.grid.push([]); const f = h.grid[r - 1 + i]; for (let j = 0; j < nc; j++) { while (f.length < c - 1 + j) f.push(''); f[c - 1 + j] = v[i][j]; } } },
        setValue(v) { while (h.grid.length < r) h.grid.push([]); const f = h.grid[r - 1]; while (f.length < c - 1) f.push(''); f[c - 1] = v; },
        setBorder() { h.bordes.push({ r, c, nr, nc }); } }; } };
  return h;
}
function libro(ruta, grid, cols) {
  const hojas = { Hoja1: hojaFalsa('Hoja1', grid, cols) };
  const ss = { hojas, getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hojaFalsa(n)), getActiveSheet: () => hojas.Hoja1 };
  const ctx = { console, Logger: { log() {} }, Utilities: { formatDate: () => '', base64Decode: () => [], newBlob: () => ({}) }, Session: { getScriptTimeZone: () => 'America/Chihuahua' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss }, ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ contenido: t, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, DriveApp: {}, MailApp: {}, GmailApp: {}, PropertiesService: {} };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx);
  return { ss, ctx, hojas, hoja: hojas.Hoja1 };
}
const enviar = (ctx, c) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(c) } }).contenido);
function cot(extra, items) {
  items = items || [
    { tipo: 'Llantas', proveedor: 'AYALA', noParte: 'AY09329', producto: 'BFGOODRICH 235/75R15 108T XL', marca: 'BFGOODRICH', cant: 4, costo: '1500', margen: '25%', precio: '2000', subtotal: '8000' },
    { tipo: 'Llantas', proveedor: '', noParte: '', producto: 'Montaje', cant: 4, costo: '', margen: '', precio: '85', subtotal: '340' }];
  return Object.assign({ action: 'saveCotizacion', fecha: '8/10/2026 08:00', asesor: 'Ana', cliente: 'Cliente Prueba', telefono: '6140000000', vehiculo: 'Nissan Sentra', origen: 'WhatsApp', total: '8340', folio: '', items }, extra || {});
}


function llantaOp(op, marca, cve, precio) { return { tipo: 'Llantas', proveedor: 'AYALA', noParte: cve, producto: marca + ' 205/55R16', marca, cant: 4, costo: '1000', margen: '25%', precio: String(precio), subtotal: String(precio * 4), opcion: op }; }
function cotOpc(extra) {
  const items = [llantaOp(1, 'MICHELIN', 'AY1', 2000), llantaOp(2, 'HANKOOK', 'AY2', 1500),
    { tipo: 'Llantas', proveedor: '', noParte: '', producto: 'Alineación', cant: 1, precio: '500', subtotal: '500' }];
  return cot(Object.assign({ total: '', opciones: [{ opcion: 1, marca: 'MICHELIN', total: '8500.00' }, { opcion: 2, marca: 'HANKOOK', total: '6500.00' }] }, extra || {}), items);
}

console.log('\n=== AS-O1. Cotización con varias opciones ===');
{
  const h = libro(NUEVO, [['Fecha']]);
  const r = enviar(h.ctx, cotOpc({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  const g = h.hoja.grid;
  ok('O1 responde ok', r.status === 'ok', r);
  ok('O2 encabezados: W="Marca" y X="Opción"', g[0][22] === 'Marca' && g[0][23] === 'Opción', g[0]);
  ok('O3 cada opción trae su número en la columna X', g[1][23] === 1 && g[2][23] === 2 && g[3][23] === '', [g[1][23], g[2][23], g[3][23]]);
  ok('O4 el total de cada opción va en el primer renglón de esa opción (columna P)', g[1][15] === '8500.00' && g[2][15] === '6500.00' && g[3][15] === '', [g[1][15], g[2][15], g[3][15]]);
  ok('O5 la marca de cada opción queda en la columna W', g[1][22] === 'MICHELIN' && g[2][22] === 'HANKOOK' && g[3][22] === '');
  ok('O6 fecha, asesor, cliente y demás datos solo en el primer renglón (como siempre)', g[1][0] === '8/10/2026 08:00' && g[1][1] === 'Ana' && g[2][0] === '' && g[2][1] === '' && g[2][2] === '');
  ok('O7 los bordes cubren 24 columnas', h.hoja.bordes.length === 1 && h.hoja.bordes[0].nc === 24, h.hoja.bordes);
}
console.log('\n=== AS-O2. Lo demás no cambia ===');
{
  const hN = libro(NUEVO, [['x']]), hV = libro(VIGENTE, [['x']]);
  const c = cot({ ref: '1009-BBBBB', grupo: '1009-BBBBB', version: 1 });
  enviar(hN.ctx, c); enviar(hV.ctx, c);
  ok('O8 cotización normal (sin opciones): las primeras 23 columnas IDÉNTICAS al script en uso y X vacía', JSON.stringify(hN.hoja.grid.slice(1).map(f => f.slice(0, 23))) === JSON.stringify(hV.hoja.grid.slice(1).map(f => f.slice(0, 23))) && hN.hoja.grid.slice(1).every(f => f[23] === ''), hN.hoja.grid[1]);
  const hA = libro(NUEVO, []), hB = libro(ANTERIOR, []);
  enviar(hA.ctx, cot({ folio: 'EXPCARE-009/26' })); enviar(hB.ctx, cot({ folio: 'EXPCARE-009/26' }));
  ok('O9 sin Ref (modo anterior) sigue IDÉNTICO al script de agosto: 18 columnas', JSON.stringify(hA.hoja.grid) === JSON.stringify(hB.hoja.grid) && hA.hoja.grid[0].length === 18);
  const hO = libro(NUEVO, [['x']]), hP = libro(VIGENTE, [['x']]);
  enviar(hO.ctx, cotOpc({ ref: '1009-CCCCC', grupo: '1009-CCCCC', version: 1 })); enviar(hP.ctx, cotOpc({ ref: '1009-CCCCC', grupo: '1009-CCCCC', version: 1 }));
  const sinPX = g => g.slice(1).map(f => f.slice(0, 23).filter((_, i) => i !== 15));
  ok('O10 con opciones, todo lo demás (menos Total y X) es IDÉNTICO al script en uso', JSON.stringify(sinPX(hO.hoja.grid)) === JSON.stringify(sinPX(hP.hoja.grid)));
  const h4 = libro(NUEVO, [['x']], 22);
  const r4 = enviar(h4.ctx, cotOpc({ ref: '1009-DDDDD' }));
  ok('O11 si la hoja solo llega a la columna V se agregan solas las columnas W y X', r4.status === 'ok' && h4.hoja.maxCols === 24 && h4.hoja.grid[1][23] === 1, h4.hoja.maxCols);
}
console.log('\n=== AS-O3. Versiones: elegir una opción ===');
{
  const h = libro(NUEVO, [['x']]);
  enviar(h.ctx, cotOpc({ ref: '1009-EEEEE', grupo: '1009-EEEEE', version: 1 }));
  enviar(h.ctx, cot({ ref: '1009-FFFFF', grupo: '1009-EEEEE', version: 2, total: '8500.00' }, [llantaOp('', 'MICHELIN', 'AY1', 2000)]));
  const g = h.hoja.grid;
  const v1 = g.filter(f => f[18] === '1009-EEEEE'), v2 = g.filter(f => f[18] === '1009-FFFFF');
  ok('O12 la versión con opciones queda marcada "No" al guardar la elegida (y conserva su número de opción)', v1.length === 3 && v1.every(f => f[21] === 'No') && v1[0][23] === 1 && v1[1][23] === 2, v1.map(f => [f[21], f[23]]));
  ok('O13 la versión elegida queda vigente, sin número de opción y con su total normal', v2.length === 1 && v2[0][21] === '' && v2[0][23] === '' && v2[0][15] === '8500.00' && v2[0][22] === 'MICHELIN', v2);
}
console.log('\n=============================================');
console.log('TOTAL: ' + (passed + failed) + ' | ✅ ' + passed + ' OK | ❌ ' + failed + ' FALLIDAS');
process.exit(failed ? 1 : 0);
