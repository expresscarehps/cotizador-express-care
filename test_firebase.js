// ── TEST SUITE — Capa Firebase del cotizador (historial + respaldo) ─────────
// Archivo: test_firebase.js
// Uso:  node test_firebase.js [ruta_al_html]      (por defecto ./cotizador_dev.html)
// Parte A (sin dependencias): funciones puras de la capa Firebase.
// Parte B (integración): carga el HTML real en jsdom y prueba el flujo completo
//         Guardar / Generar PDF → respaldo en Firestore (simulado).
//         Requiere:  npm i jsdom   (si no está instalado, la Parte B se omite y se avisa).

const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g);

let passed = 0, failed = 0, skipped = 0;
// Avisos esperados de la capa (se prueban a propósito): no ensucian la salida
const _warn = console.warn;
console.warn = (...a) => { if (/Firebase no cargó|Respaldo Firebase falló/.test(String(a[0]))) return; _warn(...a); };
function ok(name, cond, extra) {
  if (cond) { console.log('  ✅ ' + name); passed++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; }
}

// ══════════════════════════════════════════════════════════
console.log('\n=== A0. ESTRUCTURA DEL HTML ===');
const bloque = scripts && scripts.find(s => s.includes('CAPA FIREBASE — bloque ADITIVO'));
ok('Existe el bloque de la capa Firebase', !!bloque);
ok('Hay 3 scripts en línea (datos, app, capa Firebase)', scripts && scripts.length === 3, scripts && scripts.length);
ok('Pestaña Historial en el HTML', html.includes('id="tab-historial"') && html.includes('id="p-historial"'));
ok('Botón de estado Firebase en el HTML', html.includes('id="fb-chip"'));
ok('Cuenta compartida correcta en la config', html.includes("'citas@expresscarecuu.com'"));
ok('Proyecto Firebase correcto', html.includes('projectId: "express-care-cotizador"'));
ok('No escribe en las colecciones del bot', !/catalogo_llantas|conversaciones_bot/.test(bloque || ''));
ok('Solo usa la colección cotizaciones', /var COL = 'cotizaciones'/.test(bloque || ''));

// ══════════════════════════════════════════════════════════
// Parte A: se evalúa el bloque con un entorno simulado mínimo
function cargarBloque(modoPrueba) {
  const toasts = [];
  global.window = { addEventListener: () => {}, location: { pathname: '/cotizador-express-care/cotizador_dev.html' } };
  global.document = { getElementById: () => null };
  global.toast = m => toasts.push(m);
  global.MODO_PRUEBA = !!modoPrueba;
  // Simula las funciones existentes que la capa envuelve
  global.__llamadas = { guardadoOk: 0 };
  global.armarDatosCotizacion = function () { return global.__datos; };
  global.guardarCotizacion = function (onOk, onErr) {
    if (global.__falla) { if (typeof onErr === 'function') onErr(); return; }
    global.armarDatosCotizacion();
    global.__llamadas.guardadoOk++;
    if (typeof onOk === 'function') onOk();
  };
  global.construirYDescargarPDF = function (folio) { global.__pdfFolio = folio; };
  const cuerpo = bloque.replace(/<\/?script>/g, '');
  (0, eval)(cuerpo);   // eval indirecto: queda en el ámbito global, como en el navegador
  return { fb: global.window.__fb, toasts };
}

const DATOS = {
  fecha: '6/10/2026 03:15 p.m.', asesor: ' Ana ', cliente: '  Jose   Alarcón ', telefono: '614-184 8835',
  vehiculo: 'Chevrolet Cheyenne 2007 8 cil', origen: 'WhatsApp', total: '2394.29',
  items: [
    { tipo: 'Llantas', proveedor: 'AYALA', noParte: 'AY27890', producto: '165/65 R14', cant: 4, costo: '2467.00', margen: '25%', precio: '2146.29', subtotal: '8585.16' },
    { tipo: 'Taller - Frenos', proveedor: '', noParte: '', producto: 'Mano de obra balatas', cant: 2, costo: '', margen: 'M.O.', precio: '550.00', subtotal: '1100.00' },
    { tipo: 'Taller - Frenos', proveedor: 'Autozone', noParte: 'C-1', producto: 'Filtro de cabina (opcional)', cant: 1, costo: '216.00', margen: '30%', precio: '308.57', subtotal: '(opcional)' },
    { tipo: 'Llantas', proveedor: '', noParte: '', producto: 'Montaje', cant: 0, costo: '', margen: '', precio: '120.00', subtotal: '120.00' }
  ]
};

