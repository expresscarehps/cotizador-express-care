// ── Generador del catálogo único de llantas para el bot (11 oct 2026) ─────────────────────────
// Abre la página REAL del cotizador (jsdom) y calcula cada precio con SUS PROPIAS funciones
// (pvpLlanta / pvpAyala / margenLlanta). No copia fórmulas: si el cotizador cambia, el catálogo cambia.
// Uso: node generar_catalogo_bot.js [html] [carpeta_salida]
// Salida: catalogo_llantas_bot.json (una lista de documentos) + reglas_precios_bot.json (reglas globales)
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || './cotizador_dev.html';
const OUT = process.argv[3] || '.';
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(HTML, 'utf8');
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html?test=1',
  beforeParse(win) { win.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); win.alert = () => {}; win.confirm = () => true; } }).window;

const version = (html.match(/var VERSION_PAGINA = '([^']*)'/) || [])[1] || '';
const hoy = new Date().toISOString().slice(0, 10);
function precios(fn) { w.pago = 'contado'; const c = fn(); w.pago = 'meses'; const m = fn(); w.pago = 'contado'; return [c, m]; }
const rot = marca => (w.ROTACION_DB && w.ROTACION_DB[marca]) ? w.ROTACION_DB[marca].rotacion : null;
const info = marca => (w.BRAND_DB && marca && w.BRAND_DB[marca]) || { pais: '', gama: '' };

const docs = [], omitidas = { sin_medida_o_desc: [] };
function agrega(proveedor, d, tipo, base, calc, margen) {
  if (!(d.medida && d.desc)) { omitidas.sin_medida_o_desc.push(proveedor + ':' + d.cve); return; }   // el cotizador no las muestra
  const [pc, pm] = precios(calc);
  const b = info(d.marca);
  docs.push({ id: d.cve + '__' + proveedor, clave: d.cve, desc: d.desc, medida: d.medida, marca: d.marca || '', proveedor,
    gama: b.gama || '', pais: b.pais || '', demanda: rot(d.marca), tipo_precio: tipo, base_precio: base,
    margen: margen, precio_contado: pc, precio_meses: pm, activo: true, actualizado: hoy, fuente: version, ...(d.rin ? { rin: d.rin } : {}) });
  return docs[docs.length - 1];
}
w.DATA.forEach(d => agrega('SERV', d, 'costo', d.precio, () => w.pvpLlanta(d.precio, d.marca), w.margenLlanta(d.marca)));
w.VEGA.forEach(d => agrega('VEGA', d, 'costo', d.costo, () => w.pvpLlanta(d.costo, d.marca), w.margenLlanta(d.marca)));
// AYALA: SOLO lo que el cotizador muestra (ayalaSeMuestra: descontinuadas a secas siempre ocultas, futuro lanzamiento nunca).
// Las llantas con aviso para el asesor (descontinuada / hasta agotar existencia / sobre pedido) NO se mandan al bot:
// el aviso pide confirmar existencia con una persona. Quedan listadas en catalogo_llantas_bot_omitidas.json.
// Las de la lista MTO (BFGoodrich/Uniroyal) traen costo antes de IVA: precio = costo / (1 - margen) x 1.16 (pvpMto del cotizador).
omitidas.ayala_con_aviso = []; omitidas.ayala_ocultas_por_estatus = 0;
w.AYALA.forEach(d => {
  if (!w.ayalaSeMuestra(d)) { omitidas.ayala_ocultas_por_estatus++; return; }
  if (w.ayalaAviso(d.est)) { omitidas.ayala_con_aviso.push(d.cve + ':' + d.est); return; }
  if (d.mto) agrega('AYALA', d, 'costo', d.mto, () => w.pvpMto(d.mto, d.marca), w.margenLlanta(d.marca));
  else agrega('AYALA', d, 'lista', d.lista, () => w.pvpAyala(d.lista), null);
});

