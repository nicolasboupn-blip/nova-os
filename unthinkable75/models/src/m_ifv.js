'use strict';
/* ===== IFV / APC / recon: generic builder ===== */
function wheelSet(h, o) { // o.x half-track, o.r radius, o.w width, o.zs[], o.hub
  for (const z of o.zs) h.mir(() => { h.wheel(o.x, o.r, z, o.r, o.w, { hub: o.hub !== undefined ? o.hub : COL.dkgrey }); h.box(o.x - o.w * 0.0, o.r * 2.05, z, o.w * 1.15, 0.04, o.r * 2.3, { c: shade(h.cc, 0.85) }); });
  h.mir(() => h.box(0.0, o.r * 1.0, 0, 0.0, 0.0, 0.0));
}
function veh(m, P) {
  const h = m.part('hull'); h.col(P.col, 0);
  if (P.tr) tracks(h, Object.assign({ trackCol: COL.track, hubCol: COL.dkgrey, t: 0.05, ll: 0.16 }, P.tr)); else if (P.wh) wheelSet(h, P.wh);
  h.col(P.col, 0); h.ext(P.hull, P.hw, { ax: 'x' });
  if (P.skirt) h.mir(() => h.box(P.hw / 2 + 0.05, P.skirt.y, P.skirt.z, 0.05, P.skirt.h, P.skirt.d, { c: P.dk }));
  if (P.hatchz !== undefined) { hatch(h, P.hx || 0.45, P.hy, P.hatchz, 0.22, { c: P.col }); }
  if (P.boxes) for (const b of P.boxes) h.box(b[0], b[1], b[2], b[3], b[4], b[5], { c: b[6] === undefined ? P.dk : b[6] });
  let t = null, gun = null, bar = null;
  if (P.tur) {
    t = m.part('turret', h, P.tur.pivot); t.col(P.col, 0);
    if (P.tur.secs) t.lof(P.tur.secs, { k: 18, cap0: true, cap1: true }); else if (P.tur.poly) t.ext(P.tur.poly, P.tur.w, { ax: 'x' }); else t.box(0, P.tur.h / 2, P.tur.zc || 0, P.tur.w, P.tur.h, P.tur.d);
    if (P.tur.hatch) hatch(t, P.tur.hatch[0], P.tur.hatch[1], P.tur.hatch[2], 0.2, { c: P.col });
    if (P.gun) {
      gun = m.part('gun', t, P.gun.pivot); bar = m.part('barrel', gun, [0, 0, 0]); gun.col(P.col, 0); gun.box(0, 0, 0.1, 0.34, 0.3, 0.4, { c: P.dk });
      bar.col(COL.dkgrey, 1); barrel(bar, { L: P.gun.L, z0: 0.15, r0: P.gun.r, r1: P.gun.r * 0.85, evac: P.gun.evac, brake: P.gun.brake });
      if (P.gun.mg) gun.cyl(P.gun.mg, -0.12, 0.5, 0.03, 0.8, { c: COL.black, n: 6 });
      m.anchor('muzzle', bar, [0, 0, P.gun.L + 0.25], [0, 0, 1]); m.tankProf = { recoil: P.gun.rec || 0.12, elevMax: 45, elevMin: -8 };
    }
  } else if (P.rws) { // remote weapon station
    t = m.part('turret', h, P.rws); t.col(COL.dkgrey, 1); t.box(0, 0.15, 0, 0.5, 0.3, 0.55); gun = m.part('gun', t, [0, 0.2, 0.2]); bar = m.part('barrel', gun, [0, 0, 0]); bar.col(COL.black, 1); barrel(bar, { L: 1.0, z0: 0.2, r0: 0.04, r1: 0.035 });
    m.anchor('muzzle', bar, [0, 0, 1.25], [0, 0, 1]); m.tankProf = { recoil: 0.05, elevMax: 40, elevMin: -8 };
  }
  if (P.ant) antenna(h, P.ant[0], P.ant[1], P.ant[2], P.ant[3] || 2.0);
  if (P.star) redStar(h, P.hw / 2 + 0.03, P.star[0], P.star[1], 0.16, { r: [0, 90, 0] });
  if (P.extra) P.extra(m, h, t, gun, bar);
  return { h, t, gun, bar };
}
function ifvDef(id, name, side, era, game, spec, P, fx) { reg({ id, name, side, cat: P.cat || 'IFV / APC', era, fx: fx || 'ifv', game, spec, build(m) { return veh(m, P); } }); }
const G = { col: COL.nato, dk: COL.natoDk }, S = { col: COL.sovg, dk: COL.sovdk }, DS = { col: COL.tan, dk: COL.brown };
const sq = (z0, z1, w, h, y, n) => [{ z: z0, w: w * .8, h: h * .6, y: y * .85, n: n || 3, flat: 1 }, { z: z0 + (z1 - z0) * .15, w: w, h: h, y: y, n: n || 3, flat: 1 }, { z: z1 - (z1 - z0) * .15, w: w, h: h, y: y, n: n || 3, flat: 1 }, { z: z1, w: w * .7, h: h * .6, y: y * .85, n: n || 3, flat: 1 }];

