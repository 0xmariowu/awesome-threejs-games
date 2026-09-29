# FABOTANIC: Technical & Runtime Architecture Audit

Source: <https://amix-design.com/tl/fab-botanic/>

## Overview & Architecture

FABOTANIC is a client-side procedural botanical generation engine and specimen explorer built on Three.js (r185). It allows artists and developers to procedurally synthesize complex 3D vegetation (trunks, stems, leaves, flowers) directly inside the browser and export optimized GLB files with LOD packaging.

### Key Components

1. **Procedural Geometry Engine (`index.html`)**:
   - Mulberry32 deterministic pseudo-random number generator for seed-based repeatability.
   - Algorithmic branch branching, phyllotaxis leaf placement, procedural bark noise synthesis via 2D Canvas generators.
   - Real-time wind distortion in custom vertex shader chunks (`#include <project_vertex>`).
   - Integrated client-side binary glTF encoder (`loadVerdantAsset`, `packageTreeLOD`, `exportGLTF`).

2. **Interactive 3D Ecology Gallery (`about.html` + `about/viewer.js`)**:
   - 4 full environment scenarios:
     - `forest` (森のはずれ): Zelkova, Oak, Cedar, Maple, Fern, Meadow clusters.
     - `meadow` (野の花の草原): Cherry, Zelkova, Oak, Poppy, Daisy, Yarrow.
     - `tropical` (南国の庭): Pinnate Palm, Fan Palm, Ficus, Splitleaf, Cycad, Succulents.
     - `lowpoly` (ローポリの丘): Stylized lowpoly trees, grass, ponds and terrain.
   - Dynamic 3-tier LOD system:
     - Near tier (`n-*.glb`): full detail meshes with normal mapping.
     - Mid tier (`m-*.glb`): simplified geometry for middle distances.
     - Far tier (`b-*.glb`): billboard impostors with desaturated atmosphere blending.
   - Multi-tile `InstancedMesh` batching (16m cells) reducing draw calls from thousands to single digits.

3. **Runtime Dependencies**:
   - `tl/common/libs/three/r185/build/three.module.min.js`: Three.js revision 185.
   - `tl/common/libs/three/r185/examples/jsm/loaders/GLTFLoader.js`: Binary glTF loader.
   - `tl/common/libs/three/r185/examples/jsm/utils/BufferGeometryUtils.js` & `SkeletonUtils.js`: Mesh assembly utilities.

4. **Offline Isolation & Security**:
   - Stripped Cloudflare `challenge-platform` JS injection (`/cdn-cgi/challenge-platform/scripts/jsd/main.js`).
   - The Cloudflare challenge/analytics script injected by the host was removed. The generator loads no external scripts; its guide, terms and author links point to the original site. Interface text was translated into Chinese/English; the original page is in provenance/original-text.
