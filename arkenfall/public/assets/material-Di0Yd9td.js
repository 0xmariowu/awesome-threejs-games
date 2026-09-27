import{ht as e,m as t}from"./three.core-_y2F91K_.js";import{n}from"./Game-BmRmdldn.js";var r={uFade:{value:1},uGlow:{value:0},uGlowColor:{value:new t(1,.72,.34)},uRim:{value:.6},uHurt:{value:0}},i=`
uniform float uFade;
uniform float uGlow;
uniform vec3 uGlowColor;
uniform float uRim;
uniform float uHurt;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uCave;
float menderBayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
// 4x4 ordered-dither threshold in (0, 1)
float menderBayer(vec2 p) { return menderBayer2(0.5 * p) * 0.25 + menderBayer2(p) + 0.03125; }
`,a=e=>`
float menderCav = 1.0;
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec4 menderN = texture2D( normalMap, ${e} );
  vec3 mapN = menderN.xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
  menderCav = menderN.a;
#endif
diffuseColor.rgb *= mix( 1.0, menderCav, 0.55 );
roughnessFactor = min( 1.0, roughnessFactor + ( 1.0 - menderCav ) * 0.25 );
`,o=(e,t)=>`
{
  vec3 V = normalize( vViewPosition );
  float ndv = clamp( dot( normal, V ), 0.0, 1.0 );
  float fab = ${e};
  float fres = pow( 1.0 - ndv, mix( 3.0, 1.8, fab ) );
  vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
  // brighter when the sun is behind the character (backlit), and on the sun-facing side
  float back = mix( 0.45 + 0.55 * clamp( dot( -V, sunV ) * 0.5 + 0.5, 0.0, 1.0 ), 0.8, uCave );
  float side = mix( clamp( dot( normal, sunV ) * 0.6 + 0.55, 0.0, 1.0 ), 0.75, uCave );
  float dayK = 1.0 - uNight;
  // underground there is no sky: the crystals' cool glow outlines the Mender instead
  vec3 rimCol = mix( mix( vec3( 0.42, 0.52, 0.85 ) * 0.55, uSunColor, dayK ), vec3( 0.3, 0.72, 0.66 ) * 0.62, uCave );
  float k = uRim * mix( 1.0, 0.7, fab ) * ( ${t} );
  // wool's sheen is cool: a pale blue rim on fabric, the light's own colour on leather and metal
  totalEmissiveRadiance += rimCol * mix( vec3( 1.0 ), vec3( 0.56, 0.65, 0.88 ), fab * dayK * ( 1.0 - uCave ) ) * fres * back * side * k * ( 0.45 + 0.55 * diffuseColor.rgb );
  // hurt: a thin hot rim that fades out (the colours underneath stay), after a one- or two-frame
  // white pop
  float hurtRim = pow( 1.0 - ndv, 4.0 );
  totalEmissiveRadiance += vec3( 1.0, 0.22, 0.16 ) * uHurt * hurtRim * 0.9;
  totalEmissiveRadiance += vec3( smoothstep( 0.8, 1.0, uHurt ) * ( 0.06 + 0.4 * hurtRim ) );
}
`,s=`
reflectedLight.indirectDiffuse *= 0.35 + 0.65 * menderCav;
reflectedLight.indirectSpecular *= 0.5 + 0.5 * menderCav;
`;function c(e,t){e.onBeforeCompile=e=>{let c=e.uniforms;c.uFade=r.uFade,c.uGlow=r.uGlow,c.uGlowColor=r.uGlowColor,c.uRim=r.uRim,c.uHurt=r.uHurt,c.uSunDir=n.uSunDir,c.uSunColor=n.uSunColor,c.uNight=n.uNight,c.uCave=n.uCave,t||(e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
attribute vec4 aSurf;
varying vec4 vSurf;`).replace(`#include <uv_vertex>`,`#include <uv_vertex>
vSurf = aSurf;`));let l=e.fragmentShader.replace(`#include <common>`,`#include <common>\n${i}${t?``:`varying vec4 vSurf;
`}`).replace(`#include <clipping_planes_fragment>`,`#include <clipping_planes_fragment>
if (uFade < 0.999 && menderBayer(gl_FragCoord.xy) > uFade) discard;`).replace(`#include <aomap_fragment>`,`#include <aomap_fragment>\n${s}`);l=t?l.replace(`#include <map_fragment>`,`
vec2 menderUv = vMapUv;
if ( !gl_FrontFacing ) menderUv.x += 0.5;
diffuseColor *= texture2D( map, menderUv );
// the inside of the coat and scarf sits in the garment's own shade (a lit lining read as a pale board)
if ( !gl_FrontFacing ) diffuseColor.rgb *= 0.72;
`).replace(`#include <normal_fragment_maps>`,a(`menderUv`)).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>\n${o(`1.0`,`1.0`)}`):l.replace(`#include <map_fragment>`,`
vec4 menderTex = texture2D( map, vMapUv );
diffuseColor.rgb *= menderTex.rgb;
`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
roughnessFactor = clamp( menderTex.a * vSurf.x, 0.04, 1.0 );`).replace(`#include <metalnessmap_fragment>`,`#include <metalnessmap_fragment>
metalnessFactor = vSurf.y;`).replace(`#include <normal_fragment_maps>`,a(`vNormalMapUv`)).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * vSurf.z * ( 0.35 + uGlow * 3.2 );\n${o(`max( vSurf.w, 0.0 )`,`1.0 + min( vSurf.w, 0.0 )`)}`),e.fragmentShader=l},e.customProgramCacheKey=()=>t?`mender-cloth-v2`:`mender-body-v2`}function l(t,n){let r=new e({map:t,normalMap:n,vertexColors:!0,roughness:1,metalness:0,envMapIntensity:.6});return r.name=`mender-body`,c(r,!1),r}function u(t,n){let r=new e({map:t,normalMap:n,vertexColors:!0,roughness:.9,metalness:0,side:2,alphaTest:.5,envMapIntensity:.5});return r.name=`mender-cloth`,c(r,!0),r}export{u as n,r,l as t};