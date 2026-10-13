// ── TEST — Cotización enviada se bloquea + botón OK no duplica (12 oct 2026) ──
// Copiar para WhatsApp o generar PDF = la cotización YA SE ENVIÓ: se ve pero no se edita; se hace otra con "Nueva cotización".
// Uso: node test_cotizacion_enviada.js [html]
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', () => {});

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
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
function conProducto(r, precio) {
  r.w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio || 550), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  r.w.generarWA();
}
const guardados = r => r.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
const acciones = r => r.scripts.map(s => s.accion);


const lista = r => JSON.parse(r.w.localStorage.getItem('expresscare_borradores') || '[]');
const PANELES = ['p-llantas', 'p-servicios', 'p-taller', 'p-cotizacion'];
const bloqueada = r => PANELES.every(id => $(r, id).hasAttribute('inert'));
const libre = r => PANELES.every(id => !$(r, id).hasAttribute('inert'));
const btnBorrador = r => r.w.document.querySelector('button[onclick="guardarBorrador()"]');
const bannerOn = r => { const b = $(r, 'banner-enviada'); return !!b && b.classList.contains('on') && b.textContent === 'Cotización enviada. Para hacer otra, presiona Nueva cotización.'; };
const botones = w => Array.from(w.document.querySelectorAll('#res .badd[data-cve]'));
async function buscarLlanta(r, medida) { const w = r.w; const q = w.document.getElementById('qm'); q.value = medida; q.dispatchEvent(new w.Event('input', { bubbles: true })); await esperar(80); }
(async () => {
  console.log('\n=== CE-1. Al COPIAR para WhatsApp la cotización se bloquea ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    ok('E1 antes de copiar: nada bloqueado y sin letrero', libre(r) && !bannerOn(r) && r.w.cotizacionEnviada === false && !btnBorrador(r).disabled);
    r.w.copiar(); await esperar(250);
    ok('E2 después de copiar: llantas, adicionales, taller y cotización quedan bloqueados', bloqueada(r) && r.w.cotizacionEnviada === true, PANELES.map(id => $(r, id).hasAttribute('inert')));
    ok('E3 aparece el letrero "Cotización enviada. Para hacer otra, presiona Nueva cotización."', bannerOn(r), $(r, 'banner-enviada') && $(r, 'banner-enviada').textContent);
    ok('E4 "Guardar borrador" queda deshabilitado', btnBorrador(r).disabled === true);
    ok('E5 la pestaña WhatsApp (copiar, PDF, Ya la envié, Nueva cotización) NO se bloquea', !$(r, 'p-whatsapp').hasAttribute('inert') && !$(r, 'bcp').disabled && !$(r, 'btn-pdf').disabled && !$(r, 'btn-nueva').disabled);
    ok('E6 las pestañas para navegar siguen activas', !$(r, 'tab-llantas').disabled && !$(r, 'tab-whatsapp').hasAttribute('inert'));
  }
  console.log('\n=== CE-2. Al generar el PDF también se bloquea ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(300);
    ok('E7 después del PDF queda bloqueada, con letrero', bloqueada(r) && bannerOn(r) && btnBorrador(r).disabled);
  }
  console.log('\n=== CE-3. Bloqueada, se puede copiar otra vez y generar el PDF (flujo copiar → PDF) ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.copiar(); await esperar(250);
    r.w.generarPDF(); await esperar(300);
    ok('E8 el PDF después de copiar sigue funcionando (folio y versión 2 guardados)', r.pdfs.length === 1 && guardados(r).length === 2 && guardados(r)[1].body.folio !== '', [r.pdfs, guardados(r).length]);
    r.w.copiar(); await esperar(150);
    ok('E9 copiar otra vez estando bloqueada no falla', bloqueada(r) && bannerOn(r));
  }
  console.log('\n=== CE-4. "Nueva cotización" desbloquea ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.copiar(); await esperar(250);
    r.w.limpiarTodo(true);
    ok('E10 todo se desbloquea, el letrero se esconde y Guardar borrador se habilita', libre(r) && !bannerOn(r) && r.w.cotizacionEnviada === false && !btnBorrador(r).disabled);
  }
  console.log('\n=== CE-5. Un borrador cargado es cotización nueva: desbloquea ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 700); r.w.guardarBorrador();
    const id = lista(r)[0].id;
    llenar(r); conProducto(r, 550); r.w.copiar(); await esperar(250);
    ok('E11 la cotización enviada está bloqueada', bloqueada(r));
    r.w.cargarBorrador(id);
    ok('E12 al cargar un borrador se desbloquea', libre(r) && !bannerOn(r) && !btnBorrador(r).disabled);
  }
  console.log('\n=== CE-6. Bloqueada no se puede guardar como borrador ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.copiar(); await esperar(250);
    r.w.guardarBorrador();
    ok('E13 guardarBorrador no crea nada estando enviada', lista(r).length === 0, lista(r).length);
  }
  console.log('\n=== CE-7. El botón OK ya no agrega otra línea de la misma llanta ===');
  {
    const r = abrir(); await esperar(80); llenar(r); const w = r.w; w.cart = []; w.renderCarrito();
    await buscarLlanta(r, '185/55R15');
    const b0 = botones(w)[0]; b0.click(); await esperar(60);
    const n1 = w.cart.filter(c => c.t === 'l').length;
    ok('E14 el primer clic agrega la llanta (1 línea) y queda en OK', n1 === 1 && botones(w)[0].textContent.trim() === 'OK', [n1, botones(w)[0].textContent]);
    botones(w)[0].click(); await esperar(60);
    const n2 = w.cart.filter(c => c.t === 'l').length;
    ok('E15 presionar OK otra vez NO agrega otra línea', n2 === 1, n2);
    ok('E16 avisa "Ya está en la cotización, cambia la cantidad en el carrito"', Array.from(w.document.body.children).some(e => e.tagName === 'DIV' && /Ya está en la cotización, cambia la cantidad en el carrito/.test(e.textContent)));
    const otra = botones(w).find(x => x.textContent.trim() === '+');
    if (otra) { otra.click(); await esperar(60); }
    ok('E17 otra llanta DISTINTA sí se agrega', !otra || w.cart.filter(c => c.t === 'l').length === 2, w.cart.filter(c => c.t === 'l').length);
    w.cart.find(c => c.t === 'l').qty = 4; w.recalcInstalacionLlantas(); w.renderCarrito();
    ok('E18 cambiar la cantidad en el carrito sí funciona (4 piezas, sigue 1 línea de esa llanta)', w.cart.filter(c => c.t === 'l' && c.qty === 4).length === 1);
  }
  console.log('\n=== CE-8. Defensa: bloqueada, addLlanta no agrega nada ===');
  {
    const r = abrir(); await esperar(80); llenar(r); const w = r.w; w.cart = []; w.renderCarrito();
    await buscarLlanta(r, '185/55R15'); botones(w)[0].click(); await esperar(60);
    conProducto(r, 550);   // taller para poder copiar
    w.copiar(); await esperar(250);
    const antes = w.cart.length;
    const nuevo = botones(w).find(x => x.textContent.trim() === '+'); if (nuevo) nuevo.click(); await esperar(60);
    ok('E19 estando enviada, un clic en "+" no agrega nada y avisa', w.cart.length === antes && Array.from(w.document.body.children).some(e => e.tagName === 'DIV' && /Cotización enviada/.test(e.textContent)), [w.cart.length, antes]);
  }
  console.log('\n=== CE-9. Modo de prueba (?test=1) igual ===');
  {
    const r = abrir('?test=1'); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.copiar(); await esperar(200);
    ok('E20 en modo prueba también se bloquea al copiar', bloqueada(r) && bannerOn(r));
  }
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
