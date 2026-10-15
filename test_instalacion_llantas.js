// ── TEST — instalación de llantas incluida en el precio (cambio 14 oct 2026) ──
// Paquete compra 4 llantas $480 (÷4 = +$120 c/u) · paquete compra 2 llantas $380 (÷2 = +$190 c/u) · 1 llanta: sin recargo.
// Uso:  node test_instalacion_llantas.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; } }).window;
  await wait(300);
  const doc = w.document;

  console.log('\n— Paquetes en el catálogo de servicios');
  const svc = {}; w.SVC.forEach(s => { svc[s.clave] = s; });
  ok('1 PAQ01 (paquete compra 4 llantas) = $480', svc.PAQ01 && svc.PAQ01.precio === 480, svc.PAQ01);
  ok('2 PAQ02 (paquete compra 2 llantas) = $380', svc.PAQ02 && svc.PAQ02.precio === 380, svc.PAQ02);
  ok('3 PAQ03 (servicio directo 4 llantas) no se tocó: $780', svc.PAQ03 && svc.PAQ03.precio === 780, svc.PAQ03);
  const btn = k => (doc.querySelector('#sg .sb[data-k="' + k + '"] .sp') || {}).textContent;
  ok('4 los botones de la pantalla muestran $480.00 y $380.00', btn('PAQ01') === '$480.00' && btn('PAQ02') === '$380.00', [btn('PAQ01'), btn('PAQ02')]);

  console.log('\n— Instalación incluida en el precio de cada llanta');
  const q = doc.getElementById('qm'); q.value = '185/55R15'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(100);
  const add = doc.querySelector('#res .badd[data-cve]'); add.click(); await wait(80);
  const llanta = () => w.cart.filter(c => c.t === 'l')[0];
  ok('5 hay una llanta en el carrito', !!llanta());
  const base = llanta().precioBase;
  for (const [n, rec] of [[1, 0], [2, 190], [3, 190], [4, 120], [5, 120], [8, 120]]) {
    w.setQty(llanta().id, n); await wait(30);
    const l = llanta();
    ok(n + ' llanta(s): recargo $' + rec + ' → precio unitario = base + ' + rec, w.instalacionInfo.recargo === rec && Math.abs(l.precio - (base + rec)) < 0.001, [w.instalacionInfo, l.precio, base]);
  }
  w.setQty(llanta().id, 1); await wait(30);
  ok('6 con 1 sola llanta se vuelven a cotizar Montaje + Balanceo + Pivote por separado', w.cart.filter(c => c.pid).length === 3, w.cart.filter(c => c.pid).map(c => c.desc));
  w.setQty(llanta().id, 4); await wait(30);
  ok('7 con 4 llantas NO hay líneas sueltas de Montaje/Balanceo/Pivote', w.cart.filter(c => c.pid).length === 0);
  ok('8 el total de 4 llantas sube exactamente 4 × $120 sobre el precio base', Math.abs(llanta().precio * 4 - (base * 4 + 480)) < 0.001, [llanta().precio, base]);
  w.setQty(llanta().id, 2); await wait(30);
  ok('9 el total de 2 llantas sube exactamente 2 × $190 = $380 sobre el precio base', Math.abs(llanta().precio * 2 - (base * 2 + 380)) < 0.001, [llanta().precio, base]);

  console.log('\n— Nota de precios de instalación según el rin (15 oct 2026: la nota inicial decía $88/$25)');
  const hint = () => (doc.getElementById('rh') || {}).textContent;
  const rinInicial = w.RIN[w.rin];
  // La nota se lee de la pantalla recién abierta (antes de tocar un rin), pero ya se tocaron cosas arriba; se verifica contra el HTML original.
  const hintHtml = (html.match(/<p class="hint" id="rh">([^<]*)<\/p>/) || [])[1];
  ok('10 al abrir la página la nota dice lo mismo que el rin elegido por defecto (13-16): $85 / $80 / $20', hintHtml === rinInicial.h && /Montaje \$85 - Balanceo \$80 - Pivote \$20/.test(hintHtml), [hintHtml, rinInicial.h]);
  for (const k of ['a', 'b', 'c']) {
    doc.querySelector('.rb[data-r="' + k + '"]').click(); await wait(20);
    const r = w.RIN[k];
    ok('11' + k + ' rin ' + k + ': la nota muestra los mismos montos que se cobran (Montaje $' + r.mon + ', Balanceo $' + r.bal + ', Pivote $' + r.piv + ')', hint() === 'Montaje $' + r.mon + ' - Balanceo $' + r.bal + ' - Pivote $' + r.piv + ' por llanta', hint());
  }
  doc.querySelector('.rb[data-r="a"]').click(); await wait(20);

  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
