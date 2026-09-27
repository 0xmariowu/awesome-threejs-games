const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./reference-NztVQ6cf.js","./three.core-DtjtRha-.js","./debug-B-iF4Wio.js"])))=>i.map(i=>d[i]);
import{c as e}from"./three.module-e53_FFk2.js";import{$r as t,Dr as n,Ja as r,Lt as i,Qa as a,Rn as o,U as s,Yt as c,_r as l,ar as u,bt as d,do as f,io as p,j as m,no as h,ro as g,ta as _,tr as v}from"./three.core-DtjtRha-.js";import{t as ee}from"./index-DGqtqlWq.js";var y=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},te=new n(-1,1,1,-1,0,1),b=new class extends m{constructor(){super(),this.setAttribute(`position`,new i([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new i([0,2,0,0,2,0],2))}},ne=class{constructor(e){this._mesh=new u(b,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,te)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},re={name:`FXAAShader`,uniforms:{tDiffuse:{value:null},resolution:{value:new h(1/1024,1/512)}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		varying vec2 vUv;

		#define EDGE_STEP_COUNT 6
		#define EDGE_GUESS 8.0
		#define EDGE_STEPS 1.0, 1.5, 2.0, 2.0, 2.0, 4.0
		const float edgeSteps[EDGE_STEP_COUNT] = float[EDGE_STEP_COUNT]( EDGE_STEPS );

		float _ContrastThreshold = 0.0312;
		float _RelativeThreshold = 0.063;
		float _SubpixelBlending = 1.0;

		vec4 Sample( sampler2D  tex2D, vec2 uv ) {

			return texture( tex2D, uv );

		}

		float SampleLuminance( sampler2D tex2D, vec2 uv ) {

			return dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) );

		}

		float SampleLuminance( sampler2D tex2D, vec2 texSize, vec2 uv, float uOffset, float vOffset ) {

			uv += texSize * vec2(uOffset, vOffset);
			return SampleLuminance(tex2D, uv);

		}

		struct LuminanceData {

			float m, n, e, s, w;
			float ne, nw, se, sw;
			float highest, lowest, contrast;

		};

		LuminanceData SampleLuminanceNeighborhood( sampler2D tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData l;
			l.m = SampleLuminance( tex2D, uv );
			l.n = SampleLuminance( tex2D, texSize, uv,  0.0,  1.0 );
			l.e = SampleLuminance( tex2D, texSize, uv,  1.0,  0.0 );
			l.s = SampleLuminance( tex2D, texSize, uv,  0.0, -1.0 );
			l.w = SampleLuminance( tex2D, texSize, uv, -1.0,  0.0 );

			l.ne = SampleLuminance( tex2D, texSize, uv,  1.0,  1.0 );
			l.nw = SampleLuminance( tex2D, texSize, uv, -1.0,  1.0 );
			l.se = SampleLuminance( tex2D, texSize, uv,  1.0, -1.0 );
			l.sw = SampleLuminance( tex2D, texSize, uv, -1.0, -1.0 );

			l.highest = max( max( max( max( l.n, l.e ), l.s ), l.w ), l.m );
			l.lowest = min( min( min( min( l.n, l.e ), l.s ), l.w ), l.m );
			l.contrast = l.highest - l.lowest;
			return l;

		}

		bool ShouldSkipPixel( LuminanceData l ) {

			float threshold = max( _ContrastThreshold, _RelativeThreshold * l.highest );
			return l.contrast < threshold;

		}

		float DeterminePixelBlendFactor( LuminanceData l ) {

			float f = 2.0 * ( l.n + l.e + l.s + l.w );
			f += l.ne + l.nw + l.se + l.sw;
			f *= 1.0 / 12.0;
			f = abs( f - l.m );
			f = clamp( f / l.contrast, 0.0, 1.0 );

			float blendFactor = smoothstep( 0.0, 1.0, f );
			return blendFactor * blendFactor * _SubpixelBlending;

		}

		struct EdgeData {

			bool isHorizontal;
			float pixelStep;
			float oppositeLuminance, gradient;

		};

		EdgeData DetermineEdge( vec2 texSize, LuminanceData l ) {

			EdgeData e;
			float horizontal =
				abs( l.n + l.s - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.se - 2.0 * l.e ) +
				abs( l.nw + l.sw - 2.0 * l.w );
			float vertical =
				abs( l.e + l.w - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.nw - 2.0 * l.n ) +
				abs( l.se + l.sw - 2.0 * l.s );
			e.isHorizontal = horizontal >= vertical;

			float pLuminance = e.isHorizontal ? l.n : l.e;
			float nLuminance = e.isHorizontal ? l.s : l.w;
			float pGradient = abs( pLuminance - l.m );
			float nGradient = abs( nLuminance - l.m );

			e.pixelStep = e.isHorizontal ? texSize.y : texSize.x;

			if (pGradient < nGradient) {

				e.pixelStep = -e.pixelStep;
				e.oppositeLuminance = nLuminance;
				e.gradient = nGradient;

			} else {

				e.oppositeLuminance = pLuminance;
				e.gradient = pGradient;

			}

			return e;

		}

		float DetermineEdgeBlendFactor( sampler2D  tex2D, vec2 texSize, LuminanceData l, EdgeData e, vec2 uv ) {

			vec2 uvEdge = uv;
			vec2 edgeStep;
			if (e.isHorizontal) {

				uvEdge.y += e.pixelStep * 0.5;
				edgeStep = vec2( texSize.x, 0.0 );

			} else {

				uvEdge.x += e.pixelStep * 0.5;
				edgeStep = vec2( 0.0, texSize.y );

			}

			float edgeLuminance = ( l.m + e.oppositeLuminance ) * 0.5;
			float gradientThreshold = e.gradient * 0.25;

			vec2 puv = uvEdge + edgeStep * edgeSteps[0];
			float pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
			bool pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !pAtEnd; i++ ) {

				puv += edgeStep * edgeSteps[i];
				pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
				pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			}

			if ( !pAtEnd ) {

				puv += edgeStep * EDGE_GUESS;

			}

			vec2 nuv = uvEdge - edgeStep * edgeSteps[0];
			float nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
			bool nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !nAtEnd; i++ ) {

				nuv -= edgeStep * edgeSteps[i];
				nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
				nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			}

			if ( !nAtEnd ) {

				nuv -= edgeStep * EDGE_GUESS;

			}

			float pDistance, nDistance;
			if ( e.isHorizontal ) {

				pDistance = puv.x - uv.x;
				nDistance = uv.x - nuv.x;

			} else {

				pDistance = puv.y - uv.y;
				nDistance = uv.y - nuv.y;

			}

			float shortestDistance;
			bool deltaSign;
			if ( pDistance <= nDistance ) {

				shortestDistance = pDistance;
				deltaSign = pLuminanceDelta >= 0.0;

			} else {

				shortestDistance = nDistance;
				deltaSign = nLuminanceDelta >= 0.0;

			}

			if ( deltaSign == ( l.m - edgeLuminance >= 0.0 ) ) {

				return 0.0;

			}

			return 0.5 - shortestDistance / ( pDistance + nDistance );

		}

		vec4 ApplyFXAA( sampler2D  tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData luminance = SampleLuminanceNeighborhood( tex2D, texSize, uv );
			if ( ShouldSkipPixel( luminance ) ) {

				return Sample( tex2D, uv );

			}

			float pixelBlend = DeterminePixelBlendFactor( luminance );
			EdgeData edge = DetermineEdge( texSize, luminance );
			float edgeBlend = DetermineEdgeBlendFactor( tex2D, texSize, luminance, edge, uv );
			float finalBlend = max( pixelBlend, edgeBlend );

			if (edge.isHorizontal) {

				uv.y += edge.pixelStep * finalBlend;

			} else {

				uv.x += edge.pixelStep * finalBlend;

			}

			return Sample( tex2D, uv );

		}

		void main() {

			gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );

		}`},x=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,S=`
