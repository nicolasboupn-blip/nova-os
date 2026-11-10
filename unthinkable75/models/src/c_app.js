'use strict';
/* ===== registry ===== */
const REG = {}, ORDER = [], MCACHE = {};
function reg(d) { REG[d.id] = d; ORDER.push(d.id); return d; }
function getModel(id) {
  if (!MCACHE[id]) {
    const d = REG[id], m = new Model(id); m.def = d; d.build(m, d); m.finish();
    for (const p of m.parts) { p.rot0 = p.rot.slice(); p.off0 = p.off.slice(); p.sc0 = p.sc.slice(); }
    MCACHE[id] = m;
  }
  return MCACHE[id];
}
Model.prototype.resetPose = function () { for (const p of this.parts) { p.rot = p.rot0.slice(); p.off = p.off0.slice(); p.sc = p.sc0.slice(); p.vis = p.vis0 !== undefined ? p.vis0 : true; p.tint = null; } this.xf = M4.id(); };
Model.prototype.clone = function () {
  const m = new Model(this.id), map = new Map();
  for (const p of this.parts) { const q = new Part(m, p.name, p.parent ? map.get(p.parent) : null, p.pivot.slice()); q.geo = p.geo; q.rot = p.rot.slice(); q.off = p.off.slice(); q.sc = p.sc.slice(); map.set(p, q); m.parts.push(q); if (!m.root) m.root = q; }
  m.anchors = {}; for (const k in this.anchors) { const a = this.anchors[k]; m.anchors[k] = { part: map.get(a.part), pos: a.pos, dir: a.dir }; }
  m.radius = this.radius; m.center = this.center; m.size = this.size; return m;
};

/* ===== environments ===== */
function mkEnv(s) {
  const e = {
    top: rgb(s.top), hor: rgb(s.hor), sun: V3.norm(s.sun), sunCol: s.sunCol, skyL: s.skyL, gndL: s.gndL,
    g1: rgb(s.g1), g2: rgb(s.g2), deep: rgb(s.deep || 0x0b3550), shal: rgb(s.shal || 0x1d7a8a), night: !!s.night
  };
  return e;
}
const ENVS = {
  dusk: mkEnv({ top: 0x2f5a97, hor: 0xf3c498, sun: [0.62, 0.40, 0.55], sunCol: [1.35, 1.0, 0.7], skyL: [0.34, 0.40, 0.58], gndL: [0.32, 0.24, 0.18], g1: 0x6a6a4a, g2: 0x8d8158 }),
  day: mkEnv({ top: 0x4a86d4, hor: 0xcfe2f2, sun: [0.35, 0.82, 0.45], sunCol: [1.25, 1.12, 0.96], skyL: [0.42, 0.54, 0.74], gndL: [0.32, 0.30, 0.24], g1: 0x56683a, g2: 0x7a8548 }),
  night: mkEnv({ top: 0x040812, hor: 0x1b2438, sun: [-0.4, 0.6, 0.35], sunCol: [0.20, 0.27, 0.46], skyL: [0.055, 0.075, 0.14], gndL: [0.03, 0.035, 0.05], g1: 0x1d241c, g2: 0x2a3126, night: true, deep: 0x04121c, shal: 0x0a2a3a }),
  desert: mkEnv({ top: 0x5a9fe0, hor: 0xf2e0b4, sun: [0.3, 0.75, 0.55], sunCol: [1.3, 1.15, 0.9], skyL: [0.45, 0.52, 0.66], gndL: [0.40, 0.33, 0.22], g1: 0xb29a62, g2: 0xd0b87e }),
  snow: mkEnv({ top: 0x7ea2cc, hor: 0xe6eef6, sun: [0.3, 0.55, 0.5], sunCol: [1.15, 1.1, 1.05], skyL: [0.55, 0.62, 0.74], gndL: [0.50, 0.52, 0.56], g1: 0xdfe6ee, g2: 0xf4f7fb }),
};

