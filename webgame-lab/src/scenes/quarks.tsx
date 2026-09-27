/*
 * Campfire, click explosions and a magic swirl built in code with
 * three.quarks 0.17.1 (MIT, Alchemist0823). Follows the package's own usage:
 * packages/quarks.examples (v0.17.0 tag; 0.17.1 has none) turbulenceDemo.js and
 * muzzleFlashDemo.js build each ParticleSystem from generators and behaviours,
 * rotate the emitter x = -PI/2 so cone emitters point up, add the emitter to the
 * scene, register it with batchRenderer.addSystem, and call
 * batchRenderer.update(delta) every frame. explosionDemo.js runs one-shot
 * effects with autoDestroy. Textures are drawn on a canvas instead of the
 * examples' texture atlas.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { button, useControls } from 'leva'
import {
  AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DodecahedronGeometry, DoubleSide, Fog, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, PointLight, RingGeometry, SRGBColorSpace,
  Vector3,
  type Material, type PerspectiveCamera,
} from 'three'
import {
  ApplyForce, BatchedRenderer, Bezier, CircleEmitter, ColorOverLife, ConeEmitter, ConstantColor, ConstantValue,
  Gradient, IntervalValue, Noise, OrbitOverLife, ParticleSystem, PiecewiseBezier, PointEmitter, RandomColor,
  RenderMode, RotationOverLife, SizeOverLife, SpeedOverLife, SphereEmitter,
  Vector3 as QVec3, Vector4 as QVec4,
} from 'three.quarks'
import { setInfo } from '../lab'
import { describeRenderer } from '../renderer'

const P = {
  skyColor: '#1b2238',
  groundColor: '#4a443c',
  fogNear: 18,
  fogFar: 60,
  groundSize: 200,

  cameraPosition: new Vector3(0, 5.5, 12),
  cameraTarget: new Vector3(0, 1.2, 0),
  cameraFov: 55,

  firePosition: new Vector3(-3, 0, 0.5),
  swirlPosition: new Vector3(3.2, 0, 0),
  // The capture clicks the screen centre, which lands near (0, 0, -3.4).
  scriptedExplosion: new Vector3(-0.8, 0, -6),
  // Clicks this close to the fire or swirl would bury them in smoke.
  clearRadius: 1.8,
}

// ── Canvas textures ──────────────────────────────────────────────────────────

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot create a 2D canvas for particle textures')
  draw(ctx)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

// Soft round dot: white core fading to transparent at the rim.
function softDotTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.8)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
}

// Streak along U: the stretched billboard shader lays U along the velocity.
function sparkStreakTexture() {
  return canvasTexture(64, 16, (ctx) => {
    const along = ctx.createLinearGradient(0, 0, 64, 0)
    along.addColorStop(0, 'rgba(255,255,255,0)')
    along.addColorStop(0.3, 'rgba(255,255,255,0.9)')
    along.addColorStop(0.7, 'rgba(255,255,255,1)')
    along.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = along
    ctx.fillRect(0, 0, 64, 16)
    // Fade the long edges so the streak has a soft width.
    ctx.globalCompositeOperation = 'destination-in'
    const across = ctx.createLinearGradient(0, 0, 0, 16)
    across.addColorStop(0, 'rgba(0,0,0,0)')
    across.addColorStop(0.5, 'rgba(0,0,0,1)')
    across.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = across
    ctx.fillRect(0, 0, 64, 16)
  })
}

// ── Generators shared by several systems ─────────────────────────────────────

const rgb = (r: number, g: number, b: number) => new QVec3(r, g, b)
const rgba = (r: number, g: number, b: number, a: number) => new QVec4(r, g, b, a)
const curve = (p1: number, p2: number, p3: number, p4: number) => new PiecewiseBezier([[new Bezier(p1, p2, p3, p4), 0]])
const white = () => new ConstantColor(rgba(1, 1, 1, 1))
const once = (count: number) => [{ time: 0, count: new ConstantValue(count), cycle: 1, interval: 0.01, probability: 1 }]

// Cone and circle emitters face local +Z; the examples tip them to face up.
function pointUp(system: ParticleSystem, y = 0) {
  system.emitter.rotation.x = -Math.PI / 2
  system.emitter.position.y = y
  return system
}

class QuarksVfx {
  readonly batch = new BatchedRenderer()
  readonly root = new Group()
  readonly dot = softDotTexture()
  readonly streak = sparkStreakTexture()
  readonly additiveDot = new MeshBasicMaterial({
    map: this.dot, blending: AdditiveBlending, transparent: true, side: DoubleSide,
  })
  readonly smokeDot = new MeshBasicMaterial({
    map: this.dot, blending: NormalBlending, transparent: true, side: DoubleSide,
  })
  readonly additiveStreak = new MeshBasicMaterial({
    map: this.streak, blending: AdditiveBlending, transparent: true, side: DoubleSide,
  })
  // Live-tuned by the Leva controls in the frame loop.
  readonly fireRate = new ConstantValue(90)
  readonly emberRate = new ConstantValue(12)
  readonly smokeRate = new ConstantValue(10)
  readonly swirlSpeed = new ConstantValue(2.5)
  private explosions: Group[] = []

  constructor() {
    this.buildCampfire()
    this.buildSwirl()
  }

  get systems() {
    return this.batch.systemToBatchIndex.size
  }

  private add(parent: Group, system: ParticleSystem) {
    parent.add(system.emitter)
    this.batch.addSystem(system)
    return system
  }

  private buildCampfire() {
    const fire = new Group()
    fire.position.copy(P.firePosition)
    this.root.add(fire)

    const flames = pointUp(new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: true,
      startLife: new IntervalValue(0.5, 1.0),
      startSpeed: new IntervalValue(1.2, 2.4),
      startSize: new IntervalValue(0.5, 0.9),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: white(),
      emissionOverTime: this.fireRate,
      shape: new ConeEmitter({ radius: 0.35, angle: 0.18, thickness: 1 }),
      material: this.additiveDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 2,
    }), 0.15)
    flames.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 0.9, 0.5), 0], [rgb(1, 0.45, 0.1), 0.4], [rgb(0.6, 0.1, 0.02), 1]],
      [[0, 0], [1, 0.1], [0.8, 0.5], [0, 1]],
    )))
    flames.addBehavior(new SizeOverLife(curve(0.8, 1, 0.7, 0.2)))
    flames.addBehavior(new RotationOverLife(new IntervalValue(-2, 2)))
    flames.addBehavior(new Noise(new ConstantValue(1.5), new ConstantValue(0.2)))
    this.add(fire, flames)

    const smoke = pointUp(new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: true,
      startLife: new IntervalValue(2.5, 4),
      startSpeed: new IntervalValue(0.8, 1.4),
      startSize: new IntervalValue(0.6, 1.1),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: new RandomColor(rgba(0.25, 0.24, 0.23, 0.35), rgba(0.4, 0.38, 0.36, 0.5)),
      emissionOverTime: this.smokeRate,
      shape: new ConeEmitter({ radius: 0.3, angle: 0.25, thickness: 1 }),
      material: this.smokeDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 0,
    }), 1.1)
    smoke.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 1, 1), 0], [rgb(1, 1, 1), 1]],
      [[0, 0], [1, 0.15], [0.6, 0.6], [0, 1]],
    )))
    smoke.addBehavior(new SizeOverLife(curve(0.6, 1.4, 2.2, 3)))
    smoke.addBehavior(new RotationOverLife(new IntervalValue(-0.5, 0.5)))
    smoke.addBehavior(new Noise(new ConstantValue(0.6), new ConstantValue(0.4)))
    this.add(fire, smoke)

    const embers = pointUp(new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: true,
      startLife: new IntervalValue(1.2, 2.4),
      startSpeed: new IntervalValue(1.5, 3),
      startSize: new IntervalValue(0.05, 0.1),
      startColor: white(),
      emissionOverTime: this.emberRate,
      shape: new ConeEmitter({ radius: 0.3, angle: 0.35, thickness: 1 }),
      material: this.additiveDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 3,
    }), 0.3)
    embers.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 0.8, 0.4), 0], [rgb(1, 0.35, 0.05), 1]],
      [[1, 0], [1, 0.6], [0, 1]],
    )))
    embers.addBehavior(new Noise(new ConstantValue(2), new ConstantValue(0.35)))
    this.add(fire, embers)
  }

  private buildSwirl() {
    const swirl = new Group()
    swirl.position.copy(P.swirlPosition)
    this.root.add(swirl)

    // Local space so OrbitOverLife spins the ring about the emitter's own axis;
    // after pointUp that local +Z axis is world up.
    const ring = pointUp(new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: false,
      startLife: new IntervalValue(2, 3.2),
      // Negative speed pulls particles in from the ring, so they spiral inward.
      startSpeed: new IntervalValue(-0.35, -0.1),
      startSize: new IntervalValue(0.18, 0.34),
      startColor: new RandomColor(rgba(0.55, 0.3, 1, 1), rgba(0.3, 0.85, 1, 1)),
      emissionOverTime: new ConstantValue(140),
      shape: new CircleEmitter({ radius: 1.5, thickness: 0.15 }),
      material: this.additiveDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 2,
    }), 0.15)
    ring.addBehavior(new OrbitOverLife(this.swirlSpeed, new QVec3(0, 0, 1)))
    ring.addBehavior(new ApplyForce(new QVec3(0, 0, 1), new ConstantValue(0.7)))
    ring.addBehavior(new SizeOverLife(curve(0.4, 1, 0.9, 0)))
    ring.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 1, 1), 0], [rgb(0.8, 0.7, 1), 1]],
      [[0, 0], [1, 0.15], [0.8, 0.7], [0, 1]],
    )))
    this.add(swirl, ring)

    const core = pointUp(new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: true,
      startLife: new IntervalValue(1, 1.8),
      startSpeed: new IntervalValue(1, 2),
      startSize: new IntervalValue(0.12, 0.28),
      startColor: new RandomColor(rgba(0.8, 0.9, 1, 1), rgba(0.7, 0.5, 1, 1)),
      emissionOverTime: new ConstantValue(40),
      shape: new ConeEmitter({ radius: 0.25, angle: 0.08, thickness: 1 }),
      material: this.additiveDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 2,
    }), 0.2)
    core.addBehavior(new SizeOverLife(curve(1, 0.9, 0.5, 0)))
    core.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 1, 1), 0], [rgb(1, 1, 1), 1]],
      [[1, 0], [0.8, 0.5], [0, 1]],
    )))
    this.add(swirl, core)
  }

  // One-shot burst at a ground point; every system auto-destroys when done.
  explode(at: Vector3) {
    const blast = new Group()
    blast.position.set(at.x, 0.05, at.z)
    this.root.add(blast)
    this.explosions.push(blast)
    const oneShot = { duration: 0.5, looping: false, autoDestroy: true, emissionOverTime: new ConstantValue(0) }

    const flash = new ParticleSystem({
      ...oneShot,
      worldSpace: false,
      startLife: new IntervalValue(0.15, 0.3),
      startSpeed: new ConstantValue(0),
      startSize: new IntervalValue(3, 5),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: new ConstantColor(rgba(1, 0.85, 0.6, 1)),
      emissionBursts: once(3),
      shape: new PointEmitter(),
      material: this.additiveDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 4,
    })
    flash.emitter.position.y = 0.8
    flash.addBehavior(new SizeOverLife(curve(0.5, 1.2, 1.4, 1.5)))
    flash.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 1, 1), 0], [rgb(1, 0.5, 0.15), 1]],
      [[1, 0], [0, 1]],
    )))
    this.add(blast, flash)

    const fireball = new ParticleSystem({
      ...oneShot,
      worldSpace: true,
      startLife: new IntervalValue(0.4, 0.9),
      startSpeed: new IntervalValue(1, 3),
      startSize: new IntervalValue(1, 2),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: white(),
      emissionBursts: once(30),
      shape: new SphereEmitter({ radius: 0.6, thickness: 1 }),
      material: this.additiveDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 3,
    })
    fireball.emitter.position.y = 0.8
    fireball.addBehavior(new SizeOverLife(curve(0.6, 1.2, 1.5, 1.6)))
    fireball.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 0.85, 0.5), 0], [rgb(1, 0.4, 0.08), 0.4], [rgb(0.4, 0.06, 0.02), 1]],
      [[1, 0], [0.8, 0.4], [0, 1]],
    )))
    fireball.addBehavior(new SpeedOverLife(curve(1, 0.4, 0.2, 0.1)))
    this.add(blast, fireball)

    const sparks = pointUp(new ParticleSystem({
      ...oneShot,
      worldSpace: true,
      startLife: new IntervalValue(0.6, 1.6),
      startSpeed: new IntervalValue(6, 14),
      startSize: new IntervalValue(0.08, 0.16),
      startColor: white(),
      emissionBursts: once(80),
      shape: new ConeEmitter({ radius: 0.2, angle: 1.2, thickness: 1 }),
      material: this.additiveStreak,
      renderMode: RenderMode.StretchedBillBoard,
      // SpriteBatch uploads velocity * speedFactor, so the streak length is
      // speed * speedFactor * size (muzzleFlashDemo.js uses 0.4).
      speedFactor: 0.5,
      renderOrder: 4,
    }), 0.2)
    sparks.addBehavior(new ApplyForce(new QVec3(0, -1, 0), new ConstantValue(12)))
    sparks.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 0.95, 0.7), 0], [rgb(1, 0.5, 0.1), 0.5], [rgb(0.8, 0.15, 0.02), 1]],
      [[1, 0], [1, 0.6], [0, 1]],
    )))
    this.add(blast, sparks)

    const smoke = pointUp(new ParticleSystem({
      ...oneShot,
      worldSpace: true,
      // The plume outlives the blast by several seconds, as real smoke does.
      startLife: new IntervalValue(5, 8),
      startSpeed: new IntervalValue(0.8, 2.5),
      startSize: new IntervalValue(1.2, 2.4),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: new RandomColor(rgba(0.32, 0.3, 0.28, 0.6), rgba(0.5, 0.47, 0.44, 0.75)),
      emissionBursts: once(30),
      shape: new ConeEmitter({ radius: 0.5, angle: 0.9, thickness: 1 }),
      material: this.smokeDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 1,
    }), 0.4)
    smoke.addBehavior(new SizeOverLife(curve(0.6, 1.4, 2, 2.2)))
    smoke.addBehavior(new SpeedOverLife(curve(1, 0.4, 0.2, 0.1)))
    smoke.addBehavior(new RotationOverLife(new IntervalValue(-0.6, 0.6)))
    smoke.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 1, 1), 0], [rgb(1, 1, 1), 1]],
      [[0, 0], [1, 0.05], [0.8, 0.6], [0, 1]],
    )))
    this.add(blast, smoke)

    // Smouldering bits left on the ground after the blast.
    const smoulder = pointUp(new ParticleSystem({
      ...oneShot,
      worldSpace: true,
      startLife: new IntervalValue(6, 9),
      startSpeed: new IntervalValue(0, 0.2),
      startSize: new IntervalValue(0.12, 0.22),
      startColor: white(),
      emissionBursts: once(70),
      shape: new CircleEmitter({ radius: 1.6, thickness: 1 }),
      material: this.additiveDot,
      renderMode: RenderMode.BillBoard,
      renderOrder: 3,
    }), 0.06)
    smoulder.addBehavior(new ColorOverLife(new Gradient(
      [[rgb(1, 0.7, 0.3), 0], [rgb(1, 0.3, 0.05), 0.5], [rgb(0.5, 0.08, 0.02), 1]],
      [[1, 0], [1, 0.7], [0, 1]],
    )))
    this.add(blast, smoulder)
  }

  // Auto-destroyed systems remove their own emitters; drop the empty groups.
  pruneExplosions() {
    this.explosions = this.explosions.filter((blast) => {
      if (blast.children.length > 0) return true
      this.root.remove(blast)
      return false
    })
  }

  dispose() {
    const live: ParticleSystem[] = []
    this.batch.systemToBatchIndex.forEach((_, system) => live.push(system as ParticleSystem))
    for (const system of live) system.dispose()
    for (const batch of this.batch.batches) {
      batch.dispose()
      ;(batch.material as Material).dispose()
    }
    this.additiveDot.dispose()
    this.smokeDot.dispose()
    this.additiveStreak.dispose()
    this.dot.dispose()
    this.streak.dispose()
  }
}

const LOGS = [0, 1, 2, 3].map((i) => ({ yaw: (i / 4) * Math.PI + 0.3, tilt: 0.25 }))
const STONES = Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2)

function publish(vfx: QuarksVfx) {
  setInfo('vfx', { lib: 'quarks', systems: vfx.systems, ready: vfx.systems > 0 })
}

function QuarksContent() {
  const { scene, camera } = useThree()
  const vfx = useMemo(() => new QuarksVfx(), [])
  // Explosions are queued and spawned in useFrame, next to batch.update.
  const queue = useRef<Vector3[]>([P.scriptedExplosion.clone()])
  const { fireRate, swirlSpeed } = useControls('VFX', {
    fireRate: { value: 90, min: 0, max: 300, step: 5, label: 'Fire intensity (per s)' },
    swirlSpeed: { value: 2.5, min: -8, max: 8, step: 0.1, label: 'Swirl speed (rad/s)' },
    explode: button(() => {
      queue.current.push(new Vector3((Math.random() - 0.5) * 6, 0, -3 - Math.random() * 4))
    }),
  })
  const lights = useMemo(() => {
    const fire = new PointLight('#ff8a3a', 25, 18, 2)
    fire.position.set(P.firePosition.x, 1.2, P.firePosition.z)
    const swirl = new PointLight('#8a6bff', 12, 12, 2)
    swirl.position.set(P.swirlPosition.x, 1, P.swirlPosition.z)
    const blast = new PointLight('#ffb060', 0, 30, 2)
    return { fire, swirl, blast }
  }, [])
  const set = useMemo(() => {
    const group = new Group()
    const bark = new MeshStandardMaterial({ color: '#4a3020', roughness: 0.9 })
    const stone = new MeshStandardMaterial({ color: '#5a5a5e', roughness: 1 })
    const glow = new MeshBasicMaterial({
      color: '#7a5cff', transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
    })
    const logGeo = new CylinderGeometry(0.12, 0.14, 1.4, 8)
    const stoneGeo = new DodecahedronGeometry(0.18)
    const ringGeo = new RingGeometry(1.35, 1.65, 64)
    for (const { yaw, tilt } of LOGS) {
      const log = new Mesh(logGeo, bark)
      log.position.set(P.firePosition.x, 0.18, P.firePosition.z)
      log.rotation.set(Math.PI / 2 - tilt, yaw, 0, 'YXZ')
      group.add(log)
    }
    for (const a of STONES) {
      const rock = new Mesh(stoneGeo, stone)
      rock.position.set(P.firePosition.x + Math.cos(a) * 0.95, 0.1, P.firePosition.z + Math.sin(a) * 0.95)
      rock.rotation.set(a, a * 2, 0)
      group.add(rock)
    }
    const ring = new Mesh(ringGeo, glow)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(P.swirlPosition.x, 0.02, P.swirlPosition.z)
    group.add(ring)
    const dispose = () => {
      for (const d of [bark, stone, glow, logGeo, stoneGeo, ringGeo]) d.dispose()
    }
    return { group, dispose }
  }, [])
  const flashAt = useRef(-99)
  const lastCount = useRef(-1)

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
    camera.position.copy(P.cameraPosition)
    camera.lookAt(P.cameraTarget)
    camera.updateMatrixWorld()
    // ParticleSystem.update disposes a system whose emitter is not under a
    // Scene, so the emitters and the batch renderer join the scene directly.
    scene.add(vfx.batch, vfx.root)

    return () => {
      scene.remove(vfx.batch, vfx.root)
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
  }, [scene, camera, vfx])

  useEffect(() => () => {
    vfx.dispose()
    set.dispose()
    setInfo('vfx', { lib: 'quarks', systems: 0, ready: false })
  }, [vfx, set])

  useEffect(() => {
    // App's effect runs initLab() after child effects and resets __LAB__.info;
    // publish on the next task so the value survives.
    const timer = window.setTimeout(() => publish(vfx), 0)
    return () => window.clearTimeout(timer)
  }, [vfx])

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime
    for (const at of queue.current.splice(0)) {
      vfx.explode(at)
      lights.blast.position.set(at.x, 1.2, at.z)
      flashAt.current = now
    }

    vfx.fireRate.value = fireRate
    vfx.emberRate.value = fireRate * 0.14
    vfx.smokeRate.value = fireRate * 0.11
    vfx.swirlSpeed.value = swirlSpeed

    vfx.batch.update(delta)
    vfx.pruneExplosions()

    const flicker = 0.8 + 0.2 * Math.sin(now * 17) * Math.sin(now * 7.3)
    lights.fire.intensity = 25 * flicker * Math.min(1, fireRate / 90)
    lights.blast.intensity = 120 * Math.exp(-(now - flashAt.current) * 6)

    if (vfx.systems !== lastCount.current) {
      lastCount.current = vfx.systems
      publish(vfx)
    }
  })

  const onGroundClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    const { x, z } = event.point
    const near = (p: Vector3) => (x - p.x) ** 2 + (z - p.z) ** 2 < P.clearRadius ** 2
    if (!near(P.firePosition) && !near(P.swirlPosition)) queue.current.push(new Vector3(x, 0, z))
  }

  return (
    <>
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#4a5680', '#1a1410', 1.2]} />
      <directionalLight position={[-10, 14, -6]} intensity={0.35} color="#9fb2ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onGroundClick}>
        <planeGeometry args={[P.groundSize, P.groundSize]} />
        <meshStandardMaterial color={P.groundColor} roughness={1} metalness={0} />
      </mesh>
      <primitive object={set.group} />
      <primitive object={lights.fire} />
      <primitive object={lights.swirl} />
      <primitive object={lights.blast} />
    </>
  )
}

// three.quarks builds GLSL ShaderMaterials, which WebGPURenderer cannot run;
// show only a dim ground there.
function WebGpuPlaceholder() {
  useEffect(() => {
    const timer = window.setTimeout(() => setInfo('vfx', {
      // Not 'quarks': no quarks system runs here, so a quarks check must fail.
      lib: 'none', systems: 0, ready: false, message: 'three.quarks needs the classic WebGL backend (?backend=webgl)',
    }), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color={P.groundColor} />
    </mesh>
  )
}

export default function Quarks() {
  const gl = useThree((state) => state.gl)
  return describeRenderer(gl).backend === 'webgl-classic' ? <QuarksContent /> : <WebGpuPlaceholder />
}
