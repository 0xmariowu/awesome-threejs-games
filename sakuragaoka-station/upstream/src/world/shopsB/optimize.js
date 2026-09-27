// shopsB draw-call optimisation.
// Plain cel materials that differ only by colour are collapsed into ONE vertex-coloured material per
// option set (same map / paint / side …): the colour is baked into a per-vertex 'color' attribute, so
// the core static batcher can merge hundreds of small parts into a handful of draw calls.
// Interior "warm glow" materials (emissive ∝ albedo) are grouped the same way per glow level, with the
// emissive tint taken from the group's average colour (they are all soft warm neutrals).
import * as THREE from 'three';

export function consolidate(ctx, K, opts = {}) {
  const roots = K.spaces, rec = K.rec;
  const { mat } = ctx;
  const stats = { meshes: 0, before: new Set(), after: new Set(), skipped: 0 };
  const jobs = [];
  for (const root of roots) {
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
      if (o.userData.noBatch || o.userData.keepMat) return;
      const r = rec.get(o.material);
      if (!r) { stats.skipped++; return; }
      const op = r.o || {};
      if (op.vertexColors || op.transparent || op.alphaMap || (op.opacity ?? 1) < 1) { stats.skipped++; return; }
      if (op.emissive && !r.glow) { stats.skipped++; return; }
      const c = o.material.color, lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      jobs.push({ o, r, glow: r.glow ? Math.max(0.1, Math.round(r.glow * 10) / 10) : 0, band: lum < 0.07 ? 0 : lum < 0.28 ? 1 : 2 });
    });
  }
  // group glow materials by (glow, opts) to derive one emissive tint per group
  const glowGroups = new Map();
  const keyCache = new Map();
  const keyOf = (r) => { let k = keyCache.get(r); if (k === undefined) { const o = { ...r.o }; delete o.emissive; delete o.emissiveIntensity; k = K.optKey(o); keyCache.set(r, k); } return k; };
  const made = new Map();
  const toon = (o) => { const k = K.optKey(o); let m = made.get(k); if (!m) { m = mat.toon('#ffffff', K.cheapTex(o)); made.set(k, m); } return m; };
  for (const j of jobs) {
    if (!j.glow) continue;
    const k = j.glow + '|' + j.band + '|' + keyOf(j.r);
    let g = glowGroups.get(k); if (!g) glowGroups.set(k, (g = { sum: new THREE.Color(0, 0, 0), n: 0 }));
    const c = j.o.material.color; g.sum.r += c.r; g.sum.g += c.g; g.sum.b += c.b; g.n++;
  }
  const warm = new THREE.Color('#ffc58a');
  for (const j of jobs) {
    const { o, r, glow } = j; const m = o.material;
    stats.before.add(m);
    let nm;
    const base = { ...r.o }; delete base.emissive; delete base.emissiveIntensity;
    if (glow) {
      const g = glowGroups.get(glow + '|' + j.band + '|' + keyOf(r));
      const avg = new THREE.Color(g.sum.r / g.n, g.sum.g / g.n, g.sum.b / g.n).multiply(warm);
      nm = toon({ ...base, vertexColors: true, emissive: '#' + avg.getHexString(), emissiveIntensity: glow });
    } else nm = toon({ ...base, vertexColors: true });
    const geo = o.geometry.clone();
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3); const c = m.color;
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    o.geometry = geo; o.material = nm;
    stats.after.add(nm); stats.meshes++;
    if (opts.debug) { const k = keyOf(r) + (glow ? ' glow' + glow : ''); (stats.keys ||= {})[k] = (stats.keys[k] || 0) + 1; }
  }
  if (opts.debug) console.log(Object.entries(stats.keys).sort((a,b)=>b[1]-a[1]).map(e=>e[1]+' '+e[0].slice(0,140)).join('\n'));
  return { meshes: stats.meshes, materialsBefore: stats.before.size, materialsAfter: stats.after.size, skipped: stats.skipped };
}
