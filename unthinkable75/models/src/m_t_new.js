'use strict';
/* ===== additions requested by the game session (MODELS_TODO.md): E-2, transports, LHD ===== */
function propSet(m, h, P, r, blades) { // spinning propeller parts on the wing engines
  const wp = P.wing, list = []; let i = 0;
  for (const ex of (P.engx || [])) for (const sd of [1, -1]) {
    const y = -P.fh * .5 + (P.ey || 0), z = wp.z0 - (P.ez || 1) + (P.el || 3.5) / 2 + .15;
    const p = m.part('prop' + i, h, [ex * sd, y, z]); p.col(COL.black, 0);
    for (let b = 0; b < (blades || 2); b++) { p.push(); p.ro(0, 0, b * 180 / (blades || 2)); p.box(0, 0, 0, .2, r * 2, .06, { c: COL.black }); p.pop(); }
    p.cyl(0, 0, .12, .28, .4, { n: 8, c: COL.dkgrey, r1: .05 });
    list.push({ part: p, ax: 2, rate: 1400 }); i++;
  }
  return list;
}
function acNew(id, name, side, era, spec, P, fx, turbo) {
  reg({ id, name, side, cat: 'Aircraft', era, fx: fx || 'plane', game: P.game || [id], spec, cdist: 2.7, caz: 40, cel: 14,
    build(m) {
      heavy(m, P); const h = m.find('hull'); const spins = [];
      if (turbo) spins.push(...propSet(m, h, P, turbo.r, turbo.n));
      const rd = m.find('rotodome'); if (rd) spins.push({ part: rd, ax: 1, rate: 70 });
      if (spins.length) spinner(m, spins);
      m.anchor('belly', m.root, [0, -(P.fh || 1.5) * .5, 0], [0, 0, 1]);
    } });
}
function ramp(h, z, w, fh, c) { h.box(0, -fh * .32, z, w, .12, 3.4, { c: c || COL.dkgrey }); }
function hawkeyeExtra(m, h, P) {
  const r = m.part('rotodome', h, [0, P.fh * .5 + 1.1, -1.2]); r.col(COL.ltgrey, 0); r.cyl(0, 0, 0, 3.7, .55, { ax: 'y', n: 20 }); r.cyl(0, .35, 0, 3.5, .2, { ax: 'y', n: 20, c: COL.dkgrey });
  h.box(.5, P.fh * .5 + .4, -1.2, .25, 1.3, 1.1, { c: COL.dkgrey }); h.box(-.5, P.fh * .5 + .4, -1.2, .25, 1.3, 1.1, { c: COL.dkgrey });
  finPart(h, { x: 2.7, y0: P.fh * .3, zr: -7.2, rc: 3.2, tc: 1.4, h: 3.6, sw: 1.2, t: .12 }); // outer twin fins (centre ones come from P.fin)
  h.box(0, -P.fh * .55, 2.5, .3, .5, 4.5, { c: COL.dkgrey }); // arrester hook / belly
  h.col(COL.glass, 3); h.box(0, P.fh * .22, P.L * .42, P.fw * .55, .3, .8, { c: COL.glass, m: 3 });
}
/* E-2 Hawkeye + E-2D */
acNew('e2', 'E-2C Hawkeye', 'NATO', '1975', { Role: 'Carrier AEW', Crew: '5', 'Max speed': '650 km/h', Radar: 'APS-125', Length: '17.5 m' },
  { col: AC.lgrey, L: 17.5, fw: 2.2, fh: 2.4, wy: 1.1, wing: SW(1.4, 3.3, 2.4, 11.2, 1.0, 1.0), tail: SW(-7.4, 2.6, 1.6, 5.6, .8, .4), ty: 1.2, fin: { x: 1.4, zr: -7.4, rc: 3.0, tc: 1.4, h: 3.4, sw: 1.0, y0: .5 }, engx: [3.8], er: .6, el: 3.6, ez: 1.0, ey: 1.6, extra(m, h) { hawkeyeExtra(m, h, { fh: 2.4, fw: 2.2, L: 17.5 }); } }, 'awacs', { r: 1.9, n: 4 });
acNew('e2d', 'E-2D Advanced Hawkeye', 'NATO', 'modern', { Role: 'Carrier AEW', Crew: '5', 'Max speed': '650 km/h', Radar: 'AN/APY-9 (UHF)', Length: '17.6 m' },
  { col: AC.dgrey, L: 17.6, fw: 2.2, fh: 2.4, wy: 1.1, wing: SW(1.4, 3.3, 2.4, 12.4, 1.0, 1.0), tail: SW(-7.4, 2.6, 1.6, 5.6, .8, .4), ty: 1.2, fin: { x: 1.4, zr: -7.4, rc: 3.0, tc: 1.4, h: 3.4, sw: 1.0, y0: .5 }, engx: [4.2], er: .65, el: 3.8, ez: 1.0, ey: 1.6, extra(m, h) { hawkeyeExtra(m, h, { fh: 2.4, fw: 2.2, L: 17.6 }); h.cyl(0, 1.5, 7.2, .25, .9, { n: 8, ax: 'y', c: COL.dkgrey }); } }, 'awacs', { r: 2.0, n: 8 });
