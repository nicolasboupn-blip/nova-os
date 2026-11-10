'use strict';
/* ===== hidden projectile models ===== */
function regHidden(d) { reg(d); ORDER.pop(); REG[d.id].hid = true; }
function mkMissile(m, o) {
  const p = m.part('body'); const L = o.L, r = o.r, nl = o.nl || r * 3;
  p.col(o.col || COL.white, 0); p.cyl(0, 0, L / 2, r, L, { n: 10 }); p.col(o.nose || COL.dkgrey, 0); p.cyl(0, 0, L + nl / 2, r, nl, { r1: .012, n: 10 });
  if (o.band) { p.col(o.band, 0); p.cyl(0, 0, L * .62, r * 1.02, L * .06, { n: 10 }); }
  p.col(o.fin || COL.dkgrey, 0);
  const nf = o.nf || 4;
  for (let i = 0; i < nf; i++) { p.push(); p.ro(0, 0, i * 360 / nf); p.box(0, r + (o.fs || r * 1.4) / 2 - .01, o.finz !== undefined ? o.finz : L * .08, .02 + r * .1, o.fs || r * 1.4, o.fc || L * .18, {}); p.pop(); }
  if (o.wing) { p.box(0, 0, L * .45, o.wing, .03, L * .22, { c: o.col || COL.white }); }
  p.col(COL.dkgrey, 1); p.cyl(0, 0, -.03, r * .8, .08, { ax: 'z', r1: r * 1.0, n: 8, c: COL.black });
}
regHidden({ id: '_rocket', name: 'rocket', build(m) { mkMissile(m, { L: 2.4, r: .1, col: COL.olive, nose: COL.red }); } });
regHidden({ id: '_gmlrs', name: 'GMLRS', build(m) { mkMissile(m, { L: 3.2, r: .13, col: COL.sand, nose: COL.olive }); } });
regHidden({ id: '_sam', name: 'sam', build(m) { mkMissile(m, { L: 3.6, r: .13, col: COL.white, band: COL.red, fs: .35, fc: .45, finz: 1.4 }); } });
regHidden({ id: '_ssm', name: 'ssm', build(m) { mkMissile(m, { L: 7.0, r: .35, col: COL.ltgrey, nose: COL.white, fs: .8, fc: 1.1, nf: 4 }); } });
regHidden({ id: '_vls', name: 'vls', build(m) { mkMissile(m, { L: 5.5, r: .27, col: COL.white, nose: COL.dkgrey, band: COL.red, fs: .5, fc: .7, nf: 4, finz: .5 }); } });
regHidden({ id: '_cruise', name: 'cruise', build(m) { mkMissile(m, { L: 5.4, r: .26, col: COL.ltgrey, nose: COL.ltgrey, wing: 2.6, fs: .4, fc: .5, nf: 3 }); } });
regHidden({ id: '_torp', name: 'torp', build(m) { mkMissile(m, { L: 5.6, r: .26, col: COL.dkgrey, nose: COL.orange, nf: 4, fs: .3, fc: .4, finz: -.2 }); } });
regHidden({ id: '_target', name: 'target', build(m) { const p = m.part('body'); p.col(COL.orange, 0); p.cyl(0, 0, 0, .25, 3.0, { n: 8 }); p.box(0, 0, -.5, 2.8, .05, .8, { c: COL.orange }); p.box(0, .25, -1.3, .05, .6, .5, { c: COL.orange }); } });
regHidden({ id: '_bomb', name: 'bomb', build(m) { mkMissile(m, { L: 2.0, r: .2, col: COL.olive, nose: COL.olive, fs: .3, fc: .3, finz: -.4 }); } });

