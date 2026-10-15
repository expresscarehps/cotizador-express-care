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
}
w.DATA.forEach(d => agrega('SERV', d, 'costo', d.precio, () => w.pvpLlanta(d.precio, d.marca), w.margenLlanta(d.marca)));
w.VEGA.forEach(d => agrega('VEGA', d, 'costo', d.costo, () => w.pvpLlanta(d.costo, d.marca), w.margenLlanta(d.marca)));
w.AYALA.forEach(d => agrega('AYALA', d, 'lista', d.lista, () => w.pvpAyala(d.lista), null));

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
  meses: { plazos: [3, 6], nota: 'precio_meses ya incluye el recargo (x1.05 en SERV/VEGA; AYALA usa 80% de lista en vez de 75%). No volver a recargar.' },
  total: 'total = suma(cantidad x (precio_contado_o_meses + instalacion_por_llanta)); redondear a 2 decimales solo al mostrar.',
  demanda_texto: 'demanda alta/media/baja es rotacion de la marca en el mercado (numero de SKUs entre proveedores), NO ventas de Express Care. Prohibido decir "la mas vendida", "la que mas vendemos" o sinonimos; usar p.ej. "una de las marcas de mayor rotacion en el mercado".',
  proveedor_visible: 'Nunca mostrar al cliente el campo proveedor (SERV/VEGA/AYALA).'
};
fs.writeFileSync(path.join(OUT, 'catalogo_llantas_bot.json'), JSON.stringify(docs));
fs.writeFileSync(path.join(OUT, 'reglas_precios_bot.json'), JSON.stringify(reglas, null, 2));
fs.writeFileSync(path.join(OUT, 'catalogo_llantas_bot_omitidas.json'), JSON.stringify(omitidas, null, 2));
const por = {}; docs.forEach(d => { por[d.proveedor] = (por[d.proveedor] || 0) + 1; });
console.log('Versión del cotizador:', version); console.log('Documentos:', docs.length, por, '· omitidas (sin medida o descripción):', omitidas.sin_medida_o_desc.length);
process.exit(0);
