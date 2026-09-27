// 町データの読み込みと、地形の高さ・図形処理のヘルパー
// 座標: x = 東, z = 南（m）。原点は自分の家のあたり。y = 標高（海面 0）

// 高さの格子（Int16 の生データ）。.bin が無い所（claude.ai の Artifact は .bin を置けない）では、
// 同じ中身を base64 にした .b64.txt を読む（公開のときに作る）
async function loadGrid(base, name) {
  const r = await fetch(base + name + '.bin').catch(() => null);
  if (r?.ok && !/text\/html/.test(r.headers.get('content-type') || '')) return r.arrayBuffer();
  const b64 = await fetch(base + name + '.b64.txt').then((q) => q.text());
  return Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0)).buffer;
}

export async function loadTownData(base) {
  const [V, core, outer] = await Promise.all([
    fetch(base + 'yoshimi.json').then((r) => r.json()),
    loadGrid(base, 'yoshimi-core'),
    loadGrid(base, 'yoshimi-outer'),
  ]);
  return { V, core: new HeightGrid(V.core, core), outer: new HeightGrid(V.outer, outer) };
}

export class HeightGrid {
  constructor(g, buf) {
    Object.assign(this, g);
    const i16 = new Int16Array(buf);
    this.h = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) this.h[i] = i16[i] / 10;
    this.x1 = this.x0 + this.step * (this.nx - 1);
    this.z1 = this.z0 + this.step * (this.nz - 1);
  }
  inside(x, z, m = 0) { return x >= this.x0 + m && x <= this.x1 - m && z >= this.z0 + m && z <= this.z1 - m; }
  idx(i, j) { return j * this.nx + i; }
  get(i, j) {
    i = i < 0 ? 0 : i >= this.nx ? this.nx - 1 : i;
    j = j < 0 ? 0 : j >= this.nz ? this.nz - 1 : j;
    return this.h[j * this.nx + i];
  }
  at(x, z) {
    const fx = (x - this.x0) / this.step, fz = (z - this.z0) / this.step;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = this.get(i, j), b = this.get(i + 1, j), c = this.get(i, j + 1), d = this.get(i + 1, j + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  xOf(i) { return this.x0 + i * this.step; }
  zOf(j) { return this.z0 + j * this.step; }
}

// ---------- 図形 ----------
export function pointInPoly(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polyArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return a / 2;
}

export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

export function polylineDist(x, z, p) {
  let d = Infinity;
  for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  return d;
}

export function bbox(p) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, z] of p) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); }
  return [a, b, c, d];
}

// 最小面積の外接矩形（辺の向きを総当たり）
export function obb(p) {
  let best = null;
  for (let i = 0; i < p.length; i++) {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 0.3) continue;
    const ux = (bx - ax) / l, uz = (bz - az) / l;
    let mnu = Infinity, mxu = -Infinity, mnv = Infinity, mxv = -Infinity;
    for (const [x, z] of p) {
      const u = x * ux + z * uz, v = -x * uz + z * ux;
      mnu = Math.min(mnu, u); mxu = Math.max(mxu, u); mnv = Math.min(mnv, v); mxv = Math.max(mxv, v);
    }
    const area = (mxu - mnu) * (mxv - mnv);
    if (!best || area < best.area) {
      const cu = (mnu + mxu) / 2, cv = (mnv + mxv) / 2;
      best = { area, cx: cu * ux - cv * uz, cz: cu * uz + cv * ux, ux, uz, w: mxu - mnu, d: mxv - mnv };
    }
  }
  // w を長辺に
  if (best && best.d > best.w) {
    const { ux, uz } = best;
    Object.assign(best, { ux: -uz, uz: ux, w: best.d, d: best.w });
  }
  return best;
}

