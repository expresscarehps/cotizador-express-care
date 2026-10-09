// ── TEST SUITE — Apps Script: columna "Marca" (W) en Hoja1 ─────────────────────────────
// Archivo: test_apps_script_columna.js
// Uso: node test_apps_script_columna.js [script_nuevo] [csv_Hoja1_actual]
// 1) doPost guarda la marca en la columna W sin cambiar las 22 columnas anteriores.
// 2) Relleno del historial (PRUEBA / APLICAR / DESHACER) de la columna W.
const fs = require('fs'), vm = require('vm');
const NUEVO = process.argv[2] || './apps_script_8_oct_26_marca_columna.js';
const VIGENTE = './apps_script_8_oct_26_ref_vigente.js';
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

console.log('\n=== AS-W0. Lo anterior no cambió ===');
{
  const nuevo = fs.readFileSync(NUEVO, 'utf8'), ant = fs.readFileSync(ANTERIOR, 'utf8');
  const cola = t => t.slice(t.indexOf('function doGet'));
  const corte = nuevo.indexOf('//  RELLENO DE MARCA EN LLANTAS DEL HISTORIAL');
  ok('W0a doGet (folios) y el reporte diario son idénticos al script anterior', cola(nuevo.slice(0, nuevo.lastIndexOf('\n', corte) - 80 > 0 ? nuevo.lastIndexOf('═', corte) - 3 : corte)).indexOf('function doGet') === 0 && cola(ant).trim() === cola(nuevo.slice(0, nuevo.lastIndexOf('\n// ═', corte))).trim());
  const rama = t => t.slice(t.indexOf('// ── Guardar cotización historial'), t.indexOf('} catch (err)'));
  ok('W0b la rama de guardado antigua (sin action) no cambió', rama(ant) === rama(nuevo));
}

console.log('\n=== AS-W1. doPost guarda la marca en la columna W ===');
{
  const h1 = libro(NUEVO, [['Fecha', 'Asesor']]), h0 = libro(VIGENTE, [['Fecha', 'Asesor']]);
  const c = cot({ ref: '1008-AAAAA', grupo: '1008-AAAAA', version: 1 });
  const r1 = enviar(h1.ctx, c); enviar(h0.ctx, c);
  ok('W1 responde ok', r1.status === 'ok');
  const g = h1.hoja.grid;
  ok('W2 encabezado W1 = "Marca"', g[0][22] === 'Marca' && g[0].slice(18, 22).join('|') === 'Ref|Grupo|Versión|Vigente', g[0]);
  ok('W3 el renglón de la llanta trae su marca en W y el servicio la trae vacía', g[1][22] === 'BFGOODRICH' && g[2][22] === '', [g[1][22], g[2][22]]);
  ok('W4 las primeras 22 columnas son IDÉNTICAS a las del script vigente', JSON.stringify(g.slice(1).map(f => f.slice(0, 22))) === JSON.stringify(h0.hoja.grid.slice(1).map(f => f.slice(0, 22))));
  ok('W5 los bordes cubren 23 columnas', h1.hoja.bordes.length === 1 && h1.hoja.bordes[0].nc === 23, h1.hoja.bordes);
  const h2 = libro(NUEVO, [['x']]);
  enviar(h2.ctx, cot({ ref: '1008-BBBBB' }, [{ tipo: 'Llantas', proveedor: 'SERV', noParte: '', producto: 'X', marca: '  jk   tyre ', cant: 1, precio: '1', subtotal: '1' }]));
  ok('W6 la marca se normaliza (mayúsculas, espacios) y soporta marcas de dos palabras', h2.hoja.grid[1][22] === 'JK TYRE', h2.hoja.grid[1]);
  const h3 = libro(NUEVO, [['x']]);
  enviar(h3.ctx, cot({ ref: '1008-CCCCC' }, [{ tipo: 'Llantas', proveedor: 'SERV', noParte: 'Z', producto: 'sin marca (página vieja)', cant: 1, precio: '1', subtotal: '1' }]));
  ok('W7 una cotización SIN marca (página vieja/producción hoy) se guarda igual, con W vacía', h3.hoja.grid[1].length === 23 && h3.hoja.grid[1][22] === '' && h3.hoja.grid[1][18] === '1008-CCCCC');
  const h4 = libro(NUEVO, [['x']], 22);   // hoja con solo 22 columnas
  const r4 = enviar(h4.ctx, cot({ ref: '1008-DDDDD' }));
  ok('W8 si la hoja solo llega a la columna V se agrega la columna W sola', r4.status === 'ok' && h4.hoja.maxCols === 23 && h4.hoja.grid[1][22] === 'BFGOODRICH', h4.hoja.maxCols);
  const hA = libro(NUEVO, []), hB = libro(ANTERIOR, []);
  enviar(hA.ctx, cot({ folio: 'EXPCARE-009/26' })); enviar(hB.ctx, cot({ folio: 'EXPCARE-009/26' }));
  ok('W9 sin Ref (modo anterior) queda IDÉNTICO al script de agosto: 18 columnas', JSON.stringify(hA.hoja.grid) === JSON.stringify(hB.hoja.grid) && hA.hoja.grid[0].length === 18);
  const h5 = libro(NUEVO, [['x']]);
  enviar(h5.ctx, cot({ ref: '1008-EEEEE', grupo: '1008-EEEEE', version: 1 })); enviar(h5.ctx, cot({ ref: '1008-FFFFF', grupo: '1008-EEEEE', version: 2 }));
  const v1 = h5.hoja.grid.filter(f => f[18] === '1008-EEEEE');
  ok('W10 las versiones nuevas siguen marcando "No" a la anterior y la marca se guarda en cada versión', v1.every(f => f[21] === 'No') && h5.hoja.grid.filter(f => f[18] === '1008-FFFFF')[0][22] === 'BFGOODRICH');
}

