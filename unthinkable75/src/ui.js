/* UNTHINKABLE '75 - UI. Plain DOM, one render() per state change. */
(function () {
'use strict';
var E = window.U75Engine;
var U = E.UNITS, S = E.SECTORS;

/* ---------- storage (NOVA bridge if present, else localStorage, else memory) ---------- */
var mem = {};
var Store = {
  get: function (k) {
    try {
      if (window.NovaSave && window.NovaSave.get) { var v = window.NovaSave.get(k); return v == null || v === '' ? null : v; }
      return window.localStorage.getItem(k);
    } catch (e) { return mem[k] || null; }
  },
  set: function (k, v) {
    try {
      if (window.NovaSave && window.NovaSave.set) { window.NovaSave.set(k, v); return; }
      window.localStorage.setItem(k, v);
    } catch (e) { mem[k] = v; }
  },
  del: function (k) {
    try {
      if (window.NovaSave && window.NovaSave.del) { window.NovaSave.del(k); return; }
      window.localStorage.removeItem(k);
    } catch (e) { delete mem[k]; }
  }
};
function slotKey(n) { return 'u75.slot.' + n; }
function readSlot(n) { try { var r = Store.get(slotKey(n)); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function metaOf(st) {
  return { side: st.side, diff: st.diff, day: st.day, front: st.front, esc: st.esc,
    ended: st.ended ? { title: st.ended.title, outcome: E.outcomeFor(st) } : null };
}
function saveSlot() {
  if (!app.st || !app.slot) return;
  Store.set(slotKey(app.slot), JSON.stringify({ v: 1, saved: Date.now(), meta: metaOf(app.st), state: app.st }));
}

/* ---------- app state ---------- */
var app = { screen: 'slots', slot: null, st: null, tab: 'orders', plan: null, setup: { side: 'NATO', diff: 'normal', prep: 1 },
  report: null, modal: null, mini: false };

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bar(v, max, c) { return '<div class="bar ' + (c || '') + '"><i style="width:' + clamp(v / max * 100, 0, 100) + '%"></i></div>'; }
function ico(id, side) { return '<svg class="ico ' + (side || '') + '" viewBox="0 0 48 28"><use href="#i-' + U[id].k + '"/></svg>'; }
function note(t, c) { return '<div class="note ' + (c || '') + '">' + t + '</div>'; }
function fmtTime(ts) { var d = new Date(ts); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
function newPlan(st) {
  var o = E.odds(st);
  return { order: st.side === 'NATO' && (st.surprise > 0 || o.ratio >= 1.15) ? 'attack' : 'defend', nuke: null, ceasefire: false, rail: false, pol: null };
}

/* ---------- map ---------- */
function mapSVG(st) {
  var me = st.side, foe = E.other(me);
  var P = S.map(function (s) { return { x: 22 + (s.lon - 9.5) * 72, y: 168 - (s.lat - 50.5) * 200 }; });
  var C = E.contacts(st), by = {};
  C.list.forEach(function (c) { by[c.sec] = c; });
  var lv = E.logView(st, me);
  var o = '<svg viewBox="0 0 360 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Operational map, Fulda to Dresden">';
  o += '<rect width="360" height="190" fill="#0a100d"/>';
  for (var gx = 20; gx < 360; gx += 40) o += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="190" stroke="#121b17" stroke-width="1"/>';
  for (var gy = 10; gy < 190; gy += 40) o += '<line x1="0" y1="' + gy + '" x2="360" y2="' + gy + '" stroke="#121b17" stroke-width="1"/>';
  o += '<ellipse cx="70" cy="100" rx="36" ry="14" fill="#14241a" transform="rotate(-20 70 100)"/>';
  o += '<ellipse cx="34" cy="138" rx="24" ry="14" fill="#14241a"/>';
  o += '<ellipse cx="300" cy="112" rx="38" ry="12" fill="#14241a"/>';
  o += '<path d="M52 6 L60 44 L51 88 L58 130 L52 186" fill="none" stroke="#f2b84b" stroke-width="1.1" stroke-dasharray="4 3" opacity=".75"/>';
  o += '<text x="63" y="14" font-size="6.5" fill="#f2b84b" opacity=".75" font-family="monospace">INNER GERMAN BORDER</text>';
  // roads
  o += '<polyline fill="none" stroke="#25332c" stroke-width="3" stroke-linejoin="round" points="' + P.map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>';
  // own supply line: rail (solid) to the railhead, trucks (dotted) onward
  var r = lv.rail, fr = me === 'NATO' ? st.front - 1 : st.front;
  if (me === 'NATO') {
    var rp = P.slice(0, r + 1).map(function (p) { return p.x + ',' + p.y; }).join(' ');
    o += '<polyline fill="none" stroke="#f2b84b" stroke-width="2" points="' + rp + '"/>';
    if (fr > r) o += '<polyline fill="none" stroke="#f2b84b" stroke-width="1.6" stroke-dasharray="2 3" points="' + P.slice(r, fr + 1).map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>';
  } else {
    o += '<polyline fill="none" stroke="#f2b84b" stroke-width="2" points="' + P.slice(r).map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>';
    if (r > fr) o += '<polyline fill="none" stroke="#f2b84b" stroke-width="1.6" stroke-dasharray="2 3" points="' + P.slice(fr, r + 1).map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>';
  }
  // front marker
  if (st.front >= 1 && st.front <= 7) {
    var a = P[st.front - 1], b = P[st.front], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    o += '<circle class="pulse" cx="' + mx + '" cy="' + my + '" r="7" fill="none" stroke="#f2b84b" stroke-width="2"/>';
  }
  S.forEach(function (s, i) {
    var p = P[i], mine = (i < st.front) === (me === 'NATO');
    var owner = i < st.front ? 'NATO' : 'PACT';
    var col = owner === 'NATO' ? '#4da3ff' : '#ff5b4a';
    var c = by[i], lvl = c ? c.level : null;
    o += '<g class="sec">';
    if (lvl === 'id') o += '<circle cx="' + p.x + '" cy="' + p.y + '" r="14" fill="none" stroke="' + col + '" stroke-width="1.5"/>';
    if (lvl === 'unk') o += '<circle cx="' + p.x + '" cy="' + p.y + '" r="14" fill="none" stroke="#f2b84b" stroke-width="1.3" stroke-dasharray="3 3"/>';
    o += '<circle cx="' + p.x + '" cy="' + p.y + '" r="9" fill="#0c110f" stroke="' + col + '" stroke-width="2.2"/>';
    o += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + col + '" opacity="' + (mine ? 1 : .55) + '"/>';
    if (i === 7) o += '<text x="' + (p.x + 11) + '" y="' + (p.y + 3) + '" fill="#f2b84b" font-size="10">★</text>';
    var up = i % 2 === 0, ty = up ? p.y - 17 : p.y + 24;
    o += '<text class="nm" x="' + p.x + '" y="' + ty + '" text-anchor="middle">' + S[i].name.toUpperCase() + '</text>';
    if (c && (lvl === 'id' || lvl === 'unk')) {
      var txt = (lvl === 'unk' ? '?~' : '') + c.units, w = 8 + txt.length * 5;
      o += '<g><rect x="' + (p.x + 8) + '" y="' + (p.y - 21) + '" width="' + w + '" height="11" rx="3" fill="' + (lvl === 'id' ? col : '#3a2f10') + '"/><text x="' + (p.x + 8 + w / 2) + '" y="' + (p.y - 13) + '" text-anchor="middle" font-size="8" fill="' + (lvl === 'id' ? '#0c110f' : '#f2b84b') + '" font-weight="700">' + txt + '</text></g>';
    }
    if (C.reserve && i === 7 && C.reserve.level !== 'hid') {
      o += '<text x="' + p.x + '" y="' + (p.y - 27) + '" text-anchor="middle" font-size="7" fill="#f2b84b">' + (C.reserve.level === 'id' ? 'RESERVE ~10' : 'RESERVE ?') + '</text>';
    }
    for (var k = 0; k < st.fallout.length; k++) if (st.fallout[k].sec === i) o += '<text class="pulse" x="' + (p.x - 17) + '" y="' + (p.y + 4) + '" font-size="12" fill="#e8ff5a">☢</text>';
    o += '</g>';
  });
  // railhead marker
  var rp2 = P[r] || P[0];
  o += '<g transform="translate(' + (rp2.x - 9) + ',' + (rp2.y + 6) + ') scale(.38)" style="color:#f2b84b"><use href="#i-train"/></g>';
  o += '</svg>';
  return o;
}

/* ---------- parts ---------- */
function meters(st) {
  var me = st.side, P = st.pol[me], lv = E.logView(st, me);
  var pips = '';
  for (var i = 0; i < 6; i++) pips += '<i class="' + (i <= st.esc && i > 0 ? (i >= 4 ? 'hot' : 'on') : '') + '"></i>';
  return '<div class="meters">' +
    '<div class="m"><small>Supply</small><b>' + st.sup[me] + '</b><span class="dim mono" style="font-size:10px"> +' + lv.delivered + '</span>' + bar(st.sup[me], 40) + '</div>' +
    '<div class="m"><small>Will</small><b>' + Math.round(st.will[me]) + '</b>' + bar(st.will[me], 100, 'w') + '</div>' +
    '<div class="m"><small>' + (me === 'NATO' ? 'Allies' : 'Satellites') + '</small><b>' + Math.round(P.coh) + '</b>' + bar(P.coh, 100, 'c') + '</div>' +
    '<div class="m"><small>Pol.cap</small><b>' + P.pc + '</b>' + bar(P.pc, 10, 'p') + '</div>' +
    '<div class="m" style="grid-column:1/-1"><small>Escalation: ' + E.ESC_NAMES[st.esc] + '</small><div class="esc">' + pips + '</div></div>' +
    '</div>';
}
var TABS = [['orders', 'Orders'], ['build', 'Build'], ['supply', 'Supply'], ['intel', 'Intel'], ['forces', 'Forces'], ['politics', 'Politics'], ['escalate', 'Escalate'], ['log', 'Log']];
function tabsBar(st) {
  var lv = E.logView(st, st.side);
  return '<div class="tabs">' + TABS.map(function (t) {
    var flag = (t[0] === 'supply' && lv.flow < 0.8) || (t[0] === 'escalate' && st.esc >= 3) || (t[0] === 'orders' && st.offer === E.other(st.side));
    return '<button data-act="tab" data-id="' + t[0] + '" class="' + (app.tab === t[0] ? 'on' : '') + '">' + t[1] + (flag ? '<i>!</i>' : '') + '</button>';
  }).join('') + '</div>';
}
function unitRow(id, st, buy) {
  var u = U[id], me = st.side, have = st.forces[me][id] || 0, aff = st.sup[me] >= u.c;
  return '<div class="unit ' + me + '">' + ico(id, me) +
    '<div class="grow"><div class="nm">' + esc(u.n) + '</div><div class="st">A' + u.a + ' D' + u.d + ' · ' + E.CLS_NAME[u.cls] + (buy ? ' · cost ' + u.c + ' · ' + E.unitEta(id) + ' turn' + (E.unitEta(id) > 1 ? 's' : '') : '') + '</div>' +
    (u.note ? '<div class="nt">' + esc(u.note) + '</div>' : '') + '</div>' +
    '<div class="qty">' + have + '</div>' +
    (buy ? '<button data-act="buy" data-id="' + id + '"' + (aff ? '' : ' disabled') + '>+</button>' : '') + '</div>';
}

/* ---------- tabs ---------- */
function tabOrders(st) {
  var me = st.side, foe = E.other(me), o = E.odds(st), est = E.estimateEnemy(st), h = '';
  var tgt = me === 'NATO' ? S[clamp(st.front, 0, 7)].name : S[clamp(st.front - 1, 0, 7)].name;
  if (st.offer === foe) h += note('The enemy proposes a ceasefire. Toggle <b>Accept ceasefire</b> below to take it.', 'good');
  if (me === 'NATO' && st.surprise === 2) h += note('<b>SURPRISE.</b> The Soviets were caught half-prepared. Your attack is boosted for 2 turns.', 'good');
  if (me === 'NATO' && st.leaked && st.day <= 3) h += note('The Soviets spotted the build-up and are dug in. Expect a hard fight.', 'bad');
  if (me === 'PACT' && st.surprise > 0) h += note('NATO is attacking with surprise. Your units are disorganized for now.', 'bad');
  var lab = o.label, lc = o.ratio >= 1.25 ? 'good' : o.ratio >= 0.95 ? 'warn' : 'bad';
  h += '<div class="card"><h3>Attack odds on ' + tgt + ' <span class="mono ' + lc + '">' + lab + '</span></h3>' +
    '<p>Ratio ' + o.ratio.toFixed(2) + ' vs ' + (est.exact ? 'a confirmed' : 'an estimated') + ' enemy (' + est.units + ' units seen' + (est.exact ? '' : ', more may be hidden') + '). Use Recon or AWACS to see further.</p></div>';
  ['attack', 'defend', 'dig', 'recon'].forEach(function (id) {
    h += '<div class="card ' + (app.plan.order === id ? 'sel' : '') + '" data-act="order" data-id="' + id + '"><h3>' + E.ORDERS[id].n + '</h3><p>' + (id === 'attack' ? 'Target: ' + tgt + '. ' : '') + E.ORDERS[id].d + '</p></div>';
  });
  h += '<div class="card ' + (app.plan.ceasefire ? 'sel' : '') + '" data-act="cease"><h3>' + (st.offer === foe ? 'Accept ceasefire' : 'Propose ceasefire') + '</h3><p>Ends the war on the current line. ' + (st.pol.med > 0 ? 'Swiss mediation makes this easier right now.' : 'The enemy may refuse.') + '</p></div>';
  return h;
}
function tabBuild(st) {
  var me = st.side, t = E.tier(st), h = '';
  h += '<div class="card"><h3>Tier ' + t + '<span class="mono dim">' + E.tierPoints(st) + ' pts</span></h3><p>Tier 2 at 8 points, tier 3 at 20. You earn 1 per day and 2 per battle won.</p></div>';
  var q = st.queue[me];
  if (q.length) {
    h += '<div class="lbl">In production</div><div class="card">' + q.map(function (x, i) {
      return '<div class="unit ' + me + '">' + ico(x.id, me) + '<div class="grow"><div class="nm">' + x.n + 'x ' + esc(U[x.id].n) + '</div><div class="st">arrives in ' + x.eta + ' turn' + (x.eta > 1 ? 's' : '') + '</div></div>' +
        (x.fresh ? '<button data-act="unbuy" data-id="' + i + '">undo</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  h += '<div class="lbl">Available (supply ' + st.sup[me] + ')</div><div class="card">' +
    E.unitsFor(me, t).sort(function (a, b) { return U[a].t - U[b].t || U[a].c - U[b].c; }).map(function (id) { return unitRow(id, st, true); }).join('') + '</div>';
  if (t < 3) {
    var nx = E.unitsFor(me, 3).filter(function (id) { return U[id].t === t + 1; });
    h += note('<b>Tier ' + (t + 1) + ' unlocks:</b> ' + nx.map(function (id) { return esc(U[id].n); }).join(', ') + '.');
  }
  return h;
}
function tabSupply(st) {
  var me = st.side, lv = E.logView(st, me), h = '';
  var pct = Math.round(lv.flow * 100);
  h += '<div class="card"><h3>Supply flow <span class="mono ' + (pct >= 85 ? 'good' : pct >= 60 ? 'warn' : 'bad') + '">' + pct + '%</span></h3>' + bar(lv.flow, 1, lv.flow >= .85 ? '' : lv.flow >= .6 ? 'w' : 'r') +
    '<p>Production ' + lv.base + ' per turn, ' + lv.delivered + ' actually delivered to the front.</p></div>';
  h += '<div class="card"><div class="kv"><span>Trains</span><span>' + lv.trains + '</span><span>Rail capacity</span><span>' + lv.cap.toFixed(1) + ' / ' + lv.base + ' needed</span>' +
    '<span>Truck convoys</span><span>' + lv.trucks + '</span><span>Railhead</span><span>' + S[lv.rail].name + '</span>' +
    '<span>Haul distance</span><span>' + lv.dist + ' sector' + (lv.dist === 1 ? '' : 's') + '</span><span>Haul needed / have</span><span>' + lv.need + ' / ' + lv.haul + '</span>' +
    (me === 'NATO' ? '<span>Railway engineers</span><span>' + lv.engs + '</span>' : '') +
    (lv.cut > 0 ? '<span class="bad">Rail cut</span><span class="bad">' + lv.cut + ' turn(s)</span>' : '') + '</div></div>';
  var tips = [];
  if (lv.cap < lv.base) tips.push('Rail capacity is below production. Build <b>supply trains</b>.');
  if (lv.haul < lv.need) tips.push('Convoys cannot cover the haul distance. Build <b>truck convoys</b>' + (me === 'NATO' ? ' or extend the railhead.' : '.'));
  if (lv.cut > 0) tips.push('Interdiction has cut your rail. Flow is halved until it is repaired.');
  if (tips.length) h += note(tips.join('<br>'), 'bad'); else h += note('Supply pipeline is healthy.', 'good');
  if (me === 'NATO') {
    var can = lv.engs > 0 && st.lg.NATO.rail < st.front - 1 && st.sup.NATO >= 3;
    var why = lv.engs < 1 ? 'Needs Railway engineers (Build tab)' : st.lg.NATO.rail >= st.front - 1 ? 'Railhead already at the front' : st.sup.NATO < 3 ? 'Needs 3 supply' : '';
    h += '<div class="card ' + (app.plan.rail ? 'sel' : '') + (can ? '' : ' off') + '" ' + (can ? 'data-act="rail"' : '') + '><h3>Rail repair <span class="mono dim">3 supply</span></h3><p>Engineers push the railhead one sector east every 2 turns (faster with more engineers). Shorter hauls mean more supply at the front.</p>' + (why ? '<div class="why">' + why + '</div>' : '') + '</div>';
  } else {
    h += note('The Pact fights on its own rail network: the railhead stays close behind the front. Your risk is interdiction and a short train fleet.');
  }
  return h;
}
function tabIntel(st) {
  var me = st.side, C = E.contacts(st), foe = E.other(me), h = '';
  var al = E.awacsLevel(st, me), tk = E.tankersOf(st, me);
  h += '<div class="card"><h3>Sensors</h3><div class="kv"><span>Identify range</span><span>' + C.sight + ' sector' + (C.sight > 1 ? 's' : '') + '</span><span>Radar range</span><span>' + C.range + ' sectors</span><span>AWACS level</span><span>' + al.toFixed(1) + '</span>' +
    (me === 'NATO' ? '<span>Tankers</span><span>' + tk + '</span><span>Air reach</span><span>' + (3 + 1.5 * Math.min(2, tk)).toFixed(1) + ' sectors</span>' : '') + '</div>' +
    '<p>Units inside identify range are <span class="good">identified</span>. Farther inside radar range they show as <span class="warn">unknown contacts</span> with a rough size. Beyond that you see nothing. AWACS and Recon extend both.</p></div>';
  if (me === 'NATO' && tk < 2 && st.front >= 3) h += note('Your air power is operating beyond its range. <b>KC-135 tankers</b> extend NATO air reach.');
  h += '<div class="lbl">Contacts</div><div class="card">';
  C.list.forEach(function (c) {
    h += '<div class="unit"><div class="grow"><div class="nm">' + S[c.sec].name + ' <span class="chip ' + c.level + '">' + (c.level === 'id' ? 'identified' : c.level === 'unk' ? 'unknown' : 'no contact') + '</span></div>' +
      '<div class="st">' + (c.level === 'id' ? c.units + ' units' : c.level === 'unk' ? 'about ' + c.units + ' units, type unknown' : 'beyond your sensors') + '</div></div></div>';
  });
  if (C.reserve) h += '<div class="unit"><div class="grow"><div class="nm">Dresden reserve <span class="chip ' + C.reserve.level + '">' + (C.reserve.level === 'hid' ? 'no contact' : C.reserve.level === 'id' ? 'identified' : 'unknown') + '</span></div><div class="st">' + (C.reserve.level === 'hid' ? 'a second army may be waiting out of sight' : 'a large armored formation is massing') + '</div></div></div>';
  h += '</div>';
  var comp = E.estimateEnemy(st).comp, keys = Object.keys(comp);
  if (keys.length) h += '<div class="lbl">Identified composition</div><div class="card"><div class="kv">' + keys.map(function (k) { return '<span>' + E.CLS_NAME[k] + '</span><span>~' + comp[k] + '</span>'; }).join('') + '</div></div>';
  return h;
}
function tabForces(st) {
  var me = st.side, f = st.forces[me], by = {}, h = '';
  Object.keys(f).forEach(function (id) { if (f[id] > 0) (by[U[id].cls] = by[U[id].cls] || []).push(id); });
  h += '<div class="card"><div class="kv"><span>Total units</span><span>' + E.total(st, me) + '</span><span>Combat strength</span><span>' + Math.round(E.basePower(st, me, 'a')) + ' atk / ' + Math.round(E.basePower(st, me, 'd')) + ' def</span><span>Battles won</span><span>' + st.wins[me] + '</span><span>Units lost</span><span>' + st.stats.lost[me] + '</span></div></div>';
  Object.keys(by).forEach(function (cls) {
    h += '<div class="lbl">' + E.CLS_NAME[cls] + '</div><div class="card">' + by[cls].map(function (id) { return unitRow(id, st, false); }).join('') + '</div>';
  });
  return h;
}
function tabPolitics(st) {
  var me = st.side, P = st.pol[me], h = '';
  var wp = me === 'NATO' ? st.pol.world : 100 - st.pol.world;
  h += '<div class="card"><div class="kv"><span>' + (me === 'NATO' ? 'Allied cohesion' : 'Satellite loyalty') + '</span><span>' + Math.round(P.coh) + '</span><span>Political capital</span><span>' + P.pc + ' / 10</span><span>World opinion (for you)</span><span>' + Math.round(wp) + '</span></div>' + bar(wp, 100, 'c') +
    '<p>You gain political capital every turn. Spend it on one action per turn.</p></div>';
  if (P.coh < 35) h += note(me === 'NATO' ? '<b>Allies are wavering.</b> NATO attacks are weaker and nuclear release is blocked until cohesion recovers.' : '<b>Satellite armies are unreliable.</b> Pact attack and defense are weaker.', 'bad');
  if (st.pol.med > 0) h += note('Swiss mediation in Geneva: a ceasefire is easier for ' + st.pol.med + ' more turn(s).', 'good');
  E.polOptions(st, me).forEach(function (o) {
    h += '<div class="card ' + (app.plan.pol === o.id ? 'sel' : '') + (o.ok ? '' : ' off') + '" ' + (o.ok ? 'data-act="pol" data-id="' + o.id + '"' : '') + '><h3>' + esc(o.name) + '<span class="mono dim">' + o.cost + ' pc</span></h3><p>' + esc(o.desc) + '</p>' + (o.why ? '<div class="why">' + esc(o.why) + '</div>' : '') + '</div>';
  });
  return h;
}
function tabEscalate(st) {
  var me = st.side, h = '<div class="ladder">';
  E.ESC_NAMES.forEach(function (n, i) { h += '<div class="' + (i <= st.esc ? 'on ' : '') + (i === st.esc ? 'cur ' : '') + (i === 5 ? 'ruin' : '') + '"><b>' + i + '</b>' + esc(n) + '</div>'; });
  h += '</div>';
  h += note('One escalation action per turn. Every strike weakens your home front and alliance, and the other side may answer in kind. <b>Level 5 ends the war in mutual ruin.</b>', st.esc >= 3 ? 'bad' : '');
  E.nukeOptions(st, me).forEach(function (o) {
    h += '<div class="card ' + (app.plan.nuke === o.id ? 'sel' : '') + (o.ok ? '' : ' off') + '" ' + (o.ok ? 'data-act="nuke" data-id="' + o.id + '"' : '') + '><h3><span>' + esc(o.name) + (o.danger ? ' <span class="bad">(would reach level 5)</span>' : '') + '</span><span class="mono nuke">L' + o.lvl + '</span></h3><p>' + esc(o.desc) + '</p>' + (o.why ? '<div class="why">' + esc(o.why) + '</div>' : '') + '</div>';
  });
  if (st.retaliate[me] > 0) h += note('The enemy struck last turn. Expect more.', 'bad');
  return h;
}
function tabLog(st) {
  var items = st.log.slice(-40).reverse();
  return '<div class="lg">' + items.map(function (l) { return '<div class="' + l.c + '"><span>D' + l.d + '</span>' + esc(l.t) + '</div>'; }).join('') + '</div>';
}
var TAB_FN = { orders: tabOrders, build: tabBuild, supply: tabSupply, intel: tabIntel, forces: tabForces, politics: tabPolitics, escalate: tabEscalate, log: tabLog };

/* ---------- screens ---------- */
function renderSlots() {
  var h = '<div class="hero"><h1>Unthinkable <b>\'75</b></h1><p>What if the unthinkable plan had been launched thirty years later? NATO strikes east from Fulda. Three saved campaigns.</p></div><div class="scroll">';
  [1, 2, 3].forEach(function (n) {
    var d = readSlot(n), m = d && d.meta;
    h += '<div class="slot"><div class="row"><span class="name">SLOT ' + n + '</span>' + (m && m.ended ? '<span class="badge ' + m.ended.outcome + '">' + m.ended.outcome + '</span>' : m ? '<span class="badge">in progress</span>' : '<span class="badge">empty</span>') + '</div>';
    if (m) {
      h += '<div class="meta">' + (m.side === 'NATO' ? 'NATO attack' : 'Pact defense') + ' · ' + m.diff + ' · day ' + m.day + ' · front at ' + S[clamp(m.front, 0, 7)].name + ' · escalation ' + m.esc + (m.ended ? '<br><b>' + esc(m.ended.title) + '</b>' : '') + '<br>saved ' + fmtTime(d.saved) + '</div>';
      h += '<div class="btns"><button class="pri" data-act="cont" data-id="' + n + '">' + (m.ended ? 'View result' : 'Continue') + '</button><button class="dng" data-act="reset" data-id="' + n + '">Reset</button></div>';
    } else h += '<div class="btns"><button class="pri" data-act="new" data-id="' + n + '">New campaign</button></div>';
    h += '</div>';
  });
  h += '<div class="slot"><button data-act="close" style="width:100%">Close</button></div></div>';
  return h;
}
function renderSetup() {
  var s = app.setup, leak = Math.round((0.10 + 0.15 * (s.side === 'NATO' ? s.prep : 1)) * 100);
  var h = '<div class="hero"><h1>New <b>campaign</b></h1><p>Slot ' + app.slot + '</p></div><div class="scroll">';
  h += '<div class="lbl">Side</div>';
  h += '<button class="opt ' + (s.side === 'NATO' ? 'sel' : '') + '" data-act="setside" data-id="NATO"><b>NATO: strike east</b>Quality and initiative. Reach Dresden in 45 days before your home front gives out.</button>';
  h += '<button class="opt ' + (s.side === 'PACT' ? 'sel' : '') + '" data-act="setside" data-id="PACT"><b>Warsaw Pact: hold the line</b>Numbers and interior lines. Stop the offensive and break NATO\'s will.</button>';
  h += '<div class="lbl">AI difficulty</div><div class="seg">' + ['easy', 'normal', 'hard'].map(function (d) { return '<button class="' + (s.diff === d ? 'sel' : '') + '" data-act="setdiff" data-id="' + d + '">' + d + '</button>'; }).join('') + '</div>';
  if (s.side === 'NATO') {
    h += '<div class="lbl">Preparation days</div><div class="seg">' + [0, 1, 2, 3].map(function (p) { return '<button class="' + (s.prep === p ? 'sel' : '') + '" data-act="setprep" data-id="' + p + '">' + p + '</button>'; }).join('') + '</div>';
    h += note('More prep days mean extra units and supply, but a <b>' + leak + '%</b> chance the Soviets spot the build-up and dig in. A secret attack gets a big first-strike bonus.');
  } else h += note('NATO will prepare for about a day. There is a ' + leak + '% chance you saw it coming.');
  h += '<div class="btns" style="display:flex;gap:8px;margin-top:6px"><button data-act="home" style="flex:1">Back</button><button class="pri" data-act="start" style="flex:2">Start campaign</button></div></div>';
  return h;
}
function planSummary(st) {
  var p = app.plan, parts = ['<b>' + E.ORDERS[p.order].n + '</b>'];
  if (p.nuke) parts.push('<span class="nuke">' + esc(E.nukeOptions(st, st.side).filter(function (o) { return o.id === p.nuke; })[0].name) + '</span>');
  if (p.rail) parts.push('rail repair');
  if (p.pol) parts.push(esc(E.polOptions(st, st.side).filter(function (o) { return o.id === p.pol; })[0].name));
  if (p.ceasefire) parts.push('ceasefire');
  return parts.join(' · ');
}
function renderGame() {
  var st = app.st;
  var h = '<div class="game"><div class="top"><button data-act="home" aria-label="Menu">☰</button><div class="ttl"><b>DAY ' + st.day + '</b><span>' + E.dateStr(st.day) + '</span></div><span class="tag ' + st.side + '">' + st.side + '</span><button data-act="mini" aria-label="Shrink to bubble">▾</button></div>';
  h += meters(st);
  h += '<div class="mapwrap">' + mapSVG(st) + '</div>';
  h += '<div class="right">' + tabsBar(st) + '<div class="scroll" id="sc">' + TAB_FN[app.tab](st) + '</div>';
  h += '<div class="bottom"><div class="sum">' + planSummary(st) + '<br><span class="dim">Sector: ' + S[clamp(st.side === 'NATO' ? st.front : st.front - 1, 0, 7)].name + '</span></div><button class="pri" data-act="end">END TURN</button></div></div></div>';
  return h;
}
function renderEnd() {
  var st = app.st, e = st.ended, o = E.outcomeFor(st);
  var h = '<div class="hero"><span class="badge ' + o + '">' + (o === 'win' ? 'Victory' : o === 'loss' ? 'Defeat' : 'No winner') + '</span><h1 style="margin-top:10px">' + esc(e.title) + '</h1><p>' + esc(e.text) + '</p></div><div class="scroll">';
  h += '<div class="card"><div class="kv"><span>Days fought</span><span>' + e.day + '</span><span>Front line</span><span>' + S[clamp(st.front, 0, 7)].name + '</span><span>NATO units lost</span><span>' + st.stats.lost.NATO + '</span><span>Pact units lost</span><span>' + st.stats.lost.PACT + '</span><span>Nuclear strikes</span><span>' + st.stats.nukes + '</span><span>Highest escalation</span><span>' + E.ESC_NAMES[st.stats.maxEsc] + '</span></div></div>';
  h += '<button class="pri" data-act="home" style="width:100%">Back to slots</button></div>';
  return h;
}
function modalHTML() {
  var m = app.modal, st = app.st;
  if (app.report) {
    var r = app.report, b = r.battle, h = '<div class="modal"><div class="sheet"><h2>DAY ' + r.day + ' REPORT</h2><div class="dim mono" style="font-size:12px">' + r.date + '</div>';
    if (b && b.kind !== 'quiet') {
      var good = (b.verdict === 'breakthrough' && (b.att === st.side)) ;
      var lab = b.kind === 'meeting' ? (b.verdict === 'locked' ? 'LOCKED BATTLE' : 'MEETING ENGAGEMENT') : (b.verdict || '').toUpperCase();
      h += '<div class="verdict ' + (b.verdict === 'breakthrough' ? (good ? 'good' : 'bad') : b.verdict === 'repulsed' ? (b.att === st.side ? 'bad' : 'good') : 'warn') + '">' + lab + ' · ' + esc(b.sector) + '</div>';
    }
    h += '<div class="lg">' + r.lines.map(function (l) { return '<div class="' + l.c + '">' + esc(l.t) + '</div>'; }).join('') + '</div>';
    h += '<div class="btns"><button class="pri" data-act="report-ok">' + (st.ended ? 'See result' : 'Next turn') + '</button></div></div></div>';
    return h;
  }
  if (m && m.type === 'reset') return '<div class="modal"><div class="sheet"><h2>RESET SLOT ' + m.n + '?</h2><p>This deletes the saved campaign in this slot. It cannot be undone.</p><div class="btns"><button data-act="cancel">Keep it</button><button class="dng" data-act="do-reset">Reset</button></div></div></div>';
  if (m && m.type === 'nuke') return '<div class="modal"><div class="sheet"><h2 class="nuke">NUCLEAR ACTION</h2><p>' + m.text + '</p><div class="btns"><button data-act="cancel">Stand down</button><button class="dng" data-act="confirm-end">Proceed</button></div></div></div>';
  return '';
}

/* ---------- render ---------- */
function render() {
  var root = document.getElementById('app'), sc = document.getElementById('sc'), keep = sc ? sc.scrollTop : 0, keepTab = app._lastTab;
  var h;
  if (app.screen === 'slots') h = renderSlots();
  else if (app.screen === 'setup') h = renderSetup();
  else if (app.screen === 'end') h = renderEnd();
  else h = renderGame();
  root.innerHTML = h + modalHTML();
  var sc2 = document.getElementById('sc');
  if (sc2 && keepTab === app.tab) sc2.scrollTop = keep;
  app._lastTab = app.tab;
  renderMini();
}
function renderMini() {
  var m = app.st ? E.mini(app.st) : null, el = document.getElementById('mini');
  el.innerHTML = m ? '<b>D' + m.day + '</b><span>' + m.side + ' · ESC ' + m.esc + '</span><span>' + m.sector + '</span>' : '<b>U\'75</b><span>tap to open</span>';
}

/* ---------- actions ---------- */
function startTurn() { app.plan = newPlan(app.st); }
function openSlot(n, startAtEnd) {
  var d = readSlot(n);
  if (!d || !d.state) return false;
  app.slot = n; app.st = d.state; app.tab = 'orders';
  if (app.st.ended) app.screen = 'end'; else { app.screen = 'game'; startTurn(); }
  return true;
}
function doEnd() {
  var st = app.st;
  var rep = E.endTurn(st, app.plan);
  app.report = rep; app.modal = null;
  saveSlot();
  if (navigator.vibrate) try { navigator.vibrate(rep.nuke && rep.nuke.length ? [60, 40, 60] : 20); } catch (e) {}
}
document.addEventListener('click', function (ev) {
  var t = ev.target.closest('[data-act]');
  if (!t) return;
  var act = t.getAttribute('data-act'), id = t.getAttribute('data-id'), st = app.st;
  switch (act) {
    case 'close': if (window.NovaHost && window.NovaHost.close) window.NovaHost.close(); else if (window.U75.onClose) window.U75.onClose(); break;
    case 'home': saveSlot(); app.screen = 'slots'; app.st = null; break;
    case 'new': app.slot = +id; app.screen = 'setup'; break;
    case 'setside': app.setup.side = id; break;
    case 'setdiff': app.setup.diff = id; break;
    case 'setprep': app.setup.prep = +id; break;
    case 'start': app.st = E.newGame({ side: app.setup.side, diff: app.setup.diff, prep: app.setup.prep }); app.screen = 'game'; app.tab = 'orders'; startTurn(); saveSlot(); break;
    case 'cont': openSlot(+id); break;
    case 'reset': app.modal = { type: 'reset', n: +id }; break;
    case 'do-reset': Store.del(slotKey(app.modal.n)); app.modal = null; break;
    case 'cancel': app.modal = null; break;
    case 'tab': app.tab = id; break;
    case 'order': app.plan.order = id; break;
    case 'cease': app.plan.ceasefire = !app.plan.ceasefire; break;
    case 'rail': app.plan.rail = !app.plan.rail; break;
    case 'pol': app.plan.pol = app.plan.pol === id ? null : id; break;
    case 'nuke': app.plan.nuke = app.plan.nuke === id ? null : id; break;
    case 'buy': if (E.queueBuild(st, st.side, id, 1)) saveSlot(); break;
    case 'unbuy': if (E.cancelBuild(st, st.side, +id)) saveSlot(); break;
    case 'mini': window.U75.setMini(true); break;
    case 'end': {
      var n = app.plan.nuke && E.nukeOptions(st, st.side).filter(function (o) { return o.id === app.plan.nuke; })[0];
      if (n && n.lvl >= 3) {
        app.modal = { type: 'nuke', text: n.danger ? '<b class="bad">This reaches escalation level 5: MUTUAL RUIN.</b> The war ends and nobody wins.' : esc(n.name) + ' will devastate the target, shake your home front and alliance, and invite retaliation. Proceed?' };
      } else doEnd();
      break;
    }
    case 'confirm-end': doEnd(); break;
    case 'report-ok': {
      var ended = !!st.ended; app.report = null;
      if (ended) { app.screen = 'end'; saveSlot(); } else startTurn();
      break;
    }
  }
  render();
});

/* ---------- host API ---------- */
window.U75 = {
  version: '1.0',
  onClose: null,
  mini: function () { return E.mini(app.st); },
  setMini: function (b) { app.mini = !!b; document.body.classList.toggle('mini', !!b); renderMini(); },
  expand: function () { if (window.NovaHost && window.NovaHost.expand) window.NovaHost.expand(); window.U75.setMini(false); },
  open: function (n) { if (openSlot(n)) render(); }
};

/* ---------- boot ---------- */
(function boot() {
  var q = {};
  (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
  if (q.slot && openSlot(+q.slot)) { /* opened */ }
  if (q.mini === '1') window.U75.setMini(true);
  render();
})();
})();
