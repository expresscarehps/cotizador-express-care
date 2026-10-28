// ── TEST — Estatus de las llantas AYALA (columna "Estatus" de la lista Julio 2026) · cambio 26 oct 2026 ──
// Datos: lista AYALA Noviembre 2026 (4,090 llantas) + 121 llantas que solo vienen en la lista MTO de BFGoodrich/Uniroyal = 4,211.
// Reglas aprobadas por Carlos:
//  · Descontinuado (D): se oculta; solo se muestra, con aviso al asesor, en medidas que no tienen otra opción AYALA.
//  · Futuro lanzamiento (FL): siempre oculta.
//  · Descontinuado con inventario (DI) y Orden especial (OE): se muestran con aviso al asesor.
//  · Los avisos son SOLO para el asesor: nunca aparecen en el mensaje de WhatsApp.
//  · La demanda de las marcas AYALA se cuenta con lo que se ofrece (normal + DI + OE).
// Uso:  node test_ayala_estatus.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
  const doc = w.document, AY = w.AYALA;
  const porCve = {}; AY.forEach(d => { porCve[d.cve] = d; });
  const buscar = async med => { const q = doc.getElementById('qm'); q.value = med; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(100); };
  const filasAyala = () => Array.from(doc.querySelectorAll('#res .ochk')).map(c => porCve[c.getAttribute('data-cve')]).filter(Boolean);
  const textoRes = () => doc.getElementById('res').textContent;
  const visibleNoD = d => d.est === '' || d.est === 'DI' || d.est === 'OE';

  // ── A. Datos: el estatus de cada llanta coincide con la lista real ──
  const cuenta = { '': 0, D: 0, DI: 0, FL: 0, OE: 0 }; AY.forEach(d => { cuenta[d.est] = (cuenta[d.est] || 0) + 1; });
  ok('A1 el catálogo AYALA tiene 4,211 llantas (4,090 de la lista Nov + 121 solo MTO)', AY.length === 4211, AY.length);
  ok('A2 Descontinuado = 2,565', cuenta.D === 2565, cuenta);
  ok('A3 Descontinuado con inventario = 66', cuenta.DI === 66, cuenta);
  ok('A4 Futuro lanzamiento = 58', cuenta.FL === 58, cuenta);
  ok('A5 Orden especial = 78', cuenta.OE === 78, cuenta);
  ok('A6 Normales (sin estatus) = 1,444', cuenta[""] === 1444, cuenta);
  ok('A7 ejemplos de la lista Nov: AY55632 = OE, AY26387 = normal', porCve.AY55632.est === 'OE' && porCve.AY26387.est === '', [porCve.AY55632.est, porCve.AY26387.est]);

  // medidas (cadena exacta) y cuántas llantas AYALA tienen
  const porMed = {}; AY.forEach(d => { (porMed[d.medida] = porMed[d.medida] || []).push(d); });
  const busqSeguras = m => AY.filter(d => d.medida.toUpperCase().replace(/\s/g, '').indexOf(m.toUpperCase()) >= 0 || d.desc.toUpperCase().indexOf(m.toUpperCase()) >= 0).length <= 40;
  const medidas = Object.keys(porMed).filter(busqSeguras);

  // ── B. Medida con llantas normales y descontinuadas: las D no salen ──
  const mixta = medidas.find(m => porMed[m].some(d => d.est === 'D') && porMed[m].some(d => d.est === '') && /^\d{3}\/\d{2}R\d{2}$/.test(m));
  ok('B0 hay una medida de prueba con normales y descontinuadas', !!mixta, mixta);
  await buscar(mixta);
  const rb = filasAyala();
  ok('B1 ' + mixta + ': aparecen las normales', porMed[mixta].filter(d => d.est === '').every(d => rb.indexOf(d) >= 0), rb.map(d => d.cve));
  ok('B2 ' + mixta + ': NO aparece ninguna Descontinuada', rb.every(d => d.est !== 'D'), rb.filter(d => d.est === 'D').map(d => d.cve));
  ok('B3 ' + mixta + ': no se muestra el aviso DESCONTINUADA', !/DESCONTINUADA - confirmar/.test(textoRes()));

  // ── C. Medida con SOLO descontinuadas: se muestran con aviso rojo para el asesor ──
  const soloD = medidas.find(m => porMed[m].every(d => d.est === 'D') && /^\d{3}\/\d{2}R\d{2}$/.test(m));
  ok('C0 hay una medida de prueba con solo descontinuadas', !!soloD, soloD);
  await buscar(soloD);
  const rc = filasAyala();
  ok('C1 ' + soloD + ': como no hay otra opción AYALA, SÍ se muestran las descontinuadas', porMed[soloD].every(d => rc.indexOf(d) >= 0), rc.map(d => d.cve));
  ok('C2 ' + soloD + ': cada una trae el aviso "DESCONTINUADA - confirmar existencia"', (textoRes().match(/DESCONTINUADA - confirmar existencia/g) || []).length >= porMed[soloD].length, textoRes().slice(0, 300));

  // ── D. Futuro lanzamiento: nunca sale (ni aunque sea la única opción) ──
  const soloFL = medidas.find(m => porMed[m].every(d => d.est === 'FL'));
  const fl = AY.find(d => d.est === 'FL');
  await buscar(fl.medida);
  ok('D1 ' + fl.medida + ': Futuro lanzamiento no aparece', filasAyala().every(d => d.est !== 'FL'), filasAyala().map(d => d.cve + d.est));
  if (soloFL) { await buscar(soloFL); ok('D2 ' + soloFL + ' (solo futuro lanzamiento): no sale ninguna AYALA', filasAyala().length === 0, filasAyala().length); }

  // ── E. Orden especial y Descontinuado con inventario: se muestran con su aviso ──
  const oe = AY.find(d => d.est === 'OE' && busqSeguras(d.medida));
  await buscar(oe.medida);
  ok('E1 Orden especial (' + oe.cve + ') aparece', filasAyala().indexOf(oe) >= 0);
  ok('E2 Orden especial trae el aviso "Sobre pedido"', /Sobre pedido - tarda mas/.test(textoRes()));
  const di = AY.find(d => d.est === 'DI' && busqSeguras(d.medida));
  await buscar(di.medida);
  ok('E3 Descontinuado con inventario (' + di.cve + ') aparece', filasAyala().indexOf(di) >= 0);
  ok('E4 trae el aviso "hasta agotar existencia"', /Descontinuada - hasta agotar existencia/.test(textoRes()));
  const norm = AY.find(d => d.est === '' && busqSeguras(d.medida) && !porMed[d.medida].some(x => x.est !== ''));
  await buscar(norm.medida);
  ok('E5 una llanta normal NO lleva ningún aviso', filasAyala().indexOf(norm) >= 0 && !/DESCONTINUADA|Sobre pedido|hasta agotar/.test(textoRes()));

  // ── F. Regla general sobre muchas medidas: ninguna D visible si la medida tiene otra opción; ninguna FL ──
  let malas = [];
  for (const m of medidas.slice(0, 120)) {
    await buscar(m);
    const f = filasAyala();
    const hayOpcion = porMed[m].some(visibleNoD);
    f.forEach(d => { if (d.medida === m && (d.est === 'FL' || (d.est === 'D' && hayOpcion))) malas.push(m + ':' + d.cve + ':' + d.est); });
  }
  ok('F1 en 120 medidas revisadas nunca sale una FL ni una D con otra opción disponible', malas.length === 0, malas.slice(0, 5));

  // ── G. El aviso es solo para el asesor: no viaja al WhatsApp ──
  await buscar(soloD);
  const bt = doc.querySelector('#res .badd[data-cve="' + porMed[soloD][0].cve + '"]'); if (bt) bt.click(); await wait(80);
  w.pago = 'contado'; w.generarWA();
  const e = doc.getElementById('wt'); const wa = (e && (e.value || e.textContent)) || '';
  ok('G1 la llanta descontinuada de prueba quedó en el carrito', w.cart.some(c => c.t === 'l'), w.cart.length);
  ok('G2 el mensaje de WhatsApp NO trae avisos de estatus ni el nombre del proveedor', wa.length > 50 && !/DESCONTINUADA|Descontinuada|Sobre pedido|hasta agotar|AYALA/i.test(wa), wa.slice(0, 200));

  // ── H. Demanda de las marcas AYALA recalculada con lo que se ofrece; regla del archivo de marcas: <=9 baja, 10-52 media, >=53 alta ──
  const R = w.ROTACION_DB; const ofrece = {}; AY.forEach(d => { if (visibleNoD(d)) ofrece[d.marca] = (ofrece[d.marca] || 0) + 1; });
  const nivel = n => n >= 53 ? 'alta' : (n >= 10 ? 'media' : 'baja');
  ['MICHELIN', 'BFGOODRICH', 'UNIROYAL'].forEach((m, k) => {
    ok('H' + (k + 1) + ' ' + m + ': skus = llantas que se ofrecen y nivel según la regla', R[m].skus === ofrece[m] && R[m].rotacion === nivel(ofrece[m]), [R[m], ofrece[m]]);
  });
  ok('H4 cifras esperadas hoy: MICHELIN 845, BFGOODRICH 501, UNIROYAL 242 (las tres 🔥 alta)', R.MICHELIN.skus === 845 && R.BFGOODRICH.skus === 501 && R.UNIROYAL.skus === 242 && R.UNIROYAL.rotacion === 'alta', [R.MICHELIN.skus, R.BFGOODRICH.skus, R.UNIROYAL.skus]);
  const sel = id => doc.getElementById(id);
  const qd = sel('qd'); const q = sel('qm'); q.value = '';
  if (qd) {
    qd.value = 'alta'; qd.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(100);
    const optsAlta = Array.from(sel('qk').options).map(o => o.value);
    ok('H5 filtro Demanda alta: MICHELIN, BFGOODRICH y UNIROYAL aparecen', ['MICHELIN', 'BFGOODRICH', 'UNIROYAL'].every(m => optsAlta.indexOf(m) >= 0), optsAlta.slice(0, 8));
    qd.value = 'media'; qd.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(100);
    const optsMedia = Array.from(sel('qk').options).map(o => o.value);
    ok('H6 filtro Demanda media: no aparece ninguna de las 3 marcas AYALA', ['MICHELIN', 'BFGOODRICH', 'UNIROYAL'].every(m => optsMedia.indexOf(m) < 0), optsMedia.slice(0, 8));
  } else ok('H5 existe el filtro de Demanda', false);
  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
