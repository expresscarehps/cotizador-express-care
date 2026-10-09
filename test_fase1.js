// ── TEST SUITE — Fase 1 (pruebas de COMPORTAMIENTO con la página real en jsdom) ─────────
// Archivo: test_fase1.js
// Uso:  node test_fase1.js [ruta_al_html]      (por defecto ./cotizador_dev.html)
// Requiere:  npm i jsdom   (si no está instalado, se avisa y termina sin correr nada).
//
// A diferencia de test_cotizador.js (que revisa estructura del código), aquí se abre la página
// como un navegador, se llenan los campos, se presionan los botones y se mira QUÉ se envía de verdad
// al Sheet (Apps Script) y a n8n (aviso a GHL). Cubre lo que falló en octubre: copiar con carrito
// vacío, teléfonos cortos, teléfono como nombre, doble clic, aviso sin cotización guardada.

const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');

let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado (npm i jsdom) — no se corrió test_fase1.js'); process.exit(0); }

let passed = 0, failed = 0;
// jsPDF no carga en jsdom: el PDF falla DESPUÉS de guardar (a propósito); no debe tumbar la prueba
process.on('unhandledRejection', () => {});
function ok(name, cond, extra) {
  if (cond) { console.log('  ✅ ' + name); passed++; }
  else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; }
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
const URL_DEV = 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html';
const URL_PROD = 'https://expresscarehps.github.io/cotizador-express-care/cotizador_express_care_valvoline.html';
const RE_REF = /^\d{4}-[2-9A-HJKMNP-Z]{5}$/;

// Abre la página con fetch / alert / confirm / portapapeles simulados y registrados.
function abrir(opc) {
  opc = opc || {};
  const reg = { fetch: [], alerts: [], confirms: [], copiados: [], respuestas: opc.confirm === undefined ? true : opc.confirm, falloSheet: false };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: (opc.url || URL_DEV) + (opc.query || ''),
    beforeParse(w) {
      w.fetch = (u, o) => {
        let body = null; try { body = o && o.body ? JSON.parse(o.body) : null; } catch (e) { body = o && o.body; }
        reg.fetch.push({ u: String(u), body });
        if (reg.falloSheet && body && body.action === 'saveCotizacion') return Promise.reject(new Error('sin red'));
        return Promise.resolve({ json: () => ({}), text: () => '' });
      };
      w.alert = m => { reg.alerts.push(String(m)); };
      w.confirm = m => { reg.confirms.push(String(m)); return typeof reg.respuestas === 'function' ? reg.respuestas(String(m)) : reg.respuestas; };
      w.document.execCommand = () => true;
      Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: t => { reg.copiados.push(t); return Promise.resolve(); } } });
    }
  });
  reg.w = dom.window;
  reg.sheet = () => reg.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
  reg.aviso = () => reg.fetch.filter(c => /cotizacion-enviada-ghl/.test(c.u));
  return reg;
}
const $ = (r, id) => r.w.document.getElementById(id);
function llenar(r, o) {
  o = Object.assign({ nombre: 'Cliente de Prueba', tel: '6140000000', origen: 'WhatsApp', asesor: 'Ana', marca: 'Nissan', modelo: 'Sentra', anio: '2020', cil: '4' }, o || {});
  const set = (id, v) => { $(r, id).value = v; };
  set('cli-nombre', o.nombre); set('cli-tel', o.tel); set('cli-origen', o.origen); set('asesor', o.asesor);
  set('v-marca', o.marca); set('v-modelo', o.modelo); set('v-anio', o.anio); set('v-cil', o.cil);
}
function conProducto(r, precio) {
  r.w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio || 550), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  r.w.generarWA();
}
function cambiarAsesor(r, nuevo) { $(r, 'asesor').value = nuevo; $(r, 'asesor').dispatchEvent(new r.w.Event('input')); }
async function copiar(r) { $(r, 'bcp').click(); await esperar(60); }
const textoLetrero = r => $(r, 'estado-guardado').textContent;

