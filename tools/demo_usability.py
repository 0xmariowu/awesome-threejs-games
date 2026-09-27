#!/usr/bin/env python3
"""Exercise the actual library, frame input/console, code and game/video flows.

Pixel standard deviation >2 rejects blank pictures; RGB mean absolute difference
>0.15 is an observed visual response. Idle captures are one second apart. Every
input and console action has its own before/after evidence and numeric result.
No demo error is allowlisted. Only documented missing game backends are allowed.
"""
import argparse
from contextlib import contextmanager
import io
import json
import math
import os
from pathlib import Path
import random
import re
import socket
import subprocess
import time
from urllib.parse import quote, urljoin, urlparse
from urllib.request import urlopen
from PIL import Image, ImageChops, ImageDraw, ImageStat
from playwright.sync_api import sync_playwright, expect
from site_check import site, MISSING_BACKEND
from experience_check import EXAMPLE_READY, READY_EXPRESSIONS, LOADING_ELEMENTS

ROOT = Path(__file__).resolve().parents[1]
FLAGS = ['--use-angle=metal', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
PICTURE = '[data-demo-picture]:visible, #lab-picture:visible, canvas:visible'
CONSOLE = '[data-demo-console], #lab-console'
THRESHOLD = .15


@contextmanager
def local_site(out):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}/'
    with (out/'server.log').open('w') as log:
        server = subprocess.Popen(['node','tools/library.mjs'], cwd=ROOT,
            env={**os.environ,'LIBRARY_PORT':str(port)}, stdout=log, stderr=log)
        try:
            for _ in range(300):
                try:
                    with urlopen(base+'data/demos.json',timeout=1): break
                except OSError:
                    if server.poll() is not None: raise RuntimeError('Library failed; see server.log')
                    time.sleep(.1)
            else: raise RuntimeError('Library startup timeout')
            yield base
        finally:
            server.terminate()
            try: server.wait(timeout=5)
            except subprocess.TimeoutExpired: server.kill(); server.wait()


def pixels(data):
    image=Image.open(io.BytesIO(data)).convert('RGB')
    # Focus rings and card borders are chrome, not a response inside the scene.
    return image.crop((4,4,image.width-4,image.height-4))


def difference(a,b):
    a,b=pixels(a),pixels(b)
    assert a.size == b.size, f'Picture moved/resized during observation: {a.size} -> {b.size}'
    return round(sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3,4)


