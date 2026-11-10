'use strict';
/* ===== shaders ===== */
const SH = {};
SH.mainV = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol; attribute float aMat; attribute vec3 aON;
uniform mat4 uVP; uniform mat4 uM; uniform float uOut; uniform vec3 uCam;
varying vec3 vN; varying vec3 vCol; varying float vMat; varying vec3 vW;
void main(){
  vec4 w = uM * vec4(aPos,1.0);
  vec3 wn = mat3(uM)*aNrm;
  if(uOut>0.0){ vec3 on = normalize(mat3(uM)*aON); float d = length(uCam-w.xyz); w.xyz += on*uOut*d; }
  vW=w.xyz; vN=wn; vCol=aCol; vMat=aMat;
  gl_Position = uVP*w;
}`;
SH.mainF = `
precision highp float;
varying vec3 vN; varying vec3 vCol; varying float vMat; varying vec3 vW;
uniform vec3 uSun; uniform vec3 uCam; uniform vec3 uSky; uniform vec3 uGnd; uniform vec3 uSunCol;
uniform float uFlash; uniform float uMode; uniform float uToon; uniform vec4 uTint; uniform vec3 uOutC;
uniform float uWater; uniform float uBase; uniform float uShA;
void main(){
  if(uMode>1.5){ gl_FragColor=vec4(0.02,0.03,0.05,uShA); return; }
  if(uMode>0.5){ gl_FragColor=vec4(uOutC,1.0); return; }
  vec3 N = normalize(vN); vec3 V = normalize(uCam-vW); vec3 L = normalize(uSun);
  float nl = dot(N,L); float diff = max(nl,0.0);
  if(uToon>0.5){ diff = smoothstep(-0.02,0.1,nl)*0.5 + smoothstep(0.42,0.56,nl)*0.5; }
  float hemi = N.y*0.5+0.5;
  vec3 amb = mix(uGnd,uSky,hemi);
  float ao = mix(0.6,1.0,smoothstep(0.0,0.9,vW.y-uBase));
  vec3 col;
  float fr = pow(1.0-max(dot(N,V),0.0),3.0);
  if(vMat>1.5 && vMat<2.5){ col = vCol*1.7; }
  else {
    col = vCol*(amb*0.95*ao + uSunCol*diff*1.0);
    vec3 H = normalize(L+V); float sp = pow(max(dot(N,H),0.0),56.0);
    if(vMat>0.5 && vMat<1.5){ col += uSunCol*sp*0.32*step(0.0,nl) + uSky*fr*0.10; }
    else if(vMat>2.5){ col = vCol*0.35*amb + uSunCol*sp*1.4*step(0.0,nl) + uSky*(0.22+fr*0.55); }
    col += uSky*fr*0.05;
  }
  col += vec3(uFlash)*(0.5+0.5*max(nl,0.0));
  if(uWater>-1000.0){ float dep = clamp((uWater-vW.y)/max(uBase,0.001),0.0,1.0); col = mix(col, vec3(0.01,0.09,0.13), dep*0.78); }
  col = mix(col,uTint.rgb,uTint.a);
  col = col/(1.0+col*0.12);
  col = pow(col,vec3(1.0/2.2));
  gl_FragColor = vec4(col,1.0);
}`;
SH.groundV = `
attribute vec3 aPos; uniform mat4 uVP; uniform float uSize; varying vec3 vW;
void main(){ vec3 w = vec3(aPos.x*uSize, 0.0, aPos.z*uSize); vW=w; gl_Position=uVP*vec4(w,1.0); }`;
SH.groundF = `
precision highp float; varying vec3 vW;
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uFog; uniform float uSize; uniform float uPad; uniform vec3 uCam; uniform float uTheme;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec2 p = vW.xz/uSize*14.0;
  float t = n(p)*0.55+n(p*2.3)*0.3+n(p*6.1)*0.15;
  vec3 c = mix(uC1,uC2,t);
  float r = length(vW.xz);
  // tracks / pad
  float pad = 1.0-smoothstep(uPad,uPad*1.12,r);
  vec3 padC = vec3(0.20,0.21,0.22)*(0.9+0.2*n(p*9.0));
  c = mix(c,padC,pad*0.92);
  float ring = smoothstep(uPad*0.985,uPad,r)*(1.0-smoothstep(uPad,uPad*1.015,r));
  c = mix(c,vec3(0.85,0.7,0.2),ring*0.8);
  float d = length(vW-uCam);
  float fog = smoothstep(uSize*0.35,uSize*1.0,r);
  c = mix(c,uFog,fog);
  c = pow(c,vec3(1.0/2.2));
  gl_FragColor = vec4(c,1.0);
}`;
SH.waterV = `
attribute vec3 aPos; uniform mat4 uVP; uniform float uSize; uniform float uT; uniform float uAmp; uniform vec3 uK; uniform vec2 uDrift;
varying vec3 vW; varying vec3 vN; varying float vH;
void main(){
  vec2 p = aPos.xz*uSize - uDrift;
  vec2 d1=vec2(0.82,0.57), d2=vec2(-0.47,0.88), d3=vec2(0.25,-0.97);
  float a1=dot(p,d1)*uK.x+uT*1.0, a2=dot(p,d2)*uK.y+uT*1.35, a3=dot(p,d3)*uK.z+uT*1.9;
  float hgt = uAmp*(sin(a1)+0.55*sin(a2)+0.28*sin(a3));
  vec2 g = uAmp*(cos(a1)*uK.x*d1 + 0.55*cos(a2)*uK.y*d2 + 0.28*cos(a3)*uK.z*d3);
  vec3 w = vec3(aPos.x*uSize,hgt,aPos.z*uSize); vW=w; vH=hgt; vN=normalize(vec3(-g.x,1.0,-g.y));
  gl_Position=uVP*vec4(w,1.0);
}`;
SH.waterF = `
precision highp float; varying vec3 vW; varying vec3 vN; varying float vH;
uniform vec3 uCam; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uDeep; uniform vec3 uShal; uniform vec3 uFog; uniform float uSize; uniform float uAmp; uniform float uAlpha;
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uCam-vW); vec3 L=normalize(uSun);
  float fr=pow(1.0-max(dot(N,V),0.0),4.0);
  vec3 c=mix(uDeep,uShal,clamp(0.5+vH/(uAmp*3.5),0.0,1.0));
  c=mix(c,vec3(0.55,0.72,0.85),fr*0.55);
  vec3 H=normalize(L+V); float sp=pow(max(dot(N,H),0.0),180.0);
  c+=uSunCol*sp*0.9;
  float foam=smoothstep(uAmp*2.15,uAmp*2.5,vH); c=mix(c,vec3(0.92),foam*0.5);
  float r=length(vW.xz); float fog=smoothstep(uSize*0.45,uSize,r); c=mix(c,uFog,fog);
  c=pow(c,vec3(1.0/2.2));
  gl_FragColor=vec4(c,mix(uAlpha,1.0,max(fr,fog)));
}`;
SH.skyV = `attribute vec2 aPos; varying vec2 vP; void main(){ vP=aPos; gl_Position=vec4(aPos,0.9999,1.0); }`;
SH.skyF = `
precision highp float; varying vec2 vP;
uniform vec3 uF; uniform vec3 uR; uniform vec3 uU; uniform vec2 uTan; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol;
void main(){
  vec3 d = normalize(uF + uR*vP.x*uTan.x + uU*vP.y*uTan.y);
  float t = clamp(d.y,0.0,1.0);
  vec3 c = mix(uHor,uTop,pow(t,0.55));
  if(d.y<0.0) c = uHor*(1.0+d.y*0.3);
  float s = max(dot(d,normalize(uSun)),0.0);
  c += uSunCol*(pow(s,600.0)*2.0+pow(s,28.0)*0.28);
  c=pow(c,vec3(1.0/2.2));
  gl_FragColor=vec4(c,1.0);
}`;
SH.partV = `
attribute vec3 aC; attribute vec2 aK; attribute float aS; attribute float aR; attribute vec4 aCol; attribute float aT;
uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp; varying vec2 vUV; varying vec4 vCol;
void main(){
  float c=cos(aR), s=sin(aR); vec2 k=vec2(aK.x*c-aK.y*s, aK.x*s+aK.y*c);
  vec3 w = aC + (uRight*k.x+uUp*k.y)*aS;
  vUV = vec2((aK.x*0.5+0.5)*0.97+0.015+aT, (aK.y*0.5+0.5)*0.97+0.015)*vec2(0.25,1.0); vCol=aCol;
  gl_Position=uVP*vec4(w,1.0);
}`;
SH.partF = `
precision highp float; varying vec2 vUV; varying vec4 vCol; uniform sampler2D uTex; uniform float uAdd;
void main(){ vec4 t=texture2D(uTex,vUV); float a=t.a*vCol.a; if(a<0.004) discard;
  vec3 c = vCol.rgb*(uAdd>0.5?1.0:(0.55+0.45*t.r));
  gl_FragColor=vec4(c,a); }`;

/* ===== renderer ===== */
class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    const opt = { antialias: true, stencil: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' };
    this.gl = canvas.getContext('webgl', opt) || canvas.getContext('experimental-webgl', opt);
    const gl = this.gl; this.ok = !!gl; if (!gl) return;
    gl.getExtension('OES_element_index_uint');
    this.pMain = this.prog(SH.mainV, SH.mainF); this.pGround = this.prog(SH.groundV, SH.groundF);
    this.pWater = this.prog(SH.waterV, SH.waterF); this.pSky = this.prog(SH.skyV, SH.skyF); this.pPart = this.prog(SH.partV, SH.partF);
    this.mkGround(); this.mkWater(); this.mkSky(); this.mkAtlas();
    this.pvb = gl.createBuffer(); this.pib = gl.createBuffer();
    this.maxP = 9000; this.pbuf = new Float32Array(this.maxP * 4 * 12);
    const idx = new Uint16Array(this.maxP * 6); for (let i = 0; i < this.maxP; i++) { const a = i * 4; idx.set([a, a + 1, a + 2, a, a + 2, a + 3], i * 6); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.pib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.W = 1; this.H = 1;
  }
  prog(vs, fs) {
    const gl = this.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + s); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); p.u[a.name] = gl.getUniformLocation(p, a.name); }
    p.a = {}; const m = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < m; i++) { const a = gl.getActiveAttrib(p, i); p.a[a.name] = gl.getAttribLocation(p, a.name); }
    return p;
  }
  mkGround() {
    const gl = this.gl, P = [], I = [], seg = 72, rings = 10;
    P.push(0, 0, 0);
    for (let r = 1; r <= rings; r++) for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, rr = Math.pow(r / rings, 1.0); P.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); }
    for (let i = 0; i < seg; i++) I.push(0, 1 + i, 1 + (i + 1) % seg);
    for (let r = 1; r < rings; r++) for (let i = 0; i < seg; i++) {
      const a = 1 + (r - 1) * seg + i, b = 1 + (r - 1) * seg + (i + 1) % seg, c = 1 + r * seg + i, d = 1 + r * seg + (i + 1) % seg;
      I.push(a, c, b, b, c, d);
    }
    this.gVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.gVB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
    this.gIB = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gIB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW); this.gN = I.length;
  }
  mkWater() {
    const gl = this.gl, N = 120, P = [], I = [];
    for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) P.push(x / N * 2 - 1, 0, z / N * 2 - 1);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const a = z * (N + 1) + x, b = a + 1, c = a + N + 1, d = c + 1; I.push(a, c, b, b, c, d); }
    this.wVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.wVB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
    this.wIB = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wIB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW); this.wN = I.length;
  }
  mkSky() { const gl = this.gl; this.sVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.sVB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); }
  mkAtlas() {
    const gl = this.gl, S = 128, cv = document.createElement('canvas'); cv.width = S * 4; cv.height = S; const g = cv.getContext('2d');
    // 0 soft glow
    let gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // 1 smoke puff: many overlapping soft circles (seeded)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.save(); g.translate(S, 0); g.beginPath(); g.rect(0, 0, S, S); g.clip();
    for (let i = 0; i < 46; i++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * S * 0.27, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, r = S * (0.1 + rnd() * 0.16);
      const q = g.createRadialGradient(x, y, 0, x, y, r); const l = 150 + rnd() * 105 | 0; q.addColorStop(0, `rgba(${l},${l},${l},0.38)`); q.addColorStop(1, `rgba(${l},${l},${l},0)`);
      g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const edge = g.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.5); edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = edge; g.fillRect(0, 0, S, S); g.restore(); g.globalCompositeOperation = 'source-over';
    // 2 ring
    g.save(); g.translate(S * 2, 0); gr = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S); g.restore();
    // 3 spark / flare: hard core + soft halo
    g.save(); g.translate(S * 3, 0); gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S); g.restore();
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlas = tex;
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = this.cv.clientWidth || 300, h = this.cv.clientHeight || 300;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    this.W = W; this.H = H;
  }
  upload(geo) {
    const gl = this.gl;
    geo.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, geo.vb); gl.bufferData(gl.ARRAY_BUFFER, geo.V, gl.STATIC_DRAW);
    geo.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.Idx, gl.STATIC_DRAW);
  }
  drawModel(model, env, mode, shadowM, extra) {
    const gl = this.gl, p = this.pMain;
    for (const part of model.parts) {
      if (!part.vis) continue; const g = part.geo; if (!g.V || !g.Idx.length) continue; if (!g.vb) this.upload(g);
      if (mode === 1 && part.outline === false) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, g.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib);
      const st = 52; gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(p.a.aNrm); gl.vertexAttribPointer(p.a.aNrm, 3, gl.FLOAT, false, st, 12);
      gl.enableVertexAttribArray(p.a.aCol); gl.vertexAttribPointer(p.a.aCol, 3, gl.FLOAT, false, st, 24);
      gl.enableVertexAttribArray(p.a.aMat); gl.vertexAttribPointer(p.a.aMat, 1, gl.FLOAT, false, st, 36);
      gl.enableVertexAttribArray(p.a.aON); gl.vertexAttribPointer(p.a.aON, 3, gl.FLOAT, false, st, 40);
      gl.uniformMatrix4fv(p.u.uM, false, shadowM ? M4.mul(shadowM, part.world) : part.world);
      if (part.tint) gl.uniform4fv(p.u.uTint, part.tint); else gl.uniform4f(p.u.uTint, 0, 0, 0, 0);
      gl.drawElements(gl.TRIANGLES, g.Idx.length, gl.UNSIGNED_INT, 0);
    }
  }
  /* scene: {cam, models:[], ents:[], env, ps, water(bool), t} */
  render(sc) {
    const gl = this.gl; this.resize(); const env = sc.env, cam = sc.cam, W = this.W, H = this.H;
    gl.viewport(0, 0, W, H); gl.clearColor(env.hor[0], env.hor[1], env.hor[2], 1); gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const asp = W / H, fov = cam.fov, eye = cam.eye(), V = M4.lookAt(eye, cam.tgt, [0, 1, 0]);
    const P = M4.persp(fov, asp, cam.near, cam.far), VP = M4.mul(P, V);
    this.VP = VP; this.camRight = [V[0], V[4], V[8]]; this.camUp = [V[1], V[5], V[9]]; this.eye = eye;
    const tanY = Math.tan(fov * D2R / 2);
    // sky
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    let p = this.pSky; gl.useProgram(p); const fwd = V3.norm(V3.sub(cam.tgt, eye));
    gl.uniform3fv(p.u.uF, fwd); gl.uniform3fv(p.u.uR, this.camRight); gl.uniform3fv(p.u.uU, this.camUp); gl.uniform2f(p.u.uTan, tanY * asp, tanY);
    gl.uniform3fv(p.u.uTop, env.top); gl.uniform3fv(p.u.uHor, env.hor); gl.uniform3fv(p.u.uSun, env.sun); gl.uniform3fv(p.u.uSunCol, env.sunCol);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sVB); gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    const R = sc.R || 5, size = R * 16;
    // ground
    if (!sc.water) {
      p = this.pGround; gl.useProgram(p); gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.uniform1f(p.u.uSize, size); gl.uniform1f(p.u.uPad, R * 1.9);
      gl.uniform3fv(p.u.uC1, env.g1); gl.uniform3fv(p.u.uC2, env.g2); gl.uniform3fv(p.u.uFog, env.hor); gl.uniform3fv(p.u.uCam, eye);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.gVB); gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gIB); gl.drawElements(gl.TRIANGLES, this.gN, gl.UNSIGNED_SHORT, 0);
    }
    // models
    p = this.pMain; gl.useProgram(p);
    const setU = () => {
      gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.uniform3fv(p.u.uCam, eye); gl.uniform3fv(p.u.uSun, env.sun); gl.uniform3fv(p.u.uSky, env.skyL); gl.uniform3fv(p.u.uGnd, env.gndL);
      gl.uniform3fv(p.u.uSunCol, env.sunCol); gl.uniform1f(p.u.uFlash, sc.flash || 0); gl.uniform1f(p.u.uToon, sc.toon ? 1 : 0); gl.uniform1f(p.u.uOut, 0);
      gl.uniform1f(p.u.uMode, 0); gl.uniform4f(p.u.uTint, 0, 0, 0, 0); gl.uniform3f(p.u.uOutC, 0.025, 0.03, 0.04);
      gl.uniform1f(p.u.uWater, sc.water ? 0 : -1e6); gl.uniform1f(p.u.uBase, sc.water ? Math.max(R * 0.12, 0.5) : 0.0); gl.uniform1f(p.u.uShA, 0.32);
    };
    setU();
    const all = sc.models.concat(sc.ents || []);
    // shadows (ground only), stencil limits double darkening
    if (!sc.water && sc.shadows !== false) {
      const L = env.sun, Lm = V3.norm(L), sm = new Float32Array(16); sm[0] = 1; sm[5] = 0; sm[10] = 1; sm[15] = 1; sm[4] = -Lm[0] / Lm[1]; sm[6] = -Lm[2] / Lm[1]; sm[13] = 0.012;
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 255); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      gl.depthMask(false); gl.uniform1f(p.u.uMode, 2); gl.disable(gl.CULL_FACE);
      for (const m of all) if (!m.noShadow) this.drawModel(m, env, 2, sm);
      gl.depthMask(true); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.uniform1f(p.u.uMode, 0);
    }
    // outline pass
    gl.enable(gl.CULL_FACE);
    if (sc.outline !== false) {
      gl.cullFace(gl.FRONT); gl.uniform1f(p.u.uMode, 1); gl.uniform1f(p.u.uOut, (sc.outlinePx || 1.5) * 2 * tanY / H);
      for (const m of all) this.drawModel(m, env, 1);
      gl.uniform1f(p.u.uOut, 0); gl.uniform1f(p.u.uMode, 0);
    }
    gl.cullFace(gl.BACK);
    for (const m of all) this.drawModel(m, env, 0);
    // water
    if (sc.water) {
      p = this.pWater; gl.useProgram(p); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.depthMask(false);
      gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.uniform1f(p.u.uSize, size); gl.uniform1f(p.u.uT, sc.t); gl.uniform1f(p.u.uAmp, R * 0.012);
      const k = (m) => 2 * Math.PI / (R * m); gl.uniform3f(p.u.uK, k(2.2), k(1.1), k(0.55)); gl.uniform2f(p.u.uDrift, sc.drift ? sc.drift[0] : 0, sc.drift ? sc.drift[1] : 0);
      gl.uniform3fv(p.u.uCam, eye); gl.uniform3fv(p.u.uSun, env.sun); gl.uniform3fv(p.u.uSunCol, env.sunCol); gl.uniform3fv(p.u.uDeep, env.deep); gl.uniform3fv(p.u.uShal, env.shal); gl.uniform3fv(p.u.uFog, env.hor);
      gl.uniform1f(p.u.uAlpha, sc.waterAlpha || 0.6);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.wVB); gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.wIB); gl.drawElements(gl.TRIANGLES, this.wN, gl.UNSIGNED_SHORT, 0); gl.depthMask(true);
    }
    // particles
    if (sc.ps) this.drawParticles(sc.ps, VP);
    gl.disable(gl.BLEND);
  }
  drawParticles(ps, VP) {
    const gl = this.gl, p = this.pPart; gl.useProgram(p); gl.enable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(false); gl.enable(gl.DEPTH_TEST);
    gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.uniform3fv(p.u.uRight, this.camRight); gl.uniform3fv(p.u.uUp, this.camUp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.uniform1i(p.u.uTex, 0);
    const eye = this.eye;
    const run = (list, add) => {
      if (!list.length) return; if (!add) list.sort((a, b) => ((b.x - eye[0]) ** 2 + (b.y - eye[1]) ** 2 + (b.z - eye[2]) ** 2) - ((a.x - eye[0]) ** 2 + (a.y - eye[1]) ** 2 + (a.z - eye[2]) ** 2));
      let n = 0; const B = this.pbuf, corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < list.length && n < this.maxP; i++) {
        const q = list[i], t = q.age / q.life, a = q.a0 * Math.pow(Math.max(0, 1 - t), q.fade) * Math.min(1, q.age / (q.fin || 0.04));
        const s = q.s0 + (q.s1 - q.s0) * Math.pow(t, 0.6);
        const r = q.c0[0] + (q.c1[0] - q.c0[0]) * t, g = q.c0[1] + (q.c1[1] - q.c0[1]) * t, b = q.c0[2] + (q.c1[2] - q.c0[2]) * t;
        for (let k = 0; k < 4; k++) {
          const o = (n * 4 + k) * 12; B[o] = q.x; B[o + 1] = q.y; B[o + 2] = q.z; B[o + 3] = corners[k][0]; B[o + 4] = corners[k][1]; B[o + 5] = s; B[o + 6] = q.rot;
          B[o + 7] = r; B[o + 8] = g; B[o + 9] = b; B[o + 10] = a; B[o + 11] = q.tex;
        }
        n++;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pvb); gl.bufferData(gl.ARRAY_BUFFER, B.subarray(0, n * 48), gl.DYNAMIC_DRAW);
      const st = 48, at = (name, sz, off) => { gl.enableVertexAttribArray(p.a[name]); gl.vertexAttribPointer(p.a[name], sz, gl.FLOAT, false, st, off * 4); };
      at('aC', 3, 0); at('aK', 2, 3); at('aS', 1, 5); at('aR', 1, 6); at('aCol', 4, 7); at('aT', 1, 11);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.pib);
      gl.uniform1f(p.u.uAdd, add ? 1 : 0); gl.blendFunc(gl.SRC_ALPHA, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_SHORT, 0);
    };
    run(ps.alpha, false); run(ps.add, true);
    gl.depthMask(true);
  }
}

/* ===== particles ===== */
class Particles {
  constructor() { this.alpha = []; this.add = []; }
  /* o: p[3],v[3],life,s0,s1,c0,c1,a0,fade,add,tex,rot,rv,drag,g(gravity),buoy,grow */
  emit(o) {
    const q = {
      x: o.p[0], y: o.p[1], z: o.p[2], vx: o.v ? o.v[0] : 0, vy: o.v ? o.v[1] : 0, vz: o.v ? o.v[2] : 0, life: o.life || 1, age: 0,
      s0: o.s0 || 1, s1: o.s1 === undefined ? (o.s0 || 1) : o.s1, c0: o.c0 || [1, 1, 1], c1: o.c1 || o.c0 || [1, 1, 1], a0: o.a0 === undefined ? 1 : o.a0, fade: o.fade === undefined ? 1 : o.fade,
      tex: o.tex || 0, rot: o.rot === undefined ? Math.random() * 6.28 : o.rot, rv: o.rv || 0, drag: o.drag || 0, g: o.g || 0, buoy: o.buoy || 0, fin: o.fin, floor: o.floor,
    };
    (o.add ? this.add : this.alpha).push(q); return q;
  }
  update(dt) {
    const step = list => {
      let w = 0;
      for (let i = 0; i < list.length; i++) {
        const q = list[i]; q.age += dt; if (q.age >= q.life) continue;
        const d = Math.exp(-q.drag * dt); q.vx *= d; q.vy *= d; q.vz *= d; q.vy += (q.buoy - q.g) * dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rot += q.rv * dt;
        if (q.floor !== undefined && q.y < q.floor) { q.y = q.floor; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
        list[w++] = q;
      }
      list.length = w;
    };
    step(this.alpha); step(this.add);
    if (this.alpha.length > 5200) this.alpha.splice(0, this.alpha.length - 5200);
    if (this.add.length > 3600) this.add.splice(0, this.add.length - 3600);
  }
  clear() { this.alpha.length = 0; this.add.length = 0; }
}

/* ===== camera ===== */
class Cam {
  constructor() { this.az = 35; this.el = 18; this.dist = 20; this.tgt = [0, 1, 0]; this.want = [0, 1, 0]; this.fov = 38; this.near = 0.1; this.far = 4000; this.shake = 0; this.sh = [0, 0, 0]; this.minD = 2; this.maxD = 400; }
  eye() {
    const a = this.az * D2R, e = this.el * D2R, d = this.dist;
    return [this.tgt[0] + Math.sin(a) * Math.cos(e) * d + this.sh[0], this.tgt[1] + Math.sin(e) * d + this.sh[1], this.tgt[2] + Math.cos(a) * Math.cos(e) * d + this.sh[2]];
  }
  update(dt) {
    const k = 1 - Math.exp(-dt * 5);
    for (let i = 0; i < 3; i++) this.tgt[i] += (this.want[i] - this.tgt[i]) * k;
    this.shake *= Math.exp(-dt * 6);
    this.sh = [(Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake];
  }
}
