// Petal textures computed analytically in JS (deterministic, identical in node and the browser).
//  - shapeTex  (RGBA, linear data): R = sharp alpha, G = edge mask (1 at the rim), B = vein pattern,
//                                    A = soft/defocused alpha. Used by the custom petal shaders.
//  - colorTex  (RGBA, sRGB):        painted petal (base deeper pink -> pale body) + sharp alpha,
//                                    for the toon ground petals (instance colour tints it).
//  - raftTex   (RGBA, sRGB, 2x2 atlas): dense petal rafts (花筏) for the river.
// Texture space: u across the petal (0..1), v from the base/claw (0) to the notched tip (1).
import * as THREE from 'three';

// right half of the outline, from the claw (base) up to the bottom of the tip notch
const HALF = [
  [0.0, 0.02], [0.05, 0.045], [0.105, 0.1], [0.175, 0.19], [0.25, 0.3], [0.32, 0.43], [0.378, 0.56],
  [0.418, 0.675], [0.432, 0.77], [0.418, 0.855], [0.378, 0.922], [0.318, 0.966], [0.248, 0.986],
  [0.176, 0.982], [0.112, 0.955], [0.062, 0.915], [0.026, 0.878], [0.0, 0.86],
];

function catmull(pts, sub) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Closed outline polygon in (U in -0.5..0.5, V in 0..1). */
export function petalOutline() {
  const r = catmull(HALF, 4);
  const l = r.slice(1, -1).reverse().map(([u, v]) => [-u, v]);
  return r.concat(l);
}

function makeSDF(N) {
  const poly = petalOutline();
  const n = poly.length;
  const sdf = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const v = (j + 0.5) / N;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N - 0.5;
      let dmin = 1e9, inside = false;
      for (let k = 0, m = n - 1; k < n; m = k++) {
        const [ax, ay] = poly[m], [bx, by] = poly[k];
        if ((ay > v) !== (by > v) && u < (bx - ax) * (v - ay) / (by - ay) + ax) inside = !inside;
        const ex = bx - ax, ey = by - ay, wx = u - ax, wy = v - ay;
        const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
        const dx = wx - ex * t, dy = wy - ey * t;
        const d = dx * dx + dy * dy; if (d < dmin) dmin = d;
      }
      sdf[j * N + i] = (inside ? -1 : 1) * Math.sqrt(dmin);
    }
  }
  return sdf;
}

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function veinAt(u, v) {
  const a = Math.atan2(u, v + 0.1);
  const lines = Math.pow(0.5 + 0.5 * Math.cos(a * 26), 8);
  const crease = Math.exp(-(u * u) / 0.0009) * 0.6;
  return Math.min(1, (lines * 0.8 + crease) * sstep(0.08, 0.4, v) * (1 - sstep(0.78, 0.95, v)));
}

