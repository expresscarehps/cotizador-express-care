// ── TEST — 5% de descuento automático en la mano de obra de amortiguadores (27 nov 2026) ─────────────────────
// Regla de Carlos: si la cotización de Suspensión lleva EXACTAMENTE 2 amortiguadores delanteros y 2 traseros, la mano de obra
// de los amortiguadores (delantero y trasero) lleva 5% de descuento. El cliente lo ve con una leyenda en WhatsApp y PDF.
// Solo la mano de obra de amortiguadores (no horquilla, barra, rótula ni base). El 5% es fijo en el código.
// Uso:  node test_suspension_descuento.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
const BASE = 'https://expresscarehps.github.io/cotizador-express-care/';
function abrir(query) {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: BASE + 'cotizador_dev.html' + (query === undefined ? '?test=1' : query),
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
const por = (w, c) => w.tallerItems.find(i => i.concepto === c);
const AD = 'Amortiguador delantero', AT = 'Amortiguador trasero';
const MOD = 'Mano de obra amortiguador delantero', MOT = 'Mano de obra amortiguador trasero';
const MOH = 'Mano de obra instalación horquilla', MOB = 'Mano de obra barra estabilizadora', MOR = 'Mano de obra rótula';
const TARIFAS = { 'Mano de obra amortiguador delantero': 600, 'Mano de obra amortiguador trasero': 450, 'Mano de obra instalación horquilla': 700,
  'Mano de obra barra estabilizadora': 450, 'Mano de obra rótula': 450, 'Mano de obra base de amortiguador': 590 };
const texto = w => w.document.getElementById('wt').textContent;
function qty(w, concepto, n) { w.updTallerField(por(w, concepto).id, 'qty', String(n)); }
function pieza(w, concepto, precio) { const it = por(w, concepto); it.precio = precio; it.noParte = 'AM-' + precio; it.proveedor = 'AutoZone'; return it; }
function ponerDatos(w) {
  const set = (id, v) => { const e = w.document.getElementById(id); if (e) e.value = v; };
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
function simularPDF(w, textos) {
  const doc = new Proxy({ internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }, lastAutoTable: { finalY: 100 } }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { try { textos.push(JSON.stringify(a)); } catch (e) {} if (k === 'splitTextToSize') return [String(a[0])]; if (k === 'getTextWidth') return 10; if (k === 'save' || k === 'output') return ''; return doc; }; }
  });
  w.jspdf = { jsPDF: function () { return doc; } };
  w.Image = function () { const o = {}; Object.defineProperty(o, 'src', { set() { setTimeout(() => o.onerror && o.onerror(), 0); } }); return o; };
}
// Suspensión con las tarifas reales del Sheet (delantero $600, trasero $450) y las dos piezas con precio
async function suspension(tarifas) {
  const w = abrir(); await wait(250);
  w.tarifasMO = Object.assign({}, tarifas === undefined ? TARIFAS : tarifas);
  w.setTallerSvc('suspension', null);
  pieza(w, AD, 1000); pieza(w, AT, 800);
  return w;
}
const total = w => w.tallerItems.filter(w.tallerLineaOk).reduce((s, i) => s + parseFloat(i.precio) * i.qty, 0);
const moAmort = w => [por(w, MOD), por(w, MOT)];
const sinDesc = w => moAmort(w).every(i => !i.descAuto && (parseFloat(i.descuento) || 0) === 0);

