const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async()=>{ const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:400,height:300}}); p.on('pageerror',e=>console.log('PE',e.message));
await p.goto('file://'+__dirname+'/dist/index.html'); await p.waitForFunction(()=>window.App&&App.rd&&App.rd.ok);
const res=await p.evaluate(()=>{
  const out=[]; const rd=App.rd.render; const t0=performance.now(); let n=0;
  for(const id of ORDER){ try{ App.auto=false; App.setModel(id); const m=App.model; if(!isFinite(m.radius)||m.radius<=0) out.push(id+': bad radius '+m.radius);
    const list=(PROFILES[App.def.fx]?PROFILES[App.def.fx](m):[]); if(!PROFILES[App.def.fx]) out.push(id+': no profile '+App.def.fx);
    App.rd.render=()=>{};
    for(let i=0;i<list.length;i++){ App.setModel(id); const m2=App.model; const l2=PROFILES[App.def.fx](m2); App.err=''; l2[i].run(); for(let f=0;f<420;f++) App.frame(.033); if(App.err) out.push(id+' ['+l2[i].label+']: '+App.err.split('\n').slice(0,3).join(' | ')); n++; }
    App.rd.render=rd; }catch(e){ App.rd.render=rd; out.push(id+': THROW '+e.message); } }
  return {out, n, models:ORDER.length, ms:Math.round(performance.now()-t0)}; });
console.log(JSON.stringify(res,null,1)); await b.close();})();
