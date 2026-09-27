const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./sky-DNwnE_Sh.js","./three.module-e53_FFk2.js","./three.core-DtjtRha-.js","./terrain-MmovLCQt.js","./biome-DstsBN7N.js","./water-CMdFOwUw.js","./rocks-BVN54SFT.js","./vegetation-DHj5D2pv.js","./BufferGeometryUtils-CaAdgu8h.js","./ruins-CgovKSWO.js","./life-CWlZKeiu.js","./sky-basic-FzHgmwST.js","./terrain-basic-CvkGhQuN.js","./loom-BcDD2JU2.js","./builder-BZhEe_8v.js","./wardens-OO_Xuu5U.js","./observatory-Yis9EN5I.js","./shapes-B-ACjQtl.js","./stair-D4fHMrKv.js","./choir-U40p8af6.js","./needles-By8wR9R5.js","./span-CH3M2RzM.js","./temple-BUB7d4Jj.js","./orrery-CxcAC3Ep.js","./monastery-DxUwLzKx.js","./isles-CVDs_3uq.js","./postfx-v_2vlSiK.js","./controls-DX7CeMlr.js","./obstacles-DQBr1hBF.js","./tour-Do76daLD.js","./hud-D2WSdXqL.js","./hud-Cb6XWf9n.css"])))=>i.map(i=>d[i]);
import{c as e,i as t,n,o as r,r as i,s as a}from"./three.module-e53_FFk2.js";import{Bt as o,Qi as s,St as c,U as l,Wr as u,Xt as d,ea as f,io as p,kr as m,mr as h,or as g,ro as _,tr as v}from"./three.core-DtjtRha-.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var y=e({CANYON:()=>S,ESCARPMENT:()=>C,LAKE:()=>x,LANDMARKS:()=>w,LANDMARK_BY_ID:()=>T,SPAWN:()=>E,WORLD:()=>b,isReserved:()=>D,nearestLandmark:()=>ee}),b={half:4600,playRadius:3300,maxAltitude:2400,waterLevel:0,defaultHour:17.6},x={x:80,z:40,radius:820},S=[[2750,-2950],[2300,-1600],[1950,-720],[1720,0],[1610,520],[1230,810],[800,520]],C={xStart:-2750,xEnd:-650,baseZ:-1350,rise:400},w=[{id:`loom`,name:`The Loom of Hours`,subtitle:`A ring of stone that hangs from nothing, weaving threads no one alive can read.`,x:320,z:-1750,radius:380,clear:300,facing:0,discover:1300},{id:`wardens`,name:`The Kneeling Wardens`,subtitle:`Five colossi bowed toward the water, waiting for a command that never came.`,x:-250,z:-900,radius:330,clear:300,facing:.25,discover:900},{id:`observatory`,name:`The Drowned Observatory`,subtitle:`Its dome still turns toward a sky that has long since changed.`,x:330,z:180,radius:220,clear:0,facing:-.6,discover:700},{id:`stair`,name:`The Stair to Nowhere`,subtitle:`Eleven thousand steps. The door at the top opens onto air.`,x:-420,z:300,radius:160,clear:0,facing:.9,discover:800},{id:`choir`,name:`The Choir of Monoliths`,subtitle:`When the wind crosses the plain, the stones answer.`,x:-1750,z:-150,radius:600,clear:520,facing:0,discover:1100},{id:`needles`,name:`The Needle City`,subtitle:`A city built only upward, as though the ground were a rumour.`,x:1350,z:-1150,radius:470,clear:440,facing:.4,discover:1400},{id:`span`,name:`The Vertebral Span`,subtitle:`A bridge grown rather than built; its bones still hold the warmth of the day.`,x:1720,z:0,radius:380,clear:320,facing:Math.PI/2,discover:1e3},{id:`temple`,name:`The Descending Temple`,subtitle:`Built from the sky downward. It stopped one step short of the earth.`,x:-450,z:1650,radius:260,clear:220,facing:-.4,discover:1200},{id:`orrery`,name:`The Stone Orrery`,subtitle:`A clockwork of mountains, still keeping the hours of a vanished calendar.`,x:-1800,z:1150,radius:470,clear:430,facing:0,discover:1300},{id:`monastery`,name:`The Honeycomb Cloister`,subtitle:`Ten thousand cells cut into the cliff, each facing the same unseen star.`,x:-1250,z:-1440,radius:380,clear:260,facing:0,discover:1100},{id:`isles`,name:`The Unmoored Isles`,subtitle:`Pieces of the land that forgot the weight of the world.`,x:1350,z:1650,radius:520,clear:0,facing:0,discover:1300}],T=Object.fromEntries(w.map(e=>[e.id,e])),E={position:[-1e3,0,1250],heightAboveGround:237,lookAt:[414,140,-627]};function D(e,t,n=0){for(let r=0;r<w.length;r++){let i=w[r];if(i.clear<=0)continue;let a=e-i.x,o=t-i.z,s=i.clear+n;if(a*a+o*o<s*s)return!0}return!1}function ee(e,t){let n=null,r=1/0;for(let i of w){let a=Math.hypot(e-i.x,t-i.z);a<r&&(r=a,n=i)}return{landmark:n,distance:r}}var te=e({clamp:()=>R,createRng:()=>A,createSimplex:()=>I,hash2:()=>j,lerp:()=>z,mulberry32:()=>O,saturate:()=>re,seedFrom:()=>k,smax:()=>oe,smin:()=>ae,smootherstep:()=>ie,smoothstep:()=>B,worldNoise:()=>L});function O(e){let t=e>>>0;return function(){t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function k(e){let t=String(e),n=2166136261;for(let e=0;e<t.length;e++)n^=t.charCodeAt(e),n=Math.imul(n,16777619);return n>>>0}function A(e=1){let t=O(typeof e==`number`?e:k(e)),n=()=>t();return n.range=(e,n)=>e+(n-e)*t(),n.int=(e,n)=>Math.floor(e+(n-e+1)*t()),n.pick=e=>e[Math.floor(t()*e.length)],n.chance=e=>t()<e,n.sign=()=>t()<.5?-1:1,n.gauss=()=>{let e=0;for(;e===0;)e=t();let n=t();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*n)},n}function j(e,t,n=0){let r=Math.imul(e|0,374761393)+Math.imul(t|0,668265263)+Math.imul(n|0,2147483647)|0;return r=Math.imul(r^r>>>13,1274126177),r^=r>>>16,(r>>>0)/4294967296}var M=new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]),N=.5*(Math.sqrt(3)-1),P=(3-Math.sqrt(3))/6,ne=1/3,F=1/6;function I(e=1337){let t=O(e),n=new Uint8Array(256);for(let e=0;e<256;e++)n[e]=e;for(let e=255;e>0;e--){let r=Math.floor(t()*(e+1)),i=n[e];n[e]=n[r],n[r]=i}let r=new Uint8Array(512),i=new Uint8Array(512);for(let e=0;e<512;e++)r[e]=n[e&255],i[e]=r[e]%12;function a(e,t){let n=0,a=0,o=0,s=(e+t)*N,c=Math.floor(e+s),l=Math.floor(t+s),u=(c+l)*P,d=e-(c-u),f=t-(l-u),p,m;d>f?(p=1,m=0):(p=0,m=1);let h=d-p+P,g=f-m+P,_=d-1+2*P,v=f-1+2*P,y=c&255,b=l&255,x=.5-d*d-f*f;if(x>=0){let e=i[y+r[b]]*3;x*=x,n=x*x*(M[e]*d+M[e+1]*f)}let S=.5-h*h-g*g;if(S>=0){let e=i[y+p+r[b+m]]*3;S*=S,a=S*S*(M[e]*h+M[e+1]*g)}let C=.5-_*_-v*v;if(C>=0){let e=i[y+1+r[b+1]]*3;C*=C,o=C*C*(M[e]*_+M[e+1]*v)}return 70*(n+a+o)}function o(e,t,n){let a,o,s,c,l=(e+t+n)*ne,u=Math.floor(e+l),d=Math.floor(t+l),f=Math.floor(n+l),p=(u+d+f)*F,m=e-(u-p),h=t-(d-p),g=n-(f-p),_,v,y,b,x,S;m>=h?h>=g?(_=1,v=0,y=0,b=1,x=1,S=0):m>=g?(_=1,v=0,y=0,b=1,x=0,S=1):(_=0,v=0,y=1,b=1,x=0,S=1):h<g?(_=0,v=0,y=1,b=0,x=1,S=1):m<g?(_=0,v=1,y=0,b=0,x=1,S=1):(_=0,v=1,y=0,b=1,x=1,S=0);let C=m-_+F,w=h-v+F,T=g-y+F,E=m-b+2*F,D=h-x+2*F,ee=g-S+2*F,te=m-1+3*F,O=h-1+3*F,k=g-1+3*F,A=u&255,j=d&255,N=f&255,P=.6-m*m-h*h-g*g;if(P<0)a=0;else{let e=i[A+r[j+r[N]]]*3;P*=P,a=P*P*(M[e]*m+M[e+1]*h+M[e+2]*g)}let I=.6-C*C-w*w-T*T;if(I<0)o=0;else{let e=i[A+_+r[j+v+r[N+y]]]*3;I*=I,o=I*I*(M[e]*C+M[e+1]*w+M[e+2]*T)}let L=.6-E*E-D*D-ee*ee;if(L<0)s=0;else{let e=i[A+b+r[j+x+r[N+S]]]*3;L*=L,s=L*L*(M[e]*E+M[e+1]*D+M[e+2]*ee)}let R=.6-te*te-O*O-k*k;if(R<0)c=0;else{let e=i[A+1+r[j+1+r[N+1]]]*3;R*=R,c=R*R*(M[e]*te+M[e+1]*O+M[e+2]*k)}return 32*(a+o+s+c)}function s(e,t,n=5,r=2,i=.5){let o=0,s=1,c=1,l=0;for(let u=0;u<n;u++)o+=s*a(e*c+u*17.13,t*c-u*11.71),l+=s,s*=i,c*=r;return o/l}function c(e,t,n=5,r=2,i=.5){let o=0,s=.5,c=1,l=1,u=0;for(let d=0;d<n;d++){let n=1-Math.abs(a(e*c+d*31.7,t*c+d*7.3));n*=n,o+=n*s*l,u+=s,l=n,s*=i,c*=r}return o/u}function l(e,t,n,r=4,i=2,a=.5){let s=0,c=1,l=1,u=0;for(let d=0;d<r;d++)s+=c*o(e*l,t*l,n*l),u+=c,c*=a,l*=i;return s/u}return{noise2:a,noise3:o,fbm2:s,ridged2:c,fbm3:l}}var L=I(20260923),R=(e,t,n)=>e<t?t:e>n?n:e,z=(e,t,n)=>e+(t-e)*n,re=e=>e<0?0:e>1?1:e;function B(e,t,n){let r=re((n-e)/(t-e));return r*r*(3-2*r)}function ie(e,t,n){let r=re((n-e)/(t-e));return r*r*r*(r*(r*6-15)+10)}function ae(e,t,n){let r=re(.5+.5*(t-e)/n);return z(t,e,r)-n*r*(1-r)}function oe(e,t,n){return-ae(-e,-t,n)}var{noise2:V,fbm2:H,ridged2:U}=L,W=T;function se(e,t,n=.3){let r=e*t,i=Math.floor(r),a=r-i;return(i+B(n,1-n,a))/t}var G=[],ce=0;for(let e=0;e<S.length-1;e++){let[t,n]=S[e],[r,i]=S[e+1],a=Math.sqrt((r-t)*(r-t)+(i-n)*(i-n));G.push({ax:t,az:n,bx:r,bz:i,len:a,start:ce}),ce+=a}function le(e,t){let n=1/0,r=0;for(let i=0;i<G.length;i++){let a=G[i],o=a.bx-a.ax,s=a.bz-a.az,c=((e-a.ax)*o+(t-a.az)*s)/(a.len*a.len);c=c<0?0:c>1?1:c;let l=a.ax+o*c-e,u=a.az+s*c-t,d=l*l+u*u;d<n&&(n=d,r=a.start+c*a.len)}return{d:Math.sqrt(n),t:r/ce}}var ue=new Float64Array(2);function de(e,t){let n=1/0,r=0;for(let i=0;i<G.length;i++){let a=G[i],o=a.bx-a.ax,s=a.bz-a.az,c=((e-a.ax)*o+(t-a.az)*s)/(a.len*a.len);c=c<0?0:c>1?1:c;let l=a.ax+o*c-e,u=a.az+s*c-t,d=l*l+u*u;d<n&&(n=d,r=a.start+c*a.len)}ue[0]=Math.sqrt(n),ue[1]=r/ce}function fe(e){return C.baseZ+110*Math.sin(e*.0021+.5)+35*V(e*.0011,7.7)}function pe(e,t,n){return 175+45*V(t*.0017,n*.0017)-40*B(.85,1,e)}var me=2450,he=3050,K=-Math.PI+.087,ge=Math.cos(K),_e=Math.sin(K),ve=[[-1.83,3750,1450,.3],[-1.12,3950,1700,.26],[-.52,3850,1850,.3],[.12,3750,1300,.26],[.7,3850,1650,.3],[1.36,3650,1200,.28],[1.98,3800,1550,.26],[2.28,4150,1100,.2],[-2.42,3900,1150,.28],[K+.5,4450,760,.14],[K-.52,4400,700,.14]].map(([e,t,n,r])=>({a:e,rc:t,hc:n,w:r,ca:Math.cos(e),sa:Math.sin(e)})),ye=[[K+.115,3380,820,170],[K-.105,3330,700,150],[-.78,3280,560,120],[1.62,3240,480,110],[1.7,3390,400,95],[-2.08,3350,430,105]].map(([e,t,n,r])=>({x:t*Math.cos(e),z:t*Math.sin(e),hc:n,rb:r}));function be(e,t){let n=Math.floor(e),r=Math.floor(t),i=9;for(let a=-1;a<=1;a++)for(let o=-1;o<=1;o++){let s=n+o,c=r+a,l=Math.imul(s,374761393)+Math.imul(c,668265263)|0;l=Math.imul(l^l>>>13,1274126177);let u=((l^l>>>16)>>>0)/4294967296;l=Math.imul(l^l>>>15,2246822519);let d=((l^l>>>13)>>>0)/4294967296,f=s+.12+.76*u-e,p=c+.12+.76*d-t,m=f*f+p*p;m<i&&(i=m)}return Math.sqrt(i)}function xe(e,t,n,r,i,a){let o=1/Math.max(n,1),s=e*o,c=t*o,l=0;for(let e=0;e<ve.length;e++){let t=ve[e];if(s*t.ca+c*t.sa<.6)continue;let r=(s*t.sa-c*t.ca)/t.w,i=(n-t.rc)/(n<t.rc?750:1700),a=r*r+i*i;a<9&&(l+=t.hc*Math.exp(-a))}let u=s*ge+c*_e,d=B(.74,.96,u),f=B(.985,.9985,u)*B(2500,2900,n),p=300*B(2350,3300,r);if(n>5200&&(p+=520*B(5200,7600,n)*(.7+.6*V(e*3e-4,t*3e-4))),p*=1-.45*d,l*=1-.85*d,d>0){let e=(n-5300)/900,t=B(.9965,.9993,u);l+=d*820*Math.exp(-e*e)*(1-.85*t)}let m=Math.min(1,be(1/900*i,1/900*a)*1.42),h=m*Math.sqrt(m),g=Math.min(1,be(1/340*i+17.3,1/340*a-5.1)*1.42),_=U(i*.0017+3.3,a*.0017-1.1,3),v=.3+.56*h+.12*g*g+.14*_*_,y=p*(.7+.5*h)+l*v+(30+l*.02)*H(e*.0065,t*.0065,2);y*=1-.55*f;for(let n=0;n<ye.length;n++){let r=ye[n],i=e-r.x,a=t-r.z,o=i*i+a*a,s=r.rb;if(o>4*s*s)continue;let c=Math.sqrt(o)*(1+.22*V(i*.03+n*7.1,a*.03)),l=B(s,s*.6,c),u=1-B(0,s*.6,c),d=1-B(s*.8,s*2,c);y+=r.hc*(.72*l+.28*u*u)+90*d}return y}var q=(e,t)=>Math.sqrt(e*e+t*t);function J(e,t){let n=e+230*H(e*45e-5+3.1,t*45e-5-1.7,3),r=t+230*H(e*45e-5-5.3,t*45e-5+2.9,3),i=H(n*.0011,r*.0011,5),a=72+52*i;a+=9*H(e*.0065,t*.0065,3),a+=2.2*H(e*.037+3.7,t*.037-8.1,3);let o=B(.12,.5,i);if(o>0){let n=U(e*.0105+5.2,t*.0105-2.6,2);n>.66&&(a+=11*o*B(.66,.95,n))}let s=q(e-x.x,t-x.z),c=Math.sqrt(e*e+t*t),l=B(700,1600,s)*(1-B(he,3650,c));if(l>0){let e=U(n*75e-5+11,r*75e-5-4,5);a+=190*e*e*l}let u=c+320*V(e*7e-4,t*7e-4),d=B(2350,4200,u);if(d>0){let i=W.orrery,o=B(me,he,u)*B(640,900,q(e-i.x,t-i.z)),s=0;if(o<1){let i=U(n*52e-5-2,r*52e-5+9,6);s=d*(380+1150*i*i+120*H(e*.002,t*.002,3))}o>0&&(s=z(s,xe(e,t,c,u,n,r),o)),a+=s}{let n=W.loom,r=B(-1150,-1450,t)*(1-B(-2900,-3400,t));if(r>0){let i=n.x+60*Math.sin(t*.0024),o=Math.abs(e-i),s=46+10*H(e*.004,t*.004,2),c=Math.max(a,250+60*H(e*.0025,t*.0025,3)),l=B(110,470,o),u=z(s,c,l*l*(3-2*l));a=z(a,u,r)}}{de(e,t);let n=ue[0],r=ue[1];if(n<1100){let i=(1-B(260,1e3,n))*(1-B(.72,.97,r));if(i>0){let n=168+26*H(e*.0022,t*.0022,3);a=z(a,Math.max(a,n),i)}let o=pe(r,e,t);if(n<o*1.15){let r=-18+4*V(e*.01,t*.01),i=n+14*H(e*.012,t*.012,3),s=B(o*.28,o*1.05,i);s=se(s,4,.22);let c=z(r,a,s);a=Math.min(a,c)}}}if(s<(x.radius+150)*1.06){let n=x.radius+150*H(e*.0011+40,t*.0011-12,3),r=1-B(n*.42,n*1.06,s);if(r>0){let n=-42+12*H(e*.003,t*.003,2),i=r*r*(3-2*r);a=z(a,n,i)}}{let n=W.stair,r=q(e-n.x,t-n.z);if(r<260){let n=9+10*H(e*.03,t*.03,2)*.4-Math.max(0,r-48)*1.4;a=Math.max(a,n)}}{let n=W.needles,r=q(e-n.x,t-n.z);if(r<1200){let n=470+55*H(e*.003+5,t*.003-5,3),i=222+4*H(e*.006,t*.006,2),o=22*U(e*.011,t*.011,3),s=i-Math.max(0,r-n)*2.6+(o-11)*B(n,n+45,r);a=Math.max(a,Math.min(i,s))}}{let n=W.temple,r=q(e-n.x,t-n.z);if(r<900){let n=205+22*H(e*.006,t*.006,2),i=236+3*V(e*.01,t*.01),o=i-Math.max(0,r-n)*3.2;o+=5*Math.sin(o*.13)*B(n,n+25,r),o=Math.max(o,i-150-Math.max(0,r-n-45)*.55),a=Math.max(a,Math.min(i,o))}}{let n=W.orrery,r=q(e-n.x,t-n.z);if(r<1300){let i=470+25*V(e*.004,t*.004),o=1-B(i*.86,i*1.02,r),s=24+80*Math.min(r/i,1)**4;a=z(a,s,o);let c=r<i?55:190,l=.75+.25*V((e-n.x)*.012,(t-n.z)*.012),u=(r-i)/c;a+=95*l*Math.exp(-u*u)}}{let n=C,r=B(n.xStart-250,n.xStart+150,e)*(1-B(n.xEnd-150,n.xEnd+250,e));if(r>0){let i=fe(e)-t+16*H(e*.02,t*.02,2);if(i>-440){let o=z(70+6*H(e*.01,t*.01,2),a,B(-40,-420,i)),s=Math.max(a,72+n.rise+60*H(e*.003,t*.003,3)*B(30,220,i)),c=se(B(-12,34,i),3,.28);a=z(a,z(o,s,c),r)}}}{let n=W.choir,r=1-B(470,820,q(e-n.x,t-n.z));r>0&&(a=z(a,44+5*H(e*.004,t*.004,2),r*r*(3-2*r)))}{let n=W.wardens,r=1-B(250,430,q(e-n.x,t-n.z));r>0&&(a=z(a,15+1.5*V(e*.01,t*.01),r))}{let n=W.isles,r=1-B(420,780,q(e-n.x,t-n.z));r>0&&(a=z(a,48+22*H(e*.003,t*.003,3),r*.85))}return a}var Y=1.5;function Se(e,t,n={x:0,y:1,z:0}){let r=J(e-Y,t),i=J(e+Y,t),a=J(e,t-Y),o=J(e,t+Y),s=r-i,c=a-o,l=2*Y,u=Math.hypot(s,l,c);return n.x=s/u,n.y=l/u,n.z=c/u,n}function Ce(e,t){return 1-Se(e,t).y}function we(e,t){return Math.max(J(e,t),b.waterLevel)}var X={sunDir:{x:-.8,y:.15,z:.35},sunColor:{x:1,y:.62,z:.34},fogColor:{x:.55,y:.52,z:.55},fog:{x:42e-5,y:.0042,z:0,w:55e-6},time:{x:0,y:0,z:.35,w:17.4},scatter:{x:.75,y:10,z:0,w:0},fogAway:{x:0,y:0,z:0,w:0},moonDir:{x:0,y:.6,z:.8}},Te={uAtmoSunDir:{value:X.sunDir},uAtmoSunColor:{value:X.sunColor},uAtmoFogColor:{value:X.fogColor},uAtmoFog:{value:X.fog},uAtmoTime:{value:X.time},uAtmoScatter:{value:X.scatter},uAtmoFogAway:{value:X.fogAway},uAtmoMoonDir:{value:X.moonDir}},Ee=`
uniform vec3 uAtmoSunDir;
uniform vec3 uAtmoSunColor;
uniform vec3 uAtmoFogColor;
uniform vec4 uAtmoFog;
uniform vec4 uAtmoTime;
uniform vec4 uAtmoScatter;
uniform vec4 uAtmoFogAway;
uniform vec3 uAtmoMoonDir;
`,De=`
// Optical depth of an exponential layer, density a*exp(-b*y), along y(t) = roy + rdy*t, t in [0, dist].
float atmoLayer(float a, float b, float roy, float rdy, float dist) {
  float base = a * exp(clamp(-b * roy, -60.0, 60.0));
  float k = rdy * b * dist;
  return (abs(k) < 1e-4) ? base * dist : base * (1.0 - exp(clamp(-k, -60.0, 60.0))) / (rdy * b);
}
// In-scattered light colour for a view direction (what fully fogged things / the horizon look like).
vec3 atmoInscatter(vec3 rd) {
  float mu = dot(rd, uAtmoSunDir);
  float away = 0.5 - 0.5 * mu;
  vec3 col = uAtmoFogColor + uAtmoFogAway.rgb * (away * away);
  float fwd = max(mu, 0.0);
  float fwd2 = fwd * fwd;
  col += uAtmoSunColor * (pow(fwd, uAtmoScatter.y) * uAtmoScatter.x + fwd2 * fwd2 * uAtmoScatter.w);
  float mm = max(dot(rd, uAtmoMoonDir), 0.0);
  col += vec3(0.42, 0.52, 0.78) * (uAtmoScatter.z * (mm * mm * mm * mm * 0.35 + pow(mm, 60.0)));
  return max(col, vec3(0.0));
}
// Total optical depth of the atmosphere between ro and ro + rd * dist.
float atmoOptical(vec3 ro, vec3 rd, float dist) {
  float roy = ro.y - uAtmoFog.z;
  return max(atmoLayer(uAtmoFog.x, uAtmoFog.y, roy, rd.y, dist) + atmoLayer(uAtmoFog.w, uAtmoFogAway.w, roy, rd.y, dist), 0.0);
}
// Returns rgb = fog colour, a = fog opacity (0..1) for a view ray from ro to wp.
vec4 atmoFogTerm(vec3 ro, vec3 wp) {
  vec3 rd = wp - ro;
  float dist = length(rd);
  rd /= max(dist, 1e-4);
  float fog = 1.0 - exp(-atmoOptical(ro, rd, dist));
  return vec4(atmoInscatter(rd), clamp(fog, 0.0, 1.0));
}
vec3 atmoFog(vec3 color, vec3 wp) {
  vec4 f = atmoFogTerm(cameraPosition, wp);
  return mix(color, f.rgb, f.a);
}
`,Oe=`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vAtmoWorldPos;
#endif
`,ke=`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  // world position recovered from view space (works with instancing / batching / skinning)
  vAtmoWorldPos = cameraPosition + transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif
