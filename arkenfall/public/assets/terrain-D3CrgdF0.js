import{A as e,An as t,B as n,C as r,Dn as i,F as a,G as o,I as s,In as c,Kn as l,Lt as u,R as d,Rt as f,U as p,V as m,W as h,X as g,_t as _,b as v,er as y,ft as b,g as x,ht as S,i as C,jt as w,k as T,lt as E,m as D,nr as O,nt as k,o as A,p as j,q as ee,rt as te,s as M,tr as N,ut as P,xn as ne,yn as re}from"./three.core-_y2F91K_.js";import{t as F}from"./contracts-CvM_HOZo.js";import{i as ie,n as ae,r as I,t as L}from"./cache-DIhMlTLC.js";import{B as R,m as z,n as B,z as oe}from"./Game-BmRmdldn.js";import{n as V,t as se}from"./BufferGeometryUtils-B9y1tCRt.js";import{t as ce}from"./rng-R5614gXl.js";import{t as H}from"./noise-mHFAXQOi.js";import{_ as le,a as ue,c as U,d as W,f as de,g as fe,h as pe,i as me,l as he,m as ge,n as _e,o as ve,p as ye,r as be,s as G,u as xe,v as Se}from"./swell-CGYFQCs6.js";function Ce(e,t){let n=new Float32Array(t*t);for(let t=0;t<n.length;t++)n[t]=e.next();return n}function we(e,t,n,r){let i=n*t,a=r*t,o=Math.floor(i),s=Math.floor(a),c=i-o,l=a-s,u=c*c*c*(c*(c*6-15)+10),d=l*l*l*(l*(l*6-15)+10),f=(o%t+t)%t,p=(s%t+t)%t,m=(f+1)%t,h=(p+1)%t,g=e[p*t+f],_=e[p*t+m],v=e[h*t+f],y=e[h*t+m];return g+(_-g)*u+(v-g)*d+(g-_-v+y)*u*d}function Te(e){let t=new ce(`terrain-detail-noise`),n=[4,8,16,32,64,128].map(e=>({n:e,lat:Ce(t,e)})),r=new Float32Array(256),i=new Float32Array(256);for(let e=0;e<256;e++)r[e]=t.next(),i[e]=t.next();let a=new Uint8Array(e*e*4);for(let t=0;t<e;t++)for(let o=0;o<e;o++){let s=o/e,c=t/e,l=0,u=.5,d=0;for(let e=0;e<5;e++)l+=we(n[e].lat,n[e].n,s,c)*u,d+=u,u*=.5;l/=d;let f=0;u=.5,d=0;for(let e=1;e<5;e++){let t=1-Math.abs(we(n[e].lat,n[e].n,s+.37,c+.71)*2-1);f+=t*t*u,d+=u,u*=.55}f/=d;let p=0;u=.5,d=0;for(let e=3;e<6;e++)p+=we(n[e].lat,n[e].n,s+.13,c+.29)*u,d+=u,u*=.5;p/=d;let m=s*16,h=c*16,g=Math.floor(m),_=Math.floor(h),v=9;for(let e=-1;e<=1;e++)for(let t=-1;t<=1;t++){let n=g+t,a=_+e,o=(n%16+16)%16,s=(a%16+16)%16,c=n+r[s*16+o],l=a+i[s*16+o],u=Math.hypot(m-c,h-l);u<v&&(v=u)}let y=1-Math.min(1,v*1.1),b=(t*e+o)*4;a[b]=Math.round(Math.min(1,Math.max(0,(l-.5)*1.6+.5))*255),a[b+1]=Math.round(y*255),a[b+2]=Math.round(Math.min(1,f*1.15)*255),a[b+3]=Math.round(Math.min(1,Math.max(0,(p-.5)*1.8+.5))*255)}return a}var Ee=`r4.4`,De=e=>Math.max(24,Math.ceil(U/Math.max(1,e*3)));function Oe(){let e=U*U;return{heights:new Float32Array(e),normal:new Uint8Array(e*4),splatA:new Uint8Array(e*4),splatB:new Uint8Array(e*4),extra:new Uint8Array(e*4),surface:new Uint8Array(e),wLevel:new Float32Array(e),wBody:new Uint8Array(e),flow:new Float32Array(e*2),precarve:new Float32Array(e),half:new Uint16Array(e)}}function ke(e,t){let n=t.j0*U;e.heights.set(t.heights,n),e.wLevel.set(t.wLevel,n),e.wBody.set(t.wBody,n),e.flow.set(t.flow,n*2),e.precarve.set(t.precarve,n)}function Ae(e,t){let n=t.j0*U;e.normal.set(t.normal,n*4),e.splatA.set(t.splatA,n*4),e.splatB.set(t.splatB,n*4),e.extra.set(t.extra,n*4),e.surface.set(t.surface,n),e.half.set(t.half,n)}function je(e,t,n){let r=Math.max(0,t-10),i=Math.min(U,n+10);return{r0:r,H:e.slice(r*U,i*U)}}function Me(e){let t=ge(),n=Oe(),r=0,i=[];for(let e=0;e<U;e+=128)i.push([e,Math.min(U,e+128)]);for(let[e,a]of i){let i=ye(t,e,a);r+=i.ms,ke(n,i)}pe(n.heights,n.wLevel,n.wBody);for(let[e,a]of i){let{r0:i,H:o}=je(n.heights,e,a),s=W(t,e,a,o,i);r+=s.ms,Ae(n,s)}return le(),{...n,noise:Te(256),wave:ue(256),prep:t,stats:{ms:performance.now()-e,workers:0,bands:i.length,workerMs:r}}}async function Ne(){let e=performance.now(),t=typeof navigator<`u`&&navigator.hardwareConcurrency||4,n=Math.max(1,Math.min(8,t-1,Math.ceil(t/2))),r=[];try{for(let e=0;e<n;e++)r.push(new Worker(new URL(new URL(`worker-lUMeUMxx.js`,import.meta.url).href,``+import.meta.url),{type:`module`}))}catch(t){console.warn(`[terrain] workers unavailable, generating on the main thread`,t);for(let e of r)e.terminate();return Me(e)}let i;try{i=ge();for(let e of r)e.postMessage({kind:`prep`,prep:i})}catch(e){for(let e of r)e.terminate();throw e}let a=Oe(),o=[],s=De(n);for(let e=0;e<U;e+=s)o.push([e,Math.min(U,e+s)]);let c=null,l=null,u=0;try{let e=new Map;await new Promise((t,n)=>{let i=[{kind:`noise`,size:256},{kind:`wave`,size:256},...o.map(([e,t])=>({kind:`heights`,j0:e,j1:t}))],s=0,d=0,f=t=>{if(s>=i.length)return;let n=i[s++];n.kind===`heights`&&e.set(n.j0,t),t.postMessage(n)};for(let e of r)e.onmessage=r=>{let o=r.data;if(o.kind===`error`){n(Error(o.message));return}if(o.kind===`noise`)c=o.data;else if(o.kind===`wave`)l=o.data;else{let e=o.block;ke(a,e),u+=e.ms}++d===i.length?t():f(e)},e.onerror=e=>n(Error(`terrain worker failed: ${e.message}`)),f(e),f(e)}),pe(a.heights,a.wLevel,a.wBody),await new Promise((t,n)=>{let i=0;for(let e of r)e.onmessage=e=>{let r=e.data;if(r.kind===`error`){n(Error(r.message));return}let s=r.block;Ae(a,s),u+=s.ms,++i===o.length&&t()};for(let[t,n]of o){let{r0:r,H:i}=je(a.heights,t,n);e.get(t).postMessage({kind:`classify`,j0:t,j1:n,r0:r,H:i},[i.buffer])}})}catch(t){console.warn(`[terrain] worker generation failed, falling back to the main thread`,t);for(let e of r)e.terminate();return Me(e)}for(let e of r)e.terminate();return{...a,noise:c??Te(256),wave:l??ue(256),prep:i,stats:{ms:performance.now()-e,workers:n,bands:o.length,workerMs:u}}}function Pe(){let e=R,t=JSON.stringify([e.WORLD_SIZE,e.HEIGHT_POINTS,e.HILLINESS,e.CLIFF,e.SPIRE_PEAK,e.MOUNTAINS,e.COAST,e.LAKE,e.FEN,e.RIVERS,e.CAVE,e.GORGE,e.FLAT_PADS,e.ROADS,e.REGIONS]),n=2166136261;for(let e=0;e<t.length;e++)n^=t.charCodeAt(e),n=Math.imul(n,16777619);return(n>>>0).toString(36)}function K(e,t){let n=1/0,r=-1/0;for(let t=0;t<e.length;t++){let i=e[t];i<n&&(n=i),i>r&&(r=i)}r>=n||(n=0,r=1);let i=t?65534:65535,a=+!!t,o=Math.max(1e-6,(r-n)/i),s=new Uint16Array(e.length);for(let t=0;t<e.length;t++){let r=e[t];s[t]=r===r?a+Math.round((r-n)/o):0}return{q:s,lo:n,step:o}}function Fe(e,t){let n=new Float32Array(e.q.length),r=+!!t;for(let i=0;i<n.length;i++){let a=e.q[i];n[i]=t&&a===0?NaN:e.lo+(a-r)*e.step}return n}function Ie(e){let t=e.cave.curve,n=1/0,r=-1/0,i=1/0,a=-1/0;for(let e=0;e<t.n;e++)n=Math.min(n,t.x[e]),r=Math.max(r,t.x[e]),i=Math.min(i,t.z[e]),a=Math.max(a,t.z[e]);let o=Math.max(0,Math.floor((n-70+G)/2)),s=Math.max(0,Math.floor((i-70+G)/2)),c=Math.min(U-1,Math.ceil((r+70+G)/2)),l=Math.min(U-1,Math.ceil((a+70+G)/2));return{i0:o,j0:s,nx:c-o+1,nz:l-s+1}}function Le(e,t,n){let r=[],i=[];for(let t=0;t<U*U;t++){let n=e.flow[t*2],a=e.flow[t*2+1];(n!==0||a!==0)&&(r.push(t),i.push(Math.round(n*1e3),Math.round(a*1e3)))}let a=Ie(e.prep),o=new Float32Array(a.nx*a.nz);for(let t=0;t<a.nz;t++)o.set(e.precarve.subarray((a.j0+t)*U+a.i0,(a.j0+t)*U+a.i0+a.nx),t*a.nx);return{atlas:K(n.atlas,!1),atlasW:n.atlasW,atlasH:n.atlasH,offsets:n.offsets,normal:e.normal,splatA:e.splatA,splatB:e.splatB,extra:t,surface:e.surface,wBody:e.wBody,wLevel:K(e.wLevel,!0),flowIdx:Uint32Array.from(r),flowQ:Int16Array.from(i),carve:{...a,data:o},half:e.half,noise:e.noise,wave:e.wave,prep:e.prep}}function Re(e){let t=Fe(e.atlas,!1),n=new Float32Array(U*U);for(let r=0;r<U;r++)n.set(t.subarray(r*e.atlasW,r*e.atlasW+U),r*U);let r=new Float32Array(U*U*2);for(let t=0;t<e.flowIdx.length;t++){let n=e.flowIdx[t];r[n*2]=e.flowQ[t*2]/1e3,r[n*2+1]=e.flowQ[t*2+1]/1e3}let i=n.slice(),a=e.carve;for(let e=0;e<a.nz;e++)i.set(a.data.subarray(e*a.nx,(e+1)*a.nx),(a.j0+e)*U+a.i0);return{grids:{heights:n,normal:e.normal,splatA:e.splatA,splatB:e.splatB,extra:e.extra,surface:e.surface,wLevel:Fe(e.wLevel,!0),wBody:e.wBody,flow:r,precarve:i,half:e.half},derived:{atlas:t,atlasW:e.atlasW,atlasH:e.atlasH,offsets:e.offsets}}}var ze=()=>I(`terrain`,`${Ee}-${Pe()}`),Be=e=>I(`hollow`,`${Ee}-${e}-${Pe()}`);async function Ve(e){let t=performance.now(),[n,r]=await Promise.all([ae(ze()),ae(Be(e))]);if(n&&n.atlas?.q?.length&&n.half?.length===U*U&&n.prep&&n.wave?.length){let{grids:e,derived:i}=Re(n);return{data:{...e,noise:n.noise,wave:n.wave,prep:fe(n.prep),stats:{ms:performance.now()-t,workers:0,bands:0,workerMs:0,cached:!0}},derived:i,hollow:r??null}}return{data:await Ne(),derived:null,hollow:null}}function He(e,t){if(e.stats.cached||!L)return;let n=e.extra.slice();setTimeout(()=>{ie(ze(),Le(e,n,t))},0)}function Ue(e,t){L&&setTimeout(()=>{ie(Be(e),t)},0)}var We=32,Ge=1400;function Ke(e,t){let n=U+(U>>1)+1,r=U,i=new Float32Array(n*r),a=[],o=e=>{if(e===0)return[0,0];if(e===1)return[U,0];if(e===2)return[U,(U>>1)+1];let t=U+(U>>2)+1,n=(U>>1)+1;for(let t=3;t<e;t++)n+=(1024>>t)+1;return[t,n]},s=e,c=U;for(let r=0;r<7;r++){let l=(1024>>r)+1,u;if(r===0)u=e;else{u=new Float32Array(l*l);let n=[.25,.5,.25],i=1<<r;for(let r=0;r<l;r++)for(let a=0;a<l;a++){let o=0;for(let e=-1;e<=1;e++){let t=Math.min(c-1,Math.max(0,r*2+e));for(let r=-1;r<=1;r++){let i=Math.min(c-1,Math.max(0,a*2+r));o+=s[t*c+i]*n[r+1]*n[e+1]}}let d=t[r*i*U+a*i];!Number.isNaN(d)&&d>e[r*i*U+a*i]+.05&&(o=Math.min(o,d-.3)),u[r*l+a]=o}}let[d,f]=o(r);for(let e=0;e<l;e++)i.set(u.subarray(e*l,e*l+l),(f+e)*n+d);a.push(d,f),s=u,c=l}return{data:i,width:n,height:r,offsets:a}}var qe=class{max;data;count=0;constructor(e){this.max=e,this.data=new Float32Array(e*4)}push(e,t,n,r){if(this.count>=this.max)return;let i=this.count++*4;this.data[i]=e,this.data[i+1]=t,this.data[i+2]=n,this.data[i+3]=r}},Je=700,Ye=class{geometry;nodeAttr;morph=[];ranges=[];minH=[];maxH=[];frustum=new d;projView=new E;box=new C;list=new qe(Ge);order=new Uint16Array(Ge);dist=new Float32Array(Ge);cam=new N;lx=new N;ly=new N;lz=new N;casters=[];shadowLists=[];count=0;clip=null;constructor(e,t=250){this.geometry=Xe(),this.nodeAttr=new h(new Float32Array(Ge*4),4),this.nodeAttr.setUsage(T),this.geometry.setAttribute(`aNode`,this.nodeAttr),this.geometry.instanceCount=0,this.geometry.boundingSphere=new c(new N(0,60,0),G*1.6),this.geometry.boundingBox=new C(new N(-G,-20,-G),new N(G,320,G));for(let e=0;e<7;e++)this.ranges.push(0),this.morph.push(new y(1e7,1e7+1));this.setRange0(t);let n=G*2/We,r=new Float32Array(n*n),i=new Float32Array(n*n),a=We/2;for(let t=0;t<n;t++)for(let o=0;o<n;o++){let s=1/0,c=-1/0;for(let n=t*a;n<=(t+1)*a;n++)for(let t=o*a;t<=(o+1)*a;t++){let r=e[Math.min(U-1,n)*U+Math.min(U-1,t)];r<s&&(s=r),r>c&&(c=r)}r[t*n+o]=s-7,i[t*n+o]=c+.5}this.minH.push(r),this.maxH.push(i);for(let e=1;e<7;e++){let t=n>>e-1,r=t>>1,i=this.minH[e-1],a=this.maxH[e-1],o=new Float32Array(r*r),s=new Float32Array(r*r);for(let e=0;e<r;e++)for(let n=0;n<r;n++){let c=e*2*t+n*2;o[e*r+n]=Math.min(i[c],i[c+1],i[c+t],i[c+t+1]),s[e*r+n]=Math.max(a[c],a[c+1],a[c+t],a[c+t+1])}this.minH.push(o),this.maxH.push(s)}}setRange0(e){for(let t=0;t<7;t++){let n=e*2**t;this.ranges[t]=n,t<6&&this.morph[t].set(n*.8,n)}}update(e,t=0){this.cam.setFromMatrixPosition(e.matrixWorld),this.projView.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this.frustum.setFromProjectionMatrix(this.projView);let n=this.list;n.count=0,this.visit(6,0,0,t);let r=n.count,i=n.data,a=this.order,o=this.dist;for(let e=0;e<r;e++){let t=i[e*4+2],n=i[e*4]+t*.5,r=i[e*4+1]+t*.5,s=(n-this.cam.x)**2+(r-this.cam.z)**2,c=e;for(;c>0&&o[c-1]>s;)o[c]=o[c-1],a[c]=a[c-1],c--;o[c]=s,a[c]=e}let s=this.nodeAttr.array;for(let e=0;e<r;e++){let t=a[e]*4;s[e*4]=i[t],s[e*4+1]=i[t+1],s[e*4+2]=i[t+2],s[e*4+3]=i[t+3]}this.count=r,this.geometry.instanceCount=r,this.nodeAttr.clearUpdateRanges(),this.nodeAttr.addUpdateRange(0,r*4),this.nodeAttr.needsUpdate=!0}visit(e,t,n,r){let i=We<<e,a=G*2/i,o=-G+t*i,s=-G+n*i,c=this.clip;if(c&&(o>c[2]||s>c[3]||o+i<c[0]||s+i<c[1]))return;let l=this.minH[e][n*a+t],u=this.maxH[e][n*a+t];this.box.min.set(o,l,s),this.box.max.set(o+i,u,s+i);let d=this.box.distanceToPoint(this.cam);if(!(d>r&&!this.frustum.intersectsBox(this.box))){if(e>0&&d<this.ranges[e-1]){this.visit(e-1,t*2,n*2,r),this.visit(e-1,t*2+1,n*2,r),this.visit(e-1,t*2,n*2+1,r),this.visit(e-1,t*2+1,n*2+1,r);return}this.list.push(o,s,i,e)}}createShadowGeometry(){let e=new o;e.setIndex(this.geometry.index),e.setAttribute(`position`,this.geometry.getAttribute(`position`));let t=new h(new Float32Array(Je*4),4);return t.setUsage(T),e.setAttribute(`aNode`,t),e.instanceCount=0,e.boundingSphere=this.geometry.boundingSphere.clone(),e.boundingBox=this.geometry.boundingBox.clone(),this.shadowLists.push(new qe(Je)),e}selectShadow(e,t,n,r,i){this.casters=e,this.lx.copy(t),this.ly.copy(n),this.lz.copy(r);for(let e=0;e<i.length;e++)this.shadowLists[e].count=0;this.visitShadow(6,0,0,i.length);for(let e=0;e<i.length;e++){let t=this.shadowLists[e],n=i[e],r=n.getAttribute(`aNode`);r.array.set(t.data.subarray(0,t.count*4)),r.clearUpdateRanges(),r.addUpdateRange(0,t.count*4),r.needsUpdate=!0,n.userData.casters=t.count}}casterMask(e,t,n,r,i,a){let o=r*.5,s=(i-t)*.5,c=e+o,l=(t+i)*.5,u=n+o,d=this.lx,f=this.ly,p=this.lz,m=c*d.x+l*d.y+u*d.z,h=c*f.x+l*f.y+u*f.z,g=c*p.x+l*p.y+u*p.z,_=o*Math.abs(p.x)+s*Math.abs(p.y)+o*Math.abs(p.z),v=0;for(let e=0;e<a;e++){let t=this.casters[e];if(!t||g+_<t.minZ)continue;let n=!0;for(let e=0;e<t.n&&n;e++){let r=t.nx[e],i=t.ny[e],a=r*d.x+i*f.x,c=r*d.y+i*f.y,l=r*d.z+i*f.z,u=o*Math.abs(a)+s*Math.abs(c)+o*Math.abs(l);r*m+i*h-u>t.c[e]&&(n=!1)}n&&(v|=1<<e)}return v}visitShadow(e,t,n,r){let i=We<<e,a=G*2/i,o=-G+t*i,s=-G+n*i,c=this.clip;if(c&&(o>c[2]||s>c[3]||o+i<c[0]||s+i<c[1]))return;let l=this.minH[e][n*a+t],u=this.maxH[e][n*a+t],d=this.casterMask(o,l,s,i,u,r);if(!d)return;this.box.min.set(o,l,s),this.box.max.set(o+i,u,s+i);let f=this.box.distanceToPoint(this.cam);if(e>0&&f<this.ranges[e-1]){this.visitShadow(e-1,t*2,n*2,r),this.visitShadow(e-1,t*2+1,n*2,r),this.visitShadow(e-1,t*2,n*2+1,r),this.visitShadow(e-1,t*2+1,n*2+1,r);return}for(let t=0;t<r;t++)d&1<<t&&this.shadowLists[t].push(o,s,i,e)}get triangles(){return this.count*16*16*2}get shadowTriangles(){return this.shadowLists.map(e=>e.count*16*16*2)}};function Xe(){let e=[];for(let t=0;t<17;t++)for(let n=0;n<17;n++)e.push(n,0,t);let t=[];for(let e=0;e<16;e++)for(let n=0;n<16;n++){let r=e*17+n,i=r+1,a=r+17,o=a+1;t.push(r,a,o,r,o,i)}let n=(e,t)=>t*17+e,r=[[],[],[],[]];for(let e=0;e<17;e++)r[0].push(n(e,0)),r[1].push(n(16,e)),r[2].push(n(16-e,16)),r[3].push(n(0,16-e));for(let n of r){let r=e.length/3;for(let t of n)e.push(e[t*3],-1,e[t*3+2]);for(let e=0;e<n.length-1;e++){let i=n[e],a=n[e+1],o=r+e,s=r+e+1;t.push(i,o,a,a,o,s)}}let i=new o;return i.setAttribute(`position`,new a(e,3)),i.setIndex(t),i}var Ze=.1,Qe=3,$e=.045,et=Array.from({length:4},()=>new N),tt=new N,nt=new N,rt=class{lod;light;meshes=[];geos=[];volumes;lx=new N;ly=new N;lz=new N;splits;pu=new Float64Array(8);pv=new Float64Array(8);idx=new Uint8Array(8);hull=new Uint8Array(17);static supported(e){let t=e?.shadow;return!!t&&typeof t.getCamera==`function`&&typeof t._viewportCount==`number`&&t._viewportCount>1}constructor(e,t,n,r){this.lod=e,this.light=r;let i=r.shadow,a=i._viewportCount??2;this.volumes=Array.from({length:a},()=>({n:0,nx:new Float64Array(8),ny:new Float64Array(8),c:new Float64Array(8),minZ:0})),this.splits=new Float64Array(a+1);for(let r=0;r<a;r++){let a=e.createShadowGeometry(),o=new P(a,t);o.name=`terrain-shadow-${r}`,o.frustumCulled=!1,o.castShadow=!0,o.receiveShadow=!1,o.customDepthMaterial=n,o.onBeforeShadow=(e,t,n,o,s)=>{s.instanceCount=o===i.getCamera(r)?a.userData.casters??0:0},o.onBeforeRender=(e,t,n,r)=>{r.instanceCount=0},this.geos.push(a),this.meshes.push(o)}}update(e,t){let n=this.light.shadow;if(!this.light.castShadow){for(let e of this.geos)e.userData.casters=0;return}let r=this.lz.copy(t).normalize();nt.set(0,1,0),Math.abs(nt.dot(r))>.99&&nt.set(0,0,1);let i=this.lx.crossVectors(nt,r).normalize(),a=this.ly.crossVectors(r,i),o=e.near,s=Math.max(o+1e-6,Math.min(n.camera.far,e.far)),c=this.volumes.length,l=this.splits;l[0]=o;for(let e=1;e<c;e++){let t=e/c;l[e]=(o+(s-o)*t+o*(s/o)**+t)*.5}l[c]=s;for(let t=0;t<4;t++)et[t].set(t===0||t===1?1:-1,t===0||t===3?1:-1,-1).applyMatrix4(e.projectionMatrixInverse);let u=o;for(let t=0;t<c;t++){let n=t===0?o:u,s=l[t+1];u=s-Ze*(s-l[t]);let c=this.volumes[t],d=1/0;for(let t=0;t<8;t++)tt.copy(et[t>>1]).multiplyScalar((t&1?s:n)/o).applyMatrix4(e.matrixWorld),this.pu[t]=tt.dot(i),this.pv[t]=tt.dot(a),d=Math.min(d,tt.dot(r));let f=0,p=0,m=0;for(let e=0;e<8;e++)f+=this.pu[e]*.125,p+=this.pv[e]*.125;for(let e=0;e<8;e++)m=Math.max(m,(this.pu[e]-f)**2+(this.pv[e]-p)**2);let h=Qe+$e*Math.sqrt(m);c.minZ=d-h,this.footprint(c,h)}this.lod.selectShadow(this.volumes,i,a,r,this.geos)}footprint(e,t){let n=this.pu,r=this.pv,i=this.idx,a=this.hull;for(let e=0;e<8;e++){let t=e;for(;t>0&&(n[i[t-1]]>n[e]||n[i[t-1]]===n[e]&&r[i[t-1]]>r[e]);)i[t]=i[t-1],t--;i[t]=e}let o=0;for(let e=0;e<8;e++){for(;o>=2&&it(n,r,a[o-2],a[o-1],i[e])<=0;)o--;a[o++]=i[e]}for(let e=6,t=o+1;e>=0;e--){for(;o>=t&&it(n,r,a[o-2],a[o-1],i[e])<=0;)o--;a[o++]=i[e]}let s=0;for(let i=0;i<o-1&&s<8;i++){let o=a[i],c=a[i+1],l=n[c]-n[o],u=r[c]-r[o],d=Math.hypot(l,u);if(d<1e-4)continue;let f=u/d,p=-l/d;e.nx[s]=f,e.ny[s]=p,e.c[s]=f*n[o]+p*r[o]+t,s++}e.n=s}get triangles(){return this.lod.shadowTriangles}};function it(e,t,n,r,i){return(e[r]-e[n])*(t[i]-t[n])-(t[r]-t[n])*(e[i]-e[n])}var q=e=>new D(e),J={cGrass:q(6788664),cGrassLush:q(5603631),cGrassDry:q(10263118),cMeadow:q(8364874),cGoldField:q(11121230),cMossHollow:q(4151852),cTurf:q(4021794),cTurfBlade:q(6059568),cFlowerA:q(15321164),cFlowerB:q(13124410),cFlowerC:q(15657693),cFlowerD:q(6126544),cForest:q(4866608),cForest2:q(5986868),cDirt:q(8019262),cGravel:q(12168599),cPath:q(11111782),cPathEdge:q(9075282),cSand:q(14470306),cSandWet:q(11048826),cMud:q(4866352),cFenMoss:q(5595194),cChalk:q(15524815),cChalk2:q(14208178),cChalkWarm:q(15127214),cChalkGrey:q(9868170),cFlint:q(5920338),cGranite:q(8357520),cGranite2:q(6581370),cLichen:q(10724438),cSnow:q(15988218),cCave:q(4866877),cCave2:q(3091500),cGlow:q(6285526)},at=`
void caveIndirect( inout ReflectedLight rl, vec3 albedo, float k ) {
	float keep = mix( 0.1, 0.6, uCave );
	vec3 tint = mix( vec3( 0.9, 0.93, 1.1 ), vec3( 0.95, 0.88, 1.28 ), uCave );
	rl.indirectDiffuse *= mix( vec3( 1.0 ), tint * keep, k );
	rl.indirectDiffuse = max( rl.indirectDiffuse, albedo * vec3( 0.055, 0.06, 0.13 ) * k * mix( 0.25, 1.0, uCave ) );
	rl.indirectSpecular *= mix( 1.0, keep * 0.5, k );
}
`,ot=new y(30,56);function st(e,t){let n={tHeight:{value:e.height},tNormal:{value:e.normal},tSplatA:{value:e.splatA},tSplatB:{value:e.splatB},tExtra:{value:e.extra},tNoise:{value:e.noise},uLodCam:{value:new N},uMorph:{value:t??[new y(1e7,1e7+1)]},uLevelOff:{value:e.levelOffsets},uTime:B.uTime,uNight:B.uNight,uRain:B.uRain,uSnowLine:{value:150},uCave:B.uCave,uGrassRing:{value:ot},uHaze:{value:new O(0,0,0,0)},uRockScale:{value:1},uSnowSlope:{value:new y(.62,.84)},uSnowBand:{value:new y(-5,9)}};for(let[e,t]of Object.entries(J))n[e]={value:t};return n}var ct=`
attribute vec4 aNode;
uniform sampler2D tNormal;
uniform vec3 uLodCam;
uniform vec2 uMorph[ 7 ];

uniform sampler2D tHeight;
uniform vec2 uLevelOff[ 7 ];
float terrainHeightL( vec2 wxz, int level ) {
	float cells = float( 1 << level );
	float last = 1024.0 / cells;
	vec2 g = clamp( ( wxz + 1024.0 ) / ( 2.0 * cells ), vec2( 0.0 ), vec2( last - 0.001 ) );
	vec2 f = floor( g );
	vec2 t = g - f;
	ivec2 c = ivec2( f ) + ivec2( uLevelOff[ level ] );
	float h00 = texelFetch( tHeight, c, 0 ).r;
	float h10 = texelFetch( tHeight, c + ivec2( 1, 0 ), 0 ).r;
	float h01 = texelFetch( tHeight, c + ivec2( 0, 1 ), 0 ).r;
	float h11 = texelFetch( tHeight, c + ivec2( 1, 1 ), 0 ).r;
	return t.x > t.y ? h00 + ( h10 - h00 ) * t.x + ( h11 - h10 ) * t.y : h00 + ( h11 - h01 ) * t.x + ( h01 - h00 ) * t.y;
}

vec3 terrainNormalAt( vec2 wxz ) {
	vec2 uv = ( ( wxz + 1024.0 ) * 0.5 + 0.5 ) / 1025.0;
	vec2 e = texture( tNormal, uv ).xy * 2.0 - 1.0;
	vec2 n = sign( e ) * e * e;
	return vec3( n.x, sqrt( max( 0.0, 1.0 - dot( n, n ) ) ), n.y );
}
vec3 terrainVertex( out vec3 nrm ) {
	vec2 grid = position.xz;
	float spacing = aNode.z / ${16 .toFixed(1)};
	vec2 wxz = aNode.xy + grid * spacing;
	int lv = int( aNode.w + 0.5 );
	float h0 = terrainHeightL( wxz, lv );
	vec2 mr = uMorph[ lv ];
	float mk = clamp( ( distance( uLodCam, vec3( wxz.x, h0, wxz.y ) ) - mr.x ) / ( mr.y - mr.x ), 0.0, 1.0 );
	grid -= fract( grid * 0.5 ) * 2.0 * mk;
	wxz = aNode.xy + grid * spacing;
	// morph the height toward the next level's filtered grid together with the position, so a fully
	// morphed edge matches its coarser neighbour exactly
	float h = mix( terrainHeightL( wxz, lv ), terrainHeightL( wxz, min( lv + 1, 6 ) ), mk );
	nrm = terrainNormalAt( wxz );
	// skirt vertices (position.y = -1) hang below the edge to hide any sub-pixel seams
	return vec3( wxz.x, h + position.y * ( 1.5 + spacing * 0.5 ), wxz.y );
}
`,lt=`
uniform sampler2D tNormal;
uniform sampler2D tSplatA;
uniform sampler2D tSplatB;
uniform sampler2D tExtra;
uniform sampler2D tNoise;
uniform float uTime;
uniform float uNight;
uniform float uRain;
uniform float uSnowLine;
uniform float uCave;
uniform vec2 uGrassRing;
uniform vec4 uHaze;
uniform float uRockScale;
uniform vec2 uSnowSlope;
uniform vec2 uSnowBand;
${at}
uniform vec3 cGoldField, cMossHollow, cTurf, cTurfBlade;
uniform vec3 cGrass, cGrassLush, cGrassDry, cMeadow, cFlowerA, cFlowerB, cFlowerC, cFlowerD, cForest, cForest2;
uniform vec3 cDirt, cGravel, cPath, cPathEdge, cSand, cSandWet, cMud, cFenMoss;
uniform vec3 cChalk, cChalk2, cChalkWarm, cChalkGrey, cFlint, cGranite, cGranite2, cLichen, cSnow, cCave, cCave2, cGlow;
varying vec3 vTerrainPos;
#ifdef TERRAIN_MESH
	varying vec4 vSplatA;
	varying vec4 vSplatB;
	varying vec4 vTer;
	varying vec3 vWorldNrm;
#endif
// height-blend: noise breaks up the transition band but never leaks into pure 0 / 1 weights
float tSharp( float w, float n, float c ) {
	return smoothstep( 0.5 - c, 0.5 + c, w + ( n - 0.5 ) * 1.6 * w * ( 1.0 - w ) );
}
float tHash( float n ) { return fract( sin( n * 12.9898 ) * 43758.5453 ); }
// the vegetation's flower hash (grassHash22().x), so terrain and grass agree on each drift's species
float tFlowerHash( vec2 p ) {
	vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
	p3 += dot( p3, p3.yzx + 33.33 );
	return fract( ( p3.x + p3.y ) * p3.z );
}
vec2 tHash2( vec2 p ) { return fract( sin( vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) ) ) * 43758.5453 ); }
// River-bed and scree stones: one stone per jittered cell, each with its own size, elongation and
// orientation (hashed, so nothing tiles). x = coverage (1 inside a stone), y = stone id, z = dome.
vec3 tStones( vec2 p ) {
	vec2 ip = floor( p ), fp = p - ip;
	float best = 9.0, id = 0.0;
	for ( int j = -1; j <= 1; j++ ) for ( int i = -1; i <= 1; i++ ) {
		vec2 c = vec2( float( i ), float( j ) );
		vec2 h = tHash2( ip + c );
		float h3 = fract( h.x * 13.7 + h.y * 7.1 );
		vec2 o = c + 0.15 + 0.7 * h - fp;
		float a = h3 * 3.1416, ca = cos( a ), sa = sin( a );
		o = vec2( ca * o.x + sa * o.y, ca * o.y - sa * o.x );
		float r = 0.28 + 0.34 * h.y * h.y;
		float e = length( o / vec2( r, r * ( 0.5 + 0.45 * h.x ) ) );
		if ( e < best ) { best = e; id = h3; }
	}
	return vec3( 1.0 - smoothstep( 0.72, 1.0, best ), id, sqrt( max( 0.0, 1.0 - best * best ) ) );
}
// Raindrop rings on a puddle: each ~0.5 m cell holds one drop that lands at its own moment; the ring
// runs outward and fades. Two offset layers. Returns the ring's slope (xz) for the normal.
vec2 tRainRings( vec2 p, float t ) {
	vec2 n = vec2( 0.0 );
	for ( int l = 0; l < 2; l++ ) {
		vec2 q = p / 0.5 + float( l ) * vec2( 0.5, 0.37 );
		vec2 qi = floor( q ), qf = q - qi;
		vec2 h = tHash2( qi + float( l ) * 17.0 );
		float age = fract( t * ( 0.8 + 0.5 * h.y ) + h.x );
		vec2 d = qf - 0.25 - 0.5 * h;
		float r = length( d );
		float rad = age * 0.42;
		float ring = sin( ( r - rad ) * 45.0 ) * ( 1.0 - smoothstep( 0.0, 0.08, abs( r - rad ) ) ) * ( 1.0 - age ) * ( 1.0 - age );
		n += d / max( r, 1e-3 ) * ring;
	}
	return n;
}
vec3 terrainPerturb( vec3 pos, vec3 n, float h ) {
	vec3 dpx = dFdx( pos ), dpy = dFdy( pos );
	float dhx = dFdx( h ), dhy = dFdy( h );
	vec3 r1 = cross( dpy, n ), r2 = cross( n, dpx );
	float det = dot( dpx, r1 );
	vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 );
	return normalize( abs( det ) * n - grad );
}
`,ut=`
	vec3 P = vTerrainPos;
	float camDist = length( P - cameraPosition );
	float detail = 1.0 - smoothstep( 70.0, 360.0, camDist );
#ifdef TERRAIN_MESH
	vec4 sA = vSplatA;
	vec4 sB = vSplatB;
	vec3 N = normalize( vWorldNrm );
	float aoRaw = vTer.x;
	float rockExp = vTer.y;
	vec4 sE = vec4( vTer.z, vTer.w, 0.0, 0.0 );
#else
	vec2 tuv = ( ( P.xz + 1024.0 ) * 0.5 + 0.5 ) / 1025.0;
	vec4 nrm4 = texture( tNormal, tuv );
	vec2 ne = nrm4.xy * 2.0 - 1.0;
	vec2 nxz = sign( ne ) * ne * ne;
	vec3 N = normalize( vec3( nxz.x, sqrt( max( 0.0, 1.0 - dot( nxz, nxz ) ) ), nxz.y ) );
	float aoRaw = nrm4.z;
	float rockExp = nrm4.w;
	vec4 sA = texture( tSplatA, tuv );
	vec4 sB = texture( tSplatB, tuv );
	vec4 sE = texture( tExtra, tuv );
#endif
	// ---- noise at several scales ----
	vec4 nMacro = texture( tNoise, P.xz * ( 1.0 / 700.0 ) );
	vec4 nLarge = texture( tNoise, P.xz * ( 1.0 / 150.0 ) + 0.31 );
	vec4 nMid = texture( tNoise, P.xz * ( 1.0 / 29.0 ) + 0.57 );
	vec4 nFine = texture( tNoise, P.xz * ( 1.0 / 5.7 ) + 0.11 );
	vec4 nMicro = texture( tNoise, P.xz * ( 1.0 / 1.37 ) + 0.83 );
	// ---- triplanar rock sample ----
	vec3 bw = pow( abs( N ), vec3( 4.0 ) );
	bw /= ( bw.x + bw.y + bw.z );
	// two scales with unrelated offsets so the 256² noise tile never reads as a repeat on big faces; on
	// level ground (most of the screen) the side projections weigh nothing and are not fetched
	float sideW = bw.x + bw.z;
	vec4 rN = texture( tNoise, P.xz * ( 1.0 / 33.0 ) + vec2( 0.52, 0.27 ) );
	vec4 rF = texture( tNoise, P.xz * ( 1.0 / 7.3 ) + vec2( 0.35, 0.93 ) );
	if ( sideW > 0.01 ) {
		rN = texture( tNoise, P.zy * ( 1.0 / 33.0 ) + vec2( 0.13, 0.71 ) ) * bw.x + rN * bw.y + texture( tNoise, P.xy * ( 1.0 / 33.0 ) + vec2( 0.87, 0.44 ) ) * bw.z;
		rF = texture( tNoise, P.zy * ( 1.0 / 7.3 ) + vec2( 0.61, 0.08 ) ) * bw.x + rF * bw.y + texture( tNoise, P.xy * ( 1.0 / 7.3 ) + vec2( 0.19, 0.58 ) ) * bw.z;
	}
	// vertically stretched samples on the faces: water streaks (r) and joint cracks (b)
	vec4 vS = sideW > 0.02 ? ( texture( tNoise, vec2( P.z * 0.21, P.y * 0.022 ) ) * bw.x + texture( tNoise, vec2( P.x * 0.21, P.y * 0.022 ) ) * bw.z ) / sideW : vec4( 0.5 );
	float streak = vS.r;

	// ---- ground layers ----
	// field-scale patchwork (~60–150 m): sunlit dry meadow on well-drained rises, deep moss in the
	// hollows and damp ground, so the Vale reads as a painted quilt from the heights, not one carpet
	vec4 nField = texture( tNoise, P.xz * ( 1.0 / 97.0 ) + vec2( 0.43, 0.19 ) );
	float golden = smoothstep( 0.56, 0.74, nField.b * 0.7 + nMacro.b * 0.3 ) * smoothstep( 0.55, 0.85, aoRaw );
	float hollow = clamp( smoothstep( 0.93, 0.72, aoRaw ) * 0.8 + smoothstep( 0.55, 0.8, nField.g ) * 0.45 + sE.x * 0.5, 0.0, 1.0 );
	vec3 grass = mix( cGrass, cGrassLush, smoothstep( 0.35, 0.7, nLarge.r ) );
	grass = mix( grass, cGrassDry, smoothstep( 0.5, 0.8, nMacro.r ) * 0.3 + smoothstep( 0.62, 0.8, nMid.b ) * 0.15 );
	grass = mix( grass, cGoldField, golden * 0.35 );
	grass = mix( grass, cMossHollow, hollow * 0.55 );
	grass *= 0.84 + 0.3 * nMid.r;
	grass *= mix( 1.0, 0.9 + 0.2 * nFine.a, detail );
	vec3 meadow = mix( cMeadow, cGrassDry, nLarge.b * 0.4 ) * ( 0.88 + 0.24 * nMid.a );
	meadow = mix( meadow, cGoldField, golden * 0.3 );
	// rolling meadow: rises facing the midday sun (south, a little west) dry to a paler, warmer sward,
	// hollows and north slopes stay lush and dark (±12 %), so the fields model the land from the heights
	float dry = clamp( 0.5 + ( N.z * 0.6 - N.x * 0.25 ) * 2.4 + ( aoRaw - 0.86 ) * 2.6 + ( nLarge.a - 0.5 ) * 0.5, 0.0, 1.0 );
	vec3 dryTint = vec3( 0.88 ) + vec3( 0.26, 0.24, 0.16 ) * dry;
	grass *= dryTint;
	meadow *= dryTint;
	// (single blooms in the sward are gone past the detail range: no lookup there)
	float bloom = detail > 0.0 ? smoothstep( 0.8, 0.9, texture( tNoise, P.xz * ( 1.0 / 2.3 ) + 0.7 ).g ) * smoothstep( 0.35, 0.6, nMid.g ) * detail : 0.0;
	vec3 flower = nMid.b > 0.62 ? cFlowerB : nMid.b > 0.4 ? cFlowerA : cFlowerC;
	meadow = mix( meadow, flower, bloom * 0.75 );
	// the Weald floor: needle litter, olive where it thins, with moss spreading in broad patches
	vec3 forest = mix( cForest, cForest2, smoothstep( 0.4, 0.7, nMid.g ) * 0.8 );
	forest = mix( forest, cMossHollow, smoothstep( 0.55, 0.8, nLarge.g ) * 0.55 ) * ( 0.85 + 0.3 * nFine.r );
	float scree = sE.z;
	vec3 dirt = mix( cDirt, cGravel, clamp( scree * ( 1.0 - sB.b ) * 1.2, 0.0, 1.0 ) );
	dirt *= 0.78 + 0.4 * nFine.r;
	dirt = mix( dirt, cGravel, smoothstep( 0.7, 0.9, nFine.g ) * detail * 0.3 );
	// cobbles on scree, river beds and gravel bars: rounded stones of mixed rock, size, shape and
	// orientation with dark gaps; small ones where the current sorts the gravel finer. Past ~100 m the
	// stones are below a pixel and only their mean colour is left.
	float cobDome = 0.0;
	float screeK = clamp( scree * 1.3, 0.0, 1.0 );
	vec3 bed = mix( dirt, mix( cGravel, cGranite2, 0.4 ) * 0.78, screeK * 0.6 );
	float stoneK = 1.0 - smoothstep( 45.0, 100.0, camDist );
	if ( screeK > 0.02 && stoneK > 0.0 ) {
		vec3 st = tStones( P.xz / mix( 0.38, 0.2, smoothstep( 0.35, 0.7, nMid.g ) ) );
		vec3 rockTone = st.y < 0.45 ? mix( cGravel, cChalk2, st.y * 2.0 ) : mix( cGranite, cGranite2, st.y * 1.8 - 0.8 );
		vec3 stone = rockTone * ( 0.62 + 0.5 * tHash( st.y * 91.0 ) ) * ( 0.9 + 0.2 * nMicro.r );
		stone = mix( stone, cLichen * 0.7, smoothstep( 0.8, 0.95, tHash( st.y * 37.0 ) ) * 0.4 );
		bed = mix( bed, mix( dirt, mix( dirt * 0.55, stone, st.x ), screeK ), stoneK );
		cobDome = st.z * st.x * screeK * stoneK;
	}
	dirt = bed;
	vec3 path = mix( cPathEdge, cPath, smoothstep( 0.35, 0.85, sA.a ) );
	path *= 0.86 + 0.22 * nFine.r;
	path = mix( path, cGravel, smoothstep( 0.76, 0.88, nMicro.g ) * detail * 0.5 );
	vec3 sand = cSand * ( 0.92 + 0.12 * nMid.r );
	sand *= 1.0 - 0.06 * sin( dot( P.xz, vec2( 0.62, 0.27 ) ) * 2.2 + nMid.r * 7.0 ) * detail;
	vec3 mud = mix( cMud, cFenMoss, smoothstep( 0.4, 0.7, nMid.r ) * 0.6 ) * ( 0.85 + 0.3 * nFine.a );

	vec3 col = grass;
	col = mix( col, meadow, smoothstep( 0.1, 0.9, sA.r + ( nMid.r - 0.5 ) * 0.5 * sA.r * ( 1.0 - sA.r ) * 4.0 ) );
	col = mix( col, forest, tSharp( sA.g, nMid.g, 0.3 ) );
	col = mix( col, mud, tSharp( sB.g, nMid.b, 0.26 ) );
	col = mix( col, dirt, tSharp( sA.b, nFine.r, 0.3 ) );
	col = mix( col, sand, tSharp( sB.r, nMid.a, 0.22 ) );
	col = mix( col, path, tSharp( sA.a, nFine.g, 0.2 ) );

	// ---- rock: chalk (bedding, flint bands, joints, stains) or granite (lichen) ----
	// bedding coordinate: gently warped and dipping (the same dip as the generator's strata ledges)
	float yb = P.y + ( nLarge.r - 0.5 ) * 3.5 + P.x * 0.0045;
	float bedT = yb / 4.4, bedF = fract( bedT );           // thick beds (the ledges of the face)
	float thinT = yb / 1.45, thinF = fract( thinT );       // thin partings inside them
	float lay = tHash( floor( thinT ) ) * 0.4 + tHash( floor( bedT ) + 3.0 ) * 0.6;
	vec3 chalk = mix( cChalk, cChalk2, lay * 0.3 + rN.r * 0.55 );
	chalk = mix( chalk, cChalkWarm, smoothstep( 0.55, 0.9, tHash( floor( yb / 9.1 ) + 7.0 ) ) * 0.3 );
	// the face reads in vertical columns (joint-bounded pillars of cool grey and warm cream), and whole
	// stretches of the escarpment shift between the two on a ~700 m scale
	chalk = mix( chalk, chalk * vec3( 0.83, 0.88, 0.95 ), smoothstep( 0.38, 0.7, vS.g ) * sideW * 0.25 );
	chalk = mix( chalk, chalk * vec3( 0.88, 0.9, 0.94 ), smoothstep( 0.45, 0.7, nMacro.b ) * 0.7 );
	// partings: thin shadowed lines between beds, faded out before they alias to noise
	float wT = fwidth( thinT ), wB = fwidth( bedT );
	// (only some partings open up, and each one comes and goes along the face)
	float thinOn = step( 0.72, tHash( floor( thinT ) + 17.0 ) ) * smoothstep( 0.45, 0.7, rN.a );
	float part = ( 1.0 - smoothstep( 0.0, 0.04 + wT * 1.5, min( thinF, 1.0 - thinF ) ) ) * ( 1.0 - smoothstep( 0.12, 0.3, wT ) ) * 0.2 * thinOn;
	part = max( part, ( 1.0 - smoothstep( 0.0, 0.03 + wB * 1.5, min( bedF, 1.0 - bedF ) ) ) * ( 1.0 - smoothstep( 0.1, 0.25, wB ) ) * ( 0.06 + 0.16 * smoothstep( 0.45, 0.8, rF.r ) ) );
	// flint: dark nodule bands strung along a few bedding planes
	float flintB = abs( fract( yb / 3.4 + nLarge.b * 0.35 ) - 0.5 ) * 2.0;
	float seam = smoothstep( 0.88, 0.97, flintB ) * smoothstep( 0.55, 0.8, rF.g ) * step( 0.55, tHash( floor( yb / 3.4 + nLarge.b * 0.35 ) + 11.0 ) );
	chalk = mix( chalk, cFlint, seam * 0.4 * mix( 0.35, 1.0, detail ) );
	// vertical joints and grey water streaks running down from the rim
	float joint = smoothstep( 0.78, 0.95, vS.b ) * mix( 0.4, 1.0, detail );
	// weathering: old faces grey over (lichen, algae, the soot of old rain); fresh scars stay bone-white
	float weather = smoothstep( 0.25, 0.65, rN.g * 0.55 + nLarge.g * 0.3 + vS.g * 0.3 ) * sideW;
	chalk = mix( chalk, cChalkGrey * ( 0.78 + 0.35 * rF.g ), weather * 0.72 );
	// rain streaks: dark stripes hanging from every ledge and running down the bed below it (the face's
	// structure now comes from its joints and beds, so the long rim seeps are gone: they smeared it); a
	// ledge overhangs the top of the bed beneath it (shade)
	float hang = pow( bedF, 1.6 );
	float stripes = smoothstep( 0.58, 0.8, streak ) * ( 0.35 + 0.65 * hang ) * detail + smoothstep( 0.66, 0.9, vS.a ) * 0.3;
	chalk = mix( chalk, chalk * vec3( 0.5, 0.53, 0.52 ), clamp( stripes, 0.0, 1.0 ) * sideW * 0.5 );
	// (only the harder beds jut out far enough to shade the one below, each by its own amount)
	float jut = smoothstep( 0.45, 0.8, tHash( floor( bedT ) + 23.0 ) );
	chalk *= 1.0 - smoothstep( 0.78, 1.0, bedF ) * 0.32 * jut * sideW * ( 1.0 - smoothstep( 0.12, 0.3, wB ) );
	chalk *= 1.0 - ( 0.25 * joint + part * 0.6 * detail ) * sideW;
	chalk = mix( chalk, chalk * vec3( 0.93, 0.88, 0.78 ), smoothstep( 0.62, 0.85, vS.a ) * sideW * 0.35 ); // iron stain
	chalk *= 0.76 + 0.36 * rN.r;
	vec3 granite = mix( cGranite, cGranite2, smoothstep( 0.3, 0.7, rN.r ) ) * ( 0.8 + 0.3 * rF.r );
	granite = mix( granite, cLichen, smoothstep( 0.62, 0.8, rN.g ) * N.y * N.y * 0.55 );
	// ---- macro structure of rock faces (8–25 m): blocks between open joints, thick beds weathered into
	// ledges, faceted surfaces. World-space triplanar, so nothing stretches down a cliff (the grid's
	// data, 2 m apart across the face, does), at uRockScale (1 on the terrain, larger on the distant
	// ranges); its height is lit through a bump in the smooth normal's tangent plane (see below) ----
	float rw = tSharp( rockExp, rN.r, 0.22 );
	float rockH = 0.0, jointK = 0.0, undercut = 0.0, blockTone = 0.5;
	// (its mip level comes from derivatives taken outside the branch, where they are defined; one level
	// for all three projections, sampled with textureLod: gradient sampling runs at a fraction of the rate)
	vec3 dPx = dFdx( P ), dPy = dFdy( P );
	float pxLog = 0.5 * log2( max( max( dot( dPx, dPx ), dot( dPy, dPy ) ), 1e-10 ) ); // log2 of metres per pixel
	float mLod = max( 0.0, pxLog + log2( 256.0 / ( 190.0 * uRockScale ) ) );
	if ( rw > 0.01 && sideW > 0.04 ) {
		vec3 Q = P / uRockScale;
		vec4 mB = textureLod( tNoise, Q.zy * ( 1.0 / 190.0 ) + vec2( 0.21, 0.63 ), mLod ) * bw.x
			+ textureLod( tNoise, Q.xz * ( 1.0 / 190.0 ) + vec2( 0.77, 0.12 ), mLod ) * bw.y
			+ textureLod( tNoise, Q.xy * ( 1.0 / 190.0 ) + vec2( 0.45, 0.88 ), mLod ) * bw.z;
		// joints: the crests of the ridged channel, a network of open cracks between blocks of ~10–20 m,
		// as sharp as the pixel allows (a fixed soft band reads as a smudge up close)
		float jw = clamp( exp2( pxLog ) / ( 9.0 * uRockScale ), 0.01, 0.06 );
		jointK = smoothstep( 0.8 - jw, 0.8 + jw, mB.b + ( rN.b - 0.5 ) * 0.08 );
		// thick beds (~9 m), each weathered on its own terms: a recessed soft band under a jutting hard bed
		// (the granite is massive: sheet joints, few beds)
		float yB = Q.y + ( mB.r - 0.5 ) * 5.0 + Q.x * 0.0045;
		float bT = yB / 9.3, bF = fract( bT );
		// (a bed shows in some blocks and fades in others, so the ledges run in broken lengths)
		float bedK = ( 0.35 + 0.65 * tHash( floor( bT ) + 41.0 ) ) * smoothstep( 0.3, 0.55, mB.a * 0.7 + rN.r * 0.3 ) * ( 1.0 - smoothstep( 0.3, 0.7, sB.b ) * 0.65 );
		undercut = ( 1.0 - smoothstep( 0.0, 0.16, bF ) ) * bedK;
		rockH = -1.1 * jointK + ( mB.r - 0.5 ) * 1.8 + ( smoothstep( 0.0, 0.16, bF ) - smoothstep( 0.86, 1.0, bF ) ) * 0.9 * bedK;
		blockTone = mB.g;
	}
	chalk *= 0.88 + 0.24 * blockTone;
	granite *= 0.9 + 0.2 * blockTone;
	vec3 rock = mix( chalk, granite, smoothstep( 0.3, 0.7, sB.b ) );
	// open joints, fine cracks and the undercuts beneath the beds sink into cool shade (DESIGN: shadows
	// lean indigo); the cracks are the triplanar cellular cells (~2 m), gone before they alias
	float crackK = ( 1.0 - smoothstep( 0.16, 0.26, rN.g ) ) * detail * rw * sideW;
	// (up close the bed's own relief carries the undercut; from afar a darker band has to)
	rock *= mix( vec3( 1.0 ), vec3( 0.5, 0.54, 0.76 ), clamp( jointK * 0.85 + undercut * mix( 0.15, 0.4, smoothstep( 25.0, 120.0, camDist ) ) + crackK * 0.3, 0.0, 1.0 ) );
	rock = mix( rock, cMossHollow * 1.1, sA.g * smoothstep( 0.55, 0.9, N.y ) * smoothstep( 0.45, 0.7, rN.r ) * 0.7 );
	// turf and moss hold on every ledge and bench of the chalk (not on granite or the high snow rock)
	float ledgeTurf = smoothstep( 0.7, 0.88, N.y + ( nMid.r - 0.5 ) * 0.25 ) * ( 1.0 - smoothstep( 0.3, 0.7, sB.b ) ) * smoothstep( 0.35, 0.6, nFine.g * 0.5 + nMid.a * 0.5 + 0.1 );
	rock = mix( rock, mix( cTurf, cMossHollow, nFine.r ) * ( 0.85 + 0.3 * nMid.r ), ledgeTurf * 0.9 );
	col = mix( col, rock, rw );

	// ---- snow above the tree line; a dusting on the Loomspire crag ----
	float snowLine = uSnowLine + ( nLarge.r - 0.5 ) * 34.0;
	// snow lies on benches and gentle slopes; steep faces, ribs and buttresses stay bare rock, so the
	// ranges read as ridgelines and couloirs instead of one white mass
	// (granite ledges hold snow more readily than the chalk's)
	float rockSnow = rw * ( 1.0 - 0.55 * smoothstep( 0.3, 0.7, sB.b ) );
	float snowSlope = smoothstep( uSnowSlope.x + 0.14 * rockSnow, uSnowSlope.y + 0.1 * rockSnow, N.y + ( rN.r - 0.5 ) * 0.3 + ( nMid.g - 0.5 ) * 0.12 );
	float snow = smoothstep( snowLine + uSnowBand.x, snowLine + uSnowBand.y, P.y ) * snowSlope;
	// a dusting over the Loomspire Heights and on the crag's ledges
	float spire = 1.0 - smoothstep( 150.0, 260.0, length( P.xz - vec2( 0.0, -590.0 ) ) );
	// a frosting that thickens in hollows and on ledges and lets the ground show through on crowns:
	// a dusting, not camouflage blotches
	float dust = nMid.b * 0.45 + nFine.g * 0.35 + ( 1.0 - aoRaw ) * 1.1 + nLarge.g * 0.2;
	snow = max( snow, spire * smoothstep( 88.0, 106.0, P.y + nMid.r * 10.0 ) * smoothstep( 0.8, 0.95, N.y ) * ( 0.22 + 0.5 * smoothstep( 0.35, 0.85, dust ) ) );
	// the Horn and its spurs above the plaza: snow on every up-facing ledge, so a white-capped summit
	// stands out against the grey ranges behind it
	snow = max( snow, spire * smoothstep( 108.0, 122.0, P.y + nMid.r * 8.0 ) * smoothstep( 0.66, 0.82, N.y + ( rN.r - 0.5 ) * 0.2 ) * ( 0.55 + 0.4 * smoothstep( 0.3, 0.7, dust ) ) );
	col = mix( col, cSnow * ( 0.94 + 0.08 * nFine.r ), snow );

	// ---- cave floor & walls ----
	float cave = sB.a;
	vec3 caveCol = mix( cCave, cCave2, smoothstep( 0.3, 0.7, rN.r ) ) * ( 0.8 + 0.25 * rF.r );
	// the chalk bedding carries on underground; pale flowstone curtains run down the walls
	caveCol *= 0.88 + 0.22 * lay - part * 0.6 * detail * sideW;
	caveCol = mix( caveCol, cChalk2 * 0.5, smoothstep( 0.58, 0.85, streak ) * sideW * 0.65 );
	col = mix( col, caveCol, cave );

	// ---- turf: inside the grass ring the ground between the blades is sward near the blades' own mid
	// colour (never bare soil, and not so dark that it pulls shaded meadows down); beyond it the
	// wildflower drifts carry on as colour ----
	float turf = ( 1.0 - sA.g * 0.55 ) * ( 1.0 - sA.b * 0.75 ) * ( 1.0 - sA.a ) * ( 1.0 - sB.r ) * ( 1.0 - sB.g * 0.65 )
		* ( 1.0 - rw ) * ( 1.0 - snow ) * ( 1.0 - cave ) * ( 1.0 - sE.x ) * smoothstep( 0.7, 0.82, N.y );
	float inRing = 1.0 - smoothstep( uGrassRing.x, uGrassRing.y, camDist );
	col = mix( col, mix( col * 0.85, cTurfBlade, 0.55 ), turf * inRing );
	// wildflower drifts beyond the ring: about 45 % of the ~18 m warped cells carry one, led by the
	// species the vegetation picks for that cell (its hash and odds: poppy, daisy, cornflower or
	// buttercup), so the far colour carries on the flowers growing nearer the viewer. A drift is an
	// elongated clump around a jittered centre, turned per cell, its outline broken by noise: full in the
	// inner third of the cell's radius, thinning steadily to nothing at the cell's edge (never a seam
	// between two colours). Its petals stay petals at any distance: spots of the cellular channel at a
	// scale that keeps them 2–3 px on screen (single flowers near by, clumps of them far off),
	// cross-faded between two octaves so nothing swims (the coarser octave is the next level's finer
	// one, so nothing pops either), over a faint tint of the species. Flower colours
	// stay pure (only the cornflowers' blue is toned toward the sward far away): the aerial perspective
	// does the fading.
	float driftK = turf * smoothstep( uGrassRing.y * 0.8, uGrassRing.y * 1.5, camDist ) * ( 0.7 + 0.3 * sA.r );
	vec2 dq = P.xz / 18.0 + vec2( sin( P.z * 0.05 ), cos( P.x * 0.045 ) ) * 0.8;
	vec2 dc = floor( dq ), df = dq - dc;
	float dOn = tFlowerHash( dc + 17.9 );
	if ( driftK > 0.002 && dOn < 0.45 ) {
		float da = dOn * 20.9;
		vec2 dd = mat2( cos( da ), sin( da ), -sin( da ), cos( da ) ) * ( df - 0.5 - ( vec2( fract( dOn * 37.3 ), fract( dOn * 61.7 ) ) - 0.5 ) * 0.24 );
		float rd = length( dd * vec2( 1.0, 1.45 ) ) * 2.0 + ( nMid.r - 0.5 ) * 0.6 + ( nMid.g - 0.5 ) * 0.25;
		float edge = smoothstep( 0.0, 0.12, min( min( df.x, 1.0 - df.x ), min( df.y, 1.0 - df.y ) ) );
		float prof = ( 1.0 - smoothstep( 0.3, 1.05, rd ) ) * edge * driftK;
		float dh = tFlowerHash( dc + 3.3 );
		float farK = smoothstep( 90.0, 220.0, camDist );
		// (daisies' white carries farthest: their drifts are sparser, so none reads as a white stain)
		vec4 sp = dh < 0.28 ? vec4( cFlowerB, 1.0 ) : dh < 0.64 ? vec4( cFlowerC, 0.7 ) : dh < 0.88 ? vec4( mix( cFlowerD, cMeadow, 0.15 + 0.3 * farK ), 0.9 ) : vec4( cFlowerA, 0.85 );
		float lk = max( 0.0, pxLog + log2( 64.0 / 3.1 ) );
		float l0 = floor( lk ), lf = lk - l0;
		float ts = 3.1 * exp2( l0 );
		float pLod = max( 0.0, pxLog + log2( 256.0 / ts ) - 0.5 );
		float g0 = textureLod( tNoise, P.xz / ts + 0.37, pLod ).g;
		float g1 = textureLod( tNoise, P.xz / ( 2.0 * ts ) + 0.37, max( 0.0, pLod - 1.0 ) ).g;
		// (a spot's area grows with the square of its threshold: sqrt keeps the density falling linearly;
		// far off the drifts are a little denser, so they hold their own against the haze)
		float pc = 1.0 - sqrt( prof ) * ( 0.56 + 0.08 * farK ) * sp.w, pw = 0.08 + 0.06 * farK;
		float petals = mix( smoothstep( pc, pc + pw, g0 ), smoothstep( pc, pc + pw, g1 ), lf );
		col = mix( col, sp.rgb * 0.9, max( petals, prof * ( 0.1 + 0.05 * farK ) ) );
	}

	// ---- wetness, macro variation, cavity ----
	float wet = sE.x;
	col *= mix( 1.0, 0.6, wet * ( 1.0 - snow ) * ( 1.0 - 0.4 * cave ) );
	col *= 0.84 + 0.3 * nMacro.g;
	// (on rock faces the grid's cavity is smeared down the whole face: the joints carry the shade there)
	float aoFace = mix( aoRaw, 0.9, sideW * rw );
	col *= 0.72 + 0.28 * aoFace;
	// rain: the land darkens and turns glossy; paths, trodden dirt and mud collect puddles that
	// mirror the sky
	float rainK = uRain * ( 1.0 - cave ) * ( 1.0 - snow );
	float trodden = clamp( sA.a + sA.b * 0.7 + sB.g * 0.8, 0.0, 1.0 );
	float soak = rainK * ( 0.55 + 0.45 * trodden );
	col *= mix( 1.0, 0.7, soak );
	float puddle = 0.0;
	if ( rainK > 0.01 ) {
		float pn = nMid.g * 0.5 + nFine.r * 0.3 + nLarge.b * 0.2 + ( 1.0 - aoRaw ) * 1.4;
		float fill = 0.12 * smoothstep( 0.2, 1.0, rainK );
		float lie = trodden * smoothstep( 0.95, 0.99, N.y ) * smoothstep( 0.15, 0.5, rainK );
		// soft margins (~0.1 m) and a darker soaked rim of mud around each puddle
		puddle = smoothstep( 0.625 - fill, 0.64 - fill, pn ) * lie;
		col *= 1.0 - smoothstep( 0.57 - fill, 0.63 - fill, pn ) * lie * 0.18;
		// what shows through the water at a steep look: dark wet mud
		col = mix( col, col * 0.45, puddle );
	}
#ifdef TERRAIN_MESH
	// distant ranges (the backdrop): each farther layer sinks into the blue air, so the ranges separate,
	// and mist lies in the valleys between them with the peaks standing clear above it
	float beyond = max( abs( P.x ), abs( P.z ) ) - 1024.0;
	float valleyMist = ( 1.0 - smoothstep( 110.0, 340.0, P.y + ( nLarge.g - 0.5 ) * 60.0 ) ) * smoothstep( 80.0, 700.0, beyond );
	col = mix( col, uHaze.rgb, uHaze.w * clamp( smoothstep( 250.0, 3200.0, beyond ) + valleyMist * 0.9, 0.0, 1.0 ) );
#endif
	diffuseColor.rgb = col;

	float tRough = 0.95;
	tRough = mix( tRough, 0.82, rw );
	tRough = mix( tRough, 0.6, snow );
	tRough = mix( tRough, 0.32, wet );
	tRough = mix( tRough, 0.68, cave );
	tRough = mix( tRough, 0.42, soak * 0.7 );
	tRough = mix( tRough, 0.03, puddle );

	// ---- bump: rock cracks & strata ledges, pebbles, grain ----
	// rock relief: broad lumps, bedding partings and flint (chalk), a little fine grain — no cellular dimples
	float bump = ( rN.r - 0.5 ) * 0.45 * rw + ( rF.r - 0.5 ) * 0.18 * rw + ( seam - part ) * 0.05 * rw;
	bump += ( ( nFine.r - 0.5 ) * 0.12 + ( nMicro.a - 0.5 ) * 0.06 + cobDome * 0.16 ) * ( 1.0 - rw ) * ( 1.0 - snow * 0.7 ) * ( 1.0 - cave * 0.75 );
	// Screen-space bump reads the 2 m facets through dFdx(P) and turns steep faces into a mosaic, so
	// steep ground gets a world-space tilt from the (facet-independent) triplanar noise instead.
	vec3 tN = N;
	if ( detail > 0.01 ) {
		float steepK = 1.0 - smoothstep( 0.6, 0.85, N.y );
		vec3 flatB = steepK < 0.99 ? terrainPerturb( P, N, bump * detail * ( 1.0 - steepK ) ) : N;
		// smooth fBm lumps only (the ridged / cellular channels read as a brick mosaic on big faces)
		vec3 tilt = vec3( rN.r - 0.5, ( rF.a - 0.5 ) * 0.5, rN.a - 0.5 ) * 0.8 + vec3( rF.r - 0.5, 0.0, rF.a - 0.5 ) * 0.45;
		// chalk bedding: each thick bed bulges a little, so its top catches the light and the parting
		// beneath it sits in shade — the strata read from across the valley
		float saw = ( bedF - 0.5 ) * 2.0 * ( 1.0 - smoothstep( 0.1, 0.25, wB ) ) * ( 0.35 + 0.65 * tHash( floor( bedT ) + 5.0 ) );
		tilt.y += saw * 0.2 * rw * ( 1.0 - smoothstep( 0.3, 0.7, sB.b ) ) * sideW;
		tilt -= N * dot( tilt, N );
		vec3 steepB = normalize( N + tilt * 0.75 * detail );
		tN = normalize( mix( flatB, steepB, steepK ) );
	}
	// rock faces: the macro height as a bump in the tangent plane of the smooth normal. The screen
	// derivatives of P are projected onto that plane first, so the 2 m triangles of the grid never show
	// through (a plain derivative bump reads them as a mosaic); taken in uniform control flow
	float rhx = dFdx( rockH ), rhy = dFdy( rockH );
	if ( rockH != 0.0 ) {
		vec3 sx = dPx - N * dot( dPx, N ), sy = dPy - N * dot( dPy, N );
		vec3 r1 = cross( sy, N ), r2 = cross( N, sx );
		float det = dot( sx, r1 );
		tN = normalize( abs( det ) * tN - sign( det ) * ( rhx * r1 + rhy * r2 ) * rw );
	}
	if ( puddle > 0.0 ) {
		// a puddle is a flat mirror, ringed by landing raindrops
		vec2 ring = camDist < 40.0 ? tRainRings( P.xz, uTime ) : vec2( 0.0 );
		tN = normalize( mix( tN, normalize( N + vec3( ring.x, 0.0, ring.y ) * 0.22 * rainK ), puddle ) );
	}
	float tAO = mix( 1.0, aoFace, 0.85 ) * ( 1.0 - jointK * 0.35 * rw );
	// crystal light on the rock around each cluster: a coloured bounce that keeps the rock's own
	// texture (an absolute emissive wash flattened the walls into one teal plane), plus a faint
	// floor so even the darkest rock near a cluster catches some of it
	vec3 tEmis = cGlow * sE.y * ( col * 1.9 + 0.01 ) * mix( 1.0, 0.65, sideW );
	// glowworms: pin-points of cold light on the cave's walls, thickest up toward the roof
	if ( cave > 0.3 ) {
		vec2 wq = vec2( P.x * 0.7 + P.z * 0.7, P.y ) / 2.3;
		vec4 gw = texture( tNoise, mix( P.xz / 2.3, wq, sideW ) + 0.37 );
		float worm = smoothstep( 0.9, 0.97, gw.g ) * smoothstep( 0.35, 0.65, rN.r ) * smoothstep( 0.3, 0.8, cave ) * ( 0.25 + 0.75 * sideW );
		tEmis += vec3( 0.35, 0.95, 0.9 ) * worm * ( 0.7 + 0.3 * sin( uTime * 0.9 + gw.r * 25.0 ) ) * 1.6;
	}
`;function dt(e,t,n){let r=st(e,n),i=new S({roughness:1,metalness:0,color:16777215});i.name=`terrain-${t}`,i.onBeforeCompile=e=>{Object.assign(e.uniforms,r),t===`mesh`&&(e.defines={...e.defines??{},TERRAIN_MESH:``});let n=e.vertexShader;t===`cdlod`?(n=n.replace(`#include <common>`,`#include <common>\n${ct}\nvarying vec3 vTerrainPos;`),n=n.replace(`#include <beginnormal_vertex>`,`vec3 tNrm;
vec3 tPos = terrainVertex( tNrm );
vec3 objectNormal = tNrm;`),n=n.replace(`#include <begin_vertex>`,`vec3 transformed = tPos;
vTerrainPos = tPos;`)):(n=n.replace(`#include <common>`,`#include <common>
attribute vec4 aSplatA;
attribute vec4 aSplatB;
attribute vec4 aTer;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec4 vTer;
varying vec3 vWorldNrm;
varying vec3 vTerrainPos;`),n=n.replace(`#include <begin_vertex>`,`#include <begin_vertex>
#ifdef USE_INSTANCING
	mat4 tModel = modelMatrix * instanceMatrix;
#else
	mat4 tModel = modelMatrix;
#endif
vTerrainPos = ( tModel * vec4( transformed, 1.0 ) ).xyz;
vWorldNrm = normalize( mat3( tModel ) * objectNormal );
vSplatA = aSplatA; vSplatB = aSplatB; vTer = aTer;`)),e.vertexShader=n;let i=e.fragmentShader;i=i.replace(`#include <common>`,`#include <common>\n${lt}`),i=i.replace(`#include <color_fragment>`,ut),i=i.replace(`#include <roughnessmap_fragment>`,`float roughnessFactor = tRough;`),i=i.replace(`#include <normal_fragment_maps>`,`normal = normalize( ( viewMatrix * vec4( tN, 0.0 ) ).xyz );`),i=i.replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
totalEmissiveRadiance += tEmis;`),i=i.replace(`#include <aomap_fragment>`,`reflectedLight.indirectDiffuse *= tAO;
reflectedLight.indirectSpecular *= mix( tAO, 1.6, puddle );
caveIndirect( reflectedLight, material.diffuseColor, cave );`),e.fragmentShader=i},i.customProgramCacheKey=()=>`mender-terrain-${t}-v5`;let a=new b({depthPacking:u});return a.name=`terrain-depth-${t}`,t===`cdlod`&&(a.onBeforeCompile=e=>{Object.assign(e.uniforms,r),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>\n${ct}`).replace(`#include <begin_vertex>`,`vec3 tNrmD;
vec3 transformed = terrainVertex( tNrmD );`)},a.customProgramCacheKey=()=>`mender-terrain-depth-v1`),{material:i,depth:a,uniforms:r}}var Y=(e,t,n)=>e<t?t:e>n?n:e,ft=(e,t,n)=>{let r=Y((n-e)/(t-e),0,1);return r*r*(3-2*r)},pt=(e,t,n)=>e+(t-e)*n,mt=new H(`hollow-deep`),ht=new D(5126694),gt=[`grass`,`grass`,`meadow`,`moss`,`chalk`,`dirt`],_t=0,vt=1,yt=2;function X(e,t,n){t=Y(t,0,e.length);let r=0,i=e.n-1;for(;i-r>1;){let n=r+i>>1;e.s[n]<=t?r=n:i=n}let a=(t-e.s[r])/(e.s[i]-e.s[r]||1);n.x=e.x[r]+(e.x[i]-e.x[r])*a,n.z=e.z[r]+(e.z[i]-e.z[r])*a;let o=e.tx[r]+(e.tx[i]-e.tx[r])*a,s=e.tz[r]+(e.tz[i]-e.tz[r])*a,c=Math.hypot(o,s)||1;return o/=c,s/=c,n.tx=o,n.tz=s,n.lx=s,n.lz=-o,n}function bt(e,t,n){n=Y(n,0,e.length);let r=0,i=e.n-1;for(;i-r>1;){let t=r+i>>1;e.s[t]<=n?r=t:i=t}let a=(n-e.s[r])/(e.s[i]-e.s[r]||1);return t[r]+(t[i]-t[r])*a}function xt(e){let t={};for(let[n,r]of Object.entries(e.attributes)){let e=r;t[n]={array:e.array instanceof Float32Array?e.array:Float32Array.from(e.array),itemSize:e.itemSize}}let n=e.index.array;return{attrs:t,index:n instanceof Uint16Array||n instanceof Uint32Array?n:Uint32Array.from(n)}}function St(e){let t=new M;for(let[n,r]of Object.entries(e.attrs))t.setAttribute(n,new A(r.array,r.itemSize));return t.setIndex(new A(e.index,1)),t.computeBoundingSphere(),t}var Ct={low:{crystals:4,strands:40,spikes:.45},medium:{crystals:6,strands:80,spikes:.75},high:{crystals:8,strands:120,spikes:1}},wt=28,Tt=wt/2,Et=1.5,Dt=5.5,Ot=2.8,kt=4.8,Z=[[5.3,-.06,.5,.1,0,.98],[4,.08,.45,.35,.06,.95],[3.15,.5,.2,.45,.35,.86],[2.65,1.35,0,.3,.7,.68]];function At(e,t,n,r){let i=e.heights,a=e.precarve,o=t.curve,s=t.roofS0,c=t.roofS1,l=Math.max(2,Math.ceil((c-s)/Et)+1),u=z.points[2],d=(e,t,n)=>{let r=(t+G)/2,i=(n+G)/2,a=Y(Math.floor(r),0,U-2),o=Y(Math.floor(i),0,U-2),s=Y(r-a,0,1),c=Y(i-o,0,1),l=o*U+a;return(e[l]*(1-s)+e[l+1]*s)*(1-c)+(e[l+U]*(1-s)+e[l+U+1]*s)*c},f=(e,t)=>{let n=(e+G)/2,r=(t+G)/2,a=Y(Math.floor(n),0,U-2),o=Y(Math.floor(r),0,U-2),s=Y(n-a,0,1),c=Y(r-o,0,1),l=o*U+a,u=i[l],d=i[l+1],f=i[l+U],p=i[l+U+1];return s>c?u+(d-u)*s+(p-d)*c:u+(p-f)*s+(f-u)*c},p=(e,t)=>d(i,e,t),m=(e,t)=>d(a,e,t)+de(e,t),h=(e,t,n,r)=>{let i=d(a,e,t)+de(e,t)*ft(r-3,r+.5,n),o=f(e,t);return pt(Math.max(i,o),o,ft(r+1.5,r+4,n))+(pt(.1,.07,ft(r,r+4,n))+.15*(1-ft(1,3,Math.abs(n-r))))},g=e=>Y(Math.round((e-s)/Et),0,l-1),_=Se(),v=(e,i)=>{if(!t.index.query(e,i,_))return f(e,i);let a=g(_.s);return h(e,i,Math.abs(_.lat),_.lat>=0?n[a]:r[a])},y=v(u[0],u[1]),b=y-.45;return{c:o,s0:s,s1:c,ns:l,skyC:u,bilin:d,surfAt:f,groundAt:p,topAt:m,roofY:h,rowOf:g,roofAt:v,skyTop:y,skyFloor:(e,t)=>{let n=Math.hypot(e-u[0],t-u[1]);if(n>=Z[0][0])return null;if(n<=Z[2][0])return b;let r=0;for(;r<Z.length-2&&n<Z[r+1][0];)r++;let i=(Z[r][0]-n)/(Z[r][0]-Z[r+1][0]);return v(e,t)-pt(Z[r][1],Z[r+1][1],i)}}}function jt(t,n){let r=t.prep.cave,i=r.curve,o=new ce(`hollow-deep`),s=r.roofS0,c=r.roofS1,l=Math.max(2,Math.ceil((c-s)/Et)+1),u=e=>Math.min(c,s+e*Et),d=z.points[2],f=i.ctrlS[2],m={x:0,z:0,tx:0,tz:1,lx:1,lz:0},h=t.precarve,_=At(t,r,[],[]),{groundAt:v}=_,b=(e,t)=>{X(i,e,m);let n=bt(i,r.floor,e),a=.5;for(;a<24&&!(v(m.x+m.lx*a*t,m.z+m.lz*a*t)>n+1.6);)a+=.5;return a},x=(e,t)=>{X(i,e,m);let n=.5;for(;n<34;){let e=m.x+m.lx*n*t,r=m.z+m.lz*n*t;if(v(e,r)>=_.bilin(h,e,r)-.6)break;n+=.5}return n},S=[],C=[],T=new Float32Array(l),O=new Float32Array(l);{let e=[],t=[];for(let n=0;n<l;n++){let r=u(n);S.push(b(r,1)),C.push(b(r,-1)),e.push(x(r,1)),t.push(x(r,-1))}for(let n=0;n<l;n++){let r=0,i=0;for(let a=-2;a<=2;a++){let o=Y(n+a,0,l-1);r=Math.max(r,e[o]),i=Math.max(i,t[o])}T[n]=Math.max(r,S[n]+1.5),O[n]=Math.max(i,C[n]+1.5)}}let k=At(t,r,T,O),{surfAt:j,topAt:ee,roofY:te,roofAt:P,skyTop:ne,skyFloor:re}=k,F=(e,t,n,r)=>{let i=Y((t+G)/2,0,U-1.001),a=Y((n+G)/2,0,U-1.001),o=Math.floor(i),s=Math.floor(a),c=i-o,l=a-s,u=(s*U+o)*4+r;return((e[u]*(1-c)+e[u+4]*c)*(1-l)+(e[u+U*4]*(1-c)+e[u+U*4+4]*c)*l)/255},ie=(e,n,r)=>{let i=F(t.normal,e,n,0)*2-1,a=F(t.normal,e,n,1)*2-1,o=Math.sign(i)*i*i,s=Math.sign(a)*a*a;return r.set(o,Math.sqrt(Math.max(0,1-o*o-s*s)),s)},ae=(e,t)=>{let n=(t-Tt)/Tt;return n>=0?n*(T[e]+Dt):n*(O[e]+Dt)},I=[],L=[],R=[],B=[],oe=[],H=[],le=[],ue=[],W=new N,de=new N,fe=[0,0,0,0],pe=[0,0,0,0],me=[0,0],he=(e,n,r)=>{for(let i=0;i<4;i++)fe[i]+=F(t.splatA,e,n,i)*r,pe[i]+=F(t.splatB,e,n,i)*r;me[0]+=F(t.normal,e,n,2)*r,me[1]+=F(t.normal,e,n,3)*r},ge=new Uint8Array(n.nx*n.nz);for(let e=0;e<l;e++){let t=u(e);X(i,t,m);let a=bt(i,r.ceiling,t),o=T[e],c=O[e],l=o+2.5,f=c+2.5,p=m.x+m.lx*l,h=m.z+m.lz*l,g=m.x-m.lx*f,_=m.z-m.lz*f;for(let r=0;r<=wt;r++){let i=ae(e,r),l=m.x+m.lx*i,u=m.z+m.lz*i,f=l,v=u,y=i,b=l-d[0],x=u-d[1],w=Math.hypot(b,x);if(ue.push(w<kt),w<kt){let e=kt/Math.max(.001,w);f=d[0]+b*e,v=d[1]+x*e,y=(f-m.x)*m.lx+(v-m.z)*m.lz}let T=y>=0,E=Math.abs(y),D=T?o:c,O=te(f,v,E,D);(r===0||r===wt)&&(O=j(f,v)-.9),I.push(f,O,v),fe.fill(0),pe.fill(0),me[0]=me[1]=0;let k=ft(D-.5,D+2.5,E);if(k<1){let e=Y((y+c)/(o+c),0,1);he(g,_,(1-e)*(1-k)),he(p,h,e*(1-k))}if(k>0&&he(f,v,k),oe.push(fe[0],fe[1],fe[2],fe[3]),H.push(pe[0],pe[1],pe[2],0),le.push(pt(Math.max(.85,me[0]),me[0],k),me[1],0,0),de.set(ee(f-2,v)-ee(f+2,v),4,ee(f,v-2)-ee(f,v+2)).normalize(),ie(f,v,W),de.lerp(W,k).normalize(),L.push(de.x,de.y,de.z),E<D+1){let e=me[1]>.55?4:fe[1]>.5?3:fe[0]>.5?2:fe[2]>.6?5:1,t=Math.round((f-n.x0)/n.cell),r=Math.round((v-n.z0)/n.cell);t>=0&&r>=0&&t<n.nx&&r<n.nz&&(ge[r*n.nx+t]=e)}let A=i>=0,M=Math.abs(i),N=A?o:c,P=f===l&&v===u?O:te(l,u,M,N),ne=(A?S[e]:C[e])+2.2,re=M/ne,F=a-3.4*Math.min(1,re*re)-(mt.fbm2(l/5,u/5,3)*.5+.5)*1.6-Math.max(0,mt.n2(l/1.7,u/1.7))*.5,z=pt(1.2,7,ft(s,s+6,t)),V=N+Dt;re>1&&(F=pt(F,Math.min(F,P-z),ft(1,V/ne,re))),F=Math.min(F,P-1.2),R.push(l,F,u),B.push(i,t)}}let _e=l*29,ve=(e,t)=>{let n=Y(Math.round((e-s)/Et),0,l-1),r=t>=0?T[n]+Dt:O[n]+Dt,i=Y(Math.round(Tt+t/r*Tt),0,wt);return R[(n*29+i)*3+1]},ye=[],be=[];for(let e=0;e<l-1;e++)for(let t=0;t<wt;t++){let n=e*29+t,r=n+1,i=n+wt+1,a=i+1;ue[n]&&ue[r]&&ue[i]&&ue[a]||ye.push(n,i,r,r,i,a);let o=(R[n*3]+R[a*3])*.5,s=(R[n*3+2]+R[a*3+2])*.5;Math.hypot(o-d[0],s-d[1])>=3.6999999999999997&&be.push(n,r,i,r,a,i)}for(let e of[0,l-1]){let t=I.length/3;X(i,u(e),m);let n=e===0?-1:1;for(let t=0;t<=wt;t++){let r=e*29+t;I.push(R[r*3],R[r*3+1],R[r*3+2]),I.push(I[r*3],I[r*3+1],I[r*3+2]),L.push(m.tx*n,.15,m.tz*n,m.tx*n,.35,m.tz*n),oe.push(0,0,.25,0,0,0,.15,0),H.push(0,0,0,0,0,0,0,0),le.push(.6,1,0,0,.85,1,0,0)}for(let n=0;n<wt;n++){let r=t+n*2,i=r+1,a=r+2,o=r+3;e===0?ye.push(r,i,a,a,i,o):ye.push(r,a,i,a,o,i)}}let xe=new M;xe.setAttribute(`position`,new a(I,3)),xe.setAttribute(`normal`,new a(L,3)),xe.setAttribute(`aSplatA`,new a(oe,4)),xe.setAttribute(`aSplatB`,new a(H,4)),xe.setAttribute(`aTer`,new a(le,4)),xe.setIndex(ye);{let e=xe.getAttribute(`normal`);for(let t=_e;t<e.count;t++)W.fromBufferAttribute(e,t).normalize(),e.setXYZ(t,W.x,W.y,W.z)}let Ce=R.slice(),we=B.slice(),Te=be.slice(),Ee=(e,t,n,r,i)=>(Ce.push(e,t,n),we.push(r,i),Ce.length/3-1);for(let e of[0,wt])for(let t=0;t<l-1;t++){let n=t*29+e,r=(t+1)*29+e,i=Ee(I[n*3],I[n*3+1],I[n*3+2],B[n*2],B[n*2+1]),a=Ee(I[r*3],I[r*3+1],I[r*3+2],B[r*2],B[r*2+1]);e===0?Te.push(n,i,r,r,i,a):Te.push(n,r,i,r,a,i)}let De=(e,t,n)=>{let r=e/36*Math.PI*2,i=t*(1+n*(.1*mt.n2(Math.cos(r)*1.7,Math.sin(r)*1.7)+.04*mt.n2(Math.cos(r)*5,Math.sin(r)*5+2)));return[d[0]+Math.cos(r)*i,d[1]+Math.sin(r)*i]},Oe=new M,ke=[];{let e=[],t=[],n=[],r=[],i=[];for(let i=0;i<Z.length;i++){let[a,o,s,c,l,u]=Z[i];for(let d=0;d<=36;d++){let[f,p]=De(d%36,a,i===0?0:1),m=P(f,p)-o;e.push(f,m,p),t.push(s,c,l,0),n.push(0,0,0,0),r.push(u,i===3?.4:0,i===3?.15:0,0),i===Z.length-1&&d<36&&ke.push([f,m,p])}}for(let e=0;e<Z.length-1;e++)for(let t=0;t<36;t++){let n=e*37+t,r=n+1,a=n+36+1,o=a+1;i.push(n,a,r,r,a,o)}Oe.setAttribute(`position`,new a(e,3)),Oe.setAttribute(`aSplatA`,new a(t,4)),Oe.setAttribute(`aSplatB`,new a(n,4)),Oe.setAttribute(`aTer`,new a(r,4)),Oe.setIndex(i),Oe.computeVertexNormals()}{let e=ve(f,0),t=Ce.length/3;for(let t=0;t<=6;t++){let n=t/6;for(let t=0;t<=36;t++){let[r,i,a]=ke[t%36],o=t/36*Math.PI*2,s=1+.9*n**5+.08*mt.n2(Math.cos(o)*2+n*4,Math.sin(o)*2),c=d[0]+(r-d[0])*s,l=d[1]+(a-d[1])*s;Ee(c,pt(i,e-.5,n),l,o*3,n*(i-e))}}for(let e=0;e<6;e++)for(let n=0;n<36;n++){let r=t+e*37+n,i=r+1,a=r+36+1,o=a+1;Te.push(r,i,a,i,o,a)}}let Ae=new M;Ae.setAttribute(`position`,new a(Ce,3)),Ae.setAttribute(`aWeave`,new a(we,2)),Ae.setIndex(Te),Ae.computeVertexNormals();let je=[];{let e=1/0,t=1/0,n=-1/0,a=-1/0;for(let r=0;r<l;r++){X(i,u(r),m);let o=Math.max(T[r],O[r])+5;e=Math.min(e,m.x-o),n=Math.max(n,m.x+o),t=Math.min(t,m.z-o),a=Math.max(a,m.z+o)}e=Math.floor(e/2)*2,t=Math.floor(t/2)*2;let o=Se(),d=0,f=0,p=0,h=!1,g=(e,t)=>{if(!r.index.query(e,t,o)||o.cap!==0||o.s<s||o.s>c)return!1;let n=k.rowOf(o.s),a=o.lat>=0?T[n]:O[n],l=Math.abs(o.lat);return l>a+4.5?!1:(d=re(e,t)??te(e,t,l,a),f=ve(o.s,o.lat)-.3,p=bt(i,r.floor,o.s)+3.5,h=d-j(e,t)>.3,!0)},_=(r,i)=>{let o=Math.ceil((n-e)/r)+1,s=Math.ceil((a-t)/r)+1,c=o*s,l=o+1,u=new Float32Array(l*(s+1)).fill(NaN),m=new Float32Array(l*(s+1)),_=new Uint8Array(l*(s+1)),v=new Float32Array(c),y=new Float32Array(c),b=new Float32Array(c),x=new Float32Array(c),S=new Float32Array(c),C=new Uint8Array(c),w=new Uint8Array(c),T=(n,i)=>{let a=i*l+n;return u[a]!==u[a]&&_[a]===0&&(_[a]=2,g(e+n*r,t+i*r)&&(u[a]=d,m[a]=f,_[a]=h?1:2)),a};for(let n=0;n<s;n++)for(let a=0;a<o;a++){if(!i(a,n))continue;let s=e+(a+.5)*r,c=t+(n+.5)*r;if(!g(s,c))continue;let l=d,E=d,D=f,O=f,k=h,A=p;for(let e of[T(a,n),T(a+1,n),T(a,n+1),T(a+1,n+1)]){let t=u[e];t===t&&(l=Math.min(l,t),E=Math.max(E,t),D=Math.min(D,m[e]),O=Math.max(O,m[e]),k||=_[e]===1)}if(!k)continue;E-l>2.4&&(E=l);let j=n*o+a;v[j]=l,y[j]=E,b[j]=D,x[j]=O,S[j]=A,C[j]=1,w[j]=re(s,c)===null?0:1}return{gc:r,nx:o,nz:s,n:c,tLo:v,tHi:y,cLo:b,cHi:x,floor:S,ok:C,lip:w}},v=(e,t,n,r,i,a,o)=>{let{nx:s,nz:c,ok:l}=e,u=new Uint8Array(e.n);for(let e=0;e<c;e++)for(let d=0;d<s;d++){let f=e*s+d;if(!l[f]||u[f])continue;let p=t[f],m=n[f],h=Math.max(r,m-p+i),g=e=>l[e]===1&&u[e]===0&&(!a||a[e]===a[f])&&Math.max(m,n[e])-Math.min(p,t[e])<=h,_=1;for(;d+_<s&&g(f+_);)p=Math.min(p,t[f+_]),m=Math.max(m,n[f+_]),_++;let v=1;rows:for(;e+v<c;){let r=p,i=m;for(let a=0;a<_;a++){let o=(e+v)*s+d+a;if(!g(o)||(r=Math.min(r,t[o]),i=Math.max(i,n[o]),i-r>h))break rows}p=r,m=i,v++}for(let t=0;t<v;t++)u.fill(1,(e+t)*s+d,(e+t)*s+d+_);o(d,e,_,v,p,m,f)}},y=(n,r,i,a,o,s,c,l)=>{let u=(c-s)/2;je.push(e+(r+a*.5)*n.gc,s+u,t+(i+o*.5)*n.gc,a*n.gc*.5+.02,u,o*n.gc*.5+.02,l)},b=(e,t)=>v(e,e.tLo,e.tHi,.24,t,e.lip,(t,n,r,i,a,o,s)=>{let c=(a+o)*.5;y(e,t,n,r,i,c-1,c,e.lip[s]?vt:_t)}),x=_(1,()=>!0),S=new Uint8Array(x.n);for(let e=0;e<x.n;e++)x.ok[e]&&x.tHi[e]-x.tLo[e]>.4&&(S[e]=1,x.ok[e]=0);b(x,.12),b(_(.5,(e,t)=>S[Math.min(x.nz-1,t>>1)*x.nx+Math.min(x.nx-1,e>>1)]===1),.06);for(let e=0;e<x.n;e++)S[e]&&(x.ok[e]=1);v(x,x.cLo,x.cHi,3.5,0,null,(e,t,n,r,i)=>{let a=-1/0;for(let i=0;i<r;i++)for(let r=0;r<n;r++)a=Math.max(a,x.floor[(t+i)*x.nx+e+r]);let o=Math.max(i,a);y(x,e,t,n,r,o,o+1.5,yt)})}let Me=[],Ne=(e,t,n,r,i=3)=>{let a=new p(1,i);a.deleteAttribute(`uv`),a.deleteAttribute(`normal`);let o=V(a),s=o.getAttribute(`position`),c=Math.min(e,t,n);for(let i=0;i<s.count;i++){let a=s.getX(i),o=s.getY(i),l=s.getZ(i),u=(a**4+o**4+l**4)**.25||1,d=a/u*e*.5,f=o/u*t*.5,p=l/u*n*.5,m=mt.fbm2(a*1.4+r,o*1.4+l*.8,3)*.16+mt.n2(a*3.7+r,l*3.7-o)*.04,h=Math.max(0,a*.62+o*.55+l*.3-.72-.2*Math.sin(r))*.5,g=1+m-h,_=c*m*.3;s.setXYZ(i,d*g+a/u*_,f*g+o/u*_,p*g+l/u*_)}return o.computeVertexNormals(),o},Pe=(e,t,n)=>{let r=1/0,i=-1/0;for(let[a,o]of[[0,0],[n,0],[-n,0],[0,n],[0,-n]]){let n=v(e+a,t+o);r=Math.min(r,n),i=Math.max(i,n)}return i-r>n*.9?null:r+(i-r)*.35},K={x:0,z:0,lx:1,lz:0,tx:0,tz:1,fl:0,a:1,b:1,midLat:0},Fe=new N,Ie=new N;{let t=s+.4;X(i,t,m);let n=bt(i,r.floor,t),a=bt(i,r.ceiling,t),c=b(t,1),l=b(t,-1),u=(c-l)*.5,d=(c+l)*.5+.4,f=a-n+.3;Object.assign(K,{x:m.x,z:m.z,lx:m.lx,lz:m.lz,tx:m.tx,tz:m.tz,fl:n,a:d,b:f,midLat:u}),Fe.set(m.x+m.lx*u,n+f*.45,m.z+m.lz*u);let p=new N(m.tx,0,m.tz),h=new N(m.lx,0,m.lz),g=new N(0,1,0),_=(e,t)=>{let r=u+d*Math.cos(e)*(1+.05*mt.n2(e*2,1.1)),i=n-.6+(f+.6)*Math.max(0,Math.sin(e))**.75;return t.set(m.x+m.lx*r,i,m.z+m.lz*r)},v=[[.1,6.2,3,4.6,1.3],[.62,5,2.6,4.2,1],[1.12,4.4,2.4,3.8,.85],[Math.PI/2,d*1.35+2.4,3.1,5,1.5],[Math.PI-1.1,4.6,2.5,3.9,.9],[Math.PI-.6,5.2,2.7,4.3,1.1],[Math.PI-.1,6,3.1,4.6,1.4]],y=new N,x=new N,S=new N,C=new N,w=new N,T=new E,D=new E;for(let t=0;t<v.length;t++){let[n,r,i,a,s]=v[t];_(n,y),_(n+.02,x),S.subVectors(x,y).normalize(),C.copy(h).multiplyScalar(S.dot(g)).addScaledVector(g,-S.dot(h)).normalize(),C.dot(Ie.subVectors(y,Fe))<0&&C.negate();let c=Ne(r*o.range(.92,1.08),i,a,t*7.1+3);w.copy(p),Ie.crossVectors(S,C).dot(w)<0&&w.negate(),T.makeBasis(S,C,w),D.makeRotationFromEuler(new e(o.range(-.08,.08),o.range(-.1,.1),o.range(-.06,.06))),T.multiply(D),T.setPosition(y.x+C.x*i*.42-p.x*(s-a*.5),y.y+C.y*i*.42,y.z+C.z*i*.42-p.z*(s-a*.5)),c.applyMatrix4(T),Me.push({g:c,rim:!0})}let O=0;for(let e=0;e<30&&O<6;e++){let t=u+(e%2?1:-1)*(d+o.range(3,10)),n=o.range(.9,2.1),r=o.range(2,16),i=m.x+m.lx*t-m.tx*r,a=m.z+m.lz*t-m.tz*r,s=Pe(i,a,n);if(s===null)continue;let c=Ne(n*o.range(1.6,2.4),n*o.range(.9,1.3),n*o.range(1.4,2),o.range(0,50),2);c.rotateY(o.range(0,6.28)),c.translate(i,s+n*.2,a),Me.push({g:c,rim:!1}),O++}}{let e=c+8;X(i,e,m);for(let t of[1,-1]){let n=t*(b(e,t)+1.5),r=m.x+m.lx*n,i=m.z+m.lz*n,a=Pe(r,i,2.5)??v(r,i)-.6,s=Ne(o.range(4.5,6),o.range(2.6,3.6),o.range(4.2,5.4),o.range(0,50));s.rotateY(o.range(0,6.28)),s.translate(r,a+.5,i),Me.push({g:s,rim:!1})}}let Le;{let e=se(Me.map(e=>e.g)),t=e.getAttribute(`position`).count,n=e.getAttribute(`position`),r=e.getAttribute(`normal`),i=new Float32Array(t*4),o=new Float32Array(t*4),s=0,c=new N,l=new N;for(let e of Me){let t=e.g.getAttribute(`position`).count;for(let a=0;a<t;a++,s++){c.fromBufferAttribute(r,s),l.fromBufferAttribute(n,s),i[s*4+1]=ft(.45,.85,c.y)*(e.rim?.7:.55);let t=.95;if(e.rim){Ie.subVectors(Fe,l).normalize();let e=Math.max(0,c.dot(Ie)),n=Math.max(0,c.x*K.tx+c.z*K.tz),r=Y(((l.x-K.x)*K.tx+(l.z-K.z)*K.tz)/3,0,1);t=Y(.95-.5*e-.35*n-.3*r,.2,1)}o[s*4]=t,o[s*4+1]=1,o[s*4+2]=e.rim?.1:0}}e.setAttribute(`aSplatA`,new a(i,4)),e.setAttribute(`aSplatB`,new a(new Float32Array(t*4),4)),e.setAttribute(`aTer`,new a(o,4)),Le=se([e,Oe])}let Re=[];for(let e=s+12;e<c-3;e+=o.range(6,11)){let t=o.sign();X(i,e,m);let n=b(e,t),r=m.x+m.lx*(n-.4)*t,a=m.z+m.lz*(n-.4)*t;Re.push({x:r,y:v(r,a),z:a,nx:-m.lx*t,nz:-m.lz*t,size:o.range(.7,1.3),hue:o.next()})}for(let e=s+10;e<c-6;e+=o.range(9,16)){let t=o.sign();X(i,e,m);let n=b(e,t),a=bt(i,r.floor,e),s=bt(i,r.ceiling,e),c=a+o.range(5,Math.max(6,(s-a)*.55)),l=(n+.6)*t;Re.push({x:m.x+m.lx*l,y:c,z:m.z+m.lz*l,nx:-m.lx*t,nz:-m.lz*t,size:o.range(.6,1.1),hue:o.next()})}for(let e=0;e<7;e++){let t=e/7*Math.PI*2+o.range(-.3,.3),n=o.range(10,13.5),r=d[0]+Math.cos(t)*n,i=d[1]+Math.sin(t)*n;Re.push({x:r,y:v(r,i),z:i,nx:-Math.cos(t),nz:-Math.sin(t),size:e===2?2.4:o.range(.9,1.6),hue:o.next()})}let ze=Ct.high.crystals,Be=new Float32Array(Re.length*ze*16),Ve=new Float32Array(Re.length*ze*3),He={low:0,medium:0,high:0};{let t=new w,n=new e,r=new N,i=new N,a=new D,s=new N(0,1,0),c=new N,l=new w,u=Re.map(()=>[]),d=Re.map(()=>[]);Re.forEach((e,f)=>{for(let p=0;p<ze;p++){c.set(e.nx*o.range(.3,.9)+o.range(-.45,.45),o.range(.5,1.1),e.nz*o.range(.3,.9)+o.range(-.45,.45)).normalize(),t.setFromUnitVectors(s,c),n.set(0,o.range(0,Math.PI),0),t.multiply(l.setFromEuler(n));let m=e.size*(p===0?o.range(2.2,3.2):o.range(.7,2.1)),h=o.range(.9,1.5)*(.6+.4*m);r.set(h,m,h),i.set(e.x+o.range(-.6,.6)*e.size,e.y-.25,e.z+o.range(-.6,.6)*e.size),u[f].push(new E().compose(i,t,r));let g=e.hue<.6?.47+o.range(-.02,.03):e.hue<.85?.41+o.range(-.02,.02):.54+o.range(-.02,.02);d[f].push(a.clone().setHSL(g,.8,o.range(.44,.6)))}});let f=0;for(let e=0;e<ze;e++){for(let t=0;t<Re.length;t++)u[t][e].toArray(Be,f*16),d[t][e].toArray(Ve,f*3),f++;for(let t of[`low`,`medium`,`high`])e+1===Ct[t].crystals&&(He[t]=f)}}let Ue=Ne(2,1.5,2,3.3,2),We=[];{let t=Ue.getAttribute(`position`).count,n=new Float32Array(t*4),r=new Float32Array(t*4),a=new Float32Array(t*4),l=Ue.getAttribute(`normal`);for(let e=0;e<t;e++)r[e*4+3]=pt(.6,.25,ft(-.2,.7,l.getY(e))),a[e*4]=.8+.2*Math.max(0,l.getY(e)),a[e*4+1]=1,a[e*4+2]=.2;Ue.setAttribute(`aSplatA`,new A(n,4)),Ue.setAttribute(`aSplatB`,new A(r,4)),Ue.setAttribute(`aTer`,new A(a,4));let u=new w,f=new e,p=new N,h=new N;for(let e=s+3;e<c-2;e+=o.range(3.5,7)){X(i,e,m);for(let t of[1,-1]){if(o.chance(.3))continue;let n=o.range(.9,2.2),r=t*(b(e,t)-n*o.range(.1,.5)),i=m.x+m.lx*r+m.tx*o.range(-1,1),a=m.z+m.lz*r+m.tz*o.range(-1,1);Math.hypot(i-d[0],a-d[1])<9||(h.set(i,v(i,a)+n*.25,a),f.set(o.range(-.3,.3),o.range(0,6.28),o.range(-.3,.3)),u.setFromEuler(f),p.set(n*o.range(.55,.85),n*o.range(.5,.8),n*o.range(.5,.75)),We.push(new E().compose(h,u,p)))}}for(let e=0;e<70;e++){let e=o.range(s+4,c-3),t=o.sign();X(i,e,m);let n=b(e,t),r=t*o.range(n*.5,n*.95),a=m.x+m.lx*r,l=m.z+m.lz*r;if(Math.hypot(a-d[0],l-d[1])<10)continue;let g=o.range(.35,1.3);h.set(a,v(a,l)+g*.15,l),f.set(o.range(-.4,.4),o.range(0,6.28),o.range(-.4,.4)),u.setFromEuler(f),p.set(g*o.range(.5,.8),g*.5,g*o.range(.5,.75)),We.push(new E().compose(h,u,p))}}let Ge=new Float32Array(We.length*16);We.forEach((e,t)=>e.toArray(Ge,t*16));let Ke=[],qe=(e,t,n,r,i=5)=>{let s=e.length-1,c=[],l=[],u=[],d=new N,f=new N,p=new N,m=new N(0,0,1),h=o.range(0,6.28);for(let a=0;a<=s;a++){let o=e[a];d.subVectors(e[Math.min(s,a+1)],e[Math.max(0,a-1)]).normalize(),Math.abs(d.dot(m))>.9&&m.set(1,0,0),f.crossVectors(d,m).normalize(),p.crossVectors(d,f);let u=(t+(n-t)*(a/s))*(1+.18*Math.sin(a*1.9+h));for(let e=0;e<i;e++){let t=e/i*Math.PI*2;c.push(o.x+(f.x*Math.cos(t)+p.x*Math.sin(t))*u,o.y+(f.y*Math.cos(t)+p.y*Math.sin(t))*u,o.z+(f.z*Math.cos(t)+p.z*Math.sin(t))*u),l.push(r?(a/s)**1.5:0,h)}}for(let e=0;e<s;e++)for(let t=0;t<i;t++){let n=e*i+t,r=e*i+(t+1)%i,a=n+i,o=r+i;u.push(n,a,r,r,a,o)}let g=new M;g.setAttribute(`position`,new a(c,3)),g.setAttribute(`aSway`,new a(l,2));let _=c.length/3,v=new Float32Array(_*3),y=o.range(.82,1.12);for(let e=0;e<_;e++){let t=(.75+.25*Math.sin(Math.PI*Math.floor(e/i)/Math.max(1,s)))*y;v[e*3]=ht.r*t,v[e*3+1]=ht.g*t,v[e*3+2]=ht.b*t}g.setAttribute(`color`,new A(v,3)),g.setAttribute(`aRough`,new a(new Float32Array(_).fill(.9),1)),g.setIndex(u),g.computeVertexNormals(),Ke.push(g)};for(let e=s+10;e<c-4;e+=o.range(4.5,7.5))for(let t of[1,-1]){let n=b(e,1)+1.5,r=b(e,-1)+1.5,a=[];for(let s=0;s<=14;s++){let c=s/14,l=pt(n,-r,c),u=e+t*(c-.5)*7;X(i,u,m);let d=Math.sin(c*Math.PI)*o.range(.6,1.4)+Math.sin(c*Math.PI*5+(t>0?0:Math.PI))*.35;a.push(new N(m.x+m.lx*l,ve(u,l)-.35-d,m.z+m.lz*l))}qe(a,o.range(.22,.38),o.range(.16,.28),!1)}{let e=ne-.2;for(let t=0;t<7;t++){let n=t/7*Math.PI+o.range(-.25,.25),r=n+Math.PI+o.range(-.5,.5),i=o.range(-.9,.9),a=[],s=o.range(.25,.7);for(let o=0;o<=12;o++){let c=o/12,l=4.5,u=pt(n,r,c),f=pt(Math.cos(n)*l,Math.cos(r)*l,c)+Math.cos(u+Math.PI/2)*i*Math.sin(c*Math.PI),p=pt(Math.sin(n)*l,Math.sin(r)*l,c)+Math.sin(u+Math.PI/2)*i*Math.sin(c*Math.PI),m=ft(3.1999999999999997,4.5,Math.hypot(f,p))*.45;a.push(new N(d[0]+f,e-s*Math.sin(c*Math.PI)-m+Math.sin(c*9+t)*.06,d[1]+p))}qe(a,o.range(.13,.24),o.range(.08,.14),!1,6)}for(let[t,n]of[[1.35,1.1],[2.35,.9]]){let r=[],i=o.range(0,6.28);for(let a=0;a<=40;a++){let s=a/40,c=i+s*Math.PI*2*n,l=t+.25*Math.sin(s*13)+o.range(-.05,.05);r.push(new N(d[0]+Math.cos(c)*l,e-.28*(1-(l-1)/2.5)+.11*Math.sin(c*7),d[1]+Math.sin(c)*l))}qe(r,.1,.07,!1,5)}}for(let e=0;e<16;e++){let e=o.range(-.8,.8),t=Math.acos(e),n=K.midLat+K.a*e,r=K.fl-.6+(K.b+.6)*Math.sin(t)**.75+.6,i=o.range(.9,2.2),a=K.x+K.lx*n-K.tx*i,s=K.z+K.lz*n-K.tz*i,c=Math.min(r-(K.fl+3.4),o.range(1.8,6.5));if(c<1)continue;let l=[],u=o.range(-.6,.6);for(let e=0;e<=7;e++){let t=e/7;l.push(new N(a+K.lx*u*t*t-K.tx*.5*Math.sin(t*3),r+.8-(c+.8)*t,s+K.lz*u*t*t-K.tz*.5*Math.sin(t*3)))}qe(l,o.range(.08,.17),.02,!0)}let Je=Ke.length;for(let e=0;e<Ct.high.strands*3&&Ke.length-Je<Ct.high.strands;e++){let e=o.range(s+8,c-2),t=o.sign(),n=t*o.range(0,b(e,t)*.9);X(i,e,m);let r=m.x+m.lx*n,a=m.z+m.lz*n,l=ve(e,n)-.2,u=v(r,a),d=Math.min((l-u)*o.range(.15,.55),o.range(3,17));if(d<1.5)continue;let f=[],p=o.range(-1,1),h=o.range(-1,1);for(let e=0;e<=8;e++){let t=e/8;f.push(new N(r+p*t*t*1.2,l-d*t,a+h*t*t*1.2))}qe(f,o.range(.1,.2),.025,!0)}let Ye=se(Ke),Xe={low:0,medium:0,high:0};{let e=0;for(let t=0;t<Ke.length;t++){e+=Ke[t].index.count;for(let n of[`low`,`medium`,`high`])t<Je+Ct[n].strands&&(Xe[n]=e)}}let Ze=[],Qe=(e,t,n,r,i,s)=>{let c=[];for(let t=0;t<=9;t++){let n=t/9,a=i*((1-n)**1.25*(1+.16*Math.sin(n*17+e))+.35*(1-n)**6)+.015;c.push(new y(a,n*r))}let l=new g(c,9);l.deleteAttribute(`uv`);let u=l.getAttribute(`position`),d=new Float32Array(u.count*3),f=o.range(0,1);for(let t=0;t<u.count;t++){let i=u.getX(t),a=u.getY(t),o=u.getZ(t),s=1+mt.n2(i*3+e,a*2+n)*.14;u.setXYZ(t,i*s,a,o*s);let c=(.24+a/r*.3)*(.86+.14*Math.sin(a*9+e));d[t*3]=c*(.62+.14*f),d[t*3+1]=c*(.56+.08*f),d[t*3+2]=c*.5}l.setAttribute(`color`,new A(d,3)),s&&l.rotateX(Math.PI),l.translate(e,t,n),l.computeVertexNormals();let p=l.getAttribute(`normal`);for(let e=0;e<u.count;e++){let t=.62+.22*(p.getY(e)*.5+.5)+.3*Math.max(0,p.getX(e)*.6+p.getZ(e)*.8);d[e*3]*=t,d[e*3+1]*=t,d[e*3+2]*=t}l.setAttribute(`aSway`,new a(new Float32Array(u.count*2),2)),l.setAttribute(`aRough`,new a(new Float32Array(u.count).fill(.42),1)),Ze.push(l)};for(let e=0;e<46;e++){{let e=o.range(s+6,c-3),t=o.sign(),n=b(e,t),r=t*o.range(n*.45,n*.95);X(i,e,m);let a=m.x+m.lx*r,l=m.z+m.lz*r;if(Math.hypot(a-d[0],l-d[1])>=9.5){let e=o.range(.8,4.2);Qe(a,v(a,l)-.2,l,e,e*o.range(.16,.26),!1),o.chance(.3)&&Qe(a+o.range(-.8,.8),v(a,l)-.2,l+o.range(-.8,.8),e*.5,e*.12,!1)}}if(e<40){let e=o.range(s+6,c-3),t=o.sign(),n=t*o.range(0,b(e,t));X(i,e,m);let r=m.x+m.lx*n,a=m.z+m.lz*n,l=o.range(1.2,5);Qe(r,ve(e,n)+.3,a,l,l*o.range(.1,.18),!0)}}let $e=se(Ze),et={low:0,medium:0,high:0};{let e=Ze[0].index.count;for(let t of[`low`,`medium`,`high`])et[t]=Math.round(Ze.length*Ct[t].spikes)*e}let tt=new Float32Array(Re.length*4);return Re.forEach((e,t)=>tt.set([e.x,e.y,e.z,e.size],t*4)),{version:3,rimL:T,rimR:O,top:xt(xe),under:xt(Ae),arch:xt(Le),slabBase:xt(Ue),roots:xt(Ye),spikes:xt($e),crystalMatrices:Be,crystalColors:Ve,crystalCount:He,crystalSpots:tt,slabMatrices:Ge,rootDraw:Xe,spikeDraw:et,boxes:Float32Array.from(je),roofKind:ge}}function Mt(e,r,i,a,o,s){let c=new n;c.name=`hollow-deep`;let l=r.prep.cave,u=At(r,l,i.rimL,i.rimR),{s0:d,s1:f,skyC:p,groundAt:m,skyFloor:g,roofY:_,skyTop:y}=u,b=r.heights,C=r.precarve,w=dt(a,`mesh`,null).material,T=new P(St(i.top),w);T.name=`hollow-roof-top`,T.castShadow=!0,T.receiveShadow=!0,c.add(T);let E=new P(St(i.under),Nt(a.noise));E.name=`hollow-roof-ceiling`,E.castShadow=!0,E.receiveShadow=!0,c.add(E);let D=new P(St(i.arch),w);D.name=`hollow-arch`,D.castShadow=!0,D.receiveShadow=!0,c.add(D);let O=i.boxes;for(let t=0;t<O.length;t+=7){let n=O[t+6];e.physics.add({kind:`box`,x:O[t],y:O[t+1],z:O[t+2],hx:O[t+3],hy:O[t+4],hz:O[t+5],yaw:0,walkable:n!==yt,surface:n===vt?`moss`:`grass`,tag:`cave-roof`})}let k=(()=>{let e=new v(.085,.1,.78,6,1);e.translate(0,.39,0);let t=new x(.085,.22,6,1);t.translate(0,.89,0);let n=se([e.toNonIndexed(),t.toNonIndexed()]);return n.computeVertexNormals(),n})(),A=new S({color:797228,emissive:16777215,roughness:.12,metalness:.1,flatShading:!0}),j={value:1};A.onBeforeCompile=e=>{e.uniforms.uGlowPulse=j,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying float vCrystT;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vCrystT = clamp( position.y, 0.0, 1.0 );`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform float uGlowPulse;
varying float vCrystT;`).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
      float rimC = 1.0 - abs( dot( normal, normalize( vViewPosition ) ) );
      float glowC = ( 0.14 + 0.8 * pow( vCrystT, 1.6 ) + 0.34 * rimC * rimC ) * uGlowPulse;
      #ifdef USE_INSTANCING_COLOR
        totalEmissiveRadiance = vColor.rgb * glowC;
      #else
        totalEmissiveRadiance = vec3( 0.37, 0.9, 0.84 ) * glowC;
      #endif`)},A.customProgramCacheKey=()=>`mender-cave-crystal-v2`;let te=i.crystalMatrices.length/16,M=new ee(k,A,te);M.name=`hollow-crystals`,M.instanceMatrix.array.set(i.crystalMatrices),M.instanceColor=new h(i.crystalColors.slice(),3),M.instanceMatrix.needsUpdate=!0,M.computeBoundingSphere(),c.add(M);{let e=r.extra,t=i.crystalSpots;for(let n=0;n<t.length;n+=4){let r=t[n],i=t[n+1],a=t[n+2],o=t[n+3],s=4.5+o*2.8,c=Math.floor((r-s+G)/2),l=Math.ceil((r+s+G)/2),u=Math.floor((a-s+G)/2),d=Math.ceil((a+s+G)/2);for(let t=u;t<=d;t++)for(let n=c;n<=l;n++){if(n<0||t<0||n>=U||t>=U)continue;let c=t*U+n;if(C[c]-b[c]<2.5)continue;let l=1-ft(1.5,7,b[c]-i);if(l<=0)continue;let u=Math.hypot(-G+n*2-r,-G+t*2-a);if(u>s)continue;let d=c*4+1,f=(1-u/s)**2*125*l*Math.min(1.2,.5+o*.5);e[d]=Math.min(255,Math.max(e[d],Math.round(f))+Math.round(f*.2))}}a.extra.needsUpdate=!0}let ne=new ee(St(i.slabBase),dt(a,`mesh`,null).material,i.slabMatrices.length/16);ne.instanceMatrix.array.set(i.slabMatrices),ne.instanceMatrix.needsUpdate=!0,ne.computeBoundingSphere(),ne.name=`hollow-breakdown`,ne.castShadow=!0,ne.receiveShadow=!0,c.add(ne);let re=new S({color:16777215,vertexColors:!0,roughness:1,metalness:0});re.name=`hollow-props`,re.onBeforeCompile=e=>{e.uniforms.uTime=B.uTime,e.uniforms.uCave=B.uCave,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uTime;
attribute vec2 aSway;
attribute float aRough;
varying float vRough;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vRough = aRough;
transformed.xz += vec2( sin( uTime * 0.6 + aSway.y ), cos( uTime * 0.47 + aSway.y * 1.3 ) ) * 0.22 * aSway.x;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>\nuniform float uCave;\nvarying float vRough;\n${at}`).replace(`#include <roughnessmap_fragment>`,`float roughnessFactor = vRough;`).replace(`#include <aomap_fragment>`,`caveIndirect( reflectedLight, material.diffuseColor, 1.0 );`)},re.customProgramCacheKey=()=>`mender-cave-props-v1`;let F=St(i.roots),ie=new P(F,re);ie.name=`hollow-roots`,ie.castShadow=!1,ie.receiveShadow=!0,c.add(ie);let ae=St(i.spikes),I=new P(ae,re);I.name=`hollow-spikes`,I.receiveShadow=!0,c.add(I);let L=y,R=L-(m(p[0],p[1])-.5),z=new v(1,1,1,24,8,!0);z.translate(0,-.5,0);let oe=new t({uniforms:{uTime:B.uTime,uNight:B.uNight,uSunDir:B.uSunDir,uHole:{value:new N(p[0],L,p[1])},uH:{value:R},uR:{value:Ot}},transparent:!0,depthWrite:!1,blending:2,side:2,vertexShader:`
      uniform vec3 uSunDir, uHole; uniform float uH, uR;
      varying vec3 vW; varying float vT; varying vec2 vRing;
      void main() {
        vec3 d = -uSunDir / max( 0.3, uSunDir.y );          // one metre of drop along the shaft
        float t = -position.y;                               // 0 at the hole → 1 at the floor
        float r = uR * ( 0.85 + 0.9 * t );
        vec3 w = uHole + vec3( position.x * r, 0.0, position.z * r ) + d * t * uH;
        vW = w; vT = t; vRing = position.xz;
        gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
      }`,fragmentShader:`
      uniform float uTime, uNight; uniform vec3 uSunDir;
      varying vec3 vW; varying float vT; varying vec2 vRing;
      float h21( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
      float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + vec2( 1, 1 ) ), f.x ), f.y ); }
      void main() {
        // soft cylinder: brightest through the core as seen from the camera
        vec3 axis = normalize( -uSunDir );
        vec3 toCam = normalize( cameraPosition - vW );
        float core = 1.0 - abs( dot( normalize( cross( axis, toCam ) ), normalize( vec3( vRing.x, 0.0, vRing.y ) ) ) );
        float fade = smoothstep( 0.0, 0.1, vT ) * ( 1.0 - smoothstep( 0.6, 1.0, vT ) );
        float motes = vn( vRing * 2.6 + vec2( 0.0, vT * 9.0 - uTime * 0.3 ) ) * 0.55 + 0.45;
        float sunUp = smoothstep( 0.25, 0.55, uSunDir.y ) * ( 1.0 - uNight );
        float a = core * core * fade * motes * 0.035 * sunUp;
        gl_FragColor = vec4( vec3( 1.0, 0.92, 0.72 ) * a, 1.0 );
      }`}),V=new P(z,oe);V.name=`hollow-sunbeam`,V.frustumCulled=!1,V.renderOrder=5,c.add(V);let ce=e.lights?.acquire({position:new N(p[0],m(p[0],p[1])+6,p[1]),color:7328454,intensity:0,distance:38,decay:1.6,priority:1}),H=e=>{M.count=i.crystalCount[e],F.setDrawRange(0,i.rootDraw[e]),ae.setDrawRange(0,i.spikeDraw[e])};H(s);let le=Se(),ue=new N(p[0],30,p[1]),W=new N;return{group:c,roofTopAt(e,t){if(e<o.x0||t<o.z0||e>o.x0+o.nx*o.cell||t>o.z0+o.nz*o.cell||!l.index.query(e,t,le)||le.cap!==0||le.s<d||le.s>f)return null;let n=u.rowOf(le.s),r=le.lat>=0?i.rimL[n]:i.rimR[n],a=Math.abs(le.lat);return a>r+Dt-.5||Math.hypot(e-p[0],t-p[1])<Z[2][0]?null:g(e,t)??_(e,t,a,r)},roofSurfaceAt(e,t){let n=Math.round((e-o.x0)/o.cell),r=Math.round((t-o.z0)/o.cell);if(n<0||r<0||n>=o.nx||r>=o.nz)return null;let a=Math.hypot(e-p[0],t-p[1]);if(a<Z[2][0])return`cave`;if(a<Z[0][0])return`moss`;let s=i.roofKind[r*o.nx+n];return s?gt[s]:null},update(e){W.setFromMatrixPosition(e.matrixWorld);let t=1-ft(70,120,W.distanceTo(ue));ce&&(ce.intensity=t>0?22*t*(.93+.07*Math.sin(B.uTime.value*1.3)):0),j.value=.9+.12*Math.sin(B.uTime.value*.8)},setQuality:H,get lights(){return+!!ce?.assigned},get crystals(){return M.count},roofBoxes:O.length/7}}function Nt(e){let t=new S({color:16777215,roughness:.85,metalness:0,side:2});return t.onBeforeCompile=t=>{t.uniforms.tNoise={value:e},t.uniforms.uTime=B.uTime,t.uniforms.uCave=B.uCave,t.vertexShader=t.vertexShader.replace(`#include <common>`,`#include <common>
