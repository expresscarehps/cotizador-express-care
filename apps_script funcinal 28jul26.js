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
