// 大人の顔の手描きテクスチャと、頭に貼るシェーダー
// 頭のローカル座標（頭の中心が原点）を、角度 θ = atan(x, z) の弧長 X = θ·R と高さ Y で平らに開く（kid/textures.js と同じ）。
// 4 列 × 3 段のアトラス。瞳は別のマスにして、白目の形で切り抜きながら動かせる（視線）。
import * as THREE from 'three';

export const CELL = {
  base: [0, 0], sclera: [1, 0], iris: [2, 0], lashes: [3, 0],
  closed: [0, 1], happy: [1, 1], alt: [2, 1], brows: [3, 1],
  mouthRest: [0, 2], mouthOpen: [1, 2], mouthHalf: [2, 2], mouthGrin: [3, 2],
};
const COLS = 4, ROWS = 3;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- 目の形（白目の輪郭）: 内側 → 上まぶた → 外側 → 下まぶた ----------
// s = +1: 本人の左目（X が正）。E = { x, y, w, h }, o = { tilt: 目じりの上がり, top, bot: 上下の丸み }
function eyePath(ctx, s, E, o) {
  const x = s * E.x, y = E.y;
  const xi = x - s * E.w, xo = x + s * E.w;
  const yi = y - E.h * 0.12, yo = y + E.h * o.tilt;
  ctx.beginPath();
  ctx.moveTo(xi, yi);
  ctx.bezierCurveTo(xi + s * E.w * 0.25, y + E.h * o.top, xo - s * E.w * 0.5, y + E.h * (o.top + 0.05), xo, yo);
  ctx.bezierCurveTo(xo - s * E.w * 0.2, y - E.h * o.bot, xi + s * E.w * 0.35, y - E.h * (o.bot + 0.08), xi, yi);
  ctx.closePath();
}
// 上まぶたの線だけ（まつげの帯）
function upperLid(ctx, s, E, o, ext = 0) {
  const x = s * E.x, y = E.y;
  const xi = x - s * E.w, xo = x + s * E.w;
  const yi = y - E.h * 0.12, yo = y + E.h * o.tilt;
  ctx.beginPath();
  ctx.moveTo(xi + s * E.w * 0.05, yi + E.h * 0.08);
  ctx.bezierCurveTo(xi + s * E.w * 0.25, y + E.h * o.top, xo - s * E.w * 0.5, y + E.h * (o.top + 0.05), xo + s * ext, yo + ext * 0.35);
}

// 顔の描き方（登場人物ごと）
const STYLE = {
  natsumi: {
    eye: { tilt: 0.42, top: 1.05, bot: 0.78 },
    iris: { rx: 0.8, ry: 0.93, cols: ['#1d100b', '#2f1a10', '#6b3a1c', '#b0703a'], pupil: 0.44 },
    lash: { col: '#1a0f0b', w: 0.0021, wing: 0.0042, lower: true },
    brow: { col: '#3a2419', w: 0.0115, thick: 0.0021, arch: 0.0012, tilt: 0.06, bushy: 0 },
    blush: 0.3, lip: '#d97f78', mouthCol: '#8a3a33', mole: true, altSide: -1,
  },
  isogai: {
    eye: { tilt: -0.05, top: 0.82, bot: 0.62 },
    iris: { rx: 0.72, ry: 0.98, cols: ['#140c08', '#23150e', '#4a2d1a', '#6e4a2c'], pupil: 0.5 },
    lash: { col: '#20160f', w: 0.0019, wing: 0.0008, lower: false },
    brow: { col: '#403833', w: 0.0142, thick: 0.0036, arch: 0.0015, tilt: -0.1, bushy: 1 },
    blush: 0.12, lip: '#b86f5f', mouthCol: '#6e3027', mole: false, altSide: 0, old: true,
  },
};

