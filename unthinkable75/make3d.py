#!/usr/bin/env python3
"""Build src/models3d.js from models/src (the models chat's sources) + models/gamemap.json.
Adds: render-to-sprite support (transparent bare renders) used for the map icons, and a pause flag for the viewer loop."""
import os, json
here = os.path.dirname(os.path.abspath(__file__)); d = os.path.join(here, 'models/src')
files = sorted(f for f in os.listdir(d) if f.endswith('.js') and f not in ('y_ui.js', 'z_boot.js'))
body = '\n'.join('/* ---- ' + f + ' ---- */\n' + open(os.path.join(d, f), encoding='utf-8').read() for f in files)
def rep(a, b):
    global body
    assert a in body, a[:70]; body = body.replace(a, b, 1)
rep("try { this.frame(dt); }", "try { if (!this.off) this.frame(dt); }")
rep("class Renderer {\n  constructor(canvas) {", "class Renderer {\n  constructor(canvas, xo) {")
rep("alpha: false,", "alpha: !!(xo && xo.alpha),")
rep("gl.clearColor(env.hor[0], env.hor[1], env.hor[2], 1);", "if (sc.bare) gl.clearColor(0, 0, 0, 0); else gl.clearColor(env.hor[0], env.hor[1], env.hor[2], 1);")
rep("gl.bindBuffer(gl.ARRAY_BUFFER, this.sVB); gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);",
    "if (!sc.bare) { gl.bindBuffer(gl.ARRAY_BUFFER, this.sVB); gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); }")
