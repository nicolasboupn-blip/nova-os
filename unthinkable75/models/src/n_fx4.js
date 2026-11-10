'use strict';
/* ===== naval FX ===== */
FX.splash = function (p, s) { FX.ring([p[0], .2, p[2]], s * 6, 1.1, [1, 1, 1]); for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, k = FX.rnd(.3, 1); App.ps.emit({ p: [p[0], .3, p[2]], v: [Math.cos(a) * s * 3 * k, FX.rnd(4, 12) * s * k, Math.sin(a) * s * 3 * k], life: FX.rnd(.8, 1.6), s0: s * .8, s1: s * 2.2, c0: [1, 1, 1], c1: [.8, .9, .95], a0: .8, tex: 1, g: 9, drag: .4 }); } };
FX.waterColumn = function (p, s) { FX.flash([p[0], 0, p[2]], s * 3); App.boom(.4); App.shake(.3); for (let i = 0; i < 26; i++) { const y = FX.rnd(0, 1) * s * 7; App.ps.emit({ p: [p[0] + FX.rnd(-s, s) * .5, y, p[2] + FX.rnd(-s, s) * .5], v: [FX.rnd(-1, 1) * s, FX.rnd(3, 10) * s, FX.rnd(-1, 1) * s], life: FX.rnd(1.5, 3), s0: s * 1.4, s1: s * 3.4, c0: [1, 1, 1], c1: [.82, .9, .95], a0: .85, tex: 1, g: 4, drag: .5, rv: FX.rnd(-1, 1) }); } FX.ring([p[0], .2, p[2]], s * 14, 1.6, [1, 1, 1]); FX.splash(p, s * 1.2); };
FX.shipWake = function (m) {
  m._wk = (m._wk || 0) + (App.dtLast || .016); if (m._wk < .06) return; m._wk = 0; const L = m.shipL || 40, B = m.shipB || 10, sp = m.wake || 10, s = L / 60;
  const st = m.aw('stern'); if (st) { const d = m.aw('bow'); for (const sx of [-.3, 0, .3]) { const q = V3.add(st.p, V3.mul(V3.cross(st.d, [0, 1, 0]), sx * B)); FX.smoke([q[0], .3, q[2]], s * 2.2 + 1, 3.5, { v: V3.mul(st.d, sp * .35), c0: [1, 1, 1], c1: [.85, .92, .95], a: .5, grow: 3, buoy: 0, drag: .3 }); } }
};
App.hooks.frame = function () { };
function shipTarget(m, dist, side) { return [side || 0, 6, dist]; }
function seaTargetFlight(m, mdl, from, dir, o) { return FX.missile(Object.assign({ model: mdl, p: from, dir }, o)); }
PROFILES.ship = m => {
  const L = [];
  if (m.hasGun) L.push({ id: 'gun', label: 'Naval gun', run() { navalGun(m); } });
  if (m.vlsN) L.push({ id: 'vls', label: 'Launch VLS', run() { vlsSalvo(m, Math.min(4, m.vlsN)); } });
  if (m.ssmN) L.push({ id: 'ssm', label: 'Anti-ship missiles', run() { ssmSalvo(m); } });
  if (m.nCiws) L.push({ id: 'ciws', label: 'CIWS', run() { ciws(m); } });
  if (m.find('cat0')) L.push({ id: 'cat', label: 'Launch jet', run() { catLaunch(m); } });
  if (m.find('hull') && m.anchors.cat0 === undefined && m.def.fx === 'ship' && m.heliOK) L.push({ id: 'hel', label: 'Helicopter', run() { heliLaunch(m); } });
  return L;
};
function navalGun(m) {
  const g = m.find('gun'); FX.tween(m, g.rot, 0, -22, .8);
  for (let i = 0; i < 3; i++) App.at(1 + i * 1.6, () => { m.updateWorld(); const a = m.aw('muzzle'); FX.muzzle(m, { size: 2.2 }); if (g) { g.off[2] = -.9; App.at(.35, () => { g.off[2] = 0; }); }
    const sh = FX.shell(a.p, a.d, 105, { g: 13, blast: 5 }); sh.life = 8; sh.hit = function (p) { FX.splash(p.p, 2.5); FX.waterColumn(p.p, 1.2); }; if (i === 0) App.followProj(sh, 4, { dist: Math.max(App.R * 2.4, 60), az: App.cam.az }); });
  App.at(7, () => FX.tween(m, g.rot, 0, 0, 1));
}
function vlsSalvo(m, n) {
  const side = m.def.side; const tgt = [0, 8, 520];
  for (let i = 0; i < n; i++) { const k = [0, 12, 3, 20, 7, 30][i] % m.vlsN; App.at(.2 + i * 1.0, () => {
    m.updateWorld(); const hp = m.find('vh' + k); FX.tween(m, hp.rot, 0, -85, .25); const a = m.aw('v' + k); const up = [0, 1, 0];
    App.at(.3, () => { FX.launchBlast(a.p, up, 1.7); FX.groundSmoke(a.p, 2.5, 14); App.shake(.15);
      const r = FX.missile({ model: i % 2 ? '_cruise' : '_vls', p: V3.add(a.p, [0, 1, 0]), dir: [FX.rnd(-.08, .08), 1, FX.rnd(-.02, .1)], v0: 18, vmax: 260, acc: 90, turnAt: 1.1 + i * .1, turn: 1.1, target: i % 2 ? undefined : [FX.rnd(-40, 40), 5, 480], cruise: [FX.rnd(-.05, .05), 0, 1], tr: { s: 1.0, life: 4.2, gap: 1.2 }, blast: 7, g: 0, life: 10, hitR: 8, onHit(q) { FX.splash(q.p, 3); } });
      if (i === 0) App.followProj(r, 5, { dist: Math.max(App.R * 2.2, 70), az: App.cam.az }); });
    App.at(1.6, () => FX.tween(m, hp.rot, 0, 0, .4)); }); }
}
function ssmSalvo(m) { const n = Math.min(m.ssmN, 4); for (let i = 0; i < n; i++) App.at(.3 + i * .9, () => { m.updateWorld(); const a = m.aw('s' + i); FX.launchBlast(a.p, a.d, 1.3); const dir = V3.norm([a.d[0], .55, a.d[2]]);
  const r = FX.missile({ model: m.ssmModel || '_ssm', p: a.p, dir, v0: 20, vmax: 190, acc: 90, turnAt: .7, turn: 1.4, cruise: V3.norm([0, .02, 1]), tr: { s: .8, life: 4, gap: 1.2 }, g: 0, blast: 7, life: 8, noGround: false });
  r.hit = function (p) { FX.blast(p.p, 6); FX.splash(p.p, 2.5); }; if (i === 0) App.followProj(r, 5, { dist: Math.max(App.R * 2.2, 60), az: App.cam.az }); }); }
