// ── TEST — Precios fijos de las limpiezas (inyectores $125, cuerpo de aceleración $180), editables en Tarifas ──
// Uso:  node test_tarifas_fijas.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
const item = (w, c) => w.tallerItems.find(i => i.concepto === c && i.tipo === 'afinacion');
const INY = 'Limpieza de inyectores', CUE = 'Limpieza cuerpo de aceleración';

(async () => {
  let w = abrir(); await wait(3500);   // la carga de tarifas tarda hasta 3 s (sin Sheet en la prueba)

  console.log('\n— A. Precios ya puestos al abrir Afinación');
  ok('A1 la tarifa de inyectores es $125 y la de cuerpo de aceleración $180', w.tarifasMO[INY] === 125 && w.tarifasMO[CUE] === 180, [w.tarifasMO[INY], w.tarifasMO[CUE]]);
  ok('A2 en Configuración quedan con tipo Afinación', w.tarifasMOTipos[INY] === 'afinacion' && w.tarifasMOTipos[CUE] === 'afinacion');
  ok('A3 el renglón de inyectores sale con $125', parseFloat(item(w, INY).precio) === 125, item(w, INY).precio);
  ok('A4 el renglón de cuerpo de aceleración sale con $180', parseFloat(item(w, CUE).precio) === 180, item(w, CUE).precio);
  ok('A5 son los mismos renglones de siempre (FIJO, con cantidad y proveedor)', item(w, INY).precioFijo === true && item(w, INY).conQty === true && item(w, CUE).precioFijo === true);
  const filaI = $$(w, '#taller-items .taller-row').find(r => (r.querySelector('input[data-f="concepto"]') || {}).value === INY);
  ok('A6 en pantalla el campo de precio muestra 125 y sigue habiendo selector de proveedor', !!filaI && filaI.querySelector('input[data-f="precio"]').value === '125' && !!filaI.querySelector('select.prov-sel'), filaI && filaI.querySelector('input[data-f="precio"]').value);
  ok('A7 sigue la insignia FIJO', !!filaI && /FIJO/.test(filaI.textContent));
  ok('A8 no se duplicaron como renglones de mano de obra', w.tallerItems.filter(i => i.tipo === 'afinacion' && i.concepto === INY).length === 1 && w.tallerItems.filter(i => i.tipo === 'afinacion' && i.concepto === CUE).length === 1);
  ok('A9 el aceite por litro NO trae precio (no cambió)', item(w, 'Aceite (especificar viscosidad)').precio === '', item(w, 'Aceite (especificar viscosidad)').precio);
  ok('A10 la cantidad sigue en 0 (el asesor decide si lo cotiza)', item(w, INY).qty === 0 && item(w, CUE).qty === 0);

  console.log('\n— B. En la cotización');
  w.updTallerField(item(w, INY).id, 'qty', '1');
  const sub = w.tallerItems.filter(i => i.tipo === 'afinacion' && i.concepto === INY).map(i => parseFloat(i.precio) * i.qty)[0];
  ok('B2 subtotal 125 x 1', sub === 125, sub);
  const errs = w.validarCampos().filter(e => /^Proveedor de/.test(e));
  ok('B3 sigue pidiendo proveedor (nada cambió en eso)', errs.some(e => /Limpieza de inyectores/.test(e)), errs);
  w.updTallerField(item(w, INY).id, 'precio', '140');
  ok('B4 el precio sigue siendo editable en la cotización', parseFloat(item(w, INY).precio) === 140);
  item(w, INY).qty = 0;

  console.log('\n— C. Cambiar la tarifa en Configuración');
  w.tarifasMO[INY] = 135; w.tarifasMO[CUE] = 190;
  w.cargarPlantilla('afinacion');
  ok('C1 una cotización nueva sale con el precio nuevo', parseFloat(item(w, INY).precio) === 135 && parseFloat(item(w, CUE).precio) === 190, [item(w, INY).precio, item(w, CUE).precio]);
  w.renderConfigTarifas();
  const filasCfg = $$(w, '#config-tarifas div[data-key]').map(r => [r.querySelector('.cfg-concepto').value, r.querySelector('.cfg-tarifa').value, r.querySelector('.cfg-tipo').value]);
  ok('C2 las dos aparecen en Configuración con su precio y tipo Afinación', JSON.stringify(filasCfg.filter(f => f[0] === INY || f[0] === CUE)) === JSON.stringify([[INY, '135', 'afinacion'], [CUE, '190', 'afinacion']]), filasCfg.filter(f => /Limpieza/.test(f[0])));
  w.tarifasMO[INY] = 0; w.cargarPlantilla('afinacion');
  ok('C3 si una tarifa quedara en 0, el renglón sale vacío como antes', item(w, INY).precio === '', item(w, INY).precio);

  console.log('\n— D. Lo que ya tenga guardado el Sheet manda');
  w = abrir(); await wait(300);
  w._tarifasCallback({ tarifas: { 'Mano de obra afinación mayor': 1000, [INY]: 130 }, tipos: {} });
  ok('D1 si el Sheet ya trae la tarifa (130), no se pisa con 125', w.tarifasMO[INY] === 130, w.tarifasMO[INY]);
  ok('D2 la que le falta al Sheet sí se agrega (180)', w.tarifasMO[CUE] === 180, w.tarifasMO[CUE]);
  w.cargarPlantilla('afinacion');
  ok('D3 el renglón sale con 130 y 180', parseFloat(item(w, INY).precio) === 130 && parseFloat(item(w, CUE).precio) === 180, [item(w, INY).precio, item(w, CUE).precio]);
  ok('D4 las tarifas de mano de obra de siempre no se tocaron', w.tarifasMO['Mano de obra afinación mayor'] === 1000);

  console.log('\n— E. Otras pestañas no cambian');
  w.setTallerSvc('aceite', null); w.setTallerSvc('frenos', null); w.setTallerSvc('suspension', null);
  const fijosOtros = w.tallerItems.filter(i => i.tipo !== 'afinacion' && i.precioFijo).map(i => [i.tipo, i.concepto, i.precio]);
  ok('E1 los renglones FIJO de otras pestañas siguen sin precio', fijosOtros.every(f => f[2] === ''), fijosOtros);

  console.log('\n' + '═'.repeat(50)); console.log('✅ ' + passed + '   ❌ ' + failed);
  process.exit(failed ? 1 : 0);
})();
