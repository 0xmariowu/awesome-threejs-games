#!/usr/bin/env python3
"""Walk the library in installed headless Chrome; issues are data unless --strict is used.

Python 3.9, Playwright and Pillow. No game/catalog changes. An original's
launch check is not a complete playthrough; screenshots require human review.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import traceback
from urllib.error import URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://github.com/0xmariowu/awesome-threejs-games/tree/main/'
LOCALES = {'zh-CN': 'zh', 'en-US': 'en'}
LABELS = {
    'zh': {'play': '体验游戏', 'source': '查看源码', 'run': '运行', 'stop': '停止',
           'nav': ['项目', '技术演示']},
    'en': {'play': 'Play game', 'source': 'View source', 'run': 'Run', 'stop': 'Stop',
           'nav': ['Projects', 'Demos']},
}
# The frame standard also supports DOM pictures (e.g. tidewater-fishing).
SURFACE = '[data-demo-picture]:visible, canvas:visible, picture img:visible'
# Readiness only; frame geometry/control checks belong to demo_frame_check.py.
EXAMPLE_READY = {
    'cloudkeep-flight': 'Number.isFinite(window.__flight?.speed)',
    'cloudkeep-models': 'window.__models?.stats',
    'tidewater-fishing': 'document.querySelector("#time")?.textContent !== "0.0 s"',
    'vox-reactions': 'window.__example?.hp === 600',
    'arkenfall-camera': 'window.__example?.time > .3',
    'cloudkeep-atmosphere': 'window.__example?.frames > 2',
    'monolith-terrain': 'window.__example?.state?.frame > 2',
    'shabondama-director': 'window.__example?.frameCount > 2',
}
# Read-only entry readiness from the existing tools/playthrough modules. These
# prevent a loading screen with an already-created canvas from passing early.
READY_EXPRESSIONS = {
    'hanakawa': 'window.__lumaReady === true',
    'monolith-wilds': 'window.__MW?.ready === true',
    'arkenfall': 'window.__ready === true',
    'shabondama-biyori': 'window.__app?.ready === true',
}
LOADING_ELEMENTS = {'hanakawa': '#loading', 'vox-arcana': '#loading',
                    'moritsuki': '#loading', 'shabondama-biyori': '#loading',
                    'scorch-podracer': '#boot'}
INSTRUMENT = """(() => {
  const report = (kind, message) => {
    if (kind === 'frame-error') window.__experienceFailure = String(message);
    window.__experienceEvent({kind, message: String(message), url: location.href}).catch(() => {});
  };
  addEventListener('error', e => {
    if (e.message) report('frame-error', e.error?.stack || e.message);
  });
  addEventListener('unhandledrejection', e =>
    report('frame-error', e.reason?.stack || e.reason));
  if (window === window.top) {
    window.__experienceMaxIframes = 0;
    new MutationObserver(records => {
      // Count added nodes too: a second iframe removed in the same task matters.
      for (const r of records) for (const n of r.addedNodes) {
        if (n.nodeType === 1 && (n.matches('iframe') || n.querySelector('iframe')))
          window.__experienceMaxIframes = Math.max(window.__experienceMaxIframes,
            document.querySelectorAll('iframe').length);
      }
    }).observe(document, {childList: true, subtree: true});
  }
})();"""


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def inventory():
    games = read_json('catalog/games.json')['games']
    pages = {g['slug']: read_json('catalog/pages/' + g['slug'] + '.json') for g in games}
    reviews = {g['slug']: g for g in read_json('catalog/runnability.json')['games']}
    return games, pages, reviews


def local_url(game):
    return 'http://127.0.0.1:{}{}'.format(game['port'], game['entry'])


def dry_run(games, pages, reviews):
    print('DRY RUN: no server, browser or output directory will be created.')
    for locale in LOCALES:
        print(locale + ': fresh browser context, automatic language, no URL override')
        print('  Home: 16 cards from /api/pages; previews, source links, Play popups')
        for game in games:
            slug = game['slug']
            print('  /p/{}: overview plays; source {}; Play -> {} canvas <=90s'.format(
                slug, SOURCE + slug, local_url(game)))
            for example in pages[slug]['examples']:
                print('    {}: source; Run -> one inline picture/canvas <=60s -> Stop'.format(example['id']))
        print('  /demos: all API demos via grouped sidebar and selection; one loaded iframe; source')
        print('  All library views: translated chrome, no console errors, no overflow at 390px')
    print('{} games, {} project examples per locale; demo inventory from /api/demos at runtime.'.format(
        len(games), sum(len(p['examples']) for p in pages.values())))
    print('Evidence: table, counts, summary.json, labelled sheet.jpg. Issues exit 0; --strict exits 1.')



# Server-backed features documented as missing in catalog/RUNNABILITY.md (部分能玩):
# the archives contain no backend code, so these exact endpoints always fail.
KNOWN_MISSING_BACKEND = {
    'vox-arcana': ('/api/status',),
    'smartgame-town': ('/account/api.php', '/town/room-api.php'),
    'tableparty-kart': ('/kart-room',),
}


def known_missing_backend(slug, url):
    path = urlparse(url or '').path
    return path in KNOWN_MISSING_BACKEND.get(slug or '', ())


class Runner:
    def __init__(self, output, games, pages, reviews):
        self.output, self.games, self.pages, self.reviews = output, games, pages, reviews
        self.items, self.shots = [], []
        self.active = None
        self.server = self.log = self.browser = None
        self.crashed = False
        self.locale = self.lang = None
        self.demos_data = {'demos': []}

    def start_server(self):
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        self.base = 'http://127.0.0.1:{}'.format(port)
        self.log = (self.output / 'server.log').open('w', encoding='utf-8')
        self.server = subprocess.Popen(['node', 'tools/library.mjs'], cwd=ROOT,
            env={**os.environ, 'LIBRARY_PORT': str(port)}, stdout=self.log, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.server.poll() is not None:
                raise RuntimeError('Library exited during startup; see server.log')
            try:
                with urlopen(self.base + '/api/index', timeout=1) as response:
                    json.load(response)
                return
            except (URLError, TimeoutError):
                time.sleep(0.1)
        raise RuntimeError('Library /api/index not ready within 20 seconds')

    def stop_server(self):
        if self.server is not None:
            self.server.terminate()
            try:
                self.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server.kill()
                self.server.wait(timeout=5)
        if self.log is not None:
            self.log.close()

    def event(self, kind, **values):
        if self.active is not None:
            event = {'kind': kind, **values}
            if event not in self.active['events']:
                self.active['events'].append(event)

    def route(self, route):
        request = route.request
        url = urlparse(request.url)
        # Some Lab scenes load public models/textures. Blocking read-only asset
        # fetches fabricates console errors that a connected visitor never sees.
        if url.hostname == '127.0.0.1' or (
                url.scheme in ('http', 'https') and request.method in ('GET', 'HEAD')
                and not request.is_navigation_request()):
            route.continue_()
        else:
            self.event('blocked-external', url=route.request.url)
            route.abort()

    def observe(self, page):
        page.set_default_timeout(15000)
        page.on('pageerror', lambda error: self.event('page-error', message=str(error), url=page.url))
        page.on('console', lambda msg: self.event('console-error', message=msg.text,
                url=msg.location.get('url')) if msg.type == 'error' else None)
        page.on('response', lambda response: self.event('http-error', status=response.status,
                url=response.url) if response.status >= 400 else None)
        page.on('requestfailed', lambda request: self.event('request-failed', url=request.url,
                message=request.failure))
        page.on('crash', lambda: setattr(self, 'crashed', True))

    def begin(self, kind, slug, name):
        item = {'kind': kind, 'slug': slug, 'name': name, 'locale': self.locale, 'status': 'ok',
                'reasons': [], 'checks': [], 'events': [], 'screenshots': []}
        self.items.append(item)
        self.active = item
        print('Checking {} / {} / {}'.format(self.locale, kind, name), flush=True)
        return item

    def issue(self, message):
        self.active['status'] = 'issue'
        if message not in self.active['reasons']:
            self.active['reasons'].append(message)

    def check(self, label, action):
        try:
            result = action()
            detail = result if isinstance(result, (dict, list, str, int, float, bool, type(None))) else None
            self.active['checks'].append({'name': label, 'status': 'ok', 'detail': detail})
            return True
        except (AssertionError, self.PWError) as error:
            if self.crashed or not self.browser.is_connected() or self.server.poll() is not None:
                raise RuntimeError('Browser/page/library crashed') from error
            message = str(error).split('Call log:')[0].strip()
            self.issue(label + ': ' + message)
            self.active['checks'].append({'name': label, 'status': 'issue', 'detail': message})
            return False

    def require(self, condition, message):
        if not condition:
            raise AssertionError(message)

    def finish(self):
        for event in self.active['events']:
            if event['kind'] == 'console-error' and known_missing_backend(self.active['slug'], event.get('url')):
                self.active['checks'].append({'name': 'known missing backend (catalog/RUNNABILITY.md)',
                                              'status': 'ok', 'detail': event.get('url')})
                continue
            if event['kind'] in ('frame-error', 'page-error', 'console-error'):
                self.issue('{}: {} ({})'.format(event['kind'], event['message'], event.get('url') or 'unknown URL'))
        print('  {}{}'.format(self.active['status'], ': ' + '; '.join(self.active['reasons'])
                             if self.active['reasons'] else ''), flush=True)
        self.active = None

    def shot(self, page, label, full=False):
        filename = '{:03d}-{}-{}.png'.format(len(self.shots) + 1, self.locale, label)
        page.screenshot(path=str(self.output / filename), full_page=full, timeout=15000)
        self.shots.append({'file': filename, 'label': label})
        self.active['screenshots'].append(filename)
        return filename

    def video(self, page, selector):
        video = page.locator(selector)
        self.require(video.count() == 1, 'Expected one video; found {}'.format(video.count()))
        video.scroll_into_view_if_needed()
        page.wait_for_function('s => { const v=document.querySelector(s); '
                              'return v && !v.paused && v.readyState >= 2 && v.videoWidth > 0; }', arg=selector)
        first = video.evaluate('v => v.currentTime')
        page.wait_for_function('a => {const v=document.querySelector(a.s); '
                              'return !v.paused && Math.abs(v.currentTime-a.t)>0.1;}',
                              arg={'s': selector, 't': first}, timeout=5000)
        return {'time_before': first, 'time_after': video.evaluate('v => v.currentTime')}

    def chrome(self, page):
        self.expect(page.locator('html')).to_have_attribute('lang', 'zh-CN' if self.lang == 'zh' else 'en')
        self.expect(page.locator('.brand')).to_have_count(1)
        self.expect(page.locator('.brand')).to_have_text('Awesome Three.js Games')
        self.expect(page.locator('.topbar nav a')).to_have_text(LABELS[self.lang]['nav'])
        self.require('lang' not in parse_qs(urlparse(page.url).query), 'Library URL overrides browser language')
        self.require(page.evaluate('navigator.language') == self.locale, 'Unexpected browser locale')
        self.require(page.evaluate('localStorage.getItem("gameref-lang")') is None,
                     'Saved language masks automatic browser selection')

    def mobile(self, page, label, screenshot=False):
        previous = page.viewport_size
        try:
            page.set_viewport_size({'width': 390, 'height': 900})
            # Allow responsive layout and frame resize messages to settle.
            page.wait_for_timeout(350)
            dimensions = page.evaluate("""() => ({viewport: innerWidth,
                document: document.documentElement.scrollWidth, body: document.body.scrollWidth})""")
            self.require(max(dimensions['document'], dimensions['body']) <= 390,
                         'Horizontal overflow: {}'.format(dimensions))
            if screenshot:
                page.evaluate('window.scrollTo(0, 0)')
                self.shot(page, label + '-390')
            return dimensions
        finally:
            page.set_viewport_size(previous)

    def source(self, scope, url, arrow=False):
        link = scope.get_by_role('link', name='GitHub ↗', exact=True)
        self.expect(link).to_have_attribute('href', url)
        self.expect(link).to_have_attribute('target', '_blank')
        self.expect(link).to_have_attribute('rel', 'noopener')

    def home(self, page):
        home = self.begin('home', '', 'home-layout')
        self.check('Open home', lambda: page.goto(self.base, wait_until='domcontentloaded'))
        self.check('Automatic language and wordmark/nav', lambda: self.chrome(page))
        self.check('API game inventory', lambda: self.require(
            set(self.summaries) == {g['slug'] for g in self.games}, 'API pages differ from game inventory'))
        self.check('16 API pages', lambda: self.require(len(self.summaries) == 16, 'Expected 16 API pages'))
        self.check('Cards match /api/pages', lambda: self.expect(page.locator('.game-card')).to_have_count(len(self.summaries)))
        self.check('Card slugs match /api/pages', lambda: self.require(
            sorted(page.locator('.game-card').evaluate_all('rows => rows.map(r => r.dataset.slug)')) ==
            sorted(self.summaries), 'Card slugs differ from /api/pages'))
        self.check('Top screenshot', lambda: self.shot(page, 'home-top'))
        self.check('No horizontal scroll at 390px', lambda: self.mobile(page, 'home', screenshot=True))
        self.finish()
        for game in self.games:
            slug = game['slug']
            self.begin('preview', slug, slug)
            selector = '.game-card[data-slug="{}"]'.format(slug)
            row = page.locator(selector)
            self.check('Project link', lambda: self.expect(row.locator('.game-title a')).to_have_attribute('href', '/p/' + slug))
            def image_ready():
                row.scroll_into_view_if_needed()
                self.expect(row.locator('img')).to_be_visible()
                page.wait_for_function('s => {const i=document.querySelector(s+" img"); '
                                       'return i.complete && i.naturalWidth>0;}', arg=selector)
            self.check('Animated preview loaded', image_ready)
            self.finish()
            self.original(page, game, row, 'home-original')
        self.active = home
        self.check('Full home screenshot', lambda: self.shot(page, 'home-full', full=True))
        self.finish()

    def project(self, page, game):
        slug = game['slug']
        self.begin('project', slug, slug)
        self.check('Open project', lambda: page.goto(self.base + '/p/' + slug, wait_until='domcontentloaded'))
        self.check('Project rendered', lambda: self.expect(page.locator('.project-head')).to_be_visible())
        self.check('Overview playing', lambda: self.video(page, '.project-hero video'))
        self.check('Automatic language and wordmark/nav', lambda: self.chrome(page))
        self.check('View source', lambda: self.source(page.locator('.project-actions'), SOURCE + slug))
        review = self.reviews.get(slug, {})
        self.check('Reviewed verdict available', lambda: self.require(
            review.get('reviewed_verdict') in ('能玩', '部分能玩', '不能玩'), 'Missing/invalid reviewed verdict'))
        badge = page.locator('.project-actions .runnability-badge')
        self.check('Runnability badge iff not playable', lambda: self.expect(badge).to_have_count(
            int(review.get('reviewed_verdict') != '能玩')))
        if review.get('reviewed_verdict') in ('部分能玩', '不能玩'):
            self.check('Badge text', lambda: self.expect(badge).to_have_text(review['reviewed_verdict'] if self.lang == 'zh' else
                {'部分能玩': 'Partly playable', '不能玩': 'Not playable'}[review['reviewed_verdict']]))
        self.check('Example list matches catalog', lambda: self.require(
                page.locator('.example-row').evaluate_all('rows => rows.map(r => r.dataset.id)') ==
                [e['id'] for e in self.pages[slug]['examples']], 'Example IDs/order differ from catalog'))
        self.check('No horizontal scroll at 390px', lambda: self.mobile(page, slug, screenshot=True))
        self.check('Project screenshot', lambda: self.shot(page, slug + '-project', full=True))
        self.finish()
        for example in self.pages[slug]['examples']:
            self.example(page, slug, example)
        self.original(page, game, page.locator('.project-actions'))

    @staticmethod
    def remaining(deadline):
        return max(1, int((deadline - time.monotonic()) * 1000))

    def frame_condition(self, frame, expression, deadline):
        # Runtime failures cannot recover into a valid launch. Keep them as issue
        # data and move on instead of spending the whole load budget per demo.
        frame.wait_for_function('window.__experienceFailure || (' + expression + ')',
                                timeout=self.remaining(deadline))
        failure = frame.evaluate('window.__experienceFailure')
        self.require(not failure, 'Frame runtime error: ' + str(failure))

    def frame_ready(self, page, iframe, launch_id, deadline):
        iframe.wait_for(state='visible', timeout=self.remaining(deadline))
        self.expect(page.locator('iframe')).to_have_count(1, timeout=self.remaining(deadline))
        expected = urlparse(self.records[launch_id]['launch']['url'])
        actual = urlparse(iframe.get_attribute('src'))
        self.require((actual.scheme, actual.netloc, actual.path) ==
                     (expected.scheme, expected.netloc, expected.path), 'Wrong iframe launch URL')
        self.require(actual.hostname == '127.0.0.1', 'Non-loopback iframe')
        query = parse_qs(actual.query)
        self.require(all(query.get(key) == value for key, value in parse_qs(expected.query).items()),
                     'Wrong iframe launch query (scene/backend/embed)')
        self.require(query.get('lang') == [self.lang], 'Wrong iframe language')
        frame = iframe.element_handle().content_frame()
        self.require(frame is not None, 'Iframe has no document')
        iframe.scroll_into_view_if_needed(timeout=self.remaining(deadline))
        frame.wait_for_load_state('load', timeout=self.remaining(deadline))
        self.frame_condition(frame, """[...document.querySelectorAll(
            '[data-demo-picture], canvas, picture img')].some(e => {
                const r = e.getBoundingClientRect();
                return getComputedStyle(e).visibility !== 'hidden' && r.width > 0 && r.height > 0 &&
                    (e.tagName !== 'IMG' || e.complete && e.naturalWidth > 0);
            })""", deadline)
        if launch_id.startswith('example:'):
            ready = EXAMPLE_READY.get(launch_id.split(':', 1)[1], 'window.__example?.ready')
        else:
            ready = 'window.__LAB__?.ready && window.__LAB__?.info?.render?.drawCalls > 0'
        self.frame_condition(frame, ready, deadline)
        page.wait_for_timeout(min(500, self.remaining(deadline)))
        self.active['frame_url'] = frame.url
        return {'url': frame.url, 'surface': SURFACE}

    def single_frame(self, page):
        self.require(page.evaluate('window.__experienceMaxIframes || 0') <= 1,
                     'Multiple simultaneous iframes')

    def example(self, page, slug, example):
        identifier = example['id']
        self.begin('example', slug, identifier)
        row = page.locator('.example-row[data-id="{}"]'.format(identifier))
        folder = self.records['example:' + identifier]['launch'].get('folder', identifier)
        self.check('Open in Demos', lambda: self.expect(row.locator('a')).to_have_attribute('href', '/demos/example:' + identifier))
        def launch():
            self.expect(page.locator('iframe')).to_have_count(0)
            deadline = time.monotonic() + 60
            row.get_by_role('button', name=LABELS[self.lang]['run'], exact=True).click(timeout=self.remaining(deadline))
            return self.frame_ready(page, row.locator('iframe'), 'example:' + identifier, deadline)
        self.check('Run/load inline picture within 60s', launch)
        self.check('Example screenshot', lambda: self.shot(page, identifier + '-inline'))
        self.check('No horizontal scroll at 390px', lambda: self.mobile(page, identifier))
        def stop():
            row.get_by_role('button', name=LABELS[self.lang]['stop'], exact=True).click()
            self.expect(page.locator('iframe')).to_have_count(0)
        stopped = self.check('Stop removes iframe', stop)
        self.check('Never more than one iframe', lambda: self.single_frame(page))
        self.finish()
        if not stopped:
            self.begin('recovery', slug, identifier + '-cleanup')
            self.check('Reload clears iframe', lambda: page.goto(self.base + '/p/' + slug))
            self.check('No leftover iframe', lambda: self.expect(page.locator('iframe')).to_have_count(0))
            self.finish()

    def demos(self, page):
        self.begin('demos', '', 'demos-layout')
        self.check('Navigate to Demos', lambda: page.get_by_role('link', name=LABELS[self.lang]['nav'][1], exact=True).click())
        self.check('All demos listed', lambda: self.expect(page.locator('.demo-item')).to_have_count(len(self.demos_data['demos'])))
        self.check('Automatic language and wordmark/nav', lambda: self.chrome(page))
        self.check('Lab available', lambda: self.require(not self.demos_data.get('lab_error'), str(self.demos_data.get('lab_error'))))
        self.check('Category groups', lambda: self.expect(page.locator('.demo-group')).to_have_count(len(self.demos_data['categories'])))
        self.finish()
        for category in self.demos_data['categories']:
            demos = [d for d in self.demos_data['demos'] if d['category'] == category['key']]
            for index, demo in enumerate(demos):
                self.begin('demo', '', demo['id'])
                def select():
                    deadline = time.monotonic() + 60
                    button = page.locator('.demo-item[data-id="{}"]'.format(demo['id']))
                    button.click(timeout=self.remaining(deadline))
                    self.expect(button).to_have_attribute('aria-pressed', 'true')
                    return self.frame_ready(page, page.locator('.demo-player iframe'), demo['launch_id'], deadline)
                self.check('Select/load demo picture within 60s', select)
                self.check('Demo source', lambda: self.source(page.locator('.demo-head'), demo['source_url'], arrow=True))
                self.check('Never more than one iframe', lambda: self.single_frame(page))
                self.check('Demo screenshot', lambda: self.shot(page, demo['id'].replace(':', '-') + '-demo'))
                self.check('No horizontal scroll at 390px', lambda: self.mobile(page, demo['id'].replace(':', '-'), screenshot=index == 0))
                self.finish()

    def original(self, page, game, scope, kind='original'):
        slug = game['slug']
        self.begin(kind, slug, slug)
        previous = set(page.context.pages)
        def launch():
            deadline = time.monotonic() + 90
            with page.expect_popup(timeout=self.remaining(deadline)) as pending:
                scope.locator('.play-button').click(timeout=self.remaining(deadline))
            popup = pending.value
            popup.wait_for_url(local_url(game), wait_until='domcontentloaded', timeout=self.remaining(deadline))
            self.active['popup_url'] = popup.url
            popup.locator('canvas').first.wait_for(state='visible', timeout=self.remaining(deadline))
            popup.wait_for_timeout(min(5000, self.remaining(deadline)))
            if slug in READY_EXPRESSIONS:
                popup.wait_for_function(READY_EXPRESSIONS[slug], timeout=self.remaining(deadline))
            if slug in LOADING_ELEMENTS:
                popup.locator(LOADING_ELEMENTS[slug]).wait_for(state='hidden', timeout=self.remaining(deadline))
            if slug == 'longhoang-lyo':
                popup.get_by_role('button', name="LET'S GO", exact=True).wait_for(
                    state='visible', timeout=self.remaining(deadline))
            self.active['visible_text'] = popup.locator('body').inner_text(timeout=self.remaining(deadline))[:6000]
            self.active['launch_seconds'] = round(90 - (deadline - time.monotonic()), 2)
            return {'url': popup.url, 'canvases': popup.locator('canvas').count(),
                    'scope': 'Entry launch only; menus and complete gameplay not certified.'}
        self.check('Popup local URL and canvas within 90s', launch)
        for popup in set(page.context.pages) - previous:
            if not popup.is_closed():
                self.check('Original screenshot', lambda popup=popup: self.shot(popup, slug + '-original'))
                popup.close()
        self.finish()

    def run(self):
        from playwright.sync_api import Error, expect, sync_playwright
        self.PWError, self.expect = Error, expect
        self.start_server()
        def api(path):
            with urlopen(self.base + path, timeout=20) as response:
                return json.load(response)
        self.summaries = {p['slug']: p for p in api('/api/pages')['pages']}
        self.records = {r['id']: r for r in api('/api/index')['records']}
        self.demos_data = api('/api/demos')
        with sync_playwright() as playwright:
            self.browser = playwright.chromium.launch(channel='chrome', headless=True)
            try:
                for self.locale, self.lang in LOCALES.items():
                    context = self.browser.new_context(viewport={'width': 1440, 'height': 1000},
                        locale=self.locale, service_workers='block', reduced_motion='no-preference')
                    context.expose_binding('__experienceEvent', lambda source, event: self.event(
                        event['kind'], message=event['message'], url=event['url'],
                        is_iframe=source['frame'] != source['page'].main_frame))
                    context.add_init_script(INSTRUMENT)
                    context.on('page', self.observe)
                    context.route('**/*', self.route)
                    if hasattr(context, 'route_web_socket'):
                        def websocket(ws):
                            if urlparse(ws.url).hostname == '127.0.0.1':
                                ws.connect_to_server()
                            else:
                                self.event('blocked-external-websocket', url=ws.url)
                                ws.close()
                        context.route_web_socket('**/*', websocket)
                    try:
                        page = context.new_page()
                        self.home(page)
                        for game in self.games:
                            self.project(page, game)
                        self.demos(page)
                    finally:
                        context.close()
            finally:
                self.browser.close()

    def save(self, crash=None):
        counts = Counter(item['status'] for item in self.items)
        groups = {}
        for item in self.items:
            group = groups.setdefault(item['kind'], {'total': 0, 'ok': 0, 'issue': 0})
            group['total'] += 1
            group[item['status']] += 1
        summary = {'started_at': self.output.name, 'finished_at': datetime.now(timezone.utc).isoformat(),
                   'output': str(self.output), 'counts': {'total': len(self.items),
                   'ok': counts['ok'], 'issue': counts['issue']}, 'by_kind': groups,
                   'harness_crash': crash, 'games': len(self.games),
                   'examples': sum(len(p['examples']) for p in self.pages.values()),
                   'locales': list(LOCALES), 'demos': len(self.demos_data['demos']),
                   'scope': 'Visitor launch acceptance; manual screenshot review required. '
                            'Canvas presence and animation do not certify complete gameplay.',
                   'items': self.items, 'screenshots': self.shots, 'sheet': 'sheet.jpg'}
        (self.output / 'summary.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n')
        if self.shots:
            from PIL import Image, ImageDraw, ImageFont, ImageOps
            width, height, columns = 400, 310, 4
            sheet = Image.new('RGB', (width * columns, height * math.ceil(len(self.shots) / columns)), '#20232a')
            draw = ImageDraw.Draw(sheet)
            font = ImageFont.load_default()
            for index, shot in enumerate(self.shots):
                with Image.open(self.output / shot['file']) as original:
                    thumb = ImageOps.contain(original.convert('RGB'), (width - 12, height - 42))
                x, y = index % columns * width, index // columns * height
                sheet.paste(thumb, (x + (width - thumb.width) // 2, y + 30))
                draw.text((x + 6, y + 6), shot['file'], font=font, fill='white')
            sheet.save(self.output / 'sheet.jpg', quality=90)
        print('\n| Kind | Item | Result | Reason |\n|---|---|---|---|')
        for item in self.items:
            reason = '; '.join(item['reasons']).replace('\n', ' ').replace('|', '/')
            print('| {} | {} | {} | {} |'.format(item['kind'], item['locale'] + ' / ' + item['name'], item['status'], reason))
        print('\nCounts: {}\nEvidence: {}\nSheet: {}'.format(summary['counts'], self.output, self.output / 'sheet.jpg'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true', help='List checks without launching anything')
    parser.add_argument('--strict', action='store_true', help='Exit 1 if any check reports an issue')
    args = parser.parse_args()
    games, pages, reviews = inventory()
    if args.dry_run:
        dry_run(games, pages, reviews)
        return 0
    output = ROOT / 'output/experience-check' / datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    output.mkdir(parents=True)
    runner = Runner(output, games, pages, reviews)
    crash = None
    try:
        runner.run()
    except Exception:
        crash = traceback.format_exc()
        print(crash, file=sys.stderr)
    finally:
        runner.stop_server()
        runner.save(crash)
    return int(bool(crash) or (args.strict and any(item['status'] == 'issue' for item in runner.items)))


if __name__ == '__main__':
    sys.exit(main())
