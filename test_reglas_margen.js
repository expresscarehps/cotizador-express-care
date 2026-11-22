// ── TEST — Tabla de márgenes de balatas Dritek (paso 2, 22 nov 2026) ─────────────────────
// Firestore simulado. Uso: node test_reglas_margen.js [html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 300) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', e => { console.log('  ❌ ERROR NO CONTROLADO:', e && e.stack || e); failed++; });
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
const html = fs.readFileSync(HTML, 'utf8');
const BASE = 'https://expresscarehps.github.io/cotizador-express-care/';
function abrir(archivo, query) {
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(), url: BASE + archivo + (query || ''),
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
}
// Firestore simulado de un solo documento por id
function nube(inicial) {
  const docs = new Map(Object.entries(inicial || {})); const oyentes = []; const n = { escrituras: [], docs, falla: false, falloGuardar: false };
  n.api = () => ({
    margenEscuchar(id, cb, errcb) {
      if (n.falla) { setTimeout(() => errcb({ code: 'permission-denied' }), 0); return () => {}; }
      const o = { id, cb, parado: false }; oyentes.push(o); setTimeout(() => cb(docs.has(id) ? JSON.parse(JSON.stringify(docs.get(id))) : null), 0);
      return () => { o.parado = true; };
    },
    margenGuardar(id, valores, por) {
      if (n.falloGuardar) return Promise.reject({ code: 'permission-denied' });
      const d = Object.assign({}, valores, { actualizado: '2026-11-22 13:00', por }); n.escrituras.push({ id, d }); docs.set(id, d);
      oyentes.filter(o => o.id === id && !o.parado).forEach(o => setTimeout(() => o.cb(JSON.parse(JSON.stringify(d))), 0)); return Promise.resolve();
    }
  });
  return n;
}
const ADMIN = { correo: 'carlos.mtz@expresscarecuu.com', nombre: 'Carlos', rol: 'superadministrador' };
const ASESORA = { correo: 'ana@expresscarecuu.com', nombre: 'Ana', rol: 'usuario' };
const campo = (w, k) => w.document.getElementById('mg-' + k);
const toasts = w => Array.from(w.document.body.children).filter(e => e.tagName === 'DIV').map(e => e.textContent);

