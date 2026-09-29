#!/usr/bin/env python3
"""Offline Chrome acceptance tests; all artifacts stay outside the repository."""
import http.client
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

EXAMPLE = Path(__file__).resolve().parent
ROOT = EXAMPLE.parents[1]
ID = EXAMPLE.name
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'examples/_shared'))
import ui_browser
from ui_browser import available_port, assert_picture_size, install_frame_test_context
PORT = available_port(json.loads((EXAMPLE / 'local.json').read_text())['port'])
URL = f'http://127.0.0.1:{PORT}'
SHOTS = Path(os.environ.get('BOTANIC_SHOTS', str(Path(tempfile.gettempdir()) / 'gameref-botanic-shots')))


def responds():
    connection = http.client.HTTPConnection('127.0.0.1', PORT, timeout=1)
    try:
        connection.request('HEAD', '/')
        return connection.getresponse().status == 200
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', str(EXAMPLE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        def stop_server():
            cls.server.terminate()
            try:
                cls.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.server.kill()
                cls.server.wait(timeout=5)
        cls.addClassCleanup(stop_server)
        deadline = time.monotonic() + 10
        while not responds():
            if cls.server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Test-owned server failed to start')
            time.sleep(.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(channel='chrome', headless=True, args=['--use-angle=metal', '--ignore-gpu-blocklist'])
        cls.addClassCleanup(cls.browser.close)
        SHOTS.mkdir(parents=True, exist_ok=True)

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 820}, locale='en-US', service_workers='block')
        self.addCleanup(self.context.close)
        install_frame_test_context(self.context)
        self.errors = []
        self.context.route('**/*', self.local_only)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('console', lambda m: self.errors.append(m.text) if m.type == 'error' else None)
        self.page.on('response', lambda r: self.errors.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        self.addCleanup(lambda: self.assertEqual(self.errors, []))
        self.page.goto(URL + '/?lang=en&theme=light')
        self.page.wait_for_function('window.__example?.ready', timeout=60000)
        self.page.wait_for_timeout(150)

    def local_only(self, route):
        if urlsplit(route.request.url).hostname == '127.0.0.1':
            route.continue_()
        else:
            self.errors.append('Unexpected network request: ' + route.request.url)
            route.abort()

    def state(self):
        return self.page.evaluate('window.__example')

    def slider(self, name, value):
        control = self.page.locator('#' + name)
        control.fill(str(value))
        control.dispatch_event('input')
        self.page.wait_for_timeout(90)

    def picture(self):
        return Image.open(io.BytesIO(self.page.locator('canvas').screenshot())).convert('RGB')

    def changed(self, before, minimum=.15):
        difference = sum(ImageStat.Stat(ImageChops.difference(before, self.picture())).mean) / 3
        self.assertGreater(difference, minimum)
        return round(difference, 3)

    def test_host_languages_and_themes(self):
        # The shared helper derives its screenshot root from __file__. Redirect only
        # that artifact location; execute the unmodified helper and its assertions.
        with patch.object(ui_browser, '__file__', str(SHOTS / 'ui' / 'examples' / '_shared' / 'ui_browser.py')):
            ui_browser.check_host_languages(self, self.browser, URL, ID)

    def test_canvas_and_mobile(self):
        image = self.picture()
        self.assertGreater(sum(ImageStat.Stat(image).stddev)/3, 12)
        self.assertGreater(len(image.getcolors(image.width*image.height)), 1000)
        self.page.screenshot(path=str(SHOTS / (ID + '.png')))
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.wait_for_timeout(150)
        assert_picture_size(self, self.page, 390)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)
        self.page.screenshot(path=str(SHOTS / (ID + '-mobile.png')), full_page=True)

    def test_iframe_input(self):
        self.page.route(URL + '/embed-test', lambda route: route.fulfill(content_type='text/html', body='<!doctype html><link rel="icon" href="data:,"><iframe name="demo" src="/?lang=en&theme=dark" style="width:960px;border:0" sandbox="allow-scripts allow-same-origin"></iframe>'))
        self.page.goto(URL + '/embed-test')
        frame = self.page.frame(name='demo')
        frame.wait_for_function('window.__example?.ready')
        assert_picture_size(self, frame, 960)
        control = 'count' if ID == 'botanic-phyllotaxis' else 'density'
        version = frame.evaluate('window.__example.version')
        frame.locator('#' + control).fill('20')
        frame.locator('#' + control).dispatch_event('input')
        frame.wait_for_function('v => window.__example.version > v', arg=version)

    def test_camera_input(self):
        before = self.picture()
        box = self.page.locator('canvas').bounding_box()
        self.page.mouse.move(box['x']+box['width']*.5, box['y']+box['height']*.5)
        self.page.mouse.down()
        self.page.mouse.move(box['x']+box['width']*.7, box['y']+box['height']*.6, steps=12)
        self.page.mouse.up()
        self.page.mouse.wheel(0, 160)
        self.page.wait_for_timeout(100)
        self.changed(before)

    def test_arrangements_and_all_controls(self):
        results = {}
        for mode in ['alternate', 'opposite', 'decussate', 'whorled', 'spiral']:
            before = self.picture()
            self.page.locator('#type').select_option(mode)
            self.page.wait_for_timeout(100)
            results[mode] = self.changed(before)
            self.assertEqual(self.state()['params']['type'], mode)
        for name, value in [('count', 60), ('spacing', .27), ('taper', .05), ('seed', 127)]:
            before = self.picture()
            self.slider(name, value)
            results[name] = self.changed(before)
            self.assertEqual(self.state()['params'][name], value)
        before = self.picture()
        self.page.locator('#top').check()
        self.page.wait_for_function('window.__example.top')
        self.changed(before)
        self.assertEqual(len(self.state()['points']), 60)
        print('Control pixel differences:', results)

    def test_vogel_packing_and_angle_input(self):
        self.page.locator('#type').select_option('sunflower')
        self.page.locator('#top').check()
        self.page.wait_for_timeout(150)
        packing = {}
        for angle in [135, 137.5, 140]:
            before = self.picture()
            self.page.locator(f'[data-angle="{angle}"]').click()
            self.page.wait_for_timeout(150)
            self.changed(before)
            state = self.state()
            packing[angle] = state['packing']
            self.assertEqual(state['params']['angle'], angle)
            self.assertEqual(self.page.locator('#hero-angle').inner_text(), f'{angle:.1f}°')
            self.page.screenshot(path=str(SHOTS / f'{ID}-head-{angle}.png'))
        self.assertGreater(packing[137.5], packing[135]*3)
        self.assertGreater(packing[137.5], packing[140]*2)
        before = self.picture()
        self.slider('angle', 128.4)
        self.changed(before)
        self.assertEqual(self.state()['params']['angle'], 128.4)
        print('Vogel mean nearest-neighbour spacing:', packing)


if __name__ == '__main__':
    result = unittest.main(verbosity=2, exit=False).result
    raise SystemExit(0 if result.testsRun and result.wasSuccessful() else 1)