// ---------- 乱数 ----------
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export const hash2 = (x, z) => {
  let h = Math.imul(Math.floor(x) | 0, 374761393) + Math.imul(Math.floor(z) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// 値ノイズ（地面の塗り分けなど）
export function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return (a * (1 - s(u)) + b * s(u)) * (1 - s(v)) + (c * (1 - s(u)) + d * s(u)) * s(v);
}
export const fbm2 = (x, z) => vnoise(x, z) * 0.5 + vnoise(x * 2.1 + 5.2, z * 2.1 + 1.3) * 0.3 + vnoise(x * 4.3 + 9.1, z * 4.3 + 7.7) * 0.2;

// ---------- 格子上のマスク（1 セル = step m） ----------
export class Mask {
  constructor(x0, z0, w, h, step) {
    Object.assign(this, { x0, z0, step, nx: Math.ceil(w / step), nz: Math.ceil(h / step) });
    this.a = new Uint8Array(this.nx * this.nz);
  }
  cell(x, z) {
    const i = Math.floor((x - this.x0) / this.step), j = Math.floor((z - this.z0) / this.step);
    return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i;
  }
  get(x, z) { const c = this.cell(x, z); return c < 0 ? 0 : this.a[c]; }
  // 多角形を塗る（スキャンライン）
  fillPoly(p, bit) {
    const [x0, z0, x1, z1] = bbox(p);
    const j0 = Math.max(0, Math.floor((z0 - this.z0) / this.step)), j1 = Math.min(this.nz - 1, Math.floor((z1 - this.z0) / this.step));
    for (let j = j0; j <= j1; j++) {
      const z = this.z0 + (j + 0.5) * this.step, xs = [];
      for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
        const [xa, za] = p[a], [xb, zb] = p[b];
        if ((za > z) !== (zb > z)) xs.push(xa + ((z - za) / (zb - za)) * (xb - xa));
      }
      xs.sort((m, n) => m - n);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - this.x0) / this.step - 0.5)), i1 = Math.min(this.nx - 1, Math.floor((xs[k + 1] - this.x0) / this.step - 0.5));
        for (let i = i0; i <= i1; i++) this.a[j * this.nx + i] |= bit;
      }
    }
  }
  // 太さ w の線を塗る
  fillLine(p, w, bit) {
    const r = w / 2;
    for (let s = 0; s < p.length - 1; s++) {
      const [ax, az] = p[s], [bx, bz] = p[s + 1];
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - this.x0) / this.step)), i1 = Math.min(this.nx - 1, Math.floor((Math.max(ax, bx) + r - this.x0) / this.step));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - r - this.z0) / this.step)), j1 = Math.min(this.nz - 1, Math.floor((Math.max(az, bz) + r - this.z0) / this.step));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = this.x0 + (i + 0.5) * this.step, z = this.z0 + (j + 0.5) * this.step;
        if (segDist(x, z, ax, az, bx, bz) <= r) this.a[j * this.nx + i] |= bit;
      }
    }
  }
  anyInRect(cx, cz, ux, uz, w, d, bits) {
    // 回転矩形の中に bits が立ったセルがあるか
    const hw = w / 2, hd = d / 2, st = this.step * 0.7;
    for (let a = -hw; a <= hw; a += st) for (let b = -hd; b <= hd; b += st) {
      const x = cx + ux * a - uz * b, z = cz + uz * a + ux * b;
      if (this.get(x, z) & bits) return true;
    }
    return false;
  }
}

// ---------- 当たり判定用の線分の空間ハッシュ ----------
export class SegIndex {
  constructor(cell = 16) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return i * 100003 + j; }
  add(ax, az, bx, bz, r = 0, top = Infinity) {
    const s = { ax, az, bx, bz, r, top };
    const c = this.cell;
    const i0 = Math.floor((Math.min(ax, bx) - r) / c), i1 = Math.floor((Math.max(ax, bx) + r) / c);
    const j0 = Math.floor((Math.min(az, bz) - r) / c), j1 = Math.floor((Math.max(az, bz) + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push(s);
    }
    return s;
  }
  addPoly(p, top = Infinity) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push(this.add(a[0], a[1], b[0], b[1], 0, top));
    }
    return out;
  }
  // add / addPoly が返した線分を取り除く（建て替えで当たりを入れかえる）
  remove(list) {
    const c = this.cell, gone = new Set(list);
    for (const s of list) {
      const i0 = Math.floor((Math.min(s.ax, s.bx) - s.r) / c), i1 = Math.floor((Math.max(s.ax, s.bx) + s.r) / c);
      const j0 = Math.floor((Math.min(s.az, s.bz) - s.r) / c), j1 = Math.floor((Math.max(s.az, s.bz) + s.r) / c);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j), l = this.map.get(k);
        if (l) this.map.set(k, l.filter((q) => !gone.has(q)));
      }
    }
  }
  near(x, z) {
    const i = Math.floor(x / this.cell), j = Math.floor(z / this.cell), out = new Set();
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const l = this.map.get(this.key(i + di, j + dj));
      if (l) for (const s of l) out.add(s);
    }
    return out;
  }
}
