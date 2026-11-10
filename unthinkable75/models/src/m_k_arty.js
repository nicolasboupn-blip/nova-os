'use strict';
/* ===== artillery, rocket launchers, mortars ===== */
/* rocket pod: part 'gun' (pitch) with rows×cols tubes; anchors r0..rn on the pod. returns pod part */
function rocketPod(m, parent, pivot, o) {
  const pod = m.part('gun', parent, pivot); pod.col(o.c || COL.dkgrey, 1); const w = o.cols * o.sp, h = o.rows * o.sp;
  pod.box(0, 0, o.len / 2, w + .1, h + .1, o.len, { c: o.c || COL.dkgrey });
  let k = 0;
  for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) {
    const x = (c - (o.cols - 1) / 2) * o.sp, y = (r - (o.rows - 1) / 2) * o.sp;
    pod.cyl(x, y, o.len + .01, o.sp * .42, .05, { c: COL.black, n: 8 }); m.anchor('r' + (k++), pod, [x, y, o.len], [0, 0, 1]);
  }
  m.nRockets = k; m.anchor('muzzle', pod, [0, 0, o.len], [0, 0, 1]); m.podOf = pod; m.tankProf = { recoil: 0, elevMax: o.em || 60, elevMin: 0 };
  return pod;
}
function elevPivot(m, parent, pivot) { return m.part('gun', parent, pivot); }
const TR = (x, nw, zr, zf, spz, idz, rr, sy) => ({ x, tw: .55, rw: .33, nw, zr, zf, sp: { z: spz, y: sy || .6, r: .36 }, id: { z: idz, y: .55, r: .32 }, rollers: rr || 0, rr: .1, rollY: 1.0 });
function spg(id, name, side, era, game, spec, P) { ifvDef(id, name, side, era, game, spec, Object.assign({ cat: 'Artillery' }, P), 'spg'); }
/* tracked SPGs */
spg('m109', 'M109A6 Paladin', 'NATO', 'modern', ['arty', 'm_pzh'], { Role: 'Self-propelled howitzer', Crew: '4', Mass: '28 t', Gun: '155 mm L39', Range: '30 km', Speed: '56 km/h' },
  Object.assign({}, G, { tr: TR(1.45, 7, -2.0, 1.7, -3.2, 3.0), hull: [[-3.2, .5], [2.6, .5], [3.0, .9], [3.0, 1.5], [1.4, 1.7], [-3.2, 1.9]], hw: 2.8, tur: { pivot: [0, 1.8, -.3], secs: sq(-1.8, 1.8, 3.0, 1.3, .65, 3.0), hatch: [.8, 1.25, -.8] }, gun: { pivot: [0, .6, 1.8], L: 5.5, r: .11, evac: 0, brake: .35, rec: .6 }, extra(m, h, t) { t.box(0, .55, -1.9, 2.4, .8, .3, { c: COL.natoDk }); h.box(0, 1.1, 3.1, 2.4, .3, .4, { c: COL.natoDk }); } }));
spg('pzh', 'PzH 2000', 'NATO', 'modern', ['m_pzh'], { Role: 'Self-propelled howitzer', Crew: '5', Mass: '55 t', Gun: '155 mm L52', Range: '40 km', Speed: '60 km/h' },
  Object.assign({}, G, { tr: TR(1.6, 7, -2.1, 1.9, -3.4, 3.2, 3), hull: [[-3.5, .5], [2.8, .5], [3.3, .9], [3.3, 1.5], [1.6, 1.8], [-3.5, 1.95]], hw: 3.0, tur: { pivot: [0, 1.9, -.6], secs: sq(-1.9, 2.0, 3.0, 1.2, .6, 3), hatch: [-.8, 1.2, -.5] }, gun: { pivot: [0, .6, 2.0], L: 7.6, r: .1, evac: .45, brake: .45, rec: .8 } }));
spg('k9', 'K9 Thunder', 'NATO', 'modern', [], { Role: 'Self-propelled howitzer', Crew: '5', Mass: '47 t', Gun: '155 mm L52', Range: '40 km', Speed: '67 km/h' },
  Object.assign({}, G, { tr: TR(1.55, 6, -2.0, 1.7, -3.3, 3.0), hull: [[-3.4, .5], [2.7, .5], [3.2, .9], [3.2, 1.4], [1.6, 1.7], [-3.4, 1.9]], hw: 3.0, tur: { pivot: [0, 1.9, -.5], secs: sq(-1.9, 1.9, 3.0, 1.2, .6, 3), hatch: [-.8, 1.2, -.5] }, gun: { pivot: [0, .6, 1.9], L: 7.4, r: .1, evac: .4, brake: .45, rec: .8 } }));
