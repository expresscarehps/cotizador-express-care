// ── TEST — Candado de cotización repetida para CUALQUIER cotización (WhatsApp / guardado normal / PDF) (11 oct 2026) ──
// Parte A: Apps Script (refExiste + candado en el servidor).   Parte B: la página real en jsdom.
// Uso: node test_candado_todas.js [html] [apps_script]
const fs = require('fs'), vm = require('vm');
const HTML = process.argv[2] || './cotizador_dev.html';
const SCRIPT = process.argv[3] || './apps_script_11_oct_26_candado_todas.js';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', () => {});

// ───────── Parte A: Apps Script ─────────
function hojaFalsa(grid) {
  const h = { grid, escrituras: 0, maxCols: 26, getMaxColumns() { return h.maxCols; }, insertColumnsAfter(p, n) { h.maxCols += n; },
    appendRow(f) { h.escrituras++; h.grid.push(f.slice()); }, getLastRow() { return h.grid.length; }, getDataRange() { return { getValues: () => h.grid.map(f => f.slice()) }; },
    getRange(r, c, nr, nc) { nr = nr || 1; nc = nc || 1;
      return {
        getValues() { const o = []; for (let i = 0; i < nr; i++) { const f = []; for (let j = 0; j < nc; j++) { const x = (h.grid[r - 1 + i] || [])[c - 1 + j]; f.push(x === undefined ? '' : x); } o.push(f); } return o; },
        setValues(v) { h.escrituras++; for (let i = 0; i < nr; i++) { while (h.grid.length < r + i) h.grid.push([]); const f = h.grid[r - 1 + i]; for (let j = 0; j < nc; j++) { while (f.length < c - 1 + j) f.push(''); f[c - 1 + j] = v[i][j]; } } },
        setValue(v) { h.escrituras++; while (h.grid.length < r) h.grid.push([]); const f = h.grid[r - 1]; while (f.length < c - 1) f.push(''); f[c - 1] = v; },
        setBorder() {} }; } };
  return h;
}
function libro(grid) {
  const hoja = hojaFalsa(grid);
  const ss = { getSheetByName: n => (n === 'Hoja1' ? hoja : null), insertSheet: () => hojaFalsa([]), getActiveSheet: () => hoja };
  const ctx = { console, Logger: { log() {} }, Utilities: { formatDate: () => '09/10/2026 13:04', base64Decode: () => [], newBlob: () => ({}) }, Session: { getScriptTimeZone: () => 'America/Chihuahua' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss }, ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: t => ({ contenido: t, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, DriveApp: {}, MailApp: {}, GmailApp: {}, PropertiesService: {} };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), ctx);
  return { ctx, hoja };
}
const enviar = (ctx, c) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(c) } }).contenido);
function existe(h, ref, callback) {
  const out = h.ctx.doGet({ parameter: Object.assign({ action: 'refExiste', ref }, callback ? { callback } : {}) }).contenido;
  return callback ? JSON.parse(out.replace(new RegExp('^' + callback + '\\(|\\)$', 'g'), '')) : JSON.parse(out);
}
function cot(extra) {
  const items = [{ tipo: 'Taller - Suspensión', proveedor: 'Autozone', noParte: '', producto: 'Amortiguador', cant: 2, costo: '1000', margen: '25%', precio: '1333.33', subtotal: '2666.66' },
                 { tipo: 'Taller - Suspensión', proveedor: '', noParte: '', producto: 'Mano de obra', cant: 2, costo: '', margen: 'M.O.', precio: '550', subtotal: '1100' }];
  return Object.assign({ action: 'saveCotizacion', fecha: '9/10/2026 09:42', asesor: 'Xen', cliente: 'Cliente Prueba', telefono: '6140000000', vehiculo: 'Nissan', origen: 'WhatsApp', total: '3766.66', folio: '', items }, extra || {});
}
const bloques = g => { const b = []; g.forEach((f, i) => { if (i > 0 && f[0]) b.push({ ref: f[18], ver: f[20], vig: f[21], folio: f[17] }); }); return b; };

