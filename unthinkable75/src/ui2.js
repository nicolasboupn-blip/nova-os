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
var app = { screen: 'slots', slot: null, st: null, tab: 'units', sel: [], selNode: null, selCon: null, multi: false, addStop: false, pick: null, setup: { side: 'NATO', diff: 'normal' },
  dock: 1, modal: null, toast: '', toastT: 0, layers: { roads: true, rails: true, air: true, cities: true, cons: true }, view: { cx: 0, cy: 0, z: 0.6 }, capH: 3, mini: false, speed: 0 };
var SPEEDS = [0, 15, 60, 240, 720];   // game minutes per real second
var SPEEDN = ['pause', '15m/s', '1h/s', '4h/s', '12h/s'];
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function toast(t) { app.toast = t; app.toastT = Date.now() + 3200; paintToast(); }

/* ---------- static map data prepared once ---------- */
var geo = null;
function decode(a) { var x = a[0], y = a[1], out = [x, y]; for (var i = 2; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out.push(x, y); } return out; }
function prep(list, pick) {
  return list.map(function (it) { var a = pick ? it[1] : it, p = decode(a), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (var i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; } return { p: p, b: [x0, y0, x1, y1], t: pick ? it[0] : 0 }; });
}
function initGeo() {
  geo = { land: prep(M.land), borders: prep(M.borders), iron: prep(M.iron), roads: prep(M.roadsD, true), rails: prep(M.rails) };
  var c = document.createElement('canvas'); c.width = G.w; c.height = G.h; var x = c.getContext('2d'), img = x.createImageData(G.w, G.h);
  var col = { 0: [0, 0, 0, 0], 1: [38, 78, 125, 255], 2: [125, 45, 42, 255], 3: [70, 70, 60, 255] };
  for (var i = 0; i < G.n; i++) { var k = col[G.bloc[i]]; img.data[i * 4] = k[0]; img.data[i * 4 + 1] = k[1]; img.data[i * 4 + 2] = k[2]; img.data[i * 4 + 3] = k[3]; }
  x.putImageData(img, 0, 0); geo.bloc = c;
}

