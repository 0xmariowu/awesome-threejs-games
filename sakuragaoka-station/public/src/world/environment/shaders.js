// environment/shaders.js — the two special-effect materials of the environment module:
//  * distantMaterial: painted, cel-stepped forest hills with per-layer aerial perspective + valley mist
//  * waterMaterial:   toon river / flooded-paddy water (bands, sky reflection, flowing ripple lines,
//                     sun glints, bank foam, weir/stepping-stone foam). Both include scene fog.
// And swayFoliage: ctx.mat.foliage patched with wind sway + per-instance atlas cells.

const NOISE = /* glsl */`
float e_h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float e_vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(e_h21(i),e_h21(i+vec2(1,0)),f.x), mix(e_h21(i+vec2(0,1)),e_h21(i+vec2(1,1)),f.x), f.y); }
`;

/** Painted distant forest / hill material (procedural, no tiling texture -> no repeating dots).
 *  3-step cel light with a lavender shadow tint; jittered-cell "tree crowns" (domes lit from the sun,
 *  darker gaps) that fade out with screen footprint; low-frequency forest-type patches (cedar
 *  plantations, fresh broadleaf, scattered 山桜 crowns); distance haze + valley mist + scaled fog.
 *  o.arc: crowns in (arc length, height) space (uv attribute + aTan attribute) for the ridge rings. */
