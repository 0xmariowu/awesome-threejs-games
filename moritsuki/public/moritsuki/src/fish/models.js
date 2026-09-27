// 生き物のモデルの窓口（魚は fish.js、タコは octopus.js、イセエビは lobster.js、ウミガメは turtle.js）
export { buildFishGeometry, paintFishTexture, prepareFishTextures, fishAssets, makeFishMaterial, makeFishMesh } from './fish.js';
export { makeOctopusMesh, buildOctopusGeometry } from './octopus.js';
export { makeLobsterMesh, buildLobsterGeometry } from './lobster.js';
export { makeTurtle } from './turtle.js';
