# An AI-operated 3D Web game reference library

The useful unit is a **verified capability with its original example**, not a
folder of vaguely related code. Gameref now contains 15 references. The existing
`../webgame-lab` has 45 catalog entries and 45 scene modules, including substantial
Inkwave adaptations and a Cloudkeep camera adaptation. Connect them through one
capability index while preserving their different purposes and existing files.

This is an implementation proposal grounded in local source inspection. The
62-entry candidate index and per-project analysis exist now. A replacement UI,
new reusable packages, new AI services and repository merging are not implemented.

## Four linked records

| Record | Authority | What an AI should receive |
| --- | --- | --- |
| Original reference | Preserved source/assets/build with hashes | Exact run command, original entry, source revision, observed behavior, missing services |
| Source explanation | Annotation tied to original file hash | Mechanism, symbols/locations, dependencies, state/units, known uncertainty |
| Extracted example | Separate adapter and minimal runnable fixture | Inputs/outputs, lifecycle, required renderer/version/assets, migration changes and tests |
| Composition recipe | Two or more proven examples used together | Compatibility, ownership rules, order of operations and integration evidence |

Do not promote a candidate directly to a package because it looks good in the
browser. A production bundle is recoverable deployed code, not the author's
original module tree. Pretty-printing helps reading but does not restore types,
names, comments or build configuration. Everdrift's extracted GDC is bytecode;
its readable Godot shaders are a different source-availability level. Cloudkeep,
Sakuragaoka and Tidewater provide actual source trees. Preserve these distinctions.

## What exists and what to add next

`catalog/games.json` remains the reference inventory.
`catalog/extraction-candidates.json` now records 62 source-grounded candidates,
including file SHA-256, observed mechanisms, proposed boundaries, dependencies,
priority and proposed acceptance checks. All have `extraction_verified: false`:
this investigation did not create or certify new extracted packages.

`catalog/lab-links.json` records five existing source-to-demo relationships, with hashes and explicit adaptation limits.

`tools/find.py` provides a read-only JSON search over the index. This is a useful
first AI interface without requiring a vector database or a chat product. Search
by task, then use project/backend/source availability as filters. Add stable
capability IDs, aliases and evidence freshness before building sophisticated search.

Future extracted-example records should include:

- `original`: project, revision, file hash and source location; preserve license
  and component-level provenance rather than one blanket library license.
- `purpose`: concrete task and behavioral limits, such as camera obstruction
  recovery or a fishing tension loop.
- `contract`: inputs/outputs, coordinate handedness, units, timestep, RNG, update
  order, event ownership, resource owner and `dispose` requirements.
- `compatibility`: engine/version, WebGL or WebGPU, shader dialect, physics engine,
  asset requirements and browser capability checks.
- `implementation`: original code, adapter diff, minimal fixture and actual entry.
- `verification`: runnable command, assertions, visual fixtures, measured context,
  known failures and evidence timestamp/source hash.
- `maturity`: inspected → extracted → independently consumed → integration tested.

These are proposed schema fields, not already available runtime APIs. Existing
Inkwave adapters are prior art; audit their individual evidence before changing
any candidate's maturity.

## The AI workflow

For “give a flying character a chase camera that stays level and recenters,”
search `camera flight`. Return Cloudkeep's camera source, input/view contract,
original game link, current browser evidence and the existing `cloudkeep-cam`
adaptation. Explain its changed target-yaw policy: copying airship heading
feedback into a camera-relative walking controller can create a steering loop.
The AI should see this difference before copying code.

For “make a boat follow waves,” return two different references: Hanakawa's
hull/river-force model and Tidewater's GPU ocean-query/boat integration. Their
water samplers and renderers are not interchangeable. Select one source stack
and preserve its query semantics; only adapt after a small deterministic fixture
matches the original behavior.

The practical loop is:

1. Find the capability and inspect its maturity and source availability.
2. Launch the complete original and the minimal example on isolated origins.
3. Read source locations, contract, original parameters and adapter changes.
4. Implement in the target project with explicit ownership and compatibility.
5. Run behavioral and visual checks; record any intentional departure from the reference.

A recipe is successful when a second distinct consumer uses the contract without
copying the original whole game. Inkwave's CPU surface facts used by a second
hazard/boost policy are a stronger reuse demonstration than another screenshot
of the same shooter. Presenting a skill animation is not proof of combat damage.

## Extraction order

