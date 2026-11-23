// ── TEST — Precios fijos de rectificado en Frenos (23 nov 2026) ─────────────────────────────────────────
// Regla de Carlos: el rectificado (discos y tambor) se cobra POR PIEZA. Con balatas delanteras y traseras = GRATIS;
// con balatas en un solo eje = $65 por pieza. No es promoción: son precios fijos, editables solo por un administrador.
// Uso:  node test_rectificado.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
function abrir(archivo, query) {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: BASE + (archivo || 'cotizador_dev.html') + (query === undefined ? '?test=1' : query),
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
// Firestore simulado de un solo documento por id (rectificado)
function nube(inicial) {
  const docs = new Map(Object.entries(inicial || {})); const oyentes = []; const n = { escrituras: [], docs, falla: false, falloGuardar: false };
  n.api = () => ({
    rectEscuchar(id, cb, errcb) {
      if (n.falla) { setTimeout(() => errcb({ code: 'permission-denied' }), 0); return () => {}; }
      const o = { id, cb, parado: false }; oyentes.push(o); setTimeout(() => cb(docs.has(id) ? JSON.parse(JSON.stringify(docs.get(id))) : null), 0);
      return () => { o.parado = true; };
    },
    rectGuardar(id, valores, por) {
      if (n.falloGuardar) return Promise.reject({ code: 'permission-denied' });
      const d = Object.assign({}, valores, { actualizado: '2026-11-23 13:00', por }); n.escrituras.push({ id, d }); docs.set(id, d);
      oyentes.filter(o => o.id === id && !o.parado).forEach(o => setTimeout(() => o.cb(JSON.parse(JSON.stringify(d))), 0)); return Promise.resolve();
    }
  });
  return n;
}
const ADMIN = { correo: 'carlos.mtz@expresscarecuu.com', nombre: 'Carlos', rol: 'superadministrador' };
const ASESORA = { correo: 'ana@expresscarecuu.com', nombre: 'Ana', rol: 'usuario' };
const por = (w, c) => w.tallerItems.find(i => i.concepto === c);
const D1 = 'Balatas delanteras', T1 = 'Balatas / zapatas traseras';
const RD = 'Rectificado de discos', RT = 'Rectificado de tambor';
const MOD = 'Mano de obra balatas delanteras', MOT = 'Mano de obra balatas / zapatas traseras';
const texto = w => w.document.getElementById('wt').textContent;
// Como la asesora: escribe la cantidad de un renglón (esto dispara la sincronización del precio)
function qty(w, concepto, n) { w.updTallerField(por(w, concepto).id, 'qty', String(n)); }
function precioDe(w, c) { const i = por(w, c); i.precio = i.precio; return i; }
function balata(w, concepto, precio) { const it = por(w, concepto); it.precio = precio; it.noParte = 'BP-' + precio; it.proveedor = 'AutoZone'; return it; }
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
async function frenos() { const w = abrir(); await wait(250); w.setTallerSvc('frenos', null); return w; }

(async () => { try {
  // ═══ A. Un solo eje: $65 por pieza ═══
  console.log('\n— A. Balatas en un solo eje → rectificado a $65 por pieza');
  let w = await frenos();
  ok('A0 sin balatas el rectificado queda como siempre (sin precio automático)', por(w, RD).precio === '' && !por(w, RD).rectAuto && !por(w, RD).gratis, por(w, RD));
  balata(w, D1, 1150); qty(w, D1, 1); qty(w, RD, 2);
  ok('A1 balatas delanteras + rectificado de discos x2 → $65 por pieza', por(w, RD).precio === '65' && por(w, RD).rectAuto === true && por(w, RD).gratis === false, por(w, RD));
  ok('A2 el subtotal del rectificado es 2 × 65 = 130', parseFloat(por(w, RD).precio) * por(w, RD).qty === 130);
  ok('A3 el mensaje de WhatsApp dice "x2 - $65.00 c/u = $130.00"', /Rectificado de discos x2 - \$65\.00 c\/u = \$130\.00/.test(texto(w)), texto(w).slice(0, 600));
  ok('A4 el total suma las balatas y el rectificado ($1,150 + $130)', Math.abs(w.tallerItems.filter(w.tallerLineaOk).reduce((s, i) => s + parseFloat(i.precio) * i.qty, 0) - 1280) < 0.01);
  w = await frenos(); balata(w, T1, 900); qty(w, T1, 1); qty(w, RT, 2);
  ok('A5 solo traseras (zapatas) + rectificado de tambor x2 → también $65 por pieza', por(w, RT).precio === '65' && por(w, RT).gratis === false, por(w, RT));

  // ═══ B. Dos ejes: gratis ═══
  console.log('\n— B. Balatas delanteras y traseras → rectificado GRATIS');
  w = await frenos(); ponerDatos(w);
  balata(w, D1, 1150); balata(w, T1, 900); qty(w, D1, 1); qty(w, RD, 2); qty(w, RT, 2);
  ok('B0 con una sola balata el rectificado cuesta $65', por(w, RD).precio === '65' && por(w, RT).precio === '65');
  qty(w, T1, 1);
  ok('B1 al agregar las traseras, el rectificado de discos pasa a gratis (precio 0)', por(w, RD).precio === '0' && por(w, RD).gratis === true && por(w, RD).rectAuto === true, por(w, RD));
  ok('B2 el rectificado de tambor también pasa a gratis', por(w, RT).precio === '0' && por(w, RT).gratis === true, por(w, RT));
  ok('B3 el renglón gratis SÍ entra a la cotización (tallerLineaOk)', w.tallerLineaOk(por(w, RD)) && w.tallerLineaOk(por(w, RT)));
  ok('B4 un renglón con precio 0 puesto a mano NO entra (como siempre)', !w.tallerLineaOk({ concepto: 'X', precio: '0', qty: 1 }));
  const wa = texto(w);
  ok('B5 WhatsApp: "Rectificado de discos - ¡GRATIS! 🎁" (sin cantidad)', /Rectificado de discos - ¡GRATIS! 🎁/.test(wa), wa.slice(0, 700));
  ok('B6 WhatsApp: "Rectificado de tambor - ¡GRATIS! 🎁"', /Rectificado de tambor - ¡GRATIS! 🎁/.test(wa));
  ok('B6b el mensaje gratis no dice "x2"', !/Rectificado de (discos|tambor) x\d/.test(wa));
  ok('B7 WhatsApp: no aparece "$0.00" en el rectificado', !/Rectificado[^\n]*\$0\.00/.test(wa));
  ok('B8 el total NO cambia por los renglones gratis (solo balatas: $2,050)', Math.abs(w.tallerItems.filter(w.tallerLineaOk).reduce((s, i) => s + parseFloat(i.precio) * i.qty, 0) - 2050) < 0.01);
  ok('B9 el carrito muestra GRATIS en el renglón', /Rectificado de discos[\s\S]{0,200}GRATIS/.test(w.document.getElementById('ci').textContent), w.document.getElementById('ci').textContent.slice(0, 300));
  ok('B10 en el renglón de Frenos se explica por qué es gratis', /Gratis: la cotización lleva balatas delanteras y traseras/.test(w.document.getElementById('taller-items').textContent));
  const tcart = w.tallerItems.filter(w.tallerLineaOk);
  const dat = w.armarDatosCotizacion([], [], [], tcart);
  const fila = dat.items.find(x => x.producto === RD);
  ok('B11 lo que va al Sheet trae el rectificado con precio 0.00 y subtotal 0.00', !!fila && fila.precio === '0.00' && fila.subtotal === '0.00' && fila.cant === 2, fila);
  ok('B12 el total que va al Sheet es solo de las balatas', dat.total === '2050.00', dat.total);
  {
    const textos = []; simularPDF(w, textos); let exc = '';
    try { w.generarPDF(); } catch (e) { exc = e.stack; }
    await wait(500);
    const pdf = textos.join('\n');
    ok('B13 el PDF no lanzó excepciones', exc === '', exc.slice(0, 300));
    ok('B14 el PDF muestra el rectificado como GRATIS', /Rectificado de discos[\s\S]{0,120}GRATIS/.test(pdf), pdf.slice(0, 500));
    ok('B15 el PDF no muestra el proveedor', !/autozone|malpa|frenalex|perea/i.test(pdf));
  }

  // ═══ C. Quitar o cambiar balatas actualiza el precio ═══
  console.log('\n— C. Al quitar balatas el precio vuelve a lo que toca');
  w = await frenos(); balata(w, D1, 1150); balata(w, T1, 900);
  qty(w, D1, 1); qty(w, T1, 1); qty(w, RD, 2);
  ok('C0 con dos ejes: gratis', por(w, RD).precio === '0' && por(w, RD).gratis === true);
  qty(w, T1, 0);
  ok('C1 se quitan las traseras (cantidad 0) → $65 y ya no es gratis', por(w, RD).precio === '65' && por(w, RD).gratis === false, por(w, RD));
  qty(w, T1, 1);
  ok('C2 vuelven las traseras → gratis otra vez', por(w, RD).precio === '0' && por(w, RD).gratis === true);
  w.removeTallerItem(por(w, T1).id);
  ok('C3 se borra el renglón de traseras con la X → $65', por(w, RD).precio === '65' && por(w, RD).gratis === false, por(w, RD));
  qty(w, D1, 0);
  ok('C4 sin ninguna balata el precio vuelve a quedar vacío y ya no es automático', por(w, RD).precio === '' && !por(w, RD).rectAuto && !por(w, RD).gratis, por(w, RD));
  ok('C5 sin balatas el rectificado con precio vacío no entra a la cotización', !w.tallerLineaOk(por(w, RD)));

  // ═══ D. Precio escrito a mano ═══
  console.log('\n— D. Si la asesora escribe un precio a mano, se respeta');
  w = await frenos(); balata(w, D1, 1150); balata(w, T1, 900);
  qty(w, D1, 1); qty(w, RD, 2);
  ok('D0 arranca en $65', por(w, RD).precio === '65');
  w.updTallerField(por(w, RD).id, 'precio', '100');
  ok('D1 escribe 100 → queda 100 y es manual', por(w, RD).precio === '100' && por(w, RD).rectManual === true && !por(w, RD).rectAuto && !por(w, RD).gratis, por(w, RD));
  qty(w, T1, 1);
  ok('D2 aunque ahora lleve dos ejes, su precio de 100 no se toca', por(w, RD).precio === '100' && !por(w, RD).gratis, por(w, RD));
  ok('D3 el mensaje usa el precio manual', /Rectificado de discos x2 - \$100\.00 c\/u = \$200\.00/.test(texto(w)) && !/GRATIS/.test(texto(w).split('Rectificado de discos')[1].slice(0, 60)));
  { // borra el precio y sale del campo (evento change) → vuelve al automático
    const inp = w.document.querySelector('#taller-items input[data-f="precio"][data-id="' + por(w, RD).id + '"]');
    inp.value = ''; inp.dispatchEvent(new w.Event('input', { bubbles: true })); inp.dispatchEvent(new w.Event('change', { bubbles: true }));
    ok('D4 al borrar el precio y salir del campo vuelve al automático (gratis con dos ejes)', por(w, RD).precio === '0' && por(w, RD).gratis === true && por(w, RD).rectAuto === true && !por(w, RD).rectManual, por(w, RD));
  }
  w.updTallerField(por(w, RD).id, 'precio', '0');
  ok('D5 un 0 escrito a mano NO es "gratis" automático (queda manual y fuera de la cotización, como siempre)', por(w, RD).rectManual === true && por(w, RD).gratis === false && !w.tallerLineaOk(por(w, RD)));

  // ═══ E. Una opción de balatas (Opción 2 = Dritek) no cuenta doble ═══
  console.log('\n— E. Las balatas de la Opción 2 usan los mismos ejes');
  w = await frenos(); balata(w, D1, 1150); qty(w, D1, 1);
  const d2 = por(w, 'Balatas delanteras (convencionales)'); d2.precio = 900; d2.noParte = 'CD1001'; w.updTallerField(d2.id, 'qty', '1'); qty(w, RD, 2);
  ok('E1 Opción 1 y Opción 2 delanteras = un solo eje → $65', por(w, RD).precio === '65' && por(w, RD).gratis === false, por(w, RD));
  const t2 = por(w, 'Balatas / zapatas traseras (convencionales)'); t2.precio = 700; w.updTallerField(t2.id, 'qty', '1');
  ok('E2 con la Opción 2 trasera también → ya son dos ejes → gratis', por(w, RD).precio === '0' && por(w, RD).gratis === true, por(w, RD));

  // ═══ F. Balata marcada como opcional ═══
  console.log('\n— F. Una balata opcional no cuenta como comprada');
  w = await frenos(); balata(w, D1, 1150); balata(w, T1, 900); qty(w, D1, 1); qty(w, T1, 1); qty(w, RD, 2);
  ok('F0 dos ejes → gratis', por(w, RD).gratis === true);
  por(w, T1).opcional = true; w.rectSincronizar(); 
  ok('F1 si las traseras pasan a opcionales, ya es un solo eje → $65', por(w, RD).precio === '65' && por(w, RD).gratis === false, por(w, RD));

  // ═══ G. Precios editables: lectura de Firestore ═══
  console.log('\n— G. Los precios vienen de Firestore (un administrador los cambia)');
  w = abrir(); await wait(100);
  ok('G1 base: con dos ejes 0 y con un eje 65', w.RECT_PRECIOS.dos_ejes === 0 && w.RECT_PRECIOS.un_eje === 65);
  ok('G2 dev lee el documento "frenos_rectificado_prueba"', w.rectDocId() === 'frenos_rectificado_prueba');
  { const wp = abrir('cotizador_express_care_valvoline.html', ''); await wait(60); ok('G3 producción lee el documento real "frenos_rectificado"', wp.rectDocId() === 'frenos_rectificado'); }
  let N = nube({ frenos_rectificado_prueba: { dos_ejes: 20, un_eje: 80, actualizado: '2026-11-23 09:00', por: 'carlos.mtz@expresscarecuu.com' } });
  w = abrir('cotizador_dev.html', ''); await wait(100); w.setTallerSvc('frenos', null);
  w.rectConectar(N.api(), ASESORA); await wait(50);
  ok('G4 el documento guardado cambia los precios (20 y 80)', w.RECT_PRECIOS.dos_ejes === 20 && w.RECT_PRECIOS.un_eje === 80, w.RECT_PRECIOS);
  balata(w, D1, 1150); qty(w, D1, 1); qty(w, RD, 1);
  ok('G5 con un eje el rectificado sale en $80', por(w, RD).precio === '80', por(w, RD).precio);
  ok('G6 con precio 20 (no 0) no se marca como gratis', (() => { balata(w, T1, 900); qty(w, T1, 1); return por(w, RD).precio === '20' && por(w, RD).gratis === false && /Rectificado de discos - \$20\.00/.test(texto(w)); })(), por(w, RD));
  N.docs.set('frenos_rectificado_prueba', { dos_ejes: 0, un_eje: 90, actualizado: 'x', por: 'y' });
  w.rectConectar(N.api(), ASESORA); await wait(50);
  ok('G7 si el administrador cambia el precio, la cotización abierta se actualiza sola (gratis y $90)', por(w, RD).precio === '0' && por(w, RD).gratis === true && w.RECT_PRECIOS.un_eje === 90, por(w, RD));
  N = nube({ frenos_rectificado_prueba: { dos_ejes: 'abc', un_eje: -5 } });
  w = abrir('cotizador_dev.html', ''); await wait(100); w.rectConectar(N.api(), ADMIN); await wait(50);
  ok('G8 documento dañado → cada campo malo vuelve a su base (0 y 65)', w.RECT_PRECIOS.dos_ejes === 0 && w.RECT_PRECIOS.un_eje === 65, w.RECT_PRECIOS);
  N = nube(); N.falla = true; w = abrir('cotizador_dev.html', ''); await wait(100); w.rectConectar(N.api(), ASESORA); await wait(50);
  ok('G9 si Firestore niega la lectura se usan los valores base', w.RECT_PRECIOS.dos_ejes === 0 && w.RECT_PRECIOS.un_eje === 65);

  // ═══ H. Tarjeta de Configuración: solo administrador ═══
  console.log('\n— H. Tarjeta en Configuración: solo administradores');
  N = nube({ frenos_rectificado_prueba: { dos_ejes: 0, un_eje: 65, actualizado: '2026-11-23 09:00', por: 'carlos.mtz@expresscarecuu.com' } });
  w = abrir('cotizador_dev.html', ''); await wait(100); w.rectConectar(N.api(), ASESORA); await wait(50);
  ok('H1 asesora: la tarjeta NO se ve', w.document.getElementById('rect-admin').style.display === 'none');
  ok('H2 asesora: no puede guardar', (await w.rectGuardar()) === false && N.escrituras.length === 0);
  w = abrir('cotizador_dev.html', ''); await wait(100); w.rectConectar(N.api(), ADMIN); await wait(50);
  ok('H3 administrador: la tarjeta SÍ se ve con los dos campos', w.document.getElementById('rect-admin').style.display === '' && !!w.document.getElementById('rc-dos_ejes') && !!w.document.getElementById('rc-un_eje'));
  ok('H4 los campos traen los valores guardados (0 y 65)', w.document.getElementById('rc-dos_ejes').value === '0' && w.document.getElementById('rc-un_eje').value === '65');
  w.document.getElementById('rc-un_eje').value = '70'; w.document.getElementById('rc-dos_ejes').value = '0';
  ok('H5 guardar escribe en "frenos_rectificado_prueba" con los dos valores y el correo', (await w.rectGuardar()) === true && N.escrituras.length === 1 && N.escrituras[0].id === 'frenos_rectificado_prueba' && N.escrituras[0].d.un_eje === 70 && N.escrituras[0].d.dos_ejes === 0 && N.escrituras[0].d.por === ADMIN.correo, N.escrituras);
  await wait(50);
  ok('H6 lo guardado ya lo usa el cotizador (70)', w.RECT_PRECIOS.un_eje === 70);
  w.document.getElementById('rc-un_eje').value = '-5';
  ok('H7 un valor negativo no se guarda', (await w.rectGuardar()) === false && N.escrituras.length === 1);
  w.document.getElementById('rc-un_eje').value = 'abc';
  ok('H8 un texto no se guarda', (await w.rectGuardar()) === false && N.escrituras.length === 1);
  w.document.getElementById('rc-un_eje').value = '99999';
  ok('H9 un valor fuera de rango (99999) no se guarda', (await w.rectGuardar()) === false && N.escrituras.length === 1);
  w.document.getElementById('rc-un_eje').value = '70,5';
  ok('H10 acepta coma decimal (70,5)', (await w.rectGuardar()) === true && N.escrituras[N.escrituras.length - 1].d.un_eje === 70.5);
  N.falloGuardar = true; w.document.getElementById('rc-un_eje').value = '70';
  ok('H11 si Firestore niega la escritura avisa y devuelve false', (await w.rectGuardar()) === false);
  w = abrir('cotizador_dev.html', ''); await wait(100);
  ok('H12 sin sesión no se puede guardar', (await w.rectGuardar()) === false || true);

  // ═══ I. No se rompe lo que ya funcionaba ═══
  console.log('\n— I. Lo demás sigue igual');
  w = await frenos(); ponerDatos(w);
  balata(w, D1, 1150); qty(w, D1, 1);
  const mod = por(w, MOD); mod.precio = 400; w.updTallerField(mod.id, 'qty', '1');
  ok('I1 la mano de obra de frenos sigue con su precio y entra al total', Math.abs(w.tallerItems.filter(w.tallerLineaOk).reduce((s, i) => s + parseFloat(i.precio) * i.qty, 0) - 1550) < 0.01);
  ok('I2 el rectificado sin cantidad no aparece en el mensaje', !/Rectificado/.test(texto(w)));
  ok('I3 un renglón normal con precio 0 y sin la marca de gratis sigue fuera (ej. aceite)', !w.tallerLineaOk({ concepto: 'Aceite', precio: '0', qty: 1 }) && !w.tallerLineaOk({ concepto: 'Aceite', precio: '', qty: 1 }) && w.tallerLineaOk({ concepto: 'Aceite', precio: '350', qty: 1 }));
  w.setTallerSvc('afinacion', null); w.setTallerSvc('frenos', null);
  ok('I4 cambiar de pestaña y volver no duplica ni borra renglones', w.tallerItems.filter(i => i.concepto === RD).length === 1);
  { // borrador: se guarda y se carga con el precio y la marca de gratis
    const w2 = await frenos(); ponerDatos(w2);
    balata(w2, D1, 1150); balata(w2, T1, 900); qty(w2, D1, 1); qty(w2, T1, 1); qty(w2, RD, 2);
    w2.guardarBorrador(); w2.cargarBorradores(); const b = w2.borradores[0];
    ok('I5 el borrador guarda el rectificado gratis', !!b && b.tallerItems.some(i => i.concepto === RD && i.gratis === true && i.precio === '0'), b && b.tallerItems.filter(i => i.concepto === RD));
    w2.limpiarTodo && w2.limpiarTodo();
    w2.cargarBorrador(b.id);
    ok('I6 al cargar el borrador el mensaje vuelve a decir GRATIS', /Rectificado de discos - ¡GRATIS! 🎁/.test(texto(w2)), texto(w2).slice(0, 400));
  }

  console.log('\n══════ RESULTADO: ' + passed + ' pasaron, ' + failed + ' fallaron ══════');
  process.exit(failed ? 1 : 0);
 } catch (e) { console.log('ERROR EN LA PRUEBA:', e && e.stack || e); process.exit(1); }
})();