console.log('\n=== A1. ARMADO DEL DOCUMENTO ===');
{
  const { fb } = cargarBloque(false);
  const d = fb.armarDocumento(DATOS, 'EXPCARE-007/26', new Date('2026-10-06T21:15:00Z'));
  ok('Fecha ISO en hora de Chihuahua', d.fecha === '2026-10-06T15:15:00-06:00', d.fecha);
  ok('Cliente sin espacios de más', d.cliente === 'Jose Alarcón', d.cliente);
  ok('clienteBusq sin acentos y minúsculas', d.clienteBusq === 'jose alarcon', d.clienteBusq);
  ok('Teléfono solo dígitos', d.telefono === '6141848835', d.telefono);
  ok('Asesor recortado', d.asesor === 'Ana');
  ok('Folio guardado', d.folio === 'EXPCARE-007/26');
  ok('Total numérico', d.total === 2394.29 && typeof d.total === 'number', d.total);
  ok('4 partidas', d.partidas.length === 4);
  const p0 = d.partidas[0], p1 = d.partidas[1], p2 = d.partidas[2], p3 = d.partidas[3];
  ok('Llanta: margenPct 25 numérico', p0.margenPct === 25 && p0.manoDeObra === false, p0);
  ok('Llanta: costo/precio/subtotal numéricos', p0.costo === 2467 && p0.precio === 2146.29 && p0.subtotal === 8585.16, p0);
  ok('M.O.: manoDeObra true y margenPct null', p1.manoDeObra === true && p1.margenPct === null && p1.costo === null, p1);
  ok('Opcional: opcional true y subtotal null', p2.opcional === true && p2.subtotal === null, p2);
  ok('Sin margen: margenPct null', p3.margenPct === null);
  ok('cant 0 se guarda como 1 (igual que el Sheet)', p3.cant === 1, p3.cant);
  ok('migrado false y fuente dev', d.migrado === false && d.fuente === 'dev', [d.migrado, d.fuente]);
  ok('Mismas llaves que los documentos migrados', ['fecha','asesor','cliente','clienteBusq','telefono','vehiculo','origen','estatus','folio','total','partidas','migrado'].every(k => k in d));
  ok('Partida con las mismas llaves que la migración', ['tipo','proveedor','noParte','producto','cant','costo','margenPct','manoDeObra','precio','subtotal','opcional'].every(k => k in p0));
  const d0 = fb.armarDocumento(Object.assign({}, DATOS, { telefono: '0' }), '', new Date());
  ok('Teléfono "0" queda vacío', d0.telefono === '');
  ok('Sin folio queda cadena vacía', d0.folio === '');
  ok('fechaISOChihuahua ordena como texto', fb.fechaISOChihuahua(new Date('2026-01-01T10:00:00Z')) < fb.fechaISOChihuahua(new Date('2026-10-06T10:00:00Z')));
  ok('nuevoId tiene formato web-AAAAMMDDhhmmss-xxxx', /^web-\d{14}-[a-z0-9]{1,4}$/.test(fb.nuevoId(new Date('2026-10-06T21:15:00Z'))), fb.nuevoId(new Date('2026-10-06T21:15:00Z')));
  ok('fechaLegible', fb.fechaLegible('2026-10-06T15:15:00-06:00') === '06/10/2026 15:15');
  ok('dinero', fb.dinero(1234.5) === '$1,234.50' && fb.dinero(null) === '—');
}

console.log('\n=== A2. BÚSQUEDA ===');
{
  const { fb } = cargarBloque(false);
  const L = [
    { cliente: 'Jose Alarcón', telefono: '6141848835', vehiculo: 'Chevrolet Cheyenne 2007', folio: '', asesor: 'Ana' },
    { cliente: 'ANA SOFIA', telefono: '6141404436', vehiculo: 'TOYOTA YARIS 2007', folio: '', asesor: 'Xen' },
    { cliente: '614 366 4406', telefono: '6143664406', vehiculo: 'Chevrolet Captiva 2012', folio: 'EXPCARE-005/26', asesor: 'Ana' },
    { cliente: 'Sanders Pools', telefono: '', vehiculo: 'Ford f350 2004', folio: '', asesor: 'Ana' }
  ];
  ok('Sin texto devuelve todo', fb.filtrar(L, '').length === 4);
  ok('Por nombre sin acento', fb.filtrar(L, 'jose alarcon').length === 1);
  ok('Por nombre con acento', fb.filtrar(L, 'Alarcón').length === 1);
  ok('Por mayúsculas distintas', fb.filtrar(L, 'ana sofia').length === 1);
  ok('Por apellido suelto', fb.filtrar(L, 'sofia').length === 1);
  ok('Por teléfono completo', fb.filtrar(L, '6141848835').length === 1);
  ok('Por teléfono parcial', fb.filtrar(L, '366 4406').length === 1);
  ok('Teléfono con guiones', fb.filtrar(L, '614-184-8835').length === 1);
  ok('Por folio', fb.filtrar(L, 'expcare-005').length === 1);
  ok('Por vehículo', fb.filtrar(L, 'yaris').length === 1);
  ok('Varias palabras (todas deben coincidir)', fb.filtrar(L, 'chevrolet 2012').length === 1);
  ok('Sin coincidencias', fb.filtrar(L, 'zzzz').length === 0);
  ok('Cliente sin teléfono se encuentra por nombre', fb.filtrar(L, 'sanders').length === 1);
}

