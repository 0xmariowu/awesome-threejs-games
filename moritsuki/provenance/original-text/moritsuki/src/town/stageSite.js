// 建て替えできる敷地（湊さんの家・研究所）: 段階ごとの建物を自分用の Kit・木の組に作り、
// 作り直すときは前の建物のメッシュ・当たり（segs）・マスクの建物/舗装・足場（deck）・木を外してから建てる。
// ゲームの本番は起動時に 1 回建てるだけ。?debug の大きさえらび（stagePick.js）が build(level) で建て替える
import { Kit } from './assets/kit.js';
import { TreeSet } from './assets/trees.js';
import { M } from './layout.js';

const KEEP_BITS = M.BLD | M.PAVE; // 建物が塗るマスクのビット（建て替えで元に戻す）

export class StageSite {
  // levels: [{ label, build(k, env) }]  env: landmarks の lotEnv（opts を通して kit・木・当たりの記録を差しかえる）
  // rect: 世界の四角 [x0, z0, x1, z1]（マスク・足場を覚えておく範囲、草を描き直す範囲）
  // kindOf(x, z, level): 草の地図で使う地面の種類の差しかえ（庭など。なければ地形のまま）
  // toLocal(x, z): 世界 → 敷地ローカル。建てたものの広がり（bounds = ローカルの [a0, b0, a1, b1]）を測るのに使う
  // layout(site): 建てたあとの配置（歩ける範囲・人の立つ所など）を返す → site.place。変わったら onChange(site)
  constructor({ id, name, levels, level, env, opts, mats, rect, kindOf, ctx, toLocal, layout }) {
    Object.assign(this, { id, name, levels, level, env, opts, mats, rect, kindOf, ctx, toLocal, layout });
    this.onChange = null;
    this.meshes = [];
    this.treeMeshes = [];
    this.treeParent = null; this.fit = null; this.grass = null;
    this.cache = {}; // 木の形（種類ごと）を建て替えのたびに作り直さない
    // 建てる前のマスク（建物・舗装のビット）と足場の高さを覚えておく
    const { mask, deck } = ctx;
    const [x0, z0, x1, z1] = rect;
    const box = (m) => ({
      i0: Math.max(0, Math.floor((x0 - m.x0) / m.step)), i1: Math.min(m.nx - 1, Math.floor((x1 - m.x0) / m.step)),
      j0: Math.max(0, Math.floor((z0 - m.z0) / m.step)), j1: Math.min(m.nz - 1, Math.floor((z1 - m.z0) / m.step)),
    });
    this.mBox = box(mask); this.dBox = box(deck.m);
    this.mSnap = this.copy(mask.a, mask.nx, this.mBox);
    this.dSnap = this.copy(deck.h, deck.m.nx, this.dBox);
  }

  copy(arr, nx, b) {
    const w = b.i1 - b.i0 + 1, out = new arr.constructor(w * (b.j1 - b.j0 + 1));
    for (let j = b.j0; j <= b.j1; j++) out.set(arr.subarray(j * nx + b.i0, j * nx + b.i1 + 1), (j - b.j0) * w);
    return out;
  }

  // 前の建物を外す（当たり・マスク・足場は建てる前の状態へ）
  clear() {
    const { mask, deck, segs } = this.ctx;
    for (const m of this.meshes) { m.removeFromParent(); m.geometry.dispose(); }
    for (const m of this.treeMeshes) { m.removeFromParent(); m.dispose(); }
    this.meshes = []; this.treeMeshes = [];
    segs.remove(this.opts.rec);
    this.opts.rec.length = 0;
    const b = this.mBox, w = b.i1 - b.i0 + 1;
    for (let j = b.j0; j <= b.j1; j++) for (let i = b.i0; i <= b.i1; i++) {
      const k = j * mask.nx + i;
      mask.a[k] = (mask.a[k] & ~KEEP_BITS) | (this.mSnap[(j - b.j0) * w + i - b.i0] & KEEP_BITS);
    }
    const d = this.dBox, dw = d.i1 - d.i0 + 1;
    for (let j = d.j0; j <= d.j1; j++) deck.h.set(this.dSnap.subarray((j - d.j0) * dw, (j - d.j0 + 1) * dw), j * deck.m.nx + d.i0);
  }

  // level の建物を建てる。group: メッシュを入れる所（最初の 1 回で決まる）
  build(level, group = this.group) {
    this.group = group;
    if (this.built) this.clear();
    this.built = true;
    this.level = level;
    this.opts.kit = new Kit(this.mats);
    this.opts.trees = new TreeSet();
    this.result = this.levels[level].build(this.opts.kit, this.env) || null;
    this.bounds = this.toLocal ? this.measure() : null;
    this.meshes = this.opts.kit.meshes();
    for (const m of this.meshes) group.add(m);
    if (this.treeParent) this.plant();
    this.grass?.field.refresh(this.rect, (x, z) => this.kindOf?.(x, z, this.level));
    this.place = this.layout?.(this) || null;
    this.onChange?.(this);
  }

  // 建てたもの（地面の舗装も含む）の敷地ローカルでの広がり。頂点を間引いて測る
  measure() {
    let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
    for (const key in this.opts.kit.m) {
      const p = this.opts.kit.m[key].p;
      for (let i = 0; i < p.length; i += 15) {
        const [a, b] = this.toLocal(p[i], p[i + 2]);
        if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b;
      }
    }
    return a0 <= a1 ? [a0, b0, a1, b1] : null;
  }

  // 木はまわりの木（main.js の forest）ができてから、同じ当てはめ（fitTree）で植える
  plantTrees(parent, fit) { this.treeParent = parent; this.fit = fit; this.plant(); }
  plant() {
    const g = this.opts.trees.build({ variants: 4, fit: this.fit, cache: this.cache });
    this.treeMeshes = [...g.children];
    for (const m of this.treeMeshes) this.treeParent.add(m);
  }
}
