import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { levaStore, useControls } from 'leva'
import {
  DoubleSide, HalfFloatType, Mesh, MeshBasicNodeMaterial, NearestFilter, OrthographicCamera,
  PlaneGeometry, RenderTarget, Vector2,
  type Node, type WebGPURenderer,
} from 'three/webgpu'
import {
  Fn, If, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, cross, fract, hash,
  instanceIndex, instancedArray, positionGeometry, positionWorld, texture, uint, uniform, uv,
  vec2, vec3, vec4,
} from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'
import { LookContent } from './look'

// Port of webgpu_compute_particles_rain, rescaled from the example's 100 m box to
// look's 40 m ground. Every drop is simulated; the slider only changes how many draw.
const MAX_DROPS = 50000
const AREA = 40
const TOP = 14
const DROP_WIDTH = 0.03
const DROP_LENGTH = 0.7
// The example's 2 m drop hits the floor when its centre is 0.9 m above it.
const DROP_PIVOT = -0.45 * DROP_LENGTH
const SURFACE_OFFSET = 0.02
// Splash geometry is the example's, scaled by this factor.
const SPLASH = 0.15

// Overcast values for look.tsx's "Light" folder, written once as look-presets does.
const OVERCAST_LIGHT = {
  sunElevation: 60, sunAzimuth: 315, sunIntensity: 0.35, sunColor: '#c9d3de',
  environmentIntensity: 0.3, backgroundIntensity: 0.3, backgroundBlurriness: 0.5, shadows: true,
}

