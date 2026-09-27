// shopsB shared modelled interior props (all real geometry; canvas textures only for flat graphics
// such as dial faces, labels and calendars). Every function builds a Group at (x,y,z) rotated by rotY
// in parent space; local +Z is the object's front. Interior variants use K.im (warm self-light).
import * as THREE from 'three';

const G = (p, x, y, z, rotY = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; p.add(g); return g; };
export const grp = G;

/** Cylinder between two points (parent space). */
export function tube(p, a, b, r, m, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = new THREE.Vector3().subVectors(B, A), len = d.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  mesh.position.copy(A).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh); return mesh;
}

// ------------------------------------------------------------------------------------------- figures
/** Maneki-neko (招き猫): calico, right paw raised, gold koban. s = height (m). */
export function manekiNeko(p, K, x, y, z, s = 0.3, rotY = 0, interior = false) {
  const g = G(p, x, y, z, rotY); g.scale.setScalar(s / 0.3);
  const f = (c) => interior ? K.im(c, 0.3) : K.m(c);
  const white = f('#f3efe6'), red = f('#c9463e'), gold = f('#e3bd52'), ink = f('#3a3346'), orange = f('#e2a04e'), pinkM = f('#f0a6b6');
  K.sph(g, 0.1, white, [0, 0.09, 0], 14, [1, 0.95, 0.85]);
  K.sph(g, 0.085, white, [0, 0.23, 0.01], 14, [1.1, 0.95, 0.95]);
  for (const sx of [-1, 1]) { const e = K.cyl(g, 0.0, 0.05, white, [sx * 0.055, 0.31, 0.0], 6, [0, 0, sx * -0.3], 0.03); e.scale.set(1, 0.06, 1); }
  for (const sx of [-1, 1]) K.sph(g, 0.012, pinkM, [sx * 0.056, 0.305, 0.018], 6);
  K.sph(g, 0.03, orange, [0.045, 0.285, 0.03], 8, [1.2, 0.6, 1]);
  K.sph(g, 0.03, ink, [-0.07, 0.12, 0.04], 8, [0.9, 1, 0.6]);
  for (const sx of [-1, 1]) K.box(g, 0.026, 0.008, 0.01, ink, [sx * 0.033, 0.235, 0.088], [0, 0, sx * 0.25]);
  K.sph(g, 0.008, pinkM, [0, 0.215, 0.093], 6);
  for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) K.box(g, 0.035, 0.003, 0.003, ink, [sx * 0.07, 0.205 - k * 0.012, 0.085], [0, 0, sx * (0.12 - k * 0.2)]);
  K.cyl(g, 0.078, 0.018, red, [0, 0.16, 0.012], 14);
  K.sph(g, 0.018, gold, [0, 0.145, 0.08], 8);
  K.sph(g, 0.03, white, [0.085, 0.3, 0.035], 8, [0.9, 1.4, 0.9]);
  K.sph(g, 0.012, pinkM, [0.085, 0.32, 0.06], 6);
  K.box(g, 0.08, 0.1, 0.012, gold, [-0.04, 0.09, 0.09], [0, 0, 0.1]);
  K.box(g, 0.05, 0.004, 0.004, f('#8a6a2a'), [-0.04, 0.1, 0.097], [0, 0, 0.1]);
  K.sph(g, 0.028, white, [-0.06, 0.1, 0.075], 8);
  return g;
}
/** Daruma doll. */
export function daruma(p, K, x, y, z, s = 0.14, rotY = 0) {
  const g = G(p, x, y, z, rotY); g.scale.setScalar(s / 0.14);
  K.sph(g, 0.07, K.im('#c9463e', 0.3), [0, 0.068, 0], 12, [1, 1.02, 0.95]);
  K.sph(g, 0.036, K.im('#f3ead8', 0.3), [0, 0.085, 0.045], 10, [1.05, 1, 0.5]);
  for (const sx of [-1, 1]) K.sph(g, 0.009, K.im(sx < 0 ? '#3a3346' : '#f3ead8', 0.3), [sx * 0.014, 0.09, 0.062], 6);
  K.box(g, 0.05, 0.02, 0.01, K.im('#e3bd52', 0.3), [0, 0.035, 0.065]);
  return g;
}

