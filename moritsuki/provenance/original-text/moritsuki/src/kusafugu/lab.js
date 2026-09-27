// 見分けの確認ページ（/kusafugu/?lab、dev/kusafugu-glints.html から開く）
// 本物のフグの眼と、まぎらわしい物（赤い小石・ガラス・貝殻）を、同じ浅瀬に並べて見くらべる
// ・いつもの操作で歩き回れる（手を突っ込むこともできる）。潮は止まる
// ・L キーで正体の札を出す／消す
// ・右上のつまみ: 光の強さ・さざ波のゆれ・物の光の鋭さ・物の色のちがい
import * as THREE from 'three';
import { EYE_COL } from './shine.js';
import { RNG } from './core/noise.js';

const TYPES = [
  // [種類, 鋭さ, 強さ, 色の橙み(0..1), 札]
  ['chert', 0.6, 1.25, 0.0, '丸い小石（色も同じ）'],
  ['chert', 0.6, 1.25, 0.8, '丸い小石（少し橙）'],
  ['chert', 16, 1.0, 0.4, '割れた小石（平たい面）'],
  ['glass', 40, 1.0, 0.8, 'ガラス'],
  ['shell', 9, 1.0, 0.6, '貝殻'],
  ['chert', 0.8, 1.2, 0.3, '丸い小石（2つ並び）'],
];

