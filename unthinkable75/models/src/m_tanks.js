'use strict';
/* ===== MAIN BATTLE TANKS ===== */

/* generic gun mount: creates 'gun' (mantlet/trunnion, pitch) and 'barrel' (recoil). returns {gun,barrel}. pivot in turret coords */
function mountGun(m, tur, pivot, o) {
  const gun = m.part('gun', tur, pivot), bar = m.part('barrel', gun, [0, 0, o.recoilZ0 || 0]);
  return { gun, bar };
}

/* ---------------- M60A1 Patton ---------------- */
reg({
  id: 'm60', name: 'M60A1 Patton', side: 'NATO', cat: 'Tanks', era: '1975', fx: 'tank', game: ['armor'],
  spec: { Role: 'Main battle tank', Crew: '4', Mass: '46 t', Gun: '105 mm M68 rifled', Speed: '48 km/h', Engine: 'Continental AVDS-1790 diesel, 750 hp', Note: 'Backbone of US Army and many NATO armoured units in the 1970s.' },
  build(m) {
    const h = m.part('hull'); h.col(COL.nato, 0);
    // tracks
    tracks(h, { x: 1.46, tw: 0.71, rw: 0.33, nw: 6, zr: -2.25, zf: 1.85, sp: { z: -3.05, y: 0.62, r: 0.36 }, id: { z: 3.0, y: 0.52, r: 0.3 }, rollers: 3, rr: 0.11, rollY: 1.0, t: 0.06, ll: 0.18, trackCol: COL.track, hubCol: COL.dkgrey });
    // lower hull
    h.col(COL.nato, 0);
    h.ext([[-3.45, 0.48], [2.4, 0.48], [3.3, 0.78], [3.5, 1.08], [1.7, 1.5], [-1.4, 1.5], [-1.7, 1.4], [-3.45, 1.36]], 2.35, { ax: 'x' });
    // fenders / sponsons
    h.mir(() => { h.box(1.5, 1.02, -0.15, 0.82, 0.05, 6.2); h.box(1.5, 1.2, -0.15, 0.82, 0.3, 0.05, { c: COL.natoDk }); h.box(1.55, 1.0, 3.3, 0.7, 0.05, 0.75, { r: [10, 0, 0] }); h.box(1.88, 1.12, -0.15, 0.04, 0.17, 6.15, { c: COL.natoDk }); });
    // rear: engine deck & louvres
    h.box(0, 1.43, -2.4, 2.2, 0.06, 2.0, { c: COL.natoDk });
    for (let i = 0; i < 6; i++) h.box(0, 1.48, -1.7 - i * 0.28, 1.9, 0.02, 0.12, { c: COL.black });
    h.box(0, 0.8, -3.47, 2.3, 0.7, 0.06, { c: COL.natoDk }); h.box(0.7, 0.6, -3.55, 0.3, 0.2, 0.15, { c: COL.dkgrey, m: 1 }); h.box(-0.7, 0.6, -3.55, 0.3, 0.2, 0.15, { c: COL.dkgrey, m: 1 });
    // front detail: headlights, towing eyes, splash
    h.mir(() => { h.box(1.1, 1.1, 3.15, 0.22, 0.14, 0.14, { c: COL.dkgrey, m: 1 }); h.cyl(1.5, 1.05, 3.6, 0.07, 0.12, { c: COL.black, n: 8 }); });
    h.box(0, 1.1, 3.38, 1.2, 0.34, 0.06, { r: [-26, 0, 0], c: COL.natoDk });
    // driver hatch
    hatch(h, 0, 1.2, 2.75, 0.25, { c: COL.nato }); vision(h, 0, 1.25, 2.75, 0.2, 3, { w: 0.1 });
    // stowage & towing cables
    h.mir(() => { h.box(1.5, 1.2, -2.3, 0.6, 0.28, 0.7, { c: COL.dkgrey }); });
    h.mir(() => { h.cyl(1.72, 1.1, 0.8, 0.03, 4.0, { c: COL.black, n: 6 }); });
    // Turret
    const t = m.part('turret', h, [0, 1.5, 0.1]); t.col(COL.nato, 0);
    t.lof([{ z: -2.05, w: 1.1, h: 0.6, y: 0.36, n: 2.3, flat: 1 }, { z: -1.7, w: 2.3, h: 0.95, y: 0.5, n: 2.6, flat: 1 }, { z: -0.7, w: 3.0, h: 1.05, y: 0.55, n: 2.7, flat: 1 }, { z: 0.5, w: 2.9, h: 1.0, y: 0.52, n: 2.7, flat: 1 }, { z: 1.4, w: 2.1, h: 0.85, y: 0.46, n: 2.5, flat: 1 }, { z: 2.0, w: 1.1, h: 0.6, y: 0.4, n: 2.3, flat: 1 }], { k: 24, cap0: true, cap1: true });
    // mantlet
    t.sph(0, 0.55, 2.0, 0.5, { s: [1.15, 0.95, 0.5], c: COL.natoDk });
    // cupola (commander) right/rear, MG
    t.cyl(0.55, 1.14, -0.5, 0.42, 0.28, { ax: 'y', c: COL.nato, n: 16 }); vision(t, 0.55, 1.28, -0.5, 0.36, 8, { w: 0.12 }); t.cyl(0.55, 1.34, -0.5, 0.32, 0.05, { ax: 'y', c: COL.natoDk, n: 16 });
    t.box(0.55, 1.46, -0.08, 0.06, 0.06, 0.8, { c: COL.black }); t.cyl(0.55, 1.5, -0.55, 0.05, 0.28, { ax: 'z', c: COL.black, n: 8 }); // M85 MG
    hatch(t, -0.6, 1.06, -0.3, 0.26, { c: COL.nato });
    // search light block + antenna mounts, bustle rack
    t.box(-0.85, 1.0, 0.75, 0.35, 0.28, 0.3, { c: COL.dkgrey }); t.box(0, 0.65, -2.15, 1.3, 0.45, 0.2, { c: COL.natoDk });
    antenna(t, -0.95, 1.0, -1.7, 2.6, { lean: -0.05 });
    smokeBank(t, 1.3, 0.78, 1.2, 3, { yaw: 20, pitch: 55 });
    // gun
    const { gun, bar } = mountGun(m, t, [0, 0.55, 1.95], {});
    gun.col(COL.nato, 0); gun.cyl(0, 0, 0.05, 0.2, 0.3, { ax: 'z', c: COL.natoDk, n: 12 });
    bar.col(COL.dkgrey, 1); barrel(bar, { L: 5.2, z0: 0.1, r0: 0.13, r1: 0.09, evac: 0.58, sleeveRing: [0.2, 0.8] });
    bar.cyl(0.0, -0.0, 0.1 + 5.3, 0.11, 0.15, { c: COL.black, n: 12 });
    // coax MG
    gun.cyl(0.32, -0.12, 0.7, 0.025, 0.7, { c: COL.black, n: 6 });
    m.anchor('muzzle', bar, [0, 0, 5.4], [0, 0, 1]); m.tankProf = { recoil: 0.5, elevMax: 20, elevMin: -9 };
    // markings
    h.push(); h.tr(0, 0, 0); star(h, 1.9, 1.17, 0.5, 0.14, { r: [0, 90, 0] }); h.pop();
  },
});

