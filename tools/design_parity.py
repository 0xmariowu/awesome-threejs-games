#!/usr/bin/env python3
"""Render the actual owner prototype and production client with identical fixtures.

No support.js or prototype code is copied into production. The prototype serves
its own data. Production requests use those same fixture bytes for this comparison;
real catalogs/manifest/launches are independently covered by test_library_ui.py.
"""
import argparse
from collections import defaultdict
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import re
import threading
from urllib.parse import unquote, urlparse
from PIL import Image, ImageChops
import test_library_ui as harness

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / '.claude/design-handoff/project'
OUT = ROOT / 'output/design-parity'
# Frozen tolerances: computed numeric rounding <= .15px; pixel channel delta >20
# on <= .5% of pixels. Media pixels and boot overlays are outside the comparison.
PIXEL_TOLERANCE = .005
PROPERTIES = '''display position top height width max-width min-width padding-top padding-right padding-bottom padding-left margin-top margin-right margin-bottom margin-left gap row-gap column-gap grid-template-columns background-color color font-family font-size font-weight line-height letter-spacing text-align border-top-width border-top-color border-bottom-width border-bottom-color border-right-width border-right-color border-radius aspect-ratio box-shadow backdrop-filter opacity overflow-x overflow-y flex-direction align-items justify-content text-decoration-line transition-duration transition-timing-function transform animation-name animation-duration animation-timing-function'''.split()
REGIONS = r'''(view) => {
 const out={}; const put=(key,e)=>{if(e){e.dataset.parity=key;out[key]=e;}};
 const header=[...document.querySelectorAll('header')].find(e=>getComputedStyle(e).position==='sticky') || document.querySelector('.topbar');
 put('header',header);put('header-layout',header?.firstElementChild);put('brand',header?.querySelector('a'));put('nav',header?.querySelector('nav'));
 const links=header?.querySelectorAll('nav a');put('nav-projects',links?.[0]);put('nav-demos',links?.[1]);
 const buttons=header?.querySelectorAll('button');put('lang-toggle',buttons?.[0]);put('theme-toggle',buttons?.[1]);
 const main=document.querySelector('main h1')?.closest('main'); const h1=main?.querySelector('h1');put('h1',h1);
 if(view==='home') {
  put('sub',h1?.nextElementSibling);const grid=main?.children[1];put('grid',grid);
  const card=main?.querySelector('article') || document.querySelector('.game-card');put('card',card);
  put('card-image',card?.querySelector('img')?.parentElement);put('card-title',card?.querySelector('h2'));
  put('tagline',card?.querySelector('p'));put('play',card?.querySelector('.play-button') || card?.querySelector('a[target=_blank]'));
  put('learn-more',card?.lastElementChild?.querySelector('a:last-child'));put('footer',document.querySelector('footer'));
 } else if(view==='project') {
  put('sub',h1?.nextElementSibling);const a=h1?.parentElement?.querySelectorAll('div>a');
  put('project-play',a?.[0]);put('project-source',a?.[1]);put('project-github',a?.[2]);
  put('video-box',main?.querySelector('video')?.parentElement);
  const section=main?.querySelector('section');put('examples-card',section?.querySelector('div'));
  put('example-heading',section?.querySelector('h3'));put('example-run',section?.querySelector('button'));put('footer',document.querySelector('footer'));
 } else if(view.startsWith('demos')) {
  const aside=document.querySelector('aside');put('sidebar',aside);put('search',aside?.querySelector('input'));put('group-header',aside?.querySelector('h2'));
  put('selected-demo',aside?.querySelector('[aria-pressed=true]'));put('eyebrow',h1?.previousElementSibling);put('sub',h1?.nextElementSibling);
  const seg=main?.querySelector('[role=tablist]');put('segments',seg);put('preview-tab',seg?.children[0]);put('code-tab',seg?.children[1]);
  put('toolbar',seg?.parentElement?.parentElement);
 } else if(view==='source') {
  put('tree',document.querySelector('[role=tree]'));put('tree-search',document.querySelector('aside input'));
  put('tree-row',document.querySelector('[role=treeitem]'));put('tree-selected',document.querySelector('[role=treeitem][aria-selected=true]'));
 }
 if(view==='source'||view==='demos-code') {
  const copy=[...document.querySelectorAll('button')].find(e=>['Copy','复制'].includes(e.textContent.trim()));
  put('viewer-header',copy?.parentElement);put('viewer',copy?.parentElement?.parentElement);
  const gutter=[...document.querySelectorAll('span')].find(e=>e.style.position==='sticky'&&e.style.cursor==='pointer');
  put('gutter',gutter);
  const tokenEls=[...document.querySelectorAll('span')].filter(e=>e.style.color.startsWith('var(--tok-'));
  for(const e of tokenEls) {const key='token-'+e.style.color.slice(10,-1);if(!out[key])put(key,e);}
 }
 return Object.fromEntries(Object.entries(out).map(([key,e])=>{
  const css=getComputedStyle(e),r=e.getBoundingClientRect();
  return [key,{styles:Object.fromEntries(PROPS.map(p=>[p,css.getPropertyValue(p)])),box:{x:r.x,y:r.y,width:r.width,height:r.height}}];
 }));
}'''.replace('PROPS',json.dumps(PROPERTIES))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def serve():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(DESIGN)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    return server, f'http://127.0.0.1:{server.server_port}/Gameref.dc.html'


