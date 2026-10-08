// ── TEST SUITE — Apps Script: columnas Ref / Grupo / Versión / Vigente ─────────
// Archivo: test_apps_script.js
// Uso:  node test_apps_script.js [ruta_del_script_nuevo]   (por defecto ./apps_script_8_oct_26_ref_vigente.js)
// Simula la hoja (SpreadsheetApp) en memoria y llama a doPost() igual que lo hace el cotizador.
// Además corre el MISMO guardado contra el script anterior (apps_script_3_ago_26_reporte_diario_4.js)
// para comprobar que una cotización sin Ref queda idéntica a como se guardaba antes.

const fs = require('fs');
const vm = require('vm');
const NUEVO = process.argv[2] || './apps_script_8_oct_26_ref_vigente.js';
const ANTERIOR = './apps_script_3_ago_26_reporte_diario_4.js';

let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { console.log('  ✅ ' + name); passed++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; }
}

// Hoja simulada con lo mínimo que usa saveCotizacion
function crearHoja(filasIniciales, columnas) {
  const grid = (filasIniciales || []).map(r => r.slice());
  const hoja = {
    grid, bordes: [], escrituras: 0, maxCols: columnas || 26,
    getMaxColumns() { return hoja.maxCols; },
    insertColumnsAfter(pos, n) { hoja.maxCols += n; },
    appendRow(fila) { grid.push(fila.slice()); },
    getLastRow() { return grid.length; },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      if (c - 1 + nc > hoja.maxCols) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');   // como Google Sheets
      return {
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = []; for (let j = 0; j < nc; j++) { const x = (grid[r - 1 + i] || [])[c - 1 + j]; f.push(x === undefined ? '' : x); } o.push(f); } return o; },
        setValues(vals) { for (let i = 0; i < nr; i++) { while (grid.length < r + i) grid.push([]); for (let j = 0; j < nc; j++) { const f = grid[r - 1 + i]; while (f.length < c - 1 + j) f.push(''); f[c - 1 + j] = vals[i][j]; } } hoja.escrituras++; },
        setValue(v) { while (grid.length < r) grid.push([]); const f = grid[r - 1]; while (f.length < c - 1) f.push(''); f[c - 1] = v; hoja.escrituras++; },
        setBorder() { hoja.bordes.push({ r, c, nr, nc }); }
      };
    }
  };
  return hoja;
}

function cargar(ruta, hoja) {
  const bloqueos = { espera: 0, libera: 0 };
  const ctx = {
    console, Logger: { log() {} }, Utilities: { formatDate: () => '', base64Decode: () => [], newBlob: () => ({}) },
    Session: { getScriptTimeZone: () => 'America/Chihuahua' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getActiveSheet: () => hoja, getSheetByName: () => hoja }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ contenido: t, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { bloqueos.espera++; }, releaseLock() { bloqueos.libera++; } }) },
    DriveApp: {}, MailApp: {}, GmailApp: {}, PropertiesService: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx);
  ctx.__bloqueos = bloqueos;
  return ctx;
}
function enviar(ctx, cuerpo) {
  const r = ctx.doPost({ postData: { contents: JSON.stringify(cuerpo) } });
  return JSON.parse(r.contenido);
}
function cotizacion(extra, nItems) {
  const items = [];
  for (let i = 0; i < (nItems || 2); i++) items.push({ tipo: 'Llantas', proveedor: 'SERV', noParte: 'X' + i, producto: 'Producto ' + i, cant: 1, costo: '100', margen: '12%', precio: '112', subtotal: '112' });
  return Object.assign({ action: 'saveCotizacion', fecha: '8/10/2026 08:00', asesor: 'Ana', cliente: 'Cliente Prueba', telefono: '6140000000', vehiculo: 'Nissan Sentra 2020 4 cil', origen: 'WhatsApp', total: '$224.00', folio: '', items }, extra || {});
}
const col = (hoja, c) => hoja.grid.map(f => f[c - 1] === undefined ? '' : f[c - 1]);

