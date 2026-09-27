#!/usr/bin/env python3
"""Run real pointer/keyboard input in installed Chrome; own the local server."""
import http.client
import os
from pathlib import Path
import subprocess
import time
import unittest
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / 'examples/vox-reactions'
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import assert_picture_size, check_host_languages, available_port, install_frame_test_context

PORT = available_port(8117)
URL = f'http://127.0.0.1:{PORT}'


def server_answers():
    connection = http.client.HTTPConnection('127.0.0.1', PORT, timeout=1)
    try:
        connection.request('HEAD', '/')
        connection.getresponse()
        return True
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


class ReactionsBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if server_answers():
            raise RuntimeError(f'Port {PORT} is occupied; this test must own its server')
        cls.server = subprocess.Popen(
            ['node', 'tools/server.mjs', 'examples/vox-reactions'], cwd=ROOT,
            env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Example server failed to start')
            time.sleep(0.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(channel='chrome', headless=True)
        cls.addClassCleanup(cls.browser.close)

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
        self.context = self.browser.new_context(locale="zh-CN", viewport={'width': 960, 'height': 1800}, service_workers='block')
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.errors, self.failed = [], []
        self.context.route('**/*', lambda route: route.continue_()
                           if urlsplit(route.request.url).netloc == f'127.0.0.1:{PORT}' else route.abort())
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text) if message.type == 'error' else None)
        self.page.on('requestfailed', lambda request: self.failed.append(request.url))
        self.page.on('response', lambda response: self.failed.append(response.url) if response.status >= 400 else None)
        self.page.goto(URL, wait_until='networkidle')
        self.page.wait_for_function('window.__example?.hp === 600')

    def tearDown(self):
        self.assertEqual(self.errors, [], 'Console/page errors')
        self.assertEqual(self.failed, [], 'Failed or external requests')

    def state(self):
        return self.page.evaluate('window.__example')

    def pause(self):
        self.page.locator('#pause').click()
        self.assertTrue(self.state()['paused'])

    def cast(self, element):
        self.page.locator('[data-element="%s"]' % element).click()
        before = self.state()['casts']
        self.page.locator('#world').click()
        self.assertEqual(self.state()['casts'], before + 1)

    def screenshot(self, name):
        folder = ROOT / "output/examples/vox-reactions"
        folder.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(folder / (name + '.png')))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "vox-reactions")

    def test_direction_changes_damage(self):
        self.pause()
        self.cast('fire'); self.cast('water')
        self.assertEqual(self.state()['lastCast']['reaction'], 'Vaporize')
        self.assertAlmostEqual(self.state()['hp'], 534)
        self.page.locator('#reset').click()
        self.cast('water'); self.cast('fire')
        self.assertAlmostEqual(self.state()['hp'], 545)
        self.assertAlmostEqual(self.state()['lastCast']['damage'], 33)

    def test_freeze_and_shatter(self):
        self.pause()
        self.cast('water'); self.cast('ice')
        self.assertAlmostEqual(self.state()['frozen'], 3)
        self.assertFalse(self.state()['canAct'])
        self.page.wait_for_timeout(750)
        self.screenshot('freeze')
        self.cast('earth')
        self.assertEqual(self.state()['lastCast']['reaction'], 'Shatter')
        self.assertAlmostEqual(self.state()['lastCast']['damage'], 48.4)
        self.assertTrue(self.state()['canAct'])

    def test_burn_and_shock_tick(self):
        self.pause()
        self.cast('fire'); self.cast('earth')
        self.assertEqual(self.state()['dots'][0]['el'], 'fire')
        self.assertAlmostEqual(self.state()['lastCast']['damage'], 49.28)
        self.page.wait_for_timeout(750)
        self.screenshot('burn')
        before = self.state()['hp']
        self.page.locator('#pause').click()
        self.page.wait_for_function('window.__example.hits.some(hit => hit.dot)')
        self.assertLess(self.state()['hp'], before)
        self.pause(); self.page.locator('#reset').click()
        self.cast('water'); self.cast('lightning')
        self.assertAlmostEqual(self.state()['lastCast']['damage'], 27.5)
        self.assertEqual(self.state()['dots'][0]['el'], 'lightning')
        self.page.wait_for_timeout(750)
        self.screenshot('shock')
        self.page.locator('#pause').click()
        self.page.wait_for_function('window.__example.hits.some(hit => hit.dot)')
        ticks = [hit for hit in self.state()['hits'] if hit['dot']]
        self.assertAlmostEqual(ticks[0]['damage'], 13)

    def test_expiration_and_pause(self):
        self.pause(); self.cast('water'); self.cast('ice')
        frozen = self.state()['frozen']
        self.page.wait_for_timeout(300)
        self.assertEqual(self.state()['frozen'], frozen)
        self.page.locator('#pause').click()
        self.page.wait_for_function('window.__example.canAct', timeout=6000)
        self.assertLessEqual(self.state()['frozen'], 0)
        self.page.locator('#reset').click()
        self.cast('fire')
        self.page.wait_for_function('window.__example.aura === null', timeout=10000)

    def test_hold_keyboard_and_reset(self):
        self.pause()
        self.page.locator('#world').hover(position={'x': 600, 'y': 190})
        self.page.mouse.down()
        try:
            self.page.wait_for_timeout(950)
        finally:
            self.page.mouse.up()
        count = self.state()['casts']
        self.assertGreaterEqual(count, 3)
        self.assertAlmostEqual(self.state()['hp'], 600 - 22 * count)
        self.page.wait_for_timeout(500)
        self.assertEqual(self.state()['casts'], count)
        self.page.keyboard.press('Space')
        self.assertEqual(self.state()['casts'], count + 1)
        self.page.locator('#reset').click()
        self.assertEqual(self.state()['hp'], 600)
        self.assertIsNone(self.state()['aura'])
        self.assertIsNone(self.state()['lastCast'])

    def test_small_iframe_layout_and_all_elements(self):
        self.page.set_viewport_size({'width': 640, 'height': 1200})
        self.pause()
        for element in ['fire', 'water', 'ice', 'lightning', 'earth', 'arcane']:
            self.page.locator('#reset').click()
            self.cast(element)
            self.assertAlmostEqual(self.state()['hp'], 578)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight'))
        self.screenshot('compact')

    def test_embedded_16_by_9_frame(self):
        self.page.set_viewport_size({'width': 1024, 'height': 680})
        self.page.goto(URL + '/test/iframe.html', wait_until='networkidle')
        self.page.wait_for_function('document.querySelector("iframe").contentWindow.__example?.hp === 600')
        frame = self.page.frames[1]
        frame.locator('#pause').click()
        for element in ['water', 'ice']:
            frame.locator('[data-element="%s"]' % element).click()
            frame.locator('#world').click()
        state = frame.evaluate('window.__example')
        self.assertEqual(state['lastCast']['reaction'], 'Frozen')
        self.assertAlmostEqual(state['hp'], 556)
        assert_picture_size(self, frame, 960)
        frame.wait_for_function('() => document.documentElement.scrollHeight <= innerHeight + 1')
        self.assertTrue(frame.evaluate('document.documentElement.scrollHeight <= innerHeight + 1'))
        self.page.wait_for_timeout(1300)
        self.screenshot('iframe')


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
