// ── TEST — Pestaña «Pendientes» de WhatsApp (23 nov 2026) ───────────────────────────────────────────────
// Solo lectura: n8n escribe pendientes/actual (pendientes_prueba/actual en dev); la pestaña lo pinta, con numerito y semáforo.
// Uso:  node test_pendientes.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
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
const AHORA_ISO = '2026-11-23T10:00:00-06:00';             // lunes 10:00 hora de Chihuahua
const NOW = Date.parse(AHORA_ISO);
const MIN = 60000, HORA = 3600000;
function abrir(ahoraIso, query) {
  const q = query !== undefined ? query : '?test=1' + (ahoraIso ? '&ahora=' + encodeURIComponent(ahoraIso) : '');
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: BASE + 'cotizador_dev.html' + q,
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
  // Cuenta los intervalos que quedan abiertos
  w.__ints = new Set(); const si = w.setInterval, ci = w.clearInterval;
  w.setInterval = function () { const id = si.apply(w, arguments); w.__ints.add(id); return id; };
  w.clearInterval = function (id) { w.__ints.delete(id); return ci.call(w, id); };
  return w;
}
// Firestore simulado: una sola lectura (pendEscuchar); lleva la cuenta de lecturas abiertas y cerradas
function nube(doc) {
  const n = { abiertas: 0, activas: 0, cols: [], ids: [], cbs: [], falla: null, doc };
  n.api = {
    pendEscuchar(col, id, cb, errcb) {
      n.abiertas++; n.activas++; n.cols.push(col); n.ids.push(id);
      const o = { cb, parado: false }; n.cbs.push(o);
      if (n.falla) setTimeout(() => errcb(n.falla), 0); else setTimeout(() => cb(n.doc === undefined ? null : JSON.parse(JSON.stringify(n.doc))), 0);
      return () => { if (!o.parado) { o.parado = true; n.activas--; } };
    }
  };
  n.emitir = (d) => n.cbs.filter(o => !o.parado).forEach(o => o.cb(JSON.parse(JSON.stringify(d))));
  return n;
}
const PERFIL = { correo: 'ana@expresscarecuu.com', nombre: 'Ana', rol: 'usuario' };
function docDe(filas, extra) { return Object.assign({ actualizado: '2026-11-23T09:58:00-06:00', actualizadoMs: NOW - 2 * MIN, total: filas.length, fueraHorario: 0, sinAtender: filas.length, seguimiento: 0, origen: 'prueba', filas: JSON.stringify(filas) }, extra || {}); }
let seq = 0;
function fila(o) { seq++; return Object.assign({ id: 'c' + seq, nombre: 'Cliente ' + seq, telefono: '+52161400' + String(1000 + seq), wa: 'https://wa.me/52161400' + (1000 + seq), escribioMs: NOW - 10 * MIN, desdeMs: NOW - 10 * MIN, limiteMin: 45, fh: false, tipo: 'sin_atender', cotizada: '', diasCot: null, volvio: false, pidio: 'Llantas 225/65 R17', respondido: 'Nada', falta: 'Cotizar', anuncio: '' }, o || {}); }
// una fila que lleva `min` minutos esperando (en horario)
const esperando = (min, o) => fila(Object.assign({ escribioMs: NOW - min * MIN, desdeMs: NOW - min * MIN }, o || {}));
const lote = (n, min) => Array.from({ length: n }, () => esperando(min || 5));
async function conectar(w, filasODoc, perfil) {
  const n = nube(Array.isArray(filasODoc) ? docDe(filasODoc) : filasODoc);
  w.pendConectar(n.api, perfil === undefined ? PERFIL : perfil);
  await wait(30);
  return n;
}
const g = (w, id) => w.document.getElementById(id);
const btn = w => g(w, 'tab-pendientes');
const filasPintadas = (w, sec) => g(w, sec).querySelectorAll('.pd-row').length;
const badge = w => g(w, 'pd-badge').textContent;
const sem = w => ['verde', 'amarillo', 'rojo'].filter(c => btn(w).classList.contains('sem-' + c))[0] || null;
const rojas = w => g(w, 'pd-nuevos').querySelectorAll('.pd-row.pd-venc').length;
const naranjas = w => g(w, 'pd-nuevos').querySelectorAll('.pd-row.pd-nar').length;

