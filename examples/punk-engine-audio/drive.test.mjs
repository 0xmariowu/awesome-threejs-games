import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Drive,IDLE,LIMIT,RATIOS} from './src/drive.mjs';
const run=(d,seconds,throttle)=>{for(let i=0;i<seconds*120;i++)d.step(1/120,throttle);};
test('manual acceleration reaches bounded repeated 50 ms limiter cuts and coasts to idle',()=>{
 const d=new Drive();run(d,5,1);
 assert.ok(d.limiterCuts>5);assert.ok(d.rpm>7500&&d.rpm<=LIMIT+60);
 assert.equal(d.throttle,1);run(d,8,0);assert.equal(d.rpm,IDLE);assert.equal(d.load,0);
});
test('Quadra shift ratios change RPM and cut load during the 140 ms shift',()=>{
 const d=new Drive();run(d,1,1);const before=d.rpm;d.shift(1);
 assert.equal(d.gear,2);assert.equal(d.rpm,before*RATIOS[1]/RATIOS[0]);
 d.step(1/120,1);assert.equal(d.load,0);run(d,.2,1);assert.ok(d.load>.9);
});
test('lift releases a spooled turbo once, and idle lifts do not',()=>{
 const d=new Drive();run(d,.1,1);run(d,.1,0);assert.equal(d.releases,0);
 run(d,2,1);assert.ok(d.spin>.3);run(d,.1,0);assert.equal(d.releases,1);
 run(d,1,0);assert.equal(d.releases,1);
});
test('drive sweep visits all six gears, coasts and starts another pass',()=>{
 const d=new Drive();d.auto=true;const gears=new Set();let coast=false,restarted=false;
 for(let i=0;i<40*120;i++){d.step(1/120,0);gears.add(d.gear);coast ||= d.coast;restarted ||= coast&&d.gear===1&&!d.coast;}
 assert.deepEqual([...gears],[1,2,3,4,5,6]);assert.ok(coast);assert.ok(restarted);
});
