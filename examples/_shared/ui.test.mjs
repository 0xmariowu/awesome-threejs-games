import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('./ui.js', import.meta.url), 'utf8');
function resolve(globals = {}) {
  const context = vm.createContext({ URLSearchParams, ...globals });
  vm.runInContext(source.replaceAll('export ', '') + '\nglobalThis.result = { lang: lang(), theme: theme(), text: t({ zh: "ZH", en: "EN" }) };', context);
  return JSON.parse(JSON.stringify(context.result));
}
test('query wins; any zh browser language selects Chinese; media selects theme', () => {
  assert.deepEqual(resolve({location: {search: '?lang=en&theme=dark'}, navigator: {languages: ['zh-CN']}}), {lang: 'en', theme: 'dark', text: 'EN'});
  assert.deepEqual(resolve({location: {search: '?lang=zh&theme=light'}, navigator: {languages: ['en']}, matchMedia: () => ({matches: true})}), {lang: 'zh', theme: 'light', text: 'ZH'});
  assert.deepEqual(resolve({location: {search: '?lang=invalid&theme=invalid'}, navigator: {languages: ['en-US', 'zh-Hant']}, matchMedia: () => ({matches: true})}), {lang: 'zh', theme: 'dark', text: 'ZH'});
  assert.deepEqual(resolve(), {lang: 'en', theme: 'light', text: 'EN'});
  const context = { navigator: {get languages() {throw Error('blocked');}}, matchMedia() {throw Error('blocked');} };
  Object.defineProperty(context, 'location', {get() {throw Error('blocked');}, enumerable: true});
  const sandbox = vm.createContext({URLSearchParams});
  Object.defineProperties(sandbox, Object.getOwnPropertyDescriptors(context));
  vm.runInContext(source.replaceAll('export ', '') + '\nglobalThis.result = [lang(), theme()];', sandbox);
  assert.equal(JSON.stringify(sandbox.result), '["en","light"]');
});
test('standalone hosts ship exact shared UI copies', async () => {
  const root = new URL('../', import.meta.url);
  for (const entry of await readdir(root, {withFileTypes: true})) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    try { await readFile(new URL(`${entry.name}/local.json`, root)); } catch { continue; }
    const prefix = entry.name === 'tidewater-fishing' ? '' : 'src/';
    for (const name of ['ui.js', 'ui.css']) {
      assert.equal(await readFile(new URL(`${entry.name}/${prefix}${name}`, root), 'utf8'), await readFile(new URL(name, import.meta.url), 'utf8'), `${entry.name}/${name}`);
    }
  }
});
