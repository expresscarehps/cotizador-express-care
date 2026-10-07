// Prueba de las reglas de Firestore (firestore.rules) en el emulador local. NO toca Firebase real.
// Uso: npm i firebase-tools@13 @firebase/rules-unit-testing@3 ; con un firebase.json que active el emulador de Firestore en el puerto 8085 (y Java instalado): npx firebase emulators:exec --only firestore --project demo-express-care "node test_reglas.js"
// (requiere firebase.json con emulador firestore en puerto 8085 y Java instalado)
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const SUPER='carlos.mtz@expresscarecuu.com', COMP='citas@expresscarecuu.com';
let pass=0, fail=0;
async function t(name, p, esperado){ // esperado true => debe permitir
  let ok; try { await (esperado ? assertSucceeds(p) : assertFails(p)); ok=true; } catch(e){ ok=false; console.log('   detalle:', String(e.message||e).slice(0,160)); }
  console.log((ok?'  ✅ ':'  ❌ ')+name); ok?pass++:fail++;
}
(async()=>{
  const env = await initializeTestEnvironment({ projectId:'demo-express-care', firestore:{ rules: fs.readFileSync('firestore.rules','utf8'), host:'127.0.0.1', port:8085 } });
  // datos de partida (sin reglas)
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await db.doc('usuarios/ana@expresscarecuu.com').set({correo:'ana@expresscarecuu.com',nombre:'Ana',rol:'usuario',activo:true});
    await db.doc('usuarios/baja@expresscarecuu.com').set({correo:'baja@expresscarecuu.com',nombre:'Baja',rol:'usuario',activo:false});
    await db.doc('usuarios/admin@expresscarecuu.com').set({correo:'admin@expresscarecuu.com',nombre:'Admin',rol:'administrador',activo:true});
    await db.doc('cotizaciones/c1').set({cliente:'X'});
    await db.doc('catalogo_llantas/l1').set({x:1});
  });
  const as=(email,verified=true)=>env.authenticatedContext('uid-'+email,{email,email_verified:verified}).firestore();
  const anon=env.unauthenticatedContext().firestore();
  console.log('Sin sesión');
  await t('anónimo NO lee cotizaciones', anon.doc('cotizaciones/c1').get(), false);
  console.log('Superadministrador');
  await t('super lee cotizaciones', as(SUPER).doc('cotizaciones/c1').get(), true);
  await t('super crea cotización', as(SUPER).doc('cotizaciones/n1').set({cliente:'Y'}), true);
  await t('super NO borra cotización', as(SUPER).doc('cotizaciones/c1').delete(), false);
  await t('super crea usuario', as(SUPER).doc('usuarios/nuevo@expresscarecuu.com').set({correo:'nuevo@expresscarecuu.com',nombre:'N',rol:'usuario',activo:true}), true);
  await t('super crea administrador', as(SUPER).doc('usuarios/adm2@expresscarecuu.com').set({correo:'adm2@expresscarecuu.com',nombre:'A2',rol:'administrador',activo:true}), true);
  await t('super NO crea otro superadministrador', as(SUPER).doc('usuarios/x@expresscarecuu.com').set({correo:'x@expresscarecuu.com',nombre:'X',rol:'superadministrador',activo:true}), false);
  await t('super lista usuarios', as(SUPER).collection('usuarios').get(), true);
  await t('super escribe tarifas', as(SUPER).doc('tarifas/t1').set({v:1}), true);
  await t('super NO lee catalogo_llantas desde navegador', as(SUPER).doc('catalogo_llantas/l1').get(), false);
  await t('super con correo NO verificado queda fuera', as(SUPER,false).doc('cotizaciones/c1').get(), false);
  console.log('Usuario (activo)');
  const ana=as('ana@expresscarecuu.com');
  await t('usuario lee cotizaciones', ana.doc('cotizaciones/c1').get(), true);
  await t('usuario crea cotización', ana.doc('cotizaciones/n2').set({cliente:'Z'}), true);
  await t('usuario actualiza cotización', ana.doc('cotizaciones/c1').update({estatus:'ok'}), true);
  await t('usuario NO borra cotización', ana.doc('cotizaciones/c1').delete(), false);
  await t('usuario usa folios', ana.doc('folios/f1').set({n:7}), true);
  await t('usuario lee tarifas', ana.doc('tarifas/t1').get(), true);
  await t('usuario NO escribe tarifas', ana.doc('tarifas/t1').set({v:2}), false);
  await t('usuario lee su propio perfil', ana.doc('usuarios/ana@expresscarecuu.com').get(), true);
  await t('usuario NO lee perfil de otro', ana.doc('usuarios/admin@expresscarecuu.com').get(), false);
  await t('usuario NO lista usuarios', ana.collection('usuarios').get(), false);
  await t('usuario NO se da de alta a sí mismo como admin', ana.doc('usuarios/ana@expresscarecuu.com').update({rol:'administrador'}), false);
  await t('usuario NO crea usuarios', ana.doc('usuarios/z@expresscarecuu.com').set({correo:'z@expresscarecuu.com',rol:'usuario',activo:true}), false);
  console.log('Usuario dado de baja / no registrado');
  await t('usuario inactivo NO lee cotizaciones', as('baja@expresscarecuu.com').doc('cotizaciones/c1').get(), false);
  await t('usuario inactivo SÍ lee su perfil (para avisarle)', as('baja@expresscarecuu.com').doc('usuarios/baja@expresscarecuu.com').get(), true);
  await t('correo no registrado NO lee cotizaciones', as('intruso@gmail.com').doc('cotizaciones/c1').get(), false);
  await t('correo no registrado NO se crea su propio acceso', as('intruso@gmail.com').doc('usuarios/intruso@gmail.com').set({correo:'intruso@gmail.com',rol:'usuario',activo:true}), false);
  await t('registrado pero correo sin verificar NO entra', as('ana@expresscarecuu.com',false).doc('cotizaciones/c1').get(), false);
  console.log('Administrador');
  const adm=as('admin@expresscarecuu.com');
  await t('admin lee cotizaciones', adm.doc('cotizaciones/c1').get(), true);
  await t('admin lista usuarios', adm.collection('usuarios').get(), true);
  await t('admin da de alta un usuario', adm.doc('usuarios/nuevo2@expresscarecuu.com').set({correo:'nuevo2@expresscarecuu.com',nombre:'N2',rol:'usuario',activo:true}), true);
  await t('admin desactiva a un usuario', adm.doc('usuarios/ana@expresscarecuu.com').update({activo:false}), true);
  await t('admin NO crea administradores', adm.doc('usuarios/adm3@expresscarecuu.com').set({correo:'adm3@expresscarecuu.com',nombre:'A3',rol:'administrador',activo:true}), false);
  await t('admin NO sube a un usuario a administrador', adm.doc('usuarios/nuevo2@expresscarecuu.com').update({rol:'administrador'}), false);
  await t('admin NO modifica a otro administrador', adm.doc('usuarios/adm2@expresscarecuu.com').update({activo:false}), false);
  await t('admin NO toca al superadministrador', adm.doc('usuarios/'+SUPER).set({correo:SUPER,nombre:'x',rol:'usuario',activo:false}), false);
  await t('admin NO borra usuarios', adm.doc('usuarios/nuevo2@expresscarecuu.com').delete(), false);
  await t('admin escribe tarifas', adm.doc('tarifas/t1').set({v:3}), true);
  console.log('Cuenta compartida citas@ (ya NO tiene acceso por contraseña)');
  const comp=as(COMP,false);
  await t('citas@ con contraseña NO lee cotizaciones', comp.doc('cotizaciones/c1').get(), false);
  await t('citas@ con contraseña NO escribe tarifas ni folios', comp.doc('tarifas/t1').set({v:4}), false);
  await t('citas@ con contraseña NO usa folios', comp.doc('folios/f2').set({n:8}), false);
  await t('citas@ NO lista usuarios', comp.collection('usuarios').get(), false);
  await t('citas@ NO crea usuarios', comp.doc('usuarios/q@expresscarecuu.com').set({correo:'q@expresscarecuu.com',rol:'usuario',activo:true}), false);
  console.log(`\nTOTAL: ${pass+fail} | ✅ ${pass} | ❌ ${fail}`);
  await env.cleanup(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