function ciws(m) { const drone = App.proj({ model: getModel('_target'), p: [-150, 70, 250], v: [-0, -9, -52], g: 0, life: 12, noGround: true, noShadow: true });
  drone.p[0] = 150; drone.v = [-28, -10, -42];
  for (let i = 0; i < 50; i++) App.at(1.2 + i * .05, () => { if (drone.dead) return; m.updateWorld(); const k = 1 + (i % (m.nCiws || 1)); const a = m.aw('c' + k) || m.aw('c1'); const d = V3.norm(V3.sub(drone.p, a.p)); FX.flash(a.p, .9); const v = V3.mul(V3.norm(V3.add(d, [FX.rnd(-.01, .01), FX.rnd(-.01, .01), FX.rnd(-.01, .01)])), 280);
    App.proj({ p: a.p.slice(), v, g: 0, life: 1.6, noGround: true, trail(p) { FX.flame(p.p.slice(), .3, .08); } }); if (i === 36 && !drone.dead) { FX.blast(drone.p, 5); FX.sparks(drone.p, 40, 16); App.kill(drone); } });
  App.followProj({ p: [0, 20, 80] }, 4, { dist: Math.max(App.R * 2.2, 70), az: App.cam.az }); }
function catLaunch(m) { m.updateWorld(); const a = m.aw('cat0'); const mdl = getModel(m.def.side === 'NATO' ? 'f4' : 'su17'); const L = m.shipL;
  const pr = App.proj({ model: mdl, p: a.p.slice(), v: [0, 0, 3], g: 0, life: 12, noGround: true, noShadow: true, steer(q, dt) { const k = q.age; const sp = Math.min(70, 3 + k * k * 30); const climb = k > 1.7 ? Math.min(14, (k - 1.7) * 12) : 0; q.v = [0, climb, sp]; if (k > 1.2 && Math.random() < .6) { FX.flame(V3.add(q.p, [0, 1.0, -9]), 1.4, .09, [0, 0, -6]); FX.smoke(V3.add(q.p, [0, 1, -9]), 1.2, 1.4, { v: [0, 0, -2], c0: [.9, .9, .9], grow: 3, buoy: .1 }); } } });
  FX.groundSmoke(a.p, 2, 14); App.followProj(pr, 6, { dist: Math.max(App.R * 1.6, 90), az: App.cam.az, off: [0, 4, 0] }); }