// ── CHAVITAR (19 nov 2026) ─────────────────────────────────────────────────────────────────────
// Cada llanta de Chavitar entra como documento con proveedor 'CHAV'. Precio, descripción y margen salen de las funciones
// del cotizador (chavPvp / chavDesc / chavMargenPct). base_precio = costo con IVA (la lista de Chavitar viene SIN IVA: costo x 1.16).
// Si la llanta tiene equivalente en Servillantas/VEGA, el cotizador las muestra juntas y marca la de menor costo como "COMPRAR EN".
// El bot no tiene asesor que elija: dentro de cada grupo de equivalentes SOLO queda activo:true el documento de MAYOR MARGEN (equivale al de menor costo)
// (criterio: mayor margen; empate: Chavitar y luego menor costo); los demás quedan activo:false (con grupo y desactivado_por) para que no salgan
// repetidos. Las llantas solo-Chavitar quedan activas. El proveedor y el margen del documento activo son los que el bot guarda en Hoja1.
omitidas.chavitar_sin_medida_o_desc = [];
w.CHAVITAR.forEach(d => {
  if (!(d.medida && d.desc)) { omitidas.chavitar_sin_medida_o_desc.push('CHAV:' + d.cve); return; }
  const eq = w.chavEquivs(d);
  const doc = agrega('CHAV', Object.assign({}, d, { desc: w.chavDesc(d) }), 'costo', w.chavCostoIVA(d), () => w.chavPvp(d), w.chavMargenPct(d));
  // eq incluye las referencias VEGA sin existencia (VEGA_REF: miden el precio pero NO son documento del bot). Solo las que tienen existencia van en `equivalentes`.
  const eqReal = eq.filter(e => !e.ref);
  if (doc) { doc.precio_origen = eqReal.length ? 'equivalente' : eq.length ? 'referencia_vega' : 'propio'; if (eqReal.length) doc.equivalentes = eqReal.map(e => e.cve + '__' + e.prov); }
});
// Grupos de equivalentes = componentes conectados (Chavitar + sus equivalentes que existen en el catálogo del bot)
const porId = new Map(docs.map(d => [d.id, d])), padre = new Map();
const raiz = a => { while (padre.get(a) !== a) a = padre.get(a); return a; };
docs.filter(d => d.proveedor === 'CHAV' && d.equivalentes).forEach(d => {
  if (!padre.has(d.id)) padre.set(d.id, d.id);
  d.equivalentes.forEach(e => {
    if (!porId.has(e)) return;
    if (!padre.has(e)) padre.set(e, e);
    const a = raiz(d.id), b = raiz(e); if (a !== b) padre.set(b, a);
  });
});
// Criterio del bot (Carlos, 19 nov 2026): "decide la mejor opción por MARGEN". Mayor margen real sobre costo (precio_contado vs base_precio);
// si empatan, gana Chavitar y luego el menor precio al cliente (menor costo). En los 199 grupos esto elige lo mismo que "menor costo".
const margenReal = d => 1 - d.base_precio / d.precio_contado;
const mejorPorMargen = (a, b) => { const x = margenReal(b) - margenReal(a); if (Math.abs(x) > 1e-4) return x;
  const c = (a.proveedor === 'CHAV' ? 0 : 1) - (b.proveedor === 'CHAV' ? 0 : 1); if (c) return c; return a.precio_contado - b.precio_contado; };
