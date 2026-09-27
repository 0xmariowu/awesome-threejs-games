import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three/webgpu'
import { setInfo } from '../lab'

export default function Boot() {
  const box = useRef<Mesh>(null)

  useEffect(() => {
    setInfo('scene', 'boot')
  }, [])

  useFrame((_, delta) => {
    if (box.current) {
      box.current.rotation.x += delta * 0.4
      box.current.rotation.y += delta * 0.6
    }
  })

  return (
    <>
      <hemisphereLight args={['white', 'grey', 1]} />
      <directionalLight position={[3, 5, 4]} intensity={3} castShadow />
      <mesh ref={box} position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="grey" />
      </mesh>
    </>
  )
}
