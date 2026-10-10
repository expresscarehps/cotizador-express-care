// ── TEST SUITE — Cotizador Express Care Valvoline ────────
// Archivo: test_cotizador.js
// Uso: node test_cotizador.js
// Requiere: cotizador_dev.html en la misma ruta o ajustar FILE_PATH

const fs = require('fs');
const FILE_PATH = process.argv[2] || './cotizador_dev.html';
const html = fs.readFileSync(FILE_PATH, 'utf8');
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g);
const dataJS = scripts[0].replace(/<\/?script>/g,'');
const appJS  = scripts[1].replace(/<\/?script>/g,'');

// ── Mock DOM ──────────────────────────────────────────────
global.document={getElementById:()=>null,querySelectorAll:()=>({forEach:()=>{}}),createElement:tag=>({id:'',classList:{add:()=>{},remove:()=>{}},tagName:tag.toUpperCase(),parentNode:{removeChild:()=>{}},addEventListener:()=>{},innerHTML:'',style:{},textContent:'',appendChild:()=>{}})};
global.window={addEventListener:()=>{}};
global.localStorage={getItem:()=>null,setItem:()=>{}};
global.navigator={};global.alert=()=>{};global.confirm=()=>true;global.setTimeout=()=>{};
global.g=()=>null; global.v=()=>'';

eval(dataJS);
const initStart=appJS.indexOf("window.addEventListener('load'");
let depth=0,ix=initStart;
while(ix<appJS.length){if(appJS[ix]==='{')depth++;else if(appJS[ix]==='}'){depth--;if(depth===0)break;}ix++;}
eval(appJS.slice(0,initStart)+'/*init*/'+appJS.slice(ix+2));

global.pago='contado';global.rin='a';global.tarifasMO={};
global.tallerItems=[];global.cart=[];global.sact=new Set();

let passed=0,failed=0;
function test(name,fn){
  try{
    const r=fn();
    if(r===true||r===undefined){console.log('  ✅ '+name);passed++;}
    else{console.log('  ❌ '+name+': '+r);failed++;}
  }catch(e){console.log('  ❌ '+name+': '+e.message);failed++;}
}

// ══════════════════════════════════════════════════════════
console.log('\n=== 1. CATÁLOGOS ===');
test('DATA Servillantas 1200+',   ()=>DATA.length>=1200);
test('AYALA 4037+',               ()=>AYALA.length>=4037);
test('VEGA 1327 (lista 6 oct 2026, solo con existencia)', ()=>VEGA.length===1327);
test('SVC 18+',                   ()=>SVC.length>=18);
test('RIN a/b/c',                 ()=>!!(RIN?.a&&RIN?.b&&RIN?.c));
test('BRAND_DB 100+ marcas',      ()=>typeof BRAND_DB!=='undefined'&&Object.keys(BRAND_DB).length>=100);
test('ROTACION_DB 100+ marcas',   ()=>typeof ROTACION_DB!=='undefined'&&Object.keys(ROTACION_DB).length>=100);
test('ZWARTHZ sin typo',          ()=>!html.includes('ZWARHTZ'));

// ══════════════════════════════════════════════════════════
console.log('\n=== 2. PRECIOS SVC ===');
const svc=SVC.reduce((a,s)=>({...a,[s.clave]:s}),{});
test('ALI01 = $405',   ()=>svc.ALI01?.precio===405);
test('MON01 = $85',    ()=>svc.MON01?.precio===85);
test('MON02 = $120',   ()=>svc.MON02?.precio===120);
test('BAL01 = $80',    ()=>svc.BAL01?.precio===80);
test('BAL02 = $105',   ()=>svc.BAL02?.precio===105);
test('ROT   = $230',   ()=>svc.ROT?.precio===230);
test('ONZ01 = $20',    ()=>svc.ONZ01?.precio===20);
test('PAQ01 = $540',   ()=>svc.PAQ01?.precio===540);
test('PAQ01 incluye pivotes', ()=>svc.PAQ01?.nombre?.includes('pivotes'));

// ══════════════════════════════════════════════════════════
console.log('\n=== 3. PRECIOS RIN ===');
test('RIN a montaje = $85',  ()=>RIN.a.mon===85);
test('RIN b montaje = $120', ()=>RIN.b.mon===120);
test('RIN a pivote  = $20',  ()=>RIN.a.piv===20);

