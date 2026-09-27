import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import {
  ACESFilmicToneMapping, AddEquation, AdditiveBlending, AgXToneMapping, BoxGeometry, CineonToneMapping,
  ClampToEdgeWrapping, Color, CustomBlending, FrontSide, HalfFloatType, Layers, LinearFilter,
  LinearToneMapping, MathUtils, Matrix4, Mesh, MeshStandardMaterial, MeshStandardNodeMaterial,
  NeutralToneMapping, NoToneMapping, OneFactor, OneMinusSrcAlphaFactor, PCFShadowMap, PlaneGeometry,
  PointLight, RGBAFormat, ReinhardToneMapping, RenderPipeline, RepeatWrapping, SpotLight,
  Storage3DTexture, Vector3, VolumeNodeMaterial, ZeroFactor,
  type BufferAttribute, type Node, type PerspectiveCamera, type Scene, type ShadowMapType, type ToneMapping, type WebGPURenderer,
} from 'three/webgpu'
import {
  Fn, If, Loop, atan, cameraPosition, cos, float, floor, fract, frameId, hue, instanceIndex,
  interleavedGradientNoise, max, min, mix, mx_noise_float, pass, positionLocal, positionWorld,
  saturation, screenCoordinate, sin, smoothstep, storage, storageTexture, texture3D, textureStore,
  uniform, uvec3, vec3, vec4,
} from 'three/tsl'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { DragControls } from 'three/addons/controls/DragControls.js'
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'
import { snoise, snoiseVec3 } from 'three/addons/tsl/math/curlNoise.js'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

// Port of three.js r186 examples/webgpu_volume_fire.html: a 3D fluid simulation
// (semi-Lagrangian advection + curl noise, buoyancy, Jacobi projection) run in
// compute shaders over Storage3DTextures, ray marched by a VolumeNodeMaterial.
// Everything is generated in code; the example loads no assets.

const GRID_SIZE_X = 100
const GRID_SIZE_Y = 100
const GRID_SIZE_Z = 200
const CELL_COUNT = GRID_SIZE_X * GRID_SIZE_Y * GRID_SIZE_Z
const PRESSURE_ITERATIONS = 2 // Jacobi iterations (keep even!) // default 6
const VOLUME_WORLD_SIZE_X = 12
const VOLUME_WORLD_SIZE_Y = 12
const VOLUME_WORLD_SIZE_Z = 24
const VOLUME_WORLD_SIZE_DIAGONAL = Math.sqrt(VOLUME_WORLD_SIZE_X ** 2 + VOLUME_WORLD_SIZE_Y ** 2 + VOLUME_WORLD_SIZE_Z ** 2)
const TEXEL_X = 1 / GRID_SIZE_X
const TEXEL_Y = 1 / GRID_SIZE_Y
const TEXEL_Z = 1 / GRID_SIZE_Z
const LAYER_VOLUMETRIC_LIGHTING = 10

const TONE_MAPPINGS: Record<string, ToneMapping> = {
  None: NoToneMapping,
  Linear: LinearToneMapping,
  Reinhard: ReinhardToneMapping,
  Cineon: CineonToneMapping,
  ACESFilmic: ACESFilmicToneMapping,
  AgX: AgXToneMapping,
  Neutral: NeutralToneMapping,
}

// The Fn signature VolumetricLightingModel calls for scatteringEmissiveNode;
// r186 reads the property but @types/three does not declare it yet.
type RayFn = (params: { positionRay: Node<'vec3'> }) => Node
type FireVolumeMaterial = VolumeNodeMaterial & { scatteringEmissiveNode: RayFn | null }

function createStorage3D(name: string): Storage3DTexture {
  const texture = new Storage3DTexture(GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z)
  texture.name = name
  texture.format = RGBAFormat
  texture.type = HalfFloatType // rgba16float -> storage-writable + linearly filterable
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.wrapR = ClampToEdgeWrapping
  return texture
}

// instanceIndex (1D) -> voxel coordinate (3D)
const getVoxelCoord = (id: Node<'uint'>) => {
  const x = id.mod(GRID_SIZE_X)
  const y = id.div(GRID_SIZE_X).mod(GRID_SIZE_Y)
  const z = id.div(GRID_SIZE_X * GRID_SIZE_Y)
  return uvec3(x, y, z)
}

// voxel coordinate -> normalized uvw at the cell center
const coordToUVW = (coord: Node<'uvec3'>) => vec3(coord).add(0.5).div(vec3(GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z))

