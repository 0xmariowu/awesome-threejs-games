import{$r as e,A as t,Dt as n,Fr as r,Hn as i,Lt as a,Rn as o,U as s,Wi as c,an as l,ar as u,ft as d,in as f,io as p,ir as m,j as h,jt as g,no as _,qt as v,ro as y,rr as b,ta as x,tr as S}from"./three.core-DtjtRha-.js";import{t as C}from"./biome-DstsBN7N.js";function w(e){return{uLifeTime:{value:e.atmo.time},uLifeEnv:{value:new p(0,0,0,1)},uSunLight:{value:new s(1,.8,.6)},uSkyLight:{value:new s(.3,.35,.45)},uKeyDir:{value:new y(0,1,0)},uProj:{value:500}}}function T(t,n=128){let r=new Uint8Array(n*n*4),a=e=>{let n=new Float32Array(e*e);for(let e=0;e<n.length;e++)n[e]=t()*2-1;return n},s=(e,t,n,r)=>{let i=Math.floor(n),a=Math.floor(r),o=n-i,s=r-a,c=o*o*(3-2*o),l=s*s*(3-2*s),u=(i%t+t)%t,d=(a%t+t)%t,f=(u+1)%t,p=(d+1)%t,m=e[d*t+u],h=e[d*t+f],g=e[p*t+u],_=e[p*t+f];return m+(h-m)*c+(g-m)*l+(m-h-g+_)*c*l},l=[{base:8,oct:4},{base:16,oct:4},{base:6,oct:3},{base:32,oct:2}].map(e=>({...e,lat:Array.from({length:e.oct},(t,n)=>a(e.base<<n))}));for(let e=0;e<n;e++)for(let t=0;t<n;t++){let i=(e*n+t)*4;for(let a=0;a<4;a++){let o=l[a],c=0,u=1,d=0;for(let r=0;r<o.oct;r++){let i=o.base<<r;c+=u*s(o.lat[r],i,t/n*i,e/n*i),d+=u,u*=.5}let f=c/d;f=a===2?1-Math.abs(f)*1.8:.5+f*.95,r[i+a]=Math.max(0,Math.min(255,Math.round(f*255)))}}let u=new d(r,n,n,e);return u.wrapS=u.wrapT=c,u.magFilter=o,u.minFilter=i,u.generateMipmaps=!0,u.colorSpace=``,u.needsUpdate=!0,u}var E=`
uniform vec4 uLifeTime;
uniform vec4 uLifeEnv;
uniform vec3 uSunLight;
uniform vec3 uSkyLight;
uniform vec3 uKeyDir;
uniform float uProj;
`,D=`
uniform vec4 uLifeEnv;
uniform vec3 uSunLight;
uniform vec3 uSkyLight;
uniform vec3 uKeyDir;
`,O=Math.PI*2,k={span:[2.6,3.4],flap:1.25,duty:.14,albedo:.045,chord:1,tail:1,night:1.3},A={span:[1.8,2.3],flap:1.6,duty:.2,albedo:.06,chord:.9,tail:1.1,night:1.3},j={span:[2,2.3],neck:.62,flap:1.35,duty:.93,albedo:.1,chord:.8,tail:.55,night:1},M={span:[.38,.46],flap:3.1,duty:.72,albedo:.035,chord:.8,tail:.8,night:1.05},N={span:[.42,.5],flap:4.2,duty:.5,albedo:.03,chord:.55,tail:.55,night:1.1},ee={span:[1.25,1.45],flap:2,duty:.3,albedo:.55,chord:.7,tail:.7,night:1.1},te={span:[.65,.75],flap:2.6,duty:.8,albedo:.035,chord:.9,tail:.9,night:1.1},ne=[{id:`loom-kettle`,kind:`kettle`,at:[250,470,-1543],n:12,r:[50,130],speed:[10.5,13],alt:[-60,90],altAmp:25,drift:40,driftFreq:.004,dir:1,tilt:.1,...k},{id:`loom-crown`,kind:`kettle`,at:[350,790,-1750],n:9,r:[130,260],speed:[12,14],alt:[-20,80],altAmp:20,drift:60,driftFreq:.003,dir:-1,tilt:.06,...k},{id:`loom-murmur`,kind:`tour`,at:[330,330,-1350],n:70,amp:[320,40,120],freq:[.021,.033,.042],phase:[0,1,0],spread:[42,16,30],cloud:!0,wobble:3.5,breathe:.3,...M,quality:.5},{id:`needles-high`,kind:`kettle`,at:[1350,1010,-1150],n:10,r:[200,380],speed:[12,14],alt:[-40,80],altAmp:30,drift:60,driftFreq:.0025,dir:1,tilt:.05,...k},{id:`needles-ring`,kind:`kettle`,at:[1350,560,-1150],n:7,r:[540,610],speed:[11,13],alt:[-40,60],altAmp:20,drift:20,driftFreq:.002,dir:-1,tilt:.03,...A},{id:`wardens-kettle`,kind:`kettle`,at:[-250,300,-870],n:11,r:[90,230],speed:[10,12.5],alt:[-30,60],altAmp:18,drift:50,driftFreq:.004,dir:1,tilt:.08,...k},{id:`lake-cranes`,kind:`tour`,at:[250,62,-40],n:11,amp:[500,10,360],freq:[.0165,.05,.0165],phase:[0,0,Math.PI/2],vee:[3.3,2.7,.18],wobble:.5,breathe:.04,...j},{id:`lake-cranes-2`,kind:`tour`,at:[60,84,-200],n:7,amp:[420,8,260],freq:[.019,.043,.019],phase:[Math.PI,0,Math.PI/2],vee:[3.1,2.6,.15],wobble:.4,breathe:.05,...j},{id:`lake-gulls`,kind:`tour`,at:[150,16,520],n:6,amp:[300,5,110],freq:[.028,.09,.056],phase:[0,0,0],spread:[70,4,45],wobble:7,breathe:.2,...ee},{id:`lake-murmur`,kind:`tour`,at:[520,125,-120],n:110,amp:[260,35,180],freq:[.024,.031,.024],phase:[0,2,Math.PI/2],spread:[55,22,40],cloud:!0,wobble:4,breathe:.35,...M,quality:.5},{id:`cloister-swifts`,kind:`tour`,at:[-1250,250,-1180],n:28,amp:[330,70,25],freq:[.03,.071,.09],phase:[0,1,.5],spread:[40,30,18],cloud:!0,wobble:9,breathe:.3,...N,quality:.6},{id:`isles-kettle`,kind:`kettle`,at:[1350,640,1650],n:7,r:[150,350],speed:[11,13],alt:[-30,60],altAmp:25,drift:60,driftFreq:.003,dir:1,tilt:.06,...k},{id:`stair-door`,kind:`kettle`,at:[-420,760,300],n:2,r:[45,70],speed:[9,10.5],alt:[-10,20],altAmp:12,drift:10,driftFreq:.01,dir:-1,tilt:.12,...A},{id:`temple-kettle`,kind:`kettle`,at:[-450,580,1650],n:6,r:[120,220],speed:[11,13],alt:[-30,50],altAmp:20,drift:40,driftFreq:.004,dir:1,tilt:.07,...k},{id:`span-kettle`,kind:`kettle`,at:[1720,255,-60],n:5,r:[80,170],speed:[10,12],alt:[-20,40],altAmp:15,drift:30,driftFreq:.005,dir:-1,tilt:.08,...A},{id:`choir-daws`,kind:`tour`,at:[-1750,200,-150],n:24,amp:[480,15,300],freq:[.02,.05,.04],phase:[0,0,0],spread:[35,10,25],cloud:!0,wobble:4,breathe:.25,...te,quality:.6},{id:`spawn-kettle`,kind:`kettle`,at:[-700,270,600],n:5,r:[60,120],speed:[10,12],alt:[-20,40],altAmp:15,drift:30,driftFreq:.005,dir:1,tilt:.1,...A},{id:`orrery-kettle`,kind:`kettle`,at:[-1800,580,1150],n:6,r:[250,400],speed:[12,14],alt:[-20,50],altAmp:20,drift:40,driftFreq:.003,dir:-1,tilt:.05,...k}];function re(){let e=[],t=[],n=[],r=(n,r,i,a)=>(e.push(n,r,i),t.push(a),t.length-1),i=(e,t,r)=>n.push(e,t,r),o=(e,t,n,r)=>{i(e,t,n),i(e,n,r)},s=r(0,.006,.2,0),c=[r(.036,0,.07,0),r(0,.032,.07,0),r(-.036,0,.07,0),r(0,-.034,.07,0)],u=[r(.022,.002,-.11,0),r(0,.022,-.11,0),r(-.022,.002,-.11,0),r(0,-.02,-.11,0)],d=r(0,.002,-.16,0);for(let e=0;e<4;e++){let t=(e+1)%4;i(s,c[t],c[e]),o(c[e],c[t],u[t],u[e]),i(u[e],u[t],d)}for(let e of[1,-1]){let t=r(.03*e,.008,.075,1),n=r(.03*e,.004,-.085,1),a=r(.23*e,.004,.07,1),s=r(.23*e,0,-.1,1),c=r(.46*e,0,.005,1),l=r(.44*e,0,-.075,1),u=r(.5*e,0,-.02,1),d=r(.485*e,0,-.06,1);o(t,a,s,n),o(a,c,l,s),i(c,u,d),i(c,d,l)}o(r(0,.003,-.13,3),r(.06,0,-.26,3),r(0,.001,-.235,3),r(-.06,0,-.26,3));let f=[r(.012,.004,0,4),r(0,.02,0,4),r(-.012,.004,0,4)],p=[r(.008,.012,1,4),r(0,.026,1,4),r(-.008,.012,1,4)];for(let e=0;e<3;e++)o(f[e],f[(e+1)%3],p[(e+1)%3],p[e]);let m=r(0,.012,1.28,4);for(let e=0;e<3;e++)i(p[e],p[(e+1)%3],m);o(r(.008,-.02,0,5),r(-.008,-.02,0,5),r(-.004,-.014,1,5),r(.004,-.014,1,5));let h=new l;return h.setAttribute(`position`,new a(e,3)),h.setAttribute(`aPart`,new a(t,1)),h.setIndex(n),h}var ie=`
${E}
uniform float uMinPx;
attribute float aPart;
attribute vec4 aA; // xyz anchor, w kind (0 kettle, 1 tour)
attribute vec4 aB; // kettle: driftAmp, altAmp, radius, speed   | tour: Ax, Ay, Az, wobble
attribute vec4 aC; // kettle: driftFreq, theta0, dir, radiusVar | tour: fx, fy, fz, breathe
attribute vec4 aD; // kettle: driftPhase, altOffset, tilt, seed | tour: px, py, pz, seed
attribute vec4 aE; // tour: formation offset xyz (right, up, forward)
attribute vec4 aF; // span, neck, flap rate (Hz), flap duty
attribute vec4 aG; // albedo, chord, tail, night-roost factor
varying vec3 vWorld;
varying float vAlb;
varying float vWing;
#include <fog_pars_vertex>

vec3 birdPos(float t) {
  float seed = aD.w;
  if (aA.w < 0.5) {
    vec3 c = aA.xyz + aB.x * vec3(sin(t * aC.x + aD.x), 0.0, cos(t * aC.x * 0.83 + aD.x * 1.7));
    float r = aB.z * (1.0 + aC.w * sin(t * 0.021 + seed * 9.7));
    float th = aC.z * t * aB.w / aB.z + aC.y;
    float h = aD.y + aB.y * sin(t * 0.013 + seed * 5.3) + aD.z * r * sin(th + seed * 3.0);
    return c + vec3(r * cos(th), h, r * sin(th));
  }
  vec3 ph = t * aC.xyz + aD.xyz;
  vec3 c = aA.xyz + aB.xyz * sin(ph);
  vec3 v = aB.xyz * aC.xyz * cos(ph);
  vec3 f = normalize(vec3(v.x, v.y * 0.3, v.z) + vec3(1e-5, 0.0, 0.0));
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  float br = 1.0 + aC.w * sin(t * 0.37 + seed * 6.2831);
  vec3 o = aE.xyz * br + aB.w * vec3(sin(t * 0.71 + seed * 17.0), 0.6 * sin(t * 0.53 + seed * 29.0), sin(t * 0.61 + seed * 11.0));
  return c + r * o.x + u * o.y + f * o.z;
}

void main() {
  float t = uLifeTime.x;
  float seed = aD.w;
  vec3 p0 = birdPos(t - 0.5);
  vec3 p1 = birdPos(t);
  vec3 p2 = birdPos(t + 0.5);
  vec3 vel = p2 - p0;
  vec3 fwd = normalize(vel + vec3(0.0, 0.0, 1e-5));
  vec3 acc = (p2 - 2.0 * p1 + p0) * 4.0;
  vec3 lat = acc - dot(acc, fwd) * fwd;
  vec3 upv = normalize(vec3(0.0, 9.81, 0.0) + lat * 2.6);
  vec3 right = normalize(cross(upv, fwd));
  upv = cross(fwd, right);

  // wingbeat: bursts of flapping between glides; climbing makes them flap
  float climb = clamp(fwd.y * 5.0, 0.0, 1.0);
  float duty = aF.w;
  float sw = 0.5 + 0.5 * sin(t * (0.07 + 0.05 * seed) + seed * 40.0);
  float flapping = max(smoothstep(1.0 - duty - 0.12, 1.0 - duty + 0.12, sw), climb);
  float ph = t * aF.z * 6.2831 + seed * 60.0;
  float a1 = mix(0.1, 0.12 + 0.62 * sin(ph), flapping);
  float a2 = mix(-0.06, 0.1 + 0.5 * sin(ph - 1.1), flapping);

  vec3 p = position;
  float wing = step(0.5, aPart) * step(aPart, 1.5);
  if (wing > 0.5) {
    float s = sign(p.x);
    float ax = abs(p.x);
    float rin = min(ax, 0.23) - 0.03;
    float rout = max(ax - 0.23, 0.0);
    p.z *= aG.y;
    p.x = s * (0.03 + rin * cos(a1) + rout * cos(a1 + a2));
    p.y += rin * sin(a1) + rout * sin(a1 + a2);
  }
  if (aPart > 2.5 && aPart < 3.5) p.z = -0.13 + (p.z + 0.13) * aG.z;
  if (aPart > 3.5 && aPart < 4.5) p.z = 0.17 + p.z * aF.y;
  if (aPart > 4.5) p.z = -0.12 - p.z * aF.y * 0.85;

  // enlarge far birds to a minimum on-screen span; roost at night
  float dist = length(p1 - cameraPosition);
  float px = aF.x * uProj / max(dist, 1.0);
  float enl = clamp(uMinPx / px, 1.0, 7.0);
  float vis = smoothstep(seed - 0.06, seed + 0.06, 1.0 - uLifeEnv.x * aG.w);
  p *= aF.x * enl * vis;

  vec3 wp = p1 + right * p.x + upv * p.y + fwd * p.z;
  vWorld = wp;
  vAlb = aG.x;
  vWing = wing;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,ae=`
