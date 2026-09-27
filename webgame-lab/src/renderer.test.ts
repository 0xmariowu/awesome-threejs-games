import type { GLProps } from '@react-three/fiber'
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { WebGLRenderer } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { createRendererFactory, describeRenderer, parseLabParams } from './renderer'

vi.mock('three/webgpu', () => ({
  WebGPURenderer: vi.fn(class {
    init = vi.fn(async () => {})
  }),
}))

vi.mock('three', () => ({
  WebGLRenderer: vi.fn(class {}),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parseLabParams', () => {
  it('defaults to webgpu and boot and returns the query', () => {
    const result = parseLabParams('')
    expect(result.backend).toBe('webgpu')
    expect(result.scene).toBe('boot')
    expect(result.query).toBeInstanceOf(URLSearchParams)
    expect(result.query.toString()).toBe('')
  })

  it.each(['webgpu', 'webgpu-gl', 'webgl'] as const)('accepts %s', (backend) => {
    const result = parseLabParams(`?backend=${backend}&scene=demo-42&extra=a&extra=b`)
    expect(result.backend).toBe(backend)
    expect(result.scene).toBe('demo-42')
    expect(result.query.getAll('extra')).toEqual(['a', 'b'])
  })

  it.each(['vulkan', 'WEBGPU', ''])('rejects backend %j and names allowed values', (backend) => {
    expect(() => parseLabParams(`?backend=${backend}`)).toThrowError(
      'Allowed values: webgpu, webgpu-gl, webgl',
    )
  })

  it.each(['', 'Boot', 'demo_scene', '../boot', 'two words', '场景'])('rejects scene %j', (scene) => {
    expect(() => parseLabParams(`?scene=${encodeURIComponent(scene)}`)).toThrowError('Invalid scene')
  })
})

describe('createRendererFactory', () => {
  const canvas = new EventTarget()
  const props = { canvas, antialias: false, alpha: false }

  it('is assignable to the R3F Canvas gl prop', () => {
    expectTypeOf<ReturnType<typeof createRendererFactory>>().toExtend<GLProps>()
  })

  it.each(['webgpu', 'webgpu-gl'] as const)('constructs and initializes %s', async (backend) => {
    const renderer = await createRendererFactory(backend)(props)
    expect(WebGPURenderer).toHaveBeenCalledExactlyOnceWith({
      ...props,
      antialias: true,
      ...(backend === 'webgpu-gl' ? { forceWebGL: true } : {}),
    })
    expect(renderer).toBe(vi.mocked(WebGPURenderer).mock.instances[0])
    expect((renderer as WebGPURenderer).init).toHaveBeenCalledOnce()
    expect(WebGLRenderer).not.toHaveBeenCalled()
    expect(props.antialias).toBe(false)
  })

  it('waits for initialization before resolving', async () => {
    let finishInitialization!: () => void
    const initialization = new Promise<void>((resolve) => {
      finishInitialization = resolve
    })
    const init = vi.fn(() => initialization)
    vi.mocked(WebGPURenderer).mockImplementationOnce(function () {
      return { init } as unknown as WebGPURenderer
    })
    const resolved = vi.fn()
    const result = createRendererFactory('webgpu')(props).then(resolved)
    await Promise.resolve()
    expect(init).toHaveBeenCalledOnce()
    expect(resolved).not.toHaveBeenCalled()
    finishInitialization()
    await result
    expect(resolved).toHaveBeenCalledExactlyOnceWith({ init })
  })

  it('propagates initialization failures', async () => {
    const error = new Error('Initialization failed')
    vi.mocked(WebGPURenderer).mockImplementationOnce(function () {
      return { init: vi.fn().mockRejectedValue(error) } as unknown as WebGPURenderer
    })
    await expect(createRendererFactory('webgpu')(props)).rejects.toBe(error)
  })

  it('constructs the classic renderer without initialization', async () => {
    const renderer = await createRendererFactory('webgl')(props)
    expect(WebGLRenderer).toHaveBeenCalledExactlyOnceWith({ ...props, antialias: true })
    expect(renderer).toBe(vi.mocked(WebGLRenderer).mock.instances[0])
    expect(WebGPURenderer).not.toHaveBeenCalled()
  })
})

describe('describeRenderer', () => {
  it.each([
    [{ isWebGPURenderer: true, backend: { isWebGPUBackend: true } }, 'webgpu'],
    [{ isWebGPURenderer: true, backend: { isWebGPUBackend: false, isWebGLBackend: true } }, 'webgl2'],
    [{ isWebGLRenderer: true }, 'webgl-classic'],
  ] as const)('describes %j as %s', (renderer, backend) => {
    expect(describeRenderer(renderer)).toEqual({ backend })
  })

  it('rejects an unrecognized backend', () => {
    expect(() => describeRenderer({ backend: {} })).toThrowError('Unrecognized renderer backend')
  })
})