def fixtures(context, before=False):
    # Identical page text, ordering, source lists and file contents on both sides.
    demos=json.loads((DESIGN/'data/demos.json').read_text())
    actual=context.request.get(harness.BASE_URL+'/data/demos.json').json()
    launches={d['id']:d.get('launch') for d in actual['demos']}
    for demo in demos['demos']:
        demo['launch']=launches.get(demo['id'])
    def data(route):
        relative=unquote(urlparse(route.request.url).path.lstrip('/'))
        file=DESIGN/relative
        if relative=='data/demos.json':
            route.fulfill(json=demos)
        elif file.is_file():
            route.fulfill(path=str(file))
        else:
            route.continue_()
    context.route(harness.BASE_URL+'/data/**',data)
    context.route(harness.BASE_URL+'/previews/**',lambda r:r.fulfill(path=str(DESIGN/'assets/previews'/Path(urlparse(r.request.url).path).name)))
    if before:
        old=OUT/'before-library'
        def asset(route):
            name=Path(urlparse(route.request.url).path).name
            f=old/name
            if f.is_file():route.fulfill(path=str(f))
            else:route.continue_()
        context.route(harness.BASE_URL+'/*.js',asset)
        context.route(harness.BASE_URL+'/style.css',asset)
        def html(route):
            if route.request.resource_type=='document':route.fulfill(path=str(old/'index.html'))
            else:route.continue_()
        context.route(re.compile(re.escape(harness.BASE_URL)+r'/(?:\?.*|p/.*|demos.*|source/.*)?$'),html)
    # Videos have non-deterministic decoding/network state, and are masked below.
    context.route('**/*.mp4',lambda r:r.fulfill(status=204,body=''))


def settle(page,view,lang,before=False):
    page.wait_for_selector('.game-card' if before and view=='home' else 'main h1',timeout=30000)
    if view=='demos-code':
        tab=page.get_by_role('tab',name='Code' if lang=='en' else '代码',exact=True)
        if tab.count():
            tab.click()
            page.wait_for_function("() => [...document.querySelectorAll('span')].some(e=>e.style.cursor==='pointer'&&e.style.position==='sticky')",timeout=20000)
    if view=='source' and not before:
        page.wait_for_function("() => [...document.querySelectorAll('span')].some(e=>e.style.cursor==='pointer'&&e.style.position==='sticky')",timeout=20000)
    page.wait_for_timeout(650)
    # Finish design page-entry motion; no production CSS is injected into the oracle.
    page.evaluate("document.getAnimations().filter(a=>a.effect?.target?.tagName==='MAIN').forEach(a=>a.finish())")
    page.mouse.move(0,0)