/* ---------------- generic MBT builder ---------------- */
function mbt(m, P) {
  const C = P.col, D = P.dk;
  const h = m.part('hull'); h.col(C, 0);
  tracks(h, Object.assign({ trackCol: COL.track, hubCol: COL.dkgrey, t: 0.06, ll: 0.18 }, P.tr));
  h.col(C, 0); h.ext(P.hull, P.hw || 2.4, { ax: 'x' });
  if (P.fender !== false) h.mir(() => { h.box(P.tr.x + 0.05, P.fy || 1.05, P.fz || -0.2, 0.8, 0.05, P.fl || 6.2); });
  if (P.skirt) h.mir(() => { for (let i = 0; i < P.skirt.n; i++) h.box(P.tr.x + 0.42, P.skirt.y, P.skirt.z0 + i * P.skirt.dz, 0.06, P.skirt.h, P.skirt.dz - 0.04, { c: D }); });
  hatch(h, 0, P.dy || 1.2, P.dz || 2.6, 0.24, { c: C }); vision(h, 0, (P.dy || 1.2) + 0.05, P.dz || 2.6, 0.2, 3, { w: 0.1 });
  const t = m.part('turret', h, P.tp); t.col(C, 0);
  if (P.tsecs) t.lof(P.tsecs, { k: 20, cap0: true, cap1: true });
  if (P.tpoly) t.ext(P.tpoly, P.tw, Object.assign({ ax: 'x' }, P.text || {}));
  const { gun, bar } = mountGun(m, t, P.gp, {});
  gun.col(C, 0); gun.cyl(0, 0, 0.05, 0.22, 0.3, { ax: 'z', c: D, n: 12 });
  bar.col(COL.dkgrey, 1); barrel(bar, { L: P.L, z0: 0.1, r0: P.r0 || 0.075, r1: P.r1 || 0.065, evac: P.evac, sleeve: P.sleeve, brake: P.brake, sleeveRing: P.ring });
  m.anchor('muzzle', bar, [0, 0, P.L + 0.15], [0, 0, 1]); m.tankProf = { recoil: 0.5, elevMax: P.em || 20, elevMin: P.en || -8 };
  if (P.detail) P.detail(m, h, t, gun, bar);
  return { h, t, gun, bar };
}
const NATOP = { col: COL.nato, dk: COL.natoDk };

