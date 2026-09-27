// @ts-ignore -- Node built-ins are available at runtime; this browser project has no @types/node.
import { execFileSync } from 'node:child_process'
// @ts-ignore -- Node built-ins are available at runtime; this browser project has no @types/node.
import { existsSync } from 'node:fs'
// @ts-ignore -- Node built-ins are available at runtime; this browser project has no @types/node.
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
// @ts-ignore -- Node built-ins are available at runtime; this browser project has no @types/node.
import { join } from 'node:path'
// @ts-ignore -- Node built-ins are available at runtime; this browser project has no @types/node.
import nodeProcess from 'node:process'
// @ts-ignore -- Node built-ins are available at runtime; this browser project has no @types/node.
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const assets = join(root, 'public/assets')
const hdriId = 'kloofendal_48d_partly_cloudy_puresky'
const groundId = 'Ground037'
const foxUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb'
const kenneyPage = 'https://kenney.nl/assets/nature-kit'
const mapKinds = ['Color', 'NormalGL', 'Roughness', 'AmbientOcclusion']

async function getText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

async function getJson(url: string): Promise<unknown> {
  return JSON.parse(await getText(url)) as unknown
}

async function download(url: string, destination: string): Promise<void> {
  if (existsSync(destination)) {
    console.log(`skip ${destination.slice(root.length)}`)
    return
  }
  await mkdir(join(destination, '..'), { recursive: true })
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) throw new Error(`${url}: empty download`)
  const partial = `${destination}.part`
  try {
    await writeFile(partial, bytes)
    await rename(partial, destination)
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
  console.log(`downloaded ${destination.slice(root.length)} (${bytes.byteLength} bytes)`)
}

function triangleCount(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('Tree is not a glTF 2.0 GLB')
  }
  const jsonLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength) {
    throw new Error('Tree GLB has no valid JSON chunk')
  }
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as {
    accessors: { count: number }[]
    meshes: { primitives: { mode?: number; indices?: number; attributes: { POSITION: number } }[] }[]
  }
  let triangles = 0
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4) {
        throw new Error(`Tree has non-triangle primitive mode ${primitive.mode}`)
      }
      const accessor = gltf.accessors[primitive.indices ?? primitive.attributes.POSITION]
      if (!accessor || accessor.count % 3 !== 0) throw new Error('Tree has invalid triangle accessor count')
      triangles += accessor.count / 3
    }
  }
  return triangles
}

