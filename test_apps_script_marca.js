// ── TEST SUITE — Apps Script: relleno de MARCA en llantas del historial ─────────────
// Archivo: test_apps_script_marca.js
// Uso: node test_apps_script_marca.js [script] [csv_de_Hoja1]
// Simula el Spreadsheet (varias hojas) en memoria. Si se da un CSV real de Hoja1 corre contra esos datos.
const fs = require('fs'), vm = require('vm');
const SCRIPT = process.argv[2] || './apps_script_8_oct_26_marca_historial.js';
const BASE = './apps_script_8_oct_26_ref_vigente.js';
const CSV = process.argv[3] || '';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); failed++; } }

function hojaFalsa(nombre, grid) {
  const h = { nombre, grid: grid || [], getLastRow() { return h.grid.length; },
    clear() { h.grid.length = 0; },
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1; return {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = []; for (let j = 0; j < nc; j++) { const x = (h.grid[r - 1 + i] || [])[c - 1 + j]; f.push(x === undefined ? '' : x); } o.push(f); } return o; },
      setValues(v) { for (let i = 0; i < nr; i++) { while (h.grid.length < r + i) h.grid.push([]); const f = h.grid[r - 1 + i]; for (let j = 0; j < nc; j++) { while (f.length < c - 1 + j) f.push(''); f[c - 1 + j] = v[i][j]; } } } }; } };
  return h;
}
function libro(hoja1Grid) {
  const hojas = { Hoja1: hojaFalsa('Hoja1', hoja1Grid) };
  const ss = { hojas, getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hojaFalsa(n)), getActiveSheet: () => hojas.Hoja1 };
  const bl = { espera: 0, libera: 0 };
  const ctx = { console, Logger: { log() {} }, Utilities: {}, Session: { getScriptTimeZone: () => 'America/Chihuahua' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss }, ContentService: {}, LockService: { getScriptLock: () => ({ waitLock() { bl.espera++; }, releaseLock() { bl.libera++; } }) },
    DriveApp: {}, MailApp: {}, GmailApp: {}, PropertiesService: {} };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), ctx);
  return { ss, ctx, hojas, bl };
}
const ENC = ['Fecha', 'Asesor', 'Cliente', 'Teléfono', 'Vehículo', 'Origen', 'Tipo', 'Proveedor', 'No. de Parte ', 'Producto', 'Cant', 'Costo', 'Margen%', 'Precio', 'Subtotal', 'Total', 'Estatus ', 'Cotización '];
const fila = (tipo, prov, cve, prod) => ['', '', '', '', '', '', tipo, prov, cve, prod, 1, '', '', '', '', '', '', ''];

console.log('\n=== AS-M0. Lo anterior no cambió ===');
{
  const a = fs.readFileSync(BASE, 'utf8').replace(/\s+$/, ''), n = fs.readFileSync(SCRIPT, 'utf8');
  ok('M0a el script nuevo = el script vigente (doPost, folios, reporte) + funciones nuevas al final, sin tocar nada de lo anterior', n.startsWith(a));
  ok('M0b el archivo tiene sintaxis válida y las 3 funciones', (() => { const { ctx } = libro([]); return ['completarMarcaLlantas_PRUEBA', 'completarMarcaLlantas_APLICAR', 'deshacerMarcaLlantas'].every(f => typeof ctx[f] === 'function'); })());
}

