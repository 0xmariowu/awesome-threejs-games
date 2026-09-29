import { tr } from './i18n.js';
import { Drive, LIMIT } from './drive.mjs';
import { EngineAudio } from './audio.mjs';
const $ = id => document.getElementById(id);
const drive = new Drive();
let manualThrottle=0;
let audio=null, held=false, running=false, last=performance.now(), accumulator=0, releaseUntil=0;
const texts={idle:{en:'Idle',zh:'怠速'},power:{en:'On throttle',zh:'加速'},coast:{en:'Overrun',zh:'收油'},
  shift:{en:'Shifting',zh:'换挡'},limit:{en:'Rev limiter',zh:'转速限制'},release:{en:'Turbo release',zh:'涡轮泄压'}};
const svgNS='http://www.w3.org/2000/svg';
function point(rpm,radius) {const a=(-220+rpm/8000*260)*Math.PI/180;return [480+Math.cos(a)*radius,300+Math.sin(a)*radius];}
for(let rpm=0;rpm<=8000;rpm+=200) {
  const big=rpm%1000===0,[x1,y1]=point(rpm,big?220:228),[x2,y2]=point(rpm,238);
  const line=document.createElementNS(svgNS,'line');
  for(const [k,v] of Object.entries({x1,y1,x2,y2,class:rpm>=7600?'red':big?'':'minor'}))line.setAttribute(k,v);
  $('ticks').append(line);
  if(big){const text=document.createElementNS(svgNS,'text'),[x,y]=point(rpm,193);text.setAttribute('x',x);text.setAttribute('y',y+8);text.textContent=rpm/1000;$('ticks').append(text);}
}
function disengage() {held=false;drive.auto=false;manualThrottle=0;$('drive').setAttribute('aria-pressed','false');}
$('start').onclick=async()=>{
  $('start').disabled=true;
  try {
    if(!audio){audio=new EngineAudio();await audio.start();audio.mode=$('voice').value;audio.master.gain.value=Number($('volume').value);}
    else if(running){disengage();await audio.context.suspend();}
    else await audio.context.resume();
    running=audio.context.state==='running';
    $('start').textContent=tr(running?{en:'Pause audio',zh:'暂停声音'}:{en:'Start audio',zh:'启动声音'});
    $('status').textContent=tr(running?{en:'Audio running · original worklets',zh:'声音已启动 · 原版音频模块'}:{en:'Audio paused',zh:'声音已暂停'});
  } catch(error) {
    if(audio?.context)await audio.context.close();audio=null;running=false;
    $('status').textContent=tr({en:'Audio failed: ',zh:'声音启动失败：'})+error.message;
  } finally {$('start').disabled=false;}
};
$('drive').onclick=()=>{drive.auto=!drive.auto;drive.coast=false;held=false;manualThrottle=0;$('drive').setAttribute('aria-pressed',String(drive.auto));};
$('throttle').oninput=()=>{manualThrottle=Number($('throttle').value);held=false;drive.auto=false;$('drive').setAttribute('aria-pressed','false');};
$('down').onclick=()=>drive.shift(-1);$('up').onclick=()=>drive.shift(1);
$('voice').onchange=()=>{if(audio)audio.mode=$('voice').value;};
$('volume').oninput=()=>{if(audio)audio.master.gain.setTargetAtTime(Number($('volume').value),audio.context.currentTime,.03);};
addEventListener('keydown',event=>{
  if(event.ctrlKey||event.altKey||event.metaKey||event.target.closest('select,textarea,[contenteditable]'))return;
  if(!['KeyW','KeyQ','KeyE'].includes(event.code))return;
  event.preventDefault();
  if(event.code==='KeyW'){held=true;drive.auto=false;$('drive').setAttribute('aria-pressed','false');}
  else if(!event.repeat)drive.shift(event.code==='KeyQ'?-1:1);
});
addEventListener('keyup',event=>{if(event.code==='KeyW')held=false;});
addEventListener('blur',disengage);
document.addEventListener('visibilitychange',()=>{if(document.hidden)disengage();});
window.__example={ready:true};
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;accumulator+=dt;
  while(accumulator>=1/120){
    drive.step(1/120,held?1:manualThrottle);accumulator-=1/120;
    if(audio&&running){audio.update(drive);if(drive.releaseStrength)releaseUntil=drive.time+.75;}
  }
  const sound=audio?.data?audio.snapshot():null;
  const activity=drive.limiterTimer>0?'limit':drive.shiftTimer>0?'shift':drive.time<releaseUntil?'release':drive.throttle>.05?'power':drive.rpm>1100?'coast':'idle';
  $('rpm-number').textContent=Math.round(drive.rpm).toLocaleString('en-US');
  $('gear-number').textContent=drive.gear;$('boost-number').textContent=Math.round(drive.spin*100)+'%';
  $('activity').textContent=tr(texts[activity]);$('instrument').dataset.limiting=String(activity==='limit');
  $('needle').setAttribute('transform',`rotate(${-130+Math.min(drive.rpm,8000)/8000*260} 480 300)`);
  const [x,y]=point(Math.min(drive.rpm,8000),252),[sx,sy]=point(0,252);
  $('rpm-arc').setAttribute('d',`M${sx},${sy} A252,252 0 ${drive.rpm>8000*180/260?1:0} 1 ${x},${y}`);
  $('throttle').value=String(drive.throttle);
  $('throttle-value').textContent=Math.round(drive.throttle*100)+'%';$('load').textContent=Math.round(drive.load*100)+'%';
  $('rms').textContent=(sound?.rms??0).toFixed(4);$('releases').textContent=sound?.releases??0;$('cuts').textContent=drive.limiterCuts;
  if(sound){audio.output.getFloatTimeDomainData(audio.data);let path='';for(let i=0;i<240;i++)path+=`${i?'L':'M'}${300+i*1.5},${478+audio.data[i*4]*40} `;$('wave').setAttribute('d',path);}
  window.__example={ready:true,running,rpm:drive.rpm,gear:drive.gear,throttle:drive.throttle,load:drive.load,
    auto:drive.auto,coast:drive.coast,spin:drive.spin,shifting:drive.shiftTimer>0,limiting:drive.limiterTimer>0,
    limiterCuts:drive.limiterCuts,shifts:drive.shifts,time:drive.time,limit:LIMIT,activity,audio:sound};
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