${D}
varying vec3 vWorld;
varying float vAlb;
varying float vWing;
#include <fog_pars_fragment>
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 V = normalize(vWorld - cameraPosition);
  if (dot(n, V) > 0.0) n = -n;
  float ndl = max(dot(n, uKeyDir), 0.0);
  vec3 col = vAlb * (uSkyLight * (0.55 + 0.45 * n.y) + uSunLight * ndl);
  // low sun shining through the flight feathers when the bird crosses it
  float back = pow(max(dot(V, uKeyDir), 0.0), 8.0);
  col += (0.04 + vAlb * 0.5) * uSunLight * back * vWing;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;function oe(e,t,n){return n[0]=e.at[0]+e.amp[0]*Math.sin(t*e.freq[0]+e.phase[0]),n[1]=e.at[1]+e.amp[1]*Math.sin(t*e.freq[1]+e.phase[1]),n[2]=e.at[2]+e.amp[2]*Math.sin(t*e.freq[2]+e.phase[2]),n}function se(e,t){let n=[0,0,0],r=1/0;if(t.kind===`tour`){let i=O/Math.min(t.freq[0],t.freq[2]),a=-t.spread?.[1]-(t.wobble??0)-6||-8;for(let o=0;o<160;o++){oe(t,o/160*i*2,n);let s=t.vee?t.n/2*t.vee[0]:t.spread[0],c=e.surfaceAt(n[0],n[2]);c=Math.max(c,e.surfaceAt(n[0]+s,n[2]),e.surfaceAt(n[0]-s,n[2])),c=Math.max(c,e.surfaceAt(n[0],n[2]+s),e.surfaceAt(n[0],n[2]-s)),r=Math.min(r,n[1]+a-c)}}else{let n=t.r[1]*1.2+t.drift,i=t.at[1]+t.alt[0]-t.altAmp-t.tilt*n;for(let a=0;a<49;a++){let o=a*2.399963,s=n*Math.sqrt((a+.5)/49),c=e.surfaceAt(t.at[0]+Math.cos(o)*s,t.at[2]+Math.sin(o)*s);r=Math.min(r,i-c)}}let i=t.kind===`tour`&&t.id.includes(`gull`)?4:18;if(r<i){let n=i-r;t.at=[t.at[0],t.at[1]+n,t.at[2]],e.params.debug&&console.warn(`[life] flock ${t.id} lifted ${n.toFixed(0)} m (clearance ${r.toFixed(0)})`)}return r}function P(e,t){let n=e.noise.createRng(`life-birds`),r=e.quality.level===`low`,i=[];for(let t of ne){let a={...t};se(e,a);let o=Math.max(1,Math.round(a.n*(r&&a.quality?a.quality:1))),s=n();for(let e=0;e<o;e++){let t=n(),r=n.range(a.span[0],a.span[1]),o={A:[a.at[0],a.at[1],a.at[2],a.kind===`kettle`?0:1],B:[0,0,0,0],C:[0,0,0,0],D:[0,0,0,t],E:[0,0,0,0],F:[r,a.neck??0,a.flap*n.range(.9,1.1),a.duty],G:[a.albedo*n.range(.85,1.15),a.chord,a.tail,a.night]};if(a.kind===`kettle`){let e=n.range(a.r[0],a.r[1]);o.B=[a.drift,a.altAmp,e,n.range(a.speed[0],a.speed[1])],o.C=[a.driftFreq,n.range(0,O),a.dir,n.range(.08,.2)],o.D=[s*O,n.range(a.alt[0],a.alt[1]),a.tilt*n.range(.5,1.2),t]}else if(o.B=[a.amp[0],a.amp[1],a.amp[2],a.wobble],o.C=[a.freq[0],a.freq[1],a.freq[2],a.breathe],o.D=[a.phase[0],a.phase[1],a.phase[2],t],a.vee){let t=Math.ceil(e/2);o.E=[(e===0?0:e%2?1:-1)*t*a.vee[0]+n.range(-.4,.4),-t*a.vee[2]+n.range(-.3,.3),-t*a.vee[1]+n.range(-.4,.4),0]}else{let e=n.gauss()*.5,t=n.gauss()*.5,r=n.gauss()*.5;o.E=[e*a.spread[0],t*a.spread[1],r*a.spread[2],0]}i.push(o)}}let a=re(),o=i.length,s=e=>{let t=new Float32Array(o*4);return i.forEach((n,r)=>t.set(n[e],r*4)),new f(t,4)};for(let e of[`A`,`B`,`C`,`D`,`E`,`F`,`G`])a.setAttribute(`a${e}`,s(e));a.instanceCount=o;let c=new x({name:`life-birds`,uniforms:{...e.fogUniforms(),...t,uMinPx:{value:2.6}},vertexShader:ie,fragmentShader:ae,fog:!0,side:2}),l=new u(a,c);return l.name=`life-birds`,l.frustumCulled=!1,l.renderOrder=1,{mesh:l,count:o,triangles:a.index.count/3*o}}var F=`
${E}
uniform vec3 uBox;
uniform float uStrength;
attribute vec4 aRand; // x size, y twinkle rate, z phase, w kind (0 dust, 1 seed fluff)
varying vec3 vCol;
varying float vSoft;
#include <fog_pars_vertex>
void main() {
  float t = uLifeTime.x;
  float fluff = aRand.w;
  vec3 wind = vec3(0.5, 0.03, -0.2) * (0.5 + uLifeTime.z) * mix(1.0, 0.55, fluff);
  vec3 p = position * uBox + wind * t * (0.7 + 0.6 * aRand.x);
  p += vec3(sin(t * 0.31 + aRand.z * 6.28), 0.7 * sin(t * 0.23 + aRand.z * 17.0), sin(t * 0.27 + aRand.z * 11.0)) * (0.5 + aRand.x);
  p.y += fluff * 0.4 * sin(t * 0.11 + aRand.z * 5.0);
  vec3 rel = mod(p - cameraPosition + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec3 wp = cameraPosition + rel;
  float dist = max(length(rel), 1e-3);
  float fade = (1.0 - smoothstep(0.32 * uBox.x, 0.5 * uBox.x, dist)) * smoothstep(0.35, 1.6, dist);
  fade *= 1.0 - smoothstep(0.3 * uBox.y, 0.5 * uBox.y, abs(rel.y));
  vec3 V = rel / dist;
  float mu = max(dot(V, uKeyDir), 0.0);
  float mu2 = mu * mu;
  float mu8 = mu2 * mu2; mu8 *= mu8;
  float phase = 0.06 + 0.55 * mu2 * mu2 + 2.2 * mu8 * mu8 * mu;
  float tw = 0.5 + 0.5 * sin(t * aRand.y + aRand.z * 40.0);
  tw = tw * tw; tw *= tw; tw *= tw; tw *= tw;
  float bright = phase * (0.35 + mix(3.5, 1.2, fluff) * tw);
  float worldSize = mix(0.01, 0.045, fluff) * (0.6 + aRand.x);
  float px = worldSize * uProj / dist;
  float size = max(px, 1.0) + fluff * 1.6;
  // sub-pixel motes: keep their energy, not their size
  float cover = clamp(px * px, 0.06, 1.0);
  gl_PointSize = size;
  vSoft = fluff;
  vCol = uSunLight * (bright * cover * fade * uStrength * mix(0.55, 0.3, fluff));
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,I=`
${D}
varying vec3 vCol;
varying float vSoft;
#include <fog_pars_fragment>
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  float a = mix(1.0 - smoothstep(0.55, 1.0, r2), exp(-r2 * 3.5), vSoft);
  gl_FragColor = vec4(vCol * a, 1.0);
  #ifdef USE_FOG
    vec4 fogT = atmoFogTerm(cameraPosition, vAtmoWorldPos);
    gl_FragColor.rgb *= 1.0 - fogT.a;
  #endif
}
`;function L(e,n){let i=e.noise.createRng(`life-motes`),a=e.quality.level,o=a===`low`?350:a===`medium`?800:1300,s=new Float32Array(o*3),c=new Float32Array(o*4);for(let e=0;e<o;e++)s[e*3]=i(),s[e*3+1]=i(),s[e*3+2]=i(),c[e*4]=i(),c[e*4+1]=i.range(.4,2.2),c[e*4+2]=i(),c[e*4+3]=+(i()<.14);let l=new h;l.setAttribute(`position`,new t(s,3)),l.setAttribute(`aRand`,new t(c,4));let u={value:1},d=new x({name:`life-motes`,uniforms:{...e.fogUniforms(),...n,uBox:{value:new y(30,16,30)},uStrength:u},vertexShader:F,fragmentShader:I,fog:!0,transparent:!0,depthWrite:!1,blending:2}),f=new r(l,d);f.name=`life-motes`,f.frustumCulled=!1,f.renderOrder=5;let p=e.camera.position,m=e.env.keyDir,g=[18,40,75,120,190,290,430,620,880,1250,1750],_=1,v=1,b=0;function C(){for(let t=0;t<g.length;t++){let n=g[t],r=p.y+m.y*n;if(e.heightAt(p.x+m.x*n,p.z+m.z*n)>r)return 0}return 1}return{mesh:f,count:o,update(t){b++%6==0&&(v=C()),_+=(v-_)*Math.min(1,t*1.5);let n=p.y-e.surfaceAt(p.x,p.z),r=1-S.smoothstep(n,45,180),i=e.env;u.value=r*(.2+.8*_)*(1-.75*i.night),f.visible=u.value>.003}}}var R=`
${E}
uniform float uStrength;
uniform float uRadius;
attribute vec4 aRand;
varying float vI;
varying float vCore;
#include <fog_pars_vertex>
void main() {
  float t = uLifeTime.x;
  vec4 r = aRand;
  vec3 wander = vec3(
    sin(t * (0.19 + 0.12 * r.x) + r.y * 6.28) * 2.4 + sin(t * 0.53 + r.z * 9.0) * 0.7,
    sin(t * (0.15 + 0.1 * r.y) + r.z * 6.28) * 0.8 + sin(t * 0.61 + r.x * 5.0) * 0.25,
    cos(t * (0.17 + 0.12 * r.z) + r.x * 6.28) * 2.4 + cos(t * 0.47 + r.y * 7.0) * 0.7);
  vec3 wp = position + wander;
  // blink: quick rise, slower fade, dark pause; a third of them double-flash
  float period = 2.6 + 4.2 * r.x;
  float f = fract(t / period + r.y);
  float flash = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.07, 0.3, f));
  float f2 = f - 0.36;
  flash += step(0.66, r.w) * smoothstep(0.0, 0.04, f2) * (1.0 - smoothstep(0.05, 0.22, f2)) * 0.8;
  float glow = 0.035 + flash;
  float dist = max(length(wp - cameraPosition), 1e-3);
  float fade = uStrength * (1.0 - smoothstep(uRadius * 0.55, uRadius, dist)) * smoothstep(0.8, 3.0, dist);
  float core = 0.05 * uProj / dist;           // body light size in px
  float size = clamp(core * 9.0, 3.0, 48.0);  // halo sprite
  gl_PointSize = size;
  vCore = clamp(core / size, 0.05, 0.5);
  // sub-pixel cores keep their energy
  vI = glow * fade * clamp(core * core, 0.35, 1.0);
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,z=`
${D}
uniform vec3 uColor;
varying float vI;
varying float vCore;
#include <fog_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(vCore * 0.6, vCore * 1.6 + 0.06, d);
  float halo = exp(-d * d * 7.0) * 0.22 + exp(-d * 3.5) * 0.06;
  gl_FragColor = vec4(uColor * vI * (core * 7.0 + halo * 4.0) * (1.0 - smoothstep(0.85, 1.0, d)), 1.0);
  #ifdef USE_FOG
    vec4 fogT = atmoFogTerm(cameraPosition, vAtmoWorldPos);
    gl_FragColor.rgb *= 1.0 - fogT.a;
  #endif
}
`,B=14;function V(e,i){let a=e.noise.createRng(`life-fireflies`),o=e.quality.level,c=o===`low`?110:o===`medium`?240:380,l=o===`low`?85:120,u=new Float32Array(c*3).fill(0);for(let e=0;e<c;e++)u[e*3+1]=-1e5;let d=new Float32Array(c*4);for(let e=0;e<c*4;e++)d[e]=a();let f=new h,p=new t(u,3);p.setUsage(n),f.setAttribute(`position`,p),f.setAttribute(`aRand`,new t(d,4));let m={value:0},g=new x({name:`life-fireflies`,uniforms:{...e.fogUniforms(),...i,uStrength:m,uRadius:{value:l},uColor:{value:new s(`#d6ff7e`)}},vertexShader:R,fragmentShader:z,fog:!0,transparent:!0,depthWrite:!1,blending:2}),_=new r(f,g);_.name=`life-fireflies`,_.frustumCulled=!1,_.renderOrder=6,_.visible=!1;let v=new Map,b=0;function w(t,n){let r=Math.round(t/B),i=Math.round(n/B),a=(r+2e4)*4e4+(i+2e4),o=v.get(a);if(o===void 0){if(b<=0)return-1;b--;let t=r*B,n=i*B,s=e.heightAt(t,n);o=s<.8?0:C(t,n,s),v.size>6e4&&v.clear(),v.set(a,o)}return o}let T=e.camera.position,E=0,D=!1;function O(t){let n=a()*Math.PI*2,r=l*Math.sqrt(.02+.98*a()),i=T.x+Math.cos(n)*r,o=T.z+Math.sin(n)*r,s=w(i,o);if(s<0)return!1;if(a()>s*.95+.03)return u[t*3+1]=-1e5,u[t*3]=i,u[t*3+2]=o,!0;let c=e.heightAt(i,o);if(c<.5)return!1;let d=a();return u[t*3]=i,u[t*3+1]=c+(d<.8?.6+3.2*a():4+7*a()),u[t*3+2]=o,!0}let k=l*l*1.15*1.15,A=new y(1e9,0,0),j=!1;return{mesh:_,count:c,update(){let t=e.env,n=T.y-e.surfaceAt(T.x,T.z),r=S.smoothstep(t.night,.35,.75)*(1-S.smoothstep(n,50,150));if(m.value=r,_.visible=r>.003,!_.visible){j=!1;return}let i=!j||A.distanceToSquared(T)>l*l*.25;j=!0,A.copy(T),b=i?500:5;let a=i?c*2:Math.min(c,28);for(let e=0;e<a;e++){let t=E;E=(E+1)%c;let n=u[t*3]-T.x,r=u[t*3+2]-T.z,a=n*n+r*r>k,o=u[t*3+1]<-1e4;(a||o&&(i||!(e&3)))&&O(t)&&(D=!0)}D&&=(p.needsUpdate=!0,!1)}}}var H=()=>new Promise(e=>requestAnimationFrame(()=>e())),U=[{id:`lake`,type:`disc`,x:80,z:40,r:1080,top:16,thick:16,dens:.4,step:30},{id:`loom-valley`,type:`path`,pts:[[250,-2950],[265,-2300],[300,-1750],[260,-1250],[170,-850]],half:330,thick:42,dens:.9,step:30},{id:`canyon`,type:`path`,pts:[[2750,-2950],[2300,-1600],[1950,-720],[1720,0],[1610,520],[1230,810],[800,520]],half:170,thick:38,dens:1,step:28},{id:`crater`,type:`disc`,x:-1800,z:1150,r:470,top:60,thick:34,dens:1,step:26},{id:`choir-plain`,type:`disc`,x:-1650,z:-330,r:850,top:56,thick:12,dens:.35,step:38},{id:`east-forest`,type:`disc`,x:1250,z:1550,r:820,top:86,thick:26,dens:.4,step:38}],W=`
${E}
uniform float uLayers;
attribute vec4 aMist;   // ground height, thickness, edge fade, density
attribute float aLayer; // instance: layer index (0 = lowest)
varying vec3 vWorld;
varying float vDepth;
varying float vThick;
varying float vEdge;
varying float vLayer;
#include <fog_pars_vertex>
void main() {
  float thick = aMist.y;
  float lf = (aLayer + 0.5) / uLayers;
  // stepped layers inside the pool; a slow swell keeps them from reading as flat floors
  float y = position.y - thick * (1.0 - lf) * 0.92;
  y += 1.6 * sin(position.x * 0.006 + uLifeTime.x * 0.05 + aLayer * 2.1) * sin(position.z * 0.005 - uLifeTime.x * 0.04);
  vec3 wp = vec3(position.x, y, position.z);
  vWorld = wp;
  vDepth = y - aMist.x;
  vThick = thick;
  vEdge = aMist.z * aMist.w;
  vLayer = aLayer;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,G=`