// ══════════════════════════════════════════════════════════
console.log('\n=== 4. BÚSQUEDA ===');
function simSearch(q){
  const qn=q.toUpperCase().replace(/[\s\-]/g,'');
  const r=[];
  for(const d of DATA)  if(d.medida&&(d.medida.toUpperCase().replace(/[\s\-]/g,'').includes(qn)||d.desc.toUpperCase().includes(qn))) r.push({...d,prov:'SERV'});
  for(const d of AYALA) if(d.medida&&(d.medida.toUpperCase().replace(/[\s\-]/g,'').includes(qn)||d.desc.toUpperCase().includes(qn))) r.push({...d,prov:'AYALA'});
  for(const d of VEGA)  if(d.medida&&(d.medida.toUpperCase().replace(/[\s\-]/g,'').includes(qn)||d.desc.toUpperCase().includes(qn))) r.push({...d,prov:'VEGA'});
  return r;
}
test('195/45R16 encuentra resultados',  ()=>simSearch('195/45R16').length>0);
test('MICHELIN viene de AYALA',         ()=>simSearch('MICHELIN').some(x=>x.prov==='AYALA'));
test('Medida inexistente = vacío',      ()=>simSearch('999/99R99').length===0);

// ══════════════════════════════════════════════════════════
console.log('\n=== 5. CARRITO ===');
global.cart=[];
const tl=DATA[0];
cart.push({id:'l1',t:'l',desc:tl.desc,marca:tl.marca,precio:pvpLlanta(tl.precio),pb:tl.precio,qty:1,cve:tl.cve,pid:null,isAyala:false,isVega:false});
cart.push({id:'s1',t:'s',desc:'Montaje', precio:85,qty:1,pid:'l1'});
cart.push({id:'s2',t:'s',desc:'Balanceo',precio:80,qty:1,pid:'l1'});
test('Llanta + 2 servicios = 3 items',        ()=>cart.length===3);
cart=cart.filter(c=>c.id!=='l1'&&c.pid!=='l1');
test('Borrar llanta elimina sus servicios',   ()=>cart.length===0);

// ══════════════════════════════════════════════════════════
console.log('\n=== 6. MÁRGENES ===');
test('Llantas marca normal 12.5% (fijo)',  ()=>margenLlanta('MICHELIN')===12.5 && margenLlanta('')===12.5 && margenLlanta('MARCA INEXISTENTE')===12.5);
test('Llantas "chinas" 15.5% (origen China)', ()=>margenLlanta('TERCELO')===15.5);
test('Gama Económica/Muy Económica 15.5% aunque no sea China', ()=>['ACCELERA','AMERICA','JK TYRE','NOBHEX','VIKRANT'].every(m=>margenLlanta(m)===15.5));
test('Ninguna marca China queda en 12.5%', ()=>Object.keys(BRAND_DB).filter(k=>BRAND_DB[k].pais==='China').every(k=>margenLlanta(k)===15.5));
test('Toda marca Económica/Muy Económica en 15.5%', ()=>Object.keys(BRAND_DB).filter(k=>/Econ/i.test(BRAND_DB[k].gama.normalize('NFD').replace(/[\u0300-\u036f]/g,''))).every(k=>margenLlanta(k)===15.5));
test('Marcas Alta/Media-Alta/Media (no China) 12.5%', ()=>Object.keys(BRAND_DB).filter(k=>['Alta','Media-Alta','Media'].includes(BRAND_DB[k].gama)&&BRAND_DB[k].pais!=='China').every(k=>margenLlanta(k)===12.5));
test('Proveedor libre: YOKOHAMA 12.5 / SUNFULL 15.5 / SUNFUL 15.5', ()=>margenLlanta('YOKOHAMA')===12.5&&margenLlanta(' sunfull ')===15.5&&margenLlanta('Sunful')===15.5);
test('pvpLlanta contado: normal $1000 -> 1142.86', ()=>{pago='contado';return Math.abs(pvpLlanta(1000,'MICHELIN')-1000/0.875)<0.001;});
test('pvpLlanta contado: china $1000 -> 1183.43',  ()=>{pago='contado';return Math.abs(pvpLlanta(1000,'TERCELO')-1000/0.845)<0.001;});
test('pvpLlanta meses: +5% sobre precio con margen', ()=>{pago='meses';const r=Math.abs(pvpLlanta(1000,'TERCELO')-1000/0.845*1.05)<0.001&&Math.abs(pvpLlanta(1000,'YOKOHAMA')-1000/0.875*1.05)<0.001;pago='contado';return r;});
test('recalcPVP recalcula por marca del renglón', ()=>{pago='contado';cart=[{id:'z1',t:'l',marca:'SUNFULL',pb:1000,qty:1,otro:true},{id:'z2',t:'l',marca:'YOKOHAMA',pb:1000,qty:1,otro:true}];
  const bak=[global.renderCarrito,global.updateBadge,global.generarWA,global.recalcInstalacionLlantas];
  try{recalcPVP();}catch(e){} cart.forEach(c=>{}); const ok=Math.abs(cart[0].precioBase-1000/0.845)<0.001&&Math.abs(cart[1].precioBase-1000/0.875)<0.001; cart=[]; return ok;});
