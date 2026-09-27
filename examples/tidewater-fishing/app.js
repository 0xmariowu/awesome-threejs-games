import { tr } from './i18n.js';
import { FishingSession } from './session.mjs';
const $=selector=>document.querySelector(selector);
let storage=null;try{storage=localStorage;}catch{}
const session=new FishingSession({storage});
const weights={mullet:1,tuna:12,silverside:.05};
const states={fighting:tr({ zh: "搏鱼中", en: "Fighting" }),caught:tr({ zh: "已捕获", en: "Caught" }),snapped:tr({ zh: "鱼线断了", en: "Line snapped" }),escaped:tr({ zh: "鱼逃走了", en: "Fish escaped" })};
function render(){drawPicture();const g=session.game;$('#outcome').textContent=session.paused?tr({ zh: "已暂停", en: "Paused" }):states[g.state];$('#time').textContent=`${g.time.toFixed(1)} s`;$('#tension-value').textContent=g.tension.toFixed(2);$('#needle').style.left=`${Math.min(99,g.tension/1.3*100)}%`;$('#distance').textContent=`${g.distance.toFixed(1)} m`;$('#stamina').textContent=`${Math.round(g.stamina*100)}%`;$('#surge').textContent=`${Math.round(g.surge*100)}%`;$('#reel').setAttribute('aria-pressed',String(session.reeling));$('#pause').textContent=session.paused?tr({ zh: "继续", en: "Resume" }):tr({ zh: "暂停", en: "Pause" });$('#inventory').textContent=tr({ zh: `${session.save.inventory.length} 条鱼 · ${session.save.holdKg.toFixed(2)} 千克 · 钱包 $${session.save.money}`, en: `${session.save.inventory.length} fish · ${session.save.holdKg.toFixed(2)} kg · Wallet $${session.save.money}` });}
let last=performance.now(),raf;
function frame(now){session.advance((now-last)/1000);last=now;render();raf=requestAnimationFrame(frame);}
function reel(value){session.reeling=value&&!session.paused&&session.game.state==='fighting';render();}
$('#reel').addEventListener('pointerdown',event=>{event.preventDefault();$('#reel').setPointerCapture(event.pointerId);reel(true);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#reel').addEventListener(event,()=>reel(false));
let keyboardReeling=false;
document.addEventListener('keydown',event=>{if(event.code==='Space'&&(!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)||document.activeElement===$('#reel'))){event.preventDefault();keyboardReeling=true;reel(true);}});
document.addEventListener('keyup',event=>{if(event.code==='Space'&&keyboardReeling){event.preventDefault();keyboardReeling=false;reel(false);}});
window.addEventListener('blur',()=>{session.pause();render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);session.pause();render();}else{last=performance.now();raf=requestAnimationFrame(frame);}});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);session.dispose();});
$('#pause').addEventListener('click',()=>{session.pause(!session.paused);last=performance.now();render();});
$('#reset').addEventListener('click',()=>{const species=$('#species').value;session.reset({species,kg:weights[species],seed:Number($('#seed').value)>>>0});last=performance.now();$('#message').textContent=tr({ zh: "开始新一轮搏鱼。鱼舱里已有的鱼会保留。", en: "New fight. Fish already in the hold are preserved." });render();});
$('#sell').addEventListener('click',()=>{const sale=session.save.sell();$('#message').textContent=tr({ zh: `售出 ${sale.count} 条鱼，共 $${sale.total}。`, en: `Sold ${sale.count} fish for $${sale.total}.` });render();});

// A visual view of the original fight state; all labels and controls live below.
const picture = document.querySelector('#fishing-picture');
const paint = picture.getContext('2d');
function drawPicture() {
  if (!paint) return;
  const w = picture.width, h = picture.height, g = session.game;
  const sky = paint.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#c7dfe4'); sky.addColorStop(.34, '#8cc7cf'); sky.addColorStop(1, '#123f58');
  paint.fillStyle = sky; paint.fillRect(0, 0, w, h);
  const x = w * (.38 + Math.min(g.distance, 60) / 150), y = h * (.57 + Math.sin(g.time * 2) * .035);
  paint.strokeStyle = g.tension > .85 ? '#ed9166' : '#f3e1aa'; paint.lineWidth = Math.max(2, w / 420);
  paint.beginPath(); paint.moveTo(w * .14, h * .08); paint.quadraticCurveTo(w * .38, h * .2 + (1-g.tension)*h*.32, x, y); paint.stroke();
  paint.fillStyle = g.state === 'caught' ? '#f0b541' : '#b8e3d9';
  paint.beginPath(); paint.ellipse(x, y, w*.035, h*.028, -.18, 0, Math.PI*2); paint.fill();
  paint.beginPath(); paint.moveTo(x+w*.025,y); paint.lineTo(x+w*.054,y-h*.031); paint.lineTo(x+w*.054,y+h*.031); paint.closePath(); paint.fill();
  paint.fillStyle='#173545'; paint.beginPath(); paint.arc(x-w*.019,y-h*.005,Math.max(2,w*.002),0,Math.PI*2);paint.fill();
  paint.fillStyle='#ffffff30'; paint.fillRect(w*.26,h*.88,w*.48,h*.012);
  paint.fillStyle=g.tension>.85?'#ed9166':'#c8e5b5';paint.fillRect(w*.26,h*.88,w*.48*Math.min(1,g.tension/1.3),h*.012);
}
new ResizeObserver(() => {picture.width = picture.clientWidth * devicePixelRatio; picture.height = picture.clientHeight * devicePixelRatio; drawPicture();}).observe(picture);

render();raf=requestAnimationFrame(frame);