console.log('\n=== AS-A. SIN Ref: queda igual que antes ===');
{
  const h1 = crearHoja(), h2 = crearHoja();
  const nuevo = cargar(NUEVO, h1), viejo = cargar(ANTERIOR, h2);
  const c = cotizacion({ folio: 'EXPCARE-009/26' });
  const r1 = enviar(nuevo, c), r2 = enviar(viejo, c);
  ok('A1 responde ok', r1.status === 'ok' && r2.status === 'ok');
  ok('A2 los renglones guardados son IDÉNTICOS a los del script anterior', JSON.stringify(h1.grid) === JSON.stringify(h2.grid), [h1.grid[0], h2.grid[0]]);
  ok('A3 siguen siendo 18 columnas (no aparece S–V)', h1.grid.every(f => f.length === 18));
  ok('A4 no se ponen encabezados nuevos ni se usa el candado', h1.grid.length === 2 && nuevo.__bloqueos.espera === 0);
  ok('A5 los bordes cubren las mismas 18 columnas', JSON.stringify(h1.bordes) === JSON.stringify(h2.bordes), [h1.bordes, h2.bordes]);
}

console.log('\n=== AS-B. CON Ref: versión 1 ===');
{
  const h = crearHoja([['Fecha', 'Asesor', 'Cliente']]);   // encabezado existente (solo A–C llenos, S–V vacíos)
  const ctx = cargar(NUEVO, h);
  enviar(ctx, cotizacion({ ref: '1008-AAAAA', grupo: '1008-AAAAA', version: 1 }));
  ok('B1 se ponen los encabezados Ref, Grupo, Versión, Vigente en S1:V1', JSON.stringify(h.grid[0].slice(18, 22)) === JSON.stringify(['Ref', 'Grupo', 'Versión', 'Vigente']), h.grid[0]);
  ok('B2 los 2 renglones del bloque llevan Ref, Grupo y Versión', h.grid.slice(1).every(f => f[18] === '1008-AAAAA' && f[19] === '1008-AAAAA' && f[20] === 1));
  ok('B3 Vigente queda vacío (= vigente)', h.grid.slice(1).every(f => f[21] === ''));
  ok('B4 las primeras 18 columnas son las de siempre', h.grid[1][2] === 'Cliente Prueba' && h.grid[2][2] === '' && h.grid[1][15] === '$224.00' && h.grid[2][15] === '');
  ok('B5 los bordes cubren 22 columnas', h.bordes.length === 1 && h.bordes[0].nc === 22, h.bordes);
  ok('B6 usó el candado y lo liberó', ctx.__bloqueos.espera === 1 && ctx.__bloqueos.libera === 1, ctx.__bloqueos);
  enviar(ctx, cotizacion({ ref: '1008-BBBBB', grupo: '1008-BBBBB', version: 1, cliente: 'Otro' }));
  ok('B7 los encabezados no se repiten (siguen siendo solo el primer renglón)', h.grid.filter(f => f[18] === 'Ref').length === 1);
}

console.log('\n=== AS-C. Versiones del mismo Grupo ===');
{
  const h = crearHoja([['Fecha']]);
  const ctx = cargar(NUEVO, h);
  // renglón viejo (sin Ref) y otra cotización de otro grupo, que no deben tocarse
  h.appendRow(['1/9/2026', 'Xen', 'Viejo', '', '', '', 'Llantas', '', '', 'P', 1, '', '', '1', '1', '1', '', '']);
  enviar(ctx, cotizacion({ ref: '1008-OTRO1', grupo: '1008-OTRO1', version: 1, cliente: 'Otro cliente' }));
  enviar(ctx, cotizacion({ ref: '1008-AAAAA', grupo: '1008-AAAAA', version: 1 }, 3));
  const antes = h.grid.length;
  enviar(ctx, cotizacion({ ref: '1008-BBBBB', grupo: '1008-AAAAA', version: 2, asesor: 'Xen' }, 2));
  const v1 = h.grid.filter(f => f[18] === '1008-AAAAA'), v2 = h.grid.filter(f => f[18] === '1008-BBBBB');
  ok('C1 la versión 1 queda marcada "No" en TODOS sus renglones (3)', v1.length === 3 && v1.every(f => f[21] === 'No'), v1.map(f => f[21]));
  ok('C2 la versión 2 queda vigente (vacío) en sus 2 renglones', v2.length === 2 && v2.every(f => f[21] === '' && f[19] === '1008-AAAAA' && f[20] === 2), v2);
  ok('C3 la cotización de otro grupo NO se toca', h.grid.filter(f => f[18] === '1008-OTRO1').every(f => f[21] === ''));
  ok('C4 el renglón viejo sin Ref NO se toca', h.grid[1].length === 18 && h.grid[1][2] === 'Viejo');
  ok('C5 el guardado agregó solo los renglones nuevos (no duplicó ni borró)', h.grid.length === antes + 2, [antes, h.grid.length]);
  // versión 3 con folio (PDF): mismo Ref que la v2 → la v2 pasa a "No"
  enviar(ctx, cotizacion({ ref: '1008-BBBBB', grupo: '1008-AAAAA', version: 3, folio: 'EXPCARE-009/26' }, 2));
  const b = h.grid.filter(f => f[18] === '1008-BBBBB');
  ok('C6 PDF con folio (mismo Ref, versión 3): la v2 pasa a "No" y solo queda vigente la del folio',
    b.filter(f => f[20] === 2).every(f => f[21] === 'No') && b.filter(f => f[20] === 3).every(f => f[21] === '') && b.filter(f => f[20] === 3)[0][17] === 'EXPCARE-009/26', b.map(f => [f[20], f[21], f[17]]));
  const vigentesA = h.grid.filter(f => f[19] === '1008-AAAAA' && f[2] !== '' && f[21] === '');
  ok('C7 de todo el grupo solo queda 1 cotización vigente', vigentesA.length === 1 && vigentesA[0][20] === 3, vigentesA.map(f => f[20]));
}

