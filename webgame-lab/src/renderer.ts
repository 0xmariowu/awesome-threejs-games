import type { DefaultGLProps } from '@react-three/fiber/dist/declarations/src/core/renderer.js'
import { WebGLRenderer, type WebGLRendererParameters } from 'three'
import { WebGPURenderer, type WebGPURendererParameters } from 'three/webgpu'

export type Backend = 'webgpu' | 'webgpu-gl' | 'webgl'

export function parseLabParams(search: string): {
  backend: Backend
  scene: string
  query: URLSearchParams
} {
  const query = new URLSearchParams(search)
  const backend = query.get('backend') ?? 'webgpu'
  if (backend !== 'webgpu' && backend !== 'webgpu-gl' && backend !== 'webgl') {
    throw new Error(`Invalid backend "${backend}". Allowed values: webgpu, webgpu-gl, webgl`)
  }

  const scene = query.get('scene') ?? 'boot'
  if (!/^[a-z0-9-]+$/.test(scene)) {
    throw new Error(`Invalid scene "${scene}". Expected lowercase letters, digits, or hyphens`)
  }

  return { backend, scene, query }
}

export function createRendererFactory(backend: Backend) {
  return async (props: DefaultGLProps): Promise<WebGPURenderer | WebGLRenderer> => {
    const options = { ...props, antialias: true }
    // R3F's canvas type is broader than Three's; its documented async gl
    // example likewise adapts the default props at the constructor boundary.
    if (backend === 'webgl') {
      return new WebGLRenderer(options as WebGLRendererParameters)
    }

    const renderer = new WebGPURenderer({
      ...options,
      ...(backend === 'webgpu-gl' ? { forceWebGL: true } : {}),
    } as WebGPURendererParameters)
    await renderer.init()
    return renderer
  }
}

export function describeRenderer(renderer: object): {
  backend: 'webgpu' | 'webgl2' | 'webgl-classic'
} {
  if ('backend' in renderer) {
    const backend = renderer.backend
    if (typeof backend === 'object' && backend !== null) {
      if ('isWebGPUBackend' in backend && backend.isWebGPUBackend === true) {
        return { backend: 'webgpu' }
      }
      if ('isWebGLBackend' in backend && backend.isWebGLBackend === true) {
        return { backend: 'webgl2' }
      }
    }
    throw new Error('Unrecognized renderer backend')
  }
  return { backend: 'webgl-classic' }
}
