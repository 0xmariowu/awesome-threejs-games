// 描画の流れ: 水以外を描く（色＋深度）→ 水面 → 水より手前のしぶき → ブルーム → 画面の仕上げ
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { WaterPass } from './water.js';

// 画面の仕上げ: 水滴・フラッシュ・ふち暗・暗転・水をかぶった時のゆがみ
const FXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDrops: { value: 0 },
    uFlash: { value: 0 },
    uFade: { value: 0 },
    uAspect: { value: 1 },
    uDunk: { value: 0 },
    uFocus: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uDrops, uFlash, uFade, uAspect, uDunk, uFocus;
    varying vec2 vUv;
    float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec2 drops(vec2 uv, float amt, float t) {
      vec2 off = vec2(0.0);
      for (int L = 0; L < 2; L++) {
        float sc = L == 0 ? 6.0 : 11.0;
        vec2 g = uv * vec2(uAspect, 1.0) * sc;
        g.y += t * (0.1 + float(L) * 0.07);
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float r = h21(id + float(L) * 17.0);
        if (r < 0.58) continue;
        vec2 o = vec2(h21(id + 3.1) - 0.5, h21(id + 7.7) - 0.5) * 0.45;
        vec2 q = f - o;
        float rad = (0.1 + 0.18 * h21(id + 1.3)) * (L == 0 ? 1.0 : 0.7);
        float d = length(q * vec2(1.0, 0.85));
        float m = 1.0 - smoothstep(rad * 0.55, rad, d);
        off += -q * m * (0.9 / sc);
      }
      return off * amt;
    }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      c.x *= uAspect;
      float r = length(c);
      if (uDunk > 0.001) uv += vec2(sin(uv.y * 21.0 + uTime * 3.1), cos(uv.x * 17.0 + uTime * 2.3)) * 0.004 * uDunk;
      if (uDrops > 0.001) uv += drops(uv, uDrops, uTime);
      vec2 dir = uv - 0.5;
      float ca = 0.0006 + r * r * 0.004;
      vec3 col;
      col.r = texture2D(tDiffuse, uv - dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + dir * ca).b;
      col *= 1.0 - smoothstep(0.6, 1.3, r) * 0.42;
      col *= 1.0 - smoothstep(0.3, 0.95, r) * uFocus * 0.35;
      col += uFlash * vec3(1.0, 0.97, 0.88) * 0.7;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const SanitizeShader = {
  uniforms: { tDiffuse: { value: null }, uMax: { value: 7.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uMax;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c.rgb)) || any(isinf(c.rgb))) c.rgb = vec3(0.0);
      c.rgb = clamp(c.rgb, vec3(0.0), vec3(uMax));
      gl_FragColor = vec4(c.rgb, 1.0);
    }
  `,
};

// （NaN・明るすぎる画素の始末は水面の処理の最後でしている）
// 水面より手前に描くもの（しぶき・水滴）。深度は自前で比べるので、ここでは描き足すだけ
class OverlayPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene; this.camera = camera;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = ac;
  }
}

export class Post {
  constructor(renderer, scene, overlay, camera, beach, murk) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
    rt.depthTexture.type = THREE.UnsignedIntType;
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.water = new WaterPass(camera, beach, murk);
    this.composer.addPass(this.water);
    this.overlay = new OverlayPass(overlay, camera);
    this.composer.addPass(this.overlay);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.5, 0.9);
    // ブルームは半分の解像度で（ぼかすものなので見た目は変わらない）
    const bs = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => bs(Math.ceil(w / 2), Math.ceil(h / 2));
    this.composer.addPass(this.bloom);
    this.fx = new ShaderPass(FXShader);
    this.composer.addPass(this.fx);
    this.composer.addPass(new OutputPass());
    this.u = this.fx.uniforms;
  }
  setSize(w, h) {
    this.composer.setSize(w, h);
    this.u.uAspect.value = w / h;
  }
  setPixelRatio(pr) { this.composer.setPixelRatio(pr); }
  render() { this.composer.render(); }
}
