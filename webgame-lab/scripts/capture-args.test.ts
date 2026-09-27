import { describe, expect, it } from 'vitest'
import { buildLabUrl, evaluateExpectations, parseCaptureArgs } from './capture-args'

const parse = (...args: string[]) => parseCaptureArgs(['--scene', 'demo-42', ...args])
const expectations = (...specs: string[]) => parse(...specs.flatMap((spec) => ['--expect', spec])).expects

describe('parseCaptureArgs', () => {
  it('requires a scene', () => {
    expect(() => parseCaptureArgs([])).toThrowError(/required.*--scene/i)
    expect(() => parseCaptureArgs(['--backend', 'webgl'])).toThrowError(/--scene/)
  })

  it('uses defaults with only a scene', () => {
    expect(parse()).toEqual({
      scene: 'demo-42', backend: 'webgpu', query: [], holds: [], presses: [], expects: [], expectFail: false, waitMs: 0,
    })
  })

  it.each(['', 'Demo', '../demo', 'demo_scene', 'two words'])('rejects scene %j', (scene) => {
    expect(() => parseCaptureArgs(['--scene', scene])).toThrowError(/--scene/)
  })

  it.each(['webgpu', 'webgpu-gl', 'webgl'])('accepts backend %s', (backend) => {
    expect(parse('--backend', backend).backend).toBe(backend)
  })

  it.each(['', 'vulkan', 'WEBGPU'])('rejects backend %j', (backend) => {
    expect(() => parse('--backend', backend)).toThrowError(/--backend/)
  })

  it('parses every flag and preserves repeated flags in their input order', () => {
    expect(parse(
      '--query', 'mode=a', '--hold', 'KeyW:2000', '--press', 'Space', '--expect', 'camera=free',
      '--query', 'mode=b=c', '--press', 'KeyR', '--hold', 'ArrowLeft:50',
      '--expect', 'moved:player.position', '--query', 'empty=', '--expect-fail', '--wait', '250',
    )).toEqual({
      scene: 'demo-42', backend: 'webgpu',
      query: [['mode', 'a'], ['mode', 'b=c'], ['empty', '']],
      holds: [{ code: 'KeyW', ms: 2000 }, { code: 'ArrowLeft', ms: 50 }],
      presses: ['Space', 'KeyR'],
      expects: [
        { kind: 'equals', path: 'camera', value: 'free', raw: 'camera=free' },
        { kind: 'moved', path: 'player.position', raw: 'moved:player.position' },
      ],
      expectFail: true,
      waitMs: 250,
    })
  })

  it.each([['0', 0], ['1000', 1000], ['30000', 30000]])('accepts wait %s', (wait, ms) => {
    expect(parse('--wait', wait).waitMs).toBe(ms)
  })

  it.each(['', '1.5', '1e3', 'abc', '-1', '-0', '+5', ' 5', '30001', '9007199254740992'])('rejects malformed wait %j', (wait) => {
    expect(() => parse('--wait', wait)).toThrowError(/--wait.*integer from 0 to 30000/)
  })

  it.each(['KeyW', 'KeyW:0', 'KeyW:-1', 'KeyW:1.5', 'KeyW:NaN', ':20', 'Key W:20', 'KeyW:2:3', 'KeyW:9007199254740992'])
    ('rejects malformed hold %j', (hold) => {
      expect(() => parse('--hold', hold)).toThrowError(/--hold.*positive integer/)
    })

  it.each(['', 'mode', '=value', ' =value'])('rejects malformed query %j', (query) => {
    expect(() => parse('--query', query)).toThrowError(/--query.*k=v/)
  })

  it.each(['', 'Key W', 'KeyW:100', '1'])('rejects malformed press %j', (press) => {
    expect(() => parse('--press', press)).toThrowError(/--press.*key code/)
  })

  it.each(['--scene', '--backend', '--query', '--hold', '--press', '--expect', '--wait'])('requires a value for %s', (flag) => {
    expect(() => parse(flag)).toThrowError(`Missing value for ${flag}`)
    expect(() => parse(flag, '--expect-fail')).toThrowError(`Missing value for ${flag}`)
  })

  it.each(['--unknown', 'extra', '--expect-fail=true'])('rejects unknown argument %s', (flag) => {
    expect(() => parse(flag)).toThrowError(/Unknown flag/)
  })

  it.each(['', 'camera', '=free', 'look..shadows=true', 'moved:', 'moved:player..position'])
    ('rejects malformed expectation %j', (spec) => {
      expect(() => parse('--expect', spec)).toThrowError(/--expect.*path=value or moved:path/)
    })

  it.each([
    ['look.shadows=true', 'look.shadows', true],
    ['enabled=false', 'enabled', false],
    ['instances=20000', 'instances', 20000],
    ['offset=-1.25', 'offset', -1.25],
    ['scale=2e3', 'scale', 2000],
    ['camera=free', 'camera', 'free'],
    ['label=', 'label', ''],
    ['label=a=b', 'label', 'a=b'],
    ['post=ao,bloom,tonemap', 'post', ['ao', 'bloom', 'tonemap']],
    ['values=1,true,false', 'values', [1, true, false]],
  ])('coerces %s', (raw, path, value) => {
    expect(expectations(raw as string)).toEqual([{ kind: 'equals', path, value, raw }])
  })
})

