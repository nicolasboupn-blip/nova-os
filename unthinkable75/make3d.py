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
/* small transparent picture of a model (canvas 96x96) for map icons; null when WebGL is missing */
function sprite(id) {
  if (SP.cache[id] !== undefined) return SP.cache[id];
  var rd = spriteInit(); if (!rd) return (SP.cache[id] = null);
  try {
    var m = getModel(id); m.resetPose(); m.xf = M4.id(); m.updateWorld();
    var R = Math.max(m.radius, 1), c = m.center, cam = SP.cam;
    cam.az = 40; cam.el = 32; cam.tgt = [c[0], c[1], c[2]]; cam.want = cam.tgt.slice(); cam.dist = R * 3.0; cam.near = Math.max(0.05, R * 0.05); cam.far = R * 40; cam.sh = [0, 0, 0];
    rd.render({ cam: cam, models: [m], ents: [], env: ENVS.day, ps: SP.ps, water: false, t: 0, R: R, flash: 0, toon: true, outline: true, shadows: false, bare: true, outlinePx: 1.8 });
    var out = document.createElement('canvas'); out.width = out.height = 96; out.getContext('2d').drawImage(rd.cv, 0, 0, rd.cv.width, rd.cv.height, 0, 0, 96, 96);
    return (SP.cache[id] = out);
  } catch (e) { return (SP.cache[id] = null); }
}
'''
out = ("/* 3D model viewer: engine + vehicle models (from models/src, built by make3d.py). Exposes window.U75_3D */\nwindow.U75_3D = (function () {\n" + body + tail +
       "\nvar MAP3D = " + json.dumps(gm) + ";\nreturn { App: App, REG: REG, ORDER: ORDER, ENVS: ENVS, PROFILES: typeof PROFILES !== 'undefined' ? PROFILES : {}, MAP: MAP3D, getModel: getModel, sprite: sprite };\n})();\n")
open(os.path.join(here, 'src/models3d.js'), 'w', encoding='utf-8').write(out)
print('models3d.js', len(out) // 1024, 'KB')
