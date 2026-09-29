// FABOTANIC about — 作例シーンの描画と3Dビューアー。
// about.html の作例画像も、このファイルを mode:'still' で動かして撮影している（画像と3Dが同じ場面になる）。
// 画像をクリックしたときだけ about.html から読み込む（検索エンジンのレンダリングに3Dを抱えさせないため）。
// 植物は FABOTANIC から書き出したGLB（テクスチャ512px・頂点を量子化して軽量化）。
// 空・雲・山並み・地面の陰り・周囲の反射光は、最初に1回だけ作る。動かしている間の負荷はほぼ植物だけ。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const BASE = new URL('./scenes/', import.meta.url).href;

function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(x,z){let h=Math.imul(x|0,374761393)+Math.imul(z|0,668265263);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
 const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,z){let s=0,a=.5,f=1;for(let i=0;i<4;i++){s+=a*vnoise(x*f,z*f);a*=.5;f*=2}return s}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const dirFrom=(azDeg,elDeg)=>{const a=azDeg*Math.PI/180,e=elDeg*Math.PI/180;return new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e));};

// 近景 n- / 中景 m- / 遠景 b- を書き出してある草花
const LOD = {meadow:1,meadowb:1,meadowc:1,grass:1,fern:1,daisy:1,poppy:1,yarrow:1};

// 方位は画面の正面（-Z）から右回りの角度。太陽は画面に入る位置に置き、横からの光で長い影を落とす
export const SCENES = {
 forest:{label:'森のはずれ',cam:[0,1.6,0],look:[-4,5.2,-40],fov:52,sun:dirFrom(112,40),sunColor:0xfff0d6,sunI:3.5,
  grade:{wb:[1.02,1,.97],sat:1.06,con:1.06,lift:.025,sh:[.9,1.02,1.04],hi:[1.05,1.02,.93]},
  top:0x3576cf,hor:0xdfe9ef,clouds:.45,mount:[0x6f8a8a,0x93a8a6],fog:[50,260],exposure:1.15,walk:14,
  ground:[[0.30,0.36,0.16],[0.40,0.36,0.20]],path:[0.48,0.40,0.28],
  hill:(x,z)=>(fbm(x*.03,z*.03)-.5)*3+Math.max(0,-z-60)*0.07},
 meadow:{label:'野の花の草原',cam:[0,1.35,0],look:[-2,0.6,-24],fov:54,sun:dirFrom(128,7),sunColor:0xffab62,sunI:3.6,
  grade:{wb:[1.08,1,.88],sat:1.12,con:1.08,lift:.02,sh:[.92,.9,1.08],hi:[1.08,1.0,.86]},
  top:0x4b6fb2,hor:0xf4d2a8,clouds:.6,mount:[0x8a7f8c,0xb09a98],fog:[50,240],exposure:1.1,walk:14,
  ground:[[0.22,0.36,0.11],[0.30,0.42,0.14]],
  hill:(x,z)=>(fbm(x*.025,z*.025)-.5)*2.6+Math.max(0,-z-50)*0.05},
 tropical:{label:'南国の庭',cam:[0,1.7,0],look:[3,1.8,-30],fov:54,sun:dirFrom(20,22),sunColor:0xfff6e4,sunI:4.2,glare:1.3,
  grade:{wb:[1,1,1.02],sat:1.22,con:1.2,lift:0,sh:[.86,.97,1.08],hi:[1.04,1.02,.97]},
  top:0x0a5ee0,hor:0xbfe5f4,clouds:.22,mount:[0x4f8f86,0x80b3b4],fog:[120,600],exposure:1.22,walk:12,
  ground:[[0.93,0.87,0.72],[0.86,0.79,0.63]],sea:-0.35,
  hill:(x,z)=>(fbm(x*.03,z*.03)-.5)*1.0+0.45-smooth(-11,-24,z)*2.6},
 lowpoly:{label:'ローポリの丘',cam:[0,8.5,17],look:[0,2.2,-9],fov:44,sun:dirFrom(-55,32),sunColor:0xfff0d8,sunI:3.0,
  grade:{wb:[1.03,1,.97],sat:1.1,con:.94,lift:.05,sh:[.9,1.04,1.02],hi:[1.04,1.02,.95]},
  top:0x4c95ea,hor:0xcfe6f2,clouds:.45,mount:[0x5f93b0,0x8fbbd2],mountH:.45,fog:[120,420],exposure:1.08,walk:22,flat:true,
  ground:[[0.46,0.58,0.26],[0.54,0.62,0.30]],pond:[5,-6,-0.9],
  hill:(x,z)=>(fbm(x*.05,z*.05)-.5)*4-2.8*Math.exp(-((x-5)**2+(z+6)**2)/70)},
};

