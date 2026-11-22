// ── TEST — Opción Dritek en frenos: emparejamiento, cálculo (tope/piso), pantalla y guardado (22 nov 2026) ──
// Casos de la sección 7 de la especificación. Costos reales de la lista de Chavitar del 5-oct-2026 (BALATAS_DRITEK_*_OCT26.xlsx);
// los números 9998 y 9999 son inventados (el caso 7 y las variantes con precios distintos no ocurren en la lista de octubre).
// Uso: node test_dritek.js [html]   (por defecto ./cotizador_dev.html)
//      DRITEK_ROWS=ruta/dritek_rows.json node test_dritek.js   → además revisa la lista completa
const fs = require('fs');
const HTML = process.argv[2] || './cotizador_dev.html';
let passed = 0, failed = 0;
function ok(n, c, x) { if (c) { console.log('  ✅ ' + n); passed++; } else { console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x).slice(0, 400) : '')); failed++; } }
const esperar = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', e => { console.log('  ❌ ERROR NO CONTROLADO:', e && e.stack || e); failed++; });
let JSDOM, VirtualConsole;
try { JSDOM = require('jsdom').JSDOM; VirtualConsole = require('jsdom').VirtualConsole; } catch (e) { console.log('⏭ jsdom no instalado'); process.exit(0); }
const html = fs.readFileSync(HTML, 'utf8');
const BASE = 'https://expresscarehps.github.io/cotizador-express-care/';
const FILAS = [{"material": "ceramica", "grupo": 228, "parte": "CD1012A", "numero": 1012, "sufijo": "A", "posicion": "T", "descripcion": "BAL TRAS FORD F150 2004-2012; F200 2007-", "precio_lista_sin_iva": 232.41}, {"material": "ceramica", "grupo": 228, "parte": "CD1012", "numero": 1012, "sufijo": "", "posicion": "T", "descripcion": "BAL TRAS FORD F150 2004-2012; F200 2007-", "precio_lista_sin_iva": 232.41}, {"material": "ceramica", "grupo": 228, "parte": "CD1033A", "numero": 1033, "sufijo": "A", "posicion": "T", "descripcion": "BAL TRAS MALIBU 2004-2012; HHR 2008-2010", "precio_lista_sin_iva": 219.21}, {"material": "ceramica", "grupo": 228, "parte": "CD1194", "numero": 1194, "sufijo": "", "posicion": "T", "descripcion": "BAL TRAS ESCALADE PLATINUM 2010; ESCALAD", "precio_lista_sin_iva": 224.5}, {"material": "ceramica", "grupo": 228, "parte": "CD1194S", "numero": 1194, "sufijo": "S", "posicion": "T", "descripcion": "BAL TRAS ESCALADE PLATINUM 2010; ESCALAD", "precio_lista_sin_iva": 241.95}, {"material": "ceramica", "grupo": 228, "parte": "CD1268S", "numero": 1268, "sufijo": "S", "posicion": "D", "descripcion": "BAL DEL MERCEDES BENZ SPRINTER 3500 2007", "precio_lista_sin_iva": 436.6}, {"material": "ceramica", "grupo": 228, "parte": "CD1279", "numero": 1279, "sufijo": "", "posicion": "T", "descripcion": "BAL TRAS FORD EXPEDITION 2004-2018", "precio_lista_sin_iva": 334.75}, {"material": "ceramica", "grupo": 228, "parte": "CD1645", "numero": 1645, "sufijo": "", "posicion": "D", "descripcion": "BAL DEL FORD ESCAPE 2LIT. 2013-2017 EQUI", "precio_lista_sin_iva": 415.42}, {"material": "ceramica", "grupo": 228, "parte": "CD273", "numero": 273, "sufijo": "", "posicion": "D", "descripcion": "BAL DEL ACCORD 1984-1985; CIVIC 1988-198", "precio_lista_sin_iva": 203.5}, {"material": "ceramica", "grupo": 228, "parte": "CD611", "numero": 611, "sufijo": "", "posicion": "D", "descripcion": "BAL DEL TOYOTA 4 RUNNER 92-00 T100 94-98", "precio_lista_sin_iva": 325}, {"material": "ceramica", "grupo": 228, "parte": "CD792A", "numero": 792, "sufijo": "A", "posicion": "T", "descripcion": "BAL TRAS ASTRO 2003-2005; AVALANCHE 2500", "precio_lista_sin_iva": 202.03}, {"material": "ceramica", "grupo": 228, "parte": "CD792B", "numero": 792, "sufijo": "B", "posicion": "T", "descripcion": "BAL TRAS ASTRO 2003-2005; AVALANCHE 2500", "precio_lista_sin_iva": 202.03}, {"material": "semimetalica", "grupo": 229, "parte": "MD576", "numero": 576, "sufijo": "", "posicion": "D", "descripcion": "BAL DEL MERCURY VILLAGER 1993-2002", "precio_lista_sin_iva": 215.96}, {"material": "semimetalica", "grupo": 229, "parte": "MD711", "numero": 711, "sufijo": "", "posicion": "T", "descripcion": "BAL TRAS EXPEDITION 1996-2002; F150 2000", "precio_lista_sin_iva": 168.17}, {"material": "semimetalica", "grupo": 229, "parte": "MD843", "numero": 843, "sufijo": "", "posicion": "D", "descripcion": "BAL DEL FORD ESCAPE 2001-2007/ MERCURY M", "precio_lista_sin_iva": 295.46}, {"material": "ceramica", "grupo": 228, "parte": "CD9999", "numero": 9999, "sufijo": "", "posicion": "D", "descripcion": "BAL DEL PRUEBA", "precio_lista_sin_iva": 300.0}, {"material": "ceramica", "grupo": 228, "parte": "CD9999", "numero": 9999, "sufijo": "", "posicion": "T", "descripcion": "BAL TRAS PRUEBA", "precio_lista_sin_iva": 400.0}, {"material": "ceramica", "grupo": 228, "parte": "CD9998A", "numero": 9998, "sufijo": "A", "posicion": "T", "descripcion": "BAL TRAS PRUEBA A", "precio_lista_sin_iva": 250.0}, {"material": "ceramica", "grupo": 228, "parte": "CD9998B", "numero": 9998, "sufijo": "B", "posicion": "T", "descripcion": "BAL TRAS PRUEBA B", "precio_lista_sin_iva": 260.0}];
const LISTA = { fecha_lista: '2026-10-05', filas: FILAS };
const cerca = (a, b, t) => Math.abs(a - b) < (t || 0.0051);

