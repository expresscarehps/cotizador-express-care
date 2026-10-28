// ── TEST — Texto de "INSTALACIÓN GRATIS" sin número de llantas (cambio 21 oct 2026) ──
// El mensaje ya no cuenta llantas ("tus 10 llantas"): dice "en la compra de tus llantas." con cualquier cantidad.
// Uso:  node test_texto_instalacion.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
  const buscar = async med => { const q = doc.getElementById('qm'); q.value = med; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(120); };
  const agregar = async cve => { const b = doc.querySelector('#res .badd[data-cve="' + cve + '"]'); if (!b) return false; b.click(); await wait(80); return true; };
  const llantas = () => w.cart.filter(c => c.t === 'l');
  const texto = () => { w.generarWA(); const e = doc.getElementById('wt'); return (e && (e.value || e.textContent)) || ''; };
  w.pago = 'contado';
  await buscar('205/55R16');
  ok('1 se agrega la llanta AY42495 al carrito', await agregar('AY42495'), llantas().length);
  for (const n of [2, 3, 4, 6, 10]) {
    w.setQty(llantas()[0].id, n); await wait(40);
    const t = texto();
    ok(n + ' llantas: dice INSTALACIÓN GRATIS y "en la compra de tus llantas."', /INSTALACIÓN GRATIS/.test(t) && /en la compra de tus llantas\./.test(t), t.slice(0, 260));
    ok(n + ' llantas: no trae número antes de "llantas" en la frase de instalación', !/compra de tus \d+ llantas/.test(t), t.slice(0, 260));
  }
  w.setQty(llantas()[0].id, 1); await wait(40);
  const t1 = texto();
  ok('1 llanta: no dice INSTALACIÓN GRATIS (se cotiza Montaje/Balanceo/Pivote aparte)', !/INSTALACIÓN GRATIS/.test(t1), t1.slice(0, 200));
  w.setQty(llantas()[0].id, 4); await wait(40);
  ok('4 llantas: conserva la revisión de seguridad sin costo', /Revisión de seguridad SIN COSTO/.test(texto()));
  console.log('\n— Revisión de seguridad según cantidad (2 o 3 llantas lleva su propio texto)');
  const REV23 = '🔍 *Revisión de seguridad SIN COSTO:* 13 puntos de motor, incluida al instalar tus llantas.\n🔧 La revisión de 12 puntos de suspensión tiene un costo adicional; en la compra de al menos 4 llantas va sin costo.';
  for (const n of [2, 3]) {
    w.setQty(llantas()[0].id, n); await wait(40);
    const t = texto();
    ok(n + ' llantas: trae el texto exacto de la revisión de 13 puntos sin costo + suspensión con costo adicional', t.includes(REV23), t.slice(t.indexOf('INSTALACIÓN'), t.indexOf('INSTALACIÓN') + 500));
    ok(n + ' llantas: NO dice "12 puntos de suspensión, incluida" ni "tus 4 llantas" de la revisión completa', !/13 puntos de motor \+ 12 puntos de suspensión/.test(t));
  }
  for (const n of [4, 6]) {
    w.setQty(llantas()[0].id, n); await wait(40);
    const t = texto();
    ok(n + ' llantas: conserva la revisión completa de 13 + 12 puntos (sin cambio)', /13 puntos de motor \+ 12 puntos de suspensión/.test(t) && !t.includes('tiene un costo adicional'), t.slice(0, 80));
  }
  w.setQty(llantas()[0].id, 1); await wait(40);
  ok('1 llanta: no trae ninguna revisión de seguridad', !/Revisión de seguridad/.test(texto()));
  console.log('\n— Alineación según cantidad (4+ sin costo · 2 o 3 aparte · 1 no se menciona)');
  const AL4 = '🎯 *¡ALINEACIÓN SIN COSTO!* Incluida en la compra de al menos 4 llantas.';
  const AL23 = '🎯 La alineación se cobra por separado; en la compra de al menos 4 llantas va sin costo.';
  for (const n of [4, 5, 10]) {
    w.setQty(llantas()[0].id, n); await wait(40); const t = texto();
    ok(n + ' llantas: alineación SIN COSTO y no dice que se cobra aparte', t.includes(AL4) && !t.includes(AL23), t.slice(t.indexOf('INSTALACIÓN'), t.indexOf('INSTALACIÓN') + 400));
  }
  for (const n of [2, 3]) {
    w.setQty(llantas()[0].id, n); await wait(40); const t = texto();
    ok(n + ' llantas: la alineación se cobra por separado (texto exacto) y no dice sin costo', t.includes(AL23) && !t.includes(AL4), t.slice(t.indexOf('INSTALACIÓN'), t.indexOf('INSTALACIÓN') + 400));
  }
  w.setQty(llantas()[0].id, 1); await wait(40);
  { const t1 = texto(); ok('1 llanta: no menciona alineación (ni sin costo ni por separado)', !t1.includes('ALINEACIÓN SIN COSTO') && !t1.includes('La alineación se cobra por separado'), t1.slice(0, 300)); }
  w.setQty(llantas()[0].id, 4); await wait(40);
  { const t = texto(); const i1 = t.indexOf('INSTALACIÓN GRATIS'), i2 = t.indexOf('ALINEACIÓN SIN COSTO'), i3 = t.indexOf('Revisión de seguridad');
    ok('4 llantas: orden del mensaje = instalación gratis → alineación → revisión', i1 > 0 && i2 > i1 && i3 > i2, [i1, i2, i3]); }
  console.log('\n— Revisión de 4+ llantas: el número sale de la cantidad de la cotización');
  for (const n of [4, 5, 6, 10]) {
    w.setQty(llantas()[0].id, n); await wait(40); const t = texto();
    ok(n + ' llantas: la revisión dice "incluida al instalar tus ' + n + ' llantas"', t.includes('incluida al instalar tus ' + n + ' llantas.'), t.slice(t.indexOf('Revisión'), t.indexOf('Revisión') + 200));
    ok(n + ' llantas: no queda ningún "tus 4 llantas" fijo' + (n === 4 ? ' (aquí coincide con 4)' : ''), n === 4 || !/tus 4 llantas/.test(t));
  }
  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
