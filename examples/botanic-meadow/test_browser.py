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
        self.context.close()  # Shared helper opens its own contexts, one renderer at a time.
        # The shared helper derives its screenshot root from __file__. Redirect only
        # that artifact location; execute the unmodified helper and its assertions.
        with patch.object(ui_browser, '__file__', str(SHOTS / 'ui' / 'examples' / '_shared' / 'ui_browser.py')):
            ui_browser.check_host_languages(self, self.browser, URL, ID)

    def test_canvas_and_mobile(self):
        state = self.state()
        self.assertEqual(state['params']['seed'], 42)
        self.assertEqual(sum(state['quadrants']), state['plants'])
        for count in state['quadrants']:
            self.assertGreaterEqual(count / state['plants'], .15)
        print('Default quadrant plant counts:', state['quadrants'], 'total:', state['plants'])
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

    def test_field_controls_and_statistics(self):
        self.slider('wind', 0)
        results = {}
        for name, value in [('density', 40), ('size', 6), ('clumping', 0), ('gaps', .9)]:
            before = self.picture()
            self.slider(name, value)
            results[name] = self.changed(before)
            self.assertEqual(self.state()['params'][name], value)
        before = self.picture()
        seed = self.state()['params']['seed']
        self.page.locator('#new-seed').click()
        self.page.wait_for_timeout(100)
        self.changed(before)
        self.assertNotEqual(self.state()['params']['seed'], seed)
        state = self.state()
        self.assertEqual(state['plants'], sum(state['counts'][:4]))
        self.assertGreater(state['triangles'], state['plants']*20)
        self.assertLessEqual(state['drawCalls'], 20)
        print('Meadow controls:', results, 'stats:', {k: state[k] for k in ['plants', 'triangles', 'drawCalls']})

    def test_species_mix_empty_and_rebuilds(self):
        self.slider('wind', 0)
        species = ['grass', 'clover', 'broadleaf', 'flowers', 'pebbles']
        for name in species:
            before = self.picture()
            self.slider(name, 0)
            self.changed(before, .02)
        self.assertEqual(self.state()['total'], 0)
        self.assertTrue(self.page.locator('#empty').is_visible())
        for i, name in enumerate(species):
            self.slider(name, 100)
            state = self.state()
            self.assertGreater(state['counts'][i], 100)
            self.assertEqual(sum(state['counts']), state['counts'][i])
            self.slider(name, 0)
        for name in species:
            self.slider(name, 40)
        memory = self.state()['geometries']
        for _ in range(8):
            self.page.locator('#new-seed').click()
        self.page.wait_for_timeout(100)
        self.assertEqual(self.state()['geometries'], memory)

    def test_wind_shader_and_reduced_motion(self):
        self.slider('wind', 0)
        before = self.picture()
        self.page.wait_for_timeout(400)
        still = sum(ImageStat.Stat(ImageChops.difference(before, self.picture())).mean)/3
        self.assertLess(still, .005)
        self.slider('wind', 1.7)
        before = self.picture()
        self.page.wait_for_timeout(650)
        changed = self.changed(before, .05)
        self.page.emulate_media(reduced_motion='reduce')
        self.page.wait_for_timeout(100)
        frozen = self.state()['time']
        before = self.picture()
        self.page.wait_for_timeout(300)
        self.assertEqual(self.state()['time'], frozen)
        self.assertIsNone(ImageChops.difference(before, self.picture()).getbbox())
        print(f'Wind pixel difference: {changed}; stopped: {still:.6f}; reduced motion frozen')


if __name__ == '__main__':
    result = unittest.main(verbosity=2, exit=False).result
    raise SystemExit(0 if result.testsRun and result.wasSuccessful() else 1)