rep("if (!sc.water) {\n      p = this.pGround;", "if (!sc.water && !sc.bare) {\n      p = this.pGround;")
rep("col = col/(1.0+col*0.12);", "col = col/(1.0+col)*1.55;")
rep("const P = M4.persp(fov, asp, cam.near, cam.far), VP = M4.mul(P, V);", "const P = M4.persp(fov, asp, cam.near, cam.far), VP = sc.vp || M4.mul(P, V);")
rep("    gl.cullFace(gl.BACK);\n    for (const m of all) this.drawModel(m, env, 0);", "    gl.cullFace(gl.BACK); if (sc.nocull) gl.disable(gl.CULL_FACE);\n    each((m) => this.drawModel(m, env, 0));")
rep("      for (const m of all) this.drawModel(m, env, 1);\n      gl.uniform1f(p.u.uOut, 0);", "      each((m) => this.drawModel(m, env, 1));\n      gl.uniform1f(p.u.uOut, 0);")
rep("    const all = sc.models.concat(sc.ents || []);", "    const all = sc.models.concat(sc.ents || []);\n    const each = (fn) => { if (sc.draws) { for (const d of sc.draws) { d.m.xf = d.xf; d.m.updateWorld(); fn(d.m); } } else for (const m of all) fn(m); };\n    gl.frontFace(sc.cw ? gl.CW : gl.CCW);")
gm = json.load(open(os.path.join(here, 'models/gamemap.json')))['map']
tail = '''
var SP = { cache: {}, rd: undefined, cam: null, ps: null };
function spriteInit() {
  if (SP.rd !== undefined) return SP.rd;
  var cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;left:-4000px;top:0;width:128px;height:128px;pointer-events:none';
  document.body.appendChild(cv);
  try { SP.rd = new Renderer(cv, { alpha: true }); if (!SP.rd.ok) SP.rd = null; } catch (e) { SP.rd = null; }
  SP.cam = new Cam(); SP.ps = new Particles(); return SP.rd;
}
/* small transparent picture of a model (canvas 96x96) for map icons; top = straight from above, nose pointing up; null when WebGL is missing */
function sprite(id, top) {
  var key = id + (top ? ':t' : ':a'); if (SP.cache[key] !== undefined) return SP.cache[key];
  var rd = spriteInit(); if (!rd) return (SP.cache[key] = null);
  try {
    var m = getModel(id); m.resetPose(); m.xf = M4.id(); m.updateWorld();
    var R = Math.max(m.radius, 1), c = m.center, cam = SP.cam;
    cam.az = top ? 180 : 40; cam.el = top ? 89 : 32; cam.tgt = [c[0], c[1], c[2]]; cam.want = cam.tgt.slice(); cam.dist = R * (top ? 2.7 : 3.0); cam.near = Math.max(0.05, R * 0.05); cam.far = R * 40; cam.sh = [0, 0, 0];
    rd.render({ cam: cam, models: [m], ents: [], env: MAPENV, ps: SP.ps, water: false, t: 0, R: R, flash: 0, toon: true, outline: true, shadows: false, bare: true, outlinePx: 1.8 });
    var out = document.createElement('canvas'); out.width = out.height = 96; out.getContext('2d').drawImage(rd.cv, 0, 0, rd.cv.width, rd.cv.height, 0, 0, 96, 96);
    return (SP.cache[key] = out);
  } catch (e) { return (SP.cache[key] = null); }
}

var MAPENV = Object.assign({}, ENVS.day, { sunCol: [0.82, 0.76, 0.66], skyL: [0.50, 0.55, 0.68], gndL: [0.38, 0.36, 0.30] });
var LV = { rd: undefined, cv: null, cam: null };
function liveInit(cv) {
  if (LV.cv !== cv) { LV.cv = cv; try { LV.rd = new Renderer(cv, { alpha: true }); if (!LV.rd.ok) LV.rd = null; } catch (e) { LV.rd = null; } LV.cam = new Cam(); LV.cam.fov = 38; }
  return LV.rd;
}
/* draw REAL 3D models on the live map: items [{id,x,z,hd,px,lift}], P {cw,ch,ox,oy,tilt(rad),sc,d}; matches the CSS perspective/rotateX/scale of the 2D map canvas */
function live(cv, items, P, flip) {
  var rd = liveInit(cv); if (!rd) return false;
  var S = P.sc, a = P.tilt, c = Math.cos(a), s = Math.sin(a), d = P.d, cw = P.cw, ch = P.ch;
  var wr = [0, -(S / d) * c, -(S / d) * s, 1], kx = 2 * P.ox / cw - 1, k2 = 2 * P.oy / ch - 1;
  var xr = [2 * S / cw + kx * wr[0], kx * wr[1], kx * wr[2], kx];
  var yr = [-k2 * wr[0], (2 / ch) * S * s - k2 * wr[1], -(2 / ch) * S * c - k2 * wr[2], -k2];
  var zr = [1.5 * wr[0], 1.5 * wr[1], 1.5 * wr[2], 0.5];
  var rows = [xr, yr, zr, wr], vp = new Float32Array(16);
  for (var r = 0; r < 4; r++) for (var q = 0; q < 4; q++) vp[q * 4 + r] = rows[r][q];
  var draws = [];
  items.forEach(function (it) {
    var m; try { m = getModel(it.id); } catch (e) { return; }
    var L = Math.max(m.size[0], m.size[2], 0.01); if (L <= 14) L = Math.min(L, Math.max(m.size[0], 1) * 2.4); var k = it.px / L * ((it.id === 'bridge' || it.id === 'peng') ? 0.7 : 1);
    var xf = M4.mul(M4.mul(M4.mul(M4.T(it.x, it.lift || 0, it.z), M4.Ry((Math.PI - it.hd) * 180 / Math.PI)), M4.S(k, k, k)), M4.T(-m.center[0], -m.bmin[1], -m.center[2]));
    draws.push({ m: m, xf: xf });
  });
  rd.render({ cam: LV.cam, models: [], ents: [], env: MAPENV, ps: null, water: false, t: 0, R: 5, flash: 0, toon: true, outline: true, shadows: false, bare: true, outlinePx: 1.2, vp: vp, draws: draws, cw: flip });
  return true;
}
'''
out = ("/* 3D model viewer: engine + vehicle models (from models/src, built by make3d.py). Exposes window.U75_3D */\nwindow.U75_3D = (function () {\n" + body + tail +
       "\nvar MAP3D = " + json.dumps(gm) + ";\nreturn { App: App, REG: REG, ORDER: ORDER, ENVS: ENVS, PROFILES: typeof PROFILES !== 'undefined' ? PROFILES : {}, MAP: MAP3D, getModel: getModel, sprite: sprite, live: live, liveOK: function(cv){ return !!liveInit(cv); } };\n})();\n")
open(os.path.join(here, 'src/models3d.js'), 'w', encoding='utf-8').write(out)
print('models3d.js', len(out) // 1024, 'KB')
