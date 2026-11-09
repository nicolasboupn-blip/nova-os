/* UNTHINKABLE '75 v2 - real-time war engine on the real Europe map (km grid).
   Pure JS, deterministic (seeded RNG stored in state), no DOM. Exports window.U75War / module.exports. */
(function (root) {
'use strict';
var MAP = root.U75MAP || (typeof require === 'function' ? null : null);
var VERSION = 2;

/* ============================================================ map decode + helpers */
var G = {}; // grid data (shared, not saved)
function decodeBits(b64, n) {
  var bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  var out = new Uint8Array(n);
  for (var i = 0; i < n; i++) out[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  return out;
}
function initMap(M) {
  MAP = M; G.w = M.gw; G.h = M.gh; G.cell = M.cell; G.n = G.w * G.h;
  G.bloc = new Uint8Array(G.n); var p = 0;
  for (var i = 0; i < M.grid.length; i += 2) { var v = M.grid[i], r = M.grid[i + 1]; for (var k = 0; k < r; k++) G.bloc[p++] = v; }
  G.bloc0_75 = new Uint8Array(G.bloc); G.bloc0 = G.bloc0_75; BLOCM = null;
  G.road = decodeBits(M.roadBits, G.n); G.rail = decodeBits(M.railBits, G.n);
  // rail graph is dilated by one cell so small gaps in the source data do not cut the network
  G.railD = new Uint8Array(G.n);
  for (var y = 0; y < G.h; y++) for (var x = 0; x < G.w; x++) if (G.rail[y * G.w + x])
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < G.w && ny < G.h && G.bloc[ny * G.w + nx]) G.railD[ny * G.w + nx] = 1;
    }
  // ships: open water plus a few narrow straits and canals that are thinner than one 8 km cell
  G.nav = new Uint8Array(G.n); for (var q = 0; q < G.n; q++) G.nav[q] = G.bloc[q] === 0 ? 1 : 0;
  STRAITS.forEach(function (ln) { for (var i = 0; i + 1 < ln.length; i++) { var a = ll(ln[i][0], ln[i][1]), b = ll(ln[i + 1][0], ln[i + 1][1]), n = Math.ceil(dist(a.x, a.y, b.x, b.y) / 3); for (var k = 0; k <= n; k++) { var x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n, c = cellOf(x, y); G.nav[c] = 1; } } });
  G.ready = true;
}
var STRAITS = [
  [[12.3, 56.3], [12.7, 56.0], [12.75, 55.6], [12.9, 55.2], [13.1, 54.9]],            // Oresund
  [[11.2, 56.1], [10.95, 55.6], [10.95, 55.2], [10.8, 54.8], [11.3, 54.4]],            // Great Belt
  [[9.0, 53.95], [9.4, 54.1], [9.9, 54.25], [10.2, 54.4]],                              // Kiel Canal
  [[29.1, 41.3], [29.05, 41.1], [28.95, 40.95], [28.4, 40.8]],                          // Bosphorus
  [[27.5, 40.55], [26.8, 40.35], [26.3, 40.05], [25.9, 40.0]]                           // Dardanelles
];
function cellOf(x, y) { var cx = Math.max(0, Math.min(G.w - 1, Math.floor(x / G.cell))), cy = Math.max(0, Math.min(G.h - 1, Math.floor(y / G.cell))); return cy * G.w + cx; }
function isLand(x, y) { return G.bloc[cellOf(x, y)] > 0; }
function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function ll(lon, lat) { return { x: (lon - MAP.lon0) * MAP.cx * MAP.km, y: (MAP.lat1 - lat) * MAP.km }; }
function toLL(x, y) { return { lon: x / (MAP.cx * MAP.km) + MAP.lon0, lat: MAP.lat1 - y / MAP.km }; }
function snapWater(x, y, maxr) {
  var c0 = cellOf(x, y); if (G.nav[c0]) return { x: x, y: y };
  var cx = c0 % G.w, cy = (c0 / G.w) | 0, R = Math.ceil((maxr || 40) / G.cell);
  for (var r = 1; r <= R; r++) {
    var best = -1, bd = 1e9;
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= G.w || ny >= G.h) continue;
      var ni = ny * G.w + nx; if (!G.nav[ni]) continue; var d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = ni; }
    }
    if (best >= 0) return { x: (best % G.w + .5) * G.cell, y: ((best / G.w | 0) + .5) * G.cell };
  }
  return null;
}
function snapLand(x, y) {
  if (isLand(x, y)) return { x: x, y: y };
  var c = cellOf(x, y), cx = c % G.w, cy = (c / G.w) | 0;
  for (var r = 1; r < 40; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= G.w || ny >= G.h) continue;
    if (G.bloc[ny * G.w + nx]) return { x: (nx + .5) * G.cell, y: (ny + .5) * G.cell };
  }
  return { x: x, y: y };
}

/* ============================================================ RNG */
function rnd(st) { var t = st.rs += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function rr(st, a, b) { return a + (b - a) * rnd(st); }

/* ============================================================ path finding (A* on the 8 km grid) */
function Heap() { this.a = []; }
Heap.prototype.push = function (k, v) { var a = this.a; a.push([k, v]); var i = a.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; var t = a[p]; a[p] = a[i]; a[i] = t; i = p; } };
Heap.prototype.pop = function () { var a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; var i = 0, n = a.length; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < n && a[l][0] < a[m][0]) m = l; if (r < n && a[r][0] < a[m][0]) m = r; if (m === i) break; var t = a[m]; a[m] = a[i]; a[i] = t; i = m; } } return top; };
Heap.prototype.size = function () { return this.a.length; };
var pathCache = {};
/* mode: 'g' ground (roads fast, off-road slow), 'r' rail (rail cells only). returns [{x,y}...] or null */
function findPath(mode, x0, y0, x1, y1) {
  var s = cellOf(x0, y0), t = cellOf(x1, y1), key = mode + s + '_' + t;
  if (pathCache[key]) return pathCache[key].map(function (p) { return { x: p.x, y: p.y }; });
  var W = G.w, N = G.n, cost = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  var tx = t % W, ty = (t / W) | 0, heap = new Heap();
  cost[s] = 0; heap.push(0, s); var guard = 0;
  while (heap.size() && guard++ < 400000) {
    var cur = heap.pop()[1]; if (done[cur]) continue; done[cur] = 1; if (cur === t) break;
    var cx = cur % W, cy = (cur / W) | 0;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= G.h) continue;
      var ni = ny * W + nx; if (done[ni] || (mode !== 'n' && !G.bloc[ni])) continue;
      var step = (dx && dy) ? 1.414 : 1, c;
      if (mode === 'n') { if (!G.nav[ni] && ni !== t) continue; c = step; }
      else if (mode === 'r') { if (!G.railD[ni] && ni !== t && ni !== s) continue; c = step; }
      else c = step * (G.road[ni] ? 1 : 4) * (G.bloc[ni] === 3 ? 6 : 1);
      var nc = cost[cur] + c; if (nc < cost[ni]) { cost[ni] = nc; prev[ni] = cur; var h = Math.max(Math.abs(nx - tx), Math.abs(ny - ty)) * (mode === 'r' ? 1 : 1); heap.push(nc + h, ni); }
    }
  }
  if (!done[t]) return null;
  var out = [], c2 = t; while (c2 !== -1) { out.push({ x: (c2 % W + .5) * G.cell, y: ((c2 / W | 0) + .5) * G.cell }); c2 = prev[c2]; }
  out.reverse();
  // thin: keep points where the direction changes
  var th = [out[0]];
  for (var i = 1; i < out.length - 1; i++) {
    var a = out[i - 1], b = out[i], c3 = out[i + 1];
    if ((b.x - a.x) * (c3.y - b.y) !== (b.y - a.y) * (c3.x - b.x)) th.push(b);
  }
  th.push({ x: x1, y: y1 }); th[0] = { x: x0, y: y0 };
  pathCache[key] = th; var n = 0; for (var k in pathCache) n++; if (n > 600) pathCache = {};
  return th.map(function (p) { return { x: p.x, y: p.y }; });
}

/* ============================================================ unit tables (1975 what-if) */
var U = {};
function def(id, o) { o.id = id; if (!o.era) o.era = '75'; U[id] = o; return o; }
function gnd(id, side, n, cls, sp, a, d, sight, cost, eta, tier, extra) {
  var o = { side: side, n: n, cls: cls, sp: sp, a: a, d: d, sight: sight, cost: cost, eta: eta, tier: tier, ground: true };
  if (extra) for (var k in extra) o[k] = extra[k]; return def(id, o);
}
function air(id, side, n, cls, sp, rad, a2a, a2g, cost, tier, roles, extra) {
  var o = { side: side, n: n, cls: cls, sp: sp, rad: rad, a2a: a2a, a2g: a2g, cost: cost, eta: 18, tier: tier, roles: roles, air: true, sight: 40 };
  if (extra) for (var k in extra) o[k] = extra[k]; return def(id, o);
}
function ship(id, side, n, cls, sp, o) {
  var d = { side: side, n: n, cls: cls, sp: sp, naval: true, sight: 30, sa: 0, d: 3, asw: 0, aaP: 0, shore: 0, rng: 25, cost: 8, eta: 36, tier: 1, radarA: 0 };
  for (var k in o) d[k] = o[k]; if (d.cvw) { d.a2g = d.cvw.a2g; d.a2a = d.cvw.a2a; d.rad = d.cvw.rad; d.aaP += d.cvw.a2a * 0.4; }
  d.eta = Math.round(d.eta); return def(id, d);
}
// ---- NATO ground
gnd('mech', 'NATO', 'Mechanized division (M113 / Marder)', 'gnd', 30, 5, 6, 10, 7, 12, 1, { org: 1.08 });
gnd('armor', 'NATO', 'Armored division (M60A1 / Leopard 1)', 'gnd', 34, 7, 6, 10, 10, 12, 1);
gnd('inf', 'NATO', 'Infantry / Jaeger division', 'gnd', 18, 3, 6, 9, 5, 8, 1, { org: 1.15 });
gnd('cav', 'NATO', 'Armored cavalry regiment', 'recon', 50, 3, 3, 22, 4, 6, 1);
gnd('arty', 'NATO', 'Artillery brigade (M109 / M110)', 'arty', 28, 4, 2, 10, 5, 8, 1, { rng: 28 });
gnd('aa', 'NATO', 'Air defense (Hawk / Roland)', 'aa', 26, 1, 2, 12, 5, 8, 1, { rng: 28, aaP: 5 });
gnd('mortar', 'NATO', 'Light artillery battalion (105 mm / mortars)', 'arty', 30, 3, 2, 10, 3, 4, 1, { rng: 16 });
gnd('eng', 'NATO', 'Combat engineers', 'eng', 28, 1, 3, 8, 3, 6, 1);
gnd('train', 'NATO', 'Supply train', 'train', 55, 0, 1, 6, 3, 6, 1, { cap: 60 });
gnd('convoy', 'NATO', 'Truck convoy', 'convoy', 45, 0, 1, 6, 2, 4, 1, { cap: 25 });
gnd('lance', 'NATO', 'Lance missile battalion', 'ssm', 30, 0, 2, 8, 8, 12, 2, { rng: 120, nuke: true, msl: 6, cdmg: 20, mname: 'Lance' });
gnd('pershing', 'NATO', 'Pershing missile battalion', 'ssm', 30, 0, 2, 8, 14, 16, 2, { rng: 740, nuke: true, msl: 4, cdmg: 28, mname: 'Pershing' });
gnd('ah1', 'NATO', 'Attack helicopters (AH-1 Cobra / Bo 105)', 'heli_atk', 220, 4, 2, 25, 8, 12, 1, { heli: true, rad: 160, a2g: 6, a2a: 1 });
gnd('ch47', 'NATO', 'Transport helicopters (CH-47 / UH-1)', 'heli_trans', 230, 0, 1, 25, 4, 8, 1, { heli: true, rad: 260, lift: 1 });
gnd('m113', 'NATO', 'APC battalion (M113 / Fuchs), carries 1 infantry unit', 'gnd', 42, 3, 4, 10, 5, 8, 1, { carry: 1, apc: true });
// ---- NATO air
air('f4', 'NATO', 'F-4E Phantom wing', 'fighter', 900, 700, 6, 6, 8, 1, ['cas', 'strike', 'cap'], { nuke: true });
air('f104', 'NATO', 'F-104G Starfighter wing', 'fighter', 950, 600, 4, 4, 5, 1, ['cas', 'strike', 'cap'], { nuke: true });
air('jag', 'NATO', 'Jaguar / Mirage III strike wing', 'strike', 850, 600, 2, 6, 6, 1, ['cas', 'strike']);
air('a7', 'NATO', 'A-7D Corsair II wing', 'strike', 800, 700, 2, 7, 6, 2, ['cas', 'strike']);
air('f111', 'NATO', 'F-111E strike wing', 'strike', 1200, 1400, 3, 9, 12, 2, ['strike', 'cas'], { nuke: true });
air('rf4', 'NATO', 'RF-4C recon wing', 'recon', 1100, 1200, 1, 0, 5, 1, ['recon']);
air('f15', 'NATO', 'F-15A Eagle wing', 'fighter', 1300, 900, 10, 4, 12, 3, ['cap', 'cas'], { note: 'Alt-history: the Eagle only entered service in 1976, Europe 1977.' });
air('b52', 'NATO', 'B-52 bomber wing', 'bomber', 800, 3000, 0, 14, 14, 3, ['strike', 'cas'], { nuke: true, note: 'Heavy bombers fly from far outside the theatre.' });
air('vulcan', 'NATO', 'Avro Vulcan B.2 bomber wing (RAF)', 'bomber', 900, 2800, 0, 11, 11, 1, ['strike'], { nuke: true, note: 'RAF V-bomber; real 1975 nuclear strike force.' });
air('ec121', 'NATO', 'EC-121 Warning Star AEW', 'awacs', 450, 1000, 0, 0, 6, 2, ['awacs'], { radar: 220, note: 'Real 1975 airborne early warning.' });
air('e3', 'NATO', 'E-3 Sentry AWACS', 'awacs', 700, 1500, 0, 0, 10, 3, ['awacs'], { radar: 400, note: 'Alt-history: the E-3 entered service in 1977.' });
air('kc135', 'NATO', 'KC-135 tanker', 'tanker', 800, 1500, 0, 0, 5, 1, ['tanker'], { note: 'Tankers extend NATO air range while they are based safely.' });
// ---- Pact ground
gnd('tank', 'PACT', 'Tank division (T-62 / T-72)', 'gnd', 34, 7, 5, 10, 9, 12, 1);
gnd('mot', 'PACT', 'Motor rifle division (BMP / BTR)', 'gnd', 30, 5, 5, 10, 6, 10, 1, { org: 1.1 });
gnd('gtank', 'PACT', 'Guards tank division (T-72)', 'gnd', 34, 8, 6, 10, 12, 14, 2);
gnd('vdv', 'PACT', 'Airborne division (VDV)', 'gnd', 24, 4, 5, 10, 6, 8, 1, { org: 1.12 });
gnd('brdm', 'PACT', 'Reconnaissance battalion (BRDM)', 'recon', 55, 3, 2, 22, 3, 6, 1);
gnd('party', 'PACT', 'Artillery brigade (2S1 / BM-21)', 'arty', 28, 5, 2, 10, 5, 8, 1, { rng: 28 });
gnd('paa', 'PACT', 'Air defense (SA-6 / ZSU-23-4)', 'aa', 26, 1, 2, 12, 5, 8, 1, { rng: 28, aaP: 6 });
gnd('pmortar', 'PACT', 'Light artillery battalion (D-30 / 120 mm mortars)', 'arty', 30, 3, 2, 10, 3, 4, 1, { rng: 16 });
gnd('peng', 'PACT', 'Combat engineers', 'eng', 28, 1, 3, 8, 3, 6, 1);
gnd('ptrain', 'PACT', 'Supply train', 'train', 55, 0, 1, 6, 3, 6, 1, { cap: 60 });
gnd('pconvoy', 'PACT', 'Truck convoy', 'convoy', 45, 0, 1, 6, 2, 4, 1, { cap: 25 });
gnd('frog', 'PACT', 'FROG-7 rocket battalion', 'ssm', 40, 0, 2, 8, 6, 8, 1, { rng: 70, nuke: true, msl: 8, cdmg: 16, mname: 'FROG-7' });
gnd('scud', 'PACT', 'Scud-B missile brigade', 'ssm', 30, 0, 2, 8, 9, 12, 2, { rng: 300, nuke: true, msl: 6, cdmg: 22, mname: 'Scud-B' });
gnd('ss12', 'PACT', 'SS-12 Scaleboard battalion', 'ssm', 30, 0, 2, 8, 14, 16, 3, { rng: 900, nuke: true, msl: 4, cdmg: 28, mname: 'SS-12' });
gnd('mi24', 'PACT', 'Attack helicopters (Mi-24 Hind)', 'heli_atk', 230, 5, 3, 25, 8, 12, 2, { heli: true, rad: 160, a2g: 7, a2a: 1 });
gnd('mi8', 'PACT', 'Transport helicopters (Mi-8)', 'heli_trans', 220, 0, 1, 25, 4, 8, 1, { heli: true, rad: 280, lift: 1 });
gnd('btr', 'PACT', 'BTR-60 / BTR-70 wheeled regiment, carries 1 infantry unit', 'gnd', 46, 4, 4, 10, 5, 8, 1, { carry: 1, apc: true });
// ---- Pact air
air('mig21', 'PACT', 'MiG-21 fighter wing', 'fighter', 900, 500, 5, 3, 4, 1, ['cap', 'cas']);
air('mig23', 'PACT', 'MiG-23 fighter wing', 'fighter', 1100, 700, 6, 5, 7, 2, ['cap', 'cas', 'strike'], { nuke: true });
air('su7', 'PACT', 'Su-7 / Su-17 ground attack wing', 'strike', 800, 500, 1, 6, 5, 1, ['cas', 'strike']);
air('su17', 'PACT', 'Su-17M strike wing', 'strike', 900, 700, 1, 7, 7, 2, ['cas', 'strike'], { nuke: true });
air('su24', 'PACT', 'Su-24 Fencer wing', 'strike', 1200, 1300, 2, 9, 12, 3, ['strike', 'cas'], { nuke: true });
air('mig25', 'PACT', 'MiG-25 Foxbat wing', 'fighter', 2200, 1000, 8, 1, 11, 3, ['cap', 'recon']);
air('tu16', 'PACT', 'Tu-16 Badger regiment', 'bomber', 800, 2500, 0, 10, 10, 2, ['strike'], { nuke: true });
air('tu22', 'PACT', 'Tu-22 Blinder regiment', 'bomber', 1400, 1800, 0, 11, 11, 2, ['strike'], { nuke: true, note: 'Supersonic Soviet bomber.' });
air('tu95', 'PACT', 'Tu-95 Bear regiment', 'bomber', 700, 4000, 0, 14, 14, 3, ['strike', 'cas'], { nuke: true, note: 'Heavy bomber, flies from deep inside the USSR.' });
air('tu126', 'PACT', 'Tu-126 Moss AWACS', 'awacs', 650, 1200, 0, 0, 8, 2, ['awacs'], { radar: 250, note: 'Soviet AWACS (1965-84), weak over land clutter.' });


// ---- NATO navy (real classes in service in 1975)
ship('forrestal', 'NATO', 'Forrestal-class carrier (US 6th Fleet)', 'carrier', 55, { d: 6, cvw: { a2g: 8, a2a: 5, rad: 550 }, aaP: 1, radarA: 150, cost: 18, eta: 72, tier: 1 });
ship('clemenceau', 'NATO', 'Clemenceau-class carrier (French Navy)', 'carrier', 55, { d: 5, cvw: { a2g: 6, a2a: 4, rad: 500 }, aaP: 1, radarA: 130, cost: 13, eta: 60, tier: 1 });
ship('arkroyal', 'NATO', 'HMS Ark Royal (last British fixed-wing carrier)', 'carrier', 55, { d: 5, cvw: { a2g: 6, a2a: 5, rad: 550 }, aaP: 1, radarA: 130, cost: 13, eta: 60, tier: 2, note: 'Phantoms and Buccaneers; retired in 1978.' });
ship('nimitz', 'NATO', 'Nimitz-class carrier (CVN-68)', 'carrier', 58, { d: 8, cvw: { a2g: 10, a2a: 7, rad: 600 }, aaP: 1.5, radarA: 180, cost: 22, eta: 96, tier: 3, note: 'Alt-history early: USS Nimitz was commissioned in May 1975 but did not deploy until 1977.' });
ship('belknap', 'NATO', 'Belknap-class cruiser (Terrier / ASROC)', 'cruiser', 59, { sa: 4, d: 4, asw: 3, aaP: 5, shore: 3, rng: 35, radarA: 120, cost: 11, eta: 48 });
ship('adams', 'NATO', 'Charles F. Adams-class destroyer (also Luetjens class)', 'destroyer', 61, { sa: 3, d: 3, asw: 2, aaP: 4, shore: 2, rng: 28, radarA: 90, cost: 8, eta: 36 });
ship('knox', 'NATO', 'Knox-class frigate (ASROC)', 'frigate', 52, { sa: 2, d: 2.5, asw: 4, aaP: 1, shore: 1.5, rng: 20, radarA: 60, cost: 5, eta: 30 });
ship('leander', 'NATO', 'Leander-class frigate (RN / Dutch / German types)', 'frigate', 52, { sa: 2, d: 2.5, asw: 3, aaP: 1.2, shore: 1.5, rng: 20, radarA: 60, cost: 5, eta: 30 });
ship('type42', 'NATO', 'Type 42 destroyer (Sheffield class)', 'destroyer', 59, { sa: 3, d: 3, asw: 2, aaP: 5.5, shore: 2, rng: 28, radarA: 110, cost: 8, eta: 40, tier: 2, note: 'Lead ship was just entering service.' });
ship('spruance', 'NATO', 'Spruance-class destroyer', 'destroyer', 59, { sa: 4, d: 3.5, asw: 5, aaP: 3, shore: 3.5, rng: 30, radarA: 110, cost: 10, eta: 48, tier: 3, note: 'Alt-history early: the lead ship was commissioned in September 1975.' });
ship('tiger', 'NATO', 'Type 148 Tiger-class missile boat (Exocet)', 'corvette', 74, { sa: 5, d: 1.2, rng: 40, radarA: 30, cost: 4, eta: 20, msl: 4, salvo: 2, mdmg: 24, mname: 'MM38 Exocet' });
ship('sturgeon', 'NATO', 'Sturgeon-class attack submarine (SSN)', 'sub_attack', 55, { sub: true, sa: 6, d: 3, asw: 3, rng: 20, sight: 15, cost: 12, eta: 72 });
ship('la688', 'NATO', 'Los Angeles-class attack submarine (SSN-688)', 'sub_attack', 60, { sub: true, sa: 7, d: 3.2, asw: 4, rng: 22, sight: 15, cost: 14, eta: 84, tier: 3, note: 'Alt-history early: USS Los Angeles was commissioned in November 1976.' });
ship('type206', 'NATO', 'Type 206 coastal submarine (West Germany)', 'sub_diesel', 30, { sub: true, sa: 4, d: 1.8, asw: 1, rng: 12, sight: 12, cost: 6, eta: 48 });
ship('kobben', 'NATO', 'Kobben-class coastal submarine (Norway / Denmark)', 'sub_diesel', 30, { sub: true, sa: 3.5, d: 1.8, asw: 1, rng: 12, sight: 12, cost: 5, eta: 44 });
ship('iwojima', 'NATO', 'Iwo Jima-class assault ship (LPH)', 'amphib', 40, { d: 3, lift: 2, aaP: 1, radarA: 60, cost: 9, eta: 48 });
ship('roro', 'NATO', 'RO-RO sealift ship (REFORGER)', 'transport', 33, { d: 1, lift: 3, cost: 6, eta: 24 });

