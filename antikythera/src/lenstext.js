// lenstext.js
const FADE = 0.6;
const DPR_MAX = 2;
const OFF = 20000;
const SHADOW = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-z]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/g;
const MARGIN = 0.05, MARGIN_B = 0.08, EDGE$1 = 0.02, NO_EDGE = [0, 0, 0, 0];

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const FRAG = `#version 300 es
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
precision highp float;
precision highp int;
#define LT_UPRIGHT
${GRADE_WATER}
uniform sampler2D tLtInk;
uniform vec2 uLtTex;
uniform vec4 uLtBox;
uniform vec2 uLtK;
uniform float uLtExpo;
uniform vec4 uLtEdge;
vec4 inkAt(vec2 uv) {
  vec2 q = (uv - uLtBox.xy) / uLtBox.zw;
  if (q.x <= 0.0 || q.y <= 0.0 || q.x >= 1.0 || q.y >= 1.0) return vec4(0.0);
  return texture2D(tLtInk, vec2(q.x, 1.0 - q.y) * uLtTex);
}
vec3 ltScreen(vec3 c) {
  vec3 v = mat3(vec3(0.59719, 0.076, 0.0284), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)) * (c * uLtExpo / 0.6);
  v = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  v = clamp(mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)) * v, 0.0, 1.0);
  return mix(pow(v, vec3(0.41666)) * 1.055 - 0.055, v * 12.92, vec3(lessThanEqual(v, vec3(0.0031308))));
}
void main() {
  vec2 fuv = uLtBox.xy + vUv * uLtBox.zw;
  float gain;
  vec2 off = lensWater(fuv, gain);
  if (uSpray.x >= 0.0) off += sprayDrops(fuv, gain);
  if (uPlungeT >= 0.0) { off += plunge(fuv, gain); off += churn(fuv, gain); }
  vec2 suv = 1.0 - abs(1.0 - abs(fuv + off));
  vec4 t = inkAt(suv);
  if (gSmear > 0.01) {
    vec2 pa = vec2(fuv.x * uAspect, fuv.y);
    float rv = gNoise(vec2(pa.x * 22.0, pa.y * 0.9 + uWetT * 3.6));
    float rl = mix(0.55, 1.6, smoothstep(0.3, 0.8, rv)) * mix(0.75, 1.2, gNoise(vec2(pa.x * 3.1 + 5.3, 1.7)));
    float sl = (gNoise(vec2(pa.x * 4.3 + 9.1, pa.y * 0.6 + 2.2)) - 0.5) * 0.4;
    vec2 sd = vec2(sl * 0.028 / uAspect, 0.028) * (gSmear * rl);
    float jt = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec4 acc = t;
    float ws = 1.0;
    for (int i = 0; i < 9; i++) {
      float f = (float(i) + jt) / 9.0, wt = 1.0 - 0.7 * f;
      acc += inkAt(clamp(suv + sd * f, 0.0, 1.0)) * wt;
      ws += wt;
    }
    for (int i = 0; i < 3; i++) {
      float f = (float(i) + jt) / 3.0, wt = 1.0 - 0.7 * f;
      acc += inkAt(clamp(suv - sd * (0.3 * f), 0.0, 1.0)) * wt;
      ws += wt;
    }
    t = acc / ws;
  } else if (dot(gLtFr, gLtFr) > 1e-12) {
    vec4 tr = inkAt(suv - gLtFr), tb = inkAt(suv + gLtFr);
    t = vec4(tr.r, t.g, tb.b, max(t.a, max(tr.a, tb.a)));
  }
  vec2 lo = (fuv - uLtBox.xy) * vec2(uAspect, 1.0), hi = (uLtBox.xy + uLtBox.zw - fuv) * vec2(uAspect, 1.0);
  if (uLtEdge.x > 0.0) t *= smoothstep(0.0, uLtEdge.x, lo.x);
  if (uLtEdge.y > 0.0) t *= smoothstep(0.0, uLtEdge.y, lo.y);
  if (uLtEdge.z > 0.0) t *= smoothstep(0.0, uLtEdge.z, hi.x);
  if (uLtEdge.w > 0.0) t *= smoothstep(0.0, uLtEdge.w, hi.y);
  t *= uLtK.x;
  t *= (1.0 - uLtK.y) / max(1.0 - uLtK.y * t.a, 1e-4);
  t.rgb *= pow(max(gain, 0.0), 0.4545);
  t.rgb += t.a * ltScreen((vec3(0.9, 0.95, 1.0) * (gSpec + gLip) + gGlint) * uGain);
  gl_FragColor = t;
}
`;
const OWN = new Set(['tLtInk', 'uLtTex', 'uLtBox', 'uLtK', 'uLtExpo', 'uLtEdge']);
const BEAD_CS = [0.012, 0.026, 0.05, 0.095], BEAD_PR = [0.5, 0.46, 0.42, 0.36], BEAD_LIFE = [[0.9, 2.6], [1.3, 3.4], [1.7, 4.4], [2.2, 5.3]];
const DS_RUN = 2, DS_STOP = 3, DS_MERGE = 4, DS_TRAIL = 5, DS_OFF = 6;
const STREAK = 0.3;
const mix = (a, b, t) => a + (b - a) * t;
const sstep$5 = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const f32 = Math.fround, fr32 = (v) => f32(v - Math.floor(v));
function gHash(x, y) {
  let a = fr32(f32(f32(x) * f32(0.1031))), b = fr32(f32(f32(y) * f32(0.1031))), c = a;
  const k = f32(33.33), d = f32(f32(f32(a * f32(b + k)) + f32(b * f32(c + k))) + f32(c * f32(a + k)));
  a = f32(a + d); b = f32(b + d); c = f32(c + d);
  return fr32(f32(f32(a + b) * c));
}
const hashAt = (ix, iy, o, o2 = 0) => {
  let x = f32(ix + f32(o)), y = f32(iy + f32(o));
  if (o2) { x = f32(x + f32(o2)); y = f32(y + f32(o2)); }
  return gHash(x, y);
};
const LINES = 4, LINE = 1.35;
const WARM = 6;

