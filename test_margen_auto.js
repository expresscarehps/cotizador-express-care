// ── TEST — Margen automático fijo de llantas (página real en jsdom) ──
// Uso: node test_margen_auto.js [ruta_al_html]
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', () => {});
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); failed++; } }
function abrir() {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
function buscarMedida(w, med) { const el = w.document.getElementById('qm'); el.value = med; el.dispatchEvent(new w.Event('input', { bubbles: true })); w.buscar(); }
(async () => {
  const w = abrir(); await wait(300); const d = w.document;
  console.log('\n— A. Campo fijo + recordatorio');
  ok('A1 no existe el campo editable de margen', !d.getElementById('mg'));
  const rec = d.getElementById('mg-recordatorio');
  ok('A2 recordatorio visible con 12.5 / 15.5 / 5', rec && /12\.5/.test(rec.textContent) && /15\.5/.test(rec.textContent) && /\+5%/.test(rec.textContent), rec && rec.textContent.replace(/\s+/g,' '));
  ok('A3 recordatorio menciona AYALA 25% / 20%', /AYALA/.test(rec.textContent) && /25%/.test(rec.textContent) && /20%/.test(rec.textContent));

  console.log('\n— B. Precios en resultados de búsqueda (contado)');
  w.pago = 'contado';
  buscarMedida(w, '195/65R15');
  const filas = Array.from(d.querySelectorAll('#res .ri'));
  ok('B0 hay resultados', filas.length >= 5, filas.length);
  // comparar el PVP mostrado contra el cálculo esperado por marca, para cada fila de VEGA/SERV
  let revisadas = 0, malas = [];
  const cat = [].concat(w.VEGA, w.DATA);
  filas.forEach(f => {
    const cve = f.querySelector('.badd') && f.querySelector('.badd').getAttribute('data-cve');
    if (!cve || cve.indexOf('AY') === 0) return;
    const it = cat.find(x => x.cve === cve); if (!it) return;
    const costo = it.costo !== undefined ? it.costo : it.precio;
    const esperado = costo / (1 - w.margenLlanta(it.marca) / 100);
    const mostrado = parseFloat(f.querySelector('.rp').textContent.replace(/[$,]/g, ''));
    revisadas++; if (Math.abs(mostrado - esperado) > 0.01) malas.push([cve, it.marca, mostrado, esperado.toFixed(2)]);
  });
  ok('B1 PVP mostrado = costo/(1-margen de su marca) en ' + revisadas + ' filas', revisadas > 0 && malas.length === 0, malas.slice(0, 3));
  const margenes = new Set(filas.map(f => { const m = f.querySelector('.rm'); return m ? w.margenLlanta(m.textContent) : null; }));
  console.log('   (márgenes presentes en esta búsqueda: ' + Array.from(margenes).join(', ') + ')');

  console.log('\n— C. Fila de otro proveedor');
  const ay = d.getElementById('otro-margen-ayuda');
  ok('C1 ayuda visual con YOKOHAMA 12.5% y SUNFULL 15.5%', ay && /YOKOHAMA 12\.5%/.test(ay.textContent) && /SUNFULL 15\.5%/.test(ay.textContent), ay && ay.textContent);
  const opts = Array.from(d.querySelectorAll('#otro-marcas option')).map(o => o.value);
  ok('C2 selector de marca (datalist) con SOLO YOKOHAMA y SUNFULL', opts.length === 2 && opts[0] === 'YOKOHAMA' && opts[1] === 'SUNFULL', opts);
  const set = (marca, costo) => { d.getElementById('otro-marca').value = marca; d.getElementById('otro-costo').value = costo; w.calcOtro(); };
  set('YOKOHAMA', '1000'); const pY = d.getElementById('otro-pvp-preview').textContent, aY = d.getElementById('otro-margen-aplicado').textContent;
  ok('C3 YOKOHAMA $1000 → PVP $1,142.86 y "12.5%"', /1,142\.86/.test(pY) && /12\.5%/.test(aY), [pY, aY]);
  set('SUNFULL', '1000'); const pS = d.getElementById('otro-pvp-preview').textContent, aS = d.getElementById('otro-margen-aplicado').textContent;
  ok('C4 SUNFULL $1000 → PVP $1,183.43 y "15.5%"', /1,183\.43/.test(pS) && /15\.5%/.test(aS), [pS, aS]);
  set('TERCELO', '1000'); ok('C5 marca de catálogo china (TERCELO) → 15.5%', /1,183\.43/.test(d.getElementById('otro-pvp-preview').textContent));
  set('MICHELIN', '1000'); ok('C6 marca de catálogo normal (MICHELIN) → 12.5%', /1,142\.86/.test(d.getElementById('otro-pvp-preview').textContent));
  set('LLANTAXYZ', '1000'); ok('C7 marca desconocida → 12.5%', /1,142\.86/.test(d.getElementById('otro-pvp-preview').textContent));

  console.log('\n— D. Agregar al carrito y cambio a meses');
  set('SUNFULL', '1000'); d.getElementById('otro-desc').value = '205/55R16 SUNFULL PRUEBA'; d.getElementById('btn-otro').click(); await wait(100);
  const it = w.cart.find(c => c.otro);
  ok('D1 renglón manual SUNFULL con precio 15.5%', it && Math.abs(it.precioBase - 1000 / 0.845) < 0.01, it && it.precioBase);
  w.pago = 'meses'; w.recalcPVP();
  const it2 = w.cart.find(c => c.otro);
  ok('D2 a meses: +5% sobre precio con 15.5%', Math.abs(it2.precioBase - 1000 / 0.845 * 1.05) < 0.01, it2.precioBase);
  w.pago = 'contado'; w.recalcPVP();
  console.log('\nTOTAL: ' + (passed + failed) + ' | ✅ ' + passed + ' OK | ❌ ' + failed + ' FALLIDAS');
  process.exit(failed ? 1 : 0);
})();