function row(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

async function main(): Promise<void> {
  await mkdir(assets, { recursive: true })

  const hdriListing = await getJson('https://api.polyhaven.com/assets?t=hdris') as Record<string, unknown>
  if (!Object.hasOwn(hdriListing, hdriId)) throw new Error(`Poly Haven HDRI ${hdriId} was not listed`)
  const hdriFiles = await getJson(`https://api.polyhaven.com/files/${hdriId}`) as {
    hdri?: Record<string, { hdr?: { url?: string } }>
  }
  const hdriUrl = hdriFiles.hdri?.['2k']?.hdr?.url
  if (!hdriUrl) throw new Error(`Poly Haven has no 2k HDR for ${hdriId}`)
  const hdriFile = `public/assets/${hdriId}_2k.hdr`
  await download(hdriUrl, join(root, hdriFile))

  const groundData = await getJson(`https://ambientcg.com/api/v2/full_json?id=${groundId}&include=downloadData`) as {
    foundAssets?: {
      assetId: string
      maps: string[]
      downloadFolders: { default: { downloadFiletypeCategories: { zip: {
        downloads: { attribute: string; downloadLink: string }[]
      } } } }
    }[]
  }
  const ground = groundData.foundAssets?.find((asset) => asset.assetId === groundId)
  const groundUrl = ground?.downloadFolders.default.downloadFiletypeCategories.zip.downloads
    .find((item) => item.attribute === '1K-JPG')?.downloadLink
  if (!groundUrl) throw new Error(`ambientCG has no 1K-JPG ZIP for ${groundId}`)
  if (!['color', 'normal', 'roughness', 'ambient-occlusion'].every((map) => ground.maps.includes(map))) {
    throw new Error(`${groundId} no longer lists all required PBR maps`)
  }
  const groundDir = join(assets, 'ground')
  await mkdir(groundDir, { recursive: true })
  const groundFiles = async () => (await readdir(groundDir)).filter((name: string) => name.endsWith('.jpg'))
  const hasMaps = (names: string[]) => mapKinds.every((kind) =>
    names.some((name) => name === `${groundId}_1K-JPG_${kind}.jpg`))
  if (!hasMaps(await groundFiles())) {
    const archive = join(assets, `${groundId}_1K-JPG.zip`)
    await download(groundUrl, archive)
    const requestedMaps = mapKinds.map((kind) => `${groundId}_1K-JPG_${kind}.jpg`)
    execFileSync('unzip', ['-n', '-q', archive, ...requestedMaps, '-d', groundDir])
    if (!hasMaps(await groundFiles())) throw new Error(`${groundId} ZIP lacks a required JPG map`)
    await rm(archive)
  } else {
    console.log('skip ground maps (already present)')
  }
  const selectedGroundFiles: string[] = (await groundFiles()).filter((name: string) =>
    mapKinds.some((kind) => name === `${groundId}_1K-JPG_${kind}.jpg`))

  const treeFile = 'public/assets/tree_default.glb'
  const treePath = join(root, treeFile)
  if (!existsSync(treePath)) {
    const kenneyHtml = await getText(kenneyPage)
    const match = kenneyHtml.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/nature-kit\/[^'"\s]+\/kenney_nature-kit\.zip/)
    if (!match) throw new Error('Kenney Nature Kit ZIP link was not found on its asset page')
    const archive = join(assets, 'kenney_nature-kit.zip')
    await download(match[0], archive)
    const entry = String(execFileSync('unzip', ['-Z1', archive])).split(/\r?\n/)
      .find((name) => /(?:^|\/)tree_default\.glb$/i.test(name))
    if (!entry) throw new Error('Kenney Nature Kit has no native tree_default.glb')
    const bytes = execFileSync('unzip', ['-p', archive, entry], { maxBuffer: 32 * 1024 * 1024 }) as Uint8Array
    const triangles = triangleCount(bytes)
    if (triangles >= 3000) throw new Error(`Kenney tree has ${triangles} triangles (limit: < 3000)`)
    await writeFile(treePath, bytes)
    await rm(archive)
    console.log(`downloaded ${treeFile} (${bytes.byteLength} bytes)`)
  } else {
    console.log(`skip ${treeFile}`)
  }
  const triangles = triangleCount(await readFile(treePath))
  if (triangles >= 3000) throw new Error(`Kenney tree has ${triangles} triangles (limit: < 3000)`)
  console.log(`tree_default.glb: ${triangles} triangles (GLB JSON accessor counts)`)

  const foxFile = 'public/assets/Fox.glb'
  await download(foxUrl, join(root, foxFile))

  const licenses = [
    '# Asset licenses',
    '',
    row(['asset', 'file', 'source URL', 'license', 'author/attribution']),
    row(['---', '---', '---', '---', '---']),
    row(['Kloofendal 48d Partly Cloudy (Pure Sky), 2K HDRI', hdriFile,
      `[Poly Haven](https://polyhaven.com/a/${hdriId}); [file](${hdriUrl})`,
      '[CC0](https://polyhaven.com/license)', 'Greg Zaal (original); Jarod Guest (sky edits)']),
    row(['Ground 037, 1K JPG PBR', selectedGroundFiles.map((name) => `public/assets/ground/${name}`).join('<br>'),
      `[ambientCG](https://ambientcg.com/view?id=${groundId}); [ZIP](${groundUrl})`,
      '[CC0](https://docs.ambientcg.com/license/)', 'ambientCG']),
    row(['Kenney Nature Kit tree_default, low-poly tree', `${treeFile} (${triangles} triangles)`,
      `[Kenney Nature Kit](${kenneyPage})`, '[CC0](https://creativecommons.org/publicdomain/zero/1.0/)',
      'Kenney']),
    row(['Fox (glTF-Binary)', foxFile,
      '[Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox); [file](' + foxUrl + ')',
      '[CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode) (model) AND [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode) (rigging, animation, glTF conversion)',
      'PixelMannen (model); tomkranis (rigging and animation); @AsoboStudio and @scurest (conversion to glTF)']),
    row(['Gaussian splat sample', 'none',
      '[Spark examples](https://github.com/sparkjsdev/spark/tree/main/examples); [Hugging Face Voxel51 dataset](https://huggingface.co/datasets/Voxel51/gaussian_splatting)',
      'no splat with an explicit license found under 30 MB',
      'Spark examples do not establish asset reuse rights; Voxel51 PLY files are Apache-2.0 but each exceeds 30 MB']),
    '',
  ].join('\n')
  await writeFile(join(root, 'LICENSES.md'), licenses)
  console.log('wrote LICENSES.md')
}

main().catch((error: unknown) => {
  console.error(error)
  nodeProcess.exitCode = 1
})