(async () => { try {
  // ═══ A. Exactamente 2 delanteros + 2 traseros → 5% ═══
  console.log('\n— A. 2 delanteros + 2 traseros → 5% en la mano de obra de los amortiguadores');
  let w = await suspension(); ponerDatos(w);
  ok('A0 las tarifas de prueba son las reales del Sheet ($600 / $450)', por(w, MOD).precioSugerido === 600 && por(w, MOT).precioSugerido === 450, [por(w, MOD).precioSugerido, por(w, MOT).precioSugerido]);
  qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, 2); qty(w, AT, 1);
  ok('A1 con 2 delanteros y 1 trasero NO hay descuento', sinDesc(w) && por(w, MOD).precio === 600 && por(w, MOT).precio === 450, moAmort(w).map(i => [i.descuento, i.precio]));
  qty(w, AT, 2);
  ok('A2 al completar 2+2 la mano de obra delantera lleva 5% (precio $570)', por(w, MOD).descuento === 5 && por(w, MOD).descAuto === true && por(w, MOD).precio === 570, por(w, MOD));
  ok('A3 la mano de obra trasera lleva 5% (precio $427.50)', por(w, MOT).descuento === 5 && por(w, MOT).descAuto === true && por(w, MOT).precio === 427.5, por(w, MOT));
  ok('A4 la mano de obra total queda en $1,995 (2×570 + 2×427.50) en lugar de $2,100', Math.abs(por(w, MOD).precio * 2 + por(w, MOT).precio * 2 - 1995) < 0.001);
  ok('A5 el total de la cotización: piezas $2×1000 + 2×800 = $3,600 + MO $1,995 = $5,595', Math.abs(total(w) - 5595) < 0.001, total(w));
  const inp = w.document.querySelector('#taller-items input[data-f="descuento"][data-id="' + por(w, MOD).id + '"]');
  ok('A6 el campo "Desc %" de la mano de obra delantera muestra 5', !!inp && inp.value === '5', inp && inp.value);
  ok('A7 el renglón explica que es automático y que si escribes otro Desc % se respeta', /5% de descuento automático[\s\S]*se respeta el tuyo/.test(w.document.getElementById('taller-items').textContent));
  ok('A8 la mano de obra de horquilla, barra, rótula y base NO lleva descuento', [MOH, MOB, MOR].every(c => !por(w, c).descAuto && (parseFloat(por(w, c).descuento) || 0) === 0)
    && !w.tallerItems.some(i => /base de amortiguador/i.test(i.concepto) && i.descAuto));
  ok('A9 las piezas (amortiguadores) NO llevan descuento', !por(w, AD).descAuto && !por(w, AT).descAuto && por(w, AD).precio === 1000 && por(w, AT).precio === 800);

  // ═══ B. Otras cantidades: sin descuento ═══
  console.log('\n— B. Cualquier otra combinación NO lleva descuento');
  const casos = [[2, 0, '2 + 0'], [0, 2, '0 + 2'], [1, 2, '1 + 2'], [2, 1, '2 + 1'], [3, 2, '3 + 2'], [2, 3, '2 + 3'], [4, 4, '4 + 4'], [1, 1, '1 + 1'], [0, 0, '0 + 0']];
  for (const [d, t, etq] of casos) {
    w = await suspension(); qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, d); qty(w, AT, t);
    ok('B ' + etq + ' → sin descuento y MO a tarifa completa', sinDesc(w) && por(w, MOD).precio === 600 && por(w, MOT).precio === 450, moAmort(w).map(i => [i.descuento, i.precio]));
  }
  w = await suspension(); qty(w, AD, 2); qty(w, AT, 2); qty(w, MOD, 2); qty(w, MOT, 2);
  ok('B10 el orden en que se captura no importa (piezas primero, mano de obra después → 5%)', por(w, MOD).precio === 570 && por(w, MOT).precio === 427.5);

  // ═══ C. Piezas opcionales y pendientes ═══
  console.log('\n— C. Opcionales no cuentan; piezas con precio pendiente sí');
  w = await suspension(); qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, 2); qty(w, AT, 2);
  ok('C0 base: 2+2 con descuento', por(w, MOD).descAuto === true);
  por(w, AT).opcional = true; w.updTallerField(por(w, AT).id, 'qty', '2');
  ok('C1 si las traseras se marcan como opcionales NO cuentan → se quita el descuento', sinDesc(w) && por(w, MOD).precio === 600 && por(w, MOT).precio === 450, moAmort(w).map(i => [i.descuento, i.precio]));
  por(w, AT).opcional = false; w.updTallerField(por(w, AT).id, 'qty', '2');
  ok('C2 al volver a incluirlas → vuelve el descuento', por(w, MOD).descAuto === true && por(w, MOT).precio === 427.5);
  w = await suspension(); w.tallerItems.forEach(i => { if (i.concepto === AD || i.concepto === AT) { i.precio = ''; i.pend = true; } });
  qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, 2); qty(w, AT, 2);
  ok('C3 piezas con precio todavía pendiente pero con cantidad 2+2 → el descuento ya aplica', por(w, MOD).descAuto === true && por(w, MOD).precio === 570);

  // ═══ D. Quitar o cambiar amortiguadores actualiza el descuento ═══
  console.log('\n— D. Al dejar de cumplirse 2+2 el descuento se quita solo');
  w = await suspension(); qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, 2); qty(w, AT, 2);
  qty(w, AT, 1);
  ok('D1 se baja un trasero → el descuento se quita y vuelve la tarifa completa ($600 / $450)', sinDesc(w) && por(w, MOD).precio === 600 && por(w, MOT).precio === 450, moAmort(w).map(i => [i.descuento, i.precio, i.descAuto]));
  qty(w, AT, 2);
  ok('D2 se vuelve a 2 traseros → vuelve el descuento', por(w, MOD).descAuto === true && por(w, MOD).precio === 570);
  qty(w, AD, 3);
  ok('D3 se sube a 3 delanteros → se quita', sinDesc(w) && por(w, MOD).precio === 600);
  qty(w, AD, 2);
  w.removeTallerItem(por(w, AT).id);
  ok('D4 se borra el renglón de traseras con la X → sin descuento', sinDesc(w) && por(w, MOD).precio === 600 && por(w, MOT).precio === 450);
  ok('D5 al quitar el descuento el campo Desc % queda vacío (0)', (parseFloat(por(w, MOD).descuento) || 0) === 0);

  // ═══ E. La asesora escribe su propio Desc % ═══
  console.log('\n— E. Si la asesora escribe su propio Desc %, se respeta el suyo');
  w = await suspension(); qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, 2); qty(w, AT, 2);
  w.updTallerField(por(w, MOD).id, 'descuento', '10');
  ok('E1 cambia a 10% a mano en la delantera → queda 10% ($540), no vuelve a 5%', por(w, MOD).descuento === 10 && por(w, MOD).precio === 540 && !por(w, MOD).descAuto && por(w, MOD).descManual === true, por(w, MOD));
  ok('E2 la trasera sigue con su 5% automático', por(w, MOT).descAuto === true && por(w, MOT).precio === 427.5);
  qty(w, MOD, 3); qty(w, AD, 2);
  ok('E3 aunque cambie otra cantidad, el 10% de la asesora se conserva', por(w, MOD).descuento === 10 && por(w, MOD).precio === 540, por(w, MOD));
  w.updTallerField(por(w, MOT).id, 'descuento', '0');
  ok('E4 si borra el Desc % de la trasera (0) NO le vuelve a poner 5%: se respeta el 0', (parseFloat(por(w, MOT).descuento) || 0) === 0 && por(w, MOT).precio === 450 && por(w, MOT).descManual === true, por(w, MOT));
  qty(w, AT, 1);
  ok('E5 al dejar de cumplirse 2+2 se libera la marca manual (sin descuento nuevo)', por(w, MOT).descManual === false && por(w, MOT).precio === 450);
  qty(w, AT, 2);
  ok('E6 al volver a 2+2 la trasera vuelve a tener el 5% automático', por(w, MOT).descAuto === true && por(w, MOT).precio === 427.5);
  w = await suspension(); qty(w, MOD, 2); qty(w, MOT, 2);
  w.updTallerField(por(w, MOD).id, 'descuento', '8');
  qty(w, AD, 2); qty(w, AT, 2);
  ok('E7 un Desc % escrito ANTES de llegar a 2+2 también se respeta (queda 8%, no se pisa con 5%)', por(w, MOD).descuento === 8 && por(w, MOD).precio === 552 && !por(w, MOD).descAuto, por(w, MOD));
  ok('E8 en ese caso la leyenda solo sale si queda alguna mano de obra con el 5% automático (trasera sí)', /5% de descuento en la instalación/.test(texto(w)));

  // ═══ F. WhatsApp ═══
  console.log('\n— F. WhatsApp: leyenda visible solo cuando aplica');
  w = await suspension(); ponerDatos(w); qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, 2); qty(w, AT, 1);
  let wa = texto(w);
  ok('F0 sin 2+2 el mensaje NO trae leyenda de descuento', !/descuento en la instalaci/i.test(wa), wa.slice(0, 600));
  qty(w, AT, 2); wa = texto(w);
  ok('F1 con 2+2 el mensaje trae la leyenda del 5% en la instalación', /5% de descuento en la instalación\* por cambiar tus 4 amortiguadores/.test(wa), wa.slice(0, 900));
  ok('F2 el mensaje muestra la mano de obra delantera ya rebajada ($570.00 c/u = $1,140.00)', /Mano de obra amortiguador delantero x2 - \$570\.00 c\/u = \$1,140\.00/.test(wa), wa.slice(0, 900));
  ok('F3 el mensaje muestra la mano de obra trasera ya rebajada ($427.50 c/u = $855.00)', /Mano de obra amortiguador trasero x2 - \$427\.50 c\/u = \$855\.00/.test(wa));
  ok('F4 el subtotal de Suspensión es $5,595.00', /Subtotal Suspensión: \$5,595\.00/.test(wa), wa.slice(0, 1200));
  ok('F5 la leyenda va dentro de Suspensión, antes del subtotal', wa.indexOf('5% de descuento en la instalación') > wa.indexOf('Mano de obra amortiguador trasero') && wa.indexOf('5% de descuento en la instalación') < wa.indexOf('Subtotal Suspensión'));
  ok('F6 el mensaje no nombra al proveedor', !/autozone|malpa|frenalex|perea|duralast|grc/i.test(wa));
  ok('F7 la leyenda aparece una sola vez', (wa.match(/5% de descuento en la instalación/g) || []).length === 1);

  // ═══ G. PDF ═══
  console.log('\n— G. PDF: leyenda visible solo cuando aplica');
  {
    const t1 = []; simularPDF(w, t1); let exc = '';
    try { w.generarPDF(); } catch (e) { exc = e.stack; }
    await wait(500);
    const pdf = t1.join('\n');
    ok('G0 el PDF no lanzó excepciones', exc === '', exc.slice(0, 300));
    ok('G1 el PDF trae la leyenda del 5% en instalación por el cambio de 4 amortiguadores', /5% de descuento en instalación por el cambio de 4 amortiguadores/.test(pdf), pdf.slice(0, 400));
    ok('G2 el PDF lista la mano de obra con el precio ya rebajado ($570.00)', /\$570\.00/.test(pdf));
    ok('G3 el PDF no muestra el proveedor', !/autozone|malpa|frenalex|perea|duralast|grc/i.test(pdf));
    const w2 = await suspension(); ponerDatos(w2); qty(w2, MOD, 2); qty(w2, MOT, 2); qty(w2, AD, 2); qty(w2, AT, 1);
    const t2 = []; simularPDF(w2, t2); try { w2.generarPDF(); } catch (e) { exc = e.stack; }
    await wait(500);
    ok('G4 sin 2+2 el PDF NO trae leyenda', !/descuento en instalaci/i.test(t2.join('\n')));
  }

  // ═══ H. Lo que va al Sheet ═══
  console.log('\n— H. Sheet: se guarda el precio ya rebajado');
  {
    const dat = w.armarDatosCotizacion([], [], [], w.tallerItems.filter(w.tallerLineaOk));
    const fD = dat.items.find(x => x.producto === MOD), fT = dat.items.find(x => x.producto === MOT);
    ok('H1 mano de obra delantera: precio 570.00, cant 2, subtotal 1140.00', !!fD && fD.precio === '570.00' && fD.cant === 2 && fD.subtotal === '1140.00', fD);
    ok('H2 mano de obra trasera: precio 427.50, cant 2, subtotal 855.00', !!fT && fT.precio === '427.50' && fT.cant === 2 && fT.subtotal === '855.00', fT);
    ok('H3 el total que va al Sheet es $5,595.00', dat.total === '5595.00', dat.total);
  }

  // ═══ I. Sin tarifa no hay descuento fantasma ═══
  console.log('\n— I. Sin tarifa en el Sheet no se inventa descuento ni leyenda');
  w = await suspension({}); ponerDatos(w);
  w.tallerItems.filter(i => i.mo).forEach(i => { i.precio = i.concepto === MOD ? 600 : (i.concepto === MOT ? 450 : i.precio); });
  qty(w, MOD, 2); qty(w, MOT, 2); qty(w, AD, 2); qty(w, AT, 2);
  ok('I1 si la mano de obra no tiene tarifa base, no se aplica el 5% (igual que un Desc % manual)', sinDesc(w) && por(w, MOD).precio === 600, moAmort(w).map(i => [i.descuento, i.precio]));
  ok('I2 y el mensaje NO promete un descuento que no se aplicó', !/descuento en la instalaci/i.test(texto(w)));

  // ═══ J. Otros servicios no se tocan ═══
  console.log('\n— J. Frenos, Afinación y otras cotizaciones no cambian');
  w = abrir(); await wait(250);
  w.tarifasMO = Object.assign({}, TARIFAS, { 'Mano de obra balatas delanteras': 400, 'Mano de obra balatas / zapatas traseras': 400 });
  w.setTallerSvc('frenos', null); w.setTallerSvc('afinacion', null);
  const moFrenos = w.tallerItems.filter(i => i.mo);
  ok('J1 la mano de obra de Frenos y Afinación no trae descuento automático', moFrenos.length > 0 && moFrenos.every(i => !i.descAuto && (parseFloat(i.descuento) || 0) === 0));
  ok('J2 la regla no reconoce conceptos de otros servicios', !w.suspEsMOAmort({ tipo: 'frenos', mo: true, concepto: MOD }) && !w.suspEsParteAmort({ tipo: 'frenos', mo: false, concepto: AD }));
  ok('J3 "Mano de obra base de amortiguador" no cuenta como mano de obra de amortiguador', !w.suspEsMOAmort({ tipo: 'suspension', mo: true, concepto: 'Mano de obra base de amortiguador' }));
  ok('J4 el porcentaje es fijo en 5', w.SUSP_DESC_PCT === 5);
  w = await suspension(); ponerDatos(w); qty(w, MOH, 1); pieza(w, 'Horquilla', 900); qty(w, 'Horquilla', 1);
  ok('J5 una cotización de Suspensión sin amortiguadores se calcula como siempre (horquilla $700)', por(w, MOH).precio === 700 && !/descuento en la instalaci/i.test(texto(w)));

  console.log('\n══════════════════════════════════════');
  console.log('Resultado: ' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
} catch (e) { console.log('ERROR:', e && e.stack || e); process.exit(1); } })();
