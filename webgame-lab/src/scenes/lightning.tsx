/*
 * Lightning strike VFX, ported from SahilK-027/Lightning-VFX
 * https://github.com/SahilK-027/Lightning-VFX (src/main.js and src/shaders/*.glsl)
 *
 * MIT License
 *
 * Copyright (c) 2026 Sahil K
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Fog, GridHelper, Group,
  Mesh, PlaneGeometry, Points, ShaderMaterial, Vector3,
  type Camera, type IUniform, type Material, type Object3D, type PerspectiveCamera,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

// Upstream defaults (getDefaultParams), limited to the effects ported here.
// Debris shards and the grid rings are left out.
const P = {
  skyColor: '#0a0e1a',
  groundColor: '#1a1d24',
  fogNear: 55,
  fogFar: 160,
  groundSize: 400,

  cameraRadius: 28,
  cameraHeight: 11,
  cameraFov: 60,
  shakeXMult: 1.7,
  shakeYMult: 1.5,
  shakeDecay: 0.88,
  tooCloseRadius: 10,

  spawnRadialMin: 8,
  spawnRadialMax: 38,
  spawnHeightMin: 15,
  spawnHeightMax: 24,
  spawnTopXZJitter: 1.5,
  roughnessMin: 0.42,
  roughnessMax: 0.58,
  mainFractalDepth: 6,
  altFractalDepth: 4,
  altRoughnessMult: 0.85,
  branchCountMin: 1,
  branchCountMax: 3,
  branchFFMin: 0.12,
  branchFFMax: 0.67,
  branchLengthFactorMin: 0.22,
  branchLengthFactorMax: 0.54,
  branchDropFactorMin: 0.55,
  branchDropFactorMax: 0.9,
  branchEndYJitter: 3,
  branchMinYClampOffset: 0.5,
  branchXZScaleX: 0.65,
  branchXZScaleZ: 0.45,
  mainStrandThickMult: 1.5,
  mainStrandAlphaMult: 1.0,
  altStrandThickMult: 0.55,
  altStrandAlphaMult: 0.75,

  strikeDur: 0.15,
  fadeDur: 1.0,
  tailExtra: 0.15,
  impactExtra: 0.5,
  boltSpread: 0.01,
  layers: [
    { color: '#4764e1', thick: 0.34, alpha: 0.18 },
    { color: '#1072bd', thick: 0.13, alpha: 0.55 },
    { color: '#aceeff', thick: 0.038, alpha: 1.0 },
  ],

  crackReveal: 0.22,
  crackFade: 2.8,
  crackCoreColor: '#1086c1',
  crackMidColor: '#1088bc',
  crackEdgeColor: '#4791e1',
  crackCountMin: 4,
  crackCountMax: 7,
  crackBranchDepth: 2,
  crackBranchChance: 0.72,
  crackRoughness: 0.725,
  crackOriginYOffset: 0.025,
  crackAngleJitter: 0.8,
  crackLengthMin: 0.4,
  crackLengthMax: 3.9,
  crackBranchAngleOffsetMin: 0.55,
  crackBranchAngleOffsetMax: 1.45,
  crackBranchLengthScaleMin: 0.3,
  crackBranchLengthScaleMax: 0.7,
  crackBranchStepsMin: 5,
  crackBranchStepsMax: 9,
  crackThinHW: 0.025,
  crackThinAlpha: 0.55,
  crackThickHW: 0.08,
  crackThickAlpha: 1.0,
  crackThickFadeMult: 0.6,

  sparkCountMin: 30,
  sparkCountMax: 40,
  sparkSize: 2.5,
  sparkGravity: 9.5,
  sparkDepthScale: 160,
  sparkPosJitter: 0.3,
  sparkPosYOffset: 0.1,
  sparkVelocitySpdMin: 1,
  sparkVelocitySpdMax: 6,
  sparkVelocityUpMin: 1,
  sparkVelocityUpMax: 7,
  sparkLifeMin: 0.3,
  sparkLifeMax: 1.3,

  shockwaveDur: 0.55,
  shockwaveAlphaMult: 0.4,
  shockwaveColorA: '#ffb060',
  shockwaveColorB: '#66b3ff',

  // Upstream fades a CSS overlay; here a full-screen quad does the same job.
  overlayTint: '#6496ff',
  overlayMaxAlpha: 0.6,
  overlayDecay: 8,

  groundFlashDur: 0.45,
  groundFlashIntensity: 0.35,
  groundFlashRadialPow: 1.2,
  groundFlashFadePow: 1.5,
  groundFlashSize: 5,
  groundFlashColor: '#4db2ff',
}

// A strike is removed once its slowest part (bolt tail or crack fade) is done.
const STRIKE_LIFETIME = Math.max(
  P.strikeDur + P.fadeDur + P.tailExtra,
  P.strikeDur + P.crackReveal + P.crackFade + P.impactExtra,
)

// ── Shaders (src/shaders/*.glsl) ─────────────────────────────────────────────

const boltVS = /* glsl */ `
attribute float aRatio;
attribute vec3 aDirection;
attribute float aSide;
attribute float aStrikeOffset;
attribute float aThickness;
attribute float aAlpha;
attribute vec3 aColor;

uniform float uTime;
uniform float uStrikeDur;
uniform float uFadeDur;
uniform float uSpread;

varying float vRatio;
varying float vStrikeOffset;
varying float vAlpha;
varying vec3 vColor;

void main() {
  float fadeT = clamp((uTime - uStrikeDur) / uFadeDur, 0.0, 1.0);
  vec3 pos = position;
  pos.xz += pos.xz * pow(fadeT, 2.0) * uSpread;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vec3 toCamera = normalize(cameraPosition - worldPos.xyz);
  vec4 nextWorld = modelMatrix * vec4(position + aDirection, 1.0);
  vec3 tangent = normalize(cross(normalize(nextWorld.xyz - worldPos.xyz), toCamera));
  worldPos.xyz += tangent * aSide * aThickness;

  vRatio = aRatio;
  vStrikeOffset = aStrikeOffset;
  vAlpha = aAlpha;
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

// uIntensity is the lab's "Bolt intensity" control; the rest is upstream.
const boltFS = /* glsl */ `
uniform float uTime;
uniform float uStrikeDur;
uniform float uFadeDur;
uniform float uIntensity;

