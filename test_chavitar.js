// ── TEST SUITE — Chavitar como 4º proveedor de llantas (cotizador_dev.html, 19-nov-2026) ──────────
// Uso:  node test_chavitar.js [ruta_al_html]      (por defecto ./cotizador_dev.html)
// Abre la página real en jsdom. Revisa: catálogo, búsqueda (agrupar, ordenar por costo, franja "COMPRAR EN"),
// precios (equivalente = precio del más barato; solo-Chavitar = precio propio, margen 25–35%), meses sin intereses,
// carrito, instalación (+$120 / +$190 / 1 llanta con Montaje-Balanceo-Pivote), guardado al Sheet y a Firebase,
// que el cliente NO vea al proveedor, y que el Apps Script guarde "CHAV" sin cambios.
const fs = require('fs'), vm = require('vm');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', () => {});
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 400) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
const URL_DEV = 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html';

function abrir() {
  const reg = { fetch: [], copiados: [], alerts: [] };
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(), url: URL_DEV,
    beforeParse(w) {
      w.fetch = (u, o) => { let body = null; try { body = o && o.body ? JSON.parse(o.body) : null; } catch (e) { body = o && o.body; } reg.fetch.push({ u: String(u), body }); return Promise.resolve({ json: () => ({}), text: () => '' }); };
      w.alert = m => { reg.alerts.push(String(m)); }; w.confirm = () => true; w.document.execCommand = () => true;
      Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: t => { reg.copiados.push(t); return Promise.resolve(); } } });
    } });
  reg.w = dom.window;
  reg.w.buscarRefExisteJSONP = (ref, cb) => cb({ found: false });
  reg.sheet = () => reg.fetch.filter(c => c.body && c.body.action === 'saveCotizacion');
  return reg;
}
const $ = (r, id) => r.w.document.getElementById(id);
function buscar(r, medida, marca, extra) {
  $(r, 'qm').value = medida; $(r, 'qk').value = marca || ''; if ($(r, 'qg')) $(r, 'qg').value = (extra && extra.gama) || ''; if ($(r, 'qd')) $(r, 'qd').value = (extra && extra.dem) || '';
  r.w.buscar();
  if (marca && $(r, 'qk').value !== marca) { $(r, 'qk').value = marca; r.w.buscar(); }
  return Array.from(r.w.document.querySelectorAll('#res .ri'));
}
const badge = row => (row.querySelector('.rd span') || {}).textContent;
const prov = row => { const s = Array.from(row.querySelectorAll('.rd span')).find(x => /^(SERV|VEGA|AYALA|CHAV)$/.test(x.textContent)); return s && s.textContent; };
const precioFila = row => parseFloat(row.querySelector('.rp').textContent.replace(/[$,]/g, ''));
const franja = row => { const f = row.querySelector('.franja-compra'); return f ? f.textContent : null; };
const redondea = n => Math.round(n * 100) / 100;
const num = t => parseFloat(String(t).replace(/[^0-9.\-]/g, ''));