function dataTex(data, N, srgb) {
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export function createPetalTextures(rng) {
  const N = 128;
  const sdf = makeSDF(N);
  const shape = new Uint8Array(N * N * 4);
  const color = new Uint8Array(N * N * 4);
  const aa = 1.3 / N;
  // painted colours (sRGB 0..1): claw (base) a deeper pink, body pale, tip lightest
  const cBase = [0.93, 0.66, 0.76], cBody = [0.975, 0.925, 0.945], cTip = [0.985, 0.95, 0.96];
  for (let j = 0; j < N; j++) {
    const v = (j + 0.5) / N;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N - 0.5;
      const d = sdf[j * N + i];
      const sharp = Math.max(0, Math.min(1, 0.5 - d / aa));
      const edge = 1 - sstep(0.0, 0.11, -d);
      const vein = veinAt(u, v);
      const soft = sstep(0.12, -0.16, d);
      const o = (j * N + i) * 4;
      shape[o] = Math.round(sharp * 255); shape[o + 1] = Math.round(edge * 255);
      shape[o + 2] = Math.round(vein * 255); shape[o + 3] = Math.round(soft * 255);
      const kb = 1 - sstep(0.02, 0.36, v), kt = sstep(0.7, 1.0, v);
      for (let c = 0; c < 3; c++) {
        let x = cBody[c] * (1 - kb) + cBase[c] * kb;
        x = x * (1 - kt * 0.6) + cTip[c] * kt * 0.6;
        x *= 1 - 0.05 * vein;
        x *= 1 + 0.02 * edge; // very slightly lighter rim
        color[o + c] = Math.round(Math.min(1, x) * 255);
      }
      // colour texture alpha: slightly dilated so mip levels don't darken the rim
      color[o + 3] = Math.round(sharp * 255);
    }
  }
  // bleed rim colours outward (avoid dark fringes in mipmaps where alpha = 0)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const o = (j * N + i) * 4;
    if (color[o + 3] > 0) continue;
    color[o] = Math.round(cBody[0] * 255); color[o + 1] = Math.round(cBody[1] * 255); color[o + 2] = Math.round(cBody[2] * 255);
  }
  const shapeTex = dataTex(shape, N, false);
  const colorTex = dataTex(color, N, true);

  // --------------------------------------------------------------- river rafts (花筏) 2x2 atlas
  const RN = 512, CELL = 256;
  const raft = new Uint8Array(RN * RN * 4);
  const acc = new Float32Array(RN * RN * 4); // premultiplied accumulation
  // anti-aliased coverage from the bilinear signed distance (px = stamp size in pixels)
  let stampPx = 16;
  const sampleSharp = (u, v) => { // u in -0.5..0.5, v in 0..1
    const fx = (u + 0.5) * N - 0.5, fy = v * N - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return 0;
    const tx = fx - i, ty = fy - j, o = j * N + i;
    const d = (sdf[o] * (1 - tx) + sdf[o + 1] * tx) * (1 - ty) + (sdf[o + N] * (1 - tx) + sdf[o + N + 1] * tx) * ty;
    return Math.max(0, Math.min(1, 0.5 - d * stampPx));
  };
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * CELL, oy = Math.floor(cell / 2) * CELL;
    // organic blob: union of 3-6 ellipses elongated along u (the flow direction)
    const blobs = [];
    // cells 0,1: rounded clumps; cells 2,3: long ribbons that gather along the banks
    const ribbon = cell >= 2;
    const nb = ribbon ? 5 + Math.floor(rng() * 3) : 3 + Math.floor(rng() * 4);
    for (let b = 0; b < nb; b++) blobs.push(ribbon
      ? { x: 0.12 + (b + rng() * 0.6) / nb * 0.78, y: 0.5 + (rng() - 0.5) * 0.12, rx: 0.1 + rng() * 0.1, ry: 0.045 + rng() * 0.04 }
      : { x: 0.5 + (rng() - 0.5) * 0.46, y: 0.5 + (rng() - 0.5) * 0.3, rx: 0.14 + rng() * 0.2, ry: 0.08 + rng() * 0.1 });
    const dens = (x, y) => {
      let s = 0;
      for (const b of blobs) { const dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry; s += Math.exp(-(dx * dx + dy * dy) * 1.6); }
      return Math.min(1, s);
    };
    // underlying sheet where the raft is dense (so no water shows through its core)
    for (let py = 0; py < CELL; py++) for (let px = 0; px < CELL; px++) {
      const x = (px + 0.5) / CELL, y = (py + 0.5) / CELL;
      const edgeFade = Math.min(1, Math.min(x, 1 - x, y, 1 - y) / 0.08);
      const a = Math.max(0, Math.min(1, (dens(x, y) * edgeFade - 0.62) / 0.12));
      if (a <= 0) continue;
      const o = ((oy + py) * RN + ox + px) * 4;
      const m = 0.9 + 0.06 * Math.sin(px * 0.21 + py * 0.13) * Math.sin(py * 0.17 - px * 0.07);
      acc[o] = 0.95 * m * a; acc[o + 1] = 0.83 * m * a; acc[o + 2] = 0.87 * m * a; acc[o + 3] = a;
    }
    const stamps = 3200;
    for (let k = 0; k < stamps; k++) {
      const x = 0.05 + rng() * 0.9, y = 0.05 + rng() * 0.9;
      const dn = dens(x, y);
      if (rng() > dn * 1.25) continue;
      const size = (0.03 + rng() * 0.02) * CELL; // petal length in px
      stampPx = size;
      const ang = rng() * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const tone = rng();
      const col = [0.97 - tone * 0.05, 0.9 - tone * 0.17, 0.93 - tone * 0.12];
      const dim = 0.9 + rng() * 0.1 - (1 - dn) * 0.05;
      const cx = ox + x * CELL, cy = oy + y * CELL, R = size * 0.6;
      for (let py = Math.floor(cy - R); py <= Math.ceil(cy + R); py++) {
        if (py < oy || py >= oy + CELL) continue;
        for (let px = Math.floor(cx - R); px <= Math.ceil(cx + R); px++) {
          if (px < ox || px >= ox + CELL) continue;
          const dx = (px + 0.5 - cx) / size, dy = (py + 0.5 - cy) / size;
          const lu = (dx * ca + dy * sa) / 0.8, lv = (-dx * sa + dy * ca) + 0.5;
          const a = sampleSharp(lu, lv);
          if (a <= 0) continue;
          const shade = dim * (1 - 0.12 * (1 - lv)); // a touch deeper at the claw
          const o = (py * RN + px) * 4;
          const inv = 1 - a;
          acc[o] = acc[o] * inv + col[0] * shade * a; acc[o + 1] = acc[o + 1] * inv + col[1] * shade * a;
          acc[o + 2] = acc[o + 2] * inv + col[2] * shade * a; acc[o + 3] = acc[o + 3] * inv + a;
        }
      }
    }
  }
  for (let i = 0; i < RN * RN; i++) {
    const o = i * 4, a = acc[o + 3];
    if (a > 0.001) { raft[o] = Math.round(Math.min(1, acc[o] / a) * 255); raft[o + 1] = Math.round(Math.min(1, acc[o + 1] / a) * 255); raft[o + 2] = Math.round(Math.min(1, acc[o + 2] / a) * 255); }
    else { raft[o] = 242; raft[o + 1] = 220; raft[o + 2] = 228; }
    raft[o + 3] = Math.round(Math.min(1, a) * 255);
  }
  const raftTex = dataTex(raft, RN, true);

  // --------------------------------------------------------------- ground carpet patches, 2x2 atlas
  // cells 0,1: clumpy drifts; cells 2,3: wind-combed streaks (elongated along u). Loose petals at the
  // ragged edges, overlapping petals in the core, no solid sheet (the paving shows between).
  const PN = 1024, PC = 512;
  const pacc = new Float32Array(PN * PN * 4);
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * PC, oy = Math.floor(cell / 2) * PC;
    const streaky = cell >= 2;
    const blobs = [];
    const nb = streaky ? 3 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 4);
    for (let b = 0; b < nb; b++) blobs.push(streaky
      ? { x: 0.5 + (rng() - 0.5) * 0.4, y: 0.5 + (rng() - 0.5) * 0.3, rx: 0.2 + rng() * 0.18, ry: 0.12 + rng() * 0.12 }
      : { x: 0.5 + (rng() - 0.5) * 0.46, y: 0.5 + (rng() - 0.5) * 0.46, rx: 0.08 + rng() * 0.14, ry: 0.07 + rng() * 0.12 });
    const dens = (x, y) => { let s = 0; for (const b of blobs) { const dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry; s += Math.exp(-(dx * dx + dy * dy) * 1.3); } return Math.min(1, s); };
    // streak cells are laid on patches 3x longer than wide: stamp petals 3x taller in v so they
    // come out undistorted on the ground
    const AV = streaky ? 3 : 1;
    const stamps = streaky ? 3800 : 2600;
    for (let k = 0; k < stamps; k++) {
      const x = 0.04 + rng() * 0.92, y = 0.04 + rng() * 0.92;
      const dn = dens(x, y);
      if (rng() > dn * 1.1 + 0.012) continue;
      const size = (streaky ? 0.015 + rng() * 0.007 : 0.026 + rng() * 0.012) * PC;
      stampPx = size;
      const ang = streaky ? (rng() - 0.5) * 1.4 + (rng() < 0.5 ? 0 : Math.PI) : rng() * Math.PI * 2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const tone = rng(), aged = rng() < 0.05;
      const col = aged ? [0.84, 0.7, 0.66] : [0.975 - tone * 0.04, 0.9 - tone * 0.2, 0.93 - tone * 0.14];
      const dim = 0.93 + rng() * 0.07;
      const cx = ox + x * PC, cy = oy + y * PC, R = size * 0.6;
      for (let py = Math.floor(cy - R * AV); py <= Math.ceil(cy + R * AV); py++) {
        if (py < oy + 1 || py >= oy + PC - 1) continue;
        for (let px = Math.floor(cx - R); px <= Math.ceil(cx + R); px++) {
          if (px < ox + 1 || px >= ox + PC - 1) continue;
          const dx = (px + 0.5 - cx) / size, dy = (py + 0.5 - cy) / (size * AV);
          const lu = (dx * ca + dy * sa) / 0.78, lv = (-dx * sa + dy * ca) + 0.5;
          const a = sampleSharp(lu, lv);
          if (a <= 0) continue;
          const shade = dim * (1 - 0.14 * (1 - lv));
          const o = (py * PN + px) * 4, inv = 1 - a;
          // a hint of contact shadow where a petal overlaps another
          const under = pacc[o + 3] > 0.5 ? 0.94 : 1;
          pacc[o] = pacc[o] * inv * under + col[0] * shade * a; pacc[o + 1] = pacc[o + 1] * inv * under + col[1] * shade * a;
          pacc[o + 2] = pacc[o + 2] * inv * under + col[2] * shade * a; pacc[o + 3] = pacc[o + 3] * inv + a;
        }
      }
    }
  }
  const pdat = new Uint8Array(PN * PN * 4);
  for (let i = 0; i < PN * PN; i++) {
    const o = i * 4, a = pacc[o + 3];
    if (a > 0.001) { pdat[o] = Math.round(Math.min(1, pacc[o] / a) * 255); pdat[o + 1] = Math.round(Math.min(1, pacc[o + 1] / a) * 255); pdat[o + 2] = Math.round(Math.min(1, pacc[o + 2] / a) * 255); }
    else { pdat[o] = 244; pdat[o + 1] = 214; pdat[o + 2] = 224; }
    pdat[o + 3] = Math.round(Math.min(1, a) * 255);
  }
  const patchTex = dataTex(pdat, PN, true);
  return { shapeTex, colorTex, raftTex, patchTex };
}