/* Leopard 1A5 */
reg({ id: 'leo1', name: 'Leopard 1A5', side: 'NATO', cat: 'Tanks', era: '1975', fx: 'tank', game: [],
  spec: { Role: 'Main battle tank', Crew: '4', Mass: '42.4 t', Gun: '105 mm L7', Speed: '65 km/h', Engine: 'MB 838 diesel, 830 hp', Note: 'German-built NATO workhorse of the 1970s.' },
  build(m) { mbt(m, Object.assign({}, NATOP, { tr: { x: 1.4, tw: 0.63, rw: 0.3, nw: 7, zr: -2.2, zf: 1.9, sp: { z: -3.0, y: 0.55, r: 0.34 }, id: { z: 3.0, y: 0.5, r: 0.29 }, rollers: 4, rr: 0.1, rollY: 0.95 },
    hull: [[-3.4, 0.45], [2.4, 0.45], [3.2, 0.8], [3.5, 1.05], [1.8, 1.45], [-1.5, 1.45], [-3.4, 1.3]], hw: 2.3, skirt: { n: 5, y: 0.68, z0: -2.0, dz: 0.95, h: 0.4 },
    tp: [0, 1.45, 0.0], tsecs: [{ z: -2.0, w: 1.4, h: 0.55, y: 0.34, n: 3.2, flat: 1 }, { z: -1.4, w: 2.5, h: 0.8, y: 0.45, n: 3.4, flat: 1 }, { z: -0.2, w: 3.0, h: 0.85, y: 0.5, n: 3.4, flat: 1 }, { z: 1.0, w: 2.6, h: 0.78, y: 0.46, n: 3.2, flat: 1 }, { z: 1.7, w: 1.5, h: 0.6, y: 0.42, n: 3.0, flat: 1 }, { z: 2.1, w: 0.8, h: 0.5, y: 0.4, n: 2.6, flat: 1 }],
    gp: [0, 0.55, 1.9], L: 5.1, r0: 0.085, sleeve: true, ring: [0.2, 0.8], evac: 0.55, brake: false,
    detail(m, h, t) { t.cyl(0.6, 1.0, -0.4, 0.38, 0.22, { ax: 'y', c: COL.nato, n: 16 }); t.box(0, 0.95, 1.35, 1.9, 0.18, 0.12, { c: COL.dkgrey, m: 1 }); t.box(0, 0.6, -2.05, 1.7, 0.5, 0.3, { c: COL.natoDk }); } })); } });

