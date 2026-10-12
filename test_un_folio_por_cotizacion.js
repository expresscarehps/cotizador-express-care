// ── TEST — Un folio = UNA cotización (12 oct 2026) ──
// Regla de Carlos: al generar el PDF el folio ya se usó. Si la cotización cambia aunque sea una pieza, es cotización NUEVA
// (folio nuevo y Grupo nuevo). Un borrador cargado empieza limpio. La Ref se ve en el Historial. Uso: node test_un_folio_por_cotizacion.js [html]
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', () => {});

let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(failed ? 1 : 0); }
const html = fs.readFileSync(HTML, 'utf8');
function abrir(query, opc) {
  const reg = { fetch: [], alerts: [], scripts: [], pdfs: [], refs: {}, folios: {}, modo: 'respuesta', confirmaciones: [] };
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html' + (query || ''),
    beforeParse(w) {
      w.fetch = (u, o) => { let b = null; try { b = o && o.body ? JSON.parse(o.body) : null; } catch (e) { b = o && o.body; } reg.fetch.push({ u: String(u), body: b }); return Promise.resolve({ json: () => ({ status: 'ok' }), text: () => '' }); };
      w.alert = m => reg.alerts.push(String(m)); w.confirm = m => { reg.confirmaciones.push(String(m)); return true; }; w.document.execCommand = () => true;
      w.navigator.clipboard = { writeText: () => Promise.resolve() };
    } });
  const w = dom.window; reg.w = w;
  const orig = w.document.body.appendChild.bind(w.document.body);
  w.document.body.appendChild = function (el) {
    if (el && el.tagName === 'SCRIPT' && /script\.google\.com/.test(el.src || '')) {
      const u = new URL(el.src); const accion = u.searchParams.get('action'); const cb = u.searchParams.get('callback'); const ref = u.searchParams.get('ref');
      reg.scripts.push({ accion, ref });
      setTimeout(() => {
        if (accion === 'refExiste') {
          if (reg.modo === 'error') el.onerror && el.onerror();
          else { const i = reg.refs[ref]; w[cb] && w[cb](i ? Object.assign({ status: 'ok', found: true, folio: '', version: 1, fecha: '09/10/2026 13:04', asesor: 'Xen', cliente: 'X' }, i) : { status: 'ok', found: false, folio: '' }); }
        } else if (accion === 'refFolio') {
          if (reg.modo === 'error') el.onerror && el.onerror();
          else { const f = reg.folios[ref] || (reg.refs[ref] && reg.refs[ref].folio); w[cb] && w[cb]({ status: 'ok', found: !!f, folio: f || '' }); }
        } else if (accion === 'getFolio') { const n = (reg.sigFolio = (reg.sigFolio || 12)); reg.sigFolio++; w[cb] && w[cb]({ status: 'ok', folio: 'EXPCARE-0' + n + '/26', numero: n }); }
        else if (accion === 'commitFolio') w[cb] && w[cb]({ status: 'ok' });
      }, 5);
      return el;
    }
    return orig(el);
  };
  if (!(opc && opc.pdfReal)) w.construirYDescargarPDF = function (folio) { reg.pdfs.push(folio); };   // pdfReal: deja el envoltorio del respaldo en Firebase
  return reg;
}
const $ = (r, id) => r.w.document.getElementById(id);
function llenar(r) {
  const set = (id, v) => { $(r, id).value = v; };
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6140000000'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
}
function conProducto(r, precio) {
  r.w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio || 550), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  r.w.generarWA();
}
const guardados = r => r.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
const acciones = r => r.scripts.map(s => s.accion);


