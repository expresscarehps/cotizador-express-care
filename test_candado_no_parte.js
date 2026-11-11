// ── TEST — Candado del No. de parte (todas las pestañas) + N/A / S/N solo en Libre + N/A como proveedor en Libre ──
// Uso:  node test_candado_no_parte.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
const $$ = (w, s) => Array.from(w.document.querySelectorAll(s));
const errNP = w => w.validarCampos().filter(e => /^No\. de parte de/.test(e));
const errProv = w => w.validarCampos().filter(e => /^Proveedor de/.test(e));
function poner(w, it, noParte) { it.noParte = noParte; it.precio = 500; it.qty = 1; it.proveedor = it.proveedor || 'AutoZone'; }
function inputNP(w, id) { return w.document.querySelector('input[data-f="noParte"][data-id="' + id + '"]'); }
function tipear(w, inp, val, ev) { inp.value = val; inp.dispatchEvent(new w.Event(ev || 'input', { bubbles: true })); }

(async () => {
  let w = abrir(); await wait(300);

  console.log('\n— A. Pestañas normales: el número de parte es obligatorio y real');
  w.setTallerSvc('suspension', null);
  const amort = w.tallerItems.find(i => i.concepto === 'Amortiguador delantero');
  poner(w, amort, '');
  ok('A1 sin número → error con el nombre de la pieza', errNP(w).some(e => /Amortiguador delantero/.test(e)), errNP(w));
  ok('A2 el campo se marca en rojo', inputNP(w, amort.id).classList.contains('field-error'));
  ok('A3 el mensaje es "escribe el número de parte" (sin mencionar N/A)', /escribe el número de parte$/.test(errNP(w)[0]) && !/N\/A/.test(errNP(w)[0]), errNP(w)[0]);
  for (const malo of ['N/A', 'NA', 'na', 'S/N', 'sn', 'sin número', '.', '-', '0', 'ab', 'xxx', '000']) {
    amort.noParte = malo;
    ok('A4 "' + malo + '" NO vale en Suspensión', errNP(w).length === 1, errNP(w));
  }
  amort.noParte = 'N/A'; const msg = errNP(w)[0] || '';
  ok('A5 N/A en Suspensión: el mensaje dice que solo se permite en Libre', /solo se permiten en Libre/.test(msg), msg);
  for (const bueno of ['333-5007-2B', '48511-09M70', 'C10550', 'ST10346', 'GP-1234']) {
    amort.noParte = bueno;
    ok('A6 "' + bueno + '" sí vale', errNP(w).length === 0, errNP(w));
  }
  ok('A7 con número real se quita la marca roja', !inputNP(w, amort.id).classList.contains('field-error'));
  ok('A8 la pestaña Suspensión queda marcada cuando falta', (amort.noParte = '', errNP(w), w.document.querySelector('.ttab[data-s="suspension"]').classList.contains('ttab-err')));
  amort.noParte = 'ABC123'; errNP(w);
  ok('A9 al corregir se quita la marca de la pestaña', !w.document.querySelector('.ttab[data-s="suspension"]').classList.contains('ttab-err'));

  console.log('\n— B. Mano de obra, FIJO y llantas no llevan candado');
  const mo = w.tallerItems.find(i => i.mo && i.tipo === 'suspension');
  if (mo) { mo.precio = 500; mo.qty = 1; }
  ok('B1 un renglón de mano de obra no pide No. de parte', errNP(w).length === 0, errNP(w));
  w.setTallerSvc('afinacion', null);
  const limp = w.tallerItems.find(i => i.concepto === 'Limpieza de inyectores');
  limp.precio = 180; limp.qty = 1; limp.proveedor = 'ECOM';
  ok('B2 renglón de precio fijo (limpieza) no pide No. de parte', errNP(w).length === 0, errNP(w));
  const buj = w.tallerItems.find(i => i.concepto === 'Bujías (especificar tipo)');
  poner(w, buj, '');
  ok('B3 Afinación: bujías sin número → error', errNP(w).some(e => /Bujías/.test(e)), errNP(w));
  buj.noParte = 'NGK 94297'; ok('B4 con número queda bien', errNP(w).length === 0, errNP(w));
  const nuevoPrecio = buj.precio; buj.precio = ''; buj.noParte = '';
  ok('B5 renglón sin precio / sin cantidad todavía no se exige (igual que el proveedor)', errNP(w).length === 0, errNP(w));
  buj.precio = nuevoPrecio; buj.noParte = 'NGK 94297';

  console.log('\n— C. Libre: N/A y S/N permitidos, siempre normalizados');
  w.setTallerSvc('libre', null);
  let libre = w.tallerItems.find(i => i.tipo === 'libre');
  libre.concepto = 'Servicio de diagnóstico'; libre.precio = 400; libre.qty = 1; libre.proveedor = 'N/A'; libre.noParte = '';
  ok('C1 Libre sin número → error que ofrece N/A / S/N', /N\/A \/ S\/N/.test(errNP(w)[0] || ''), errNP(w));
  const inp = inputNP(w, libre.id);
  ok('C2 el campo trae la lista con N/A y S/N', inp.getAttribute('list') === 'np-libre-op' && Array.from(w.document.querySelectorAll('#np-libre-op option')).map(o => o.value).join() === 'N/A,S/N');
  tipear(w, inp, 'na', 'input'); tipear(w, inp, 'na', 'change');
  ok('C3 "na" escrito a mano → se guarda como N/A', libre.noParte === 'N/A' && inp.value === 'N/A', [libre.noParte, inp.value]);
  ok('C4 N/A en Libre ya no da error', errNP(w).length === 0, errNP(w));
  for (const [escrito, esperado] of [['n/a', 'N/A'], ['N.A.', 'N/A'], ['No aplica', 'N/A'], ['sn', 'S/N'], ['s/n', 'S/N'], ['S.N.', 'S/N'], ['Sin número', 'S/N']]) {
    libre.noParte = escrito; errNP(w);
    ok('C5 "' + escrito + '" al validar queda como ' + esperado, libre.noParte === esperado, libre.noParte);
  }
  for (const malo of ['.', 'xx', '000', '-']) { libre.noParte = malo; ok('C6 "' + malo + '" tampoco vale en Libre', errNP(w).length === 1, errNP(w)); }
  libre.noParte = '48511-09M70'; ok('C7 un número real sigue valiendo en Libre', errNP(w).length === 0, errNP(w));
  w.addTallerItem();
  const extra = w.tallerItems[w.tallerItems.length - 1];
  ok('C8 renglón agregado con "+" estando en Libre cuenta como Libre', w.npEsLibre(extra) === true);
  extra.concepto = 'Otra pieza'; extra.precio = 100; extra.qty = 1; extra.proveedor = 'N/A'; extra.noParte = 'S/N';
  ok('C9 ese renglón acepta S/N', errNP(w).length === 0, errNP(w));
  w.tallerItems = w.tallerItems.filter(i => i !== extra);

  console.log('\n— D. Proveedor: N/A como opción fija solo en Libre');
  w.setTallerSvc('libre', null);
  const selL = w.document.querySelector('#taller-items select.prov-sel');
  const valsL = Array.from(selL.options).map(o => o.value);
  ok('D1 Libre: la primera opción real del proveedor es N/A', valsL[1] === 'N/A', valsL.slice(0, 4));
  ok('D2 N/A aparece una sola vez', valsL.filter(v => v === 'N/A').length === 1);
  ok('D3 "Mismo proveedor para todas" en Libre también trae N/A', Array.from(w.document.querySelectorAll('#prov-todos-sel option')).some(o => o.value === 'N/A'));
  for (const s of ['afinacion', 'aceite', 'frenos', 'suspension']) {
    w.setTallerSvc(s, null);
    const todos = Array.from(w.document.querySelectorAll('select.prov-sel')).every(sel => !Array.from(sel.options).some(o => o.value === 'N/A'));
    ok('D4 ' + s + ': el proveedor N/A NO existe', todos);
    ok('D5 ' + s + ': el campo No. de parte no trae la lista de N/A', !$$(w, 'input[data-f="noParte"]').some(i => i.getAttribute('list')));
  }
  w.setTallerSvc('libre', null);
  libre.proveedor = ''; libre.noParte = 'S/N'; libre.concepto = 'Servicio de diagnóstico'; libre.precio = 400; libre.qty = 1;
  ok('D6 Libre sin proveedor sigue marcando error (hay que elegir N/A)', errProv(w).some(e => /Servicio de diagnóstico/.test(e)), errProv(w));
  libre.proveedor = 'N/A'; ok('D7 Libre con proveedor N/A ya no da error', errProv(w).length === 0, errProv(w));
  const ev = w.provEvaluar;
  ok('D8 no se puede crear un proveedor llamado "NA" / "SN" / "N.A."', ['NA', 'SN', 'N.A.', 'S.N.'].every(n => ev(n).estado === 'invalido'), ['NA', 'SN', 'N.A.'].map(n => ev(n)));
  ok('D9 un proveedor normal sigue pudiendo crearse', ev('Refaccionaria Nueva').estado === 'ok', ev('Refaccionaria Nueva'));

  console.log('\n— E. Escritura: la marca roja se quita sola');
  w.setTallerSvc('suspension', null);
  const am2 = w.tallerItems.find(i => i.concepto === 'Amortiguador delantero');
  am2.noParte = ''; am2.precio = 500; am2.qty = 1; am2.proveedor = 'Govi'; errNP(w);
  const i2 = inputNP(w, am2.id);
  ok('E1 el campo vacío está en rojo', i2.classList.contains('field-error'));
  tipear(w, i2, '333-5007-2B', 'input');
  ok('E2 al escribir un número real se quita el rojo', !i2.classList.contains('field-error'));
  tipear(w, i2, 'N/A', 'input'); tipear(w, i2, 'N/A', 'change');
  ok('E3 en Suspensión N/A no se normaliza (queda tal cual y sigue en error)', am2.noParte === 'N/A' && errNP(w).length === 1, am2.noParte);

  console.log('\n' + '═'.repeat(50)); console.log('✅ ' + passed + '   ❌ ' + failed);
  process.exit(failed ? 1 : 0);
})();