// The example's init(), animate() and GUI targets, scoped to one mount so the
// simulation textures, passes and uniforms are rebuilt and freed with the scene.
function createVolumeFire(renderer: WebGPURenderer, scene: Scene, camera: PerspectiveCamera, domElement: HTMLElement) {
  const uVolumeWorldSize = uniform(new Vector3(VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z))

  // sim uniforms
  const uDt = uniform(0.016)
  const uTime = uniform(0)

  const uBuoyancy = uniform(3.0) // hot air rises
  const uWeight = uniform(0.15) // smoke weight (pulls down)
  const uTurbulence = uniform(3.2) // noise force strength
  const uTurbulenceDecay = uniform(0.1) // turbulence decay rate over age
  const uTurbFrequency = uniform(10.0) // noise force frequency
  const uVelDamping = uniform(0.25) // velocity dissipation /s

  const uCooling = uniform(1.0) // temperature cooling /s (default for 1.0s lifespan)
  const uDissipation = uniform(0.4) // smoke dissipation /s (default for 2.5s lifespan)

  const uEmitDensity = uniform(7.0)
  const uEmitTemperature = uniform(5.5)

  const uTeapotMatrix = uniform(new Matrix4())
  const uTeapotSpeed = uniform(0.0)
  const uMotionBoost = uniform(0.25) // scales fire and smoke emission when moving
  const uTeapotVelocity = uniform(new Vector3())
  const uWindStrength = uniform(6.5) // strength of the wind effect when moving
  const uTeapotPosition = uniform(new Vector3())

  // render uniforms
  const uFireIntensity = uniform(40.0)
  const uTeapotEmissiveIntensity = uniform(0.2)
  const uFireGlowSpread = uniform(5.0)
  const uShadowAbsorption = uniform(2.0)
  const uShadowAmbient = uniform(0.5)
  const uFireStartColor = uniform(new Color(0xffe68c))
  const uFireMidColor = uniform(new Color(0xff7305))
  const uFireEndColor = uniform(new Color(0xff0000))
  const uFireHue = uniform(0.0)
  const uAsymmetry = uniform(0.0)
  const uPowderStrength = uniform(0.59)
  const uMultiScattering = uniform(1.0)
  const uPointLightVolumeIntensity = uniform(2.0)
  const uPointLightSurfaceIntensity = uniform(10.0)
  const uLightNearIntensity = uniform(10.0)
  const uLightFarIntensity = uniform(15.0)
  const uLightFarDistance = uniform(10.0)
  const uPointLightProjectionRadius = uniform(20.0)
  const uPointLightProjectionFrequency = uniform(0.2)
  const uPointLightProjectionNoiseFade = uniform(17.0)
  const uPointLightProjectionCenterFade = uniform(3.25)
  const uSaturation = uniform(1.1)
  const denoiseStrength = uniform(0.5)

  const uFlameHeight = uniform(3.5)
  const uSway = uniform(new Vector3())
  const uFlicker = uniform(1.0)
  const uColorNoise = uniform(0.0)
  const cpuNoise = new ImprovedNoise()

  // Simulation resources

  const velTexA = createStorage3D('velocity A')
  const velTexB = createStorage3D('velocity B')
  const dyeTexA = createStorage3D('dye A')
  const dyeTexB = createStorage3D('dye B')
  const divTex = createStorage3D('divergence')
  const pressTexA = createStorage3D('pressure A')
  const pressTexB = createStorage3D('pressure B')
  const curlNoiseTex = createStorage3D('curlNoise')
  curlNoiseTex.wrapS = RepeatWrapping
  curlNoiseTex.wrapT = RepeatWrapping
  curlNoiseTex.wrapR = RepeatWrapping
  const simTextures = [velTexA, velTexB, dyeTexA, dyeTexB, divTex, pressTexA, pressTexB, curlNoiseTex]

  const dyeTexNode = texture3D(dyeTexA)
  const dyeTexWriteNode = storageTexture(dyeTexB).toWriteOnly()
  const curlNoiseTexNode = texture3D(curlNoiseTex)

  // Teapot geometry & storage buffer for compute stage
  const teapotGeometry = new TeapotGeometry(0.8, 28)
  teapotGeometry.computeBoundingBox()
  const teapotMinY = teapotGeometry.boundingBox!.min.y
  const vertexCount = teapotGeometry.attributes.position.count
  const teapotVerticesBuffer = storage(teapotGeometry.attributes.position as BufferAttribute, 'vec3', vertexCount).toReadOnly()

  // ---------------------------------------------------------------
  // Fluid simulation - compute kernels
  // ---------------------------------------------------------------

  // 0) Precompute curl noise into 3D storage texture
  const computeCurlNoisePass = Fn(() => {
    const coord = getVoxelCoord(instanceIndex)
    const uvw = coordToUVW(coord)

    const freq = uTurbFrequency // 10.0
    const e = float(0.1).div(freq)
    const dx = vec3(e, 0.0, 0.0)
    const dy = vec3(0.0, e, 0.0)
    const dz = vec3(0.0, 0.0, e)

    const p = uvw.mul(vec3(VOLUME_WORLD_SIZE_X / VOLUME_WORLD_SIZE_Y, 1.0, VOLUME_WORLD_SIZE_Z / VOLUME_WORLD_SIZE_Y))
    const p_x0 = snoiseVec3(p.sub(dx).mul(freq))
    const p_x1 = snoiseVec3(p.add(dx).mul(freq))
    const p_y0 = snoiseVec3(p.sub(dy).mul(freq))
    const p_y1 = snoiseVec3(p.add(dy).mul(freq))
    const p_z0 = snoiseVec3(p.sub(dz).mul(freq))
    const p_z1 = snoiseVec3(p.add(dz).mul(freq))

    const x = p_y1.z.sub(p_y0.z).sub(p_z1.y).add(p_z0.y)
    const y = p_z1.x.sub(p_z0.x).sub(p_x1.z).add(p_x0.z)
    const z = p_x1.y.sub(p_x0.y).sub(p_y1.x).add(p_y0.x)

    // Analytical curlNoise multiplier is 1.0 / (2.0 * e) = 5.0 (since e = 0.1)
    const noiseVal = vec3(x, y, z).mul(5.0)

    textureStore(curlNoiseTex, coord, vec4(noiseVal, 0.0)).toWriteOnly()
  })().compute(CELL_COUNT).setName('computeCurlNoise')

  // 1) Advect velocity + external forces (buoyancy, weight, turbulence)
  //    read: velTexA, dyeTexNode -> write: velTexB
  const advectVelocityPass = Fn(() => {
    const coord = getVoxelCoord(instanceIndex)
    const uvw = coordToUVW(coord)

    const vel = texture3D(velTexA, uvw, 0).xyz

    // semi-Lagrangian advection: look back along the velocity
    const velUVW = vel.div(uVolumeWorldSize)
    const prevPos = uvw.sub(velUVW.mul(uDt))
    const newVel = texture3D(velTexA, prevPos, 0).xyz.toVar()

    const dye = dyeTexNode.sample(uvw).level(float(0))
    const density = dye.r
    const temperature = dye.g
    const age = dye.b

    // buoyancy (hot rises) vs smoke weight (cold falls)
    const buoyancyForce = temperature.mul(uBuoyancy).sub(density.mul(uWeight)).mul(VOLUME_WORLD_SIZE_Y)
    newVel.addAssign(vec3(0, buoyancyForce, 0).mul(uDt))

    // turbulence: divergence-free noise force
    // 1) Thermal/Convective turbulence: stronger where it's hot, decaying over age
    const thermalNoisePos = uvw.add(vec3(0, age.negate().mul(0.6), age.mul(0.13)).div(uTurbFrequency))
    const decay = age.mul(uTurbulenceDecay.negate()).exp()
    const thermalTurbulence = curlNoiseTexNode.sample(thermalNoisePos).level(float(0)).xyz.mul(uTurbulence).mul(temperature).mul(decay)

    // 2) Ambient/Atmospheric turbulence: lower frequency, weaker, acts on the smoke density (even when cooled down)
    //    using uTime so it animates continuously regardless of age
    const ambientNoisePos = uvw.mul(0.5).add(vec3(0, uTime.mul(0.25), uTime.mul(0.06)).div(uTurbFrequency))
    const ambientTurbulence = curlNoiseTexNode.sample(ambientNoisePos).level(float(0)).xyz.mul(uTurbulence.mul(0.2)).mul(density)

    const turbulence = thermalTurbulence.add(ambientTurbulence).mul(VOLUME_WORLD_SIZE_Y)
    newVel.addAssign(turbulence.mul(uDt))

    // damping
    newVel.mulAssign(max(float(1).sub(uVelDamping.mul(uDt)), 0))

    // Wind effect: bounding sphere around teapot
    const worldPos = uvw.sub(0.5).mul(uVolumeWorldSize).add(vec3(0, VOLUME_WORLD_SIZE_Y / 2, 0))
    const dist = worldPos.distance(uTeapotPosition)
    const teapotRadius = float(1.0)

    If(dist.lessThan(teapotRadius), () => {
      const ratio = dist.div(teapotRadius)
      const falloff = smoothstep(0.0, 1.0, float(1.0).sub(ratio))

      // Wind turbulence scales with uTurbulence and teapot speed, using curlNoise
      const windNoisePos = uvw.add(vec3(0.0, uTime.mul(0.5), 0.0).div(uTurbFrequency))
      const windTurbulence = curlNoiseTexNode.sample(windNoisePos).level(float(0)).xyz.mul(uTurbulence).mul(uTeapotSpeed)

      const windVel = uTeapotVelocity.mul(uWindStrength).add(windTurbulence).mul(uDt).mul(falloff)

      newVel.addAssign(windVel)
    })

    // fade velocity near the volume borders (soft boundary condition)
    const edge = min(uvw, vec3(1).sub(uvw))
    const boundary = smoothstep(0.0, 0.08, min(edge.x, min(edge.y, edge.z)))
    newVel.mulAssign(boundary)

    textureStore(velTexB, coord, vec4(newVel, 0)).toWriteOnly()
  })().compute(CELL_COUNT).setName('advectVelocity')

  // 2) Divergence of the advected velocity
  //    read: velTexB -> write: divTex
  const divergencePass = Fn(() => {
    const coord = getVoxelCoord(instanceIndex)
    const uvw = coordToUVW(coord)

    const vR = texture3D(velTexB, uvw.add(vec3(TEXEL_X, 0, 0)), 0).x
    const vL = texture3D(velTexB, uvw.sub(vec3(TEXEL_X, 0, 0)), 0).x
    const vU = texture3D(velTexB, uvw.add(vec3(0, TEXEL_Y, 0)), 0).y
    const vD = texture3D(velTexB, uvw.sub(vec3(0, TEXEL_Y, 0)), 0).y
    const vF = texture3D(velTexB, uvw.add(vec3(0, 0, TEXEL_Z)), 0).z
    const vB = texture3D(velTexB, uvw.sub(vec3(0, 0, TEXEL_Z)), 0).z

    const divergence = vR.sub(vL).add(vU.sub(vD)).add(vF.sub(vB)).mul(0.5)

    textureStore(divTex, coord, vec4(divergence, 0, 0, 0)).toWriteOnly()
  })().compute(CELL_COUNT).setName('divergence')

  // 3) Jacobi pressure solve (ping-pong A <-> B)
  const jacobi = (pressRead: Storage3DTexture, pressWrite: Storage3DTexture, name: string) => Fn(() => {
    const coord = getVoxelCoord(instanceIndex)
    const uvw = coordToUVW(coord)

    const pR = texture3D(pressRead, uvw.add(vec3(TEXEL_X, 0, 0)), 0).x
    const pL = texture3D(pressRead, uvw.sub(vec3(TEXEL_X, 0, 0)), 0).x
    const pU = texture3D(pressRead, uvw.add(vec3(0, TEXEL_Y, 0)), 0).x
    const pD = texture3D(pressRead, uvw.sub(vec3(0, TEXEL_Y, 0)), 0).x
    const pF = texture3D(pressRead, uvw.add(vec3(0, 0, TEXEL_Z)), 0).x
    const pB = texture3D(pressRead, uvw.sub(vec3(0, 0, TEXEL_Z)), 0).x

    const divergence = texture3D(divTex, uvw, 0).x

    const pressure = pR.add(pL).add(pU).add(pD).add(pF).add(pB).sub(divergence).div(6)

    textureStore(pressWrite, coord, vec4(pressure, 0, 0, 0)).toWriteOnly()
  })().compute(CELL_COUNT).setName(name)

  const jacobiPassAB = jacobi(pressTexA, pressTexB, 'jacobiAB')
  const jacobiPassBA = jacobi(pressTexB, pressTexA, 'jacobiBA')

  // 4) Project: subtract pressure gradient -> divergence-free velocity
  //    read: velTexB, pressTexA -> write: velTexA (final velocity of the frame)
  const projectPass = Fn(() => {
    const coord = getVoxelCoord(instanceIndex)
    const uvw = coordToUVW(coord)

    const pR = texture3D(pressTexA, uvw.add(vec3(TEXEL_X, 0, 0)), 0).x
    const pL = texture3D(pressTexA, uvw.sub(vec3(TEXEL_X, 0, 0)), 0).x
    const pU = texture3D(pressTexA, uvw.add(vec3(0, TEXEL_Y, 0)), 0).x
    const pD = texture3D(pressTexA, uvw.sub(vec3(0, TEXEL_Y, 0)), 0).x
    const pF = texture3D(pressTexA, uvw.add(vec3(0, 0, TEXEL_Z)), 0).x
    const pB = texture3D(pressTexA, uvw.sub(vec3(0, 0, TEXEL_Z)), 0).x

    const gradient = vec3(pR.sub(pL), pU.sub(pD), pF.sub(pB)).mul(0.5)

    const vel = texture3D(velTexB, uvw, 0).xyz.sub(gradient)

    textureStore(velTexA, coord, vec4(vel, 0)).toWriteOnly()
  })().compute(CELL_COUNT).setName('project')

  // 5) Advect density / temperature
  //    read: dyeTexNode, velTexA -> write: dyeTexWriteNode
  const advectDyePass = Fn(() => {
    const coord = getVoxelCoord(instanceIndex)
    const uvw = coordToUVW(coord)

    const vel = texture3D(velTexA, uvw, 0).xyz
    const velUVW = vel.div(uVolumeWorldSize)
    const prevPos = uvw.sub(velUVW.mul(uDt))

    const dye = dyeTexNode.sample(prevPos).level(float(0))

    const density = dye.r.mul(max(float(1).sub(uDissipation.mul(uDt)), 0)).toVar()
    const temperature = dye.g.mul(max(float(1).sub(uCooling.mul(uDt)), 0)).toVar()

    // Nearest neighbor lookup for age to prevent numerical diffusion
    const gridDims = vec3(GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z)
    const nearestUVW = floor(prevPos.mul(gridDims)).add(0.5).div(gridDims)
    const age = dyeTexNode.sample(nearestUVW).level(float(0)).b.add(uDt).toVar()

    temperature.assign(temperature.clamp(0, 12))

    If(density.lessThanEqual(0.01), () => {
      age.assign(0.0)
    })

    textureStore(dyeTexWriteNode, coord, vec4(density, temperature, age, 1.0)).toWriteOnly()
  })().compute(CELL_COUNT).setName('advectDye')

  // 6) Emit density/temperature from teapot vertices
  //    write: dyeTexWriteNode
  const emitTeapotPass = Fn(() => {
    const vertexPos = teapotVerticesBuffer.element(instanceIndex)
    const worldPos = uTeapotMatrix.mul(vec4(vertexPos, 1.0)).xyz

    // Map world position to volume box UVW space [0..1]
    const uvw = worldPos.sub(vec3(0, VOLUME_WORLD_SIZE_Y / 2, 0)).div(uVolumeWorldSize).add(0.5)

    // Check boundary
    If(uvw.x.greaterThanEqual(0).and(uvw.x.lessThanEqual(1))
      .and(uvw.y.greaterThanEqual(0)).and(uvw.y.lessThanEqual(1))
      .and(uvw.z.greaterThanEqual(0)).and(uvw.z.lessThanEqual(1)), () => {
      const coord = uvec3(uvw.mul(vec3(GRID_SIZE_X, GRID_SIZE_Y, GRID_SIZE_Z)))

      // Add flicker / animated noise based on local vertex position
      const flicker = mx_noise_float(vertexPos.mul(9.0).add(vec3(0.0, uTime.negate().mul(2.5), uTime.mul(0.7)))).mul(0.5).add(0.5)

      // Baseline emission depends on temperature rate (0 if temperature is 0)
      const baseEmission = uEmitTemperature.greaterThan(0.0).select(float(1.0), float(0.0))

      // Movement-based emission (boost) scales with speed
      const movementEmission = uTeapotSpeed.mul(uMotionBoost)

      // Unified emission factor (includes movement boost)
      const emissionFactor = baseEmission.add(movementEmission)

      const densityVal = uEmitDensity.mul(float(1 / 120)).mul(flicker.mul(0.85).add(0.15)).mul(emissionFactor)

      If(densityVal.greaterThan(0.0), () => {
        const tempVal = uEmitTemperature.mul(float(1 / 120)).mul(flicker.mul(0.85).add(0.15)).mul(emissionFactor)

        // Read current dye and add emission
        const currentDye = dyeTexNode.sample(uvw).level(float(0))
        const newDensity = currentDye.r.add(densityVal)
        const newTemp = currentDye.g.add(tempVal).clamp(0.0, 12.0)

        const currentAge = currentDye.b
        const newAge = mix(currentAge, float(0.0), densityVal.div(max(newDensity, 0.001)))

        textureStore(dyeTexWriteNode, coord, vec4(newDensity, newTemp, newAge, 1.0)).toWriteOnly()
      })
    })
  })().compute(vertexCount).setName('emitTeapot')

  const computePasses = [
    computeCurlNoisePass, advectVelocityPass, divergencePass, jacobiPassAB, jacobiPassBA,
    projectPass, advectDyePass, emitTeapotPass,
  ]

  // Precompute curl noise on the GPU
  void renderer.computeAsync(computeCurlNoisePass)

  // Volumetric material - ray marches the simulated 3D texture

  const volumetricMaterial = new VolumeNodeMaterial() as FireVolumeMaterial
  volumetricMaterial.steps = 16
  volumetricMaterial.transparent = true
  volumetricMaterial.blending = AdditiveBlending
  volumetricMaterial.depthWrite = false

  // Dithering to reduce banding
  volumetricMaterial.offsetNode = fract(interleavedGradientNoise(screenCoordinate).add(float(frameId).mul(0.618033988749895)))

  // blackbody-style fire ramp: start color -> mid color -> end color
  const fireRamp = Fn(([t]: [Node<'float'>]) => {
    const color = vec3(0).toVar()
    color.assign(mix(vec3(0.0, 0.0, 0.0), uFireEndColor, smoothstep(0.05, 0.35, t)))
    color.assign(mix(color, uFireMidColor, smoothstep(0.35, 0.65, t)))
    color.assign(mix(color, uFireStartColor, smoothstep(0.65, 1.0, t)))
    return color
  })

  const henyeyGreenstein = Fn(([cosTheta, g]: [Node<'float'>, Node<'float'>]) => {
    const g2 = g.mul(g)
    const denom = float(1.0).add(g2).sub(float(2.0).mul(g).mul(cosTheta))
    const oneMinusG2 = float(1.0).sub(g2)
    // Normalization constant 1 / (4 * PI) is approx 0.079577
    return oneMinusG2.div(denom.pow(1.5)).mul(0.079577)
  })

  // Key light - declared here so the scattering nodes can close over its position.
  const keyLight = new SpotLight(0xffffff, 1000)
  const uKeyLightPos = uniform(keyLight.position)

  const getVolumeSample = ({ positionRay }: { positionRay: Node<'vec3'> }) => {
    // volume box is shifted up -> map ray position to uvw [0..1]
    const uvw = positionRay.sub(vec3(0, VOLUME_WORLD_SIZE_Y / 2, 0)).div(uVolumeWorldSize).add(0.5).toVar()

    // 1) Domain Warping: distort coordinates using velocity field over time to make smoke wispy (Option A)
    const noiseDistortion = texture3D(velTexA, uvw, 0).xyz.div(uVolumeWorldSize).mul(0.15)
    const distortedUVW = uvw.add(noiseDistortion).clamp(0.0, 1.0).toVar()

    const sample = dyeTexNode.sample(distortedUVW).level(float(0))

    const density = sample.r
    const age = sample.b
    const temperature = sample.g

    // 2) High-frequency detail noise modulation (using simplex noise instead of mx_noise)
    const detailNoise = snoise(positionRay.mul(5.5).add(vec3(0, age.mul(0.8).negate(), 0)))
    density.mulAssign(detailNoise.mul(0.35).add(0.85))

    // soften the box edges
    const edge = min(distortedUVW, vec3(1).sub(distortedUVW))
    density.mulAssign(smoothstep(0.0, 0.06, min(edge.x, min(edge.y, edge.z))))

    return { density, temperature, age, distortedUVW }
  }

  volumetricMaterial.scatteringNode = Fn(({ positionRay }: { positionRay: Node<'vec3'> }) => {
    const { density } = getVolumeSample({ positionRay })

    // 3) Key-light Self-Shadowing: raymarch towards uKeyLightPos
    const lightDir = uKeyLightPos.sub(positionRay).normalize()
    const shadowDensitySum = float(0.0).toVar()
    const shadowStepSize = 0.35

    for (let i = 0; i < 2; i++) { // default 5
      const stepDist = (i + 0.5) * shadowStepSize
      const shadowPos = positionRay.add(lightDir.mul(stepDist))
      const shadowUVW = shadowPos.sub(vec3(0, VOLUME_WORLD_SIZE_Y / 2, 0)).div(uVolumeWorldSize).add(0.5)

      // Fade out shadow density near the volume borders to avoid edge artifacts
      const shadowEdge = min(shadowUVW, vec3(1).sub(shadowUVW))
      const shadowFade = smoothstep(0.0, 0.06, min(shadowEdge.x, min(shadowEdge.y, shadowEdge.z)))

      const shadowSample = texture3D(dyeTexA, shadowUVW, 0).r.mul(shadowFade)
      shadowDensitySum.addAssign(shadowSample)
    }

    // Calculate optical thickness (tau)
    const tau = shadowDensitySum.mul(shadowStepSize).mul(uShadowAbsorption)
    const beer = tau.negate().exp()

    // Multiple Scattering Approximation (Octave 2): lower absorption (e.g. 0.25x) and scaled down contribution (0.5x)
    const multiScatter = tau.mul(0.25).negate().exp().mul(0.5)

    // Blend between single and multiple scattering
    const baseTransmittance = mix(beer, beer.add(multiScatter), uMultiScattering)

    // Apply Beer's Law Powder Effect to simulate edge self-shadowing details
    const powder = float(1.0).sub(tau.mul(2.0).negate().exp())
    const finalTransmittance = mix(baseTransmittance, baseTransmittance.mul(powder), uPowderStrength)

    // Apply ambient light in shadowed regions
    const lightTransmittance = finalTransmittance.add(uShadowAmbient).clamp(0.0, 1.0)

    // Henyey-Greenstein Phase Function for directional scattering
    const viewDir = cameraPosition.sub(positionRay).normalize()
    const cosTheta = viewDir.dot(lightDir).clamp(-1.0, 1.0)
    const phase = henyeyGreenstein(cosTheta, uAsymmetry)

    // Apply shadowing and phase function only to the smoke scattering
    // Multiply phase function by 4 * PI (approx 12.56637) to maintain standard lighting scale
    return vec3(density).mul(lightTransmittance).mul(phase.mul(12.56637))
  })

  volumetricMaterial.scatteringEmissiveNode = Fn(({ positionRay }: { positionRay: Node<'vec3'> }) => {
    const { density, temperature } = getVolumeSample({ positionRay })

    // fire "emission" (boosted scattering tinted by temperature)
    // Control the spread of the fire core (inverted: higher spread = lower power)
    const firePower = float(6.0).sub(uFireGlowSpread)
    const fire = fireRamp(temperature.clamp(0, 1)).mul(temperature.pow(firePower)).mul(uFireIntensity)

    // Apply hue rotation to the fire color
    const fireColor = hue(fire, uFireHue)

    // Simulate the spotlight distance attenuation (with a constant intensity of 400) to restore the original color/brightness
    const distance = positionRay.sub(uKeyLightPos).length()
    const attenuation = float(400.0).div(distance.pow(2.0))

    return fireColor.mul(density.add(0.15)).mul(attenuation)
  }) as unknown as RayFn

  const volumeCastShadow = Fn(() => {
    const startPos = positionWorld
    const lightDir = positionWorld.sub(cameraPosition).normalize()

    const steps = uniform('int').onRenderUpdate(({ material, object }) =>
      (material as VolumeNodeMaterial | null)?.steps
      || (object as Mesh<BoxGeometry, VolumeNodeMaterial> | null)?.material?.steps
      || volumetricMaterial.steps)
    const maxDistance = float(VOLUME_WORLD_SIZE_DIAGONAL) // Diagonal of volume box
    const stepSize = maxDistance.div(steps).toVar()
    const rayDir = lightDir.toVar()

    const distTravelled = float(0.0).toVar()
    const transmittance = float(1.0).toVar()

    Loop(steps, () => {
      const positionRay = startPos.add(rayDir.mul(distTravelled))

      const { density } = getVolumeSample({ positionRay })

      const absorption = density.mul(uShadowAbsorption).mul(0.01)
      const falloff = absorption.negate().mul(stepSize).exp()

      transmittance.mulAssign(falloff)

      distTravelled.addAssign(stepSize)
    })

    // If the ray is completely transparent, discard the fragment
    transmittance.greaterThanEqual(0.99).discard()

    const shadowOpacity = transmittance.oneMinus()

    return vec4(vec3(0), shadowOpacity.mul(5))
  })

  const volumeGeometry = new BoxGeometry(VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z)
  const volumetricMesh = new Mesh(volumeGeometry, volumetricMaterial)
  volumetricMesh.position.y = VOLUME_WORLD_SIZE_Y / 2 + 0.4
  volumetricMesh.receiveShadow = true
  scene.add(volumetricMesh)

  const shadowMaterial = new VolumeNodeMaterial()
  shadowMaterial.steps = volumetricMaterial.steps
  shadowMaterial.offsetNode = volumetricMaterial.offsetNode
  shadowMaterial.castShadowNode = volumeCastShadow()
  shadowMaterial.shadowSide = FrontSide
  shadowMaterial.colorWrite = false
  shadowMaterial.depthWrite = false
  shadowMaterial.blending = CustomBlending
  shadowMaterial.blendEquation = AddEquation
  shadowMaterial.blendSrc = ZeroFactor
  shadowMaterial.blendDst = OneMinusSrcAlphaFactor
  shadowMaterial.blendEquationAlpha = AddEquation
  shadowMaterial.blendSrcAlpha = OneFactor
  shadowMaterial.blendDstAlpha = OneMinusSrcAlphaFactor

  const volumetricShadowMesh = new Mesh(volumeGeometry, shadowMaterial)
  volumetricShadowMesh.position.y = VOLUME_WORLD_SIZE_Y / 2 + 0.4
  volumetricShadowMesh.castShadow = true
  scene.add(volumetricShadowMesh)

  // Floor

  const floorGeometry = new PlaneGeometry(80, 80)
  const floorMaterial = new MeshStandardMaterial({ color: 0x111115, roughness: 0.8 })
  const floorPlane = new Mesh(floorGeometry, floorMaterial)
  floorPlane.rotation.x = -Math.PI / 2
  floorPlane.position.y = -VOLUME_WORLD_SIZE_Y / 2 + 0.4 + VOLUME_WORLD_SIZE_Y / 2 + 0.4
  floorPlane.receiveShadow = true
  scene.add(floorPlane)

  // Teapot - opaque object inside the smoke, to visualize volumetric transparency / occlusion

  const teapotMaterial = new MeshStandardNodeMaterial({ color: 0x000000, roughness: 1.0, metalness: 1.0 })
  const teapot = new Mesh(teapotGeometry, teapotMaterial)
  teapot.receiveShadow = true
  teapot.position.set(0, floorPlane.position.y - teapotMinY, 0)
  teapot.visible = true
  scene.add(teapot)

  const prevTeapotPos = teapot.position.clone()
  teapot.updateMatrixWorld()
  uTeapotMatrix.value.copy(teapot.matrixWorld)
  uTeapotPosition.value.copy(teapot.position)

  const isVolume = Fn(({ material }) => {
    const isVolumeMaterial = (material as { isVolumeNodeMaterial?: boolean } | null)?.isVolumeNodeMaterial === true
    return float(isVolumeMaterial ? 1.0 : 0.0)
  })()

  const pointLightColor = Fn(() => {
    // Shading point position in world space
    const P = positionWorld

    // Light source bottom position (teapot position)
    const A = uTeapotPosition

    // 1. Flame column height
    const H = vec3(0.0, uFlameHeight, 0.0) // Direction of vertical propagation

    // Calculate closest point on vertical segment (displaced by sway)
    const V = P.sub(A)
    const t = V.dot(H).div(H.dot(H)).clamp(0.0, 1.0)
    const C = A.add(uSway).add(H.mul(t))
    const distToSegment = P.sub(C).length()

    // Calculate soft cylindrical attenuation (with flame thickness radius r = 1.2)
    const r = float(1.2)
    const softAttenuation = float(1.0).div(distToSegment.pow(2.0).add(r.pow(2.0)))

    // Recreate standard PointLight distance attenuation for correction/cancellation
    const distToLight = P.sub(A).length()
    const decayExponent = float(2.0) // Must match PointLight's decay value in the constructor
    const defaultAttenuation = distToLight.pow(decayExponent).max(0.01).reciprocal()

    // Correction factor to cancel the default point light attenuation and apply volumetric/capsule decay
    // We only cancel the decay when rendering the volume so standard surfaces keep their physical 1/d^2 falloff.
    const attenuationCorrection = isVolume.equal(1.0).select(
      softAttenuation.div(defaultAttenuation),
      float(1.0),
    )

    // Choose intensity based on whether we are shading the volume (smoke) or solid surfaces (reflection)
    const currentIntensity = isVolume.equal(1.0).select(uPointLightVolumeIntensity, uPointLightSurfaceIntensity)

    // 4. Color temperature oscillation: shift color tone slightly over time (uniform for volume)
    const colorT = uEmitTemperature.div(8.34).mul(0.5).add(0.20).add(uColorNoise).clamp(0.0, 1.0)
    const fireColor = fireRamp(colorT)
    const coloredFire = hue(saturation(fireColor, uSaturation), uFireHue)

    // 5. Projected fire light color on surfaces
    // Calculate relative XZ position from teapot center
    const relP = P.xz.sub(A.xz)
    const angle = atan(relP.y, relP.x)
    const distXZ = relP.length()

    // Radial ray/spoke noise that rotates/flickers over time
    const freqScale = uPointLightProjectionFrequency
    const angleNoise = mx_noise_float(vec3(cos(angle).mul(float(1.5).mul(freqScale)), sin(angle).mul(float(1.5).mul(freqScale)), uTime.mul(0.6))).mul(0.5).add(0.5)

    // Fade out the angle spoke noise near the center to prevent the atan(0,0) seam singularity
    const centerFadeFactor = smoothstep(0.0, uPointLightProjectionCenterFade, distXZ)
    const cleanAngleNoise = mix(float(1.0), angleNoise, centerFadeFactor)

    // Spatial noise moving outwards/upwards (convective fire behavior)
    const noiseCoord1 = vec3(P.x.mul(float(0.6).mul(freqScale)), uTime.mul(1.2), P.z.mul(float(0.6).mul(freqScale)))
    const projN1 = mx_noise_float(noiseCoord1).mul(0.5).add(0.5)

    const noiseCoord2 = vec3(P.x.mul(float(1.5).mul(freqScale)), uTime.mul(2.5), P.z.mul(float(1.5).mul(freqScale)))
    const projN2 = mx_noise_float(noiseCoord2).mul(0.5).add(0.5)

    // Combine the noises
    const projNoise = projN1.mul(0.65).add(projN2.mul(0.35))

    // Modulate by radial spoke pattern
    const projectionIntensity = projNoise.mul(cleanAngleNoise.mul(0.5).add(0.5))

    // Fade out the noise over distance (blend to uniform 1.0)
    const noiseFadeFactor = distToSegment.div(uPointLightProjectionNoiseFade).clamp(0.0, 1.0)
    const finalIntensity = mix(projectionIntensity, float(1.0), noiseFadeFactor)

    // Create a radial temperature gradient from the fire center to project colors realistically
    const radialTemp = float(1.0).sub(distToSegment.div(uPointLightProjectionRadius)).clamp(0.0, 1.0)

    // Map the radial temperature and noise to the fire colors (Start, Mid, End)
    const colorTProj = radialTemp.mul(finalIntensity).clamp(0.0, 1.0)
    const fireColorProj = fireRamp(colorTProj)
    const coloredFireProj = hue(saturation(fireColorProj, uSaturation), uFireHue)

    // Select either uniform fire color (volume) or projected fire color (surface)
    const finalFireColor = isVolume.equal(1.0).select(coloredFire, coloredFireProj)

    // Scale intensity by uEmitTemperature (relative to its default 8.34) using Stefan-Boltzmann law (T^4)
    // to make it physically correct (radiant energy is proportional to T^4)
    const tempScale = uEmitTemperature.div(8.34).max(0.0)
    const tempFactor = tempScale.pow(4.0)

    // Scale by uEmitDensity (relative to default 11.02) to represent fire/smoke size
    const densityScale = uEmitDensity.div(11.02).max(0.0)

    // Smooth fade-in of point light intensity during the first 3 seconds of the simulation
    const fadeIn = smoothstep(0.0, 3.0, uTime)

    const baseColor = finalFireColor.mul(tempFactor).mul(densityScale).mul(uFireIntensity).mul(currentIntensity).mul(uFlicker).mul(fadeIn)

    // Blend between near and far light intensity scales
    const distRatio = distToSegment.div(uLightFarDistance).clamp(0.0, 1.0)
    const distanceScale = mix(uLightNearIntensity, uLightFarIntensity, smoothstep(0.0, 1.0, distRatio))

    // Apply distance-based scaling only when shading the volumetric smoke
    const finalScale = isVolume.equal(1.0).select(distanceScale, float(1.0))

    return baseColor.mul(attenuationCorrection).mul(finalScale)
  })()

  const pointLight = new PointLight(0xffffff, 1, 100, 2)
  // AnalyticLightNode reads light.colorNode in r186; @types/three omits it.
  ;(pointLight as PointLight & { colorNode: Node }).colorNode = pointLightColor
  pointLight.position.set(0, 0, 0)
  pointLight.castShadow = false
  teapot.add(pointLight)

  // Orbit and drag controls, as in the example.

  const controls = new OrbitControls(camera, domElement)
  controls.target.set(0, -VOLUME_WORLD_SIZE_Y / 2 + 3.6 + VOLUME_WORLD_SIZE_Y / 2, 0)
  controls.maxDistance = 40
  controls.minDistance = 2
  controls.update()

  const dragControls = new DragControls([teapot], camera, domElement)
  dragControls.rotateSpeed = 0
  dragControls.addEventListener('dragstart', () => {
    controls.enabled = false
  })
  dragControls.addEventListener('drag', () => {
    // Constraint to volume box boundaries
    const limitX = VOLUME_WORLD_SIZE_X / 2 - 1.5
    const limitZ = VOLUME_WORLD_SIZE_Z / 2 - 1.5
    teapot.position.x = Math.max(-limitX, Math.min(limitX, teapot.position.x))
    teapot.position.y = Math.max(floorPlane.position.y - teapotMinY, Math.min(VOLUME_WORLD_SIZE_Y - 1.5, teapot.position.y))
    teapot.position.z = Math.max(-limitZ, Math.min(limitZ, teapot.position.z))
  })
  dragControls.addEventListener('dragend', () => {
    controls.enabled = true
  })

  // Key light - white spot with shadow, so the smoke receives/shows shadows clearly

  keyLight.position.set(-3 * (VOLUME_WORLD_SIZE_X / 8), 6 * (VOLUME_WORLD_SIZE_Y / 8) + VOLUME_WORLD_SIZE_Y / 2 + 0.4, 3 * (VOLUME_WORLD_SIZE_Z / 8))
  keyLight.angle = Math.PI / 5
  keyLight.penumbra = 1
  keyLight.decay = 2
  keyLight.distance = 0
  keyLight.castShadow = true
  keyLight.shadow.intensity = 0.98
  keyLight.shadow.mapSize.width = 1024
  keyLight.shadow.mapSize.height = 1024
  keyLight.shadow.camera.near = 1
  const maxVolumeSize = Math.max(VOLUME_WORLD_SIZE_X, VOLUME_WORLD_SIZE_Y, VOLUME_WORLD_SIZE_Z)
  keyLight.shadow.camera.far = 20 * (maxVolumeSize / 8)
  keyLight.shadow.bias = -0.001
  keyLight.shadow.focus = 1
  keyLight.target.position.set(1, 0, 0)
  scene.add(keyLight)
  scene.add(keyLight.target)

  // Render Pipeline (same structure as the volumetric example)

  const renderPipeline = new RenderPipeline(renderer)

  // Layers

  const volumetricLayer = new Layers()
  volumetricLayer.disableAll()
  volumetricLayer.enable(LAYER_VOLUMETRIC_LIGHTING)

  volumetricMesh.layers.disableAll()
  volumetricMesh.layers.enable(LAYER_VOLUMETRIC_LIGHTING)

  keyLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)
  pointLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING)

  // Scene Pass

  const scenePass = pass(scene, camera)
  scenePass.name = 'Scene Pass'

  // Volumetric Lighting Pass

  const volumetricPass = pass(scene, camera)
  volumetricPass.name = 'Volumetric Lighting'
  volumetricPass.setLayers(volumetricLayer)
  volumetricPass.setResolutionScale(0.5)

  // Compose and Denoise

  teapotMaterial.emissiveNode = Fn(() => {
    // Lava flow animation using local position for stability when dragging
    const p = positionLocal.mul(0.5)
    const flow = vec3(0.0, uTime.negate(), 0.0)

    // 3 Octaves of MaterialX Noise for organic fractal pattern
    const n1 = mx_noise_float(p.add(flow)).mul(0.5).add(0.5)
    const p2 = p.mul(2.0).sub(flow.mul(1.5))
    const n2 = mx_noise_float(p2.add(vec3(n1.mul(0.4)))).mul(0.5).add(0.5)
    const p3 = p.mul(4.0).add(flow.mul(2.5))
    const n3 = mx_noise_float(p3).mul(0.5).add(0.5)

    const noiseVal = n1.mul(0.50).add(n2.mul(0.35)).add(n3.mul(0.15))

    // Apply power function to create sharp glowing lava veins and wide dark crust regions
    const lavaT = noiseVal.pow(2.5).clamp(0.0, 1.0)

    // Use fireRamp to map the lava temperature to the blackbody-like fire colors
    const fireColor = fireRamp(lavaT.add(0.1))
    const coloredFire = hue(saturation(fireColor, uSaturation), uFireHue)

    const tempScale = uEmitTemperature.div(8.34).max(0.0)
    const tempFactor = tempScale.pow(4.0)
    const densityScale = uEmitDensity.div(11.02).max(0.0)
    const fadeIn = smoothstep(0.0, 3.0, uTime)

    // Combine fire parameters with teapot emissive intensity and temporal flicker
    // Boosted by 10.0 to make the glowing cracks stand out clearly on the dark surface
    return coloredFire.mul(tempFactor).mul(densityScale).mul(uFireIntensity).mul(uFlicker).mul(fadeIn).mul(uTeapotEmissiveIntensity)
  })()

  // The example's params object; the Leva panel writes into it.
  const params = {
    denoise: true,
    simulate: true,
    fireHue: 0,
    simSpeed: 1.2,
    smokeLifespan: 3.5,
    fireLifespan: 1.3,
    turbulence: 3.2,
    bloom: true,
    bloomStrength: 0.1,
    bloomRadius: 1.0,
    bloomThreshold: 0.5,
  }

  const blurredVolumetricPass = gaussianBlur(volumetricPass, denoiseStrength, 1)

  let bloomPass: ReturnType<typeof bloom> | null = null

  function updatePostProcessing() {
    let volumetric: Node<'vec4'> = volumetricPass
    if (params.denoise) {
      volumetric = blurredVolumetricPass as unknown as Node<'vec4'>
    }

    const volumetricRGB = volumetric.rgb
    const adjustedVolumetricRGB = saturation(volumetricRGB, uSaturation)
    const adjustedVolumetric = vec4(adjustedVolumetricRGB, volumetric.a).mul(0.5)

    const scenePassColor = scenePass.max(adjustedVolumetric).add(adjustedVolumetric)

    let output: Node = scenePassColor

    if (params.bloom) {
      if (bloomPass !== null) {
        bloomPass.dispose()
      }
      bloomPass = bloom(scenePassColor)
      bloomPass.threshold.value = params.bloomThreshold
      bloomPass.strength.value = params.bloomStrength
      bloomPass.radius.value = params.bloomRadius
      output = scenePassColor.add(bloomPass)
    } else if (bloomPass !== null) {
      bloomPass.dispose()
      bloomPass = null
    }

    renderPipeline.outputNode = output
    renderPipeline.needsUpdate = true
  }

  updatePostProcessing()

  // ---------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------

  let simulationTime = 0
  let simAccumulator = 0
  const teapotVel = new Vector3()

  function updateTemporalUniforms(time: number) {
    uTime.value = time % 1000

    const heightNoise = cpuNoise.noise(0, time * 2.5, 0)
    uFlameHeight.value = 3.5 + heightNoise * 0.8

    const swayX = cpuNoise.noise(time * 3.5, 0, 0) * 0.4
    const swayZ = cpuNoise.noise(0, 0, time * 3.5) * 0.4
    uSway.value.set(swayX, 0, swayZ)

    const slowNoise = cpuNoise.noise(0, time * 0.8, 0)
    const fastNoise = cpuNoise.noise(0, time * 15.0, 0)
    uFlicker.value = slowNoise * 0.12 + fastNoise * 0.06 + 0.82

    const colorNoise = cpuNoise.noise(time * 5.0, time * 5.0, 0) * 0.08
    uColorNoise.value = colorNoise

    teapot.rotation.y = time * 0.25
    teapot.updateMatrixWorld()
    uTeapotMatrix.value.copy(teapot.matrixWorld)
  }

  // The example's animate(); `frameDelta` is R3F's clock delta in seconds.
  function animate(frameDelta: number) {
    const delta = Math.min(frameDelta, 1 / 30)

    // Calculate teapot speed and velocity vector for wind effect
    const currentPos = teapot.position
    const dist = currentPos.distanceTo(prevTeapotPos)
    const speed = delta > 0 ? dist / delta : 0

    teapotVel.set(0, 0, 0)
    if (delta > 0) {
      teapotVel.subVectors(currentPos, prevTeapotPos).multiplyScalar(1 / delta)
    }

    prevTeapotPos.copy(currentPos)

    uTeapotSpeed.value = speed
    uTeapotVelocity.value.copy(teapotVel)
    uTeapotPosition.value.copy(currentPos)

    if (params.simulate && params.simSpeed > 0) {
      const dt = delta * params.simSpeed
      simAccumulator += dt

      const stepTime = 1 / 120
      const simStep = stepTime * params.simSpeed

      const maxAccumulator = simStep * 8
      if (simAccumulator > maxAccumulator) {
        simAccumulator = maxAccumulator
      }

      uDt.value = simStep
      uTurbulence.value = params.simSpeed > 0 ? params.turbulence / Math.sqrt(params.simSpeed) : 0

      if (params.smokeLifespan >= 100.0) {
        uDissipation.value = 0.0
      } else {
        uDissipation.value = 1.0 / params.smokeLifespan
      }

      uCooling.value = 1.0 / params.fireLifespan

      while (simAccumulator >= simStep) {
        simulationTime += simStep
        updateTemporalUniforms(simulationTime)

        // --- fluid simulation steps (compute shaders) ---

        renderer.compute(advectVelocityPass) // reads dyeTexNode, writes velTexB
        renderer.compute(divergencePass) // velB -> div

        for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
          renderer.compute((i % 2 === 0) ? jacobiPassAB : jacobiPassBA)
        }

        renderer.compute(projectPass) // velB - grad(p) -> velA
        renderer.compute(advectDyePass) // reads dyeTexNode, writes dyeTexWriteNode
        renderer.compute(emitTeapotPass) // inject from teapot vertices -> dyeTexWriteNode

        // Ping-pong dye textures
        const temp = dyeTexNode.value
        dyeTexNode.value = dyeTexWriteNode.value
        dyeTexWriteNode.value = temp

        simAccumulator -= simStep
      }
    } else {
      updateTemporalUniforms(simulationTime)
    }

    // Update point light range dynamically based on temperature, density (fire size) and fire intensity
    const tempRatio = uEmitTemperature.value / 8.34
    const densityRatio = uEmitDensity.value / 11.02
    const intensityRatio = uFireIntensity.value / 5.63
    const sizeFactor = Math.sqrt(tempRatio * densityRatio * intensityRatio)

    // Smooth fade-in factor over the first 3 seconds of the simulation
    const t = Math.min(Math.max(simulationTime / 3.0, 0.0), 1.0)
    const fadeIn = t * t * (3.0 - 2.0 * t)

    pointLight.distance = Math.max(0.01, 40.0 * Math.max(0.2, sizeFactor) * fadeIn)

    controls.update()
    renderPipeline.render()
  }

  function dispose() {
    dragControls.dispose()
    controls.dispose()
    bloomPass?.dispose()
    blurredVolumetricPass.dispose()
    renderPipeline.dispose()
    volumetricPass.dispose()
    scenePass.dispose()
    for (const computeNode of computePasses) computeNode.dispose()
    for (const object of [volumetricMesh, volumetricShadowMesh, floorPlane, teapot, keyLight, keyLight.target]) {
      object.removeFromParent()
    }
    keyLight.dispose()
    pointLight.dispose()
    volumeGeometry.dispose()
    volumetricMaterial.dispose()
    shadowMaterial.dispose()
    floorGeometry.dispose()
    floorMaterial.dispose()
    teapotGeometry.dispose()
    teapotMaterial.dispose()
    for (const texture of simTextures) texture.dispose()
  }

  return {
    params,
    uniforms: {
      uBuoyancy, uVelDamping, uTurbulenceDecay, uTurbFrequency, uEmitDensity, uEmitTemperature, uMotionBoost,
      uWindStrength, uTeapotEmissiveIntensity, uFireGlowSpread, uShadowAbsorption, uShadowAmbient,
      uFireStartColor, uFireMidColor, uFireEndColor, uFireHue, uAsymmetry, uPowderStrength, uMultiScattering,
      uPointLightVolumeIntensity, uPointLightSurfaceIntensity, uLightNearIntensity, uLightFarIntensity,
      uPointLightProjectionRadius, uPointLightProjectionFrequency, uPointLightProjectionNoiseFade,
      uPointLightProjectionCenterFade, uSaturation, denoiseStrength,
    },
    keyLight,
    volumetricMaterial,
    volumetricPass,
    bloomPass: () => bloomPass,
    updatePostProcessing,
    animate,
    dispose,
  }
}

