#!/usr/bin/env python3
"""Original Tupi modules: owned server, installed Chrome, real input and pixels."""
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from urllib.request import urlopen
from urllib.parse import urlsplit
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
NAME = Path(__file__).resolve().parent.name
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import available_port, check_host_languages, assert_picture_size
PORT = available_port(8131)
URL = f'http://127.0.0.1:{PORT}'
SHOTS = Path('/private/tmp/claude-501/-Users-vimala/5258cabc-626a-402d-b921-71f034ba10e0/scratchpad/shots')

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = subprocess.Popen(['node', 'tools/server.mjs', 'examples/' + NAME], cwd=ROOT,
            env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL)
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 15
        while True:
            try:
                with urlopen(URL, timeout=1): break
            except OSError:
                if cls.server.poll() is not None or time.monotonic() > deadline: raise RuntimeError('Server did not start')
                time.sleep(.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(channel='chrome', headless=True,
            args=['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'])
        cls.addClassCleanup(cls.browser.close)
        SHOTS.mkdir(parents=True, exist_ok=True)

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        try: cls.server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server.kill(); cls.server.wait(timeout=5)

    def open(self):
        context = self.browser.new_context(locale='en-US', viewport={'width':1280, 'height':900}, service_workers='block')
        self.addCleanup(context.close)
        context.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).hostname == '127.0.0.1' else route.abort())
        self.page = context.new_page()
        self.errors, self.requests = [], set()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text) if message.type == 'error' else None)
        self.page.on('response', lambda response: self.errors.append(f'HTTP {response.status} {response.url}') if response.status >= 400 else None)
        self.page.on('request', lambda request: self.requests.add(urlsplit(request.url).path))
        self.addCleanup(lambda: self.assertEqual(self.errors, []))
        self.page.goto(URL + '/?lang=en&theme=dark')
        self.ready()
        self.assertEqual(self.state()['backend'], 'WebGPU')
        assert_picture_size(self, self.page, 1280)

    def ready(self):
        self.page.wait_for_function('window.__example?.ready', timeout=60000)
        self.page.wait_for_timeout(250)

    def state(self): return self.page.evaluate('window.__example')

    def picture(self):
        return Image.open(io.BytesIO(self.page.locator('canvas').screenshot())).convert('RGB')

    def assert_changed(self, before, after, minimum=.15):
        delta = sum(ImageStat.Stat(ImageChops.difference(before, after)).mean) / 3
        self.assertGreater(delta, minimum)
        print(f'{NAME}: canvas mean absolute difference {delta:.3f}', flush=True)

    def slider(self, selector, end):
        control = self.page.locator(selector)
        control.focus(); self.page.keyboard.press(end)
        self.page.wait_for_timeout(200)

    def orbit(self):
        before = self.state()['camera']
        bounds = self.page.locator('canvas').bounding_box()
        self.page.mouse.move(bounds['x'] + bounds['width']*.5, bounds['y'] + bounds['height']*.5)
        self.page.mouse.down(); self.page.mouse.move(bounds['x'] + bounds['width']*.65, bounds['y'] + bounds['height']*.6, steps=12); self.page.mouse.up()
        self.page.wait_for_timeout(200)
        self.assertNotEqual(before, self.state()['camera'])

    def test_languages_and_themes(self):
        # This test opens only one WebGPU context at a time.
        check_host_languages(self, self.browser, URL, NAME)

    def test_controls_and_picture(self):
        self.open()
        self.page.locator('#pause').check()
        self.page.wait_for_timeout(150)
        baseline = self.picture()
        self.assertGreater(sum(ImageStat.Stat(baseline).stddev), 15)
        self.assertEqual(self.errors, [])
        self.slider('#rain', 'Home')
        dry = self.picture()
        self.slider('#rain', 'End')
        self.assertEqual(self.state()['rain'], 1)
        wet = self.picture()
        self.assert_changed(dry, wet)
        # Restrict to the lower water surface to distinguish ripples from falling rain.
        box = (100, int(wet.height*.6), wet.width-100, wet.height-10)
        self.assert_changed(dry.crop(box), wet.crop(box))
        self.slider('#mist', 'Home')
        clear = self.picture()
        self.slider('#mist', 'End')
        self.assertEqual(self.state()['mist'], 4)
        self.assert_changed(clear, self.picture())
        self.page.locator('#light').select_option('8')
        self.page.wait_for_timeout(200)
        dark = self.picture()
        self.page.locator('#light').select_option('160')
        self.page.wait_for_timeout(200)
        self.assert_changed(dark, self.picture())
        self.page.locator('#light').select_option('60')
        self.slider('#mist', 'Home')
        for _ in range(10): self.page.keyboard.press('ArrowRight')
        self.page.wait_for_timeout(200)
        self.page.screenshot(path=str(SHOTS / (NAME + '.png')))
        before_orbit = self.picture()
        self.orbit()
        self.assert_changed(before_orbit, self.picture())
        self.assertFalse(any('/main-' in url for url in self.requests))
        print(json.dumps(self.state(), sort_keys=True), flush=True)
        self.page.set_viewport_size({'width':390, 'height':900})
        self.page.wait_for_timeout(200)
        assert_picture_size(self, self.page, 390)

if __name__ == '__main__': unittest.main(verbosity=2)