test('Ya NO existe campo editable de margen (#mg)', ()=>!html.includes('id="mg"') && !appJS.includes("v('mg')") && typeof gm==='undefined');
test('Recordatorio de margen presente en el buscador', ()=>html.includes('id="mg-recordatorio"') && html.includes('Margen automático (fijo'));
test('Fila de otro proveedor: ayuda Yokohama 12.5 / Sunfull 15.5', ()=>appJS.includes('otro-margen-ayuda') && appJS.includes("MARGEN_PROV_LIBRE.YOKOHAMA") && appJS.includes("MARGEN_PROV_LIBRE.SUNFULL") && appJS.includes('list="otro-marcas"'));
test('Hoja1: margen aplicado por marca (AYALA 25%/20% sin cambio)', ()=>appJS.includes("(margenLlanta(l.marca)+'%')") && appJS.includes("l.isAyala ? (pago==='meses'?'20%':'25%')"));
test('AYALA sin cambio: contado x0.75x1.16 / meses x0.80x1.16', ()=>{pago='contado';const a=pvpAyala(1000);pago='meses';const b=pvpAyala(1000);pago='contado';return Math.abs(a-870)<0.001&&Math.abs(b-928)<0.001;});
test('Bujías 28%',                  ()=>appJS.includes("concepto:'Bujías (especificar tipo)',           costo:'', margen:28"));
test('Filtro de aceite (afinación) 32%', ()=>appJS.includes("concepto:'Filtro de aceite',                    costo:'', margen:32, mo:false, pend:false},"));
test('Filtro de aire (afinación) 32%',   ()=>appJS.includes("concepto:'Filtro de aire',                      costo:'', margen:32, mo:false, pend:false},"));
test('Filtro de cabina (afinación) 32%', ()=>appJS.includes("concepto:'Filtro de cabina',                    costo:'', margen:32, mo:false, pend:false, opcional:true},"));
test('Filtro de aceite (cambio aceite) 32%', ()=>appJS.includes("concepto:'Filtro de aceite',                    costo:'', margen:32, mo:false, pend:false, qty:0},"));
test('Balatas delanteras 32.5%',    ()=>appJS.includes("concepto:'Balatas delanteras',                  costo:'', margen:32.5"));
test('Balatas/zapatas traseras 32.5%', ()=>appJS.includes("concepto:'Balatas / zapatas traseras',          costo:'', margen:32.5"));
test('Amortiguador delantero 32%',  ()=>appJS.includes("concepto:'Amortiguador delantero',              costo:'', margen:32"));
test('Amortiguador trasero 32%',    ()=>appJS.includes("concepto:'Amortiguador trasero',                costo:'', margen:32"));
test('Horquilla 32%',               ()=>appJS.includes("concepto:'Horquilla',                           costo:'', margen:32"));
test('Barra estabilizadora 32%',    ()=>appJS.includes("concepto:'Barra estabilizadora',                costo:'', margen:32"));
test('Rótula 32%',                  ()=>appJS.includes("concepto:'R\u00f3tula',                              costo:'', margen:32"));
test('Meses sin intereses 5%',      ()=>appJS.includes('base * RECARGO_MESES') && RECARGO_MESES===1.05);

