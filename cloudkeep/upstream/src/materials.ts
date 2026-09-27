import * as THREE from 'three';

/** Keep surface detail in object space so it follows the authored meshes. */
export class ArtMaterials {
  readonly time = { value: 0 };
  private readonly stoneNoise = this.makeStoneNoise();

  private makeStoneNoise() {
    const size = 256, data = new Uint8Array(size * size);
    const hash = (x: number, y: number, period: number) => {
      const seed = Math.imul((x % period + period) % period, 374761393) ^ Math.imul((y % period + period) % period, 668265263);
      return ((Math.imul(seed ^ seed >>> 13, 1274126177) >>> 0) / 4294967295);
    };
    const noise = (x: number, y: number, cells: number) => {
      x *= cells; y *= cells;
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy, cells), hash(ix + 1, iy, cells), sx), THREE.MathUtils.lerp(hash(ix, iy + 1, cells), hash(ix + 1, iy + 1, cells), sx), sy);
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      data[y * size + x] = Math.round(255 * (noise(x / size, y / size, 8) * .53 + noise(x / size, y / size, 19) * .29 + noise(x / size, y / size, 47) * .18));
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    return texture;
  }

  apply(mesh: THREE.Mesh) {
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const flex = mesh.name.includes('wing_') ? (mesh.name.startsWith('ray') ? 1 : /^(whale|koi)/.test(mesh.name) ? 2 : 3) : 0;
    const bend = `uniform float artTime;
      float wingBend(float x) {
        float span=clamp(abs(x)/${flex === 1 ? '3.2' : '1.7'},0.0,1.0);
        return sin(artTime*${flex === 3 ? '7.5' : '2.0'}-abs(x)*1.6)*span*span*${flex === 1 ? '.52' : '.17'};
      }`;
    const materials = originals.map(original => {
      if (!(original instanceof THREE.MeshStandardMaterial)) return original;
      const skin = /skin|silken/i.test(original.name);
      const fabric = /canvas/i.test(original.name);
      const m = skin || fabric ? new THREE.MeshPhysicalMaterial({
        color: original.color.clone(), vertexColors: original.vertexColors,
        roughness: skin ? .46 : .76, metalness: original.metalness,
        sheen: fabric ? .32 : .16, sheenColor: new THREE.Color('#fff0d3'), sheenRoughness: .72,
        clearcoat: skin ? .12 : 0, clearcoatRoughness: .48,
      }) : original.clone();
      m.name = original.name;
      if (/opal/i.test(m.name)) { m.emissive.set('#b1e8c8'); m.emissiveIntensity = .13; m.roughness = .3; }
      const kind = /canvas/i.test(m.name) ? 1 : /cedar/i.test(m.name) ? 2 : /limestone/i.test(m.name) ? 3 : 0;
      if (kind === 3) m.roughness = .92;
      m.side = THREE.DoubleSide;
      // Closed surfaces cast their back faces to avoid self-shadow stippling.
      m.shadowSide = THREE.BackSide;
      m.envMapIntensity = /brass|glass|ink/i.test(m.name) ? 1.15 : .30;
      m.onBeforeCompile = shader => {
        shader.uniforms.artTime = this.time;
        shader.uniforms.artStoneNoise = { value: this.stoneNoise };
        shader.vertexShader = `${bend}\nvarying vec3 artPosition; varying vec3 artWorld;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          artPosition = position;
          ${flex ? 'transformed.y += wingBend(position.x);' : ''}
          artWorld = (modelMatrix * vec4(transformed,1.0)).xyz;`);
        if (flex) shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          float slope = (wingBend(position.x + .01) - wingBend(position.x - .01)) * 50.0;
          objectNormal.x -= slope * objectNormal.y;
          objectNormal = normalize(objectNormal);`);
        shader.fragmentShader = `varying vec3 artPosition; varying vec3 artWorld;
          uniform sampler2D artStoneNoise;
          float stoneGrain(vec3 p) {
            return texture2D(artStoneNoise,p.xy*.071).r*.43 + texture2D(artStoneNoise,p.yz*.063+vec2(.31,.57)).r*.34 + texture2D(artStoneNoise,p.xz*.081+vec2(.63,.22)).r*.23;
          }
          ${shader.fragmentShader}`;
        const surface = kind === 1
          ? 'float weaveFade = 1.0-smoothstep(.3,1.5,length(fwidth(artPosition.xz))*180.0); float grain = sin(artPosition.x * 180.0) * sin(artPosition.z * 180.0)*weaveFade; diffuseColor.rgb *= .98 + .025 * grain;'
          : kind === 2
            ? 'float grain = sin(artPosition.y * 85.0 + sin(artPosition.z * 2.5) * 2.0 + sin(artPosition.x * 13.0)); diffuseColor.rgb *= .95 + .055 * grain;'
            : kind === 3
              ? 'float grain = stoneGrain(artPosition); diffuseColor.rgb *= mix(vec3(.91,.92,.90),vec3(1.06,1.035,.98),grain);'
              : '';
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${surface}`);
        // Limestone keeps the modeled planes entirely smooth; variation is color only.
        if (kind === 1 || kind === 2) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          float relief=${kind === 2 ? '.0012*sin(artPosition.y*85.0+sin(artPosition.z*2.5)*2.0+sin(artPosition.x*13.0))' : '.0004*sin(artPosition.x*180.0)*sin(artPosition.z*180.0)*weaveFade'};
          vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
          vec3 r1=cross(dy,normal),r2=cross(normal,dx);
          float determinant=dot(dx,r1);
          normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(relief)*r1+dFdy(relief)*r2));`);
        if (skin) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          vec3 warmDirection=normalize((viewMatrix*vec4(.65,.52,-.17,0.0)).xyz);
          float thinGlow=pow(clamp(dot(-normal,warmDirection)+.15,0.0,1.0),2.0);
          reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.45,.21,.09)*thinGlow*${flex ? '.55' : '.18'};`);
        if (kind === 3) shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>
          float lowMist = (1.0-smoothstep(-24.0,-5.0,artWorld.y))*.82;
          gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.38,.54,.64),lowMist);`);
      };
      m.customProgramCacheKey = () => `cloudkeep-art-stone-v2-${kind}-${flex}-${skin}`;
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.castShadow = !/petal/i.test(materials[0].name);
    mesh.receiveShadow = true;
    if (flex) {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      depth.onBeforeCompile = shader => {
        shader.uniforms.artTime = this.time;
        shader.vertexShader = `${bend}\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += wingBend(position.x);');
      };
      depth.customProgramCacheKey = () => `cloudkeep-fin-depth-${flex}`;
      mesh.customDepthMaterial = depth;
    }
  }
}