varying float vRatio;
varying float vStrikeOffset;
varying float vAlpha;
varying vec3 vColor;

void main() {
  float strikeT = clamp(uTime / uStrikeDur, 0.0, 1.0);
  float fadeT = clamp((uTime - uStrikeDur) / uFadeDur, 0.0, 1.0);

  float window = max(1.0 - vStrikeOffset, 0.001);
  float localT = clamp((strikeT - vStrikeOffset) / window, 0.0, 1.0);

  float reveal = step(vRatio, localT);
  float alpha = reveal * (1.0 - fadeT * fadeT) * vAlpha;

  gl_FragColor = vec4(vColor * uIntensity, alpha);
}
`

const crackVS = /* glsl */ `
attribute float aRatio;
attribute float aSide;
attribute float aAlpha;
attribute float aFadeMult;

varying float vRatio;
varying float vSide;
varying float vAlpha;
varying float vFadeMult;

void main() {
  vRatio = aRatio;
  vSide = aSide;
  vAlpha = aAlpha;
  vFadeMult = aFadeMult;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const crackFS = /* glsl */ `
uniform float uTime;
uniform float uDelay;
uniform float uRevealDur;
uniform float uFadeDur;
uniform vec3 uCoreColor;
uniform vec3 uMidColor;
uniform vec3 uEdgeColor;

varying float vRatio;
varying float vSide;
varying float vAlpha;
varying float vFadeMult;

void main() {
  float t = max(0.0, uTime - uDelay);
  float revealT = clamp(t / uRevealDur, 0.0, 1.0);
  float fadeT = clamp((t - uRevealDur) / (uFadeDur * vFadeMult), 0.0, 1.0);

  float reveal = step(vRatio, revealT);
  float edge = 1.0 - abs(vSide);
  float core = smoothstep(0.0, 0.25, edge);
  float glow = smoothstep(0.0, 0.85, edge);

  vec3 col = mix(uEdgeColor, mix(uMidColor, uCoreColor, core), glow);
  float fade = 1.0 - fadeT * fadeT;

  float alpha = reveal * glow * fade * vAlpha;
  gl_FragColor = vec4(col, alpha);
}
`

const planeVS = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const groundFlashFS = /* glsl */ `
uniform float uTime;
uniform float uDur;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uRadialPow;
uniform float uFadePow;

varying vec2 vUv;

void main() {
  float t = clamp(uTime / uDur, 0.0, 1.0);
  float radial = max(0.0, 1.0 - length(vUv - vec2(0.5)) * 2.0);
  float alpha =
    pow(radial, uRadialPow) * pow(1.0 - t, uFadePow) * uIntensity;
  gl_FragColor = vec4(uColor, alpha);
}
`

const shockwaveFS = /* glsl */ `
uniform float uTime;
uniform float uDelay;
uniform float uDur;
uniform float uAlphaMult;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec2 vUv;

void main() {
  float t = clamp((uTime - uDelay) / uDur, 0.0, 1.0);
  vec2 uvc = vUv - 0.5;
  float r = length(uvc) * 2.0;
  float ring = abs(r - t);
  float alpha =
    smoothstep(0.12, 0.0, ring) * (1.0 - t) * (1.0 - t) * uAlphaMult;

  vec3 col = mix(uColorA, uColorB, t);
  gl_FragColor = vec4(col, alpha);
}
`

const sparksVS = /* glsl */ `
attribute vec3 aVelocity;
attribute float aLifetime;
attribute float aSeed;

uniform float uTime;
uniform float uDelay;
uniform float uSize;
uniform float uGravity;
uniform float uDepthScale;

varying float vAge;
varying float vSeed;

void main() {
  float t = max(0.0, uTime - uDelay);
  vAge = clamp(t / aLifetime, 0.0, 1.5);
  vSeed = aSeed;

  vec3 p = position + aVelocity * t + vec3(0.0, -uGravity * t * t, 0.0);
  p.y = max(p.y, 0.0);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * max(0.0, 1.0 - vAge * 0.8) * (uDepthScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const sparksFS = /* glsl */ `
varying float vAge;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;

  float core = max(0.0, 1.0 - r * 5.0);
  float glow = max(0.0, 1.0 - r * 2.2);

  vec3 hot = vec3(1.00, 0.92, 0.55);
  vec3 mid = vec3(1.00, 0.42, 0.05);
  vec3 cool = vec3(0.70, 0.10, 0.00);

  vec3 col = mix(cool, mix(mid, hot, core), glow);
  float fade = max(0.0, 1.0 - vAge * vAge);
  gl_FragColor = vec4(col, (core * 1.0 + glow * 0.45) * fade);
}
`

// Full-screen quad standing in for upstream's #flash-overlay div. The colour
// include converts to the output colour space so the tint matches the CSS one.
const overlayVS = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const overlayFS = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;

void main() {
  gl_FragColor = vec4(uColor, uAlpha);
  #include <colorspace_fragment>
}
`