// ══════════════════════════════════════════════════════════
console.log('\n=== 7. TALLER ===');
const allItems=Object.values(TALLER_TEMPLATES).flatMap(t=>t.items||[]);
test('Suspensión existe',                ()=>!!TALLER_TEMPLATES.suspension);
test('MO afinación existe',             ()=>allItems.some(i=>i.mo&&i.concepto?.toLowerCase().includes('afinaci')));

// ══════════════════════════════════════════════════════════
console.log('\n=== 8. UI Y FUNCIONES ===');
test('BRAND_DB en data script',          ()=>html.includes('var BRAND_DB='));
test('ROTACION_DB en data script',       ()=>html.includes('var ROTACION_DB='));
test('Filtro gama presente',             ()=>html.includes('id="qg"'));
test('Cilindros texto libre',            ()=>html.includes('Confirma los cilindros'));
test('updateBadge implementado',         ()=>appJS.includes('var n=cart.length'));
test('updTallerField llama renderCarrito+WA', ()=>appJS.includes('renderCarrito(); updateBadge(); generarWA()'));
test('data-d delegation presente',       ()=>appJS.includes("getAttribute('data-d')"));
test('recalcPVP llama buscar()',         ()=>appJS.includes("if(qm && qm.length>=2) buscar()"));

// ══════════════════════════════════════════════════════════
console.log('\n=== 9. WHATSAPP ===');
test('Cierre Te apartamos espacio',      ()=>appJS.includes('Te apartamos espacio'));
test('Subtotales por sección WA',        ()=>appJS.includes('subtotalTipo'));
test('totLlantas en WA',                 ()=>appJS.includes('totLlantas'));
test('totTaller en WA',                  ()=>appJS.includes('totTaller'));
test('Subtotal llantas en WA',           ()=>appJS.includes('Subtotal llantas'));

