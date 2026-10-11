// ── TEST — Claves repetidas entre Servillantas y Vega: el "+" agrega la llanta que se está viendo ──
// Uso: node test_claves_repetidas.js [html]
const fs = require('fs');
const FILE = process.argv[2] || './cotizador_dev.html';
const { JSDOM, VirtualConsole } = require('jsdom');
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', () => {});
const abrir = () => new JSDOM(fs.readFileSync(FILE, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
  beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
function buscar(w, medida) { const el = w.document.getElementById('qm'); el.value = medida; el.dispatchEvent(new w.Event('input', { bubbles: true })); w.buscar(); }
const btns = w => Array.from(w.document.querySelectorAll('#res .badd[data-cve]'));
const chks = w => Array.from(w.document.querySelectorAll('#res .ochk'));

(async () => {
  const w = abrir(); await esperar(250);
  const dups = Object.keys(w.CVE_DUP);
  console.log('\n=== CR-1. Detección de claves repetidas ===');
  ok('1 hay 3 claves repetidas entre Servillantas y Vega', dups.length === 3, dups);
  ok('2 las llantas normales no cambian de clave', w.llaveLlanta('AY26387', 'AYALA') === 'AY26387' && w.llaveLlanta('15570R13HH11', 'VEGA') === '15570R13HH11');
  ok('3 las repetidas llevan el proveedor en la llave', w.llaveLlanta('22545R18TURANZA', 'SERV') === '22545R18TURANZA@SERV' && w.llaveLlanta('22545R18TURANZA', 'VEGA') === '22545R18TURANZA@VEGA');

  const S = w.DATA.find(d => d.cve === '22545R18TURANZA'), V = w.VEGA.find(d => d.cve === '22545R18TURANZA');
  const pS = w.pvpLlanta(S.precio, S.marca), pV = w.pvpLlanta(V.costo, V.marca);
  console.log('\n=== CR-2. El "+" agrega la llanta que se ve (225/45R18 Turanza) ===');
  buscar(w, '225/45R18'); await esperar(60);
  const b = btns(w); const bS = b.find(x => x.getAttribute('data-cve') === '22545R18TURANZA@SERV'), bV = b.find(x => x.getAttribute('data-cve') === '22545R18TURANZA@VEGA');
  ok('4 en los resultados hay un botón para cada una', !!bS && !!bV, b.map(x => x.getAttribute('data-cve')).slice(0, 6));
  bS.click(); await esperar(40);
  let l = w.cart.filter(c => c.t === 'l');
  ok('5 "+" de Servillantas → entra el precio de Servillantas (no el de Vega)', l.length === 1 && Math.abs(l[0].precioBase - pS) < 1e-9 && l[0].desc === S.desc, [l[0] && l[0].precioBase, pS, pV]);
  ok('6 la clave que va al Sheet (No. de parte) sigue siendo la clave normal, sin @', l[0].cve === '22545R18TURANZA', l[0].cve);
  const bs2 = btns(w);
  ok('7 solo el botón de Servillantas queda en verde "OK"; el de Vega sigue en "+"', bs2.filter(x => x.textContent.trim() === 'OK').length === 1 && bs2.find(x => x.getAttribute('data-cve') === '22545R18TURANZA@VEGA').textContent.trim() === '+');
  w.cart = []; w.renderCarrito(); buscar(w, '225/45R18'); await esperar(40);
  btns(w).find(x => x.getAttribute('data-cve') === '22545R18TURANZA@VEGA').click(); await esperar(40);
  l = w.cart.filter(c => c.t === 'l');
  ok('8 "+" de Vega → entra el precio de Vega', l.length === 1 && Math.abs(l[0].precioBase - pV) < 1e-9 && l[0].isVega === true && l[0].desc === V.desc, [l[0] && l[0].precioBase, pV]);
  ok('9 los dos precios realmente son distintos (la prueba tiene sentido)', Math.abs(pS - pV) > 1, [pS, pV]);

  console.log('\n=== CR-3. Varias opciones (casillas) con una clave repetida ===');
  w.cart = []; w.renderCarrito(); buscar(w, '225/45R18'); await esperar(40);
  const cs = chks(w); const cS = cs.find(x => x.getAttribute('data-cve') === '22545R18TURANZA@SERV'), cV = cs.find(x => x.getAttribute('data-cve') === '22545R18TURANZA@VEGA');
  cS.checked = true; cS.dispatchEvent(new w.Event('change', { bubbles: true })); cV.checked = true; cV.dispatchEvent(new w.Event('change', { bubbles: true }));
  w.document.getElementById('opc-add').click(); await esperar(60);
  const ops = w.cart.filter(c => c.t === 'l');
  ok('10 quedan 2 opciones, una de cada proveedor, con su precio correcto', ops.length === 2 && ops.some(o => !o.isVega && Math.abs(o.precioBase - pS) < 1e-9) && ops.some(o => o.isVega && Math.abs(o.precioBase - pV) < 1e-9), ops.map(o => [o.isVega, o.precioBase]));
  ok('11 en las opciones la clave guardada sigue sin @', ops.every(o => o.cve === '22545R18TURANZA'), ops.map(o => o.cve));

  console.log('\n=== CR-4. Una llanta normal se comporta igual que antes ===');
  w.cart = []; w.renderCarrito(); buscar(w, '195/65R15'); await esperar(40);
  const bn = btns(w)[0]; const cv = bn.getAttribute('data-cve'); bn.click(); await esperar(40);
  ok('12 llanta normal: llave = clave, entra al carrito y se marca OK', w.cart.filter(c => c.t === 'l').length === 1 && w.cart[0].cve === cv && btns(w)[0].textContent.trim() === 'OK', [cv, w.cart[0] && w.cart[0].cve]);
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