(async () => {
 try {
  console.log('\n— A. Valores base (sin documento / sin conexión)');
  let w = abrir('cotizador_dev.html', '?test=1'); await esperar(200);
  ok('A1 base: Dritek cerámica 50% y semimetálica 50%', w.margenDritek('ceramica') === 0.5 && w.margenDritek('semimetalica') === 0.5);
  ok('A2 base: tope 90% y piso 35%', w.margenTopeDritek() === 0.9 && w.margenPisoDritek() === 0.35);
  ok('A3 sin sesión la tabla no pide documento (api null)', w.MARGEN_API === null);

  console.log('\n— B. Documento guardado cambia lo que usa el cotizador (sin tocar código)');
  w = abrir('cotizador_dev.html'); await esperar(100);
  let N = nube({ dritek_prueba: { dritek_ceramica: 52, dritek_semimetalica: 48, tope_pct: 85, piso_pct: 38, actualizado: '2026-11-20 09:00', por: 'carlos.mtz@expresscarecuu.com' } });
  w.margenConectar(N.api(), ADMIN); await esperar(50);
  ok('B1 cerámica 52% desde el documento', Math.abs(w.margenDritek('ceramica') - 0.52) < 1e-12);
  ok('B2 semimetálica 48%', Math.abs(w.margenDritek('semimetalica') - 0.48) < 1e-12);
  ok('B3 tope 85% y piso 38%', Math.abs(w.margenTopeDritek() - 0.85) < 1e-12 && Math.abs(w.margenPisoDritek() - 0.38) < 1e-12);
  ok('B4 dev lee el documento "dritek_prueba" (no el real)', w.margenDocId() === 'dritek_prueba');
  { const wp = abrir('cotizador_express_care_valvoline.html'); await esperar(60); ok('B5 con el nombre de archivo de producción (sin ?test) lee el documento real "dritek"', wp.margenDocId() === 'dritek', wp.margenDocId()); }

  console.log('\n— C. Documento dañado: cada campo malo vuelve a su base, los buenos se respetan');
  N = nube({ dritek_prueba: { dritek_ceramica: 'abc', dritek_semimetalica: 120, tope_pct: 80, piso_pct: -5 } });
  w = abrir('cotizador_dev.html'); await esperar(100); w.margenConectar(N.api(), ADMIN); await esperar(50);
  ok('C1 cerámica inválida (texto) → 50', w.margenDritek('ceramica') === 0.5);
  ok('C2 semimetálica fuera de rango (120) → 50', w.margenDritek('semimetalica') === 0.5);
  ok('C3 tope válido (80) se respeta', Math.abs(w.margenTopeDritek() - 0.8) < 1e-12);
  ok('C4 piso negativo → 35', w.margenPisoDritek() === 0.35);
  N = nube(); N.falla = true; w = abrir('cotizador_dev.html'); await esperar(100); w.margenConectar(N.api(), ASESORA); await esperar(50);
  ok('C5 si Firestore niega la lectura se usan los valores base', w.margenDritek('ceramica') === 0.5 && w.margenTopeDritek() === 0.9);

  console.log('\n— D. Pantalla de Configuración: solo administradores');
  N = nube({ dritek_prueba: { dritek_ceramica: 50, dritek_semimetalica: 50, tope_pct: 90, piso_pct: 35, actualizado: '2026-11-20 09:00', por: 'carlos.mtz@expresscarecuu.com' } });
  w = abrir('cotizador_dev.html'); await esperar(100); w.margenConectar(N.api(), ASESORA); await esperar(50);
  ok('D1 asesora: la tarjeta NO se ve', w.document.getElementById('margen-admin').style.display === 'none');
  w.margenConectar(N.api(), ADMIN); await esperar(50);
  ok('D2 administrador: la tarjeta se ve', w.document.getElementById('margen-admin').style.display !== 'none');
  ok('D3 muestra los 4 campos con sus valores', ['dritek_ceramica', 'dritek_semimetalica', 'tope_pct', 'piso_pct'].map(k => campo(w, k).value).join(',') === '50,50,90,35');
  ok('D4 muestra última actualización y quién', /2026-11-20 09:00/.test(w.document.getElementById('margen-admin-meta').textContent) && /carlos\.mtz/.test(w.document.getElementById('margen-admin-meta').textContent));
  w.margenConectar(null, null); await esperar(20);
  ok('D5 al cerrar sesión vuelven los valores base', w.margenDritek('ceramica') === 0.5 && w.MARGEN_API === null);

  console.log('\n— E. Guardar un cambio');
  N = nube(); w = abrir('cotizador_dev.html'); await esperar(100); w.margenConectar(N.api(), ADMIN); await esperar(50);
  campo(w, 'dritek_ceramica').value = '55'; campo(w, 'dritek_semimetalica').value = '52,5'; campo(w, 'tope_pct').value = '88'; campo(w, 'piso_pct').value = '36';
  w.document.getElementById('btn-save-margenes').click(); await esperar(80);
  ok('E1 se escribió un solo documento "dritek_prueba"', N.escrituras.length === 1 && N.escrituras[0].id === 'dritek_prueba', N.escrituras);
  ok('E2 con los 4 valores numéricos (coma decimal aceptada)', JSON.stringify([N.escrituras[0].d.dritek_ceramica, N.escrituras[0].d.dritek_semimetalica, N.escrituras[0].d.tope_pct, N.escrituras[0].d.piso_pct]) === '[55,52.5,88,36]', N.escrituras[0] && N.escrituras[0].d);
  ok('E3 guarda quién lo cambió', N.escrituras[0].d.por === ADMIN.correo);
  ok('E4 el cotizador usa el nuevo valor de inmediato', Math.abs(w.margenDritek('ceramica') - 0.55) < 1e-12 && Math.abs(w.margenDritek('semimetalica') - 0.525) < 1e-12 && Math.abs(w.margenTopeDritek() - 0.88) < 1e-12);
  ok('E5 aviso "Márgenes guardados"', toasts(w).some(t => /Márgenes guardados/.test(t)), toasts(w));

  console.log('\n— F. Valores inválidos no se guardan');
  for (const [k, v, nom] of [['dritek_ceramica', '0', 'cerámica 0'], ['dritek_ceramica', '95', 'cerámica 95'], ['dritek_semimetalica', 'abc', 'semimetálica texto'], ['tope_pct', '40', 'tope 40'], ['tope_pct', '101', 'tope 101'], ['piso_pct', '-1', 'piso -1'], ['piso_pct', '', 'piso vacío']]) {
    N = nube(); w = abrir('cotizador_dev.html'); await esperar(60); w.margenConectar(N.api(), ADMIN); await esperar(40);
    campo(w, k).value = v; w.document.getElementById('btn-save-margenes').click(); await esperar(40);
    ok('F ' + nom + ' → no se guarda y avisa', N.escrituras.length === 0 && toasts(w).some(t => /escribe un número entre/.test(t)), N.escrituras);
  }
  N = nube(); w = abrir('cotizador_dev.html'); await esperar(60); w.margenConectar(N.api(), ADMIN); await esperar(40);
  campo(w, 'piso_pct').value = '0'; campo(w, 'tope_pct').value = '100'; campo(w, 'dritek_ceramica').value = '90'; campo(w, 'dritek_semimetalica').value = '1';
  w.document.getElementById('btn-save-margenes').click(); await esperar(40);
  ok('F8 los límites exactos (0, 100, 90, 1) sí se aceptan', N.escrituras.length === 1);

  console.log('\n— G. Fallos y permisos al guardar');
  N = nube(); N.falloGuardar = true; w = abrir('cotizador_dev.html'); await esperar(60); w.margenConectar(N.api(), ADMIN); await esperar(40);
  campo(w, 'dritek_ceramica').value = '51'; w.document.getElementById('btn-save-margenes').click(); await esperar(60);
  ok('G1 si Firestore rechaza, avisa y NO cambia lo que usa el cotizador', toasts(w).some(t => /No se pudieron guardar/.test(t)) && w.margenDritek('ceramica') === 0.5, toasts(w));
  w = abrir('cotizador_dev.html', '?test=1'); await esperar(60); w.setTab('config');
  campo(w, 'dritek_ceramica').value = '51'; w.document.getElementById('btn-save-margenes').click(); await esperar(40);
  ok('G2 en modo prueba sin sesión no guarda y pide iniciar sesión', toasts(w).some(t => /Inicia sesión/.test(t)), toasts(w));
  N = nube(); w = abrir('cotizador_dev.html'); await esperar(60); w.margenConectar(N.api(), ASESORA); await esperar(40);
  w.margenGuardar().then(() => {}); await esperar(40);
  ok('G3 una asesora no puede guardar (no se escribe nada)', N.escrituras.length === 0);

  console.log('\n— H. Una actualización que llega mientras se escribe no pisa el campo');
  N = nube(); w = abrir('cotizador_dev.html'); await esperar(60); w.margenConectar(N.api(), ADMIN); await esperar(40);
  const inp = campo(w, 'tope_pct'); inp.focus(); inp.value = '8'; w.margenRecibir({ dritek_ceramica: 50, dritek_semimetalica: 50, tope_pct: 90, piso_pct: 35 });
  ok('H1 el campo enfocado conserva lo que se está tecleando', inp.value === '8', inp.value);

  console.log('\n— I. Lo que ya funcionaba no cambia');
  w = abrir('cotizador_dev.html', '?test=1'); await esperar(100); w.setTallerSvc('frenos', null);
  const it = w.tallerItems.find(i => i.concepto === 'Balatas delanteras');
  ok('I1 las balatas siguen con margen 30% en el renglón (GRC/Duralast no cambian)', it && it.margen === 30, it && it.margen);
  ok('I2 siguen en Configuración las tarjetas de proveedores y de tarifas de mano de obra', !!w.document.getElementById('prov-admin') && !!w.document.getElementById('config-tarifas') && !!w.document.getElementById('btn-save-tarifas'));

  console.log('\n══════════════════════════════════════');
  console.log(`Resultado: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed ? 1 : 0);
 } catch (e) { console.log('  ❌ La prueba se detuvo por un error:', e && e.stack || e); process.exit(1); }
})();
