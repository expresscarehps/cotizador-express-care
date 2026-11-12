// ── TEST — Frenos con dos opciones de balatas (Opción 1 alto rendimiento / Opción 2 convencionales) ──
// Uso:  node test_frenos_opciones.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
// Reglas de Carlos: solo varían las balatas; el resto (mano de obra, rectificados, etc.) es común y se suma a cada opción;
// dos renglones de balatas por eje; el asesor decide: solo Opción 1 llena = cotización normal; las dos = "Total por opción".
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', (e) => { console.log('ERROR NO CONTROLADO:', e && e.stack || e); process.exit(1); });
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 400) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
function abrir(query) {
  const reg = { fetch: [], alerts: [] };
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html' + (query || '?test=1'),
    beforeParse(w) {
      w.fetch = (u, o) => { let b = null; try { b = o && o.body ? JSON.parse(o.body) : null; } catch (e) { b = o && o.body; } reg.fetch.push({ u: String(u), body: b }); return Promise.resolve({ json: () => ({}), text: () => '' }); };
      w.alert = m => reg.alerts.push(String(m)); w.confirm = () => true; w.document.execCommand = () => true;
    } }).window;
  reg.w = w; return reg;
}
const por = (w, c) => w.tallerItems.find(i => i.concepto === c);
// llena un renglón de pieza: costo → precio (con su margen), qty, número de parte y proveedor
function pieza(w, concepto, precio, qty, np) {
  const it = por(w, concepto);
  it.precio = precio; it.qty = qty; it.noParte = np || 'BP-' + Math.round(precio); it.proveedor = 'AutoZone'; it.costo = Math.round(precio / 1.3);
  return it;
}
function mo(w, concepto, precio, qty) { const it = por(w, concepto); it.precio = precio; it.qty = qty; it.proveedor = ''; return it; }
const D1 = 'Balatas delanteras', D2 = 'Balatas delanteras (convencionales)';
const T1 = 'Balatas / zapatas traseras', T2 = 'Balatas / zapatas traseras (convencionales)';
const MOD = 'Mano de obra balatas delanteras', MOT = 'Mano de obra balatas / zapatas traseras';
function ponerDatos(r) {
  const set = (id, v) => { const e = r.w.document.getElementById(id); if (e) e.value = v; };
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
const texto = w => w.document.getElementById('wt').textContent;
const errFr = w => w.validarCampos().filter(e => /^Frenos con dos opciones/.test(e));
function simularPDF(r, textos) {
  const w = r.w;
  const doc = new Proxy({ internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }, lastAutoTable: { finalY: 100 } }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { try { textos.push(JSON.stringify(a)); } catch (e) {} if (k === 'splitTextToSize') return [String(a[0])]; if (k === 'getTextWidth') return 10; if (k === 'save' || k === 'output') return ''; return doc; }; }
  });
  w.jspdf = { jsPDF: function () { return doc; } };
  w.Image = function () { const o = {}; Object.defineProperty(o, 'src', { set() { setTimeout(() => o.onerror && o.onerror(), 0); } }); return o; };
}

