import{at as e}from"./three.core-_y2F91K_.js";import{i as t,n,r}from"./three.module-DGcYoYN8.js";var i=`
#ifndef MDR_NOISE_GLSL
#define MDR_NOISE_GLSL
float mdrHash12( vec2 p ) {
	vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
	p3 += dot( p3, p3.yzx + 33.33 );
	return fract( ( p3.x + p3.y ) * p3.z );
}
float mdrVNoise( vec2 p ) {
	vec2 i = floor( p );
	vec2 f = fract( p );
	vec2 u = f * f * ( 3.0 - 2.0 * f );
	float a = mdrHash12( i );
	float b = mdrHash12( i + vec2( 1.0, 0.0 ) );
	float c = mdrHash12( i + vec2( 0.0, 1.0 ) );
	float d = mdrHash12( i + vec2( 1.0, 1.0 ) );
	return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}
float mdrCloudMacro( vec2 p ) {
	vec2 q = mat2( 0.8, 0.6, -0.6, 0.8 ) * p * 2.07 + vec2( 17.3, 9.1 );
	float clusters = mdrVNoise( p ) * 0.62 + mdrVNoise( q ) * 0.38;
	// banks (~10 km): the clusters gather into a few broad banks with open blue lanes between them
	float bank = smoothstep( 0.28, 0.72, mdrVNoise( p * 0.19 + vec2( 3.7, 11.9 ) ) );
	return clusters * mix( 0.52, 1.3, bank );
}
#endif
`,a=`
#ifndef MDR_FOG_FUNCS
#define MDR_FOG_FUNCS
float mdrOpticalDepth( float h0, float h1, float dist, float b ) {
	h0 = max( h0, -30.0 );
	h1 = max( h1, -30.0 );
	float k = b * ( h1 - h0 );
	float e0 = exp( -b * h0 );
	if ( abs( k ) < 1e-3 ) return dist * e0 * ( 1.0 - 0.5 * k );
	return dist * ( e0 - exp( -b * h1 ) ) / k;
}
// Path length that counts toward the haze when its density ramps linearly from 0 at d0 to full at d1:
// the village, the woods and the river out to a few hundred metres stay crisp and saturated, and the
// blue aerial perspective belongs to the ridges and ranges beyond (as in the key art).
float mdrRampPath( float d, float d0, float d1 ) {
	float a = clamp( d - d0, 0.0, d1 - d0 );
	return a * a / ( 2.0 * max( d1 - d0, 1.0 ) ) + max( d - d1, 0.0 );
}
// Haze colour seen along a view direction: cool ambient haze, warmed toward the light (sun / moon).
vec3 mdrFogInscatter( vec3 dir ) {
	float mu = max( dot( dir, mdrFogA.xyz ), 0.0 );
	float broad = mu * mu * mu;
	float core = pow( mu, 18.0 );
	vec3 c = mix( mdrFogC.rgb, mdrFogB.rgb, clamp( broad * mdrFogB.w, 0.0, 1.0 ) );
	return c + mdrFogB.rgb * core * mdrFogA.w;
}
vec3 mdrApplyFog( vec3 col, vec3 wpos ) {
	vec3 rd = wpos - cameraPosition;
	float dist = length( rd );
	vec3 dir = rd / max( dist, 1e-4 );
	float invDist = 1.0 / max( dist, 1.0 );
	float tau = mdrFogC.w * mdrOpticalDepth( cameraPosition.y, wpos.y, dist, mdrFogD.x ) * mdrRampPath( dist, mdrFogH.x, mdrFogH.y ) * invDist;
	if ( mdrFogD.y > 0.0 ) {
		vec2 mid = ( cameraPosition.xz + wpos.xz ) * 0.5;
		float n = 0.5 * ( mdrVNoise( wpos.xz * 0.0105 + vec2( mdrFogE.x * 0.0031, mdrFogE.x * 0.0017 ) )
		                + mdrVNoise( mid * 0.0133 - vec2( mdrFogE.x * 0.0023, 0.0 ) ) );
		float patchy = mix( 1.0, smoothstep( 0.18, 0.82, n ) * 1.7, mdrFogE.y );
		float region = 1.0 + mdrFogF.w * smoothstep( 1.0, 0.45, length( wpos.xz - mdrFogF.xy ) * mdrFogF.z );
		// the bank opens up around the viewer: the mist lies out in the valley as banks, never over
		// the village or the path at hand
		float clearing = mdrRampPath( dist, mdrFogH.z, mdrFogH.w ) * invDist;
		tau += mdrFogD.y * patchy * region * clearing * mdrOpticalDepth( cameraPosition.y - mdrFogD.w, wpos.y - mdrFogD.w, dist, mdrFogD.z );
	}
	vec3 T = exp( -tau * vec3( 1.0 - 0.55 * mdrFogE.w, 1.0, 1.0 + mdrFogE.w ) );
	// geometry haze sits a touch darker / bluer than the sky horizon so distant ridges read as layers
	vec3 ins = mdrFogInscatter( dir );
	float il = dot( ins, vec3( 0.2126, 0.7152, 0.0722 ) );
	vec4 G = mdrFogG.x > 0.0 ? mdrFogG : vec4( 1.0 );
	ins = max( mix( vec3( il ), ins, G.y ) * G.x * mix( vec3( 1.0 ), G.zzw, 1.0 - T.g ), 0.0 );
	return col * T + ins * ( 1.0 - T );
}
#endif
`,o=`
#ifndef MDR_FOG_UNIFORMS
#define MDR_FOG_UNIFORMS
uniform vec4 mdrFogA;
uniform vec4 mdrFogB;
uniform vec4 mdrFogC;
uniform vec4 mdrFogD;
uniform vec4 mdrFogE;
uniform vec4 mdrFogF;
uniform vec4 mdrFogG;
uniform vec4 mdrFogH;
uniform vec4 mdrWet;
#endif
`,s=`
#if defined( USE_FOG ) && defined( OPAQUE )
if ( mdrWet.x > 0.001 ) {
	vec3 wetN = ( vec4( normal, 0.0 ) * viewMatrix ).xyz;
	float exposed = smoothstep( 0.3, 0.8, wetN.y ) * ( 1.0 - smoothstep( 92.0, 108.0, vFogWorldPos.y ) );
	float wetAmt = mdrWet.x * exposed;
	if ( wetAmt > 0.001 ) {
		vec2 wp = vFogWorldPos.xz;
		float pn = mdrVNoise( wp * 0.21 ) * 0.62 + mdrVNoise( wp * 0.67 + 3.1 ) * 0.38;
		float puddle = smoothstep( 0.66, 0.71, pn + mdrWet.y * 0.16 ) * smoothstep( 0.94, 0.985, wetN.y ) * mdrWet.y * exposed;
		diffuseColor.rgb *= 1.0 - 0.3 * wetAmt - 0.22 * puddle;
		roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.3 + 0.08, wetAmt * 0.85 );
		roughnessFactor = mix( roughnessFactor, 0.04, puddle );
		if ( puddle > 0.01 ) {
			// one ring per 0.5 m cell: a drop lands, the ring spreads and fades
			vec2 cp = wp * 2.0;
			vec2 ci = floor( cp );
			float h = mdrHash12( ci );
			float ph = fract( mdrWet.z * ( 0.9 + 0.5 * h ) + h * 7.3 );
			vec2 dv = fract( cp ) - 0.5 - ( vec2( h, mdrHash12( ci + 17.3 ) ) - 0.5 ) * 0.3;
			float rr = length( dv );
			float rd = ( rr - ph * 0.32 ) / 0.035;
			float ring = -rd * exp( -rd * rd ) * ( 1.0 - ph ) * mdrWet.w;
			vec3 upN = vec3( dv / max( rr, 1e-3 ) * ring * 0.45, 1.0 ).xzy;
			normal = normalize( mix( normal, normalize( ( viewMatrix * vec4( upN, 0.0 ) ).xyz ), puddle ) );
		}
	}
}
#endif
`,c=`
#ifndef MDR_CLOUD_SHADOW
#define MDR_CLOUD_SHADOW
uniform vec4 mdrCloudA;
uniform vec4 mdrCloudB;
uniform vec4 mdrCloudC;
float mdrCloudShadow( vec3 wpos ) {
	if ( mdrCloudA.x <= 0.0 ) return 1.0;
	vec3 L = mdrCloudB.xyz;
	vec2 q = wpos.xz + L.xz * ( ( mdrCloudB.w - wpos.y ) / max( L.y, 0.12 ) );
	// the sky's cloud field without its puff detail: shadow patches follow the clusters overhead
	float m = smoothstep( 0.38, 0.72, mdrCloudMacro( q * mdrCloudC.x + mdrCloudA.zw ) ) * 0.55 + 0.28;
	float d = smoothstep( mdrCloudA.y, mdrCloudA.y + mdrCloudC.y, m );
	return 1.0 - mdrCloudA.x * d;
}
#endif
`,l=`
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`,u={A:new Float32Array([.4,.7,.3,.6]),B:new Float32Array([1,.86,.66,.85]),C:new Float32Array([.62,.7,.8,.0011]),D:new Float32Array([1/170,0,1/7,0]),E:new Float32Array([0,.65,1,.12]),F:new Float32Array([520,230,1/260,1.6]),G:new Float32Array([.9,.95,.92,1.1]),H:new Float32Array([90,200,90,280])},d={A:new Float32Array([0,.55,0,0]),B:new Float32Array([.4,.7,.3,1400]),C:new Float32Array([1/1900,.3,0,0])},f=new Float32Array([0,0,0,0]),p=()=>({mdrFogA:{value:u.A},mdrFogB:{value:u.B},mdrFogC:{value:u.C},mdrFogD:{value:u.D},mdrFogE:{value:u.E},mdrFogF:{value:u.F},mdrFogG:{value:u.G},mdrFogH:{value:u.H},mdrWet:{value:f}}),m=()=>({mdrCloudA:{value:d.A},mdrCloudB:{value:d.B},mdrCloudC:{value:d.C}});function h(){return p()}var g=!1,_=!1;function v(){if(g)return;g=!0;let e=n;e.fog_pars_vertex=`
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWorldPos;
#endif
`,e.fog_vertex=`
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWorldPos = cameraPosition + ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif
`,e.fog_pars_fragment=`
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogWorldPos;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
	${o}
	${i}
	${a}
#endif
`,e.fog_fragment=`
#ifdef USE_FOG
	if ( mdrFogE.z > 0.5 ) {
		gl_FragColor.rgb = mdrApplyFog( gl_FragColor.rgb, vFogWorldPos );
	} else {
		#ifdef FOG_EXP2
			float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		#else
			float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		#endif
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
	}
#endif
`,e.lights_physical_fragment=s+e.lights_physical_fragment;let l=e.shadowmap_pars_fragment,u=e.shadowmap_pars_vertex,d=e.shadowmap_vertex,f=`varying vec4 vSunShadowWorldPosition;`,h=`vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );`,v=l.replace(f,`${f}\nvarying float vMdrCloud;`),y=v.indexOf(`float getSunShadow(`),b=y>=0?v.indexOf(`return shadow;`,y):-1;b>y&&l.includes(f)&&u.includes(f)&&d.includes(h)?(e.shadowmap_pars_vertex=u.replace(f,`${f}\nvarying float vMdrCloud;\n${i}${c}`),e.shadowmap_vertex=d.replace(h,`${h}\nvMdrCloud = mdrCloudShadow( worldPosition.xyz );`),e.shadowmap_pars_fragment=v.slice(0,b)+`return shadow * vMdrCloud;`+v.slice(b+14),_=!0):console.warn(`[render] sun shadow chunk layout changed; cloud shadows disabled`);let x=r;for(let e of Object.keys(x)){let t=x[e]?.uniforms;t&&(`fogColor`in t&&Object.assign(t,p()),_&&(`directionalLights`in t||`sunLights`in t)&&Object.assign(t,m()))}Object.assign(t.fog,p()),_&&Object.assign(t.lights,m())}function y(t){t.uFogColor.value.setRGB(u.C[0],u.C[1],u.C[2],e),t.uFogDensity.value=u.C[3],t.uFogHeightFalloff.value=u.D[0]}export{v as a,o as c,h as i,l,u as n,y as o,f as r,a as s,d as t,i as u};