// 町に夏海（定食屋の前）と磯貝博士（研究所の前庭）を立たせる。遠い・見えない人は描かず、動かさない
import * as THREE from 'three';
import { Npc } from './npc.js';
import { PLACES } from '../layout.js';

// 形はワーカーで作るので、町を作る前に頼んでおく
export const loadPeople = () => Promise.all([Npc.load('natsumi'), Npc.load('isogai')]);

const _f = new THREE.Frustum(), _m = new THREE.Matrix4(), _s = new THREE.Sphere(), _h = new THREE.Vector3();

export class TownPeople {
  constructor({ npcs, scene, world, segs }) {
    this.list = npcs;
    const at = { natsumi: PLACES.teishoku, isogai: PLACES.lab };
    for (const n of npcs) {
      const p = at[n.id];
      const [x, z] = p.npc;
      n.place(x, z, p.npcYaw, (xx, zz) => world.groundAt(xx, zz, 99));
      scene.add(n.root);
      n.seg = segs.add(x, z, x, z, 0.26); // ぶつかる
    }
    this.segs = segs;
  }

  // 立つ所を変える（?debug で研究所を建て替えたとき）
  move(id, x, z, yaw) {
    const n = this.list.find((q) => q.id === id);
    if (!n) return;
    this.segs.remove([n.seg]);
    n.place(x, z, yaw);
    n.seg = this.segs.add(x, z, x, z, 0.26);
  }

  update(dt, { camera, player, active = true }) {
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _f.setFromProjectionMatrix(_m);
    _h.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
    for (const n of this.list) {
      const d = camera.position.distanceTo(n.pos);
      _s.center.set(n.pos.x, n.pos.y + 0.9, n.pos.z); _s.radius = 1.3;
      // 近ければ（影のため）画面の外でも描く。遠い人は画面に入っているときだけ
      const vis = d < 110 && (d < 22 || _f.intersectsSphere(_s));
      n.root.visible = vis;
      if (!vis) continue;
      const look = n.live(dt, _h, active);
      n.update(dt, { look });
    }
  }
}
