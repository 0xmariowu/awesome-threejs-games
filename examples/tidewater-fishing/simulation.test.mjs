import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CatchMinigame } from './original/CatchMinigame.js';
import { GameState } from './original/GameState.js';
import { FishingSession, seededRandom } from './session.mjs';

test('all four original modules retain exact archived bytes and MIT notice',async()=>{
  const provenance=JSON.parse(await readFile(new URL('./provenance.json',import.meta.url),'utf8'));
  for(const file of provenance.files){
    const original=await readFile(new URL(`../../${file.source}`,import.meta.url));
    const extracted=await readFile(new URL(`../../${file.path}`,import.meta.url));
    assert.deepEqual(extracted,original);
    assert.equal(createHash('sha256').update(extracted).digest('hex'),file.sha256);
  }
  assert.match(await readFile(new URL('./LICENSE',import.meta.url),'utf8'),/DRG Software Solutions LLC/);
});

function replay(species,kg,reeling,hz=60){
  const game=new CatchMinigame({species,kg,rng:seededRandom(42)});
  for(let frame=0;frame<hz*300&&game.state==='fighting';frame++)game.update(1/hz,reeling);
  return game;
}
for(const [species,kg,reel,outcome,seconds] of [['mullet',1,true,'caught',11.1],['tuna',12,true,'snapped',1.566666666666666],['silverside',.05,false,'escaped',4.333333333333333]]) {
  test(`${outcome}: seeded replay remains terminal and agrees at 30/60/120 Hz`,()=>{
    const reference=replay(species,kg,reel);
    assert.equal(reference.state,outcome);assert.ok(Math.abs(reference.time-seconds)<1e-8);
    const terminal=JSON.stringify(reference);
    for(let i=0;i<60;i++)reference.update(1/60,!reel);
    assert.equal(JSON.stringify(reference),terminal);
    for(const hz of [30,120]){const game=replay(species,kg,reel,hz);assert.equal(game.state,outcome);assert.ok(Math.abs(game.time-seconds)<.08);}
    assert.equal(JSON.stringify(replay(species,kg,reel)),terminal);
  });
}
test('host pause, resume, catch-once, disposal and clamped background frames',()=>{
  const session=new FishingSession();session.reeling=true;
  for(let i=0;i<80;i++)session.advance(.1);
  session.pause();const time=session.game.time;session.advance(20);assert.equal(session.game.time,time);assert.equal(session.reeling,false);
  session.pause(false);session.reeling=true;session.advance(20);assert.ok(session.game.time-time<=.10001);
  for(let i=0;i<100;i++)session.advance(.1);
  assert.equal(session.game.state,'caught');assert.equal(session.save.inventory.length,1);
  session.advance(.1);assert.equal(session.save.inventory.length,1);
  session.reset();session.dispose();session.advance(1);assert.equal(session.game.time,0);
});
test('economy: capacity records, sell once, upgrades and storage round trip',()=>{
  const map=new Map();const storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};
  const session=new FishingSession({storage});const state=session.save;
  state.addFish('tuna',25);assert.equal(state.addFish('tuna',26),null);
  assert.equal(state.inventory.length,1);assert.equal(state.log.tuna.count,2);assert.equal(state.log.tuna.bestKg,26);
  const sale=state.sell();assert.equal(sale.count,1);assert.equal(state.money,sale.total);assert.deepEqual(state.sell(),{total:0,count:0});
  const before=state.money;assert.equal(state.buy('line').index,1);assert.equal(state.money,before-60);assert.equal(state.stats.lineKg,13);
  const reloaded=new FishingSession({storage});assert.equal(reloaded.save.money,state.money);assert.equal(reloaded.save.log.tuna.count,2);assert.equal(reloaded.save.stats.lineKg,13);
  assert.equal(map.has('tidewater.save.v1'),false);assert.equal(map.size,1);
});
test('legacy lengths, malformed JSON and unavailable storage do not prevent play',()=>{
  const state=new GameState(null);
  assert.equal(state.fromJSON({v:2}),false);
  assert.equal(state.fromJSON({v:1,money:20,inventory:[{id:1,species:'mullet',kg:1,value:5}],log:{mullet:{count:1,bestKg:1}}}),true);
  assert.ok(state.inventory[0].cm>0);assert.ok(state.log.mullet.bestCm>0);
  const malformed=new GameState({getItem:()=>'{broken',setItem(){}});assert.equal(malformed.load(),false);
  const unavailable=new GameState({getItem(){throw new Error('blocked');},setItem(){throw new Error('full');}});
  assert.equal(unavailable.load(),false);assert.doesNotThrow(()=>unavailable.addFish('mullet',1));assert.equal(unavailable.inventory.length,1);
});