/* M113 */
ifvDef('m113', 'M113 APC', 'NATO', '1975', ['m113', 'mech', 'inf'], { Role: 'Armoured personnel carrier', Crew: '2 + 11', Mass: '11 t', Armament: '12.7 mm M2HB', Speed: '66 km/h' },
  Object.assign({}, G, { tr: { x: 1.1, tw: .38, rw: .27, nw: 5, zr: -1.55, zf: 1.05, sp: { z: -2.5, y: .5, r: .28 }, id: { z: 2.25, y: .5, r: .27 }, rollers: 0, rr: .08, rollY: .9 },
    hull: [[-2.6, .45], [2.0, .45], [2.7, .8], [2.7, 1.0], [2.2, 1.7], [-2.6, 1.8]], hw: 2.2, hatchz: -0.8, hx: -0.3, hy: 1.8,
    rws: [0.35, 1.8, -0.2], boxes: [[0, 1.82, 0.9, 1.6, .06, 1.6, COL.natoDk]], extra(m, h) { h.box(0.4, 1.85, -1.6, 0.3, 0.2, 0.3, { c: COL.dkgrey }); } }));
/* BMP-1 / BMP-2 / BMP-3 style */
function bmp(id, name, era, game, gunL, big) {
  ifvDef(id, name, 'PACT', era, game, { Role: 'Infantry fighting vehicle', Crew: '3 + 7', Mass: big ? '18.7 t' : '14 t', Armament: big ? '100 mm + 30 mm' : (gunL > 2 ? '30 mm 2A42' : '73 mm 2A28'), Speed: '65 km/h' },
    Object.assign({}, S, { tr: { x: 1.4, tw: .38, rw: .3, nw: 6, zr: -1.7, zf: 1.5, sp: { z: -2.8, y: .52, r: .3 }, id: { z: 2.7, y: .5, r: .27 }, rollers: 0, rr: .08, rollY: .9 },
      hull: [[-3.0, .45], [2.2, .45], [3.0, .75], [3.1, 1.1], [1.6, 1.5], [-3.0, 1.5]], hw: 2.6, tur: { pivot: [0, 1.5, 0.1], secs: sq(-.8, .9, 1.7, .7, .35, 2.6), hatch: [-.5, .7, -.2] },
      gun: { pivot: [0, .4, .8], L: gunL, r: big ? .06 : .045, brake: 0.12, mg: .2 }, hatchz: 1.9, hy: 1.35, star: [1.0, 0], extra(m, h, t) { if (big) t.cyl(0.4, 0.32, 0.5, .04, 0.5, { c: COL.black, n: 6 }); t.cyl(0, .6, .6, .22, .1, { ax: 'y', c: COL.sovdk, n: 10 }); smokeBank(t, 0.8, 0.4, -0.5, 3, { yaw: 20 }); } }));
}
bmp('bmp1', 'BMP-1', '1975', ['mot', 'btr'], 2.4, false);
bmp('bmp2', 'BMP-2', 'modern', ['r_btr'], 2.8, false);
bmp('bmp3', 'BMP-3', 'modern', [], 3.2, true);
/* MT-LB */
ifvDef('mtlb', 'MT-LB', 'PACT', '1975', ['party'], { Role: 'Multi-purpose tracked carrier', Crew: '2 + 11', Mass: '12 t', Armament: '7.62 mm PKT', Speed: '61 km/h' },
  Object.assign({}, S, { tr: { x: 1.3, tw: .38, rw: .28, nw: 6, zr: -1.9, zf: 1.7, sp: { z: -3.0, y: .5, r: .3 }, id: { z: 2.9, y: .5, r: .27 }, rollers: 0 }, hull: [[-3.1, .4], [2.4, .4], [3.1, .75], [3.1, 1.1], [2.5, 1.9], [-3.1, 2.0]], hw: 2.5, rws: [-.1, 2.0, 1.6], hatchz: -1.5, hy: 2.0 }));
