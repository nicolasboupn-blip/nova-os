'use strict';
/* ===== shared parts library ===== */
const COL = {
  olive: 0x5b6240, od: 0x4f5638, nato: 0x4a5236, natoDk: 0x3d4430, tan: 0xb39a6a, sand: 0xc2a878, green: 0x4d5c3a, dkgreen: 0x333d2a,
  sovg: 0x56603a, sovdk: 0x434b2f, grey: 0x7a7e80, dkgrey: 0x3a3d40, steel: 0x6b7075, black: 0x16181a, rubber: 0x1c1d1e, track: 0x34332f,
  wood: 0x8a6a3e, rust: 0x7a4a2a, white: 0xe8e8e4, red: 0xb82c24, navy: 0x6f7f8c, navyDk: 0x4a5866, haze: 0x8b9aa5, ltgrey: 0xa9b0b4,
  bw: 0x25282b, brown: 0x6a5a3c, blue: 0x2c4c8c, yellow: 0xd2b02a, orange: 0xd9702a, glass: 0x1d2b33, ger: 0x4e5238, gerTan: 0x8a7a50,
};
/* 2D convex hull (monotone chain) of [[x,y]] */
function hull2(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
function circlePts(cx, cy, r, n) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
/* points evenly spaced along closed polyline */
function resample(poly, step) {
  const n = poly.length, seg = []; let tot = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); tot += l; }
  const cnt = Math.max(8, Math.round(tot / step)), ds = tot / cnt, out = []; let si = 0, acc = 0;
  for (let k = 0; k < cnt; k++) {
    const d = k * ds; while (acc + seg[si] < d) { acc += seg[si]; si = (si + 1) % n; }
    const t = (d - acc) / seg[si], a = poly[si], b = poly[(si + 1) % n];
    out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) });
  }
  return { pts: out, len: tot, ds };
}
/* Proper link placement: translate then rotate each link about its own centre */
function trackLinks(p, o, H, rs) {
  const t = o.t || 0.05, tw = o.tw, x = o.x;
  for (let i = 0; i < rs.pts.length; i++) {
    const q = rs.pts[i], deg = -q.ang * 180 / Math.PI;
    p.push(); p.tr(x, q.p[1], q.p[0]); p.ro(deg, 0, 0);
    p.box(0, 0, 0, tw, t, rs.ds * 0.9, { c: i % 2 ? o.trackCol : shade(o.trackCol, 0.82) });
    if (o.guide !== false) p.box(0, -t * 0.9, 0, tw * 0.12, t * 0.9, rs.ds * 0.5, { c: shade(o.trackCol, 0.6) });
    p.pop();
  }
}
function tracks(p, o) {
  /* o.sides: both. builds track links + wheels + sprocket/idler + rollers + skirts + fenders */
  o.t = o.t || 0.05; const t = o.t, rw = o.rw;
  const wz = o.wz ? o.wz.slice() : []; if (!o.wz) for (let i = 0; i < o.nw; i++) wz.push(o.zr + (o.zf - o.zr) * (o.nw === 1 ? 0.5 : i / (o.nw - 1)));
  const wy = rw + t, circles = [];
  for (const z of wz) circles.push(...circlePts(z, wy, rw + t * 0.5, 12));
  circles.push(...circlePts(o.sp.z, o.sp.y, o.sp.r + t * 0.5, 20), ...circlePts(o.id.z, o.id.y, o.id.r + t * 0.5, 20));
  for (const c of (o.extra || [])) circles.push(...circlePts(c[0], c[1], c[2] + t * 0.5, 12));
  const H = hull2(circles), rs = resample(H, o.ll || 0.17);
  const tc = o.trackCol !== undefined ? o.trackCol : COL.track, hubc = o.hubCol !== undefined ? o.hubCol : COL.dkgrey;
  p.mir(() => {
    const x = o.x;
    trackLinks(p, Object.assign({}, o, { trackCol: tc }), H, rs);
    // road wheels
    const dual = o.dual !== false;
    for (const z of wz) {
      if (dual) {
        for (const dx of [-0.23, 0.23]) { p.cyl(x + dx * o.tw, wy, z, rw * 0.97, o.tw * 0.36, { ax: 'x', c: COL.rubber, m: 0, n: 14 }); p.cyl(x + dx * o.tw * 1.15, wy, z, rw * 0.62, o.tw * 0.4, { ax: 'x', c: hubc, m: 1, n: 12 }); }
      } else { p.cyl(x, wy, z, rw * 0.97, o.tw * 0.6, { ax: 'x', c: COL.rubber, m: 0, n: 14 }); p.cyl(x + o.tw * 0.31, wy, z, rw * 0.62, o.tw * 0.1, { ax: 'x', c: hubc, m: 1, n: 12 }); }
      p.cyl(x + 0.0, wy, z, rw * 0.3, o.tw * 0.9, { ax: 'x', c: COL.black, m: 0, n: 8 });
    }
    // sprocket
    const sp = o.sp; p.cyl(x - o.tw * 0.15, sp.y, sp.z, sp.r * 0.96, o.tw * 0.5, { ax: 'x', c: hubc, m: 1, n: 18 });
    const nt = o.teeth || 14; for (let i = 0; i < nt; i++) { const a = i / nt * Math.PI * 2; p.push(); p.tr(x + o.tw * 0.1, sp.y + Math.sin(a) * sp.r, sp.z + Math.cos(a) * sp.r); p.ro(-a * 180 / Math.PI + 90, 0, 0); p.box(0, 0, 0, o.tw * 0.5, sp.r * 0.16, sp.r * 0.12, { c: COL.dkgrey }); p.pop(); }
    // idler
    const id = o.id; p.cyl(x - o.tw * 0.1, id.y, id.z, id.r * 0.96, o.tw * 0.45, { ax: 'x', c: hubc, m: 1, n: 16 }); p.cyl(x + o.tw * 0.14, id.y, id.z, id.r * 0.4, o.tw * 0.18, { ax: 'x', c: COL.black, n: 10 });
    // return rollers
    if (o.rollers) {
      const zs = o.sp.z, ze = o.id.z, ytop = o.rollY !== undefined ? o.rollY : Math.max(o.sp.y + o.sp.r, o.id.y + o.id.r) + t * 0.5;
      for (let i = 0; i < o.rollers; i++) { const z = lerp(zs, ze, (i + 1) / (o.rollers + 1)); p.cyl(x, ytop - (o.rr || 0.11) - t * 0.2, z, o.rr || 0.11, o.tw * 0.35, { ax: 'x', c: COL.rubber, n: 10 }); }
    }
  });
  return { H, wz };
}
/* side skirts / fenders: box on each side */
function fender(p, o) { p.mir(() => { p.box(o.x, o.y, o.z, o.w, o.h || 0.04, o.d, { c: o.c !== undefined ? o.c : p.cc }); }); }
/* barrel: stepped tube along +z from z0 to z0+len; sections [[z, r],...]*/
function tube(p, secs, o) {
  o = o || {}; const prof = []; const z0 = o.z0 || 0, x = o.x || 0, y = o.y || 0;
  prof.push([0, secs[0][0]]); for (const s of secs) prof.push([s[1], s[0]]); prof.push([0, secs[secs.length - 1][0]]);
  // lathe around Y then rotate to Z: use cyl-like orientation
  p.push(); p.tr(x, y, z0); p.ro(90, 0, 0);
  p.lat(prof.map(q => [q[0], q[1]]), { n: o.n || 14, sm: false, c: o.c, m: o.m });
  p.pop(); return p;
}
/* gun barrel with optional sleeve, evacuator, muzzle brake. L total, r0 breech radius, r1 muzzle radius */
function barrel(p, o) {
  const L = o.L, z0 = o.z0 || 0, r0 = o.r0, r1 = o.r1, c = o.c !== undefined ? o.c : COL.dkgrey;
  p.col(c, 1);
  if (o.sleeve) { p.cyl(o.x || 0, o.y || 0, z0 + L * 0.5, r0 * 1.12, L, { r1: r1 * 1.12, c: shade(c, 1.05), n: 14 }); }
  else p.cyl(o.x || 0, o.y || 0, z0 + L * 0.5, r0, L, { r1: r1, n: 14, c: c, m: 1 });
  if (o.evac) { const ez = z0 + L * o.evac; p.cyl(o.x || 0, o.y || 0, ez, (r0 + r1) / 2 * 1.4, L * 0.06, { c: shade(c, 0.9), n: 14 }); }
  if (o.evac2) { const ez = z0 + L * o.evac2; p.cyl(o.x || 0, o.y || 0, ez, (r0 + r1) / 2 * 1.25, L * 0.04, { c: shade(c, 0.9), n: 14 }); }
  if (o.brake) { const bz = z0 + L + o.brake * 0.4; p.cyl(o.x || 0, o.y || 0, bz, r1 * 1.55, o.brake, { c: shade(c, 0.85), n: 12 }); p.box(o.x || 0, o.y || 0, bz, r1 * 1.8, r1 * 0.5, o.brake * 0.7, { c: COL.black }); }
  if (o.sleeveRing) { for (const f of o.sleeveRing) p.cyl(o.x || 0, o.y || 0, z0 + L * f, r0 * 1.2, L * 0.012, { c: shade(c, 0.7), n: 14 }); }
  p.cyl(o.x || 0, o.y || 0, z0 + L + 0.01, r1 * 0.55, 0.02, { c: COL.black, n: 10 }); // bore
  return p;
}
/* hatch ring + lid on top */
function hatch(p, x, y, z, r, o) {
  o = o || {}; const c = o.c !== undefined ? o.c : p.cc;
  p.cyl(x, y + 0.03, z, r, 0.06, { ax: 'y', c: shade(c, 0.85), n: 12 });
  p.cyl(x, y + 0.075, z, r * 0.88, 0.03, { ax: 'y', c: c, n: 12 });
  if (o.open) { p.push(); p.tr(x, y + 0.07, z - r * 0.9); p.ro(o.open, 0, 0); p.cyl(0, 0.015, r * 0.9, r * 0.9, 0.03, { ax: 'y', c: c, n: 12 }); p.pop(); }
  return p;
}
/* periscope / vision block row (small dark boxes around a ring) */
function vision(p, x, y, z, r, n, o) {
  o = o || {};
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(); p.tr(x + Math.sin(a) * r, y, z + Math.cos(a) * r); p.ro(0, a * 180 / Math.PI, 0); p.box(0, 0, 0, o.w || 0.09, o.h || 0.05, 0.05, { c: COL.glass, m: 3 }); p.pop(); }
  return p;
}
/* smoke grenade launcher bank: n tubes in a row along axis, angled up and out */
function smokeBank(p, x, y, z, n, o) {
  o = o || {};
  for (let i = 0; i < n; i++) { p.push(); p.tr(x, y, z + (i - (n - 1) / 2) * (o.sp || 0.1)); p.ro(o.pitch || 40, (o.yaw || 0) * Math.sign(x || 1), 0); p.cyl(0, 0, 0, o.r || 0.04, o.len || 0.22, { ax: 'y', c: COL.dkgrey, n: 8 }); p.pop(); }
  return p;
}
/* antenna */
function antenna(p, x, y, z, h, o) {
  o = o || {}; p.cyl(x, y + 0.04, z, 0.045, 0.08, { ax: 'y', c: COL.black, n: 8 });
  p.cyl(x + (o.lean || 0) * h * 0.5, y + h / 2, z, 0.012, h, { ax: 'y', r1: 0.006, c: COL.black, n: 6 });
  return p;
}
/* star / cross / roundel decals (flat, facing +z unless rotated) */
function star(p, x, y, z, r, o) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.4 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  p.ext(pts, 0.012, Object.assign({ ax: 'z', t: [x, y, z], c: 0xffffff, m: 0 }, o || {})); return p;
}
function redStar(p, x, y, z, r, o) { return star(p, x, y, z, r, Object.assign({ c: COL.red }, o || {})); }
function roundel(p, x, y, z, r, cols, o) { // concentric discs facing +z
  o = o || {}; let rr = r; for (let i = 0; i < cols.length; i++) { p.push(); p.tr(x, y, z + i * 0.004); if (o.r) p.ro(o.r[0], o.r[1], o.r[2]); p.cyl(0, 0, 0, rr, 0.01, { ax: 'z', c: cols[i], n: 20 }); p.pop(); rr *= (o.k || 0.62); } return p;
}
function cross(p, x, y, z, s, o) {
  o = o || {}; p.push(); p.tr(x, y, z); if (o.r) p.ro(o.r[0], o.r[1], o.r[2]);
  p.box(0, 0, 0, s, s * 0.28, 0.012, { c: o.c !== undefined ? o.c : COL.black }); p.box(0, 0, 0, s * 0.28, s, 0.012, { c: o.c !== undefined ? o.c : COL.black });
  p.box(0, 0, 0.004, s * 0.78, s * 0.16, 0.012, { c: 0xffffff }); p.box(0, 0, 0.004, s * 0.16, s * 0.78, 0.012, { c: 0xffffff }); p.pop(); return p;
}
/* big fire/exhaust flame mesh (emissive cone along +z pointing back = -z) */
function flameMesh(p, len, r) {
  p.col(0xffa030, 2); p.cyl(0, 0, -len / 2, r, len, { r1: 0.01, ax: 'z', c: 0xff8a20, m: 2, n: 10 });
  p.cyl(0, 0, -len * 0.3, r * 0.55, len * 0.6, { r1: 0.01, ax: 'z', c: 0xffe49a, m: 2, n: 10 });
  return p;
}
