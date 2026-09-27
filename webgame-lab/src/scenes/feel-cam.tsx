import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import CameraControls from 'camera-controls'
import * as THREE from 'three'
import { setInfo } from '../lab'
import { FeelContent } from './feel'

CameraControls.install({ THREE })

function CameraMode() {
  const camera = useThree((state) => state.camera)
  const domElement = useThree((state) => state.gl.domElement)
  const controls = useRef<CameraControls | null>(null)

  useEffect(() => {
    setInfo('camera', 'follow')

    const disable = () => {
      if (!controls.current) return
      controls.current.enabled = false
      controls.current.dispose()
      controls.current = null
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyC' || event.repeat) return

      if (controls.current) {
        disable()
        setInfo('camera', 'follow')
        return
      }

      const player = window.__LAB__?.info.player
      if (!player || typeof player !== 'object'
        || !('x' in player) || !('y' in player) || !('z' in player)
        || typeof player.x !== 'number' || !Number.isFinite(player.x)
        || typeof player.y !== 'number' || !Number.isFinite(player.y)
        || typeof player.z !== 'number' || !Number.isFinite(player.z)) return

      const { x, y, z } = player
      const position = camera.position.clone()
      // Create only in free mode: follow mode never updates the camera here.
      const next = new CameraControls(camera, domElement)
      next.mouseButtons.left = CameraControls.ACTION.ROTATE
      next.mouseButtons.wheel = CameraControls.ACTION.DOLLY
      next.minDistance = 2
      next.maxDistance = 40
      void next.setLookAt(position.x, position.y, position.z, x, y, z, false)
      next.update(0)
      void next.setLookAt(x, y + 9, z - 12, x, y, z, true)
      controls.current = next
      setInfo('camera', 'free')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      disable()
    }
  }, [camera, domElement])

  useFrame((_, delta) => {
    if (!controls.current) return
    // Player writes at -1. R3F sorts ascending; 0 preserves automatic rendering.
    // update() reapplies the orbit pose even when its transition has settled.
    controls.current.update(delta)
    camera.updateMatrixWorld()
  }, 0)

  return null
}

export default function FeelCam() {
  return <><FeelContent /><CameraMode /></>
}
