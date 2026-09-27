import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { languageFor, tokenize, highlight } from '../library/highlight.js';

const has = (tokens, type, text) => tokens.flat().some(token => token.type === type && token.text === text);

test('languageFor maps every supported extension and defaults to text', () => {
  const groups = { ts: ['ts', 'tsx', 'mts'], js: ['js', 'mjs', 'cjs', 'jsx'], py: ['py'],
    glsl: ['glsl', 'vert', 'frag', 'wgsl'], json: ['json', 'webmanifest'],
    html: ['html', 'htm'], css: ['css'], md: ['md'] };
  for (const [language, extensions] of Object.entries(groups)) {
    for (const extension of extensions) {
      assert.equal(languageFor(`src/file.${extension}`), language);
      assert.equal(languageFor(`src/file.${extension.toUpperCase()}`), language);
    }
  }
  for (const path of ['README', 'file.txt', 'src.ts/file', 'file.constructor', 'file.__proto__', '']) {
    assert.equal(languageFor(path), 'text');
  }
});

test('all languages escape source text, including tags, quotes and ampersands', () => {
  const source = '<script>alert("x")</script> & \'quoted\'';
  for (const language of ['ts', 'js', 'py', 'glsl', 'json', 'html', 'css', 'md', 'text', 'unknown']) {
    const result = highlight(source, language);
    assert.doesNotMatch(result, /<script/);
    assert.match(result.replace(/<[^>]*>/g, ''), /&lt;script/);
    if (language === 'html' || language === 'text') assert.match(result, /&lt;script/);
    for (const entity of ['&gt;', '&quot;', '&#39;', '&amp;']) assert.ok(result.includes(entity));
  }
  assert.throws(() => highlight('x', 'text', { start: '1" onclick="bad' }), TypeError);
});

test('line counts, CRLF, trailing and empty lines, start and inclusive mark range', () => {
  const result = highlight('one\r\n\r\nthree\r\nfour\r\n', 'text', { start: 9, mark: [10, 11] });
  assert.match(result, /^<ol class="code" start="9">/);
  assert.equal((result.match(/<li /g) || []).length, 5);
  assert.deepEqual([...result.matchAll(/<li data-line="(\d+)" class="mark">/g)].map(m => +m[1]), [10, 11]);
  assert.ok(result.includes('<li data-line="10" class="mark">\u200b</li>'));
  assert.ok(result.includes('<li data-line="13">\u200b</li>'));
  assert.equal(highlight('', 'ts'), '<ol class="code" start="1"><li data-line="1">\u200b</li></ol>');
  assert.deepEqual(tokenize('a\rb\n', 'text').map(line => line.map(t => t.text).join('')), ['a', 'b', '']);
});

test('block comments persist through blank lines and stop at their delimiter', () => {
  for (const language of ['ts', 'js', 'glsl', 'css']) {
    const lines = tokenize('/* start\n\nreturn "still comment"\n*/ const value = 1;', language);
    assert.deepEqual(lines[2], [{ type: 'com', text: 'return "still comment"' }]);
    assert.deepEqual(lines[3][0], { type: 'com', text: '*/' });
    assert.ok(has([lines[3]], 'num', '1'));
  }
  assert.ok(has(tokenize('const value = 1;', 'ts'), 'kw', 'const'));
});

