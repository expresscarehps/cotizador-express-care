// ── CONFIGURACIÓN ────────────────────────────────────────
var DRIVE_FOLDER_ID = '13l2nG21pKq3kJ3NKfGYXIVzyTLMP8i1K';
var FOLIO_INICIO    = 20;
var FOLIO_HOJA      = 'Folios';

// Columnas nuevas de Hoja1 (8 oct 2026): S=Ref, T=Grupo, U=Versión, V=Vigente
// Vigente: vacío = vigente · "No" = ya existe una versión más nueva de esa cotización
var COL_REF      = 19;
var COL_GRUPO    = 20;
var COL_VERSION  = 21;
var COL_VIGENTE  = 22;
var COL_OPCION   = 24;   // X = número de opción (1-5) cuando la cotización trae varias opciones de llantas; vacío en cotizaciones normales (9 oct 2026)
var COL_MARCA    = 23;   // W = Marca de la llanta (8 oct 2026) — solo llantas; en los demás renglones queda vacía

// ── doPost ────────────────────────────────────────────────
function doPost(e) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);

    // ── Guardar PDF en Drive ──────────────────────────────
    if (data.action === 'savePDF') {
      var carpetaRaiz = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      var anio        = new Date().getFullYear().toString();
      var carpetas    = carpetaRaiz.getFoldersByName(anio);
      var carpetaAnio = carpetas.hasNext() ? carpetas.next() : carpetaRaiz.createFolder(anio);
      var pdfBytes    = Utilities.base64Decode(data.pdfBase64);
      var blob        = Utilities.newBlob(pdfBytes, 'application/pdf', data.nombre);
      var archivo     = carpetaAnio.createFile(blob);
      archivo.setDescription('Cotización ' + data.folio + ' — ' + data.cliente);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', url: archivo.getUrl() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Guardar cotización con folio en Sheet ─────────────
    if (data.action === 'saveCotizacion') {
      var sheet    = ss.getActiveSheet();
      var items    = data.items;
      var firstRow = true;
      // Si la cotización trae Ref (cotizador nuevo) se guardan 4 columnas más (S–V).
      // Si no lo trae (página vieja o producción hoy), se guarda EXACTAMENTE como siempre (18 columnas).
      var tieneRef = !!data.ref;
      var candado  = null;
      if (tieneRef) {
        candado = LockService.getScriptLock();
        candado.waitLock(20000);   // dos guardados al mismo tiempo no se pisan
      }
      try {
        if (tieneRef) {
          asegurarEncabezadosRef(sheet);
          marcarVersionesAnteriores(sheet, data.grupo || data.ref);
        }
        var opcionesVistas = {};
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          // Total (col 16): normalmente solo en el primer renglón. Con varias OPCIONES de llantas cada opción
          // trae el suyo, en su primer renglón (las opciones son alternativas: NO se suman entre sí).
          var totalFila = firstRow ? data.total : '';
          if (tieneRef && it.opcion && !opcionesVistas[it.opcion]) {
            opcionesVistas[it.opcion] = true;
            var lstOp = data.opciones || [];
            for (var q = 0; q < lstOp.length; q++) {
              if (String(lstOp[q].opcion) === String(it.opcion)) { totalFila = lstOp[q].total; break; }
            }
          }
          var fila = [
            firstRow ? data.fecha    : '',  // Col 1  Fecha
            firstRow ? data.asesor   : '',  // Col 2  Asesor
            firstRow ? data.cliente  : '',  // Col 3  Cliente
            firstRow ? data.telefono : '',  // Col 4  Teléfono
            firstRow ? data.vehiculo : '',  // Col 5  Vehículo
            firstRow ? data.origen   : '',  // Col 6  Origen
            it.tipo,                        // Col 7  Tipo
            it.proveedor || '',             // Col 8  Proveedor
            it.noParte   || '',             // Col 9  No. de Parte
            it.producto,                    // Col 10 Producto
            it.cant      || 1,             // Col 11 Cant
            it.costo     || '',             // Col 12 Costo
            it.margen    || '',             // Col 13 Margen%
            it.precio,                      // Col 14 Precio
            it.subtotal,                    // Col 15 Subtotal
            totalFila,                      // Col 16 Total
            '',                             // Col 17 Estatus (vacío, se llena manual)
            firstRow ? data.folio    : ''   // Col 18 Cotización (folio EXPCARE-XXX/XX)
          ];
          if (tieneRef) {
            fila.push(data.ref);                       // Col 19 Ref (en todos los renglones del bloque)
            fila.push(data.grupo || data.ref);         // Col 20 Grupo (Ref de la primera versión)
            fila.push(data.version || 1);              // Col 21 Versión
            fila.push('');                             // Col 22 Vigente (vacío = vigente)
            fila.push(String(it.marca || '').replace(/\s+/g, ' ').trim().toUpperCase());   // Col 23 Marca (solo llantas)
            fila.push(it.opcion ? it.opcion : '');                                           // Col 24 Opción (1-5; vacío si no hay opciones)
          }
          sheet.appendRow(fila);
          firstRow = false;
        }
        var lastRow     = sheet.getLastRow();
        var firstRowNum = lastRow - items.length + 1;
        sheet.getRange(firstRowNum, 1, items.length, tieneRef ? COL_OPCION : 18).setBorder(true,true,true,true,true,true);
      } finally {
        if (candado) candado.releaseLock();
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Guardar tarifas MO ────────────────────────────────
    if (data.action === 'saveTarifas') {
      var sheet = ss.getSheetByName('Tarifas MO');
      if (!sheet) sheet = ss.insertSheet('Tarifas MO');
      sheet.clearContents();
      sheet.appendRow(['Concepto', 'Tarifa', 'Tipo']);
      var tarifas = data.tarifas || {};
      var tipos   = data.tipos   || {};
      for (var k in tarifas) {
        sheet.appendRow([k, tarifas[k], tipos[k] || 'libre']);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Guardar cotización historial (botón "Guardar") ────
    var sheet    = ss.getActiveSheet();
    var items    = data.items;
    var firstRow = true;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      sheet.appendRow([
        firstRow ? data.fecha    : '',
        firstRow ? data.asesor   : '',
        firstRow ? data.cliente  : '',
        firstRow ? data.telefono : '',
        firstRow ? data.vehiculo : '',
        firstRow ? data.origen   : '',
        it.tipo,
        it.proveedor || '',
        it.noParte   || '',
        it.producto,
        it.cant      || 1,
        it.costo     || '',
        it.margen    || '',
        it.precio,
        it.subtotal,
        firstRow ? data.total : '',
        '',
        ''
      ]);
      firstRow = false;
    }
    var lastRow     = sheet.getLastRow();
    var firstRowNum = lastRow - items.length + 1;
    sheet.getRange(firstRowNum, 1, items.length, 18).setBorder(true,true,true,true,true,true);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', msg: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Ref / Versión / Vigente (8 oct 2026) ──────────────────
// Pone los encabezados de las columnas S–V la primera vez que llega una cotización con Ref.
function asegurarEncabezadosRef(sheet) {
  // Si la hoja llega justo hasta la columna R, se agregan las columnas que falten (hasta W).
  if (sheet.getMaxColumns() < COL_OPCION) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), COL_OPCION - sheet.getMaxColumns());
  }
  var encabezado = sheet.getRange(1, COL_REF, 1, 4);
  var actual = encabezado.getValues()[0];
  if (!actual[0] && !actual[1] && !actual[2] && !actual[3]) {
    encabezado.setValues([['Ref', 'Grupo', 'Versión', 'Vigente']]);
  }
  var encMarca = sheet.getRange(1, COL_MARCA, 1, 1);
  if (!encMarca.getValues()[0][0]) encMarca.setValues([['Marca']]);
  var encOpcion = sheet.getRange(1, COL_OPCION, 1, 1);
  if (!encOpcion.getValues()[0][0]) encOpcion.setValues([['Opción']]);
}

// Cuando llega una versión nueva de una cotización, las versiones anteriores del mismo
// Grupo se marcan "No" en Vigente (todos sus renglones). Así los reportes no cuentan
// dos veces la misma cotización. Los renglones de otros grupos no se tocan.
function marcarVersionesAnteriores(sheet, grupo) {
  if (!grupo) return;
  var ultima = sheet.getLastRow();
  if (ultima < 2) return;
  var datos = sheet.getRange(2, COL_GRUPO, ultima - 1, COL_VIGENTE - COL_GRUPO + 1).getValues();
  for (var i = 0; i < datos.length; i++) {
    var g = String(datos[i][0]);                       // Grupo
    var vigente = String(datos[i][COL_VIGENTE - COL_GRUPO]);   // Vigente
    if (g === String(grupo) && vigente !== 'No') {
      sheet.getRange(i + 2, COL_VIGENTE).setValue('No');
    }
  }
}

