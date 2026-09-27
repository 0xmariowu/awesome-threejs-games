// Post-build draw-call optimiser for the props module (runs on props' own objects only).
//  1) Atlas pass: every sign / label / decal / lit-panel texture (non-tiling canvas, UVs in 0..1) is
//     copied into shared 1024² atlas pages (down-scaled to <= CAP texels per metre where it was
//     oversampled), meshes get remapped UVs, and all of them share a handful of page materials.
//  2) Colour pass: plain solid-colour toon materials are collapsed into a few vertex-coloured toon
//     materials (colour baked per vertex, linear) so the static batcher merges them per cell.
import * as THREE from 'three';

const PAGE = 1024, PAD = 4, CAP = 900, MAXDIM = 768;

function parseKey(key) {
  if (!key) return null;
  try {
    if (key.startsWith('toon|')) { const i = key.indexOf('|', 5); return { kind: 'toon', hex: key.slice(5, i), opts: JSON.parse(key.slice(i + 1)) }; }
    if (key.startsWith('emi|')) { const i = key.indexOf('|', 4), j = key.indexOf('|', i + 1); return { kind: 'emi', hex: key.slice(4, i), intensity: +key.slice(i + 1, j), opts: JSON.parse(key.slice(j + 1)) }; }
  } catch (e) { return null; }
  return null;
}
const paintBucket = (p) => (p <= 0.025 ? 0.02 : p <= 0.045 ? 0.04 : p <= 0.065 ? 0.06 : 0.08);

export function optimizeProps(ctx, roots) {
  const { mat } = ctx;
  const inv = new Map(); for (const [k, m] of mat.cache) inv.set(m, k);
  const meshes = [];
  for (const r of roots) { r.updateMatrixWorld(true); r.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.noBatch && !o.userData.dynamic && !Array.isArray(o.material)) meshes.push(o); }); }
  const a = atlasPass(ctx, meshes, inv);
  const c = colorPass(ctx, meshes, inv);
  return { ...a, ...c };
}

// ------------------------------------------------------------------ atlas
function uvInRange(geo) {
  const uv = geo.attributes.uv; if (!uv) return false;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u < -0.002 || u > 1.002 || v < -0.002 || v > 1.002) return false; }
  return true;
}
/** texels-per-metre of a texture (W×H) on a mesh (area weighted). */
function density(o, W, H) {
  const g = o.geometry, p = g.attributes.position, uv = g.attributes.uv, idx = g.index;
  const n = idx ? idx.count : p.count;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  let wa = 0, ta = 0;
  for (let t = 0; t < n; t += 3) {
    const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
    A.fromBufferAttribute(p, i0).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(p, i1).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(p, i2).applyMatrix4(o.matrixWorld);
    wa += B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
    const u0 = uv.getX(i0) * W, v0 = uv.getY(i0) * H, u1 = uv.getX(i1) * W, v1 = uv.getY(i1) * H, u2 = uv.getX(i2) * W, v2 = uv.getY(i2) * H;
    ta += Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2;
  }
  return wa > 1e-8 ? Math.sqrt(ta / wa) : 0;
}