/* Marder, Puma, CV90 */
ifvDef('marder', 'Marder 1A3', 'NATO', '1975', ['mech'], { Role: 'Infantry fighting vehicle', Crew: '3 + 6', Mass: '33 t', Armament: '20 mm Rh202', Speed: '65 km/h' },
  Object.assign({}, G, { tr: { x: 1.5, tw: .45, rw: .3, nw: 6, zr: -1.8, zf: 1.6, sp: { z: -2.9, y: .55, r: .32 }, id: { z: 2.8, y: .52, r: .3 }, rollers: 3, rr: .08, rollY: 1.0 }, hull: [[-3.0, .5], [2.2, .5], [3.0, .9], [3.1, 1.2], [2.0, 1.55], [-3.0, 1.6]], hw: 2.9, tur: { pivot: [0.4, 1.6, -0.3], secs: sq(-.9, .9, 1.4, .7, .35, 3), hatch: [.3, .7, -.3] }, gun: { pivot: [0, .35, .8], L: 1.6, r: .05, mg: .22 } }));
ifvDef('puma', 'Puma IFV', 'NATO', 'modern', ['m_puma'], { Role: 'Infantry fighting vehicle', Crew: '3 + 6', Mass: '31.5 t', Armament: '30 mm MK30-2 + Spike', Speed: '70 km/h' },
  Object.assign({}, G, { tr: { x: 1.5, tw: .45, rw: .3, nw: 6, zr: -1.9, zf: 1.6, sp: { z: -3.0, y: .55, r: .32 }, id: { z: 2.9, y: .5, r: .3 }, rollers: 0 }, hull: [[-3.1, .5], [2.2, .5], [3.1, .9], [3.1, 1.3], [1.8, 1.7], [-3.1, 1.75]], hw: 3.1, skirt: { y: .8, z: -.2, h: .9, d: 5.2 }, tur: { pivot: [0, 1.7, -.3], secs: sq(-1.0, 1.0, 1.6, .55, .28, 3.5) }, gun: { pivot: [0.0, .3, 1.0], L: 2.4, r: .04, mg: .2 }, extra(m, h, t) { t.box(.7, .5, -.2, .3, .35, .5, { c: COL.dkgrey }); } }));
