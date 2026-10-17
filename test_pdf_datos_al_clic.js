// ── TEST — El renglón de la Hoja1 usa los datos del CLIC de "Generar PDF" (17 oct 2026) ──
// Caso real: fila 7620 con asesor y origen vacíos porque la pantalla cambió mientras se pedía el folio.
// Regla de Carlos: al generar el PDF el folio ya se usó. Si la cotización cambia aunque sea una pieza, es cotización NUEVA
// (folio nuevo y Grupo nuevo). Un borrador cargado empieza limpio. La Ref se ve en el Historial. Uso: node test_un_folio_por_cotizacion.js [html]
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', () => {});

let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(failed ? 1 : 0); }
const html = fs.readFileSync(HTML, 'utf8');
function abrir(query, opc) {
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
        } else if (accion === 'getFolio') { const n = (reg.sigFolio = (reg.sigFolio || 12)); reg.sigFolio++; w[cb] && w[cb]({ status: 'ok', folio: 'EXPCARE-0' + n + '/26', numero: n }); }
        else if (accion === 'commitFolio') w[cb] && w[cb]({ status: 'ok' });
      }, 5);
      return el;
    }
    return orig(el);
  };
  if (!(opc && opc.pdfReal)) w.construirYDescargarPDF = function (folio) { reg.pdfs.push(folio); };   // pdfReal: deja el envoltorio del respaldo en Firebase
  return reg;
}
const $ = (r, id) => r.w.document.getElementById(id);
function llenar(r) {
  const set = (id, v) => { $(r, id).value = v; };
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
function conProducto(r, precio) {
  r.w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio || 550), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  r.w.generarWA();
}
const guardados = r => r.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
const acciones = r => r.scripts.map(s => s.accion);


const folios = r => guardados(r).map(c => c.body.folio);
function cambiarPrecio(r, precio) { conProducto(r, precio); }

(async () => {
  const ESC = [['A) la pantalla se limpia mientras se pide el folio', r => r.w.limpiarTodo(true)],
               ['B) se presiona "Nueva cotización" mientras se pide el folio', r => $(r, 'btn-nueva').click()],
               ['C) el asesor cambia el nombre, teléfono y asesor mientras se pide el folio', r => { $(r, 'cli-nombre').value = 'Otro Cliente'; $(r, 'cli-tel').value = '6149998877'; $(r, 'asesor').value = 'Xen'; $(r, 'cli-origen').value = 'Visita'; }]];
  for (const [nombre, accion] of ESC) {
    console.log('\n=== ' + nombre + ' ===');
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF();
    accion(r);
    await esperar(400);
    const g = guardados(r).filter(x => x.body.folio);
    const b = (g[g.length - 1] || {}).body || {};
    ok('1 se guardó un renglón con folio', g.length >= 1, g.length);
    ok('2 asesor = Ana (el del clic)', b.asesor === 'Ana', b.asesor);
    ok('3 origen = WhatsApp (el del clic)', b.origen === 'WhatsApp', b.origen);
    ok('4 teléfono = 6145550123 (el del clic)', b.telefono === '6145550123', b.telefono);
    ok('5 cliente = Cliente de Prueba y vehículo completo', b.cliente === 'Cliente de Prueba' && /Nissan Sentra 2020/.test(b.vehiculo || ''), [b.cliente, b.vehiculo]);
    ok('6 lleva Ref, grupo y versión (no vacíos)', !!b.ref && !!b.grupo && b.version >= 1, [b.ref, b.grupo, b.version]);
    ok('7 el renglón trae las piezas de la cotización del clic', (b.items || []).length >= 1, (b.items || []).length);
    ok('8 el PDF salió con el mismo folio que el renglón', r.pdfs.length === 1 && r.pdfs[0] === b.folio, [r.pdfs, b.folio]);
  }
  console.log('\n=== D) flujo normal (nadie toca la pantalla): sigue igual ===');
  const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
  r.w.generarPDF(); await esperar(400);
  const g = guardados(r).filter(x => x.body.folio); const b = (g[g.length - 1] || {}).body || {};
  ok('D1 renglón con folio, asesor, origen, teléfono y Ref', !!b.folio && b.asesor === 'Ana' && b.origen === 'WhatsApp' && b.telefono === '6145550123' && !!b.ref, b);
  ok('D2 versión 1 y grupo = Ref', b.version === 1 && b.grupo === b.ref, [b.version, b.grupo, b.ref]);
  ok('D3 el PDF salió con ese folio', r.pdfs[0] === b.folio, r.pdfs);
  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
