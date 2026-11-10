// usage: node shot.js out_prefix id1,id2,.. [az el dist t]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs=require('fs');
(async()=>{
  const [,, outp, ids, az='35', el='18', dm='1', t='0', w='640', h='420', env='dusk'] = process.argv;
  const b = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p = await b.newPage({viewport:{width:+w,height:+h}});
  p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE',m.text().slice(0,400)); });
  p.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,500)));
  await p.goto('file://'+__dirname+'/dist/index.html');
  await p.waitForFunction(()=>window.App&&App.rd&&App.rd.ok, {timeout:20000});
  await p.evaluate(e=>App.setEnv(e), env);
  for(const id of ids.split(',')){
    const url = await p.evaluate(([id,az,el,dm,t])=>App.shot(id,+az,+el,+dm,+t), [id,az,el,dm,t]);
    const err = await p.evaluate(()=>App.err||'');
    if(err) console.log('ERR in',id,err.slice(0,600));
    fs.writeFileSync(outp+'_'+id+'.png', Buffer.from(url.split(',')[1],'base64'));
  }
  await b.close();
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
