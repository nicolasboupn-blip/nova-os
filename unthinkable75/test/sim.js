// Headless balance + sanity test. Run: node unthinkable75/test/sim.js [games]
const E = require('../src/engine.js');
const N = parseInt(process.argv[2] || '400', 10);

function check(st, where) {
  const bad = (m) => { throw new Error('INVARIANT ' + m + ' @' + where + ' day ' + st.day); };
  for (const s of ['NATO', 'PACT']) {
    if (!(st.sup[s] >= 0) || !isFinite(st.sup[s])) bad('supply ' + s + '=' + st.sup[s]);
    if (!(st.will[s] >= 0 && st.will[s] <= 100)) bad('will ' + s + '=' + st.will[s]);
    for (const k in st.forces[s]) {
      const v = st.forces[s][k];
      if (!Number.isInteger(v) || v < 0) bad('force ' + k + '=' + v);
      if (!E.UNITS[k] || E.UNITS[k].s !== s) bad('unit side ' + k);
    }
    st.queue[s].forEach(q => { if (!E.UNITS[q.id] || q.n < 1) bad('queue'); });
  }
  if (!(st.front >= 0 && st.front <= 8)) bad('front ' + st.front);
  if (!(st.esc >= 0 && st.esc <= 5)) bad('esc ' + st.esc);
  if (!Number.isInteger(st.rs)) bad('rs');
  JSON.stringify(st); // must serialise
}

function play(side, diff, prep, seed, policy) {
  const st = E.newGame({ side, diff, prep, seed });
  let guard = 0;
  while (!st.ended && guard++ < 80) {
    const plan = policy ? policy(st, side) : E.aiPlan(st, side);
    E.endTurn(st, plan);
    check(st, 'turn');
  }
  if (!st.ended) throw new Error('game never ended');
  return st;
}

// -- policies for the human side
const passive = (st, side) => { const p = E.aiPlan(st, side); p.order = 'defend'; p.nuke = null; return p; };
const noNukes = (st, side) => { const p = E.aiPlan(st, side); p.nuke = null; return p; };

function summarise(label, side, diff, prep, policy) {
  const res = {}, days = [], nukes = [], escs = [];
  let w = 0, l = 0, d = 0;
  for (let i = 0; i < N; i++) {
    const st = play(side, diff, prep, 1000 + i, policy);
    res[st.ended.id] = (res[st.ended.id] || 0) + 1;
    const o = E.outcomeFor(st); if (o === 'win') w++; else if (o === 'loss') l++; else d++;
    days.push(st.ended.day); nukes.push(st.stats.nukes); escs.push(st.stats.maxEsc);
  }
  const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(label.padEnd(34), `win ${(100 * w / N).toFixed(0)}%  loss ${(100 * l / N).toFixed(0)}%  draw ${(100 * d / N).toFixed(0)}%  | avg day ${avg(days)}  avg strikes ${avg(nukes)}  avg maxEsc ${avg(escs)}`);
  console.log(' '.repeat(34), JSON.stringify(res));
}

console.log('games per row:', N);
summarise('NATO(AI) vs PACT(AI) normal prep1', 'NATO', 'normal', 1);
summarise('NATO(AI) easy prep1', 'NATO', 'easy', 1);
summarise('NATO(AI) hard prep1', 'NATO', 'hard', 1);
summarise('NATO(AI) normal prep0', 'NATO', 'normal', 0);
summarise('NATO(AI) normal prep3', 'NATO', 'normal', 3);
summarise('PACT(AI) normal', 'PACT', 'normal', 1);
summarise('PACT(AI) hard', 'PACT', 'hard', 1);
summarise('NATO no-nukes', 'NATO', 'normal', 1, noNukes);
summarise('PACT no-nukes', 'PACT', 'normal', 1, noNukes);
summarise('PACT passive (defend only)', 'PACT', 'normal', 1, passive);

// determinism + save/load roundtrip
{
  const a = E.newGame({ side: 'NATO', diff: 'normal', prep: 1, seed: 4242 });
  for (let i = 0; i < 8 && !a.ended; i++) E.endTurn(a, E.aiPlan(a, 'NATO'));
  const b = JSON.parse(JSON.stringify(a));
  while (!a.ended) E.endTurn(a, E.aiPlan(a, 'NATO'));
  while (!b.ended) E.endTurn(b, E.aiPlan(b, 'NATO'));
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('save/load roundtrip diverged');
  console.log('save/load roundtrip: identical after reload');
}
// build validation
{
  const st = E.newGame({ side: 'NATO', seed: 1 });
  if (E.queueBuild(st, 'NATO', 'chief', 1)) throw new Error('tier lock bypassed');
  if (E.queueBuild(st, 'NATO', 't55', 1)) throw new Error('enemy unit buildable');
  const s0 = st.sup.NATO;
  if (!E.queueBuild(st, 'NATO', 'leo1', 1)) throw new Error('valid build refused');
  if (st.sup.NATO !== s0 - 5) throw new Error('cost wrong');
  if (!E.cancelBuild(st, 'NATO', 0) || st.sup.NATO !== s0) throw new Error('cancel refund wrong');
  console.log('build / cancel / tier-lock checks passed');
}
console.log('ALL OK');

// ---- scripted "competent human" policies (extra balance probes, not part of invariants) ----
function smartNato(st, side) {
  const p = E.aiPlan(st, side); p.nuke = null; p.order = 'defend';
  const o = E.odds(st);
  if (st.surprise > 0 || o.ratio >= 1.15) p.order = 'attack';
  else if (o.ratio < 0.7) p.order = 'dig';
  // climb the ladder when the push has stalled
  if (st.streak.NATO >= 2 || (st.day >= 4 && o.ratio < 1.0)) {
    const ok = E.nukeOptions(st, side).filter(x => x.ok && !x.danger && x.lvl <= 3);
    if (ok.length && st.will.NATO > 20) { p.nuke = ok[ok.length - 1].id; if (p.nuke === 'l3') p.order = 'attack'; }
  }
  return p;
}
function smartPact(st, side) {
  const p = E.aiPlan(st, side); p.nuke = null;
  const o = E.odds(st);
  p.order = o.ratio >= 1.25 && st.front > 1 ? 'attack' : (st.streak.NATO >= 1 ? 'dig' : 'defend');
  if (st.front >= 6 || st.will.PACT < 40) {
    const ok = E.nukeOptions(st, side).filter(x => x.ok && !x.danger && x.lvl <= 3);
    if (ok.length) p.nuke = ok[ok.length - 1].id;
  }
  return p;
}
console.log('--- scripted competent play ---');
summarise('NATO smart (ladder when stalled)', 'NATO', 'normal', 1, smartNato);
summarise('NATO smart prep3', 'NATO', 'normal', 3, smartNato);
summarise('NATO smart hard', 'NATO', 'hard', 1, smartNato);
summarise('PACT smart', 'PACT', 'normal', 1, smartPact);
summarise('PACT smart hard', 'PACT', 'hard', 1, smartPact);
