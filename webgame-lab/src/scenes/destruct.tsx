import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import { button, folder, useControls } from 'leva'
import {
  BoxGeometry,
  CylinderGeometry,
  EquirectangularReflectionMapping,
  Euler,
  IcosahedronGeometry,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { setInfo } from '../lab'

type Shape = 'auto' | 'sphere' | 'rock'

// Every target keeps an identity transform: three-bvh-csg writes its result in
// world space (a.matrixWorld is applied), so geometry is baked in place.
interface Target {
  brush: Brush
  build: () => BufferGeometry
  material: Material
}

// README: remove groups when multi-material input is not needed, so the only
// groups in a result are "original surface" and "cut face" (the cutter material).
function baked(geometry: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  geometry.clearGroups()
  return geometry.translate(x, y, z)
}

// A lumpy icosahedron. PolyhedronGeometry is non-indexed, so displacement is
// keyed by the vertex position to keep coincident corners welded (two-manifold).
function rockGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 1)
  const position = geometry.attributes.position
  const offsets = new Map<string, number>()
  const vertex = new Vector3()
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)
    const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)},${vertex.z.toFixed(4)}`
    let scale = offsets.get(key)
    if (scale === undefined) {
      // Deterministic hash noise so the rock is the same on every load.
      const h = Math.sin(vertex.x * 127.1 + vertex.y * 311.7 + vertex.z * 74.7) * 43758.5453
      scale = 0.78 + (h - Math.floor(h)) * 0.4
      offsets.set(key, scale)
    }
    vertex.multiplyScalar(scale)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }
  geometry.computeVertexNormals()
  return geometry
}

// Scripted cuts: [target index, point, surface normal, brush size]. The pillar
// bite is smaller than the pillar so its top does not float free.
const SCRIPTED: [number, [number, number, number], [number, number, number], number][] = [
  [1, [-1.7, 1.9, 0.3], [0, 0, 1], 0.8],
  [0, [2.4, 0, 3], [0, 1, 0], 0.8],
  [2, [-4.6, 1.3, 1.9], [0.4, 0, 0.92], 0.4],
]

export default function Destruct() {
  const { scene, camera, gl } = useThree()
  const cuts = useRef(0)
  const resetRef = useRef(() => {})
  const rockTurn = useRef(0)
  const environment = useLoader(HDRLoader, '/assets/kloofendal_48d_partly_cloudy_puresky_2k.hdr')
  const [color, normal, roughness, ao] = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
    '/assets/ground/Ground037_1K-JPG_Roughness.jpg',
    '/assets/ground/Ground037_1K-JPG_AmbientOcclusion.jpg',
  ])

  // One Evaluator and one cutter per brush shape, reused for every cut.
  // MeshStandardMaterial is converted to a node material by WebGPURenderer.
  const csg = useMemo(() => {
    const evaluator = new Evaluator()
    evaluator.attributes = ['position', 'uv', 'normal']
    evaluator.useGroups = true
    const interior = new MeshStandardMaterial({ color: '#4a4038', roughness: 1, metalness: 0 })
    const sphere = new Brush(new SphereGeometry(1, 24, 16), interior)
    const rock = new Brush(rockGeometry(), interior)

    const ground = new MeshStandardMaterial({ roughness: 1, metalness: 0 })
    const concrete = new MeshStandardMaterial({ color: '#b9b2a7', roughness: 0.85, metalness: 0 })
    const stone = new MeshStandardMaterial({ color: '#8c7f73', roughness: 0.8, metalness: 0 })
    const specs: Omit<Target, 'brush'>[] = [
      { build: () => baked(new BoxGeometry(18, 1.5, 18), 0, -0.75, 0), material: ground },
      { build: () => baked(new BoxGeometry(7, 3, 0.6), 0, 1.5, 0), material: concrete },
      { build: () => baked(new CylinderGeometry(0.4, 0.45, 3.2, 24), -4.8, 1.6, 1.5), material: stone },
      { build: () => baked(new CylinderGeometry(0.4, 0.45, 3.2, 24), 4.8, 1.6, 1.5), material: stone },
    ]
    const targets: Target[] = specs.map((spec) => {
      const brush = new Brush(spec.build(), spec.material)
      brush.castShadow = true
      brush.receiveShadow = true
      brush.updateMatrixWorld()
      return { ...spec, brush }
    })
    return { evaluator, interior, sphere, rock, targets, materials: [interior, ground, concrete, stone] }
  }, [])

  const [{ size, shape }] = useControls(() => ({
    Destruction: folder({
      size: { value: 0.8, min: 0.2, max: 2, step: 0.05, label: 'Brush size' },
      shape: { value: 'auto' as Shape, options: ['auto', 'sphere', 'rock'] as Shape[], label: 'Brush shape' },
      reset: button(() => resetRef.current()),
    }),
  }))

  const publish = useCallback(() => {
    let triangles = 0
    for (const { brush } of csg.targets) {
      const count = brush.geometry.index ? brush.geometry.index.count : brush.geometry.attributes.position.count
      triangles += Math.min(count, brush.geometry.drawRange.count) / 3
    }
    setInfo('csg', { ready: true, cuts: cuts.current, triangles })
  }, [csg])

  // Subtract a brush at a world point and replace the target's geometry.
  const cut = useCallback((index: number, point: Vector3, surface: Vector3, radius: number, pick: Shape) => {
    const target = csg.targets[index]
    const useRock = pick === 'rock' || (pick === 'auto' && Math.abs(surface.y) < 0.7)
    const cutter = useRock ? csg.rock : csg.sphere
    if (useRock) {
      // Sink the rock into the surface so it punches through a 0.6 m wall.
      cutter.position.copy(point).addScaledVector(surface, -0.3 * radius)
      const turn = rockTurn.current++
      cutter.quaternion.setFromEuler(new Euler(turn * 1.7, turn * 2.3, turn * 0.9))
    } else {
      // Lift the sphere a little so the crater is a shallow bowl.
      cutter.position.copy(point).addScaledVector(surface, 0.3 * radius)
      cutter.quaternion.identity()
    }
    cutter.scale.setScalar(radius)
    cutter.updateMatrixWorld()

    // Evaluate into a fresh Brush: in-place targets keep stale half-edge and
    // group caches (see Evaluator.assignBufferData TODO in 0.0.17).
    const result = csg.evaluator.evaluate(target.brush, cutter, SUBTRACTION)
    target.brush.geometry.dispose()
    target.brush.geometry = result.geometry
    target.brush.material = result.material
    cuts.current++
    publish()
  }, [csg, publish])

  resetRef.current = () => {
    for (const target of csg.targets) {
      target.brush.geometry.dispose()
      target.brush.geometry = target.build()
      target.brush.material = target.material
    }
    cuts.current = 0
    publish()
  }

  // Environment, textures and camera; restored on unmount like the look scene.
  useLayoutEffect(() => {
    const previous = {
      environment: scene.environment,
      background: scene.background,
      environmentIntensity: scene.environmentIntensity,
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
    }
    environment.mapping = EquirectangularReflectionMapping
    environment.needsUpdate = true
    scene.environment = environment
    scene.background = environment
    scene.environmentIntensity = 0.5

    for (const map of [color, normal, roughness, ao]) {
      map.wrapS = map.wrapT = RepeatWrapping
      map.repeat.set(8, 8)
      map.colorSpace = map === color ? SRGBColorSpace : NoColorSpace
      map.needsUpdate = true
    }
    const ground = csg.targets[0].material as MeshStandardMaterial
    ground.map = color
    ground.normalMap = normal
    ground.roughnessMap = roughness
    ground.aoMap = ao
    ground.needsUpdate = true

    // The page centre lands on the untouched middle of the wall.
    camera.position.set(0, 3.2, 9.5)
    const controls = new OrbitControls(camera, gl.domElement)
    controls.target.set(0, 1.4, 0)
    controls.maxPolarAngle = Math.PI * 0.48
    controls.update()

    return () => {
      controls.dispose()
      scene.environment = previous.environment
      scene.background = previous.background
      scene.environmentIntensity = previous.environmentIntensity
      camera.position.copy(previous.position)
      camera.quaternion.copy(previous.quaternion)
      camera.updateMatrixWorld()
    }
  }, [scene, camera, gl, environment, color, normal, roughness, ao, csg])

  // Scripted cuts so the first frame already shows holes and a crater.
  useEffect(() => {
    resetRef.current()
    for (const [index, point, surface, radius] of SCRIPTED) {
      cut(index, new Vector3(...point), new Vector3(...surface).normalize(), radius, 'auto')
    }
    return () => {
      for (const { brush } of csg.targets) brush.geometry.dispose()
      csg.sphere.geometry.dispose()
      csg.rock.geometry.dispose()
      for (const material of csg.materials) material.dispose()
      setInfo('csg', { ready: false, cuts: 0 })
    }
  }, [csg, cut])

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    const index = csg.targets.findIndex((target) => target.brush === event.object)
    if (index < 0 || !event.face) return
    // Targets have identity transforms, so the face normal is already in world space.
    cut(index, event.point.clone(), event.face.normal.clone(), size, shape)
  }

  return (
    <>
      <directionalLight
        position={[-6, 10, 7]}
        color="#fff2e3"
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-normalBias={0.02}
      />
      {csg.targets.map(({ brush }, index) => (
        <primitive key={index} object={brush} onClick={onClick} />
      ))}
    </>
  )
}