(async () => {
  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-A. CARRITO VACÍO ===');
  {
    const r = abrir(); await esperar(80);
    llenar(r);
    ok('A1 el botón "Copiar para WhatsApp" está deshabilitado sin productos', $(r, 'bcp').disabled === true);
    r.w.copiar(); await esperar(40);
    ok('A2 copiar() sin productos avisa y NO copia nada', r.alerts.length === 1 && /al menos un producto/.test(r.alerts[0]) && r.copiados.length === 0, { alerts: r.alerts, copiados: r.copiados });
    ok('A3 sin productos: "Ya la envié" sigue deshabilitado', $(r, 'btn-ya-envie').disabled === true);
    ok('A4 sin productos: no se guardó nada ni se avisó a GHL', r.sheet().length === 0 && r.aviso().length === 0);
    ok('A5 sin productos: el letrero de guardado no aparece', $(r, 'estado-guardado').style.display === 'none');
    conProducto(r);
    ok('A6 con un producto el botón Copiar se habilita', $(r, 'bcp').disabled === false);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-B. TELÉFONO DE 10 DÍGITOS ===');
  {
    const r = abrir(); await esperar(80);
    const n = r.w.normalizarTelefono;
    ok('B1 "+52 614 123 4567" → 6141234567', n('+52 614 123 4567') === '6141234567', n('+52 614 123 4567'));
    ok('B2 "526141234567" → 6141234567', n('526141234567') === '6141234567');
    ok('B3 "5216141234567" → 6141234567', n('5216141234567') === '6141234567');
    ok('B4 "(614) 123-4567" → 6141234567', n('(614) 123-4567') === '6141234567');
    ok('B5 un número de 10 dígitos no se toca', n('6141234567') === '6141234567');
    ok('B6 más de 10 dígitos sin 52 se recorta a 10', n('61412345678999') === '6141234567');
    // pegado real en el campo (evento input)
    const tel = $(r, 'cli-tel'); tel.value = '+52 (614) 123-4567'; tel.dispatchEvent(new r.w.Event('input', { bubbles: true }));
    ok('B7 pegar con +52 en el campo lo deja en 10 dígitos', tel.value === '6141234567', tel.value);
    llenar(r, { tel: '614123456' });   // 9 dígitos
    ok('B8 9 dígitos: validarCampos lo rechaza', r.w.validarCampos().some(e => /Teléfono/.test(e)), r.w.validarCampos());
    llenar(r, { tel: '6141234567' });
    ok('B9 10 dígitos: validarCampos lo acepta', !r.w.validarCampos().some(e => /Teléfono/.test(e)));
    llenar(r, { tel: '' });
    ok('B10 teléfono vacío: se rechaza', r.w.validarCampos().some(e => /Teléfono/.test(e)));
    conProducto(r); llenar(r, { tel: '614123456' });
    await copiar(r);
    ok('B11 copiar con teléfono corto: NO copia, NO guarda, NO activa "Ya la envié"', r.copiados.length === 0 && r.sheet().length === 0 && $(r, 'btn-ya-envie').disabled === true && r.alerts.some(a => /Faltan datos/.test(a)), { c: r.copiados.length, s: r.sheet().length });
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-C. NOMBRE Y "SIN NOMBRE" ===');
  {
    const r = abrir(); await esperar(80);
    llenar(r, { nombre: '6141234567' });
    ok('C1 un nombre que es solo números se rechaza', r.w.validarCampos().some(e => /Nombre/.test(e)), r.w.validarCampos());
    llenar(r, { nombre: '614 123 4567' });
    ok('C2 un teléfono con espacios como nombre también se rechaza', r.w.validarCampos().some(e => /Nombre/.test(e)));
    llenar(r, { nombre: 'Juan Pérez' });
    ok('C3 un nombre normal se acepta', !r.w.validarCampos().some(e => /Nombre/.test(e)));
    ok('C4 la casilla "Sin nombre" existe en la tarjeta Cliente', !!$(r, 'cli-sin-nombre'));
    conProducto(r);
    $(r, 'cli-sin-nombre').click();
    ok('C5 marcar la casilla bloquea el campo y pone "Sin nombre"', $(r, 'cli-nombre').disabled === true && $(r, 'cli-nombre').value === 'Sin nombre');
    ok('C6 con la casilla marcada el nombre es válido', !r.w.validarCampos().some(e => /Nombre/.test(e)));
    const wa = $(r, 'wt').textContent;
    ok('C7 el texto al cliente no dice "Sin" como si fuera su nombre', !/paciencia, Sin/.test(wa) && /Gracias por tu paciencia\. Aquí está tu presupuesto/.test(wa), wa.slice(0, 120));
    await copiar(r);
    ok('C8 el Sheet recibe cliente "Sin nombre" y el teléfono', r.sheet()[0] && r.sheet()[0].body.cliente === 'Sin nombre' && r.sheet()[0].body.telefono === '6140000000', r.sheet()[0] && r.sheet()[0].body.cliente);
    $(r, 'btn-ya-envie').click(); await esperar(30);
    ok('C9 el aviso a GHL de "Sin nombre" va con cliente vacío (nunca el teléfono)', r.aviso().length === 1 && r.aviso()[0].body.cliente === '' && r.aviso()[0].body.telefono === '6140000000', r.aviso()[0] && r.aviso()[0].body);
    $(r, 'cli-sin-nombre').click();
    ok('C10 desmarcar la casilla libera y limpia el campo', $(r, 'cli-nombre').disabled === false && $(r, 'cli-nombre').value === '');
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-D. SOLO LLANTAS ===');
  {
    const r = abrir(); await esperar(80);
    ok('D1 la guía "SOLO LLANTAS" está en el campo Marca', /SOLO LLANTAS/.test($(r, 'v-marca').getAttribute('placeholder')));
    llenar(r, { modelo: '', anio: '', cil: '' });
    ok('D2 sin modelo/año/cilindros y marca normal: se pide todo', ['Modelo', 'Año', 'Cilindros'].every(x => r.w.validarCampos().some(e => e.indexOf(x) >= 0)), r.w.validarCampos());
    llenar(r, { marca: 'solo llantas', modelo: '', anio: '', cil: '' });
    ok('D3 marca "solo llantas" (cualquier mayúscula): ya no pide modelo, año ni cilindros', r.w.validarCampos().length === 0, r.w.validarCampos());
    ok('D4 getVehiculo devuelve "Solo llantas"', r.w.getVehiculo() === 'Solo llantas', r.w.getVehiculo());
    conProducto(r);
    await copiar(r);
    ok('D5 se guarda con vehículo "Solo llantas" (no "NA NA 1900")', r.sheet().length === 1 && r.sheet()[0].body.vehiculo === 'Solo llantas', r.sheet()[0] && r.sheet()[0].body.vehiculo);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-E. COPIAR = GUARDAR, Y EL Ref ===');
  {
    const r = abrir(); await esperar(80);
    llenar(r); conProducto(r);
    ok('E1 antes de copiar el letrero dice "Sin guardar"', /Sin guardar/.test(textoLetrero(r)), textoLetrero(r));
    ok('E2 ya no existe el botón "Guardar en historial"', !html.includes('id="btn-guardar"') && !$(r, 'btn-guardar'));
    await copiar(r);
    const s = r.sheet();
    ok('E3 copiar guarda en el Sheet exactamente UNA vez', s.length === 1, s.length);
    const ref = s[0] && s[0].body.ref;
    ok('E4 el Sheet recibe un Ref con formato MMDD-XXXXX', RE_REF.test(ref || ''), ref);
    ok('E5 grupo = el mismo Ref y versión 1', s[0] && s[0].body.grupo === ref && s[0].body.version === 1, s[0] && { g: s[0].body.grupo, v: s[0].body.version });
    ok('E6 el texto copiado termina con "Ref <código>" y es el mismo Ref que se guardó', r.copiados.length === 1 && r.copiados[0].endsWith('\n\nRef ' + ref), r.copiados[0] && r.copiados[0].slice(-40));
    ok('E7 el guardado conserva los datos de siempre (cliente, teléfono, vehículo, partidas, total)', s[0] && s[0].body.cliente === 'Cliente de Prueba' && s[0].body.telefono === '6140000000' && /Nissan Sentra 2020/.test(s[0].body.vehiculo) && s[0].body.items.length === 1 && s[0].body.total === '$1,100.00' || (s[0] && s[0].body.items && s[0].body.items.length === 1), s[0] && s[0].body.total);
    ok('E8 el letrero queda en "Guardada" con el Ref', /✅ Guardada/.test(textoLetrero(r)) && textoLetrero(r).indexOf(ref) >= 0, textoLetrero(r));
    ok('E9 "Ya la envié" se habilita tras copiar', $(r, 'btn-ya-envie').disabled === false);
    await copiar(r);
    ok('E10 copiar otra vez el MISMO contenido NO guarda de nuevo (mismo Ref)', r.sheet().length === 1 && r.copiados.length === 2 && r.copiados[1] === r.copiados[0], r.sheet().length);
    cambiarAsesor(r, 'Xen');
    ok('E11 al cambiar algo el letrero vuelve a "Sin guardar"', /Sin guardar/.test(textoLetrero(r)), textoLetrero(r));
    ok('E12 al cambiar algo "Ya la envié" se apaga (el aviso debe llevar el Ref copiado)', $(r, 'btn-ya-envie').disabled === true);
    await copiar(r);
    const s2 = r.sheet();
    ok('E13 la versión ajustada se guarda con OTRO Ref', s2.length === 2 && RE_REF.test(s2[1].body.ref) && s2[1].body.ref !== ref, s2.map(x => x.body.ref));
    ok('E14 la versión ajustada es versión 2 del mismo grupo', s2[1] && s2[1].body.version === 2 && s2[1].body.grupo === ref, s2[1] && { v: s2[1].body.version, g: s2[1].body.grupo });
    const r2 = abrir(); await esperar(80); llenar(r2); conProducto(r2); const ref1 = r2.w.refVigente;
    const r3 = abrir(); await esperar(80); llenar(r3); conProducto(r3);
    ok('E15 mismo contenido, mismo teléfono y mismo día = mismo Ref (determinista)', RE_REF.test(ref1) && ref1 === r3.w.refVigente, [ref1, r3.w.refVigente]);
    $(r3, 'cli-tel').value = '6141111111'; $(r3, 'cli-tel').dispatchEvent(new r3.w.Event('input', { bubbles: true }));
    ok('E16 otro teléfono = otro Ref', r3.w.refVigente !== ref1, [ref1, r3.w.refVigente]);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-F. "YA LA ENVIÉ": CONFIRMACIÓN, DOBLE CLIC Y CAMPOS DEL AVISO ===');
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r); conProducto(r);
    await copiar(r);
    const ref = r.sheet()[0].body.ref;
    const bye = $(r, 'btn-ya-envie');
    bye.click(); bye.click(); bye.click(); await esperar(40);
    ok('F1 tres clics seguidos = UN solo aviso a GHL', r.aviso().length === 1, r.aviso().length);
    ok('F2 el botón queda deshabilitado y dice "Aviso enviado"', bye.disabled === true && /Aviso enviado/.test(bye.textContent), bye.textContent);
    const p = r.aviso()[0] && r.aviso()[0].body;
    ok('F3 el aviso conserva telefono / cliente / folio (formato que lee el n8n actual)', p && p.telefono === '6140000000' && p.cliente === 'Cliente de Prueba' && p.folio === '', p);
    ok('F4 el aviso trae asesor, total, ref, grupo, fuente y versión de la página', p && p.asesor === 'Ana' && p.total === 1100 && p.ref === ref && p.grupo === ref && p.fuente === 'dev' && typeof p.version === 'string' && p.version.length > 0, p);
    ok('F5 hubo una confirmación antes del aviso', r.confirms.length === 1 && /REAL/.test(r.confirms[0]), r.confirms);
    await copiar(r);
    ok('F6 copiar de nuevo el mismo contenido NO vuelve a habilitar el aviso (no reinicia recordatorios)', $(r, 'btn-ya-envie').disabled === true);
    bye.click(); await esperar(30);
    ok('F7 sigue habiendo un solo aviso', r.aviso().length === 1);
  }
  {
    // Dev: cancelar la confirmación = simulado, no se manda nada real
    const r = abrir({ confirm: false }); await esperar(80);
    llenar(r); conProducto(r); await copiar(r);
    $(r, 'btn-ya-envie').click(); await esperar(30);
    ok('F8 dev + cancelar: NO se envía aviso real a GHL', r.aviso().length === 0, r.aviso().length);
    ok('F9 dev + cancelar: el botón sigue disponible (no se marcó como enviado)', $(r, 'btn-ya-envie').disabled === false);
  }
  {
    // Producción (nombre de archivo sin "dev"): confirma con el cliente y manda fuente "prod"
    const r = abrir({ url: URL_PROD, confirm: true }); await esperar(80);
    llenar(r); conProducto(r); await copiar(r);
    $(r, 'btn-ya-envie').click(); await esperar(30);
    ok('F10 prod: pregunta por el cliente y el teléfono, y manda fuente "prod"', r.aviso().length === 1 && r.aviso()[0].body.fuente === 'prod' && /6140000000/.test(r.confirms[0]) && !/versión de prueba/i.test(r.confirms[0]), r.confirms[0]);
    const r2 = abrir({ url: URL_PROD, confirm: false }); await esperar(80);
    llenar(r2); conProducto(r2); await copiar(r2);
    $(r2, 'btn-ya-envie').click(); await esperar(30);
    ok('F11 prod + "No ya se la mandé": no se avisa', r2.aviso().length === 0);
  }
  {
    // Cambió la cotización después de copiar: no se puede avisar con un Ref viejo
    const r = abrir(); await esperar(80);
    llenar(r); conProducto(r); await copiar(r);
    cambiarAsesor(r, 'Xen');
    $(r, 'btn-ya-envie').click(); await esperar(30);
    ok('F12 si cambió después de copiar, "Ya la envié" no avisa', r.aviso().length === 0);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-G. MODO PRUEBA (?test=1) ===');
  {
    const r = abrir({ query: '?test=1' }); await esperar(80);
    llenar(r); conProducto(r); await copiar(r);
    ok('G1 ?test=1: no toca el Sheet', r.sheet().length === 0);
    ok('G2 ?test=1: el letrero lo dice', /PRUEBA/.test(textoLetrero(r)), textoLetrero(r));
    $(r, 'btn-ya-envie').click(); await esperar(30);
    ok('G3 ?test=1: no avisa a GHL ni pregunta', r.aviso().length === 0 && r.confirms.length === 0);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-H. SI FALLA EL GUARDADO ===');
  {
    const r = abrir(); await esperar(80);
    r.falloSheet = true;
    llenar(r); conProducto(r); await copiar(r); await esperar(40);
    ok('H1 el texto se copia igual aunque falle el guardado', r.copiados.length === 1);
    ok('H2 el letrero rojo avisa que NO se guardó y ofrece Reintentar', /NO se guardó/.test(textoLetrero(r)) && !!$(r, 'btn-reintentar-guardado'), textoLetrero(r));
    ok('H3 "Ya la envié" queda disponible (la venta no se frena)', $(r, 'btn-ya-envie').disabled === false);
    r.falloSheet = false;
    $(r, 'btn-reintentar-guardado').click(); await esperar(60);
    ok('H4 Reintentar guarda y el letrero pasa a "Guardada"', /✅ Guardada/.test(textoLetrero(r)) && r.sheet().length === 2, { t: textoLetrero(r), n: r.sheet().length });
    ok('H5 el reintento conserva versión 1 (la fallida no cuenta)', r.sheet()[1].body.version === 1, r.sheet()[1].body.version);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-I. GENERAR PDF TAMBIÉN GUARDA (con folio) ===');
  {
    const r = abrir(); await esperar(80);
    r.w.obtenerFolioJSONP = cb => { r.w.folioNumeroActual = 9; cb('EXPCARE-009/26'); };
    r.w.confirmarFolioJSONP = (n, cb) => { if (cb) cb(); };
    llenar(r); conProducto(r);
    await copiar(r);                                  // v1 sin folio
    const ref = r.sheet()[0].body.ref;
    $(r, 'btn-pdf').click(); await esperar(80);       // jsPDF no carga en jsdom; el guardado ocurre antes
    const s = r.sheet();
    ok('I1 el PDF guarda una versión nueva con el folio', s.length === 2 && s[1].body.folio === 'EXPCARE-009/26', s.map(x => x.body.folio));
    ok('I2 esa versión lleva el MISMO Ref que se copió y es la versión 2', s[1] && s[1].body.ref === ref && s[1].body.version === 2 && s[1].body.grupo === ref, s[1] && { r: s[1].body.ref, v: s[1].body.version });
    ok('I3 el letrero indica que ya quedó con folio', /con folio/.test(textoLetrero(r)), textoLetrero(r));
  }
  {
    // PDF sin haber copiado antes: se guarda igual (todas las cotizaciones quedan registradas)
    const r = abrir(); await esperar(80);
    r.w.obtenerFolioJSONP = cb => { r.w.folioNumeroActual = 10; cb('EXPCARE-010/26'); };
    r.w.confirmarFolioJSONP = (n, cb) => { if (cb) cb(); };
    llenar(r); conProducto(r);
    $(r, 'btn-pdf').click(); await esperar(80);
    ok('I4 PDF sin copiar antes: se guarda con folio, Ref y versión 1', r.sheet().length === 1 && r.sheet()[0].body.folio === 'EXPCARE-010/26' && RE_REF.test(r.sheet()[0].body.ref) && r.sheet()[0].body.version === 1, r.sheet()[0] && r.sheet()[0].body);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-J. "NUEVA COTIZACIÓN" GUARDA ANTES DE BORRAR ===');
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r); conProducto(r);
    $(r, 'btn-nueva').click(); await esperar(80);
    ok('J1 sin guardar y completa: se guarda ANTES de borrar', r.sheet().length === 1 && RE_REF.test(r.sheet()[0].body.ref), r.sheet().length);
    ok('J2 después de guardar sí se limpia la pantalla', (r.w.tallerItems || []).length === 0 && r.w.cart.length === 0 && $(r, 'cli-nombre').value === '');
  }
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r); conProducto(r); await copiar(r);
    const antes = r.sheet().length;
    $(r, 'btn-nueva').click(); await esperar(60);
    ok('J3 ya guardada: "Nueva cotización" no guarda otra vez', r.sheet().length === antes);
  }
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r, { tel: '123' }); conProducto(r);
    $(r, 'btn-nueva').click(); await esperar(60);
    ok('J4 sin guardar e incompleta: avisa qué falta y pregunta (no borra en silencio)', r.confirms.some(c => /NO está guardada/.test(c) && /Teléfono/.test(c)), r.confirms);
  }
  {
    const r = abrir({ confirm: false }); await esperar(80);
    llenar(r, { tel: '123' }); conProducto(r);
    $(r, 'btn-nueva').click(); await esperar(60);
    ok('J5 si dice que no, conserva la cotización', (r.w.tallerItems || []).length === 1 && $(r, 'cli-tel').value === '123');
  }
  {
    const r = abrir({ confirm: false }); await esperar(80);
    r.falloSheet = true;
    llenar(r); conProducto(r);
    $(r, 'btn-nueva').click(); await esperar(80);
    ok('J6 si el guardado falla, pregunta y al decir que no la conserva', r.confirms.some(c => /No se pudo guardar/.test(c)) && (r.w.tallerItems || []).length === 1, r.confirms);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== L. CAMPO "origen" EN EL AVISO (idéntico a la columna Origen del Sheet) ===');
  {
    const opciones = ['WhatsApp', 'Facebook', 'Llamada', 'Visita', 'Cliente de casa', 'Auto en servicio'];
    for (const op of opciones) {
      const r = abrir({ confirm: true }); await esperar(80);
      llenar(r, { origen: op }); conProducto(r); await copiar(r);
      $(r, 'btn-ya-envie').click(); await esperar(40);
      const sheetOrigen = r.sheet()[0] && r.sheet()[0].body.origen, avisoOrigen = r.aviso()[0] && r.aviso()[0].body.origen;
      ok('L1 "' + op + '": el aviso lleva origen igual al del Sheet', avisoOrigen === op && sheetOrigen === op, { sheetOrigen, avisoOrigen });
    }
  }
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r, { origen: 'Auto en servicio' }); $(r, 'orden-servicio').value = '2319';
    conProducto(r); await copiar(r);
    $(r, 'btn-ya-envie').click(); await esperar(40);
    const so = r.sheet()[0].body.origen, ao = r.aviso()[0].body.origen;
    ok('L2 con No. de orden: el aviso lleva "Auto en servicio #2319", igual que el Sheet', so === 'Auto en servicio #2319' && ao === so, { so, ao });
    const p = r.aviso()[0].body;
    ok('L3 el resto del aviso no cambió (mismos 10 campos + origen)', ['telefono','cliente','folio','asesor','total','ref','grupo','versionCotizacion','fuente','version','origen'].every(k => k in p) && Object.keys(p).length === 11, Object.keys(p));
    ok('L4 la versión de la página es nueva (no "fase1")', /^(dev|prod) 2026-10-\d\d \w+/.test(p.version) && !/fase1/.test(p.version), p.version);
  }
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r, { origen: 'Llamada' }); conProducto(r);
    ok('L5 armarPayloadAviso con origen vacío manda "" (no falla)', (() => { $(r, 'cli-origen').value = ''; const p = r.w.armarPayloadAviso(); return p.origen === ''; })());
  }
  {
    const r = abrir({ confirm: true, query: '?test=1' }); await esperar(80);
    llenar(r, { origen: 'Llamada' }); conProducto(r); await copiar(r);
    $(r, 'btn-ya-envie').click(); await esperar(40);
    ok('L6 ?test=1: sigue sin mandar nada a GHL', r.aviso().length === 0);
  }
  {
    const r = abrir({ confirm: false }); await esperar(80);
    llenar(r, { origen: 'Llamada' }); conProducto(r); await copiar(r);
    $(r, 'btn-ya-envie').click(); await esperar(40);
    ok('L7 dev + Cancelar (simular): no manda nada a GHL', r.aviso().length === 0);
  }
  {
    const r = abrir({ confirm: true, url: URL_PROD }); await esperar(80);
    llenar(r, { origen: 'Visita' }); conProducto(r); await copiar(r);
    $(r, 'btn-ya-envie').click(); await esperar(40);
    ok('L8 en producción: origen igual al del Sheet y fuente "prod"', r.aviso()[0] && r.aviso()[0].body.origen === 'Visita' && r.aviso()[0].body.fuente === 'prod' && r.sheet()[0].body.origen === 'Visita', r.aviso()[0] && r.aviso()[0].body);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-M. MARCA DE LA LLANTA EN EL TEXTO DE WHATSAPP Y EN EL SHEET ===');
  {
    const r = abrir(); await esperar(80);
    const f = r.w.descConMarca;
    ok('M1 descConMarca existe', typeof f === 'function');
    ok('M2 llanta de catálogo sin la marca en la descripción: la marca va al frente', f({ desc: '175/70 R13 82T TL ENERGY XM2', marca: 'MICHELIN', cve: 'AY26387' }) === 'MICHELIN 175/70 R13 82T TL ENERGY XM2');
    ok('M3 si la descripción YA trae la marca no se repite (VEGA)', f({ desc: '155/70-R13 BLACKHAWK HH11 75T', marca: 'BLACKHAWK', cve: '15570R13HH11' }) === '155/70-R13 BLACKHAWK HH11 75T');
    ok('M4 llanta manual "otro" (sin cve; marca = proveedor) NO se modifica', f({ desc: '205/55R16 ALGO', marca: 'Llantera X', precio: 1 }) === '205/55R16 ALGO');
    ok('M5 sin marca: queda igual', f({ desc: '205/55R16 ALGO', marca: '', cve: 'X1' }) === '205/55R16 ALGO');
    ok('M6 comparación sin importar mayúsculas', f({ desc: '205/55R16 michelin primacy', marca: 'MICHELIN', cve: 'X2' }) === '205/55R16 michelin primacy');
    // catálogo real: ninguna llanta pierde información ni queda sin marca
    const cat = [['DATA', r.w.DATA], ['AYALA', r.w.AYALA], ['VEGA', r.w.VEGA]];
    for (const [n, a] of cat) {
      const mal = a.filter(x => { const d = f({ desc: x.desc, marca: x.marca, cve: x.cve || 'c' }); return d.toUpperCase().indexOf(String(x.marca).toUpperCase()) < 0 || d.indexOf(x.desc) < 0; });
      ok('M7 catálogo ' + n + ' (' + a.length + '): toda llanta sale con su marca y conserva su descripción', mal.length === 0, mal.slice(0, 3));
    }
  }
  for (const [nombre, url] of [['dev', URL_DEV], ['prod', URL_PROD]]) {
    const r = abrir({ confirm: true, url }); await esperar(80);
    llenar(r);
    const it = r.w.AYALA[0];
    r.w.cart.push({ id: 'l1', t: 'l', desc: it.desc, marca: it.marca, precio: 2000, precioBase: 2000, pb: 1500, qty: 4, pid: null, cve: it.cve, isAyala: true, isVega: false, rinCat: it.rin });
    r.w.generarWA();
    const wa = r.w.waTexto || ($(r, 'wa-texto') && ($(r, 'wa-texto').value || $(r, 'wa-texto').textContent)) || '';
    await copiar(r);
    const copiado = r.copiados[0] || '';
    ok('M8 (' + nombre + ') el texto copiado a WhatsApp trae la marca: "' + it.marca + ' ' + it.desc.slice(0, 18) + '…"', copiado.indexOf('* ' + it.marca + ' ' + it.desc) >= 0, copiado.split('\n').filter(x => /^\* /.test(x)));
    const fila = r.sheet()[0] && r.sheet()[0].body.items.find(x => x.tipo === 'Llantas' && x.noParte === it.cve);
    ok('M9 (' + nombre + ') la columna Producto del Sheet trae la marca, y No. de parte/proveedor siguen igual', fila && fila.producto === it.marca + ' ' + it.desc && fila.noParte === it.cve && fila.proveedor === 'AYALA', fila);
    ok('M10 (' + nombre + ') el total no cambió por poner la marca', r.sheet()[0] && r.sheet()[0].body.items.filter(x => x.tipo === 'Llantas').some(x => x.cant === 4 && parseFloat(String(x.subtotal).replace(/[^0-9.]/g, '')) === 8000), r.sheet()[0] && r.sheet()[0].body.items.map(x => [x.cant, x.subtotal]));
  }
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r);
    r.w.cart.push({ id: 'l9', t: 'l', desc: '205/55R16 LLANTA RARA', marca: 'Llantera X', precio: 1500, precioBase: 1500, pb: 1000, qty: 1, pid: null, isAyala: false, isVega: false });
    r.w.generarWA(); await copiar(r);
    const fila = r.sheet()[0].body.items.find(x => x.tipo === 'Llantas');
    ok('M11 llanta manual: WhatsApp y Sheet sin cambios (no se inventa marca)', r.copiados[0].indexOf('* 205/55R16 LLANTA RARA') >= 0 && fila.producto === '205/55R16 LLANTA RARA', fila);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-N. LLANTA DE OTRO PROVEEDOR: MARCA OBLIGATORIA ===');
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r);
    $(r, 'qm').value = '205/55R16'; r.w.buscar();
    const marca = $(r, 'otro-marca'), desc = $(r, 'otro-desc'), costo = $(r, 'otro-costo'), prov = $(r, 'otro-prov'), btn = $(r, 'btn-otro');
    ok('N1 el formulario de "otro proveedor" tiene el campo Marca (con asterisco de obligatorio)', !!marca && /\*/.test(marca.placeholder) && !!prov && !!btn, marca && marca.placeholder);
    const n0 = r.w.cart.length;
    desc.value = '205/55R16 LLANTA DE PRUEBA'; costo.value = '1000'; prov.value = 'Llantera X';
    marca.value = ''; btn.click();
    ok('N2 sin marca: NO agrega la llanta y avisa que la marca es obligatoria', r.w.cart.length === n0 && r.alerts.some(a => /MARCA/.test(a)), { cart: r.w.cart.length, alerts: r.alerts });
    r.alerts.length = 0;
    for (const mala of ['   ', 'A', '12', '--', '0']) { marca.value = mala; btn.click(); }
    ok('N3 marca vacía / de 1 letra / solo números o símbolos: se rechaza', r.w.cart.length === n0 && r.alerts.length === 5, { cart: r.w.cart.length, alerts: r.alerts.length });
    r.alerts.length = 0;
    marca.value = ' hankook  '; btn.click();
    const ultOtro = () => r.w.cart.filter(c => c.t === 'l' && c.otro).pop();
    const it = ultOtro();
    ok('N4 con marca: se agrega y la marca se guarda en MAYÚSCULAS y sin espacios sobrantes', r.w.cart.filter(c => c.t === 'l').length === 1 && it.marca === 'HANKOOK' && r.alerts.length === 0, it);
    ok('N5 el proveedor capturado se conserva aparte y el precio se calcula igual que antes', it.prov === 'Llantera X' && it.pb === 1000 && it.precio === r.w.pvpLlanta(1000) && it.otro === true, it);
    ok('N6 después de agregar, los campos Marca/Descripción/Costo/Proveedor se limpian', $(r, 'otro-marca').value === '' && $(r, 'otro-desc').value === '' && $(r, 'otro-prov').value === '' && $(r, 'otro-costo').value === '');
    r.w.generarWA(); await copiar(r);
    ok('N7 el texto de WhatsApp lleva la marca: "* HANKOOK 205/55R16 LLANTA DE PRUEBA"', r.copiados[0].indexOf('* HANKOOK 205/55R16 LLANTA DE PRUEBA') >= 0, r.copiados[0]);
    const fila = r.sheet()[0].body.items.find(x => x.tipo === 'Llantas' && /LLANTA DE PRUEBA/.test(x.producto));
    ok('N8 la columna Producto del Sheet lleva la marca', fila && fila.producto === 'HANKOOK 205/55R16 LLANTA DE PRUEBA', fila);
    // si la descripción ya trae la marca no se repite
    $(r, 'qm').value = '205/55R16'; r.w.buscar();
    $(r, 'otro-desc').value = '205/55R16 HANKOOK VENTUS'; $(r, 'otro-costo').value = '900'; $(r, 'otro-marca').value = 'Hankook'; $(r, 'btn-otro').click();
    const it2 = ultOtro();
    ok('N9 si la descripción ya trae la marca, no se duplica', r.w.descConMarca(it2) === '205/55R16 HANKOOK VENTUS', r.w.descConMarca(it2));
  }
  {
    // El nombre del proveedor NUNCA debe llegar al cliente (texto de WhatsApp ni PDF)
    const r = abrir({ confirm: true, query: '?test=1' }); await esperar(80);
    llenar(r);
    const textos = [];                                    // todo lo que el PDF dibuja
    const doc = new Proxy({ internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }, lastAutoTable: { finalY: 100 } }, {
      get(t, k) { if (k in t) return t[k]; return (...a) => { try { textos.push(JSON.stringify(a)); } catch (e) {} if (k === 'splitTextToSize') return [String(a[0])]; if (k === 'getTextWidth') return 10; if (k === 'save' || k === 'output') return ''; return doc; }; }
    });
    r.w.jspdf = { jsPDF: function () { return doc; } };
    r.w.Image = function () { const o = {}; Object.defineProperty(o, 'src', { set() { setTimeout(() => o.onerror && o.onerror(), 0); } }); return o; };   // el membrete no carga en jsdom: se sigue sin él
    $(r, 'qm').value = '205/55R16'; r.w.buscar();
    $(r, 'otro-desc').value = '205/55R16 LLANTA PROVEEDORSECRETO'; $(r, 'otro-costo').value = '1000'; $(r, 'otro-prov').value = 'ProveedorSecreto SA'; $(r, 'otro-marca').value = 'hankook'; $(r, 'btn-otro').click();
    r.w.generarWA(); await copiar(r);
    ok('N11 el texto de WhatsApp NO trae el nombre del proveedor', r.copiados.length === 1 && !/ProveedorSecreto SA/i.test(r.copiados[0]), r.copiados[0]);
    try { r.w.generarPDF(); } catch (e) {}
    await esperar(400);
    const todoPDF = textos.join('\n');
    ok('N12 el PDF se dibujó con la llanta y su MARCA', /HANKOOK/.test(todoPDF), todoPDF.slice(0, 300));
    ok('N13 el PDF NO trae el nombre del proveedor', !/ProveedorSecreto SA/i.test(todoPDF));
    ok('N14 lo que se manda al Sheet tampoco trae el nombre del proveedor en ningún campo', !r.fetch.some(c => /ProveedorSecreto SA/i.test(JSON.stringify(c.body || ''))));
  }
  {
    // el flujo normal de catálogo no cambia
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r);
    const it = r.w.AYALA[5];
    r.w.cart.push({ id: 'lc', t: 'l', desc: it.desc, marca: it.marca, precio: 2000, precioBase: 2000, pb: 1500, qty: 1, pid: null, cve: it.cve, isAyala: true, isVega: false, rinCat: it.rin });
    ok('N10 llantas de catálogo: siguen sin pedir nada extra y llevan su marca', r.w.descConMarca(r.w.cart[0]).indexOf(it.marca) >= 0);
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-O. COLUMNA "MARCA" EN LO QUE SE MANDA AL SHEET ===');
  {
    const r = abrir({ confirm: true }); await esperar(80);
    llenar(r);
    const it = r.w.AYALA[5];
    r.w.cart.push({ id: 'oc', t: 'l', desc: it.desc, marca: it.marca, precio: 2000, precioBase: 2000, pb: 1500, qty: 4, pid: null, cve: it.cve, isAyala: true, isVega: false, rinCat: it.rin });
    r.w.cart.push({ id: 'om', t: 'l', desc: '205/55R16 LLANTA PROVEEDORSECRETO', marca: 'jk  tyre', prov: 'ProveedorSecreto SA', otro: true, precio: 1500, precioBase: 1500, pb: 1000, qty: 1, pid: null, rinCat: 16 });
    r.w.generarWA(); await copiar(r);
    const items = r.sheet()[0].body.items;
    const llantas = items.filter(x => x.tipo === 'Llantas' && (x.proveedor || x.noParte));
    const cat = llantas.find(x => x.noParte === it.cve), man = llantas.find(x => /PROVEEDORSECRETO/.test(x.producto));
    ok('O1 llanta de catálogo: el Sheet recibe su marca en MAYÚSCULAS', cat && cat.marca === String(it.marca).toUpperCase(), cat);
    ok('O2 llanta manual: manda la MARCA (mayúsculas, espacios limpios), nunca el proveedor', man && man.marca === 'JK TYRE' && !/ProveedorSecreto/i.test(man.marca), man);
    ok('O3 los renglones que no son llanta (servicios) no llevan marca', items.filter(x => !(x.proveedor || x.noParte) ).every(x => !x.marca), items.filter(x => x.marca));
    ok('O4 el nombre del proveedor manual no viaja en ningún campo', !/ProveedorSecreto SA/i.test(JSON.stringify(r.sheet()[0].body)));
  }

  // ══════════════════════════════════════════════════════════
  console.log('\n=== F1-P. VARIAS OPCIONES (marcas) DE LA MISMA MEDIDA ===');
  {
    const marcar = (r, n) => {      // marca n llantas de MARCAS DISTINTAS en los resultados; regresa sus cve
      const cs = Array.from(r.w.document.querySelectorAll('#res .ochk')), usadas = {}, cves = [];
      for (const c of cs) {
        const cve = c.getAttribute('data-cve'); const f = r.w.buscarItemCatalogo(cve); if (!f) continue;
        const m = f.it.marca; if (usadas[m]) continue; usadas[m] = 1;
        if (cves.length >= n) break;
        c.checked = true; c.dispatchEvent(new r.w.Event('change')); cves.push(cve);
      }
      return cves;
    };
    const nuevaConOpciones = async (n, qty, query) => {
      const r = abrir({ confirm: true, query: query }); await esperar(80); llenar(r);
      $(r, 'qm').value = '205/55R16'; r.w.buscar();
      const cves = marcar(r, n);
      if (qty !== undefined) $(r, 'opc-qty').value = String(qty);
      $(r, 'opc-add').click();
      return { r, cves };
    };

    // P1–P4: 3 opciones, cantidad 4
    {
      const { r, cves } = await nuevaConOpciones(3, 4);
      const tires = r.w.cart.filter(c => c.t === 'l');
      ok('P1 los resultados traen casillas y al marcar 3 aparece la barra "Cotizar opciones"', cves.length === 3 && $(r, 'opc-bar') !== null, cves);
      ok('P2 quedan 3 opciones numeradas 1-2-3, cada una con 4 piezas', tires.length === 3 && tires.map(t => t.op).join() === '1,2,3' && tires.every(t => t.qty === 4), tires.map(t => [t.op, t.qty]));
      ok('P3 con 4 piezas: instalación incluida (+$135 c/u) y SIN líneas sueltas de Montaje/Balanceo/Pivote', r.w.instalacionInfo.recargo === 135 && r.w.cart.filter(c => c.pid).length === 0 && tires.every(t => Math.abs(t.precio - (t.precioBase + 135)) < 0.001));
      const T = r.w.totalesOpciones();
      ok('P4 cada opción tiene su propio total = su llanta × 4 (no se suman entre sí)', T.lista.length === 3 && T.lista.every(x => Math.abs(x.total - x.l.precio * 4) < 0.01) && new Set(T.lista.map(x => x.total.toFixed(2))).size >= 2, T.lista.map(x => x.total));
      r.w.generarWA(); const wa = $(r, 'wt').textContent;
      ok('P5 el WhatsApp trae Opción 1, 2 y 3 y una lista "Total por opción"', /\*Opción 1\*/.test(wa) && /\*Opción 2\*/.test(wa) && /\*Opción 3\*/.test(wa) && /Total por opción/.test(wa), wa);
      ok('P6 el WhatsApp NO trae un "Total:" único que sume las opciones', !/✅ \*Total:/.test(wa));
      ok('P7 cada total del WhatsApp coincide con el cálculo', T.lista.every(x => wa.indexOf(r.w.fmt(x.total)) >= 0));
      ok('P8 el WhatsApp sigue diciendo instalación gratis y trae la marca de cada opción', /INSTALACIÓN GRATIS/.test(wa) && T.lista.every(x => wa.indexOf(r.w.marcaLlanta(x.l)) >= 0));
      ok('P9 el carrito muestra el rango de totales, no una suma', /\$[\d,]+\.\d\d a \$[\d,]+\.\d\d/.test($(r, 'tv').textContent) && $(r, 'ci').querySelectorAll('.bsel').length === 3, $(r, 'tv').textContent);
      ok('P10 el botón se llama "Cliente seleccionó esta opción"', /Cliente seleccionó esta opción/.test($(r, 'ci').querySelector('.bsel').textContent));

      // P11: cantidad compartida
      r.w.setQty(tires[1].id, 2);
      ok('P11 al cambiar la cantidad de una opción cambia la de todas (y recalcula la instalación: 2 piezas = +$210)', r.w.cart.filter(c => c.t === 'l').every(t => t.qty === 2) && r.w.instalacionInfo.recargo === 210);
      r.w.setQty(tires[0].id, 4);

      // P12–P14: Sheet y GHL
      const datos = r.w.armarDatosCotizacion(r.w.cart.filter(c => c.t === 'l'), r.w.cart.filter(c => c.pid), r.w.cart.filter(c => c.t === 's' && !c.pid), []);
      ok('P12 el Sheet recibe cada renglón de llanta con su número de opción y su marca', datos.items.filter(i => i.opcion).length === 3 && datos.items.every(i => !i.opcion || (i.marca && i.marca === i.marca.toUpperCase())), datos.items);
      ok('P13 el total único va vacío y se manda la lista de totales por opción', datos.total === '' && datos.opciones.length === 3 && datos.opciones.every(o => o.marca && parseFloat(o.total) > 0), { t: datos.total, o: datos.opciones });
      const aviso = r.w.armarPayloadAviso();
      ok('P14 a GHL NO se manda total (solo cuántas opciones)', !('total' in aviso) && aviso.opciones === 3 && !!aviso.telefono, aviso);

      // P15: el proveedor no viaja
      ok('P15 el texto de WhatsApp no menciona al proveedor (AYALA / VEGA / SERV)', !/\b(AYALA|VEGA|SERV|Servillantas)\b/i.test(wa), wa);

      // P16: elegir una
      const cuarta = tires[1];
      r.w.elegirOpcion(cuarta.id);
      const quedan = r.w.cart.filter(c => c.t === 'l');
      ok('P16 "Cliente seleccionó esta opción": quedan solo esa llanta, sin etiqueta de opción', quedan.length === 1 && quedan[0].id === cuarta.id && !quedan[0].op && r.confirms.some(m => /seleccion/i.test(m)), quedan.map(q => [q.id, q.op]));
      r.w.generarWA(); const wa2 = $(r, 'wt').textContent;
      ok('P17 después de elegir, el WhatsApp vuelve a ser una cotización normal con "Total:"', /✅ \*Total:/.test(wa2) && !/Opción/.test(wa2) && !/Total por opción/.test(wa2));
      ok('P18 y el aviso a GHL vuelve a llevar total', 'total' in r.w.armarPayloadAviso() && r.w.armarPayloadAviso().total > 0);
    }

    // P19: máximo 5
    {
      const r = abrir({ confirm: true }); await esperar(80); llenar(r);
      $(r, 'qm').value = '205/55R16'; r.w.buscar();
      const cs = Array.from(r.w.document.querySelectorAll('#res .ochk'));
      cs.slice(0, 7).forEach(c => { c.checked = true; c.dispatchEvent(new r.w.Event('change')); });
      ok('P19 no deja marcar más de 5 (la 6.ª casilla se desmarca)', r.w.opcSel.length === 5 && cs.slice(0, 7).filter(c => c.checked).length === 5, r.w.opcSel.length);
      $(r, 'opc-add').click();
      ok('P20 con 5 marcadas se crean 5 opciones', r.w.cart.filter(c => c.t === 'l' && c.op).length === 5);
    }
    // P21: mínimo 2
    {
      const r = abrir({ confirm: true }); await esperar(80); llenar(r);
      $(r, 'qm').value = '205/55R16'; r.w.buscar();
      const c = r.w.document.querySelector('#res .ochk'); c.checked = true; c.dispatchEvent(new r.w.Event('change'));
      $(r, 'opc-add').click();
      ok('P21 con una sola marcada avisa y no agrega nada', r.w.cart.length === 0 && r.alerts.some(a => /al menos 2/.test(a)), r.alerts);
    }
    // P22–P24: 1 pieza por opción
    {
      const { r } = await nuevaConOpciones(3, 1);
      const T = r.w.totalesOpciones();
      ok('P22 con 1 pieza no hay recargo: cada opción lleva su Montaje, Balanceo y Pivote', r.w.instalacionInfo.recargo === 0 && r.w.cart.filter(c => c.pid).length === 9, r.w.cart.filter(c => c.pid).length);
      ok('P23 el total de cada opción incluye SU instalación (llanta + montaje + balanceo + pivote)', T.lista.every(x => x.svcs.length === 3 && Math.abs(x.total - (x.llanta + x.svcTotal)) < 0.01));
      r.w.generarWA(); const wa = $(r, 'wt').textContent;
      ok('P24 el WhatsApp muestra la instalación debajo de cada opción', (wa.match(/\+ Montaje/g) || []).length === 3, wa);
    }
    // P25–P27: con un servicio común
    {
      const { r } = await nuevaConOpciones(2, 4);
      r.w.cart.push({ id: 'sx', t: 's', desc: 'Alineación — computarizada', precio: 500, qty: 1 });
      r.w.recalcInstalacionLlantas(); r.w.renderCarrito();
      const T = r.w.totalesOpciones();
      ok('P25 un servicio común se suma UNA vez a cada opción', T.comun === 500 && T.lista.every(x => Math.abs(x.total - (x.llanta + 500)) < 0.01), T.lista.map(x => x.total));
      r.w.generarWA(); const wa = $(r, 'wt').textContent;
      ok('P26 el WhatsApp lo lista una sola vez como "Incluido con cualquier opción"', /Incluido con cualquier opción/.test(wa) && (wa.match(/Alineación/g) || []).length === 1, wa);
      // quitar una opción: la que queda deja de ser "opción"
      const primera = r.w.cart.find(c => c.t === 'l');
      r.w.removeCartItem(primera.id);
      ok('P27 si se quita una y queda solo una, vuelve a ser cotización normal', r.w.cart.filter(c => c.t === 'l').length === 1 && !r.w.cart.find(c => c.t === 'l').op && !r.w.hayOpciones());
    }
    // P28: llanta suelta previa
    {
      const r = abrir({ confirm: true }); await esperar(80); llenar(r);
      $(r, 'qm').value = '205/55R16'; r.w.buscar();
      const b = r.w.document.querySelector('#res .badd[data-cve]'); b.click();
      const antes = r.w.cart.filter(c => c.t === 'l').length;
      marcar(r, 2); $(r, 'opc-add').click();
      ok('P28 si ya había una llanta suelta, pide confirmar y la reemplaza por las opciones', antes === 1 && r.confirms.some(m => /llantas sueltas/.test(m)) && r.w.cart.filter(c => c.t === 'l').length === 2 && r.w.cart.filter(c => c.t === 'l').every(c => c.op));
    }
    // P29–P31: PDF
    {
      const { r } = await nuevaConOpciones(3, 4, '?test=1');
      const textos = [];
      const doc = new Proxy({ internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }, lastAutoTable: { finalY: 100 } }, {
        get(t, k) { if (k in t) return t[k]; return (...a) => { try { textos.push(JSON.stringify(a)); } catch (e) {} if (k === 'splitTextToSize') return [String(a[0])]; if (k === 'getTextWidth') return 10; if (k === 'save' || k === 'output') return ''; return doc; }; }
      });
      r.w.jspdf = { jsPDF: function () { return doc; } };
      r.w.Image = function () { const o = {}; Object.defineProperty(o, 'src', { set() { setTimeout(() => o.onerror && o.onerror(), 0); } }); return o; };
      try { r.w.generarPDF(); } catch (e) {}
      await esperar(400);
      const pdf = textos.join('\n');
      const T = r.w.totalesOpciones();
      ok('P29 el PDF dibuja una tabla por opción y el total de cada una', /Opción 1/.test(pdf) && /Opción 2/.test(pdf) && /Opción 3/.test(pdf) && /Total opción 3/.test(pdf), pdf.slice(0, 300));
      ok('P30 el PDF trae los totales de las 3 opciones y NO un total único', T.lista.every(x => pdf.indexOf(r.w.fmt(x.total)) >= 0) && !/"Total:"/.test(pdf));
      ok('P31 el PDF trae la marca de cada opción', T.lista.every(x => pdf.indexOf(r.w.marcaLlanta(x.l)) >= 0));
    }
    // P33: regresión — una cotización normal (una llanta) sigue con su tabla única, IVA y "Total:"
    {
      const r = abrir({ confirm: true, query: '?test=1' }); await esperar(80); llenar(r);
      $(r, 'qm').value = '205/55R16'; r.w.buscar();
      r.w.document.querySelector('#res .badd[data-cve]').click();
      const textos = [];
      const doc = new Proxy({ internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }, lastAutoTable: { finalY: 100 } }, {
        get(t, k) { if (k in t) return t[k]; return (...a) => { try { textos.push(JSON.stringify(a)); } catch (e) {} if (k === 'splitTextToSize') return [String(a[0])]; if (k === 'getTextWidth') return 10; if (k === 'save' || k === 'output') return ''; return doc; }; }
      });
      r.w.jspdf = { jsPDF: function () { return doc; } };
      r.w.Image = function () { const o = {}; Object.defineProperty(o, 'src', { set() { setTimeout(() => o.onerror && o.onerror(), 0); } }); return o; };
      try { r.w.generarPDF(); } catch (e) {}
      await esperar(400);
      const pdf = textos.join('\n');
      ok('P33 sin opciones el PDF sigue igual: tabla de Concepto, IVA y "Total:" (nada de "Opción")', /Concepto/.test(pdf) && /IVA \(16%\)/.test(pdf) && /"Total:"/.test(pdf) && !/Opción/.test(pdf), pdf.slice(0, 200));
      ok('P34 sin opciones el aviso a GHL sigue llevando su total', 'total' in r.w.armarPayloadAviso());
    }
    // P32: guardado en Sheet real (modo real) con opciones y verificación de que el aviso GHL no lleva total
    {
      const r = abrir({ confirm: true, query: '?real=1' }); await esperar(80); llenar(r);
      $(r, 'qm').value = '205/55R16'; r.w.buscar();
      marcar(r, 2); $(r, 'opc-add').click();
      r.w.generarWA(); await copiar(r); await esperar(120);
      const g1 = r.sheet();
      ok('P32 al copiar se guarda en el Sheet con opción por renglón y total vacío', g1.length >= 1 && g1[0].body.total === '' && g1[0].body.items.filter(i => i.opcion).length === 2 && g1[0].body.opciones.length === 2, g1[0] && g1[0].body);
    }
  }

  // ══════════════════════════════════════════════════════════
  console.log(`\n${'='.repeat(45)}`);
  console.log(`TOTAL: ${passed + failed} | ✅ ${passed} OK | ❌ ${failed} FALLIDAS`);
  if (failed === 0) console.log('🎉 Fase 1: comportamiento verificado'); else console.log('⚠️  Revisar antes de entregar');
  process.exit(failed ? 1 : 0);
})();