console.log('\n=== AS-D0. Hoja que solo llega hasta la columna R (18 columnas) ===');
{
  const h = crearHoja([['Fecha']], 18);
  const ctx = cargar(NUEVO, h);
  const r = enviar(ctx, cotizacion({ ref: '1008-EEEEE', grupo: '1008-EEEEE', version: 1 }));
  ok('D0a no truena: agrega las columnas que faltan y guarda', r.status === 'ok' && h.maxCols >= 22 && h.grid[1][18] === '1008-EEEEE', { r, maxCols: h.maxCols });
  const r2 = enviar(ctx, cotizacion({ ref: '1008-FFFFF', grupo: '1008-EEEEE', version: 2 }));
  ok('D0b la versión 2 marca la 1 como "No" también en esa hoja', r2.status === 'ok' && h.grid[1][21] === 'No' && h.grid[3][21] === '', h.grid.map(f => f[21]));
  // Contra el script ANTERIOR la misma hoja de 18 columnas funciona sin Ref (igual que hoy)
  const h3 = crearHoja([['Fecha']], 18);
  const r3 = enviar(cargar(NUEVO, h3), cotizacion());
  ok('D0c sin Ref en una hoja de 18 columnas: guarda como siempre', r3.status === 'ok' && h3.maxCols === 18 && h3.grid[1].length === 18);
}

console.log('\n=== AS-D. Casos de borde ===');
{
  const h = crearHoja();   // hoja completamente vacía
  const ctx = cargar(NUEVO, h);
  const r = enviar(ctx, cotizacion({ ref: '1008-CCCCC', version: 1 }));   // sin grupo → usa el Ref
  ok('D1 hoja vacía + sin grupo: guarda y usa el Ref como Grupo', r.status === 'ok' && h.grid[h.grid.length - 1][19] === '1008-CCCCC', h.grid.slice(-1));
  const h2 = crearHoja();
  const ctx2 = cargar(NUEVO, h2);
  const r2 = enviar(ctx2, { action: 'saveCotizacion', ref: '1008-D', items: null });
  ok('D2 datos inválidos: responde error (no truena) y libera el candado', r2.status === 'error' && ctx2.__bloqueos.libera === ctx2.__bloqueos.espera, r2);
  // el resto del script no cambió
  const a = fs.readFileSync(ANTERIOR, 'utf8'), n = fs.readFileSync(NUEVO, 'utf8');
  const cola = t => t.slice(t.indexOf('function doGet'));
  ok('D3 doGet (folios) y el reporte diario son idénticos al script anterior', cola(a) === cola(n));
  const ramaVieja = t => t.slice(t.indexOf('// ── Guardar cotización historial'), t.indexOf('} catch (err)'));
  ok('D4 la rama de guardado antigua (sin action) no cambió', ramaVieja(a) === ramaVieja(n));
}

console.log(`\n${'='.repeat(45)}`);
console.log(`TOTAL: ${passed + failed} | ✅ ${passed} OK | ❌ ${failed} FALLIDAS`);
process.exit(failed ? 1 : 0);
