// headless: AI vs AI on the real map.  node test/sim2.js [games] [days]
global.window = globalThis; require('../src/mapdata.js'); const W = require('../src/war.js');
const games = +process.argv[2] || 1, days = +process.argv[3] || 60;
let res = { NATO: 0, PACT: 0, draw: 0 };
for (let g = 0; g < games; g++) {
  const st = W.newGame({ side: 'NATO', diff: 'normal', seed: 100 + g }, window.U75MAP);
  W.startWar(st);
  const t0 = Date.now(); let n = 0;
  while (!st.ended && W.dayOf(st) <= days) {
    W.aiThink(st, 'NATO');   // the player side is driven by the same AI for this test
    for (let k = 0; k < 8 && !st.ended; k++) { W.advance(st, 15); st.events.length = 0; }   // 2 h
    n++;
    if (n % 24 === 0) {
      const v = W.vpShift(st), cnt = s => st.units.filter(u => u.side === s && W.UNITS[u.type].ground && !W.UNITS[u.type].heli).length;
      console.log('day', W.dayOf(st), 'NATO gnd', cnt('NATO'), 'PACT gnd', cnt('PACT'), 'vp', v.NATO.toFixed(3), v.PACT.toFixed(3), 'will', Math.round(st.will.NATO), Math.round(st.will.PACT), 'esc', st.esc, 'lost', st.stats.lost.NATO, st.stats.lost.PACT);
    }
  }
  const e = st.ended; console.log('game', g, e ? e.title + ' (day ' + e.day + ')' : 'ran ' + days + 'd', (Date.now() - t0) + 'ms');
  res[e && e.winner ? e.winner : 'draw']++;
  // invariants
  st.units.forEach(u => { if (!isFinite(u.x) || !isFinite(u.y) || !isFinite(u.str)) throw new Error('NaN unit ' + u.type); });
}
console.log(res);