spg('msta', '2S19 Msta-S', 'PACT', 'modern', ['r_msta'], { Role: 'Self-propelled howitzer', Crew: '5', Mass: '42 t', Gun: '152 mm 2A64', Range: '29 km', Speed: '60 km/h' },
  Object.assign({}, S, { tr: TR(1.6, 6, -2.0, 1.7, -3.3, 3.2), hull: [[-3.4, .5], [2.7, .5], [3.3, .9], [3.3, 1.5], [1.6, 1.75], [-3.4, 1.95]], hw: 3.0, tur: { pivot: [0, 1.95, -.2], secs: sq(-2.0, 1.8, 3.1, 1.4, .7, 3), hatch: [.8, 1.4, -.8] }, gun: { pivot: [0, .6, 1.8], L: 7.0, r: .11, evac: .4, brake: .4, rec: .7 }, star: [1.0, 0.8] }));
spg('2s1', '2S1 Gvozdika', 'PACT', '1975', ['arty'], { Role: 'Self-propelled howitzer', Crew: '4', Mass: '16 t', Gun: '122 mm 2A31', Range: '15 km', Speed: '60 km/h' },
  Object.assign({}, S, { tr: { x: 1.3, tw: .38, rw: .3, nw: 7, zr: -2.0, zf: 1.6, sp: { z: -2.9, y: .5, r: .3 }, id: { z: 2.7, y: .5, r: .27 }, rollers: 0 }, hull: [[-3.0, .45], [2.2, .45], [3.0, .8], [3.0, 1.2], [1.8, 1.4], [-3.0, 1.5]], hw: 2.6, tur: { pivot: [0, 1.5, -.5], secs: sq(-1.3, 1.1, 2.4, 1.0, .5, 2.6), hatch: [-.5, .95, -.4] }, gun: { pivot: [0, .5, 1.1], L: 3.6, r: .075, evac: .5, brake: .25, rec: .35 }, star: [1.0, 0] }));
spg('m110', 'M110A2', 'NATO', '1975', ['arty'], { Role: 'Self-propelled howitzer (open)', Crew: '5 + 8', Mass: '28 t', Gun: '203 mm M201', Range: '30 km', Speed: '54 km/h' },
  Object.assign({}, G, { tr: TR(1.4, 5, -1.8, 1.3, -2.9, 2.7), hull: [[-3.0, .5], [2.5, .5], [2.9, .9], [2.9, 1.3], [1.5, 1.6], [-3.0, 1.6]], hw: 2.6, tur: { pivot: [0, 1.6, -1.8], poly: [[-.9, 0], [-1.0, .7], [1.0, .7], [1.2, 0]], w: 2.3 }, gun: { pivot: [0, .5, .6], L: 6.2, r: .13, brake: 0, rec: .8 }, extra(m, h, t) { h.box(0, 1.8, -2.5, 2.2, .3, .8, { c: COL.natoDk }); h.box(0, .9, -3.1, 2.0, .3, .3, { c: COL.dkgrey }); } }));
/* Archer (wheeled) */
spg('archer', 'Archer', 'NATO', 'modern', [], { Role: 'Wheeled self-propelled howitzer 6×6', Crew: '3', Mass: '30 t', Gun: '155 mm L52', Range: '50 km', Speed: '70 km/h' },
  Object.assign({}, G, { wh: { x: 1.3, r: .62, w: .45, zs: wz(3, -3.2, 2.2), hub: COL.dkgrey }, hull: [[-4.9, .8], [3.4, .8], [3.8, 1.2], [3.8, 2.4], [2.6, 2.7], [1.6, 2.7], [1.6, 1.8], [-4.9, 1.8]], hw: 2.6, tur: { pivot: [0, 1.9, -2.5], secs: sq(-1.4, 1.2, 2.2, 1.2, .6, 3) }, gun: { pivot: [0, .7, 0.9], L: 7.0, r: .1, evac: .45, brake: .4, rec: .8 } }));
/* rocket / MLRS tracked & wheeled */
function mlrs(id, name, side, era, game, spec, P, pod) { ifvDef(id, name, side, era, game, spec, Object.assign({ cat: 'Rocket artillery' }, P, { extra(m, h) { rocketPod(m, h, pod.pivot, pod); const t = m.part('turret', h, [0, 0, 0]); P.extra && P.extra(m, h); } }), 'mlrs'); }
mlrs('mlrs', 'M270 MLRS', 'NATO', 'modern', [], { Role: 'Multiple launch rocket system', Crew: '3', Mass: '25 t', Rockets: '12 × 227 mm GMLRS', Range: '70 km', Speed: '64 km/h' },
  Object.assign({}, G, { tr: TR(1.4, 6, -2.0, 1.4, -3.0, 2.8), hull: [[-3.4, .5], [2.6, .5], [3.0, .9], [3.0, 1.4], [1.0, 1.9], [-3.4, 1.7]], hw: 2.6 }), { pivot: [0, 2.0, -2.8], cols: 2, rows: 6, sp: .38, len: 4.0, c: COL.natoDk, em: 60 });
