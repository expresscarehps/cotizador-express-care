// ── TEST — Candado de cotización repetida (11 oct 2026) ─────────────────────────────────
// Parte A: Apps Script, acción refFolio (solo lee).   Parte B: la página real en jsdom.
// Uso: node test_candado_folio.js [html] [apps_script] [hoja1_filas.json]
const fs = require('fs'), vm = require('vm');
const HTML = process.argv[2] || './cotizador_dev.html';
const SCRIPT = process.argv[3] || './apps_script_11_oct_26_candado_folio.js';
const FILAS = process.argv[4] || '';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', () => {});

// ───────── Parte A: Apps Script ─────────
function libro(grid) {
  const hoja = { grid, escrituras: 0, getLastRow() { return grid.length; }, getDataRange() { return { getValues: () => grid.map(f => f.slice()) }; },
    getRange() { hoja.escrituras++; return { getValues: () => [[]], setValue() { hoja.escrituras++; }, setValues() { hoja.escrituras++; } }; }, appendRow() { hoja.escrituras++; } };
  const ss = { getSheetByName: () => hoja, getActiveSheet: () => hoja, insertSheet: () => hoja };
  const ctx = { console, Logger: { log() {} }, Utilities: {}, Session: { getScriptTimeZone: () => 'America/Chihuahua' }, SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: t => ({ contenido: t, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, DriveApp: {}, MailApp: {}, GmailApp: {}, PropertiesService: {} };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), ctx);
  return { ctx, hoja };
}
function pedir(h, ref, callback) {
  const out = h.ctx.doGet({ parameter: Object.assign({ action: 'refFolio', ref }, callback ? { callback } : {}) }).contenido;
  return callback ? JSON.parse(out.replace(new RegExp('^' + callback + '\\(|\\)$', 'g'), '')) : JSON.parse(out);
}
console.log('\n=== CF-A. Apps Script: acción refFolio ===');
{
  const fila = (f, folio, ref, ver) => { const r = new Array(24).fill(''); r[0] = f; r[17] = folio; r[18] = ref; r[19] = ref; r[20] = ver; return r; };
  const grid = [new Array(24).fill('Enc'),
    fila('9/10/2026 1:03 p.m.', '', '1009-AAAAA', 1), fila('', '', '1009-AAAAA', 1),
    fila('9/10/2026 1:04 p.m.', 'EXPCARE-009/26', '1009-AAAAA', 2), fila('', '', '1009-AAAAA', 2),
    fila('9/10/2026 2:00 p.m.', '', '1009-BBBBB', 1),
    fila('9/10/2026 3:00 p.m.', 'EXPCARE-010/26', '1009-CCCCC', 1)];
  const h = libro(grid);
  let r = pedir(h, '1009-AAAAA'); ok('A1 Ref con folio (en la versión 2) → found y folio', r.found === true && r.folio === 'EXPCARE-009/26', r);
  r = pedir(h, '1009-BBBBB'); ok('A2 Ref guardado sin folio → found false', r.found === false && r.folio === '', r);
  r = pedir(h, '1009-ZZZZZ'); ok('A3 Ref que no existe → found false', r.found === false, r);
  r = pedir(h, ''); ok('A4 Ref vacío → found false (no confunde renglones sin Ref)', r.found === false, r);
  r = pedir(h, '1009-CCCCC', '_cb123'); ok('A5 con callback (JSONP) responde igual', r.found === true && r.folio === 'EXPCARE-010/26', r);
  ok('A6 solo lee: no escribió nada en la hoja', h.hoja.escrituras === 0, h.hoja.escrituras);
  const f1 = h.ctx.doGet({ parameter: { action: 'getFolio' } }); ok('A7 getFolio sigue respondiendo', JSON.parse(f1.contenido).status === 'ok');
}
if (FILAS && fs.existsSync(FILAS)) {
  const g = JSON.parse(fs.readFileSync(FILAS, 'utf8'));
  const h = libro(g.map(f => f.slice()));
  const molino = pedir(h, '1009-F5NGK'), pedro = pedir(h, '1009-FERZY');
  ok('A8 hoja real: Molino 1009-F5NGK → EXPCARE-009/26', molino.found && molino.folio === 'EXPCARE-009/26', molino);
  ok('A9 hoja real: Pedro 1009-FERZY (sin folio) → found false', pedro.found === false, pedro);
  ok('A10 hoja real: no escribió nada', h.hoja.escrituras === 0);
}

