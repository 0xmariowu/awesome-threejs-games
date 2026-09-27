// hdr.js
const Q = new URLSearchParams(location.search).get('hdr');
const HDR_ALL = Q === 'all';
const FORCE = Q === '1' || HDR_ALL;
const hdrScreen = () => FORCE || matchMedia('(dynamic-range: high)').matches;
const HDR_ASK = Q !== '0' && !!navigator.gpu && hdrScreen() && (FORCE || !matchMedia('(pointer: coarse)').matches);
const STOPS = 2;

function hdrOutputPass() {
  const p = new OutputPass();
  p.uniforms.uHdr = { value: new THREE.Vector3(0, 1, 4) };
  p.material.fragmentShader = p.material.fragmentShader
    .replace('varying vec2 vUv;', 'varying vec2 vUv;\nuniform vec3 uHdr;')
    .replace('gl_FragColor = texture2D( tDiffuse, vUv );', `gl_FragColor = texture2D( tDiffuse, vUv );
      vec3 hx = gl_FragColor.rgb * toneMappingExposure;
      float ht = clamp(log2(max(max(hx.r, hx.g), max(hx.b, 1e-6)) / uHdr.y) / log2(uHdr.z / uHdr.y), 0.0, 1.0);
      float hg = uHdr.x * ht * ht * (3.0 - 2.0 * ht);`)
    .replace(/}\s*$/, '  gl_FragColor.a = 1.0 - 0.5 * hg;\n}');
  return p;
}

const WGSL = `
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}
@group(0) @binding(0) var t: texture_2d<f32>;
fn dec(e: vec3f) -> vec3f { return select(pow((e + 0.055) / 1.055, vec3f(2.4)), e / 12.92, e <= vec3f(0.04045)); }
fn enc(l: vec3f) -> vec3f { return select(1.055 * pow(l, vec3f(1.0 / 2.4)) - 0.055, 12.92 * l, l <= vec3f(0.0031308)); }
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let s = textureLoad(t, vec2i(q.xy), 0);
  if (s.a >= 1.0) { return vec4f(s.rgb, 1.0); }
  return vec4f(enc(dec(s.rgb) * exp2(${(2 * STOPS).toFixed(1)} * (1.0 - s.a))), 1.0);
}`;

class Hdr {
  constructor(glCanvas, outPass) {
    this.gl = glCanvas;
    this.out = outPass;
    this.ok = false;
    this.on = false;
    this.shown = false;
    this.screen = HDR_ASK;
    this.cost = 0;
    this.n = 0;
  }

  async init() {
    if (!HDR_ASK) return false;
    let device = null;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return false;
      device = await adapter.requestDevice();
      const cv = document.createElement('canvas');
      cv.id = 'hdr';
      cv.hidden = true;
      const ctx = cv.getContext('webgpu');
      ctx.configure({ device, format: 'rgba16float', alphaMode: 'opaque', toneMapping: { mode: 'extended' } });
      const conf = ctx.getConfiguration ? ctx.getConfiguration() : null;
      if (!conf || !conf.toneMapping || conf.toneMapping.mode !== 'extended') { device.destroy(); return false; }
      const mod = device.createShaderModule({ code: WGSL });
      this.pipe = device.createRenderPipeline({
        layout: 'auto', vertex: { module: mod, entryPoint: 'vs' },
        fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
      });
      Object.assign(this, { device, cv, ctx, tex: null, bind: null });
      this.gl.after(cv);
      device.lost.then(() => this.drop());
      matchMedia('(dynamic-range: high)').addEventListener('change', () => { this.screen = hdrScreen(); });
      this.ok = true;
      return true;
    } catch (e) {
      console.warn(e);
      if (device) device.destroy();
      return false;
    }
  }

  begin(k) {
    if (this.n === 30 && this.ok && this.cost / 30 > 3) { console.warn(`hdr: ${(this.cost / 30).toFixed(1)} ms a frame, off`); this.drop(); }
    if (!this.ok) return;
    const g = !this.screen ? 0 : HDR_ALL ? 1 : k;
    this.out.uniforms.uHdr.value.x = g;
    this.on = g > 0;
  }

  present() {
    if (!this.ok) return;
    if (this.on !== this.shown) { this.cv.hidden = !this.on; this.shown = this.on; }
    if (!this.on) return;
    const t0 = performance.now();
    const { device, gl } = this, w = gl.width, h = gl.height;
    if (!this.tex || this.tex.width !== w || this.tex.height !== h) {
      if (this.tex) this.tex.destroy();
      this.cv.width = w;
      this.cv.height = h;
      this.tex = device.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.bind = device.createBindGroup({ layout: this.pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: this.tex.createView() }] });
    }
    device.queue.copyExternalImageToTexture({ source: gl }, { texture: this.tex, premultipliedAlpha: false }, [w, h]);
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    pass.setPipeline(this.pipe);
    pass.setBindGroup(0, this.bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
    if (this.n < 30) { this.cost += performance.now() - t0; this.n++; }
  }

  drop() {
    this.ok = false;
    this.on = false;
    this.out.uniforms.uHdr.value.x = 0;
    if (this.cv) this.cv.hidden = true;
    this.shown = false;
  }
}