console.log('\n=== A3. RESPALDO (con Firebase simulado) ===');
async function espera() { await new Promise(r => setTimeout(r, 5)); }
(async () => {
  // Sesión iniciada: Guardar respalda una vez, con folio vacío
  {
    const { fb, toasts } = cargarBloque(false);
    const escritos = [];
    fb._t.setEstado({ escribir: (id, d) => { escritos.push({ id, d }); return Promise.resolve(); } }, { uid: 'u1' });
    global.__datos = DATOS;
    let okLlamado = 0;
    global.guardarCotizacion(() => okLlamado++);
    await espera();
    ok('Guardar: llama al callback original', okLlamado === 1);
    ok('Guardar: respalda 1 documento en Firestore', escritos.length === 1, escritos.length);
    ok('Guardar: folio vacío', escritos[0] && escritos[0].d.folio === '');
    ok('Guardar: ID web-…', escritos[0] && /^web-/.test(escritos[0].id));
    ok('Guardar: avisa que respaldó', toasts.some(t => /Respaldada en Firebase/.test(t)), toasts);
    ok('Guardar: no queda nada pendiente', fb._t.getPend() === null);
    // Generar PDF con folio (datos frescos)
    global.armarDatosCotizacion();            // lo que hace generarPDF antes del PDF
    global.construirYDescargarPDF('EXPCARE-007/26');
    await espera();
    ok('PDF: delega en la función original con el folio', global.__pdfFolio === 'EXPCARE-007/26');
    ok('PDF: respalda 2º documento con el folio', escritos.length === 2 && escritos[1].d.folio === 'EXPCARE-007/26', escritos.length);
    ok('PDF: ID distinto al del Guardar', escritos[0].id !== escritos[1].id);
    // 2º PDF sin datos nuevos → no duplica
    global.construirYDescargarPDF('EXPCARE-007/26');
    await espera();
    ok('2º PDF sin cambios: NO duplica el respaldo', escritos.length === 2, escritos.length);
  }
  // Callback onOk que no es función (así lo manda addEventListener: recibe el evento)
  {
    const { fb } = cargarBloque(false);
    const escritos = [];
    fb._t.setEstado({ escribir: (id, d) => { escritos.push(d); return Promise.resolve(); } }, { uid: 'u1' });
    global.__datos = DATOS;
    let error = null;
    try { global.guardarCotizacion({ type: 'click' }); } catch (e) { error = e; }
    await espera();
    ok('Click directo (evento como 1er argumento) no truena y respalda', error === null && escritos.length === 1, String(error));
  }
  // Sin sesión
  {
    const { fb, toasts } = cargarBloque(false);
    global.__datos = DATOS;
    let ok1 = 0;
    global.guardarCotizacion(() => ok1++);
    await espera();
    ok('Sin sesión: el guardado normal sigue funcionando', ok1 === 1);
    ok('Sin sesión: avisa que inicie sesión', toasts.some(t => /inicia sesión/.test(t)), toasts);
  }
  // Modo prueba
  {
    const { fb, toasts } = cargarBloque(true);
    const escritos = [];
    fb._t.setEstado({ escribir: (id, d) => { escritos.push(d); return Promise.resolve(); } }, { uid: 'u1' });
    global.__datos = DATOS;
    global.guardarCotizacion(() => {});
    global.armarDatosCotizacion();
    global.construirYDescargarPDF('PRUEBA-1');
    await espera();
    ok('MODO_PRUEBA: NO escribe en Firestore', escritos.length === 0, escritos.length);
    ok('MODO_PRUEBA: avisa que es prueba', toasts.some(t => /PRUEBA/.test(t)), toasts);
  }
  // Firestore falla
  {
    const { fb, toasts } = cargarBloque(false);
    fb._t.setEstado({ escribir: () => Promise.reject({ code: 'permission-denied' }) }, { uid: 'u1' });
    global.__datos = DATOS;
    let ok1 = 0, error = null;
    try { global.guardarCotizacion(() => ok1++); } catch (e) { error = e; }
    await espera(); await espera();
    ok('Firestore falla: el guardado normal NO se rompe', error === null && ok1 === 1);
    ok('Firestore falla: avisa con el código', toasts.some(t => /No se pudo respaldar.*permission-denied/.test(t)), toasts);
  }
  // Guardado original falla: no deja datos pendientes
  {
    const { fb } = cargarBloque(false);
    fb._t.setEstado({ escribir: () => Promise.resolve() }, { uid: 'u1' });
    global.__datos = DATOS; global.__falla = true;
    let err = 0;
    global.guardarCotizacion(() => {}, () => err++);
    global.__falla = false;
    ok('Guardado falla: se llama el onErr original', err === 1);
    ok('Guardado falla: no deja pendientes', fb._t.getPend() === null);
  }
  // Errores de login legibles
  {
    const { fb } = cargarBloque(false);
    ok('Mensaje: contraseña incorrecta', /incorrecta/.test(fb.errorLegible({ code: 'auth/invalid-credential' })));
    ok('Mensaje: demasiados intentos', /intentos/.test(fb.errorLegible({ code: 'auth/too-many-requests' })));
  }

  await parteB();

  console.log('\n=============================================');
  console.log('TOTAL: ' + (passed + failed) + ' | ✅ ' + passed + ' OK | ❌ ' + failed + ' FALLIDAS' + (skipped ? ' | ⏭ ' + skipped + ' omitidas' : ''));
  process.exit(failed ? 1 : 0);
})();