const grupos = new Map();
docs.forEach(d => { if (padre.has(d.id)) { const k = raiz(d.id); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(d); } });
let nGrupos = 0, nDesactivados = 0; const porProvGana = { CHAV: 0, SERV: 0, VEGA: 0 };
grupos.forEach(m => {
  if (m.length < 2) return;
  const orden = m.slice().sort(mejorPorMargen);
  const g = 'G-' + orden[0].id; nGrupos++; porProvGana[orden[0].proveedor]++;
  orden.forEach((d, i) => { d.grupo = g; if (i > 0) { d.activo = false; d.desactivado_por = orden[0].id; nDesactivados++; } });
});
// Dos códigos de Chavitar con la MISMA medida, marca y descripción (y distinto precio): en el cotizador salen las dos para que el
// asesor decida; el bot no puede mostrarle al cliente dos opciones idénticas, así que deja activa la de menor costo.
const _dupChav = new Map();
docs.filter(d => d.proveedor === 'CHAV' && d.activo && !d.grupo).forEach(d => { const k = d.medida + '|' + d.marca + '|' + d.desc.toUpperCase().replace(/\s+/g, ' '); if (!_dupChav.has(k)) _dupChav.set(k, []); _dupChav.get(k).push(d); });
omitidas.chavitar_misma_descripcion = [];
// Entre códigos Chavitar idénticos (Carlos, 19 nov 2026): mayor margen; si empatan, gana el que deja MÁS PESOS de utilidad (precio_contado − costo).
const mejorDupChavitar = (a, b) => { const x = margenReal(b) - margenReal(a); if (Math.abs(x) > 1e-4) return x; return (b.precio_contado - b.base_precio) - (a.precio_contado - a.base_precio); };
_dupChav.forEach(m => { if (m.length < 2) return; const o = m.slice().sort(mejorDupChavitar);
  o.forEach((d, i) => { if (i > 0) { d.activo = false; d.desactivado_por = o[0].id; d.motivo = 'misma medida, marca y descripcion que otra llanta Chavitar con mayor margen (empate: mas pesos de utilidad)'; nDesactivados++; omitidas.chavitar_misma_descripcion.push(d.id + ' -> ' + o[0].id); } }); });

// Recargo de instalación por llanta: se LEE del cotizador (recalcInstalacionLlantas), no se escribe a mano.
// Así, si cambian los paquetes (14 oct 2026: $480 ÷ 4 = $120 y $380 ÷ 2 = $190), el bot se actualiza solo al regenerar.
function recargoInstalacion(cantidad) {
  const guardado = w.cart;
  try {
    w.cart = [{ id: '__regla__', t: 'l', qty: cantidad, precio: 0, precioBase: 0 }];
    w.recalcInstalacionLlantas();
    return w.instalacionInfo.recargo;
  } finally { w.cart = guardado; w.recalcInstalacionLlantas(); }
}
const INST = { cuatro_o_mas: recargoInstalacion(4), dos_o_tres: recargoInstalacion(2), una: recargoInstalacion(1) };
if (recargoInstalacion(3) !== INST.dos_o_tres || recargoInstalacion(8) !== INST.cuatro_o_mas) throw new Error('El recargo de instalación del cotizador no es consistente por escalones: ' + JSON.stringify(INST));