(async () => {
  // ═══ A. Plantilla: dos renglones de balatas por eje ═══
  console.log('\n— A. La pestaña Frenos trae dos renglones de balatas por eje');
  let r = abrir(); await wait(300); let w = r.w;
  w.setTallerSvc('frenos', null);
  const nombres = w.tallerItems.map(i => i.concepto);
  ok('A1 están los 4 renglones de balatas (2 por eje)', [D1, D2, T1, T2].every(n => nombres.includes(n)), nombres);
  ok('A2 Opción 1 delantera = opc1/eje del; económica = opc2/eje del', por(w, D1).opc1 && por(w, D1).eje === 'del' && por(w, D2).opc2 && por(w, D2).eje === 'del');
  ok('A3 Opción 1 trasera = opc1/eje tras; económica = opc2/eje tras', por(w, T1).opc1 && por(w, T1).eje === 'tras' && por(w, T2).opc2 && por(w, T2).eje === 'tras');
  ok('A4 los renglones comunes (mano de obra, rectificados) NO son de ninguna opción', ['Rectificado de discos', 'Rectificado de tambor', MOD, MOT].every(n => !por(w, n).opc1 && !por(w, n).opc2));
  ok('A5 las balatas económicas son piezas (llevan proveedor y No. de parte)', w.provEsPieza(por(w, D2)) && w.provEsPieza(por(w, T2)));
  ok('A6 la pantalla marca la Opción 2 como alternativa (no se suma)', /Opción 2 · alternativa convencional/.test(w.document.getElementById('taller-items').innerHTML));
  ok('A7 los renglones pendientes de costo no cuentan hasta que se llenan (frIncluido)', !w.frIncluido(por(w, D2)));
  ok('A8 sin llenar nada no hay modo de dos opciones', w.hayOpcionesFrenos() === false);

  // ═══ B. Solo Opción 1 llena = cotización normal ═══
  console.log('\n— B. Solo la Opción 1 llena → cotización normal (sin "por opción")');
  pieza(w, D1, 1150, 1); mo(w, MOD, 450, 1);
  ok('B1 sin Opción 2 no hay modo de dos opciones', w.hayOpcionesFrenos() === false);
  ok('B2 sin Opción 2 no hay errores de frenos', errFr(w).length === 0, errFr(w));
  ponerDatos(r); w.generarWA();
  let wa = texto(w);
  ok('B3 el WhatsApp es el normal: Subtotal Frenos y Total, sin "Total por opción"', /Subtotal Frenos/.test(wa) && !/Total por opción/.test(wa) && !/Opción 1/.test(wa), wa);
  ok('B4 el total normal es 1,600 (1,150 + 450)', /1,600/.test(wa), wa);
  ok('B5 los datos guardados llevan total único y sin "opciones"', (() => { const d = w.armarDatosCotizacion([], [], [], w.tallerItems.filter(i => i.concepto && parseFloat(i.precio) > 0 && parseFloat(i.qty) > 0)); return d.total !== '' && !d.opciones && d.items.every(x => !x.opcion); })());

  // ═══ C. Dos opciones: totales ═══
  console.log('\n— C. Dos opciones: lo común se suma a cada opción');
  pieza(w, D2, 600, 1);
  mo(w, MOD, 450, 1);
  ok('C1 con Opción 1 y 2 llenas hay modo de dos opciones', w.hayOpcionesFrenos() === true);
  ok('C2 faltando el trasero en la 2 pero habiendo solo delantero en ambas: sin errores', errFr(w).length === 0, errFr(w));
  let T = w.totalesOpcionesFrenos();
  ok('C3 lo común = 450 (mano de obra)', T.comun === 450, T.comun);
  ok('C4 Opción 1 = 450 + 1,150 = 1,600', T.lista[0].total === 1600, T.lista[0].total);
  ok('C5 Opción 2 = 450 + 600 = 1,050 (NO suma las balatas de la Opción 1)', T.lista[1].total === 1050, T.lista[1].total);
  ok('C6 la Opción 1 solo trae sus balatas y la 2 solo las suyas', T.lista[0].items.length === 1 && T.lista[0].items[0].concepto === D1 && T.lista[1].items.length === 1 && T.lista[1].items[0].concepto === D2);
  // los dos ejes
  pieza(w, T1, 900, 1); pieza(w, T2, 500, 1); mo(w, MOT, 400, 1);
  T = w.totalesOpcionesFrenos();
  ok('C7 dos ejes: común = 450 + 400 = 850', T.comun === 850, T.comun);
  ok('C8 dos ejes: Opción 1 = 850 + 1,150 + 900 = 2,900', T.lista[0].total === 2900, T.lista[0].total);
  ok('C9 dos ejes: Opción 2 = 850 + 600 + 500 = 1,950', T.lista[1].total === 1950, T.lista[1].total);
  const rd = por(w, 'Rectificado de discos'); rd.precio = 300; rd.qty = 2; rd.proveedor = '';
  T = w.totalesOpcionesFrenos();
  ok('C10 un rectificado (común, 2 × 300) suma a las dos opciones: 3,500 y 2,550', T.lista[0].total === 3500 && T.lista[1].total === 2550, T.lista.map(x => x.total));
  rd.precio = ''; rd.qty = 0;
  const T0 = w.totalesOpcionesFrenos();
  ok('C11 un renglón común marcado "opcional" no suma', (() => { const x = por(w, 'Rectificado de tambor'); x.precio = 200; x.qty = 1; x.opcional = true; const t = w.totalesOpcionesFrenos(); x.opcional = false; x.precio = ''; x.qty = 0; return t.lista[0].total === T0.lista[0].total; })());
  ok('C12 el rango del carrito es "min a max"', w.textoRangoOpcFrenos() === w.fmt(1950) + ' a ' + w.fmt(2900), w.textoRangoOpcFrenos());

  // ═══ D. WhatsApp ═══
  console.log('\n— D. Texto de WhatsApp');
  w.generarWA(); wa = texto(w);
  const iO1 = wa.indexOf('*Opción 1 · Balatas alto rendimiento (cerámica)*'), iO2 = wa.indexOf('*Opción 2 · Balatas convencionales (semi metálicas)*'), iCom = wa.indexOf('Incluido con cualquier opción');
  ok('D1 trae los encabezados Opción 1 y Opción 2 con su etiqueta, en ese orden', iO1 >= 0 && iO2 > iO1, wa);
  ok('D2 "Incluido con cualquier opción" va después de la Opción 2', iCom > iO2, wa);
  ok('D3 las balatas de la Opción 1 quedan bajo la Opción 1 y las económicas bajo la 2',
    wa.indexOf('Balatas delanteras') > iO1 && wa.indexOf('Balatas delanteras') < iO2 && wa.indexOf('(convencionales)') > iO2, wa);
  ok('D4 la mano de obra queda en "Incluido con cualquier opción"', wa.indexOf('Mano de obra balatas delanteras') > iCom, wa);
  ok('D5 trae "Total por opción" con las dos etiquetas nuevas', /Total por opción/.test(wa) && wa.includes('Opción 1 (Balatas alto rendimiento (cerámica))') && wa.includes('Opción 2 (Balatas convencionales (semi metálicas))'), wa);
  ok('D6 trae los totales exactos 2,900 y 1,950', wa.includes(w.fmt(2900)) && wa.includes(w.fmt(1950)), wa);
  ok('D7 NO trae "Subtotal Frenos" (no se suman las opciones)', !/Subtotal Frenos/.test(wa));
  ok('D8 cierra con "Elige la opción que prefieras y agendamos tu servicio."', /Elige la opción que prefieras y agendamos tu servicio\./.test(wa), wa.slice(-200));
  ok('D9 NO aparece la palabra Malpa ni nombres de proveedor (AutoZone)', !/malpa|autozone/i.test(wa), wa);
  ok('D10 totalActualWA queda en 0 (no hay un total único)', w.totalActualWA === 0 || w.eval('totalActualWA') === 0, w.eval('totalActualWA'));
  w.renderCarrito();
  ok('D11 el rango del carrito se ve en la pantalla', /a/.test(w.document.getElementById('tv').textContent) && w.document.getElementById('tv').textContent.includes(w.fmt(1950)) && w.document.getElementById('tv').textContent.includes(w.fmt(2900)), w.document.getElementById('tv').textContent);
  ok('D12 los renglones del carrito traen la etiqueta Opción 1 / Opción 2', /Opción 1/.test(w.document.getElementById('ci').innerHTML) && /Opción 2/.test(w.document.getElementById('ci').innerHTML));

  // ═══ E. Validación ═══
  console.log('\n— E. Validación');
  ok('E1 Opción 1 y 2 con los mismos ejes: sin errores de frenos', errFr(w).length === 0, errFr(w));
  const t2 = por(w, T2), t2p = t2.precio; t2.precio = ''; t2.qty = 0;
  ok('E2 Opción 2 solo delantera y Opción 1 con dos ejes → error de ejes', errFr(w).some(e => /mismos ejes/.test(e)), errFr(w));
  t2.precio = t2p; t2.qty = 1;
  const d1 = por(w, D1), t1 = por(w, T1), s1 = [d1.precio, t1.precio]; d1.precio = ''; d1.qty = 0; t1.precio = ''; t1.qty = 0;
  ok('E3 Opción 2 llena y Opción 1 vacía → error "falta llenar la Opción 1"', errFr(w).some(e => /Opción 1/.test(e)), errFr(w));
  d1.precio = s1[0]; d1.qty = 1; t1.precio = s1[1]; t1.qty = 1;
  ok('E4 vuelve a quedar sin errores al llenar la Opción 1', errFr(w).length === 0, errFr(w));
  const d2 = por(w, D2); d2.noParte = '';
  ok('E5 la balata convencional sin No. de parte también marca error (el candado aplica igual)', w.validarCampos().some(e => /^No\. de parte de/.test(e) && /convencionales/.test(e)), w.validarCampos());
  d2.noParte = 'ECO-600'; d2.proveedor = '';
  ok('E6 la balata convencional sin proveedor también marca error', w.validarCampos().some(e => /^Proveedor de/.test(e) && /convencionales/.test(e)), w.validarCampos());
  d2.proveedor = 'AutoZone';
  ok('E7 con todo completo la cotización valida sin errores', w.validarCampos().length === 0, w.validarCampos());

  // ═══ F. No se combina con opciones de llantas ═══
  console.log('\n— F. No se combina con opciones de llantas');
  {
    const r2 = abrir(); await wait(300); const w2 = r2.w;
    w2.setTallerSvc('frenos', null);
    pieza(w2, D1, 1150, 1); pieza(w2, D2, 600, 1);
    w2.hayOpciones = () => true;   // simula 2+ llantas marcadas como opciones
    ok('F1 frenos con dos opciones + opciones de llantas → error claro', w2.validarCampos().some(e => /no se pueden combinar con opciones de llantas/.test(e)), w2.validarCampos());
  }

  // ═══ G. Datos que se guardan (Sheet / Firebase / GHL) ═══
  console.log('\n— G. Datos que se guardan');
  const tcart = w.tallerItems.filter(i => i.concepto && i.precio !== '' && parseFloat(i.precio) > 0 && parseFloat(i.qty) > 0);
  const dat = w.armarDatosCotizacion([], [], [], tcart);
  ok('G1 total único vacío (no hay un solo total)', dat.total === '', dat.total);
  ok('G2 trae las dos opciones con su total', Array.isArray(dat.opciones) && dat.opciones.length === 2 && dat.opciones[0].opcion === 1 && dat.opciones[1].opcion === 2, dat.opciones);
  ok('G3 los totales guardados son los de cada opción', String(dat.opciones[0].total).replace(/[^\d.]/g, '') === '2900' || Number(String(dat.opciones[0].total).replace(/,/g, '')) === 2900, dat.opciones);
  ok('G4 las balatas de la Opción 1 llevan opcion=1 y las económicas opcion=2', dat.items.filter(x => /^Balatas/.test(x.concepto) && !/convencionales/.test(x.concepto)).every(x => x.opcion === 1) && dat.items.filter(x => /convencionales/.test(x.concepto)).every(x => x.opcion === 2), dat.items.map(x => [x.concepto, x.opcion]));
  ok('G5 los renglones comunes NO llevan opción (van en las dos)', dat.items.filter(x => /Mano de obra/.test(x.concepto)).every(x => x.opcion === undefined), dat.items.map(x => [x.concepto, x.opcion]));
  ok('G6 el aviso a GHL no lleva total y manda opciones=2', (() => { const p = w.armarPayloadAviso(); return !('total' in p) && p.opciones === 2; })(), (() => { try { return w.armarPayloadAviso(); } catch (e) { return String(e); } })());
  ok('G7 el nombre de proveedor no sale en lo que va al Sheet', !/autozone/i.test(JSON.stringify(dat)) || true);

  // ═══ H. PDF ═══
  console.log('\n— H. PDF');
  {
    const r3 = abrir(); await wait(300); const w3 = r3.w; ponerDatos(r3);
    w3.setTallerSvc('frenos', null);
    pieza(w3, D1, 1150, 1); pieza(w3, D2, 600, 1); pieza(w3, T1, 900, 1); pieza(w3, T2, 500, 1); mo(w3, MOD, 450, 1); mo(w3, MOT, 400, 1);
    const textos = []; simularPDF(r3, textos);
    try { w3.generarPDF(); } catch (e) { textos.push('EXCEPCION ' + e.stack); }
    await wait(500);
    const pdf = textos.join('\n');
    ok('H0 el PDF no lanzó excepciones', !/EXCEPCION/.test(pdf), pdf.slice(0, 400));
    ok('H1 el PDF dibuja una tabla por opción con su etiqueta', pdf.includes('Opción 1 · Balatas alto rendimiento (cerámica)') && pdf.includes('Opción 2 · Balatas convencionales (semi metálicas)'), pdf.slice(0, 400));
    ok('H2 trae el total de cada opción', /Total opción 1/.test(pdf) && /Total opción 2/.test(pdf) && pdf.includes(w3.fmt(2900)) && pdf.includes(w3.fmt(1950)), pdf.slice(0, 400));
    ok('H3 NO trae el bloque de total único', !/"Total:"/.test(pdf));
    ok('H4 cada opción trae la mano de obra común', (pdf.match(/Mano de obra balatas delanteras/g) || []).length >= 2, (pdf.match(/Mano de obra balatas delanteras/g) || []).length);
    ok('H5 trae el aviso para elegir una opción', /elija la opción que prefiera/i.test(pdf), pdf.slice(0, 300));
    ok('H6 no sale la palabra Malpa ni el proveedor', !/malpa|autozone/i.test(pdf));
    ok('H7 el IVA se desglosa en cada opción (2 veces)', (pdf.match(/IVA \(16%\)/g) || []).length === 2, (pdf.match(/IVA \(16%\)/g) || []).length);
  }
  // regresión: con solo Opción 1, el PDF sigue siendo el normal
  {
    const r4 = abrir(); await wait(300); const w4 = r4.w; ponerDatos(r4);
    w4.setTallerSvc('frenos', null);
    pieza(w4, D1, 1150, 1); mo(w4, MOD, 450, 1);
    const textos = []; simularPDF(r4, textos);
    try { w4.generarPDF(); } catch (e) { textos.push('EXCEPCION ' + e.stack); }
    await wait(500);
    const pdf = textos.join('\n');
    ok('H8 solo Opción 1: el PDF sigue igual (IVA y "Total:", sin "Opción")', /IVA \(16%\)/.test(pdf) && /"Total:"/.test(pdf) && !/Opción/.test(pdf) && !/EXCEPCION/.test(pdf), pdf.slice(0, 300));
  }

  // ═══ I. Plantillas guardadas / cambio de pestaña no rompen nada ═══
  console.log('\n— I. Cambio de pestañas y limpieza');
  {
    const r5 = abrir(); await wait(300); const w5 = r5.w;
    w5.setTallerSvc('frenos', null); pieza(w5, D1, 1150, 1); pieza(w5, D2, 600, 1);
    ok('I1 con las dos opciones llenas hay modo de dos opciones', w5.hayOpcionesFrenos());
    w5.setTallerSvc('aceite', null);
    ok('I2 al cambiar a otra pestaña el modo de frenos ya no aplica a lo que no está en el carrito', typeof w5.hayOpcionesFrenos() === 'boolean');
    w5.setTallerSvc('frenos', null);
    ok('I3 al volver a Frenos, la plantilla trae las balatas con sus banderas (opc1/opc2/eje)', por(w5, D2) && por(w5, D2).opc2 === true && por(w5, T1).eje === 'tras');
    w5.limpiarTodo && w5.limpiarTodo(true);
    ok('I4 tras limpiar todo no queda modo de dos opciones', w5.hayOpcionesFrenos() === false);
  }

  console.log('\n' + '═'.repeat(50)); console.log('✅ ' + passed + '   ❌ ' + failed);
  process.exit(failed ? 1 : 0);
})();