// ── doGet ─────────────────────────────────────────────────
function doGet(e) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var callback = e.parameter.callback || '';

    // ── Folio consecutivo (PROPUESTA, no lo consume todavía) ──
    // Se "confirma" y se consume de verdad hasta que el guardado quede verificado
    // (ver action=commitFolio), para no saltar números por pruebas o guardados fallidos.
    if (e.parameter.action === 'getFolio') {
      var hoja = ss.getSheetByName(FOLIO_HOJA);
      if (!hoja) {
        hoja = ss.insertSheet(FOLIO_HOJA);
        hoja.appendRow(['UltimoFolio', 'Anio']);
        hoja.appendRow([FOLIO_INICIO - 1, new Date().getFullYear()]);
      }
      var anioActual = new Date().getFullYear();
      var datos      = hoja.getRange(2, 1, 1, 2).getValues();
      var ultimoNum  = parseInt(datos[0][0]) || (FOLIO_INICIO - 1);
      var anioGuard  = parseInt(datos[0][1]) || anioActual;
      if (anioGuard < anioActual) ultimoNum = FOLIO_INICIO - 1;
      var siguiente = ultimoNum + 1;
      var anioCorto = String(anioActual).slice(2);
      var folioStr  = 'EXPCARE-' + String(siguiente).padStart(3, '0') + '/' + anioCorto;
      var json = JSON.stringify({ status: 'ok', folio: folioStr, numero: siguiente });
      if (callback) {
        return ContentService
          .createTextOutput(callback + '(' + json + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService
        .createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Tarifas MO ───────────────────────────────────────
    if (e.parameter.action === 'getTarifas') {
      var sheet   = ss.getSheetByName('Tarifas MO');
      var tarifas = {}, tipos = {};
      if (sheet) {
        var rows = sheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (rows[i][0] && rows[i][1]) {
            tarifas[rows[i][0]] = parseFloat(rows[i][1]);
            tipos[rows[i][0]]   = rows[i][2] || 'libre';
          }
        }
      }
      var json = JSON.stringify({ status: 'ok', tarifas: tarifas, tipos: tipos });
      if (callback) {
        return ContentService
          .createTextOutput(callback + '(' + json + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService
        .createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Confirmar/consumir un folio propuesto (solo tras guardado verificado) ──
    if (e.parameter.action === 'commitFolio') {
      var numeroConfirmar = parseInt(e.parameter.numero) || 0;
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        var hojaF = ss.getSheetByName(FOLIO_HOJA);
        if (hojaF && numeroConfirmar > 0) {
          var anioF  = new Date().getFullYear();
          var datosF = hojaF.getRange(2, 1, 1, 2).getValues();
          var actualF = parseInt(datosF[0][0]) || (FOLIO_INICIO - 1);
          // Solo avanza si es mayor al ya confirmado — evita retroceder o duplicar
          // si dos confirmaciones llegaran fuera de orden.
          if (numeroConfirmar > actualF) {
            hojaF.getRange(2, 1, 1, 2).setValues([[numeroConfirmar, anioF]]);
          }
        }
      } finally {
        lock.releaseLock();
      }
      var jsonCommit = JSON.stringify({ status: 'ok' });
      if (callback) {
        return ContentService
          .createTextOutput(callback + '(' + jsonCommit + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService
        .createTextOutput(jsonCommit)
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Verificar si un folio ya quedó guardado (confirmación real, no ambigua) ──
    if (e.parameter.action === 'checkFolio') {
      var folioBuscado = e.parameter.folio || '';
      var hojaCotiz     = ss.getActiveSheet();
      var datosCotiz    = hojaCotiz.getDataRange().getValues();
      var encontrado    = false;
      // Buscar de abajo hacia arriba: lo que se acaba de guardar está al final.
      for (var i = datosCotiz.length - 1; i >= 1; i--) {
        if (datosCotiz[i][17] === folioBuscado) { encontrado = true; break; }
      }
      var jsonCheck = JSON.stringify({ status: 'ok', found: encontrado });
      if (callback) {
        return ContentService
          .createTextOutput(callback + '(' + jsonCheck + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService
        .createTextOutput(jsonCheck)
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', msg: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── REPORTE DIARIO ────────────────────────────────────────
function enviarReporteDiario() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var hoja  = ss.getSheetByName('Hoja1');
  var datos = hoja.getDataRange().getValues();

  var hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  var cotizacionesHoy = [];

  var hoyStr = Utilities.formatDate(hoy, Session.getScriptTimeZone(), 'd/M/yyyy');
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[0]) continue;
    var fechaFila;
    if (fila[0] instanceof Date) {
      fechaFila = Utilities.formatDate(fila[0], Session.getScriptTimeZone(), 'M/d/yyyy');
    } else {
      fechaFila = String(fila[0]).split(' ')[0];
    }
    if (fechaFila === hoyStr) {
      cotizacionesHoy.push({
        asesor:  fila[1],   // Col B
        cliente: fila[2],   // Col C
        origen:  fila[5],   // Col F
        tipo:    fila[6],   // Col G
        total:   fila[15]   // Col P
      });
    }
  }

  if (cotizacionesHoy.length === 0) {
    Logger.log('No hay cotizaciones para hoy.');
    return;
  }

  // Totales
  // Solo contar filas donde hay total (primera fila de cada cotización)
  var totalCotizaciones = cotizacionesHoy.filter(function(c){ return c.total !== ''; }).length;
  var montoTotal = cotizacionesHoy.reduce(function(s, c) {
    return s + (parseFloat(c.total) || 0);
  }, 0);

  // Por asesor
  var porAsesor = {};
  cotizacionesHoy.filter(function(c){ return c.total !== ''; }).forEach(function(c) {
    var a = c.asesor || 'Sin nombre';
    if (!porAsesor[a]) porAsesor[a] = { cantidad: 0, monto: 0 };
    porAsesor[a].cantidad++;
    porAsesor[a].monto += parseFloat(c.total) || 0;
  });

  // Por tipo
  var porTipo = {};
  cotizacionesHoy.forEach(function(c) {
    var t = c.tipo || 'Sin tipo';
    if (!porTipo[t]) porTipo[t] = 0;
    porTipo[t]++;
  });

  // Por origen
  var porOrigen = {};
  cotizacionesHoy.filter(function(c){ return c.total !== ''; }).forEach(function(c) {
    var o = c.origen || 'Sin origen';
    if (!porOrigen[o]) porOrigen[o] = 0;
    porOrigen[o]++;
  });

  function fmt(n) {
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var fechaStr = Utilities.formatDate(hoy, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  var filasAsesores = '';
  Object.keys(porAsesor).sort().forEach(function(a) {
    var d = porAsesor[a];
    filasAsesores +=
      '<tr>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0">' + a + '</td>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center">' + d.cantidad + '</td>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#166534">' + fmt(d.monto) + '</td>' +
      '</tr>';
  });

  var filasTipos = '';
  Object.keys(porTipo).sort().forEach(function(t) {
    filasTipos +=
      '<tr>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0">' + t + '</td>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center">' + porTipo[t] + '</td>' +
      '</tr>';
  });

  var filasOrigen = '';
  Object.keys(porOrigen).sort().forEach(function(o) {
    filasOrigen +=
      '<tr>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0">' + o + '</td>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center">' + porOrigen[o] + '</td>' +
      '</tr>';
  });

  var html =
    '<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);font-family:Arial,sans-serif">' +
    '<div style="background:#1a1a2e;padding:28px 24px;text-align:center">' +
      '<div style="font-size:13px;color:#94a3b8;margin-bottom:4px">Express Care Valvoline</div>' +
      '<div style="font-size:22px;font-weight:700;color:#fff">📊 Reporte Diario</div>' +
      '<div style="font-size:14px;color:#94a3b8;margin-top:6px">' + fechaStr + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:12px;padding:20px 24px;background:#f8fafc">' +
      '<div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0">' +
        '<div style="font-size:28px;font-weight:700;color:#1a1a2e">' + totalCotizaciones + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:4px">Cotizaciones</div>' +
      '</div>' +
      '<div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0">' +
        '<div style="font-size:20px;font-weight:700;color:#166534">' + fmt(montoTotal) + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:4px">Total cotizado</div>' +
      '</div>' +
    '</div>' +
    '<div style="padding:0 24px 20px">' +
      '<div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:10px;padding-top:4px">👨‍🔧 Por Asesor</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
        '<thead><tr style="background:#f8fafc">' +
          '<th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600">Asesor</th>' +
          '<th style="padding:10px 14px;text-align:center;color:#64748b;font-weight:600">Cotiz.</th>' +
          '<th style="padding:10px 14px;text-align:right;color:#64748b;font-weight:600">Total</th>' +
        '</tr></thead>' +
        '<tbody>' + filasAsesores + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="padding:0 24px 20px">' +
      '<div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:10px">🔧 Por Tipo de Servicio</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
        '<thead><tr style="background:#f8fafc">' +
          '<th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600">Tipo</th>' +
          '<th style="padding:10px 14px;text-align:center;color:#64748b;font-weight:600">Renglones</th>' +
        '</tr></thead>' +
        '<tbody>' + filasTipos + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="padding:0 24px 24px">' +
      '<div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:10px">📲 Por Canal de Origen</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
        '<thead><tr style="background:#f8fafc">' +
          '<th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600">Canal</th>' +
          '<th style="padding:10px 14px;text-align:center;color:#64748b;font-weight:600">Cotiz.</th>' +
        '</tr></thead>' +
        '<tbody>' + filasOrigen + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="background:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0">' +
      '<div style="font-size:12px;color:#94a3b8">Reporte generado automáticamente · Express Care Valvoline</div>' +
    '</div>' +
    '</div>';

  // ← Cambia este correo por el tuyo
  var destinatario = 'carlos.mtz@expresscarecuu.com';
  var asunto = '📊 Reporte Diario Express Care - ' + fechaStr;

  MailApp.sendEmail({
    to: destinatario,
    subject: asunto,
    htmlBody: html
  });

  Logger.log('Reporte enviado a ' + destinatario);
}

// ═══════════════════════════════════════════════════════════════════════════
//  RELLENO DE MARCA EN LLANTAS DEL HISTORIAL (8 oct 2026)
//  NO cambia doPost ni nada de lo anterior: son funciones nuevas que se corren A MANO.
//  Orden:  1) completarMarcaLlantas_PRUEBA   (solo mira y llena la hoja "Vista previa Marca"; NO cambia Hoja1)
//          2) completarMarcaLlantas_APLICAR  (escribe la marca al frente de la columna Producto y guarda respaldo)
//          3) deshacerMarcaLlantas           (regresa lo que APLICAR cambió, si algo salió mal)
//  Formato igual al del cotizador nuevo:  "MICHELIN 175/70 R13 82T ..."
// ═══════════════════════════════════════════════════════════════════════════
var HOJA_COTIZACIONES = 'Hoja1';
var HOJA_VISTA_MARCA  = 'Vista previa Marca';
var HOJA_RESPALDO_MARCA = 'Respaldo Marca';
var COL_TIPO = 7, COL_PROVEEDOR = 8, COL_NOPARTE = 9, COL_PRODUCTO = 10;

// "PROVEEDOR|No. de parte" -> marca  (sacado del catálogo; solo claves que existen en Hoja1 al 8 oct 2026)
var MARCA_POR_CVE = {
  "AYALA|AY02300": "BFGOODRICH",
  "AYALA|AY03515": "MICHELIN",
  "AYALA|AY03625": "UNIROYAL",
  "AYALA|AY03697": "MICHELIN",
  "AYALA|AY04064": "MICHELIN",
  "AYALA|AY04240": "MICHELIN",
  "AYALA|AY04666": "UNIROYAL",
  "AYALA|AY04884": "MICHELIN",
  "AYALA|AY05408": "MICHELIN",
  "AYALA|AY08247": "MICHELIN",
  "AYALA|AY09329": "BFGOODRICH",
  "AYALA|AY10261": "MICHELIN",
  "AYALA|AY10596": "BFGOODRICH",
  "AYALA|AY10636": "MICHELIN",
  "AYALA|AY11610": "MICHELIN",
  "AYALA|AY12130": "MICHELIN",
  "AYALA|AY12184": "BFGOODRICH",
  "AYALA|AY12720": "MICHELIN",
  "AYALA|AY12745": "MICHELIN",
  "AYALA|AY14038": "MICHELIN",
  "AYALA|AY15648": "MICHELIN",
  "AYALA|AY16460": "MICHELIN",
  "AYALA|AY16746": "MICHELIN",
  "AYALA|AY17222": "BFGOODRICH",
  "AYALA|AY17591": "MICHELIN",
  "AYALA|AY20218": "MICHELIN",
  "AYALA|AY20594": "MICHELIN",
  "AYALA|AY21891": "MICHELIN",
  "AYALA|AY22963": "MICHELIN",
  "AYALA|AY22994": "MICHELIN",
  "AYALA|AY23295": "MICHELIN",
  "AYALA|AY24418": "BFGOODRICH",
  "AYALA|AY25458": "UNIROYAL",
  "AYALA|AY27890": "MICHELIN",
  "AYALA|AY29059": "MICHELIN",
  "AYALA|AY29473": "MICHELIN",
  "AYALA|AY33065": "MICHELIN",
  "AYALA|AY34256": "MICHELIN",
  "AYALA|AY34675": "MICHELIN",
  "AYALA|AY35841": "BFGOODRICH",
  "AYALA|AY36429": "MICHELIN",
  "AYALA|AY37330": "MICHELIN",
  "AYALA|AY37367": "MICHELIN",
  "AYALA|AY38540": "MICHELIN",
  "AYALA|AY39135": "MICHELIN",
  "AYALA|AY39527": "MICHELIN",
  "AYALA|AY40559": "MICHELIN",
  "AYALA|AY44659": "MICHELIN",
  "AYALA|AY45880": "MICHELIN",
  "AYALA|AY48275": "BFGOODRICH",
  "AYALA|AY49256": "BFGOODRICH",
  "AYALA|AY51287": "MICHELIN",
  "AYALA|AY53971": "UNIROYAL",
  "AYALA|AY56918": "MICHELIN",
  "AYALA|AY59751": "UNIROYAL",
  "AYALA|AY61141": "BFGOODRICH",
  "AYALA|AY63519": "UNIROYAL",
  "AYALA|AY64360": "MICHELIN",
  "AYALA|AY68255": "MICHELIN",
  "AYALA|AY69099": "MICHELIN",
  "AYALA|AY71509": "MICHELIN",
  "AYALA|AY79711": "MICHELIN",
  "AYALA|AY79721": "MICHELIN",
  "AYALA|AY80752": "MICHELIN",
  "AYALA|AY82193": "BFGOODRICH",
  "AYALA|AY88019": "MICHELIN",
  "AYALA|AY91365": "BFGOODRICH",
  "AYALA|AY94341": "BFGOODRICH",
  "SERV|10034389": "TORNEL",
  "SERV|10085360": "TORNEL",
  "SERV|10085450": "TORNEL",
  "SERV|10086500": "TORNEL",
  "SERV|10179": "VINMAX",
  "SERV|1022037": "HANKOOK",
  "SERV|1022797": "HANKOOK",
  "SERV|1024098": "HANKOOK",
  "SERV|1027588": "HANKOOK",
  "SERV|1035243": "HANKOOK",
  "SERV|105894": "GOODYEAR",
  "SERV|106855": "GOODYEAR",
  "SERV|108771": "GOODYEAR",
  "SERV|10A54173": "TORNEL",
  "SERV|10A55303": "TORNEL",
  "SERV|10A56413": "TORNEL",
  "SERV|10A56433": "TORNEL",
  "SERV|10A56440": "TORNEL",
  "SERV|10M54240": "TORNEL",
  "SERV|10M54310": "TORNEL",
  "SERV|10P34270": "TORNEL",
  "SERV|110156": "GOODYEAR",
  "SERV|110192": "GOODYEAR",
  "SERV|110373": "GOODYEAR",
  "SERV|110376": "GOODYEAR",
  "SERV|110524": "GOODYEAR",
  "SERV|110753": "GOODYEAR",
  "SERV|111152": "GOODYEAR",
  "SERV|111174": "PASSI",
  "SERV|111193": "GOODYEAR",
  "SERV|111345": "GOODYEAR",
  "SERV|111354": "GOODYEAR",
  "SERV|111381": "GOODYEAR",
  "SERV|111439": "GOODYEAR",
  "SERV|111468": "GOODYEAR",
  "SERV|111469": "GOODYEAR",
  "SERV|111595": "GOODYEAR",
  "SERV|114615": "COOPER",
  "SERV|114832": "COOPER",
  "SERV|114834": "COOPER",
  "SERV|114836": "COOPER",
  "SERV|114837": "COOPER",
  "SERV|114862": "COOPER",
  "SERV|114879": "COOPER",
  "SERV|114965": "COOPER",
  "SERV|115095": "COOPER",
  "SERV|115668": "COOPER",
  "SERV|115669": "COOPER",
  "SERV|115670": "COOPER",
  "SERV|115673": "COOPER",
  "SERV|115721": "COOPER",
  "SERV|115815": "COOPER",
  "SERV|115818": "COOPER",
  "SERV|115848": "COOPER",
  "SERV|115850": "COOPER",
  "SERV|115852": "COOPER",
  "SERV|116031": "COOPER",
  "SERV|116033": "COOPER",
  "SERV|116034": "COOPER",
  "SERV|116037": "COOPER",
  "SERV|116060": "COOPER",
  "SERV|116407": "COOPER",
  "SERV|117861": "GOODYEAR",
  "SERV|117862": "GOODYEAR",
  "SERV|117908": "GOODYEAR",
  "SERV|117935": "GOODYEAR",
  "SERV|118111": "GOODYEAR",
  "SERV|118134": "GOODYEAR",
  "SERV|118140": "GOODYEAR",
  "SERV|118286": "GOODYEAR",
  "SERV|118415": "GOODYEAR",
  "SERV|118498": "GOODYEAR",
  "SERV|118565": "GOODYEAR",
  "SERV|118587": "GOODYEAR",
  "SERV|1255224716104": "TORNEL",
  "SERV|13-AT-ZW2657017": "ZWARTHZ",
  "SERV|1355221317098": "JK TYRE",
  "SERV|1355222716104": "JK TYRE",
  "SERV|1355224517105": "JK TYRE",
  "SERV|140922": "GOODYEAR",
  "SERV|140935": "GOODYEAR",
  "SERV|140999": "GOODYEAR",
  "SERV|142088": "GOODYEAR",
  "SERV|15493040000": "CONTINENTAL",
  "SERV|15493530005": "CONTINENTAL",
  "SERV|15494430000": "CONTINENTAL",
  "SERV|15508620000": "CONTINENTAL",
  "SERV|1557014H735": "HANKOOK",
  "SERV|15580003": "BRIDGESTONE",
  "SERV|1656514HK": "HANKOOK",
  "SERV|1656514IL": "ILINK",
  "SERV|1656514JK": "JK TYRE",
  "SERV|1657014MZZ": "APLUS",
  "SERV|17514082TANE0": "TORNEL",
  "SERV|1756015UX": "JK TYRE",
  "SERV|1756515ZW": "LINGLONG",
  "SERV|1757013AR": "VINMAX",
  "SERV|1757014BHHH11VY": "SIERRA",
  "SERV|1757014PR": "PIRELLI",
  "SERV|17775": "NEXEN",
  "SERV|17H56501": "JK TYRE",
  "SERV|17H57511": "JK TYRE",
  "SERV|17J56361": "JK TYRE",
  "SERV|17J57561": "JK TYRE",
  "SERV|18223003": "BRIDGESTONE",
  "SERV|1855515BG": "BRIDGESTONE",
  "SERV|1855516MR": "AGATE",
  "SERV|1856014VN": "VINMAX",
  "SERV|1856015FR": "FIRESTONE",
  "SERV|1856015VN": "VINMAX",
  "SERV|1856514HK": "HANKOOK",
  "SERV|1856514VN": "VINMAX",
  "SERV|1856515VN": "VINMAX",
  "SERV|1857014VN": "VINMAX",
  "SERV|1954516AT": "ILINK",
  "SERV|1955015ATLAS": "ATLAS",
  "SERV|1955515VN": "VINMAX",
  "SERV|1955516HF": "DOUBLEKING",
  "SERV|1956015AG": "AGATE",
  "SERV|1956515JK": "JK TYRE",
  "SERV|1956515VN": "VINMAX",
  "SERV|1NEXN-17820NX": "NEXEN",
  "SERV|2027555PI": "PIRELLI",
  "SERV|20516BR": "BRIDGESTONE",
  "SERV|20546003": "BRIDGESTONE",
  "SERV|2055017GM": "APLUS",
  "SERV|2055017JK": "JK TYRE",
  "SERV|2055516TUR": "BRIDGESTONE",
  "SERV|2055516VN": "VINMAX",
  "SERV|2055517BG": "BRIDGESTONE",
  "SERV|2055517FT140": "FIRESTONE",
  "SERV|2055517HF": "AGATE",
  "SERV|2055517JKUX1": "JK TYRE",
  "SERV|2055517WRR33095W": "VINMAX",
  "SERV|2056515JK": "JK TYRE",
  "SERV|2056515VN": "VINMAX",
  "SERV|2056516LLCM121": "APLUS",
  "SERV|2057016HP": "APLUS",
  "SERV|2057514AP": "APLUS",
  "SERV|2155017GM": "BLACKHAWK",
  "SERV|2155017UX1": "JK TYRE",
  "SERV|2155516H436": "HANKOOK",
  "SERV|2155516HF": "ILINK",
  "SERV|2155517BK": "VINMAX",
  "SERV|2155517SF": "APLUS",
  "SERV|2155518JK": "JK TYRE",
  "SERV|2155518TDI": "ATLAS",
  "SERV|2156016JK": "JK TYRE",
  "SERV|2156016RHP778": "AGATE",
  "SERV|2156017ANT": "GREEN MAX",
  "SERV|2156017ATB": "VINMAX",
  "SERV|2156516ELANZO": "JK TYRE",
  "SERV|2157016AT": "ATLAS",
  "SERV|2158543": "PEGASUS",
  "SERV|22254517LG": "APLUS",
  "SERV|2254018BHH": "VINMAX",
  "SERV|2254018JK": "JK TYRE",
  "SERV|2254518CS": "FULLWAY",
  "SERV|2254518FR": "APLUS",
  "SERV|2254518O": "FULLWAY",
  "SERV|2255017LG": "FULLRUN",
  "SERV|22550R17GOODRIDE": "BROADPEAK",
  "SERV|2255516ANT": "ATLAS",
  "SERV|2255517ATLASG": "APLUS",
  "SERV|2255517GM": "LINGLONG",
  "SERV|2255519HP": "ILINK",
  "SERV|2255519SAFE": "APLUS",
  "SERV|2256017VN": "VINMAX",
  "SERV|2256018SF": "APLUS",
  "SERV|2256516ANT": "APLUS",
  "SERV|2256517AG": "APLUS",
  "SERV|2256517HK": "HANKOOK",
  "SERV|2256517LF": "LAUFENN",
  "SERV|2354018HF": "ILINK",
  "SERV|2354019HF": "APLUS",
  "SERV|2354518MZZ": "APLUS",
  "SERV|2355517ARK": "PEGASUS",
  "SERV|2355517HP": "BROADPEAK",
  "SERV|2355517MXT": "ZWARTHZ",
  "SERV|2355520MX": "ATLAS",
  "SERV|23555518LG": "FULLWAY",
  "SERV|2356017HT601": "FULLWAY",
  "SERV|2356018CROSS": "LINGLONG",
  "SERV|2356018MR": "PEGASUS",
  "SERV|2357016GL": "SUMAXX",
  "SERV|2357016VN": "VINMAX",
  "SERV|2357515BL": "APLUS",
  "SERV|2357515JK": "JK TYRE",
  "SERV|240691VI": "VINMAX",
  "SERV|2454018HD921": "APLUS",
  "SERV|2455018ATLAS": "FRONWAY",
  "SERV|2455020ANT": "VINMAX",
  "SERV|2457016NM": "SUMAXX",
  "SERV|2555519IL": "ILINK",
  "SERV|2557016LF": "LAUFENN",
  "SERV|2656018MX": "BLACKHAWK",
  "SERV|2656517VN": "VINMAX",
  "SERV|2656518PT": "PEGASUS",
  "SERV|2657016FRD66": "SUMAXX",
  "SERV|2657017FR": "APLUS",
  "SERV|2755020IL": "ILINK",
  "SERV|2755520M": "BLACKHAWK",
  "SERV|2756020JK": "JK TYRE",
  "SERV|2756020PRAT": "PEGASUS",
  "SERV|28-29575225111": "NOVAMAXX",
  "SERV|2857017AGATE": "PEGASUS",
  "SERV|2857516BK": "BLACKHAWK",
  "SERV|2955015BP": "BROADPEAK",
  "SERV|29575225NMX51": "HAPPY ROAD",
  "SERV|3220023224": "NOBHEX",
  "SERV|3220023228": "NOBHEX",
  "SERV|3220025433": "NOBHEX",
  "SERV|3220026428": "NOBHEX",
  "SERV|3220026889": "NOBHEX",
  "SERV|41-1955516GM": "LINGLONG",
  "SERV|41-221007159": "SUMAXX",
  "SERV|8254389": "AGATE",
  "SERV|90000002522": "COOPER",
  "SERV|EP422": "BRIDGESTONE",
  "SERV|HH2001H1": "VINMAX",
  "SERV|KKR20": "JK TYRE",
  "SERV|MAXX-41491600": "MAXXIS",
  "SERV|MAXX-41492000": "MAXXIS",
  "SERV|NEX369": "NEXEN",
  "SERV|NEX420": "NEXEN",
  "SERV|NEXN-11135NX": "NEXEN",
  "SERV|NEXN-14356NX": "NEXEN",
  "SERV|NEXN-14371NX": "NEXEN",
  "SERV|NEXN-17772NX": "NEXEN",
  "SERV|NEXN-17792NX": "NEXEN",
  "SERV|NEXN-17793NX": "NEXEN",
  "SERV|NEXN-17795NX": "NEXEN",
  "SERV|NEXN-17804NX": "NEXEN",
  "SERV|NEXN-17811NX": "NEXEN",
  "SERV|NEXN-17812NX": "NEXEN",
  "SERV|P1571-E": "FORCELAND",
  "SERV|P3141-E": "PEGASUS",
  "SERV|SUMI-SHR06": "SUMITOMO",
  "SERV|SUMI-SHR29": "SUMITOMO",
  "SERV|ZW2256517": "ZWARTHZ",
  "VEGA|15570R13HF261": "HIFLY",
  "VEGA|15570R13LH41": "LAUFENN",
  "VEGA|16570R14HF201": "HIFLY",
  "VEGA|17560R15ES31": "KUMHO",
  "VEGA|17560R15H735": "HANKOOK",
  "VEGA|17560R15HH11": "BLACKHAWK",
  "VEGA|17565R14AG266": "AGATE",
  "VEGA|17565R14FIREHAWK900": "FIRESTONE",
  "VEGA|17570R13EDGE": "KELLY",
  "VEGA|17570R13LH41": "LAUFENN",
  "VEGA|18555R15H735": "HANKOOK",
  "VEGA|18555R15HH11": "BLACKHAWK",
  "VEGA|18555R16FR740": "FIRESTONE",
  "VEGA|18560R14HH11": "BLACKHAWK",
  "VEGA|18560R14SICHER": "BROADPEAK",
  "VEGA|18560R15FR710": "FIRESTONE",
  "VEGA|18560R15H426": "HANKOOK",
  "VEGA|18560R16PROXESR": "TOYO",
  "VEGA|18565R15HH11": "BLACKHAWK",
  "VEGA|18565R15P1CINT": "PIRELLI",
  "VEGA|18565R15REAL": "TORNEL",
  "VEGA|19550R15REAL": "TORNEL",
  "VEGA|19555R16ECOPIA": "BRIDGESTONE",
  "VEGA|19565R15FIREHAWK": "FIRESTONE",
  "VEGA|19565R15H735": "HANKOOK",
  "VEGA|19565R15HH11": "BLACKHAWK",
  "VEGA|19565R15LH41": "LAUFENN",
  "VEGA|19565R15P1CINT": "PIRELLI",
  "VEGA|20550R17FIREHAWK": "FIRESTONE",
  "VEGA|20555R16FIREHAWK900": "FIRESTONE",
  "VEGA|20555R16H457": "HANKOOK",
  "VEGA|20555R16H737": "HANKOOK",
  "VEGA|20555R16HH11": "BLACKHAWK",
  "VEGA|20555R16HU01": "BLACKHAWK",
  "VEGA|20555R16LH41": "LAUFENN",
  "VEGA|20555R16P7": "PIRELLI",
  "VEGA|20555R17H436": "HANKOOK",
  "VEGA|20560R15FIREHAWK": "FIRESTONE",
  "VEGA|20560R16ECOPIA": "BRIDGESTONE",
  "VEGA|20560R16FT140": "FIRESTONE",
  "VEGA|20560R16HH11": "BLACKHAWK",
  "VEGA|20560R16LH41": "LAUFENN",
  "VEGA|20560R16SATR": "PIRELLI",
  "VEGA|20565R16H735": "HANKOOK",
  "VEGA|21545R16HD937": "HAIDA",
  "VEGA|21545R17HU02": "BLACKHAWK",
  "VEGA|21545R18LH01": "LAUFENN",
  "VEGA|21545R18P7CINT": "PIRELLI",
  "VEGA|21555R17NT555": "NITTO",
  "VEGA|21555R17SPORT": "BROADPEAK",
  "VEGA|21555R17TURANZA": "BRIDGESTONE",
  "VEGA|21570R16HT172": "MIRAGE",
  "VEGA|22545R17H457": "HANKOOK",
  "VEGA|22545R17SPORT": "BROADPEAK",
  "VEGA|22545R18HF805": "HIFLY",
  "VEGA|22550R18HH11": "BLACKHAWK",
  "VEGA|22555R18AGILITY": "BLACKHAWK",
  "VEGA|22555R18H436": "HANKOOK",
  "VEGA|22555R18HPSPORT": "BRIDGESTONE",
  "VEGA|22555R19HP172": "MIRAGE",
  "VEGA|22560R16ALLSEASON": "FIRESTONE",
  "VEGA|22560R16HF201": "HIFLY(TORQUE)",
  "VEGA|22560R17AGILITY": "BLACKHAWK",
  "VEGA|22560R17H735": "HANKOOK",
  "VEGA|22560R18BATMAN": "ATLAS",
  "VEGA|22560R18H737": "HANKOOK",
  "VEGA|22560R18P7CINT": "PIRELLI",
  "VEGA|22565R17KL21": "KUMHO",
  "VEGA|22575R15H735": "HANKOOK",
  "VEGA|23540R18HD927": "HAIDA",
  "VEGA|23540R18LH01": "LAUFENN",
  "VEGA|23540R19HD937": "HAIDA",
  "VEGA|23540R19HF805": "HIFLY",
  "VEGA|23550R18AGILITY": "BLACKHAWK",
  "VEGA|23550R18P7AS": "PIRELLI",
  "VEGA|23555R19ALENZA": "BRIDGESTONE",
  "VEGA|23560R17ALLSEASON": "FIRESTONE",
  "VEGA|23560R17H737": "HANKOOK",
  "VEGA|23560R18RA33": "HANKOOK",
  "VEGA|23565R16H735": "HANKOOK",
  "VEGA|23575R15H735": "HANKOOK",
  "VEGA|23575R15RIDGECRA": "BLACKHAWK",
  "VEGA|24545R18HU01": "BLACKHAWK",
  "VEGA|24550R20H452": "HANKOOK",
  "VEGA|24550R20RA33": "HANKOOK",
  "VEGA|24565R17LC01": "LAUFENN",
  "VEGA|24575R16HT01": "BLACKHAWK",
  "VEGA|25535R19P7": "PIRELLI",
  "VEGA|25540R20SZROAS": "PIRELLI",
  "VEGA|25545R18HU01": "BLACKHAWK",
  "VEGA|25545R20H457": "HANKOOK",
  "VEGA|25545R20HD937": "HAIDA",
  "VEGA|26550R20HP801": "HIFLY",
  "VEGA|26550R20HT01": "BLACKHAWK",
  "VEGA|26550R20SVEAS": "PIRELLI",
  "VEGA|26570R17RH12": "HANKOOK",
  "VEGA|27535R21ALENZA": "BRIDGESTONE",
  "VEGA|27545R20HD921": "HAIDA",
  "VEGA|27550R20PZERO": "PIRELLI",
  "VEGA|27555R19LZEAL56": "ILINK",
  "VEGA|27555R20DESTINATION": "FIRESTONE",
  "VEGA|27555R20RUGGEDTREK": "COOPER",
  "VEGA|27560R20RA33": "HANKOOK",
  "VEGA|27560R20RIDGEAT": "BLACKHAWK",
  "VEGA|28540R21K127A": "HANKOOK",
  "VEGA|31530R22PZERO": "PIRELLI"
};
// Descripción exacta (mayúsculas) -> marca, para renglones sin No. de parte pero con descripción idéntica al catálogo
var MARCA_POR_DESC = {
  "175/70 R14 88T EXTRA LOAD TL ENERGY XM2 GRNX MI": "MICHELIN",
  "185/60R14 ECOTOUR HP3 82H": "VINMAX",
  "185/60R15 CS1 84 T": "COOPER",
  "185/65R15 88H TL ENERGY SAVER A/S GRNX MI": "MICHELIN",
  "185/65R15 ECOTOUR HP3 88H": "VINMAX",
  "195/65R15 BRAVURIS 5 91H": "BARUM",
  "195/65R15 CS1 91T": "COOPER",
  "195/65R15 ECOPIA EP422 91H": "BRIDGESTONE",
  "195/65R15 ECOTOUR HP3 91V": "VINMAX",
  "205/55R16 ECOTOUR HP3 91V": "VINMAX",
  "205/55R16 PREMIUMCONTACT6 91V": "CONTINENTAL",
  "205/55R16 TURANZA ER300 91V": "BRIDGESTONE",
  "205/55R16 ULTRACONTACT 91V": "CONTINENTAL",
  "205/55R17 AG-662 95W XL": "AGATE",
  "205/55R17 POWERCONTACT 91V": "CONTINENTAL",
  "215/55R18 BATMAN A51 95V": "ATLAS",
  "215/60R16 AG-266 95H": "AGATE",
  "215/60R17 KANSAS 96H": "ZWARTHZ",
  "225/55R19 PREMIUMCONTACT 6 103V": "CONTINENTAL",
  "225/60R18 PERFORMAX SUV 100H": "APLUS",
  "225/65R16 COMFORT HP 100H": "APLUS",
  "235/50 R19 99V TL PRIMACY 5 MI": "MICHELIN",
  "235/55R18 ECOPIA H/L 422 100H": "BRIDGESTONE",
  "235/55R19 EFFICIENT GRIP SUV 105V": "GOODYEAR",
  "255/50R20 109V EXTRA LOAD TL PREMIER LTX MI": "MICHELIN",
  "255/55R20 ASSURANCE MAXLIFE 107 H": "GOODYEAR",
  "295/35 ZR21 107Y XL TL LATITUDE SPORT 3 MO GRNX MI": "MICHELIN"
};

// Llantas capturadas a mano (sin No. de parte) que se identificaron revisando el modelo contra el catálogo
// o la marca escrita en la propia descripción. Descripción exacta (mayúsculas) -> [marca, cómo se identificó].
var MARCA_MANUAL = {
  "185/65R15 JK VECTRA 92T": ["JK TYRE", "Modelo JK VECTRA del catálogo"],
  "185/65R15 MR-169 88H": ["MIRAGE", "Marca indicada por Carlos"],
  "6.50-16 TT ASCENSO TS8110": ["ASCENSO", "Marca indicada por Carlos"],
  "225/65R17 ECOTOUR HP3 102H": ["VINMAX", "Modelo ECOTOUR HP3 del catálogo"],
  "235/55R17 SPORT GREEN 103W": ["ATLAS", "Modelo SPORT GREEN del catálogo"],
  "205/55R16 JK TYRE UX1 TL 91H": ["JK TYRE", "Marca escrita en la descripción"],
  "235/55R19 A51 101V": ["ATLAS", "Modelo A51 del catálogo"],
  "225/45R17 YOKOHAMA PREMIUM": ["YOKOHAMA", "Marca escrita en la descripción"],
  "225/60R18 YOKOHAMA PREMIUM GEOLANDAR G058": ["YOKOHAMA", "Marca escrita en la descripción"],
  "195/50 R 16 ADVAN V105": ["YOKOHAMA", "Línea ADVAN (Yokohama); no está en el catálogo"],
  "HANKOOK RF12 LT 120/116 S": ["HANKOOK", "Marca escrita en la descripción"],
  "175/70R13 YOKOHAMA": ["YOKOHAMA", "Marca escrita en la descripción"],
  "175/70R13 *ALLIANCE*": ["ALLIANCE", "Marca escrita en la descripción"],
  "175/70R13 *SUNFULL*": ["SUNFULL", "Marca escrita en la descripción"],
  "33X12.50R20 HANKOOK RF12 LT": ["HANKOOK", "Marca escrita en la descripción"],
  "6.50.16 TORNEL T1300": ["TORNEL", "Marca escrita en la descripción"],
  "195/45R15 ILINK L-ZEAL56 82V XL": ["ILINK", "Marca escrita en la descripción"],
  "195/70 R15C RY55 YOKOHAMA": ["YOKOHAMA", "Marca escrita en la descripción"]
};

function marcaNormalizarTexto_(t) { return String(t === null || t === undefined ? '' : t).trim().toUpperCase().replace(/\s+/g, ' '); }

// Decide la marca de UN renglón. Devuelve { marca, como } o null si no se puede identificar con certeza.
function marcaDeRenglon_(proveedor, noParte, producto) {
  var prov = String(proveedor || '').trim().toUpperCase(), cve = String(noParte || '').trim();
  if (prov && cve && MARCA_POR_CVE.hasOwnProperty(prov + '|' + cve)) return { marca: MARCA_POR_CVE[prov + '|' + cve], como: 'No. de parte' };
  var k = marcaNormalizarTexto_(producto);
  if (k && MARCA_POR_DESC.hasOwnProperty(k)) return { marca: MARCA_POR_DESC[k], como: 'Descripción igual al catálogo' };
  if (k && MARCA_MANUAL.hasOwnProperty(k)) return { marca: MARCA_MANUAL[k][0], como: MARCA_MANUAL[k][1] };
  return null;
}

// Arma el plan sin escribir nada. Es la ÚNICA lógica: PRUEBA y APLICAR usan lo mismo.
function planMarcaLlantas_(valores) {
  var plan = { cambios: [], yaTienen: 0, noIdentificadas: [], noLlantas: 0 };
  for (var i = 0; i < valores.length; i++) {
    var f = valores[i], fila = i + 2;
    if (String(f[COL_TIPO - 1]).trim() !== 'Llantas') { plan.noLlantas++; continue; }
    var prov = f[COL_PROVEEDOR - 1], cve = f[COL_NOPARTE - 1], prod = String(f[COL_PRODUCTO - 1] === null ? '' : f[COL_PRODUCTO - 1]);
    // renglones de servicio (montaje, balanceo, paquetes...) no tienen proveedor ni No. de parte: se dejan igual
    if (!String(prov).trim() && !String(cve).trim()) { plan.noLlantas++; continue; }
    var r = marcaDeRenglon_(prov, cve, prod);
    if (!r) { plan.noIdentificadas.push({ fila: fila, proveedor: prov, noParte: cve, producto: prod }); continue; }
    if (marcaNormalizarTexto_(prod).indexOf(marcaNormalizarTexto_(r.marca)) >= 0) { plan.yaTienen++; continue; }   // ya trae la marca: no se repite
    plan.cambios.push({ fila: fila, proveedor: prov, noParte: cve, anterior: prod, nuevo: r.marca + ' ' + prod.replace(/^\s+/, ''), marca: r.marca, como: r.como });
  }
  return plan;
}

function leerHoja1Marca_(ss) {
  var hoja = ss.getSheetByName(HOJA_COTIZACIONES);
  if (!hoja) throw new Error('No encontré la hoja ' + HOJA_COTIZACIONES);
  var ult = hoja.getLastRow();
  var valores = ult >= 2 ? hoja.getRange(2, 1, ult - 1, COL_PRODUCTO).getValues() : [];
  return { hoja: hoja, valores: valores, ultima: ult };
}

// 1) PRUEBA: no toca Hoja1. Llena la hoja "Vista previa Marca" para que Carlos revise antes de aplicar.
function completarMarcaLlantas_PRUEBA() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var d = leerHoja1Marca_(ss), plan = planMarcaLlantas_(d.valores);
  var vista = ss.getSheetByName(HOJA_VISTA_MARCA) || ss.insertSheet(HOJA_VISTA_MARCA);
  vista.clear();
  var filas = [['Resultado', 'Fila en Hoja1', 'Proveedor', 'No. de parte', 'Producto actual', 'Producto con marca', 'Marca', 'Cómo se identificó']];
  for (var i = 0; i < plan.cambios.length; i++) { var c = plan.cambios[i]; filas.push(['SE CAMBIARÍA', c.fila, c.proveedor, c.noParte, c.anterior, c.nuevo, c.marca, c.como]); }
  for (var j = 0; j < plan.noIdentificadas.length; j++) { var n = plan.noIdentificadas[j]; filas.push(['NO IDENTIFICADA (se queda igual)', n.fila, n.proveedor, n.noParte, n.producto, '', '', '']); }
  vista.getRange(1, 1, filas.length, 8).setValues(filas);
  var resumen = 'PRUEBA (Hoja1 NO se modificó): se cambiarían ' + plan.cambios.length + ' renglones · ya traían marca ' + plan.yaTienen +
    ' · no identificadas ' + plan.noIdentificadas.length + ' · otros renglones (servicios/otros tipos) ' + plan.noLlantas + '. Revisa la hoja "' + HOJA_VISTA_MARCA + '".';
  Logger.log(resumen);
  return { cambios: plan.cambios.length, yaTienen: plan.yaTienen, noIdentificadas: plan.noIdentificadas.length, noLlantas: plan.noLlantas, resumen: resumen };
}

// 2) APLICAR: escribe la marca al frente de Producto SOLO en los renglones identificados y guarda respaldo.
function completarMarcaLlantas_APLICAR() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var d = leerHoja1Marca_(ss), plan = planMarcaLlantas_(d.valores);
    if (!plan.cambios.length) { var m0 = 'Nada que cambiar (todas las llantas identificadas ya traen su marca).'; Logger.log(m0); return { cambios: 0, resumen: m0 }; }
    var resp = ss.getSheetByName(HOJA_RESPALDO_MARCA);
    if (!resp) { resp = ss.insertSheet(HOJA_RESPALDO_MARCA); resp.getRange(1, 1, 1, 6).setValues([['Fecha', 'Fila en Hoja1', 'Producto anterior', 'Producto nuevo', 'Marca', 'Deshecho']]); }
    var ahora = new Date().toISOString();
    var respaldo = [];
    // se escribe la columna Producto completa de una sola vez (los renglones que no cambian conservan su valor)
    var col = d.valores.map(function (f) { return [f[COL_PRODUCTO - 1]]; });
    for (var i = 0; i < plan.cambios.length; i++) {
      var c = plan.cambios[i];
      col[c.fila - 2][0] = c.nuevo;
      respaldo.push([ahora, c.fila, c.anterior, c.nuevo, c.marca, '']);
    }
    resp.getRange(resp.getLastRow() + 1, 1, respaldo.length, 6).setValues(respaldo);
    d.hoja.getRange(2, COL_PRODUCTO, col.length, 1).setValues(col);
    var resumen = 'APLICADO: ' + plan.cambios.length + ' renglones con marca · ya traían ' + plan.yaTienen + ' · no identificadas (sin cambio) ' + plan.noIdentificadas.length + '. Respaldo en la hoja "' + HOJA_RESPALDO_MARCA + '".';
    Logger.log(resumen);
    return { cambios: plan.cambios.length, yaTienen: plan.yaTienen, noIdentificadas: plan.noIdentificadas.length, resumen: resumen };
  } finally { candado.releaseLock(); }
}

// 3) DESHACER: regresa el Producto anterior SOLO si el renglón sigue diciendo lo que APLICAR escribió.
function deshacerMarcaLlantas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var resp = ss.getSheetByName(HOJA_RESPALDO_MARCA);
    if (!resp || resp.getLastRow() < 2) { var m0 = 'No hay respaldo: no hay nada que deshacer.'; Logger.log(m0); return { restaurados: 0, resumen: m0 }; }
    var d = leerHoja1Marca_(ss);
    var col = d.valores.map(function (f) { return [f[COL_PRODUCTO - 1]]; });
    var reg = resp.getRange(2, 1, resp.getLastRow() - 1, 6).getValues();
    var restaurados = 0, omitidos = 0;
    for (var i = 0; i < reg.length; i++) {
      if (String(reg[i][5]) === 'Sí') continue;                    // ya estaba deshecho
      var idx = Number(reg[i][1]) - 2;
      if (idx >= 0 && idx < col.length && String(col[idx][0]) === String(reg[i][3])) { col[idx][0] = reg[i][2]; reg[i][5] = 'Sí'; restaurados++; }
      else { reg[i][5] = 'No se pudo (el renglón cambió o se movió)'; omitidos++; }
    }
    d.hoja.getRange(2, COL_PRODUCTO, col.length, 1).setValues(col);
    resp.getRange(2, 6, reg.length, 1).setValues(reg.map(function (r) { return [r[5]]; }));
    var resumen = 'DESHECHO: ' + restaurados + ' renglones regresados · ' + omitidos + ' no se pudieron regresar (cambiaron o se movieron).';
    Logger.log(resumen);
    return { restaurados: restaurados, omitidos: omitidos, resumen: resumen };
  } finally { candado.releaseLock(); }
}


// ═══════════════════════════════════════════════════════════════════════════
//  COLUMNA "MARCA" (W) EN Hoja1 — relleno del historial (8 oct 2026)
//  A partir de ahora el cotizador manda la marca de cada llanta y doPost la guarda en la columna W.
//  Estas funciones llenan la columna W de las llantas que ya estaban en el historial.
//  Orden:  1) columnaMarca_PRUEBA   (solo mira; llena la hoja "Vista previa Columna Marca")
//          2) columnaMarca_APLICAR  (escribe la marca en W solo donde está vacía; guarda respaldo)
//          3) columnaMarca_DESHACER (vacía lo que APLICAR escribió, si el valor sigue igual)
//  Se puede correr de nuevo cuando quieras: solo llena los renglones de llanta que sigan sin marca.
// ═══════════════════════════════════════════════════════════════════════════
var HOJA_VISTA_COL_MARCA = 'Vista previa Columna Marca';
var HOJA_RESPALDO_COL_MARCA = 'Respaldo Columna Marca';

// Todas las marcas del catálogo (más las que se han capturado a mano). Sirve para reconocer la marca
// cuando el renglón ya la trae escrita en el Producto (al frente o dentro del texto).
var MARCAS_CONOCIDAS = [
  "ACCELERA",
  "ADVANCE",
  "AGATE",
  "ALFAMOTORS",
  "ALLIANCE",
  "AMERICA",
  "AMULET",
  "ANSU",
  "ANTARES",
  "APLUS",
  "ARCRON",
  "ASCENSO",
  "ATLAS",
  "BARUM",
  "BFGOODRICH",
  "BLACKARROW",
  "BLACKHAWK",
  "BLACKLION",
  "BRIDGESTONE",
  "BROADPEAK",
  "COBRA",
  "CONTINENTAL",
  "COOPER",
  "DERUIBO",
  "DOUBLEKING",
  "DOUBLESTAR",
  "DSTAR",
  "DUNLOP",
  "EUZKADI",
  "FARROAD",
  "FIRESTONE",
  "FORCELAND",
  "FRONWAY",
  "FULLRUN",
  "FULLWAY",
  "GALLANT",
  "GENERAL",
  "GMX PRIME",
  "GOODRIDE",
  "GOODYEAR",
  "GOPRO",
  "GREEN MAX",
  "GREENTRAC",
  "GUTEROAD",
  "HABILEAD",
  "HAIDA",
  "HANKOOK",
  "HAPPY ROAD",
  "HIFLY",
  "HIFLY(TORQUE)",
  "ILINK",
  "JK TYRE",
  "KAPSEN",
  "KAYTOON",
  "KELLY",
  "KETER",
  "KUMHO",
  "LANDY",
  "LANVIGATOR",
  "LAUFENN",
  "LCH",
  "LINGLONG",
  "MASTERCRAFT",
  "MAXTREK",
  "MAXXIS",
  "MAZZINI",
  "MICHELIN",
  "MILEVER",
  "MINELL",
  "MINNELL",
  "MIRAGE",
  "NEXEN",
  "NITTO",
  "NOBHEX",
  "NOVAMAXX",
  "ONYX",
  "PASSI",
  "PEGASUS",
  "PIRELLI",
  "RACEALONE",
  "RETRO",
  "ROADCLAW",
  "ROADMASTER",
  "ROADX",
  "ROYAL BLACK",
  "SAFERICH",
  "SAILUN",
  "SIERRA",
  "STARFIRE",
  "STARK",
  "SUMAXX",
  "SUMITOMO",
  "SUNEW",
  "SUNFULL",
  "SURETRAC",
  "TBBTIRES",
  "TDI TIRES",
  "TORNEL",
  "TORQUE",
  "TOYO",
  "TURNPIKE",
  "UNIROYAL",
  "VIKRANT",
  "VINMAX",
  "WINDA",
  "WINRUN",
  "WOSEN",
  "XBRI",
  "YOKOHAMA",
  "ZEXTOUR",
  "ZWARTHZ"
];

// Decide la marca de UN renglón de llanta para la columna W. Devuelve { marca, como } o null.
function marcaParaColumna_(proveedor, noParte, producto) {
  var r = marcaDeRenglon_(proveedor, noParte, producto);          // No. de parte / descripción exacta / lista manual
  if (r) return { marca: r.marca, como: r.como };
  var k = marcaNormalizarTexto_(producto);
  if (!k) return null;
  // 1) la marca ya está al frente (renglones a los que se les puso la marca antes, o capturados con el cotizador nuevo)
  var mejor = '';
  for (var i = 0; i < MARCAS_CONOCIDAS.length; i++) {
    var m = MARCAS_CONOCIDAS[i];
    if (k.indexOf(m + ' ') === 0 && m.length > mejor.length) mejor = m;
  }
  if (mejor) return { marca: mejor, como: 'Marca al frente del Producto' };
  // 2) la marca aparece como palabra completa dentro del texto
  var hallados = [];
  for (var j = 0; j < MARCAS_CONOCIDAS.length; j++) {
    var b = MARCAS_CONOCIDAS[j];
    var pos = k.indexOf(b);
    while (pos >= 0) {
      var antes = pos === 0 ? ' ' : k.charAt(pos - 1), desp = pos + b.length >= k.length ? ' ' : k.charAt(pos + b.length);
      if (/[^A-Z0-9]/.test(antes) && /[^A-Z0-9]/.test(desp)) { hallados.push(b); break; }
      pos = k.indexOf(b, pos + 1);
    }
  }
  // se descartan marcas contenidas en otra marca más larga encontrada (ej. "GREEN" dentro de "GREEN MAX")
  hallados = hallados.filter(function (h) { return !hallados.some(function (o) { return o !== h && o.indexOf(h) >= 0; }); });
  if (hallados.length === 1) return { marca: hallados[0], como: 'Marca escrita en el Producto' };
  return null;
}

// Lee Hoja1 (hasta la columna W si existe) y arma el plan. No escribe nada.
function planColumnaMarca_(ss) {
  var hoja = ss.getSheetByName(HOJA_COTIZACIONES);
  if (!hoja) throw new Error('No encontré la hoja ' + HOJA_COTIZACIONES);
  var ult = hoja.getLastRow();
  var ancho = Math.min(hoja.getMaxColumns(), COL_MARCA);
  var valores = ult >= 2 ? hoja.getRange(2, 1, ult - 1, ancho).getValues() : [];
  var plan = { hoja: hoja, ancho: ancho, ultima: ult, nuevas: [], yaTienen: 0, sinMarca: [], noLlantas: 0 };
  for (var i = 0; i < valores.length; i++) {
    var f = valores[i], fila = i + 2;
    var prov = f[COL_PROVEEDOR - 1], cve = f[COL_NOPARTE - 1], prod = f[COL_PRODUCTO - 1];
    if (String(f[COL_TIPO - 1]).trim() !== 'Llantas' || (!String(prov).trim() && !String(cve).trim())) { plan.noLlantas++; continue; }   // servicios y otros tipos: sin marca
    var actual = ancho >= COL_MARCA ? String(f[COL_MARCA - 1] === null ? '' : f[COL_MARCA - 1]).trim() : '';
    if (actual) { plan.yaTienen++; continue; }
    var r = marcaParaColumna_(prov, cve, prod);
    if (!r) { plan.sinMarca.push({ fila: fila, proveedor: prov, noParte: cve, producto: prod }); continue; }
    plan.nuevas.push({ fila: fila, proveedor: prov, noParte: cve, producto: prod, marca: r.marca, como: r.como });
  }
  return plan;
}

// 1) PRUEBA: no modifica Hoja1.
function columnaMarca_PRUEBA() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var plan = planColumnaMarca_(ss);
  var vista = ss.getSheetByName(HOJA_VISTA_COL_MARCA) || ss.insertSheet(HOJA_VISTA_COL_MARCA);
  vista.clear();
  var filas = [['Resultado', 'Fila en Hoja1', 'Proveedor', 'No. de parte', 'Producto', 'Marca que se escribiría en W', 'Cómo se identificó']];
  for (var i = 0; i < plan.nuevas.length; i++) { var c = plan.nuevas[i]; filas.push(['SE ESCRIBIRÍA', c.fila, c.proveedor, c.noParte, c.producto, c.marca, c.como]); }
  for (var j = 0; j < plan.sinMarca.length; j++) { var n = plan.sinMarca[j]; filas.push(['SIN MARCA (se queda vacía)', n.fila, n.proveedor, n.noParte, n.producto, '', '']); }
  vista.getRange(1, 1, filas.length, 7).setValues(filas);
  var resumen = 'PRUEBA (Hoja1 NO se modificó): se escribiría la marca en ' + plan.nuevas.length + ' renglones · ya la tenían ' + plan.yaTienen +
    ' · sin identificar ' + plan.sinMarca.length + ' · renglones que no son llanta ' + plan.noLlantas + '. Revisa la hoja "' + HOJA_VISTA_COL_MARCA + '".';
  Logger.log(resumen);
  return { nuevas: plan.nuevas.length, yaTienen: plan.yaTienen, sinMarca: plan.sinMarca.length, noLlantas: plan.noLlantas, resumen: resumen };
}

// 2) APLICAR: escribe la marca en la columna W solo donde está vacía.
function columnaMarca_APLICAR() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var hoja = ss.getSheetByName(HOJA_COTIZACIONES);
    if (!hoja) throw new Error('No encontré la hoja ' + HOJA_COTIZACIONES);
    if (hoja.getMaxColumns() < COL_MARCA) hoja.insertColumnsAfter(hoja.getMaxColumns(), COL_MARCA - hoja.getMaxColumns());
    var enc = hoja.getRange(1, COL_MARCA, 1, 1);
    if (!String(enc.getValues()[0][0]).trim()) enc.setValues([['Marca']]);
    var plan = planColumnaMarca_(ss);
    if (!plan.nuevas.length) { var m0 = 'Nada que escribir: todas las llantas identificables ya tienen marca en la columna W.'; Logger.log(m0); return { escritas: 0, resumen: m0 }; }
    var resp = ss.getSheetByName(HOJA_RESPALDO_COL_MARCA);
    if (!resp) { resp = ss.insertSheet(HOJA_RESPALDO_COL_MARCA); resp.getRange(1, 1, 1, 4).setValues([['Fecha', 'Fila en Hoja1', 'Marca escrita', 'Deshecho']]); }
    var ult = hoja.getLastRow();
    var col = hoja.getRange(2, COL_MARCA, ult - 1, 1).getValues();
    var ahora = new Date().toISOString(), respaldo = [];
    for (var i = 0; i < plan.nuevas.length; i++) {
      var c = plan.nuevas[i];
      col[c.fila - 2][0] = c.marca;
      respaldo.push([ahora, c.fila, c.marca, '']);
    }
    resp.getRange(resp.getLastRow() + 1, 1, respaldo.length, 4).setValues(respaldo);
    hoja.getRange(2, COL_MARCA, col.length, 1).setValues(col);
    var resumen = 'APLICADO: marca escrita en ' + plan.nuevas.length + ' renglones · ya la tenían ' + plan.yaTienen + ' · sin identificar ' + plan.sinMarca.length + '. Respaldo en "' + HOJA_RESPALDO_COL_MARCA + '".';
    Logger.log(resumen);
    return { escritas: plan.nuevas.length, yaTienen: plan.yaTienen, sinMarca: plan.sinMarca.length, resumen: resumen };
  } finally { candado.releaseLock(); }
}

// 3) DESHACER: vacía de la columna W lo que APLICAR escribió, solo si el valor sigue igual.
function columnaMarca_DESHACER() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var resp = ss.getSheetByName(HOJA_RESPALDO_COL_MARCA), hoja = ss.getSheetByName(HOJA_COTIZACIONES);
    if (!resp || resp.getLastRow() < 2) { var m0 = 'No hay respaldo: no hay nada que deshacer.'; Logger.log(m0); return { quitadas: 0, resumen: m0 }; }
    var ult = hoja.getLastRow();
    var col = hoja.getRange(2, COL_MARCA, ult - 1, 1).getValues();
    var reg = resp.getRange(2, 1, resp.getLastRow() - 1, 4).getValues();
    var quitadas = 0, omitidas = 0;
    for (var i = 0; i < reg.length; i++) {
      if (String(reg[i][3]) === 'Sí') continue;
      var idx = Number(reg[i][1]) - 2;
      if (idx >= 0 && idx < col.length && String(col[idx][0]) === String(reg[i][2])) { col[idx][0] = ''; reg[i][3] = 'Sí'; quitadas++; }
      else { reg[i][3] = 'No se pudo (el renglón cambió o se movió)'; omitidas++; }
    }
    hoja.getRange(2, COL_MARCA, col.length, 1).setValues(col);
    resp.getRange(2, 4, reg.length, 1).setValues(reg.map(function (r) { return [r[3]]; }));
    var resumen = 'DESHECHO: ' + quitadas + ' marcas quitadas de la columna W · ' + omitidas + ' no se pudieron quitar (cambiaron o se movieron).';
    Logger.log(resumen);
    return { quitadas: quitadas, omitidas: omitidas, resumen: resumen };
  } finally { candado.releaseLock(); }
}
