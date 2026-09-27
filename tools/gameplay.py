#!/usr/bin/env python3
"""Exercise actual local game controls and preserve browser evidence."""
import asyncio,json,argparse
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]

async def run(slug,channel=None):
 config=json.loads((ROOT/slug/'local.json').read_text());url=f"http://127.0.0.1:{config['port']}/"
 out=ROOT/'output/playwright'/slug/'gameplay';out.mkdir(parents=True,exist_ok=True)
 result={'url':url,'offline':True,'steps':[],'errors':[],'http_errors':[],'external':[],'requests':[],'console':[]}
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,channel=channel,args=['--use-angle=metal','--enable-unsafe-webgpu'])
  context=await browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
  async def route(r):
   if r.request.url.startswith(('http://127.0.0.1:','http://localhost:')):await r.continue_()
   else:result['external'].append(r.request.url);await r.abort()
  await context.route('**/*',route)
  page=await context.new_page()
  page.on('pageerror',lambda e:result['errors'].append(str(e)))
  page.on('request',lambda r:result['requests'].append(r.url))
  page.on('response',lambda r:result['http_errors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.on('console',lambda m:result['console'].append(m.text[:1200]) if m.type=='error' else None)
  async def shot(name):
   await page.screenshot(path=str(out/(name+'.png')));result['steps'].append({'name':name,'body':(await page.locator('body').inner_text())[:6000]});print(slug,name,flush=True)
  try:
   await page.goto(url,wait_until='domcontentloaded',timeout=60000)
   if slug=='vox-arcana':
    await page.locator('[data-action="practice"]').wait_for()
    await page.locator('[data-action="settings"]').first.click()
    await page.locator('#settings .settings-advanced summary').click()
    await page.locator('#set-jev').uncheck()
    await page.locator('#settings [data-action="quit"]').click()
    await page.locator('[data-action="practice"]').click()
    await page.wait_for_timeout(4000);await shot('practice')
    before=await page.evaluate('({pos:game.player.pos.toArray(),mana:game.player.mana,mode:game.mode})')
    await page.keyboard.down('w');await page.wait_for_timeout(1000);await page.keyboard.up('w')
    await page.keyboard.press('Enter');await page.locator('#type-input').fill('fire ball');await page.keyboard.press('Enter');await page.wait_for_timeout(1200)
    after=await page.evaluate('({pos:game.player.pos.toArray(),mana:game.player.mana,mode:game.mode})')
    result['state']={'before':before,'after':after};assert before['pos']!=after['pos'];await shot('spell')
   elif slug=='scorch-podracer':
    await page.locator('#go').click();await page.wait_for_timeout(1500);await shot('selected')
    if await page.locator('#go').is_visible():await page.locator('#go').click()
    await page.wait_for_timeout(6000)
    await page.keyboard.down('ArrowUp');await page.wait_for_timeout(4000);await page.keyboard.up('ArrowUp');await shot('racing')
    result['speed']=await page.locator('#spd').inner_text()
    await page.keyboard.press('Escape');await shot('pause')
   elif slug=='smartgame-town':
    await page.wait_for_timeout(8000)
    inputs=await page.locator('input').evaluate_all('(els)=>els.map(e=>({type:e.type,id:e.id,placeholder:e.placeholder}))');result['inputs']=inputs
    await page.get_by_text('この見た目でタウンへ！',exact=True).click()
    if await page.get_by_text('ニックネーム',exact=True).is_visible():
     await page.locator('#tw-name').fill('GameRef')
     await page.get_by_text('この見た目でタウンへ！',exact=True).click()
    await page.wait_for_timeout(4000)
    assert not await page.get_by_text('この見た目でタウンへ！',exact=True).is_visible()
    await shot('town')
    await page.keyboard.down('w');await page.wait_for_timeout(1500);await page.keyboard.up('w');await shot('walk')
   elif slug=='everdrift':
    await page.wait_for_timeout(60000);await shot('menu')
    await page.mouse.click(260,494);await page.wait_for_timeout(18000);await shot('new-game')
    for _ in range(18):
     await page.mouse.click(1000,450);await page.wait_for_timeout(900)
    await shot('after-intro')
    await page.keyboard.press('Enter');await page.keyboard.down('w');await page.wait_for_timeout(1500);await page.keyboard.press('Space');await page.keyboard.up('w');await shot('move-jump')
   elif slug=='shabondama-biyori':
    await page.wait_for_function('window.__app && window.__app.ready',timeout=90000)
    await shot('ready');await page.keyboard.press('Space');await page.wait_for_timeout(1200)
    result['bubble_state']=await page.evaluate('({state:__app.director?.state,ready:__app.ready})')
    await shot('blowing');await page.wait_for_timeout(2500)
    await page.mouse.move(600,450);await page.mouse.down();await page.mouse.move(850,480,steps=15);await page.mouse.up();await page.wait_for_timeout(1500);await shot('bubbles')
    await page.keyboard.press('Escape');await shot('menu')
   elif slug=='tidewater':
    await page.get_by_text('Click to explore',exact=True).wait_for(state='visible',timeout=180000)
    await page.get_by_text('Click to explore',exact=True).click();await page.wait_for_timeout(3000)
    if await page.get_by_text('Skip',exact=True).is_visible():await page.get_by_text('Skip',exact=True).click()
    await page.wait_for_timeout(1000);await shot('explore')
    await page.keyboard.down('w');await page.wait_for_timeout(1500);await page.keyboard.up('w');await page.keyboard.press('r');await page.wait_for_timeout(1000)
    await page.mouse.down();await page.wait_for_timeout(800);await page.mouse.up();await page.wait_for_timeout(1500);await shot('cast')
    await page.keyboard.press('i');await shot('inventory')
   elif slug=='moritsuki':
    await page.wait_for_timeout(12000);await shot('town')
    await page.keyboard.press('f');await page.wait_for_timeout(1000);await shot('travel')
    for mini in ['hamaguri','gazami','kusafugu','unagi','mori']:
     await page.goto(url+'moritsuki/'+mini+'/',wait_until='domcontentloaded');await page.wait_for_timeout(6000);await shot(mini)
     await page.locator('[data-act="start"]').first.click();await page.wait_for_timeout(1500)
     await page.keyboard.press('Space');await page.wait_for_timeout(3500)
     if mini in ['hamaguri','gazami','kusafugu']:
      await page.wait_for_function('window.game && game.mode !== "intro"',timeout=30000)
      await page.wait_for_function('!document.querySelector("#fade") || Number(getComputedStyle(document.querySelector("#fade")).opacity)<0.05',timeout=10000)
     await page.keyboard.down('w');await page.wait_for_timeout(800);await page.keyboard.up('w');await shot(mini+'-playing')
   result['completed']=True
  except Exception as e:
   result['completed']=False;result['failure']=str(e)
   try:await shot('failure')
   except Exception:pass
  finally:
   (out/'browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
   print(json.dumps({k:result[k] for k in ['completed','errors','http_errors','external']},ensure_ascii=False),flush=True)
   await browser.close()
 return result['completed']

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('slugs',nargs='+');ap.add_argument('--channel');args=ap.parse_args()
 completed=[asyncio.run(run(slug,args.channel)) for slug in args.slugs]
 if not all(completed):raise SystemExit(1)
