// ── TEST — el catálogo del bot coincide AL CENTAVO con el cotizador (11 oct 2026) ──
// Uso: node test_catalogo_bot.js [html] [catalogo.json] [reglas.json]
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html', CAT = process.argv[3] || './catalogo_llantas_bot.json', REG = process.argv[4] || './reglas_precios_bot.json';
const { JSDOM, VirtualConsole } = require('jsdom');
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); failed++; } }
const html = fs.readFileSync(HTML, 'utf8'), cat = JSON.parse(fs.readFileSync(CAT, 'utf8')), reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
  beforeParse(win) { win.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); win.alert = () => {}; win.confirm = () => true; } }).window;
const esperar = ms => new Promise(r => setTimeout(r, ms));
const r2 = x => Math.round(x * 100) / 100;

(async () => {
  await esperar(200);
  console.log('\n=== CB-1. Estructura y conteos ===');
  ok('1 total = DATA + VEGA + AYALA de la página', cat.length === w.DATA.length + w.VEGA.length + w.AYALA.length, [cat.length, w.DATA.length, w.VEGA.length, w.AYALA.length]);
  ok('2 ids únicos (clave__proveedor)', new Set(cat.map(d => d.id)).size === cat.length);
  const faltan = cat.filter(d => !d.id || !d.clave || !d.desc || !d.medida || !d.marca || !d.proveedor || typeof d.base_precio !== 'number' || typeof d.precio_contado !== 'number' || typeof d.precio_meses !== 'number' || d.activo !== true || !d.actualizado);
  ok('3 todos traen los campos obligatorios y base_precio numérico (AYALA ya no es texto)', faltan.length === 0, faltan.slice(0, 2));
  ok('4 proveedores válidos', cat.every(d => ['SERV', 'VEGA', 'AYALA'].includes(d.proveedor)));
  const sinDem = [...new Set(cat.filter(d => !d.demanda).map(d => d.marca))];
  ok('5 toda marca trae demanda alta/media/baja', sinDem.length === 0, sinDem);
  ok('6 demanda solo alta/media/baja', cat.every(d => ['alta', 'media', 'baja'].includes(d.demanda)));
  const sinGama = [...new Set(cat.filter(d => !d.gama || !d.pais).map(d => d.marca))];
  ok('7 toda marca trae gama y país', sinGama.length === 0, sinGama);

  console.log('\n=== CB-2. Precios: fórmula escrita aparte (independiente del código del cotizador) ===');
  const BD = w.BRAND_DB; const margenIndep = m => { if (m === 'YOKOHAMA') return 12.5; const b = BD[m]; return (b && (b.pais === 'China' || b.gama === 'Económica' || b.gama === 'Muy Económica')) ? 15.5 : 12.5; };
  let malC = [], malM = [], malMg = [];
  cat.forEach(d => {
    let c, m;
    if (d.proveedor === 'AYALA') { c = d.base_precio * 0.75 * 1.16; m = d.base_precio * 0.80 * 1.16; }
    else { c = d.base_precio / (1 - margenIndep(d.marca) / 100); m = c * 1.05; if (d.margen !== margenIndep(d.marca)) malMg.push(d.id); }
    if (Math.abs(c - d.precio_contado) > 1e-9) malC.push(d.id); if (Math.abs(m - d.precio_meses) > 1e-9) malM.push(d.id);
  });
  ok('8 precio_contado de las ' + cat.length + ' llantas coincide con la fórmula', malC.length === 0, malC.slice(0, 3));
  ok('9 precio_meses de las ' + cat.length + ' llantas coincide con la fórmula', malM.length === 0, malM.slice(0, 3));
  ok('10 margen guardado (12.5 / 15.5 / null en AYALA) coincide', malMg.length === 0 && cat.filter(d => d.proveedor === 'AYALA').every(d => d.margen === null), malMg.slice(0, 3));
  ok('11 AYALA: contado = lista × 0.75 × 1.16 (ej. AY26387 lista 2602 → 2263.74)', r2(cat.find(d => d.clave === 'AY26387').precio_contado) === 2263.74, cat.find(d => d.clave === 'AY26387').precio_contado);

  console.log('\n=== CB-3. Contra el CARRITO REAL del cotizador (botón +) ===');
  const muestra = []; const porProv = { SERV: [], VEGA: [], AYALA: [] }; cat.forEach(d => porProv[d.proveedor].push(d));
  Object.keys(porProv).forEach(p => { const L = porProv[p]; for (let i = 0; i < 40; i++) muestra.push(L[Math.floor(i * L.length / 40)]); });
  ['MICHELIN', 'BFGOODRICH', 'HANKOOK', 'ATLAS', 'AGATE', 'TOYO', 'NITTO', 'KENDA', 'YOKOHAMA', 'JK TYRE', 'NOBHEX'].forEach(mk => { const x = cat.find(d => d.marca === mk); if (x && !muestra.includes(x)) muestra.push(x); });
  const dupCve = new Set(); const vistos = {}; cat.forEach(d => { (vistos[d.clave] = vistos[d.clave] || []).push(d.proveedor); }); Object.keys(vistos).forEach(k => { if (vistos[k].length > 1) dupCve.add(k); });
  let difC = [], difM = [], difI = [], n = 0, sinProbar = 0;
  for (const d of muestra) {
    if (dupCve.has(d.clave)) { sinProbar++; continue; }   // clave repetida entre proveedores: el botón + elige uno; se revisa aparte
    for (const pago of ['contado', 'meses']) {
      w.cart = []; w.pago = pago;
      w.addLlanta({ getAttribute: () => d.clave });
      const l = w.cart.find(c => c.t === 'l'); n++;
      if (!l) { difC.push(d.id + ' no entró al carrito'); continue; }
      const esperado = pago === 'meses' ? d.precio_meses : d.precio_contado;
      if (Math.abs(l.precioBase - esperado) > 1e-9) (pago === 'meses' ? difM : difC).push([d.id, l.precioBase, esperado]);
      // Instalación: 1 → sin cambio; 2 y 3 → +210; 4 → +135, sumada al precio unitario
      for (const [q, rec] of [[1, 0], [2, 210], [3, 210], [4, 135], [8, 135]]) {
        l.qty = q; w.recalcInstalacionLlantas();
        const lq = w.cart.find(c => c.t === 'l');
        if (Math.abs(lq.precio - (esperado + rec)) > 1e-9) difI.push([d.id, pago, q, lq.precio, esperado + rec]);
      }
    }
  }
  w.pago = 'contado';
  ok('12 ' + n + ' pruebas de carrito (' + muestra.length + ' llantas × contado/meses): precio base idéntico en contado', difC.length === 0, difC.slice(0, 3));
  ok('13 ... y en meses', difM.length === 0, difM.slice(0, 3));
  ok('14 instalación 1 / 2 / 3 / 4 / 8 llantas: precio unitario = catálogo + $0 / $210 / $210 / $135 / $135 (contado y meses)', difI.length === 0, difI.slice(0, 3));
  ok('15 reglas_precios_bot.json trae las mismas cifras de instalación que el cotizador', reg.instalacion_por_llanta.cuatro_o_mas === 135 && reg.instalacion_por_llanta.dos_o_tres === 210 && reg.instalacion_por_llanta.una === 0);
  console.log('  ℹ️ claves repetidas entre proveedores: ' + dupCve.size + ' · llantas de la muestra no probadas por eso: ' + sinProbar);
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
