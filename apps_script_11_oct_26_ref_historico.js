// ═══════════════════════════════════════════════════════════════════════════
// REF / GRUPO / VERSIÓN para las cotizaciones ANTIGUAS de Hoja1  (11 oct 2026)
//
// ARCHIVO ADICIONAL: se agrega al proyecto de Apps Script como un archivo nuevo
// (+ → Script). NO reemplaza ni modifica el código que ya funciona (doPost, doGet,
// reporte diario, etc.) y NO necesita nueva versión de la implementación: se corre
// a mano desde el editor.
//
// Qué hace: a cada cotización de Hoja1 que todavía NO tiene Ref le asigna uno con el
// mismo formato de hoy (MMDD de su fecha + 5 caracteres, ej. 0717-K3M9X) y lo escribe
// en TODOS los renglones de esa cotización:
//   · S = Ref   · T = Grupo (igual al Ref, porque no hay forma de saber si se corrigió)
//   · U = Versión (1)
// NO toca: folios EXPCARE (columna R), Vigente (V), ni ninguna otra columna.
// NO toca las cotizaciones que ya tienen Ref.
//
// Una cotización = el renglón que trae Fecha + los renglones siguientes sin Fecha
// (así lo ha guardado siempre el cotizador).
//
// Se usa en 3 pasos, igual que la columna Marca:
//   1) refHistorico_PRUEBA    → NO modifica Hoja1. Crea "Vista previa Ref histórico".
//   2) refHistorico_APLICAR   → escribe S, T, U. Solo si la hoja sigue igual que en la
//                                prueba. Guarda "Respaldo Ref histórico".
//   3) refHistorico_DESHACER  → quita lo que APLICAR escribió (solo si sigue igual).
// ═══════════════════════════════════════════════════════════════════════════

var REFHIST_HOJA     = 'Hoja1';
var REFHIST_VISTA    = 'Vista previa Ref histórico';
var REFHIST_RESPALDO = 'Respaldo Ref histórico';
var REFHIST_COL_FECHA   = 1;    // A
var REFHIST_COL_CLIENTE = 3;    // C
var REFHIST_COL_TOTAL   = 16;   // P
var REFHIST_COL_REF     = 19;   // S
var REFHIST_COL_GRUPO   = 20;   // T
var REFHIST_COL_VERSION = 21;   // U
var REFHIST_COL_VIGENTE = 22;   // V (solo se usa para el encabezado; nunca se escribe)
var REFHIST_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function refHist_texto_(v) { return String(v === null || v === undefined ? '' : v).trim(); }

// MMDD de la fecha del renglón. Acepta texto "17/7/2026 10:53 a.m." (día/mes/año) o un Date.
function refHist_mmdd_(valor, zona) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    if (isNaN(valor.getTime())) return null;
    if (typeof Utilities !== 'undefined' && Utilities.formatDate && zona) return Utilities.formatDate(valor, zona, 'MMdd');
    return ('0' + (valor.getMonth() + 1)).slice(-2) + ('0' + valor.getDate()).slice(-2);
  }
  var m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(refHist_texto_(valor));
  if (!m) return null;
  var dia = parseInt(m[1], 10), mes = parseInt(m[2], 10);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return ('0' + mes).slice(-2) + ('0' + dia).slice(-2);
}

// Hash FNV-1a de 32 bits → siempre da el mismo resultado para el mismo texto.
function refHist_hash_(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

function refHist_codigo_(semilla) {
  var h = refHist_hash_(semilla), c = '';
  for (var i = 0; i < 5; i++) { c += REFHIST_ALFABETO.charAt(h % REFHIST_ALFABETO.length); h = Math.floor(h / REFHIST_ALFABETO.length); if (h === 0) h = refHist_hash_(semilla + '#' + i); }
  return c;
}

function refHist_fechaClave_(v, zona) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return refHist_texto_(v);
}