// ───────── Parte B: la página ─────────
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(failed ? 1 : 0); }
const html = fs.readFileSync(HTML, 'utf8');
function abrir(query, folios) {
  const reg = { fetch: [], alerts: [], scripts: [], pdfs: [], folios: folios || {}, modoRefFolio: 'respuesta' };
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html' + (query || ''),
    beforeParse(w) {
      w.fetch = (u, o) => { let b = null; try { b = o && o.body ? JSON.parse(o.body) : null; } catch (e) { b = o && o.body; } reg.fetch.push({ u: String(u), body: b }); return Promise.resolve({ json: () => ({ status: 'ok' }), text: () => '' }); };
      w.alert = m => reg.alerts.push(String(m)); w.confirm = () => true; w.document.execCommand = () => true;
    } });
  const w = dom.window; reg.w = w;
  // Intercepta los <script src=...> de JSONP y responde como lo haría el Apps Script
  const orig = w.document.body.appendChild.bind(w.document.body);
  w.document.body.appendChild = function (el) {
    if (el && el.tagName === 'SCRIPT' && /script\.google\.com/.test(el.src || '')) {
      const u = new URL(el.src); const accion = u.searchParams.get('action'); const cb = u.searchParams.get('callback');
      reg.scripts.push({ accion, ref: u.searchParams.get('ref'), numero: u.searchParams.get('numero') });
      setTimeout(() => {
        if (accion === 'refFolio') {
          if (reg.modoRefFolio === 'error') { el.onerror && el.onerror(); }
          else if (reg.modoRefFolio === 'respuesta') { const f = reg.folios[u.searchParams.get('ref')]; w[cb] && w[cb]({ status: 'ok', found: !!f, folio: f || '' }); }
        } else if (accion === 'getFolio') w[cb] && w[cb]({ status: 'ok', folio: 'EXPCARE-012/26', numero: 12 });
        else if (accion === 'commitFolio') w[cb] && w[cb]({ status: 'ok' });
      }, 5);
      return el;
    }
    return orig(el);
  };
  w.construirYDescargarPDF = function (folio) { reg.pdfs.push(folio); };   // jsPDF no corre en jsdom
  return reg;
}
const $ = (r, id) => r.w.document.getElementById(id);
function llenar(r, o) {
  o = Object.assign({ nombre: 'Cliente de Prueba', tel: '6140000000', origen: 'WhatsApp', asesor: 'Ana', marca: 'Nissan', modelo: 'Sentra', anio: '2020', cil: '4' }, o || {});
  const set = (id, v) => { $(r, id).value = v; };
  set('cli-nombre', o.nombre); set('cli-tel', o.tel); set('cli-origen', o.origen); set('asesor', o.asesor);
  set('v-marca', o.marca); set('v-modelo', o.modelo); set('v-anio', o.anio); set('v-cil', o.cil);
}
function conProducto(r, precio) {
  r.w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio || 550), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  r.w.generarWA();
}
const guardados = r => r.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
const acciones = r => r.scripts.map(s => s.accion);

