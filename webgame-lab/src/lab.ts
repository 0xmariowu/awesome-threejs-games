import type { ComponentType } from 'react'

export interface LabState {
  ready: boolean
  backend: string | null
  scene: string | null
  fps: number | null
  info: Record<string, unknown>
  error: string | null
}

declare global {
  interface Window {
    __LAB__?: LabState
  }
}

type LabTarget = { __LAB__?: LabState }

export function initLab(target: LabTarget = window): LabState {
  target.__LAB__ = {
    ready: false,
    backend: null,
    scene: null,
    fps: null,
    info: {},
    error: null,
  }
  return target.__LAB__
}

export function setInfo(key: string, value: unknown, target: LabTarget = window): void {
  const state = target.__LAB__ ?? initLab(target)
  state.info[key] = value
}

export function markReady(backend: string, scene: string, target: LabTarget = window): void {
  const state = target.__LAB__ ?? initLab(target)
  state.backend = backend
  state.scene = scene
  state.ready = true
}

export function setError(message: string, target: LabTarget = window): void {
  const state = target.__LAB__ ?? initLab(target)
  state.error = message
  state.ready = true
}

export function createFpsSampler(now: () => number = () => performance.now()): {
  frame(): void
  fps(): number | null
} {
  const startedAt = now()
  const frames: number[] = []

  // Keep the half-open interval (time - 1000, time], including during idle reads.
  function prune(time: number): void {
    while (frames.length > 0 && frames[0] <= time - 1000) {
      frames.shift()
    }
  }

  return {
    frame() {
      const time = now()
      prune(time)
      frames.push(time)
    },
    fps() {
      const time = now()
      prune(time)
      return time - startedAt < 1000 ? null : frames.length
    },
  }
}

const sceneModules = import.meta.glob<{ default: ComponentType }>('./scenes/*.tsx')

export function listScenes(modules = sceneModules): string[] {
  return Object.keys(modules).map((path) => path.slice(path.lastIndexOf('/') + 1, -4)).sort()
}

export async function loadScene(name: string, modules = sceneModules): Promise<ComponentType> {
  const load = modules[`./scenes/${name}.tsx`]
  if (!load) {
    throw new Error(`Unknown scene "${name}". Available scenes: ${listScenes(modules).join(', ') || '(none)'}`)
  }
  return (await load()).default
}
