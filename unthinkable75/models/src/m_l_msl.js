'use strict';
/* ===== missile TELs, SAMs, AA guns, trucks, trains ===== */
/* canister launcher: part 'gun' (elevates) with n tubes; anchors r0.. ; kind decides profile missile */
function launcher(m, parent, pivot, o) { o.sp = o.sp || 1; // o: n, cols, sp, len, r, c, shape 'tube'|'box'
  const g = m.part('gun', parent, pivot); g.col(o.c || COL.olive, 0); const n = o.n, cols = o.cols || n;
  const rows = Math.ceil(n / cols); let k = 0;
  if (o.shape === 'box') g.box(0, 0, o.len / 2, cols * o.sp + .12, rows * o.sp + .12, o.len, { c: o.c });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols && k < n; c++) {
    const x = (c - (cols - 1) / 2) * o.sp, y = (r - (rows - 1) / 2) * o.sp;
    if (o.shape !== 'box') { g.cyl(x, y, o.len / 2, o.r, o.len, { c: o.c, n: 10 }); }
    g.cyl(x, y, o.len + .01, o.r * .85, .04, { c: COL.black, n: 8 }); m.anchor('r' + k, g, [x, y, o.len * .9], [0, 0, 1]); k++;
  }
  m.nRockets = k; m.podOf = g; m.anchor('muzzle', g, [0, 0, o.len], [0, 0, 1]); return g;
}
function truck(m, P) { // generic military truck chassis, returns hull part. P.n axles, P.len, P.col
  const h = m.part('hull'); h.col(P.col, 0); const zs = wz(P.n, -P.len / 2 + 1.2, P.len / 2 - 1.8), r = P.r || .6;
  wheelSet(h, { x: P.x || 1.2, r, w: .42, zs, hub: COL.dkgrey });
  h.box(0, r + .3, -.3, P.w || 2.4, .35, P.len - 1.6, { c: COL.dkgrey }); // chassis
  const cz = P.len / 2 - .9; h.box(0, r + 1.0, cz, P.w || 2.4, 1.5, 1.7, { c: P.col }); h.box(0, r + 1.35, cz + .86, (P.w || 2.4) * .85, .5, .04, { c: COL.glass, m: 3 });
  h.box(0, r + .5, P.len / 2 + .05, (P.w || 2.4) * .95, .3, .2, { c: COL.dkgrey });
  return h;
}
const MD = { m_wh: 0 };
function tel(id, name, side, era, game, spec, P, mk, fx, cat) { reg({ id, name, side, cat: cat || 'Missiles & air defence', era, fx, game, spec, build(m) { const h = P.tr ? (function () { const h = m.part('hull'); h.col(P.col, 0); tracks(h, Object.assign({ trackCol: COL.track, hubCol: COL.dkgrey, t: .05 }, P.tr)); h.col(P.col, 0); h.ext(P.hull, P.hw, { ax: 'x' }); return h; })() : truck(m, P); mk(m, h, P); } }); }
/* SSM */
tel('lance', 'MGM-52 Lance', 'NATO', '1975', ['lance'], { Role: 'Tactical ballistic missile', Crew: '3', Range: '120 km', Warhead: 'W70 nuclear / conventional', Speed: 'Mach 3' },
  { col: COL.nato, tr: { x: 1.2, tw: .4, rw: .28, nw: 5, zr: -1.6, zf: 1.1, sp: { z: -2.5, y: .5, r: .3 }, id: { z: 2.3, y: .5, r: .27 }, rollers: 0 }, hull: [[-2.8, .45], [2.0, .45], [2.7, .8], [2.7, 1.3], [1.9, 1.6], [-2.8, 1.5]], hw: 2.4 },
  (m, h) => { const g = launcher(m, h, [0, 1.8, -2.4], { n: 1, len: 5.5, r: .3, c: COL.olive, shape: 'tube' }); g.col(COL.olive, 0); g.box(0, -.4, 1.0, .5, .5, 2.2, { c: COL.dkgrey }); m.msl = '_ssm'; }, 'ssm');
tel('pershing', 'Pershing II', 'NATO', '1975', ['pershing'], { Role: 'Medium-range ballistic missile', Crew: '5', Range: '1,800 km', Warhead: 'W85 nuclear', Speed: 'Mach 8' },
  { col: COL.nato, n: 4, len: 11, r: .62, w: 2.6 }, (m, h) => { launcher(m, h, [0, 2.4, -4.2], { n: 1, len: 9.5, r: .55, c: COL.ltgrey, shape: 'tube' }); m.msl = '_ssm'; m.mscale = 1.5; }, 'ssm');
