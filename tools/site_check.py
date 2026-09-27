#!/usr/bin/env python3
"""Check the Pages artifact at its real subpath, without API emulation or headers.

Requires installed Chrome, Python Playwright and Pillow. Entry/picture smoke
checks do not certify complete gameplay; catalog/RUNNABILITY.md owns that audit.
"""
import argparse
from contextlib import contextmanager
from functools import partial
from html import unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import math
from pathlib import Path
import re
import threading
import time
from urllib.parse import parse_qs, unquote, urljoin, urlparse
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageDraw, ImageStat
from experience_check import EXAMPLE_READY, READY_EXPRESSIONS, LOADING_ELEMENTS, KNOWN_MISSING_BACKEND

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/awesome-threejs-games/'
LIVE = 'https://0xmariowu.github.io' + PREFIX
OUTPUT = ROOT / 'output/site-check'
# Also documented in smartgame-town/TECHNICAL.md and catalog/runnability.json.
MISSING_BACKEND = {**KNOWN_MISSING_BACKEND, 'smartgame-town': KNOWN_MISSING_BACKEND['smartgame-town'] + ('/town/announcements-api.php',)}


class StaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass  # A closed page may cancel an in-flight video response.

    def list_directory(self, path):
        self.send_error(404)
        return None

    def translate_path(self, path):
        value = unquote(urlparse(path).path)
        if not value.startswith(PREFIX) or any(part in ('.', '..') for part in value.split('/')):
            return str(Path(self.directory) / '.missing-route')
        relative = value[len(PREFIX):]
        target = (Path(self.directory) / relative).resolve()
        if not target.is_relative_to(Path(self.directory).resolve()):
            return str(Path(self.directory) / '.missing-route')
        return str(target)

    def send_head(self):
        target = Path(self.translate_path(self.path))
        route = unquote(urlparse(self.path).path)[len(PREFIX):].strip('/')
        # Model Pages custom 404 accurately: boot the SPA with a 404 status,
        # never return the app for missing JS, textures or backend requests.
        if not target.exists() and (route in ('search', 'topics') or route.startswith(('source/', 'demos/'))):
            data = (Path(self.directory) / '404.html').read_bytes()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return io.BytesIO(data)
        return super().send_head()


