import{n as e}from"./three.module-e53_FFk2.js";import{$r as t,A as n,E as r,Ja as i,Rn as a,U as o,Un as s,V as c,Wi as l,fa as u,ft as d,io as f,j as p,mr as m,no as h,qt as g,ro as _,sr as v,x as y,zi as b}from"./three.core-DtjtRha-.js";import{_ as x,o as S,s as C}from"./index-DGqtqlWq.js";import{n as w,t as T}from"./biome-DstsBN7N.js";var E=36800,D=E/2,O=E/16384,k=4485,A=1025,j=-4600,M=9200/1024,N=4,P=Math.round(13800/O),F=10240,I=32,L=4096,R=12288,z=-9200,B=18400/256,V=e=>E/(1<<e),H=e=>1<<8-e;function ee(e,t){let n=new Float32Array((t-e)*A),r=0;for(let i=e;i<t;i++){let e=j+i*M;for(let t=0;t<A;t++)n[r++]=C(j+t*M,e)}return n}function te(e,t){let n=new Float32Array((t-e)*257),r=0;for(let i=e;i<t;i++){let e=z+i*B;for(let t=0;t<257;t++)n[r++]=C(z+t*B,e)}return n}function ne(e,t,n,r,i,a=null){let o=H(e),s=t*64*o,c=n*64*o,l=new Float32Array(4761),u=0,d=0,f=0;i&&(f=o*2,u=(t>>1)*64*f,d=(n>>1)*64*f);let p=0;for(let e=0;e<69;e++){let t=c+(e-2)*o,n=t*O-D,m=r&&t>=P&&t<=F&&(t-P)%N===0,h=m?(t-P)/N*A:0,g=a&&t>=L&&t<=R&&(t-L)%I===0,_=g?(t-L)/I*257:0,v=-1;if(i){let e=(t-d)/f+2;e===Math.floor(e)&&e>=0&&e<69&&(v=e*69)}for(let t=0;t<69;t++){let c=s+(t-2)*o;if(m&&c>=P&&c<=F&&(c-P)%N===0){l[e*69+t]=r[h+(c-P)/N];continue}if(g&&c>=L&&c<=R&&(c-L)%I===0){l[e*69+t]=a[_+(c-L)/I];continue}if(v>=0){let n=(c-u)/f+2;if(n===Math.floor(n)&&n>=0&&n<69){l[e*69+t]=i[v+n];continue}}l[e*69+t]=C(c*O-D,n),p++}}return l.computed=p,l}function re(e,t,n,r){let i=H(e),a=i*O,o=t*64*i*O-D,s=n*64*i*O-D,c=new Float32Array(k*3),l=new Int16Array(k*3),u=new Float32Array(k*3),d=new Int16Array(k*2),f=32767,p=(e,t)=>r[(t+2)*69+e+2],m=new Float32Array(1089),h=new Float32Array(1089),g=1/(4*a);for(let e=0;e<33;e++)for(let t=0;t<33;t++){let n=t*2,r=e*2,i=(p(n-2,r)-p(n+2,r))*g,a=(p(n,r-2)-p(n,r+2))*g,o=1/Math.sqrt(i*i+1+a*a);m[e*33+t]=i*o,h[e*33+t]=a*o}let _=1/0,v=-1/0,y=1/(2*a);for(let t=0;t<65;t++)for(let n=0;n<65;n++){let r=t*65+n,i=p(n,t);c[r*3]=o+n*a,c[r*3+1]=i,c[r*3+2]=s+t*a;let g=(p(n-1,t)-p(n+1,t))*y,b=(p(n,t-1)-p(n,t+1))*y,x=1/Math.sqrt(g*g+1+b*b);l[r*3]=Math.round(g*x*f),l[r*3+1]=Math.round(x*f),l[r*3+2]=Math.round(b*x*f);let S=!(n&1),C=!(t&1),w,T,E;if(S&&C){w=i;let e=(t>>1)*33+(n>>1);T=m[e],E=h[e]}else if(!S&&C){w=.5*(p(n-1,t)+p(n+1,t));let e=(t>>1)*33+(n-1>>1);T=.5*(m[e]+m[e+1]),E=.5*(h[e]+h[e+1])}else if(S&&!C){w=.5*(p(n,t-1)+p(n,t+1));let e=(t-1>>1)*33+(n>>1);T=.5*(m[e]+m[e+33]),E=.5*(h[e]+h[e+33])}else{let e=n-1>>1,r=t-1>>1,i=r*33+e;e+r&1?(w=.5*(p(n+1,t-1)+p(n-1,t+1)),T=.5*(m[i+1]+m[i+33]),E=.5*(h[i+1]+h[i+33])):(w=.5*(p(n-1,t-1)+p(n+1,t+1)),T=.5*(m[i]+m[i+33+1]),E=.5*(h[i]+h[i+33+1]))}if(u[r*3]=w,u[r*3+1]=e,u[r*3+2]=w,n===0||n===64||t===0||t===64){let e=t===0||t===64,i=e?n:t,a=i&-4,o=Math.min(64,a+4),s=(i-a)/4,c=e?p(a,t):p(n,a),l=e?p(o,t):p(n,o);u[r*3+2]=c+(l-c)*s}d[r*2]=Math.round(T*f),d[r*2+1]=Math.round(E*f),i<_&&(_=i),i>v&&(v=i),w<_&&(_=w),w>v&&(v=w);let D=u[r*3+2];D<_&&(_=D),D>v&&(v=D)}let b=a*6+6,x=4225,S=(t,n)=>{let r=n*65+t;c[x*3]=c[r*3],c[x*3+1]=c[r*3+1]-b,c[x*3+2]=c[r*3+2],l[x*3]=l[r*3],l[x*3+1]=l[r*3+1],l[x*3+2]=l[r*3+2],u[x*3]=u[r*3]-b,u[x*3+1]=e,u[x*3+2]=u[r*3+2]-b,d[x*2]=d[r*2],d[x*2+1]=d[r*2+1],x++};for(let e=0;e<65;e++)S(e,0);for(let e=0;e<65;e++)S(e,64);for(let e=0;e<65;e++)S(0,e);for(let e=0;e<65;e++)S(64,e);return _-=b,{pos:c,nrm:l,mor:u,morN:d,minY:_,maxY:v,x0:o,z0:s,size:a*64}}function ie(){let e=[];for(let t=0;t<64;t++)for(let n=0;n<64;n++){let r=t*65+n,i=r+1,a=r+65,o=a+1;n+t&1?e.push(r,a,i,i,a,o):e.push(r,a,o,r,o,i)}let t=4225,n=4290,r=4355,i=4420;for(let r=0;r<64;r++){let i=r,a=r+1,o=t+r,s=t+r+1;e.push(i,a,o,a,s,o),i=4160+r,a=i+1,o=n+r,s=n+r+1,e.push(i,o,a,a,o,s)}for(let t=0;t<64;t++){let n=t*65,a=(t+1)*65,o=r+t,s=r+t+1;e.push(n,o,a,a,o,s),n=t*65+64,a=(t+1)*65+64,o=i+t,s=i+t+1,e.push(n,a,o,a,s,o)}return new Uint16Array(e)}var U=e=>e<0?0:e>1?1:e,W=(e,t,n)=>{let r=U((n-e)/(t-e));return r*r*(3-2*r)};function G(e,t,n,r){let i=A,a=t>0?t-1:t,o=t<1024?t+1:t,s=n>0?n-1:n,c=n<1024?n+1:n,l=(e[n*i+a]-e[n*i+o])/((o-a)*M),u=(e[s*i+t]-e[c*i+t])/((c-s)*M),d=1/Math.sqrt(l*l+1+u*u);return r[0]=l*d,r[1]=d,r[2]=u*d,r}function ae(e,t){let{d:n}=S(e,t),r=1-W(260,720,n),i=x.temple;r=Math.max(r,1-W(330,760,Math.sqrt((e-i.x)**2+(t-i.z)**2)));let a=x.needles;return r=Math.max(r,.75*(1-W(520,980,Math.sqrt((e-a.x)**2+(t-a.z)**2)))),r}function oe(e,t,n){let r=A,i=new Uint8Array((n-t)*r*4),a=new Uint8Array((n-t)*r*4),o=[0,1,0],s=Math.max(0,t-9),c=Math.min(r,n+9),l=new Float32Array((c-s)*r),u=new Float32Array((c-s)*r);for(let t=s;t<c;t++)for(let n=0;n<r;n++){let i=1-G(e,n,t,o)[1];u[(t-s)*r+n]=i,l[(t-s)*r+n]=W(.28,.55,i)}let d=0;for(let c=t;c<n;c++){let t=j+c*M;for(let n=0;n<r;n++,d+=4){let f=j+n*M,p=e[c*r+n];if(G(e,n,c,o),i[d]=Math.round((o[0]*.5+.5)*255),i[d+1]=Math.round((o[2]*.5+.5)*255),a[d]=Math.round(T(f,t,p,o[1])*255),a[d+1]=Math.round(w(f,t)*255),a[d+3]=Math.round(ae(f,t)*255),p>-2){let t=0,i=0;for(let a=-3;a<=3;a++){let o=c+a*3;if(o<0||o>=r)continue;let u=o*r,d=(o-s)*r;for(let o=-3;o<=3;o++){let s=n+o*3;if(s<0||s>=r)continue;let c=1/(1+.35*(o*o+a*a));i+=c,e[u+s]>p+6&&(t+=c*l[d+s])}}let o=(c-s)*r+n,f=U(t/i*3.2)*(1-l[o])*W(.03,.12,u[o]+.04);a[d+2]=Math.round(f*255)}}}return{A:i,B:a}}function K(e,t,n){let r=new Float32Array(t*t),i=new Float32Array(t*t),a=2*n+1;for(let i=0;i<t;i++){let o=i*t,s=0;for(let r=-n;r<=n;r++)s+=e[o+Math.min(t-1,Math.max(0,r))];for(let i=0;i<t;i++)r[o+i]=s/a,s+=e[o+Math.min(t-1,i+n+1)]-e[o+Math.max(0,i-n)]}for(let e=0;e<t;e++){let o=0;for(let i=-n;i<=n;i++)o+=r[Math.min(t-1,Math.max(0,i))*t+e];for(let s=0;s<t;s++)i[s*t+e]=o/a,o+=r[Math.min(t-1,s+n+1)*t+e]-r[Math.max(0,s-n)*t+e]}return i}function se(e){let t=A,n=t*t,r=K(e,t,2),i=K(e,t,7),a=K(e,t,24),o=new Uint8Array(n);for(let t=0;t<n;t++){let n=e[t],s=(r[t]-n)/5*.45+(i[t]-n)/18*.35+(a[t]-n)/60*.3;o[t]=Math.round(U(.5+.5*Math.tanh(s))*255)}let s=1/0,c=-1/0;for(let t=0;t<n;t++)e[t]<s&&(s=e[t]),e[t]>c&&(c=e[t]);let l=65535/Math.max(1,c-s),u=new Uint32Array(65537),d=new Uint16Array(n);for(let t=0;t<n;t++){let n=65535-Math.floor((e[t]-s)*l);d[t]=n,u[n+1]++}for(let e=0;e<65536;e++)u[e+1]+=u[e];let f=new Uint32Array(n);for(let e=0;e<n;e++)f[u[d[e]]++]=e;let p=new Float32Array(n).fill(1),m=[-1,0,1,-1,1,-1,0,1],h=[-1,-1,-1,0,0,1,1,1],g=[.7071,1,.7071,1,1,.7071,1,.7071],_=new Float32Array(8);for(let r=0;r<n;r++){let n=f[r],i=e[n];if(i<0)continue;let a=n%t,o=(n-a)/t,s=0;for(let n=0;n<8;n++){let r=a+m[n],c=o+h[n];if(_[n]=0,r<0||c<0||r>=t||c>=t)continue;let l=(i-e[c*t+r])*g[n];if(l>0){let e=l*l;_[n]=e,s+=e}}if(s<=0)continue;let c=p[n]/s;for(let e=0;e<8;e++)_[e]>0&&(p[(o+h[e])*t+a+m[e]]+=c*_[e])}let v=new Uint8Array(n),y=1/Math.log(3001);for(let t=0;t<n;t++)v[t]=e[t]<0?0:Math.round(U((Math.log(1+p[t])-Math.log(4))*y*1.15)*255);return{cavity:o,flow:v}}function q(e,t,n,r,i,a,o){let s=new Float32Array(t*t),c=new Float32Array(t*t),l=Math.sqrt(i[0]*i[0]+i[2]*i[2]),u=i[0]/l,d=i[2]/l,f=i[1]/l,p=f+a,m=Math.max(-.05,f-a),h=Math.abs(u)>=Math.abs(d),g=h?u:d,_=(h?d:u)/Math.abs(g),v=r/Math.abs(g),y=v*p,b=v*m,x=g>0?1:-1,S=new Float32Array(t),C=new Float32Array(t),w=new Float32Array(t),T=new Float32Array(t),E=x>0?t-1:0;for(let i=0;i<t;i++){let a=E-x*i;for(let l=0;l<t;l++){let u=h?l*t+a:a*t+l,d,f,p=l+_;if(i>0&&p>=0&&p<=t-1){let e=Math.floor(p),n=e<t-1?e+1:e,r=p-e;d=S[e]+(S[n]-S[e])*r-y,f=C[e]+(C[n]-C[e])*r-b}else if(o){let e=n+(h?a:l)*r,t=n+(h?l:a)*r;d=o(e,t,!0),f=o(e,t,!1)}else d=f=-1e9;s[u]=d,c[u]=f;let m=e[u];w[l]=m>d?m:d,T[l]=m>f?m:f}let l=S;S=w,w=l,l=C,C=T,T=l}return{hi:s,lo:c}}function ce(e,t,n=null,r=.012){let i=A,a=new Uint8Array(i*i),o=Math.sqrt(t[0]*t[0]+t[2]*t[2]);if(t[1]<=-.02||o<1e-4)return a.fill(t[1]>0?255:0),a;let s=null;if(n){let e=q(n,257,z,B,t,r,null);s=(t,n,r)=>{let i=r?e.hi:e.lo,a=(t-z)/B,o=(n-z)/B;a=a<0?0:a>255.999?255.999:a,o=o<0?0:o>255.999?255.999:o;let s=a|0,c=o|0,l=a-s,u=o-c,d=c*257+s,f=i[d]+(i[d+1]-i[d])*l;return f+(i[d+257]+(i[d+257+1]-i[d+257])*l-f)*u}}let c=q(e,i,j,M,t,r,s);for(let t=0;t<i*i;t++){let n=e[t]+1.2,r=c.hi[t],i=c.lo[t],o;o=n>=i?1:n<=r?0:(n-r)/Math.max(.01,i-r),a[t]=Math.round(o*255)}return a}var le=72;function ue(e,t){let n=e.cache.get(t);return n&&(e.cache.delete(t),e.cache.set(t,n)),n}function de(e,t,n){e.cache.set(t,n),e.cache.size>le&&e.cache.delete(e.cache.keys().next().value)}function J(e,t){switch(t.type){case`rows`:{let e=ee(t.j0,t.j1);return{result:{data:e},transfer:[e.buffer]}}case`crows`:{let e=te(t.j0,t.j1);return{result:{data:e},transfer:[e.buffer]}}case`setWorld`:return e.world=t.world,e.coarse=t.coarse||null,e.cache.clear(),{result:!0};case`maprows`:{let n=oe(e.world,t.j0,t.j1);return{result:n,transfer:[n.A.buffer,n.B.buffer]}}case`global`:{let t=se(e.world);return{result:t,transfer:[t.cavity.buffer,t.flow.buffer]}}case`sun`:{let n=ce(e.world,t.dir,e.coarse);return{result:{vis:n},transfer:[n.buffer]}}case`chunk`:{let{L:n,ix:r,iz:i}=t,a=n>0?ue(e,`${n-1}:${r>>1}:${i>>1}`):null,o=ne(n,r,i,e.world,a||null,e.coarse);n>=6&&n<8&&de(e,`${n}:${r}:${i}`,o);let s=re(n,r,i,o);return s.computed=o.computed,{result:s,transfer:[s.pos.buffer,s.nrm.buffer,s.mor.buffer,s.morN.buffer]}}default:throw Error(`terrain: unknown job ${t.type}`)}}function fe(e){let t={world:null,cache:new Map},n=[],r=new Map,i=1,a=!1,o=e=>{if(a)return;a=!0,console.warn(`[terrain] workers unavailable, computing on the main thread:`,e);for(let e of n)e.terminate();let t=[...r.values()];r.clear();for(let e of t)s(e.msg,e.resolve,e.reject)};if(typeof Worker<`u`&&e>0)try{for(let t=0;t<e;t++){let e=new Worker(new URL(new URL(`terrain-worker-DVcr_hr3.js`,import.meta.url).href,``+import.meta.url),{type:`module`});e.inflight=0,e.onmessage=t=>{let{id:n,result:i,error:a}=t.data,o=r.get(n);o&&(r.delete(n),e.inflight--,a?o.reject(Error(a)):o.resolve(i))},e.onerror=e=>o(e.message||`worker error`),n.push(e)}}catch(e){o(e)}else a=!0;function s(e,n,r){setTimeout(()=>{try{n(J(t,e).result)}catch(e){r(e)}},0)}return{get size(){return a?1:n.length},get threaded(){return!a},local:t,inflight(e){return a?0:n[e].inflight},run(e,t,o=[]){return new Promise((c,l)=>{if(a)return s(t,c,l);let u=i++;t.id=u,r.set(u,{msg:t,resolve:c,reject:l});let d=n[e%n.length];d.inflight++,d.postMessage(t,o)})},runLocal(e){return J(t,e).result},broadcast(e){return J(t,e),a?Promise.resolve():Promise.all(n.map((t,n)=>this.run(n,{...e})))},dispose(){for(let e of n)e.terminate()}}}var pe={LUSH:`#3f6e24`,OLIVE:`#5f7431`,DRY:`#a08a4c`,STRAW:`#bda46a`,ALPINE:`#857c52`,NEEDLE:`#2f2c1d`,MOSS:`#2b4119`,SOIL:`#6a5641`,LIME_A:`#bdb19c`,LIME_B:`#968d80`,LIME_C:`#d8c9a9`,SAND_A:`#a65c38`,SAND_B:`#c98b5a`,SAND_C:`#dfc39a`,GRAN_A:`#86827c`,GRAN_B:`#5d5b59`,BASALT_A:`#3b393b`,BASALT_B:`#5b524e`,SCREE:`#a0978a`,BEACH:`#c9b38a`,PEBBLE:`#877c6d`,SILT:`#5d5645`,SILT_DEEP:`#2c2d27`,SNOW:`#eef2f7`,VARNISH:`#3a3029`,LICHEN:`#b4a46a`};function me(){let e=new o;return Object.entries(pe).map(([t,n])=>(e.set(n),`const vec3 C_${t} = vec3(${e.r.toFixed(4)}, ${e.g.toFixed(4)}, ${e.b.toFixed(4)});`)).join(`
`)}function he(e){let n=(t,n)=>{let r=new Float32Array(t*t);for(let t=0;t<r.length;t++)r[t]=e();return(e,n)=>{let i=Math.floor(e),a=Math.floor(n),o=e-i,s=n-a,c=o*o*(3-2*o),l=s*s*(3-2*s),u=(i%t+t)%t,d=(a%t+t)%t,f=(u+1)%t,p=(d+1)%t,m=r[d*t+u],h=r[d*t+f],g=r[p*t+u],_=r[p*t+f];return m+(h-m)*c+(g-m)*l+(m-h-g+_)*c*l}},r=e=>{let t=e.map(e=>({P:e,f:n(e)}));return(e,n)=>{let r=0,i=1,a=0;for(let{P:o,f:s}of t)r+=i*s(e*o,n*o),a+=i,i*=.5;return r/a}},o=r([4,8,16,32,64]),c=r([4,8,16,32,64]),u=r([16,32,64,128]),f=new Float32Array(512);for(let t=0;t<256;t++)f[t*2]=.1+.8*e(),f[t*2+1]=.1+.8*e();let p=(e,t)=>{let n=e*16,r=t*16,i=Math.floor(n),a=Math.floor(r),o=9;for(let e=-1;e<=1;e++)for(let t=-1;t<=1;t++){let s=i+t,c=a+e,l=((c%16+16)%16*16+(s%16+16)%16)*2,u=s+f[l]-n,d=c+f[l+1]-r,p=u*u+d*d;p<o&&(o=p)}return Math.sqrt(o)},m=[new Float32Array(65536),new Float32Array(65536),new Float32Array(65536),new Float32Array(65536)];for(let e=0;e<256;e++)for(let t=0;t<256;t++){let n=t/256,r=e/256,i=e*256+t;m[0][i]=o(n,r),m[1][i]=c(n+.37,r+.71),m[2][i]=p(n,r),m[3][i]=u(n,r)}let h=new Uint8Array(262144);for(let e=0;e<4;e++){let t=1/0,n=-1/0;for(let r of m[e])r<t&&(t=r),r>n&&(n=r);let r=1/(n-t);for(let n=0;n<65536;n++)h[n*4+e]=Math.round((m[e][n]-t)*r*255)}let g=new d(h,256,256,t,i);return g.wrapS=g.wrapT=l,g.magFilter=a,g.minFilter=s,g.generateMipmaps=!0,g.colorSpace=``,g.needsUpdate=!0,g}function Y(e,n=t){let r=new d(e,A,A,n,i);return r.wrapS=r.wrapT=c,r.magFilter=a,r.minFilter=s,r.generateMipmaps=!0,r.unpackAlignment=1,r.colorSpace=``,r.needsUpdate=!0,r}var X=`
attribute vec3 aMorph;  // x: parent-level height, y: level, z: grandparent-level height (borders)
attribute vec2 aMorphN; // parent-level normal (x, z)
uniform vec3 uTerrCam;
uniform vec2 uTerrMorph[9];
// k: morph toward the parent level; kp: the parent level's own morph toward its parent (only
// moves border vertices, keeping them welded to a coarser neighbour that is itself morphing).
float terrMorphK(out float kp) {
  int L = int(aMorph.y + 0.5);
  float d = distance(uTerrCam, position);
  vec2 r = uTerrMorph[L];
  vec2 rp = uTerrMorph[L > 0 ? L - 1 : 0];
  kp = L > 0 ? clamp((d - rp.x) / (rp.y - rp.x), 0.0, 1.0) : 0.0;
  return clamp((d - r.x) / (r.y - r.x), 0.0, 1.0);
}
`,ge=`
float terrKp;
float terrK = terrMorphK(terrKp);
vec3 terrNc = vec3(aMorphN.x, sqrt(max(0.0, 1.0 - dot(aMorphN, aMorphN))), aMorphN.y);
vec3 objectNormal = normalize(mix(normal, terrNc, terrK));
`,Z=`
vec3 transformed = vec3(position.x, mix(mix(position.y, aMorph.x, terrK), aMorph.z, terrKp), position.z);
`,_e=`
varying vec3 vTerrPos;
varying vec3 vTerrNrm;
uniform sampler2D uTerrA;     // nx, nz, cavity, flow
uniform sampler2D uTerrB;     // forest, meadow, talus, sandstone
uniform sampler2D uTerrSun;   // heightfield sun visibility
uniform sampler2D uTerrNoise; // tiling multi-channel noise
uniform vec4 uTerrWorld;      // x0, z0, 1/extent, half texel
uniform vec4 uTerrFar;        // x,y: far-normal blend range, z: detail (quality), w: snow line
uniform vec4 uTerrCrater;     // crater x, z, radius, -
uniform vec3 uTerrSunDir;
${me()}

float terrHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// All noise lookups use explicit gradients so the expensive layers can sit inside branches
// (rock-only, near-only) without breaking mip selection.
vec4 terrNG(vec2 uv, vec2 gx, vec2 gy) { return textureGrad(uTerrNoise, uv, gx, gy); }
// Biplanar sample (the two most facing planes of a triplanar set, blended) — cliffs never
// stretch, at two texture fetches instead of three.
vec4 terrTri(vec3 p, vec3 n, float s, vec3 dx, vec3 dy) {
  vec3 an = abs(n);
  ivec3 ma = (an.x > an.y && an.x > an.z) ? ivec3(0, 1, 2) : (an.y > an.z) ? ivec3(1, 2, 0) : ivec3(2, 0, 1);
  ivec3 mi = (an.x < an.y && an.x < an.z) ? ivec3(0, 1, 2) : (an.y < an.z) ? ivec3(1, 2, 0) : ivec3(2, 0, 1);
  ivec3 me = ivec3(3) - mi - ma;
  vec4 a = textureGrad(uTerrNoise, vec2(p[ma.y], p[ma.z]) * s, vec2(dx[ma.y], dx[ma.z]) * s, vec2(dy[ma.y], dy[ma.z]) * s);
  vec4 b = textureGrad(uTerrNoise, vec2(p[me.y], p[me.z]) * s + 0.37, vec2(dx[me.y], dx[me.z]) * s, vec2(dy[me.y], dy[me.z]) * s);
  vec2 w = clamp((vec2(an[ma.x], an[me.x]) - 0.5) * 2.0, 0.0, 1.0);
  w *= w;
  w *= w;
  return (a * w.x + b * w.y) / (w.x + w.y);
}
vec3 terrBump(vec3 surfPos, vec3 surfNorm, float h) {
  vec3 dpdx = dFdx(surfPos);
  vec3 dpdy = dFdy(surfPos);
  vec3 r1 = cross(dpdy, surfNorm);
  vec3 r2 = cross(surfNorm, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`,ve=`
float terrSunVis = 1.0;
float terrAO = 1.0;
vec3 terrSunDirV = normalize((viewMatrix * vec4(uTerrSunDir, 0.0)).xyz);
{
  vec3 P = vTerrPos;
  float dist = length(P - cameraPosition);
  vec3 dPx = dFdx(P);
  vec3 dPy = dFdy(P);
  float fwY = abs(dPx.y) + abs(dPy.y);     // metres of height per pixel (strata anti-aliasing)
  vec3 Nm = normalize(vTerrNrm);

  // ---- baked world maps ------------------------------------------------------
  vec2 wuv = (P.xz - uTerrWorld.xy) * uTerrWorld.z + uTerrWorld.w;
  vec2 we = min(wuv, 1.0 - wuv);
  float inW = smoothstep(0.0, 0.03, min(we.x, we.y));
  vec4 mA = texture2D(uTerrA, wuv);
  vec4 mB = texture2D(uTerrB, wuv);
  terrSunVis = mix(1.0, texture2D(uTerrSun, wuv).r, inW);
  vec3 Nt = vec3(mA.r * 2.0 - 1.0, 0.0, mA.g * 2.0 - 1.0);
  Nt.y = sqrt(max(0.02, 1.0 - dot(Nt.xz, Nt.xz)));
  float farW = smoothstep(uTerrFar.x, uTerrFar.y, dist) * inW;
  vec3 N = normalize(mix(Nm, Nt, farW));
  float cav = (mA.b - 0.5) * 2.0 * inW;   // + concave, - convex
  float flow = mA.a * inW;
  float forest = mB.r * inW;
  float meadow = mix(0.55, mB.g, inW);
  float talus = mB.b * inW;
  float sandst = mB.a * inW;
  float sl = 1.0 - N.y;                   // 0 flat .. 1 vertical
  vec3 aN = abs(N);
  vec3 tw = aN * aN; tw *= tw; tw /= (tw.x + tw.y + tw.z);
  float detail = uTerrFar.z;
  float fineFade = 1.0 - smoothstep(70.0, 320.0, dist);
  float microFade = (1.0 - smoothstep(8.0, 60.0, dist)) * detail;

  // ---- multi-scale noise (mip filtering averages it out with distance) ---------
  vec2 gx = dPx.xz, gy = dPy.xz;
  vec4 nM = terrNG(P.xz * 0.00029 + 0.11, gx * 0.00029, gy * 0.00029);  // ~3.4 km
  vec4 nm = terrNG(P.xz * 0.0019 + 0.31, gx * 0.0019, gy * 0.0019);     // ~520 m
  vec4 nf = terrNG(P.xz * 0.0147 + 0.57, gx * 0.0147, gy * 0.0147);     // ~68 m
  vec4 nd = terrNG(P.xz * 0.109 + 0.13, gx * 0.109, gy * 0.109);        // ~9 m
  vec4 nu = vec4(0.5);                                                   // ~1.6 m, near only
  if (dist < 90.0) nu = terrNG(P.xz * 0.63 + 0.77, gx * 0.63, gy * 0.63);

  // ---- vegetation ground: lush / olive / dry-gold grass, forest floor, soil ------
  float dry = 0.78 - meadow;
  dry += (nm.r - 0.5) * 0.75 + (nM.g - 0.5) * 0.9 + (nf.g - 0.5) * 0.4;
  dry += smoothstep(0.06, 0.2, sl) * 0.22 - cav * 0.25;
  dry -= smoothstep(0.35, 0.8, flow) * 0.55;
  dry += sandst * 0.06; // the sandstone country is a little drier
  dry = clamp(dry, 0.0, 1.0);
  vec3 grass = mix(C_LUSH, C_OLIVE, smoothstep(0.2, 0.6, dry));
  grass = mix(grass, C_DRY, smoothstep(0.5, 0.85, dry));
  grass = mix(grass, C_STRAW, smoothstep(0.82, 1.0, dry) * 0.7);
  grass = mix(grass, C_ALPINE, smoothstep(430.0, 780.0, P.y + (nm.g - 0.5) * 200.0));
  grass *= 0.78 + 0.44 * nd.a;
  grass *= 0.86 + 0.28 * mix(0.5, nu.a, microFade);
  // flowers / seed heads: tiny light specks in lush meadows (near only)
  float fl = smoothstep(0.83, 0.9, nu.b) * (1.0 - dry) * microFade * (1.0 - forest);
  grass = mix(grass, vec3(0.62, 0.58, 0.42), fl * 0.5);

  vec3 floorC = mix(C_NEEDLE, C_MOSS, smoothstep(0.35, 0.7, nf.r + (nd.g - 0.5) * 0.4));
  floorC *= 0.72 + 0.5 * nd.b;
  float fo = smoothstep(0.08, 0.65, forest + (nf.b - 0.5) * 0.25);
  vec3 ground = mix(grass, floorC, fo);

  float soil = smoothstep(0.19, 0.32, sl + (nf.b - 0.5) * 0.14 + (nd.r - 0.5) * 0.08) * (1.0 - fo * 0.6) * 0.6;
  soil = max(soil, smoothstep(0.6, 0.95, flow) * smoothstep(0.03, 0.15, sl) * 0.7);
  vec3 soilC = mix(C_SOIL, C_SAND_A * 0.8, sandst * 0.45) * (0.78 + 0.44 * nd.r);
  ground = mix(ground, soilC, soil * 0.85);

  // ---- where rock shows -------------------------------------------------------
  float steep = smoothstep(0.3, 0.75, sl);
  float strataW = smoothstep(0.34, 0.62, sl);   // layering only reads on true cliffs
  float rockW = smoothstep(0.24, 0.38, sl + (nm.b - 0.5) * 0.14 + (nf.r - 0.5) * 0.1 - cav * 0.1);
  rockW = max(rockW, smoothstep(0.14, 0.3, sl) * smoothstep(-0.2, -0.6, cav));
  rockW = max(rockW, smoothstep(1350.0, 1800.0, P.y + (nm.r - 0.5) * 300.0));
  rockW *= 1.0 - smoothstep(0.3, 0.9, forest) * (1.0 - steep);
  // below cliff steepness rock only breaks through the turf in outcrops (patchy, not a carpet)
  float outcrop = smoothstep(0.42, 0.62, nf.r * 0.6 + nd.g * 0.4 + (1.0 - rockW) * -0.1);
  rockW *= mix(outcrop, 1.0, smoothstep(0.4, 0.6, sl) + smoothstep(1350.0, 1800.0, P.y));
  float scree = smoothstep(0.12, 0.45, talus + (nf.b - 0.5) * 0.35 + (nd.b - 0.5) * 0.15) * (1.0 - rockW);

  // ---- rock: stratified limestone / sandstone / granite / basalt ----------------
  vec3 rock = C_LIME_B;
  float bf = 0.5;
  float stMask = 0.0;
  float ledgeFade = 0.0;
  vec4 rt = vec4(0.5);
  vec4 rd = vec4(0.5);
  float h1 = 0.5;
  float stBump = 0.0;
  if (rockW + scree > 0.003) {
    rt = terrTri(P, N, 0.021, dPx, dPy);                 // ~48 m
    if (dist < 400.0) rd = terrTri(P, N, 0.16, dPx, dPy); // ~6 m
    // beds pinch and swell (lensing) along the cliff, not perfect contour lines
    float warp = (nm.g - 0.5) * 70.0 + (nM.b - 0.5) * 180.0 + (rt.r - 0.5) * 16.0 + (nf.a - 0.5) * 9.0;
    float sy = P.y + warp;
    // formations (~46 m, readable from kilometres) subdivided into beds (~10.5 m)
    float form = sy / 46.0;
    float fid = floor(form);
    float g1 = terrHash(vec2(fid, 3.0));
    float g2 = terrHash(vec2(fid, 11.0));
    float band = sy / 10.5 + 0.35 * sin(sy * 0.061 + g1 * 6.0); // uneven bed thickness
    float bid = floor(band);
    bf = fract(band);
    float bandFade = 1.0 - smoothstep(0.25, 0.9, fwY / 10.5);
    h1 = mix(0.5, terrHash(vec2(bid, 7.0)), bandFade);
    float h2 = mix(0.3, terrHash(vec2(bid, 19.0)), bandFade);
    float formFade = (1.0 - smoothstep(0.3, 0.9, fwY / 46.0)) * (1.0 - 0.45 * smoothstep(2300.0, 3200.0, length(P.xz)));
    g1 = mix(0.5, g1, formFade);
    g2 = mix(0.4, g2, formFade);
    vec3 lime = mix(C_LIME_A, C_LIME_B, g1 * (0.8 + 0.5 * strataW) + h1 * 0.35);
    lime = mix(lime, C_LIME_C, smoothstep(0.6, 0.8, g2) * 0.8);
    lime *= 0.9 + 0.2 * h1 * strataW;
    vec3 sand = mix(C_SAND_A, C_SAND_B, g1);
    sand = mix(sand, C_SAND_C, smoothstep(0.62, 0.8, g2) * 0.85);
    sand *= 0.88 + 0.24 * h1 * strataW;
    rock = mix(lime, sand, smoothstep(0.1, 0.8, sandst));
    // gentler rock slopes: weathered, blotchy, no bands
    vec3 slab = mix(mix(C_LIME_A, C_LIME_B, 0.3 + 0.4 * rt.b), mix(C_SAND_B, C_SAND_A, 0.3 + 0.4 * rt.b), smoothstep(0.1, 0.8, sandst));
    rock = mix(slab * (0.85 + 0.3 * mix(0.5, rd.r, fineFade)), rock, strataW);
    float ring = smoothstep(2250.0, 3100.0, length(P.xz) + (nm.b - 0.5) * 500.0);
    vec3 gran = mix(C_GRAN_A, C_GRAN_B, rt.g) * (0.9 + 0.2 * h1);
    // the ring is layered pale limestone (Dolomite-like: it glows pink at dusk) over grey gneiss
    rock = mix(rock, gran, ring * 0.5 * (1.0 - sandst));
    float volc = 1.0 - smoothstep(uTerrCrater.z * 0.85, uTerrCrater.z * 1.8, distance(P.xz, uTerrCrater.xy));
    rock = mix(rock, mix(C_BASALT_A, C_BASALT_B, h1), volc * 0.8);
    // fine laminations inside each band, fading before they alias
    float lamW = (1.0 - smoothstep(0.15, 0.6, fwY)) * strataW;
    rock *= 1.0 + 0.09 * lamW * sin(sy * 5.3 + rd.a * 4.0) * smoothstep(0.3, 0.7, rt.g);
    // undercut shadow line beneath each ledge + pale ledge lip
    ledgeFade = (1.0 - smoothstep(1.2, 4.0, fwY)) * strataW;
    // only the hard beds form ledges, and their lips are broken along the face
    float hard = smoothstep(0.45, 0.7, h2 + (rt.b - 0.5) * 0.6) * ledgeFade;
    rock *= mix(1.0, 0.74, smoothstep(0.84, 1.0, bf) * hard);
    rock *= mix(1.0, 1.12, (1.0 - smoothstep(0.0, 0.08, bf)) * hard);
    // mottling and blocks
    rock *= mix(0.88 + 0.24 * rt.a, 0.78 + 0.44 * rt.a, strataW);
    rock *= mix(1.0, 0.8 + 0.4 * rd.g, fineFade);
    // vertical erosion streaks (desert varnish / rain) on the steep faces
    if (steep > 0.0) {
      vec4 sx = textureGrad(uTerrNoise, vec2(P.z * 0.041, P.y * 0.0032) + 0.2, vec2(dPx.z * 0.041, dPx.y * 0.0032), vec2(dPy.z * 0.041, dPy.y * 0.0032));
      vec4 sz = textureGrad(uTerrNoise, vec2(P.x * 0.041, P.y * 0.0032) + 0.6, vec2(dPx.x * 0.041, dPx.y * 0.0032), vec2(dPy.x * 0.041, dPy.y * 0.0032));
      float wz = tw.z / max(tw.x + tw.z, 1e-3);
      // two widths of streak (ribbons + broad stains), so the face never reads as a picket fence
      float streak = mix(mix(sx.r, sx.a, 0.4), mix(sz.r, sz.a, 0.4), wz) + (rt.g - 0.5) * 0.35;
      stMask = smoothstep(0.5, 0.78, streak + (rt.b - 0.5) * 0.25) * steep;
      stBump = stMask; // (continuous: the bed-modulated mask below has steps)
      // stains start under each ledge lip and fade down the bed (not full-height curtains)
      stMask *= mix(1.0, mix(0.25, 1.0, bf * bf), strataW);
      rock = mix(rock, rock * C_VARNISH * 2.2, stMask * 0.55);
      float pale = smoothstep(0.66, 0.86, 1.0 - streak) * steep;
      rock = mix(rock, rock * 1.22, pale * 0.5);
    }
    // lichen / moss on cooler, lower rock
    float lich = smoothstep(0.62, 0.8, rd.b) * (1.0 - ring) * (1.0 - smoothstep(600.0, 900.0, P.y)) * (1.0 - smoothstep(220.0, 380.0, dist));
    rock = mix(rock, C_LICHEN * 0.8, lich * 0.18 * (1.0 - steep * 0.5));
    rock = mix(rock, C_MOSS, smoothstep(0.55, 0.9, cav + flow * 0.5) * (1.0 - steep) * 0.35);
  }

  // ---- scree aprons under cliffs ------------------------------------------------
  vec3 screeC = mix(rock, C_SCREE * (0.8 + 0.3 * h1), 0.45);
  float cells = mix(0.5, nd.b, fineFade);
  screeC *= 0.7 + 0.6 * smoothstep(0.1, 0.9, cells) * (0.6 + 0.4 * nu.r);

  // ---- shore: beach, pebbles, wet band, lake bed --------------------------------
  float beachTop = 1.6 + nf.r * 3.2 + (1.0 - smoothstep(0.02, 0.14, sl)) * 2.2;
  float beach = (1.0 - smoothstep(beachTop - 1.2, beachTop, P.y)) * (1.0 - smoothstep(0.34, 0.55, sl));
  vec3 beachC = mix(C_BEACH, C_PEBBLE, smoothstep(0.35, 0.75, nf.g + sl * 1.5));
  beachC *= 0.82 + 0.36 * mix(0.5, smoothstep(0.15, 0.6, nd.b), fineFade);
  float wet = 1.0 - smoothstep(0.05, 0.55 + 0.45 * nf.b, P.y);
  float under = smoothstep(0.0, -1.2, P.y);
  vec3 bed = mix(C_SILT, C_SILT_DEEP, smoothstep(-2.0, -26.0, P.y)) * (0.8 + 0.4 * nf.a);

  // ---- snow: altitude, aspect (north faces hold more), slope, strata ledges -----
  float snowLine = uTerrFar.w + (nM.r - 0.5) * 320.0 + N.z * 120.0 - cav * 60.0;
  float snowH = smoothstep(snowLine - 80.0, snowLine + 60.0, P.y + (nf.g - 0.5) * 110.0 + (nd.r - 0.5) * 24.0);
  // high up, snow plasters steeper faces too (snowy aretes), lower it only holds on gentle ground
  float snowAlt = smoothstep(snowLine + 100.0, snowLine + 650.0, P.y);
  float snowS = 1.0 - smoothstep(0.34 + 0.2 * snowAlt, 0.6 + 0.15 * snowAlt, sl + (nd.g - 0.5) * 0.16 - cav * 0.12);
  float ledgeSnow = (1.0 - smoothstep(0.05, 0.32, bf)) * smoothstep(0.3, 0.5, sl) * ledgeFade;
  float snow = snowH * max(snowS, ledgeSnow * 0.85);
  snow = max(snow, snowH * smoothstep(0.5, 0.9, flow) * 0.8); // couloirs
  vec3 snowC = C_SNOW * (0.9 + 0.1 * nd.a);
  snowC = mix(snowC, snowC * vec3(0.8, 0.86, 0.97), smoothstep(0.1, 0.6, cav));

  // ---- composite ------------------------------------------------------------------
  vec3 col = ground;
  float rough = mix(0.92, 0.97, fo);
  col = mix(col, screeC, scree);
  rough = mix(rough, 0.9, scree);
  col = mix(col, rock, rockW);
  rough = mix(rough, 0.8 - stMask * 0.12, rockW);
  float bw = beach * (1.0 - rockW * 0.7);
  col = mix(col, beachC, bw);
  rough = mix(rough, 0.9, bw);
  col *= mix(1.0, 0.48, wet * (1.0 - under));
  rough = mix(rough, mix(0.2, 0.4, steep), wet * (1.0 - under));
  col = mix(col, bed, under);
  rough = mix(rough, 0.55, under);
  // dark wet drainage lines on rock & scree
  col *= 1.0 - 0.28 * smoothstep(0.55, 0.9, flow) * max(rockW, scree) * (1.0 - snow);
  col = mix(col, snowC, snow);
  rough = mix(rough, 0.5, snow);
  // macro variation so large areas never read as one colour
  col *= 0.84 + 0.32 * nM.a;
  col *= mix(vec3(1.0), vec3(1.05, 0.98, 0.9), smoothstep(0.35, 0.75, nm.a) * (1.0 - snow));
  col *= 1.0 - 0.2 * max(cav, 0.0) * (1.0 - snow);
  diffuseColor.rgb = col;
  roughnessFactor = clamp(rough, 0.04, 1.0);
  terrAO = clamp(1.0 - max(cav, 0.0) * 0.6 - fo * 0.15, 0.3, 1.0);

  // ---- normal: macro (far maps) + meso/micro bump near the camera -----------------
  float bumpH = 0.0;
  // broad buttresses and hollows (smooth channel; the high-frequency one reads as reptile scales)
  bumpH += (rt.g - 0.5) * 2.2 * rockW * (0.6 + 0.8 * strataW) * (1.0 - smoothstep(300.0, 1100.0, dist));
  bumpH += (rt.a - 0.5) * 0.35 * rockW * fineFade;
  bumpH += (rd.g - 0.5) * 0.45 * rockW * fineFade;
  // undercut groove below each ledge: a continuous tent in the bed coordinate (a step would spike
  // the derivative-based bump into dotted contour lines)
  float groove = smoothstep(0.78, 0.92, bf) * (1.0 - smoothstep(0.92, 1.0, bf));
  bumpH -= groove * 0.5 * rockW * ledgeFade * (1.0 - smoothstep(200.0, 700.0, dist));
  bumpH += (nd.a - 0.5) * 0.18 * (1.0 - rockW) * fineFade;
  bumpH += (nu.a - 0.5) * 0.06 * (1.0 - rockW) * microFade;
  bumpH += smoothstep(0.2, 0.7, nd.b) * 0.12 * (scree + bw * 0.5) * fineFade;
  bumpH -= stBump * 0.9 * rockW * (1.0 - smoothstep(250.0, 800.0, dist)); // rain flutes on cliffs
  bumpH *= 1.0 - snowH * snowS * 0.75; // (smooth snow term: the ledge snow has steps)
  vec3 Nv = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  normal = terrBump(-vViewPosition, Nv, bumpH * detail);
  // terminator: bump detail may not light ground that faces away from the sun (and the shadow
  // map's self-comparison there would sparkle)
  terrSunVis *= smoothstep(-0.03, 0.12, dot(Nv, terrSunDirV));
  // specular anti-aliasing: widen the lobe where the normal varies within a pixel (no glint fireflies)
  vec3 dnx = dFdx(normal), dny = dFdy(normal);
  float sAA = min(0.2, 2.0 * max(dot(dnx, dnx), dot(dny, dny)));
  roughnessFactor = sqrt(clamp(roughnessFactor * roughnessFactor + sAA, 0.0, 1.0));
}
`,Q=`getDirectionalLightInfo( directionalLight, directLight );`,$=`getDirectionalLightInfo( directionalLight, directLight );
		directLight.color *= mix( 1.0, terrSunVis, step( 0.995, dot( directLight.direction, terrSunDirV ) ) );`;function ye(t){return n=>{if(n.userData.mwMountainShadows)return n;n.userData.mwMountainShadows=!0;let r=n.onBeforeCompile,i=n.customProgramCacheKey;return n.onBeforeCompile=function(n,i){r&&r.call(this,n,i),n.uniforms.uTerrSun=t.uTerrSun,n.uniforms.uTerrWorld=t.uTerrWorld,n.uniforms.uTerrSunDir=t.uTerrSunDir,n.fragmentShader=n.fragmentShader.replace(`#include <common>`,`#include <common>

uniform sampler2D uTerrSun;
uniform vec4 uTerrWorld;
uniform vec3 uTerrSunDir;
`).replace(`#include <lights_fragment_begin>`,`
float terrSunVis = 1.0;
vec3 terrSunDirV = normalize((viewMatrix * vec4(uTerrSunDir, 0.0)).xyz);
#ifdef USE_FOG
{
  vec2 wuv = (vAtmoWorldPos.xz - uTerrWorld.xy) * uTerrWorld.z + uTerrWorld.w;
  vec2 we = min(wuv, 1.0 - wuv);
  terrSunVis = mix(1.0, texture2D(uTerrSun, wuv).r, smoothstep(0.0, 0.03, min(we.x, we.y)));
}
#endif
\n${e.lights_fragment_begin.replace(Q,$)}`)},n.customProgramCacheKey=function(){return`${i?i.call(this):``}|mw-mtn-shadow`},n.needsUpdate=!0,n}}function be(t,n){let r=he(t.noise.createRng(`terrain-noise`));t.quality.level===`high`&&(r.anisotropy=Math.min(8,t.renderer.capabilities.getMaxAnisotropy()));let i=t.layout.LANDMARK_BY_ID.orrery,a=t.quality.terrainDetail,o=[];for(let e=0;e<=8;e++)o.push(new h(1e9,1e9+1));let s={uTerrCam:{value:new _},uTerrMorph:{value:o},uTerrA:{value:n.A},uTerrB:{value:n.B},uTerrSun:{value:n.sun},uTerrNoise:{value:r},uTerrWorld:{value:new f(j,j,1/(M*A),.5/A)},uTerrFar:{value:new f(550,1500,a,1020)},uTerrCrater:{value:new f(i.x,i.z,470,0)},uTerrSunDir:{value:new _(0,1,0)}},c=new m({color:16777215,roughness:.92,metalness:0});c.name=`terrain`,c.customProgramCacheKey=()=>`mw-terrain-1`,c.onBeforeCompile=t=>{Object.assign(t.uniforms,s),t.vertexShader=t.vertexShader.replace(`#include <common>`,`#include <common>\n${X}\nvarying vec3 vTerrPos;\nvarying vec3 vTerrNrm;`).replace(`#include <beginnormal_vertex>`,ge).replace(`#include <begin_vertex>`,Z).replace(`#include <project_vertex>`,`#include <project_vertex>
vTerrPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTerrNrm = objectNormal;`),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,`#include <common>\n${_e}`).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>\n${ve}`).replace(`#include <lights_fragment_begin>`,e.lights_fragment_begin.replace(Q,$)).replace(`#include <aomap_fragment>`,`#include <aomap_fragment>
reflectedLight.indirectDiffuse *= terrAO;
reflectedLight.indirectSpecular *= mix(1.0, terrAO, 0.7);`)};let l=new v;return l.name=`terrain-depth`,l.customProgramCacheKey=()=>`mw-terrain-depth-1`,l.onBeforeCompile=e=>{e.uniforms.uTerrCam=s.uTerrCam,e.uniforms.uTerrMorph=s.uTerrMorph,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>\n${X}`).replace(`#include <begin_vertex>`,`float terrKp;\nfloat terrK = terrMorphK(terrKp);\n${Z}`)},{material:c,depthMaterial:l,uniforms:s,noiseTex:r}}var xe=.7,Se=3,Ce=class{constructor(e,t,n,r){this.L=e,this.ix=t,this.iz=n,this.key=`${e}:${t}:${n}`,this.size=V(e),this.x0=t*this.size-D,this.z0=n*this.size-D,this.parent=r,this.children=null,this.minY=r?r.minY:-60,this.maxY=r?r.maxY:2600,this.state=0,this.slot=null,this.batch=null,this.visible=!1,this.shown=-1,this.used=0,this.prio=0}},we=class{constructor(e,t,n,r,i,a){this.indexCount=a,this.capacity=r;let o=new y(r,r*k,r*a,t);o.name=e,o.customDepthMaterial=n,o.castShadow=i,o.receiveShadow=!0,o.frustumCulled=!1,o.perObjectFrustumCulled=!0,o.sortObjects=!0,o.matrixAutoUpdate=!1,this.mesh=o,this.slots=[],this.free=[],this.owner=new Map}get used(){return this.slots.length-this.free.length}alloc(e){let t=this.mesh,n;if(this.free.length)n=this.free.pop(),t.setGeometryAt(n.geo,e);else if(this.slots.length<this.capacity){let r=t.addGeometry(e,k,this.indexCount);n={geo:r,inst:t.addInstance(r)},this.slots.push(n)}else return null;return t.setVisibleAt(n.inst,!1),n}release(e){this.mesh.setVisibleAt(e.inst,!1),this.owner.delete(e),this.free.push(e)}grow(e){let t=this.capacity+e;this.mesh.setGeometrySize(t*k,t*this.indexCount),this.mesh.setInstanceCount(t),this.capacity=t}},Te=class{constructor(e,t,r,i){this.ctx=e,this.pool=t,this.uniforms=r.uniforms,this.K=i.K,this.maxLevel=i.maxLevel,this.castMinLevel=i.castMinLevel,this.maxInflight=i.maxInflight??3,this.world=i.world,this.index=new n(ie(),1);let a=this.index.count;this.fine=new we(`terrain-near`,r.material,r.depthMaterial,i.fineCapacity??200,!0,a),this.coarse=new we(`terrain-far`,r.material,r.depthMaterial,i.coarseCapacity??240,!1,a),this.group=new g,this.group.name=`terrain`,this.group.matrixAutoUpdate=!1,this.group.add(this.fine.mesh,this.coarse.mesh),e.scene.add(this.group),this.root=new Ce(0,0,0,null),this.nodes=new Map([[this.root.key,this.root]]),this.displayed=[],this.wanted=[],this.results=[],this.frame=0,this.tick=0,this.lastCam=new _(1e9,0,0),this.dirty=!0,this.stats={chunks:0,jobs:0,computedSamples:0,grown:0};let o=this.uniforms.uTerrMorph.value;for(let e=1;e<=8;e++){let t=this.K*V(e-1);o[e].set(t*xe,t)}this._geo=new p,this._geo.setIndex(this.index)}_batchFor(e){return e.L>=this.castMinLevel?this.fine:this.coarse}_install(e,t){let i=this._geo;i.setAttribute(`position`,new n(t.pos,3)),i.setAttribute(`normal`,new n(t.nrm,3,!0)),i.setAttribute(`aMorph`,new n(t.mor,3)),i.setAttribute(`aMorphN`,new n(t.morN,2,!0)),i.boundingBox=new r(new _(t.x0-1,t.minY-1,t.z0-1),new _(t.x0+t.size+1,t.maxY+2+1,t.z0+t.size+1)),i.boundingSphere=i.boundingBox.getBoundingSphere(new u);let a=this._batchFor(e),o=a.alloc(i);o||=(this._evict(a,24),a.alloc(i)),o||=(a.grow(Math.ceil(a.capacity*.25)),this.stats.grown++,a.alloc(i)),e.slot=o,e.batch=a,e.visible=!1,e.used=this.frame,a.owner.set(o,e),e.minY=t.minY,e.maxY=t.maxY+2,e.state=2}_drop(e){e.batch.release(e.slot),e.slot=null,e.batch=null,e.visible=!1,e.state=0}_setVisible(e,t){e.visible!==t&&(e.visible=t,e.batch.mesh.setVisibleAt(e.slot.inst,t))}_evict(e,t){let n=[];for(let t of e.owner.values())t.used<this.frame&&t.L>Se&&n.push(t);n.sort((e,t)=>e.used-t.used);for(let e=0;e<Math.min(t,n.length);e++)this._drop(n[e])}_children(e){if(!e.children){let t=e.L+1;e.children=[];for(let n=0;n<4;n++){let r=new Ce(t,e.ix*2+(n&1),e.iz*2+(n>>1),e);this._estimateBounds(r),this.nodes.set(r.key,r),e.children.push(r)}}return e.children}_estimateBounds(e){let t=this.world;if(!t)return;let n=Math.floor((e.x0-j)/M),r=Math.ceil((e.x0+e.size-j)/M),i=Math.floor((e.z0-j)/M),a=Math.ceil((e.z0+e.size-j)/M);if(r<0||a<0||n>1024||i>1024)return;let o=Math.max(0,n),s=Math.min(A-1,r),c=Math.max(0,i),l=Math.min(A-1,a),u=Math.max(1,Math.floor((s-o)/24)),d=1/0,f=-1/0;for(let e=c;e<=l;e+=u)for(let n=o;n<=s;n+=u){let r=t[e*A+n];r<d&&(d=r),r>f&&(f=r)}let p=n>=0&&i>=0&&r<=1024&&a<=1024,m=12+e.size*.02;p?(e.minY=d-m,e.maxY=f+m):(e.minY=Math.min(e.minY,d-m),e.maxY=Math.max(e.maxY,f+m))}_dist(e,t){let n=e.x0,r=e.z0,i=e.size,a=t.x<n?n-t.x:t.x>n+i?t.x-n-i:0,o=t.z<r?r-t.z:t.z>r+i?t.z-r-i:0,s=t.y<e.minY?e.minY-t.y:t.y>e.maxY?t.y-e.maxY:0;return Math.sqrt(a*a+s*s+o*o)}_want(e,t){e.state===0&&(e.prio=t,this.wanted.push(e))}_show(e){e.shown=this.frame,e.used=this.frame,this.displayed.push(e)}_visit(e,t,n){let r=this._dist(e,t);if(!(r>n)){if(e.used=this.frame,e.L<Se){for(let r of this._children(e))this._visit(r,t,n);return}if(e.L<this.maxLevel&&r<this.K*e.size){let i=this._children(e),a=!0;for(let e of i)e.state!==2&&this._dist(e,t)<=n&&(a=!1);if(a){for(let e of i)this._visit(e,t,n);return}for(let e of i)e.state===0&&this._want(e,this._dist(e,t)/e.size);if(e.state===2){this._show(e);return}this._want(e,-10+r/e.size);for(let e of i)e.state===2&&this._show(e);return}if(e.state===2){this._show(e);return}if(this._want(e,-10+r/e.size),e.children&&e.children.every(e=>e.state===2))for(let t of e.children)this._show(t)}}select(e){this.frame++;let t=this.displayed;this.displayed=[],this.wanted.length=0;let n=this.ctx.camera.far*1.02;this._visit(this.root,e,n);for(let e of this.displayed)this._setVisible(e,!0);for(let e of t)e.shown!==this.frame&&e.slot&&this._setVisible(e,!1);this.wanted.sort((e,t)=>e.prio-t.prio),this.lastCam.copy(e),this.dirty=!1}_workerFor(e){let t=this.pool.size;if(e.L>=7){let n=e.L===7?e:e.parent;return((n.ix*73856093^n.iz*19349663)>>>0)%t}let n=0;for(let e=1;e<t;e++)this.pool.inflight(e)<this.pool.inflight(n)&&(n=e);return n}_dispatch(e=1/0){let t=0;for(let n of this.wanted){if(t>=e)break;if(n.state!==0)continue;let r=this._workerFor(n);this.pool.threaded&&this.pool.inflight(r)>=this.maxInflight||(n.state=1,t++,this.stats.jobs++,this.pool.run(r,{type:`chunk`,L:n.L,ix:n.ix,iz:n.iz}).then(e=>this.results.push([n,e])).catch(e=>{n.state=0,console.error(`[terrain] chunk job failed`,e)}))}return t}_integrate(e=1/0){let t=0;for(;this.results.length&&t<e;){let[e,n]=this.results.shift();e.state===1&&(this.stats.computedSamples+=n.computed||0,this._install(e,n),this.stats.chunks++,t++)}return t&&(this.dirty=!0),t}refineSync(e,t=12){for(let n=0;n<t;n++){if(this.select(e),!this.wanted.length)return!0;for(let e of this.wanted){if(e.state!==0)continue;let t=this.pool.runLocal({type:`chunk`,L:e.L,ix:e.ix,iz:e.iz});this.stats.computedSamples+=t.computed||0,e.state=1,this._install(e,t)}}return this.select(e),!this.wanted.length}async refineAsync(e,t=14){let n=this.pool.size,r=()=>new Promise(e=>setTimeout(e,0));for(let i=0;i<t;i++){if(this._integrate(),this.select(e),!this.wanted.length)return!0;let t=Array.from({length:n},()=>[]),i=[];for(let e of this.wanted)e.state===0&&(e.state=1,e.L>=7?t[this._workerFor(e)].push(e):i.push(e));let a=0,o=e=>({type:`chunk`,L:e.L,ix:e.ix,iz:e.iz}),s=[];for(let e=0;e<n;e++)s.push((async()=>{for(let n of t[e])this.results.push([n,await this.pool.run(e,o(n))]);for(;a<i.length;){let t=i[a++];this.results.push([t,await this.pool.run(e,o(t))])}})());this.pool.threaded&&s.push((async()=>{for(await r();a<i.length;){let e=i[a++];this.results.push([e,this.pool.runLocal(o(e))]),await r()}})()),await Promise.all(s)}return this._integrate(),this.select(e),!this.wanted.length}update(e,t){if(t){(this.dirty||e.distanceToSquared(this.lastCam)>.25)&&this.refineSync(e);return}if(this._integrate(6),(this.dirty||e.distanceToSquared(this.lastCam)>1)&&this.select(e),this.wanted.length&&this._dispatch(this.pool.threaded?1/0:1),!(++this.tick&31))for(let e of[this.fine,this.coarse])e.used>e.capacity*.85&&this._evict(e,Math.ceil(e.capacity*.1))}countVisible(){let e={};for(let t of this.displayed)e[t.L]=(e[t.L]||0)+1;let t=(this.fine.mesh._multiDrawCount||0)+(this.coarse.mesh._multiDrawCount||0);return{levels:e,drawnChunks:t,drawnTris:t*(this.index.count/3),displayed:this.displayed.length,tris:this.displayed.length*64*64*2,slots:this.fine.slots.length+this.coarse.slots.length,used:this.fine.used+this.coarse.used}}},Ee=16,De=()=>new Promise(e=>setTimeout(e,0));async function Oe(e,t,n,{first:r=null,onFirst:i=null}={}){let a=0,o=[];for(let s=0;s<e.size;s++)o.push((async()=>{for(r&&s===0&&i(await e.run(0,{...r}));a<t.length;){let r=t[a++];n(r,await e.run(s,{...r}))}})());e.threaded&&o.push((async()=>{for(await De();a<t.length;){let r=t[a++];n(r,e.runLocal({...r})),await De()}})()),await Promise.all(o)}async function ke(e){let t=performance.now(),{quality:n,env:r,camera:i}=e,a=n.terrainDetail??1,o=!!e.params.shot,s=typeof navigator<`u`&&navigator.hardwareConcurrency||4,c=fe(Math.max(1,Math.min(6,s-1))),l=c.size,u=new Float32Array(A*A),d=new Float32Array(66049);{let e=[];for(let t=0;t<A;t+=Ee)e.push({type:`rows`,j0:t,j1:Math.min(A,t+Ee)});for(let t=0;t<257;t+=32)e.push({type:`crows`,j0:t,j1:Math.min(257,t+32)});await Oe(c,e,(e,t)=>(e.type===`rows`?u:d).set(t.data,e.j0*(e.type===`rows`?A:257)))}let f=performance.now();await c.broadcast({type:`setWorld`,world:u,coarse:d});let p=new Uint8Array(A*A*4),m=new Uint8Array(A*A*4);{let e=[];for(let t=0;t<A;t+=32)e.push({type:`maprows`,j0:t,j1:Math.min(A,t+32)});let t=null;await Oe(c,e,(e,t)=>{p.set(t.A,e.j0*A*4),m.set(t.B,e.j0*A*4)},{first:{type:`global`},onFirst:e=>t=e});for(let e=0,n=A*A;e<n;e++)p[e*4+2]=t.cavity[e],p[e*4+3]=t.flow[e]}let h=performance.now(),g=new Uint8Array(A*A).fill(255),v=Y(g,b),y=!1,x=!1,S=()=>r.keyDir||r.sunDir,C=()=>{let e=S();return[e.x,e.y,e.z]},w=e=>{g.set(e),v.needsUpdate=!0},T=()=>{if(o){w(c.runLocal({type:`sun`,dir:C()}).vis);return}if(y){x=!0;return}y=!0,c.run(0,{type:`sun`,dir:C()}).then(e=>{w(e.vis),y=!1,x&&(x=!1,T())})};w((await c.run(0,{type:`sun`,dir:C()})).vis),r.onChange(T);let E={A:Y(p),B:Y(m),sun:v},D=be(e,E);D.uniforms.uTerrSunDir.value.copy(S());let O=n.level===`high`,k=new Te(e,c,D,{K:O?1.8:1.5,maxLevel:a>=.7?8:7,castMinLevel:O?7:8,fineCapacity:O?240:a>=.7?130:8,coarseCapacity:O?330:a>=.7?390:300,world:u}),N=new _;i.getWorldPosition(N),D.uniforms.uTerrCam.value.copy(N),await k.refineAsync(N);let P=performance.now(),F=(e,t,n,r)=>{let i=(n-j)/M,a=(r-j)/M;i=i<0?0:i>1023.999?A-1.001:i,a=a<0?0:a>1023.999?A-1.001:a;let o=i|0,s=a|0,c=i-o,l=a-s,u=s*A+o,d=e[u]+(e[u+1]-e[u])*c;return(d+(e[u+A]+(e[u+A+1]-e[u+A])*c-d)*l)*t};return e.terrain={heightApprox:(e,t)=>F(u,1,e,t),lightVisibility:(e,t)=>F(g,1/255,e,t),applyMountainShadows:ye(D.uniforms),material:D.material,uniforms:D.uniforms,grid:{data:u,n:A,x0:j,z0:j,step:M},maps:E,sunTexture:v,stats:()=>({...k.stats,...k.countVisible(),workers:c.threaded?l:0}),timings:{grid:Math.round(f-t),maps:Math.round(h-f),lod:Math.round(P-h),total:Math.round(P-t)}},e.params.debug&&console.log(`[terrain] build`,e.terrain.timings,e.terrain.stats()),{order:100,update(){i.getWorldPosition(N),D.uniforms.uTerrCam.value.copy(N),D.uniforms.uTerrSunDir.value.copy(S()),k.update(N,o)}}}export{ke as build};