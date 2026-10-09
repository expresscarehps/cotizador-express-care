// ── TEST — Filtrar por Gama / Demanda / Marca SIN escribir medida (página real en jsdom) ──
// Uso:  node test_filtros_sin_medida.js [ruta_al_html] [ruta_html_anterior_para_comparar]
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const PREV_PATH = process.argv[3] || '';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', () => {});
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; } }
function abrir(h) {
  return new JSDOM(h || html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
function poner(w, id, val) { const el = w.document.getElementById(id); el.value = val; el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }
const filas = w => Array.from(w.document.querySelectorAll('#res .ri'));
const cnt = w => w.document.getElementById('cnt').textContent;
const num = w => parseInt((cnt(w).match(/\d+/) || [0])[0], 10);
const res = w => w.document.getElementById('res').textContent;
function todas(w) { return [].concat(w.DATA, w.AYALA, w.VEGA).filter(d => d.medida && d.desc); }
function esperado(w, f) {   // cuenta independiente, directo de los datos
  return todas(w).filter(d => { const b = w.BRAND_DB[d.marca], r = w.ROTACION_DB[d.marca];
    return (!f.gama || (b && b.gama === f.gama)) && (!f.dem || (r && r.rotacion === f.dem)) && (!f.marca || d.marca === f.marca); }).length;
}
function marcaDe(w, row) { return row.querySelector('.rm').textContent.trim(); }

(async () => {
  const w = abrir(); await wait(300);
  console.log('\n— A. Sin medida y sin filtros');
  poner(w, 'qm', '');
  ok('A1 pide escribir algo (no lista todo el catálogo)', /Escribe al menos 2 caracteres/.test(res(w)) && filas(w).length === 0);
  poner(w, 'qm', '2');
  ok('A2 con 1 solo carácter y sin filtros, sigue pidiendo escribir', /Escribe al menos 2 caracteres/.test(res(w)) && filas(w).length === 0);

  console.log('\n— B. Gama + Demanda sin medida (el caso de la captura)');
  poner(w, 'qm', ''); poner(w, 'qg', 'Media-Alta'); poner(w, 'qd', 'alta');
  const eB = esperado(w, { gama: 'Media-Alta', dem: 'alta' });
  ok('B0 hay llantas que cumplen (prueba válida)', eB > 60, eB);
  ok('B1 el total coincide con la cuenta directa de los datos (' + eB + ')', num(w) === eB, { cnt: cnt(w), eB });
  ok('B2 muestra 60 filas', filas(w).length === 60, filas(w).length);
  const marcasB = new Set(filas(w).map(r => marcaDe(w, r)));
  ok('B3 solo marcas Media-Alta con demanda alta', Array.from(marcasB).every(m => ['GOODYEAR', 'HANKOOK', 'BFGOODRICH'].includes(m)), Array.from(marcasB));
  const meds = filas(w).map(r => (r.querySelector('.rd').textContent.match(/\d{3}\/\d{2}\s?Z?R\d{2}/) || [''])[0]);
  ok('B4 la lista dice que escribas una medida para afinar', /escribe una medida/.test(cnt(w)), cnt(w));
  ok('B5 aviso de "Primeros 60 de N" (no 40)', new RegExp('Primeros 60 de ' + eB).test(res(w)) && !/Primeros 40/.test(res(w)));
  ok('B6 la lista de Marca tiene 3 marcas', w.document.getElementById('qk').options.length - 1 === 3);
  // Orden: primero auto normal, al final camión / todoterreno / LT (se revisa sobre TODOS los resultados con una consulta amplia)
  const esAuto = m => /^P?\d{3}(\/\d{2}|R)/.test((m || '').toUpperCase()) && (m || '').toUpperCase().indexOf('LT') < 0;
  poner(w, 'qg', 'Económica'); poner(w, 'qd', 'media');   // consulta amplia con medidas mezcladas
  const lista = [].concat(w.DATA, w.AYALA, w.VEGA).filter(d => d.medida && d.desc && w.BRAND_DB[d.marca] && w.BRAND_DB[d.marca].gama === 'Económica' && w.ROTACION_DB[d.marca] && w.ROTACION_DB[d.marca].rotacion === 'media');
  const hayNoAuto = lista.some(d => !esAuto(d.medida)), hayAuto = lista.some(d => esAuto(d.medida));
  ok('B7 la consulta de prueba mezcla medidas de auto y de camión/todoterreno (para que valga)', hayNoAuto && hayAuto);
  const medidasDe = () => Array.from(w.document.querySelectorAll('#res .ochk')).map(c => { const f = w.buscarItemCatalogo(c.getAttribute('data-cve')); return f && f.it ? f.it.medida : ''; });
  const primeras = medidasDe();
  ok('B8 las primeras 60 son todas de auto normal (según la medida del catálogo)', primeras.length === 60 && primeras.every(esAuto), primeras.filter(m => !esAuto(m)));
  poner(w, 'qg', 'Media-Alta'); poner(w, 'qd', 'alta');
  const prim2 = filas(w).map(r => r.querySelector('.rd').textContent);
  ok('B9 en el caso Media-Alta + alta ya no abre con 11R22.5 / 33X10.50 (camión/todoterreno)', !/^\s*(11R|33X|35X|37X|31X)/.test(prim2[0]) && /^\s*\d{3}\//.test(prim2[0]), prim2[0]);
  ok('B10 dentro del grupo de auto van por medida ascendente', (() => { const ms = prim2.map(t => (t.match(/^\s*(\d{3}\/\d{2})/) || [])[1]).filter(Boolean); return ms.every((m, i) => i === 0 || ms[i - 1] <= m); })(), prim2.slice(0, 5));


  console.log('\n— C. Cada filtro por separado, sin medida');
  poner(w, 'qg', ''); poner(w, 'qd', 'alta');
  ok('C1 solo Demanda alta → total = cuenta directa', num(w) === esperado(w, { dem: 'alta' }), { cnt: cnt(w), e: esperado(w, { dem: 'alta' }) });
  poner(w, 'qd', ''); poner(w, 'qg', 'Económica');
  ok('C2 solo Gama Económica → total = cuenta directa', num(w) === esperado(w, { gama: 'Económica' }), { cnt: cnt(w), e: esperado(w, { gama: 'Económica' }) });
  poner(w, 'qg', ''); poner(w, 'qk', 'HANKOOK');
  ok('C3 solo Marca HANKOOK → total = cuenta directa', num(w) === esperado(w, { marca: 'HANKOOK' }), { cnt: cnt(w), e: esperado(w, { marca: 'HANKOOK' }) });
  ok('C4 todas las filas son HANKOOK', filas(w).every(r => marcaDe(w, r) === 'HANKOOK'));
  poner(w, 'qk', ''); poner(w, 'qg', 'Media-Alta'); poner(w, 'qd', 'alta'); poner(w, 'qk', 'GOODYEAR');
  ok('C5 Gama + Demanda + Marca juntas', num(w) === esperado(w, { gama: 'Media-Alta', dem: 'alta', marca: 'GOODYEAR' }) && filas(w).every(r => marcaDe(w, r) === 'GOODYEAR'), cnt(w));

  console.log('\n— D. Combinación imposible');
  poner(w, 'qk', ''); poner(w, 'qg', 'Muy Económica'); poner(w, 'qd', 'alta');
  ok('D1 Muy Económica + alta demanda → "Sin resultados" con mensaje de filtros', /Sin resultados/.test(cnt(w)) && /otra combinación de filtros/.test(res(w)), res(w).slice(0, 80));

  console.log('\n— E. Con medida: la medida es un filtro más');
  poner(w, 'qg', 'Media-Alta'); poner(w, 'qd', 'alta'); poner(w, 'qm', '225/55R17');
  const nE = num(w);
  ok('E1 con medida baja el total (subconjunto de B)', nE > 0 && nE < eB, nE);
  ok('E2 todas las filas son de esa medida', filas(w).every(r => /225\/55[\s-]?Z?-?R?17/i.test(r.querySelector('.rd').textContent)), filas(w).length);
  ok('E3 ya no dice "escribe una medida"', !/escribe una medida/.test(cnt(w)), cnt(w));
  poner(w, 'qm', '');
  ok('E4 al borrar la medida vuelve a la consulta general', num(w) === eB, cnt(w));

  console.log('\n— F. Quitar los filtros');
  poner(w, 'qg', ''); poner(w, 'qd', ''); poner(w, 'qk', '');
  ok('F1 sin medida ni filtros vuelve a pedir que escribas', /Escribe al menos 2 caracteres/.test(res(w)) && filas(w).length === 0);

  console.log('\n— G. Agregar al carrito desde una consulta sin medida');
  poner(w, 'qg', 'Media-Alta'); poner(w, 'qd', 'alta');
  w.document.querySelector('#res .badd[data-cve]').click(); await wait(100);
  ok('G1 el botón "+" funciona y deja el botón en verde "OK"', w.cart.filter(c => c.t === 'l').length === 1 && /OK/.test(w.document.querySelector('#res .badd[data-cve]').textContent));

  if (PREV_PATH) {
    console.log('\n— H. Con medida y sin filtros: igual que la versión anterior');
    const wp = abrir(fs.readFileSync(PREV_PATH, 'utf8')); await wait(300);
    const w2 = abrir(); await wait(300);
    ['195', '225/55R17', '205/55R16', 'HANKOOK'].forEach(q => {
      poner(wp, 'qm', q); poner(w2, 'qm', q);
      ok('H ' + q + ' → mismo total y mismas primeras 5 filas', cnt(wp) === cnt(w2) && filas(wp).slice(0, 5).map(r => r.textContent).join('|') === filas(w2).slice(0, 5).map(r => r.textContent).join('|'), { prev: cnt(wp), ahora: cnt(w2) });
    });
  }
  console.log('\n=============================================');
  console.log('TOTAL: ' + (passed + failed) + ' | ✅ ' + passed + ' OK | ❌ ' + failed + ' FALLIDAS');
  process.exit(failed ? 1 : 0);
})();