function createRain() {
  // Top-down orthographic view of the whole rain box. Rendering the scene with
  // positionWorld as colour gives the height of the first surface under every xz.
  const collisionCamera = new OrthographicCamera(-AREA / 2, AREA / 2, AREA / 2, -AREA / 2, 0.1, TOP + 10)
  collisionCamera.position.y = TOP + 5
  collisionCamera.lookAt(0, 0, 0)

  const collisionTarget = new RenderTarget(1024, 1024)
  collisionTarget.texture.type = HalfFloatType
  collisionTarget.texture.magFilter = NearestFilter
  collisionTarget.texture.minFilter = NearestFilter
  collisionTarget.texture.generateMipmaps = false

  const collisionMaterial = new MeshBasicNodeMaterial()
  collisionMaterial.colorNode = positionWorld
  // Fog would blend the stored heights toward the fog colour.
  collisionMaterial.fog = false

  const positionBuffer = instancedArray(MAX_DROPS, 'vec3')
  // Per-drop fall-speed factor; the example keeps a vec3 velocity with only y set.
  const speedBuffer = instancedArray(MAX_DROPS, 'float')
  const ripplePositionBuffer = instancedArray(MAX_DROPS, 'vec3')
  const rippleTimeBuffer = instancedArray(MAX_DROPS, 'float')

  const fallSpeed = uniform(9)
  const wind = uniform(new Vector2())
  // The example moves drops a fixed step per frame; seconds keep speed independent of fps.
  const step = uniform(0)
  // hash() truncates its seed to uint, so the example's float `time` only changed
  // respawn spots once a second; a per-frame counter changes them every frame.
  const seed = uniform(0, 'uint')

  const randUint = () => uint(Math.random() * 0xFFFFFF)

  const computeInit = Fn(() => {
    const position = positionBuffer.element(instanceIndex)
    const speed = speedBuffer.element(instanceIndex)
    const ripplePosition = ripplePositionBuffer.element(instanceIndex)
    const rippleTime = rippleTimeBuffer.element(instanceIndex)

    const randX = hash(instanceIndex)
    const randY = hash(instanceIndex.add(randUint()))
    const randZ = hash(instanceIndex.add(randUint()))

    position.x.assign(randX.mul(AREA).sub(AREA / 2))
    position.y.assign(randY.mul(TOP))
    position.z.assign(randZ.mul(AREA).sub(AREA / 2))

    speed.assign(randX.mul(0.2).add(1))

    ripplePosition.x.assign(randZ.mul(AREA).sub(AREA / 2))
    ripplePosition.y.assign(-1)
    ripplePosition.z.assign(randY.mul(AREA).sub(AREA / 2))

    rippleTime.assign(1000)
  })().compute(MAX_DROPS)

  const computeUpdate = Fn(() => {
    const getCoord = (xz: Node<'vec2'>) => xz.add(AREA / 2).div(AREA)

    const position = positionBuffer.element(instanceIndex)
    const speed = speedBuffer.element(instanceIndex)
    const ripplePosition = ripplePositionBuffer.element(instanceIndex)
    const rippleTime = rippleTimeBuffer.element(instanceIndex)

    position.addAssign(vec3(wind.x, fallSpeed.mul(speed).negate(), wind.y).mul(step))
    // Wind carries drops out of the box; wrap them back in on the far side.
    position.xz.assign(fract(position.xz.add(AREA / 2).div(AREA)).mul(AREA).sub(AREA / 2))

    rippleTime.addAssign(step.mul(4))

    const collisionArea = texture(collisionTarget.texture, getCoord(position.xz))
    const floorPosition = collisionArea.y.add(SURFACE_OFFSET)

    If(position.y.add(DROP_PIVOT).lessThan(floorPosition), () => {
      position.y.assign(TOP)

      ripplePosition.xz.assign(position.xz)
      ripplePosition.y.assign(floorPosition)

      rippleTime.assign(1)

      // Next drops will not fall in the same place.
      position.x.assign(hash(instanceIndex.add(seed)).mul(AREA).sub(AREA / 2))
      position.z.assign(hash(instanceIndex.add(seed.add(randUint()))).mul(AREA).sub(AREA / 2))
    })

    // A splash whose surface has moved away is hidden, as in the example.
    const rippleOnSurface = texture(collisionTarget.texture, getCoord(ripplePosition.xz))
    If(ripplePosition.y.greaterThan(rippleOnSurface.y.add(SURFACE_OFFSET)), () => {
      rippleTime.assign(1000)
    })
  })().compute(MAX_DROPS)

  // Drops: the example's streak shader. Its billboarding() keeps streaks vertical;
  // this one turns each quad around the motion axis so wind tilts the streaks.
  const rainVertex = Fn(() => {
    const center = positionBuffer.toAttribute()
    const axis = vec3(wind.x.negate(), fallSpeed, wind.y.negate()).normalize()
    const side = cross(axis, cameraPosition.sub(center)).normalize()
    const world = center.add(side.mul(positionGeometry.x)).add(axis.mul(positionGeometry.y))
    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
  })

  const rainMaterial = new MeshBasicNodeMaterial()
  rainMaterial.colorNode = uv().distance(vec2(0.5, 0)).oneMinus().mul(3).exp().mul(0.1)
  rainMaterial.positionNode = positionGeometry.add(positionBuffer.toAttribute())
  rainMaterial.vertexNode = rainVertex()
  rainMaterial.opacity = 0.2
  rainMaterial.depthWrite = false
  rainMaterial.depthTest = true
  rainMaterial.transparent = true

  const rain = new Mesh(new PlaneGeometry(DROP_WIDTH, DROP_LENGTH), rainMaterial)
  // The instances live far from the plane's own bounds.
  rain.frustumCulled = false

  // Splashes: a ring on the surface plus two crossed upright planes.
  const rippleTime = rippleTimeBuffer.element(instanceIndex)
  const rippleEffect = Fn(() => {
    const center = uv().add(vec2(-0.5)).length().mul(7)
    const distance = rippleTime.sub(center)
    return distance.min(1).sub(distance.max(1).sub(1))
  })

  const rippleMaterial = new MeshBasicNodeMaterial()
  rippleMaterial.colorNode = rippleEffect()
  rippleMaterial.positionNode = positionGeometry.add(ripplePositionBuffer.toAttribute())
  rippleMaterial.opacityNode = rippleTime.mul(0.3).oneMinus().max(0).mul(0.5)
  rippleMaterial.side = DoubleSide
  rippleMaterial.forceSinglePass = true
  rippleMaterial.depthWrite = false
  rippleMaterial.depthTest = true
  rippleMaterial.transparent = true

  const surfaceRipple = new PlaneGeometry(2.5 * SPLASH, 2.5 * SPLASH)
  surfaceRipple.rotateX(-Math.PI / 2)
  const xRipple = new PlaneGeometry(SPLASH, 2 * SPLASH)
  xRipple.rotateY(-Math.PI / 2)
  const zRipple = new PlaneGeometry(SPLASH, 2 * SPLASH)
  const rippleGeometry = mergeGeometries([surfaceRipple, xRipple, zRipple])
  for (const geometry of [surfaceRipple, xRipple, zRipple]) geometry.dispose()

  const splashes = new Mesh(rippleGeometry, rippleMaterial)
  splashes.frustumCulled = false

  return {
    collisionCamera, collisionTarget, collisionMaterial, computeInit, computeUpdate,
    fallSpeed, wind, step, seed, rain, splashes,
    dispose() {
      collisionTarget.dispose()
      for (const material of [collisionMaterial, rainMaterial, rippleMaterial]) material.dispose()
      rain.geometry.dispose()
      rippleGeometry.dispose()
    },
  }
}

