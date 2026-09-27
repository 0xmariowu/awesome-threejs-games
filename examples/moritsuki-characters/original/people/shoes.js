// 大人の靴（足首がローカル原点、+z が前）。three.js に依存しない
import { capsule, ellipsoid, roundBox, torus, smin, smax, lin, setC } from './human.js';

// スニーカー（ローカット・キャンバス地）: A = 足首の高さ, L = 長さの倍率
export function sneakerSDF(A, L = 1, W = 1) {
  const s = (v) => v * L, w = (v) => v * W;
  const sole = roundBox([0, -A + 0.014, s(0.052)], [w(0.047), 0.014, s(0.128)], 0.012);
  const upper = ellipsoid([0, -A + 0.045, s(0.05)], [w(0.047), 0.045, s(0.122)]);
  const toe = ellipsoid([0, -A + 0.04, s(0.125)], [w(0.045), 0.032, s(0.058)]);
  const heel = ellipsoid([0, -A + 0.056, s(-0.03)], [w(0.042), 0.058, s(0.045)]);
  const tongue = ellipsoid([0, -A + 0.078, s(0.06)], [w(0.028), 0.012, s(0.05)], [-0.45, 0, 0]);
  const hole = ellipsoid([0, -A + 0.1, s(-0.004)], [w(0.034), 0.05, s(0.044)]);
  const collar = torus([0, -A + 0.083, s(-0.004)], w(0.036), 0.0075, [0.3, 0, 0]);
  const laces = [];
  for (let k = 0; k < 5; k++) {
    const z = s(0.03 + k * 0.02), y = -A + 0.082 - k * 0.0072;
    laces.push(capsule([w(-0.018), y, z], [w(0.018), y, z], 0.0032));
  }
  return (x, y, z) => {
    let d = smin(upper(x, y, z), toe(x, y, z), 0.025);
    d = smin(d, heel(x, y, z), 0.025);
    d = smax(d, y - (-A + 0.086 + (z - s(0.02)) * -0.14), 0.006); // はき口の高さ
    d = smax(d, -hole(x, y, z), 0.005);
    d = smin(d, collar(x, y, z), 0.004);
    d = smin(d, tongue(x, y, z), 0.008);
    for (const l of laces) d = smin(d, l(x, y, z), 0.002);
    return Math.min(d, sole(x, y, z));
  };
}
export function sneakerColor(A, L = 1, { canvas = '#f1eee6', rubber = '#f5f2ea', line = '#1d2430', lace = '#fbfaf6', cap = '#ece8de' } = {}) {
  const cv = lin(canvas), rb = lin(rubber), ln = lin(line), lc = lin(lace), cp = lin(cap);
  return (x, y, z, nx, ny, nz, o) => {
    const h = y + A;
    setC(o, cv);
    if (h < 0.03) setC(o, rb);
    if (h > 0.021 && h < 0.026) setC(o, ln);       // 底の黒い線
    if (h < 0.05 && z > 0.15 * L && nz > 0.2) setC(o, cp); // つま先のゴム
    if (h > 0.066 && z > 0.02 * L && z < 0.13 * L && Math.abs(x) < 0.022) setC(o, lc);
    if (h > 0.084 && z < 0.0) for (let k = 0; k < 3; k++) o[k] *= 0.92;
  };
}

// 革靴（外羽根・茶色）
export function leatherSDF(A, L = 1, W = 1) {
  const s = (v) => v * L, w = (v) => v * W;
  const sole = roundBox([0, -A + 0.009, s(0.056)], [w(0.047), 0.009, s(0.132)], 0.008);
  const heelBlock = roundBox([0, -A + 0.016, s(-0.04)], [w(0.041), 0.016, s(0.04)], 0.006);
  const upper = ellipsoid([0, -A + 0.042, s(0.05)], [w(0.045), 0.042, s(0.126)]);
  const toe = ellipsoid([0, -A + 0.034, s(0.13)], [w(0.042), 0.027, s(0.058)]);
  const heel = ellipsoid([0, -A + 0.056, s(-0.035)], [w(0.041), 0.058, s(0.045)]);
  const hole = ellipsoid([0, -A + 0.1, s(-0.005)], [w(0.034), 0.048, s(0.044)]);
  const flapL = roundBox([w(0.017), -A + 0.075, s(0.058)], [w(0.016), 0.004, s(0.04)], 0.003, [0.28, 0, -0.35]);
  const flapR = roundBox([w(-0.017), -A + 0.075, s(0.058)], [w(0.016), 0.004, s(0.04)], 0.003, [0.28, 0, 0.35]);
  const laces = [];
  for (let k = 0; k < 4; k++) {
    const z = s(0.036 + k * 0.018), y = -A + 0.081 - k * 0.0068;
    laces.push(capsule([w(-0.017), y, z], [w(0.017), y, z], 0.0022));
  }
  return (x, y, z) => {
    let d = smin(upper(x, y, z), toe(x, y, z), 0.03);
    d = smin(d, heel(x, y, z), 0.025);
    d = smax(d, y - (-A + 0.084 + (z - s(0.02)) * -0.12), 0.005);
    d = smax(d, -hole(x, y, z), 0.005);
    d = smin(d, flapL(x, y, z), 0.004);
    d = smin(d, flapR(x, y, z), 0.004);
    for (const l of laces) d = smin(d, l(x, y, z), 0.0015);
    return Math.min(d, sole(x, y, z), heelBlock(x, y, z));
  };
}
export function leatherColor(A, L = 1) {
  const up = lin('#5b3620'), dark = lin('#2e1a0f'), sole = lin('#2a1c14'), lace = lin('#3a2416');
  return (x, y, z, nx, ny, nz, o) => {
    const h = y + A;
    setC(o, up);
    // つま先ほど明るい（磨いた革）
    const t = Math.max(0, Math.min(1, (z - 0.05 * L) / (0.12 * L)));
    for (let k = 0; k < 3; k++) o[k] = up[k] * (1 + t * 0.35);
    if (h > 0.07 && Math.abs(x) < 0.02 && z > 0.02 * L && z < 0.1 * L) setC(o, lace);
    if (h < 0.019) setC(o, sole);
    if (h > 0.017 && h < 0.021) setC(o, dark); // こば
  };
}