function atlasPass(ctx, meshes, inv) {
  const { mat } = ctx;
  const entries = new Map(); // texKey -> entry
  const users = [];
  const blocked = new Set(); // textures also used by meshes we cannot remap
  for (const o of meshes) {
    const m = o.material, tex = m.map;
    if (!tex) continue;
    const pk = parseKey(inv.get(m));
    const ok = pk && !m.alphaMap && pk.hex === 'ffffff' && tex.image && tex.image.width > 1 &&
      tex.wrapS === THREE.ClampToEdgeWrapping && tex.wrapT === THREE.ClampToEdgeWrapping &&
      tex.repeat.x === 1 && tex.repeat.y === 1 && tex.offset.x === 0 && tex.offset.y === 0 && tex.flipY && !tex.isVideoTexture &&
      o.geometry.attributes.uv && uvInRange(o.geometry);
    if (!ok) { blocked.add(tex); continue; }
    const opts = { ...pk.opts }; delete opts.map;
    let sig, bake = 1, transparent = !!opts.transparent;
    if (pk.kind === 'toon') { opts.paint = (opts.paint ?? 0.05) <= 0.03 ? 0.02 : 0.045; sig = 'T|' + JSON.stringify(opts); }
    else {
      const I = pk.intensity;
      if (I <= 1.0 && !transparent) { bake = I; sig = 'E|1|' + JSON.stringify(opts); }
      else sig = 'E|' + I + '|' + JSON.stringify(opts);
    }
    const key = tex.uuid + '|' + bake + '|' + (transparent ? 1 : 0);
    let e = entries.get(key);
    if (!e) { e = { key, tex, W: tex.image.width, H: tex.image.height, bake, transparent, sig, dens: 0, n: 0 }; entries.set(key, e); }
    e.dens = Math.max(e.dens, density(o, e.W, e.H)); e.n++;
    users.push({ o, e, sig, kind: pk.kind, opts, intensity: pk.kind === 'emi' ? (bake !== 1 ? 1 : pk.intensity) : 0 });
  }
  if (!entries.size) return { atlasPages: 0, atlased: 0 };
  // sizes (down-scale oversampled textures)
  for (const e of entries.values()) {
    let s = e.dens > CAP ? CAP / e.dens : 1;
    s = Math.min(s, MAXDIM / Math.max(e.W, e.H));
    e.w = Math.max(8, Math.min(PAGE - 2 * PAD, Math.round(e.W * s))); e.h = Math.max(8, Math.min(PAGE - 2 * PAD, Math.round(e.H * s)));
  }
  // guillotine packing (sorted by signature, then size) so a page mostly serves one material
  const list = [...entries.values()].sort((a, b) => (a.sig < b.sig ? -1 : a.sig > b.sig ? 1 : Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h));
  const pages = [];
  const newPage = () => { const { canvas, g } = ctx.tex.canvas(PAGE, PAGE); const p = { canvas, g, free: [[0, 0, PAGE, PAGE]], tex: null }; pages.push(p); return p; };
  const fit = (p, w, h) => {
    let best = -1, bs = Infinity;
    p.free.forEach((r, i) => { if (w <= r[2] && h <= r[3]) { const s2 = Math.min(r[2] - w, r[3] - h); if (s2 < bs) { bs = s2; best = i; } } });
    return best;
  };
  for (const e of list) {
    const w = e.w + 2 * PAD, h = e.h + 2 * PAD;
    let page = null, ri = -1;
    for (const p of pages) { ri = fit(p, w, h); if (ri >= 0) { page = p; break; } }
    if (!page) { page = newPage(); ri = fit(page, w, h); }
    const r = page.free.splice(ri, 1)[0];
    // split the leftover along the longer remaining side
    const rw = r[2] - w, rh = r[3] - h;
    if (rw > rh) { if (rw > 0) page.free.push([r[0] + w, r[1], rw, r[3]]); if (rh > 0) page.free.push([r[0], r[1] + h, w, rh]); }
    else { if (rh > 0) page.free.push([r[0], r[1] + h, r[2], rh]); if (rw > 0) page.free.push([r[0] + w, r[1], rw, h]); }
    e.page = page; e.x = r[0] + PAD; e.y = r[1] + PAD;
    // copy (edge-extended for opaque art so mip levels don't bleed)
    const g = page.g, src = e.tex.image;
    try {
      if (!e.transparent) g.drawImage(src, e.x - PAD + 1, e.y - PAD + 1, e.w + 2 * PAD - 2, e.h + 2 * PAD - 2);
      g.drawImage(src, e.x, e.y, e.w, e.h);
      if (e.bake !== 1) {
        const v = Math.round(255 * Math.pow(e.bake, 1 / 2.2));
        g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(e.x - PAD + 1, e.y - PAD + 1, e.w + 2 * PAD - 2, e.h + 2 * PAD - 2);
        g.globalCompositeOperation = 'source-over';
      }
    } catch (err) { /* headless */ }
  }
  pages.forEach((p, i) => { p.tex = ctx.tex.finish(p.canvas, { anisotropy: 8 }); p.tex.name = 'props.atlas' + i; });
  // materials per (page, signature) + remapped geometries
  const mats = new Map(), geos = new Map();
  for (const u of users) {
    const e = u.e, p = e.page;
    const mk = p.tex.uuid + '|' + u.sig;
    let m = mats.get(mk);
    if (!m) {
      m = u.kind === 'toon' ? mat.toon('#ffffff', { ...u.opts, map: p.tex }) : mat.emissive('#ffffff', u.intensity, { ...u.opts, map: p.tex });
      mats.set(mk, m);
    }
    const gk = u.o.geometry.uuid + '|' + e.key;
    let g = geos.get(gk);
    if (!g) {
      g = u.o.geometry.clone();
      const uv = g.attributes.uv = g.attributes.uv.clone();
      for (let i = 0; i < uv.count; i++) {
        const uu = Math.min(1, Math.max(0, uv.getX(i))), vv = Math.min(1, Math.max(0, uv.getY(i)));
        uv.setXY(i, (e.x + uu * e.w) / PAGE, 1 - (e.y + (1 - vv) * e.h) / PAGE);
      }
      geos.set(gk, g);
    }
    u.o.geometry = g; u.o.material = m;
  }
  // free source canvases that are no longer referenced
  for (const e of entries.values()) {
    if (blocked.has(e.tex)) continue;
    try { e.tex.image.width = 1; e.tex.image.height = 1; e.tex.dispose(); } catch (err) { /* ignore */ }
  }
  let area = 0; for (const e of entries.values()) area += (e.w + 2 * PAD) * (e.h + 2 * PAD);
  return { atlasFill: +(area / (pages.length * PAGE * PAGE)).toFixed(2), texelsIn: [...entries.values()].reduce((a, e) => a + e.W * e.H, 0), texelsOut: area, atlasPages: pages.length, atlasMaterials: mats.size, atlased: users.length, atlasTextures: entries.size };
}

