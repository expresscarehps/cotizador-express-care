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
  ok('D1 solo mano de obra cuenta como taller: la casilla "Sin nombre" no se deja marcada', w.document.getElementById('cli-sin-nombre').checked === false && w.document.getElementById('cli-sin-nombre').disabled === true);
  const cbD = w.document.getElementById('cli-sin-nombre'); cbD.disabled = false; cbD.checked = true;   // si alguien la forzara, la validación al copiar sigue bloqueando
  ok('D2 respaldo: si se forzara la casilla, validarCampos igual pide el nombre', errNombre(w).length === 1, errNombre(w));

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

  console.log('\n— H. La casilla se desmarca sola en cuanto se agrega un servicio de taller');
  w = abrir(); await wait(300);
  const cbH = w.document.getElementById('cli-sin-nombre'), nmH = w.document.getElementById('cli-nombre');
  sinNombre(w, true);
  ok('H1 solo llantas: la casilla se puede marcar y el campo dice "Sin nombre"', cbH.checked && nmH.value === 'Sin nombre' && !cbH.disabled);
  ponerTaller(w, 500); w.generarWA();
  ok('H2 al agregar un servicio la casilla se desmarca', cbH.checked === false, cbH.checked);
  ok('H3 el campo Nombre queda libre y vacío (no se queda con "Sin nombre")', nmH.disabled === false && nmH.value === '', { dis: nmH.disabled, val: nmH.value });
  ok('H4 la casilla queda apagada (no se puede marcar)', cbH.disabled === true);
  cbH.click();
  ok('H5 intentar marcarla con taller no hace nada', cbH.checked === false && nmH.value === '', { chk: cbH.checked, val: nmH.value });
  ok('H6 un nombre real escrito se conserva', (nmH.value = 'Ana López', w.generarWA(), nmH.value === 'Ana López'));

  console.log('\n— I. Si el servicio se quita, la casilla vuelve a poder usarse');
  const itI = w.tallerItems.find(i => i.concepto === 'Amortiguador delantero'); itI.precio = 0; w.generarWA();
  ok('I1 sin servicios la casilla se habilita otra vez', cbH.disabled === false, cbH.disabled);
  nmH.value = ''; sinNombre(w, true);
  ok('I2 y se puede marcar de nuevo (solo llantas)', cbH.checked && nmH.value === 'Sin nombre');

  console.log('\n— J. Escribir "Sin nombre" a mano con taller tampoco vale');
  w = abrir(); await wait(300);
  const nmJ = w.document.getElementById('cli-nombre');
  ponerTaller(w, 500); nmJ.value = 'Sin nombre'; w.generarWA();
  ok('J1 el texto "Sin nombre" escrito a mano se borra al haber taller', nmJ.value === '', nmJ.value);

  console.log('\n— K. Facebook/Instagram y taller juntos');
  w = abrir(); await wait(300);
  const cbK = w.document.getElementById('cli-sin-nombre');
  ponerTaller(w, 500); w.generarWA();
  const oK = w.document.getElementById('cli-origen'); oK.value = 'Facebook'; w.actualizarTelefonoObligatorio();
  ok('K1 con Facebook y taller la casilla sigue apagada', cbK.disabled === true);
  oK.value = 'WhatsApp'; w.actualizarTelefonoObligatorio();
  ok('K2 al cambiar a WhatsApp con taller la casilla NO se vuelve a habilitar', cbK.disabled === true, cbK.disabled);
  w.tallerItems.forEach(i => { i.precio = 0; }); w.generarWA();
  ok('K3 sin taller y con WhatsApp la casilla se habilita', cbK.disabled === false, cbK.disabled);

  console.log('\n— L. Pestaña Libre: cualquier cosa que se escriba ahí exige nombre');
  w = abrir(); await wait(300);
  const cbL = w.document.getElementById('cli-sin-nombre'), nmL = w.document.getElementById('cli-nombre');
  sinNombre(w, true);
  w.setTallerSvc('libre', null);
  const libre = w.tallerItems.find(i => i.tipo === 'libre');
  ok('L0 existe el renglón de Libre', !!libre);
  ok('L1 renglón de Libre vacío no bloquea: la casilla sigue marcada', cbL.checked === true && !cbL.disabled, { chk: cbL.checked, dis: cbL.disabled });
  const inpL = w.document.querySelector('#taller-items input[data-f="concepto"]');
  ok('L2 el campo de concepto de Libre está en pantalla', !!inpL);
  let enfocoNombre = 0; nmL.focus = () => { enfocoNombre++; };
  Object.defineProperty(w.document, 'activeElement', { configurable: true, get: () => inpL });   // simula al asesor escribiendo en el concepto de Libre
  inpL.value = 'Revisión eléctrica'; inpL.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('L3 al escribir solo el concepto (sin precio) la casilla se desmarca y se apaga', cbL.checked === false && cbL.disabled === true, { chk: cbL.checked, dis: cbL.disabled });
  ok('L4 el campo Nombre queda vacío y libre', nmL.value === '' && nmL.disabled === false, { val: nmL.value });
  ok('L5 el cursor NO se lleva al campo Nombre mientras se escribe el concepto', enfocoNombre === 0, enfocoNombre);
  w.setTallerSvc('libre', null);
  const libre2 = w.tallerItems.find(i => i.tipo === 'libre');
  inpL.value = ''; libre2.concepto = ''; libre2.precio = ''; w.generarWA();
  ok('L6 si se borra lo escrito en Libre la casilla se habilita', cbL.disabled === false, cbL.disabled);
  libre2.precio = '300'; w.generarWA();
  ok('L7 escribir solo el precio en Libre también bloquea', cbL.disabled === true, cbL.disabled);

  console.log('\n' + (failed ? '❌' : '✅') + ' ' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
