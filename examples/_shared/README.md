# Shared example UI

`ui.js` resolves language and theme, exports `t({zh, en})`, and translates each
host's initial HTML using its `i18n.js` table. Hosts translate dynamic text at
its source. Original game DOM and source modules are never rewritten.

`ui.css` provides the Lab embed palette and panel tokens. Host styles retain
scene layouts and semantic colors such as paint teams and elemental reactions.

Each example server has an independent document root. Run
`node examples/_shared/build.mjs` after changing shared assets to refresh the
byte-identical copies served by plain hosts. Each existing example `build.mjs`
also syncs them before packaging; Vite bundles them and SCORCH copies them into
`public/`. The shared Node test detects stale copies.

Browser tests call `ui_browser.py` for English/Chinese and light/dark checks,
including query overrides against opposite browser defaults. Screenshots from these checks are kept outside the repository. Tests use an available port when the library already
has an example running, while still owning and cleaning up their test server.