tel('frog', 'FROG-7', 'PACT', '1975', ['frog'], { Role: 'Free rocket over ground', Crew: '4', Range: '70 km', Warhead: '450 kg HE', Speed: '8×8' },
  { col: COL.sovg, n: 4, len: 9.8, r: .6, w: 2.5 }, (m, h) => { launcher(m, h, [0, 1.9, -3.8], { n: 1, len: 8.8, r: .3, c: COL.sovdk, shape: 'tube' }); m.msl = '_ssm'; }, 'ssm');
tel('scud', 'R-17 Scud-B', 'PACT', '1975', ['scud'], { Role: 'Ballistic missile', Crew: '4', Range: '300 km', Warhead: '1 t HE / nuclear', Speed: 'Mach 5' },
  { col: COL.sovg, n: 4, len: 11, r: .62, w: 2.6 }, (m, h) => { launcher(m, h, [0, 2.4, -4.0], { n: 1, len: 10, r: .45, c: COL.sovdk, shape: 'tube' }); m.msl = '_ssm'; m.mscale = 1.4; }, 'ssm');
tel('ss12', 'SS-12 Scaleboard', 'PACT', '1975', ['ss12'], { Role: 'Ballistic missile', Crew: '5', Range: '900 km', Warhead: 'Nuclear / HE', Speed: 'Mach 6' },
  { col: COL.sovg, n: 4, len: 12.5, r: .65, w: 2.8 }, (m, h) => { launcher(m, h, [0, 2.5, -5.0], { n: 1, len: 11, r: .55, c: COL.ltgrey, shape: 'tube' }); m.msl = '_ssm'; m.mscale = 1.5; }, 'ssm');
tel('iskander', 'Iskander-M', 'PACT', 'modern', ['r_isk'], { Role: 'Short-range ballistic missile 8×8', Crew: '3', Range: '500 km', Warhead: '480 kg', Speed: 'Mach 7' },
  { col: COL.sovg, n: 4, len: 12.5, r: .65, w: 2.8 }, (m, h) => { launcher(m, h, [0, 2.4, -3.0], { n: 2, cols: 2, sp: .8, len: 7.5, r: .38, c: COL.sovdk, shape: 'tube' }); m.msl = '_ssm'; }, 'ssm');
/* SAM */
tel('patriot', 'MIM-104 Patriot', 'NATO', 'modern', ['m_pat'], { Role: 'Surface-to-air system', Crew: '3', Range: '160 km', Missiles: '4 × PAC-3 / PAC-2', Speed: 'Mach 5' },
  { col: COL.olive, n: 4, len: 10, r: .6, w: 2.6 }, (m, h) => { launcher(m, h, [0, 2.3, -3.8], { n: 4, cols: 4, sp: .62, len: 5.2, r: .0, c: COL.olive, shape: 'box' }); m.msl = '_sam'; m.mscale = 1.2; }, 'sam');
tel('s300', 'S-300PMU', 'PACT', 'modern', ['r_s300'], { Role: 'Surface-to-air system', Crew: '4', Range: '150 km', Missiles: '4 × 5V55', Speed: 'Mach 6' },
  { col: COL.sovg, n: 4, len: 11, r: .62, w: 2.6 }, (m, h) => { launcher(m, h, [0, 2.4, -3.5], { n: 4, cols: 2, sp: .8, len: 7, r: .35, c: COL.sovdk, shape: 'tube' }); m.msl = '_sam'; m.mscale = 1.4; }, 'sam');
tel('s400', 'S-400 Triumf', 'PACT', 'modern', ['r_s400'], { Role: 'Surface-to-air system', Crew: '4', Range: '400 km', Missiles: '4 × 48N6 / 40N6', Speed: 'Mach 14' },
  { col: COL.sovg, n: 4, len: 11.5, r: .62, w: 2.6 }, (m, h) => { launcher(m, h, [0, 2.4, -3.6], { n: 4, cols: 2, sp: .85, len: 7.5, r: .38, c: COL.sovdk, shape: 'tube' }); m.msl = '_sam'; m.mscale = 1.6; }, 'sam');
tel('hawk', 'MIM-23 Hawk', 'NATO', '1975', ['aa'], { Role: 'Surface-to-air launcher (towed)', Crew: '3', Range: '40 km', Missiles: '3 × Hawk', Speed: 'Mach 2.4' },
  { col: COL.olive, n: 2, len: 5.5, r: .5, w: 2.4 }, (m, h) => { launcher(m, h, [0, 1.9, -1.2], { n: 3, cols: 3, sp: .62, len: 5.0, r: 0, c: COL.olive, shape: 'box' }); m.msl = '_sam'; m.mscale = 1.1; }, 'sam');