${D}
uniform sampler2D uNoise;
uniform float uLayers;
uniform vec3 uMist; // x strength, y coverage threshold, z density scale
varying vec3 vWorld;
varying float vDepth;
varying float vThick;
varying float vEdge;
varying float vLayer;
#include <fog_pars_fragment>
void main() {
  if (vDepth <= 0.0) discard;
  float t = uAtmoTime.x;
  vec2 xz = vWorld.xz;
  vec2 w = vec2(1.0, -0.4) * (0.6 + uAtmoTime.z);
  float n1 = texture2D(uNoise, (xz + w * t * 1.3) / 1100.0 + vLayer * 0.37).r;
  float n2 = texture2D(uNoise, (xz - vec2(w.y, w.x) * t * 0.9) / 380.0 + vLayer * 0.61).g;
  float n3 = texture2D(uNoise, (xz + w * t * 2.2) / 120.0 + vLayer * 0.13).a;
  float n = n1 * 0.52 + n2 * 0.34 + n3 * 0.14;
  float cover = smoothstep(uMist.y - 0.16, uMist.y + 0.24, n);
  // thin up the shores: the layer fades in over a few metres of depth
  float shore = smoothstep(0.0, 3.0 + vThick * 0.3, vDepth);
  float dens = cover * shore * vEdge;
  vec3 V = vWorld - cameraPosition;
  float dist = length(V);
  V /= dist;
  float slab = (vThick / uLayers) / max(abs(V.y), 0.08);
  float alpha = 1.0 - exp(-dens * slab * uMist.z * 0.03);
  // never a sheet in the camera's face or edge-on through the eye
  alpha *= smoothstep(15.0, 110.0, dist) * smoothstep(0.5, 7.0, abs(cameraPosition.y - vWorld.y));
  alpha *= uMist.x;
  if (alpha < 0.002) discard;
  // light: the atmosphere's in-scatter for this ray, sky from above, the sun scattering forward
  vec3 ins = atmoInscatter(V);
  float mu = dot(V, uKeyDir);
  float g = 0.55;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) * 0.08;
  float top = 0.75 + 0.25 * smoothstep(0.0, 1.0, vDepth / max(vThick, 1.0));
  vec3 col = ins * 0.82 + uSkyLight * 0.22 * top + uSunLight * (0.035 + hg) * top;
  vec4 f = atmoFogTerm(cameraPosition, vWorld);
  col = mix(col, f.rgb, f.a * 0.85);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;function ce(e,t){let n=[];for(let r=0;r<e.length-1;r++){let[i,a]=e[r],[o,s]=e[r+1],c=Math.hypot(o-i,s-a),l=Math.max(1,Math.round(c/t));for(let t=0;t<l+ +(r===e.length-2);t++){let e=t/l;n.push({x:i+(o-i)*e,z:a+(s-a)*e,tx:(o-i)/c,tz:(s-a)/c})}}for(let e=1;e<n.length-1;e++){let t=n[e-1].tx+n[e+1].tx,r=n[e-1].tz+n[e+1].tz,i=Math.hypot(t,r)||1;n[e].tx=t/i,n[e].tz=r/i}return n}async function le(e,t,n){let r=(t,n)=>e.surfaceAt(t,n),i=[],o=[],s=[],c=0;for(let e of U){let t=[],n=0,a=0;if(e.type===`disc`){let i=Math.ceil(e.r*2/e.step)+1;n=a=i;for(let n=0;n<i;n++)for(let a=0;a<i;a++){let i=e.x-e.r+a*e.step,o=e.z-e.r+n*e.step,s=Math.hypot(i-e.x,o-e.z)/e.r,c=1-S.smoothstep(s,.72,1),l=s<1.05?r(i,o):1e4;t.push([i,e.top,o,l,e.thick,c,e.dens])}}else{let i=ce(e.pts,e.step),o=Math.ceil(e.half*2/e.step)+1;a=i.length,n=o;let s=i.map(t=>{let n=1/0;for(let i=-4;i<=4;i++)n=Math.min(n,r(t.x-t.tz*e.half*.25*i,t.z+t.tx*e.half*.25*i));return n+e.thick}),c=s.map((e,t)=>{let n=0,r=0;for(let e=-3;e<=3;e++){let i=s[Math.min(s.length-1,Math.max(0,t+e))];n+=i,r++}return n/r});for(let o=0;o<a;o++){let s=i[o],l=S.smoothstep(Math.min(o,a-1-o),0,6);for(let i=0;i<n;i++){let n=-e.half+i*e.step,a=s.x-s.tz*n,u=s.z+s.tx*n,d=(1-S.smoothstep(Math.abs(n)/e.half,.7,1))*l;t.push([a,c[o],u,r(a,u),e.thick,d,e.dens])}}}let l=e=>e[1]-e[3]>.5&&e[5]>.001,u=new Int32Array(t.length).fill(-1),d=e=>{if(u[e]<0){let n=t[e];u[e]=c++,i.push(n[0],n[1],n[2]),o.push(n[3],n[4],n[5],n[6])}return u[e]};for(let e=0;e<a-1;e++)for(let r=0;r<n-1;r++){let i=e*n+r,a=i+1,o=i+n,c=o+1;if(!(l(t[i])||l(t[a])||l(t[o])||l(t[c])))continue;let u=d(i),f=d(a),p=d(o),m=d(c);s.push(u,p,f,f,p,m)}await H()}let d=e.quality.level===`low`?2:3,p=new l;p.setAttribute(`position`,new a(i,3)),p.setAttribute(`aMist`,new a(o,4)),p.setAttribute(`aLayer`,new f(new Float32Array(Array.from({length:d},(e,t)=>t)),1)),p.setIndex(s),p.instanceCount=d,p.computeBoundingSphere(),p.boundingSphere.radius+=60;let m={value:new y(1,.5,1)},h=new x({name:`life-mist`,uniforms:{...e.fogUniforms(),...t,uNoise:{value:n},uLayers:{value:d},uMist:m},vertexShader:W,fragmentShader:G,fog:!0,transparent:!0,depthWrite:!1}),g=new u(p,h);return g.name=`life-mist`,g.renderOrder=3,{mesh:g,triangles:s.length/3*d,update(){let t=e.env,n=t.hour,r=S.smoothstep(n,15.5,18.4)*(1-S.smoothstep(n,22.5,24)),i=Math.max(t.morning,t.twilight*.9,t.night*.7,r*.6);m.value.x=.18+.55*i,m.value.y=.66-.18*i,m.value.z=.45+.55*i}}}var K=Math.PI*2,q=5,J=[{at:[-250,1360,-980],orbit:[700,420],period:1900,phase:.3,scale:1.12,ribs:11,crown:120,threads:22,spin:1/340},{at:[980,1660,-2080],orbit:[520,320],period:2300,phase:2.1,scale:.88,ribs:9,crown:96,threads:16,spin:-1/410},{at:[-1500,1200,380],orbit:[480,560],period:2100,phase:4,scale:1,ribs:12,crown:110,threads:19,spin:1/380},{at:[1420,1520,820],orbit:[600,460],period:2600,phase:5.2,scale:1.24,ribs:13,crown:130,threads:25,spin:-1/300},{at:[120,1800,-2250],orbit:[380,200],period:1700,phase:1.3,scale:.7,ribs:9,crown:84,threads:13,spin:1/260}],ue=[[0,95,0],[.05,90,15],[.15,72,43],[.3,42,64],[.45,12,73],[.6,-18,70],[.75,-48,58],[.88,-75,42],[1,-100,30]],Y=[[30,-100],[37,-118],[49,-138],[59,-160],[63,-180],[61,-198]];function X(e,t,n,r,i){let a=i*i,o=a*i;return .5*(2*t+(-e+n)*i+(2*e-5*t+4*n-r)*a+(-e+3*t-3*n+r)*o)}function Z(e){let t=ue,n=0;for(;n<t.length-2&&e>t[n+1][0];)n++;let r=t[Math.max(0,n-1)],i=t[n],a=t[n+1],o=t[Math.min(t.length-1,n+2)],s=(e-i[0])/(a[0]-i[0]);return[X(r[1],i[1],a[1],o[1],s),Math.max(0,X(r[2],i[2],a[2],o[2],s))]}var Q=`
uniform vec4 uFormPos[${q}];   // xyz world centre, w scale
uniform mat3 uFormRot[${q}];
uniform vec4 uFormAnim[${q}];  // x breath phase, y crown phase, z/w unused
uniform vec4 uFormDrag[${q}];  // xyz world drag vector (m of trailing per 100 m of thread)
uniform vec4 uSkyForms;         // x visibility (alpha + lit gain), y night glow, zw unused

// breathing: the husk swells around its equator; claws and threads ride along with the mouth
vec3 formBreath(vec3 p, float breath) {
  float b = sin(breath);
  float w = 1.0 - smoothstep(0.0, 115.0, abs(p.y - 5.0));
  float sr = 1.0 + 0.045 * b * w + 0.03 * b * smoothstep(-95.0, -150.0, p.y);
  p.xz *= sr;
  p.y *= 1.0 - 0.012 * b * step(-100.0, p.y);
  return p;
}
`,de=`
${E}
${Q}
attribute vec4 aB; // form id, kind (0 membrane, 1 rib), v along the profile, seed
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vB;
#include <fog_pars_vertex>
void main() {
  int f = int(aB.x + 0.5);
  vec4 fp = uFormPos[f];
  vec3 p = formBreath(position, uFormAnim[f].x);
  vec3 wp = fp.xyz + uFormRot[f] * (p * fp.w);
  vWorld = wp;
  vN = normalize(uFormRot[f] * normal);
  vB = aB;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,fe=`