vec3 sane(vec3 c) {
  c = mix(c, vec3(0.0), isnan(c));
  return clamp(c, vec3(0.0), vec3(6.0e4));
}`,C=`
uniform vec2 uNearFar;   // camera near, far
uniform vec4 uProj;      // projection elements [0], [5], [8], [9]
// perspective depth (0..1) -> positive view distance along the camera axis
float linearZ(float d) { return uNearFar.x * uNearFar.y / (uNearFar.y - d * (uNearFar.y - uNearFar.x)); }
vec3 viewPos(vec2 uv, float z) {
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(z * (ndc.x + uProj.z) / uProj.x, z * (ndc.y + uProj.w) / uProj.y, -z);
}
vec3 viewRay(vec2 uv) {
  vec2 ndc = uv * 2.0 - 1.0;
  return normalize(vec3((ndc.x + uProj.z) / uProj.x, (ndc.y + uProj.w) / uProj.y, -1.0));
}
// interleaved gradient noise (Jimenez 2014): well distributed per-pixel rotation / jitter
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
${S}
// the sky dome sits on the far plane (and is cleared to 1.0); nothing solid is that far away
#define SKY_DEPTH 0.999995
`,ie=`
${C}
uniform sampler2D tDepth;
uniform vec2 uFullSize;   // depth texture size (px)
uniform vec2 uSize;       // AO target size (px)
uniform vec4 uAO;         // x: radius per metre of distance, y: min radius (m), z: max radius (m), w: max radius (AO px)
uniform vec3 uAOFade;     // x: fade start (m), y: fade end (m), z: intensity
varying vec2 vUv;
#ifndef AO_SAMPLES
#define AO_SAMPLES 12
#endif

vec3 posAtPx(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uFullSize) - 1);
  vec2 uv = (vec2(p) + 0.5) / uFullSize;
  return viewPos(uv, linearZ(texelFetch(tDepth, p, 0).x));
}

