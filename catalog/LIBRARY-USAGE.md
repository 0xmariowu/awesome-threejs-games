# Using the Web game library

Start from the Gameref root with Node 22.18 or newer:

```sh
node tools/library.mjs
# http://127.0.0.1:8080/
```

The server binds only to `127.0.0.1`. The interface searches original projects, source analyses, existing `webgame-lab` scenes and separately registered extractions. It previews catalog-approved source files, shows hashes and known limits, and exports machine-readable context. Search matches titles, mechanism descriptions, categories and selected Chinese aliases; it is not full-text search over every source file.

Choose **运行原游戏** or **运行示例** to start a stopped local service and open its entry. Subsequent launches replace the previous game in the same window, so the library does not accumulate live renderers. Refreshing or closing the library also closes the player it opened. Browsing uses static evidence screenshots. Original game graphics are unchanged. Servers started by the library stop when the library process exits; pre-existing servers are left running. Each launch checks the expected local entry before reusing an occupied port.

The existing Lab remains in `../webgame-lab`. Its own dependencies must be installed there. The library reads its TypeScript catalog and starts Vite on port 5199 when needed. It passes `panel=0&menu=0&clean=1` to keep the player uncluttered. Errors remain visible. Games use their catalog ports; the first independent example uses 8102. Port 8080 is the library default (`LIBRARY_PORT` can change it).

## AI and command-line use

These commands are read-only and do not require a running server:

```sh
node tools/library-cli.mjs search 镜头 --kind capability
node tools/library-cli.mjs search water --backend webgpu
node tools/library-cli.mjs inspect cloudkeep.flight
node tools/library-cli.mjs context tidewater.fishing
node tools/library-cli.mjs source tidewater.fishing 0
node tools/library-cli.mjs verify
```

`search`, `inspect`, `context` and `verify` return JSON. `source` prints the selected source file as text, capped at 2 MB for preview. `context` supplies source paths/hashes, dependencies, intended extraction boundaries, verification requirements, known limits and related runnable entries. No model service or chat endpoint is required. The older `tools/find.py` still searches the candidate-only index.

The browser offers **复制 AI 上下文**, per-record JSON download and a complete index download. A download does not contain the server's launch token. Source contents are rendered as text; HTML and code from an archive are never executed inside the library.

## Local API

- `GET /api/index`: current records, counts and launch token for the local UI.
- `GET /api/search?q=camera&kind=capability&project=cloudkeep`: filtered records. Optional filters: `category`, `backend`, `maturity`.
- `GET /api/context?id=tidewater.fishing`: machine-readable context.
- `GET /api/source?id=tidewater.fishing&file=0`: catalog-selected text, current hash and pinned-hash match.
- `POST /api/launch`: JSON `{ "id": "game:cloudkeep" }`, with `Content-Type: application/json` and `X-Library-Token` from `/api/index`.

Use the exact `127.0.0.1` origin shown at startup. Cross-origin browser requests and unrecognized hosts are rejected. The API accepts catalog identifiers, not paths, commands or remote URLs. Source reads recheck real paths against the registered roots. Restart the server after editing catalogs; the command-line tools rebuild their index on every invocation.

## Evidence and maturity

- **Original archive**: captured source/build and assets. Check project limitations; this label is not a complete parity certificate.
- **Source inspected**: identified mechanism, pinned files and proposed extraction contract. Not a reusable package.
- **Existing demo**: an existing adapted Lab scene. Check its source and backend notes.
- **Verified extraction**: a bounded standalone example with pinned originals, tests and recorded browser checks. The scope is stated per example.

`catalog/games.json`, `extraction-candidates.json`, `lab-links.json` and `examples.json` are the source catalogs. The index adds current source hashes at startup. Files without a historical pin report a current fingerprint, not historical parity. The original source-analysis candidates remain distinct from the narrower extraction records.

```sh
node --test tools/library.test.mjs examples/tidewater-fishing/*.test.mjs
node tools/library-cli.mjs verify
```

Browser evidence from the library development run is kept outside the repository. Broader original-game failures remain in their own audit reports; the new library does not close Hanakawa startup stalls, Moritsuki black screens or unavailable server features.