def different(a,b):
    if a==b:return False
    if re.fullmatch(r'-?[\d.]+px',a or '') and re.fullmatch(r'-?[\d.]+px',b or ''):
        return abs(float(a[:-2])-float(b[:-2]))>.15
    return True


def style_diff(design,ours,width,lang):
    rows=[]
    for region,d in design.items():
        o=ours.get(region)
        if o is None:
            rows.append({'region':region,'property':'element','design':'present','ours':'missing'})
            continue
        for prop,a in d['styles'].items():
            b=o['styles'][prop]
            # Content-sized boxes vary for real URLs. Only compare token colors,
            # type metrics, not the lexical length of a representative token.
            if region.startswith('token-') and prop in ['width','height']:continue
            if different(a,b):
                constrained=width==390 and lang=='en' and region in ['header-layout','nav'] and prop in ['gap','column-gap','row-gap','width']
                rows.append({'region':region,'property':prop,'design':a,'ours':b,'constraint':constrained})
    return rows


def pixels(page,region):
    locator=page.locator('[data-parity="'+region+'"]')
    if not locator.count():return None
    return Image.open(io.BytesIO(locator.screenshot(animations='disabled',mask=[page.locator('img,video,iframe')],mask_color='#808080',timeout=15000))).convert('RGB')


def pixel_diff(a,b):
    if a is None or b is None:return {'error':'missing region','pass':False}
    if a.size!=b.size:return {'design_size':a.size,'ours_size':b.size,'pass':False}
    diff=ImageChops.difference(a,b)
    changed=sum(max(px)>20 for px in diff.getdata())
    ratio=changed/(a.width*a.height)
    return {'pixels':a.width*a.height,'changed':changed,'ratio':round(ratio,6),'pass':ratio<=PIXEL_TOLERANCE}