/* ===== tweens, missiles, launch effects ===== */
FX.tween = function (m, arr, i, to, T, delay) { (m.tws = m.tws || []).push({ arr, i, a: null, b: to, t0: App.t + (delay || 0), T }); };
const _tr = FX.tickRecoil;
FX.tickRecoil = function (m) {
  _tr.call(FX, m);
  if (m.tws) for (let k = m.tws.length - 1; k >= 0; k--) { const w = m.tws[k]; if (App.t < w.t0) continue; if (w.a === null) w.a = w.arr[w.i]; let u = Math.min(1, (App.t - w.t0) / w.T); const e = u * u * (3 - 2 * u); w.arr[w.i] = w.a + (w.b - w.a) * e; if (u >= 1) m.tws.splice(k, 1); }
  if (m.tick2) m.tick2(App.t);
};
FX.groundSmoke = function (p, s, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; FX.smoke([p[0], .2, p[2]], s * FX.rnd(.6, 1), FX.rnd(2, 4), { v: [Math.cos(a) * s * FX.rnd(1, 3), FX.rnd(.2, 1), Math.sin(a) * s * FX.rnd(1, 3)], c0: [.85, .82, .76], c1: [.7, .68, .64], grow: 3, buoy: .3 }); } };
FX.launchBlast = function (p, d, s) {
  FX.flash(p, 3 * s); App.boom(.5); App.shake(.2 + .1 * s);
  for (let i = 0; i < 10; i++) FX.flame(V3.add(p, V3.mul(d, -i * .4 * s)), 1.3 * s, FX.rnd(.2, .45), V3.add(V3.mul(d, -FX.rnd(4, 14) * s), [FX.rnd(-3, 3), FX.rnd(-1, 1), FX.rnd(-3, 3)]));
  FX.groundSmoke(p, 2.2 * s, 26); FX.ring([p[0], .15, p[2]], 12 * s, 1);
};
/* trail: heavy Call-of-War style white smoke with orange glow head */
FX.trailer = function (o) {
  o = o || {}; const gap = o.gap || .9, S = o.s || .55, life = o.life || 3.2;
  return function (p, prev) {
    const d = V3.sub(p.p, prev), L = V3.len(d); const n = Math.min(10, Math.ceil(L / gap)); const dir = L > 1e-6 ? V3.mul(d, 1 / L) : [0, 0, 1];
    for (let i = 0; i < n; i++) { const q = V3.add(prev, V3.mul(d, (i + 1) / n)); FX.smoke(q, S * FX.rnd(.8, 1.2), life * FX.rnd(.8, 1.1), { v: [FX.rnd(-.4, .4), FX.rnd(-.1, .3), FX.rnd(-.4, .4)], c0: o.c0 || [1, 1, 1], c1: o.c1 || [.78, .78, .8], grow: o.grow || 3.2, buoy: .08, drag: .6, a: .85 }); }
    FX.flame(V3.sub(p.p, V3.mul(dir, (o.back || 1) * S * 2)), S * 2.8, .1); if (Math.random() < .5) FX.flame(V3.sub(p.p, V3.mul(dir, S * 3.5)), S * 1.7, .12);
  };
};
/* o: model, p, dir, v0, vmax, acc, turnAt, turn(rad/s), aim(fn->dir or point), g, life, tr (trail opts), onHit, hitR */
FX.missile = function (o) {
  const dir0 = V3.norm(o.dir); let dir = dir0.slice(), sp = o.v0 || 20; const tgt = o.target;
  const pr = App.proj({
    p: o.p.slice(), v: V3.mul(dir, sp), g: o.g || 0, life: o.life || 12, model: getModel(o.model), noShadow: true, ground: o.ground, noGround: o.noGround, trail: (function () { const t0 = FX.trailer(o.tr); return function (p, pv) { if (o.underwater && pv[1] < 0 && p.p[1] >= 0) o.underwater(p); if (p.p[1] >= 0 || !o.hideUW) t0(p, pv); }; })(),
    steer(q, dt) {
      sp = Math.min(o.vmax || 200, sp + (o.acc || 80) * dt);
      if (q.age > (o.turnAt || 0.5)) { let want = null; if (tgt) { const tp = tgt.p || tgt; want = V3.norm(V3.sub(tp, q.p)); } else if (o.cruise) want = o.cruise; if (want) { const k = Math.min(1, (o.turn || 1.5) * dt); dir = V3.norm(V3.add(V3.mul(dir, 1 - k), V3.mul(want, k))); } }
      q.v = V3.mul(dir, sp);
      if (tgt && !tgt.dead) { const tp = tgt.p || tgt; if (V3.len(V3.sub(tp, q.p)) < (o.hitR || 4)) { q.p = tp.slice ? tp.slice() : q.p; if (o.onHit) o.onHit(q); App.kill(q); } }
    },
    hit(q) { FX.blast(q.p, o.blast || 3); o.onHit && o.onHit(q); },
    expire(q) { o.onExpire && o.onExpire(q); },
  });
  return pr;
};
FX.sleep = function (s) { return s; };
/* ground target marker */
FX.targetAt = function (p) { return { p, dead: false }; };

