# Antikythera

A short underwater discovery game set in 1901 Greece: find three bronze gears, brush away sediment, and assemble a mechanism that predicts an eclipse.

Source: [public Claude artifact](https://claude.ai/artifact/ReCBQGZ4EirKSiEmT8XXfs), shared in [Edwin Arbus's post](https://x.com/edwinarbus/status/2102463453176979794). The page credits Claude Opus 5.5 for all code.

## Run locally

```sh
cd antikythera
npm start
```

Open <http://127.0.0.1:8104/> in installed Chrome. Node.js is the only server dependency; npm install is not required. The server binds only to 127.0.0.1. The archived runtime includes Three.js and fonts and needs no network access.

To regenerate the playable HTML and source reading slices from the original:

```sh
node build.mjs
```

The build uses Node built-ins and makes no network requests. It checks the original hash and requires each of the six recorded patches to match exactly once. It removes the marked Claude host runtime, changes two import-map URLs, changes the font stylesheet URL, and removes two font preconnect links. Game code is unchanged.

## Controls

Wait for loading and click **Begin the dive**. On desktop, use the mouse to look, W to walk, A/D to turn, Space to jump, Q for sonar, and E to brush when near a fragment. Sonar has a seven-second cooldown; the dive has two minutes of air. Clean all three fragments, drag the wheels into the lit sockets, then turn the crank.

On touch screens, use the left thumb stick to walk, swipe to look, tap Jump or Sonar, and rub to clean. Controls and the sequence above follow the owner's distillation, checked against the original title screen and source.

## Capture and verification

- Original fetched: 2026-09-23; archive prepared: 2026-09-27.
- Source form: a local copy of the public artifact captured on 2026-09-23. The source copy was read only.
- Original: [original/antikythera.html](original/antikythera.html), 3,587,114 bytes; SHA-256 `599526d78f11b396f36736595e55aee16c4f11d8794565507a493a1e8d41fad0`.
- Hashes, original byte ranges for every patch, dependency URLs, and CDN verification: [provenance/manifest.json](provenance/manifest.json).
- Three.js 0.186.0: 12 JavaScript files copied from the collection's installed package and verified byte-for-byte against jsDelivr on 2026-09-27. Only the game's transitive imports are included.
- Fonts: all 59 WOFF2 subsets returned for the original stylesheet request, totaling 933,876 bytes. The original CSS, Chrome User-Agent, hashes, and license sources are retained in provenance.
- Source reading map: [TECHNICAL.md](TECHNICAL.md) and [src/INDEX.md](src/INDEX.md). All 36 module slices, prelude, and tail concatenate to the original HTML byte-for-byte.
- A local headless browser run captured a smoke report and screenshots; that evidence is kept outside the repository.

```sh
# Run from the collection root:
node --test antikythera/*.test.mjs && python3 tools/repo_check.py
```

The smoke run uses headless installed Chrome with Metal ANGLE, unsafe WebGPU enabled, and the GPU blocklist ignored. Every request whose hostname is not 127.0.0.1 is blocked. It checks the title screen and captures the dive after clicking Begin the dive. Full discovery, assembly, and ending coverage belong to the separate playthrough step.

On 2026-09-27, Chrome 153.0.8010.53 reached `explore` 25.57 seconds after the click. The title, 10-second dive, and 25-second dive screenshots were visually reviewed: the diver, seabed, fish, lighting, and air HUD render. There were no console errors, page errors, failed requests, or external requests. Chrome logged two WebGL warnings: `glDrawElements` and `glDrawArrays` reported a texture-format/sampler-type mismatch. No game-code workaround was applied.

All nine provenance tests pass. The repository check reports zero errors and seven existing absolute-home-path warnings outside this archive; no allowlist entry was added.

## Attribution and license

No license is stated in the original artifact. It is archived here with full credit to its author for study; rights remain with the author.

Three.js retains its [MIT license](public/vendor/three/LICENSE). Alegreya Sans, Cinzel, EB Garamond, and GFS Neohellenic retain their copyright notices and [SIL Open Font License 1.1](public/vendor/fonts/LICENSE-OFL.txt).