def run(before=False):
    if not (DESIGN/'Gameref.dc.html').is_file():
        print('SKIP design parity: local-only handoff is absent (.claude/design-handoff/project/Gameref.dc.html).')
        return True
    OUT.mkdir(parents=True,exist_ok=True)
    harness.setUpModule();server,design_url=serve()
    results=[]
    routes=[('home','/'),('project','/p/cloudkeep'),('demos-preview','/demos/example:tidewater-fishing'),('demos-code','/demos/example:tidewater-fishing'),('source','/source/cloudkeep')]
    try:
        for width in ([1440] if before else [1440,390]):
            for theme in (['light'] if before else ['light','dark']):
                for lang in (['en'] if before else ['zh','en']):
                    contexts=[];pages=[]
                    for design in [True,False]:
                        ctx=harness.BROWSER.new_context(viewport={'width':width,'height':1000},locale='zh-CN' if lang=='zh' else 'en-US',color_scheme=theme)
                        ctx.add_init_script(f"localStorage.setItem('gameref-lang','{lang}');localStorage.setItem('gameref-theme','{theme}');")
                        if not design:fixtures(ctx,before)
                        else:ctx.route('**/*.mp4',lambda r:r.fulfill(status=204,body=''))
                        contexts.append(ctx);pages.append(ctx.new_page())
                    try:
                        for view,route in routes:
                            name=f'{view}-{width}-{theme}-{lang}';captured=[];metrics=[];errors=[]
                            for i,page in enumerate(pages):
                                url=design_url+f'?lang={lang}#'+route if i==0 else harness.BASE_URL+route+'?lang='+lang
                                if before and i==1 and route.startswith('/demos/'):
                                    url=harness.BASE_URL+'/demos?lang='+lang+'#example:tidewater-fishing'
                                page.goto(url,wait_until='domcontentloaded')
                                try:settle(page,view,lang,before and i==1)
                                except Exception as exc:
                                    if not before:raise
                                    errors.append(str(exc)[:180])
                                metrics.append(page.evaluate(REGIONS,view))
                                shot=OUT/(('before-' if before else '')+name+('-design.png' if i==0 else '-ours.png'))
                                page.screenshot(path=str(shot),animations='disabled',timeout=15000)
                                captured.append(Image.open(shot).convert('RGB'))
                            canvas=Image.new('RGB',(width*2,1000));canvas.paste(captured[0],(0,0));canvas.paste(captured[1],(width,0))
                            canvas.save(OUT/(('before-' if before else '')+name+'-side-by-side.png'))
                            diffs=style_diff(*metrics,width,lang)
                            pixel={}
                            for region in ['header']+(['card'] if view=='home' else ['toolbar'] if view.startswith('demos') else []):
                                pixel[region]=pixel_diff(pixels(pages[0],region),pixels(pages[1],region))
                                if width==390 and lang=='en' and region=='header':pixel[region]['constraint']='Prototype header overflows to 409px; production tightens gaps to meet no-overflow contract.'
                            # Entire first row: image pixels are masked, layout/text remain.
                            if view=='home':
                                row_images=[]
                                for page,metric in zip(pages,metrics):
                                    card=metric.get('card',{}).get('box');grid=metric.get('grid',{}).get('box')
                                    if card and grid:
                                        clip={'x':grid['x'],'y':grid['y'],'width':grid['width'],'height':card['height']}
                                        row_images.append(Image.open(io.BytesIO(page.screenshot(clip=clip,mask=[page.locator('img')],mask_color='#808080',animations='disabled'))).convert('RGB'))
                                    else:row_images.append(None)
                                pixel['home-first-row']=pixel_diff(*row_images)
                            if not before:
                                states = [('play','hover'),('card-image','hover')] if view=='home' else [('project-play','hover'),('project-source','hover')] if view=='project' else [('search','focus')] if view.startswith('demos') and width==1440 else [('tree-search','focus')] if view=='source' else []
                                for region, action in states:
                                    state_values=[]
                                    for page in pages:
                                        loc=page.locator('[data-parity="'+region+'"]')
                                        if region=='card-image': loc=loc.locator('img')
                                        getattr(loc,action)()
                                        page.wait_for_timeout(650 if action=='hover' else 50)
                                        state_values.append(loc.evaluate('(e,ps)=>Object.fromEntries(ps.map(p=>[p,getComputedStyle(e).getPropertyValue(p)]))',PROPERTIES))
                                        page.mouse.move(0,0)
                                        loc.evaluate('e=>e.blur()')
                                    for prop,a in state_values[0].items():
                                        b=state_values[1][prop]
                                        if different(a,b):diffs.append({'region':region+':'+action,'property':prop,'design':a,'ours':b})
                            bad=[d for d in diffs if not d.get('constraint')]
                            passed=not bad and all(p.get('pass') or p.get('constraint') for p in pixel.values())
                            results.append({'case':name,'styles':diffs,'pixels':pixel,'pass':passed,'errors':errors,'regions':list(metrics[0])})
                            print(f'{"PASS" if passed else "FAIL"} {name}: {len(bad)} style mismatches; pixels {json.dumps(pixel)}',flush=True)
                    finally:
                        for ctx in contexts:ctx.close()
    finally:
        server.shutdown();server.server_close();harness.tearDownModule()
    report={'mode':'before' if before else 'after','computed_numeric_tolerance_px':.15,'pixel_tolerance':PIXEL_TOLERANCE,
            'fixture':'Owner prototype data, same on both sides. Production real-data coverage is test_library_ui.py.',
            'constraints':['390px header spacing: prototype overflow 409px versus required 390px. Type, colors, control sizes unchanged.'],
            'cases':results,'pass':all(r['pass'] for r in results)}
    (OUT/('before.json' if before else 'report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    totals=defaultdict(lambda:{'checks':0,'mismatches':0,'constraints':0})
    for row in results:
        for region in row['regions']:totals[region]['checks']+=1
        for d in row['styles']:totals[d['region']]['constraints' if d.get('constraint') else 'mismatches']+=1
    (OUT/('before-regions.json' if before else 'regions.json')).write_text(json.dumps(totals,indent=2)+'\n')
    return report['pass']


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--before',action='store_true');args=parser.parse_args()
    passed=run(args.before)
    raise SystemExit(0 if passed or args.before else 1)