console.log('\n=== AS-W2. Relleno del historial (columna W) ===');
{
  const ENC = ['Fecha', 'Asesor', 'Cliente', 'Teléfono', 'Vehículo', 'Origen', 'Tipo', 'Proveedor', 'No. de Parte ', 'Producto', 'Cant'];
  const fila = (tipo, prov, cve, prod, w) => { const f = ['', '', '', '', '', '', tipo, prov, cve, prod, 1, '', '', '', '', '', '', '', '', '', '', '', w === undefined ? undefined : w]; if (w === undefined) f.length = 22; return f; };
  const g = [ENC.slice(),
    fila('Llantas', 'AYALA', 'AY09329', 'BFGOODRICH 235/75R15 108T XL TL ADVANTAGE T/A SPORT LT GO'),   // por No. de parte
    fila('Llantas', 'SERV', '', 'YOKOHAMA 195/50 R 16 ADVAN V105'),                                        // marca al frente (sin parte)
    fila('Llantas', 'VEGA', '', '155/70-R13 BLACKHAWK HH11 75T'),                                          // marca dentro del texto
    fila('Llantas', 'SERV', '', 'JK TYRE 185/65R15 JK VECTRA 92T'),                                        // dos palabras
    fila('Llantas', '', '', 'Montaje'),                                                                    // servicio
    fila('Aceite', 'X', 'Z', 'Aceite 5W30'),                                                               // otro tipo
    fila('Llantas', 'SERV', '', 'LLANTA RARA SIN MARCA 999'),                                              // sin identificar
    fila('Llantas', 'AYALA', 'AY09329', 'BFGOODRICH 235/75R15 ...', 'YA-ESCRITA')];                        // ya tiene W: no se pisa
  const copia = JSON.stringify(g);
  const L = libro(NUEVO, g);
  const p = L.ctx.columnaMarca_PRUEBA();
  ok('W11 PRUEBA no modifica Hoja1', JSON.stringify(L.hoja.grid) === copia);
  ok('W12 PRUEBA: 4 por escribir, 1 ya tenía, 1 sin identificar', p.nuevas === 4 && p.yaTienen === 1 && p.sinMarca === 1, p);
  const a = L.ctx.columnaMarca_APLICAR(), G = L.hoja.grid;
  ok('W13 APLICAR escribe la marca correcta en W (parte, al frente, dentro del texto, dos palabras)', G[1][22] === 'BFGOODRICH' && G[2][22] === 'YOKOHAMA' && G[3][22] === 'BLACKHAWK' && G[4][22] === 'JK TYRE', G.map(f => f[22]));
  ok('W14 servicios, otros tipos y no identificadas quedan vacías; la ya escrita no se pisa', G[5][22] === undefined || G[5][22] === '' ? (G[6][22] === undefined || G[6][22] === '') && (G[7][22] === undefined || G[7][22] === '') && G[8][22] === 'YA-ESCRITA' : false, G.map(f => f[22]));
  ok('W15 encabezado "Marca" en W1 y las demás columnas intactas', G[0][22] === 'Marca' && G.slice(1).every((f, i) => JSON.stringify(f.slice(0, 22)) === JSON.stringify(JSON.parse(copia)[i + 1].slice(0, 22))));
  ok('W16 APLICAR otra vez no escribe nada nuevo (idempotente)', L.ctx.columnaMarca_APLICAR().escritas === 0);
  const d = L.ctx.columnaMarca_DESHACER();
  ok('W17 DESHACER quita solo las marcas que escribió (4) y deja la que ya estaba', d.quitadas === 4 && L.hoja.grid[1][22] === '' && L.hoja.grid[8][22] === 'YA-ESCRITA', d);
  L.ctx.columnaMarca_APLICAR(); L.hoja.grid[1][22] = 'EDITADA';
  const d2 = L.ctx.columnaMarca_DESHACER();
  ok('W18 si alguien editó la marca a mano, DESHACER no la pisa', L.hoja.grid[1][22] === 'EDITADA' && d2.omitidas === 1, d2);
  const vacia = libro(NUEVO, [ENC.slice()], 22);
  ok('W19 hoja de 22 columnas y sin datos: PRUEBA y APLICAR no truenan (APLICAR agrega la columna)', vacia.ctx.columnaMarca_PRUEBA().nuevas === 0 && vacia.ctx.columnaMarca_APLICAR().escritas === 0 && vacia.hoja.maxCols === 23);
}

