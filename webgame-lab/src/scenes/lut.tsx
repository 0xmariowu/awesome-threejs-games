import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  ClampToEdgeWrapping, Data3DTexture, LinearFilter, RenderPipeline, UnsignedByteType,
  type UniformNode, type WebGPURenderer,
} from 'three/webgpu'
import { pass, renderOutput, texture3D, uniform } from 'three/tsl'
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
import { LookContent } from './look'

type Rgb = [number, number, number]
type Grade = (r: number, g: number, b: number) => Rgb

const LUT_SIZE = 32

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const mixN = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
// k = 0 is identity, k = 1 is a full smoothstep S-curve around mid grey.
const sCurve = (x: number, k: number) => mixN(x, smoothstep(0, 1, x), k)
const saturate = ([r, g, b]: Rgb, amount: number): Rgb => {
  const l = luma(r, g, b)
  return [mixN(l, r, amount), mixN(l, g, amount), mixN(l, b, amount)]
}
const overlay = (base: number, blend: number) => (
  blend < 0.5 ? 2 * base * blend : 1 - 2 * (1 - base) * (1 - blend)
)

// Grades act on display-referred values (after tone mapping and sRGB encode),
// matching where the r186 example samples its .CUBE LUTs.
const grades = {
  warm: (r, g, b) => {
    const highlights = smoothstep(0.35, 1, luma(r, g, b))
    return [r * 1.03 + 0.1 * highlights, g + 0.045 * highlights, b * 0.92 - 0.06 * highlights]
  },
  cool: (r, g, b) => {
    const shadows = 1 - smoothstep(0, 0.55, luma(r, g, b))
    return [r * 0.94 - 0.03 * shadows, g * 0.99 + 0.035 * shadows, b * 1.04 + 0.09 * shadows]
  },
  tealorange: (r, g, b) => {
    // Split tone: teal shadows, orange highlights, then a little punch.
    const t = smoothstep(0.15, 0.85, luma(r, g, b))
    const toned: Rgb = [r + mixN(-0.07, 0.09, t), g + mixN(0.03, 0.015, t), b + mixN(0.08, -0.09, t)]
    const [sr, sg, sb] = saturate(toned, 1.15)
    return [sCurve(clamp01(sr), 0.35), sCurve(clamp01(sg), 0.35), sCurve(clamp01(sb), 0.35)]
  },
  bleach: (r, g, b) => {
    // Bleach bypass keeps a silver layer: overlay luminance on a desaturated image.
    const l = luma(r, g, b)
    const [dr, dg, db] = saturate([r, g, b], 0.4)
    return [sCurve(overlay(dr, l), 0.2), sCurve(overlay(dg, l), 0.2), sCurve(overlay(db, l), 0.2)]
  },
  noir: (r, g, b) => {
    // Orange-filter mono darkens blue sky; two S-curves give hard contrast.
    const l = 0.35 * r + 0.5 * g + 0.15 * b
    const v = sCurve(sCurve(clamp01((l - 0.5) * 1.25 + 0.48), 1), 0.5)
    return [v, v, v]
  },
} satisfies Record<string, Grade>

type GradeId = keyof typeof grades
type LutId = GradeId | 'none'

const gradeIds = Object.keys(grades) as GradeId[]

const lutOptions: Record<string, LutId> = {
  无: 'none',
  暖调: 'warm',
  冷调: 'cool',
  青橙: 'tealorange',
  漂白: 'bleach',
  黑白: 'noir',
}

function isLutId(value: string | null): value is LutId {
  return value === 'none' || (value !== null && Object.hasOwn(grades, value))
}

// Same texture layout LUTCubeLoader builds: RGBA8, red fastest, blue slowest,
// linear filtering and clamped edges so Lut3DNode can sample between cells.
function createLut(grade: Grade): Data3DTexture {
  const data = new Uint8Array(LUT_SIZE ** 3 * 4)
  let i = 0
  for (let b = 0; b < LUT_SIZE; b++) {
    for (let g = 0; g < LUT_SIZE; g++) {
      for (let r = 0; r < LUT_SIZE; r++) {
        const out = grade(r / (LUT_SIZE - 1), g / (LUT_SIZE - 1), b / (LUT_SIZE - 1))
        data[i++] = Math.round(clamp01(out[0]) * 255)
        data[i++] = Math.round(clamp01(out[1]) * 255)
        data[i++] = Math.round(clamp01(out[2]) * 255)
        data[i++] = 255
      }
    }
  }
  const texture = new Data3DTexture(data, LUT_SIZE, LUT_SIZE, LUT_SIZE)
  texture.type = UnsignedByteType
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = texture.wrapT = texture.wrapR = ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function LutGrading() {
  const { gl, scene, camera } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const pipeline = useRef<{
    renderPipeline: RenderPipeline
    lutPass: ReturnType<typeof lut3D>
    intensity: UniformNode<'float', number>
    luts: Record<GradeId, Data3DTexture>
  } | null>(null)
  const [initial] = useState<LutId>(() => {
    const requested = new URLSearchParams(location.search).get('lut')
    return isLutId(requested) ? requested : 'tealorange'
  })
  const { lut, intensity } = useControls('Grading', {
    lut: { value: initial, options: lutOptions },
    intensity: { value: 1, min: 0, max: 1, step: 0.01 },
  })

  useLayoutEffect(() => {
    if (classic) return

    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    const luts = Object.fromEntries(gradeIds.map((id) => [id, createLut(grades[id])])) as Record<GradeId, Data3DTexture>
    const renderPipeline = new RenderPipeline(renderer)
    // As in the r186 example: skip the default output transform and grade the
    // tone-mapped, sRGB-encoded image that renderOutput() produces.
    renderPipeline.outputColorTransform = false
    const scenePass = pass(scene, camera)
    const intensityUniform = uniform(1)
    const lutPass = lut3D(renderOutput(scenePass), texture3D(luts.tealorange), LUT_SIZE, intensityUniform)
    renderPipeline.outputNode = lutPass
    pipeline.current = { renderPipeline, lutPass, intensity: intensityUniform, luts }

    return () => {
      pipeline.current = null
      renderPipeline.dispose()
      lutPass.dispose()
      scenePass.dispose()
      for (const texture of Object.values(luts)) texture.dispose()
    }
  }, [gl, scene, camera, classic])

  useLayoutEffect(() => {
    const resources = pipeline.current
    if (!resources) return
    // The example swaps LUTs and intensity as uniforms; no pipeline rebuild.
    // "none" keeps the graph and mixes the LUT out at zero intensity.
    if (lut !== 'none') resources.lutPass.lutNode.value = resources.luts[lut]
    resources.intensity.value = lut === 'none' ? 0 : intensity
  }, [gl, scene, camera, classic, lut, intensity])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives. Classic WebGL has no grading.
    const active: LutId = classic ? 'none' : lut
    const timer = window.setTimeout(() => setInfo('lut', { active, count: gradeIds.length }), 0)
    return () => window.clearTimeout(timer)
  }, [classic, lut])

  // Positive priority takes over R3F's render loop; classic WebGL keeps it.
  useFrame(() => pipeline.current?.renderPipeline.render(), classic ? 0 : 1)
  return null
}

export default function Lut() {
  return (
    <>
      <LookContent />
      <LutGrading />
    </>
  )
}