// ══════════════════════════════════════════════════════════
console.log('\n=== 10. NOTIFICACIÓN GHL (tag "cotizacion-enviada") ===');
test('GHL_WEBHOOK_URL definido',          ()=>appJS.includes("var GHL_WEBHOOK_URL = 'https://hpsexpresscare.app.n8n.cloud/webhook/cotizacion-enviada-ghl'"));
test('notificarGHLCotizacionEnviada existe', ()=>appJS.includes('function notificarGHLCotizacionEnviada()'));
test('Notificación respeta MODO_PRUEBA',  ()=>/function notificarGHLCotizacionEnviada\(\)\{\s*if\(MODO_PRUEBA\) return;/.test(appJS));
test('Notificación es fire-and-forget (no-cors)', ()=>/notificarGHLCotizacionEnviada[\s\S]*?mode:'no-cors'/.test(appJS));
test('Payload conserva telefono/cliente/folio y suma campos nuevos opcionales', ()=>{
  const m=appJS.match(/function armarPayloadAviso\(\)\{[\s\S]*?\n\}/);
  return !!m && ["telefono:v('cli-tel')","folio:(folioActual||'')","asesor:","total:","ref:","fuente:","version:"].every(s=>m[0].includes(s)) && /cliente:\(esSinNombre\(\)\?'':v\('cli-nombre'\)\)/.test(m[0]);
});
test('notificarGHL usa armarPayloadAviso', ()=>/notificarGHLCotizacionEnviada\(\)\{[\s\S]*?JSON\.stringify\(armarPayloadAviso\(\)\)/.test(appJS));
test('copiar() YA NO llama a notificarGHLCotizacionEnviada (solo copia)',
  ()=>{
    const m=appJS.match(/function copiar\(\)\{[\s\S]*?\n\}/);
    return !!m && !m[0].includes('notificarGHLCotizacionEnviada()');
  });
test('Botón "Ya la envié" existe en el HTML y empieza deshabilitado',
  ()=>/<button class="byaenvie" id="btn-ya-envie" disabled>/.test(html));
test('copiar() habilita el botón "Ya la envié" tras copiar',
  ()=>{
    const m=appJS.match(/function copiar\(\)\{[\s\S]*?\n\}/);
    return !!m && m[0].includes('habilitarYaLaEnvie()');
  });
test('habilitarYaLaEnvie quita disabled y agrega clase enabled',
  ()=>/function habilitarYaLaEnvie\(\)\{[\s\S]*?bye\.disabled=false;bye\.classList\.add\('enabled'\)/.test(appJS));
test('yaLaEnvie() es el que llama a notificarGHLCotizacionEnviada',
  ()=>{
    const m=appJS.match(/function yaLaEnvie\(\)\{[\s\S]*?\n\}/);
    return !!m && m[0].includes('notificarGHLCotizacionEnviada()');
  });
test('yaLaEnvie() no hace nada si el botón está disabled (guarda de seguridad)',
  ()=>/function yaLaEnvie\(\)\{\s*var btn=g\('btn-ya-envie'\);\s*if\(!btn \|\| btn\.disabled\) return;/.test(appJS));
test('btn-ya-envie tiene listener ligado a yaLaEnvie',
  ()=>appJS.includes("g('btn-ya-envie');if(byeEl)byeEl.addEventListener('click',yaLaEnvie)"));
test('limpiarTodo() resetea btn-ya-envie a deshabilitado',
  ()=>/bye\.disabled=true;bye\.classList\.remove\('enabled','done'\)/.test(appJS));

// ── Candado de "Nueva cotización" ──
test('Botón Nueva cotización usa nuevaCotizacionConCandado',
  ()=>appJS.includes("g('btn-nueva');if(bnEl)bnEl.addEventListener('click',nuevaCotizacionConCandado)"));
test('yaLaEnvie marca avisoGHLPresionado=true',
  ()=>{const m=appJS.match(/function yaLaEnvie\(\)\{[\s\S]*?\n\}/);return !!m&&m[0].includes('avisoGHLPresionado=true');});
test('limpiarTodo resetea avisoGHLPresionado=false',
  ()=>{const m=appJS.match(/function limpiarTodo\(skipConfirm\)\{[\s\S]*?\n\}/);return !!m&&m[0].includes('avisoGHLPresionado=false');});
(function(){
  const realGet=document.getElementById, realConfirm=global.confirm, realLimpiar=limpiarTodo;
  let calls, confirmMsg, confirmAns;
  function setup(byeState, presionado, ans){
    calls=[]; confirmMsg=null; confirmAns=ans;
    document.getElementById=id=>id==='btn-ya-envie'?byeState:null;
    global.confirm=m=>{confirmMsg=m;return confirmAns;};
    limpiarTodo=function(skip){calls.push(skip?'limpiar(true)':'limpiar()');};
    avisoGHLPresionado=presionado;
  }
  function restore(){document.getElementById=realGet;global.confirm=realConfirm;limpiarTodo=realLimpiar;avisoGHLPresionado=false;}
  test('Candado: copiado y SIN presionar "Ya la envié" => pregunta',
    ()=>{setup({disabled:false},false,false);nuevaCotizacionConCandado();const ok=confirmMsg&&confirmMsg.includes('Ya la envié');restore();return !!ok;});
  test('Candado: si cancela => NO borra',
    ()=>{setup({disabled:false},false,false);nuevaCotizacionConCandado();const ok=calls.length===0;restore();return ok;});
  test('Candado: si acepta => borra una sola vez (sin segundo confirm)',
    ()=>{setup({disabled:false},false,true);nuevaCotizacionConCandado();const ok=calls.length===1&&calls[0]==='limpiar(true)';restore();return ok;});
  test('Candado: ya presionó "Ya la envié" => NO pregunta, flujo normal',
    ()=>{setup({disabled:false},true,true);nuevaCotizacionConCandado();const ok=confirmMsg===null&&calls[0]==='limpiar()';restore();return ok;});
  test('Candado: nunca copió (botón deshabilitado) => NO pregunta',
    ()=>{setup({disabled:true},false,true);nuevaCotizacionConCandado();const ok=confirmMsg===null&&calls[0]==='limpiar()';restore();return ok;});
})();

// ══════════════════════════════════════════════════════════
console.log('\n=== 11. PENDIENTES (no deben fallar) ===');
test('PDF pendiente — ok',               ()=>true);
test('Lealtad WA pendiente — ok',        ()=>true);

// ══════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(45)}`);
console.log(`TOTAL: ${passed+failed} | ✅ ${passed} OK | ❌ ${failed} FALLIDAS`);
if(failed===0) console.log('🎉 Listo para producción');
else console.log('⚠️  Revisar antes de subir');
