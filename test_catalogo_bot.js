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
  const ayalaBot = w.AYALA.filter(d => w.ayalaSeMuestra(d) && !w.ayalaAviso(d.est));
  ok('1 total = DATA + VEGA + AYALA que el cotizador muestra sin aviso', cat.length === w.DATA.length + w.VEGA.length + ayalaBot.length + w.CHAVITAR.length, [cat.length, w.DATA.length, w.VEGA.length, ayalaBot.length, w.CHAVITAR.length]);
  ok('1b el bot NO trae AYALA futuro lanzamiento, descontinuadas ocultas ni llantas con aviso al asesor', cat.filter(d => d.proveedor === 'AYALA').every(d => { const o = w.AYALA.find(x => x.cve === d.clave); return o && w.ayalaSeMuestra(o) && !w.ayalaAviso(o.est); }));
  ok('1c todos los precios son números mayores a 0 (ninguna llanta sin precio, ej. solo-MTO sin lista)', cat.every(d => Number.isFinite(d.precio_contado) && d.precio_contado > 0 && Number.isFinite(d.precio_meses) && d.precio_meses > 0), cat.filter(d => !(d.precio_contado > 0)).slice(0, 3).map(d => d.id));
  ok('2 ids únicos (clave__proveedor)', new Set(cat.map(d => d.id)).size === cat.length);
  const faltan = cat.filter(d => !d.id || !d.clave || !d.desc || !d.medida || !d.marca || !d.proveedor || typeof d.base_precio !== 'number' || typeof d.precio_contado !== 'number' || typeof d.precio_meses !== 'number' || typeof d.activo !== 'boolean' || !d.actualizado);
  ok('3 todos traen los campos obligatorios y base_precio numérico (AYALA ya no es texto)', faltan.length === 0, faltan.slice(0, 2));
  ok('4 proveedores válidos', cat.every(d => ['SERV', 'VEGA', 'AYALA', 'CHAV'].includes(d.proveedor)));
  const sinDem = [...new Set(cat.filter(d => !d.demanda).map(d => d.marca))];
  ok('5 toda marca trae demanda alta/media/baja', sinDem.length === 0, sinDem);
  ok('6 demanda solo alta/media/baja', cat.every(d => ['alta', 'media', 'baja'].includes(d.demanda)));
  const sinGama = [...new Set(cat.filter(d => !d.gama || !d.pais).map(d => d.marca))];
  ok('7 toda marca trae gama y país', sinGama.length === 0, sinGama);

  console.log('\n=== CB-2. Precios: fórmula escrita aparte (independiente del código del cotizador) ===');
  const BD = w.BRAND_DB; const margenIndep = m => 12.5;   // regla vigente desde 19-oct-2026: margen 12.5% parejo en todas las marcas (antes 15.5% en China/Económica)
  let malC = [], malM = [], malMg = [];
  cat.forEach(d => {
    let c, m;
    if (d.proveedor === 'AYALA' && d.tipo_precio === 'lista') { c = d.base_precio * 0.75 * 1.16; m = d.base_precio * 0.80 * 1.16; }
    else if (d.proveedor === 'CHAV') {   // Chavitar: lista SIN IVA. Con equivalente = el precio más bajo de los equivalentes; sin equivalente = pv propio
      const ch = w.CHAVITAR.find(x => x.cve === d.clave);
      const pvEq = (ch.eq || []).map(e => { const f = e[0] === 'SERV' ? w.DATA.find(x => x.cve === e[1]) : w.VEGA.find(x => x.cve === e[1]); return f ? (e[0] === 'SERV' ? f.precio : f.costo) / (1 - margenIndep(f.marca) / 100) : null; }).filter(x => x);
      c = pvEq.length ? Math.min(...pvEq) : ch.pv; m = c * 1.05;
      if (Math.abs(d.base_precio - ch.costo * 1.16) > 1e-9 || d.margen !== Math.round((1 - ch.costo * 1.16 / c) * 1000) / 10 || d.precio_origen !== (pvEq.length ? 'equivalente' : 'propio')) malMg.push(d.id);
    }
    else if (d.proveedor === 'AYALA') { c = d.base_precio / (1 - margenIndep(d.marca) / 100) * 1.16; m = c * 1.05; if (d.margen !== margenIndep(d.marca)) malMg.push(d.id); }   // lista MTO: costo antes de IVA
    else { c = d.base_precio / (1 - margenIndep(d.marca) / 100); m = c * 1.05; if (d.margen !== margenIndep(d.marca)) malMg.push(d.id); }
    if (Math.abs(c - d.precio_contado) > 1e-9) malC.push(d.id); if (Math.abs(m - d.precio_meses) > 1e-9) malM.push(d.id);
  });
  ok('8 precio_contado de las ' + cat.length + ' llantas coincide con la fórmula', malC.length === 0, malC.slice(0, 3));
  ok('9 precio_meses de las ' + cat.length + ' llantas coincide con la fórmula', malM.length === 0, malM.slice(0, 3));
  ok('10 margen guardado (12.5 en Serv/VEGA/AYALA-MTO; real en Chavitar; null en AYALA de lista) y base de Chavitar = costo × 1.16', malMg.length === 0 && cat.filter(d => d.proveedor === 'AYALA' && d.tipo_precio === 'lista').every(d => d.margen === null), malMg.slice(0, 3));
  const ay = w.AYALA.find(x => x.cve === 'AY26387'), ayd = cat.find(d => d.clave === 'AY26387');
  ok('11 AYALA de lista: contado = lista × 0.75 × 1.16 (AY26387, lista ' + ay.lista + ' → ' + r2(ay.lista * 0.75 * 1.16) + ')', r2(ayd.precio_contado) === r2(ay.lista * 0.75 * 1.16), ayd.precio_contado);
  const mtoDoc = cat.find(d => d.clave === 'AY73090');
  ok('11b AYALA lista MTO solo-MTO (AY73090 Uniroyal, costo 2195): contado = costo / 0.875 × 1.16 = ' + r2(2195 / 0.875 * 1.16) + ' y meses × 1.05', mtoDoc && mtoDoc.tipo_precio === 'costo' && mtoDoc.base_precio === 2195 && r2(mtoDoc.precio_contado) === r2(2195 / 0.875 * 1.16) && r2(mtoDoc.precio_meses) === r2(2195 / 0.875 * 1.16 * 1.05), mtoDoc);

  console.log('\n=== CB-3. Contra el CARRITO REAL del cotizador (botón +) ===');
  const muestra = []; const porProv = { SERV: [], VEGA: [], AYALA: [], CHAV: [] }; cat.forEach(d => porProv[d.proveedor].push(d));
  Object.keys(porProv).forEach(p => { const L = porProv[p]; for (let i = 0; i < 40; i++) muestra.push(L[Math.floor(i * L.length / 40)]); });
  ['MICHELIN', 'BFGOODRICH', 'HANKOOK', 'ATLAS', 'AGATE', 'TOYO', 'NITTO', 'KENDA', 'YOKOHAMA', 'JK TYRE', 'NOBHEX'].forEach(mk => { const x = cat.find(d => d.marca === mk); if (x && !muestra.includes(x)) muestra.push(x); });
  const dupCve = new Set(); const vistos = {}; cat.filter(d => d.proveedor !== 'CHAV').forEach(d => { (vistos[d.clave] = vistos[d.clave] || []).push(d.proveedor); }); Object.keys(vistos).forEach(k => { if (vistos[k].length > 1) dupCve.add(k); });
  let difC = [], difM = [], difI = [], n = 0, sinProbar = 0;
  for (const d of muestra) {
    if (dupCve.has(d.clave) && d.proveedor !== 'CHAV') { sinProbar++; continue; }   // clave repetida entre proveedores: el botón + elige uno; se revisa aparte
    for (const pago of ['contado', 'meses']) {
      w.cart = []; w.pago = pago;
      w.addLlanta({ getAttribute: () => d.proveedor === 'CHAV' ? d.clave + '@CHAV' : d.clave });
      const l = w.cart.find(c => c.t === 'l'); n++;
      if (!l) { difC.push(d.id + ' no entró al carrito'); continue; }
      const esperado = pago === 'meses' ? d.precio_meses : d.precio_contado;
      if (Math.abs(l.precioBase - esperado) > 1e-9) (pago === 'meses' ? difM : difC).push([d.id, l.precioBase, esperado]);
      // Instalación: 1 → sin cambio; 2 y 3 → +190; 4 o más → +120, sumada al precio unitario (cambio 14 oct 2026: paquetes $380 y $480)
      for (const [q, rec] of [[1, 0], [2, 190], [3, 190], [4, 120], [8, 120]]) {
        l.qty = q; w.recalcInstalacionLlantas();
        const lq = w.cart.find(c => c.t === 'l');
        const recEsp = rec * (d.marca === 'MICHELIN' ? 0.65 : 1);   // Michelin lleva 35% menos de recargo de instalación ($78 / $123.50)
        if (Math.abs(lq.precio - (esperado + recEsp)) > 1e-9) difI.push([d.id, pago, q, lq.precio, esperado + recEsp]);
      }
    }
  }
  w.pago = 'contado';
  ok('12 ' + n + ' pruebas de carrito (' + muestra.length + ' llantas × contado/meses): precio base idéntico en contado', difC.length === 0, difC.slice(0, 3));
  ok('13 ... y en meses', difM.length === 0, difM.slice(0, 3));
  ok('14 instalación 1 / 2 / 3 / 4 / 8 llantas: precio unitario = catálogo + $0 / $190 / $190 / $120 / $120 (contado y meses; Michelin −35% de recargo)', difI.length === 0, difI.slice(0, 3));
  ok('15 reglas_precios_bot.json trae las mismas cifras de instalación que el cotizador', reg.instalacion_por_llanta.cuatro_o_mas === 120 && reg.instalacion_por_llanta.dos_o_tres === 190 && reg.instalacion_por_llanta.una === 0);
  console.log('  ℹ️ claves repetidas entre proveedores: ' + dupCve.size + ' · llantas de la muestra no probadas por eso: ' + sinProbar);

  console.log('\n=== CB-4. Chavitar: grupos de equivalentes, activo/desactivado, reglas ===');
  const ch = cat.filter(d => d.proveedor === 'CHAV'), grupos = {};
  cat.filter(d => d.grupo).forEach(d => { (grupos[d.grupo] = grupos[d.grupo] || []).push(d); });
  const G = Object.values(grupos);
  ok('16 hay ' + ch.length + ' llantas Chavitar y todas sus claves existen en el cotizador', ch.length === w.CHAVITAR.length && ch.every(d => w.CHAV_IDX[d.clave]));
  ok('17 cada grupo tiene exactamente UN documento activo (' + G.length + ' grupos)', G.every(m => m.length >= 2 && m.filter(d => d.activo).length === 1), G.filter(m => m.filter(d => d.activo).length !== 1).slice(0, 2).map(m => m.map(d => d.id)));
  const mg = d => 1 - d.base_precio / d.precio_contado;
  ok('18 el activo de cada grupo es el de MAYOR MARGEN real (empate: Chavitar, luego menor precio) y coincide con el de menor costo', G.every(m => { const a = m.find(d => d.activo); const minCosto = Math.min(...m.map(d => d.base_precio)); return m.every(d => d === a || mg(d) < mg(a) - 1e-4 || (Math.abs(mg(d) - mg(a)) <= 1e-4 && !(d.proveedor === 'CHAV' && a.proveedor !== 'CHAV') && d.precio_contado >= a.precio_contado - 1e-9)) && a.base_precio <= minCosto + 0.005; }));
  ok('19 los desactivados dicen quién los reemplaza y es un activo del mismo grupo', G.every(m => m.filter(d => !d.activo).every(d => { const a = cat.find(x => x.id === d.desactivado_por); return a && a.activo && a.grupo === d.grupo; })));
  ok('20 fuera de los grupos TODO está activo (Serv/VEGA/AYALA sin equivalente y Chavitar solo no se tocan), salvo Chavitar con descripción idéntica a otra Chavitar (se deja la de menor costo)', cat.filter(d => !d.grupo).every(d => (d.activo === true && !d.desactivado_por) || (d.proveedor === 'CHAV' && d.activo === false && d.motivo && cat.some(x => x.id === d.desactivado_por && x.activo && x.medida === d.medida && x.desc === d.desc && x.marca === d.marca && mg(x) >= mg(d) - 1e-4))));
  ok('21 la misma medida en todos los miembros de un grupo (el bot busca por medida exacta)', G.every(m => new Set(m.map(d => d.medida)).size === 1));
  const activos = cat.filter(d => d.activo);
  const clave = d => d.medida + '|' + d.desc.toUpperCase().replace(/\s+/g, ' ');
  const cuenta = {}; activos.forEach(d => { cuenta[clave(d)] = (cuenta[clave(d)] || []).concat(d.proveedor); });
  const repetidas = activos.filter(d => d.proveedor === 'CHAV' && cuenta[clave(d)].length > 1);
  ok('22 ninguna llanta Chavitar activa sale repetida con otro proveedor (misma medida y descripción)', repetidas.length === 0, repetidas.slice(0, 3).map(d => d.id));
  const solo = ch.filter(d => d.precio_origen === 'propio');
  ok('23 solo-Chavitar (' + solo.length + '): activas (salvo las 2 repetidas) y margen entre 25% y 35% sobre costo con IVA', solo.every(d => (d.activo || d.motivo) && d.margen >= 25 - 0.05 && d.margen <= 35 + 0.05), solo.filter(d => !(d.margen >= 24.95 && d.margen <= 35.05)).slice(0, 3).map(d => [d.id, d.margen]));
  const chEq = ch.filter(d => d.precio_origen === 'equivalente');
  ok('24 con equivalente (' + chEq.length + '): trae la lista de equivalentes y todas existen en el catálogo', chEq.every(d => d.equivalentes && d.equivalentes.length && d.equivalentes.every(e => cat.some(x => x.id === e))));
  ok('25 Chavitar activa con equivalente: margen ≥ 12.5% (ganó por menor costo, así que nunca queda por debajo del margen de Serv/VEGA)', chEq.filter(d => d.activo).every(d => d.margen >= 12.5), chEq.filter(d => d.activo && d.margen < 12.5).slice(0, 3).map(d => [d.id, d.margen]));
  ok('26 Chavitar con equivalente: mismo precio que el equivalente más barato; desc = la del equivalente', chEq.every(d => { const eqs = d.equivalentes.map(e => cat.find(x => x.id === e)); const minP = Math.min(...eqs.map(x => x.precio_contado)); const barato = eqs.slice().sort((a, b) => a.precio_contado - b.precio_contado || (a.proveedor === 'SERV' ? -1 : 1))[0]; return Math.abs(d.precio_contado - minP) < 1e-9 && d.desc === barato.desc; }));
  const rotMal = cat.filter(d => !w.ROTACION_DB[d.marca] || w.ROTACION_DB[d.marca].rotacion !== d.demanda);
  ok('27 demanda de cada documento = rotación vigente del cotizador (ya cuenta Chavitar; incluye marcas nuevas)', rotMal.length === 0, rotMal.slice(0, 3).map(d => d.id + ':' + d.demanda));
  // El activo de cada grupo = la fila marcada "✅ COMPRAR EN" en la búsqueda REAL del cotizador (buscar() + agruparChavitar)
  const llaveDoc = d => d.proveedor === 'CHAV' ? d.clave + '@CHAV' : ((w.CVE_DUP && w.CVE_DUP[d.clave]) ? d.clave + '@' + d.proveedor : d.clave);
  let revisados = 0, saltados = 0, difUI = [];
  const medidas = [...new Set(G.map(m => m[0].medida))];
  const doc = w.document;
  for (const med of medidas) {
    doc.getElementById('qm').value = med; doc.getElementById('qk').value = ''; if (doc.getElementById('qg')) doc.getElementById('qg').value = ''; if (doc.getElementById('qd')) doc.getElementById('qd').value = '';
    w.buscar();
    const txt = doc.getElementById('cnt').textContent, total = parseInt(txt, 10) || 0;
    if (total > 60) { saltados++; continue; }
    const mejores = [...doc.querySelectorAll('#res .ri')].filter(ri => ri.querySelector('.franja-compra') && /COMPRAR EN/.test(ri.querySelector('.franja-compra').textContent)).map(ri => ri.querySelector('.ochk').getAttribute('data-cve'));
    G.filter(m => m[0].medida === med).forEach(m => { const a = m.find(d => d.activo); revisados++; if (!mejores.includes(llaveDoc(a))) difUI.push([a.id, mejores]); });
  }
  ok('28 en ' + revisados + ' grupos, el documento activo del bot es EXACTAMENTE la fila "COMPRAR EN" del buscador del cotizador (' + saltados + ' medidas con más de 60 resultados se omiten)', revisados > 0 && difUI.length === 0, difUI.slice(0, 3));
  ok('29 reglas_precios_bot.json trae las reglas de Chavitar y CHAV entre los proveedores ocultos', reg.chavitar && /30%/.test(reg.chavitar.precio_solo_chavitar) && /SIN IVA/.test(reg.chavitar.proveedor) && /CHAV/.test(reg.proveedor_visible) && /activo/.test(reg.equivalentes_y_duplicados));
  console.log('  ℹ️ documentos: ' + cat.length + ' · activos: ' + activos.length + ' · desactivados por duplicado: ' + (cat.length - activos.length) + ' · grupos: ' + G.length + ' · Chavitar activas: ' + ch.filter(d => d.activo).length + ' (solo-Chavitar ' + solo.length + ')');
  console.log('\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
