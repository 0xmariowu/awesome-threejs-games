import{C as e,Kn as t,Ln as n,Rt as r,V as i,_ as a,_n as o,ct as s,er as c,kn as l,lt as u,m as d,nr as f,nt as p,rt as m,st as h,tr as g,ut as _,wt as v,xn as y,z as b}from"./three.core-_y2F91K_.js";import{a as x,t as ee}from"./three.module-DGcYoYN8.js";import{a as S}from"./Debug-mAQ8BxhD.js";import{t as C}from"./contracts-CvM_HOZo.js";import{U as te,b as ne}from"./Game-BmRmdldn.js";import{n as w,t as T}from"./rng-R5614gXl.js";import{c as E,i as D,n as O,r as re,s as k,t as A,u as j}from"./fog-BB9IhazH.js";var M={e:-.45,sun:0,sunI:0,zenith:396062,haze:1845834,hazeSun:2636384,hemiSky:2898508,hemiGround:790546,hemiI:.66,density:.55,exposure:2.15,glow:0},ie={e:-.16,sun:0,sunI:0,zenith:659760,haze:2108496,hazeSun:2898532,hemiSky:3161682,hemiGround:921876,hemiI:.64,density:.6,exposure:2.05,glow:0},ae={e:.9,sun:16774114,sunI:3.6,zenith:3501256,haze:12439784,hazeSun:15525074,hemiSky:11323118,hemiGround:6183490,hemiI:.72,density:.9,exposure:.95,glow:0},oe=[M,ie,{e:-.06,sun:0,sunI:0,zenith:1714264,haze:4871296,hazeSun:9730704,hemiSky:5004430,hemiGround:1513247,hemiI:.55,density:.8,exposure:1.62,glow:.35},{e:0,sun:16748104,sunI:1,zenith:3559308,haze:13667930,hazeSun:16754784,hemiSky:10521732,hemiGround:4732454,hemiI:.42,density:1.05,exposure:1.3,glow:1},{e:.07,sun:16753240,sunI:2.7,zenith:4483244,haze:13280388,hazeSun:16758384,hemiSky:10787998,hemiGround:6048818,hemiI:.44,density:1.04,exposure:1.1,glow:.85},{e:.18,sun:16758386,sunI:3.25,zenith:4487368,haze:12240602,hazeSun:16567190,hemiSky:10532056,hemiGround:6049846,hemiI:.52,density:.98,exposure:1.02,glow:.5},{e:.32,sun:16763794,sunI:3.4,zenith:4093132,haze:12176356,hazeSun:16045744,hemiSky:10927844,hemiGround:6050873,hemiI:.63,density:.94,exposure:.98,glow:.22},{e:.48,sun:16769724,sunI:3.5,zenith:3961548,haze:12242406,hazeSun:15719616,hemiSky:11125738,hemiGround:6117182,hemiI:.69,density:.91,exposure:.96,glow:.05},{e:.62,sun:16772826,sunI:3.55,zenith:3829964,haze:12308200,hazeSun:15655628,hemiSky:11191532,hemiGround:6182975,hemiI:.72,density:.9,exposure:.95,glow:0},ae],N=[M,ie,{e:-.075,sun:0,sunI:0,zenith:1581658,haze:5524092,hazeSun:9198204,hemiSky:4870280,hemiGround:1446942,hemiI:.56,density:.8,exposure:1.62,glow:.45},{e:-.02,sun:0,sunI:0,zenith:2896996,haze:10247238,hazeSun:15233082,hemiSky:7103620,hemiGround:2761254,hemiI:.56,density:.95,exposure:1.4,glow:.9},{e:.03,sun:16745536,sunI:2,zenith:4082808,haze:14254654,hazeSun:16752714,hemiSky:11439734,hemiGround:5915184,hemiI:.4,density:1.08,exposure:1.2,glow:1},{e:.1,sun:16752212,sunI:2.95,zenith:4219038,haze:13802086,hazeSun:16754770,hemiSky:11180168,hemiGround:6443054,hemiI:.43,density:1.02,exposure:1.06,glow:.85},{e:.2,sun:16756848,sunI:3.25,zenith:4355270,haze:12892338,hazeSun:16630920,hemiSky:10791620,hemiGround:6048820,hemiI:.51,density:.97,exposure:1.01,glow:.55},{e:.35,sun:16763022,sunI:3.4,zenith:4092618,haze:12110564,hazeSun:16175782,hemiSky:10927844,hemiGround:6181434,hemiI:.64,density:.93,exposure:.97,glow:.25},{e:.48,sun:16769208,sunI:3.45,zenith:3961548,haze:12242406,hazeSun:15785154,hemiSky:11125738,hemiGround:6182206,hemiI:.69,density:.91,exposure:.96,glow:.06},{e:.62,sun:16772306,sunI:3.5,zenith:3829964,haze:12308200,hazeSun:15655114,hemiSky:11191532,hemiGround:6182206,hemiI:.72,density:.9,exposure:.95,glow:0},ae],P=[`sun`,`zenith`,`haze`,`hazeSun`,`hemiSky`,`hemiGround`],F=[`sunI`,`hemiI`,`density`,`exposure`,`glow`],se=class{e;cols;nums;constructor(e){this.e=e.map(e=>e.e);let t=t=>e.map(e=>new d().setHex(t(e)));this.cols={sun:t(e=>e.sun),zenith:t(e=>e.zenith),haze:t(e=>e.haze),hazeSun:t(e=>e.hazeSun),hemiSky:t(e=>e.hemiSky),hemiGround:t(e=>e.hemiGround)},this.nums={sunI:e.map(e=>e.sunI),hemiI:e.map(e=>e.hemiI),density:e.map(e=>e.density),exposure:e.map(e=>e.exposure),glow:e.map(e=>e.glow)}}sample(e,t){let n=this.e,r=0;for(;r<n.length-2&&e>n[r+1];)r++;let i=(e-n[r])/(n[r+1]-n[r]);i=i<0?0:i>1?1:i,i=i*i*(3-2*i);for(let e=0;e<P.length;e++){let n=P[e];t[n].copy(this.cols[n][r]).lerp(this.cols[n][r+1],i)}for(let e=0;e<F.length;e++){let n=F[e];t[n]=this.nums[n][r]+(this.nums[n][r+1]-this.nums[n][r])*i}}},ce=()=>({sun:new d,sunI:0,zenith:new d,haze:new d,hazeSun:new d,hemiSky:new d,hemiGround:new d,hemiI:1,density:1,exposure:1,glow:0}),le=new se(oe),ue=new se(N),I=ce(),L=ce();function R(e){let t=Math.sin((e-.5)*Math.PI*2);return h.clamp(.5+.5*Math.sign(t)*Math.min(1,Math.abs(t)*4),0,1)}function de(e,t,n){let r=R(t);le.sample(e,I),ue.sample(e,L);for(let e=0;e<P.length;e++)n[P[e]].copy(I[P[e]]).lerp(L[P[e]],r);for(let e=0;e<F.length;e++)n[F[e]]=I[F[e]]+(L[F[e]]-I[F[e]])*r;return n}var z=128;function B(e,t,n){let r=z/t;for(let i=0;i<z;i++)for(let a=0;a<z;a++){let o=a/r,s=i/r,c=Math.floor(o),l=Math.floor(s),u=o-c,d=s-l,f=u*u*u*(u*(u*6-15)+10),p=d*d*d*(d*(d*6-15)+10),m=c%t,h=(c+1)%t,g=l%t,_=(l+1)%t,v=w(m,g,n),y=w(h,g,n),b=w(m,_,n),x=w(h,_,n);e[i*z+a]=v+(y-v)*f+(b+(x-b)*f-(v+(y-v)*f))*p}}function V(e,t,n){let r=z/t;for(let i=0;i<z;i++)for(let a=0;a<z;a++){let o=a/r,s=i/r,c=Math.floor(o),l=Math.floor(s),u=9;for(let e=-1;e<=1;e++)for(let r=-1;r<=1;r++){let i=c+r,a=l+e,d=(i%t+t)%t,f=(a%t+t)%t,p=i+w(d,f,n),m=a+w(d,f,n+7),h=Math.hypot(p-o,m-s);h<u&&(u=h)}e[i*z+a]=1-Math.min(1,u)}}var fe=null;function pe(){if(fe)return fe;let n=16384,i=[new Float32Array(n),new Float32Array(n),new Float32Array(n),new Float32Array(n)];B(i[0],16,11),B(i[1],8,23),B(i[2],32,37),V(i[3],8,41);let a=new Uint8Array(n*4);for(let e=0;e<n;e++)for(let t=0;t<4;t++)a[e*4+t]=Math.round(Math.min(1,Math.max(0,i[t][e]))*255);let o=new e(a,z,z,r,t);return o.wrapS=o.wrapT=y,o.magFilter=p,o.minFilter=m,o.generateMipmaps=!0,o.anisotropy=4,o.colorSpace=``,o.needsUpdate=!0,fe=o,o}var me=`
precision highp float;
precision highp int;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
out vec3 vDir;
void main() {
	vDir = position;
	vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	gl_Position = p.xyww; // on the far plane: drawn only where nothing else is
}
`,he=`
precision highp float;
precision highp int;
uniform vec3 cameraPosition;
out highp vec4 mdrSkyColor;
#define gl_FragColor mdrSkyColor
#define texture2D texture
#define varying in
${E}
${j}
${k}

uniform sampler2D uNoise;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uLightDir;    // what lights the clouds (sun, or moon deep at night)
uniform vec3 uSunDisc;     // HDR disc radiance
uniform vec3 uSunGlow;     // aureole colour * intensity
uniform vec3 uSunGlare;    // bright halo just around the disc (feeds the bloom)
uniform vec2 uGold;        // x: broad warm glow around a low sun, y: golden wash above the sun's side
uniform vec3 uMoonGlow;
uniform vec3 uZenith;
uniform vec3 uGround;
uniform vec4 uTwilight;    // x warm-band strength, y belt strength, z sunset (deep amber) strength, w env-capture flag
uniform vec3 uBandWarm;
uniform vec3 uBandRose;
uniform vec4 uNightA;      // night, star strength, weft strength, time
uniform mat3 uStarRot;
uniform vec3 uWeftN[ 3 ];
uniform vec3 uWeftT[ 3 ];
uniform vec3 uWeftFront;   // per ribbon: where along it the weaving has reached (advances through the night)
uniform float uStratus;    // 0..1 grey deck under the cumulus (overcast / rain)
uniform vec4 uAlto;        // altocumulus: cover 0..1, height (m), noise units per metre, edge softness
uniform vec4 uCloudA;      // cover threshold, softness, height, noise units per metre
uniform vec4 uCloudB;      // cirrus height, cirrus scale, cirrus amount, rain darkening
uniform vec4 uCloudOff;    // cumulus offset xy, cirrus offset xy
uniform vec3 uCloudLit;
uniform vec3 uCloudAmb;
uniform vec2 uCirrusDir;   // wind direction (cirrus streak axis)

varying vec3 vDir;

float hash13( vec3 p3 ) {
	p3 = fract( p3 * 0.1031 );
	p3 += dot( p3, p3.zyx + 31.32 );
	return fract( ( p3.x + p3.y ) * p3.z );
}
vec3 hash33( vec3 p3 ) {
	p3 = fract( p3 * vec3( 0.1031, 0.1030, 0.0973 ) );
	p3 += dot( p3, p3.yxz + 33.33 );
	return fract( ( p3.xxy + p3.yxx ) * p3.zyx );
}
float angDist( float mu ) { return sqrt( max( 2.0 * ( 1.0 - mu ), 0.0 ) ); }

vec3 starLayer( vec3 d, float scale, float threshold, float gain ) {
	vec3 p = d * scale;
	vec3 cell = floor( p );
	float h = hash13( cell );
	if ( h < threshold ) return vec3( 0.0 );
	vec3 sp = hash33( cell ) * 0.7 + 0.15;
	vec3 f = p - cell - sp;
	float dist2 = dot( f, f );
	float fw = length( fwidth( p ) ) * 0.55 + 1e-4;
	float r = max( 0.05, fw );
	float b = exp( -dist2 / ( r * r ) ) * min( 1.0, 0.05 / r ) * min( 1.0, 0.05 / r );
	float mag = pow( ( h - threshold ) / ( 1.0 - threshold ), 2.4 ) * gain;
	float tw = 0.72 + 0.28 * sin( uNightA.w * ( 1.3 + h * 4.1 ) + h * 91.7 );
	vec3 tint = mix( vec3( 0.72, 0.84, 1.12 ), vec3( 1.12, 0.96, 0.8 ), fract( h * 37.13 ) );
	return tint * b * mag * tw;
}

float wHash( float n ) { return fract( sin( n * 91.345 + 7.13 ) * 43758.5453 ); }

// A thread across its width: Gaussian of half-width w, widened (and dimmed, conserving energy) by
// the pixel footprint fw, so threads too fine for the screen melt into glow instead of aliasing.
float threadProfile( float x, float w, float fw ) {
	float w2 = w * w + fw * fw * 0.5;
	return exp( -x * x / w2 ) * w / sqrt( w2 );
}

// The Weft: a luminous ribbon of cloth drawn in a long arch across the night sky (each ribbon lies
// on a tilted small circle, so from any heading it reads as an arch or a leaning curve, never as a
// beam standing on the horizon). From afar it is a soft silk-like band, 4–7° wide, that meanders,
// breathes and twists — narrowing and brightening where it turns edge-on — its colour sliding from
// dyed edges to a pale warm core. Close up it is cloth: fine warp fibres run along it (silk sheen),
// a few brighter lead threads carry the dye colours, and sparse, unevenly packed weft threads cross
// them on a slant, riding over or dipping under alternately (plain weave) — but only along the stretch
// already woven. The weaving front creeps along each ribbon through the night with a warm shuttle
// glint riding it; beyond it the warp floats loose and wavy, and toward both ends the threads spread,
// wander and give out one by one.
vec3 weftRibbon( vec3 d, vec3 n, vec3 t, float seed, float span, float front, float bow, vec3 cA, vec3 cB, vec3 cC ) {
	vec3 b = cross( n, t );
	float u = atan( dot( d, b ), dot( d, t ) );        // along the ribbon, 0 at its highest point
	float au = abs( u );
	float ends = smoothstep( span + 0.3, span - 0.4, au );
	if ( ends <= 0.0 ) return vec3( 0.0 );
	float v = asin( clamp( dot( d, n ), -1.0, 1.0 ) ); // across it (rad)
	float T = uNightA.w;
	// meander: slow sways plus a smaller ripple, like cloth moving in a high wind
	v -= bow + 0.042 * sin( u * 1.3 + seed + T * 0.006 ) + 0.018 * sin( u * 3.4 - T * 0.009 + seed * 1.7 );
	float twist = 0.5 + 0.5 * cos( u * 1.7 + T * 0.008 + seed * 1.3 ); // 1 face-on, 0 edge-on
	float hw = ( 0.036 + 0.024 * ( 0.5 + 0.5 * sin( u * 2.1 + seed * 2.0 + T * 0.004 ) ) ) * mix( 0.42, 1.0, twist );
	float s = v / hw;
	if ( abs( s ) > 10.0 ) return vec3( 0.0 );
	float fray = smoothstep( span - 0.85, span + 0.15, au );
	float edgeOn = 1.0 + 0.7 * ( 1.0 - twist );
	// uneven luminosity along the band, like light caught in folds
	float fold = texture2D( uNoise, vec2( u * 0.42 + seed * 0.37, seed * 0.19 + T * 0.0006 ) ).r;
	fold = 0.4 + 1.2 * fold * fold;

	// ---- the glow: pale warm core, dyed edges, wide faint halo; hue drifts along the length ----
	float hue = 0.5 + 0.5 * sin( u * 1.15 + seed * 1.9 + T * 0.002 );
	vec3 dye = mix( cA, cB, hue );
	float core = exp( -s * s * 0.9 );
	vec3 glowCol = mix( dye, mix( dye, vec3( 1.0, 0.94, 0.84 ), 0.55 ), core );
	// ragged, breathing edges instead of a clean Gaussian
	float rag = texture2D( uNoise, vec2( u * 2.3 + seed * 0.71, s * 0.045 + T * 0.001 ) ).b;
	float body = exp( -s * s * ( 0.32 + 0.3 * rag ) );
	vec3 acc = glowCol * ( body * 0.72 + core * 0.3 ) + dye * exp( -s * s * 0.05 ) * 0.14;
	acc *= 1.0 - 0.5 * fray;

	// ---- weaving state: woven up to the front, loose beyond it, frayed at the ends ----
	float woven = smoothstep( front + 0.08, front - 0.16, u ) * ( 1.0 - fray );
	float loose = 1.0 - woven;
	float spread = 1.0 + 1.5 * fray + 0.35 * loose;
	float sw = s / spread;

	// fine warp fibres: silk sheen along the band, wandering, thinning out at the ends
	const float NF = 13.0;
	float f0 = ( sw * 0.5 + 0.5 ) * NF;
	float hf = wHash( floor( f0 ) + seed * 17.0 );
	float fa = f0 + ( 0.06 + 0.3 * loose + 0.7 * fray ) * sin( u * ( 5.0 + 7.0 * hf ) + hf * 6.3 + T * ( 0.01 + 0.04 * loose ) );
	float fi = floor( fa );
	hf = wHash( fi + seed * 17.0 );
	float fibre = threadProfile( fract( fa ) - 0.5, 0.11 + 0.06 * hf, fwidth( fa ) + 1e-4 ) * step( 0.0, fa ) * step( fa, NF );
	fibre *= ( 0.35 + 0.65 * texture2D( uNoise, vec2( u * ( 3.0 + hf ) + hf * 5.0, fi * 0.37 + seed ) ).g );
	fibre *= 1.0 - smoothstep( 0.1, 0.6, fray - 0.55 * hf ); // they give out one by one

	// lead threads: fewer, brighter, dyed — these are what the weft visibly binds
	const float NW = 5.0;
	float a0 = ( sw * 0.5 + 0.5 ) * NW;
	float ha = wHash( floor( a0 ) + seed * 13.0 );
	float a = a0 + ( 0.05 + 0.22 * loose + 0.5 * fray ) * sin( u * ( 4.0 + 4.0 * ha ) + ha * 6.3 + T * ( 0.012 + 0.03 * loose ) );
	float ia = floor( a );
	ha = wHash( ia + seed * 13.0 );
	float lead = threadProfile( fract( a ) - 0.5, 0.08 + 0.04 * ha, fwidth( a ) + 1e-4 ) * step( 0.0, a ) * step( a, NW ) * step( 0.18, ha );
	lead *= 1.0 - smoothstep( 0.1, 0.7, fray - 0.5 * ha );
	vec3 leadCol = ha < 0.45 ? cA : ha < 0.8 ? cB : cC;

	// weft: sparse crossing threads on a slant that bends along the ribbon, unevenly packed, gaps
	float slant = 0.8 + 0.6 * sin( u * 1.6 + seed * 2.3 );
	float bq = u * 30.0 + sw * slant + 3.5 * sin( u * 1.9 + seed ) + 1.1 * sin( u * 6.3 + seed * 3.0 );
	float ib = floor( bq );
	float hb = wHash( ib * 1.37 + seed * 7.0 );
	float weft = threadProfile( fract( bq ) - 0.5, 0.07 + 0.04 * hb, fwidth( bq ) + 1e-4 ) * woven * step( 0.42, hb );
	weft *= smoothstep( 1.12, 0.9, abs( sw ) );
	vec3 weftCol = mix( vec3( 1.0, 0.9, 0.74 ), cC, 0.35 * hb );

	// plain weave: in alternate cells the lead thread rides over the weft or dips under it (dimmed)
	float over = mod( ia + ib, 2.0 );
	float under = woven * ( 1.0 - over );
	vec3 threads = glowCol * fibre * 0.2
		+ leadCol * lead * ( 1.0 - 0.7 * under ) * 0.6
		+ weftCol * weft * ( 1.0 - 0.8 * lead * over ) * 0.38;
	acc += threads;

	// the shuttle riding the weaving front, trailing a short glow
	float du = u - front;
	float sh = exp( -du * du / 0.003 ) + 0.2 * exp( min( du, 0.0 ) * 12.0 ) * step( du, 0.0 );
	acc += vec3( 1.0, 0.84, 0.58 ) * sh * exp( -sw * sw * 1.6 ) * ( 1.0 - fray ) * ( 0.6 + 0.3 * sin( T * 1.7 + seed ) );

	return acc * fold * edgeOn * ends;
}

// Cumulus in a few broad banks (the storybook skies of the key art). The macro field (shared with the
// ground's cloud shadows, so the shadow patches follow the clouds overhead) gathers clusters into banks
// with open blue lanes between them; inside a cluster rounded Worley cells at three scales make the
// puffs, broken by fine noise. The puff scale itself wanders across the sky (about 3× between regions),
// so big towering heads sit next to small fair-weather puffs instead of an even popcorn field.
float cloudMask( vec2 p ) { return smoothstep( 0.38, 0.72, mdrCloudMacro( p ) ); }
// x = the field, y = the puff profile (1 in a puff's core, 0 in the creases between puffs), z = the
// cluster mask, w = the puff scale (both vary over kilometres: the lighting steps reuse them)
vec4 cloudField( vec2 p ) {
	// puff-scale warp: the cell lookups run ≈ 0.5× … 1.4× over ~8 km
	float k = exp2( mix( -1.0, 0.45, mdrVNoise( p * 0.23 + vec2( 5.3, 2.9 ) ) ) );
	float mask = cloudMask( p );
	vec2 c = p * k;
	vec2 q = c * 1.1 + vec2( 0.21, 0.37 );
	float big = texture2D( uNoise, c * 0.55 + vec2( 0.63, 0.11 ) ).a;
	float c1 = texture2D( uNoise, q ).a;
	float c2 = texture2D( uNoise, q * 2.3 + 0.77 ).a;
	// two finer octaves soften the rims so no puff shows the Worley cells' straight creases
	float det = texture2D( uNoise, q * 5.3 + 0.57 ).r;
	float det2 = texture2D( uNoise, q * 2.9 + 0.29 ).b;
	float cells = big * 0.45 + c1 * 0.37 + c2 * 0.18;
	float f = mask * 0.55 + cells * 0.45 + 0.025 + ( det - 0.5 ) * 0.04 + ( det2 - 0.5 ) * 0.05;
	return vec4( f, smoothstep( 0.42, 0.85, cells ), mask, k );
}
// the field a short step away (no detail octaves; the step's own mask and scale are the centre's)
float cloudFieldCoarse( vec2 p, float mask, float k ) {
	vec2 c = p * k;
	float big = texture2D( uNoise, c * 0.55 + vec2( 0.63, 0.11 ) ).a;
	float c1 = texture2D( uNoise, c * 1.1 + vec2( 0.21, 0.37 ) ).a;
	return mask * 0.55 + ( big * 0.45 + c1 * 0.37 ) * 0.45 + 0.074;
}

vec4 cumulus( vec3 dir, vec3 haze ) {
	if ( dir.y <= 0.012 ) return vec4( 0.0 );
	float dist = ( uCloudA.z - cameraPosition.y ) / dir.y;
	vec2 wp = cameraPosition.xz + dir.xz * dist;
	vec2 p = wp * uCloudA.w + uCloudOff.xy;
	vec4 fp = cloudField( p );
	float field = fp.x;
	// low in the sky the layer piles up (we see it edge-on), more so in the sunset's heavier air
	float th = uCloudA.x - ( 0.03 + 0.06 * uTwilight.z ) * ( 1.0 - smoothstep( 0.04, 0.3, dir.y ) ), soft = uCloudA.y;
	float dens = smoothstep( th, th + soft, field );
	float horizonFade = smoothstep( 0.012, 0.09, dir.y );
	if ( dens * horizonFade <= 0.002 ) return vec4( 0.0 );
	// puff height: how far the field rises above the coverage threshold
	float hgt = clamp( ( field - th ) / ( soft * 2.4 + 0.07 ), 0.0, 1.0 );
	// light: a step toward the light — where the field climbs that way, this flank faces away
	vec2 ld = normalize( uLightDir.xz + vec2( 1e-4 ) ) * ( 0.024 * ( 1.0 - uLightDir.y * 0.6 ) );
	float f1 = cloudFieldCoarse( p + ld, fp.z, fp.w );
	float f2 = cloudFieldCoarse( p + ld * 2.6, fp.z, fp.w );
	float facing = clamp( 0.5 + ( field - f1 ) * 9.0, 0.0, 1.0 );
	float optical = smoothstep( th, th + soft, f1 ) * 0.75 + smoothstep( th, th + soft, f2 ) * 0.5;
	// puffy: each lobe's core catches more light than the creases between lobes
	float shade = mix( 0.3, 1.0, facing ) * exp( -optical * 1.05 ) * mix( 0.62, 1.1, fp.y );
	// seen from below the sunlight has crossed the whole puff: bright crowns and rims, blue-grey
	// flat bellies under the thick cores (about 0.7 of the lit tops once the ambient is in); low in the
	// sky we see the flanks, so the sunlit side carries more of the cloud
	float flank = 1.0 - smoothstep( 0.06, 0.4, dir.y );
	float belly = mix( 1.0, mix( 0.22, 0.5, flank ), smoothstep( 0.1, 0.8, hgt ) );
	// forward scatter: thin edges and fringes light up around the sun (silver lining)
	float mu = max( dot( dir, uLightDir ), 0.0 );
	float silver = ( pow( mu, 6.0 ) * 2.2 + pow( mu, 48.0 ) * 3.0 ) * ( 1.0 - hgt );
	vec3 lit = uCloudLit * ( 0.12 + 0.95 * shade * belly + silver ) * ( 1.0 - uCloudB.w * 0.75 );
	vec3 amb = uCloudAmb * mix( 1.08, 0.5, hgt ) * mix( 0.85, 1.05, fp.y ) * ( 1.0 - uCloudB.w * 0.35 );
	vec3 col = amb + lit;
	// under a shower the closed layer is a deck of heavy slate masses with paler breaks where it thins
	float thin = 1.0 - smoothstep( th + 0.04, th + 0.5, field );
	col *= mix( 1.0, mix( 0.62, 1.55, thin * thin ), uCloudB.w * uCloudB.w );
	float ap = 1.0 - exp( -max( dist, 0.0 ) * 0.00005 );
	col = mix( col, haze, ap );
	return vec4( col, dens * horizonFade * ( 1.0 - 0.45 * ap ) );
}

// Far cumulus towers along the horizon (the billowing banks behind the ranges in the key art): a ragged
// skyline of heads in the lowest ~10° of sky, far beyond the cumulus layer, so they sit in the haze
// and never parallax. Heads are lit on the sunward side, their bases fade into the horizon haze.
vec4 horizonTowers( vec3 dir, vec3 haze ) {
	float h = dir.y;
	if ( h < -0.005 || h > 0.2 || uCloudA.x > 0.95 ) return vec4( 0.0 );
	// azimuth in noise units, drifting with the cumulus: 8 units around the horizon, and every lookup
	// scales it so the circle holds a whole number of texture repeats (no seam due south). Explicit LOD:
	// the azimuth jumps across that line, and its derivative would pick the smallest mip there
	float u = atan( dir.x, -dir.z ) * ( 8.0 / 6.2831853 ) + uCloudOff.x * 0.02;
	float bank = textureLod( uNoise, vec2( u * 0.125, 0.43 ), 0.0 ).g;
	float heads = textureLod( uNoise, vec2( u * 0.5, 0.17 ), 0.0 ).r * 0.6 + textureLod( uNoise, vec2( u * 1.25, 0.61 ), 0.0 ).b * 0.4;
	// the cover decides how much of the horizon carries towers
	float cov = clamp( 1.12 - uCloudA.x, 0.0, 1.0 );
	float top = ( 0.015 + 0.11 * heads * heads ) * smoothstep( 0.62 - 0.4 * cov, 0.9 - 0.3 * cov, bank ) + 0.004;
	// billows along the top edge
	vec2 bp = vec2( u * 2.5, h * 22.0 );
	float bil = textureLod( uNoise, bp, 0.0 ).a * 0.7 + textureLod( uNoise, bp * 2.1 + 0.37, 0.0 ).a * 0.3;
	float edge = top + ( bil - 0.5 ) * 0.035;
	float dens = smoothstep( edge + 0.004, edge - 0.012, h ) * smoothstep( -0.005, 0.012, h );
	if ( dens <= 0.002 ) return vec4( 0.0 );
	// heads (near the top edge) lit, lower body and base in the cloud's own shade, sunward side brighter
	float up = clamp( h / max( top, 1e-3 ), 0.0, 1.0 );
	vec2 hd = normalize( dir.xz + vec2( 1e-5 ) ), ld = normalize( uLightDir.xz + vec2( 1e-5 ) );
	float sunward = dot( hd, ld ) * 0.5 + 0.5;
	float lit = ( 0.25 + 0.75 * smoothstep( 0.2, 0.95, up ) * ( 0.45 + 0.55 * bil ) ) * ( 0.55 + 0.45 * sunward );
	vec3 col = uCloudAmb * mix( 0.8, 1.05, up ) + uCloudLit * lit * 0.85;
	// far away: deep in the haze
	col = mix( col, haze, 0.42 );
	return vec4( col, dens * 0.92 );
}

// Altocumulus: a high sheet of small rounded cloudlets (0.3–0.8 km) gathered in broad patches and
// streets — dense mackerel sky in a patch's core, isolated puffs at its edges, clean blue between.
// Lit like cotton: sunward crowns bright, thick cores blue-grey from below, thin fringes silver
// toward the sun.
float altoCells( vec2 p ) {
	return texture2D( uNoise, p ).a * 0.74 + texture2D( uNoise, p * 2.03 + vec2( 0.41, 0.17 ) ).a * 0.26;
}
vec4 altocumulus( vec3 dir, vec3 haze ) {
	if ( dir.y <= 0.015 || uAlto.x <= 0.001 ) return vec4( 0.0 );
	float dist = ( uAlto.y - cameraPosition.y ) / dir.y;
	vec2 wp = cameraPosition.xz + dir.xz * dist;
	vec2 p = wp * uAlto.z + uCloudOff.xy * 0.5 + vec2( 0.37, 0.61 );
	// patches and streets (stretched along one axis) decide where the sheet forms at all
	vec2 sp = mat2( 0.87, 0.5, -0.5, 0.87 ) * p * vec2( 0.55, 1.3 );
	float sheet = texture2D( uNoise, sp * 0.061 + vec2( 0.13, 0.52 ) ).g * 0.7 + texture2D( uNoise, sp * 0.19 + 0.3 ).r * 0.3;
	float cover = smoothstep( 0.74 - 0.44 * uAlto.x, 0.88 - 0.36 * uAlto.x, sheet );
	if ( cover <= 0.002 ) return vec4( 0.0 );
	float fray = texture2D( uNoise, p * 3.7 + 0.23 ).b;
	float cell = altoCells( p ) + ( fray - 0.5 ) * 0.1;
	float th = mix( 0.8, 0.52, cover );
	float dens = smoothstep( th, th + uAlto.w, cell );
	// low in the sky the cloudlets crowd into a band thinner than a pixel: let them go before that
	float fade = smoothstep( 0.03, 0.2, dir.y );
	if ( dens * fade <= 0.002 ) return vec4( 0.0 );
	// shading: a step toward the light — where the cells climb that way this side faces away
	vec2 ld = normalize( uLightDir.xz + vec2( 1e-4 ) ) * ( 0.018 * ( 1.0 - uLightDir.y * 0.5 ) );
	float cellL = altoCells( p + ld ) + ( fray - 0.5 ) * 0.1;
	float facing = clamp( 0.55 + ( cell - cellL ) * 7.0, 0.0, 1.0 );
	float thick = smoothstep( th + 0.02, th + 0.3, cell );
	float mu = max( dot( dir, uLightDir ), 0.0 );
	float silver = ( pow( mu, 5.0 ) * 1.6 + pow( mu, 36.0 ) * 2.6 ) * ( 1.0 - 0.8 * thick );
	vec3 lit = uCloudLit * ( 0.28 + 0.92 * facing * ( 1.0 - 0.6 * thick * ( 1.0 - 0.5 * facing ) ) + silver ) * ( 1.0 - uCloudB.w * 0.7 );
	vec3 amb = uCloudAmb * mix( 1.12, 0.72, thick ) * ( 1.0 - uCloudB.w * 0.3 );
	vec3 col = amb * 0.92 + lit * 0.82;
	float ap = 1.0 - exp( -max( dist, 0.0 ) * 0.000032 );
	col = mix( col, haze, ap );
	return vec4( col, dens * cover * fade * ( 1.0 - 0.5 * ap ) );
}

vec4 cirrus( vec3 dir, vec3 haze ) {
	if ( dir.y <= 0.012 || uCloudB.z <= 0.001 ) return vec4( 0.0 );
	float dist = ( uCloudB.x - cameraPosition.y ) / dir.y;
	vec2 wp = cameraPosition.xz + dir.xz * dist;
	vec2 a = uCirrusDir, c = vec2( -a.y, a.x );
	vec2 p = vec2( dot( wp, a ) * 0.45, dot( wp, c ) * 1.2 ) * uCloudB.y + uCloudOff.zw;
	float n = texture2D( uNoise, p ).g * 0.55 + texture2D( uNoise, p * 2.1 + 0.17 ).g * 0.3 + texture2D( uNoise, p * 4.7 + 0.61 ).b * 0.15;
	float warp = texture2D( uNoise, p * 0.23 + 0.4 ).r;
	float dens = smoothstep( 0.6, 0.98, n * ( 0.6 + 0.75 * warp ) ) * uCloudB.z;
	float fade = smoothstep( 0.012, 0.12, dir.y );
	float mu = max( dot( dir, uLightDir ), 0.0 );
	vec3 col = uCloudAmb * 1.15 + uCloudLit * ( 0.85 + pow( mu, 6.0 ) * 1.6 );
	float ap = 1.0 - exp( -max( dist, 0.0 ) * 0.00003 );
	col = mix( col, haze, ap * 0.8 );
	return vec4( col, dens * fade * 0.42 );
}

void main() {
	vec3 dir = normalize( vDir );
	float h = dir.y;
	float hu = max( h, 0.0 );
	float env = uTwilight.w;
	vec3 haze = mdrFogInscatter( dir );

	// base gradient: thin bright horizon band, quickly into the zenith colour (blended in sqrt space:
	// a warm horizon and a blue zenith meet in a clear light blue, not a murky lavender-grey)
	float zw = 1.0 - exp( -hu * 5.2 );
	vec3 sky = mix( sqrt( haze ), sqrt( uZenith ), zw );
	sky *= sky;

	// around a low sun the sky itself keeps a broad warm glow (the land's haze takes much less of it):
	// amber right at the horizon, cream-gold once the sun has climbed — never mixed so wide that the
	// warm meets the blue as lavender
	float mu = dot( dir, uSunDir );
	float muS = max( mu, 0.0 );
	vec3 glowCol = mix( mdrFogB.rgb, vec3( 1.0, 0.91, 0.74 ) * max( mdrFogB.r, 0.6 ), 0.55 * ( 1.0 - uTwilight.x ) );
	float muS2 = muS * muS;
	sky = mix( sky, glowCol * ( 0.85 + 0.25 * zw ), clamp( muS2 * muS2 * muS * uGold.x * 1.3, 0.0, 1.0 ) );
	// sunset: the sun's half of the sky sits about half a stop lower, so the amber reads deep and rich
	// instead of bright peach (the disc, its glare and the bands below stay as bright)
	vec2 hd = normalize( dir.xz + vec2( 1e-5 ) ), sd = normalize( uSunDir.xz + vec2( 1e-5 ) );
	float az = dot( hd, sd );
	float side = pow( az * 0.5 + 0.5, 1.8 );
	sky *= 1.0 - 0.3 * uTwilight.z * side;

	// aureole around the sun (Henyey-Greenstein-ish, softened) and the glare right around the disc,
	// bright enough for the bloom to turn it into a big soft sun (not in the environment map)
	float ds = angDist( mu );
	sky += uSunGlow * ( exp( -ds * 9.0 ) * 0.22 + exp( -ds * 2.4 ) * 0.07 ) * ( 1.0 - 0.5 * env );
	sky += uSunGlare * ( exp( -ds * 42.0 ) * 1.4 + exp( -ds * 11.0 ) * 0.22 ) * ( 1.0 - env );

	// golden hour: an orange-gold gradient centred on the sun's azimuth — a low amber band on the
	// horizon, a gold wash climbing above the sun; a rose band only once the sun touches the horizon;
	// Belt of Venus over the earth's shadow opposite
	float anti = pow( max( -az, 0.0 ), 1.5 );
	vec3 bands = uBandWarm * exp( -hu * 7.5 ) * side * 1.3;
	bands += uBandWarm * vec3( 1.0, 0.92, 0.7 ) * exp( -hu * 3.2 ) * pow( side, 3.0 ) * uGold.y;
	bands += uBandRose * exp( -pow( ( hu - 0.12 ) / 0.1, 2.0 ) ) * ( 0.3 + 0.7 * side );
	sky += bands * uTwilight.x;
	float belt = uTwilight.y;
	if ( belt > 0.0 ) {
		float venus = exp( -pow( ( hu - 0.1 ) / 0.07, 2.0 ) );
		float shadowBand = exp( -hu * 22.0 );
		sky += uBandRose * venus * anti * belt * 0.55;
		sky = mix( sky, sky * vec3( 0.62, 0.68, 0.9 ), shadowBand * anti * belt * 0.55 );
	}

	// night sky: stars, the Weft, moon
	float night = uNightA.x;
	float skyVis = smoothstep( -0.01, 0.2, h );
	vec3 nightCol = vec3( 0.0 );
	if ( night > 0.01 && env < 0.5 ) {
		vec3 sdir = uStarRot * dir;
		vec3 st = starLayer( sdir, 115.0, 0.955, 2.2 ) + starLayer( sdir, 260.0, 0.93, 0.9 );
		nightCol += st * uNightA.y * skyVis;
		if ( uNightA.z > 0.001 && h > 0.0 ) {
			// the Vale's dyes: verdigris / ember-gold / madder, woad / rose / bone, bone / verdigris / weld
			// (0) high: arcs over the zenith, legs fading ~35° up; (1) a low rainbow-like arch rising
			// from near the horizon to ~40°; (2) a shorter curve hanging between ~30° and ~65°
			vec3 wf = weftRibbon( dir, uWeftN[ 0 ], uWeftT[ 0 ], 0.0, 1.9, uWeftFront.x, 0.87, vec3( 0.22, 0.72, 0.6 ), vec3( 1.0, 0.7, 0.36 ), vec3( 0.84, 0.3, 0.36 ) );
			wf += weftRibbon( dir, uWeftN[ 1 ], uWeftT[ 1 ], 2.7, 1.42, uWeftFront.y, 0.06, vec3( 0.34, 0.48, 1.0 ), vec3( 0.92, 0.44, 0.56 ), vec3( 0.86, 0.86, 0.8 ) ) * 0.85;
			wf += weftRibbon( dir, uWeftN[ 2 ], uWeftT[ 2 ], 5.1, 1.5, uWeftFront.z, 0.85, vec3( 0.8, 0.82, 0.9 ), vec3( 0.26, 0.72, 0.62 ), vec3( 1.0, 0.8, 0.4 ) ) * 0.6;
			nightCol += wf * ( uNightA.z * 0.07 ) * smoothstep( 0.02, 0.25, h );
		}
		nightCol *= night;
	}
	float muM = dot( dir, uMoonDir );
	float dm = angDist( muM );
	sky += uMoonGlow * ( exp( -dm * 26.0 ) * 0.3 + exp( -dm * 5.0 ) * 0.05 );
	// the night dome as seen sits darker than the light it sheds (the environment map keeps the full
	// value): a deep navy with dim moonlit clouds over the land, as in the key art's campfire night.
	// The moon disc, the stars and the Weft keep their radiance.
	float nightDim = 1.0 - 0.66 * night * ( 1.0 - env );
	sky *= nightDim;

	// sun disc (limb darkened) and moon disc (phase + maria)
	vec3 discs = vec3( 0.0 );
	float moonMask = 0.0;
	if ( env < 0.5 ) {
		float sunR = 0.0115;
		float disc = smoothstep( sunR * 1.12, sunR * 0.9, ds ) * smoothstep( -0.012, 0.004, h );
		float limb = 0.62 + 0.38 * sqrt( max( 1.0 - ( ds / sunR ) * ( ds / sunR ), 0.0 ) );
		discs += uSunDisc * disc * limb;
		float moonR = 0.019;
		if ( dm < moonR * 1.3 && night > 0.02 ) {
			vec3 mT = normalize( cross( uMoonDir, vec3( 0.0, 1.0, 0.0 ) ) );
			vec3 mB = cross( mT, uMoonDir );
			vec2 lp = vec2( dot( dir, mT ), dot( dir, mB ) ) / moonR;
			float r2 = dot( lp, lp );
			float edge = smoothstep( 1.0, 0.9, r2 );
			vec3 nrm = vec3( lp, sqrt( max( 1.0 - r2, 0.0 ) ) );
			vec3 sunL = normalize( vec3( dot( uSunDir, mT ), dot( uSunDir, mB ), -dot( uSunDir, uMoonDir ) ) );
			float lit = smoothstep( -0.08, 0.16, dot( nrm, sunL ) );
			float maria = texture2D( uNoise, lp * 0.21 + 0.37 ).a * 0.6 + texture2D( uNoise, lp * 0.5 + 0.11 ).r * 0.4;
			vec3 surf = vec3( 0.95, 0.96, 1.0 ) * ( 0.5 + 0.5 * smoothstep( 0.32, 0.72, maria ) );
			// radiance kept below the tone curve's shoulder at night exposure, so phase and maria read
			vec3 moon = surf * ( lit * 0.85 + 0.025 ) * night;
			moonMask = edge * night;
			sky = mix( sky, moon + sky * 0.2, moonMask );
		}
	}
	sky += discs;
	sky += nightCol * ( 1.0 - moonMask );

	// clouds over everything above the horizon; under a closing deck a flat stratus base fills the
	// gaps between the cumulus, so the sky greys over instead of showing cut-out blue holes
	vec4 ci = cirrus( dir, haze );
	sky = mix( sky, ci.rgb * nightDim, ci.a );
	vec4 ac = altocumulus( dir, haze );
	sky = mix( sky, ac.rgb * nightDim, ac.a );
	if ( uStratus > 0.001 ) {
		// a shower deck is not a flat lid: dark slate masses with brighter breaks between them drift in it
		vec2 sp = cameraPosition.xz * 0.00012 + dir.xz / max( hu, 0.05 ) * 0.24 + uCloudOff.xy * 0.4;
		float mass = texture2D( uNoise, sp ).g * 0.6 + texture2D( uNoise, sp * 2.7 + 0.31 ).r * 0.4;
		float breaks = smoothstep( 0.35, 0.8, mass );
		vec3 stratus = ( uCloudAmb * 0.78 + uCloudLit * 0.19 ) * mix( 0.62, 1.7, breaks * breaks );
		stratus = mix( stratus, haze, exp( -hu * 7.0 ) * 0.6 );
		sky = mix( sky, stratus * nightDim, uStratus * smoothstep( -0.01, 0.1, h ) );
	}
	vec4 tw = horizonTowers( dir, haze );
	sky = mix( sky, tw.rgb * nightDim, tw.a );
	vec4 cu = cumulus( dir, haze );
	sky = mix( sky, cu.rgb * nightDim, cu.a );

	// below the horizon: haze fading to a dim ground bounce (matters for the environment map)
	float g = smoothstep( 0.0, -0.22, h );
	vec3 below = mix( haze, mix( haze * 0.5, uGround, 0.6 ), g * ( 0.35 + 0.65 * env ) );
	sky = mix( sky, below, smoothstep( 0.0, -0.025, h ) );
	gl_FragColor = vec4( max( sky, 0.0 ), 1.0 );
}
`,ge=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},_e=class{rain=0;cover=.35;cirrus=.5;mist=0;wind=new c(1.2,.4);windSpeed=1.5;mode=`auto`;phase=`clear`;timer=520;rainPeak=.6;clock=0;rng=new T(`frayed-vale-weather`);setMode(e){this.mode=e,e===`rain`&&(this.rain=Math.max(this.rain,.75),this.cover=Math.max(this.cover,.9)),e===`clear`&&(this.rain=0),e===`mist`&&(this.mist=Math.max(this.mist,.7))}update(e){this.clock+=e;let t=this.clock,n=0,r=.34+.14*Math.sin(t*.0031)+.06*Math.sin(t*.0127+1.3),i=0,a=.45+.3*Math.sin(t*.0021+.7);switch(this.mode){case`clear`:r=Math.min(r,.38);break;case`overcast`:r=.82;break;case`rain`:r=.92,n=.95;break;case`mist`:i=.8,r=Math.min(r,.35);break;default:this.timer-=e,this.timer<=0&&this.advance(),this.phase===`build`?r=.86:this.phase===`rain`?(r=.9,n=this.rainPeak,i=.25):this.phase===`clearing`&&(r=.55)}let o=1-Math.exp(-e/22);this.cover+=(r-this.cover)*o,this.cirrus+=(a*(1-this.rain)-this.cirrus)*o;let s=1-Math.exp(-e/(n>this.rain?this.mode===`rain`?3:14:10));this.rain+=(n*ge(.6,.85,this.cover)-this.rain)*s,this.mist+=(i-this.mist)*(1-Math.exp(-e/12));let c=.32+.45*Math.sin(t*.0041)+.12*Math.sin(t*.023),l=Math.max(0,Math.sin(t*.37)*Math.sin(t*.113+.4))*1.1;this.windSpeed=1.25+.5*Math.sin(t*.017)+l+this.rain*3.2,this.wind.set(Math.cos(c),Math.sin(c)).multiplyScalar(this.windSpeed)}advance(){let e=this.rng;switch(this.phase){case`clear`:this.phase=`build`,this.timer=e.range(45,70);break;case`build`:this.phase=`rain`,this.timer=e.range(70,150),this.rainPeak=e.range(.35,.8);break;case`rain`:this.phase=`clearing`,this.timer=e.range(50,80);break;default:this.phase=`clear`,this.timer=e.range(300,720)}}},ve=Math.PI*2,ye=new g(0,1,0),H=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},be=(e,t)=>1-Math.exp(-e*t),U=h.lerp,xe=h.degToRad(48),Se=new g(0,Math.sin(xe),-Math.cos(xe)),Ce=new g(0,Math.cos(xe),Math.sin(xe)),we=new g(-1,0,0),Te=(e,t,n)=>n.copy(Ce).multiplyScalar(Math.cos(e)*Math.cos(t)).addScaledVector(we,Math.cos(e)*Math.sin(t)).addScaledVector(Se,Math.sin(e)),Ee=h.degToRad(21),De=Math.acos(-Math.tan(xe)*Math.tan(Ee)),Oe=e=>{let t=(e%1+1)%1-.25;return t>=0&&t<=.5?-De+t/.5*2*De:De+((t<0?t+1:t)-.5)/.5*(ve-2*De)},ke=(e,t)=>Te(Ee,Oe(e),t),W=h.degToRad(62),Ae=(e,t)=>Te(W,Oe(e)+Math.PI/3,t),G=512,je=(()=>{let e=new Float32Array(G),t=new g,n=0;for(let r=0;r<G;r++){let i=ke((r+.5)/G,t).y;e[r]=.5+.42*H(.03,.14,i)+1.15*H(-.2,-.34,i),n+=1/e[r]}let r=n/G;for(let t=0;t<G;t++)e[t]*=r;return e})(),Me=e=>je[Math.min(511,Math.floor(e*G))],Ne={weald:{haze:1.3,tint:12109474,tintAmt:.16,shafts:1.35,vol:1},fen:{haze:1.18,tint:12370596,tintAmt:.14,shafts:1,vol:.6},heights:{haze:.8,tint:13424356,tintAmt:.08,shafts:1,vol:.25},loomspire:{haze:.72,tint:13424360,tintAmt:.1,shafts:1,vol:.25},gorge:{haze:.9,tint:14472388,tintAmt:.06,shafts:1.1,vol:.55},strand:{haze:1.12,tint:13424866,tintAmt:.12,shafts:1,vol:.3},chorusmere:{haze:1.08,tint:13161176,tintAmt:.06,shafts:1,vol:.4},hand:{haze:1,tint:16777215,tintAmt:0,shafts:1.1,vol:.5}},Pe={haze:1,tint:16777215,tintAmt:0,shafts:1,vol:.32},Fe=new d(11977420),Ie=new d(1388860),Le=new d(5404810),Re=new d(2503738),ze=new d(16747584),Be=new d(14453380),Ve=.17,He=new d(9413312),Ue=new d(4080716),We=new d(5653052),Ge=new d(16751178),Ke=Ge.r*.2126+Ge.g*.7152+Ge.b*.0722,qe=.95,Je=(e,t)=>{let n=h.degToRad(e),r=h.degToRad(t);return new g(Math.cos(n)*Math.sin(r),Math.sin(n),-Math.cos(n)*Math.cos(r))},Ye=[Je(60,100),Je(68,173),Je(72,300)],Xe=[1,-.7,.85],Ze=new d;function Qe(e,t,n){let r=e.r*.2126+e.g*.7152+e.b*.0722;e.lerp(Ze.setRGB(r,r,r*1.04),t).multiplyScalar(n)}function K(e){let t=e.render,r=e.scene,p=e.render.renderer,m=new g,h=new g,y=new g(0,1,0),w=new g(0,1,0),T=new _e,E={rain:0,fog:0,wind:T.wind},k=ce(),j=new d,M=new d,ie=pe(),ae=[new g,new g,new g],oe=[new g,new g,new g],N={...D(),uNoise:{value:ie},uSunDir:{value:m},uMoonDir:{value:h},uLightDir:{value:new g(0,1,0)},uSunDisc:{value:new d},uSunGlow:{value:new d},uMoonGlow:{value:new d},uSunGlare:{value:new d},uGold:{value:new c},uAlto:{value:new f},uZenith:{value:new d},uGround:{value:new d},uTwilight:{value:new f},uBandWarm:{value:new d},uBandRose:{value:new d},uNightA:{value:new f},uStarRot:{value:new s},uWeftN:{value:ae},uWeftT:{value:oe},uWeftFront:{value:new g},uCloudA:{value:new f},uCloudB:{value:new f},uCloudOff:{value:new f},uCloudLit:{value:new d},uCloudAmb:{value:new d},uCirrusDir:{value:new c(1,0)},uStratus:{value:0}},P=new o({name:`sky`,vertexShader:me,fragmentShader:he,uniforms:N,glslVersion:b,side:1,depthWrite:!1,depthTest:!0,fog:!1,toneMapped:!1}),F=new n(1e3,48,24),se=new _(F,P);se.name=`skyDome`,se.frustumCulled=!1,se.renderOrder=1e6,r.add(se),r.background=null;let le=new l,ue=new v,I=new _(F,P);I.frustumCulled=!1,le.add(I);let L=new ee(p),R=L,z=null,B=null,V=null,fe=0,ge=-1,ve=-1,xe=-1,Ce=-1,we=()=>{let e=t.preset?.envSize??128;if(!(z&&z.width===e)&&(z?.dispose(),V?.dispose(),V=null,B&&le.remove(B),z=new x(e,{type:i,generateMipmaps:!1,depthBuffer:!1}),z.texture.name=`mender.skyCube`,B=new a(1,3e3,z),le.add(B),R._setSize&&R._allocateTargets)){R._setSize(e),V=R._allocateTargets();let t=R._ggxMaterial;t?.defines&&`GGX_SAMPLES`in t.defines&&(t.defines.GGX_SAMPLES=64,t.needsUpdate=!0)}},Te=e=>{we();let t=N.uTwilight.value;t.w=1,I.position.copy(e),I.updateMatrixWorld(),B.position.copy(e),B.updateMatrixWorld();let n=p.getRenderTarget();B.update(p,le),t.w=0,V=L.fromCubemap(z.texture,V),p.setRenderTarget(n),r.environment=V.texture},Ee=()=>{we();let e=p.getRenderTarget();p.setRenderTarget(V??z);try{p.compile(I,ue),L.compileCubemapShader();let e=R._lodMeshes?.[1];for(let t of[R._cubemapMaterial,R._ggxMaterial])t&&e&&p.compile(new _(e.geometry,t),ue)}finally{p.setRenderTarget(e)}return[P,R._cubemapMaterial,R._ggxMaterial].filter(e=>!!e)},De=e=>{let t=p.properties.get(e).currentProgram;return!t||t.isReady()},W=0,G=-1e4,je=0,Je=new g,Ze=0,K=0,q=0,J={haze:1,shafts:1,vol:.32,tint:new d(1,1,1),tintAmt:0},$e=`hearthmoor`,et=0,tt=new g(1e9,0,0),nt=new f(3.1,7.7,.4,.9),rt=new u,Y=e=>{T.setMode(e),e===`rain`&&(K=Math.max(K,.85),q=Math.max(q,.7),Ze=Math.max(Ze,T.rain)),e===`clear`&&(K=q=Ze=0)},it=e.debug.params.get(`weather`);(it===`rain`||it===`clear`||it===`overcast`||it===`mist`||it===`auto`)&&Y(it);let at,X=new Promise(e=>{at=e}),Z={order:C.sky,timeOfDay:.31,daySpeed:1/1200,sunDirection:m,moonDirection:h,lightDirection:y,nightFactor:0,weather:E,get caveFactor(){return W},get cloudCover(){return T.cover},get wetness(){return K},get weatherMode(){return T.mode},setWeather:Y,envReady:X,setTime(e){Z.timeOfDay=(e%1+1)%1,fe=0,ot()},update(e){Z.timeOfDay=((Z.timeOfDay+e*Z.daySpeed*Me(Z.timeOfDay))%1+1)%1,T.update(e),ot()},debugStats(){return{time:+Z.timeOfDay.toFixed(4),sunElev:+m.y.toFixed(3),night:+Z.nightFactor.toFixed(2),pace:+Me(Z.timeOfDay).toFixed(2),rain:+T.rain.toFixed(2),cover:+T.cover.toFixed(2),mist:+E.fog.toFixed(2),wet:+K.toFixed(2),puddles:+q.toFixed(2),phase:T.phase,mode:T.mode,cave:+W.toFixed(2),region:$e}}};function ot(){ke(Z.timeOfDay,m),Ae(Z.timeOfDay,h),Z.nightFactor=1-H(-.25,.04,m.y)}ot();let Q=n=>{let i=e.camera,a=i.position,o=m.y,s=Z.timeOfDay,c=Z.nightFactor,l=e.terrain.caveFactorAt(a.x,a.y,a.z);W+=(l-W)*be(l>W?2.2:1.4,n);let u=tt.x>1e8||tt.distanceToSquared(a)>6400;if(tt.copy(a),et-=n,et<=0||u){et=.5,$e=te(a.x,a.z).id;let t=e.terrain.heightAt(a.x,a.z);for(let n=0;n<16;n++){let r=n/8*Math.PI+(n>=8?.2:0),i=n>=8?150:65,o=a.x+Math.cos(r)*i,s=a.z+Math.sin(r)*i,c=e.terrain.waterHeightAt(o,s);t=Math.min(t,c??e.terrain.heightAt(o,s))}je=t,(u||G<-1e3)&&(G=t)}G+=(je-G)*be(.25,n),u&&(W=l);let d=Ne[$e]??Pe,f=u?1:be(.5,n);J.haze+=(d.haze-J.haze)*f,J.shafts+=(d.shafts-J.shafts)*f,J.vol+=(d.vol-J.vol)*f,J.tint.lerp(j.setHex(d.tint),f),J.tintAmt+=(d.tintAmt-J.tintAmt)*f,Ze+=(T.rain-Ze)*be(1.5,n);let p=Ze,g=W,_=1-g,v=Math.max(0,T.cover-.12*c*(1-p)),b=H(.62,.92,v);de(o,s,k);let x=p*.75+Math.max(0,T.cover-.6)*.5;M.copy(k.zenith).lerp(k.haze,.55).multiplyScalar(.95-.3*c),M.lerp(He,.5*H(.05,.3,o)),M.lerp(We,.8*H(.18,.03,o)*H(-.08,0,o)),M.lerp(Ue,Math.min(1,p*1.2)*(1-c)*.9),Qe(M,x*.5,1-x*.25),Qe(k.zenith,x*.8,1-x*.3),k.zenith.lerp(j.copy(M).multiplyScalar(.92),b*.75),Qe(k.haze,x*.7,1-x*.42),Qe(k.hazeSun,x*.8,1-x*.3),Qe(k.hemiSky,x*.6,1),k.haze.lerp(j.copy(J.tint).multiplyScalar(k.haze.r*.2126+k.haze.g*.7152+k.haze.b*.0722),J.tintAmt);let ee=H(-.03,.035,o),S=H(-.03,-.1,o)*H(.02,.14,h.y),C=o<-.03;y.copy(C?h:m),y.y<.02&&(y.y=.02,y.normalize());let D=e.render.sun;C?(D.color.copy(Fe),D.intensity=.62*S*(1-p*.6)*_):(D.color.copy(k.sun),D.intensity=k.sunI*ee*(1-p*.72)*(1-Math.max(0,T.cover-.7)*.8)*_),t.lightDirection?.copy(y);let ie=e.render.hemi;ie.color.copy(k.hemiSky).lerp(Le,g),ie.groundColor.copy(k.hemiGround).lerp(Re,g),ie.intensity=U(k.hemiI*(1-p*.1),1.05,g);let P=H(.42,.1,o)*H(-.05,.02,o),F=H(.2,.04,o)*H(-.07,-.01,o);r.environmentIntensity=(.22-.08*c)*(1-.4*P)*_*(1-p*.3);let ce=o<-.1;w.copy(ce?h:m);let le=ce?H(-.1,-.2,o)*.35:1-H(-.04,-.1,o);O.A[0]=w.x,O.A[1]=w.y,O.A[2]=w.z,O.A[3]=(.55+k.glow*.9)*le*(1-p*.8)*_,j.copy(k.hazeSun).lerp(Ie,g),O.B[0]=j.r,O.B[1]=j.g,O.B[2]=j.b,O.B[3]=U(.26+.1*H(.3,.6,o),.8,H(.07,0,o))*le*(1-p*.6)*_,j.copy(k.haze).lerp(Ie,g),O.C[0]=j.r,O.C[1]=j.g,O.C[2]=j.b;let ue=.0012*k.density*J.haze*(1+p*2.2+Math.max(0,T.cover-.6)*.8);O.C[3]=U(ue,.008,g),O.D[0]=U(1/165,0,g);let I=H(.2,.255,s)*(1-H(.305,.4,s));E.fog=Math.min(1,I*.6+T.mist+p*.3+.12*c),O.D[1]=(.0055*I+.02*T.mist+.004*p+.0015*c)*_,O.D[2]=1/9,O.D[3]=G+1.5;let L=H(1,.55,Math.hypot(a.x-ne.x,a.z-ne.z)/ne.radius),R=Math.max(L,Math.min(1,T.mist));O.H[0]=U(U(90,40,p),0,g),O.H[1]=U(U(200,160,p),1,g),O.H[2]=U(U(90,25,R),0,g),O.H[3]=U(U(280,150,R),1,g),O.E[1]=.85,O.E[3]=(.14-.08*c)*_,O.F[0]=ne.x,O.F[1]=ne.z,O.F[2]=1/ne.radius,O.F[3]=1.9;let z=Math.max(c,1-H(.02,.2,o));O.G[2]=U(U(.92,.9,z),1,F),O.G[3]=U(U(1.1,1.12,z),.96,F),O.G[0]=U(.9,.72,p),O.G[1]=.95;let B=E.wind.x,V=E.wind.y,pe=1/1900;nt.x+=B*5.5*pe*n,nt.y+=V*5.5*pe*n;let me=Math.hypot(B,V)||1;N.uCirrusDir.value.set(B/me,V/me),nt.z+=9e-4*n*(1+me*.3);let he=.91-.68*v-.12*p,_e=Ve+.26*b;A.A[1]=he,A.A[2]=nt.x,A.A[3]=nt.y,A.A[0]=(.5+.2*v)*H(.04,.22,y.y)*(C?.5:1)*_,A.B[0]=y.x,A.B[1]=y.y,A.B[2]=y.z,A.B[3]=1400,A.C[0]=pe,A.C[1]=_e,se.position.copy(a),N.uLightDir.value.copy(o>-.12?m:h);let we=H(-.015,.02,o)*(1-p*.92)*(1-Math.max(0,v-.75)*2);N.uSunDisc.value.copy(k.sun).multiplyScalar((4+44*H(0,.4,o))*Math.max(0,we)),N.uSunGlow.value.copy(k.sun).multiplyScalar((.7+1.4*k.glow)*(1-.45*F)*H(-.06,.02,o)*(1-p*.8)),N.uSunGlare.value.copy(k.sun).multiplyScalar((1.5+1.1*k.glow)*H(-.02,.03,o)*(1-p*.9)*(1-b*.7)),N.uGold.value.set(.65*P*(1-x),.75*P*(1-x)),N.uMoonGlow.value.setRGB(.5,.6,1).multiplyScalar(.3*c*H(-.05,.1,h.y)*(1-p*.7)),N.uZenith.value.copy(k.zenith),N.uGround.value.copy(k.hemiGround).multiplyScalar(.5);let Ee=H(.03,-.01,o)*H(-.2,-.02,o)*(1-x);N.uTwilight.value.set(k.glow*(1-x*.9),Ee,F*(1-x),0),N.uBandWarm.value.copy(ze).multiplyScalar(.55),N.uBandRose.value.copy(Be).multiplyScalar(.22*H(0,-.03,o));let De=(1-Math.min(1,p*1.5))*(1-b*.85),ke=H(.35,.95,c)*De,Ae=H(.55,.98,c)*De,Me=e.uniforms.uTime.value;N.uNightA.value.set(c,ke,Ae,Me),rt.makeRotationAxis(Se,-Oe(s)),N.uStarRot.value.setFromMatrix4(rt);let Y=(s+.25)%1*2,it=Y*.45+Me*.0015;for(let e=0;e<3;e++)ae[e].copy(Ye[e]).applyAxisAngle(ye,it*Xe[e]),oe[e].copy(ye).addScaledVector(ae[e],-ae[e].y).normalize();N.uWeftFront.value.set(U(-1.3,1.6,Y),U(-1.1,1.3,Y),U(-.8,.9,Y)),N.uCloudA.value.set(he,_e,1400,pe),N.uCloudB.value.set(6500,1/8700,.22*T.cirrus*(1-p)*(1-.7*c),x);let at=(.22+.26*T.cirrus)*(1-.65*c)*(1-H(.5,.9,v))*(1-p);N.uAlto.value.set(at,3800,1/6e3,.16),N.uCloudOff.value.copy(nt),N.uStratus.value=Math.min(.45+.35*p,b*.35+p*.8);let X=N.uCloudLit.value;if(o>-.12){X.copy(k.sun).multiplyScalar(k.sunI*ee*U(.52,.4,P)),Qe(X,.55*H(.06,.3,o),1);let e=H(.06,-.01,o)*H(-.16,-.03,o);X.add(j.copy(ze).lerp(Be,H(-.02,-.1,o)).multiplyScalar(e*.55));let t=X.r*.2126+X.g*.7152+X.b*.0722;X.lerp(j.copy(Ge).multiplyScalar(t/Ke),.6*F)}else X.copy(Fe).multiplyScalar(.16*S);X.multiplyScalar(1-p*.55),N.uCloudAmb.value.copy(M);let ot=p>.04?p:0;K=Math.min(1,Math.max(0,K+(ot>0?(1-K)*ot*n/9:-n/90))),q=Math.min(1,Math.max(0,q+(ot>.15?(1-q)*ot*n/30:-n/160))),re[0]=K*_,re[1]=q*_,re[2]=Me,re[3]=p*_;let Q=e.uniforms;Q.uSunDir.value.copy(m),Q.uLightDir.value.copy(y),Q.uSunColor.value.copy(D.color).multiplyScalar(D.intensity/3.4),Q.uNight.value=c,Q.uWind.value.copy(E.wind),Q.uRain.value=p,Q.uCave.value=g,E.rain=p;let $=t.grade;if($){let e=P;$.exposure=U(k.exposure*(1+p*.18),qe,g),$.autoStrength=U(U(U(.5,.34,P),1,c),.6,g),$.autoTarget=U(U(.21,.0138,c),.05,g)*(1-.1*p),$.autoMin=.6,$.autoMax=U(U(2.4,2.6,c),1.7,g),$.bloom=U(.5,.62,Math.max(c,g)),$.bloomThreshold=U(1.05,.85,Math.max(c,g)),$.bloomKnee=.6,$.contrast=.28-.01*c+.05*p+.02*g,$.lookPower=U(1.23,1.2,Math.max(c,g)),$.saturation=(1.1+.08*e-.14*c-.06*g)*(1-.25*Math.min(1,T.mist))*(1-.2*p),$.lookSaturation=1.22+.1*e-.08*p,$.vibrance=.22,$.split=1,$.shadowTint.setRGB(.9,.95,1.18).lerp(j.setRGB(.9,.97,1.06),c).lerp(j.setRGB(.86,1,1.1),g),$.highTint.setRGB(1.05,1,.92).lerp(j.setRGB(1.1,1,.85),e).lerp(j.setRGB(.97,1,1.05),Math.max(c,p*.8)),$.lift.setRGB(.022,.026,.045).lerp(j.setRGB(.022,.028,.034),c).lerp(j.setRGB(.024,.04,.05),g),$.vignette=.26+.1*g+.04*c,$.vignetteColor.setRGB(.42,.46,.62),$.night=c,$.rain=p,$.cave=g;let n=H(-.02,.05,o)*(.45+.55*H(.6,.1,o)),r=C?.35*S:0;t.shaftStrength=Math.max(n,r)*J.shafts*(1-p*.85)*_,$.shaftColor.copy(D.color).multiplyScalar(C?.05:.11*(1+k.glow*.6));let s=1+.8*e+.6*E.fog,l=J.vol,u=i.getWorldDirection(Je).dot(y),d=U(H(.34,.12,o)*H(.45,.8,u),1,H(.42,.62,l)),f=U(.5,1,H(.5,.82,u)),m=.34*l*(1+3.2*l*l)*s*d*f*(1-p*.7)*_*(C?.6:1);m*D.intensity<.03&&(m=0),$.volColor.copy(D.color).multiplyScalar(D.intensity*m),$.volDensity=U(1/420,1/95,l),$.volMax=U(110,85,l),$.volG=.58,$.volIso=.12,$.volFalloff=1/32,$.volBase=a.y-4}fe-=n;let st=Math.abs(s-ge)>.004||Math.abs(v-ve)>.06||Math.abs(p-xe)>.08||Math.abs(g-Ce)>.25;(ge<0||fe<=0&&st)&&(fe=4,ge=s,ve=v,xe=p,Ce=g,Te(a))};t.addFrameHook?t.addFrameHook(Q):e.addSystem({order:C.sky+.5,lateUpdate:Q});let $=(()=>{try{return Ee()}catch(e){return console.warn(`[sky] env program pre-compile failed`,e),[]}})(),st=performance.now(),ct=()=>{if(!$.every(De)&&performance.now()-st<2e4){setTimeout(ct,16);return}try{Q(0)}catch(e){console.error(`[sky] first environment capture failed`,e)}at()};return ct(),S(`sky-night`,`Night sky over the Vale (the Weft, moonlight)`,e=>{e.sky.setTime(.95),e.sky.daySpeed=0}),S(`sky-sunset`,`Sunset in the west-north-west, behind the Weald`,e=>{e.sky.setTime(.745),e.sky.daySpeed=0}),S(`sky-rain`,`A passing shower (wet ground, puddles)`,()=>{Y(`rain`)}),S(`sky-clear`,`Clear weather`,()=>{Y(`clear`)}),S(`sky-cycle`,`Fast day-night cycle (one day per minute)`,e=>{e.sky.daySpeed=1/60}),Z}export{K as default};