void main() {
  ivec2 fp = ivec2(vUv * uFullSize);
  float d = texelFetch(tDepth, fp, 0).x;
  float z = linearZ(d);
  float fade = 1.0 - smoothstep(uAOFade.x, uAOFade.y, z);
  if (d >= SKY_DEPTH || fade <= 0.0) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }

  vec3 P = posAtPx(fp);
  // normal from the flatter side in x and y (avoids smearing across silhouettes)
  vec3 pr = posAtPx(fp + ivec2(1, 0)), pl = posAtPx(fp - ivec2(1, 0));
  vec3 pu = posAtPx(fp + ivec2(0, 1)), pd = posAtPx(fp - ivec2(0, 1));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));

  // world radius -> screen radius (AO px), capped; the cap shrinks the world radius with it
  float pxPerM = uProj.y / z * 0.5 * uSize.y;
  float R = clamp(z * uAO.x, uAO.y, uAO.z);
  float rPx = min(R * pxPerM, uAO.w);
  R = rPx / pxPerM;
  if (rPx < 1.0) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }

  float n1 = ign(gl_FragCoord.xy);
  float n2 = ign(gl_FragCoord.yx * 1.37 + 11.0);
  float a0 = n1 * 6.2831853;
  float invR2 = 1.0 / (R * R);
  float sum = 0.0;
  // push the origin a hair along the normal: kills self-occlusion from depth quantisation far out
  P += N * (0.002 * z);
  for (int i = 0; i < AO_SAMPLES; i++) {
    float fi = float(i);
    float r = (fi + n2) / float(AO_SAMPLES);
    float a = a0 + fi * 2.3999632;
    vec2 off = vec2(cos(a), sin(a)) * (r * rPx);
    vec2 suv = vUv + off / uSize;
    // samples off screen say nothing (clamping them to the edge fakes a wall)
    if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) continue;
    ivec2 sp = ivec2(suv * uFullSize);
    vec3 S = posAtPx(sp);
    vec3 v = S - P;
    float vv = dot(v, v);
    float cosT = dot(v, N) * inversesqrt(vv + 1e-6);
    float fall = max(0.0, 1.0 - vv * invR2);
    sum += max(cosT - 0.1, 0.0) * fall;
  }
  float ao = 1.0 - uAOFade.z * sum / float(AO_SAMPLES);
  ao = mix(1.0, clamp(ao, 0.0, 1.0), fade);
  gl_FragColor = vec4(ao, z, 0.0, 1.0);
}`,ae=`
uniform sampler2D tAO;
uniform vec2 uDir;        // one texel along the blur axis (uv)
varying vec2 vUv;
void main() {
  vec4 c = texture(tAO, vUv);
  float z = c.y;
  float tol = 1.0 / (0.03 * z + 0.25);
  float s = c.x, w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float fi = float(i);
    float g = exp(-fi * fi / 10.0);
    vec4 a = texture(tAO, vUv + uDir * fi);
    vec4 b = texture(tAO, vUv - uDir * fi);
    float wa = g * max(0.0, 1.0 - abs(a.y - z) * tol);
    float wb = g * max(0.0, 1.0 - abs(b.y - z) * tol);
    s += a.x * wa + b.x * wb;
    w += wa + wb;
  }
  gl_FragColor = vec4(s / w, z, 0.0, 1.0);
}`,oe=`
${C}
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec2 uFullSize;
uniform vec3 uSunView;    // sun direction in view space
uniform vec4 uMask;       // x: cone width (1 - cos), y: sky brightness gate lo, z: gate hi, w: halo weight
varying vec2 vUv;
void main() {
  ivec2 p = ivec2(vUv * uFullSize - 0.5);
  ivec2 mx = ivec2(uFullSize) - 1;
  float sky = step(SKY_DEPTH, texelFetch(tDepth, clamp(p, ivec2(0), mx), 0).x)
            + step(SKY_DEPTH, texelFetch(tDepth, clamp(p + ivec2(1, 0), ivec2(0), mx), 0).x)
            + step(SKY_DEPTH, texelFetch(tDepth, clamp(p + ivec2(0, 1), ivec2(0), mx), 0).x)
            + step(SKY_DEPTH, texelFetch(tDepth, clamp(p + ivec2(1, 1), ivec2(0), mx), 0).x);
  if (sky == 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // forward-scattering lobe around the sun (gaussian in angle, plus a wider faint halo)
  float k = 1.0 - dot(viewRay(vUv), uSunView);
  float cone = exp(-k / uMask.x) + uMask.w * exp(-k / (uMask.x * 6.0));
  // clear sky passes light, dark cloud bodies (and Loom threads over the sky) block it
  float open = smoothstep(uMask.y, uMask.z, luma(sane(texture(tScene, vUv).rgb)));
  gl_FragColor = vec4(vec3(cone * open * sky * 0.25), 1.0);
}`,se=`
uniform sampler2D tIn;
uniform vec2 uSunUv;
uniform vec3 uRay;        // x: log step per tap, y: decay per log unit, z: jitter seed
varying vec2 vUv;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
#ifndef RAY_TAPS
#define RAY_TAPS 16
#endif
void main() {
  vec2 d = vUv - uSunUv;
  float j = ign(gl_FragCoord.xy + uRay.z);
  vec3 sum = vec3(0.0);
  float ws = 0.0;
  for (int i = 0; i < RAY_TAPS; i++) {
    float t = (float(i) + j) * uRay.x;
    vec2 uv = uSunUv + d * exp(-t);
    float w = exp(-uRay.y * t);
    vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    sum += texture(tIn, uv).rgb * (w * inb.x * inb.y);
    ws += w;
  }
  gl_FragColor = vec4(sum / ws, 1.0);
}`,w=`
${S}
uniform sampler2D tIn;
uniform vec2 uTexel;      // input texel size
uniform vec4 uThreshold;  // x: threshold, y: knee, z: clamp, w: exposure
varying vec2 vUv;
#ifdef PREFILTER
vec3 tap(float x, float y) { return sane(texture(tIn, vUv + vec2(x, y) * uTexel).rgb); }
#else
vec3 tap(float x, float y) { return texture(tIn, vUv + vec2(x, y) * uTexel).rgb; }
#endif
void main() {
  vec3 a = tap(-2.0, 2.0), b = tap(0.0, 2.0), c = tap(2.0, 2.0);
  vec3 d = tap(-2.0, 0.0), e = tap(0.0, 0.0), f = tap(2.0, 0.0);
  vec3 g = tap(-2.0, -2.0), h = tap(0.0, -2.0), i = tap(2.0, -2.0);
  vec3 j = tap(-1.0, 1.0), k = tap(1.0, 1.0), l = tap(-1.0, -1.0), m = tap(1.0, -1.0);
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
#ifdef PREFILTER
  col *= uThreshold.w;
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThreshold.x + uThreshold.y, 0.0, 2.0 * uThreshold.y);
  soft = soft * soft / (4.0 * uThreshold.y + 1e-4);
  float contrib = max(soft, br - uThreshold.x) / max(br, 1e-4);
  col *= contrib;
  col *= min(1.0, uThreshold.z / max(br * contrib, 1e-4));
#endif
  gl_FragColor = vec4(col, 1.0);
}`,T=`
uniform sampler2D tIn;
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
vec3 tap(float x, float y) { return texture(tIn, vUv + vec2(x, y) * uTexel).rgb; }
void main() {
  vec3 col = (tap(-1.0, 1.0) + tap(1.0, 1.0) + tap(-1.0, -1.0) + tap(1.0, -1.0)) * 0.0625
           + (tap(0.0, 1.0) + tap(-1.0, 0.0) + tap(1.0, 0.0) + tap(0.0, -1.0)) * 0.125
           + tap(0.0, 0.0) * 0.25;
  gl_FragColor = vec4(col * uWeight, 1.0);
}`,ce=`
${C}
uniform sampler2D tDepth;
uniform sampler2D tPrev;
uniform vec2 uFocus;      // x: manual focus distance (<= 0: auto), y: blend toward target
varying vec2 vUv;
void main() {
  float z;
  if (uFocus.x > 0.0) z = uFocus.x;
  else {
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
      vec2 o = i == 0 ? vec2(0.0) : vec2(i == 1 ? 0.03 : i == 2 ? -0.03 : 0.0, i == 3 ? 0.04 : i == 4 ? -0.04 : 0.0);
      s += log(linearZ(texture(tDepth, vec2(0.5) + o).x));
    }
    z = exp(s / 5.0);
  }
  float prev = texture(tPrev, vec2(0.5)).x;
  float f = prev > 0.0 ? exp(mix(log(prev), log(z), uFocus.y)) : z;
  gl_FragColor = vec4(f, 0.0, 0.0, 1.0);
}`,le=`
${C}
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tFocus;
uniform vec2 uTexel;      // half-res texel
uniform vec2 uDof;        // x: CoC at infinity (half-res px), y: max CoC (half-res px)
varying vec2 vUv;
float cocOf(float z, float focus) { return min(uDof.x * abs(1.0 - focus / z), uDof.y); }
void main() {
  float focus = texture(tFocus, vec2(0.5)).x;
  float cz = linearZ(texture(tDepth, vUv).x);
  float cs = cocOf(cz, focus);
  vec3 col = sane(texture(tScene, vUv).rgb);
  float tot = 1.0;
  float fg = 0.0;
  float radius = 0.9;
  // per-pixel start angle: breaks the spiral's pattern up into fine noise
  float ang = ign(gl_FragCoord.xy) * 6.2831853;
  for (int i = 0; i < 200; i++) {
    if (radius >= uDof.y) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
    vec3 sc = sane(texture(tScene, tc).rgb);
    float sz = linearZ(texture(tDepth, tc).x);
    float ss = cocOf(sz, focus);
    if (sz > cz) ss = min(ss, cs * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    col += mix(col / tot, sc, m);
    tot += 1.0;
    if (sz < cz) fg = max(fg, m * ss);
    radius += 0.9 / radius;
    ang += 2.3999632;
  }
  gl_FragColor = vec4(col / tot, max(cs, fg));
}`,ue=`
${C}
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform sampler2D tRays;
uniform sampler2D tBloom;
uniform sampler2D tDof;
uniform sampler2D tFocus;
uniform vec2 uFullSize;
uniform vec2 uAOSize;
uniform float uExposure;
uniform vec2 uAOMix;      // x: strength, y: protect bright (sunlit / emissive) pixels
uniform vec3 uRayColor;   // tint * strength
uniform vec4 uRayPhase;   // xyz: sun direction (view space), w: lobe width (1 - cos)
uniform float uBloom;     // strength (already divided by the chain normalisation)
uniform float uCA;        // chromatic aberration at the frame corner (uv units)
uniform vec3 uVignette;   // x: vignette strength, y: vignette exponent, z: contrast pivot
uniform vec3 uShadowTint; // perceptual offsets (luma-neutral)
uniform vec3 uHighTint;
uniform vec4 uGrade;      // x: contrast, y: saturation, z: shadow desaturation (night), w: black lift
uniform vec2 uGrain;      // x: amount, y: frame seed
uniform vec2 uDof;        // x: CoC at infinity (full px), y: max CoC
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
// three.js ACESFilmicToneMapping (same curve the world was lit against)
vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color /= 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 color) {
  const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
    vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
  const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
    vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
  const mat3 AgXInsetMatrix = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 AgXOutsetMatrix = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float AgxMinEv = -12.47393;
  const float AgxMaxEv = 4.026069;
  color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
  color = AgXInsetMatrix * color;
  color = max(color, 1e-10);
  color = log2(color);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  color = clamp(color, 0.0, 1.0);
  color = agxContrast(color);
  color = AgXOutsetMatrix * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

#ifdef USE_AO
// joint-bilateral upsample of the half-res AO: bilinear weights x depth similarity
float aoUpsample(vec2 uv, float z) {
  vec2 hp = uv * uAOSize - 0.5;
  ivec2 i0 = ivec2(floor(hp));
  vec2 f = hp - floor(hp);
  ivec2 mx = ivec2(uAOSize) - 1;
  vec2 a = texelFetch(tAO, clamp(i0, ivec2(0), mx), 0).xy;
  vec2 b = texelFetch(tAO, clamp(i0 + ivec2(1, 0), ivec2(0), mx), 0).xy;
  vec2 c = texelFetch(tAO, clamp(i0 + ivec2(0, 1), ivec2(0), mx), 0).xy;
  vec2 d = texelFetch(tAO, clamp(i0 + ivec2(1, 1), ivec2(0), mx), 0).xy;
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec4 dz = abs(vec4(a.y, b.y, c.y, d.y) - z) / (0.02 * z + 0.2);
  w *= 1.0 / (1.0 + dz * dz) ;
  w += 1e-5;
  return dot(vec4(a.x, b.x, c.x, d.x), w) / (w.x + w.y + w.z + w.w);
}
#endif

void main() {
  vec2 uv = vUv;
  // radius^2 in frame-shaped (oval) coordinates: 0 at the centre, 1 in the corners
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc) * 2.0;
  vec3 col;
#ifdef USE_CA
  // lateral CA: red and blue scaled apart toward the frame edge (0 at centre)
  vec2 off = (uv - 0.5) * (r2 * uCA);
  col = vec3(texture(tScene, uv - off).r, texture(tScene, uv).g, texture(tScene, uv + off).b);
#else
  col = texture(tScene, uv).rgb;
#endif
  col = sane(col);

  float depth = texelFetch(tDepth, ivec2(uv * uFullSize), 0).x;
  float z = linearZ(depth);

#ifdef USE_DOF
  {
    float focus = texture(tFocus, vec2(0.5)).x;
    float coc = min(uDof.x * abs(1.0 - focus / z), uDof.y);
    vec4 bl = texture(tDof, uv);
    float t = smoothstep(0.6, 2.0, max(coc, bl.a * 2.0));
    col = mix(col, bl.rgb, t);
  }
#endif

#ifdef USE_AO
  {
    float ao = aoUpsample(uv, z);
    // keep sunlit / emissive pixels from being dimmed as much as the ambient-lit ones
    float bright = smoothstep(0.35, 2.5, luma(col) * uExposure);
    ao = mix(ao, 1.0, bright * uAOMix.y);
    col *= mix(1.0, ao, uAOMix.x);
  }
#endif

#ifdef USE_RAYS
  {
    // forward-scattering phase: shafts are strong toward the sun and fade out to the sides, so
    // the dark backlit foreground is not veiled; the sky shader already has its own sun glow
    float k = 1.0 - dot(viewRay(uv), uRayPhase.xyz);
    float phase = 0.12 + 0.88 * exp(-k / uRayPhase.w);
    col += texture(tRays, uv).rgb * uRayColor * (phase * (depth >= SKY_DEPTH ? 0.4 : 1.0));
  }
#endif

  col *= uExposure;

#ifdef USE_BLOOM
  col += texture(tBloom, uv).rgb * uBloom;
#endif

#if defined(DEBUG_AO)
  gl_FragColor = vec4(vec3(aoUpsample(uv, z)), 1.0); return;
#elif defined(DEBUG_RAYS)
  gl_FragColor = vec4(toSRGB(clamp(texture(tRays, uv).rgb * uRayColor * 4.0, 0.0, 1.0)), 1.0); return;
#elif defined(DEBUG_BLOOM)
  gl_FragColor = vec4(toSRGB(clamp(texture(tBloom, uv).rgb * uBloom * 4.0, 0.0, 1.0)), 1.0); return;
#elif defined(DEBUG_DEPTH)
  gl_FragColor = vec4(vec3(fract(log2(z))), 1.0); return;
#endif

#ifdef TONEMAP_AGX
  col = agx(col * 1.6);
#else
  col = acesFilmic(col);
#endif

  // grade in a perceptual (square-root) space: split-tone, contrast about mid grey, saturation.
  // Both the shadow tint and the contrast fade out toward black, so deep shade (forest floors,
  // night) keeps its detail and its own hue instead of being crushed into blue-black.
  vec3 p = sqrt(col);
  float l = luma(p);
  float wSh = smoothstep(0.02, 0.2, l) * (1.0 - smoothstep(0.3, 0.62, l));
  float wHi = smoothstep(0.4, 0.95, l);
  p += uShadowTint * wSh + uHighTint * wHi;
  p = mix(p, (p - uVignette.z) * uGrade.x + uVignette.z, smoothstep(0.0, 0.3, l));
  float l2 = luma(p);
  float sat = uGrade.y * (1.0 - uGrade.z * (1.0 - smoothstep(0.08, 0.5, l2)));
  p = mix(vec3(l2), p, sat);
  p = p * (1.0 - uGrade.w) + uGrade.w;
  col = max(p, 0.0);
  col *= col;

  // vignette (smooth, slightly oval with the frame)
  col *= 1.0 - uVignette.x * pow(r2, uVignette.y);

  vec3 s = toSRGB(clamp(col, 0.0, 1.0));

  // film grain: luminance only, strongest in the midtones, re-seeded every frame
  float gl = luma(s);
  float grain = hash12(gl_FragCoord.xy + uGrain.y * 17.13) - 0.5;
  s += grain * uGrain.x * (0.35 + 2.6 * gl * (1.0 - gl));
  // triangular dither against banding in the sky gradients
  float dn = ign(gl_FragCoord.xy + uGrain.y * 5.588) + ign(gl_FragCoord.yx + 3.7 + uGrain.y * 2.9) - 1.0;
  s += dn / 255.0;
  // alpha must stay 1: three creates the canvas context with alpha, so anything less shows through
  gl_FragColor = vec4(s, 1.0);
}`,E=6;function D(){let e=new f(1,1,{type:c,format:t,minFilter:o,magFilter:o,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1});return e.texture.name=`post:bloom`,e}function de(e,t){let n={vertexShader:x,depthTest:!1,depthWrite:!1,toneMapped:!1},r=new _({...n,name:`post:bloom-pre`,defines:{PREFILTER:``},fragmentShader:w,blending:0,uniforms:{tIn:{value:null},uTexel:{value:new h},uThreshold:{value:new p(1.5,.8,40,1)}}}),i=new _({...n,name:`post:bloom-down`,fragmentShader:w,blending:0,uniforms:{tIn:{value:null},uTexel:{value:new h},uThreshold:{value:new p}}}),a=new _({...n,name:`post:bloom-up`,fragmentShader:T,blending:5,blendEquation:100,blendSrc:201,blendDst:201,uniforms:{tIn:{value:null},uTexel:{value:new h},uWeight:{value:1}}}),o=[];for(let e=0;e<E;e++)o.push(D());let s=0,c=1,l=1,u=new Float32Array(E),d={norm:1,get texture(){return o[0].texture},setSize(e,t){c=e,l=t;let n=Math.ceil(e/2),r=Math.ceil(t/2);s=0;for(let e=0;e<E&&!(e>0&&(n<6||r<6));e++)o[e].setSize(n,r),s++,n=Math.ceil(n/2),r=Math.ceil(r/2)},render(n,f){let p=r.uniforms;p.tIn.value=n,p.uTexel.value.set(1/c,1/l),p.uThreshold.value.set(f.threshold,f.knee,f.clamp,f.exposure),t.material=r,e.setRenderTarget(o[0]),t.render(e),t.material=i;for(let n=1;n<s;n++){let r=o[n-1];i.uniforms.tIn.value=r.texture,i.uniforms.uTexel.value.set(1/r.width,1/r.height),e.setRenderTarget(o[n]),t.render(e)}let m=1,h=1;for(let e=1;e<s;e++)u[e]=.55+.4*f.spread+(e>=3?.1*f.spread:0),m*=u[e],h+=m;d.norm=1/h,t.material=a;for(let n=s-1;n>=1;n--){let r=o[n];a.uniforms.tIn.value=r.texture,a.uniforms.uTexel.value.set(1/r.width,1/r.height),a.uniforms.uWeight.value=u[n],e.setRenderTarget(o[n-1]),t.render(e)}return o[0].texture},dispose(){for(let e of o)e.dispose();r.dispose(),i.dispose(),a.dispose()}};return d}var O={day:{c:1.05,s:1.03,sh:[-.006,.002,.018],hi:[.014,.006,-.012],nd:0,lift:0,v:.16,pv:.42},golden:{c:1.09,s:1.07,sh:[-.026,.004,.046],hi:[.042,.012,-.036],nd:0,lift:0,v:.21,pv:.42},dawn:{c:1.04,s:.98,sh:[-.008,.006,.034],hi:[.03,.012,.006],nd:0,lift:.006,v:.18,pv:.42},night:{c:1.06,s:.92,sh:[-.016,.004,.044],hi:[.004,0,-.004],nd:.45,lift:0,v:.26,pv:.3}},k=Object.keys(O),A=[.2126,.7152,.0722];function j(e,t){let n=e[0]*A[0]+e[1]*A[1]+e[2]*A[2];return t.set(e[0]-n,e[1]-n,e[2]-n),t}var M=v.smoothstep;function fe(){let e={look:1,exposure:0,contrast:1,saturation:1,splitTone:1,vignette:1,grain:1,chromatic:1,bloom:1,rays:1,ao:1,tonemap:`aces`},t=new g,n=new g,r={day:0,golden:0,dawn:0,night:0};function i(e){let t=e.sunElevation,n=e.night,i=M(t,-10,-2)*(1-M(t,16,32))*(1-n),a=i*(e.morning||0);return r.golden=i-a,r.dawn=a,r.night=n,r.day=Math.max(0,1-r.golden-r.dawn-r.night),r}function a(a,o){i(a);let s=0,c=0,l=0,u=0,d=0,f=0,p=o.uShadowTint.value.set(0,0,0),m=o.uHighTint.value.set(0,0,0);for(let e=0;e<k.length;e++){let i=r[k[e]];if(i<=0)continue;let a=O[k[e]];s+=a.c*i,c+=a.s*i,l+=a.nd*i,u+=a.lift*i,d+=a.v*i,f+=a.pv*i,p.addScaledVector(j(a.sh,t),i),m.addScaledVector(j(a.hi,n),i)}let h=e.look;p.multiplyScalar(e.splitTone*h),m.multiplyScalar(e.splitTone*h),o.uGrade.value.set(1+(s-1)*e.contrast*h,1+(c-1)*e.saturation*h,l*h,u*h),o.uVignette.value.x=d*e.vignette*h,o.uVignette.value.z=f}return{user:e,apply:a,weights:r}}var N=e({build:()=>L}),P=v.smoothstep,pe=16,me=1.2;function F(e={}){let n=new f(1,1,{type:e.type??1016,format:t,minFilter:e.filter??1006,magFilter:e.filter??1006,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1});return n.texture.name=e.name||`post`,n}function I(e,t,n,r={}){return new _({name:e,vertexShader:x,fragmentShader:t,uniforms:n,defines:r,depthTest:!1,depthWrite:!1,toneMapped:!1,blending:0})}async function L(e){let{renderer:n,scene:i,camera:u,quality:m,env:_}=e,y=m.level===`low`,te=m.level===`high`,b=typeof location<`u`?new URLSearchParams(location.search):new URLSearchParams,S=b.get(`postdebug`);if(S===`reference`){let{createReference:t}=await ee(async()=>{let{createReference:e}=await import(`./reference-NztVQ6cf.js`);return{createReference:e}},__vite__mapDeps([0,1]),import.meta.url);return e.render=t(e),{}}let C=new d(1,1,a),w=new f(1,1,{type:c,format:t,samples:y?0:4,depthBuffer:!0,stencilBuffer:!1,depthTexture:C,minFilter:o,magFilter:o,generateMipmaps:!1});w.texture.name=`post:scene`;let T=F({name:`post:ao`}),E=F({name:`post:ao2`}),D=F({name:`post:rays`}),O=F({name:`post:rays2`}),k=F({name:`post:dof`}),A=[F({name:`post:focus`,filter:l}),F({name:`post:focus2`,filter:l})];A[0].setSize(1,1),A[1].setSize(1,1);let j=y&&S!==`nofxaa`?F({name:`post:ldr`,type:r}):null,M=new ne(null),N=de(n,M),L=fe(),he={value:new h(1,1e3)},ge={value:new p(1,1,0,0)},R={value:new h(1,1)},z={value:new h(1,1)},B={uNearFar:he,uProj:ge},_e=I(`post:ao`,ie,{...B,tDepth:{value:C},uFullSize:R,uSize:z,uAO:{value:new p(.07,.8,30,64)},uAOFade:{value:new g(700,2200,1.9)}},{AO_SAMPLES:te?12:8}),V=I(`post:ao-blur`,ae,{tAO:{value:null},uDir:{value:new h}}),H=I(`post:rays-mask`,oe,{...B,tScene:{value:w.texture},tDepth:{value:C},uFullSize:R,uSunView:{value:new g},uMask:{value:new p(.0123,.12,.45,.15)}}),U=I(`post:rays-blur`,se,{tIn:{value:null},uSunUv:{value:new h},uRay:{value:new g}},{RAY_TAPS:pe}),W=I(`post:focus`,ce,{...B,tDepth:{value:C},tPrev:{value:null},uFocus:{value:new h(-1,1)}}),G=I(`post:dof`,le,{...B,tScene:{value:w.texture},tDepth:{value:C},tFocus:{value:null},uTexel:{value:new h},uDof:{value:new h}}),K={...B,tScene:{value:w.texture},tDepth:{value:C},tAO:{value:T.texture},tRays:{value:D.texture},tBloom:{value:null},tDof:{value:k.texture},tFocus:{value:null},uFullSize:R,uAOSize:z,uExposure:{value:1},uAOMix:{value:new h(.8,.5)},uRayColor:{value:new g},uRayPhase:{value:new p(0,0,-1,.07)},uBloom:{value:0},uCA:{value:0},uVignette:{value:new g(.2,1.6,.42)},uShadowTint:{value:new g},uHighTint:{value:new g},uGrade:{value:new p(1,1,0,0)},uGrain:{value:new h(.02,0)},uDof:{value:new h}},q=I(`post:grade`,ue,K),ve=j?I(`post:fxaa`,re.fragmentShader,{tDiffuse:{value:j.texture},resolution:{value:new h}}):null,J={ssao:!!m.ssao,godrays:!!m.godrays,bloom:!!m.bloom,grain:!0,chromatic:!0},Y={enabled:!1,focus:`auto`,aperture:.45},ye=0,be=!0;function xe(e={}){return e.enabled!==void 0&&(e.enabled&&!Y.enabled&&(be=!0),Y.enabled=!!e.enabled),e.focus!==void 0&&(Y.focus=e.focus),e.aperture!==void 0&&(Y.aperture=v.clamp(e.aperture,0,1)),Y}let Se=new h;function Ce(){n.getDrawingBufferSize(Se);let e=Math.max(1,Math.floor(Se.x)),t=Math.max(1,Math.floor(Se.y)),r=Math.max(1,Math.ceil(e/2)),i=Math.max(1,Math.ceil(t/2));w.setSize(e,t),j&&j.setSize(e,t);for(let e of[T,E,D,O,k])e.setSize(r,i);N.setSize(e,t),R.value.set(e,t),z.value.set(r,i),ve&&ve.uniforms.resolution.value.set(1/e,1/t)}Ce(),e.onResize(Ce);let we=-1;function Te(e,t,n,r,i){let a=!!e|(t?2:0)|(n?4:0)|(r?8:0)|(i?16:0)|(L.user.tonemap===`agx`?32:0);if(a===we)return;we=a;let o={};e&&(o.USE_AO=``),t&&(o.USE_RAYS=``),n&&(o.USE_BLOOM=``),r&&(o.USE_DOF=``),i&&(o.USE_CA=``),L.user.tonemap===`agx`&&(o.TONEMAP_AGX=``),S===`ao`&&e&&(o.DEBUG_AO=``),S===`rays`&&t&&(o.DEBUG_RAYS=``),S===`bloom`&&n&&(o.DEBUG_BLOOM=``),S===`depth`&&(o.DEBUG_DEPTH=``),q.defines=o,q.needsUpdate=!0}let Ee=new g,X=new p,Z=new s,Q={threshold:1.6,knee:.8,clamp:40,exposure:1,spread:0},De=0;function Oe(){he.value.set(u.near,u.far);let e=u.projectionMatrix.elements;ge.value.set(e[0],e[5],e[8],e[9])}function ke(){let e=_.sunElevation,t=P(e,-2.5,1.5);if(t<=0)return 0;let n=_.sunDir;u.getWorldDirection(Ee);let r=P(Ee.dot(n),.05,.4);if(r<=0||(X.set(n.x,n.y,n.z,0).applyMatrix4(u.matrixWorldInverse).applyMatrix4(u.projectionMatrix),X.w<=1e-5))return 0;let i=X.x/X.w*.5+.5,a=X.y/X.w*.5+.5,o=Math.max(0,Math.abs(i-.5)-.5),s=Math.max(0,Math.abs(a-.5)-.5),c=1-P(Math.hypot(o,s),0,.7);if(c<=0)return 0;let l=i-.5,d=a-.5,f=Math.hypot(l,d);f>3&&(i=.5+l/f*3,a=.5+d/f*3),U.uniforms.uSunUv.value.set(i,a);let p=H.uniforms.uSunView.value.copy(n).transformDirection(u.matrixWorldInverse);K.uRayPhase.value.set(p.x,p.y,p.z,.07);let m=1-P(e,18,45),h=t*r*c*(.45+.55*m)*(1-_.night);return H.uniforms.uMask.value.set(.0123,.12,.45,.15),h}let $=null;if(S===`stats`){let{createStats:e}=await ee(async()=>{let{createStats:e}=await import(`./debug-B-iF4Wio.js`);return{createStats:e}},__vite__mapDeps([2,1]),import.meta.url);$=e({renderer:n,quad:M,sceneTexture:w.texture,depthTexture:C,camera:u,env:_,vertexShader:x})}function Ae(){De++;let e=L.user,t=n.autoClear;n.autoClear=!0,n.setRenderTarget(w),n.render(i,u),n.autoClear=!1,Oe();let r=n.toneMappingExposure*2**e.exposure,a=_.night,o=J.ssao&&e.ao>0;o&&(M.material=_e,n.setRenderTarget(T),M.render(n),M.material=V,V.uniforms.tAO.value=T.texture,V.uniforms.uDir.value.set(1/z.value.x,0),n.setRenderTarget(E),M.render(n),V.uniforms.tAO.value=E.texture,V.uniforms.uDir.value.set(0,1/z.value.y),n.setRenderTarget(T),M.render(n),K.uAOMix.value.set(Math.min(1,.65*e.ao),.5));let s=J.godrays?ke()*e.rays:0,c=s>.003;if(c){M.material=H,n.setRenderTarget(D),M.render(n);let e=2.6,t=U.uniforms;M.material=U,t.tIn.value=D.texture,t.uRay.value.set(e/pe,me,0),n.setRenderTarget(O),M.render(n),t.tIn.value=O.texture,t.uRay.value.set(e/256,me,37),n.setRenderTarget(D),M.render(n),Z.copy(_.palette.sun);let r=s*.55;K.uRayColor.value.set(Z.r*r,Z.g*r,Z.b*r)}let l=J.bloom&&e.bloom>0;if(l){Q.threshold=1.6-.6*a,Q.exposure=r,Q.spread=a;let t=N.render(w.texture,Q);K.tBloom.value=t,K.uBloom.value=(.55+.4*a)*e.bloom*N.norm}let d=Y.enabled&&Y.aperture>0;if(d){let e=A[ye];ye^=1;let t=A[ye],r=typeof Y.focus==`number`&&Y.focus>0?Y.focus:-1;W.uniforms.tPrev.value=e.texture,W.uniforms.uFocus.value.set(r,be?1:.12),be=!1,M.material=W,n.setRenderTarget(t),M.render(n);let i=z.value.y/540,a=Y.aperture*14*i;G.uniforms.tFocus.value=t.texture,G.uniforms.uTexel.value.set(1/z.value.x,1/z.value.y),G.uniforms.uDof.value.set(a,16*i),M.material=G,n.setRenderTarget(k),M.render(n),K.tFocus.value=t.texture,K.uDof.value.set(a*2,32*i)}let f=J.chromatic&&e.chromatic>0;Te(o,c,l,d,f),L.apply(_,K),K.uExposure.value=r,K.uCA.value=f?.004*e.chromatic:0,K.uGrain.value.set(J.grain?.022*e.grain:0,De%997),M.material=q,n.setRenderTarget(j),M.render(n),j&&(M.material=ve,n.setRenderTarget(null),M.render(n)),$&&$(r),n.autoClear=t}let je={render:Ae,resize:Ce,sceneTarget:w,depthTexture:C,get bloomTexture(){return N.texture}};return b.get(`tonemap`)===`agx`&&(L.user.tonemap=`agx`),S===`dof`&&xe({enabled:!0}),S===`neutral`&&Object.assign(L.user,{look:0,bloom:0,rays:0,ao:0,grain:0,chromatic:0}),e.post={enabled:J,grade:L.user,setDof:xe,dof:Y,composer:je},e.render=Ae,{}}export{L as build,ne as n,y as r,N as t};