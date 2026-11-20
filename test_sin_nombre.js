// ── TEST — "Sin nombre" solo vale cuando la cotización es SOLO de llantas ──
// Uso:  node test_sin_nombre.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', (e) => { console.log('ERROR NO CONTROLADO:', e && e.stack || e); process.exit(1); });
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
function abrir() {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
const MSG = /el nombre es obligatorio: quita "Sin nombre"/;
const errNombre = w => w.validarCampos().filter(e => MSG.test(e));
function sinNombre(w, on) { const cb = w.document.getElementById('cli-sin-nombre'); cb.checked = on; w.alternarSinNombre(); }
function ponerTaller(w, precio) {
  w.setTallerSvc('suspension', null);
  const it = w.tallerItems.find(i => i.concepto === 'Amortiguador delantero');
  it.precio = precio; it.qty = 1; it.proveedor = 'AutoZone'; it.noParte = '333-5007-2B';
  return it;
}

(async () => {
  let w = abrir(); await wait(300);

  console.log('\n— A. Solo llantas (sin servicios de taller): "Sin nombre" sigue valiendo');
  sinNombre(w, true);
  ok('A1 con "Sin nombre" y nada de taller no sale el error del nombre', errNombre(w).length === 0, errNombre(w));

  console.log('\n— B. Con un servicio de taller: "Sin nombre" ya no vale');
  const it = ponerTaller(w, 500);
  ok('B1 "Sin nombre" + amortiguador → error pidiendo el nombre', errNombre(w).length === 1, errNombre(w));
  ok('B2 el campo Nombre se marca en rojo', w.document.getElementById('cli-nombre').classList.contains('field-error'));

  console.log('\n— C. Con nombre escrito sí pasa');
  sinNombre(w, false);
  w.document.getElementById('cli-nombre').value = 'Juan Pérez';
  ok('C1 con nombre real y taller no sale el error', errNombre(w).length === 0, errNombre(w));

  console.log('\n— D. También cuenta la mano de obra');
  w = abrir(); await wait(300);
  w.setTallerSvc('suspension', null);
  const mo = w.tallerItems.find(i => i.mo && i.tipo === 'suspension');
  mo.precio = 500; mo.qty = 1;
  sinNombre(w, true);
  ok('D1 solo mano de obra con "Sin nombre" → error', errNombre(w).length === 1, errNombre(w));

  console.log('\n— E. Un renglón de taller sin precio no cuenta como servicio');
  w = abrir(); await wait(300);
  ponerTaller(w, 0);
  sinNombre(w, true);
  ok('E1 taller con precio 0 y "Sin nombre" → sin error del nombre', errNombre(w).length === 0, errNombre(w));

  console.log('\n— F. Facebook/Instagram: el mensaje no se duplica');
  w = abrir(); await wait(300);
  ponerTaller(w, 500);
  const origen = w.document.getElementById('cli-origen');
  origen.value = 'Facebook';
  sinNombre(w, true);
  w.document.getElementById('cli-nombre').value = 'Sin nombre';
  const nombreErrs = w.validarCampos().filter(e => /^Nombre del cliente \(/.test(e) && /obligatorio/.test(e));
  ok('F1 con Facebook sale un solo error de nombre obligatorio', nombreErrs.length === 1, nombreErrs);

  console.log('\n— G. Textos que ya existían siguen igual');
  w = abrir(); await wait(300);
  w.document.getElementById('cli-nombre').value = '6141234567';
  ok('G1 un teléfono como nombre sigue sin valer', w.validarCampos().some(e => /no puede ser solo números/.test(e)));

  console.log('\n' + (failed ? '❌' : '✅') + ' ' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
