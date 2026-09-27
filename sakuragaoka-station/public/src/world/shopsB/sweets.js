// Modelled wagashi pieces (instanced through K.I). Every builder takes the parent, K and the
// position of the piece's bottom centre on a surface; rot = rotation about Y.
import * as THREE from 'three';

const G = (p, x, y, z, rotY = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; p.add(g); return g; };

export const SWEETS = {
  /** 桜もち (Kanto chōmeiji style): pink crêpe roll wrapped in a salted cherry leaf. */
  sakura(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('sph', g, [0, 0.009, 0], [0.068, 0.018, 0.05], '#7f8a45');           // leaf underneath
    K.I.add('sph', g, [0, 0.019, 0], [0.058, 0.028, 0.034], '#f2a9bd');          // pink roll
    K.I.add('sph', g, [0.012, 0.03, 0.004], [0.036, 0.012, 0.042], '#8c9a4c', [0, 0, -0.35]); // leaf flap over the top
  },
  /** 三色だんご / みたらし / あん on a bamboo skewer lying on the tray (along local x). */
  dango(p, K, x, y, z, rot = 0, kind = 'sanshoku') {
    const g = G(p, x, y, z, rot);
    K.I.add('cylc', g, [0.012, 0.013, 0], [0.0045, 0.14, 0.0045], '#d9c08a', [0, 0, Math.PI / 2]);
    const cols = kind === 'mitarashi' ? ['#c98a4e', '#c98a4e', '#c98a4e'] : kind === 'an' ? ['#5a3040', '#5a3040', '#5a3040'] : ['#f2a7bb', '#f3efe4', '#9cc27a'];
    cols.forEach((c, i) => K.I.add('sph', g, [-0.028 + i * 0.027, 0.013, 0], [0.027, 0.025, 0.026], c));
    if (kind === 'mitarashi') K.I.add('sph', g, [0, 0.022, 0], [0.084, 0.01, 0.028], '#b06a34');   // glaze
  },
  /** どら焼き */
  dora(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('sph', g, [0, 0.008, 0], [0.078, 0.017, 0.078], '#c9884a');
    K.I.add('disc', g, [0, 0.012, 0], [0.07, 0.007, 0.07], '#5a3040');
    K.I.add('sph', g, [0, 0.022, 0], [0.078, 0.022, 0.078], '#a8642f');
    K.I.add('disc', g, [0, 0.0325, 0], [0.028, 0.0015, 0.028], '#7a4424');        // branded mark
  },
  /** 酒まんじゅう / 栗まんじゅう */
  manju(p, K, x, y, z, rot = 0, brown = false) {
    const g = G(p, x, y, z, rot);
    K.I.add('sph', g, [0, 0.016, 0], [0.052, 0.034, 0.052], brown ? '#c28550' : '#f1e6d2');
    K.I.add('disc', g, [0, 0.0315, 0], [0.018, 0.0015, 0.018], brown ? '#7a4424' : '#b87a7a');
    if (brown) K.I.add('sph', g, [0, 0.03, 0], [0.028, 0.006, 0.028], '#8e5028');
  },
  /** 大福 (豆大福 with black beans) */
  daifuku(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('sph', g, [0, 0.017, 0], [0.052, 0.034, 0.052], '#f4f0e8');
    for (let i = 0; i < 3; i++) { const a = i * 2.2 + 0.4; K.I.add('ball', g, [Math.cos(a) * 0.016, 0.028 - (i % 2) * 0.004, Math.sin(a) * 0.016], [0.011, 0.008, 0.011], '#4a3a4a'); }
  },
  /** いちご大福 */
  ichigo(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('sph', g, [0, 0.018, 0], [0.052, 0.036, 0.052], '#f7eef0');
    K.I.add('sph', g, [0.004, 0.036, 0.006], [0.022, 0.024, 0.022], '#d9463b');
    K.I.add('disc', g, [0.004, 0.047, 0.006], [0.014, 0.003, 0.014], '#5f8c4c');
  },
  /** 柏もち: white mochi half-moon in an oak leaf. */
  kashiwa(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('sph', g, [0, 0.008, 0], [0.074, 0.016, 0.054], '#5f7a40');
    K.I.add('sph', g, [0, 0.019, 0], [0.062, 0.03, 0.036], '#f1ede4');
    K.I.add('sph', g, [0, 0.03, -0.012], [0.07, 0.01, 0.03], '#6f8a4a', [0.5, 0, 0]);
  },
  /** 草もち */
  kusa(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('sph', g, [0, 0.016, 0], [0.052, 0.032, 0.052], '#8aa865');
    K.I.add('sph', g, [0, 0.03, 0], [0.03, 0.008, 0.03], '#9dba78');
  },
  /** 練り切り (sakura flower) */
  nerikiri(p, K, x, y, z, rot = 0, col = '#f6c3d2') {
    const g = G(p, x, y, z, rot);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; K.I.add('sph', g, [Math.cos(a) * 0.012, 0.015, Math.sin(a) * 0.012], [0.03, 0.026, 0.026], col, [0, -a, 0]); }
    K.I.add('ball', g, [0, 0.03, 0], [0.012, 0.008, 0.012], '#f2d36a');
  },
  /** もなか (shell-shaped wafer) */
  monaka(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('rbox', g, [0, 0, 0], [0.06, 0.028, 0.06], '#d9b57e', [0, Math.PI / 4, 0]);
    K.I.add('disc', g, [0, 0.028, 0], [0.04, 0.002, 0.04], '#c49a60');
  },
  /** 羊羹 bar (whole), optionally in gold foil / matcha / sakura layer. */
  yokan(p, K, x, y, z, rot = 0, kind = 'neri') {
    const g = G(p, x, y, z, rot);
    const c = { neri: '#5a2a36', matcha: '#5f7a3a', foil: '#c9a45a', sakura: '#6a3040' }[kind];
    K.I.add('rbox', g, [0, 0, 0], [0.19, 0.032, 0.052], c);
    if (kind === 'sakura') K.I.add('rbox', g, [0, 0.03, 0], [0.19, 0.01, 0.052], '#f0a6bb');
    if (kind === 'foil') K.I.add('box', g, [0.03, 0.032, 0], [0.05, 0.002, 0.053], '#b8423c');
  },
  /** sliced yokan fanned on a small plate */
  yokanSlices(p, K, x, y, z, rot = 0) {
    const g = G(p, x, y, z, rot);
    K.I.add('dish', g, [0, 0, 0], [0.14, 0.12, 0.14], '#e9e4d8');
    for (let i = 0; i < 4; i++) K.I.add('box', g, [-0.03 + i * 0.02, 0.006, 0], [0.013, 0.034, 0.048], '#5a2a36', [0, 0, -0.22]);
  },
};