${D}
uniform vec4 uSkyForms;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vB;
#include <fog_pars_fragment>
void main() {
  float t = uAtmoTime.x;
  vec3 V = normalize(vWorld - cameraPosition);
  vec3 n = normalize(vN);
  float ndv = abs(dot(n, V));
  float fres = pow(1.0 - ndv, 2.2);
  float rib = vB.y;
  float v = vB.z;
  // membrane: veins parallel to the ribs and growth rings, faded out before they alias
  float vw = vB.w * 4.0;
  float vr = v * 12.0;
  float aa = 1.0 - smoothstep(0.25, 0.7, max(fwidth(vw), fwidth(vr)));
  float veins = (pow(abs(sin(vw * 3.1416)), 16.0) * 0.6 + pow(abs(sin(vr * 3.1416)), 20.0) * 0.35) * aa;
  float a = mix(0.035 + 0.42 * fres + 0.08 * veins, 0.3 + 0.45 * fres, rib);
  // light: sun through the membrane when it is behind the form, soft sky, a little diffuse
  float mu = max(dot(V, uKeyDir), 0.0);
  float trans = pow(mu, 4.0) * 1.3 + pow(mu, 24.0) * 2.5;
  float diff = max(dot(n, uKeyDir), 0.0) * 0.5 + max(-dot(n, uKeyDir), 0.0) * 0.25;
  vec3 ivory = vec3(0.92, 0.86, 0.76);
  vec3 lit = ivory * (uSkyLight * 0.5 + uSunLight * (0.1 * diff + trans * (1.0 - rib * 0.7)));
  a *= uSkyForms.x;
  vec3 col = lit * a;
  // night: veins and ribs wake a faint cold cyan; a slow pulse climbs down from the crown
  float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(v * 9.0 - t * 0.45 + vB.w * 2.0), 6.0);
  vec3 cyan = vec3(0.37, 0.9, 1.0);
  col += cyan * uSkyForms.y * pulse * (0.05 * (0.3 + veins) * (1.0 - rib) + 0.1 * rib + 0.02 * fres);
  // haze swallows them: fade (not tint) with the atmosphere's optical depth
  vec4 fogT = atmoFogTerm(cameraPosition, vWorld);
  float keep = 1.0 - fogT.a;
  col = col * keep + fogT.rgb * (a * fogT.a * 0.35);
  gl_FragColor = vec4(col, a * keep);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,$=`
${E}
${Q}
attribute vec3 aTan;
attribute vec4 aL; // form id, kind (0 crown, 1 thread, 2 fibre, 3 bead sprite, 4 seed sprite), u along, seed
attribute vec4 aW; // side (-1..1) / sprite corner x, sprite corner y, width or sprite size (m), curve length (m)
varying vec4 vL;
varying vec2 vUV;
varying float vCov;
varying vec3 vWorld;
#include <fog_pars_vertex>

vec3 deformLine(vec3 p, float kind, float u, float seed, float len, float t, int f) {
  p = formBreath(p, uFormAnim[f].x);
  if (kind < 0.5) {
    // crown filaments open and close a beat after the husk, and flutter
    vec3 apex = vec3(0.0, 92.0, 0.0);
    vec3 q = p - apex;
    float o = 1.0 + 0.09 * sin(uFormAnim[f].y);
    q.xz *= o;
    q.y -= (o - 1.0) * 0.45 * length(q.xz);
    q += vec3(sin(t * 0.9 + seed * 40.0 + u * 7.0), 0.4 * sin(t * 0.7 + seed * 23.0), cos(t * 0.8 + seed * 31.0 + u * 6.0)) * (1.8 * u * u);
    p = apex + q;
  } else if (kind < 1.5 || (kind > 2.5 && kind < 3.5)) {
    // threads (and their beads): travelling waves growing toward the free end
    float amp = 0.075 * len * pow(u, 1.5);
    p += amp * vec3(sin(t * 0.19 - u * 3.8 + seed * 6.28), 0.0, cos(t * 0.15 - u * 3.1 + seed * 4.1));
    p.y += 0.02 * len * u * u * sin(t * 0.11 + seed * 9.0);
  }
  return p;
}

void main() {
  int f = int(aL.x + 0.5);
  float kind = aL.y;
  float u = aL.z;
  float seed = aL.w;
  float t = uLifeTime.x;
  vec4 fp = uFormPos[f];
  mat3 R = uFormRot[f];
  vec3 lp = deformLine(position, kind, u, seed, aW.w, t, f);
  vec3 wp = fp.xyz + R * (lp * fp.w);
  // threads trail behind the drift
  if (kind > 0.5 && kind < 1.5 || (kind > 2.5 && kind < 3.5)) wp += uFormDrag[f].xyz * (u * u * aW.w * 0.01 * fp.w);
  float dist = max(length(wp - cameraPosition), 1.0);
  vL = aL;
  vUV = aW.xy;
  vec4 mvPosition;
  if (kind > 2.5) {
    // camera-facing glow sprite; never smaller than a few pixels (energy kept via vCov)
    float size = aW.z * fp.w;
    float minSize = 3.0 * dist / uProj;
    float s = max(size, minSize);
    vCov = (size / s) * (size / s);
    mvPosition = viewMatrix * vec4(wp, 1.0);
    mvPosition.xy += aW.xy * s * 0.5;
  } else {
    // camera-facing ribbon at least ~1.2 px wide; thinner ones fade instead of aliasing
    vec3 T = normalize(R * aTan);
    vec3 side = normalize(cross(T, wp - cameraPosition));
    float w = aW.z * fp.w;
    float minW = 1.3 * dist / uProj;
    float ww = max(w, minW);
    vCov = w / ww;
    wp += side * aW.x * ww * 0.5;
    mvPosition = viewMatrix * vec4(wp, 1.0);
  }
  vWorld = wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,pe=`