`,Ae=`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vAtmoWorldPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  ${Ee}
  ${De}
#endif
`,je=`
#ifdef USE_FOG
  gl_FragColor.rgb = atmoFog( gl_FragColor.rgb, vAtmoWorldPos );
#endif
`,Me=!1;function Ne(){if(!Me){Me=!0,n.fog_pars_vertex=Oe,n.fog_vertex=ke,n.fog_pars_fragment=Ae,n.fog_fragment=je;for(let e of Object.keys(i)){let t=i[e];t&&t.uniforms&&t.uniforms.fogColor&&Object.assign(t.uniforms,Te)}Object.assign(t.fog,Te)}}function Pe(){return{fogColor:{value:new l(0)},fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},...Te}}var Fe=`
varying vec3 vMwPos;
varying vec3 vMwNrm;
`,Ie=`
${Fe}
uniform vec4 uMwTime;      // x seconds, y night 0..1
uniform vec3 uMwAlt;       // colour multiplier for macro variation / odd blocks
uniform vec3 uMwMoss;      // moss (or patina) colour, linear
uniform vec3 uMwGlyphColor;
uniform vec4 uMwBlocks;    // x width, y height, z mortar width, w groove depth (m)
uniform vec4 uMwWeather;   // x streaks, y moss, z grime, w bump strength
uniform vec4 uMwDetail;    // x macro scale (m), y tone variation, z fine grain, w strata spacing (m)
uniform vec4 uMwGlyph;     // x cell size, y band spacing, z band height, w intensity
uniform vec4 uMwSurface;   // x rough min, y rough max, z patina amount, w sparkle

