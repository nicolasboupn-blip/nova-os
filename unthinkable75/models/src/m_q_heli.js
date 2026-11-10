'use strict';
/* ===== helicopters & drones ===== */
function spinner(m, list) { m.spins = list; m.tick2 = (t) => { const k = (m.rotSpeed === undefined ? 1 : m.rotSpeed); for (const s of m.spins) s.part.rot[s.ax] = (t * s.rate * k) % 360; }; }
function heli(m, P) {
  const h = m.part('hull'), L = P.L, fw = P.fw, fh = P.fh; h.off = [0, P.gh || .6, 0]; const spins = [];
  h.col(P.col, 0);
  const pr = P.prof || [[-.5, .3, .4], [-.4, .75, .8], [-.15, 1, 1], [.15, .95, .95], [.38, .6, .65], [.5, .1, .2]];
  h.lof(pr.map(s => ({ z: s[0] * L, w: s[1] * fw, h: s[2] * fh, y: 0, n: 2.2 })), { k: 16, cap0: true, cap1: true });
  // tail boom
  const bl = P.boom, bz0 = -L * .4; h.col(P.col, 0); h.cyl(0, P.by || fh * .1, bz0 - bl / 2, P.bh || .35, bl, { r1: (P.bh || .35) * .5, n: 10 });
  const tz = bz0 - bl;
  finPart(h, { y0: P.by || fh * .1, zr: tz + 1.0, rc: 1.6, tc: .8, h: P.finH || 1.6, sw: .9, t: .1 });
  wingPart(h, { y: (P.by || fh * .1) + .2, z0: tz + .8, rc: 1.0, tc: .5, half: 1.6, sw: .3, t: .08, x0: .1 });
  // canopy
  h.col(COL.glass, 3); h.sph(0, fh * .1, L * .22, fw * .42, { s: [1, P.cs || .9, P.cl || 1.8], c: COL.glass, m: 3 }); h.col(P.col, 0);
  // engine cowls
  h.box(0, fh * .5, -L * .05, fw * .7, fh * .3, L * .3, { c: P.dk || P.col });
  h.mir(() => h.cyl(fw * .22, fh * .55, -L * .22, .32, 1.3, { n: 10, c: COL.dkgrey }));
  // gear
  h.col(COL.dkgrey, 1);
  if (P.wheels) { h.cyl(0, -fh * .5 - .2, L * .3, .05, .5, { ax: 'y' }); h.wheel(0, -fh * .5 - .5, L * .3, .25, .15); h.mir(() => { h.cyl(fw * .4, -fh * .5 - .15, -L * .05, .06, .5, { ax: 'y' }); h.wheel(fw * .5, -fh * .5 - .5, -L * .05, .3, .2); }); }
  else h.mir(() => { h.cyl(fw * .45, -fh * .55, 0, .05, L * .7, { n: 6 }); h.cyl(fw * .4, -fh * .3, L * .18, .04, .5, { ax: 'y', n: 6 }); h.cyl(fw * .4, -fh * .3, -L * .18, .04, .5, { ax: 'y', n: 6 }); });
  // main rotor(s)
  const rotor = (name, pv, R, nb, rate, col) => { const r = m.part(name, h, pv); r.col(COL.dkgrey, 1); r.cyl(0, .1, 0, .22, .35, { ax: 'y', n: 10 }); r.cyl(0, -pv[1] / 2 + .1, 0, .12, pv[1], { ax: 'y', n: 8, c: COL.dkgrey }); r.col(col || COL.black, 0);
    for (let i = 0; i < nb; i++) { r.push(); r.ro(0, i * 360 / nb, 0); r.box(0, .2, R / 2 + .3, .28, .05, R, {}); r.pop(); } spins.push({ part: r, ax: 1, rate }); return r; };
  const mp = P.mast || [0, fh * .5 + .8, L * (P.mz || .02)];
  if (P.tandem) { rotor('rotor', [0, fh * .5 + 1.0, L * .33], P.R, 3, 300); rotor('rotor2', [0, fh * .5 + 1.9, -L * .32], P.R, 3, -300); }
  else { rotor('rotor', mp, P.R, P.blades || 4, 340); if (P.coax) rotor('rotor2', [mp[0], mp[1] + .8, mp[2]], P.R, 3, -340); }
  // tail rotor
  if (!P.tandem) { const tr = m.part('trotor', h, [.25, (P.by || fh * .1) + (P.finH || 1.6) * .4, tz + .4]); tr.col(COL.black, 0); for (let i = 0; i < 2; i++) { tr.push(); tr.ro(i * 90, 0, 0); tr.box(.0, 0, .0, .06, 1.8, .12, {}); tr.pop(); } spins.push({ part: tr, ax: 0, rate: 700 }); }
  // stub wings & weapon pods
  let k = 0; if (P.stub) { wingPart(h, { y: -fh * .05, z0: L * .02, rc: 1.5, tc: 1.3, half: P.stub, sw: 0, t: .12, x0: fw * .4 }); h.col(COL.olive, 0);
    for (const x of P.pods) { for (const sx of [-1, 1]) { h.cyl(sx * x, -fh * .25, L * .0, .22, 2.2, { n: 10, c: P.dk || COL.olive }); m.anchor('pod' + k, h, [sx * x, -fh * .25, L * .0 + 1.2], [0, 0, 1]); k++; } } }
  m.nPods = k; m.nAtgm = P.atgm || 0; if (P.atgm) for (let i = 0; i < P.atgm; i++) m.anchor('atgm' + i, h, [(i % 2 ? -1 : 1) * (P.stub ? P.stub * .8 + fw * .4 : fw * .6), -fh * .2, 0.5], [0, 0, 1]);
  if (P.gun) { h.col(COL.dkgrey, 1); h.cyl(0, -fh * .45, L * .36, .08, 1.0, { n: 8 }); m.anchor('muzzle', h, [0, -fh * .45, L * .36 + .55], [0, 0, 1]); }
  m.fl = { ab: false, spd: .5, bank: 18, heli: true }; m.nEng = 0;
  m.anchor('wt0', h, [fw, 0, -1], [0, 0, -1]); m.anchor('wt1', h, [-fw, 0, -1], [0, 0, -1]);
  spinner(m, spins); m.rotSpeed = 1;
  if (P.extra) P.extra(m, h);
}
const HL = (id, name, side, era, game, spec, P, fx) => reg({ id, name, side, cat: 'Helicopters', era, fx: fx || 'heli', game, spec, cdist: 2.4, caz: 40, cel: 16, build(m) { heli(m, P); } });
HL('ah1', 'AH-1 Cobra', 'NATO', '1975', ['ah1'], { Role: 'Attack helicopter', Crew: '2', 'Max speed': '277 km/h', Armament: 'M197 + TOW + rockets', 'Rotor Ø': '14.6 m' }, { col: COL.nato, dk: COL.natoDk, L: 13.6, fw: 1.0, fh: 1.9, prof: [[-.5, .3, .4], [-.4, .6, .8], [-.15, .9, 1], [.15, .7, .9], [.38, .4, .5], [.5, .1, .15]], boom: 6.5, R: 7.2, blades: 2, stub: 1.6, pods: [1.0, 1.7], atgm: 2, gun: true, finH: 2.0, cs: .6, cl: 2.4, mz: .0 });
HL('ah64', 'AH-64E Apache Guardian', 'NATO', 'modern', ['m_ah64'], { Role: 'Attack helicopter', Crew: '2', 'Max speed': '293 km/h', Armament: 'M230 30 mm + Hellfire + Hydra', 'Rotor Ø': '14.6 m' }, { col: COL.dkgrey, dk: COL.black, L: 14.9, fw: 1.9, fh: 1.9, boom: 6.2, R: 7.3, blades: 4, stub: 2.3, pods: [1.8, 2.8], atgm: 4, gun: true, finH: 2.2, cs: .75, cl: 2.0, mz: -.02 });
HL('mi24', 'Mi-24V Hind', 'PACT', '1975', ['mi24'], { Role: 'Attack / transport helicopter', Crew: '2 + 8', 'Max speed': '335 km/h', Armament: 'YakB 12.7 mm + Shturm + rockets', 'Rotor Ø': '17.3 m' }, { col: COL.sovg, dk: COL.sovdk, L: 17.5, fw: 2.2, fh: 2.0, boom: 6.2, R: 8.6, blades: 5, stub: 2.4, pods: [1.8, 3.0], atgm: 4, gun: true, finH: 2.2, cs: .5, cl: 1.6, wheels: true });
HL('ka52', 'Ka-52 Alligator', 'PACT', 'modern', ['r_ka52'], { Role: 'Attack helicopter (coaxial)', Crew: '2', 'Max speed': '300 km/h', Armament: '2A42 30 mm + Vikhr + S-8', 'Rotor Ø': '14.5 m' }, { col: COL.sovg, dk: COL.sovdk, L: 13.5, fw: 1.9, fh: 1.9, boom: 3.8, R: 7.2, coax: true, stub: 2.2, pods: [1.4, 2.4], atgm: 4, gun: true, finH: 1.6, cs: .6, cl: 1.5, mz: 0.1, wheels: true });
HL('mi28', 'Mi-28N Havoc', 'PACT', 'modern', ['r_mi28'], { Role: 'Attack helicopter', Crew: '2', 'Max speed': '300 km/h', Armament: '2A42 30 mm + Ataka + S-8', 'Rotor Ø': '17.2 m' }, { col: COL.sovg, dk: COL.sovdk, L: 17.0, fw: 1.8, fh: 1.9, boom: 6.0, R: 8.6, blades: 5, stub: 2.1, pods: [1.4, 2.4], atgm: 4, gun: true, finH: 2.0, cs: .6, cl: 1.8, wheels: true });
HL('mi8', 'Mi-8T Hip', 'PACT', '1975', ['mi8', 'r_mi8'], { Role: 'Transport helicopter', Crew: '3 + 24', 'Max speed': '260 km/h', Armament: 'S-5 pods (optional)', 'Rotor Ø': '21.3 m' }, { col: COL.sovg, dk: COL.sovdk, L: 18.2, fw: 2.5, fh: 2.6, prof: [[-.5, .3, .5], [-.4, .8, .95], [-.15, 1, 1], [.2, 1, 1], [.42, .7, .8], [.5, .15, .3]], boom: 7.0, R: 10.0, blades: 5, finH: 2.0, cs: 1.0, cl: 1.2, wheels: true, stub: 1.3, pods: [1.8], extra(m, h) { h.box(0, 0, -4, 1.6, 1.6, .05, { c: COL.dkgrey }); } }, 'htrans');
HL('uh1', 'UH-1H Huey', 'NATO', '1975', ['cav'], { Role: 'Utility helicopter', Crew: '2 + 11', 'Max speed': '205 km/h', Armament: 'M60 door guns', 'Rotor Ø': '14.6 m' }, { col: COL.nato, dk: COL.natoDk, L: 12.8, fw: 2.1, fh: 2.2, boom: 5.2, R: 7.2, blades: 2, finH: 1.8, cs: 1.0, cl: 1.3, mz: 0 }, 'htrans');
HL('bo105', 'Bo 105P PAH-1', 'NATO', '1975', ['recon'], { Role: 'Anti-tank / scout helicopter', Crew: '2–3', 'Max speed': '242 km/h', Armament: '6 × HOT', 'Rotor Ø': '9.8 m' }, { col: COL.nato, dk: COL.natoDk, L: 8.8, fw: 1.7, fh: 1.9, boom: 4.2, R: 4.9, blades: 4, stub: 1.0, pods: [0.8], atgm: 2, finH: 1.3, cs: 1.0, cl: 1.3 });
HL('nh90', 'NH90 TTH', 'NATO', 'modern', ['m_ch47'].slice(0, 0), { Role: 'Transport helicopter', Crew: '2 + 20', 'Max speed': '300 km/h', 'Rotor Ø': '16.3 m' }, { col: COL.nato, dk: COL.natoDk, L: 16.1, fw: 2.5, fh: 2.4, boom: 5.8, R: 8.1, blades: 4, finH: 2.0, cs: 1.0, cl: 1.2, wheels: true }, 'htrans');
HL('ch47', 'CH-47 Chinook', 'NATO', 'modern', ['ch47', 'm_ch47'], { Role: 'Heavy-lift helicopter', Crew: '3 + 33', 'Max speed': '315 km/h', Payload: '10 t', 'Rotor Ø': '18.3 m ×2' }, { col: COL.nato, dk: COL.natoDk, L: 15.5, fw: 3.0, fh: 3.0, prof: [[-.5, .4, .5], [-.42, .9, .9], [-.2, 1, 1], [.3, 1, 1], [.44, .7, .75], [.5, .2, .3]], boom: 0.1, bh: .1, R: 9.0, tandem: true, finH: .1, wheels: true, gh: 1.2, extra(m, h) { h.box(0, 1.5, -6.0, 1.6, 3.2, .8, { c: COL.nato }); h.mir(() => h.box(1.4, .1, 0, .6, .8, 7, { c: COL.natoDk })); } }, 'htrans');

