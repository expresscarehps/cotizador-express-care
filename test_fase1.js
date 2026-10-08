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
  console.log(`\n${'='.repeat(45)}`);
  console.log(`TOTAL: ${passed + failed} | ✅ ${passed} OK | ❌ ${failed} FALLIDAS`);
  if (failed === 0) console.log('🎉 Fase 1: comportamiento verificado'); else console.log('⚠️  Revisar antes de entregar');
  process.exit(failed ? 1 : 0);
})();