tel('sa6', 'SA-6 Gainful', 'PACT', '1975', ['aa', 'paa'], { Role: 'Surface-to-air (tracked)', Crew: '3', Range: '24 km', Missiles: '3 × 3M9', Speed: 'Mach 2.8' },
  { col: COL.sovg, tr: { x: 1.4, tw: .45, rw: .3, nw: 6, zr: -2.0, zf: 1.5, sp: { z: -3.0, y: .5, r: .3 }, id: { z: 2.9, y: .5, r: .27 }, rollers: 0 }, hull: [[-3.2, .45], [2.4, .45], [3.1, .8], [3.1, 1.3], [1.8, 1.6], [-3.2, 1.6]], hw: 2.8 },
  (m, h) => { launcher(m, h, [0, 2.0, -1.0], { n: 3, cols: 3, sp: .7, len: 5.5, r: 0, c: COL.sovdk, shape: 'box' }); m.msl = '_sam'; m.mscale = 1.2; }, 'sam');
tel('roland', 'Roland II', 'NATO', '1975', ['aa'], { Role: 'Short-range SAM', Crew: '3', Range: '8 km', Missiles: '2 + 8', Speed: 'Mach 1.6' },
  { col: COL.olive, tr: { x: 1.3, tw: .4, rw: .3, nw: 5, zr: -1.5, zf: 1.2, sp: { z: -2.5, y: .5, r: .3 }, id: { z: 2.5, y: .5, r: .27 }, rollers: 0 }, hull: [[-2.9, .45], [2.4, .45], [3.0, .8], [3.0, 1.4], [1.8, 1.6], [-2.9, 1.6]], hw: 2.7 },
  (m, h) => { const t = m.part('turret', h, [0, 1.6, -.3]); t.col(COL.olive, 0); t.box(0, .5, 0, 1.8, 1.0, 2.2); const g = launcher(m, t, [0, 1.0, 0], { n: 2, cols: 2, sp: 1.9, len: 1.4, r: .24, c: COL.olive, shape: 'tube' }); m.msl = '_sam'; m.mscale = .9; }, 'sam');
tel('pantsir', 'Pantsir-S1', 'PACT', 'modern', ['r_pantsir'], { Role: 'Gun-missile air defence', Crew: '3', Range: '20 km', Armament: '12 × 57E6 + 2 × 30 mm', Speed: 'Mach 3.5' },
  { col: COL.sovg, n: 3, len: 9, r: .6, w: 2.6 }, (m, h) => { const t = m.part('turret', h, [0, 2.2, -2.5]); t.col(COL.sovg, 0); t.box(0, .5, 0, 2.4, 1.0, 2.6); t.cyl(1.2, .3, .6, .06, 2, { c: COL.dkgrey, n: 8 }); t.cyl(-1.2, .3, .6, .06, 2, { c: COL.dkgrey, n: 8 }); launcher(m, t, [0, 1.0, 0], { n: 6, cols: 3, sp: .5, len: 1.6, r: .2, c: COL.sovdk, shape: 'tube' }); m.msl = '_sam'; m.mscale = .9; m.podOf = m.find('gun'); }, 'sam');
tel('tor', 'Tor-M2', 'PACT', 'modern', [], { Role: 'Short-range SAM (tracked)', Crew: '3', Range: '12 km', Missiles: '8 × 9M331', Speed: 'Mach 2.5' },
  { col: COL.sovg, tr: { x: 1.4, tw: .45, rw: .3, nw: 6, zr: -2.0, zf: 1.5, sp: { z: -3.0, y: .5, r: .3 }, id: { z: 2.9, y: .5, r: .27 }, rollers: 0 }, hull: [[-3.2, .45], [2.4, .45], [3.1, .8], [3.1, 1.3], [1.8, 1.6], [-3.2, 1.6]], hw: 2.8 },
  (m, h) => { const t = m.part('turret', h, [0, 1.6, -.2]); t.col(COL.sovg, 0); t.box(0, .6, 0, 2.2, 1.2, 2.4); t.box(0, 1.5, -.6, 1.6, .15, 1.0, { c: COL.dkgrey }); launcher(m, t, [0, 1.1, .2], { n: 8, cols: 4, sp: .5, len: 1.8, r: .2, c: COL.sovdk, shape: 'tube' }); m.msl = '_sam'; m.mscale = .8; }, 'sam');
tel('iris', 'IRIS-T SLM', 'NATO', 'modern', ['m_iris'], { Role: 'Medium-range SAM 8×8', Crew: '3', Range: '40 km', Missiles: '8 × IRIS-T SL', Speed: 'Mach 3' },
  { col: COL.olive, n: 4, len: 10, r: .6, w: 2.6 }, (m, h) => { launcher(m, h, [0, 2.4, -3.2], { n: 8, cols: 4, sp: .52, len: 4.0, r: .22, c: COL.olive, shape: 'tube' }); m.msl = '_sam'; m.mscale = 1.0; }, 'sam');
