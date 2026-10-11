// ── TEST — Apps Script: la Versión nunca se repite dentro del mismo Grupo (11 oct 2026) ──
// Uso: node test_apps_script_version_unica.js [script_nuevo]
const fs = require('fs'), vm = require('vm');
const NUEVO = process.argv[2] || './apps_script_11_oct_26_version_unica.js';
const VIGENTE = './apps_script_10_oct_26_carpeta_anio.js';   // el que está en uso (Versión 28)
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); failed++; } }
function hojaFalsa(grid, cols) {
  const h = { grid: grid || [], maxCols: cols || 26,
    getMaxColumns() { return h.maxCols; }, insertColumnsAfter(p, n) { h.maxCols += n; },
    appendRow(f) { h.grid.push(f.slice()); }, getLastRow() { return h.grid.length; },
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1;
      return {
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = []; for (let j = 0; j < nc; j++) { const x = (h.grid[r - 1 + i] || [])[c - 1 + j]; f.push(x === undefined ? '' : x); } o.push(f); } return o; },
        setValues(v) { for (let i = 0; i < nr; i++) { while (h.grid.length < r + i) h.grid.push([]); const f = h.grid[r - 1 + i]; for (let j = 0; j < nc; j++) { while (f.length < c - 1 + j) f.push(''); f[c - 1 + j] = v[i][j]; } } },
        setValue(v) { while (h.grid.length < r) h.grid.push([]); const f = h.grid[r - 1]; while (f.length < c - 1) f.push(''); f[c - 1] = v; },
        setBorder() {} }; } };
  return h;
}
function libro(ruta, grid) {
  const hoja = hojaFalsa(grid);
  const ss = { getSheetByName: n => (n === 'Hoja1' ? hoja : null), insertSheet: () => hojaFalsa(), getActiveSheet: () => hoja };
  const ctx = { console, Logger: { log() {} }, Utilities: { formatDate: () => '', base64Decode: () => [], newBlob: () => ({}) }, Session: { getScriptTimeZone: () => 'America/Chihuahua' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss }, ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ contenido: t, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, DriveApp: {}, MailApp: {}, GmailApp: {}, PropertiesService: {} };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx);
  return { ctx, hoja };
}
const enviar = (ctx, c) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(c) } }).contenido);
function cot(extra) {
  const items = [{ tipo: 'Taller - Suspensión', proveedor: 'Autozone', noParte: '', producto: 'Amortiguador', cant: 2, costo: '1000', margen: '25%', precio: '1333.33', subtotal: '2666.66' },
                 { tipo: 'Taller - Suspensión', proveedor: '', noParte: '', producto: 'Mano de obra', cant: 2, costo: '', margen: 'M.O.', precio: '550', subtotal: '1100' }];
  return Object.assign({ action: 'saveCotizacion', fecha: '9/10/2026 09:42', asesor: 'Xen', cliente: 'Cliente Prueba', telefono: '6140000000', vehiculo: 'Nissan', origen: 'WhatsApp', total: '3766.66', folio: '', items }, extra || {});
}
const bloques = g => { const b = []; g.forEach((f, i) => { if (i > 0 && f[0]) b.push({ ini: i, ref: f[18], grupo: f[19], ver: f[20], vig: f[21], folio: f[17] }); }); return b; };

