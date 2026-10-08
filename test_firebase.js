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
ok('Ya no existe el acceso con contraseña (cuenta compartida)', !/signInWithEmailAndPassword|fb-g-pass|fb-g-pwbox|id="fb-pass"/.test(html));
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
  process.on('unhandledRejection', e => { if (process.env.DBG) console.log('UNHANDLED', e && e.stack || e); });

  function abrir(query) {
    const fetchCalls = [];
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
      url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html' + (query || ''),
      beforeParse(w) {
        w.fetch = (u, o) => { fetchCalls.push({ u, body: o && o.body ? JSON.parse(o.body) : null }); return Promise.resolve({}); };
        w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true;
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
    w.generarWA();   // la app regenera el texto (y habilita "Copiar") cada vez que cambia una partida
    // el botón "Guardar en historial" ya no existe: copiar = guardar (se usa "Copiar para WhatsApp")
    w.document.getElementById(boton === 'btn-guardar' ? 'bcp' : boton).click();
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
    ok('B2 el letrero queda en "Guardada"', /✅ Guardada/.test(w.document.getElementById('estado-guardado').textContent), w.document.getElementById('estado-guardado').textContent);
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
  // B6b: historial en carpetas por mes + proveedor y costo en las partidas
  {
    const { w } = abrir('');
    await esperar(80);
    const F = w.__fb;
    ok('B6b claveMes y nombreMes', F.claveMes('2026-10-06T10:00:00-06:00') === '2026-10' && F.claveMes('') === 'sin-fecha' && F.nombreMes('2026-10') === 'Octubre 2026' && F.nombreMes('sin-fecha') === 'Sin fecha');
    const mk = (n, mes, dia, extra) => Object.assign({ cliente: 'Cliente ' + n, telefono: '614000' + String(1000 + n), vehiculo: 'Auto ' + n, origen: 'WhatsApp', asesor: 'Ana', fecha: '2026-' + mes + '-' + String(dia).padStart(2, '0') + 'T10:00:00-06:00', folio: '', total: 100, partidas: [] }, extra || {});
    const docs = [];
    for (let i = 0; i < 60; i++) docs.push(mk(i, '10', 1 + (i % 28)));          // octubre: 60
    for (let i = 0; i < 40; i++) docs.push(mk(100 + i, '09', 1 + (i % 28)));    // septiembre: 40
    for (let i = 0; i < 30; i++) docs.push(mk(200 + i, '08', 1 + (i % 28)));    // agosto: 30
    docs.push(mk(999, '07', 5, { cliente: 'Maria Buscada', telefono: '6143664406', partidas: [{ producto: 'Filtro de aire', proveedor: 'Autozone', cant: 1, costo: 296, precio: 422.86, subtotal: 422.86 }, { producto: 'Mano de obra', proveedor: '', cant: 1, costo: null, precio: 500, subtotal: 500 }] }));
    const g = F.agruparPorMes(docs);
    ok('B6b agrupa por mes, más reciente primero', g.map(x => x.clave).join() === '2026-10,2026-09,2026-08,2026-07', g.map(x => x.clave).join());
    ok('B6b cada carpeta trae su conteo y total', g[0].docs.length === 60 && g[0].total === 6000 && g[3].docs.length === 1);
    ok('B6b dentro de la carpeta va lo más nuevo primero', g[0].docs[0].fecha >= g[0].docs[1].fecha);
    F._t.setEstado({}, { uid: 'u1' });
    F._t.setCache(docs);
    w.document.getElementById('fb-q').value = '';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    const res = w.document.getElementById('fb-res');
    ok('B6b sin búsqueda: 4 carpetas (una por mes), no 131 renglones', res.querySelectorAll('.fb-mes').length === 4 && res.querySelectorAll('.fb-row').length === 25, res.querySelectorAll('.fb-mes').length + ' carpetas, ' + res.querySelectorAll('.fb-row').length + ' renglones');
    ok('B6b solo el mes más reciente viene abierto', res.querySelectorAll('.fb-mes.abierta').length === 1 && /Octubre 2026/.test(res.querySelector('.fb-mes.abierta').textContent));
    ok('B6b la carpeta muestra conteo y total', /60 cotizaciones/.test(res.textContent) && /\$6,000\.00/.test(res.textContent), res.querySelector('.fb-mes').textContent);
    ok('B6b "Mostrar más" dentro de la carpeta (35 restantes)', /Mostrar más \(35 restantes\)/.test(res.textContent));
    res.querySelector('.fb-mesmas').click();
    ok('B6b "Mostrar más" agrega 25 renglones', res.querySelectorAll('.fb-row').length === 50);
    res.querySelectorAll('.fb-mes')[1].click();
    ok('B6b abrir otra carpeta muestra sus renglones', res.querySelectorAll('.fb-mes.abierta').length === 2 && res.querySelectorAll('.fb-row').length === 75);
    res.querySelectorAll('.fb-mes')[0].click();
    ok('B6b cerrar una carpeta oculta sus renglones', res.querySelectorAll('.fb-mes.abierta').length === 1 && res.querySelectorAll('.fb-row').length === 25);
    // búsqueda en cualquier carpeta (un mes viejo, por teléfono)
    w.document.getElementById('fb-q').value = '614 366 4406';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    ok('B6b busca por teléfono en una carpeta cerrada y la abre sola', res.querySelectorAll('.fb-row').length === 1 && /Maria Buscada/.test(res.textContent) && /Julio 2026/.test(res.textContent));
    ok('B6b la búsqueda muestra solo las carpetas con coincidencias', res.querySelectorAll('.fb-mes').length === 1);
    // muchas coincidencias: carpetas cerradas, no miles de renglones
    w.document.getElementById('fb-q').value = 'cliente';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    ok('B6b muchas coincidencias: carpetas cerradas con su conteo', res.querySelectorAll('.fb-mes').length === 3 && res.querySelectorAll('.fb-row').length === 0 && /130 coincidencia/.test(w.document.getElementById('fb-estado').textContent), w.document.getElementById('fb-estado').textContent);
    // proveedor y costo en las partidas
    w.document.getElementById('fb-q').value = 'maria';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    const part = res.querySelector('.fb-part');
    ok('B6b las partidas traen columnas Proveedor y Costo', /Proveedor/.test(part.textContent) && /Costo/.test(part.textContent) && /Autozone/.test(part.textContent) && /\$296\.00/.test(part.textContent), part.textContent);
    ok('B6b sin proveedor o sin costo muestra "—"', (part.querySelectorAll('tr')[2].textContent.match(/—/g) || []).length >= 2, part.querySelectorAll('tr')[2].textContent);
    w.document.getElementById('fb-q').value = 'zzzz';
    w.document.getElementById('fb-q').dispatchEvent(new w.Event('input'));
    ok('B6b sin coincidencias: "Sin resultados"', /Sin resultados/.test(res.textContent) && res.querySelectorAll('.fb-mes').length === 0);
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
    ok('B7 sin sesión: aparece el botón de Google', vis(b.w, 'fb-gate') === 'flex' && vis(b.w, 'fb-g-form') === 'block' && vis(b.w, 'fb-g-err') === 'none');
    // acceso con Google
    ok('B7 el botón "Iniciar sesión con Google" existe y es el principal', /Iniciar sesión con Google/.test(b.w.document.getElementById('fb-g-google').textContent));
    ok('B7 no hay campo de contraseña en la puerta', !b.w.document.getElementById('fb-g-pass') && !b.w.document.getElementById('fb-g-otro'));
    let gCalls = 0, gErr = null;
    b.w.__fb._t.setEstado({ entrarGoogle: () => { gCalls++; return gErr ? Promise.reject(gErr) : Promise.resolve(); } }, null);
    b.w.document.getElementById('fb-g-google').click(); await esperar(20);
    ok('B7 clic en Google llama al acceso con Google', gCalls === 1);
    gErr = { code: 'auth/popup-closed-by-user' };
    b.w.document.getElementById('fb-g-google').click(); await esperar(20);
    ok('B7 Google: ventana cerrada → mensaje claro', /Cerraste la ventana de Google/.test(b.w.document.getElementById('fb-g-msg').textContent));
    gErr = { code: 'auth/unauthorized-domain' };
    b.w.document.getElementById('fb-g-google').click(); await esperar(20);
    ok('B7 Google: dominio no autorizado → mensaje claro', /no está autorizado en Firebase/.test(b.w.document.getElementById('fb-g-msg').textContent));
    gErr = { code: 'auth/operation-not-allowed' };
    b.w.document.getElementById('fb-g-google').click(); await esperar(20);
    ok('B7 Google: método no activado → mensaje claro', /no está activado en Firebase/.test(b.w.document.getElementById('fb-g-msg').textContent));
    ok('B7 con error de Google la puerta sigue cerrada', vis(b.w, 'fb-gate') === 'flex');
    // sesión iniciada → la puerta se abre; cerrar sesión → vuelve a cerrarse
    b.w.__fb._t.setPuerta({ usuario: { uid: 'u1' } });
    ok('B7 con sesión: la puerta se abre', vis(b.w, 'fb-gate') === 'none');
    b.w.__fb._t.setPuerta({ usuario: null });
    ok('B7 al cerrar sesión: la puerta vuelve a cerrarse', vis(b.w, 'fb-gate') === 'flex');
    // modo prueba: sin puerta
    const t = abrir('?test=1'); await esperar(80);
    ok('B7 ?test=1: no hay puerta', vis(t.w, 'fb-gate') === 'none');
  }
  // B8: roles (superadministrador / administrador / usuario) y pestaña Usuarios
  {
    const vis = (w, id) => w.document.getElementById(id).style.display;
    const txt = (w, id) => w.document.getElementById(id).textContent;
    const SUPER = 'carlos.mtz@expresscarecuu.com';
    // funciones puras
    {
      const { w } = abrir(''); const F = w.__fb;
      ok('B8 superadministrador se reconoce por correo (aunque venga en mayúsculas)', F.resolverPerfil({ email: 'Carlos.Mtz@ExpressCareCUU.com' }, null).rol === 'superadministrador');
      ok('B8 citas@ sin alta en usuarios = sin acceso (ya no hay cuenta compartida)', F.resolverPerfil({ email: 'citas@expresscarecuu.com' }, null) === null);
      ok('B8 correo sin documento en usuarios = sin acceso', F.resolverPerfil({ email: 'ana@expresscarecuu.com' }, null) === null);
      ok('B8 documento dado de baja = sin acceso', F.resolverPerfil({ email: 'ana@expresscarecuu.com' }, { activo: false, rol: 'usuario' }) === null);
      ok('B8 documento activo rol administrador', F.resolverPerfil({ email: 'ana@expresscarecuu.com' }, { activo: true, rol: 'administrador', nombre: 'Ana' }).rol === 'administrador');
      ok('B8 un rol raro cae a usuario (nunca sube de nivel)', F.resolverPerfil({ email: 'ana@expresscarecuu.com' }, { activo: true, rol: 'superadministrador' }).rol === 'usuario');
      ok('B8 solo super y administrador administran', F.puedeAdministrar({ rol: 'superadministrador' }) && F.puedeAdministrar({ rol: 'administrador' }) && !F.puedeAdministrar({ rol: 'usuario' }) && !F.puedeAdministrar(null));
      ok('B8 super asigna usuario y administrador; administrador solo usuario', F.rolesAsignables({ rol: 'superadministrador' }).join() === 'usuario,administrador' && F.rolesAsignables({ rol: 'administrador' }).join() === 'usuario');
      ok('B8 nadie edita al superadministrador', !F.puedeEditarUsuario({ rol: 'superadministrador' }, { correo: SUPER, rol: 'usuario' }));
      ok('B8 administrador no edita a otro administrador', !F.puedeEditarUsuario({ rol: 'administrador' }, { correo: 'b@x.com', rol: 'administrador' }) && F.puedeEditarUsuario({ rol: 'administrador' }, { correo: 'b@x.com', rol: 'usuario' }));
      ok('B8 correoValido', F.correoValido('a@b.co') && !F.correoValido('a@b') && !F.correoValido('a b@c.com'));
      const d = F.armarUsuario({ correo: SUPER }, { correo: ' Ana@X.com ', nombre: ' Ana ', rol: 'usuario' }, false, new Date('2026-10-06T18:00:00Z'));
      ok('B8 armarUsuario: correo en minúsculas, activo, creado por', d.correo === 'ana@x.com' && d.nombre === 'Ana' && d.activo === true && d.creadoPor === SUPER && d.actualizadoPor === SUPER);
      const d2 = F.armarUsuario({ correo: SUPER }, { correo: 'ana@x.com', nombre: 'Ana', rol: 'usuario', activo: false }, true, new Date());
      ok('B8 armarUsuario al editar no reescribe creadoPor', !('creadoPor' in d2) && d2.activo === false);
      const c = F.conCreador({ a: 1 }, { correo: 'a@x.com', nombre: 'A', rol: 'usuario' });
      ok('B8 conCreador agrega quién guardó', c.creadoPor.correo === 'a@x.com' && c.creadoPor.rol === 'usuario');
    }
    // flujo de acceso con Firebase simulado
    async function sesion(email, doc, opciones) {
      const b = abrir(''); await esperar(80); const F = b.w.__fb; const o = opciones || {};
      const lecturas = [];
      const api = {
        leerPerfil: m => { lecturas.push(m); return o.error ? Promise.reject({ code: o.error }) : Promise.resolve(doc); },
        escuchar: () => () => {},
        escucharUsuarios: cb => { cb(o.usuarios || []); return () => {}; },
        guardarUsuario: (m, d) => { (o.guardados = o.guardados || []).push({ m, d }); return Promise.resolve(); },
        escribir: (id, d) => { (o.escritos = o.escritos || []).push({ id, d }); return Promise.resolve(); }
      };
      F._t.setApi(api);
      const u = { email, displayName: o.nombre || '', emailVerified: o.verificado !== false };
      F._t.setPuerta({ sdkError: false }); F._t.setUsuario(u);
      return { b, F, u, lecturas, o, api };
    }
    {
      const s = await sesion(SUPER, null); await esperar(20); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 super: entra sin leer la colección usuarios', s.lecturas.length === 0 && s.F._t.getPerfil().estado === 'ok');
      ok('B8 super: la puerta se abre y ve la pestaña Usuarios', vis(s.b.w, 'fb-gate') === 'none' && vis(s.b.w, 'tab-usuarios') !== 'none');
      ok('B8 hay botón "Salir" visible en la barra superior y cierra sesión', vis(s.b.w, 'fb-salir-top') !== 'none' && (() => { let salio = 0; s.F._t.setApi(Object.assign({}, s.api, { salir: () => { salio++; return Promise.resolve(); } })); s.b.w.document.getElementById('fb-salir-top').click(); return salio === 1; })());
    ok('B8 super: aparece quién inició sesión y su rol', /Superadministrador/.test(txt(s.b.w, 'fb-quien')) && txt(s.b.w, 'fb-quien').indexOf(SUPER) >= 0);
      const opts = Array.from(s.b.w.document.getElementById('fb-u-rol').options).map(x => x.value).join();
      ok('B8 super puede dar de alta usuario y administrador', opts === 'usuario,administrador', opts);
    }
    {
      const s = await sesion('citas@expresscarecuu.com', { activo: true, rol: 'usuario', nombre: 'Citas' }); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 citas@ dada de alta como usuario (con Google): entra y no ve Usuarios', vis(s.b.w, 'fb-gate') === 'none' && vis(s.b.w, 'tab-usuarios') === 'none' && s.lecturas.length === 1);
    }
    {
      const s = await sesion('citas@expresscarecuu.com', null); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 citas@ sin alta: no entra', vis(s.b.w, 'fb-gate') === 'flex' && vis(s.b.w, 'fb-g-acceso') === 'block');
    }
    {
      const s = await sesion('ana@expresscarecuu.com', { activo: true, rol: 'usuario', nombre: 'Ana' }); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 usuario dado de alta: entra, lee su propio documento y no ve Usuarios', vis(s.b.w, 'fb-gate') === 'none' && s.lecturas[0] === 'ana@expresscarecuu.com' && vis(s.b.w, 'tab-usuarios') === 'none');
    }
    {
      const s = await sesion('beto@expresscarecuu.com', { activo: true, rol: 'administrador', nombre: 'Beto' }, { usuarios: [{ _id: 'x@y.com', correo: 'x@y.com', nombre: 'X', rol: 'usuario', activo: true }, { _id: 'z@y.com', correo: 'z@y.com', nombre: 'Z', rol: 'administrador', activo: true }] });
      await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 administrador: ve Usuarios y solo puede asignar rol Usuario', vis(s.b.w, 'tab-usuarios') !== 'none' && Array.from(s.b.w.document.getElementById('fb-u-rol').options).map(x => x.value).join() === 'usuario');
      const lista = s.b.w.document.getElementById('fb-u-lista');
      ok('B8 administrador: puede dar de baja a un usuario pero no a otro administrador', lista.querySelectorAll('.fb-u-tog').length === 1 && lista.querySelector('.fb-u-tog').getAttribute('data-c') === 'x@y.com' && lista.querySelectorAll('.fb-u-rolsel').length === 0);
    }
    {
      const s = await sesion('intruso@gmail.com', null); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 correo no registrado: la puerta sigue cerrada con mensaje claro', vis(s.b.w, 'fb-gate') === 'flex' && vis(s.b.w, 'fb-g-acceso') === 'block' && vis(s.b.w, 'fb-g-form') === 'none' && /no tiene acceso/.test(txt(s.b.w, 'fb-g-acceso-msg')) && /intruso@gmail\.com/.test(txt(s.b.w, 'fb-g-acceso-msg')));
      ok('B8 sin acceso: no ve historial ni Usuarios', vis(s.b.w, 'fb-hist') === 'none' && vis(s.b.w, 'tab-usuarios') === 'none');
      ok('B8 sin acceso: el chip lo dice', /sin acceso/.test(txt(s.b.w, 'fb-chip')));
    }
    {
      const s = await sesion('baja@expresscarecuu.com', { activo: false, rol: 'usuario' }); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 usuario dado de baja: no entra', vis(s.b.w, 'fb-gate') === 'flex' && vis(s.b.w, 'fb-g-acceso') === 'block');
    }
    {
      const s = await sesion('nuevo@gmail.com', { activo: true, rol: 'usuario' }, { verificado: false }); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 correo sin verificar: no entra aunque esté en la lista', vis(s.b.w, 'fb-gate') === 'flex' && s.lecturas.length === 0);
    }
    {
      const s = await sesion('ana@expresscarecuu.com', null, { error: 'permission-denied' }); await s.F.verificarAcceso(s.u); await esperar(20);
      ok('B8 error al verificar (p. ej. reglas sin publicar): puerta cerrada y mensaje con el código', vis(s.b.w, 'fb-gate') === 'flex' && /No se pudo verificar tu acceso/.test(txt(s.b.w, 'fb-g-acceso-msg')) && /permission-denied/.test(txt(s.b.w, 'fb-g-acceso-msg')));
    }
    {
      const s = await sesion('ana@expresscarecuu.com', { activo: true, rol: 'usuario' }); await s.F.verificarAcceso(s.u); await esperar(20);
      s.b.w.__fb._t.setUsuario(null); await s.F.verificarAcceso(null); await esperar(20);
      ok('B8 cerrar sesión: vuelve la puerta con el botón de Google', vis(s.b.w, 'fb-gate') === 'flex' && vis(s.b.w, 'fb-g-form') === 'block' && vis(s.b.w, 'fb-g-acceso') === 'none');
    }
    // alta de usuarios desde la pestaña
    {
      const s = await sesion(SUPER, null, { usuarios: [{ _id: 'x@y.com', correo: 'x@y.com', nombre: 'X', rol: 'usuario', activo: true }] });
      await s.F.verificarAcceso(s.u); await esperar(20);
      const w = s.b.w, set = (id, v) => { w.document.getElementById(id).value = v; };
      set('fb-u-correo', 'malcorreo'); set('fb-u-nombre', 'N'); w.document.getElementById('fb-u-agregar').click(); await esperar(10);
      ok('B8 alta: correo inválido se rechaza', /correo válido/.test(txt(w, 'fb-u-msg')) && !s.o.guardados);
      set('fb-u-correo', 'x@y.com'); w.document.getElementById('fb-u-agregar').click(); await esperar(10);
      ok('B8 alta: correo repetido se rechaza', /ya está en la lista/.test(txt(w, 'fb-u-msg')) && !s.o.guardados);
      set('fb-u-correo', SUPER); w.document.getElementById('fb-u-agregar').click(); await esperar(10);
      ok('B8 alta: no se puede dar de alta al superadministrador', /acceso fijo/.test(txt(w, 'fb-u-msg')) && !s.o.guardados);
      set('fb-u-correo', 'Nueva@ExpressCareCUU.com'); set('fb-u-nombre', 'Nueva Persona'); set('fb-u-rol', 'administrador');
      w.document.getElementById('fb-u-agregar').click(); await esperar(20);
      const g = s.o.guardados && s.o.guardados[0];
      ok('B8 alta válida: guarda en usuarios/{correo en minúsculas} con rol y activo', g && g.m === 'nueva@expresscarecuu.com' && g.d.rol === 'administrador' && g.d.activo === true && g.d.creadoPor === SUPER, JSON.stringify(g));
      ok('B8 alta válida: confirma y limpia el formulario', /ya puede entrar/.test(txt(w, 'fb-u-msg')) && w.document.getElementById('fb-u-correo').value === '');
      // baja y cambio de rol
      w.document.querySelector('#fb-u-lista .fb-u-tog').click(); await esperar(20);
      const b2 = s.o.guardados[1];
      ok('B8 dar de baja: guarda activo=false sin tocar el rol', b2 && b2.m === 'x@y.com' && b2.d.activo === false && b2.d.rol === 'usuario');
      const sel = w.document.querySelector('#fb-u-lista .fb-u-rolsel'); sel.value = 'administrador'; sel.dispatchEvent(new w.Event('change', { bubbles: true })); await esperar(20);
      const b3 = s.o.guardados[2];
      ok('B8 cambio de rol (solo super): guarda el nuevo rol', b3 && b3.d.rol === 'administrador' && b3.d.activo === true);
    }
    {
      const s = await sesion('beto@expresscarecuu.com', { activo: true, rol: 'administrador', nombre: 'Beto' }, { usuarios: [] });
      await s.F.verificarAcceso(s.u); await esperar(20);
      const w = s.b.w, set = (id, v) => { w.document.getElementById(id).value = v; };
      const opt = w.document.createElement('option'); opt.value = 'administrador'; w.document.getElementById('fb-u-rol').appendChild(opt);   // simula manipular el selector
      set('fb-u-correo', 'otro@gmail.com'); set('fb-u-nombre', 'Otro'); set('fb-u-rol', 'administrador');
      w.document.getElementById('fb-u-agregar').click(); await esperar(20);
      ok('B8 administrador no puede crear otro administrador (aunque manipulen el selector)', /No puedes asignar ese rol/.test(txt(w, 'fb-u-msg')) && !s.o.guardados);
    }
    // el respaldo anota quién guardó la cotización
    {
      const s = await sesion('ana@expresscarecuu.com', { activo: true, rol: 'usuario', nombre: 'Ana' }); await s.F.verificarAcceso(s.u); await esperar(20);
      llenarYGuardar(s.b.w, 'btn-guardar'); await esperar(60);
      const e = s.o.escritos && s.o.escritos[0];
      ok('B8 el respaldo guarda creadoPor con correo, nombre y rol', e && e.d.creadoPor && e.d.creadoPor.correo === 'ana@expresscarecuu.com' && e.d.creadoPor.nombre === 'Ana' && e.d.creadoPor.rol === 'usuario', e && JSON.stringify(e.d.creadoPor));
    }
    {
      const s = await sesion('intruso@gmail.com', null); await s.F.verificarAcceso(s.u); await esperar(20);
      llenarYGuardar(s.b.w, 'btn-guardar'); await esperar(60);
      ok('B8 sin acceso: no se escribe nada en Firestore', !s.o.escritos);
    }
  }
}
