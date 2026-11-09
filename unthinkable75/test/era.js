global.window=globalThis;require('../src/mapdata.js');const W=require('../src/war.js');
const t0=Date.now();const st=W.newGame({side:'NATO',diff:'normal',seed:+process.argv[2]||11,era:'m'},window.U75MAP);W.startWar(st);
console.log('setup ms',Date.now()-t0,'era',st.era,W.dateStr(st.t));
const c={NATO:{},PACT:{}};st.units.forEach(u=>{c[u.side][W.UNITS[u.type].cls]=(c[u.side][W.UNITS[u.type].cls]||0)+1});console.log(JSON.stringify(c));
const bad=st.units.filter(u=>!W.UNITS[u.type]||W.UNITS[u.type].era==='75');console.log('75-era units in modern game:',bad.map(u=>u.type));
const own={NATO:0,PACT:0,NEUT:0};st.cd.forEach(d=>own[d.o]++);console.log('cities',own);
Object.keys(st.set.pause).forEach(k=>st.set.pause[k]=false);
let n=0;while(!st.ended&&W.dayOf(st)<=12){W.aiThink(st,'NATO');for(let k=0;k<8&&!st.ended;k++){W.advance(st,15);st.events.length=0}n++;if(n%24==0)console.log('day',W.dayOf(st),'will',Math.round(st.will.NATO),Math.round(st.will.PACT),'lost',st.stats.lost.NATO,st.stats.lost.PACT,'esc',st.esc)}
console.log(st.ended&&st.ended.title,Date.now()-t0,'ms');
st.units.forEach(u=>{if(!isFinite(u.x)||!isFinite(u.str))throw new Error('NaN '+u.type)});
