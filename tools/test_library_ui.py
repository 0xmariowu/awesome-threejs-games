#!/usr/bin/env python3
"""Real Chrome acceptance of the owner design, live data and launch boundary."""
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.request import urlopen
from urllib.parse import urlparse, parse_qs, unquote, quote
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SERVER = SERVER_LOG = PLAYWRIGHT = BROWSER = BASE_URL = None
OUT = ROOT / 'output/library-ui'


def setUpModule():
    global SERVER, SERVER_LOG, PLAYWRIGHT, BROWSER, BASE_URL
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    BASE_URL = f'http://127.0.0.1:{port}'
    SERVER_LOG = tempfile.TemporaryFile(mode='w+')
    SERVER = subprocess.Popen(['node', 'tools/library.mjs'], cwd=ROOT,
                              env={**os.environ, 'LIBRARY_PORT': str(port)}, stdout=SERVER_LOG, stderr=subprocess.STDOUT)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try:
            with urlopen(BASE_URL + '/api/index', timeout=1):
                break
        except (OSError, TimeoutError):
            if SERVER.poll() is not None:
                SERVER_LOG.seek(0)
                raise RuntimeError(SERVER_LOG.read())
            time.sleep(.1)
    else:
        raise RuntimeError('Library startup timed out')
    PLAYWRIGHT = sync_playwright().start()
    BROWSER = PLAYWRIGHT.chromium.launch(channel='chrome', headless=True, args=['--use-angle=metal','--enable-unsafe-webgpu','--ignore-gpu-blocklist'])
    OUT.mkdir(parents=True, exist_ok=True)


def tearDownModule():
    if BROWSER:
        BROWSER.close()
    if PLAYWRIGHT:
        PLAYWRIGHT.stop()
    if SERVER:
        SERVER.terminate()
        try:
            SERVER.wait(timeout=5)
        except subprocess.TimeoutExpired:
            SERVER.kill()
    if SERVER_LOG:
        SERVER_LOG.close()


