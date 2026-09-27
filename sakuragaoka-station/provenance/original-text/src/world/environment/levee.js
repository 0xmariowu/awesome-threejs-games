// environment/levee.js — 桜堤: the pale levee-top path (R5) with painted edge lines, concrete stairs
// on the town-side slope (x≈-12 at the end of R2, x≈40 with handrails), benches, the wooden
// 桜川堤 さくら並木 signboard, lamp posts every ~40 m, river km posts and a small notice sign.
import * as L from '../layout.js';
import { smoothstep, clamp } from './common.js';

const R5 = L.ROADS.R5;
export const PATH_Y = R5.y + 0.03;
export const STAIRS = [
  { x: -12, w: 3.0, rails: false, bike: true },
  { x: 40, w: 2.2, rails: true, bike: false },
];
export const BENCHES = [{ x: -58.5 }, { x: 17.5 }, { x: 63 }, { x: -101 }];
export const LAMPS = [-121, -81, -41, 1.5, 44.5, 81, 121];

/** z on the town-side slope where heightAt == y (inverse of the smoothstep profile). */
function zAtHeight(y) {
  const target = clamp(y / 3.2, 0, 1);
  let a = 0, b = 1;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (smoothstep(0, 1, m) < target) a = m; else b = m; }
  return -84 - 7.5 * (a + b) / 2;
}