/* ---- drones ---- */
function propPart(m, h, pv, R, nb, rate) { const p = m.part('prop', h, pv); p.col(COL.black, 0); for (let i = 0; i < nb; i++) { p.push(); p.ro(0, 0, i * 360 / nb); p.box(0, R / 2, 0, .12, R, .03, {}); p.pop(); } m.spins = (m.spins || []).concat([{ part: p, ax: 2, rate }]); m.tick2 = (t) => { for (const s of m.spins) s.part.rot[s.ax] = (t * s.rate * (m.rotSpeed === undefined ? 1 : m.rotSpeed)) % 360; }; m.rotSpeed = 1; }
const UV = (id, name, side, era, game, spec, P, fx) => acDef(id, name, side, 'Drones', era, game, spec, Object.assign({ nogear: true, gh: P.gh || .45, cdist: 2.6 }, P), fx || 'drone');
UV('mq9', 'MQ-9B SkyGuardian', 'NATO', 'modern', ['mq9'], { Role: 'MALE UAV', Crew: '0 (remote)', 'Max speed': '482 km/h', Armament: 'Hellfire / GBU-12', Span: '24 m' },
  { col: AC.lgrey, L: 11.0, fw: .95, fh: 1.0, prof: [[-.5, .3, .35], [-.4, .7, .7], [-.1, 1, 1], [.25, .9, 1], [.4, .6, .7], [.5, .12, .2]], wing: SW(.8, 1.4, .8, 11.5, .5, .4), fin: { x: .8, zr: -4.4, rc: 1.6, tc: .8, h: 1.8, sw: .8, cant: -35, y0: .1 }, ne: 0, intake: 'none', loads: [[-3.0, -.3, .3, 'msl'], [3.0, -.3, .3, 'msl'], [-5.2, -.3, .3, 'msl'], [5.2, -.3, .3, 'msl']], extra(m, h) { propPart(m, h, [0, 0, -5.5], 1.1, 3, 900); h.col(COL.dkgrey, 0); h.cyl(0, .4, 5.0, .45, .6, { n: 10 }); } });
