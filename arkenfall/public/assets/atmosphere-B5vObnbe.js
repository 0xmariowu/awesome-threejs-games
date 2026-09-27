import{An as e,C as t,F as n,G as r,Rt as i,V as a,W as o,er as s,m as c,nr as l,nt as u,tr as d,ut as f,w as ee,xn as p}from"./three.core-_y2F91K_.js";import{t as m}from"./contracts-CvM_HOZo.js";import{T as h,U as te}from"./Game-BmRmdldn.js";import{c as g,i as ne,s as _,u as v}from"./fog-BB9IhazH.js";var y={MOTE:0,FIREFLY:1,LEAF:2,MIST:3,CAVEDUST:4,SPORE:5,SNOW:6,SPRAY:7,THREAD:8,RAIN:9,SPLASH:10},re=`
#define NK 11
attribute vec4 aSeed;
attribute float aKind;
uniform float uTime;
uniform float uAmt[ NK ];
uniform vec2 uWind;
uniform sampler2D tGround;   // toroidal: texel (i, j) = world cell (cx, cz) with i = cx mod size
uniform float uGroundScale; // 1 / extent (m)
uniform vec4 uKnot;      // knot position, amount
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform float uPxScale;  // pixels per metre at 1 m view depth
uniform float uCanopy;   // 0..1 dimming of direct light under forest canopy

varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;      // kind, shape seed, glow, view depth
varying vec3 vWorld;

vec2 groundSample( vec2 xz ) { return textureLod( tGround, xz * uGroundScale, 0.0 ).rg; }
vec2 wrapXZ( vec2 seed01, float R, vec2 drift ) {
	vec2 p = seed01 * 2.0 * R + drift;
	vec2 rel = mod( p - cameraPosition.xz + R, 2.0 * R ) - R;
	return cameraPosition.xz + rel;
}
float h11( float n ) { return fract( sin( n * 127.1 ) * 43758.5453 ); }

void main() {
	int kind = int( aKind + 0.5 );
	vec4 s = aSeed;
	float amt = uAmt[ kind ];
	float live = clamp( ( amt - s.w ) * 14.0, 0.0, 1.0 );
	vUv = position.xy + 0.5;
	if ( live <= 0.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }

	vec3 r3 = fract( s.xyz * 17.371 + s.w * 3.117 );
	float t = uTime;
	vec3 P = vec3( 0.0 );
	float size = 0.05;
	int mode = 0;               // 0 billboard, 1 axis-aligned billboard, 2 free quad
	vec3 axis = vec3( 0.0, 1.0, 0.0 );
	vec3 U = vec3( 1.0, 0.0, 0.0 ), V = vec3( 0.0, 1.0, 0.0 );
	float stretch = 1.0;
	vec3 col = vec3( 1.0 );
	float alpha = 1.0;
	float glow = 0.0;
	float R = 20.0;
	float nearFade = 0.4;

	if ( kind == 0 ) { // sunlit dust / pollen motes
		R = 26.0;
		vec2 wander = 3.0 * vec2( sin( t * 0.13 + s.z * 6.28 ), cos( t * 0.11 + s.x * 6.28 ) );
		P.xz = wrapXZ( s.xy, R, uWind * t * 0.55 + wander );
		vec2 g = groundSample( P.xz );
		P.y = max( g.x, g.y ) + 0.4 + s.z * 7.5 + sin( t * 0.4 + s.x * 20.0 ) * 0.4;
		size = 0.03 + 0.035 * r3.x;
		float mu = max( dot( normalize( P - cameraPosition ), uSunDir ), 0.0 );
		col = uSunCol * ( 0.05 + 1.6 * pow( mu, 7.0 ) ) * ( 1.0 - uCanopy * 0.5 ) + uAmb * 0.04;
		col *= mix( vec3( 1.0, 0.92, 0.72 ), vec3( 1.0 ), r3.y );
		alpha = 0.7;
		nearFade = 1.4; // close motes would read as dust on the lens
		glow = 1.0;
	} else if ( kind == 1 ) { // fireflies
		R = 38.0;
		P.xz = wrapXZ( s.xy, R, vec2( 0.0 ) ) + vec2( sin( t * 0.37 * ( 0.6 + s.z ) + s.x * 40.0 ), cos( t * 0.29 * ( 0.6 + s.w ) + s.y * 40.0 ) ) * 2.2;
		vec2 g = groundSample( P.xz );
		P.y = max( g.x, g.y + 0.25 ) + 0.35 + s.z * 2.3 + sin( t * 0.8 + s.w * 30.0 ) * 0.35;
		float blink = pow( max( 0.0, sin( t * ( 0.55 + r3.x * 0.7 ) * 3.14159 + r3.y * 50.0 ) ), 5.0 );
		col = mix( vec3( 0.7, 1.0, 0.32 ), vec3( 1.0, 0.82, 0.3 ), r3.z ) * ( 5.5 * blink + 0.3 );
		size = 0.24;
		glow = 1.0;
		nearFade = 0.8;
	} else if ( kind == 2 ) { // falling leaves
		R = 30.0;
		float T = 9.0 + 6.0 * r3.x;
		float ph = fract( t / T + s.z );
		float tt = ph * T;
		vec2 base = wrapXZ( s.xy, R, vec2( 0.0 ) );
		vec2 g = groundSample( base );
		float top = g.x + 6.0 + 12.0 * s.w;
		float land = smoothstep( 0.0, 0.84, ph );
		P.xz = base + uWind * land * T * 0.6 + vec2( sin( tt * 1.7 + s.x * 9.0 ), cos( tt * 1.3 + s.y * 7.0 ) ) * 0.9 * ( 1.0 - step( 0.84, ph ) );
		float gl = groundSample( P.xz ).x;
		P.y = mix( top, gl + 0.04, land );
		alpha = smoothstep( 0.0, 0.05, ph ) * ( 1.0 - smoothstep( 0.93, 1.0, ph ) );
		float yaw = s.x * 6.28 + tt * 0.6 * ( 1.0 - land * 0.9 );
		float flut = ph < 0.84 ? sin( tt * 2.2 + s.y * 10.0 ) * 1.2 : 0.0;
		float pitch = ph < 0.84 ? tt * ( 1.1 + r3.y ) : 1.5708;
		vec3 f = vec3( cos( yaw ), 0.0, sin( yaw ) );
		vec3 up = vec3( 0.0, 1.0, 0.0 );
		vec3 sd = cross( up, f );
		U = f * cos( flut ) + up * sin( flut );
		V = sd * cos( pitch ) + cross( U, sd ) * sin( pitch );
		mode = 2;
		size = 0.13 + 0.07 * r3.z;
		vec3 leafCol = r3.z < 0.4 ? vec3( 0.33, 0.42, 0.12 ) : r3.z < 0.75 ? vec3( 0.62, 0.46, 0.12 ) : vec3( 0.55, 0.22, 0.08 );
		vec3 N = normalize( cross( U, V ) );
		float ndl = abs( dot( N, uSunDir ) );
		col = leafCol * ( uAmb * 0.55 + uSunCol * ( 0.25 + 0.45 * ndl ) * ( 1.0 - uCanopy * 0.6 ) );
		nearFade = 0.3;
	} else if ( kind == 3 ) { // fen / valley mist sheets
		R = 70.0;
		P.xz = wrapXZ( s.xy, R, uWind * t * 0.35 );
		vec2 g = groundSample( P.xz );
		P.y = max( g.x, g.y ) + 0.7 + s.z * 1.6;
		size = 10.0 + 10.0 * r3.x;
		stretch = 0.42; // wide, low banks rather than puffs
		alpha = 0.22 * ( 0.6 + 0.4 * r3.y );
		col = uAmb * 0.8 + uSunCol * 0.08;
		nearFade = 14.0;
	} else if ( kind == 4 ) { // cave dust
		R = 18.0;
		P.xz = wrapXZ( s.xy, R, vec2( sin( t * 0.05 + s.z * 6.0 ), cos( t * 0.04 + s.x * 6.0 ) ) * 1.5 );
		P.y = groundSample( P.xz ).x + 0.3 + s.z * 9.0 + sin( t * 0.2 + s.w * 20.0 ) * 0.3;
		size = 0.02 + 0.02 * r3.x;
		col = uAmb * 0.9 + vec3( 0.04, 0.07, 0.08 );
		alpha = 0.55;
		glow = 1.0;
	} else if ( kind == 5 ) { // glowing spores (Hollow Deep)
		R = 22.0;
		float ph = fract( t * 0.028 * ( 0.5 + r3.x ) + s.z );
		P.xz = wrapXZ( s.xy, R, vec2( sin( t * 0.07 + s.w * 6.0 ), cos( t * 0.05 + s.y * 6.0 ) ) * 2.0 );
		P.y = groundSample( P.xz ).x + 0.2 + ph * 11.0;
		size = 0.07 + 0.05 * r3.y;
		col = mix( vec3( 0.28, 1.0, 0.82 ), vec3( 0.5, 0.72, 1.0 ), r3.z ) * ( 1.6 + 1.1 * sin( t * 1.3 + s.w * 20.0 ) );
		alpha = smoothstep( 0.0, 0.1, ph ) * ( 1.0 - smoothstep( 0.75, 1.0, ph ) );
		glow = 1.0;
	} else if ( kind == 6 ) { // snow flurries
		R = 24.0;
		float spd = 0.9 + 0.5 * r3.x;
		float ph = fract( t * spd / 16.0 + s.z );
		vec2 swirl = vec2( sin( t * 0.9 + s.x * 30.0 ), cos( t * 0.7 + s.y * 30.0 ) ) * 0.6;
		P.xz = wrapXZ( s.xy, R, uWind * t * 1.1 + swirl );
		P.y = cameraPosition.y + 9.0 - ph * 16.0;
		float g = groundSample( P.xz ).x;
		alpha = smoothstep( g, g + 0.6, P.y ) * smoothstep( 0.0, 0.08, ph );
		size = 0.07 + 0.05 * r3.y;
		col = vec3( 0.95, 0.97, 1.0 ) * ( uAmb * 1.4 + uSunCol * 0.35 + 0.04 );
		alpha *= 0.9;
		glow = 0.35; // part additive: flakes stay bright against an overcast sky
		nearFade = 1.2; // no out-of-focus discs on the lens
	} else if ( kind == 7 ) { // sea spray (only over water)
		R = 36.0;
		// bursts arrive in sets like breaking waves rolling along the shore
		float T = 2.6 + 1.6 * r3.x;
		float cyc = t / T + s.z;
		float ph = fract( cyc );
		vec2 base = wrapXZ( s.xy, R, vec2( 0.0 ) );
		vec2 g = groundSample( base );
		float water = g.y;
		// only the surf zone: water over a shallow bed (breaking waves), not the open sea
		if ( water < -500.0 || g.x < water - 1.4 || g.x > water + 0.2 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
		float waveSet = pow( max( 0.0, sin( floor( cyc ) * 1.7 + ( base.x + base.y ) * 0.045 + t * 0.21 ) ), 2.0 );
		P.xz = base + uWind * ph * T * 0.9;
		P.y = water + 0.15 + ph * ( 2.2 + 1.6 * waveSet );
		size = 0.7 + ( 1.6 + 1.4 * waveSet ) * ph;
		alpha = min( 1.0, ( 0.2 + 0.3 * waveSet ) * smoothstep( 0.0, 0.12, ph ) * ( 1.0 - ph ) * ( 1.0 - ph ) * 2.2 );
		col = uAmb * 1.2 + uSunCol * 0.5;
		nearFade = 1.5;
	} else if ( kind == 8 ) { // loose threads drifting around a frayed knot
		vec3 base = uKnot.xyz + vec3( ( s.x - 0.5 ) * 44.0, 0.0, ( s.y - 0.5 ) * 44.0 );
		float ph = fract( t * 0.045 * ( 0.6 + r3.x ) + s.z );
		base.y = groundSample( base.xz ).x;
		P = base + vec3( sin( t * 0.3 + s.w * 9.0 ) * 2.0, 0.6 + ph * 9.0, cos( t * 0.27 + s.x * 9.0 ) * 2.0 );
		axis = normalize( vec3( sin( t * 0.9 + s.x * 20.0 ), 0.7 + 0.3 * sin( t * 0.5 + s.y * 11.0 ), cos( t * 0.7 + s.w * 13.0 ) ) );
		mode = 1;
		size = 0.34;
		stretch = 4.0 + 3.0 * r3.y;
		col = mix( vec3( 1.0, 0.66, 0.26 ), vec3( 0.5, 0.24, 1.0 ), r3.z ) * 2.4;
		alpha = sin( 3.14159 * ph ) * uKnot.w;
		glow = 1.0;
		R = 80.0;
	} else if ( kind == 9 ) { // rain streaks: half of them packed within 8 m of the camera
		bool nearDrop = r3.x < 0.5;
		R = nearDrop ? 8.0 : 20.0;
		float H = nearDrop ? 14.0 : 22.0;
		float ph = fract( t * 11.0 / H + s.z );
		P.xz = wrapXZ( s.xy, R, vec2( 0.0 ) ) - uWind * ( ph * H / 11.0 ) * 0.8;
		P.y = cameraPosition.y + H * 0.5 - ph * H;
		vec2 g = groundSample( P.xz );
		alpha = step( max( g.x, g.y ), P.y ) * 0.5;
		axis = normalize( vec3( -uWind.x * 0.8, -11.0, -uWind.y * 0.8 ) );
		mode = 1;
		size = 0.022;
		stretch = 30.0 + 22.0 * r3.y;
		// drops light up against the bright haze and when backlit by the sun
		float back = pow( max( dot( normalize( P - cameraPosition ), uSunDir ), 0.0 ), 4.0 );
		col = uAmb * 1.9 + uSunCol * ( 0.18 + 0.9 * back ) + vec3( 0.04 );
		glow = 0.3;
		// a streak a metre from the lens would be a finger-thick white stick: they fade in beyond ~2 m
		nearFade = 3.0;
	} else { // rain splashes (horizontal rings where drops land)
		R = 11.0;
		float cyc = t / ( 0.36 + 0.18 * r3.x ) + s.z * 7.0;
		float n = floor( cyc );
		float ph = fract( cyc );
		vec2 rp = vec2( h11( n + s.x * 91.7 ), h11( n * 1.37 + s.y * 53.1 ) );
		P.xz = cameraPosition.xz + ( rp - 0.5 ) * 2.0 * R;
		vec2 g = groundSample( P.xz );
		P.y = max( g.x, g.y ) + 0.03;
		mode = 2;
		U = vec3( 1.0, 0.0, 0.0 );
		V = vec3( 0.0, 0.0, 1.0 );
		size = 0.07 + 0.26 * ph;
		alpha = 0.7 * ( 1.0 - ph ) * ( 1.0 - ph );
		col = uAmb * 1.5 + uSunCol * 0.2 + vec3( 0.03 );
		glow = 0.25;
	}

	// fade at the edge of the wrap volume and right in front of the lens
	float hd = length( P.xz - cameraPosition.xz );
	alpha *= live * ( 1.0 - smoothstep( 0.72 * R, R, hd ) );
	vec4 mv = viewMatrix * vec4( P, 1.0 );
	float vz = -mv.z;
	alpha *= smoothstep( nearFade * 0.5, nearFade, vz );
	if ( alpha <= 0.002 || vz <= 0.05 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }

	// keep sub-pixel particles from sparkling: grow to >= 1.3 px, dim to conserve energy
	// (streak / thread length stays physical, so those only lose width: linear, not quadratic)
	float len = size * stretch;
	float px = size * uPxScale / vz;
	if ( px < 1.3 ) { float k = px / 1.3; alpha *= mode == 1 ? k : k * k; size = 1.3 * vz / uPxScale; }

	vec2 c = position.xy;
	if ( mode == 0 ) {
		mv.xy += c * size * ( stretch < 1.0 ? vec2( 1.0, stretch ) : vec2( 1.0 ) );
	} else if ( mode == 1 ) {
		vec3 side = cross( axis, normalize( P - cameraPosition ) );
		side = dot( side, side ) > 1e-8 ? normalize( side ) : vec3( 1.0, 0.0, 0.0 ); // looking straight along the axis
		vec3 wp = P + side * c.x * size + axis * c.y * len;
		mv = viewMatrix * vec4( wp, 1.0 );
	} else {
		mv = viewMatrix * vec4( P + ( U * c.x + V * c.y ) * size, 1.0 );
	}
	gl_Position = projectionMatrix * mv;
	vWorld = ( vec4( mv.xyz, 0.0 ) * viewMatrix ).xyz + cameraPosition;
	vCol = vec4( col, alpha );
	vInfo = vec4( float( kind ), fract( s.x * 7.13 + s.y * 3.7 ), glow, -mv.z );
}
`,b=`
${g}
${v}
${_}
#ifdef SOFT
uniform sampler2D tSceneDepth;
uniform vec2 uSceneDepthRes;
#endif
uniform float uTime;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;
varying vec3 vWorld;

void main() {
	int kind = int( vInfo.x + 0.5 );
	vec2 q = vUv * 2.0 - 1.0;
	float r = length( q );
	float a = 0.0;
	vec3 col = vCol.rgb;
	if ( kind == 1 || kind == 5 ) {              // glowing point: hot core + halo
		float core = exp( -r * r * 34.0 );
		float halo = exp( -r * r * 6.0 ) * 0.2;
		a = core + halo;
		col *= mix( vec3( 1.0 ), vec3( 1.0, 1.0, 0.9 ), core );
	} else if ( kind == 2 ) {                    // leaf: pointed ellipse with a midrib
		float w = 0.5 * pow( max( 1.0 - q.y * q.y, 0.0 ), 0.7 );
		a = smoothstep( 0.0, 0.1, w - abs( q.x ) );
		col *= 1.0 - 0.3 * exp( -q.x * q.x * 300.0 );
	} else if ( kind == 3 || kind == 7 ) {       // soft cloudy blob
		float n = mdrVNoise( vUv * 3.2 + vInfo.y * 37.0 + uTime * 0.03 ) * 0.65 + mdrVNoise( vUv * 7.1 - vInfo.y * 11.0 ) * 0.35;
		// wisps, not cards: a soft falloff eroded by the noise, strongest in the middle
		a = pow( smoothstep( 1.0, 0.0, r ), 1.6 ) * smoothstep( 0.22, 0.85, n );
	} else if ( kind == 8 ) {                    // curling thread
		float y = vUv.y;
		float cx = 0.55 * sin( y * 7.0 + vInfo.y * 6.28 + uTime * 1.3 ) * sin( 3.14159 * y );
		float d = q.x - cx;
		float fray = q.x - cx * 0.5 - 0.45 * smoothstep( 0.5, 1.0, y );
		a = ( exp( -d * d * 160.0 ) + 0.6 * exp( -fray * fray * 260.0 ) * smoothstep( 0.45, 0.7, y ) ) * sin( 3.14159 * y );
	} else if ( kind == 9 ) {                    // rain streak
		a = exp( -q.x * q.x * 5.0 ) * smoothstep( -1.0, -0.2, q.y ) * smoothstep( 1.0, 0.4, q.y );
	} else if ( kind == 10 ) {                   // splash ring
		a = exp( -pow( ( r - 0.7 ) / 0.16, 2.0 ) ) * step( r, 1.0 );
	} else {                                     // soft round mote / flake / dust
		a = exp( -r * r * 3.5 ) * step( r, 1.0 );
	}
	a *= vCol.a;
	// soft against scene depth
#ifdef SOFT
	float sceneZ = texture2D( tSceneDepth, gl_FragCoord.xy / uSceneDepthRes ).r;
	float softRange = kind == 3 ? 4.0 : kind == 7 ? 1.5 : 0.25;
	a *= clamp( ( sceneZ - vInfo.w ) / softRange, 0.0, 1.0 );
#endif
	if ( a < 0.003 ) discard;
	if ( kind == 3 ) col = mix( col, mdrFogInscatter( normalize( vWorld - cameraPosition ) ), 0.35 ); // mist leans toward the haze
	vec3 fogged = mdrApplyFog( col, vWorld );
	vec3 ins = mdrApplyFog( vec3( 0.0 ), vWorld );
	float glow = vInfo.z;
	col = mix( fogged, fogged - ins, glow ); // glows fade into the haze instead of tinting toward it
	gl_FragColor = vec4( col * a, a * ( 1.0 - glow ) );
}
`,x={MOTE:800,FIREFLY:300,LEAF:280,MIST:44,CAVEDUST:520,SPORE:220,SNOW:1100,SPRAY:190,THREAD:56,RAIN:2200,SPLASH:480},S={hearthmoor:{mote:1,firefly:.45,leaf:.12,mist:.15,mistBase:0,spray:0,snow:0,canopy:0},kettleford:{mote:.8,firefly:.3,leaf:.1,mist:.1,mistBase:0,spray:0,snow:0,canopy:0},hand:{mote:.9,firefly:.5,leaf:.3,mist:.1,mistBase:0,spray:0,snow:0,canopy:0},weald:{mote:.75,firefly:1,leaf:1,mist:.25,mistBase:0,spray:0,snow:0,canopy:1},fen:{mote:.4,firefly:1,leaf:0,mist:1,mistBase:.55,spray:0,snow:0,canopy:0},chorusmere:{mote:.7,firefly:.55,leaf:.05,mist:.35,mistBase:0,spray:0,snow:0,canopy:0},chalkreach:{mote:.5,firefly:.2,leaf:.05,mist:.1,mistBase:0,spray:0,snow:0,canopy:0},heights:{mote:.3,firefly:.05,leaf:0,mist:.05,mistBase:0,spray:0,snow:.45,canopy:0},gorge:{mote:.4,firefly:.1,leaf:0,mist:.2,mistBase:0,spray:0,snow:.2,canopy:0},loomspire:{mote:.2,firefly:0,leaf:0,mist:0,mistBase:0,spray:0,snow:.8,canopy:0},strand:{mote:.5,firefly:.15,leaf:0,mist:.2,mistBase:0,spray:1,snow:0,canopy:0}},C=S.hearthmoor,w=Object.keys(C),T=80,E=3,ie=240,ae=2,D=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function oe(g){let _=g.render,v={low:.45,medium:.8,high:1},oe=()=>v[_.quality??g.settings.quality]??.8,O=Object.keys(y),k=0,A=O.map(e=>x[e]);for(let e of A)k+=e;let j=new Float32Array(k*4),M=new Float32Array(k),N=0,P=49721811,F=()=>{P=P+1831565813>>>0;let e=Math.imul(P^P>>>15,P|1);return e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296};O.forEach((e,t)=>{for(let n=0;n<A[t];n++,N++)j[N*4]=F(),j[N*4+1]=F(),j[N*4+2]=F(),j[N*4+3]=(n+.5)/A[t],M[N]=y[e]});let I=new r;I.setAttribute(`position`,new n([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),I.setIndex([0,1,2,0,2,3]),I.setAttribute(`aSeed`,new o(j,4)),I.setAttribute(`aKind`,new o(M,1)),I.instanceCount=k;let L=new Uint16Array(25600),R=new t(L,T,T,i,a);R.magFilter=u,R.minFilter=u,R.wrapS=R.wrapT=p,R.generateMipmaps=!1,R.needsUpdate=!0;let se=ee.toHalfFloat,ce=e=>(e%T+T)%T,z=(e,t)=>{let n=(e+.5)*E,r=(t+.5)*E,i=g.terrain.waterHeightAt(n,r),a=(ce(t)*T+ce(e))*4;L[a]=se(g.terrain.heightAt(n,r)),L[a+1]=se(i===null?-1e3:i)},B=0,V=0,H=!1,le=(e,t,n)=>{let r=Math.floor(e/E)-T/2,i=Math.floor(t/E)-T/2;if(!(H&&r===B&&i===V)){if(!H||n||Math.abs(r-B)>=T||Math.abs(i-V)>=T){B=r,V=i;for(let e=0;e<T;e++)for(let t=0;t<T;t++)z(B+t,V+e);H=!0}else{let e=Math.max(-2,Math.min(ae,r-B)),t=Math.max(-2,Math.min(ae,i-V));if(e!==0){let t=e>0?B+T:B+e;for(let n=0;n<Math.abs(e);n++)for(let e=0;e<T;e++)z(t+n,V+e);B+=e}if(t!==0){let e=t>0?V+T:V+t;for(let n=0;n<Math.abs(t);n++)for(let t=0;t<T;t++)z(B+t,e+n);V+=t}}R.needsUpdate=!0}},U=_.sceneDepth,W=new Float32Array(11),G={...ne(),uTime:{value:0},uAmt:{value:W},uWind:{value:new s},tGround:{value:R},uGroundScale:{value:1/ie},uKnot:{value:new l(0,-1e3,0,0)},uSunDir:{value:new d(0,1,0)},uSunCol:{value:new c},uAmb:{value:new c},uPxScale:{value:600},uCanopy:{value:0},...U??{}},ue=new e({name:`atmosphere`,vertexShader:re,fragmentShader:b,uniforms:G,defines:U?{SOFT:1}:{},transparent:!0,depthWrite:!1,depthTest:!0,fog:!1,toneMapped:!1,blending:5,blendEquation:100,blendSrc:201,blendDst:205,blendSrcAlpha:201,blendDstAlpha:205,side:2}),K=new f(I,ue);K.name=`atmosphere`,K.frustumCulled=!1,K.matrixAutoUpdate=!1,K.renderOrder=50,(_.overlayScene??g.scene).add(K);let q=new Float32Array(11),J=new Set;g.events.on(`knot:mended`,e=>J.add(e.id));let de=()=>{let e=g.gameplay.mendedKnots;if(e)for(let t=0;t<e.length;t++)J.add(e[t])},Y={...C},X=0,fe=C,Z=-1,Q=1e9,pe=new c,$=new d(1e9,0,0),me=e=>{let t=g.camera,n=t.position,r=g.sky,i=g.sky.nightFactor,a=g.sky.weather.rain,o=r.caveFactor??g.uniforms.uCave.value,s=1-o,c=$.x>1e8||$.distanceToSquared(n)>6400;if($.copy(n),X-=e,X<=0||c){X=.4,fe=S[te(n.x,n.z).id]??C,de(),Z=-1,Q=1e9;for(let e=0;e<h.length;e++){if(J.has(h[e].id))continue;let t=Math.hypot(n.x-h[e].x,n.z-h[e].z);t<Q&&(Q=t,Z=e)}}let l=c?1:1-Math.exp(-e/1.8);for(let e=0;e<w.length;e++){let t=w[e];Y[t]+=(fe[t]-Y[t])*l}let u=1-i,d=1-Math.min(1,a*1.6),f=g.sky.timeOfDay,ee=D(.2,.26,f)*(1-D(.31,.4,f)),p=D(88,105,n.y),m=Math.min(1,(Y.snow+a*.9)*p+Y.snow*.4)*s;q[y.MOTE]=Y.mote*D(0,.5,u)*d*s*.85,q[y.FIREFLY]=Y.firefly*D(.45,.95,i)*d*s,q[y.LEAF]=Y.leaf*s*(.7+.3*u);let ne=Math.max(i,ee,g.sky.weather.fog);q[y.MIST]=Math.min(1,Y.mist*(Y.mistBase+(1-Y.mistBase)*ne))*s*(1-p),q[y.CAVEDUST]=D(.15,.6,o),q[y.SPORE]=D(.3,.8,o),q[y.SNOW]=m,q[y.SPRAY]=Y.spray*s,q[y.THREAD]=Z>=0?1-D(40,95,Q):0,q[y.RAIN]=a*s*(1-p),q[y.SPLASH]=a*s*(1-p);let v=oe();for(let e=0;e<11;e++)e!==y.MIST&&e!==y.THREAD&&(q[e]*=v);let re=c?1:1-Math.exp(-e/1.2);for(let e=0;e<11;e++)W[e]+=(q[e]-W[e])*re;if(Z>=0){let e=h[Z];G.uKnot.value.set(e.x,0,e.z,1)}else G.uKnot.value.w=0;le(n.x,n.z,c),G.uTime.value=g.uniforms.uTime.value,G.uWind.value.copy(g.sky.weather.wind);let b=g.render.sun,x=_.lightDirection??g.sky.sunDirection;G.uSunDir.value.copy(x),G.uSunCol.value.copy(b.color).multiplyScalar(b.intensity);let T=g.render.hemi;G.uAmb.value.copy(T.color).multiplyScalar(T.intensity*.55).add(pe.copy(T.groundColor).multiplyScalar(T.intensity*.25)),G.uCanopy.value=Y.canopy;let E=_.resolution;E&&(G.uPxScale.value=t.projectionMatrix.elements[5]*Math.max(1,E.y)*.5)};return _.addFrameHook?_.addFrameHook(me):g.addSystem({order:m.atmosphere+.5,lateUpdate:me}),{order:m.atmosphere,debugStats(){let e={instances:k};for(let t of O)e[t.toLowerCase()]=+W[y[t]].toFixed(2);return e}}}export{oe as default};