ifvDef('cv90', 'CV90', 'NATO', 'modern', ['m_inf'], { Role: 'Infantry fighting vehicle', Crew: '3 + 7', Mass: '35 t', Armament: '40 mm Bofors L/70', Speed: '70 km/h' },
  Object.assign({}, G, { tr: { x: 1.5, tw: .45, rw: .3, nw: 6, zr: -2.0, zf: 1.7, sp: { z: -3.1, y: .55, r: .32 }, id: { z: 3.0, y: .5, r: .3 }, rollers: 0 }, hull: [[-3.2, .5], [2.2, .5], [3.2, .9], [3.3, 1.2], [1.9, 1.7], [-3.2, 1.8]], hw: 3.1, tur: { pivot: [0, 1.75, -.3], secs: sq(-1.2, 1.0, 1.8, .6, .3, 3.2) }, gun: { pivot: [0, .3, 1.0], L: 2.6, r: .05, brake: .15, mg: .22 } }));
/* wheeled APC */
function whl(id, name, side, era, game, spec, P, fx) { ifvDef(id, name, side, era, game, spec, P, fx); }
const wz = (n, z0, z1) => Array.from({ length: n }, (_, i) => z0 + (z1 - z0) * (n === 1 ? .5 : i / (n - 1)));
whl('btr', 'BTR-60PB', 'PACT', '1975', ['btr'], { Role: 'Armoured personnel carrier 8×8', Crew: '2 + 14', Mass: '10 t', Armament: '14.5 mm KPVT', Speed: '80 km/h' },
  Object.assign({}, S, { wh: { x: 1.15, r: .5, w: .35, zs: wz(4, -2.0, 1.6) }, hull: [[-3.3, .55], [3.2, .55], [3.6, 1.0], [3.4, 1.5], [2.0, 1.9], [-3.1, 1.9], [-3.3, 1.4]], hw: 2.4, tur: { pivot: [0, 1.9, 0.6], secs: sq(-.5, .6, 1.1, .55, .27, 3.5) }, gun: { pivot: [0, .27, .5], L: 1.8, r: .045 }, hatchz: 1.2, hy: 1.8 }));
whl('btr82', 'BTR-82A', 'PACT', 'modern', ['r_btr'], { Role: 'Armoured personnel carrier 8×8', Crew: '3 + 7', Mass: '15 t', Armament: '30 mm 2A72', Speed: '80 km/h' },
  Object.assign({}, S, { wh: { x: 1.4, r: .52, w: .4, zs: wz(4, -2.2, 1.9) }, hull: [[-3.5, .6], [3.4, .6], [3.9, 1.1], [3.7, 1.6], [2.2, 2.0], [-3.3, 2.05], [-3.5, 1.5]], hw: 2.8, tur: { pivot: [0, 2.0, .6], secs: sq(-.7, .7, 1.4, .6, .3, 3.3) }, gun: { pivot: [0, .3, .7], L: 2.0, r: .045, mg: .2 }, hatchz: -1, hy: 2.0 }));
whl('brdm', 'BRDM-2', 'PACT', '1975', ['brdm', 'recon'], { Role: 'Amphibious scout car', Crew: '4', Mass: '7 t', Armament: '14.5 mm KPVT', Speed: '95 km/h' },
  Object.assign({}, S, { wh: { x: 1.1, r: .43, w: .3, zs: wz(2, -1.4, 1.4) }, hull: [[-2.9, .5], [2.9, .5], [3.2, .9], [3.1, 1.3], [1.8, 1.7], [-2.9, 1.7]], hw: 2.1, tur: { pivot: [0, 1.7, .5], secs: sq(-.5, .5, 1.0, .45, .22, 3.4) }, gun: { pivot: [0, .22, .4], L: 1.6, r: .04 }, extra(m, h) { h.mir(() => h.wheel(1.1, .3, -.3, .3, .2)); } }));
whl('boxer', 'Boxer', 'NATO', 'modern', ['m_boxer'], { Role: 'Armoured transport 8×8', Crew: '3 + 8', Mass: '36 t', Armament: 'RCT30 / RWS', Speed: '103 km/h' },
  Object.assign({}, G, { wh: { x: 1.4, r: .55, w: .4, zs: wz(4, -2.4, 1.8) }, hull: [[-3.9, .65], [3.4, .65], [3.9, 1.2], [3.7, 1.7], [2.2, 2.1], [-3.8, 2.2]], hw: 2.9, rws: [0.3, 2.2, .8], hatchz: -1.5, hy: 2.2 }));