@contextmanager
def site(target):
    if target.startswith(('https://', 'http://')):
        yield target.rstrip('/') + '/'
        return
    directory = Path(target).resolve()
    if not (directory / 'data/index.json').is_file():
        raise ValueError('Not a built site: ' + str(directory))
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(StaticHandler, directory=str(directory)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield 'http://127.0.0.1:{}{}'.format(server.server_port, PREFIX)
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


class Checker:
    def __init__(self, browser, base):
        self.browser, self.base = browser, base
        self.rows, self.shots = [], []
        self.current = None
        self.external = set()

    def expected(self, url):
        parsed = urlparse(url)
        if parsed.netloc != urlparse(self.base).netloc:
            return False
        slug = self.current.get('slug') if self.current else None
        path = parsed.path.removeprefix(PREFIX + 'games/' + str(slug))
        return path in MISSING_BACKEND.get(slug, ())

    def watch(self, context):
        def request(req):
            if urlparse(req.url).scheme in ('http', 'https') and urlparse(req.url).netloc != urlparse(self.base).netloc:
                self.external.add(req.url)
        def response(res):
            if not self.current or res.status < 400:
                return
            if self.expected(res.url):
                self.current['expected'].append('{} {}'.format(res.status, res.url))
            elif res.status == 404 and res.request.resource_type == 'document' and urlparse(res.url).path.startswith((PREFIX+'source/',PREFIX+'demos/')):
                self.current['expected'].append('Pages SPA fallback: '+res.url)
            elif urlparse(res.url).netloc == urlparse(self.base).netloc:
                self.current['errors'].append('{} {}'.format(res.status, res.url))
                print('  HTTP failure: {} {}'.format(res.status,res.url),flush=True)
            else:
                self.current['external_failures'].append('{} {}'.format(res.status, res.url))
                self.current['errors'].append('{} {}'.format(res.status,res.url))
        def failed(req):
            if not self.current or 'ERR_ABORTED' in (req.failure or ''):
                return
            if self.expected(req.url):
                self.current['expected'].append(req.url)
            elif urlparse(req.url).netloc == urlparse(self.base).netloc:
                self.current['errors'].append('{} {}'.format(req.failure, req.url))
            else:
                self.current['external_failures'].append('{} {}'.format(req.failure, req.url))
                self.current['errors'].append('{} {}'.format(req.failure,req.url))
        context.on('request', request)
        context.on('response', response)
        context.on('requestfailed', failed)
        def attach(page):
            page.on('pageerror', lambda error: self.current and self.current['errors'].append(str(error)))
            def console(message):
                if message.type != 'error' or not self.current:
                    return
                url = message.location.get('url', '')
                self.current['console_errors'].append({'url':url,'message':message.text})
                # Resource failures are classified by the response/request hooks,
                # unexpected resource failures are still fatal.
                if not message.text.startswith('Failed to load resource:'):
                    self.current['errors'].append(message.text)
            page.on('console', console)
        context.on('page', attach)

    def run(self, kind, name, action, slug=None):
        row = {'locale':self.locale,'kind':kind,'name':name,'slug':slug,'errors':[], 'expected':[], 'external_failures':[], 'console_errors':[]}
        self.current = row
        started = time.monotonic()
        try:
            action()
        except Exception as error:
            row['errors'].append((str(error) or repr(error))[:1500])
        row['errors'] = sorted(set(row['errors']))
        row['seconds'] = round(time.monotonic() - started, 2)
        row['pass'] = not row['errors']
        self.rows.append(row)
        print('{} | {} | {} | {} | {:.1f}s {}'.format(self.locale, kind, name, 'PASS' if row['pass'] else 'FAIL', row['seconds'], '; '.join(row['errors'])[:300]), flush=True)
        self.current = None
        (OUTPUT/'progress.json').write_text(json.dumps(self.rows,ensure_ascii=False,indent=2))

    def capture(self, page, name, surface=None):
        filename = re.sub(r'[^\w.-]', '_', self.locale + '-' + self.current['kind'] + '-' + name) + '.jpg'
        destination = OUTPUT / filename
        page.screenshot(path=str(destination), type='jpeg', quality=70, timeout=15000)
        self.shots.append((self.locale + ' ' + self.current['kind'] + ' ' + name, destination))
        if surface is not None:
            data = surface.screenshot(timeout=15000)
            stats = ImageStat.Stat(Image.open(io.BytesIO(data)).convert('RGB'))
            assert max(stats.stddev) > 2, 'Blank picture (pixel standard deviation <=2)'

    def frame(self, page, identifier):
        iframe = page.locator('iframe')
        expect(iframe).to_have_count(1, timeout=15000)
        iframe.wait_for(state='visible')
        frame = iframe.element_handle().content_frame()
        source = urlparse(urljoin(self.base, iframe.get_attribute('src')))
        expected = urlparse(urljoin(self.base, self.records[identifier]['launch']['url']))
        assert (source.netloc, source.path) == (expected.netloc, expected.path), 'Wrong iframe target'
        query = parse_qs(source.query)
        assert all(query.get(key) == value for key,value in parse_qs(expected.query).items()), 'Wrong scene/backend'
        # Some hosts temporarily change their query or add a model selection.
        frame.wait_for_url(lambda url: urlparse(str(url)).path == source.path, wait_until='domcontentloaded', timeout=15000)
        frame.wait_for_load_state('domcontentloaded')
        assert urlparse(frame.url).netloc == urlparse(self.base).netloc, 'Non same-origin frame'
        assert ('lang=' + ('en' if self.locale == 'en-US' else 'zh')) in iframe.get_attribute('src'), 'Wrong frame language: ' + iframe.get_attribute('src')
        ready = EXAMPLE_READY.get(identifier.split(':', 1)[1], 'window.__example?.ready') if identifier.startswith('example:') else 'window.__LAB__?.ready && window.__LAB__?.info?.render?.drawCalls > 0'
        frame.wait_for_function(ready, timeout=90000)
        surface = frame.locator('[data-demo-picture]:visible, canvas:visible, picture img:visible').first
        surface.wait_for(state='visible')
        page.wait_for_timeout(600)
        self.capture(page, identifier, surface)

    def readme(self, context):
        seen = set()
        for name in ('README.md','README.zh-CN.md'):
            text = (ROOT / name).read_text()
            links = re.findall(r'(?:href|src)="([^"]+)"', text) + re.findall(r'\]\(([^)]+)\)', text)
            for raw in links:
                link = unescape(raw)
                if link in seen:
                    continue
                seen.add(link)
                if link.startswith(LIVE):
                    response = context.request.get(self.base + link[len(LIVE):], timeout=30000)
                    assert response.status == 200, '{}: {} -> {}'.format(name, link, response.status)
                elif not urlparse(link).scheme and not link.startswith('#'):
                    target = (ROOT / unquote(urlparse(link).path)).resolve()
                    assert target.is_relative_to(ROOT) and target.exists(), '{}: missing {}'.format(name, link)
        self.current['links_checked'] = len(seen)

    def check_locale(self, locale):
        self.locale = locale
        context = self.browser.new_context(locale=locale, viewport={'width':1440,'height':1000}, device_scale_factor=1)
        context.add_init_script('if(window!==window.top)Object.defineProperty(navigator,"webdriver",{get:()=>false,configurable:true})')
        self.watch(context)
        page = context.new_page()
        index = context.request.get(self.base+'data/index.json').json()
        records = self.records = {row['id']:row for row in index['records']}
        pages = context.request.get(self.base+'data/pages.json').json()['pages']
        demos = context.request.get(self.base+'data/demos.json').json()
        def home():
            assert page.goto(self.base).status == 200
            expect(page.locator('.game-card')).to_have_count(16)
            expect(page.locator('nav a').first).to_have_text('Projects' if locale == 'en-US' else '项目')
            assert page.locator('nav a').count() == 2
            self.capture(page,'home')
        self.run('home','16 cards',home)
        self.run('links','README files',lambda:self.readme(context))
        for summary in pages:
            slug=summary['slug']
            def project():
                assert page.goto(self.base+'p/'+slug).status == 200
                expect(page.locator('.project h1')).to_have_text(summary['title'])
                assert page.locator('.project-actions a[href^="https://github.com/"]').get_attribute('href').startswith('https://github.com/')
                expect(page.locator('.example-row')).to_have_count(summary['examples'])
                video=page.locator('video')
                expect(video).to_have_attribute('src', PREFIX+'media/'+slug+'/overview.mp4')
                page.wait_for_function('() => document.querySelector("video").readyState >= 2',timeout=30000)
                start=video.evaluate('v=>{v.play();return v.currentTime}')
                page.wait_for_timeout(1200)
                assert video.evaluate('v=>v.currentTime') > start+.2, 'Video currentTime did not advance'
                self.capture(page,'project-'+slug)
            self.run('project',slug,project,slug)
            def game():
                deadline = time.monotonic() + 90
                remaining = lambda: max(1, int((deadline - time.monotonic()) * 1000))
                with page.expect_popup(timeout=remaining()) as pending:
                    page.locator('.project-actions .play-button').click()
                popup = pending.value
                try:
                    expect(popup).to_have_url(urljoin(self.base, records['game:'+slug]['launch']['url']), timeout=remaining())
                    popup.locator('canvas').first.wait_for(state='visible',timeout=remaining())
                    if slug in READY_EXPRESSIONS:
                        popup.wait_for_function(READY_EXPRESSIONS[slug],timeout=remaining())
                    if slug in LOADING_ELEMENTS:
                        popup.locator(LOADING_ELEMENTS[slug]).wait_for(state='hidden',timeout=remaining())
                    if slug == 'longhoang-lyo':
                        popup.get_by_role('button',name="LET'S GO",exact=True).wait_for(timeout=remaining())
                    popup.wait_for_timeout(min(3000,remaining()))
                    assert time.monotonic() <= deadline, 'Game exceeded 90 second launch budget'
                    self.capture(popup,'game-'+slug,popup.locator('canvas').first)
                except Exception:
                    self.capture(popup,'failed-game-'+slug)
                    self.current['visible_text'] = popup.locator('body').inner_text()[:3000]
                    raise
                finally:
                    popup.close()
            self.run('game',slug,game,slug)
            detail=context.request.get(self.base+'data/page/'+slug+'.json').json()
            for example in detail['examples']:
                def example_check():
                    row=page.locator('.example-row[data-id="'+example['id']+'"]')
                    row.locator('button').click()
                    try:
                        self.frame(page,'example:'+example['id'])
                    finally:
                        row.locator('button').click()
                self.run('example',example['id'],example_check,slug)
        def source_browser():
            response=page.goto(self.base+'source/cloudkeep')
            assert response.status == 404, 'Source deep link must exercise the Pages 404 fallback'
            expect(page.locator('.viewer-header')).to_contain_text('README.md')
            expect(page.locator('.code-line')).not_to_have_count(0)
            assert page.locator('[role=treeitem]').count()>2
            assert all('/awesome-threejs-games/' in a for a in page.locator('.topbar nav a').evaluate_all('ns=>ns.map(n=>n.href)'))
            self.capture(page,'source-cloudkeep')
        self.run('source','Pages fallback and bundled README',source_browser)
        # Every demo is loaded through a fresh category/hash deep link, exercising
        # the deployed router and the real iframe launch path (including Lab).
        for demo in demos['demos']:
            def demo_check():
                assert page.goto(self.base+'demos?cat='+demo['category']+'#'+demo['id']).status == 200
                expect(page.locator('.demo-source')).to_have_attribute('href',demo['source_url'])
                self.frame(page,demo['id'])
            self.run('demo',demo['id'],demo_check)
        context.close()

    def finish(self):
        cols, width, height = 5, 320, 246
        sheet = Image.new('RGB',(cols*width,math.ceil(len(self.shots)/cols)*height),'#eee')
        draw = ImageDraw.Draw(sheet)
        for i,(label,file) in enumerate(self.shots):
            x,y=(i%cols)*width,(i//cols)*height
            image=Image.open(file);image.thumbnail((width,218))
            sheet.paste(image,(x,y));draw.text((x+3,y+220),label[:49],fill='black')
        sheet.save(OUTPUT/'sheet.jpg',quality=85)
        for start in range(0,sheet.height,5*height):
            sheet.crop((0,start,sheet.width,min(start+5*height,sheet.height))).save(OUTPUT/('sheet-{}.jpg'.format(start//(5*height)+1)),quality=85)
        failures=[row for row in self.rows if not row['pass']]
        result={'base':self.base,'rows':self.rows,'passed':len(self.rows)-len(failures),'failed':len(failures),'external_requests':sorted(self.external),'sheet':str(OUTPUT/'sheet.jpg')}
        (OUTPUT/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print('TOTAL: {} passed, {} failed; {} external URLs; {}'.format(result['passed'],result['failed'],len(self.external),OUTPUT/'sheet.jpg'))
        return bool(failures)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target')
    args=parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    with site(args.target) as base, sync_playwright() as playwright:
        browser=playwright.chromium.launch(channel='chrome',headless=True,args=['--use-angle=metal','--enable-unsafe-webgpu','--ignore-gpu-blocklist'])
        checker=Checker(browser,base)
        try:
            for locale in ('en-US','zh-CN'):
                checker.check_locale(locale)
        finally:
            failed=checker.finish()
            browser.close()
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main())
