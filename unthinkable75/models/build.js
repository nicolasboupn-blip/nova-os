// concatenates src/*.js (sorted) into dist/index.html using template.html
const fs=require('fs'),path=require('path');
const dir=__dirname, files=fs.readdirSync(path.join(dir,'src')).filter(f=>f.endsWith('.js')).sort();
let js=files.map(f=>'/* ---- '+f+' ---- */\n'+fs.readFileSync(path.join(dir,'src',f),'utf8')).join('\n');
let html=fs.readFileSync(path.join(dir,'template.html'),'utf8');
let css=fs.existsSync(path.join(dir,'style.css'))?fs.readFileSync(path.join(dir,'style.css'),'utf8'):'';
html=html.replace('/*CSS*/',css).replace('/*JS*/',()=>js);
fs.writeFileSync(path.join(dir,'index.html'),html);
console.log('built index.html',(html.length/1024).toFixed(0)+'KB',files.length,'files');