type VolumeFire = ReturnType<typeof createVolumeFire>

function VolumeFireContent() {
  const { gl, scene, camera } = useThree()
  const fire = useRef<VolumeFire | null>(null)
  const published = useRef(false)

  // The example's "Fire Simulation" GUI, folder for folder.
  const values = useControls('Volume fire', {
    simulate: { value: true, label: 'Simulate Fluid' },
    simSpeed: { value: 1.2, min: 0, max: 2, step: 0.01, label: 'Simulation Speed' },
    resolution: { value: 0.5, min: 0.1, max: 1, label: 'Render Resolution' },
    'Quality & Denoise': folder({
      steps: { value: 16, min: 4, max: 42, step: 1, label: 'Raymarch Steps' },
      denoise: { value: true, label: 'Denoise Enabled' },
      denoiseStrength: { value: 0.5, min: 0, max: 1, label: 'Denoise Strength' },
    }),
    Bloom: folder({
      bloom: { value: true, label: 'Bloom Enabled' },
      bloomStrength: { value: 0.1, min: 0, max: 3, step: 0.01, label: 'Bloom Strength' },
      bloomRadius: { value: 1.0, min: 0, max: 1, step: 0.01, label: 'Bloom Radius' },
      bloomThreshold: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'Bloom Threshold' },
    }),
    'Volume Visuals': folder({
      glowSpread: { value: 5.0, min: 1, max: 5, step: 0.1, label: 'Glow Spread' },
      fireHue: { value: 0, min: 0, max: 360, step: 1, label: 'Fire Hue Shift' },
      saturation: { value: 1.1, min: 0, max: 2, step: 0.05, label: 'Saturation' },
      fireStartColor: { value: '#ffe68c', label: 'Fire Start Color' },
      fireMidColor: { value: '#ff7305', label: 'Fire Mid Color' },
      fireEndColor: { value: '#ff0000', label: 'Fire End Color' },
    }),
    'Emitter Controls': folder({
      emitTemperature: { value: 5.5, min: 0, max: 8, label: 'Temperature Rate' },
      emitDensity: { value: 7.0, min: 0, max: 20, label: 'Density Rate' },
      motionBoost: { value: 0.25, min: 0, max: 0.4, step: 0.01, label: 'Movement Boost' },
      windStrength: { value: 6.5, min: 0, max: 50, step: 0.01, label: 'Movement Wind Strength' },
      teapotEmissive: { value: 0.2, min: 0, max: 1, step: 0.001, label: 'Teapot Emissive' },
    }),
    'Scattering & Shadows': folder({
      asymmetry: { value: 0.0, min: -0.99, max: 0.99, step: 0.01, label: 'Phase Asymmetry (g)' },
      powder: { value: 0.59, min: 0, max: 1, step: 0.01, label: 'Powder Effect' },
      multiScattering: { value: 1.0, min: 0, max: 1, step: 0.01, label: 'Multi Scattering' },
      shadowAbsorption: { value: 2.0, min: 0, max: 10, label: 'Shadow Absorption' },
      shadowAmbient: { value: 0.5, min: 0, max: 1, label: 'Shadow Ambient' },
    }),
    'Fluid Physics': folder({
      buoyancy: { value: 3.0, min: 0, max: 10, label: 'Buoyancy (Rise)' },
      velDamping: { value: 0.25, min: 0, max: 2, label: 'Velocity Damping' },
      fireLifespan: { value: 1.3, min: 0.5, max: 10, step: 0.1, label: 'Fire Lifespan' },
      smokeLifespan: { value: 3.5, min: 1, max: 100, step: 0.5, label: 'Smoke Lifespan' },
      turbulence: { value: 3.2, min: 0, max: 5, label: 'Turbulence Strength' },
      turbulenceDecay: { value: 0.1, min: 0, max: 1, step: 0.01, label: 'Turbulence Decay' },
      turbFrequency: { value: 10, min: 1, max: 10, label: 'Turbulence Frequency' },
    }),
    'Scene Lights': folder({
      keyLightIntensity: { value: 1000, min: 0, max: 1500, step: 1, label: 'Key Light Intensity' },
      lightSmoke: { value: 2.0, min: 0, max: 2, step: 0.001, label: 'Light Smoke' },
      lightNear: { value: 10.0, min: 0, max: 20, step: 0.05, label: 'Light Near Scale' },
      lightFar: { value: 15.0, min: 0, max: 20, step: 0.05, label: 'Light Far Scale' },
      lightReflection: { value: 10.0, min: 0, max: 20, step: 0.001, label: 'Light Reflection' },
      projRadius: { value: 20.0, min: 1, max: 30, step: 0.1, label: 'Proj Light Radius' },
      projFrequency: { value: 0.2, min: 0.1, max: 1, step: 0.01, label: 'Proj Light Freq' },
      projNoiseFade: { value: 17.0, min: 1, max: 30, step: 0.1, label: 'Proj Noise Fade Dist' },
      projCenterFade: { value: 3.25, min: 0.1, max: 5, step: 0.05, label: 'Proj Center Fade' },
    }),
    'Tone Mapping & Exposure': folder({
      toneMapping: { value: 'ACESFilmic', options: Object.keys(TONE_MAPPINGS), label: 'Tone Mapping' },
      exposure: { value: 2.0, min: 0.1, max: 2, step: 0.05, label: 'Exposure' },
    }),
  })

  // Scene setup: renderer state, camera, simulation, lights, controls and pipeline.
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
      exposure: renderer.toneMappingExposure,
      shadowType: renderer.shadowMap.type as ShadowMapType,
      transmitted: renderer.shadowMap.transmitted,
    }
    perspective.fov = 60
    perspective.near = 0.1
    perspective.far = 100
    perspective.position.set(14, 5.5, 4.4)
    perspective.updateProjectionMatrix()
    // The example's renderer: default PCF shadows with light transmission
    // through the volume's cast-shadow node; R3F's `shadows` picks PCFSoft.
    renderer.shadowMap.type = PCFShadowMap
    renderer.shadowMap.transmitted = true
    scene.background = new Color(0x000000)

    fire.current = createVolumeFire(renderer, scene, perspective, gl.domElement)

    return () => {
      fire.current?.dispose()
      fire.current = null
      scene.background = previous.background
      renderer.toneMapping = previous.toneMapping
      renderer.toneMappingExposure = previous.exposure
      renderer.shadowMap.type = previous.shadowType
      renderer.shadowMap.transmitted = previous.transmitted
      perspective.fov = previous.fov
      perspective.near = previous.near
      perspective.far = previous.far
      perspective.position.copy(previous.position)
      perspective.quaternion.copy(previous.quaternion)
      perspective.updateProjectionMatrix()
      perspective.updateMatrixWorld()
    }
  }, [gl, scene, camera])

  // Leva -> the example's params and uniforms. Only the denoise and bloom
  // toggles rebuild the pipeline, as the example's onChange handlers do.
  useLayoutEffect(() => {
    const current = fire.current
    if (!current) return
    const renderer = gl as unknown as WebGPURenderer
    const { params, uniforms: u } = current

    params.simulate = values.simulate
    params.simSpeed = values.simSpeed
    current.volumetricPass.setResolutionScale(values.resolution)

    current.volumetricMaterial.steps = values.steps
    u.denoiseStrength.value = values.denoiseStrength

    params.bloomStrength = values.bloomStrength
    params.bloomRadius = values.bloomRadius
    params.bloomThreshold = values.bloomThreshold
    if (params.denoise !== values.denoise || params.bloom !== values.bloom) {
      params.denoise = values.denoise
      params.bloom = values.bloom
      current.updatePostProcessing()
    }
    const bloomPass = current.bloomPass()
    if (bloomPass) {
      bloomPass.strength.value = values.bloomStrength
      bloomPass.radius.value = values.bloomRadius
      bloomPass.threshold.value = values.bloomThreshold
    }

    u.uFireGlowSpread.value = values.glowSpread
    params.fireHue = values.fireHue
    u.uFireHue.value = MathUtils.degToRad(values.fireHue)
    u.uSaturation.value = values.saturation
    u.uFireStartColor.value.set(values.fireStartColor)
    u.uFireMidColor.value.set(values.fireMidColor)
    u.uFireEndColor.value.set(values.fireEndColor)

    u.uEmitTemperature.value = values.emitTemperature
    u.uEmitDensity.value = values.emitDensity
    u.uMotionBoost.value = values.motionBoost
    u.uWindStrength.value = values.windStrength
    u.uTeapotEmissiveIntensity.value = values.teapotEmissive

    u.uAsymmetry.value = values.asymmetry
    u.uPowderStrength.value = values.powder
    u.uMultiScattering.value = values.multiScattering
    u.uShadowAbsorption.value = values.shadowAbsorption
    u.uShadowAmbient.value = values.shadowAmbient

    u.uBuoyancy.value = values.buoyancy
    u.uVelDamping.value = values.velDamping
    params.fireLifespan = values.fireLifespan
    params.smokeLifespan = values.smokeLifespan
    params.turbulence = values.turbulence
    u.uTurbulenceDecay.value = values.turbulenceDecay
    u.uTurbFrequency.value = values.turbFrequency

    current.keyLight.intensity = values.keyLightIntensity
    u.uPointLightVolumeIntensity.value = values.lightSmoke
    u.uLightNearIntensity.value = values.lightNear
    u.uLightFarIntensity.value = values.lightFar
    u.uPointLightSurfaceIntensity.value = values.lightReflection
    u.uPointLightProjectionRadius.value = values.projRadius
    u.uPointLightProjectionFrequency.value = values.projFrequency
    u.uPointLightProjectionNoiseFade.value = values.projNoiseFade
    u.uPointLightProjectionCenterFade.value = values.projCenterFade

    renderer.toneMapping = TONE_MAPPINGS[values.toneMapping] ?? ACESFilmicToneMapping
    renderer.toneMappingExposure = values.exposure
  }, [gl, scene, camera, values])

  // Positive priority takes over R3F's render loop, as the example's animate().
  useFrame((_, delta) => {
    const current = fire.current
    if (!current) return

    current.animate(delta)
    if (!published.current) {
      published.current = true
      setInfo('fire', 'volume')
    }
  }, 1)

  return null
}

function VolumeFireUnsupported() {
  useEffect(() => {
    // The simulation writes Storage3DTextures from compute shaders, which only
    // the WebGPU backend supports (the example itself requires WebGPU).
    // App's effect runs initLab() after child effects; publish on the next task.
    const timer = window.setTimeout(() => setInfo('fire', false), 0)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}

export default function VolumeFire() {
  const gl = useThree((state) => state.gl)
  return describeRenderer(gl).backend === 'webgpu' ? <VolumeFireContent /> : <VolumeFireUnsupported />
}
