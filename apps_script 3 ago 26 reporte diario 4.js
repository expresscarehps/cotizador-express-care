// ── CONFIGURACIÓN ────────────────────────────────────────
var DRIVE_FOLDER_ID = '13l2nG21pKq3kJ3NKfGYXIVzyTLMP8i1K';
var FOLIO_INICIO    = 20;
var FOLIO_HOJA      = 'Folios';

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
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        sheet.appendRow([
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
          firstRow ? data.total    : '',  // Col 16 Total
          '',                             // Col 17 Estatus (vacío, se llena manual)
          firstRow ? data.folio    : ''   // Col 18 Cotización (folio EXPCARE-XXX/XX)
        ]);
        firstRow = false;
      }
      var lastRow     = sheet.getLastRow();
      var firstRowNum = lastRow - items.length + 1;
      sheet.getRange(firstRowNum, 1, items.length, 18).setBorder(true,true,true,true,true,true);
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

// ── doGet ─────────────────────────────────────────────────
function doGet(e) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var callback = e.parameter.callback || '';

    // ── Folio consecutivo ─────────────────────────────────
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
      hoja.getRange(2, 1, 1, 2).setValues([[siguiente, anioActual]]);
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