/* transports */
acNew('c130', 'C-130H Hercules', 'NATO', '1975', { Role: 'Tactical airlifter', Crew: '5', 'Max speed': '590 km/h', Payload: '19 t', Length: '29.8 m' },
  { col: AC.grey, L: 29.8, fw: 3.2, fh: 3.2, wy: 1.5, prof: [[-.5, .1, .35], [-.45, .35, .6], [-.3, .75, .9], [-.2, 1, 1], [.3, 1, 1], [.42, .75, .8], [.5, .2, .3]], wing: SW(3.0, 3.8, 3.2, 20.0, 2.0, 1.6), tail: SW(-13.0, 3.2, 1.6, 7.4, 1.0, 0.5), ty: 3.8, fin: { zr: -12.4, rc: 6.0, tc: 2.4, h: 6.4, sw: 3.0, y0: 1.3 }, engx: [5.2, 10.2], er: .6, el: 3.2, ez: 1.4, ey: 2.6, extra(m, h) { ramp(h, -14, 2.6, 3.2); h.col(COL.glass, 3); h.box(0, 1.2, 12.5, 2.4, .5, 1.2, { c: COL.glass, m: 3 }); } }, 'plane', { r: 2.1, n: 4 });
acNew('m_c130', 'A400M Atlas / C-130J', 'NATO', 'modern', { Role: 'Strategic / tactical airlifter', Crew: '3', 'Max speed': '780 km/h', Payload: '37 t', Length: '45.1 m' },
  { game: ['m_c130'], col: AC.lgrey, L: 45.1, fw: 4.8, fh: 4.9, wy: 2.0, prof: [[-.5, .1, .35], [-.45, .35, .6], [-.3, .75, .9], [-.2, 1, 1], [.3, 1, 1], [.43, .75, .8], [.5, .2, .3]], wing: SW(5.0, 6.5, 3.0, 21.0, 7.0, 2.4), tail: SW(-21.0, 5.0, 2.0, 8.0, 3.0, .4), ty: 10.6, fin: { zr: -20.0, rc: 8.0, tc: 3.0, h: 9.5, sw: 5.0, y0: 2.0 }, engx: [6.8, 13.4], er: .75, el: 3.4, ez: 1.6, ey: 3.8, extra(m, h) { ramp(h, -21.5, 3.6, 4.9); } }, 'plane', { r: 2.7, n: 8 });
acNew('an12', 'An-12 Cub', 'PACT', '1975', { Role: 'Military transport', Crew: '5', 'Max speed': '670 km/h', Payload: '20 t', Length: '33.1 m' },
  { col: AC.sov, L: 33.1, fw: 3.6, fh: 3.8, wy: 1.6, prof: [[-.5, .08, .3], [-.46, .3, .5], [-.3, .75, .9], [-.2, 1, 1], [.3, 1, 1], [.42, .75, .8], [.5, .2, .3]], wing: SW(3.6, 4.2, 3.0, 19.6, 2.0, 1.8), tail: SW(-14.0, 3.0, 1.6, 7.0, 1.0, .4), ty: 3.6, fin: { zr: -13.4, rc: 6.4, tc: 2.4, h: 7.2, sw: 3.4, y0: 1.5 }, engx: [5.6, 10.8], er: .62, el: 3.4, ez: 1.4, ey: 2.8, extra(m, h) { ramp(h, -15.5, 3.0, 3.8); h.col(AC.dgrey, 0); h.sph(0, 1.0, -16.3, 1.0, { c: COL.dkgrey }); h.box(0, .2, -16.6, .2, .2, 1.4, { c: COL.black }); } }, 'plane', { r: 2.2, n: 4 });
acNew('r_il76', 'Il-76MD Candid', 'PACT', 'modern', { Role: 'Strategic airlifter', Crew: '5', 'Max speed': '850 km/h', Payload: '48 t', Length: '46.6 m' },
  { col: AC.sov, L: 46.6, fw: 4.8, fh: 4.9, wy: 2.0, prof: [[-.5, .1, .3], [-.45, .35, .6], [-.3, .75, .9], [-.2, 1, 1], [.3, 1, 1], [.43, .7, .8], [.5, .15, .25]], wing: SW(5.0, 6.8, 3.0, 25.0, 9.0, 2.4), tail: SW(-21.5, 5.4, 2.2, 8.4, 4.0, .4), ty: 11.0, fin: { zr: -20.5, rc: 8.0, tc: 3.0, h: 10.0, sw: 6.0, y0: 2.0 }, engx: [7.5, 13.5], er: 1.0, el: 4.0, ez: 1.6, ey: 3.8, extra(m, h) { ramp(h, -22, 3.6, 4.9); h.sph(0, 1.2, -23.3, 1.1, { c: COL.dkgrey }); } }, 'plane');
/* LHD (Wasp-class), mapped to the game's m_lhd */
SHP('wasp', 'USS Wasp (LHD-1)', 'NATO', 'Warships', 'modern', ['m_lhd'], { Role: 'Amphibious assault ship', Length: '257 m', Displacement: '41,000 t', Aircraft: 'F-35B / MV-22 / helicopters', Speed: '22 kn' },
  { L: 257, B: 32, fb: 13, dr: 8.1, hull: 0x6a7782, speed: 12, carrier: { over: 0, islandX: 14, islandZ: .12, planes: 6 }, ciws: [.38, -.4] });