// 植える場所を決める。全周に植え、作例の画角の中は密に。遠いものは中景・遠景モデルにする
function plan(name,C,start,mode){
 const rnd=mulberry32(7),R=(a,b)=>a+(b-a)*rnd(),pick=a=>a[Math.floor(rnd()*a.length)];
 const hAt=C.hill,out=[],cell=new Map();
 const put=(key,x,z,s,shadow=true)=>out.push({key,x,y:hAt(x,z),z,s,rot:R(0,Math.PI*2),shadow});
 // minD の判定は格子で引く（数千本でも速い）
 function scatter(n,area,choose,minD,{s=[1,1],shadow=true,skip=null,tries=30}={}){
  const g=new Map(),k=Math.max(minD,.25),key=(i,j)=>i+','+j;let placed=0,t=0;
  while(placed<n&&t++<n*tries){const [x,z]=area();if(skip&&skip(x,z))continue;
   const i=Math.floor(x/k),j=Math.floor(z/k);let ok=true;
   if(minD)for(let a=-1;a<=1&&ok;a++)for(let b=-1;b<=1&&ok;b++){const L=g.get(key(i+a,j+b));if(L)for(const p of L)if((p[0]-x)**2+(p[1]-z)**2<minD*minD){ok=false;break;}}
   if(!ok)continue;const c=key(i,j);if(!g.has(c))g.set(c,[]);g.get(c).push([x,z]);placed++;
   const kk=choose(x,z);if(kk)put(kk,x,z,R(s[0],s[1]),shadow);}
 }
 const box=(x0,x1,z0,z1)=>()=>[R(x0,x1),R(z0,z1)];
 const disk=(cx,cz,r0,r1)=>()=>{const a=R(-Math.PI,Math.PI),r=Math.sqrt(R(r0*r0,r1*r1));return[cx+Math.cos(a)*r,cz+Math.sin(a)*r];};
 const cx=start.x,cz=start.z,far=(x,z)=>Math.hypot(x-cx,z-cz);
 const onPath=(x,z)=>z<-1&&z>-26&&Math.abs(x+.6*z/10-Math.sin(z*.12)*.8)<1.2;
 if(name==='forest'){
  [[-7,-10],[-10.5,-17],[6.5,-12],[10,-19],[-4.5,-26],[4.5,-31],[-13,-7],[13,-8],[-9,5],[8,7],[-15,-24]].forEach(([x,z],i)=>put(['n-zelkova-1','n-oak-1','n-tree-1'][i%3],x,z,R(3.8,4.8)));
  scatter(70,disk(cx,cz,24,70),()=>pick(['m-zelkova','m-oak']),3.6,{s:[3.8,5]});
  scatter(1100,disk(cx,cz,70,210),()=>pick(['b-zelkova','b-oak','b-fir','b-cedar','b-maple','b-ginkgo']),2.4,{s:[3.8,5.6],shadow:false});
  scatter(260,disk(cx,cz,3,30),()=>'fern',.9,{s:[1.1,1.7],skip:onPath});
  scatter(3600,disk(cx,cz,.9,32),(x,z)=>rnd()<.06?'meadowc':pick(['meadow','meadowb','meadow','grass','meadowb']),.42,{s:[.9,1.3],skip:(x,z)=>onPath(x,z)||(far(x,z)<3&&z<0&&Math.abs(x)<2.2)});
  scatter(260,disk(cx,cz,1.2,20),()=>pick(['daisy','yarrow','daisy']),.7,{s:[.9,1.2],skip:onPath});
 }
 if(name==='meadow'){
  put('n-cherry-1',7,-22,4.3);put('n-zelkova-1',-15,-36,4.7);put('m-oak',-8,-44,4.4);put('m-zelkova',21,-46,4.5);put('n-oak-1',-26,-18,4.4);
  scatter(18,disk(cx,cz,26,60),()=>pick(['m-oak','m-zelkova']),6,{s:[4,4.8],skip:(x,z)=>z>-10&&Math.abs(x)<30});
  scatter(900,disk(cx,cz,60,220),()=>pick(['b-zelkova','b-oak','b-maple','b-cedar']),2.8,{s:[3.6,5.2],shadow:false});
  scatter(6200,disk(cx,cz,.6,34),()=>rnd()<.05?'meadowc':pick(['meadow','meadowb','meadowb','meadow']),.36,{s:[.9,1.3]});
  scatter(2600,disk(cx,cz,.8,20),(x,z)=>{const r=fbm(x*.18+3,z*.18);return r<.45?'poppy':r<.6?pick(['daisy','yarrow']):'daisy';},.24,{s:[1.1,1.5]});
 }
 if(name==='tropical'){
  [[-7,-9,2.9],[6.5,-12,3.2],[-3,-15,3.4],[13,-15,3.0],[-14,-13,3.1],[-6,6,3.0],[8,4,3.2],[18,-6,3.3],[-19,-3,3.1]].forEach(([x,z,s],i)=>put(i%3===2?'n-palmfan':'n-palmpinnate',x,z,s));
  scatter(26,box(-90,90,-18,-8),()=>pick(['n-palmpinnate','n-palmpinnate','n-palmfan']),7,{s:[2.6,3.4],skip:(x,z)=>Math.abs(x)<22});
  scatter(80,disk(cx,cz,6,24),(x,z)=>pick(far(x,z)<9?['n-ficus','n-splitleaf','n-hardleaf']:['n-cycad','n-ficus','n-splitleaf','n-hardleaf','n-splitleaf','n-ficus']),1.4,{s:[1.2,1.9],skip:(x,z)=>(Math.abs(x-.15*z)<1.6&&z<0)||z<-11});
  scatter(700,disk(cx,cz,1.4,30),()=>rnd()<.06?'n-succulentb':pick(['fern','grass','fern','grass']),.72,{s:[1,1.5],skip:(x,z)=>(Math.abs(x-.15*z)<1.1&&z<0)||z<-12});
 }
 if(name==='lowpoly'){
  const [px,pz]=C.pond,inPond=(x,z)=>Math.hypot(x-px,z-pz)<7.5;
  scatter(200,disk(0,0,0,48),()=>pick(['l-tree','l-oak','l-fir','l-pine','l-cherry','l-fir','l-oak']),2.7,{s:[1.8,2.7],skip:(x,z)=>inPond(x,z)||Math.hypot(x-cx,z-cz)<8||fbm(x*.07+4,z*.07)<.42});
  scatter(1300,disk(0,0,0,46),()=>pick(['l-meadow','l-grass','l-grass','l-daisy','l-fern']),.7,{s:[1.1,1.7],skip:inPond});
 }
 // 用途の選択と間引き：3D版は近景3m・中景9m、静止画は近景7m・中景18m
 const [NEAR,MID]=mode==='still'?[7,18]:[3,9],KEEP=mode==='still'?{n:1,m:1,b:1}:{n:1,m:.6,b:.45};
 const kept=[];
 for(const p of out){
  if(LOD[p.key]){const d=far(p.x,p.z),tier=d<NEAR?'n':d<MID?'m':'b';
   if(hash(p.x*97,p.z*89)>KEEP[tier])continue;p.s*=1/Math.sqrt(KEEP[tier]);p.key=tier+'-'+p.key;}
  kept.push(p);
 }
 return kept;
}