export function startLab(game) {
  const w = game.world, f = game.field;
  game.lab = true;
  game.ui.only();
  game.beginPlay();
  game.tideT = 0.35;
  game.noPause = true; // Esc でマウスを放しても止めない（つまみをさわれるように）
  // 水深 20cm くらいの所
  let x = 12, z = 6;
  for (; z < 40; z += 0.25) if (w.tide + 0.12 - w.groundAt(x, z) > 0.2) break;
  // まわりの物をどける
  for (const it of [...f.around(x, z, 7)]) f.remove(it);
  const rng = new RNG(77);
  const labels = [];
  const addFugu = (px, pz, name) => {
    const it = { kind: 'fugu', id: 'kusa', cm: 13, glintCm: rng.range(11, 15), seed: rng.next(), x: px, z: pz, yaw: rng.range(0, 6.28), alive: true, state: 'bur', eyeT: rng.range(0, 50), swim: null };
    f.fugu.push(it); f.put(it);
    labels.push({ it, name, cls: 'eye' });
  };
  const addDecoy = (px, pz, T, name) => {
    const [type, sharp, str, o, label] = T;
    const tilt = sharp < 2 ? 0 : rng.range(0.3, 0.9), az = rng.range(0, 6.28);
    const col = [1, EYE_COL[1] + 0.07 * o, EYE_COL[2] + 0.03 * o];
    const d = { kind: 'decoy', type, x: px, z: pz, n: [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)], sharp, str, col, size: 0.016, seed: rng.next(), yaw: rng.range(0, 6.28), alive: true, base: { sharp, col: col.slice(), o } };
    f.decoys.push(d); f.put(d);
    labels.push({ it: d, name: name || label, cls: 'stone' });
    if (label.includes('2つ')) {
      const a = rng.range(0, 6.28);
      const d2 = { ...d, x: px + Math.cos(a) * 0.022, z: pz + Math.sin(a) * 0.022, seed: rng.next(), base: d.base };
      f.decoys.push(d2); f.put(d2);
    }
  };
  // 1 列目: 本物だけ、2 列目: 物だけ（種類ごと）、3 列目: まぜこぜ（札を消して自分でためす）
  for (let i = 0; i < 6; i++) addFugu(x - 1.5 + i * 0.6, z + 1.2, 'フグの眼');
  TYPES.forEach((T, i) => addDecoy(x - 1.5 + i * 0.6, z + 2.0, T));
  for (let i = 0; i < 10; i++) {
    const px = x - 2 + (i % 5) * 1.0 + rng.range(-0.2, 0.2), pz = z + 3.0 + Math.floor(i / 5) * 0.8 + rng.range(-0.15, 0.15);
    if (rng.next() < 0.45) addFugu(px, pz, 'フグの眼'); else addDecoy(px, pz, TYPES[Math.floor(rng.next() * TYPES.length)]);
  }
  game.player.reset(x, z, Math.PI);
  game.player.pitch = -0.45;
  game.pebbles.update(x, z, f, (a, b) => w.groundAt(a, b), true);

  // 札
  const host = document.createElement('div');
  host.id = 'lab-labels';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;font:700 11px sans-serif';
  document.body.appendChild(host);
  let show = true;
  for (const L of labels) {
    const e = document.createElement('div');
    e.textContent = L.name;
    e.style.cssText = `position:absolute;transform:translate(-50%,-150%);padding:1px 5px;border-radius:4px;white-space:nowrap;background:${L.cls === 'eye' ? 'rgba(200,40,30,.75)' : 'rgba(40,60,90,.75)'};color:#fff`;
    host.appendChild(e);
    L.el = e;
  }
  addEventListener('keydown', (e) => { if (e.code === 'KeyL') { show = !show; host.style.display = show ? '' : 'none'; } });

  // つまみ
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:12px;top:110px;z-index:40;background:rgba(0,10,25,.72);padding:10px 12px;border-radius:10px;color:#dfe8f5;font:12px sans-serif;display:grid;gap:6px;min-width:250px';
  panel.innerHTML = '<b style="font-size:13px">見分けの確認（L: 札）</b>';
  const sh = game.shine.uniforms;
  const K = { sharp: 1, color: 1 };
  const slider = (label, min, max, step, get, set) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:grid;grid-template-columns:110px 1fr 40px;gap:6px;align-items:center';
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    inp.value = get(); out.textContent = Number(get()).toFixed(2);
    inp.addEventListener('input', () => { set(Number(inp.value)); out.textContent = Number(inp.value).toFixed(2); });
    inp.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.appendChild(row);
  };
  const applyDecoys = () => {
    for (const d of f.decoys) {
      if (!d.base) continue;
      d.sharp = Math.max(0.2, d.base.sharp * K.sharp);
      d.col = [1, EYE_COL[1] + 0.07 * d.base.o * K.color, EYE_COL[2] + 0.03 * d.base.o * K.color];
    }
  };
  slider('光の強さ', 5, 80, 1, () => sh.uGain.value, (v) => (sh.uGain.value = v));
  slider('さざ波のゆれ', 0, 0.4, 0.01, () => sh.uWob.value, (v) => (sh.uWob.value = v));
  slider('物の光の鋭さ', 0.2, 3, 0.05, () => K.sharp, (v) => { K.sharp = v; applyDecoys(); });
  slider('物の色のちがい', 0, 3, 0.05, () => K.color, (v) => { K.color = v; applyDecoys(); });
  slider('物のまたたき', 0, 3, 0.05, () => sh.uShim.value, (v) => (sh.uShim.value = v));
  const note = document.createElement('div');
  note.style.cssText = 'opacity:.7;line-height:1.5';
  note.textContent = '1 列目: フグの眼 / 2 列目: まぎらわしい物 / 3 列目: まぜこぜ。頭を動かしたり、しゃがんだり（右クリック長押し）して見くらべる';
  panel.appendChild(note);
  document.body.appendChild(panel);

  // 札の位置を毎フレーム
  const v = new THREE.Vector3();
  const tick = () => {
    requestAnimationFrame(tick);
    if (!show) return;
    for (const L of labels) {
      if (!L.it.alive) { L.el.style.display = 'none'; continue; }
      v.set(L.it.x, w.groundAt(L.it.x, L.it.z) + 0.02, L.it.z).project(game.camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      L.el.style.display = vis ? '' : 'none';
      if (vis) { L.el.style.left = `${(v.x + 1) / 2 * innerWidth}px`; L.el.style.top = `${(1 - v.y) / 2 * innerHeight}px`; }
    }
  };
  tick();
  game.ui.hint('見分けの確認: <b>L</b> で札の表示を切りかえ。右上のつまみで、光り方を調整できる', 8);
}