// ------------------------------------------------------------------------------------------- counter tools
/** Soroban (abacus) lying flat; long axis along local x. */
export function abacus(p, K, x, y, z, rotY = 0) {
  const g = G(p, x, y, z, rotY);
  const wood = K.im('#5a3a2a', 0.28), rod = K.im('#c9b48a', 0.3);
  const L = 0.34, D = 0.1;
  for (const sz of [-1, 1]) K.box(g, L, 0.022, 0.012, wood, [0, 0.011, sz * (D / 2 - 0.006)]);
  for (const sx of [-1, 1]) K.box(g, 0.012, 0.022, D, wood, [sx * (L / 2 - 0.006), 0.011, 0]);
  K.box(g, L - 0.02, 0.018, 0.008, wood, [0, 0.012, -0.018]);                      // beam
  const n = 13;
  for (let i = 0; i < n; i++) {
    const rx = -L / 2 + 0.02 + (L - 0.04) * (i + 0.5) / n;
    K.I.add('cylc', g, [rx, 0.012, 0], [0.003, D - 0.02, 0.003], '#c9b48a', [Math.PI / 2, 0, 0]);
    const cnt = (i * 7) % 5;                                                         // a few beads pushed to the beam
    K.I.add('ball', g, [rx, 0.012, -0.034 + ((i % 3) === 0 ? 0.008 : 0)], [0.02, 0.013, 0.013], '#6a4432');
    for (let b = 0; b < 4; b++) K.I.add('ball', g, [rx, 0.012, (b < cnt ? -0.006 : 0.004) + b * 0.0115], [0.02, 0.013, 0.012], '#6a4432');
  }
  void rod;
  return g;
}
/** Desk calculator (flat, tilted keypad). */
export function calculator(p, K, x, y, z, rotY = 0) {
  const g = G(p, x, y, z, rotY);
  const body = K.im('#e7e3da', 0.3);
  K.rbox(g, 0.12, 0.018, 0.16, 0.2, body, [0, 0.012, 0], [0.06, 0, 0]);
  K.box(g, 0.1, 0.004, 0.035, K.lamp(0.85, '#b9c6b3'), [0, 0.024, -0.05], [0.06, 0, 0]);
  K.box(g, 0.1, 0.004, 0.016, K.im('#3a3346', 0.1), [0, 0.024, -0.075], [0.06, 0, 0]);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) K.I.add('rbox', g, [-0.036 + i * 0.024, 0.018 + j * 0.0015, -0.02 + j * 0.021], [0.018, 0.008, 0.016], j === 0 && i === 3 ? '#d9463b' : (i === 3 ? '#9aa6b3' : '#f4f1ea'), [0.06, 0, 0]);
  return g;
}
/** Showa cash register: body, sloped key bank, flag display, drawer, crank. */
export function register(p, K, x, y, z, rotY = 0, o = {}) {
  const g = G(p, x, y, z, rotY), I = K.I;
  const body = K.im(o.color || '#8f9a8c', 0.24), dark = K.im('#4f5358', 0.18), chrome = K.im('#d3d7da', 0.36), brass = K.im('#c9a45a', 0.32);
  K.box(g, 0.4, 0.11, 0.38, body, [0, 0.055, 0]);                                    // cash drawer
  K.box(g, 0.42, 0.012, 0.4, chrome, [0, 0.114, 0]);
  K.box(g, 0.3, 0.018, 0.006, dark, [0, 0.06, 0.192]);
  K.cyl(g, 0.012, 0.03, brass, [0, 0.06, 0.2], 8, [Math.PI / 2, 0, 0]);
  K.box(g, 0.36, 0.14, 0.24, body, [0, 0.19, -0.06]);                                 // key housing
  K.box(g, 0.34, 0.02, 0.19, dark, [0, 0.2, 0.08], [-0.55, 0, 0]);                    // sloped key bed
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) I.add('cyl', g, [-0.14 + i * 0.056, 0.195 + 0.035 - j * 0.023, 0.14 - j * 0.037], [0.03, 0.022, 0.03], j === 3 ? (i === 5 ? '#d9463b' : '#e8c547') : '#f2eee4', [-0.55, 0, 0]);
  K.box(g, 0.3, 0.1, 0.12, body, [0, 0.31, -0.11]);                                    // flag display
  K.box(g, 0.31, 0.012, 0.13, chrome, [0, 0.366, -0.11]);
  for (const s of [1, -1]) K.box(g, 0.25, 0.05, 0.004, K.lamp(1.0, '#f5ecd2'), [0, 0.315, -0.11 + s * 0.061]);
  K.box(g, 0.14, 0.03, 0.004, brass, [0, 0.13, 0.121]);                               // maker plate
  K.cyl(g, 0.016, 0.08, chrome, [0.22, 0.19, -0.05], 8, [0, 0, Math.PI / 2]);           // crank
  K.box(g, 0.012, 0.09, 0.012, chrome, [0.265, 0.15, -0.05]);
  K.sph(g, 0.018, dark, [0.265, 0.1, -0.05], 8);
  return g;
}
/** Kitchen / shop dial scale (はかり) with a round face. */
export function scale(p, K, x, y, z, rotY = 0) {
  const g = G(p, x, y, z, rotY);
  const body = K.im('#e3ded2', 0.3), red = K.im('#c9463e', 0.3);
  K.rboxR(g, 0.26, 0.08, 0.24, 0.03, body, [0, 0.04, 0]);
  K.cyl(g, 0.11, 0.2, body, [0, 0.18, 0.02], 20, [Math.PI / 2, 0, 0]);
  K.cyl(g, 0.115, 0.02, red, [0, 0.18, 0.12], 20, [Math.PI / 2, 0, 0]);
  const face = K.tex.draw(128, 128, (c, w, h) => {
    c.fillStyle = '#f7f3ea'; c.beginPath(); c.arc(w / 2, h / 2, 62, 0, 7); c.fill();
    c.strokeStyle = '#3a3346'; c.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const a = -Math.PI * 0.8 + i / 39 * Math.PI * 1.6; const r0 = i % 5 ? 48 : 42; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * r0, h / 2 - Math.cos(a) * r0); c.lineTo(w / 2 + Math.sin(a) * 55, h / 2 - Math.cos(a) * 55); c.stroke(); }
    c.fillStyle = '#3a3346'; c.font = '700 14px sans-serif'; c.textAlign = 'center'; c.fillText('1kg', w / 2, h * 0.72);
    c.strokeStyle = '#d9463b'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 20, h / 2 - 38); c.stroke();
  }, { key: 'sb-scale-face' });
  K.plane(g, 0.19, 0.19, K.im('#ffffff', 0.35, { map: face }), [0, 0.18, 0.132]);
  K.cyl(g, 0.02, 0.06, body, [0, 0.31, 0.02], 8);
  K.cyl(g, 0.14, 0.015, K.im('#c9ccd0', 0.32), [0, 0.345, 0.02], 20);                  // pan
  K.cyl(g, 0.13, 0.03, K.im('#c9ccd0', 0.32), [0, 0.36, 0.02], 20, null, 0.14);
  return g;
}
/** Retro transistor radio. */
export function radio(p, K, x, y, z, rotY = 0, color = '#b8423c') {
  const g = G(p, x, y, z, rotY);
  const body = K.im(color, 0.3), cream = K.im('#efe7d4', 0.3), chrome = K.im('#c9ccd0', 0.32);
  K.rboxR(g, 0.3, 0.17, 0.09, 0.03, body, [0, 0.085, 0]);
  K.rboxR(g, 0.13, 0.12, 0.012, 0.01, cream, [-0.06, 0.085, 0.046]);
  for (let i = 0; i < 6; i++) K.box(g, 0.11, 0.006, 0.006, K.im('#8e877c', 0.2), [-0.06, 0.04 + i * 0.018, 0.053]);     // grille slats
  K.box(g, 0.1, 0.035, 0.006, K.im('#f5ecd2', 0.45), [0.08, 0.12, 0.046]);                                              // tuning dial window
  K.box(g, 0.002, 0.03, 0.008, K.im('#d9463b', 0.3), [0.07, 0.12, 0.05]);
  for (const kx of [0.055, 0.105]) K.cyl(g, 0.017, 0.02, chrome, [kx, 0.055, 0.05], 12, [Math.PI / 2, 0, 0]);
  for (const sx of [-0.12, 0.12]) K.box(g, 0.012, 0.06, 0.012, chrome, [sx, 0.2, 0]);
  K.box(g, 0.25, 0.012, 0.012, chrome, [0, 0.23, 0]);                                                                   // handle
  tube(g, [0.13, 0.17, -0.03], [0.02, 0.5, -0.06], 0.003, chrome, 5);                                                    // antenna
  return g;
}
/** CRT television (ブラウン管テレビ) on a wall bracket or standing. screen faces +Z. */
export function crtTV(p, K, x, y, z, rotY = 0, o = {}) {
  const g = G(p, x, y, z, rotY);
  const body = K.im(o.color || '#8a8f96', 0.22), dark = K.im('#4f5358', 0.18);
  K.rboxR(g, 0.52, 0.42, 0.34, 0.05, body, [0, 0.21, 0.02]);
  K.rboxR(g, 0.36, 0.3, 0.2, 0.06, dark, [0, 0.22, -0.2]);                           // tube back
  K.rboxR(g, 0.4, 0.31, 0.02, 0.03, K.lamp(o.glow ?? 1.0, o.screen || '#aac8dc'), [-0.04, 0.23, 0.19]);
  K.plane(g, 0.3, 0.2, K.memo('emi', '#ffffff', { map: tvScreenTex(K) }, o.glow ?? 1.0), [-0.04, 0.23, 0.2005]);
  K.box(g, 0.07, 0.3, 0.01, dark, [0.21, 0.22, 0.19]);
  for (let i = 0; i < 3; i++) K.cyl(g, 0.012, 0.02, K.im('#c9ccd0', 0.3), [0.21, 0.32 - i * 0.07, 0.2], 8, [Math.PI / 2, 0, 0]);
  if (o.antenna) { tube(g, [0.05, 0.42, -0.05], [-0.18, 0.72, -0.1], 0.004, K.im('#c9ccd0', 0.3), 5); tube(g, [0.07, 0.42, -0.05], [0.28, 0.7, -0.08], 0.004, K.im('#c9ccd0', 0.3), 5); }
  return g;
}
function tvScreenTex(K) {
  return K.tex.draw(192, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fc6e6'); gr.addColorStop(0.62, '#dfeaf0'); gr.addColorStop(0.63, '#9bc27e'); gr.addColorStop(1, '#6f9a5a');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f6c9d6'; for (let i = 0; i < 18; i++) { c.beginPath(); c.arc(20 + (i * 37) % 160, 30 + (i * 23) % 50, 9, 0, 7); c.fill(); }
    c.fillStyle = '#6a5448'; c.fillRect(40, 50, 8, 34); c.fillRect(130, 46, 8, 38);
    c.fillStyle = 'rgba(40,40,60,0.55)'; c.fillRect(0, h - 26, w, 26);
    c.fillStyle = '#fbf6ee'; c.font = '700 15px sans-serif'; c.fillText('桜の便り  各地で満開', 10, h - 8);
    c.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
  }, { key: 'sb-tv-screen' });
}
/** Oscillating electric fan (扇風機). stand: floor stand, else wall mount (back at z=0). */
export function fan(p, K, x, y, z, rotY = 0, o = {}) {
  const g = G(p, x, y, z, rotY);
  const body = K.im(o.color || '#e9e5dc', 0.3), blue = K.im(o.blade || '#8fc0d8', 0.35), chrome = K.im('#c9ccd0', 0.32);
  let hy = 0;
  if (o.stand) {
    K.cyl(g, 0.17, 0.05, body, [0, 0.025, 0], 16, null, 0.19);
    K.cyl(g, 0.018, 0.8, chrome, [0, 0.45, 0], 8);
    hy = 0.9;
  } else {
    K.rboxR(g, 0.12, 0.16, 0.03, 0.01, body, [0, 0, 0.015]);
    K.box(g, 0.03, 0.03, 0.14, body, [0, 0, 0.09]);
    hy = 0; g.position.z += 0;
  }
  const head = G(g, 0, hy, o.stand ? 0 : 0.16, 0); head.rotation.x = o.stand ? -0.08 : 0.25;
  K.sph(head, 0.07, body, [0, 0, -0.05], 12, [1, 1, 1.3]);
  K.cyl(head, 0.03, 0.05, chrome, [0, 0, 0.05], 10, [Math.PI / 2, 0, 0]);
  for (const zz of [0.03, 0.11]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.006, 4, 28), chrome); r.position.set(0, 0, zz); head.add(r); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI; K.box(head, 0.004, 0.37, 0.004, chrome, [0, 0, 0.115]).rotation.z = a; }
  K.cyl(head, 0.035, 0.012, K.im('#8fc0d8', 0.35), [0, 0, 0.118], 12, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.3; const b = K.sph(head, 0.075, blue, [Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.07], 10, [1, 0.62, 0.08]); b.rotation.z = a; }
  return g;
}
/** Pendulum wall clock (柱時計). back at z=0, faces +Z. */
export function pendulumClock(p, K, x, y, z, rotY = 0) {
  const g = G(p, x, y, z, rotY);
  const wood = K.im('#6a4432', 0.28), brass = K.im('#d1ad5c', 0.35);
  K.rboxR(g, 0.3, 0.62, 0.1, 0.02, wood, [0, 0, 0.05]);
  K.box(g, 0.34, 0.04, 0.12, wood, [0, 0.32, 0.05]); K.box(g, 0.34, 0.04, 0.12, wood, [0, -0.32, 0.05]);
  K.cyl(g, 0.115, 0.012, brass, [0, 0.14, 0.1], 20, [Math.PI / 2, 0, 0]);
  const face = K.tex.draw(128, 128, (c, w, h) => {
    c.fillStyle = '#f4efe2'; c.beginPath(); c.arc(w / 2, h / 2, 60, 0, 7); c.fill();
    c.fillStyle = '#3a3346'; c.font = '700 14px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; c.fillText(['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ'][i - 1], w / 2 + Math.sin(a) * 47, h / 2 - Math.cos(a) * 47); }
    c.strokeStyle = '#3a3346'; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 26, h / 2 + 9); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 18, h / 2 - 34); c.stroke();
  }, { key: 'sb-pclock-face' });
  K.plane(g, 0.2, 0.2, K.im('#ffffff', 0.35, { map: face }), [0, 0.14, 0.108]);
  const win = K.box(g, 0.17, 0.26, 0.004, K.glass({ opacity: 0.18, streaks: false }), [0, -0.15, 0.101]); win.castShadow = false; K.ctx.noOutline(win);
  K.box(g, 0.006, 0.2, 0.006, brass, [0, -0.12, 0.08]);
  K.cyl(g, 0.035, 0.008, brass, [0, -0.23, 0.08], 14, [Math.PI / 2, 0, 0]);
  return g;
}
/** Wall calendar: board-backed sheet on a nail (faces +Z, back at z = 0). */
export function calendar(p, K, x, y, z, rotY, texture, w = 0.36, h = 0.52) {
  const g = G(p, x, y, z, rotY);
  K.box(g, w, h, 0.004, K.im('#e4ddcd', 0.3), [0, 0, 0.002]);
  K.plane(g, w - 0.01, h - 0.01, K.im('#ffffff', 0.32, { map: texture }), [0, 0, 0.0055]);
  K.box(g, w + 0.01, 0.018, 0.01, K.im('#b8423c', 0.3), [0, h / 2 - 0.009, 0.006]);
  K.cyl(g, 0.004, 0.02, K.im('#8d949b', 0.3), [0, h / 2 + 0.02, 0.01], 5, [Math.PI / 2, 0, 0]);
  return g;
}
/** Showa milk-glass pendant lamp (+ cord via wires). Returns bulb height. */
export function pendant(S, K, x, yCeil, yLamp, z, o = {}) {
  const ctx = K.ctx, g = S.g;
  const p = S.w2(x, z); ctx.wires.add([[p.x, S.f.y + yCeil, p.z], [p.x, S.f.y + yLamp + 0.2, p.z]], { width: 0.007, color: '#3a3346' });
  K.cyl(g, 0.025, 0.05, K.im('#6a4432', 0.25), [x, yLamp + 0.2, z], 10);
  if (o.kind === 'shade') {
    K.lathe(g, [[0.02, 0.2], [0.09, 0.16], [0.2, 0.02], [0.21, 0]], K.im(o.color || '#e8d9b8', 0.5, { side: 'double' }), [x, yLamp, z], 16);
  } else {
    // frosted milk-glass bell with a scalloped rim
    K.lathe(g, [[0.03, 0.2], [0.07, 0.19], [0.13, 0.12], [0.17, 0.03], [0.185, 0.0], [0.17, -0.005]], K.lamp(o.glow ?? 1.05, o.color || '#fff0d6'), [x, yLamp, z], 18);
  }
  K.sph(g, 0.055, K.lamp(1.6, '#fff1d4'), [x, yLamp + 0.05, z], 10);
  if (o.pullCord) { const q = S.w2(x + 0.1, z); ctx.wires.add([[q.x, S.f.y + yLamp + 0.02, q.z], [q.x, S.f.y + yLamp - 0.35, q.z]], { width: 0.004, color: '#e9e2d0' }); K.sph(g, 0.012, K.im('#e9e2d0', 0.3), [x + 0.1, yLamp - 0.36, z], 6); }
  return yLamp;
}

