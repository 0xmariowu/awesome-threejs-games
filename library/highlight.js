const extensions = {
  ts: 'ts', tsx: 'ts', mts: 'ts', js: 'js', mjs: 'js', cjs: 'js', jsx: 'js',
  py: 'py', glsl: 'glsl', vert: 'glsl', frag: 'glsl', wgsl: 'glsl',
  json: 'json', webmanifest: 'json', html: 'html', htm: 'html', css: 'css', md: 'md',
};
const words = text => new Set(text.split(' '));
const jsKeywords = words('const let var function class extends return if else for while do switch case break continue new this super import export from default async await yield typeof instanceof in of try catch finally throw type interface enum readonly private public protected static implements declare as satisfies keyof true false null undefined');
const keywords = {
  js: jsKeywords, ts: jsKeywords,
  py: words('def class return if elif else for while in not and or import from as with try except finally raise lambda yield pass break continue None True False global nonlocal assert del is async await'),
  glsl: words('uniform varying attribute in out inout precision highp mediump lowp return if else for fn let var struct const break continue discard loop switch case default true false'),
  json: words('true false null'),
};
const shaderTypes = words('void float int bool vec2 vec3 vec4 mat3 mat4 sampler2D sampler3D f32 f16 i32 u32 array ptr');
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = text => text.replace(/[&<>"']/g, char => entities[char]);
const splitLines = source => source.split(/\r\n|\r|\n/);

export function languageFor(path) {
  const extension = /\.([^./\\]+)$/.exec(path)?.[1].toLowerCase();
  return Object.hasOwn(extensions, extension) ? extensions[extension] : 'text';
}

// Each scanner belongs to one source, so only lexical state crosses line boundaries.
function scanner(language) {
  const script = language === 'js' || language === 'ts';
  const cComments = script || language === 'glsl' || language === 'css';
  const html = language === 'html';
  const plain = !Object.hasOwn(keywords, language) && !html && language !== 'css';
  const lexeme = language === 'css'
    ? /\s+|(?:0[xX][\da-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)|[-a-zA-Z_$][\w$-]*|[^\w\s]|./gy
    : /\s+|(?:0[xX][\da-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)|[a-zA-Z_$][\w$]*|[^\w\s]|./gy;
  let state = null, inTag = false, cssDepth = 0;

  return line => {
    if (plain) return line ? [{ type: 'plain', text: line }] : [];
    const tokens = [];
    let index = 0;
    const add = (type, text) => { if (text) tokens.push({ type, text }); };
    const consume = (start, searchFrom) => {
      let end = line.indexOf(state.end, searchFrom);
      // Escaped delimiters do not end strings (including triple quotes/templates).
      while (end !== -1 && state.escape) {
        let backslashes = 0;
        for (let i = end - 1; i >= 0 && line[i] === '\\'; i--) backslashes++;
        if (backslashes % 2 === 0) break;
        end = line.indexOf(state.end, end + 1);
      }
      const type = state.type;
      index = end === -1 ? line.length : end + state.end.length;
      if (end !== -1 || !state.multiline) state = null;
      add(type, line.slice(start, index));
    };

    while (index < line.length) {
      if (state) { consume(index, index); continue; }
      const start = index, char = line[index];
      if ((cComments && line.startsWith('/*', index)) || (html && line.startsWith('<!--', index))) {
        const opener = html ? '<!--' : '/*';
        state = { end: html ? '-->' : '*/', type: 'com', multiline: true };
        consume(start, start + opener.length);
        continue;
      }
      if ((cComments && language !== 'css' && line.startsWith('//', index)) || (language === 'py' && char === '#')) {
        add('com', line.slice(index));
        break;
      }
      if (html && !inTag) {
        const tag = /^<\/?[a-zA-Z][\w:-]*/.exec(line.slice(index));
        if (tag) { add('tag', tag[0]); index += tag[0].length; inTag = true; }
        else {
          const next = line.indexOf('<', index + 1);
          index = next === -1 ? line.length : next;
          add('plain', line.slice(start, index));
        }
        continue;
      }
      if (char === '"' || char === "'" || (script && char === '`')) {
        const triple = language === 'py' && line.startsWith(char.repeat(3), index);
        const delimiter = triple ? char.repeat(3) : char;
        state = { end: delimiter, type: 'str', escape: !html,
          multiline: triple || char === '`' || html };
        consume(start, start + delimiter.length);
        if (language === 'json' && /^\s*:/.test(line.slice(index))) tokens[tokens.length - 1].type = 'attr';
        continue;
      }
      if (html && (char === '>' || line.startsWith('/>', index))) {
        index += char === '>' ? 1 : 2;
        add('tag', line.slice(start, index));
        inTag = false;
        continue;
      }
      // HTML attribute names can contain hyphens, colons and dots.
      if (html && /[a-zA-Z_:]/.test(char)) {
        const attribute = /^[\w:.-]+/.exec(line.slice(index))[0];
        add('attr', attribute); index += attribute.length;
        continue;
      }
      lexeme.lastIndex = index;
      const text = lexeme.exec(line)[0];
      index = lexeme.lastIndex;
      let type = 'plain';
      if (/^\s/.test(text)) type = 'plain';
      else if (/^(?:\d|\.\d)/.test(text)) type = 'num';
      else if (keywords[language]?.has(text)) type = 'kw';
      else if (language === 'glsl' && shaderTypes.has(text)) type = 'type';
      else if (/^[a-zA-Z_$]/.test(text) || (language === 'css' && /^-\w|^--/.test(text))) {
        if (language === 'css' && cssDepth > 0 && /^\s*:/.test(line.slice(index))) type = 'attr';
        else if (/^\s*\(/.test(line.slice(index))) type = 'fn';
        else if (script && /^[A-Z]/.test(text)) type = 'type';
      } else type = 'punct';
      if (language === 'css') {
        if (text === '{') cssDepth++;
        if (text === '}') cssDepth = Math.max(0, cssDepth - 1);
      }
      add(type, text);
    }
    return tokens;
  };
}

export function tokenize(source, language) {
  return splitLines(source).map(scanner(language));
}

export function highlight(source, language, { start = 1, mark = null } = {}) {
  // Keep caller-supplied line metadata out of HTML attribute syntax.
  if (!Number.isSafeInteger(start)) throw new TypeError('start must be a safe integer');
  const lines = splitLines(source);
  const scan = lines.length > 20000 || lines.some(line => line.length > 10000) ? null : scanner(language);
  const rendered = lines.map((line, offset) => {
    const number = start + offset;
    const marked = mark && number >= mark[0] && number <= mark[1] ? ' class="mark"' : '';
    const content = !line ? '\u200b' : scan
      ? scan(line).map(token => `<span class="tok-${token.type}">${escapeHTML(token.text)}</span>`).join('')
      : escapeHTML(line);
    return `<li data-line="${number}"${marked}>${content}</li>`;
  });
  return `<ol class="code" start="${start}">${rendered.join('')}</ol>`;
}
