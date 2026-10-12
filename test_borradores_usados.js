// ── TEST — El borrador usado se quita de la lista al copiar o hacer PDF (11 oct 2026) ──
// Regla: si la cotización cargada desde un borrador YA SE USÓ (copiar para WhatsApp o PDF), el borrador sale de la lista.
// Si solo se carga y se revisa, el borrador se queda. Uso: node test_borradores_usados.js [html]
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
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6140000000'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
function conProducto(r, precio) {
  r.w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio || 550), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  r.w.generarWA();
}
const guardados = r => r.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
const acciones = r => r.scripts.map(s => s.accion);

const lista = r => JSON.parse(r.w.localStorage.getItem('expresscare_borradores') || '[]');
// arma una cotización, la guarda como borrador (la pantalla queda limpia) y devuelve el id del borrador
function hacerBorrador(r, precio, nombre) {
  llenar(r); if (nombre) $(r, 'cli-nombre').value = nombre; conProducto(r, precio);
  r.w.guardarBorrador();
  return lista(r)[0].id;
}
(async () => {
  console.log('\n=== BU-1. Solo cargar y revisar: el borrador SE QUEDA ===');
  {
    const r = abrir(); await esperar(80); const id = hacerBorrador(r);
    ok('U1 guardar borrador deja 1 en la lista', lista(r).length === 1, lista(r).length);
    r.w.cargarBorrador(id);
    ok('U2 al cargarlo, la página recuerda de cuál viene', r.w.borradorActivoId === id, r.w.borradorActivoId);
    ok('U3 cargado y sin copiar ni PDF: sigue en la lista', lista(r).length === 1, lista(r).length);
    r.w.limpiarTodo(true);
    ok('U4 "Nueva cotización" sin copiar: el borrador sigue en la lista y ya no hay borrador activo', lista(r).length === 1 && r.w.borradorActivoId === null, [lista(r).length, r.w.borradorActivoId]);
  }
  console.log('\n=== BU-2. Copiar para WhatsApp: el borrador se QUITA ===');
  {
    const r = abrir(); await esperar(80); const id = hacerBorrador(r);
    r.w.cargarBorrador(id); r.w.copiar(); await esperar(250);
    ok('U5 después de copiar, el borrador ya no está en la lista (memoria y navegador)', lista(r).length === 0 && r.w.borradores.length === 0, [lista(r).length, r.w.borradores.length]);
    ok('U6 el panel de borradores dice que no hay', /No hay borradores/.test($(r, 'panel-borradores').innerHTML), $(r, 'panel-borradores').innerHTML.slice(0, 120));
    ok('U7 avisa al asesor que se quitó (aviso visible en pantalla)', Array.from(r.w.document.body.children).some(e => e.tagName === 'DIV' && /Este borrador ya se us.* y se quit/.test(e.textContent)), 'sin aviso');
    ok('U8 la cotización sí se guardó y se copió normal', guardados(r).length === 1, guardados(r).length);
    r.w.copiar(); await esperar(120);
    ok('U9 copiar otra vez en la misma sesión no falla ni vuelve a tocar la lista', lista(r).length === 0, lista(r).length);
  }
  console.log('\n=== BU-3. Generar PDF: el borrador se QUITA ===');
  {
    const r = abrir(); await esperar(80); const id = hacerBorrador(r);
    r.w.cargarBorrador(id); r.w.generarPDF(); await esperar(300);
    ok('U10 el PDF salió con folio', r.pdfs.length === 1, r.pdfs);
    ok('U11 después del PDF, el borrador ya no está en la lista', lista(r).length === 0, lista(r).length);
  }
  console.log('\n=== BU-4. Solo se quita el borrador usado, no los demás ===');
  {
    const r = abrir(); await esperar(80);
    const idA = hacerBorrador(r, 550, 'Cliente A');
    const idB = hacerBorrador(r, 700, 'Cliente B');
    ok('U12 hay 2 borradores', lista(r).length === 2, lista(r).length);
    r.w.cargarBorrador(idB); r.w.copiar(); await esperar(250);
    ok('U13 se quitó solo B; A se queda', lista(r).length === 1 && lista(r)[0].id === idA, lista(r).map(b => b.id));
  }
  console.log('\n=== BU-5. Copiar una cotización que NO viene de borrador no toca los borradores ===');
  {
    const r = abrir(); await esperar(80); hacerBorrador(r, 550, 'Cliente A');
    llenar(r); conProducto(r, 900); r.w.copiar(); await esperar(250);
    ok('U14 el borrador guardado sigue ahí', lista(r).length === 1, lista(r).length);
  }
  console.log('\n=== BU-6. Cargar, copiar, y armar otra cosa: el borrador no vuelve ===');
  {
    const r = abrir(); await esperar(80); const id = hacerBorrador(r);
    r.w.cargarBorrador(id); r.w.copiar(); await esperar(250);
    r.w.cargarBorradores(); r.w.renderBorradores();
    ok('U15 recargar la lista desde el navegador tampoco lo trae de vuelta', lista(r).length === 0 && r.w.borradores.length === 0, [lista(r).length, r.w.borradores.length]);
  }
  console.log('\n=== BU-7. Modo de prueba (?test=1) se comporta igual ===');
  {
    const r = abrir('?test=1'); await esperar(80); const id = hacerBorrador(r);
    r.w.cargarBorrador(id); r.w.copiar(); await esperar(250);
    ok('U16 en modo prueba también se quita al copiar', lista(r).length === 0, lista(r).length);
  }
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