whl('stryker', 'M1126 Stryker', 'NATO', 'modern', ['m_stryker'], { Role: 'Armoured vehicle 8×8', Crew: '2 + 9', Mass: '19 t', Armament: '12.7 mm M2 RWS', Speed: '97 km/h' },
  Object.assign({}, DS, { wh: { x: 1.3, r: .5, w: .4, zs: wz(4, -2.2, 1.7) }, hull: [[-3.5, .6], [3.1, .6], [3.5, 1.0], [3.4, 1.5], [2.0, 1.9], [-3.5, 2.2]], hw: 2.7, rws: [0.4, 2.2, -.2], skirt: { y: .9, z: -.2, h: .8, d: 5.5 } }));
whl('fennek', 'Fennek', 'NATO', 'modern', ['m_recon'], { Role: 'Reconnaissance vehicle', Crew: '3', Mass: '10 t', Armament: 'MG3 / sensor mast', Speed: '115 km/h' },
  Object.assign({}, DS, { wh: { x: 1.0, r: .42, w: .3, zs: wz(2, -1.3, 1.3) }, hull: [[-2.8, .5], [2.8, .5], [3.1, .9], [2.7, 1.4], [1.5, 1.7], [-2.7, 1.7]], hw: 1.9, rws: [0, 1.7, 0.8], extra(m, h) { h.cyl(0, 2.05, -1.2, 0.07, 0.8, { ax: 'y', c: COL.dkgrey, n: 8 }); h.sph(0, 2.5, -1.2, .12, { c: COL.glass, m: 3 }); } }));
whl('recon', 'BRDM-3 / R-recon', 'PACT', 'modern', ['r_recon'], { Role: 'Reconnaissance vehicle', Crew: '3', Mass: '7 t', Armament: '14.5 mm', Speed: '100 km/h' },
  Object.assign({}, S, { wh: { x: 1.1, r: .43, w: .3, zs: wz(2, -1.4, 1.4) }, hull: [[-2.9, .5], [2.9, .5], [3.2, .9], [3.1, 1.3], [1.8, 1.7], [-2.9, 1.7]], hw: 2.1, tur: { pivot: [0, 1.7, .5], secs: sq(-.5, .5, 1.0, .45, .22, 3.4) }, gun: { pivot: [0, .22, .4], L: 1.5, r: .04 } }));
whl('dingo', 'Fuchs / Dingo', 'NATO', '1975', ['cav'], { Role: 'Wheeled carrier 6×6', Crew: '2 + 10', Mass: '19 t', Armament: 'MG3', Speed: '105 km/h' },
  Object.assign({}, G, { wh: { x: 1.3, r: .5, w: .38, zs: wz(3, -2.0, 1.8) }, hull: [[-3.5, .6], [3.2, .6], [3.6, 1.0], [3.4, 1.5], [2.2, 1.95], [-3.5, 2.1]], hw: 2.7, rws: [.4, 2.1, 1.0], hatchz: -1.5, hy: 2.1 }));
whl('fpv', 'FPV Drone Team', 'NATO', 'modern', ['m_fpv'], { Role: 'Light vehicle w/ FPV launcher', Crew: '3', Mass: '3 t', Armament: 'FPV loitering munition', Speed: '130 km/h' },
  Object.assign({}, DS, { wh: { x: 0.95, r: .4, w: .26, zs: wz(2, -1.3, 1.3) }, hull: [[-2.3, .5], [2.2, .5], [2.5, .9], [2.0, 1.3], [.5, 1.7], [-2.3, 1.7]], hw: 1.7, cat: 'Drones' }));
