'use strict';
/* ===== flight engine: takeoff, banked orbit, afterburners, contrails, weapon release ===== */
const _tr3 = FX.tickRecoil;
FX.tickRecoil = function (m) { _tr3.call(FX, m); if (m.flight) FX.stepFlight(m, App.dtLast || .016); };
const _fr = App.frame; App.frame = function (dt) { this.dtLast = dt * this.speed; return _fr.call(this, dt); };
FX.startFlight = function (m) {
  if (m.flight) return; const f = m.fl || { spd: 1, bank: 30 }, heli = !!f.heli, small = !!f.small;
  const sc = small ? .25 : 1; // small drones fly a tighter, slower pattern
  m.flight = { t0: App.t, pos: [0, 0, 0], hdg: 0, pitch: 0, bank: 0, v: 0, heli, small, ab: f.ab, spd: (heli ? 26 : 58) * (f.spd || 1) * (small ? .5 : 1), om: heli ? .5 : .32 * (small ? 1.4 : 1), alt: heli ? 22 * (small ? .4 : 1) : 55, bankMax: f.bank, kill: false, stage: 0 };
  m.fpos = [0, 0, 0]; m.rotSpeed = heli ? 2.4 : 2.0; const R = App.R;
  App.follow = { p: { p: m.fpos }, until: 1e9, keep: true, off: [0, 0, 0], dist: Math.max(R * (m.def.fx === 'drone' ? 7 : 4.2), heli ? 26 : 40) * (small ? .7 : 1), az: undefined };
  App.cam.el = 14;
};
FX.stopFlight = function (m) { m.flight = null; m.rotSpeed = 1; m.xf = M4.id(); m.resetPose && 0; App.follow = null; };
FX.stepFlight = function (m, dt) {
  const F = m.flight; if (!F) return; const t = App.t - F.t0; dt = Math.min(dt, .05);
  const ground = 0;
  if (F.heli) { // vertical climb, then slow orbit
    const climb = Math.min(1, t / 2.6); F.pos[1] = F.alt * (climb * climb * (3 - 2 * climb)); F.v += (Math.min(F.spd, Math.max(0, (t - 2.2)) * 8) - F.v) * Math.min(1, dt * 2);
    const turning = t > 2.6; F.hdg += (turning ? F.om : 0) * dt; F.bank += ((turning ? -F.bankMax : 0) - F.bank) * Math.min(1, dt * 1.5); F.pitch += ((turning ? 6 : 0) - F.pitch) * Math.min(1, dt * 1.5);
  } else { // jets: take-off roll
    const roll = 2.4 + (F.small ? 0 : 0); const k = Math.min(1, t / roll);
    F.v = F.spd * Math.min(1, t / roll) ; const airborne = t > roll * .8; if (airborne) { const u = Math.min(1, (t - roll * .8) / 3.0); F.pos[1] = F.alt * (u * u * (3 - 2 * u)); F.pitch += ((u < 1 ? (F.small ? 8 : 14) : 3) - F.pitch) * Math.min(1, dt * 2); } else F.pitch = 0;
    const turning = t > roll + 1.8; F.hdg += (turning ? F.om : 0) * dt; F.bank += ((turning ? -F.bankMax : 0) - F.bank) * Math.min(1, dt * 1.2);
    if (F.mode === 'dive' && F.dive) { }
  }
  const vx = Math.sin(F.hdg), vz = Math.cos(F.hdg);
  F.pos[0] += vx * F.v * dt; F.pos[2] += vz * F.v * dt; if (F.vy) F.pos[1] += F.vy * dt;
  if (F.pos[1] < ground) F.pos[1] = ground;
  F.vel = [vx * F.v, 0, vz * F.v];
  m.fpos[0] = F.pos[0]; m.fpos[1] = F.pos[1]; m.fpos[2] = F.pos[2];
  const hdgD = F.hdg * 180 / Math.PI; m.xf = M4.mul(M4.T(F.pos[0], F.pos[1], F.pos[2]), M4.R(-F.pitch, hdgD, F.bank * 1)); 
  const gp = m.find('gear'); if (gp) gp.vis = F.pos[1] < 5;
  // effects
  m.updateWorld(); F.fxT = (F.fxT || 0) + dt; const nE = m.nEng || 0;
  if (F.fxT > .035) { F.fxT = 0; const sm = F.small ? .3 : 1;
    for (let i = 0; i < nE; i++) { const a = m.aw('eng' + i); if (!a) continue; if (F.ab) { FX.flame(a.p, 1.4 * sm, .09, V3.mul(a.d, 6)); FX.flame(V3.add(a.p, V3.mul(a.d, 1.2)), 1.0 * sm, .07, V3.mul(a.d, 5)); } else if (!F.heli) FX.smoke(a.p, .7 * sm, 2.2, { v: [0, 0, 0], c0: [.45, .45, .45], c1: [.7, .7, .72], a: .35, grow: 3, buoy: 0 }); }
    if (!F.heli && F.pos[1] > 8) for (const n of ['wt0', 'wt1']) { const a = m.aw(n); if (a) FX.smoke(a.p, .4 * sm, 2.6, { v: [0, 0, 0], c0: [1, 1, 1], c1: [.85, .85, .88], a: .5, grow: 2.5, buoy: 0 }); }
    if (!F.heli && F.pos[1] < 3 && F.v > 8 && F.v < F.spd * .98) FX.smoke([F.pos[0], .3, F.pos[2]], 1.2, 1.8, { v: [FX.rnd(-1, 1), .2, FX.rnd(-1, 1)], c0: [.6, .52, .4], c1: [.6, .55, .45], a: .5, buoy: 0 });
    if (F.heli && F.pos[1] < 12) for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = App.R * 1.2; FX.smoke([F.pos[0] + Math.cos(a) * r, .3, F.pos[2] + Math.sin(a) * r], 1.2, 1.6, { v: [Math.cos(a) * 5, .3, Math.sin(a) * 5], c0: [.6, .52, .4], c1: [.6, .55, .45], a: .45, buoy: 0 }); }
  }
};
function startF(m) { FX.startFlight(m); }
function flyBtn(m) { return { id: 'fly', label: m.flight ? 'Landing…' : 'Fly', run() { if (!m.flight) startF(m); } }; }
/* weapon helpers */
function jetVel(m) { const F = m.flight; return F ? F.vel.slice() : [0, 0, 0]; }
function droneTarget(m, ahead) { const F = m.flight, p = F.pos; const d = [Math.sin(F.hdg), 0, Math.cos(F.hdg)]; const pos = V3.add(V3.add(p, V3.mul(d, ahead || 300)), [0, 0, 0]); pos[1] = F.pos[1] * .8; return pos; }
function releaseLoad(m, kind, i0) { // returns array of load indices of that kind (visible)
  const out = []; for (let i = 0; i < (m.nLoads || 0); i++) { const p = m.find('load' + i); if (p && p.vis !== false && p.kindTag === undefined) out.push(i); } return out;
}
function launchAAM(m) {
  if (!m.flight) startF(m);
  App.at(m.flight && App.t - m.flight.t0 < 6 ? 6 - (App.t - m.flight.t0) : 0, () => {
    const F = m.flight; if (!F) return; m.updateWorld();
    const idx = releaseLoad(m)[0]; const anc = idx !== undefined ? m.aw('ld' + idx) : m.aw('belly'); if (idx !== undefined) m.find('load' + idx).vis = false;
    const a = anc || { p: F.pos.slice(), d: [0, 0, 1] };
    const dir = V3.norm(V3.add([Math.sin(F.hdg), 0, Math.cos(F.hdg)], [0, -.05, 0]));
    const tp = V3.add(F.pos, V3.add(V3.mul(dir, 330), [0, 12, 0]));
    const tgt = App.proj({ model: getModel('_target'), p: tp, v: V3.add(V3.mul(dir, 30), [-6, 3, 0]), g: 0, life: 12, noGround: true, noShadow: true });
    FX.flash(a.p, 2);
    const r = FX.missile({ model: '_sam', p: a.p, dir, v0: F.v + 20, vmax: 320, acc: 160, turnAt: .35, turn: 3, target: tgt, hitR: 7, tr: { s: .5, life: 3.4 }, blast: 5, onHit(q) { FX.blast(q.p, 6); FX.sparks(q.p, 40, 16); App.kill(tgt); } });
  });
}
function dropBombs(m, n) {
  if (!m.flight) startF(m);
  const wait = m.flight ? Math.max(0, 6.4 - (App.t - m.flight.t0)) : 0;
  const idxs = []; for (let i = 0; i < (m.nLoads || 0); i++) { const p = m.find('load' + i); if (p && p.vis !== false) idxs.push(i); }
  const list = idxs.length ? idxs : [-1, -1, -1, -1];
  list.slice(0, n || 6).forEach((i, k) => App.at(wait + k * .35, () => {
    const F = m.flight; if (!F) return; m.updateWorld(); let a = i >= 0 ? m.aw('ld' + i) : m.aw('belly'); if (i >= 0) m.find('load' + i).vis = false; a = a || { p: F.pos.slice(), d: [0, 0, 1] };
    const v = F.vel.slice(); v[1] = -2;
    App.proj({ model: getModel('_bomb'), p: a.p.slice(), v, g: 9.8, life: 15, noShadow: true, trail(p) { if (Math.random() < .5) FX.smoke(p.p.slice(), .3, 1.5, { v: [0, 0, 0], grow: 2, c0: [.8, .8, .8] }); }, hit(p) { FX.blast(p.p, 6); }, expire() { } });
  }));
}
function strafe(m) {
  if (!m.flight) startF(m); const wait = m.flight ? Math.max(0, 6 - (App.t - m.flight.t0)) : 0;
  for (let i = 0; i < 26; i++) App.at(wait + i * .05, () => { const F = m.flight; if (!F) return; m.updateWorld(); const a = m.aw('gun') || { p: F.pos, d: [0, 0, 1] }; const dir = V3.norm(V3.add(a.d, [FX.rnd(-.01, .01), -.06 + FX.rnd(-.01, .01), FX.rnd(-.01, .01)])); FX.flash(a.p, .9);
    App.proj({ p: a.p.slice(), v: V3.add(V3.mul(dir, 300), F.vel), g: 3, life: 3, trail(p) { FX.flame(p.p.slice(), .35, .1); }, hit(p) { FX.sparks(p.p, 5, 6); FX.smoke(p.p, 1, 1.5, { grow: 3, c0: [.6, .52, .4] }); } }); });
}
function cruiseLaunch(m) {
  if (!m.flight) startF(m); const wait = m.flight ? Math.max(0, 6.2 - (App.t - m.flight.t0)) : 0;
  for (let k = 0; k < 2; k++) App.at(wait + k * 1.1, () => { const F = m.flight; if (!F) return; m.updateWorld(); const idx = releaseLoad(m)[0]; const a = (idx !== undefined ? m.aw('ld' + idx) : null) || m.aw('belly'); if (idx !== undefined) m.find('load' + idx).vis = false;
    const dir = V3.norm([Math.sin(F.hdg), -.04, Math.cos(F.hdg)]); FX.flash(a.p, 2);
    FX.missile({ model: '_cruise', p: a.p.slice(), dir, v0: F.v, vmax: 190, acc: 70, turnAt: 99, g: 2.5, tr: { s: .55, life: 3.8 }, blast: 8, life: 12 }); });
}
PROFILES.fighter = m => { const L = [flyBtn(m), { id: 'aam', label: 'Missile', run() { launchAAM(m); } }, { id: 'gun', label: 'Strafe', run() { strafe(m); } }]; if (m.nLoads) L.push({ id: 'bomb', label: 'Bombs', run() { dropBombs(m, 4); } }); return L; };
PROFILES.bomber = m => [flyBtn(m), { id: 'bomb', label: 'Bomb run', run() { dropBombs(m, 8); } }, { id: 'cm', label: 'Cruise missiles', run() { cruiseLaunch(m); } }];
PROFILES.awacs = m => [flyBtn(m)];
PROFILES.plane = m => [flyBtn(m)];
PROFILES.htrans = m => [flyBtn(m), { id: 'hover', label: 'Hover', run() { if (!m.flight) startF(m); } }];
PROFILES.heli = m => { const L = [flyBtn(m)]; if (m.nPods) L.push({ id: 'rkt', label: 'Rockets', run() { heliRockets(m); } }); if (m.nAtgm) L.push({ id: 'atgm', label: 'ATGM', run() { heliAtgm(m); } }); if (m.find('hull') && m.aw('muzzle')) L.push({ id: 'gun', label: 'Cannon', run() { heliGun(m); } }); return L; };
PROFILES.drone = m => { const L = [flyBtn(m)]; if (m.nLoads) L.push({ id: 'msl', label: 'Strike', run() { launchAAM(m); } }); L.push({ id: 'dive', label: m.def.id === 'fpvq' || m.def.id === 'geran' || m.def.id === 'lancet' ? 'Attack' : 'Dive', run() { kamikaze(m); } }); return L; };
function heliWait(m, s) { if (!m.flight) startF(m); return Math.max(0, s - (App.t - m.flight.t0)); }
function heliRockets(m) { const w = heliWait(m, 4.2); const n = m.nPods; for (let i = 0; i < 14; i++) App.at(w + i * .12, () => { const F = m.flight; if (!F) return; m.updateWorld(); const a = m.aw('pod' + (i % n)); const dir = V3.norm(V3.add([Math.sin(F.hdg), -.12, Math.cos(F.hdg)], [FX.rnd(-.01, .01), 0, FX.rnd(-.01, .01)])); FX.flash(a.p, 1.2); FX.smoke(a.p, .8, 1.5, { v: [0, 0, 0], grow: 3 }); FX.missile({ model: '_rocket', p: a.p, dir, v0: F.v + 30, vmax: 170, acc: 120, turnAt: 99, g: 4, tr: { s: .45, life: 3 }, blast: 3 }); }); }
function heliAtgm(m) { const w = heliWait(m, 4.2); App.at(w, () => { const F = m.flight; if (!F) return; m.updateWorld(); const a = m.aw('atgm0'); const dir = V3.norm([Math.sin(F.hdg), -.1, Math.cos(F.hdg)]); const tp = V3.add(F.pos, V3.add(V3.mul(dir, 160), [0, -F.pos[1] + 1, 0])); FX.flash(a.p, 1.6); FX.missile({ model: '_sam', p: a.p, dir, v0: F.v + 10, vmax: 220, acc: 100, turnAt: .3, turn: 2, target: tp, hitR: 5, tr: { s: .4, life: 3 }, blast: 5, onHit(q) { FX.blast(q.p, 5); } }); }); }
function heliGun(m) { const w = heliWait(m, 4.2); for (let i = 0; i < 24; i++) App.at(w + i * .06, () => { const F = m.flight; if (!F) return; m.updateWorld(); const a = m.aw('muzzle'); const dir = V3.norm(V3.add(a.d, [FX.rnd(-.01, .01), -.1 + FX.rnd(-.01, .01), FX.rnd(-.01, .01)])); FX.flash(a.p, .8); App.proj({ p: a.p.slice(), v: V3.add(V3.mul(dir, 240), F.vel), g: 5, life: 2.5, trail(p) { FX.flame(p.p.slice(), .3, .1); }, hit(p) { FX.sparks(p.p, 5, 6); FX.smoke(p.p, 1, 1.4, { grow: 3, c0: [.6, .52, .4] }); } }); }); }
function kamikaze(m) {
  startF(m); const F = m.flight; const go = () => {
    const target = [F.pos[0] + Math.sin(F.hdg) * 150 + 40, 0, F.pos[2] + Math.cos(F.hdg) * 150 + 40]; F.dive = target;
    const iv = () => { if (!m.flight) return; const d = V3.sub(target, F.pos), L = V3.len(d); const h2 = Math.atan2(d[0], d[2]); let dh = h2 - F.hdg; while (dh > Math.PI) dh -= 6.283; while (dh < -Math.PI) dh += 6.283; F.hdg += dh * .06; F.om = 0; F.bank *= .96; F.v = Math.max(F.v, F.spd * 1.3); F.vy = d[1] / Math.max(.2, L / F.v) * 1.0; F.pitch = Math.atan2(-F.vy, F.v) * 57 * -1 * -1;
      if (L < 3 || F.pos[1] <= .3) { FX.blast(F.pos.slice(), 5); m.rotSpeed = 1; m.flight = null; m.vis = false; m.parts.forEach(p => p.vis = false); App.follow = { p: { p: F.pos.slice() }, until: App.t + 3, off: [0, 3, 0], dist: 40 }; return; } App.at(.016, iv); };
    iv(); };
  App.at(Math.max(0, 5.5 - (App.t - F.t0)), go);
}
