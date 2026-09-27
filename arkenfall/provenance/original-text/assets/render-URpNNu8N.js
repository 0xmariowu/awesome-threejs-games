import{$ as e,An as t,B as n,C as r,D as i,Dn as a,F as o,H as s,Kn as c,L as l,Q as u,R as d,Rt as f,St as p,V as m,Xn as h,_t as g,at as _,bt as v,er as y,ft as b,hn as x,ir as S,kn as C,lt as w,m as T,nr as E,nt as ee,s as D,st as O,tr as k,ut as A,w as j,wt as te,yn as M}from"./three.core-_y2F91K_.js";import{o as ne}from"./three.module-DGcYoYN8.js";import{t as re}from"./contracts-CvM_HOZo.js";import{a as N,l as ie,n as P,o as ae}from"./fog-BB9IhazH.js";var F=new w,I=new w,L=new k,R=new k,z=new k,B=[new k,new k,new k,new k],V=[new k,new k,new k,new k],H=[new k,new k,new k,new k,new k,new k,new k,new k],U=2,oe=.1,se=class extends e{constructor(){super(new p(-5,5,5,-5,.5,500)),this.isSunLightShadow=!0,this.mapSize.set(1024,1024),this._cameras=[],this._matrices=[],this._frustums=[],this._cascadeSplits=[,,,].fill(0),this._cascadeData=[],this._viewportCount=U,this._frameExtents.set(2,1);for(let e=0;e<U;e++)this._cameras.push(new p),this._matrices.push(new w),this._frustums.push(new d),this._cascadeData.push(new E);for(;this._viewports.length<U;)this._viewports.push(new E)}getCamera(e=0){return this._cameras[e]}getMatrix(e=0){return this._matrices[e]}getFrustum(e=0){return this._frustums[e]}updateMatrices(e,t){if(t===void 0)return;let n=Math.min(.25,(Math.ceil(this.radius)+1)/this.mapSize.x),r=Math.min(.25,(Math.ceil(this.radius)+1)/this.mapSize.y);for(let e=0;e<U;e++)this._viewports[e].set(e+n,r,1-2*n,1-2*r);let i=this.mapSize.x*(1-2*n),a=this.mapSize.y*(1-2*r),o=Math.min(i,a),s=this.camera,c=t.near,l=Math.max(c+1e-6,Math.min(s.far,t.far)),u=this._cascadeSplits;u[0]=c;for(let e=1;e<U;e++){let t=e/U,n=c+(l-c)*t,r=c>0?c*(l/c)**+t:n;u[e]=(n+r)*.5}u[U]=l,L.setFromMatrixPosition(e.matrixWorld).negate().normalize(),R.set(0,1,0),Math.abs(R.dot(L))>.99&&R.set(0,0,1),F.lookAt(z.set(0,0,0),L,R),I.copy(F).transpose().multiply(t.matrixWorld);let d=t.reversedDepth?1:t.coordinateSystem===2001?0:-1,f=t.projectionMatrixInverse,p=-1/0;for(let e=0;e<4;e++){let n=e===0||e===1?1:-1,r=e===0||e===3?1:-1,i=B[e].set(n,r,d).applyMatrix4(f),a=V[e];t.isPerspectiveCamera===!0?a.copy(i).multiplyScalar(l/c):a.set(i.x,i.y,-l),i.applyMatrix4(I),a.applyMatrix4(I),p=Math.max(p,i.z,a.z)}p+=l;let m=s.near;for(let e=0;e<U;e++){let t=e===0?u[0]:this._cascadeData[e-1].z,n=u[e+1],r=n-oe*(n-u[e]);this._cascadeData[e].set(e===0?-1e10:t,n,r,0);let d=(t-c)/(l-c),f=(n-c)/(l-c);z.set(0,0,0);for(let e=0;e<4;e++)H[e*2].lerpVectors(B[e],V[e],d),H[e*2+1].lerpVectors(B[e],V[e],f),z.add(H[e*2]).add(H[e*2+1]);z.multiplyScalar(1/8);let h=0,g=1/0;for(let e=0;e<8;e++)h=Math.max(h,H[e].distanceToSquared(z)),g=Math.min(g,H[e].z);let _=Math.sqrt(h);if(o>1){_/=1-1/o;let e=2*_/i,t=2*_/a;z.x=Math.round(z.x/e)*e,z.y=Math.round(z.y/t)*t}z.z=p+m,z.applyMatrix4(F);let v=this._cameras[e];v.position.copy(z),v.quaternion.setFromRotationMatrix(F),v.left=-_,v.right=_,v.top=_,v.bottom=-_,v.near=m,v.far=p-g+2*m,v.coordinateSystem=s.coordinateSystem,v._reversedDepth=s.reversedDepth,v.updateProjectionMatrix(),v.updateMatrixWorld(),this._updateMatrix(v,this._matrices[e],this._frustums[e],this._viewports[e])}}},ce=class extends u{constructor(e,t){super(e,t),this.isSunLight=!0,this.type=`SunLight`,this.position.copy(v.DEFAULT_UP),this.updateMatrix(),this.shadow=new se}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t}},W=`
vec3 safeHdr( vec3 c ) { return ( c.r < 6e4 && c.g < 6e4 && c.b < 6e4 ) ? max( c, vec3( 0.0 ) ) : vec3( 0.0 ); }
`,G=`
${W}
uniform sampler2D tDepth;
uniform sampler2D tColor;
uniform vec2 uCam;      // near, far
uniform vec2 uFullSize; // full-res target size
uniform vec3 uSun;      // sun uv, shafts on
uniform float uAspect;
varying vec2 vUv;
float viewZ( float d ) {
	float z = d * 2.0 - 1.0;
	return 2.0 * uCam.x * uCam.y / ( uCam.y + uCam.x - z * ( uCam.y - uCam.x ) );
}
void main() {
	ivec2 mx = ivec2( uFullSize ) - 1;
	ivec2 b = ivec2( gl_FragCoord.xy ) * 2;
	float d0 = texelFetch( tDepth, min( b, mx ), 0 ).r;
	float d1 = texelFetch( tDepth, min( b + ivec2( 1, 0 ), mx ), 0 ).r;
	float d2 = texelFetch( tDepth, min( b + ivec2( 0, 1 ), mx ), 0 ).r;
	float d3 = texelFetch( tDepth, min( b + ivec2( 1, 1 ), mx ), 0 ).r;
	float dmin = min( min( d0, d1 ), min( d2, d3 ) );
	float vz = dmin >= 1.0 ? 20000.0 : viewZ( dmin );
	float src = 0.0;
	if ( uSun.z > 0.5 ) {
		float sky = ( step( 1.0, d0 ) + step( 1.0, d1 ) + step( 1.0, d2 ) + step( 1.0, d3 ) ) * 0.25;
		if ( sky > 0.0 ) {
			vec3 c = safeHdr( texture2D( tColor, vUv ).rgb );
			float l = min( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ), 16.0 );
			vec2 dv = ( vUv - uSun.xy ) * vec2( uAspect, 1.0 );
			src = sky * l * exp( -dot( dv, dv ) * 2.5 );
		}
	}
	gl_FragColor = vec4( vz, src, 0.0, 1.0 );
}
`,K=`
${W}
uniform sampler2D tSrc;
uniform vec2 uCell; // 1 / grid size
varying vec2 vUv;
void main() {
	float acc = 0.0;
	for ( int j = 0; j < 4; j ++ ) for ( int i = 0; i < 4; i ++ ) {
		vec2 uv = vUv + ( vec2( float( i ), float( j ) ) - 1.5 ) * uCell * 0.25;
		vec3 c = safeHdr( texture2D( tSrc, uv ).rgb );
		acc += log2( max( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 ) );
	}
	gl_FragColor = vec4( acc / 16.0, 0.0, 0.0, 1.0 );
}
`,q=`
uniform sampler2D tGrid;
uniform sampler2D tPrev;
uniform vec2 uGrid;   // grid size
uniform vec3 uAdapt;  // dt, speed up, speed down
uniform float uReset;
void main() {
	float acc = 0.0, wsum = 0.0;
	ivec2 n = ivec2( uGrid );
	for ( int j = 0; j < 9; j ++ ) {
		if ( j >= n.y ) break;
		for ( int i = 0; i < 16; i ++ ) {
			if ( i >= n.x ) break;
			vec2 p = ( vec2( float( i ), float( j ) ) + 0.5 ) / uGrid - 0.5;
			p.y += 0.08; // meter slightly below centre: the ground matters more than the sky
			float w = exp( -dot( p, p ) * 5.0 );
			acc += texelFetch( tGrid, ivec2( i, j ), 0 ).r * w;
			wsum += w;
		}
	}
	float target = clamp( exp2( acc / max( wsum, 1e-4 ) ), 0.001, 64.0 );
	float prev = texelFetch( tPrev, ivec2( 0 ), 0 ).r;
	float speed = target > prev ? uAdapt.y : uAdapt.z;
	float l = uReset > 0.5 || prev <= 0.0 ? target : exp2( mix( log2( max( prev, 1e-4 ) ), log2( target ), 1.0 - exp( -uAdapt.x * speed ) ) );
	gl_FragColor = vec4( l, target, 0.0, 1.0 );
}
`,le=`
${W}
uniform sampler2D tSrc;
uniform sampler2D tLum;
uniform vec2 uTexel;       // full-res texel size
uniform vec4 uThreshold;   // threshold, knee, key exposure, auto strength
uniform vec3 uAuto;        // target, min, max
varying vec2 vUv;
float karis( vec3 c ) { return 1.0 / ( 1.0 + dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) ); }
void main() {
	float avg = texture2D( tLum, vec2( 0.5 ) ).r;
	float expo = uThreshold.z * clamp( pow( uAuto.x / max( avg, 1e-4 ), uThreshold.w ), uAuto.y, uAuto.z );
	// a GRID × GRID set of bilinear taps two texels apart, each on a texel corner (a 2×2 average):
	// together they box every full-res texel under this texel (4×4 for ¼ res, 8×8 for ⅛), so a
	// one-pixel light can never slip between taps and flicker
	vec3 col = vec3( 0.0 );
	float wsum = 0.0;
	for ( int j = 0; j < PREFILTER_GRID; j ++ ) for ( int i = 0; i < PREFILTER_GRID; i ++ ) {
		vec2 o = vec2( float( i ), float( j ) ) * 2.0 - float( PREFILTER_GRID - 1 );
		vec3 c = safeHdr( textureLod( tSrc, vUv + o * uTexel, 0.0 ).rgb ) * expo;
		float w = karis( c );
		col += c * w;
		wsum += w;
	}
	col /= wsum;
	float br = max( col.r, max( col.g, col.b ) );
	float rq = clamp( br - uThreshold.x + uThreshold.y, 0.0, 2.0 * uThreshold.y );
	rq = rq * rq / ( 4.0 * uThreshold.y + 1e-4 );
	col *= max( rq, br - uThreshold.x ) / max( br, 1e-4 );
	gl_FragColor = vec4( min( col / max( expo, 1e-4 ), vec3( 256.0 ) ), 1.0 );
}
`,J=`
uniform sampler2D tSrc;
uniform vec2 uTexel;       // source texel size
varying vec2 vUv;
vec3 S( float x, float y ) { return texture2D( tSrc, vUv + vec2( x, y ) * uTexel ).rgb; }
void main() {
	vec3 col = ( S( -1.0, 1.0 ) + S( 1.0, 1.0 ) + S( -1.0, -1.0 ) + S( 1.0, -1.0 ) ) * 0.125;
	col += ( S( -2.0, 2.0 ) + S( 2.0, 2.0 ) + S( -2.0, -2.0 ) + S( 2.0, -2.0 ) ) * 0.03125;
	col += ( S( 0.0, 2.0 ) + S( -2.0, 0.0 ) + S( 2.0, 0.0 ) + S( 0.0, -2.0 ) ) * 0.0625;
	col += S( 0.0, 0.0 ) * 0.125;
	gl_FragColor = vec4( col, 1.0 );
}
`,ue=`
uniform sampler2D tDepth;           // ½-res view depth (m)
uniform sampler2DShadow tShadow;    // sun cascades (atlas, compare mode)
uniform mat4 uShadowM[ 2 ];
uniform vec2 uCascadeEnd;           // view depth where cascade 0 / 1 end
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform vec4 uVol;                  // max distance, extinction (1/m), HG g, isotropic share
uniform vec4 uVolH;                 // height falloff (1/m), reference height, -, -
varying vec2 vUv;
void main() {
	ivec2 hb = ivec2( gl_FragCoord.xy ) * 2;
	ivec2 hm = textureSize( tDepth, 0 ) - 1;
	float z = min( min( texelFetch( tDepth, min( hb, hm ), 0 ).r, texelFetch( tDepth, min( hb + ivec2( 1, 0 ), hm ), 0 ).r ),
		min( texelFetch( tDepth, min( hb + ivec2( 0, 1 ), hm ), 0 ).r, texelFetch( tDepth, min( hb + ivec2( 1, 1 ), hm ), 0 ).r ) );
	vec4 v = uProjInv * vec4( vUv * 2.0 - 1.0, 1.0, 1.0 );
	vec3 vd = normalize( v.xyz / v.w );
	float fwd = max( -vd.z, 1e-3 );
	float len = min( z / fwd, uVol.x );
	vec3 rd = normalize( mat3( uCamWorld ) * vd );
	float ign = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
	float dt = len / float( VOL_STEPS );
	float t = dt * ign;
	float acc = 0.0;
	for ( int i = 0; i < VOL_STEPS; i ++ ) {
		vec3 p = uCamPos + rd * t;
		float vz = t * fwd;
		float lit = 1.0;
		if ( vz < uCascadeEnd.y ) {
			vec4 sc = vz < uCascadeEnd.x ? uShadowM[ 0 ] * vec4( p, 1.0 ) : uShadowM[ 1 ] * vec4( p, 1.0 );
			sc.xyz /= sc.w;
			if ( sc.z < 1.0 ) lit = textureLod( tShadow, vec3( sc.xy, sc.z ), 0.0 );
		}
		// denser near the ground: shafts pool under the canopy instead of hazing the whole sky
		float dens = exp( -max( p.y - uVolH.y, 0.0 ) * uVolH.x );
		acc += lit * dens * exp( -t * uVol.y );
		t += dt;
	}
	acc *= dt * uVol.y;
	float mu = dot( rd, uLightDir );
	float g = uVol.z;
	float hg = pow( ( 1.0 + g * g - 2.0 * g ) / ( 1.0 + g * g - 2.0 * g * mu ), 1.5 );
	gl_FragColor = vec4( acc * ( uVol.w + ( 1.0 - uVol.w ) * hg ), z, 0.0, 1.0 );
}
`,de=`
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
vec3 S( float x, float y ) { return texture2D( tSrc, vUv + vec2( x, y ) * uTexel ).rgb; }
void main() {
	vec3 c = S( 0.0, 0.0 ) * 4.0;
	c += ( S( -1.0, 0.0 ) + S( 1.0, 0.0 ) + S( 0.0, -1.0 ) + S( 0.0, 1.0 ) ) * 2.0;
	c += S( -1.0, -1.0 ) + S( 1.0, -1.0 ) + S( -1.0, 1.0 ) + S( 1.0, 1.0 );
	gl_FragColor = vec4( c * ( uWeight / 16.0 ), 1.0 );
}
`,fe=`
uniform sampler2D tSrc;
uniform vec2 uSunUV;
uniform vec3 uShaft; // density, decay, weight
varying vec2 vUv;
void main() {
	vec2 uv = vUv;
	vec2 delta = ( uv - uSunUV ) * ( uShaft.x / float( SHAFT_SAMPLES ) );
	float ign = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
	uv -= delta * ign;
	float illum = 1.0, acc = 0.0;
	for ( int i = 0; i < SHAFT_SAMPLES; i ++ ) {
		uv -= delta;
		acc += texture2D( tSrc, uv ).g * illum;
		illum *= uShaft.y;
	}
	gl_FragColor = vec4( acc * uShaft.z / float( SHAFT_SAMPLES ), 0.0, 0.0, 1.0 );
}
`,pe=`
uniform sampler2D tSrc;
void main() {
	ivec2 c = ivec2( gl_FragCoord.xy );
	ivec2 m = textureSize( tSrc, 0 ) - 1;
	vec2 s0 = texelFetch( tSrc, c, 0 ).rg;
	float tol = 0.06 * s0.g + 0.4;
	float acc = 0.0, wsum = 0.0;
	for ( int j = -1; j <= 1; j ++ ) for ( int i = -1; i <= 1; i ++ ) {
		vec2 s = texelFetch( tSrc, clamp( c + ivec2( i, j ), ivec2( 0 ), m ), 0 ).rg;
		float w = ( i == 0 && j == 0 ? 2.0 : ( i == 0 || j == 0 ? 1.4 : 1.0 ) ) / ( 1.0 + abs( s.g - s0.g ) / tol );
		acc += s.r * w;
		wsum += w;
	}
	gl_FragColor = vec4( acc / wsum, s0.g, 0.0, 1.0 );
}
`,me=`
${W}
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tShaft;
uniform sampler2D tLum;
uniform sampler2D tVol;    // ¼-res volumetric sunlight (R) + the depth it was marched to (G)
uniform sampler2D tDepthH; // ½-res view depth
uniform vec3 uVolColor;    // in-scatter colour × strength (0 = off)
uniform vec2 uVolTexel;    // ¼-res texel size
uniform vec4 uExpo;        // key exposure, auto strength, auto target, bloom strength
uniform vec2 uAutoRange;   // min, max
uniform vec3 uShaftColor;
uniform vec4 uGradeA;      // contrast, saturation, vibrance, split strength
uniform vec3 uShadowTint;  // multiplicative, shadows
uniform vec3 uHighTint;    // multiplicative, highlights
uniform vec3 uLift;        // additive toe (display space)
uniform vec4 uVignette;    // rgb tint, strength
uniform vec3 uMood;        // night, rain, cave
uniform vec2 uLook;        // AgX look power, AgX look saturation
uniform vec2 uScreen;      // aspect, time
uniform vec4 uShock[ 4 ];  // centre (uv), radius (screen heights), strength (0 = off)
uniform vec4 uShockW[ 4 ]; // ring width (screen heights), chromatic split
varying vec2 vUv;

const mat3 LIN_SRGB_TO_REC2020 = mat3( vec3( 0.6274, 0.0691, 0.0164 ), vec3( 0.3293, 0.9195, 0.0880 ), vec3( 0.0433, 0.0113, 0.8956 ) );
const mat3 REC2020_TO_LIN_SRGB = mat3( vec3( 1.6605, -0.1246, -0.0182 ), vec3( -0.5876, 1.1329, -0.1006 ), vec3( -0.0728, -0.0083, 1.1187 ) );
const mat3 AGX_INSET = mat3(
	vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
	vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
	vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
const mat3 AGX_OUTSET = mat3(
	vec3( 1.1271005818144368, -0.1413297634984383, -0.14132976349843826 ),
	vec3( -0.11060664309660323, 1.157823702216272, -0.11060664309660294 ),
	vec3( -0.016493938717834573, -0.016493938717834257, 1.2519364065950405 ) );
vec3 agxContrast( vec3 x ) {
	vec3 x2 = x * x, x4 = x2 * x2;
	return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx( vec3 c ) {
	c = AGX_INSET * ( LIN_SRGB_TO_REC2020 * c );
	c = clamp( ( log2( max( c, 1e-10 ) ) + 12.47393 ) / 16.5, 0.0, 1.0 );
	c = agxContrast( c );
	// look: gentle punch (AgX base is intentionally flat)
	c = pow( max( c, 0.0 ), vec3( uLook.x ) );
	float l2 = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = l2 + uLook.y * ( c - l2 );
	c = AGX_OUTSET * c;
	c = pow( max( c, 0.0 ), vec3( 2.2 ) );
	c = REC2020_TO_LIN_SRGB * c;
	return clamp( c, 0.0, 1.0 );
}
// ACES fitted (Stephen Hill): punchier, hue-skewing alternative
const mat3 ACES_IN = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
const mat3 ACES_OUT = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
vec3 aces( vec3 c ) {
	c = ACES_IN * c;
	vec3 a = c * ( c + 0.0245786 ) - 0.000090537;
	vec3 b = c * ( 0.983729 * c + 0.4329510 ) + 0.238081;
	return clamp( ACES_OUT * ( a / b ), 0.0, 1.0 );
}
vec3 neutral( vec3 color ) {
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < 0.76 ) return color;
	float d = 0.24;
	float newPeak = 1.0 - d * d / ( peak + d - 0.76 );
	color *= newPeak / peak;
	float g = 1.0 - 1.0 / ( 0.15 * ( peak - newPeak ) + 1.0 );
	return mix( color, vec3( newPeak ), g );
}
vec3 tonemap( vec3 c ) {
#if TONEMAP == 1
	return aces( c * 1.25 );
#elif TONEMAP == 2
	return clamp( neutral( c ), 0.0, 1.0 );
#else
	return agx( c );
#endif
}
vec3 toSRGB( vec3 c ) {
	return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}
float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }

// depth-aware upsample of the ¼-res volumetric light: four bilinear taps (a soft 4x4 footprint
// that also hides the march jitter), each weighted by how well its depth matches this pixel
float volUpsample( vec2 uv ) {
	float z = texture2D( tDepthH, uv ).r;
	float tol = 0.08 * z + 0.5;
	float acc = 0.0, wsum = 1e-4;
	for ( int i = 0; i < 4; i ++ ) {
		vec2 o = vec2( i == 0 || i == 2 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0 ) * uVolTexel;
		vec2 s = texture2D( tVol, uv + o ).rg;
		float w = 1.0 / ( 1.0 + abs( s.g - z ) / tol );
		w *= w;
		acc += s.r * w;
		wsum += w;
	}
	return acc / wsum;
}

// shock rings: a thin lens travelling outward — ahead of the crest the image is pushed out, behind it
// pulled in (the derivative of a Gaussian), with a slight chromatic split on the crest
vec2 shockOffset( vec2 uv, out float fringe ) {
	vec2 acc = vec2( 0.0 );
	fringe = 0.0;
	for ( int i = 0; i < 4; i ++ ) {
		vec4 s = uShock[ i ];
		if ( s.w <= 0.0 ) continue;
		vec2 d = ( uv - s.xy ) * vec2( uScreen.x, 1.0 );
		float len = length( d );
		float x = ( len - s.z ) / uShockW[ i ].x;
		if ( abs( x ) > 3.0 ) continue;
		float band = x * exp( -x * x ) * 1.65;
		acc += d / max( len, 1e-4 ) * band * s.w;
		fringe += abs( band ) * uShockW[ i ].y;
	}
	return acc / vec2( uScreen.x, 1.0 );
}

void main() {
	vec2 uv = vUv;
	float fringe;
	vec2 sh = shockOffset( uv, fringe );
	vec2 suv = uv - sh;
	vec3 hdr;
	if ( fringe > 0.002 ) {
		hdr = safeHdr( vec3( texture2D( tScene, suv - sh * fringe ).r, texture2D( tScene, suv ).g, texture2D( tScene, suv + sh * fringe ).b ) );
	} else {
		hdr = safeHdr( texture2D( tScene, suv ).rgb );
	}
	hdr += texture2D( tBloom, suv ).rgb * uExpo.w;
	hdr += texture2D( tShaft, uv ).r * uShaftColor;
	if ( uVolColor.r + uVolColor.g + uVolColor.b > 0.0 ) hdr += volUpsample( uv ) * uVolColor;

	float avg = texture2D( tLum, vec2( 0.5 ) ).r;
	float expo = uExpo.x * clamp( pow( uExpo.z / max( avg, 1e-4 ), uExpo.y ), uAutoRange.x, uAutoRange.y );
	hdr *= expo;

	// low-light: rods take over — colour drains toward blue as the scene darkens (moonlit grass keeps a
	// little of its green, as in the key art's night)
	float L = luma( hdr );
	float scot = uMood.x * ( 1.0 - smoothstep( 0.02, 0.5, L ) );
	hdr = mix( hdr, vec3( L ) * vec3( 0.86, 1.0, 1.03 ), scot * 0.35 );

	vec3 c = toSRGB( tonemap( hdr ) );

	// grade (display space)
	float l = luma( c );
	vec3 sCurve = c * c * ( 3.0 - 2.0 * c );
	c = mix( c, sCurve, uGradeA.x );
	l = luma( c );
	float chroma = max( c.r, max( c.g, c.b ) ) - min( c.r, min( c.g, c.b ) );
	float sat = uGradeA.y * ( 1.0 + uGradeA.z * ( 1.0 - smoothstep( 0.0, 0.45, chroma ) ) );
	sat *= 1.0 - 0.35 * uMood.y;
	c = max( vec3( l ) + ( c - l ) * sat, 0.0 );
	float ws = 1.0 - smoothstep( 0.0, 0.55, l );
	float wh = smoothstep( 0.4, 1.0, l );
	c *= mix( vec3( 1.0 ), uShadowTint, ws * uGradeA.w );
	c *= mix( vec3( 1.0 ), uHighTint, wh * uGradeA.w );
	c = uLift + c * ( 1.0 - uLift );

	// vignette (tinted, never black)
	vec2 vp = ( uv - 0.5 ) * vec2( uScreen.x, 1.0 );
	float vd = length( vp ) / length( vec2( uScreen.x, 1.0 ) * 0.5 );
	float vig = smoothstep( 0.45, 1.15, vd ) * uVignette.a;
	c *= mix( vec3( 1.0 ), uVignette.rgb, vig );

	c = clamp( c, 0.0, 1.0 );
	gl_FragColor = vec4( c, sqrt( luma( c ) ) );
}
`,he=`
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform vec4 uFinal; // fxaa on, sharpen, grain, time
varying vec2 vUv;

#define EDGE_STEPS 6
const float edgeSteps[ EDGE_STEPS ] = float[ EDGE_STEPS ]( 1.0, 1.5, 2.0, 2.0, 2.0, 4.0 );

float La( vec2 uv ) { return textureLod( tSrc, uv, 0.0 ).a; } // explicit LOD: sampled inside loops
float hash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }

vec3 fxaa( vec2 uv, vec4 M, vec4 N, vec4 E, vec4 S, vec4 W, out bool skipped ) {
	float m = M.a, n = N.a, e = E.a, s = S.a, w = W.a;
	float hi = max( max( max( max( n, e ), s ), w ), m );
	float lo = min( min( min( min( n, e ), s ), w ), m );
	float contrast = hi - lo;
	skipped = contrast < max( 0.0312, 0.125 * hi ) || uFinal.x < 0.5;
	if ( skipped ) return M.rgb;
	float ne = La( uv + uTexel * vec2( 1.0, 1.0 ) ), nw = La( uv + uTexel * vec2( -1.0, 1.0 ) );
	float se = La( uv + uTexel * vec2( 1.0, -1.0 ) ), sw = La( uv + uTexel * vec2( -1.0, -1.0 ) );
	float f = ( 2.0 * ( n + e + s + w ) + ne + nw + se + sw ) / 12.0;
	f = clamp( abs( f - m ) / contrast, 0.0, 1.0 );
	float pixelBlend = smoothstep( 0.0, 1.0, f );
	pixelBlend *= pixelBlend * 0.85;
	float horizontal = abs( n + s - 2.0 * m ) * 2.0 + abs( ne + se - 2.0 * e ) + abs( nw + sw - 2.0 * w );
	float vertical = abs( e + w - 2.0 * m ) * 2.0 + abs( ne + nw - 2.0 * n ) + abs( se + sw - 2.0 * s );
	bool isH = horizontal >= vertical;
	float pL = isH ? n : e, nL = isH ? s : w;
	float pG = abs( pL - m ), nG = abs( nL - m );
	float stepLen = isH ? uTexel.y : uTexel.x;
	float oppL, grad;
	if ( pG < nG ) { stepLen = -stepLen; oppL = nL; grad = nG; } else { oppL = pL; grad = pG; }
	vec2 uvE = uv;
	vec2 es;
	if ( isH ) { uvE.y += stepLen * 0.5; es = vec2( uTexel.x, 0.0 ); } else { uvE.x += stepLen * 0.5; es = vec2( 0.0, uTexel.y ); }
	float edgeL = ( m + oppL ) * 0.5;
	float gt = grad * 0.25;
	vec2 puv = uvE + es * edgeSteps[ 0 ];
	float pd = La( puv ) - edgeL;
	bool pEnd = abs( pd ) >= gt;
	for ( int i = 1; i < EDGE_STEPS && !pEnd; i ++ ) { puv += es * edgeSteps[ i ]; pd = La( puv ) - edgeL; pEnd = abs( pd ) >= gt; }
	if ( !pEnd ) puv += es * 8.0;
	vec2 nuv = uvE - es * edgeSteps[ 0 ];
	float nd = La( nuv ) - edgeL;
	bool nEnd = abs( nd ) >= gt;
	for ( int i = 1; i < EDGE_STEPS && !nEnd; i ++ ) { nuv -= es * edgeSteps[ i ]; nd = La( nuv ) - edgeL; nEnd = abs( nd ) >= gt; }
	if ( !nEnd ) nuv -= es * 8.0;
	float pDist = isH ? puv.x - uv.x : puv.y - uv.y;
	float nDist = isH ? uv.x - nuv.x : uv.y - nuv.y;
	float shortest = min( pDist, nDist );
	bool dsign = pDist <= nDist ? pd >= 0.0 : nd >= 0.0;
	float edgeBlend = dsign == ( m - edgeL >= 0.0 ) ? 0.0 : 0.5 - shortest / ( pDist + nDist );
	float blend = max( pixelBlend, edgeBlend );
	if ( isH ) uv.y += stepLen * blend; else uv.x += stepLen * blend;
	return texture2D( tSrc, uv ).rgb;
}

void main() {
	vec4 M = texture2D( tSrc, vUv );
	vec4 N = texture2D( tSrc, vUv + vec2( 0.0, uTexel.y ) );
	vec4 E = texture2D( tSrc, vUv + vec2( uTexel.x, 0.0 ) );
	vec4 S = texture2D( tSrc, vUv - vec2( 0.0, uTexel.y ) );
	vec4 W = texture2D( tSrc, vUv - vec2( uTexel.x, 0.0 ) );
	bool skipped;
	vec3 c = fxaa( vUv, M, N, E, S, W, skipped );
	if ( skipped && uFinal.y > 0.0 ) {
		// unsharp mask for soft, broad detail only: busy texels (foliage) and deep shadows are left
		// alone, otherwise alpha-tested canopies turn to crunchy speckle
		float hi = max( max( max( N.a, E.a ), max( S.a, W.a ) ), M.a );
		float lo = min( min( min( N.a, E.a ), min( S.a, W.a ) ), M.a );
		float calm = 1.0 - smoothstep( 0.012, 0.03, hi - lo );
		float k = uFinal.y * calm * smoothstep( 0.25, 0.5, M.a );
		vec3 blur = ( N.rgb + E.rgb + S.rgb + W.rgb ) * 0.25;
		c = M.rgb + clamp( M.rgb - blur, -0.05, 0.05 ) * k;
	}
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	float t = fract( uFinal.w * 0.61803 ) * 97.0;
	float g = hash( gl_FragCoord.xy + t ) + hash( gl_FragCoord.xy * 1.37 - t ) - 1.0;
	c += g * ( uFinal.z * ( 1.0 - 0.75 * l ) + 0.6 / 255.0 );
	gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}
`;function ge(){return{exposure:1,autoStrength:.5,autoTarget:.2,autoMin:.6,autoMax:2.2,bloom:.55,bloomThreshold:1.1,bloomKnee:.6,contrast:.2,saturation:1.08,vibrance:.18,split:1,shadowTint:new T(.92,.95,1.1),highTint:new T(1.05,1,.92),lift:new T(.022,.026,.045),vignette:.28,vignetteColor:new T(.42,.46,.62),night:0,rain:0,cave:0,shaftColor:new T(0,0,0),volColor:new T(0,0,0),volDensity:1/150,volMax:110,volG:.6,volIso:.15,volFalloff:1/30,volBase:0,lookPower:1.2,lookSaturation:1.22}}var Y=(e,t,n={})=>new S(e,t,{type:m,format:f,minFilter:ee,magFilter:ee,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,...n}),_e=(e,t)=>Y(e,t,{type:c}),ve=e=>e.bloomDiv>4?4:2,X=(e,n,r={})=>new t({vertexShader:ie,fragmentShader:e,uniforms:n,depthTest:!1,depthWrite:!1,blending:0,toneMapped:!1,...r}),ye=class{renderer;grade;outWidth=1;outHeight=1;sentinel;depthUniforms={tSceneDepth:{value:null},uSceneDepthRes:{value:new y(1,1)}};sets=[];scales=[1];levelIndex=0;t;setsStale=!1;lumGridRT;lumRT;lumIndex=0;sun=null;volActive=!1;quality;quad;cam=new p(-1,1,1,-1,0,1);black;depthMat;lumAMat;lumBMat;prefilterMat;downMat;upMat;shaftMat;volMat;volBlurMat;compositeMat;finalMat;sunNdc=new k;lastCam=new k(1e9,0,0);shocks=[];resetAdapt=2;time=0;framePending=!1;depthDone=!1;shaftVisibility=0;timerExt=null;spans={scene:{queries:[],pending:[],ms:0},post:{queries:[],pending:[],ms:0}};constructor(e,n){this.renderer=e,this.grade=ge(),this.quality=n;let i=new D;i.setAttribute(`position`,new o([-1,-1,0,3,-1,0,-1,3,0],3)),i.setAttribute(`uv`,new o([0,0,2,0,0,2],2)),this.quad=new A(i),this.quad.frustumCulled=!1,this.black=new r(new Uint8Array([0,0,0,255]),1,1),this.black.needsUpdate=!0;let a=new D;a.setAttribute(`position`,new o([0,0,0,0,0,0,0,0,0],3)),a.setDrawRange(0,0),this.sentinel=new A(a,new t({name:`mender.depthSentinel`,vertexShader:`void main() { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); }`,fragmentShader:`void main() { gl_FragColor = vec4( 0.0 ); }`,transparent:!0,depthTest:!1,depthWrite:!1,colorWrite:!1,fog:!1,toneMapped:!1})),this.sentinel.name=`mender.depthSentinel`,this.sentinel.frustumCulled=!1,this.sentinel.renderOrder=-1e9,this.sentinel.onBeforeRender=e=>{this.framePending&&!this.depthDone&&e.getRenderTarget()===this.t.scene&&(this.depthPass(),e.setRenderTarget(this.t.scene))};let s={minFilter:g,magFilter:g};this.lumGridRT=Y(16,9,s),this.lumRT=[Y(1,1,s),Y(1,1,s)],this.depthMat=X(G,{tDepth:{value:null},tColor:{value:null},uCam:{value:new y},uFullSize:{value:new y},uSun:{value:new k},uAspect:{value:1}}),this.lumAMat=X(K,{tSrc:{value:null},uCell:{value:new y(1/16,1/9)}}),this.lumBMat=X(q,{tGrid:{value:null},tPrev:{value:null},uGrid:{value:new y(16,9)},uAdapt:{value:new k(.016,2.2,1.1)},uReset:{value:1}}),this.prefilterMat=X(le,{tSrc:{value:null},tLum:{value:null},uTexel:{value:new y},uThreshold:{value:new E},uAuto:{value:new k}},{defines:{PREFILTER_GRID:ve(n)}}),this.downMat=X(J,{tSrc:{value:null},uTexel:{value:new y}}),this.upMat=X(de,{tSrc:{value:null},uTexel:{value:new y},uWeight:{value:1}},{blending:5,blendEquation:100,blendSrc:201,blendDst:201}),this.shaftMat=X(fe,{tSrc:{value:null},uSunUV:{value:new y},uShaft:{value:new k(.9,.955,1)}},{defines:{SHAFT_SAMPLES:n.shaftSamples}}),this.volMat=X(ue,{tDepth:{value:null},tShadow:{value:null},uShadowM:{value:[new w,new w]},uCascadeEnd:{value:new y},uProjInv:{value:new w},uCamWorld:{value:new w},uCamPos:{value:new k},uLightDir:{value:new k(0,1,0)},uVol:{value:new E},uVolH:{value:new E}},{defines:{VOL_STEPS:Math.max(1,n.volSteps)}}),this.volBlurMat=X(pe,{tSrc:{value:null}}),this.compositeMat=X(me,{tScene:{value:null},tBloom:{value:null},tShaft:{value:this.black},tLum:{value:null},tVol:{value:this.black},tDepthH:{value:null},uVolColor:{value:new T(0,0,0)},uVolTexel:{value:new y},uExpo:{value:new E},uAutoRange:{value:new y},uShaftColor:{value:new T},uGradeA:{value:new E},uShadowTint:{value:new T},uHighTint:{value:new T},uLift:{value:new T},uVignette:{value:new E},uMood:{value:new k},uLook:{value:new y},uScreen:{value:new y},uShock:{value:Array.from({length:4},()=>new E)},uShockW:{value:Array.from({length:4},()=>new E)}},{defines:{TONEMAP:0}}),this.finalMat=X(he,{tSrc:{value:null},uTexel:{value:new y},uFinal:{value:new E}});let c=e.getContext();this.timerExt=c.getExtension(`EXT_disjoint_timer_query_webgl2`)}get canvasWidth(){return Math.min(this.width,this.outWidth)}get canvasHeight(){return Math.min(this.height,this.outHeight)}get width(){return this.t?.width??1}get height(){return this.t?.height??1}get sceneRT(){return this.t.scene}get level(){return this.levelIndex}get levelCount(){return this.scales.length}scaleAt(e){return this.scales[Math.max(0,Math.min(this.scales.length-1,e))]}setTonemap(e){let t=e===`aces`?1:e===`neutral`?2:0;this.compositeMat.defines.TONEMAP!==t&&(this.compositeMat.defines.TONEMAP=t,this.compositeMat.needsUpdate=!0)}setQuality(e){let t=e.bloomLevels!==this.quality.bloomLevels||e.bloomDiv!==this.quality.bloomDiv;ve(e)!==this.prefilterMat.defines.PREFILTER_GRID&&(this.prefilterMat.defines={PREFILTER_GRID:ve(e)},this.prefilterMat.needsUpdate=!0),e.shaftSamples!==this.quality.shaftSamples&&(this.shaftMat.defines={SHAFT_SAMPLES:e.shaftSamples},this.shaftMat.needsUpdate=!0),e.volSteps!==this.quality.volSteps&&e.volSteps>0&&(this.volMat.defines={VOL_STEPS:e.volSteps},this.volMat.needsUpdate=!0),this.quality=e,t&&(this.setsStale=!0)}setSun(e){this.sun=e}configure(e,t,n){if(e=Math.max(1,Math.floor(e)),t=Math.max(1,Math.floor(t)),e===this.outWidth&&t===this.outHeight&&n.length===this.scales.length&&n.every((e,t)=>e===this.scales[t])&&this.t&&!this.setsStale)return!1;this.outWidth=e,this.outHeight=t;let r=this.renderer.domElement;return(r.width!==e||r.height!==t)&&this.renderer.setDrawingBufferSize(e,t,1),this.scales=n.length?n.slice():[1],this.levelIndex=0,this.resetSets(),!0}setLevel(e){e=Math.max(0,Math.min(this.scales.length-1,Math.round(e))),!(e===this.levelIndex&&this.t)&&(this.levelIndex=e,this.activate())}resetSets(){this.setsStale=!1;for(let e of this.sets)e&&this.disposeSet(e);this.sets=this.scales.map(()=>null),this.levelIndex=Math.min(this.levelIndex,this.scales.length-1),this.activate()}activate(){let e=this.sets[this.levelIndex];if(!e){let t=this.scales[this.levelIndex];e=this.allocate(Math.max(8,Math.round(this.outWidth*t)),Math.max(8,Math.round(this.outHeight*t))),this.sets[this.levelIndex]=e}this.t=e,this.depthUniforms.tSceneDepth.value=e.depth.texture,this.depthUniforms.uSceneDepthRes.value.set(e.width,e.height);let t=this.canvasWidth,n=this.canvasHeight,r=this.renderer.domElement.style;r.transformOrigin=`0 100%`,r.transform=t<this.outWidth||n<this.outHeight?`scale(${this.outWidth/t}, ${this.outHeight/n})`:``}allocate(e,t){let n=new i(e,t);n.type=h;let r=Y(e,t,{depthBuffer:!0,depthTexture:n});r.texture.name=`mender.scene`;let a={minFilter:g,magFilter:g},o=Y(Math.ceil(e/2),Math.ceil(t/2),{...a,format:x});o.texture.name=`mender.depthHalf`;let s=[],c=Math.ceil(e/this.quality.bloomDiv),l=Math.ceil(t/this.quality.bloomDiv);for(let e=0;e<this.quality.bloomLevels&&c>=4&&l>=4;e++)s.push(Y(c,l)),c=Math.ceil(c/2),l=Math.ceil(l/2);let u=Math.ceil(e/4),d=Math.ceil(t/4),f=Y(u,d,{format:M}),p=Y(u,d,{format:x});p.texture.name=`mender.volumetric`;let m=Y(u,d,{format:x}),_=_e(e,t);return this.resetAdapt=Math.max(this.resetAdapt,1),{width:e,height:t,scene:r,depth:o,bloom:s,shaft:f,vol:p,volBlur:m,ldr:_}}disposeSet(e){e.scene.depthTexture?.dispose();for(let t of[e.scene,e.depth,...e.bloom,e.shaft,e.vol,e.volBlur,e.ldr])t.dispose()}dispose(){for(let e of this.sets)e&&this.disposeSet(e);this.sets=[];for(let e of[this.lumGridRT,...this.lumRT])e.dispose()}shock(e,t,n,r=1){let i=this.shocks.find(e=>e.t>=e.duration);!i&&this.shocks.length<4&&(i={pos:new k,radius:0,duration:1,strength:0,t:0},this.shocks.push(i)),i||=this.shocks.reduce((e,t)=>e.strength*(1-e.t/e.duration)<t.strength*(1-t.t/t.duration)?e:t),i.pos.copy(e),i.radius=Math.max(.5,t),i.duration=Math.max(.05,n),i.strength=Math.min(2,Math.max(0,r)),i.t=0}updateShocks(e,t){let n=this.compositeMat.uniforms.uShock.value,r=this.compositeMat.uniforms.uShockW.value,i=e.projectionMatrix.elements[5];for(let a=0;a<4;a++){let o=this.shocks[a];if(n[a].w=0,!o||o.t>=o.duration)continue;o.t+=t;let s=Math.min(1,o.t/o.duration);Z.copy(o.pos).applyMatrix4(e.matrixWorldInverse);let c=-Z.z;if(c<.3)continue;Z.copy(o.pos).project(e);let l=o.radius*(1-(1-s)*(1-s)*(1-s))/c*i*.5,u=(1-s)*(1-s)*Math.min(1,o.t/.04);n[a].set(Z.x*.5+.5,Z.y*.5+.5,l,.018*o.strength*u*Math.min(1,6/c+.35)),r[a].set(Math.max(.006,l*.11),.22*o.strength,0,0)}}compilePrograms(){let e=this.renderer,t=e.getRenderTarget(),n=[this.depthMat,this.lumAMat,this.lumBMat,this.prefilterMat,this.downMat,this.upMat,this.shaftMat,this.volMat,this.volBlurMat,this.compositeMat];try{e.setRenderTarget(this.t.ldr);for(let t of n)this.quad.material=t,e.compile(this.quad,this.cam);e.setRenderTarget(null),this.quad.material=this.finalMat,e.compile(this.quad,this.cam)}finally{e.setRenderTarget(t)}return[...n,this.finalMat]}pass(e,t){this.quad.material=e,this.renderer.setRenderTarget(t),this.renderer.render(this.quad,this.cam)}finalPass(){let e=this.renderer;this.quad.material=this.finalMat,e.setRenderTarget(null),e.setViewport(0,0,this.canvasWidth,this.canvasHeight),e.render(this.quad,this.cam),e.setViewport(0,0,this.outWidth,this.outHeight)}depthPass(){this.depthDone=!0,this.pass(this.depthMat,this.t.depth)}spanOpen=!1;beginSpan(e){let t=this.timerExt;if(!t||this.spanOpen)return;let n=this.renderer.getContext(),r=this.spans[e];for(;r.pending.length;){let e=r.pending[0];if(!n.getQueryParameter(e,n.QUERY_RESULT_AVAILABLE))break;r.pending.shift(),n.getParameter(t.GPU_DISJOINT_EXT)||(r.ms=r.ms*.9+n.getQueryParameter(e,n.QUERY_RESULT)/1e6*.1),r.queries.push(e)}if(r.pending.length>6)return;let i=r.queries.pop()??n.createQuery();i&&(n.beginQuery(t.TIME_ELAPSED_EXT,i),r.pending.push(i),this.spanOpen=!0)}endSpan(){let e=this.timerExt;e&&this.spanOpen&&(this.renderer.getContext().endQuery(e.TIME_ELAPSED_EXT),this.spanOpen=!1)}get gpuSceneMs(){return this.spans.scene.ms}get gpuPostMs(){return this.spans.post.ms}get hasTimer(){return!!this.timerExt}get volumetricOn(){return this.volActive}render(e,t,n,r,i,a,o){let s=this.renderer,c=this.grade,l=this.quality,u=this.t;this.time+=r,this.lastCam.distanceToSquared(t.position)>3600&&(this.resetAdapt=Math.max(this.resetAdapt,1)),this.lastCam.copy(t.position),t.updateMatrixWorld(),this.sunNdc.copy(i).multiplyScalar(1e3).add(t.position).project(t);let d=i.dot(t.getWorldDirection(Z))>.05,f=this.sunNdc.x*.5+.5,p=this.sunNdc.y*.5+.5,m=Math.max(0,Math.max(Math.abs(f-.5),Math.abs(p-.5))-.5);this.shaftVisibility=l.shafts&&d?Math.max(0,1-m/.45)*a:0;let h=this.shaftVisibility>.002,g=this.depthMat.uniforms;g.tDepth.value=u.scene.depthTexture,g.tColor.value=u.scene.texture,g.uCam.value.set(t.near,t.far),g.uFullSize.value.set(u.width,u.height),g.uSun.value.set(f,p,+!!h),g.uAspect.value=u.width/u.height,this.beginSpan(`scene`),s.setRenderTarget(u.scene),s.setClearColor(o,1),s.clear(!0,!0,!1),this.framePending=!0,this.depthDone=!1;try{s.render(e,t)}finally{this.framePending=!1}this.endSpan(),this.beginSpan(`post`),this.depthDone||this.depthPass(),n&&n.children.length&&(s.setRenderTarget(u.scene),s.render(n,t)),this.lumAMat.uniforms.tSrc.value=u.scene.texture,this.pass(this.lumAMat,this.lumGridRT);let _=this.lumRT[this.lumIndex],v=this.lumRT[1-this.lumIndex],y=this.lumBMat.uniforms;y.tGrid.value=this.lumGridRT.texture,y.tPrev.value=_.texture,y.uAdapt.value.x=Math.min(r,.1),y.uReset.value=+(this.resetAdapt>0),this.resetAdapt>0&&this.resetAdapt--,this.pass(this.lumBMat,v),this.lumIndex=1-this.lumIndex;let b=v.texture,x=u.bloom.length,S=x>0&&c.bloom>0;if(S){let e=this.prefilterMat.uniforms;e.tSrc.value=u.scene.texture,e.tLum.value=b,e.uTexel.value.set(1/u.width,1/u.height),e.uThreshold.value.set(c.bloomThreshold,c.bloomKnee,c.exposure,c.autoStrength),e.uAuto.value.set(c.autoTarget,c.autoMin,c.autoMax),this.bloomChain()}h&&(this.shaftMat.uniforms.tSrc.value=u.depth.texture,this.shaftMat.uniforms.uSunUV.value.set(f,p),this.pass(this.shaftMat,u.shaft));let C=this.volumePass(t,i);this.updateShocks(t,r);let w=this.compositeMat.uniforms;w.tScene.value=u.scene.texture,w.tBloom.value=S?u.bloom[0].texture:this.black,w.tShaft.value=h?u.shaft.texture:this.black,w.tLum.value=b,w.tVol.value=C?u.volBlur.texture:this.black,w.tDepthH.value=u.depth.texture,w.uVolColor.value.copy(C?c.volColor:be),w.uVolTexel.value.set(1/u.vol.width,1/u.vol.height),w.uExpo.value.set(c.exposure,c.autoStrength,c.autoTarget,x>0?c.bloom/x:0),w.uAutoRange.value.set(c.autoMin,c.autoMax),w.uShaftColor.value.copy(c.shaftColor).multiplyScalar(h?this.shaftVisibility:0),w.uGradeA.value.set(c.contrast,c.saturation,c.vibrance,c.split),w.uShadowTint.value.copy(c.shadowTint),w.uHighTint.value.copy(c.highTint),w.uLift.value.copy(c.lift),w.uVignette.value.set(c.vignetteColor.r,c.vignetteColor.g,c.vignetteColor.b,c.vignette),w.uMood.value.set(c.night,c.rain,c.cave),w.uLook.value.set(c.lookPower,c.lookSaturation),w.uScreen.value.set(u.width/u.height,this.time),this.pass(this.compositeMat,u.ldr);let T=this.outWidth/u.width,E=this.finalMat.uniforms;E.tSrc.value=u.ldr.texture,E.uTexel.value.set(1/u.width,1/u.height),E.uFinal.value.set(+!!l.fxaa,l.sharpen*O.clamp(T,1,1.5),l.grain*O.clamp(1/T,.6,1),this.time),this.finalPass(),this.endSpan()}volumePass(e,t){let n=this.grade,r=this.t,i=this.sun?.castShadow?this.sun.shadow:null,a=i?.map?.depthTexture??null;if(this.volActive=!!(i&&a&&this.quality.volSteps>0&&n.volColor.r+n.volColor.g+n.volColor.b>1e-5),!this.volActive||!i)return!1;let o=this.volMat.uniforms;o.tDepth.value=r.depth.texture,o.tShadow.value=a;let s=o.uShadowM.value;s[0].copy(i.getMatrix(0)),s[1].copy(i.getMatrix(1));let c=i._cascadeData;return o.uCascadeEnd.value.set(c?.[0]?.y??60,c?.[1]?.y??200),o.uProjInv.value.copy(e.projectionMatrixInverse),o.uCamWorld.value.copy(e.matrixWorld),o.uCamPos.value.copy(e.position),o.uLightDir.value.copy(t),o.uVol.value.set(Math.min(n.volMax,o.uCascadeEnd.value.y),n.volDensity,n.volG,n.volIso),o.uVolH.value.set(n.volFalloff,n.volBase,0,0),this.pass(this.volMat,r.vol),this.volBlurMat.uniforms.tSrc.value=r.vol.texture,this.pass(this.volBlurMat,r.volBlur),!0}bloomChain(){let e=this.t.bloom,t=e.length;this.pass(this.prefilterMat,e[0]);for(let n=1;n<t;n++){let t=e[n-1];this.downMat.uniforms.tSrc.value=t.texture,this.downMat.uniforms.uTexel.value.set(1/t.width,1/t.height),this.pass(this.downMat,e[n])}for(let n=t-1;n>0;n--){let t=e[n];this.upMat.uniforms.tSrc.value=t.texture,this.upMat.uniforms.uTexel.value.set(1/t.width,1/t.height),this.upMat.uniforms.uWeight.value=1,this.pass(this.upMat,e[n-1])}}probeHdr(){let e=this.t.width,t=this.t.height,n=new Uint16Array(e*t*4);this.renderer.readRenderTargetPixels(this.t.scene,0,0,e,t,n);let r=0,i=0,a=0,o=0,s=0,c=0,l=0,u=[];for(let d=0;d<e*t;d++){let f=j.fromHalfFloat(n[d*4]),p=j.fromHalfFloat(n[d*4+1]),m=j.fromHalfFloat(n[d*4+2]),h=.2126*f+.7152*p+.0722*m;if(!Number.isFinite(h)){c++<12&&u.push([d%e,t-1-Math.floor(d/e)]);continue}l+=h,h>4&&o++,h>32&&s++,h>r&&(r=h,i=d%e,a=t-1-Math.floor(d/e))}let d=new Uint16Array(4);this.renderer.readRenderTargetPixels(this.lumRT[this.lumIndex],0,0,1,1,d);let f=this.grade,p=j.fromHalfFloat(d[0]),m=Math.min(f.autoMax,Math.max(f.autoMin,(f.autoTarget/Math.max(p,1e-4))**+f.autoStrength));return{max:+r.toFixed(2),at:[i,a],over4:o,over32:s,nonFinite:c,badAt:u,mean:+(l/(e*t)).toFixed(4),meter:+p.toFixed(5),auto:+m.toFixed(3)}}benchmarkPasses(e){let t=this.renderer,n=this.t,r=t.getContext(),i=new Uint8Array(4),a=()=>{t.setRenderTarget(null),r.readPixels(0,0,1,1,r.RGBA,r.UNSIGNED_BYTE,i)},o=t=>{a();let n=performance.now();for(let n=0;n<e;n++)t();return a(),+((performance.now()-n)/e).toFixed(3)},s=n.bloom.length>0&&this.grade.bloom>0,c={depth:o(()=>this.pass(this.depthMat,n.depth)),lum:o(()=>{this.pass(this.lumAMat,this.lumGridRT),this.pass(this.lumBMat,this.lumRT[1-this.lumIndex])}),bloom:s?o(()=>this.bloomChain()):0,shafts:this.quality.shafts?o(()=>this.pass(this.shaftMat,n.shaft)):0,volumetric:this.volActive?o(()=>{this.pass(this.volMat,n.vol),this.pass(this.volBlurMat,n.volBlur)}):0,composite:o(()=>this.pass(this.compositeMat,n.ldr)),final:o(()=>this.finalPass())};return c.total=+Object.values(c).reduce((e,t)=>e+t,0).toFixed(3),c}},Z=new k,be=new T(0,0,0),xe=class{renderer;sun;enabled=!0;farDrawn=0;farKept=0;frame=0;keepFar=!1;valid=!1;savedMatrix=new w;savedCamPos=new k;savedCamFwd=new k;savedDir=new k;savedProj0=0;savedProj5=0;savedRadius=0;dir=new k;fwd=new k;rect=new E;clearFn=null;updateFn=null;nearClear=(e,t,n)=>{let r=this.renderer;r.state.setScissorTest(!0),r.state.scissor(this.rect),this.clearFn.call(r,e,t,n),r.state.setScissorTest(!1)};keepUpdate=(e,t)=>{let n=this.sun.shadow;this.updateFn.call(n,e,t),n.getMatrix(1).copy(this.savedMatrix)};constructor(e,t){this.renderer=e,this.sun=t}beginFrame(){this.frame++,this.keepFar=this.enabled&&(this.frame&1)==1}invalidate(){this.valid=!1}run(e,t){let n=this.sun.shadow,r=this.keepFar&&this.valid&&this.sun.castShadow&&!!this.sun.shadow.map&&n._viewportCount===2;if(this.keepFar=!1,r){let e=t.matrixWorld.elements,n=t.projectionMatrix.elements;this.fwd.set(-e[8],-e[9],-e[10]).normalize(),this.dir.setFromMatrixPosition(this.sun.matrixWorld).normalize(),((e[12]-this.savedCamPos.x)**2+(e[13]-this.savedCamPos.y)**2+(e[14]-this.savedCamPos.z)**2>(.03*this.savedRadius)**2||this.fwd.dot(this.savedCamFwd)<.99966||this.dir.dot(this.savedDir)<.99999||Math.abs(n[0]-this.savedProj0)>1e-4*Math.abs(this.savedProj0)||Math.abs(n[5]-this.savedProj5)>1e-4*Math.abs(this.savedProj5))&&(r=!1)}if(!r){e(),this.save(n,t),this.farDrawn++;return}let i=this.renderer,a=this.sun.shadow.mapSize;this.rect.set(0,0,a.x,a.y),this.clearFn=i.clear,this.updateFn=n.updateMatrices,n._viewportCount=1,i.clear=this.nearClear,n.updateMatrices=this.keepUpdate;try{e()}finally{n._viewportCount=2,i.clear=this.clearFn,n.updateMatrices=this.updateFn}this.farKept++}save(e,t){let n=t.matrixWorld.elements;this.savedMatrix.copy(e.getMatrix(1)),this.savedRadius=e.getCamera(1).right,this.savedCamPos.set(n[12],n[13],n[14]),this.savedCamFwd.set(-n[8],-n[9],-n[10]).normalize(),this.savedProj0=t.projectionMatrix.elements[0],this.savedProj5=t.projectionMatrix.elements[5],this.savedDir.setFromMatrixPosition(this.sun.matrixWorld).normalize(),this.valid=!0}},Se=e=>{if(!Array.isArray(e))return e.version;let t=0;for(let n of e)t+=n.version;return t},Ce=[0,1,3,2],we=10,Te=Object.freeze([]),Ee={0:1,1:0,2:2},Q=e=>e.isMesh===!0||e.isPoints===!0||e.isLine===!0||e.isSprite===!0,De=e=>e.castShadow||e.customDepthMaterial!==void 0||e.receiveShadow&&e.isMesh===!0,Oe=()=>new Promise(e=>setTimeout(e,0));function ke(e){let t={},n=0;e.traverseVisible(e=>{let r=e;r.isLight&&(t[r.type]=(t[r.type]??0)+1,r.castShadow&&n++)});let r=e.environment;return`${Object.keys(t).sort().map(e=>e+t[e]).join(``)}|${n}|${r?`${r.mapping}:${r.image?.height??0}`:`-`}|${+!!e.fog}`}var Ae=class{host;done=new WeakMap;depthDone=new WeakMap;failed=new WeakSet;root=new n;depthBase=new Map;compileCam=new te;bgHandle=0;bgRunning=!1;warmed=!1;warmedAt=0;known=new Set;linking=new Set;deferredQueue=[];lastCount=-1;compiledObjects=0;settleFrames=0;postDirty=!1;late=[];lateCount=0;stats={bgMs:0,bgSlices:0,sweepMs:0,linkMs:0,uploadMs:0,frameMs:0,aroundMs:0,totalMs:0,programs:0,syncPrograms:0,needed:0,deferred:0,deferredLeft:0,textures:0,skippedDraws:0,slowestMs:0,slowest:``};constructor(e){this.host=e,this.root.name=`mender.warmRoot`,this.installDrawGuard()}get programs(){return this.host.renderer.info.programs}programsOf(e){return e?this.host.renderer.properties.get(e).programs:void 0}installDrawGuard(){let e=this.host.renderer,t=e.renderBufferDirect,n=this.linking,r=this.stats,i=e=>this.programsOf(e);e.renderBufferDirect=function(e,a,o,s,c,l){if(n.size!==0){let e=i(s);if(e){for(let t of e.values())if(n.has(t)){r.skippedDraws++;return}}}t.call(this,e,a,o,s,c,l)}}startBackground(){if(this.bgRunning)return;this.bgRunning=!0;let e=()=>{if(!this.bgRunning)return;let t=!1;if(this.host.hasEnvironment()){let e=performance.now(),n=this.compiledObjects;try{t=!this.sweep(e+8)||this.compiledObjects!==n}catch(e){console.warn(`[render] background shader compile failed`,e)}this.stats.bgMs+=performance.now()-e,this.stats.bgSlices++}this.bgHandle=window.setTimeout(e,t?16:90)};this.bgHandle=window.setTimeout(e,24)}stopBackground(){this.bgRunning=!1,clearTimeout(this.bgHandle)}sweep(e){let{scene:t,overlay:n}=this.host,r=ke(t),i=ke(n),a=(e,t,n)=>{let r=e.get(t);return!r||r.m!==t.material||r.v!==Se(t.material)||r.d!==t.customDepthMaterial||r.sig!==n},o=[],s=[],c=[];t.traverse(e=>{Q(e)&&e.material&&!this.failed.has(e)&&(a(this.done,e,r)&&o.push(e),De(e)&&a(this.depthDone,e,r)&&s.push(e))}),n.traverse(e=>{Q(e)&&e.material&&!this.failed.has(e)&&a(this.done,e,i)&&c.push(e)});let l=this.host.sceneTarget();return this.batches(o,e,e=>this.compileBatch(e,t,l,this.done,r))&&this.batches(c,e,e=>this.compileBatch(e,n,l,this.done,i))&&this.batches(s,e,e=>this.compileDepth(e,l,r))}batches(e,t,n){for(let r=0;r<e.length;r+=24){if(performance.now()>t)return!1;let i=e.slice(r,r+24);try{n(i)}catch{for(let e of i)try{n([e])}catch(t){this.failed.add(e),console.warn(`[render] shader warm-up skipped "${e.name}"`,t)}}}return!0}compileBatch(e,t,n,r,i){let a=this.host.renderer,o=a.getRenderTarget(),s=[];for(let t of e)s.push(t.children),t.children=Te;this.root.children=e;try{if(a.setRenderTarget(n),a.compile(this.root,this.compileCam,t),r)for(let t of e)r.set(t,{m:t.material,v:Se(t.material),d:t.customDepthMaterial,sig:i});this.compiledObjects+=e.length}finally{this.root.children=[];for(let t=0;t<e.length;t++)e[t].children=s[t];a.setRenderTarget(o)}}compileDepth(e,t,n){let r=this.host.scene,i=[],a=new Map;for(let t of e){let e=t.material,n=Array.isArray(e)?e:[e],r=[],o=0;for(let e of n){let{mat:n,state:i,custom:s}=this.depthFor(t,e);if(r.push(n),s){let e=a.get(n);e||a.set(n,e=[]);let t=e.indexOf(i);t<0&&(t=e.length,e.push(i)),o=Math.max(o,t)}}(i[o]??=[]).push({o:t,mats:e,depth:Array.isArray(e)?r:r[0]})}let o=r.fog,s=r.environment;for(let e of i)if(e){for(let t of e)this.applyDepthState(t.o,t.mats),t.o.material=t.depth;r.fog=null,r.environment=null;try{this.compileBatch(e.map(e=>e.o),r,t,null,n)}finally{r.fog=o,r.environment=s;for(let t of e)t.o.material=t.mats,this.depthDone.set(t.o,{m:t.mats,v:Se(t.mats),d:t.o.customDepthMaterial,sig:n})}}}depthFor(e,t){let n=t,r=n.shadowSide??Ee[n.side],i=n.alphaToCoverage?.5:n.alphaTest,a=`${r}|${n.map?n.map.channel:`-`}|${n.alphaMap?n.alphaMap.channel:`-`}|${+(i>0)}|${n.displacementMap&&n.displacementScale!==0?n.displacementMap.channel:`-`}`,o=e.customDepthMaterial;if(o)return{mat:o,state:a,custom:!0};let s=this.depthBase.get(a);return s||(s=new b,s.name=`mender.warmDepth`,this.depthBase.set(a,s)),{mat:s,state:a,custom:!1}}applyDepthState(e,t){let n=Array.isArray(t)?t:[t];for(let t of n){let n=t,r=this.depthFor(e,t).mat;r.side=n.shadowSide??Ee[n.side],r.alphaTest=n.alphaToCoverage?.5:n.alphaTest,r.alphaMap=n.alphaMap??null,r.map=n.map??null,r.displacementMap=n.displacementMap??null,r.displacementScale=n.displacementScale??1,r.clipShadows=n.clipShadows,r.clippingPlanes=n.clippingPlanes,r.clipIntersection=n.clipIntersection}}async warmup(e){let t=performance.now();this.stopBackground();let n=t=>{try{e?.(Math.min(1,Math.max(0,t)))}catch{}},r=this.host.envReady();r&&await Promise.race([r,new Promise(e=>setTimeout(e,2e4))]),n(.02);let i=performance.now();for(;!this.sweep(performance.now()+30);)await Oe();let a=[];try{a=this.host.compilePost()}catch(e){console.warn(`[render] post pass pre-compile failed`,e)}this.stats.sweepMs=performance.now()-i,n(.15);let o=performance.now(),{needed:s,deferred:c}=this.classify(a),l=new Set(s);for(let e of s)this.linking.add(e);for(let e of c){if(e.isReady()){e.getUniforms();continue}this.linking.add(e),this.deferredQueue.push(e)}this.stats.needed=s.length;let u=Math.max(1,l.size),d=this.collectTextures(),f=0,p=0,m=0,h=null;for(;performance.now()-o<45e3;){for(let e of l)e.isReady()&&(l.delete(e),this.linking.delete(e),e.getUniforms(),h=e,this.stats.slowestMs=performance.now()-o);this.pollDeferred(6,2),n(.15+.7*(1-l.size/u));let e=performance.now()+we,t=!1;for(;f<d.length&&performance.now()<e;)this.upload(d[f++]),t=!0;if(!t&&p<Ce.length&&l.size>0){let e=performance.now();try{this.renderAround(p)}catch(e){console.warn(`[render] warm-up render failed`,e),p=Ce.length}p++,m+=performance.now()-e,t=!0}if(!t&&!l.size)break;await(t?Oe():new Promise(e=>setTimeout(e,16)))}this.aroundRT?.dispose(),this.aroundRT=null;for(let e of l)this.deferredQueue.push(e);this.stats.textures=f,this.stats.aroundMs=m,this.stats.linkMs=performance.now()-o,this.stats.slowestMs=Math.round(this.stats.slowestMs),h&&(this.stats.slowest=this.describe(h));let g=performance.now(),_=this.programs.length;try{this.host.renderFrame()}catch(e){console.warn(`[render] warm-up frame failed`,e)}this.stats.frameMs=performance.now()-g,this.stats.uploadMs=m+this.stats.frameMs,this.stats.syncPrograms=this.programs.length-_;for(let e of this.programs)this.known.add(e);this.stats.programs=this.known.size,this.stats.deferred=this.linking.size,this.stats.totalMs=performance.now()-t,this.warmed=!0,this.warmedAt=performance.now(),n(1)}classify(e){let t=new Set,n=e=>{this.programsOf(e)?.forEach(e=>t.add(e))};e.forEach(n),this.depthBase.forEach(n);let r=e=>{if(!e.visible)return;Q(e)&&e.material&&(Array.isArray(e.material)?e.material.forEach(n):n(e.material),n(e.customDepthMaterial),n(e.customDistanceMaterial));let t=e.children;for(let e=0;e<t.length;e++)r(t[e])};r(this.host.scene),r(this.host.overlay);let i=[],a=[];for(let e of this.programs)(t.has(e)?i:a).push(e);return{needed:i,deferred:a}}pollDeferred(e,t){let n=this.deferredQueue;for(let r=Math.min(e,n.length);r>0&&t>0;r--){let e=n.shift();if(this.linking.has(e)){if(!this.programs.includes(e)){this.linking.delete(e);continue}e.isReady()?(e.getUniforms(),this.linking.delete(e),t--):n.push(e)}}this.stats.deferredLeft=n.length}collectTextures(){let e=new Set,t=new Set,n=t=>{if(Array.isArray(t)){for(let e of t)n(e);return}let r=t;r&&r.isTexture&&!r.isRenderTargetTexture&&r.version>0&&e.add(r)},r=e=>{if(t.has(e))return;t.add(e);let r=e;for(let e in r)n(r[e]);let i=e.uniforms;if(i)for(let e in i)n(i[e]?.value)},i=e=>{Q(e)&&e.material&&(Array.isArray(e.material)?e.material.forEach(r):r(e.material))};return this.host.scene.traverse(i),this.host.overlay.traverse(i),[...e]}upload(e){try{this.host.renderer.initTexture(e)}catch{}}async precompile(e,t=!1){let{scene:n,overlay:r}=this.host,i=t?r:n,a=ke(i),o=ke(n),s=[],c=[];e.traverse(e=>{Q(e)&&e.material&&(s.push(e),e.castShadow&&!t&&c.push(e))});let l=new Set(this.programs),u=this.host.sceneTarget();for(let e=0;e<s.length;e+=24)this.compileBatch(s.slice(e,e+24),i,u,this.done,a);for(let e=0;e<c.length;e+=24)this.compileDepth(c.slice(e,e+24),u,o);let d=this.programs.filter(e=>!l.has(e)),f=performance.now();for(;d.some(e=>!e.isReady())&&performance.now()-f<2e4;)await new Promise(e=>setTimeout(e,16));for(let e of d)e.getUniforms(),this.known.add(e)}aroundRT=null;aroundCam=new te(92,1,.5,1600);aroundDir=new k;renderAround(e){let{renderer:t,scene:n,camera:r}=this.host,i=this.aroundRT??=new S(96,96,{type:m,depthBuffer:!0}),a=this.aroundCam;a.position.copy(r.position),r.getWorldDirection(this.aroundDir);let o=Math.round(Math.atan2(this.aroundDir.x,this.aroundDir.z)/(Math.PI/2))*(Math.PI/2)+Ce[e]*(Math.PI/2);a.lookAt(a.position.x+Math.sin(o),a.position.y,a.position.z+Math.cos(o)),a.updateMatrixWorld();let s=t.getRenderTarget(),c=t.shadowMap.autoUpdate,l=new Set;n.traverse(e=>{if(e.isLight)for(let t=e;t;t=t.parent)l.add(t)});let u=[];n.traverse(e=>{!e.visible&&!l.has(e)&&(e.visible=!0,u.push(e))}),t.shadowMap.autoUpdate=e===0;try{t.setRenderTarget(i),t.render(n,a)}finally{for(let e of u)e.visible=!1;t.shadowMap.autoUpdate=c,t.setRenderTarget(s),e===Ce.length-1&&(i.dispose(),this.aroundRT=null)}}describe(e){let t=this.host.renderer.properties,n=``,r=r=>{if(n||!Q(r)||!r.material)return;let i=Array.isArray(r.material)?r.material:[r.material],a=r.customDepthMaterial;for(let o of a?[...i,a]:i)if(t.get(o).programs?.get(e.cacheKey)===e){let e=r.name||r.type;for(let t=r.parent;t&&t!==this.host.scene&&t!==this.host.overlay;t=t.parent)if(t.name){e=`${t.name}/${e}`;break}n=`${o===a?`shadow depth of `:``}${o.name||o.type} on "${e}"`;return}};return this.host.scene.traverse(r),n||this.host.overlay.traverse(r),n||`${e.name||e.cacheKey.split(`,`)[0]} (shadow depth or off-scene)`}requalify(e=90){this.settleFrames=Math.max(this.settleFrames,e),this.postDirty=!0}beforeFrame(){if(!(!this.warmed||this.settleFrames<=0)){this.settleFrames--;try{this.sweep(1/0),this.postDirty&&(this.postDirty=!1,this.host.compilePost())}catch(e){console.warn(`[render] re-qualify compile failed`,e)}for(let e of this.programs)if(!this.known.has(e)){if(this.known.add(e),e.isReady()){e.getUniforms();continue}this.linking.add(e),this.deferredQueue.push(e)}}}trackLate(){if(!this.warmed)return;this.deferredQueue.length&&this.pollDeferred(3,1);let e=this.programs;if(e.length!==this.lastCount){this.lastCount=e.length;for(let t of e)if(!this.known.has(t)&&(this.known.add(t),this.lateCount++,this.late.length<32)){let e=`${this.describe(t)} +${((performance.now()-this.warmedAt)/1e3).toFixed(1)}s`;this.late.push(e)}}}};N();var $={low:{pixels:1e6,shadowSize:1024,shadowFar:130,shadowRadius:1.6,envSize:128,levels:[1,.87,.75],post:{bloomDiv:4,bloomLevels:3,shafts:!1,shaftSamples:16,volSteps:0,fxaa:!0,sharpen:.12,grain:.012}},medium:{pixels:21e5,shadowSize:2048,shadowFar:200,shadowRadius:2.4,envSize:128,levels:[1,.87,.75,.62],post:{bloomDiv:8,bloomLevels:3,shafts:!0,shaftSamples:20,volSteps:12,fxaa:!0,sharpen:.15,grain:.014}},high:{pixels:37e5,shadowSize:3072,shadowFar:240,shadowRadius:2.6,envSize:128,levels:[1,.87,.75,.62],post:{bloomDiv:2,bloomLevels:6,shafts:!0,shaftSamples:28,volSteps:16,fxaa:!0,sharpen:.15,grain:.014}}};async function je(e){let t=e.container,n=new ne({antialias:!1,alpha:!1,stencil:!1,depth:!0,powerPreference:`high-performance`,preserveDrawingBuffer:e.debug.shot});n.outputColorSpace=a,n.toneMapping=0,n.shadowMap.enabled=!0,n.shadowMap.type=1,n.info.autoReset=!1,n.debug.checkShaderErrors=!1,n.domElement.style.display=`block`,t.appendChild(n.domElement);let r=n.properties,i=e=>r.get(e).currentProgram?.id??0;n.setOpaqueSort((e,t)=>{if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;if(e.material!==t.material){let n=i(e.material),r=i(t.material);return n===r?e.material.id-t.material.id:n-r}return e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:(e.materialVariant??0)-(t.materialVariant??0)});let o={calls:0,triangles:0},c=n.shadowMap,u=c.render,d=null,f=[],p=null,m=null,h=()=>u.call(c,f,p,m);c.render=(e,t,r)=>{let i=n.info.render.calls,a=n.info.render.triangles;f=e,p=t,m=r,d&&e.includes(E)?d.run(h,r):h(),o.calls+=n.info.render.calls-i,o.triangles+=n.info.render.triangles-a};let g=new C;g.name=`world`;let b=new l(12110036,.0012);g.fog=b;let x=new C;x.name=`overlay`,x.fog=b;let S=new te(e.settings.fov,16/9,.15,5e3);S.position.set(0,40,400),g.add(S);let w=new s(13624063,5917238,1);w.name=`hemi`,g.add(w);let E=new ce(16773340,3);E.name=`sun`,E.castShadow=!0,E.position.set(40,70,30),E.target=new v,g.add(E);let ee=E;d=new xe(n,E),d.enabled=e.debug.params.get(`cadence`)!==`0`;let D=new k(.4,.7,.3).normalize(),A=e.settings.quality in $?e.settings.quality:`medium`,j=$[A],M=new ye(n,j.post);M.setSun(E),g.add(M.sentinel);let N=new y(1,1),ie=new T,F=()=>{let e=E.shadow;e.mapSize.set(j.shadowSize,j.shadowSize),e.camera.near=.5,e.camera.far=j.shadowFar,e.radius=j.shadowRadius,e.bias=-12e-5,e.normalBias=.07,e.intensity=1,e.map&&=(e.map.dispose(),null),e.needsUpdate=!0,d?.invalidate()},I=e.debug.params.get(`dynres`),L=I===null?!e.debug.shot:I!==`0`,R=.3,z={over:0,under:0,cooldown:1.5,switches:0,residency:[,,,,].fill(0),phi:R,fits:0,upEstimate:0,fitFrom:-1,fitMs:0,fitShare:0,settle:0,reset(){this.over=this.under=0,this.cooldown=1.5,this.fitFrom=-1},forget(){this.reset(),this.phi=R,this.fits=0},share(e){let t=M.scaleAt(e)/M.scaleAt(0);return t*t},switchTo(e,t){this.fitFrom=M.level,this.fitMs=t,this.fitShare=this.share(M.level),this.settle=0,M.setLevel(e),this.switches++},fit(e){let t=this.share(M.level),n=this.fitShare-t;if(Math.abs(n)<.05||!(e>0))return;let r=(this.fitMs-e)/n,i=e-r*t;if(!(r>0))return;let a=O.clamp(i/(i+r),.15,.75);this.phi=this.fits++?this.phi+(a-this.phi)*.5:a},update(e){let t=M.levelCount;if(e>0&&e<.25&&(this.residency[Math.min(M.level,this.residency.length-1)]+=e),!L||!M.hasTimer||t<2||e<=0)return;let n=M.gpuSceneMs+M.gpuPostMs,r=M.level;this.fitFrom>=0&&(this.settle+=e)>=.75&&(this.fit(n),this.fitFrom=-1);let i=e=>this.phi+(1-this.phi)*e,a=r>0?n*i(this.share(r-1))/i(this.share(r)):1/0;this.upEstimate=a,n>15.5?(this.over+=e,this.under=0):a<12.5?(this.under+=e,this.over=Math.max(0,this.over-e)):(this.over=Math.max(0,this.over-e),this.under=0),this.cooldown-=e,!(this.cooldown>0)&&(this.over>.6&&r<t-1?(this.switchTo(r+1,n),this.cooldown=1.5,this.over=0):this.under>2.5&&r>0&&(this.switchTo(r-1,n),this.cooldown=3,this.under=0))}},B=()=>{let n=t.clientWidth||innerWidth,r=t.clientHeight||innerHeight,i=Math.sqrt(j.pixels/Math.max(1,n*r)),a=Math.min(devicePixelRatio||1,Math.max(1,i));S.aspect=n/r,S.updateProjectionMatrix();let o=O.clamp(e.settings.resolutionScale||1,.5,1),s=Math.max(.35,Math.min(A===`high`?1.25:1,i/a)*o);M.configure(Math.floor(n*a),Math.floor(r*a),L?j.levels.map(e=>s*e):[s])&&z.forget(),N.set(M.width,M.height)},V=e=>{e in $&&(A=e,j=$[e],M.setQuality(j.post),F(),B(),J.requalify())},H=e.debug.params.get(`tonemap`);(H===`aces`||H===`neutral`||H===`agx`)&&M.setTonemap(H),F(),addEventListener(`resize`,B),B(),e.events.on(`settings:changed`,()=>{let t=e.settings.quality;t!==A&&t in $?V(t):B()});let U=()=>{let t=e.terrain.caveBounds;if(!t||!e.terrain.cameraInCave?.())return j.shadowFar;let n=S.position,r=Math.max(Math.abs(n.x-t[0]),Math.abs(n.x-t[2])),i=Math.max(Math.abs(n.z-t[1]),Math.abs(n.z-t[3]));return O.clamp(Math.ceil(Math.hypot(r,i)/10)*10,40,j.shadowFar)},oe=new k,se=new k,W=[],G={fps:60,drawCalls:0,triangles:0,frameMs:16.7},K=0,q=!1,le=0,J=new Ae({renderer:n,scene:g,overlay:x,camera:S,sceneTarget:()=>M.sceneRT,compilePost:()=>M.compilePrograms(),renderFrame:()=>{try{e.water.lateUpdate?.(0)}catch{}de.render(0)},envReady:()=>e.sky.envReady,hasEnvironment:()=>g.environment!==null||e.failed.includes(`sky`)});J.startBackground();let ue=()=>{n.setRenderTarget(null),n.toneMapping=6,n.autoClear=!0,n.render(g,S)},de={order:re.render,renderer:n,scene:g,camera:S,sun:ee,hemi:w,stats:G,overlayScene:x,resolution:N,lightDirection:D,shaftStrength:.6,sceneDepth:M.depthUniforms,get grade(){return M.grade},get depthTexture(){return M.depthUniforms.tSceneDepth.value},get quality(){return A},get preset(){return j},setQuality:V,addFrameHook(e){let t={fn:e,errors:0};return W.push(t),()=>{let e=W.indexOf(t);e>=0&&W.splice(e,1)}},render(t){if(t>0&&(G.fps=G.fps*.92+1/t*.08,G.frameMs=G.frameMs*.92+t*1e3*.08,J.stopBackground()),e.ui.opaqueOverlay){le++;return}let r=performance.now();n.info.reset(),o.calls=o.triangles=0;for(let e=0;e<W.length;e++){let n=W[e];try{n.fn(t)}catch(t){++n.errors<=2?console.error(`[render] frame hook threw`,t):(W.splice(e,1),e--)}}J.beforeFrame(),E.position.copy(D).multiplyScalar(100),S.getWorldDirection(se);let i=Math.min(U(),S.far);Math.abs(E.shadow.camera.far-i)>.5&&(E.shadow.camera.far=i,d.invalidate());let a=i*Math.tan(O.degToRad(S.fov)*.5),s=a*S.aspect,c=Math.sqrt(i*i*.25+a*a+s*s);oe.copy(S.position).addScaledVector(se,i*.5),E.target.position.copy(oe);let l=E.shadow.camera;l.left=l.bottom=-c,l.right=l.top=c,z.update(t),N.set(M.width,M.height),d.beginFrame(),P.E[0]=e.uniforms.uTime.value,ae(e.uniforms),b.color.setRGB(P.C[0],P.C[1],P.C[2],_);let u=Math.max(1,P.H[1]-P.H[0]),f=Math.min(Math.max(400-P.H[0],0),u);b.density=Math.sqrt(Math.max(1e-8,P.C[3])*(f*f/(2*u)+Math.max(400-P.H[1],0)))/400,ie.setRGB(P.C[0],P.C[1],P.C[2],_);let p=n.autoClear;if(n.autoClear=!1,!q)try{M.render(g,S,x,t,D,de.shaftStrength,ie)}catch(e){q=!0,console.error(`[render] post pipeline failed; falling back to direct rendering`,e)}q&&ue(),n.autoClear=p,G.drawCalls=n.info.render.calls,G.triangles=n.info.render.triangles-o.triangles,K=K*.9+(performance.now()-r)*.1,J.trackLate()},warmup:e=>J.warmup(e),precompile:(e,t)=>J.precompile(e,t),shockRing(e,t,n,r){M.shock(e,t,n,r)},shadowCadence:d,get resolutionLevel(){return M.level},set resolutionLevel(e){M.setLevel(e),z.reset(),N.set(M.width,M.height)},probeHdr(){return M.probeHdr()},benchmark(e=120){return{passes:M.benchmarkPasses(e),width:M.width,height:M.height,gpuSceneMs:M.gpuSceneMs,gpuPostMs:M.gpuPostMs}},debugStats(){let e=z.residency.reduce((e,t)=>e+t,0)||1;return{quality:A,width:M.width,height:M.height,canvasWidth:M.canvasWidth,canvasHeight:M.canvasHeight,displayWidth:M.outWidth,displayHeight:M.outHeight,resLevel:M.level,resSwitches:z.switches,dynres:L,resFixedShare:+z.phi.toFixed(3),resFits:z.fits,resUpEstimateMs:+(Number.isFinite(z.upEstimate)?z.upEstimate:0).toFixed(2),resResidency:z.residency.slice(0,M.levelCount).map(t=>Math.round(t/e*100)).join(`/`),shadowFarDrawn:d.farDrawn,shadowFarKept:d.farKept,renderCpuMs:+K.toFixed(2),gpuSceneMs:+M.gpuSceneMs.toFixed(2),gpuPostMs:+M.gpuPostMs.toFixed(2),gpuTimer:M.hasTimer,shafts:+M.shaftVisibility.toFixed(2),volumetric:M.volumetricOn,postFailed:q,totalCalls:G.drawCalls,viewCalls:G.drawCalls-o.calls,shadowCalls:o.calls,viewTriangles:G.triangles,shadowTriangles:o.triangles,skippedFrames:le,programs:n.info.programs?.length??0,warmPrograms:J.stats.programs,warmMs:Math.round(J.stats.totalMs),warmSweepMs:Math.round(J.stats.sweepMs),warmLinkMs:Math.round(J.stats.linkMs),warmFrameMs:Math.round(J.stats.frameMs),warmAroundMs:Math.round(J.stats.aroundMs),warmSyncPrograms:J.stats.syncPrograms,warmBgMs:Math.round(J.stats.bgMs),lateShaders:J.lateCount,warmNeeded:J.stats.needed,warmDeferred:J.stats.deferred,warmDeferredLeft:J.stats.deferredLeft,warmTextures:J.stats.textures,warmSkippedDraws:J.stats.skippedDraws,warmSlowestMs:J.stats.slowestMs,warmSlowest:J.stats.slowest,lateShaderNames:J.late.join(` | `)}}};return de}export{$ as QUALITY,je as default};