mlrs('himars', 'M142 HIMARS', 'NATO', 'modern', ['m_himars'], { Role: 'High-mobility rocket system 6×6', Crew: '3', Mass: '16 t', Rockets: '6 × GMLRS / 1 × ATACMS', Range: '70–300 km', Speed: '85 km/h' },
  Object.assign({}, G, { wh: { x: 1.2, r: .6, w: .42, zs: wz(3, -3.0, 1.8) }, hull: [[-4.6, .7], [3.0, .7], [3.4, 1.1], [3.4, 2.4], [2.3, 2.6], [1.3, 2.6], [1.3, 1.6], [-4.6, 1.6]], hw: 2.4 }), { pivot: [0, 1.9, -2.2], cols: 3, rows: 2, sp: .45, len: 4.0, c: COL.natoDk, em: 60 });
mlrs('bm21', 'BM-21 Grad', 'PACT', '1975', ['arty'], { Role: 'Multiple launch rocket system 6×6', Crew: '4', Mass: '13.7 t', Rockets: '40 × 122 mm', Range: '20 km', Speed: '75 km/h' },
  Object.assign({}, S, { wh: { x: 1.2, r: .6, w: .4, zs: wz(3, -3.0, 1.6) }, hull: [[-4.0, .7], [3.2, .7], [3.5, 1.1], [3.4, 2.5], [2.5, 2.7], [1.5, 2.7], [1.5, 1.7], [-4.0, 1.5]], hw: 2.4 }), { pivot: [0, 2.0, -1.6], cols: 8, rows: 5, sp: .17, len: 3.0, c: COL.sovdk, em: 55 });
mlrs('tornado', 'Tornado-S', 'PACT', 'modern', ['r_tornado'], { Role: 'Multiple launch rocket system 8×8', Crew: '3', Mass: '30 t', Rockets: '12 × 300 mm', Range: '120 km', Speed: '80 km/h' },
  Object.assign({}, S, { wh: { x: 1.4, r: .62, w: .45, zs: wz(4, -3.8, 2.6) }, hull: [[-5.6, .8], [3.8, .8], [4.2, 1.2], [4.2, 2.6], [3.0, 2.9], [1.8, 2.9], [1.8, 1.7], [-5.6, 1.7]], hw: 2.6 }), { pivot: [0, 2.0, -3.0], cols: 4, rows: 3, sp: .42, len: 6.5, c: COL.sovdk, em: 55 });
mlrs('tos1', 'TOS-1A Solntsepyok', 'PACT', 'modern', ['r_tos'], { Role: 'Heavy flamethrower rocket system', Crew: '3', Mass: '46 t', Rockets: '24 × 220 mm thermobaric', Range: '6 km', Speed: '60 km/h' },
  Object.assign({}, S, { tr: TR(1.5, 6, -2.1, 1.8, -3.2, 3.0), hull: [[-3.3, .5], [2.6, .5], [3.3, .9], [3.3, 1.2], [2.0, 1.45], [-3.3, 1.4]], hw: 2.7 }), { pivot: [0, 1.9, 1.1], cols: 6, rows: 4, sp: .3, len: 3.7, c: COL.sovdk, em: 45 });