const SOVP = { col: COL.sovg, dk: COL.sovdk };
const wedgeT = (z0, z1, w, hh, y) => [{ z: z0, w: w * 0.7, h: hh * 0.7, y: y * 0.8, n: 3.6, flat: 1 }, { z: z0 + 0.5, w: w, h: hh, y: y, n: 4, flat: 1 }, { z: z1 - 1.0, w: w, h: hh * 0.92, y: y * 0.95, n: 4, flat: 1 }, { z: z1 - 0.3, w: w * 0.8, h: hh * 0.7, y: y * 0.85, n: 3.6, flat: 1 }, { z: z1, w: w * 0.55, h: hh * 0.5, y: y * 0.8, n: 3, flat: 1 }];
function modernBase(id, name, side, cat, era, game, spec, P, extra) {
  reg({ id, name, side, cat, era, fx: 'tank', game, spec, build(m) { return mbt(m, P); }, extra });
}
/* Leopard 2A7 */
modernBase('leo2', 'Leopard 2A7', 'NATO', 'Tanks', 'modern', ['m_leo'],
  { Role: 'Main battle tank', Crew: '4', Mass: '67 t', Gun: '120 mm L55', Speed: '68 km/h', Engine: 'MTU MB 873, 1500 hp' },
  Object.assign({}, NATOP, { tr: { x: 1.8, tw: 0.64, rw: 0.35, nw: 7, zr: -2.3, zf: 2.2, sp: { z: -3.3, y: 0.6, r: 0.38 }, id: { z: 3.2, y: 0.55, r: 0.33 }, rollers: 4, rr: 0.11, rollY: 1.0 },
    hull: [[-3.8, 0.5], [2.9, 0.5], [3.7, 0.9], [3.9, 1.2], [2.0, 1.55], [-3.8, 1.55]], hw: 2.7, fy: 1.1, fl: 6.8, skirt: { n: 6, y: 0.8, z0: -2.4, dz: 0.95, h: 0.5 },
    tp: [0, 1.55, 0.1], tsecs: wedgeT(-2.2, 2.4, 3.3, 0.95, 0.55), gp: [0, 0.55, 2.3], L: 5.8, r0: 0.09, evac: 0.5, ring: [0.1, 0.9],
    detail(m, h, t) { t.box(0.7, 1.1, 0.6, 0.5, 0.22, 0.5, { c: COL.dkgrey }); t.box(0, 0.5, -2.3, 2.0, 0.4, 0.5, { c: COL.natoDk }); t.cyl(-0.6, 1.1, 0.0, 0.3, 0.25, { ax: 'y', c: COL.natoDk, n: 12 }); } }));
/* M1A2 SEPv3 */
modernBase('abrams', 'M1A2 Abrams SEPv3', 'NATO', 'Tanks', 'modern', ['m_abrams'],
  { Role: 'Main battle tank', Crew: '4', Mass: '66 t', Gun: '120 mm M256', Speed: '67 km/h', Engine: 'AGT1500 turbine, 1500 hp' },
  Object.assign({}, { col: COL.tan, dk: COL.brown }, { tr: { x: 1.75, tw: 0.63, rw: 0.34, nw: 7, zr: -2.2, zf: 2.1, sp: { z: -3.3, y: 0.62, r: 0.38 }, id: { z: 3.2, y: 0.55, r: 0.32 }, rollers: 0, rr: 0.1, rollY: 1.0 },
    hull: [[-3.9, 0.5], [3.0, 0.5], [3.9, 0.9], [3.9, 1.15], [2.4, 1.5], [-3.9, 1.5]], hw: 2.7, fy: 1.0, fl: 6.8, skirt: { n: 7, y: 0.8, z0: -2.8, dz: 0.95, h: 0.62 },
    tp: [0, 1.5, 0.0], tsecs: wedgeT(-2.5, 2.3, 3.2, 0.95, 0.5), gp: [0, 0.5, 2.2], L: 5.6, r0: 0.09, evac: 0.5, ring: [0.1, 0.9],
    detail(m, h, t) { t.box(-0.7, 0.98, 0.2, 0.5, 0.3, 0.7, { c: COL.brown }); t.box(0, 0.5, -2.4, 2.8, 0.45, 0.6, { c: COL.brown }); t.cyl(0.6, 1.1, -0.3, 0.3, 0.2, { ax: 'y', c: COL.brown, n: 12 }); } }));
/* Challenger 3 */
modernBase('chall3', 'Challenger 3', 'NATO', 'Tanks', 'modern', ['m_chall'],
  { Role: 'Main battle tank', Crew: '4', Mass: '66 t', Gun: '120 mm L55 smoothbore', Speed: '59 km/h', Engine: 'Perkins CV12, 1200 hp' },
  Object.assign({}, NATOP, { tr: { x: 1.7, tw: 0.66, rw: 0.34, nw: 6, zr: -2.0, zf: 1.9, sp: { z: -3.1, y: 0.6, r: 0.38 }, id: { z: 3.0, y: 0.55, r: 0.33 }, rollers: 4, rr: 0.1, rollY: 1.0 },
    hull: [[-3.6, 0.5], [2.8, 0.5], [3.6, 0.9], [3.8, 1.15], [2.2, 1.55], [-3.6, 1.55]], hw: 2.6, fy: 1.1, fl: 6.6, skirt: { n: 6, y: 0.8, z0: -2.4, dz: 0.95, h: 0.52 },
    tp: [0, 1.55, 0.0], tsecs: wedgeT(-2.4, 2.4, 3.2, 1.0, 0.55), gp: [0, 0.6, 2.3], L: 5.8, r0: 0.09, evac: 0.5, ring: [0.1, 0.9],
    detail(m, h, t) { t.box(0.8, 1.15, 0.3, 0.55, 0.3, 0.6, { c: COL.dkgrey }); t.box(0, 0.5, -2.4, 2.4, 0.45, 0.6, { c: COL.natoDk }); } }));
