import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import {
  CanvasTexture, Color, DoubleSide, NoToneMapping, SRGBColorSpace, Sprite, SpriteNodeMaterial, TextureLoader,
  type PerspectiveCamera, type Texture, type WebGPURenderer,
} from 'three/webgpu'
import {
  TWO_PI, billboarding, Fn, mix, oneMinus, sin, spherizeUV, step, texture, time, uv, vec2, vec3, vec4,
} from 'three/tsl'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

// Port of three.js r186 examples/webgpu_tsl_vfx_flames.html (inspired by
// @cmzw_). The two noise textures are the example's own, added by Bruno Simon
// in three.js PR #28969 under the repo's MIT licence, pinned to r186 on jsDelivr.
const R186 = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples'
const CELLULAR_NOISE = `${R186}/textures/noises/voronoi/grayscale-256x256.png`
const PERLIN_NOISE = `${R186}/textures/noises/perlin/rgb-256x256.png`

// The example's 128x1 colour ramp for flame 1, drawn on a canvas.
const GRADIENT_COLORS = ['#090033', '#5f1f93', '#e02e96', '#ffbd80', '#fff0db']

function createGradientTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 1
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas context unavailable for the flame gradient')
  const fill = context.createLinearGradient(0, 0, canvas.width, 0)
  GRADIENT_COLORS.forEach((color, i) => fill.addColorStop(i / (GRADIENT_COLORS.length - 1), color))
  context.fillStyle = fill
  context.fillRect(0, 0, canvas.width, canvas.height)
  const gradient = new CanvasTexture(canvas)
  gradient.colorSpace = SRGBColorSpace
  return gradient
}

// Flame 1: spherized, stretched UVs wobbled by a sine wave, eaten by scrolling
// cellular noise, then coloured through the gradient ramp with a white core.
function createFlame1Material(cellularTexture: Texture, gradientTexture: Texture): SpriteNodeMaterial {
  const material = new SpriteNodeMaterial({ side: DoubleSide })
  material.colorNode = Fn(() => {
    // main UV
    const mainUv = uv().toVar()
    mainUv.assign(spherizeUV(mainUv, 10).mul(0.6).add(0.2)) // spherize
    mainUv.assign(mainUv.pow(vec2(1, 2))) // stretch
    // TSL chains extra operands: mul(2, 1) is x2 on both axes, not vec2(2, 1).
    mainUv.assign(mainUv.mul(2, 1).sub(vec2(0.5, 0))) // scale

    // gradients
    const gradient1 = sin(time.mul(10).sub(mainUv.y.mul(TWO_PI).mul(2))).toVar()
    const gradient2 = mainUv.y.smoothstep(0, 1).toVar()
    mainUv.x.addAssign(gradient1.mul(gradient2).mul(0.2))

    // cellular noise
    const cellularUv = mainUv.mul(0.5).add(vec2(0, time.negate().mul(0.5))).mod(1)
    const cellularNoise = texture(cellularTexture, cellularUv, 0).r.oneMinus().smoothstep(0, 0.5).oneMinus().toVar()
    cellularNoise.mulAssign(gradient2)

    // shape
    const shape = mainUv.sub(0.5).mul(vec2(3, 2)).length().oneMinus().toVar()
    shape.assign(shape.sub(cellularNoise))

    // gradient color
    const gradientColor = texture(gradientTexture, vec2(shape.remap(0, 1, 0, 1), 0))

    // output
    const color = mix(gradientColor, vec3(1), shape.step(0.8))
    const alpha = shape.smoothstep(0, 0.3)
    return vec4(color.rgb, alpha)
  })()
  // Billboarding: follow the camera rotation only horizontally.
  material.vertexNode = billboarding({ horizontalRotation: true })
  return material
}

// Flame 2: a thin white stylised flame, its UVs displaced by layered Perlin
// noise and cut by cellular noise into hard-edged tongues.
function createFlame2Material(cellularTexture: Texture, perlinTexture: Texture): SpriteNodeMaterial {
  const material = new SpriteNodeMaterial({ side: DoubleSide })
  material.colorNode = Fn(() => {
    // main UV
    const mainUv = uv().toVar()
    mainUv.assign(spherizeUV(mainUv, 10).mul(0.6).add(0.2)) // spherize
    mainUv.assign(mainUv.abs().pow(vec2(1, 3)).mul(mainUv.sign())) // stretch
    mainUv.assign(mainUv.mul(2, 1).sub(vec2(0.5, 0))) // scale

    // perlin noise
    const perlinUv = mainUv.add(vec2(0, time.negate().mul(1))).mod(1)
    const perlinNoise = texture(perlinTexture, perlinUv, 0).sub(0.5).mul(1)
    mainUv.x.addAssign(perlinNoise.x.mul(0.5))

    // gradients
    const gradient1 = sin(time.mul(10).sub(mainUv.y.mul(TWO_PI).mul(2)))
    const gradient2 = mainUv.y.smoothstep(0, 1)
    const gradient3 = oneMinus(mainUv.y).smoothstep(0, 0.3)
    mainUv.x.addAssign(gradient1.mul(gradient2).mul(0.2))

    // displaced perlin noise
    const displacementPerlinUv = mainUv.mul(0.5).add(vec2(0, time.negate().mul(0.25))).mod(1)
    const displacementPerlinNoise = texture(perlinTexture, displacementPerlinUv, 0).sub(0.5).mul(1)
    const displacedPerlinUv = mainUv.add(vec2(0, time.negate().mul(0.5))).add(displacementPerlinNoise).mod(1)
    const displacedPerlinNoise = texture(perlinTexture, displacedPerlinUv, 0).sub(0.5).mul(1)
    mainUv.x.addAssign(displacedPerlinNoise.mul(0.5))

    // cellular noise
    const cellularUv = mainUv.add(vec2(0, time.negate().mul(1.5))).mod(1)
    const cellularNoise = texture(cellularTexture, cellularUv, 0).r.oneMinus().smoothstep(0.25, 1)

    // shape
    const shape = step(mainUv.sub(0.5).mul(vec2(6, 1)).length(), 0.5).toVar()
    shape.assign(shape.mul(cellularNoise))
    shape.mulAssign(gradient3)
    shape.assign(step(0.01, shape))

    // output
    return vec4(vec3(1), shape)
  })()
  material.vertexNode = billboarding({ horizontalRotation: true })
  return material
}