// ── Geometry builders (LightningEffect in src/main.js) ───────────────────────

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

function fractalPath(start: Vector3, end: Vector3, depth: number, roughness: number): Vector3[] {
  if (depth <= 0) return [start.clone(), end.clone()]
  const mid = start.clone().lerp(end, 0.45 + Math.random() * 0.1)
  const dist = start.distanceTo(end)
  mid.x += (Math.random() - 0.5) * dist * roughness
  mid.z += (Math.random() - 0.5) * dist * roughness
  const left = fractalPath(start, mid, depth - 1, roughness * 0.88)
  const right = fractalPath(mid, end, depth - 1, roughness * 0.88)
  return [...left.slice(0, -1), ...right]
}

// One camera-facing ribbon per strand; the vertex shader widens it along aSide.
function buildBoltGeo(points: Vector3[], strikeOffset: number, thickness: number, alpha: number, color: Color) {
  const segs = points.length - 1
  const vc = segs * 4
  const pos = new Float32Array(vc * 3)
  const ratios = new Float32Array(vc)
  const dirs = new Float32Array(vc * 3)
  const sides = new Float32Array(vc)
  const col = new Float32Array(vc * 3)
  const idx: number[] = []
  const dir = new Vector3()

  for (let i = 0; i < segs; i++) {
    const a = points[i]
    const b = points[i + 1]
    const rA = i / segs
    const rB = (i + 1) / segs
    dir.subVectors(b, a).normalize()
    const vi = i * 4
    const verts: [Vector3, number, number][] = [[a, rA, -0.5], [a, rA, 0.5], [b, rB, -0.5], [b, rB, 0.5]]
    verts.forEach(([p, r, s], j) => {
      const k = (vi + j) * 3
      pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z
      dirs[k] = dir.x; dirs[k + 1] = dir.y; dirs[k + 2] = dir.z
      col[k] = color.r; col[k + 1] = color.g; col[k + 2] = color.b
      ratios[vi + j] = r
      sides[vi + j] = s
    })
    idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('aRatio', new BufferAttribute(ratios, 1))
  g.setAttribute('aDirection', new BufferAttribute(dirs, 3))
  g.setAttribute('aSide', new BufferAttribute(sides, 1))
  g.setAttribute('aStrikeOffset', new BufferAttribute(new Float32Array(vc).fill(strikeOffset), 1))
  g.setAttribute('aThickness', new BufferAttribute(new Float32Array(vc).fill(thickness), 1))
  g.setAttribute('aAlpha', new BufferAttribute(new Float32Array(vc).fill(alpha), 1))
  g.setAttribute('aColor', new BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

// Flat ribbon on the ground; hw is the half width.
function buildCrackGeo(points: Vector3[], hw: number, passAlpha: number, fadeDurMult: number) {
  const segs = points.length - 1
  if (segs < 1) return null
  const vc = segs * 4
  const pos = new Float32Array(vc * 3)
  const ratios = new Float32Array(vc)
  const sides = new Float32Array(vc)
  const idx: number[] = []

  for (let i = 0; i < segs; i++) {
    const a = points[i]
    const b = points[i + 1]
    const rA = i / segs
    const rB = (i + 1) / segs
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.sqrt(dx * dx + dz * dz) || 1
    const px = (-dz / len) * hw
    const pz = (dx / len) * hw
    const vi = i * 4
    const verts: [Vector3, number, number, number, number][] = [
      [a, rA, -1, -px, -pz], [a, rA, 1, px, pz], [b, rB, -1, -px, -pz], [b, rB, 1, px, pz],
    ]
    verts.forEach(([pt, r, s, ox, oz], j) => {
      const k = (vi + j) * 3
      pos[k] = pt.x + ox; pos[k + 1] = pt.y; pos[k + 2] = pt.z + oz
      ratios[vi + j] = r
      sides[vi + j] = s
    })
    idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('aRatio', new BufferAttribute(ratios, 1))
  g.setAttribute('aSide', new BufferAttribute(sides, 1))
  g.setAttribute('aAlpha', new BufferAttribute(new Float32Array(vc).fill(passAlpha), 1))
  g.setAttribute('aFadeMult', new BufferAttribute(new Float32Array(vc).fill(fadeDurMult), 1))
  g.setIndex(idx)
  return g
}

function generateCrackBranches(
  origin: Vector3, angle: number, length: number, depth: number, roughness: number, all: Vector3[][],
) {
  const steps = randInt(P.crackBranchStepsMin, P.crackBranchStepsMax)
  const points = [origin.clone()]
  const cur = origin.clone()
  for (let i = 0; i < steps; i++) {
    angle += (Math.random() - 0.5) * roughness
    const step = (length / steps) * (0.6 + Math.random() * 0.8)
    cur.x += Math.cos(angle) * step
    cur.z += Math.sin(angle) * step
    points.push(cur.clone())
  }
  all.push(points)

  if (depth > 0 && Math.random() < P.crackBranchChance) {
    const fi = 1 + Math.floor(Math.random() * (points.length - 2))
    const sign = Math.random() > 0.5 ? 1 : -1
    generateCrackBranches(
      points[fi].clone(),
      angle + sign * rand(P.crackBranchAngleOffsetMin, P.crackBranchAngleOffsetMax),
      length * rand(P.crackBranchLengthScaleMin, P.crackBranchLengthScaleMax),
      depth - 1,
      roughness * 0.9,
      all,
    )
  }
}

const additive = { transparent: true, blending: AdditiveBlending, depthWrite: false }

interface ActiveStrike {
  start: number
  landed: boolean
  objects: Object3D[]
  // Each shader's uTime runs from the strike start, shifted by `offset` seconds.
  clocks: { uniform: IUniform<number>; offset: number }[]
}

// Spawns and ages strikes under one group; the ground is at y = 0.
class LightningEffect {
  readonly group = new Group()
  // Shared by every bolt material so the intensity control reaches live bolts.
  readonly intensity: IUniform<number> = { value: 1 }
  count = 0
  private active: ActiveStrike[] = []

  spawnAt(cx: number, cz: number, now: number) {
    const height = rand(P.spawnHeightMin, P.spawnHeightMax)
    const roughness = rand(P.roughnessMin, P.roughnessMax)
    const top = new Vector3(
      cx + (Math.random() - 0.5) * P.spawnTopXZJitter, height, cz + (Math.random() - 0.5) * P.spawnTopXZJitter,
    )
    const mainPoints = fractalPath(top, new Vector3(cx, 0, cz), P.mainFractalDepth, roughness)
    const strands = [{
      points: mainPoints, strikeOffset: 0, thickMult: P.mainStrandThickMult, alphaMult: P.mainStrandAlphaMult,
    }]
    const branches = randInt(P.branchCountMin, P.branchCountMax)
    for (let b = 0; b < branches; b++) {
      const ff = rand(P.branchFFMin, P.branchFFMax)
      const fp = mainPoints[Math.floor(ff * (mainPoints.length - 1))].clone()
      const ba = Math.random() * Math.PI * 2
      const bl = (1 - ff) * height * rand(P.branchLengthFactorMin, P.branchLengthFactorMax)
      const be = fp.clone()
      be.x += Math.cos(ba) * bl * P.branchXZScaleX
      be.y -= bl * rand(P.branchDropFactorMin, P.branchDropFactorMax)
      be.z += Math.sin(ba) * bl * P.branchXZScaleZ
      be.y = Math.max(be.y, P.branchMinYClampOffset + Math.random() * P.branchEndYJitter)
      strands.push({
        points: fractalPath(fp, be, P.altFractalDepth, roughness * P.altRoughnessMult),
        strikeOffset: ff, thickMult: P.altStrandThickMult, alphaMult: P.altStrandAlphaMult,
      })
    }

    const strike: ActiveStrike = { start: now, landed: false, objects: [], clocks: [] }
    const add = (object: Object3D, time: IUniform<number>, offset = 0) => {
      strike.objects.push(object)
      strike.clocks.push({ uniform: time, offset })
      this.group.add(object)
    }

    // Bolt: every strand × every glow layer merged into one draw call.
    const layerColors = P.layers.map((layer) => new Color(layer.color))
    const boltParts = strands.flatMap(({ points, strikeOffset, thickMult, alphaMult }) =>
      P.layers.map((layer, i) =>
        buildBoltGeo(points, strikeOffset, layer.thick * thickMult, layer.alpha * alphaMult, layerColors[i])))
    const boltGeo = mergeGeometries(boltParts)
    boltParts.forEach((g) => g.dispose())
    const boltMat = new ShaderMaterial({
      vertexShader: boltVS, fragmentShader: boltFS, ...additive, side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uStrikeDur: { value: P.strikeDur },
        uFadeDur: { value: P.fadeDur },
        uSpread: { value: P.boltSpread },
        uIntensity: this.intensity,
      },
    })
    const bolt = new Mesh(boltGeo, boltMat)
    bolt.renderOrder = 2
    add(bolt, boltMat.uniforms.uTime)

    // Ground flash starts when the bolt reaches the ground.
    const flashMat = new ShaderMaterial({
      vertexShader: planeVS, fragmentShader: groundFlashFS, ...additive,
      uniforms: {
        uTime: { value: -P.strikeDur },
        uDur: { value: P.groundFlashDur },
        uColor: { value: new Color(P.groundFlashColor) },
        uIntensity: { value: P.groundFlashIntensity },
        uRadialPow: { value: P.groundFlashRadialPow },
        uFadePow: { value: P.groundFlashFadePow },
      },
    })
    const flash = new Mesh(new PlaneGeometry(P.groundFlashSize, P.groundFlashSize), flashMat)
    flash.position.set(cx, 0.2, cz)
    flash.rotation.x = -Math.PI / 2
    flash.renderOrder = 2
    add(flash, flashMat.uniforms.uTime, -P.strikeDur)

    // Cracks: a wide faint pass and a narrow bright pass per branch.
    const crackParts: BufferGeometry[] = []
    const crackCount = randInt(P.crackCountMin, P.crackCountMax)
    for (let m = 0; m < crackCount; m++) {
      const angle = (m / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * P.crackAngleJitter
      const paths: Vector3[][] = []
      generateCrackBranches(
        new Vector3(cx, P.crackOriginYOffset, cz), angle, rand(P.crackLengthMin, P.crackLengthMax),
        P.crackBranchDepth, P.crackRoughness, paths,
      )
      for (const points of paths) {
        const thin = buildCrackGeo(points, P.crackThinHW, P.crackThinAlpha, 1.0)
        const thick = buildCrackGeo(points, P.crackThickHW, P.crackThickAlpha, P.crackThickFadeMult)
        if (thin) crackParts.push(thin)
        if (thick) crackParts.push(thick)
      }
    }
    if (crackParts.length > 0) {
      const crackGeo = mergeGeometries(crackParts)
      crackParts.forEach((g) => g.dispose())
      const crackMat = new ShaderMaterial({
        vertexShader: crackVS, fragmentShader: crackFS, ...additive, side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uDelay: { value: P.strikeDur },
          uRevealDur: { value: P.crackReveal },
          uFadeDur: { value: P.crackFade },
          uCoreColor: { value: new Color(P.crackCoreColor) },
          uMidColor: { value: new Color(P.crackMidColor) },
          uEdgeColor: { value: new Color(P.crackEdgeColor) },
        },
      })
      const cracks = new Mesh(crackGeo, crackMat)
      cracks.renderOrder = 1
      add(cracks, crackMat.uniforms.uTime)
    }

    // Sparks: ballistic points integrated in the vertex shader.
    const sparkCount = randInt(P.sparkCountMin, P.sparkCountMax)
    const sparkPos = new Float32Array(sparkCount * 3)
    const sparkVel = new Float32Array(sparkCount * 3)
    const sparkLife = new Float32Array(sparkCount)
    const sparkSeed = new Float32Array(sparkCount)
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = cx + (Math.random() - 0.5) * P.sparkPosJitter
      sparkPos[i * 3 + 1] = P.sparkPosYOffset
      sparkPos[i * 3 + 2] = cz + (Math.random() - 0.5) * P.sparkPosJitter
      const a = Math.random() * Math.PI * 2
      const speed = rand(P.sparkVelocitySpdMin, P.sparkVelocitySpdMax)
      sparkVel[i * 3] = Math.cos(a) * speed
      sparkVel[i * 3 + 1] = rand(P.sparkVelocityUpMin, P.sparkVelocityUpMax)
      sparkVel[i * 3 + 2] = Math.sin(a) * speed
      sparkLife[i] = rand(P.sparkLifeMin, P.sparkLifeMax)
      sparkSeed[i] = Math.random()
    }
    const sparkGeo = new BufferGeometry()
    sparkGeo.setAttribute('position', new BufferAttribute(sparkPos, 3))
    sparkGeo.setAttribute('aVelocity', new BufferAttribute(sparkVel, 3))
    sparkGeo.setAttribute('aLifetime', new BufferAttribute(sparkLife, 1))
    sparkGeo.setAttribute('aSeed', new BufferAttribute(sparkSeed, 1))
    const sparkMat = new ShaderMaterial({
      vertexShader: sparksVS, fragmentShader: sparksFS, ...additive,
      uniforms: {
        uTime: { value: 0 },
        uDelay: { value: P.strikeDur },
        uSize: { value: P.sparkSize },
        uGravity: { value: P.sparkGravity },
        uDepthScale: { value: P.sparkDepthScale },
      },
    })
    const sparks = new Points(sparkGeo, sparkMat)
    sparks.renderOrder = 3
    add(sparks, sparkMat.uniforms.uTime)

    // Shockwave: an expanding ring on the ground.
    const shockMat = new ShaderMaterial({
      vertexShader: planeVS, fragmentShader: shockwaveFS, ...additive,
      uniforms: {
        uTime: { value: 0 },
        uDelay: { value: P.strikeDur },
        uDur: { value: P.shockwaveDur },
        uAlphaMult: { value: P.shockwaveAlphaMult },
        uColorA: { value: new Color(P.shockwaveColorA) },
        uColorB: { value: new Color(P.shockwaveColorB) },
      },
    })
    const shockwave = new Mesh(new PlaneGeometry(10, 10), shockMat)
    shockwave.position.set(cx, 0.06, cz)
    shockwave.rotation.x = -Math.PI / 2
    shockwave.renderOrder = 1
    add(shockwave, shockMat.uniforms.uTime)

    this.active.push(strike)
    this.count++
  }

  // Advances every strike; returns how many reached the ground this frame.
  update(now: number): number {
    let landed = 0
    for (let i = this.active.length - 1; i >= 0; i--) {
      const strike = this.active[i]
      const elapsed = now - strike.start
      if (!strike.landed && elapsed >= P.strikeDur) {
        strike.landed = true
        landed++
      }
      for (const { uniform, offset } of strike.clocks) uniform.value = elapsed + offset
      if (elapsed > STRIKE_LIFETIME) {
        this.remove(strike)
        this.active.splice(i, 1)
      }
    }
    return landed
  }

  dispose() {
    for (const strike of this.active) this.remove(strike)
    this.active.length = 0
  }

  private remove(strike: ActiveStrike) {
    for (const object of strike.objects) {
      this.group.remove(object)
      const { geometry, material } = object as Mesh
      geometry.dispose()
      ;(material as Material).dispose()
    }
  }
}

// Fixed camera at upstream's orbit angle 0: (radius, height, 0) looking at the origin.
const CAMERA_BASE = new Vector3(P.cameraRadius, P.cameraHeight, 0)

function tooCloseToCamera(x: number, z: number) {
  return (x - CAMERA_BASE.x) ** 2 + (z - CAMERA_BASE.z) ** 2 < P.tooCloseRadius ** 2
}

const probe = new Vector3()

// Upstream picks any spot on a ring around the origin, so with a fixed camera
// some strikes land behind it. Here spots must also fall inside the view.
function randomSpot(camera: Camera): [number, number] {
  for (let tries = 0; tries < 40; tries++) {
    const a = Math.random() * Math.PI * 2
    const d = rand(P.spawnRadialMin, P.spawnRadialMax)
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (tooCloseToCamera(x, z)) continue
    probe.set(x, 0, z).applyMatrix4(camera.matrixWorldInverse)
    if (probe.z >= 0) continue
    probe.applyMatrix4(camera.projectionMatrix)
    if (Math.abs(probe.x) < 0.85 && Math.abs(probe.y) < 0.85) return [x, z]
  }
  return [0, 0]
}

function LightningContent() {
  const { scene, camera } = useThree()
  const { autoStrike, interval, intensity, shake } = useControls('Lightning', {
    autoStrike: { value: true, label: 'Auto strike' },
    interval: { value: 3, min: 0.5, max: 10, step: 0.1, label: 'Interval (s)' },
    intensity: { value: 1, min: 0, max: 3, step: 0.05, label: 'Bolt intensity' },
    shake: { value: 1.2, min: 0, max: 3, step: 0.01, label: 'Shake strength' },
  })
  const effect = useMemo(() => new LightningEffect(), [])
  const grid = useMemo(() => {
    const helper = new GridHelper(300, 60, '#2a3040', '#1c212c')
    helper.position.y = 0.01
    return helper
  }, [])
  const overlay = useMemo(() => {
    const mesh = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
      vertexShader: overlayVS, fragmentShader: overlayFS,
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uColor: { value: new Color(P.overlayTint) }, uAlpha: { value: 0 } },
    }))
    mesh.frustumCulled = false
    mesh.renderOrder = 10
    mesh.visible = false
    return mesh
  }, [])
  // Clicks are queued and spawned in useFrame so every strike uses the frame clock.
  const clicks = useRef<[number, number][]>([])
  const timing = useRef({ nextStrike: 0, flashAt: -99, auto: false })
  const shakeOffset = useRef({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const previousBackground = scene.background
    const previousFog = scene.fog
    const previousPosition = camera.position.clone()
    const previousQuaternion = camera.quaternion.clone()
    const perspective = (camera as PerspectiveCamera).isPerspectiveCamera ? camera as PerspectiveCamera : null
    const previousFov = perspective?.fov

    scene.background = new Color(P.skyColor)
    scene.fog = new Fog(P.skyColor, P.fogNear, P.fogFar)
    if (perspective) {
      perspective.fov = P.cameraFov
      perspective.updateProjectionMatrix()
    }
    camera.position.copy(CAMERA_BASE)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    return () => {
      scene.background = previousBackground
      scene.fog = previousFog
      if (perspective && previousFov !== undefined) {
        perspective.fov = previousFov
        perspective.updateProjectionMatrix()
      }
      camera.position.copy(previousPosition)
      camera.quaternion.copy(previousQuaternion)
      camera.updateMatrixWorld()
    }
  }, [scene, camera])

  useEffect(() => () => {
    effect.dispose()
    grid.dispose()
    overlay.geometry.dispose()
    overlay.material.dispose()
    setInfo('lightning', { ready: false, strikes: 0 })
  }, [effect, grid, overlay])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives. Ready means a strike
    // has spawned; the frame loop publishes it on each strike.
    const timer = window.setTimeout(() => setInfo('lightning', { ready: effect.count > 0, strikes: effect.count }), 0)
    return () => window.clearTimeout(timer)
  }, [effect])

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime
    const t = timing.current

    // Turning auto strike on strikes at once, as upstream's Start Loop does.
    if (autoStrike && !t.auto) t.nextStrike = now
    t.auto = autoStrike
    // Upstream waits a random 3–8 s; the lab uses a fixed, adjustable interval.
    const spots = clicks.current.splice(0)
    if (autoStrike && now >= t.nextStrike) {
      spots.push(randomSpot(camera))
      t.nextStrike = now + interval
    }
    for (const [x, z] of spots) {
      effect.spawnAt(x, z, now)
      t.flashAt = now
    }
    if (spots.length > 0) setInfo('lightning', { ready: effect.count > 0, strikes: effect.count })

    effect.intensity.value = intensity
    if (effect.update(now) > 0) {
      shakeOffset.current.x = (Math.random() - 0.5) * shake * P.shakeXMult
      shakeOffset.current.y = (Math.random() - 0.5) * shake * P.shakeYMult
    }

    // Upstream decays the shake by 0.88 per frame at 60 fps; scale by delta.
    const offset = shakeOffset.current
    camera.position.copy(CAMERA_BASE)
    if (Math.abs(offset.x) > 0.0001) {
      camera.position.x += offset.x
      camera.position.y += offset.y
      const decay = P.shakeDecay ** (delta * 60)
      offset.x *= decay
      offset.y *= decay
    }
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const alpha = Math.min(1, Math.exp(-(now - t.flashAt) * P.overlayDecay) * P.overlayMaxAlpha * intensity)
    overlay.material.uniforms.uAlpha.value = alpha
    overlay.visible = alpha > 0.002
  })

  const onGroundClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (!tooCloseToCamera(event.point.x, event.point.z)) clicks.current.push([event.point.x, event.point.z])
  }

  return (
    <>
      <ambientLight intensity={0.28} />
      <directionalLight position={[15, 30, 10]} intensity={0.22} />
      <hemisphereLight args={['#2a3246', '#0d0f14', 0.35]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onGroundClick}>
        <planeGeometry args={[P.groundSize, P.groundSize]} />
        <meshStandardMaterial color={P.groundColor} roughness={1} metalness={0} />
      </mesh>
      <primitive object={grid} />
      <primitive object={effect.group} />
      <primitive object={overlay} />
    </>
  )
}

// WebGPURenderer cannot run GLSL ShaderMaterial; show only a dim ground there.
function WebGpuPlaceholder() {
  useEffect(() => {
    const timer = window.setTimeout(() => setInfo('lightning', { ready: false, strikes: 0 }), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color={P.groundColor} />
    </mesh>
  )
}

export default function Lightning() {
  const gl = useThree((state) => state.gl)
  return describeRenderer(gl).backend === 'webgl-classic' ? <LightningContent /> : <WebGpuPlaceholder />
}