export function distantMaterial(ctx, o = {}) {
  const THREE = ctx.THREE;
  const C = (c) => new THREE.Color(c);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uLitK: { value: o.litK ?? 1.0 }, uMidK: { value: o.midK ?? 0.87 }, uShadeK: { value: o.shadeK ?? 0.74 },
    uShadeTint: { value: C(o.shadeTint || '#b4b8e2') },
    uHaze: { value: C(o.haze || '#c9d7ea') }, uHazeMin: { value: o.hazeMin ?? 0.0 }, uHazeMax: { value: o.hazeMax ?? 0.92 }, uHazeK: { value: o.hazeK ?? 0.0012 },
    uMist: { value: C(o.mist || '#e2eaf3') }, uMistY0: { value: o.mistY0 ?? 0 }, uMistY1: { value: o.mistY1 ?? 30 }, uMistAmt: { value: o.mistAmt ?? 0.5 },
    uPink: { value: C(o.pink || '#efc3d2') }, uPinkAmt: { value: o.pinkAmt ?? 0.0 },
    uYoung: { value: C(o.young || '#b4cf86') }, uYoungAmt: { value: o.youngAmt ?? 0.0 },
    uDark: { value: C(o.dark || '#5d7b66') }, uDarkAmt: { value: o.darkAmt ?? 0.0 },
    uCrown: { value: o.crown ?? 9.0 }, uCrownAmt: { value: o.crownAmt ?? 0.0 }, uPatch: { value: 1 / (o.patch ?? 70) }, uWrap: { value: o.wrap ?? 1e6 },
    uFogMul: { value: o.fogMul ?? 0.35 },
    uRim: { value: o.rim ?? 0.0 },
  }]);
  uniforms.uSunDir = ctx.shared.uSunDir;
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexColors: !!o.vertexColors,
    fog: true,
    defines: o.arc ? { USE_ARC: 1 } : {},
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vW; varying vec3 vN; varying vec3 vCol;
      #ifdef USE_ARC
        attribute vec3 aTan; varying vec2 vArc; varying vec3 vTan;
      #endif
      void main(){
        vec4 wp = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp; n = mat3(instanceMatrix) * n;
        #endif
        wp = modelMatrix * wp;
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * n);
        vCol = vec3(1.0);
        #ifdef USE_COLOR
          vCol *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vCol *= instanceColor;
        #endif
        #ifdef USE_ARC
          vArc = uv; vTan = aTan;
        #endif
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uSunDir, uShadeTint, uHaze, uMist, uPink, uYoung, uDark;
      uniform float uLitK, uMidK, uShadeK, uHazeMin, uHazeMax, uHazeK, uMistY0, uMistY1, uMistAmt;
      uniform float uPinkAmt, uYoungAmt, uDarkAmt, uCrown, uCrownAmt, uPatch, uFogMul, uRim, uWrap;
      varying vec3 vW; varying vec3 vN; varying vec3 vCol;
      #ifdef USE_ARC
        varying vec2 vArc; varying vec3 vTan;
      #endif
      float d_h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      vec2 d_h22(vec2 p){ float a = d_h21(p); return vec2(a, d_h21(p + a * 17.17 + 3.1)); }
      float d_vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(d_h21(i), d_h21(i + vec2(1, 0)), f.x), mix(d_h21(i + vec2(0, 1)), d_h21(i + vec2(1, 1)), f.x), f.y); }
      // overlapping round crowns (lower / nearer crowns drawn in front). xy = offset from the winning
      // crown centre in crown radii, z = dome height (0 = gap between crowns), w = crown id hash
      vec4 d_crowns(vec2 p){
        vec2 i = floor(p), f = fract(p); float best = -9.0; vec4 res = vec4(0.0, 0.0, 0.0, 0.5);
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y)); vec2 ci = i + g;
          #ifdef USE_ARC
            ci.x = mod(ci.x, uWrap);
          #endif
          vec2 h = d_h22(ci);
          vec2 c = g + 0.18 + 0.64 * h;
          float rad = 0.6 + 0.26 * fract(h.x * 7.13 + h.y);
          vec2 o = (f - c) / rad; float r2 = dot(o, o);
          if (r2 < 1.0) {
            float hd = sqrt(1.0 - r2);
            #ifdef USE_ARC
              float front = -c.y;
            #else
              float front = c.y;
            #endif
            float score = front * 0.55 + h.x * 0.5 + hd * 0.25;
            if (score > best) { best = score; res = vec4(o, hd, fract(h.x * 0.61 + h.y * 0.39 + 0.13)); }
          }
        }
        return res;
      }
      void main(){
        vec3 N = normalize(vN);
        vec3 S = normalize(uSunDir);
        vec3 base = vCol;
        // ---- forest-type patches (low frequency, irregular)
        vec2 pp = vW.xz * uPatch;
        float pA = d_vn(pp) * 0.7 + d_vn(pp * 2.7 + 5.3) * 0.3;
        float pB = d_vn(pp * 1.6 + 11.7) * 0.65 + d_vn(pp * 4.1 + 2.2) * 0.35;
        base = mix(base, uDark, smoothstep(0.56, 0.7, pA) * uDarkAmt);
        base = mix(base, uYoung, smoothstep(0.58, 0.74, pB) * uYoungAmt);
        // ---- crowns
        vec3 T = vec3(1.0, 0.0, 0.0), B = vec3(0.0, 0.0, 1.0);
        #ifdef USE_ARC
          vec2 q = vArc / uCrown;
          T = normalize(vTan); B = normalize(vec3(0.0, 1.0, 0.0) - N * N.y);
        #else
          vec2 q = vW.xz / uCrown;
        #endif
        float fw = length(fwidth(q));
        float detail = uCrownAmt * (1.0 - smoothstep(0.22, 0.62, fw));
        float dMacro = dot(N, S);
        float d = dMacro;
        float gap = 0.0, idc = 0.5;
        float rimD = 0.0;
        if (detail > 0.001) {
          vec4 c = d_crowns(q);
          float cover = step(0.0001, c.z);
          vec3 cn = normalize(N * (c.z * 1.05 + 0.2) + (T * c.x + B * c.y) * 0.95);
          d = mix(dMacro, mix(dMacro, dot(cn, S), 0.72), detail * cover);
          gap = (1.0 - cover) * detail;
          rimD = smoothstep(0.32, 0.0, c.z) * cover * detail;
          idc = c.w;
          base *= 1.0 + (idc - 0.5) * 0.16 * detail * cover;
          // scattered 山桜 crowns inside pink-prone areas
          float pz = d_vn(pp * 1.3 + 31.0);
          float isPink = step(idc, uPinkAmt * smoothstep(0.6, 0.78, pz)) * cover;
          float pinkVis = detail * detail * (1.0 - smoothstep(320.0, 650.0, length(vW - cameraPosition)));
          base = mix(base, uPink, isPink * pinkVis * 0.85);
        }
        vec3 lightK = d < 0.02 ? uShadeTint * uShadeK : (d < 0.3 ? vec3(uMidK) : vec3(uLitK));
        vec3 col = base * lightK;
        col = mix(col, base * uShadeTint * uShadeK * 0.92, gap * 0.85);
        col *= 1.0 - rimD * 0.08;
        // sunlit rim on west-facing crests
        col += vec3(1.0, 0.93, 0.82) * uRim * smoothstep(0.55, 0.85, dMacro) * 0.1;
        float dist = length(vW - cameraPosition);
        float haze = clamp(uHazeMin + (1.0 - exp(-dist * uHazeK)), 0.0, uHazeMax);
        col = mix(col, uHaze, haze);
        float mist = (1.0 - smoothstep(uMistY0, uMistY1, vW.y)) * uMistAmt;
        col = mix(col, uMist, mist);
        gl_FragColor = vec4(col, 1.0);
        #ifdef USE_FOG
          float fd = vFogDepth * uFogMul;
          float fogF = 1.0 - exp(-fogDensity * fogDensity * fd * fd);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);
        #endif
      }`,
  });
  m.name = 'env-distant';
  return m;
}

/** Toon water. mode 0 = river (flow +X), 1 = still paddy water (uv = plot-local metres, aSize = plot size). */
export function waterMaterial(ctx, o = {}) {
  const THREE = ctx.THREE;
  const C = (c) => new THREE.Color(c);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uDeep: { value: C(o.deep || '#4f8aa3') }, uMid: { value: C(o.mid || '#6fa6b5') }, uShallow: { value: C(o.shallow || '#97c6bf') },
    uFoam: { value: C('#f1f7f5') }, uSkyLow: { value: C('#e3ecf4') }, uSkyHigh: { value: C('#8fbde9') },
    uBank: { value: C(o.bank || '#7f9f76') }, uMud: { value: C(o.mud || '#9fa88f') },
    uZNear: { value: o.zNear ?? -99.95 }, uZFar: { value: o.zFar ?? -117.33 },
    uFlow: { value: o.flow ?? 0.45 }, uWeirX: { value: o.weirX ?? 1e5 }, uStonesX: { value: o.stonesX ?? 1e5 },
    uMode: { value: o.mode ?? 0 },
  }]);
  uniforms.uTime = ctx.shared.uTime; uniforms.uSunDir = ctx.shared.uSunDir; uniforms.uGust = ctx.shared.uGust; uniforms.uWind = ctx.shared.uWind;
  const m = new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute vec2 aSize;
      varying vec3 vW; varying vec2 vUv; varying vec2 vSize;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vUv = uv; vSize = aSize;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime, uFlow, uZNear, uZFar, uWeirX, uStonesX, uMode, uGust;
      uniform vec3 uSunDir, uDeep, uMid, uShallow, uFoam, uSkyLow, uSkyHigh, uBank, uMud;
      uniform vec2 uWind;
      varying vec3 vW; varying vec2 vUv; varying vec2 vSize;
      ${NOISE}
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec3 S = normalize(uSunDir);
        float t = uTime;
        vec3 col;
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        // stylised ripple normal (only tilts the reflection lookup)
        vec2 rq = vec2(vW.x * 0.35 - t * uFlow * 0.35 * (1.0 - uMode), vW.z * 1.3);
        float rn = e_vn(rq) + 0.5 * e_vn(rq * 2.7 + 5.0);
        vec3 N = normalize(vec3((rn - 0.75) * 0.08, 1.0, (e_vn(rq.yx * 1.7) - 0.5) * 0.12));
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyLow, uSkyHigh, smoothstep(0.02, 0.45, R.y));
        float edge;
        if (uMode < 0.5) {
          float wN = uZNear - vW.z, wF = vW.z - uZFar;
          edge = min(wN, wF);
          float wob = (e_vn(vec2(vW.x * 0.21, 3.0)) - 0.5) * 1.1 + (e_vn(vec2(vW.x * 0.8 - t * 0.2, 7.0)) - 0.5) * 0.35;
          float e = edge + wob;
          float b1 = smoothstep(4.7, 4.45, e), b2 = smoothstep(1.75, 1.55, e);
          col = mix(uDeep, uMid, b1); col = mix(col, uShallow, b2);
          // reflection of the green far bank / reeds just inside the far edge
          float refl = smoothstep(2.8, 2.5, wF + wob * 0.6) * smoothstep(0.35, 0.6, wF);
          col = mix(col, uBank, refl * 0.55);
          col = mix(col, sky, 0.14 + 0.5 * fres);
          // flowing ripple lines (iso-lines of a flow-advected noise field)
          vec2 q = vec2(vW.x * 0.16 - t * uFlow * 0.16, vW.z * 0.85);
          float n = e_vn(q + vec2(0.0, e_vn(q * 0.6 + 3.0) * 1.6));
          float lineA = smoothstep(0.03, 0.0, abs(n - 0.5)) * smoothstep(0.3, 1.5, e);
          vec2 q2 = vec2(vW.x * 0.33 - t * uFlow * 0.33, vW.z * 1.9 + 11.0);
          float n2 = e_vn(q2 + vec2(0.0, e_vn(q2 * 0.5) * 1.2));
          float lineB = smoothstep(0.022, 0.0, abs(n2 - 0.5)) * 0.7;
          col = mix(col, mix(sky, vec3(1.0), 0.35), clamp(lineA * 0.62 + lineB * 0.35, 0.0, 1.0));
          col = mix(col, uDeep * 0.82, smoothstep(0.02, 0.0, abs(n2 - 0.32)) * 0.28 * b1);
          // bank foam
          float fn = e_vn(vec2(vW.x * 1.3 - t * uFlow * 1.2, vW.z * 2.3 + t * 0.2));
          float foam = smoothstep(0.62, 0.22, edge + (fn - 0.5) * 0.5);
          float foamLine = smoothstep(0.06, 0.0, abs(edge - 0.75 - (fn - 0.5) * 0.35)) * 0.6;
          col = mix(col, uFoam, clamp(foam * 0.8 + foamLine * 0.5, 0.0, 1.0));
          // weir (low sill): white tumbling band + downstream bubbles
          float wx = vW.x - uWeirX;
          float wn = e_vn(vec2(vW.z * 1.4, wx * 1.2 - t * 2.6));
          float weir = smoothstep(-0.25, 0.1, wx) * (1.0 - smoothstep(0.9, 3.4 + wn * 1.2, wx));
          float bub = smoothstep(0.55, 0.8, e_vn(vec2(wx * 2.0 - t * 2.0, vW.z * 3.0))) * (1.0 - smoothstep(2.0, 9.0, wx)) * step(0.0, wx);
          col = mix(col, uFoam, clamp(weir * (0.65 + 0.35 * wn) + bub * 0.5, 0.0, 1.0));
          // stepping-stone wakes
          float sx = vW.x - uStonesX;
          float wake = smoothstep(0.9, 0.35, abs(sx - 0.2)) * (0.55 + 0.45 * e_vn(vec2(vW.z * 2.2, sx * 3.0 - t * 2.0)));
          float wake2 = step(0.0, sx) * (1.0 - smoothstep(0.5, 4.0, sx)) * smoothstep(0.6, 0.85, e_vn(vec2(sx * 1.5 - t * 1.6, vW.z * 1.9)));
          col = mix(col, uFoam, clamp(wake * 0.7 + wake2 * 0.45, 0.0, 1.0));
        } else {
          // still paddy water: mirror of the sky, dark reflection of the ridge along the far (north) edge
          float ed = min(min(vUv.x, vSize.x - vUv.x), min(vUv.y, vSize.y - vUv.y));
          vec3 skyP = mix(uSkyHigh, sky, 0.45);
          col = mix(uMud, skyP, 0.4 + 0.5 * fres);
          float north = smoothstep(1.2, 0.2, vSize.y - vUv.y);
          col = mix(col, uBank, north * 0.5 + smoothstep(0.5, 0.05, ed) * 0.3);
          float wr = e_vn(vec2(vW.x * 0.6 - t * 0.3 * uWind.x, vW.z * 2.5));
          col = mix(col, vec3(1.0), smoothstep(0.025, 0.0, abs(wr - 0.5)) * 0.25 * uGust);
          edge = ed;
        }
        // sun glints: brighter when looking toward the sun's azimuth, sparkling dashes
        vec2 vd = normalize(-V.xz + 1e-5), sd = normalize(S.xz);
        float toward = pow(max(dot(vd, sd), 0.0), 2.0) * 0.9 + 0.1;
        float sp = e_vn(vec2(vW.x * 1.7 - t * 0.9, vW.z * 6.0 + t * 0.35)) * e_vn(vec2(vW.x * 3.1 + t * 0.6, vW.z * 9.0));
        float glint = smoothstep(0.62, 0.72, sp) * toward * smoothstep(0.2, 1.2, edge) * (0.5 + 0.5 * fres);
        col += vec3(1.0, 0.93, 0.8) * glint * 1.35;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  m.name = 'env-water';
  return m;
}

/** Alpha-card foliage with wind sway and a per-instance atlas cell (instanced attribute aCell = [u0, v0, sway]). */
export function swayFoliage(ctx, map, cellScale, name, o = {}) {
  const THREE = ctx.THREE;
  const m = ctx.mat.foliage('#ffffff', map, { name: 'env-sway-' + name, paint: o.paint ?? 0.03, alphaTest: o.alphaTest ?? 0.5 });
  if (m.userData.envSway) return m;
  m.userData.envSway = true;
  const prev = m.onBeforeCompile;
  const uCell = { value: new THREE.Vector2(cellScale[0], cellScale[1]) };
  const uAmp = { value: o.amp ?? 1.0 };
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.uTime = ctx.shared.uTime; shader.uniforms.uWind = ctx.shared.uWind; shader.uniforms.uGust = ctx.shared.uGust;
    shader.uniforms.uCell = uCell; shader.uniforms.uSwayAmp = uAmp;
    // cards light like the ground they stand on: no normal flip on back faces (no dark backsides)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', 'normal = normalize( vNormal );\n#include <normal_fragment_maps>');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec2 uWind; uniform float uGust; uniform vec2 uCell; uniform float uSwayAmp;\nattribute vec3 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * uCell + aCell.xy;\n#endif')
      .replace('#include <project_vertex>', `
        vec4 swp = vec4(transformed, 1.0);
        float ih = 1.0; vec3 ib = vec3(0.0);
        #ifdef USE_INSTANCING
          swp = instanceMatrix * swp; ih = length(instanceMatrix[1].xyz); ib = instanceMatrix[3].xyz;
        #endif
        swp = modelMatrix * swp;
        vec3 wb = (modelMatrix * vec4(ib, 1.0)).xyz;
        float wgt = clamp(position.y, 0.0, 1.0); wgt *= wgt;
        float ph = wb.x * 0.23 + wb.z * 0.31;
        float wave = sin(uTime * 1.7 - wb.x * 0.21 + ph) * 0.55 + sin(uTime * 3.1 + ph * 2.7) * 0.25 + sin(uTime * 0.6 + wb.z * 0.05) * 0.2;
        float gust = 0.35 + 0.65 * uGust;
        float k = aCell.z * uSwayAmp * ih * wgt;
        vec2 disp = uWind * (0.45 + 0.55 * wave) * gust * k * 0.22;
        disp += vec2(-uWind.y, uWind.x) * sin(uTime * 4.3 + ph * 3.1) * 0.05 * k;
        swp.xz += disp;
        swp.y -= dot(disp, disp) * 0.45 / max(ih, 0.15);
        vec4 mvPosition = viewMatrix * swp;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'paint|envsway2';
  m.needsUpdate = true;
  return m;
}
