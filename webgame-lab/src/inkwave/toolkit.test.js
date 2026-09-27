import {describe, it, expect} from 'vitest';
import {FrameStats} from './runtime/frameStats.js';
import {SkillSequence} from './runtime/skillSequence.js';
import {bakeAO} from './runtime/world/bakeAO.js';
import {Level} from './runtime/world/level.js';
import {Physics} from './runtime/game/physics.js';
import {surfaceResponse} from './systems';
import {Vector3} from 'three';

describe('WebGL game toolkit', () => {
  it('retains recent frame spikes without unbounded history', () => {
    const stats = new FrameStats(20);
    for(let i=0;i<20;i++) stats.push(.016);
    stats.push(.09); stats.push(.04);
    expect(stats.snapshot()).toEqual({samples:20,medianMs:16,p95Ms:40,maxMs:90});
    for(let i=0;i<20;i++) stats.push(.01);
    expect(stats.snapshot().maxMs).toBe(10);
  });
  it('cancels a charged attack before impact and retriggers without stale cues', () => {
    const cues = [], skill = new SkillSequence(c => cues.push(c.type));
    skill.play('charged'); skill.update(.3); skill.cancel(); skill.update(5);
    expect(cues).toEqual(['charge','charge']);
    skill.play('impact'); skill.update(2); skill.update(2);
    expect(cues.slice(2)).toEqual(['impact','ring']);
    expect(skill.active).toBe(false);
  });
  it('bakes open surfaces brighter than a corner using the same rays', async () => {
    const layout = {bounds:{minX:-3,maxX:3,minZ:-3,maxZ:3},spawnPads:[[0,0,0]],single:[
      {kind:'box',min:[-3,-1,-3],max:[3,0,3]}, {kind:'box',min:[0,0,-3],max:[.3,3,3]},
    ],half:[]};
    const level = new Level(layout), texture = await bakeAO(level,new Physics(level),{size:128,ppm:4,samples:24});
    const floor = level.faces.find(f => f.block===0 && f.n.y>.9);
    const sample = (x,z) => {
      const relative = new Vector3(x,0,z).sub(floor.origin);
      const u=relative.dot(floor.u),v=relative.dot(floor.v),l=floor.light;
      return texture.image.data[(l.y+l.pad+Math.floor(v*l.ppm))*128+l.x+l.pad+Math.floor(u*l.ppm)];
    };
    expect(sample(-.2,0)).toBeLessThan(sample(-2.5,0)-20);
    expect(texture.userData.rays).toBeGreaterThan(0);
    texture.dispose();
  });
  it('cancelled AO work creates no GPU texture', async () => {
    const level = new Level({bounds:{minX:-1,maxX:1,minZ:-1,maxZ:1},spawnPads:[[0,0,0]],single:[],half:[]});
    expect(await bakeAO(level,new Physics(level),{cancelled:()=>true})).toBeNull();
  });
  it('reuses ownership for speed pads and recovery without changing the stored paint', () => {
    expect(surfaceResponse(1,0,'boost').speed).toBeGreaterThan(1);
    expect(surfaceResponse(2,0,'boost').speed).toBeLessThan(1);
    expect(surfaceResponse(1,0,'recovery').damage).toBeLessThan(0);
    expect(surfaceResponse(2,0,'recovery').refill).toBeLessThan(0);
    expect(surfaceResponse(0,0,'recovery').damage).toBe(0);
  });
});