// ------------------------------------------------------------------------------------------- furniture
/** Round wooden stool (丸椅子) or steel stool with vinyl top (o.steel). */
export function stool(p, K, x, y, z, o = {}) {
  const g = G(p, x, y, z, o.rotY || 0);
  const h = o.h ?? 0.45;
  if (o.steel) {
    const st = K.im('#b9bfc4', 0.28);
    K.cyl(g, 0.15, 0.02, st, [0, 0.01, 0], 14);
    K.cyl(g, 0.022, h - 0.07, st, [0, (h - 0.07) / 2 + 0.02, 0], 8);
    K.cyl(g, 0.12, 0.02, st, [0, 0.2, 0], 14);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 4, 18), st); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
    K.cyl(g, 0.165, 0.07, K.im(o.color || '#c9463e', 0.3), [0, h - 0.035, 0], 16, null, 0.155);
    K.cyl(g, 0.155, 0.012, K.im('#e0dcd4', 0.3), [0, h - 0.074, 0], 16);
  } else {
    const wood = K.im(o.color || '#a57c58', 0.3, { map: K.T.grain }), dark = K.im('#6e5040', 0.26);
    K.cyl(g, 0.16, 0.04, wood, [0, h - 0.02, 0], 16);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const lx = Math.cos(a) * 0.11, lz = Math.sin(a) * 0.11; tube(g, [lx * 0.8, h - 0.04, lz * 0.8], [lx * 1.25, 0, lz * 1.25], 0.014, dark, 6); }
    for (let i = 0; i < 2; i++) { const a = i * Math.PI / 2 + Math.PI / 4; K.box(g, 0.25, 0.018, 0.018, dark, [0, 0.16, 0]).rotation.y = a; }
  }
  return g;
}
/** Zabuton cushion. */
export function zabuton(p, K, x, y, z, rotY = 0, color = '#8e3b56') {
  const g = G(p, x, y, z, rotY);
  K.rbox(g, 0.52, 0.07, 0.56, 0.3, K.im(color, 0.28), [0, 0.035, 0]);
  K.box(g, 0.3, 0.004, 0.02, K.im('#e9cf8a', 0.3), [0, 0.071, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.sph(g, 0.012, K.im('#e9cf8a', 0.3), [sx * 0.24, 0.05, sz * 0.26], 6);
  return g;
}
/** Chabudai (round low folding table). */
export function chabudai(p, K, x, y, z, r = 0.38, h = 0.33) {
  const g = G(p, x, y, z, 0);
  const wood = K.im('#8a5a3a', 0.3, { map: K.T.grain }), dark = K.im('#5a3a2a', 0.26);
  K.cyl(g, r, 0.03, wood, [0, h - 0.015, 0], 28);
  K.cyl(g, r + 0.006, 0.012, dark, [0, h - 0.035, 0], 28);
  for (const [lx, lz] of [[0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]]) K.box(g, 0.035, h - 0.04, 0.035, dark, [lx, (h - 0.04) / 2, lz]);
  K.box(g, 0.44, 0.03, 0.03, dark, [0, h - 0.07, 0]); K.box(g, 0.03, 0.03, 0.44, dark, [0, h - 0.07, 0]);
  return g;
}
/** Kyusu (side-handle teapot) + optional cups. */
export function kyusu(p, K, x, y, z, rotY = 0, color = '#8a5a44') {
  const g = G(p, x, y, z, rotY);
  const c = K.im(color, 0.3);
  K.lathe(g, [[0, 0], [0.04, 0], [0.058, 0.02], [0.062, 0.045], [0.05, 0.075], [0.03, 0.08], [0, 0.08]], c, [0, 0, 0], 14);
  K.cyl(g, 0.034, 0.012, c, [0, 0.086, 0], 12);
  K.sph(g, 0.009, c, [0, 0.096, 0], 6);
  tube(g, [0.05, 0.035, 0], [0.095, 0.075, 0], 0.009, c, 6);                     // spout (+x)
  tube(g, [0, 0.045, 0.055], [0, 0.05, 0.13], 0.012, c, 6);                      // side handle (+z, 90° to spout)
  return g;
}
export function yunomi(p, K, x, y, z, color = '#9fb3a8', h = 0.075, r = 0.03) {
  K.I.add('tumbler', p, [x, y, z], [r * 2, h, r * 2], color);
  K.I.add('disc', p, [x, y + h - 0.012, z], [r * 1.7, 0.004, r * 1.7], '#9c7a3e');          // tea surface
}
/** Tissue box with a tuft of tissue. */
export function tissueBox(p, K, x, y, z, rotY = 0, color = '#a9cfc0') {
  const g = G(p, x, y, z, rotY);
  K.box(g, 0.24, 0.08, 0.12, K.im('#f1ece2', 0.3), [0, 0.04, 0]);
  K.box(g, 0.242, 0.03, 0.122, K.im(color, 0.3), [0, 0.025, 0]);
  K.box(g, 0.1, 0.004, 0.03, K.im('#d9d4c6', 0.2), [0, 0.081, 0]);
  const t = K.sph(g, 0.03, K.im('#fbf9f4', 0.4), [0, 0.1, 0], 8, [1.6, 0.9, 0.5]); t.rotation.z = 0.25;
  return g;
}
/** Stainless water pitcher. */
export function pitcher(p, K, x, y, z, rotY = 0) {
  const g = G(p, x, y, z, rotY);
  const st = K.im('#c9ced3', 0.34);
  K.lathe(g, [[0, 0], [0.055, 0], [0.058, 0.01], [0.06, 0.15], [0.055, 0.2], [0.062, 0.215], [0.058, 0.215], [0, 0.2]], st, [0, 0, 0], 16);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 5, 12, Math.PI), st); h.position.set(-0.065, 0.12, 0); h.rotation.z = Math.PI / 2; g.add(h);
  K.box(g, 0.03, 0.01, 0.03, st, [0.065, 0.21, 0], [0, 0, -0.3]);
  K.cyl(g, 0.05, 0.004, K.im('#dfeef4', 0.45), [0, 0.19, 0], 14);
  return g;
}
/** Umbrella stand with 3 umbrellas. */
export function umbrellaStand(p, K, x, y, z) {
  const g = G(p, x, y, z, 0);
  K.cyl(g, 0.12, 0.42, K.im('#8a8f94', 0.26), [0, 0.21, 0], 14, null, 0.11);
  K.cyl(g, 0.125, 0.03, K.im('#6d747c', 0.26), [0, 0.42, 0], 14);
  const cols = ['#3f4f7e', '#c9463e', '#e9e2d0'];
  cols.forEach((c, i) => {
    const a = i * 2.1, ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05;
    const u = G(g, ox, 0, oz, 0); u.rotation.set(Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1);
    K.cyl(u, 0.03, 0.55, K.im(c, 0.3), [0, 0.45, 0], 8, null, 0.012);
    K.cyl(u, 0.006, 0.2, K.im('#b8b0a0', 0.3), [0, 0.82, 0], 5);
    const hk = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 10, Math.PI), K.im('#6a4432', 0.3)); hk.position.set(0.03, 0.92, 0); u.add(hk);
  });
  return g;
}