// ------------------------------------------------------------------ vertex colours
function colorPass(ctx, meshes, inv) {
  const { mat } = ctx;
  const geos = new Map(), vms = new Map();
  let n = 0;
  for (const o of meshes) {
    const m = o.material;
    if (!m.isMeshToonMaterial || (m.map && m.map.name && m.map.name.startsWith('props.atlas')) || m.alphaMap || m.vertexColors || m.transparent || m.alphaTest > 0 || m.opacity !== 1 || m.depthWrite === false || m.polygonOffset) continue;
    if (m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b)) continue;
    const pk = parseKey(inv.get(m));
    if (!pk || pk.kind !== 'toon') continue;
    const side = pk.opts.side === 'double' ? 'double' : pk.opts.side === 'back' ? 'back' : 'front';
    const paint = paintBucket(pk.opts.paint ?? 0.05);
    const vk = side + '|' + paint + '|' + (m.map ? m.map.uuid : '');
    let vm = vms.get(vk);
    if (!vm) { const opts = { vertexColors: true, paint }; if (m.map) opts.map = m.map; if (side !== 'front') opts.side = side; vm = mat.toon('#ffffff', opts); vms.set(vk, vm); }
    const gk = o.geometry.uuid + '|' + m.color.getHexString();
    let g = geos.get(gk);
    if (!g) {
      g = o.geometry.clone();
      const cnt = g.attributes.position.count, arr = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) { arr[i * 3] = m.color.r; arr[i * 3 + 1] = m.color.g; arr[i * 3 + 2] = m.color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      geos.set(gk, g);
    }
    o.geometry = g; o.material = vm; n++;
  }
  return { vcMeshes: n, vcMaterials: vms.size };
}
