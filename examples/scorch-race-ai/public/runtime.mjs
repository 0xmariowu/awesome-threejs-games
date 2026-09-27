import { G, AUDIO, UI, fx, post, renderer } from './shims.mjs';
const THREE = globalThis.THREE;
const T = THREE;
T.ColorManagement.enabled = false;           // on travaille directement en espace "affichage" (look toon)
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has('debug');
const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapPI = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash3(x, y, z) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm3(x, y, z, o = 4) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }

// ---------------------------------------------------------------- qualité
const QP = {
  low:  { shadow: 1536, ms: 0, scale: 0.75, bloom: 4, smoke: 500,  maxpx: 0.9e6 },
  med:  { shadow: 2048, ms: 0, scale: 1.0,  bloom: 5, smoke: 900,  maxpx: 1.7e6 },
  high: { shadow: 3072, ms: 2, scale: 1.0,  bloom: 5, smoke: 1300, maxpx: 2.8e6 },
};
const COARSE = window.matchMedia && matchMedia('(pointer:coarse)').matches;
let QUALITY = QS.get('q') || (COARSE ? 'low' : 'med');
if (!QP[QUALITY]) QUALITY = 'high';
const QCFG = QP[QUALITY];

// ---------------------------------------------------------------- palette / ciel
const PAL = {
  ground: new T.Color(0.97, 0.74, 0.07),
  fog: new T.Color(0.78, 0.36, 0.11),
  sunDir: new T.Vector3(),
};
const SUN_AZ = QS.has('az') ? +QS.get('az') : 2.55, SUN_EL = 0.36;  // rad
PAL.sunDir.set(Math.cos(SUN_EL) * Math.sin(SUN_AZ), Math.sin(SUN_EL), Math.cos(SUN_EL) * Math.cos(SUN_AZ)).normalize();

// uniforms partagés par tous les matériaux du monde
const SU = {
  uFogColor: { value: PAL.fog },
  uFogNear: { value: 500 },
  uFogFar: { value: 4200 },
  uTime: { value: 0 },
  uSun: { value: PAL.sunDir },
};


