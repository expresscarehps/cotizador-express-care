// ── TEST — Borradores compartidos en Firebase (22 nov 2026) ──────────────────────────────
// Firestore simulado (compartido entre varias "computadoras" = ventanas jsdom con su propio navegador).
// Uso: node test_borradores_nube.js [html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', () => {});
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
const html = fs.readFileSync(HTML, 'utf8');
const BASE = 'https://expresscarehps.github.io/cotizador-express-care/';
const DEV = 'cotizador_dev.html', PROD = 'cotizador_express_care_valvoline.html';

// Firestore simulado: una colección por nombre; cada oyente recibe (docs, deCache)
function crearNube() {
  const cols = {}, oyentes = [];
  const col = n => (cols[n] = cols[n] || new Map());
  const snap = n => Array.from(col(n).entries()).map(([id, d]) => ({ id, data: JSON.parse(JSON.stringify(d)) }));
  const avisar = n => oyentes.filter(o => o.col === n && !o.parado).forEach(o => setTimeout(() => o.cb(snap(n), false), 0));
  const nube = { cols, col, snap, escrituras: [], borrados: [], deCacheVacio: false, falla: false,
    api() {
      return {
        borrEscuchar(c, cb, errcb) {
          if (nube.falla) { setTimeout(() => errcb({ code: 'permission-denied' }), 0); return () => {}; }
          const o = { col: c, cb, parado: false }; oyentes.push(o);
          setTimeout(() => cb(nube.deCacheVacio ? [] : snap(c), nube.deCacheVacio), 0);
          return () => { o.parado = true; };
        },
        borrGuardar(c, id, d) { nube.escrituras.push({ col: c, id }); col(c).set(id, JSON.parse(JSON.stringify(d))); avisar(c); return Promise.resolve(); },
        borrBorrar(c, id) { nube.borrados.push({ col: c, id }); col(c).delete(id); avisar(c); return Promise.resolve(); }
      };
    } };
  return nube;
}
const PERFIL = { correo: 'ana@expresscarecuu.com', nombre: 'Ana', rol: 'usuario' };
function abrir(archivo, query, precargados) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: BASE + archivo + (query || ''),
    beforeParse(w) {
      w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true;
      if (precargados) for (const k in precargados) w.localStorage.setItem(k, JSON.stringify(precargados[k]));
    } });
  return dom.window;
}
const toasts = w => Array.from(w.document.body.children).filter(e => e.tagName === 'DIV' && /Borradores: no se pudo sincronizar/.test(e.textContent)).length;
function llenar(w, nombre, precio, asesor) {
  const set = (id, v) => { w.document.getElementById(id).value = v; };
  set('cli-nombre', nombre); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', asesor || 'Ana');
  set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
  w.tallerItems = [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: String(precio), mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }];
  w.generarWA();
}
const local = (w, k) => JSON.parse(w.localStorage.getItem(k) || '[]');
function borrador(id, nombre, extra) {
  return Object.assign({ id, fecha: '20/11/2026 10:00', cliente: nombre, telefono: '6145550123', vehiculo: 'Nissan Sentra 2020', preview: 'Mano de obra prueba',
    cart: [], sact: [], tallerItems: [{ id: 't1', concepto: 'Mano de obra prueba', costo: '', margen: 30, precio: '500', mo: true, precioFijo: false, pend: false, opcional: false, qty: 2, conQty: true, descuento: 0, proveedor: '' }],
    tallerTipo: 'Taller - Afinación', pago: 'contado', rin: 'a', campos: { nombre, tel: '6145550123', vMarca: 'Nissan', vModelo: 'Sentra', vAnio: '2020', vCil: '4', vVersion: '', origen: 'WhatsApp', asesor: 'Xen', orden: '' } }, extra || {});
}
function docNube(b, actualizado) { return { id: b.id, cliente: b.cliente, telefono: b.telefono, vehiculo: b.vehiculo, preview: b.preview, asesor: 'Xen', fecha: b.fecha, actualizado, por: { correo: 'x@x.com', nombre: 'X' }, datos: JSON.stringify(b) }; }
const hoyISO = (dias) => new Date(Date.now() - 6 * 3600000 - (dias || 0) * 86400000).toISOString().slice(0, 19) + '-06:00';