// ------------------------------------------------------------------------------------------- shrine shelf
/** Kamidana (神棚): shelf with brackets, miniature shrine, sakaki vases, shimenawa + shide, offerings.
 *  Back at z = 0 (against the wall), faces +Z. */
export function kamidana(p, K, x, y, z, rotY = 0, w = 0.8) {
  const g = G(p, x, y, z, rotY);
  const wood = K.im('#d8c19a', 0.32, { map: K.T.grain }), roof = K.im('#6d6e72', 0.2), white = K.im('#f4f1ea', 0.38);
  K.box(g, w, 0.03, 0.3, wood, [0, 0, 0.15]);
  for (const sx of [-w / 2 + 0.08, w / 2 - 0.08]) { K.box(g, 0.03, 0.18, 0.03, wood, [sx, -0.1, 0.015]); tube(g, [sx, -0.18, 0.02], [sx, -0.02, 0.26], 0.012, wood, 5); }
  const sh = G(g, 0, 0.015, 0.13, 0);
  K.box(sh, 0.32, 0.03, 0.18, wood, [0, 0.015, 0]);                         // base
  K.box(sh, 0.16, 0.16, 0.11, wood, [0, 0.11, -0.01]);                       // honden
  for (const sx of [-1, 1]) K.box(sh, 0.078, 0.13, 0.004, K.im('#e2cfa6', 0.34), [sx * 0.04, 0.105, 0.047]);
  K.cyl(sh, 0.018, 0.004, K.im('#f0dca0', 0.5), [0, 0.12, 0.05], 12, [Math.PI / 2, 0, 0]);   // mirror
  for (const sd of [-1, 1]) K.box(sh, 0.22, 0.012, 0.11, roof, [0, 0.215, sd * 0.042], [sd * 0.55, 0, 0]);
  K.box(sh, 0.23, 0.02, 0.02, roof, [0, 0.245, 0]);
  for (const sx of [-0.1, 0.1]) { K.I.add('stick', sh, [sx, 0.24, 0], [0.006, 0.05, 0.006], '#6d6e72', [0, 0, sx > 0 ? -0.5 : 0.5]); }
  K.box(sh, 0.24, 0.02, 0.06, wood, [0, 0.035, 0.1]);                        // steps
  // sakaki in white vases both sides
  for (const sx of [-w / 2 + 0.13, w / 2 - 0.13]) {
    K.I.add('tumbler', g, [sx, 0.015, 0.16], [0.045, 0.08, 0.045], '#f2efe8');
    for (let i = 0; i < 7; i++) { const a = i * 0.9; K.I.add('sph', g, [sx + Math.cos(a) * 0.028, 0.12 + (i % 3) * 0.035, 0.16 + Math.sin(a) * 0.022], [0.04, 0.018, 0.028], i % 2 ? '#3f6a4a' : '#4f7a52', [0, a, 0.7 * Math.cos(a)]); }
    K.I.add('stick', g, [sx, 0.08, 0.16], [0.006, 0.12, 0.006], '#6a5040');
  }
  // offerings: rice, salt, water
  for (const [ox, c] of [[-0.12, '#f4f1ea'], [0.0, '#f7f7f4'], [0.12, '#e9eef0']]) { K.I.add('dish', g, [ox, 0.015, 0.265], [0.06, 0.1, 0.06], '#f2efe8'); K.I.add('sph', g, [ox, 0.03, 0.265], [0.03, 0.02, 0.03], c); }
  // shimenawa rope + shide paper zig-zags
  const rope = K.cylX(g, 0.018, w - 0.05, K.im('#d8c38a', 0.35), [0, 0.33, 0.29], 8);
  void rope;
  for (let i = 0; i < 4; i++) {
    const sx = -w * 0.3 + i * w * 0.2;
    for (let k = 0; k < 4; k++) K.box(g, 0.022, 0.03, 0.003, white, [sx + (k % 2 ? 0.012 : -0.004), 0.3 - k * 0.028, 0.3]);
  }
  for (let i = 0; i < 5; i++) K.cyl(g, 0.006, 0.05, K.im('#d8c38a', 0.35), [-w * 0.35 + i * w * 0.175, 0.29, 0.29], 5);
  return g;
}