if (CSV && fs.existsSync(CSV)) {
  console.log('\n=== AS-W3. Con los datos REALES de Hoja1 (' + CSV + ') ===');
  function parse(t) { const rows = []; let r = [], f = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c == '"') { if (t[i + 1] == '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c == '"') q = true; else if (c == ',') { r.push(f); f = ''; } else if (c == '\n') { r.push(f); rows.push(r); r = []; f = ''; } else if (c != '\r') f += c; } if (f || r.length) { r.push(f); rows.push(r); } return rows; }
  const grid = parse(fs.readFileSync(CSV, 'utf8'));
  const orig = JSON.stringify(grid);
  const L = libro(NUEVO, grid.map(f => f.slice()));
  const p = L.ctx.columnaMarca_PRUEBA();
  console.log('     ' + p.resumen);
  ok('R1 PRUEBA con datos reales no modifica Hoja1', JSON.stringify(L.hoja.grid) === orig);
  const llantas = grid.slice(1).filter(f => f[6] === 'Llantas' && (f[7] || f[8])).length;
  ok('R2 TODAS las llantas del historial quedan con marca (' + llantas + ')', p.nuevas === llantas && p.sinMarca === 0, { llantas, p });
  L.ctx.columnaMarca_APLICAR();
  const G = L.hoja.grid;
  ok('R3 mismo número de renglones y las 22 columnas anteriores intactas', G.length === grid.length && G.every((f, i) => JSON.stringify(f.slice(0, 22)) === JSON.stringify((grid[i].concat(Array(22).fill('')).slice(0, 22)))));
  const conMarca = G.slice(1).filter(f => f[6] === 'Llantas' && (f[7] || f[8]));
  ok('R4 la marca de W aparece escrita en el Producto de su mismo renglón (consistencia)', conMarca.every(f => String(f[9]).toUpperCase().indexOf(String(f[22])) >= 0), conMarca.filter(f => String(f[9]).toUpperCase().indexOf(String(f[22])) < 0).slice(0, 3).map(f => [f[9], f[22]]));
  ok('R5 ningún servicio ni otro tipo recibió marca', G.slice(1).filter(f => !(f[6] === 'Llantas' && (f[7] || f[8]))).every(f => !f[22]));
  const dist = {}; conMarca.forEach(f => dist[f[22]] = (dist[f[22]] || 0) + 1);
  const multi = Object.keys(dist).filter(m => /\s/.test(m));
  ok('R6 las marcas de dos palabras salen completas y estables: ' + multi.join(', '), multi.every(m => ['JK TYRE', 'GMX PRIME', 'GREEN MAX', 'HAPPY ROAD', 'ROYAL BLACK', 'TDI TIRES'].includes(m)), multi);
  console.log('     marcas distintas en el historial:', Object.keys(dist).length, '| top:', Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x.join(' ')).join(', '));
  L.ctx.columnaMarca_DESHACER();
  ok('R7 DESHACER deja la columna W vacía otra vez (Hoja1 como estaba)', L.hoja.grid.slice(1).every(f => !f[22]));
}
console.log(`\n${'='.repeat(45)}\nTOTAL: ${passed + failed} | ✅ ${passed} OK | ❌ ${failed} FALLIDAS`);
process.exit(failed ? 1 : 0);