/* ---------- canvas + view ---------- */
var cv, ctx, bg, bgx, cw = 0, ch = 0, dpr = 1, bgView = null, bgDirty = true, lastBG = 0;
function w2s(x, y) { var v = app.view; return [(x - v.cx) * v.z + cw / 2, (y - v.cy) * v.z + ch / 2]; }
function s2w(sx, sy) { var v = app.view; return { x: (sx - cw / 2) / v.z + v.cx, y: (sy - ch / 2) / v.z + v.cy }; }
function setupCanvas(stage) {
  cv = stage.querySelector('canvas'); ctx = cv.getContext('2d'); bg = document.createElement('canvas'); bgx = bg.getContext('2d');
  sizeCanvas();
}
function sizeCanvas() {
  if (!cv) return; var r = cv.parentNode.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = Math.max(10, Math.floor(r.width)), h = Math.max(10, Math.floor(r.height));
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
  if (app.layers.rails) { bgx.beginPath(); trace(geo.rails); bgx.strokeStyle = z > 0.5 ? 'rgba(190,150,60,.55)' : 'rgba(190,150,60,.3)'; bgx.lineWidth = z > 1.5 ? 1.4 : 0.8; bgx.setLineDash(z > 1.2 ? [5, 3] : []); bgx.stroke(); bgx.setLineDash([]); }
  if (app.layers.roads) {
    bgx.beginPath(); trace(geo.roads.filter(function (r) { return r.t === 1; })); bgx.strokeStyle = 'rgba(210,210,200,.5)'; bgx.lineWidth = z > 1.5 ? 1.6 : 1; bgx.stroke();
    if (z > 0.4) { bgx.beginPath(); trace(geo.roads.filter(function (r) { return r.t === 2; })); bgx.strokeStyle = 'rgba(180,180,170,.28)'; bgx.lineWidth = 0.8; bgx.stroke(); }
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
function drawn(u) { var d = U[u.type]; return !(d.air && u.state === 'base'); }
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
var KCOL = { move: '#9fd8ff', amove: '#ff9f5b', hunt: '#ff5b4a', cas: '#ff5b4a', strike: '#ffd24a', recon: '#aaf', cap: '#6fd08c', awacs: '#6fd08c', rtb: '#999', land: '#999', haul: '#f2b84b', lift: '#9fd8ff' };
function draw() {
  var st = app.st; if (!st || !ctx) return; var v = app.view, z = v.z, side = st.side, con = st.con[side];
  if (bgDirty || !bgView || (Date.now() - lastBG > 140 && (bgView.cx !== v.cx || bgView.cy !== v.cy || bgView.z !== z))) renderBG();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0a1a24'; ctx.fillRect(0, 0, cw, ch);
  var s = z / bgView.z; ctx.drawImage(bg, cw / 2 - cw / 2 * s + (bgView.cx - v.cx) * z, ch / 2 - ch / 2 * s + (bgView.cy - v.cy) * z, cw * s, ch * s);
  var pad = 30, X0 = -pad, Y0 = -pad, X1 = cw + pad, Y1 = ch + pad;
  function on(p) { return p[0] > X0 && p[0] < X1 && p[1] > Y0 && p[1] < Y1; }
  // fallout + rail cuts
  st.fallout.forEach(function (f) { var p = w2s(f.x, f.y); ctx.beginPath(); ctx.arc(p[0], p[1], f.r * z, 0, 7); ctx.fillStyle = 'rgba(190,220,60,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(210,240,70,.6)'; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); });
  st.cuts.forEach(function (c) { var p = w2s(c.x, c.y); ctx.strokeStyle = '#ff6b5b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0] - 5, p[1] - 5); ctx.lineTo(p[0] + 5, p[1] + 5); ctx.moveTo(p[0] + 5, p[1] - 5); ctx.lineTo(p[0] - 5, p[1] + 5); ctx.stroke(); });
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
  var stacks = airStacks(st);
  if (app.layers.air) for (i = 0; i < M.air.length; i++) {
    var A = M.air[i], pa = w2s(A[2], A[3]); if (!on(pa)) continue; var ad = st.ad[i], size = A[5], mine = ad.o === side, stack = stacks[i];
    if (!stack && !(app.selNode && app.selNode.t === 'a' && app.selNode.i === i) && ((size === 1 && z < 1.5) || (size === 2 && z < 0.7) || (size === 3 && z < 0.3))) continue;
    var col2 = SIDE_COL[ad.o] || '#aaa', sz = 4 + size * 1.4;
    ctx.save(); ctx.translate(pa[0], pa[1]); ctx.rotate(0.6); ctx.globalAlpha = ad.dmg > 0.6 ? 0.45 : 1; ctx.strokeStyle = col2; ctx.lineWidth = 1.6; ctx.fillStyle = 'rgba(8,14,12,.8)';
    ctx.beginPath(); ctx.rect(-sz, -1.6, sz * 2, 3.2); ctx.fill(); ctx.stroke(); ctx.restore();
    if (ad.cp > 0.02) { ctx.beginPath(); ctx.arc(pa[0], pa[1], sz + 3, -1.57, -1.57 + 6.28 * ad.cp); ctx.strokeStyle = SIDE_COL[ad.cs] || '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (stack) { ctx.font = 'bold 9px ui-monospace,monospace'; ctx.fillStyle = col2; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,14,12,.85)'; ctx.strokeText('✈' + stack.length, pa[0], pa[1] - sz + 1); ctx.fillText('✈' + stack.length, pa[0], pa[1] - sz + 1); }
    if (z >= 2.6 || (app.selNode && app.selNode.t === 'a' && app.selNode.i === i)) { ctx.font = '9px system-ui'; ctx.fillStyle = 'rgba(190,230,200,.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(A[0], pa[0] + sz + 3, pa[1] + 5); }
  }
  // selected node ring
  if (app.selNode) { var nd = app.selNode, np = nd.t === 'c' ? [M.cities[nd.i][1], M.cities[nd.i][2]] : [M.air[nd.i][2], M.air[nd.i][3]], sp = w2s(np[0], np[1]); ctx.beginPath(); ctx.arc(sp[0], sp[1], 14, 0, 7); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2; ctx.stroke(); }
  // orders of selected units
  app.sel.forEach(function (id) {
    var u = W.unitById(st, id); if (!u) return; var pts = orderPts(u); if (!pts.length) return;
    var a = w2s(u.x, u.y); ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
    pts.forEach(function (q) { var b = w2s(q.x, q.y); ctx.strokeStyle = KCOL[q.k] || '#fff'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(b[0], b[1], 4, 0, 7); ctx.fillStyle = KCOL[q.k] || '#fff'; ctx.fill(); ctx.setLineDash([6, 4]); a = b; });
    ctx.setLineDash([]);
  });
  // contacts (enemy as you know it)
  if (app.layers.cons) for (var id in con) {
    var c = con[id], pc = w2s(c.x, c.y); if (!on(pc)) continue; var fade = c.lv === 'old', foe = W.OTHER[side];
    if (c.lv === 'unk') {
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
    if (!drawn(u)) return; var d = U[u.type], p = w2s(u.x, u.y); if (!on(p)) return; var sel = app.sel.indexOf(u.id) >= 0;
    if (small && !sel && (d.cls === 'arty' || d.cls === 'aa' || d.cls === 'eng' || d.cls === 'convoy' || d.cls === 'train' || d.heli)) return;
    var sc = small ? 0.7 : 1; ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(sc, sc);
    drawUnitIcon(ctx, 0, 0, u, SIDE_COL[side], { bar: u.str, sel: sel, fly: airborne(u), fade: u.broken });
    ctx.restore();
    if (u.broken) { ctx.fillStyle = '#ff6b5b'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', p[0] + 12, p[1] - 9); }
    if (sel) { ctx.beginPath(); ctx.arc(p[0], p[1], 17, 0, 7); ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2; ctx.stroke(); }
  });
  // air selected: range ring + stacked airfield selection ring
  if (app.pick && app.sel.length) {
    var u0 = W.unitById(st, app.sel[0]);
    if (u0 && (U[u0.type].air || U[u0.type].heli) && ['cas', 'strike', 'cut', 'recon', 'cap', 'awacs', 'move', 'lift2'].indexOf(app.pick.kind) >= 0) {
      var d0 = U[u0.type], bx = u0.base != null ? M.air[u0.base][2] : u0.x, by = u0.base != null ? M.air[u0.base][3] : u0.y, pp = w2s(bx, by);
      ctx.beginPath(); ctx.arc(pp[0], pp[1], d0.rad * W.rangeBonus(st, u0) * z, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([2, 6]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (app.pick && app.pick.kind === 'nuke' && app.pick.at) { var pn = w2s(app.pick.at.x, app.pick.at.y); ctx.beginPath(); ctx.arc(pn[0], pn[1], app.pick.R * z, 0, 7); ctx.fillStyle = 'rgba(232,255,90,.18)'; ctx.fill(); ctx.strokeStyle = '#e8ff5a'; ctx.lineWidth = 2; ctx.stroke(); }
  // scale bar
  var km = z > 3 ? 20 : z > 1.2 ? 50 : z > 0.5 ? 100 : 300; ctx.strokeStyle = '#d9e2dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, ch - 14); ctx.lineTo(10 + km * z, ch - 14); ctx.stroke(); ctx.fillStyle = '#d9e2dc'; ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(km + ' km', 10, ch - 17);
}
function airborne(u) { return W.airborne(u); }

/* ---------- picking things on the map ---------- */
function pickAt(sx, sy) {
  var st = app.st, side = st.side, out = [];
  ownUnits().forEach(function (u) { if (!drawn(u)) return; var p = w2s(u.x, u.y), d = Math.hypot(p[0] - sx, p[1] - sy); if (d < 20) out.push({ t: 'u', id: u.id, d: d }); });
  var con = st.con[side]; for (var id in con) { var c = con[id], p2 = w2s(c.x, c.y), d2 = Math.hypot(p2[0] - sx, p2[1] - sy); if (d2 < 20) out.push({ t: 'k', id: +id, d: d2 + 1 }); }
  if (app.layers.air) for (var i = 0; i < M.air.length; i++) { var A = M.air[i], p3 = w2s(A[2], A[3]), d3 = Math.hypot(p3[0] - sx, p3[1] - sy); if (d3 < 15) { var vis = airStacks(st)[i] || A[5] === 3 && app.view.z > 0.3 || A[5] === 2 && app.view.z > 0.7 || A[5] === 1 && app.view.z > 1.5; if (vis) out.push({ t: 'a', i: i, d: d3 + 2 }); } }
  for (i = 0; i < M.cities.length; i++) { var C = M.cities[i], p4 = w2s(C[1], C[2]), d4 = Math.hypot(p4[0] - sx, p4[1] - sy); if (d4 < 17) out.push({ t: 'c', i: i, d: d4 + 3 }); }
  out.sort(function (a, b) { return a.d - b.d; }); return out;
}
