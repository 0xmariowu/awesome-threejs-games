import{$r as e,A as t,Ar as n,E as r,F as i,Hn as a,Ht as o,Ja as s,Lt as c,Rn as l,U as u,V as d,Wi as f,Yt as p,an as m,ar as h,do as g,ea as _,fa as v,ft as y,in as b,io as x,ir as S,j as C,jr as w,kr as T,no as E,or as D,pr as O,ro as k,ta as A,zi as j}from"./three.core-DtjtRha-.js";import{g as M,h as N}from"./index-DGqtqlWq.js";var P=Math.PI*2;function F(e){let t=[];for(let n=0;n<72;n++){let r=0,i=0,a=0;for(let t=0;t<20;t++){let t=Math.exp(Math.log(2)+e()*Math.log(20)),n=e()<.75?.9:Math.PI,o=(e()*2-1)*n;if(r=Math.round(t*Math.cos(o)),i=Math.round(t*Math.sin(o)),a=Math.hypot(r,i),a>=2)break}if(a<1)continue;let o=a**-1.7*(.6+.8*e()),s=e()*P;n%5!=0&&t.push({kx:r,kz:i,amp:o,ph:s})}let n=new Map;for(let e of t){let{kx:t,kz:r,ph:i}=e;(t<0||t===0&&r<0)&&(t=-t,r=-r,i=-i);let a=`${t},${r}`,o=n.get(a)||{kx:t,kz:r,re:0,im:0};o.re+=e.amp*Math.cos(i),o.im+=e.amp*Math.sin(i),n.set(a,o)}return[...n.values()].map(e=>({kx:e.kx,kz:e.kz,amp:Math.hypot(e.re,e.im),ph:Math.atan2(e.im,e.re)}))}var I=`
void main() { gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`,L=`
uniform vec4 uWaves[WAVES];   // kx, kz (cycles per tile), amplitude, phase
uniform float uScale;
uniform float uSize;
void main() {
  // texel (i, j) samples the tile at (i, j) / N, like a DataTexture filled on the CPU would
  vec2 p = floor(gl_FragCoord.xy) / uSize;
  vec2 s = vec2(0.0);
  for (int i = 0; i < WAVES; i++) {
    vec4 w = uWaves[i];
    float a = 6.2831853 * fract(w.x * p.x + w.y * p.y) + w.w;
    s -= w.z * w.xy * sin(a);
  }
  s = clamp(s * uScale, -1.0, 1.0);
  gl_FragColor = vec4(s * 0.5 + 0.5, 0.5, 1.0);
}
`;function R(t,n,r=256){let o=F(t),c=0;for(let e of o)c+=e.amp*e.amp*(e.kx*e.kx+e.kz*e.kz)/2;let u=.16/(Math.sqrt(c/2)||1)*2;if(!n)return z(o,u,r);let d=new g(r,r,{type:s,format:e,wrapS:f,wrapT:f,magFilter:l,minFilter:a,generateMipmaps:!0,depthBuffer:!1,stencilBuffer:!1});d.texture.name=`water-waves`,d.texture.colorSpace=``;let p=new A({vertexShader:I,fragmentShader:L,defines:{WAVES:o.length},uniforms:{uWaves:{value:o.map(e=>new x(e.kx,e.kz,e.amp,e.ph))},uScale:{value:u},uSize:{value:r}},depthTest:!1,depthWrite:!1}),m=new h(new w(1,1),p);m.frustumCulled=!1;let v=new _;v.add(m);let y=new i,b=n.getRenderTarget(),S=n.xr.enabled;n.xr.enabled=!1,n.setRenderTarget(d),n.render(v,y),n.setRenderTarget(b),n.xr.enabled=S,m.geometry.dispose(),p.dispose();let C=d.texture;return C.userData.slopeScale=.5,C.userData.renderTarget=d,C}function z(t,n,r){let i=new Uint8Array(r*r*4),o=new Float32Array(r*r),c=new Float32Array(r*r);for(let e of t)for(let t=0;t<r;t++)for(let n=0;n<r;n++){let i=P*((e.kx*n+e.kz*t)/r)+e.ph,a=e.amp*Math.sin(i);o[t*r+n]-=e.kx*a,c[t*r+n]-=e.kz*a}for(let e=0;e<r*r;e++)i[e*4]=Math.round((Math.max(-1,Math.min(1,o[e]*n))*.5+.5)*255),i[e*4+1]=Math.round((Math.max(-1,Math.min(1,c[e]*n))*.5+.5)*255),i[e*4+2]=128,i[e*4+3]=255;let u=new y(i,r,r,e,s);return u.wrapS=u.wrapT=f,u.magFilter=l,u.minFilter=a,u.generateMipmaps=!0,u.colorSpace=``,u.name=`water-waves`,u.needsUpdate=!0,u.userData.slopeScale=.5,u}function B(e,t,n,r,i=.5){let a=new Float32Array(t*t),o=new Int32Array(t),s=new Int32Array(t),c=new Float32Array(t),l=1,u=0,d=n;for(let n=0;n<r;n++){let n=new Float32Array(d*d);for(let t=0;t<n.length;t++)n[t]=e()*2-1;let r=d/t;for(let e=0;e<t;e++){let t=e*r,n=Math.floor(t),i=t-n;c[e]=i*i*(3-2*i),o[e]=n%d,s[e]=(n+1)%d}for(let e=0;e<t;e++){let i=e*r,u=Math.floor(i),f=i-u;f=f*f*(3-2*f);let p=u%d*d,m=(u+1)%d*d,h=e*t;for(let e=0;e<t;e++){let t=o[e],r=s[e],i=c[e],u=n[p+t]+(n[p+r]-n[p+t])*i,d=n[m+t]+(n[m+r]-n[m+t])*i;a[h+e]+=l*(u+(d-u)*f)}}u+=l,l*=i,d*=2}for(let e=0;e<a.length;e++)a[e]/=u;return a}function V(e,t,n){let r=new Float32Array(n*n*2);for(let t=0;t<r.length;t++)r[t]=e();let i=n+2,a=new Float32Array(i*i),o=new Float32Array(i*i);for(let e=-1;e<=n;e++)for(let t=-1;t<=n;t++){let s=((e+n)%n*n+(t+n)%n)*2,c=(e+1)*i+(t+1);a[c]=t+r[s],o[c]=e+r[s+1]}let s=new Float32Array(t*t),c=n/t;for(let e=0;e<t;e++){let n=e*c,r=Math.floor(n);for(let l=0;l<t;l++){let u=l*c,d=Math.floor(u),f=9;for(let e=0;e<3;e++){let t=(r+e)*i+d;for(let e=0;e<3;e++){let r=a[t+e]-u,i=o[t+e]-n,s=r*r+i*i;s<f&&(f=s)}}s[e*t+l]=Math.sqrt(f)}}return s}function H(t,n=256){let r=n,i=B(t,r,4,5,.52),o=B(t,r,8,4,.55),c=V(t,r,16),u=B(t,r,16,4,.6),d=new Uint8Array(r*r*4),p=e=>Math.max(0,Math.min(255,Math.round(e)));for(let e=0;e<r*r;e++)d[e*4]=p((i[e]*.5+.5)*255),d[e*4+1]=p((o[e]*.5+.5)*255),d[e*4+2]=p(Math.min(1,c[e]*1.25)*255),d[e*4+3]=p((u[e]*.5+.5)*255);for(let e of[0,1,3]){let t=255,n=0;for(let i=0;i<r*r;i++){let r=d[i*4+e];r<t&&(t=r),r>n&&(n=r)}let i=255/Math.max(1,n-t);for(let n=0;n<r*r;n++)d[n*4+e]=p((d[n*4+e]-t)*i)}let m=new y(d,r,r,e,s);return m.wrapS=m.wrapT=f,m.magFilter=l,m.minFilter=a,m.generateMipmaps=!0,m.colorSpace=``,m.name=`water-noise`,m.needsUpdate=!0,m}var U=0x56bc75e2d63100000;function W(e,t){if(t&&t.data&&t.n){let{data:e,n,x0:r,z0:i,step:a}=t,o=1/a;return{sample:(t,a)=>{let s=(t-r)*o,c=(a-i)*o;s<0?s=0:s>n-1.001&&(s=n-1.001),c<0?c=0:c>n-1.001&&(c=n-1.001);let l=s|0,u=c|0,d=s-l,f=c-u,p=u*n+l,m=e[p]+(e[p+1]-e[p])*d;return m+(e[p+n]+(e[p+n+1]-e[p+n])*d-m)*f},grid:t,fromTerrain:!0,calls:0}}let n=-2600,r=-3400,i=new Float32Array(51870);for(let t=0;t<210;t++)for(let a=0;a<247;a++)i[t*247+a]=e(n+a*24,r+t*24);let a=1/24;return{sample:(t,o)=>{let s=(t-n)*a,c=(o-r)*a;if(s<0||c<0||s>245.999||c>208.999)return e(t,o);let l=s|0,u=c|0,d=s-l,f=c-u,p=u*247+l,m=i[p]+(i[p+1]-i[p])*d;return m+(i[p+247]+(i[p+247+1]-i[p+247])*d-m)*f},grid:null,fromTerrain:!1,calls:51870,own:{data:i,nx:247,nz:210,x0:n,z0:r,step:24}}}var G=[],K=0;for(let e=0;e<N.length-1;e++){let[t,n]=N[e],[r,i]=N[e+1],a=Math.hypot(r-t,i-n);G.push({ax:t,az:n,bx:r,bz:i,len:a,s0:K}),K+=a}function ee(e,t){e=Math.max(0,Math.min(K,e));for(let n of G)if(e<=n.s0+n.len){let r=(e-n.s0)/n.len;return t[0]=n.ax+(n.bx-n.ax)*r,t[1]=n.az+(n.bz-n.az)*r,t}return t[0]=N[N.length-1][0],t[1]=N[N.length-1][1],t}var q=[0,0],J=[0,0];function te(e,t,n){let r=U,i=0;for(let n of G){let a=n.bx-n.ax,o=n.bz-n.az,s=((e-n.ax)*a+(t-n.az)*o)/(n.len*n.len);s=s<0?0:s>1?1:s;let c=n.ax+a*s-e,l=n.az+o*s-t,u=c*c+l*l;u<r&&(r=u,i=n.s0+s*n.len)}return n[0]=Math.sqrt(r),n[1]=i,n}function Y(e,t,n,{step:r=5,margin:i=100}={}){let a=performance.now(),o=U,s=-0x56bc75e2d63100000,c=U,l=-0x56bc75e2d63100000;for(let e=-4400;e<=4400;e+=20)for(let n=-4400;n<=4400;n+=20)t(n,e)<1.5&&(n<o&&(o=n),n>s&&(s=n),e<c&&(c=e),e>l&&(l=e));o>s&&(o=M.x-100,s=M.x+100,c=M.z-100,l=M.z+100);let u=Math.floor((o-i)/r)*r,d=Math.floor((c-i)/r)*r,f=Math.ceil((Math.ceil((s+i-u)/r)+1)/16),p=Math.ceil((Math.ceil((l+i-d)/r)+1)/16),m=f*16,h=p*16,g=m*h,_=new Uint8Array(f*p),v=16*r;for(let e=0;e<p;e++)for(let n=0;n<f;n++){let r=U;for(let i=0;i<=4&&r>=14;i++)for(let a=0;a<=4;a++){let o=t(u+(n-.5+a*.5)*v,d+(e-.5+i*.5)*v);o<r&&(r=o)}_[e*f+n]=+(r<14)}let y=[],b=0;for(let e=0;e<p;e++){let t=[];for(let n=0;n<f;n++)_[e*f+n]&&t.push(n);y.push(t),b+=t.length}let x=new Float32Array(g).fill(20),S=Math.max(1,Math.ceil(n/r)),C=0,w=new Float32Array(16/S+3),T=new Float32Array(16/S+3);for(let n=0;n<p;n++){let i=y[n];for(let a=0;a<i.length;a++){let o=i[a]*16,s=n*16;for(let n=0;n<16;n+=S){let i=d+(s+n)*r,a=i+S*r;for(let e=0,n=0;e<=16;e+=S,n++){let s=u+(o+e)*r;w[n]=t(s,i),T[n]=t(s,a)}for(let t=0,i=0;t<16;t+=S,i++){let a=w[i],c=w[i+1],l=T[i],f=T[i+1],p=Math.min(a,c,l,f)<3&&Math.max(a,c,l,f)>-5,h=Math.max(a,c,l,f)-Math.min(a,c,l,f)>8,g=Math.min(16,n+S),_=Math.min(16,t+S);for(let i=n;i<g;i++){let g=d+(s+i)*r,v=(s+i)*m+o,y=(i-n)/S;for(let n=t;n<_;n++){let i=u+(o+n)*r,s=(n-t)/S,d=a+(c-a)*s,m=d+(l+(f-l)*s-d)*y;p&&(!h||m<6&&m>-8)?(x[v+n]=e(i,g),C++):x[v+n]=m}}}}}}let E=performance.now(),D=new Float32Array(g).fill(1e9),O=new Float32Array(g).fill(-250),k=Math.SQRT2;for(let e=0;e<h;e++){let t=y[e/16|0];for(let n=0;n<t.length;n++){let r=t[n]*16+16;for(let i=t[n]*16;i<r;i++){let t=e*m+i,n=x[t],r=1e9,a=n<0;if(i>0&&x[t-1]<0!==a||i<m-1&&x[t+1]<0!==a||e>0&&x[t-m]<0!==a||e<h-1&&x[t+m]<0!==a){let a=0;i>0&&(a=Math.max(a,Math.abs(n-x[t-1]))),i<m-1&&(a=Math.max(a,Math.abs(n-x[t+1]))),e>0&&(a=Math.max(a,Math.abs(n-x[t-m]))),e<h-1&&(a=Math.max(a,Math.abs(n-x[t+m]))),r=a>1e-4?Math.min(1,Math.abs(n)/a):.5}i>0&&D[t-1]+1<r&&(r=D[t-1]+1),e>0&&(D[t-m]+1<r&&(r=D[t-m]+1),i>0&&D[t-m-1]+k<r&&(r=D[t-m-1]+k),i<m-1&&D[t-m+1]+k<r&&(r=D[t-m+1]+k)),D[t]=r}}}for(let e=h-1;e>=0;e--){let t=y[e/16|0];for(let n=t.length-1;n>=0;n--){let i=t[n];for(let t=i*16+16-1;t>=i*16;t--){let n=e*m+t,i=D[n];t<m-1&&D[n+1]+1<i&&(i=D[n+1]+1),e<h-1&&(D[n+m]+1<i&&(i=D[n+m]+1),t<m-1&&D[n+m+1]+k<i&&(i=D[n+m+1]+k),t>0&&D[n+m-1]+k<i&&(i=D[n+m-1]+k)),D[n]=i;let a=(x[n]<0?i:-i)*r;O[n]=a>250?250:a<-250?-250:a}}}let A=performance.now(),j=[0,0],P=N[N.length-1],F=N[N.length-2],I=P[0]-F[0],L=P[1]-F[1],R=Math.hypot(I,L);I/=R,L/=R;let z=m/4+1,B=h/4+1,V=new Float32Array(z*B),H=new Float32Array(z*B);for(let e=0;e<B;e++)for(let t=0;t<z;t++){let n=Math.min(m-1,t*4),i=Math.min(h-1,e*4);if(!_[(i/16|0)*f+(n/16|0)]||x[i*m+n]>12)continue;let a=u+t*4*r,o=d+e*4*r;te(a,o,j);let s=j[0],c=j[1],l=c/K,p=0,g=0;if(s<260&&l<.995){ee(c-90,q),ee(c+90,J);let e=J[0]-q[0],t=J[1]-q[1],n=Math.hypot(e,t)||1;e/=n,t/=n;let r=1.5*(1-.75*Z(.82,1,l))*(1-Z(200,260,s));p=e*r,g=t*r}let v=a-P[0],y=o-P[1],b=Math.hypot(v,y);if(b<520&&Math.abs(p)+Math.abs(g)<.05){let e=Math.exp(-b/170)*.5*Z(520,300,b);p+=(I*.6+v/(b+1)*.4)*e,g+=(L*.6+y/(b+1)*.4)*e}V[e*z+t]=p,H[e*z+t]=g}let W=performance.now(),G=new Uint16Array(g*4),Y=X(20),ne=X(-250);for(let e=0;e<g*4;e+=4)G[e]=Y,G[e+1]=ne;for(let e=0;e<h;e++){let t=e/4,n=Math.min(B-2,t|0),r=t-n,i=y[e/16|0];for(let t=0;t<i.length;t++){let a=i[t]*16;for(let t=a;t<a+16;t++){let i=e*m+t,a=i*4,o=x[i];if(G[a]=X(o),G[a+1]=X(O[i]),G[a+2]=0,G[a+3]=0,o>=0)continue;let s=t/4,c=Math.min(z-2,s|0),l=s-c,u=n*z+c;if(V[u]===0&&V[u+1]===0&&V[u+z]===0&&V[u+z+1]===0&&H[u]===0&&H[u+1]===0&&H[u+z]===0&&H[u+z+1]===0)continue;let d=Z(0,38,O[i]),f=V[u]+(V[u+1]-V[u])*l,p=V[u+z]+(V[u+z+1]-V[u+z])*l,h=H[u]+(H[u+1]-H[u])*l,g=H[u+z]+(H[u+z+1]-H[u+z])*l;G[a+2]=X((f+(p-f)*r)*d),G[a+3]=X((h+(g-h)*r)*d)}}}return{x0:u,z0:d,nx:m,nz:h,step:r,TS:16,ntx:f,ntz:p,active:_,height:x,sdf:O,px:G,stats:{texels:g,activeTexels:b*16*16,calls:C,ms:{heights:Math.round(E-a),sdf:Math.round(A-E),flow:Math.round(W-A),pack:Math.round(performance.now()-W)}}}}var ne=new Float32Array(1),re=new Uint32Array(ne.buffer);function X(e){ne[0]=e;let t=re[0],n=t>>>16&32768,r=(t>>>23&255)-112;return r<=0?n:r>=31?n|31744:n|r<<10|(t&8388607)>>>13}function Z(e,t,n){let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)}function ie(e){return W(e.heightAt,e.terrain?.grid)}function ae(t,n){let{x0:r,z0:i,nx:a,nz:o,step:s,TS:c,ntx:u,active:f,height:m}=t,h=new y(t.px,a,o,e,p);return h.magFilter=l,h.minFilter=l,h.wrapS=h.wrapT=d,h.generateMipmaps=!1,h.colorSpace=``,h.name=`water-data`,h.needsUpdate=!0,{tex:h,xf:new x(r-s*.5,i-s*.5,1/(a*s),1/(o*s)),x0:r,z0:i,nx:a,nz:o,step:s,height:m,sdf:t.sdf,groundAt(e,t){let l=(e-r)/s,d=(t-i)/s;if(l<0||d<0||l>a-1.001||d>o-1.001)return n(e,t);let p=l|0,h=d|0;if(!f[(h/c|0)*u+(p/c|0)])return n(e,t);let g=l-p,_=d-h,v=h*a+p,y=m[v]+(m[v+1]-m[v])*g;return y+(m[v+a]+(m[v+a+1]-m[v+a])*g-y)*_},stats:t.stats}}function oe(e){return e.grid?e.grid.step:e.own?e.own.step:24}function se(e,t,n){return ae(Y(e.heightAt,t.sample,oe(t),n),t.sample)}function ce(e,t){let n=null;try{n=new Worker(new URL(new URL(`water-bake-worker-DfGbNK0h.js`,import.meta.url).href,``+import.meta.url),{type:`module`})}catch{n=null}let r=!1,i=!1,a,o=new Promise(e=>a=e),s=e=>{i||(i=!0,n?.terminate(),a(e))},c=()=>(i||s(Object.assign(se(e,t),{by:`main`})),o);if(!n)return{result:o,started:()=>!1,local:c};n.onmessage=n=>{let i=n.data;if(i?.started){r=!0;return}if(!i?.ok){e.params.debug&&console.warn(`[water] bake worker failed:`,i?.error),c();return}s(Object.assign(ae(i.r,t.sample),{by:`worker`}))},n.onerror=t=>{e.params.debug&&console.warn(`[water] bake worker error:`,t.message),c()};let l=t.grid,u=l?{data:l.data.slice(),n:l.n,x0:l.x0,z0:l.z0,step:l.step}:null;return n.postMessage({grid:u},u?[u.data.buffer]:[]),{result:o,started:()=>r||i,local:c}}function le(e,t){let n,r,i,a,o=t.grid;if(o)({data:n,n:r,x0:i,step:a}=o);else{r=257,i=-4600,a=9200/(r-1),n=new Float32Array(r*r);for(let e=0;e<r;e++)for(let o=0;o<r;o++)n[e*r+o]=t.sample(i+o*a,i+e*a)}let s=new Uint16Array(r*r);for(let e=0;e<r*r;e++)s[e]=X(n[e]);let c=new y(s,r,r,j,p);return c.magFilter=l,c.minFilter=l,c.wrapS=c.wrapT=d,c.generateMipmaps=!1,c.colorSpace=``,c.name=`water-world-height`,c.needsUpdate=!0,{tex:c,xf:new x(i-a*.5,i-a*.5,1/(r*a),1/(r*a))}}var ue=`
uniform float uWTime;
uniform sampler2D uWWaves;
uniform sampler2D uWNoise;
uniform vec4 uWWind;        // xy wind dir, z wind speed (m/s), w windiness scale
uniform vec4 uWDirA;        // wave layer directions (xy, zw)
uniform vec4 uWDirB;
uniform vec4 uWParams;      // x turbidity (1/m), y foam, z specular clamp, w ripple slope scale
uniform vec3 uWShallow;
uniform vec3 uWDeep;
uniform vec3 uWSkyZen;
uniform vec3 uWSkyHor;
uniform vec3 uWSkySun;      // the sky's sun colour (glow around the sun)
uniform vec4 uWSkyP;        // the sky's uSun: z glow strength, w twilight
uniform vec3 uWSkyBelt;     // belt of Venus colour
uniform vec4 uWSkyNight;    // the sky's uNight (x night)
uniform vec4 uWSkyMoon;     // the sky's uMoon (y moon brightness)
uniform vec3 uWSkyMoonDir;
uniform vec3 uWKeyCol;      // key light colour * intensity (sun by day, moon by night)
uniform vec3 uWKeyDir;
uniform vec3 uWAmb;         // ambient irradiance for ray-marched reflections
uniform vec3 uWAmbGround;
uniform sampler2D uWHeight; // world height (reflection ray-march)
uniform vec4 uWHeightXf;
uniform vec4 uWMarch;       // x first step, y growth, z max distance, w snow line
uniform float uWReflBoost;  // env map -> true sky radiance (IBL is dimmed for diffuse fill)
#ifndef W_LOCAL
uniform sampler2D uWData;
uniform vec4 uWDataXf;
#endif
#ifdef W_TERRMAPS
uniform sampler2D uWTerrB;
uniform sampler2D uWTerrSun;
uniform vec4 uWTerrXf;
#endif
#ifdef W_PLANAR
uniform sampler2D uWPlanar;
uniform mat4 uWPlanarMat;
uniform vec4 uWPlanarP;     // x on (0/1), y distortion, z max lod
#endif
#ifdef W_CONTACT
uniform sampler2D uWContact;
uniform vec4 uWContactXf;
#endif
uniform vec4 uWFoamPts[4];   // plunge points of the falls: x, z, radius, strength
varying vec3 vWPos;
#ifdef W_LOCAL
varying vec4 vWater;
#endif

float wBody;
vec3 wRefl;
vec3 wDbgRefl;
float wDbgHit;
float wEdge;
float wFoam;
float wRough;
float wDist;
vec3 wN;
vec3 wV;

vec2 wLayer(vec2 p, vec2 d, float scale, float speed, float t) {
  vec2 dp = vec2(-d.y, d.x);
  vec2 q = vec2(dot(p, d), dot(p, dp));
  vec2 s = (texture2D(uWWaves, (q - vec2(speed * t, 0.0)) / scale).rg * 2.0 - 1.0) * 0.5;
  return s.x * d + s.y * dp;
}

vec2 wSlopes(vec2 p, float t, float amp, float fine, float far) {
  // the long swells fade with distance (a distant lake reads as a mirror, its glitter comes from
  // the roughness instead), the short chop only exists where the wind touches the water
  vec2 s = wLayer(p, uWDirA.xy, 97.0, 1.9, t) * (0.1 + 0.32 * amp) * far;
  s += wLayer(p + vec2(31.7, -3.1), uWDirA.zw, 29.0, 1.25, t) * (0.5 * amp) * mix(1.0, far, 0.6);
  s += wLayer(p + vec2(-13.1, 7.7), uWDirB.xy, 8.3, 0.8, t) * (0.62 * amp);
  s += wLayer(p + vec2(5.3, 11.9), uWDirB.zw, 2.3, 0.45, t) * (0.58 * amp * fine);
  return s * uWParams.w;
}

float wTerrainHeight(vec2 xz) {
  vec2 uv = (xz - uWHeightXf.xy) * uWHeightXf.zw;
  return textureLod(uWHeight, uv, 0.0).r;
}

// Colour of the terrain at a ray-march hit (lit + fogged along the reflected segment).
vec3 wTerrainColor(vec3 hp, vec3 from) {
  float e = 9.0;
  float hx = wTerrainHeight(hp.xz + vec2(e, 0.0)) - wTerrainHeight(hp.xz - vec2(e, 0.0));
  float hz = wTerrainHeight(hp.xz + vec2(0.0, e)) - wTerrainHeight(hp.xz - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx, 2.0 * e, -hz));
  float slope = 1.0 - n.y;
  vec3 alb = vec3(0.075, 0.09, 0.05);
  float vis = 1.0;
#ifdef W_TERRMAPS
  vec2 tuv = (hp.xz - uWTerrXf.xy) * uWTerrXf.z + uWTerrXf.w;
  vec4 tb = textureLod(uWTerrB, tuv, 0.0);
  alb = mix(vec3(0.15, 0.15, 0.075), vec3(0.045, 0.07, 0.035), tb.r); // meadow -> forest
  alb = mix(alb, vec3(0.33, 0.29, 0.23), tb.b * 0.8);                     // talus
  alb = mix(alb, vec3(0.46, 0.2, 0.08), tb.a * 0.8);                      // sandstone
  vis = textureLod(uWTerrSun, tuv, 0.0).r;
#endif
  // bare limestone on steep ground (the terrain's C_LIME palette), sand at the waterline
  alb = mix(alb, vec3(0.4, 0.35, 0.27), smoothstep(0.35, 0.65, slope) * (1.0 - 0.6 * smoothstep(0.3, 0.7, alb.r - alb.b)));
  alb = mix(alb, vec3(0.5, 0.4, 0.24), 1.0 - smoothstep(1.0, 4.0, hp.y)); // beach
  float snow = smoothstep(uWMarch.w - 120.0, uWMarch.w + 180.0, hp.y) * (1.0 - smoothstep(0.55, 0.8, slope));
  alb = mix(alb, vec3(0.82, 0.84, 0.88), snow);
  float ndl = max(dot(n, uWKeyDir), 0.0);
  vec3 irr = uWKeyCol * ndl * vis + mix(uWAmbGround, uWAmb, n.y * 0.5 + 0.5) * 1.35;
  vec3 c = alb * irr * 0.3183;
#ifdef USE_FOG
  vec4 f = atmoFogTerm(from, hp);
  c = mix(c, f.rgb, f.a);
#endif
  return c;
}

float wHg(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.566 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}

// The sky without clouds, as the sky module draws it (gradient, sun-side glow, belt of Venus, moon
// glow, and the haze band from the shared atmosphere), seen from the water. Used where the
// environment map is missing or unusable, and as the sharp base under the blurred env map.
vec3 wSky(vec3 rd, vec3 ro) {
  const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
  float y = max(rd.y, 0.0);
  float mu = dot(rd, uAtmoSunDir);
  float air = exp(-y * 2.6);
  float lumH = dot(uWSkyHor, LUM);
  float lumZ = dot(uWSkyZen, LUM);
  vec3 pale = mix(uWSkyZen / max(lumZ, 1e-4), vec3(1.0), 0.74) * mix(lumZ, lumH, 0.7);
  vec3 col = mix(uWSkyZen, pale, smoothstep(0.08, 0.95, air));
  col = mix(col, uWSkyHor, pow(air, 6.0));
  float side = 0.5 + 0.5 * mu;
  col *= mix(0.8, 1.16, side * side);
  float sunUp = smoothstep(-0.2, 0.02, uAtmoSunDir.y);
  vec3 glowCol = mix(uWSkySun, vec3(dot(uWSkySun, LUM)) * vec3(1.2, 1.0, 0.72), 0.3);
  float g = uWSkyP.z * sunUp * (wHg(mu, 0.82) * 0.8 + wHg(mu, 0.45) * 0.55) * (0.45 + 0.55 * air);
  col = col * (1.0 - clamp(g * 0.55, 0.0, 0.85)) + glowCol * g;
  float mmu = dot(rd, uWSkyMoonDir);
  col += vec3(0.32, 0.42, 0.75) * uWSkyNight.x * uWSkyMoon.y * (0.0025 + 0.02 * wHg(mmu, 0.55)) * smoothstep(-0.05, 0.1, uWSkyMoonDir.y);
  float anti = max(-mu, 0.0);
  float belt = exp(-pow((y - 0.09) / 0.07, 2.0)) * (0.3 + 0.7 * anti);
  col += uWSkyBelt * belt * uWSkyP.w;
  col *= 1.0 - 0.3 * uWSkyP.w * exp(-pow(y / 0.045, 2.0)) * anti;
#ifdef USE_FOG
  vec3 hazeCol = atmoInscatter(rd);
  vec3 rdH = normalize(vec3(rd.x, rd.y * 1.8, rd.z));
  float opt = atmoOptical(ro, rdH, 60000.0) - atmoOptical(ro, vec3(0.0, 1.0, 0.0), 60000.0);
  col = mix(col, hazeCol, 1.0 - exp(-max(opt, 0.0)));
#endif
  return col;
}

// Reflected radiance: sky (env map / analytic sky), ray-marched terrain, planar texture.
vec3 wReflection(vec3 envRad, float envOk, vec3 wp, vec3 R, float rough) {
  vec3 col = wSky(R, wp);
#ifdef USE_ENVMAP
  // the env map carries the clouds, but it is a blurred probe; lean on it more as the water roughens
  col = mix(col, envRad * uWReflBoost, envOk * mix(0.75, 1.0, smoothstep(0.05, 0.25, rough)));
#endif
#if defined(W_PLANAR) && defined(W_PLANAR_SKY)
  // the real sky (clouds, stars, aurora) from the sky-only mirror pass; the sun disk is left to
  // the key light's glitter, so the sample is capped relative to the cloudless sky
  if (uWPlanarP.x > 0.5) {
    vec4 pc = uWPlanarMat * vec4(wp, 1.0);
    vec2 puv = pc.xy / pc.w + (wN.xz * uWPlanarP.y) / (1.0 + wDist * 0.0015);
    float lod = clamp(rough * 14.0 - 0.3, 0.0, uWPlanarP.z);
    vec3 ps = textureLod(uWPlanar, puv, lod).rgb;
    // one NaN/Inf texel in the mirror spreads through its mips into a block: drop such samples
    if (!(ps.r + ps.g + ps.b < 6.0e4)) ps = col;
    ps = min(ps, col * 4.0 + 0.01);
    vec2 eg = smoothstep(vec2(0.0), vec2(0.03), puv) * smoothstep(vec2(0.0), vec2(0.03), 1.0 - puv);
    col = mix(col, ps, eg.x * eg.y);
  }
#endif
#ifdef W_MARCH
  // exponential march through the world height field; a few bisection steps on a hit
  float t0 = 0.0;
  float t = uWMarch.x;
  float hit = -1.0;
  vec3 o = wp + vec3(0.0, 0.3, 0.0);
  for (int i = 0; i < W_MARCH; i++) {
    vec3 q = o + R * t;
    if (q.y > 2600.0) break;
    if (q.y < wTerrainHeight(q.xz)) { hit = t; break; }
    t0 = t;
    t = t * uWMarch.y;
    if (t > uWMarch.z) break;
  }
  if (hit > 0.0) {
    // how far under the ground the step landed, relative to the step: grazing rays that only
    // clip a ridge get a partial (anti-aliased, roughness-blurred) contribution
    vec3 qh = o + R * hit;
    float pen = (wTerrainHeight(qh.xz) - qh.y) / max(hit - t0, 1.0);
    float a = t0;
    float b = hit;
    for (int k = 0; k < 5; k++) {
      float m = 0.5 * (a + b);
      vec3 q = o + R * m;
      if (q.y < wTerrainHeight(q.xz)) b = m; else a = m;
    }
    vec3 hp = o + R * b;
    vec3 tc = wTerrainColor(hp, o);
    col = mix(col, tc, smoothstep(0.0, 0.015 + rough * 0.35, pen));
    wDbgHit = 1.0;
  }
#endif
#if defined(W_PLANAR) && !defined(W_PLANAR_SKY)
  if (uWPlanarP.x > 0.5) {
    vec4 pc = uWPlanarMat * vec4(wp, 1.0);
    vec2 puv = pc.xy / pc.w + (wN.xz * uWPlanarP.y) / (1.0 + wDist * 0.0015);
    float lod = clamp(rough * 18.0 - 0.6, 0.0, uWPlanarP.z);
    vec3 pr = textureLod(uWPlanar, puv, lod).rgb;
    // NaN * 0 is still NaN, so a bad mirror sample must be replaced, not just weighted away
    if (!(pr.r + pr.g + pr.b < 6.0e4)) pr = col;
    pr = min(pr, vec3(2.0e3));
    vec2 eg = smoothstep(vec2(0.0), vec2(0.04), puv) * smoothstep(vec2(0.0), vec2(0.04), 1.0 - puv);
    float pw = eg.x * eg.y * (1.0 - smoothstep(0.16, 0.4, rough));
    col = mix(col, pr, pw);
  }
#endif
  return col;
}
`,de=`
{
  wDbgHit = 0.0;
  wDbgRefl = vec3(0.0);
  wRefl = vec3(0.0);
  vec3 wp = vWPos;
  vec3 wToCam = cameraPosition - wp;
  wDist = length(wToCam);
  wV = wToCam / max(wDist, 1e-3);
  float t = uWTime;
  float depth;
  float sdf;
  vec2 flow;
  float rapids = 0.0;
#ifdef W_LOCAL
  depth = vWater.x;
  rapids = vWater.y;
  flow = vWater.zw;
  sdf = max(depth, 0.0) * 9.0;
#else
  vec4 bd = texture2D(uWData, (wp.xz - uWDataXf.xy) * uWDataXf.zw);
  depth = -bd.r;
  sdf = bd.g;
  flow = bd.ba;
#endif
  float flowLen = length(flow);
  float river = smoothstep(0.04, 0.7, flowLen);

  // ---- wind field: slow drifting patches of ripples + long lanes along the wind
  vec2 wd = uWWind.xy;
  vec2 wq = vec2(dot(wp.xz, wd), dot(wp.xz, vec2(-wd.y, wd.x)));
  float n1 = texture2D(uWNoise, wp.xz / 1900.0 - wd * t * 0.0011).r;
  float n2 = texture2D(uWNoise, wp.xz / 640.0 - wd * t * 0.0029).g;
  float lanes = texture2D(uWNoise, vec2((wq.x - t * 2.2) / 1500.0, wq.y / 110.0)).a;
  float windy = smoothstep(0.5, 0.84, n1 * 0.62 + n2 * 0.38);
  windy = clamp(windy + (lanes - 0.55) * 1.1 * (0.2 + windy), 0.0, 1.0) * uWWind.w;
  float amp = mix(0.04, 1.0, windy);
  amp = max(amp, river * 0.45 + rapids * 0.7);
  amp *= mix(0.45, 1.0, smoothstep(1.0, 30.0, sdf)); // sheltered right at the shore

  // ---- wave slopes (advected along the flow in rivers and streams)
  float fine = 1.0 - smoothstep(80.0, 520.0, wDist);
  float far = 1.0 - 0.7 * smoothstep(400.0, 2600.0, wDist);
  vec2 slope;
  float rfoam = 0.0;
  if (flowLen > 0.03) {
    const float T = 2.4;
    float ph0 = fract(t / T);
    float ph1 = fract(t / T + 0.5);
    float bw = abs(2.0 * ph0 - 1.0);
    vec2 p0 = wp.xz - flow * (ph0 * T);
    vec2 p1 = wp.xz - flow * (ph1 * T) + vec2(17.3, 5.1);
    vec2 s0 = wSlopes(p0, t, amp, fine, far);
    vec2 s1 = wSlopes(p1, t, amp, fine, far);
    slope = mix(s0, s1, bw) / sqrt(bw * bw + (1.0 - bw) * (1.0 - bw));
    // foam streaks stretched along the current, gathered into a few drifting lines where the
    // currents converge (a static lane pattern across the flow)
    vec2 fd = flow / flowLen;
    vec2 fp = vec2(-fd.y, fd.x);
    vec2 q0 = vec2(dot(p0, fd) / 170.0, dot(p0, fp) / 10.0);
    vec2 q1 = vec2(dot(p1, fd) / 170.0, dot(p1, fp) / 10.0);
    float f0 = texture2D(uWNoise, q0).a;
    float f1 = texture2D(uWNoise, q1).a;
    float lane = smoothstep(0.5, 0.78, texture2D(uWNoise, vec2(dot(wp.xz, fp) / 90.0, dot(wp.xz, fd) / 1400.0)).g);
    rfoam = smoothstep(0.62, 0.9, mix(f0, f1, bw)) * lane * river * (0.25 + 0.5 * smoothstep(0.6, 1.4, flowLen));
    rfoam = max(rfoam, rapids * smoothstep(0.35, 0.75, mix(f0, f1, bw) + 0.25 * rapids));
  } else {
    slope = wSlopes(wp.xz, t, amp, fine, far);
  }
  wN = normalize(vec3(-slope.x, 1.0, -slope.y));
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
#ifdef DOUBLE_SIDED
  normal *= faceDirection;
#endif

  // ---- roughness: sub-pixel ripples we can no longer resolve widen the glitter with distance
  float distR = smoothstep(30.0, 2800.0, wDist);
  wRough = mix(0.06, 0.2, distR) * mix(0.5, 1.0, windy) + 0.12 * river * distR + 0.05 * rapids;

  // ---- sun / moon glitter. The direct light sees a rougher sea than the mirror does: a field of
  // fine facets (0.9 m and 2.9 m ripples, strongest in the wind) tilts the normal used for the key
  // light only, so near the camera the path breaks into individual glints; where those facets
  // shrink below a pixel the mipmaps flatten them and the roughness takes over, widening the path
  // toward the horizon. The reflection keeps using the calmer wN.
  {
    vec2 gs = wLayer(wp.xz + vec2(2.9, -7.3), uWDirB.xy, 0.93, 0.31, t) + wLayer(wp.xz + vec2(-5.1, 3.3), uWDirA.zw, 2.9, 0.6, t) * 0.8;
    // facets smaller than a few pixels only alias: fade them by the pixel footprint (metres) and
    // hand their energy to the roughness instead
    float fp = length(fwidth(wp.xz));
    float gRes = 1.0 - smoothstep(0.06, 0.3, fp);
    float gAmp = (0.35 + 0.65 * windy) * (1.0 - smoothstep(60.0, 700.0, wDist)) * (1.0 - river * 0.5) * gRes;
    gAmp *= mix(0.35, 1.0, smoothstep(2.0, 40.0, sdf)); // sheltered, glassy water along the shore
    vec3 gN = normalize(vec3(-(slope.x + gs.x * gAmp), 1.0, -(slope.y + gs.y * gAmp)));
    normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);
#ifdef DOUBLE_SIDED
    normal *= faceDirection;
#endif
    roughnessFactor = mix(0.1, 0.24, windy) + 0.2 * distR + 0.06 * river + 0.1 * rapids + 0.1 * (1.0 - gRes) * (1.0 - distR);
  }

  // ---- water body: Beer-Lambert over the refracted view path down to the bed and back
  float dpos = max(depth, 0.0);
  float cosT = sqrt(max(1.0 - (1.0 - wV.y * wV.y) / 1.777, 0.04));
  float path = dpos * (1.0 / cosT + 1.0);
  float turb = uWParams.x * (1.0 + 1.6 * river + 2.0 * rapids);
  wBody = 1.0 - exp(-path * turb);
  vec3 bodyCol = mix(uWShallow, uWDeep, smoothstep(0.6, 18.0, dpos));
  bodyCol = mix(bodyCol, uWShallow * vec3(1.05, 0.95, 0.72), river * 0.35); // silty river

  // ---- foam: contact line, bands drifting in toward the shore, river streaks
  float fc = texture2D(uWNoise, wp.xz / 19.0 + slope * 0.8 + vec2(t * 0.012, -t * 0.004)).b;
  float fn = texture2D(uWNoise, wp.xz / 83.0 - vec2(0.0, t * 0.003)).a;
  float band = fract(sdf / 8.5 + t * 0.055 + fn * 0.9);
  float bands = smoothstep(0.78, 0.96, band) * (1.0 - smoothstep(1.5, 26.0, sdf)) * (0.4 + 0.6 * windy) * (1.0 - 0.8 * river);
  float contact = 1.0 - smoothstep(0.2, 1.4 + fn * 2.6, sdf);
  float cells = smoothstep(0.2, 0.7, fc + fn * 0.35);
  wFoam = max(contact * 0.85, bands * 0.5) * cells;
  wFoam = max(wFoam, rfoam * smoothstep(0.1, 0.6, fc + 0.3));
#ifdef W_CONTACT
  {
    vec2 cuv = (wp.xz - uWContactXf.xy) * uWContactXf.zw;
    if (cuv.x > 0.0 && cuv.y > 0.0 && cuv.x < 1.0 && cuv.y < 1.0) {
      float cd = texture2D(uWContact, cuv).r * 25.5;   // metres to the nearest thing standing in the water
      // a lacy collar hugging the stone, faint ripple rings drifting off it (kept thin: from
      // afar a wide ring reads as a halo)
      float ring = 1.0 - smoothstep(0.2, 1.3 + fn * 1.8, cd);
      float cband = smoothstep(0.85, 0.97, fract(cd / 5.0 + t * 0.07 + fn * 0.6)) * (1.0 - smoothstep(1.0, 9.0, cd));
      wFoam = max(wFoam, max(ring * 0.75, cband * 0.22) * cells * (1.0 - 0.6 * smoothstep(150.0, 900.0, wDist)));
    }
  }
#endif
  // churned water where the falls come down
  for (int i = 0; i < 4; i++) {
    vec4 fp = uWFoamPts[i];
    if (fp.z <= 0.0) continue;
    float dd = length(wp.xz - fp.xy);
    if (dd > fp.z * 2.0) continue;
    float core = 1.0 - smoothstep(fp.z * 0.2, fp.z, dd + (fn - 0.5) * fp.z * 0.5);
    float rings = smoothstep(0.7, 0.95, fract(dd / 6.5 - t * 0.3 + fn * 1.3)) * (1.0 - smoothstep(fp.z * 0.6, fp.z * 2.0, dd));
    wFoam = max(wFoam, (core + rings * 0.55) * smoothstep(0.1, 0.55, fc + fn * 0.4 + core * 0.3) * fp.w);
  }
  wFoam = clamp(wFoam * uWParams.y, 0.0, 1.0);

  diffuseColor.rgb = mix(bodyCol, vec3(0.78, 0.8, 0.8), wFoam);
  wBody = max(wBody, wFoam);

  // ---- soft waterline (depth -> 0) so there is never a hard seam against the terrain
  wEdge = smoothstep(0.0, 0.3, depth + (fn - 0.5) * 0.16);
}
`,fe=`
#if defined( RE_IndirectSpecular )
{
  // facets tilted so far that the reflected ray would dive into the water really see the backs
  // of neighbouring waves: keep those rays just above the horizon (haze), never below it
  vec3 wR = reflect(-wV, wN);
  wR.y = max(wR.y, 0.035 + 0.02 * wRough);
  wR = normalize(wR);
  // sample the sky ourselves along the clamped ray (the engine's lookup would see the dark lower
  // hemisphere of the environment map for every facet tilted away from the viewer)
  #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
    vec3 wEnv = textureCubeUV(envMap, envMapRotation * wR, max(wRough, 0.0525)).rgb * envMapIntensity;
    // trust the env map only if it really holds the sky (a probe that failed to capture the sky
    // dome comes back black): its blurred zenith against the palette's zenith
    vec3 wEnvUp = textureCubeUV(envMap, envMapRotation * vec3(0.0, 1.0, 0.0), 0.6).rgb * envMapIntensity * uWReflBoost;
    float wEnvOk = smoothstep(0.2, 0.55, dot(wEnvUp, vec3(0.33)) / max(dot(uWSkyZen, vec3(0.33)), 1e-5));
  #else
    vec3 wEnv = radiance;
    float wEnvOk = 0.0;
  #endif
  radiance = wReflection(wEnv, wEnvOk, vWPos, wR, wRough);
  wRefl = radiance;
  wDbgRefl = radiance;
#if defined(W_DEBUG) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
  if (W_DEBUG == 5) wDbgRefl = wEnv;
  if (W_DEBUG == 6) wDbgRefl = textureCubeUV(envMap, envMapRotation * vec3(wR.x, -wR.y, wR.z), material.roughness).rgb * envMapIntensity;
  if (W_DEBUG == 7) wDbgRefl = vec3(envMapIntensity * 0.5, material.roughness, 0.0);
#endif
}
#endif
`,pe=`
{
  float m = max(max(reflectedLight.directSpecular.r, reflectedLight.directSpecular.g), reflectedLight.directSpecular.b);
  // written so NaN and Inf fail the test too (they would pass a plain m > limit untouched)
  if (!(m <= uWParams.z)) reflectedLight.directSpecular = (m == m && m < 1.0e30) ? reflectedLight.directSpecular * (uWParams.z / m) : vec3(0.0);
}
`,me=`
{
  // the mirror term is weighted with the mirror's own normal and roughness (the engine's indirect
  // specular would use the glitter facets and roughness meant for the key light only)
  vec3 wSpecInd = wRefl * EnvironmentBRDF(wN, wV, vec3(0.02), 1.0, max(wRough, 0.0525));
  vec3 wSpec = (reflectedLight.directSpecular + wSpecInd) * (1.0 - wFoam * 0.75);
  // body / foam fill light: our own sky irradiance (the scene IBL may be missing or dim)
  vec3 wDiff = reflectedLight.directDiffuse + diffuseColor.rgb * uWAmb * RECIPROCAL_PI;
  float ndv = clamp(dot(wN, wV), 0.0, 1.0);
  float fr = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  float wa = 1.0 - (1.0 - fr) * (1.0 - wBody);
  vec3 wc = wSpec + wDiff * wBody * (1.0 - fr);
  if (!gl_FrontFacing) {
    // seen from below: murky, with the bright sky window straight above
    wc = uWDeep * 3.0 + uWShallow * 0.4 * pow(clamp(-wV.y, 0.0, 1.0), 4.0) * (uWKeyCol + uWAmb);
    wa = 0.9;
  }
  wc *= wEdge;
  wa *= wEdge;
  gl_FragColor = vec4(wc, wa);
#ifdef W_DEBUG
  if (W_DEBUG == 1 || W_DEBUG >= 5) gl_FragColor = vec4(wDbgRefl, 1.0);
  if (W_DEBUG == 2) gl_FragColor = vec4(wDbgHit, fr, wBody, 1.0);
  if (W_DEBUG == 3) gl_FragColor = vec4(wSpecInd, 1.0);
  if (W_DEBUG == 4) gl_FragColor = vec4(wDiff, 1.0);
#endif
}
`,he=`
#ifdef USE_FOG
{
  vec4 wf = atmoFogTerm(cameraPosition, vAtmoWorldPos);
  gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - wf.a) + wf.rgb * (wf.a * gl_FragColor.a);
}
#endif
`;function ge(e,t,{local:n=!1,planar:r=!1,contact:i=!1,march:a=0,terrMaps:o=!1,name:s=`water`,debug:c=0}={}){let l=new O({color:662048,roughness:.08,metalness:0,ior:1.333,specularIntensity:1,transparent:!0,premultipliedAlpha:!0,depthWrite:!0,side:2});l.name=s;let u={};n&&(u.W_LOCAL=``),r&&(u.W_PLANAR=``),r===`sky`&&(u.W_PLANAR_SKY=``),i&&(u.W_CONTACT=``),a>0&&(u.W_MARCH=String(a)),o&&(u.W_TERRMAPS=``),c&&(u.W_DEBUG=String(c)),l.defines={...l.defines||{},...u};let d=`mw-water|${Object.keys(u).sort().join(`,`)}|${a}`;return l.onBeforeCompile=e=>{Object.assign(e.uniforms,t);let n=e.vertexShader;n=n.replace(`#include <common>`,`#include <common>
varying vec3 vWPos;
#ifdef W_LOCAL
attribute vec4 aWater;
varying vec4 vWater;
#endif`),n=n.replace(`#include <project_vertex>`,`#include <project_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#ifdef W_LOCAL
vWater = aWater;
{
  // depth bias toward the camera: streams and pools sit a hair above the ground and must win the
  // depth test against the terrain's LOD mesh at any distance without visibly floating
  vec3 toC = cameraPosition - vWPos;
  float dC = length(toC);
  vec3 biased = vWPos + toC * (min(dC * 0.004, 14.0) / max(dC, 1e-3));
  mvPosition = viewMatrix * vec4(biased, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
#endif`),e.vertexShader=n;let r=e.fragmentShader;r=r.replace(`#include <clipping_planes_pars_fragment>`,`#include <clipping_planes_pars_fragment>\n${ue}`),r=r.replace(`#include <normal_fragment_maps>`,de),r=r.replace(`#include <lights_fragment_maps>`,`#include <lights_fragment_maps>\n${fe}`),r=r.replace(`#include <lights_fragment_end>`,`#include <lights_fragment_end>\n${pe}`),r=r.replace(`#include <opaque_fragment>`,me),r=r.replace(`#include <fog_fragment>`,he),r=r.replace(`#include <premultiplied_alpha_fragment>`,``),e.fragmentShader=r},l.customProgramCacheKey=()=>d,l}function _e(){return{uWTime:{value:0},uWWaves:{value:null},uWNoise:{value:null},uWWind:{value:new x(.92,-.39,3,1)},uWDirA:{value:new x(1,0,0,1)},uWDirB:{value:new x(1,0,0,1)},uWParams:{value:new x(.2,1,9,1)},uWShallow:{value:new u(.06,.15,.12)},uWDeep:{value:new u(.004,.012,.02)},uWSkyZen:{value:new u(.2,.35,.6)},uWSkyHor:{value:new u(.8,.7,.6)},uWSkySun:{value:new u(1,.7,.4)},uWSkyP:{value:new x(0,0,.6,0)},uWSkyBelt:{value:new u(0,0,0)},uWSkyNight:{value:new x(0,1,1,1)},uWSkyMoon:{value:new x(0,1,0,1)},uWSkyMoonDir:{value:new k(0,1,0)},uWKeyCol:{value:new u(1,1,1)},uWKeyDir:{value:new k(0,1,0)},uWAmb:{value:new u(.3,.35,.45)},uWAmbGround:{value:new u(.1,.09,.08)},uWHeight:{value:null},uWHeightXf:{value:new x},uWMarch:{value:new x(3,1.33,7500,1020)},uWReflBoost:{value:1.3},uWData:{value:null},uWDataXf:{value:new x},uWTerrB:{value:null},uWTerrSun:{value:null},uWTerrXf:{value:new x},uWPlanar:{value:null},uWPlanarMat:{value:new S},uWPlanarP:{value:new x(0,.045,5,0)},uWContact:{value:null},uWFoamPts:{value:[new x,new x,new x,new x]},uWContactXf:{value:new x}}}var ve=9.81;function ye(e,t){let n=e.cliffLineZ(t),r=-((e.cliffLineZ(t+5)-e.cliffLineZ(t-5))/10),i=1,a=Math.hypot(r,i);r/=a,i/=a;let o=t-r*90,s=n-i*90,c=e.heightAt(o,s);for(let a=-90;a<60;a+=1){let l=t+r*a,u=n+i*a,d=e.heightAt(l,u);if(d<c-1.5)return{x:o,z:s,y:c,dx:r,dz:i};c=Math.max(d,c-.2),o=l,s=u}return{x:o,z:s,y:c,dx:r,dz:i}}function be(e,t,n,r,i,a=700){for(let o=0;o<a;o+=2){let a=t+r*o,s=n+i*o,c=e.heightAt(a,s);if(c-e.heightAt(a+r*25,s+i*25)>28){let a=o;for(;a>0&&e.heightAt(t+r*a,n+i*a)<c-1;)--a;return{x:t+r*a,z:n+i*a,y:e.heightAt(t+r*a,n+i*a),dx:r,dz:i}}}return null}function xe(e){let t=e.layout,n=[];for(let[t,r,i,a]of[[`escarpment-west`,-2050,30,4.6],[`escarpment-east`,-800,27,4]]){let o=ye(e,r);n.push({id:t,lip:o,width:i,v0:a,stop:`ground`,spread:2.1,feeder:260,mist:1,seed:n.length})}{let[r,i]=t.CANYON[0],[a,o]=t.CANYON[1],s=Math.hypot(a-r,o-i),c=(a-r)/s,l=(o-i)/s,u=l,d=-c,f=be(e,a+c*80+u*330,o+l*80+d*330,-u,-d);f&&n.push({id:`canyon-head`,lip:f,width:28,v0:3.8,stop:`water`,spread:1.5,feeder:220,mist:.8,seed:2})}{let r=t.LANDMARK_BY_ID.needles,i=2.4,a=Math.cos(i),o=Math.sin(i),s=be(e,r.x+a*380,r.z+o*380,a,o,300);s&&n.push({id:`needle-rim`,lip:s,width:20,v0:3.4,stop:`ground`,spread:1.3,feeder:60,mist:.6,seed:3})}return n}function Se(e,t,n,r=2.5){let{lip:i}=t,a=new k(i.x,i.y+.6,i.z),o=new k(i.dx*n,0,i.dz*n),s={x:0,y:1,z:0},c=[],l=0,u=0,d=-1e9,f=!1,p=0,m=.04,h=new k;for(let n=0;n<6e3;n++){h.copy(a),o.y-=ve*m,a.addScaledVector(o,m),l+=m;let n=e.heightAt(a.x,a.z),g=!1;if(a.y<n+r){g=!0,a.y=n+r,e.normalAt(a.x,a.z,s);let t=o.x*s.x+o.y*s.y+o.z*s.z;t<0&&(o.x-=s.x*t,o.y-=s.y*t,o.z-=s.z*t),o.multiplyScalar(.975),o.x+=i.dx*.25,o.z+=i.dz*.25}else a.y>n+r+6&&(f=!0);u+=a.distanceTo(h);let _=o.length();if(u-d>Math.min(6,2+_*.06)&&(c.push({p:a.clone(),t:l,speed:_,contact:g}),d=u),p=i.y-a.y,t.stop===`water`&&a.y<.5)break;if(t.stop===`ground`&&g&&p>30&&f){let t=1-s.y,n=e.heightAt(a.x+i.dx*35,a.z+i.dz*35);if(t<.25&&n>a.y-12)break}if(p>30&&g&&Math.hypot(o.x,o.z)<1.5&&Math.abs(o.y)<1)break}return c.push({p:a.clone(),t:l,speed:o.length(),contact:!0}),{pts:c,drop:p,time:l}}var Ce=new k;new k;var Q=new k,$=new k;new k(0,1,0);function we(e,t,n,r,i){let a=n.pts,o=a.length,s=i.across??11,c=new k(r.z,0,-r.x).normalize(),l=a[o-1].t,u=t.pos.length/3,d=0,f=-1;for(let n=0;n<o;n++){let u=n/(o-1);if(u<i.start||u>i.end)continue;f<0&&(f=n);let p=a[Math.max(0,n-1)].p,m=a[Math.min(o-1,n+1)].p;Ce.subVectors(m,p).normalize(),Q.crossVectors(c,Ce).normalize(),Q.x*r.x+Q.z*r.z<0&&Q.negate();let h=a[n],g=i.width0*(1+i.spread*u**1.15),_=i.offset*(1+.6*u);for(let n=0;n<s;n++){let r=n/(s-1)*2-1;$.copy(h.p).addScaledVector(c,_+r*g/2).addScaledVector(Q,i.bulge*(1-r*r)*(.4+u)+i.push*u);for(let t=0;t<14;t++){let t=e.heightAt($.x,$.z);if($.y>t+1.8)break;$.addScaledVector(Q,2.2),h.contact&&($.y=Math.max($.y,t+1.2))}t.pos.push($.x,$.y,$.z),t.nrm.push(Q.x,Q.y,Q.z),t.uv.push(r,r*g/2+_),t.fall.push(h.t,u,h.speed,i.seed),t.strand.push(i.alpha,i.veil,+!!h.contact,l)}d++}for(let e=0;e<d-1;e++)for(let n=0;n<s-1;n++){let r=u+e*s+n,i=r+s;t.idx.push(r,i,r+1,r+1,i,i+1)}return{first:f,rows:d,M:s,base:u}}var Te=`
uniform sampler2D uHeight;
uniform vec4 uHeightXf;
uniform vec3 uKeyDir;
float wfHeight(vec2 xz) {
  return textureLod(uHeight, (xz - uHeightXf.xy) * uHeightXf.zw, 0.0).r;
}
float wfLightVis(vec3 p) {
  float t = 9.0;
  float vis = 1.0;
  for (int i = 0; i < 22; i++) {
    vec3 q = p + uKeyDir * t;
    if (q.y > 2600.0) break;
    vis = min(vis, clamp((q.y - wfHeight(q.xz)) / (0.06 * t + 2.0) + 0.5, 0.0, 1.0));
    if (vis <= 0.0) break;
    t *= 1.33;
  }
  return vis;
}
`,Ee=`
attribute vec4 aFall;    // x fall time (s), y progress 0..1, z speed (m/s), w seed
attribute vec4 aStrand;  // x alpha, y veil, z on-rock, w total fall time
${Te}
varying vec2 vUv;
varying vec4 vFall;
varying vec4 vStrand;
varying float vVis;
varying vec3 vN;
varying vec3 vWP;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vFall = aFall;
  vStrand = aStrand;
  vN = normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vVis = wfLightVis(wp.xyz + normal * 3.0);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,De=`