// 場面ごとの色の調整（カラーグレーディング）。three.js のトーンマッピングの最後に足すので、後処理の工程は増えない
const TM_ORIGINAL=THREE.ShaderChunk.tonemapping_pars_fragment;
function setGrade(g={}){
 const v=a=>'vec3('+a.map(x=>x.toFixed(4)).join(',')+')',f=x=>x.toFixed(4);
 const wb=g.wb||[1,1,1],sh=g.sh||[1,1,1],hi=g.hi||[1,1,1];
 THREE.ShaderChunk.tonemapping_pars_fragment=TM_ORIGINAL.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
 `vec3 CustomToneMapping( vec3 color ) {
 color *= ${v(wb)};
 color = ACESFilmicToneMapping( color );
 float l = dot( color, vec3( .2126, .7152, .0722 ) );
 color = mix( vec3( l ), color, ${f(g.sat??1)} );
 color = mix( color * ${v(sh)}, color * ${v(hi)}, smoothstep( .02, .55, l ) );
 color = ( color - .18 ) * ${f(g.con??1)} + .18;
 color = ${f(g.lift??0)} + color * ( 1. - ${f(g.lift??0)} );
 return clamp( color, 0., 1. );
}`);
}
const NOISE_GLSL=`float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}`;
// forEnv: 周囲の反射光を作るとき用。太陽の円と強い光の輪は入れない（地面に照り返しの形が出るため。太陽の光は光源で当てる）
function makeSky(C,forEnv=false){
 return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(C.top)},hor:{value:new THREE.Color(C.hor)},sunDir:{value:C.sun.clone().normalize()},sunCol:{value:new THREE.Color(C.sunColor)},clouds:{value:C.clouds},disc:{value:forEnv?0:1}},
  vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:NOISE_GLSL+`uniform vec3 top,hor,sunDir,sunCol;uniform float clouds,disc;varying vec3 p;
void main(){vec3 d=normalize(p);float h=d.y,sd=max(dot(d,sunDir),0.);
 vec3 col=mix(hor,top,pow(clamp(h+.02,0.,1.),.42));
 col=mix(col,hor*vec3(1.05,.98,.9),pow(1.-clamp(h,0.,1.),8.)*.5);
 col+=sunCol*(pow(sd,6.)*.22+(pow(sd,48.)*.55+pow(sd,600.)*2.2)*disc);
 col+=sunCol*smoothstep(.99955,.9998,sd)*14.*disc;
 if(h>0.){vec2 uv=d.xz/(h+.15);float c=fb(uv*1.3+vec2(3.,7.));c=smoothstep(.62-clouds*.3,.9,c)*smoothstep(0.,.18,h);
  vec3 cc=mix(vec3(1.),sunCol,.35)*(.85+pow(sd,4.)*.9);float edge=smoothstep(.3,.9,c);
  col=mix(col,cc*mix(.78,1.,1.-edge*.4),c*.8);}
 if(h<0.)col=mix(col,hor*.85,smoothstep(0.,-.05,h));
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});
}
function makeMountains(C){
 const g=new THREE.Group(),rnd=mulberry32(31),k=C.mountH??1;
 [[520,70*k,C.mount[1],.0],[330,48*k,C.mount[0],2.1]].forEach(([R,H,col,ph])=>{
  const N=360,pos=[],idx=[];
  for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,n=fbm(Math.cos(a)*3+ph,Math.sin(a)*3+ph*2),h=H*(.25+Math.pow(n,1.6)*1.4)+rnd()*2;
   pos.push(Math.sin(a)*R,-12,-Math.cos(a)*R,Math.sin(a)*R,h,-Math.cos(a)*R);if(i<N){const b=i*2;idx.push(b,b+1,b+2,b+1,b+3,b+2);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);
  const c=new THREE.Color(col).lerp(new THREE.Color(C.hor),.25);
  g.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:c,fog:false,side:THREE.DoubleSide})));});
 return g;
}
function detailTexture(flat){
 const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d'),r=mulberry32(5);
 x.fillStyle='#808080';x.fillRect(0,0,256,256);
 for(let i=0;i<(flat?600:5000);i++){const v=110+r()*60|0,s=flat?6+r()*10:1+r()*2.5;x.fillStyle=`rgba(${v},${v},${v},${flat?.18:.5})`;x.fillRect(r()*256,r()*256,s,s);}
 const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.NoColorSpace;return t;
}

export async function openScene(name,host,{onProgress=()=>{},mode='live'}={}){
 const C=SCENES[name];if(!C)throw new Error('unknown scene '+name);
 const still=mode==='still',touch=!still&&matchMedia('(pointer:coarse)').matches;
 // 高解像度の画面ではアンチエイリアスを切り、止まったら細かい解像度で1枚描き直す（動かす間は軽く、止まった画面はきれいに）
 const renderer=new THREE.WebGLRenderer({antialias:still||devicePixelRatio<1.5,powerPreference:'high-performance',preserveDrawingBuffer:still});
 const PR_MOVE=still?devicePixelRatio:Math.min(devicePixelRatio,touch?1.25:1.5);
 const PR_STILL=still?devicePixelRatio:Math.min(devicePixelRatio*(renderer.getContextAttributes().antialias?1:1.5),touch?2:2.5);
 renderer.setPixelRatio(PR_MOVE);
 setGrade(C.grade);renderer.toneMapping=THREE.CustomToneMapping;renderer.toneMappingExposure=C.exposure;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 host.prepend(renderer.domElement);
 const scene=new THREE.Scene();
 const hAt=C.hill,eye=C.cam[1],start=new THREE.Vector3(C.cam[0],eye+hAt(C.cam[0],C.cam[2]),C.cam[2]);

 // 空（太陽・雲）と山並み。周囲の反射光（環境光）も同じ空から1回だけ作る
 const skyMat=makeSky(C),sky=new THREE.Mesh(new THREE.SphereGeometry(900,48,24),skyMat);scene.add(sky);
 const mountains=makeMountains(C);scene.add(mountains);
 const pmrem=new THREE.PMREMGenerator(renderer);
 const envScene=new THREE.Scene();envScene.add(new THREE.Mesh(new THREE.SphereGeometry(900,32,16),makeSky(C,true)));
 const gAvg=new THREE.Color().setRGB(...C.ground[0],THREE.SRGBColorSpace);
 const envGround=new THREE.Mesh(new THREE.CircleGeometry(800,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:gAvg.multiplyScalar(.9)}));envGround.position.y=-2;envScene.add(envGround);
 const envTex=pmrem.fromScene(envScene,.02,1,1000).texture;scene.environment=envTex;scene.environmentIntensity=1.25;
 scene.fog=new THREE.Fog(new THREE.Color(C.hor).lerp(new THREE.Color(C.top),.12),C.fog[0],C.fog[1]);
 scene.add(new THREE.HemisphereLight(0xdfeaff,0x3a3a24,.35));
 const sun=new THREE.DirectionalLight(C.sunColor,C.sunI);sun.castShadow=true;
 const SM=touch?2048:4096;sun.shadow.mapSize.set(SM,SM);sun.shadow.bias=-0.00025;sun.shadow.normalBias=0.035;
 const focus=new THREE.Vector3(start.x,0,start.z-12);
 sun.target.position.copy(focus);sun.position.copy(focus).addScaledVector(C.sun,180);
 Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:10,far:420});scene.add(sun,sun.target);

 // 太陽の眩しさ：太陽の方向に光のにじみを1枚重ねる（加算合成。手前の木に隠れると一緒に隠れる）
 let glare=null;
 if(C.glare){const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d'),g=x.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.06,'rgba(255,250,235,.9)');g.addColorStop(.18,'rgba(255,236,200,.35)');g.addColorStop(.45,'rgba(255,220,170,.10)');g.addColorStop(1,'rgba(255,210,160,0)');
  x.fillStyle=g;x.fillRect(0,0,256,256);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  glare=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:new THREE.Color(C.sunColor).multiplyScalar(C.glare),blending:THREE.AdditiveBlending,depthWrite:false,fog:false,transparent:true}));
  glare.scale.setScalar(520);glare.renderOrder=10;scene.add(glare);}
 const cam=new THREE.PerspectiveCamera(C.fov,1,.05,1400);cam.position.copy(start);cam.lookAt(...C.look);
 const placements=plan(name,C,start,mode);

 // 地面：近く（120m四方・50cm格子）と遠く（1.4km四方）。植物の根元の陰りを頂点色に焼き込む
 const detail=detailTexture(C.flat);
 const groundMat=(rep)=>{// 地面は光沢なし（Lambert）。太陽の照り返しが、カメラについて回る明るい形になるのを防ぐ
 const m=new THREE.MeshLambertMaterial({vertexColors:true,map:detail.clone(),flatShading:!!C.flat});m.map.repeat.set(rep,rep);m.map.needsUpdate=true;return m;};
 function groundMesh(size,seg,cx,cz,ao,inner=null){
  const gg=new THREE.PlaneGeometry(size,size,seg,seg);gg.rotateX(-Math.PI/2);gg.translate(cx,0,cz);
  const pos=gg.attributes.position,col=new Float32Array(pos.count*3),t=new THREE.Color(),a=C.ground[0],b=C.ground[1];
  // 遠く用の粗い地面は、近く用の地面がある範囲では1m下げる（粗い格子の起伏が上に突き出して、境目が模様に見えるのを防ぐ）
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,hAt(x,z)-(ao?0:(inner&&Math.abs(x-inner[0])<inner[2]&&Math.abs(z-inner[1])<inner[2]?1:.02)));
   const n=fbm(x*.15+9,z*.15+3),m=fbm(x*.9,z*.9);let rgb=[0,1,2].map(k=>(a[k]+(b[k]-a[k])*n)*(.78+.4*m));
   if(C.path&&z<-1&&z>-26){const w=smooth(1.5,.6,Math.abs(x+.6*z/10-Math.sin(z*.12)*.8));rgb=rgb.map((v,k)=>v+(C.path[k]*(.85+.3*m)-v)*w);}
   if(C.sea!==undefined){const wet=smooth(C.sea+.5,C.sea-.1,hAt(x,z));rgb=rgb.map(v=>v*(1-.35*wet));}
   t.setRGB(...rgb,THREE.SRGBColorSpace);col[i*3]=t.r;col[i*3+1]=t.g;col[i*3+2]=t.b;}
  if(ao){const s=size/seg,half=size/2;
   for(const p of placements){const big=/zelkova|oak|tree|cherry|palm|cycad|l-(tree|oak|fir|pine|cherry)/.test(p.key)&&!p.key.startsWith('b-');
    const r=(big?1.1:.45)*p.s*(p.key.startsWith('l-')?.5:1),k=big?.38:.22;if(p.key.startsWith('b-'))continue;
    const i0=Math.floor((p.x-r-cx+half)/s),i1=Math.ceil((p.x+r-cx+half)/s),j0=Math.floor((p.z-r-cz+half)/s),j1=Math.ceil((p.z+r-cz+half)/s);
    for(let j=Math.max(0,j0);j<=Math.min(seg,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(seg,i1);i++){
     const vi=j*(seg+1)+i,dx=pos.getX(vi)-p.x,dz=pos.getZ(vi)-p.z,f=1-k*smooth(r,0,Math.hypot(dx,dz));col[vi*3]*=f;col[vi*3+1]*=f;col[vi*3+2]*=f;}}}
  gg.setAttribute('color',new THREE.BufferAttribute(col,3));gg.computeVertexNormals();
  const g=new THREE.Mesh(gg,groundMat(size/2.2));g.receiveShadow=true;return g;
 }
 const nearG=groundMesh(120,C.flat?120:240,start.x,start.z-10,true);scene.add(nearG);
 const farG=groundMesh(1400,280,0,0,false,[start.x,start.z-10,55]);scene.add(farG);
 // 水面：空の反射光をそのまま映す（南国の海・ローポリの池）
 if(C.sea!==undefined){const w=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x04586e,roughness:.14,metalness:0,transparent:true,opacity:.93,envMapIntensity:.55}));w.position.y=C.sea;scene.add(w);}
 if(C.pond){const w=new THREE.Mesh(new THREE.CircleGeometry(9,24).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x4f9fc4,roughness:.12,metalness:0,flatShading:true}));w.position.set(C.pond[0],C.pond[2],C.pond[1]);scene.add(w);}

 // 必要なGLBだけ読む
 const keys=[...new Set(placements.map(p=>p.key))];
 const loader=new GLTFLoader(),lib={};let done=0;onProgress(0,keys.length);
 await Promise.all(keys.map(async k=>{const g=await loader.loadAsync(BASE+k+'.glb');g.scene.updateMatrixWorld(true);
  // 遠景モデルは光の計算をしない焼き込み画像なので、彩度と明るさを落として遠くの空気の色に寄せる
  if(k.startsWith('b-'))g.scene.traverse(m=>{if(m.isMesh&&m.material?.isMeshBasicMaterial){const mt=m.material=m.material.clone();mt.color.setScalar(.62);
   mt.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.3,.59,.11)))*vec3(.92,1.,1.06),.5);');};}});
  lib[k]=g;onProgress(++done,keys.length);}));

 // 種類×16m区画ごとに InstancedMesh へまとめる（描画命令を減らし、区画単位で画面外を省く）
 const groups=new Map(),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
 // 影を落とすのは木・シダ・大きな植物だけ。草花は受けるだけにする（足もとが影で埋まらないように。影の計算も軽くなる）
 const small=k=>/-(meadow|meadowb|meadowc|grass|daisy|poppy|yarrow)$|l-(meadow|grass|daisy)$/.test(k);
 for(const p of placements){if(small(p.key))p.shadow=false;const id=p.key+'|'+Math.floor(p.x/16)+','+Math.floor(p.z/16)+'|'+p.shadow;
  if(!groups.has(id))groups.set(id,{key:p.key,shadow:p.shadow,mats:[],ps:[]});
  const g=groups.get(id);g.ps.push(p);g.mats.push(M.compose(P.set(p.x,p.y,p.z),Q.setFromAxisAngle(UP,p.rot),S.setScalar(p.s)).clone());}
 const tmp=new THREE.Matrix4();
 const heights={};for(const k of keys){const b=new THREE.Box3().setFromObject(lib[k].scene);heights[k]=Math.max(.05,b.max.y);}
 // 風：頂点を描画のついでにずらすだけ（追加の読み込み・影の再計算なし）。背の高さに応じて先ほど大きく揺れる
 const wind={uTime:{value:0},uWind:{value:still?0:1}};
 function addWind(mat){mat.userData.wind=true;const prev=mat.onBeforeCompile;
  mat.onBeforeCompile=(sh,r)=>{prev&&prev.call(mat,sh,r);sh.uniforms.uTime=wind.uTime;sh.uniforms.uWind=wind.uWind;
   sh.vertexShader='attribute vec4 aRoot;\nuniform float uTime,uWind;\n'+sh.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
#endif
float wh=clamp((mvPosition.y-aRoot.y)/max(aRoot.w,.05),0.,1.2),wph=dot(aRoot.xz,vec2(.23,.19));
float wamp=uWind*min(.05+.025*aRoot.w,.28)*mix(1.,.3,smoothstep(1.5,5.,aRoot.w))*wh*wh;
mvPosition.x+=wamp*(sin(uTime*1.7+wph)+.35*sin(uTime*3.3+wph*1.9));
mvPosition.z+=wamp*.5*sin(uTime*1.3+wph*1.3);
mvPosition=modelViewMatrix*mvPosition;
gl_Position=projectionMatrix*mvPosition;`);};
  mat.customProgramCacheKey=()=>'fab-wind';mat.needsUpdate=true;}
 for(const g of groups.values()){
  const hgt=heights[g.key],root=new Float32Array(g.ps.length*4);g.ps.forEach((p,i)=>root.set([p.x,p.y,p.z,hgt*p.s],i*4));
  const rootAttr=new THREE.InstancedBufferAttribute(root,4);
  lib[g.key].scene.traverse(m=>{if(!m.isMesh)return;
   // 形状データは共有し、株ごとの根元と高さ（風の揺れ用）だけを足す
   const geo=new THREE.BufferGeometry();for(const [n,a] of Object.entries(m.geometry.attributes))geo.setAttribute(n,a);geo.setIndex(m.geometry.index);geo.setAttribute('aRoot',rootAttr);
   if(!m.material.userData.wind&&!g.key.startsWith('b-'))addWind(m.material);
   const im=new THREE.InstancedMesh(geo,m.material,g.mats.length);
   g.mats.forEach((w,i)=>im.setMatrixAt(i,tmp.multiplyMatrices(w,m.matrixWorld)));
   im.castShadow=g.shadow;im.receiveShadow=true;im.computeBoundingSphere();scene.add(im);});
 }
 renderer.shadowMap.needsUpdate=true;

 // 操作：ドラッグで見回す、WASD・矢印・ホイール・画面のボタンで歩く
 const e=new THREE.Euler().setFromQuaternion(cam.quaternion,'YXZ');let yaw=e.y,pitch=e.x;
 const keysDown=new Set();let hold=0,dirty=true,raf=0,last=performance.now(),drag=null,stillTimer=0,windOn=!still,lastDraw=0;
 const draw=()=>{cam.quaternion.setFromEuler(e.set(pitch,yaw,0,'YXZ'));sky.position.copy(cam.position);if(glare)glare.position.copy(cam.position).addScaledVector(C.sun,860);mountains.position.set(cam.position.x,0,cam.position.z);renderer.render(scene,cam);};
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();dirty=true;kick();};
 const kick=()=>{if(!raf&&!still)raf=requestAnimationFrame(tick);};
 function tick(now){raf=0;const dt=Math.min(.05,(now-last)/1000);last=now;
  let f=hold,s=0;if(keysDown.has('KeyW')||keysDown.has('ArrowUp'))f+=1;if(keysDown.has('KeyS')||keysDown.has('ArrowDown'))f-=1;
  if(keysDown.has('KeyA'))s-=1;if(keysDown.has('KeyD'))s+=1;
  if(keysDown.has('ArrowLeft')){yaw+=1.4*dt;dirty=true;}if(keysDown.has('ArrowRight')){yaw-=1.4*dt;dirty=true;}
  if(f||s){const sp=(name==='lowpoly'?6:2.4)*dt;const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
   let x=cam.position.x+(fx*f-fz*s)*sp,z=cam.position.z+(fz*f+fx*s)*sp;
   const dx=x-start.x,dz=z-start.z,d=Math.hypot(dx,dz);if(d>C.walk){x=start.x+dx/d*C.walk;z=start.z+dz/d*C.walk;}
   cam.position.set(x,Math.max(hAt(x,z),C.sea??-99)+eye,z);dirty=true;}
  const moving=!!(f||s||keysDown.size||drag);
  if(windOn){wind.uTime.value+=dt;if(moving||now-lastDraw>32)dirty=true;}
  if(dirty){if(renderer.getPixelRatio()!==PR_MOVE)renderer.setPixelRatio(PR_MOVE);draw();dirty=false;lastDraw=now;
   clearTimeout(stillTimer);if(!windOn)stillTimer=setTimeout(()=>{if(raf||drag)return;renderer.setPixelRatio(PR_STILL);draw();},220);}
  if(moving||windOn)kick();}
 const el=renderer.domElement;el.style.touchAction='none';
 el.addEventListener('pointerdown',ev=>{drag={x:ev.clientX,y:ev.clientY};el.setPointerCapture(ev.pointerId);});
 el.addEventListener('pointermove',ev=>{if(!drag)return;const k=touch?.005:.0035;yaw+=(ev.clientX-drag.x)*k;pitch=Math.max(-1.1,Math.min(1.1,pitch+(ev.clientY-drag.y)*k));drag={x:ev.clientX,y:ev.clientY};dirty=true;kick();});
 const up=()=>{drag=null;};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
 el.addEventListener('wheel',ev=>{ev.preventDefault();hold=ev.deltaY<0?1:-1;kick();clearTimeout(el._w);el._w=setTimeout(()=>{hold=0;},120);},{passive:false});
 const kd=ev=>{if(/^(Key[WASD]|Arrow)/.test(ev.code)){keysDown.add(ev.code);ev.preventDefault();kick();}};
 const ku=ev=>{keysDown.delete(ev.code);};
 if(!still){addEventListener('keydown',kd);addEventListener('keyup',ku);}
 const ro=new ResizeObserver(resize);ro.observe(host);
 {const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();}
 draw();kick();
 return {
  info(){return {...renderer.info.render,pr:renderer.getPixelRatio(),files:keys.length};},
  setHold(v){hold=v;kick();},
  setWind(v){windOn=!!v;wind.uWind.value=windOn?1:0;dirty=true;kick();return windOn;},
  get wind(){return windOn;},
  reset(){cam.position.copy(start);const r=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(start,new THREE.Vector3(...C.look),UP)),'YXZ');yaw=r.y;pitch=r.x;dirty=true;kick();},
  dispose(){cancelAnimationFrame(raf);clearTimeout(stillTimer);ro.disconnect();removeEventListener('keydown',kd);removeEventListener('keyup',ku);
   scene.traverse(o=>{if(o.isMesh){o.geometry?.dispose();if(o.isInstancedMesh)o.dispose();else if(!lib[o.name])[].concat(o.material).forEach(m=>{m.map?.dispose();m.dispose();});}});
   for(const g of Object.values(lib))g.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material)){for(const v of Object.values(m))if(v&&v.isTexture)v.dispose();m.dispose();}}});
   detail.dispose();envTex.dispose();pmrem.dispose();renderer.dispose();renderer.forceContextLoss();el.remove();}
 };
}