/** Lacquer tray with rims + washi sheet; returns top y of the sheet. */
export function lacquerTray(p, K, x, y, z, w, d, color = '#7a2e2e') {
  K.I.add('box', p, [x, y, z], [w, 0.01, d], color);
  for (const s of [-1, 1]) { K.I.add('box', p, [x, y + 0.01, z + s * (d / 2 - 0.004)], [w, 0.014, 0.008], color); K.I.add('box', p, [x + s * (w / 2 - 0.004), y + 0.01, z], [0.008, 0.014, d - 0.016], color); }
  K.I.add('box', p, [x, y + 0.01, z], [w - 0.03, 0.002, d - 0.03], '#f4efe4');
  return y + 0.012;
}
/** Fill a tray (w × d centred at x,z) with a grid of one kind of sweet. */
export function fillTray(p, K, kind, x, y, z, w, d, cols, rows, rnd, extra) {
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = x - w / 2 + w * (i + 0.5) / cols + rnd.range(-0.004, 0.004), pz = z - d / 2 + d * (j + 0.5) / rows + rnd.range(-0.003, 0.003);
    SWEETS[kind](p, K, px, y, pz, rnd.range(-0.15, 0.15) + (kind === 'dango' ? 0 : 0), extra);
  }
}
/** Folded paper tent card (two planes) standing on a surface, text faces +Z. */
export function tentCard(p, K, x, y, z, rotY, tex, w = 0.075, h = 0.042) {
  const g = G(p, x, y, z, rotY);
  const a = 0.28;
  const m = K.im('#ffffff', 0.38, { map: tex });
  const f = K.plane(g, w, h, m, [0, Math.cos(a) * h / 2, Math.sin(a) * h / 2 + 0.002], 0, -a);
  const b = K.plane(g, w, h, K.im('#f4efe4', 0.3), [0, Math.cos(a) * h / 2, -Math.sin(a) * h / 2], Math.PI, a);
  void f; void b;
  return g;
}
/** Small vase with a cherry-blossom branch (interior, instanced blossoms). */
export function sakuraBranch(p, K, x, y, z, h, rnd, vase = '#6b86a8') {
  K.cyl(p, 0.04, 0.16, K.im(vase, 0.3), [x, y + 0.08, z], 12, null, 0.05);
  const bark = K.im('#6a5448', 0.2);
  const br = [[0, 0, 0.08, h, 0.05], [0.02, h * 0.45, 0.2, h * 0.85, -0.3], [-0.02, h * 0.3, -0.18, h * 0.7, 0.2]];
  for (const [x0, y0, x1, y1] of br) {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(x1 - x0, y1 - y0);
    K.cyl(p, 0.006, len, bark, [x + (x0 + x1) / 2, y + 0.16 + (y0 + y1) / 2, z], 5, [0, 0, -ang]);
    for (let k = 0; k < 11; k++) { const t = 0.25 + 0.75 * k / 10; K.I.add('sph', p, [x + x0 + (x1 - x0) * t + rnd.range(-0.035, 0.035), y + 0.16 + y0 + (y1 - y0) * t + rnd.range(-0.025, 0.025), z + rnd.range(-0.035, 0.035)], 0.024 + rnd() * 0.012, k % 3 ? '#f6c9d6' : '#f0b0c4'); }
  }
}