class LensText {
  constructor(post, renderer) {
    this.post = post;
    this.r = renderer;
    this.u = post.gradeMat.uniforms;
    this.el = document.getElementById('headline');
    this.iv = document.createElement('canvas');
    this.iv.width = this.iv.height = 1;
    this.ix = this.iv.getContext('2d');
    this.gv = document.createElement('canvas');
    this.gv.style.display = 'none';
    this.gx = this.gv.getContext('2d');
    this.cv = document.createElement('canvas');
    this.cv.width = this.cv.height = 1;
    this.cv.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px';
    this.wrap = document.createElement('div');
    this.wrap.setAttribute('aria-hidden', 'true');
    this.wrap.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;display:none';
    this.wrap.appendChild(this.cv);
    this.wrap.appendChild(this.gv);
    if (this.el) this.el.after(this.wrap);
    this.AW = this.AH = 0;
    this.adpr = 0;
    this.warmN = 0;
    this.resized = -1;
    addEventListener('resize', () => { this.resized = performance.now(); });
    this.rewarm = false;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.rewarm = true; });
    this.on = false;
    this.s = 1;
    this.shown = false;
    this.key = '';
    this.inked = false;
    this.painted = false;
    this.box = null;
    this._bk = '';
    this._f = '';
    this.ok = false;
    this.cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; this.lost = true; });
    this.cv.addEventListener('webglcontextrestored', () => {
      this.lost = this.bad = this.ok = false;
      this.tex = null; this.AW = this.AH = this.adpr = 0; this.used = [0, 0]; this.painted = false; this.key = '';
      try { this._gl(); } catch (e) { console.warn('lenstext: not restored', e); this.gl = null; }
    });
    try { this._gl(); } catch (e) { console.warn('lenstext: no second context', e); this.gl = null; }
  }

  _gl() {
    const gl = this.cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    this.gl = gl;
    if (!gl) return;
    this.par = gl.getExtension('KHR_parallel_shader_compile');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    this.prog = p;
    this.vs = vs;
    this.fs = fs;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.tex = null;
  }

  ready() {
    if (this.ok) return true;
    const gl = this.gl;
    if (!gl || this.lost || this.bad) return false;
    if (this.par && !gl.getProgramParameter(this.prog, this.par.COMPLETION_STATUS_KHR)) return false;
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      this.bad = true;
      console.warn('lenstext:', gl.getShaderInfoLog(this.fs) || gl.getProgramInfoLog(this.prog));
      return false;
    }
    const n = gl.getProgramParameter(this.prog, gl.ACTIVE_UNIFORMS);
    this.sync = [];
    this.own = {};
    for (let i = 0; i < n; i++) {
      const a = gl.getActiveUniform(this.prog, i), name = a.name.replace(/\[0\]$/, ''), loc = gl.getUniformLocation(this.prog, a.name);
      if (OWN.has(name)) { this.own[name] = loc; continue; }
      const g = this.u[name];
      if (!g) { console.warn('lenstext: no grade uniform', name); continue; }
      this.sync.push({ loc, type: a.type, size: a.size, g, buf: a.size > 1 ? new Float32Array(a.size * 4) : null });
    }
    this.ok = true;
    if (this.el) this._warm();
    return true;
  }

  _need() {
    const dpr = Math.min(devicePixelRatio || 1, DPR_MAX), cr = this.r.domElement.getBoundingClientRect(), cs = getComputedStyle(this.el);
    const cw = cr.width || innerWidth, ch = cr.height || innerHeight, land = cw >= ch;
    const s0 = Math.max(screen.width || 0, screen.height || 0), s1 = Math.min(screen.width || 0, screen.height || 0);
    const turns = navigator.maxTouchPoints > 0 || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
    let W = 0, H = 0;
    for (const lw of turns ? [true, false] : [land]) {
      const aw = lw === land ? cw : ch, ah = lw === land ? ch : cw;
      const sw = Math.max(aw, lw ? s0 : s1), sh = Math.max(ah, lw ? s1 : s0);
      const k = Math.max(1, sw / aw, sh / ah), fs = (parseFloat(cs.fontSize) || 40) * k;
      const w = sw;
      W = Math.max(W, Math.ceil(w * dpr) + 2);
      H = Math.max(H, Math.min(Math.ceil(sh * dpr) + 2, Math.ceil(((MARGIN + MARGIN_B) * sh + LINES * LINE * fs) * dpr) + 8));
    }
    return { W, H, dpr };
  }

  _alloc(W, H, dpr) {
    const gl = this.gl, cv = this.cv, iv = this.iv, gv = this.gv;
    this.AW = W;
    this.AH = H;
    this.adpr = dpr;
    cv.width = iv.width = gv.width = W;
    cv.height = iv.height = gv.height = H;
    cv.style.width = `${W / dpr}px`;
    cv.style.height = `${H / dpr}px`;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, H);
    this.painted = false;
  }

  _warm(n = this._need()) {
    const same = n.dpr === this.adpr;
    if (!same || n.W > this.AW || n.H > this.AH) this._alloc(Math.max(n.W, same ? this.AW : 0), Math.max(n.H, same ? this.AH : 0), n.dpr);
    const cs = getComputedStyle(this.el), font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    this._base(font);
    const gx = this.gx;
    gx.setTransform(1, 0, 0, 1, 0, 0);
    gx.clearRect(0, 0, this.AW, this.AH);
    gx.font = font;
    gx.fillStyle = cs.color;
    gx.fillText('A', 16, 64);
    this._halo(this._shadows(), n.dpr, 64, 64, this.AW, this.AH);
    this._upload();
    this._draw(64, 64, [0, 0, 64 / this.AW, 64 / this.AH], 0, 0, NO_EDGE);
    gx.clearRect(0, 0, this.AW, this.AH);
    this.ix.clearRect(0, 0, this.AW, this.AH);
    this.used = [0, 0];
    this.painted = false;
    this._corner();
  }

  _corner() {
    if (this.shown || this.on) return;
    this.rewarm = false;
    this.key = '';
    this.painted = false;
    this.warmN = WARM;
    const st = this.wrap.style;
    st.left = st.top = '0px';
    st.width = st.height = `${64 / this.adpr}px`;
    st.display = 'block';
  }

  wet() {
    const u = this.u;
    return u.uWetT.value >= 0 || u.uPlungeT.value >= 0 || u.uSpray.value.x >= 0;
  }

  update(dt) {
    if (!this.el) return;
    if (!this.ok) this.ready();
    const wet = this.wet(), came = wet && !this.wet0;
    this.wet0 = wet;
    if (this.ok && !this.shown && this.resized >= 0 && performance.now() - this.resized > 400) {
      this.resized = -1;
      const n = this._need();
      if (n.dpr !== this.adpr || n.W > this.AW || n.H > this.AH) this._warm(n);
    }
    if (this.rewarm && this.ok && this.AW) this._corner();
    if (this.warmN > 0) {
      if (this.shown || this.on || !this.ok) { this.warmN = 0; if (!this.shown) this.wrap.style.display = 'none'; }
      else if (--this.warmN > 0) this._draw(64, 64, [0, 0, 64 / this.AW, 64 / this.AH], 0, 0, NO_EDGE);
      else this.wrap.style.display = 'none';
    }
    const op0 = this.op0 || 0;
    this.op0 = 0;
    if (!wet && !this.on) return;
    if (this.on && !this.ok) { this._done(); return; }
    const op = (this.op0 = +getComputedStyle(this.el).opacity || 0);
    if (!(op > 0.002) || !this.ok) { if (this.on) this._done(); return; }
    this._layout();
    if (!this.inked) { if (this.on) this._done(); return; }
    const near = wet && this.reach(this.box.uv);
    if (near) {
      if (this.on) this.s = 0;
      else if (came || op0 <= 0.002 || op < 0.05) { this.on = true; this.s = 0; }
    }
    if (!this.on) return;
    if (!near) {
      this.s = Math.min(1, this.s + Math.max(0, dt) / FADE);
      if (this.s >= 0.999) { this._done(); return; }
    }
    this._filter(this.s);
    this._paint();
    const b = this.box;
    this._draw(b.bw, b.bh, b.uv, op, this.s, b.edge);
    this._show(true);
  }

  reach(uv) {
    const u = this.u;
    if (u.uSpray.value.x >= 0 || u.uPlungeT.value >= 0) return true;
    const ts = u.uWetT.value;
    if (ts < 0) return false;
    if (ts < 0.6) return true;
    const A = u.uAspect.value, x0 = uv[0] * A, x1 = (uv[0] + uv[2]) * A, y0 = uv[1], y1 = uv[1] + uv[3];
    if (ts < 1.7 && 1.36 - (0.2 * ts + 0.7 * ts * ts) > y0) return true;
    if (ts < this._beads(x0, y0, x1, y1, A)) return true;
    return this._drops(x0, y0, x1, y1);
  }

  _beads(x0, y0, x1, y1, A) {
    const key = `${x0.toFixed(4)},${y0.toFixed(4)},${x1.toFixed(4)},${y1.toFixed(4)},${A.toFixed(4)}`;
    if (key === this._bk) return this._bt;
    let T = 0;
    for (let L = 0; L < 4; L++) {
      const cs = BEAD_CS[L], shx = L * 7.31, shy = L * 3.17, lf = BEAD_LIFE[L];
      for (let iy = Math.floor(y0 / cs + shy) - 1, iy1 = Math.floor(y1 / cs + shy) + 1; iy <= iy1; iy++) {
        for (let ix = Math.floor(x0 / cs + shx) - 1, ix1 = Math.floor(x1 / cs + shx) + 1; ix <= ix1; ix++) {
          const ccx = (ix - shx + 0.5) * cs, ccy = (iy - shy + 0.5) * cs;
          let pr = BEAD_PR[L] * mix(1.15, 0.7, sstep$5(0.1, 1.0, ccy));
          pr *= mix(0.45, 1.1, Math.max(sstep$5(0.2, 0.45, Math.abs(ccx / A - 0.5)), sstep$5(0.32, 0.08, ccy)));
          if (hashAt(ix, iy, L * 17) > pr + 0.004) continue;
          const hr = hashAt(ix, iy, 3.7), r0 = cs * (0.1 + 0.26 * hr * hr), jk = Math.max(0, 1 - (2 * r0) / cs - 0.04);
          const cx = (ix + 0.5 + (hashAt(ix, iy, 1.3) - 0.5) * jk - shx) * cs, cy = (iy + 0.5 + (hashAt(ix, iy, 1.3, 17.31) - 0.5) * jk - shy) * cs;
          const R = 1.3 * r0 + 0.002;
          if (cx + R < x0 || cx - R > x1 || cy + R < y0 || cy - R > y1) continue;
          const xc = (cx / A) * 2 - 1, f = Math.max(1.07 + 0.2 * (1 - xc * xc) - cy, 0), born = (-0.2 + Math.sqrt(0.04 + 2.8 * f)) / 1.4;
          let life = mix(lf[0], lf[1], Math.pow(hashAt(ix, iy, 5.5), 1.5));
          const txt = (1 - sstep$5(0.4, 0.47, cx / A)) * sstep$5(0.12, 0.2, cy) * (1 - sstep$5(0.74, 0.82, cy));
          life = mix(life, Math.min(life, 5.6 - born), txt);
          T = Math.max(T, born + life + 0.05);
        }
      }
    }
    this._bk = key;
    this._bt = T;
    return T;
  }

  _drops(x0, y0, x1, y1) {
    const D = this.post.drops && this.post.drops.d;
    if (!D) return false;
    for (const d of D) {
      if (!d || d.st === DS_OFF) continue;
      const r = Math.cbrt(d.V), R = 1.9 * r + 0.01, wx = 2.7 * d.amp;
      if (d.st !== DS_TRAIL) {
        const goes = d.st === DS_RUN || d.st === DS_STOP || d.st === DS_MERGE || d.go > 0;
        if (goes ? d.x0 + wx + R >= x0 && d.x0 - wx - R <= x1 && d.y + R >= y0 : d.x + R >= x0 && d.x - R <= x1 && d.y + R >= y0 && d.y - R <= y1) return true;
      }
      if (d.wet > 0 && d.yTop >= y0 && d.x0 + wx + 1.6 * d.hw + 0.008 >= x0 && d.x0 - wx - 1.6 * d.hw - 0.008 <= x1) {
        if (Math.exp(-(Math.max(y0, d.y) - d.y) / d.wet) > STREAK) return true;
      }
    }
    return false;
  }

  card(x, draw) {
    if (!this.wet() || !this.ready()) return false;
    const W = x.canvas.width, H = x.canvas.height, ix = this.ix;
    if (W > this.AW || H > this.AH) this._alloc(Math.max(W, this.AW), Math.max(H, this.AH), this.adpr || 1);
    this.painted = false;
    ix.setTransform(1, 0, 0, 1, 0, 0);
    ix.globalAlpha = 1;
    ix.globalCompositeOperation = 'source-over';
    ix.shadowColor = 'transparent';
    ix.clearRect(0, 0, this.AW, this.AH);
    ix.save();
    draw(ix);
    ix.restore();
    this._upload();
    this._draw(W, H, [0, 0, 1, 1], 1, 0, NO_EDGE);
    x.drawImage(this.cv, 0, 0, W, H, 0, 0, W, H);
    return true;
  }

  _upload() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.iv);
  }

  _draw(W, H, uv, k, s, edge) {
    const gl = this.gl, y = this.AH - H;
    gl.viewport(0, y, W, H);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, y, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(this.prog);
    for (const e of this.sync) {
      const v = e.g.value;
      switch (e.type) {
        case gl.FLOAT: gl.uniform1f(e.loc, v); break;
        case gl.INT: case gl.BOOL: gl.uniform1i(e.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2f(e.loc, v.x, v.y); break;
        case gl.FLOAT_VEC3: if (v.isColor) gl.uniform3f(e.loc, v.r, v.g, v.b); else gl.uniform3f(e.loc, v.x, v.y, v.z); break;
        case gl.FLOAT_VEC4:
          if (e.buf) {
            for (let i = 0; i < e.size; i++) { const q = v[i]; e.buf[i * 4] = q.x; e.buf[i * 4 + 1] = q.y; e.buf[i * 4 + 2] = q.z; e.buf[i * 4 + 3] = q.w; }
            gl.uniform4fv(e.loc, e.buf);
          } else gl.uniform4f(e.loc, v.x, v.y, v.z, v.w);
          break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(e.loc, false, v.elements); break;
      }
    }
    const o = this.own;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(o.tLtInk, 0);
    gl.uniform2f(o.uLtTex, W / this.AW, H / this.AH);
    gl.uniform4f(o.uLtBox, uv[0], uv[1], uv[2], uv[3]);
    gl.uniform2f(o.uLtK, k, s);
    gl.uniform1f(o.uLtExpo, this.r.toneMappingExposure);
    gl.uniform4f(o.uLtEdge, edge[0], edge[1], edge[2], edge[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _show(v) {
    if (v === this.shown) return;
    this.shown = v;
    this.wrap.style.display = v ? 'block' : 'none';
  }

  _filter(s) {
    const f = s >= 1 ? '' : `opacity(${s.toFixed(3)})`;
    if (f === this._f) return;
    this._f = f;
    this.el.style.filter = f;
  }

  _done() {
    this.on = false;
    this.s = 1;
    this._filter(1);
    this._show(false);
  }

  _base(font) {
    const m = this._bases || (this._bases = new Map());
    let v = m.get(font);
    if (v !== undefined) return v;
    const d = document.createElement('div'), t = document.createTextNode('H'), p = document.createElement('span');
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;line-height:normal';
    d.style.font = font;
    p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    d.append(t, p);
    document.body.appendChild(d);
    const rg = document.createRange();
    rg.setStart(t, 0);
    rg.setEnd(t, 1);
    const b = rg.getClientRects()[0];
    v = b ? p.getBoundingClientRect().top - b.top : 0;
    d.remove();
    if (!document.fonts || document.fonts.status === 'loaded') m.set(font, v);
    return v;
  }

  _shadows() {
    const out = [];
    for (const s of getComputedStyle(this.el).textShadow.matchAll(SHADOW)) out.push({ col: s[1], dx: +s[2], dy: +s[3], blur: +(s[4] || 0) });
    return out;
  }

  _halo(shadows, dpr, w, h, uw, uh) {
    const ix = this.ix, gv = this.gv;
    ix.setTransform(1, 0, 0, 1, 0, 0);
    ix.globalAlpha = 1;
    ix.globalCompositeOperation = 'source-over';
    ix.clearRect(0, 0, uw, uh);
    for (let i = shadows.length - 1; i >= 0; i--) {
      const s = shadows[i];
      ix.shadowColor = s.col;
      ix.shadowBlur = s.blur * dpr;
      ix.shadowOffsetX = OFF + s.dx * dpr;
      ix.shadowOffsetY = s.dy * dpr;
      ix.drawImage(gv, 0, 0, w, h, -OFF, 0, w, h);
    }
    ix.shadowColor = 'transparent';
    ix.shadowBlur = ix.shadowOffsetX = ix.shadowOffsetY = 0;
    ix.drawImage(gv, 0, 0, w, h, 0, 0, w, h);
  }

  _layout() {
    const el = this.el, cr = this.r.domElement.getBoundingClientRect(), er = el.getBoundingClientRect();
    const cw = cr.width || innerWidth, ch = cr.height || innerHeight, dpr = Math.min(devicePixelRatio || 1, DPR_MAX);
    const key = `${el.innerHTML}|${er.left.toFixed(2)},${er.top.toFixed(2)},${er.width.toFixed(2)},${er.height.toFixed(2)}|${cr.left},${cr.top},${cw}x${ch}|${dpr}|${document.fonts ? document.fonts.status : ''}`;
    if (key === this.key) return;
    this.key = key;
    this.painted = false;
    const gl = [], rg = document.createRange(), tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const cs = getComputedStyle(n.parentElement), up = cs.textTransform === 'uppercase';
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const t = n.data;
      for (let i = 0; i < t.length; i++) {
        const c = t.codePointAt(i), k = c > 0xffff ? 2 : 1, ch2 = t.slice(i, i + k);
        if (!ch2.trim()) { i += k - 1; continue; }
        rg.setStart(n, i);
        rg.setEnd(n, i + k);
        i += k - 1;
        const b = rg.getClientRects()[0];
        if (!b || b.width <= 0) continue;
        gl.push({ ch: up ? ch2.toUpperCase() : ch2, x: b.left, y: b.top + this._base(font), font, color: cs.color });
        x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
      }
    }
    this.glyphs = gl;
    this.inked = gl.length > 0;
    if (!this.inked) return;
    const fx0 = Math.ceil(cr.left * dpr), fy0 = Math.ceil(cr.top * dpr), fx1 = Math.floor((cr.left + cw) * dpr), fy1 = Math.floor((cr.top + ch) * dpr);
    const X0 = Math.max(Math.floor((x0 - MARGIN * ch) * dpr), fx0), Y0 = Math.max(Math.floor((y0 - MARGIN * ch) * dpr), fy0);
    const X1 = Math.min(Math.ceil((x1 + MARGIN * ch) * dpr), fx1), Y1 = Math.min(Math.ceil((y1 + MARGIN_B * ch) * dpr), fy1);
    const bw = Math.max(1, X1 - X0), bh = Math.max(1, Y1 - Y0);
    const edge = [X0 > fx0 ? EDGE$1 : 0, Y1 < fy1 ? EDGE$1 : 0, X1 < fx1 ? EDGE$1 : 0, Y0 > fy0 ? EDGE$1 : 0];
    this.box = { X0, Y0, bw, bh, dpr, edge, uv: [(X0 / dpr - cr.left) / cw, 1 - (Y1 / dpr - cr.top) / ch, bw / dpr / cw, bh / dpr / ch] };
  }

  _paint() {
    if (this.painted || !this.inked) return;
    const b = this.box, dpr = b.dpr, bw = b.bw, bh = b.bh;
    if (dpr !== this.adpr || bw > this.AW || bh > this.AH) { const n = this._need(); this._alloc(Math.max(n.W, bw), Math.max(n.H, bh), dpr); }
    const gx = this.gx, u = this.used || [0, 0], uw = Math.max(u[0], bw), uh = Math.max(u[1], bh);
    gx.setTransform(1, 0, 0, 1, 0, 0);
    gx.clearRect(0, 0, uw, uh);
    gx.setTransform(dpr, 0, 0, dpr, -b.X0, -b.Y0);
    gx.textBaseline = 'alphabetic';
    gx.textAlign = 'left';
    for (const g of this.glyphs) {
      if (gx.font !== g.font) gx.font = g.font;
      gx.fillStyle = g.color;
      gx.fillText(g.ch, g.x, g.y);
    }
    this._halo(this._shadows(), dpr, bw, bh, uw, uh);
    this.used = [bw, bh];
    this._upload();
    const st = this.wrap.style;
    st.left = `${b.X0 / dpr}px`;
    st.top = `${b.Y0 / dpr}px`;
    st.width = `${bw / dpr}px`;
    st.height = `${bh / dpr}px`;
    this.painted = true;
  }
}