${D}
uniform vec4 uSkyForms;
varying vec4 vL;
varying vec2 vUV;
varying float vCov;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
  float t = uAtmoTime.x;
  float kind = vL.y;
  float u = vL.z;
  float seed = vL.w;
  vec3 V = normalize(vWorld - cameraPosition);
  float mu = max(dot(V, uKeyDir), 0.0);
  vec3 amber = vec3(1.0, 0.62, 0.28);
  vec3 cyan = vec3(0.37, 0.9, 1.0);
  vec3 col;
  if (kind > 2.5) {
    float r2 = dot(vUV, vUV);
    float g = exp(-r2 * 5.0) + 0.35 * exp(-r2 * 1.6);
    g *= 1.0 - smoothstep(0.8, 1.0, r2);
    float isSeed = step(3.5, kind);
    // beads: pale pearls by day (lit from behind), amber embers at night, pulsing slowly
    float beat = 0.55 + 0.45 * sin(t * 0.35 + seed * 20.0 + u * 6.0);
    vec3 day = uSunLight * (0.02 + 0.25 * pow(mu, 6.0)) + uSkyLight * 0.05;
    vec3 night = amber * (isSeed > 0.5 ? 1.6 : 1.1) * beat;
    col = (day * uSkyForms.x * mix(0.8, 1.6, isSeed) + night * uSkyForms.y) * g;
  } else {
    float across = 1.0 - vUV.x * vUV.x;
    // silk: catches the light when the sun is behind it, a faint sheen otherwise
    vec3 day = uSunLight * (0.025 + 0.4 * pow(mu, 5.0) + 0.8 * pow(mu, 30.0)) + uSkyLight * 0.045;
    float fadeEnd = kind < 0.5 ? 1.0 - smoothstep(0.7, 1.0, u) * 0.8 : 1.0 - smoothstep(0.85, 1.0, u) * 0.6;
    // night: signals run down the threads, the crown shimmers cold
    float sig = pow(0.5 + 0.5 * sin(u * 22.0 - t * 0.55 + seed * 30.0), 14.0);
    vec3 night = kind < 0.5 ? cyan * (0.1 + 0.25 * sig) : mix(cyan * 0.12, amber * 1.4, sig);
    col = (day * uSkyForms.x + night * uSkyForms.y) * across * fadeEnd * (kind > 1.5 ? 0.6 : 1.0);
  }
  col *= vCov;
  vec4 fogT = atmoFogTerm(cameraPosition, vWorld);
  col *= 1.0 - fogT.a;
  gl_FragColor = vec4(col, 0.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;function me(e,n,r,i,a){let o=n.ribs,s=[];for(let e=0;e<o;e++)s.push((e+r.range(-.12,.12))/o*K);let c=o*6,l=new Float32Array(o).fill(2);for(let e=0;e<o;e++)r()<.35&&(l[e]=r.range(.55,.85));let u=[],d=[];for(let e=0;e<=30;e++){let[t,n]=Z(e/30);for(let e=0;e<=c;e++){let r=Math.floor(e/6)%o,i=e%6/6,a=s[r],l=a+((r===o-1?s[0]+K:s[r+1])-a)*(e===c?1:i),f=n*(1-.12*Math.sin(Math.PI*(e===c?0:i))**2);u.push([Math.cos(l)*f,t,Math.sin(l)*f]),d.push(l)}}let f=new h,p=new Float32Array(u.length*3);u.forEach((e,t)=>p.set(e,t*3)),f.setAttribute(`position`,new t(p,3));let m=[],g=c+1;for(let e=0;e<30;e++){let t=(e+.5)/30;for(let n=0;n<c;n++){let r=Math.floor(n/6);if(t>l[r]+.06*Math.sin(n*2.7+r*1.3)+.03*Math.sin(n*7.1))continue;let i=e*g+n;m.push(i,i+g,i+1,i+1,i+g,i+g+1)}}f.setIndex(m),f.computeVertexNormals();let _=f.attributes.normal.array,v=i.P.length/3;for(let t=0;t<u.length;t++)i.P.push(...u[t]),i.N.push(_[t*3],_[t*3+1],_[t*3+2]),i.B.push(e,0,Math.floor(t/g)/30,d[t]*o/K);for(let e of m)i.I.push(v+e);let y=[];for(let t=0;t<o;t++){let n=s[t],a=Math.cos(n),c=Math.sin(n),l=[];for(let e=1;e<=36;e++){let t=e/36,[n,r]=Z(t);l.push([r+1.2,n,t])}let u=r.range(.85,1.08);for(let e=1;e<Y.length;e++)l.push([Y[e][0]*(.9+.1*u),Y[0][1]+(Y[e][1]-Y[0][1])*u,1+e/Y.length]);let d=l[l.length-1];y.push([a*d[0],d[1],c*d[0]]);let f=i.P.length/3;for(let t=0;t<l.length;t++){let[r,s,u]=l[t],d=l[Math.max(0,t-1)],f=l[Math.min(l.length-1,t+1)],p=f[0]-d[0],m=f[1]-d[1],h=Math.hypot(p,m)||1;p/=h,m/=h;let g=m,_=-p,v=2.4*(1-.35*Math.min(1,u))*(u<.04?.6:1);for(let t=0;t<5;t++){let l=t/5*K,d=Math.cos(l),f=Math.sin(l),p=d*g*a-f*c,m=d*_,h=d*g*c+f*a;i.P.push(a*r+p*v,s+m*v,c*r+h*v),i.N.push(p,m,h),i.B.push(e,1,Math.min(1.2,u),n*o/K)}}for(let e=0;e<l.length-1;e++)for(let t=0;t<5;t++){let n=f+e*5+t,r=f+e*5+(t+1)%5;i.I.push(n,n+5,r,r,n+5,r+5)}}let b=(t,n,r,i,o,s)=>{let c=a.P.length/3,l=t.length;for(let c=0;c<l;c++){let u=t[c],d=t[Math.min(l-1,c+1)],f=t[Math.max(0,c-1)],p=d[0]-f[0],m=d[1]-f[1],h=d[2]-f[2],g=Math.hypot(p,m,h)||1;p/=g,m/=g,h/=g;let _=c/(l-1),v=r+(i-r)*_;for(let t of[-1,1])a.P.push(u[0],u[1],u[2]),a.T.push(p,m,h),a.L.push(e,n,_,o),a.W.push(t,0,v,s)}for(let e=0;e<l-1;e++){let t=c+e*2;a.I.push(t,t+1,t+2,t+1,t+3,t+2)}},x=(t,n,r,i,o,s)=>{let c=a.P.length/3;for(let[c,l]of[[-1,-1],[1,-1],[1,1],[-1,1]])a.P.push(t[0],t[1],t[2]),a.T.push(0,1,0),a.L.push(e,n,i,o),a.W.push(c,l,r,s);a.I.push(c,c+1,c+2,c,c+2,c+3)};for(let e=0;e<n.crown;e++){let e=r()*K,t=S.degToRad(r.range(18,78)),n=r.range(95,165)*(1-t/1.4*.25),i=r.range(2,13),a=[Math.cos(e)*i,Z(i/300)[0]+1,Math.sin(e)*i],o=[Math.cos(e)*Math.sin(t),Math.cos(t),Math.sin(e)*Math.sin(t)],s=[];for(let e=0;e<=14;e++){let r=e/14;s.push([a[0]+o[0]*n*r,a[1]+o[1]*n*r-.32*n*r*r*(.6+Math.sin(t)),a[2]+o[2]*n*r])}let c=r();b(s,0,1.1,.5,c,n);let l=s[14],u=r.int(2,4);for(let t=0;t<u;t++){let t=e+r.range(-.9,.9),i=r.range(10,22),a=[];for(let e=0;e<=3;e++){let n=e/3;a.push([l[0]+Math.cos(t)*i*n,l[1]+r.range(-.3,.6)*i*n-.4*i*n*n,l[2]+Math.sin(t)*i*n])}b(a,0,.5,.25,c,n)}}let C=[0,-8,0];x(C,4,70,0,r(),0),x(C,4,26,0,r(),0);for(let e=0;e<o;e++)for(let t of[.35,.62]){let[n,i]=Z(t+r.range(-.05,.05)),a=s[e],o=[Math.cos(a)*i*.98,n,Math.sin(a)*i*.98],c=[];for(let e=0;e<=6;e++){let t=e/6;c.push([C[0]+(o[0]-C[0])*t,C[1]+(o[1]-C[1])*t-4*Math.sin(Math.PI*t),C[2]+(o[2]-C[2])*t])}b(c,2,.7,.5,r(),70)}for(let e=0;e<n.threads;e++){let t;if(e<o)t=y[e];else{let e=r()*K,n=r.range(8,24);t=[Math.cos(e)*n,-92+r.range(-4,4),Math.sin(e)*n]}let n=e<o?r.range(240,480):r.range(360,650),i=r(),a=Math.round(n/9),s=[t[0]*6e-4*n,t[2]*6e-4*n],c=[];for(let e=0;e<=a;e++){let r=e/a;c.push([t[0]+s[0]*r,t[1]-n*r,t[2]+s[1]*r])}b(c,1,.9,.6,i,n);let l=r.range(25,50);for(;l<n-20;){let e=l/n;x([t[0]+s[0]*e,t[1]-l,t[2]+s[1]*e],3,r.range(3.5,6),e,i,n),l+=r.range(30,62)}x([t[0]+s[0],t[1]-n,t[2]+s[1]],3,r.range(10,15),1,i,n)}for(let e of y)x(e,3,9,0,r(),1)}function he(e,t){let n=e.noise.createRng(`life-skyforms`),r=e.quality.level,i=J.slice(0,r===`low`?3:J.length),o={P:[],N:[],B:[],I:[]},s={P:[],T:[],L:[],W:[],I:[]};i.forEach((e,t)=>{let i={...e};r===`low`&&(i.crown=Math.round(i.crown*.6),i.threads=Math.round(i.threads*.7)),me(t,i,n,o,s)});let c=new h;c.setAttribute(`position`,new a(o.P,3)),c.setAttribute(`normal`,new a(o.N,3)),c.setAttribute(`aB`,new a(o.B,4)),c.setIndex(o.I);let l=new h;l.setAttribute(`position`,new a(s.P,3)),l.setAttribute(`aTan`,new a(s.T,3)),l.setAttribute(`aL`,new a(s.L,4)),l.setAttribute(`aW`,new a(s.W,4)),l.setIndex(s.I);let d={uFormPos:{value:Array.from({length:q},()=>new p(0,-1e5,0,1))},uFormRot:{value:Array.from({length:q},()=>new b)},uFormAnim:{value:Array.from({length:q},()=>new p)},uFormDrag:{value:Array.from({length:q},()=>new p)},uSkyForms:{value:new p(1,0,0,0)}},f=new x({name:`life-skyforms-body`,uniforms:{...e.fogUniforms(),...t,...d},vertexShader:de,fragmentShader:fe,fog:!0,transparent:!0,premultipliedAlpha:!0,depthWrite:!1,side:2}),_=new x({name:`life-skyforms-lines`,uniforms:{...e.fogUniforms(),...t,...d},vertexShader:$,fragmentShader:pe,fog:!0,transparent:!0,premultipliedAlpha:!0,depthWrite:!1,side:2}),y=new v;y.name=`life-skyforms`;let C=new u(c,f);C.name=`life-skyforms-body`,C.frustumCulled=!1,C.renderOrder=4;let w=new u(l,_);w.name=`life-skyforms-lines`,w.frustumCulled=!1,w.renderOrder=5,y.add(C,w);let T=new m,E=new g;function D(e){for(let t=0;t<i.length;t++){let n=i[t],r=K/n.period,a=e*r+n.phase,o=n.at[0]+n.orbit[0]*Math.cos(a),s=n.at[2]+n.orbit[1]*Math.sin(a),c=n.at[1]+28*Math.sin(e*.011+n.phase*3.1)+10*Math.sin(e*.037+n.phase);d.uFormPos.value[t].set(o,c,s,n.scale);let l=-n.orbit[0]*r*Math.sin(a),u=n.orbit[1]*r*Math.cos(a),f=.308*Math.cos(e*.011+n.phase*3.1);d.uFormDrag.value[t].set(-l*2.2,-f,-u*2.2,0);let p=e*K*n.spin+n.phase*2;E.set(.05*Math.sin(e*.071+n.phase),p,.045*Math.sin(e*.053+n.phase*2),`YXZ`),T.makeRotationFromEuler(E),d.uFormRot.value[t].setFromMatrix4(T);let m=e*(K/(26+6*t))+n.phase*5;d.uFormAnim.value[t].set(m,m-1.1,0,0)}}return D(0),{mesh:y,triangles:(o.I.length+s.I.length)/3,update(t,n){D(n);let r=e.env,i=d.uSkyForms.value;i.x=.5+.35*r.twilight-.05*r.night,i.y=S.smoothstep(r.night,.3,.9)}}}async function ge(e){let{scene:t,env:n,camera:r,renderer:i}=e,a=w(e),o=performance.now(),s={birds:null,motes:null,fireflies:null,mist:null,skyforms:null,stats:{}};e.life=s;let c=()=>new Promise(e=>requestAnimationFrame(()=>e())),l=async(e,n)=>{let r=performance.now();try{let i=await n();i?.mesh&&t.add(i.mesh),s[e]=i,s.stats[e]=Math.round(performance.now()-r)}catch(t){console.error(`[life] ${e} failed:`,t),s[e]=null}};await l(`birds`,()=>P(e,a)),await l(`motes`,()=>L(e,a)),await l(`fireflies`,()=>V(e,a));let u=T(e.noise.createRng(`life-noise`),128);await l(`mist`,()=>le(e,a,u)),await l(`skyforms`,()=>he(e,a));let d=a,f=n.palette,p=new _,m=[];for(let e of[`birds`,`motes`,`fireflies`,`mist`,`skyforms`])s[e]?.update&&m.push(s[e]);function h(){let e=d.uLifeEnv.value;e.x=n.night,e.y=n.twilight,e.z=n.morning,e.w=S.smoothstep(n.sunElevation,-3,4),d.uKeyDir.value.copy(n.keyDir),d.uSunLight.value.copy(n.sun.color).multiplyScalar(n.sun.intensity),d.uSkyLight.value.copy(f.hemiSky).multiplyScalar(f.hemiIntensity*.9+.05),i.getDrawingBufferSize(p),d.uProj.value=p.y/(2*Math.tan(S.degToRad(r.fov)*.5))}return h(),s.stats.buildMs=Math.round(performance.now()-o),await c(),{order:20,update(e,t){h();for(let n=0;n<m.length;n++)m[n].update(e,t)}}}export{ge as build};