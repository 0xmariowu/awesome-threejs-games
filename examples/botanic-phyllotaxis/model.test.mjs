import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrangement, GOLDEN_ANGLE, packingDistance} from './src/model.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('golden angle and Vogel radius follow their closed forms',()=>{
  close(GOLDEN_ANGLE,137.50776405003785);
  const points=arrangement({type:'sunflower',count:610,angle:137.5});
  points.forEach((p,i)=>{close(p.x*p.x+p.z*p.z,.105**2*(i+.5));if(i)close(p.theta-points[i-1].theta,137.5*Math.PI/180);});
});
test('alternate, opposite, decussate and whorled have distinct node rules',()=>{
  const alternate=arrangement({type:'alternate',count:12,spacing:.2});
  close(alternate[1].theta-alternate[0].theta,Math.PI);close(alternate[1].y-alternate[0].y,.2);
  for(const type of ['opposite','decussate']){
    const p=arrangement({type,count:12,spacing:.2});
    for(let i=0;i<12;i+=2){close(p[i].y,p[i+1].y);close(p[i+1].theta-p[i].theta,Math.PI);}
    close(p[2].theta-p[0].theta,type==='opposite'?0:Math.PI/2);
  }
  const p=arrangement({type:'whorled',count:12,spacing:.2});
  close(p[0].y,p[2].y);close(p[1].theta-p[0].theta,2*Math.PI/3);close(p[3].y-p[0].y,.2);
});
test('spacing changes stem height, taper changes leaf sizes, and seed is repeatable',()=>{
  const a=arrangement({seed:91}),b=arrangement({seed:91}),c=arrangement({seed:92});assert.deepEqual(a,b);assert.notDeepEqual(a,c);
  const short=arrangement({spacing:.1}),tall=arrangement({spacing:.3});close(tall.at(-1).y-.25,3*(short.at(-1).y-.25));
  const full=arrangement({taper:0}),tapered=arrangement({taper:.9});assert.ok(tapered.at(-1).size<full.at(-1).size*.2);
});
test('610-seed golden-angle fixture has wider nearest-neighbour spacing than 135/140 degrees',()=>{
  const mean=angle=>packingDistance(arrangement({type:'sunflower',count:610,angle}));
  assert.ok(mean(137.5)>3*mean(135));assert.ok(mean(137.5)>2*mean(140));
});
