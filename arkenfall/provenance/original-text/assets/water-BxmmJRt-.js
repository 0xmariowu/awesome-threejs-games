import{An as e,B as t,C as n,Et as r,F as i,G as a,Gn as o,I as s,In as c,Kn as l,Rt as u,St as d,V as f,W as p,_t as m,b as h,er as g,f as _,ht as v,i as y,ir as b,m as x,nt as S,o as C,rt as w,s as T,tr as E,ut as D,xn as O,yn as k}from"./three.core-_y2F91K_.js";import{i as A}from"./three.module-DGcYoYN8.js";import{t as j}from"./contracts-CvM_HOZo.js";import{n as M,t as N}from"./Game-BmRmdldn.js";import{c as P,i as F,o as I,r as L,s as R,t as z}from"./swell-CGYFQCs6.js";var B=192,ee={[I.river]:0,[I.lake]:1,[I.fen]:2,[I.cave]:3};function te(e){let{wLevel:t,wBody:n,heights:r,flow:a}=e,o=e=>{let t=n[e];return t===I.river||t===I.lake||t===I.fen||t===I.cave},s=e=>o(e)&&!Number.isNaN(t[e]),c=e=>t[e]>r[e]-.45,l=[],u=Math.ceil((P-1)/B),d=new Int32Array(37249);for(let e=0;e<u;e++)for(let o=0;o<u;o++){let u=o*B,f=e*B,p=Math.min(P-1,u+B),m=Math.min(P-1,f+B);d.fill(-1);let h=[],g=[],_=[],v=[],y=[],b=[],x=(e,r)=>{let i=(r-f)*193+(e-u);if(d[i]>=0)return d[i];let o=r*P+e,c=t[o];h.push(-R+e*2,c,-R+r*2),g.push(a[o*2],a[o*2+1]),_.push(ee[n[o]]??0);let l=(e,n)=>{let r=Math.min(P-1,Math.max(0,n))*P+Math.min(P-1,Math.max(0,e));return s(r)?t[r]:c},p=l(e-1,r)-l(e+1,r),m=l(e,r-1)-l(e,r+1),b=1/Math.sqrt(p*p+16+m*m);y.push(p*b,4*b,m*b);let x=Math.sqrt(p*p+m*m)/4,S=Math.hypot(a[o*2],a[o*2+1]),C=Math.min(1,Math.max(0,(x-.07)/.13));return v.push(Math.min(1,C*C*(3-2*C)+Math.max(0,S-4.2)*.3)),d[i]=h.length/3-1,d[i]};for(let e=f;e<m;e+=4)for(let i=u;i<p;i+=4){let a=Math.min(p,i+4),o=Math.min(m,e+4),l=a-i===4&&o-e===4;if(l){let s=e*P+i,c=n[s],u=t[s];l=(c===I.lake||c===I.fen)&&!Number.isNaN(u);for(let s=e;l&&s<=o;s++)for(let e=i;e<=a;e++){let i=s*P+e;if(n[i]!==c||Math.abs(t[i]-u)>1e-4||u-r[i]<.7){l=!1;break}}}if(l){let t=x(i,e),n=x(a,e),r=x(i,o),s=x(a,o);b.push(t,r,s,t,s,n);continue}for(let t=e;t<o;t++)for(let e=i;e<a;e++){let n=t*P+e,r=n+1,i=n+P,a=i+1;if(!s(n)||!s(r)||!s(i)||!s(a)||!c(n)&&!c(r)&&!c(i)&&!c(a))continue;let o=x(e,t),l=x(e+1,t),u=x(e,t+1),d=x(e+1,t+1);b.push(o,u,d,o,d,l)}}if(!b.length)continue;let S=new T;S.setAttribute(`position`,new i(h,3)),S.setAttribute(`normal`,new i(y,3)),S.setAttribute(`aFlow`,new i(g,2)),S.setAttribute(`aKind`,new i(_,1)),S.setAttribute(`aFoam`,new i(v,1)),S.setIndex(b),S.computeBoundingSphere(),S.computeBoundingBox(),l.push(S)}return l}function ne(e=84){let t=(252+.0066*84**3-3*e)/(e*e*e),n=e=>{let n=Math.abs(e);return Math.sign(e)*(3*n+t*n*n*n)},r=e*2+1,i=new Float32Array(r*r*3);for(let t=0;t<r;t++)for(let a=0;a<r;a++){let o=(t*r+a)*3;i[o]=n(a-e),i[o+1]=0,i[o+2]=n(t-e)}let a=[];for(let e=0;e<r-1;e++)for(let t=0;t<r-1;t++){let n=e*r+t,i=n+1,o=n+r,s=o+1;a.push(n,o,s,n,s,i)}let o=new T;return o.setAttribute(`position`,new C(i,3)),o.setIndex(a),o.boundingSphere=new c(new E,1e5),o}var V=e=>new x(e),H={wRiverDeep:V(2046513),wRiverShallow:V(3825484),wLakeDeep:V(1325636),wLakeShallow:V(2977132),wFenDeep:V(1054479),wFenShallow:V(2568733),wSeaDeep:V(934489),wSeaShallow:V(3116680),wCave:V(664357),wFoam:V(15660014),wLily:V(11071688),wBank:V(3425578)},U={low:null,medium:{steps:10,grow:1.95,refine:3},high:{steps:16,grow:1.5,refine:4}},W=`
uniform sampler2D tWHeight;
uniform sampler2D tWave;
uniform sampler2D tCoast;
uniform float uTime;
uniform float uNight;
uniform float uReflBoost;
uniform vec3 uSunColor;
uniform vec3 wRiverDeep, wRiverShallow, wLakeDeep, wLakeShallow, wFenDeep, wFenShallow, wSeaDeep, wSeaShallow, wCave, wFoam, wLily, wBank;
const float BANK_STEPS[ 4 ] = float[ 4 ]( 4.0, 11.0, 30.0, 85.0 );
float wGround( vec2 xz ) {
	vec2 uv = ( ( xz + 1024.0 ) * 0.5 + 0.5 ) / 1025.0;
	return textureLod( tWHeight, uv, 0.0 ).r;
}
`,G=`
attribute vec2 aFlow;
attribute float aKind;
attribute float aFoam;
varying vec3 vWPos;
varying vec2 vFlow;
varying float vKind;
varying float vFoamV;
varying vec3 vWNrm;
`,re=`
uniform vec2 uSeaOrigin;
uniform vec3 uCamXZ;
varying vec3 vWPos;
varying vec2 vFlow;
varying float vKind;
varying float vFoamV;
varying vec3 vWNrm;
${z}
`,K=`
varying vec3 vWPos;
varying vec2 vFlow;
varying float vKind;
varying float vFoamV;
varying vec3 vWNrm;
uniform mat4 projectionMatrix;
uniform sampler2D tSceneDepth;
uniform vec2 uSceneDepthRes;
uniform sampler2D tSSRColor;
uniform float uSSROn;
// written by the shading block, read by the light loop (glitter)
vec3 gUpV = vec3( 0.0, 1.0, 0.0 );
float gGlint = 0.0;
vec3 waveN( vec2 uv ) {
	vec2 n = texture( tWave, uv ).xy * 2.0 - 1.0;
	return vec3( n.x, sqrt( max( 0.0, 1.0 - dot( n, n ) ) ), n.y );
}
#ifdef WATER_SSR
float ssrEdge( vec2 uv ) {
	vec2 e = min( uv, 1.0 - uv );
	return smoothstep( 0.0, 0.05, e.x ) * smoothstep( 0.0, 0.07, e.y );
}
// March the reflected ray (view space) against the half-res opaque depth: geometric steps, then a
// bisection where it first passes behind a surface. rgb = what the mirror shows, a = confidence.
// The ray is linear in clip space (c0 + cR·t), so a step costs a multiply-add and one divide. Every
// step's depth is fetched up front (independent reads the GPU overlaps), the first crossing is found
// in registers, and the bisection runs once after the search: inside the loop it would run once for
// every step at which some pixel of the wave hits (divergence made the march cost scale with it).
// Far water (march = false) only looks along the ray's direction: nothing near it stands in its mirror.
vec4 waterSSR( vec3 Pv, vec3 Rv, float jitter, bool march ) {
	vec4 c0 = projectionMatrix * vec4( Pv, 1.0 );
	vec4 cR = projectionMatrix * vec4( Rv, 0.0 );
	float tPrev = 140.0;
	if ( march ) {
		float sDepth[ SSR_STEPS ];
		float sZ[ SSR_STEPS ];
		float ts = 0.35 * ( 0.7 + 0.6 * jitter );
		for ( int i = 0; i < SSR_STEPS; i++ ) {
			vec4 c = c0 + cR * ts;
			vec2 uv = c.xy / c.w * 0.5 + 0.5;
			float qz = Pv.z + Rv.z * ts;
			// off screen or behind the camera: a sentinel the search below stops at
			sZ[ i ] = ( qz > -0.1 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) ? 1e9 : -qz;
			sDepth[ i ] = texture( tSceneDepth, clamp( uv, 0.0, 1.0 ) ).r;
			ts *= SSR_GROW;
		}
		// first step behind a surface (a = the step before it); off screen first → no answer
		float a = 0.0, b = -1.0, tp = 0.0, t = 0.35 * ( 0.7 + 0.6 * jitter );
		bool stop = false;
		for ( int i = 0; i < SSR_STEPS; i++ ) {
			if ( !stop && sZ[ i ] > 1e8 ) stop = true;
			else if ( !stop && sZ[ i ] > sDepth[ i ] ) { a = tp; b = t; stop = true; }
			tp = t;
			t *= SSR_GROW;
		}
		tPrev = tp;
		if ( b < 0.0 && stop ) return vec4( 0.0 );
		if ( b > 0.0 ) {
			float span = b - a;
			for ( int k = 0; k < SSR_REFINE; k++ ) {
				float m = 0.5 * ( a + b );
				vec4 cm = c0 + cR * m;
				if ( -( Pv.z + Rv.z * m ) > texture( tSceneDepth, cm.xy / cm.w * 0.5 + 0.5 ).r ) b = m; else a = m;
			}
			vec4 cb = c0 + cR * b;
			vec2 ub = cb.xy / cb.w * 0.5 + 0.5;
			float zb = -( Pv.z + Rv.z * b );
			// a real hit lies on the surface; a ray that slipped behind a thin thing in front does not
			// (it takes the far answer below)
			if ( zb - texture( tSceneDepth, ub ).r < 0.4 + 0.05 * zb + span * 0.12 )
				return vec4( texture( tSSRColor, ub ).rgb, ssrEdge( ub ) );
		}
	}
	// nothing within reach: the far land and the sky lie along the ray's direction at infinity
	vec4 c = cR;
	if ( c.w <= 1e-4 ) return vec4( 0.0 );
	vec2 ui = c.xy / c.w * 0.5 + 0.5;
	if ( ui.x < 0.0 || ui.x > 1.0 || ui.y < 0.0 || ui.y > 1.0 ) return vec4( 0.0 );
	return vec4( texture( tSSRColor, ui ).rgb, ssrEdge( ui ) * smoothstep( tPrev * 0.4, tPrev, texture( tSceneDepth, ui ).r ) );
}
#endif
`,q=`
// Facet slopes are long along the view and narrow across it (a narrow core plus a broad skirt of
// stray sparkles), so each light draws a path running toward the viewer. gGlint carries the facets:
// sparse bright sparkles near by, their average far away (normalised, so the path keeps its energy).
void RE_Direct_Water( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	if ( gGlint <= 0.0 || dot( gUpV, directLight.direction ) <= 0.0 ) return;
	vec3 H = normalize( directLight.direction + geometryViewDir );
	float hn = dot( H, gUpV );
	if ( hn < 0.3 ) return;
	vec3 fwd = geometryViewDir - gUpV * dot( geometryViewDir, gUpV );
	float fl = length( fwd );
	fwd = fl > 1e-4 ? fwd / fl : vec3( 0.0, 0.0, 1.0 );
	vec3 side = cross( gUpV, fwd );
	float sa = dot( H, fwd ) / hn, sc = dot( H, side ) / hn;
	// core σ 0.16 × 0.055 (0.22 along the view under the moon, so its path runs unbroken toward the
	// viewer), skirt σ 0.3 (slope-space densities)
	float sgA = mix( 0.16, 0.22, uNight );
	float pdf = 13.6 * ( 0.16 / sgA ) * exp( -0.5 * ( sa * sa / ( sgA * sgA ) + sc * sc * 330.0 ) ) + 0.44 * exp( -5.5 * ( sa * sa + sc * sc ) );
	float spec = pdf / ( 4.0 * hn * hn * hn * hn * max( dot( gUpV, geometryViewDir ), 0.08 ) );
	float fr = 0.02 + 0.98 * pow( 1.0 - saturate( dot( H, geometryViewDir ) ), 5.0 );
	reflectedLight.directSpecular += directLight.color * min( spec * fr * gGlint, 400.0 );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Water
`,ie=`
	vec3 P = vWPos;
	float ground = wGround( P.xz );
	float depth = max( 0.0, P.y - ground );
	vec3 V = normalize( cameraPosition - P );
	float camD = length( cameraPosition - P );
	float kind = vKind;
	float kRiver = 1.0 - step( 0.5, kind );
	float kLake = step( 0.5, kind ) * ( 1.0 - step( 1.5, kind ) );
	float kFen = step( 1.5, kind ) * ( 1.0 - step( 2.5, kind ) );
	float kCave = step( 2.5, kind ) * ( 1.0 - step( 3.5, kind ) );
	float kSea = step( 3.5, kind );
#ifdef WATER_SEA
	if ( P.z < texture( tCoast, vec2( ( ( P.x + 1024.0 ) * 0.5 + 0.5 ) / 1025.0, 0.5 ) ).r - 1.0 ) discard;
#endif
	// detail fades with distance; past ~300 m only the broad layers are sampled (the cheap far path)
	float nearK = 1.0 - smoothstep( 150.0, 300.0, camD );
	float glintK = ( 1.0 - smoothstep( 18.0, 60.0, camD ) ) * ( 1.0 - kCave );

	// ---- ripples ----
	// Flow mapping: two layers advected along the current for one phase cycle each, cross-faded half
	// a cycle apart. The phase rate is the same everywhere (only the advected distance follows the
	// current), so neighbouring pixels never drift apart however long the game runs.
	float speed = length( vFlow );
	float chute = clamp( vFoamV, 0.0, 1.0 );
	float tf = uTime * 0.35;
	float ph0 = fract( tf );
	float ph1 = fract( tf + 0.5 );
	float blendB = abs( 2.0 * ph0 - 1.0 );
	float moving = smoothstep( 0.08, 0.5, speed );
	// metres the water travels in one cycle (still water drifts a little, so its foam never just pulses)
	vec2 adv = vFlow * ( 1.0 / 0.35 ) + vec2( 0.45, 0.3 ) * ( 1.0 - moving );
	vec2 q0 = P.xz - adv * ph0, q1 = P.xz - adv * ph1;
	// runs and pools: soft swells under a fine skin of ripples (glassy water that mirrors the banks);
	// chutes: short and choppy
	float rScale = mix( 8.5, 5.0, chute );
	vec3 nFlow = mix( waveN( q0 / rScale ), waveN( q1 / rScale + 0.37 ), blendB );
	vec3 nStill = waveN( P.xz / 19.0 + vec2( uTime * 0.011, uTime * 0.007 ) );
	// glitter facets: every cell holds one facet at a random spot that flashes once per cycle at its own
	// moment (hashed, so no pattern repeats); between flashes the path glows softly. By day sparse, bright
	// sparkles (~0.26 m cells, a few % of the surface at 20× the path's mean); under the moon a dense
	// shimmer of small facets (~0.12 m, a fifth of the surface at ~2×) that reads as one broken silver
	// path instead of a few blown-out discs. Past ~50 m only their average is left.
	float facet = 1.0;
#ifndef WATER_LQ
	if ( nearK > 0.0 ) {
		nFlow = nFlow * 0.6 + mix( waveN( ( P.xz - adv * ph0 * 1.3 ) / ( rScale * 0.29 ) + 0.61 ), waveN( ( P.xz - adv * ph1 * 1.3 ) / ( rScale * 0.29 ) + 0.13 ), blendB ) * 0.75 * nearK;
		// a fine skin near the viewer (it smears the mirror into short horizontal streaks)
		float skinK = 1.0 - smoothstep( 12.0, 45.0, camD );
		if ( skinK > 0.0 ) nFlow += waveN( ( P.xz - adv * ph0 * 1.6 ) / 0.9 + vec2( 0.29, 0.83 ) ) * 0.35 * skinK;
		nStill += waveN( P.xz / 6.1 - vec2( uTime * 0.016, -uTime * 0.012 ) ) * 0.7 * nearK;
	}
	if ( glintK > 0.0 ) {
		vec2 gc = P.xz / mix( 0.26, 0.12, uNight );
		vec2 gi = floor( gc ), gf = gc - gi;
		float hA = fract( sin( dot( gi, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
		float hB = fract( hA * 17.13 + 0.37 );
		float life = fract( uTime * ( 0.6 + 0.9 * hB ) + hA * 7.0 );
		float flash = ( 1.0 - smoothstep( 0.05, mix( 0.22, 0.4, uNight ), length( gf - 0.2 - 0.6 * vec2( hA, hB ) ) ) )
			* smoothstep( 0.0, 0.06, life ) * ( 1.0 - smoothstep( mix( 0.1, 0.55, uNight ), mix( 0.3, 0.9, uNight ), life ) );
		// (by day the flashes cover ~2 % of the surface: 0.6 + 20 × flash keeps the path's mean; at night
		// ~20 %: 0.75 + 1.35 × flash)
		facet = mix( 1.0, mix( 0.6, 0.75, uNight ) + mix( 20.0, 1.35, uNight ) * flash, glintK );
	}
#endif
	vec3 rip = mix( nStill, nFlow, moving );
	float strength = mix( 0.2, 0.13 + min( speed, 4.0 ) * 0.04 + chute * 0.45, moving );
	strength *= mix( 1.0, 0.06, kFen ) * mix( 1.0, 0.5, kCave ) * mix( 1.0, 0.8, kSea );
	strength *= 1.0 - smoothstep( 90.0, 700.0, camD ) * 0.75;
	// seen at a glancing angle, calm water mirrors the pale sky near the horizon: steep tilts there
	// would swing the reflection up into the deep zenith blue and read as chop
	strength *= mix( 0.45, 1.0, smoothstep( 0.03, 0.4, V.y ) );
	vec3 wN = normalize( vWNrm + vec3( rip.x, 0.0, rip.z ) * strength );
	gUpV = normalize( ( viewMatrix * vec4( vWNrm, 0.0 ) ).xyz );
	gGlint = facet * ( 1.0 - kCave ) * mix( 1.0, 0.4, kFen ) * mix( 1.0, 0.6, chute );

	// ---- body: the colour the water scatters back, deepening from the margins into the channel ----
	vec3 deepC = wRiverDeep * kRiver + wLakeDeep * kLake + wFenDeep * kFen + wCave * kCave + wSeaDeep * kSea;
	vec3 shallowC = wRiverShallow * kRiver + wLakeShallow * kLake + wFenShallow * kFen + wCave * 1.6 * kCave + wSeaShallow * kSea;
	vec3 col = mix( shallowC, deepC, smoothstep( 0.15, 2.2, depth ) );
	// extinction per metre of path: rivers show their bed through the first half metre only
	float absorb = 3.4 * kRiver + 2.6 * kLake + 7.0 * kFen + 2.4 * kCave + 1.1 * kSea;

	// ---- foam: white water only in the riffles and chutes, a thin lace at the waterline ----
	// (the lattice is only fetched where a lace or a breaker can show: open water skips four taps)
	float foam = 0.0;
	// lakes and the sea: a broken line where water meets land; rivers: a hairline where the current
	// wraps the banks and the stones that break the surface
	float shoreW = 0.06 * kRiver + 0.12 * kLake + 0.37 * kSea + 0.05 * kCave;
	float shore = 1.0 - smoothstep( 0.0, shoreW, depth );
	if ( ( shore > 0.0 && ( nearK > 0.0 || kSea > 0.5 ) ) || ( kSea > 0.5 && depth < 2.8 ) ) {
		vec4 wv = mix( texture( tWave, q0 / 3.3 ), texture( tWave, q1 / 3.3 + 0.41 ), blendB );
		vec4 wv2 = mix( texture( tWave, q0 / 5.7 + vec2( 0.3, 0.7 ) ), texture( tWave, q1 / 5.7 + vec2( 0.53, 0.19 ) ), blendB );
		float lattice = max( wv.a, wv2.a * 0.8 );
		foam = shore * smoothstep( 0.4, 0.78, lattice + 0.2 * wv.b ) * ( kRiver * mix( 0.35, 0.85, moving ) + kLake * 0.5 + kSea + kCave * 0.2 );
		// rolling breakers on the strand
		float band = sin( depth * 4.2 - uTime * 1.35 + wv2.b * 2.2 );
		foam = max( foam, kSea * smoothstep( 0.72, 0.97, band ) * ( 1.0 - smoothstep( 0.3, 2.8, depth ) ) * smoothstep( 0.2, 0.5, lattice + 0.3 ) );
	}
	// white water in the chutes: streaks stretched along the current and racing downstream
	if ( chute > 0.3 ) {
		vec2 fdir = speed > 0.01 ? vFlow / speed : vec2( 0.0, 1.0 );
		vec2 fperp = vec2( -fdir.y, fdir.x );
		float along = dot( P.xz, fdir ), across = dot( P.xz, fperp ) / 1.6;
		float run = speed * ( 1.4 / 0.35 );            // chute water races: 1.4× the mean current
		vec2 su0 = vec2( across, ( along - run * ph0 ) / 7.5 ), su1 = vec2( across + 0.37, ( along - run * ph1 ) / 7.5 );
		float streakF = mix( texture( tWave, su0 ).a * 0.55 + texture( tWave, su0 * vec2( 2.2, 1.4 ) + 0.47 ).b * 0.55,
			texture( tWave, su1 ).a * 0.55 + texture( tWave, su1 * vec2( 2.2, 1.4 ) + 0.47 ).b * 0.55, blendB );
		float white = smoothstep( 0.3, 0.75, chute );
		foam = max( foam, white * smoothstep( 0.42, 0.8, streakF + white * 0.22 ) * 0.9 );
	}
	foam = clamp( foam, 0.0, 1.0 ) * ( 1.0 - kFen );
	col = mix( col, wFoam, foam * 0.85 );
	diffuseColor = vec4( col, 1.0 );
	// a glassy mirror near the viewer, a broad soft sheen out in the distance
	float wRough = mix( 0.035, 0.08, smoothstep( 30.0, 380.0, camD ) );
	wRough = mix( wRough, 0.025, kFen );
	wRough = mix( wRough, 0.55, foam );
	// fen lilies: soft glowing spots in the shallows after dark
	vec3 wEmis = vec3( 0.0 );
	if ( kFen > 0.5 ) {
		float lily = smoothstep( 0.86, 0.95, texture( tWave, P.xz / 11.0 + 0.21 ).a ) * smoothstep( 0.05, 0.4, depth );
		wEmis = wLily * lily * smoothstep( 0.35, 0.9, uNight ) * 1.4;
	}
`,ae=`
	// Fresnel, shaped for the look of the reference rivers: a dark window looking down (12 % at 30°,
	// physical 2 % beyond 40°), a mirror at a glancing look (61 % at 15°, 80 % at 10°, 94 % at 5°)
	float nv = saturate( dot( normal, geometryViewDir ) );
	float F = ( 0.02 + 0.98 * pow( 1.0 - smoothstep( 0.0, 0.66, nv ), 1.2 ) ) * ( 1.0 - foam );
	// ---- what the mirror shows ----
	vec3 mirror = vec3( 0.0 );
	float got = 0.0;
#ifdef WATER_SSR
	// looking down into the water (F under ~0.12) the mirror is faint: the environment answers there and
	// the march is skipped, fading in over a band of view angles so no edge shows
	if ( uSSROn > 0.5 && F > 0.08 ) {
		float jit = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
		// (the ripples bend the mirrored scene, softened so the towers waver instead of shattering)
		vec3 Rv = reflect( -geometryViewDir, normalize( mix( gUpV, normal, 0.6 ) ) );
		vec4 s = waterSSR( geometryPosition, Rv, jit, camD < 280.0 );
		s.a *= smoothstep( 0.08, 0.16, F );
		mirror = s.rgb * s.a;
		got = s.a;
	}
#endif
	if ( got < 0.999 ) {
		// off-screen: the environment sky, with the banks, cliffs and far hills standing in it (the
		// reflected ray marched a few steps over the terrain heights)
		vec3 Rr = reflect( -V, wN );
		float rLen = max( 0.05, length( Rr.xz ) );
		vec2 rDir = Rr.xz / rLen;
		float rRise = max( Rr.y, 0.0 ) / rLen;
		float bankOcc = 0.0;
		if ( kCave < 0.5 && ( kSea < 0.5 || nearK > 0.0 ) ) {
			for ( int i = 0; i < 4; i++ ) {
				float t = BANK_STEPS[ i ];
				bankOcc = max( bankOcc, smoothstep( -0.4, 1.0, wGround( P.xz + rDir * t ) - ( P.y + rRise * t ) ) );
			}
		}
		vec3 bankLight = irradiance + iblIrradiance + uSunColor * 1.4 * ( 1.0 - uNight );
		vec3 env = mix( radiance * uReflBoost * mix( 1.0, 0.15, kCave ), wBank * bankLight * 0.32, bankOcc );
		mirror += env * ( 1.0 - got );
	}
	// ---- composition: final = F·mirror + body·(1 − F)(1 − T) + bed·(1 − F)·T, with T the light that
	// crosses the water from the bed (a longer path at a glancing look). The blend carries the bed
	// term, so the colour is divided by the alpha it will be multiplied with.
	float T = exp( -depth * absorb / mix( 0.66, 1.0, saturate( dot( vWNrm, V ) ) ) );
	float bodyW = mix( ( 1.0 - F ) * ( 1.0 - T ), 1.0, foam );
	float a0 = max( F + bodyW, 1e-3 );
	float inv = 1.0 / a0;
	reflectedLight.indirectSpecular = mirror * ( F * inv );
	reflectedLight.directSpecular *= inv * ( 1.0 - foam * 0.8 );
	reflectedLight.directDiffuse *= bodyW * inv;
	reflectedLight.indirectDiffuse *= bodyW * inv;
	diffuseColor.a = min( 1.0, a0 ) * smoothstep( 0.0, 0.08, depth );
`;function oe(e,t,n,r){let i={q:r},a={tWHeight:{value:e.height},tWave:{value:e.wave},tCoast:{value:e.coast},uTime:M.uTime,uNight:M.uNight,uSunColor:M.uSunColor,uReflBoost:{value:2.5},uSeaOrigin:{value:new g},uCamXZ:{value:new E},tSSRColor:n.tSSRColor,uSSROn:n.uSSROn,tSceneDepth:n.tSceneDepth,uSceneDepthRes:n.uSceneDepthRes};for(let[e,t]of Object.entries(H))a[e]={value:t};let o=new v({color:16777215,roughness:.05,metalness:0,transparent:!0,depthWrite:!0});return o.name=`water-${t}`,o.onBeforeCompile=e=>{Object.assign(e.uniforms,a);let n={...e.defines??{}};t===`sea`&&(n.WATER_SEA=``),i.q===`low`&&(n.WATER_LQ=``);let r=U[i.q];r&&Object.assign(n,{WATER_SSR:``,SSR_STEPS:r.steps,SSR_GROW:r.grow.toFixed(3),SSR_REFINE:r.refine}),e.defines=n;let o=e.vertexShader.replace(`#include <common>`,`#include <common>\n${W}\n${t===`sea`?re:G}`);o=t===`inland`?o.replace(`#include <begin_vertex>`,`#include <begin_vertex>
vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vFlow = aFlow; vKind = aKind; vFoamV = aFoam;
vWNrm = normalize( mat3( modelMatrix ) * objectNormal );`):o.replace(`#include <beginnormal_vertex>`,`
vec2 wxz = position.xz + uSeaOrigin;
float restDepth = max( 0.0, -wGround( wxz ) );
// swell fades with distance from the camera (it is only sampled every few metres out there)
float swellK = 1.0 - smoothstep( 220.0, 420.0, length( wxz - uCamXZ.xz ) );
float y0 = seaSwell( wxz, uTime, restDepth ) * swellK;
float yx = seaSwell( wxz + vec2( 1.5, 0.0 ), uTime, restDepth ) * swellK;
float yz = seaSwell( wxz + vec2( 0.0, 1.5 ), uTime, restDepth ) * swellK;
vec3 objectNormal = normalize( vec3( y0 - yx, 1.5, y0 - yz ) );`).replace(`#include <begin_vertex>`,`vec3 transformed = vec3( wxz.x, y0, wxz.y );
vWPos = transformed; vFlow = vec2( 0.0 ); vKind = 4.0; vFoamV = 0.0; vWNrm = objectNormal;`),e.vertexShader=o;let s=e.fragmentShader.replace(`#include <common>`,`#include <common>\n${W}\n${K}`);s=s.replace(`#include <lights_physical_pars_fragment>`,`#include <lights_physical_pars_fragment>\n${q}`),s=s.replace(`#include <color_fragment>`,ie),s=s.replace(`#include <roughnessmap_fragment>`,`float roughnessFactor = wRough;`),s=s.replace(`#include <normal_fragment_maps>`,`normal = normalize( ( viewMatrix * vec4( wN, 0.0 ) ).xyz );`),s=s.replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
totalEmissiveRadiance += wEmis;`),s=s.replace(`#include <aomap_fragment>`,ae),e.fragmentShader=s},o.customProgramCacheKey=()=>`mender-water-${t}-v5-${i.q}`,{material:o,uniforms:a,setQuality:e=>{e!==i.q&&(i.q=e,o.needsUpdate=!0)}}}var se=9.81,J=`#include <fog_pars_vertex>`,Y=`#include <fog_pars_fragment>`;function X(){return o.clone(A.fog)}var Z=`
#ifdef SOFT_DEPTH
uniform sampler2D tSceneDepth;
uniform vec2 uSceneDepthRes;
float softFade( float viewDepth, float range ) {
	float scene = texture2D( tSceneDepth, gl_FragCoord.xy / uSceneDepthRes ).r;
	return smoothstep( 0.0, range, scene - viewDepth );
}
#else
float softFade( float viewDepth, float range ) { return 1.0; }
#endif
`;function Q(e){return e?{tSceneDepth:e.tSceneDepth,uSceneDepthRes:e.uSceneDepthRes}:{}}function ce(n,r,a){let o=new t;o.name=`veilfall`;let s=n.lipX+n.ux*n.edgeA,c=n.lipZ+n.uz*n.edgeA,l=n.lipY-n.poolLevel,u=Math.sqrt(2*l/se),d=(n.landA-n.edgeA)/u,f=-n.uz,p=n.ux,m=e=>({a:d*e,y:n.lipY-.5*se*e*e}),v=a?{SOFT_DEPTH:``}:{},y=[],b=[],x=[],S=[],C=[],w=[],E=0,O=16;for(let e=0;e<2;e++){let t=y.length/3,r=0,i=null;for(let t=0;t<=46;t++){let a=t/46,o=u*(a*a*.35+a*.65),l=m(o);i&&(r+=Math.hypot(l.a-i.a,l.y-i.y)),i=l;let d=(12.6+6.2*a+1.2*Math.sin(a*5.1))*(e===0?1:.84);e===0&&(O=d);let h=e===0?0:.5+.9*a;for(let t=0;t<=16;t++){let i=t/16-.5,u=Math.abs(i)**2*2.4*Math.min(1,a*3)+h,m=i*d,g=s+n.ux*(l.a-u)+f*m,_=c+n.uz*(l.a-u)+p*m;y.push(g,l.y+Math.abs(i)*.4,_),b.push(i+.5+e*.37,r),x.push(Math.abs(i)*2),S.push(o+e*1.7),C.push(e)}}e===0&&(E=r);for(let e=0;e<46;e++)for(let n=0;n<16;n++){let r=t+e*17+n,i=r+1,a=r+16+1,o=a+1;w.push(r,a,i,i,a,o)}}let k=new T;k.setAttribute(`position`,new i(y,3)),k.setAttribute(`uv`,new i(b,2)),k.setAttribute(`aEdge`,new i(x,1)),k.setAttribute(`aTau`,new i(S,1)),k.setAttribute(`aLayer`,new i(C,1)),k.setIndex(w),k.computeVertexNormals();let A=new e({uniforms:{...X(),...Q(a),uTime:M.uTime,uNight:M.uNight,uSunDir:M.uSunDir,uSunColor:M.uSunColor,tNoise:{value:r},uLen:{value:E}},defines:v,transparent:!0,depthWrite:!1,side:2,fog:!0,vertexShader:`
      ${J}
      attribute float aEdge;
      attribute float aTau;
      attribute float aLayer;
      uniform sampler2D tNoise;
      uniform float uLen;
      varying vec2 vUv; varying float vEdge; varying vec3 vW; varying vec3 vN; varying float vDepth; varying float vTau; varying float vLayer;
      void main() {
        vUv = uv; vEdge = aEdge; vTau = aTau; vLayer = aLayer;
        // the sheet breaks into ropes of water that bulge out and fall back as they drop
        float rope = textureLod( tNoise, vec2( uv.x * 1.3 + 0.13, uv.y / uLen * 0.22 ), 0.0 ).r;
        vec3 p = position + normal * ( rope - 0.5 ) * 2.6 * min( 1.0, uv.y / uLen * 4.0 );
        vec4 w = modelMatrix * vec4( p, 1.0 );
        vW = w.xyz; vN = normalize( mat3( modelMatrix ) * normal );
        vec4 mvPosition = viewMatrix * w;
        vDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,fragmentShader:`
      ${Y}
      ${Z}
      uniform float uTime, uNight, uLen;
      uniform vec3 uSunDir, uSunColor;
      uniform sampler2D tNoise;
      varying vec2 vUv; varying float vEdge; varying vec3 vW; varying vec3 vN; varying float vDepth; varying float vTau; varying float vLayer;
      void main() {
        float s = vUv.y / uLen;                       // 0 at the lip → 1 at the pool
        // The streaks are indexed by the water's own travel time, so the pattern falls with the
        // water, accelerating and stretching as it goes, and never shears however long it runs.
        float ph = vTau - uTime;
        float n1 = texture( tNoise, vec2( vUv.x * 6.5, ph * 0.55 ) ).r;
        float n2 = texture( tNoise, vec2( vUv.x * 15.0 + 0.31, ph * 1.1 + 0.5 ) ).b;
        float n3 = texture( tNoise, vec2( vUv.x * 31.0 + 0.7, ph * 2.3 ) ).g;
        float streak = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;
        // glassy ribbons with gaps near the lip, aerated white froth lower down
        float tear = smoothstep( 0.34 - s * 0.22, 0.6 - s * 0.16, streak );
        float alpha = mix( 0.42, 0.9, s ) * mix( 0.25, 1.0, tear );
        alpha *= 1.0 - smoothstep( 0.7 - 0.12 * n2, 1.0, vEdge );   // ragged sides
        alpha *= smoothstep( 0.0, 0.02, s ) * ( 1.0 - smoothstep( 0.96, 1.0, s ) );
        alpha *= softFade( vDepth, 1.5 ) * mix( 1.0, 0.55, vLayer );
        // ropes: rounded columns lit on one flank, thin veils (the cliff shows through) between them
        float rA = texture( tNoise, vec2( vUv.x * 1.3 + 0.13, s * 0.22 ) ).r;
        float rB = texture( tNoise, vec2( vUv.x * 1.3 + 0.135, s * 0.22 ) ).r;
        float flank = clamp( ( rB - rA ) * 90.0, -1.0, 1.0 );
        alpha *= mix( 0.5, 1.0, smoothstep( 0.3, 0.52, rA ) );
        float sunK = ( max( 0.0, dot( normalize( vN ), uSunDir ) ) * 0.35 + 0.65 ) * ( 0.82 + 0.3 * flank ) * mix( 0.8, 1.08, smoothstep( 0.35, 0.6, rA ) );
        float froth = clamp( s * 1.15 + ( streak - 0.5 ) * 0.9 - 0.12, 0.0, 1.0 );
        vec3 body = mix( vec3( 0.5, 0.68, 0.68 ), vec3( 0.93, 0.96, 0.95 ), froth );
        vec3 lit = body * mix( uSunColor * sunK + vec3( 0.12, 0.16, 0.2 ), vec3( 0.22, 0.28, 0.4 ), uNight * 0.75 ) * mix( 1.0, 0.72, vLayer );
        gl_FragColor = vec4( lit, alpha );
        #include <fog_fragment>
      }`}),j=new D(k,A);j.renderOrder=3,o.add(j);let N=n.lipX+n.ux*n.landA,P=n.lipZ+n.uz*n.landA,F=new _(14,48);F.rotateX(-Math.PI/2),F.translate(N+n.ux*2,n.poolLevel+.06,P+n.uz*2);let I=new e({uniforms:{...X(),uTime:M.uTime,tNoise:{value:r},uC:{value:new g(N+n.ux*2,P+n.uz*2)},uNight:M.uNight},transparent:!0,depthWrite:!1,fog:!0,vertexShader:`
      ${J}
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,fragmentShader:`
      ${Y}
      uniform float uTime, uNight; uniform vec2 uC; uniform sampler2D tNoise;
      varying vec3 vW;
      void main() {
        vec2 d = vW.xz - uC; float r = length( d );
        // churned water pushed outward from the impact: noise advected radially in two cross-faded
        // phases (bounded offsets, so the pattern never winds up around the centre over time)
        vec2 dir = d / max( r, 0.001 );
        float tf = uTime * 0.4, p0 = fract( tf ), p1 = fract( tf + 0.5 ), bl = abs( 2.0 * p0 - 1.0 );
        vec2 o0 = dir * p0 * 4.0, o1 = dir * p1 * 4.0;
        float n1 = mix( texture( tNoise, ( vW.xz - o0 ) / 5.0 ).g, texture( tNoise, ( vW.xz - o1 ) / 5.0 + 0.5 ).g, bl );
        float n2 = mix( texture( tNoise, ( vW.xz - o0 * 1.6 ) / 2.3 + vec2( 0.37, 0.71 ) ).a, texture( tNoise, ( vW.xz - o1 * 1.6 ) / 2.3 + vec2( 0.11, 0.29 ) ).a, bl );
        float boil = n1 * 0.65 + n2 * 0.5;
        float foam = smoothstep( 0.55, 0.85, boil ) * ( 1.0 - smoothstep( 3.0, 13.0, r + n1 * 3.0 ) );
        foam = max( foam, ( 1.0 - smoothstep( 1.0, 6.5, r + n2 * 2.5 ) ) * 0.8 );
        gl_FragColor = vec4( mix( vec3( 0.95, 0.97, 0.96 ), vec3( 0.3, 0.36, 0.45 ), uNight * 0.7 ), foam * 0.8 );
        #include <fog_fragment>
      }`}),L=new D(F,I);L.renderOrder=3,o.add(L);{let t=[],s=[],c=[];for(let e=0;e<=3;e++)for(let r=0;r<=24;r++){let i=r/24-.5,a=e/3,o=i*(O+5),c=n.landA+1.2-2.2*i*i+a*1.8;t.push(n.lipX+n.ux*c+f*o,n.poolLevel-.3+a*6.5,n.lipZ+n.uz*c+p*o),s.push(i+.5,a)}for(let e=0;e<3;e++)for(let t=0;t<24;t++){let n=e*25+t,r=n+1,i=n+24+1,a=i+1;c.push(n,i,r,r,i,a)}let l=new T;l.setAttribute(`position`,new i(t,3)),l.setAttribute(`uv`,new i(s,2)),l.setIndex(c);let u=new e({uniforms:{...X(),...Q(a),uTime:M.uTime,uNight:M.uNight,uSunColor:M.uSunColor,tNoise:{value:r}},defines:v,transparent:!0,depthWrite:!1,side:2,fog:!0,vertexShader:`
        ${J}
        varying vec2 vUv; varying float vDepth; varying vec3 vW;
        void main() { vUv = uv; vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vec4 mvPosition = viewMatrix * w; vDepth = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,fragmentShader:`
        ${Y}
        ${Z}
        uniform float uTime, uNight; uniform vec3 uSunColor; uniform sampler2D tNoise;
        varying vec2 vUv; varying float vDepth; varying vec3 vW;
        void main() {
          vec2 q = vec2( vUv.x * 3.2, vUv.y * 0.9 - uTime * 0.55 );
          float n = texture( tNoise, q ).r * 0.6 + texture( tNoise, q * 2.1 + vec2( 0.3, -uTime * 0.2 ) ).g * 0.4;
          float body = smoothstep( 0.3, 0.75, n + ( 1.0 - vUv.y ) * 0.35 );
          float a = body * ( 1.0 - smoothstep( 0.25, 1.0, vUv.y ) ) * smoothstep( 0.0, 0.25, vUv.x ) * smoothstep( 1.0, 0.75, vUv.x );
          a *= 0.26 * softFade( vDepth, 1.2 ) * smoothstep( 3.0, 9.0, vDepth );
          vec3 c = mix( vec3( 0.93, 0.96, 0.97 ) * ( 0.7 + 0.3 * uSunColor ), vec3( 0.26, 0.32, 0.42 ), uNight * 0.75 );
          gl_FragColor = vec4( c, a );
          #include <fog_fragment>
        }`}),d=new D(l,u);d.renderOrder=4,d.name=`veilfall-spray`,o.add(d)}let R=l*.62;{let t=new h(9,12,R,20,1,!0);t.translate(N-n.ux*3,n.poolLevel+R*.5-.5,P-n.uz*3);let i=new e({uniforms:{...X(),...Q(a),uTime:M.uTime,uNight:M.uNight,uSunColor:M.uSunColor,tNoise:{value:r},uBase:{value:n.poolLevel},uH:{value:R}},defines:v,transparent:!0,depthWrite:!1,fog:!0,vertexShader:`
        ${J}
        varying vec3 vW; varying vec3 vN; varying float vDepth;
        void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vN = normalize( mat3( modelMatrix ) * normal ); vec4 mvPosition = viewMatrix * w; vDepth = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,fragmentShader:`
        ${Y}
        ${Z}
        uniform float uTime, uNight, uBase, uH; uniform vec3 uSunColor; uniform sampler2D tNoise;
        varying vec3 vW; varying vec3 vN; varying float vDepth;
        void main() {
          vec3 V = normalize( cameraPosition - vW );
          float thick = pow( abs( dot( normalize( vN ), V ) ), 1.5 );
          float h = ( vW.y - uBase ) / uH;
          // (two noise tiles per turn around the column: seamless where atan wraps)
          float n = texture( tNoise, vec2( atan( vN.z, vN.x ) * 0.31831, vW.y * 0.035 - uTime * 0.03 ) ).b;
          float a = thick * ( 1.0 - smoothstep( 0.2, 1.0, h ) ) * smoothstep( 0.0, 0.06, h ) * ( 0.5 + 0.5 * n ) * 0.1;
          a *= softFade( vDepth, 4.0 ) * smoothstep( 4.0, 14.0, vDepth );
          vec3 c = mix( vec3( 0.9, 0.94, 0.96 ) * ( 0.7 + 0.3 * uSunColor ), vec3( 0.24, 0.3, 0.4 ), uNight * 0.75 );
          gl_FragColor = vec4( c, a );
          #include <fog_fragment>
        }`}),s=new D(t,i);s.renderOrder=4,s.name=`veilfall-haze`,o.add(s)}let z=ue(r,a,60,(e,t)=>{if(e<10)return{x:s+f*t(-6,6)+n.ux*t(0,2),y:n.lipY+t(-2,.5),z:c+p*t(-6,6)+n.uz*t(0,2),size:t(4,7),rise:t(.5,1.5),drift:t(1,3),alpha:t(.1,.15)};if(e<26){let e=t(.08,.5)*l;return{x:N-n.ux*t(2,6)+f*t(-10,10),y:n.poolLevel+e,z:P-n.uz*t(2,6)+p*t(-10,10),size:t(11,19),rise:t(6,12),drift:t(.5,2.5),alpha:t(.07,.11)}}return{x:N+f*t(-10,10)+n.ux*t(-2,5),y:n.poolLevel+t(.5,3.5),z:P+p*t(-10,10)+n.uz*t(-2,5),size:t(15,28),rise:t(3,8),drift:t(8,16),alpha:t(.1,.17)}},()=>[n.ux,n.uz],.05);return z.renderOrder=4,o.add(z),o}function le(e,t,n,r){if(!e.length)return null;let i=e.length,a=ue(t,n,i*r,(t,n)=>{let r=e[t%i];return{x:r.x+n(-r.w,r.w)*.35,y:r.y+n(0,.3),z:r.z+n(-r.w,r.w)*.35,size:n(.9,1.8),rise:n(.4,1.1),drift:n(.5,1.5),alpha:n(.09,.14)}},t=>{let n=e[t%i];return[n.dx,n.dz]},.12);return a.renderOrder=4,a}function ue(t,n,i,o,s,l){let u=1234567,d=(e,t)=>(u=u*16807%2147483647,e+(t-e)*(u/2147483647)),f=new r(1,1),m=new a;m.index=f.index,m.setAttribute(`position`,f.getAttribute(`position`)),m.setAttribute(`uv`,f.getAttribute(`uv`));let h=new Float32Array(i*4),g=new Float32Array(i*4),_=new Float32Array(i*4),v=new y,b=new E;for(let e=0;e<i;e++){let t=o(e,d);h.set([t.x,t.y,t.z,t.size],e*4),g.set([t.rise,d(0,1),t.alpha,d(0,1)],e*4);let n=s(e);_.set([n[0]*t.drift,n[1]*t.drift,d(.8,1.25),d(0,6.28)],e*4);let r=t.size*1.4+4;v.expandByPoint(b.set(t.x-r,t.y-r,t.z-r)).expandByPoint(b.set(t.x+r,t.y+r,t.z+r)),v.expandByPoint(b.set(t.x+n[0]*t.drift,t.y+t.rise+r,t.z+n[1]*t.drift))}m.boundingSphere=v.getBoundingSphere(new c),m.boundingSphere.radius+=3,m.setAttribute(`aOff`,new p(h,4)),m.setAttribute(`aPrm`,new p(g,4)),m.setAttribute(`aDrift`,new p(_,4)),m.instanceCount=i;let x=new e({uniforms:{...X(),...Q(n),uTime:M.uTime,uNight:M.uNight,uSunColor:M.uSunColor,uWind:M.uWind,tNoise:{value:t},uSpeed:{value:l}},defines:n?{SOFT_DEPTH:``}:{},transparent:!0,depthWrite:!1,fog:!0,vertexShader:`
      ${J}
      attribute vec4 aOff; attribute vec4 aPrm; attribute vec4 aDrift;
      uniform float uTime, uSpeed; uniform vec2 uWind;
      varying vec2 vUv; varying float vA; varying float vSeed; varying float vDepth; varying float vSize;
      void main() {
        float life = fract( uTime * uSpeed * aDrift.z + aPrm.y );
        vec2 wind = uWind * 0.35 * life;
        vec3 c = aOff.xyz + vec3( aDrift.x * life + wind.x + sin( uTime * 0.3 + aDrift.w ) * 0.6, aPrm.x * life, aDrift.y * life + wind.y + cos( uTime * 0.27 + aDrift.w ) * 0.6 );
        float size = aOff.w * ( 0.65 + life * 0.7 );
        vec4 mvPosition = viewMatrix * vec4( c, 1.0 );
        vDepth = -mvPosition.z;
        // big puffs right in front of the lens read as smudges: fade them out close up
        float near = smoothstep( 1.5 + size * 0.6, 4.0 + size * 1.6, vDepth );
        // spin the quad slowly so the noise never looks pasted on
        float ang = aDrift.w + uTime * 0.05 * ( aPrm.w - 0.5 );
        vec2 q = mat2( cos( ang ), sin( ang ), -sin( ang ), cos( ang ) ) * position.xy;
        mvPosition.xy += q * size;
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv; vSeed = aPrm.w; vSize = size;
        vA = aPrm.z * near * smoothstep( 0.0, 0.25, life ) * ( 1.0 - smoothstep( 0.55, 1.0, life ) );
        // a faded puff (right at the lens, or between two lives) is dropped before it costs any fill
        if ( vA < 0.002 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
        #include <fog_vertex>
      }`,fragmentShader:`
      ${Y}
      ${Z}
      uniform float uNight, uTime; uniform vec3 uSunColor; uniform sampler2D tNoise;
      varying vec2 vUv; varying float vA; varying float vSeed; varying float vDepth; varying float vSize;
      void main() {
        vec2 q = vUv - 0.5;
        float r = length( q ) * 2.0;
        vec2 o = vec2( vSeed * 7.31, vSeed * 3.17 );
        float n = texture( tNoise, vUv * 0.45 + o + vec2( 0.0, uTime * 0.012 ) ).r * 0.62 + texture( tNoise, vUv * 1.15 + o * 1.7 - uTime * 0.01 ).g * 0.38;
        float shape = 1.0 - smoothstep( 0.2, 1.0, r + ( n - 0.5 ) * 0.95 );
        float a = shape * shape * ( 0.45 + 0.55 * n ) * vA;
        a *= softFade( vDepth, max( 0.8, vSize * 0.35 ) );
        vec3 c = mix( vec3( 0.93, 0.96, 0.97 ) * ( 0.72 + 0.28 * uSunColor ), vec3( 0.25, 0.3, 0.4 ), uNight * 0.75 );
        gl_FragColor = vec4( c, a );
        #include <fog_fragment>
      }`});return new D(m,x)}var de=`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fe=`
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = vec4( texture2D( tSrc, vUv ).rgb, 1.0 ); }`,pe=class{screen;pending=!1;grabs=0;rt=null;quad;cam=new d(-1,1,1,-1,0,1);mat;constructor(t){this.screen={tSSRColor:{value:null},uSSROn:{value:0},tSceneDepth:t.tSceneDepth,uSceneDepthRes:t.uSceneDepthRes},this.mat=new e({name:`water-ssr-copy`,vertexShader:de,fragmentShader:fe,uniforms:{tSrc:{value:null}},depthTest:!1,depthWrite:!1,blending:0,toneMapped:!1,fog:!1});let n=new T;n.setAttribute(`position`,new i([-1,-1,0,3,-1,0,-1,3,0],3)),this.quad=new D(n,this.mat),this.quad.frustumCulled=!1}async prewarm(e){let t=e.getRenderTarget(),n=new b(4,4,{type:f,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1});e.setRenderTarget(n);let r;try{r=e.compileAsync(this.quad,this.cam)}finally{e.setRenderTarget(t)}try{await r}finally{n.dispose()}}beginFrame(){this.pending=!0,this.screen.uSSROn.value=0}grab(e){if(!this.pending)return;let t=e.getRenderTarget(),n=this.screen.uSceneDepthRes.value;if(!t||t.samples>0||!this.screen.tSceneDepth.value||t.width!==n.x||t.height!==n.y)return;let r=Math.ceil(t.width/2),i=Math.ceil(t.height/2);this.pending=!1,(!this.rt||this.rt.width!==r||this.rt.height!==i)&&(this.rt?.dispose(),this.rt=new b(r,i,{type:f,format:u,minFilter:S,magFilter:S,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1}),this.rt.texture.name=`water.sceneColorHalf`),this.mat.uniforms.tSrc.value=t.texture,e.setRenderTarget(this.rt),e.render(this.quad,this.cam),e.setRenderTarget(t),this.screen.tSSRColor.value=this.rt.texture,this.screen.uSSROn.value=1,this.grabs++}};function me(e){let t=function(){this.array=null};for(let n of Object.values(e.attributes))n.onUpload(t);e.index?.onUpload(t)}var $={low:{sea:56,spray:1},medium:{sea:84,spray:2},high:{sea:110,spray:3}};function he(e){let r=L.data,i=L.textures;if(!r||!i||!L.heightHalf)return console.warn(`[water] terrain data unavailable; no water surfaces`),N();let a=new t;a.name=`water`;let o=e.settings.quality??`medium`,c=e.render?.sceneDepth,d=c?.tSceneDepth&&c.uSceneDepthRes?{tSceneDepth:c.tSceneDepth,uSceneDepthRes:c.uSceneDepthRes}:null,f=new n(r.wave,256,256,u,l);f.wrapS=f.wrapT=O,f.magFilter=S,f.minFilter=w,f.generateMipmaps=!0,f.anisotropy=8,f.needsUpdate=!0;let p=new Float32Array(P);p.set(r.prep.coastZ);let h=new n(p,P,1,k,s);h.magFilter=h.minFilter=m,h.needsUpdate=!0;let _={height:L.heightHalf,wave:f,coast:h},v=new pe(d??{tSceneDepth:{value:null},uSceneDepthRes:{value:new g(1,1)}}),y=e.render?.renderer,b=y&&d?()=>v.grab(y):null,x=oe(_,`inland`,v.screen,o),C=0,T=0,A=e.terrain,M=A.caveBounds,I=[];for(let e of te(r)){let t=new D(e,x.material);t.name=`water-inland`,t.receiveShadow=!0,t.renderOrder=1,t.matrixAutoUpdate=!1,b&&(t.onBeforeRender=b),C+=(e.index?.count??0)/3,T++;let n=e.boundingBox;(!M||n.min.x>M[2]||n.min.z>M[3]||n.max.x<M[0]||n.max.z<M[1])&&I.push(t),me(e),a.add(t)}let R=oe(_,`sea`,v.screen,o),z=new D(ne($[o].sea),R.material);z.name=`water-sea`,z.frustumCulled=!1,z.receiveShadow=!0,z.renderOrder=1;let B=!1;b&&(z.onBeforeRender=()=>{B&&b()}),a.add(z),I.push(z);let ee=R.uniforms.uSeaOrigin.value,V=R.uniforms.uCamXZ.value,H=ce(r.prep.veil,i.noise,d);a.add(H),I.push(H);let U=[];for(let e of r.prep.reaches){let t=e.curve,n=e.level,r=e=>{let r=Math.max(0,e-1),i=Math.min(t.n-1,e+1);return(n[r]-n[i])/Math.max(.5,t.s[i]-t.s[r])},i=-1e9;for(let a=1;a<t.n-1;a++){let o=r(a);o<.09||o<r(a-1)||o<r(a+1)||t.s[a]-i<6||(i=t.s[a],U.push({x:t.x[a],y:n[Math.min(t.n-1,a+1)],z:t.z[a],w:e.width[a],dx:t.tx[a],dz:t.tz[a]}))}}let W=le(U,i.noise,d,$.high.spray);W&&(a.add(W),I.push(W));let G=e=>{W&&(W.geometry.instanceCount=U.length*$[e].spray)};G(o),F(a),e.scene.add(a),e.events.on(`settings:changed`,()=>{let t=e.settings.quality??`medium`;if(t===o)return;let n=$[t].sea!==$[o].sea;o=t,x.setQuality(t),R.setQuality(t),G(t),n&&(z.geometry.dispose(),z.geometry=ne($[t].sea))});let re=[x.uniforms.uReflBoost,R.uniforms.uReflBoost],K=!1,q=new E;return{order:j.water,group:a,lateUpdate(){q.setFromMatrixPosition(e.camera.matrixWorld),ee.set(Math.round(q.x/3)*3,Math.round(q.z/3)*3),V.set(q.x,q.y,q.z);let t=Math.min(P-1,Math.max(0,Math.round((q.x+1024)/2)));B=p[t]-q.z<420,o!==`low`&&v.beginFrame();let n=2.5-1*e.uniforms.uNight.value;for(let e of re)e.value=n;let r=A.cameraInCave?.()??!1;if(r!==K){K=r;for(let e of I)e.visible=!r}},prewarm:()=>y?v.prewarm(y):void 0,debugStats:()=>({quality:o,inlandTiles:T,inlandTris:C,cascades:U.length,seaRings:$[o].sea,softMist:!!d,ssrGrabs:v.grabs,ssrOn:v.screen.uSSROn.value,underground:K})}}export{he as default};