(async () => {
  try {
    // ── 1. La pestaña aparece, el numerito sale y la lista carga (61 filas: 15 fuera de horario y 1 seguimiento) ──
    console.log('\n▶ 1. Pestaña, numerito y lista (61 filas)');
    {
      const w = abrir(AHORA_ISO);
      ok('existe el botón Pendientes junto a Historial', btn(w) && btn(w).textContent.indexOf('Pendientes') >= 0 && btn(w).previousElementSibling && btn(w).previousElementSibling.id === 'tab-historial');
      ok('existe el panel p-pendientes', !!g(w, 'p-pendientes'));
      ok('sin sesión: mensaje de iniciar sesión y sin numerito', (w.pendConectar(null, null), g(w, 'pd-msg').textContent.indexOf('Inicia sesión') >= 0 && badge(w) === '' && sem(w) === null));
      const filas = [];
      for (let i = 0; i < 45; i++) filas.push(esperando(1 + (i % 40)));
      for (let i = 0; i < 15; i++) filas.push(esperando(1 + (i % 15), { fh: true, limiteMin: 20 }));
      filas.push(esperando(30, { tipo: 'seguimiento', cotizada: '2026-11-18', diasCot: 5 }));
      const n = await conectar(w, filas);
      ok('abre UNA lectura, de la colección de prueba y el documento "actual"', n.abiertas === 1 && n.cols[0] === 'pendientes_prueba' && n.ids[0] === 'actual', n);
      ok('61 renglones pintados', filasPintadas(w, 'pd-nuevos') === 61, filasPintadas(w, 'pd-nuevos'));
      ok('numerito = 61', badge(w) === '61', badge(w));
      ok('cabecera con totales', /61 pendientes · 0 vencidos · 15 fuera de horario · 1 seguimientos/.test(g(w, 'pd-cab').textContent), g(w, 'pd-cab').textContent);
      ok('cabecera dice "Actualizado hace 2 min"', /Actualizado hace 2 min/.test(g(w, 'pd-cab').textContent));
      ok('etiqueta de seguimiento con fecha y días', /🟡 Seguimiento · cotizada 18\/11 \(hace 5 días\)/.test(g(w, 'pd-nuevos').textContent));
      ok('15 marcas de fuera de horario', (g(w, 'pd-nuevos').textContent.match(/🌙 fuera de horario/g) || []).length === 15);
      ok('los fuera de horario van primero', Array.from(g(w, 'pd-nuevos').querySelectorAll('.pd-row')).slice(0, 15).every(r => /🌙/.test(r.textContent)) && !/🌙/.test(g(w, 'pd-nuevos').querySelectorAll('.pd-row')[15].textContent));
      ok('enlace de WhatsApp en pestaña nueva con rel=noopener', (() => { const a = g(w, 'pd-nuevos').querySelector('a.pd-wa'); return a && /^https:\/\/wa\.me\//.test(a.href) && a.target === '_blank' && a.rel === 'noopener'; })());
      ok('no hay botones ni campos que escriban dentro del panel (solo lectura)', g(w, 'p-pendientes').querySelectorAll('input,textarea,select,button:not(#pd-toggle)').length === 0);
      // formato de la fecha "Escribió"
      const unaFila = esperando(5, { escribioMs: Date.parse('2026-11-23T15:07:00-06:00'), desdeMs: NOW - 5 * MIN });
      w.pendRecibir(docDe([unaFila]));
      ok('"Escribió" con formato dd/mm hh:mm p. m.', /23\/11 03:07 p\. m\./.test(g(w, 'pd-nuevos').textContent), g(w, 'pd-nuevos').textContent);
      w.pendRecibir(docDe([esperando(5, { escribioMs: Date.parse('2026-11-23T00:05:00-06:00') })]));
      ok('medianoche = 12:05 a. m.', /23\/11 12:05 a\. m\./.test(g(w, 'pd-nuevos').textContent));
      w.close();
    }

    // ── 2. Reloj ──
    console.log('\n▶ 2. Reloj (hora simulada: lunes 10:00)');
    {
      const w = abrir(AHORA_ISO);
      const fhFuturo = fila({ fh: true, limiteMin: 20, escribioMs: NOW - 10 * HORA, desdeMs: NOW + 30 * MIN });
      await conectar(w, [fhFuturo]);
      ok('fuera de horario con desdeMs en el futuro: no vencido y dice "Abre a las 10:30"', rojas(w) === 0 && /Abre a las 10:30/.test(g(w, 'pd-nuevos').textContent) && sem(w) === 'verde', g(w, 'pd-nuevos').textContent);
      const casos = [
        ['fuera de horario a 19 min: aún no rojo', esperando(19, { fh: true, limiteMin: 20 }), 0],
        ['fuera de horario a 20 min: rojo', esperando(20, { fh: true, limiteMin: 20 }), 1],
        ['en horario a 44 min: aún no rojo', esperando(44), 0],
        ['en horario a 45 min: rojo', esperando(45), 1],
        ['seguimiento a 45 min: rojo (mismo límite)', esperando(45, { tipo: 'seguimiento', cotizada: '2026-11-20', diasCot: 3 }), 1]
      ];
      for (const [nom, f, r] of casos) { w.pendRecibir(docDe([f])); ok(nom, rojas(w) === r, rojas(w)); }
      w.pendRecibir(docDe([esperando(23)])); ok('en horario a 23 min: naranja (ya pasó la mitad del límite)', naranjas(w) === 1 && rojas(w) === 0);
      w.pendRecibir(docDe([esperando(10)])); ok('a 10 min: neutro (ni naranja ni rojo)', naranjas(w) === 0 && rojas(w) === 0);
      w.pendRecibir(docDe([esperando(130)])); ok('130 min se muestra como "2 h 10 min"', /2 h 10 min/.test(g(w, 'pd-nuevos').textContent));
      // 48 horas
      const f48 = esperando(48 * 60), f47 = esperando(47 * 60 + 59), f3d = esperando(72 * 60);
      w.pendRecibir(docDe([f48, f47, f3d]));
      ok('47 h 59 min sigue en "Nuevos y de hoy"', filasPintadas(w, 'pd-nuevos') === 1);
      ok('48 h o más pasan a "Atrasados (2)", plegado por defecto', /Atrasados \(2\)/.test(g(w, 'pd-atrasados').textContent) && filasPintadas(w, 'pd-atrasados') === 0);
      ok('los atrasados no cuentan en el numerito', badge(w) === '1', badge(w));
      g(w, 'pd-toggle').click();
      ok('al tocar "Atrasados" se despliegan sus 2 renglones', filasPintadas(w, 'pd-atrasados') === 2);
      g(w, 'pd-toggle').click();
      ok('y se vuelven a plegar', filasPintadas(w, 'pd-atrasados') === 0);
      // El tiempo avanza solo (recalcula sin pedir datos): una fila de 40 min pasa a rojo 5 min después
      w.pendRecibir(docDe([esperando(40)]));
      ok('antes: a 40 min no está rojo', rojas(w) === 0);
      const realNow = w.Date.now; w.Date.now = () => realNow() + 6 * MIN;
      w.pendRefrescar();
      ok('6 min después recalcula y pasa a rojo (sin nuevo dato de Firestore)', rojas(w) === 1 && sem(w) === 'rojo');
      w.Date.now = realNow;
      w.close();
    }

    // ── 3. Semáforo ──
    console.log('\n▶ 3. Semáforo y numerito');
    {
      const w = abrir(AHORA_ISO);
      await conectar(w, lote(0));
      ok('0 pendientes: verde y sin numerito visible', sem(w) === 'verde' && !btn(w).classList.contains('pd-con') && /No hay pendientes/.test(g(w, 'pd-msg').textContent));
      w.pendRecibir(docDe(lote(4)));
      ok('4 pendientes sin vencer: verde, numerito 4', sem(w) === 'verde' && badge(w) === '4' && btn(w).classList.contains('pd-con'));
      w.pendRecibir(docDe(lote(5)));
      ok('5 pendientes: amarillo', sem(w) === 'amarillo' && badge(w) === '5');
      w.pendRecibir(docDe(lote(9)));
      ok('9 pendientes: sigue amarillo', sem(w) === 'amarillo');
      w.pendRecibir(docDe(lote(10)));
      ok('10 pendientes: rojo', sem(w) === 'rojo' && badge(w) === '10');
      w.pendRecibir(docDe([esperando(5), esperando(50)]));
      ok('2 pendientes y uno vencido: rojo', sem(w) === 'rojo' && badge(w) === '2');
      const atr = [esperando(60 * 49), esperando(60 * 60), esperando(60 * 100)];
      w.pendRecibir(docDe(lote(4).concat(atr)));
      ok('4 nuevos + 3 atrasados: verde y numerito 4 (los atrasados no lo mueven)', sem(w) === 'verde' && badge(w) === '4');
      w.pendRecibir(docDe(lote(5)));
      ok('con 5: amarillo…', sem(w) === 'amarillo');
      w.pendRecibir(docDe(lote(4)));
      ok('…y al bajar a 4 vuelve a verde', sem(w) === 'verde');
      w.pendRecibir(docDe(lote(6)));
      ok('texto alterno del botón dice el color y la cantidad', /6/.test(btn(w).getAttribute('aria-label')) && /amarillo/.test(btn(w).getAttribute('aria-label')) && /amarillo/.test(btn(w).title));
      ok('el color no es la única señal: el numerito lleva el número', badge(w) === '6');
      w.close();
    }

    // ── 4. Aviso de lista vieja ──
    console.log('\n▶ 4. Aviso de lista vieja');
    {
      const casos = [
        ['lunes 10:00 y lista de hace 50 min (09:10): SÍ avisa con la hora', '2026-11-23T10:00:00-06:00', 50, /La lista no se actualiza desde las 09:10\. Avísale a Carlos/],
        ['lunes 10:00 y lista de hace 21 min: SÍ avisa (umbral 20 min)', '2026-11-23T10:00:00-06:00', 21, /desde las 09:39/],
        ['lunes 10:00 y lista de hace 19 min 54 s (justo antes del umbral): no avisa', '2026-11-23T10:00:00-06:00', 19.9, null],
        ['lunes 10:00 y lista de hace 13 min (corrida normal): no avisa', '2026-11-23T10:00:00-06:00', 13, null],
        ['lunes 9:20 (solo 20 min desde que abre) con lista vieja: no avisa', '2026-11-23T09:20:00-06:00', 300, null],
        ['lunes 9:31 con lista de hace 60 min: SÍ avisa', '2026-11-23T09:31:00-06:00', 60, /desde las 08:31/],
        ['lunes 20:00 (cerrado) con lista vieja: no avisa', '2026-11-23T20:00:00-06:00', 600, null],
        ['lunes 18:00 en punto (ya cerró): no avisa', '2026-11-23T18:00:00-06:00', 120, null],
        ['sábado 10:30 con lista vieja: SÍ avisa', '2026-11-28T10:30:00-06:00', 90, /La lista no se actualiza/],
        ['sábado 15:00 (cerrado): no avisa', '2026-11-28T15:00:00-06:00', 90, null],
        ['domingo 11:00: no avisa', '2026-11-29T11:00:00-06:00', 600, null]
      ];
      for (const [nom, iso, hace, re] of casos) {
        const w = abrir(iso); const now = Date.parse(iso);
        await conectar(w, docDe([], { actualizadoMs: now - hace * MIN, actualizado: new Date(now - hace * MIN).toISOString() }));
        const a = g(w, 'pd-aviso'); const visible = a.style.display !== 'none' && a.textContent !== '';
        ok(nom, re ? (visible && re.test(a.textContent)) : !visible, a.textContent);
        w.close();
      }
    }

    // ── 5. Salir de sesión y volver a entrar ──
    console.log('\n▶ 5. Cerrar y reabrir la lectura');
    {
      const w = abrir(AHORA_ISO);
      const n = await conectar(w, lote(3));
      ok('con sesión: 1 lectura activa y 1 reloj', n.activas === 1 && w.__ints.size === 1, [n.activas, w.__ints.size]);
      w.pendConectar(null, null); await wait(10);
      ok('al salir: la lectura se cierra, el reloj se limpia y el numerito se apaga', n.activas === 0 && w.__ints.size === 0 && badge(w) === '' && sem(w) === null && /Inicia sesión/.test(g(w, 'pd-msg').textContent), [n.activas, w.__ints.size]);
      for (let i = 0; i < 3; i++) { w.pendConectar(n.api, PERFIL); w.pendConectar(n.api, PERFIL); }
      await wait(30);
      ok('volver a entrar (varias veces seguidas): UNA sola lectura activa y UN solo reloj, sin duplicados', n.activas === 1 && w.__ints.size === 1, [n.activas, w.__ints.size, n.abiertas]);
      ok('se vuelve a pintar la lista', filasPintadas(w, 'pd-nuevos') === 3);
      w.pendConectar(n.api, null); await wait(10);
      ok('sesión sin perfil válido: no abre lectura', n.activas === 0 && w.__ints.size === 0);
      n.emitir(docDe(lote(7))); await wait(5);
      ok('un dato que llega de una lectura ya cerrada no se pinta', filasPintadas(w, 'pd-nuevos') === 0);
      w.close();
    }

    // ── 6. Seguridad del texto ──
    console.log('\n▶ 6. Texto malicioso se ve como texto');
    {
      const w = abrir(AHORA_ISO); let alertas = 0; w.alert = () => { alertas++; };
      const mal = '<script>window.alert("x")</script><img src=x onerror="window.alert(1)">"\'&';
      const f = esperando(5, { nombre: mal, pidio: mal, respondido: mal, falta: mal, anuncio: mal, telefono: mal, wa: 'javascript:alert(1)' });
      const f2 = esperando(6, { nombre: 'Con "comillas" y \'apóstrofes\'', wa: 'https://wa.me/5216141234567', falta: '"><svg onload=alert(1)>' });
      await conectar(w, [f, f2]);
      const panel = g(w, 'p-pendientes');
      ok('no se creó ningún <script>, <img> ni <svg> dentro del panel', panel.querySelectorAll('script,img,svg').length === 0);
      ok('el texto aparece tal cual', g(w, 'pd-nuevos').textContent.indexOf('<script>window.alert("x")</script>') >= 0);
      ok('comillas y apóstrofes se muestran bien', g(w, 'pd-nuevos').textContent.indexOf('Con "comillas" y \'apóstrofes\'') >= 0);
      ok('un enlace que no es https://wa.me/ no se convierte en enlace', panel.querySelectorAll('a[href^="javascript"]').length === 0 && panel.querySelectorAll('a.pd-wa').length === 1);
      ok('sin atributos de eventos (onerror/onload) en el panel', !/\son(error|load|click)=/i.test(panel.innerHTML.replace(/&quot;/g, '')) || panel.querySelectorAll('[onerror],[onload]').length === 0);
      ok('no se disparó ninguna alerta', alertas === 0);
      w.close();
    }

    // ── 7. Estados y datos raros ──
    console.log('\n▶ 7. Estados vacíos, errores y campos desconocidos');
    {
      const w = abrir(AHORA_ISO);
      w.pendConectar(nube(undefined).api, PERFIL);
      ok('mientras llega: "Cargando"', /Cargando/.test(g(w, 'pd-msg').textContent));
      await wait(30);
      ok('documento que no existe: "Todavía no hay datos de pendientes"', /Todavía no hay datos de pendientes/.test(g(w, 'pd-msg').textContent) && sem(w) === null && badge(w) === '');
      const n0 = await conectar(w, []);
      ok('0 pendientes: "✅ No hay pendientes"', /✅ No hay pendientes/.test(g(w, 'pd-msg').textContent) && /0 pendientes/.test(g(w, 'pd-cab').textContent));
      const nE = nube(); nE.falla = 'Sin permiso (permission-denied).';   // el api ya entrega el mensaje legible (errorLegible)
      w.pendConectar(nE.api, PERFIL); await wait(30);
      ok('error de permisos: mensaje claro en español, sin numerito', /Sin permiso/.test(g(w, 'pd-msg').textContent) && /Avísale a Carlos/.test(g(w, 'pd-msg').textContent) && badge(w) === '' && sem(w) === null, g(w, 'pd-msg').textContent);
      const nR = nube(); nR.falla = 'Sin conexión a internet.';
      w.pendConectar(nR.api, PERFIL); await wait(30);
      ok('error de red: mensaje claro', /Sin conexión a internet/.test(g(w, 'pd-msg').textContent));
      await conectar(w, docDe([], { filas: '{esto no es json' }));
      ok('filas ilegibles: muestra el error sin romper', /No se pudo leer la lista/.test(g(w, 'pd-msg').textContent) && sem(w) === null);
      await conectar(w, docDe([], { filas: '{"a":1}' }));
      ok('filas que no son lista: también error', /No se pudo leer la lista/.test(g(w, 'pd-msg').textContent));
      const rara = Object.assign(esperando(5), { entregaBot: true, motivoEntrega: 'pidió asesor', campoNuevo: { x: [1, 2] }, otro: null });
      await conectar(w, [rara, null, 5, 'x', [], esperando(8, { limiteMin: 'abc', desdeMs: 'zzz', escribioMs: NOW - 8 * MIN })]);
      ok('campos desconocidos y filas basura se ignoran sin error', filasPintadas(w, 'pd-nuevos') === 2 && badge(w) === '2', filasPintadas(w, 'pd-nuevos'));
      await conectar(w, docDe([esperando(5)], { filas: [esperando(5), esperando(6)] }));
      ok('si filas ya viene como lista (no como texto) también se lee', filasPintadas(w, 'pd-nuevos') === 2);
      w.close();
    }

    // ── 8. Lo demás sigue igual ──
    console.log('\n▶ 8. Las demás pestañas');
    {
      const w = abrir(AHORA_ISO);
      const ids = ['llantas', 'servicios', 'taller', 'cotizacion', 'whatsapp', 'historial', 'pendientes', 'usuarios', 'config'];
      ok('todas las pestañas siguen existiendo, en su orden', JSON.stringify(Array.from(w.document.querySelectorAll('.tab')).map(b => b.getAttribute('data-t'))) === JSON.stringify(ids), Array.from(w.document.querySelectorAll('.tab')).map(b => b.getAttribute('data-t')));
      await wait(300);   // a que termine de cargar la página y se enganchen los clics de las pestañas
      let bien = true;
      ids.forEach(t => { g(w, 'tab-' + t).click(); const act = Array.from(w.document.querySelectorAll('.pnl.on')).map(p => p.id); if (act.length !== 1 || act[0] !== 'p-' + t) bien = false; });
      ok('cada pestaña abre solo su panel', bien);
      g(w, 'tab-pendientes').click();
      ok('la pestaña Pendientes se marca como activa', g(w, 'tab-pendientes').classList.contains('on') && g(w, 'p-pendientes').classList.contains('on'));
      const src = html.slice(html.indexOf('// ════ PENDIENTES DE WHATSAPP'), html.indexOf('function rectRenderAdmin(){'));
      ok('el bloque de Pendientes no escribe nada (sin setDoc/addDoc/updateDoc/deleteDoc/fetch/XMLHttpRequest)', src.length > 1000 && !/setDoc|addDoc|updateDoc|deleteDoc|fetch\(|XMLHttpRequest/.test(src));
      ok('el api solo agrega una lectura (pendEscuchar) y ninguna escritura de pendientes', /pendEscuchar:function/.test(html) && !/pendGuardar|pendEscribir/.test(html));
      ok('las constantes configurables están al inicio del bloque', /var ATRASADO_HORAS = 48;/.test(src) && /var SEMAFORO_AMARILLO = 5;/.test(src) && /var SEMAFORO_ROJO = 10;/.test(src) && /var LISTA_VIEJA_MIN = 20;/.test(src));
      ok('las reglas de Firestore (texto) dejan leer a cotizadores y no escribir', (() => { try { const r = fs.readFileSync('./firestore.rules', 'utf8'); return /match \/pendientes\/\{id\}\s*\{\s*allow read: if esCotizador\(\);\s*allow write: if false;/.test(r) && /match \/pendientes_prueba\/\{id\}\s*\{\s*allow read: if esCotizador\(\);\s*allow write: if false;/.test(r); } catch (e) { return false; } })());
      w.close();
    }
  } catch (e) { console.log('❌ ERROR en el test:', e && e.stack || e); failed++; }
  console.log('\n══════════════════════════════════════');
  console.log('  ✅ ' + passed + ' pasaron   ' + (failed ? '❌ ' + failed + ' FALLARON' : '❌ 0 FALLARON'));
  process.exit(failed ? 1 : 0);
})();