console.log('\n=== VU-1. Mismo contenido guardado dos veces (caso Pedro Gallo) ===');
{
  const h = libro(NUEVO, [['Fecha']]);
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  const b = bloques(h.hoja.grid);
  ok('1 hay dos bloques', b.length === 2, b);
  ok('2 las versiones son 1 y 2 (no 1 y 1)', b[0].ver === 1 && b[1].ver === 2, b.map(x => x.ver));
  ok('3 la primera queda Vigente "No" y la nueva vigente', b[0].vig === 'No' && b[1].vig === '', b.map(x => x.vig));
  ok('4 todos los renglones del bloque 2 llevan Versión 2', h.hoja.grid[3][20] === 2 && h.hoja.grid[4][20] === 2, [h.hoja.grid[3][20], h.hoja.grid[4][20]]);
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  ok('5 la tercera vez sale Versión 3', bloques(h.hoja.grid)[2].ver === 3, bloques(h.hoja.grid).map(x => x.ver));
}
console.log('\n=== VU-2. PDF después de copiar (caso Molino Villafañe) sigue igual ===');
{
  const h = libro(NUEVO, [['Fecha']]);
  enviar(h.ctx, cot({ ref: '1009-BBBBB', grupo: '1009-BBBBB', version: 1 }));
  enviar(h.ctx, cot({ ref: '1009-BBBBB', grupo: '1009-BBBBB', version: 2, folio: 'EXPCARE-009/26' }));
  const b = bloques(h.hoja.grid);
  ok('6 versiones 1 y 2, con el folio en la 2', b[0].ver === 1 && b[1].ver === 2 && b[1].folio === 'EXPCARE-009/26', b);
  ok('7 la 1 queda "No"', b[0].vig === 'No' && b[1].vig === '', b.map(x => x.vig));
}
console.log('\n=== VU-3. Otros casos no cambian ===');
{
  const h = libro(NUEVO, [['Fecha']]);
  enviar(h.ctx, cot({ ref: '1009-CCCCC', grupo: '1009-CCCCC', version: 1 }));
  enviar(h.ctx, cot({ ref: '1009-DDDDD', grupo: '1009-DDDDD', version: 1 }));
  const b = bloques(h.hoja.grid);
  ok('8 otra cotización (otro Grupo) también empieza en Versión 1 y no se toca la anterior', b[0].ver === 1 && b[1].ver === 1 && b[0].vig === '' && b[1].vig === '', b);
  enviar(h.ctx, cot({ ref: '1009-EEEEE', grupo: '1009-CCCCC', version: 2 }));
  const c = bloques(h.hoja.grid);
  ok('9 versión 2 con Ref nuevo y mismo Grupo se queda en 2', c[2].ver === 2 && c[2].ref === '1009-EEEEE' && c[0].vig === 'No', c);
  enviar(h.ctx, cot({ ref: '1009-FFFFF', grupo: '1009-CCCCC', version: 5 }));
  ok('10 si el cotizador pide un número mayor (5), se respeta', bloques(h.hoja.grid)[3].ver === 5);
  const h2 = libro(NUEVO, [['Fecha']]);
  enviar(h2.ctx, cot({}));
  ok('11 sin Ref (página vieja): 18 columnas y sin cambios', h2.hoja.grid[1].length === 18, h2.hoja.grid[1].length);
  const h3 = libro(NUEVO, [['Fecha']]);
  enviar(h3.ctx, cot({ ref: '1009-GGGGG' }));
  ok('12 con Ref pero sin grupo ni versión: Grupo=Ref, Versión 1', h3.hoja.grid[1][19] === '1009-GGGGG' && h3.hoja.grid[1][20] === 1, h3.hoja.grid[1].slice(18, 22));
}
console.log('\n=== VU-4. Todo lo demás es idéntico al script en uso ===');
{
  const sec = [cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }), cot({ ref: '1009-BBBBB', grupo: '1009-BBBBB', version: 1 }),
    cot({ ref: '1009-CCCCC', grupo: '1009-AAAAA', version: 2 }), cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 3, folio: 'EXPCARE-001/26' }), cot({})];
  const a = libro(VIGENTE, [['Fecha']]), n = libro(NUEVO, [['Fecha']]);
  sec.forEach(c => { enviar(a.ctx, c); enviar(n.ctx, c); });
  ok('13 misma secuencia sin repeticiones → hoja idéntica celda por celda', JSON.stringify(a.hoja.grid) === JSON.stringify(n.hoja.grid));
  const dup = [cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }), cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 })];
  const a2 = libro(VIGENTE, [['Fecha']]), n2 = libro(NUEVO, [['Fecha']]);
  dup.forEach(c => { enviar(a2.ctx, c); enviar(n2.ctx, c); });
  const sinVer = g => g.map(f => f.filter((x, i) => i !== 20));
  ok('14 con repetición, lo único distinto es la columna Versión', JSON.stringify(sinVer(a2.hoja.grid)) === JSON.stringify(sinVer(n2.hoja.grid)));
}
console.log('\n=== VU-5. Hoja real (7,340 renglones, columnas ya llenas) ===');
if (fs.existsSync(process.argv[3] || '')) {
  const g = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const h = libro(NUEVO, g.map(f => f.slice()));
  const antes = h.hoja.grid.length;
  enviar(h.ctx, cot({ ref: '1009-FERZY', grupo: '1009-FERZY', version: 1 }));
  const ult = h.hoja.grid[antes][20];
  ok('15 guardar otra vez el Ref 1009-FERZY (ya tiene v1 dos veces) → Versión 2', ult === 2, ult);
  enviar(h.ctx, cot({ ref: '1011-NUEVO', grupo: '1011-NUEVO', version: 1 }));
  ok('16 cotización nueva en la hoja real → Versión 1', h.hoja.grid[antes + 2][20] === 1, h.hoja.grid[antes + 2][20]);
} else console.log('  (se omite: no se pasó hoja1_filas.json)');
console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
process.exit(failed ? 1 : 0);
