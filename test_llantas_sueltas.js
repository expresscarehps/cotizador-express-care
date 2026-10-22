// ── TEST — Aviso de llantas sueltas sin "Cotizar opciones" (cambio 21 oct 2026) ──
// Caso real: cotización 1021-KJA4A = 5 llantas 225/60R18 (cantidad 2 c/u) cargadas SUELTAS: el cotizador contó 10 llantas.
// El cotizador BLOQUEA copiar/generar PDF con 2+ llantas sueltas (siempre deben ser opciones). Con la casilla "Cotizar opciones" no pregunta y el recargo sale por opción.
// Uso:  node test_llantas_sueltas.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
  const conf = []; let resp = true; const alerts = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = m => alerts.push(String(m)); w.confirm = m => { conf.push(String(m)); return resp; };
      w.document.execCommand = () => true; w.navigator.clipboard = { writeText: () => Promise.resolve() }; } }).window;
  await wait(300);
  const doc = w.document, $ = id => doc.getElementById(id);
  const set = (id, v) => { $(id).value = v; };
  const llenar = () => { set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Xen'); set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4'); };
  const buscar = async med => { const q = $('qm'); q.value = med; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(150); };
  const llantas = () => w.cart.filter(c => c.t === 'l');
  const botones = () => Array.from(doc.querySelectorAll('#res .badd'));
  w.pago = 'contado'; llenar();
  await buscar('225/60R18');
  const cves = botones().map(b => b.getAttribute('data-cve')).filter((v, i, a) => a.indexOf(v) === i);
  ok('1 la medida 225/60R18 tiene al menos 5 llantas en el catálogo', cves.length >= 5, cves.length);
  const cinco = cves.slice(0, 5);
  for (const c of cinco) { const b = doc.querySelector('#res .badd[data-cve="' + c + '"]'); b && b.click(); await wait(60); }
  ok('2 quedan 5 llantas sueltas en el carrito', llantas().length === 5, llantas().length);
  llantas().forEach(l => w.setQty(l.id, 2)); await wait(40);
  ok('3 (comportamiento actual de la regla, sin tocar) las 5 sueltas suman 10 y llevan el recargo de 4+', w.instalacionInfo.totalQty === 10 && w.instalacionInfo.recargo === 120, w.instalacionInfo);

  console.log('\n— Copiar con 5 llantas sueltas');
  alerts.length = 0; conf.length = 0;
  w.copiar(); await wait(80);
  ok('4 avisa que son opciones y manda a usar "Cotizar opciones"', alerts.length === 1 && /5 llantas distintas sueltas/.test(alerts[0]) && /Cotizar opciones/.test(alerts[0]), alerts);
  ok('5 NO copia (el botón no dice ¡Copiado!) y no ofrece botón de aceptar', !/Copiado/.test($('bcp').textContent) && conf.length === 0, [$('bcp').textContent, conf.length]);
  alerts.length = 0; w.copiar(); await wait(80);
  ok('6 volver a copiar sigue bloqueado (no hay forma de saltarse el aviso)', alerts.length === 1 && !/Copiado/.test($('bcp').textContent), alerts.length);

  console.log('\n— Generar PDF con llantas sueltas');
  const al2 = [];
  const w2 = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(x) { x.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); x.alert = m => { al2.push(String(m)); }; x.confirm = m => { conf.push(String(m)); return false; }; x.document.execCommand = () => true; x.navigator.clipboard = { writeText: () => Promise.resolve() }; } }).window;
  await wait(300);
  const d2 = w2.document, s2 = (id, v) => { d2.getElementById(id).value = v; };
  s2('cli-nombre', 'Cliente de Prueba'); s2('cli-tel', '6145550123'); s2('cli-origen', 'WhatsApp'); s2('asesor', 'Xen'); s2('v-marca', 'Nissan'); s2('v-modelo', 'Sentra'); s2('v-anio', '2020'); s2('v-cil', '4');
  w2.pago = 'contado';
  const q2 = d2.getElementById('qm'); q2.value = '225/60R18'; q2.dispatchEvent(new w2.Event('input', { bubbles: true })); await wait(150);
  for (const c of cinco.slice(0, 2)) { const b = d2.querySelector('#res .badd[data-cve="' + c + '"]'); b && b.click(); await wait(60); }
  conf.length = 0; al2.length = 0;
  w2.generarPDF(); await wait(80);
  const bp = d2.getElementById('btn-pdf');
  ok('7 PDF: con 2 llantas sueltas avisa y no empieza a generar', al2.length === 1 && bp && !bp.disabled && !/Generando/.test(bp.textContent), [al2.length, bp && bp.textContent]);

  console.log('\n— Una sola llanta: no pregunta');
  const w3 = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(x) { x.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); x.alert = m => { al2.push(String(m)); }; x.confirm = m => { conf.push(String(m)); return false; }; x.document.execCommand = () => true; x.navigator.clipboard = { writeText: () => Promise.resolve() }; } }).window;
  await wait(300);
  const d3 = w3.document, s3 = (id, v) => { d3.getElementById(id).value = v; };
  s3('cli-nombre', 'Cliente de Prueba'); s3('cli-tel', '6145550123'); s3('cli-origen', 'WhatsApp'); s3('asesor', 'Xen'); s3('v-marca', 'Nissan'); s3('v-modelo', 'Sentra'); s3('v-anio', '2020'); s3('v-cil', '4');
  w3.pago = 'contado';
  const q3 = d3.getElementById('qm'); q3.value = '225/60R18'; q3.dispatchEvent(new w3.Event('input', { bubbles: true })); await wait(150);
  const b3 = d3.querySelector('#res .badd[data-cve="' + cinco[0] + '"]'); b3 && b3.click(); await wait(60);
  w3.setQty(w3.cart.filter(c => c.t === 'l')[0].id, 2); await wait(30);
  conf.length = 0; al2.length = 0; w3.copiar(); await wait(80);
  ok('8 una sola línea de 2 llantas: no avisa y copia', conf.length === 0 && al2.length === 0 && /Copiado/.test(d3.getElementById('bcp').textContent), [conf.length, d3.getElementById('bcp').textContent]);

  console.log('\n— Con "Cotizar opciones" (la casilla): no pregunta y el recargo sale por opción');
  const w4 = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(x) { x.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); x.alert = m => { al2.push(String(m)); }; x.confirm = m => { conf.push(String(m)); return false; }; x.document.execCommand = () => true; x.navigator.clipboard = { writeText: () => Promise.resolve() }; } }).window;
  await wait(300);
  const d4 = w4.document, s4 = (id, v) => { d4.getElementById(id).value = v; };
  s4('cli-nombre', 'Cliente de Prueba'); s4('cli-tel', '6145550123'); s4('cli-origen', 'WhatsApp'); s4('asesor', 'Xen'); s4('v-marca', 'Nissan'); s4('v-modelo', 'Sentra'); s4('v-anio', '2020'); s4('v-cil', '4');
  w4.pago = 'contado';
  const q4 = d4.getElementById('qm'); q4.value = '225/60R18'; q4.dispatchEvent(new w4.Event('input', { bubbles: true })); await wait(150);
  for (const c of cinco) { const k = d4.querySelector('#res .ochk[data-cve="' + c + '"]'); if (k) { k.checked = true; k.dispatchEvent(new w4.Event('change', { bubbles: true })); k.click && 0; } }
  await wait(40);
  d4.getElementById('opc-qty').value = '2';
  d4.getElementById('opc-add').click(); await wait(120);
  const ls = w4.cart.filter(c => c.t === 'l');
  ok('9 con la casilla quedan 5 opciones marcadas', ls.length >= 2 && ls.every(l => l.op), ls.map(l => l.op));
  ok('10 cada opción usa SU cantidad (2) y el recargo de 2 llantas ($190, o $123.50 Michelin)', w4.instalacionInfo.totalQty === 2 && w4.instalacionInfo.recargo === 190 &&
     ls.every(l => cerca(l.precio, l.precioBase + (w4.esMichelin(l) ? 123.5 : 190))), [w4.instalacionInfo, ls.map(l => [l.marca, l.precio - l.precioBase])]);
  conf.length = 0; al2.length = 0; w4.copiar(); await wait(80);
  ok('11 con opciones NO avisa y copia', conf.length === 0 && al2.length === 0 && /Copiado/.test(d4.getElementById('bcp').textContent), [conf.length, d4.getElementById('bcp').textContent]);
  console.log('\n— Con opciones: el número de la revisión es la cantidad por opción (no la suma de opciones)');
  w4.setQty(w4.cart.filter(c => c.t === 'l')[0].id, 6); await wait(60);
  w4.generarWA(); const e4 = d4.getElementById('wt'); const t4 = (e4 && (e4.value || e4.textContent)) || '';
  const ls4 = w4.cart.filter(c => c.t === 'l');
  ok('12 con ' + ls4.length + ' opciones de 6 llantas cada una: la revisión dice "tus 6 llantas" (no ' + (6 * ls4.length) + ')', t4.includes('incluida al instalar tus 6 llantas.') && !t4.includes('tus ' + (6 * ls4.length) + ' llantas'), t4.slice(t4.indexOf('Revisión'), t4.indexOf('Revisión') + 200));
  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