PROFILES.sub = m => { const L = [{ id: 'tor', label: 'Torpedo', run() { subTorpedo(m); } }];
  if (m.subMissile) L.push({ id: 'msl', label: 'Missile', run() { subMissile(m); } });
  L.push({ id: 'surf', label: m.surfaced ? 'Dive' : 'Surface', run() { subSurface(m); } }); return L; };
function targetShip(dist) { const e = getModel('_tship').clone(); e.xf = M4.T(0, 0, dist); App.ents.push(e); e.updateWorld(); return e; }
function subTorpedo(m) {
  m.updateWorld(); const a = m.aw('tube'); const dep = -(m.subDepth - 1.0); const tp = [0, 0, 200]; const e = targetShip(200); const L = m.subL || 90;
  const st = m.aw('bow'); FX.smoke(V3.add(st.p, [0, 0, 6]), 3, 2, { v: [0, 0, 4], c0: [1, 1, 1], buoy: .5 });
  const from = [0, dep, a.p[2] + 4];
  const tor = App.proj({ model: getModel('_torp'), p: from, v: [0, 0, 8], g: 0, life: 12, noGround: true, noShadow: true, steer(q, dt) { const sp = Math.min(34, 8 + q.age * 22); q.v = [0, (dep - 1.5 - q.p[1]) * .3, sp]; if (q.p[2] > 168) { FX.waterColumn([0, 0, 200], 1.8); FX.blast([0, 6, 200], 5); App.kill(q); sink(e); } },
    trail(q) { App.ps.emit({ p: V3.add(q.p, [0, 0, -2]), v: [0, .6, 0], life: 2.4, s0: .5, s1: 1.4, c0: [1, 1, 1], c1: [.8, .9, .95], a0: .7, tex: 1, buoy: .5, drag: .6 }); } });
  App.followProj({ p: [0, 4, 80] }, 7, { dist: Math.max(App.R * 3.4, 110), az: App.cam.az });
}
function sink(e) { for (let i = 0; i < 70; i++) App.at(i * .1, () => { e.xf = M4.mul(M4.T(0, -i * .22, 200), M4.mul(M4.Ry(0), M4.Rx(Math.min(35, i * .6)))); if (i % 3 === 0) FX.smoke([FX.rnd(-3, 3), 6, 200 + FX.rnd(-10, 10)], 3, 3.5, { v: [0, 3, 0], c0: [.2, .2, .2], c1: [.4, .4, .4], grow: 3, buoy: .6 }); }); }
function subMissile(m) {
  m.updateWorld(); const a = m.aw('bow'); const e = targetShip(420); const dep = -(m.subDepth - 1);
  const ssm = m.subMissile === '_ssm';
  const r = FX.missile({ model: m.subMissile, p: [0, dep, a.p[2] + 14], dir: V3.norm([0, 1, .25]), v0: 22, vmax: 220, acc: 70, turnAt: 1.2, turn: 1.2, cruise: V3.norm([0, .04, 1]), noGround: true, hideUW: true, g: 0, hitR: 8, target: [0, 6, 420], tr: { s: .85, life: 4, gap: 1.1 }, life: 12, blast: 8,
    underwater(q) { FX.splash([q.p[0], 0, q.p[2]], 2.2); FX.waterColumn([q.p[0], 0, q.p[2]], .7); FX.flame(q.p, 4, .5); App.shake(.2); }, onHit(q) { FX.blast(q.p, 7); sink(e); } });
  App.followProj(r, 7, { dist: Math.max(App.R * 2.6, 90), az: App.cam.az, off: [0, 15, 40] });
}
function subSurface(m) { const h = m.find('hull'); if (m.surfaced) { m.surfaced = false; FX.tween(m, h.off, 1, -m.subDepth, 5); } else { m.surfaced = true; const st = m.aw('sailtop'); for (let i = 0; i < 30; i++) App.at(i * .08, () => FX.splash(V3.add(m.aw('sailtop').p, [FX.rnd(-6, 6), -4, FX.rnd(-20, 20)]), 1.2)); FX.tween(m, h.off, 1, -m.subR * .35, 4); } App.at(0, () => { App.updateUI && App.updateUI(); }); }