uniform float uTime;
uniform sampler2D uNoise;
uniform vec3 uKeyCol;
uniform vec3 uKeyDir;
uniform vec3 uAmb;
uniform float uNight;
varying vec2 vUv;
varying vec4 vFall;
varying vec4 vStrand;
varying float vVis;
varying vec3 vN;
varying vec3 vWP;
#include <fog_pars_fragment>
void main() {
  float tf = vFall.x;
  float prog = vFall.y;
  float speed = vFall.z;
  float seed = vFall.w;
  float veil = vStrand.y;
  float onRock = vStrand.z;
  float u = vUv.x;
  float across = vUv.y;
  // the pattern rides with the water: v = fall time - now (plus a slow drift of the lateral phase)
  float tv = tf - uTime;
  vec2 q = vec2(across / (6.0 + 5.0 * veil) + seed * 3.7, tv * (0.55 - 0.25 * veil));
  float n1 = texture2D(uNoise, q * vec2(1.0, 0.33)).a;
  float n2 = texture2D(uNoise, q * vec2(2.7, 1.1) + vec2(0.37, 0.11)).r;
  float n3 = texture2D(uNoise, q * vec2(0.45, 0.2) + vec2(0.71, 0.53)).g;
  float n = n1 * 0.55 + n2 * 0.3 + n3 * 0.35 - 0.1;
  // coherent sheet at the lip -> horsetail streaks -> spray
  float fray = smoothstep(0.05, 0.75, prog);
  float th = mix(0.18, 0.48, fray);
  float dens = smoothstep(th, th + 0.22 + 0.2 * fray, n);
  float spray = smoothstep(0.62, 1.0, prog);
  dens = mix(dens, 0.65 * smoothstep(0.22, 0.8, n2 * 0.6 + n3 * 0.6), spray * 0.8);
  // sliding over rock: thick white water
  dens = mix(dens, smoothstep(0.15, 0.55, n), onRock * (1.0 - fray * 0.5));
  if (veil > 0.5) dens = 0.45 * smoothstep(0.3, 0.95, n3 * 0.7 + n2 * 0.5) * smoothstep(0.05, 0.4, prog) * (1.0 - smoothstep(0.62, 0.95, prog));
  // frayed edges
  float edge = 1.0 - smoothstep(0.45 - 0.2 * veil, 1.0, abs(u) + (n2 - 0.5) * 0.55);
  float a = dens * edge * vStrand.x;
  a *= smoothstep(0.0, 0.04, prog) * (1.0 - smoothstep(0.9, 1.0, prog));
  if (a < 0.004) discard;

  vec3 V = normalize(cameraPosition - vWP);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  // foam is a dense scattering medium: soft wrap lighting + forward scattering through thin spray
  float ndl = dot(N, uKeyDir);
  float wrap = clamp(ndl * 0.5 + 0.55, 0.0, 1.0);
  float mu = max(dot(-V, uKeyDir), 0.0);
  float fwd = pow(mu, 6.0) * 1.4 + pow(mu, 40.0) * 3.0;
  float thin = 1.0 - dens * 0.7;
  vec3 alb = vec3(0.86, 0.88, 0.9);
  vec3 col = alb * (uKeyCol * wrap * vVis + uAmb) * 0.3183;
  col += uKeyCol * vVis * fwd * thin * 0.22;
  // glints: bright pulses in the streaks (bloom), stronger in sunlight than moonlight
  float glint = smoothstep(0.8, 0.98, n1) * (1.0 - spray) * (1.0 - veil);
  col += uKeyCol * vVis * glint * (0.12 + 0.3 * wrap) * (1.0 - uNight * 0.6);
  gl_FragColor = vec4(col * a, a);
  #ifdef USE_FOG
    vec4 f = atmoFogTerm(cameraPosition, vAtmoWorldPos);
    gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - f.a) + f.rgb * (f.a * gl_FragColor.a);
  #endif
}
`,Oe=`
attribute vec4 aMist;    // xyz centre, w size (m)
attribute vec4 aMist2;   // x phase, y period (s), z rise (m), w seed
attribute vec3 aDrift;   // horizontal drift over a life (m), vertical stretch
uniform float uTime;
${Te}
varying vec2 vUv;
varying float vAlpha;
varying float vSeed;
varying float vVis;
varying vec3 vWP;
#include <fog_pars_vertex>
void main() {
  float age = fract(aMist2.x + uTime / aMist2.y);
  vec3 c = aMist.xyz + vec3(aDrift.x * age, aMist2.z * age * (0.4 + 0.6 * age), aDrift.y * age);
  float size = aMist.w * (0.55 + 0.75 * age);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = c + (right * position.x + up * position.y * aDrift.z) * size;
  vUv = position.xy + 0.5;
  vAlpha = sin(age * 3.14159) * smoothstep(0.0, 0.15, age);
  vSeed = aMist2.w + age * 0.35;
  vVis = 0.25 + 0.75 * wfLightVis(c);
  vWP = wp;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,ke=`
uniform sampler2D uNoise;
uniform vec3 uKeyCol;
uniform vec3 uKeyDir;
uniform vec3 uAmb;
uniform float uStrength;
varying vec2 vUv;
varying float vAlpha;
varying float vSeed;
varying float vVis;
varying vec3 vWP;
#include <fog_pars_fragment>
void main() {
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  float soft = 1.0 - smoothstep(0.0, 1.0, r);
  soft *= soft;
  // billows: two noise scales eroding the puff, drifting apart as it ages
  float n = texture2D(uNoise, vUv * 0.38 + vec2(vSeed, vSeed * 1.7)).r;
  float n2 = texture2D(uNoise, vUv * 0.85 - d * 0.3 + vec2(vSeed * 2.3, 0.3)).a;
  float a = soft * smoothstep(0.12, 0.9, n * 0.7 + n2 * 0.45 - r * 0.3 + 0.12) * vAlpha * uStrength;
  if (a < 0.003) discard;
  vec3 V = normalize(cameraPosition - vWP);
  float mu = max(dot(-V, uKeyDir), 0.0);
  float fwd = pow(mu, 5.0) * 1.6 + pow(mu, 30.0) * 2.5;
  vec3 col = vec3(0.9) * (uKeyCol * (0.45 + 0.25 * n2) * vVis + uAmb) * 0.3183 + uKeyCol * vVis * fwd * 0.2;
  gl_FragColor = vec4(col * a, a);
  #ifdef USE_FOG
    vec4 f = atmoFogTerm(cameraPosition, vAtmoWorldPos);
    gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - f.a) + f.rgb * (f.a * gl_FragColor.a);
  #endif
}
`;function Ae(e,{noiseTex:t,heightTex:n,heightXf:i}){let a=performance.now(),o=e.noise.createRng(`water-falls`),s=xe(e),l={pos:[],nrm:[],uv:[],fall:[],strand:[],idx:[]},d=[],f=[];for(let t of s){let n=new k(t.lip.dx,0,t.lip.dz).normalize(),r=Se(e,t,t.v0);if(r.pts.length<6)continue;let i=new k(n.z,0,-n.x),a=t.width,s=t.seed*1.618;we(e,l,r,n,{width0:a,spread:t.spread,offset:0,bulge:a*.12,push:3,start:0,end:1,alpha:.95,seed:s,veil:0});let c=[[-.85,.55,.12],[.8,.45,.2]],u=r.pts[r.pts.length-1].p;for(let[o,d,f]of c){let c=t.lip.x+i.x*a*o,p=t.lip.z+i.z*a*o,m=e.heightAt(c,p),h=null;if(Math.abs(m-t.lip.y)<3){h=Se(e,{...t,lip:{...t.lip,x:c,y:m,z:p}},t.v0*.8);let n=h.pts[h.pts.length-1].p;(h.pts.length<6||Math.hypot(n.x-u.x,n.z-u.z)>a*2.5+20)&&(h=null)}let g={width0:a*.3*d+3,spread:t.spread*1.2,offset:0,bulge:1.5,push:2,start:f*.3,end:1,alpha:.75,seed:s+o,veil:0,across:5};h?we(e,l,h,n,g):we(e,l,r,n,{...g,offset:a*o*.62,push:3})}we(e,l,r,n,{width0:a*1.35,spread:t.spread*.75,offset:0,bulge:a*.25,push:12,start:.12,end:1,alpha:.45*t.mist,seed:s+5.3,veil:1});let p=r.pts[r.pts.length-1].p,m=new k(p.x,Math.max(e.heightAt(p.x,p.z),0),p.z);f.push({id:t.id,lip:t.lip,dir:n,base:m,drop:r.drop,time:r.time,width:a,site:t});let h=Math.min(1.6,.45+r.drop/360)*t.mist,g=(a*2.2+40)*h,_=Math.atan2(n.z,n.x),v=(t,n=0)=>{for(let r=0;r<8;r++){let r=n+o()**1.5*(t-n),i=_+(o()-.5)*Math.PI*1.25,a=m.x+Math.cos(i)*r,s=m.z+Math.sin(i)*r,c=e.heightAt(a,s);if(c<m.y+14)return{x:a,z:s,g:c,r}}return null},y=Math.round(64*h+14);for(let e=0;e<y;e++){let e=v(g);if(!e)continue;let t=e.r,r=e.x,i=e.z,a=(34+o()*60)*(.6+.5*h);d.push({x:r,y:Math.max(e.g,m.y)+a*.28+o()*14,z:i,size:a,phase:o(),period:16+o()*18,rise:(15+o()*38*h)*(1-t/g*.7),seed:o()*10,dx:n.x*(10+o()*30)+(o()-.5)*34,dz:n.z*(10+o()*30)+(o()-.5)*34,stretch:.9+o()*.5})}let b=Math.round(22*h+6);for(let e=0;e<b;e++){let e=v(g*1.35,g*.45);if(!e)continue;let t=Math.atan2(e.z-m.z,e.x-m.x),n=e.x,r=e.z,i=(40+o()*55)*(.6+.5*h);d.push({x:n,y:Math.max(e.g,m.y)+i*.16,z:r,size:i,phase:o(),period:22+o()*20,rise:3+o()*8,seed:o()*10,dx:Math.cos(t)*(20+o()*30),dz:Math.sin(t)*(20+o()*30),stretch:.45+o()*.2})}let x=r.pts,S=x.length-1;for(;S>0&&x[S-1].p.y<m.y+Math.max(25,r.drop*.28);)S--;let C=Math.round(20*h)+4;for(let e=0;e<C;e++){let e=S+Math.floor((x.length-S)*o()),t=x[Math.min(e,x.length-1)].p,r=14+o()*24;d.push({x:t.x+n.x*(4+o()*8)+i.x*(o()-.5)*a*.6,y:t.y,z:t.z+n.z*(4+o()*8)+i.z*(o()-.5)*a*.6,size:r,phase:o(),period:8+o()*8,rise:-12-o()*24,seed:o()*10,dx:n.x*(12+o()*16),dz:n.z*(12+o()*16),stretch:1.6+o()*.8})}}let p=new C;p.setAttribute(`position`,new c(l.pos,3)),p.setAttribute(`normal`,new c(l.nrm,3)),p.setAttribute(`uv`,new c(l.uv,2)),p.setAttribute(`aFall`,new c(l.fall,4)),p.setAttribute(`aStrand`,new c(l.strand,4)),p.setIndex(l.idx),p.computeBoundingSphere();let g={uKeyCol:{value:new u(1,1,1)},uKeyDir:{value:new k(0,1,0)},uHeight:{value:n},uHeightXf:{value:i},uAmb:{value:new u(.3,.3,.3)},uNight:{value:0}},_={value:0},y=new A({name:`water-falls`,uniforms:{...e.fogUniforms(),uTime:_,uNoise:{value:t},...g},vertexShader:Ee,fragmentShader:De,fog:!0,transparent:!0,premultipliedAlpha:!0,depthWrite:!1,side:2}),x=new h(p,y);x.name=`water-falls`,x.renderOrder=2,x.frustumCulled=!0;let S=new m;S.setAttribute(`position`,new c([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),S.setIndex([0,1,2,0,2,3]);let w=new Float32Array(d.length*4),T=new Float32Array(d.length*4),E=new Float32Array(d.length*3);d.forEach((e,t)=>{w.set([e.x,e.y,e.z,e.size],t*4),T.set([e.phase,e.period,e.rise,e.seed],t*4),E.set([e.dx,e.dz,e.stretch],t*3)}),S.setAttribute(`aMist`,new b(w,4)),S.setAttribute(`aMist2`,new b(T,4));let D=new b(E,3);S.setAttribute(`aDrift`,D),S.instanceCount=d.length;let O=new r;for(let e of d)O.expandByPoint(new k(e.x,e.y,e.z));O.expandByScalar(160),S.boundingBox=O,S.boundingSphere=O.getBoundingSphere(new v);let j=new A({name:`water-mist`,uniforms:{...e.fogUniforms(),uTime:_,uNoise:{value:t},uStrength:{value:.27},...g},vertexShader:Oe,fragmentShader:ke,fog:!0,transparent:!0,premultipliedAlpha:!0,depthWrite:!1}),M=new h(S,j);return M.name=`water-mist`,M.renderOrder=3,{falls:f,meshes:[x,M],fallMesh:x,mistMesh:M,lightU:g,timeU:_,stats:{ms:Math.round(performance.now()-a),vertices:l.pos.length/3,triangles:l.idx.length/3,mist:d.length}}}var je={x0:-2450,x1:1550,z0:-1560,z1:760,step:12},Me=class{constructor(e){this.v=new Float64Array(e),this.k=new Int32Array(e),this.n=0}push(e,t){let n=this.n++,r=this.v,i=this.k;for(;n>0;){let e=n-1>>1;if(r[e]<=t)break;r[n]=r[e],i[n]=i[e],n=e}r[n]=t,i[n]=e}pop(){let e=this.v,t=this.k,n=t[0],r=--this.n,i=e[r],a=t[r],o=0;for(;;){let n=2*o+1;if(n>=r)break;let a=n+1,s=a<r&&e[a]<e[n]?a:n;if(e[s]>=i)break;e[o]=e[s],t[o]=t[s],o=s}return e[o]=i,t[o]=a,n}};function Ne(e,t){let{x0:n,x1:r,z0:i,z1:a,step:o}=je,s=Math.round((r-n)/o)+1,c=Math.round((a-i)/o)+1,l=s*c,u=new Float32Array(l),d=new Float32Array(l);for(let r=0;r<c;r++){let a=i+r*o;for(let i=0;i<s;i++){let c=n+i*o,l=t.sample(c,a),f=r*s+i;u[f]=l,d[f]=e.layout.isReserved(c,a,30)?l+400:l}}let f=new Float64Array(l).fill(1/0),p=new Int32Array(l).fill(-1),m=new Me(l+8);for(let e=0;e<l;e++)u[e]<0&&(f[e]=u[e],m.push(e,u[e]));let h=[1,-1,0,0,1,1,-1,-1],g=[0,0,1,-1,1,-1,1,-1],_=[1,1,1,1,1.414,1.414,1.414,1.414];for(;m.n;){let e=m.pop(),t=f[e],n=e%s,r=(e-n)/s;for(let i=0;i<8;i++){let a=n+h[i],o=r+g[i];if(a<0||o<0||a>=s||o>=c)continue;let l=o*s+a;if(f[l]!==1/0)continue;let u=Math.max(d[l],t+.002*_[i]);f[l]=u,p[l]=e,m.push(l,u)}}return{nx:s,nz:c,H:u,F:f,P:p,...je}}function Pe(e,t,n){let{nx:r,nz:i,x0:a,z0:o,step:s,H:c,F:l,P:u}=e,d=Math.round((t-a)/s),f=Math.round((n-o)/s);if(d<0||f<0||d>=r||f>=i)return[];let p=f*r+d,m=[],h=0;for(;p>=0&&c[p]>=0&&h++<5e3;){let e=p%r,t=(p-e)/r;m.push({x:a+e*s,z:o+t*s,h:c[p],fill:Math.min(l[p],c[p]+500)-c[p],k:p}),p=u[p]}if(p>=0){let e=p%r,t=(p-e)/r;m.push({x:a+e*s,z:o+t*s,h:c[p],fill:0,k:p,lake:!0})}return m}function Fe(e,t){let n=e.map(e=>[e.x,e.z]);for(let e=0;e<3;e++){let e=[n[0]];for(let t=0;t<n.length-1;t++){let[r,i]=n[t],[a,o]=n[t+1];e.push([r*.75+a*.25,i*.75+o*.25],[r*.25+a*.75,i*.25+o*.75])}e.push(n[n.length-1]),n=e}let r=[n[0]],i=0;for(let e=1;e<n.length;e++){let[a,o]=n[e-1],[s,c]=n[e],l=Math.hypot(s-a,c-o),u=t-i;for(;u<=l;)r.push([a+(s-a)*u/l,o+(c-o)*u/l]),u+=t;i=l-(u-t)}return r}var Ie=new Map;function Le(e,t,n){let r=(t+32768)*65536+(n+32768),i=Ie.get(r);return i===void 0&&(i=e.heightAt(t*4,n*4),Ie.set(r,i)),i}function Re(e,t,n,r){let i=Math.round(t/4),a=Math.round(n/4),o=Math.ceil(r/4),s=2*o+1,c=new Float32Array(s*s);for(let t=0;t<s;t++)for(let n=0;n<s;n++)c[t*s+n]=Le(e,i+n-o,a+t-o);return{cx:i*4,cz:a*4,s:4,R:o,n:s,hs:c}}function ze(e,t,n=!1){let{cx:r,cz:i,s:a,R:o,n:s,hs:c}=e,l=new Uint8Array(s*s),u=[],d=o*s+o;for(let e=o-3;e<=o+3;e++)for(let t=o-3;t<=o+3;t++)c[e*s+t]<c[d]&&(d=e*s+t);if(c[d]>=t)return null;u.push(d),l[d]=1;let f=0,p=!1;for(;u.length;){let e=u.pop();f++;let r=e%s,i=(e-r)/s;(r===0||i===0||r===s-1||i===s-1)&&(p=!0);for(let e=0;e<4;e++){let a=r+(e===0?1:e===1?-1:0),d=i+(e===2?1:e===3?-1:0);if(a<0||d<0||a>=s||d>=s)continue;let f=d*s+a;if(l[f]||c[f]>=t)continue;let m=(a-o)*(a-o)+(d-o)*(d-o),h=Math.atan2(d-o,a-o),g=n?o*(.8+.12*Math.sin(3*h+1.3)+.08*Math.sin(7*h+.4)):o;if(m>g*g){n||(p=!0);continue}l[f]=1,u.push(f)}}return{cx:r,cz:i,level:t,n:s,R:o,s:a,hs:c,inside:l,count:f,touchesEdge:p,area:f*a*a}}function Be(e,t,n,{depth:r=2,maxR:i=60,minArea:a=500,maxArea:o=9e3,minDepth:s=.7,clip:c=!1}={}){let l=t,u=n,d=e.heightAt(t,n);for(let r=6;r<=30;r+=8)for(let i=0;i<12;i++){let a=t+Math.cos(i/12*Math.PI*2)*r,o=n+Math.sin(i/12*Math.PI*2)*r,s=e.heightAt(a,o);s<d&&(d=s,l=a,u=o)}let f=Re(e,l,u,i),p=null;for(let e=r;e<=r+3.5;e+=.5){let t=ze(f,d+e,c);if(t&&(t.touchesEdge||t.area>o||(p=t,t.area>=a)))break}for(let e=Math.min(r,1.6)-.3;!p&&e>=s;e-=.3){let t=ze(f,d+e,c);t&&!t.touchesEdge&&t.area<=o&&(p=t)}return p}function Ve(e,t,n){let{n:r,R:i,s:a,hs:o,inside:s,level:c,cx:l,cz:u}=t,d=new Int32Array(r*r).fill(-1),f=(e,t)=>e>=0&&t>=0&&e<r-1&&t<r-1&&(s[t*r+e]||s[t*r+e+1]||s[(t+1)*r+e]||s[(t+1)*r+e+1]),p=(t,n)=>{let f=n*r+t;if(d[f]>=0)return d[f];d[f]=e.pos.length/3;let p=l+(t-i)*a,m=u+(n-i)*a;e.pos.push(p,c,m);let h=s[f]?c-o[f]:Math.min(c-o[f],-.05);return e.water.push(h,0,0,0),d[f]};for(let t=0;t<r-1;t++)for(let n=0;n<r-1;n++){if(!f(n,t))continue;let r=p(n,t),i=p(n+1,t),a=p(n,t+1),o=p(n+1,t+1);e.idx.push(r,a,i,i,a,o)}}function He(e,t){let{n,R:r,s:i,cx:a,cz:o,inside:s}=e;for(let e=0;e<n;e+=2)for(let c=0;c<n;c+=2){if(!s[e*n+c])continue;let l=a+(c-r)*i,u=o+(e-r)*i;for(let e of t){if(Math.abs(l-e.cx)>e.R*e.s+8||Math.abs(u-e.cz)>e.R*e.s+8)continue;let t=Math.round((l-e.cx)/e.s)+e.R,n=Math.round((u-e.cz)/e.s)+e.R;for(let r=-2;r<=2;r++)for(let i=-2;i<=2;i++){let a=t+i,o=n+r;if(a>=0&&o>=0&&a<e.n&&o<e.n&&e.inside[o*e.n+a])return!0}}}return!1}function Ue(e,t,n){for(let r of e){let e=Math.round((t-r.cx)/r.s)+r.R,i=Math.round((n-r.cz)/r.s)+r.R;if(!(e<0||i<0||e>=r.n||i>=r.n)&&r.inside[i*r.n+e])return r.level}return-1/0}function We(e,t,n,{w0:r=3.5,w1:i=9,ponds:a,fadeIn:o=12,fadeOut:s=20,feeder:c=0}){let l=n.length;if(l<3)return;let u=-1,d=-1,f=(l-1)*5;for(let p=0;p<l;p++){let[m,h]=n[p],[g,_]=n[Math.max(0,p-1)],[v,y]=n[Math.min(l-1,p+1)],b=v-g,x=y-_,S=Math.hypot(b,x)||1;b/=S,x/=S;let C=-x,w=b,T=t.heightAt(m,h);if(Ue(a,m,h)>T+.15||T<.35){d=-1;continue}let E=t.heightAt(g,_),D=t.heightAt(v,y),O=Math.max(0,(E-D)/(S||1)),k=p*5,A=f-k,j=Math.min(3.2,.5+O*9),M=Math.min(1,Math.max(0,(O-.04)*8)),N=(r+(i-r)*Math.min(1,k/1600))*(1+.25*Math.sin(p*.37)*Math.sin(p*.11));if(c>0){let e=1-Math.min(1,A/40);j=Math.max(j,.8+2.2*e),M=Math.max(M,e*e),N=Math.max(N,c*(1-Math.min(1,A/45)))}let P=Math.min(1,k/o,s>.01?A/s:1),F=e.pos.length/3;for(let n=0;n<5;n++){let r=n/4*2-1,i=m+C*r*N*.5,a=h+w*r*N*.5,o=t.heightAt(i,a),s=Math.max(o,T-.4)+.3;e.pos.push(i,s,a);let c=(.95*(1-r*r)-.1)*Math.max(.05,P)-(1-P)*.3;e.water.push(c,M,b*j,x*j)}if(d>=0)for(let t=0;t<4;t++){let n=d+t,r=F+t;e.idx.push(n,r,n+1,n+1,r,r+1)}else u=F;d=F}return u}function Ge(e,n,r){let i=performance.now(),a=Ne(e,n),o=performance.now(),s=[],l=[],u=[],d={pos:[],water:[],idx:[]},f=new Uint8Array(a.nx*a.nz);for(let t of r){if(t.site.stop!==`ground`)continue;let n=Math.min(75,22+t.width*.8+t.drop*.05),r=Be(e,t.base.x+t.dir.x*8,t.base.z+t.dir.z*8,{depth:2,maxR:n,minArea:n*n*1.2,maxArea:2e4,clip:!0});r&&(r.kind=`plunge`,r.fall=t.id,s.push(r));let i=Pe(a,t.base.x+t.dir.x*20,t.base.z+t.dir.z*20);if(i.length<4)continue;let o=[],c=null;for(let t=0;t<i.length;t++){let n=i[t];if(f[n.k]&&t>3){o.push(n);break}f[n.k]=1,o.push(n);let r=t*a.step;if(n.fill>5.5&&r>180&&(c=Be(e,n.x,n.z,{depth:2.4,maxR:120,minArea:3e3,maxArea:3e4,minDepth:.6}),c&&He(c,s)&&(c=null),c)){c.kind=`tarn`,s.push(c);break}}let u=-1e9;for(let t=0;t<o.length;t++){let n=o[t],r=t*a.step;if(n.fill>.6&&n.fill<=5.5&&r>120&&r-u>160){let t=Be(e,n.x,n.z,{depth:Math.min(2,n.fill*.8),maxR:50,minArea:400,maxArea:5e3});t&&!He(t,s)&&(t.kind=`pond`,s.push(t),u=r)}}let d=Fe(o,5);l.push({fall:t.id,pts:d,reachesLake:!!o[o.length-1]?.lake,endPond:!!c,length:d.length*5})}for(let e of r){let t=e.site.feeder||0;if(t<20)continue;let n=[],r=-e.dir.z,i=e.dir.x,a=e.site.seed*2.1;for(let o=0;o<=t;o+=5){let s=t-o,c=Math.min(1,s/60)*(14*Math.sin(s/47+a)+6*Math.sin(s/13+a*3));n.push([e.lip.x-e.dir.x*s+r*c,e.lip.z-e.dir.z*s+i*c])}n.pop(),u.push({fall:e.id,pts:n,width:e.width})}for(let t of s)Ve(d,t,e);for(let t of l)We(d,e,t.pts,{ponds:s});for(let t of u)We(d,e,t.pts,{ponds:s,w0:t.width*.35,w1:t.width*.35,fadeIn:30,fadeOut:.001,feeder:t.width*.75});Ie.clear();let p=new C;p.setAttribute(`position`,new c(d.pos,3));let m=new Float32Array(d.pos.length);for(let e=1;e<m.length;e+=3)m[e]=1;return p.setAttribute(`normal`,new t(m,3)),p.setAttribute(`aWater`,new c(d.water,4)),p.setIndex(d.idx),p.computeBoundingSphere(),{geometry:p,ponds:s.map(e=>({x:e.cx,z:e.cz,level:e.level,r:e.R*e.s,kind:e.kind,area:e.area,inside:e.inside,n:e.n,R:e.R,s:e.s})),streams:l,stats:{floodMs:Math.round(o-i),ms:Math.round(performance.now()-i),ponds:s.length,triangles:d.idx.length/3,streams:l.map(e=>`${e.fall}:${e.length}m${e.reachesLake?`->lake`:e.endPond?`->tarn`:``}`)}}}function Ke(e,{level:t=0,scale:r=.5,keep:i=[],skyOnly:s=!1}={}){let{renderer:c,scene:u,camera:d}=e,f=new g(4,4,{type:p,minFilter:a,magFilter:l,generateMipmaps:!0,depthBuffer:!0,stencilBuffer:!1});f.texture.name=`water-planar`;let m=new T;m.matrixAutoUpdate=!0;let h=new S,_=new n,v=new k(0,1,0),y=new k(0,t,0),b=new k,C=new S,w=new k,D=new k,O=new k,A=new x,j=new x,M=new E,N=new o,P=new S,F=[],I=new Set(i),L=new Set,R=-1,z=5;function B(){c.getDrawingBufferSize(M);let e=Math.max(4,Math.round(M.x*r)),t=Math.max(4,Math.round(M.y*r));(f.width!==e||f.height!==t)&&f.setSize(e,t),z=Math.max(0,Math.floor(Math.log2(Math.min(e,t)))-3)}B(),e.onResize(B);function V(e){if(e.isLight||e.isCamera||I.has(e))return!0;let t=e.name||``;return!!(t===`sky`||t===`terrain`||L.has(e))}function H(n,i=[]){if(b.setFromMatrixPosition(d.matrixWorld),b.y<=t+.5)return!1;if(P.multiplyMatrices(d.projectionMatrix,d.matrixWorldInverse),N.setFromProjectionMatrix(P),n){let e=!1;for(let t=0;t<n.length&&!e;t++)e=N.intersectsBox(n[t]);if(!e)return!1}C.extractRotation(d.matrixWorld),w.set(0,0,-1).applyMatrix4(C).add(b),D.subVectors(y,b).reflect(v).negate().add(y),O.subVectors(y,w).reflect(v).negate().add(y),m.position.copy(D),m.up.set(0,1,0).applyMatrix4(C).reflect(v),m.lookAt(O),m.near=d.near,m.far=d.far,m.fov=d.fov,m.aspect=d.aspect,m.updateMatrixWorld(),m.projectionMatrix.copy(d.projectionMatrix),h.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),h.multiply(m.projectionMatrix).multiply(m.matrixWorldInverse),_.setFromNormalAndCoplanarPoint(v,y).applyMatrix4(m.matrixWorldInverse),A.set(_.normal.x,_.normal.y,_.normal.z,_.constant);let a=m.projectionMatrix.elements;j.x=(Math.sign(A.x)+a[8])/a[0],j.y=(Math.sign(A.y)+a[9])/a[5],j.z=-1,j.w=(1+a[10])/a[14],A.multiplyScalar(2/A.dot(j)),a[2]=A.x,a[6]=A.y,a[10]=A.z+1-5e-4,a[14]=A.w,m.projectionMatrixInverse.copy(m.projectionMatrix).invert();let o=e.sky?.mesh;if(s&&!o)return!1;if(F.length=0,!s){if(e.landmarks.length!==R){R=e.landmarks.length,L.clear();for(let t=0;t<R;t++)e.landmarks[t].object&&L.add(e.landmarks[t].object)}let t=u.children;for(let e=0;e<t.length;e++){let n=t[e];n.visible&&!V(n)&&(n.visible=!1,F.push(n))}for(let e=0;e<i.length;e++){let t=i[e];t.visible&&(t.visible=!1,F.push(t))}}let l=e.atmo,p=l.fog.z;l.fog.z=p-(b.y-t);let g=e.sky?.uniforms?.uPixelAngle,x=g?g.value:0;g&&(g.value=x/r);let S=c.shadowMap.autoUpdate,T=c.shadowMap.needsUpdate;c.shadowMap.autoUpdate=!1,c.shadowMap.needsUpdate=!1;let E=c.getRenderTarget(),k=c.xr.enabled;c.xr.enabled=!1,c.setRenderTarget(f),c.clear(),c.render(s?o:u,m),c.setRenderTarget(E),c.xr.enabled=k,c.shadowMap.autoUpdate=S,c.shadowMap.needsUpdate=T,l.fog.z=p,g&&(g.value=x);for(let e=0;e<F.length;e++)F[e].visible=!0;return F.length=0,!0}return{texture:f.texture,textureMatrix:h,get maxMip(){return z},render:H,dispose(){f.dispose()}}}function qe(e,{x0:t,z0:n,x1:r,z1:a,res:o=2.5,skip:c=()=>!1}){let{renderer:d,scene:f}=e,p=performance.now(),m=Math.min(2048,Math.ceil((r-t)/o)),h=Math.min(2048,Math.ceil((a-n)/o)),_=new g(m,h,{type:s,depthBuffer:!0,generateMipmaps:!1}),v=new i;v.matrixAutoUpdate=!1,v.matrixWorldAutoUpdate=!1,v.matrixWorld.identity(),v.matrixWorldInverse.identity();let b=(r-t)/2,S=(a-n)/2,C=(t+r)/2,w=(n+a)/2,T=(e,t)=>{v.projectionMatrix.set(1/b,e/b,0,-C/b,0,t/S,1/S,-w/S,0,2/3,0,.20000000000000018/3,0,0,0,1),v.projectionMatrixInverse.copy(v.projectionMatrix).invert()},E=new D({color:16777215,side:2,fog:!1}),O=[];for(let e of f.children)e.visible&&(e.isLight||c(e))&&(e.isLight||(e.visible=!1,O.push(e)));let k=d.getRenderTarget(),A=f.overrideMaterial,M=d.autoClear,N=new u;d.getClearColor(N);let P=d.getClearAlpha(),F=d.shadowMap.autoUpdate;d.shadowMap.autoUpdate=!1,f.overrideMaterial=E,d.autoClear=!1,d.setRenderTarget(_),d.setClearColor(0,1),d.clear(!0,!0,!1);let I=.9;for(let[e,t]of[[0,0],[I,0],[-.9,0],[0,I],[0,-.9]])T(e,t),d.clear(!1,!0,!1),d.render(f,v);let L=new Uint8Array(m*h*4);d.readRenderTargetPixels(_,0,0,m,h,L),d.setRenderTarget(k),d.setClearColor(N,P),d.autoClear=M,d.shadowMap.autoUpdate=F,f.overrideMaterial=A;for(let e of O)e.visible=!0;_.dispose(),E.dispose();let R=m*h,z=new Float32Array(R),B=0;for(let e=0;e<R;e++){let t=L[e*4]>127;z[e]=t?0:1e9,t&&B++}let V=o,H=o*Math.SQRT2;for(let e=0;e<h;e++)for(let t=0;t<m;t++){let n=e*m+t,r=z[n];t>0&&z[n-1]+V<r&&(r=z[n-1]+V),e>0&&(z[n-m]+V<r&&(r=z[n-m]+V),t>0&&z[n-m-1]+H<r&&(r=z[n-m-1]+H),t<m-1&&z[n-m+1]+H<r&&(r=z[n-m+1]+H)),z[n]=r}for(let e=h-1;e>=0;e--)for(let t=m-1;t>=0;t--){let n=e*m+t,r=z[n];t<m-1&&z[n+1]+V<r&&(r=z[n+1]+V),e<h-1&&(z[n+m]+V<r&&(r=z[n+m]+V),t<m-1&&z[n+m+1]+H<r&&(r=z[n+m+1]+H),t>0&&z[n+m-1]+H<r&&(r=z[n+m-1]+H)),z[n]=r}let U=new Uint8Array(R);for(let e=0;e<R;e++)U[e]=Math.min(255,Math.round(z[e]*10));let W=new y(U,m,h,j,s);return W.magFilter=l,W.minFilter=l,W.generateMipmaps=!1,W.colorSpace=``,W.name=`water-contact`,W.needsUpdate=!0,{tex:W,xf:new x(t,n,1/(m*o),1/(h*o)),stats:{W:m,H:h,covered:B,ms:Math.round(performance.now()-p)}}}var Je=()=>new Promise(e=>setTimeout(e,0));function Ye(e,n=32){let{nx:i,nz:a,step:o,x0:s,z0:l,height:u}=e,d=Math.round(n/o),f=Math.ceil((i-1)/d),p=Math.ceil((a-1)/d),m=new Uint8Array(f*p);for(let e=0;e<p;e++)for(let t=0;t<f;t++){let n=1/0,r=Math.max(0,t*d-1),o=Math.min(i-1,(t+1)*d+1),s=Math.max(0,e*d-1),c=Math.min(a-1,(e+1)*d+1);for(let e=s;e<=c&&n>=.6;e++)for(let t=r;t<=o;t++){let r=u[e*i+t];r<n&&(n=r)}m[e*f+t]=+(n<.6)}let h=new Int32Array((f+1)*(p+1)).fill(-1),g=[],_=[],v=(e,t)=>{let n=t*(f+1)+e;return h[n]<0&&(h[n]=g.length/3,g.push(s+Math.min(e*d,i-1)*o,0,l+Math.min(t*d,a-1)*o)),h[n]},y=[];for(let e=0;e<p;e++)for(let t=0;t<f;t++){if(!m[e*f+t])continue;let n=v(t,e),r=v(t+1,e),i=v(t,e+1),a=v(t+1,e+1);_.push(n,i,r,r,i,a)}for(let e=0;e<p;e+=16)for(let t=0;t<f;t+=16){let n=!1;for(let r=e;r<Math.min(p,e+16)&&!n;r++)for(let e=t;e<Math.min(f,t+16);e++)m[r*f+e]&&(n=!0);n&&y.push(new r(new k(s+t*d*o,-1,l+e*d*o),new k(s+Math.min(f,t+16)*d*o,1,l+Math.min(p,e+16)*d*o)))}let b=new C;b.setAttribute(`position`,new c(g,3));let x=new Float32Array(g.length);for(let e=1;e<x.length;e+=3)x[e]=1;return b.setAttribute(`normal`,new t(x,3)),b.setIndex(_),b.computeBoundingSphere(),b.computeBoundingBox(),{geo:b,boxes:y}}var Xe=`
varying vec2 vUv;
void main() { vUv = position.xy + 0.5; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`,Ze=`
uniform vec3 uTop;
uniform vec3 uDeep;
uniform float uDepth;
varying vec2 vUv;
void main() {
  float g = smoothstep(0.0, 1.0, vUv.y);
  vec3 c = mix(uDeep, uTop, g * exp(-uDepth * 0.08));
  gl_FragColor = vec4(c, 0.93);
}
`;async function Qe(e){let{scene:t,quality:n,env:r}=e,i={start:performance.now()},a=e.noise.createRng(`water`),o=e.layout.WORLD.waterLevel??0,c=ie(e),l=ce(e,c),d=R(a,e.renderer),f=H(a),p=le(e,c);i.textures=performance.now();let m=_e();m.uWWaves.value=d,m.uWNoise.value=f,m.uWHeight.value=p.tex,m.uWHeightXf.value.copy(p.xf);let g=e.sky?.uniforms;g?.uSunColor&&g.uSun&&g.uBelt&&g.uNight&&g.uMoon&&g.uMoonDir&&(m.uWSkySun=g.uSunColor,m.uWSkyP=g.uSun,m.uWSkyBelt=g.uBelt,m.uWSkyNight=g.uNight,m.uWSkyMoon=g.uMoon,m.uWSkyMoonDir=g.uMoonDir);let _=e.terrain?.uniforms,v=!!(e.terrain?.maps?.B&&_?.uTerrSun&&_?.uTerrWorld);v&&(m.uWTerrB.value=e.terrain.maps.B,m.uWTerrSun=_.uTerrSun,m.uWTerrXf=_.uTerrWorld),_?.uTerrFar&&(m.uWMarch.value.w=_.uTerrFar.value.w);let b=n.level,x=b===`low`?14:26;m.uWMarch.value.y=b===`low`?1.7:1.36;let S=Math.atan2(-.43,.9),C=[0,.55,-.75,1.45].map(e=>[Math.cos(S+e),Math.sin(S+e)]);m.uWWind.value.set(C[0][0],C[0][1],3,1),m.uWDirA.value.set(C[0][0],C[0][1],C[1][0],C[1][1]),m.uWDirB.value.set(C[2][0],C[2][1],C[3][0],C[3][1]);let T=new URLSearchParams(window.location.search).get(`wrefl`),E=n.reflections&&T!==`0`?`full`:n.level===`low`||!e.sky?.mesh||T===`0`?null:`sky`,D=new y(new Uint8Array([255]),1,1,j,s);D.needsUpdate=!0,m.uWContact.value=D,m.uWContactXf.value.set(0,0,1e-6,1e-6);let O=ge(e,m,{planar:E,march:x,terrMaps:v,contact:!0,name:`water-lake`,debug:Number(new URLSearchParams(window.location.search).get(`wdbg`)||0)});e.terrain?.applyMountainShadows?.(O);let M=Ae(e,{noiseTex:f,heightTex:p.tex,heightXf:p.xf});for(let e of M.meshes)t.add(e);i.falls=performance.now();let N=Ge(e,c,M.falls),P=ge(e,m,{local:!0,march:b===`low`?0:16,terrMaps:v,name:`water-streams`});e.terrain?.applyMountainShadows?.(P);let F=new h(N.geometry,P);F.name=`water-streams`,F.receiveShadow=!0,F.renderOrder=-1,t.add(F),i.streams=performance.now(),await Je();let I=await(l.started()?l.result:l.local());i.bake=performance.now(),m.uWData.value=I.tex,m.uWDataXf.value.copy(I.xf);let L=Ye(I),z=new h(L.geo,O);z.name=`water-lake`,z.receiveShadow=!0,z.castShadow=!1,z.renderOrder=-1,t.add(z),i.surface=performance.now(),M.falls.slice(0,4).forEach((e,t)=>{m.uWFoamPts.value[t].set(e.base.x,e.base.z,e.width*1.1+12,1)}),e.events.on(`ready`,()=>{try{let t=qe(e,{x0:-600,z0:-600,x1:1960,z1:720,res:2.5,skip:e=>e.name===`terrain`||e.name===`sky`||(e.name||``).startsWith(`water`)});m.uWContact.value=t.tex,m.uWContactXf.value.copy(t.xf),D.dispose(),e.water?.stats&&(e.water.stats.contact=t.stats),e.params.debug&&console.warn(`[water] contact`,JSON.stringify(t.stats))}catch(e){console.warn(`[water] contact foam bake failed`,e)}});let B=null;E&&(B=Ke(e,E===`full`?{level:o,scale:.5,keep:M.meshes}:{level:o,scale:.3,skyOnly:!0}),m.uWPlanar.value=B.texture,m.uWPlanarMat.value=B.textureMatrix);let V=new h(new w(1,1),new A({name:`water-under`,uniforms:{uTop:{value:new u(.03,.09,.08)},uDeep:{value:new u(.002,.008,.012)},uDepth:{value:0}},vertexShader:Xe,fragmentShader:Ze,transparent:!0,depthTest:!1,depthWrite:!1}));V.name=`water-under`,V.frustumCulled=!1,V.renderOrder=9990,V.visible=!1,t.add(V);let U=N.ponds,W=(e,t)=>{for(let n of U){let r=Math.round((e-n.x)/n.s)+n.R,i=Math.round((t-n.z)/n.s)+n.R;if(!(r<0||i<0||r>=n.n||i>=n.n)&&n.inside[i*n.n+r])return n.level}return-1/0},G={enabled:!!E,available:!!E,mode:E};e.water={level:o,isUnderwater(t){let n=t.x??t[0],r=t.y??t[1],i=t.z??t[2];if(r<o&&I.groundAt(n,i)<o)return!0;let a=W(n,i);return r<a&&e.heightAt(n,i)<a},depthAt(e,t){return Math.max(0,o-I.groundAt(e,t))},falls:M.falls.map(e=>({id:e.id,lip:{x:e.lip.x,y:e.lip.y,z:e.lip.z},base:{x:e.base.x,y:e.base.y,z:e.base.z},drop:Math.round(e.drop)})),ponds:U.map(e=>({x:e.x,z:e.z,level:e.level,r:e.r,kind:e.kind})),viewpoints:[{pos:[662,9,44],look:[520,-2,-30],label:`The Mirror at sundown`,hour:17.6},{pos:[450,20,-250],look:[-500,5,-170],label:`The sun path`,hour:17.6},{pos:[600,300,900],look:[0,0,-200],label:`The Mirror`},{pos:[1835,30,-360],look:[1720,0,0],label:`The canyon river`},{pos:[-640,150,-1060],look:[-800,250,-1440],label:`Falls of the escarpment`},{pos:[-1850,180,-900],look:[-2050,260,-1300],label:`The western fall`},{pos:[2200,50,-1300],look:[2330,150,-1470],label:`The fall at the canyon head`},{pos:[560,95,-120],look:[-300,0,400],label:`The Mirror by moonlight`,hour:1.5}],reflections:G,uniforms:m,stats:null};let K=r.palette,ee=new u,q=new k,J=[z,F,V],te=0;function Y(){let e=r.sun;m.uWKeyCol.value.copy(e.color).multiplyScalar(e.intensity),m.uWKeyDir.value.copy(r.keyDir);let t=r.hemi.intensity,n=r.iblActive?K.envIntensity:0;m.uWAmb.value.copy(K.hemiSky).multiplyScalar(t*3.14159).add(ee.copy(K.zenith).lerp(K.horizon,.5).multiplyScalar(n*2.2)),m.uWAmbGround.value.copy(K.hemiGround).multiplyScalar(t*3.14159).add(ee.copy(K.fog).multiplyScalar(n*.6)),m.uWReflBoost.value=r.iblActive?1/Math.max(.4,K.envIntensity):1,m.uWSkyZen.value.copy(K.zenith),m.uWSkyHor.value.copy(K.horizon);let i=M.lightU;i.uKeyCol.value.copy(m.uWKeyCol.value),i.uKeyDir.value.copy(r.keyDir),i.uAmb.value.copy(m.uWAmb.value),i.uNight.value=r.night,V.material.uniforms.uTop.value.setRGB(.03,.09,.08).multiplyScalar(.25+.75*(1-r.night))}return Y(),r.onChange(Y),i.end=performance.now(),e.water.stats={ms:{total:Math.round(i.end-i.start),textures:Math.round(i.textures-i.start),falls:Math.round(i.falls-i.textures),streams:Math.round(i.streams-i.falls),bakeWait:Math.round(i.bake-i.streams),surface:Math.round(i.surface-i.bake)},bake:{...I.stats,by:I.by},falls:M.stats,streams:N.stats,lakeTriangles:L.geo.index.count/3,coarseFromTerrain:c.fromTerrain},e.params.debug&&console.warn(`[water]`,JSON.stringify(e.water.stats)),{order:150,update(t,n){m.uWTime.value=n,M.timeU.value=n,m.uWWind.value.w=.75+.5*(e.atmo.time.z??.35),r.speed!==0&&Y(),q.setFromMatrixPosition(e.camera.matrixWorld);let i=e.water.isUnderwater(q);if(V.visible=i,i&&(V.material.uniforms.uDepth.value=Math.max(0,o-q.y)),B){let e=G.enabled&&!i&&te++>0&&B.render(L.boxes,J);m.uWPlanarP.value.x=+!!e,m.uWPlanarP.value.z=B.maxMip}}}}export{Qe as build};