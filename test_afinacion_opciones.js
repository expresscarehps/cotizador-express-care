// ── TEST — Afinación con dos opciones de bujías (Opción 1 / Opción 2) — pedido de Carlos, 25 nov 2026 ──
// Uso:  node test_afinacion_opciones.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
// Reglas de Carlos: solo varían las bujías; filtros, aceite, limpiezas y mano de obra son comunes y se suman a cada opción;
// al cliente NO se le dice el tipo de bujía (solo "Opción 1" y "Opción 2"); la Opción 2 solo sale si hay dos opciones;
// el mensaje da el TOTAL POR OPCIÓN; se puede combinar con Frenos de dos opciones (Opción 1 = todo lo de Opción 1, Opción 2 = todo lo de Opción 2).
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', (e) => { console.log('ERROR NO CONTROLADO:', e && e.stack || e); process.exit(1); });
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 500) : '')); failed++; } }
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
const por = (w, c) => w.tallerItems.find(i => i.tipo !== 'afinacion' && i.concepto === c) || w.tallerItems.find(i => i.concepto === c);
const bj = (w, n) => w.tallerItems.find(i => i.tipo === 'afinacion' && (n === 2 ? i.opc2 : i.opc1));
const af = (w, c) => w.tallerItems.find(i => i.tipo === 'afinacion' && i.concepto === c);
function pieza(it, precio, qty, np) { it.precio = precio; it.qty = qty; it.noParte = np || 'AF-' + Math.round(precio); it.proveedor = 'AutoZone'; it.costo = Math.round(precio / 1.3); return it; }
function mo(it, precio, qty) { it.precio = precio; it.qty = qty; it.proveedor = ''; return it; }
function ponerDatos(r) {
  const set = (id, v) => { const e = r.w.document.getElementById(id); if (e) e.value = v; };
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
const texto = w => w.document.getElementById('wt').textContent;
const errOp = w => w.validarCampos().filter(e => /con dos opciones/.test(e));
function simularPDF(r, textos) {
  const w = r.w;
  const doc = new Proxy({ internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }, lastAutoTable: { finalY: 100 } }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { try { textos.push(JSON.stringify(a)); } catch (e) {} if (k === 'splitTextToSize') return [String(a[0])]; if (k === 'getTextWidth') return 10; if (k === 'save' || k === 'output') return ''; return doc; }; }
  });
  w.jspdf = { jsPDF: function () { return doc; } };
  w.Image = function () { const o = {}; Object.defineProperty(o, 'src', { set() { setTimeout(() => o.onerror && o.onerror(), 0); } }); return o; };
}
// Afinación típica: bujías opción 1 = 4 × 250 = 1000; opción 2 = 4 × 150 = 600; común = aceite filtro 200 + aire 180 + M.O. 500 = 880
function afinacionBase(w, dosOpciones) {
  w.setTallerSvc('afinacion', null);
  pieza(bj(w, 1), 250, 4, 'NGK-IR');
  if (dosOpciones) pieza(bj(w, 2), 150, 4, 'NGK-PT');
  pieza(af(w, 'Filtro de aceite'), 200, 1, 'FA-1'); pieza(af(w, 'Filtro de aire'), 180, 1, 'FAI-1');
  mo(af(w, 'Mano de obra afinación menor'), 500, 1);
}