export function faceAtlas(id, F) {
  const st = STYLE[id];
  const PX = 640, W = F.W, Y1 = F.Y1, Y0 = F.Y0;
  const PY = Math.round(PX * (Y1 - Y0) / W);
  const cv = canvas(PX * COLS, PY * ROWS);
  const ctx = cv.getContext('2d');
  const S = PX / W;
  const cell = ([cx, cy], draw) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(cx * PX + 2, cy * PY + 2, PX - 4, PY - 4); ctx.clip();
    ctx.translate(cx * PX + PX / 2, cy * PY + Y1 * S);
    ctx.scale(S, -S);
    draw(ctx);
    ctx.restore();
  };
  const E = F.eye, eo = st.eye;
  const ellipse = (x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const radial = (x, y, r, col, a, sx = 1) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); ctx.translate(-x, -y);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };
  const line = (pts, w, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };

  // ---- 下地: ほお・鼻・くちびる・しわ ----
  cell(CELL.base, () => {
    for (const s of [-1, 1]) {
      radial(s * (E.x + 0.009), E.y - E.h * 1.6, 0.017, 'rgba(236,110,100,A)', st.blush, 1.5);
      // 目のくぼみ（上まぶたの陰り）
      radial(s * E.x, E.y + E.h * 0.9, 0.013, 'rgba(150,80,60,A)', st.old ? 0.16 : 0.1, 1.6);
    }
    // 鼻すじのハイライトと鼻の下の陰
    radial(0, F.noseY + 0.012, 0.01, 'rgba(255,235,220,A)', 0.18, 0.6);
    radial(0, F.noseY - 0.006, 0.008, 'rgba(150,70,50,A)', 0.18, 1.3);
    // 鼻の穴（小さな陰）
    for (const s of [-1, 1]) { ellipse(s * 0.0042, F.noseY - 0.0032, 0.0019, 0.0011, s * 0.3); ctx.fillStyle = 'rgba(110,50,35,0.35)'; ctx.fill(); }
    if (!st.old) {
      // くちびる（下くちびるの色）
      radial(0, F.mouthY - 0.0035, 0.0085, `rgba(${hexRGB(st.lip)},A)`, 0.5, 1.6);
      if (st.mole) { ellipse(-(E.x + E.w * 0.62), E.y - E.h * 0.98, 0.00095, 0.00095); ctx.fillStyle = '#5a3326'; ctx.fill(); }
    } else {
      radial(0, F.mouthY - 0.004, 0.009, `rgba(${hexRGB(st.lip)},A)`, 0.3, 1.6);
      // ほうれい線・目じりのしわ・目の下
      ctx.globalAlpha = 0.35;
      for (const s of [-1, 1]) {
        line([[s * 0.013, F.noseY - 0.002], [s * 0.024, F.noseY - 0.018], [s * 0.026, F.mouthY - 0.012]], 0.0011, '#7a4230');
        for (let k = 0; k < 3; k++) line([[s * (E.x + E.w + 0.002), E.y + 0.002 - k * 0.003], [s * (E.x + E.w + 0.007), E.y + 0.003 - k * 0.0045]], 0.0006, '#7a4230');
        line([[s * (E.x - E.w * 0.6), E.y - E.h * 1.25], [s * E.x, E.y - E.h * 1.55], [s * (E.x + E.w * 0.7), E.y - E.h * 1.2]], 0.0007, '#8a5040');
      }
      // 額のしわ
      for (let k = 0; k < 2; k++) line([[-0.022, F.browY + 0.013 + k * 0.006], [0, F.browY + 0.015 + k * 0.006], [0.022, F.browY + 0.013 + k * 0.006]], 0.0006, '#8a5040');
      ctx.globalAlpha = 1;
      // あごの青み（ひげの剃りあと）
      radial(0, F.mouthY - 0.024, 0.03, 'rgba(90,95,110,A)', 0.13, 1.6);
    }
  });

  // ---- 白目（瞳の切り抜きにも使う）----
  cell(CELL.sclera, () => {
    for (const s of [-1, 1]) {
      eyePath(ctx, s, E, eo);
      const g = ctx.createLinearGradient(0, E.y + E.h, 0, E.y - E.h);
      g.addColorStop(0, '#e9e2dc'); g.addColorStop(0.4, '#fbf8f4'); g.addColorStop(1, '#fdfbf8');
      ctx.fillStyle = g; ctx.fill();
    }
  });

  // ---- 瞳（アトラスの中で左右の目の位置に描く。シェーダーがずらす）----
  cell(CELL.iris, () => {
    const I = st.iris;
    for (const s of [-1, 1]) {
      const x = s * E.x, y = E.y - E.h * 0.04, rx = E.w * I.rx, ry = E.h * I.ry;
      const g = ctx.createLinearGradient(0, y + ry, 0, y - ry);
      g.addColorStop(0, I.cols[0]); g.addColorStop(0.4, I.cols[1]); g.addColorStop(0.78, I.cols[2]); g.addColorStop(1, I.cols[3]);
      ellipse(x, y, rx, ry); ctx.fillStyle = g; ctx.fill();
      // 虹彩のすじ
      ctx.save(); ellipse(x, y, rx, ry); ctx.clip();
      ctx.strokeStyle = 'rgba(255,200,140,0.12)'; ctx.lineWidth = 0.00035;
      for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rx * 0.45, y + Math.sin(a) * ry * 0.45); ctx.lineTo(x + Math.cos(a) * rx * 0.95, y + Math.sin(a) * ry * 0.95); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth = 0.0006; ctx.strokeStyle = 'rgba(15,8,5,0.8)'; ellipse(x, y, rx, ry); ctx.stroke();
      ellipse(x, y + ry * 0.02, rx * I.pupil, ry * I.pupil * 1.02); ctx.fillStyle = '#0a0504'; ctx.fill();
      // ハイライト（光は左上から）
      ellipse(x - rx * 0.32, y + ry * 0.42, rx * 0.3, ry * 0.22, 0.4); ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill();
      ellipse(x + rx * 0.36, y - ry * 0.42, rx * 0.12, ry * 0.09); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      // 下の反射
      ctx.save(); ellipse(x, y, rx, ry); ctx.clip();
      radial(x, y - ry * 0.75, rx * 0.8, 'rgba(255,200,150,A)', 0.25, 1.4);
      ctx.restore();
    }
  });

  // ---- まつげ・二重・上まぶたの影 ----
  cell(CELL.lashes, () => {
    const Lc = st.lash;
    for (const s of [-1, 1]) {
      // 白目の上の影（まぶたの厚み）
      ctx.save();
      eyePath(ctx, s, E, eo); ctx.clip();
      const g = ctx.createLinearGradient(0, E.y + E.h * 1.1, 0, E.y + E.h * 0.2);
      g.addColorStop(0, 'rgba(70,35,25,0.55)'); g.addColorStop(1, 'rgba(70,35,25,0)');
      ctx.fillStyle = g; ctx.fillRect(s * E.x - E.w * 1.2, E.y, E.w * 2.4, E.h * 1.3);
      ctx.restore();
      // 上まつげ
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      upperLid(ctx, s, E, eo, Lc.wing);
      ctx.strokeStyle = Lc.col; ctx.lineWidth = Lc.w; ctx.stroke();
      // 目じりのはね（夏海はきりっと上へ）
      if (Lc.wing > 0.002) {
        const xo = s * (E.x + E.w), yo = E.y + E.h * eo.tilt;
        ctx.beginPath(); ctx.moveTo(xo - s * 0.003, yo + 0.0012); ctx.quadraticCurveTo(xo + s * 0.002, yo + 0.0016, xo + s * 0.0052, yo + 0.0038);
        ctx.lineWidth = Lc.w * 0.8; ctx.stroke();
        // まつげの毛先
        for (let k = 0; k < 3; k++) {
          const t = 0.55 + k * 0.17, px = s * E.x + s * E.w * (t * 2 - 1), py = E.y + E.h * (eo.top * 0.9 - (t - 0.5) * 0.3);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s * 0.0022, py + 0.0022 + k * 0.0004); ctx.lineWidth = 0.0008; ctx.stroke();
        }
      }
      // 二重の線
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(s * E.x + s * E.w * 0.08, E.y + E.h * 0.28, E.w * 0.95, E.h * (eo.top * 0.95), 0, s > 0 ? Math.PI * 0.15 : Math.PI * 0.3, s > 0 ? Math.PI * 0.7 : Math.PI * 0.85);
      ctx.lineWidth = 0.0007; ctx.strokeStyle = st.old ? '#6a3a2a' : '#7a4030'; ctx.stroke();
      ctx.globalAlpha = 1;
      // 下まぶた
      ctx.beginPath();
      ctx.ellipse(s * E.x, E.y + E.h * 0.08, E.w * 0.95, E.h * eo.bot, 0, Math.PI * (s > 0 ? 1.12 : 1.3), Math.PI * (s > 0 ? 1.7 : 1.88));
      ctx.lineWidth = Lc.lower ? 0.0009 : 0.0007; ctx.strokeStyle = Lc.lower ? 'rgba(40,20,14,0.7)' : 'rgba(90,50,35,0.5)'; ctx.stroke();
    }
  });

  // ---- 閉じた目（まばたき）----
  cell(CELL.closed, () => {
    for (const s of [-1, 1]) {
      const x = s * E.x, y = E.y - E.h * 0.2;
      line([[x - E.w * 0.95, y + 0.001], [x, y - E.h * 0.42], [x + E.w * 0.95, y + 0.001 + s * 0]], st.lash.w, st.lash.col);
      if (st.lash.wing > 0.002) line([[x + s * E.w * 0.9, y + 0.0005], [x + s * (E.w + 0.004), y + 0.002]], st.lash.w * 0.7, st.lash.col);
    }
  });

  // ---- にっこり（^ ^）----
  cell(CELL.happy, () => {
    for (const s of [-1, 1]) {
      const x = s * E.x, y = E.y - E.h * 0.1;
      line([[x - E.w * 0.95, y - E.h * 0.3], [x, y + E.h * 0.62], [x + E.w * 0.95, y - E.h * 0.3]], st.lash.w * 1.15, st.lash.col);
      if (st.old) line([[x + s * (E.w + 0.002), y - 0.001], [x + s * (E.w + 0.007), y + 0.001]], 0.0006, '#7a4230');
    }
  });

  // ---- もう 1 つの目: 夏海 = 右目のウインク、博士 = 目を閉じて「うむ」----
  cell(CELL.alt, () => {
    for (const s of [-1, 1]) {
      if (st.altSide && s !== st.altSide) continue;
      const x = s * E.x, y = E.y - E.h * 0.1;
      if (st.altSide) {
        // ウインク: 「>」に近い閉じ
        line([[x - s * E.w * 0.95, y + E.h * 0.35], [x + s * E.w * 0.2, y - E.h * 0.05], [x + s * E.w * 0.95, y - E.h * 0.25]], st.lash.w * 1.1, st.lash.col);
      } else {
        line([[x - E.w * 0.95, y - E.h * 0.05], [x, y - E.h * 0.28], [x + E.w * 0.95, y - E.h * 0.05]], st.lash.w * 1.2, st.lash.col);
      }
    }
  });

  // ---- 眉 ----
  cell(CELL.brows, () => {
    const b = st.brow;
    for (const s of [-1, 1]) {
      const x = s * (E.x + 0.001), y = F.browY;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(s * -b.tilt); ctx.scale(s, 1);
      ctx.fillStyle = b.col;
      if (!b.bushy) {
        ctx.beginPath();
        ctx.moveTo(-b.w, -b.thick * 0.6);
        ctx.quadraticCurveTo(-b.w * 0.2, b.thick * 1.2 + b.arch, b.w, b.thick * 0.1 + b.arch * 0.3);
        ctx.quadraticCurveTo(b.w * 1.02, -b.thick * 0.3, b.w * 0.85, -b.thick * 0.4);
        ctx.quadraticCurveTo(-b.w * 0.2, b.thick * 0.1 + b.arch, -b.w, -b.thick * 0.6 - b.thick);
        ctx.closePath(); ctx.fill();
      } else {
        // 太いごま塩の眉: 短い毛を重ねる
        const r = rng(s > 0 ? 3 : 9);
        for (let k = 0; k < 150; k++) {
          const u = r() * 2 - 1, yy = (r() - 0.5) * b.thick * (1.2 - Math.abs(u) * 0.5) + b.arch * (1 - u * u);
          const px = u * b.w, a = 0.25 + u * 0.3 + (r() - 0.5) * 0.3;
          ctx.strokeStyle = r() < 0.3 ? '#9a938a' : b.col; ctx.lineWidth = 0.0007;
          ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px + Math.cos(a) * 0.0035, yy + Math.sin(a) * 0.0018); ctx.stroke();
        }
      }
      ctx.restore();
    }
  });

  // ---- 口 ----
  const M = F.mouthY, mw = st.old ? 0.0115 : 0.0095;
  cell(CELL.mouthRest, () => {
    line([[-mw, M + 0.0012], [0, M - 0.0022], [mw, M + 0.0012]], st.old ? 0.0013 : 0.0012, st.mouthCol);
    for (const s of [-1, 1]) line([[s * mw * 0.95, M + 0.0014], [s * mw * 1.12, M + 0.0024]], 0.0008, st.mouthCol);
  });
  const openMouth = (w, h, teeth, tongue) => {
    ctx.beginPath();
    ctx.moveTo(-w, M + 0.0022);
    ctx.quadraticCurveTo(0, M + 0.0008 + h * 0.08, w, M + 0.0022);
    ctx.quadraticCurveTo(w * 0.72, M - h, 0, M - h * 1.05);
    ctx.quadraticCurveTo(-w * 0.72, M - h, -w, M + 0.0022);
    ctx.closePath();
    ctx.fillStyle = '#5a1f1b'; ctx.fill();
    ctx.save(); ctx.clip();
    if (tongue) { ellipse(0, M - h * 0.95, w * 0.7, h * 0.4); ctx.fillStyle = '#d2645c'; ctx.fill(); }
    if (teeth) { ctx.fillStyle = '#fbf6ee'; ctx.fillRect(-w, M - 0.0003, w * 2, 0.0024); }
    ctx.restore();
    ctx.lineJoin = 'round'; ctx.strokeStyle = st.mouthCol; ctx.lineWidth = 0.0009; ctx.stroke();
    if (!st.old) radial(0, M - h - 0.002, 0.007, `rgba(${hexRGB(st.lip)},A)`, 0.35, 1.5);
  };
  cell(CELL.mouthOpen, () => openMouth(mw * 1.05, 0.0105, true, true));
  cell(CELL.mouthHalf, () => openMouth(mw * 1.1, 0.0052, true, false));
  cell(CELL.mouthGrin, () => openMouth(mw * 1.35, 0.0085, true, true));

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 8;
  return t;
}