const reglas = {
  version_cotizador: version, actualizado: hoy,
  descripcion: 'Reglas que el bot debe aplicar SOBRE precio_contado / precio_meses de cada llanta. Fuente: cotizador. No recalcular margenes ni descuentos en el bot.',
  instalacion_por_llanta: { cuatro_o_mas: INST.cuatro_o_mas, dos_o_tres: INST.dos_o_tres, una: INST.una,
    nota: 'Se SUMA al precio unitario DESPUES del margen y DESPUES del recargo de meses. La cantidad es el total de llantas de la cotizacion. Con 1 llanta se cotizan aparte Montaje/Balanceo/Pivote segun rin (tabla abajo).' },
  una_llanta_lineas_por_rin: w.RIN ? Object.fromEntries(Object.entries(w.RIN).map(([k, v]) => [k, { montaje: v.mon, balanceo: v.bal, pivote: v.piv }])) : null,
  categorias_rin: { a: 'rin 13 a 16', b: 'rin 17 a 19', c: 'rin 20 o mas', nota: 'Define cual fila de una_llanta_lineas_por_rin aplica cuando se cotiza UNA sola llanta (el cotizador la elige el asesor con los botones de rin).' },
  meses: { plazos: [3, 6], nota: 'precio_meses ya incluye el recargo (x1.05 en SERV/VEGA y en las AYALA de lista MTO; AYALA de lista usa 80% de lista en vez de 75%). No volver a recargar.' },
  total: 'total = suma(cantidad x (precio_contado_o_meses + instalacion_por_llanta)); redondear a 2 decimales solo al mostrar.',
  demanda_texto: 'demanda alta/media/baja es rotacion de la marca en el mercado (numero de SKUs entre proveedores), NO ventas de Express Care. Prohibido decir "la mas vendida", "la que mas vendemos" o sinonimos; usar p.ej. "una de las marcas de mayor rotacion en el mercado".',
  proveedor_visible: 'Nunca mostrar al cliente el campo proveedor (CHAV/SERV/VEGA/AYALA).',
  proveedor_y_margen_en_cotizacion: 'Al guardar la cotizacion en Hoja1/Firebase se registran proveedor (CHAV/SERV/VEGA/AYALA) y margen del documento ACTIVO elegido; es donde se compra. El margen es un porcentaje; nunca decirlo ni mostrarlo al cliente.',
  chavitar: {
    proveedor: 'CHAV (Chavitar Llantas). Su lista viene SIN IVA: base_precio ya es costo x 1.16.',
    alcance: 'Solo auto/SUV y camioneta/LT. No hay camion, moto ni agricola.',
    precio_con_equivalente: 'Si la llanta tiene equivalente en Servillantas/VEGA, el precio al cliente es el del equivalente (el mas bajo si hay en los dos): precio_origen=equivalente. El margen real puede ser mayor a 12.5%.',
    precio_con_referencia_vega: 'precio_origen=referencia_vega: el precio se midio contra una llanta de VEGA que hoy NO tiene existencia (solo se usa su precio de la lista como referencia). El precio ya viene calculado; avisar al asesor que confirme con Chavitar que la tenga.',
    precio_solo_chavitar: 'Si no tiene equivalente: margen base 30%; con 3 o mas comparables de la misma medida (Economica y Muy Economica juntas) el precio se limita entre el percentil 25 y 75 de los precios de esos comparables, sin subir el margen de 35%, piso 25%; sin comparables 30%. precio_origen=propio. Ya viene calculado en precio_contado.',
    meses: 'precio_meses = precio_contado x 1.05, igual que los demas proveedores.',
    descripcion: 'desc ya es la homologa: si hay equivalente se usa la descripcion del equivalente mas barato (Servillantas si empatan).'
  },
  equivalentes_y_duplicados: 'Las llantas equivalentes entre proveedores forman un grupo (campo grupo). En cada grupo SOLO el documento de MAYOR MARGEN tiene activo:true (empate: Chavitar y luego menor precio; equivale al de menor costo para nosotros); los demas traen activo:false y desactivado_por. El bot solo usa activo:true: asi nunca sale la misma llanta dos veces y la compra va al proveedor mas barato.'
};
fs.writeFileSync(path.join(OUT, 'catalogo_llantas_bot.json'), JSON.stringify(docs));
fs.writeFileSync(path.join(OUT, 'reglas_precios_bot.json'), JSON.stringify(reglas, null, 2));
fs.writeFileSync(path.join(OUT, 'catalogo_llantas_bot_omitidas.json'), JSON.stringify(omitidas, null, 2));
const por = {}; docs.forEach(d => { por[d.proveedor] = (por[d.proveedor] || 0) + 1; }); const activos = docs.filter(d => d.activo).length;
console.log('Chavitar: grupos de equivalentes', nGrupos, '· gana (mayor margen):', JSON.stringify(porProvGana), '· documentos desactivados por duplicado:', nDesactivados, '· Chavitar sin medida/desc:', omitidas.chavitar_sin_medida_o_desc.length, '· Chavitar con descripción repetida (se deja la de mayor margen):', omitidas.chavitar_misma_descripcion.length);
console.log('Versión del cotizador:', version); console.log('Documentos:', docs.length, '(activos:', activos + ')', por, '· omitidas (sin medida o descripción):', omitidas.sin_medida_o_desc.length, '· AYALA ocultas por estatus:', omitidas.ayala_ocultas_por_estatus, '· AYALA con aviso (no van al bot):', omitidas.ayala_con_aviso.length);
process.exit(0);
