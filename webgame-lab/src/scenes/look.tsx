import { useLayoutEffect, useRef } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { folder, useControls } from 'leva'
import {
  EquirectangularReflectionMapping,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type DirectionalLight,
} from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { setInfo } from '../lab'

export function LookContent() {
  const { scene, camera, gl } = useThree()
  const sun = useRef<DirectionalLight>(null)
  const {
    sunElevation, sunAzimuth, sunIntensity, sunColor,
    environmentIntensity, backgroundIntensity, backgroundBlurriness, shadows,
  } = useControls({
    Light: folder({
      sunElevation: {
        value: Math.atan2(9, Math.hypot(-5, 5)) * 180 / Math.PI,
        min: 5, max: 85, step: 0.1, label: 'Sun elevation (°)',
      },
      sunAzimuth: { value: 315, min: 0, max: 360, step: 0.1, label: 'Sun azimuth (°)' },
      sunIntensity: { value: 3, min: 0, max: 10, step: 0.1, label: 'Sun intensity' },
      sunColor: { value: '#fff2e3', label: 'Sun color' },
      environmentIntensity: { value: 0.5, min: 0, max: 3, step: 0.01, label: 'Environment intensity' },
      backgroundIntensity: { value: 1, min: 0, max: 3, step: 0.01, label: 'Background intensity' },
      backgroundBlurriness: { value: 0, min: 0, max: 1, step: 0.01, label: 'Background blurriness' },
      shadows: { value: true, label: 'Shadows' },
    }),
  })
  // Orbit the origin at the original distance; azimuth runs from +Z toward +X.
  // These defaults reconstruct [-5, 9, 5] without rounding the elevation.
  const radius = Math.hypot(-5, 9, 5)
  const elevation = sunElevation * Math.PI / 180
  const azimuth = sunAzimuth * Math.PI / 180
  const sunPosition: [number, number, number] = [
    radius * Math.cos(elevation) * Math.sin(azimuth),
    radius * Math.sin(elevation),
    radius * Math.cos(elevation) * Math.cos(azimuth),
  ]
  // useLoader suspends the scene until the HDR and all four ground maps load.
  const environment = useLoader(HDRLoader, '/assets/kloofendal_48d_partly_cloudy_puresky_2k.hdr')
  const [color, normal, roughness, ao] = useLoader(TextureLoader, [
    '/assets/ground/Ground037_1K-JPG_Color.jpg',
    '/assets/ground/Ground037_1K-JPG_NormalGL.jpg',
    '/assets/ground/Ground037_1K-JPG_Roughness.jpg',
    '/assets/ground/Ground037_1K-JPG_AmbientOcclusion.jpg',
  ])

  useLayoutEffect(() => {
    const previousEnvironment = scene.environment
    const previousBackground = scene.background
    const previousIntensity = scene.environmentIntensity
    const previousBackgroundIntensity = scene.backgroundIntensity
    const previousBackgroundBlurriness = scene.backgroundBlurriness
    const previousPosition = camera.position.clone()
    const previousQuaternion = camera.quaternion.clone()

    environment.mapping = EquirectangularReflectionMapping
    environment.needsUpdate = true
    scene.environment = environment
    scene.background = environment

    for (const map of [color, normal, roughness, ao]) {
      map.wrapS = map.wrapT = RepeatWrapping
      map.repeat.set(8, 8)
      map.colorSpace = map === color ? SRGBColorSpace : NoColorSpace
      map.needsUpdate = true
    }

    camera.position.set(7, 4.8, 10)
    camera.lookAt(0, 1, 0)
    camera.updateMatrixWorld()

    return () => {
      scene.environment = previousEnvironment
      scene.background = previousBackground
      scene.environmentIntensity = previousIntensity
      scene.backgroundIntensity = previousBackgroundIntensity
      scene.backgroundBlurriness = previousBackgroundBlurriness
      camera.position.copy(previousPosition)
      camera.quaternion.copy(previousQuaternion)
      camera.updateMatrixWorld()
      // Textures belong to useLoader's cache and can be reused by variant scenes.
      setInfo('look', { hdri: false, shadows: false, loaded: false })
    }
  }, [scene, camera, environment, color, normal, roughness, ao])

  // r186 supports these scene properties. Live controls must not rerun asset
  // setup (needsUpdate) or reset the camera used by the feel variants.
  useLayoutEffect(() => {
    scene.environmentIntensity = environmentIntensity
    scene.backgroundIntensity = backgroundIntensity
    scene.backgroundBlurriness = backgroundBlurriness
    setInfo('look', {
      hdri: true,
      loaded: true,
      shadows: sun.current?.castShadow === true && gl.shadowMap.enabled,
      sunElevation, sunAzimuth, sunIntensity, sunColor,
      sunPosition: sun.current?.position.toArray(),
      environmentIntensity, backgroundIntensity, backgroundBlurriness,
    })
  }, [scene, gl, environment, sunElevation, sunAzimuth, sunIntensity, sunColor,
    environmentIntensity, backgroundIntensity, backgroundBlurriness, shadows])

  return (
    <>
      <directionalLight
        ref={sun}
        position={sunPosition}
        color={sunColor}
        intensity={sunIntensity}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-normalBias={0.02}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial
          map={color}
          normalMap={normal}
          roughnessMap={roughness}
          aoMap={ao}
          roughness={1}
          metalness={0}
        />
      </mesh>
      <mesh position={[-2.5, 1, 0]} castShadow receiveShadow>
        <sphereGeometry args={[1, 64, 32]} />
        <meshStandardMaterial color="#d5dce4" metalness={1} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.9, 0.5]} rotation={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <meshStandardMaterial color="#bb5935" metalness={0} roughness={0.9} />
      </mesh>
      <mesh position={[2.6, 1.25, -0.5]} castShadow receiveShadow>
        <torusKnotGeometry args={[0.75, 0.25, 128, 24]} />
        <meshStandardMaterial color="#176c78" metalness={0} roughness={0.12} />
      </mesh>
    </>
  )
}

export default function Look() {
  return <LookContent />
}