// ------------------------------------------------------------------------------------------- shelving
/** Open wooden shelf unit: back panel, sides, plinth, shelves at `levels` (heights of shelf tops).
 *  w along local x, d depth (front at +z), back at z = 0. Returns the shelf-top list. */
export function shelfUnit(p, K, x, y, z, rotY, w, d, h, levels, o = {}) {
  const g = G(p, x, y, z, rotY);
  const wood = o.mat || K.im('#a57c58', 0.3, { map: K.T.grain }), dark = o.dark || K.im('#6e5040', 0.26, { map: K.T.grain });
  if (o.back !== false) K.tbox(g, w, h, 0.02, o.backMat || dark, [0, h / 2, 0.01], 1);
  for (const sx of [-1, 1]) K.tbox(g, 0.03, h, d, wood, [sx * (w / 2 - 0.015), h / 2, d / 2], 1);
  K.tbox(g, w, 0.08, d - 0.02, dark, [0, 0.04, d / 2 + 0.005], 1);
  K.tbox(g, w + 0.02, 0.03, d + 0.01, wood, [0, h - 0.015, d / 2], 1);
  for (const lv of levels) { K.tbox(g, w - 0.06, 0.022, d - 0.02, wood, [0, lv - 0.011, d / 2], 1); if (o.lip) K.box(g, w - 0.06, 0.03, 0.01, o.lip, [0, lv + 0.004, d - 0.01]); }
  return g;
}