/* ===== profiles ===== */
function elevFire(m, o) { // gun/howitzer/mortar firing a lobbed shell
  const gun = m.find('gun'), bar = m.find('barrel'), pr = m.tankProf || {};
  FX.tween(m, gun.rot, 0, -o.el, o.T || 1.0);
  App.at((o.T || 1.0) + .15, () => {
    m.updateWorld(); const a = m.aw('muzzle'); FX.muzzle(m, { size: o.size || 1.4 }); if (bar) FX.recoil(m, bar, pr.recoil || .5, 1.1);
    const sh = FX.shell(a.p, a.d, o.v, { g: o.g, blast: o.blast || 5 }); sh.life = 8;
    App.followProj(sh, 4.2, { dist: Math.max(App.R * 9, 40), az: App.cam.az });
    gun && App.at(2.4, () => FX.tween(m, gun.rot, 0, -(o.rest || 8), 1.2));
  });
}
PROFILES.spg = m => [{ id: 'fire', label: 'Fire', run() { elevFire(m, { el: 38, v: 72, g: 24, T: 1.0 }); } }, { id: 'sal', label: 'Burst ×4', run() { for (let i = 0; i < 4; i++) App.at(i * 1.7, () => elevFire(m, { el: 38 + i * 3, v: 72, g: 24, T: i ? .1 : 1.0 })); } }];
PROFILES.mortar = m => [{ id: 'fire', label: 'Fire', run() { elevFire(m, { el: 75, v: 42, g: 22, T: .1, size: .6, blast: 3.5, rest: 72 }); } }];
function rocketSalvo(m, n, o) {
  const pod = m.podOf; FX.tween(m, pod.rot, 0, -(o.el || 40), .9);
  for (let i = 0; i < n; i++) App.at(1.0 + i * (o.gap || .22), () => {
    m.updateWorld(); const a = m.aw('r' + (i % m.nRockets)); const lead = i === 0;
    FX.launchBlast(a.p, a.d, .55 * (o.size || 1));
    const spread = V3.add(a.d, [FX.rnd(-.015, .015), FX.rnd(-.01, .01), FX.rnd(-.015, .015)]);
    const r = FX.missile({ model: o.model || '_rocket', p: a.p, dir: spread, v0: 35, vmax: o.vmax || 150, acc: 140, turnAt: 99, g: o.g || 22, tr: { s: .55 * (o.size || 1), life: 3.4 }, blast: 3.2, life: 9 });
    if (lead) App.followProj(r, 4.2, { dist: Math.max(App.R * 8, 36), az: App.cam.az });
  });
  App.at(3.6 + n * .22, () => FX.tween(m, pod.rot, 0, 0, 1.2));
}
PROFILES.mlrs = m => [{ id: 'salvo', label: 'Salvo', run() { rocketSalvo(m, Math.min(12, m.nRockets), { el: 40 }); } }, { id: 'rip', label: 'Ripple ×24', run() { rocketSalvo(m, Math.min(24, m.nRockets), { el: 40, gap: .12, size: .8 }); } }];
PROFILES.ifv = m => [{ id: 'burst', label: 'Burst', run() { burst(m, 10, .09, 1.0); } }, { id: 'burst2', label: 'Long', run() { burst(m, 24, .07, 1.0); } }];
function burst(m, n, gap, sc) {
  const bar = m.find('barrel'); if (!bar) return;
  for (let i = 0; i < n; i++) App.at(i * gap, () => {
    const a = m.aw('muzzle'); FX.flash(a.p, 1.3 * sc); for (let k = 0; k < 2; k++) FX.smoke(V3.add(a.p, V3.mul(a.d, 1)), .5, 1.2, { v: V3.mul(a.d, 3), grow: 3 });
    if (bar) { bar.off[2] = -.08; App.at(gap * .5, () => { bar.off[2] = 0; }); }
    const v = V3.mul(V3.norm(V3.add(a.d, [FX.rnd(-.012, .012), FX.rnd(-.008, .008) + .02, FX.rnd(-.012, .012)])), 160);
    App.proj({ p: a.p.slice(), v, g: 6, life: 2, trail(p) { FX.flame(p.p.slice(), .32, .12); }, hit(p) { FX.sparks(p.p, 6, 5); FX.smoke(p.p, .6, 1, { grow: 3 }); } });
    App.shake(.04);
  });
}