(async () => {
  // ═══ A. Plantilla ═══
  console.log('\n— A. La pestaña Afinación trae dos renglones de bujías y los márgenes nuevos');
  let r = abrir(); await wait(300); let w = r.w;
  w.setTallerSvc('afinacion', null);
  const bs = w.tallerItems.filter(i => i.tipo === 'afinacion' && /^Bujías/.test(i.concepto));
  ok('A1 hay dos renglones de bujías: Opción 1 (opc1) y Opción 2 (opc2)', bs.length === 2 && bs[0].opc1 && !bs[0].opc2 && bs[1].opc2 && !bs[1].opc1, bs.map(b => [b.concepto, b.opc1, b.opc2]));
  ok('A2 las dos bujías con margen 25%', bs.every(b => b.margen === 25), bs.map(b => b.margen));
  ok('A3 filtros de aceite, aire y cabina con margen 30%', ['Filtro de aceite', 'Filtro de aire', 'Filtro de cabina'].every(c => af(w, c).margen === 30));
  ok('A4 en Cambio de aceite los tres filtros también al 30%', (() => { w.setTallerSvc('aceite', null); return ['Filtro de aceite', 'Filtro de aire', 'Filtro de cabina'].every(c => w.tallerItems.find(i => i.tipo === 'aceite' && i.concepto === c).margen === 30); })());
  ok('A5 la Opción 2 sin llenar no activa opciones', !w.hayOpcionesFrenos());

  // ═══ B. Solo Opción 1 = cotización normal ═══
  console.log('\n— B. Solo la Opción 1 llena: la cotización sale normal');
  r = abrir(); await wait(300); w = r.w; ponerDatos(r);
  afinacionBase(w, false); w.generarWA(); let wa = texto(w);
  ok('B1 no hay opciones', !w.hayOpcionesFrenos());
  ok('B2 el WhatsApp es el normal: Subtotal Afinación y Total, sin "Total por opción" ni "Opción 1"', /Subtotal Afinación/.test(wa) && /Total: /.test(wa) && !/Total por opción/.test(wa) && !/Opción 1/.test(wa), wa);
  ok('B3 el total es 1,880 (bujías + común)', wa.includes(w.fmt(1880)), wa);
  ok('B4 los datos guardados llevan total único y sin "opciones"', (() => { const d = w.armarDatosCotizacion([], [], [], w.tallerItems.filter(i => w.tallerLineaOk(i))); return d.total !== '' && !d.opciones && d.items.every(i => !i.opcion); })());
  ok('B5 sin errores de opciones', errOp(w).length === 0, errOp(w));

  // ═══ C. Dos opciones ═══
  console.log('\n— C. Las dos opciones llenas: total por opción');
  r = abrir(); await wait(300); w = r.w; ponerDatos(r);
  afinacionBase(w, true); w.generarWA(); wa = texto(w);
  ok('C1 hay dos opciones', w.hayOpcionesFrenos());
  ok('C2 los totales son 1,880 y 1,480 (común 880 + bujías de cada opción)', (() => { const T = w.totalesOpcionesFrenos(); return Math.abs(T.lista[0].total - 1880) < 0.005 && Math.abs(T.lista[1].total - 1480) < 0.005 && Math.abs(T.comun - 880) < 0.005; })(), w.totalesOpcionesFrenos());
  ok('C3 el WhatsApp trae "Total por opción" con Opción 1 y Opción 2 SIN etiqueta de material ni de balatas', /Total por opción/.test(wa) && /\* Opción 1: \*\$1,880\.00\*/.test(wa) && /\* Opción 2: \*\$1,480\.00\*/.test(wa) && !/Balatas/.test(wa), wa);
  ok('C4 NO trae el total único ni "Subtotal Afinación"', !/✅ \*Total: /.test(wa) && !/Subtotal Afinación/.test(wa), wa);
  ok('C5 la sección de Afinación separa: Opción 1, Opción 2 e "Incluido con cualquier opción"', /\*Opción 1\*/.test(wa) && /\*Opción 2\*/.test(wa) && /Incluido con cualquier opción/.test(wa), wa);
  ok('C6 al cliente NO se le dice el tipo de bujía ni sale "(especificar tipo)"', !/iridio|platino|doble platino|NGK-|especificar tipo/i.test(wa.replace(/Bujías NGK de alta calidad[^\n]*\n/, '')), wa);
  ok('C7 las bujías salen en su opción y los filtros/mano de obra en lo común', (() => { const i1 = wa.indexOf('*Opción 1*'), i2 = wa.indexOf('*Opción 2*'), ic = wa.indexOf('Incluido con cualquier opción'); const sec = (a, b) => wa.slice(a, b); return /Bujías x4 - \$250\.00 c\/u = \$1,000\.00/.test(sec(i1, i2)) && /Bujías x4 - \$150\.00 c\/u = \$600\.00/.test(sec(i2, ic)) && /Filtro de aceite/.test(sec(ic, wa.length)) && /Mano de obra afinación menor/.test(sec(ic, wa.length)); })(), wa);
  ok('C8 sin errores de opciones', errOp(w).length === 0, errOp(w));
  ok('C9 el total de la barra muestra el rango', (w.renderCarrito(), true) && w.document.getElementById('tv').textContent.includes(w.fmt(1480)) && w.document.getElementById('tv').textContent.includes(w.fmt(1880)), w.document.getElementById('tv').textContent);

  // ═══ D. Validación ═══
  console.log('\n— D. Validación');
  r = abrir(); await wait(300); w = r.w; ponerDatos(r);
  w.setTallerSvc('afinacion', null); pieza(bj(w, 2), 150, 4, 'NGK-PT'); mo(af(w, 'Mano de obra afinación menor'), 500, 1);
  ok('D1 solo la Opción 2 llena: avisa que falta la Opción 1 (bujías)', errOp(w).some(e => /Afinación con dos opciones: falta llenar la Opción 1 \(bujías\)/.test(e)), errOp(w));

  // ═══ E. Datos guardados (Sheet / GHL) ═══
  console.log('\n— E. Lo que se guarda');
  r = abrir(); await wait(300); w = r.w; ponerDatos(r); afinacionBase(w, true);
  const tcart = w.tallerItems.filter(i => w.tallerLineaOk(i));
  const dat = w.armarDatosCotizacion([], [], [], tcart);
  ok('E1 datos con total vacío y dos opciones con su total', dat.total === '' && Array.isArray(dat.opciones) && dat.opciones.length === 2 && dat.opciones[0].opcion === 1 && dat.opciones[1].opcion === 2 && Math.abs(parseFloat(String(dat.opciones[0].total).replace(/,/g, '')) - 1880) < 0.005 && Math.abs(parseFloat(String(dat.opciones[1].total).replace(/,/g, '')) - 1480) < 0.005, dat.opciones);
  ok('E2 cada renglón de bujías lleva su número de opción; los comunes no', dat.items.filter(i => /Bujías/.test(i.producto)).map(i => i.opcion).sort().join() === '1,2' && dat.items.filter(i => !/Bujías/.test(i.producto)).every(i => !i.opcion), dat.items.map(i => [i.producto, i.opcion]));
  ok('E3 no se inventa marca en el Sheet para las bujías (la columna Marca es de balatas)', dat.items.filter(i => /Bujías/.test(i.producto)).every(i => !i.marca), dat.items.filter(i => /Bujías/.test(i.producto)));
  ok('E4 el aviso a GHL no lleva total y manda opciones=2', (() => { const p = w.armarPayloadAviso(); return !('total' in p) && p.opciones === 2; })());

  // ═══ F. PDF ═══
  console.log('\n— F. PDF');
  {
    const r3 = abrir(); await wait(300); const w3 = r3.w; ponerDatos(r3); afinacionBase(w3, true);
    const textos = []; simularPDF(r3, textos);
    try { w3.generarPDF(); } catch (e) { textos.push('EXCEPCION ' + e.stack); }
    await wait(500); const pdf = textos.join('\n');
    ok('F0 el PDF no lanzó excepciones', !/EXCEPCION/.test(pdf), pdf.slice(0, 400));
    ok('F1 una tabla por opción: "Opción 1" y "Opción 2" a secas (sin etiqueta de balatas)', /"Opción 1"/.test(pdf) && /"Opción 2"/.test(pdf) && !/Balatas/.test(pdf), pdf.slice(0, 300));
    ok('F2 trae el total de cada opción', /Total opción 1/.test(pdf) && /Total opción 2/.test(pdf) && pdf.includes(w3.fmt(1880)) && pdf.includes(w3.fmt(1480)));
    ok('F3 NO trae el bloque de total único', !/"Total:"/.test(pdf));
    ok('F4 trae el aviso para elegir una opción', /Afinación: elija la opción que prefiera/.test(pdf), pdf.slice(0, 300));
    ok('F5 cada opción trae lo común (mano de obra 2 veces) y el IVA 2 veces', (pdf.match(/Mano de obra afinación menor/g) || []).length >= 2 && (pdf.match(/IVA \(16%\)/g) || []).length === 2);
    ok('F6 no sale el tipo de bujía ni "(especificar tipo)"', !/iridio|platino|especificar tipo/i.test(pdf), pdf.slice(0, 200));
  }
  {
    const r4 = abrir(); await wait(300); const w4 = r4.w; ponerDatos(r4); afinacionBase(w4, false);
    const textos = []; simularPDF(r4, textos);
    try { w4.generarPDF(); } catch (e) { textos.push('EXCEPCION ' + e.stack); }
    await wait(500); const pdf = textos.join('\n');
    ok('F7 solo Opción 1: el PDF sigue siendo el normal (IVA y "Total:", sin "Opción")', /IVA \(16%\)/.test(pdf) && /"Total:"/.test(pdf) && !/Opción/.test(pdf) && !/EXCEPCION/.test(pdf), pdf.slice(0, 300));
  }

  // ═══ G. Afinación + Frenos en la misma cotización ═══
  console.log('\n— G. Combinado con Frenos');
  {
    // G1: las dos con dos opciones
    const rg = abrir(); await wait(300); const wg = rg.w; ponerDatos(rg);
    afinacionBase(wg, true);
    wg.setTallerSvc('frenos', null);
    pieza(por(wg, 'Balatas delanteras'), 1150, 1, 'BP-1'); pieza(por(wg, 'Balatas delanteras (convencionales)'), 600, 1, 'BP-2'); mo(por(wg, 'Mano de obra balatas delanteras'), 450, 1);
    wg.generarWA(); const wag = texto(wg);
    // común = 880 (afinación) + 450 (M.O. frenos) = 1330; Opción 1 = 1330 + 1000 + 1150 = 3480; Opción 2 = 1330 + 600 + 600 = 2530
    const T = wg.totalesOpcionesFrenos();
    ok('G1 Opción 1 suma todo lo de Opción 1 y Opción 2 todo lo de Opción 2', Math.abs(T.lista[0].total - 3480) < 0.005 && Math.abs(T.lista[1].total - 2530) < 0.005, T.lista.map(x => x.total));
    ok('G2 los totales salen como "Opción 1" y "Opción 2" a secas', /\* Opción 1: \*\$3,480\.00\*/.test(wag) && /\* Opción 2: \*\$2,530\.00\*/.test(wag), wag);
    ok('G3 en la sección de Frenos se conservan sus etiquetas y en Afinación no hay etiqueta', /\*Opción 1 · Balatas Primera Calidad\*/.test(wag) && /\*Opción 2 · Balatas Calidad Estándar\*/.test(wag) && !/\*Opción 1 · Bujías/.test(wag), wag);
    ok('G4 sin errores de opciones', errOp(wg).length === 0, errOp(wg));
    // G5: Frenos con dos opciones y Afinación solo con la bujía de Opción 1 → bujías van en lo común (se suman a las dos)
    const rh = abrir(); await wait(300); const wh = rh.w; ponerDatos(rh);
    afinacionBase(wh, false);
    wh.setTallerSvc('frenos', null);
    pieza(por(wh, 'Balatas delanteras'), 1150, 1, 'BP-1'); pieza(por(wh, 'Balatas delanteras (convencionales)'), 600, 1, 'BP-2'); mo(por(wh, 'Mano de obra balatas delanteras'), 450, 1);
    const Th = wh.totalesOpcionesFrenos();
    ok('G5 Afinación sin Opción 2: sus bujías son comunes y se suman a las dos opciones de Frenos', Math.abs(Th.lista[0].total - (1880 + 450 + 1150)) < 0.005 && Math.abs(Th.lista[1].total - (1880 + 450 + 600)) < 0.005, Th.lista.map(x => x.total));
    ok('G6 con solo Frenos con opciones, la etiqueta de los totales sigue siendo la de balatas', /Opción 1 \(Balatas Primera Calidad\)/.test((wh.generarWA(), texto(wh))));
    // G7: Afinación con dos opciones y Frenos con solo la Opción 1 → balatas comunes
    const ri = abrir(); await wait(300); const wi = ri.w; ponerDatos(ri);
    afinacionBase(wi, true);
    wi.setTallerSvc('frenos', null);
    pieza(por(wi, 'Balatas delanteras'), 1150, 1, 'BP-1'); mo(por(wi, 'Mano de obra balatas delanteras'), 450, 1);
    const Ti = wi.totalesOpcionesFrenos();
    ok('G7 Frenos sin Opción 2: sus balatas son comunes y se suman a las dos opciones de Afinación', Math.abs(Ti.lista[0].total - (880 + 1150 + 450 + 1000)) < 0.005 && Math.abs(Ti.lista[1].total - (880 + 1150 + 450 + 600)) < 0.005, Ti.lista.map(x => x.total));
  }

  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
