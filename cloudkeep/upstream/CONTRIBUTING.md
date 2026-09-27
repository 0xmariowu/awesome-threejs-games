# Contributing

Use Node.js 22.12 or newer. Runtime models and textures are checked in, so Blender
is only needed when changing or regenerating the 3D assets.

```sh
npm ci
npm run dev
```

Before opening a pull request:

```sh
npm test
npm run build
```

For gameplay changes, exercise flight, capture, coin collection, pause/resume and
save/reload in a WebGL 2 browser. For visual changes, include a screenshot from the
normal chase camera. Keep the simulation independent of rendering and preserve
existing saves where practical.

Asset authoring lives in `scripts/`. Run `npm run assets` with Blender installed
and include the regenerated runtime GLBs and manifest with relevant modeling changes.
Keep manual Blender edits in a separate file before regeneration.

Do not commit local saves, credentials, dependency folders, build output or videos.
Demonstration videos are distributed as GitHub release assets.