// ---- Pact navy (Baltic and Black Sea fleets, East German and Polish navies)
ship('kiev', 'PACT', 'Kiev-class carrier (Yak-38)', 'carrier', 59, { d: 5, sa: 4, cvw: { a2g: 4, a2a: 3, rad: 300 }, aaP: 3, radarA: 140, rng: 90, cost: 18, eta: 90, tier: 3, msl: 8, salvo: 4, mdmg: 24, mname: 'SS-N-12 Sandbox', note: 'Alt-history early: Kiev was commissioned in December 1975; the Yak-38 is weak.' });
ship('moskva', 'PACT', 'Moskva-class helicopter cruiser (ASW)', 'cruiser', 52, { sa: 2, d: 3.5, asw: 5, aaP: 3, shore: 1.5, rng: 25, radarA: 100, cost: 10, eta: 48 });
ship('kara', 'PACT', 'Kara-class cruiser', 'cruiser', 61, { sa: 4, msl: 0, d: 4, asw: 5, aaP: 5, shore: 3, rng: 40, radarA: 120, cost: 11, eta: 54, tier: 2 });
ship('kresta', 'PACT', 'Kresta II-class cruiser', 'cruiser', 59, { sa: 4, d: 3.5, asw: 4, aaP: 4, shore: 2.5, rng: 35, radarA: 110, cost: 10, eta: 48, msl: 4, salvo: 2, mdmg: 22, mname: 'SS-N-3 Shaddock' });
ship('sverdlov', 'PACT', 'Sverdlov-class cruiser (152 mm guns)', 'cruiser', 59, { sa: 3, d: 4.5, asw: 0.5, aaP: 2, shore: 6, rng: 25, radarA: 70, cost: 8, eta: 40 });
ship('kashin', 'PACT', 'Kashin-class destroyer', 'destroyer', 61, { sa: 3, d: 3, asw: 3, aaP: 4, shore: 2, rng: 28, radarA: 90, cost: 8, eta: 36 });
ship('krivak', 'PACT', 'Krivak-class frigate (SS-N-14)', 'frigate', 59, { sa: 3.5, d: 2.5, asw: 4, aaP: 2, shore: 1.5, rng: 25, radarA: 70, cost: 6, eta: 32 });
ship('riga', 'PACT', 'Riga-class frigate', 'frigate', 52, { sa: 1.5, d: 2, asw: 1.5, aaP: 1, shore: 1.5, rng: 18, radarA: 45, cost: 3, eta: 20 });
ship('nanuchka', 'PACT', 'Nanuchka-class missile corvette (SS-N-9)', 'corvette', 61, { sa: 7, d: 1.5, rng: 110, radarA: 60, cost: 6, eta: 28, tier: 2, msl: 6, salvo: 3, mdmg: 26, mname: 'SS-N-9 Siren' });
ship('osa', 'PACT', 'Osa-class missile boat (SS-N-2 Styx)', 'corvette', 74, { sa: 5, d: 1, rng: 45, radarA: 30, cost: 3, eta: 16, msl: 4, salvo: 2, mdmg: 22, mname: 'SS-N-2 Styx' });
ship('foxtrot', 'PACT', 'Foxtrot-class submarine', 'sub_diesel', 30, { sub: true, sa: 4, d: 2, asw: 1, rng: 15, sight: 12, cost: 5, eta: 40 });
ship('charlie', 'PACT', 'Charlie-class SSGN (anti-ship missiles)', 'sub_attack', 50, { sub: true, sa: 7, d: 2.5, asw: 1.5, rng: 55, sight: 14, cost: 12, eta: 72, tier: 2, msl: 8, salvo: 4, mdmg: 26, mname: 'SS-N-7 Siren' });
ship('victor', 'PACT', 'Victor-class attack submarine (SSN)', 'sub_attack', 61, { sub: true, sa: 6, d: 3, asw: 4, rng: 20, sight: 15, cost: 12, eta: 72, tier: 2 });
ship('alligator', 'PACT', 'Alligator-class landing ship', 'amphib', 33, { d: 2.5, lift: 2, aaP: 0.5, radarA: 30, cost: 7, eta: 36 });
ship('ropucha', 'PACT', 'Ropucha-class landing ship', 'amphib', 40, { d: 3, lift: 3, aaP: 1, radarA: 40, cost: 9, eta: 44, tier: 2 });
ship('sovtrans', 'PACT', 'Merchant sealift ship', 'transport', 33, { d: 1, lift: 3, cost: 6, eta: 24 });

var ERA = '75';
function setStance(st, ids, v) { var n = 0; st.units.forEach(function (u) { if (ids.indexOf(u.id) >= 0 && u.side === st.side && (U[u.type].ground || U[u.type].naval)) { u.stance = v; n++; } }); return n; }
function setEra(e) { ERA = e || '75'; G.bloc0 = ERA === 'm' ? blocModern() : G.bloc0_75; }
/* ============================================================ MODERN ERA (2027): NATO vs Russia / Belarus */
function mg(id, side, n, cls, sp, a, d, sight, cost, eta, tier, extra) { extra = extra || {}; extra.era = 'm'; return gnd(id, side, n, cls, sp, a, d, sight, cost, eta, tier, extra); }
function ma(id, side, n, cls, sp, rad, a2a, a2g, cost, tier, roles, extra) { extra = extra || {}; extra.era = 'm'; return air(id, side, n, cls, sp, rad, a2a, a2g, cost, tier, roles, extra); }
function ms(id, side, n, cls, sp, o) { o.era = 'm'; return ship(id, side, n, cls, sp, o); }
// ---- NATO
mg('m_leo', 'NATO', 'Leopard 2A7 armored brigade', 'gnd', 36, 10, 8, 12, 11, 12, 1, { org: 1.1 });
mg('m_abrams', 'NATO', 'M1A2 SEPv3 Abrams brigade', 'gnd', 36, 10, 9, 12, 12, 14, 1, { org: 1.1 });
mg('m_chall', 'NATO', 'Challenger 3 battlegroup', 'gnd', 34, 9, 9, 12, 11, 12, 1, { org: 1.1 });
mg('m_puma', 'NATO', 'Puma / CV90 mechanized brigade', 'gnd', 34, 7, 7, 11, 8, 10, 1, { org: 1.08 });
mg('m_stryker', 'NATO', 'Stryker brigade combat team', 'gnd', 42, 6, 5, 10, 7, 8, 1);
mg('m_boxer', 'NATO', 'Boxer / Patria wheeled APC brigade, carries 1 infantry unit', 'gnd', 48, 5, 5, 10, 6, 8, 1, { carry: 1, apc: true });
mg('m_inf', 'NATO', 'Light infantry brigade (Javelin / NLAW)', 'gnd', 18, 3, 6, 9, 5, 8, 1, { org: 1.15 });
mg('m_fpv', 'NATO', 'FPV drone company', 'gnd', 40, 5, 1, 9, 3, 4, 1, { note: 'Cheap, fragile, deadly at short range.' });
mg('m_recon', 'NATO', 'Reconnaissance squadron (Boxer / Fennek)', 'recon', 55, 3, 2, 24, 4, 6, 1);
mg('m_pzh', 'NATO', 'PzH 2000 / K9 / Archer battalion', 'arty', 34, 9, 2, 12, 7, 10, 1, { rng: 40 });
mg('m_himars', 'NATO', 'HIMARS / ATACMS battery', 'ssm', 50, 0, 2, 10, 9, 12, 1, { rng: 300, msl: 6, cdmg: 24, mname: 'GMLRS / ATACMS' });
mg('m_pat', 'NATO', 'Patriot PAC-3 battery', 'aa', 26, 1, 2, 14, 9, 10, 1, { rng: 100, aaP: 9 });
mg('m_iris', 'NATO', 'IRIS-T SLM / NASAMS battery', 'aa', 30, 1, 2, 12, 6, 8, 1, { rng: 45, aaP: 6 });
mg('m_shorad', 'NATO', 'Skyranger / Gepard SHORAD', 'aa', 40, 1, 2, 10, 4, 6, 1, { rng: 14, aaP: 4 });
mg('m_ah64', 'NATO', 'AH-64E Apache squadron', 'heli_atk', 240, 6, 3, 28, 10, 14, 1, { heli: true, rad: 200, a2g: 9, a2a: 2 });
mg('m_ch47', 'NATO', 'CH-47F / NH90 transport helicopters', 'heli_trans', 240, 0, 1, 25, 4, 8, 1, { heli: true, rad: 280, lift: 1 });
ma('typhoon', 'NATO', 'Eurofighter Typhoon wing', 'fighter', 1300, 1000, 11, 6, 12, 1, ['cap', 'cas', 'strike']);
ma('f35', 'NATO', 'F-35A Lightning II wing', 'fighter', 1200, 1100, 9, 10, 15, 1, ['cap', 'cas', 'strike'], { nuke: true, note: 'Stealthy. Carries the B61 nuclear bomb.' });
ma('f16', 'NATO', 'F-16C/D Fighting Falcon wing', 'fighter', 1200, 900, 8, 7, 8, 1, ['cap', 'cas', 'strike'], { nuke: true });
ma('rafale', 'NATO', 'Rafale wing', 'fighter', 1300, 1000, 9, 8, 11, 1, ['cap', 'cas', 'strike'], { nuke: true });
ma('gripen', 'NATO', 'Gripen E wing', 'fighter', 1200, 850, 8, 6, 8, 1, ['cap', 'cas', 'strike']);
ma('f15e', 'NATO', 'F-15E Strike Eagle wing', 'strike', 1300, 1300, 6, 11, 13, 1, ['strike', 'cas'], { nuke: true });
ma('a10', 'NATO', 'A-10C Thunderbolt II wing', 'strike', 600, 500, 1, 10, 7, 1, ['cas']);
ma('m_b1', 'NATO', 'B-1B Lancer wing', 'bomber', 1200, 3500, 0, 16, 16, 1, ['strike', 'cas'], { note: 'Heavy conventional bomber with long-range missiles.' });
ma('m_b52', 'NATO', 'B-52H Stratofortress wing (JASSM)', 'bomber', 800, 3500, 0, 15, 15, 1, ['strike', 'cas'], { nuke: true });
ma('e7', 'NATO', 'E-7 Wedgetail / GlobalEye AEW', 'awacs', 700, 1500, 0, 0, 10, 1, ['awacs'], { radar: 450 });
ma('kc46', 'NATO', 'KC-46 / A330 MRTT tanker', 'tanker', 800, 1800, 0, 0, 5, 1, ['tanker'], { note: 'Tankers extend NATO air range while they are based safely.' });
ma('mq9', 'NATO', 'MQ-9B SkyGuardian drone wing', 'recon', 300, 1200, 0, 4, 5, 1, ['recon', 'cas'], { note: 'Armed drone: sees far and can strike ground targets.' });
ma('rq4', 'NATO', 'RQ-4 Global Hawk', 'recon', 600, 3000, 0, 0, 8, 1, ['recon']);
ms('m_burke', 'NATO', 'Arleigh Burke-class destroyer (Aegis)', 'destroyer', 59, { sa: 4, d: 4, asw: 5, aaP: 9, shore: 3.5, rng: 35, radarA: 160, cost: 11, eta: 48, msl: 8, salvo: 2, mdmg: 22, mname: 'Harpoon / NSM' });
ms('m_fremm', 'NATO', 'FREMM / Type 26 frigate', 'frigate', 52, { sa: 3, d: 3, asw: 5, aaP: 6, shore: 2, rng: 28, radarA: 110, cost: 8, eta: 36, msl: 4, salvo: 2, mdmg: 20, mname: 'Exocet / NSM' });
ms('m_visby', 'NATO', 'Visby / Skjold missile corvette', 'corvette', 74, { sa: 5, d: 1.5, rng: 55, radarA: 40, cost: 5, eta: 24, msl: 4, salvo: 2, mdmg: 22, mname: 'NSM' });
ms('m_astute', 'NATO', 'Astute / Virginia-class attack submarine', 'sub_attack', 60, { sub: true, sa: 7, d: 3.2, asw: 5, rng: 25, sight: 16, cost: 14, eta: 84 });
// ---- Russia / Belarus
mg('r_t90', 'PACT', 'T-90M tank division', 'gnd', 36, 9, 8, 12, 10, 12, 1, { org: 1.05 });
mg('r_t72', 'PACT', 'Motor rifle division (T-72B3 / BMP-3)', 'gnd', 34, 7, 6, 11, 7, 10, 1);
mg('r_t14', 'PACT', 'T-14 Armata guards tank division', 'gnd', 38, 11, 9, 12, 14, 18, 3, { note: 'Few built; arrives late if at all.' });
mg('r_vdv', 'PACT', 'VDV airborne division', 'gnd', 28, 5, 5, 10, 7, 10, 1, { org: 1.12 });
mg('r_btr', 'PACT', 'BTR-82A wheeled motor rifle brigade, carries 1 infantry unit', 'gnd', 48, 5, 5, 10, 5, 8, 1, { carry: 1, apc: true });
mg('r_lancet', 'PACT', 'Lancet / Orlan drone company', 'gnd', 40, 5, 1, 10, 3, 4, 1);
mg('r_recon', 'PACT', 'Reconnaissance / Spetsnaz battalion', 'recon', 55, 3, 2, 24, 4, 6, 1);
mg('r_msta', 'PACT', '2S19 Msta-S artillery brigade', 'arty', 34, 8, 2, 12, 7, 10, 1, { rng: 30 });
mg('r_tos', 'PACT', 'TOS-1A thermobaric battalion', 'arty', 35, 12, 2, 10, 8, 10, 1, { rng: 15 });
mg('r_tornado', 'PACT', 'Tornado-S MLRS brigade', 'arty', 40, 10, 2, 12, 9, 12, 1, { rng: 70 });
mg('r_isk', 'PACT', 'Iskander-M missile brigade', 'ssm', 50, 0, 2, 10, 10, 12, 1, { rng: 500, nuke: true, msl: 6, cdmg: 26, mname: 'Iskander-M' });
mg('r_geran', 'PACT', 'Geran-2 (Shahed) drone battery', 'ssm', 45, 0, 1, 8, 5, 6, 1, { rng: 600, msl: 12, cdmg: 12, mname: 'Geran-2' });
mg('r_s400', 'PACT', 'S-400 battery', 'aa', 30, 1, 2, 14, 12, 12, 1, { rng: 150, aaP: 11 });
mg('r_s300', 'PACT', 'S-300V4 battery', 'aa', 30, 1, 2, 14, 9, 10, 1, { rng: 120, aaP: 9 });
mg('r_pantsir', 'PACT', 'Pantsir-S1 / Tor-M2', 'aa', 40, 1, 2, 10, 5, 6, 1, { rng: 25, aaP: 6 });
mg('r_ka52', 'PACT', 'Ka-52 / Mi-28 attack helicopters', 'heli_atk', 240, 5, 3, 25, 9, 12, 1, { heli: true, rad: 180, a2g: 8, a2a: 1 });
mg('r_mi8', 'PACT', 'Mi-8 transport helicopters', 'heli_trans', 220, 0, 1, 25, 4, 8, 1, { heli: true, rad: 280, lift: 1 });
ma('su35', 'PACT', 'Su-35S fighter wing', 'fighter', 1500, 1000, 10, 6, 12, 1, ['cap', 'cas']);
ma('su34', 'PACT', 'Su-34 Fullback wing', 'strike', 1200, 1300, 3, 11, 12, 1, ['strike', 'cas'], { nuke: true });
ma('su57', 'PACT', 'Su-57 Felon wing', 'fighter', 1600, 1200, 11, 8, 16, 3, ['cap', 'cas', 'strike'], { note: 'Very few built; arrives late.' });
ma('mig31', 'PACT', 'MiG-31 Foxhound wing', 'fighter', 2200, 1100, 8, 3, 11, 1, ['cap']);
ma('tu22m', 'PACT', 'Tu-22M3 Backfire regiment', 'bomber', 1500, 2400, 0, 13, 13, 1, ['strike', 'cas'], { nuke: true });
ma('tu160', 'PACT', 'Tu-160 Blackjack regiment', 'bomber', 1500, 3500, 0, 16, 18, 3, ['strike', 'cas'], { nuke: true });
ma('a50', 'PACT', 'A-50U Mainstay AEW', 'awacs', 650, 1400, 0, 0, 9, 1, ['awacs'], { radar: 400 });
ma('orion', 'PACT', 'Orion / Forpost drone wing', 'recon', 200, 1000, 0, 3, 5, 1, ['recon', 'cas']);
ms('r_karakurt', 'PACT', 'Karakurt-class missile corvette (Kalibr)', 'corvette', 74, { sa: 6, d: 2, rng: 110, radarA: 60, cost: 6, eta: 28, msl: 8, salvo: 4, mdmg: 24, mname: 'Kalibr / P-800' });
ms('r_gorshkov', 'PACT', 'Admiral Gorshkov-class frigate', 'frigate', 59, { sa: 5, d: 3, asw: 4, aaP: 6, shore: 2, rng: 60, radarA: 110, cost: 9, eta: 40, msl: 8, salvo: 4, mdmg: 24, mname: 'Kalibr / Zircon' });
ms('r_kilo', 'PACT', 'Kilo-class submarine (Kalibr)', 'sub_diesel', 30, { sub: true, sa: 5, d: 2, asw: 1, rng: 40, sight: 12, cost: 7, eta: 48, msl: 4, salvo: 2, mdmg: 22, mname: 'Kalibr' });
// ---- era-neutral support units
['eng', 'peng', 'train', 'ptrain', 'convoy', 'pconvoy'].forEach(function (k) { if (U[k]) U[k].era = 'b'; });
// ---- boarding: foot infantry can ride in carriers (APC / BTR units and truck convoys)
['inf', 'vdv', 'eng', 'peng', 'm_inf', 'r_vdv'].forEach(function (k) { if (U[k]) U[k].foot = true; });
['convoy', 'pconvoy'].forEach(function (k) { if (U[k]) U[k].carry = 1; });
// ---- one-shot SAMs: a launch kills a whole aircraft unit (Patriot, S-300, S-400). Limited missiles, reload near a friendly city.
var SAM_CD = 3;   // minutes between launches of one battery
[['m_pat', 6, 'PAC-3'], ['r_s300', 6, 'S-300 missile'], ['r_s400', 8, '48N6 / 40N6']].forEach(function (s) { if (U[s[0]]) { U[s[0]].kill1 = true; U[s[0]].msl = s[1]; U[s[0]].mname = s[2]; } });
var NATO_ISO = 'ALB BEL BGR CAN HRV CZE DNK EST FIN FRA DEU GRC HUN ISL ITA LVA LTU LUX MNE NLD MKD NOR POL PRT ROU SVK SVN ESP SWE TUR GBR USA'.split(' ');
function ownerM(iso) { return NATO_ISO.indexOf(iso) >= 0 ? 'NATO' : (iso === 'RUS' || iso === 'BLR') ? 'PACT' : 'NEUT'; }
var BLOCM = null;
function blocModern() {
  if (BLOCM && BLOCM.n === G.n) return BLOCM.a;
  var sites = []; MAP.cities.forEach(function (c) { sites.push([c[1], c[2], ownerM(c[4])]); }); MAP.air.forEach(function (a) { sites.push([a[2], a[3], ownerM(a[7])]); });
  var out = new Uint8Array(G.bloc0_75), code = { NATO: 1, PACT: 2, NEUT: 3 };
  for (var y = 0; y < G.h; y += 2) for (var x = 0; x < G.w; x += 2) {
    var k = y * G.w + x; if (!G.bloc0_75[k]) continue;
    var px = (x + 1) * G.cell, py = (y + 1) * G.cell, bd = 1e12, bo = 'NEUT';
    for (var s = 0; s < sites.length; s++) { var dx = sites[s][0] - px, dy = sites[s][1] - py, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bo = sites[s][2]; } }
    var cv = code[bo];
    for (var j = 0; j < 2; j++) for (var i = 0; i < 2; i++) { var xx = x + i, yy = y + j; if (xx < G.w && yy < G.h && G.bloc0_75[yy * G.w + xx]) out[yy * G.w + xx] = cv; }
  }
  BLOCM = { n: G.n, a: out }; return out;
}
var OOB_M = {
  NATO: {
    ground: [
      [23.2, 54.0, 'm_leo'], [22.9, 54.1, 'm_inf'], [23.9, 54.9, 'm_abrams'], [25.3, 54.7, 'm_puma'], [25.6, 54.3, 'm_inf'], [24.8, 55.6, 'm_chall'],
      [24.1, 56.9, 'm_puma'], [26.0, 57.3, 'm_inf'], [24.7, 59.3, 'm_inf'], [26.7, 58.4, 'm_chall'], [27.5, 59.0, 'm_inf'],
      [23.2, 53.1, 'm_abrams'], [22.6, 53.4, 'm_leo'], [21.6, 53.6, 'm_puma'], [20.6, 53.8, 'm_stryker'], [21.0, 52.2, 'm_abrams'], [23.6, 51.9, 'm_puma'], [22.6, 51.2, 'm_leo'], [22.0, 50.0, 'm_stryker'],
      [19.5, 52.0, 'm_leo'], [18.6, 54.2, 'm_inf'], [16.9, 52.4, 'm_abrams'], [17.0, 51.1, 'm_puma'], [14.5, 53.4, 'm_leo'], [13.4, 52.5, 'm_chall'],
      [24.1, 52.8, 'm_recon'], [25.0, 55.0, 'm_recon'], [24.4, 57.3, 'm_recon'], [22.3, 53.0, 'm_fpv'], [23.6, 54.3, 'm_fpv'], [25.7, 54.6, 'm_fpv'], [24.6, 56.4, 'm_fpv'],
      [23.0, 53.3, 'm_pzh'], [22.4, 53.9, 'm_pzh'], [24.4, 54.9, 'm_pzh'], [25.2, 54.2, 'm_pzh'], [24.2, 56.6, 'm_pzh'], [25.9, 58.3, 'm_pzh'], [21.4, 52.6, 'm_pzh'], [22.0, 51.6, 'm_pzh'], [23.4, 52.4, 'm_pzh'],
      [22.6, 52.9, 'm_himars'], [24.7, 54.9, 'm_himars'], [24.9, 56.9, 'm_himars'], [22.0, 52.0, 'm_himars'], [25.5, 59.0, 'm_himars'],
      [21.0, 52.1, 'm_pat'], [23.3, 52.3, 'm_pat'], [24.7, 54.8, 'm_iris'], [24.1, 56.8, 'm_iris'], [23.2, 53.0, 'm_shorad'], [25.2, 54.3, 'm_shorad'], [24.7, 59.3, 'm_iris'], [18.7, 54.3, 'm_pat'],
      [22.5, 53.2, 'm_boxer'], [24.0, 54.6, 'm_boxer'], [21.3, 52.6, 'm_boxer'], [25.1, 55.2, 'm_boxer'],
      [23.0, 52.0, 'eng'], [24.5, 55.0, 'eng'], [23.4, 53.3, 'm_ah64'], [24.9, 54.7, 'm_ah64'], [23.0, 52.3, 'm_ch47'],
      [21.5, 52.2, 'train'], [22.7, 52.0, 'train'], [20.0, 52.3, 'convoy'], [22.0, 53.2, 'convoy'], [24.1, 55.0, 'convoy']
    ],
    air: [
      [21.0, 52.17, 'typhoon', 2], [21.9, 50.1, 'f35', 2], [20.9, 52.3, 'f16', 2], [18.5, 54.4, 'gripen'], [23.1, 53.1, 'f16'], [16.9, 52.4, 'f35'], [23.3, 54.9, 'typhoon'], [21.0, 56.4, 'f15e'], [24.9, 59.3, 'typhoon'],
      [11.0, 49.5, 'f15e'], [0.5, 52.4, 'm_b52'], [-1.2, 51.9, 'm_b1'], [14.2, 52.0, 'e7'], [8.6, 50.0, 'kc46'], [21.8, 50.1, 'mq9'], [22.9, 52.9, 'rq4'], [23.3, 51.2, 'a10'], [13.3, 51.8, 'rafale'], [10.2, 53.0, 'typhoon']
    ]
  },
  PACT: {
    ground: [
      [23.8, 53.7, 'r_t72'], [23.7, 52.1, 'r_t90'], [24.5, 53.0, 'r_t72'], [26.0, 53.1, 'r_t90'], [27.6, 53.9, 'r_t72'], [25.3, 54.0, 'r_vdv'], [26.5, 54.8, 'r_t72'], [28.2, 55.0, 'r_vdv'],
      [20.5, 54.7, 'r_t72'], [20.7, 54.6, 'r_t90'], [21.4, 54.4, 'r_vdv'], [28.3, 57.8, 'r_t72'], [29.5, 57.0, 'r_t90'], [30.2, 55.2, 'r_t72'], [31.0, 53.4, 'r_t90'], [32.0, 54.8, 'r_t72'], [33.0, 53.0, 'r_t72'],
      [24.0, 53.3, 'r_t72'], [25.0, 52.8, 'r_t90'], [26.8, 52.2, 'r_t72'], [30.0, 52.5, 'r_t90'], [28.7, 53.0, 'r_vdv'], [34.0, 55.0, 'r_t14'], [34.4, 53.3, 'r_t90'],
      [24.2, 53.6, 'r_recon'], [25.5, 53.9, 'r_recon'], [20.6, 54.5, 'r_recon'], [23.5, 52.9, 'r_lancet'], [24.7, 53.5, 'r_lancet'], [21.0, 54.5, 'r_lancet'], [26.2, 54.3, 'r_lancet'],
      [24.0, 53.5, 'r_msta'], [23.8, 52.6, 'r_msta'], [25.2, 53.4, 'r_msta'], [26.5, 53.7, 'r_msta'], [20.6, 54.6, 'r_msta'], [28.0, 54.6, 'r_msta'], [27.2, 53.0, 'r_msta'], [29.0, 56.8, 'r_msta'], [24.7, 52.8, 'r_msta'],
      [24.2, 53.2, 'r_tos'], [24.6, 53.9, 'r_tos'], [23.9, 52.4, 'r_tornado'], [25.6, 53.0, 'r_tornado'], [26.5, 55.3, 'r_tornado'], [20.9, 54.8, 'r_tornado'],
      [21.2, 54.5, 'r_isk'], [24.6, 53.5, 'r_isk'], [28.4, 55.2, 'r_isk'], [30.4, 53.0, 'r_isk'], [27.8, 53.9, 'r_geran'], [31.0, 54.5, 'r_geran'], [20.8, 54.7, 'r_geran'],
      [20.5, 54.7, 'r_s400'], [27.6, 53.9, 'r_s400'], [23.9, 53.6, 'r_s300'], [31.0, 52.4, 'r_s400'], [24.4, 52.1, 'r_s300'], [20.9, 54.5, 'r_pantsir'], [24.0, 53.7, 'r_pantsir'], [26.0, 53.0, 'r_pantsir'], [28.3, 57.8, 'r_s300'],
      [24.3, 53.6, 'r_btr'], [25.4, 53.8, 'r_btr'], [26.8, 53.4, 'r_btr'], [21.1, 54.5, 'r_btr'], [27.9, 54.4, 'r_btr'],
      [24.5, 53.4, 'peng'], [26.4, 54.1, 'peng'], [24.3, 53.1, 'r_ka52'], [25.8, 53.9, 'r_ka52'], [24.0, 53.0, 'r_mi8'],
      [25.5, 53.5, 'ptrain'], [24.9, 53.0, 'ptrain'], [26.4, 53.2, 'pconvoy'], [24.0, 53.9, 'pconvoy'], [27.5, 54.0, 'pconvoy']
    ],
    air: [
      [27.5, 53.86, 'su35', 2], [26.1, 53.1, 'su34', 2], [23.7, 53.7, 'su35'], [20.6, 54.9, 'su34'], [20.5, 54.7, 'mig31'], [28.3, 57.8, 'su35'], [30.5, 53.2, 'su34'], [29.8, 55.3, 'mig31'],
      [31.0, 52.4, 'tu22m', 2], [34.4, 53.3, 'su34'], [32.0, 54.8, 'su35'], [28.0, 53.9, 'a50'], [25.0, 53.0, 'orion'], [26.0, 54.5, 'orion'], [30.3, 59.9, 'su35']
    ]
  }
};
var NAVY_M = {
  NATO: [[18.9, 54.9, 'm_burke'], [19.5, 55.5, 'm_fremm'], [19.0, 55.7, 'm_fremm'], [17.5, 55.5, 'm_visby', 2], [22.5, 57.0, 'm_visby'], [18.2, 56.2, 'm_astute'], [23.0, 58.5, 'm_fremm'], [20.0, 56.3, 'm_burke']],
  PACT: [[19.7, 55.0, 'r_gorshkov'], [20.2, 55.2, 'r_karakurt', 2], [19.4, 54.8, 'r_karakurt'], [20.0, 55.0, 'r_kilo'], [28.6, 59.9, 'r_karakurt'], [29.5, 60.0, 'r_gorshkov'], [28.0, 59.8, 'r_kilo']]
};