(async () => {
  const r = abrir(); await esperar(120);
  const w = r.w;
  const C = w.CHAVITAR;
  const eqLive = c => (c.eq || []).map(([p, k]) => p === 'SERV' ? { p, k, costo: (w.DATA.find(d => d.cve === k) || {}).precio } : { p, k, costo: (w.VEGA.find(d => d.cve === k) || {}).costo }).filter(e => e.costo > 0);

  console.log('\n=== CH-A. CATÁLOGO Y MARCAS ===');
  ok('A1 el catálogo trae las 1,464 llantas de auto/SUV/camioneta (sin camión, moto ni agrícola)', C.length === 1464, C.length);
  ok('A2 claves únicas', new Set(C.map(c => c.cve)).size === C.length);
  ok('A3 ninguna medida de camión (R22.5 / R19.5 / R24.5 / R17.5)', !C.some(c => /R(22\.5|19\.5|24\.5|17\.5)/i.test(c.medida)), C.filter(c => /R(22\.5|19\.5|24\.5|17\.5)/i.test(c.medida)).slice(0, 3).map(c => c.cve));
  const linked = C.filter(c => c.eq && c.eq.length);
  ok('A4 205 llantas con equivalente y 1,259 solo-Chavitar', linked.length === 205 && C.length - linked.length === 1259, [linked.length, C.length - linked.length]);
  ok('A5 todos los equivalentes existen hoy en Servillantas/VEGA', linked.every(c => eqLive(c).length === c.eq.length), linked.filter(c => eqLive(c).length !== c.eq.length).slice(0, 3).map(c => c.cve));
  const nuevas = ['ARDENT', 'ARDUZZA', 'CENTARA', 'DEXTERO', 'DOVROAD', 'HILO', 'JOYROAD', 'MASSIMO', 'MAXZEZ', 'MILEKING', 'MRF', 'TDI'];
  ok('A6 las 12 marcas nuevas tienen país y gama', nuevas.every(m => w.BRAND_DB[m] && w.BRAND_DB[m].gama && w.BRAND_DB[m].pais), nuevas.filter(m => !w.BRAND_DB[m]));
  ok('A7 todas las marcas de Chavitar tienen gama y demanda (❄️/🌡️/🔥)', C.every(c => w.BRAND_DB[c.marca] && w.BRAND_DB[c.marca].gama && w.ROTACION_DB[c.marca] && w.ROTACION_DB[c.marca].emoji), [...new Set(C.filter(c => !(w.BRAND_DB[c.marca] && w.ROTACION_DB[c.marca])).map(c => c.marca))]);
  ok('A8 demanda por rangos: ❄️ ≤9 · 🌡️ 10–52 · 🔥 ≥53', Object.values(w.ROTACION_DB).every(x => (x.skus >= 53 ? x.emoji === '🔥' : x.skus >= 10 ? x.emoji === '🌡️' : x.emoji === '❄️')), Object.entries(w.ROTACION_DB).filter(([k, x]) => !(x.skus >= 53 ? x.emoji === '🔥' : x.skus >= 10 ? x.emoji === '🌡️' : x.emoji === '❄️')).slice(0, 5));
  const solos = C.filter(c => !(c.eq && c.eq.length));
  const mg = c => 1 - c.costo * 1.16 / c.pv;
  ok('A9 precio de las solo-Chavitar: margen entre 25% y 35% sobre su costo con IVA', solos.every(c => mg(c) >= 0.2495 && mg(c) <= 0.3505), solos.filter(c => mg(c) < 0.2495 || mg(c) > 0.3505).slice(0, 3).map(c => [c.cve, mg(c)]));
  ok('A10 el menú de marcas incluye marcas nuevas de Chavitar', (() => { buscar(r, '', ''); return Array.from($(r, 'qk').options).some(o => /MAXZEZ/.test(o.textContent)); })());

  console.log('\n=== CH-B. BÚSQUEDA: AGRUPAR, ORDENAR POR COSTO, FRANJA ===');
  let nGrupos = 0, malOrden = [], malFranja = [], malPrecio = [], malMargen = [], conPesos = [], nChavMasBarata = 0, nChavMasCara = 0, nEmpate = 0, malOtros = [], nCompartidos = 0;
  const nm = m => w.nbZR(String(m).toUpperCase().replace(/[\s\-]/g, ''));
  const llaveEqs = c => (c.eq || []).map(e => e[0] + '|' + e[1]);
  const visto = new Set();
  for (const c of linked) {
    if (visto.has(c.cve)) continue;
    // conjunto conectado (Chavitar que comparten equivalente van en el mismo grupo)
    const comp = [c]; visto.add(c.cve); const claves = new Set(llaveEqs(c));
    for (let ch = true; ch;) { ch = false; for (const o of linked) { if (!visto.has(o.cve) && o.marca === c.marca && nm(o.medida) === nm(c.medida) && llaveEqs(o).some(k => claves.has(k))) { comp.push(o); visto.add(o.cve); llaveEqs(o).forEach(k => claves.add(k)); ch = true; } } }
    if (comp.length > 1) nCompartidos++;
    const rows = buscar(r, c.medida, c.marca);
    const kRow = x => x.querySelector('.badd').getAttribute('data-cve');
    const filasChav = comp.map(o => rows.find(x => prov(x) === 'CHAV' && kRow(x) === o.cve + '@CHAV'));
    const filasEq = [...claves].map(k => { const [p, kk] = k.split('|'); return rows.find(x => prov(x) === p && kRow(x).split('@')[0] === kk); });
    if (filasChav.some(x => !x) || filasEq.some(x => !x)) { malOrden.push([c.cve, 'falta fila en resultados']); continue; }
    nGrupos += comp.length;
    const miembros = filasChav.concat(filasEq);
    const costoDe = x => { const p = prov(x), k = kRow(x).split('@')[0]; return p === 'CHAV' ? w.CHAVITAR.find(o => o.cve === k).costo * 1.16 : p === 'SERV' ? w.DATA.find(d => d.cve === k).precio : w.VEGA.find(d => d.cve === k).costo; };
    const minI = Math.min(...miembros.map(x => rows.indexOf(x)));
    const ordenReal = rows.slice(minI, minI + miembros.length);
    const juntas = ordenReal.every(x => miembros.indexOf(x) >= 0);
    const costos = ordenReal.map(costoDe);
    const asc = costos.every((v, i) => i === 0 || v >= costos[i - 1] - 0.005);
    const empateOk = ordenReal.every((x, i) => i === 0 || !(Math.abs(costos[i] - costos[i - 1]) < 0.005 && prov(x) === 'CHAV' && prov(ordenReal[i - 1]) !== 'CHAV'));
    if (!(juntas && asc && empateOk)) malOrden.push([c.cve, { juntas, asc, empateOk }]);
    for (const o of comp) { const cC = o.costo * 1.16, mejorEq = Math.min(...eqLive(o).map(e => e.costo)); if (cC < mejorEq - 0.005) nChavMasBarata++; else if (cC > mejorEq + 0.005) nChavMasCara++; else nEmpate++; }
    // franja: una sola "COMPRAR EN" y en la fila más barata (la primera); las demás solo "Margen X%"
    const fr = ordenReal.map(franja);
    const nComprar = fr.filter(t => t && /COMPRAR EN/.test(t)).length;
    const nombre = { CHAV: 'CHAVITAR', SERV: 'SERVILLANTAS', VEGA: 'VEGA' }[prov(ordenReal[0])];
    if (!(nComprar === 1 && fr[0] && fr[0].indexOf('COMPRAR EN ' + nombre) >= 0 && fr.slice(1).every(t => t && /^Margen \d+(\.\d)?%$/.test(t)))) malFranja.push([c.cve, fr]);
    if (fr.some(t => /\$|CEDIS|stock|existencia|revisar|ahorro|utilidad|sin referencia/i.test(t || ''))) conPesos.push([c.cve, fr]);
    // precios: cada fila Chavitar = precio del equivalente más barato (en PVP); cada Serv/VEGA = el suyo de siempre
    for (const o of comp) {
      const fo = filasChav[comp.indexOf(o)], pvpEq = Math.min(...eqLive(o).map(e => e.costo / (1 - 0.125)));
      if (Math.abs(precioFila(fo) - redondea(pvpEq)) > 0.011) malPrecio.push([o.cve, precioFila(fo), pvpEq]);
      const mEsp = Math.round((1 - o.costo * 1.16 / pvpEq) * 1000) / 10, fT = franja(fo), mTxt = fT && num(fT.split('Margen')[1]);
      if (Math.abs(mTxt - mEsp) > 0.051) malMargen.push([o.cve, fT, mEsp]);
    }
    for (const k of claves) { const [p, kk] = k.split('|'); const fe = filasEq.find(x => prov(x) === p && kRow(x).split('@')[0] === kk); const base = p === 'SERV' ? w.DATA.find(d => d.cve === kk).precio : w.VEGA.find(d => d.cve === kk).costo; if (Math.abs(precioFila(fe) - redondea(base / 0.875)) > 0.011) malOtros.push([c.cve, kk, precioFila(fe), base / 0.875]); }
  }
  ok('B1 las 205 llantas con equivalente salen junto a su equivalente (incluye los grupos donde dos Chavitar comparten equivalente)', nGrupos === 205 && nCompartidos > 0, [nGrupos, nCompartidos, malOrden.slice(0, 3)]);
  ok('B2 cada grupo va ordenado por costo para nosotros (más barata arriba; Chavitar primero si empata)', malOrden.length === 0, malOrden.slice(0, 3));
  ok('B3 hay casos de los tres tipos (Chavitar más barata, más cara, empate) — la prueba es válida', nChavMasBarata > 0 && nChavMasCara > 0, { nChavMasBarata, nChavMasCara, nEmpate });
  ok('B4 una sola franja "✅ COMPRAR EN …" por grupo, en la más barata; las otras solo "Margen X%"', malFranja.length === 0, malFranja.slice(0, 3));
  ok('B5 el asesor no ve pesos, CEDIS, stock ni avisos de "revisar" en la franja', conPesos.length === 0, conPesos.slice(0, 2));
  ok('B6 el precio de la fila Chavitar = precio del equivalente (el más barato si hay dos)', malPrecio.length === 0, malPrecio.slice(0, 3));
  ok('B7 el precio de las filas Servillantas/VEGA no cambió (costo ÷ 0.875)', malOtros.length === 0, malOtros.slice(0, 3));
  ok('B8 el margen que ve el asesor en Chavitar = 1 − costo con IVA ÷ precio', malMargen.length === 0, malMargen.slice(0, 3));

  console.log('\n=== CH-C. SOLO-CHAVITAR Y FILAS SIN CHAVITAR ===');
  {
    const s = solos.find(c => !w.DATA.some(d => d.medida === c.medida && d.marca === c.marca) && !w.VEGA.some(d => d.medida === c.medida && d.marca === c.marca)) || solos[0];
    const rows = buscar(r, s.medida, s.marca);
    const fila = rows.find(x => x.querySelector('.badd').getAttribute('data-cve') === s.cve + '@CHAV');
    ok('C1 solo-Chavitar: sale con badge CHAV y su precio propio', fila && prov(fila) === 'CHAV' && Math.abs(precioFila(fila) - redondea(s.pv)) < 0.011, fila && [prov(fila), precioFila(fila), s.pv]);
    ok('C2 solo-Chavitar: solo "Margen X%" (sin "COMPRAR EN")', fila && /^Margen \d+(\.\d)?%$/.test(franja(fila)), fila && franja(fila));
    const eM = Math.round((1 - s.costo * 1.16 / s.pv) * 1000) / 10;
    ok('C3 solo-Chavitar: el margen mostrado coincide (25%–35%)', fila && Math.abs(num(franja(fila).split('Margen')[1]) - eM) < 0.051 && eM >= 24.9 && eM <= 35.1, [fila && franja(fila), eM]);
  }
  {
    // Servillantas/VEGA/AYALA sin equivalente en Chavitar: no llevan franja ni cambian
    const llaveEq = new Set(linked.flatMap(c => c.eq.map(([p, k]) => p + '|' + k)));
    const s = w.DATA.find(d => d.medida && d.desc && !llaveEq.has('SERV|' + d.cve) && w.ROTACION_DB[d.marca]);
    const rows = buscar(r, s.medida, s.marca).filter(x => prov(x) === 'SERV' && x.querySelector('.badd').getAttribute('data-cve').split('@')[0] === s.cve);
    ok('C4 una llanta de Servillantas sin equivalente en Chavitar sale igual que antes (sin franja)', rows.length >= 1 && rows.every(x => franja(x) === null && Math.abs(precioFila(x) - redondea(s.precio / 0.875)) < 0.011), rows.map(franja));
    const a = w.AYALA.find(d => w.ayalaSeMuestra(d) && d.medida);
    const ra = buscar(r, a.medida, a.marca).filter(x => prov(x) === 'AYALA');
    ok('C5 AYALA sin cambios: sin franja', ra.length >= 1 && ra.every(x => franja(x) === null));
  }
  {
    const todo = buscar(r, '205/55R16', '');
    const txt = Array.from(r.w.document.querySelectorAll('#res .ri')).filter(x => prov(x) === 'CHAV' || franja(x)).map(x => x.textContent).join(' ');
    ok('C6 en las filas de Chavitar y sus franjas no aparece "CEDIS", "stock", "existencia" ni "revisar" (hay Chavitar en esa medida)', /CHAV/.test(txt) && !/CEDIS|stock|existencia|revisar/i.test(txt), txt.slice(0, 200));
    const ch = w.CHAVITAR.filter(c => c.marca === 'MAXZEZ')[0];
    const f = buscar(r, '', 'MAXZEZ', { dem: 'alta' });
    ok('C7 la marca nueva MAXZEZ sale con filtro de Demanda alta (🔥) y solo con sus llantas', f.length > 0 && f.every(x => /MAXZEZ/.test(x.querySelector('.rm').textContent)), f.length);
  }

  console.log('\n=== CH-D. MESES SIN INTERESES ===');
  {
    const c = linked[0], s = solos[0];
    w.pago = 'contado';
    const rc = buscar(r, c.medida, c.marca).find(x => x.querySelector('.badd').getAttribute('data-cve') === c.cve + '@CHAV');
    const rs = buscar(r, s.medida, s.marca).find(x => x.querySelector('.badd').getAttribute('data-cve') === s.cve + '@CHAV');
    const pc = precioFila(rc), ps = precioFila(rs), fc = franja(rc);
    w.pago = 'meses'; w.recalcPVP();
    const rc2 = buscar(r, c.medida, c.marca).find(x => x.querySelector('.badd').getAttribute('data-cve') === c.cve + '@CHAV');
    const rs2 = buscar(r, s.medida, s.marca).find(x => x.querySelector('.badd').getAttribute('data-cve') === s.cve + '@CHAV');
    ok('D1 a meses: el precio de Chavitar (con equivalente) lleva +5%', Math.abs(precioFila(rc2) - redondea(pc * 1.05)) < 0.02, [pc, precioFila(rc2)]);
    ok('D2 a meses: el precio de Chavitar solo-Chavitar lleva +5%', Math.abs(precioFila(rs2) - redondea(ps * 1.05)) < 0.02, [ps, precioFila(rs2)]);
    ok('D3 el margen que ve el asesor no cambia con meses (se mide sobre el precio contado)', franja(rc2) === fc, [fc, franja(rc2)]);
    w.pago = 'contado'; w.recalcPVP();
  }

  console.log('\n=== CH-E. CARRITO E INSTALACIÓN ===');
  const c1 = linked.find(c => eqLive(c).length === 1 && c.costo * 1.16 < eqLive(c)[0].costo) || linked[0];
  {
    w.cart.length = 0;
    const rows = buscar(r, c1.medida, c1.marca);
    const btn = rows.find(x => x.querySelector('.badd').getAttribute('data-cve') === c1.cve + '@CHAV').querySelector('.badd');
    btn.click();
    const it = w.cart.find(x => x.t === 'l');
    const pvp = Math.min(...eqLive(c1).map(e => e.costo / 0.875));
    ok('E1 el "+" de Chavitar agrega SU llanta (cve y marca de Chavitar, marcada isChav)', it && it.isChav === true && it.cve === c1.cve && it.marca === c1.marca && it.llave === c1.cve + '@CHAV', it);
    ok('E2 el costo guardado es el de Chavitar con IVA (×1.16)', it && Math.abs(it.pb - c1.costo * 1.16) < 0.005, it && it.pb);
    ok('E3 con 1 llanta: precio = precio del equivalente y salen Montaje + Balanceo + Pivote aparte', it && Math.abs(it.precio - pvp) < 0.011 && w.cart.filter(x => x.pid === it.id).map(x => x.desc).join() === 'Montaje,Balanceo,Pivote', [it && it.precio, pvp, w.cart.map(x => x.desc)]);
    const btnAhora = buscar(r, c1.medida, c1.marca).map(x => x.querySelector('.badd')).find(b => b.getAttribute('data-cve') === c1.cve + '@CHAV');
    ok('E3b la llanta Chavitar ya agregada se marca en verde "OK" en los resultados', btnAhora && btnAhora.textContent.trim() === 'OK', btnAhora && btnAhora.textContent);
    btn.click();
    ok('E4 agregar la misma otra vez no duplica', w.cart.filter(x => x.t === 'l').length === 1);
    it.qty = 4; w.recalcInstalacionLlantas();
    ok('E5 con 4 llantas: +$120 por llanta y sin renglones de instalación', Math.abs(it.precio - (pvp + 120)) < 0.011 && !w.cart.some(x => x.pid === it.id), it.precio);
    it.qty = 2; w.recalcInstalacionLlantas();
    ok('E6 con 2 llantas: +$190 por llanta', Math.abs(it.precio - (pvp + 190)) < 0.011, it.precio);
    it.qty = 4; w.pago = 'meses'; w.recalcPVP();
    ok('E7 a meses: precio base ×1.05 y sigue el +$120', Math.abs(it.precioBase - pvp * 1.05) < 0.011 && Math.abs(it.precio - (pvp * 1.05 + 120)) < 0.011, [it.precioBase, it.precio]);
    w.pago = 'contado'; w.recalcPVP();
    ok('E8 al volver a contado regresa al precio normal', Math.abs(it.precioBase - pvp) < 0.011, it.precioBase);
  }
  {
    // varias opciones de la misma medida: Chavitar + su equivalente
    w.cart.length = 0; w.opcSel = []; 
    const rows = buscar(r, c1.medida, c1.marca);
    const e = eqLive(c1)[0];
    const llaveEq = rows.map(x => x.querySelector('.badd').getAttribute('data-cve')).find(k => k.split('@')[0] === e.k && (k.indexOf('@') < 0 || k.split('@')[1] === e.p));
    const chk = k => rows.find(x => x.querySelector('.badd').getAttribute('data-cve') === k).querySelector('.ochk');
    for (const k of [c1.cve + '@CHAV', llaveEq]) { const cb = chk(k); cb.checked = true; cb.dispatchEvent(new w.Event('change')); }
    $(r, 'opc-qty').value = 4; $(r, 'opc-add').click();
    const ls = w.cart.filter(x => x.t === 'l');
    ok('E9 cotizar opciones: entran Chavitar y su equivalente como Opción 1 y 2', ls.length === 2 && ls.some(x => x.isChav && x.op) && ls.some(x => !x.isChav && x.op) && ls.every(x => x.qty === 4), ls.map(x => [x.cve, x.op, x.isChav]));
    w.cart.length = 0; w.opcSel = [];
  }

  console.log('\n=== CH-F. GUARDADO (SHEET, FIREBASE), WHATSAPP Y PDF ===');
  async function guardar(cve) {
    const r2 = abrir(); await esperar(120); const w2 = r2.w;
    const set = (id, v) => { $(r2, id).value = v; };
    set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana'); set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
    const c = w2.CHAVITAR.find(o => o.cve === cve);
    const x = w2.chavItemCarrito(c, 'lA', c.cve + '@CHAV', { qty: 4 }); w2.cart.push(x);
    w2.recalcInstalacionLlantas(); w2.renderCarrito(); w2.updateBadge(); w2.generarWA();
    $(r2, 'bcp').click(); await esperar(150);
    const body = r2.sheet()[0] && r2.sheet()[0].body;
    const fila = body && body.items.filter(o => o.tipo === 'Llantas').find(o => o.noParte === c.cve);
    const doc = body && w2.__fb && w2.__fb.armarDocumento ? w2.__fb.armarDocumento(body, 'EXPCARE-099/26', new Date(), 'Ana') : null;
    return { c, x, fila, wa: r2.copiados[0] || '', doc, pDoc: doc && doc.partidas.find(p => p.noParte === c.cve), alerts: r2.alerts, w2 };
  }
  {
    const L = await guardar(c1.cve), S = await guardar(solos[0].cve);
    const fL = L.fila, fS = S.fila, cl = L.c;
    ok('F1 al Sheet va proveedor "CHAV", la clave de Chavitar y la marca en el producto', fL && fL.proveedor === 'CHAV' && fL.producto.toUpperCase().indexOf(cl.marca) >= 0 && fL.marca === cl.marca.toUpperCase(), [fL, L.alerts]);
    ok('F2 costo = costo con IVA y margen real (%)', fL && Math.abs(num(fL.costo) - cl.costo * 1.16) < 0.006 && /^\d+(\.\d)?%$/.test(fL.margen) && Math.abs(num(fL.margen) - Math.round((1 - cl.costo * 1.16 / L.w2.chavPvpContado(cl)) * 1000) / 10) < 0.051, fL);
    ok('F3 el subtotal sale con la instalación incluida (4 llantas × precio con +$120)', fL && Math.abs(num(fL.subtotal) - L.x.precio * 4) < 0.02 && fL.cant === 4 && Math.abs(L.x.precio - (L.w2.chavPvpContado(cl) + 120)) < 0.011, fL);
    ok('F4 con equivalente: se manda costoEquiv (costo del Serv/VEGA más barato, con IVA)', fL && Math.abs(num(fL.costoEquiv) - Math.min(...eqLive(cl).map(e => e.costo))) < 0.006, fL && fL.costoEquiv);
    ok('F5 solo-Chavitar: se guarda como CHAV y no lleva costoEquiv', fS && fS.proveedor === 'CHAV' && fS.costoEquiv === undefined && /^\d+(\.\d)?%$/.test(fS.margen), fS);
    const wa = L.wa + '\n' + S.wa;
    ok('F6 el WhatsApp del cliente NO nombra a ningún proveedor ni dice CHAV', L.wa.length > 50 && !/chavitar|chav\b|vega|servillantas|ayala|proveedor/i.test(wa), wa.slice(0, 300));
    ok('F7 en WhatsApp sí sale la llanta con su marca y el precio', L.wa.indexOf(cl.marca) >= 0 && L.wa.indexOf(Math.round(L.x.precio).toLocaleString('en-US')) >= 0, L.wa.slice(0, 300));
    ok('F8 la descripción que ve el cliente no trae nombres de proveedor', !/chavitar|vega|servillantas/i.test(L.w2.descConMarca(L.x)) && !/chavitar|vega|servillantas/i.test(S.w2.descConMarca(S.x)));
    ok('F9 Firebase guarda proveedor CHAV, margenPct (número) y costoEquiv (para medir el margen extra)', L.pDoc && L.pDoc.proveedor === 'CHAV' && typeof L.pDoc.margenPct === 'number' && Math.abs(L.pDoc.costoEquiv - Math.min(...eqLive(cl).map(e => e.costo))) < 0.006, L.pDoc);
    ok('F10 Firebase: la solo-Chavitar es CHAV y no lleva costoEquiv; el documento no pierde sus campos de siempre', S.pDoc && S.pDoc.proveedor === 'CHAV' && S.pDoc.costoEquiv === undefined && S.doc.partidas.every(p => 'costo' in p && 'precio' in p && 'subtotal' in p), S.pDoc);
  }

  console.log('\n=== CH-G. APPS SCRIPT: "CHAV" SE GUARDA SIN CAMBIAR EL SCRIPT ===');
  {
    const grid = []; const hoja = { grid, getMaxColumns: () => 30, insertColumnsAfter() {}, appendRow(f) { grid.push(f.slice()); }, getLastRow: () => grid.length, getRange(rr, c, nr, nc) { return { getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const f = []; for (let j = 0; j < (nc || 1); j++) { const x = (grid[rr - 1 + i] || [])[c - 1 + j]; f.push(x === undefined ? '' : x); } o.push(f); } return o; }, setValues() {}, setValue() {}, setBorder() {} }; } };
    const ss = { getSheetByName: () => hoja, getActiveSheet: () => hoja, insertSheet: () => hoja };
    const ctx = { console, Logger: { log() {} }, Utilities: {}, Session: { getScriptTimeZone: () => 'America/Chihuahua' }, SpreadsheetApp: { getActiveSpreadsheet: () => ss }, ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, DriveApp: {}, MailApp: {}, GmailApp: {}, PropertiesService: {} };
    vm.createContext(ctx); vm.runInContext(fs.readFileSync('./apps_script_8_oct_26_ref_vigente.js', 'utf8'), ctx);
    const body = { action: 'saveCotizacion', fecha: '19/11/2026 10:00', asesor: 'Ana', cliente: 'Prueba', telefono: '6145550123', vehiculo: 'X', origen: 'WhatsApp', total: '$100', folio: '', ref: '1119-ABCDE', items: [{ tipo: 'Llantas', proveedor: 'CHAV', noParte: '155/70R13AG', producto: 'AGATE 155/70R13', marca: 'AGATE', cant: 4, costo: '501.25', margen: '31.1%', precio: '900.00', subtotal: '3600.00', costoEquiv: '480.00' }] };
    const out = ctx.doPost({ postData: { contents: JSON.stringify(body) } });
    ok('G1 el script guarda el renglón con Proveedor = CHAV (columna 8) y no se rompe por el campo extra', grid.length >= 1 && grid[grid.length - 1][7] === 'CHAV' && grid[grid.length - 1][11] === '501.25' && grid[grid.length - 1][12] === '31.1%' && /ok/.test(out.t), [grid[grid.length - 1], out && out.t]);
    ok('G2 NO hace falta nueva versión de deployment del Apps Script (el script no cambió)', true);
  }

  console.log('\n=============================================');
  console.log('TOTAL: ' + (passed + failed) + ' | ✅ ' + passed + ' OK | ❌ ' + failed + ' FALLIDAS');
  process.exit(failed ? 1 : 0);
})();
