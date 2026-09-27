export type Expectation =
  | { kind: 'equals'; path: string; value: unknown; raw: string }
  | { kind: 'moved'; path: string; raw: string }

export interface CaptureOptions {
  scene: string
  backend: 'webgpu' | 'webgpu-gl' | 'webgl'
  query: [string, string][]
  holds: { code: string; ms: number }[]
  presses: string[]
  expects: Expectation[]
  expectFail: boolean
  waitMs: number
}

function coerceValue(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return value
}

function parseExpectation(raw: string): Expectation {
  const separator = raw.indexOf('=')
  const moved = raw.startsWith('moved:')
  const path = moved ? raw.slice(6) : raw.slice(0, separator)
  if ((!moved && separator < 1) || !/^[\w$-]+(?:\.[\w$-]+)*$/.test(path)) {
    throw new Error(`Invalid --expect ${JSON.stringify(raw)}: use path=value or moved:path`)
  }
  if (moved) return { kind: 'moved', path, raw }
  const text = raw.slice(separator + 1)
  const value = text.includes(',') ? text.split(',').map(coerceValue) : coerceValue(text)
  return { kind: 'equals', path, value, raw }
}

function validateKeyCode(code: string, flag: string): void {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(code)) {
    throw new Error(`Invalid ${flag} key code ${JSON.stringify(code)}: expected a code such as KeyW or Space`)
  }
}

export function parseCaptureArgs(argv: string[]): CaptureOptions {
  const options: CaptureOptions = {
    scene: '', backend: 'webgpu', query: [], holds: [], presses: [], expects: [], expectFail: false, waitMs: 0,
  }
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    if (flag === '--expect-fail') {
      options.expectFail = true
      continue
    }
    if (!['--scene', '--backend', '--query', '--hold', '--press', '--expect', '--wait'].includes(flag)) {
      throw new Error(`Unknown flag ${JSON.stringify(flag)}`)
    }
    const value = argv[++index]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`)
    }
    switch (flag) {
      case '--scene':
        if (!/^[a-z0-9-]+$/.test(value)) {
          throw new Error(`Invalid --scene ${JSON.stringify(value)}: use lowercase letters, digits, or hyphens`)
        }
        options.scene = value
        break
      case '--backend':
        if (value !== 'webgpu' && value !== 'webgpu-gl' && value !== 'webgl') {
          throw new Error(`Invalid --backend ${JSON.stringify(value)}: expected webgpu, webgpu-gl, or webgl`)
        }
        options.backend = value
        break
      case '--query': {
        const separator = value.indexOf('=')
        if (separator < 1 || !value.slice(0, separator).trim()) {
          throw new Error(`Invalid --query ${JSON.stringify(value)}: expected k=v with a nonempty key`)
        }
        options.query.push([value.slice(0, separator), value.slice(separator + 1)])
        break
      }
      case '--hold': {
        const match = /^([A-Za-z][A-Za-z0-9]*):(\d+)$/.exec(value)
        const ms = match ? Number(match[2]) : NaN
        if (!match || !Number.isSafeInteger(ms) || ms <= 0) {
          throw new Error(`Invalid --hold ${JSON.stringify(value)}: expected KeyCode:ms with a positive integer duration`)
        }
        options.holds.push({ code: match[1], ms })
        break
      }
      case '--press':
        validateKeyCode(value, flag)
        options.presses.push(value)
        break
      case '--expect':
        options.expects.push(parseExpectation(value))
        break
      case '--wait': {
        const ms = /^\d+$/.test(value) ? Number(value) : NaN
        if (!Number.isSafeInteger(ms) || ms > 30_000) {
          throw new Error(`Invalid --wait ${JSON.stringify(value)}: expected an integer from 0 to 30000 milliseconds`)
        }
        options.waitMs = ms
        break
      }
    }
  }
  if (!options.scene) throw new Error('Required flag --scene is missing')
  return options
}

function readPath(info: Record<string, unknown>, path: string): { found: boolean; value: unknown } {
  let value: unknown = info
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) {
      return { found: false, value: undefined }
    }
    value = (value as Record<string, unknown>)[key]
  }
  return { found: true, value }
}

function position(value: unknown): number[] | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const object = value as Record<string, unknown>
  const coordinates = Array.isArray(value) ? value : [object.x, object.y, object.z]
  if (coordinates.length !== 3) return undefined
  return coordinates.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    ? coordinates as number[] : undefined
}

export function evaluateExpectations(
  expects: Expectation[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { raw: string; ok: boolean; detail: string }[] {
  return expects.map((expectation) => {
    const { raw, path } = expectation
    const actual = readPath(after, path)
    if (!actual.found) return { raw, ok: false, detail: `Missing path "${path}" in after snapshot` }
    if (expectation.kind === 'equals') {
      const expected = expectation.value
      let ok: boolean
      if (Array.isArray(expected)) {
        const expectedSet = new Set(expected)
        const actualSet = new Set(Array.isArray(actual.value) ? actual.value : [])
        ok = Array.isArray(actual.value) && expectedSet.size === actualSet.size
          && [...expectedSet].every((value) => actualSet.has(value))
      } else {
        ok = actual.value === expected
      }
      return {
        raw, ok,
        detail: `${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual.value)}`,
      }
    }
    const previous = readPath(before, path)
    if (!previous.found) return { raw, ok: false, detail: `Missing path "${path}" in before snapshot` }
    const start = position(previous.value)
    const end = position(actual.value)
    if (!start || !end) {
      return { raw, ok: false, detail: `${path}: expected finite {x,y,z} or [x,y,z] positions in both snapshots` }
    }
    const distance = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2])
    return { raw, ok: distance > 0.1, detail: `${path}: moved ${distance} units; required > 0.1` }
  })
}

export function buildLabUrl(base: string, o: CaptureOptions): string {
  const query = new URLSearchParams([['scene', o.scene], ['backend', o.backend], ...o.query])
  return `${base.replace(/\/+$/, '')}/?${query}`
}
