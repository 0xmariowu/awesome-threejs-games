// しゃぼん玉の飛び方：地表の風（突風の模様）＋渦の乱れ＋上昇気流＋斜面を上る風＋障害物を避ける流れ
import { mulberry32, smoothstep, clamp } from '../util/noise.js';
import { GORGE, gorgeLocal, gorgeWorld, RIDGE } from '../world/layout.js';

// 滝の谷の軸の向き（上流＝奥へ向かう水平の単位ベクトル）
function gorgeAxis(s) {
  const [x0, z0] = gorgeWorld(s - 1, 0), [x1, z1] = gorgeWorld(s + 1, 0);
  const l = Math.hypot(x1 - x0, z1 - z0) || 1;
  return [(x1 - x0) / l, (z1 - z0) / l];
}

export class Flight {
  constructor({ wind, groundAt, trees, obstacles, landAt, lipH = 48 }) {
    this.lipH = lipH;
    this.wind = wind;
    this.groundAt = groundAt;
    this.trees = trees;
    this.obstacles = obstacles; // [{x,z,hw,hd,rot,top}]
    this.landAt = landAt;       // (x,z) => 地面の種類（草の高さなど）
    this.rand = mulberry32((Math.random() * 1e9) | 0);
    this.thermals = [];
    this.t = 0;
    for (let i = 0; i < 6; i++) this.spawnThermal(true);
  }
  spawnThermal(initial = false) {
    const r = this.rand;
    // 谷の中の日当たりのよい開けた場所に
    const x = (r() - 0.5) * 900, z = (r() - 0.5) * 420 + 10;
    this.thermals.push({ x, z, r: 25 + r() * 45, s: 0.5 + r() * 1.3, age: initial ? r() * 120 : 0, life: 90 + r() * 150 });
  }
  // 主人公の泡の行く手に上昇気流を置く（ときどき高く舞い上がる）
  seedAhead(p, strength = 1) {
    const w = this.wind, r = this.rand;
    const d = 25 + r() * 35;
    this.thermals.push({ x: p.x + w.dir[0] * d + (r() - 0.5) * 20, z: p.z + w.dir[1] * d + (r() - 0.5) * 20, r: 30 + r() * 30, s: (0.9 + r() * 0.8) * strength, age: 0, life: 70 + r() * 60, seeded: true });
  }
  update(dt) {
    this.t += dt;
    const w = this.wind;
    for (const th of this.thermals) {
      th.age += dt;
      th.x += w.dir[0] * w.speed * dt * 0.8;
      th.z += w.dir[1] * w.speed * dt * 0.8;
    }
    this.thermals = this.thermals.filter((th) => th.age < th.life);
    while (this.thermals.filter((th) => !th.seeded).length < 6) this.spawnThermal();
  }
  // 位置pでの空気の速度（m/s）
  velocityAt(p, out, opt = {}) {
    const g = this.groundAt(p.x, p.z);
    const h = Math.max(p.y - g, 0.05);
    const [wx, wz, gust] = this.wind.at(p.x, p.z);
    const prof = clamp(Math.log(h / 0.08 + 1) / Math.log(40 / 0.08 + 1), 0.3, 1.35);
    let vx = wx * prof, vy = 0, vz = wz * prof;
    // 滝の谷：谷の中では風が谷筋に沿って流れる。崖の前は日に温められた岩に沿って上へ吹く
    const gl = gorgeLocal(p.x, p.z);
    let inG = 0;
    if (gl.s > 250 && gl.s < 470 && Math.abs(gl.a) < 60) {
      const [tx, tz] = gorgeAxis(gl.s);
      inG = (1 - smoothstep(22, 55, Math.abs(gl.a))) * smoothstep(250, 275, gl.s) * (1 - smoothstep(440, 470, gl.s)) * (1 - smoothstep(35, 70, h));
      const along = vx * tx + vz * tz;
      vx = vx + (tx * along - vx) * 0.8 * inG;
      vz = vz + (tz * along - vz) * 0.8 * inG;
      // 流れの弱いところでも少しは谷を上る（谷風）
      const dS = GORGE.sCliff - gl.s;
      const nearCliff = (1 - smoothstep(0, 32, dS)) * (1 - smoothstep(16, 26, Math.abs(gl.a))) * (1 - smoothstep(this.lipH + 10, this.lipH + 32, p.y));
      if (dS > -6 && nearCliff > 0) {
        vy += 1.9 * nearCliff;
        // 崖にぶつからないよう、崖の手前で谷の下手へ押し戻す
        const push = (1 - smoothstep(1.5, 9, dS)) * 1.4;
        vx -= tx * push; vz -= tz * push;
      }
    }
    // 斜面を上る風
    const gx = (this.groundAt(p.x + 3, p.z) - this.groundAt(p.x - 3, p.z)) / 6;
    const gz = (this.groundAt(p.x, p.z + 3) - this.groundAt(p.x, p.z - 3)) / 6;
    vy += (vx * gx + vz * gz) * 0.9 * Math.exp(-h / 70);
    // 渦の乱れ
    const c = this.wind.curl(p.x, p.y, p.z, this.t);
    const amp = 0.55 + 0.45 * gust;
    vx += c[0] * amp; vy += c[1] * amp * 0.7; vz += c[2] * amp;
    // 上昇気流
    let up = -0.05;
    for (const th of this.thermals) {
      const d2 = ((p.x - th.x) ** 2 + (p.z - th.z) ** 2) / (th.r * th.r);
      if (d2 > 6) continue;
      const life = smoothstep(0, 15, th.age) * (1 - smoothstep(th.life - 20, th.life, th.age));
      up += th.s * Math.exp(-d2) * smoothstep(1, 10, h) * (1 - smoothstep(170, 260, h)) * life;
    }
    // 主人公の泡は、選んだ高さより上では上昇気流にほとんど持ち上げられない（高さが乱数どおりに移る）
    if (opt.hover && up > 0 && opt.prefAlt) up *= 1 - 0.85 * smoothstep(opt.prefAlt, opt.prefAlt + 4, h);
    vy += up;
    // 泡は空気より少し重い
    vy -= 0.09;
    // 主人公の泡：好みの高さへ寄る（上に出すぎたら早めに降りる）＋ときどき上昇気流に乗る
    if (opt.hover) {
      vy += Math.max(0, 2.0 - h) * 0.55;
      if (opt.lift > 0.05) vy += opt.lift;
      // 泡の重さぶんを打ち消してから寄せる（選んだ高さのまわりに落ち着く）
      else if (opt.prefAlt) vy += 0.14 + Math.max(-0.9, Math.min(0.6, (opt.prefAlt - h) * 0.12));
      if (h > 35) vy -= (h - 35) * 0.04;
    }
    // 谷の外へ出すぎない・高すぎない（滝の谷と山の上の見晴らしのまわりは除く）
    const rr = Math.hypot(p.x, (p.z - 10) * 1.6);
    if (rr > 430) {
      const dG = Math.hypot(p.x + 445, p.z + 470), dR = Math.hypot(p.x - RIDGE.x, p.z - RIDGE.z);
      const free = Math.max(1 - smoothstep(130, 200, dG), 1 - smoothstep(90, 160, dR));
      const k = (rr - 430) * 0.012 * (1 - free);
      vx -= p.x / rr * k; vz -= (p.z - 10) / rr * k * 1.6;
    }
    if (h > 150) vy -= (h - 150) * 0.02;
    out.x = vx; out.y = vy; out.z = vz;
    return h;
  }
  // 障害物（樹冠・建物）のまわりを流れる。中に入ったら true（割れる）
  avoid(p, v, r) {
    let hit = false;
    const near = this.trees.nearby(p.x, p.z, 14);
    for (const e of near) {
      const t = e.t, P = e.p;
      const s = t.s;
      const cy = t.y + P.H * s * 0.62, cr = P.H * s * 0.34, cry = P.H * s * 0.32;
      const dx = (p.x - t.x) / cr, dy = (p.y - cy) / cry, dz = (p.z - t.z) / cr;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.78) hit = true;
      if (d < 1.6) {
        const k = (1.6 - d) / 1.6;
        const nx = dx / (d || 1), ny = dy / (d || 1), nz = dz / (d || 1);
        const vn = v.x * nx + v.y * ny + v.z * nz;
        if (vn < 0) { v.x -= nx * vn * k * 1.2; v.y -= ny * vn * k * 1.2; v.z -= nz * vn * k * 1.2; }
        v.x += nx * k * 0.9; v.y += ny * k * 0.9 + k * 0.4; v.z += nz * k * 0.9;
      }
    }
    for (const o of this.obstacles) {
      const dx0 = p.x - o.x, dz0 = p.z - o.z;
      if (dx0 * dx0 + dz0 * dz0 > 1600) continue;
      const c = Math.cos(o.rot), s = Math.sin(o.rot);
      // 箱の局所座標（x=家の横、z=家の奥行き）
      const lx = dx0 * c - dz0 * s, lz = dx0 * s + dz0 * c;
      const nx = Math.max(-o.hw, Math.min(o.hw, lx)), nz = Math.max(-o.hd, Math.min(o.hd, lz));
      const ny = Math.max(o.base ?? -1e9, Math.min(o.top, p.y));
      const ox = lx - nx, oz = lz - nz, oy = p.y - ny;
      const dist = Math.hypot(ox, oy, oz);
      if (dist < 0.05) { hit = true; continue; }
      if (dist < 3.5) {
        const k = (3.5 - dist) / 3.5;
        // 最も近い面から外へ（壁の横なら横へ、屋根の上なら上へ）
        const ux = ox / dist, uy = oy / dist, uz = oz / dist;
        const wx = ux * c + uz * s, wz = -ux * s + uz * c;
        const vn = v.x * wx + v.y * uy + v.z * wz;
        if (vn < 0) { v.x -= wx * vn * k; v.y -= uy * vn * k; v.z -= wz * vn * k; }
        v.x += wx * k * 0.7; v.y += uy * k * 0.7; v.z += wz * k * 0.7;
      }
    }
    return hit;
  }
  // 1つの泡を進める。割れたら理由を返す
  step(b, dt, tmp) {
    const h = this.velocityAt(b.pos, tmp, { hover: b.main, prefAlt: b.prefAlt, lift: b.lift });
    // 泡ごとの小さな気流のちがい（同じ風の中でも少しずつ別の向きへ散っていく）
    if (b.drift) { tmp.x += b.drift[0]; tmp.y += b.drift[1]; tmp.z += b.drift[2]; }
    if (this.avoid(b.pos, tmp, b.r) && !b.immune) return 'tree';
    // 泡は空気にすぐなじむ（時定数0.35秒）
    const k = 1 - Math.exp(-dt / 0.35);
    b.vel.x += (tmp.x - b.vel.x) * k; b.vel.y += (tmp.y - b.vel.y) * k; b.vel.z += (tmp.z - b.vel.z) * k;
    b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt; b.pos.z += b.vel.z * dt;
    b.age += dt;
    const ground = this.groundAt(b.pos.x, b.pos.z) + this.landAt(b.pos.x, b.pos.z);
    if (b.pos.y - b.r < ground) {
      if (!b.immune) return 'ground';
      // 割れないうちは地面・崖にもぐらない：上へ、急な斜面なら低い側へ押し出す
      const e = 1.2;
      const gx = (this.groundAt(b.pos.x + e, b.pos.z) - this.groundAt(b.pos.x - e, b.pos.z)) / (2 * e);
      const gz = (this.groundAt(b.pos.x, b.pos.z + e) - this.groundAt(b.pos.x, b.pos.z - e)) / (2 * e);
      const sl = Math.hypot(gx, gz);
      if (sl > 0.8) { b.pos.x -= (gx / sl) * 0.6 * dt * 10; b.pos.z -= (gz / sl) * 0.6 * dt * 10; b.vel.x -= (gx / sl) * 0.5; b.vel.z -= (gz / sl) * 0.5; }
      b.pos.y = Math.max(b.pos.y, this.groundAt(b.pos.x, b.pos.z) + this.landAt(b.pos.x, b.pos.z) + b.r + 0.02);
      b.vel.y = Math.max(b.vel.y, 0.25);
    }
    if (b.age > b.life) return 'age';
    return null;
  }
}