tel('nasams', 'NASAMS', 'NATO', 'modern', [], { Role: 'Medium-range SAM', Crew: '3', Range: '40 km', Missiles: '6 × AMRAAM-ER', Speed: 'Mach 4' },
  { col: COL.olive, n: 3, len: 9, r: .6, w: 2.5 }, (m, h) => { launcher(m, h, [0, 2.2, -2.6], { n: 6, cols: 3, sp: .5, len: 4.2, r: .2, c: COL.olive, shape: 'tube' }); m.msl = '_sam'; m.mscale = 1.0; }, 'sam');
/* AA guns */
function aagun(id, name, side, era, game, spec, P) {
  reg({ id, name, side, cat: 'Missiles & air defence', era, fx: 'aag', game, spec, build(m) {
    const h = m.part('hull'); h.col(P.col, 0); tracks(h, Object.assign({ trackCol: COL.track, hubCol: COL.dkgrey, t: .05 }, P.tr)); h.col(P.col, 0); h.ext(P.hull, P.hw, { ax: 'x' });
    const t = m.part('turret', h, [0, P.ty, P.tz || 0]); t.col(P.col, 0); t.box(0, .55, 0, P.tw, 1.1, 2.4); t.box(0, 1.3, -.8, 1.4, .5, 1.0, { c: COL.dkgrey });
    P.dish && (t.cyl(0, 1.6, -.9, .8, .08, { ax: 'z', c: COL.dkgrey, n: 14 }), t.cyl(0, 1.2, -.9, .05, .5, { ax: 'y', c: COL.dkgrey, n: 6 }));
    const g = m.part('gun', t, [0, .55, .6]); g.col(P.col, 0); g.box(0, 0, .2, P.tw * 1.0, .4, .8, { c: P.dk }); let k = 0;
    for (const sx of P.gx) { const b = m.part('barrel' + (k ? k : ''), g, [sx, 0, 0]); b.col(COL.dkgrey, 1); barrel(b, { L: P.L, z0: .4, r0: P.r, r1: P.r * .9, brake: P.brake || .0 }); m.anchor(k ? 'muzzle' + k : 'muzzle', b, [0, 0, P.L + .5], [0, 0, 1]); k++; }
    m.tankProf = { recoil: .1, elevMax: 85, elevMin: -4 }; m.nBar = k; } });
}
aagun('gepard', 'Flakpanzer Gepard', 'NATO', '1975', ['aa'], { Role: 'Self-propelled AA gun', Crew: '3', Armament: '2 × 35 mm Oerlikon', Range: '5.5 km', Speed: '65 km/h' }, { col: COL.nato, dk: COL.natoDk, tr: { x: 1.5, tw: .5, rw: .32, nw: 6, zr: -1.8, zf: 1.6, sp: { z: -3.0, y: .55, r: .33 }, id: { z: 2.9, y: .5, r: .3 }, rollers: 3, rr: .08, rollY: 1.0 }, hull: [[-3.3, .5], [2.4, .5], [3.2, .9], [3.2, 1.3], [1.8, 1.6], [-3.3, 1.7]], hw: 2.9, ty: 1.7, tz: -.3, tw: 1.9, gx: [-.8, .8], L: 3.1, r: .07, dish: true });
aagun('zsu23', 'ZSU-23-4 Shilka', 'PACT', '1975', ['aa'], { Role: 'Self-propelled AA gun', Crew: '4', Armament: '4 × 23 mm AZP-23', Range: '2.5 km', Speed: '50 km/h' }, { col: COL.sovg, dk: COL.sovdk, tr: { x: 1.4, tw: .45, rw: .33, nw: 6, zr: -1.8, zf: 1.5, sp: { z: -2.9, y: .55, r: .3 }, id: { z: 2.7, y: .5, r: .27 }, rollers: 0 }, hull: [[-3.0, .5], [2.2, .5], [3.0, .9], [3.0, 1.2], [1.6, 1.4], [-3.0, 1.4]], hw: 2.6, ty: 1.4, tz: -.3, tw: 2.5, gx: [-.8, -.27, .27, .8], L: 2.2, r: .05, dish: true });
aagun('skyranger', 'Skyranger 30', 'NATO', 'modern', ['m_shorad'], { Role: 'Short-range air defence (Boxer)', Crew: '3', Armament: '30 mm Rh... + missiles', Range: '5 km', Speed: '100 km/h' }, { col: COL.nato, dk: COL.natoDk, tr: { x: 1.5, tw: .5, rw: .32, nw: 4, zr: -1.4, zf: 1.2, sp: { z: -2.6, y: .55, r: .33 }, id: { z: 2.5, y: .5, r: .3 }, rollers: 0 }, hull: [[-3.0, .5], [2.2, .5], [3.0, .9], [3.0, 1.4], [1.8, 1.7], [-3.0, 1.8]], hw: 2.9, ty: 1.8, tz: -.3, tw: 2.2, gx: [0], L: 3.0, r: .06, dish: true });
