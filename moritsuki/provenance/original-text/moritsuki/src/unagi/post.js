// 描画の流れ: 水以外を描く（色＋深度）→ 水面・すだれ・重ねる物 → ブルーム → 画面の仕上げ
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WaterPass } from './water.js';

// 画面の仕上げ: しずく・フラッシュ・ふち暗・暗転・夜の粒子感
const FXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDrops: { value: 0 },
    uFlash: { value: 0 },
    uFade: { value: 0 },
    uAspect: { value: 1 },
    uGrain: { value: 1 },
    uFocus: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uDrops, uFlash, uFade, uAspect, uGrain, uFocus;
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
        if (r < 0.62) continue;
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
      if (uDrops > 0.001) uv += drops(uv, uDrops, uTime);
      vec2 dir = uv - 0.5;
      float ca = 0.0005 + r * r * 0.0035;
      vec3 col;
      col.r = texture2D(tDiffuse, uv - dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + dir * ca).b;
      col *= 1.0 - smoothstep(0.55, 1.25, r) * 0.5;
      col *= 1.0 - smoothstep(0.3, 0.95, r) * uFocus * 0.35;
      // 暗い所ほど目立つ細かい粒（夜の目の感じ）
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      float n = h21(uv * 913.0 + fract(uTime * 7.13) * 91.0) - 0.5;
      col += n * 0.018 * uGrain * (1.0 - smoothstep(0.0, 0.35, lum));
      col += uFlash * vec3(1.0, 0.97, 0.88) * 0.7;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class Post {
  constructor(renderer, scene, waterScene, overlay, camera) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
    rt.depthTexture.type = THREE.UnsignedIntType;
    this.composer = new EffectComposer(renderer, rt);
    // 2 枚目の画面は複製なので、深度のテクスチャが 1 枚目と同じ実体になる（水を描くときに深度が消える）。別の深度を持たせる
    const d2 = new THREE.DepthTexture(size.x, size.y);
    d2.type = THREE.UnsignedIntType;
    this.composer.renderTarget2.depthTexture = d2;
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.water = new WaterPass(camera, waterScene, overlay);
    this.composer.addPass(this.water);
    // ブルームは 1/3 の解像度で（ぼかすものなので見た目はほぼ変わらない）
    // しきい値は肌や網（ライトの近く）がにじまない高さ。にじむのは灯り・目の反射・水のきらめき
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 3, size.y / 3), 0.6, 0.55, 1.25);
    const bs = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => bs(Math.ceil(w / 3), Math.ceil(h / 3));
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
