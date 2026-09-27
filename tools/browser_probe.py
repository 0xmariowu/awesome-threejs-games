#!/usr/bin/env python3
"""Read-only browser smoke probe; saves DOM, requests, failures and screenshots."""
import argparse, asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

async def run(args):
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True, args=['--enable-webgl','--use-angle=metal','--enable-unsafe-webgpu'])
        context=await browser.new_context(viewport={'width':1280,'height':800}, device_scale_factor=1)
        requests=[];failures=[];errors=[];logs=[];responses=[]
        page=await context.new_page()
        page.on('request',lambda r:requests.append({'url':r.url,'method':r.method,'type':r.resource_type}))
        page.on('response',lambda r:responses.append({'url':r.url,'status':r.status}))
        page.on('requestfailed',lambda r:failures.append({'url':r.url,'error':r.failure}))
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m: logs.append({'type':m.type,'text':m.text[:1000]}) if m.type in ('error','warning') else None)
        if args.offline:
            async def route(r):
                if r.request.url.startswith(('http://127.0.0.1:','http://localhost:','data:','blob:')): await r.continue_()
                else: await r.abort()
            await context.route('**/*',route)
        try: await page.goto(args.url,wait_until='domcontentloaded',timeout=60000)
        except Exception as e:errors.append('Navigation: '+str(e))
        await page.wait_for_timeout(args.wait*1000)
        (out/'body.txt').write_text(await page.locator('body').inner_text())
        (out/'dom.html').write_text(await page.content())
        await page.screenshot(path=str(out/'initial.png'))
        print(json.dumps({'title':await page.title(),'text':(await page.locator('body').inner_text())[:4500],'buttons':await page.locator('button').all_text_contents(),'errors':errors[:10],'failed':failures[:15]},ensure_ascii=False),flush=True)
        if args.click:
            await page.get_by_text(args.click,exact=True).first.click(timeout=10000)
            await page.wait_for_timeout(8000)
            await page.screenshot(path=str(out/'entered.png'))
        if args.move:
            await page.keyboard.down('w');await page.wait_for_timeout(1500);await page.keyboard.up('w')
            await page.screenshot(path=str(out/'moved.png'))
        result={'url':args.url,'title':await page.title(),'offline':args.offline,'requests':requests,'responses':responses,'failures':failures,'errors':errors,'logs':logs,'body':await page.locator('body').inner_text()}
        (out/'browser.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
        (out/'urls.json').write_text(json.dumps(sorted({r['url'] for r in requests if r['method']=='GET'}),indent=2))
        await browser.close()

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('url');ap.add_argument('out');ap.add_argument('--wait',type=int,default=15);ap.add_argument('--offline',action='store_true');ap.add_argument('--click');ap.add_argument('--move',action='store_true');asyncio.run(run(ap.parse_args()))
