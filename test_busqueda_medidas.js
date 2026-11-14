// ── TEST — Buscador de medidas: ignora la "P" inicial y trata ZR = R (no depende de que el asesor lo recuerde) ──
// Casos reales: asesores buscaron "P285/40R18" y "205/40ZR17" y no salía nada.
// Uso:  node test_busqueda_medidas.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', (e) => { console.log('ERROR NO CONTROLADO:', e && e.stack || e); process.exit(1); });
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 300) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
  beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
function buscar(q) {
  w.document.getElementById('qm').value = q; w.buscar();
  const cnt = w.document.getElementById('cnt').textContent;
  const claves = Array.from(w.document.querySelectorAll('#res .badd[data-cve]')).map(b => b.getAttribute('data-cve'));
  return { n: parseInt(cnt, 10) || 0, claves, texto: cnt };
}
const mismo = (a, b) => a.n === b.n && a.claves.join() === b.claves.join();

(async () => {
  await wait(400);
  console.log('\n— A. La "P" del inicio se ignora');
  const base = buscar('205/55R16');
  ok('A0 base: 205/55R16 sí tiene resultados', base.n > 5, base.n);
  for (const q of ['P205/55R16', 'p205/55r16', 'P 205/55R16', ' P205/55R16 ', 'P205/55 R16']) {
    const r = buscar(q);
    ok('A1 "' + q + '" da lo mismo que 205/55R16', mismo(r, base), [r.n, base.n]);
  }
  const b285 = buscar('285/35R18');
  ok('A2 P285/35R18 = 285/35R18', b285.n > 0 && mismo(buscar('P285/35R18'), b285), b285.n);
  ok('A3 P285/40R18 no truena y avisa "Sin resultados" (esa medida solo existe descontinuada en AYALA)', buscar('P285/40R18').texto === 'Sin resultados', buscar('P285/40R18').texto);

  console.log('\n— B. ZR = R en los dos sentidos');
  const r17 = buscar('205/40R17'), z17 = buscar('205/40ZR17');
  ok('B1 205/40ZR17 encuentra lo mismo que 205/40R17', r17.n > 0 && mismo(z17, r17), [z17.n, r17.n]);
  ok('B2 con "P" y ZR juntos: P205/40ZR17 también', mismo(buscar('P205/40ZR17'), r17));
  ok('B3 mientras se escribe "205/40ZR" ya trae resultados', buscar('205/40ZR').n >= r17.n, buscar('205/40ZR').n);
  const r19 = buscar('285/40R19');
  ok('B4 una medida que el catálogo guarda con ZR (285/40ZR22) se encuentra escribiendo R', (() => { const a = buscar('285/40R22'), b = buscar('285/40ZR22'); return mismo(a, b); })());
  ok('B5 escribiendo ZR19 encuentra las 285/40 de rin 19 (que la descripción trae como ZR19)', mismo(buscar('285/40ZR19'), r19) && r19.n > 0, [buscar('285/40ZR19').n, r19.n]);

  console.log('\n— C. Lo que ya funcionaba sigue igual (sin regresiones)');
  ok('C1 buscar por marca sin medida sigue pidiendo/mostrando como antes (HANKOOK)', (() => { const r = buscar('HANKOOK'); return r.n > 0; })());
  ok('C2 "PIRELLI" (empieza con P pero es marca) NO pierde la P', (() => { const r = buscar('PIRELLI'); const s = buscar('IRELLI'); return r.n >= s.n && r.n > 0; })(), [buscar('PIRELLI').n, buscar('IRELLI').n]);
  ok('C3 LT265/70R17 sigue encontrando camioneta', buscar('LT265/70R17').n > 0, buscar('LT265/70R17').n);
  ok('C4 265/70R17 sigue igual', buscar('265/70R17').n > 0);
  ok('C5 con espacios: "205 / 55 R16" sigue igual', mismo(buscar('205 / 55 R16'), base));
  ok('C6 medida con guion (VEGA/camión 11R22.5) se sigue encontrando', buscar('11R22.5').n > 0, buscar('11R22.5').n);
  ok('C7 menos de 2 caracteres sigue pidiendo escribir más', /Escribe al menos 2 caracteres/.test(w.document.getElementById('res').innerHTML) || (buscar('2'), /Escribe al menos 2 caracteres/.test(w.document.getElementById('res').innerHTML)));
  ok('C8 una medida inexistente sigue en "Sin resultados"', buscar('999/99R99').texto === 'Sin resultados');
  ok('C9 las descontinuadas de AYALA (est D) siguen ocultas: 285/40R18 no sale', buscar('285/40R18').n === 0, buscar('285/40R18').n);

  console.log('\n— D. El filtro de marcas sigue la misma regla');
  buscar('P205/55R16');
  const optsP = Array.from(w.document.querySelectorAll('#qk option')).map(o => o.value).filter(Boolean);
  buscar('205/55R16');
  const opts = Array.from(w.document.querySelectorAll('#qk option')).map(o => o.value).filter(Boolean);
  ok('D1 con "P" delante la lista de marcas es la misma', optsP.length > 0 && optsP.join() === opts.join(), [optsP.length, opts.length]);
  buscar('205/40ZR17');
  const optsZ = Array.from(w.document.querySelectorAll('#qk option')).map(o => o.value).filter(Boolean);
  buscar('205/40R17');
  const optsR = Array.from(w.document.querySelectorAll('#qk option')).map(o => o.value).filter(Boolean);
  ok('D2 con ZR la lista de marcas es la misma que con R', optsZ.length > 0 && optsZ.join() === optsR.join(), [optsZ.length, optsR.length]);

  console.log('\n' + '═'.repeat(50)); console.log('✅ ' + passed + '   ❌ ' + failed);
  process.exit(failed ? 1 : 0);
})();
