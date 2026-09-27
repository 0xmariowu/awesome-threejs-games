# Art provenance and prompt set

All 3D models are original Blender meshes authored by `scripts/build_assets.py`
and `scripts/sky_creatures.py`, with mesh utilities in `scripts/modeling.py`.
No other game implementation or assets were copied. The visual concept and sky
were generated using the built-in Image Gen tool.

## Concept brief

Create a full primary gameplay screen for Cloudkeep, a playable 3D browser game.
Third-person camera behind a tiny wooden airship; yellow and ivory striped
balloon, brass propellers, teal gondola, friendly coral cloud rays and blue sky
whales, pale limestone floating gardens with a lighthouse. An airy cyan sky and
warm clouds frame the world. Dark teal serif wordmark top left, thin compass top
center, pearls/workshop/pause top right, objective lower left, native keyboard
control strip bottom center and a delicate circular radar bottom right. Use a
cohesive stylized Blender-rendered world with tactile materials and warm light.
All interface text and controls remain native HTML. Landscape 1536 x 1024.

Saved as `concept.png`.

## Production sky brief

Use the concept as a style reference. Generate a standalone 2:1 equirectangular
sky panorama: luminous pale cyan-blue sky, soft painterly ivory cumulus clouds,
warm light, seamless left and right edges. Remove all UI, ships, creatures,
islands, vegetation, landmarks and text. The scene's real 3D models render in
front of this image.

Final refinement: keep the top 72 percent mostly clear blue sky and move the
billowing cloud band into the lower 28 percent; no visible sun. The renderer
reframes the panorama latitude so clouds sit below the floating islands.

Saved as `../public/assets/sky.png`. The current renderer uses this panorama
for reflection lighting; the visible sky is the procedural atmosphere and
layered transparent cloud billows.

## Visual rebuild assets

The September 15 rebuild replaces the complete model library. It adds sewn
balloon panels, crafted timber and brass details, continuous whale skin,
tapered ray wings with painted markings, curved flukes, layered blinking eyes,
and four distinct garden compositions. Each export preserves vertex colors and
batches meshes by material and animation pivot.
Masonry retains its crafted edges; limestone cliffs use rounded continuous
profiles and smooth normals. Dense near gardens
include lobed canopies, rim shrubs and trailing ivy; four reduced distant models
retain the same silhouettes at a lower rendering cost.

`cloud-billow.png` is a generated RGBA production texture with true transparency.
Brief: one isolated asymmetrical cumulus formation, warm top-left sunlight,
cream highlights, cool blue-gray shadow pockets, translucent wisps and fine
billowing detail; no sky rectangle, scene objects, text or watermark. The
runtime varies scale, horizontal reflection and orientation among world-space
billboards. These complement the procedurally rendered moving cloud volume.

## Intentional adaptations

- Native, fully rotatable Blender models replace raster characters and terrain.
- Botanical detail uses authored olive branches, leaf sprays, cypress boughs,
  wildflowers and hanging vines, batched for real-time rendering.
- The introductory screen and functional dialogs extend the gameplay HUD's
  typography and palette. The active game retains the reference HUD placement.
- The large objective panel was removed after live review. Restoration progress
  and requirements remain in the workshop; currency reflects actual rewards.
- Sun moths, sky koi and cloud jellies join rays and whales, with lantern birds
  unlocked in the workshop. Their authored wings, fins and tendrils animate in 3D.
- Initial currency is zero and sound is optional; the image's resource value
  represents a later game state.
