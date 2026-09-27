// ポストエフェクト: ブルーム + 水中のゆらぎ・マスク・水滴・酸欠・ブラックアウト
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uUnder: { value: 1 },
    uLowO2: { value: 0 },
    uPulse: { value: 0 },
    uBlackout: { value: 0 },
    uFlash: { value: 0 },
    uRed: { value: 0 },
    uDrops: { value: 0 },
    uAspect: { value: 1 },
    uFocus: { value: 0 },
    uMask: { value: 1 },
    uFade: { value: 0 },
    uWobble: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uUnder, uLowO2, uPulse, uBlackout, uFlash, uRed, uDrops, uAspect, uFocus, uMask, uFade, uWobble;
    varying vec2 vUv;
    float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    vec2 drops(vec2 uv, float amt, float t) {
      vec2 off = vec2(0.0);
      for (int L = 0; L < 2; L++) {
        float sc = L == 0 ? 7.0 : 13.0;
        vec2 g = uv * vec2(uAspect, 1.0) * sc;
        g.y += t * (0.12 + float(L) * 0.08);
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float r = h21(id + float(L) * 17.0);
        if (r < 0.55) continue;
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
      if (uUnder > 0.5) {
        uv += vec2(sin(uv.y * 23.0 + uTime * 1.7), cos(uv.x * 19.0 + uTime * 1.3)) * 0.0010 * uWobble;
      }
      if (uDrops > 0.001) uv += drops(uv, uDrops, uTime);
      vec2 dir = uv - 0.5;
      float ca = (0.0008 + r * r * 0.005) * (1.0 + uLowO2 * 2.5 + uUnder * 0.4);
      vec3 col;
      col.r = texture2D(tDiffuse, uv - dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + dir * ca).b;

      // 酸欠: 彩度が落ち、視野が狭まる
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum) * vec3(0.9, 0.95, 1.05), uLowO2 * 0.75);
      float tunnel = smoothstep(0.18 + (1.0 - uLowO2) * 0.3, 0.85, r) * uLowO2 * (0.75 + 0.25 * uPulse);
      col *= 1.0 - tunnel;
      col = mix(col, col * vec3(1.6, 0.35, 0.3), uRed * smoothstep(0.1, 0.75, r));

      // ダイビングマスクの縁
      vec2 m = abs(vUv - 0.5) * 2.0;
      float se = pow(pow(m.x, 5.0) + pow(m.y * 1.04, 5.0), 0.2);
      float frame = smoothstep(0.968, 0.992, se) * uMask;
      col *= 1.0 - smoothstep(0.82, 0.975, se) * 0.3 * uMask;
      col *= 1.0 - frame * 0.93;

      col *= 1.0 - smoothstep(0.55, 1.25, r) * 0.5;
      col *= 1.0 - smoothstep(0.3, 0.95, r) * uFocus * 0.45;
      col += uFlash * vec3(1.0, 0.96, 0.85) * 0.7;
      float bo = max(uBlackout, uFade);
      col *= 1.0 - bo;
      col *= 1.0 - smoothstep(0.6 - uBlackout * 0.6, 0.9 - uBlackout * 0.5, r) * uBlackout;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// ブルーム前の保険: NaN/無限大を消し、極端に明るい1ピクセルのきらめきを抑える
// （これが無いと、ブルームの縮小処理で四角いブロック状のちらつきになる）
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null }, uMax: { value: 6.0 } },
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

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.55, 0.86);
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