/* T-62 */
modernBase('t62', 'T-62', 'PACT', 'Tanks', '1975', ['tank', 'gtank'],
  { Role: 'Main battle tank', Crew: '4', Mass: '37 t', Gun: '115 mm U-5TS smoothbore', Speed: '50 km/h', Engine: 'V-55 diesel, 580 hp' },
  Object.assign({}, SOVP, { tr: { x: 1.4, tw: 0.58, rw: 0.38, nw: 5, zr: -1.9, zf: 1.5, sp: { z: -3.0, y: 0.6, r: 0.34 }, id: { z: 2.9, y: 0.58, r: 0.33 }, rollers: 0, rr: 0.1, rollY: 1.0 },
    hull: [[-3.3, 0.5], [2.3, 0.5], [3.4, 0.9], [3.4, 1.0], [1.8, 1.45], [-3.3, 1.35]], hw: 2.2, fy: 1.1, fl: 6.2,
    tp: [0, 1.4, 0.2], tsecs: [{ z: -1.5, w: 1.6, h: 0.6, y: 0.3, n: 2.2, flat: 1 }, { z: -0.7, w: 2.6, h: 0.75, y: 0.4, n: 2.3, flat: 1 }, { z: 0.4, w: 2.7, h: 0.8, y: 0.43, n: 2.3, flat: 1 }, { z: 1.4, w: 2.0, h: 0.65, y: 0.38, n: 2.2, flat: 1 }, { z: 1.9, w: 1.0, h: 0.5, y: 0.35, n: 2.2, flat: 1 }],
    gp: [0, 0.45, 1.8], L: 5.8, r0: 0.075, sleeve: false, evac: 0.55, ring: [0.2, 0.8],
    detail(m, h, t) { h.mir(() => { h.cyl(1.5, 1.3, -1.8, 0.2, 0.9, { c: COL.dkgrey, n: 10 }); }); t.cyl(0.55, 0.85, -0.3, 0.3, 0.2, { ax: 'y', c: COL.sovg, n: 12 }); t.cyl(-0.5, 0.88, 0.3, 0.25, 0.15, { ax: 'y', c: COL.sovg, n: 12 }); } }));
/* T-72B3 */
modernBase('t72', 'T-72B3', 'PACT', 'Tanks', 'modern', ['r_t72'],
  { Role: 'Main battle tank', Crew: '3', Mass: '46 t', Gun: '125 mm 2A46', Speed: '60 km/h', Engine: 'V-84 diesel, 840 hp' },
  Object.assign({}, SOVP, { tr: { x: 1.5, tw: 0.58, rw: 0.38, nw: 6, zr: -2.1, zf: 1.9, sp: { z: -3.2, y: 0.6, r: 0.33 }, id: { z: 3.0, y: 0.55, r: 0.33 }, rollers: 0, rr: 0.1, rollY: 1.0 },
    hull: [[-3.3, 0.5], [2.3, 0.5], [3.4, 0.9], [3.45, 1.0], [2.0, 1.45], [-3.3, 1.35]], hw: 2.3, fy: 1.1, fl: 6.5,
    tp: [0, 1.4, 0.1], tsecs: [{ z: -1.6, w: 1.8, h: 0.6, y: 0.3, n: 2.2, flat: 1 }, { z: -0.7, w: 2.8, h: 0.8, y: 0.4, n: 2.4, flat: 1 }, { z: 0.4, w: 2.9, h: 0.85, y: 0.43, n: 2.4, flat: 1 }, { z: 1.4, w: 2.4, h: 0.7, y: 0.4, n: 2.6, flat: 1 }, { z: 2.0, w: 1.6, h: 0.55, y: 0.38, n: 2.4, flat: 1 }],
    gp: [0, 0.45, 2.0], L: 5.9, r0: 0.08, evac: 0.55, ring: [0.2, 0.8],
    detail(m, h, t) { t.box(0, 0.56, 1.9, 2.4, 0.34, 0.3, { c: COL.sovdk }); t.cyl(0.6, 0.85, -0.2, 0.3, 0.2, { ax: 'y', c: COL.sovg, n: 12 }); h.mir(() => { h.cyl(1.4, 1.3, -2.0, 0.2, 1.0, { c: COL.dkgrey, n: 10 }); }); h.box(0, 1.0, 3.2, 2.0, 0.3, 0.3, { c: COL.sovdk }); } }));