console.log('\n=== CT-A1. Apps Script: acción refExiste (solo lee) ===');
{
  const h = libro([['Fecha']]);
  let r = existe(h, '1009-AAAAA'); ok('A1 Ref que no existe → found false', r.found === false, r);
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  const antes = JSON.stringify(h.hoja.grid), esc = h.hoja.escrituras;
  r = existe(h, '1009-AAAAA'); ok('A2 Ref guardado sin folio → found true, sin folio, versión 1', r.found === true && r.folio === '' && r.version === 1, r);
  ok('A3 devuelve fecha, asesor y cliente del primer renglón', r.asesor === 'Xen' && r.cliente === 'Cliente Prueba' && /2026/.test(r.fecha), r);
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 2, folio: 'EXPCARE-009/26' }));
  r = existe(h, '1009-AAAAA'); ok('A4 después del PDF devuelve el folio y la versión 2', r.found && r.folio === 'EXPCARE-009/26' && r.version === 2, r);
  r = existe(h, ''); ok('A5 Ref vacío → found false', r.found === false, r);
  r = existe(h, '1009-AAAAA', '_cb1'); ok('A6 con callback (JSONP) responde igual', r.found === true, r);
  const h2 = libro([['Fecha']]); enviar(h2.ctx, cot({ ref: '1009-BBBBB', grupo: '1009-BBBBB', version: 1 }));
  const a2 = JSON.stringify(h2.hoja.grid), e2 = h2.hoja.escrituras; existe(h2, '1009-BBBBB'); existe(h2, '1009-ZZZZZ');
  ok('A7 consultar no escribe nada en la hoja', JSON.stringify(h2.hoja.grid) === a2 && h2.hoja.escrituras === e2);
}
console.log('\n=== CT-A2. Apps Script: candado en el servidor al guardar ===');
{
  const h = libro([['Fecha']]);
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  const n1 = h.hoja.grid.length;
  const r = enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  ok('A8 la misma cotización (sin folio) guardada otra vez NO escribe renglones', h.hoja.grid.length === n1 && r.duplicado === true, [h.hoja.grid.length, n1, r]);
  ok('A9 sigue habiendo un solo bloque y Vigente vacío', bloques(h.hoja.grid).length === 1 && bloques(h.hoja.grid)[0].vig === '', bloques(h.hoja.grid));
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 2, folio: 'EXPCARE-009/26' }));
  const b = bloques(h.hoja.grid);
  ok('A10 el PDF de una cotización que solo se había copiado SÍ se guarda (versión 2 con folio)', b.length === 2 && b[1].ver === 2 && b[1].folio === 'EXPCARE-009/26' && b[0].vig === 'No', b);
  const n2 = h.hoja.grid.length;
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 3, folio: 'EXPCARE-009/26' }));
  ok('A11 el mismo folio con el mismo Ref enviado otra vez NO escribe', h.hoja.grid.length === n2, [h.hoja.grid.length, n2]);
  enviar(h.ctx, cot({ ref: '1009-AAAAA', grupo: '1009-AAAAA', version: 1 }));
  ok('A12 copiar de nuevo esa cotización (ya con folio) tampoco escribe', h.hoja.grid.length === n2, [h.hoja.grid.length, n2]);
  enviar(h.ctx, cot({ ref: '1009-CCCCC', grupo: '1009-CCCCC', version: 1 }));
  ok('A13 una cotización distinta (otro Ref) se guarda normal', bloques(h.hoja.grid).length === 3, bloques(h.hoja.grid).length);
  const h3 = libro([['Fecha']]);
  enviar(h3.ctx, cot()); enviar(h3.ctx, cot());
  ok('A14 sin Ref (página vieja) guarda siempre, exactamente como antes', h3.hoja.grid.length === 5 && h3.hoja.grid[1].length === 18, [h3.hoja.grid.length, h3.hoja.grid[1].length]);
}

