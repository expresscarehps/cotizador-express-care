// ── TEST — Teléfono opcional cuando el origen es Facebook o Instagram (17 oct 2026) ──
// Uso:  node test_telefono_opcional.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', () => {});
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
const alerts = [];
function abrir() {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = m => alerts.push(String(m)); w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
(async () => {
  const w = abrir(); await wait(300);
  const d = w.document, $ = id => d.getElementById(id);
  const origen = $('cli-origen'), tel = $('cli-tel');
  const set = (id, v) => { $(id).value = v; };
  function cambiarOrigen(v) { origen.value = v; origen.dispatchEvent(new w.Event('change', { bubbles: true })); }
  function base(o) { set('cli-nombre', 'Cliente Prueba'); set('asesor', 'Ana'); set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4'); cambiarOrigen(o); }
  const errTel = () => w.validarCampos().filter(e => /Teléfono/.test(e));
  const opciones = Array.from(origen.options).map(o => o.value);

  console.log('\n— A. Facebook: teléfono libre');
  base('Facebook'); tel.value = '';
  ok('A1 Facebook + teléfono vacío: validarCampos NO pide teléfono', errTel().length === 0, w.validarCampos());
  ok('A2 la validación completa pasa (solo faltan cosas de otros campos, no el teléfono)', w.validarCampos().length === 0, w.validarCampos());
  ok('A3 el asterisco (*) del teléfono se oculta', $('req-tel').style.display === 'none');
  ok('A4 el campo ya no es "required"', tel.required === false);
  ok('A5 el campo no queda en rojo', !tel.classList.contains('field-error'));

  console.log('\n— B. Si el asesor SÍ escribe teléfono en Facebook, se sigue validando');
  tel.value = '614123456';
  ok('B1 9 dígitos se rechaza', errTel().length === 1 && /exactamente 10/.test(errTel()[0]), errTel());
  tel.value = '6140000000';
  ok('B2 teléfono inventado se rechaza', errTel().length === 1 && /inventado/.test(errTel()[0]), errTel());
  tel.value = '6141234567';
  ok('B3 teléfono válido se acepta', errTel().length === 0);

  console.log('\n— C. Instagram (aunque la lista aún no tenga la opción, la regla ya la cubre)');
  ok('C0 la lista de orígenes actual: ' + opciones.join(', '), opciones.indexOf('Facebook') >= 0);
  ok('C0b "Instagram" ya está en la lista de origen, junto a Facebook', opciones.indexOf('Instagram') === opciones.indexOf('Facebook') + 1, opciones);
  base('Instagram'); tel.value = '';
  ok('C1 Instagram + teléfono vacío: no pide teléfono', errTel().length === 0 && w.validarCampos().length === 0, w.validarCampos());
  ok('C2 Instagram: el asterisco se oculta y el campo no es requerido', $('req-tel').style.display === 'none' && tel.required === false);
  const cbI = $('cli-sin-nombre'); ok('C3 Instagram: la casilla "Sin nombre" se desactiva', cbI.disabled === true);
  set('cli-nombre', 'Sin nombre');
  ok('C4 Instagram: "Sin nombre" escrito a mano se rechaza', w.validarCampos().some(e => /Nombre del cliente.*obligatorio/.test(e)), w.validarCampos());
  set('cli-nombre', 'Cliente Prueba');

  console.log('\n— D. Los demás orígenes siguen pidiendo teléfono');
  for (const o of ['WhatsApp', 'Llamada', 'Visita', 'Cliente de casa', 'Auto en servicio']) {
    base(o); tel.value = '';
    ok('D ' + o + ' + vacío: SÍ pide teléfono', errTel().length === 1, errTel());
  }
  base('WhatsApp'); tel.value = '';
  ok('D6 volver a WhatsApp regresa el asterisco y el campo requerido', $('req-tel').style.display === '' && tel.required === true);
  base(''); tel.value = '';
  ok('D7 sin origen elegido: sigue pidiendo teléfono (y el origen)', errTel().length === 1 && w.validarCampos().some(e => /Origen/.test(e)));

  console.log('\n— E. Nueva cotización / limpiar');
  base('Facebook'); tel.value = '';
  w.limpiarTodo(); await wait(30);
  ok('E1 después de limpiar, el origen vuelve a vacío y el teléfono vuelve a ser obligatorio', origen.value === '' && tel.required === true && $('req-tel').style.display === '');

  console.log('\n— F. "Ya la envié" sin teléfono no avisa a GHL');
  base('Facebook'); tel.value = '';
  w.habilitarYaLaEnvie();
  const bye = $('btn-ya-envie');
  ok('F1 sin teléfono el botón queda deshabilitado', bye.disabled === true, bye.textContent);
  ok('F2 el texto explica por qué', /sin teléfono/.test(bye.textContent), bye.textContent);
  tel.value = '6141234567'; w.habilitarYaLaEnvie();
  ok('F3 con teléfono el botón sí se habilita (comportamiento de siempre)', bye.disabled === false, bye.textContent);

  console.log('\n— H. Facebook/Instagram: la casilla "Sin nombre" se desactiva y el nombre es obligatorio');
  const cb = $('cli-sin-nombre'), nom = $('cli-nombre');
  const marcar = v => { cb.checked = v; cb.dispatchEvent(new w.Event('change', { bubbles: true })); };
  base('WhatsApp'); marcar(true);
  ok('H0 en WhatsApp la casilla funciona normal (activa, y pone "Sin nombre")', cb.disabled === false && nom.value === 'Sin nombre' && nom.disabled === true);
  cambiarOrigen('Facebook');
  ok('H1 al cambiar a Facebook la casilla se desmarca y se desactiva', cb.checked === false && cb.disabled === true, [cb.checked, cb.disabled]);
  ok('H2 el campo nombre se libera y se borra el "Sin nombre"', nom.disabled === false && nom.value === '', [nom.disabled, nom.value]);
  tel.value = '';
  ok('H3 Facebook sin nombre escrito: se rechaza el nombre vacío', w.validarCampos().some(e => /^Nombre del cliente/.test(e)), w.validarCampos());
  nom.value = 'Sin nombre';
  ok('H4 aunque escriban a mano "Sin nombre" en Facebook se rechaza con aviso claro', w.validarCampos().some(e => /Nombre del cliente.*obligatorio/.test(e)), w.validarCampos());
  nom.value = 'Maria Perez';
  ok('H5 Facebook + nombre real + sin teléfono: se acepta', w.validarCampos().length === 0, w.validarCampos());
  tel.value = '6141234567'; nom.value = 'Sin nombre';
  ok('H6 aunque haya teléfono, en Facebook "Sin nombre" tampoco vale', w.validarCampos().some(e => /Nombre del cliente.*obligatorio/.test(e)), w.validarCampos());
  nom.value = ''; tel.value = '';
  cambiarOrigen('WhatsApp');
  ok('H7 al volver a WhatsApp la casilla se reactiva', cb.disabled === false);
  w.limpiarTodo(); await wait(30);
  ok('H8 después de limpiar la casilla está activa y desmarcada', cb.disabled === false && cb.checked === false);

  console.log('\n— G. Lo que ya existía no cambió');
  ok('G1 normalizarTelefono sigue limpiando', w.normalizarTelefono('+52 (614) 123-4567') === '6141234567');
  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
