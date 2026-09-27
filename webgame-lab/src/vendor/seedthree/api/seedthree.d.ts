// Type surface for the vendored SeedThree API (seedthree.js beside this file),
// limited to what src/scenes/plants.tsx uses. Shapes follow the JSDoc and return
// values in seedthree.js @ 85787bf; the .js itself is vendored unchanged.
import type { Light, LOD, Object3D, Texture } from 'three/webgpu'

export type LoadTexture = (path: string, opts: { srgb: boolean }) => Promise<Texture | null>

export interface SeedThreeStats {
  summary: {
    lodCount: number
    widthMeters?: number
    heightMeters?: number
    depthMeters?: number
    lod0Triangles: number
  }
  perLod: { name: string; distance: number; meshes: number; instances: number; triangles: number; verts: number }[]
  boundingBox: { min: number[]; max: number[] } | null
}

export function createTree(options: {
  species: string
  seed?: number
  controls?: Record<string, unknown>
  lod?: Record<string, unknown>
  loadTexture?: LoadTexture
  assetsDir?: string
  sunLight?: Light | null
  level?: string | null
}): Promise<{ object: Object3D; group: LOD; stats: SeedThreeStats; assets: Record<string, unknown> }>

export function setWind(options?: { strength?: number; speed?: number }): { strength: number; speed: number }