/* T-90M */
modernBase('t90', 'T-90M Proryv', 'PACT', 'Tanks', 'modern', ['r_t90'],
  { Role: 'Main battle tank', Crew: '3', Mass: '48 t', Gun: '125 mm 2A46M-5', Speed: '60 km/h', Engine: 'V-92S2F, 1130 hp' },
  Object.assign({}, SOVP, { tr: { x: 1.5, tw: 0.58, rw: 0.38, nw: 6, zr: -2.1, zf: 1.9, sp: { z: -3.2, y: 0.6, r: 0.33 }, id: { z: 3.0, y: 0.55, r: 0.33 }, rollers: 0, rr: 0.1, rollY: 1.0 },
    hull: [[-3.3, 0.5], [2.3, 0.5], [3.4, 0.9], [3.45, 1.0], [2.0, 1.45], [-3.3, 1.35]], hw: 2.3, fy: 1.1, fl: 6.5, skirt: { n: 5, y: 0.85, z0: -1.6, dz: 0.9, h: 0.45 },
    tp: [0, 1.4, 0.1], tsecs: wedgeT(-2.0, 2.3, 3.1, 0.9, 0.48),
    gp: [0, 0.45, 2.0], L: 6.0, r0: 0.08, evac: 0.55, ring: [0.2, 0.8],
    detail(m, h, t) { t.box(0, 0.58, 1.7, 2.5, 0.36, 0.4, { c: COL.sovdk }); t.box(-0.75, 1.0, 0.3, 0.5, 0.2, 0.5, { c: COL.dkgrey }); t.cyl(0.6, 1.0, -0.2, 0.25, 0.25, { ax: 'y', c: COL.sovg, n: 12 }); t.box(0, 0.5, -2.2, 2.4, 0.34, 0.4, { c: COL.sovdk }); } }));
/* T-14 Armata */
modernBase('t14', 'T-14 Armata', 'PACT', 'Tanks', 'modern', ['r_t14'],
  { Role: 'Main battle tank', Crew: '3 (hull capsule)', Mass: '48 t', Gun: '125 mm 2A82-1M', Speed: '80 km/h', Engine: 'A-85-3A X-form diesel, 1500 hp' },
  Object.assign({}, SOVP, { tr: { x: 1.55, tw: 0.6, rw: 0.36, nw: 7, zr: -2.4, zf: 2.0, sp: { z: -3.4, y: 0.6, r: 0.34 }, id: { z: 3.2, y: 0.55, r: 0.33 }, rollers: 0, rr: 0.1, rollY: 1.0 },
    hull: [[-3.5, 0.5], [2.6, 0.5], [3.6, 0.9], [3.7, 1.05], [2.2, 1.5], [-3.5, 1.5]], hw: 2.5, fy: 1.1, fl: 6.8, skirt: { n: 6, y: 0.85, z0: -2.4, dz: 0.95, h: 0.5 },
    tp: [0, 1.5, 0.3], tsecs: [{ z: -1.4, w: 1.8, h: 0.5, y: 0.25, n: 3.4, flat: 1 }, { z: -0.8, w: 2.6, h: 0.55, y: 0.28, n: 4, flat: 1 }, { z: 1.0, w: 2.6, h: 0.55, y: 0.28, n: 4, flat: 1 }, { z: 1.6, w: 1.6, h: 0.45, y: 0.25, n: 3.4, flat: 1 }],
    gp: [0, 0.3, 1.5], L: 6.0, r0: 0.085, evac: 0.55, ring: [0.2, 0.8],
    detail(m, h, t) { t.cyl(0, 0.62, -0.7, 0.35, 0.12, { ax: 'y', c: COL.dkgrey, n: 14 }); t.box(0, 0.62, -0.7, 0.3, 0.16, 0.3, { c: COL.glass, m: 3 }); t.box(0.9, 0.55, 1.1, 0.3, 0.3, 0.3, { c: COL.dkgrey }); } }));