// Arma el plan SIN escribir nada. `valores` = renglones 2..N de Hoja1 (con al menos 21 columnas).
function refHist_plan_(valores, zona) {
  var existentes = {};
  var i;
  for (i = 0; i < valores.length; i++) {
    var r0 = refHist_texto_(valores[i][REFHIST_COL_REF - 1]);
    if (r0) existentes[r0] = true;
  }
  var plan = { bloques: [], yaTienen: 0, sinFecha: [], sueltas: 0, filasAEscribir: 0, totalBloques: 0 };
  var inicio = -1;
  var cierra = function (ini, fin) {   // bloque [ini, fin] (índices en valores)
    plan.totalBloques++;
    var tiene = false, k;
    for (k = ini; k <= fin; k++) {
      if (refHist_texto_(valores[k][REFHIST_COL_REF - 1]) || refHist_texto_(valores[k][REFHIST_COL_GRUPO - 1])) { tiene = true; break; }
    }
    if (tiene) { plan.yaTienen++; return; }
    var f = valores[ini][REFHIST_COL_FECHA - 1];
    var mmdd = refHist_mmdd_(f, zona);
    if (!mmdd) { plan.sinFecha.push({ fila: ini + 2, fecha: refHist_texto_(f) }); return; }
    var fila = ini + 2, intento = 0, ref;
    do {
      ref = mmdd + '-' + refHist_codigo_(fila + '|' + refHist_fechaClave_(f) + '|' + refHist_texto_(valores[ini][REFHIST_COL_CLIENTE - 1]) + '|' + refHist_texto_(valores[ini][REFHIST_COL_TOTAL - 1]) + '|' + intento);
      intento++;
    } while (existentes[ref]);
    existentes[ref] = true;
    plan.bloques.push({ fila: fila, filas: fin - ini + 1, fecha: refHist_texto_(f), cliente: refHist_texto_(valores[ini][REFHIST_COL_CLIENTE - 1]), ref: ref });
    plan.filasAEscribir += fin - ini + 1;
  };
  for (i = 0; i < valores.length; i++) {
    if (refHist_texto_(valores[i][REFHIST_COL_FECHA - 1])) {
      if (inicio >= 0) cierra(inicio, i - 1);
      inicio = i;
    } else if (inicio < 0 && (refHist_texto_(valores[i][9]) || refHist_texto_(valores[i][6]))) {
      plan.sueltas++;   // renglón con datos antes de la primera cotización (no debería pasar)
    }
  }
  if (inicio >= 0) cierra(inicio, valores.length - 1);
  return plan;
}

// "firma" del plan: si la hoja cambia entre la PRUEBA y APLICAR, la firma cambia y NO se escribe.
function refHist_firma_(plan) {
  var partes = [];
  for (var i = 0; i < plan.bloques.length; i++) partes.push(plan.bloques[i].fila + ':' + plan.bloques[i].filas + ':' + plan.bloques[i].ref);
  return partes.join(',');
}

function refHist_leer_(ss) {
  var hoja = ss.getSheetByName(REFHIST_HOJA);
  if (!hoja) throw new Error('No encontré la hoja ' + REFHIST_HOJA);
  var ult = hoja.getLastRow();
  var ancho = Math.max(hoja.getMaxColumns(), REFHIST_COL_VIGENTE);
  var valores = ult >= 2 ? hoja.getRange(2, 1, ult - 1, Math.min(hoja.getMaxColumns(), ancho)).getValues() : [];
  for (var i = 0; i < valores.length; i++) { while (valores[i].length < REFHIST_COL_VIGENTE) valores[i].push(''); }
  var zona = ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : null;
  return { hoja: hoja, ultima: ult, valores: valores, zona: zona };
}

// 1) PRUEBA: no modifica Hoja1.
function refHistorico_PRUEBA() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d = refHist_leer_(ss);
  var plan = refHist_plan_(d.valores, d.zona);
  var vista = ss.getSheetByName(REFHIST_VISTA) || ss.insertSheet(REFHIST_VISTA);
  vista.clear();
  var filas = [['Resultado', 'Fila en Hoja1', 'Renglones de la cotización', 'Fecha', 'Cliente', 'Ref y Grupo que se escribirían', 'Firma del plan (no editar)']];
  for (var i = 0; i < plan.bloques.length; i++) {
    var b = plan.bloques[i];
    filas.push(['SE ESCRIBIRÍA', b.fila, b.filas, b.fecha, b.cliente, b.ref, i === 0 ? refHist_firma_(plan) : '']);
  }
  for (var j = 0; j < plan.sinFecha.length; j++) filas.push(['REVISAR: fecha ilegible (no se toca)', plan.sinFecha[j].fila, '', plan.sinFecha[j].fecha, '', '', '']);
  vista.getRange(1, 1, filas.length, 7).setValues(filas);
  var resumen = 'PRUEBA (Hoja1 NO se modificó): ' + plan.totalBloques + ' cotizaciones en la hoja · ya tenían Ref ' + plan.yaTienen +
    ' · se les asignaría Ref ' + plan.bloques.length + ' (' + plan.filasAEscribir + ' renglones) · fecha ilegible ' + plan.sinFecha.length +
    '. Revisa la hoja "' + REFHIST_VISTA + '".';
  Logger.log(resumen);
  return { totalBloques: plan.totalBloques, yaTienen: plan.yaTienen, nuevas: plan.bloques.length, filasAEscribir: plan.filasAEscribir, sinFecha: plan.sinFecha.length, resumen: resumen };
}

