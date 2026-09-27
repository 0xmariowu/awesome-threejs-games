// 手続き的ジオメトリ組み立て用のヘルパー
import * as THREE from 'three';

export class GeoBuilder {
  constructor() {
    this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.idx = [];
    this.extra = {}; // name -> {size, data}
  }
  get count() { return this.pos.length / 3; }

  vert(p, n, c, uv = [0, 0], extra = {}) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(c.r, c.g, c.b);
    this.uv.push(uv[0], uv[1]);
    for (const k in extra) {
      if (!this.extra[k]) this.extra[k] = [];
      const v = extra[k];
      if (Array.isArray(v)) this.extra[k].push(...v); else this.extra[k].push(v);
    }
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  /** 既存ジオメトリを行列付きで取り込む */
  merge(geo, matrix, colorFn, extraFn) {
    const g = geo.index ? geo : geo;
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const base = this.count;
    const v = new THREE.Vector3(), vn = new THREE.Vector3(), lp = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      lp.fromBufferAttribute(p, i);
      v.copy(lp).applyMatrix4(matrix);
      if (n) vn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); else vn.set(0, 1, 0);
      const c = colorFn ? colorFn(v, vn, lp, i) : { r: 1, g: 1, b: 1 };
      this.vert(v, vn, c, uv ? [uv.getX(i), uv.getY(i)] : [0, 0], extraFn ? extraFn(v, vn, lp, i) : {});
    }
    if (g.index) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i++) this.idx.push(base + ix[i]);
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    }
  }

  /** 経路に沿った帯（海藻の葉など） */
  ribbon(path, widthFn, sideFn, colorFn, extraFn) {
    const n = path.length;
    const base = this.count;
    const t = new THREE.Vector3(), side = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const p = path[i];
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      t.subVectors(b, a).normalize();
      sideFn(i / (n - 1), t, side);
      nrm.crossVectors(t, side).normalize();
      const w = widthFn(i / (n - 1)) * 0.5;
      const c = colorFn(i / (n - 1));
      const ex = extraFn ? extraFn(i / (n - 1), p) : {};
      this.vert(p.clone().addScaledVector(side, -w), nrm, c, [0, i / (n - 1)], ex);
      this.vert(p.clone().addScaledVector(side, w), nrm, c, [1, i / (n - 1)], ex);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      this.quad(a, a + 1, a + 3, a + 2);
    }
  }

  /** 経路に沿った管（腕・触角など） */
  tube(path, radiusFn, radial, colorFn, extraFn) {
    const n = path.length;
    const base = this.count;
    const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let prevN = null;
    for (let i = 0; i < n; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      T.subVectors(b, a).normalize();
      if (!prevN) {
        const ref = Math.abs(T.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up;
        Nn.crossVectors(T, ref).normalize();
      } else {
        Nn.copy(prevN).addScaledVector(T, -prevN.dot(T)).normalize();
      }
      prevN = Nn.clone();
      B.crossVectors(T, Nn).normalize();
      const r = radiusFn(i / (n - 1));
      const c = colorFn(i / (n - 1));
      const ex = extraFn ? extraFn(i / (n - 1)) : {};
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2;
        const dir = Nn.clone().multiplyScalar(Math.cos(th)).addScaledVector(B, Math.sin(th));
        this.vert(path[i].clone().addScaledVector(dir, r), dir, c, [j / radial, i / (n - 1)], ex);
      }
    }
    const rs = radial + 1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = base + i * rs + j;
        this.quad(a, a + rs, a + rs + 1, a + 1);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    for (const k in this.extra) {
      const size = this.extra[k].length / this.count;
      g.setAttribute(k, new THREE.Float32BufferAttribute(this.extra[k], size));
    }
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export const col = (hex) => new THREE.Color(hex);