function FlameVisibility({ flames }: { flames: { flame1: Sprite; flame2: Sprite } }) {
  const visibility = useControls('Flames', {
    gradient: { value: true, label: 'Gradient flame' },
    white: { value: true, label: 'White flame' },
  })
  useLayoutEffect(() => {
    flames.flame1.visible = visibility.gradient
    flames.flame2.visible = visibility.white
  }, [flames, visibility.gradient, visibility.white])
  return null
}

function FlamesContent() {
  const { gl, scene, camera } = useThree()
  const embedded = new URLSearchParams(location.search).get('embed') === '1'
  const published = useRef(false)
  const controls = useRef<OrbitControls | null>(null)

  const [cellularTexture, perlinTexture] = useLoader(TextureLoader, [CELLULAR_NOISE, PERLIN_NOISE])

  const flames = useMemo(() => {
    const gradientTexture = createGradientTexture()
    const flame1 = new Sprite(createFlame1Material(cellularTexture, gradientTexture))
    flame1.center.set(0.5, 0)
    flame1.scale.x = 0.5 // optional, as in the example
    flame1.position.x = -0.5
    const flame2 = new Sprite(createFlame2Material(cellularTexture, perlinTexture))
    flame2.center.set(0.5, 0)
    flame2.position.x = 0.5
    return { flame1, flame2, gradientTexture }
  }, [cellularTexture, perlinTexture])

  // Scene setup: camera, background, orbit controls and the two flame sprites.
  useLayoutEffect(() => {
    // R3F types gl as WebGLRenderer even when its async factory returns WebGPU.
    const renderer = gl as unknown as WebGPURenderer
    const perspective = camera as PerspectiveCamera
    const previous = {
      position: perspective.position.clone(),
      quaternion: perspective.quaternion.clone(),
      fov: perspective.fov,
      near: perspective.near,
      far: perspective.far,
      background: scene.background,
      toneMapping: renderer.toneMapping,
    }
    perspective.fov = 25
    perspective.near = 0.1
    perspective.far = 100
    perspective.position.set(1, 1, 3)
    perspective.updateProjectionMatrix()
    // The example renders without tone mapping; R3F defaults to ACES.
    renderer.toneMapping = NoToneMapping
    scene.background = new Color(0x201919)

    scene.add(flames.flame1)
    scene.add(flames.flame2)

    const orbit = new OrbitControls(perspective, gl.domElement)
    orbit.enableDamping = true
    orbit.minDistance = 0.1
    orbit.maxDistance = 50
    orbit.update()
    controls.current = orbit

    return () => {
      controls.current = null
      orbit.dispose()
      // Sprites share one geometry across all instances: dispose materials only.
      for (const flame of [flames.flame1, flames.flame2]) {
        flame.removeFromParent()
        flame.material.dispose()
      }
      flames.gradientTexture.dispose()
      scene.background = previous.background
      renderer.toneMapping = previous.toneMapping
      perspective.fov = previous.fov
      perspective.near = previous.near
      perspective.far = previous.far
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateProjectionMatrix()
      perspective.updateMatrixWorld()
    }
  }, [gl, scene, camera, flames])

  // Positive priority takes over R3F's render loop, as the example's animate().
  useFrame(() => {
    const orbit = controls.current
    if (!orbit) return

    orbit.update()
    ;(gl as unknown as WebGPURenderer).render(scene, camera)
    if (!published.current) {
      published.current = true
      setInfo('flames', true)
    }
  }, 1)

  return embedded ? <FlameVisibility flames={flames} /> : null
}

function FlamesUnsupported() {
  useEffect(() => {
    // SpriteNodeMaterial and TSL are node materials; classic WebGL cannot run them.
    // App's effect runs initLab() after child effects; publish on the next task.
    const timer = window.setTimeout(() => setInfo('flames', false), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}

export default function Flames() {
  const gl = useThree((state) => state.gl)
  return describeRenderer(gl).backend === 'webgl-classic' ? <FlamesUnsupported /> : <FlamesContent />
}
