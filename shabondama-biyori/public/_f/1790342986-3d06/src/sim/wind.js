// 風：草・水面・木・花びら（GLSL）と泡の動き（JS）が同じ式を使う
import { vnoise2, simplex3, smoothstep } from '../util/noise.js';

export class Wind {
  constructor(seed = 0) {
    this.t = 0;
    this.seed = seed;
    this.theta0 = -0.35 + seed * 2.1; // 平均の風向（ラジアン、x軸から）
    this.dir = [1, 0];
    this.speed = 1.5;
    this.gust = 0.8;
    this.off = [0, 0];
  }
  update(dt) {
    this.t += dt;
    const t = this.t + this.seed * 1000;
    const th = this.theta0 + 0.8 * Math.sin(t / 97) + 0.5 * Math.sin(t / 41 + 1.3) + 0.25 * Math.sin(t / 17 + 0.4);
    this.dir[0] = Math.cos(th); this.dir[1] = Math.sin(th);
    this.speed = 1.75 + 0.5 * Math.sin(t / 53) + 0.25 * Math.sin(t / 23 + 2.0);
    this.gust = 0.75 + 0.25 * Math.sin(t / 31 + 0.7);
    this.off[0] += this.dir[0] * this.speed * dt * 1.1;
    this.off[1] += this.dir[1] * this.speed * dt * 1.1;
  }
  // 今の平均の風向を th（x軸からの角度）にそろえる
  aimAt(th) {
    const t = this.t + this.seed * 1000;
    const osc = 0.8 * Math.sin(t / 97) + 0.5 * Math.sin(t / 41 + 1.3) + 0.25 * Math.sin(t / 17 + 0.4);
    this.theta0 = th - osc;
  }
  gustField(x, z) {
    const dx = this.dir[0], dz = this.dir[1];
    const qx = x - this.off[0], qz = z - this.off[1];
    const a = qx * dx + qz * dz, b = -qx * dz + qz * dx;
    const g = vnoise2(a / 34, b / 70) * 0.65 + vnoise2(a / 13 + 17, b / 23 + 17) * 0.35;
    return smoothstep(0.34, 0.86, g);
  }
  // 地表近くの水平の風（m/s）
  at(x, z) {
    const g = this.gustField(x, z);
    const s = this.speed * (0.55 + this.gust * g * 1.6);
    return [this.dir[0] * s, this.dir[1] * s, g];
  }
  // 泡用の三次元の乱れ（渦なしの curl 雑音）
  curl(x, y, z, t) {
    const e = 0.8, S = 1 / 26;
    const px = x * S, py = y * S, pz = z * S, pt = t * 0.035;
    const n1 = (a, b, c) => simplex3(a + pt, b, c);
    const n2 = (a, b, c) => simplex3(a + 31.4, b - pt, c + 12.7);
    const n3 = (a, b, c) => simplex3(a - 17.1, b + 5.3, c + pt);
    const d = e * S;
    const dn3dy = (n3(px, py + d, pz) - n3(px, py - d, pz)) / (2 * e);
    const dn2dz = (n2(px, py, pz + d) - n2(px, py, pz - d)) / (2 * e);
    const dn1dz = (n1(px, py, pz + d) - n1(px, py, pz - d)) / (2 * e);
    const dn3dx = (n3(px + d, py, pz) - n3(px - d, py, pz)) / (2 * e);
    const dn2dx = (n2(px + d, py, pz) - n2(px - d, py, pz)) / (2 * e);
    const dn1dy = (n1(px, py + d, pz) - n1(px, py - d, pz)) / (2 * e);
    return [dn3dy - dn2dz, dn1dz - dn3dx, dn2dx - dn1dy];
  }
}