// Rotated lattice so value-noise cells never align with world axes (no faint grid lines).
const mat3 MW_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float mwHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float mwHash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float mwNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = mwHash13(i);
  float n100 = mwHash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = mwHash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = mwHash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = mwHash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = mwHash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = mwHash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = mwHash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z);
}
float mwFbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * mwNoise3(p);
    p = MW_ROT * p * 2.03 + vec3(17.1, 5.3, 11.7);
    a *= 0.5;
  }
  return s / 0.9375;
}
// Dominant-axis planar coordinates: walls get (horizontal, y), tops get (x, z).
vec2 mwPlanar(vec3 p, vec3 n) {
  vec3 an = abs(n);
  if (an.y > an.x && an.y > an.z) return p.xz;
  if (an.x > an.z) return vec2(p.z, p.y);
  return vec2(p.x, p.y);
}
// Ashlar courses. Returns x groove (1 in mortar), y block id hash, z distance to block edge (m).
vec3 mwBlocks(vec2 uv, vec2 size, float mortar) {
  float row = floor(uv.y / size.y);
  float rh = mwHash12(vec2(row, 17.0));
  float w = size.x * (0.65 + 0.7 * rh);
  float xs = uv.x / w + rh * 3.0 + mod(row, 2.0) * 0.5;
  float col = floor(xs);
  vec2 f = vec2(fract(xs), fract(uv.y / size.y));
  vec2 e = min(f, 1.0 - f) * vec2(w, size.y);
  float edge = min(e.x, e.y);
  float groove = 1.0 - smoothstep(mortar * 0.35, mortar, edge);
  return vec3(groove, mwHash12(vec2(col, row) + 0.37), edge);
}
float mwSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// A procedural rune in each cell of an inscription band.
float mwGlyph(vec2 uv, float cell) {
  vec2 c = floor(uv / cell);
  vec2 f = fract(uv / cell) - 0.5;
  float h = mwHash12(c);
  float h2 = mwHash12(c + 13.7);
  if (h < 0.1) return 0.0;
  float d = 1e3;
  if (fract(h * 7.0) > 0.45) d = min(d, mwSegment(f, vec2(0.0, -0.36), vec2(0.0, 0.36)));
  if (fract(h * 13.0) > 0.5) d = min(d, mwSegment(f, vec2(-0.3, 0.3), vec2(0.3, 0.3)));
  if (fract(h * 17.0) > 0.6) d = min(d, mwSegment(f, vec2(-0.3, -0.3), vec2(0.3, -0.3)));
  if (fract(h2 * 5.0) > 0.62) d = min(d, abs(length(f) - 0.2));
  if (fract(h2 * 11.0) > 0.7) d = min(d, mwSegment(f, vec2(-0.3, -0.3), vec2(0.3, 0.3)));
  if (fract(h2 * 7.0) > 0.7) d = min(d, mwSegment(f, vec2(-0.3, 0.0), vec2(0.05, 0.0)));
  if (fract(h2 * 19.0) > 0.72) d = min(d, length(f - vec2(0.18, -0.12)) - 0.05);
  float aa = fwidth(uv.x / cell) * 1.2;
  return 1.0 - smoothstep(0.04, 0.04 + aa, d);
}
// Bump mapping from a procedural height (Mikkelsen, derivative based). View space.
vec3 mwPerturbNormal(vec3 surfPos, vec3 surfNorm, float h) {
  vec3 dpdx = dFdx(surfPos);
  vec3 dpdy = dFdy(surfPos);
  vec3 r1 = cross(dpdy, surfNorm);
  vec3 r2 = cross(surfNorm, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  // facets seen exactly edge-on give det = 0 and a zero vector: normalize() would return NaN, which
  // spreads through the water's mipmapped mirror into black blocks
  vec3 n = abs(det) * surfNorm - grad;
  float l2 = dot(n, n);
  return l2 > 1e-30 ? n * inversesqrt(l2) : surfNorm;
}
`,Le=`
{
  vec3 p = vMwPos;
  #ifdef MW_LOCAL
    vec3 wn = normalize(vMwNrm);
  #else
    vec3 wn = normalize(transpose(mat3(viewMatrix)) * normal);
  #endif
  float dist = length(vViewPosition);
  float fineFade = 1.0 - smoothstep(40.0, 220.0, dist);
  float mesoFade = 1.0 - smoothstep(400.0, 1600.0, dist);

  vec3 pr = MW_ROT * p;
  float macro = mwFbm3(pr / uMwDetail.x);
  float meso = mwNoise3(pr * 0.33);
  float fine = mwNoise3(MW_ROT * pr * 2.9);

  vec3 albedo = diffuseColor.rgb;
  albedo = mix(albedo, albedo * uMwAlt, smoothstep(0.32, 0.78, macro));
  albedo *= 1.0 + (meso - 0.5) * uMwDetail.y * mesoFade;
  albedo *= 1.0 + (fine - 0.5) * 0.18 * uMwDetail.z * fineFade;

  float height = (meso - 0.5) * 0.3 * mesoFade + (fine - 0.5) * 0.06 * uMwDetail.z * fineFade;
  float rough = mix(uMwSurface.x, uMwSurface.y, meso);
  float cavity = 0.0;

  #ifdef MW_STRATA
  {
    float sy = p.y / uMwDetail.w + (macro - 0.5) * 1.6;
    float bandId = floor(sy);
    float band = fract(sy);
    albedo *= 0.8 + 0.34 * mwHash12(vec2(bandId, 3.0));
    float ledge = smoothstep(0.0, 0.1, band);
    height += (ledge - 1.0) * 0.35 * mesoFade;
    cavity += (1.0 - ledge) * 0.6;
  }
  #endif

  #ifdef MW_BLOCKS
  {
    vec2 uv = mwPlanar(p, wn);
    vec3 b = mwBlocks(uv, uMwBlocks.xy, uMwBlocks.z);
    float aaW = max(fwidth(uv.x), fwidth(uv.y));
    float bFade = 1.0 - smoothstep(uMwBlocks.y * 0.06, uMwBlocks.y * 0.3, aaW);
    float groove = b.x * bFade;
    albedo *= mix(1.0, 0.8 + 0.4 * b.y, bFade);
    albedo = mix(albedo, albedo * uMwAlt, step(0.86, b.y) * 0.7 * bFade);
    height -= groove * uMwBlocks.w;
    height += smoothstep(0.0, uMwBlocks.z * 4.0, b.z) * 0.03 * bFade;
    cavity += groove;
  }
  #endif

  // rain streaks down walls
  float vertical = 1.0 - abs(wn.y);
  float streak = mwNoise3(vec3(p.x * 0.8, p.y * 0.011, p.z * 0.8) + macro * 2.0);
  float streakMask = vertical * smoothstep(0.52, 0.86, streak) * uMwWeather.x;
  albedo *= 1.0 - 0.4 * streakMask;
  rough -= 0.12 * streakMask;

  // grime in cavities
  albedo *= 1.0 - cavity * 0.6 * uMwWeather.z;

  // moss on ledges and tops, lichen specks on walls
  float mossN = mwFbm3(p * 0.085 + 3.1);
  float mossMask = smoothstep(0.5, 0.88, wn.y + (mossN - 0.5) * 1.1) * smoothstep(0.38, 0.62, mossN);
  mossMask = clamp(mossMask + cavity * 0.25 * smoothstep(0.0, 0.5, wn.y), 0.0, 1.0) * uMwWeather.y;
  float lichen = smoothstep(0.74, 0.8, mwNoise3(pr * 1.25)) * vertical * uMwWeather.y * 0.45 * fineFade;
  albedo = mix(albedo, uMwMoss * (0.65 + 0.7 * meso), clamp(mossMask + lichen, 0.0, 1.0));
  rough = mix(rough, 0.95, mossMask);

  #ifdef MW_PATINA
  {
    float pat = smoothstep(0.38, 0.72, macro + (meso - 0.5) * 0.7 + wn.y * 0.3 + streakMask * 0.4) * uMwSurface.z;
    albedo = mix(albedo, uMwMoss * (0.8 + 0.4 * fine), pat);
    metalnessFactor = mix(metalnessFactor, 0.05, pat);
    rough = mix(rough, 0.85, pat);
  }
  #endif

  #ifdef MW_SPARKLE
  {
    float sp = step(1.0 - 0.012 * uMwSurface.w, mwHash13(floor(p * 18.0))) * fineFade;
    rough = mix(rough, 0.05, sp);
  }
  #endif

  #ifdef MW_GLYPHS
  {
    vec2 uv = mwPlanar(p, wn);
    float bandCoord = uv.y / uMwGlyph.y;
    float inBand = step(abs(fract(bandCoord) - 0.5) * uMwGlyph.y, uMwGlyph.z * 0.5);
    float g = mwGlyph(uv, uMwGlyph.x) * inBand * (1.0 - step(0.85, abs(wn.y)));
    float cellId = mwHash12(floor(uv / uMwGlyph.x));
    float pulse = 0.6 + 0.4 * sin(uMwTime.x * 0.7 + cellId * 6.2831 + uv.y * 0.04);
    float glow = uMwGlyph.w * (0.18 + 1.8 * uMwTime.y) * pulse;
    totalEmissiveRadiance += uMwGlyphColor * g * glow;
    albedo *= 1.0 - 0.7 * g;
    height -= g * 0.025;
  }
  #endif

  diffuseColor.rgb = max(albedo, vec3(0.0));
  roughnessFactor = clamp(rough, 0.04, 1.0);
  normal = mwPerturbNormal(-vViewPosition, normal, height * uMwWeather.w);
}
`,Re=`
  vMwPos = cameraPosition + transpose(mat3(viewMatrix)) * mvPosition.xyz;
  vMwNrm = transpose(mat3(viewMatrix)) * transformedNormal;
`,ze=`
  {
    vec4 mwP = vec4(transformed, 1.0);
    vec3 mwN = objectNormal;
    #ifdef USE_INSTANCING
      mwP = instanceMatrix * mwP;
      mwN = mat3(instanceMatrix) * mwN;
    #endif
    vMwPos = mwP.xyz;
    vMwNrm = mwN;
  }
`,Be={stone:{color:`#bcae98`,alt:`#d9c2a8`,moss:`#4b5a2c`,rough:[.72,.95],blocks:[3.4,1.5],mortar:.08,grooveDepth:.09,streaks:.65,mossAmount:.55,grime:.8,bump:1,macroScale:45,variation:.35,fine:1},stoneSmooth:{color:`#b8aa94`,alt:`#cdb89f`,moss:`#4b5a2c`,rough:[.65,.92],streaks:.7,mossAmount:.5,grime:.6,bump:1,macroScale:35,variation:.4,fine:1},basalt:{color:`#35353a`,alt:`#5a5550`,moss:`#3d4a26`,rough:[.55,.9],blocks:[6,2.8],mortar:.1,grooveDepth:.12,streaks:.45,mossAmount:.35,grime:.5,bump:1.1,macroScale:60,variation:.3,fine:1.2},basaltSmooth:{color:`#303035`,alt:`#4d4945`,moss:`#3d4a26`,rough:[.5,.85],streaks:.4,mossAmount:.3,grime:.4,bump:1,macroScale:40,variation:.3,fine:1.3},obsidian:{color:`#0c0d11`,alt:`#1b1a22`,moss:`#2a3320`,rough:[.08,.3],streaks:.25,mossAmount:.08,grime:.2,bump:.35,macroScale:30,variation:.25,fine:.4,sparkle:.6},obsidianGlyph:{color:`#0c0d11`,alt:`#1b1a22`,moss:`#2a3320`,rough:[.1,.32],streaks:.2,mossAmount:.05,grime:.2,bump:.35,macroScale:30,variation:.25,fine:.4,glyphs:{cell:1.6,band:14,height:3.4,intensity:3.2,color:`#5fe6ff`}},glyphStone:{color:`#4a4540`,alt:`#6b6258`,moss:`#3d4a26`,rough:[.6,.9],blocks:[4.2,1.8],mortar:.08,grooveDepth:.08,streaks:.5,mossAmount:.35,grime:.6,bump:1,macroScale:40,variation:.3,fine:1,glyphs:{cell:1.4,band:9,height:2.6,intensity:2.6,color:`#ffb35c`}},sandstone:{color:`#b06a45`,alt:`#d49a6a`,moss:`#56602f`,rough:[.75,.97],streaks:.55,mossAmount:.3,grime:.6,bump:1.2,macroScale:50,variation:.35,fine:1.2,strata:2.6},marble:{color:`#e3ddd2`,alt:`#cfc6b8`,moss:`#5c6a3a`,rough:[.3,.55],blocks:[5,2.4],mortar:.03,grooveDepth:.04,streaks:.5,mossAmount:.3,grime:.5,bump:.6,macroScale:25,variation:.18,fine:.5},marbleSmooth:{color:`#e6e0d5`,alt:`#d2c9ba`,moss:`#5c6a3a`,rough:[.28,.5],streaks:.45,mossAmount:.25,grime:.3,bump:.5,macroScale:25,variation:.15,fine:.5},bone:{color:`#dccfb3`,alt:`#b9a684`,moss:`#6b6a3c`,rough:[.45,.75],streaks:.6,mossAmount:.25,grime:.7,bump:1.3,macroScale:20,variation:.3,fine:1.6},plaster:{color:`#d3c7b1`,alt:`#b7a58b`,moss:`#56643a`,rough:[.82,.98],streaks:.8,mossAmount:.45,grime:.8,bump:.9,macroScale:18,variation:.45,fine:1.4},terracotta:{color:`#a4573a`,alt:`#c67b52`,moss:`#4f5a2d`,rough:[.7,.92],blocks:[.9,.45],mortar:.03,grooveDepth:.03,streaks:.6,mossAmount:.4,grime:.7,bump:.9,macroScale:20,variation:.35,fine:1},bronze:{color:`#7a5a34`,alt:`#5d4128`,moss:`#4f9a86`,rough:[.3,.6],metalness:.9,patina:.75,streaks:.4,mossAmount:0,grime:.4,bump:.5,macroScale:12,variation:.3,fine:.8},gold:{color:`#c9a45b`,alt:`#a07e3a`,moss:`#6c8d5a`,rough:[.2,.42],metalness:1,patina:.15,streaks:.3,mossAmount:0,grime:.3,bump:.3,macroScale:10,variation:.25,fine:.5},iron:{color:`#3a3430`,alt:`#6b3f25`,moss:`#7a4a2a`,rough:[.55,.9],metalness:.7,patina:.55,streaks:.7,mossAmount:0,grime:.5,bump:.7,macroScale:8,variation:.35,fine:1.2},crystal:{color:`#8fd3e6`,alt:`#b5a2ff`,moss:`#8fd3e6`,rough:[.02,.12],metalness:.2,streaks:0,mossAmount:0,grime:0,bump:.2,macroScale:8,variation:.3,fine:.2,emissive:`#2a6f86`,emissiveIntensity:.6},rock:{color:`#7b736a`,alt:`#9a8f7f`,moss:`#46552a`,rough:[.75,.98],streaks:.5,mossAmount:.6,grime:.6,bump:1.4,macroScale:25,variation:.45,fine:1.4}},Ve=e=>new l(e);function He(e){let t=Ve(e);return new _(t.r,t.g,t.b)}var Ue=0;function We(e=`stone`,t={}){let n=typeof e==`string`?Be[e]:e;if(!n)throw Error(`Unknown material preset: ${e}`);let r={...n,...t},i=new h({color:new l(r.color??`#aaaaaa`),roughness:1,metalness:r.metalness??0,vertexColors:!0,flatShading:!!r.flatShading,side:r.side??0,transparent:!!r.transparent,opacity:r.opacity??1,emissive:new l(r.emissive??`#000000`),emissiveIntensity:r.emissiveIntensity??1});i.defaultAttributeValues={color:[1,1,1]};let a=r.rough??[.7,.95],o=r.blocks??null,s=r.glyphs??null,c={uMwTime:{value:X.time},uMwAlt:{value:He(r.alt??`#ffffff`)},uMwMoss:{value:He(r.moss??`#4b5a2c`)},uMwGlyphColor:{value:He(s?.color??`#ffb35c`)},uMwBlocks:{value:new p(o?.[0]??3,o?.[1]??1.5,r.mortar??.08,r.grooveDepth??.08)},uMwWeather:{value:new p(r.streaks??.5,r.mossAmount??.4,r.grime??.6,r.bump??1)},uMwDetail:{value:new p(r.macroScale??40,r.variation??.3,r.fine??1,r.strata||3)},uMwGlyph:{value:new p(s?.cell??1.5,s?.band??10,s?.height??3,s?.intensity??2)},uMwSurface:{value:new p(a[0],a[1],r.patina??0,r.sparkle??0)}},u={};o&&(u.MW_BLOCKS=``),s&&(u.MW_GLYPHS=``),r.strata&&(u.MW_STRATA=``),r.patina&&(u.MW_PATINA=``),r.sparkle&&(u.MW_SPARKLE=``),r.local&&(u.MW_LOCAL=``),i.defines={...i.defines||{},...u};let d=`mw-${Ue++}-${Object.keys(u).sort().join(`.`)}`;return i.customProgramCacheKey=()=>d,i.userData.mwUniforms=c,i.userData.preset=typeof e==`string`?e:`custom`,i.onBeforeCompile=e=>{Object.assign(e.uniforms,c),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>\n${Fe}`).replace(`#include <project_vertex>`,`#include <project_vertex>\n${r.local?ze:Re}`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>\n${Ie}`).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>\n${Le}`)},i}function Ge(e=`#ffb56b`,{day:t=.6,night:n=4,flicker:r=0,side:i=0,transparent:a=!1,opacity:o=1}={}){let s=new g({color:new l(e),side:i,transparent:a,opacity:o});s.defaultAttributeValues={color:[1,1,1]},s.vertexColors=!0;let c={uMwTime:{value:X.time},uMwGlow:{value:new _(t,n,r)}},u=`mw-glow-${Ue++}`;return s.customProgramCacheKey=()=>u,s.onBeforeCompile=e=>{Object.assign(e.uniforms,c),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vMwGlowPos;`).replace(`#include <project_vertex>`,`#include <project_vertex>
vMwGlowPos = cameraPosition + transpose(mat3(viewMatrix)) * mvPosition.xyz;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform vec4 uMwTime;
uniform vec3 uMwGlow;
varying vec3 vMwGlowPos;`).replace(`#include <color_fragment>`,`#include <color_fragment>
        {
          float fl = 1.0;
          if (uMwGlow.z > 0.0) {
            vec3 cell = floor(vMwGlowPos * 0.5);
            float ph = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831;
            fl = 1.0 - uMwGlow.z * (0.5 + 0.5 * sin(uMwTime.x * 7.0 + ph) * sin(uMwTime.x * 3.1 + ph * 2.0));
          }
          diffuseColor.rgb *= mix(uMwGlow.x, uMwGlow.y, uMwTime.y) * fl;
        }`)},s}function Ke(){let e=new Map,t=new Map;return{presets:Be,get(t){return e.has(t)||e.set(t,We(t)),e.get(t)},create:We,glow(e=`#ffb56b`,n={}){let r=`${e}|${JSON.stringify(n)}`;return t.has(r)||t.set(r,Ge(e,n)),t.get(r)}}}var qe=[{e:-30,sun:`#6f86c8`,si:0,fog:`#0e1526`,fogAway:`#0a1020`,zenith:`#02050f`,horizon:`#101a30`,cloud:`#20283c`,ci:0,hemiSky:`#2c3d62`,hemiGround:`#0a0b10`,hi:1.9,ei:1,exposure:1.7,fd:34e-5,ff:.0034,haze:4e-5,glow:0,scat:0},{e:-12,sun:`#7084c4`,si:0,fog:`#161f38`,fogAway:`#0f172c`,zenith:`#040a1c`,horizon:`#1d2748`,cloud:`#2a3350`,ci:0,hemiSky:`#31426a`,hemiGround:`#0c0d14`,hi:1.6,ei:1,exposure:1.65,fd:36e-5,ff:.0034,haze:45e-6,glow:0,scat:0},{e:-6,sun:`#8a6aa8`,si:0,fog:`#2c3558`,fogAway:`#1f2a4a`,zenith:`#0a1638`,horizon:`#433f6a`,cloud:`#6a4a78`,ci:.25,hemiSky:`#3d4a78`,hemiGround:`#14131a`,hi:1.1,ei:1,exposure:1.35,fd:4e-4,ff:.0034,haze:5e-5,glow:.15,scat:.25},{e:-2.5,sun:`#ff5a2e`,si:.2,fog:`#565c82`,fogAway:`#3a4670`,zenith:`#18295e`,horizon:`#aa7088`,cloud:`#ff6a4a`,ci:1.1,hemiSky:`#5a68a4`,hemiGround:`#1a1a26`,hi:1.35,ei:1,exposure:1.3,fd:46e-5,ff:.0034,haze:55e-6,glow:.45,scat:.5},{e:2,sun:`#ff7436`,si:1.8,fog:`#bb8064`,fogAway:`#6e6c8e`,zenith:`#2c4a8c`,horizon:`#f0a272`,cloud:`#ff9058`,ci:1.6,hemiSky:`#8583a6`,hemiGround:`#46302a`,hi:.9,ei:.85,exposure:1,fd:46e-5,ff:.0034,haze:58e-6,glow:.6,scat:.7},{e:7,sun:`#ff9650`,si:3,fog:`#cc9e7c`,fogAway:`#8a8aa8`,zenith:`#3862a8`,horizon:`#f6c994`,cloud:`#ffb47a`,ci:1.7,hemiSky:`#9098b8`,hemiGround:`#5a4232`,hi:.95,ei:.75,exposure:.96,fd:42e-5,ff:.0035,haze:55e-6,glow:.5,scat:.65},{e:15,sun:`#ffb56e`,si:3.5,fog:`#c2b2a6`,fogAway:`#92a2c0`,zenith:`#396ebf`,horizon:`#f3dcb4`,cloud:`#ffc890`,ci:1.55,hemiSky:`#9aaccc`,hemiGround:`#5e4c3a`,hi:1,ei:.7,exposure:.93,fd:36e-5,ff:.0035,haze:5e-5,glow:.28,scat:.6},{e:30,sun:`#ffe2c0`,si:3.8,fog:`#b3bfcc`,fogAway:`#9fb4cf`,zenith:`#3a6fbe`,horizon:`#dde6ee`,cloud:`#fff4e8`,ci:1.9,hemiSky:`#a2b9d9`,hemiGround:`#5c5446`,hi:1.1,ei:.7,exposure:.9,fd:32e-5,ff:.0036,haze:46e-6,glow:.3,scat:.5},{e:60,sun:`#fff3e4`,si:4,fog:`#aabdd0`,fogAway:`#98b0cc`,zenith:`#2c63b6`,horizon:`#d2e0ec`,cloud:`#ffffff`,ci:2.1,hemiSky:`#a8c0e0`,hemiGround:`#5c5850`,hi:1.15,ei:.7,exposure:.88,fd:3e-4,ff:.0036,haze:44e-6,glow:.25,scat:.45}],Je={"-6":{fog:`#2e3658`,fogAway:`#262f52`,horizon:`#4a4670`,cloud:`#7a5a8a`,fd:7e-4,ff:.0048},"-2.5":{sun:`#ff6a4a`,fog:`#74607e`,fogAway:`#4a5274`,horizon:`#c08a8a`,cloud:`#ff8a7a`,fd:95e-5,ff:.0052},2:{sun:`#ff8a5a`,fog:`#b98a86`,fogAway:`#7c7c9a`,horizon:`#f0b098`,cloud:`#ffa088`,fd:.0011,ff:.0055},7:{sun:`#ffaa70`,fog:`#c8a296`,fogAway:`#9296ae`,horizon:`#f4c6a8`,cloud:`#ffc0a0`,fd:85e-5,ff:.0052,haze:64e-6},15:{sun:`#ffc88e`,fog:`#c4b0a4`,fogAway:`#a0aabc`,horizon:`#ecd4ba`,cloud:`#ffdcc0`,fd:7e-4,ff:.0046},30:{fog:`#b4bfcc`,fd:42e-5,ff:.004}},Ye=[`sun`,`fog`,`fogAway`,`zenith`,`horizon`,`cloud`,`hemiSky`,`hemiGround`],Xe={si:`sunIntensity`,hi:`hemiIntensity`,ei:`envIntensity`,ci:`cloudIntensity`,exposure:`exposure`,fd:`fogDensity`,ff:`fogFalloff`,haze:`haze`,glow:`glow`,scat:`scatter`},Ze=Object.entries(Xe),Qe=Object.values(Xe),$e=1/1900;function et(e){return e.map(e=>{let t={e:e.e};for(let n of Ye)t[n]=new l(e[n]);for(let n of Object.keys(Xe))t[n]=e[n];return t})}var tt=et(qe),nt=et(qe.map(e=>({...e,...Je[String(e.e)]||{}})));function rt(e,t,n){let r=0;for(;r<e.length-2&&t>e[r+1].e;)r++;let i=e[r],a=e[r+1],o=R((t-i.e)/(a.e-i.e),0,1),s=o*o*(3-2*o);for(let e of Ye)n[e].copy(i[e]).lerp(a[e],s);for(let e=0;e<Ze.length;e++){let t=Ze[e][0];n[Ze[e][1]]=i[t]+(a[t]-i[t])*s}return n}function it(){let e={};for(let t of Ye)e[t]=new l;for(let t of Object.values(Xe))e[t]=0;return e.moonIntensity=0,e}function at(e,t,n,r){for(let i of Ye)r[i].copy(e[i]).lerp(t[i],n);for(let i of Qe)r[i]=e[i]+(t[i]-e[i])*n;return r}function ot(e,t=new _){let n=(e-6)/12.8*Math.PI,r=v.degToRad(52),i=Math.sin(n)*r,a=Math.cos(i);return t.set(Math.cos(n)*a,Math.sin(i),(.62*Math.sin(n)-.2)*a).normalize(),t}function st(e,t=new _){let n=e-15.4;n<-6&&(n+=24);let r=n/13.2,i=v.degToRad(42)*Math.sin(Math.PI*r),a=v.degToRad(40+235*r),o=Math.cos(i);return t.set(Math.sin(a)*o,Math.sin(i),-Math.cos(a)*o)}var ct=new _(0,Math.sin(v.degToRad(38)),-Math.cos(v.degToRad(38))),lt=new u,ut=new _(0,1,0).applyAxisAngle(new _(1,0,0),v.degToRad(-31));function dt(e,t=new _){let n=(e-22)/24*Math.PI*2-.75;return lt.setFromAxisAngle(ct,n),t.copy(ut).applyQuaternion(lt).normalize()}var ft=3400,pt=new _(0,1,0);function mt(e){let{scene:t,quality:n}=e,r=new c(16777215,3);if(n.shadows){r.shadow.mapSize.set(n.shadowSize,n.shadowSize);let e=r.shadow.camera,t=n.shadowExtent;e.left=-t,e.right=t,e.top=t,e.bottom=-t,e.near=10,e.far=6e3,e.updateProjectionMatrix(),r.shadow.bias=-4e-5,r.shadow.normalBias=1.3*(2*t/n.shadowSize),r.shadow.radius=1.5}r.name=`sun`,r.castShadow=n.shadows,t.add(r),t.add(r.target);let i=new c(10466559,0);i.name=`moon`,t.add(i),t.add(i.target);let a=new d(10533080,5919816,1);a.name=`hemi`,t.add(a);let o=it(),s=it(),u=it(),f=new l(`#9db4ff`),p=new l,m=[],h=new _,g=new _,y=new _,b=new _,x=new _,S=null,C={hour:e.params.hour??e.layout.WORLD.defaultHour,speed:0,sunDir:new _,moonDir:new _,moon2Dir:new _,keyDir:new _,sunElevation:0,moonElevation:0,night:0,twilight:0,morning:0,moonPhase:.8,palette:o,sun:r,moon:i,hemi:a,iblActive:!1,_lastNotifiedHour:-999,setHour(e){C.hour=(e%24+24)%24,C.apply(!0)},onChange(e){m.push(e)},setIblActive(e){C.iblActive=!!e,C.apply(!1)},apply(n=!1){let c=C.hour;ot(c,C.sunDir),st(c,C.moonDir),dt(c,C.moon2Dir),C.sunElevation=v.radToDeg(Math.asin(R(C.sunDir.y,-1,1))),C.moonElevation=v.radToDeg(Math.asin(R(C.moonDir.y,-1,1))),C.moonPhase=.5-.5*C.sunDir.dot(C.moonDir),C.morning=B(1.5,4,c)*(1-B(10,12.5,c)),rt(tt,C.sunElevation,s),rt(nt,C.sunElevation,u),at(s,u,C.morning,o),C.night=B(1,-9,C.sunElevation),C.twilight=B(-9,-2,C.sunElevation)*(1-B(4,12,C.sunElevation));let l=B(2,14,C.moonElevation),d=B(-4,-12,C.sunElevation);o.moonIntensity=.62*d*l*(.35+.65*C.moonPhase);let h=B(-3,2,C.sunElevation),g=o.sunIntensity*h;C.sunElevation>-3.5||o.moonIntensity<=0?(C.keyDir.copy(C.sunDir),p.copy(o.sun),r.intensity=g):(C.keyDir.copy(C.moonDir),p.copy(f),r.intensity=o.moonIntensity),r.color.copy(p),C.keyDir.y<.02&&(C.keyDir.y=.02),C.keyDir.normalize(),D(),i.intensity=0,i.color.copy(f),a.color.copy(o.hemiSky),a.groundColor.copy(o.hemiGround),a.intensity=o.hemiIntensity*(C.iblActive?.45+.55*C.night:1),t.environmentIntensity=o.envIntensity*(.72+.28*C.night),X.sunDir.x=C.sunDir.x,X.sunDir.y=C.sunDir.y,X.sunDir.z=C.sunDir.z,X.moonDir.x=C.moonDir.x,X.moonDir.y=C.moonDir.y,X.moonDir.z=C.moonDir.z;let _=B(-6,1,C.sunElevation);if(X.sunColor.x=o.sun.r*_,X.sunColor.y=o.sun.g*_,X.sunColor.z=o.sun.b*_,X.fogColor.x=o.fog.r,X.fogColor.y=o.fog.g,X.fogColor.z=o.fog.b,X.fogAway.x=o.fogAway.r-o.fog.r,X.fogAway.y=o.fogAway.g-o.fog.g,X.fogAway.z=o.fogAway.b-o.fog.b,X.fogAway.w=$e,X.fog.x=o.fogDensity,X.fog.y=o.fogFalloff,X.fog.w=o.haze,X.scatter.x=o.scatter,X.scatter.y=9,X.scatter.z=o.moonIntensity*.18,X.scatter.w=o.glow,X.time.y=C.night,X.time.w=C.hour,e.renderer.toneMappingExposure=o.exposure,n||Math.abs(C.hour-C._lastNotifiedHour)>.05){C._lastNotifiedHour=C.hour;for(let e of m)e(C)}},update(e,t){C.speed!==0&&(C.hour=(C.hour+C.speed*e+24)%24,C.apply(!1)),S=t,D(),i.target.position.copy(t.position),i.position.copy(t.position).addScaledVector(C.moonDir,3e3)}},w=[1,1.7,2.6],T=0;function E(t){if(!n.shadows)return n.shadowExtent;let i=t.position.y-e.heightAt(t.position.x,t.position.z),a=[380,1100];T<2&&i>a[T]*1.12?T++:T>0&&i<a[T-1]*.88&&T--;let o=n.shadowExtent*w[T],s=r.shadow.camera;return s.right!==o&&(s.left=-o,s.right=o,s.top=o,s.bottom=-o,s.updateProjectionMatrix(),r.shadow.normalBias=1.3*(2*o/n.shadowSize)),o}function D(){let t=S||e.camera;t.getWorldDirection(g),g.y=0,g.lengthSq()<1e-6&&g.set(0,0,-1),g.normalize();let i=E(t);if(h.copy(t.position).addScaledVector(g,i*.5),h.y=e.heightAt(h.x,h.z),n.shadows){let e=2*i/n.shadowSize;x.copy(C.keyDir),y.crossVectors(pt,x),y.lengthSq()<1e-6&&y.set(1,0,0),y.normalize(),b.crossVectors(x,y);let t=Math.round(h.dot(y)/e)*e,r=Math.round(h.dot(b)/e)*e,a=h.dot(x);h.copy(y).multiplyScalar(t).addScaledVector(b,r).addScaledVector(x,a)}r.target.position.copy(h),r.position.copy(h).addScaledVector(C.keyDir,ft),r.target.updateMatrixWorld()}return C.apply(!0),C}var ht={low:{level:`low`,pixelRatio:.85,shadows:!1,shadowSize:1024,shadowExtent:500,vegetation:.35,terrainDetail:.5,drawDistance:9e3,bloom:!0,ssao:!1,godrays:!1,reflections:!1},medium:{level:`medium`,pixelRatio:1,shadows:!0,shadowSize:2048,shadowExtent:650,vegetation:.65,terrainDetail:.75,drawDistance:12e3,bloom:!0,ssao:!1,godrays:!0,reflections:!1},high:{level:`high`,pixelRatio:1.5,shadows:!0,shadowSize:4096,shadowExtent:800,vegetation:1,terrainDetail:1,drawDistance:16e3,bloom:!0,ssao:!0,godrays:!0,reflections:!0}};function gt(e=window.location.search){let t=new URLSearchParams(e),n=e=>e?e.split(`,`).map(Number):null,r=e=>e?e.split(`,`).map(e=>e.trim()).filter(Boolean):null;return{q:t.get(`q`),hour:t.has(`hour`)?Number(t.get(`hour`)):null,cam:n(t.get(`cam`)),look:n(t.get(`look`)),modules:r(t.get(`modules`)),skip:r(t.get(`skip`))||[],shot:t.has(`shot`),fov:t.has(`fov`)?Number(t.get(`fov`)):null,debug:t.has(`debug`)}}function _t(){let e=matchMedia(`(pointer: coarse)`).matches,t=Math.min(screen.width,screen.height)<700;return e&&t?`low`:e?`medium`:`high`}function vt(e,t=gt()){Ne();let n={...ht[ht[t.q]?t.q:_t()]},i=new r({canvas:e,antialias:!1,powerPreference:`high-performance`,stencil:!1,preserveDrawingBuffer:t.shot});i.setPixelRatio(Math.min(window.devicePixelRatio||1,n.pixelRatio)),i.setSize(window.innerWidth,window.innerHeight,!1),i.outputColorSpace=s,i.toneMapping=4,i.toneMappingExposure=1,i.shadowMap.enabled=n.shadows,i.shadowMap.type=1,i.info.autoReset=!1;let c=new f;c.fog=new o(0,1e-4),c.background=new l(8952234);let u=new m(t.fov??55,window.innerWidth/window.innerHeight,1,n.drawDistance);u.position.set(0,200,0);let d=[],p=[],h=new Map,g={THREE:a,canvas:e,renderer:i,scene:c,camera:u,params:t,quality:n,layout:y,noise:te,heightAt:J,normalAt:Se,slopeAt:Ce,surfaceAt:we,canyonDistance:le,cliffLineZ:fe,atmo:X,atmosphereUniforms:Te,fogUniforms:Pe,materials:Ke(),landmarks:[],camState:{mode:`fly`},onUpdate(e,t=0){return d.push({fn:e,order:t}),d.sort((e,t)=>e.order-t.order),()=>{let t=d.findIndex(t=>t.fn===e);t>=0&&d.splice(t,1)}},onResize(e){p.push(e)},events:{on(e,t){h.has(e)||h.set(e,[]),h.get(e).push(t)},emit(e,t){for(let n of h.get(e)||[])try{n(t)}catch(e){console.error(e)}}},render(){i.render(c,u)},tick(e,t){X.time.x=t;for(let n of d)n.fn(e,t);g.env.update(e,u)},resize(){let e=window.innerWidth,t=window.innerHeight;i.setSize(e,t,!1),u.aspect=e/t,u.updateProjectionMatrix();for(let n of p)n(e,t,i.getPixelRatio())}};return g.env=mt(g),window.addEventListener(`resize`,()=>g.resize()),g}var yt=`modulepreload`,bt=function(e,t){return new URL(e,t).href},xt={},Z=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=bt(t,n),t=s(t),t in xt)return;xt[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:yt,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},St=[[`sky`,()=>Z(()=>import(`./sky-DNwnE_Sh.js`),__vite__mapDeps([0,1,2]),import.meta.url)],[`terrain`,()=>Z(()=>import(`./terrain-MmovLCQt.js`),__vite__mapDeps([3,1,2,4]),import.meta.url)],[`water`,()=>Z(()=>import(`./water-CMdFOwUw.js`),__vite__mapDeps([5,2]),import.meta.url)],[`rocks`,()=>Z(()=>import(`./rocks-BVN54SFT.js`),__vite__mapDeps([6,2]),import.meta.url)],[`vegetation`,()=>Z(()=>import(`./vegetation-DHj5D2pv.js`),__vite__mapDeps([7,2,4,8]),import.meta.url)],[`ruins`,()=>Z(()=>import(`./ruins-CgovKSWO.js`),__vite__mapDeps([9,2]),import.meta.url)],[`life`,()=>Z(()=>import(`./life-CWlZKeiu.js`),__vite__mapDeps([10,2,4]),import.meta.url)]],Ct=[[`sky-basic`,()=>Z(()=>import(`./sky-basic-FzHgmwST.js`),__vite__mapDeps([11,2]),import.meta.url)],[`terrain-basic`,()=>Z(()=>import(`./terrain-basic-CvkGhQuN.js`),__vite__mapDeps([12,2]),import.meta.url)]],wt={loom:()=>Z(()=>import(`./loom-BcDD2JU2.js`),__vite__mapDeps([13,2,14]),import.meta.url),wardens:()=>Z(()=>import(`./wardens-OO_Xuu5U.js`),__vite__mapDeps([15,2]),import.meta.url),observatory:()=>Z(()=>import(`./observatory-Yis9EN5I.js`),__vite__mapDeps([16,2,17]),import.meta.url),stair:()=>Z(()=>import(`./stair-D4fHMrKv.js`),__vite__mapDeps([18,2,17]),import.meta.url),choir:()=>Z(()=>import(`./choir-U40p8af6.js`),__vite__mapDeps([19,2]),import.meta.url),needles:()=>Z(()=>import(`./needles-By8wR9R5.js`),__vite__mapDeps([20,2,14]),import.meta.url),span:()=>Z(()=>import(`./span-CH3M2RzM.js`),__vite__mapDeps([21,2,17,8,14]),import.meta.url),temple:()=>Z(()=>import(`./temple-BUB7d4Jj.js`),__vite__mapDeps([22,1,2,8]),import.meta.url),orrery:()=>Z(()=>import(`./orrery-CxcAC3Ep.js`),__vite__mapDeps([23,2]),import.meta.url),monastery:()=>Z(()=>import(`./monastery-DxUwLzKx.js`),__vite__mapDeps([24,2]),import.meta.url),isles:()=>Z(()=>import(`./isles-CVDs_3uq.js`),__vite__mapDeps([25,2,17]),import.meta.url)},Tt=[[`post`,()=>Z(()=>import(`./postfx-v_2vlSiK.js`).then(e=>e.t),__vite__mapDeps([26,1,2]),import.meta.url)],[`controls`,()=>Z(()=>import(`./controls-DX7CeMlr.js`),__vite__mapDeps([27,2,28]),import.meta.url),{interactive:!0}],[`tour`,()=>Z(()=>import(`./tour-Do76daLD.js`),__vite__mapDeps([29,2,28,4]),import.meta.url),{interactive:!0}],[`hud`,()=>Z(()=>import(`./hud-D2WSdXqL.js`),__vite__mapDeps([30,4,31]),import.meta.url),{interactive:!0}],[`audio`,()=>Z(()=>import(`./ambience-5HBUcntn.js`),[],import.meta.url),{interactive:!0}]],Q=gt(),$=window.__MW={ready:!1,frame:0,errors:[],modules:{},moduleObjects:{},params:Q};window.addEventListener(`error`,e=>$.errors.push(String(e.message||e))),window.addEventListener(`unhandledrejection`,e=>$.errors.push(String(e.reason?.stack||e.reason)));var Et=document.getElementById(`loader-bar`),Dt=document.getElementById(`loader-status`),Ot=(e,t)=>{Et&&(Et.style.transform=`scaleX(${e})`),Dt&&t&&(Dt.textContent=t)},kt=()=>new Promise(e=>requestAnimationFrame(()=>e()));function At(e){return!Q.skip.includes(e)&&!!(!Q.modules||Q.modules.includes(e)||e.startsWith(`landmark:`)&&Q.modules.includes(`landmarks`))}function jt(e){let t=e.camera;if(Q.cam){t.position.set(Q.cam[0],Q.cam[1],Q.cam[2]);let n=Q.look||[0,0,0];t.lookAt(n[0],n[1],n[2]),e.camState.mode=`fixed`}else{let[n,,r]=E.position;t.position.set(n,e.heightAt(n,r)+E.heightAboveGround,r),t.lookAt(...E.lookAt)}t.updateMatrixWorld()}async function Mt(e,t,n,r){let i=performance.now(),a=new Set(e.scene.children);try{let o=await n();if(typeof o.build!=`function`)throw Error(`module ${t} has no build()`);let s=await o.build(e,r)||{};return typeof s.update==`function`&&e.onUpdate(s.update,s.order??0),$.modules[t]={ok:!0,ms:Math.round(performance.now()-i)},$.moduleObjects[t]=e.scene.children.filter(e=>!a.has(e)),s}catch(e){return console.error(`[monolith] module "${t}" failed:`,e),$.errors.push(`${t}: ${e?.stack||e}`),$.modules[t]={ok:!1,error:String(e)},null}}async function Nt(){let e=document.getElementById(`world`),t;try{t=vt(e,Q)}catch(e){document.body.classList.add(`no-webgl`);let t=document.getElementById(`loader-status`);throw t&&(t.textContent=`This world needs WebGL 2. Please try a recent desktop browser.`),e}$.ctx=t,$.THREE=a,jt(t),Q.shot&&document.body.classList.add(`shot`);let n=[];for(let[e,t]of Ct)Q.modules?.includes(e)&&n.push({id:e,loader:t});for(let[e,t]of St)At(e)&&n.push({id:e,loader:t});for(let e of w){let t=`landmark:${e.id}`;At(t)&&n.push({id:t,loader:wt[e.id],arg:e,site:e})}for(let[e,t,r]of Tt)r?.interactive&&(Q.shot||Q.cam)||(e===`post`?!Q.skip.includes(`post`):At(e))&&n.push({id:e,loader:t});let r=0;for(let e of n){Ot(r/n.length,e.site?`Raising ${e.site.name}…`:`Shaping the ${e.id}…`),await kt();let i=await Mt(t,e.id,e.loader,e.arg);e.site&&t.landmarks.push({site:e.site,object:i?.object??null,viewpoints:i?.viewpoints??[]}),r++}Ot(1,`Waking the wilds…`),await kt();try{t.renderer.compileAsync?await t.renderer.compileAsync(t.scene,t.camera):t.renderer.compile(t.scene,t.camera)}catch(e){console.warn(`shader precompile failed`,e)}$.setView=(e,n)=>{t.camState.mode=`fixed`,t.camera.position.set(e[0],e[1],e[2]),t.camera.lookAt(n[0],n[1],n[2]),t.camera.updateMatrixWorld()},$.setHour=e=>t.env.setHour(e),$.stats=()=>({calls:t.renderer.info.render.calls,triangles:t.renderer.info.render.triangles,geometries:t.renderer.info.memory.geometries,textures:t.renderer.info.memory.textures,programs:t.renderer.info.programs?.length??0});let i=t.renderer.getPixelRatio(),o=Math.max(.5,i*.55),s={acc:0,n:0,cooldown:4,good:0};function c(e){if(Q.shot||document.hidden||(s.acc+=e,s.n++,s.acc<1.5))return;let n=s.acc/s.n*1e3;if(s.acc=0,s.n=0,s.cooldown>0){s.cooldown--;return}let r=t.renderer.getPixelRatio(),a=r;n>24&&r>o?(a=Math.max(o,r*(n>40?.8:.9)),s.good=0,s.cooldown=2):n<18.5&&r<i?++s.good>=4&&(a=Math.min(i,r*1.06),s.good=0):s.good=0,Math.abs(a-r)>.01&&(t.renderer.setPixelRatio(a),t.resize())}let l=performance.now(),u=l;function d(e){let n=Math.max(0,(e-l)/1e3),r=Math.min(.1,n);l=e,$.frame>30&&n<1&&c(n),t.renderer.info.reset();try{t.tick(r,(e-u)/1e3),t.render(r)}catch(e){$.errors.length<50&&$.errors.push(`frame: ${e?.stack||e}`),console.error(e)}$.frame++,requestAnimationFrame(d)}requestAnimationFrame(d),document.body.classList.add(`loaded`),t.events.emit(`ready`,t),$.ready=!0}Nt();export{T as _,Ee as a,Se as c,O as d,k as f,x as g,S as h,De as i,R as l,L as m,ct as n,le as o,B as p,Ge as r,J as s,Z as t,A as u,D as v};