function unitsFor(side, tier) { return Object.keys(U).filter(function (k) { return U[k].side === side && U[k].tier <= tier && (U[k].era === ERA || U[k].era === 'b'); }); }
var OTHER = { NATO: 'PACT', PACT: 'NATO' };
var OWN = { 1: 'NATO', 2: 'PACT', 3: 'NEUT', 0: null };

/* ============================================================ starting forces: [lon, lat, type, count] */
var NAVY = {
  NATO: [[14.0, 38.6, 'forrestal'], [14.6, 38.9, 'belknap'], [13.5, 38.7, 'adams'], [14.2, 38.1, 'knox'], [13.0, 38.2, 'sturgeon'], [13.8, 38.0, 'iwojima'], [6.0, 41.6, 'clemenceau'], [5.5, 41.9, 'adams'],
    [0.5, 56.8, 'arkroyal'], [1.0, 55.8, 'leander'], [2.0, 53.8, 'leander'], [4.2, 52.1, 'leander'], [10.5, 54.6, 'adams'], [11.0, 54.7, 'tiger', 2], [10.6, 54.5, 'type206'], [8.0, 54.3, 'type206'], [9.0, 54.0, 'leander'],
    [11.5, 55.3, 'kobben'], [5.0, 60.0, 'kobben'], [5.1, 60.3, 'tiger', 2], [25.0, 38.0, 'adams'], [28.0, 40.9, 'knox'], [-3.5, 49.8, 'roro', 2]],
  PACT: [[19.3, 54.9, 'sverdlov'], [19.0, 55.2, 'kresta'], [18.8, 55.5, 'kashin'], [20.0, 55.3, 'kashin'], [19.5, 54.9, 'krivak'], [17.5, 55.0, 'krivak'], [12.3, 54.4, 'riga', 2], [12.5, 54.5, 'osa', 3], [18.6, 54.8, 'osa', 2],
    [18.9, 55.0, 'foxtrot'], [17.7, 55.2, 'foxtrot'], [19.7, 55.1, 'nanuchka'], [19.6, 54.9, 'alligator', 2], [30.5, 43.8, 'moskva'], [31.5, 43.3, 'kashin'], [32.0, 44.0, 'krivak'], [31.0, 44.5, 'osa', 2], [31.0, 43.0, 'foxtrot', 2]]
};
var OOB = {
  NATO: {
    ground: [
      [10.1, 54.3, 'inf'], [10.0, 53.55, 'mech'], [9.5, 56.0, 'inf'], [12.5, 55.7, 'inf'], [9.7, 52.4, 'mech'], [9.1, 52.3, 'armor'], [8.5, 52.0, 'armor'], [8.3, 52.1, 'mech'], [7.6, 51.9, 'armor'], [7.9, 51.6, 'mech'],
      [6.9, 50.9, 'mech'], [5.9, 51.0, 'inf'], [9.9, 51.4, 'cav'], [9.7, 50.55, 'cav'], [9.3, 51.3, 'mech'], [8.7, 50.1, 'armor'], [9.2, 50.2, 'mech'], [8.3, 49.9, 'mech'], [7.6, 50.35, 'armor'],
      [11.0, 49.45, 'armor'], [12.1, 49.4, 'cav'], [11.9, 49.0, 'mech'], [9.2, 48.8, 'armor'], [10.0, 48.4, 'mech'], [11.6, 48.1, 'inf'], [10.5, 47.9, 'inf'],
      [7.75, 48.6, 'armor'], [6.2, 49.1, 'mech'], [4.8, 49.0, 'mech'], [10.99, 45.4, 'inf'], [13.2, 46.0, 'inf'], [24.4, 41.1, 'inf'], [26.5, 41.7, 'mech'],
      [9.9, 51.0, 'arty'], [8.9, 50.4, 'arty'], [8.4, 52.3, 'arty'], [11.3, 49.2, 'arty'], [9.0, 48.7, 'arty'],
      [9.4, 51.0, 'arty'], [10.3, 50.3, 'arty'], [10.0, 49.6, 'arty'], [9.5, 52.0, 'arty'], [8.6, 50.7, 'arty'], [10.6, 51.6, 'arty'], [10.9, 49.9, 'arty'], [9.8, 52.6, 'arty'], [7.9, 50.5, 'arty'], [11.7, 48.9, 'arty'],
      [9.6, 51.6, 'armor'], [10.4, 51.2, 'armor'], [9.9, 50.2, 'armor'], [10.3, 49.8, 'armor'], [9.0, 51.1, 'armor'], [10.6, 52.1, 'armor'], [9.7, 52.8, 'armor'], [10.6, 49.0, 'armor'], [9.4, 50.8, 'armor'], [8.6, 49.6, 'armor'], [10.1, 51.8, 'armor'], [11.0, 50.2, 'armor'],
      [9.8, 51.1, 'm113'], [10.1, 52.0, 'm113'], [9.3, 50.6, 'm113'], [11.0, 49.1, 'm113'], [8.4, 50.9, 'm113'],
      [8.9, 50.0, 'aa'], [8.0, 51.8, 'aa'], [10.2, 52.8, 'aa'], [7.3, 49.9, 'aa'], [11.5, 49.7, 'aa'],
      [9.7, 50.6, 'eng'], [8.7, 51.8, 'eng'], [8.8, 49.4, 'ah1'], [8.8, 51.7, 'ah1'], [10.8, 49.3, 'ah1'], [8.5, 50.0, 'ch47'],
      [7.6, 49.4, 'train'], [7.3, 51.0, 'train'], [8.6, 50.0, 'convoy'], [8.0, 51.4, 'convoy'], [11.0, 49.5, 'convoy']
    ],
    air: [
      [7.6, 49.44, 'f4', 2], [6.7, 49.97, 'f4', 2], [6.56, 49.95, 'f4'], [7.26, 49.95, 'f104'], [7.4, 49.21, 'rf4'], [8.57, 50.03, 'kc135'], [6.1, 51.2, 'jag', 2], [6.14, 51.6, 'jag'], [6.04, 50.96, 'f104', 2],
      [7.8, 50.9, 'f104'], [11.0, 49.5, 'a7'], [9.2, 49.9, 'f104'], [10.3, 53.0, 'f104'], [9.6, 54.4, 'f104'], [11.6, 48.2, 'f4'], [-1.25, 51.93, 'f111', 2], [0.56, 52.41, 'f4'], [0.48, 52.36, 'kc135'],
      [10.27, 45.43, 'f104'], [-0.52, 53.17, 'vulcan'], [12.6, 46.03, 'f4'], [-0.5, 53.0, 'ec121']
    ]
  },
  PACT: {
    ground: [
      [13.4, 52.5, 'gtank'], [12.6, 52.1, 'tank'], [11.6, 52.1, 'tank'], [11.9, 51.4, 'tank'], [11.0, 51.0, 'mot'], [10.9, 50.7, 'tank'], [12.9, 50.9, 'mot'], [13.7, 51.0, 'gtank'], [14.3, 51.8, 'mot'], [13.0, 53.5, 'mot'], [12.1, 54.1, 'mot'], [11.3, 53.6, 'mot'], [14.5, 53.4, 'mot'],
      [11.4, 51.9, 'btr'], [12.0, 51.1, 'btr'], [11.2, 50.8, 'btr'], [13.0, 50.5, 'btr'], [10.9, 52.3, 'btr'],
      [11.0, 52.9, 'tank'], [10.8, 51.6, 'mot'], [11.4, 50.4, 'mot'], [12.3, 50.6, 'tank'],
      [12.0, 51.0, 'party'], [11.5, 52.0, 'party'], [13.0, 50.6, 'party'], [12.6, 52.5, 'party'], [14.0, 51.5, 'party'], [15.0, 50.2, 'party'], [12.2, 50.3, 'party'], [11.0, 52.6, 'party'], [16.0, 52.0, 'party'], [14.5, 53.0, 'party'],
      [14.5, 50.0, 'tank'], [13.6, 50.2, 'mot'], [12.4, 49.8, 'mot'], [14.5, 49.0, 'tank'], [16.6, 49.2, 'mot'], [17.2, 48.1, 'mot'], [17.1, 51.1, 'mot'], [18.5, 50.0, 'mot'],
      [16.9, 52.4, 'tank'], [15.5, 51.0, 'mot'], [14.5, 52.5, 'mot'], [15.7, 53.7, 'mot'], [18.0, 53.1, 'mot'], [19.0, 52.2, 'mot'], [21.0, 52.2, 'tank'], [17.0, 54.3, 'mot'],
      [19.1, 47.5, 'mot'], [20.0, 47.2, 'mot'], [22.0, 44.4, 'mot'], [26.1, 44.4, 'mot'], [23.6, 46.7, 'mot'], [23.3, 42.7, 'mot'], [26.0, 43.0, 'mot'],
      [24.0, 54.0, 'gtank'], [25.3, 54.7, 'tank'], [27.5, 53.9, 'gtank'], [30.5, 50.4, 'tank'], [31.0, 52.4, 'mot'], [33.0, 53.0, 'tank'],
      [13.1, 51.0, 'party'], [12.0, 52.2, 'party'], [11.5, 51.0, 'party'], [14.5, 50.3, 'party'], [15.7, 51.3, 'party'], [13.4, 53.0, 'party'],
      [12.5, 51.5, 'paa'], [11.0, 51.4, 'paa'], [13.5, 52.2, 'paa'], [14.5, 50.1, 'paa'], [16.9, 52.2, 'paa'],
      [11.7, 52.0, 'brdm'], [11.2, 50.9, 'brdm'], [12.6, 50.7, 'brdm'], [11.4, 53.0, 'brdm'], [12.0, 50.0, 'brdm'],
      [12.3, 51.3, 'peng'], [13.2, 51.9, 'peng'], [12.9, 51.8, 'mi24'], [11.8, 51.0, 'mi24'], [13.6, 52.4, 'mi8'], [12.2, 51.9, 'mi8'],
      [13.0, 51.2, 'frog'], [11.3, 51.5, 'frog'], [14.0, 50.3, 'scud'],
      [12.4, 51.9, 'ptrain'], [13.0, 52.0, 'ptrain'], [12.1, 51.3, 'ptrain'], [13.7, 51.3, 'pconvoy'], [11.9, 52.3, 'pconvoy'], [12.9, 50.9, 'pconvoy'], [14.4, 50.0, 'pconvoy']
    ],
    air: [
      [13.46, 52.17, 'mig23', 2], [13.0, 51.6, 'mig21', 2], [12.5, 51.4, 'su17'], [12.8, 51.2, 'su7', 2], [12.4, 51.9, 'su17'], [11.7, 52.1, 'mig21'], [12.9, 52.0, 'mig23'], [12.3, 52.3, 'su7'],
      [12.7, 53.3, 'mig21'], [13.6, 51.4, 'mig23'], [11.9, 51.4, 'su7'], [12.0, 50.9, 'mig21'],
      [16.97, 52.33, 'su7'], [15.8, 53.8, 'mig21', 2], [21.6, 52.2, 'mig21'], [17.9, 53.0, 'mig23'], [15.74, 50.01, 'mig21'], [14.54, 50.12, 'mig23'], [13.57, 50.37, 'su7'], [14.6, 49.9, 'su17'],
      [19.75, 46.9, 'mig21'], [19.26, 47.37, 'su7'], [26.1, 44.5, 'mig21'], [23.4, 42.7, 'mig21'], [24.0, 54.0, 'mig23'], [27.5, 53.9, 'mig23'], [30.5, 50.4, 'mig23'],
      [31.0, 52.4, 'su24'], [33.0, 53.0, 'tu16'], [31.0, 51.5, 'tu22'], [27.5, 54.5, 'tu16'], [30.0, 50.0, 'mig25'], [13.0, 52.5, 'tu126']
    ]
  }
};

/* ============================================================ state */
var ESC_NAMES = ['Conventional war', 'Nuclear alert', 'Release warning', 'Battlefield nuclear use', 'Rear-area nuclear strikes', 'Mutual ruin'];
var START_MIN = 6 * 60; // 06:00 on 1 Jul 1975
var MAX_DAYS = 60;
var STEP = 15;