console.log('\n=== AS-M1. Casos pequeños ===');
{
  const g = [ENC.slice(),
    fila('Llantas', 'AYALA', 'AY09329', '235/75R15 108T XL TL ADVANTAGE T/A SPORT LT GO'),          // por No. de parte → BFGOODRICH
    fila('Llantas', 'VEGA', '21555R17NT555', '215/55-R17 NITTO NT555 G2 94V'),          // ya trae marca
    fila('Llantas', '', '', 'Montaje'),                                                  // servicio
    fila('Aceite', 'X', 'Z1', 'Aceite 5W30'),                                            // otro tipo
    fila('Llantas', 'SERV', '', '255/55R20 ASSURANCE MAXLIFE 107 H'),                    // por descripción → GOODYEAR
    fila('Llantas', 'SERV', '', 'LLANTA RARA SIN MARCA CONOCIDA'),                       // no identificada
    fila('Llantas', 'SERV', 'NOEXISTE9', 'OTRA RARA')];
  const copia = JSON.stringify(g);
  const { ctx, hojas } = libro(g);
  const p = ctx.completarMarcaLlantas_PRUEBA();
  ok('M1 PRUEBA no modifica Hoja1', JSON.stringify(hojas.Hoja1.grid) === copia);
  ok('M2 PRUEBA cuenta: 2 cambios, 1 ya traía, 2 no identificadas', p.cambios === 2 && p.yaTienen === 1 && p.noIdentificadas === 2, p);
  const v = hojas['Vista previa Marca'];
  ok('M3 hoja "Vista previa Marca" muestra actual → nuevo y cómo se identificó', v && v.grid[1][5] === 'BFGOODRICH 235/75R15 108T XL TL ADVANTAGE T/A SPORT LT GO' && v.grid[1][7] === 'No. de parte' && v.grid[2][5] === 'GOODYEAR 255/55R20 ASSURANCE MAXLIFE 107 H' && v.grid[2][7] === 'Descripción igual al catálogo', v && v.grid.slice(0, 3));
  ok('M4 las no identificadas aparecen en la vista previa marcadas', v.grid.filter(f => /NO IDENTIFICADA/.test(f[0])).length === 2);
  const a = ctx.completarMarcaLlantas_APLICAR();
  const h = hojas.Hoja1.grid;
  ok('M5 APLICAR pone la marca al frente solo en los 2 renglones', h[1][9] === 'BFGOODRICH 235/75R15 108T XL TL ADVANTAGE T/A SPORT LT GO' && h[5][9] === 'GOODYEAR 255/55R20 ASSURANCE MAXLIFE 107 H' && a.cambios === 2, h.map(f => f[9]));
  ok('M6 los demás renglones quedan idénticos (marca ya puesta, servicio, otro tipo, no identificadas)', [2, 3, 4, 6, 7].every(i => JSON.stringify(h[i]) === JSON.stringify(JSON.parse(copia)[i])));
  ok('M7 las demás columnas no cambian (solo Producto)', h.every((f, i) => f.every((x, j) => j === 9 || x === JSON.parse(copia)[i][j])));
  const r = hojas['Respaldo Marca'];
  ok('M8 respaldo con 2 renglones: fila, anterior y nuevo', r && r.grid.length === 3 && r.grid[1][1] === 2 && r.grid[1][2] === '235/75R15 108T XL TL ADVANTAGE T/A SPORT LT GO' && r.grid[1][3] === h[1][9], r && r.grid);
  const a2 = ctx.completarMarcaLlantas_APLICAR();
  ok('M9 correr APLICAR otra vez no duplica marcas ni respaldos (idempotente)', a2.cambios === 0 && h[1][9] === 'BFGOODRICH 235/75R15 108T XL TL ADVANTAGE T/A SPORT LT GO' && r.grid.length === 3, a2);
  const d = ctx.deshacerMarcaLlantas();
  ok('M10 DESHACER regresa Hoja1 EXACTAMENTE a como estaba', d.restaurados === 2 && JSON.stringify(hojas.Hoja1.grid) === copia, d);
  ok('M11 el respaldo queda marcado como deshecho', r.grid.slice(1).every(f => f[5] === 'Sí'));
  const d2 = ctx.deshacerMarcaLlantas();
  ok('M12 DESHACER dos veces no hace nada raro', d2.restaurados === 0 && JSON.stringify(hojas.Hoja1.grid) === copia);
  ctx.completarMarcaLlantas_APLICAR();
  hojas.Hoja1.grid[1][9] = 'EDITADO A MANO';
  const d3 = ctx.deshacerMarcaLlantas();
  ok('M13 si alguien editó el renglón a mano, DESHACER no lo pisa', hojas.Hoja1.grid[1][9] === 'EDITADO A MANO' && d3.omitidos === 1 && d3.restaurados === 1, d3);
}

console.log('\n=== AS-M2. Hoja vacía / sin respaldo ===');
{
  const { ctx } = libro([ENC.slice()]);
  ok('M14 hoja solo con encabezado: PRUEBA y APLICAR no truenan', ctx.completarMarcaLlantas_PRUEBA().cambios === 0 && ctx.completarMarcaLlantas_APLICAR().cambios === 0);
  ok('M15 DESHACER sin respaldo avisa y no truena', ctx.deshacerMarcaLlantas().restaurados === 0);
  const l = libro([ENC.slice(), fila('Llantas', 'AYALA', 'AY09329', 'X')]);
  l.ctx.completarMarcaLlantas_APLICAR();
  ok('M16 el candado se libera siempre', l.bl.espera === l.bl.libera && l.bl.espera > 0, l.bl);
}