const GRAD = (() => {
  const n = 16, d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = i < 8 ? 0.0 : i < 10 ? 0.58 : 1.0; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(v * 255); d[i * 4 + 3] = 255; }
  const t = new T.DataTexture(d, n, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
const GLSL_NOISE = `
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }
float fbm2(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn2(p); p*=2.03; a*=.5;} return s; }
`;
const GLSL_HAZE = `
uniform vec3 uFogColor; uniform float uFogNear, uFogFar;
`;
function patchToon(mat, cfg) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SU, cfg.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;\n' + (cfg.vPars || ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);\n' + (cfg.vMain || ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;\n' + GLSL_NOISE + GLSL_HAZE + 'uniform float uTime; uniform vec3 uSun;\n' + (cfg.fPars || ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (cfg.fColor || ''))
      .replace('#include <opaque_fragment>', (cfg.fEnd || '') + `
        { float hz = smoothstep(uFogNear, uFogFar, length(vWPos - cameraPosition)); hz *= hz*0.5 + 0.5*hz; outgoingLight = mix(outgoingLight, uFogColor, hz); }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => cfg.key;
  return mat;
}
function toonBase(o) { const m = new T.MeshToonMaterial(Object.assign({ gradientMap: GRAD }, o || {})); return m; }

// ---------------------------------------------------------------- texture de panneaux (R ton, G joint, B rivets/biseau, A usure)
function genPanelTexture(seed, N = 1024) {
  const rng = mulberry32(seed), R = new Uint8Array(N * N), G = new Uint8Array(N * N), B = new Uint8Array(N * N), A = new Uint8Array(N * N);
  const rects = [];
  const split = (x, y, w, h, d) => {
    const minS = 132;
    if ((w < minS * 1.7 && h < minS * 1.7) || d > 5 || (d > 1 && rng() < 0.16)) { rects.push({ x, y, w, h }); return; }
    const vert = w > h * 1.25 ? true : h > w * 1.25 ? false : rng() < 0.5;
    if (vert) { const c = (w * (0.32 + rng() * 0.36)) | 0; split(x, y, c, h, d + 1); split(x + c, y, w - c, h, d + 1); }
    else { const c = (h * (0.32 + rng() * 0.36)) | 0; split(x, y, w, c, d + 1); split(x, y + c, w, h - c, d + 1); }
  };
  split(0, 0, N, N, 0);
  const W = (a, x, y, v) => { x = ((x % N) + N) % N; y = ((y % N) + N) % N; if (a[y * N + x] < v) a[y * N + x] = v; };
  const fillRect = (a, x, y, w, h, v) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) W(a, x + i, y + j, v); };
  const tones = [0.34, 0.52, 0.7, 0.9];
  for (const r of rects) {
    const tone = tones[(rng() * 4) | 0];
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) R[((r.y + j) % N) * N + ((r.x + i) % N)] = tone * 255;
    // joints (haut/gauche) + biseau clair juste en dessous
    fillRect(G, r.x, r.y, r.w, 5, 255); fillRect(G, r.x, r.y, 5, r.h, 255);
    fillRect(B, r.x + 5, r.y + 5, r.w - 5, 3, 150); fillRect(B, r.x + 5, r.y + 5, 3, r.h - 5, 150);
    // rivets
    if (r.w > 70 && r.h > 70 && rng() < 0.85) {
      const o = 16;
      for (let x = o; x < r.w - o + 1; x += 34) { fillRect(B, r.x + x - 2, r.y + o - 2, 5, 5, 255); fillRect(B, r.x + x - 2, r.y + r.h - o - 2, 5, 5, 255); }
      for (let y = o + 34; y < r.h - o - 20; y += 34) { fillRect(B, r.x + o - 2, r.y + y - 2, 5, 5, 255); fillRect(B, r.x + r.w - o - 2, r.y + y - 2, 5, 5, 255); }
    }
    // détails : encart, évents, trappe
    const k = rng();
    if (r.w > 100 && r.h > 100 && k < 0.32) {
      const ix = r.x + 26, iy = r.y + 26, iw = r.w - 52, ih = r.h - 52;
      fillRect(G, ix, iy, iw, 4, 255); fillRect(G, ix, iy + ih - 4, iw, 4, 255); fillRect(G, ix, iy, 4, ih, 255); fillRect(G, ix + iw - 4, iy, 4, ih, 255);
    } else if (r.w > 110 && r.h > 90 && k < 0.5) {
      const n = 4 + ((rng() * 5) | 0), vx = r.x + 30, vw = Math.min(r.w - 60, 170), vy = r.y + 26;
      for (let i = 0; i < n; i++) fillRect(G, vx, vy + i * 12, vw, 5, 255);
    } else if (r.w > 90 && r.h > 90 && k < 0.62) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(r.w, r.h) * 0.22;
      for (let a = 0; a < 720; a++) { const t = a / 720 * TAU; for (let q = 0; q < 4; q++) W(G, Math.round(cx + Math.cos(t) * (rad + q)), Math.round(cy + Math.sin(t) * (rad + q)), 255); }
      fillRect(B, cx - 3, cy - 3, 7, 7, 255);
    }
  }
  // éraflures + salissures
  for (let i = 0; i < 260; i++) {
    let x = rng() * N, y = rng() * N; const ang = (rng() < 0.6 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.9, len = 20 + rng() * 110;
    for (let t = 0; t < len; t++) { W(A, Math.round(x + Math.cos(ang) * t), Math.round(y + Math.sin(ang) * t), 200 + rng() * 55); }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const n = fbm3(i / 90, j / 90, seed) ; const s = fbm3(i / 14, j / 260, seed * 3.1);
    const g = Math.max(0, (n - 0.52) * 3.2) + Math.max(0, (s - 0.6) * 2.0); const k = j * N + i;
    A[k] = Math.max(A[k], Math.min(255, g * 150));
  }
  const data = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) { data[k * 4] = R[k]; data[k * 4 + 1] = G[k]; data[k * 4 + 2] = B[k]; data[k * 4 + 3] = A[k]; }
  const tex = new T.DataTexture(data, N, N, T.RGBAFormat);
  tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- matériau des pods / accessoires (vertex colors + triplanaire + hazard)
function makePodMat(panelTex, o = {}) {
  const m = toonBase({ vertexColors: true });
  const uni = { uPanel: { value: panelTex }, uTile: { value: o.tile || 0.24 }, uSeam: { value: new T.Color(o.seam || 0x1a0d05) }, uWear: { value: o.wear ?? 0.7 }, uHaz: { value: new T.Color(o.haz || 0xffc21a) } };
  return patchToon(m, {
    key: 'pod', uniforms: uni,
    vPars: 'attribute float aFlag; varying vec3 vOP; varying vec3 vON; varying float vFlag;',
    vMain: 'vOP = position; vON = normal; vFlag = aFlag;',
    fPars: 'uniform sampler2D uPanel; uniform float uTile, uWear; uniform vec3 uSeam, uHaz; varying vec3 vOP; varying vec3 vON; varying float vFlag;',
    fColor: `{
      vec3 an = pow(abs(vON), vec3(6.0)); an /= (an.x+an.y+an.z+1e-5);
      vec4 tx = texture2D(uPanel, vOP.zy*uTile), ty = texture2D(uPanel, vOP.xz*uTile), tz = texture2D(uPanel, vOP.xy*uTile);
      vec4 t = tx*an.x + ty*an.y + tz*an.z;
      float pan = step(0.5, vFlag) * step(vFlag, 1.5);
      diffuseColor.rgb *= mix(1.0, 0.70 + 0.42*t.r, pan);
      diffuseColor.rgb *= 1.0 + t.b*0.22*pan;
      diffuseColor.rgb *= 1.0 - uWear*smoothstep(0.35,0.9,t.a)*0.42*pan;
      float seam = smoothstep(0.5, 0.72, t.g) * pan;
      diffuseColor.rgb = mix(diffuseColor.rgb, uSeam, seam*0.92);
      float haz = step(1.5, vFlag);
      float c = an.x*(vOP.z+vOP.y) + an.y*(vOP.x+vOP.z) + an.z*(vOP.x+vOP.y);
      float st = step(0.5, fract(c*1.25));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.05,0.03,0.02), uHaz, st), haz);
    }`,
  });
}

// ---------------------------------------------------------------- contour "encre" (coque inversée, épaisseur constante à l'écran)
const OUTLINE_U = { uThick: { value: 0.0062 }, uAspect: { value: 1.6 }, uOutCol: { value: new T.Color(0.035, 0.012, 0.003) } };
function makeOutlineMat() {
  return new T.ShaderMaterial({
    uniforms: OUTLINE_U, side: T.BackSide,
    vertexShader: `attribute vec3 aSN; uniform float uThick, uAspect;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vec4 clip = projectionMatrix * mv;
        vec3 nv = normalize(normalMatrix * aSN); vec2 nd = (projectionMatrix * vec4(nv, 0.0)).xy; float l = length(nd);
        nd = l > 1e-5 ? nd / l : vec2(0.0);
        float dist = -mv.z; float th = uThick * mix(0.55, 1.0, (1.0 - smoothstep(14.0,160.0,dist)));
        clip.xy += nd * th * clip.w * vec2(1.0/uAspect, 1.0);
        gl_Position = clip; }`,
    fragmentShader: 'uniform vec3 uOutCol; void main(){ gl_FragColor = vec4(uOutCol, 1.0); }',
  });
}

// ---------------------------------------------------------------- ciel
function makeSky() {
  const mat = new T.ShaderMaterial({
    uniforms: SU, side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uSun, uFogColor; uniform float uTime; varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 top = vec3(0.13,0.045,0.03), mid = vec3(0.40,0.145,0.055), hor = vec3(0.88,0.43,0.13);
        float t = clamp(h, 0.0, 1.0);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.16, t));
        col = mix(col, top, smoothstep(0.12, 0.85, t));
        // bandes de poussière à bords durs (style cel)
        float az = atan(d.x, d.z);
        float n = fbm2(vec2(az*5.0, h*26.0)) ;
        float bands = step(0.60, n) * smoothstep(0.02, 0.10, h) * (1.0 - smoothstep(0.15,0.55,h));
        col = mix(col, col*vec3(0.62,0.45,0.40), bands*0.55);
        float n2 = fbm2(vec2(az*11.0 + 4.0, h*60.0 + 3.0));
        col = mix(col, col*1.28+vec3(0.05,0.02,0.0), step(0.74, n2)*smoothstep(0.03,0.2,h)*(1.0 - smoothstep(0.2,0.6,h))*0.5);
        float sd = max(dot(d, uSun), 0.0);
        col += vec3(1.0,0.50,0.18) * pow(max(sd, 0.0), 5.0) * 0.55;
        col += vec3(1.0,0.72,0.36) * pow(max(sd, 0.0), 36.0) * 1.3;
        col += vec3(1.0,0.93,0.75) * smoothstep(0.9992, 0.99965, sd) * 7.0;
        // sous l'horizon : brume du désert
        if (h < 0.0) col = mix(hor*0.92, uFogColor, (1.0 - smoothstep(-0.05,0.0,h)));
        gl_FragColor = vec4(col, 1.0); }`,
  });
  const m = new T.Mesh(new T.SphereGeometry(6000, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -10; return m;
}

// ---------------------------------------------------------------- sol du désert
function makeGroundMat() {
  const m = toonBase({ color: 0xffffff });
  return patchToon(m, {
    key: 'ground',
    fColor: `{
      vec2 p = vWPos.xz;
      float n = fbm2(p*0.0035) * 0.7 + fbm2(p*0.018 + 7.0) * 0.3;
      vec3 c = mix(vec3(0.96,0.70,0.06), vec3(0.94,0.50,0.05), smoothstep(0.42, 0.62, n)*0.75);
      float ct = fract(n*7.0); c *= 1.0 - 0.05*step(0.5, ct);
      // petites rides de sable
      float rp = fbm2(vec2(p.x*0.06 + p.y*0.02, p.y*0.5));
      c *= 1.0 - 0.07*step(0.62, rp);
      diffuseColor.rgb = c;
    }`,
  });
}
// ruban de piste : uv = (latéral m, abscisse curviligne m)
function makeTrackMat(half) {
  const m = toonBase({ color: 0xffffff });
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  return patchToon(m, {
    key: 'track', uniforms: { uHalf: { value: half } },
    vPars: 'varying vec2 vTUv;', vMain: 'vTUv = uv;',
    fPars: 'uniform float uHalf; varying vec2 vTUv;',
    fColor: `{
      float d = vTUv.x, s = vTUv.y; float ad = abs(d);
      vec3 c = vec3(0.99,0.79,0.10);
      // stries d'encre le long de la piste
      float cells = 1.15; float lane = floor(d*cells), fl = fract(d*cells);
      float hL = h12(vec2(lane, 1.7)); float wL = mix(0.03, 0.15, h12(vec2(lane, 5.3)));
      float lm = 1.0 - smoothstep(wL*0.55, wL, abs(fl-0.5));
      float segLen = mix(22.0, 110.0, h12(vec2(lane, 9.1)));
      float sp = s/segLen + hL*31.0; float seg = floor(sp), fs = fract(sp);
      float ends = smoothstep(0.0, 0.10, fs) * (1.0 - smoothstep(0.82,1.0,fs));
      float on = step(0.80, h12(vec2(lane*1.31, seg)));
      float onW = step(0.94, h12(vec2(lane*2.1+3.0, seg+11.0)));
      float inTrack = 1.0 - smoothstep(uHalf-3.5, uHalf-2.5, ad);
      c = mix(c, vec3(0.05,0.02,0.0), lm*on*ends*0.92*inTrack);
      c = mix(c, vec3(1.0,0.97,0.86), lm*onW*ends*0.9*inTrack);
      // ligne centrale tiretée
      float cl = (1.0 - smoothstep(0.25, 0.4, abs(d))) * step(0.5, fract(s/14.0)) * inTrack;
      c = mix(c, vec3(0.06,0.02,0.0), cl*0.85);
      // vibreurs de bord (rouge/crème) + bande sombre
      float rum = step(0.5, fract(s/3.2));
      float band = smoothstep(uHalf-3.4, uHalf-3.2, ad) * (1.0 - smoothstep(uHalf-1.6, uHalf-1.4, ad));
      c = mix(c, mix(vec3(0.80,0.13,0.05), vec3(1.0,0.92,0.72), rum), band);
      float edge = smoothstep(uHalf-1.5, uHalf-1.3, ad);
      c = mix(c, vec3(0.10,0.04,0.02), edge*(1.0 - smoothstep(uHalf-0.2, uHalf+0.6, ad)));
      // hors piste : on se fond dans le sable
      vec3 sand = vec3(0.95,0.62,0.06);
      c = mix(c, sand, smoothstep(uHalf+0.3, uHalf+3.5, ad));
      diffuseColor.rgb = c;
    }`,
  });
}
// roche stratifiée
function makeRockMat() {
  const m = toonBase({ vertexColors: true });
  return patchToon(m, {
    key: 'rock',
    fColor: `{
      float n = fbm2(vWPos.xz*0.045 + vWPos.y*0.03);
      float y = vWPos.y*0.42 + n*2.6 + (vWPos.x+vWPos.z)*0.004;
      float band = floor(y); float hb = h12(vec2(band, 3.3));
      vec3 c1 = vec3(0.93,0.42,0.12), c2 = vec3(0.56,0.20,0.09), c3 = vec3(0.98,0.76,0.42), c4 = vec3(0.30,0.11,0.06), c5 = vec3(0.80,0.34,0.11);
      vec3 sc = hb<.18? c1 : hb<.38? c2 : hb<.52? c3 : hb<.70? c4 : c5;
      float thin = step(0.84, fract(y*3.0));
      sc *= 1.0 - 0.32*thin;
      float streak = smoothstep(0.52, 0.72, fbm2(vec2((vWPos.x+vWPos.z)*0.13, vWPos.y*0.012)));
      sc *= 1.0 - 0.30*streak;
      diffuseColor.rgb *= sc;
      float up = smoothstep(0.58, 0.88, vWN.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97,0.66,0.13), up*0.8);
    }`,
  });
}

// ---------------------------------------------------------------- géométrie procédurale : kit de pièces fusionnées
const _e = new T.Euler(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(1, 1, 1), _v = new T.Vector3(), _n3 = new T.Matrix3();
function mk(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); return new T.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); }
class Parts {
  constructor() { this.P = []; this.N = []; this.S = []; this.C = []; this.F = []; }
  add(geo, m, color, flag = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const acc = new Map(), keys = new Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.round(pos.getX(i) * 400) + '_' + Math.round(pos.getY(i) * 400) + '_' + Math.round(pos.getZ(i) * 400); keys[i] = k;
      let a = acc.get(k); if (!a) { a = [0, 0, 0]; acc.set(k, a); } a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
    }
    const nm = _n3.getNormalMatrix(m), c = color instanceof T.Color ? color : new T.Color(color);
    for (let i = 0; i < n; i++) {
      _v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m); this.P.push(_v.x, _v.y, _v.z);
      _v.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(nm).normalize(); this.N.push(_v.x, _v.y, _v.z);
      const a = acc.get(keys[i]); _v.set(a[0], a[1], a[2]).normalize().applyMatrix3(nm).normalize(); this.S.push(_v.x, _v.y, _v.z);
      this.C.push(c.r, c.g, c.b); this.F.push(flag);
    }
  }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3));
    g.setAttribute('aSN', new T.Float32BufferAttribute(this.S, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aFlag', new T.Float32BufferAttribute(this.F, 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
  get empty() { return this.P.length === 0; }
}
const DARK = 0x1b120c, DARK2 = 0x2d2119, STEEL = 0x77747a, STEEL2 = 0x4a484f, CREAM = 0xf2e0b4, GLASS = 0x10161d;
class Kit {
  constructor(seed) { this.B = new Parts(); this.E = new Parts(); this.rng = mulberry32(seed); this.exh = []; this.decals = []; this.stacks = []; }
  _tg(o) { return o.e ? this.E : this.B; }
  _g(shape, depth, ch) {
    return new T.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - 2 * ch), bevelEnabled: ch > 0, bevelThickness: ch, bevelSize: ch, bevelSegments: 1, curveSegments: 3 });
  }
  box(w, h, d, x, y, z, col, o = {}) {
    const ch = o.ch ?? 0.06; let g;
    if (ch > 0 && w > 2 * ch + 0.03 && h > 2 * ch + 0.03 && d > 2 * ch + 0.03) {
      const hw = (w - 2 * ch) / 2, hh = (h - 2 * ch) / 2, sh = new T.Shape(); sh.moveTo(-hw, -hh); sh.lineTo(hw, -hh); sh.lineTo(hw, hh); sh.lineTo(-hw, hh); sh.closePath();
      g = this._g(sh, d, ch); g.translate(0, 0, -(d - 2 * ch) / 2);
    } else g = new T.BoxGeometry(w, h, d);
    const r = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, r[0], r[1], r[2]), col, o.f ?? 1);
  }
  cyl(rt, rb, len, x, y, z, col, o = {}) {
    const g = new T.CylinderGeometry(rt, rb, len, o.seg || 22, 1, !!o.open);
    const ax = o.axis || 'z'; if (ax === 'z') g.rotateX(Math.PI / 2); else if (ax === 'x') g.rotateZ(-Math.PI / 2);
    const r = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, r[0], r[1], r[2]), col, o.f ?? 1);
  }
  ring(R, r, x, y, z, col, o = {}) {
    const g = new T.TorusGeometry(R, r, 6, o.seg || 28); const rr = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, rr[0], rr[1], rr[2]), col, o.f ?? 1);
  }
  sph(r, x, y, z, col, o = {}) {
    const g = new T.SphereGeometry(1, o.seg || 22, 14); const rr = o.r || [0, 0, 0];
    this._tg(o).add(g, mk(x, y, z, rr[0], rr[1], rr[2], r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1)), col, o.f ?? 1);
  }
  disc(r, x, y, z, col, o = {}) { const g = new T.CircleGeometry(r, o.seg || 24); const rr = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, rr[0], rr[1], rr[2]), col, o.f ?? 0); }
  quad(w, h, x, y, z, col, o = {}) { const g = new T.PlaneGeometry(w, h); const rr = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, rr[0], rr[1], rr[2]), col, o.f ?? 0); }
  // profil (z,y) extrudé en largeur (axe X)
  prismZY(pts, width, x, y, z, col, o = {}) {
    const ch = o.ch ?? 0.05, sh = new T.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); sh.closePath();
    const g = this._g(sh, width, ch); g.translate(0, 0, -(width - 2 * ch) / 2); g.rotateY(-Math.PI / 2); const rr = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, rr[0], rr[1], rr[2]), col, o.f ?? 1);
  }
  // profil (x,z) extrudé en hauteur (axe Y)
  prismXZ(pts, th, x, y, z, col, o = {}) {
    const ch = o.ch ?? 0.04, sh = new T.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); sh.closePath();
    const g = this._g(sh, th, ch); g.translate(0, 0, -(th - 2 * ch) / 2); g.rotateX(Math.PI / 2); const rr = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, rr[0], rr[1], rr[2]), col, o.f ?? 1);
  }
  // profil (x,y) extrudé en profondeur (axe Z)
  slabXY(pts, depth, x, y, z, col, o = {}) {
    const ch = o.ch ?? 0.05, sh = new T.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); sh.closePath();
    const g = this._g(sh, depth, ch); g.translate(0, 0, -(depth - 2 * ch) / 2); const rr = o.r || [0, 0, 0]; this._tg(o).add(g, mk(x, y, z, rr[0], rr[1], rr[2]), col, o.f ?? 1);
  }
  tube(pts, r, col, o = {}) {
    const c = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
    const g = new T.TubeGeometry(c, o.segs || 14, r, 6, false); this._tg(o).add(g, new T.Matrix4(), col, o.f ?? 0);
  }
  lightRow(n, x0, x1, y, z, col, r = 0.09) { for (let i = 0; i < n; i++) { const x = lerp(x0, x1, n === 1 ? 0.5 : i / (n - 1)); this.sph(r, x, y, z, col, { e: true, seg: 8 }); } }
  grille(w, d, x, y, z, n, col, o = {}) { for (let i = 0; i < n; i++) this.box(w, o.h || 0.06, d / n * 0.55, x, y, z - d / 2 + (i + 0.5) * d / n, col, { ch: 0, f: 0 }); }
  ladder(x, y0, y1, z, col) { this.box(0.05, y1 - y0, 0.05, x, (y0 + y1) / 2, z - 0.22, col, { ch: 0, f: 0 }); this.box(0.05, y1 - y0, 0.05, x, (y0 + y1) / 2, z + 0.22, col, { ch: 0, f: 0 }); for (let y = y0 + 0.15; y < y1; y += 0.28) this.box(0.05, 0.05, 0.44, x, y, z, col, { ch: 0, f: 0 }); }
  // nacelle moteur (axe Z, avant en +Z). renvoie l'échappement
  nacelle(x, y, zF, len, r, acc, o = {}) {
    const body = o.body ?? STEEL, dark = DARK2, k = this;
    k.cyl(r, r, len * 0.72, x, y, zF - len * 0.36, body, { seg: 26 });
    for (let i = 0; i < 3; i++) k.cyl(r * 1.06, r * 1.06, 0.26 + r * 0.12, x, y, zF - len * (0.12 + i * 0.2), acc, { seg: 26 });
    k.ring(r * 0.98, 0.1, x, y, zF, acc, { seg: 30 });
    k.cyl(r * 0.9, r * 0.9, 0.06, x, y, zF - 0.06, DARK, { seg: 26, f: 0 });
    const nb = o.blades ?? 8; for (let i = 0; i < nb; i++) { const a = i / nb * TAU; k.box(0.09, r * 0.8, 0.05, x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, zF - 0.12, STEEL, { ch: 0, f: 0, r: [0, 0, a - Math.PI / 2 + 0.35] }); }
    k.cyl(r * 0.22, r * 0.22, 0.2, x, y, zF - 0.1, acc, { seg: 12, f: 0 });
    const nf = o.fins ?? 8; for (let i = 0; i < nf; i++) { const a = i / nf * TAU + 0.2; k.box(0.06, 0.3 + r * 0.15, len * 0.42, x + Math.cos(a) * (r + 0.1), y + Math.sin(a) * (r + 0.1), zF - len * 0.42, dark, { ch: 0, f: 0, r: [0, 0, a - Math.PI / 2] }); }
    const zb = zF - len * 0.72, bl = len * 0.28;
    k.cyl(r * 0.86, r * 1.16, bl, x, y, zb - bl / 2, dark, { seg: 26, f: 0 });
    k.ring(r * 1.14, 0.07, x, y, zF - len, acc, { seg: 30 });
    k.cyl(r * 0.9, r * 0.9, 0.05, x, y, zF - len + 0.03, new T.Color(3.4, 3.8, 5.6), { seg: 26, e: true });
    k.ring(r * 0.95, 0.06, x, y, zF - len + 0.05, new T.Color(6, 6.5, 8), { seg: 26, e: true });
    const ex = { p: new T.Vector3(x, y, zF - len - 0.05), r: r * (o.fr ?? 0.9), dir: new T.Vector3(0, 0, -1) }; this.exh.push(ex); return ex;
  }
  decal(text, x, y, z, w, h, ry, fg, opts = {}) { this.decals.push({ text, x, y, z, w, h, ry, fg, ...opts }); }
}