/* ===== app ===== */
const App = {
  rd: null, cam: null, ps: null, model: null, ents: [], projs: [], tasks: [], t: 0, speed: 1, envKey: 'dusk', toon: true, outline: true, water: false, flash: 0, auto: true, autoIdle: 0, follow: null, followT: 0, drift: [0, 0], hooks: {},
  init(cv) {
    this.rd = new Renderer(cv); if (!this.rd.ok) return false;
    this.cam = new Cam(); this.ps = new Particles(); this.setEnv('dusk'); this.bindInput(cv);
    let last = performance.now();
    const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; try { this.frame(dt); } catch (e) { console.error(e); this.err = String(e && e.stack || e); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop); return true;
  },
  setEnv(k) { this.envKey = k; this.env = ENVS[k]; },
  setModel(id) {
    this.reset(); const m = getModel(id); this.model = m; m.resetPose(); this.def = m.def; this.water = !!m.def.water;
    this.R = Math.max(m.radius, 1);
    const c = m.def.focus || m.center, cam = this.cam; cam.want = [c[0], m.def.water ? Math.max(c[1], this.R * 0.05) : c[1] * 0.9, c[2]]; cam.tgt = cam.want.slice();
    const asp = this.rd.cv.width / Math.max(1, this.rd.cv.height); cam.dist = this.R * (m.def.cdist || 2.3) * (asp < 1 ? Math.pow(1 / asp, 0.75) : 1); cam.minD = this.R * 0.35; cam.maxD = this.R * 14; cam.near = Math.max(0.05, this.R * 0.01); cam.far = this.R * 140;
    cam.az = m.def.caz !== undefined ? m.def.caz : 38; cam.el = m.def.cel !== undefined ? m.def.cel : 17; this.viewDist0 = cam.dist; this.viewAz0 = cam.az;
    this.camHome = { tgt: cam.want.slice(), dist: cam.dist, el: cam.el, az: cam.az };
    if (m.init) m.init(this); this.autoIdle = 0;
    this.updateUI && this.updateUI();
  },
  reset() { this.tasks.length = 0; this.projs.length = 0; this.ents.length = 0; this.ps.clear(); this.flash = 0; this.follow = null; if (this.model) { this.model.resetPose(); this.model.busy = false; this.model.state = null; if (this.model.stop) this.model.stop(this); } this.cam.shake = 0; this.drift = [0, 0]; },
  home() { const h = this.camHome; if (!h) return; this.follow = null; this.cam.want = h.tgt.slice(); this.cam.dist = h.dist; this.cam.el = h.el; this.cam.az = h.az; },
  at(delay, fn) { this.tasks.push({ at: this.t + delay, fn }); },
  proj(o) { // spawn projectile entity
    const p = Object.assign({ p: [0, 0, 0], v: [0, 0, 0], g: 0, drag: 0, life: 10, age: 0, align: true, trail: null, dead: false, hit: null, steer: null }, o);
    if (p.model) { p.ent = p.model.clone(); p.ent.noShadow = !!p.noShadow; this.ents.push(p.ent); }
    this.projs.push(p); return p;
  },
  kill(p) { p.dead = true; if (p.ent) { const i = this.ents.indexOf(p.ent); if (i >= 0) this.ents.splice(i, 1); } },
  shake(a) { this.cam.shake = Math.max(this.cam.shake, a); },
  boom(a) { this.flash = Math.max(this.flash, a); },
  followProj(p, dur, o) { this.follow = Object.assign({ p, until: this.t + (dur || 4), back: 0.9, off: [0, 0, 0], dist: null }, o || {}); },
  frame(dt) {
    dt = dt * this.speed; this.t += dt; const m = this.model; if (!m) return;
    for (let i = this.tasks.length - 1; i >= 0; i--) { const k = this.tasks[i]; if (this.t >= k.at) { this.tasks.splice(i, 1); try { k.fn(); } catch (e) { console.error(e); this.err = String(e && e.stack || e); } } }
    if (m.tick) m.tick(dt, this.t, this); if (typeof FX !== 'undefined') FX.tickRecoil(m);
    // projectiles
    for (const p of this.projs) {
      if (p.dead) continue; p.age += dt;
      if (p.steer) p.steer(p, dt);
      p.v[1] -= p.g * dt; if (p.drag) { const d = Math.exp(-p.drag * dt); p.v[0] *= d; p.v[1] *= d; p.v[2] *= d; }
      const prev = p.p.slice(); p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt;
      if (p.trail) p.trail(p, prev, dt);
      if (p.ent) { p.ent.xf = M4.along(p.p, p.v, p.up); if (p.spin) p.ent.parts[0].rot[2] += p.spin * dt; p.ent.updateWorld(); }
      const gl = p.ground === undefined ? 0 : p.ground;
      if (p.p[1] <= gl && p.age > 0.05 && !p.noGround) { if (p.hit) p.hit(p); this.kill(p); }
      else if (p.age > p.life) { if (p.expire) p.expire(p); this.kill(p); }
    }
    this.projs = this.projs.filter(p => !p.dead);
    m.updateWorld(); for (const e of this.ents) e.updateWorld();
    this.ps.update(dt); this.flash *= Math.exp(-dt * 7);
    // camera
    const cam = this.cam;
    if (this.follow) {
      const f = this.follow;
      if (this.t > f.until || (f.p && f.p.dead && this.t > f.until - 0.2)) { this.follow = null; this.cam.want = this.camHome.tgt.slice(); this.cam.dist = lerp(this.cam.dist, this.camHome.dist, 0.5); }
      else { const q = f.p.p || f.p; cam.want = [q[0] + f.off[0], q[1] + f.off[1], q[2] + f.off[2]]; if (f.dist) cam.dist += (f.dist - cam.dist) * Math.min(1, dt * 2); if (f.az !== undefined) cam.az += (f.az - cam.az) * Math.min(1, dt * 1.5); }
    }
    if (this.auto && !this.follow && this.autoIdle <= 0 && !(m.def.noauto && m.busy)) cam.az += dt * 7;
    this.autoIdle -= dt; cam.update(dt);
    this.rd.render({ cam, models: [m], ents: this.ents, env: this.env, ps: this.ps, water: this.water, waterAlpha: m.def.sub ? 0.5 : 0.7, t: this.t, R: this.R, flash: this.flash * (this.env.night ? 0.6 : 0.25), toon: this.toon, outline: this.outline, outlinePx: 1.5, drift: this.drift });
    this.hooks.frame && this.hooks.frame(dt);
  },
  bindInput(cv) {
    const pts = new Map(); let lastPinch = 0; const self = this;
    const stop = () => { self.autoIdle = 4; };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); stop(); });
    cv.addEventListener('pointerup', e => { pts.delete(e.pointerId); lastPinch = 0; });
    cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); lastPinch = 0; });
    cv.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return; const cam = self.cam;
      if (pts.size === 1) { cam.az -= (e.clientX - p.x) * 0.45; cam.el = clamp(cam.el + (e.clientY - p.y) * 0.35, -4, 86); if (self.follow && !self.follow.keep) self.follow.until = self.t; }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (lastPinch) cam.dist = clamp(cam.dist * lastPinch / d, cam.minD, cam.maxD); lastPinch = d; }
      stop();
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); const cam = self.cam; cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), cam.minD, cam.maxD); stop(); }, { passive: false });
    cv.addEventListener('dblclick', () => self.home());
    cv.style.touchAction = 'none';
  },
  shot(id, az, el, dm, t) { // headless helper: render a still
    this.setModel(id); const c = this.cam; c.az = az; c.el = el; c.dist *= (dm || 1); this.auto = false; this.speed = 1;
    this.frame(0.016); if (t) { const n = Math.round(t / 0.033); for (let i = 0; i < n; i++) this.frame(0.033); }
    return this.rd.cv.toDataURL('image/png');
  },
};
