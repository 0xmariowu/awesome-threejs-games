// Soft lamp halos for the crossing's flashing lights: camera-facing billboards (one merged mesh per
// flash phase) with a bright core, a wide soft halo, a short horizontal anime flare streak and an
// optional faint light cone along the lamp axis. Brightness falls off when the lamp is seen from the
// side/back and fades with the scene fog. Additive, no depth write, excluded from outlines.
import * as THREE from 'three';

const VERT = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  attribute vec3 aCenter; attribute vec3 aDir; attribute vec2 aCorner; attribute float aSize;
  varying vec2 vUv; varying float vFace;
  void main(){
    vec3 cW = (modelMatrix * vec4(aCenter, 1.0)).xyz;
    vec3 dW = normalize(mat3(modelMatrix) * aDir);
    vec3 toCam = normalize(cameraPosition - cW);
    float f = dot(toCam, dW);
    vFace = smoothstep(0.05, 0.75, f);
    vec4 mvPosition = viewMatrix * vec4(cW, 1.0);
    // pull toward the camera so the lens housing never clips the glow
    mvPosition.xyz += normalize(-mvPosition.xyz) * 0.16;
    float s = aSize * (0.55 + 0.45 * vFace);
    // keep a minimum on-screen size so distant lamps still read (anime "sparkle")
    float minPx = 7.0 / max(projectionMatrix[1][1], 1e-3) * (-mvPosition.z) / 360.0;
    s = max(s, minPx);
    mvPosition.xy += aCorner * s * vec2(1.35, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vUv = aCorner * vec2(1.35, 1.0);
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor; uniform float uOn; uniform float uStreak;
  varying vec2 vUv; varying float vFace;
  void main(){
    float r2 = dot(vUv, vUv);
    float core = exp(-r2 * 22.0);
    float halo = exp(-r2 * 4.5) * 0.42;
    float streak = exp(-abs(vUv.y) * 30.0) * exp(-abs(vUv.x) * 2.2) * 0.55 * uStreak;
    float a = (core * 1.2 + halo + streak) * vFace * uOn;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float ff = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      a *= 1.0 - ff * 0.85;
    #endif
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor * a, 1.0);
  }`;

/** items: [{ c: Vector3 (world centre), n: Vector3 (world facing dir), size }] */
export function makeHaloMesh(ctx, items, color, { intensity = 1.6, streak = 1.0 } = {}) {
  const n = items.length;
  const pos = new Float32Array(n * 4 * 3), cen = new Float32Array(n * 4 * 3), dir = new Float32Array(n * 4 * 3);
  const cor = new Float32Array(n * 4 * 2), siz = new Float32Array(n * 4);
  const idx = new Uint16Array(n * 6);
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  items.forEach((it, i) => {
    for (let j = 0; j < 4; j++) {
      const v = i * 4 + j;
      pos.set([it.c.x, it.c.y, it.c.z], v * 3); cen.set([it.c.x, it.c.y, it.c.z], v * 3);
      dir.set([it.n.x, it.n.y, it.n.z], v * 3); cor.set(C[j], v * 2); siz[v] = it.size ?? 0.5;
    }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCenter', new THREE.BufferAttribute(cen, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2));
  g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.boundingSphere.radius += 2.0;
  const col = new THREE.Color(color).multiplyScalar(intensity);
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: col }, uOn: { value: 0 }, uStreak: { value: streak } }]),
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true, fog: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 5;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.name = 'crossing-halo';
  ctx.noOutline(mesh);
  return mesh;
}

// Faint light cone (additive, view-angle faded), a cheap "glow cone" in front of each lamp.
const CONE_VERT = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  attribute float aAlong;
  varying float vAlong; varying vec3 vN; varying vec3 vW;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vAlong = aAlong;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const CONE_FRAG = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor; uniform float uOn;
  varying float vAlong; varying vec3 vN; varying vec3 vW;
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    float edge = abs(dot(normalize(vN), V));      // soft at the silhouette, strong face-on
    float a = (1.0 - vAlong) * (1.0 - vAlong) * edge * uOn * 0.13;
    a *= smoothstep(4.0, 14.0, length(cameraPosition - vW));   // only reads as a soft beam from a distance
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float ff = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      a *= 1.0 - ff;
    #endif
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor * a, 1.0);
  }`;

/** items: [{ c, n }] -> merged open cones (apex at the lens, opening along n). */
export function makeConeMesh(ctx, items, color, { length = 1.3, r0 = 0.13, r1 = 0.5, intensity = 1.2 } = {}) {
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const it of items) {
    const cg = new THREE.CylinderGeometry(r1, r0, length, 14, 1, true);
    // aAlong: 0 at the lens, 1 at the far end (cylinder +y = far end after translate)
    const p = cg.attributes.position; const al = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) al[i] = p.getY(i) / length + 0.5;
    cg.setAttribute('aAlong', new THREE.BufferAttribute(al, 1));
    cg.translate(0, length / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, it.n.clone().normalize());
    const mtx = new THREE.Matrix4().compose(it.c, q, new THREE.Vector3(1, 1, 1));
    cg.applyMatrix4(mtx);
    cg.deleteAttribute('uv');
    geos.push(cg);
  }
  const g = ctx.geo.mergeGeometries(geos, false);
  const col = new THREE.Color(color).multiplyScalar(intensity);
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: col }, uOn: { value: 0 } }]),
    vertexShader: CONE_VERT, fragmentShader: CONE_FRAG,
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 4; mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'crossing-cone';
  ctx.noOutline(mesh);
  return mesh;
}