// 2) APLICAR: escribe Ref, Grupo y Versión (S, T, U) solo en cotizaciones que no los tienen.
function refHistorico_APLICAR() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var vista = ss.getSheetByName(REFHIST_VISTA);
    if (!vista || vista.getLastRow() < 2) { var m0 = 'Primero corre refHistorico_PRUEBA y revisa la vista previa. No se escribió nada.'; Logger.log(m0); return { escritas: 0, resumen: m0 }; }
    var d = refHist_leer_(ss);
    var plan = refHist_plan_(d.valores, d.zona);
    if (!plan.bloques.length) { var m1 = 'Nada que escribir: todas las cotizaciones ya tienen Ref.'; Logger.log(m1); return { escritas: 0, resumen: m1 }; }
    var firmaVista = String(vista.getRange(2, 7, 1, 1).getValues()[0][0]);
    if (firmaVista !== refHist_firma_(plan)) {
      var m2 = 'La hoja cambió desde la prueba (o la vista previa ya no coincide). NO se escribió nada. Corre refHistorico_PRUEBA otra vez, revísala y vuelve a aplicar.';
      Logger.log(m2); return { escritas: 0, abortado: true, resumen: m2 };
    }
    var hoja = d.hoja;
    if (hoja.getMaxColumns() < REFHIST_COL_VIGENTE) hoja.insertColumnsAfter(hoja.getMaxColumns(), REFHIST_COL_VIGENTE - hoja.getMaxColumns());
    var enc = hoja.getRange(1, REFHIST_COL_REF, 1, 4);
    var act = enc.getValues()[0];
    if (!refHist_texto_(act[0]) && !refHist_texto_(act[1]) && !refHist_texto_(act[2]) && !refHist_texto_(act[3])) enc.setValues([['Ref', 'Grupo', 'Versión', 'Vigente']]);

    var resp = ss.getSheetByName(REFHIST_RESPALDO);
    if (!resp) { resp = ss.insertSheet(REFHIST_RESPALDO); resp.getRange(1, 1, 1, 4).setValues([['Fecha', 'Fila en Hoja1', 'Ref escrito', 'Deshecho']]); }

    var ult = d.ultima;
    var col = hoja.getRange(2, REFHIST_COL_REF, ult - 1, 3).getValues();   // S, T, U
    var ahora = new Date().toISOString(), respaldo = [], escritas = 0, omitidas = 0;
    for (var i = 0; i < plan.bloques.length; i++) {
      var b = plan.bloques[i];
      for (var f = b.fila; f < b.fila + b.filas; f++) {
        var c = col[f - 2];
        if (refHist_texto_(c[0]) || refHist_texto_(c[1]) || refHist_texto_(c[2])) { omitidas++; continue; }   // nunca se pisa nada
        c[0] = b.ref; c[1] = b.ref; c[2] = 1;
        respaldo.push([ahora, f, b.ref, '']);
        escritas++;
      }
    }
    resp.getRange(resp.getLastRow() + 1, 1, respaldo.length, 4).setValues(respaldo);
    hoja.getRange(2, REFHIST_COL_REF, col.length, 3).setValues(col);
    var resumen = 'APLICADO: Ref, Grupo y Versión escritos en ' + escritas + ' renglones de ' + plan.bloques.length + ' cotizaciones · renglones omitidos por no estar vacíos ' + omitidas +
      '. Respaldo en "' + REFHIST_RESPALDO + '".';
    Logger.log(resumen);
    return { escritas: escritas, cotizaciones: plan.bloques.length, omitidas: omitidas, resumen: resumen };
  } finally { candado.releaseLock(); }
}

// 3) DESHACER: vacía S, T y U de lo que APLICAR escribió, solo si el valor sigue igual.
function refHistorico_DESHACER() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var resp = ss.getSheetByName(REFHIST_RESPALDO), hoja = ss.getSheetByName(REFHIST_HOJA);
    if (!resp || resp.getLastRow() < 2) { var m0 = 'No hay respaldo: no hay nada que deshacer.'; Logger.log(m0); return { quitadas: 0, resumen: m0 }; }
    var ult = hoja.getLastRow();
    var col = hoja.getRange(2, REFHIST_COL_REF, ult - 1, 3).getValues();
    var reg = resp.getRange(2, 1, resp.getLastRow() - 1, 4).getValues();
    var quitadas = 0, omitidas = 0;
    for (var i = 0; i < reg.length; i++) {
      if (String(reg[i][3]) === 'Sí') continue;
      var idx = Number(reg[i][1]) - 2, ref = String(reg[i][2]);
      if (idx >= 0 && idx < col.length && String(col[idx][0]) === ref && String(col[idx][1]) === ref && String(col[idx][2]) === '1') {
        col[idx][0] = ''; col[idx][1] = ''; col[idx][2] = ''; reg[i][3] = 'Sí'; quitadas++;
      } else { reg[i][3] = 'No se pudo (el renglón cambió o se movió)'; omitidas++; }
    }
    hoja.getRange(2, REFHIST_COL_REF, col.length, 3).setValues(col);
    resp.getRange(2, 4, reg.length, 1).setValues(reg.map(function (r) { return [r[3]]; }));
    var resumen = 'DESHECHO: ' + quitadas + ' renglones con Ref/Grupo/Versión quitados · ' + omitidas + ' no se pudieron quitar (cambiaron o se movieron).';
    Logger.log(resumen);
    return { quitadas: quitadas, omitidas: omitidas, resumen: resumen };
  } finally { candado.releaseLock(); }
}