class Usability:
    def __init__(self,browser,base,out):
        self.browser,self.base,self.out=browser,base,out
        self.rows=[]

    def context(self,row):
        ctx=self.browser.new_context(viewport={'width':1440,'height':1100},locale='en-US',
            color_scheme='light',permissions=['clipboard-read','clipboard-write'])
        ctx.add_init_script('if(window!==window.top)Object.defineProperty(navigator,"webdriver",{get:()=>false,configurable:true})')
        def expected(url):
            parsed=urlparse(url)
            if parsed.hostname != urlparse(self.base).hostname or parsed.netloc != urlparse(row.get('game_url','')).netloc:
                return False
            path=parsed.path
            slug=row.get('game')
            if '/games/'+str(slug)+'/' in path: path='/'+path.split('/games/'+slug+'/',1)[1]
            return row['kind']=='game' and path in MISSING_BACKEND.get(slug,())
        def attach(page):
            page.on('pageerror',lambda e:row['errors'].append('page: '+str(e)))
            def console(msg):
                if msg.type != 'error': return
                item=msg.text+' @ '+msg.location.get('url','')
                (row['expected'] if expected(msg.location.get('url','')) else row['errors']).append(item)
            page.on('console',console)
        ctx.on('page',attach)
        return ctx

    def run(self,kind,id,action):
        row={'kind':kind,'id':id,'errors':[],'expected':[],'actions':[]}
        if kind=='game': row['game']=id
        started=time.monotonic()
        ctx=self.context(row)
        page=ctx.new_page(); page.set_default_timeout(15000)
        try: action(ctx,page,row)
        except Exception as error:
            row['errors'].append(str(error))
            try: page.screenshot(path=str(self.out/(id.replace(':','_')+'-failure.png')))
            except Exception: pass
        finally: ctx.close()
        row['errors']=list(dict.fromkeys(row['errors']))
        row.update(passed=not row['errors'],seconds=round(time.monotonic()-started,2))
        self.rows.append(row)
        print(f"{kind:5} | {id:40} | {'PASS' if row['passed'] else 'FAIL'} | "+'; '.join(row['errors'])[:320],flush=True)
        self.save()

    def frame(self,page,id):
        iframe=page.locator('iframe')
        expect(iframe).to_have_count(1,timeout=30000)
        expect(iframe).not_to_have_attribute('src','about:blank')
        frame=iframe.element_handle().content_frame()
        frame.wait_for_load_state('domcontentloaded')
        if id.startswith('example:'):
            ready=EXAMPLE_READY.get(id.split(':')[1],'window.__example?.ready')
        else: ready='window.__LAB__?.ready && window.__LAB__?.info?.render?.drawCalls > 0'
        frame.wait_for_function('() => ('+ready+')',timeout=90000)
        if id=='demo:plants':
            frame.wait_for_function('() => window.__LAB__?.info?.plants?.ready && window.__LAB__.info.plants.count===6',timeout=90000)
        picture=frame.locator(PICTURE).first
        picture.wait_for(state='visible',timeout=90000)
        page.wait_for_timeout(700)
        return frame,picture

    def capture(self,picture,row,label):
        name=row['id'].replace(':','_')+'-'+label+'.png'
        data=picture.screenshot(path=str(self.out/name),timeout=20000)
        row[label]=name
        return data

    def readout(self,frame):
        return frame.locator('[data-demo-performance], .lab-performance-group').all_inner_texts()

    def response(self,page,frame,picture,row,label,action):
        before=self.capture(picture,row,label+'-before'); readout=self.readout(frame)
        description=action()
        page.wait_for_timeout(1100)
        after=self.capture(picture,row,label+'-after')
        delta=difference(before,after); updated=self.readout(frame)
        deadline=time.monotonic()+8
        while delta<=THRESHOLD and updated==readout and time.monotonic()<deadline:
            page.wait_for_timeout(400)
            after=self.capture(picture,row,label+'-after')
            delta=difference(before,after);updated=self.readout(frame)
        result={'kind':label,'action':description,'picture_diff':delta,'readout_before':readout,'readout_after':updated,
                'responded':delta>THRESHOLD or updated!=readout}
        row['actions'].append(result)
        assert result['responded'], f'{label} produced no picture or Performance response: {description}'

    def input(self,page,frame,picture,row):
        hint=frame.locator('[data-demo-hint], .lab-frame-hint').all_inner_texts()
        titles=frame.locator('[data-demo-hint]').evaluate_all('ns=>ns.map(n=>n.title)')
        text=' '.join(hint+titles);row['hint']=text
        picture.click(position={'x':picture.bounding_box()['width']*.55,'y':picture.bounding_box()['height']*.65},force=True)
        # Use only documented keys. Pointer-only scenes use the documented gesture.
        key=None
        if re.search(r'WASD|W/S|W / S|W ·|\bW\b',text): key='w'
        elif re.search(r'Space|空格',text,re.I): key='Space'
        elif re.search(r'Tab.*Enter',text): key='Tab'
        elif re.search(r'\b[QERFC]\b',text): key=re.search(r'\b[QERFC]\b',text).group().lower()
        if key:
            page.keyboard.down(key);page.wait_for_timeout(800);page.keyboard.up(key)
            return 'focused picture; held '+key+' 800ms (hint: '+text+')'
        box=picture.bounding_box();x=box['x']+box['width']*.55;y=box['y']+box['height']*.6
        if re.search(r'click|LMB|hold|cast|fire',text,re.I):
            page.mouse.click(x+25,y+10,delay=650)
            return 'picture pointer hold/click (hint: '+text+')'
        if re.search(r'move pointer',text,re.I):
            page.mouse.move(x,y);page.mouse.move(x+120,y-65,steps=15)
            return 'picture pointer movement (hint: '+text+')'
        if re.search(r'drag|orbit|scroll',text,re.I):
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+40,y-18,steps=12);page.mouse.up()
            return 'picture drag 40,-18 (hint: '+text+')'
        raise AssertionError('No documented picture input: '+text)

    def control(self,frame):
        # Prefer the first slider, then select, action button, or checkbox.
        # Leva sliders expose a numeric textbox, and its checkboxes use labels.
        controls=None
        for selector in ['input[type=range]:visible, [role=slider]:visible, input[class*=levaType-number]:visible',
                         'select:visible', 'button:visible', 'input[type=checkbox]']:
            candidate=frame.locator(CONSOLE).locator(selector)
            if candidate.count():controls=candidate;break
        assert controls is not None, 'Console has no slider/select/button/checkbox'
        control=controls.first
        # A team picker is one control: select an alternative, not its already
        # selected option. Toggle buttons such as Pause keep their first target.
        if control.get_attribute('data-team') is not None and control.get_attribute('aria-pressed')=='true':
            control=control.locator('..').locator('button[aria-pressed=false]').first
        detail=control.evaluate('e=>({tag:e.tagName,type:e.type,id:e.id,label:e.getAttribute("aria-label")||e.closest("label")?.textContent||e.parentElement.textContent,value:e.value,checked:e.checked})')
        if detail['tag']=='SELECT':
            values=control.locator('option:not([disabled])').evaluate_all('ns=>ns.map(n=>n.value)')
            value=next((v for v in values if v!=detail['value']),None)
            assert value is not None,'Select has no alternative'
            control.select_option(value);detail['to']=value
        elif detail.get('type')=='checkbox':
            if control.is_visible():control.set_checked(not detail['checked'])
            else:frame.locator('label[for='+json.dumps(detail['id'])+']').last.click()
            detail['to']=control.is_checked()
            assert detail['to']!=detail['checked'],'Checkbox did not change'
        elif detail.get('type')=='range':
            bounds=control.evaluate('e=>({min:Number(e.min||0),max:Number(e.max||100),step:Number(e.step||1),value:Number(e.value)})')
            target=bounds['max'] if bounds['value']<(bounds['min']+bounds['max'])/2 else bounds['min']
            control.focus(); control.press('End' if target==bounds['max'] else 'Home')
            detail['to']=control.input_value();assert detail['to']!=detail['value'],'Slider did not change'
        elif control.get_attribute('class') and 'levaType-number' in control.get_attribute('class'):
            value=float(detail['value'])
            for new in [value+max(abs(value)*.5,1),value*.5 if value else -1]:
                control.fill(str(new));control.press('Enter');control.press('Tab')
                if float(control.input_value())!=value:break
            detail['to']=control.input_value();assert float(detail['to'])!=value,'Numeric slider did not change'
        elif detail['tag']=='BUTTON': control.click()
        else:
            control.click(position={'x':control.bounding_box()['width']*.8,'y':control.bounding_box()['height']/2})
        return detail

    def demo(self,ctx,page,row):
        page.goto(self.base+'demos/'+quote(row['id'],safe='')+'?lang=en',wait_until='domcontentloaded')
        frame,picture=self.frame(page,row['id'])
        picture.focus()
        a=self.capture(picture,row,'idle-before');page.wait_for_timeout(1000);b=self.capture(picture,row,'idle-after')
        row['stddev']=max(ImageStat.Stat(pixels(a)).stddev)
        assert row['stddev']>2,'Blank picture'
        row['idle_diff']=difference(a,b)
        self.response(page,frame,picture,row,'input',lambda:self.input(page,frame,picture,row))
        if row['idle_diff']<=THRESHOLD:
            assert row['actions'][-1]['picture_diff']>THRESHOLD, 'Static picture did not change after documented input'
        row['motion']='animated' if row['idle_diff']>THRESHOLD else 'static until input'
        def change_control():
            detail=self.control(frame)
            if row['id']=='demo:destruct':
                detail['apply']=self.input(page,frame,picture,row)
            return detail
        self.response(page,frame,picture,row,'control',change_control)
        href=page.get_by_role('link',name='Open in new window ↗').get_attribute('href')
        assert ctx.request.get(urljoin(self.base,href)).status==200,'New-window URL not 200'
        page.get_by_role('button',name='Full screen',exact=True).click()
        page.wait_for_function('() => !!document.fullscreenElement')
        page.evaluate('document.exitFullscreen()')
        page.get_by_role('button',name='Reload',exact=True).click()
        expect(page.locator('iframe')).to_have_attribute('src',re.compile(r'[?&]r=1$'))
        self.frame(page,row['id'])
        page.get_by_role('tab',name='Code',exact=True).click()
        expect(page.locator('.code-line')).not_to_have_count(0,timeout=30000)
        colors=page.locator('.code-token').evaluate_all('ns=>[...new Set(ns.map(n=>getComputedStyle(n).color))]')
        assert len(colors)>1,'No syntax highlighting colors'
        row['code_file']=page.locator('.viewer-header').inner_text()
        page.get_by_role('button',name='Copy',exact=True).click()
        expect(page.get_by_role('status')).to_have_text('Copied to clipboard')
        expect(page.get_by_role('status')).to_have_css('opacity','1')
        row['code_path']=page.locator('.viewer-header > span').first.inner_text()
        source=ctx.request.get(self.base+'data/src/'+quote(row['code_path'],safe='/'))
        assert source.status==200,'Default code file is not bundled'
        assert page.evaluate('navigator.clipboard.readText()')==source.text(),'Clipboard differs from source file'
        row['code']=row['toolbar']=True

    def game(self,ctx,page,row):
        page.goto(self.base+'p/'+row['id']+'?lang=en',wait_until='domcontentloaded')
        video=page.locator('video');expect(video).to_have_count(1)
        page.wait_for_function('() => document.querySelector("video").readyState>=2',timeout=30000)
        start=video.evaluate('v=>{v.play();return v.currentTime}')
        page.wait_for_timeout(1500)
        end=video.evaluate('v=>v.currentTime')
        assert end>start+.2,'Overview video does not advance'
        row['video']={'url':video.get_attribute('src'),'before':start,'after':end}
        row['game_url']=urljoin(self.base,page.locator('.project-actions .play-button').get_attribute('href'))
        with page.expect_popup() as pending: page.locator('.project-actions .play-button').click()
        popup=pending.value
        deadline=time.monotonic()+90
        remaining=lambda:max(1,int((deadline-time.monotonic())*1000))
        try:
            popup.locator('canvas').first.wait_for(state='visible',timeout=remaining())
            if row['id'] in READY_EXPRESSIONS: popup.wait_for_function('() => ('+READY_EXPRESSIONS[row['id']]+')',timeout=remaining())
            if row['id'] in LOADING_ELEMENTS: popup.locator(LOADING_ELEMENTS[row['id']]).wait_for(state='hidden',timeout=remaining())
            popup.screenshot(path=str(self.out/(row['id']+'-game.png')))
            assert time.monotonic()<=deadline,'Play exceeded 90 seconds'
            row['play']=popup.url
        finally: popup.close()
        detail=ctx.request.get(self.base+'data/page/'+row['id']+'.json').json()
        row['inline']=[]
        for ex in detail['examples']:
            element=page.locator('.example-row[data-id="'+ex['id']+'"]')
            element.get_by_role('button',name='Run',exact=True).click()
            self.frame(page,'example:'+ex['id'])
            element.get_by_role('button',name='Stop',exact=True).click()
            expect(page.locator('iframe')).to_have_count(0)
            row['inline'].append(ex['id'])

    def save(self):
        result={'base':self.base,'threshold':THRESHOLD,'rows':self.rows,'passed':sum(r['passed'] for r in self.rows),'failed':sum(not r['passed'] for r in self.rows)}
        (self.out/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        lines=['| Kind | ID | Result | Motion | Input diff | Control diff |','|---|---|---|---|---:|---:|']
        for r in self.rows:
            diffs=[str(a['picture_diff']) for a in r['actions']]+['—','—']
            lines.append(f"| {r['kind']} | {r['id']} | {'PASS' if r['passed'] else 'FAIL'} | {r.get('motion','—')} | {diffs[0]} | {diffs[1]} |")
        (self.out/'table.md').write_text('\n'.join(lines)+'\n')

    def sheet(self):
        demos=[r for r in self.rows if r.get('input-before') and r.get('input-after')]
        if not demos:return
        sheet=Image.new('RGB',(1200,math.ceil(len(demos)/3)*250),'#eceff3');draw=ImageDraw.Draw(sheet)
        for i,row in enumerate(demos):
            x,y=(i%3)*400,(i//3)*250
            draw.text((x+5,y+4),row['id']+(' PASS' if row['passed'] else ' FAIL'),fill='black')
            for j,key in enumerate(['input-before','input-after']):
                picture=Image.open(self.out/row[key]);picture.thumbnail((194,215))
                sheet.paste(picture,(x+j*200,y+25))
        sheet.save(self.out/'sheet.jpg',quality=90)
        for i in range(0,sheet.height,1000):sheet.crop((0,i,1200,min(i+1000,sheet.height))).save(self.out/f'sheet-{i//1000+1}.jpg',quality=90)
        selected=random.Random(1502).sample(demos,min(10,len(demos)))
        (self.out/'review-sample.json').write_text(json.dumps([{k:r[k] for k in ['id','input-before','input-after','control-before','control-after'] if k in r} for r in selected],indent=2))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site');parser.add_argument('--only',help='ID substring for diagnosis; default checks all 78')
    args=parser.parse_args()
    out=ROOT/'output/demo-usability'/('site' if args.site else 'local');out.mkdir(parents=True,exist_ok=True)
    with (site(args.site) if args.site else local_site(out)) as base,sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True,args=FLAGS)
        checker=Usability(browser,base,out)
        try:
            ctx=browser.new_context()
            demos=ctx.request.get(base+'data/demos.json').json()['demos']
            pages=ctx.request.get(base+'data/pages.json').json()['pages'];ctx.close()
            assert len(demos)==62 and len(pages)==16,'Changed acceptance denominator'
            assert sum(d['kind']=='example' for d in demos)==18 and sum(d['kind']=='lab' for d in demos)==44
            for d in demos:
                if not args.only or args.only in d['id']:checker.run('demo',d['id'],checker.demo)
            for p in pages:
                if not args.only or args.only in p['slug']:checker.run('game',p['slug'],checker.game)
        finally: checker.sheet();browser.close()
    print(f"{len(checker.rows)} rows; {sum(not r['passed'] for r in checker.rows)} failures; {out/'sheet.jpg'}")
    return int(any(not r['passed'] for r in checker.rows))


if __name__=='__main__':raise SystemExit(main())
