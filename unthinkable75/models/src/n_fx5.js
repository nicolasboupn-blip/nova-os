'use strict';
/* ===== rails + rolling trains ===== */
regHidden({ id: '_rails', name: 'rails', build(m) {
  const h = m.part('track'); const N = 720, step = .8, z0 = -150;
  h.col(0x8b7f66, 0); h.box(0, .12, z0 + N * step / 2, 4.4, .24, N * step + 20, { c: 0x8b7f66 });
  h.col(0x4a3a2a, 0); for (let i = 0; i < N; i++) h.box(0, .3, z0 + i * step, 2.9, .14, .24, { c: 0x4a3a2a });
  h.col(0x8a7e74, 1); for (const sx of [-1, 1]) h.box(sx * .72, .45, z0 + N * step / 2, .12, .22, N * step + 20, { c: 0x8a7e74, m: 1 });
} });
const _tr5 = FX.tickRecoil;
FX.tickRecoil = function (m) { _tr5.call(FX, m); if (m.train) FX.stepTrain(m, App.dtLast || .016); };
FX.stepTrain = function (m, dt) {
  const T = m.train; dt = Math.min(dt, .05);
  if (!T.z && T.z !== 0) { T.z = 0; T.v = 0; T.go = false; T.t = 0; }
  const vmax = m.rollSpeed || 12; T.v += ((T.go ? vmax : 0) - T.v) * Math.min(1, dt * (T.go ? .5 : 1.1)); if (!T.go && T.v < .05) T.v = 0;
  T.z += T.v * dt; T.t += dt; if (T.z > 330 && T.go) T.go = false;
  m.fpos = m.fpos || [0, 0, 0]; m.fpos[0] = 0; m.fpos[1] = 3; m.fpos[2] = T.z; m.xf = M4.T(0, 0, T.z);
  for (const a of (m.axles || [])) a.part.rot[0] = ((T.z / a.r) * 57.2958) % 360;
  if (m.rods) { const th = (T.z / 1.0); m.rods.forEach((r, i) => { const ph = th + (i ? Math.PI / 2 : 0); r.part.off = [r.base[0], -r.c * Math.sin(ph), r.c * Math.cos(ph)]; }); }
  m.updateWorld(); T.fx = (T.fx || 0) + dt;
  const rate = T.kind === 'steam' ? Math.max(.07, .5 - T.v * .045) : .09;
  if (T.fx > rate) { T.fx = 0;
    if (T.kind === 'steam') { const c = m.aw('chim'); FX.smoke(c.p, 1.5, 4.5, { v: [FX.rnd(-.4, .4) - 0, 3.2 + T.v * .1, -T.v * .35 + FX.rnd(-.3, .3)], c0: [.95, .95, .96], c1: [.62, .64, .68], grow: 5, buoy: .2, drag: .55, a: .85 }); if (T.v > .5) for (const n of ['cylL', 'cylR']) { const q = m.aw(n); FX.smoke(q.p, .7, 1.4, { v: [(n === 'cylL' ? -1 : 1) * 2.5, .6, -T.v * .4], c0: [1, 1, 1], c1: [.9, .92, .95], grow: 3, buoy: .1, a: .6 }); } }
    else { for (const k of [0, 1]) { const a = m.anchors['stack' + (k ? (-0 + 40 - 21.5) : 40)]; } for (const n in m.anchors) if (n.indexOf('stack') === 0) { const c = m.aw(n); if (T.v > .3) FX.smoke(c.p, 1.1, 3, { v: [0, 2.2, -T.v * .2], c0: [.35, .35, .36], c1: [.6, .6, .62], grow: 4, buoy: .2, a: .6 }); } }
    if (T.v > 2) { const dz = (Math.random() - .5) * 80; FX.smoke([FX.rnd(-3, 3), .3, T.z + dz - m.trainCenter * 0], .9, 1.8, { v: [FX.rnd(-1, 1), .3, 0], c0: [.7, .6, .45], c1: [.7, .62, .5], a: .35, buoy: 0 }); }
  }
  if (T.w) { T.w -= dt; if (T.w > 0 && Math.random() < .8) { const q = m.aw('whistle'); if (q) FX.smoke(q.p, .9, 1.6, { v: [FX.rnd(-.5, .5), 7, FX.rnd(-.5, .5)], c0: [1, 1, 1], c1: [.95, .96, 1], grow: 4, buoy: .3, a: .9 }); } }
};
PROFILES.train = m => { const T = m.train; const L = [{ id: 'roll', label: 'Roll out', run() { if (!T.go) { T.go = true; App.follow = { p: { p: m.fpos || [0, 3, 0] }, until: 1e9, keep: true, off: [0, 2, 0], dist: Math.max(App.R * 1.3, 60) }; m.fpos = m.fpos || [0, 3, 0]; } } }, { id: 'stop', label: 'Brake', run() { T.go = false; } }];
  if (T.kind === 'steam') L.push({ id: 'whistle', label: 'Whistle', run() { T.w = 2.2; App.shake(.15); } }); return L; };