function rng(seed) { let s = seed | 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function hexRGB(h) { const v = parseInt(h.slice(1), 16); return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`; }

// ---------- 頭の素材（肌＋顔の模様）----------
// u: uBlink 0..1, uEyes 0 = 開き 1 = にっこり 2 = もう 1 つ, uMouth 0..3（rest/open/half/grin）, uLook: 瞳のずれ (m), uBrow: 眉の上下 (m), uBrowTilt
export function faceMaterial(id, F, atlas, skin) {
  const st = STYLE[id];
  const m = new THREE.MeshPhysicalMaterial({ ...skin });
  const u = {
    uFace: { value: atlas }, uBlink: { value: 0 }, uEyes: { value: 0 }, uMouth: { value: 0 },
    uLook: { value: new THREE.Vector2() }, uBrow: { value: 0 }, uBrowTilt: { value: 0 },
  };
  m.userData.face = u;
  const H = F.Y1 - F.Y0;
  const cs = (k) => `vec2(${CELL[k][0]}.0, ${CELL[k][1]}.0)`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeadPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vHeadPos;
uniform sampler2D uFace; uniform float uBlink, uEyes, uMouth, uBrow, uBrowTilt; uniform vec2 uLook;
vec4 faceCell(vec2 uv, vec2 c) { uv = clamp(uv, 0.003, 0.997); return texture2D(uFace, (c + uv) / vec2(${COLS}.0, ${ROWS}.0)); }
vec3 over(vec3 base, vec4 f, float k) { return mix(base, f.rgb, f.a * k); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float th = atan(vHeadPos.x, vHeadPos.z);
  float X = th * ${F.R.toFixed(4)};
  vec2 uv = vec2(X / ${F.W.toFixed(4)} + 0.5, (${F.Y1.toFixed(4)} - vHeadPos.y) / ${H.toFixed(4)});
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * smoothstep(0.0, 0.03, vHeadPos.z);
  if (inside > 0.0) {
    vec3 c = over(diffuseColor.rgb, faceCell(uv, ${cs('base')}), 1.0);
    float side = X > 0.0 ? 1.0 : -1.0;
    float altEye = ${st.altSide ? `(side == ${st.altSide.toFixed(1)} ? 1.0 : 0.0)` : '1.0'};
    float mode0 = uEyes < 0.5 ? 1.0 : 0.0, mode1 = uEyes > 0.5 && uEyes < 1.5 ? 1.0 : 0.0, mode2 = uEyes > 1.5 ? 1.0 : 0.0;
    float awake = mode0 + mode2 * (1.0 - altEye);   // この目は開いている
    float open = awake * (1.0 - uBlink);
    vec4 sc = faceCell(uv, ${cs('sclera')});
    c = over(c, sc, open);
    vec4 ir = faceCell(uv - vec2(uLook.x / ${F.W.toFixed(4)}, -uLook.y / ${H.toFixed(4)}), ${cs('iris')});
    c = mix(c, ir.rgb, ir.a * sc.a * open);
    c = over(c, faceCell(uv, ${cs('lashes')}), open);
    c = over(c, faceCell(uv, ${cs('closed')}), awake * uBlink);
    c = over(c, faceCell(uv, ${cs('happy')}), mode1);
    c = over(c, faceCell(uv, ${cs('alt')}), mode2);
    float by = uBrow + uBrowTilt * (abs(X) - ${(F.eye.x).toFixed(4)});
    c = over(c, faceCell(uv + vec2(0.0, by / ${H.toFixed(4)}), ${cs('brows')}), 1.0);
    vec2 mc = vec2(floor(uMouth + 0.5), 2.0);
    c = over(c, faceCell(uv, mc), 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, c, inside);
  }
}`);
  };
  m.customProgramCacheKey = () => 'face-' + id;
  return m;
}