/* ===== missile profiles ===== */
function erectLaunch(m, o) {
  const pod = m.podOf; FX.tween(m, pod.rot, 0, -(o.el || 85), o.T || 2.2);
  const t0 = (o.T || 2.2) + .4;
  App.at(t0, () => {
    m.updateWorld(); const k = o.k || 0, a = m.aw('r' + k) || m.aw('muzzle'); const ms = m.mscale || 1;
    FX.launchBlast(V3.add(a.p, [0, -a.d[1] * 0 - (o.groundLift || 0), 0]), a.d, 1.5 * ms * (o.size || 1));
    const mmod = m.msl || '_sam';
    let tgt = null; if (o.drone) { tgt = App.proj({ model: getModel('_target'), p: [-130, 55, 70], v: [48, 2, 0], g: 0, life: 12, noGround: true, noShadow: true }); tgt.ent && (tgt.ent.noShadow = true); }
    const T = tgt || { p: o.tp || [0, 0, 260] };
    const r = FX.missile({ model: mmod, p: a.p, dir: a.d, v0: 10, vmax: o.vmax || 230, acc: o.acc || 90, turnAt: o.turnAt || 0.9, turn: o.turn || 1.8, target: T, hitR: 5, tr: { s: .8 * ms, life: 4, gap: 1.0 }, blast: o.blast || 5,
      onHit(q) { if (tgt) { FX.blast(q.p, 6); FX.sparks(q.p, 40, 14); App.kill(tgt); } } });
    App.followProj(r, 5.5, { dist: Math.max(App.R * 7, 55), az: App.cam.az });
    App.at(7, () => FX.tween(m, pod.rot, 0, 0, 1.5));
  });
}
PROFILES.sam = m => [{ id: 'intercept', label: 'Intercept', run() { erectLaunch(m, { el: 72, drone: true, T: 1.6 }); } }, { id: 'launch', label: 'Launch', run() { erectLaunch(m, { el: 80, T: 1.6, tp: [0, 40, 220] }); } }];
PROFILES.ssm = m => [{ id: 'launch', label: 'Launch', run() { erectLaunch(m, { el: 86, T: 3.0, vmax: 180, acc: 60, turnAt: 1.6, turn: 1.0, tp: [0, 0, 300], blast: 9, size: 1.2 }); } }];
PROFILES.aag = m => [{ id: 'fire', label: 'Fire', run() {
  const g = m.find('gun'); FX.tween(m, g.rot, 0, -35, .8);
  const n = m.nBar || 1;
  for (let i = 0; i < 28; i++) App.at(.9 + i * .07, () => {
    m.updateWorld(); for (let k = 0; k < n; k++) { const a = m.aw(k ? 'muzzle' + k : 'muzzle'); FX.flash(a.p, 1.2); FX.smoke(a.p, .5, 1.2, { v: V3.mul(a.d, 3), grow: 3 });
      const v = V3.mul(V3.norm(V3.add(a.d, [FX.rnd(-.01, .01), FX.rnd(-.01, .01), FX.rnd(-.01, .01)])), 170);
      App.proj({ p: a.p.slice(), v, g: 2, life: 1.6, noGround: true, trail(p) { FX.flame(p.p.slice(), .3, .1); }, expire(p) { if (Math.random() < .2) { FX.flash(p.p, 1.8); FX.smoke(p.p, 1.2, 2, { grow: 3, c0: [.3, .3, .3] }); } } }); }
    App.shake(.04);
  });
  App.at(4, () => FX.tween(m, g.rot, 0, 0, 1)); } }];
PROFILES.none = m => [];