const folios = r => guardados(r).map(c => c.body.folio);
function cambiarPrecio(r, precio) { conProducto(r, precio); }
(async () => {
  console.log('\n=== UF-1. PDF, luego cambio una pieza y PDF otra vez: folio NUEVO ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(300);
    const grupo1 = guardados(r)[0].body.grupo, ref1 = r.w.refVigente;
    ok('F1 el primer PDF sale con el folio 012', r.pdfs[0] === 'EXPCARE-012/26', r.pdfs);
    r.folios[ref1] = 'EXPCARE-012/26';   // así lo vería el servidor después de guardar
    cambiarPrecio(r, 600);
    r.w.generarPDF(); await esperar(300);
    ok('F2 con un cambio, el segundo PDF sale con folio NUEVO (013), no con el 012', r.pdfs.length === 2 && r.pdfs[1] === 'EXPCARE-013/26', r.pdfs);
    ok('F3 se guardaron dos cotizaciones con folios distintos (012 y 013)', JSON.stringify(folios(r)) === JSON.stringify(['EXPCARE-012/26', 'EXPCARE-013/26']), folios(r));
    ok('F4 la segunda es un Grupo NUEVO, versión 1 (la primera no se marca como no vigente)', guardados(r)[1].body.grupo === r.w.refVigente && guardados(r)[1].body.grupo !== grupo1 && guardados(r)[1].body.version === 1, [guardados(r)[1].body.grupo, grupo1, guardados(r)[1].body.version]);
    ok('F5 sin avisos de "repetida" (son cotizaciones distintas)', r.alerts.length === 0, r.alerts);
  }
  console.log('\n=== UF-2. El mismo PDF dos veces en la misma sesión: mismo folio, un solo guardado ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(300);
    r.w.generarPDF(); await esperar(300);
    ok('F6 los dos PDFs llevan el 012 y solo se guardó una vez', r.pdfs.length === 2 && r.pdfs[0] === r.pdfs[1] && r.pdfs[0] === 'EXPCARE-012/26' && guardados(r).length === 1, [r.pdfs, guardados(r).length]);
  }
  console.log('\n=== UF-3. PDF, cambio, COPIAR por WhatsApp y luego PDF: no hereda el folio viejo ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(300);
    r.folios[r.w.refVigente] = 'EXPCARE-012/26';
    const g1 = guardados(r)[0].body.grupo;
    cambiarPrecio(r, 600);
    r.w.copiar(); await esperar(300);
    const copia = guardados(r)[1].body;
    ok('F7 la copia es un Grupo nuevo, versión 1, sin folio', copia.folio === '' && copia.grupo === r.w.refVigente && copia.grupo !== g1 && copia.version === 1, [copia.folio, copia.grupo, g1, copia.version]);
    r.w.generarPDF(); await esperar(300);
    ok('F8 el PDF de esa cotización cambiada sale con folio 013 (no el 012)', r.pdfs[1] === 'EXPCARE-013/26', r.pdfs);
    const v2 = guardados(r)[2].body;
    ok('F9 queda como versión 2 con folio dentro de su propio Grupo (copia + PDF)', v2.folio === 'EXPCARE-013/26' && v2.grupo === copia.grupo && v2.version === 2, [v2.folio, v2.grupo, v2.version]);
  }
  console.log('\n=== UF-4. Volver a armar EXACTAMENTE la cotización ya emitida: avisa y reutiliza SU folio ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(300);
    const refOriginal = r.w.refVigente; r.folios[refOriginal] = 'EXPCARE-012/26';
    cambiarPrecio(r, 600); r.w.generarPDF(); await esperar(300);
    cambiarPrecio(r, 550);   // vuelve al contenido original
    ok('F10 el contenido original da la misma Ref', r.w.refVigente === refOriginal, [r.w.refVigente, refOriginal]);
    r.w.generarPDF(); await esperar(300);
    ok('F11 avisa "Cotización repetida" con el folio 012 y no crea un 014', r.alerts.length === 1 && /Cotización repetida/.test(r.alerts[0]) && /EXPCARE-012\/26/.test(r.alerts[0]) && r.pdfs[2] === 'EXPCARE-012/26', [r.alerts, r.pdfs]);
    ok('F12 no se guardó ningún renglón nuevo', guardados(r).length === 2, guardados(r).length);
  }
  console.log('\n=== UF-5. Copiar y luego PDF de lo MISMO sigue siendo versión 2 del mismo Grupo (como antes) ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.copiar(); await esperar(250);
    r.w.generarPDF(); await esperar(300);
    const [a, b] = guardados(r).map(c => c.body);
    ok('F13 copia v1 sin folio y PDF v2 con folio, mismo Grupo y misma Ref', a.version === 1 && b.version === 2 && a.grupo === b.grupo && a.ref === b.ref && b.folio === 'EXPCARE-012/26', [a.version, b.version, a.grupo, b.grupo]);
  }
  console.log('\n=== UF-6. Borrador cargado = cotización nueva: no hereda folio ni Grupo ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 700);
    r.w.guardarBorrador();                       // borrador de 700
    const id = JSON.parse(r.w.localStorage.getItem('expresscare_borradores'))[0].id;
    llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(300);        // la cotización en pantalla recibe el folio 012
    ok('F14 la de 550 salió con el 012', r.pdfs[0] === 'EXPCARE-012/26', r.pdfs);
    r.w.cargarBorrador(id);                      // SIN presionar "Nueva cotización"
    ok('F15 al cargar el borrador se olvida el folio, el Grupo y la versión', r.w.folioActual === null && r.w.grupoRef === null && r.w.versionGuardada === 0 && r.w.guardadoInfo.ref === '', [r.w.folioActual, r.w.grupoRef, r.w.versionGuardada]);
    r.w.generarPDF(); await esperar(300);
    ok('F16 el PDF del borrador sale con folio NUEVO (013), no con el 012', r.pdfs[1] === 'EXPCARE-013/26', r.pdfs);
    const g = guardados(r);
    ok('F17 queda en su propio Grupo, versión 1', g[1].body.version === 1 && g[1].body.grupo !== g[0].body.grupo, [g[1].body.version, g[1].body.grupo, g[0].body.grupo]);
  }
  console.log('\n=== UF-7. "Nueva cotización" olvida el folio emitido ===');
  {
    const r = abrir(); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(300);
    r.w.limpiarTodo(true);
    ok('F18 después de limpiar no queda folio emitido', r.w.folioActual === null && r.w.refDelFolio === '', [r.w.folioActual, r.w.refDelFolio]);
  }
  console.log('\n=== UF-8. Modo de prueba (?test=1) también respeta la regla, sin tocar el Sheet ===');
  {
    const r = abrir('?test=1'); await esperar(80); llenar(r); conProducto(r, 550);
    r.w.generarPDF(); await esperar(200);
    const f1 = r.pdfs[0]; cambiarPrecio(r, 600);
    r.w.generarPDF(); await esperar(200);
    ok('F19 en modo prueba el segundo PDF (con cambio) usa otro folio de prueba', r.pdfs.length === 2 && r.pdfs[0] !== r.pdfs[1] && /^PRUEBA-/.test(r.pdfs[1]), r.pdfs);
    ok('F20 en modo prueba no se guarda nada en el Sheet ni se pide folio real', guardados(r).length === 0 && !acciones(r).includes('getFolio'), [guardados(r).length, acciones(r)]);
  }
  console.log('\n=== UF-9. La Ref llega al respaldo del Historial (Firebase) ===');
  {
    const r = abrir('', { pdfReal: true }); await esperar(80); llenar(r); conProducto(r, 550);
    const escritos = [];
    r.w.__fb._t.setEstado({ escribir: (id, d) => { escritos.push(d); return Promise.resolve(); } }, { uid: 'u1' });
    r.w.copiar(); await esperar(300);
    ok('F21 la copia de WhatsApp (sin folio) se respalda con su Ref', escritos.length === 1 && escritos[0].folio === '' && escritos[0].ref === r.w.refVigente && /^\d{4}-[A-Z0-9]{5}$/.test(escritos[0].ref), escritos);
    r.w.generarPDF(); await esperar(300);
    ok('F22 el PDF se respalda con folio y con la misma Ref', escritos.length === 2 && escritos[1].folio === 'EXPCARE-012/26' && escritos[1].ref === escritos[0].ref, escritos);
    r.w.__fb._t.setCache([{ cliente: 'Carlos', vehiculo: 'x', folio: '', ref: '1011-RAHAG', asesor: 'a', telefono: '6144888591', total: 100, fecha: '2026-10-11T21:39:00', partidas: [] }]);
    ok('F23 el buscador del Historial encuentra por Ref', r.w.__fb.filtrar([{ cliente: 'Carlos', vehiculo: 'x', folio: '', ref: '1011-RAHAG', asesor: 'a', telefono: '' }], '1011-rahag').length === 1);
  }
  console.log('\n=== UF-10. El Historial MUESTRA la Ref cuando no hay folio ===');
  {
    const r = abrir('?test=1'); await esperar(80); const t = r.w.__fb._t;
    t.setCache([
      { cliente: 'Carlos Martínez', vehiculo: 'v', folio: '', ref: '1011-RAHAG', asesor: 'casdas', telefono: '6144888591', total: 6807, fecha: '2026-10-11T21:39:00-06:00', partidas: [] },
      { cliente: 'Carlos Martínez', vehiculo: 'v', folio: 'EXPCARE-012/26', ref: '1011-HTP6B', asesor: 'casdas', telefono: '6144888591', total: 8776, fecha: '2026-10-11T21:32:00-06:00', partidas: [] }]);
    t.setEstado({ escuchar: () => () => {} }, { uid: 'u', email: 'a@b.c', nombre: 'n', rol: 'admin' });
    const q = r.w.document.querySelector('#p-historial input[type=search]'); if (q) { q.value = ''; q.dispatchEvent(new r.w.Event('input', { bubbles: true })); }
    const txt = r.w.document.getElementById('p-historial').textContent;
    ok('F24 la copia de WhatsApp muestra su Ref en el Historial', /1011-RAHAG/.test(txt), txt.slice(0, 200));
    ok('F25 la que tiene folio muestra el folio (y no repite la Ref)', /EXPCARE-012\/26/.test(txt) && !/1011-HTP6B/.test(txt), txt.slice(0, 200));
  }
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
