/* UNTHINKABLE '75 - game engine (pure logic, no DOM).
 * Turn-based operational campaign: NATO strikes east from Fulda toward Dresden, summer 1975.
 * All randomness comes from st.rs (seeded), so saves and tests are reproducible. */
(function (root) {
'use strict';

var NAME = "Unthinkable '75";
function other(s) { return s === 'NATO' ? 'PACT' : 'NATO'; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rnd(st) { // mulberry32, state lives in the save
  st.rs = (st.rs + 0x6D2B79F5) | 0;
  var t = st.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ---------- data ---------- */
var SECTORS = [
  { id: 'FUL', name: 'Fulda',    lon: 9.68,  lat: 50.55, def: 1.15, note: 'Rhoen hills, NATO staging area' },
  { id: 'EIS', name: 'Eisenach', lon: 10.32, lat: 50.98, def: 1.25, note: 'Thuringian Forest passes' },
  { id: 'GOT', name: 'Gotha',    lon: 10.70, lat: 50.95, def: 1.00, note: 'Open farmland, fast ground' },
  { id: 'ERF', name: 'Erfurt',   lon: 11.03, lat: 50.98, def: 1.15, note: 'Rail hub, city fighting' },
  { id: 'WEI', name: 'Weimar',   lon: 11.33, lat: 50.98, def: 1.20, note: 'Seat of the 8th Guards Army' },
  { id: 'JEN', name: 'Jena',     lon: 11.59, lat: 50.93, def: 1.10, note: 'Saale valley crossings' },
  { id: 'CHE', name: 'Chemnitz', lon: 12.92, lat: 50.83, def: 1.10, note: 'Industrial belt' },
  { id: 'DRE', name: 'Dresden',  lon: 13.74, lat: 51.05, def: 1.30, note: '1st Guards Tank Army. Final objective' }
];

// s side, t tier, a attack, d defense, c cost, k sprite, cls role
var UNITS = {
  // ---- NATO ----
  m60a1:  { n: 'M60A1',            s: 'NATO', t: 1, a: 5, d: 5, c: 6,  k: 'tank',    cls: 'armor' },
  leo1:   { n: 'Leopard 1A1',      s: 'NATO', t: 1, a: 5, d: 4, c: 5,  k: 'tank',    cls: 'armor' },
  m113:   { n: 'M113 mech inf',    s: 'NATO', t: 1, a: 2, d: 3, c: 3,  k: 'apc',     cls: 'inf' },
  tow:    { n: 'TOW team',         s: 'NATO', t: 1, a: 2, d: 4, c: 3,  k: 'atgm',    cls: 'at' },
  m109:   { n: 'M109 155 mm',      s: 'NATO', t: 1, a: 4, d: 1, c: 5,  k: 'arty',    cls: 'arty' },
  eng:    { n: 'Engineers (ADM)',  s: 'NATO', t: 1, a: 1, d: 2, c: 4,  k: 'eng',     cls: 'eng' },
  m60a2:  { n: 'M60A2 Starship',   s: 'NATO', t: 2, a: 6, d: 5, c: 8,  k: 'tank',    cls: 'armor' },
  leo1a3: { n: 'Leopard 1A3',      s: 'NATO', t: 2, a: 6, d: 5, c: 7,  k: 'tank',    cls: 'armor' },
  marder: { n: 'Marder IFV',       s: 'NATO', t: 2, a: 4, d: 5, c: 6,  k: 'ifv',     cls: 'inf' },
  chief:  { n: 'Chieftain',        s: 'NATO', t: 2, a: 6, d: 7, c: 9,  k: 'tank',    cls: 'armor' },
  cobra:  { n: 'AH-1 Cobra',       s: 'NATO', t: 2, a: 6, d: 2, c: 8,  k: 'heli',    cls: 'air' },
  lance:  { n: 'Lance battery',    s: 'NATO', t: 2, a: 1, d: 1, c: 10, k: 'missile', cls: 'nuke' },
  gepard: { n: 'Gepard SPAAG',     s: 'NATO', t: 3, a: 2, d: 4, c: 7,  k: 'spaa',    cls: 'aa' },
  f4:     { n: 'F-4 Phantom',      s: 'NATO', t: 3, a: 6, d: 2, c: 9,  k: 'jet',     cls: 'air' },
  train:   { n: 'Supply train',        s: 'NATO', t: 1, a: 0, d: 0, c: 5,  k: 'train',  cls: 'log',    note: 'Rail throughput up to the railhead' },
  convoy:  { n: 'Truck convoy',        s: 'NATO', t: 1, a: 0, d: 0, c: 3,  k: 'truck',  cls: 'log',    note: 'Hauls supply from railhead to the front' },
  railEng: { n: 'Railway engineers',   s: 'NATO', t: 1, a: 0, d: 1, c: 6,  k: 'rail',   cls: 'log',    note: 'Extend the railhead east (order: Rail repair)' },
  ec121:   { n: 'EC-121 Warning Star', s: 'NATO', t: 2, a: 0, d: 0, c: 8,  k: 'awacs',  cls: 'awacs',  note: 'Old piston AEW. Wider radar picture, small air bonus' },
  kc135:   { n: 'KC-135 tanker',       s: 'NATO', t: 2, a: 0, d: 0, c: 7,  k: 'tanker', cls: 'tanker', note: 'Extends how deep NATO air power can reach' },
  e3:      { n: 'E-3A Sentry (early)', s: 'NATO', t: 3, a: 0, d: 0, c: 12, k: 'awacs',  cls: 'awacs',  note: 'Alt-history: really entered service in 1977' },
  // ---- WARSAW PACT ----
  t55:    { n: 'T-55',             s: 'PACT', t: 1, a: 4, d: 4, c: 4,  k: 'tank',    cls: 'armor' },
  t62:    { n: 'T-62',             s: 'PACT', t: 1, a: 5, d: 4, c: 5,  k: 'tank',    cls: 'armor' },
  bmp1:   { n: 'BMP-1',            s: 'PACT', t: 1, a: 3, d: 3, c: 4,  k: 'ifv',     cls: 'inf' },
  btr60:  { n: 'BTR-60 inf',       s: 'PACT', t: 1, a: 2, d: 3, c: 3,  k: 'apc',     cls: 'inf' },
  shilka: { n: 'ZSU-23-4 Shilka',  s: 'PACT', t: 1, a: 2, d: 4, c: 5,  k: 'spaa',    cls: 'aa' },
  d30:    { n: 'D-30 122 mm',      s: 'PACT', t: 1, a: 3, d: 1, c: 4,  k: 'arty',    cls: 'arty' },
  frog:   { n: 'FROG-7 battery',   s: 'PACT', t: 1, a: 2, d: 1, c: 9,  k: 'missile', cls: 'nuke' },
  t64a:   { n: 'T-64A',            s: 'PACT', t: 2, a: 6, d: 6, c: 7,  k: 'tank',    cls: 'armor' },
  mi24:   { n: 'Mi-24 Hind',       s: 'PACT', t: 2, a: 6, d: 3, c: 9,  k: 'heli',    cls: 'air' },
  su17:   { n: 'Su-17 striker',    s: 'PACT', t: 2, a: 6, d: 1, c: 9,  k: 'jet',     cls: 'air' },
  scud:   { n: 'Scud-B battery',   s: 'PACT', t: 2, a: 1, d: 1, c: 12, k: 'missile', cls: 'nuke' },
  t72:    { n: 'T-72',             s: 'PACT', t: 3, a: 7, d: 6, c: 8,  k: 'tank',    cls: 'armor' },
  mig23:  { n: 'MiG-23',           s: 'PACT', t: 3, a: 5, d: 3, c: 9,  k: 'jet',     cls: 'air' },
  ptrain:  { n: 'Supply train',        s: 'PACT', t: 1, a: 0, d: 0, c: 4,  k: 'train',  cls: 'log',    note: 'Rail throughput. The Pact fights on its own rail net' },
  pconvoy: { n: 'Truck convoy',        s: 'PACT', t: 1, a: 0, d: 0, c: 3,  k: 'truck',  cls: 'log',    note: 'Hauls supply from railhead to the front' },
  prailEng:{ n: 'Railway troops',      s: 'PACT', t: 1, a: 0, d: 1, c: 5,  k: 'rail',   cls: 'log',    note: 'Repairs cut lines faster' },
  tu126:   { n: 'Tu-126 Moss AEW',     s: 'PACT', t: 2, a: 0, d: 0, c: 10, k: 'awacs',  cls: 'awacs',  note: 'Weak over land, no look-down. Small radar gain' }
};
var CLS_NAME = { armor: 'Armor', inf: 'Infantry', at: 'Anti-tank', arty: 'Artillery', eng: 'Engineers', air: 'Air', aa: 'Air defense', nuke: 'Missiles', log: 'Logistics', awacs: 'AWACS', tanker: 'Tanker' };

var ORDERS = {
  attack: { n: 'Attack',  d: 'Push into the next sector at full strength. No terrain cover for you.' },
  defend: { n: 'Hold',    d: 'Dig in on the line. Defense x1.15. Good while you rebuild.' },
  dig:    { n: 'Fortify', d: 'Full entrenchment. Defense x1.35 and stacks if repeated, but you cannot attack.' },
  recon:  { n: 'Recon',   d: 'Probe and scout. Reveals the enemy exactly for 2 turns. Defense x1.05.' }
};

var ESC_NAMES = ['Conventional', 'Alert', 'Atomic mines / release warning', 'Battlefield strike', 'Rear-area strike', 'MUTUAL RUIN'];
var DIFF = { easy: 0.85, normal: 1.0, hard: 1.2 };

/* ---------- helpers ---------- */
function total(st, side) { var f = st.forces[side], s = 0, k; for (k in f) s += f[k]; return s; }
function combatCount(st, side) {
  var f = st.forces[side], s = 0, k;
  for (k in f) { var c = UNITS[k].cls; if (c !== 'eng' && c !== 'nuke' && c !== 'log' && c !== 'awacs' && c !== 'tanker') s += f[k]; }
  return s;
}
function tierPoints(st) { return st.day + 2 * (st.wins.NATO + st.wins.PACT); }
function tier(st) { var p = tierPoints(st); return p >= 20 ? 3 : p >= 8 ? 2 : 1; }
function unitsFor(side, t) {
  var out = [], k;
  for (k in UNITS) if (UNITS[k].s === side && UNITS[k].t <= t) out.push(k);
  return out;
}
function unitEta(id) { return UNITS[id].c >= 9 ? 2 : 1; }
function dateStr(day) {
  var d = new Date(Date.UTC(1975, 6, 1) + (day - 1) * 86400000);
  var m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getUTCMonth()];
  return (d.getUTCDate() < 10 ? '0' : '') + d.getUTCDate() + ' ' + m + ' 1975';
}
function say(st, rep, text, cls) {
  st.log.push({ d: st.day, t: text, c: cls || '' });
  if (st.log.length > 90) st.log.shift();
  if (rep) rep.lines.push({ t: text, c: cls || '' });
}
function moraleMul(st, side) { return 0.85 + 0.25 * (clamp(st.will[side], 0, 100) / 100); }
function modOn(st, side, key) { var m = st.mods[side]; return m[key + 'T'] > 0 ? m[key] : 1; }

/* ---------- new game ---------- */
function newGame(o) {
  o = o || {};
  var side = o.side === 'PACT' ? 'PACT' : 'NATO';
  var diff = DIFF[o.diff] ? o.diff : 'normal';
  var prep = side === 'NATO' ? clamp(o.prep | 0, 0, 3) : 1;
  var st = {
    v: 1, side: side, diff: diff, prep: prep,
    rs: o.seed != null ? (o.seed | 0) : ((Math.random() * 2147483647) | 0),
    day: 1, maxDay: 45, front: 1,
    forces: {
      NATO: { m60a1: 4, leo1: 3, m113: 4, tow: 2, m109: 2, eng: 1, train: 2, convoy: 3, railEng: 1 },
      PACT: { t55: 3, t62: 4, bmp1: 3, btr60: 2, shilka: 1, d30: 2, frog: 1, ptrain: 2, pconvoy: 3 }
    },
    sup: { NATO: 12 + 2 * prep, PACT: 12 },
    will: { NATO: 66, PACT: 80 },
    esc: 0,
    queue: { NATO: [], PACT: [] },
    dug: { NATO: 0, PACT: 0 },
    mods: { NATO: { a: 1, aT: 0, d: 1, dT: 0 }, PACT: { a: 1, aT: 0, d: 1, dT: 0 } },
    incomeT: { NATO: 0, PACT: 0 },
    fallout: [],
    fog: false, refugees: false,
    intel: 0, noise: 1,
    wins: { NATO: 0, PACT: 0 },
    surprise: 0, leaked: false,
    echelon: false, offer: null,
    retaliate: { NATO: 0, PACT: 0 },
    streak: { NATO: 0, PACT: 0 }, // consecutive failed attacks
    evCool: {},
    stats: { lost: { NATO: 0, PACT: 0 }, battles: 0, nukes: 0, maxEsc: 0 },
    lg: { NATO: { rail: 0, prog: 0, cutT: 0 }, PACT: { rail: 3, prog: 0, cutT: 0 } },
    flow: { NATO: 1, PACT: 1 },
    pol: { NATO: { pc: 4, coh: 75 }, PACT: { pc: 4, coh: 75 }, world: 45, med: 0 },
    log: [], ended: null, lastReport: null, tierSeen: 1
  };
  var pool = ['m60a1', 'leo1', 'm113', 'tow'];
  for (var i = 0; i < prep; i++) { var u = pool[Math.floor(rnd(st) * pool.length)]; st.forces.NATO[u]++; }
  st.leaked = rnd(st) < 0.10 + 0.15 * prep;
  if (st.leaked) {
    st.forces.PACT.t62 += 2; st.forces.PACT.bmp1 += 1; st.dug.PACT = 2;
    say(st, null, 'Soviet intelligence spotted the build-up. The 8th Guards Army is on alert and dug in.', 'warn');
  } else {
    st.surprise = 2;
    say(st, null, 'The build-up went unnoticed. The Soviets are caught half-prepared.', 'good');
  }
  say(st, null, 'Operation begins ' + dateStr(1) + '. Objective: Dresden.', '');
  st.noise = 0.75 + 0.5 * rnd(st);
  if (diff === 'hard') st.sup[other(side)] += 2;
  st.flow.NATO = flowFor(st, 'NATO'); st.flow.PACT = flowFor(st, 'PACT');
  return st;
}

/* ---------- logistics, air support, detection, politics ---------- */
function cntU(st, side, id) { return st.forces[side][id] || 0; }
function trainsOf(st, s) { return cntU(st, s, s === 'NATO' ? 'train' : 'ptrain'); }
function trucksOf(st, s) { return cntU(st, s, s === 'NATO' ? 'convoy' : 'pconvoy'); }
function railEngOf(st, s) { return cntU(st, s, s === 'NATO' ? 'railEng' : 'prailEng'); }
function incomeBase(st, s) {
  return s === 'NATO' ? 11 + Math.floor((st.front - 1) * 0.5) : Math.max(4, 9 - Math.floor((st.front - 1) * 0.5));
}
function railDist(st, s) { return s === 'NATO' ? Math.max(0, (st.front - 1) - st.lg.NATO.rail) : 2; }
function flowFor(st, s) {
  var base = incomeBase(st, s), cap = 8 + 2.5 * trainsOf(st, s);
  var need = railDist(st, s) * 3, haul = trucksOf(st, s) * 3;
  var tf = need <= 0 ? 1 : Math.min(1, haul / need);
  var cut = st.lg[s].cutT > 0 ? 0.5 : 1;
  return clamp(Math.min(1, cap / base) * (0.4 + 0.6 * tf) * cut, 0.15, 1);
}
function logView(st, s) {
  var base = incomeBase(st, s), d = railDist(st, s), fl = flowFor(st, s);
  return { base: base, cap: 8 + 2.5 * trainsOf(st, s), trains: trainsOf(st, s), trucks: trucksOf(st, s),
    engs: railEngOf(st, s), dist: d, need: d * 3, haul: trucksOf(st, s) * 3, cut: st.lg[s].cutT,
    flow: fl, rail: s === 'NATO' ? st.lg.NATO.rail : Math.min(7, st.front + 2), prog: st.lg[s].prog,
    delivered: Math.round(base * fl) };
}
function railRepair(st, s, rep) {
  if (s !== 'NATO') return false;
  var L = st.lg.NATO, engs = railEngOf(st, s);
  if (engs < 1 || st.sup.NATO < 3 || L.rail >= st.front - 1) return false;
  st.sup.NATO -= 3; L.prog += Math.min(2, engs);
  if (L.prog >= 2) {
    L.prog = 0; L.rail++;
    say(st, rep, 'Railway engineers extend the railhead to ' + SECTORS[L.rail].name + '.', 'good');
  }
  return true;
}
function awacsLevel(st, s) {
  var f = st.forces[s];
  return Math.min(1.5, (f.ec121 || 0) * 0.5 + (f.e3 || 0) * 1.0 + (f.tu126 || 0) * 0.4);
}
function tankersOf(st, s) { return cntU(st, s, 'kc135'); }
function airMult(st, s) {
  var m = 1 + 0.15 * awacsLevel(st, s), sec = clamp(st.front, 0, 7);
  if (s === 'NATO') m *= clamp(1 - 0.18 * Math.max(0, sec - (3 + 1.5 * Math.min(2, tankersOf(st, 'NATO')))), 0.45, 1);
  else m *= clamp(1 - 0.1 * Math.max(0, (7 - sec) - 5), 0.7, 1);
  return m;
}
function detect(st, s) {
  var al = awacsLevel(st, s), intel = (s === st.side && st.intel > 0) ? 1 : 0;
  return { sight: 1 + (al >= 1 ? 1 : 0) + intel, range: 2 + Math.floor(al * 2) + intel, al: al };
}
function hash01(a, b) {
  var h = (Math.imul(a + 7, 73856093) ^ Math.imul(b + 13, 19349663)) >>> 0;
  return (h % 1000) / 1000;
}
// What the player can see of the enemy: identified (inside sight), unknown contact (inside radar range, fuzzy), or hidden.
function contacts(st) {
  var me = st.side, foe = other(me), d = detect(st, me), tot = total(st, foe), i;
  var W = me === 'NATO' ? [0.5, 0.25, 0.12, 0.07, 0.04, 0.02] : [0.55, 0.3, 0.15];
  var secs = [];
  if (me === 'NATO') for (i = st.front; i <= 7; i++) secs.push(i);
  else for (i = st.front - 1; i >= 0; i--) secs.push(i);
  var w = secs.map(function (_, k) { return k < W.length ? W[k] : 0.01; });
  var sw = w.reduce(function (a, b) { return a + b; }, 0) || 1;
  var list = [], seen = 0, comp = {};
  secs.forEach(function (sec, k) {
    var share = w[k] / sw, dist = k + 1;
    var level = dist <= d.sight ? 'id' : dist <= d.range ? 'unk' : 'hid';
    var n = share * tot, nz = 0.65 + 0.7 * hash01(st.day, sec);
    var item = { sec: sec, dist: dist, level: level, share: share, units: 0 };
    if (level === 'id') {
      item.units = Math.round(n); seen += share;
      var kk; for (kk in st.forces[foe]) { var c = UNITS[kk].cls; comp[c] = (comp[c] || 0) + st.forces[foe][kk] * share; }
    } else if (level === 'unk') { item.units = Math.max(1, Math.round(n * nz)); seen += share * nz; }
    list.push(item);
  });
  var reserve = null;
  if (me === 'NATO' && !st.echelon) {
    var dd = 7 - st.front + 1;
    reserve = { sec: 7, dist: dd, units: 10, reserve: true,
      level: dd <= d.sight ? 'id' : dd <= d.range ? 'unk' : 'hid' };
  }
  return { list: list, reserve: reserve, seen: seen, sight: d.sight, range: d.range, al: d.al, comp: comp };
}

var POL = {
  NATO: {
    rally:   ['Rally the allies',        3, 'Allied cohesion +12. Keeps Bonn, Paris and London on board.'],
    press:   ['Press campaign',          2, 'Home-front will +5.'],
    world:   ['Appeal to the UN',        3, 'World opinion moves 8 points toward NATO.'],
    hotline: ['Moscow hotline',          2, '45% to step the nuclear ladder down one rung. Fails if anyone strikes this turn.']
  },
  PACT: {
    rally:   ['Pressure the satellites', 3, 'Satellite loyalty +10, costs 2 home cohesion.'],
    press:   ['State propaganda',        2, 'Pact cohesion +5.'],
    world:   ['Blame campaign',          3, 'World opinion moves 8 points toward the Pact and NATO will -3.'],
    hotline: ['Kremlin hotline',         2, '45% to step the nuclear ladder down one rung. Fails if anyone strikes this turn.']
  }
};
function polOptions(st, side) {
  var P = st.pol[side], out = [];
  ['rally', 'press', 'world', 'hotline'].forEach(function (id) {
    var d = POL[side][id];
    var o = { id: id, name: d[0], cost: d[1], desc: d[2], ok: P.pc >= d[1], why: P.pc >= d[1] ? '' : 'Needs ' + d[1] + ' political capital' };
    if (id === 'hotline' && st.esc < 1) { o.ok = false; o.why = 'Nothing to de-escalate yet'; }
    out.push(o);
  });
  return out;
}
function applyPol(st, side, id, rep, nuked) {
  var P = st.pol[side], foe = other(side), N = side === 'NATO';
  P.pc -= POL[side][id][1];
  if (id === 'rally') {
    P.coh = clamp(P.coh + (N ? 12 : 10), 0, 100);
    if (!N) st.will.PACT -= 2;
    say(st, rep, side + ' works on its alliance. Cohesion rises.', 'good');
  } else if (id === 'press') {
    st.will[side] += 5;
    say(st, rep, side + ' launches a home-front campaign. Morale rises.', 'good');
  } else if (id === 'world') {
    if (N) st.pol.world = clamp(st.pol.world + 8, 0, 100);
    else { st.pol.world = clamp(st.pol.world - 8, 0, 100); st.will.NATO -= 3; }
    say(st, rep, side + ' works the diplomatic front. World opinion shifts.', 'good');
  } else if (id === 'hotline') {
    if (!nuked && st.esc > 0 && rnd(st) < 0.45) {
      st.esc = Math.max(0, st.esc - 1);
      say(st, rep, 'Hotline contact works: both sides step the nuclear ladder down to ' + ESC_NAMES[st.esc] + '.', 'good');
    } else say(st, rep, 'The hotline call leads nowhere.', 'warn');
  }
}
function aiPol(st, side) {
  var P = st.pol[side];
  if (P.pc < 2) return null;
  var o = polOptions(st, side).reduce(function (m, x) { m[x.id] = x.ok; return m; }, {});
  if (st.esc >= 3 && o.hotline && rnd(st) < 0.4) return 'hotline';
  if (P.coh < 55 && o.rally && rnd(st) < 0.6) return 'rally';
  if (st.will[side] < 45 && o.press && rnd(st) < 0.6) return 'press';
  if (o.world && rnd(st) < 0.2) return 'world';
  return null;
}

/* ---------- power ---------- */
function aaCount(st, side) {
  var f = st.forces[side], n = 0, k;
  for (k in f) if (UNITS[k].cls === 'aa') n += f[k];
  // fighters also contest the sky
  n += (f.mig23 || 0) * 0.7;
  return n;
}
function basePower(st, side, kind) {
  var f = st.forces[side], p = 0, k, u, v;
  var airF = Math.max(0.35, 1 - 0.12 * aaCount(st, other(side)));
  var air = airMult(st, side), awacs = awacsLevel(st, side);
  for (k in f) {
    u = UNITS[k]; v = (kind === 'a' ? u.a : u.d) * f[k];
    if (u.cls === 'air') v = st.fog ? v * (awacs >= 1 ? 0.5 : 0) : v * airF * air;
    if (kind === 'd' && u.cls === 'at') v *= 1.4;
    p += v;
  }
  return p;
}
function falloutAt(st, idx) {
  for (var i = 0; i < st.fallout.length; i++) if (st.fallout[i].sec === idx && st.fallout[i].t > 0) return true;
  return false;
}
function atkPower(st, side, secIdx) {
  var p = basePower(st, side, 'a') * moraleMul(st, side);
  if (side === 'NATO') {
    if (st.surprise === 2) p *= 1.5; else if (st.surprise === 1) p *= 1.2;
    if (st.pol.NATO.coh < 35) p *= 0.92;
  } else if (st.pol.PACT.coh < 35) p *= 0.95;
  p *= 0.75 + 0.25 * st.flow[side]; // supply readiness
  if (st.refugees) p *= 0.92;
  if (falloutAt(st, secIdx)) p *= 0.85;
  p *= modOn(st, side, 'a');
  return p;
}
function defPower(st, side, secIdx, order) {
  var p = basePower(st, side, 'd') * moraleMul(st, side) * SECTORS[clamp(secIdx, 0, 7)].def;
  if (side === 'PACT') {
    p *= 1 + 0.015 * (st.front - 1); // fighting nearer own depots
    if (st.surprise > 0) p *= 0.85;
    if (st.pol.PACT.coh < 35) p *= 0.92;
  }
  var om = order === 'dig' ? 1.35 : order === 'defend' ? 1.15 : order === 'recon' ? 1.05 : 1.0;
  p *= om;
  if (order === 'defend' || order === 'dig') p *= 1 + 0.1 * st.dug[side];
  p *= modOn(st, side, 'd');
  return p;
}

/* ---------- casualties ---------- */
var REAR = { log: 1, awacs: 1, tanker: 1 };
function hit(st, side, rate, rear) {
  var f = st.forces[side], i, lost = {};
  var eligible = function () { return Object.keys(f).filter(function (x) { return f[x] > 0 && (rear || !REAR[UNITS[x].cls]); }); };
  var tot = 0; eligible().forEach(function (x) { tot += f[x]; });
  var exp = tot * rate * (0.8 + 0.4 * rnd(st));
  var k = Math.floor(exp); if (rnd(st) < exp - k) k++;
  k = Math.min(k, tot);
  for (i = 0; i < k; i++) {
    var ids = eligible(), t2 = 0;
    ids.forEach(function (x) { t2 += f[x]; });
    var r = rnd(st) * t2, acc = 0, pick = ids[0];
    for (var j = 0; j < ids.length; j++) { acc += f[ids[j]]; if (r < acc) { pick = ids[j]; break; } }
    f[pick]--; lost[pick] = (lost[pick] || 0) + 1;
  }
  st.stats.lost[side] += k;
  st.will[side] -= 0.12 * k;
  return { n: k, lost: lost };
}
function lostText(l) {
  var parts = [], k;
  for (k in l.lost) parts.push(l.lost[k] + 'x ' + UNITS[k].n);
  return parts.length ? parts.join(', ') : 'none';
}

/* ---------- production ---------- */
function queueBuild(st, side, id, n) {
  n = n || 1;
  var u = UNITS[id];
  if (!u || u.s !== side || u.t > tier(st)) return false;
  if (st.sup[side] < u.c * n) return false;
  st.sup[side] -= u.c * n;
  st.queue[side].push({ id: id, n: n, eta: unitEta(id), fresh: true });
  return true;
}
function cancelBuild(st, side, idx) {
  var q = st.queue[side][idx];
  if (!q || !q.fresh) return false;
  st.sup[side] += UNITS[q.id].c * q.n;
  st.queue[side].splice(idx, 1);
  return true;
}

/* ---------- nuclear options ---------- */
function has(st, side, ids) {
  for (var i = 0; i < ids.length; i++) if ((st.forces[side][ids[i]] || 0) > 0) return true;
  return false;
}
function nukeOptions(st, side) {
  var N = side === 'NATO', e = st.esc;
  var cap2 = N ? has(st, side, ['eng']) : has(st, side, ['frog', 'scud']);
  var cap3 = N ? has(st, side, ['m109', 'lance']) : has(st, side, ['frog', 'scud']);
  var cap4 = N ? has(st, side, ['lance', 'f4']) : has(st, side, ['scud', 'su17']);
  var opts = [
    { id: 'alert', lvl: 1, name: 'Nuclear alert',
      desc: 'Disperse nuclear-capable units, release talks begin. Opens the ladder. Costs a little home-front confidence.',
      ok: e < 1, why: e >= 1 ? 'Already at alert' : '' },
    N ? { id: 'l2', lvl: 2, name: 'Atomic demolition mines',
      desc: 'Blow chokepoints behind the enemy line. Enemy attack x0.5 for 2 turns. Both home fronts shaken.',
      ok: e >= 1 && cap2 && e < 2, why: e < 1 ? 'Raise the alert first' : !cap2 ? 'Needs an Engineers unit' : e >= 2 ? 'Already past this step' : '' }
    : { id: 'l2', lvl: 2, name: 'Forward FROG dispersal',
      desc: 'Release warning, rocket battalions move forward. Your attack and defense x1.1 for 2 turns. Both home fronts shaken.',
      ok: e >= 1 && cap2 && e < 2, why: e < 1 ? 'Raise the alert first' : !cap2 ? 'Needs a FROG or Scud battery' : e >= 2 ? 'Already past this step' : '' },
    N ? { id: 'l3', lvl: 3, name: 'Battlefield nuclear strike',
      desc: 'Nuclear shells hit the contested sector. Enemy loses ~40% of its units. Fallout blocks the sector. Heavy home-front cost.',
      ok: e >= 2 && cap3 && e < 4, why: e < 2 ? 'Climb the ladder first (step 2)' : !cap3 ? 'Needs M109 or Lance' : '' }
    : { id: 'l3', lvl: 3, name: 'FROG / Scud strike',
      desc: 'Rockets hit the NATO assembly area. NATO loses ~35% of its units and half its supply. Fallout in the sector. Heavy home-front cost.',
      ok: e >= 2 && cap3 && e < 4, why: e < 2 ? 'Climb the ladder first (step 2)' : !cap3 ? 'Needs a FROG or Scud battery' : '' },
    { id: 'l4', lvl: 4, name: 'Rear-area strike',
      desc: 'Airbases, depots, rail hubs. Enemy supply wiped, production queue lost, income halved for 2 turns. Almost certainly triggers retaliation.',
      ok: e >= 3 && cap4 && e < 5, why: e < 3 ? 'Needs step 3 first' : !cap4 ? (N ? 'Needs Lance or F-4' : 'Needs Scud or Su-17') : '' }
  ];
  opts.forEach(function (o) { o.danger = (o.lvl === 4 && e >= 4); });
  if (N && st.pol.NATO.coh < 35) opts.forEach(function (o) { if (o.lvl >= 2) { o.ok = false; o.why = 'Allies refuse nuclear release. Rebuild cohesion first'; } });
  return opts;
}
function setEsc(st, lvl) {
  st.esc = Math.max(st.esc, lvl);
  st.stats.maxEsc = Math.max(st.stats.maxEsc, st.esc);
}
function applyNuke(st, side, id, rep) {
  var foe = other(side), N = side === 'NATO';
  var opt = nukeOptions(st, side).filter(function (o) { return o.id === id; })[0];
  if (!opt || !opt.ok) return false;
  var sec = N ? st.front : st.front - 1; sec = clamp(sec, 0, 7);
  st.stats.nukes += (opt.lvl >= 3 ? 1 : 0);
  if (id === 'alert') {
    setEsc(st, 1); st.will[side] -= 1;
    say(st, rep, side + ' raises its nuclear alert. Dispersal orders go out.', 'warn');
  } else if (id === 'l2') {
    setEsc(st, 2); st.will.NATO -= 2; st.will.PACT -= 3;
    if (N) {
      st.mods.PACT.a = 0.5; st.mods.PACT.aT = 2;
      say(st, rep, 'NATO detonates atomic demolition mines behind the Soviet line. Enemy attacks are crippled for 2 turns.', 'nuke');
    } else {
      st.mods.PACT.a = 1.1; st.mods.PACT.aT = 2; st.mods.PACT.d = 1.1; st.mods.PACT.dT = 2;
      say(st, rep, 'FROG battalions deploy forward under a Soviet release warning. Pact forces steady.', 'nuke');
    }
  } else if (id === 'l3') {
    setEsc(st, 3); st.will[side] -= 6; st.will[foe] -= 8;
    var frac = N ? 0.35 + 0.15 * rnd(st) : 0.30 + 0.12 * rnd(st);
    var l = hit(st, foe, frac);
    st.fallout.push({ sec: sec, t: 3 });
    if (N) {
      st.mods.NATO.a = 1.25; st.mods.NATO.aT = 1;
      hit(st, 'NATO', 0.07);
      say(st, rep, 'NATO nuclear shells strike ' + SECTORS[sec].name + '. Pact units lost: ' + lostText(l) + '. The sector is contaminated.', 'nuke');
    } else {
      st.sup.NATO = Math.floor(st.sup.NATO / 2);
      say(st, rep, 'Soviet rockets hit the NATO assembly area near ' + SECTORS[sec].name + '. NATO units lost: ' + lostText(l) + '. Supply halved.', 'nuke');
    }
    st.retaliate[foe] = 3;
    st.pol[side].coh = clamp(st.pol[side].coh - 8, 0, 100); st.pol.world = clamp(st.pol.world + (N ? -10 : 10), 0, 100);
  } else if (id === 'l4') {
    setEsc(st, st.esc >= 4 ? 5 : 4); st.will[side] -= 9; st.will[foe] -= 12;
    var l4 = hit(st, foe, 0.2, true);
    st.sup[foe] = 0; st.queue[foe] = []; st.incomeT[foe] = 2;
    st.fallout.push({ sec: clamp(sec + (N ? 1 : -1), 0, 7), t: 2 });
    say(st, rep, side + ' hits airbases, depots and rail hubs in the rear. Supply and production wiped. Units lost: ' + lostText(l4) + '.', 'nuke');
    st.retaliate[foe] = 4;
    st.pol[side].coh = clamp(st.pol[side].coh - 10, 0, 100); st.pol.world = clamp(st.pol.world + (N ? -12 : 12), 0, 100);
    st.lg[foe].cutT = 3; if (foe === 'NATO') st.lg.NATO.rail = Math.max(0, st.lg.NATO.rail - 2);
  }
  if (rep) rep.nuke = (rep.nuke || []).concat([{ side: side, id: id }]);
  return true;
}

/* ---------- AI ---------- */
function aiBuild(st, side) {
  var t = tier(st), ids = unitsFor(side, t), guard = 0, N = side === 'NATO';
  var trainId = N ? 'train' : 'ptrain', convId = N ? 'convoy' : 'pconvoy';
  // logistics first: keep the pipeline wide enough
  var lv = logView(st, side);
  if (lv.flow < 0.9 && !(st.queue[side].some(function (q) { return UNITS[q.id].cls === 'log' && q.fresh; }))) {
    if (lv.cap < lv.base * 1.05) queueBuild(st, side, trainId, 1);
    else if (lv.haul < lv.need) queueBuild(st, side, convId, 1);
  }
  if (N && lv.engs === 0 && lv.dist > 1 && rnd(st) < 0.3) queueBuild(st, 'NATO', 'railEng', 1);
  // eyes in the sky
  if (t >= 2 && awacsLevel(st, side) < 1 && rnd(st) < 0.3) {
    var aw = N ? (t >= 3 && rnd(st) < 0.5 ? 'e3' : 'ec121') : 'tu126';
    if (cntU(st, side, aw) < 2) queueBuild(st, side, aw, 1);
  }
  if (N && t >= 2 && tankersOf(st, 'NATO') < 2 && st.front >= 3 && rnd(st) < 0.3) queueBuild(st, 'NATO', 'kc135', 1);
  var skip = { nuke: 1, eng: 1, log: 1, awacs: 1, tanker: 1 };
  while (guard++ < 8) {
    var aff = ids.filter(function (id) { return UNITS[id].c <= st.sup[side] && !skip[UNITS[id].cls]; });
    if (!aff.length) break;
    var ws = aff.map(function (id) { var u = UNITS[id]; var v = (u.a + u.d) / u.c; return Math.pow(v, 2) * (u.cls === 'air' ? 0.7 : 1); });
    var sum = ws.reduce(function (a, b) { return a + b; }, 0), r = rnd(st) * sum, acc = 0, pick = aff[0];
    for (var i = 0; i < aff.length; i++) { acc += ws[i]; if (r < acc) { pick = aff[i]; break; } }
    queueBuild(st, side, pick, 1);
    if (N && !has(st, 'NATO', ['lance']) && t >= 2 && st.sup.NATO >= UNITS.lance.c && rnd(st) < 0.2) queueBuild(st, 'NATO', 'lance', 1);
    if (!N && !has(st, 'PACT', ['scud']) && t >= 2 && st.sup.PACT >= UNITS.scud.c && rnd(st) < 0.2) queueBuild(st, 'PACT', 'scud', 1);
  }
}
function aiPlan(st, side) {
  aiBuild(st, side);
  var foe = other(side), plan = { order: 'defend', nuke: null, ceasefire: false };
  var myA = basePower(st, side, 'a') * moraleMul(st, side);
  var foeD = basePower(st, foe, 'd') * moraleMul(st, foe);
  var r = rnd(st);
  if (side === 'NATO') {
    var tgt = SECTORS[clamp(st.front, 0, 7)].def;
    var ratio = myA * (st.surprise === 2 ? 1.5 : st.surprise === 1 ? 1.2 : 1) / Math.max(1, foeD * tgt * 1.15 * (st.surprise > 0 ? 0.85 : 1));
    if (ratio >= 1.0 && st.will.NATO > 15) plan.order = 'attack';
    else if (ratio < 0.7) plan.order = 'dig';
    else plan.order = 'defend';
    if (r < 0.1 && plan.order !== 'attack') plan.order = 'recon';
  } else {
    var secW = SECTORS[clamp(st.front - 1, 0, 7)].def;
    var ratioP = myA / Math.max(1, foeD * secW * 1.15);
    if (ratioP >= 1.25 && st.front > 1) plan.order = 'attack';
    else if (st.streak.NATO >= 2 || ratioP < 0.6) plan.order = 'dig';
    else plan.order = 'defend';
    if (r < 0.08 && plan.order === 'defend') plan.order = 'recon';
  }
  // nuclear decisions
  var opts = nukeOptions(st, side).filter(function (o) { return o.ok; });
  if (opts.length) {
    var desperate = side === 'NATO'
      ? (st.streak.NATO >= 2 || (st.day >= 4 && st.will.NATO > 20 && myA < foeD * SECTORS[clamp(st.front, 0, 7)].def * 1.15))
      : (st.front >= 6 || st.will.PACT < 35 || myA < foeD * 0.5);
    var p = 0;
    if (st.retaliate[side] > 0) p = side === 'PACT' ? 0.65 : 0.5;
    else if (desperate) p = side === 'NATO' ? 0.55 : (0.14 + (st.day > 20 ? 0.08 : 0)) * 1.4;
    if (rnd(st) < p) {
      // never climb more than one rung unless retaliating
      var maxLvl = st.retaliate[side] > 0 ? Math.max(st.retaliate[side], st.esc + 1) : st.esc + 1;
      var cand = opts.filter(function (o) { return o.lvl <= maxLvl; });
      // AI avoids pushing the world to level 5 unless retaliating
      cand = cand.filter(function (o) { return !(o.danger && st.retaliate[side] === 0); });
      if (cand.length) plan.nuke = cand[cand.length - 1].id;
    }
  }
  if (st.offer === foe) plan.ceasefire = false;
  // AI offers ceasefire when its home front is breaking
  if (st.will[side] < 30 && st.day >= 8 && rnd(st) < 0.3) plan.offer = true;
  if (side === 'NATO' && railEngOf(st, 'NATO') > 0 && st.lg.NATO.rail < st.front - 1 && st.sup.NATO >= 3) plan.rail = true;
  plan.pol = aiPol(st, side);
  return plan;
}

/* ---------- events ---------- */
var EVENTS = [
  { id: 'fog', w: 3, ok: function (st) { return true; },
    run: function (st, rep) { st.fog = true; say(st, rep, 'Fog over the Thuringian Forest. No helicopters or aircraft fly this turn.', 'warn'); } },
  { id: 'refugees', w: 3, ok: function (st) { return st.day >= 2; },
    run: function (st, rep) { st.refugees = true; say(st, rep, 'Refugees choke the roads. Attacks lose momentum this turn.', 'warn'); } },
  { id: 'reforger', w: 3, ok: function (st) { return st.day >= 5; },
    run: function (st, rep) {
      var ids = st.day >= 10 ? ['m60a1', 'leo1', 'leo1a3', 'marder'] : ['m60a1', 'leo1', 'm113'];
      var n = 2, i; for (i = 0; i < n; i++) { var u = ids[Math.floor(rnd(st) * ids.length)]; st.forces.NATO[u] = (st.forces.NATO[u] || 0) + 1; }
      say(st, rep, 'REFORGER airlift lands: two fresh NATO battalions join the line.', 'good');
    } },
  { id: 'railcut', w: 2, ok: function (st) { return st.day >= 3; },
    run: function (st, rep) {
      var s = rnd(st) < 0.6 ? 'NATO' : 'PACT', tid = s === 'NATO' ? 'train' : 'ptrain';
      st.lg[s].cutT = 2;
      var extra = '';
      if ((st.forces[s][tid] || 0) > 0 && rnd(st) < 0.3) { st.forces[s][tid]--; extra = ' A supply train is destroyed.'; }
      say(st, rep, 'Partisans and air raids cut the rail net. ' + s + ' supply flow is halved for 2 turns.' + extra, 'warn');
    } },
  { id: 'allies', w: 2, ok: function (st) { return st.day >= 3; },
    run: function (st, rep) { st.pol.NATO.coh = clamp(st.pol.NATO.coh - 12, 0, 100); say(st, rep, 'France and Belgium refuse to commit forces. Allied cohesion drops.', 'warn'); } },
  { id: 'satellites', w: 2, ok: function (st) { return st.day >= 3; },
    run: function (st, rep) { st.pol.PACT.coh = clamp(st.pol.PACT.coh - 12, 0, 100); say(st, rep, 'Polish and Czechoslovak units drag their feet. Pact cohesion drops.', 'warn'); } },
  { id: 'geneva', w: 1, ok: function (st) { return st.day >= 6; },
    run: function (st, rep) { st.pol.med = 3; st.pol.world = clamp(st.pol.world + 3, 0, 100); say(st, rep, 'Swiss diplomats offer mediation in Geneva. A ceasefire is easier to get for 3 turns.', 'good'); } },
  { id: 'unsc', w: 1, ok: function (st) { return st.day >= 4; },
    run: function (st, rep) { st.pol.world = clamp(st.pol.world - 6, 0, 100); say(st, rep, 'The UN Security Council condemns the NATO offensive. World opinion shifts.', 'warn'); } },
  { id: 'press', w: 2, ok: function (st) { return st.day >= 5; },
    run: function (st, rep) { st.will.NATO -= 4; st.pol.world = clamp(st.pol.world - 4, 0, 100); say(st, rep, 'Reporters expose civilian casualties. NATO will and world opinion drop.', 'warn'); } },
  { id: 'parliament', w: 1, ok: function (st) { return st.day >= 8 && st.will.NATO < 55; },
    run: function (st, rep) { st.will.NATO -= 5; say(st, rep, 'Parliament debates withdrawing from the war. NATO will drops.', 'warn'); } },
  { id: 'raid', w: 2, ok: function (st) { return st.day >= 3; },
    run: function (st, rep) {
      var s = rnd(st) < 0.5 ? 'NATO' : 'PACT', l = hit(st, s, 0.07, true);
      if (l.n) say(st, rep, 'Air raid on a ' + s + ' assembly area. Lost: ' + lostText(l) + '.', 'warn');
    } },
  { id: 'protest', w: 2, ok: function (st) { return st.day >= 5; },
    run: function (st, rep) {
      if (rnd(st) < 0.7) { st.will.NATO -= 5; say(st, rep, 'Mass protests in Bonn and London. NATO home-front will drops.', 'warn'); }
      else { st.will.PACT -= 4; say(st, rep, 'Unrest reported in Poland. Pact cohesion drops.', 'warn'); }
    } },
  { id: 'spy', w: 1, ok: function (st) { return st.day >= 2 && st.day <= 12; },
    run: function (st, rep) {
      st.dug.PACT = Math.min(2, st.dug.PACT + 1);
      say(st, rep, 'A spy ring passes NATO plans to Moscow. Pact units dig in deeper.', 'warn');
    } },
  { id: 'morale', w: 1, ok: function (st) { return st.day >= 6; },
    run: function (st, rep) {
      var s = st.will.NATO < st.will.PACT ? 'NATO' : 'PACT';
      st.will[s] += 4; say(st, rep, 'A well-publicized success lifts ' + s + ' morale.', 'good');
    } }
];
function rollEvents(st, rep) {
  if (rnd(st) > 0.45) return;
  var pool = EVENTS.filter(function (e) { return e.ok(st) && !(st.evCool[e.id] > 0); });
  if (!pool.length) return;
  var sum = pool.reduce(function (a, e) { return a + e.w; }, 0), r = rnd(st) * sum, acc = 0, pick = pool[0];
  for (var i = 0; i < pool.length; i++) { acc += pool[i].w; if (r < acc) { pick = pool[i]; break; } }
  pick.run(st, rep);
  st.evCool[pick.id] = 3;
}

/* ---------- combat ---------- */
function fight(st, plans, rep) {
  var oN = plans.NATO.order, oP = plans.PACT.order;
  var aN = oN === 'attack', aP = oP === 'attack';
  var b = { kind: 'quiet' };
  if (!aN && !aP) {
    var lq1 = hit(st, 'NATO', 0.03), lq2 = hit(st, 'PACT', 0.03);
    st.streak.NATO = 0; st.streak.PACT = 0;
    if (lq1.n || lq2.n) say(st, rep, 'Artillery duels along the line. NATO lost ' + lq1.n + ', Pact lost ' + lq2.n + '.', '');
    else say(st, rep, 'A quiet day on the front.', '');
    rep.battle = b; return;
  }
  st.stats.battles++;
  var j = function () { return 0.9 + 0.2 * rnd(st); };
  var att, def, secIdx, R, verdict, rates, la, ld;
  if (aN && aP) {
    var pN = atkPower(st, 'NATO', st.front) * j(), pP = atkPower(st, 'PACT', st.front - 1) * j();
    R = pN / Math.max(0.01, pP);
    b = { kind: 'meeting', ratio: R, sector: SECTORS[clamp(st.front, 0, 7)].name };
    if (R >= 1.2) { verdict = 'breakthrough'; att = 'NATO'; }
    else if (R <= 1 / 1.2) { verdict = 'breakthrough'; att = 'PACT'; }
    else {
      la = hit(st, 'NATO', 0.2); ld = hit(st, 'PACT', 0.2);
      st.will.NATO -= 2; st.will.PACT -= 2; st.streak.NATO++;
      b.verdict = 'locked'; b.lossN = la; b.lossP = ld;
      say(st, rep, 'Meeting engagement near ' + b.sector + ', neither side gives way. NATO lost ' + la.n + ', Pact lost ' + ld.n + '.', 'warn');
      rep.battle = b; return;
    }
    def = other(att); secIdx = att === 'NATO' ? st.front : st.front - 1;
    la = hit(st, att, 0.12); ld = hit(st, def, 0.22);
    b.verdict = 'breakthrough'; b.att = att;
  } else {
    att = aN ? 'NATO' : 'PACT'; def = other(att);
    secIdx = att === 'NATO' ? st.front : st.front - 1;
    var ap = atkPower(st, att, secIdx) * j();
    var dp = defPower(st, def, secIdx, plans[def].order) * j();
    R = ap / Math.max(0.01, dp);
    verdict = R >= 1.15 ? 'breakthrough' : R >= 0.85 ? 'costly' : 'repulsed';
    rates = { breakthrough: [0.10, 0.22], costly: [0.16, 0.16], repulsed: [0.26, 0.10] }[verdict];
    la = hit(st, att, rates[0]); ld = hit(st, def, rates[1]);
    b = { kind: 'assault', att: att, ratio: R, verdict: verdict, sector: SECTORS[clamp(secIdx, 0, 7)].name };
  }
  b.lossA = la; b.lossD = ld;
  var secName = SECTORS[clamp(secIdx, 0, 7)].name;
  var attLossTxt = att + ' lost ' + la.n + ', ' + def + ' lost ' + ld.n + '.';
  if (verdict === 'breakthrough') {
    st.wins[att]++;
    st.will[att] += 4; st.will[def] -= 5;
    st.streak[att] = 0;
    if (att === 'NATO') { st.front = Math.min(8, st.front + 1); b.advance = 1; say(st, rep, 'BREAKTHROUGH. NATO takes ' + secName + '. ' + attLossTxt, 'good'); }
    else { st.front = Math.max(0, st.front - 1); b.advance = -1; say(st, rep, 'COUNTERATTACK. The Pact retakes ' + secName + '. ' + attLossTxt, 'bad'); }
  } else if (verdict === 'costly') {
    st.will[att] -= 2; st.will[def] -= 1; st.streak[att]++;
    say(st, rep, att + ' attack on ' + secName + ' grinds to a halt. ' + attLossTxt, 'warn');
  } else {
    st.will[att] -= 4; st.will[def] += 2; st.streak[att]++;
    say(st, rep, att + ' attack on ' + secName + ' is thrown back. ' + attLossTxt, 'bad');
  }
  if (aN && !aP) st.streak.PACT = 0; if (aP && !aN) st.streak.NATO = 0;
  rep.battle = b;
}

/* ---------- turn ---------- */
function sanitize(st, side, plan) {
  plan = plan || {};
  var order = ORDERS[plan.order] ? plan.order : 'defend';
  var nuke = null;
  if (plan.nuke) {
    var o = nukeOptions(st, side).filter(function (x) { return x.id === plan.nuke && x.ok; })[0];
    if (o) nuke = o.id;
  }
  var pol = null;
  if (plan.pol) {
    var po = polOptions(st, side).filter(function (x) { return x.id === plan.pol && x.ok; })[0];
    if (po) pol = po.id;
  }
  var rail = !!plan.rail && side === 'NATO' && railEngOf(st, side) > 0;
  return { order: order, nuke: nuke, ceasefire: !!plan.ceasefire, offer: !!plan.offer, pol: pol, rail: rail };
}
function ending(st, id) {
  var E = {
    dresden:  { winner: 'NATO', title: 'Dresden falls', text: 'NATO armor reaches the Elbe. The 1st Guards Tank Army collapses and Moscow is forced to negotiate. Churchill\'s unthinkable plan, thirty years late, succeeds.' },
    breach:   { winner: 'PACT', title: 'The West collapses', text: 'The Pact drives NATO back past Fulda. The road to Frankfurt is open and the Rhine will fall within days.' },
    natoWill: { winner: 'PACT', title: 'Political collapse in the West', text: 'Public support evaporates. Governments fall, troops are recalled, and NATO is forced to accept Soviet terms. The planners warned this would happen.' },
    pactWill: { winner: 'NATO', title: 'Soviet cohesion cracks', text: 'Mutinies and unrest force Moscow to the table. The Pact line crumbles and NATO dictates the ceasefire.' },
    natoOut:  { winner: 'PACT', title: 'NATO army destroyed', text: 'Nothing is left of the NATO strike force. The Pact owns the battlefield.' },
    pactOut:  { winner: 'NATO', title: 'Pact army destroyed', text: 'The 8th Guards Army no longer exists as a fighting force. The way east is open.' },
    ceasefire:{ winner: null, title: 'Ceasefire', text: 'Both sides pull back and accept a ceasefire along the current line. The war is over, and the border is permanently scarred.' },
    gains:    { winner: 'NATO', title: 'Major gains', text: 'Dresden is still out of reach, but NATO holds a deep salient into Thuringia. The ceasefire leaves Moscow bargaining from a weaker hand.' },
    holds:    { winner: 'PACT', title: 'The line holds', text: 'Forty-five days on, NATO is still stuck at the border. The unthinkable plan has failed, exactly as the planners warned.' },
    stalemate:{ winner: null, title: 'Stalemate', text: 'After 45 days the fronts stop moving. Exhausted, both sides accept an armistice on the current line.' },
    ruin:     { winner: null, title: 'Mutual ruin', text: 'The nuclear ladder has run out. Both coalitions are shattered and Central Europe is a wasteland. Nobody wins.' }
  };
  var e = E[id]; e.id = id; e.day = st.day; return e;
}
function checkEnd(st) {
  if (st.esc >= 5) return ending(st, 'ruin');
  if (st.front <= 0) return ending(st, 'breach');
  if (st.front >= 8) return ending(st, 'dresden');
  if (st.will.NATO <= 0) return ending(st, 'natoWill');
  if (st.will.PACT <= 0) return ending(st, 'pactWill');
  if (combatCount(st, 'NATO') === 0) return ending(st, 'natoOut');
  if (combatCount(st, 'PACT') === 0) return ending(st, 'pactOut');
  if (st.day >= st.maxDay) return ending(st, st.front >= 6 ? 'gains' : st.front <= 2 ? 'holds' : 'stalemate');
  return null;
}
function outcomeFor(st) {
  if (!st.ended) return null;
  if (!st.ended.winner) return 'draw';
  return st.ended.winner === st.side ? 'win' : 'loss';
}

function endTurn(st, plan) {
  if (st.ended) return st.lastReport;
  var me = st.side, foe = other(me);
  var plans = {};
  plans[me] = sanitize(st, me, plan);
  plans[foe] = sanitize(st, foe, aiPlan(st, foe));
  var rep = { day: st.day, date: dateStr(st.day), lines: [], battle: null, nuke: [] };
  var finish = function (id) {
    st.will.NATO = clamp(st.will.NATO, 0, 100); st.will.PACT = clamp(st.will.PACT, 0, 100);
    st.ended = ending(st, id); st.lastReport = rep; rep.ended = st.ended;
    say(st, rep, st.ended.title + '.', 'big');
    return rep;
  };
  // ceasefire
  if (plans[me].ceasefire) {
    var p = st.offer === foe ? 1 : clamp(0.1 + 0.012 * (50 - st.will[foe]) + 0.15 * st.esc + (st.pol.med > 0 ? 0.25 : 0), 0.05, 0.95);
    if (rnd(st) < p) { say(st, rep, 'The ceasefire is accepted.', 'good'); return finish('ceasefire'); }
    say(st, rep, foe + ' rejects the ceasefire proposal.', 'warn');
  }
  if (plans[foe].offer && !plans[me].ceasefire) { st.offer = foe; say(st, rep, foe + ' proposes a ceasefire. You can accept next turn.', 'warn'); }
  else if (!plans[foe].offer && st.offer === foe) st.offer = null;
  // retaliation windows last one turn: the AI already read them while planning
  st.retaliate.NATO = 0; st.retaliate.PACT = 0;
  // events
  st.fog = false; st.refugees = false;
  rollEvents(st, rep);
  // nukes (a strike this turn opens the retaliation window for next turn)
  [me, foe].forEach(function (s) { if (plans[s].nuke) applyNuke(st, s, plans[s].nuke, rep); });
  if (st.esc >= 5) return finish('ruin');
  // politics (a hotline call fails if anyone struck this turn)
  var nuked = !!(plans[me].nuke || plans[foe].nuke);
  [me, foe].forEach(function (s) { if (plans[s].pol) applyPol(st, s, plans[s].pol, rep, nuked); });
  // combat
  fight(st, plans, rep);
  // upkeep
  ['NATO', 'PACT'].forEach(function (s) {
    // arrivals
    var arrive = [];
    st.queue[s].forEach(function (q) { q.fresh = false; q.eta--; if (q.eta <= 0) { st.forces[s][q.id] = (st.forces[s][q.id] || 0) + q.n; arrive.push(q.n + 'x ' + UNITS[q.id].n); } });
    st.queue[s] = st.queue[s].filter(function (q) { return q.eta > 0; });
    if (arrive.length && s === me) say(st, rep, 'Reinforcements arrive: ' + arrive.join(', ') + '.', 'good');
    // logistics: railhead work, then supply actually delivered
    if (plans[s].rail) railRepair(st, s, rep);
    if (s === 'NATO') st.lg.NATO.rail = clamp(Math.min(st.lg.NATO.rail, st.front - 1), 0, 7);
    var fl = flowFor(st, s); st.flow[s] = fl;
    var base = incomeBase(st, s);
    if (s !== me) base = Math.round(base * DIFF[st.diff]);
    var inc = Math.round(base * fl);
    if (st.incomeT[s] > 0) { inc = Math.floor(inc / 2); st.incomeT[s]--; }
    st.sup[s] = Math.min(40, st.sup[s] + inc);
    if (st.lg[s].cutT > 0) st.lg[s].cutT--;
    // political capital and alliance drift
    var P = st.pol[s];
    P.pc = Math.min(10, P.pc + 2 + (st.will[s] > 60 ? 1 : 0));
    P.coh = clamp(P.coh - (s === 'NATO' ? 0.5 : 0.3), 0, 100);
    // mods decay
    var m = st.mods[s];
    if (m.aT > 0) { m.aT--; if (!m.aT) m.a = 1; }
    if (m.dT > 0) { m.dT--; if (!m.dT) m.d = 1; }
    // dig counters
    if (plans[s].order === 'dig') st.dug[s] = Math.min(2, st.dug[s] + 1);
    else if (plans[s].order === 'attack') st.dug[s] = 0;
  });
  // fallout decay
  st.fallout.forEach(function (f) { f.t--; });
  st.fallout = st.fallout.filter(function (f) { return f.t > 0; });
  // events cooldown
  Object.keys(st.evCool).forEach(function (k) { if (st.evCool[k] > 0) st.evCool[k]--; });
  // recon intel
  if (plans[me].order === 'recon') st.intel = 2; else if (st.intel > 0) st.intel--;
  if (st.surprise > 0) st.surprise--;
  // home front baseline and world opinion
  st.will.NATO -= 0.7;
  if (st.pol.world < 35) st.will.NATO -= 0.6; else if (st.pol.world > 65) { st.will.NATO += 0.3; st.will.PACT -= 0.4; }
  if (st.pol.med > 0) st.pol.med--;
  st.pol.world = clamp(st.pol.world + (45 - st.pol.world) * 0.06, 0, 100);
  // second echelon
  if (!st.echelon && (st.front >= 5 || st.day >= 14)) {
    st.echelon = true;
    var F = st.forces.PACT; F.t62 += 3; F.bmp1 += 3; F.btr60 += 2;
    if (tier(st) >= 2) F.t64a = (F.t64a || 0) + 2; else F.t55 += 2;
    st.will.PACT += 5;
    say(st, rep, 'SECOND ECHELON: the 1st Guards Tank Army is committed from the Dresden area.', 'bad');
  }
  // clamp
  st.will.NATO = clamp(st.will.NATO, 0, 100); st.will.PACT = clamp(st.will.PACT, 0, 100);
  // end of the war?
  var e = checkEnd(st);
  if (e) { st.ended = e; rep.ended = e; say(st, rep, e.title + '.', 'big'); st.lastReport = rep; return rep; }
  var tOld = st.tierSeen;
  st.day++;
  var t = tier(st);
  if (t > tOld) {
    st.tierSeen = t;
    var names = unitsFor(me, t).filter(function (id) { return UNITS[id].t === t; }).map(function (id) { return UNITS[id].n; });
    say(st, rep, 'TIER ' + t + ' UNLOCKED: ' + names.join(', ') + '.', 'good');
  }
  st.noise = 0.75 + 0.5 * rnd(st);
  st.lastReport = rep;
  return rep;
}

/* ---------- views / estimates ---------- */
function estimateEnemy(st) {
  var foe = other(st.side), c = contacts(st), z = c.seen, comp = {}, k;
  for (k in c.comp) comp[k] = Math.round(c.comp[k]);
  var exact = c.list.length > 0 && c.list.every(function (i) { return i.level === 'id'; });
  return { exact: exact, seen: z, units: Math.round(total(st, foe) * z), comp: comp, sight: c.sight, range: c.range,
    atk: basePower(st, foe, 'a') * z, def: basePower(st, foe, 'd') * z };
}
function odds(st) { // advisor, uses the fogged estimate, no dice
  var me = st.side, foe = other(me), est = estimateEnemy(st);
  var secIdx = me === 'NATO' ? st.front : st.front - 1;
  var myA = atkPower(st, me, secIdx) * (est.exact ? 1 : 1);
  var dp = est.def * moraleMul(st, foe) * SECTORS[clamp(secIdx, 0, 7)].def * 1.15 * (foe === 'PACT' ? 1 + 0.015 * (st.front - 1) : 1) * (foe === 'PACT' && st.surprise > 0 ? 0.85 : 1);
  var R = myA / Math.max(1, dp);
  return { ratio: R, label: R >= 1.5 ? 'Overwhelming' : R >= 1.25 ? 'Good' : R >= 0.95 ? 'Even' : R >= 0.7 ? 'Poor' : 'Hopeless' };
}
function mini(st) {
  if (!st) return null;
  return { side: st.side, day: st.day, esc: st.esc, front: st.front, sector: SECTORS[clamp(st.front, 0, 7)].name, ended: !!st.ended };
}

root.U75Engine = {
  NAME: NAME, SECTORS: SECTORS, UNITS: UNITS, ORDERS: ORDERS, ESC_NAMES: ESC_NAMES, CLS_NAME: CLS_NAME,
  other: other, newGame: newGame, endTurn: endTurn, queueBuild: queueBuild, cancelBuild: cancelBuild,
  nukeOptions: nukeOptions, aiPlan: aiPlan, tier: tier, tierPoints: tierPoints, unitsFor: unitsFor,
  total: total, combatCount: combatCount, dateStr: dateStr, estimateEnemy: estimateEnemy, odds: odds,
  outcomeFor: outcomeFor, mini: mini, unitEta: unitEta, basePower: basePower, rnd: rnd,
  logView: logView, flowFor: flowFor, awacsLevel: awacsLevel, tankersOf: tankersOf, detect: detect, contacts: contacts,
  polOptions: polOptions, POL: POL, railEngOf: railEngOf, airMult: airMult, has: has
};
if (typeof module !== 'undefined' && module.exports) module.exports = root.U75Engine;
})(typeof window !== 'undefined' ? window : globalThis);
