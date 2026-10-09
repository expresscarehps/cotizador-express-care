// ── TEST — Botón "OK" fijo en las llantas que ya están en la cotización (página real en jsdom) ──
// Uso:  node test_boton_ok.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', () => {});
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; } }
function abrir() {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
function buscarMedida(w, med) { const el = w.document.getElementById('qm'); el.value = med; el.dispatchEvent(new w.Event('input', { bubbles: true })); w.buscar(); }
const btns = w => Array.from(w.document.querySelectorAll('#res .badd[data-cve]'));
const verdes = w => btns(w).filter(b => b.textContent.indexOf('OK') >= 0);
const txt = b => b.textContent.trim();

(async () => {
  const w = abrir(); await wait(300);
  buscarMedida(w, '195'); 
  const B = btns(w);
  ok('A0 hay resultados para probar', B.length >= 10, B.length);
  console.log('\n— A. Estado inicial');
  ok('A1 ningún botón está en verde antes de agregar', verdes(w).length === 0);
  ok('A2 todos dicen "+"', B.every(b => txt(b) === '+'));

  console.log('\n— B. Al agregar una llanta con "+"');
  const cve3 = B[3].getAttribute('data-cve');
  B[3].click(); await wait(1300);   // más de 0.9 s: antes ya habría regresado a "+"
  const b3 = btns(w)[3];
  ok('B1 el botón de esa llanta queda "OK"', txt(b3) === 'OK', txt(b3));
  ok('B2 se queda en verde después de 1.3 s', b3.style.background.replace(/\s/g, '') === '#2e7d32' || /rgb\(46,125,50\)/.test(b3.style.background.replace(/\s/g, '')), b3.style.background);
  ok('B3 las demás siguen con "+"', btns(w).filter((b, i) => i !== 3).every(b => txt(b) === '+'));
  btns(w)[7].click(); btns(w)[9].click(); await wait(300);
  ok('B4 tres llantas agregadas → tres botones en verde', verdes(w).length === 3, verdes(w).length);

  console.log('\n— C. Al quitar del carrito');
  const idQuitar = w.cart.filter(c => c.t === 'l' && c.cve === cve3)[0].id;
  const x = w.document.querySelector('#ci .cx[data-id="' + idQuitar + '"]'); ok('C0 existe la X de esa llanta en el carrito', !!x);
  if (x) x.click(); await wait(200);
  ok('C1 al quitarla vuelve a "+"', txt(btns(w)[3]) === '+', txt(btns(w)[3]));
  ok('C2 las otras dos siguen en verde', verdes(w).length === 2, verdes(w).length);

  console.log('\n— D. Al volver a buscar / cambiar de medida');
  buscarMedida(w, '195'); await wait(100);
  ok('D1 al repetir la búsqueda, las que están en la cotización salen en verde', verdes(w).length === 2, verdes(w).length);
  buscarMedida(w, '205'); await wait(100);
  ok('D2 otra medida: ninguna en verde (no están en la cotización)', verdes(w).length === 0, verdes(w).length);

  console.log('\n— E. Opciones y nueva cotización');
  buscarMedida(w, '195'); await wait(100);
  const ch = w.document.querySelectorAll('#res .ochk'); ch[3].checked = true; ch[3].dispatchEvent(new w.Event('change', { bubbles: true }));
  ch[4].checked = true; ch[4].dispatchEvent(new w.Event('change', { bubbles: true }));
  const antes = w.cart.filter(c => c.t === 'l').length;
  w.document.getElementById('opc-add').click(); await wait(300);
  ok('E1 se agregaron opciones al carrito', w.cart.filter(c => c.op).length === 2, w.cart.filter(c => c.op).length);
  ok('E2 las llantas agregadas como opción salen en verde (las sueltas de antes se quitan por diseño: quedan solo las 2 opciones)', verdes(w).length === 2 && w.cart.filter(c => c.t === 'l' && !c.op).length === 0, verdes(w).length);
  w.cart.length = 0; w.renderCarrito(); await wait(100);
  ok('E3 carrito vacío → ninguna en verde', verdes(w).length === 0, verdes(w).length);

  console.log('\n— F. No se rompe lo demás');
  buscarMedida(w, '195'); btns(w)[1].click(); await wait(200);
  ok('F1 una llanta sola sigue llevando Montaje + Balanceo + Pivote', ['Montaje', 'Balanceo', 'Pivote'].every(n => w.cart.some(c => c.t === 's' && c.desc === n)));
  ok('F2 el precio de la llanta sola no lleva recargo', Math.round(w.cart.filter(c => c.t === 'l')[0].precio) === Math.round(w.cart.filter(c => c.t === 'l')[0].precioBase));
  ok('F3 la página tiene etiqueta de versión dev', /VERSION_PAGINA *= *'dev 2026-10-09/.test(html));
  console.log('\n=============================================');
  console.log('TOTAL: ' + (passed + failed) + ' | ✅ ' + passed + ' OK | ❌ ' + failed + ' FALLIDAS');
  process.exit(failed ? 1 : 0);
})();