UV('rq4', 'RQ-4B Global Hawk', 'NATO', 'modern', ['rq4'], { Role: 'HALE reconnaissance UAV', Crew: '0 (remote)', 'Max speed': '575 km/h', Ceiling: '18 km', Span: '39.9 m' },
  { intake: 'none', col: AC.white, L: 14.5, fw: 1.9, fh: 1.9, prof: [[-.5, .15, .25], [-.38, .8, .8], [-.15, 1, 1], [.1, 1, 1], [.3, .95, .95], [.42, .7, .7], [.5, .15, .2]], wing: SW(1.0, 2.0, 1.0, 17.0, 1.0, .9), fin: { x: 1.0, zr: -6.4, rc: 2.0, tc: 1.0, h: 2.4, sw: 1.0, cant: -38, y0: .5 }, ne: 0, extra(m, h) { h.col(COL.dkgrey, 0); h.cyl(0, 1.3, -3.6, .75, 3.5, { r1: .5, n: 12 }); h.box(0, .9, -2.6, .4, .8, 2, { c: AC.white }); m.anchor('eng0', h, [0, 1.3, -5.4], [0, 0, -1]); m.nEng = 1; } });
UV('orion', 'Kronshtadt Orion', 'PACT', 'modern', ['orion'], { Role: 'MALE UAV', Crew: '0 (remote)', 'Max speed': '200 km/h', Armament: 'KAB-20 / Kh-50', Span: '16 m' },
  { intake: 'none', col: AC.sov, L: 8.0, fw: .9, fh: .9, wing: SW(.5, 1.2, .8, 8.0, .3, .4), tail: SW(-3.4, 1.0, .6, 1.5, .4, .3), fin: { x: 1.4, zr: -3.2, rc: 1.2, tc: .6, h: 1.2, sw: .5 }, ne: 0, loads: [[-2.5, -.3, .3, 'bomb'], [2.5, -.3, .3, 'bomb']], extra(m, h) { propPart(m, h, [0, 0, -4.2], .9, 3, 900); h.mir(() => h.cyl(1.4, 0, -2.0, .12, 3.6, { n: 8, c: AC.sov })); } });
