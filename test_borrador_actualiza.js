// ── TEST — "Guardar borrador" sobre un borrador cargado lo ACTUALIZA, no crea otro (21 nov 2026) ──
// Uso: node test_borrador_actualiza.js [html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on("unhandledRejection", (e) => { console.log("ERROR NO CONTROLADO:", e && e.stack || e); process.exit(1); });
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
const html = fs.readFileSync(HTML, 'utf8');
function abrir() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } });
  return dom.window;
}
const lista = w => JSON.parse(w.localStorage.getItem(w.BORR_KEY) || '[]');
function llenar(w, nombre, precio) {
  const set = (id, v) => { w.document.getElementById(id).value = v; };
  set('cli-nombre', nombre); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
  w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  w.generarWA();
}

(async () => {
  console.log('\n— A. Cargar un borrador, cambiarlo y guardarlo: se actualiza el mismo');
  let w = abrir(); await esperar(100);
  llenar(w, 'Cliente Uno', 500); w.guardarBorrador();
  const id1 = lista(w)[0].id;
  ok('A1 el primer guardado crea 1 borrador', lista(w).length === 1, lista(w).length);
  w.cargarBorrador(id1);
  llenar(w, 'Cliente Uno Corregido', 900); w.guardarBorrador();
  const l = lista(w);
  ok('A2 sigue habiendo 1 solo borrador (no se duplicó)', l.length === 1, l.length);
  ok('A3 conserva el mismo id', l[0].id === id1, [l[0].id, id1]);
  ok('A4 trae los datos nuevos (nombre y precio)', l[0].cliente === 'Cliente Uno Corregido' && l[0].tallerItems[0].precio === '900', [l[0].cliente, l[0].tallerItems[0].precio]);
  ok('A5 la pantalla queda limpia, sin borrador activo', w.borradorActivoId === null);

  console.log('\n— B. Se puede repetir las veces que haga falta');
  w.cargarBorrador(id1); llenar(w, 'Cliente Uno Corregido', 1100); w.guardarBorrador();
  w.cargarBorrador(id1); llenar(w, 'Cliente Uno Corregido', 1300); w.guardarBorrador();
  ok('B1 tras 3 ediciones sigue 1 borrador con el último precio', lista(w).length === 1 && lista(w)[0].tallerItems[0].precio === '1300', [lista(w).length, lista(w)[0].tallerItems[0].precio]);

  console.log('\n— C. Los demás borradores no se tocan y el actualizado sube al primer lugar');
  w = abrir(); await esperar(100);
  llenar(w, 'Cliente A', 100); w.guardarBorrador(); const idA = lista(w)[0].id;
  llenar(w, 'Cliente B', 200); w.guardarBorrador(); const idB = lista(w)[0].id;
  llenar(w, 'Cliente C', 300); w.guardarBorrador();
  ok('C1 hay 3 borradores', lista(w).length === 3, lista(w).length);
  w.cargarBorrador(idA); llenar(w, 'Cliente A editado', 150); w.guardarBorrador();
  const lc = lista(w);
  ok('C2 siguen 3 borradores', lc.length === 3, lc.length);
  ok('C3 A quedó primero con su dato nuevo', lc[0].id === idA && lc[0].cliente === 'Cliente A editado', [lc[0].id, lc[0].cliente]);
  ok('C4 B y C siguen igual', lc.some(b => b.id === idB && b.cliente === 'Cliente B') && lc.some(b => b.cliente === 'Cliente C'), lc.map(b => b.cliente));

  console.log('\n— D. Sin borrador cargado se crea uno nuevo, como siempre');
  llenar(w, 'Cliente D', 400); w.guardarBorrador();
  ok('D1 ahora hay 4 borradores', lista(w).length === 4, lista(w).length);

  console.log('\n— E. Si el borrador cargado ya no está en la lista, se crea uno nuevo (no se pierde el avance)');
  w = abrir(); await esperar(100);
  llenar(w, 'Cliente E', 500); w.guardarBorrador(); const idE = lista(w)[0].id;
  w.cargarBorrador(idE);
  w.localStorage.setItem(w.BORR_KEY, '[]');   // alguien lo eliminó desde otra pestaña
  llenar(w, 'Cliente E', 700); w.guardarBorrador();
  ok('E1 se guardó como borrador nuevo con el avance', lista(w).length === 1 && lista(w)[0].tallerItems[0].precio === '700', lista(w).length);

  console.log('\n— F. "Eliminar" y "Nueva cotización" siguen igual');
  w = abrir(); await esperar(100);
  llenar(w, 'Cliente F', 100); w.guardarBorrador(); const idF = lista(w)[0].id;
  w.eliminarBorrador(idF);
  ok('F1 eliminar borrador lo quita', lista(w).length === 0, lista(w).length);

  console.log('\n' + (failed ? '❌' : '✅') + ' ' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