class LibraryUITestCase(unittest.TestCase):
    def setUp(self):
        self.context = BROWSER.new_context(viewport={'width':1440, 'height':1000}, locale='zh-CN',
                                          permissions=['clipboard-read', 'clipboard-write'])
        self.context.add_init_script('if(window!==window.top)Object.defineProperty(navigator,"webdriver",{get:()=>false,configurable:true})')
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.addCleanup(lambda: self.assertEqual(self.errors, []))

    def goto(self, route='/'):
        self.page.goto(BASE_URL + route, wait_until='domcontentloaded')
        expect(self.page.locator('main h1')).to_be_visible(timeout=20000)

    def tab(self, name):
        return self.page.get_by_role('tab', name=name, exact=True)

    def test_home_navigation_and_card_alignment(self):
        self.goto()
        pages = self.context.request.get(BASE_URL+'/data/pages.json').json()['pages']
        self.assertEqual(len(pages),len(json.loads((ROOT/'catalog/games.json').read_text())['games']))
        expect(self.page.locator('.game-card')).to_have_count(len(json.loads((ROOT/'catalog/games.json').read_text())['games']))
        expect(self.page.locator('.topbar nav a')).to_have_text(['游戏','工具','技术演示'])
        expect(self.page.locator('.home h1')).to_have_text('可以直接玩的 Three.js 游戏。')
        self.assertEqual(self.page.locator('.game-card').evaluate_all('ns => ns.map(n=>n.dataset.slug)'), [p['slug'] for p in pages])
        positions = self.page.locator('.game-card .play-button').evaluate_all('ns=>ns.slice(0,3).map(n=>n.getBoundingClientRect().top)')
        self.assertLess(max(positions)-min(positions), .1)
        self.assertTrue(self.page.locator('.game-card img').first.get_attribute('src').startswith('/previews/'))
        self.page.locator('.game-card[data-slug=cloudkeep] h2 a').click()
        expect(self.page.locator('h1')).to_have_text('Cloudkeep')
        expect(self.page).to_have_url(BASE_URL+'/p/cloudkeep')
        self.page.locator('.topbar nav a').nth(2).click()
        expect(self.page).to_have_url(BASE_URL+'/demos')
        expect(self.page.locator('.demo-item[aria-pressed=true]')).to_have_attribute('data-id','example:tidewater-fishing')
        self.page.locator('.brand').click()
        expect(self.page.locator('.home')).to_be_visible()
        self.page.go_back()
        expect(self.page.locator('.demos')).to_be_visible()

    def test_language_auto_override_toggle_and_persistence(self):
        self.goto('/?lang=en')
        expect(self.page.locator('html')).to_have_attribute('lang','en')
        self.page.get_by_role('button',name='切换到中文').click()
        expect(self.page.locator('html')).to_have_attribute('lang','zh-CN')
        self.assertEqual(self.page.evaluate('localStorage.getItem("gameref-lang")'),'zh')
        self.goto('/')
        expect(self.page.locator('html')).to_have_attribute('lang','zh-CN')
        self.page.evaluate('localStorage.clear()')
        self.goto('/?lang=invalid')
        expect(self.page.locator('html')).to_have_attribute('lang','zh-CN')
        ctx=BROWSER.new_context(locale='fr-FR')
        try:
            pg=ctx.new_page();pg.goto(BASE_URL,wait_until='domcontentloaded')
            expect(pg.locator('html')).to_have_attribute('lang','en')
        finally:
            ctx.close()

    def test_theme_cycle_and_system(self):
        self.page.emulate_media(color_scheme='dark')
        self.goto('/?lang=en')
        expect(self.page.locator('html')).to_have_attribute('data-theme','dark')
        for label, theme in [('◐ Auto','light'),('○ Light','dark'),('● Dark','dark')]:
            self.page.get_by_role('button',name=label,exact=True).click()
            expect(self.page.locator('html')).to_have_attribute('data-theme',theme)
        self.page.emulate_media(color_scheme='light')
        expect(self.page.locator('html')).to_have_attribute('data-theme','light')
        self.page.get_by_role('button',name='◐ Auto',exact=True).click()
        self.page.reload(wait_until='domcontentloaded')
        expect(self.page.get_by_role('button',name='○ Light',exact=True)).to_be_visible()

    def test_project_video_run_stop_and_real_launch(self):
        self.goto('/p/cloudkeep?lang=en')
        video=self.page.locator('video')
        expect(video).to_have_attribute('loop','')
        self.assertTrue(video.evaluate('v=>v.muted && v.defaultMuted'))
        self.page.wait_for_function('() => { const v=document.querySelector("video"); return v.readyState >= 2 && !v.paused && v.currentTime > .1; }',timeout=15000)
        self.assertIn('/previews/cloudkeep.webp', video.get_attribute('poster'))
        expect(self.page.get_by_role('link',name='Browse source',exact=True)).to_have_attribute('href','/source/cloudkeep')
        rows=self.page.locator('.example-row')
        rows.first.get_by_role('button',name='Run',exact=True).click()
        frame=self.page.locator('iframe')
        expect(frame).to_have_count(1)
        expect(frame).to_have_attribute('src',re.compile(r'http://127\.0\.0\.1:\d+/.*lang=en&theme=light&r=0'))
        rows.nth(1).get_by_role('button',name='Run',exact=True).click()
        expect(frame).to_have_count(1)
        expect(rows.first.get_by_role('button',name='Run',exact=True)).to_be_visible()
        rows.nth(1).get_by_role('button',name='Stop',exact=True).click()
        expect(frame).to_have_count(0)
        with self.page.expect_popup() as pending:
            self.page.get_by_role('link',name='Play game',exact=True).click()
        popup=pending.value
        expect(popup).to_have_url(re.compile(r'http://127\.0\.0\.1:\d+/'))
        popup.close()

    def test_demos_search_select_previous_next_and_toolbar(self):
        self.goto('/demos?lang=en')
        expect(self.page.locator('.demo-sidebar')).to_be_visible()
        self.assertEqual(self.page.locator('.demo-item').count(),len(self.context.request.get(BASE_URL+'/data/demos.json').json()['demos']))
        search=self.page.get_by_role('searchbox')
        search.fill('NO SUCH DEMO 19499')
        expect(self.page.get_by_text('No matching demos',exact=True)).to_be_visible()
        search.fill('flight')
        expect(self.page.locator('.demo-item')).to_have_count(1)
        self.page.locator('.demo-item').click()
        expect(self.page).to_have_url(re.compile('demos/example%3Acloudkeep-flight'))
        search.fill('')
        old=self.page.url
        self.page.get_by_role('button',name=re.compile('^Next')).click()
        self.assertNotEqual(self.page.url,old)
        self.page.get_by_role('button',name=re.compile('^Previous')).click()
        expect(self.page).to_have_url(old)
        self.page.get_by_role('button',name='Hide list',exact=True).click()
        expect(self.page.locator('.demo-sidebar')).to_be_hidden()
        self.page.get_by_role('button',name='Demo list',exact=True).click()
        expect(self.page.locator('.demo-sidebar')).to_be_visible()
        self.page.get_by_role('button',name='Reload',exact=True).click()
        expect(self.page.locator('iframe')).to_have_attribute('src',re.compile('r=1$'))
        expect(self.page.get_by_role('link',name='Open in new window ↗')).to_have_attribute('href',re.compile('lang=en&theme=light&r=1$'))
        self.page.locator('iframe').evaluate('f => f.requestFullscreen = () => { f.dataset.requested="yes"; return Promise.resolve(); }')
        self.page.get_by_role('button',name='Full screen',exact=True).click()
        expect(self.page.locator('iframe')).to_have_attribute('data-requested','yes')

    def test_code_copy_mark_and_line_cap(self):
        self.goto('/demos/example:tidewater-fishing?lang=en')
        self.tab('Code').click()
        expect(self.page.locator('.code-line')).not_to_have_count(0,timeout=20000)
        self.assertLessEqual(self.page.locator('.code-line').count(),500)
        self.assertLessEqual(self.page.locator('[role=tablist]').nth(1).get_by_role('tab').count(),10)
        self.page.locator('.code-gutter').nth(2).click()
        color=self.page.locator('.code-line').nth(2).evaluate('n=>getComputedStyle(n).backgroundColor')
        self.assertNotEqual(color,'rgba(0, 0, 0, 0)')
        self.page.get_by_role('button',name='Copy',exact=True).click()
        expect(self.page.get_by_role('status')).to_have_text('Copied to clipboard')
        self.assertGreater(len(self.page.evaluate('navigator.clipboard.readText()')),20)
        self.assertGreater(self.page.locator('.code-token').count(),20)
        show=self.page.get_by_role('button',name=re.compile('^Show all'))
        if show.count():
            show.click();self.assertGreater(self.page.locator('.code-line').count(),500)
        self.tab('Preview').click()
        expect(self.page.locator('iframe')).to_have_count(1)

    def test_long_file_cap_and_empty_project(self):
        body='\n'.join('const line%d = %d;' % (i,i) for i in range(620))
        self.context.route('**/data/src/cloudkeep/README.md',lambda r:r.fulfill(body=body,content_type='text/plain'))
        self.goto('/source/cloudkeep?lang=en')
        expect(self.page.locator('.code-line')).to_have_count(500)
        self.page.get_by_role('button',name='Show all 620 lines',exact=True).click()
        expect(self.page.locator('.code-line')).to_have_count(620)
        self.goto('/p/hanakawa?lang=en')
        expect(self.page.get_by_text('This project has no standalone examples yet.',exact=True)).to_be_visible()
        expect(self.page.locator('footer')).to_be_visible()

    def test_source_tree_breadcrumb_filter_and_default_readme(self):
        self.goto('/source/cloudkeep?lang=en')
        expect(self.page.locator('.viewer-header')).to_contain_text('README.md')
        expect(self.page.locator('.code-line')).not_to_have_count(0)
        expect(self.page.locator('[role=treeitem][aria-selected=true]')).to_contain_text('README.md')
        self.assertRegex(self.page.locator('[role=treeitem][aria-selected=true]').inner_text(),r'KB|B')
        self.page.get_by_role('searchbox').fill('TECHNICAL')
        expect(self.page.get_by_role('treeitem')).to_have_count(1)
        self.page.get_by_role('treeitem').click()
        expect(self.page).to_have_url(BASE_URL+'/source/cloudkeep/TECHNICAL.md')
        expect(self.page.locator('.viewer-header')).to_contain_text('TECHNICAL.md')
        self.page.get_by_role('searchbox').fill('')
        public=self.page.get_by_role('treeitem').filter(has_text=re.compile('^▶public$'))
        public.click()
        expect(public).to_have_count(0)
        self.assertGreater(self.page.get_by_role('treeitem').count(),8)
        self.assertEqual(self.page.locator('footer').count(),0)
        self.page.locator('main>a').click()
        expect(self.page.locator('h1')).to_have_text('Cloudkeep')

    def test_deep_links_and_launch_urls(self):
        for route, expected in [('/#/p/cloudkeep','/p/cloudkeep'),('/demos#example:tidewater-fishing','/demos/example%3Atidewater-fishing'),
                                ('/#/source/cloudkeep/README.md','/source/cloudkeep/README.md'),('/demos?cat=water','/demos/')]:
            self.goto(route)
            self.assertIn(expected,self.page.url)
            self.assertNotIn('#',self.page.url)
            self.assertNotIn('cat=',self.page.url)
        self.goto('/demos/demo:cloudkeep-cam')
        frame=self.page.locator('iframe')
        expect(frame).to_have_attribute('src',re.compile(r'127\.0\.0\.1:5199/.*scene=cloudkeep-cam'))
        url=frame.get_attribute('src')
        for param in ['backend=','embed=1','menu=0','clean=1','lang=','theme=','r=']:
            self.assertIn(param,url)

    def test_only_current_frame_can_report_height(self):
        self.goto('/demos/example:tidewater-fishing')
        frame=self.page.locator('iframe')
        expect(frame).to_have_attribute('src',re.compile('^http'))
        self.page.wait_for_timeout(1000)
        # Isolate the message protocol from the host's own later resize reports.
        frame.evaluate('f=>f.srcdoc="<!doctype html><body>Height protocol fixture</body>"')
        self.page.wait_for_timeout(200)
        before=frame.evaluate('f=>f.style.height')
        self.page.evaluate("postMessage({type:'gameref:frame-height',height:1399},'*')")
        self.page.wait_for_timeout(100)
        self.assertEqual(frame.evaluate('f=>f.style.height'),before)
        child=frame.element_handle().content_frame()
        child.evaluate("parent.postMessage({type:'gameref:frame-height',height:1399},'*')")
        self.page.wait_for_timeout(100)
        self.assertEqual(frame.evaluate('f=>f.style.height'),before,'Current frame with wrong origin must be ignored')
        # srcdoc shares the library origin; preserve the original frame URL check.
        frame.evaluate('f=>f.src=location.origin+"/"')
        self.page.wait_for_timeout(100)
        self.page.evaluate("postMessage({type:'gameref:frame-height',height:1399},'*')")
        self.page.wait_for_timeout(100)
        self.assertEqual(frame.evaluate('f=>f.style.height'),before,'Matching origin with wrong window must be ignored')
        child=frame.element_handle().content_frame()
        child.evaluate("parent.postMessage({type:'gameref:frame-height',height:777},'*')")
        expect(frame).to_have_css('height','777px')
        child.evaluate("parent.postMessage({type:'gameref:frame-height',height:99999},'*')")
        expect(frame).to_have_css('height','4000px')
        child.evaluate("parent.postMessage({type:'gameref:frame-height',height:-500},'*')")
        expect(frame).to_have_css('height','240px')
        child.evaluate("parent.postMessage({type:'gameref:frame-height',height:99999},'*')")
        expect(frame).to_have_css('height','4000px')
        child.evaluate("parent.postMessage({type:'gameref:frame-height',height:12.5},'*')")
        expect(frame).to_have_css('height','4000px')

    def test_no_horizontal_overflow(self):
        for width in [390,768,1024,1280,1440,1920]:
            self.page.set_viewport_size({'width':width,'height':1000})
            for lang in ['zh','en']:
                for route in ['/','/p/cloudkeep','/tools','/t/fab-botanic','/demos/example:tidewater-fishing','/source/cloudkeep']:
                    with self.subTest(width=width,lang=lang,route=route):
                        self.goto(route+'?lang='+lang)
                        self.page.wait_for_timeout(150)
                        if route.startswith('/demos'):
                            self.tab('Code' if lang=='en' else '代码').click()
                            expect(self.page.locator('.code-line')).not_to_have_count(0)
                        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                        for nav in self.page.locator('header.topbar').first.locator('a,button').all():
                            self.assertTrue(nav.is_visible(),nav.inner_text())
                            box=nav.bounding_box()
                            self.assertGreaterEqual(box['x'],0,nav.inner_text())
                            self.assertLessEqual(box['x']+box['width'],width+.5,nav.inner_text())
                            self.assertLessEqual(box['y']+box['height'],48.5,nav.inner_text())
                self.page.screenshot(path=str(OUT/f'source-{width}-{lang}.png'))

    def test_all_home_targets_badges_and_project_data(self):
        self.goto('/?lang=en')
        pages=self.context.request.get(BASE_URL+'/data/pages.json').json()['pages']
        for summary in pages:
            with self.subTest(slug=summary['slug']):
                detail=self.context.request.get(BASE_URL+'/data/page/'+summary['slug']+'.json').json()
                card=self.page.locator('.game-card[data-slug="'+summary['slug']+'"]')
                expect(card.locator('.play-button')).to_have_attribute('href',detail['project']['launch']['url'])
                expect(card.get_by_role('link',name='Learn more ›')).to_have_attribute('href','/p/'+summary['slug'])
                expect(card.locator('h2 a')).to_have_attribute('href','/p/'+summary['slug'])
                self.assertEqual(card.locator('a').first.locator('span[title]').count(),
                                 int(summary['runnability']['reviewed_verdict']!='能玩'))
                badge=card.locator('a').first.locator('span[title]')
                if badge.count():self.assertEqual(badge.get_attribute('title'),summary['runnability']['review_note_en'])
                self.assertEqual(detail['slug'],summary['slug'])
                self.assertEqual(len(detail['examples']),summary['examples'])

    def test_every_demo_launch_contract_and_source_paths(self):
        tracked=set(subprocess.check_output(['git','ls-tree','-r','--name-only','HEAD'],cwd=ROOT,text=True).splitlines())
        def source_exists(url):
            path=unquote(re.sub(r'^https://github.com/0xmariowu/awesome-threejs-games/(?:tree|blob)/main/','',url))
            self.assertNotEqual(path,url,'Unexpected source URL')
            self.assertTrue(path in tracked or any(p.startswith(path+'/') for p in tracked),path)
        catalog=self.context.request.get(BASE_URL+'/data/demos.json').json()
        demos=catalog['demos']
        examples={e['id']:e for e in json.loads((ROOT/'catalog/examples.json').read_text())['examples']}
        page_examples = sum(len(json.loads(file.read_text())['examples']) for file in (ROOT/'catalog/pages').glob('*.json'))
        tool_examples = sum(len(tool['examples']) for tool in json.loads((ROOT/'catalog/tools.json').read_text())['tools'])
        self.assertEqual(sum(d['kind']=='example' for d in demos),page_examples+tool_examples)
        self.assertEqual(sum(d['kind']=='lab' for d in demos),44)
        for demo in demos:
            with self.subTest(demo=demo['id']):
                source_exists(demo['source_url'])
                self.goto('/demos?lang=en#'+demo['id'])
                self.assertEqual(urlparse(self.page.url).path,'/demos/'+quote(demo['id'],safe=''))
                self.assertEqual(urlparse(self.page.url).fragment,'')
                frame=self.page.locator('iframe')
                expect(frame).to_have_count(1)
                expect(frame).to_have_attribute('src',re.compile('^http'))
                url=urlparse(frame.get_attribute('src'));query=parse_qs(url.query)
                self.assertEqual(query['lang'],['en']);self.assertEqual(query['theme'],['light']);self.assertEqual(query['r'],['0'])
                expect(self.page.locator('.demo-source')).to_have_attribute('href',demo['source_url'])
                if demo['kind']=='example':
                    ex=examples[demo['id'].split(':')[1]]
                    folder=ex.get('folder',ex['id'])
                    config=json.loads((ROOT/'examples'/folder/'local.json').read_text())
                    self.assertEqual(url.port,ex['port'])
                    expected=ex.get('entry') if ex.get('entry') not in (None,'/') else config.get('entry','/index.html')
                    self.assertEqual('/index.html' if url.path=='/' else url.path, '/index.html' if expected=='/' else expected)
                else:
                    launch=parse_qs(urlparse(demo['launch']['url']).query)
                    for key in ['scene','backend','embed','menu','clean']:
                        self.assertEqual(query[key],launch[key])
                    self.assertEqual(query['embed'],['1']);self.assertEqual(query['menu'],['0']);self.assertEqual(query['clean'],['1'])
        for category in catalog['categories']:
            self.goto('/demos?lang=en&cat='+category['key'])
            expected=next(d['id'] for d in demos if d['category']==category['key'])
            expect(self.page.locator('.demo-item[aria-pressed=true]')).to_have_attribute('data-id',expected)
            self.assertNotIn('cat=',self.page.url)
        for game in json.loads((ROOT/'catalog/games.json').read_text())['games']:
            self.goto('/p/'+game['slug']+'?lang=en')
            source_exists(self.page.locator('.project-actions a[href^="https://github.com/"]').get_attribute('href'))
            expect(self.page.get_by_role('link',name='Browse source',exact=True)).to_have_attribute('href','/source/'+game['slug'])

    def test_manifest_source_tree_reaches_every_cloudkeep_file(self):
        manifest=self.context.request.get(BASE_URL+'/data/src/manifest.json').json()
        wanted={f['path'] for f in manifest if f['path'].startswith('cloudkeep/')}
        self.assertGreater(len(wanted),10)
        self.goto('/source/cloudkeep?lang=en')
        opened=set()
        for _ in range(200):
            directories=self.page.get_by_role('treeitem').filter(has_text=re.compile('^▶'))
            if not directories.count():break
            node=directories.first;path=node.get_attribute('title')
            self.assertNotIn(path,opened);opened.add(path);node.click()
            self.page.wait_for_timeout(30)
        listed=set(self.page.get_by_role('treeitem').evaluate_all('ns=>ns.map(n=>n.title)'))
        self.assertEqual(wanted-listed,set(),'Manifest files missing from source browser')
        self.assertTrue(any('/public/' in name for name in listed))

    def test_chrome_language_in_all_views(self):
        names=[p['title'] for p in self.context.request.get(BASE_URL+'/data/pages.json').json()['pages']]
        for lang in ['en','zh']:
            for route in ['/','/p/cloudkeep','/demos/example:tidewater-fishing','/source/cloudkeep']:
                self.goto(route+'?lang='+lang)
                # Source code, names and the language switch are intentional exceptions.
                text=self.page.locator('body').evaluate("""body=>{
                    const copy=body.cloneNode(true);
                    for(const n of copy.querySelectorAll('script,.code-line,[role=tree],.viewer-header > span:first-child,button[title="切换到中文"]'))n.remove();
                    return copy.textContent+' '+[...copy.querySelectorAll('[title],[aria-label],[placeholder]')]
                        .flatMap(n=>['title','aria-label','placeholder'].map(a=>n.getAttribute(a)||'')).join(' ');
                }""")
                for name in names:text=text.replace(name,'')
                if lang=='en':self.assertIsNone(re.search(r'[\u3400-\u9fff]',text),text[:1500])
                else:self.assertRegex(text,r'[\u3400-\u9fff]')
                expect(self.page.locator('.topbar nav a')).to_have_text(['Games','Tools','Demos'] if lang=='en' else ['游戏','工具','技术演示'])

    def test_tools_nav_detail_links_themes_languages_and_screenshots(self):
        shots = Path('/private/tmp/claude-501/-Users-vimala/5258cabc-626a-402d-b921-71f034ba10e0/scratchpad/shots')
        shots.mkdir(parents=True, exist_ok=True)
        tool = json.loads((ROOT/'catalog/tools.json').read_text())['tools'][0]
        for width in [1440,390]:
            self.page.set_viewport_size({'width':width,'height':1000})
            for theme in ['light','dark']:
                self.context.add_init_script('localStorage.setItem("gameref-theme",'+json.dumps(theme)+')')
                for lang in ['zh','en']:
                    for route in ['/tools','/t/fab-botanic']:
                        with self.subTest(width=width,theme=theme,lang=lang,route=route):
                            self.goto(route+'?lang='+lang)
                            expect(self.page.locator('html')).to_have_attribute('data-theme',theme)
                            nav=self.page.locator('header.topbar nav a')
                            expect(nav).to_have_text(['游戏','工具','技术演示'] if lang=='zh' else ['Games','Tools','Demos'])
                            expect(nav.nth(1)).to_have_attribute('aria-current','page')
                            self.assertEqual(self.page.locator('header.topbar nav [aria-current=page]').count(),1)
                            expect(nav.nth(1)).to_have_css('color',self.page.locator('body').evaluate('n=>getComputedStyle(n).color'))
                            for link in self.page.get_by_role('link',name='打开工具 ↗' if lang=='zh' else 'Open tool ↗',exact=True).all():
                                expect(link).to_have_attribute('href',tool['url'])
                                expect(link).to_have_attribute('target','_blank')
                                expect(link).to_have_attribute('rel','noopener')
                            expect(self.page.get_by_role('link',name='浏览源码' if lang=='zh' else 'Browse source',exact=True)).to_have_count(0)
                            video=self.page.locator('main video')
                            expect(video).to_have_count(1)
                            expect(video).to_have_attribute('loop','')
                            expect(video).to_have_attribute('poster','/previews/fab-botanic.webp')
                            self.page.wait_for_function('()=>{const v=document.querySelector("main video");return v.readyState>=2 && !v.paused && v.currentTime>.1}',timeout=15000)
                            self.assertTrue(video.evaluate('v=>v.muted && v.defaultMuted'))
                            if route=='/tools':
                                expect(self.page.locator('h1')).to_have_text('好用的游戏制作工具。' if lang=='zh' else 'Tools for making web games.')
                                expect(self.page.locator('.tool-card')).to_have_count(1)
                                expect(self.page.locator('.tool-facts')).to_have_text(' · '.join(f[lang] for f in tool['facts']))
                                expect(self.page.get_by_role('link',name=('了解更多' if lang=='zh' else 'Learn more')+' ›')).to_have_attribute('href','/t/fab-botanic')
                                media=self.page.locator('.tool-media').bounding_box();body=self.page.locator('.tool-card-body').bounding_box()
                                self.assertTrue(body['x']>media['x']+media['width'] if width==1440 else body['y']>=media['y']+media['height'])
                            else:
                                expect(self.page.locator('h1')).to_have_text('FABOTANIC')
                                expect(self.page.locator('.tool-feature')).to_have_count(4)
                                expect(self.page.locator('.tool-step-grid li')).to_have_count(3)
                                for heading in (['能做什么','怎么用在游戏里','能不能用'] if lang=='zh' else ['What it can do','Use it in your game','Usage rights']):
                                    expect(self.page.get_by_role('heading',name=heading,exact=True)).to_be_visible()
                                expect(self.page.locator('.tool-usage')).to_contain_text('✓ '+tool['can'][0][lang])
                                expect(self.page.locator('.tool-usage')).to_contain_text('✗ '+tool['cannot'][0][lang])
                                for link in self.page.get_by_role('link',name='使用条款 ↗' if lang=='zh' else 'Terms ↗',exact=True).all():
                                    expect(link).to_have_attribute('href',tool['terms_url'])
                                    expect(link).to_have_attribute('target','_blank')
                                    expect(link).to_have_attribute('rel','noopener')
                                expect(self.page.get_by_role('link',name=tool['author'],exact=True)).to_have_attribute('href',tool['author_url'])
                                expect(self.page.get_by_role('link',name='‹ 全部工具' if lang=='zh' else '‹ All tools')).to_have_attribute('href','/tools')
                                expect(self.page.locator('footer')).to_contain_text('工具版权归原作者所有，本站只做介绍和链接。' if lang=='zh' else 'Tools belong to their authors; this site only describes and links to them.')
                                expect(self.page.locator('.example-row')).to_have_count(len(tool['examples']))
                                if not tool['examples']:
                                    expect(self.page.get_by_role('heading',name='技术示例' if lang=='zh' else 'Technique examples',exact=True)).to_have_count(0)
                            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
                            if lang=='zh':
                                self.page.wait_for_timeout(500)
                                self.page.screenshot(path=str(shots/f'f003-{ "tools" if route=="/tools" else "fab-botanic" }-{width}-{theme}.png'),full_page=True)
        for route,active in [('/',0),('/p/cloudkeep',0),('/source/cloudkeep',0),('/demos',2)]:
            self.goto(route+'?lang=en')
            expect(self.page.locator('header.topbar nav a').nth(active)).to_have_attribute('aria-current','page')

    def test_tools_grid_fallback_and_shared_examples(self):
        tools=self.context.request.get(BASE_URL+'/data/tools.json').json()
        tools['tools']=[dict(tools['tools'][0],slug='tool-'+str(i)) for i in range(3)]
        full=self.context.request.get(BASE_URL+'/data/tool/fab-botanic.json').json()
        game=self.context.request.get(BASE_URL+'/data/page/cloudkeep.json').json()
        full['examples']=game['examples'][:1]
        self.context.route('**/data/tools.json',lambda r:r.fulfill(json=tools))
        self.context.route(re.compile(r'/data/tool/tool-[0-2]\.json$'),lambda r:r.fulfill(json=dict(full,slug=r.request.url.split('/')[-1][:-5])))
        for width,columns in [(1440,3),(768,2),(390,1)]:
            self.page.set_viewport_size({'width':width,'height':1000})
            self.goto('/tools?lang=en')
            expect(self.page.locator('.tools-grid .tool-card')).to_have_count(3)
            self.assertEqual(self.page.locator('.tools-grid').evaluate('n=>getComputedStyle(n).gridTemplateColumns.split(" ").length'),columns)
        self.goto('/t/tool-0?lang=en')
        expect(self.page.get_by_text('Independent examples inspired by this tool.',exact=True)).to_be_visible()
        self.page.locator('.example-row').get_by_role('button',name='Run',exact=True).click()
        expect(self.page.locator('iframe')).to_have_count(1)
        expect(self.page.locator('iframe')).to_have_attribute('src',re.compile('^http'))
        self.page.locator('.example-row').get_by_role('button',name='Stop',exact=True).click()
        expect(self.page.locator('iframe')).to_have_count(0)
        self.page.get_by_role('link',name='Open in Demos ›').click()
        expect(self.page).to_have_url(re.compile('/demos/example%3A'))

    def test_boot_error_retry_and_source_error_retry(self):
        self.context.route('**/data/pages.json',lambda route:route.fulfill(status=503,body='unavailable'))
        self.page.goto(BASE_URL+'/?lang=en',wait_until='domcontentloaded')
        expect(self.page.get_by_text('Couldn’t load the library',exact=True)).to_be_visible()
        self.context.unroute('**/data/pages.json')
        self.page.get_by_role('button',name='Try again',exact=True).click()
        expect(self.page.locator('.game-card')).to_have_count(len(json.loads((ROOT/'catalog/games.json').read_text())['games']))
        self.context.route('**/data/src/cloudkeep/README.md',lambda r:r.fulfill(status=503,body='unavailable'))
        self.context.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(status=404,body='unavailable'))
        self.goto('/source/cloudkeep?lang=en')
        expect(self.page.get_by_text('Couldn’t load this file',exact=True)).to_be_visible()
        self.context.unroute('**/data/src/cloudkeep/README.md')
        self.page.get_by_role('button',name='Try again',exact=True).click()
        expect(self.page.locator('.code-line')).not_to_have_count(0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