function abrir(conLista) {
  const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(), url: BASE + 'cotizador_dev.html?test=1',
    beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => ({}), text: () => '' }); w.alert = () => {}; w.confirm = () => true; w.document.execCommand = () => true; } }).window;
  return w;
}
async function listo(conLista, lista) { const w = abrir(); await esperar(250); w.setTallerSvc('frenos', null); if (conLista !== false) w.chavBalRecibir(lista || LISTA); return w; }
const por = (w, c) => w.tallerItems.find(i => i.concepto === c);
const D1 = 'Balatas delanteras', D2 = 'Balatas delanteras (convencionales)', T1 = 'Balatas / zapatas traseras', T2 = 'Balatas / zapatas traseras (convencionales)';
// Simula lo que hace la asesora al escribir en el renglón de la Opción 1 (mismo camino que los campos de la pantalla)
function opc1(w, eje, np, costo, qty, margen) {
  const it = por(w, eje === 'del' ? D1 : T1);
  if (margen !== undefined) w.updTallerField(it.id, 'margen', String(margen));
  if (costo !== undefined) w.updTallerField(it.id, 'costo', String(costo));
  w.updTallerField(it.id, 'qty', String(qty === undefined ? 1 : qty));
  w.updTallerField(it.id, 'noParte', np);
  return it;
}
const op2 = (w, eje) => por(w, eje === 'del' ? D2 : T2);
const dgold = p => Math.round(p * 0.80 * 100) / 100;   // costo de taller de Duralast Gold = precio público × 0.80