// ---------------------------------------------------------------- 6 pods
const POD_DEFS = [
  { id: 'kraken', name: 'KRAKEN', num: '07', tag: 'Heavy tank', col: 0xf39a16, seed: 11, tile: 0.24, stats: { vmax: 1.0, acc: 0.95, turn: 0.92, boost: 1.0 }, build: buildKraken },
  { id: 'viper', name: 'VIPER', num: '13', tag: 'Pure dart', col: 0xd8331a, seed: 23, tile: 0.30, stats: { vmax: 1.03, acc: 0.9, turn: 0.98, boost: 1.05 }, build: buildViper },
  { id: 'titan', name: 'TITAN', num: '88', tag: 'Triple-engine brick', col: 0x1e9aa0, seed: 37, tile: 0.20, stats: { vmax: 0.98, acc: 1.05, turn: 0.86, boost: 0.95 }, build: buildTitan },
  { id: 'mantis', name: 'MANTIS', num: '04', tag: 'Twin harness', col: 0xf0e2c0, seed: 41, tile: 0.26, stats: { vmax: 1.01, acc: 0.95, turn: 1.0, boost: 1.0 }, build: buildMantis },
  { id: 'basalt', name: 'BASALT', num: '66', tag: 'Roller', col: 0x3b3a45, seed: 53, tile: 0.22, stats: { vmax: 0.99, acc: 1.0, turn: 0.94, boost: 1.05 }, build: buildBasalt },
  { id: 'wasp', name: 'WASP', num: '21', tag: 'Nervous quad', col: 0xd12a8c, seed: 67, tile: 0.34, stats: { vmax: 0.96, acc: 1.1, turn: 1.12, boost: 0.95 }, build: buildWasp },
];
function buildKraken(k) {
  const O1 = 0xf39a16, O2 = 0xd0700c, O3 = 0xffbe3d, BK = DARK;
  k.box(3.4, 2.4, 8.6, 0, 1.95, -0.2, O1, { ch: 0.14 });
  k.box(3.7, 0.5, 8.9, 0, 0.75, -0.2, O2, { ch: 0.1 });
  // bouclier avant sombre + cadre
  k.slabXY([[-1.95, 0], [1.95, 0], [1.6, 3.35], [-1.6, 3.35]], 0.55, 0, 0.5, 4.5, BK, { f: 0, ch: 0.07, r: [-0.09, 0, 0] });
  k.box(4.3, 0.42, 1.3, 0, 4.0, 4.4, O1, { ch: 0.1, r: [0.12, 0, 0] });
  for (const s of [-1, 1]) { k.box(0.34, 3.5, 0.8, s * 1.98, 2.2, 4.35, O1, { ch: 0.08, r: [-0.09, 0, -s * 0.12] }); k.box(0.3, 0.5, 1.4, s * 2.05, 3.1, 3.6, O3, { ch: 0.06 }); }
  k.box(4.2, 0.28, 0.5, 0, 0.62, 4.7, O2, { ch: 0.06 });
  k.lightRow(7, -1.85, 1.85, 4.2, 5.05, new T.Color(4.5, 3.6, 2.2), 0.12);
  for (let i = 0; i < 3; i++) k.box(2.4 - i * 0.5, 0.1, 0.06, 0, 2.6 - i * 0.35, 4.83, new T.Color(3.4, 1.2, 0.2), { e: true, ch: 0 });
  k.box(0.5, 0.9, 0.06, -1.05, 1.2, 4.85, new T.Color(3.6, 0.5, 0.1), { e: true, ch: 0, r: [0, 0, 0.35] });  // éclair
  // toit
  k.box(3.9, 0.2, 6.8, 0, 3.28, -0.4, O3, { ch: 0.05 });
  k.grille(2.7, 5.4, 0, 3.42, -0.6, 10, BK);
  k.box(0.5, 0.4, 7, 0, 3.55, -0.5, O2, { ch: 0.08 });
  k.lightRow(4, -1.7, 1.7, 3.5, 3.05, new T.Color(3.5, 2.6, 1.2), 0.09);
  // flancs blindés
  for (const s of [-1, 1]) {
    k.box(0.34, 2.3, 7.4, s * 1.95, 1.85, -0.3, O3, { ch: 0.07, r: [0, 0, -s * 0.1] });
    k.box(0.1, 0.95, 2.4, s * 2.2, 2.15, -1.1, BK, { f: 0, ch: 0 });
    for (let i = 0; i < 5; i++) k.box(0.14, 0.06, 2.3, s * 2.22, 1.8 + i * 0.16, -1.1, DARK2, { f: 0, ch: 0 });
    k.box(0.36, 0.7, 2.2, s * 2.02, 1.1, 1.8, O2, { ch: 0.05 });
  }
  k.ladder(2.24, 0.9, 3.1, -2.6, STEEL);
  // dessous + patins stabilisateurs
  k.box(3.0, 0.4, 8.2, 0, 0.5, -0.3, DARK2, { f: 0, ch: 0.05 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.cyl(0.5, 0.62, 0.3, sx * 1.35, 0.42, sz * 2.7 - 0.2, STEEL2, { axis: 'y' }); k.ring(0.5, 0.06, sx * 1.35, 0.26, sz * 2.7 - 0.2, new T.Color(4, 2.2, 0.8), { e: true, r: [Math.PI / 2, 0, 0], seg: 20 }); }
  // arrière
  k.box(3.7, 2.7, 0.45, 0, 1.95, -4.7, DARK2, { ch: 0.06 });
  k.box(4.8, 0.4, 0.9, 0, 1.2, -5.0, STEEL2, { ch: 0.06 });
  for (const s of [-1, 1]) {
    k.box(0.5, 0.5, 1.6, s * 1.55, 1.85, -4.9, STEEL2, { ch: 0.06 });
    k.nacelle(s * 2.25, 1.85, -4.9, 4.2, 0.95, O1);
    k.sph(0.85, s * 2.25, 3.25, -5.7, O1, { seg: 26 });
    for (let i = 0; i < 3; i++) k.ring(0.86, 0.045, s * 2.25, 3.25, -5.7 + (i - 1) * 0.4, BK, { f: 0, seg: 26 });
    k.cyl(0.14, 0.14, 0.9, s * 2.25, 2.4, -5.7, DARK2, { axis: 'y', f: 0 });
    k.tube([[s * 1.5, 3.1, -2.4], [s * 1.9, 3.6, -4.2], [s * 2.25, 3.4, -5.4]], 0.06, DARK2);
  }
  k.cyl(0.03, 0.03, 2.2, 1.2, 4.5, -3.6, STEEL, { axis: 'y', f: 0 }); k.sph(0.09, 1.2, 5.65, -3.6, new T.Color(5, 0.3, 0.2), { e: true, seg: 8 });
  k.decal('KRAKEN', 2.14, 1.9, 1.0, 3.0, 0.62, Math.PI / 2, '#1b120c', { bg: '#f7c341' });
  k.decal('KRAKEN', -2.14, 1.9, 1.0, 3.0, 0.62, -Math.PI / 2, '#1b120c', { bg: '#f7c341' });
  k.decal('07', 0, 3.72, 4.66, 0.9, 0.5, 0, '#ffc21a', { bg: null, rx: -0.09 });
  k.decal('07', 0, 1.55, -4.94, 1.3, 0.8, Math.PI, '#ffc21a', { bg: '#1b120c' });
}
const mirX = (pts, s) => s > 0 ? pts : pts.map(p => [-p[0], p[1]]).reverse();   // miroir d'un profil XZ (aile gauche)
function buildViper(k) {
  const R = 0xd8331a, R2 = 0xa82212, C = CREAM;
  k.prismZY([[6.8, 1.1], [3.2, 2.3], [-2, 2.95], [-5.4, 2.75], [-5.4, 0.9], [3.6, 0.9]], 1.9, 0, 0, 0, R, { ch: 0.1 });
  k.prismZY([[6.6, 1.0], [3.5, 0.62], [-5.2, 0.62], [-5.2, 0.95], [3.6, 0.95]], 1.4, 0, 0, 0, DARK2, { ch: 0.05, f: 0 });
  k.sph(1, 0, 2.95, 0.6, GLASS, { sx: 0.72, sy: 0.55, sz: 1.7, f: 0 });
  k.ring(1, 0.06, 0, 2.7, 0.6, C, { r: [Math.PI / 2, 0, 0], seg: 20 });
  k.box(0.36, 0.55, 7.5, 0, 3.15, -2.6, C, { ch: 0.07, r: [-0.05, 0, 0] });
  k.box(1.96, 0.1, 2.3, 0, 1.75, 3.5, C, { ch: 0.02, r: [-0.36, 0, 0] });
  for (const s of [-1, 1]) {
    k.prismXZ(mirX([[0.9, 2.6], [7.0, -3.0], [7.0, -4.8], [0.9, -4.2]], s), 0.24, s * 0.0, 1.7, 0, R, { ch: 0.04 });
    k.prismXZ(mirX([[0.9, 2.6], [7.0, -3.0], [7.0, -3.4], [1.1, 2.5]], s), 0.28, 0, 1.7, 0, C, { ch: 0.02 });
    k.prismXZ(mirX([[0.7, 5.0], [3.0, 2.6], [3.0, 2.0], [0.7, 3.2]], s), 0.16, 0, 1.55, 0, R2, { ch: 0.02 });
    k.nacelle(s * 7.0, 1.7, -1.3, 3.6, 0.5, R, { body: C, blades: 6, fins: 6 });
    k.box(0.5, 0.3, 1.6, s * 6.4, 1.7, -3.0, DARK2, { ch: 0.04 });
    k.tube([[s * 1.0, 1.55, -2.2], [s * 3.2, 2.35, -2.7], [s * 6.3, 1.75, -2.5]], 0.09, DARK, { segs: 18 });
    k.prismZY([[-3.8, 1.6], [-7.6, 5.4], [-8.4, 5.4], [-7.9, 1.6]], 0.13, s * 1.75, 0, 0, R, { ch: 0.02, r: [0, 0, s * 0.34] });
    k.prismZY([[-6.9, 4.6], [-8.4, 5.4], [-7.6, 5.4]], 0.15, s * 2.35, 0.0, 0.0, C, { ch: 0.02, r: [0, 0, s * 0.34] });
    k.box(0.16, 0.16, 5.2, s * 0.98, 1.1, 0.8, DARK, { f: 0, ch: 0 });
  }
  k.box(2.2, 0.5, 2.4, 0, 1.6, -5.4, DARK2, { ch: 0.08 });
  k.nacelle(0, 1.95, -3.4, 5.2, 1.45, R, { body: R2, blades: 12, fins: 10 });
  k.ring(1.62, 0.08, 0, 1.95, -6.4, C, { seg: 30 });
  k.lightRow(5, -0.55, 0.55, 2.3, 6.9 - 1.0, new T.Color(4.6, 3.8, 2.4), 0.1);
  k.decal('VIPER', 0.98, 1.95, -0.8, 2.6, 0.5, Math.PI / 2, '#d8331a', { bg: '#f2e0b4' });
  k.decal('VIPER', -0.98, 1.95, -0.8, 2.6, 0.5, -Math.PI / 2, '#d8331a', { bg: '#f2e0b4' });
  k.decal('13', 0, 3.0, -1.3, 0.9, 0.55, 0, '#1b120c', { bg: null, rx: -Math.PI / 2 + 0.05 });
}
function buildTitan(k) {
  const TL = 0x1e9aa0, TL2 = 0x137a80, HZ = 0xffc21a, BK = DARK2;
  k.box(4.8, 2.9, 7.6, 0, 2.2, 0, TL, { ch: 0.2 });
  k.box(4.3, 1.0, 5.0, 0, 4.15, -0.9, TL2, { ch: 0.14 });
  k.box(3.7, 0.16, 4.4, 0, 4.72, -0.8, TL, { ch: 0.04 });
  k.box(3.8, 0.6, 0.3, 0, 4.15, 1.62, DARK, { f: 0, ch: 0.05 });
  k.box(3.5, 0.24, 0.08, 0, 4.17, 1.8, new T.Color(4.2, 1.6, 0.25), { e: true, ch: 0 });
  k.box(5.4, 1.3, 1.3, 0, 1.15, 4.0, BK, { ch: 0.12 });
  k.box(5.0, 0.7, 0.24, 0, 1.15, 4.7, HZ, { f: 2, ch: 0.04 });
  for (const s of [-1, 1]) {
    k.sph(0.3, s * 1.85, 2.5, 3.85, new T.Color(5, 4.4, 3), { e: true, seg: 12 }); k.ring(0.36, 0.06, s * 1.85, 2.5, 3.83, DARK, { seg: 16 });
    k.box(0.34, 1.9, 7.4, s * 2.55, 1.15, 0, BK, { ch: 0.06 });
    k.box(0.36, 0.55, 3.4, s * 2.58, 0.85, -1.0, HZ, { f: 2, ch: 0.03 });
    k.box(0.5, 0.5, 1.0, s * 2.6, 2.6, 3.6, TL2, { ch: 0.06 });
    k.cyl(0.42, 0.5, 2.4, s * 1.35, 5.75, -2.4, BK, { axis: 'y' });
    k.ring(0.5, 0.06, s * 1.35, 6.9, -2.4, TL, { r: [Math.PI / 2, 0, 0], seg: 20 });
    k.disc(0.4, s * 1.35, 6.95, -2.4, new T.Color(3.6, 1.5, 0.3), { r: [-Math.PI / 2, 0, 0], e: true });
    k.stacks.push({ p: new T.Vector3(s * 1.35, 7.05, -2.4), r: 0.5 });
  }
  k.box(5.6, 0.3, 1.1, 0, 5.2, -4.5, BK, { ch: 0.05 });
  for (const s of [-1, 1]) k.box(0.3, 1.1, 0.8, s * 2.4, 4.7, -4.5, TL2, { ch: 0.05 });
  k.box(5.0, 3.0, 0.5, 0, 2.2, -3.95, DARK2, { ch: 0.08 });
  k.box(4.8, 0.9, 0.18, 0, 0.85, -4.0, HZ, { f: 2, ch: 0.03 });
  for (const x of [-2.15, 0, 2.15]) { k.box(1.6, 1.6, 0.9, x, 2.2, -4.25, STEEL2, { ch: 0.06 }); k.nacelle(x, 2.2, -4.5, 3.6, 0.85, TL, { fins: 6 }); }
  k.box(2.4, 0.5, 6.6, 0, 0.5, 0, DARK, { f: 0, ch: 0.04 });
  k.grille(3.4, 3.0, 0, 3.72, 1.6, 8, DARK);
  k.ladder(2.75, 0.6, 3.6, -1.5, STEEL);
  for (let i = 0; i < 8; i++) k.sph(0.06, -1.6 + i * 0.45, 3.68, 3.2, new T.Color(0.8, 4, 4), { e: true, seg: 6 });
  k.decal('TITAN', 2.75, 1.9, 0.9, 3.2, 0.7, Math.PI / 2, '#0f4f54', { bg: '#f2e0b4' });
  k.decal('TITAN', -2.75, 1.9, 0.9, 3.2, 0.7, -Math.PI / 2, '#0f4f54', { bg: '#f2e0b4' });
  k.decal('88', 0, 2.2, -4.55, 1.7, 1.0, Math.PI, '#f2e0b4', { bg: '#0f4f54' });
}
function buildMantis(k) {
  const CR = CREAM, RD = 0xc8281e, GY = 0x55535b;
  for (const s of [-1, 1]) {
    const x = s * 3.1;
    k.nacelle(x, 1.9, 5.6, 8.0, 1.2, RD, { body: CR, blades: 10, fins: 10, fr: 0.85 });
    k.box(0.5, 1.5, 1.6, x, 1.9, 2.8, GY, { ch: 0.05 });
    k.prismZY([[4.4, 0.4], [4.4, 1.0], [-2.0, 1.0], [-2.0, 0.4]], 0.9, x, 0.75, 0, DARK2, { ch: 0.05, f: 0 });
    k.box(0.9, 0.5, 2.6, x, 3.35, 0.6, RD, { ch: 0.06 });
    k.lightRow(3, -0.4, 0.4, 3.2, 5.6, new T.Color(4, 3.5, 2.4), 0.09);
    k.box(0.3, 0.9, 3.0, s * 4.4, 1.9, -0.4, RD, { ch: 0.05 });
    for (let z of [4.4, 0.4, -1.8]) k.box(3.4, 0.36, 0.7, s * 1.55, 1.95, z, CR, { ch: 0.06 });
    k.tube([[x * 0.95, 2.5, 5.2], [x * 0.7, 3.4, 1.0], [s * 0.7, 2.7, -3.3]], 0.07, DARK, { segs: 20 });
    k.tube([[x * 0.95, 1.4, 5.2], [x * 0.6, 0.9, 0.5], [s * 0.6, 1.5, -3.5]], 0.07, DARK, { segs: 20 });
    k.prismZY([[-6.6, 1.9], [-9.0, 4.3], [-9.6, 4.3], [-9.0, 1.9]], 0.14, s * 2.6, 0, 0, RD, { ch: 0.02, r: [0, 0, s * 0.18] });
    k.box(0.18, 0.8, 2.2, s * 3.0, 2.2, -7.9, CR, { ch: 0.03 });
  }
  k.box(0.75, 0.7, 12, 0, 1.75, -1.0, DARK2, { ch: 0.06 });
  k.box(3.6, 0.2, 1.4, 0, 2.4, -8.6, RD, { ch: 0.03 }); k.box(7.0, 0.16, 1.5, 0, 2.5, -8.9, CR, { ch: 0.03 });
  k.sph(1.2, 0, 2.05, -5.0, CR, { sx: 0.95, sy: 1, sz: 2.0 });
  k.sph(0.85, 0, 2.7, -4.3, GLASS, { sx: 0.85, sy: 0.72, sz: 1.35, f: 0 });
  k.ring(0.9, 0.05, 0, 2.5, -4.3, RD, { r: [Math.PI / 2, 0, 0], seg: 20 });
  k.box(0.28, 0.8, 4.4, 0, 3.0, -7.0, CR, { ch: 0.04 });
  k.box(3.6, 0.1, 0.8, 0, 1.35, -3.6, GY, { ch: 0.02 });
  k.lightRow(3, -0.3, 0.3, 3.55, -6.5, new T.Color(5, 0.4, 0.2), 0.08);
  k.decal('MANTIS', 3.1 + 1.22, 1.95, 1.4, 3.4, 0.6, Math.PI / 2, '#c8281e', { bg: '#f2e0b4' });
  k.decal('MANTIS', -3.1 - 1.22, 1.95, 1.4, 3.4, 0.6, -Math.PI / 2, '#c8281e', { bg: '#f2e0b4' });
  k.decal('04', 0, 2.35, -6.05, 1.0, 0.7, 0, '#c8281e', { bg: null, rx: -Math.PI / 2 });
}
function buildBasalt(k) {
  const G1 = 0x3b3a45, G2 = 0x26252d, OR = 0xf08a10;
  k.cyl(1.95, 1.95, 7.4, 0, 2.4, -0.2, G1, { seg: 28 });
  for (const z of [2.7, 0.2, -2.3]) k.cyl(2.03, 2.03, 0.55, 0, 2.4, z, OR, { seg: 28 });
  k.cyl(0.7, 1.95, 2.4, 0, 2.4, 4.7, G1, { seg: 28 });
  k.disc(0.7, 0, 2.4, 5.91, DARK, { seg: 20 }); k.ring(0.72, 0.09, 0, 2.4, 5.9, OR, { seg: 24 });
  k.sph(0.32, 0, 2.4, 5.98, new T.Color(4.5, 3.2, 1.6), { e: true, seg: 10 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; k.box(0.06, 0.5, 2.0, Math.cos(a) * 1.55, 2.4 + Math.sin(a) * 1.55, 4.7, OR, { ch: 0.02, f: 0, r: [0, 0, a - Math.PI / 2] }); }
  k.cyl(1.6, 1.95, 1.0, 0, 2.4, -4.3, G2, { seg: 28 });
  k.cyl(1.05, 1.15, 0.8, 0, 2.4, -5.15, DARK2, { seg: 24 });
  k.sph(1, 0, 3.75, 1.4, GLASS, { sx: 0.8, sy: 0.5, sz: 1.5, f: 0 });
  k.box(0.6, 0.35, 8, 0, 4.4, -0.6, OR, { ch: 0.06 });
  k.lightRow(6, -0.0, 0.0, 4.65, 2.8, new T.Color(4.5, 3.4, 1.8), 0.11);
  for (let i = 0; i < 6; i++) k.sph(0.09, 0, 4.65, 3.3 - i * 1.2, new T.Color(4.5, 3.4, 1.8), { e: true, seg: 8 });
  for (const s of [-1, 1]) {
    k.box(2.0, 0.28, 1.8, s * 2.9, 2.0, 0.3, G2, { ch: 0.06 });
    k.box(1.4, 0.3, 1.3, s * 2.6, 2.05, -1.6, OR, { ch: 0.05 });
    k.nacelle(s * 3.9, 1.8, 2.6, 6.0, 0.95, OR, { body: G1, fins: 8 });
    k.box(0.26, 2.9, 2.0, s * 1.2, 2.6, -5.2, OR, { ch: 0.04 });
    k.prismZY([[-3.2, 4.1], [-5.6, 6.6], [-6.4, 6.6], [-5.6, 4.1]], 0.14, s * 0.6, 0, 0, G2, { ch: 0.02 });
    k.tube([[s * 1.6, 3.0, 1.5], [s * 2.6, 3.4, 1.2], [s * 3.6, 2.9, 1.4]], 0.06, DARK);
    k.box(0.4, 1.4, 1.4, s * 2.0, 1.0, 0.0, DARK2, { ch: 0.05 });
  }
  k.nacelle(0, 2.4, -5.5, 1.2, 0.9, OR, { body: G2, blades: 0, fins: 0, fr: 0.8 });
  k.decal('BASALT', 0, 4.1, -1.5, 2.6, 0.7, 0, '#f08a10', { bg: '#1b120c', rx: -Math.PI / 2 });
  k.decal('66', 0, 2.5, -5.4, 1.2, 0.8, Math.PI, '#f08a10', { bg: null });
}
function buildWasp(k) {
  const M = 0xd12a8c, M2 = 0x9c1a68, W = 0xf6ecdc;
  k.sph(1, 0, 1.95, 0.4, M, { sx: 1.3, sy: 1.0, sz: 3.4, seg: 26 });
  k.cyl(0.05, 0.42, 3.4, 0, 1.9, 4.6, W, { seg: 16 });
  k.sph(1, 0, 2.55, 0.8, GLASS, { sx: 0.85, sy: 0.65, sz: 1.5, f: 0 });
  k.ring(1, 0.05, 0, 2.3, 0.8, W, { r: [Math.PI / 2, 0, 0], seg: 22 });
  k.box(0.9, 0.06, 5.5, 0, 2.95, -1.4, W, { ch: 0.0, f: 0 });
  k.box(0.25, 0.8, 3.4, 0, 2.7, -3.2, M2, { ch: 0.04, r: [0.1, 0, 0] });
  for (const s of [-1, 1]) {
    k.prismXZ(mirX([[1.1, 1.8], [5.2, -2.2], [5.2, -3.4], [1.1, -1.6]], s), 0.14, 0, 1.75, 0, W, { ch: 0.02 });
    k.prismXZ(mirX([[3.2, -0.5], [5.2, -2.2], [5.2, -3.4], [3.2, -2.6]], s), 0.18, 0, 1.78, 0, M, { ch: 0.02 });
    for (const y of [1.0, 2.9]) {
      k.nacelle(s * 2.05, y, -0.6, 3.8, 0.55, W, { body: M2, blades: 6, fins: 6 });
      k.box(0.5, Math.abs(y - 1.95) + 0.1, 0.5, s * 1.55, (y + 1.95) / 2, -1.2, DARK2, { ch: 0.03 });
      k.tube([[s * 0.9, 1.95, -1.6], [s * 1.5, (y + 1.95) / 2 + 0.35, -2.0], [s * 2.05, y, -2.2]], 0.07, DARK, { segs: 14 });
    }
    k.box(0.3, 1.1, 1.6, s * 5.2, 1.9, -3.0, M2, { ch: 0.03 });
  }
  k.lightRow(4, -0.6, 0.6, 2.2, 3.75, new T.Color(4.5, 3.4, 2.0), 0.08);
  k.decal('WASP', 1.26, 2.05, 0.2, 2.0, 0.48, Math.PI / 2, '#d12a8c', { bg: '#f6ecdc' });
  k.decal('WASP', -1.26, 2.05, 0.2, 2.0, 0.48, -Math.PI / 2, '#d12a8c', { bg: '#f6ecdc' });
  k.decal('21', 0, 3.05, -3.0, 0.9, 0.6, 0, '#f6ecdc', { bg: null, rx: -Math.PI / 2 });
}

// ---------------------------------------------------------------- flammes / lueurs (billboards additifs)
function makeFlameMat() {
  return new T.ShaderMaterial({
    uniforms: { uTime: SU.uTime, uLen: { value: 6 }, uWid: { value: 1 }, uPower: { value: 1 }, uPh: { value: 0 }, uBoost: { value: 0 } },
    transparent: true, depthWrite: false, blending: T.NormalBlending, side: T.DoubleSide, fog: false,
    vertexShader: `uniform float uLen, uWid, uTime, uPh, uBoost; varying vec2 vQ;
      void main(){ vQ = position.xy;
        vec3 axisW = normalize((modelMatrix*vec4(0.,0.,-1.,0.)).xyz); vec3 base = (modelMatrix*vec4(0.,0.,0.,1.)).xyz;
        vec3 camDir = normalize(cameraPosition - base); vec3 side = normalize(cross(axisW, camDir));
        float L = uLen * (1.0 + 0.07*sin(uTime*53.0 + uPh) + 0.05*sin(uTime*97.0 + uPh*2.0) + uBoost*0.07*sin(uTime*31.0 + uPh));
        float Wd = uWid * (1.0 + uBoost*0.35 + 0.05*sin(uTime*71.0 + uPh));
        vec3 wp = base + axisW*position.y*L + side*position.x*Wd*(1.0 + position.y*(0.12 + uBoost*0.5));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `uniform float uTime, uPower, uPh, uBoost; varying vec2 vQ; ${GLSL_NOISE}
      void main(){
        float v = vQ.y, u = vQ.x, t = uTime + uPh, bo = uBoost;
        float w = pow(max(1.0 - v, 0.0), mix(0.55, 0.40, bo));
        float jag = 0.70 + 0.60*vn2(vec2(u*2.5 + t*3.0, v*7.0 - t*38.0));
        float d = abs(u) / max(w*jag, 1e-3);
        float core = (1.0 - smoothstep(0.0,0.62,d)) * (1.0 - v*0.5);
        float halo = (1.0 - smoothstep(0.25,1.05,d)) * (1.0 - v);
        float st = pow(max(vn2(vec2(u*16.0, v*1.6 - t*46.0)), 0.0), 2.5);
        float dia = pow(max(0.5 + 0.5*cos((v*6.5 - t*2.4)*6.2832), 0.0), 3.0) * (1.0 - smoothstep(0.0,0.55,d)) * (1.0 - v);
        float ray = pow(max(vn2(vec2(u*34.0, t*22.0 + v*2.0)), 0.0), 4.0) * (1.0 - smoothstep(0.15,1.5,d)) * (1.0 - v*0.7);
        float rp = fract(v*2.4 - t*5.0); float ring = smoothstep(0.0, 0.07, rp) * (1.0 - smoothstep(0.07, 0.24, rp)) * (1.0 - smoothstep(0.1,1.0,d)) * (1.0 - v) * bo;
        float streak = pow(max(vn2(vec2(u*9.0, v*0.7 - t*30.0)), 0.0), 3.0) * (1.0 - smoothstep(0.0,0.9,d)) * bo;
        vec3 cool = vec3(0.22, 0.42, 1.0), hot = vec3(1.0, 0.30, 0.04);
        vec3 col = mix(mix(cool, hot, bo*0.9) * 1.5, mix(vec3(2.4, 2.6, 3.2), vec3(3.2, 2.6, 1.6), bo), smoothstep(0.05, 0.9, core));
        col += vec3(1.0, 0.82, 0.55) * (dia*1.2 + ring*1.8 + streak*1.0);
        float pulse = 0.88 + 0.12*sin(t*40.0);
        float a = (halo*0.85 + core + ray*(0.55 + 0.6*bo) + ring*0.9 + streak*0.6) * (0.55 + st*0.9) * (0.75 + 0.25*step(0.5, fract(v*9.0 - t*22.0))) * uPower * pulse;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0)); }`,
  });
}
function makeGlowMat() {
  return new T.ShaderMaterial({
    uniforms: { uSize: { value: 4 }, uPower: { value: 1 }, uCol: { value: new T.Color(0.5, 0.65, 1.0) } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
    vertexShader: `uniform float uSize; varying vec2 vQ; void main(){ vQ = position.xy;
      vec4 c = viewMatrix * modelMatrix * vec4(0.,0.,0.,1.); c.xy += position.xy * uSize; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform float uPower; uniform vec3 uCol; varying vec2 vQ;
      void main(){ vec2 p = vQ; float r = length(p);
        float g = 1.0/(1.0 + r*r*22.0) ; g *= (1.0 - smoothstep(0.55,1.0,r));
        float st = exp(-abs(p.y)*14.0) * exp(-abs(p.x)*2.2) * 0.55 + exp(-abs(p.x)*14.0) * exp(-abs(p.y)*3.0) * 0.18;
        float c = exp(-r*r*70.0);
        vec3 col = uCol * (g*1.2 + st) + vec3(1.0)*c*3.0;
        gl_FragColor = vec4(col*uPower, 1.0); }`,
  });
}
const FLAME_GEO = (() => { const g = new T.PlaneGeometry(2, 1, 1, 10); g.translate(0, 0.5, 0); return g; })();
const GLOW_GEO = new T.PlaneGeometry(2, 2);
const FLAME_MAT = makeFlameMat(), OUTLINE_MAT = makeOutlineMat();

// ---------------------------------------------------------------- assemblage d'un pod
const PANEL_TEX = [];
const MEAN = new Map();
function decalTexture(d) {
  const c = document.createElement('canvas'); const W = 512, H = Math.max(64, Math.round(512 * d.h / d.w)); c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (d.bg) { g.fillStyle = d.bg; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, 5); g.fillRect(0, H - 5, W, 5); }
  g.fillStyle = d.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = H * 0.78; g.font = `900 ${fs}px "Black Ops One", Impact, "Arial Black", sans-serif`;
  while (g.measureText(d.text).width > W * 0.9 && fs > 10) { fs -= 4; g.font = `900 ${fs}px "Black Ops One", Impact, "Arial Black", sans-serif`; }
  g.fillText(d.text, W / 2, H / 2 + fs * 0.04);
  const t = new T.CanvasTexture(c); t.anisotropy = 8; t.needsUpdate = true; return t;
}
// garde au sol : angle de roulis / tangage max avant que les ailes ou le nez ne rentrent dans le sol (le pod flotte à 0,9 m)
function computeClearance(geo, hover = 0.9) {
  const a = geo.attributes.position, n = a.count, X = [], Y = [], Z = [];
  for (let i = 0; i < n; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i); if (Math.abs(x) > 0.8 || Math.abs(z) > 3) { X.push(x); Y.push(y); Z.push(z); } }
  const m = X.length; let safe = 0.7, mx = 0.7, pmax = 0.5;
  const rollClear = th => { const c = Math.cos(th), sn = Math.sin(th); let lo = 1e9; for (let i = 0; i < m; i++) { const v = Y[i] * c - Math.abs(X[i]) * sn; if (v < lo) lo = v; } return hover + lo; };
  const pitchClear = th => { const c = Math.cos(th), sn = Math.sin(th); let lo = 1e9; for (let i = 0; i < m; i++) { const v = Y[i] * c - Math.abs(Z[i]) * sn; if (v < lo) lo = v; } return hover + lo; };
  let f1 = false, f2 = false; for (let th = 0; th < 0.8; th += 0.01) { const cl = rollClear(th); if (!f1 && cl < 0.3) { safe = th; f1 = true; } if (!f2 && cl < 0.02) { mx = th; f2 = true; break; } }
  for (let th = 0; th < 0.6; th += 0.01) { if (pitchClear(th) < 0.05) { pmax = th; break; } }
  const tip = sg => { const th = mx + 0.02, c = Math.cos(th), sn = Math.sin(th); let best = [0, 0, 0], lo = 1e9; for (let i = 0; i < m; i++) { const v = Y[i] * c + sg * X[i] * sn; if (v < lo) { lo = v; best = [X[i], Y[i], Z[i]]; } } return best; };
  return { safe: Math.max(0.08, safe), max: Math.max(0.12, mx), pmax: Math.max(0.1, pmax), tipP: tip(1), tipN: tip(-1) };
}
function buildPod(def) {
  const k = new Kit(def.seed); def.build(k);
  if (!PANEL_TEX[def.seed]) PANEL_TEX[def.seed] = genPanelTexture(def.seed);
  const mat = makePodMat(PANEL_TEX[def.seed], { tile: def.tile, seam: 0x180b05, wear: 0.75 });
  const gB = k.B.geometry();
  const root = new T.Object3D(), vis = new T.Object3D(); root.add(vis);
  const body = new T.Mesh(gB, mat); body.castShadow = true; body.receiveShadow = true; vis.add(body);
  const outline = new T.Mesh(gB, OUTLINE_MAT); outline.frustumCulled = false; vis.add(outline);
  let emis = null;
  if (!k.E.empty) { const gE = k.E.geometry(); emis = new T.Mesh(gE, new T.MeshBasicMaterial({ vertexColors: true, fog: false })); vis.add(emis); }
  const decals = [];
  for (const d of k.decals) {
    const tex = decalTexture(d);
    const m = new T.Mesh(new T.PlaneGeometry(d.w, d.h), toonBase({ map: tex, transparent: true, alphaTest: 0.04, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.position.set(d.x, d.y, d.z); m.rotation.set(d.rx || 0, d.ry || 0, 0, 'YXZ'); m.receiveShadow = true; vis.add(m); decals.push(m);
  }
  // flammes
  const flames = [], glows = [];
  for (const ex of k.exh) {
    const f = new T.Mesh(FLAME_GEO, FLAME_MAT.clone()); f.position.copy(ex.p); f.frustumCulled = false; f.renderOrder = 5; f.material.uniforms.uPh.value = Math.random() * 100; f.material.uniforms.uLen.value = ex.r * 3.4; f.material.uniforms.uWid.value = ex.r * 0.7; vis.add(f);
    const g = new T.Mesh(GLOW_GEO, makeGlowMat()); g.position.copy(ex.p); g.frustumCulled = false; g.renderOrder = 6; g.material.uniforms.uSize.value = ex.r * 2.0; g.material.uniforms.uPower.value = 0.7; vis.add(g);
    flames.push(f); glows.push(g);
  }
  // halo de sustentation au sol (additif)
  const hover = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, uniforms: { uP: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float uP; varying vec2 vUv; void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float a = (1.0 - smoothstep(0.0,1.0,r)); a = a*a; gl_FragColor = vec4(vec3(1.0,0.62,0.18)*a*0.6*uP, 1.0); }',
  }));
  hover.rotation.x = -Math.PI / 2; hover.scale.set(9, 12, 1); hover.position.y = 0.06; hover.renderOrder = 2; root.add(hover);
  const box = gB.boundingBox;
  return { def, root, vis, body, outline, emis, decals, flames, glows, exhausts: k.exh, stacks: k.stacks, hover, bbox: box, clear: computeClearance(body.geometry) };
}

// ---------------------------------------------------------------- éclairage : soleil bas + hémisphère chaude
const LIGHTS = (() => {
  const sun = new T.DirectionalLight(new T.Color(1.0, 0.86, 0.60), Math.PI * 0.80);
  sun.castShadow = true;
  const S = 64; sun.shadow.mapSize.set(QCFG.shadow, QCFG.shadow);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 700 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06; sun.shadow.radius = 1.2;
  const hemi = new T.HemisphereLight(new T.Color(0.34, 0.12, 0.07), new T.Color(0.95, 0.52, 0.12), Math.PI * 0.40);
  const fill = new T.DirectionalLight(new T.Color(1.0, 0.55, 0.28), Math.PI * 0.16);
  return { sun, hemi, fill, S };
})();
const _lx = new T.Vector3(), _ly = new T.Vector3(), _lz = new T.Vector3(), _up = new T.Vector3(0, 1, 0);
function updateSunShadow(target) {   // suit la cible, calé sur la grille de texels (pas de scintillement)
  const sun = LIGHTS.sun; _lz.copy(PAL.sunDir); _lx.crossVectors(_up, _lz).normalize(); _ly.crossVectors(_lz, _lx);
  const texel = (2 * LIGHTS.S) / QCFG.shadow;
  const a = Math.round(target.dot(_lx) / texel) * texel, b = Math.round(target.dot(_ly) / texel) * texel, c = target.dot(_lz);
  const t = new T.Vector3().addScaledVector(_lx, a).addScaledVector(_ly, b).addScaledVector(_lz, c);
  sun.target.position.copy(t); sun.position.copy(t).addScaledVector(PAL.sunDir, 320);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
}

// ================================================================ CIRCUIT : tracé, ruban, décor
const TRACK_HALF = 30, WALL_D = 78;
const TRACK = (() => {
  const pts = [], NP = 16;
  for (let i = 0; i < NP; i++) {
    const a = i / NP * Math.PI * 2, r = 1450 * (1 + 0.17 * Math.sin(2 * a + 0.7) + 0.09 * Math.sin(3 * a + 2.1) + 0.035 * Math.sin(5 * a + 1.0));
    pts.push(new T.Vector3(Math.cos(a) * r * 1.4, 0, Math.sin(a) * r));
  }
  const curve = new T.CatmullRomCurve3(pts, true, 'centripetal'), LEN = curve.getLength(), N = Math.round(LEN / 6);
  const sp = curve.getSpacedPoints(N); sp.pop();
  const P = sp, TG = [], LF = [], CV = [];
  for (let i = 0; i < N; i++) {
    const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
    const t = new T.Vector3().subVectors(b, a).normalize(); TG.push(t);
    LF.push(new T.Vector3(t.z, 0, -t.x));            // gauche = haut x avant
  }
  for (let i = 0; i < N; i++) { const a = TG[i], b = TG[(i + 1) % N]; CV.push((a.x * b.z - a.z * b.x) / (LEN / N)); } // + = tourne à gauche
  return { P, TG, LF, CV, N, LEN, ds: LEN / N };
})();
// ---------------------------------------------------------------- relief : bosses (sauts) + passages étroits
const WLIM = 68;
const HILLS = [[0.105, 8, 105], [0.195, 13, 135], [0.335, 7, 85], [0.56, 12, 130], [0.655, 6, 80], [0.835, 13, 150]];   // [fraction du tour, hauteur (m), largeur (m)]
const PINCHES = [{ f: 0.145, len: 170, half: 24, c: 0 }, { f: 0.385, len: 190, half: 21, c: 6 }, { f: 0.505, len: 150, half: 23, c: -6 }, { f: 0.745, len: 200, half: 21, c: 0 }, { f: 0.875, len: 180, half: 24, c: 5 }];
TRACK.H = new Float32Array(TRACK.N);
for (let i = 0; i < TRACK.N; i++) { const s = i * TRACK.ds; let h = 0; for (const [f, A, w] of HILLS) { let d = Math.abs(s - f * TRACK.LEN); d = Math.min(d, TRACK.LEN - d); h += A * Math.exp(-(d / w) * (d / w)); } TRACK.H[i] = h; }
function hAt(sDist) { const { N, ds, LEN } = TRACK, s = ((sDist % LEN) + LEN) % LEN, f = s / ds, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f); return TRACK.H[i] + (TRACK.H[j] - TRACK.H[i]) * u; }
const PINCH_RAMP = 70;
function pinchEnv(p, s) { const L = TRACK.LEN; let d = Math.abs(s - p.f * L); d = Math.min(d, L - d); const e = clamp((p.len / 2 + PINCH_RAMP - d) / PINCH_RAMP, 0, 1); return e * e * (3 - 2 * e); }
function pinchAt(sDist) {   // limites latérales praticables à l'abscisse s
  const L = TRACK.LEN, s = ((sDist % L) + L) % L; let best = null, be = 0;
  for (const p of PINCHES) { const e = pinchEnv(p, s); if (e > be) { be = e; best = p; } }
  if (!best) return { lo: -WLIM, hi: WLIM, env: 0 };
  const h = WLIM + (best.half - WLIM) * be, c = best.c * be; return { lo: c - h, hi: c + h, env: be };
}

// requête : position la plus proche sur l'axe. hint = indice précédent (recherche locale)
function trackQuery(x, z, hint, out) {
  const { P, N } = TRACK; let bi = -1, bd = 1e18;
  const test = (i) => { const p = P[i], dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; bi = i; } };
  if (hint == null || hint < 0) for (let i = 0; i < N; i++) test(i);
  else { for (let k = -14; k <= 14; k++) test(((hint + k) % N + N) % N); if (bd > 2500 * 2500 * 0 + 90000) { bd = 1e18; for (let i = 0; i < N; i++) test(i); } }
  const p = P[bi], t = TRACK.TG[bi], l = TRACK.LF[bi];
  const dx = x - p.x, dz = z - p.z; const along = dx * t.x + dz * t.z, lat = dx * l.x + dz * l.z;
  out = out || {}; out.i = bi; out.s = bi * TRACK.ds + along; out.d = lat; out.tx = t.x; out.tz = t.z; out.lx = l.x; out.lz = l.z; out.cx = p.x; out.cz = p.z; return out;
}
function trackAt(sDist) {   // point de l'axe à l'abscisse s (m)
  const { N, ds, LEN } = TRACK; let s = ((sDist % LEN) + LEN) % LEN; const f = s / ds, i = Math.floor(f) % N, j = (i + 1) % N, u = f - Math.floor(f);
  const a = TRACK.P[i], b = TRACK.P[j], ta = TRACK.TG[i], tb = TRACK.TG[j];
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, tx: ta.x + (tb.x - ta.x) * u, tz: ta.z + (tb.z - ta.z) * u, i };
}
function curvatureAhead(i, dist) { // courbure max sur les prochains 'dist' mètres
  const n = Math.ceil(dist / TRACK.ds); let m = 0; for (let k = 0; k < n; k += 2) m = Math.max(m, Math.abs(TRACK.CV[(i + k) % TRACK.N])); return m;
}

// ---------------------------------------------------------------- ruban de piste
function buildTrackMesh() {
  const { P, LF, N, ds } = TRACK, W = TRACK_HALF + 4, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const k = i % N, p = P[k], l = LF[k];
    const hh = TRACK.H[k] + 0.04; pos.push(p.x + l.x * W, hh, p.z + l.z * W, p.x - l.x * W, hh, p.z - l.z * W); uv.push(W, i * ds, -W, i * ds);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const nA = g.attributes.normal; for (let i = 0; i < nA.count; i++) nA.setXYZ(i, 0, 1, 0);
  const m = new T.Mesh(g, makeTrackMat(TRACK_HALF)); m.receiveShadow = true; m.frustumCulled = false; return m;
}

// ---------------------------------------------------------------- terrain : plateforme + talus qui suivent le relief
function buildTerrain() {
  const { P, LF, N, H } = TRACK, lats = [-170, -125, -92, -68, -36, 0, 36, 68, 92, 125, 170], W = lats.length, pos = [], idx = [];
  const prof = l => { const t = clamp((Math.abs(l) - 68) / 100, 0, 1); return 1 - t * t * (3 - 2 * t); };
  for (let i = 0; i <= N; i++) { const k = i % N, p = P[k], l = LF[k]; for (const lt of lats) pos.push(p.x + l.x * lt, 0.015 + H[k] * prof(lt), p.z + l.z * lt); }
  for (let i = 0; i < N; i++) for (let j = 0; j < W - 1; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new T.Mesh(g, makeGroundMat()); m.receiveShadow = true; m.frustumCulled = false; return m;
}

// ---------------------------------------------------------------- pylônes de bord (instanciés)
function buildPosts() {
  const { P, LF, N, ds } = TRACK, step = 4, list = [];
  for (let i = 0; i < N; i += step) for (const sd of [-1, 1]) { const p = P[i], l = LF[i]; list.push([p.x + l.x * sd * (TRACK_HALF + 1.6), p.z + l.z * sd * (TRACK_HALF + 1.6), Math.atan2(TRACK.TG[i].x, TRACK.TG[i].z), i, TRACK.H[i]]); }
  const gs = new T.BoxGeometry(1.1, 3.4, 1.1); gs.translate(0, 1.7, 0);
  const cols = []; { const c = new T.Color(); const a = gs.attributes.position; for (let i = 0; i < a.count; i++) { const y = a.getY(i); c.set(y < 0.9 ? 0x1b120c : 0xd9741a); cols.push(c.r, c.g, c.b); } }
  gs.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  const mat = patchToon(toonBase({ vertexColors: true }), { key: 'post', fColor: '' });
  const im = new T.InstancedMesh(gs, mat, list.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  const gl = new T.BoxGeometry(0.9, 0.5, 0.9); gl.translate(0, 3.55, 0);
  const il = new T.InstancedMesh(gl, new T.MeshBasicMaterial({ color: new T.Color(4.2, 2.6, 0.9), fog: false }), list.length); il.frustumCulled = false;
  const m4 = new T.Matrix4(), q = new T.Quaternion(), s1 = new T.Vector3(1, 1, 1), v = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  list.forEach((e, k) => { q.setFromAxisAngle(up, e[2]); m4.compose(v.set(e[0], e[4], e[1]), q, s1); im.setMatrixAt(k, m4); il.setMatrixAt(k, m4); });
  const g = new T.Group(); g.add(im, il); return g;
}

// ---------------------------------------------------------------- objets "kit" fixes (portiques)
function propFromKit(k, seed, tile) {
  if (!PANEL_TEX[seed]) PANEL_TEX[seed] = genPanelTexture(seed);
  const mat = makePodMat(PANEL_TEX[seed], { tile, seam: 0x180b05, wear: 0.6 });
  const gB = k.B.geometry(), root = new T.Object3D();
  const body = new T.Mesh(gB, mat); body.castShadow = true; body.receiveShadow = true; root.add(body);
  const ol = new T.Mesh(gB, OUTLINE_MAT); ol.frustumCulled = false; root.add(ol);
  if (!k.E.empty) root.add(new T.Mesh(k.E.geometry(), new T.MeshBasicMaterial({ vertexColors: true, fog: false })));
  for (const d of k.decals) {
    const m = new T.Mesh(new T.PlaneGeometry(d.w, d.h), toonBase({ map: decalTexture(d), transparent: true, alphaTest: 0.04, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.position.set(d.x, d.y, d.z); m.rotation.set(d.rx || 0, d.ry || 0, 0, 'YXZ'); root.add(m);
  }
  return root;
}
function buildGate(seed, start) {
  const k = new Kit(seed), X = TRACK_HALF + 8;
  for (const sx of [-1, 1]) {
    k.box(6, 34, 6, sx * X, 17, 0, 0xd68a1c, { f: 1 });
    k.box(6.6, 4, 6.6, sx * X, 2, 0, 0x1b120c, { f: 2 });
    k.box(7.2, 2, 7.2, sx * X, 34.5, 0, DARK2);
    k.box(1.2, 24, 0.5, sx * (X - 3.2), 18, 0, new T.Color(3.6, 2.6, 1.1), { e: true, ch: 0 });
    k.box(2.2, 6, 6.6, sx * (X - 2), 30, 0, 0x1b120c, { f: 1 });
  }
  k.box(2 * X + 6, 6, 6.4, 0, 37, 0, 0xd68a1c, { f: 1 });
  k.box(2 * X - 4, 1.4, 6.8, 0, 33.6, 0, DARK, { f: 2 });
  k.box(2 * X - 10, 1.0, 0.4, 0, 39.9, -3.4, new T.Color(4.0, 3.0, 1.4), { e: true, ch: 0 });
  k.box(2 * X - 10, 1.0, 0.4, 0, 39.9, 3.4, new T.Color(4.0, 3.0, 1.4), { e: true, ch: 0 });
  k.lightRow(9, -X + 8, X - 8, 32.6, -3.6, new T.Color(4.5, 3.4, 1.6), 0.5);
  k.lightRow(9, -X + 8, X - 8, 32.6, 3.6, new T.Color(4.5, 3.4, 1.6), 0.5);
  if (start) { k.decal('START', 0, 37, -3.35, 26, 4.2, Math.PI, '#1b120c', { bg: '#f7c341' }); k.decal('START', 0, 37, 3.35, 26, 4.2, 0, '#1b120c', { bg: '#f7c341' }); }
  else { k.decal('SCORCH', 0, 37, -3.35, 22, 3.6, Math.PI, '#f7c341', { bg: '#1b120c' }); k.decal('SCORCH', 0, 37, 3.35, 22, 3.6, 0, '#f7c341', { bg: '#1b120c' }); }
  return propFromKit(k, seed, 0.16);
}

// ---------------------------------------------------------------- mesas / roches
function makeMesaGeo(seed) {
  const rng = mulberry32(seed), P = new Parts(), tiers = 2 + ((rng() * 3) | 0); let y = 0, rb = 1;
  const hsh = (x, y2, z) => { const s = Math.sin(x * 12.9898 + y2 * 78.233 + z * 37.719 + seed) * 43758.5453; return s - Math.floor(s); };
  for (let t = 0; t < tiers; t++) {
    const h = (t === 0 ? 0.5 : 0.22) + rng() * 0.45, rt = rb * (t === 0 ? 0.62 + rng() * 0.2 : 0.7 + rng() * 0.25), seg = 8 + ((rng() * 4) | 0);
    let g = new T.CylinderGeometry(rt, rb, h, seg, 3, false); g.translate(0, y + h / 2, 0);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) { const x = a.getX(i), yy = a.getY(i), z = a.getZ(i), r = Math.hypot(x, z); if (r < 1e-4) continue; const k = 1 + (hsh(Math.round(x * 50), Math.round(yy * 50), Math.round(z * 50)) - 0.5) * 0.34 * (yy > y + 0.01 ? 1 : 0.6); a.setXYZ(i, x * k, yy + (hsh(Math.round(x * 20), 1, Math.round(z * 20)) - 0.5) * 0.06 * (yy > y + 0.01 ? 1 : 0), z * k); }
    g = g.toNonIndexed(); g.computeVertexNormals(); P.add(g, new T.Matrix4(), 0xffffff, 0);
    y += h; rb = rt * (1.02 + rng() * 0.12);
  }
  return P.geometry();
}
function buildScenery(scene) {
  const rockMat = makeRockMat(), rng = mulberry32(77), tmp = {};
  const geos = [1, 2, 3, 4, 5, 6].map(s => makeMesaGeo(s * 101 + 7)), lists = geos.map(() => []);
  const far = (x, z, min) => { trackQuery(x, z, -1, tmp); return Math.abs(tmp.d) > min; };
  let n = 0;
  while (n < 380) {   // proches : parois du canyon le long de la piste (jamais sur la piste)
    const i = (rng() * TRACK.N) | 0, p = TRACK.P[i], l = TRACK.LF[i], sd = rng() < 0.5 ? -1 : 1;
    const H = 30 + Math.pow(rng(), 1.5) * 190, R = 26 + rng() * 75, off = WALL_LIM + R * 1.1 + 50 + Math.pow(rng(), 1.6) * 520;
    const x = p.x + l.x * sd * off, z = p.z + l.z * sd * off; if (!far(x, z, WALL_LIM + R * 1.1 + 10)) continue;
    lists[(rng() * 6) | 0].push([x, z, R, H, rng() * 6.28]); n++;
  }
  for (let k = 0; k < 90; k++) {   // horizon : géants lointains
    const a = rng() * 6.283, r = 4200 + rng() * 2600, H = 200 + rng() * 420, R = 120 + rng() * 260;
    lists[(rng() * 6) | 0].push([Math.cos(a) * r * 1.2, Math.sin(a) * r, R, H, rng() * 6.28]);
  }
  for (const pc of PINCHES) {   // piliers de canyon qui pincent la piste
    for (let sm = pc.f * TRACK.LEN - pc.len / 2 - PINCH_RAMP; sm <= pc.f * TRACK.LEN + pc.len / 2 + PINCH_RAMP; sm += 30) {
      const e = pinchEnv(pc, sm), a = trackAt(sm), hEff = WLIM + (pc.half - WLIM) * e, cc = pc.c * e, hy = hAt(sm);
      for (const sd of [-1, 1]) { const R = 26 + rng() * 12, H = 45 + rng() * 55, lat = cc + sd * (hEff + R * 1.02); lists[(rng() * 6) | 0].push([a.x + a.tz * lat, a.z - a.tx * lat, R, H, rng() * 6.28, hy]); }
    }
  }
  const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), up = new T.Vector3(0, 1, 0), v = new T.Vector3(), out = new T.Group();
  lists.forEach((L, gi) => {
    const im = new T.InstancedMesh(geos[gi], rockMat, L.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    L.forEach((e, k) => { q.setFromAxisAngle(up, e[4]); m4.compose(v.set(e[0], -2 + (e[5] || 0), e[1]), q, sc.set(e[2], e[3], e[2] * (0.8 + (k % 3) * 0.2))); im.setMatrixAt(k, m4); });
    out.add(im);
  });
  return out;
}

// ---------------------------------------------------------------- plaques de boost
const PADS = [];
function buildPads() {
  const list = [[0.04, 6], [0.07, -9], [0.19, 9], [0.25, -7], [0.31, 0], [0.43, -10], [0.47, 8], [0.55, 10], [0.61, -6], [0.67, 0], [0.71, 7], [0.79, -9], [0.91, 9], [0.96, 0]];
  const mat = new T.ShaderMaterial({
    uniforms: SU, transparent: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){ vec2 p = vec2(vUv.x*2.0-1.0, vUv.y);
        float ch = abs(p.x)*0.6; float f = fract(p.y*6.0 + ch - uTime*2.2);
        float chev = smoothstep(0.0,0.05,f) * (1.0-smoothstep(0.4,0.48,f));
        vec3 base = vec3(0.05,0.018,0.008) + vec3(0.30,0.10,0.0)*(0.5+0.5*sin(p.y*50.0 - uTime*7.0))*0.10;
        vec3 hot = mix(vec3(1.0,0.42,0.05), vec3(1.0,0.95,0.7), chev*chev);
        float edge = smoothstep(0.80,0.9,abs(p.x)) * (0.65 + 0.35*sin(uTime*9.0 + p.y*20.0));
        vec3 c = base + hot*chev*3.8 + vec3(1.0,0.55,0.1)*edge*2.8;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const group = new T.Group(), beamG = new T.CylinderGeometry(0.4, 0.4, 34, 8, 1, true), beamM = new T.InstancedMesh(beamG, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide, vertexShader: 'varying float vY, vD; void main(){ vY = position.y/34.0 + 0.5; vec4 mv = viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0); vD = length(mv.xyz); gl_Position = projectionMatrix*mv; }', fragmentShader: 'varying float vY, vD; void main(){ float a = pow(max(1.0 - vY, 0.0), 1.6)*smoothstep(10.0, 60.0, vD); gl_FragColor = vec4(vec3(1.0,0.5,0.1)*a*1.3, 1.0); }' }), list.length * 2), bm = new T.Matrix4();
  beamM.frustumCulled = false; group.add(beamM); let bi = 0;
  for (const [f, d] of list) {
    const s0 = f * TRACK.LEN, len = 120, hw = 11, pos = [], uv = [], idx = [], seg = 10;
    for (let i = 0; i <= seg; i++) { const s = s0 - len / 2 + len * i / seg, a = trackAt(s), lx = a.tz, lz = -a.tx; for (const sd of [1, -1]) { pos.push(a.x + lx * (d + sd * hw), 0.07 + hAt(s), a.z + lz * (d + sd * hw)); uv.push(sd > 0 ? 1 : 0, i / seg); } if (i < seg) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new T.Mesh(g, mat); m.frustumCulled = false; group.add(m); PADS.push({ s: s0, d, hw, len });
    { const a0 = trackAt(s0 - len / 2), lx0 = a0.tz, lz0 = -a0.tx, hy = hAt(s0 - len / 2); for (const sd of [1, -1]) { bm.makeTranslation(a0.x + lx0 * (d + sd * hw), hy + 17, a0.z + lz0 * (d + sd * hw)); beamM.setMatrixAt(bi++, bm); } }
  }
  return group;
}


const LAPS = +(QS.get('laps') || 3), NR = 6, VBASE = 350, WALL_LIM = 68;
const TOUCH = COARSE || ('ontouchstart' in window);


function buildBarrier() {   // murs de sécurité rayés jaune/noir aux limites du circuit
  const { P, LF, N, ds } = TRACK, pos = [], uv = [], idx = []; let base = 0;
  for (const sd of [-1, 1]) {
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = P[k], l = LF[k], x = p.x + l.x * sd * WALL_LIM, z = p.z + l.z * sd * WALL_LIM;
      const hb = TRACK.H[k]; pos.push(x, hb, z, x, hb + 7.5, z); uv.push(i * ds, 0, i * ds, 7.5);
      if (i < N) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    base += (N + 1) * 2;
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new T.ShaderMaterial({
    uniforms: SU, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 uFogColor; uniform float uFogNear, uFogFar; varying vec2 vUv; varying vec3 vW;
      void main(){ float v = vUv.y; float st = step(0.5, fract((vUv.x*0.5 + v*0.5)/7.0));
        vec3 c = mix(vec3(0.97,0.72,0.10), vec3(0.09,0.04,0.02), st);
        c = mix(c, vec3(1.0,0.42,0.08), step(6.6, v)); c = mix(c, vec3(0.06,0.025,0.01), step(v, 0.7) + step(6.35, v)*step(v, 6.6));
        c *= 0.78 + 0.22 * smoothstep(0.0, 4.0, v);
        float d = length(vW - cameraPosition); c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, d)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; return mesh;
}

const racers = []; let player = null;
class Racer {
  constructor(pod, isPlayer) {
    this.pod = pod; this.def = pod.def; this.isPlayer = isPlayer; this.name = pod.def.name; this.Q = {}; this.acc = pod.exhausts.map(() => 0); this.dustAcc = 0;
    this.skill = 0.915 + Math.random() * 0.07; this.lane = 0; this.laneT = 0; this.cap = 1;
  }
  place(slot) {
    const row = slot >> 1, col = slot & 1, s = TRACK.LEN - 18 - row * 19 - (col ? 7 : 0), a = trackAt(s), lat = col ? -9 : 9;
    this.x = a.x + a.tz * lat; this.z = a.z - a.tx * lat; this.th = Math.atan2(a.tx, a.tz);
    this.vx = this.vz = 0; this.yawRate = 0; this.steer = 0; this.vf = 0; this.vl = 0; this.thrS = 0; this.boostT = 0; this.boostS = 0; this.boostE = 0.4; this.padCool = 0;
    this.lap = 0; this.hint = -1; trackQuery(this.x, this.z, -1, this.Q); this.hint = this.Q.i; this.s = this.prevS = ((this.Q.s % TRACK.LEN) + TRACK.LEN) % TRACK.LEN; this.prog = this.s;
    this.finished = false; this.ft = 0; this.lapStart = 0; this.best = Infinity; this.roll = 0; this.pitch = 0; this.stuck = 0; this.hitCool = 0; this.lane = 0; this.laneT = Math.random() * 2; this.lat = this.Q.d;
    this.y = hAt(this.s); this.vy = 0; this.vyG = 0; this.air = false; this.gh = this.y; this.seed = Math.random() * 10; this.ai = { thr: 0, brk: 0, steer: 0, boost: false };
  }
}
const YREF = 300, CSGN = +(QS.get('csgn') || 1);
const yawCap = (av, turn) => 1.75 * turn / (1 + Math.pow(av / YREF, 2) * 0.9) * Math.min(1, av / 14 + 0.15);
function cornerSpeed(cv, turn) {
  if (cv < 1e-4) return 900;
  for (let v = 520; v > 50; v -= 8) { const av = 0.80 * 1.75 * turn / (1 + Math.pow(v / YREF, 2) * 0.9); if (v * cv <= av) return v; }
  return 50;
}
function landed(r, v) {
  if (v < 9) return; fx.burst(r.x, r.gh + 0.6, r.z, Math.min(22, 8 + (v * 0.25 | 0)), r.vx * 0.3, r.vz * 0.3, 12 + v * 0.3);
  if (r.isPlayer) { G.shake = Math.max(G.shake, clamp(v / 45, 0.2, 0.8)); AUDIO.hit(clamp(v / 60, 0.15, 0.6)); }
}
function impact(r, p, x, z) {
  fx.burst(x, r.y + 0.6, z, Math.min(26, 6 + (p * 0.35) | 0), r.vx * 0.3, r.vz * 0.3, 14 + p * 0.4);
  if (r.isPlayer) { G.shake = Math.max(G.shake, clamp(p / 60, 0.25, 1.2)); post.compU.uHit.value = Math.max(post.compU.uHit.value, clamp(p / 90, 0.3, 1)); AUDIO.hit(clamp(p / 80, 0.2, 1)); }
}
function stepRacer(r, dt, I) {
  const st = r.def.stats, S = Math.sin(r.th), C = Math.cos(r.th), fxv = S, fzv = C, rxv = -C, rzv = S;
  let vf = r.vx * fxv + r.vz * fzv, vl = r.vx * rxv + r.vz * rzv;
  const wantBoost = I.boost && r.boostE > 0.02;
  if (wantBoost) r.boostE = Math.max(0, r.boostE - 0.30 * dt); else if (r.boostT <= 0) r.boostE = Math.min(1, r.boostE + 0.045 * dt);
  if (r.boostT > 0) r.boostT -= dt;
  const bst = (r.boostT > 0 || wantBoost) ? 1 : 0; if (bst && r.boostS < 0.3 && r.isPlayer && !r.wasB) { AUDIO.boost(); post.compU.uFlash.value = 0.5; } r.wasB = bst > 0; r.boostS = damp(r.boostS, bst, 6, dt);
  const off = Math.abs(r.lat) > TRACK_HALF, air = r.air;
  let cap = VBASE * st.vmax * (1 + 0.5 * r.boostS) * r.cap * (off ? 0.6 : 1);
  const acc = 125 * st.acc * (1 + 1.2 * r.boostS) * (air ? 0.3 : 1), thr = I.thr;
  if (thr > 0.01) { const gap = cap - vf; vf += clamp(gap, -70 * dt, acc * thr * dt * (0.35 + 0.65 * clamp(gap / (cap * 0.3), 0, 1))); }
  else if (I.brk <= 0.01) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (5 + Math.abs(vf) * 0.12) * dt);
  if (I.brk > 0.01) vf = vf > 0 ? Math.max(0, vf - 300 * I.brk * dt) : Math.max(-40, vf - 60 * I.brk * dt);
  if (off) vf -= vf * 0.55 * dt;
  vl *= Math.exp(-(off ? 1.8 : 10.0 + I.brk * 3.0) * (air ? 0.15 : 1) * dt);
  const av = Math.abs(vf), yawMax = yawCap(av, st.turn) * (air ? 0.4 : 1);
  r.steer = damp(r.steer, I.steer, r.isPlayer && !G.autoPlayer ? 9 : 16, dt); r.yawRate = damp(r.yawRate, r.steer * yawMax * (vf < -1 ? -1 : 1), 12, dt);
  r.vx = fxv * vf + rxv * vl; r.vz = fzv * vf + rzv * vl; r.th += r.yawRate * dt; r.x += r.vx * dt; r.z += r.vz * dt;
  r.thrS = damp(r.thrS, thr, 8, dt); r.hitCool -= dt; r.padCool -= dt;
  const Q = trackQuery(r.x, r.z, r.hint, r.Q); r.hint = Q.i; r.lat = Q.d;
  const B = pinchAt(Q.s); let sg = 0, over = 0, lim = 0; if (Q.d > B.hi) { sg = 1; over = Q.d - B.hi; lim = B.hi; } else if (Q.d < B.lo) { sg = -1; over = B.lo - Q.d; lim = B.lo; }
  if (sg) {   // mur / pilier : rebond + étincelles
    r.x -= Q.lx * sg * over; r.z -= Q.lz * sg * over;
    const vn = (r.vx * Q.lx + r.vz * Q.lz) * sg;
    if (vn > 0) { r.vx -= Q.lx * sg * vn * 1.5; r.vz -= Q.lz * sg * vn * 1.5; r.vx *= 0.9; r.vz *= 0.9; if (r.hitCool <= 0) { impact(r, vn * 1.8, r.x, r.z); r.hitCool = 0.25; } }
    r.lat = lim;
  }
  const L = TRACK.LEN, s = ((Q.s % L) + L) % L;
  if (r.prevS > L * 0.7 && s < L * 0.3) {
    r.lap++;
    if (r.lap >= 2 && r.lap <= LAPS + 1) { const lt = G.raceT - r.lapStart; if (lt < r.best) r.best = lt; if (r.isPlayer && r.lap <= LAPS) { UI.toast(r.lap === LAPS ? 'FINAL LAP' : 'LAP ' + r.lap); AUDIO.lap(); } }
    r.lapStart = G.raceT; if (r.lap === LAPS + 1 && !r.finished) { r.finished = true; r.ft = G.raceT; }
  } else if (r.prevS < L * 0.3 && s > L * 0.7) r.lap--;
  r.prevS = s; r.s = s; r.prog = r.lap * L + s;
  { const gH = hAt(s), GR = 68; r.gh = gH;
    if (r.air) { r.vy -= GR * dt; r.y += r.vy * dt; if (r.y <= gH) { const iv = -r.vy; r.y = gH; r.air = false; r.vy = 0; r.vyG = (hAt(s + Math.max(vf, 0) * dt) - gH) / dt; landed(r, iv); } }
    else { const need = (gH - r.y) / dt; if (need < r.vyG - GR * dt - 1.5) { r.air = true; r.vy = r.vyG - GR * dt; r.y += r.vy * dt; } else { r.y = gH; r.vyG = need; r.vy = need; } } }
  for (const p of PADS) {   // plaques de boost
    const dS = ((s - p.s + L * 1.5) % L) - L / 2;
    if (Math.abs(dS) < p.len / 2 && Math.abs(r.lat - p.d) < p.hw && r.padCool <= 0) { r.boostT = 1.5; r.boostE = Math.min(1, r.boostE + 0.28); r.padCool = 1.2; if (r.isPlayer) { UI.toast('BOOST!'); AUDIO.boost(); post.compU.uFlash.value = 0.6; G.shake = Math.max(G.shake, 0.5); } }
  }
  r.vf = vf; r.vl = vl;
}

function aiInput(r, dt) {
  const st = r.def.stats, vf = r.vf, q = r.Q, look = 25 + Math.max(0, vf) * 0.42, tp = trackAt(q.s + look);
  r.laneT -= dt; if (r.laneT < 0) { r.laneT = 2.5 + Math.random() * 4; r.lane = (Math.random() * 2 - 1) * (TRACK_HALF - 14); }
  const S = Math.sin(r.th), C = Math.cos(r.th); let avoid = 0;
  for (const o of racers) if (o !== r) { const dx = o.x - r.x, dz = o.z - r.z, ah = dx * S + dz * C, sd = dx * C - dz * S; if (ah > 0 && ah < 48 && Math.abs(sd) < 10) avoid += (sd > 0 ? -1 : 1) * (1 - ah / 48) * 16; }
  const cvA = TRACK.CV[(q.i + ((look / TRACK.ds / 2) | 0)) % TRACK.N] || 0, pb = pinchAt(q.s + look), lane = clamp(r.lane + avoid, Math.max(-(TRACK_HALF - 4), pb.lo + 7), Math.min(TRACK_HALF - 4, pb.hi - 7)), tx = tp.x + tp.tz * lane, tz = tp.z - tp.tx * lane;
  const spd2 = Math.hypot(r.vx, r.vz), crs = spd2 > 25 ? r.th + wrapPI(Math.atan2(r.vx, r.vz) - r.th) * 0.7 : r.th, err = wrapPI(Math.atan2(tx - r.x, tz - r.z) - crs), I = r.ai;
  I.steer = clamp((1.05 * err - cvA * (Math.max(0, vf) - 0.525 * look)) / Math.max(0.15, yawCap(Math.abs(vf), st.turn)), -1, 1);
  let cv = curvatureAhead(q.i, 60 + Math.max(0, vf) * 1.7), target = Math.min(VBASE * st.vmax * r.skill * r.cap, cornerSpeed(cv, st.turn) * (0.93 + r.skill * 0.05));
  { const pm = pinchAt(q.s + 50 + Math.max(0, vf) * 1.0).env; if (pm > 0.05) target = Math.min(target, 300); }
  I.thr = vf < target ? 1 : vf < target * 1.03 ? 0.25 : 0; I.brk = vf > target * 1.08 ? clamp((vf - target * 1.08) / 25, 0, 1) : 0;
  I.boost = r.boostE > 0.5 && cv < 0.0012 && Math.abs(err) < 0.12 && vf > 200;
  if (G.phase === 'race' || G.phase === 'finish') { if (Math.abs(vf) < 8 && G.raceT > 4) r.stuck += dt; else r.stuck = 0; if (r.stuck > 2.5) { const a = trackAt(q.s + 20); r.x = a.x; r.z = a.z; r.th = Math.atan2(a.tx, a.tz); r.vx = r.vz = 0; r.stuck = 0; } }
  return I;
}
function collide() {
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i], b = racers[j], dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, R = 7.4;
    if (d2 < R * R && d2 > 1e-4) {
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = R - d; a.x -= nx * pen * 0.5; a.z -= nz * pen * 0.5; b.x += nx * pen * 0.5; b.z += nz * pen * 0.5;
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) { const j2 = -rel * 0.7; a.vx -= nx * j2; a.vz -= nz * j2; b.vx += nx * j2; b.vz += nz * j2; a.vx *= 0.985; a.vz *= 0.985; b.vx *= 0.985; b.vz *= 0.985;
        if (rel < -5) { const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; for (const r of [a, b]) if (r.hitCool <= 0) { r.hitCool = 0.3; if (r.isPlayer || Math.random() < 0.5) impact(r, -rel * 2, mx, mz); } } }
    }
  }
}


const K = {}, TB = { l: false, r: false, boost: false, brk: false };
const padIn = () => { const g = navigator.getGamepads ? navigator.getGamepads()[0] : null; return g || null; };
function playerInput() {
  const gp = padIn(); let steer = (K.ArrowLeft || K.KeyA || TB.l ? 1 : 0) - (K.ArrowRight || K.KeyD || TB.r ? 1 : 0);
  let thr = (K.ArrowUp || K.KeyW || (TOUCH && !TB.brk && !K.ArrowDown)) ? 1 : 0, brk = (K.ArrowDown || K.KeyS || TB.brk) ? 1 : 0, boost = !!(K.ShiftLeft || K.ShiftRight || K.Space || TB.boost);
  if (gp) { const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.12) steer = -ax; const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0; if (rt > 0.05) thr = rt; if (lt > 0.05) brk = lt; if (gp.buttons[0] && gp.buttons[0].pressed) boost = true; }
  return { thr, brk, steer: clamp(steer, -1, 1), boost };
}

function poseRacer(r, dt, camDist) {
  const p = r.pod, S = Math.sin(r.th), C = Math.cos(r.th), t = G.t;
  p.root.position.set(r.x, r.y, r.z); p.root.rotation.y = r.th;
  const tr = -r.steer * 0.32 * Math.min(1, Math.abs(r.vf) / 70) - clamp(r.vl * 0.005, -0.18, 0.18);
  r.roll = damp(r.roll, tr, 7, dt); const pt = clamp((r.thrS - 0.3) * 0.05 + r.boostS * 0.05 - (r.vf > 60 ? 0 : 0), -0.06, 0.12); const gv = r.air ? r.vy : r.vyG, sl = G.phase === 'menu' ? 0 : clamp(Math.atan2(gv, Math.max(70, r.vf)) * 0.95, -0.5, 0.5); r.pitch = damp(r.pitch, pt + sl, r.air ? 3 : 7, dt);
  const rc = p.clear, rz = clamp(r.roll, -rc.max, rc.max), pz = clamp(r.pitch, -rc.pmax, rc.pmax); p.vis.rotation.z = rz; p.vis.rotation.x = -pz; p.vis.position.y = 0.9 + Math.sin(t * 3.1 + r.seed) * 0.07 + Math.sin(t * 7.3 + r.seed * 2) * 0.03 * (r.vf / 200);
  const bs = r.boostS, th = r.thrS;
  p.flames.forEach(f => { const u = f.material.uniforms; u.uBoost.value = bs; u.uLen.value = f.userData.bl * (0.55 + 0.5 * th + 1.35 * bs); u.uPower.value = 0.7 + 0.4 * th + 0.5 * bs; });
  p.glows.forEach(g => { const u = g.material.uniforms; u.uSize.value = g.userData.bs * (0.85 + 0.35 * bs) * (1 + 0.07 * Math.sin(t * 43 + r.seed) * (0.4 + bs)); u.uPower.value = 0.2 + 0.12 * th + 0.14 * bs; });
  const hgt = Math.max(0, r.y - r.gh); p.hover.position.y = 0.05 - hgt; p.hover.material.uniforms.uP.value = (0.7 + 0.6 * bs) / (1 + hgt * 0.12);
  p.root.updateMatrixWorld(true);
  const sp = Math.hypot(r.vx, r.vz);
  if ((G.phase === 'race' || G.phase === 'finish' || G.phase === 'menu') && camDist < 700) {
    const aiMul = r.isPlayer ? 1 : 2.2, lifeK = clamp(QCFG.smoke / 1000, 0.5, 1.2), rate = G.phase === 'countdown' ? 0.35 : 1;
    if (sp > 10) p.exhausts.forEach((ex, k) => {
      const spd = sp * rate, spacing = Math.max(ex.r * 2.3, 2.0) * aiMul; r.acc[k] += spd * dt / spacing;
      while (r.acc[k] >= 1) { r.acc[k] -= 1; tmpV.copy(ex.p); tmpV.z -= p.flames[k].material.uniforms.uLen.value * (r.isPlayer ? 0.85 : 0.4); p.vis.localToWorld(tmpV); const j = () => (Math.random() - 0.5);
        fx.emit(tmpV.x - r.vx * dt * Math.random(), tmpV.y, tmpV.z - r.vz * dt * Math.random(), r.vx * 0.06 + j() * 5 - S * 6, 0.8 + Math.random() * 2.4, r.vz * 0.06 + j() * 5 - C * 6, ex.r * (2.0 + 0.6 * bs + Math.random() * 0.5) * (r.isPlayer ? 1 : 0.55), (1.55 + Math.random() * 0.5 + bs * 0.4) * lifeK * (r.isPlayer ? 1 : 0.45), 0, !r.isPlayer); }
    });
    if (bs > 0.35 && camDist < 260) p.exhausts.forEach((ex, k) => { if (Math.random() < 0.55 * bs) { tmpV.copy(ex.p); tmpV.z -= ex.r * 1.5; p.vis.localToWorld(tmpV); const j = () => Math.random() - 0.5;
      fx.emit(tmpV.x, tmpV.y, tmpV.z, r.vx * 0.6 - S * 70 + j() * 60, j() * 40 + 4, r.vz * 0.6 - C * 70 + j() * 60, 0.55, 0.3 + Math.random() * 0.3, 2); } });
    if (Math.abs(rz) > rc.safe * 0.97 && !r.air && sp > 40 && camDist < 320) {   // une aile frotte le sol : gerbe d'étincelles vers l'arrière
      const tip = rz > 0 ? rc.tipP : rc.tipN, n = 1 + ((Math.abs(rz) - rc.safe) / (rc.max - rc.safe + 1e-3) * 3 | 0); tmpV.set(tip[0], tip[1], tip[2]); p.vis.localToWorld(tmpV);
      for (let q = 0; q < n; q++) { const j = () => Math.random() - 0.5; fx.emit(tmpV.x, Math.max(r.gh + 0.15, tmpV.y), tmpV.z, r.vx * 0.3 + j() * 14, 2 + Math.random() * 8, r.vz * 0.3 + j() * 14, 0.5 + Math.random() * 0.3, 0.25 + Math.random() * 0.35, 2); }
    }
    if (sp > 30 && camDist < 300 && !r.air) { r.dustAcc += sp * dt / (Math.abs(r.lat) > TRACK_HALF ? 4 : 10); while (r.dustAcc >= 1) { r.dustAcc -= 1; const off = Math.abs(r.lat) > TRACK_HALF; fx.emit(r.x - S * 3 + (Math.random() - 0.5) * 6, r.gh + 0.6, r.z - C * 3 + (Math.random() - 0.5) * 6, r.vx * 0.05 + (Math.random() - 0.5) * 6, 1 + Math.random() * 3, r.vz * 0.05 + (Math.random() - 0.5) * 6, (off ? 3.2 : 2.0) * (r.isPlayer ? 1 : 0.6), (off ? 1.3 : 0.9) * (r.isPlayer ? 1 : 0.6), 1, !r.isPlayer); } }
  }
}


const tmpV = new T.Vector3();
export { T, PAL, SU, LIGHTS, OUTLINE_U, TRACK, TRACK_HALF, POD_DEFS, K, TB, Racer, racers, aiInput, collide, trackAt, pinchAt, hAt, trackQuery, yawCap, clamp, wrapPI, stepRacer, playerInput, poseRacer, buildPod, makeSky, makeGroundMat, buildTrackMesh, buildTerrain, buildPosts, buildScenery, buildPads, buildBarrier, updateSunShadow };