// ══════════════════════════════════════════════════════════
// Parte B: integración con el HTML real en jsdom
async function parteB() {
  console.log('\n=== B. INTEGRACIÓN (HTML real en jsdom) ===');
  let JSDOM, VirtualConsole;
  try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
  catch (e) { console.log('  ⏭ jsdom no instalado (npm i jsdom) — Parte B omitida'); skipped++; return; }
  process.on('unhandledRejection', () => {});

  function abrir(query) {
    const fetchCalls = [];
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
      url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html' + (query || ''),
      beforeParse(w) {
        w.fetch = (u, o) => { fetchCalls.push({ u, body: o && o.body ? JSON.parse(o.body) : null }); return Promise.resolve({}); };
        w.alert = () => {}; w.confirm = () => true;
      }
    });
    return { w: dom.window, fetchCalls, dom };
  }
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  function llenarYGuardar(w, boton) {
    const set = (id, v) => { w.document.getElementById(id).value = v; };
    set('cli-nombre', 'Cliente de Prueba Integración'); set('cli-tel', '6140000000'); set('cli-origen', 'WhatsApp');
    set('asesor', 'Ana'); set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
    w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: '550', mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
    w.document.getElementById(boton).click();
  }
  function api(escritos) { return { escribir: (id, d) => { escritos.push({ id, d }); return Promise.resolve(); } }; }

  // B1: Firebase no carga (sin red) → la app sigue viva y avisa
  {
    const { w } = abrir('');
    await esperar(80);
    ok('B1 la página carga sin errores graves y existen las funciones', typeof w.guardarCotizacion === 'function' && !!w.__fb);
    const chip = w.document.getElementById('fb-chip');
    ok('B1 el botón de estado existe y muestra que Firebase no conectó', chip && /sin conexión/.test(chip.textContent), chip && chip.textContent);
    w.setTab('historial');
    ok('B1 la pestaña Historial se abre', w.document.getElementById('p-historial').classList.contains('on'));
    ok('B1 la pestaña Historial no rompe las demás', (w.setTab('cotizacion'), w.document.getElementById('p-cotizacion').classList.contains('on')));
  }
  // B2: Guardar con sesión → flujo original (Apps Script) intacto + respaldo en Firestore
  {
    const { w, fetchCalls } = abrir('');
    await esperar(80);
    const escritos = []; w.__fb._t.setEstado(api(escritos), { uid: 'u1' });
    llenarYGuardar(w, 'btn-guardar');
    await esperar(60);
    const sheet = fetchCalls.filter(c => c.body && c.body.action === 'saveCotizacion');
    ok('B2 el guardado al Sheet (Apps Script) sigue ocurriendo', sheet.length === 1, fetchCalls.length);
    ok('B2 el Sheet recibe el mismo cliente', sheet[0] && sheet[0].body.cliente === 'Cliente de Prueba Integración');
    ok('B2 se respalda 1 documento en Firestore', escritos.length === 1, escritos.length);
    const d = escritos[0] && escritos[0].d;
    ok('B2 documento: cliente, teléfono, vehículo, asesor', d && d.cliente === 'Cliente de Prueba Integración' && d.telefono === '6140000000' && /Nissan Sentra 2020/.test(d.vehiculo) && d.asesor === 'Ana', d);
    ok('B2 documento: partida de mano de obra', d && d.partidas.length === 1 && d.partidas[0].manoDeObra === true && d.partidas[0].cant === 2 && d.partidas[0].precio === 550 && d.partidas[0].subtotal === 1100, d && d.partidas);
    ok('B2 documento: total = 1100', d && d.total === 1100, d && d.total);
    ok('B2 el botón queda en "Cotización guardada"', /Cotización guardada/.test(w.document.getElementById('btn-guardar').textContent));
  }
  // B3: Generar PDF con folio → respaldo con folio
  {
    const { w, fetchCalls } = abrir('');
    await esperar(80);
    const escritos = []; w.__fb._t.setEstado(api(escritos), { uid: 'u1' });
    w.obtenerFolioJSONP = cb => { w.folioNumeroActual = 77; cb('EXPCARE-077/26'); };
    w.confirmarFolioJSONP = (n, cb) => { if (cb) cb(); };
    llenarYGuardar(w, 'btn-pdf');            // jsPDF no está cargado en jsdom: el PDF fallará DESPUÉS del respaldo
    await esperar(60);
    const sheet = fetchCalls.filter(c => c.body && c.body.action === 'saveCotizacion');
    ok('B3 el Sheet recibe la cotización con folio', sheet.length >= 1 && sheet[0].body.folio === 'EXPCARE-077/26', sheet.map(s => s.body.folio));
    ok('B3 se respalda en Firestore con el folio', escritos.length === 1 && escritos[0].d.folio === 'EXPCARE-077/26', escritos.map(e => e.d.folio));
  }
  // B4: modo de prueba (?test=1) → nada en Firestore ni en el Sheet
  {
    const { w, fetchCalls } = abrir('?test=1');
    await esperar(80);
    const escritos = []; w.__fb._t.setEstado(api(escritos), { uid: 'u1' });
    llenarYGuardar(w, 'btn-guardar');
    await esperar(60);
    ok('B4 ?test=1: no toca Firestore', escritos.length === 0, escritos.length);
    ok('B4 ?test=1: no toca el Sheet', fetchCalls.filter(c => c.body && c.body.action === 'saveCotizacion').length === 0);
  }
  // B5: sin sesión → el guardado funciona y avisa
  {
    const { w, fetchCalls } = abrir('');
    await esperar(80);
    llenarYGuardar(w, 'btn-guardar');
    await esperar(60);
    ok('B5 sin sesión: el Sheet recibe la cotización', fetchCalls.filter(c => c.body && c.body.action === 'saveCotizacion').length === 1);
    const avisos = Array.from(w.document.querySelectorAll('div')).map(d => d.textContent);
    ok('B5 sin sesión: aparece el aviso para iniciar sesión', avisos.some(t => /inicia sesión en la pestaña Historial/.test(t)));
  }
  // B6: historial en pantalla (datos simulados)
  {
    const { w } = abrir('');
    await esperar(80);
    w.__fb._t.setEstado({}, { uid: 'u1' });
    w.__fb._t.setCache([
      { cliente: 'Jose Alarcón', telefono: '6141848835', vehiculo: 'Chevrolet Cheyenne 2007', origen: 'WhatsApp', asesor: 'Ana', fecha: '2026-08-12T13:06:00-06:00', folio: '', total: 2100, partidas: [{ producto: 'Aceite <b>x</b>', cant: 6, precio: 350, subtotal: 2100, opcional: false }] },
      { cliente: 'ANA SOFIA', telefono: '', vehiculo: 'TOYOTA YARIS 2007', origen: 'Visita', asesor: 'Xen', fecha: '2026-08-13T12:53:00-06:00', folio: '', total: 3753.05, partidas: [] }
    ]);
    const chip = w.document.getElementById('fb-chip');
    // forzar el repintado como lo hace la capa al recibir datos
    w.document.getElementById('fb-q').value = 'alarcon';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    const res = w.document.getElementById('fb-res');
    ok('B6 busca por nombre y pinta 1 resultado', (res.innerHTML.match(/class="fb-row"/g) || []).length === 1, res.innerHTML.slice(0, 200));
    ok('B6 muestra teléfono, fecha y total', /6141848835/.test(res.textContent) && /12\/08\/2026 13:06/.test(res.textContent) && /\$2,100\.00/.test(res.textContent), res.textContent);
    ok('B6 escapa HTML de los nombres de producto', !/<b>x<\/b>/.test(res.innerHTML) && /&lt;b&gt;x&lt;\/b&gt;/.test(res.innerHTML));
    w.document.getElementById('fb-q').value = 'sofia';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    ok('B6 marca "sin teléfono" cuando falta', /sin teléfono/.test(res.textContent), res.textContent);
    w.document.getElementById('fb-q').value = 'zzzz';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    ok('B6 "Sin resultados" cuando no hay coincidencias', /Sin resultados/.test(res.textContent));
  }
  // B7: puerta de acceso (login al abrir la página)
  {
    const vis = (w, id) => w.document.getElementById(id).style.display;
    // Firebase no cargó (jsdom sin import dinámico) → puerta con error y salida controlada
    const { w } = abrir('');
    await esperar(80);
    ok('B7 sin sesión: la puerta tapa el cotizador', vis(w, 'fb-gate') === 'flex', vis(w, 'fb-gate'));
    ok('B7 Firebase no cargó: ofrece Reintentar / Continuar sin respaldo', vis(w, 'fb-g-err') !== 'none' && vis(w, 'fb-g-form') === 'none');
    w.document.getElementById('fb-g-seguir').click();
    ok('B7 "Continuar sin respaldo" abre el cotizador', vis(w, 'fb-gate') === 'none');
    // Firebase cargó, aún sin saber la sesión → "Verificando sesión…"
    const b = abrir(''); await esperar(80);
    b.w.__fb._t.setPuerta({ sdkError: false, authListo: false, omitido: false, usuario: null });
    ok('B7 verificando sesión: sin formulario todavía', vis(b.w, 'fb-gate') === 'flex' && vis(b.w, 'fb-g-estado') === 'block' && vis(b.w, 'fb-g-form') === 'none');
    // Firebase cargó y no hay sesión → formulario de contraseña
    b.w.__fb._t.setPuerta({ authListo: true });
    ok('B7 sin sesión: aparece el formulario de contraseña', vis(b.w, 'fb-gate') === 'flex' && vis(b.w, 'fb-g-form') === 'block' && vis(b.w, 'fb-g-err') === 'none');
    // login con contraseña mala y buena (API simulada)
    const llamadas = [];
    b.w.__fb._t.setEstado({ entrar: p => { llamadas.push(p); return p === 'buena' ? Promise.resolve() : Promise.reject({ code: 'auth/invalid-credential' }); } }, null);
    b.w.document.getElementById('fb-g-pass').value = '';
    b.w.document.getElementById('fb-g-entrar').click();
    ok('B7 contraseña vacía: pide escribirla y no llama a Firebase', /Escribe la contraseña/.test(b.w.document.getElementById('fb-g-msg').textContent) && llamadas.length === 0);
    b.w.document.getElementById('fb-g-pass').value = 'mala';
    b.w.document.getElementById('fb-g-entrar').click();
    await esperar(20);
    ok('B7 contraseña incorrecta: mensaje y la puerta sigue cerrada', /Contraseña incorrecta/.test(b.w.document.getElementById('fb-g-msg').textContent) && vis(b.w, 'fb-gate') === 'flex' && llamadas[0] === 'mala');
    // sesión iniciada → la puerta se abre; cerrar sesión → vuelve a cerrarse
    b.w.__fb._t.setPuerta({ usuario: { uid: 'u1' } });
    ok('B7 con sesión: la puerta se abre', vis(b.w, 'fb-gate') === 'none');
    b.w.__fb._t.setPuerta({ usuario: null });
    ok('B7 al cerrar sesión: la puerta vuelve a cerrarse', vis(b.w, 'fb-gate') === 'flex');
    // modo prueba: sin puerta
    const t = abrir('?test=1'); await esperar(80);
    ok('B7 ?test=1: no hay puerta', vis(t.w, 'fb-gate') === 'none');
  }
}
