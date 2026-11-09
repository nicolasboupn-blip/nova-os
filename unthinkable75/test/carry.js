// headless feature test: boarding, carriers, bail-out, merge, ambush, mines, repair, one-shot SAMs.  node test/carry.js
global.window = globalThis; require('../src/mapdata.js'); const W = require('../src/war.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const U = W.UNITS;
const st = W.newGame({ side: 'NATO', diff: 'normal', seed: 5, era: 'm' }, window.U75MAP); W.startWar(st);
Object.keys(st.set.pause).forEach(k => st.set.pause[k] = false);
const at = (lon, lat) => { const o = W.ll(lon, lat); return W.snapLand(o.x, o.y); };
const spare = (side, type, n) => st.units.filter(u => u.side === side && u.type === type)[n || 0];
const put = (u, lon, lat) => { const p = at(lon, lat); u.x = p.x; u.y = p.y; u.orders = []; u.path = null; u.bt = 0; u.str = 100; u.broken = false; return u; };

// units must exist
ok(!!U.m_boxer && !!U.r_btr && !!U.m113 && !!U.btr, 'carrier unit types defined (Boxer, BTR-82A, M113, BTR-60/70)');
ok(st.units.some(u => u.type === 'r_btr') && st.units.some(u => u.type === 'm_boxer'), 'carriers exist in the starting orders of battle');
ok(!!U.m_inf.foot && !!U.r_vdv.foot && !!U.eng.foot, 'infantry types are flagged foot');

const inf = put(spare('NATO', 'm_inf', 0), 17.0, 52.0), box = put(spare('NATO', 'm_boxer', 0), 17.1, 52.0);
// ---- boarding
let r = W.issue(st, [inf.id], { k: 'board', uid: box.id });
ok(r.ok === 1, 'board order accepted');
W.advance(st, 180);
ok(inf.cargoed === true && box.riders.indexOf(inf.id) >= 0, 'infantry boarded the carrier');
const tank = spare('NATO', 'm_leo', 0); put(tank, 17.0, 52.1);
r = W.issue(st, [tank.id], { k: 'board', uid: box.id });
ok(r.ok === 0, 'tanks cannot board');
const inf2 = put(spare('NATO', 'm_inf', 1), 17.05, 52.0);
r = W.issue(st, [inf2.id], { k: 'board', uid: box.id });
ok(r.ok === 0, 'a full carrier refuses a second unit');
// ---- riding
const x0 = box.x; r = W.issue(st, [box.id], { k: 'move', x: at(17.8, 52.0).x, y: at(17.8, 52.0).y });
W.advance(st, 120);
ok(Math.hypot(box.x - x0, 0) > 5, 'loaded carrier moves');
ok(Math.abs(inf.x - box.x) < 0.01 && Math.abs(inf.y - box.y) < 0.01, 'rider travels with the carrier');
// ---- unload
r = W.issue(st, [box.id], { k: 'unload' }); W.advance(st, 15);
ok(!inf.cargoed && box.riders.length === 0, 'unload drops the infantry');
// ---- auto-dismount under fire
W.issue(st, [inf.id], { k: 'board', uid: box.id }); put(inf, 17.0, 52.0); put(box, 17.0, 52.0); inf.orders = [{ k: 'board', uid: box.id }];
W.advance(st, 30); ok(inf.cargoed, 'boarded again');
box.bt = 60; W.advance(st, 15);
ok(!inf.cargoed && box.riders.length === 0, 'infantry dismount automatically when the carrier is engaged');
// ---- damaged carrier drops its passengers
W.issue(st, [inf.id], { k: 'board', uid: box.id }); put(inf, 17.0, 52.0); put(box, 17.0, 52.0); inf.orders = [{ k: 'board', uid: box.id }]; W.advance(st, 30);
box.str = 20; W.advance(st, 15);
ok(!inf.cargoed, 'a badly damaged carrier unloads its passengers');
// ---- bail-out when the carrier dies
let alive = 0, dead = 0;
for (let i = 0; i < 30; i++) {
  const c = put(spare('NATO', 'm_boxer', 1), 16.5, 52.0), p = put(spare('NATO', 'm_inf', 2), 16.5, 52.0);
  p.cargoed = true; p.rideOn = c.id; c.riders = [p.id];
  W.killUnit(st, c, 'PACT');
  if (p.dead || p.str <= 0) dead++; else { alive++; if (p.cargoed) fails++, console.log('FAIL survivor still cargoed'); }
  c.dead = false; c.str = 100; p.dead = false; p.str = 100; p.cargoed = false; st.stats.lost.NATO = 0;
}
ok(alive > 5 && dead > 5, 'half the passengers bail out of a destroyed carrier (' + alive + ' lived, ' + dead + ' died)');
// ---- merge
const a = put(spare('NATO', 'm_inf', 3), 16.0, 52.5), b = put(spare('NATO', 'm_inf', 4), 16.05, 52.5); a.str = 45; b.str = 50;
r = W.issue(st, [a.id], { k: 'merge', uid: b.id }); W.advance(st, 30);
ok(a.dead && b.str > 85, 'merge: units of the same type combine (target now ' + Math.round(b.str) + '%)');
r = W.issue(st, [spare('NATO', 'm_leo', 1).id], { k: 'merge', uid: spare('NATO', 'm_inf', 5).id });
ok(r.ok === 0, 'merge refuses different types');
// ---- ambush
const amb = put(spare('NATO', 'm_leo', 2), 15.0, 52.0);
W.issue(st, [amb.id], { k: 'ambush' }); W.advance(st, 45); ok(amb.hidden === true, 'ambush: unit conceals itself after a while');
W.detect(st); ok(!st.con.PACT[amb.id], 'a hidden unit is not on the enemy contact list');
const foe = put(spare('PACT', 'r_t72', 0), 15.0, 52.0); foe.x = amb.x + 3; foe.y = amb.y;
W.advance(st, 15);
ok(amb.hidden === false && amb.ambT > 0, 'ambush is sprung when the enemy comes close');
foe.str = 0; foe.dead = true;
// ---- mines
const eng = put(spare('NATO', 'eng', 0), 14.0, 52.0); W.issue(st, [eng.id], { k: 'mine' }); W.advance(st, 90);
ok(st.mines && st.mines.length >= 1 && st.mines[st.mines.length - 1].s === 'NATO', 'engineers lay a minefield');
const mf = st.mines[st.mines.length - 1], vic = put(spare('PACT', 'r_t72', 1), 14.0, 52.0);
vic.x = mf.x - 4; vic.y = mf.y; const tx = mf.x + 4, ty = mf.y; vic.orders = [{ k: 'move', x: tx, y: ty }]; vic.path = [{ x: tx, y: ty }];
const s0 = vic.str; W.advance(st, 60);
ok(vic.str < s0 && mf.rev, 'enemy moving through a minefield takes damage (' + Math.round(s0 - vic.str) + '%)');
// ---- repair
const eng2 = put(spare('NATO', 'eng', 1), 13.0, 52.0), hurt = put(spare('NATO', 'm_inf', 6), 13.0, 52.02); hurt.str = 50; const h0 = hurt.str;
W.issue(st, [eng2.id], { k: 'repair' }); W.advance(st, 120);
ok(hurt.str > h0 + 3, 'engineers repair nearby units (' + Math.round(h0) + ' -> ' + Math.round(hurt.str) + '%)');
// ---- one-shot SAMs
function samTest(side, sam, plane) {
  const bat = put(spare(side, sam, 0), 12.0, 52.0), foeS = side === 'NATO' ? 'PACT' : 'NATO', ac = spare(foeS, plane, 0);
  bat.sup = 100; bat.msl = U[sam].msl; bat.cd = 0; const p = at(12.3, 52.0);
  ac.state = 'fly'; ac.x = p.x; ac.y = p.y; ac.fuel = 9999; ac.orders = [{ k: 'cap', x: p.x, y: p.y, h: 3 }]; ac.str = 100; ac.dead = false;   // a patrol keeps it airborne
  const alive0 = st.units.includes(ac);
  W.advance(st, 3);
  if (!(ac.dead === true || ac.str <= 0)) console.log('   debug', sam, plane, 'state', ac.state, 'alive0', alive0, 'msl', bat.msl);
  return { killed: ac.dead === true || ac.str <= 0, left: bat.msl };
}
let t = samTest('NATO', 'm_pat', 'su35'); ok(t.killed && t.left === U.m_pat.msl - 1, 'Patriot kills an aircraft unit with one missile (' + t.left + ' left)');
t = samTest('PACT', 'r_s400', 'typhoon'); ok(t.killed && t.left === U.r_s400.msl - 1, 'S-400 kills an aircraft unit with one missile (' + t.left + ' left)');
t = samTest('PACT', 'r_s300', 'f16'); ok(t.killed, 'S-300 kills an aircraft unit with one missile');
const bat2 = put(spare('NATO', 'm_pat', 1), 11.0, 52.0); bat2.msl = 0; bat2.cd = 0; bat2.sup = 100; const ac2 = spare('PACT', 'su34', 0); const pp = at(11.2, 52.0);
ac2.state = 'fly'; ac2.x = pp.x; ac2.y = pp.y; ac2.fuel = 9999; ac2.orders = [{ k: 'cap', x: pp.x, y: pp.y, h: 3 }]; ac2.str = 100; ac2.dead = false; const m0 = bat2.msl; W.advance(st, 3);
ok(bat2.msl === m0, 'a battery with no missiles cannot launch');
// ---- long modern sim stays sane
const n0 = Date.now(); let n = 0;
const st2 = W.newGame({ side: 'NATO', diff: 'normal', seed: 21, era: 'm' }, window.U75MAP); W.startWar(st2);
while (!st2.ended && W.dayOf(st2) <= 5) { W.aiThink(st2, 'NATO'); for (let k = 0; k < 8 && !st2.ended; k++) { W.advance(st2, 15); st2.events.length = 0; } n++; }
st2.units.forEach(u => { if (!isFinite(u.x) || !isFinite(u.y) || !isFinite(u.str)) throw new Error('NaN unit ' + u.type); if (u.cargoed && !st2.units.some(c => c.riders && c.riders.indexOf(u.id) >= 0) && !st2.units.some(c => (c.cl && c.cl.indexOf(u.id) >= 0) || c.cargo === u.id)) throw new Error('orphan rider ' + u.type); });
console.log('modern sim: day', W.dayOf(st2), 'lost', st2.stats.lost.NATO, st2.stats.lost.PACT, (Date.now() - n0) + 'ms');
console.log(fails ? fails + ' FAILED' : 'ALL OK'); process.exit(fails ? 1 : 0);
