// ── TEST — Filtro de DEMANDA en el buscador de llantas (página real en jsdom) ──────────
// Uso:  node test_filtro_demanda.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
function cambiar(w, id, val) { const el = w.document.getElementById(id); el.value = val; el.dispatchEvent(new w.Event('change', { bubbles: true })); }
function buscarMedida(w, med) { const el = w.document.getElementById('qm'); el.value = med; el.dispatchEvent(new w.Event('input', { bubbles: true })); w.buscar(); }
function marcasResultado(w) {   // marcas de las filas visibles (por la clave de catálogo de cada casilla)
  const cs = w.document.querySelectorAll('#res .ochk'); const m = [];
  cs.forEach(c => { const f = w.buscarItemCatalogo(c.getAttribute('data-cve')); if (f && f.it) m.push(f.it.marca); });
  return m;
}
const total = w => parseInt((w.document.getElementById('cnt').textContent.match(/\d+/) || [0])[0], 10);

(async () => {
  const w = abrir(); await wait(300);
  const R = w.ROTACION_DB, B = w.BRAND_DB;
  // Medida real del catálogo Servillantas con más variedad de demanda entre sus marcas
  const porMed = {};
  w.DATA.forEach(d => { if (d.medida && R[d.marca]) { (porMed[d.medida] = porMed[d.medida] || new Set()).add(R[d.marca].rotacion); } });
  const MED = Object.keys(porMed).sort((a, b) => porMed[b].size - porMed[a].size || a.localeCompare(b))[0].toUpperCase().replace(/\s/g, '');
  console.log('  (medida de prueba: ' + MED + ')');
  console.log('\n— A. El selector');
  const qd = w.document.getElementById('qd');
  ok('A1 existe el selector Demanda', !!qd);
  ok('A2 opciones: Todas / alta / media / baja', qd && Array.from(qd.options).map(o => o.value).join(',') === ',alta,media,baja');
  ok('A3 está junto al de Gama (mismo bloque)', qd && w.document.getElementById('qg').closest('.g2') === qd.closest('.g2'));

  console.log('\n— B. Filtra los resultados por demanda');
  buscarMedida(w, MED);
  const base = total(w), marcasBase = new Set(marcasResultado(w));
  const dems = new Set(Array.from(marcasBase).map(m => R[m] && R[m].rotacion));
  ok('B0 la medida de prueba trae marcas de varias demandas (para que la prueba valga)', dems.size >= 2 && base > 0, { base, dems: Array.from(dems) });
  for (const d of ['alta', 'media', 'baja']) {
    cambiar(w, 'qd', d);
    const ms = marcasResultado(w);
    const esperadas = Array.from(marcasBase).filter(m => R[m] && R[m].rotacion === d);
    ok('B ' + d + ': todas las filas son de marcas de demanda ' + d + ' (y hay filas)', (ms.length > 0 || !marcasBase.size || !Array.from(marcasBase).some(m => R[m].rotacion === d)) && ms.every(m => R[m] && R[m].rotacion === d), ms.filter(m => !(R[m] && R[m].rotacion === d)));
    ok('B ' + d + ': aparecen todas las marcas de esa demanda que existen en la medida', esperadas.every(m => ms.includes(m)), { esperadas, ms: Array.from(new Set(ms)) });
    ok('B ' + d + ': el contador coincide con lo que se muestra o es el total real', total(w) >= ms.length);
  }
  cambiar(w, 'qd', '');
  ok('B Todas: regresa al mismo número de resultados', total(w) === base, { antes: base, ahora: total(w) });

  console.log('\n— C. Combinado con Gama (se aplican los dos)');
  cambiar(w, 'qd', 'alta'); cambiar(w, 'qg', 'Económica');
  const mc = marcasResultado(w);
  ok('C1 muestra solo marcas Económica Y de demanda alta', mc.every(m => B[m].gama === 'Económica' && R[m].rotacion === 'alta'), Array.from(new Set(mc)));
  const hay = Array.from(marcasBase).filter(m => B[m].gama === 'Económica' && R[m].rotacion === 'alta');
  ok('C2 trae todas las marcas que cumplen los dos filtros en esa medida', hay.every(m => mc.includes(m)), { hay, mc: Array.from(new Set(mc)) });
  cambiar(w, 'qg', ''); cambiar(w, 'qd', '');

  console.log('\n— D. La lista de Marca se acomoda al filtro');
  cambiar(w, 'qd', 'alta');
  const opts = Array.from(w.document.getElementById('qk').options).map(o => o.value).filter(Boolean);
  ok('D1 con medida y demanda alta, la lista de Marca solo trae marcas de demanda alta', opts.length > 0 && opts.every(m => R[m].rotacion === 'alta'), opts);
  const txt0 = w.document.getElementById('qk').options[0].textContent;
  ok('D2 el "Todas (N)" cuenta las marcas filtradas', txt0 === 'Todas (' + opts.length + ')', txt0);
  // Elegir una marca de la lista y verificar que solo salga esa
  if (opts.length) { cambiar(w, 'qk', opts[0]); const m1 = marcasResultado(w); ok('D3 elegir una marca de la lista muestra solo esa marca', m1.length > 0 && m1.every(m => m === opts[0]), Array.from(new Set(m1))); cambiar(w, 'qk', ''); }
  cambiar(w, 'qd', '');

  console.log('\n— E. Sin medida escrita (solo filtros)');
  buscarMedida(w, '');
  cambiar(w, 'qd', 'baja');
  const optsE = Array.from(w.document.getElementById('qk').options).map(o => o.value).filter(Boolean);
  ok('E1 sin medida, demanda baja lista solo marcas de demanda baja', optsE.length > 0 && optsE.every(m => R[m].rotacion === 'baja'), optsE.slice(0, 5));
  cambiar(w, 'qd', 'alta');
  const optsA = Array.from(w.document.getElementById('qk').options).map(o => o.value).filter(Boolean);
  ok('E2 sin medida, demanda alta lista solo marcas de demanda alta', optsA.length > 0 && optsA.every(m => R[m].rotacion === 'alta'), optsA.slice(0, 5));
  cambiar(w, 'qd', '');
  const optsT = Array.from(w.document.getElementById('qk').options).map(o => o.value).filter(Boolean);
  ok('E3 con Todas la lista de marcas vuelve completa', optsT.length > optsA.length && optsT.length > optsE.length, { todas: optsT.length, alta: optsA.length, baja: optsE.length });

  console.log('\n— F. Nada más cambió');
  buscarMedida(w, MED);
  ok('F1 el filtro de Gama sigue funcionando solo', (() => { cambiar(w, 'qg', 'Alta'); const m = marcasResultado(w); cambiar(w, 'qg', ''); return m.every(x => B[x].gama === 'Alta'); })());
  ok('F2 las casillas de "varias opciones" siguen apareciendo', w.document.querySelectorAll('#res .ochk').length > 0, total(w));
  ok('F3 la página tiene etiqueta de versión dev (el filtro de Demanda ya está desde "filtro demanda")', /^dev 2026-10-09/.test(w.VERSION_PAGINA), w.VERSION_PAGINA);

  console.log('\n=============================================');
  console.log('TOTAL: ' + (passed + failed) + ' | ✅ ' + passed + ' OK | ❌ ' + failed + ' FALLIDAS');
  process.exit(failed ? 1 : 0);
})();
