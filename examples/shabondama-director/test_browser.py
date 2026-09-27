#!/usr/bin/env python3
"""Real-input checks for the unmodified Shabondama camera director."""

import http.client
import math
import os
from pathlib import Path
import subprocess
import time
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / 'examples' / 'shabondama-director'
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import assert_picture_size, check_host_languages, available_port, install_frame_test_context

PORT = available_port(8113)
URL = f'http://127.0.0.1:{PORT}'


def server_answers():
    connection = http.client.HTTPConnection('127.0.0.1', PORT, timeout=0.5)
    try:
        connection.request('HEAD', '/')
        connection.getresponse()
        return True
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


class DirectorBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        # Never borrow or terminate someone else's listener.
        if server_answers():
            raise RuntimeError(f'Port {PORT} is occupied; this test must own its server')
        cls.server = subprocess.Popen(
            ['node', 'tools/server.mjs', 'examples/shabondama-director'],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None:
                raise RuntimeError('Example server exited before becoming ready')
            if time.monotonic() >= deadline:
                raise RuntimeError(f'Example server did not start on port {PORT}')
            time.sleep(0.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel='chrome', headless=True,
            args=['--use-angle=metal', '--ignore-gpu-blocklist'],
        )
        cls.addClassCleanup(cls.browser.close)
        (ROOT / "output/examples/shabondama-director").mkdir(parents=True, exist_ok=True)

    @classmethod
    def stop_server(cls):
        if cls.server is not None and cls.server.poll() is None:
            cls.server.terminate()
            try:
                cls.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.server.kill()
                cls.server.wait(timeout=5)

    def setUp(self):
        self.context = self.browser.new_context(locale="zh-CN",
            viewport={'width': 1280, 'height': 1800}, device_scale_factor=1,
            service_workers='block',
        )
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.errors = []
        self.requests_failed = []

        def route_local(route):
            if urlsplit(route.request.url).netloc in (f'127.0.0.1:{PORT}', f'localhost:{PORT}'):
                route.continue_()
            else:
                self.requests_failed.append(route.request.url)
                route.abort()

        self.context.route('**/*', route_local)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text) if message.type == 'error' else None)
        self.page.on('requestfailed', lambda request: self.requests_failed.append(f'{request.url}: {request.failure}'))
        self.page.on('response', lambda response: self.requests_failed.append(f'{response.status} {response.url}') if response.status >= 400 else None)
        self.page.goto(URL, wait_until='networkidle')
        self.page.wait_for_function('window.__example?.frameCount > 2')

    def tearDown(self):
        self.assertEqual(self.errors, [], 'Browser console/page errors')
        self.assertEqual(self.requests_failed, [], 'Failed or external requests')

    def state(self):
        return self.page.evaluate('window.__example')

    def wait_state(self, state, timeout=15000):
        self.page.wait_for_function('state => window.__example.state === state', arg=state, timeout=timeout)
        return self.state()

    def screenshot(self, name):
        self.page.screenshot(path=str(ROOT / "output/examples/shabondama-director" / f'{name}.png'))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "shabondama-director")

    def test_shot_sequence_tracks_bubble_and_cuts_to_another_spot(self):
        opening = self.state()
        self.assertEqual(opening['state'], 'title')
        self.page.get_by_role('button', name='显示取景线').click()
        self.page.locator('#world').click()
        self.wait_state('blow')
        self.wait_state('follow')
        self.page.wait_for_function('window.__example.stateTime > 0.8')
        following = self.state()
        self.assertGreater(following['bubbleCount'], 5)
        self.assertGreater(distance(following['position'], opening['position']), 0.05)
        self.assertLess(abs(following['targetNDC'][0]), 0.6)
        self.assertLess(abs(following['targetNDC'][1]), 0.6)
        self.screenshot('follow')
        ride = self.wait_state('ride')
        self.assertLess(distance(ride['position'], ride['main']['position']), 0.01)
        self.assertGreater(ride['film'], 0.95)
        self.assertGreater(distance(ride['position'], opening['position']), 1)
        self.page.wait_for_timeout(6000)
        drift = self.state()
        self.assertGreater(distance(drift['position'], ride['position']), 0.2)
        self.assertTrue(math.isfinite(drift['focus']) and drift['focus'] > 0)
        self.screenshot('ride')
        popped = self.wait_state('pop', timeout=35000)
        self.assertIn(popped['popReason'], ['age', 'ground', 'tree'])
        self.wait_state('after')
        self.page.wait_for_function("window.__example.state === 'after' && window.__example.fade > 0.3")
        cut = self.wait_state('fadein')
        self.assertNotEqual(cut['spot'], opening['spot'])
        self.assertGreater(distance(cut['position'], popped['position']), 5)
        self.assertGreater(cut['fade'], 0.7)
        self.wait_state('ready')
        states = [item['state'] for item in self.state()['history']]
        self.assertEqual(states[:8], ['title', 'blow', 'follow', 'ride', 'pop', 'after', 'fadein', 'ready'])
        self.screenshot('new-spot')

    def test_drag_handoff_and_idle_return_use_original_blend(self):
        self.page.locator('#world').focus()
        self.page.keyboard.press('Space')
        self.wait_state('ride')
        before = self.state()
        self.page.mouse.move(550, 350)
        self.page.mouse.down()
        try:
            self.page.mouse.move(730, 300, steps=12)
            self.page.wait_for_function('window.__example.manual.active && window.__example.manual.w === 1')
            manual = self.state()
            self.assertGreater(abs(manual['yaw'] - before['yaw']), 0.15)
            self.assertGreater(distance(manual['quaternion'], before['quaternion']), 0.05)
            self.assertAlmostEqual(manual['yaw'], manual['manual']['yaw'], delta=0.001)
        finally:
            self.page.mouse.up()
        self.page.wait_for_function('!window.__example.manual.active')
        self.screenshot('manual')
        self.page.wait_for_timeout(500)
        self.assertEqual(self.state()['manual']['w'], 1, 'Original manual gaze persists after release')
        self.page.wait_for_function('window.__example.manual.w === 0', timeout=16000)
        automatic = self.state()
        self.assertEqual(automatic['state'], 'ride')
        self.assertAlmostEqual(automatic['yaw'], automatic['autoYaw'], delta=0.001)
        self.assertFalse(automatic['manual']['keys'])

    def test_arrow_keys_slow_motion_and_restart(self):
        self.page.locator('#world').focus()
        before = self.state()
        self.page.keyboard.down('ArrowLeft')
        self.page.wait_for_function('window.__example.manual.keys && window.__example.manual.w === 1')
        self.page.wait_for_timeout(350)
        self.page.keyboard.up('ArrowLeft')
        self.page.wait_for_function('!window.__example.manual.keys')
        self.assertGreater(self.state()['yaw'] - before['yaw'], 0.25)
        self.page.keyboard.down('ArrowUp')
        self.page.wait_for_timeout(350)
        self.page.keyboard.up('ArrowUp')
        self.assertGreater(self.state()['pitch'] - before['pitch'], 0.15)
        self.page.keyboard.press('Enter')
        self.wait_state('blow')
        self.page.get_by_role('button', name='慢动作', exact=True).click()
        self.page.wait_for_function('window.__example.timeScale === 0.25')
        start = self.state()['time']
        self.page.wait_for_timeout(1000)
        elapsed = self.state()['time'] - start
        self.assertGreater(elapsed, 0.12)
        self.assertLess(elapsed, 0.4)
        self.page.get_by_role('button', name='慢动作', exact=True).click()
        self.page.wait_for_function('window.__example.timeScale === 1')
        self.page.get_by_role('button', name='重新开始').click()
        self.wait_state('restart')
        self.wait_state('title')
        self.assertNotEqual(self.state()['spot'], before['spot'])
        self.assertEqual(self.state()['manual']['w'], 0)
        self.page.locator('#world').click()
        self.wait_state('follow')

    def test_inline_16_by_9_frame_accepts_input(self):
        # A real HTTP parent supplies Chrome's loopback address-space metadata;
        # opaque/synthetic documents trigger local-network access checks.
        # localhost vs 127.0.0.1 exercises the library's cross-origin boundary.
        self.page.goto(f'http://localhost:{PORT}/test/iframe.html')
        frame = self.page.frame_locator('iframe')
        canvas = frame.locator('#world')
        canvas.wait_for()
        box = canvas.bounding_box()
        picture_size = assert_picture_size(self, frame, 800)
        canvas.click()
        inner = self.page.frames[1]
        inner.wait_for_function("window.__example?.state === 'follow'")
        self.assertAlmostEqual(inner.evaluate('window.__example.aspect'), picture_size[0] / picture_size[1])
        self.page.keyboard.down('ArrowRight')
        try:
            inner.wait_for_function('window.__example.manual.keys && window.__example.manual.w === 1')
        finally:
            self.page.keyboard.up('ArrowRight')
        inner.wait_for_function('!window.__example.manual.keys')
        self.screenshot('inline')


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    if program.result.testsRun == 0:
        raise SystemExit('No browser tests ran')
    raise SystemExit(0 if program.result.wasSuccessful() else 1)
