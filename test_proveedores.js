// ── TEST — Proveedor en lista por servicio, obligatorio, "mismo proveedor", "Otro…" y Configuración ──
// Uso:  node test_proveedores.js [ruta_al_html]   (por defecto ./cotizador_dev.html)
const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; }
catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
process.on('unhandledRejection', (e) => { console.log('ERROR NO CONTROLADO:', e && e.stack || e); process.exit(1); });
let passed = 0, failed = 0;
function ok(name, cond, extra) { if (cond) { console.log('  ✅ ' + name); passed++; } else { console.log('  ❌ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); failed++; } }
const wait = ms => new Promise(r => setTimeout(r, ms));
function abrir(query) {
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    url: 'https://expresscarehps.github.io/cotizador-express-care/cotizador_dev.html' + (query === undefined ? '?test=1' : query),
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
  W = w;
  return w;
}
let W = null;
const $ = s => W.document.querySelector(s);
const $$ = (w, s) => Array.from(w.document.querySelectorAll(s));
const opts = sel => Array.from(sel.options).map(o => o.value).filter(v => v && v !== '__otro__');
function cambiar(w, sel, valor) { sel.value = valor; sel.dispatchEvent(new w.Event('change', { bubbles: true })); }
function filaDe(w, concepto) { return $$(w, '#taller-items .taller-row').find(r => (r.querySelector('input[data-f="concepto"]') || {}).value === concepto); }
function itemDe(w, concepto) { return w.tallerItems.find(i => i.concepto === concepto && (!i.tipo || true)); }
function ponerEnCotizacion(it, precio) { it.precio = precio || 500; it.qty = 1; }
function erroresProv(w) { return w.validarCampos().filter(e => /^Proveedor de/.test(e)); }
function tab(w, s) { w.setTallerSvc(s, null); }

(async () => {
  let w = abrir(); await wait(300);

  console.log('\n— A. Cada servicio tiene su lista');
  tab(w, 'suspension');
  const filaAmort = filaDe(w, 'Amortiguador delantero');
  const selAmort = filaAmort.querySelector('select.prov-sel');
  ok('A1 el renglón de una pieza trae lista (select), no texto libre', !!selAmort && !filaAmort.querySelector('input[data-f="proveedor"]'));
  ok('A2 Suspensión: sin Lumo, con Chavitar, AutoZone EUA y Mercado Libre', JSON.stringify(opts(selAmort)) === JSON.stringify(['Govi', 'AutoZone', 'Dar', 'Maresa', 'Malpa', 'Octavio Vázquez', 'Dasda', 'Corral Mantilla', 'Chevrolet Agencia', 'Chavitar', 'AutoZone EUA', 'Mercado Libre']), opts(selAmort));
  ok('A3 la lista termina con "Otro…"', selAmort.options[selAmort.options.length - 1].value === '__otro__');
  ok('A4 la mano de obra NO lleva proveedor', !filaDe(w, 'Mano de obra amortiguador delantero').querySelector('select.prov-sel'));
  tab(w, 'frenos');
  ok('A5 Frenos: sin Govi, con Chavitar y Mercado Libre', JSON.stringify(opts(filaDe(w, 'Balatas delanteras').querySelector('select.prov-sel'))) === JSON.stringify(['Malpa', 'AutoZone', 'Lumo', 'Balatas y Embragues', 'Corral Mantilla', 'Chavitar', 'Mercado Libre']));
  const selRect = filaDe(w, 'Rectificado de discos').querySelector('select.prov-sel');
  ok('A6 Rectificado ofrece solo Frenalex y Perea', !!selRect && JSON.stringify(opts(selRect)) === JSON.stringify(['Frenalex', 'Perea']), selRect && opts(selRect));
  ok('A7 en Rectificado el proveedor dice que es opcional', /opcional/i.test(selRect.options[0].textContent));
  tab(w, 'aceite');
  ok('A8 Aceite: AutoZone, Chavitar y CAASA', JSON.stringify(opts(filaDe(w, 'Filtro de aceite').querySelector('select.prov-sel'))) === JSON.stringify(['AutoZone', 'Chavitar', 'CAASA']));
  ok('A9 el aceite por litro (precio fijo) SÍ lleva selector de proveedor', !!filaDe(w, 'Aceite (especificar viscosidad)').querySelector('select.prov-sel'));
  tab(w, 'afinacion');
  ok('A10 Afinación: AutoZone, Octavio Vázquez, Mercado Libre, Chavitar, CAASA y ECOM', JSON.stringify(opts(filaDe(w, 'Filtro de aire').querySelector('select.prov-sel'))) === JSON.stringify(['AutoZone', 'Octavio Vázquez', 'Mercado Libre', 'Chavitar', 'CAASA', 'ECOM']));
  ok('A10b las limpiezas (inyectores, cuerpo de aceleración) llevan selector con ECOM', ['Limpieza de inyectores', 'Limpieza cuerpo de aceleración'].every(n => { const s = filaDe(w, n).querySelector('select.prov-sel'); return !!s && opts(s).indexOf('ECOM') >= 0; }));
  tab(w, 'libre'); w.addTallerItem();
  const libreSel = $('#taller-items select.prov-sel');
  const todosNombres = ['AutoZone', 'AutoZone EUA', 'Govi', 'Cosmos', 'Malpa', 'Octavio Vázquez', 'Dar', 'Maresa', 'Dasda', 'Corral Mantilla', 'Lumo', 'Chevrolet Agencia', 'Balatas y Embragues', 'Chavitar', 'Mercado Libre', 'CAASA', 'ECOM'];
  ok('A11 Libre: renglón nuevo trae TODOS los proveedores', !!libreSel && JSON.stringify(opts(libreSel)) === JSON.stringify(todosNombres), libreSel && opts(libreSel));
  ok('A12 Libre incluye a todos los de los otros servicios', ['suspension', 'frenos', 'aceite', 'afinacion'].every(k => w.PROV_LISTAS[k].every(n => w.PROV_LISTAS.libre.indexOf(n) >= 0)));

  console.log('\n— B. Elegir proveedor');
  tab(w, 'suspension');
  const selB = filaDe(w, 'Horquilla').querySelector('select.prov-sel');
  cambiar(w, selB, 'Govi');
  ok('B1 al elegir, el renglón guarda el proveedor', itemDe(w, 'Horquilla').proveedor === 'Govi', itemDe(w, 'Horquilla').proveedor);
  ok('B2 el select muestra lo elegido', filaDe(w, 'Horquilla').querySelector('select.prov-sel').value === 'Govi');

  console.log('\n— C. El proveedor no puede faltar');
  w = abrir(); await wait(300);
  tab(w, 'suspension');
  const horq = itemDe(w, 'Horquilla'), amort = itemDe(w, 'Amortiguador delantero'), mo = itemDe(w, 'Mano de obra instalación horquilla');
  ponerEnCotizacion(horq, 1369); ponerEnCotizacion(amort, 900); ponerEnCotizacion(mo, 780);
  let e = erroresProv(w);
  ok('C1 dos piezas en la cotización sin proveedor → 2 avisos', e.length === 2, e);
  ok('C2 el aviso dice cuál pieza y de qué servicio', e.some(x => /«Horquilla» \(Suspensión\)/.test(x)) && e.some(x => /«Amortiguador delantero»/.test(x)), e);
  ok('C3 la mano de obra sin proveedor NO da aviso', !e.some(x => /Mano de obra/.test(x)));
  ok('C4 los selects de esas piezas se marcan en rojo', filaDe(w, 'Horquilla').querySelector('select').classList.contains('field-error'));
  cambiar(w, filaDe(w, 'Horquilla').querySelector('select.prov-sel'), 'Govi');
  e = erroresProv(w);
  ok('C5 al elegir proveedor ese aviso desaparece y queda 1', e.length === 1 && /Amortiguador/.test(e[0]), e);
  ok('C6 el select ya no está en rojo', !filaDe(w, 'Horquilla').querySelector('select').classList.contains('field-error'));
  const barra = itemDe(w, 'Barra estabilizadora');   // qty 0, sin precio: no está en la cotización
  ok('C7 una pieza que NO está en la cotización no se exige', !erroresProv(w).some(x => /Barra/.test(x)));
  tab(w, 'frenos');
  ponerEnCotizacion(itemDe(w, 'Rectificado de discos'), 180);
  ok('C8 Rectificado sin proveedor SÍ se permite', !erroresProv(w).some(x => /Rectificado/.test(x)));
  tab(w, 'aceite');
  const fc = itemDe(w, 'Filtro de cabina'); ponerEnCotizacion(fc, 300);
  ok('C9 una pieza marcada opcional también necesita proveedor', erroresProv(w).some(x => /«Filtro de cabina» \(Aceite\)/.test(x)), erroresProv(w));
  fc.proveedor = 'AZ'; w.renderTallerItems();
  ok('C10 un proveedor viejo de borrador (texto libre) no bloquea ni se pierde', !erroresProv(w).some(x => /Filtro de cabina/.test(x)));
  const sel10 = filaDe(w, 'Filtro de cabina').querySelector('select.prov-sel');
  ok('C11 y sigue visible en el select', sel10.value === 'AZ', sel10.value);

  console.log('\n— C2. Aceite por litro y limpiezas también llevan proveedor (13 oct)');
  w = abrir(); await wait(300);
  tab(w, 'afinacion');
  const lAcei = itemDe(w, 'Aceite (especificar viscosidad)'), lInyec = itemDe(w, 'Limpieza de inyectores'), lCuerpo = itemDe(w, 'Limpieza cuerpo de aceleración'), lMO = itemDe(w, 'Mano de obra afinación mayor');
  ponerEnCotizacion(lAcei, 120); lAcei.qty = 4; ponerEnCotizacion(lInyec, 500); ponerEnCotizacion(lCuerpo, 450); ponerEnCotizacion(lMO, 800);
  let e2 = erroresProv(w);
  ok('C12 aceite por litro sin proveedor → aviso con servicio', e2.some(x => /«Aceite \(especificar viscosidad\)» \(Afinación\)/.test(x)), e2);
  ok('C13 limpieza de inyectores y de cuerpo de aceleración sin proveedor → aviso', e2.some(x => /Limpieza de inyectores/.test(x)) && e2.some(x => /Limpieza cuerpo de aceleración/.test(x)), e2);
  ok('C14 la mano de obra sigue sin proveedor y SIN aviso', !e2.some(x => /Mano de obra/.test(x)) && e2.length === 3, e2);
  ok('C15 el selector del aceite se marca en rojo', filaDe(w, 'Aceite (especificar viscosidad)').querySelector('select.prov-sel').classList.contains('field-error'));
  cambiar(w, filaDe(w, 'Aceite (especificar viscosidad)').querySelector('select.prov-sel'), 'Chavitar');
  cambiar(w, filaDe(w, 'Limpieza de inyectores').querySelector('select.prov-sel'), 'ECOM');
  e2 = erroresProv(w);
  ok('C16 al elegir Chavitar y ECOM solo queda el aviso de la limpieza de cuerpo de aceleración', e2.length === 1 && /cuerpo de aceleración/.test(e2[0]), e2);
  ok('C17 el proveedor queda guardado en el renglón', itemDe(w, 'Aceite (especificar viscosidad)').proveedor === 'Chavitar' && itemDe(w, 'Limpieza de inyectores').proveedor === 'ECOM');
  // "Mismo proveedor" solo llena piezas, no aceite ni limpiezas
  cambiar(w, $('#prov-todos-sel'), 'AutoZone');
  ok('C18 "Mismo proveedor para todas las piezas" NO toca el aceite ni las limpiezas', itemDe(w, 'Limpieza cuerpo de aceleración').proveedor === '' && itemDe(w, 'Aceite (especificar viscosidad)').proveedor === 'Chavitar');
  // Rectificado sigue siendo opcional
  tab(w, 'frenos'); ponerEnCotizacion(itemDe(w, 'Rectificado de tambor'), 150);
  ok('C19 Rectificado sigue siendo opcional', !erroresProv(w).some(x => /Rectificado/.test(x)));
  // Copiar a WhatsApp se bloquea con todo y completo mientras falte uno
  tab(w, 'afinacion');
  w.document.getElementById('cli-nombre').value = 'Cliente Prueba'; w.document.getElementById('cli-tel').value = '6145550123'; w.document.getElementById('cli-origen').value = 'WhatsApp'; w.document.getElementById('asesor').value = 'Ana';
  w.document.getElementById('v-marca').value = 'Nissan'; w.document.getElementById('v-modelo').value = 'Sentra'; w.document.getElementById('v-anio').value = '2020'; w.document.getElementById('v-cil').value = '4';
  const alertas = []; w.alert = m => alertas.push(String(m));
  w.generarWA(); w.copiar();
  ok('C20 con una limpieza sin proveedor, "Copiar para WhatsApp" avisa y no deja pasar', alertas.length === 1 && /Faltan datos/.test(alertas[0]) && /cuerpo de aceleración/.test(alertas[0]), alertas);

  console.log('\n— C3. Marcas rojas de proveedor en TODAS las pestañas (14 oct)');
  w = abrir(); await wait(300);
  $('#cli-nombre').value = 'Cliente Prueba'; $('#cli-tel').value = '6144567890'; $('#v-marca').value = 'Nissan'; $('#v-modelo').value = 'Sentra'; $('#v-anio').value = '2022'; $('#v-cil').value = '4';
  const origen = $('#cli-origen'); if (origen && origen.options.length > 1) origen.selectedIndex = 1;
  $('#asesor').value = 'XEN';
  const rojosVisibles = () => $$(w, 'select.prov-sel.field-error').map(s => s.getAttribute('data-prov-id'));
  const tabsMarcadas = () => $$(w, '.ttab.ttab-err').map(t => t.getAttribute('data-s')).sort();
  const poner = (svc, nombre, campo, valor) => { tab(w, svc); const it = w.tallerItems.find(i => i.tipo === svc && i.concepto === nombre); w.updTallerField(it.id, campo, valor); w.updTallerField(it.id, 'qty', '1'); return it; };
  const iFiltro = poner('afinacion', 'Filtro de aceite', 'costo', '100');
  const iAceite = poner('afinacion', 'Aceite (especificar viscosidad)', 'precio', '130');
  const iBalata = poner('frenos', 'Balatas delanteras', 'costo', '200');
  const iRect = poner('frenos', 'Rectificado de discos', 'precio', '300');
  const iHorq = poner('suspension', 'Horquilla', 'costo', '123');
  tab(w, 'suspension');   // como en la prueba de Carlos: se copia estando en Suspensión
  ok('C21 sin errores de proveedor antes de validar no hay marcas', rojosVisibles().length === 0 && tabsMarcadas().length === 0);
  let eC3 = erroresProv(w);
  ok('C22 la validación reporta las 4 faltantes (pieza, aceite, balatas, horquilla) y NO el rectificado', eC3.length === 4 && !eC3.some(x => /Rectificado/.test(x)), eC3);
  ok('C23 en la pestaña visible (Suspensión) la Horquilla sale en rojo', rojosVisibles().length === 1 && rojosVisibles()[0] === iHorq.id, rojosVisibles());
  ok('C24 las pestañas con faltantes quedan marcadas: Afinación, Frenos y Suspensión (Aceite y Libre no)', JSON.stringify(tabsMarcadas()) === JSON.stringify(['afinacion', 'frenos', 'suspension']), tabsMarcadas());
  tab(w, 'afinacion');
  const rojosAf = $$(w, '#taller-items .taller-row').filter(r => r.querySelector('select.prov-sel.field-error')).map(r => r.querySelector('input[data-f="concepto"]').value);
  ok('C25 al abrir Afinación el filtro y el aceite por litro salen en rojo (y los demás renglones no)', JSON.stringify(rojosAf) === JSON.stringify(['Filtro de aceite', 'Aceite (especificar viscosidad)']), rojosAf);
  $('#ttab-frenos').click();   // clic real en el botón de la pestaña (el ayudante tab() no marca la pestaña activa)
  const rojosFr = $$(w, '#taller-items .taller-row').filter(r => r.querySelector('select.prov-sel.field-error')).map(r => r.querySelector('input[data-f="concepto"]').value);
  ok('C26 al abrir Frenos solo las balatas salen en rojo, el rectificado opcional no', JSON.stringify(rojosFr) === JSON.stringify(['Balatas delanteras']), rojosFr);
  ok('C27 la pestaña actual sigue activa (.on) y la marca de error no la reemplaza', $('#ttab-frenos').classList.contains('on') && $('#ttab-frenos').classList.contains('ttab-err'));
  // elegir proveedor quita SOLO la marca de ese renglón
  cambiar(w, filaDe(w, 'Balatas delanteras').querySelector('select.prov-sel'), 'AutoZone');
  ok('C28 al elegir proveedor se quita la marca del renglón y la pestaña Frenos deja de estar marcada', rojosVisibles().length === 0 && tabsMarcadas().indexOf('frenos') < 0, tabsMarcadas());
  ok('C29 Afinación y Suspensión siguen marcadas', JSON.stringify(tabsMarcadas()) === JSON.stringify(['afinacion', 'suspension']), tabsMarcadas());
  tab(w, 'afinacion');
  cambiar(w, filaDe(w, 'Filtro de aceite').querySelector('select.prov-sel'), 'AutoZone');
  ok('C30 con un renglón de Afinación pendiente, la pestaña sigue marcada', tabsMarcadas().indexOf('afinacion') >= 0 && rojosVisibles().length === 1);
  cambiar(w, filaDe(w, 'Aceite (especificar viscosidad)').querySelector('select.prov-sel'), 'Chavitar');
  ok('C31 al completar el aceite por litro la pestaña Afinación se desmarca', tabsMarcadas().indexOf('afinacion') < 0 && rojosVisibles().length === 0, tabsMarcadas());
  // "Mismo proveedor" también limpia
  tab(w, 'suspension');
  cambiar(w, $('#prov-todos-sel'), 'Govi');
  ok('C32 "Mismo proveedor" en Suspensión quita la marca y la pestaña', tabsMarcadas().length === 0 && rojosVisibles().length === 0, tabsMarcadas());
  ok('C33 con todos los proveedores puestos, validar no devuelve errores de proveedor', erroresProv(w).length === 0 && tabsMarcadas().length === 0);
  // borrar el renglón pendiente quita su marca; limpiar todo quita todas
  iHorq.proveedor = ''; w.validarCampos();
  ok('C34 si se vuelve a vaciar, vuelve a marcarse la pestaña Suspensión', tabsMarcadas().join() === 'suspension', tabsMarcadas());
  w.tallerItems = w.tallerItems.filter(i => i.id !== iHorq.id); w.renderTallerItems();
  ok('C35 si se elimina el renglón pendiente, ya no queda marca en la pestaña', tabsMarcadas().length === 0, tabsMarcadas());
  iBalata.proveedor = ''; w.validarCampos();
  ok('C36 de nuevo con un faltante hay marca', tabsMarcadas().join() === 'frenos');
  w.limpiarTodo(true);
  ok('C37 "Nueva cotización" limpia todas las marcas', tabsMarcadas().length === 0 && rojosVisibles().length === 0 && Object.keys(w.provErrIds).length === 0, tabsMarcadas());
  // copiar real: con faltantes en otra pestaña sigue bloqueando
  w = abrir(); await wait(300);
  const alertas3 = []; w.alert = m => alertas3.push(String(m));
  $('#cli-nombre').value = 'Cliente Prueba'; $('#cli-tel').value = '6144567890'; $('#v-marca').value = 'Nissan'; $('#v-modelo').value = 'Sentra'; $('#v-anio').value = '2022'; $('#v-cil').value = '4';
  { const o = $('#cli-origen'); if (o && o.options.length > 1) o.selectedIndex = 1; } $('#asesor').value = 'XEN';
  { const it = poner('frenos', 'Balatas delanteras', 'costo', '200'); }
  tab(w, 'libre');
  w.copiar();
  ok('C38 al copiar desde Libre con faltante en Frenos: avisa, y la pestaña Frenos queda marcada', alertas3.length === 1 && /Balatas delanteras/.test(alertas3[0]) && tabsMarcadas().join() === 'frenos', { alertas3, tabs: tabsMarcadas() });

  console.log('\n— D. "Mismo proveedor para todas las piezas"');
  w = abrir(); await wait(300);
  tab(w, 'suspension');
  cambiar(w, filaDe(w, 'Rótula').querySelector('select.prov-sel'), 'Dar');
  const selT = $('#prov-todos-sel');
  ok('D1 existe el selector arriba de las piezas', !!selT && /Mismo proveedor/i.test($('#prov-todos').textContent));
  cambiar(w, selT, 'Govi');
  ok('D2 llena las piezas que estaban vacías', ['Amortiguador delantero', 'Amortiguador trasero', 'Horquilla', 'Barra estabilizadora'].every(c => itemDe(w, c).proveedor === 'Govi'));
  ok('D3 NO pisa la que ya tenía proveedor', itemDe(w, 'Rótula').proveedor === 'Dar', itemDe(w, 'Rótula').proveedor);
  ok('D4 la mano de obra no recibe proveedor', !itemDe(w, 'Mano de obra rótula').proveedor);
  ok('D5 los renglones muestran el proveedor puesto', filaDe(w, 'Horquilla').querySelector('select.prov-sel').value === 'Govi');
  tab(w, 'frenos');
  ok('D6 las piezas de OTRO servicio no se tocan', !itemDe(w, 'Balatas delanteras').proveedor);
  ok('D7 el selector de Frenos ofrece la lista de Frenos', opts($('#prov-todos-sel')).indexOf('Balatas y Embragues') >= 0);
  ok('D8 el selector vuelve a quedar en blanco', $('#prov-todos-sel').value === '');

  console.log('\n— E. Revisar nombres nuevos (anti-variantes)');
  const ev = (t) => w.provEvaluar(t);
  ok('E1 "autozone" = AutoZone existente', ev('autozone').estado === 'existe' && ev('autozone').nombre === 'AutoZone');
  ok('E2 "AZ" = AutoZone existente', ev('AZ').estado === 'existe' && ev('AZ').nombre === 'AutoZone');
  ok('E3 "  Mercado   LIBRE " = Mercado Libre existente', ev('  Mercado   LIBRE ').nombre === 'Mercado Libre');
  ok('E4 "Octávio Vazquez" (acentos) = Octavio Vázquez', ev('Octávio Vazquez').nombre === 'Octavio Vázquez');
  ok('E5 "Govii" se parece a Govi → pregunta', ev('Govii').estado === 'parecido' && ev('Govii').sugerencia === 'Govi');
  ok('E6 "Balatas Embragues" se parece a Balatas y Embragues', ev('Balatas Embragues').estado === 'parecido');
  ok('E7 "Autozon" cae en AutoZone (ya conocido)', ev('Autozon').nombre === 'AutoZone');
  ok('E8 con números se rechaza (ej. "AutoZone SL10246")', ev('AutoZone SL10246').estado === 'invalido');
  ok('E9 solo números se rechaza', ev('452').estado === 'invalido');
  ok('E10 muy corto se rechaza', ev('ab').estado === 'invalido');
  ok('E11 símbolos raros se rechazan', ev('Refac@#$').estado === 'invalido');
  ok('E12 vacío se rechaza', ev('   ').estado === 'invalido');
  ok('E13 nombre nuevo y distinto se acepta con formato bonito', ev('refaccionaria pepe').estado === 'ok' && ev('refaccionaria pepe').nombre === 'Refaccionaria Pepe');
  ok('E13b "caasa" = CAASA existente (se queda en mayúsculas)', ev('caasa').estado === 'existe' && ev('caasa').nombre === 'CAASA');
  ok('E14 "REFACCIONES DEL NORTE" queda "Refacciones del Norte"', ev('REFACCIONES DEL NORTE').nombre === 'Refacciones del Norte');

  console.log('\n— F. "Otro…" en un renglón');
  w = abrir(); await wait(300);
  tab(w, 'suspension');
  const llamadas = [];
  w.provConectar({ provAgregar: (id, tipo, nombre, listas, por) => { llamadas.push({ id, tipo, nombre, por, listas }); return Promise.resolve(); }, provEscuchar: () => () => {}, provReemplazar: () => Promise.resolve() }, { correo: 'ana@x.com', rol: 'usuario' });
  let selF = filaDe(w, 'Rótula').querySelector('select.prov-sel');
  cambiar(w, selF, '__otro__');
  ok('F1 "Otro…" abre la ventanita', !!$('#prov-modal') && !!$('#prov-modal-inp'));
  $('#prov-modal-inp').value = 'Refaccionaria Pepe'; $('#prov-modal-ok').click(); await wait(20);
  ok('F2 la ventanita se cierra y el renglón queda con el proveedor nuevo', !$('#prov-modal') && itemDe(w, 'Rótula').proveedor === 'Refaccionaria Pepe', itemDe(w, 'Rótula').proveedor);
  ok('F3 el proveedor nuevo ya está en la lista de Suspensión', w.PROV_LISTAS.suspension.indexOf('Refaccionaria Pepe') >= 0);
  ok('F4 y aparece en los demás renglones', opts(filaDe(w, 'Horquilla').querySelector('select.prov-sel')).indexOf('Refaccionaria Pepe') >= 0);
  ok('F5 se mandó a guardar en la lista compartida (documento de prueba en dev)', llamadas.length === 1 && llamadas[0].tipo === 'suspension' && llamadas[0].nombre === 'Refaccionaria Pepe' && llamadas[0].id === 'listas_prueba' && llamadas[0].por === 'ana@x.com', llamadas);
  ok('F6 NO se agregó a la lista de Frenos', w.PROV_LISTAS.frenos.indexOf('Refaccionaria Pepe') < 0);
  // variante: "autozone" → usa el existente, no crea otro
  selF = filaDe(w, 'Horquilla').querySelector('select.prov-sel'); cambiar(w, selF, '__otro__');
  $('#prov-modal-inp').value = 'autozone'; $('#prov-modal-ok').click(); await wait(20);
  ok('F7 escribir "autozone" usa AutoZone, no crea otro', itemDe(w, 'Horquilla').proveedor === 'AutoZone' && w.PROV_LISTAS.suspension.filter(n => n === 'AutoZone').length === 1);
  ok('F8 no mandó nada nuevo a guardar (ya existía)', llamadas.length === 1, llamadas.length);
  // parecido: pregunta
  selF = filaDe(w, 'Barra estabilizadora').querySelector('select.prov-sel'); cambiar(w, selF, '__otro__');
  $('#prov-modal-inp').value = 'Govii'; $('#prov-modal-ok').click();
  ok('F9 "Govii" pregunta si es Govi', !!$('#prov-modal') && /Govi/.test($('#prov-modal-msg').textContent) && !!$('#prov-modal-si'));
  $('#prov-modal-si').click(); await wait(20);
  ok('F10 "Sí, es Govi" usa Govi', itemDe(w, 'Barra estabilizadora').proveedor === 'Govi' && !w.PROV_LISTAS.suspension.some(n => n === 'Govii'));
  // número: rechazo y se queda abierta
  selF = filaDe(w, 'Amortiguador trasero').querySelector('select.prov-sel'); cambiar(w, selF, '__otro__');
  $('#prov-modal-inp').value = 'Zone 4452'; $('#prov-modal-ok').click();
  ok('F11 un nombre con números se rechaza y la ventanita sigue abierta', !!$('#prov-modal') && /números/.test($('#prov-modal-msg').textContent));
  $('#prov-modal-cancel').click(); await wait(20);
  ok('F12 Cancelar no cambia nada y el select vuelve a su valor', !$('#prov-modal') && !itemDe(w, 'Amortiguador trasero').proveedor && filaDe(w, 'Amortiguador trasero').querySelector('select.prov-sel').value === '');

  console.log('\n— G. "Otro…" desde el selector de todas las piezas');
  tab(w, 'frenos');
  cambiar(w, $('#prov-todos-sel'), '__otro__');
  $('#prov-modal-inp').value = 'Frenos del Norte'; $('#prov-modal-ok').click(); await wait(20);
  ok('G1 se agrega a la lista de Frenos y se aplica a todas las piezas vacías', w.PROV_LISTAS.frenos.indexOf('Frenos del Norte') >= 0 && itemDe(w, 'Balatas delanteras').proveedor === 'Frenos del Norte' && itemDe(w, 'Balatas / zapatas traseras').proveedor === 'Frenos del Norte');
  ok('G2 el rectificado no se llena (no es pieza)', !itemDe(w, 'Rectificado de discos').proveedor);

  console.log('\n— H. Lista compartida (Firebase) y pantalla de Configuración');
  w = abrir(); await wait(300);
  const guardados = [];
  const apiFalsa = { provEscuchar: (id, cb) => { guardados.push({ escucha: id }); apiFalsa._cb = cb; return () => {}; }, provAgregar: () => Promise.resolve(), provReemplazar: (id, listas, por) => { guardados.push({ id, listas: JSON.parse(JSON.stringify(listas)), por }); return Promise.resolve(); } };
  w.provConectar(apiFalsa, { correo: 'carlos.mtz@expresscarecuu.com', rol: 'superadministrador' });
  ok('H1 escucha el documento de prueba en dev', guardados[0] && guardados[0].escucha === 'listas_prueba', guardados[0]);
  apiFalsa._cb({ listas: { suspension: ['Govi', 'Nuevo Proveedor', 'Govi', ' '], frenos: ['Malpa'] } });
  tab(w, 'suspension');
  ok('H2 la lista que llega de Firebase reemplaza la base (sin repetidos ni vacíos)', JSON.stringify(w.PROV_LISTAS.suspension) === JSON.stringify(['Govi', 'Nuevo Proveedor']), w.PROV_LISTAS.suspension);
  ok('H3 un servicio que Firebase no trae conserva su lista base', JSON.stringify(w.PROV_LISTAS.aceite) === JSON.stringify(['AutoZone', 'Chavitar', 'CAASA']));
  ok('H4 los renglones muestran la lista nueva', JSON.stringify(opts(filaDe(w, 'Horquilla').querySelector('select.prov-sel'))) === JSON.stringify(['Govi', 'Nuevo Proveedor']));
  apiFalsa._cb(null);
  ok('H5 si el documento no existe aún, no rompe y deja lo que había', w.PROV_LISTAS.suspension.length === 2);
  w.provRecibir({ listas: w.provClonar ? { suspension: ['Govi', 'AutoZone', 'Dar'], frenos: ['Malpa', 'AutoZone'] } : {} });
  w.setTab('config');
  const card = $('#prov-admin');
  ok('H6 el administrador ve la sección de proveedores en Config', card.style.display !== 'none' && $$(w, '#prov-admin-lista .prov-chip').length >= 5);
  // quitar
  const chipDar = $$(w, '#prov-admin-lista button[data-a="del"]').find(b => b.getAttribute('data-k') === 'suspension' && b.getAttribute('data-n') === 'Dar');
  chipDar.click(); await wait(20);
  ok('H7 quitar un proveedor lo saca de esa lista', w.PROV_LISTAS.suspension.indexOf('Dar') < 0 && w.PROV_LISTAS.suspension.indexOf('Govi') >= 0);
  ok('H8 y guarda la lista completa', guardados.length >= 2 && guardados[guardados.length - 1].listas.suspension.indexOf('Dar') < 0 && guardados[guardados.length - 1].por === 'carlos.mtz@expresscarecuu.com');
  // corregir nombre
  const btnRen = $$(w, '#prov-admin-lista button[data-a="ren"]').find(b => b.getAttribute('data-k') === 'frenos' && b.getAttribute('data-n') === 'AutoZone');
  btnRen.click();
  ok('H9 corregir abre la ventanita con el nombre actual', $('#prov-modal-inp').value === 'AutoZone');
  $('#prov-modal-inp').value = 'Auto Zone Chihuahua'; $('#prov-modal-ok').click(); await wait(20);
  ok('H10 corregir cambia el nombre en TODAS las listas donde estaba', w.PROV_LISTAS.frenos.indexOf('Auto Zone Chihuahua') >= 0 && w.PROV_LISTAS.suspension.indexOf('AutoZone') < 0 && w.PROV_LISTAS.suspension.indexOf('Auto Zone Chihuahua') >= 0, [w.PROV_LISTAS.frenos, w.PROV_LISTAS.suspension]);
  const btnRen2 = $$(w, '#prov-admin-lista button[data-a="ren"]').find(b => b.getAttribute('data-k') === 'frenos' && b.getAttribute('data-n') === 'Malpa');
  btnRen2.click(); $('#prov-modal-inp').value = 'Govi'; $('#prov-modal-ok').click();
  ok('H11 no deja renombrar a un nombre que ya existe', !!$('#prov-modal') && /Ya existe/.test($('#prov-modal-msg').textContent));
  $('#prov-modal-cancel').click();
  // agregar desde config
  const btnAdd = $$(w, '#prov-admin-lista button[data-a="add"]').find(b => b.getAttribute('data-k') === 'rectificado');
  btnAdd.click(); $('#prov-modal-inp').value = 'Rectificadora Chihuahua'; $('#prov-modal-ok').click(); await wait(20);
  ok('H12 agregar desde Config suma a esa lista y guarda', w.PROV_LISTAS.rectificado.indexOf('Rectificadora Chihuahua') >= 0 && guardados[guardados.length - 1].listas.rectificado.indexOf('Rectificadora Chihuahua') >= 0);

  console.log('\n— I. Quién ve la pantalla de Configuración (página sin ?test=1)');
  w = abrir(''); await wait(300);
  w.provConectar(apiFalsa, { correo: 'ana@x.com', rol: 'usuario' });
  ok('I1 una asesora (rol usuario) NO ve la sección', $('#prov-admin').style.display === 'none');
  w.provConectar(apiFalsa, { correo: 'jefe@x.com', rol: 'administrador' });
  ok('I2 un administrador SÍ la ve', $('#prov-admin').style.display !== 'none');
  w.provConectar(null, null);
  ok('I3 sin sesión desaparece', $('#prov-admin').style.display === 'none');
  ok('I4 la página en dev usa el documento de prueba, no el real', w.provDocId() === 'listas_prueba');

  console.log('\n=============================================\n' + passed + ' pasaron, ' + failed + ' fallaron');
  process.exit(failed ? 1 : 0);
})();
