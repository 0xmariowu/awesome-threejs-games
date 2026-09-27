// horizon.js
function sailPatch(B, a, b, c, d, billow, color, n = 6) {
  const pos = [], idx = [];
  const p = new V3$2(), q = new V3$2();
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const u = i / n, v = j / n;
      p.copy(a).lerp(b, u);
      q.copy(d).lerp(c, u);
      p.lerp(q, v);
      p.x += billow * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i * (n + 1) + j;
    idx.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  B.add(g, { color });
}

function vesselGeometry(k) {
  const B = new Builder({});
  const S = k;
  const NU = 28, NV = 8, cols = 2 * NV + 1;
  const pos = [], col = [], idx = [];
  const p = new V3$2();
  for (let i = 0; i <= NU; i++) {
    const u = Math.sin(((i / NU) * 2 - 1) * Math.PI * 0.5);
    for (let j = 0; j < cols; j++) {
      const s = j / NV - 1;
      hullPoint(u, Math.abs(s), s < 0 ? -1 : 1, p);
      pos.push(p.x * S, p.y * S, p.z * S);
      col.push(...(Math.abs(s) > 0.86 ? [0.42, 0.40, 0.35] : [0.05, 0.045, 0.038]));
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hg.setIndex(idx);
  hg.computeVertexNormals();
  B.add(hg, {});
  const deckY = 0.55 * S;
  B.add(new THREE.BoxGeometry(2.4 * S, 0.1, 7.6 * S), { m: mat(0, deckY, 0), color: [0.16, 0.12, 0.08] });
  const wood = [0.12, 0.085, 0.05], sail = [0.66, 0.61, 0.5], sail2 = [0.6, 0.55, 0.45];
  const fm = 1.9 * S, mm = -1.1 * S, fH = 11.0, mH = 9.4;
  B.add(new THREE.CylinderGeometry(0.1, 0.16, fH, 10), { m: mat(0, deckY + fH / 2, fm), color: wood });
  B.add(new THREE.CylinderGeometry(0.09, 0.14, mH, 10), { m: mat(0, deckY + mH / 2, mm), color: wood });
  B.add(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 8), { m: mat(0, deckY + 0.9, 4.9 * S, Math.PI / 2 - 0.3, 0, 0), color: wood });
  sailPatch(B, new V3$2(0, deckY + 1.0, mm - 0.2), new V3$2(0.2, deckY + 1.3, mm - 6.2), new V3$2(0.3, deckY + mH - 0.2, mm - 4.8), new V3$2(0, deckY + mH - 1.2, mm - 0.2), 0.8, sail);
  sailPatch(B, new V3$2(0, deckY + 1.0, fm - 0.2), new V3$2(0.2, deckY + 1.3, mm + 0.5), new V3$2(0.3, deckY + fH - 0.4, mm + 1.4), new V3$2(0, deckY + fH - 1.4, fm - 0.2), 0.7, sail2);
  sailPatch(B, new V3$2(0, deckY + 1.1, 6.3 * S), new V3$2(0.15, deckY + 1.5, fm + 0.8), new V3$2(0.05, deckY + fH - 1.0, fm + 0.3), new V3$2(0, deckY + 1.6, 6.2 * S), 0.6, sail);
  return B.build();
}

const LAMP_VERT = `
uniform float uNight;
uniform float uTime;
uniform float uResY;
uniform vec3 uBoatLamp;
uniform vec3 uBeamDir;
attribute vec4 aLamp;
varying vec2 vQ;
varying float vKind;
varying float vI;
varying float vSeed;
void main() {
  float kind = aLamp.z;
  vec3 c = kind > 1.5 && kind < 2.5 ? uBoatLamp : position;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  float zv = max(-mv.z, 0.1);
  float pix = 2.0 * zv / (projectionMatrix[1][1] * uResY);
  float sd = aLamp.w;
  float flick = 0.9 + 0.1 * sin(uTime * (6.0 + sd * 5.0) + sd * 40.0) * sin(uTime * 2.3 + sd * 9.0);
  float on = kind < 2.5 ? smoothstep(0.15 + 0.5 * fract(sd * 7.13), 0.35 + 0.5 * fract(sd * 7.13), uNight) : uNight;
  float inten = on * flick;
  vec2 size = vec2(max(3.0 * pix, 1.0));
  vec2 off = vec2(0.0);
  if (kind > 0.5 && kind < 1.5) {
    size = vec2(max(1.6 * pix, 0.45), max(18.0 * pix, 5.0));
    off = vec2(0.0, -(1.2 + size.y));
    inten *= 0.8;
  } else if (kind > 1.5 && kind < 2.5) {
    size = vec2(max(3.0 * pix, 0.1));
  } else if (kind > 2.5) {
    vec3 toCam = normalize(vec3(cameraPosition.x - c.x, 0.0, cameraPosition.z - c.z));
    float al = abs(dot(normalize(uBeamDir), toCam));
    float flash = pow(al, 60.0);
    size = vec2(max(4.0 * pix, 2.5)) * (1.0 + 3.0 * flash);
    inten *= 0.8 + 2.5 * flash;
  }
  vQ = aLamp.xy;
  vKind = kind;
  vI = inten;
  vSeed = sd;
  gl_Position = inten > 0.002 ? projectionMatrix * (mv + vec4(aLamp.xy * size + off, 0.0, 0.0)) : vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const LAMP_FRAG = `
uniform float uTime;
varying vec2 vQ;
varying float vKind;
varying float vI;
varying float vSeed;
void main() {
  float r = length(vQ);
  float a;
  vec3 col = vec3(1.0, 0.6, 0.26);
  if (vKind > 0.5 && vKind < 1.5) {
    float across = 1.0 - smoothstep(0.15, 1.0, abs(vQ.x));
    float down = smoothstep(-1.0, 0.9, vQ.y);
    float rip = 0.55 + 0.45 * sin(vQ.y * 16.0 + uTime * 3.0 + vSeed * 20.0) * sin(vQ.y * 7.0 - uTime * 1.7);
    a = across * down * rip * 0.35;
  } else if (vKind > 1.5 && vKind < 2.5) {
    a = exp(-r * r * 10.0) * 0.9;
    col = vec3(1.0, 0.5, 0.16);
  } else {
    a = exp(-r * r * 7.0) * 1.2 + exp(-r * 3.5) * 0.25;
    a *= 1.0 - smoothstep(0.8, 1.0, r);
    if (vKind > 2.5) col = vec3(1.0, 0.86, 0.62);
  }
  gl_FragColor = vec4(col * a * vI * 3.5, 1.0);
}
`;
class Lamps {
  constructor(scene, lighthouse) {
    const cam = new V3$2(-6.5, 1.25, 8.0);
    const at = (azDeg, d) => { const a = (azDeg * Math.PI) / 180; return new V3$2(cam.x + Math.sin(a) * d, 1.2, cam.z - Math.cos(a) * d); };
    const fishers = [at(-38, 1100), at(-27, 650), at(-19, 420), at(-2, 300), at(12, 260), at(33, 380), at(52, 900)];
    const pos = [], lamp = [], idx = [];
    const quad = (p, kind, seed) => {
      const b = pos.length / 3;
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(p.x, p.y, p.z); lamp.push(x, y, kind, seed); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    fishers.forEach((p, i) => { const sd = (i + 1) * 0.137; quad(p, 0, sd); quad(p, 1, sd); });
    quad(new V3$2(), 2, 0.5);
    if (lighthouse) quad(lighthouse, 3, 0.9);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aLamp', new THREE.Float32BufferAttribute(lamp, 4));
    g.setIndex(idx);
    this.uniforms = {
      uNight: NIGHT_U.uSgNight, uTime: U.uTime, uResY: ROPE_U.uRbResY,
      uBoatLamp: { value: new V3$2() }, uBeamDir: { value: new V3$2(1, 0, 0) },
    };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: LAMP_VERT, fragmentShader: LAMP_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  update(night, boatLamp, beamDir) {
    this.mesh.visible = night > 0.002;
    this.uniforms.uBoatLamp.value.copy(boatLamp);
    if (beamDir) this.uniforms.uBeamDir.value.copy(beamDir);
  }
}

class Horizon {
  constructor(scene, lighthouse) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => landLook(shader, { den: 1 / 30000, max: 0.6, env: 0.6 });
    m.customProgramCacheKey = () => 'sg-vessel-3';
    const S0 = new V3$2(-6.5, 0, 8.0), az0 = (100 * Math.PI) / 180;
    this.ships = [
      { start: new V3$2(S0.x + Math.sin(az0) * 2000, 0, S0.z - Math.cos(az0) * 2000), dir: new V3$2(Math.cos(az0), 0, Math.sin(az0)), speed: 0.8, ph: 0.0, k: 1.6 },
    ].map((s) => {
      const mesh = new THREE.Mesh(vesselGeometry(s.k), m);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      scene.add(mesh);
      return Object.assign(s, { mesh, yaw: Math.atan2(s.dir.x, s.dir.z) });
    });
    this.lamps = new Lamps(scene, lighthouse);
  }
  update(t, night = 0, boatLamp = null, beamDir = null) {
    for (const s of this.ships) {
      const d = Math.min(t * s.speed, 1000);
      s.mesh.position.set(s.start.x + s.dir.x * d, 0.05 * Math.sin(t * 0.6 + s.ph), s.start.z + s.dir.z * d);
      s.mesh.rotation.set(0.012 * Math.sin(t * 0.7 + s.ph), s.yaw, 0.09 + 0.02 * Math.sin(t * 0.45 + s.ph), 'YXZ');
    }
    if (boatLamp) this.lamps.update(night, boatLamp, beamDir);
  }
}