Start with small mechanisms whose correctness can be expressed independently.

| First batch | Why it is a good boundary | Evidence required |
| --- | --- | --- |
| Cloudkeep flight camera/input contract | Source and tests exist; lab already demonstrates a different subject | Angle continuity, recenter, scale and input ownership |
| Tidewater CatchMinigame + GameState | Renderer-independent state with injected RNG/storage | Caught/snapped/escaped and save/economy invariants |
| Sakuragaoka batchStatic | Concrete optimization with eligibility rules | Image parity and draw-call reduction, no broken UV/alpha cases |
| Vox local spell normalization/reactions | Data pipeline and combat rules are visible | Phrase→spec fixtures and reaction/damage results; no AI-server claim |
| Inkwave surface facts and locomotion kernels | Existing extraction has contracts and prior tests | Revalidate source pin, then independent consumer and transition tests |
| Monolith terrain job boundary | Clear worker protocol but more integration cost | Crack-free LOD transitions and bounded allocation under repeated travel |

Hanakawa water, Tidewater ocean/engine and full Arkenfall combat are valuable but
have larger coupled state and rendering dependencies. Keep integrated fixtures
until those dependencies can be stated precisely. Moritsuki WaterPass remains
quarantined while its black-output issue is unresolved. Do not begin shared
backend packages from missing Smartgame/Vox/Kart servers.

## A simpler interface

The current lab puts a long 260 px menu over the left side of a full-screen scene
and backend/parameter controls over the right. The game loses usable space.
Its “generic / Inkwave / WebGL game” collections mix source, topic and compatibility.
Keep these as independent filters rather than exclusive top-level collections.

Use one quiet search-and-results view. A row shows the capability, source game,
short use case, compatibility and maturity. Clicking a row opens one active
example, with three actions: **Run original · Read source · Use example**.
Keep parameters and diagnostics collapsed until needed. The source panel should
show provenance and behavioral limits next to the code, not a decorative score.

Browsing uses static thumbnails. Only the selected example owns a renderer.
Dispose render targets, geometries/materials, workers, input listeners and audio
when switching; pause on visibility loss. Original games stay standalone with
separate origins, so their storage, pointer lock and global event handlers do not
collide. Default to a new full-screen game tab rather than fitting complex games
inside many simultaneous iframes.

Do not simplify an original game's HUD, lighting or quality settings under the
library UI task. Only the library's surrounding controls change. Existing lab
Inkwave scenes intentionally use reduced textures/shadows and training geometry;
label these as adaptations, not exact replicas.

## Performance and completeness

Measure four distinct things: load/compile/decode time; simulation/update cost;
render cost at a stated resolution/DPR; and transition/interaction stutters.
A near-60 Hz `requestAnimationFrame` sample does not establish GPU headroom,
mobile performance or smooth cold startup. Keep cold and warm runs separate.

The refreshed main-scene smoke checks do not erase Hanakawa's native Chrome
startup stall or Moritsuki's three black minigame scenes. Previous Retina input
stutters remain evidence even when a later DPR 1 sample is smooth. Arkenfall's
refresh overlapped one exploratory tab; its prior isolated performance record
is the usable baseline. A final benchmark should run one game at a time under
fixed browser/viewport/DPR, with original settings and actual game input.

“Local runnable” should be represented by separate facts: assets verified,
booted, visually rendered, core input passed, save/reload passed, external services
available, and full scenario coverage. Never collapse these into a green
“100% restored” badge. Missing server behavior cannot be recovered by downloading
more static files, and a fake backend changes the reference.

## Verification commands

```sh
python3 tools/find.py camera --category 3c
python3 tools/find.py --project cloudkeep
python3 tools/audit.py --all
```

See [project analysis](PROJECT-ANALYSIS.md). The runtime evidence index is kept outside the repository.


## Implementation status

Phase 1 is implemented. The local interface combines the original catalogs and the existing Lab, with source viewing, AI context export, read-only CLI and controlled launches. [Usage](LIBRARY-USAGE.md) documents the entry points. [Verification](library-verification.json) separates library acceptance from unresolved original-game issues.

The first standalone extraction is the original Tidewater fishing/economy rules with a small host and pinned source bytes. Its tests and browser checks cover the stated contract. The 62 source-analysis candidates remain a backlog; one working example does not promote all mechanisms to reusable packages. Cloudkeep uses the exact original exploration release.