test('template literals persist across lines, escaped backticks and blank lines', () => {
  const source = 'const label = `first\\`\n\n${value} /* string */\nlast`; run();';
  const lines = tokenize(source, 'ts');
  assert.deepEqual(lines[2], [{ type: 'str', text: '${value} /* string */' }]);
  assert.deepEqual(lines[3][0], { type: 'str', text: 'last`' });
  assert.ok(has([lines[3]], 'fn', 'run'));
  assert.match(highlight(source, 'ts'), /tok-str">last`<\/span>/);
});

test('Python triple-quoted strings support both delimiters and resume code', () => {
  for (const quote of ['"""', "'''"]) {
    const lines = tokenize(`value = ${quote}first\n# still a string\n\nlast${quote}; print(True)`, 'py');
    assert.deepEqual(lines[1], [{ type: 'str', text: '# still a string' }]);
    assert.deepEqual(lines[3][0], { type: 'str', text: `last${quote}` });
    assert.ok(has(lines, 'fn', 'print'));
    assert.ok(has(lines, 'kw', 'True'));
  }
  assert.ok(has(tokenize('def run(): # comment', 'py'), 'com', '# comment'));
});

test('real flight-camera TS excerpts classify keywords, strings, numbers, functions and types', () => {
  const source = readFileSync(new URL('../examples/cloudkeep-flight/original/flight-camera.ts', import.meta.url), 'utf8');
  const excerpt = source.split('\n').filter(line => /import \{|export class|const alpha =/.test(line)).join('\n');
  assert.ok(excerpt.includes('const alpha = this.initial ? 1 : 1 - Math.exp(-dt * 12);'));
  const tokens = tokenize(excerpt, 'ts');
  for (const [type, text] of [['kw', 'const'], ['kw', 'this'], ['str', "'three'"],
    ['num', '12'], ['fn', 'exp'], ['type', 'FlightCamera'], ['type', 'Math'], ['punct', ';']]) {
    assert.ok(has(tokens, type, text), `${type}: ${text}`);
    assert.ok(highlight(excerpt, 'ts').includes(`class="tok-${type}"`));
  }
});

test('numbers include leading-dot floats, exponents, hex and separators', () => {
  const tokens = tokenize('0 42 .35 1.25 1e-3 0xAB_CD 1_000 2.5e+8', 'ts');
  assert.deepEqual(tokens[0].filter(t => t.type === 'num').map(t => t.text),
    ['0', '42', '.35', '1.25', '1e-3', '0xAB_CD', '1_000', '2.5e+8']);
});

test('JSON keys are attributes while values remain strings and literals', () => {
  const tokens = tokenize('{"name": "flight", "enabled": true, "count": 12, "none": null}', 'json');
  for (const key of ['name', 'enabled', 'count', 'none']) assert.ok(has(tokens, 'attr', `"${key}"`));
  assert.ok(has(tokens, 'str', '"flight"'));
  assert.ok(has(tokens, 'kw', 'true'));
  assert.ok(has(tokens, 'kw', 'null'));
});

test('HTML comments, tags and attributes keep their state across lines', () => {
  const tokens = tokenize('<!-- first\n<div hidden>\n-->\n<section\n data-id="flight" disabled>Text</section>', 'html');
  assert.deepEqual(tokens[1], [{ type: 'com', text: '<div hidden>' }]);
  assert.ok(has(tokens, 'tag', '<section'));
  assert.ok(has(tokens, 'attr', 'data-id'));
  assert.ok(has(tokens, 'attr', 'disabled'));
  assert.ok(has(tokens, 'str', '"flight"'));
  assert.ok(has(tokens, 'plain', 'Text'));
  assert.ok(has(tokens, 'tag', '</section'));
});

test('CSS properties and shader keywords/types are recognized', () => {
  const css = tokenize('.code {\n color: red; --gap: .35em; background-color: "blue";\n}', 'css');
  for (const property of ['color', '--gap', 'background-color']) assert.ok(has(css, 'attr', property));
  const shader = tokenize('uniform vec3 tint; fn main() { let x: f32 = .35; return; }', 'glsl');
  for (const keyword of ['uniform', 'fn', 'let', 'return']) assert.ok(has(shader, 'kw', keyword));
  for (const type of ['vec3', 'f32']) assert.ok(has(shader, 'type', type));
});

test('tokenization preserves every source character and does not leak state between calls', () => {
  const source = 'const x = "a\\\"b"; // <&>\n/* open\n\nclose */ const y = `hello\nworld`;\n';
  for (const language of ['ts', 'js', 'py', 'glsl', 'json', 'html', 'css', 'md', 'text']) {
    assert.equal(tokenize(source, language).map(line => line.map(t => t.text).join('')).join('\n'), source);
  }
  tokenize('/* unclosed', 'ts');
  assert.ok(has(tokenize('const value = 1;', 'ts'), 'kw', 'const'));
});

test('20,000 TS lines render with token spans in under 400 ms', t => {
  const source = Array(20000).fill('const alpha = this.initial ? 1 : 1 - Math.exp(-dt * 12);').join('\n');
  const start = performance.now();
  const result = highlight(source, 'ts');
  const elapsed = performance.now() - start;
  t.diagnostic(`20,000-line highlight: ${elapsed.toFixed(1)} ms`);
  assert.ok(elapsed < 400, `highlight took ${elapsed.toFixed(1)} ms (limit: 400 ms)`);
  assert.match(result, /class="tok-kw">const/);
  assert.equal((result.match(/<li /g) || []).length, 20000);
});

test('over 20,000 lines use escaped plain text and preserve line metadata', () => {
  const source = Array(20001).fill('<script>"x" & \'y\'</script>').join('\n');
  const result = highlight(source, 'ts', { start: 5, mark: [6, 7] });
  assert.doesNotMatch(result, /<span|<script/);
  assert.ok(result.includes('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;'));
  assert.equal((result.match(/<li /g) || []).length, 20001);
  assert.match(result, /<li data-line="20005">/);
  assert.equal((result.match(/class="mark"/g) || []).length, 2);
});


test('lines over 10,000 characters bypass highlighting and remain escaped with metadata', () => {
  const prefix = '<script>"x" & \'y\'</script>';
  const boundary = prefix + 'x'.repeat(10000 - prefix.length);
  assert.match(highlight(boundary, 'js'), /<span/);
  const result = highlight('const x = 1;\n' + boundary + 'x', 'js', { start: 7, mark: [8, 8] });
  assert.doesNotMatch(result, /<span|<script/);
  assert.match(result, /&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;\/script&gt;/);
  assert.match(result, /<li data-line="8" class="mark">/);
  assert.equal((result.match(/<li /g) || []).length, 2);
});
