'use strict';
/* ===== effects: Call-of-War-style chunky smoke, flames, blasts ===== */
const FX = {
  rnd(a, b) { return a + Math.random() * (b - a); },
  smoke(p, s, life, o) { o = o || {}; App.ps.emit({ p, v: o.v || [FX.rnd(-.3, .3), FX.rnd(.2, .8), FX.rnd(-.3, .3)], life, s0: s, s1: s * (o.grow || 3), c0: o.c0 || [.78, .76, .72], c1: o.c1 || [.55, .55, .56], a0: o.a || .8, tex: 1, rv: FX.rnd(-.8, .8), drag: o.drag || 1.2, buoy: o.buoy === undefined ? .6 : o.buoy }); },
  flame(p, s, life, v) { App.ps.emit({ p, v: v || [0, 0, 0], life, s0: s, s1: s * .2, c0: [1.6, 1.1, .5], c1: [1.2, .3, .05], a0: 1, tex: 0, add: true }); },
  flash(p, s) { App.ps.emit({ p, life: .12, s0: s, s1: s * 1.6, c0: [2, 1.6, 1], c1: [1.4, .8, .3], tex: 0, add: true }); },
  ring(p, s, life, c) { App.ps.emit({ p, life: life || .6, s0: s * .2, s1: s, c0: c || [.9, .9, .85], c1: c || [.7, .7, .7], a0: .6, tex: 2, add: false }); },
  sparks(p, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.4, k = FX.rnd(.4, 1) * sp; App.ps.emit({ p: p.slice(), v: [Math.cos(a) * Math.cos(e) * k, Math.sin(e) * k, Math.sin(a) * Math.cos(e) * k], life: FX.rnd(.5, 1.2), s0: .25, s1: .05, c0: [2, 1.5, .6], c1: [1, .3, .1], tex: 3, add: true, g: 9 }); } },
  blast(p, s) { // ground explosion: fireball + smoke column + dust ring
    FX.flash(p, s * 3); App.boom(.6); App.shake(.25 + s * .02);
    for (let i = 0; i < 12; i++) FX.flame([p[0] + FX.rnd(-s, s) * .4, p[1] + FX.rnd(0, s * .6), p[2] + FX.rnd(-s, s) * .4], s * FX.rnd(.9, 1.6), FX.rnd(.35, .8), [FX.rnd(-1, 1) * s, FX.rnd(0, 2) * s, FX.rnd(-1, 1) * s]);
    for (let i = 0; i < 18; i++) FX.smoke([p[0] + FX.rnd(-s, s) * .5, p[1] + FX.rnd(0, s), p[2] + FX.rnd(-s, s) * .5], s * FX.rnd(.8, 1.4), FX.rnd(2.5, 5), { v: [FX.rnd(-1, 1) * s * .6, FX.rnd(.5, 2.5) * s, FX.rnd(-1, 1) * s * .6], c0: [.3, .28, .26], c1: [.55, .55, .56], grow: 2.6, buoy: .4 });
    FX.ring([p[0], .1, p[2]], s * 7, .9); FX.sparks(p, 20, s * 3);
  },
  /* muzzle blast with recoil of 'barrel' */
  muzzle(m, o) {
    o = o || {}; const a = m.aw('muzzle'); if (!a) return; const s = o.size || 1, p = a.p, d = a.d;
    FX.flash(p, 2.2 * s); for (let i = 0; i < 5; i++) FX.flame(V3.add(p, V3.mul(d, i * .35 * s)), .9 * s, .18, V3.mul(d, 12 + i * 4));
    for (let i = 0; i < 16; i++) FX.smoke(V3.add(p, V3.mul(d, FX.rnd(0, 3) * s)), s * FX.rnd(.5, 1), FX.rnd(1.5, 3), { v: V3.add(V3.mul(d, FX.rnd(2, 9)), [FX.rnd(-1, 1), FX.rnd(0, 1.5), FX.rnd(-1, 1)]), grow: 4 });
    FX.ring(V3.add(p, V3.mul(d, 1.2 * s)), 2.4 * s, .5);
    // ground dust under the gun
    for (let i = 0; i < 8; i++) FX.smoke([p[0] + FX.rnd(-3, 3) * s, .2, p[2] + FX.rnd(-3, 3) * s], s * 1.2, 2, { v: [FX.rnd(-3, 3), .3, FX.rnd(-3, 3)], c0: [.6, .52, .4], c1: [.6, .55, .45], buoy: .1 });
    App.shake(.12 * s); App.boom(.35 * s);
  },
  recoil(m, part, dist, T) { // kicks part.off back along z then returns
    const t0 = App.t; m.recoil = { part, dist, T, t0 };
  },
  tickRecoil(m) { const r = m.recoil; if (!r) return; const u = (App.t - r.t0) / r.T; if (u >= 1) { r.part.off[2] = r.part.off0[2]; m.recoil = null; return; } r.part.off[2] = r.part.off0[2] - r.dist * (u < .12 ? u / .12 : 1 - (u - .12) / .88); },
  /* ballistic shell with tracer */
  shell(from, dir, speed, o) {
    o = o || {}; const v = V3.mul(V3.norm(dir), speed);
    return App.proj({ p: from.slice(), v, g: o.g === undefined ? 9.8 : o.g, life: o.life || 14, trail(p, prev) { FX.flame(p.p.slice(), .35, .25); if (Math.random() < .5) FX.smoke(p.p.slice(), .35, 1.2, { v: [0, 0, 0], grow: 2 }); }, hit(p) { FX.blast(p.p, o.blast || 3); o.onHit && o.onHit(p); } });
  },
};
/* ===== action table: each model has actions [{id,label,run(m)}] chosen from its fx profile ===== */
const PROFILES = {
  tank: m => [{ id: 'fire', label: 'Fire', run() { fireTank(m, 1); } }, { id: 'salvo', label: 'Salvo ×3', run() { for (let i = 0; i < 3; i++) App.at(i * 1.1, () => fireTank(m, 1)); } }],
};
function fireTank(m, sc) {
  const gun = m.find('gun'), bar = m.find('barrel'), pr = m.tankProf || {};
  gun.rot[0] = -4.5;
  App.at(0.0, () => {
    const a2 = m.aw('muzzle'); FX.muzzle(m, { size: sc }); FX.recoil(m, bar, pr.recoil || .5, 1.1);
    const s = FX.shell(a2.p, a2.d, 95, { g: 9.8, blast: 4 });
    const mid = V3.add(a2.p, V3.mul(a2.d, 38)); mid[1] = 4;
    App.followProj({ p: mid }, 3.6, { dist: Math.max(App.R * 9, 32), az: App.cam.az });
  });
}
Model.prototype.find = Model.prototype.find || function (n) { return this.parts.find(p => p.name === n); };
