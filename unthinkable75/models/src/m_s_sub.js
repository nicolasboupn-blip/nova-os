'use strict';
/* ===== submarines ===== */
function sub(m, P) {
  const h = m.part('hull'); const L = P.L, R = P.R; const dep = P.dep !== undefined ? P.dep : R * 2.2; h.off = [0, -dep, 0]; m.subDepth = dep; m.subR = R;
  const F = [-.5, -.46, -.36, -.2, 0, .2, .34, .42, .47, .5], Rf = P.rf || [.04, .32, .72, .96, 1, 1, .98, .86, .6, .12];
  h.col(P.col || 0x2a2f34, 0); h.lof(F.map((f, i) => ({ z: f * L, w: R * 2 * Rf[i] * (P.wf || 1), h: R * 2 * Rf[i], y: 0, n: 2 })), { k: 18, cap0: true, cap1: true });
  h.col(P.red || 0x6a2a24, 0); h.box(0, -R * .6, 0, R * 1.2, .3, L * .6, {});
  // sail
  const s = P.sail; h.col(P.col || 0x2a2f34, 0); h.ext([[s.z - s.l / 2, R * .7], [s.z + s.l / 2, R * .7], [s.z + s.l * .32, R + s.h], [s.z - s.l * .4, R + s.h]], R * (s.w || .6), { ax: 'x', sm: false });
  h.col(COL.black, 0); h.cyl(0, R + s.h + .8, s.z - s.l * .1, .12, 1.6, { ax: 'y', n: 6 }); h.cyl(0, R + s.h + .6, s.z + s.l * .12, .09, 1.2, { ax: 'y', n: 6 }); h.box(0, R + s.h + .2, s.z - s.l * .35, .1, .8, .6, {});
  if (P.sailPlanes) { h.col(P.col || 0x2a2f34, 0); h.mir(() => h.box(R * (s.w || .6) * .5 + 1.4, R + s.h * .45, s.z + s.l * .2, 2.8, .12, 1.4, {})); }
  else h.mir(() => h.box(R * .85, -R * .1, L * .36, 2.6, .12, 1.2, {}));
  // stern planes & rudders
  h.mir(() => h.box(R * .85, 0, -L * .46, R * 1.6, .14, R * .9, {})); h.box(0, R * .85, -L * .46, .14, R * 1.6, R * .9, {}); h.box(0, -R * .85, -L * .46, .14, R * 1.4, R * .9, {});
  h.col(COL.dkgrey, 1); h.cyl(0, 0, -L * .5 + .3, R * .55, .6, { n: 12, r1: R * .35 });
  const pr = m.part('prop', h, [0, 0, -L * .5 - .35]); pr.col(0x8a6a2a, 1); for (let i = 0; i < 5; i++) { pr.push(); pr.ro(0, 0, i * 72); pr.box(0, R * .5, 0, .35, R * .9, .06, { r: [0, 0, 0] }); pr.pop(); } m.spins = [{ part: pr, ax: 2, rate: 160 }]; m.tick2 = t => { for (const q of m.spins) q.part.rot[q.ax] = (t * q.rate * (m.sailing ? 1 : .0)) % 360; m.sailing && m.subWake && m.subWake(); };
  m.sailing = true; m.anchor('tube', h, [0, 0, L * .5 + 1], [0, 0, 1]); m.anchor('stern', h, [0, 0, -L * .5], [0, 0, -1]); m.anchor('bow', h, [0, 0, L * .5], [0, 0, 1]); m.anchor('sailtop', h, [0, R + s.h, s.z], [0, 1, 0]);
  m.isSub = true; m.subMissile = P.missile || null;
}
const SB = (id, name, side, era, game, spec, P) => reg({ id, name, side, cat: 'Submarines', era, fx: 'sub', game, spec, water: true, sub: true, cdist: 2.2, caz: 40, cel: 12, build(m) { sub(m, P); } });
SB('sturgeon', 'USS Sturgeon (SSN-637)', 'NATO', '1975', ['sturgeon'], { Role: 'Attack submarine (SSN)', Length: '89 m', Displacement: '4,780 t submerged', Armament: '4 × 533 mm: Mk 48, Harpoon, Tomahawk', Speed: '25+ kn' }, { L: 89, R: 4.8, sail: { z: 10, l: 14, h: 6, w: .55 }, sailPlanes: true, missile: '_cruise' });
SB('la688', 'USS Los Angeles (SSN-688)', 'NATO', '1975', ['la688'], { Role: 'Attack submarine (SSN)', Length: '110 m', Displacement: '6,900 t submerged', Armament: '4 × 533 mm, 12 × VLS Tomahawk', Speed: '32 kn' }, { L: 110, R: 5.2, sail: { z: 14, l: 16, h: 5.6, w: .6 }, sailPlanes: true, missile: '_cruise' });
SB('m_astute', 'HMS Astute (S119)', 'NATO', 'modern', ['m_astute'], { Role: 'Attack submarine (SSN)', Length: '97 m', Displacement: '7,400 t submerged', Armament: '6 × 533 mm: Spearfish, Tomahawk', Speed: '30+ kn' }, { L: 97, R: 5.9, sail: { z: 14, l: 16, h: 5.6, w: .6 }, sailPlanes: true, missile: '_cruise' });
SB('type206', 'Type 206A', 'NATO', '1975', ['type206'], { Role: 'Coastal submarine', Length: '48.6 m', Displacement: '500 t', Armament: '8 × 533 mm', Speed: '17 kn' }, { L: 48.6, R: 2.3, sail: { z: 6, l: 8, h: 2.8, w: .5 }, sailPlanes: false });
SB('kobben', 'Kobben (Type 207)', 'NATO', '1975', ['kobben'], { Role: 'Coastal submarine', Length: '47.4 m', Displacement: '485 t', Armament: '8 × 533 mm', Speed: '18 kn' }, { L: 47.4, R: 2.3, sail: { z: 6, l: 8, h: 2.8, w: .5 }, sailPlanes: false });
SB('victor', 'Victor III (Project 671RTM)', 'PACT', '1975', ['victor'], { Role: 'Attack submarine (SSN)', Length: '107 m', Displacement: '6,990 t submerged', Armament: '6 × 533 mm, SS-N-15/16', Speed: '30 kn' }, { L: 107, R: 5.2, sail: { z: 14, l: 16, h: 5, w: .55 }, sailPlanes: true, missile: '_cruise' });
SB('charlie', 'Charlie I (Project 670)', 'PACT', '1975', ['charlie'], { Role: 'Cruise missile submarine (SSGN)', Length: '95 m', Displacement: '5,000 t', Armament: '8 × SS-N-7 Starbright, 6 × 533 mm', Speed: '26 kn' }, { L: 95, R: 5, sail: { z: 12, l: 14, h: 5, w: .55 }, sailPlanes: false, missile: '_ssm' });
SB('foxtrot', 'Foxtrot (Project 641)', 'PACT', '1975', ['foxtrot'], { Role: 'Diesel-electric submarine', Length: '91.3 m', Displacement: '2,475 t', Armament: '10 × 533 mm', Speed: '16 kn' }, { L: 91.3, R: 3.9, sail: { z: 5, l: 12, h: 3.2, w: .45 }, sailPlanes: false });
SB('r_kilo', 'Kilo (Project 636.3)', 'PACT', 'modern', ['r_kilo'], { Role: 'Diesel-electric submarine', Length: '73.8 m', Displacement: '3,950 t', Armament: '6 × 533 mm, 3M14 Kalibr', Speed: '20 kn' }, { L: 73.8, R: 4.9, sail: { z: 3, l: 12, h: 3.4, w: .5 }, sailPlanes: false, missile: '_cruise' });
regHidden({ id: '_tship', name: 'target', build(m) { ship(m, { L: 70, B: 10, fb: 4, dr: 3, hull: 0x5a5048, sup: [{ z: -.05, y: 0, w: 7, h: 3, d: 14, c: 0x7a6e60 }], funnel: [{ z: -.12, y: 3, h: 2.5, r: 1.2, c: COL.black }], masts: [{ y: 4.5, z: .0, h: 5 }] }); m.sailing = false; } });
