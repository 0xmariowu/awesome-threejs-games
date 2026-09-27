// 手で植えた木: 見せたい景色のアラ（地形の継ぎ目・遠景の抜けなど）を隠すために、一本ずつ置く木。
// 置き場所は data/planted-trees.json（?plant の植樹モードで植えて書き出したもの）。
// 家に埋もれないように決め直す fitTree は通さない（置いた所に、置いた大きさで立てる）
import * as THREE from 'three';
import { TreeSet, updateTrees } from '../assets/trees.js';
import { CROWN } from '../assets/trees2.js';

// 植えられる木（植樹モードの一覧の順）
export const PLANT_KINDS = [
  { kind: 'b-keyaki', name: 'ケヤキ', note: '大きく扇形' },
  { kind: 'b-oak', name: 'クスノキ', note: 'こんもり丸い' },
  { kind: 'b-cherry', name: '葉桜', note: '低く横に広い' },
  { kind: 'b-sugi', name: 'スギ', note: '細く高い' },
  { kind: 'b-garden', name: '庭木', note: '小さな丸' },
  { kind: 'b-palm', name: 'ヤシ', note: '海べ' },
];
export const VARIANTS = 3; // 種類ごとの形の数（TreeSet の variants と同じ）

// { trees, views }（views: 植えたときに見ていた所。あとで同じ所から確かめる用）
export async function loadPlanted(url) {
  const j = await fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const trees = (j?.trees || []).filter((t) => t.kind in CROWN && Number.isFinite(t.x) && Number.isFinite(t.z));
  return { trees, views: j?.views || [] };
}

export class PlantedTrees {
  // ground(x, z): 地面の高さ
  constructor(ground, list = []) {
    this.ground = ground;
    this.group = new THREE.Group();
    this.group.name = 'planted-trees';
    this.cache = {};
    this.set(list);
  }

  // 木を並べ直す（形は種類ごとに一度だけ作って使い回す）
  set(list) {
    this.list = list;
    for (const m of this.group.children) m.dispose(); // InstancedMesh の中身だけ（形・材質は使い回す）
    this.group.clear();
    if (!list.length) return;
    const ts = new TreeSet();
    for (const t of list) ts.add(t.kind, t.x, this.ground(t.x, t.z) - 0.1, t.z, t.s ?? 1, t.yaw ?? 0, t.v ?? 0);
    this.group.add(...ts.build({ variants: VARIANTS, cache: this.cache }).children);
  }

  update(camera, far) { updateTrees(this.group, camera, { far }); }
}