console.log('\n=== AS-M2b. Llantas capturadas a mano que Carlos pidió identificar ===');
{
  const casos = [
    ['185/65R15 JK VECTRA 92T', 'JK TYRE 185/65R15 JK VECTRA 92T'],
    ['225/65R17 ECOTOUR HP3 102H', 'VINMAX 225/65R17 ECOTOUR HP3 102H'],
    ['235/55R17 SPORT GREEN 103W', 'ATLAS 235/55R17 SPORT GREEN 103W'],
    ['235/55R19 A51 101V', 'ATLAS 235/55R19 A51 101V'],
    ['195/50 R 16 ADVAN V105', 'YOKOHAMA 195/50 R 16 ADVAN V105'],
    ['185/65R15 MR-169 88H', 'MIRAGE 185/65R15 MR-169 88H'],
    ['205/55R16 JK TYRE UX1 TL 91H', null], ['225/45R17 Yokohama premium', null], ['225/60R18 YOKOHAMA PREMIUM GEOLANDAR G058', null],
    ['HANKOOK RF12 LT 120/116 S', null], ['175/70R13 YOKOHAMA', null], ['175/70R13 *ALLIANCE*', null], ['175/70R13 *SUNFULL*', null],
    ['33x12.50R20 HANKOOK RF12 LT', null], ['6.50.16 TORNEL T1300', null], ['195/45R15 ILINK L-ZEAL56 82V XL', null], ['195/70 R15C RY55 YOKOHAMA', null]];
  const g = [ENC.slice()].concat(casos.map(c => fila('Llantas', 'SERV', '', c[0])));
  g.push(fila('Llantas', 'SERV', '', '6.50-16 TT ASCENSO TS8110'), fila('Llantas', 'SERV', '', 'LLANTA SIN MARCA CONOCIDA 999'));
  const { ctx, hojas } = libro(g);
  const p = ctx.completarMarcaLlantas_PRUEBA();
  ok('M17 de las 18 llantas a mano: 6 reciben marca al frente, 12 ya la traían escrita (incluida ASCENSO) y 1 llanta desconocida de prueba queda sin identificar', p.cambios === 6 && p.yaTienen === 12 && p.noIdentificadas === 1, p);
  ctx.completarMarcaLlantas_APLICAR();
  const h = hojas.Hoja1.grid;
  ok('M18 cada una queda con la marca correcta al frente', casos.every((c, i) => c[1] === null || h[i + 1][9] === c[1]), h.map(f => f[9]));
  ok('M19 las que ya traían la marca escrita no se tocan (no se repite)', casos.every((c, i) => c[1] !== null || h[i + 1][9] === c[0]));
  ok('M20 ASCENSO queda igual (ya la trae) y una llanta desconocida no recibe marca inventada', h[18][9] === '6.50-16 TT ASCENSO TS8110' && h[19][9] === 'LLANTA SIN MARCA CONOCIDA 999');
}

if (CSV && fs.existsSync(CSV)) {
  console.log('\n=== AS-M3. Con los datos REALES de Hoja1 (' + CSV + ') ===');
  function parse(t) { const rows = []; let r = [], f = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c == '"') { if (t[i + 1] == '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c == '"') q = true; else if (c == ',') { r.push(f); f = ''; } else if (c == '\n') { r.push(f); rows.push(r); r = []; f = ''; } else if (c != '\r') f += c; } if (f || r.length) { r.push(f); rows.push(r); } return rows; }
  const grid = parse(fs.readFileSync(CSV, 'utf8'));
  const orig = JSON.stringify(grid);
  const { ctx, hojas } = libro(grid.map(f => f.slice()));
  const llantasCve = grid.slice(1).filter(f => f[6] === 'Llantas' && f[7] && f[8]).length;
  const p = ctx.completarMarcaLlantas_PRUEBA();
  ok('R1 PRUEBA con datos reales no modifica Hoja1', JSON.stringify(hojas.Hoja1.grid) === orig);
  console.log('     resumen:', p.resumen);
  ok('R2 con los datos reales TODAS las llantas quedan identificadas (0 sin identificar)', p.noIdentificadas === 0, { llantasCve, p });
  ctx.completarMarcaLlantas_APLICAR();
  const h = hojas.Hoja1.grid;
  ok('R3 mismo número de renglones y columnas distintas a Producto intactas', h.length === grid.length && h.every((f, i) => f.every((x, j) => j === 9 || x === grid[i][j])));
  const cambiados = h.filter((f, i) => i > 0 && f[9] !== grid[i][9]);
  ok('R4 todo renglón cambiado conserva su descripción original completa y le agrega solo la marca al frente', cambiados.every(f => { const o = grid[h.indexOf(f)][9]; return f[9].endsWith(' ' + o.replace(/^\s+/, '')) && f[9].length > o.length; }), cambiados.length);
  ok('R5 no se tocó ningún renglón de servicio (Montaje, Balanceo, Paquetes…)', h.every((f, i) => i === 0 || (f[6] === 'Llantas' && !f[7] && !f[8]) ? f[9] === grid[i][9] : true));
  ctx.deshacerMarcaLlantas();
  ok('R6 DESHACER deja Hoja1 idéntica al original (7,159 renglones)', JSON.stringify(hojas.Hoja1.grid) === orig);
}

console.log(`\n${'='.repeat(45)}`);
console.log(`TOTAL: ${passed + failed} | ✅ ${passed} OK | ❌ ${failed} FALLIDAS`);
process.exit(failed ? 1 : 0);
