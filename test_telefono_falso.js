// ── TEST — Teléfonos inventados se bloquean (página real en jsdom) ──
// Uso:  node test_telefono_falso.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', () => {});
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
function abrir() {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
(async () => {
  const w = abrir(); await wait(300);
  const f = w.telefonoFalso;
  console.log('\n— A. La función telefonoFalso');
  ok('A0 existe la función', typeof f === 'function');
  ['6140000000', '1230000000', '1200000000', '6145555555', '6141111111', '1111111111', '0000000000', '1234567890', '0123456789', '9876543210'].forEach((n, i) =>
    ok('A' + (i + 1) + ' ' + n + ' es falso', f(n) === true));
  ['6141234567', '6145551234', '6562744028', '6141571546', '6149999991', '6140000001', '6144888591', '8118247000'].forEach((n, i) =>
    ok('B' + (i + 1) + ' ' + n + ' es un teléfono posible (no se bloquea)', f(n) === false));
  ok('B9 menos de 10 dígitos no lo evalúa esta función', f('614000') === false && f('') === false && f(null) === false);

  console.log('\n— C. Dentro de validarCampos (copiar, guardar y PDF usan esta misma función)');
  const tel = w.document.getElementById('cli-tel');
  function errTel(v) { tel.value = v; return w.validarCampos().filter(e => /Teléfono/.test(e)); }
  const e1 = errTel('6140000000');
  ok('C1 6140000000 se rechaza con aviso claro', e1.length === 1 && /inventado/.test(e1[0]), e1);
  ok('C2 1230000000 se rechaza', errTel('1230000000').length === 1);
  ok('C3 1111111111 se rechaza', errTel('1111111111').length === 1);
  ok('C4 1234567890 se rechaza', errTel('1234567890').length === 1);
  ok('C5 el campo se marca en rojo', tel.classList.contains('field-error'));
  ok('C6 6141234567 (número posible) se acepta', errTel('6141234567').length === 0);
  ok('C7 6562744028 se acepta', errTel('6562744028').length === 0);
  ok('C8 9 dígitos sigue rechazándose con su aviso de siempre', /exactamente 10/.test(errTel('614123456')[0] || ''));
  ok('C9 vacío sigue rechazándose', errTel('').length === 1);
  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
