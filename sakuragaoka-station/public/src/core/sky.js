// Painted spring sky dome (gradient, sun glow, wind-stretched thin clouds) + sun/ambient lights.
import * as THREE from 'three';
import { LAYER_NO_OUTLINE } from './materials.js';

export const FOG_COLOR = new THREE.Color('#cfdcec');

export function createSky(scene, sunDir, quality) {
  const uniforms = {
    uSun: { value: sunDir.clone() },
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color('#4f8fd6') },
    uMid: { value: new THREE.Color('#8fbde9') },
    uHorizon: { value: new THREE.Color('#dfe9f2') },
    uWarm: { value: new THREE.Color('#fbe3cf') },
    uFog: { value: FOG_COLOR.clone() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun, uZenith, uMid, uHorizon, uWarm, uFog; uniform float uTime; varying vec3 vDir;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ s += a*vn(p); p = m*p; a*=0.5; } return s; }
      vec3 toLin(vec3 c){ return c; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        // base gradient
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
        col = mix(col, uZenith, smoothstep(0.18, 0.95, h));
        float sd = max(dot(d, normalize(uSun)), 0.0);
        // warm haze toward the sun near the horizon
        col = mix(col, uWarm, pow(sd, 3.0) * (1.0 - smoothstep(0.0, 0.5, h)) * 0.55);
        col += vec3(1.0, 0.93, 0.82) * (pow(sd, 18.0) * 0.22 + pow(sd, 300.0) * 0.9);
        col += vec3(1.0) * smoothstep(0.9993, 0.9997, sd) * 2.2;
        // clouds on a virtual plane, stretched by the wind (x) -> thin streaky spring clouds
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12);
          // wind-aligned frame (clouds stretched along the wind, drifting slowly)
          vec2 w = normalize(vec2(0.93, 0.36));
          vec2 q = vec2(dot(uv, w), dot(uv, vec2(-w.y, w.x)));
          q.x += uTime * 0.004;
          // thin cirrus streaks: long along the wind, narrow across
          float streak = fbm(vec2(q.x * 0.55, q.y * 6.5) + 5.0);
          float detail = fbm(vec2(q.x * 1.8, q.y * 11.0) + 17.0);
          float cir = smoothstep(0.50, 0.70, streak * 0.8 + detail * 0.35);
          cir *= smoothstep(0.30, 0.58, fbm(q * 0.35 + 2.0));           // patchy coverage
          // a few soft cumulus puffs low on the horizon
          vec2 cq = vec2(q.x * 0.9, q.y * 2.2);
          float cu = fbm(cq * 0.9 + 31.0) * 0.7 + fbm(cq * 2.3 + 7.0) * 0.35;
          float cum = smoothstep(0.60, 0.66, cu) * (1.0 - smoothstep(0.06, 0.26, h));
          float cumCore = smoothstep(0.66, 0.76, cu);
          // two-step cel shading: lit white vs lavender underside
          float shade = smoothstep(0.0, 0.06, fbm(cq * 2.3 + 7.0 + normalize(uSun.xz) * 0.08) * 0.35 - fbm(cq * 2.3 + 7.0) * 0.35 + 0.02);
          vec3 cLit = mix(vec3(0.99, 0.985, 0.97), vec3(1.0, 0.93, 0.84), pow(sd, 5.0));
          vec3 cSh = vec3(0.83, 0.85, 0.94);
          float fadeH = smoothstep(0.01, 0.12, h);
          col = mix(col, mix(cLit, vec3(0.93,0.95,1.0), 0.25), cir * 0.8 * fadeH);
          col = mix(col, mix(cLit, cSh, shade * (1.0 - cumCore * 0.5)), cum * 0.9 * fadeH);
          col += vec3(1.0, 0.9, 0.76) * (cir * 0.35 + cum * 0.5) * pow(sd, 8.0) * 0.6 * fadeH;
        }
        // below the horizon fades into the fog colour (matches distant terrain)
        col = mix(col, uFog, 1.0 - smoothstep(-0.12, 0.02, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), mat);
  mesh.layers.set(LAYER_NO_OUTLINE);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.noBatch = true;
  mesh.name = 'sky';
  scene.add(mesh);

  // --- lights
  const hemi = new THREE.HemisphereLight('#a9b3ee', '#d9c6c8', 1.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0dc', 2.75);
  sun.castShadow = quality.shadows !== false;
  const ms = quality.shadowMap || 4096;
  sun.shadow.mapSize.set(ms, ms);
  const S = quality.shadowSize || 75;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 520 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 1.6;
  sun.shadow.camera.layers.enableAll();
  scene.add(sun); scene.add(sun.target);

  scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.0026);

  const _c = new THREE.Vector3(), _fwd = new THREE.Vector3();
  function update(t, camera) {
    uniforms.uTime.value = t;
    mesh.position.copy(camera.position);
    // shadow box follows the camera, pushed forward, snapped to texels to avoid shimmering
    camera.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
    _c.copy(camera.position).addScaledVector(_fwd, S * 0.45);
    const texel = (2 * S) / ms;
    // snap in light space
    const lx = new THREE.Vector3().crossVectors(sunDir, new THREE.Vector3(0, 1, 0)).normalize();
    const ly = new THREE.Vector3().crossVectors(lx, sunDir).normalize();
    const px = Math.round(_c.dot(lx) / texel) * texel, py = Math.round(_c.dot(ly) / texel) * texel, pz = _c.dot(sunDir);
    _c.copy(lx).multiplyScalar(px).addScaledVector(ly, py).addScaledVector(sunDir, pz);
    sun.target.position.copy(_c);
    sun.position.copy(_c).addScaledVector(sunDir, 260);
    sun.target.updateMatrixWorld();
  }
  return { mesh, sun, hemi, uniforms, update };
}