// ───────── Parte B: la página ─────────
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(failed ? 1 : 0); }
const html = fs.readFileSync(HTML, 'utf8');
function abrir(query) {
  const reg = { fetch: [], alerts: [], scripts: [], pdfs: [], refs: {}, folios: {}, modo: 'respuesta', confirmaciones: [] };
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html' + (query || ''),
    beforeParse(w) {
      w.fetch = (u, o) => { let b = null; try { b = o && o.body ? JSON.parse(o.body) : null; } catch (e) { b = o && o.body; } reg.fetch.push({ u: String(u), body: b }); return Promise.resolve({ json: () => ({ status: 'ok' }), text: () => '' }); };
      w.alert = m => reg.alerts.push(String(m)); w.confirm = m => { reg.confirmaciones.push(String(m)); return true; }; w.document.execCommand = () => true;
      w.navigator.clipboard = { writeText: () => Promise.resolve() };
    } });
  const w = dom.window; reg.w = w;
  const orig = w.document.body.appendChild.bind(w.document.body);
  w.document.body.appendChild = function (el) {
    if (el && el.tagName === 'SCRIPT' && /script\.google\.com/.test(el.src || '')) {
      const u = new URL(el.src); const accion = u.searchParams.get('action'); const cb = u.searchParams.get('callback'); const ref = u.searchParams.get('ref');
      reg.scripts.push({ accion, ref });
      setTimeout(() => {
        if (accion === 'refExiste') {
          if (reg.modo === 'error') el.onerror && el.onerror();
          else { const i = reg.refs[ref]; w[cb] && w[cb](i ? Object.assign({ status: 'ok', found: true, folio: '', version: 1, fecha: '09/10/2026 13:04', asesor: 'Xen', cliente: 'X' }, i) : { status: 'ok', found: false, folio: '' }); }
        } else if (accion === 'refFolio') {
          if (reg.modo === 'error') el.onerror && el.onerror();
          else { const f = reg.folios[ref] || (reg.refs[ref] && reg.refs[ref].folio); w[cb] && w[cb]({ status: 'ok', found: !!f, folio: f || '' }); }
        } else if (accion === 'getFolio') w[cb] && w[cb]({ status: 'ok', folio: 'EXPCARE-012/26', numero: 12 });
        else if (accion === 'commitFolio') w[cb] && w[cb]({ status: 'ok' });
      }, 5);
      return el;
    }
    return orig(el);
  };
  w.construirYDescargarPDF = function (folio) { reg.pdfs.push(folio); };
  return reg;
}
const $ = (r, id) => r.w.document.getElementById(id);
function llenar(r) {
  const set = (id, v) => { $(r, id).value = v; };
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6140000000'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
function conProducto(r, precio) {
  r.w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio || 550), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  r.w.generarWA();
}
const guardados = r => r.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
const acciones = r => r.scripts.map(s => s.accion);

