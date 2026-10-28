// ── TEST — Lista MTO de BFGoodrich / Uniroyal (27 oct 2026) ─────────────────────────────────────────
// Regla de Carlos: el precio de la lista MTO YA es nuestro costo antes de IVA.
//   Precio al público = costo / (1 - 0.125) × 1.16   ·   a meses × 1.05 (igual que Servillantas/VEGA)
//   Si una llanta está en la lista de AYALA y en la MTO, gana la MTO. Las llantas solo-MTO se agregan al catálogo.
//   Las llantas MTO se ofrecen como normales (sin aviso, por ahora) aunque AYALA las marque Descontinuadas.
// Uso:  node test_mto_precios.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const cerca = (a, b) => Math.abs(a - b) < 0.011;
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; } }).window;
  await wait(300);
  const doc = w.document, AY = w.AYALA;
  const por = {}; AY.forEach(d => { por[d.cve] = d; });
  const buscar = async med => { const q = doc.getElementById('qm'); q.value = med; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(100); };
  const agregar = async cve => { const b = doc.querySelector('#res .badd[data-cve="' + cve + '"]'); if (!b) return false; b.click(); await wait(80); return true; };
  const llantas = () => w.cart.filter(c => c.t === 'l');
  const filas = () => Array.from(doc.querySelectorAll('#res .ochk')).map(c => por[c.getAttribute('data-cve')]).filter(Boolean);

  // ── 1. Datos ──
  const mto = AY.filter(d => d.mto);
  ok('1 hay 397 llantas con precio MTO (276 que también vienen en la lista Nov + 121 solo MTO)', mto.length === 397 && mto.filter(d => d.lista).length === 276 && mto.filter(d => !d.lista).length === 121, [mto.length]);
  ok('2 solo son BFGOODRICH y UNIROYAL (213 Uniroyal, 184 BFGoodrich)', mto.every(d => d.marca === 'BFGOODRICH' || d.marca === 'UNIROYAL') && mto.filter(d => d.marca === 'UNIROYAL').length === 213, mto.length);
  ok('3 ninguna llanta MTO queda marcada Descontinuada / Futuro lanzamiento', mto.every(d => d.est === ''), mto.filter(d => d.est !== '').map(d => d.cve).slice(0, 5));
  ok('4 el precio MTO es menor que la lista cuando vienen las dos (61%-65%)', mto.filter(d => d.lista).every(d => d.mto / d.lista > 0.6 && d.mto / d.lista < 0.66));

  // ── 2. BFGoodrich que está en las dos listas: gana MTO ──
  const a = por.AY06462;   // BFGoodrich 155/80R15: lista Nov $2,727, MTO $1,729
  ok('5 AY06462 trae lista 2727 y MTO 1729', a && a.lista === 2727 && a.mto === 1729, a);
  w.pago = 'contado';
  const esperadoC = 1729 / (1 - 0.125) * 1.16;
  const viejo = 2727 * 0.75 * 1.16;
  ok('6 precio contado = costo / (1 − 0.125) × 1.16 = ' + esperadoC.toFixed(2), cerca(w.pvpAyalaDe(a), esperadoC), w.pvpAyalaDe(a));
  ok('7 NO es el de la fórmula de lista (' + viejo.toFixed(2) + ')', !cerca(w.pvpAyalaDe(a), viejo));
  w.pago = 'meses';
  ok('8 a meses = contado × 1.05', cerca(w.pvpAyalaDe(a), esperadoC * 1.05), w.pvpAyalaDe(a));
  w.pago = 'contado';

  // ── 3. Solo-MTO: aparece en la búsqueda, sin aviso, con el precio de costo + margen + IVA ──
  const u = por.AY73090;   // Uniroyal 245/45R17 solo MTO, costo $2,195
  ok('9 AY73090 (Uniroyal 245/45R17) existe, es solo MTO y viene normal', u && u.mto === 2195 && !u.lista && u.est === '' && u.medida === '245/45R17', u);
  await buscar('245/45R17');
  ok('10 aparece en la búsqueda 245/45R17', filas().indexOf(u) >= 0, filas().length);
  ok('11 sin ningún aviso de estatus en el resultado', !/DESCONTINUADA|Sobre pedido|hasta agotar/.test(doc.getElementById('res').textContent));
  const filaU = Array.from(doc.querySelectorAll('#res .ri')).find(r => r.querySelector('.ochk') && r.querySelector('.ochk').getAttribute('data-cve') === 'AY73090');
  const txt = filaU ? filaU.querySelector('.rp').textContent.replace(/[^0-9.]/g, '') : '';
  ok('12 el precio que se ve en pantalla = ' + (2195 / 0.875 * 1.16).toFixed(2), filaU && Math.abs(parseFloat(txt) - 2195 / 0.875 * 1.16) < 1.01, txt);

  // ── 4. Carrito: marca, costo y margen para Hoja1 ──
  ok('13 se agrega al carrito', await agregar('AY73090'), llantas().length);
  const l = llantas()[0];
  ok('14 la línea queda como MTO con costo 2195 y precio = costo / 0.875 × 1.16 (1 llanta)', l.isMto === true && l.pb === 2195 && cerca(l.precio, 2195 / 0.875 * 1.16), [l.isMto, l.pb, l.precio]);
  const datos = w.armarDatosCotizacion(llantas(), [], [], []);
  const fila = datos.items.find(i => i.noParte === 'AY73090');
  ok('15 lo que se guarda en Hoja1: proveedor AYALA, costo 2,195, margen 12.5%', fila && fila.proveedor === 'AYALA' && /2,?195/.test(fila.costo) && fila.margen === '12.5%', fila);
  w.setQty(l.id, 4); await wait(40);
  ok('16 con 4 llantas lleva el recargo de instalación completo (+$120), sin descuento Michelin', cerca(llantas()[0].precio, 2195 / 0.875 * 1.16 + 120), llantas()[0].precio);
  w.pago = 'meses'; w.recalcPVP(); await wait(50);
  ok('17 a meses el cálculo se rehace: (costo / 0.875 × 1.16 × 1.05) + 120', cerca(llantas()[0].precio, 2195 / 0.875 * 1.16 * 1.05 + 120), llantas()[0].precio);
  w.pago = 'contado'; w.recalcPVP(); await wait(50);
  w.removeCartItem(llantas()[0].id); await wait(30);

  // ── 5. Lo que NO es MTO sigue con la fórmula de AYALA sobre la lista de noviembre ──
  const m = por.AY42495;   // Michelin 205/55R16 normal, lista Nov $3,054
  ok('18 Michelin AY42495: lista Nov 3054 y sin precio MTO', m && m.lista === 3054 && !m.mto, m);
  ok('19 Michelin sigue con lista × 0.75 × 1.16 (contado)', cerca(w.pvpAyalaDe(m), 3054 * 0.75 * 1.16), w.pvpAyalaDe(m));
  w.pago = 'meses';
  ok('20 Michelin a meses sigue con lista × 0.80 × 1.16', cerca(w.pvpAyalaDe(m), 3054 * 0.80 * 1.16), w.pvpAyalaDe(m));
  w.pago = 'contado';
  const noMto = AY.find(d => d.marca === 'BFGOODRICH' && !d.mto && d.est === '' && d.lista);
  ok('21 una BFGoodrich normal que no está en MTO (' + noMto.cve + ') sigue con lista × 0.75 × 1.16', cerca(w.pvpAyalaDe(noMto), noMto.lista * 0.75 * 1.16), w.pvpAyalaDe(noMto));
  await buscar('205/55R16'); await agregar('AY42495');
  const lm = llantas()[0];
  const dm = w.armarDatosCotizacion(llantas(), [], [], []).items.find(i => i.noParte === 'AY42495');
  ok('22 Hoja1 de Michelin sigue con margen 25% (descuento sobre lista) y costo = lista', !lm.isMto && dm && dm.margen === '25%' && /3,?054/.test(dm.costo), dm);
  w.removeCartItem(lm.id); await wait(30);

  // ── 6. Medidas que antes se quedaban sin opción y ahora MTO cubre ──
  const med = AY.find(d => d.mto && !d.lista && d.marca === 'BFGOODRICH');
  await buscar(med.medida);
  ok('23 una medida solo-MTO de BFGoodrich (' + med.medida + ') aparece sin avisos de "descontinuada"', filas().indexOf(med) >= 0 && !/DESCONTINUADA/.test(doc.getElementById('res').textContent), filas().length);

  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
