'use strict';
/* ===== trains: American desert freight + scarlet steam express ===== */
function axlePart(m, h, name, x, y, z, r, o) { // one wheelset: wheels + axle + spokes, spins about X
  const a = m.part(name, h, [0, y, z]); a.col(o.tyre || 0x1d1e20, 1); a.cyl(0, 0, 0, .09, x * 2, { ax: 'x', n: 8 });
  for (const sx of [-1, 1]) { a.cyl(sx * x, 0, 0, r, o.w || .16, { ax: 'x', n: 18, c: o.tyre || 0x1d1e20 }); a.cyl(sx * (x + (o.w || .16) * .55), 0, 0, r * .72, .04, { ax: 'x', n: 14, c: o.hub || 0x4a4d50, m: 1 });
    for (let i = 0; i < (o.spokes || 3); i++) { a.push(); a.ro(i * 180 / (o.spokes || 3), 0, 0); a.box(sx * (x + (o.w || .16) * .6), 0, 0, .05, r * 1.7, .06, { c: o.hub || 0x4a4d50 }); a.pop(); } }
  (m.axles = m.axles || []).push({ part: a, r }); return a;
}
function bogie(m, h, name, z, n, o) { // n axles, spacing sp
  const sp = o.sp || 1.8; h.col(0x222427, 0); h.box(0, o.r + .25, z, 2.3, .28, (n - 1) * sp + 1.0, { c: 0x222427 }); h.mir(() => h.box(.9, o.r + .1, z, .18, .34, (n - 1) * sp + .6, { c: 0x2a2c2f }));
  for (let i = 0; i < n; i++) axlePart(m, h, name + i, .72, o.r, z + (i - (n - 1) / 2) * sp, o.r, o);
}
function railLine(h, L, z0) { h.col(0x6a5a46, 0); }
function coupler(h, z) { h.box(0, 1.1, z, .35, .35, 1.0, { c: 0x1d1e20 }); }
/* ---- American diesel-electric locomotive ---- */
function dieselLoco(m, h, z0, col, stripe) {
  const Z = z0; const y0 = 1.1;
  bogie(m, h, 'dbA' + z0, Z + 6.2, 3, { r: .52, sp: 1.9, tyre: 0x1a1b1d, hub: 0x55585b, spokes: 3 }); bogie(m, h, 'dbB' + z0, Z - 6.2, 3, { r: .52, sp: 1.9, tyre: 0x1a1b1d, hub: 0x55585b, spokes: 3 });
  h.col(0x2b2d30, 0); h.box(0, y0 - .25, Z, 3.0, .5, 20.2, { c: 0x2b2d30 }); // underframe
  h.box(0, y0 - .55, Z + 1, 2.2, .6, 6.5, { c: 0x3a3d40 }); // fuel tank
  h.box(0, y0 + 1.35, Z - 3.2, 2.95, 2.4, 12.8, { c });
  function c() { } // (unused)
  h.box(0, y0 + 1.35, Z - 3.2, 2.95, 2.4, 12.8, { c: col }); h.box(0, y0 + 2.7, Z - 3.2, 2.6, .35, 12.4, { c: 0x6b6e70 }); // long hood + roof
  h.box(0, y0 + 1.6, Z - 9.6, 2.85, 2.9, 3.3, { c: col }); h.box(0, y0 + 3.3, Z - 9.6, 2.6, .35, 3.1, { c: 0x6b6e70 }); // radiator section
  for (let i = 0; i < 3; i++) h.cyl(0, y0 + 3.5, Z - 8.7 - i * 0 , .0, 0, { c: 0x111 }); // noop
  h.cyl(0, y0 + 3.55, Z - 10.2, .8, .12, { ax: 'y', n: 14, c: 0x222427 }); // fan grille
  h.box(0, y0 + 1.7, Z + 3.8, 3.0, 3.1, 3.6, { c: col }); h.box(0, y0 + 3.4, Z + 3.8, 3.1, .3, 3.9, { c: 0x6b6e70 }); // cab
  h.mir(() => h.box(1.51, y0 + 2.4, Z + 3.8, .05, 1.0, 1.5, { c: COL.glass, m: 3 })); h.box(0, y0 + 2.4, Z + 5.62, 2.5, 1.0, .05, { c: COL.glass, m: 3 });
  h.box(0, y0 + .95, Z + 8.4, 2.9, 1.9, 2.4, { c: col }); h.box(0, y0 + 2.0, Z + 8.4, 2.6, .25, 2.2, { c: 0x6b6e70 }); // short hood / nose
  h.col(stripe, 0); h.mir(() => { h.box(1.49, y0 + .8, Z - 3.2, .04, .35, 12.8, { c: stripe }); h.box(1.49, y0 + .8, Z + 3.8, .04, .35, 3.6, { c: stripe }); h.box(1.46, y0 + .8, Z + 8.4, .04, .35, 2.4, { c: stripe }); });
  h.box(0, y0 + 1.2, Z + 9.62, 2.9, .5, .05, { c: stripe });
  h.mir(() => { h.box(.75, y0 + 2.2, Z + 9.64, .35, .35, .08, { c: 0xfff0b0, m: 2 }); h.box(1.0, y0 + .35, Z + 9.65, .6, .12, .1, { c: 0xd8d0b0 }); });
  h.box(0, y0 + 2.45, Z + 9.64, .5, .3, .08, { c: 0xfff0b0, m: 2 });
  h.col(0x2b2d30, 0); h.box(0, y0 + 3.0, Z - 1, .5, .7, .5, { c: 0x2b2d30 }); h.box(0, y0 + 3.8, Z - 5, .9, .6, 1.0, { c: 0x2b2d30 });
  h.mir(() => { h.box(1.52, y0 + .1, Z + 3.0, .08, 1.6, .06, { c: 0xd8c040 }); h.box(1.52, y0 + .1, Z + 6.0, .08, 1.6, .06, { c: 0xd8c040 }); h.box(1.62, y0 + 1.3, Z, .04, .04, 14, { c: 0x999999 }); });
  m.anchor('stack' + z0, h, [0, y0 + 3.5, Z - 5], [0, 1, 0]);
}
function freightCar(m, h, kind, z, idx) {
  const L = 14, r = .45; bogie(m, h, 'cb' + idx + 'a', z + 4.8, 2, { r, sp: 1.8, tyre: 0x1a1b1d, hub: 0x55585b, spokes: 3 }); bogie(m, h, 'cb' + idx + 'b', z - 4.8, 2, { r, sp: 1.8, tyre: 0x1a1b1d, hub: 0x55585b, spokes: 3 });
  h.col(0x2b2d30, 0); h.box(0, 1.15, z, 2.6, .35, L, { c: 0x2b2d30 }); coupler(h, z + L / 2 + .6);
  if (kind === 'box') { const c = [0x7a3b24, 0x5b6b3a, 0x8a5a2a][idx % 3]; h.box(0, 3.1, z, 3.0, 3.6, L - 1.4, { c }); h.box(0, 5.0, z, 2.7, .3, L - 1.4, { c: 0x4a4440 }); h.mir(() => { h.box(1.52, 3.1, z, .06, 3.0, 3.2, { c: shade(c, .78) }); for (let i = -2; i <= 2; i++) h.box(1.52, 3.1, z + i * 2.4, .05, 3.4, .14, { c: shade(c, .6) }); }); }
  else if (kind === 'tank') { h.box(0, 1.55, z, 2.0, .3, L - 2, { c: 0x25282b }); h.cyl(0, 3.0, z, 1.45, L - 1.2, { ax: 'z', n: 18, c: 0x2a2d30, r1: 1.45 }); h.cyl(0, 4.55, z, .45, .5, { ax: 'y', n: 10, c: 0x1d1f21 }); h.box(0, 4.5, z, .6, .12, L - 3, { c: 0x888888 }); h.cyl(0, 3.0, z + L / 2 - .4, 1.0, .14, { ax: 'z', n: 18, c: 0x3a3d40, r1: .9 }); h.col(0xe0e0e0, 0); h.box(1.46, 3.0, z, .03, .7, 4, { c: 0xd8d8d0 }); }
  else if (kind === 'hopper') { const c = [0x6e6a64, 0x5a4636][idx % 2]; h.ext([[-1.5, 4.5], [1.5, 4.5], [1.35, 2.7], [.55, 1.55], [-.55, 1.55], [-1.35, 2.7]], L - 1.4, { ax: 'z', c }); for (let i = -2; i <= 2; i++) h.box(0, 3.3, z + i * 2.5, 3.05, 2.9, .12, { c: shade(c, .7) }); h.box(0, 4.55, z, 2.4, .1, L - 1.5, { c: shade(c, .6) }); }
  else if (kind === 'cont') { h.box(0, 1.5, z, 2.9, .2, L, { c: 0x2b2d30 }); const cols = [[0x2c5a8c, 0xd9702a], [0x8c2c2c, 0x3a7a4a], [0xd9a21b, 0x5a6b7a]][idx % 3]; for (let k = 0; k < 2; k++) { const zz = z + (k ? 3.4 : -3.4); h.box(0, 2.7, zz, 2.6, 2.4, 6.1, { c: cols[k] }); h.box(0, 5.0, zz, 2.6, 2.4, 6.1, { c: cols[1 - k] }); for (let i = -2; i <= 2; i++) { h.box(1.31, 2.7, zz + i * 1.1, .03, 2.2, .1, { c: shade(cols[k], .75) }); h.box(1.31, 5.0, zz + i * 1.1, .03, 2.2, .1, { c: shade(cols[1 - k], .75) }); } } }
}
function desertFreight(m) {
  const h = m.part('hull'); h.col(0x2b2d30, 0); m.axles = [];
  const cars = ['box', 'tank', 'hopper', 'cont', 'box', 'tank'];
  let z = 40; dieselLoco(m, h, z, 0xd9a21b, 0xb02a22); z -= 21.5; dieselLoco(m, h, z, 0xd9a21b, 0xb02a22); z -= 22.5; // lead + second unit
  m.railHead = 52;
  cars.forEach((k, i) => { freightCar(m, h, k, z, i); z -= 15; });
  m.trainCenter = (52 + z) / 2; h.off = [0, 0, -m.trainCenter]; m.def.focus = [0, 2.6, 40 - m.trainCenter - 4]; m.rollSpeed = 14; m.train = { kind: 'diesel' };
  m.init = (app) => { const e = getModel('_rails').clone(); e.noShadow = true; app.ents.push(e); e.updateWorld(); };
}
reg({ id: 'train', name: 'Desert Freight Train', side: 'NATO', cat: 'Logistics', era: '1975', fx: 'train', game: ['train'], cdist: .42, caz: 55, cel: 14, spec: { Role: 'American heavy freight (2 diesel-electric units + 6 cars)', Cars: 'boxcar, tank, hopper, container', Cargo: '~900 t', Speed: '80 km/h' }, build: desertFreight });
/* ---- scarlet steam express ---- */
function steamLoco(m, h) {
  const R = 0xa8211f, K = 0x15171a, B = 0xb48a2c, S = 0x8a8f94;
  const Z = 6; // front smokebox about z = Z+? ; loco from z=-4 (cab rear) to z=+9.5; tender behind
  h.col(K, 0); h.box(0, 1.15, 2.6, 2.3, .5, 14.4, { c: K }); // main frame
  // boiler
  h.cyl(0, 3.0, 2.4, 1.15, 8.6, { ax: 'z', n: 22, c: R });
  for (const zz of [-.4, 2.0, 4.4]) h.cyl(0, 3.0, zz, 1.19, .14, { ax: 'z', n: 22, c: B });
  h.cyl(0, 3.0, 7.7, 1.2, 1.7, { ax: 'z', n: 22, c: K }); h.cyl(0, 3.0, 8.58, 1.0, .12, { ax: 'z', n: 20, c: 0x222428 }); h.cyl(0, 3.0, 8.66, .12, .08, { ax: 'z', n: 8, c: B });
  // chimney, domes
  h.cyl(0, 4.35, 7.5, .3, 1.2, { ax: 'y', n: 12, c: K, r1: .42 }); h.cyl(0, 5.02, 7.5, .46, .14, { ax: 'y', n: 12, c: B });
  h.cyl(0, 4.35, 4.2, .5, .75, { ax: 'y', n: 14, c: B, r1: .42 }); h.sph(0, 4.7, 4.2, .42, { c: B }); h.cyl(0, 4.3, 2.3, .34, .6, { ax: 'y', n: 12, c: R, r1: .3 }); h.cyl(0, 4.65, 2.3, .26, .12, { ax: 'y', n: 10, c: B });
  h.cyl(0, 4.25, .3, .18, .5, { ax: 'y', n: 8, c: B });
  // cab
  h.box(0, 3.5, -2.5, 2.7, 3.0, 3.1, { c: R }); h.box(0, 5.2, -2.5, 3.0, .22, 3.5, { c: K });
  h.mir(() => { h.box(1.36, 3.9, -2.5, .05, 1.0, 1.1, { c: COL.glass, m: 3 }); h.box(1.2, 3.9, -.97, .06, 1.0, .06, { c: B }); }); h.box(0, 3.9, -.96, 1.2, .9, .05, { c: COL.glass, m: 3 });
  h.box(0, 2.1, -2.5, 2.9, .12, 3.4, { c: K }); // cab floor plate
  // splashers & running boards
  h.mir(() => { h.box(1.3, 1.95, 2.6, .12, .15, 8.2, { c: K }); h.box(1.3, 2.35, 2.2, .06, .5, 8.4, { c: R }); for (const zz of [.7, 2.5, 4.3]) h.cyl(1.2, 1.6, zz, 1.17, .3, { ax: 'x', n: 14, c: R, r1: 1.17 }); });
  // cylinders & valve gear
  h.mir(() => { h.cyl(1.05, 1.35, 7.0, .36, 1.9, { ax: 'z', n: 12, c: K }); h.cyl(1.05, 1.35, 8.1, .1, 1.4, { ax: 'z', n: 8, c: S, m: 1 }); h.box(1.05, 1.45, 8.9, .12, .3, .25, { c: S }); h.box(1.28, 2.0, 7.0, .05, .22, 2.0, { c: R }); });
  // buffer beam
  h.box(0, 1.1, 9.7, 3.3, .5, .32, { c: R }); h.mir(() => { h.cyl(1.15, 1.1, 10.05, .2, .45, { ax: 'z', n: 10, c: 0x3a3d40 }); h.cyl(1.15, 1.1, 10.3, .3, .1, { ax: 'z', n: 10, c: S, m: 1 }); });
  h.box(0, 1.0, 10.0, .3, .25, .5, { c: K });
  // headlamp
  h.box(0, 4.25, 8.65, .45, .45, .3, { c: K }); h.box(0, 4.25, 8.82, .28, .28, .05, { c: 0xfff2b0, m: 2 }); h.box(0, 4.2, 9.0, .06, .06, .06, { c: K });
  h.box(0, 2.9, 8.7, .8, .8, .06, { c: B }); // numberplate
  // whistle on cab roof
  h.cyl(.6, 5.5, -1.2, .1, .5, { ax: 'y', n: 8, c: B }); h.cyl(-.6, 5.5, -1.2, .08, .4, { ax: 'y', n: 8, c: B });
  // front pony bogie + drivers
  const wy = 1.0;
  bogie(m, h, 'pony', 7.6, 2, { r: .55, sp: 1.3, tyre: K, hub: R, spokes: 4, w: .14 });
  const drv = [-.6, 1.8, 4.2]; m.drivers = [];
  for (let i = 0; i < 3; i++) { const a = axlePart(m, h, 'drv' + i, .75, wy, drv[i], 1.0, { tyre: K, hub: R, spokes: 6, w: .2 }); m.axles.pop(); m.drivers.push({ part: a, r: 1.0 }); m.axles.push({ part: a, r: 1.0 }); }
  // coupling rods (animated): part per side
  m.rods = []; for (const sx of [-1, 1]) { const rod = m.part('rod' + (sx > 0 ? 'R' : 'L'), h, [sx * .98, wy, drv[1]]); rod.col(S, 1); rod.box(0, 0, 0, .1, .17, 4.9, {}); m.rods.push({ part: rod, sx, c: .42, base: [sx * .98, 0, 0] }); }
  m.anchor('chim', h, [0, 5.2, 7.5], [0, 1, 0]); m.anchor('whistle', h, [.6, 5.9, -1.2], [0, 1, 0]); m.anchor('cylL', h, [-1.1, 1.2, 7.4], [0, 0, 1]); m.anchor('cylR', h, [1.1, 1.2, 7.4], [0, 0, 1]);
  // tender
  const tz = -9.2; h.box(0, 1.15, tz + .2, 2.4, .5, 9.6, { c: K });
  h.box(0, 2.45, tz, 2.9, 2.3, 8.0, { c: R }); h.box(0, 1.7, tz, 2.95, .7, 8.05, { c: K }); h.box(0, 3.65, tz, 2.7, .3, 7.8, { c: K });
  h.box(0, 3.95, tz + .2, 2.2, .7, 6.6, { c: 0x1b1c1e }); for (let i = 0; i < 7; i++) h.sph(-.8 + i * .27, 4.35, tz + 1 - (i % 3) * .9, .5, { c: 0x111214 }); h.box(0, 3.7, tz + 3.9, 2.9, 1.0, .1, { c: R });
  h.cyl(0, 3.55, tz - 3.2, .5, .2, { ax: 'y', n: 12, c: K }); h.box(0, 1.15, tz + 5.0, .3, .3, 1.2, { c: K });
  bogie(m, h, 'tdA', tz + 2.6, 2, { r: .6, sp: 1.9, tyre: K, hub: R, spokes: 4, w: .14 }); bogie(m, h, 'tdB', tz - 2.2, 2, { r: .6, sp: 1.9, tyre: K, hub: R, spokes: 4, w: .14 });
  h.box(0, 1.15, tz - 4.5, .3, .3, 1.0, { c: K });
}
function coach(m, h, z, idx) {
  const M = 0x6b1b26, G = 0xc9a227, L = 15;
  bogie(m, h, 'chA' + idx, z + 5, 2, { r: .5, sp: 1.8, tyre: 0x17181a, hub: 0x4a4d50, spokes: 3 }); bogie(m, h, 'chB' + idx, z - 5, 2, { r: .5, sp: 1.8, tyre: 0x17181a, hub: 0x4a4d50, spokes: 3 });
  h.col(0x222427, 0); h.box(0, 1.3, z, 2.7, .3, L, { c: 0x1d1e20 }); h.box(0, 2.75, z, 2.95, 2.5, L - .5, { c: M });
  h.box(0, 1.75, z, 3.0, .12, L - .4, { c: G }); h.box(0, 3.85, z, 2.98, .1, L - .4, { c: G }); // gold lining
  h.col(0x6f6a64, 0); h.push(); h.tr(0, 3.9, z); h.sca(1, .32, 1); h.cyl(0, 0, 0, 1.48, L - .5, { ax: 'z', n: 16, c: 0x6f6a64 }); h.pop();
  h.mir(() => { for (let i = 0; i < 8; i++) h.box(1.48, 2.95, z - 6.2 + i * 1.75, .05, 1.0, 1.15, { c: 0x26303a, m: 3 }); h.box(1.5, 2.55, z + 7.0, .04, 2.0, .06, { c: G }); });
  h.box(0, 2.6, z + L / 2 + .1, 2.4, 2.2, .3, { c: 0x141517 }); h.box(0, 2.6, z - L / 2 - .1, 2.4, 2.2, .3, { c: 0x141517 }); coupler(h, z + L / 2 + .7);
}
function steamExpress(m) {
  const h = m.part('hull'); h.col(0x15171a, 0); m.axles = [];
  steamLoco(m, h); let z = -9.2 - 4.6 - 8.5;
  for (let i = 0; i < 4; i++) { coach(m, h, z, i); z -= 16.2; }
  const front = 10.4, back = z + 16.2 - 7.6; m.trainCenter = (front + back) / 2; h.off = [0, 0, -m.trainCenter]; m.def.focus = [0, 2.8, 2 - m.trainCenter]; m.rollSpeed = 12; m.train = { kind: 'steam' };
  m.init = (app) => { const e = getModel('_rails').clone(); e.noShadow = true; app.ents.push(e); e.updateWorld(); };
}
reg({ id: 'ptrain', name: 'Scarlet Steam Express', side: 'PACT', cat: 'Logistics', era: '1975', fx: 'train', game: ['ptrain'], cdist: .38, caz: 50, cel: 14, spec: { Role: 'Steam passenger / troop express (4-6-0)', Livery: 'scarlet loco, maroon & gold coaches', Coaches: '4', Speed: '90 km/h' }, build: steamExpress });
