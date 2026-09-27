import * as THREE from 'three';

export const CLOUD_BANKS = [
  { center: [-142, 31, -75], radius: [70, 33, 77] },
  { center: [158, 37, 40], radius: [72, 35, 66] },
  { center: [-100, 48, 160], radius: [78, 40, 80] },
  { center: [108, 60, -183], radius: [85, 42, 80] },
  { center: [8, 30, 238], radius: [100, 32, 72] },
  { center: [-255, 39, -95], radius: [85, 42, 93] },
] as const;

/** Half-resolution world-space cloud volume; composited behind opaque scenery. */
export class Atmosphere {
  readonly background: THREE.Mesh;
  private target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private passScene = new THREE.Scene();
  private passCamera = new THREE.Camera();
  private material: THREE.ShaderMaterial;
  private elapsed = -100;
  private origin = new THREE.Vector3();
  private orientation = new THREE.Quaternion();
  private frames = 0;

  constructor() {
    const size = 64;
    const bytes = new Uint8Array(size ** 3);
    let seed = 317;
    for (let i = 0; i < bytes.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      bytes[i] = seed >>> 24;
    }
    const noise = new THREE.Data3DTexture(bytes, size, size, size);
    noise.format = THREE.RedFormat;
    noise.minFilter = noise.magFilter = THREE.LinearFilter;
    noise.wrapS = noise.wrapT = noise.wrapR = THREE.RepeatWrapping;
    noise.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        noiseVolume: { value: noise }, cameraWorld: { value: new THREE.Matrix4() },
        inverseProjection: { value: new THREE.Matrix4() }, eye: { value: new THREE.Vector3() },
        time: { value: 0 }, sun: { value: new THREE.Vector3(.65, .52, -.17).normalize() },
        cloudCenters: { value: CLOUD_BANKS.map(b => new THREE.Vector3(...b.center)) },
        cloudRadii: { value: CLOUD_BANKS.map(b => new THREE.Vector3(...b.radius)) },
      },
      vertexShader: `out vec2 uvScreen; void main(){ uvScreen=position.xy*.5+.5; gl_Position=vec4(position.xy,1.0,1.0); }`,
      fragmentShader: `precision highp sampler3D;
        uniform sampler3D noiseVolume; uniform mat4 cameraWorld; uniform mat4 inverseProjection;
        uniform vec3 eye; uniform vec3 sun; uniform float time; in vec2 uvScreen; out vec4 cloudColor;
        uniform vec3 cloudCenters[6]; uniform vec3 cloudRadii[6];
        // Smooth interpolation between voxel centers removes the lattice in lit clouds.
        float noise3(vec3 p){
          vec3 f=fract(p); f=f*f*(3.0-2.0*f);
          return texture(noiseVolume,(floor(p)+f+.5)/64.0).r;
        }
        float fbm(vec3 p){
          mat3 rotate=mat3(.80,-.60,0.0,.48,.64,-.60,.36,.48,.80);
          float n=noise3(p)*.57; p=rotate*p*2.03+17.0;
          n+=noise3(p)*.28; p=rotate*p*2.03+14.0;
          return n+noise3(p)*.15;
        }
        float density(vec3 p){
          vec3 noiseP=p+vec3(time*.16,0.0,0.0);
          float lower=0.0;
          if(p.y<6.0){
            float height=clamp((p.y+38.0)/44.0,0.0,1.0);
            vec3 rolling=noiseP*.048;
            rolling+=vec3(noise3(noiseP*.015),noise3(noiseP*.015+23.0),noise3(noiseP*.015+41.0))*2.4;
            float broad=fbm(rolling);
            float shape=(broad-(.30+.37*height*height))*3.5;
            lower=clamp(shape,0.0,1.0)*smoothstep(0.0,.18,height)*(1.0-smoothstep(.90,1.0,height));
          }
          float upper=0.0;
          if(p.y>-9.0){
            float envelope=-10.0;
            for(int b=0;b<6;b++)envelope=max(envelope,1.0-length((p-cloudCenters[b])/cloudRadii[b]));
            if(envelope>-.26){
              float shape=envelope+(fbm(noiseP*.09)-.51)*.92;
              upper=smoothstep(-.035,.37,shape)*.68;
            }
          }
          return max(lower,upper);
        }
        void main(){
          vec4 view=inverseProjection*vec4(uvScreen*2.0-1.0,1.0,1.0);
          vec3 ray=normalize((cameraWorld*vec4(normalize(view.xyz/view.w),0.0)).xyz);
          float elevation=clamp(ray.y*.8+.1,0.0,1.0);
          vec3 sky=mix(vec3(.43,.69,.90),vec3(.035,.22,.49),pow(elevation,.28));
          float sunset=pow(max(0.0,dot(ray,sun)),7.0);
          sky+=vec3(.30,.19,.085)*sunset;
          // Two distant layers of stretched cirrus remain in world space while turning.
          if(ray.y>.012){
            vec3 high=eye+ray*((145.0-eye.y)/ray.y);
            vec3 cirrus=vec3(high.x*.028+time*.004,high.z*.044,9.3);
            float wisps=fbm(cirrus+vec3(fbm(cirrus*.45)*3.0,0.0,0.0))*.72+fbm(cirrus*3.1+17.0)*.28;
            float veil=smoothstep(.52,.70,wisps)*smoothstep(.08,.25,ray.y)*.65;
            float strands=fbm(vec3(high.x*.07+high.z*.014,high.z*.16,31.4));
            veil*=.5+strands*.8;
            vec3 cloud=mix(vec3(.69,.85,.94),vec3(1.55,1.35,.96),sunset);
            sky=mix(sky,cloud,veil);
            float halo=pow(max(dot(ray,sun),0.0),35.0);
            sky+=vec3(.15,.14,.09)*halo;
          }
          sky+=vec3(3.0,2.4,1.6)*smoothstep(.9993,.99985,dot(ray,sun));
          vec3 accumulated=vec3(0.0); float transmit=1.0;
          {
            float dy=abs(ray.y)<.001?(ray.y<0.0?-.001:.001):ray.y;
            float a=(-38.0-eye.y)/dy,b=(105.0-eye.y)/dy;
            float enter=max(0.0,min(a,b));
            float leave=min(560.0,max(a,b));
            if(leave>enter){
              float stepSize=clamp((leave-enter)/128.0,.28,4.5);
              float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
              float travel=enter+stepSize*jitter;
              for(int i=0;i<136;i++){
                if(travel>leave||transmit<.015)break;
                vec3 p=eye+ray*travel; float d=density(p);
                if(d>.008){
                  float shadow=density(p+sun*2.5)*.50+density(p+sun*6.0)*.35+density(p+sun*12.0)*.15;
                  float light=exp(-shadow*4.8);
                  float silver=pow(max(dot(ray,sun),0.0),6.0)*.18;
                  vec3 shadowTint=vec3(.23,.32,.41);
                  vec3 color=mix(shadowTint,vec3(1.53,1.51,1.43),light*.88+silver);
                  color+=vec3(.08,.10,.11)*smoothstep(-28.0,0.0,p.y);
                  float haze=1.0-exp(-travel*.0016);
                  color=mix(color,sky,haze);
                  float opacity=1.0-exp(-d*stepSize*.55);
                  accumulated+=transmit*color*opacity; transmit*=1.0-opacity;
                }
                travel+=stepSize;
              }
            }
          }
          cloudColor=vec4(accumulated+sky*transmit,1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.passScene.add(quad);
    const output = new THREE.ShaderMaterial({
      uniforms: { skyTexture: { value: this.target.texture }, texel: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 skyUV; void main(){skyUV=position.xy*.5+.5;gl_Position=vec4(position.xy,1.0,1.0);}',
      fragmentShader: `uniform sampler2D skyTexture; uniform vec2 texel; varying vec2 skyUV;
        void main(){
          vec4 color=texture2D(skyTexture,skyUV)*.40;
          color+=texture2D(skyTexture,skyUV+vec2(texel.x,0.0))*.15;
          color+=texture2D(skyTexture,skyUV-vec2(texel.x,0.0))*.15;
          color+=texture2D(skyTexture,skyUV+vec2(0.0,texel.y))*.15;
          color+=texture2D(skyTexture,skyUV-vec2(0.0,texel.y))*.15;
          gl_FragColor=color;
        }`,
      depthTest: false, depthWrite: false,
    });
    this.background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), output);
    this.background.frustumCulled = false;
    this.background.renderOrder = -10000;
  }

  resize(width: number, height: number) {
    this.target.setSize(Math.round(width * .7), Math.round(height * .7));
    (this.background.material as THREE.ShaderMaterial).uniforms.texel.value.set(1 / this.target.width, 1 / this.target.height);
    this.elapsed = -100;
  }

  localMist(pos: THREE.Vector3) {
    let mist = 0;
    for (const bank of CLOUD_BANKS) {
      const d = Math.hypot((pos.x - bank.center[0]) / bank.radius[0], (pos.y - bank.center[1]) / bank.radius[1], (pos.z - bank.center[2]) / bank.radius[2]);
      mist = Math.max(mist, THREE.MathUtils.clamp((1.0 - d) * 2.6, 0, 1));
    }
    return mist;
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, time: number) {
    this.frames++;
    const moving = this.origin.distanceToSquared(camera.position) > .001 || this.orientation.angleTo(camera.quaternion) > .0003;
    if (!moving && time - this.elapsed < 1 / 24 && time >= this.elapsed) return;
    this.elapsed = time;
    camera.updateMatrixWorld();
    this.material.uniforms.cameraWorld.value.copy(camera.matrixWorld);
    this.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.material.uniforms.eye.value.copy(camera.position);
    this.material.uniforms.time.value = time;
    this.origin.copy(camera.position); this.orientation.copy(camera.quaternion);
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(this.passScene, this.passCamera);
    renderer.setRenderTarget(previous);
  }
}