UV('geran', 'Geran-2', 'PACT', 'modern', ['r_geran'], { Role: 'One-way attack drone', Crew: '0', 'Max speed': '185 km/h', Warhead: '50 kg', Range: '1,800 km', Span: '2.5 m' },
  { intake: 'none', col: AC.sov, L: 3.5, fw: .4, fh: .4, wing: Object.assign(SW(.8, 2.0, .4, 1.25, 1.2, .2), { t: .06 }), fin: { x: 1.25, zr: -1.4, rc: .8, tc: .4, h: .5, sw: .3, cant: -80, y0: 0 }, ne: 0, gh: .35, extra(m, h) { propPart(m, h, [0, 0, -1.8], .5, 2, 1100); } });
UV('lancet', 'ZALA Lancet-3', 'PACT', 'modern', ['r_lancet'], { Role: 'Loitering munition', Crew: '0', 'Max speed': '110 km/h', Warhead: '3 kg', Span: '1.2 m' },
  { intake: 'none', col: AC.white, L: 1.6, fw: .2, fh: .2, wing: Object.assign(SW(.2, .5, .3, .6, .1, .1), { t: .04 }), tail: Object.assign(SW(-.6, .4, .25, .4, .05, .1), { t: .03 }), fin: { zr: -.6, rc: .5, tc: .25, h: .4, sw: .1, t: .03 }, ne: 0, gh: .2, extra(m, h) { propPart(m, h, [0, 0, -.9], .25, 2, 1400); h.wing = 0; } });
