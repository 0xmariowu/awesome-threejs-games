import { CatchMinigame } from './original/CatchMinigame.js';
import { GameState } from './original/GameState.js';
import { FISH } from './original/FishTable.js';

export function seededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {state = (Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
}
export function scopedStorage(storage) {
  return storage ? {getItem:key=>storage.getItem(`gameref.example.${key}`),setItem:(key,value)=>storage.setItem(`gameref.example.${key}`,value)} : null;
}
// Host adapter only. Original balance, state transitions and persistence stay byte-identical.
export class FishingSession {
  constructor({storage=null,seed=42,species='mullet',kg=1,distance=15} = {}) {
    this.save = new GameState(scopedStorage(storage));
    this.save.load();
    this.reset({seed,species,kg,distance});
  }
  reset({seed=42,species='mullet',kg=1,distance=15} = {}) {
    if(!FISH[species] || !Number.isFinite(kg) || kg<=0 || !Number.isFinite(distance) || distance<1.2 || distance>60)throw new Error('Invalid fishing fixture');
    this.game = new CatchMinigame({species,kg,distance,lineKg:this.save.stats.lineKg,reelSpeed:this.save.stats.reelSpeed,rng:seededRandom(seed)});
    this.accumulator=0;this.reeling=false;this.paused=false;this.recorded=false;
  }
  advance(seconds) {
    if(this.paused || this.game.state!=='fighting' || !Number.isFinite(seconds) || seconds<=0)return;
    // A delayed or background frame must not inject seconds of simulation in a burst.
    this.accumulator+=Math.min(seconds,.1);
    const step=1/60;
    while(this.accumulator+1e-10>=step && this.game.state==='fighting') {
      this.game.update(step,this.reeling);this.accumulator-=step;
    }
    if(this.game.state==='caught' && !this.recorded){this.recorded=true;this.save.addFish(this.game.species,this.game.kg);}
  }
  pause(value=true) {this.paused=value;this.reeling=false;this.accumulator=0;}
  dispose() {this.pause();}
}