function cityList() { return MAP.cities; }
function airList() { return MAP.air; }
function mkUnit(st, type, side, x, y) {
  var d = U[type], u = { id: st.nid++, type: type, side: side, x: x, y: y, str: 100, sup: 100, mor: 80, orders: [], path: null, dig: 0, bt: 0, hold: 0, kills: 0, hist: [], trk: [], dist: 0 };
  if (d.air) { u.base = null; u.state = 'base'; u.rdy = 0; u.fuel = d.rad * 2; u.alt = 0; }
  if (d.heli) { u.state = 'land'; u.fuel = d.rad * 2; u.cargo = null; }
  if (d.naval) { u.state = 'sea'; u.cl = []; u.cvRdy = 0; }
  if (d.msl) u.msl = d.msl;
  if (d.cls === 'train' || d.cls === 'convoy') u.load = 0;
  if (d.carry) u.riders = [];
  return u;
}
function nearestNode(list, x, y, owner, st, dd) {
  var best = -1, bd = 1e9;
  for (var i = 0; i < list.length; i++) {
    if (owner && dd[i].o !== owner) continue;
    var d = dist(list[i][1], list[i][2], x, y); if (d < bd) { bd = d; best = i; }
  }
  return { i: best, d: bd };
}
function nearestAF(st, x, y, side, maxd) {
  var best = -1, bd = maxd || 1e9;
  for (var i = 0; i < MAP.air.length; i++) {
    var a = MAP.air[i]; if (st.ad[i].o !== side || st.ad[i].dmg >= 0.95) continue;
    var d = dist(a[2], a[3], x, y); if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function newGame(opts, mapObj) {
  if (mapObj) initMap(mapObj); else if (!G.ready) initMap(MAP);
  opts = opts || {};
  var seed = opts.seed != null ? opts.seed : (Date.now() & 0x7fffffff);
  var era = opts.era === 'm' ? 'm' : '75'; setEra(era); if (era === 'm') opts.side = 'NATO';
  var st = { v: VERSION, era: era, side: opts.side || 'NATO', diff: opts.diff || 'normal', rs: seed | 0, t: START_MIN, spd: 0, nid: 1, units: [], cd: [], ad: [], con: { NATO: {}, PACT: {} },
    pts: { NATO: 14, PACT: 14 }, queue: [], esc: 0, retal: { NATO: 0, PACT: 0 }, nukeCool: { NATO: 0, PACT: 0 }, pol: { NATO: { pc: 4, coh: 75 }, PACT: { pc: 4, coh: 75 }, world: 45, med: 0 },
    will: era === 'm' ? { NATO: 70, PACT: 100 } : { NATO: 70, PACT: 80 }, fallout: [], fx: [], cuts: [], log: [], events: [], ended: null, deploy: true, wins: { NATO: 0, PACT: 0 },
    stats: { lost: { NATO: 0, PACT: 0 }, kills: { NATO: 0, PACT: 0 }, nukes: 0, maxEsc: 0, sorties: { NATO: 0, PACT: 0 } },
    set: { auto: true, pause: { contact: true, battle: false, nuke: true, lost: false, idle: false } }, aiT: 0, railT: 0, lastBat: {}, viol: {}, nearEnd: 0, vp0: null };
  for (var i = 0; i < MAP.cities.length; i++) { var c = MAP.cities[i]; st.cd.push({ o: era === 'm' ? ownerM(c[4]) : (OWN[c[6]] || 'NEUT'), stk: 60, inf: 100, cp: 0, cs: null, conn: 1 }); }
  for (i = 0; i < MAP.air.length; i++) { var a = MAP.air[i]; st.ad.push({ o: era === 'm' ? ownerM(a[7]) : (OWN[a[8]] || 'NEUT'), dmg: 0, cp: 0, cs: null }); }
  ['NATO', 'PACT'].forEach(function (side) {
    var o = (era === 'm' ? OOB_M : OOB)[side];
    o.ground.forEach(function (g) {
      var p = ll(g[0], g[1]); p = snapLand(p.x, p.y);
      var u = mkUnit(st, g[2], side, p.x, p.y);
      if (U[g[2]].heli) { var af = nearestAF(st, p.x, p.y, side, 80); if (af >= 0) { u.x = MAP.air[af][2] + (u.id % 5) * 1.5; u.y = MAP.air[af][3]; } }
      st.units.push(u);
    });
    o.air.forEach(function (g) {
      var p = ll(g[0], g[1]), af = nearestAF(st, p.x, p.y, side, 90); if (af < 0) return;
      for (var k = 0; k < (g[3] || 1); k++) { var u = mkUnit(st, g[2], side, MAP.air[af][2], MAP.air[af][3]); u.base = af; st.units.push(u); }
    });
  });
  // second echelon and garrisons: reserves behind the front, around the big rear cities
  ['NATO', 'PACT'].forEach(function (side) {
    var pool = era === 'm' ? (side === 'NATO' ? ['m_inf', 'm_inf', 'm_puma', 'm_leo', 'm_abrams', 'm_pzh', 'm_stryker', 'm_fpv'] : ['r_t72', 'r_t72', 'r_t90', 'r_vdv', 'r_msta', 'r_lancet', 'r_t72']) : side === 'NATO' ? ['inf', 'inf', 'mech', 'armor', 'inf', 'mortar', 'arty', 'armor'] : ['mot', 'mot', 'tank', 'mot', 'pmortar', 'vdv', 'party'], left = era === 'm' ? (side === 'NATO' ? 20 : 48) : side === 'NATO' ? 22 : 30, foe = OTHER[side];
    pool = pool.filter(function (k) { return U[k]; });
    var fronts = st.units.filter(function (u) { return u.side === foe && U[u.type].ground && !U[u.type].heli && !U[u.type].naval; });
    var cand = [];
    for (var ci = 0; ci < MAP.cities.length; ci++) {
      if (st.cd[ci].o !== side || MAP.cities[ci][3] < (side === 'NATO' ? 110 : 250)) continue; var C = MAP.cities[ci], near = 1e9;
      fronts.forEach(function (e) { var d = dist(C[1], C[2], e.x, e.y); if (d < near) near = d; });
      if (near > (side === 'NATO' ? 160 : 230) && near < 4000) cand.push({ i: ci, sc: MAP.cities[ci][3] * (0.6 + rnd(st)) });
    }
    cand.sort(function (a, b) { return b.sc - a.sc; });
    cand.slice(0, left).forEach(function (c, n) {
      var C = MAP.cities[c.i], type = pool[Math.floor(rnd(st) * pool.length)], p = snapLand(C[1] + rr(st, -9, 9), C[2] + rr(st, -9, 9)), u = mkUnit(st, type, side, p.x, p.y);
      u.str = Math.round(rr(st, 80, 95)); u.mor = Math.round(rr(st, 60, 80)); if (rnd(st) < 0.6) { u.orders = [{ k: 'dig' }]; } st.units.push(u);
      if (rnd(st) < 0.5) { var q = snapLand(C[1] + rr(st, -12, 12), C[2] + rr(st, -12, 12)), v = mkUnit(st, pool[Math.floor(rnd(st) * pool.length)], side, q.x, q.y); v.str = Math.round(rr(st, 80, 95)); st.units.push(v); }
    });
  });
  // every sizeable military airfield starts with a wing: fill the empty ones
  ['NATO', 'PACT'].forEach(function (side) {
    var pool = era === 'm' ? (side === 'NATO' ? ['f16', 'typhoon', 'f35', 'gripen', 'f16', 'mq9'] : ['su35', 'su34', 'su35', 'mig31', 'orion']) : side === 'NATO' ? ['f4', 'f104', 'jag', 'f104', 'f4', 'rf4'] : ['mig21', 'su7', 'mig21', 'su7', 'mig21'], left = side === 'NATO' ? 30 : 38, used = {};
    st.units.forEach(function (u) { if (u.base != null && u.side === side) used[u.base] = 1; });
    var cand = []; for (var ai = 0; ai < MAP.air.length; ai++) { var A = MAP.air[ai]; if (st.ad[ai].o === side && !used[ai] && A[5] >= 2 && (A[6] || A[5] === 3) && A[4] >= 1800) cand.push(ai); }
    for (var q = cand.length - 1; q > 0; q--) { var j = Math.floor(rnd(st) * (q + 1)), t = cand[q]; cand[q] = cand[j]; cand[j] = t; }
    cand.slice(0, left).forEach(function (ai) { var u = mkUnit(st, pool[Math.floor(rnd(st) * pool.length)], side, MAP.air[ai][2], MAP.air[ai][3]); u.base = ai; u.home = ai; st.units.push(u); });
  });
  ['NATO', 'PACT'].forEach(function (side) {
    ((era === 'm' ? NAVY_M : NAVY)[side] || []).forEach(function (g) {
      var p = ll(g[0], g[1]), w = snapWater(p.x, p.y, 120); if (!w) return;
      for (var k = 0; k < (g[3] || 1); k++) { var w2 = snapWater(w.x + k * 8, w.y + k * 5, 60) || w; var u = mkUnit(st, g[2], side, w2.x, w2.y); u.str = Math.round(rr(st, 90, 100)); u.mor = Math.round(rr(st, 72, 90)); st.units.push(u); }
    });
  });
  // strength variance so no two divisions are identical
  st.units.forEach(function (u) { if (U[u.type].ground && !U[u.type].heli && !U[u.type].naval) { u.str = Math.round(rr(st, 88, 100)); u.mor = Math.round(rr(st, 70, 90)); } });
  st.vp0 = vpOf(st);
  logm(st, era === 'm' ? 'War breaks out on the Baltic front, 01 JUL 2027, 06:00. Place your units, then press play.' : 'Operation begins 01 JUL 1975, 06:00. Place your units, then press play.', 'big');
  return st;
}
function logm(st, t, c) { st.log.push({ t: st.t, m: t, c: c || '' }); if (st.log.length > 220) st.log.shift(); }
function ev(st, kind, text, x, y) { st.events.push({ k: kind, t: st.t, m: text, x: x, y: y }); }

function dateStr(t) {
  var d = Math.floor(t / 1440), mm = t % 1440, h = Math.floor(mm / 60), m = mm % 60;
  var dt = new Date(Date.UTC(ERA === 'm' ? 2027 : 1975, 6, 1 + d, h, m));
  var mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dt.getUTCMonth()];
  return (dt.getUTCDate() < 10 ? '0' : '') + dt.getUTCDate() + ' ' + mon + ' ' + (ERA === 'm' ? 2027 : 1975) + ' ' + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function dayOf(st) { return Math.floor((st.t - START_MIN) / 1440) + 1; }
function tierPoints(st, side) { return dayOf(st) + 2 * st.wins[side]; }
function tier(st, side) { var p = tierPoints(st, side || st.side); return p >= 22 ? 3 : p >= 9 ? 2 : 1; }

/* victory points = population-weighted control + capitals */
function vpOf(st) {
  var v = { NATO: 0, PACT: 0 };
  for (var i = 0; i < MAP.cities.length; i++) { var o = st.cd[i].o; if (o === 'NATO' || o === 'PACT') v[o] += MAP.cities[i][3] / 100 + (MAP.cities[i][5] ? 8 : 0); }
  return v;
}

/* ============================================================ queries */
function unitById(st, id) { for (var i = 0; i < st.units.length; i++) if (st.units[i].id === id) return st.units[i]; return null; }
function isAir(u) { return !!U[u.type].air; }
function isHeli(u) { return !!U[u.type].heli; }
function airborne(u) { return (isAir(u) && u.state === 'fly') || (isHeli(u) && u.state === 'fly'); }
function inFallout(st, x, y) { for (var i = 0; i < st.fallout.length; i++) if (dist(x, y, st.fallout[i].x, st.fallout[i].y) < st.fallout[i].r) return true; return false; }
function supF(u) { return u.sup > 25 ? 1 : u.sup > 5 ? 0.7 : 0.4; }
function morF(u) { return 0.5 + 0.5 * Math.min(100, u.mor) / 100; }
function tankersOf(st, side) { var n = 0; st.units.forEach(function (u) { if (u.side === side && U[u.type].cls === 'tanker' && u.str > 20) n++; }); return n; }
function rangeBonus(st, u) { return U[u.type].air && u.side === 'NATO' ? 1 + 0.12 * Math.min(2, tankersOf(st, 'NATO')) : 1; }

/* ============================================================ orders */
function homeBonus(u) { return u.base != null && u.base === u.home ? 1 : 0; }
/* cmd: {k:'move'|'amove'|'hunt'|'hold'|'dig'|'wait'|'haul'|'land'|'cas'|'strike'|'recon'|'cap'|'awacs'|'lift'|'rtb', ...}. add=true appends as a further stop. */
function issue(st, ids, cmd, add) {
  var ok = 0, msg = '';
  ids.forEach(function (id) {
    var u = unitById(st, id); if (!u || u.side !== st.side && !cmd.force) return;
    var d = U[u.type], cm = JSON.parse(JSON.stringify(cmd)), r = checkCmd(st, u, d, cm);
    if (r) { msg = r; return; }
    if (d.naval && (cm.k === 'cas' || cm.k === 'strike')) cm.k = 'airstrike';
    if (!add) { u.orders = []; u.path = null; u.broken = false; if (isAir(u) && u.state === 'fly') u.route = null; }
    u.orders.push(cm); u.path = add ? u.path : null; ok++;
    uhist(st, u, 'Ordered: ' + orderWord(cm) + (cm.x != null ? ' → ' + placeName(cm.x, cm.y) : '') + (add ? ' (added stop)' : '') + '.');
  });
  return { ok: ok, msg: ok ? '' : msg || 'Nothing could take that order.' };
}
function routeLen(u, cmd) {
  var x = u.x, y = u.y, L = 0, list = u.orders.concat([cmd]);
  for (var i = 0; i < list.length; i++) { var o = list[i]; if (o.x == null) continue; L += dist(x, y, o.x, o.y); x = o.x; y = o.y; }
  return { L: L, x: x, y: y };
}
function checkCmd(st, u, d, cmd) {
  var k = cmd.k;
  if (d.naval) {
    if (k === 'cas' || k === 'strike') return d.cvw ? '' : 'Only carriers launch air strikes.';
    if (['move', 'amove', 'hunt', 'hold', 'wait', 'bombard', 'lift'].indexOf(k) < 0) return 'Ships sail, attack-move, hunt, bombard, or lift troops.';
    if ((k === 'amove' || k === 'hunt') && !(d.sa > 0)) return d.n + ' has no weapons to hunt with.';
    if (k === 'bombard' && !(d.shore > 0)) return d.n + ' has no shore-bombardment guns.';
    if (k === 'lift') {
      if (!d.lift) return 'Not a troop carrier.';
      var cu = unitById(st, cmd.uid); if (!cu || cu.side !== u.side || !U[cu.type].ground || U[cu.type].heli || U[cu.type].naval) return 'Pick one of your ground units to load.';
      if (!snapWater(cu.x, cu.y, 40)) return 'That unit is not near enough to the coast.';
      var dw = snapWater(cmd.x, cmd.y, 40); if (!dw) return 'The landing point is not near the coast.'; cmd.wx = dw.x; cmd.wy = dw.y;
      return '';
    }
    if (k === 'move' || k === 'amove') {
      var w = snapWater(cmd.x, cmd.y, 45); if (!w) return 'No sea route there.'; cmd.x = w.x; cmd.y = w.y;
      if (!findPath('n', u.x, u.y, w.x, w.y)) return 'No sea route there.';
    }
    return '';
  }
  if (k === 'fire' && !d.air && !d.naval) { if (d.cls !== 'arty' && d.cls !== 'ssm') return 'Only artillery and missile units can fire.'; if (d.cls === 'ssm' && !(u.msl >= 1)) return 'Out of missiles. Reloads near a friendly city.'; return ''; }
  if (d.air) {
    if (u.broken) return '';
    if (k === 'land' || k === 'rtb') return '';
    if (['cas', 'strike', 'recon', 'cap', 'awacs', 'loiter'].indexOf(k) < 0) return 'Aircraft take mission orders: ground attack, strike, patrol, recon, or land.';
    if ((d.roles || []).indexOf(k === 'loiter' ? 'cas' : k) < 0 && !(k === 'cap' && (d.roles || []).indexOf('cap') >= 0)) return d.n + ' cannot fly that mission.';
    var rt = routeLen(u, cmd), back = 1e9, rangeEff = d.rad * rangeBonus(st, u);
    for (var i = 0; i < MAP.air.length; i++) if (st.ad[i].o === u.side) { var dd = dist(rt.x, rt.y, MAP.air[i][2], MAP.air[i][3]); if (dd < back) back = dd; }
    if (rt.L + back > rangeEff * 1.8 + (u.fuel > 0 && u.state === 'fly' ? 0 : 0)) return 'Out of range: needs a closer airfield or tanker support.';
    return '';
  }
  if (d.heli) {
    if (['move', 'amove', 'land', 'hold', 'cas', 'lift', 'loiter'].indexOf(k) < 0) return 'Helicopters fly to a point, attack, or lift troops.';
    if ((k === 'cas' || k === 'loiter') && !d.a2g) return 'Not an attack helicopter.';
    if (k === 'lift' && !d.lift) return 'Not a transport helicopter.';
    return '';
  }
  if (k === 'haul') { if (d.cls !== 'train' && d.cls !== 'convoy') return 'Only trains and convoys haul supplies.'; return ''; }
  if (['move', 'amove', 'hunt', 'hold', 'dig', 'wait', 'board', 'unload', 'ambush', 'mine', 'repair', 'merge'].indexOf(k) < 0) return 'Ground units move, attack-move, hunt, hold, dig in, ambush, board, merge, mine or repair.';
  if ((k === 'amove' || k === 'hunt') && !(d.a > 0)) return d.n + ' cannot attack.';
  if (k === 'board') {
    if (!d.foot) return d.n.split(' (')[0] + ' is not foot infantry, so it cannot board.';
    var cr = unitById(st, cmd.uid); if (!cr || cr.side !== u.side || cr.str <= 0 || cr.cargoed || !U[cr.type].carry || cr.id === u.id) return 'Tap one of your carriers: an APC / BTR unit or a truck convoy.';
    if (cr.bt > 0) return 'That carrier is under fire.';
    if ((cr.riders || []).length >= U[cr.type].carry) return 'That carrier is full.';
    cmd.x = cr.x; cmd.y = cr.y; return '';
  }
  if (k === 'unload') { if (!d.carry) return 'Only carriers (APC / BTR units, truck convoys) unload troops.'; if (!(u.riders && u.riders.length)) return 'Nothing aboard.'; return ''; }
  if (k === 'ambush' && !(d.a > 0 && (d.cls === 'gnd' || d.cls === 'recon'))) return 'Only combat units can set an ambush.';
  if (k === 'mine') { if (d.cls !== 'eng') return 'Only engineers lay mines.'; if (cmd.x == null) { cmd.x = u.x; cmd.y = u.y; cmd.here = true; } if (!isLand(cmd.x, cmd.y)) return 'That is water.'; return ''; }
  if (k === 'repair' && d.cls !== 'eng') return 'Only engineers repair.';
  if (k === 'merge') {
    var mu = unitById(st, cmd.uid); if (!mu || mu.side !== u.side || mu.id === u.id || mu.str <= 0 || mu.cargoed || mu.type !== u.type) return 'Tap another unit of the same type to merge into.';
    cmd.x = mu.x; cmd.y = mu.y; return '';
  }
  if (k === 'move' || k === 'amove') {
    if (d.cls === 'train') { if (!findPath('r', u.x, u.y, cmd.x, cmd.y)) return 'No rail link to there.'; }
    else if (!isLand(cmd.x, cmd.y)) return 'That is water.';
  }
  return '';
}
function nextRoute(u, st) { return u.orders[0]; }

/* ============================================================ detection */
function sensorsFor(st, side) {
  var s = [];
  st.units.forEach(function (u) {
    if (u.side !== side || u.str <= 0) return;
    var d = U[u.type];
    if (d.air) {
      if (u.state === 'fly') s.push({ x: u.x, y: u.y, g: d.cls === 'recon' ? 55 : 22, a: d.radar || (d.cls === 'recon' ? 90 : 60), r: d.radar || 0 });
      else s.push({ x: u.x, y: u.y, g: 8, a: 0, r: 0 });
    } else if (d.heli) s.push({ x: u.x, y: u.y, g: u.state === 'fly' ? 22 : 16, a: 20, r: 0 });
    else if (d.naval) s.push({ x: u.x, y: u.y, g: d.sight, a: d.radarA || 0, r: 0, w: d.asw ? d.asw * 6 : (d.sub ? 10 : 0), listen: d.sight * 1.6, nv: 1 });
    else s.push({ x: u.x, y: u.y, g: d.sight, a: d.cls === 'aa' ? 60 : d.sight * 1.2, r: 0, listen: d.sight * 2.3 });
  });
  for (var i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === side) s.push({ x: MAP.cities[i][1], y: MAP.cities[i][2], g: 9, a: 25, r: 0, listen: 22 });
  for (i = 0; i < MAP.air.length; i++) if (st.ad[i].o === side) s.push({ x: MAP.air[i][2], y: MAP.air[i][3], g: 10, a: 120, r: 0, listen: 25 });
  return s;
}
function detect(st) {
  ['NATO', 'PACT'].forEach(function (side) {
    var foe = OTHER[side], S = sensorsFor(st, side), con = st.con[side];
    var seen = {};
    st.units.forEach(function (e) {
      if (e.side !== foe || e.str <= 0 || e.hidden || e.cargoed) return;
      var d = U[e.type], fl = airborne(e), best = 1e9, lv = null;
      for (var i = 0; i < S.length; i++) {
        var s = S[i], dd = dist(s.x, s.y, e.x, e.y);
        if (d.sub) { if ((s.w && dd <= s.w) || (st.t < (e.reveal || 0) && dd <= Math.max(s.g, 14))) { lv = 'id'; best = Math.min(best, dd); } continue; }
        if (fl) { if (dd <= s.a && s.a >= 40) { lv = 'id'; best = Math.min(best, dd); } else if (dd <= s.g && s.g >= 20 && s.a === 0) { lv = 'id'; } }
        else {
          if (dd <= s.g) { lv = 'id'; best = Math.min(best, dd); if (lv === 'id') break; }
          else if (s.listen && dd <= s.listen && lv !== 'id') { lv = 'unk'; best = Math.min(best, dd); }
        }
      }
      if (!lv) return;
      var c = con[e.id], isNew = !c || c.lv === 'old';
      var err = lv === 'unk' ? Math.min(25, 4 + best / 5) : 0;
      var ox = lv === 'unk' ? ((e.id * 37) % 11 - 5) / 5 * err : 0, oy = lv === 'unk' ? ((e.id * 53) % 11 - 5) / 5 * err : 0;
      con[e.id] = { id: e.id, x: e.x + ox, y: e.y + oy, t: st.t, lv: lv, type: lv === 'id' ? e.type : null, str: lv === 'id' ? Math.round(e.str) : null, size: lv === 'unk' ? (d.cls === 'gnd' ? 'large' : 'small') : null, air: fl, err: err };
      seen[e.id] = 1;
      if (isNew && side === st.side && st.set.pause.contact && !fl && st.t > START_MIN + 30 && (!st.lastContactEv || st.t - st.lastContactEv > 90) && U[e.type].cls !== 'train' && U[e.type].cls !== 'convoy') { st.lastContactEv = st.t; ev(st, 'contact', (lv === 'id' ? 'Enemy identified: ' + U[e.type].n : 'Unknown contact'), e.x, e.y); }
    });
    for (var k in con) { var cc = con[k]; if (!seen[k]) { var age = st.t - cc.t; if (age > 720 || !unitById(st, +k)) delete con[k]; else if (age > 120) cc.lv = 'old'; } }
  });
}

/* ============================================================ movement */
function speedOn(u, d, st) {
  var onRoad = G.road[cellOf(u.x, u.y)];
  var s = d.sp * (onRoad ? 1.3 : 0.3) * (u.sup > 5 ? 1 : 0.6);
  if (inFallout(st, u.x, u.y)) s *= 0.6;
  if (inMine(st, u)) s *= 0.5;
  if (u.dig > 0 && u.orders.length && u.orders[0].k !== 'dig') u.dig = 0;
  return s;
}
function followPath(u, dkm) {
  while (dkm > 0 && u.path && u.path.length) {
    var p = u.path[0], dd = dist(u.x, u.y, p.x, p.y);
    if (dd <= dkm) { u.x = p.x; u.y = p.y; dkm -= dd; u.path.shift(); }
    else { u.x += (p.x - u.x) / dd * dkm; u.y += (p.y - u.y) / dd * dkm; dkm = 0; }
  }
  return !(u.path && u.path.length);
}

var ORBIT = { cap: 22, awacs: 30, loiter: 18, loiterHeli: 9 };
function placeName(x, y) {
  var b = -1, bd = 1e9; for (var i = 0; i < MAP.cities.length; i++) { var dd = dist(x, y, MAP.cities[i][1], MAP.cities[i][2]); if (dd < bd) { bd = dd; b = i; } }
  if (b < 0) return 'somewhere'; return bd < 6 ? MAP.cities[b][0] : 'near ' + MAP.cities[b][0] + ' (' + Math.round(bd) + ' km ' + dirWord(MAP.cities[b][1], MAP.cities[b][2], x, y) + ')';
}
function dirWord(x0, y0, x1, y1) { var a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI; var n = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']; return n[Math.round(((a + 360) % 360) / 45) % 8]; }
function uhist(st, u, m) {
  if (!u) return; u.hist = u.hist || []; var last = u.hist[u.hist.length - 1];
  if (last && last.m.slice(0, 14) === m.slice(0, 14) && st.t - last.t < 40) { last.m = m; last.t = st.t; return; }
  u.hist.push({ t: st.t, m: m }); if (u.hist.length > 50) u.hist.shift();
}
function orderWord(o) { return ({ move: 'Move', amove: 'Attack-move', hunt: 'Hunt', hold: 'Hold', dig: 'Dig in', haul: 'Haul supplies', cas: 'Ground attack', strike: 'Strike', recon: 'Recon', loiter: 'Circle & attack', cap: 'Patrol', awacs: 'AWACS station', land: 'Land', lift: 'Lift troops', bombard: 'Bombard', airstrike: 'Carrier strike', fire: 'Artillery barrage', wait: 'Wait', board: 'Board carrier', unload: 'Unload troops', ambush: 'Ambush', mine: 'Lay mines', laying: 'Laying mines', repair: 'Repair nearby units', merge: 'Merge' })[o.k] || o.k; }
function artyFire(st, u, o, dt) {
  var d = U[u.type], R = d.rng * 0.9, dd = dist(u.x, u.y, o.x, o.y);
  if (dd > R) {
    if (!u.path) { var f = (dd - R * 0.8) / dd, sl = snapLand(u.x + (o.x - u.x) * f, u.y + (o.y - u.y) * f); u.path = findPath('g', u.x, u.y, sl.x, sl.y); if (!u.path) { u.orders.shift(); ev(st, 'idle', d.n + ': no route to a firing position.', u.x, u.y); return; } }
    followPath(u, speedOn(u, d, st) * dt / 60); u.sup = Math.max(0, u.sup - 0.35 * dt / 60); return;
  }
  u.path = null;
  if (d.cls === 'ssm') { missileFire(st, u, o, dt); return; }
  if (u.sup < 10) { uhist(st, u, 'Out of ammunition, barrage stopped.'); u.orders.shift(); ev(st, 'idle', d.n + ' is out of shells.', u.x, u.y); return; }
  if (o.mins) o.left = (o.left == null ? o.mins : o.left) - dt; o.acc = (o.acc || 0) + dt;
  if (taken(st, u, o)) { u.orders.shift(); uhist(st, u, 'Target area taken, ceasing fire.'); ev(st, 'idle', d.n + ': target area taken, firing stopped.', u.x, u.y); return; }
  if (!o.began) { o.began = 1; uhist(st, u, 'Opened fire: ' + placeName(o.x, o.y) + '.'); }
  while (o.acc >= 6) { o.acc -= 6; volley(st, u, o); }
  if (o.mins && o.left <= 0) { u.orders.shift(); uhist(st, u, 'Barrage finished (' + (o.vol || 0) + ' volleys).'); ev(st, 'idle', d.n + ' finished its barrage.', u.x, u.y); }
}
// a barrage ends once your own ground troops stand on the target (no friendly fire)
function taken(st, u, o) {
  return st.units.some(function (f) { return f.side === u.side && f.id !== u.id && f.str > 0 && !f.cargoed && U[f.type].ground && !U[f.type].heli && U[f.type].cls !== 'arty' && U[f.type].cls !== 'ssm' && U[f.type].cls !== 'aa' && dist(f.x, f.y, o.x, o.y) < 3.5; });
}
function missileFire(st, u, o, dt) {
  var d = U[u.type];
  if (o.mins) o.left = (o.left == null ? o.mins : o.left) - dt; o.acc = (o.acc || 0) + dt;
  if (taken(st, u, o)) { u.orders.shift(); uhist(st, u, 'Target area taken, ceasing fire.'); ev(st, 'idle', d.n + ': target area taken, firing stopped.', u.x, u.y); return; }
  if (!o.began) { o.began = 1; uhist(st, u, 'Conventional missile strike ordered: ' + placeName(o.x, o.y) + '.'); }
  while (o.acc >= 8 && u.msl >= 1) {
    o.acc -= 8; u.msl -= 1; u.bt = 30; o.vol = (o.vol || 0) + 1;
    var cx = o.x + rr(st, -1.2, 1.2), cy = o.y + rr(st, -1.2, 1.2), hit = 0;
    st.fx.push({ k: 'shell', x0: u.x, y0: u.y, x1: cx, y1: cy, t: st.t, s: u.side, m: 1 });
    st.units.forEach(function (e) {
      if (e.side === u.side || e.str <= 0 || e.cargoed) return; var ed = U[e.type]; if (ed.air && e.state !== 'base') return; if (ed.naval && ed.sub) return;
      if (dist(e.x, e.y, cx, cy) > 2.8) return;
      var soft = (ed.cls === 'train' || ed.cls === 'convoy' || ed.cls === 'eng' || ed.cls === 'aa' || ed.cls === 'arty' || ed.cls === 'ssm' || ed.air) ? 1.7 : 1;
      var dm = dmul(st, u) * d.cdmg * (u.str / 100) * supF(u) * soft * rr(st, 0.7, 1.3) / (ed.d * (e.dig > 0 ? 1 + 0.3 * e.dig : 1) + 1.5);
      e.str -= dm; e.mor -= dm * 0.9; e.bt = 60; e.hit = st.t; hit++;
      if (e.side === st.side) ev(st, 'battle', ed.n + ' hit by a missile', e.x, e.y);
      uhist(st, e, 'Hit by a ' + d.mname + ' missile (str ' + Math.round(Math.max(0, e.str)) + '%).');
      if (e.str <= 6) { u.kills++; uhist(st, u, 'Destroyed ' + ed.n + ' with a missile.'); killUnit(st, e, u.side); }
    });
    uhist(st, u, 'Fired a ' + d.mname + ' (' + hit + ' unit' + (hit === 1 ? '' : 's') + ' hit, ' + Math.floor(u.msl) + ' left).');
  }
  if (u.msl < 1) { uhist(st, u, 'Out of missiles.'); u.orders.shift(); ev(st, 'idle', d.n + ' is out of missiles.', u.x, u.y); return; }
  if (o.mins && o.left <= 0) { u.orders.shift(); ev(st, 'idle', d.n + ' finished its strike.', u.x, u.y); }
}
function volley(st, u, o) {
  var d = U[u.type], n = d.rng > 20 ? 4 : 3; o.vol = (o.vol || 0) + 1; u.sup = Math.max(0, u.sup - 0.22); u.bt = 30;
  var cx = o.x + rr(st, -1.5, 1.5), cy = o.y + rr(st, -1.5, 1.5);
  for (var k = 0; k < n; k++) st.fx.push({ k: 'shell', x0: u.x, y0: u.y, x1: cx + rr(st, -2.4, 2.4), y1: cy + rr(st, -2.4, 2.4), t: st.t, s: u.side });
  st.units.forEach(function (e) {
    if (e.side === u.side || e.str <= 0 || e.cargoed || U[e.type].air || U[e.type].heli) return; var ed = U[e.type]; if (ed.naval && ed.sub) return;
    if (dist(e.x, e.y, cx, cy) > 3.6) return;
    var soft = (ed.cls === 'train' || ed.cls === 'convoy' || ed.cls === 'eng' || ed.cls === 'aa' || ed.cls === 'arty') ? 1.5 : 1;
    var dm = dmul(st, u) * d.a * (u.str / 100) * supF(u) * morF(u) * 1.6 * soft / (ed.d * (e.dig > 0 ? 1 + 0.45 * e.dig : 1) + 2) * rr(st, 0.7, 1.3);
    e.str -= dm; e.mor -= dm * 0.8; e.bt = 60; e.hit = st.t; e.dig = Math.max(0, e.dig - 0.03);
    if (e.side === st.side) ev(st, 'battle', ed.n + ' is being shelled', e.x, e.y);
    uhist(st, e, 'Under artillery fire (str ' + Math.round(Math.max(0, e.str)) + '%).');
    if (e.str <= 6) { u.kills++; uhist(st, u, 'Destroyed ' + ed.n + ' with artillery.'); killUnit(st, e, u.side); }
  });
}
function moveGround(st, u, dt) {
  var d = U[u.type];
  if (u.broken) { retreat(st, u, dt); return; }
  var o = u.orders[0];
  if (u.hidden && (!o || o.k !== 'ambush')) u.hidden = false;
  if (!o) { return; }
  var mins = dt;
  if (o.k === 'dig') { u.dig = Math.min(1, u.dig + dt / 360); return; }
  if (o.k === 'hold') return;
  if (o.k === 'ambush') { if (u.bt > 0) u.amb = 0; else { u.amb = (u.amb || 0) + dt; if (u.amb >= 20 && !u.hidden) { u.hidden = true; uhist(st, u, 'Concealed in ambush position.'); } } return; }
  if (o.k === 'repair') { repairStep(st, u, dt); return; }
  if (o.k === 'unload') { unloadAll(st, u, 'ordered'); u.orders.shift(); return; }
  if (o.k === 'mine' && (o.here || dist(u.x, u.y, o.x, o.y) < 2)) { o.k = 'laying'; o.left = 60; uhist(st, u, 'Laying a minefield here.'); return; }
  if (o.k === 'laying') {
    o.left -= dt;
    if (o.left <= 0) { (st.mines = st.mines || []).push({ x: u.x, y: u.y, r: 6, s: u.side, str: 100 }); uhist(st, u, 'Minefield laid near ' + placeName(u.x, u.y) + '.'); if (u.side === st.side) ev(st, 'info', 'Minefield laid near ' + placeName(u.x, u.y) + '.', u.x, u.y); u.orders.shift(); }
    return;
  }
  if (o.k === 'wait') { o.h -= dt / 60; if (o.h <= 0) u.orders.shift(); return; }
  if (u.heliWait) return;
  if (o.k === 'fire') { artyFire(st, u, o, dt); return; }
  var tx, ty;
  if (o.k === 'hunt') {
    var c = st.con[u.side][o.cid], e = unitById(st, o.cid);
    if (!e || e.str <= 0) { u.orders.shift(); u.path = null; ev(st, 'idle', U[u.type].n + ': target destroyed.', u.x, u.y); return; }
    if (!c) { u.orders.shift(); u.path = null; ev(st, 'idle', U[u.type].n + ' lost the contact.', u.x, u.y); return; }
    tx = c.x; ty = c.y;
    if (dist(u.x, u.y, e.x, e.y) < 8 && c.lv === 'id') { return; }   // in contact: the battle step takes over
    if (!u.path || !u.path.length || dist(u.pathT ? u.pathT.x : 0, u.pathT ? u.pathT.y : 0, tx, ty) > 14) { u.path = findPath('g', u.x, u.y, tx, ty); u.pathT = { x: tx, y: ty }; if (!u.path) { u.orders.shift(); return; } }
  } else if (o.k === 'board' || o.k === 'merge') {
    var tg = unitById(st, o.uid);
    if (!tg || tg.str <= 0 || tg.cargoed || tg.side !== u.side || (o.k === 'merge' && tg.type !== u.type) || (o.k === 'board' && tg.bt > 0)) { u.orders.shift(); u.path = null; ev(st, 'idle', d.n.split(' (')[0] + ': cannot ' + o.k + ' any more.', u.x, u.y); return; }
    if (dist(u.x, u.y, tg.x, tg.y) < 6) { if (o.k === 'board') boardOn(st, u, tg); else mergeInto(st, u, tg); return; }
    tx = tg.x; ty = tg.y;
    if (!u.path || !u.path.length || dist(u.pathT ? u.pathT.x : 0, u.pathT ? u.pathT.y : 0, tx, ty) > 10) { u.path = findPath('g', u.x, u.y, tx, ty); u.pathT = { x: tx, y: ty }; if (!u.path) { u.orders.shift(); ev(st, 'idle', d.n.split(' (')[0] + ': no route.', u.x, u.y); return; } }
  } else if (o.k === 'haul') { haulStep(st, u, o, dt); return; }
  else {
    tx = o.x; ty = o.y;
    if (d.heli) { /* heli flies straight */ }
    else if (!u.path) { u.path = findPath(d.cls === 'train' ? 'r' : 'g', u.x, u.y, tx, ty); if (!u.path) { u.orders.shift(); ev(st, 'idle', d.n + ': no route.', u.x, u.y); return; } }
  }
  if (o.k === 'amove' && u.bt > 0) return; // stop and fight
  if (d.cls === 'train' && cutAt(st, u.x, u.y)) return; // waiting on a rail cut
  var sp = speedOn(u, d, st) * mins / 60;
  if (d.cls === 'train') sp = d.sp * mins / 60;
  var done = followPath(u, sp);
  u.sup = Math.max(0, u.sup - 0.35 * mins / 60 * (d.cls === 'train' ? 0 : 1));
  if (done && o.k === 'mine') { o.k = 'laying'; o.left = 60; u.path = null; uhist(st, u, 'Arrived, laying a minefield.'); return; }
  if (done && o.k !== 'hunt' && o.k !== 'board' && o.k !== 'merge') { uhist(st, u, 'Arrived: ' + placeName(u.x, u.y) + '.'); u.orders.shift(); u.path = null; if (!u.orders.length) ev(st, 'idle', d.n + ' has arrived.', u.x, u.y); }
}
function cutAt(st, x, y) { for (var i = 0; i < st.cuts.length; i++) if (dist(x, y, st.cuts[i].x, st.cuts[i].y) < st.cuts[i].r) return true; return false; }
function retreat(st, u, dt) {
  if (!u.path || !u.path.length) {
    var best = -1, bd = 1e9;
    for (var i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === u.side) { var dd = dist(u.x, u.y, MAP.cities[i][1], MAP.cities[i][2]); if (dd > 25 && dd < bd && behind(st, u, MAP.cities[i][1], MAP.cities[i][2])) { bd = dd; best = i; } }
    if (best < 0) { u.broken = false; return; }
    u.path = findPath('g', u.x, u.y, MAP.cities[best][1], MAP.cities[best][2]) || [];
  }
  followPath(u, U[u.type].sp * 0.6 * dt / 60);
  if (!u.path.length) { u.path = null; }
}
function behind(st, u, x, y) {  // farther from the nearest known enemy than we are now
  var ne = 1e9, ex = 0, ey = 0; st.units.forEach(function (e) { if (e.side !== u.side && U[e.type].ground && e.str > 0) { var d = dist(u.x, u.y, e.x, e.y); if (d < ne) { ne = d; ex = e.x; ey = e.y; } } });
  return ne === 1e9 || dist(x, y, ex, ey) > ne;
}
/* ---------- carriers, boarding, merge, repair, mines, one-shot SAMs ---------- */
function boardOn(st, u, c) {
  if (!c.riders) c.riders = [];
  if (c.riders.length >= (U[c.type].carry || 0)) { u.orders.shift(); u.path = null; ev(st, 'idle', U[c.type].n.split(' (')[0] + ' is full.', u.x, u.y); return; }
  c.riders.push(u.id); u.cargoed = true; u.rideOn = c.id; u.orders = []; u.path = null; u.x = c.x; u.y = c.y;
  uhist(st, u, 'Boarded ' + U[c.type].n.split(' (')[0] + '.'); uhist(st, c, 'Took ' + U[u.type].n.split(' (')[0] + ' aboard.');
  if (u.side === st.side) ev(st, 'info', U[u.type].n.split(' (')[0] + ' boarded ' + U[c.type].n.split(' (')[0] + '.', c.x, c.y);
}
function unloadAll(st, c, why) {
  if (!c.riders || !c.riders.length) return;
  c.riders.forEach(function (id, i) {
    var r = unitById(st, id); if (!r || r.str <= 0) return;
    var p = snapLand(c.x + (i % 3) * 2 - 2, c.y + 2 + Math.floor(i / 3) * 2);
    r.cargoed = false; r.rideOn = null; r.x = p.x; r.y = p.y; r.orders = []; r.path = null;
    uhist(st, r, 'Dismounted' + (why === 'contact' ? ' under fire.' : why === 'damaged' ? ': the carrier is badly damaged.' : '.'));
  });
  if (c.side === st.side && why !== 'ordered') ev(st, 'info', U[c.type].n.split(' (')[0] + ': infantry dismounted' + (why === 'contact' ? ' (contact).' : ' (carrier damaged).'), c.x, c.y);
  c.riders = [];
}
function ridersStep(st) {
  st.units.forEach(function (c) {
    if (!c.riders || !c.riders.length) return;
    c.riders = c.riders.filter(function (id) { var r = unitById(st, id); return r && r.str > 0 && !r.dead && r.cargoed; });
    if (c.str <= 0 || c.dead || !c.riders.length) return;
    if (c.str < 30 || c.broken) { unloadAll(st, c, 'damaged'); return; }
    if (c.bt > 0 && c.auto !== false) { unloadAll(st, c, 'contact'); return; }   // infantry dismount when the carrier is engaged
    c.riders.forEach(function (id) { var r = unitById(st, id); r.x = c.x; r.y = c.y; });
  });
}
function mergeInto(st, u, t) {
  t.str = Math.min(100, t.str + u.str * 0.9); t.mor = (t.mor + u.mor) / 2; t.sup = Math.min(100, (t.sup + u.sup) / 2 + 5); t.kills = (t.kills || 0) + (u.kills || 0);
  uhist(st, t, 'Merged with another ' + U[u.type].n.split(' (')[0] + ' (strength ' + Math.round(t.str) + '%).');
  if (u.side === st.side) ev(st, 'info', U[u.type].n.split(' (')[0] + ' merged into another unit.', t.x, t.y);
  u.str = 0; u.dead = true; u.orders = [];   // a merge is not a loss
}
function repairStep(st, u, dt) {
  if (u.bt > 0) return;
  st.units.forEach(function (f) {
    if (f.side !== u.side || f.id === u.id || f.str <= 0 || f.str >= 100 || f.cargoed) return;
    var d = U[f.type]; if (!d.ground || d.heli || d.naval || d.air) return;
    if (dist(u.x, u.y, f.x, f.y) < 6) { f.str = Math.min(100, f.str + 3.5 * dt / 60); f.sup = Math.min(100, f.sup + 1.5 * dt / 60); }
  });
}
function inMine(st, u) {
  var m = st.mines; if (!m || !m.length || !U[u.type].ground || U[u.type].heli || U[u.type].cls === 'train') return false;
  for (var i = 0; i < m.length; i++) if (m[i].s !== u.side && m[i].str > 0 && dist(u.x, u.y, m[i].x, m[i].y) < m[i].r) return true;
  return false;
}
function mineStep(st, dt) {
  var M = st.mines; if (!M || !M.length) return;
  M.forEach(function (m) {
    st.units.forEach(function (u) {
      var d = U[u.type]; if (m.str <= 0 || u.side === m.s || u.str <= 0 || u.cargoed || !d.ground || d.heli || d.naval || d.air || d.cls === 'train') return;
      if (dist(u.x, u.y, m.x, m.y) >= m.r) return;
      if (d.cls === 'eng') { m.str -= 14 * dt / 60; return; }   // enemy engineers clear the field
      if (!(u.path && u.path.length)) return;                      // only units moving through it set mines off
      u.str -= 6 * dt / 60; u.mor -= 0.6; m.str -= 1.5 * dt / 60; m.rev = true;
      if (!(m.evT > st.t)) { m.evT = st.t + 60; if (u.side === st.side) ev(st, 'battle', d.n.split(' (')[0] + ' hit a minefield.', u.x, u.y); }
      if (u.str <= 6) killUnit(st, u, m.s);
    });
  });
  st.mines = M.filter(function (m) { return m.str > 0; });
}
function samKills(st, dt) {   // Patriot / S-300 / S-400: one launch, one aircraft unit down
  st.units.forEach(function (a) {
    var d = U[a.type]; if (!d.kill1 || a.str <= 0 || a.dead || a.cargoed) return;
    if (a.msl == null) a.msl = d.msl;
    a.cd = Math.max(0, (a.cd || 0) - dt); if (a.cd > 0 || a.msl < 1 || a.sup < 5) return;
    var reach = d.rng * (0.5 + 0.5 * a.str / 100), best = null, bd = 1e9;
    st.units.forEach(function (u) { if (u.side === a.side || u.str <= 0 || u.dead || !U[u.type].air || !airborne(u)) return; var dd = dist(a.x, a.y, u.x, u.y); if (dd <= reach && dd < bd) { bd = dd; best = u; } });
    if (!best) return;
    a.msl -= 1; a.cd = SAM_CD; a.kills = (a.kills || 0) + 1;
    best.str = 0; best.dead = true; st.stats.lost[best.side]++; st.stats.kills[a.side]++;
    st.fx.push({ k: 'shell', x0: a.x, y0: a.y, x1: best.x, y1: best.y, t: st.t, s: a.side });
    uhist(st, a, 'Launched a ' + d.mname + ': ' + U[best.type].n.split(' (')[0] + ' shot down (' + Math.floor(a.msl) + ' left).');
    if (best.side === st.side) ev(st, 'lost', U[best.type].n + ' shot down by ' + d.n.split(' (')[0] + '.', best.x, best.y);
    else if (a.side === st.side) ev(st, 'info', d.n.split(' (')[0] + ' shot down ' + U[best.type].n.split(' (')[0] + '.', best.x, best.y);
  });
}
function haulStep(st, u, o, dt) {
  var d = U[u.type], mode = d.cls === 'train' ? 'r' : 'g';
  var from = MAP.cities[o.from], to = MAP.cities[o.to];
  var tgt = u.load > 0 ? to : from;
  if (cutAt(st, u.x, u.y) && mode === 'r') return;
  if (!u.path) { u.path = findPath(mode, u.x, u.y, tgt[1], tgt[2]); if (!u.path) { u.orders.shift(); ev(st, 'idle', d.n + ': no ' + (mode === 'r' ? 'rail' : 'road') + ' link.', u.x, u.y); return; } }
  var done = followPath(u, d.sp * (mode === 'r' ? 1 : (G.road[cellOf(u.x, u.y)] ? 1.3 : 0.3)) * dt / 60);
  if (!done) return;
  u.path = null;
  if (u.load > 0) {
    var cd = st.cd[o.to]; if (cd.o === u.side) { cd.stk = Math.min(100, cd.stk + u.load); } u.load = 0;
    if (!o.loop) { u.orders.shift(); ev(st, 'idle', d.n + ' delivered supplies to ' + to[0] + '.', u.x, u.y); }
  } else {
    var cf = st.cd[o.from]; if (cf.o !== u.side) { u.orders.shift(); return; }
    var take = Math.min(d.cap, cf.stk); u.load = take; cf.stk -= take;
    if (take < 5) { ev(st, 'idle', d.n + ': ' + from[0] + ' has no stock to load.', u.x, u.y); u.orders.shift(); u.load = 0; }
  }
}


/* ============================================================ navy */
function portFor(st, side, hint) {
  var best = -1, bs = 1e9, w = null;
  for (var i = 0; i < MAP.cities.length; i++) {
    if (st.cd[i].o !== side) continue; var C = MAP.cities[i];
    var ww = snapWater(C[1], C[2], 24); if (!ww) continue;
    var sc;
    if (hint && hint.x != null) sc = dist(C[1], C[2], hint.x, hint.y);
    else { var near = 1e9; st.units.forEach(function (e) { if (e.side !== side && U[e.type].ground && !U[e.type].heli) { var d = dist(C[1], C[2], e.x, e.y); if (d < near) near = d; } }); sc = -Math.min(near, 500) - C[3] / 100; }
    if (sc < bs) { bs = sc; best = i; w = ww; }
  }
  return best < 0 ? null : { city: best, x: w.x, y: w.y };
}
function shipAt(st, u, pt) { return !!pt && dist(u.x, u.y, pt.x, pt.y) < 40; }
function navalStep(st, dt) {
  // troops whose ship or helicopter is gone are lost with it
  var carried = {}; st.units.forEach(function (c) { if (c.str > 0 && !c.dead) { if (c.cl) c.cl.forEach(function (id) { carried[id] = 1; }); if (c.cargo != null) carried[c.cargo] = 1; if (c.riders) c.riders.forEach(function (id) { carried[id] = 1; }); } });
  st.units.forEach(function (u) { if (u.cargoed && !carried[u.id]) { u.str = 0; u.dead = true; st.stats.lost[u.side]++; } });
  var ships = st.units.filter(function (u) { return U[u.type].naval && u.str > 0; });
  if (!ships.length) return;
  ships.forEach(function (u) { moveShip(st, u, dt); });
  navalCombat(st, dt, ships);
  ships.forEach(function (u) { if (u.cl && u.cl.length) u.cl.forEach(function (id) { var c = unitById(st, id); if (c) { c.x = u.x; c.y = u.y; } }); });
}
function shipFollow(st, u, d, dt) {
  var sp = d.sp * (u.sup > 5 ? 1 : 0.6) * dt / 60;
  var done = followPath(u, sp);
  u.sup = Math.max(0, u.sup - 0.12 * dt / 60);
  return done;
}
function moveShip(st, u, dt) {
  var d = U[u.type], o = u.orders[0];
  if (u.str < 30 && !(o && o.ret)) { var pt = portFor(st, u.side, u); if (pt) { u.orders = [{ k: 'move', x: pt.x, y: pt.y, ret: 1 }]; u.path = null; o = u.orders[0]; ev(st, 'lost', d.n + ' is badly damaged and returning to port.', u.x, u.y); } }
  if (!o) return;
  if (o.k === 'hold') return;
  if (o.k === 'wait') { o.h -= dt / 60; if (o.h <= 0) u.orders.shift(); return; }
  var tx, ty;
  if (o.k === 'hunt') {
    var e = unitById(st, o.cid), c = st.con[u.side][o.cid];
    if (!e || e.str <= 0) { u.orders.shift(); u.path = null; return; }
    if (!c) { u.orders.shift(); u.path = null; ev(st, 'idle', d.n + ' lost the contact.', u.x, u.y); return; }
    tx = c.x; ty = c.y; var ws = snapWater(tx, ty, 30); if (!ws) { u.orders.shift(); return; } tx = ws.x; ty = ws.y;
    if (dist(u.x, u.y, e.x, e.y) < Math.min(d.rng * 0.7, 20) && c.lv === 'id') return;
    if (!u.path || !u.path.length || dist(u.pathT ? u.pathT.x : 0, u.pathT ? u.pathT.y : 0, tx, ty) > 25) { u.path = findPath('n', u.x, u.y, tx, ty); u.pathT = { x: tx, y: ty }; if (!u.path) { u.orders.shift(); return; } }
    shipFollow(st, u, d, dt); return;
  }
  if (o.k === 'bombard') {
    if (dist(u.x, u.y, o.x, o.y) <= d.rng * 0.85) { o.on = true; return; }
    if (!o.sx) { var sw = snapWater(o.x, o.y, d.rng * 0.8); if (!sw) { u.orders.shift(); ev(st, 'idle', d.n + ': target is out of reach of the guns.', u.x, u.y); return; } o.sx = sw.x; o.sy = sw.y; }
    if (!u.path) { u.path = findPath('n', u.x, u.y, o.sx, o.sy); if (!u.path) { u.orders.shift(); return; } }
    if (shipFollow(st, u, d, dt)) { u.path = null; if (dist(u.x, u.y, o.x, o.y) > d.rng) { u.orders.shift(); ev(st, 'idle', d.n + ': target is out of reach of the guns.', u.x, u.y); } }
    return;
  }
  if (o.k === 'airstrike') {
    var rad = d.cvw.rad * 0.75;
    if (dist(u.x, u.y, o.x, o.y) <= rad) {
      u.path = null;
      if (u.cvRdy > st.t) return;
      var cost = 0.8; if (st.pts[u.side] < cost) return;
      st.pts[u.side] -= cost; u.cvRdy = st.t + 240; st.stats.sorties[u.side]++;
      var o2 = { k: o.sub || 'cas', x: o.x, y: o.y, node: o.node };
      resolveStrike(st, u, o2);
      if (o.rep) return; u.orders.shift(); return;
    }
    if (!o.sx) { var sw2 = snapWater(o.x, o.y, rad * 0.9); if (!sw2) { u.orders.shift(); ev(st, 'idle', d.n + ': target is out of air-wing range.', u.x, u.y); return; } o.sx = sw2.x; o.sy = sw2.y; }
    if (!u.path) { u.path = findPath('n', u.x, u.y, o.sx, o.sy); if (!u.path) { u.orders.shift(); return; } }
    if (shipFollow(st, u, d, dt)) { u.path = null; if (dist(u.x, u.y, o.x, o.y) > d.cvw.rad) { u.orders.shift(); ev(st, 'idle', d.n + ': target is out of air-wing range.', u.x, u.y); } }
    return;
  }
  if (o.k === 'lift') {
    var cu = o.stage === 'drop' ? null : unitById(st, o.uid);
    if (o.stage !== 'drop') {
      if (!cu || cu.str <= 0 || cu.cargoed) { u.orders.shift(); u.path = null; return; }
      if (u.cl.length >= d.lift) { u.orders.shift(); return; }
      var lw = snapWater(cu.x, cu.y, 40); if (!lw) { u.orders.shift(); return; }
      if (dist(u.x, u.y, lw.x, lw.y) < 8 || dist(u.x, u.y, cu.x, cu.y) < 10) { cu.cargoed = true; cu.orders = []; cu.path = null; u.cl.push(cu.id); o.stage = 'drop'; u.path = null; if (u.side === st.side) ev(st, 'info', d.n + ' has loaded ' + U[cu.type].n + '.', u.x, u.y); return; }
      if (!u.path) { u.path = findPath('n', u.x, u.y, lw.x, lw.y); if (!u.path) { u.orders.shift(); return; } }
      shipFollow(st, u, d, dt); return;
    }
    if (dist(u.x, u.y, o.wx, o.wy) < 8) {
      var land = snapLand(o.x, o.y); u.cl.forEach(function (id, i) { var c = unitById(st, id); if (c) { c.cargoed = false; c.x = land.x + i * 3; c.y = land.y; c.mor = Math.max(10, c.mor - 8); c.path = null; } });
      if (u.side === st.side) ev(st, 'idle', d.n + ' has landed troops.', u.x, u.y);
      u.cl = []; u.orders.shift(); u.path = null; return;
    }
    if (!u.path) { u.path = findPath('n', u.x, u.y, o.wx, o.wy); if (!u.path) { u.orders.shift(); return; } }
    shipFollow(st, u, d, dt); return;
  }
  // move / amove
  if (o.k === 'amove' && u.bt > 0) return;
  if (!u.path) { u.path = findPath('n', u.x, u.y, o.x, o.y); if (!u.path) { u.orders.shift(); ev(st, 'idle', d.n + ': no sea route.', u.x, u.y); return; } }
  if (shipFollow(st, u, d, dt)) { u.orders.shift(); u.path = null; if (!u.orders.length && u.side === st.side) ev(st, 'idle', d.n + ' has arrived.', u.x, u.y); }
}
function fireMissiles(st, a, b) {
  var da = U[a.type], db = U[b.type], n = Math.min(Math.floor(a.msl), da.salvo || 2), hits = 0;
  a.msl -= n; a.mslT = st.t + 14; a.bt = 60; if (da.sub) a.reveal = st.t + 40;
  var pk = 0.8 / (1 + 0.22 * (db.aaP || 0));
  for (var i = 0; i < n; i++) {
    var hit = rnd(st) < pk; if (hit) hits++;
    st.fx.push({ k: 'shell', x0: a.x, y0: a.y, x1: b.x + rr(st, -1, 1), y1: b.y + rr(st, -1, 1), t: st.t, s: a.side, m: 1 });
  }
  var dm = dmul(st, a) * hits * (da.mdmg || 22) * (a.mor > 30 ? 1 : 0.6) / (1 + 0.12 * (db.d - 3 > 0 ? db.d - 3 : 0));
  b.str -= dm; b.mor -= dm * 0.5; b.bt = 60; b.hit = st.t;
  var msg = da.n.split(' (')[0] + ' fired ' + n + ' ' + (da.mname || 'missiles') + ' at ' + db.n.split(' (')[0] + ': ' + hits + ' hit' + (hits === 1 ? '' : 's') + ' (' + Math.floor(a.msl) + ' left).';
  uhist(st, a, 'Fired ' + n + ' ' + (da.mname || 'missiles') + ' (' + hits + ' hits, ' + Math.floor(a.msl) + ' left).');
  if (b.side === st.side) { logm(st, msg, 'bad'); if (st.set.pause.battle) ev(st, 'battle', db.n + ' hit by missiles', b.x, b.y); } else if (a.side === st.side) logm(st, msg, hits ? 'good' : '');
  if (b.str <= 5) { killUnit(st, b, a.side); if (a.side === st.side) logm(st, db.n + ' sunk by missiles.', 'good'); else logm(st, da.n + ' sank ' + db.n + '.', 'bad'); }
}
function navalCombat(st, dt, ships) {
  var K = 14, hr = dt / 60, con;
  ships.forEach(function (a) {
    if (a.str <= 0) return; var da = U[a.type];
    con = st.con[a.side];
    var stN = a.stance || 'aggr'; if (stN === 'neut') return; if (stN === 'pass' && !(st.t - (a.hit || -1e9) < 30)) return;
    // ---- against ships
    if (da.msl) {
      if (a.msl < da.msl && ownCityNear(st, a.side, a.x, a.y, 15) && !(a.bt > 0)) a.msl = Math.min(da.msl, a.msl + 0.5 * dt / 60);
      if (a.msl >= 1 && !(a.mslT > st.t)) {
        var mt = null, md = 1e9;
        ships.forEach(function (b) {
          if (b.side === a.side || b.str <= 0 || U[b.type].sub) return; var dd = dist(a.x, a.y, b.x, b.y);
          var c0 = con[b.id]; if (dd > da.rng || dd >= md || !(c0 && c0.lv === 'id')) return; md = dd; mt = b;
        });
        if (mt) fireMissiles(st, a, mt);
      }
    }
    var sa = da.msl ? (a.msl >= 1 ? 0 : da.sa * 0.25) : da.sa, rngS = (da.msl && a.msl < 1) ? Math.min(da.rng, 12) : da.rng;
    if (sa > 0) {
      var best = null, bd = 1e9;
      ships.forEach(function (b) {
        if (b.side === a.side || b.str <= 0) return; var db = U[b.type], dd = dist(a.x, a.y, b.x, b.y);
        if (dd > rngS || dd >= bd) return;
        if (db.sub) { var can = da.sub ? dd <= 10 : (da.asw > 0 && dd <= da.asw * 6); if (!can && !(st.t < (b.reveal || 0) && dd <= 20)) return; }
        else { var c = con[b.id]; if (!(c && c.lv === 'id') && dd > 15) return; }
        bd = dd; best = b;
      });
      if (best) {
        var db2 = U[best.type], pw = best.sub ? (da.sub ? da.sa * 0.7 : da.asw * 1.1) : sa;
        var dm = dmul(st, a) * pw * (a.str / 100) * supF(a) * morF(a) * hr * K / (db2.d + 1.5) * rr(st, 0.7, 1.3);
        if (da.sub) a.reveal = st.t + 40;
        best.str -= dm; best.mor -= dm * 0.3; a.bt = 60; best.bt = 60; a.sup = Math.max(0, a.sup - 0.25 * hr);
        if (best.side === st.side && st.set.pause.battle) ev(st, 'battle', U[best.type].n + ' under attack', best.x, best.y);
        if (best.str <= 5) { killUnit(st, best, a.side); if (a.side === st.side) logm(st, U[best.type].n + ' sunk by ' + da.n + '.', 'good'); else logm(st, da.n + ' sank ' + U[best.type].n + '.', 'bad'); }
      }
    }
    // ---- shore bombardment
    var o = a.orders[0];
    if (o && o.k === 'bombard' && da.shore > 0 && dist(a.x, a.y, o.x, o.y) <= da.rng) {
      var tg = [];
      st.units.forEach(function (e) { if (e.side === a.side || e.str <= 0 || e.cargoed || U[e.type].air || U[e.type].heli || U[e.type].naval) return; var dd = dist(e.x, e.y, o.x, o.y); if (dd < 7) tg.push({ e: e, d: dd }); });
      tg.sort(function (x, y) { return x.d - y.d; });
      tg.slice(0, 3).forEach(function (t, i) {
        var e = t.e, ed = U[e.type], soft = (ed.cls === 'train' || ed.cls === 'convoy' || ed.cls === 'arty' || ed.cls === 'aa' || ed.cls === 'eng') ? 1.5 : 1;
        var dm = da.shore * (a.str / 100) * supF(a) * hr * 2.1 * soft * (i ? 0.6 : 1) / (ed.d * (e.dig > 0 ? 1 + 0.4 * e.dig : 1) + 2) * rr(st, 0.7, 1.3);
        e.str -= dm; e.mor -= dm * 0.6; e.bt = 60; if (e.side === st.side) ev(st, 'battle', ed.n + ' under naval fire', e.x, e.y);
        if (e.str <= 6) killUnit(st, e, a.side);
      });
      a.sup = Math.max(0, a.sup - 0.5 * hr); a.bt = 60;
    }
  });
  // coastal artillery and ground fire against ships
  st.units.forEach(function (g) {
    var dg = U[g.type]; if (g.str <= 0 || !dg.ground || dg.cls !== 'arty' || g.cargoed || g.broken) return;
    var best = null, bd = dg.rng;
    ships.forEach(function (b) { if (b.side === g.side || b.str <= 0 || U[b.type].sub) return; var dd = dist(g.x, g.y, b.x, b.y); if (dd < bd) { bd = dd; best = b; } });
    if (best) { var dm = dg.a * (g.str / 100) * supF(g) * hr * 5 / (U[best.type].d + 1.5); best.str -= dm; best.bt = 60; g.sup = Math.max(0, g.sup - 0.4 * hr); if (best.str <= 5) killUnit(st, best, g.side); }
  });
}

/* ============================================================ ground combat */
function hashUnits(st, size) {
  var h = {}; st.units.forEach(function (u) { if (u.str <= 0 || U[u.type].air || U[u.type].heli || U[u.type].naval || u.cargoed) return; var k = Math.floor(u.x / size) + ',' + Math.floor(u.y / size); (h[k] = h[k] || []).push(u); });
  return h;
}
function nearbyH(h, size, x, y, r, f) {
  var x0 = Math.floor((x - r) / size), x1 = Math.floor((x + r) / size), y0 = Math.floor((y - r) / size), y1 = Math.floor((y + r) / size);
  for (var i = x0; i <= x1; i++) for (var j = y0; j <= y1; j++) { var b = h[i + ',' + j]; if (b) for (var k = 0; k < b.length; k++) f(b[k]); }
}
function airSupportMult(st, side) { return 1; }
function killUnit(st, u, by) {
  if (u.str > 0) u.str = 0; u.dead = true;
  st.stats.lost[u.side]++; if (by) st.stats.kills[by]++;
  var d = U[u.type];
  if (!d.air && d.cls !== 'train' && d.cls !== 'convoy') st.will[u.side] -= d.cls === 'gnd' ? 0.4 : d.cls === 'carrier' ? 1.6 : d.naval ? 0.2 : 0.1;
  if (by && (d.cls === 'gnd' || d.cls === 'carrier')) st.wins[by] += d.cls === 'carrier' ? 1 : 0.5;
  if (d.naval && u.cl && u.cl.length) u.cl.forEach(function (id) { var c = unitById(st, id); if (c) { c.str = 0; c.dead = true; st.stats.lost[c.side]++; } });
  if (u.riders && u.riders.length) {   // the crew and passengers of a destroyed carrier: half bail out and fight on
    u.riders.forEach(function (id) {
      var r = unitById(st, id); if (!r || r.str <= 0) return;
      if (rnd(st) < 0.5) { r.cargoed = false; r.rideOn = null; r.x = u.x; r.y = u.y; r.str = Math.max(8, r.str * 0.55); r.mor = Math.max(5, r.mor - 25); r.orders = []; r.path = null; uhist(st, r, 'Bailed out of the destroyed carrier.'); }
      else { r.str = 0; r.dead = true; st.stats.lost[r.side]++; }
    });
    u.riders = [];
  }
  if (u.side === st.side && st.set.pause.lost) ev(st, 'lost', d.n + ' destroyed.', u.x, u.y);
  else if (u.side === st.side) ev(st, 'info', d.n + ' destroyed.', u.x, u.y);
}
function ownCityNear(st, side, x, y, r) { for (var i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === side && dist(x, y, MAP.cities[i][1], MAP.cities[i][2]) < r) return true; return false; }
function reloadMissiles(st, dt) {
  st.units.forEach(function (u) { var d = U[u.type]; if (!d.msl || d.naval || u.str <= 0 || u.cargoed) return; var o = u.orders[0]; if (o && o.k === 'fire') return; if (u.msl < d.msl && ownCityNear(st, u.side, u.x, u.y, 18)) u.msl = Math.min(d.msl, u.msl + 0.35 * dt / 60); });
}
function combat(st, dt) {
  reloadMissiles(st, dt);
  var size = 20, h = hashUnits(st, size), dmg = {}, hurt = {}, src = {};
  st.units.forEach(function (u) {
    if (u.str <= 0 || u.broken) return;
    var d = U[u.type]; if (!d.ground || d.heli) return;
    var isArty = d.cls === 'arty', stance = u.stance || 'aggr';
    var R = isArty ? d.rng : (stance === 'aggr' ? Math.max(9, zoneR(u)) : 9);
    var canFire = d.a > 0 && (d.cls === 'gnd' || d.cls === 'recon' || isArty);
    if (!canFire) return;
    if (stance === 'neut') return;                                             // neutral: never opens fire by itself
    if (stance === 'pass' && !(st.t - (u.hit || -1e9) < 30)) return;          // passive: only shoots back after being attacked
    var o = u.orders[0], moving = o && o.k === 'move'; if (o && o.k === 'fire') return;
    var tg = [];
    nearbyH(h, size, u.x, u.y, R, function (e) {
      if (e.side === u.side || e.str <= 0 || e.hidden) return; var dd = dist(u.x, u.y, e.x, e.y); if (dd <= R) tg.push([dd, e]);
    });
    if (!tg.length) return;
    if (moving && !isArty) return;
    tg.sort(function (a, b) { return a[0] - b[0]; });
    if (u.hidden && tg[0][0] > 4) return;   // an ambusher waits for the enemy to come close
    if (u.hidden) { var b0 = tg[0][1]; u.hidden = false; u.amb = 0; u.ambT = st.t + 45; uhist(st, u, 'Sprang an ambush on ' + U[b0.type].n.split(' (')[0] + '.'); if (u.side === st.side) ev(st, 'info', 'Ambush sprung near ' + placeName(u.x, u.y) + '.', u.x, u.y); }
    var nT = (stance === 'aggr' && !isArty) ? Math.min(4, tg.length) : 1, share = nT > 1 ? Math.min(1.6, 1 + 0.2 * (nT - 1)) / nT : 1;   // aggressive: fires at everything in its circle
    var base = dmul(st, u) * d.a * (u.str / 100) * supF(u) * morF(u);
    if (isArty) base *= 0.9;
    for (var ti = 0; ti < nT; ti++) {
      var best = tg[ti][1];
      var ed = U[best.type], defv = ed.d * (best.dig > 0 ? 1 + 0.45 * best.dig : 1) * (ownCityNear(st, best.side, best.x, best.y, 7) ? 1.25 : 1);
      var soft = (ed.cls === 'train' || ed.cls === 'convoy' || ed.cls === 'eng' || ed.cls === 'ssm' || ed.cls === 'aa') ? 1.6 : ed.cls === 'arty' ? 1.3 : 1;
      var mult = 1; if (best.dig <= 0 && u.orders[0] && u.orders[0].k === 'amove') mult = 1.1; if (u.ambT > st.t) mult *= 1.8;
      var dd2 = 3.2 * base * mult * soft / (defv + 2) * dt / 60 * share;
      dmg[best.id] = (dmg[best.id] || 0) + dd2; hurt[best.id] = best; src[best.id] = u;
      if (isArty && !(u.fxT > st.t) && ti === 0) { u.fxT = st.t + 9; for (var fk = 0; fk < 2; fk++) st.fx.push({ k: 'shell', x0: u.x, y0: u.y, x1: best.x + rr(st, -2, 2), y1: best.y + rr(st, -2, 2), t: st.t, s: u.side }); }
      best.bt = 60; best.hit = st.t; u.last = best.id; best.lastBy = u.side;
    }
    u.bt = 60; if (!isArty) u.sup = Math.max(0, u.sup - 0.9 * dt / 60 * 2);
    if (isArty) u.sup = Math.max(0, u.sup - 0.5 * dt / 60 * 2);
  });
  for (var id in dmg) {
    var e = hurt[id], a = dmg[id]; if (e.str <= 0) continue;
    e.str -= a; e.mor -= a * 0.55 + 0.1; e.dig = Math.max(0, e.dig - 0.02);
    var sr = src[id]; if (sr) { uhist(st, e, 'Under attack by ' + U[sr.type].n + ' (str ' + Math.round(Math.max(0, e.str)) + '%).'); uhist(st, sr, 'Engaging ' + U[e.type].n + '.'); }
    st.stats.lost.dmg = (st.stats.lost.dmg || 0);
    if (e.side === st.side) ev(st, 'battle', U[e.type].n + ' under attack', e.x, e.y);
    if (e.str <= 6) { if (sr) { sr.kills++; uhist(st, sr, 'Destroyed ' + U[e.type].n + '.'); } killUnit(st, e, OTHER[e.side]); }
    else if ((e.str < 32 || e.mor < 18) && !e.broken && U[e.type].cls === 'gnd') { e.broken = true; uhist(st, e, 'Broke and is falling back.'); e.orders = []; e.path = null; ev(st, 'lost', U[e.type].n + ' is broken and falling back.', e.x, e.y); logm(st, U[e.type].n + ' broke and is falling back.', e.side === st.side ? 'bad' : 'good'); }
  }
  st.units = st.units.filter(function (u) { return !u.dead; });
  // rest and recover
  st.units.forEach(function (u) {
    var d = U[u.type]; if (d.air) return;
    if (u.bt > 0) { u.bt -= dt; return; }
    if (u.broken && u.mor > 50 && u.str > 25) u.broken = false;
    var nearOwn = ownCityNear(st, u.side, u.x, u.y, 25);
    if (u.mor < 100) u.mor = Math.min(100, u.mor + (nearOwn ? 0.45 : 0.15) * dt / 60);
    if (nearOwn && u.sup > 30 && u.str < 100 && !d.heli) u.str = Math.min(100, u.str + 0.25 * dt / 60);
    if (inFallout(st, u.x, u.y) && d.ground) { u.str -= 0.4 * dt / 60; u.mor -= 0.2; if (u.str <= 3) killUnit(st, u, null); }
  });
}

/* ============================================================ capture, supply, repairs */
function capture(st, dt) {
  var size = 20, h = hashUnits(st, size), toNeutral = {};
  function occupiers(x, y, r) {
    var c = { NATO: 0, PACT: 0 };
    nearbyH(h, size, x, y, r, function (u) { var d = U[u.type]; if ((d.cls === 'gnd' || d.cls === 'recon' || d.cls === 'eng') && dist(x, y, u.x, u.y) <= r && !u.broken) c[u.side] += u.str / 100 + 0.1; });
    return c;
  }
  for (var i = 0; i < MAP.cities.length; i++) {
    var cd = st.cd[i], C = MAP.cities[i], oc = occupiers(C[1], C[2], 7);
    var other = cd.o === 'NATO' ? 'PACT' : cd.o === 'PACT' ? 'NATO' : null;
    if (cd.o === 'NEUT') { var side = oc.NATO > 0 ? 'NATO' : oc.PACT > 0 ? 'PACT' : null; if (side) neutralViolation(st, side, C[0], C[1], C[2]); continue; }
    if (oc[other] > 0 && oc[cd.o] === 0) { cd.cp = Math.min(1, cd.cp + dt / 150); cd.cs = other; if (cd.cp >= 1) flipCity(st, i, other); }
    else if (cd.cp > 0) cd.cp = Math.max(0, cd.cp - dt / 400);
    cd.inf = Math.min(100, cd.inf + 0.12 * dt / 60 * 5);
  }
  for (i = 0; i < MAP.air.length; i++) {
    var ad = st.ad[i], A = MAP.air[i], oc2 = occupiers(A[2], A[3], 6), oth = ad.o === 'NATO' ? 'PACT' : ad.o === 'PACT' ? 'NATO' : null;
    if (ad.o === 'NEUT') continue;
    if (oc2[oth] > 0 && oc2[ad.o] === 0) { ad.cp = Math.min(1, ad.cp + dt / 90); if (ad.cp >= 1) flipAF(st, i, oth); }
    else if (ad.cp > 0) ad.cp = Math.max(0, ad.cp - dt / 300);
    if (ad.dmg > 0) {
      var eng = 0; for (var k = 0; k < st.units.length; k++) { var u = st.units[k]; if (u.side === ad.o && U[u.type].cls === 'eng' && dist(u.x, u.y, A[2], A[3]) < 15) eng++; }
      ad.dmg = Math.max(0, ad.dmg - (0.012 + eng * 0.02) * dt / 60);
    }
  }
  st.cuts = st.cuts.filter(function (c) {
    var eng = 0; st.units.forEach(function (u) { if (U[u.type].cls === 'eng' && dist(u.x, u.y, c.x, c.y) < 20) eng++; });
    c.until -= dt * (eng ? 2 : 0); return c.until > 0;
  });
}
function neutralViolation(st, side, name, x, y) {
  var key = side + name; if (st.viol[key] && st.t - st.viol[key] < 720) return; st.viol[key] = st.t;
  st.pol.world += side === 'NATO' ? -4 : 4; st.pol[side].coh -= 3; st.pol[side].pc = Math.max(0, st.pol[side].pc - 1);
  ev(st, 'pol', side + ' forces entered neutral ' + name + '. World opinion shifts.', x, y); logm(st, side + ' violated neutrality at ' + name + '.', side === st.side ? 'bad' : 'warn');
}
var BCODE = { NATO: 1, PACT: 2 }, BV = 0;
function paintCityDisc(st, i, side) {
  var C = MAP.cities[i], R = 16 + Math.min(18, C[3] / 60), cx = Math.floor(C[1] / G.cell), cy = Math.floor(C[2] / G.cell), rc = Math.ceil(R / G.cell); st.bchg = st.bchg || {};
  for (var y = cy - rc; y <= cy + rc; y++) for (var x = cx - rc; x <= cx + rc; x++) {
    if (x < 0 || y < 0 || x >= G.w || y >= G.h) continue; var k = y * G.w + x, b = G.bloc0[k];
    if ((b === 1 || b === 2) && dist((x + .5) * G.cell, (y + .5) * G.cell, C[1], C[2]) <= R) st.bchg[k] = BCODE[side];
  }
}
// repaint territory: cells near a captured city take the new owner's colour (land cells of the two blocs only)
function refreshBloc(st) {
  setEra(st.era); G.bloc.set(G.bloc0);
  for (var i = 0; i < MAP.cities.length; i++) {
    var C = MAP.cities[i], o0 = ERA === 'm' ? ownerM(C[4]) : OWN[C[6]], o1 = st.cd[i].o;
    if (!o0 || !BCODE[o1] || o0 === o1) continue;
    var R = 16 + Math.min(18, C[3] / 60), cx = Math.floor(C[1] / G.cell), cy = Math.floor(C[2] / G.cell), rc = Math.ceil(R / G.cell);
    for (var y = cy - rc; y <= cy + rc; y++) for (var x = cx - rc; x <= cx + rc; x++) {
      if (x < 0 || y < 0 || x >= G.w || y >= G.h) continue; var k = y * G.w + x, b = G.bloc0[k];
      if ((b === 1 || b === 2) && dist((x + .5) * G.cell, (y + .5) * G.cell, C[1], C[2]) <= R) G.bloc[k] = BCODE[o1];
    }
  }
  if (st.bchg) for (var kk in st.bchg) G.bloc[kk] = st.bchg[kk];
  st.blocV = ++BV;
}
// ---- zones of control: every ground fighting unit holds a circle (bigger = stronger).
// No enemy ground unit inside it -> the unit takes the land inside (territory repaints to its side).
function zoneR(u) {
  var d = U[u.type]; if (!d.ground || d.heli || d.naval || d.air || u.str <= 0 || u.cargoed) return 0;
  if (d.cls === 'train' || d.cls === 'convoy' || d.cls === 'eng') return 0;
  var r = (8 + 0.9 * ((d.a || 0) + (d.d || 0))) * (0.55 + 0.45 * Math.min(100, u.str) / 100);
  if (d.cls === 'arty' || d.cls === 'ssm' || d.cls === 'aa') r *= 0.6;
  return Math.max(9, Math.min(34, r));
}
function zoneStep(st, dt) {
  st.zt = (st.zt || 0) + dt; if (st.zt < 15) return; st.zt = 0;
  var gu = st.units.filter(function (u) { return zoneR(u) > 0 && u.state !== 'fly'; }), changed = false;
  st.bchg = st.bchg || {};
  gu.forEach(function (u) {
    var R = zoneR(u), code = BCODE[u.side]; if (!code || st.deploy) return;
    for (var i = 0; i < gu.length; i++) { var e = gu[i]; if (e.side !== u.side && dist(e.x, e.y, u.x, u.y) <= Math.max(R, zoneR(e))) return; }   // contested: nobody takes it
    var cx = Math.floor(u.x / G.cell), cy = Math.floor(u.y / G.cell), rc = Math.ceil(R / G.cell);
    for (var y = cy - rc; y <= cy + rc; y++) for (var x = cx - rc; x <= cx + rc; x++) {
      if (x < 0 || y < 0 || x >= G.w || y >= G.h) continue; var k = y * G.w + x, b = G.bloc[k];
      if ((b === 1 || b === 2) && b !== code && dist((x + .5) * G.cell, (y + .5) * G.cell, u.x, u.y) <= R) { G.bloc[k] = code; st.bchg[k] = code; changed = true; }
    }
  });
  if (changed) st.blocV = ++BV;
}
// ---- statistics: expected damage (percent of the target's strength) at full strength/supply/morale, open ground, no digging in
function dmul(st, u) { var m = st.dmgMul && st.dmgMul[u.type]; return m == null ? 1 : m; }
function setDmgMul(st, types, m) { st.dmgMul = st.dmgMul || {}; types.forEach(function (t) { if (Math.abs(m - 1) < 0.001) delete st.dmgMul[t]; else st.dmgMul[t] = m; }); }
function dmgInfo(aid, tid, mul) {
  var a = U[aid], e = U[tid], r = {}; if (!a || !e) return r;
  var eg = e.ground && !e.heli && !e.air && !e.naval, en = e.naval && !e.sub;
  if (eg && a.ground && !a.heli && (a.cls === 'gnd' || a.cls === 'recon' || a.cls === 'arty') && a.a > 0) {
    var soft = (e.cls === 'train' || e.cls === 'convoy' || e.cls === 'eng' || e.cls === 'ssm' || e.cls === 'aa') ? 1.6 : e.cls === 'arty' ? 1.3 : 1;
    r.fire = 3.2 * a.a * (a.cls === 'arty' ? 0.9 : 1) * soft / (e.d + 2);
  }
  if (eg && a.cls === 'arty' && a.a > 0) { var sb = (e.cls === 'train' || e.cls === 'convoy' || e.cls === 'eng' || e.cls === 'aa' || e.cls === 'arty') ? 1.5 : 1; r.barrage = 10 * a.a * 1.6 * sb / (e.d + 2); }
  if (eg && a.cls === 'ssm' && a.cdmg) { var sm = (e.cls === 'train' || e.cls === 'convoy' || e.cls === 'eng' || e.cls === 'aa' || e.cls === 'arty' || e.cls === 'ssm') ? 1.7 : 1; r.missile = a.cdmg * sm / (e.d + 1.5); }
  if ((eg || en) && (a.air || a.heli) && a.a2g > 0 && (a.roles ? a.roles.indexOf('cas') >= 0 : a.heli)) { var sl = (e.cls === 'train' || e.cls === 'convoy' || e.cls === 'eng' || e.cls === 'arty' || e.cls === 'ssm' || e.cls === 'aa') ? 1.6 : 1; if (eg) r.loiter = a.a2g * 0.16 * 60 * sl / (e.d + 2); }
  if (en && a.naval && a.msl) { var pk = 0.8 / (1 + 0.22 * (e.aaP || 0)); r.salvo = (a.salvo || 2) * pk * (a.mdmg || 22) / (1 + 0.12 * Math.max(0, e.d - 3)); }
  if (mul != null && mul !== 1) for (var kk in r) r[kk] *= mul;
  return r;
}
function flipCity(st, i, side) {
  st.units.forEach(function (u) { if (u.side === side && u.str > 0 && dist(u.x, u.y, MAP.cities[i][1], MAP.cities[i][2]) < 9 && (U[u.type].ground)) uhist(st, u, 'Took ' + MAP.cities[i][0] + '.'); });
  var cd = st.cd[i], C = MAP.cities[i], was = cd.o; cd.o = side; cd.cp = 0; paintCityDisc(st, i, side); refreshBloc(st); cd.stk = Math.floor(cd.stk * 0.4); cd.inf = Math.max(20, cd.inf - 25);
  var wv = 0.6 + C[3] / 500 + (C[5] ? 6 : 0);
  st.will[was] -= wv * 0.7; st.will[side] += wv * 0.3;
  logm(st, side + ' takes ' + C[0] + (C[5] ? ' (capital)' : '') + '.', side === st.side ? 'good' : 'bad');
  ev(st, 'city', side + ' takes ' + C[0] + '.', C[1], C[2]);
  if (was === 'PACT' || was === 'NATO') st.pol[was].coh -= C[5] ? 6 : 0.6;
}
function flipAF(st, i, side) {
  var ad = st.ad[i], A = MAP.air[i], was = ad.o; ad.o = side; ad.cp = 0; ad.dmg = 0.3;
  st.units.forEach(function (u) { if (U[u.type].air && u.base === i && u.state === 'base' && u.side === was) { u.str = 0; u.dead = true; st.stats.lost[was]++; } });
  logm(st, side + ' seizes ' + A[0] + ' airfield.', side === st.side ? 'good' : 'bad');
  ev(st, 'city', side + ' seizes ' + A[0] + ' airfield.', A[2], A[3]);
}
/* rail connectivity: stock refills fast where a rail line from the rear reaches the city */
function railFlood(st) {
  var W = G.w, N = G.n;
  ['NATO', 'PACT'].forEach(function (side) {
    var foe = OTHER[side], cutCells = null;
    var vis = new Uint8Array(N), queue = [];
    // sources: own cities far from the enemy (rear)
    for (var i = 0; i < MAP.cities.length; i++) {
      if (st.cd[i].o !== side) continue; var C = MAP.cities[i], near = 1e9;
      st.units.forEach(function (e) { if (e.side === foe && U[e.type].ground && !U[e.type].heli) { var d = dist(C[1], C[2], e.x, e.y); if (d < near) near = d; } });
      st.cd[i].rear = near > 200 ? 1 : 0;
      if (st.cd[i].rear) { var c = cellOf(C[1], C[2]); if (!vis[c]) { vis[c] = 1; queue.push(c); } }
    }
    var cuts = st.cuts, enemyCities = [];
    for (i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === foe) enemyCities.push(cellOf(MAP.cities[i][1], MAP.cities[i][2]));
    var blocked = new Uint8Array(N); enemyCities.forEach(function (c) { blocked[c] = 1; });
    var qi = 0;
    while (qi < queue.length) {
      var cur = queue[qi++], cx = cur % W, cy = (cur / W) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= G.h) continue; var ni = ny * W + nx;
        if (vis[ni] || !G.railD[ni] || blocked[ni]) continue;
        var px = (nx + .5) * G.cell, py = (ny + .5) * G.cell, cut = false; for (var k = 0; k < cuts.length; k++) if (dist(px, py, cuts[k].x, cuts[k].y) < cuts[k].r) { cut = true; break; }
        if (cut) continue; vis[ni] = 1; queue.push(ni);
      }
    }
    for (i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === side) {
      var cc = cellOf(MAP.cities[i][1], MAP.cities[i][2]), ok = vis[cc];
      if (!ok) for (var ddy = -2; ddy <= 2 && !ok; ddy++) for (var ddx = -2; ddx <= 2; ddx++) { var ci = cc + ddy * W + ddx; if (ci >= 0 && ci < N && vis[ci]) { ok = 1; break; } }
      st.cd[i].conn = (ok || st.cd[i].rear) ? 1 : 0;
    }
  });
}
function supplyStep(st, dt) {
  var hr = dt / 60;
  for (var i = 0; i < MAP.cities.length; i++) {
    var cd = st.cd[i]; if (cd.o !== 'NATO' && cd.o !== 'PACT') continue;
    var rate = (cd.conn ? 1.4 : 0.15) * (cd.inf / 100) * (0.6 + Math.min(1.6, MAP.cities[i][3] / 1500)) ;
    cd.stk = Math.min(100, cd.stk + rate * hr * 0.8);
  }
  var size = 25, nodes = {};
  st.units.forEach(function (u) {
    var d = U[u.type]; if (d.air || d.heli || u.str <= 0 || u.sup >= 100) return;
    var need = 100 - u.sup, best = -1, bd = 30;
    for (var i = 0; i < MAP.cities.length; i++) {
      if (st.cd[i].o !== u.side || st.cd[i].stk < 2) continue; var dd = dist(u.x, u.y, MAP.cities[i][1], MAP.cities[i][2]); if (dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) { var take = Math.min(need, 9 * hr * (d.cls === 'gnd' ? 1 : 0.5) * 1, st.cd[best].stk * 1.2); u.sup += take; st.cd[best].stk -= take * 0.6; }
    else if (u.side) {
      // convoys within 15 km of a unit top it up
      for (var k = 0; k < st.units.length; k++) { var c = st.units[k]; if (c.side === u.side && U[c.type].cls === 'convoy' && c.load > 0 && dist(u.x, u.y, c.x, c.y) < 15) { var t2 = Math.min(need, c.load, 12 * hr); u.sup += t2; c.load -= t2; break; } }
    }
  });
  // convoys refill from nearby cities
  st.units.forEach(function (u) {
    if (U[u.type].cls === 'convoy' && !u.orders.length && u.load < U[u.type].cap) for (var i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === u.side && st.cd[i].stk > 10 && dist(u.x, u.y, MAP.cities[i][1], MAP.cities[i][2]) < 15) { var t = Math.min(U[u.type].cap - u.load, 10 * hr, st.cd[i].stk); u.load += t; st.cd[i].stk -= t; break; }
  });
}

/* ============================================================ air + helicopters */
var TURN = { fighter: 3, strike: 4, bomber: 8, recon: 3, awacs: 6, tanker: 3, heli_atk: 2, heli_trans: 1 };
function nearestFriendlyLanding(st, u, maxd) {
  var d = U[u.type], best = null, bd = maxd || 1e9;
  for (var i = 0; i < MAP.air.length; i++) if (st.ad[i].o === u.side && st.ad[i].dmg < 0.9) { var dd = dist(u.x, u.y, MAP.air[i][2], MAP.air[i][3]); if (dd < bd) { bd = dd; best = { af: i, x: MAP.air[i][2], y: MAP.air[i][3], d: dd }; } }
  if (d.heli) for (i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === u.side) { var d2 = dist(u.x, u.y, MAP.cities[i][1], MAP.cities[i][2]); if (d2 < bd) { bd = d2; best = { city: i, x: MAP.cities[i][1] + 3, y: MAP.cities[i][2], d: d2 }; } }
  return best;
}
function sortieCost(st, u) { var d = U[u.type]; return d.cost * 0.03 * (u.base != null && u.base === u.home ? 0.6 : 1) * (d.heli ? 0.6 : 1); }
function takeOff(st, u) {
  var d = U[u.type], side = u.side;
  if (d.air) {
    if (u.base == null || st.ad[u.base].o !== side || st.ad[u.base].dmg >= 0.6) return false;
    if (u.rdy > st.t || u.str < 25) return false;
  } else if (u.rdy > st.t || u.str < 20) return false;
  var c = sortieCost(st, u); if (st.pts[side] < c) return false;
  st.pts[side] -= c; st.stats.sorties[side]++;
  u.state = 'fly'; u.fuel = d.rad * 2 * rangeBonus(st, u); u.homeT = { x: u.x, y: u.y };
  return true;
}
function landAt(st, u, spot) {
  var d = U[u.type];
  u.x = spot.x; u.y = spot.y; u.fuel = d.rad * 2 * rangeBonus(st, u); u.rdy = st.t + (TURN[d.cls] || 3) * 60 * (spot.af != null && spot.af === u.home ? 0.7 : 1);
  if (d.air) { u.state = 'base'; u.base = spot.af; if (u.home == null) u.home = spot.af; }
  else { u.state = 'land'; }
  u.str = Math.min(100, u.str + 4);
}
function loiterAttack(st, u, o, cx, cy, R, dt) {
  var d = U[u.type], hits = 0, ps = dmul(st, u) * d.a2g * (u.str / 100) * 0.16;
  if (ps <= 0) return;
  st.units.forEach(function (e) {
    if (e.side === u.side || e.str <= 0 || e.cargoed) return; var ed = U[e.type]; if (!ed.ground && !ed.naval) return; if (ed.naval && ed.sub) return;
    if (ed.air || ed.heli) return; if (dist(e.x, e.y, cx, cy) > R) return;
    var soft = (ed.cls === 'train' || ed.cls === 'convoy' || ed.cls === 'eng' || ed.cls === 'arty' || ed.cls === 'ssm' || ed.cls === 'aa') ? 1.6 : 1;
    var dm = ps * dt * soft * rr(st, 0.6, 1.4) / (ed.d * (e.dig > 0 ? 1 + 0.3 * e.dig : 1) + 2);
    e.str -= dm; e.mor -= dm * 0.7; e.bt = 40; e.hit = st.t; hits++;
    if (e.side === st.side && !(o.alerted > st.t)) { o.alerted = st.t + 60; ev(st, 'battle', ed.n + ' is under air attack', e.x, e.y); }
    if (e.str <= 6) { u.kills = (u.kills || 0) + 1; uhist(st, u, 'Destroyed ' + ed.n + ' from the air.'); killUnit(st, e, u.side); }
  });
  if (hits) o.hits = (o.hits || 0) + 1;
}
function airStep(st, dt) {
  st.units.forEach(function (u) {
    var d = U[u.type]; if ((!d.air && !d.heli) || u.str <= 0 || u.cargoed) return;
    if (u.home == null && u.base != null) u.home = u.base;
    var o = u.orders[0];
    if (u.state === 'base' || u.state === 'land') {
      if (!o) return;
      if (o.k === 'land' || o.k === 'rtb' || (d.heli && o.k === 'hold')) { u.orders.shift(); return; }
      if (d.heli && o.k === 'move' && dist(u.x, u.y, o.x, o.y) < 2) { u.orders.shift(); return; }
      if (!takeOff(st, u)) return;
      return;
    }
    // ---------- flying
    if (!o) {   // go home
      var spot = u.landSpot || nearestFriendlyLanding(st, u);
      if (!spot) { u.fuel -= 1; if (u.fuel < -50) { u.str = 0; u.dead = true; st.stats.lost[u.side]++; } return; }
      u.landSpot = spot; u.orders.push({ k: 'rtb', x: spot.x, y: spot.y, af: spot.af, city: spot.city }); o = u.orders[0];
    }
    // fuel check: head home when the tank says so
    var near = nearestFriendlyLanding(st, u);
    if (o.k !== 'rtb' && o.k !== 'land' && near && u.fuel < near.d * 1.25 + 30) { u.orders = [{ k: 'rtb', x: near.x, y: near.y, af: near.af, city: near.city }]; o = u.orders[0]; }
    var spd = d.sp * dt / 60, tx = o.x, ty = o.y, tgt = o;
    if (o.k === 'lift') {
      var cu = o.stage === 'drop' ? null : unitById(st, o.uid);
      if (o.stage !== 'drop') { if (!cu || cu.dead || cu.str <= 0) { u.orders.shift(); return; } tx = cu.x; ty = cu.y; }
    } else if (o.k === 'cas' && o.cid != null) {
      var cc = st.con[u.side][o.cid]; if (cc) { tx = cc.x; ty = cc.y; } else { tx = o.x; ty = o.y; }
    }
    if (o.k === 'cap' || o.k === 'awacs' || o.k === 'loiter') {
      var OR = o.k === 'loiter' ? (d.heli ? ORBIT.loiterHeli : ORBIT.loiter) : ORBIT[o.k];
      if (!o.arr) {
        var dd0 = dist(u.x, u.y, tx, ty);
        if (dd0 > spd + OR) { u.x += (tx - u.x) / dd0 * spd; u.y += (ty - u.y) / dd0 * spd; u.fuel -= spd; return; }
        o.arr = 1; o.ang = Math.atan2(u.y - ty, u.x - tx); if (o.k === 'loiter') uhist(st, u, 'Circling ' + placeName(tx, ty) + ', attacking everything in the area.');
      }
      o.ang += spd * 0.7 / OR; u.x = tx + OR * Math.cos(o.ang); u.y = ty + OR * Math.sin(o.ang);
      if (o.k === 'loiter') loiterAttack(st, u, o, tx, ty, OR + 4, dt);
      if (o.k !== 'loiter' || o.h) { o.left = (o.left == null ? o.h * 60 : o.left) - dt; if (o.left <= 0) u.orders.shift(); }
      u.fuel -= spd * 0.6; return;
    }
    var dd = dist(u.x, u.y, tx, ty);
    if (dd > spd) { u.x += (tx - u.x) / dd * spd; u.y += (ty - u.y) / dd * spd; u.fuel -= spd; }
    else {
      u.x = tx; u.y = ty; u.fuel -= dd;
      if (o.k === 'cas' || o.k === 'strike') { resolveStrike(st, u, o); u.orders.shift(); }
      else if (o.k === 'recon') { u.orders.shift(); }
      else if (o.k === 'rtb' || o.k === 'land') { u.landSpot = null; var sp2 = { af: o.af != null ? o.af : null, city: o.city, x: o.x, y: o.y }; if (d.air && sp2.af == null) { sp2 = nearestFriendlyLanding(st, u) || sp2; } u.orders.shift(); landAt(st, u, sp2); }
      else if (o.k === 'move' || o.k === 'amove') { u.orders.shift(); u.state = 'land'; if (!u.orders.length) { u.rdy = st.t + 30; } }
      else if (o.k === 'lift') {
        if (o.stage !== 'drop') { var cu2 = unitById(st, o.uid); if (cu2 && dist(cu2.x, cu2.y, u.x, u.y) < 8) { u.cargo = cu2.id; cu2.cargoed = true; cu2.orders = []; cu2.path = null; o.stage = 'drop'; } else { u.orders.shift(); } }
        else { var cu3 = unitById(st, u.cargo); if (cu3) { cu3.cargoed = false; cu3.x = o.x; cu3.y = o.y; cu3.mor -= 4; } u.cargo = null; u.orders.shift(); u.state = 'land'; }
      }
      else u.orders.shift();
    }
    if (u.cargo != null) { var cg = unitById(st, u.cargo); if (cg) { cg.x = u.x; cg.y = u.y; } }
    if (u.fuel <= -20) { u.str = 0; u.dead = true; st.stats.lost[u.side]++; if (u.cargo != null) { var cg2 = unitById(st, u.cargo); if (cg2) { cg2.dead = true; cg2.str = 0; } } }
  });
}
function aaCover(st, side) { // enemy-of-side AA sites
  var out = [], foe = OTHER[side];
  st.units.forEach(function (a) { var d = U[a.type]; if (a.side === foe && d.cls === 'aa' && a.str > 0 && (!d.kill1 || !(a.msl >= 1))) out.push({ x: a.x, y: a.y, r: d.rng, p: d.aaP * a.str / 100 * supF(a) }); });
  st.units.forEach(function (a) { var d = U[a.type]; if (a.side === foe && d.naval && d.aaP > 0 && a.str > 0) out.push({ x: a.x, y: a.y, r: d.cvw ? 45 : 20, p: d.aaP * a.str / 100 * supF(a) }); });
  for (var i = 0; i < MAP.air.length; i++) if (st.ad[i].o === foe) out.push({ x: MAP.air[i][2], y: MAP.air[i][3], r: 14, p: 0.6 + MAP.air[i][5] * 0.5 });
  return out;
}
function airDefence(st, dt) {
  var cover = { NATO: aaCover(st, 'NATO'), PACT: aaCover(st, 'PACT') };
  st.units.forEach(function (u) {
    if (!airborne(u) || u.str <= 0) return;
    var list = cover[u.side], hit = 0;
    for (var i = 0; i < list.length; i++) { var a = list[i]; if (dist(u.x, u.y, a.x, a.y) < a.r) hit += a.p * 0.5 * rr(st, 0.2, 1.3) * (dt / 3); }
    if (hit > 0) {
      var surv = U[u.type].heli ? 1.6 : 1; u.str -= hit * surv;
      if (u.str <= 5) { u.str = 0; u.dead = true; st.stats.lost[u.side]++; st.stats.kills[OTHER[u.side]]++; if (u.side === st.side) ev(st, 'lost', U[u.type].n + ' shot down.', u.x, u.y); }
      else if (u.str < 35 && u.orders.length && u.orders[0].k !== 'rtb') { var nr = nearestFriendlyLanding(st, u); if (nr) u.orders = [{ k: 'rtb', x: nr.x, y: nr.y, af: nr.af, city: nr.city }]; }
    }
  });
}
function airCombat(st, dt) {
  var fl = st.units.filter(function (u) { return airborne(u) && u.str > 0 && U[u.type].air; });
  var N = fl.filter(function (u) { return u.side === 'NATO'; }), P = fl.filter(function (u) { return u.side === 'PACT'; });
  N.forEach(function (a) {
    if (a.str <= 0) return;
    P.forEach(function (b) {
      if (b.str <= 0 || a.str <= 0) return;
      var da = U[a.type], db = U[b.type]; if (da.a2a + db.a2a < 2) return;
      var rng = (a.orders[0] && a.orders[0].k === 'cap') || (b.orders[0] && b.orders[0].k === 'cap') ? 60 : 38;
      if (dist(a.x, a.y, b.x, b.y) > rng) return;
      var la = (a.orders[0] && (a.orders[0].k === 'cas' || a.orders[0].k === 'strike')) ? 0.5 : 1, lb = (b.orders[0] && (b.orders[0].k === 'cas' || b.orders[0].k === 'strike')) ? 0.5 : 1;
      var pa = (da.a2a || 0.3) * a.str / 100 * la, pb = (db.a2a || 0.3) * b.str / 100 * lb;
      if (pa + pb <= 0.01) return;
      var dA = 26 * pb / (pa + pb + 1) * rr(st, 0.3, 1.2) * dt / 3 * 0.35, dB = 26 * pa / (pa + pb + 1) * rr(st, 0.3, 1.2) * dt / 3 * 0.35;
      a.str -= dA; b.str -= dB;
      [a, b].forEach(function (x) {
        if (x.str <= 5) { x.str = 0; x.dead = true; st.stats.lost[x.side]++; st.stats.kills[OTHER[x.side]]++; if (x.side === st.side) ev(st, 'lost', U[x.type].n + ' lost in air combat.', x.x, x.y); }
        else if (x.str < 40 && x.orders.length && x.orders[0].k !== 'rtb' && x.orders[0].k !== 'cap') { var nr = nearestFriendlyLanding(st, x); if (nr) x.orders = [{ k: 'rtb', x: nr.x, y: nr.y, af: nr.af }]; }
      });
      if ((a.str > 0 || b.str > 0) && (a.side === st.side || b.side === st.side)) ev(st, 'air', 'Air combat', a.x, a.y);
    });
  });
}
function resolveStrike(st, u, o) {
  var d = U[u.type], side = u.side, foe = OTHER[side];
  var power = dmul(st, u) * (d.a2g || 0) * (u.str / 100) * (u.base != null && u.base === u.home || u.homeT ? 1.0 : 1) * (d.heli ? 0.8 : 1) * (1 + 0.15 * (u.homeFlag || 0));
  var homeNear = u.homeT && nearestFriendlyLanding(st, { x: u.homeT.x, y: u.homeT.y, side: side, type: u.type }, 40);
  if (homeNear && u.home != null && homeNear.af === u.home) power *= 1.15;
  var msg = '', hits = 0;
  if (o.node) {
    var nd = o.node;
    if (nd.t === 'c') { var cd = st.cd[nd.i]; if (cd.o === foe) { cd.inf = Math.max(0, cd.inf - power * 2.4); cd.stk = Math.max(0, cd.stk - power * 3.2); hits = 1; msg = MAP.cities[nd.i][0] + ' hit'; } }
    else if (nd.t === 'a') {
      var ad = st.ad[nd.i]; if (ad.o === foe) {
        ad.dmg = Math.min(1, ad.dmg + power * 0.05); hits = 1; msg = MAP.air[nd.i][0] + ' airfield hit';
        st.units.forEach(function (e) { if (e.side === foe && U[e.type].air && e.base === nd.i && e.state === 'base' && e.str > 0) { e.str -= power * 3.6; if (e.str <= 4) { e.str = 0; e.dead = true; st.stats.lost[foe]++; st.stats.kills[side]++; } } });
      }
    } else if (nd.t === 'r') { st.cuts.push({ x: o.x, y: o.y, r: 14, until: 780 }); hits = 1; msg = 'Rail line cut'; }
  } else {
    var targets = [];
    st.units.forEach(function (e) {
      if (e.side !== foe || e.str <= 0 || e.cargoed || airborne(e)) return; var ed = U[e.type]; if (ed.air || ed.sub) return;
      var dd = dist(e.x, e.y, o.x, o.y); if (dd < 8) targets.push({ e: e, d: dd });
    });
    targets.sort(function (a, b) { return a.d - b.d; });
    targets.slice(0, 3).forEach(function (t, i) {
      var e = t.e, ed = U[e.type], soft = (ed.cls === 'train' || ed.cls === 'convoy' || ed.cls === 'arty' || ed.cls === 'aa' || ed.cls === 'eng' || ed.heli) ? 1.7 : (ed.cls === 'gnd' ? 0.9 : 1);
      var dmg = power * 1.25 * soft * (i ? 0.6 : 1) * (e.dig > 0 ? 1 - 0.3 * e.dig : 1) / (ed.naval ? 0.5 + ed.d * 0.3 : 1);
      e.str -= dmg; e.mor -= dmg * 0.5; hits++;
      if (e.str <= 5) killUnit(st, e, side);
    });
    msg = hits ? hits + ' targets hit' : 'No targets found';
  }
  if (u.side === st.side) logm(st, d.n + ': ' + msg + '.', hits ? 'good' : 'warn');
  else if (hits) ev(st, 'air', U[u.type].n + ' attacks!', o.x, o.y);
}

/* ============================================================ production */
function rearCity(st, side) {
  var best = -1, bs = -1;
  for (var i = 0; i < MAP.cities.length; i++) {
    if (st.cd[i].o !== side) continue; var C = MAP.cities[i], near = 1e9;
    st.units.forEach(function (e) { if (e.side !== side && U[e.type].ground && !U[e.type].heli) { var d = dist(C[1], C[2], e.x, e.y); if (d < near) near = d; } });
    var sc = Math.min(near, 500) + C[3] / 100 + (st.cd[i].conn ? 150 : 0);
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
function buy(st, side, type, at) {
  var d = U[type]; if (!d || d.side !== side) return { ok: false, msg: 'Unknown unit.' };
  if (tier(st, side) < d.tier) return { ok: false, msg: 'Locked: needs tier ' + d.tier + '.' };
  if (st.pts[side] < d.cost) return { ok: false, msg: 'Not enough points.' };
  var spot = at;
  if (d.air) { var af = at && at.af != null && st.ad[at.af].o === side && st.ad[at.af].dmg < 0.6 ? at.af : nearestAF(st, at ? at.x : 0, at ? at.y : 0, side, 1e9); if (af < 0) return { ok: false, msg: 'No usable airfield.' }; spot = { af: af, x: MAP.air[af][2], y: MAP.air[af][3] }; }
  else if (d.naval) { var pt = portFor(st, side, at); if (!pt) return { ok: false, msg: 'No friendly port to build at.' }; spot = pt; }
  else { if (!spot || spot.city == null || st.cd[spot.city].o !== side) { var rc = rearCity(st, side); if (rc < 0) return { ok: false, msg: 'No friendly city to deploy at.' }; spot = { city: rc, x: MAP.cities[rc][1], y: MAP.cities[rc][2] }; } }
  st.pts[side] -= d.cost; st.queue.push({ side: side, type: type, eta: d.eta * 60, at: spot });
  return { ok: true, msg: '' };
}
function cancelBuy(st, side, idx) { var q = st.queue[idx]; if (!q || q.side !== side || q.eta < U[q.type].eta * 60 - 20) return false; st.pts[side] += U[q.type].cost; st.queue.splice(idx, 1); return true; }
function productionStep(st, dt) {
  var hr = dt / 60;
  ['NATO', 'PACT'].forEach(function (side) {
    var conn = 0, tot = 0; for (var i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === side) { tot++; conn += st.cd[i].conn; }
    var inc = (14 / 24) * (0.55 + 0.45 * (tot ? conn / tot : 0)) * (side !== st.side ? ({ easy: 0.8, normal: 1, hard: 1.2 }[st.diff] || 1) : 1);
    st.pts[side] = Math.min(60, st.pts[side] + inc * hr);
  });
  st.queue.forEach(function (q) { q.eta -= dt; });
  var done = st.queue.filter(function (q) { return q.eta <= 0; });
  st.queue = st.queue.filter(function (q) { return q.eta > 0; });
  done.forEach(function (q) {
    var d = U[q.type], x = q.at.x, y = q.at.y;
    if (!d.air && !d.heli && !d.naval) { var s = snapLand(x + rr(st, -6, 6), y + rr(st, -6, 6)); x = s.x; y = s.y; }
    var u = mkUnit(st, q.type, q.side, x, y);
    if (d.air) { u.base = q.at.af; u.home = q.at.af; }
    else if (d.heli) { u.state = 'land'; }
    st.units.push(u);
    if (q.side === st.side) { logm(st, d.n + ' has arrived.', 'good'); ev(st, 'info', d.n + ' has arrived.', x, y); }
  });
}

/* ============================================================ politics + escalation */
var POL = {
  rally: { n: 'Rally the allies', cost: 3, d: 'Alliance cohesion +12. Keeps capitals on board.', run: function (st, s) { st.pol[s].coh = Math.min(100, st.pol[s].coh + 12); } },
  propaganda: { n: 'Press campaign', cost: 2, d: 'World opinion moves toward you.', run: function (st, s) { st.pol.world += s === 'NATO' ? 7 : -7; } },
  hotline: { n: 'Use the hotline', cost: 2, d: 'Cuts the chance the enemy answers a nuclear strike with another, and can walk escalation back one step if no strike happened lately.', run: function (st, s) { st.retal[OTHER[s]] = 0; if (st.esc > 0 && st.esc <= 2 && st.nukeCool.NATO <= 0 && st.nukeCool.PACT <= 0) st.esc--; } },
  mediate: { n: 'Swiss mediation', cost: 3, d: 'Geneva talks open for 2 days: a ceasefire is much easier to get.', run: function (st) { st.pol.med = 2880; } },
  emergency: { n: 'Emergency mobilization', cost: 4, d: '+10 production points now.', run: function (st, s) { st.pts[s] += 10; } }
};
function polOptions(st, side) {
  return Object.keys(POL).map(function (k) { var p = POL[k], ok = st.pol[side].pc >= p.cost; return { id: k, name: p.n, cost: p.cost, desc: p.d, ok: ok, why: ok ? '' : 'Needs ' + p.cost + ' political capital.' }; });
}
function polAct(st, side, id) { var p = POL[id]; if (!p || st.pol[side].pc < p.cost) return false; st.pol[side].pc -= p.cost; p.run(st, side); logm(st, p.n + '.', side === st.side ? '' : 'warn'); return true; }
function propose(st, side) {
  // ceasefire: accepted by the other side's AI when it is hurting or Geneva talks are on
  var foe = OTHER[side], want = st.will[foe] < 30 ? 0.8 : st.pol.med > 0 ? 0.55 : dayOf(st) > 25 ? 0.25 : 0.06;
  if (st.esc >= 3) want += 0.25; if (foe !== st.side) { if (rnd(st) < want) { endGame(st, 'ceasefire', 'Ceasefire', 'Both governments accepted a ceasefire along the current line.'); return true; } logm(st, 'The ceasefire proposal was refused.', 'warn'); return false; }
  return false;
}
function hasUnit(st, side, f) { return st.units.some(function (u) { return u.side === side && u.str > 0 && f(u, U[u.type]); }); }
function deliveryFor(st, side, tx, ty, lvl) {
  var best = null;
  st.units.forEach(function (u) {
    var d = U[u.type]; if (u.side !== side || u.str < 35 || !d.nuke || u.cargoed || (u.rdy && u.rdy > st.t)) return;
    var dd = dist(u.x, u.y, tx, ty);
    if (d.ground && d.cls === 'ssm') { if (dd <= d.rng && dd > 10) if (!best || dd < best.d) best = { u: u, d: dd }; }
    else if (d.air && u.state === 'base' && u.base != null && st.ad[u.base].dmg < 0.6 && dd <= d.rad * 0.85) { if (!best || dd < best.d) best = { u: u, d: dd }; }
  });
  return best;
}
function nukeStock(st, side) { if (!st.nukes) st.nukes = { NATO: st.era === 'm' ? 4 : 3, PACT: st.era === 'm' ? 4 : 3 }; return st.nukes[side]; }
function buyWarhead(st, side) { var c = 6; if (st.pts[side] < c) return { ok: false, msg: 'A warhead costs ' + c + ' points.' }; nukeStock(st, side); st.pts[side] -= c; st.nukes[side]++; logm(st, side + ' buys another nuclear warhead (' + st.nukes[side] + ' in stock).', 'warn'); return { ok: true, msg: '' }; }
function nukeOptions(st, side) {
  var P = st.pol[side], out = [];
  var cdOk = st.nukeCool[side] <= 0, stock = side !== st.side || nukeStock(st, side) > 0;
  var blockN = side === 'NATO' && P.coh < 35;
  out.push({ id: 'alert', lvl: 1, name: 'Nuclear alert', desc: 'Disperse nuclear units and open release talks. Costs a little home-front confidence.', ok: st.esc < 1 && !blockN, why: st.esc >= 1 ? 'Already raised.' : blockN ? 'Allies are wavering.' : '' });
  var needEng = side === 'NATO' ? hasUnit(st, side, function (u, d) { return d.cls === 'eng'; }) : true;
  out.push({ id: 'warn', lvl: 2, name: side === 'NATO' ? 'Atomic demolition mines / release request' : 'Release warning to the front', desc: 'Moves you to level 2 and prepares battlefield weapons. A strong signal to the other side.', ok: st.esc === 1 && needEng && !blockN && P.pc >= 2, why: st.esc !== 1 ? 'Needs level 1 first.' : !needEng ? 'Needs combat engineers.' : blockN ? 'Allies are wavering.' : P.pc < 2 ? 'Needs 2 political capital.' : '' });
  var dn = hasUnit(st, side, function (u, d) { return d.nuke; });
  out.push({ id: 'tac', lvl: 3, name: 'Battlefield nuclear strike', target: 'point', radius: 16, desc: 'Pick a point: everything within about 16 km is devastated and fallout lingers. Needs a nuclear-capable missile or aircraft in range.', ok: st.esc >= 2 && cdOk && dn && stock && !blockN, why: !stock ? 'No warheads left. Buy one in this tab.' : st.esc < 2 ? 'Needs level 2 first.' : !dn ? 'No nuclear-capable unit.' : !cdOk ? 'Launchers are reloading.' : blockN ? 'Allies are wavering.' : '' });
  out.push({ id: 'rear', lvl: 4, name: 'Rear-area strike on a city', target: 'point', radius: 26, desc: 'Pick a target: a city or base far behind the line is struck. The other side will almost certainly answer.', ok: st.esc >= 3 && cdOk && dn && stock && !blockN, why: !stock ? 'No warheads left. Buy one in this tab.' : st.esc < 3 ? 'Needs level 3 first.' : !dn ? 'No nuclear-capable unit.' : !cdOk ? 'Launchers are reloading.' : blockN ? 'Allies are wavering.' : '' });
  out.push({ id: 'ruin', lvl: 5, name: 'Strategic exchange', desc: 'Total war. Both homelands burn and nobody wins.', ok: st.esc >= 4 && !blockN, danger: true, why: st.esc < 4 ? 'Needs level 4 first.' : '' });
  return out;
}
function nukeAct(st, side, id, tx, ty) {
  var op = nukeOptions(st, side).filter(function (o) { return o.id === id; })[0];
  if (!op || !op.ok) return { ok: false, msg: op ? op.why : 'Unknown action.' };
  var foe = OTHER[side], P = st.pol[side];
  if (id === 'alert') { st.esc = Math.max(st.esc, 1); P.coh -= 2; st.will[side] -= 1; logm(st, side + ' raises the nuclear alert.', 'warn'); ev(st, 'nuke', side + ' raises the nuclear alert!', 0, 0); }
  else if (id === 'warn') { st.esc = Math.max(st.esc, 2); P.pc -= 2; P.coh -= 3; st.pol.world += side === 'NATO' ? -4 : 4; logm(st, side + ' issues a nuclear release warning.', 'warn'); ev(st, 'nuke', side + ' issues a release warning!', 0, 0); }
  else if (id === 'ruin') { st.esc = 5; endGame(st, 'ruin', 'Mutual ruin', 'Strategic weapons were released. Both homelands are burning; nobody won.'); }
  else {
    var del = deliveryFor(st, side, tx, ty); if (!del) return { ok: false, msg: 'No launcher in range of that target.' };
    var big = id === 'rear', R = big ? 26 : 16;
    if (del.u.air) { del.u.rdy = st.t + 120; del.u.str -= 8; } else { del.u.rdy = st.t + 180; }
    st.nukeCool[side] = 45; st.stats.nukes++; if (side === st.side) st.nukes[side] = Math.max(0, nukeStock(st, side) - 1);
    st.esc = Math.max(st.esc, big ? 4 : 3); st.stats.maxEsc = Math.max(st.stats.maxEsc, st.esc);
    st.units.forEach(function (u) {
      if (u.cargoed) return; var dd = dist(u.x, u.y, tx, ty); if (dd > R * 1.3 || (U[u.type].air && u.state === 'fly')) return;
      var f = dd <= R ? 1 : 0.4; u.str -= 95 * f * (1 - 0.45 * dd / (R * 1.3)); u.mor -= 40;
      if (u.str <= 5) killUnit(st, u, side);
    });
    for (var i = 0; i < MAP.cities.length; i++) if (dist(MAP.cities[i][1], MAP.cities[i][2], tx, ty) < R) { st.cd[i].inf = Math.max(0, st.cd[i].inf - (big ? 90 : 60)); st.cd[i].stk = 0; }
    for (i = 0; i < MAP.air.length; i++) if (dist(MAP.air[i][2], MAP.air[i][3], tx, ty) < R) { st.ad[i].dmg = 1; st.units.forEach(function (u) { if (U[u.type].air && u.base === i && u.state === 'base') { u.str = 0; } }); }
    st.fallout.push({ x: tx, y: ty, r: R * 1.4, until: st.t + 4320 });
    st.units = st.units.filter(function (u) { if (u.str <= 0 && !u.dead) { u.dead = true; st.stats.lost[u.side]++; } return !u.dead; });
    st.will[side] -= big ? 9 : 5; st.will[foe] -= big ? 6 : 3; P.coh -= big ? 14 : 9; st.pol[foe].coh -= 2; st.pol.world += side === 'NATO' ? (big ? -22 : -14) : (big ? 22 : 14);
    st.retal[foe] = 480; logm(st, side + ' uses a nuclear weapon near ' + nearestCityName(tx, ty) + '!', 'nuke'); ev(st, 'nuke', side + ' nuclear strike near ' + nearestCityName(tx, ty) + '!', tx, ty);
  }
  st.stats.maxEsc = Math.max(st.stats.maxEsc, st.esc);
  return { ok: true, msg: '' };
}
function nearestCityName(x, y) { var b = '', bd = 1e9; MAP.cities.forEach(function (c) { var d = dist(x, y, c[1], c[2]); if (d < bd) { bd = d; b = c[0]; } }); return b; }

/* random political events, about one a day on average */
function politicsStep(st, dt) {
  var hr = dt / 60;
  ['NATO', 'PACT'].forEach(function (s) {
    var P = st.pol[s]; P.pc = Math.min(10, P.pc + 0.11 * hr);
    P.coh += (P.coh < 75 ? 0.07 : -0.02) * hr; P.coh = Math.max(0, Math.min(100, P.coh));
    st.nukeCool[s] = Math.max(0, st.nukeCool[s] - dt); st.retal[s] = Math.max(0, st.retal[s] - dt);
  });
  st.pol.world += (45 - st.pol.world) * 0.004 * hr; st.pol.world = Math.max(0, Math.min(100, st.pol.world)); st.pol.med = Math.max(0, st.pol.med - dt);
  st.fallout = st.fallout.filter(function (f) { return f.until > st.t; });
  ['NATO', 'PACT'].forEach(function (s) { st.will[s] += (s === 'NATO' ? -0.025 : -0.01) * hr; if (st.esc >= 3) st.will[s] -= 0.04 * hr; });
  if (rnd(st) < hr / 26) {
    var r = rnd(st);
    if (r < 0.22) { st.pol.NATO.coh -= 6; logm(st, 'Mass protests in West European capitals. NATO cohesion drops.', st.side === 'NATO' ? 'bad' : 'good'); }
    else if (r < 0.44) { st.pol.PACT.coh -= 6; logm(st, 'Unrest in Poland and Czechoslovakia. Pact cohesion drops.', st.side === 'PACT' ? 'bad' : 'good'); }
    else if (r < 0.6) { st.pol.world += 5; logm(st, 'UN General Assembly calls for restraint. World opinion shifts west.', ''); }
    else if (r < 0.78) { st.pol.world -= 5; logm(st, 'Moscow denounces the invasion at the UN. Opinion shifts east.', ''); }
    else if (r < 0.9) { st.pol.med = 1440; logm(st, 'Switzerland offers Geneva as a venue for talks.', 'good'); ev(st, 'pol', 'Swiss mediation offered.', 0, 0); }
    else { var side = rnd(st) < 0.5 ? 'NATO' : 'PACT'; st.pts[side] += 6; logm(st, side + ' receives emergency reinforcements.', side === st.side ? 'good' : ''); }
  }
  st.pol.NATO.coh = Math.max(0, st.pol.NATO.coh); st.pol.PACT.coh = Math.max(0, st.pol.PACT.coh);
}

/* ============================================================ AI (plays whichever side the player did not pick) */
/* trains and convoys run themselves (always for the AI; for the player while the auto-supply switch is on) */
function autoSupply(st, side) {
  var mine = st.units.filter(function (u) { return u.side === side && u.str > 0 && !u.cargoed && !u.orders.length && !(u.riders && u.riders.length) && (U[u.type].cls === 'train' || U[u.type].cls === 'convoy'); });
  if (!mine.length) return;
  var gu = st.units.filter(function (u) { return u.side === side && u.str > 0 && U[u.type].cls === 'gnd'; }), taken = {};
  st.units.forEach(function (u) { if (u.side === side) u.orders.forEach(function (o) { if (o.k === 'haul') taken[o.to] = (taken[o.to] || 0) + 1; }); });
  mine.forEach(function (u) {
    var d = U[u.type], to = -1, ts = 1e9, from = -1, fs = -1;
    for (var j = 0; j < MAP.cities.length; j++) {
      if (st.cd[j].o !== side || st.cd[j].stk >= 70) continue; var C = MAP.cities[j], near = 1e9;
      gu.forEach(function (g) { var dd = dist(g.x, g.y, C[1], C[2]); if (dd < near) near = dd; });
      if (near > 110 || dist(u.x, u.y, C[1], C[2]) > (d.cls === 'train' ? 700 : 260)) continue;
      var sc = st.cd[j].stk + near * 0.06 + (taken[j] || 0) * 18; if (sc < ts) { ts = sc; to = j; }
    }
    if (to < 0) return;
    for (var i = 0; i < MAP.cities.length; i++) {
      if (i === to || st.cd[i].o !== side || !st.cd[i].conn && d.cls === 'train') continue; var dd2 = dist(MAP.cities[i][1], MAP.cities[i][2], MAP.cities[to][1], MAP.cities[to][2]);
      if (dd2 > (d.cls === 'train' ? 900 : 300) || dd2 < 20) continue;
      var f = st.cd[i].stk - dd2 * 0.02; if (f > fs) { fs = f; from = i; }
    }
    if (from < 0 || st.cd[from].stk < 25) return;
    var r = issue(st, [u.id], { k: 'haul', from: from, to: to, loop: true, force: true });
    if (r.ok) taken[to] = (taken[to] || 0) + 1;
  });
}
function aiThink(st, side) {
  var foe = OTHER[side], con = st.con[side], day = dayOf(st);
  var skill = { easy: 0.6, normal: 0.85, hard: 1 }[st.diff] || 0.85;
  var aggr = side === 'NATO' ? 1 : (day < 2 ? 0 : day < 5 ? 0.45 : 1);
  var mine = st.units.filter(function (u) { return u.side === side && u.str > 0 && !u.cargoed; });
  var combatU = mine.filter(function (u) { var c = U[u.type].cls; return c === 'gnd' || c === 'recon'; });
  // ---- production
  var tr = tier(st, side), pool = unitsFor(side, tr).filter(function (k) { return U[k].cls !== 'ssm' || rnd(st) < 0.3; });
  var want = { gnd: combatU.length, air: mine.filter(function (u) { return U[u.type].air; }).length };
  for (var tries = 0; tries < 3 && st.pts[side] > 6; tries++) {
    var k = pool[Math.floor(rnd(st) * pool.length)]; if (!k) break;
    var d = U[k]; if (d.cls === 'awacs' && mine.some(function (u) { return U[u.type].cls === 'awacs'; })) continue;
    if (d.cls === 'tanker' && tankersOf(st, side) >= 2) continue;
    if (d.air && want.air > want.gnd * 0.9 + 6) continue;
    if (d.naval && (mine.filter(function (u) { return U[u.type].naval; }).length > 7 + day / 3 || rnd(st) < 0.7)) continue;
    buy(st, side, k, null);
  }
  // ---- ground orders
  var foeCities = []; for (var i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === foe) foeCities.push(i);
  var load = {};
  combatU.forEach(function (u) {
    if (u.orders.length || u.broken) return;
    if (rnd(st) > aggr) { issue(st, [u.id], { k: 'dig', force: true }); return; }
    // hunt a close identified contact
    var best = null, bd = 130;
    for (var id in con) { var c = con[id]; if (c.lv !== 'id' || c.air) continue; var dd = dist(u.x, u.y, c.x, c.y); if (dd < bd) { bd = dd; best = c; } }
    if (best && rnd(st) < 0.45 * skill) { issue(st, [u.id], { k: 'hunt', cid: best.id, force: true }); return; }
    var tgt = -1, bs = -1;
    foeCities.forEach(function (ci) {
      var C = MAP.cities[ci], dd = dist(u.x, u.y, C[1], C[2]); if (dd > 700) return;
      var sc = (C[3] / 300 + 2 + (C[5] ? 3 : 0)) / (1 + dd / 120) * rr(st, 0.7, 1.3) / (1 + (load[ci] || 0) * 0.7);
      if (sc > bs) { bs = sc; tgt = ci; }
    });
    if (tgt >= 0) { load[tgt] = (load[tgt] || 0) + 1; var C2 = MAP.cities[tgt]; issue(st, [u.id], { k: 'amove', x: C2[1] + rr(st, -4, 4), y: C2[2] + rr(st, -4, 4), force: true }); }
  });
  mine.forEach(function (u) {
    var d = U[u.type]; if (u.orders.length || u.broken) return;
    if (d.cls === 'arty' || d.cls === 'aa' || d.cls === 'eng' || d.cls === 'convoy') {
      var ld = null, ldd = 1e9; combatU.forEach(function (g) { if (U[g.type].cls === 'gnd') { var dd = dist(u.x, u.y, g.x, g.y); if (dd < ldd) { ldd = dd; ld = g; } } });
      if (ld && ldd > 22) issue(st, [u.id], { k: 'move', x: ld.x - 4, y: ld.y, force: true });
    } else if (d.cls === 'train') {
      var from = -1, fs = -1, to = -1, ts = 1e9;
      for (var i2 = 0; i2 < MAP.cities.length; i2++) if (st.cd[i2].o === side) { if (st.cd[i2].conn && st.cd[i2].stk > fs) { fs = st.cd[i2].stk; from = i2; } }
      combatU.forEach(function (g) { for (var j = 0; j < MAP.cities.length; j++) if (st.cd[j].o === side && st.cd[j].stk < 60) { var dd = dist(g.x, g.y, MAP.cities[j][1], MAP.cities[j][2]); if (dd < 90 && st.cd[j].stk + dd * 0.05 < ts) { ts = st.cd[j].stk + dd * 0.05; to = j; } } });
      if (from >= 0 && to >= 0 && from !== to) issue(st, [u.id], { k: 'haul', from: from, to: to, force: true });
    }
  });
  // ---- air
  var enemyAF = []; for (i = 0; i < MAP.air.length; i++) if (st.ad[i].o === foe && st.ad[i].dmg < 0.9) enemyAF.push(i);
  var front = centroid(combatU), foeUnits = []; for (var id2 in con) if (con[id2].lv === 'id' && !con[id2].air) foeUnits.push(con[id2]);
  var sorties = 0;
  autoSupply(st, side);
  // ---- navy
  mine.forEach(function (u) {
    var d = U[u.type]; if (!d.naval || u.orders.length || u.str < 40) return;
    if (d.lift || d.cls === 'transport') return;
    var bt = null, bb = 400;
    for (var cid in con) { var c = con[cid]; if (c.lv !== 'id' || c.air) continue; var ce = unitById(st, +cid); if (!ce || !U[ce.type].naval) continue; var dd = dist(u.x, u.y, c.x, c.y); if (dd < bb) { bb = dd; bt = c; } }
    if (bt && d.sa > 0 && rnd(st) < 0.7) { issue(st, [u.id], { k: 'hunt', cid: bt.id, force: true }); return; }
    if (d.cvw || d.shore > 1.5) {
      var gt = null, gb = d.cvw ? d.cvw.rad * 1.2 : d.rng * 3;
      foeUnits.forEach(function (c) { var dd = dist(u.x, u.y, c.x, c.y); if (dd < gb) { gb = dd; gt = c; } });
      if (gt && rnd(st) < 0.5) { issue(st, [u.id], d.cvw ? { k: 'cas', x: gt.x, y: gt.y, force: true } : { k: 'bombard', x: gt.x, y: gt.y, force: true }); return; }
    }
    if (rnd(st) < 0.12 * skill) { var tr2 = d.sub ? 120 : 80; var px = u.x + rr(st, -tr2, tr2), py = u.y + rr(st, -tr2, tr2); issue(st, [u.id], { k: 'amove', x: px, y: py, force: true }); }
  });
  mine.forEach(function (u) {
    var d = U[u.type]; if (!(d.air || d.heli) || u.orders.length || sorties > 7 || (u.state !== 'base' && u.state !== 'land')) return;
    if (u.rdy > st.t || u.str < 40) return;
    var cmd = null;
    if (d.cls === 'recon') { var tx = front ? front.x + (side === 'NATO' ? 300 : -300) * rr(st, 0.4, 1) : 0, ty = front ? front.y + rr(st, -150, 150) : 0; cmd = { k: 'recon', x: tx, y: ty }; }
    else if (d.cls === 'awacs') { if (front) cmd = { k: 'awacs', x: front.x + (side === 'NATO' ? -80 : 80), y: front.y, h: 6 }; }
    else if (d.cls === 'tanker') return;
    else if (d.cls === 'fighter' && (d.roles || []).indexOf('cap') >= 0 && rnd(st) < 0.45 && front) cmd = { k: 'cap', x: front.x + (side === 'NATO' ? 40 : -40), y: front.y + rr(st, -60, 60), h: 3 };
    else if ((d.roles || []).indexOf('cas') >= 0 || d.heli) {
      var tg = null, tb = 1e9; foeUnits.forEach(function (c) { var dd = dist(u.x, u.y, c.x, c.y); var lim = d.heli ? d.rad : d.rad * 0.9; if (dd < lim && dd < tb) { tb = dd; tg = c; } });
      if (tg && rnd(st) < 0.8 * skill) cmd = { k: 'cas', cid: tg.id, x: tg.x, y: tg.y };
    }
    if (!cmd && d.roles && (d.roles || []).indexOf('strike') >= 0 && rnd(st) < 0.5 * skill) {
      var ba = -1, bb = 1e9; enemyAF.forEach(function (ai) { var dd = dist(u.x, u.y, MAP.air[ai][2], MAP.air[ai][3]); if (dd < d.rad * 0.9 && dd < bb && rnd(st) < 0.7) { bb = dd; ba = ai; } });
      if (ba >= 0) cmd = { k: 'strike', x: MAP.air[ba][2], y: MAP.air[ba][3], node: { t: 'a', i: ba } };
    }
    if (cmd) { cmd.force = true; var r = issue(st, [u.id], cmd, false); if (r.ok) sorties++; }
  });
  // ---- politics + nuclear ladder
  var P = st.pol[side];
  if (P.pc >= 3 && P.coh < 55) polAct(st, side, 'rally');
  else if (P.pc >= 6 && rnd(st) < 0.3) polAct(st, side, 'propaganda');
  var losing = st.will[side] < 40 || vpOf(st)[side] < st.vp0[side] * 0.85;
  var p = ({ easy: 0.015, normal: 0.035, hard: 0.06 }[st.diff] || 0.035) * (losing ? 3 : 1) * (day > 4 ? 1 : 0.2);
  if (st.retal[side] > 0 && rnd(st) < 0.35) p = 1;
  if (day < 3 && !st.retal[side]) p = 0;
  if (rnd(st) < p) {
    var ops = nukeOptions(st, side);
    if (st.esc === 0) nukeAct(st, side, 'alert'); else if (st.esc === 1) nukeAct(st, side, 'warn');
    else if (st.esc >= 2) {
      var target = nukeTarget(st, side, st.esc >= 3 && rnd(st) < 0.15);
      if (target) nukeAct(st, side, target.big ? 'rear' : 'tac', target.x, target.y);
    }
  }
  if (st.will[side] < 20 && rnd(st) < 0.2) propose(st, side);
}
function centroid(list) { if (!list.length) return null; var x = 0, y = 0; list.forEach(function (u) { x += u.x; y += u.y; }); return { x: x / list.length, y: y / list.length }; }
function nukeTarget(st, side, big) {
  var foe = OTHER[side], best = null, bs = 0;
  if (big) {
    for (var i = 0; i < MAP.cities.length; i++) if (st.cd[i].o === foe) { var sc = MAP.cities[i][3] * (MAP.cities[i][5] ? 2 : 1); if (sc > bs && deliveryFor(st, side, MAP.cities[i][1], MAP.cities[i][2])) { bs = sc; best = { x: MAP.cities[i][1], y: MAP.cities[i][2], big: true }; } }
    return best;
  }
  var E = st.units.filter(function (u) { return u.side === foe && U[u.type].ground && !U[u.type].heli && u.str > 0; }), M = st.units.filter(function (u) { return u.side === side && U[u.type].ground && u.str > 0; });
  E.forEach(function (e) {
    var n = 0; E.forEach(function (o) { if (dist(e.x, e.y, o.x, o.y) < 18) n += o.str / 100; });
    var own = M.some(function (m) { return dist(e.x, e.y, m.x, m.y) < 28; });
    if (!own && n > bs && n >= 2.5 && deliveryFor(st, side, e.x, e.y)) { bs = n; best = { x: e.x, y: e.y, big: false }; }
  });
  return best;
}

/* ============================================================ end conditions */
function outcomeFor(st) { var e = st.ended; if (!e) return null; if (!e.winner) return 'draw'; return e.winner === st.side ? 'win' : 'loss'; }
function endGame(st, kind, title, text, winner) {
  if (st.ended) return; st.spd = 0;
  st.ended = { kind: kind, title: title, text: text, winner: winner || null, day: dayOf(st), vp: vpOf(st) };
  logm(st, title + '. ' + text, 'big'); ev(st, 'end', title, 0, 0);
}
function vpShift(st) {
  var v = vpOf(st), v0 = st.vp0;
  return { NATO: (v.NATO - v0.NATO) / v0.PACT, PACT: (v.PACT - v0.PACT) / v0.NATO };
}
function checkEnd(st) {
  if (st.ended) return; var day = dayOf(st);
  if (st.will.NATO <= 0) return endGame(st, 'collapse', 'NATO collapses', 'Allied governments sue for peace. The Pact keeps its gains.', 'PACT');
  if (st.will.PACT <= 0) return endGame(st, 'collapse', 'Soviet collapse', 'The Politburo accepts terms. The Pact falls back.', 'NATO');
  if (day < 4) return;
  var s = vpShift(st);
  if (s.NATO >= 0.28) return endGame(st, 'decisive', 'NATO victory', 'NATO holds enough of the Pact heartland to dictate terms.', 'NATO');
  if (s.PACT >= 0.28) return endGame(st, 'decisive', 'Pact victory', 'The Pact has overrun enough of Western Europe to dictate terms.', 'PACT');
  if (st.t >= START_MIN + MAX_DAYS * 1440) {
    var w = s.NATO - s.PACT > 0.06 ? 'NATO' : s.PACT - s.NATO > 0.06 ? 'PACT' : null;
    endGame(st, 'limit', w ? w + ' wins on points' : 'Stalemate', w ? 'Sixty days of war end with ' + w + ' holding the better position.' : 'Sixty days of war end with neither side able to break the other.', w);
  }
}

/* ============================================================ the clock */
function step(st, dt) {
  zoneStep(st, dt);
  dt = dt || STEP; st.t += dt;
  st.units.forEach(function (u) { var d = U[u.type]; if (!d.air && !d.heli && !d.naval && u.str > 0 && !u.cargoed) moveGround(st, u, dt); });
  ridersStep(st); mineStep(st, dt);
  navalStep(st, dt);
  st.fx = st.fx || [];
  var sub = Math.max(1, Math.round(dt / 3)), sdt = dt / sub;
  for (var i = 0; i < sub; i++) { airStep(st, sdt); samKills(st, sdt); airDefence(st, sdt); airCombat(st, sdt); }
  combat(st, dt);
  st.units = st.units.filter(function (u) { return !u.dead; });
  st.units.forEach(function (u) { if (u.str <= 0) return; var t = u.trk || (u.trk = []), l = t[t.length - 1]; if (!l) t.push([Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10]); else { var dd = dist(u.x, u.y, l[0], l[1]); if (dd >= 4) { t.push([Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10]); u.dist = (u.dist || 0) + dd; if (t.length > 80) t.shift(); } } });
  if (st.fx.length) { st.fx = st.fx.filter(function (f) { return f.t > st.t - 45; }); if (st.fx.length > 240) st.fx.splice(0, st.fx.length - 240); }
  capture(st, dt); supplyStep(st, dt);
  st.cuts.forEach(function (c) { c.until -= dt; }); st.cuts = st.cuts.filter(function (c) { return c.until > 0; });
  productionStep(st, dt); politicsStep(st, dt);
  st.railT += dt; if (st.railT >= 120 || !st.railDone) { st.railT = 0; st.railDone = true; railFlood(st); }
  detect(st);
  st.supT = (st.supT || 0) + dt; if (st.supT >= 60) { st.supT = 0; if (st.set.auto !== false) autoSupply(st, st.side); }
  st.aiT += dt; if (st.aiT >= 120) { st.aiT = 0; aiThink(st, OTHER[st.side]); }
  checkEnd(st);
}
var PAUSEKINDS = { contact: 'contact', battle: 'battle', nuke: 'nuke', lost: 'lost', idle: 'idle' };
function advance(st, minutes) {
  var left = minutes, hit = null;
  while (left > 0 && !st.ended) {
    var dt = Math.min(STEP, left); step(st, dt); left -= dt;
    for (var i = 0; i < st.events.length; i++) { var e = st.events[i]; if (st.set.pause[PAUSEKINDS[e.k]] && !e.seen) { hit = e; break; } if (e.k === 'end' || e.k === 'city' && false) { hit = e; break; } }
    if (hit) break;
    if (st.events.length > 150) st.events.splice(0, st.events.length - 100);
  }
  return hit;
}
function deployMove(st, id, x, y, af) {
  if (!st.deploy) return false; var u = unitById(st, id); if (!u || u.side !== st.side) return false; var d = U[u.type];
  if (d.air) { if (af == null || st.ad[af].o !== u.side) return false; u.base = af; u.home = af; u.x = MAP.air[af][2]; u.y = MAP.air[af][3]; return true; }
  if (d.naval) { var wv = snapWater(x, y, 40); if (!wv || !ownCityNear(st, u.side, wv.x, wv.y, 280)) return false; u.x = wv.x; u.y = wv.y; u.path = null; u.orders = []; return true; }
  var s = snapLand(x, y); if (st.cd.length && G.bloc[cellOf(s.x, s.y)] === 0) return false;
  var bl = G.bloc[cellOf(s.x, s.y)]; if (bl && OWN[bl] !== u.side) return false;   // only inside your own territory
  u.x = s.x; u.y = s.y; u.path = null; u.orders = []; return true;
}
function startWar(st) { st.deploy = false; st.spd = 1; }

var API = { VERSION: VERSION, initMap: initMap, newGame: newGame, advance: advance, step: step, issue: issue, buy: buy, cancelBuy: cancelBuy, polAct: polAct, polOptions: polOptions, nukeOptions: nukeOptions, nukeAct: nukeAct,
  nukeTarget: nukeTarget, deliveryFor: deliveryFor, propose: propose, deployMove: deployMove, startWar: startWar, unitById: unitById, unitsFor: unitsFor, tier: tier, tierPoints: tierPoints, dayOf: dayOf, dateStr: dateStr, vpOf: vpOf, vpShift: vpShift,
  outcomeFor: outcomeFor, findPath: findPath, cellOf: cellOf, isLand: isLand, dist: dist, ll: ll, toLL: toLL, autoSupply: autoSupply, placeName: placeName, ORBIT: ORBIT, orderWord: orderWord, snapLand: snapLand, snapWater: snapWater, refreshBloc: refreshBloc, setStance: setStance, dmgInfo: dmgInfo, buyWarhead: buyWarhead, nukeStock: nukeStock, setDmgMul: setDmgMul, getEra: function () { return ERA; }, zoneR: zoneR, setEra: setEra, portFor: portFor, rearCity: rearCity, tankersOf: tankersOf, nearestFriendlyLanding: nearestFriendlyLanding,
  UNITS: U, ESC_NAMES: ESC_NAMES, OTHER: OTHER, MAX_DAYS: MAX_DAYS, START_MIN: START_MIN, G: G, POL: POL, rnd: rnd, aiThink: aiThink, railFlood: railFlood, detect: detect, isAir: isAir, isHeli: isHeli, airborne: airborne, inFallout: inFallout, sortieCost: sortieCost, rangeBonus: rangeBonus, killUnit: killUnit, SAM_CD: SAM_CD };
Object.defineProperty(API, 'MAP', { get: function () { return MAP; } });
root.U75War = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