(async () => {
  console.log('\n— A. Dev normal: los borradores se quedan en el navegador (nada a Firebase)');
  {
    const nube = crearNube(); const w = abrir(DEV, ''); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(30);
    ok('A1 en dev la nube está apagada', w.BORR_NUBE_ACTIVA === false);
    llenar(w, 'Cliente Dev', 500); w.guardarBorrador(); await esperar(30);
    ok('A2 el borrador queda en la lista local del dev', local(w, 'expresscare_borradores_dev').length === 1);
    ok('A3 no usa la lista de producción', w.localStorage.getItem('expresscare_borradores') === null);
    ok('A4 no se escribió nada en Firebase', nube.escrituras.length === 0 && nube.borrados.length === 0);
    ok('A5 el límite sigue en 10', w.MAX_BORRADORES === 10);
  }

  console.log('\n— B. Con ?test=1 nunca usa la nube (ni en producción)');
  {
    const nube = crearNube(); const w = abrir(PROD, '?test=1'); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(30);
    ok('B1 con ?test=1 la nube está apagada', w.BORR_NUBE_ACTIVA === false);
  }

  console.log('\n— C. Producción: usa la colección "borradores" y la llave de siempre');
  {
    const nube = crearNube(); const w = abrir(PROD, ''); await esperar(100);
    ok('C1 colección "borradores" y nube activa', w.BORR_COL === 'borradores' && w.BORR_NUBE_ACTIVA === true, [w.BORR_COL, w.BORR_NUBE_ACTIVA]);
    ok('C2 llave local de producción sin cambios', w.BORR_KEY === 'expresscare_borradores', w.BORR_KEY);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(30);
    ok('C3 conectada: el límite sube', w.MAX_BORRADORES === 200, w.MAX_BORRADORES);
    llenar(w, 'Cliente Prod', 500, 'Ana'); w.guardarBorrador(); await esperar(40);
    const d = nube.col('borradores');
    ok('C4 el borrador se subió a la nube', d.size === 1, d.size);
    const doc = Array.from(d.values())[0];
    ok('C5 trae cliente, asesor, quien lo guardó y fecha de cambio', doc.cliente === 'Cliente Prod' && doc.asesor === 'Ana' && doc.por.nombre === 'Ana' && /^\d{4}-\d{2}-\d{2}T/.test(doc.actualizado), doc);
    ok('C6 el contenido completo viaja en "datos"', JSON.parse(doc.datos).tallerItems[0].precio === '500');
  }

  console.log('\n— D. Dev con ?borradoresfb=1: usa la colección de PRUEBA');
  {
    const nube = crearNube(); const w = abrir(DEV, '?borradoresfb=1'); await esperar(100);
    ok('D1 nube activa con colección "borradores_prueba"', w.BORR_NUBE_ACTIVA === true && w.BORR_COL === 'borradores_prueba', [w.BORR_NUBE_ACTIVA, w.BORR_COL]);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(30);
    llenar(w, 'Prueba', 100); w.guardarBorrador(); await esperar(40);
    ok('D2 solo escribió en borradores_prueba', nube.col('borradores_prueba').size === 1 && nube.col('borradores').size === 0);
  }

  console.log('\n— E. Dos computadoras comparten los borradores');
  {
    const nube = crearNube();
    const w1 = abrir(PROD, ''); const w2 = abrir(PROD, ''); await esperar(100);
    w1.borrNubeConectar(nube.api(), PERFIL); w2.borrNubeConectar(nube.api(), { correo: 'xen@expresscarecuu.com', nombre: 'Xen', rol: 'usuario' }); await esperar(30);
    llenar(w1, 'Cliente Compartido', 500, 'Ana'); w1.guardarBorrador(); await esperar(60);
    ok('E1 la otra computadora ve el borrador', local(w2, 'expresscare_borradores').length === 1 && local(w2, 'expresscare_borradores')[0].cliente === 'Cliente Compartido', local(w2, 'expresscare_borradores').length);
    ok('E2 el panel de la otra computadora lo muestra con el asesor', /Cliente Compartido/.test(w2.document.getElementById('panel-borradores').innerHTML) && /Asesor: Ana/.test(w2.document.getElementById('panel-borradores').innerHTML));
    const id = local(w1, 'expresscare_borradores')[0].id;
    w2.cargarBorrador(id); llenar(w2, 'Cliente Compartido', 900, 'Xen'); w2.guardarBorrador(); await esperar(60);
    ok('E3 la otra lo edita y sigue siendo 1 borrador en la nube', nube.col('borradores').size === 1, nube.col('borradores').size);
    ok('E4 la primera computadora ve el cambio (precio 900)', local(w1, 'expresscare_borradores').length === 1 && local(w1, 'expresscare_borradores')[0].tallerItems[0].precio === '900', local(w1, 'expresscare_borradores'));
    w2.eliminarBorrador(id); await esperar(60);
    ok('E5 al eliminarlo en una, desaparece de la nube y de la otra', nube.col('borradores').size === 0 && local(w1, 'expresscare_borradores').length === 0, [nube.col('borradores').size, local(w1, 'expresscare_borradores').length]);
  }

  console.log('\n— F. Al usar el borrador (copiar/PDF) se quita de la nube');
  {
    const nube = crearNube(); const w = abrir(PROD, ''); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(30);
    llenar(w, 'Cliente Uso', 500); w.guardarBorrador(); await esperar(40);
    const id = local(w, 'expresscare_borradores')[0].id;
    w.cargarBorrador(id); w.consumirBorradorActivo(); await esperar(40);
    ok('F1 el borrador usado ya no está en la nube ni en la lista', nube.col('borradores').size === 0 && local(w, 'expresscare_borradores').length === 0);
  }

  console.log('\n— G. Importación de los borradores que ya estaban en el navegador');
  {
    const nube = crearNube();
    const viejos = [borrador('b1001', 'Viejo Uno'), borrador('b1002', 'Viejo Dos')];
    const w = abrir(PROD, '', { expresscare_borradores: viejos }); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(60);
    ok('G1 los 2 borradores viejos se subieron a la nube', nube.col('borradores').size === 2, nube.col('borradores').size);
    ok('G2 siguen en la lista local, sin duplicados', local(w, 'expresscare_borradores').length === 2, local(w, 'expresscare_borradores').length);
    const antes = nube.escrituras.length;
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(60);                     // se reconecta (otra sesión)
    ok('G3 al reconectar no se vuelven a subir ni se duplican', nube.escrituras.length === antes && nube.col('borradores').size === 2, [nube.escrituras.length, antes]);
    // otra computadora con los mismos borradores locales viejos: no debe duplicar los que ya están en la nube
    const w2 = abrir(PROD, '', { expresscare_borradores: viejos }); await esperar(100);
    w2.borrNubeConectar(nube.api(), { correo: 'xen@expresscarecuu.com', nombre: 'Xen', rol: 'usuario' }); await esperar(60);
    ok('G4 una segunda computadora con los mismos borradores viejos no duplica', nube.col('borradores').size === 2 && local(w2, 'expresscare_borradores').length === 2, [nube.col('borradores').size, local(w2, 'expresscare_borradores').length]);
  }

  console.log('\n— H. Un borrador borrado en otra computadora no "revive" desde el navegador viejo');
  {
    const nube = crearNube();
    const w1 = abrir(PROD, ''); const w2 = abrir(PROD, ''); await esperar(100);
    w1.borrNubeConectar(nube.api(), PERFIL); w2.borrNubeConectar(nube.api(), PERFIL); await esperar(30);
    llenar(w1, 'Efímero', 500); w1.guardarBorrador(); await esperar(60);
    const id = local(w1, 'expresscare_borradores')[0].id;
    w2.eliminarBorrador(id); await esperar(60);
    w1.borrNubeConectar(nube.api(), PERFIL); await esperar(60);                    // la primera reinicia sesión
    ok('H1 no reaparece', nube.col('borradores').size === 0 && local(w1, 'expresscare_borradores').length === 0, [nube.col('borradores').size, local(w1, 'expresscare_borradores').length]);
  }

  console.log('\n— I. Caducidad: 30 días sin cambios se borra solo');
  {
    const nube = crearNube(); const viejo = borrador('b2001', 'Muy Viejo'), nuevo = borrador('b2002', 'Reciente');
    nube.col('borradores').set('b2001', docNube(viejo, hoyISO(31))); nube.col('borradores').set('b2002', docNube(nuevo, hoyISO(29)));
    const w = abrir(PROD, ''); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(80);
    ok('I1 el de 31 días se borró de la nube', !nube.col('borradores').has('b2001') && nube.col('borradores').has('b2002'), Array.from(nube.col('borradores').keys()));
    ok('I2 en pantalla solo queda el reciente', local(w, 'expresscare_borradores').length === 1 && local(w, 'expresscare_borradores')[0].cliente === 'Reciente', local(w, 'expresscare_borradores').map(b => b.cliente));
  }

  console.log('\n— J. Datos del caché (sin confirmar con el servidor) no borran ni suben nada');
  {
    const nube = crearNube(); nube.deCacheVacio = true;
    const w = abrir(PROD, '', { expresscare_borradores: [borrador('b3001', 'Local Cache')], expresscare_borradores_nube: { b3001: 1 } }); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(60);
    ok('J1 con caché vacío el borrador conocido NO se pierde', local(w, 'expresscare_borradores').length === 1, local(w, 'expresscare_borradores').length);
    ok('J2 ni se sube ni se borra nada todavía', nube.escrituras.length === 0 && nube.borrados.length === 0);
  }

  console.log('\n— K. Sin permiso en Firebase: todo sigue funcionando en el navegador y avisa una vez');
  {
    const nube = crearNube(); nube.falla = true; const w = abrir(PROD, ''); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(60);
    ok('K1 la nube se apaga y el límite vuelve a 10', w.BORR_API === null && w.MAX_BORRADORES === 10, [w.BORR_API, w.MAX_BORRADORES]);
    llenar(w, 'Sin Permiso', 500); w.guardarBorrador(); await esperar(30);
    ok('K2 el borrador se guarda en el navegador', local(w, 'expresscare_borradores').length === 1);
    ok('K3 avisó al asesor (una sola vez)', toasts(w) === 1, toasts(w));
  }

  console.log('\n— L. Más de 10 borradores: en la nube se conservan todos, sin nube se recorta a 10');
  {
    const nube = crearNube(); const w = abrir(PROD, ''); await esperar(100);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(30);
    for (let i = 1; i <= 12; i++) { llenar(w, 'Cliente ' + i, 100 + i); w.guardarBorrador(); await esperar(5); }
    await esperar(80);
    ok('L1 12 borradores en la nube', nube.col('borradores').size === 12, nube.col('borradores').size);
    ok('L2 12 en la lista local', local(w, 'expresscare_borradores').length === 12, local(w, 'expresscare_borradores').length);
    ok('L3 el más reciente va primero', local(w, 'expresscare_borradores')[0].cliente === 'Cliente 12', local(w, 'expresscare_borradores')[0].cliente);
    const w2 = abrir(PROD, ''); await esperar(100);
    for (let i = 1; i <= 12; i++) { llenar(w2, 'Local ' + i, 100 + i); w2.guardarBorrador(); await esperar(2); }
    ok('L4 sin conexión a la nube solo caben 10', local(w2, 'expresscare_borradores').length === 10, local(w2, 'expresscare_borradores').length);
  }

  console.log('\n— M. Un borrador guardado antes de conectarse se sube al conectar');
  {
    const nube = crearNube(); const w = abrir(PROD, ''); await esperar(100);
    llenar(w, 'Antes de conectar', 500); w.guardarBorrador(); await esperar(20);
    ok('M1 sin conexión se guarda local', local(w, 'expresscare_borradores').length === 1 && nube.col('borradores').size === 0);
    w.borrNubeConectar(nube.api(), PERFIL); await esperar(80);
    ok('M2 al conectarse se sube y no se duplica', nube.col('borradores').size === 1 && local(w, 'expresscare_borradores').length === 1, [nube.col('borradores').size, local(w, 'expresscare_borradores').length]);
  }

  console.log('\n' + (failed ? '❌' : '✅') + ' ' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
