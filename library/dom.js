// Small keyed DOM reconciler. Updates preserve focus, selection, media and iframe state.
import {siteURL} from './static.js';
export const h = (tag, key, attrs, children) => {
  if (attrs.href?.startsWith('#/')) attrs.href = siteURL(attrs.href.slice(1));
  return {tag, key, attrs, children};
};
const flatten = nodes => nodes.flat(Infinity).filter(v => v != null && v !== false && v !== true);
function dispose(node) {
  node._attrs?.ref?.(null);
  for (const child of node.childNodes) dispose(child);
}
export function render(parent, values) {
  const refs = [];
  patch(parent, values, refs);
  for (const [fn, node] of refs) fn(node);
}
function patch(parent, values, refs) {
  const desired = flatten(values), previous = new Map([...parent.childNodes].map(n => [n._key, n]));
  let cursor = parent.firstChild;
  desired.forEach((value, index) => {
    const text = typeof value !== 'object', key = text ? `text:${index}` : value.key;
    let node = previous.get(key);
    const tag = text ? '#text' : value.tag;
    if (node && node.nodeName.toLowerCase() !== tag) { if (cursor === node) cursor = node.nextSibling; dispose(node); node.remove(); node = null; }
    if (!node) { node = text ? document.createTextNode('') : document.createElement(tag); node._key = key; }
    previous.delete(key);
    if (text) {
      if (node.data !== String(value)) node.data = String(value);
      if (node !== cursor) parent.insertBefore(node, cursor);
      cursor = node.nextSibling; return;
    }
    const old = node._attrs || {}, attrs = value.attrs;
    for (const name of new Set([...Object.keys(old), ...Object.keys(attrs)])) {
      const v = attrs[name];
      if (v === old[name] || name === 'ref') continue;
      if (name.startsWith('on')) node[name === 'onchange' ? 'oninput' : name] = v || null;
      else if (name === 'style') node.style.cssText = v || '';
      else if (name === 'value') { if (node.value !== v) node.value = v ?? ''; }
      else if (typeof v === 'boolean' && !name.startsWith('aria-')) { node.toggleAttribute(name, v); }
      else if (v == null) node.removeAttribute(name);
      else node.setAttribute(name, String(v));
    }
    node._attrs = attrs;
    patch(node, value.children, refs);
    // Configure sandbox, load handlers and media sources before connecting a new node.
    if (node !== cursor) parent.insertBefore(node, cursor);
    cursor = node.nextSibling;
    if (old.ref !== attrs.ref) { old.ref?.(null); if (attrs.ref) refs.push([attrs.ref, node]); }
  });
  for (const node of previous.values()) { dispose(node); node.remove(); }
}