reg({ id: 'fpvq', name: 'FPV Quadcopter', side: 'NATO', cat: 'Drones', era: 'modern', fx: 'drone', game: ['m_fpv'], cdist: 2.6, spec: { Role: 'FPV kamikaze drone', Crew: '0', 'Max speed': '140 km/h', Warhead: '1 kg', Size: '0.4 m' }, build(m) {
  const h = m.part('hull'); h.off = [0, .12, 0]; h.col(COL.black, 0); h.box(0, 0, 0, .12, .05, .22, {}); h.col(COL.dkgrey, 0); h.box(0, .05, -.02, .08, .04, .12, { c: COL.orange }); h.box(0, 0, .13, .05, .05, .04, { c: COL.glass, m: 3 });
  const spins = []; let i = 0; for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { h.box(sx * .1, 0, sz * .1, .22, .012, .022, { c: COL.black, r: [0, sz * sx * 45, 0] }); const p = m.part('prop' + i, h, [sx * .18, .03, sz * .18]); p.col(COL.black, 0); p.box(0, 0, 0, .2, .004, .02, {}); p.box(0, 0, 0, .02, .004, .2, {}); spins.push({ part: p, ax: 1, rate: 3000 * (i % 2 ? 1 : -1) }); i++; }
  m.spins = spins; m.tick2 = (t) => { for (const s of m.spins) s.part.rot[s.ax] = (t * s.rate * (m.rotSpeed === undefined ? 1 : m.rotSpeed)) % 360; }; m.rotSpeed = 1; m.fl = { ab: false, spd: .4, bank: 20, heli: true, small: true }; m.nEng = 0; m.anchor('wt0', h, [.2, 0, 0], [0, 0, -1]); m.anchor('wt1', h, [-.2, 0, 0], [0, 0, -1]); m.anchor('belly', h, [0, -.05, 0], [0, 0, 1]);
} });
