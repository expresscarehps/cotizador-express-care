// ── TEST — Michelin: recargo de instalación con 35% menos (cambio 19 oct 2026) ──
// Regla: 4+ llantas → recargo $120 (Michelin $78) · 2 o 3 llantas → $190 (Michelin $123.50) · 1 llanta sin recargo.
// Las demás marcas siguen con el recargo completo. Margen de Servillantas/VEGA: 12.5% parejo.
// Uso:  node test_michelin_instalacion.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
const cerca = (a, b) => Math.abs(a - b) < 0.005;
(async () => {
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; } }).window;
  await wait(300);
  const doc = w.document;
  const buscar = async med => { const q = doc.getElementById('qm'); q.value = med; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(120); };
  const agregar = async cve => { const b = doc.querySelector('#res .badd[data-cve="' + cve + '"]'); if (!b) return false; b.click(); await wait(80); return true; };
  const llantas = () => w.cart.filter(c => c.t === 'l');

  console.log('\n— Constantes y detección de Michelin');
  ok('1 descuento de instalación Michelin = 35', w.DESC_INSTALACION_MICHELIN === 35);
  ok('2 esMichelin detecta MICHELIN (con espacios y minúsculas)', w.esMichelin({ marca: 'MICHELIN' }) && w.esMichelin({ marca: ' michelin ' }));
  ok('3 esMichelin NO detecta BFGOODRICH, UNIROYAL ni vacío', !w.esMichelin({ marca: 'BFGOODRICH' }) && !w.esMichelin({ marca: 'UNIROYAL' }) && !w.esMichelin({}) && !w.esMichelin(null));

  console.log('\n— Michelin 205/55R16 (AY42495, lista $3,054) contado');
  w.pago = 'contado';
  await buscar('205/55R16');
  ok('4 se agrega la Michelin AY42495 al carrito', await agregar('AY42495'), llantas().length);
  const m = () => llantas()[0];
  const base = 3054 * 0.75 * 1.16;
  ok('5 precio base AYALA contado = lista × 0.75 × 1.16', cerca(m().precioBase, base), m().precioBase);
  for (const [n, rec] of [[1, 0], [2, 123.5], [3, 123.5], [4, 78], [6, 78], [8, 78]]) {
    w.setQty(m().id, n); await wait(30);
    ok(n + ' llanta(s) Michelin: recargo +$' + rec + ' → ' + (base + rec).toFixed(2), cerca(m().precio, base + rec), [m().precio, base + rec]);
  }
  w.setQty(m().id, 4); await wait(30);
  ok('6 con 4 Michelin el total del juego = 4 × base + 4 × $78', cerca(m().precio * 4, base * 4 + 312), m().precio * 4);
  ok('7 instalacionInfo.recargo sigue siendo el recargo completo ($120) para los avisos de la cotización', w.instalacionInfo.recargo === 120 && w.instalacionInfo.totalQty === 4, w.instalacionInfo);
  w.setQty(m().id, 1); await wait(30);
  ok('8 con 1 Michelin: sin recargo y vuelven Montaje + Balanceo + Pivote', cerca(m().precio, base) && w.cart.filter(c => c.pid).length === 3, w.cart.filter(c => c.pid).length);
  w.setQty(m().id, 4); await wait(30);
  ok('9 con 4 Michelin no hay líneas sueltas de instalación', w.cart.filter(c => c.pid).length === 0);

  console.log('\n— Michelin a meses sin intereses');
  w.pago = 'meses'; w.recalcPVP(); await wait(50);
  const baseM = 3054 * 0.80 * 1.16;
  ok('10 a meses: base = lista × 0.80 × 1.16 y recargo Michelin $78', cerca(m().precioBase, baseM) && cerca(m().precio, baseM + 78), [m().precioBase, m().precio]);
  w.pago = 'contado'; w.recalcPVP(); await wait(50);
  ok('11 al volver a contado se recalcula con $78', cerca(m().precio, base + 78), m().precio);

  console.log('\n— Mezcla: Michelin + otra marca (4 llantas en total)');
  w.setQty(m().id, 2); await wait(30);
  await buscar('205/55R16');
  const otra = Array.from(doc.querySelectorAll('#res .badd[data-cve]')).map(b => b.getAttribute('data-cve')).find(c => !/^AY/.test(c));
  ok('12 hay una llanta no-AYALA de la misma medida', !!otra, otra);
  await agregar(otra);
  const o = llantas().find(l => !l.isAyala);
  w.setQty(o.id, 2); await wait(30);
  ok('13 total 4 llantas: la otra marca lleva el recargo completo (+$120)', w.instalacionInfo.totalQty === 4 && cerca(o.precio, o.precioBase + 120), [o.precio, o.precioBase, w.instalacionInfo]);
  ok('14 total 4 llantas: la Michelin lleva +$78', cerca(llantas().find(l => l.isAyala).precio, base + 78));
  w.removeCartItem(o.id); await wait(30);

  console.log('\n— Otra marca de AYALA (BFGoodrich) NO recibe el descuento');
  w.removeCartItem(m().id); await wait(30);
  await buscar('265/70R17');
  ok('15 se agrega BFGoodrich AY09100', await agregar('AY09100'), llantas().length);
  const bf = llantas()[0];
  w.setQty(bf.id, 4); await wait(30);
  ok('16 BFGoodrich con 4 llantas: recargo completo +$120', cerca(bf.precio, bf.precioBase + 120), [bf.precio, bf.precioBase]);
  w.removeCartItem(bf.id); await wait(30);

  console.log('\n— Margen 12.5% parejo en Servillantas / VEGA');
  ok('17 ninguna marca del catálogo tiene margen distinto de 12.5', Object.keys(w.BRAND_DB).every(k => w.margenLlanta(k) === 12.5));
  ok('18 SUNFULL y YOKOHAMA 12.5', w.margenLlanta('SUNFULL') === 12.5 && w.margenLlanta('YOKOHAMA') === 12.5);
  w.pago = 'contado';
  ok('19 pvpLlanta(1000) de una marca "económica" = 1142.86', cerca(w.pvpLlanta(1000, 'ZWARTHZ'), 1000 / 0.875), w.pvpLlanta(1000, 'ZWARTHZ'));
  ok('20 AYALA no cambió: pvpAyala(7560) contado = 7560 × 0.75 × 1.16', cerca(w.pvpAyala(7560), 7560 * 0.75 * 1.16));

  console.log('\n— Texto de WhatsApp con Michelin (4 llantas)');
  await buscar('205/55R16'); await agregar('AY42495'); w.setQty(llantas()[0].id, 4); await wait(50);
  w.generarWA();
  const wa = (doc.getElementById('wt') || {}).value || (doc.getElementById('wt') || {}).textContent || '';
  ok('21 el mensaje conserva "INSTALACIÓN GRATIS" y la revisión de seguridad', /INSTALACIÓN GRATIS/.test(wa) && /Revisión de seguridad SIN COSTO/.test(wa), wa.slice(0, 200));
  ok('22 el mensaje muestra el precio unitario Michelin con $78 incluido', wa.includes(w.fmt(base + 78)), wa.slice(0, 300));

  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