export function buildLevee(ctx, tx) {
  const { THREE } = ctx;
  const grp = new THREE.Group(); grp.name = 'env-levee'; ctx.addStatic(grp);
  const k = ctx.kit(grp);
  const P = ctx.palette;

  // ---------------------------------------------------------------- path surface (pale fine asphalt) + edge skirts
  {
    const mat = ctx.mat.toon('#d9d6cd', { map: tx.path, paint: 0.04, name: 'env-r5' });
    const x0 = R5.x0, x1 = R5.x1, zN = R5.z - R5.halfW, zS = R5.z + R5.halfW;
    const pos = [], uv = [], nrm = [], idx = [];
    const n = 52;
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n;
      for (const [z, y, ny, nz] of [[zS, PATH_Y - 0.09, 0, 1], [zS, PATH_Y, 1, 0], [zN, PATH_Y, 1, 0], [zN, PATH_Y - 0.09, 0, -1]]) {
        pos.push(x, y, z); uv.push(x / 4.2, -z / 4.2 + (ny ? 0 : 0.1)); nrm.push(0, ny, nz);
      }
      if (i) { const a = (i - 1) * 4, b = i * 4; for (let q = 0; q < 3; q++) idx.push(a + q, b + q, a + q + 1, a + q + 1, b + q, b + q + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeBoundingSphere();
    // winding check: first top triangle must face +Y
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; m.name = 'env-r5-path';
    grp.add(m);
    // painted edge lines (white, slightly worn: broken every so often)
    const lineMat = ctx.mat.decal('#f1efe8', { paint: 0.03 });
    const r = ctx.rng('env-r5-lines');
    for (const z of [zS - 0.22, zN + 0.22]) {
      let x = x0 + 0.4;
      while (x < x1 - 0.4) {
        const len = Math.min(x1 - 0.4 - x, 6 + r() * 14);
        const near = STAIRS.some((s) => Math.abs(x + len / 2 - s.x) < s.w / 2 + len / 2) && z > R5.z;
        if (!near) k.box(len, 0.01, 0.11, lineMat, [x + len / 2, PATH_Y + 0.006, z]);
        x += len + (r() < 0.25 ? 0.3 + r() * 0.5 : 0.02);
      }
    }
    // painted 歩行者優先 markings (read along the path)
    const mark = ctx.tex.draw(512, 128, (gg, w, h) => {
      gg.clearRect(0, 0, w, h); gg.fillStyle = '#f4f2ea'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
      ctx.tex.fitText(gg, '歩行者優先', w / 2, h * 0.55, w * 0.94, 104, ctx.tex.FONTS.sans, 900);
    }, { key: 'env-r5-mark' });
    const mm = ctx.mat.decal('#ffffff', { map: mark, paint: 0.02 });
    for (const [x, rot] of [[-30, -Math.PI / 2], [72, Math.PI / 2]]) {
      const p = k.plane(2.4, 0.6, mm, [x, PATH_Y + 0.007, R5.z], [-Math.PI / 2, 0, rot]);
      p.receiveShadow = true;
    }
  }

  // ---------------------------------------------------------------- concrete stairs on the town-side slope
  const conc = ctx.mat.toon('#d4d0c5', { paint: 0.08, name: 'env-stair' });
  const concDark = ctx.mat.toon('#bdb9ad', { paint: 0.07 });
  const steel = ctx.mat.toon('#cfd4d6', { paint: 0.02 });
  const n = 18, rise = 3.2 / n;
  const stairInfo = [];
  for (const S of STAIRS) {
    const nos = [];
    for (let i = 0; i < n; i++) {
      const zA = zAtHeight(i * rise) + (i === 0 ? 0.25 : 0), zB = zAtHeight((i + 1) * rise);
      const top = (i + 1) * rise;
      const bottom = i * rise - 0.35;
      k.box(S.w, top - bottom, zA - zB, conc, [S.x, (top + bottom) / 2, (zA + zB) / 2]);
      // nosing line (slightly darker, anti-slip groove)
      k.box(S.w, 0.012, 0.05, concDark, [S.x, top + 0.006, zA - 0.06]);
      ctx.physics.addWalkBox(S.x, (zA + zB) / 2, S.w, zA - zB, 0, top);
      nos.push([zA, top]);
    }
    nos.push([zAtHeight(3.2) - 0.02, 3.2]);
    // cheek walls (sloped top following the nosings)
    const pts = [[-(-83.55), 0.16]];
    for (const [z, y] of nos) pts.push([-z, y + 0.14]);
    const last = nos[nos.length - 1][0];
    pts.push([-last, 3.2 + 0.14 - 0.1], [-last, 2.6]);
    for (let i = nos.length - 1; i >= 0; i--) pts.push([-nos[i][0], nos[i][1] - rise - 0.5]);
    pts.push([-(-83.55), -0.4]);
    const shp = pts.map(([a, b]) => [a, b]);
    for (const s of [-1, 1]) {
      const gg = ctx.geo.extrude(shp, 0.2); gg.rotateY(Math.PI / 2);
      const cw = new THREE.Mesh(gg, conc); cw.position.set(S.x + s * (S.w / 2 + 0.1), 0, 0); cw.castShadow = true; cw.receiveShadow = true; grp.add(cw);
    }
    // bicycle groove (自転車用スロープ) along the east edge
    if (S.bike) {
      const pos = [], idx = [];
      const xs0 = S.x + S.w / 2 - 0.45, xs1 = S.x + S.w / 2 - 0.05;
      const line = [[-83.6, 0.04], ...nos.map(([z, y]) => [z, y + 0.02])];
      line.forEach(([z, y], i) => { pos.push(xs0, y, z, xs1, y, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
      if (bg.attributes.normal.getY(0) < 0) { const ia = bg.index.array; for (let i = 0; i < ia.length; i += 3) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; } bg.computeVertexNormals(); }
      const bm = new THREE.Mesh(bg, concDark); bm.receiveShadow = true; grp.add(bm);
      // small side lip of the groove
      for (let i = 0; i < line.length - 1; i++) {
        const [za, ya] = line[i], [zb, yb] = line[i + 1];
        const len = Math.hypot(za - zb, ya - yb);
        k.box(0.06, 0.06, len, conc, [xs0 - 0.03, (ya + yb) / 2 + 0.03, (za + zb) / 2], [Math.atan2(yb - ya, za - zb), 0, 0]);
      }
    }
    // handrails (galvanised pipes) on both sides
    if (S.rails) {
      for (const s of [-1, 1]) {
        const xr = S.x + s * (S.w / 2 - 0.12);
        const railPts = [];
        for (let i = 0; i <= n; i += 3) { const [z, y] = nos[Math.min(i, nos.length - 1)]; railPts.push([z, y]); }
        railPts.push(nos[nos.length - 1]);
        for (let i = 0; i < railPts.length; i++) {
          const [z, y] = railPts[i];
          k.cyl(0.028, 0.028, 0.9, steel, [xr, y + 0.45, z - 0.12], null, 8);
          ctx.physics.addCylinder(xr, z - 0.12, 0.06, y, y + 1.0);
          if (i) {
            const [z0, y0] = railPts[i - 1];
            const len = Math.hypot(z - z0, y - y0);
            const ang = Math.atan2(y - y0, z0 - z);
            k.cyl(0.03, 0.03, len, steel, [xr, (y + y0) / 2 + 0.88, (z + z0) / 2 - 0.12], [ang - Math.PI / 2, 0, 0], 8);
            k.cyl(0.022, 0.022, len, steel, [xr, (y + y0) / 2 + 0.45, (z + z0) / 2 - 0.12], [ang - Math.PI / 2, 0, 0], 8);
            const mz = (z + z0) / 2 - 0.12, dzl = Math.abs(z - z0);
            ctx.physics.addBox(xr, mz, 0.1, dzl, 0, Math.min(y, y0), Math.max(y, y0) + 1.0);
          }
        }
      }
    }
    stairInfo.push({ x: S.x, w: S.w + 0.4, z0: -91.6, z1: -83.5 });
  }

  // ---------------------------------------------------------------- benches (facing the river, on the river-side edge)
  const wood = ctx.mat.toon('#b48a62', { paint: 0.09, name: 'env-benchwood' });
  const woodD = ctx.mat.toon('#8a6446', { paint: 0.08 });
  const benchInfo = [];
  for (const b of BENCHES) {
    const z = R5.z - R5.halfW + 0.42, y = PATH_Y;
    const bg = k.group([b.x, y, z], Math.PI); // faces north (-Z)
    const kb = ctx.kit(bg);
    for (const sx of [-0.72, 0.72]) {
      kb.box(0.09, 0.42, 0.46, conc, [sx, 0.21, 0.0]);
      kb.box(0.08, 0.5, 0.07, conc, [sx, 0.68, -0.21], [-0.12, 0, 0]);
    }
    for (let s = 0; s < 4; s++) kb.box(1.78, 0.04, 0.095, wood, [0, 0.44, -0.16 + s * 0.108]);
    for (let s = 0; s < 3; s++) kb.box(1.78, 0.085, 0.035, s === 1 ? woodD : wood, [0, 0.6 + s * 0.13, -0.235 - s * 0.018], [-0.12, 0, 0]);
    ctx.physics.addBox(b.x, z, 1.9, 0.62, Math.PI, y, y + 0.95);
    benchInfo.push({ x: b.x, z, y: y + 0.44, rotY: Math.PI, len: 1.78 });
  }

  // ---------------------------------------------------------------- 桜川堤 さくら並木 wooden signboard at the top of the R2 stairs
  {
    const board = ctx.tex.draw(1024, 512, (g, w, h) => {
      const r = ctx.rng('env-signwood');
      g.fillStyle = '#8f6a48'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { const y = r() * h; g.strokeStyle = r() < 0.5 ? 'rgba(96,66,44,0.35)' : 'rgba(190,150,110,0.3)'; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 18, w * 0.7, y + (r() - 0.5) * 18, w, y + (r() - 0.5) * 10); g.stroke(); }
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(70,48,32,0.5)'; g.fillRect(0, (i + 1) * h / 5 - 2, w, 3); }
      g.strokeStyle = '#5a4032'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
      // painted petals
      for (let i = 0; i < 14; i++) { const x = 40 + r() * (w - 80), y = 30 + r() * 60; g.fillStyle = r() < 0.5 ? '#f3c3d3' : '#f8dce6'; g.beginPath(); g.ellipse(x, y, 11, 7, r() * 3, 0, 7); g.fill(); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fbf3e4';
      ctx.tex.fitText(g, '桜川堤 さくら並木', w / 2, h * 0.42, w * 0.88, 150, ctx.tex.FONTS.brush, 400);
      g.fillStyle = '#f4e3cf';
      ctx.tex.fitText(g, 'さくらがわづつみ さくらなみき', w / 2, h * 0.66, w * 0.7, 40, ctx.tex.FONTS.serif, 700);
      g.globalAlpha = 0.9;
      ctx.tex.fitText(g, 'Sakuragawa-zutsumi Cherry Blossom Promenade', w / 2, h * 0.77, w * 0.8, 30, ctx.tex.FONTS.en, 500);
      ctx.tex.fitText(g, 'ソメイヨシノ 約160本・全長 約1.2km　　桜ヶ丘町観光協会', w / 2, h * 0.88, w * 0.84, 28, ctx.tex.FONTS.sans, 500);
      g.globalAlpha = 1;
    }, { key: 'env-levee-sign' });
    const sx = -8.9, sz = R5.z - R5.halfW + 0.35, y = PATH_Y;
    const sg = k.group([sx, y, sz], 0.08);
    const ks = ctx.kit(sg);
    for (const px of [-0.86, 0.86]) { ks.box(0.12, 1.85, 0.12, woodD, [px, 0.925, 0]); ks.box(0.16, 0.06, 0.16, woodD, [px, 1.88, 0]); }
    ks.box(1.86, 0.95, 0.07, wood, [0, 1.3, 0]);
    ks.plane(1.74, 0.87, ctx.mat.toon('#ffffff', { map: board, paint: 0.03 }), [0, 1.3, 0.037]);
    ks.box(2.02, 0.07, 0.2, woodD, [0, 1.81, 0.0]);           // little roof
    ks.box(0.3, 0.05, 0.3, conc, [-0.86, 0.02, 0]); ks.box(0.3, 0.05, 0.3, conc, [0.86, 0.02, 0]);
    ctx.physics.addBox(sx, sz, 2.0, 0.25, 0.08, y, y + 2.0);
  }

  // ---------------------------------------------------------------- lamp posts (retro lantern heads)
  const poleMat = ctx.mat.toon('#5f6d6a', { paint: 0.03, name: 'env-lamppole' });
  const glassMat = ctx.mat.emissive('#fff4dc', 0.95);
  const lampInfo = [];
  for (const x of LAMPS) {
    const z = R5.z - R5.halfW + 0.2, y = PATH_Y;
    k.cyl(0.16, 0.2, 0.3, concDark, [x, y + 0.15, z], null, 10);
    k.cyl(0.055, 0.075, 3.5, poleMat, [x, y + 1.95, z], null, 10);
    k.cyl(0.09, 0.09, 0.22, poleMat, [x, y + 0.42, z], null, 10);
    k.box(0.05, 0.05, 0.42, poleMat, [x, y + 3.68, z + 0.2]);
    const hz = z + 0.4;
    k.cyl(0.19, 0.12, 0.09, poleMat, [x, y + 3.62, hz], null, 8);
    k.cyl(0.13, 0.1, 0.34, glassMat, [x, y + 3.4, hz], null, 8);
    k.cyl(0.07, 0.13, 0.05, poleMat, [x, y + 3.2, hz], null, 8);
    ctx.physics.addCylinder(x, z, 0.14, y, y + 4);
    lampInfo.push({ x, z, y: y + 3.4 });
  }

  // ---------------------------------------------------------------- river km posts (距離標) + notice sign
  const kmTex = (label) => ctx.tex.draw(128, 256, (g, w, h) => {
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f4f8f'; g.fillRect(0, 0, w, 44);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ctx.tex.fitText(g, '桜川', w / 2, 23, w * 0.9, 30, ctx.tex.FONTS.sans, 900);
    g.fillStyle = '#2f3a52';
    ctx.tex.fitText(g, '右岸', w / 2, 80, w * 0.9, 30, ctx.tex.FONTS.sans, 700);
    ctx.tex.fitText(g, label, w / 2, 150, w * 0.92, 46, ctx.tex.FONTS.sans, 900);
    ctx.tex.fitText(g, 'km', w / 2, 205, w * 0.9, 26, ctx.tex.FONTS.en, 700);
  }, { key: 'env-km-' + label });
  for (const [x, label] of [[-100.5, '3.4'], [99.5, '3.2']]) {
    const z = R5.z + R5.halfW - 0.2;
    const pg = k.group([x, PATH_Y, z], 0);
    const kp = ctx.kit(pg);
    kp.box(0.16, 0.8, 0.16, ctx.mat.toon('#e9e7e0', { paint: 0.05 }), [0, 0.4, 0]);
    kp.plane(0.14, 0.28, ctx.mat.toon('#ffffff', { map: kmTex(label), paint: 0.02 }), [0, 0.52, 0.081]);
    ctx.physics.addCylinder(x, z, 0.12, PATH_Y, PATH_Y + 0.8);
  }
  {
    const notice = ctx.tex.draw(256, 192, (g, w, h) => {
      g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2f64b5'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#d9463b'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ctx.tex.fitText(g, 'ゴミの投げ捨て', w / 2, 46, w * 0.86, 34, ctx.tex.FONTS.sans, 900);
      ctx.tex.fitText(g, 'やめましょう', w / 2, 88, w * 0.86, 34, ctx.tex.FONTS.sans, 900);
      g.fillStyle = '#2f3a52';
      ctx.tex.fitText(g, 'ペットのフンは持ち帰りましょう', w / 2, 132, w * 0.88, 18, ctx.tex.FONTS.sans, 700);
      ctx.tex.fitText(g, '桜ヶ丘町　河川愛護会', w / 2, 164, w * 0.8, 17, ctx.tex.FONTS.sans, 500);
    }, { key: 'env-notice' });
    const x = 43.2, z = R5.z + R5.halfW - 0.18;
    const g = k.group([x, PATH_Y, z], -0.1);
    const kn = ctx.kit(g);
    kn.cyl(0.03, 0.03, 1.5, steel, [0, 0.75, -0.02], null, 8);
    kn.box(0.46, 0.34, 0.02, ctx.mat.toon('#f2f2ef', { paint: 0.02 }), [0, 1.3, 0]);
    kn.plane(0.44, 0.32, ctx.mat.toon('#ffffff', { map: notice, paint: 0.02 }), [0, 1.3, 0.011]);
    ctx.physics.addCylinder(x, z, 0.08, PATH_Y, PATH_Y + 1.5);
  }

  return { stairs: stairInfo, benches: benchInfo, lamps: lampInfo };
}
