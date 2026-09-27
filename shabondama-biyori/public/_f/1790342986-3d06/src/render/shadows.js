// 太陽の影：遠距離（谷全体・起動時に一度）と近距離（視点の前方・毎フレーム）
import * as THREE from 'three';

function makeRT(size) {
  const dt = new THREE.DepthTexture(size, size, THREE.FloatType);
  dt.magFilter = THREE.LinearFilter; dt.minFilter = THREE.LinearFilter;
  const rt = new THREE.WebGLRenderTarget(size, size, { depthTexture: dt, format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: true });
  return rt;
}

export class Shadows {
  constructor(renderer, shared, reversed) {
    this.renderer = renderer;
    this.reversed = reversed;
    this.farRT = makeRT(4096);
    this.nearRT = makeRT(2048);
    const cmp = reversed ? THREE.GreaterEqualCompare : THREE.LessEqualCompare;
    this.farRT.depthTexture.compareFunction = cmp;
    this.nearRT.depthTexture.compareFunction = cmp;
    this.farCam = new THREE.OrthographicCamera(-1090, 1090, 1090, -1090, 1, 4000);
    this.nearCam = new THREE.OrthographicCamera(-60, 60, 60, -60, 1, 1400);
    if (reversed) { this.farCam._reversedDepth = true; this.nearCam._reversedDepth = true; }
    this.farCam.updateProjectionMatrix(); this.nearCam.updateProjectionMatrix();
    this.bias = new THREE.Matrix4();
    if (reversed) this.bias.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 1, 0, 0, 0, 0, 1);
    else this.bias.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    shared.tShadowN = { value: this.nearRT.depthTexture };
    shared.tShadowF = { value: this.farRT.depthTexture };
    shared.uShadowNMat = { value: new THREE.Matrix4() };
    shared.uShadowFMat = { value: new THREE.Matrix4() };
    shared.uShadowP = { value: new THREE.Vector4(1 / 2048, 1 / 4096, 0, reversed ? -1 : 1) };
    this.shared = shared;
    this._v = new THREE.Vector3();
    this.nearHalf = 60;
    // 描画先として一度使って初期化しておく（比較モード付きの深度テクスチャとして確保される）
    for (const rt of [this.farRT, this.nearRT]) { renderer.setRenderTarget(rt); renderer.setClearColor(0, 1); renderer.clear(true, true, false); }
    renderer.setRenderTarget(null);
  }

  _matrix(cam, out) {
    cam.updateMatrixWorld();
    out.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    out.premultiply(this.bias);
  }

  _render(scene, cam, rt, filter) {
    const r = this.renderer;
    const swapped = [];
    scene.traverse((o) => {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      if (!o.visible) return;
      const dm = o.userData.depthMaterial;
      if (!dm || (filter && !filter(o))) { o.visible = false; swapped.push([o, null]); return; }
      swapped.push([o, o.material]);
      o.material = dm;
    });
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    r.render(scene, cam);
    for (const [o, m] of swapped) { if (m === null) o.visible = true; else o.material = m; }
  }

  // 谷全体（起動時）
  renderFar(scene, sunDir, beforeRender) {
    const c = new THREE.Vector3(0, 60, 0);
    this.farCam.position.copy(c).addScaledVector(sunDir, 2000);
    this.farCam.lookAt(c);
    this.farCam.updateMatrixWorld();
    if (beforeRender) beforeRender(this.farCam);
    this._render(scene, this.farCam, this.farRT, (o) => o.userData.farShadow !== false);
    this._matrix(this.farCam, this.shared.uShadowFMat.value);
  }

  // 視点の前方の狭い範囲（毎フレーム）
  renderNear(scene, sunDir, focus, half, beforeRender) {
    this.nearHalf = half;
    const cam = this.nearCam;
    if (cam.right !== half) {
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();
    }
    // テクセル単位に寄せてちらつきを抑える
    const up = Math.abs(sunDir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const lz = sunDir.clone().normalize();
    const lx = new THREE.Vector3().crossVectors(up, lz).normalize();
    const ly = new THREE.Vector3().crossVectors(lz, lx);
    const texel = (2 * half) / 2048;
    const px = Math.round(focus.dot(lx) / texel) * texel, py = Math.round(focus.dot(ly) / texel) * texel, pz = focus.dot(lz);
    const f = new THREE.Vector3().addScaledVector(lx, px).addScaledVector(ly, py).addScaledVector(lz, pz);
    cam.position.copy(f).addScaledVector(lz, 700);
    cam.up.copy(ly);
    cam.lookAt(f);
    cam.updateMatrixWorld();
    if (beforeRender) beforeRender(cam);
    this._render(scene, cam, this.nearRT, (o) => o.userData.nearShadow !== false);
    this._matrix(cam, this.shared.uShadowNMat.value);
    this.shared.uShadowP.value.x = 1 / 2048;
    this.shared.uShadowP.value.z = 1;
  }
}
