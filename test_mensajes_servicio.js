// ── TEST — mensaje de WhatsApp con textos por servicio de taller (19 oct 2026) ──
// Cada servicio agrega su bloque bajo su subtotal; bloque común y "También hacemos" una sola vez antes del total. Llantas sin cambio.
// Uso:  node test_mensajes_servicio.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
const cuenta = (t, s) => t.split(s).length - 1;
(async () => {
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; } }).window;
  await wait(300);
  const doc = w.document;
  let n = 0;
  const item = (tipo, concepto, precio, qty) => ({ id: 't' + (++n), tipo, concepto, costo: '', margen: 30, precio: String(precio), mo: true, precioFijo: false, pend: false, opcional: false, qty: qty || 1, conQty: false, descuento: 0, proveedor: '' });
  const msg = (items) => { w.cart = []; w.tallerItems = items; doc.getElementById('cli-nombre').value = 'Juan Prueba'; w.generarWA(); return doc.getElementById('wt').textContent; };
  const ANTES_TOTAL = t => t.slice(0, t.indexOf('✅ *Total:'));

  console.log('\n— Afinación');
  let t = msg([item('afinacion', 'Bujías NGK', 960), item('afinacion', 'Mano de obra afinación', 650)]);
  ok('1 título "Tu afinación incluye"', t.includes('✅ *Tu afinación incluye:*'));
  ok('2 15 puntos sin costo, escaneo sin costo y calibración', /15 puntos de seguridad, sin costo/.test(t) && /Escaneo de códigos de falla, sin costo/.test(t) && /Calibración de cuerpo de aceleración/.test(t));
  ok('3 bujías NGK con aviso de otra marca por el asesor', /Bujías NGK de alta calidad \(si prefieres otra marca, consúltalo con tu asesor\)/.test(t));
  ok('4 anticongelante con densímetro especial', /anticongelante con densímetro especial/.test(t));
  ok('5 si hay tiempo revisa suspensión y llantas', /Si el tiempo lo permite, revisamos también tu suspensión y el estado de tus llantas/.test(t));
  ok('6 el bloque va DEBAJO del subtotal y antes del bloque común y del total', t.indexOf('*Subtotal Afinación') < t.indexOf('Tu afinación incluye') && t.indexOf('Tu afinación incluye') < t.indexOf('En todos nuestros servicios') && t.indexOf('En todos nuestros servicios') < t.indexOf('*Total:'));
  ok('7 afinación NO lleva "También hacemos" ni textos de otros servicios', !t.includes('También hacemos') && !/frenos incluye|cambio de aceite incluye|suspensión incluye/.test(t));

  console.log('\n— Cambio de aceite');
  t = msg([item('aceite', 'Aceite Valvoline 5W-30', 185, 4), item('aceite', 'Filtro de aceite', 145)]);
  ok('8 título "Tu cambio de aceite incluye"', t.includes('✅ *Tu cambio de aceite incluye:*'));
  ok('9 aceite Valvoline y filtro nuevo + 15 puntos', /Aceite Valvoline y filtro nuevo/.test(t) && /Revisión de 15 puntos de seguridad/.test(t));
  ok('10 revisión (NO relleno) de niveles, batería y anticongelante con densímetro', /Revisión de batería, niveles de fluidos y anticongelante con densímetro especial/.test(t) && !/relleno/i.test(t));
  ok('11 si hay tiempo revisa suspensión y llantas', /Si el tiempo lo permite, revisamos también tu suspensión y el estado de tus llantas/.test(t));
  ok('12 aceite SÍ lleva "También hacemos" con mecánica general y trabajos de motor', /También hacemos:\* mecánica general/.test(t) && /rectificados, cabezas y ajuste de cadena de tiempo/.test(t));
  ok('13 no dice que no se desarman motores/transmisiones', !/no realizamos desarme/i.test(t));

  console.log('\n— Frenos');
  t = msg([item('frenos', 'Balatas delanteras de cerámica', 1150), item('frenos', 'Mano de obra frenos', 450)]);
  ok('14 título "Tu servicio de frenos incluye"', t.includes('🛑 *Tu servicio de frenos incluye:*'));
  ok('15 balatas de cerámica como primera opción, seguridad y rendimiento', /Balatas de cerámica de alta calidad como primera opción, pensando en tu seguridad y rendimiento/.test(t));
  ok('16 incluye limpieza de componentes', /Limpieza de componentes/.test(t));
  ok('17 frenos NO lleva "También hacemos"', !t.includes('También hacemos'));

  console.log('\n— Suspensión');
  t = msg([item('suspension', 'Amortiguadores delanteros', 2400, 2), item('suspension', 'Mano de obra suspensión', 900)]);
  ok('18 título "Tu servicio de suspensión incluye"', t.includes('🔩 *Tu servicio de suspensión incluye:*'));
  ok('19 15 puntos, niveles y batería, 13 puntos en suspensión', /Revisión de 15 puntos de seguridad/.test(t) && /Revisión de niveles y batería/.test(t) && /13 puntos de revisión en suspensión/.test(t));
  ok('20 daños en rótulas y fugas de aceite', /daños en rótulas, terminales y chasis/.test(t) && /fugas de aceite de motor y de transmisión/.test(t));

  console.log('\n— Bloque común y combinaciones');
  ok('21 el bloque común trae evidencia fotográfica, recomendaciones por escrito y recordatorios', /Reporte con evidencia fotográfica/.test(t) && /Recomendaciones por escrito/.test(t) && /Recordatorios automáticos/.test(t));
  t = msg([item('aceite', 'Aceite', 185, 4), item('frenos', 'Balatas', 1150), item('afinacion', 'Bujías', 960), item('suspension', 'Amortiguador', 2400)]);
  ok('22 cuatro servicios: cada bloque aparece UNA vez', ['Tu afinación incluye', 'Tu cambio de aceite incluye', 'Tu servicio de frenos incluye', 'Tu servicio de suspensión incluye'].every(x => cuenta(t, x) === 1));
  ok('23 cuatro servicios: bloque común y "También hacemos" UNA sola vez', cuenta(t, 'En todos nuestros servicios') === 1 && cuenta(t, 'También hacemos') === 1);
  ok('24 el bloque común y "También hacemos" van después del último servicio y antes del total', t.indexOf('En todos nuestros servicios') > t.lastIndexOf('incluye:*') && t.indexOf('También hacemos') < t.indexOf('*Total:'));
  t = msg([item('libre', 'Servicio libre', 500)]);
  ok('25 servicio libre: sin bloques', !/incluye:\*|En todos nuestros servicios|También hacemos/.test(t));
  t = msg([item('frenos', 'Balatas', 1150), item('suspension', 'Amortiguador', 2400)]);
  ok('26 frenos + suspensión: sin "También hacemos"', !t.includes('También hacemos') && cuenta(t, 'En todos nuestros servicios') === 1);

  console.log('\n— Llantas sin cambio y datos del mensaje');
  w.tallerItems = []; w.cart = [];
  const q = doc.getElementById('qm'); q.value = '205/55R16'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(120);
  doc.querySelector('#res .badd[data-cve="AY25285"]').click(); await wait(80);
  w.setQty(w.cart.filter(c => c.t === 'l')[0].id, 4); await wait(40);
  doc.getElementById('cli-nombre').value = 'Juan Prueba'; w.generarWA();
  t = doc.getElementById('wt').textContent;
  ok('27 cotización de solo llantas: sin ningún bloque de taller', !/incluye:\*|En todos nuestros servicios|También hacemos/.test(t));
  ok('28 llantas conserva instalación gratis y revisión 13 + 12 puntos', /INSTALACIÓN GRATIS/.test(t) && /13 puntos de motor \+ 12 puntos de suspensión/.test(t));
  w.tallerItems = [item('aceite', 'Aceite', 185, 4)]; w.generarWA(); t = doc.getElementById('wt').textContent;
  ok('29 llantas + aceite: bloque de aceite presente y llantas intactas', /Tu cambio de aceite incluye/.test(t) && /INSTALACIÓN GRATIS/.test(t));
  ok('30 el mensaje sigue terminando con Ref y conserva el pie de precios netos', /Ref [0-9]{4}-[A-Z0-9]+$/.test(t.trim()) && /Precios netos/.test(t));
  const ref1 = w.refVigente; w.tallerItems = [item('frenos', 'Balatas', 1150)]; w.cart = []; w.generarWA(); const ref2 = w.refVigente;
  w.tallerItems = [item('frenos', 'Balatas', 1150)]; w.generarWA();
  ok('31 el Ref cambia cuando cambia el mensaje y es estable si no cambia', ref1 !== ref2 && w.refVigente === ref2, [ref1, ref2, w.refVigente]);
  ok('32 ningún proveedor aparece en el mensaje', !/AYALA|VEGA|SERVILLANTAS/i.test(t));
  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