function RainContent() {
  const { gl, scene } = useThree()
  const classic = describeRenderer(gl).backend === 'webgl-classic'
  const initialised = useRef(false)

  const { enabled, drops, speed, wind, windDirection } = useControls('Rain', {
    enabled: { value: true, label: 'Rain' },
    drops: { value: 30000, min: 200, max: MAX_DROPS, step: 100, label: 'Drop count' },
    speed: { value: 9, min: 1, max: 20, step: 0.1, label: 'Fall speed (m/s)' },
    wind: { value: 2, min: 0, max: 10, step: 0.1, label: 'Wind (m/s)' },
    windDirection: { value: 30, min: 0, max: 360, step: 1, label: 'Wind direction (°)' },
  })

  // Compute and node materials need WebGPURenderer; classic WebGL shows only the set.
  const rain = useMemo(() => (classic ? null : createRain()), [classic])
  useEffect(() => () => rain?.dispose(), [rain])

  // LookContent is the earlier sibling, so its "Light" paths are registered by now.
  // Leva keeps plain values after unmount, so put the previous light back afterwards.
  useEffect(() => {
    const paths = Object.keys(OVERCAST_LIGHT).map((key) => `Light.${key}`)
    const saved = Object.fromEntries(paths.map((path) => [path, levaStore.get(path)]))
    levaStore.set(Object.fromEntries(
      Object.entries(OVERCAST_LIGHT).map(([key, value]) => [`Light.${key}`, value]),
    ), false)
    return () => {
      try { levaStore.set(saved, false) } catch { /* Light folder already unmounted */ }
    }
  }, [])

  useLayoutEffect(() => {
    if (!rain) return
    rain.rain.count = drops
    rain.splashes.count = drops
    rain.fallSpeed.value = speed
    const angle = windDirection * Math.PI / 180
    rain.wind.value.set(Math.cos(angle) * wind, Math.sin(angle) * wind)
  }, [rain, drops, speed, wind, windDirection])

  const running = rain !== null && enabled
  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives.
    const timer = window.setTimeout(
      () => setInfo('rain', { compute: running, drops: running ? drops : 0 }), 0)
    return () => window.clearTimeout(timer)
  }, [running, drops])

  useFrame((_state, delta) => {
    if (!rain) return
    const renderer = gl as unknown as WebGPURenderer
    if (!initialised.current) {
      renderer.compute(rain.computeInit)
      initialised.current = true
    }
    if (!enabled) return

    rain.step.value = Math.min(delta, 0.1)
    rain.seed.value = (rain.seed.value + 1) >>> 0

    // Collision pass, as in the example: heights of everything except the rain
    // itself. The HDRI background would otherwise be written as heights.
    const background = scene.background
    const overrideMaterial = scene.overrideMaterial
    rain.rain.visible = false
    rain.splashes.visible = false
    scene.background = null
    scene.overrideMaterial = rain.collisionMaterial
    try {
      renderer.setRenderTarget(rain.collisionTarget)
      renderer.render(scene, rain.collisionCamera)
    } finally {
      renderer.setRenderTarget(null)
      scene.overrideMaterial = overrideMaterial
      scene.background = background
      rain.rain.visible = true
      rain.splashes.visible = true
    }

    renderer.compute(rain.computeUpdate)
  })

  if (!rain) return null
  return (
    <>
      <primitive object={rain.rain} visible={enabled} />
      <primitive object={rain.splashes} visible={enabled} />
    </>
  )
}

export default function Rain() {
  return (
    <>
      <LookContent />
      <RainContent />
    </>
  )
}
