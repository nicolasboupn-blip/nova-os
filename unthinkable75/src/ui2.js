/* UNTHINKABLE '75 v2 - UI: canvas theatre map, tap-to-select, orders, manage tab. Plain DOM + 2D canvas. */
(function () {
'use strict';
var W = window.U75War, M = window.U75MAP, U = W.UNITS;
W.initMap(M);
var G = W.G;

/* ---------- storage ---------- */
var mem = {};
var Store = {
  get: function (k) { try { if (window.NovaSave && window.NovaSave.get) { var v = window.NovaSave.get(k); return v == null || v === '' ? null : v; } return window.localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
  set: function (k, v) { try { if (window.NovaSave && window.NovaSave.set) { window.NovaSave.set(k, v); return; } window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
  del: function (k) { try { if (window.NovaSave && window.NovaSave.del) { window.NovaSave.del(k); return; } window.localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
};
function slotKey(n) { return 'u75v2.slot.' + n; }
function readSlot(n) { try { var r = Store.get(slotKey(n)); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function metaOf(st) { return { side: st.side, diff: st.diff, day: W.dayOf(st), t: st.t, esc: st.esc, deploy: st.deploy, ended: st.ended ? { title: st.ended.title, outcome: W.outcomeFor(st) } : null }; }
function saveSlot() { if (!app.st || !app.slot) return; try { Store.set(slotKey(app.slot), JSON.stringify({ v: 2, saved: Date.now(), meta: metaOf(app.st), state: app.st })); } catch (e) {} }

/* ---------- app ---------- */
var app = { screen: 'slots', slot: null, st: null, tab: 'units', sel: [], selNode: null, selCon: null, multi: false, addStop: false, pick: null, setup: { side: 'NATO', diff: 'normal', era: '75' },
  dock: 1, modal: null, toast: '', toastT: 0, layers: { roads: true, rails: true, air: true, cities: true, cons: true }, view: { cx: 0, cy: 0, z: 0.6 }, capH: 3, mini: false, speed: 0 };
var UTABS = [['move', 'Movement'], ['atk', 'Attacks'], ['trk', 'Tracks'], ['task', 'Tasks'], ['hist', 'History']];
var SPEEDS = [0, 1 / 60, 0.25, 1, 5, 15, 60, 240, 720];   // game minutes per real second
var SPEEDN = ['pause', 'x1 real time', 'x15', 'x60 (1 min/s)', 'x300', 'x900', 'x3600 (1 h/s)', '4 h/s', '12 h/s'];
var TOPSPD = [[0, '⏸'], [1, '1×'], [3, '60×'], [5, '900×'], [7, '⏩']];
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function toast(t) { app.toast = t; app.toastT = Date.now() + 3200; paintToast(); }

/* ---------- static map data prepared once ---------- */
var geo = null;
function decode(a) { var x = a[0], y = a[1], out = [x, y]; for (var i = 2; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out.push(x, y); } return out; }
function prep(list, pick) {
  return list.map(function (it) { var a = pick ? it[1] : it, p = decode(a), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (var i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; } return { p: p, b: [x0, y0, x1, y1], t: pick ? it[0] : 0 }; });
}
function makeBlocImg() {
  var c = document.createElement('canvas'); c.width = G.w; c.height = G.h; var x = c.getContext('2d'), img = x.createImageData(G.w, G.h);
  var col = { 0: [0, 0, 0, 0], 1: [38, 78, 125, 255], 2: [125, 45, 42, 255], 3: [70, 70, 60, 255] };
  for (var i = 0; i < G.n; i++) { var k = col[G.bloc[i]]; img.data[i * 4] = k[0]; img.data[i * 4 + 1] = k[1]; img.data[i * 4 + 2] = k[2]; img.data[i * 4 + 3] = k[3]; }
  x.putImageData(img, 0, 0); geo.bloc = c;
  geo.blocV = app.st ? app.st.blocV : -1;
}
function initGeo() {
  geo = { land: prep(M.land), borders: prep(M.borders), iron: prep(M.iron), roads: prep(M.roadsD, true), rails: prep(M.rails) };
  makeBlocImg();
}

/* ---------- canvas + view ---------- */
var cv, ctx, bg, bgx, cw = 0, ch = 0, dpr = 1, bgView = null, bgDirty = true, lastBG = 0;
function w2s(x, y) { var v = app.view; return [(x - v.cx) * v.z + cw / 2, (y - v.cy) * v.z + ch / 2]; }
function s2w(sx, sy) { var v = app.view; return { x: (sx - cw / 2) / v.z + v.cx, y: (sy - ch / 2) / v.z + v.cy }; }
function setupCanvas(stage) {
  cw = 0; ch = 0; bgView = null; bgDirty = true;
  cv = stage.querySelector('canvas'); ctx = cv.getContext('2d'); bg = document.createElement('canvas'); bgx = bg.getContext('2d');
  sizeCanvas();
}
function sizeCanvas() {
  if (!cv) return; var pn = cv.parentNode; dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(10, pn.clientWidth), h = Math.max(10, pn.clientHeight);
  if (w === cw && h === ch) return; cw = w; ch = h; cv.width = w * dpr; cv.height = h * dpr; bg.width = w * dpr; bg.height = h * dpr; bgDirty = true;
}
function clampView() { var v = app.view; v.z = clamp(v.z, Math.max(0.12, Math.min(cw / M.W, ch / M.H) * 0.9), 9); v.cx = clamp(v.cx, 0, M.W); v.cy = clamp(v.cy, 0, M.H); }
function centerOn(x, y, z) { app.view.cx = x; app.view.cy = y; if (z) app.view.z = z; clampView(); bgDirty = true; }

function renderBG() {
  var v = app.view, z = v.z; bgx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bgx.fillStyle = '#0a1a24'; bgx.fillRect(0, 0, cw, ch);
  var x0 = v.cx - cw / 2 / z - 10, x1 = v.cx + cw / 2 / z + 10, y0 = v.cy - ch / 2 / z - 10, y1 = v.cy + ch / 2 / z + 10;
  function vis(b) { return !(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1); }
  function trace(list, close) { for (var i = 0; i < list.length; i++) { var o = list[i]; if (!vis(o.b)) continue; var p = o.p; bgx.moveTo((p[0] - v.cx) * z + cw / 2, (p[1] - v.cy) * z + ch / 2); for (var k = 2; k < p.length; k += 2) bgx.lineTo((p[k] - v.cx) * z + cw / 2, (p[k + 1] - v.cy) * z + ch / 2); if (close) bgx.closePath(); } }
  // land + bloc tint
  bgx.save(); bgx.beginPath(); trace(geo.land, true); bgx.fillStyle = '#1b2a24'; bgx.fill(); bgx.clip();
  bgx.imageSmoothingEnabled = true; bgx.drawImage(geo.bloc, (0 - v.cx) * z + cw / 2, (0 - v.cy) * z + ch / 2, G.w * G.cell * z, G.h * G.cell * z);
  bgx.restore();
  bgx.beginPath(); trace(geo.land, true); bgx.strokeStyle = '#6f8c86'; bgx.lineWidth = 1; bgx.stroke();
  if (app.layers.roads) {
    var maj = geo.roads.filter(function (r) { return r.t === 1; }), mnr = geo.roads.filter(function (r) { return r.t === 2; });
    bgx.lineJoin = 'round'; bgx.lineCap = 'round';
    if (z > 0.4) { bgx.beginPath(); trace(mnr); bgx.strokeStyle = 'rgba(0,0,0,.55)'; bgx.lineWidth = z > 1.5 ? 3 : 2.2; bgx.stroke(); bgx.beginPath(); trace(mnr); bgx.strokeStyle = 'rgba(205,200,175,.62)'; bgx.lineWidth = z > 1.5 ? 1.5 : 1; bgx.stroke(); }
    bgx.beginPath(); trace(maj); bgx.strokeStyle = 'rgba(0,0,0,.7)'; bgx.lineWidth = z > 1.5 ? 4.6 : z > 0.6 ? 3.6 : 2.8; bgx.stroke();
    bgx.beginPath(); trace(maj); bgx.strokeStyle = '#f4d77a'; bgx.lineWidth = z > 1.5 ? 2.6 : z > 0.6 ? 1.9 : 1.4; bgx.stroke();
  }
  if (app.layers.rails) {
    bgx.lineJoin = 'round'; bgx.beginPath(); trace(geo.rails); bgx.strokeStyle = 'rgba(0,0,0,.6)'; bgx.lineWidth = z > 1.5 ? 3.2 : z > 0.6 ? 2.4 : 1.8; bgx.stroke();
    bgx.beginPath(); trace(geo.rails); bgx.strokeStyle = '#c9d6dc'; bgx.lineWidth = z > 1.5 ? 1.8 : z > 0.6 ? 1.3 : 1; bgx.stroke();
    bgx.beginPath(); trace(geo.rails); bgx.strokeStyle = '#25323a'; bgx.lineWidth = z > 1.5 ? 1.8 : z > 0.6 ? 1.3 : 1; bgx.setLineDash(z > 1.2 ? [6, 6] : [4, 5]); bgx.stroke(); bgx.setLineDash([]);
  }
  bgx.beginPath(); trace(geo.borders); bgx.strokeStyle = 'rgba(235,235,225,.55)'; bgx.lineWidth = 0.9; bgx.setLineDash([4, 3]); bgx.stroke(); bgx.setLineDash([]);
  bgx.beginPath(); trace(geo.iron); bgx.strokeStyle = '#f2b84b'; bgx.lineWidth = 2; bgx.stroke();
  bgView = { cx: v.cx, cy: v.cy, z: z }; bgDirty = false; lastBG = Date.now();
}

/* ---------- unit symbols ---------- */
function symOf(type) {
  var d = U[type];
  if (d.air) return d.cls === 'awacs' ? 'R' : d.cls === 'tanker' ? 'K' : 'A';
  if (d.heli) return d.cls === 'heli_trans' ? 'HT' : 'H';
  if (d.naval) return d.cls === 'carrier' ? 'sCV' : d.sub ? 'sSM' : (d.cls === 'amphib' || d.cls === 'transport') ? 'sLT' : 'sSH';
  var m = { gnd: type === 'armor' || type === 'tank' || type === 'gtank' ? 'T' : type === 'inf' || type === 'vdv' ? 'X' : 'M', recon: 'V', arty: 'a', aa: 'n', eng: 'E', train: 'R', convoy: 'C', ssm: 'S' };
  return m[d.cls] || '?';
}
function drawSym(c, s, x, y, col) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.3;
  c.beginPath();
  if (s === 'T') { c.ellipse(x, y, 5, 3, 0, 0, 7); c.stroke(); }
  else if (s === 'X') { c.moveTo(x - 6, y - 4); c.lineTo(x + 6, y + 4); c.moveTo(x + 6, y - 4); c.lineTo(x - 6, y + 4); c.stroke(); }
  else if (s === 'M') { c.moveTo(x - 6, y - 4); c.lineTo(x + 6, y + 4); c.moveTo(x + 6, y - 4); c.lineTo(x - 6, y + 4); c.stroke(); c.beginPath(); c.ellipse(x, y, 4, 2.4, 0, 0, 7); c.stroke(); }
  else if (s === 'V') { c.moveTo(x - 6, y + 4); c.lineTo(x + 6, y - 4); c.stroke(); }
  else if (s === 'a') { c.arc(x, y, 2.4, 0, 7); c.fill(); }
  else if (s === 'n') { c.arc(x, y + 3, 5, Math.PI, 0); c.stroke(); }
  else if (s === 'S') { c.moveTo(x, y - 4); c.lineTo(x + 4, y + 3); c.lineTo(x - 4, y + 3); c.closePath(); c.fill(); }
  else if (s === 'sSH') { c.moveTo(x - 8, y - 1); c.lineTo(x + 8, y - 1); c.lineTo(x + 5, y + 4); c.lineTo(x - 6, y + 4); c.closePath(); c.fill(); c.fillRect(x - 3, y - 5, 5, 4); }
  else if (s === 'sCV') { c.moveTo(x - 9, y - 1); c.lineTo(x + 9, y - 1); c.lineTo(x + 6, y + 4); c.lineTo(x - 7, y + 4); c.closePath(); c.fill(); c.fillRect(x + 2, y - 5, 3, 4); }
  else if (s === 'sSM') { c.ellipse(x, y + 1, 8, 2.8, 0, 0, 7); c.fill(); c.fillRect(x - 2, y - 4, 4, 4); }
  else if (s === 'sLT') { c.moveTo(x - 8, y - 1); c.lineTo(x + 8, y - 1); c.lineTo(x + 6, y + 4); c.lineTo(x - 6, y + 4); c.closePath(); c.stroke(); c.strokeRect(x - 4, y - 5, 8, 4); }
  else if (s === 'A') { c.moveTo(x, y - 5); c.lineTo(x + 2, y); c.lineTo(x + 6, y + 2); c.lineTo(x + 2, y + 2); c.lineTo(x + 1, y + 5); c.lineTo(x - 1, y + 5); c.lineTo(x - 2, y + 2); c.lineTo(x - 6, y + 2); c.lineTo(x - 2, y); c.closePath(); c.fill(); }
  else { c.font = 'bold 9px ui-monospace,monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y + 0.5); }
}
var SIDE_COL = { NATO: '#4da3ff', PACT: '#ff5b4a', NEUT: '#aaa' };
function drawUnitIcon(c, x, y, u, col, o) {
  o = o || {}; var d = U[u.type], bw = 22, bh = 15, fly = o.fly;
  c.save(); c.translate(x, y);
  if (fly) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-bw / 2 + 2, -bh / 2 + 3, bw, bh); }
  c.fillStyle = o.fade ? 'rgba(20,24,22,.7)' : (u.side === 'NATO' ? 'rgba(14,36,64,.95)' : 'rgba(64,22,18,.95)');
  c.strokeStyle = col; c.lineWidth = o.sel ? 2.4 : 1.4;
  if (d.air || d.heli) { c.beginPath(); c.moveTo(-bw / 2, bh / 2); c.lineTo(-bw / 2, -bh / 2 + 4); c.quadraticCurveTo(0, -bh / 2 - 6, bw / 2, -bh / 2 + 4); c.lineTo(bw / 2, bh / 2); c.closePath(); } else { c.beginPath(); c.rect(-bw / 2, -bh / 2, bw, bh); }
  c.fill(); c.stroke();
  drawSym(c, o.sym || symOf(u.type), 0, 1, col);
  if (o.bar != null) { c.fillStyle = '#000'; c.fillRect(-bw / 2, bh / 2 + 2, bw, 3); c.fillStyle = o.bar > 60 ? '#6fd08c' : o.bar > 30 ? '#f2b84b' : '#ff6b5b'; c.fillRect(-bw / 2, bh / 2 + 2, bw * o.bar / 100, 3); }
  c.restore();
}

/* ---------- drawing the live layer ---------- */
function ownUnits() { return app.st.units.filter(function (u) { return u.side === app.st.side && u.str > 0 && !u.cargoed; }); }
function drawn(u) { var d = U[u.type]; return !(d.air && u.state === 'base') || app.view.z >= 0.8; }
var PARK = {};
function parkMap(st) {
  PARK = {}; var by = {};
  st.units.forEach(function (u) { if (u.side === st.side && U[u.type].air && u.state === 'base' && u.base != null && u.str > 0 && !u.cargoed) (by[u.base] = by[u.base] || []).push(u); });
  for (var b in by) by[b].sort(function (a, c) { return a.id - c.id; }).forEach(function (u, i) { PARK[u.id] = i; });
}
function upos(u) {
  var d = U[u.type]; if (d.air && u.state === 'base' && PARK[u.id] != null && app.view.z >= 0.8) { var p = w2s(u.x, u.y), i = PARK[u.id]; return [p[0] + ((i % 4) - 1.5) * 31, p[1] + 20 + Math.floor(i / 4) * 25]; }
  return w2s(u.x, u.y);
}
function airStacks(st) {
  var by = {}; st.units.forEach(function (u) { if (u.side === st.side && U[u.type].air && u.state === 'base' && u.base != null && u.str > 0) (by[u.base] = by[u.base] || []).push(u); });
  return by;
}
function orderPts(u) {
  var pts = [], st = app.st;
  (u.orders || []).forEach(function (o) {
    if (o.k === 'hunt') { var c = st.con[st.side][o.cid]; if (c) pts.push({ x: c.x, y: c.y, k: 'hunt' }); }
    else if (o.k === 'haul') { pts.push({ x: M.cities[o.from][1], y: M.cities[o.from][2], k: 'haul' }); pts.push({ x: M.cities[o.to][1], y: M.cities[o.to][2], k: 'haul' }); }
    else if (o.x != null) pts.push({ x: o.x, y: o.y, k: o.k });
    else if (o.k === 'lift' && o.uid != null) { var cu = W.unitById(st, o.uid); if (cu) pts.push({ x: cu.x, y: cu.y, k: 'lift' }); }
  });
  return pts;
}
var OMETA = { move: { c: '#7fd0ff', l: 'MOVE HERE', s: 'flag', dash: [1, 0] }, amove: { c: '#ff9f5b', l: 'ATTACK-MOVE', s: 'chev' }, hunt: { c: '#ff5b4a', l: 'HUNT', s: 'cross' }, cas: { c: '#ff5b4a', l: 'GROUND ATTACK', s: 'cross' }, strike: { c: '#ffd24a', l: 'AIR STRIKE', s: 'cross' }, airstrike: { c: '#ffd24a', l: 'CARRIER STRIKE', s: 'cross' },
  fire: { c: '#ff4a3a', l: 'ARTILLERY BARRAGE', s: 'cross' }, bombard: { c: '#ff9f5b', l: 'SHIP BOMBARDMENT', s: 'cross' }, cap: { c: '#6fd08c', l: 'PATROL (CIRCLES HERE)', s: 'orbit' }, loiter: { c: '#ff9f5b', l: 'CIRCLE & ATTACK (KEEPS HITTING)', s: 'orbit' }, awacs: { c: '#6fd08c', l: 'AWACS ORBIT', s: 'orbit' }, recon: { c: '#b7b7ff', l: 'RECON', s: 'dot' },
  haul: { c: '#f2b84b', l: 'SUPPLY RUN', s: 'dot' }, lift: { c: '#7fd0ff', l: 'LIFT / DROP', s: 'dot' }, land: { c: '#aaaaaa', l: 'LAND HERE', s: 'flag' }, rtb: { c: '#aaaaaa', l: 'RETURN', s: 'flag' } };
var KCOL = { bombard: '#ff9f5b', airstrike: '#ffd24a', move: '#9fd8ff', amove: '#ff9f5b', hunt: '#ff5b4a', cas: '#ff5b4a', strike: '#ffd24a', recon: '#aaf', cap: '#6fd08c', loiter: '#ff9f5b', awacs: '#6fd08c', rtb: '#999', land: '#999', haul: '#f2b84b', lift: '#9fd8ff' };
function draw() {
  var st = app.st; if (!st || !ctx) return; sizeCanvas(); var v = app.view, z = v.z, side = st.side, con = st.con[side];
  if (geo.stRef !== st) { geo.stRef = st; W.refreshBloc(st); }
  if (geo.blocV !== st.blocV && (Date.now() - (geo.blocT || 0) > 600 || geo.stRef2 !== st)) { geo.blocT = Date.now(); geo.stRef2 = st; makeBlocImg(); bgDirty = true; }
  if (bgDirty || !bgView || (Date.now() - lastBG > 140 && (bgView.cx !== v.cx || bgView.cy !== v.cy || bgView.z !== z))) renderBG();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.fillStyle = '#0a1a24'; ctx.fillRect(0, 0, cw, ch);
  var s = z / bgView.z; ctx.drawImage(bg, cw / 2 - cw / 2 * s + (bgView.cx - v.cx) * z, ch / 2 - ch / 2 * s + (bgView.cy - v.cy) * z, cw * s, ch * s);
  var pad = 30, X0 = -pad, Y0 = -pad, X1 = cw + pad, Y1 = ch + pad;
  function on(p) { return p[0] > X0 && p[0] < X1 && p[1] > Y0 && p[1] < Y1; }
  // fallout + rail cuts
  st.fallout.forEach(function (f) { var p = w2s(f.x, f.y); ctx.beginPath(); ctx.arc(p[0], p[1], f.r * z, 0, 7); ctx.fillStyle = 'rgba(190,220,60,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(210,240,70,.6)'; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); });
  (st.mines || []).forEach(function (m) { if (m.s !== side && !m.rev) return; var p = w2s(m.x, m.y), rm = m.r * z; if (p[0] < -rm || p[1] < -rm || p[0] > cw + rm || p[1] > ch + rm) return; ctx.beginPath(); ctx.arc(p[0], p[1], rm, 0, 7); ctx.fillStyle = 'rgba(255,170,60,.08)'; ctx.fill(); ctx.setLineDash([2, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,170,60,.75)'; ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,170,60,.9)'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', p[0], p[1]); });
  st.cuts.forEach(function (c) { var p = w2s(c.x, c.y); ctx.strokeStyle = '#ff6b5b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0] - 5, p[1] - 5); ctx.lineTo(p[0] + 5, p[1] + 5); ctx.moveTo(p[0] + 5, p[1] - 5); ctx.lineTo(p[0] - 5, p[1] + 5); ctx.stroke(); });
  // air-defence coverage circles (yours always, enemy only once identified)
  if (z > 0.12) {
    var samDraw = function (x, y, r, sd) { var pq = w2s(x, y); if (pq[0] < -r * z || pq[1] < -r * z || pq[0] > cw + r * z || pq[1] > ch + r * z) return; ctx.beginPath(); ctx.arc(pq[0], pq[1], r * z, 0, 7); ctx.fillStyle = sd === side ? 'rgba(80,160,255,.07)' : 'rgba(255,90,70,.08)'; ctx.fill(); ctx.setLineDash([3, 5]); ctx.lineWidth = 1.2; ctx.strokeStyle = sd === side ? 'rgba(110,175,255,.55)' : 'rgba(255,110,90,.65)'; ctx.stroke(); ctx.setLineDash([]); };
    st.units.forEach(function (ua) { var da = U[ua.type]; if (ua.side === side && da.cls === 'aa' && ua.str > 0 && !ua.cargoed) samDraw(ua.x, ua.y, da.rng, side); });
    for (var cid in con) { var cq = con[cid]; if (cq.lv === 'id' && cq.type && U[cq.type].cls === 'aa') samDraw(cq.x, cq.y, U[cq.type].rng, W.OTHER[side]); }
  }
  // zone-of-control circles: bigger = stronger; nobody of the enemy inside -> the unit claims the land
  if (z >= 0.3) {
    var zdraw = function (x, y, r, sd, strong) { var pq = w2s(x, y), rr2 = r * z; if (pq[0] < -rr2 || pq[1] < -rr2 || pq[0] > cw + rr2 || pq[1] > ch + rr2) return; ctx.beginPath(); ctx.arc(pq[0], pq[1], rr2, 0, 7); ctx.fillStyle = sd === side ? 'rgba(120,200,255,' + (strong ? .2 : .08) + ')' : 'rgba(255,130,100,' + (strong ? .2 : .09) + ')'; ctx.fill(); ctx.setLineDash(strong ? [] : [6, 4]); ctx.lineWidth = strong ? 2.4 : 1.4; ctx.strokeStyle = sd === side ? 'rgba(190,230,255,' + (strong ? 1 : .7) + ')' : 'rgba(255,150,125,' + (strong ? 1 : .75) + ')'; ctx.stroke(); ctx.setLineDash([]); };
    st.units.forEach(function (ua) { if (ua.side !== side) return; var rz = W.zoneR(ua); if (rz > 0) zdraw(ua.x, ua.y, rz, side, app.sel.indexOf(ua.id) >= 0); });
    for (var zid in con) { var zc = con[zid]; if (zc.lv === 'id' && zc.type && U[zc.type].ground) { var rz2 = W.zoneR({ type: zc.type, str: 100 }); if (rz2 > 0) zdraw(zc.x, zc.y, rz2, W.OTHER[side], false); } }
  }
  // cities
  if (app.layers.cities) for (var i = 0; i < M.cities.length; i++) {
    var C = M.cities[i], p = w2s(C[1], C[2]); if (!on(p)) continue; var cd = st.cd[i], pop = C[3];
    if (z < 0.3 && pop < 900 && !C[5]) continue; if (z < 0.5 && pop < 300 && !C[5]) continue;
    var r = 2.2 + Math.min(4.5, Math.log(pop + 1) * 0.55), col = SIDE_COL[cd.o] || '#aaa';
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = C[5] ? 2 : 1; ctx.strokeStyle = C[5] ? '#f2b84b' : '#0a0f0d'; ctx.stroke();
    if (cd.cp > 0.02) { ctx.beginPath(); ctx.arc(p[0], p[1], r + 4, -1.57, -1.57 + 6.28 * cd.cp); ctx.strokeStyle = SIDE_COL[cd.cs] || '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); }
    if (cd.inf < 60) { ctx.fillStyle = '#ff6b5b'; ctx.fillRect(p[0] + r + 1, p[1] - r, 2, 2 + r); }
    var lab = (z >= 0.45 && (C[5] || pop > 2000)) || (z >= 0.9 && pop > 700) || (z >= 1.7 && pop > 250) || z >= 3;
    if (lab) { ctx.font = (C[5] ? 'bold ' : '') + '10px system-ui'; ctx.fillStyle = 'rgba(232,240,235,.92)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,14,12,.8)'; ctx.strokeText(C[0], p[0] + r + 4, p[1]); ctx.fillText(C[0], p[0] + r + 4, p[1]); }
  }
  // airfields
  var stacks = airStacks(st); parkMap(st);
  if (app.layers.air) for (i = 0; i < M.air.length; i++) {
    var A = M.air[i], pa = w2s(A[2], A[3]); if (!on(pa)) continue; var ad = st.ad[i], size = A[5], mine = ad.o === side, stack = stacks[i];
    if (!stack && !(app.selNode && app.selNode.t === 'a' && app.selNode.i === i) && ((size === 1 && z < 1.5) || (size === 2 && z < 0.7) || (size === 3 && z < 0.3))) continue;
    var col2 = SIDE_COL[ad.o] || '#aaa', sz = 4 + size * 1.4;
    ctx.save(); ctx.translate(pa[0], pa[1]); ctx.rotate(0.6); ctx.globalAlpha = ad.dmg > 0.6 ? 0.45 : 1; ctx.strokeStyle = col2; ctx.lineWidth = 1.6; ctx.fillStyle = 'rgba(8,14,12,.8)';
    ctx.beginPath(); ctx.rect(-sz, -1.6, sz * 2, 3.2); ctx.fill(); ctx.stroke(); ctx.restore();
    if (ad.cp > 0.02) { ctx.beginPath(); ctx.arc(pa[0], pa[1], sz + 3, -1.57, -1.57 + 6.28 * ad.cp); ctx.strokeStyle = SIDE_COL[ad.cs] || '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (stack && z < 0.8) {
      var pn2 = Math.min(stack.length, 6), pz = Math.max(0.8, Math.min(1.6, 0.7 + z * 0.5));
      for (var pk = 0; pk < pn2; pk++) { var off = (pk - (pn2 - 1) / 2) * 8 * pz; ctx.save(); ctx.translate(pa[0] + Math.cos(0.6) * off + 5, pa[1] + Math.sin(0.6) * off - 9 * pz); ctx.scale(pz, pz); drawSym(ctx, 'A', 0, 0, col2); ctx.restore(); }
    }
    if (stack && z < 0.8) { ctx.font = 'bold 9px ui-monospace,monospace'; ctx.fillStyle = col2; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,14,12,.85)'; ctx.strokeText('✈' + stack.length, pa[0], pa[1] - sz - 11); ctx.fillText('✈' + stack.length, pa[0], pa[1] - sz - 11); }
    if (z >= 2.6 || (app.selNode && app.selNode.t === 'a' && app.selNode.i === i)) { ctx.font = '9px system-ui'; ctx.fillStyle = 'rgba(190,230,200,.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(A[0], pa[0] + sz + 3, pa[1] + 5); }
  }
  // selected node ring
  if (app.selNode) { var nd = app.selNode, np = nd.t === 'c' ? [M.cities[nd.i][1], M.cities[nd.i][2]] : [M.air[nd.i][2], M.air[nd.i][3]], sp = w2s(np[0], np[1]); ctx.beginPath(); ctx.arc(sp[0], sp[1], 14, 0, 7); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2; ctx.stroke(); }
  // trails of selected units
  if (app.showTrail !== false) app.sel.forEach(function (id) {
    var u = W.unitById(st, id); if (!u || !u.trk || u.trk.length < 2) return; var n = u.trk.length;
    for (var q = 1; q < n; q++) { var p0 = w2s(u.trk[q - 1][0], u.trk[q - 1][1]), p1 = w2s(u.trk[q][0], u.trk[q][1]); ctx.strokeStyle = 'rgba(160,210,255,' + (0.18 + 0.6 * q / n) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
    var pl = w2s(u.trk[n - 1][0], u.trk[n - 1][1]), pu = upos(u); ctx.strokeStyle = 'rgba(160,210,255,.8)'; ctx.beginPath(); ctx.moveTo(pl[0], pl[1]); ctx.lineTo(pu[0], pu[1]); ctx.stroke();
    var p00 = w2s(u.trk[0][0], u.trk[0][1]); ctx.fillStyle = 'rgba(160,210,255,.7)'; ctx.beginPath(); ctx.arc(p00[0], p00[1], 3, 0, 7); ctx.fill();
  });
  // orders of selected units: clear, labelled markers
  app.sel.forEach(function (id) {
    var u = W.unitById(st, id); if (!u) return; var pts = orderPts(u); if (!pts.length) return; var d = U[u.type];
    var a = upos(u), multi = pts.length > 1;
    pts.forEach(function (q, qi) {
      var b = w2s(q.x, q.y), m = OMETA[q.k] || { c: '#fff', l: q.k }, col = m.c;
      ctx.lineWidth = 2.2; ctx.setLineDash(m.dash || [8, 5]); ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      // arrow head
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > 26) { var mx = a[0] + (b[0] - a[0]) * 0.55, my = a[1] + (b[1] - a[1]) * 0.55; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(mx + Math.cos(ang) * 6, my + Math.sin(ang) * 6); ctx.lineTo(mx + Math.cos(ang + 2.5) * 6, my + Math.sin(ang + 2.5) * 6); ctx.lineTo(mx + Math.cos(ang - 2.5) * 6, my + Math.sin(ang - 2.5) * 6); ctx.closePath(); ctx.fill(); }
      // area markers: patrol circle, barrage zone
      if (q.k === 'cap' || q.k === 'awacs' || q.k === 'loiter') { var R = (q.k === 'loiter' ? (U[u.type].heli ? W.ORBIT.loiterHeli : W.ORBIT.loiter) : W.ORBIT[q.k]) * z; ctx.beginPath(); ctx.arc(b[0], b[1], R, 0, 7); ctx.fillStyle = 'rgba(111,208,140,.10)'; ctx.fill(); ctx.setLineDash([2, 5]); ctx.lineWidth = 2.4; ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]); for (var k2 = 0; k2 < 3; k2++) { var aa = (Date.now() / 1400 + k2 * 2.09) % 6.283; ctx.beginPath(); ctx.arc(b[0] + Math.cos(aa) * R, b[1] + Math.sin(aa) * R, 3.2, 0, 7); ctx.fillStyle = col; ctx.fill(); } }
      if (q.k === 'fire') { var Rz = Math.max(7, 3.6 * z); ctx.beginPath(); ctx.arc(b[0], b[1], Rz, 0, 7); ctx.fillStyle = 'rgba(255,60,50,.18)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
      if (q.k === 'fire' && qi === 0) { ctx.beginPath(); ctx.arc(a[0], a[1], d.rng * z, 0, 7); ctx.strokeStyle = 'rgba(255,90,70,.55)'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
      // marker shape
      ctx.save(); ctx.translate(b[0], b[1]); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.4;
      if (m.s === 'cross') { ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke(); }
      else if (m.s === 'chev') { ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(0, 0); ctx.lineTo(-7, 7); ctx.moveTo(1, -7); ctx.lineTo(8, 0); ctx.lineTo(1, 7); ctx.stroke(); }
      else if (m.s === 'flag') { ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, -9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(8, -5); ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill(); }
      else if (m.s === 'orbit') { ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();
      // label pill
      var lab = (multi ? (qi + 1) + '. ' : '') + m.l + (q.k === 'cap' || q.k === 'awacs' || q.k === 'recon' ? '' : ''); ctx.font = 'bold 10px system-ui'; var tw = ctx.measureText(lab).width + 10;
      ctx.fillStyle = 'rgba(8,14,12,.88)'; ctx.fillRect(b[0] + 10, b[1] - 20, tw, 15); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(b[0] + 10, b[1] - 20, tw, 15); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(lab, b[0] + 15, b[1] - 12);
      a = b;
    });
  });
  // contacts (enemy as you know it)
  if (app.layers.cons) for (var id in con) {
    var c = con[id], pc = w2s(c.x, c.y); if (!on(pc)) continue; var fade = c.lv === 'old', foe = W.OTHER[side];
    if (c.lv === 'unk' || !c.type) {
      ctx.beginPath(); ctx.arc(pc[0], pc[1], Math.max(10, c.err * z), 0, 7); ctx.strokeStyle = 'rgba(242,184,75,.8)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.3; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(40,32,10,.9)'; ctx.strokeStyle = '#f2b84b'; ctx.beginPath(); ctx.rect(pc[0] - 10, pc[1] - 7, 20, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f2b84b'; ctx.font = 'bold 11px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.size === 'large' ? '??' : '?', pc[0], pc[1] + 1);
    } else {
      ctx.globalAlpha = fade ? 0.45 : 1; drawUnitIcon(ctx, pc[0], pc[1], { type: c.type, side: foe }, SIDE_COL[foe], { bar: c.str, sel: app.selCon == c.id, fade: fade }); ctx.globalAlpha = 1;
    }
    if (app.selCon == c.id) { ctx.beginPath(); ctx.arc(pc[0], pc[1], 17, 0, 7); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  // own units
  var small = z < 0.32;
  ownUnits().forEach(function (u) {
    if (!drawn(u)) return; var d = U[u.type], p = upos(u); if (!on(p)) return; var sel = app.sel.indexOf(u.id) >= 0;
    if (small && !sel && (d.cls === 'arty' || d.cls === 'aa' || d.cls === 'eng' || d.cls === 'convoy' || d.cls === 'train' || d.heli)) return;
    var sc = small ? 0.7 : 1; ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(sc, sc);
    drawUnitIcon(ctx, 0, 0, u, SIDE_COL[side], { bar: u.str, sel: sel, fly: airborne(u), fade: u.broken });
    ctx.restore();
    if (u.broken) { ctx.fillStyle = '#ff6b5b'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', p[0] + 12, p[1] - 9); }
    if (u.riders && u.riders.length) { ctx.fillStyle = '#f2b84b'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('▣' + u.riders.length, p[0] - 13, p[1] - 9); }
    if (u.hidden) { ctx.fillStyle = '#9ad0ff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('AMB', p[0], p[1] + 20); }
    if (sel) { ctx.beginPath(); ctx.arc(p[0], p[1], 17, 0, 7); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2; ctx.stroke(); }
  });
  // air selected: range ring + stacked airfield selection ring
  if (app.pick && app.sel.length) {
    var u0 = W.unitById(st, app.sel[0]);
    if (u0 && (U[u0.type].air || U[u0.type].heli) && ['cas', 'strike', 'cut', 'recon', 'cap', 'awacs', 'loiter', 'move', 'lift2'].indexOf(app.pick.kind) >= 0) {
      var d0 = U[u0.type], bx = u0.base != null ? M.air[u0.base][2] : u0.x, by = u0.base != null ? M.air[u0.base][3] : u0.y, pp = w2s(bx, by);
      ctx.beginPath(); ctx.arc(pp[0], pp[1], d0.rad * W.rangeBonus(st, u0) * z, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([2, 6]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (app.pick && app.pick.kind === 'fire') app.sel.forEach(function (id) { var ua = W.unitById(st, id); if (!ua || (U[ua.type].cls !== 'arty' && U[ua.type].cls !== 'ssm')) return; var pa2 = upos(ua); ctx.beginPath(); ctx.arc(pa2[0], pa2[1], U[ua.type].rng * z, 0, 7); ctx.fillStyle = 'rgba(255,70,50,.07)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,90,70,.8)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]); });
  if (app.pick && app.pick.kind === 'nuke' && app.pick.at) { var pn = w2s(app.pick.at.x, app.pick.at.y); ctx.beginPath(); ctx.arc(pn[0], pn[1], app.pick.R * z, 0, 7); ctx.fillStyle = 'rgba(232,255,90,.18)'; ctx.fill(); ctx.strokeStyle = '#e8ff5a'; ctx.lineWidth = 2; ctx.stroke(); }
  // artillery shells (red dots) and craters
  var now = performance.now(), fxs = st.fx || [], ownU = ownUnits();
  fxs.forEach(function (f, fi) {
    if (f.r == null) f.r = now + (fi % 4) * 140;
    var vis = f.s === side; if (!vis) { for (var ou = 0; ou < ownU.length; ou++) if (Math.abs(ownU[ou].x - f.x1) < 35 && Math.abs(ownU[ou].y - f.y1) < 35) { vis = true; break; } } if (!vis) return;
    var age = now - f.r; if (age < 0) return; var p1 = w2s(f.x1, f.y1), p0 = w2s(f.x0, f.y0);
    if (age < 950) {
      var pr = age / 950, x = p0[0] + (p1[0] - p0[0]) * pr, y = p0[1] + (p1[1] - p0[1]) * pr - Math.sin(pr * 3.14) * 16;
      for (var tr = 3; tr >= 1; tr--) { var pt = Math.max(0, pr - tr * 0.05); ctx.fillStyle = 'rgba(255,70,50,' + (0.5 - tr * 0.12) + ')'; ctx.beginPath(); ctx.arc(p0[0] + (p1[0] - p0[0]) * pt, p0[1] + (p1[1] - p0[1]) * pt - Math.sin(pt * 3.14) * 16, 2.4, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ff3b2e'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();
    } else {
      var ia = age - 950; if (ia < 900) { var rr2 = 4 + ia / 900 * 10; ctx.beginPath(); ctx.arc(p1[0], p1[1], rr2, 0, 7); ctx.strokeStyle = 'rgba(255,120,60,' + (1 - ia / 900) + ')'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = 'rgba(255,200,90,' + (0.9 - ia / 1000) + ')'; ctx.beginPath(); ctx.arc(p1[0], p1[1], 3.5, 0, 7); ctx.fill(); }
      var ga = clamp(1 - (st.t - f.t) / 45, 0, 1); ctx.fillStyle = 'rgba(255,48,36,' + (0.25 + 0.65 * ga) + ')'; ctx.beginPath(); ctx.arc(p1[0], p1[1], 2.6, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(40,0,0,.8)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
  });
  // scale bar
  var km = z > 3 ? 20 : z > 1.2 ? 50 : z > 0.5 ? 100 : 300; ctx.strokeStyle = '#d9e2dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, ch - 14); ctx.lineTo(10 + km * z, ch - 14); ctx.stroke(); ctx.fillStyle = '#d9e2dc'; ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(km + ' km', 10, ch - 17);
}
function airborne(u) { return W.airborne(u); }

/* ---------- picking things on the map ---------- */
function pickAt(sx, sy) {
  var st = app.st, side = st.side, out = [];
  parkMap(st);
  ownUnits().forEach(function (u) { if (!drawn(u)) return; var p = upos(u), d = Math.hypot(p[0] - sx, p[1] - sy); if (d < 20) out.push({ t: 'u', id: u.id, d: d }); });
  var con = st.con[side]; for (var id in con) { var c = con[id], p2 = w2s(c.x, c.y), d2 = Math.hypot(p2[0] - sx, p2[1] - sy); if (d2 < 20) out.push({ t: 'k', id: +id, d: d2 + 1 }); }
  if (app.layers.air) for (var i = 0; i < M.air.length; i++) { var A = M.air[i], p3 = w2s(A[2], A[3]), d3 = Math.hypot(p3[0] - sx, p3[1] - sy); if (d3 < 15) { var vis = airStacks(st)[i] || A[5] === 3 && app.view.z > 0.3 || A[5] === 2 && app.view.z > 0.7 || A[5] === 1 && app.view.z > 1.5; if (vis) out.push({ t: 'a', i: i, d: d3 + 2 }); } }
  for (i = 0; i < M.cities.length; i++) { var C = M.cities[i], p4 = w2s(C[1], C[2]), d4 = Math.hypot(p4[0] - sx, p4[1] - sy); if (d4 < 17) out.push({ t: 'c', i: i, d: d4 + 3 }); }
  out.sort(function (a, b) { return a.d - b.d; }); return out;
}

/* ---------- order picking ---------- */
var PICKTXT = { move: 'Tap the map: where should it go?', amove: 'Tap the map: attack-move there (fights anything on the way).', hunt: 'Tap an enemy contact (identified or ?) to hunt it down.', cas: 'Tap an enemy contact or a spot for the ground attack.',
  strike: 'Tap an enemy city or airfield to bomb, or any spot.', cut: 'Tap a railway line to cut it with a strike.', recon: 'Tap the map: recon flight to there.', loiter: 'Tap the map: aircraft circle there and keep hitting enemy ground units in the area until low on fuel.', cap: 'Tap the map: combat air patrol over there.', awacs: 'Tap the map: AWACS station.',
  land: 'Tap one of your airfields to land there.', haul1: 'Tap the friendly city to load supplies from.', haul2: 'Now tap the friendly city to deliver to.', lift1: 'Tap the light unit to pick up.', lift2: 'Tap where to drop it.', bombard: 'Tap the enemy position to shell (the ship sails to within gun range).', sealift1: 'Tap the ground unit to load (near the coast).', sealift2: 'Tap the landing spot on the coast.', board: 'Tap your carrier (APC / BTR unit or truck convoy) to climb aboard.', merge: 'Tap another unit of the same type to merge into it.', mine: 'Tap where the engineers should lay a minefield.', nuke: 'Tap the target for the strike.', fire: 'Tap the spot to shell. Red ring = gun range; the battery moves into range first.' };
function startPick(kind, extra) { app.pick = { kind: kind }; if (extra) for (var k in extra) app.pick[k] = extra[k]; paintBanner(); }
function endPick() { app.pick = null; app.addStop = false; paintBanner(); renderDock(true); }
function issue(cmd) {
  var r = W.issue(app.st, app.sel, cmd, app.addStop);
  if (!r.ok) { toast(r.msg); return false; }
  renderDock(true); return true;
}
function handlePick(sx, sy) {
  var st = app.st, p = app.pick, k = p.kind, w = s2w(sx, sy), hits = pickAt(sx, sy), first = function (t) { for (var i = 0; i < hits.length; i++) if (hits[i].t === t) return hits[i]; return null; };
  var ok = false;
  if (k === 'move' || k === 'amove') {
    if (st.deploy) { var any = false; app.sel.forEach(function (id) { if (W.deployMove(st, id, w.x, w.y)) any = true; }); if (!any) toast('Place units on your own territory (aircraft: use BASE AT).'); else ok = true; }
    else { if (!W.isLand(w.x, w.y) && !app.sel.some(function (id) { var u = W.unitById(st, id); return u && (W.isHeli(u) || U[u.type].naval); })) { toast('That is water.'); return; } ok = issue({ k: k, x: w.x, y: w.y }); }
  } else if (k === 'hunt') { var c = first('k'); if (!c) { toast('No contact there.'); return; } ok = issue({ k: 'hunt', cid: c.id }); }
  else if (k === 'board' || k === 'merge') { var tu = first('u'), tun = tu && W.unitById(st, tu.id); if (!tun || app.sel.indexOf(tun.id) >= 0) { toast(k === 'board' ? 'Tap one of your carriers (APC / BTR / truck convoy).' : 'Tap another unit of the same type.'); return; } ok = issue({ k: k, uid: tun.id }); }
  else if (k === 'mine') { if (!W.isLand(w.x, w.y)) { toast('That is water.'); return; } ok = issue({ k: 'mine', x: w.x, y: w.y }); }
  else if (k === 'bombard') ok = issue({ k: 'bombard', x: w.x, y: w.y });
  else if (k === 'fire') { var cf = first('k'); ok = issue({ k: 'fire', x: cf ? st.con[st.side][cf.id].x : w.x, y: cf ? st.con[st.side][cf.id].y : w.y, mins: app.fireM || 0 }); }
  else if (k === 'sealift1') { var u2 = first('u'); var su2 = u2 && W.unitById(st, u2.id); if (!su2 || !U[su2.type].ground || U[su2.type].heli || U[su2.type].naval || U[su2.type].cls === 'train') { toast('Tap one of your ground units near the coast.'); return; } p.uid = su2.id; p.kind = 'sealift2'; paintBanner(); return; }
  else if (k === 'sealift2') ok = issue({ k: 'lift', uid: p.uid, x: w.x, y: w.y });
  else if (k === 'cas') { var c2 = first('k'); ok = issue(c2 ? { k: 'cas', cid: c2.id, x: st.con[st.side][c2.id].x, y: st.con[st.side][c2.id].y } : { k: 'cas', x: w.x, y: w.y }); }
  else if (k === 'strike') {
    var cc = first('c'), aa = first('a'), foe = W.OTHER[st.side];
    if (aa && st.ad[aa.i].o === foe) ok = issue({ k: 'strike', x: M.air[aa.i][2], y: M.air[aa.i][3], node: { t: 'a', i: aa.i } });
    else if (cc && st.cd[cc.i].o === foe) ok = issue({ k: 'strike', x: M.cities[cc.i][1], y: M.cities[cc.i][2], node: { t: 'c', i: cc.i } });
    else ok = issue({ k: 'strike', x: w.x, y: w.y });
  } else if (k === 'cut') ok = issue({ k: 'strike', x: w.x, y: w.y, node: { t: 'r' } });
  else if (k === 'recon' || k === 'awacs') ok = issue({ k: k, x: w.x, y: w.y, h: app.capH });
  else if (k === 'cap') ok = issue({ k: 'cap', x: w.x, y: w.y, h: app.capH });
  else if (k === 'loiter') ok = issue({ k: 'loiter', x: w.x, y: w.y });
  else if (k === 'land') {
    var a = first('a'); if (!a || st.ad[a.i].o !== st.side) { toast('Tap one of your own airfields.'); return; }
    if (st.deploy) { var d = false; app.sel.forEach(function (id) { if (W.deployMove(st, id, 0, 0, a.i)) d = true; }); ok = d; if (!d) toast('Only aircraft can be based there.'); }
    else ok = issue({ k: 'land', af: a.i, x: M.air[a.i][2], y: M.air[a.i][3] });
  } else if (k === 'haul1') { var c3 = first('c'); if (!c3 || st.cd[c3.i].o !== st.side) { toast('Tap a friendly city.'); return; } p.from = c3.i; p.kind = 'haul2'; paintBanner(); return; }
  else if (k === 'haul2') { var c4 = first('c'); if (!c4 || st.cd[c4.i].o !== st.side || c4.i === p.from) { toast('Tap a different friendly city.'); return; } ok = issue({ k: 'haul', from: p.from, to: c4.i }); }
  else if (k === 'lift1') { var u1 = first('u'); var lu = u1 && W.unitById(st, u1.id); if (!lu || ['inf', 'vdv', 'cav', 'brdm', 'eng', 'peng'].indexOf(lu.type) < 0) { toast('Helicopters lift infantry, cavalry and engineers.'); return; } p.uid = lu.id; p.kind = 'lift2'; paintBanner(); return; }
  else if (k === 'lift2') ok = issue({ k: 'lift', uid: p.uid, x: w.x, y: w.y });
  else if (k === 'nuke') { p.at = { x: w.x, y: w.y }; var del = W.deliveryFor(st, st.side, w.x, w.y); app.modal = { type: 'nuke', id: p.id, x: w.x, y: w.y, del: del, R: p.R }; renderModal(); return; }
  if (ok && !app.addStop) endPick(); else if (ok) { paintBanner(); }
}

/* ---------- selection ---------- */
function selectUnit(id, additive) {
  var i = app.sel.indexOf(id);
  if (additive || app.multi) { if (i >= 0) app.sel.splice(i, 1); else app.sel.push(id); } else app.sel = [id];
  app.selNode = null; app.selCon = null; app.tab = 'units'; if (!app.dock) app.dock = 1; renderDock(true);
}
function onTap(sx, sy) {
  if (app.pick) { handlePick(sx, sy); return; }
  var hits = pickAt(sx, sy);
  if (!hits.length) { app.sel = []; app.selNode = null; app.selCon = null; renderDock(true); return; }
  // cycle through stacked own units on repeated taps
  var unitsHit = hits.filter(function (h) { return h.t === 'u'; });
  var h = hits[0];
  if (unitsHit.length > 1 && h.t === 'u') { var idx = unitsHit.findIndex(function (x) { return app.sel.length === 1 && app.sel[0] === x.id; }); h = unitsHit[(idx + 1) % unitsHit.length]; }
  if (h.t === 'u') { selectUnit(h.id); return; }
  if (h.t === 'k') { app.selCon = h.id; app.selNode = null; if (app.sel.length) app.utab = 'atk'; app.tab = 'units'; if (!app.dock) app.dock = 1; renderDock(true); return; }
  app.selNode = { t: h.t, i: h.i }; app.selCon = null; if (!app.multi) app.sel = []; app.tab = 'units'; if (!app.dock) app.dock = 1; renderDock(true);
}

/* ---------- panels ---------- */
function icoFor(type, side) {
  var d = U[type], k = d.air ? (d.cls === 'awacs' ? 'awacs' : d.cls === 'tanker' ? 'tanker' : 'jet') : d.heli ? 'heli' : ({ gnd: (type === 'armor' || type === 'tank' || type === 'gtank') ? 'tank' : (type === 'inf' || type === 'vdv') ? 'apc' : 'ifv', recon: 'ifv', arty: 'arty', aa: 'spaa', eng: 'eng', train: 'train', convoy: 'truck', ssm: 'missile', carrier: 'carrier', amphib: 'lst', transport: 'lst', sub_attack: 'sub', sub_diesel: 'sub', cruiser: 'ship', destroyer: 'ship', frigate: 'ship', corvette: 'ship' })[d.cls] || 'tank';
  return '<svg class="ico ' + side + '" viewBox="0 0 48 28"><use href="#i-' + k + '"/></svg>';
}
function bar(v, c) { return '<div class="bar ' + (c || '') + '"><i style="width:' + clamp(v, 0, 100) + '%"></i></div>'; }
function orderText(u) {
  var o = u.orders && u.orders[0], st = app.st; if (U[u.type].air && u.state === 'base') return o ? 'ready: ' + o.k : 'on the ground';
  if (u.broken) return 'broken, falling back'; if (!o) return U[u.type].air || U[u.type].heli ? (u.state === 'fly' ? 'returning' : 'landed') : (u.dig >= 1 ? 'dug in' : u.dig > 0 ? 'digging in' : 'idle');
  var n = u.orders.length > 1 ? ' +' + (u.orders.length - 1) : '';
  var m = { move: 'moving', amove: 'attack-move', hunt: 'hunting', hold: 'holding', dig: 'digging in', wait: 'waiting', haul: 'hauling', cas: 'ground attack', strike: 'strike', recon: 'recon', cap: 'patrol', loiter: 'circling & attacking', awacs: 'AWACS', rtb: 'returning', land: 'landing', lift: 'air assault', bombard: 'shelling', airstrike: 'air strike', board: 'boarding', unload: 'unloading', ambush: u.hidden ? 'hidden in ambush' : 'setting an ambush', mine: 'heading to lay mines', laying: 'laying mines', repair: 'repairing nearby units', merge: 'merging' };
  return (m[o.k] || o.k) + n;
}
function chip(a, label, extra, on) { return '<button data-a="' + a + '"' + (on ? ' class="on"' : '') + (extra ? ' ' + extra : '') + '>' + label + '</button>'; }
function cmdChips(su) {
  var st = app.st, h = '', anyG = su.some(function (u) { var d = U[u.type]; return d.ground && !d.heli && d.cls !== 'train'; }), anyT = su.some(function (u) { return ['train', 'convoy'].indexOf(U[u.type].cls) >= 0; }),
    anyN = su.some(function (u) { return U[u.type].naval; }), anyA = su.some(function (u) { return U[u.type].air; }), anyH = su.some(function (u) { return U[u.type].heli; }), roles = {};
  su.forEach(function (u) { (U[u.type].roles || []).forEach(function (r) { roles[r] = 1; }); if (U[u.type].heli && U[u.type].a2g) roles.cas = 1; });
  var anyAtk = su.some(function (u) { return U[u.type].a > 0 && U[u.type].ground && !U[u.type].heli; });
  if (st.deploy) { h += '<div class="chips">' + (anyG || anyT || anyH || anyN ? chip('pick:move', 'PLACE') : '') + (anyA ? chip('pick:land', 'BASE AT') : '') + '</div>'; return h; }
  h += '<div class="chips">';
  if (anyG || anyT) h += chip('pick:move', 'MOVE');
  if (anyN) {
    var nv = su.filter(function (u) { return U[u.type].naval; }).map(function (u) { return U[u.type]; });
    h += chip('pick:move', 'SAIL TO') + (nv.some(function (d) { return d.sa > 0; }) ? chip('pick:amove', 'PATROL-ATTACK') + chip('pick:hunt', 'HUNT SHIP') : '') + (nv.some(function (d) { return d.shore > 0; }) ? chip('pick:bombard', 'BOMBARD') : '') + (nv.some(function (d) { return d.cvw; }) ? chip('pick:strike', 'CARRIER STRIKE') + chip('pick:cas', 'CARRIER GROUND ATTACK') : '') + (nv.some(function (d) { return d.lift; }) ? chip('pick:sealift1', 'SEALIFT TROOPS') : '') + chip('do:hold', 'HOLD');
  }
  if (anyAtk) h += chip('pick:amove', 'ATTACK-MOVE') + chip('pick:hunt', 'HUNT');
  if (anyG) h += chip('do:dig', 'DIG IN') + chip('do:hold', 'HOLD');
  if (anyT) h += chip('pick:haul1', 'HAUL SUPPLIES');
  if (anyH) h += chip('pick:move', 'FLY TO') + (roles.cas ? chip('pick:cas', 'ATTACK') : '') + (su.some(function (u) { return U[u.type].lift; }) ? chip('pick:lift1', 'LIFT TROOPS') : '');
  if (anyA) h += (roles.cas ? chip('pick:cas', 'GROUND ATTACK') : '') + (roles.strike ? chip('pick:strike', 'STRIKE') + chip('pick:cut', 'CUT RAIL') : '') + (roles.cap ? chip('pick:cap', 'PATROL') : '') + (roles.recon ? chip('pick:recon', 'RECON') : '') + (roles.awacs ? chip('pick:awacs', 'AWACS STATION') : '') + chip('pick:land', 'LAND AT');
  h += '</div><div class="chips">' + chip('stop', '+ STOP', '', app.addStop) + (anyA || su.some(function (u) { return U[u.type].heli; }) ? chip('caph', 'PATROL ' + app.capH + 'h') : '') + chip('clear', 'CLEAR ORDERS') + chip('multi', 'MULTI', '', app.multi) + '</div>';
  return h;
}
function nodeInfo() {
  var st = app.st, n = app.selNode, h = ''; if (!n) return h;
  if (n.t === 'c') {
    var C = M.cities[n.i], cd = st.cd[n.i];
    h += '<div class="card"><h3><span>' + esc(C[0]) + (C[5] ? ' ★' : '') + '</span><span class="mono" style="color:' + SIDE_COL[cd.o] + '">' + cd.o + '</span></h3><div class="kv"><span>Population (approx)</span><span>' + C[3] + 'k</span><span>Supply stock</span><span>' + Math.round(cd.stk) + '</span><span>Infrastructure</span><span>' + Math.round(cd.inf) + '%</span><span>Rail from the rear</span><span>' + (cd.conn ? 'yes' : 'cut off') + '</span></div></div>';
    if (cd.o === st.side) h += '<div class="chips">' + chip('buyat:c' + n.i, 'DEPLOY NEW UNITS HERE') + '</div>';
  } else {
    var A = M.air[n.i], ad = st.ad[n.i], wings = st.units.filter(function (u) { return u.side === st.side && U[u.type].air && u.state === 'base' && u.base === n.i && u.str > 0; });
    h += '<div class="card"><h3><span>' + esc(A[0]) + '</span><span class="mono" style="color:' + SIDE_COL[ad.o] + '">' + ad.o + '</span></h3><div class="kv"><span>Runway</span><span>' + A[4] + ' m</span><span>Class</span><span>' + ['', 'small', 'medium', 'large'][A[5]] + (A[6] ? ', military' : '') + '</span><span>Runway damage</span><span>' + Math.round(ad.dmg * 100) + '%</span><span>Wings here</span><span>' + wings.length + '</span></div></div>';
    if (ad.o === st.side) {
      h += '<div class="chips">' + chip('buyat:a' + n.i, 'DEPLOY NEW AIRCRAFT HERE') + (wings.length ? chip('selwings:' + n.i, 'SELECT ALL WINGS') : '') + '</div>';
      wings.forEach(function (u) { h += '<div class="urow" data-a="selu:' + u.id + '">' + icoFor(u.type, u.side) + '<div class="g"><div class="n">' + esc(U[u.type].n) + '</div><div class="s">str ' + Math.round(u.str) + '% · ' + (u.rdy > st.t ? 'ready in ' + Math.ceil((u.rdy - st.t) / 60) + 'h' : 'ready') + (u.orders.length ? ' · ' + orderText(u) : '') + '</div></div></div>'; });
    }
  }
  return h;
}
function conInfo() {
  var st = app.st, c = st.con[st.side][app.selCon], h = ''; if (!c) return h;
  var age = Math.round((st.t - c.t) / 60);
  h += '<div class="card"><h3><span>' + (c.lv === 'unk' ? 'Unknown contact' : esc(U[c.type].n)) + '</span><span class="mono warn">' + (c.lv === 'id' ? 'IDENTIFIED' : c.lv === 'old' ? 'LAST KNOWN' : 'UNKNOWN') + '</span></h3><div class="kv">' + (c.type ? '<span>Strength</span><span>' + c.str + '%</span>' : '<span>Size</span><span>' + (c.size || '?') + '</span>') + '<span>Last seen</span><span>' + (age < 1 ? 'now' : age + 'h ago') + '</span>' + (c.lv === 'unk' ? '<span>Position error</span><span>~' + Math.round(c.err) + ' km</span>' : '') + '</div></div>';
  if (app.sel.length) h += '<div class="chips">' + chip('huntsel', 'HUNT WITH SELECTED') + chip('strikecon', 'AIR STRIKE WITH SELECTED') + '</div>'; else h += '<div class="note">Select your own units first, then send them after this contact.</div>';
  return h;
}
function panelUnits() {
  var st = app.st, su = app.sel.map(function (id) { return W.unitById(st, id); }).filter(Boolean), h = '';
  app.sel = su.map(function (u) { return u.id; });
  if (app.pick) h += '<div class="note">' + esc(PICKTXT[app.pick.kind] || '') + '</div>';
  if (!su.length && !app.selNode && app.selCon == null) {
    h += '<div class="note">Tap one of your units, an airfield or a city on the map. Drag to pan, pinch to zoom.</div><div class="chips">' + chip('selall:ground', 'SELECT ALL GROUND') + chip('selall:air', 'SELECT ALL AIR') + chip('selall:heli', 'ALL HELICOPTERS') + chip('selall:naval', 'ALL SHIPS') + '</div>';
    return h;
  }
  if (su.length) {
    h += '<div class="chips">' + chip('selsame', 'SAME TYPE') + chip('selall:ground', 'ALL GROUND') + chip('selall:air', 'ALL AIR') + chip('selnone', 'DESELECT') + '</div>';
    su.slice(0, 40).forEach(function (u) {
      var d = U[u.type], extra = d.air ? ' · fuel ' + Math.max(0, Math.round(u.fuel)) + ' km' : '';
      h += '<div class="urow" data-a="selu:' + u.id + '" data-keep="1">' + icoFor(u.type, u.side) + '<div class="g"><div class="n">' + esc(d.n) + '</div><div class="s">str ' + Math.round(u.str) + ' · sup ' + Math.round(u.sup) + ' · mor ' + Math.round(u.mor) + ' · ' + orderText(u) + extra + '</div>' + bar(u.str, u.str > 60 ? '' : u.str > 30 ? 'w' : 'r') + '</div></div>';
    });
    if (su.length > 40) h += '<div class="dim">+' + (su.length - 40) + ' more selected</div>';
    h += cmdChips(su);
  }
  h += conInfo() + nodeInfo();
  return h;
}
function etaText(u) {
  var d = U[u.type], o = u.orders[0]; if (!o) return '';
  var L = 0, x = u.x, y = u.y;
  if (u.path && u.path.length) u.path.forEach(function (p) { L += Math.hypot(p.x - x, p.y - y); x = p.x; y = p.y; });
  else if (o.k === 'hunt') { var c = app.st.con[app.st.side][o.cid]; if (c) L = Math.hypot(c.x - x, c.y - y); }
  else if (o.k === 'haul') { var C = M.cities[u.load > 0 ? o.to : o.from]; L = Math.hypot(C[1] - x, C[2] - y); }
  else if (o.x != null) L = Math.hypot(o.x - x, o.y - y);
  if (!L) return '';
  var sp = d.sp * ((d.naval || d.air || d.heli || d.cls === 'train') ? 1 : 0.7), h = L / Math.max(5, sp);
  return Math.round(L) + ' km · ' + (h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h.toFixed(1) + ' h');
}
function panelMove() {
  var st = app.st, mine = ownUnits().filter(function (u) { var d = U[u.type]; return !(d.air && u.state === 'base'); });
  var moving = mine.filter(function (u) { return u.orders.length && ['dig', 'hold'].indexOf(u.orders[0].k) < 0; }), idle = mine.filter(function (u) { return !u.orders.length && !U[u.type].air; });
  var h = '<div class="card"><h3><span>Movement</span><span class="mono">' + moving.length + ' moving · ' + idle.length + ' idle</span></h3><p>Every unit with orders, with distance and time to go. Tap a row to select it and give it new orders on the Units tab.</p></div>';
  h += '<div class="chips">' + chip('selmoving', 'SELECT MOVING') + chip('selidle', 'SELECT IDLE') + chip('stopall', 'STOP ALL MOVING') + chip('auto', 'AUTO SUPPLY ' + (st.set.auto !== false ? 'ON' : 'OFF'), '', st.set.auto !== false) + '</div>';
  var order = { ground: 0, naval: 1, heli: 2, air: 3, log: 4 };
  function grp(u) { var d = U[u.type]; return d.cls === 'train' || d.cls === 'convoy' ? 'log' : d.naval ? 'naval' : d.heli ? 'heli' : d.air ? 'air' : 'ground'; }
  var names = { ground: 'Ground forces', naval: 'Fleet', heli: 'Helicopters', air: 'Aircraft in the air', log: 'Supply trains and convoys' };
  var lists = {}; moving.concat(idle.filter(function (u) { return grp(u) === 'log'; })).forEach(function (u) { (lists[grp(u)] = lists[grp(u)] || []).push(u); });
  Object.keys(order).forEach(function (g) {
    var l = lists[g]; if (!l || !l.length) return;
    h += '<div class="lbl">' + names[g] + ' (' + l.length + ')</div>';
    l.slice(0, 40).forEach(function (u) {
      var d = U[u.type], on = app.sel.indexOf(u.id) >= 0;
      h += '<div class="urow" data-a="selu:' + u.id + '"' + (on ? ' style="outline:1px solid #f2b84b"' : '') + '>' + icoFor(u.type, u.side) + '<div class="g"><div class="n">' + esc(d.n) + '</div><div class="s">' + orderText(u) + (etaText(u) ? ' · ' + etaText(u) : '') + (u.load > 0 ? ' · load ' + Math.round(u.load) : '') + '</div>' + bar(u.str, u.str > 60 ? '' : u.str > 30 ? 'w' : 'r') + '</div><button data-a="clr1:' + u.id + '">✕</button></div>';
    });
    if (l.length > 40) h += '<div class="dim">+' + (l.length - 40) + ' more</div>';
  });
  if (!moving.length) h += '<div class="dim">Nothing is on the move. Select a unit and give it orders.</div>';
  return h;
}

/* ---------- the unit panel: replaces the tabs while units are selected ---------- */
function unitMode() { var st = app.st; if (!st || !app.sel.length) return false; return app.sel.some(function (id) { return W.unitById(st, id); }); }
function hmT(t) { return W.dateStr(t); }
function selUnits() { var st = app.st; return app.sel.map(function (id) { return W.unitById(st, id); }).filter(Boolean); }
function hint(t) { return '<div class="hint">' + t + '</div>'; }
function unitHead(su) {
  var h = '';
  if (su.length === 1) {
    var u = su[0], d = U[u.type];
    h += '<div class="uhead">' + icoFor(u.type, u.side) + '<div class="g"><div class="n">' + esc(d.n) + '</div><div class="s">' + orderText(u) + (etaText(u) ? ' · ' + etaText(u) : '') + '</div>' + (W.zoneR(u) ? '<div class="s">' + ({ aggr: '🔥 Aggressive', pass: '🛡 Passive', neut: '🕊 Neutral' }[u.stance || 'aggr']) + ' · Zone ' + Math.round(W.zoneR(u)) + ' km: takes the land inside when no enemy is in it</div>' : '') + (u.riders && u.riders.length ? '<div class="s">Carrying: ' + u.riders.map(function (id) { var r = W.unitById(app.st, id); return r ? esc(U[r.type].n.split(' (')[0]) : ''; }).join(', ') + '</div>' : (d.carry ? '<div class="s">Carrier: holds ' + d.carry + ' infantry unit. Infantry: BOARD, then tap this unit.</div>' : '')) + '</div><div class="bars">' +
      '<span>STR</span>' + bar(u.str, u.str > 60 ? '' : u.str > 30 ? 'w' : 'r') + '<span>SUPPLY</span>' + bar(u.sup, u.sup > 40 ? '' : u.sup > 15 ? 'w' : 'r') + '<span>MORALE</span>' + bar(u.mor, u.mor > 50 ? '' : u.mor > 25 ? 'w' : 'r') + (d.air ? '<span>FUEL</span>' + bar(u.fuel / (d.rad * 2) * 100, 'c') : '') + (d.msl ? '<span>' + esc(d.mname || 'MISSILES').toUpperCase() + ' ' + Math.floor(u.msl) + '/' + d.msl + '</span>' + bar(u.msl / d.msl * 100, u.msl >= 1 ? 'c' : 'r') : '') + '</div></div>';
  } else {
    var types = {}; su.forEach(function (u) { types[U[u.type].n] = (types[U[u.type].n] || 0) + 1; });
    var avg = su.reduce(function (a, u) { return a + u.str; }, 0) / su.length;
    h += '<div class="uhead"><div class="g"><div class="n">' + su.length + ' units selected</div><div class="s">' + Object.keys(types).slice(0, 3).map(function (k) { return types[k] + '× ' + k.split(' (')[0]; }).join(' · ') + (Object.keys(types).length > 3 ? ' …' : '') + '</div></div><div class="bars"><span>AVG STR</span>' + bar(avg, avg > 60 ? '' : avg > 30 ? 'w' : 'r') + '</div></div>';
  }
  return h;
}
function groupKinds(su) {
  var g = { gnd: 0, nav: 0, air: 0, heli: 0, log: 0, arty: 0, atk: 0 }, roles = {}, nv = [];
  su.forEach(function (u) { var d = U[u.type];
    if (d.naval) { g.nav++; nv.push(d); } else if (d.air) g.air++; else if (d.heli) g.heli++; else if (d.cls === 'train' || d.cls === 'convoy') g.log++; else if (d.ground) { g.gnd++; if (d.cls === 'arty') g.arty++; if (d.cls === 'ssm') g.ssm = (g.ssm || 0) + 1; if (d.a > 0) g.atk++; }
    (d.roles || []).forEach(function (r) { roles[r] = 1; }); if (d.heli && d.a2g) roles.cas = 1; });
  g.roles = roles; g.nv = nv; return g;
}
function pickBanner() { return app.pick ? '<div class="note pickn"><b>' + esc(PICKTXT[app.pick.kind] || 'Tap the map.') + '</b> <button data-a="cancel">CANCEL</button></div>' : ''; }
function uMove(su, g) {
  var st = app.st, h = '';
  if (st.deploy) {
    return hint('Deployment: tap PLACE, then tap a spot in your own territory.' + (g.air ? ' Aircraft use BASE AT, then tap an airfield.' : '')) + '<div class="chips">' + (g.gnd + g.log + g.heli + g.nav ? chip('pick:move', '📍 PLACE') : '') + (g.air ? chip('pick:land', '🛬 BASE AT') : '') + '</div>';
  }
  h += hint('Tap a command, then tap the map. <b>Tip:</b> long-press the map to send the selected units there.');
  h += '<div class="chips">';
  if (g.gnd || g.log) h += chip('pick:move', '➡ MOVE');
  if (g.nav) h += chip('pick:move', '⚓ SAIL TO');
  if (g.heli) h += chip('pick:move', '🚁 FLY TO');
  if (g.air) h += chip('pick:land', '🛬 LAND AT');
  if (g.log) h += chip('pick:haul1', '🚚 HAUL SUPPLIES');
  h += '</div><div class="chips">' + (g.gnd + g.nav ? chip('do:hold', '✋ HOLD') : '') + (g.gnd ? chip('do:dig', '⛏ DIG IN') : '') + chip('stop', '➕ ADD STOP', '', app.addStop) + chip('clear', '✖ CLEAR ORDERS') + '</div>';
  if (app.addStop) h += '<div class="note good">ADD STOP is on: every target you pick is added to the route instead of replacing it.</div>';
  var u = su[0]; if (u && u.orders.length) { h += '<div class="lbl">Route</div>'; h += routeList(u); }
  return h;
}
function routeList(u) {
  var h = '', x = u.x, y = u.y;
  u.orders.slice(0, 8).forEach(function (o, i) {
    var tx = o.x, ty = o.y; if (o.k === 'hunt') { var c = app.st.con[app.st.side][o.cid]; if (c) { tx = c.x; ty = c.y; } } else if (o.k === 'haul') { tx = M.cities[o.to][1]; ty = M.cities[o.to][2]; }
    var L = tx != null ? Math.round(Math.hypot(tx - x, ty - y)) : 0; if (tx != null) { x = tx; y = ty; }
    h += '<div class="rrow"><b>' + (i + 1) + '</b><div class="g"><div class="n">' + esc(W.orderWord(o)) + (tx != null ? ' → ' + esc(W.placeName(tx, ty)) : '') + '</div><div class="s">' + (L ? L + ' km' : '') + (o.left != null ? ' · ' + Math.round(o.left) + ' min left' : '') + '</div></div><button data-a="rmord:' + u.id + ':' + i + '">✕</button></div>';
  });
  return h;
}
function reachOf(u) { var d = U[u.type]; return d.air ? d.rad * W.rangeBonus(app.st, u) : d.heli ? d.rad : (d.cls === 'arty' || d.cls === 'ssm') ? d.rng : d.naval ? (d.rng || 20) : 12; }
function uAtk(su, g) {
  var st = app.st, h = ''; if (st.deploy) return hint('Attack orders unlock when the war starts.');
  var nvA = g.nv.some(function (d) { return d.sa > 0; }), cas = g.roles.cas, strike = g.roles.strike;
  if (g.gnd || g.nav || g.arty || g.atk) {
    var stn = {}, kk = ['aggr', 'pass', 'neut']; su.forEach(function (x) { var d0 = U[x.type]; if (d0.ground || d0.naval) stn[x.stance || 'aggr'] = 1; });
    var one = Object.keys(stn).length === 1 ? Object.keys(stn)[0] : null;
    h += '<div class="lbl">Stance (what it does by itself)</div><div class="chips">' + chip('stance:aggr', '🔥 AGGRESSIVE', '', one === 'aggr') + chip('stance:pass', '🛡 PASSIVE', '', one === 'pass') + chip('stance:neut', '🕊 NEUTRAL', '', one === 'neut') + '</div>' +
      hint(one === 'pass' ? 'Passive: only shoots back after it has been attacked.' : one === 'neut' ? 'Neutral: never fires on its own. Explicit barrage and missile orders still work.' : one === 'aggr' ? 'Aggressive (default): attacks every enemy inside its circle.' : 'Mixed stances in this selection.');
  }
  h += hint('Pick how to attack, then tap the target on the map (a red ? or unit works).');
  if (app.selCon != null && st.con[st.side][app.selCon]) h += conInfo();
  h += '<div class="lbl">Ground and sea</div><div class="chips">';
  if (g.atk || g.nav) h += (g.atk || nvA ? chip('pick:amove', '⚔ ATTACK-MOVE') + chip('pick:hunt', '🎯 HUNT A CONTACT') : '');
  if (g.arty) h += chip('pick:fire', '💥 ARTILLERY BARRAGE') + chip('firem', app.fireM ? '⏱ ' + app.fireM + ' min' : '⏱ ∞ UNTIL STOPPED') + chip('cfire', '⛔ CEASE FIRE');
  if (g.ssm) h += chip('pick:fire', '🚀 CONVENTIONAL MISSILE STRIKE') + chip('firem', app.fireM ? '⏱ ' + app.fireM + ' min' : '⏱ ∞ UNTIL STOPPED') + chip('cfire', '⛔ CEASE FIRE');
  if (g.nv.some(function (d) { return d.shore > 0; })) h += chip('pick:bombard', '🚢 SHELL THE COAST');
  if (!(g.atk || g.nav || g.arty || g.ssm)) h += '<span class="dim">This selection has no ground attack.</span>';
  h += '</div>';
  if (g.air || g.heli || g.nv.some(function (d) { return d.cvw; })) {
    h += '<div class="lbl">Air</div><div class="chips">' + (cas ? chip('pick:cas', '💣 GROUND ATTACK') : '') + (strike ? chip('pick:strike', '🏭 STRIKE CITY / AIRFIELD') + chip('pick:cut', '🚂 CUT RAIL') : '') + (g.nv.some(function (d) { return d.cvw; }) ? chip('pick:strike', '✈ CARRIER STRIKE') + chip('pick:cas', '✈ CARRIER GROUND ATTACK') : '') + (!cas && !strike && !g.nv.length ? '<span class="dim">No attack role.</span>' : '') + '</div>';
  }
  // targets in reach of the first unit
  var u = su[0], R = reachOf(u) * (U[u.type].air || U[u.type].heli ? 1.0 : 1.4), con = st.con[st.side], list = [];
  for (var id in con) { var c = con[id]; if (c.lv === 'unk' || c.air) continue; var dd = Math.hypot(c.x - u.x, c.y - u.y); if (dd <= Math.max(R, 30)) list.push({ c: c, d: dd }); }
  list.sort(function (a, b) { return a.d - b.d; });
  h += '<div class="lbl">Known enemies in reach (' + list.length + ')</div>';
  if (!list.length) h += '<div class="dim">None. Recon and sensors reveal more.</div>';
  list.slice(0, 6).forEach(function (t) {
    var d2 = U[t.c.type] || {}, mode = (g.arty || g.ssm) ? 'fire' : (g.air || g.heli) ? 'cas' : 'hunt', lab = mode === 'fire' ? 'SHELL' : mode === 'cas' ? 'ATTACK' : 'HUNT';
    h += '<div class="rrow"><div class="g"><div class="n">' + esc(d2.n || 'Contact') + '</div><div class="s">' + Math.round(t.d) + ' km ' + '· str ' + t.c.str + '%</div></div><button data-a="tgt:' + t.c.id + ':' + mode + '">' + lab + '</button></div>';
  });
  if (su.length === 1) h += '<div class="lbl">Record</div><div class="kv"><span>Kills</span><span>' + (su[0].kills || 0) + '</span><span>Last engaged</span><span>' + (su[0].bt > 0 ? 'just now' : 'quiet') + '</span></div>';
  return h;
}
function uTrk(su) {
  var u = su[0], h = '', t = u.trk || [];
  h += hint('Where the unit has been. The trail is drawn on the map while this unit is selected.');
  h += '<div class="chips">' + chip('trail', app.showTrail !== false ? '👁 TRAIL ON' : '👁 TRAIL OFF', '', app.showTrail !== false) + chip('clrtrk', '🧹 CLEAR TRAIL') + '</div>';
  h += '<div class="kv"><span>Distance travelled</span><span>' + Math.round(u.dist || 0) + ' km</span><span>Trail points</span><span>' + t.length + '</span><span>Now</span><span>' + esc(W.placeName(u.x, u.y)) + '</span></div>';
  if (su.length > 1) h += '<div class="dim">Showing the first of ' + su.length + ' selected units.</div>';
  h += '<div class="lbl">Recent positions</div>';
  if (!t.length) h += '<div class="dim">No movement yet.</div>';
  t.slice(-8).reverse().forEach(function (q, i) { h += '<div class="rrow"><b>' + (t.length - i) + '</b><div class="g"><div class="n">' + esc(W.placeName(q[0], q[1])) + '</div></div></div>'; });
  return h;
}
function uTask(su, g) {
  var st = app.st, h = '', u = su[0];
  h += hint('Special jobs and the order queue. Orders run top to bottom.');
  h += '<div class="chips">';
  if (g.air || g.heli) h += (g.roles.cas ? chip('pick:loiter', '🔄 CIRCLE & ATTACK AREA') : '') + (g.roles.cap ? chip('pick:cap', '🛡 PATROL (CIRCLE)') : '') + (g.roles.recon ? chip('pick:recon', '🔍 RECON') : '') + (g.roles.awacs ? chip('pick:awacs', '📡 AWACS ORBIT') : '') + chip('caph', '⏱ ' + app.capH + ' h');
  if (g.heli && su.some(function (x) { return U[x.type].lift; })) h += chip('pick:lift1', '🚁 AIR-LIFT TROOPS');
  if (g.nv.some(function (d) { return d.lift; })) h += chip('pick:sealift1', '🚢 SEALIFT TROOPS');
  if (g.log) h += chip('pick:haul1', '🚚 HAUL SUPPLIES');
  h += chip('multi', '☑ MULTI-SELECT', '', app.multi) + chip('clear', '✖ CLEAR ALL ORDERS') + '</div>';
  h += '<div class="lbl">Order queue' + (su.length > 1 ? ' (first unit)' : '') + '</div>';
  h += u.orders.length ? routeList(u) : '<div class="dim">No orders. This unit is ' + esc(orderText(u)) + '.</div>';
  if (su.length > 1) {
    h += '<div class="lbl">Selected units</div><div class="chips">' + chip('selsame', 'SAME TYPE') + chip('selall:ground', 'ALL GROUND') + chip('selall:air', 'ALL AIR') + chip('selall:naval', 'ALL SHIPS') + '</div>';
    su.slice(0, 30).forEach(function (x) { h += '<div class="urow">' + icoFor(x.type, x.side) + '<div class="g"><div class="n">' + esc(U[x.type].n) + '</div><div class="s">str ' + Math.round(x.str) + ' · ' + orderText(x) + '</div></div><button data-a="unsel:' + x.id + '">✕</button></div>'; });
  }
  return h;
}
function uHist(su) {
  var u = su[0], h = hint('What this unit has done and what happened to it.');
  var l = (u.hist || []).slice().reverse();
  if (!l.length) return h + '<div class="dim">Nothing yet.</div>';
  l.forEach(function (e) { h += '<div class="hrow"><span class="mono">' + esc(hmT(e.t)) + '</span><span>' + esc(e.m) + '</span></div>'; });
  if (su.length > 1) h += '<div class="dim">Showing the first of ' + su.length + ' selected units.</div>';
  return h;
}
/* Simple mode (default): the few buttons that matter for this selection. "All options" brings back the full tabs. */
function uSimple(su, g) {
  var st = app.st, h = '', u = su[0];
  if (st.deploy) return uMove(su, g);
  var any = function (f) { return su.some(f); };
  var foot = any(function (x) { return U[x.type].foot; }), carry = any(function (x) { return U[x.type].carry; }), eng = any(function (x) { return U[x.type].cls === 'eng'; }), aboard = 0;
  su.forEach(function (x) { aboard += (x.riders || []).length; });
  var fighter = any(function (x) { var d = U[x.type]; return d.ground && !d.heli && d.a > 0 && (d.cls === 'gnd' || d.cls === 'recon'); });
  h += hint('Tap a button, then tap the map. <b>Tip:</b> long-press the map to send the selected units there.');
  h += '<div class="chips">';
  if (g.gnd || g.log) h += chip('pick:move', '➡ MOVE');
  if (g.nav) h += chip('pick:move', '⚓ SAIL TO');
  if (g.heli) h += chip('pick:move', '🚁 FLY TO');
  if (g.air) h += chip('pick:land', '🛬 LAND AT');
  if (g.atk || g.nav) h += chip('pick:amove', '⚔ ATTACK');
  if (g.arty || g.ssm) h += chip('pick:fire', '💥 FIRE') + chip('cfire', '⛔ CEASE FIRE');
  if (g.air || g.heli) h += (g.roles.cas ? chip('pick:cas', '💣 ATTACK') : '') + (g.roles.cap ? chip('pick:cap', '🛡 PATROL') : '') + (g.roles.strike ? chip('pick:strike', '🏭 STRIKE') : '') + (g.roles.recon ? chip('pick:recon', '🔍 RECON') : '') + (g.roles.awacs ? chip('pick:awacs', '📡 AWACS') : '');
  if (g.log) h += chip('pick:haul1', '🚚 HAUL SUPPLIES');
  if (g.gnd && fighter) h += chip('do:dig', '⛏ DIG IN') + chip('do:ambush', '🕶 AMBUSH');
  if (g.gnd || g.nav) h += chip('do:hold', '✋ HOLD');
  h += '</div>';
  var sp = '';
  if (foot) sp += chip('pick:board', '🚌 BOARD CARRIER');
  if (carry) sp += chip('do:unload', '⬇ UNLOAD' + (aboard ? ' (' + aboard + ')' : ''));
  if (g.gnd && !g.log) sp += chip('pick:merge', '🔗 MERGE');
  if (eng) sp += chip('do:mine', '⛓ MINES HERE') + chip('pick:mine', '⛓ MINES AT…') + chip('do:repair', '🔧 REPAIR NEARBY');
  if (g.heli && any(function (x) { return U[x.type].lift; })) sp += chip('pick:lift1', '🚁 LIFT TROOPS');
  if (g.nv.some(function (d) { return d.lift; })) sp += chip('pick:sealift1', '🚢 SEALIFT TROOPS');
  if (sp) h += '<div class="lbl">Special</div><div class="chips">' + sp + '</div>';
  h += '<div class="chips">' + chip('stop', '➕ ADD STOP', '', app.addStop) + chip('clear', '✖ CLEAR ORDERS') + chip('simple:0', '⚙ ALL OPTIONS') + '</div>';
  if (app.addStop) h += '<div class="note good">ADD STOP is on: every target you pick is added to the route instead of replacing it.</div>';
  if (u && u.orders.length) { h += '<div class="lbl">Route</div>' + routeList(u); }
  return h;
}
function panelUnit() {
  var su = selUnits(); app.sel = su.map(function (u) { return u.id; }); if (!su.length) return '';
  var g = groupKinds(su), h = unitHead(su) + pickBanner();
  if (app.simple !== false) return h + uSimple(su, g);
  var t = app.utab || 'move';
  h += t === 'atk' ? uAtk(su, g) : t === 'trk' ? uTrk(su) : t === 'task' ? uTask(su, g) : t === 'hist' ? uHist(su) : uMove(su, g);
  return h;
}
function panelBuild() {
  var st = app.st, side = st.side, t = W.tier(st, side), h = '';
  h += '<div class="card"><h3><span>Production points</span><span class="mono">' + st.pts[side].toFixed(1) + '</span></h3><p>Tier ' + t + ' (' + W.tierPoints(st, side).toFixed(0) + ' pts). Tier 2 at 9, tier 3 at 22: one point per day of war and two per battle won. Units appear at the selected city or airfield, or automatically in the rear.</p></div>';
  var at = app.buyAt; h += '<div class="note">Deploy at: <b>' + (at ? esc(at.t === 'c' ? M.cities[at.i][0] : M.air[at.i][0]) : 'automatic') + '</b> ' + (at ? chip('buyat:none', 'AUTO') : '') + '</div>';
  var q = st.queue.filter(function (x) { return x.side === side; });
  if (q.length) h += '<div class="lbl">In production</div><div class="card">' + q.map(function (x, i) { return '<div class="urow">' + icoFor(x.type, side) + '<div class="g"><div class="n">' + esc(U[x.type].n) + '</div><div class="s">arrives in ' + Math.ceil(x.eta / 60) + 'h</div></div>' + (x.eta > U[x.type].eta * 60 - 20 ? chip('unbuy:' + st.queue.indexOf(x), 'undo') : '') + '</div>'; }).join('') + '</div>';
  h += '<div class="lbl">Available</div><div class="card">' + W.unitsFor(side, t).sort(function (a, b) { return U[a].tier - U[b].tier || U[a].cost - U[b].cost; }).map(function (k) {
    var d = U[k]; return '<div class="urow">' + icoFor(k, side) + '<div class="g"><div class="n">' + esc(d.n) + '</div><div class="s">cost ' + d.cost + ' · ' + d.eta + 'h' + (d.air ? ' · air' : d.heli ? ' · heli' : d.naval ? ' · naval' : '') + (d.nuke ? ' · nuclear-capable' : '') + '</div>' + (d.note ? '<div class="s">' + esc(d.note) + '</div>' : '') + '</div>' + '<button data-a="buy:' + k + '"' + (st.pts[side] >= d.cost ? '' : ' disabled') + '>+</button></div>';
  }).join('') + '</div>';
  if (t < 3) h += '<div class="note">Tier ' + (t + 1) + ' unlocks: ' + W.unitsFor(side, 3).filter(function (k) { return U[k].tier === t + 1; }).map(function (k) { return esc(U[k].n); }).join(', ') + '.</div>';
  return h;
}
function panelManage() {
  var st = app.st, h = '';
  if (st.deploy) h += '<div class="note good"><b>Deployment.</b> Tap a unit, then PLACE and tap a spot in your own territory (aircraft: BASE AT, tap an airfield). When you are ready press START WAR.</div><div class="chips">' + chip('start', 'START WAR') + '</div>';
  h += '<div class="lbl">Time</div><div class="chips">' + SPEEDS.map(function (s, i) { return chip('speed:' + i, i ? '▶ ' + SPEEDN[i] : '⏸ pause', '', app.speed === i); }).join('') + '</div>';
  h += '<div class="lbl">Auto-pause when</div><div class="chips">' + [['contact', 'new contact'], ['battle', 'battle starts'], ['lost', 'unit lost'], ['nuke', 'nuclear event'], ['idle', 'unit idle']].map(function (x) { return chip('ap:' + x[0], x[1], '', st.set.pause[x[0]]); }).join('') + '</div>';
  h += '<div class="lbl">Logistics</div><div class="chips">' + chip('auto', 'AUTO SUPPLY TRAINS ' + (st.set.auto !== false ? 'ON' : 'OFF'), '', st.set.auto !== false) + '</div>';
  h += '<div class="lbl">Map layers</div><div class="chips">' + [['roads', 'roads'], ['rails', 'railways'], ['air', 'airfields'], ['cities', 'cities'], ['cons', 'enemy contacts']].map(function (x) { return chip('layer:' + x[0], x[1], '', app.layers[x[0]]); }).join('') + '</div>';
  var v = W.vpShift(st), me = st.side;
  h += '<div class="card"><h3>War status</h3><div class="kv"><span>Day</span><span>' + W.dayOf(st) + ' / ' + W.MAX_DAYS + '</span><span>NATO will</span><span>' + Math.round(st.will.NATO) + '</span><span>Pact will</span><span>' + Math.round(st.will.PACT) + '</span><span>Ground gained, NATO</span><span>' + Math.round(v.NATO * 100) + '%</span><span>Ground gained, Pact</span><span>' + Math.round(v.PACT * 100) + '%</span><span>Units lost N/P</span><span>' + st.stats.lost.NATO + ' / ' + st.stats.lost.PACT + '</span></div><p>First to gain 28% of the other side\'s value wins; if will hits zero that side collapses.</p></div>';
  h += '<div class="chips">' + chip('save', 'SAVE') + chip('menu', 'MENU') + chip('cease', 'PROPOSE CEASEFIRE') + '</div>';
  return h;
}
function panelIntel() {
  var st = app.st, con = st.con[st.side], list = [], h = '', v = app.view;
  for (var id in con) list.push(con[id]);
  list.sort(function (a, b) { return W.dist(a.x, a.y, v.cx, v.cy) - W.dist(b.x, b.y, v.cx, v.cy); });
  var aw = st.units.filter(function (u) { return u.side === st.side && U[u.type].cls === 'awacs' && u.str > 0; }).length;
  h += '<div class="card"><h3>Sensors</h3><div class="kv"><span>Contacts held</span><span>' + list.length + '</span><span>AWACS aircraft</span><span>' + aw + '</span>' + (st.side === 'NATO' ? '<span>Tankers (extend range)</span><span>' + W.tankersOf(st, 'NATO') + '</span>' : '') + '</div><p>Units you can see up close are <span class="good">identified</span>. Farther out your radios and radars pick up <span class="warn">unknown contacts</span> (?) with an area, not a spot. Send recon, helicopters or a division to find out what they are.</p></div>';
  h += '<div class="lbl">Contacts nearest the view</div>';
  list.slice(0, 40).forEach(function (c) { h += '<div class="urow" data-a="selcon:' + c.id + '">' + (c.type ? icoFor(c.type, W.OTHER[st.side]) : '<div class="ico warn mono" style="text-align:center">?</div>') + '<div class="g"><div class="n">' + (c.type ? esc(U[c.type].n) : 'Unknown ' + (c.size || '') + ' contact') + '</div><div class="s">' + (c.lv === 'old' ? 'last known ' : '') + Math.round((st.t - c.t) / 60) + 'h ago' + (c.str != null ? ' · str ' + c.str + '%' : '') + '</div></div></div>'; });
  if (!list.length) h += '<div class="dim">Nothing in contact yet.</div>';
  return h;
}
function panelPol() {
  var st = app.st, side = st.side, P = st.pol[side], h = '', wp = side === 'NATO' ? st.pol.world : 100 - st.pol.world;
  h += '<div class="card"><div class="kv"><span>' + (side === 'NATO' ? 'Allied cohesion' : 'Satellite loyalty') + '</span><span>' + Math.round(P.coh) + '</span><span>Political capital</span><span>' + P.pc.toFixed(1) + ' / 10</span><span>World opinion (for you)</span><span>' + Math.round(wp) + '</span>' + (st.pol.med > 0 ? '<span>Swiss mediation</span><span>' + Math.ceil(st.pol.med / 60) + 'h left</span>' : '') + '</div></div>';
  if (P.coh < 35) h += '<div class="note bad">' + (side === 'NATO' ? 'Allies are wavering: nuclear release is blocked until cohesion recovers.' : 'Satellite armies are unreliable.') + '</div>';
  W.polOptions(st, side).forEach(function (o) { h += '<div class="card' + (o.ok ? '' : ' off') + '" ' + (o.ok ? 'data-a="pol:' + o.id + '"' : '') + '><h3><span>' + esc(o.name) + '</span><span class="mono dim">' + o.cost + ' pc</span></h3><p>' + esc(o.desc) + '</p>' + (o.why ? '<div class="why">' + esc(o.why) + '</div>' : '') + '</div>'; });
  return h;
}
function panelEsc() {
  var st = app.st, side = st.side, h = '<div class="ladder">';
  W.ESC_NAMES.forEach(function (n, i) { h += '<div class="' + (i <= st.esc ? 'on ' : '') + (i === 5 ? 'ruin' : '') + '"><b>' + i + '</b>' + esc(n) + '</div>'; });
  h += '</div><div class="note ' + (st.esc >= 3 ? 'bad' : '') + '">Every strike hurts your home front and alliance, and the other side may answer. Level 5 ends the war in mutual ruin.</div>';
  h += '<div class="card" data-a="buynuke"><h3><span>☢ Warheads in stock: ' + W.nukeStock(st, side) + '</span><span class="mono">BUY 1 · 6 PTS</span></h3><p>Every strike uses one warhead. F-35s, F-16s, Rafales, F-15Es and bombers, plus missile brigades, can all carry them.</p></div>';
  W.nukeOptions(st, side).forEach(function (o) { h += '<div class="card' + (o.ok ? '' : ' off') + '" ' + (o.ok ? 'data-a="nuke:' + o.id + '"' : '') + '><h3><span>' + esc(o.name) + '</span><span class="mono nuke">L' + o.lvl + '</span></h3><p>' + esc(o.desc) + '</p>' + (o.why ? '<div class="why">' + esc(o.why) + '</div>' : '') + '</div>'; });
  return h;
}
var MODES = { fire: ['Direct fire', '% per hour'], barrage: ['Barrage', '% per hour'], missile: ['Missile strike', '% per missile'], loiter: ['Circle & attack', '% per hour'], salvo: ['Missile salvo', '% per salvo'] };
function statUnits(side) { var E = W.getEra(); return Object.keys(U).filter(function (k) { return U[k].side === side && (U[k].era === E || U[k].era === 'b'); }).sort(function (a, b) { return (clsName(U[a]) + U[a].n).localeCompare(clsName(U[b]) + U[b].n); }); }
function clsName(d) { return d.naval ? (d.sub ? 'Submarine' : 'Ship') : d.air ? 'Aircraft' : d.heli ? 'Helicopter' : ({ gnd: 'Combat', arty: 'Artillery', ssm: 'Missiles', aa: 'Air defence', recon: 'Recon', eng: 'Engineers', train: 'Supply train', convoy: 'Supply convoy' }[d.cls] || d.cls); }
function mulOf(k) { var m = app.st.dmgMul && app.st.dmgMul[k]; return m == null ? 1 : m; }
function panelStats() {
  var side = app.statSide || app.st.side, foe = W.OTHER[side], h = '<div class="hint">Expected damage to the target as % of its strength. Full-strength attacker, full supply, open ground, target not dug in. Damage drops if the target digs in or sits in a city.</div><div class="chips">' + chip('statside:' + app.st.side, 'YOUR UNITS', '', side === app.st.side) + chip('statside:' + W.OTHER[app.st.side], 'ENEMY UNITS', '', side !== app.st.side) + '</div><div class="lbl">Damage tuning (' + (side === app.st.side ? 'your' : 'enemy') + ' side)</div><div class="chips">' + chip('statall:-25', 'ALL −25%') + chip('statall:25', 'ALL +25%') + chip('statall:art:25', 'ARTILLERY +25%') + chip('statall:art:-25', 'ARTILLERY −25%') + chip('statreset', '↺ RESET ALL') + '</div>';
  var open = app.statOpen, lastC = '';
  statUnits(side).forEach(function (k) {
    var d = U[k], isOpen = open === k, cn = clsName(d);
    if (cn !== lastC) { lastC = cn; h += '<div class="lbl">' + esc(cn) + '</div>'; }
    h += '<div class="srow' + (isOpen ? ' on' : '') + '" data-a="statopen:' + k + '"><div class="n">' + esc(d.n) + (mulOf(k) !== 1 ? ' <span class="mul">×' + Math.round(mulOf(k) * 100) + '%</span>' : '') + '</div><div class="s">' + (d.a != null ? 'ATK ' + d.a + ' · ' : '') + (d.d != null && !d.air ? 'DEF ' + d.d + ' · ' : '') + (d.a2a != null ? 'A2A ' + d.a2a + ' · A2G ' + d.a2g + ' · ' : '') + (d.sight ? 'SIGHT ' + d.sight + ' km · ' : '') + (d.rng ? 'RNG ' + d.rng + ' km · ' : '') + 'COST ' + d.cost + '</div></div>';
    if (!isOpen) return;
    h += '<div class="sdet tune"><b>Damage dealt</b> <span>' + Math.round(mulOf(k) * 100) + '% of normal</span><div class="chips">' + chip('statmul:' + k + ':-50', '−50') + chip('statmul:' + k + ':-10', '−10') + chip('statmul:' + k + ':10', '+10') + chip('statmul:' + k + ':50', '+50') + chip('statmul:' + k + ':x2', '×2') + chip('statmul:' + k + ':reset', '↺') + '</div></div>';
    var foes = Object.keys(U).filter(function (t) { return U[t].side === foe && (U[t].era === W.getEra() || U[t].era === 'b'); }), any = false;
    ['fire', 'barrage', 'missile', 'loiter', 'salvo'].forEach(function (m) {
      var rows = foes.map(function (t) { var r = W.dmgInfo(k, t, mulOf(k)); return r[m] != null ? [t, r[m]] : null; }).filter(Boolean).sort(function (a, b) { return b[1] - a[1]; });
      if (!rows.length) return; any = true; var mx = rows[0][1];
      h += '<div class="sdet"><b>' + MODES[m][0] + '</b> <span>' + MODES[m][1] + '</span>' + rows.map(function (r) { return '<div class="dr"><span class="t">' + esc(U[r[0]].n) + '</span><i style="width:' + Math.max(3, r[1] / mx * 100) + '%"></i><span class="v">' + r[1].toFixed(1) + '</span></div>'; }).join('') + '</div>';
    });
    if (!any) h += '<div class="sdet"><span>This unit does not deal damage by itself.</span></div>';
    var dealers = foes.map(function (t) { var r = W.dmgInfo(t, k, mulOf(t)), v = Math.max(r.fire || 0, r.barrage || 0, r.missile || 0, r.loiter || 0, r.salvo || 0); return v > 0 ? [t, v] : null; }).filter(Boolean).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    if (dealers.length) h += '<div class="sdet"><b>Hurt most by</b> <span>best mode, % per hour or per shot</span>' + dealers.map(function (r) { return '<div class="dr"><span class="t">' + esc(U[r[0]].n) + '</span><i class="x" style="width:' + Math.max(3, r[1] / dealers[0][1] * 100) + '%"></i><span class="v">' + r[1].toFixed(1) + '</span></div>'; }).join('') + '</div>';
  });
  return h;
}
function panelLog() { return '<div class="lg">' + app.st.log.slice(-60).reverse().map(function (l) { return '<div class="' + l.c + '"><span>' + W.dateStr(l.t).slice(0, 6) + W.dateStr(l.t).slice(-5) + '</span>' + esc(l.m) + '</div>'; }).join('') + '</div>'; }
var TABS = [['units', 'Units'], ['move', 'Movement'], ['build', 'Build'], ['manage', 'Manage'], ['intel', 'Intel'], ['pol', 'Politics'], ['esc', 'Escalate'], ['stats', 'Stats'], ['log', 'Log']];
var PANELS = { move: panelMove, units: panelUnits, build: panelBuild, manage: panelManage, intel: panelIntel, pol: panelPol, esc: panelEsc, stats: panelStats, log: panelLog };

/* ---------- screens ---------- */
function $(id) { return document.getElementById(id); }
function fmtTime(ts) { var d = new Date(ts); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
function renderSlots() {
  var h = '<div class="hero"><h1>Unthinkable <b>\'75</b></h1><p>NATO against the Warsaw Pact on the real map of Europe. Real time. Three campaigns.</p></div><div class="page scroll">';
  [1, 2, 3].forEach(function (n) {
    var d = readSlot(n), m = d && d.meta;
    h += '<div class="slot"><div class="row"><span class="name">SLOT ' + n + '</span>' + (m && m.ended ? '<span class="badge ' + m.ended.outcome + '">' + m.ended.outcome + '</span>' : '<span class="badge">' + (m ? 'in progress' : 'empty') + '</span>') + '</div>';
    if (m) h += '<div class="meta">' + (m.side === 'NATO' ? 'NATO' : 'Warsaw Pact') + ' · ' + m.diff + ' · day ' + m.day + (m.deploy ? ' · deployment' : '') + ' · escalation ' + m.esc + (m.ended ? '<br><b>' + esc(m.ended.title) + '</b>' : '') + '<br>saved ' + fmtTime(d.saved) + '</div><div class="btns"><button class="pri" data-a="cont:' + n + '">' + (m.ended ? 'View result' : 'Continue') + '</button><button class="dng" data-a="reset:' + n + '">Reset</button></div>';
    else h += '<div class="btns"><button class="pri" data-a="new:' + n + '">New campaign</button></div>';
    h += '</div>';
  });
  return h + '<div class="slot closecard"><button data-a="close" style="width:100%">Close</button></div></div>';
}
function renderSetup() {
  var s = app.setup, h = '<div class="hero"><h1>New <b>campaign</b></h1><p>Slot ' + app.slot + '</p></div><div class="page scroll"><div class="lbl">Era</div><div class="seg"><button class="' + (s.era !== 'm' ? 'sel' : '') + '" data-a="setera:75">1975 Cold War</button><button class="' + (s.era === 'm' ? 'sel' : '') + '" data-a="setera:m">2027 Modern</button></div>' + (s.era === 'm' ? '<div class="note">Modern: NATO vs Russia and Belarus on the Baltic / Poland front. Typhoons, F-35s, Leopard 2, HIMARS, Patriot, drones and Iskanders. You command NATO.</div>' : '') + '<div class="lbl">Side</div>';
  if (s.era === 'm') h += '<button class="opt sel" data-a="setside:NATO"><b>NATO: hold the Baltic front</b>Defend Poland and the Baltic states, then push east into Belarus and Kaliningrad.</button>'; else {
  h += '<button class="opt ' + (s.side === 'NATO' ? 'sel' : '') + '" data-a="setside:NATO"><b>NATO: strike east</b>Better kit and initiative, outnumbered. Break through from the Fulda Gap before your home front gives out.</button>';
  h += '<button class="opt ' + (s.side === 'PACT' ? 'sel' : '') + '" data-a="setside:PACT"><b>Warsaw Pact: crush the West</b>Mass and depth. Absorb the first blow, then counter-attack and overrun the Rhine.</button>';
  }
  h += '<div class="lbl">AI difficulty</div><div class="seg">' + ['easy', 'normal', 'hard'].map(function (d) { return '<button class="' + (s.diff === d ? 'sel' : '') + '" data-a="setdiff:' + d + '">' + d + '</button>'; }).join('') + '</div>';
  h += '<div class="note">Every campaign starts with a paused deployment phase: move your units and base your aircraft, then press START WAR.</div>';
  return h + '<div style="display:flex;gap:8px"><button data-a="home" style="flex:1">Back</button><button class="pri" data-a="start" style="flex:2">Start campaign</button></div></div>';
}
function renderEnd() {
  var st = app.st, e = st.ended, o = W.outcomeFor(st), v = W.vpShift(st);
  return '<div class="hero"><span class="badge ' + o + '">' + (o === 'win' ? 'Victory' : o === 'loss' ? 'Defeat' : 'No winner') + '</span><h1 style="margin-top:10px">' + esc(e.title) + '</h1><p>' + esc(e.text) + '</p></div><div class="page scroll"><div class="card"><div class="kv"><span>Days fought</span><span>' + e.day + '</span><span>NATO ground gained</span><span>' + Math.round(v.NATO * 100) + '%</span><span>Pact ground gained</span><span>' + Math.round(v.PACT * 100) + '%</span><span>NATO units lost</span><span>' + st.stats.lost.NATO + '</span><span>Pact units lost</span><span>' + st.stats.lost.PACT + '</span><span>Nuclear strikes</span><span>' + st.stats.nukes + '</span><span>Highest escalation</span><span>' + W.ESC_NAMES[st.stats.maxEsc] + '</span></div></div><button class="pri" data-a="home" style="width:100%">Back to slots</button></div>';
}
function gameSkeleton() {
  return '<div class="top"><button data-a="menu" aria-label="Menu">☰</button><div class="clock"><b id="clk"></b><span id="sub"></span></div><div id="spd" style="display:flex;gap:4px"></div><button data-a="mini" aria-label="Shrink">▾</button></div>' +
    '<div class="stage" id="stage"><canvas></canvas><div class="hud" id="hud"></div><div class="toast" id="toast" style="display:none"></div><div id="banner"></div><div class="zoomc"><button data-a="zin">+</button><button data-a="zout">−</button><button data-a="home-view">⌖</button></div></div>' +
    '<div class="dock h' + app.dock + '" id="dock"><div class="tabs" id="tabs"></div><div class="body" id="body"></div></div>';
}
function render() {
  var root = $('app'), h;
  if (app.screen === 'slots') h = renderSlots(); else if (app.screen === 'setup') h = renderSetup(); else if (app.screen === 'end') h = renderEnd(); else h = gameSkeleton();
  root.innerHTML = h; cv = null; ctx = null;
  if (app.screen === 'game') { setupCanvas($('stage')); bindCanvas(); paintTop(); paintHud(); paintBanner(); renderDock(true); bgDirty = true; }
  renderModal(); renderMini();
}
function renderMini() { var el = $('mini'), st = app.st; el.innerHTML = st ? '<b>D' + W.dayOf(st) + '</b><span>' + st.side + ' · ESC ' + st.esc + '</span><span>' + W.dateStr(st.t).slice(-5) + '</span>' : '<b>U\'75</b><span>tap to open</span>'; }
function paintTop() {
  var st = app.st; if (!st || app.screen !== 'game') return; var c = $('clk'); if (!c) return;
  c.textContent = W.dateStr(st.t).slice(0, 6) + ' ' + W.dateStr(st.t).slice(-5); $('sub').textContent = st.side + ' · day ' + W.dayOf(st) + '/' + W.MAX_DAYS + (st.deploy ? ' · deploy' : '');
  $('spd').innerHTML = st.deploy ? '<button class="pri" data-a="start">START WAR</button>' : TOPSPD.map(function (t) { return '<button data-a="speed:' + t[0] + '" class="' + (app.speed === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
}
function paintHud() {
  var st = app.st, h = $('hud'); if (!h || !st) return; var side = st.side, P = st.pol[side], v = W.vpShift(st);
  h.innerHTML = '<div class="m">PTS <b>' + Math.floor(st.pts[side]) + '</b></div><div class="m">WILL <b>' + Math.round(st.will[side]) + '</b></div><div class="m">COH <b>' + Math.round(P.coh) + '</b></div><div class="m">ESC <b class="' + (st.esc >= 3 ? 'bad' : '') + '">' + st.esc + '</b></div><div class="m">GAIN <b>' + Math.round(v[side] * 100) + '%</b></div>';
}
var lastDock = '', lastTabs = '';
function renderDock(force) {
  var st = app.st; if (!st || app.screen !== 'game') return; var tb = $('tabs'), bd = $('body'), dk = $('dock'); if (!tb) return;
  dk.className = 'dock h' + app.dock;
  var um = unitMode();
  var tabs = um && app.simple !== false ? '<button class="on" data-a="utab:move">Orders</button><button data-a="simple:0">All options</button><button class="x" data-a="selnone">✕</button><button class="sz" data-a="dock">' + (app.dock === 2 ? '▾' : '▴') + '</button>' : um ? '<button data-a="simple:1">◂ Simple</button>' + UTABS.map(function (t) { return '<button data-a="utab:' + t[0] + '" class="' + ((app.utab || 'move') === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '<button class="x" data-a="selnone">✕</button><button class="sz" data-a="dock">' + (app.dock === 2 ? '▾' : '▴') + '</button>' : TABS.map(function (t) { var flag = (t[0] === 'esc' && st.esc >= 3) || (t[0] === 'pol' && st.pol[st.side].coh < 35); return '<button data-a="tab:' + t[0] + '" class="' + (app.tab === t[0] ? 'on' : '') + '">' + t[1] + (flag ? ' <i>!</i>' : '') + '</button>'; }).join('') + '<button class="sz" data-a="dock">' + (app.dock === 2 ? '▾' : '▴') + '</button>';
  if (tabs !== lastTabs) { tb.innerHTML = tabs; lastTabs = tabs; }
  if (app.dock === 0) return;
  var html = um ? panelUnit() : PANELS[app.tab](); if (!force && html === lastDock) return;
  var keep = bd.scrollTop; bd.innerHTML = html; lastDock = html; bd.scrollTop = keep;
  sizeCanvas();
}
function paintBanner() {
  var b = $('banner'), st = app.st; if (!b || !st) return;
  if (app.pick) b.innerHTML = '<div class="banner"><span>' + esc(PICKTXT[app.pick.kind] || '') + (app.addStop ? ' <b>(adding stops)</b>' : '') + '</span>' + (app.addStop ? '<button data-a="done">Done</button>' : '') + '<button data-a="cancel">Cancel</button></div>';
  else if (st.deploy) b.innerHTML = '<div class="banner" style="border-color:var(--good)"><span>Deployment: select a unit, PLACE it, then START WAR.</span><button class="pri" data-a="start">START</button></div>';
  else b.innerHTML = '';
}
function paintToast() { var t = $('toast'); if (!t) return; if (app.toast && Date.now() < app.toastT) { t.style.display = 'block'; t.textContent = app.toast; } else t.style.display = 'none'; }
function renderModal() {
  var root = $('modalRoot'); if (!root) { root = document.createElement('div'); root.id = 'modalRoot'; document.body.appendChild(root); }
  var m = app.modal, st = app.st; if (!m) { root.innerHTML = ''; return; }
  if (m.type === 'reset') root.innerHTML = '<div class="modal"><div class="sheet"><h2>RESET SLOT ' + m.n + '?</h2><p>This deletes the saved campaign in this slot.</p><div class="btns"><button data-a="cancelm">Keep it</button><button class="dng" data-a="doreset">Reset</button></div></div></div>';
  else if (m.type === 'nuke') {
    var op = W.nukeOptions(st, st.side).filter(function (o) { return o.id === m.id; })[0], near = '';
    var best = ''; M.cities.forEach(function (c) { }); var cn = nearestCity(m.x, m.y);
    root.innerHTML = '<div class="modal"><div class="sheet"><h2 class="nuke">' + esc(op.name) + '</h2><p>Target: near <b>' + esc(cn) + '</b>, blast radius about ' + m.R + ' km.</p>' + (m.del ? '<p class="good">Launcher: ' + esc(U[m.del.u.type].n) + ' (' + Math.round(m.del.d) + ' km).</p>' : '<p class="bad">No nuclear-capable unit in range of that spot.</p>') + '<p class="warn">The other side will almost certainly answer. Friendly units inside the radius are destroyed too.</p><div class="btns"><button data-a="cancelm">Stand down</button><button class="dng" data-a="donuke"' + (m.del ? '' : ' disabled') + '>Launch</button></div></div></div>';
  }
  else if (m.type === 'text') root.innerHTML = '<div class="modal"><div class="sheet"><h2>' + esc(m.title) + '</h2><p>' + m.text + '</p><div class="btns"><button class="pri" data-a="cancelm">OK</button></div></div></div>';
}
function nearestCity(x, y) { var b = '', bd = 1e9; M.cities.forEach(function (c) { var d = W.dist(x, y, c[1], c[2]); if (d < bd) { bd = d; b = c[0]; } }); return b; }

/* ---------- actions ---------- */
function openSlot(n) { var d = readSlot(n); if (!d || !d.state || d.v !== 2) return false; app.slot = n; app.st = d.state; app.sel = []; app.selNode = null; app.selCon = null; app.pick = null; app.speed = 0; app.tab = app.st.deploy ? 'manage' : 'units'; app.screen = app.st.ended ? 'end' : 'game'; var f = d.state.era === 'm' ? W.ll(23.0, 53.5) : W.ll(9.7, 50.5); app.view = { cx: f.x, cy: f.y, z: 0.55 }; return true; }
function selectGroup(f) { var st = app.st; app.sel = ownUnits().filter(f).map(function (u) { return u.id; }); app.selNode = null; app.selCon = null; app.tab = 'units'; }
document.addEventListener('click', function (ev) {
  var t = ev.target.closest('[data-a]'); if (!t) return; var parts = t.getAttribute('data-a').split(':'), a = parts[0], arg = parts.slice(1).join(':'), st = app.st;
  if (t.tagName !== 'BUTTON' && t.closest('.stage') && a !== 'zin') return;
  switch (a) {
    case 'close': if (window.NovaHost && window.NovaHost.close) window.NovaHost.close(); else if (window.U75.onClose) window.U75.onClose(); return;
    case 'home': saveSlot(); app.screen = 'slots'; app.st = null; break;
    case 'menu': saveSlot(); app.speed = 0; app.screen = 'slots'; app.st = null; break;
    case 'new': app.slot = +arg; app.screen = 'setup'; break;
    case 'setera': app.setup.era = arg; if (arg === 'm') app.setup.side = 'NATO'; break; case 'setside': app.setup.side = arg; break; case 'setdiff': app.setup.diff = arg; break;
    case 'start': if (app.screen === 'setup') { app.st = W.newGame({ side: app.setup.side, diff: app.setup.diff, era: app.setup.era }); app.sel = []; app.speed = 0; app.tab = 'manage'; app.screen = 'game'; var f = app.st.era === 'm' ? W.ll(23.0, 53.5) : W.ll(9.7, 50.5); app.view = { cx: f.x, cy: f.y, z: 0.55 }; saveSlot(); }
      else if (st) { W.startWar(st); app.speed = 3; app.tab = 'units'; saveSlot(); toast('The war begins.'); } break;
    case 'cont': if (openSlot(+arg)) break; return;
    case 'reset': app.modal = { type: 'reset', n: +arg }; break;
    case 'doreset': Store.del(slotKey(app.modal.n)); app.modal = null; break;
    case 'cancelm': app.modal = null; if (app.pick && app.pick.kind === 'nuke') app.pick.at = null; break;
    case 'tab': app.tab = arg; if (!app.dock) app.dock = 1; renderDock(true); paintTop(); return;
    case 'dock': app.dock = (app.dock + 1) % 3; renderDock(true); setTimeout(sizeCanvas, 30); return;
    case 'speed': if (st && !st.deploy) { app.speed = +arg; paintTop(); renderDock(true); } return;
    case 'ap': st.set.pause[arg] = !st.set.pause[arg]; renderDock(true); return;
    case 'layer': app.layers[arg] = !app.layers[arg]; bgDirty = true; renderDock(true); return;
    case 'stance': { var nS = W.setStance(st, app.sel, arg); toast(nS + (nS === 1 ? ' unit' : ' units') + ' set to ' + ({ aggr: 'aggressive', pass: 'passive', neut: 'neutral' }[arg])); renderDock(true); return; }
    case 'utab': app.utab = arg; renderDock(true); return;
    case 'simple': app.simple = arg === '1'; renderDock(true); return;
    case 'statside': app.statSide = arg; app.statOpen = null; renderDock(true); return;
    case 'statmul': { var sp = arg.split(':'), tk = sp[0], mv = sp[1], cur = mulOf(tk) * 100; var nv = mv === 'reset' ? 100 : mv === 'x2' ? cur * 2 : cur + (+mv); W.setDmgMul(st, [tk], Math.max(0, Math.min(1000, nv)) / 100); renderDock(true); return; }
    case 'statall': { var sa = arg.split(':'), onlyArt = sa[0] === 'art', dl = +(onlyArt ? sa[1] : sa[0]); var side2 = app.statSide || st.side; var ids = statUnits(side2).filter(function (k) { return !onlyArt || U[k].cls === 'arty'; }); ids.forEach(function (k) { W.setDmgMul(st, [k], Math.max(0, Math.min(10, mulOf(k) + dl / 100))); }); renderDock(true); return; }
    case 'statreset': { var all = Object.keys(st.dmgMul || {}); W.setDmgMul(st, all, 1); toast('Damage reset to normal'); renderDock(true); return; }
    case 'buynuke': { var bn = W.buyWarhead(st, st.side); toast(bn.ok ? 'Warhead bought' : bn.msg); renderDock(true); return; }
    case 'statopen': app.statOpen = app.statOpen === arg ? null : arg; renderDock(true); return;
    case 'cfire': issue({ k: 'hold' }); renderDock(true); return;
    case 'firem': app.fireM = !app.fireM ? 30 : app.fireM === 30 ? 120 : 0; renderDock(true); return;
    case 'trail': app.showTrail = app.showTrail === false; renderDock(true); return;
    case 'clrtrk': app.sel.forEach(function (id) { var uu = W.unitById(st, id); if (uu) { uu.trk = []; uu.dist = 0; } }); renderDock(true); return;
    case 'rmord': { var pp = arg.split(':'), ru = W.unitById(st, +pp[0]); if (ru) { ru.orders.splice(+pp[1], 1); ru.path = null; } renderDock(true); return; }
    case 'unsel': app.sel = app.sel.filter(function (i) { return i !== +arg; }); renderDock(true); return;
    case 'tgt': { var tp = arg.split(':'), tc = st.con[st.side][+tp[0]]; if (!tc) return; if (tp[1] === 'fire') issue({ k: 'fire', x: tc.x, y: tc.y, mins: app.fireM || 0 }); else if (tp[1] === 'cas') issue({ k: 'cas', cid: +tp[0], x: tc.x, y: tc.y }); else issue({ k: 'hunt', cid: +tp[0] }); return; }
    case 'caph': app.capH = app.capH === 3 ? 6 : app.capH === 6 ? 12 : 3; renderDock(true); return;
    case 'pick': if (!app.sel.length) { toast('Select a unit first.'); return; } startPick(arg); return;
    case 'do': if (!app.sel.length) return; issue({ k: arg }); return;
    case 'stop': app.addStop = !app.addStop; if (app.addStop && !app.pick) toast('Pick a command: each target is added as a further stop.'); renderDock(true); paintBanner(); return;
    case 'clear': app.sel.forEach(function (id) { var u = W.unitById(st, id); if (u) { u.orders = []; u.path = null; } }); renderDock(true); return;
    case 'done': endPick(); return; case 'cancel': endPick(); return;
    case 'multi': app.multi = !app.multi; renderDock(true); return;
    case 'selu': selectUnit(+arg, false); return;
    case 'selsame': { var t0 = W.unitById(st, app.sel[0]); if (t0) selectGroup(function (u) { return u.type === t0.type; }); } break;
    case 'selall': selectGroup(function (u) { var d = U[u.type]; return arg === 'air' ? d.air : arg === 'heli' ? d.heli : arg === 'naval' ? d.naval : d.ground && !d.heli; }); break;
    case 'selmoving': app.sel = ownUnits().filter(function (u) { return u.orders.length && ['dig', 'hold'].indexOf(u.orders[0].k) < 0 && !(U[u.type].air && u.state === 'base'); }).map(function (u) { return u.id; }); break;
    case 'selidle': app.sel = ownUnits().filter(function (u) { return !u.orders.length && !U[u.type].air; }).map(function (u) { return u.id; }); app.tab = 'units'; break;
    case 'stopall': ownUnits().forEach(function (u) { if (u.orders.length && !U[u.type].air && ['dig', 'hold'].indexOf(u.orders[0].k) < 0) { u.orders = []; u.path = null; } }); toast('All movement orders cancelled.'); break;
    case 'clr1': { var cu = W.unitById(st, +arg); if (cu) { cu.orders = []; cu.path = null; } } break;
    case 'auto': st.set.auto = st.set.auto === false; toast('Auto supply ' + (st.set.auto ? 'on: trains and convoys run themselves.' : 'off.')); break;
    case 'selnone': app.sel = []; break;
    case 'selwings': selectGroup(function (u) { return U[u.type].air && u.state === 'base' && u.base === +arg; }); break;
    case 'selcon': app.selCon = +arg; app.selNode = null; var c = st.con[st.side][arg]; if (c) centerOn(c.x, c.y); app.tab = 'units'; break;
    case 'huntsel': issue({ k: 'hunt', cid: app.selCon }); return;
    case 'strikecon': { var cc = st.con[st.side][app.selCon]; if (cc) issue({ k: 'cas', cid: app.selCon, x: cc.x, y: cc.y }); } return;
    case 'buyat': app.buyAt = arg === 'none' ? null : { t: arg[0], i: +arg.slice(1) }; app.tab = 'build'; break;
    case 'buy': { var spot = app.buyAt ? (app.buyAt.t === 'c' ? { city: app.buyAt.i, x: M.cities[app.buyAt.i][1], y: M.cities[app.buyAt.i][2] } : { af: app.buyAt.i, x: M.air[app.buyAt.i][2], y: M.air[app.buyAt.i][3] }) : null; if (spot && U[arg].air && spot.city != null) spot = null; if (spot && !U[arg].air && spot.af != null) spot = null; var r = W.buy(st, st.side, arg, spot); if (!r.ok) toast(r.msg); else toast(U[arg].n + ' ordered.'); } break;
    case 'unbuy': W.cancelBuy(st, st.side, +arg); break;
    case 'pol': W.polAct(st, st.side, arg); break;
    case 'nuke': { var op = W.nukeOptions(st, st.side).filter(function (o) { return o.id === arg; })[0]; if (!op) return; if (op.target) { startPick('nuke', { id: arg, R: op.radius }); toast('Pick the target on the map.'); return; } var rr = W.nukeAct(st, st.side, arg); if (!rr.ok) toast(rr.msg); } break;
    case 'donuke': { var m = app.modal, r2 = W.nukeAct(st, st.side, m.id, m.x, m.y); app.modal = null; endPick(); toast(r2.ok ? 'Launched.' : r2.msg); } break;
    case 'cease': { var ok = W.propose(st, st.side); toast(ok ? 'Ceasefire!' : 'No answer: they refuse for now.'); } break;
    case 'save': saveSlot(); toast('Saved.'); return;
    case 'zin': app.view.z *= 1.5; clampView(); bgDirty = true; return;
    case 'zout': app.view.z /= 1.5; clampView(); bgDirty = true; return;
    case 'home-view': { var f2 = app.st.era === 'm' ? W.ll(23.0, 53.5) : W.ll(9.7, 50.5); centerOn(f2.x, f2.y, 0.55); } return;
    case 'mini': window.U75.setMini(true); return;
  }
  render();
});

/* ---------- touch / mouse on the map ---------- */
var ptrs = {}, drag = null;
function bindCanvas() {
  if (!cv) return;
  cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, t: Date.now() }; drag = { moved: false, cx: app.view.cx, cy: app.view.cy, n: Object.keys(ptrs).length, d0: pinchDist(), z0: app.view.z }; });
  cv.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId]; if (!p) return; p.x = e.offsetX; p.y = e.offsetY; var ks = Object.keys(ptrs);
    if (ks.length >= 2 && drag.d0 > 0) { var dd = pinchDist(); app.view.z = drag.z0 * dd / drag.d0; clampView(); drag.moved = true; bgDirty = true; return; }
    if (ks.length === 1) { var dx = p.x - p.sx, dy = p.y - p.sy; if (Math.abs(dx) + Math.abs(dy) > 16) drag.moved = true; if (drag.moved) { app.view.cx = drag.cx - dx / app.view.z; app.view.cy = drag.cy - dy / app.view.z; clampView(); } }
  });
  function up(e) { var p = ptrs[e.pointerId]; delete ptrs[e.pointerId]; if (p && drag && !drag.moved && drag.n === 1) { var held = Date.now() - p.t; if (held < 450 || held >= 1800) onTap(p.x, p.y); else if (app.sel.length && !app.pick && !app.st.deploy && app.sel.some(function (id) { var uu = W.unitById(app.st, id); return uu && !U[uu.type].air; })) { app.pick = { kind: 'move' }; onTap(p.x, p.y); } else onTap(p.x, p.y); } if (!Object.keys(ptrs).length) drag = null; else { drag = { moved: true, cx: app.view.cx, cy: app.view.cy, n: 2, d0: 0, z0: app.view.z }; var q = ptrs[Object.keys(ptrs)[0]]; q.sx = q.x; q.sy = q.y; } }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', function (e) { delete ptrs[e.pointerId]; drag = null; });
  cv.addEventListener('wheel', function (e) { e.preventDefault(); var wp = s2w(e.offsetX, e.offsetY); app.view.z *= e.deltaY < 0 ? 1.2 : 1 / 1.2; clampView(); var wp2 = s2w(e.offsetX, e.offsetY); app.view.cx += wp.x - wp2.x; app.view.cy += wp.y - wp2.y; bgDirty = true; }, { passive: false });
}
function pinchDist() { var k = Object.keys(ptrs); if (k.length < 2) return 0; var a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }

/* ---------- the clock ---------- */
var lastTs = 0, acc = 0, lastSave = Date.now(), lastPanel = 0, lastTop = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  var st = app.st; if (app.screen !== 'game' || !st || app.mini || document.hidden) { lastTs = ts; return; }
  var dt = Math.min(0.12, (ts - lastTs) / 1000 || 0); lastTs = ts;
  if (!st.deploy && app.speed > 0 && !st.ended && !app.modal) {
    acc += SPEEDS[app.speed] * dt; var run = Math.floor(Math.min(acc, 90)); acc -= run; if (acc > 400) acc = 400;
    if (run >= 1) {
      var hit = W.advance(st, run), last = null;
      st.events.forEach(function (e) { if (['city', 'nuke', 'info', 'pol', 'end'].indexOf(e.k) >= 0) last = e; });
      if (hit) { app.speed = 0; last = hit; if (hit.x && hit.k !== 'end') { var c = w2s(hit.x, hit.y); if (c[0] < 20 || c[0] > cw - 20 || c[1] < 20 || c[1] > ch - 20) centerOn(hit.x, hit.y); } paintTop(); }
      if (last) toast(last.m);
      st.events.length = 0;
      if (st.ended) { saveSlot(); app.screen = 'end'; render(); return; }
    }
  } else acc = 0;
  if (Date.now() - lastSave > 25000) { lastSave = Date.now(); saveSlot(); }
  if (Date.now() - lastTop > 350) { lastTop = Date.now(); paintTop(); paintHud(); }
  if (Date.now() - lastPanel > 800) { lastPanel = Date.now(); renderDock(false); renderMini(); }
  if (app.toast && Date.now() > app.toastT) { app.toast = ''; paintToast(); }
  draw();
}
window.addEventListener('resize', function () { sizeCanvas(); });
document.addEventListener('visibilitychange', function () { if (document.hidden) saveSlot(); });
window.addEventListener('pagehide', saveSlot);

/* ---------- host API ---------- */
window.U75 = { version: '2.0', onClose: null,
  mini: function () { var st = app.st; return st ? { side: st.side, day: W.dayOf(st), esc: st.esc, ended: !!st.ended } : null; },
  setMini: function (b) { app.mini = !!b; document.body.classList.toggle('mini', !!b); if (b) { app.speed = 0; saveSlot(); } renderMini(); },
  expand: function () { if (window.NovaHost && window.NovaHost.expand) window.NovaHost.expand(); window.U75.setMini(false); },
  open: function (n) { if (openSlot(n)) render(); },
  _app: function () { return app; }, _w2s: function (x, y) { return w2s(x, y); } };

/* ---------- boot ---------- */
(function boot() {
  initGeo();
  var q = {}; (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
  if (q.widget === '1') document.body.classList.add('widget'); if (q.full === '1') document.body.classList.add('full');
  if (q.slot) openSlot(+q.slot);
  if (q.mini === '1') window.U75.setMini(true);
  render(); requestAnimationFrame(frame);
})();
})();
