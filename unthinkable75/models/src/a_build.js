'use strict';
/* ===== math ===== */
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const M4 = {
  id() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  T(x, y, z) { const m = M4.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  S(x, y, z) { const m = M4.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
  Rx(d) { const c = Math.cos(d * D2R), s = Math.sin(d * D2R), m = M4.id(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  Ry(d) { const c = Math.cos(d * D2R), s = Math.sin(d * D2R), m = M4.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  Rz(d) { const c = Math.cos(d * D2R), s = Math.sin(d * D2R), m = M4.id(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  /* euler: pitch(x) yaw(y) roll(z) -> Ry*Rx*Rz */
  R(p, y, r) { let m = M4.Ry(y || 0); if (p) m = M4.mul(m, M4.Rx(p)); if (r) m = M4.mul(m, M4.Rz(r)); return m; },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy * D2R / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  },
  lookAt(e, t, u) {
    const z = V3.norm(V3.sub(e, t)), x = V3.norm(V3.cross(u, z)), y = V3.cross(z, x), m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -V3.dot(x, e);
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -V3.dot(y, e);
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -V3.dot(z, e); m[15] = 1; return m;
  },
  /* model matrix looking along dir (z axis = dir) at pos */
  along(pos, dir, up) {
    const z = V3.norm(dir); up = up || [0, 1, 0];
    let x = V3.cross(up, z); if (V3.len(x) < 1e-4) x = V3.cross([1, 0, 0], z); x = V3.norm(x);
    const y = V3.cross(z, x), m = new Float32Array(16);
    m[0] = x[0]; m[1] = x[1]; m[2] = x[2]; m[4] = y[0]; m[5] = y[1]; m[6] = y[2];
    m[8] = z[0]; m[9] = z[1]; m[10] = z[2]; m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2]; m[15] = 1; return m;
  },
  xp(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
  xd(m, d) { return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]]; },
  /* inverse transpose of upper 3x3 (normal matrix) as 9 array column-major */
  nrm(m) {
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C || 1e-9, id = 1 / det;
    // inverse = adj/det ; transpose of inverse -> cofactor/det
    return [A * id, B * id, C * id,
      -(b * i - c * h) * id, (a * i - c * g) * id, -(a * h - b * g) * id,
      (b * f - c * e) * id, -(a * f - c * d) * id, (a * e - b * d) * id];
  },
  det3(m) { return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]); },
};

/* ===== colours (hex -> linear rgb) ===== */
function rgb(c) {
  if (Array.isArray(c)) return c;
  if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
}
function shade(c, f) { c = rgb(c); return [c[0] * f, c[1] * f, c[2] * f]; }
function mix(a, b, t) { a = rgb(a); b = rgb(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

/* ===== polygon triangulation (ear clipping) ===== */
function triangulate(pts) {
  const n = pts.length; if (n < 3) return [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const idx = []; for (let i = 0; i < n; i++) idx.push(i); if (area < 0) idx.reverse();
  const out = [];
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inT = (p, a, b, c) => cr(a, b, p) >= -1e-12 && cr(b, c, p) >= -1e-12 && cr(c, a, p) >= -1e-12;
  let guard = 0;
  while (idx.length > 3 && guard++ < 5000) {
    let ear = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
      const a = pts[i0], b = pts[i1], c = pts[i2];
      if (cr(a, b, c) <= 1e-12) continue;
      let ok = true;
      for (let k = 0; k < idx.length; k++) { const j = idx[k]; if (j === i0 || j === i1 || j === i2) continue; if (inT(pts[j], a, b, c)) { ok = false; break; } }
      if (ok) { out.push([i0, i1, i2]); idx.splice(i, 1); ear = true; break; }
    }
    if (!ear) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  else for (let i = 1; i < idx.length - 1; i++) out.push([idx[0], idx[i], idx[i + 1]]);
  return out;
}

/* ===== geometry store ===== */
class Geo {
  constructor() { this.P = []; this.N = []; this.C = []; this.Mt = []; this.I = []; this.n = 0; this.buf = null; }
  vert(p, n, c, m) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.C.push(c[0], c[1], c[2]); this.Mt.push(m); return this.n++; }
  tri(a, b, c) { this.I.push(a, b, c); }
  bake() {
    const P = this.P, N = this.N, I = this.I, n = this.n;
    // winding fix against vertex normals
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      const nx = N[a] + N[b] + N[c], ny = N[a + 1] + N[b + 1] + N[c + 1], nz = N[a + 2] + N[b + 2] + N[c + 2];
      if (gx * nx + gy * ny + gz * nz < 0) { const k = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = k; }
    }
    // outline normals: weld by position
    const on = new Float32Array(n * 3), map = new Map();
    for (let i = 0; i < n; i++) {
      const k = Math.round(P[i * 3] * 400) + ',' + Math.round(P[i * 3 + 1] * 400) + ',' + Math.round(P[i * 3 + 2] * 400);
      let e = map.get(k); if (!e) { e = [0, 0, 0]; map.set(k, e); }
      e[0] += N[i * 3]; e[1] += N[i * 3 + 1]; e[2] += N[i * 3 + 2];
    }
    for (let i = 0; i < n; i++) {
      const k = Math.round(P[i * 3] * 400) + ',' + Math.round(P[i * 3 + 1] * 400) + ',' + Math.round(P[i * 3 + 2] * 400);
      const e = map.get(k), l = Math.hypot(e[0], e[1], e[2]) || 1;
      on[i * 3] = e[0] / l; on[i * 3 + 1] = e[1] / l; on[i * 3 + 2] = e[2] / l;
    }
    const V = new Float32Array(n * 13);
    for (let i = 0; i < n; i++) {
      const o = i * 13;
      V[o] = P[i * 3]; V[o + 1] = P[i * 3 + 1]; V[o + 2] = P[i * 3 + 2];
      V[o + 3] = N[i * 3]; V[o + 4] = N[i * 3 + 1]; V[o + 5] = N[i * 3 + 2];
      V[o + 6] = this.C[i * 3]; V[o + 7] = this.C[i * 3 + 1]; V[o + 8] = this.C[i * 3 + 2];
      V[o + 9] = this.Mt[i];
      V[o + 10] = on[i * 3]; V[o + 11] = on[i * 3 + 1]; V[o + 12] = on[i * 3 + 2];
    }
    this.V = V; this.Idx = new Uint32Array(I); this.baked = true;
    this.P = this.N = this.C = this.Mt = this.I = null;
  }
}

/* ===== Part: a node with geometry + runtime pose ===== */
class Part {
  constructor(model, name, parent, pivot) {
    this.model = model; this.name = name; this.parent = parent || null; this.pivot = pivot || [0, 0, 0];
    this.geo = new Geo(); this.children = [];
    this.rot = [0, 0, 0]; this.off = [0, 0, 0]; this.sc = [1, 1, 1]; this.vis = true; this.world = M4.id();
    this.stack = [M4.id()]; this.cc = rgb(0x808080); this.cm = 0; this.outline = true;
    if (parent) parent.children.push(this);
  }
  /* ---- state ---- */
  col(c, m) { this.cc = rgb(c); if (m !== undefined) this.cm = m; return this; }
  mat(m) { this.cm = m; return this; }
  push() { this.stack.push(this.stack[this.stack.length - 1]); return this; }
  pop() { this.stack.pop(); return this; }
  tr(x, y, z) { this._top(M4.T(x, y, z)); return this; }
  ro(x, y, z) { let m = M4.id(); if (y) m = M4.mul(m, M4.Ry(y)); if (x) m = M4.mul(m, M4.Rx(x)); if (z) m = M4.mul(m, M4.Rz(z)); this._top(m); return this; }
  sca(x, y, z) { this._top(M4.S(x, y === undefined ? x : y, z === undefined ? x : z)); return this; }
  _top(m) { const s = this.stack; s[s.length - 1] = M4.mul(s[s.length - 1], m); }
  mir(fn) { fn(); this.push(); this.sca(-1, 1, 1); fn(); this.pop(); return this; }
  /* ---- emit ---- */
  _M(o) {
    let m = this.stack[this.stack.length - 1];
    if (o) {
      if (o.t) m = M4.mul(m, M4.T(o.t[0], o.t[1], o.t[2]));
      if (o.r) { const r = o.r; m = M4.mul(m, M4.mul(M4.Ry(r[1] || 0), M4.mul(M4.Rx(r[0] || 0), M4.Rz(r[2] || 0)))); }
      if (o.s) m = M4.mul(m, M4.S(o.s[0], o.s[1], o.s[2]));
    }
    return m;
  }
  _emit(P, N, I, o, extraM) {
    o = o || {};
    let m = this._M(o); if (extraM) m = M4.mul(m, extraM);
    const nm = M4.nrm(m), g = this.geo, c = o.c !== undefined ? rgb(o.c) : this.cc, mt = o.m !== undefined ? o.m : this.cm;
    const base = g.n, cnt = P.length / 3;
    for (let i = 0; i < cnt; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
      const q = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
      let n = [nm[0] * nx + nm[3] * ny + nm[6] * nz, nm[1] * nx + nm[4] * ny + nm[7] * nz, nm[2] * nx + nm[5] * ny + nm[8] * nz];
      const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      g.vert(q, n, c, mt);
    }
    for (let i = 0; i < I.length; i += 3) g.tri(base + I[i], base + I[i + 1], base + I[i + 2]);
    return this;
  }
  /* ---- primitives ---- */
  box(x, y, z, w, h, d, o) {
    const P = [], N = [], I = [], H = [w / 2, h / 2, d / 2];
    for (let a = 0; a < 3; a++) for (let s = -1; s <= 1; s += 2) {
      const u = (a + 1) % 3, v = (a + 2) % 3, base = P.length / 3;
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 0, 0]; p[a] = s * H[a]; p[u] = su * H[u]; p[v] = sv * H[v];
        P.push(p[0] + x, p[1] + y, p[2] + z); const n = [0, 0, 0]; n[a] = s; N.push(n[0], n[1], n[2]);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this._emit(P, N, I, o);
  }
  /* general frustum box: bottom w0,d0 -> top w1,d1 (centre x,y,z is the bottom centre) */
  frus(x, y, z, w0, d0, w1, d1, h, o) {
    o = o || {}; const dx = o.dx || 0, dz = o.dz || 0;
    const b = [[-w0 / 2, -d0 / 2], [w0 / 2, -d0 / 2], [w0 / 2, d0 / 2], [-w0 / 2, d0 / 2]];
    const t = [[-w1 / 2 + dx, -d1 / 2 + dz], [w1 / 2 + dx, -d1 / 2 + dz], [w1 / 2 + dx, d1 / 2 + dz], [-w1 / 2 + dx, d1 / 2 + dz]];
    const P = [], N = [], I = [];
    const ctr = [dx / 2, h / 2, dz / 2];
    const quad = (a, b2, c, d) => {
      let n = V3.norm(V3.cross(V3.sub(b2, a), V3.sub(d, a))); const base = P.length / 3;
      const mid = V3.mul(V3.add(V3.add(a, b2), V3.add(c, d)), 0.25);
      if (V3.dot(n, V3.sub(mid, ctr)) < 0) n = V3.mul(n, -1);
      for (const p of [a, b2, c, d]) { P.push(p[0] + x, p[1] + y, p[2] + z); N.push(n[0], n[1], n[2]); }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const B = b.map(p => [p[0], 0, p[1]]), T = t.map(p => [p[0], h, p[1]]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(B[i], B[j], T[j], T[i]); }
    quad(T[0], T[1], T[2], T[3]); quad(B[3], B[2], B[1], B[0]);
    return this._emit(P, N, I, o);
  }
  /* revolve profile [[r,y],..] around Y. o.n segments, o.sm smooth joints */
  lat(prof, o) {
    o = o || {}; const n = o.n || 16, P = [], N = [], I = [];
    const segN = [];
    for (let j = 0; j < prof.length - 1; j++) {
      const dr = prof[j + 1][0] - prof[j][0], dy = prof[j + 1][1] - prof[j][1], l = Math.hypot(dr, dy) || 1;
      segN.push([dy / l, -dr / l]);
    }
    const ringN = j => { // smooth normal at profile vertex j
      const a = segN[Math.max(0, j - 1)], b = segN[Math.min(segN.length - 1, j)];
      const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l];
    };
    for (let j = 0; j < prof.length - 1; j++) {
      const l0 = Math.hypot(prof[j][0] - prof[j + 1][0], prof[j][1] - prof[j + 1][1]); if (l0 < 1e-9) continue;
      const base = P.length / 3;
      for (let k = 0; k <= 1; k++) {
        const pv = prof[j + k], nn = o.sm ? ringN(j + k) : segN[j];
        for (let i = 0; i <= n; i++) {
          const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
          P.push(pv[0] * c, pv[1], pv[0] * s); N.push(nn[0] * c, nn[1], nn[0] * s);
        }
      }
      for (let i = 0; i < n; i++) { const a = base + i, b = base + i + 1, c = base + n + 1 + i, d = base + n + 1 + i + 1; I.push(a, b, d, a, d, c); }
    }
    return this._emit(P, N, I, o);
  }
  /* cylinder / cone. axis o.ax: 'z' (default) 'y' 'x'. r1 = far radius. */
  cyl(x, y, z, r, len, o) {
    o = o || {}; const r1 = o.r1 === undefined ? r : o.r1, ax = o.ax || 'z';
    const prof = o.cap === false ? [[r, -len / 2], [r1, len / 2]] : [[0, -len / 2], [r, -len / 2], [r1, len / 2], [0, len / 2]];
    const oo = Object.assign({}, o, { t: [x, y, z] });
    // build via lathe then orient
    const tmp = new Part(null, 'tmp'); tmp.cc = this.cc; tmp.cm = this.cm; tmp.lat(prof, { n: o.n || 14, c: o.c, m: o.m });
    const g = tmp.geo; const P = g.P.slice(), N = g.N.slice(), I = g.I.slice();
    let am = M4.id(); if (ax === 'z') am = M4.Rx(90); else if (ax === 'x') am = M4.Rz(-90);
    // transform local points by axis rotation first
    const P2 = [], N2 = [];
    for (let i = 0; i < P.length / 3; i++) {
      const p = M4.xp(am, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]), n = M4.xd(am, [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]]);
      P2.push(p[0], p[1], p[2]); N2.push(n[0], n[1], n[2]);
    }
    return this._emit(P2, N2, I, oo);
  }
  sph(x, y, z, r, o) {
    o = o || {}; const m = o.k || 8, prof = [];
    for (let i = 0; i <= m; i++) { const a = (-90 + 180 * i / m) * D2R; prof.push([Math.max(0, r * Math.cos(a)), r * Math.sin(a)]); }
    return this.lat(prof, Object.assign({ sm: true, n: o.n || 14 }, o, { t: [x, y, z].map((v, i) => v + ((o.t || [0, 0, 0])[i])) }));
  }
  /* extrude polygon. ax 'x': poly [[z,y]] extruded along x (centred, depth); 'y': poly [[x,z]] from y0 up by depth; 'z': poly [[x,y]] along z centred.
     o.tp far-end scale (taper), o.off [du,dv] far-end shift, o.sm smooth wall normals, o.x/o.y/o.z offsets via o.t */
  ext(poly, depth, o) {
    o = o || {}; const ax = o.ax || 'x', tp = o.tp === undefined ? 1 : o.tp, off = o.off || [0, 0], n = poly.length;
    let a0, a1; if (ax === 'y') { a0 = o.y0 || 0; a1 = a0 + depth; } else { a0 = -depth / 2; a1 = depth / 2; }
    let cu = 0, cv = 0; for (const p of poly) { cu += p[0]; cv += p[1]; } cu /= n; cv /= n;
    let area = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area >= 0 ? 1 : -1;
    const map = (u, v, a) => ax === 'x' ? [a, v, u] : ax === 'y' ? [u, a, v] : [u, v, a];
    const B = poly.map(p => map(p[0], p[1], a0)), F = poly.map(p => map(cu + (p[0] - cu) * tp + off[0], cv + (p[1] - cv) * tp + off[1], a1));
    const P = [], N = [], I = [];
    const faceN = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, e = V3.sub(B[j], B[i]), w = V3.sub(F[i], B[i]);
      let nn = V3.norm(V3.cross(e, w));
      if (V3.len(V3.cross(e, w)) < 1e-9) nn = [0, 0, 0];
      const du = poly[j][0] - poly[i][0], dv = poly[j][1] - poly[i][1];
      const out2 = map(sg * dv, -sg * du, 0); const outv = [out2[0], out2[1], out2[2]];
      if (ax === 'x') { outv[0] = 0; } else if (ax === 'y') { outv[1] = 0; } else { outv[2] = 0; }
      if (V3.dot(nn, outv) < 0) nn = V3.mul(nn, -1);
      faceN.push(nn);
    }
    if (o.sm) {
      const vn = []; for (let i = 0; i < n; i++) { const a = faceN[(i + n - 1) % n], b = faceN[i]; vn.push(V3.norm(V3.add(a, b))); }
      const base = P.length / 3;
      for (let i = 0; i < n; i++) { P.push(...B[i]); N.push(...vn[i]); }
      for (let i = 0; i < n; i++) { P.push(...F[i]); N.push(...vn[i]); }
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; I.push(base + i, base + j, base + n + j, base + i, base + n + j, base + n + i); }
    } else {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, base = P.length / 3, nn = faceN[i];
        for (const p of [B[i], B[j], F[j], F[i]]) { P.push(...p); N.push(...nn); }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const tris = triangulate(poly);
    const axv = ax === 'x' ? [1, 0, 0] : ax === 'y' ? [0, 1, 0] : [0, 0, 1];
    if (!o.nocap0) { const base = P.length / 3; for (const p of B) { P.push(...p); N.push(-axv[0], -axv[1], -axv[2]); } for (const t of tris) I.push(base + t[0], base + t[1], base + t[2]); }
    if (!o.nocap1) { const base = P.length / 3; for (const p of F) { P.push(...p); N.push(...axv); } for (const t of tris) I.push(base + t[0], base + t[1], base + t[2]); }
    return this._emit(P, N, I, o);
  }
  /* loft rounded sections along z. secs: [{z,w,h,y,x,n,pts}], o.k ring points, o.cap0/cap1 */
  lof(secs, o) {
    o = o || {}; const K = o.k || 20, S = secs.length, P = [], N = [], I = [];
    const ring = (s) => {
      const out = [];
      if (s.pts) { for (const p of s.pts) out.push([p[0] + (s.x || 0), p[1]]); return out; }
      const e = 2 / (s.n || 2.4);
      for (let i = 0; i < K; i++) {
        const a = i / K * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        const px = Math.sign(c) * Math.pow(Math.abs(c), e) * s.w / 2 + (s.x || 0);
        let py = Math.sign(sn) * Math.pow(Math.abs(sn), e) * s.h / 2 + (s.y || 0);
        if (s.flat && sn < 0) py = (s.y || 0) - s.h / 2; // flat bottom
        out.push([px, py]);
      }
      return out;
    };
    const R = secs.map(ring), kk = R[0].length;
    const Pos = []; for (let s = 0; s < S; s++) for (let i = 0; i < kk; i++) Pos.push([R[s][i][0], R[s][i][1], secs[s].z]);
    const nrm = Pos.map(() => [0, 0, 0]);
    const id = (s, i) => s * kk + ((i + kk) % kk);
    for (let s = 0; s < S - 1; s++) for (let i = 0; i < kk; i++) {
      const a = id(s, i), b = id(s, i + 1), c = id(s + 1, i + 1), d = id(s + 1, i);
      const e1 = V3.sub(Pos[b], Pos[a]), e2 = V3.sub(Pos[d], Pos[a]); let fn = V3.cross(e1, e2);
      const ctr = [secs[s].x || 0, secs[s].y || 0, secs[s].z]; const mid = V3.sub(Pos[a], ctr); mid[2] = 0;
      if (V3.dot(fn, mid) < 0) fn = V3.mul(fn, -1);
      for (const v of [a, b, c, d]) { nrm[v][0] += fn[0]; nrm[v][1] += fn[1]; nrm[v][2] += fn[2]; }
      I.push(a, b, c, a, c, d);
    }
    for (let i = 0; i < Pos.length; i++) { P.push(...Pos[i]); const nn = V3.norm(nrm[i]); N.push(...nn); }
    const cap = (s, dir) => {
      const base = P.length / 3, c = [secs[s].x || 0, secs[s].y || 0, secs[s].z];
      P.push(...c); N.push(0, 0, dir);
      for (let i = 0; i < kk; i++) { P.push(...Pos[id(s, i)]); N.push(0, 0, dir); }
      for (let i = 0; i < kk; i++) I.push(base, base + 1 + i, base + 1 + ((i + 1) % kk));
    };
    if (o.cap0) cap(0, -1); if (o.cap1) cap(S - 1, 1);
    return this._emit(P, N, I, o);
  }
  /* planar polygon in 3D, optionally double sided */
  poly(pts, o) {
    o = o || {}; const n = pts.length;
    let nn = [0, 0, 0]; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; nn[0] += (a[1] - b[1]) * (a[2] + b[2]); nn[1] += (a[2] - b[2]) * (a[0] + b[0]); nn[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    nn = V3.norm(nn); const ax = Math.abs(nn[0]) > Math.abs(nn[1]) && Math.abs(nn[0]) > Math.abs(nn[2]) ? 0 : (Math.abs(nn[1]) > Math.abs(nn[2]) ? 1 : 2);
    const p2 = pts.map(p => ax === 0 ? [p[1], p[2]] : ax === 1 ? [p[0], p[2]] : [p[0], p[1]]);
    const tris = triangulate(p2), P = [], N = [], I = [];
    for (const p of pts) { P.push(...p); N.push(...nn); }
    for (const t of tris) I.push(t[0], t[1], t[2]);
    if (o.two) { const b = n; for (const p of pts) { P.push(...p); N.push(-nn[0], -nn[1], -nn[2]); } for (const t of tris) I.push(b + t[0], b + t[1], b + t[2]); }
    return this._emit(P, N, I, o);
  }
  /* wheel with tyre + hub, axis X. */
  wheel(x, y, z, r, w, o) {
    o = o || {}; const tc = o.tire !== undefined ? o.tire : 0x1b1b1b, hc = o.hub !== undefined ? o.hub : this.cc;
    this.cyl(x, y, z, r, w, { ax: 'x', c: tc, m: 0, n: o.n || 16 });
    this.cyl(x + Math.sign(x || 1) * w * 0.52, y, z, r * 0.62, w * 0.1, { ax: 'x', c: hc, m: 1, n: o.n || 16 });
    return this;
  }
  finish() { if (!this.geo.baked && this.geo.n) this.geo.bake(); else if (!this.geo.baked) { this.geo.V = new Float32Array(0); this.geo.Idx = new Uint32Array(0); this.geo.baked = true; } return this; }
}

/* ===== model ===== */
class Model {
  constructor(id) { this.id = id; this.parts = []; this.anchors = {}; this.xf = M4.id(); this.meta = {}; this.root = null; }
  part(name, parent, pivot) { const p = new Part(this, name, parent, pivot); this.parts.push(p); if (!this.root) this.root = p; return p; }
  anchor(name, part, pos, dir) { this.anchors[name] = { part, pos, dir: dir || [0, 0, 1] }; return this; }
  find(name) { return this.parts.find(p => p.name === name); }
  updateWorld() {
    for (const p of this.parts) {
      const base = p.parent ? p.parent.world : this.xf;
      let m = M4.mul(base, M4.T(p.pivot[0] + p.off[0], p.pivot[1] + p.off[1], p.pivot[2] + p.off[2]));
      if (p.rot[0] || p.rot[1] || p.rot[2]) m = M4.mul(m, M4.R(p.rot[0], p.rot[1], p.rot[2]));
      if (p.sc[0] !== 1 || p.sc[1] !== 1 || p.sc[2] !== 1) m = M4.mul(m, M4.S(p.sc[0], p.sc[1], p.sc[2]));
      p.world = m;
    }
  }
  aw(name) { const a = this.anchors[name]; if (!a) return null; return { p: M4.xp(a.part.world, a.pos), d: V3.norm(M4.xd(a.part.world, a.dir)) }; }
  finish() {
    for (const p of this.parts) p.finish();
    // bbox at rest
    const saved = this.xf; this.xf = M4.id();
    for (const p of this.parts) { p.rot = p.rot.slice(); }
    this.updateWorld();
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of this.parts) {
      const V = p.geo.V; if (!V || !V.length) continue;
      for (let i = 0; i < V.length; i += 13) {
        const q = M4.xp(p.world, [V[i], V[i + 1], V[i + 2]]);
        for (let k = 0; k < 3; k++) { if (q[k] < mn[k]) mn[k] = q[k]; if (q[k] > mx[k]) mx[k] = q[k]; }
      }
    }
    this.bmin = mn; this.bmax = mx; this.xf = saved;
    this.size = V3.sub(mx, mn); this.radius = V3.len(this.size) / 2; this.center = V3.mul(V3.add(mn, mx), 0.5);
    return this;
  }
}