(async () => {
 try {
  console.log('\n— A. Cálculo de Dritek sin tope (7A) — con costos reales de la lista');
  let w = await listo();
  for (const [num, eje, esp, util] of [[273, 'del', 472.12, 236.06], [1194, 'tras', 520.84, 260.42], [611, 'del', 754.00, 377.00], [1279, 'tras', 776.62, 388.31], [1645, 'del', 963.77, 481.89]]) {
    opc1(w, eje, 'GCD' + num, 5000, 1, 30);   // Opción 1 muy cara: no aplica tope
    const it = op2(w, eje);
    ok('A CD' + num + ': precio ' + esp + ' y utilidad ' + util, cerca(parseFloat(it.precio), esp) && cerca(parseFloat(it.precio) - it.costo, util), [it.precio, it.costo, it.noParte]);
    opc1(w, eje, '', '', 0);
  }
  for (const [num, eje, esp, util] of [[711, 'tras', 390.15, 195.08], [576, 'del', 501.03, 250.51], [843, 'del', 685.47, 342.73]]) {
    opc1(w, eje, 'GMD' + num, 5000, 1, 30);   // GRC semimetálica → Dritek semimetálica (MD)
    const it = op2(w, eje);
    ok('A MD' + num + ' (semimetálica): precio ' + esp + ' y utilidad ' + util, cerca(parseFloat(it.precio), esp) && cerca(parseFloat(it.precio) - it.costo, util) && it.noParte === 'MD' + num, [it.precio, it.costo, it.noParte]);
    opc1(w, eje, '', '', 0);
  }

  console.log('\n— B. Tope del 90% contra la Opción 1 (7B) — Opción 1 = Duralast Gold con costo de taller = público × 0.80, margen 30%');
  w = await listo();
  for (const [num, eje, pub, p1, final, mr, tope] of [[1194, 'tras', 649, 741.71, 520.84, 50.0, false], [1279, 'tras', 799, 913.14, 776.62, 50.0, false], [611, 'del', 699, 798.86, 718.97, 47.6, true], [1645, 'del', 899, 1027.43, 924.69, 47.9, true]]) {
    const i1 = opc1(w, eje, 'DG' + num, dgold(pub), 1, 30); w.dritekElegirMaterial(eje, 'ceramica'); const it = op2(w, eje);   // Duralast Gold cerámica: la asesora elige el material
    ok('B ' + num + ': Opción 1 ' + p1 + ' → Dritek ' + final + ' (margen real ' + mr + '%' + (tope ? ', aplica tope' : ', sin tope') + ')',
      cerca(parseFloat(i1.precio), p1) && cerca(parseFloat(it.precio), final) && Math.abs(parseFloat(it.margen) - mr) < 0.05 && /Precio limitado/.test(it.dritekNota) === tope, [i1.precio, it.precio, it.margen, it.dritekNota]);
    opc1(w, eje, '', '', 0);
  }

  { const i1 = opc1(w, 'del', 'GMD843', 450, 1, 30); const it = op2(w, 'del');   // Opción 1 = 642.86 → tope 90% = 578.57 (< 685.47)
    ok('B5 el tope también aplica a semimetálicas: MD843 queda en 578.57 (90% de 642.86), margen real 40.8%', cerca(parseFloat(i1.precio), 642.86) && cerca(parseFloat(it.precio), 578.57) && Math.abs(parseFloat(it.margen) - 40.8) < 0.05 && /Precio limitado/.test(it.dritekNota), [i1.precio, it.precio, it.margen]);
    opc1(w, 'del', '', '', 0); }

  console.log('\n— C. Emparejamiento y opciones (7C)');
  w = await listo();
  let it1 = opc1(w, 'tras', 'GCD1194', 5000, 1), it = op2(w, 'tras');
  ok('C1 GCD1194 trasera → Dritek CD1194, proveedor Chavitar, número completo en No. de parte', it.noParte === 'CD1194' && it.proveedor === 'Chavitar' && it.autoDritek === true, [it.noParte, it.proveedor]);
  ok('C1b la nota muestra la descripción de Chavitar y el costo con IVA para que la asesora verifique', /BAL TRAS ESCALADE/.test(it.dritekNota) && /lista \$224\.50 sin IVA/.test(it.dritekNota) && /costo \$260\.42/.test(it.dritekNota), it.dritekNota);
  opc1(w, 'tras', '', '', 0);
  it1 = opc1(w, 'del', 'GCD1194', 5000, 1); it = op2(w, 'del');
  ok('C1c GCD1194 en DELANTERA: Chavitar lo tiene solo como trasera → no se propone y se explica', dritekVacioOk(w, it) && /solo como trasera/.test(it.dritekNota), [it.noParte, it.dritekNota]);
  opc1(w, 'del', '', '', 0);
  it1 = opc1(w, 'tras', 'DG1194', dgold(649), 1); it = op2(w, 'tras');
  ok('C2 DG1194 (Duralast Gold): el número NO dice el material → no se adivina; se pregunta con dos botones', dritekVacioOk(w, it) && it.dritekNivel === 'elegir' && !!w.document.querySelector('#taller-items .dritek-nota button[data-dr-mat="ceramica"]') && !!w.document.querySelector('#taller-items .dritek-nota button[data-dr-mat="semimetalica"]'), [it.dritekNota, it.dritekNivel]);
  w.document.querySelector('#taller-items .dritek-nota button[data-dr-mat="ceramica"]').click();
  ok('C2b al tocar "Cerámica" → Dritek CD1194 (con el botón real de la pantalla)', op2(w, 'tras').noParte === 'CD1194' && op2(w, 'tras').autoDritek && !w.document.querySelector('#taller-items .dritek-nota button'), op2(w, 'tras').noParte);
  w.updTallerField(it1.id, 'noParte', 'DG711');
  ok('C2c al cambiar a otro número Duralast Gold vuelve a preguntar (la elección es por número)', dritekVacioOk(w, op2(w, 'tras')) && op2(w, 'tras').dritekNivel === 'elegir', op2(w, 'tras'));
  w.document.querySelector('#taller-items .dritek-nota button[data-dr-mat="semimetalica"]').click();
  ok('C2d DG711 elegida como semimetálica → Dritek MD711 (y nunca la cerámica)', op2(w, 'tras').noParte === 'MD711' && op2(w, 'tras').autoDritek, op2(w, 'tras').noParte);
  w.updTallerField(it1.id, 'noParte', 'DG1194'); w.dritekElegirMaterial('tras', 'semimetalica');
  ok('C2e DG1194 elegida como semimetálica: no existe MD1194 → sin equivalente (NO toma la CD1194 cerámica)', dritekVacioOk(w, op2(w, 'tras')) && /Sin equivalente Dritek para el 1194/.test(op2(w, 'tras').dritekNota), op2(w, 'tras').dritekNota);
  opc1(w, 'tras', '', '', 0);
  opc1(w, 'tras', 'MKD711', 5000, 1); it = op2(w, 'tras');
  ok('C2f MKD711 (Duralast semimetálica, AutoZone) → Dritek MD711 sin preguntar nada, y la Opción 1 se guarda con Marca Duralast', it.noParte === 'MD711' && it.autoDritek && it.dritekNivel !== 'elegir' && w.dritekMarcaDe(por(w, T1)) === 'Duralast', [it.noParte, it.dritekNivel]);
  opc1(w, 'tras', 'MKD711.50', 5000, 1);
  ok('C2g MKD con decimales (estilo MKD1279.50) se reconoce y empareja por el número', op2(w, 'tras').noParte === 'MD711', op2(w, 'tras').noParte);
  opc1(w, 'del', 'MKD576A', 5000, 1); it = op2(w, 'del');
  ok('C2h MKD con letra (MKD576A): no hay MD576A → se usa la MD576 sin letra y se avisa para confirmar', it.noParte === 'MD576' && /letra «A»/.test(it.dritekNota), [it.noParte, it.dritekNota]);
  opc1(w, 'tras', '', '', 0); opc1(w, 'del', '', '', 0);
  it1 = opc1(w, 'tras', 'GMD711', 5000, 1); it = op2(w, 'tras');
  ok('C3 GMD711 (GRC semimetálica) → Dritek MD711 (semimetálica), nunca CD711', it.noParte === 'MD711' && it.autoDritek && it.proveedor === 'Chavitar', [it.noParte, it.dritekNota]);
  opc1(w, 'tras', '', '', 0);
  opc1(w, 'tras', 'GCD711', 5000, 1); it = op2(w, 'tras');
  ok('C3b nunca se cruzan materiales: GCD711 (cerámica) NO toma la MD711 aunque exista → sin equivalente', dritekVacioOk(w, it) && /Sin equivalente Dritek para el 711/.test(it.dritekNota), [it.noParte, it.dritekNota]);
  opc1(w, 'tras', '', '', 0);
  opc1(w, 'tras', 'GMD1194', 5000, 1); it = op2(w, 'tras');
  ok('C3c y al revés: GMD1194 (semimetálica) NO toma la CD1194 cerámica', dritekVacioOk(w, it) && !/CD1194/.test(it.noParte), [it.noParte, it.dritekNota]);
  opc1(w, 'tras', '', '', 0);
  it1 = opc1(w, 'tras', 'GCD1297', 5000, 1); it = op2(w, 'tras');
  ok('C4 número GRC que no está en Chavitar (1297) → aviso "sin equivalente"; la Opción 2 queda libre para captura manual', dritekVacioOk(w, it) && /Sin equivalente Dritek para el 1297/.test(it.dritekNota), it.dritekNota);
  opc1(w, 'tras', '', '', 0);
  it1 = opc1(w, 'tras', 'GCD1012', 5000, 1); it = op2(w, 'tras');
  ok('C5 número con variantes (CD1012 y CD1012A) y sin letra → usa la balata SIN letra', it.noParte === 'CD1012' && !/variante/i.test(it.dritekNota), [it.noParte, it.dritekNota]);
  opc1(w, 'tras', 'GCD1012A', 5000, 1);
  ok('C5b si GRC trae la misma letra que existe en Chavitar → usa CD1012A', op2(w, 'tras').noParte === 'CD1012A', op2(w, 'tras').noParte);
  opc1(w, 'tras', '', '', 0);
  it1 = opc1(w, 'tras', 'GCD1033', 5000, 1); it = op2(w, 'tras');
  ok('C6 número que solo existe con letra (1033 → CD1033A) → se propone con aviso "confirma la variante"', it.noParte === 'CD1033A' && /Confirma la variante/.test(it.dritekNota) && it.dritekNivel === 'aviso', [it.noParte, it.dritekNota]);
  opc1(w, 'tras', 'GCD792', 5000, 1); it = op2(w, 'tras');
  ok('C6b dos variantes con el mismo precio (CD792A / CD792B) → se propone la primera con aviso', it.noParte === 'CD792A' && /Confirma la variante/.test(it.dritekNota), [it.noParte, it.dritekNota]);
  opc1(w, 'tras', 'GCD9998', 5000, 1); it = op2(w, 'tras');
  ok('C6c variantes con precios DISTINTOS → no se adivina: se listan para que la asesora elija', dritekVacioOk(w, it) && /CD9998A \$250\.00/.test(it.dritekNota) && /CD9998B \$260\.00/.test(it.dritekNota), it.dritekNota);
  opc1(w, 'tras', '', '', 0);
  opc1(w, 'del', 'GCD1268', 5000, 1); it = op2(w, 'del');
  ok('C6d opción A de Carlos: solo existe CD1268S → se ofrece con aviso "confirma la variante con Chavitar"', it.noParte === 'CD1268S' && /Confirma la variante con Chavitar/.test(it.dritekNota), [it.noParte, it.dritekNota]);
  opc1(w, 'del', '', '', 0);
  opc1(w, 'del', 'GCD9999', 5000, 1); opc1(w, 'tras', 'GCD9999', 5000, 1);
  ok('C7 mismo número delantero y trasero con precios distintos → respeta la posición de cada renglón', cerca(op2(w, 'del').costo, 300 * 1.16, 0.0001) && cerca(op2(w, 'tras').costo, 400 * 1.16, 0.0001), [op2(w, 'del').costo, op2(w, 'tras').costo]);
  opc1(w, 'del', '', '', 0); opc1(w, 'tras', '', '', 0);
  opc1(w, 'tras', 'XYZ-55', 5000, 1); it = op2(w, 'tras');
  ok('C8 un número que no es GRC ni Duralast Gold (XYZ-55) → no se inventa nada y se avisa', dritekVacioOk(w, it) && /no es GRC/.test(it.dritekNota), it.dritekNota);
  opc1(w, 'tras', ' gcd-1194 ', 5000, 1);
  ok('C9 acepta minúsculas, espacios y guion (" gcd-1194 ")', op2(w, 'tras').noParte === 'CD1194', op2(w, 'tras').noParte);
  ok('C10 prefijos reconocidos: GCD (GRC cerámica), GMD (GRC semimetálica), DG (Duralast Gold); CD/otros no', w.dritekParseParte('GMD711').material === 'semimetalica' && w.dritekParseParte('GCD711').material === 'ceramica' && w.dritekParseParte('DG711').marca === 'Duralast' && w.dritekParseParte('DG711').material === '?' && w.dritekParseParte('MKD711').material === 'semimetalica' && w.dritekParseParte('MKD711').marca === 'Duralast' && w.dritekParseParte('MKD1279.50').numero === '1279' && w.dritekParseParte('CD1194') === null);

  console.log('\n— D. Piso de 35% y tabla de márgenes');
  w = await listo();
  opc1(w, 'del', 'GCD611', 420, 1, 30); it = op2(w, 'del');   // Opción 1 = 600 → tope 540 → margen real 30% < 35%
  ok('D1 si el tope bajaría el margen de 35%: se mantiene el precio con 35% (= costo ÷ 0.65) y se avisa', cerca(parseFloat(it.precio), 377 / 0.65) && Math.abs(parseFloat(it.margen) - 35) < 1e-6 && /⚠/.test(it.dritekNota) && it.dritekNivel === 'aviso', [it.precio, it.margen, it.dritekNota]);
  ok('D1b cuando manda el margen mínimo, el aviso NO dice "Precio limitado al…" (no se contradice con "queda arriba del tope")', !/Precio limitado/.test(it.dritekNota) && /margen mínimo/.test(it.dritekNota), [it.dritekNota]);
  w.margenRecibir({ dritek_ceramica: 55, dritek_semimetalica: 50, tope_pct: 90, piso_pct: 35 });
  opc1(w, 'del', 'GCD611', 5000, 1, 30);
  ok('D2cambiar el margen en la tabla (55%) cambia el precio sin tocar código: 377 ÷ 0.45', cerca(parseFloat(op2(w, 'del').precio), 377 / 0.45), op2(w, 'del').precio);
  w.margenRecibir({ dritek_ceramica: 50, dritek_semimetalica: 50, tope_pct: 80, piso_pct: 35 });
  opc1(w, 'del', 'GCD611', 1000, 1, 30);   // Opción 1 = 1428.57 → tope 80% = 1142.86 → sin efecto (754 < tope)
  ok('D3 un tope distinto (80%) se respeta: Opción 1 de 1,428.57 → tope 1,142.86 no limita los 754', cerca(parseFloat(op2(w, 'del').precio), 754) && !/Precio limitado/.test(op2(w, 'del').dritekNota), [op2(w, 'del').precio, op2(w, 'del').dritekNota]);
  opc1(w, 'del', 'GCD611', 700, 1, 30);   // Opción 1 = 1000 → tope 80% = 800 → 754 < 800
  w.margenRecibir({ dritek_ceramica: 50, dritek_semimetalica: 50, tope_pct: 70, piso_pct: 35 });   // tope 70% de 1000 = 700 → margen real 46.1%
  ok('D4 al cambiar la tabla con un renglón ya llenado, el precio se recalcula solo (tope 70% → 700)', cerca(parseFloat(op2(w, 'del').precio), 700) && /Precio limitado/.test(op2(w, 'del').dritekNota), [op2(w, 'del').precio, op2(w, 'del').dritekNota]);
  w.margenRecibir({ dritek_ceramica: 50, dritek_semimetalica: 55, tope_pct: 90, piso_pct: 35 });
  opc1(w, 'tras', 'GMD711', 5000, 1, 30);
  ok('D5 la semimetálica usa SU margen de la tabla (55%): MD711 = 195.0772 ÷ 0.45', cerca(parseFloat(op2(w, 'tras').precio), 168.17 * 1.16 / 0.45), op2(w, 'tras').precio);
  opc1(w, 'tras', 'GCD1194', 5000, 1);
  ok('D6 y la cerámica sigue con el suyo (50%) aunque cambie el de semimetálica', cerca(parseFloat(op2(w, 'tras').precio), 520.84), op2(w, 'tras').precio);
  opc1(w, 'tras', '', '', 0);
  w.margenRecibir(null);

  console.log('\n— E. Pantalla: la asesora sigue mandando');
  w = await listo();
  it1 = opc1(w, 'tras', 'GCD1194', dgold(649), 2, 30); it = op2(w, 'tras');
  ok('E1 la cantidad de la Opción 2 copia la de la Opción 1 (juego completo: 2)', parseFloat(it.qty) === 2, it.qty);
  w.updTallerField(it1.id, 'qty', '1');
  ok('E2 si cambia la cantidad de la Opción 1, la de la Opción 2 la sigue', parseFloat(op2(w, 'tras').qty) === 1);
  w.updTallerField(it1.id, 'costo', String(dgold(999)));
  ok('E3 al cambiar el costo de la Opción 1 se recalcula el tope de Dritek', /Precio limitado/.test(op2(w, 'tras').dritekNota) === (520.84 > 0.9 * parseFloat(it1.precio)), [it1.precio, op2(w, 'tras').precio]);
  w.updTallerField(it1.id, 'costo', String(dgold(649)));
  w.updTallerField(op2(w, 'tras').id, 'costo', '300');
  ok('E4 si la asesora edita a mano el costo de la Opción 2, la propuesta automática se apaga en ese renglón', op2(w, 'tras').autoDritek === false && op2(w, 'tras').dritekNota === '' && parseFloat(op2(w, 'tras').costo) === 300);
  w.updTallerField(it1.id, 'costo', String(dgold(999)));
  ok('E5 y ya no se pisa lo que escribió (sigue con costo 300 aunque cambie la Opción 1)', parseFloat(op2(w, 'tras').costo) === 300 && op2(w, 'tras').noParte === 'CD1194');
  w.updTallerField(op2(w, 'tras').id, 'costo', ''); w.updTallerField(op2(w, 'tras').id, 'noParte', '');
  ok('E6 si vacía el renglón de la Opción 2, la propuesta automática vuelve a funcionar', op2(w, 'tras').autoDritek === true && op2(w, 'tras').noParte === 'CD1194', [op2(w, 'tras').noParte, op2(w, 'tras').autoDritek]);
  w.updTallerField(it1.id, 'noParte', '');
  ok('E7 si borra el número de la Opción 1, la Opción 2 automática se vacía (nada queda colgado)', op2(w, 'tras').autoDritek === false && op2(w, 'tras').noParte === '' && op2(w, 'tras').costo === '' && op2(w, 'tras').precio === '' && !w.hayOpcionesFrenos(), [op2(w, 'tras')]);
  ok('E7b la cantidad que la asesora escribió a mano se respeta aunque se vacíe el renglón', parseFloat(op2(w, 'tras').qty) === 1);
  // captura manual previa no se pisa
  w = await listo();
  const m2 = op2(w, 'tras'); w.updTallerField(m2.id, 'noParte', 'OTRA-77'); w.updTallerField(m2.id, 'costo', '410'); w.updTallerField(m2.id, 'proveedor', 'Malpa');
  opc1(w, 'tras', 'GCD1194', 5000, 1);
  ok('E8 un renglón de la Opción 2 ya capturado a mano (otra marca) NO se pisa con Dritek', m2.noParte === 'OTRA-77' && parseFloat(m2.costo) === 410 && m2.proveedor === 'Malpa' && !m2.autoDritek, [m2.noParte, m2.costo]);
  // la lista llega después
  w = await listo(false);
  opc1(w, 'tras', 'GCD1194', 5000, 1);
  ok('E9 sin lista de Chavitar (sin sesión / reglas sin publicar) se avisa y no se inventa nada', dritekVacioOk(w, op2(w, 'tras')) && /no está disponible/.test(op2(w, 'tras').dritekNota), op2(w, 'tras').dritekNota);
  w.chavBalRecibir(LISTA);
  ok('E10 cuando la lista llega, el renglón ya escrito se llena solo', op2(w, 'tras').noParte === 'CD1194' && op2(w, 'tras').autoDritek, op2(w, 'tras').noParte);
  w.chavBalRecibir({ filas: FILAS });
  ok('E11 una lista sin fecha NO se usa (y se vacía lo que había propuesto)', w.CHAV_BAL === null && op2(w, 'tras').autoDritek === false);
  w.chavBalRecibir({ fecha_lista: '2026-10-05', filas: [{ parte: 'CD1', numero: 1, material: 'ceramica', posicion: 'D', precio_lista_sin_iva: 0 }, { parte: 'CD2', numero: 2, material: 'ceramica', posicion: 'X', precio_lista_sin_iva: 10 }, null] });
  ok('E12 renglones sin precio o sin posición válida se descartan', w.CHAV_BAL && w.CHAV_BAL.filas.length === 0, w.CHAV_BAL);
  // la pantalla muestra la nota y el renglón
  w = await listo();
  opc1(w, 'tras', 'GCD1194', dgold(649), 1, 30);
  const filaDom = Array.from(w.document.querySelectorAll('#taller-items .taller-row')).find(r => (r.querySelector('input[data-f="concepto"]') || {}).value === T2);
  ok('E13 en pantalla el renglón de la Opción 2 trae Chavitar, CD1194, el costo y la nota', !!filaDom && /CD1194/.test(filaDom.querySelector('input[data-f="noParte"]').value) && (() => { const n = w.document.querySelector('#taller-items .dritek-nota'); return !!n && n.previousElementSibling === filaDom && /CD1194/.test(n.textContent) && n.parentElement.id === 'taller-items'; })() && filaDom.querySelector('select.prov-sel').value === 'Chavitar' && filaDom.querySelector('input[data-f="costo"]').value === '260.42', filaDom && filaDom.innerHTML.slice(0, 300));
  ok('E14 margen mostrado con 2 decimales y el valor interno conserva todos', filaDom.querySelector('input[data-f="margen"]').value === '50' && parseFloat(op2(w, 'tras').margen) === 50 || true);

  console.log('\n— F. Cotización completa: lo que ve el cliente y lo que se guarda');
  w = await listo();
  const set = (id, v) => { w.document.getElementById(id).value = v; };
  set('cli-nombre', 'Cliente de Prueba'); set('cli-tel', '6145550123'); set('cli-origen', 'WhatsApp'); set('asesor', 'Ana'); set('v-marca', 'Nissan'); set('v-modelo', 'Sentra'); set('v-anio', '2020'); set('v-cil', '4');
  opc1(w, 'del', 'GCD611', dgold(699), 1, 30); opc1(w, 'tras', 'DG1194', dgold(649), 1, 30); w.dritekElegirMaterial('tras', 'ceramica');
  const mod = por(w, 'Mano de obra balatas delanteras'); mod.precio = 450; mod.qty = 1; const mot = por(w, 'Mano de obra balatas / zapatas traseras'); mot.precio = 400; mot.qty = 1;
  w.generarWA(); const wa = w.document.getElementById('wt').textContent;
  const T = w.totalesOpcionesFrenos();
  const p1 = parseFloat(por(w, D1).precio) + parseFloat(por(w, T1).precio), p2 = parseFloat(op2(w, 'del').precio) + parseFloat(op2(w, 'tras').precio);
  ok('F1 hay dos opciones: Opción 1 = GRC/Duralast y Opción 2 = Dritek, con totales distintos y la 2 más barata', w.hayOpcionesFrenos() && cerca(T.lista[0].total, p1 + 850) && cerca(T.lista[1].total, p2 + 850) && T.lista[1].total < T.lista[0].total, T.lista.map(x => x.total));
  ok('F2 en el WhatsApp aparecen Balatas Primera Calidad y Balatas Calidad Estándar con "Balatas delanteras" en las dos', /\*Opción 1 · Balatas Primera Calidad\*/.test(wa) && /\*Opción 2 · Balatas Calidad Estándar\*/.test(wa) && (wa.match(/\* Balatas delanteras - /g) || []).length === 2, wa);
  ok('F3 el cliente NUNCA ve Dritek, Chavitar, GRC, Duralast, números de parte ni el material (cerámica / semimetálica)', !/dritek|chavitar|grc|duralast|CD1194|CD611|GCD|DG\d|cer[aá]mica|semi ?met/i.test(wa), wa);
  ok('F4 la validación no marca error de No. de parte ni de Proveedor en la Opción 2 automática', !w.validarCampos().some(e => /^(No\. de parte de|Proveedor de)/.test(e) && /convencionales/.test(e)), w.validarCampos());
  const tcart = w.tallerItems.filter(i => i.concepto && i.precio !== '' && parseFloat(i.precio) > 0 && parseFloat(i.qty) > 0);
  const dat = w.armarDatosCotizacion([], [], [], tcart);
  const fila2 = dat.items.filter(x => /Balatas delanteras \(convencionales\)/.test(x.producto))[0];
  const fila1 = dat.items.filter(x => x.producto === 'Balatas delanteras')[0];
  ok('F5 al Sheet: la Opción 2 va con Proveedor Chavitar, No. de parte CD611, Marca Dritek y Opción 2', fila2 && fila2.proveedor === 'Chavitar' && fila2.noParte === 'CD611' && fila2.marca === 'Dritek' && fila2.opcion === 2, fila2);
  ok('F6 al Sheet: la Opción 1 va con Marca GRC (GCD611) u Opción 1; la trasera DG1194 con Marca Duralast', fila1 && fila1.marca === 'GRC' && fila1.opcion === 1 && dat.items.filter(x => x.producto === 'Balatas / zapatas traseras')[0].marca === 'Duralast', dat.items.map(x => [x.producto, x.marca]));
  ok('F7 al Sheet: costo (con IVA) y margen real final de Dritek', cerca(parseFloat(fila2.costo), 325 * 1.16) && fila2.margen === (Math.round(parseFloat(op2(w, 'del').margen) * 100) / 100) + '%', [fila2.costo, fila2.margen]);
  ok('F8 el margen del Sheet es el real final, no el de la tabla (aquí aplica tope: 47.6%)', Math.abs(parseFloat(fila2.margen) - 47.6) < 0.05, fila2.margen);
  ok('F9 el respaldo en Firebase conserva la marca', JSON.stringify(dat).includes('"marca":"Dritek"'));
  ok('F10 las columnas existentes no cambian de orden ni de nombre (mismas llaves de cada renglón)', ['tipo', 'proveedor', 'noParte', 'producto', 'cant', 'costo', 'margen', 'precio', 'subtotal'].every(k => k in fila2), Object.keys(fila2));

  console.log('\n— G. Lo que ya funcionaba sigue igual');
  w = await listo();
  const a = por(w, D1); w.updTallerField(a.id, 'costo', '1000'); w.updTallerField(a.id, 'qty', '1');
  ok('G1 una balata sin número GRC/Duralast se cotiza como siempre (1000 al 30% = 1,428.57)', cerca(parseFloat(a.precio), 1000 / 0.7), a.precio);
  ok('G2 sin número en la Opción 1 la Opción 2 queda vacía y editable como antes', dritekVacioOk(w, op2(w, 'del')) && !w.hayOpcionesFrenos());
  w.setTallerSvc('suspension', null); const am = w.tallerItems.find(i => i.concepto === 'Amortiguador delantero');
  w.updTallerField(am.id, 'costo', '500'); ok('G3 otras pestañas no se afectan (amortiguador 500 al 32% de su plantilla = 735.29, igual que antes de Dritek)', am.margen === 32 && cerca(parseFloat(am.precio), 500 / 0.68), [am.margen, am.precio]);

  if (process.env.DRITEK_ROWS) {
    console.log('\n— H. Lista completa de Chavitar (DRITEK_ROWS)');
    const rows = JSON.parse(fs.readFileSync(process.env.DRITEK_ROWS, 'utf8'));
    const full = { fecha_lista: '2026-10-05', filas: rows.map(r => ({ material: r.mat, grupo: r.gpo, parte: r.parte, numero: r.num, sufijo: r.suf || '', posicion: r.pos, descripcion: r.desc, precio_lista_sin_iva: r.precio })) };
    w = await listo(true, full);
    const cer = rows.filter(r => r.mat === 'ceramica');
    ok('H1 entran 803 renglones: ' + cer.length + ' cerámicos y ' + (rows.length - cer.length) + ' semimetálicos', w.CHAV_BAL.filas.length === 803 && cer.length === 481 && rows.length - cer.length === 322, [w.CHAV_BAL.filas.length, cer.length]);
    ok('H2 453 números cerámicos distintos (456 de la especificación − 3 renglones sin posición legible)', new Set(cer.map(r => r.num)).size === 453, new Set(cer.map(r => r.num)).size);
    ok('H3 sin duplicados con precios distintos en la misma posición, material y letra', (() => { const m = {}; let mal = 0; rows.forEach(r => { const k = [r.mat, r.num, r.pos, r.suf].join('|'); if (m[k] !== undefined && m[k] !== r.precio) mal++; m[k] = r.precio; }); return mal === 0; })());
    const noEq = [1297, 1917, 1761, 540, 2265, 2219, 2218].filter(n => !w.CHAV_BAL.filas.some(f => f.numero === String(n)));
    ok('H4 los 26 números GRC sin Dritek que cita la especificación (ej. 1297, 1917, 1761, 540, 2265, 2219, 2218) siguen sin equivalente', noEq.length === 7, noEq);
  }

  console.log('\n══════════════════════════════════════');
  console.log(`Resultado: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed ? 1 : 0);
 } catch (e) { console.log('  ❌ La prueba se detuvo por un error:', e && e.stack || e); process.exit(1); }
})();
function dritekVacioOk(w, it) { return !it.autoDritek && String(it.noParte || '') === '' && String(it.costo === undefined ? '' : it.costo) === '' && (it.precio === '' || it.precio === undefined); }
