import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scatter,noise} from './src/model.mjs';
test('seed repeatability and different seeded fields',()=>{
  assert.deepEqual(scatter({seed:94}),scatter({seed:94}));assert.notDeepEqual(scatter({seed:94}),scatter({seed:95}));
});
test('all accepted points respect the Poisson exclusion disk and field bounds',()=>{
  for(const seed of [2,42,91]){
    const {points,distance}=scatter({seed,size:6,density:32});
    for(let i=0;i<points.length;i++){
      const a=points[i];assert.ok(Math.abs(a.x)<=3&&Math.abs(a.z)<=3);
      for(let j=0;j<i;j++)assert.ok(Math.hypot(a.x-points[j].x,a.z-points[j].z)>=distance-1e-10);
    }
  }
});
test('density, field size and gaps affect accepted population',()=>{
  assert.ok(scatter({density:40}).points.length>scatter({density:8}).points.length*2);
  assert.ok(scatter({size:12}).points.length>scatter({size:4}).points.length*3);
  assert.ok(scatter({gaps:.9}).points.length<scatter({gaps:0}).points.length*.6);
});
test('species weights exclude zero weights; all-zero is an empty field',()=>{
  assert.equal(scatter({mix:[0,0,0,0,0]}).points.length,0);
  for(let i=0;i<5;i++){
    const mix=[0,0,0,0,0];mix[i]=100;const {points}=scatter({mix});
    assert.ok(points.length>100);assert.ok(points.every(p=>p.species===i));
  }
});
test('coherent noise is bounded and continuous; clumping changes spatial distribution',()=>{
  for(let i=-10;i<10;i++){const value=noise(i*.14,i*.13,41);assert.ok(value>=0&&value<=1);assert.ok(Math.abs(value-noise(i*.14+.001,i*.13,41))<.004);}
  const countVariance=points=>{const bins=Array(64).fill(0);for(const p of points)bins[Math.floor((p.x+4)) + 8*Math.floor((p.z+4))]++;const mean=points.length/64;return bins.reduce((sum,n)=>sum+(n-mean)**2,0)/64/mean**2;};
  assert.ok(countVariance(scatter({clumping:1,gaps:0}).points)>countVariance(scatter({clumping:0,gaps:0}).points)*1.5);
});

test('default plants cover every quadrant with at least 15 percent each',()=>{
  const plants=scatter().points.filter(p=>p.species!==4);
  const quadrants=Array(4).fill(0);
  for(const p of plants)quadrants[Number(p.x>=0)+2*Number(p.z>=0)]++;
  for(const count of quadrants)assert.ok(count/plants.length>=.15,`${quadrants} of ${plants.length} plants`);
  console.log('Default plant quadrants:',quadrants,'of',plants.length);
});

test('default clearings leave plants in every two-metre cell',()=>{
  const bins=Array(16).fill(0);
  for(const p of scatter().points.filter(p=>p.species!==4))bins[Math.floor((p.x+4)/2)+4*Math.floor((p.z+4)/2)]++;
  assert.ok(bins.every(n=>n>=15),`Local plant coverage: ${bins}`);
});