/* towed howitzers */
function towed(m, P) {
  const h = m.part('hull'); h.col(P.col, 0);
  const ax = P.axle || 0;
  h.mir(() => { h.wheel(P.wx || 1.25, P.wr || .5, ax, P.wr || .5, .35, { hub: COL.dkgrey }); h.cyl(0.6, .55, ax, .06, 1.3, { ax: 'x', c: COL.dkgrey, n: 8 }); });
  h.box(0, .55, ax, 2.6, .12, .2, { c: COL.dkgrey });
  // trails
  for (const s of [-1, 1]) { h.push(); h.tr(s * .3, .55, ax - .2); h.ro(0, s * -P.spread || 0, 0); h.box(0, 0, -P.trail / 2, .22, .24, P.trail, { c: P.dk }); h.box(0, -.28, -P.trail, .5, .1, .5, { c: COL.dkgrey }); h.pop(); }
  h.box(0, .75, ax + .4, .8, .35, .9, { c: P.dk }); // cradle block
  const gun = m.part('gun', h, [0, P.gy || 1.0, ax + .6]); const bar = m.part('barrel', gun, [0, 0, 0]); gun.col(P.col, 0); gun.box(0, -.05, 0.2, .45, .45, 1.0, { c: P.dk });
  bar.col(COL.dkgrey, 1); barrel(bar, { L: P.L, z0: .3, r0: P.r, r1: P.r * .78, evac: P.evac, brake: P.brake, x: 0, y: 0 });
  if (P.shield) { gun.box(0, .15, 1.0, 1.8, .9, .05, { c: P.dk }); }
  m.anchor('muzzle', bar, [0, 0, P.L + .45], [0, 0, 1]); m.tankProf = { recoil: .5, elevMax: 65, elevMin: -3 };
  gun.rot = [-(P.el0 || 8), 0, 0];
  return { h, gun, bar };
}
function tow(id, name, side, era, game, spec, P) { reg({ id, name, side, cat: 'Artillery', era, fx: 'spg', game, spec, build(m) { return towed(m, P); } }); }
tow('m777', 'M777 Howitzer', 'NATO', 'modern', ['arty', 'm_m777'], { Role: 'Towed howitzer', Crew: '5', Mass: '4.2 t', Gun: '155 mm L39', Range: '24–40 km', Note: 'Titanium and aluminium alloy construction.' }, { col: COL.olive, dk: COL.od, L: 5.0, r: .1, evac: 0, brake: .4, trail: 4.2, spread: 18, wr: .5, wx: 1.3, gy: 1.2, shield: false, el0: 10 });
tow('m198', 'M198 Howitzer', 'NATO', '1975', [], { Role: 'Towed howitzer', Crew: '9', Mass: '7.2 t', Gun: '155 mm L39', Range: '30 km' }, { col: COL.olive, dk: COL.od, L: 5.4, r: .12, evac: .45, brake: .4, trail: 4.6, spread: 20, wr: .55, wx: 1.5, gy: 1.3, el0: 8 });
tow('d30', 'D-30 Howitzer', 'PACT', '1975', ['arty'], { Role: 'Towed howitzer (3 trails)', Crew: '7', Mass: '3.2 t', Gun: '122 mm', Range: '15 km' }, { col: COL.sovg, dk: COL.sovdk, L: 4.2, r: .08, evac: .5, brake: .25, trail: 3.4, spread: 25, wr: .45, wx: 1.1, gy: 1.1, shield: true, el0: 6 });
function mortar(m, P) {
  const h = m.part('hull'); h.col(P.col, 0); h.box(0, .03, 0, 1.2, .06, 1.2, { c: COL.dkgrey }); h.cyl(0, .12, 0, .3, .1, { ax: 'y', c: COL.dkgrey, n: 12 });
  const gun = m.part('gun', h, [0, .15, 0]); const bar = m.part('barrel', gun, [0, 0, 0]); gun.rot = [-72, 0, 0];
  bar.col(COL.dkgrey, 1); bar.cyl(0, 0, P.L / 2, P.r, P.L, { n: 12, c: COL.dkgrey }); bar.cyl(0, 0, .05, P.r * 1.5, .15, { c: COL.black, n: 10 });
  gun.col(P.col, 0); h.push(); for (const s of [-1, 1]) { h.tr(0, 0, 0); } h.pop();
  h.box(.5, .55, .2, .05, 1.0, .05, { c: COL.dkgrey, r: [0, 0, 0] }); h.box(-.5, .55, .2, .05, 1.0, .05, { c: COL.dkgrey });
  m.anchor('muzzle', bar, [0, 0, P.L + .05], [0, 0, 1]); m.tankProf = { recoil: .1, elevMax: 85, elevMin: 45 };
}
reg({ id: 'mortar', name: 'M120 Mortar', side: 'NATO', cat: 'Artillery', era: '1975', fx: 'mortar', game: ['mortar', 'm_iris'].slice(0, 1), spec: { Role: 'Heavy mortar', Crew: '4', Mass: '145 kg', Calibre: '120 mm', Range: '7 km' }, build(m) { mortar(m, { col: COL.olive, L: 1.9, r: .07 }); } });
reg({ id: 'pmortar', name: 'M-43 Mortar', side: 'PACT', cat: 'Artillery', era: '1975', fx: 'mortar', game: ['pmortar'], spec: { Role: 'Heavy mortar', Crew: '4', Mass: '280 kg', Calibre: '120 mm', Range: '6 km' }, build(m) { mortar(m, { col: COL.sovg, L: 1.7, r: .07 }); } });
