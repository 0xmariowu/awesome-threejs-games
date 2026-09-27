import { describe, expect, it, vi } from 'vitest'
import { createFpsSampler, initLab, listScenes, loadScene, markReady, setError, setInfo } from './lab'
import type { LabState } from './lab'

describe('lab state', () => {
  it('initializes all capture fields and returns the attached state', () => {
    const target: { __LAB__?: LabState } = {}
    const state = initLab(target)
    expect(target.__LAB__).toBe(state)
    expect(state).toEqual({
      ready: false, backend: null, scene: null, fps: null, info: {}, error: null,
    })
  })

  it('resets existing state with a fresh info object', () => {
    const target = {}
    const previous = initLab(target)
    setInfo('count', 42, target)
    markReady('webgpu', 'boot', target)
    setError('Failed', target)
    previous.fps = 60
    const reset = initLab(target)
    expect(reset).toEqual(initLab({}))
    expect(reset).not.toBe(previous)
    expect(reset.info).not.toBe(previous.info)
    expect(previous.info).toEqual({ count: 42 })
  })

  it('shallow-sets info without replacing state or unrelated fields', () => {
    const target: { __LAB__?: LabState } = {}
    setInfo('count', 1, target)
    const state = target.__LAB__!
    const details = { nested: true }
    setInfo('details', details, target)
    setInfo('count', 2, target)
    expect(target.__LAB__).toBe(state)
    expect(state.info).toEqual({ count: 2, details })
    expect(state.info.details).toBe(details)
    expect(state.ready).toBe(false)
  })

  it('marks a fresh target ready with its backend and scene', () => {
    const target: { __LAB__?: LabState } = {}
    markReady('webgpu', 'boot', target)
    expect(target.__LAB__).toMatchObject({ ready: true, backend: 'webgpu', scene: 'boot' })
    setInfo('count', 1, target)
    markReady('webgl', 'demo', target)
    expect(target.__LAB__).toMatchObject({
      ready: true, backend: 'webgl', scene: 'demo', info: { count: 1 },
    })
  })

  it('makes errors visible to capture even before initialization', () => {
    const target: { __LAB__?: LabState } = {}
    setError('Renderer failed', target)
    expect(target.__LAB__).toMatchObject({ ready: true, error: 'Renderer failed' })
  })

  it('preserves capture context when reporting an error', () => {
    const target = {}
    const state = initLab(target)
    markReady('webgpu', 'boot', target)
    setInfo('phase', 'render', target)
    setError('Frame failed', target)
    expect(state).toMatchObject({
      ready: true, backend: 'webgpu', scene: 'boot', info: { phase: 'render' }, error: 'Frame failed',
    })
  })
})

describe('createFpsSampler', () => {
  it('waits a full second and then measures 60 frames per second', () => {
    let time = 5000
    const sampler = createFpsSampler(() => time)
    expect(sampler.fps()).toBeNull()
    for (let frame = 1; frame <= 60; frame++) {
      time = 5000 + frame * 1000 / 60
      sampler.frame()
      if (frame < 60) expect(sampler.fps()).toBeNull()
    }
    expect(sampler.fps()).toBeCloseTo(60)
    expect(sampler.fps()).toBe(60)
  })

  it('drops old frames at the window boundary on both frames and idle reads', () => {
    let time = 0
    const sampler = createFpsSampler(() => time)
    sampler.frame()
    time = 500
    sampler.frame()
    time = 999
    expect(sampler.fps()).toBeNull()
    time = 1000
    sampler.frame()
    expect(sampler.fps()).toBe(2)
    time = 1500
    expect(sampler.fps()).toBe(1)
    time = 2000
    expect(sampler.fps()).toBe(0)
    time = 2500
    sampler.frame()
    expect(sampler.fps()).toBe(1)
  })

  it('reports zero after a full second without rendered frames', () => {
    let time = 0
    const sampler = createFpsSampler(() => time)
    time = 1000
    expect(sampler.fps()).toBe(0)
  })
})

describe('scene registry', () => {
  const FakeComp = () => null

  it('lists sorted basenames without importing scenes', () => {
    const boot = vi.fn(async () => ({ default: FakeComp }))
    const demo = vi.fn(async () => ({ default: FakeComp }))
    expect(listScenes({ './scenes/demo-42.tsx': demo, './scenes/boot.tsx': boot }))
      .toEqual(['boot', 'demo-42'])
    expect(boot).not.toHaveBeenCalled()
    expect(demo).not.toHaveBeenCalled()
    expect(listScenes({})).toEqual([])
  })

  it('loads only the requested scene and returns its default component', async () => {
    const boot = vi.fn(async () => ({ default: FakeComp }))
    const demo = vi.fn(async () => ({ default: () => null }))
    await expect(loadScene('boot', { './scenes/boot.tsx': boot, './scenes/demo.tsx': demo }))
      .resolves.toBe(FakeComp)
    expect(boot).toHaveBeenCalledExactlyOnceWith()
    expect(demo).not.toHaveBeenCalled()
  })

  it('rejects unknown scenes with sorted available names', async () => {
    const modules = {
      './scenes/demo.tsx': async () => ({ default: FakeComp }),
      './scenes/boot.tsx': async () => ({ default: FakeComp }),
    }
    await expect(loadScene('missing', modules)).rejects.toThrowError(
      'Unknown scene "missing". Available scenes: boot, demo',
    )
    await expect(loadScene('boot', {})).rejects.toThrowError('Available scenes: (none)')
  })

  it('propagates scene import failures', async () => {
    const error = new Error('Scene import failed')
    await expect(loadScene('boot', { './scenes/boot.tsx': async () => { throw error } }))
      .rejects.toBe(error)
  })

})