describe('evaluateExpectations', () => {
  it('checks dotted paths in after, preserves result order, and provides diagnostics', () => {
    const results = evaluateExpectations(
      expectations('look.shadows=true', 'camera=free', 'instances=20000'),
      { look: { shadows: false }, camera: 'fixed', instances: 20000 },
      { look: { shadows: true }, camera: 'free', instances: '20000' },
    )
    expect(results.map(({ raw, ok }) => ({ raw, ok }))).toEqual([
      { raw: 'look.shadows=true', ok: true },
      { raw: 'camera=free', ok: true },
      { raw: 'instances=20000', ok: false },
    ])
    expect(results.every(({ detail }) => detail.length > 0)).toBe(true)
  })

  it.each([
    [['tonemap', 'ao', 'bloom'], true],
    [['ao', 'bloom', 'tonemap', 'ao'], true],
    [['ao', 'bloom'], false],
    [['ao', 'bloom', 'tonemap', 'fxaa'], false],
    [['ao', 'bloom', 'fxaa'], false],
    ['ao,bloom,tonemap', false],
    [null, false],
  ])('compares array %j as a set', (post, ok) => {
    expect(evaluateExpectations(expectations('post=ao,bloom,tonemap'), {}, { post })[0].ok).toBe(ok)
  })

  it('ignores duplicates in expected sets and keeps element types', () => {
    expect(evaluateExpectations(expectations('values=1,true,1'), {}, { values: [true, 1] })[0].ok).toBe(true)
    expect(evaluateExpectations(expectations('values=1,true'), {}, { values: ['1', true] })[0].ok).toBe(false)
  })

  it.each([{}, { look: null }, { look: true }, { look: {} }])('fails on a missing nested path in %j', (after) => {
    expect(evaluateExpectations(expectations('look.shadows=true'), {}, after)[0])
      .toMatchObject({ ok: false, detail: expect.stringContaining('Missing path') })
  })

  it('does not resolve inherited properties as info paths', () => {
    expect(evaluateExpectations(expectations('toString=anything'), {}, {})[0].ok).toBe(false)
  })

  it.each([
    [{ x: 0, y: 0, z: 0 }, { x: 0.08, y: 0.08, z: 0 }],
    [[1, 2, 3], [1, 2, 3.2]],
    [{ x: 0, y: 0, z: 0 }, [0, 0, -1]],
  ])('detects Euclidean movement from %j to %j', (start, end) => {
    expect(evaluateExpectations(expectations('moved:player.position'),
      { player: { position: start } }, { player: { position: end } })[0])
      .toMatchObject({ raw: 'moved:player.position', ok: true, detail: expect.stringContaining('units') })
  })

  it.each([0, 0.05, 0.1])('fails movement of %s units at or below the threshold', (distance) => {
    expect(evaluateExpectations(expectations('moved:position'),
      { position: [0, 0, 0] }, { position: [distance, 0, 0] })[0].ok).toBe(false)
  })

  it.each([null, 'position', [0, 0], [0, 0, 0, 0], [0, NaN, 0], [0, Infinity, 0], { x: 0, y: 0 }, { x: '0', y: 0, z: 0 }])
    ('fails invalid positions %j in either snapshot', (position) => {
      const specs = expectations('moved:position')
      expect(evaluateExpectations(specs, { position }, { position: [1, 1, 1] })[0].ok).toBe(false)
      expect(evaluateExpectations(specs, { position: [0, 0, 0] }, { position })[0].ok).toBe(false)
    })

  it('fails movement when the path is missing in either snapshot', () => {
    const specs = expectations('moved:position')
    expect(evaluateExpectations(specs, {}, { position: [1, 2, 3] })[0])
      .toMatchObject({ ok: false, detail: expect.stringContaining('before snapshot') })
    expect(evaluateExpectations(specs, { position: [1, 2, 3] }, {})[0])
      .toMatchObject({ ok: false, detail: expect.stringContaining('after snapshot') })
  })

  it('returns no results when no expectations are supplied', () => {
    expect(evaluateExpectations([], {}, {})).toEqual([])
  })
})

describe('buildLabUrl', () => {
  it.each(['http://localhost:5173', 'http://localhost:5173/'])('builds the default URL from %s', (base) => {
    expect(buildLabUrl(base, parse())).toBe('http://localhost:5173/?scene=demo-42&backend=webgpu')
  })

  it('encodes query values and preserves duplicate keys and query order', () => {
    const options = parse('--backend', 'webgpu-gl', '--query', 'post=ao,bloom',
      '--query', 'label=a b&c=d#e', '--query', 'post=tonemap', '--query', 'empty=')
    expect(buildLabUrl('https://example.com/lab/', options)).toBe(
      'https://example.com/lab/?scene=demo-42&backend=webgpu-gl&post=ao%2Cbloom&label=a+b%26c%3Dd%23e&post=tonemap&empty=',
    )
  })
})