attribute vec2 aWeave;
varying vec2 vWeave;
varying vec3 vCW;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vWeave = aWeave;
vCW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,`#include <common>\nuniform sampler2D tNoise;\nuniform float uTime;\nuniform float uCave;\nvarying vec2 vWeave;\nvarying vec3 vCW;\n${at}`).replace(`#include <color_fragment>`,`
        vec4 cn = texture( tNoise, vCW.xz * ( 1.0 / 9.0 ) ) * 0.6 + texture( tNoise, vCW.xy * ( 1.0 / 5.0 ) + 0.3 ) * 0.4;
        vec3 rockC = mix( vec3( 0.16, 0.15, 0.14 ), vec3( 0.28, 0.26, 0.23 ), cn.r ) * ( 0.8 + 0.4 * cn.b );
        // two diagonal families of roots, over / under
        vec2 w = vWeave;
        float d1 = abs( fract( ( w.x + w.y ) / 4.2 ) - 0.5 );
        float d2 = abs( fract( ( w.x - w.y ) / 4.2 ) - 0.5 );
        float r1 = smoothstep( 0.2, 0.08, d1 ), r2 = smoothstep( 0.2, 0.08, d2 );
        float over = step( 0.5, fract( ( w.x - w.y ) / 8.4 ) );
        float root = max( r1 * mix( 1.0, 0.55, over * r2 ), r2 * mix( 0.55, 1.0, over ) );
        root *= smoothstep( 0.25, 0.55, cn.g + 0.3 );
        vec3 rootC = mix( vec3( 0.24, 0.16, 0.09 ), vec3( 0.38, 0.27, 0.15 ), cn.a );
        diffuseColor.rgb = mix( rockC, rootC, root );
        float cBump = root * 0.6 + cn.b * 0.3;`).replace(`#include <normal_fragment_maps>`,`
        {
          vec3 dpx = dFdx( -vViewPosition ), dpy = dFdy( -vViewPosition );
          float dhx = dFdx( cBump ), dhy = dFdy( cBump );
          vec3 r1v = cross( dpy, normal ), r2v = cross( normal, dpx );
          float det = dot( dpx, r1v );
          normal = normalize( abs( det ) * normal - sign( det ) * ( dhx * r1v + dhy * r2v ) );
        }`).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
        // glowworms: pin-points of cold light clustered in the root weave, slowly breathing
        vec4 gw = texture( tNoise, vCW.xz * ( 1.0 / 3.1 ) + vCW.y * 0.013 );
        float worm = smoothstep( 0.88, 0.96, gw.g ) * ( 0.4 + 0.6 * root ) * smoothstep( 0.2, 0.6, cn.r );
        float breathe = 0.7 + 0.3 * sin( uTime * 0.9 + gw.r * 25.0 );
        totalEmissiveRadiance += vec3( 0.35, 0.95, 0.9 ) * worm * breathe * 2.6;`).replace(`#include <aomap_fragment>`,`caveIndirect( reflectedLight, material.diffuseColor, 1.0 );`)},t.customProgramCacheKey=()=>`mender-cave-ceiling-v3`,t}var Pt=new H(`vale-backdrop`),Q=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function Ft(e,t,n=1){let r=[];for(let e=G,t=24*n;e<4600;e+=t,t=Math.min((e-G<3200?110:190)*n,t*1.09))r.push(e);let i=[],a=Math.round(32*n/8)*8;for(let e=-G+a;e<G;e+=a)i.push(e);let o=[...r.slice().reverse().map(e=>-e),...i,...r],s=o.length,c=new Float32Array(s*s*3);for(let e=0;e<s;e++)for(let n=0;n<s;n++){let r=o[n],i=o[e],a=(e*s+n)*3;c[a]=r,c[a+2]=i;let l=t(Math.max(-G,Math.min(G,r)),Math.max(-G,Math.min(G,i)))-3,u=Math.max(Math.abs(r),Math.abs(i))-G;if(u<=.5){c[a+1]=l;continue}let d=Pt.fbm2(r/1800,i/1800,2)*420,f=Pt.ridged2((r+d)/820,(i-d)/820,5)**(2-.5*Q(1400,1800,u)),p=.5+.5*Pt.fbm2(r/1500+3,i/1500,3),m=Q(-650,-1150,i),h=m*Math.exp(-((r-60+(i+1300)*.07)**2)/36100),g=(190+((140+120*m)*Q(250,1300,u)+(90+90*m)*Q(1600,3e3,u))+(330+130*m)*f*p)*(1-.36*h);g*=1-Q(3e3,4500,u)*.45;let _=Q(250,760,i);g=g*(1-_)-30*_;let v=Q(0,420,u),y=(1-_)*60*Q(0,160,u)*(1-Q(160,700,u));c[a+1]=l+(Math.max(g,l*(1-_)-30*_)-l)*v-y}let l=new Float32Array(s*s);for(let e=0;e<s*s;e++)l[e]=c[e*3+1];for(let e=0;e<s;e++)for(let t=0;t<s;t++){let n=o[t],r=o[e];if(Math.max(Math.abs(n),Math.abs(r))-G<=.5)continue;let i=e*s+t,a=l[i];t>0&&t<s-1&&(a=Math.min(a,(l[i-1]+l[i+1])*.5+.45*(o[t+1]-o[t-1]))),e>0&&e<s-1&&(a=Math.min(a,(l[i-s]+l[i+s])*.5+.45*(o[e+1]-o[e-1]))),c[i*3+1]=a}let u=[];for(let e=0;e<s-1;e++)for(let t=0;t<s-1;t++){let n=o[t],r=o[t+1],i=o[e],a=o[e+1];if(n>=-G&&r<=G&&i>=-G&&a<=G)continue;let c=e*s+t,l=c+1,d=c+s,f=d+1;u.push(c,d,f,c,f,l)}let d=new M;d.setAttribute(`position`,new A(c,3)),d.setIndex(u),d.computeVertexNormals();let f=d.getAttribute(`normal`),p=s*s,m=new Float32Array(p*4),h=new Float32Array(p*4),g=new Float32Array(p*4);for(let e=0;e<p;e++){let t=f.getY(e),n=c[e*3+1];m[e*4+1]=.9*(1-Q(220,320,n))*Q(20,60,n)*Q(.72,.86,t),h[e*4+2]=1,g[e*4]=.9,g[e*4+1]=Math.max(Q(.95,.78,t),Q(250,330,n)*.9)}d.setAttribute(`aSplatA`,new A(m,4)),d.setAttribute(`aSplatB`,new A(h,4)),d.setAttribute(`aTer`,new A(g,4)),d.computeBoundingSphere();let _=dt(e,`mesh`,null);_.uniforms.uSnowLine.value=440,_.uniforms.uSnowBand.value.set(-60,80),_.uniforms.uSnowSlope.value.set(.42,.6),_.uniforms.uRockScale.value=6,_.uniforms.cGranite={value:new D(8094868)},_.uniforms.cGranite2={value:new D(6120820)},_.uniforms.cForest={value:new D(2441003)},_.uniforms.cForest2={value:new D(2898472)};let v=new D(11124700);_.uniforms.uHaze.value.set(v.r,v.g,v.b,.5);let y=new P(d,_.material);return y.name=`terrain-backdrop`,y.receiveShadow=!1,y.castShadow=!1,y.matrixAutoUpdate=!1,y}var It=e=>e<0?0:e>1?1:e,$=(e,t,n)=>{let r=It((n-e)/(t-e));return r*r*(3-2*r)},Lt=e=>e-Math.floor(e);function Rt(e,t){let n=Lt(e*.1031),r=Lt(t*.103),i=Lt(e*.0973),a=n*(r+33.33)+r*(i+33.33)+i*(n+33.33);return n+=a,r+=a,i+=a,Lt((n+r)*i)}var zt=(e,t,n)=>(e.r+=(t.r-e.r)*n,e.g+=(t.g-e.g)*n,e.b+=(t.b-e.b)*n,e);function Bt(e){let t=e.noise,n=[0,0,0,0],r=(e,r)=>{let i=(e-Math.floor(e))*256-.5,a=(r-Math.floor(r))*256-.5,o=Math.floor(i),s=Math.floor(a),c=i-o,l=a-s,u=(o%256+256)%256,d=(u+1)%256,f=(s%256+256)%256,p=(f+1)%256;for(let e=0;e<4;e++){let r=t[(f*256+u)*4+e],i=t[(f*256+d)*4+e],a=t[(p*256+u)*4+e],o=t[(p*256+d)*4+e];n[e]=((r+(i-r)*c)*(1-l)+(a+(o-a)*c)*l)/255}return n},i=(e,t,n,r)=>{let i=Math.min(U-1.001,Math.max(0,(t+G)/2)),a=Math.min(U-1.001,Math.max(0,(n+G)/2)),o=Math.floor(i),s=Math.floor(a),c=i-o,l=a-s,u=(s*U+o)*4+r;return((e[u]*(1-c)+e[u+4]*c)*(1-l)+(e[u+U*4]*(1-c)+e[u+U*4+4]*c)*l)/255},a=new D,o=new D,s=[0,1,0];return function(t,n,c=new D){let l=r(t/700,n/700),u=l[0],d=l[1],f=l[2],p=r(t/150+.31,n/150+.31),m=p[0],h=p[1],g=p[2],_=p[3],v=r(t/29+.57,n/29+.57),y=v[0],b=v[1],x=v[2],S=r(t/97+.43,n/97+.19),C=S[1],w=S[2],T=i(e.splatA,t,n,0),E=i(e.splatA,t,n,1),O=i(e.splatA,t,n,2),k=i(e.splatA,t,n,3),A=i(e.splatB,t,n,0),j=i(e.splatB,t,n,1),ee=i(e.splatB,t,n,2),te=i(e.splatB,t,n,3),M=i(e.normal,t,n,3),N=i(e.normal,t,n,2),P=i(e.extra,t,n,0),ne=$(.56,.74,w*.7+f*.3)*$(.55,.85,N),re=It($(.93,.72,N)*.8+$(.55,.8,C)*.45+P*.5);c.copy(J.cGrass),zt(c,J.cGrassLush,$(.35,.7,m)),zt(c,J.cGrassDry,$(.5,.8,u)*.3+$(.62,.8,x)*.15),zt(c,J.cGoldField,ne*.35),zt(c,J.cMossHollow,re*.55),c.multiplyScalar(.84+.3*y),o.copy(J.cMeadow).lerp(J.cGrassDry,g*.4).lerp(J.cGoldField,ne*.3).lerp(J.cFlowerA,.04),zt(c,o,$(.1,.9,T)),Ht(e,t,n,s);let F=It(.5+(s[2]*.6-s[0]*.25)*2.4+(N-.86)*2.6+(_-.5)*.5);c.r*=.88+.26*F,c.g*=.88+.24*F,c.b*=.88+.16*F,o.copy(J.cForest).lerp(J.cForest2,.35).lerp(J.cMossHollow,$(.55,.8,h)*.55),zt(c,o,E),o.copy(J.cMud).lerp(J.cFenMoss,.3),zt(c,o,j);let ie=i(e.extra,t,n,2);o.copy(J.cDirt).lerp(J.cGravel,It(ie*(1-ee)*1.2)).multiplyScalar(.98),zt(c,o,O),zt(c,a.copy(J.cSand),A),zt(c,o.copy(J.cPathEdge).lerp(J.cPath,$(.35,.85,k)),k),o.copy(J.cChalk).lerp(J.cChalk2,.5).multiplyScalar(.93),a.copy(J.cGranite).lerp(J.cGranite2,.5).multiplyScalar(.95),o.lerp(a,$(.3,.7,ee)),zt(c,o,$(.3,.7,M));let ae=Vt(e,t,n),I=s[1],L=150+(m-.5)*34,R=$(L-5,L+9,ae)*$(.62,.84,I),z=1-$(150,260,Math.hypot(t,n+590));z>0&&(R=Math.max(R,z*$(88,106,ae)*$(.8,.95,I)*(.22+.5*$(.35,.85,.5+1.1*(1-N))))),zt(c,J.cSnow,R),zt(c,o.copy(J.cCave).lerp(J.cCave2,.4),te);let B=(1-E*.55)*(1-O*.75)*(1-k)*(1-A)*(1-j*.65)*(1-$(.3,.7,M))*(1-R)*(1-te)*(1-P)*$(.7,.82,I)*(.7+.3*T);if(B>.002){let e=t/18+Math.sin(n*.05)*.8,r=n/18+Math.cos(t*.045)*.8,i=Math.floor(e),a=Math.floor(r),s=e-i,l=r-a,u=Rt(i+17.9,a+17.9);if(u<.45){let e=s-.5-(Lt(u*37.3)-.5)*.24,t=l-.5-(Lt(u*61.7)-.5)*.24,n=Math.cos(u*20.9),r=Math.sin(u*20.9),d=(1-$(.3,1.05,Math.hypot(n*e-r*t,(r*e+n*t)*1.45)*2+(y-.5)*.6+(b-.5)*.25))*$(0,.12,Math.min(s,1-s,l,1-l))*.45,f=Rt(i+3.3,a+3.3),p=1;f<.28?o.copy(J.cFlowerB):f<.64?(o.copy(J.cFlowerC),p=.7):f<.88?(o.copy(J.cFlowerD).lerp(J.cMeadow,.45),p=.9):(o.copy(J.cFlowerA),p=.85),zt(c,o.multiplyScalar(.9),d*p*B)}}return c.multiplyScalar((1-.4*P*(1-R))*(.84+.3*d)*(.72+.28*N)),c}}function Vt(e,t,n){let r=Math.min(U-1.001,Math.max(0,(t+G)/2)),i=Math.min(U-1.001,Math.max(0,(n+G)/2)),a=Math.floor(r),o=Math.floor(i),s=r-a,c=i-o,l=o*U+a,u=e.heights;return(u[l]*(1-s)+u[l+1]*s)*(1-c)+(u[l+U]*(1-s)+u[l+U+1]*s)*c}function Ht(e,t,n,r){let i=Math.min(U-1,Math.max(0,Math.round((t+G)/2))),a=(Math.min(U-1,Math.max(0,Math.round((n+G)/2)))*U+i)*4,o=e.normal[a]/255*2-1,s=e.normal[a+1]/255*2-1,c=Math.sign(o)*o*o,l=Math.sign(s)*s*s;r[0]=c,r[2]=l,r[1]=Math.sqrt(Math.max(0,1-c*c-l*l))}var Ut={low:{range0:150,keep:120,backdrop:1.6,grassRing:[26,48]},medium:{range0:250,keep:170,backdrop:1,grassRing:[30,56]},high:{range0:340,keep:220,backdrop:.8,grassRing:[50,92]}};function Wt(e,t,n,a,o,s=!0){let c=new r(e,a,a,t,n);return c.wrapS=c.wrapT=j,c.magFilter=k,c.minFilter=o?te:k,c.generateMipmaps=o,c.colorSpace=s?``:i,c.anisotropy=o?4:1,c.needsUpdate=!0,c}async function Gt(e){let t=performance.now(),{data:i,derived:a,hollow:o}=await Ve(3),{heights:c,surface:u,wLevel:d,wBody:p,flow:h}=i,g={},v=performance.now(),b=e=>{let t=performance.now();g[e]=Math.round(t-v),v=t},x;if(a)x=a;else{let e=Ke(c,d);x={atlas:e.data,atlasW:e.width,atlasH:e.height,offsets:e.offsets},He(i,x)}let S=new r(x.atlas,x.atlasW,x.atlasH,re,s);S.minFilter=S.magFilter=_,S.generateMipmaps=!1,S.needsUpdate=!0;let C=new r(i.half,U,U,re,m);C.minFilter=C.magFilter=k,C.generateMipmaps=!1,C.needsUpdate=!0;let w=Wt(i.noise,f,l,256,!0);w.wrapS=w.wrapT=ne,w.anisotropy=8;let T={height:S,levelOffsets:Array.from({length:x.offsets.length/2},(e,t)=>new y(x.offsets[t*2],x.offsets[t*2+1])),normal:Wt(i.normal,f,l,U,!0),splatA:Wt(i.splatA,f,l,U,!0),splatB:Wt(i.splatB,f,l,U,!0),extra:Wt(i.extra,f,l,U,!0),noise:w};be.data=i,be.textures=T,be.heightHalf=C;let E=xe(i.prep);be.cave=E,b(`textures`);let D=(e,t)=>c[(t<0?0:t>=U?U-1:t)*U+(e<0?0:e>=U?U-1:e)],O=(e,t)=>{let n=(e+G)/2,r=(t+G)/2,i=Math.floor(n),a=Math.floor(r),o=n-i,s=r-a,c=D(i,a),l=D(i+1,a),u=D(i,a+1),d=D(i+1,a+1);return o>s?c+(l-c)*o+(d-l)*s:c+(d-u)*o+(u-c)*s},A=(e,t,n=new N)=>{let r=O(e-2,t),i=O(e+2,t),a=O(e,t-2),o=O(e,t+2);return n.set(r-i,4,a-o).normalize()},j=(e,t)=>{let n=Math.min(U-1,Math.max(0,Math.round((e+G)/2)));return Math.min(U-1,Math.max(0,Math.round((t+G)/2)))*U+n},ee=(e,t)=>he[u[j(e,t)]]??`grass`,te=(e,t)=>{let n=(e+G)/2,r=(t+G)/2,i=Math.min(U-2,Math.max(0,Math.floor(n))),a=Math.min(U-2,Math.max(0,Math.floor(r))),o=Math.min(1,Math.max(0,n-i)),s=Math.min(1,Math.max(0,r-a)),c=a*U+i,l=d[c],u=d[c+1],f=d[c+U],p=d[c+U+1],m=0,h=0,g;return g=(1-o)*(1-s),g>0&&l===l&&(m+=l*g,h+=g),g=o*(1-s),g>0&&u===u&&(m+=u*g,h+=g),g=(1-o)*s,g>0&&f===f&&(m+=f*g,h+=g),g=o*s,g>0&&p===p&&(m+=p*g,h+=g),h>1e-6?m/h:NaN},M=e.uniforms.uTime,ie=(e,t)=>{let n=te(e,t);if(Number.isNaN(n))return null;let r=O(e,t);return p[j(e,t)]===ve.sea&&(n+=_e(e,t,M.value,n-r)),n>r+.02?n:null},ae=(e,t,n=new N)=>{let r=j(e,t);return Number.isNaN(d[r])||d[r]<=O(e,t)?n.set(0,0,0):n.set(h[r*2],0,h[r*2+1])},I=(e,t,n)=>{let r=Math.round((e-E.x0)/E.cell),i=Math.round((n-E.z0)/E.cell);if(r<0||i<0||r>=E.nx||i>=E.nz)return 0;let a=i*E.nx+r,o=E.ceiling[a];if(Number.isNaN(o))return 0;let s=1-Math.min(1,Math.max(0,(t-o+1)/3));return E.inside[a]*s},L=new n;L.name=`terrain`;let R=e.settings.quality??`medium`;ot.fromArray(Ut[R].grassRing);let z=new Ye(c,Ut[R].range0),B=dt(T,`cdlod`,z.morph),V=new P(z.geometry,B.material);V.name=`terrain-cdlod`,V.frustumCulled=!1,V.receiveShadow=!0,V.customDepthMaterial=B.depth;let se=e.render?.sun,ce=se&&rt.supported(se)?new rt(z,B.material,B.depth,se):null;V.castShadow=!ce;for(let e of ce?.meshes??[])L.add(e);V.matrixAutoUpdate=!1,V.raycast=(e,t)=>{let n=le(e.ray.origin,e.ray.direction,Math.min(e.far,4e3));if(n!==null&&n>=e.near){let r=e.ray.at(n,new N);t.push({distance:n,point:r,object:V,face:null,faceIndex:void 0,normal:A(r.x,r.z)})}},L.add(V);let H=new N;function le(e,t,n){let r=0,i=e.y-O(e.x,e.z);if(i<0)return 0;let a=0;for(;a<n;){let o=Math.max(.4,Math.min(12,i*.5));a=Math.min(n,a+o),H.copy(e).addScaledVector(t,a);let s=H.y-O(H.x,H.z);if(s<0){let n=r,i=a;for(let r=0;r<10;r++){let r=(n+i)*.5;H.copy(e).addScaledVector(t,r),H.y-O(H.x,H.z)<0?i=r:n=r}return(n+i)*.5}r=a,i=s}return null}b(`lod`);let ue=o;ue||(ue=jt(i,E),Ue(3,ue));let W=Mt(e,i,ue,T,E,R);L.add(W.group),b(`cave`);let de=Ft(T,O,Ut[R].backdrop);L.add(de),me(L),b(`backdrop`),e.scene.add(L);let fe=(e,t)=>{let n=O(e,t),r=W.roofTopAt(e,t);return r!==null&&r>n?r:n},pe=(e,t)=>{let n=W.roofTopAt(e,t);return n!==null&&n>O(e,t)+.5?W.roofSurfaceAt(e,t)??`grass`:ee(e,t)},ge=e=>{if(e===R)return;let t=Ut[e].backdrop!==Ut[R].backdrop;R=e,z.setRange0(Ut[e].range0),ot.fromArray(Ut[e].grassRing),W.setQuality(e),t&&(L.remove(de),de.geometry.dispose(),de.material.dispose(),de=Ft(T,O,Ut[e].backdrop),L.add(de),me(L))};e.events.on(`settings:changed`,()=>ge(e.settings.quality??`medium`));let ye=B.uniforms.uLodCam.value,Se=e.camera,Ce=[E.x0-8,E.z0-8,E.x0+E.nx*E.cell+8,E.z0+E.nz*E.cell+8],we=(()=>{let e=i.prep.cave,t=e.curve,n=[];for(let r of[e.roofS0,e.roofS1]){let e=0;for(;e<t.n-1&&t.s[e+1]<r;)e++;n.push(new N(t.x[e],c[Math.round((t.z[e]+G)/2)*U+Math.round((t.x[e]+G)/2)],t.z[e]))}return n})(),Te=!1,Ee=new N,De=()=>{Ee.setFromMatrixPosition(Se.matrixWorld);let e=I(Ee.x,Ee.y,Ee.z),t=Math.min(Ee.distanceTo(we[0]),Ee.distanceTo(we[1]));Te=Te?e>.8&&t>20:e>.9&&t>26,z.clip=Te?Ce:null,de.visible=!Te},Oe=e.render?.lightDirection??e.uniforms.uLightDir.value,ke=()=>{Se.updateMatrixWorld(),De(),z.update(Se,ce?0:Ut[R].keep),ce?.update(Se,Oe),ye.setFromMatrixPosition(Se.matrixWorld),W.update(Se)};ke(),e.addSystem({order:990,lateUpdate:ke});let Ae=performance.now()-t;return i.stats.cached?console.info(`[terrain] loaded from the world cache in ${i.stats.ms.toFixed(0)} ms, ready in ${Ae.toFixed(0)} ms`):i.stats.ms>50&&console.info(`[terrain] generated in ${i.stats.ms.toFixed(0)} ms (${i.stats.workers} workers), ready in ${Ae.toFixed(0)} ms`),{order:F.terrain,size:oe,group:L,heightAt:O,normalAt:A,surfaceAt:ee,waterHeightAt:ie,waterFlowAt:ae,caveFactorAt:I,surfaceHeightAt:fe,surfaceTopAt:pe,raycastTerrain:le,cameraInCave:()=>Te,caveBounds:Ce,colorAt:Bt(i),debugStats:()=>({genMs:Math.round(i.stats.ms),cached:!!i.stats.cached,bootMs:Math.round(Ae),steps:Object.entries(g).map(([e,t])=>`${e} ${t}`).join(` / `),workers:i.stats.workers,bands:i.stats.bands,workerMs:Math.round(i.stats.workerMs),quality:R,lodNodes:z.count,lodTris:z.triangles,shadowTris:ce?ce.triangles.join(`/`):`view`,caveLights:W.lights,crystals:W.crystals,roofBoxes:W.roofBoxes,inCave:Te})}}export{Gt as default};