(async () => {
  console.log('\n=== CF-B1. Cotización repetida (ya tiene folio) ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    const ref = r.w.refVigente; r.folios[ref] = 'EXPCARE-009/26';
    r.w.generarPDF(); await esperar(120);
    ok('B1 consultó el Ref correcto', r.scripts[0] && r.scripts[0].accion === 'refFolio' && r.scripts[0].ref === ref, r.scripts);
    ok('B2 mostró el aviso "Cotización repetida" con el folio existente', r.alerts.length === 1 && /Cotización repetida/.test(r.alerts[0]) && /EXPCARE-009\/26/.test(r.alerts[0]), r.alerts);
    ok('B3 NO pidió folio nuevo ni lo consumió', !acciones(r).includes('getFolio') && !acciones(r).includes('commitFolio'), acciones(r));
    ok('B4 NO guardó otro renglón en el Sheet', guardados(r).length === 0, guardados(r).length);
    ok('B5 el PDF se genera con el MISMO folio', r.pdfs.length === 1 && r.pdfs[0] === 'EXPCARE-009/26', r.pdfs);
    ok('B6 no vuelve a subir el PDF a Drive', r.w.pdfYaSubidoDrive === true);
    r.w.generarPDF(); await esperar(80);
    ok('B7 segundo clic en la misma sesión: sin otra consulta, sin aviso nuevo, PDF otra vez', r.scripts.length === 1 && r.alerts.length === 1 && r.pdfs.length === 2, [r.scripts.length, r.alerts.length, r.pdfs.length]);
  }
  console.log('\n=== CF-B2. Cotización nueva (sin folio) sigue igual que siempre ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r);
    r.w.generarPDF(); await esperar(200);
    ok('B8 orden: refFolio → getFolio → commitFolio', JSON.stringify(acciones(r)) === JSON.stringify(['refFolio', 'getFolio', 'commitFolio']), acciones(r));
    ok('B9 no hubo aviso de repetida', r.alerts.length === 0, r.alerts);
    const g = guardados(r);
    ok('B10 guardó UN renglón de cotización con el folio nuevo', g.length === 1 && g[0].body.folio === 'EXPCARE-012/26', g.map(x => x.body && x.body.folio));
    ok('B11 el PDF sale con el folio nuevo', r.pdfs.length === 1 && r.pdfs[0] === 'EXPCARE-012/26', r.pdfs);
    r.w.generarPDF(); await esperar(100);
    ok('B12 segundo clic en la misma sesión: no consulta ni pide folio otra vez', acciones(r).length === 3 && guardados(r).length === 1 && r.pdfs.length === 2, [acciones(r).length, guardados(r).length]);
  }
  console.log('\n=== CF-B3. Misma cotización con un cambio → Ref distinto → no es repetida ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    const refA = r.w.refVigente; r.folios[refA] = 'EXPCARE-009/26';
    conProducto(r, 600); const refB = r.w.refVigente;
    ok('B13 con otro precio el Ref cambia', refA !== refB, [refA, refB]);
    r.w.generarPDF(); await esperar(200);
    ok('B14 se trata como cotización nueva (pide folio, sin aviso)', acciones(r).includes('getFolio') && r.alerts.length === 0, [acciones(r), r.alerts]);
  }
  console.log('\n=== CF-B4. Si la consulta falla, el trabajo NO se bloquea ===');
  {
    const r = abrir(); r.modoRefFolio = 'error'; await esperar(80); llenar(r); conProducto(r);
    r.w.generarPDF(); await esperar(200);
    ok('B15 con error de red igual genera folio y PDF como siempre', acciones(r).includes('getFolio') && r.pdfs.length === 1 && r.alerts.length === 0, [acciones(r), r.pdfs, r.alerts]);
  }
  console.log('\n=== CF-B5. Modo prueba (?test=1) no consulta nada ===');
  {
    const r = abrir('?test=1'); await esperar(80); llenar(r); conProducto(r);
    r.w.generarPDF(); await esperar(150);
    ok('B16 no consulta, no pide folio real, no guarda', r.scripts.length === 0 && guardados(r).length === 0, [acciones(r), guardados(r).length]);
    ok('B17 aun así genera el PDF de prueba', r.pdfs.length === 1 && /^PRUEBA-/.test(r.pdfs[0]), r.pdfs);
  }
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