(async () => {
  console.log('\n=== CT-B1. Copiar para WhatsApp: cotización NUEVA se guarda como siempre ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    r.w.copiar(); await esperar(250);
    ok('B1 consultó refExiste con el Ref actual', r.scripts.length === 1 && r.scripts[0].accion === 'refExiste' && r.scripts[0].ref === r.w.refVigente, r.scripts);
    ok('B2 guardó UN renglón de cotización sin folio', guardados(r).length === 1 && guardados(r)[0].body.folio === '' && guardados(r)[0].body.ref === r.w.refVigente, guardados(r).length);
    ok('B3 sin aviso de repetida', r.alerts.length === 0, r.alerts);
    r.w.copiar(); await esperar(150);
    ok('B4 copiar otra vez en la misma sesión: sin otra consulta ni otro guardado', r.scripts.length === 1 && guardados(r).length === 1 && r.alerts.length === 0, [r.scripts.length, guardados(r).length, r.alerts]);
  }
  console.log('\n=== CT-B2. Copiar para WhatsApp: cotización REPETIDA (ya está en el Sheet, otra sesión) ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    r.refs[r.w.refVigente] = { folio: '', version: 1, asesor: 'Xen' };
    r.w.copiar(); await esperar(250);
    ok('B5 avisa "Cotización repetida" con Ref, fecha y asesor', r.alerts.length === 1 && /Cotización repetida/.test(r.alerts[0]) && r.alerts[0].indexOf(r.w.refVigente) >= 0 && /Xen/.test(r.alerts[0]) && /09\/10\/2026/.test(r.alerts[0]), r.alerts);
    ok('B6 NO guarda otro renglón en el Sheet', guardados(r).length === 0, guardados(r).length);
    ok('B7 el letrero queda como "Guardada" (ya está registrada)', /Guardada/.test($(r, 'estado-guardado').innerHTML) && r.w.guardadoInfo.ref === r.w.refVigente, $(r, 'estado-guardado').innerHTML);
    ok('B8 el texto sí queda copiado y "Ya la envié" se habilita (el aviso no estorba al asesor)', $(r, 'btn-ya-envie').disabled === false, $(r, 'btn-ya-envie').disabled);
    r.w.copiar(); await esperar(120);
    ok('B9 copiar otra vez: no repite el aviso ni la consulta', r.alerts.length === 1 && r.scripts.length === 1, [r.alerts.length, r.scripts.length]);
  }
  console.log('\n=== CT-B3. Repetida y ya con folio: lo dice ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    r.refs[r.w.refVigente] = { folio: 'EXPCARE-009/26', version: 2 };
    r.w.copiar(); await esperar(250);
    ok('B10 el aviso menciona el folio existente', /EXPCARE-009\/26/.test(r.alerts[0] || ''), r.alerts);
    ok('B11 el letrero dice "con folio"', /con folio/.test($(r, 'estado-guardado').innerHTML), $(r, 'estado-guardado').innerHTML);
  }
  console.log('\n=== CT-B4. PDF de una cotización que antes solo se copió (sin folio) SÍ se permite ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    r.refs[r.w.refVigente] = { folio: '', version: 1 };
    r.w.generarPDF(); await esperar(300);
    ok('B12 sin aviso de repetida (aún no tiene folio)', r.alerts.length === 0, r.alerts);
    ok('B13 pide folio, lo confirma y guarda la versión con folio', acciones(r).includes('getFolio') && acciones(r).includes('commitFolio') && guardados(r).length === 1 && guardados(r)[0].body.folio === 'EXPCARE-012/26', [acciones(r), guardados(r).length]);
    ok('B14 el PDF sale con el folio nuevo', r.pdfs.length === 1 && r.pdfs[0] === 'EXPCARE-012/26', r.pdfs);
  }
  console.log('\n=== CT-B5. Después de copiar normal, el PDF en la misma sesión sigue funcionando ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    r.w.copiar(); await esperar(250);
    r.w.generarPDF(); await esperar(300);
    ok('B15 el PDF genera folio nuevo y guarda la versión 2 con folio (no se considera repetida)', r.alerts.length === 0 && guardados(r).length === 2 && guardados(r)[1].body.folio === 'EXPCARE-012/26', [r.alerts, guardados(r).map(g => g.body.folio)]);
  }
  console.log('\n=== CT-B6. "Nueva cotización" con una cotización ya guardada: no estorba ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    r.refs[r.w.refVigente] = { folio: '', version: 1 };
    r.w.nuevaCotizacionConCandado(); await esperar(250);
    ok('B16 no muestra aviso de repetida al limpiar (modo silencioso)', r.alerts.length === 0, r.alerts);
    ok('B17 no escribió nada en el Sheet', guardados(r).length === 0, guardados(r).length);
  }
  console.log('\n=== CT-B7. Si la consulta falla, NO se bloquea el trabajo ===');
  {
    const r = abrir(); r.modo = 'error'; await esperar(80); llenar(r); conProducto(r);
    r.w.copiar(); await esperar(300);
    ok('B18 con error de red igual guarda como siempre (el Apps Script lo vigila)', guardados(r).length === 1 && r.alerts.length === 0, [guardados(r).length, r.alerts]);
  }
  console.log('\n=== CT-B8. Modo prueba (?test=1) no consulta ni escribe ===');
  {
    const r = abrir('?test=1'); await esperar(80); llenar(r); conProducto(r);
    r.w.copiar(); await esperar(200);
    ok('B19 sin consulta al Sheet y sin guardado real', r.scripts.length === 0 && guardados(r).length === 0, [acciones(r), guardados(r).length]);
  }
  console.log('\n=== CT-B9. Cotización distinta (otro Ref) no es repetida ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.refs[r.w.refVigente] = { folio: '', version: 1 };
    conProducto(r, 600);
    r.w.copiar(); await esperar(250);
    ok('B20 con otro precio se guarda como cotización nueva, sin aviso', guardados(r).length === 1 && r.alerts.length === 0, [guardados(r).length, r.alerts]);
  }
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
