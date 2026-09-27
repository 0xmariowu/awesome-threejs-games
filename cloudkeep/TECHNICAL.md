# Cloudkeep exploration implementation

The source authority is original release b28406d. All 68 tracked files are retained unchanged; no Arena source, assets, tests or entry path are included in the active snapshot.

- **Flight 3C:** `upstream/src/simulation.ts`, `input.ts`, `flight-camera.ts`. Simulation has no renderer dependency; pitched flight, strafe and altitude feed a camera with unwrapped drag angles, exponential smoothing and explicit recentering. Preserve original units and input ownership.
- **Ecosystem and persistence:** `simulation.ts`, `storage.ts`. Feeding, flocking, capture cancellation, delayed respawn and coins produce events. Save reconstruction preserves pending state and validates older/malformed input.
- **Visuals and feedback:** `atmosphere.ts`, `materials.ts`, `effects.ts`, `waterfalls.ts`, `audio.ts`, `music.ts`. Cloud layers, vertex deformation, bounded particles and event-driven sound remain separate from simulation. This release uses Three.js WebGL without the later Arena dependency on three.quarks.
- **Blender pipeline:** `scripts/build_assets.py`, `sky_creatures.py`, `modeling.py`, `art/cloudkeep.blend`. Retain vertex colors, animation pivots, material batching and near/far meshes. Regenerate into a separate directory to protect manual art.

The existing `../../webgame-lab/src/scenes/cloudkeep-cam.tsx` adapts the original camera for a walking fox, with different scale and target-yaw policy. It is not the complete flight controller. Four source-inspected candidates remain in `../catalog/extraction-candidates.json`; Arena is excluded.
