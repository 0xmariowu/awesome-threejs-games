#!/usr/bin/env python3
"""Real keyboard checks against the original SCORCH simulation in installed Chrome."""
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
EXAMPLE = ROOT / 'examples/scorch-racing'
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8115)
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


class ScorchBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (ROOT / 'examples' / Path(__file__).parent.name / 'public/index.html').is_file():
            raise RuntimeError('Build this example with node build.mjs before running browser tests')
        if server_answers():
            raise RuntimeError(f'Port {PORT} is occupied; this test must own its server')
        cls.server = subprocess.Popen(
            ['node', 'tools/server.mjs', 'examples/scorch-racing'], cwd=ROOT,
            env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Example server failed to start')
            time.sleep(0.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel='chrome', headless=True,
            args=['--use-angle=metal', '--ignore-gpu-blocklist'],
        )
        cls.addClassCleanup(cls.browser.close)

    @classmethod
    def stop_server(cls):
        if cls.server.poll() is None:
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
        self.external = []
        def local_only(route):
            if urlsplit(route.request.url).hostname == '127.0.0.1':
                route.continue_()
            else:
                self.external.append(route.request.url)
                route.abort()
        self.context.route('**/*', local_only)
        self.page = self.context.new_page()
        self.errors = []
        self.failed = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text) if message.type == 'error' else None)
        self.page.on('response', lambda response: self.failed.append(response.url) if response.status >= 400 else None)
        self.page.on('requestfailed', lambda request: self.failed.append(request.url))
        self.page.goto(URL, wait_until='load')
        self.view = self.page
        self.page.wait_for_function('window.__example?.ready', timeout=30000)
        self.page.locator('canvas').click()

    def tearDown(self):
        self.assertEqual(self.errors, [], 'Console/page errors')
        self.assertEqual(self.failed, [], 'Failed requests')
        self.assertEqual(self.external, [], 'External requests')

    def state(self):
        return self.view.evaluate('window.__example')

    def advance(self, seconds):
        target = self.state()['time'] + seconds
        self.view.wait_for_function('t => window.__example.time >= t', arg=target, timeout=20000)
        return self.state()

    def hold(self, keys, seconds):
        for key in keys:
            self.page.keyboard.down(key)
        try:
            return self.advance(seconds)
        finally:
            for key in keys:
                self.page.keyboard.up(key)

    def reset(self):
        self.view.get_by_role('button', name='重新出发').click()
        self.view.wait_for_function('window.__example.time < 0.5 && Math.abs(window.__example.speed) < 0.01')

    def screenshot(self, name):
        folder = ROOT / "output/examples/scorch-racing"
        folder.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(folder / name))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "scorch-racing")

    def test_throttle_coast_brake_reverse(self):
        before = self.state()
        self.advance(0.2)
        self.assertAlmostEqual(self.state()['speed'], 0, delta=0.01)
        moving = self.hold(['KeyW'], 1)
        self.assertGreater(moving['speed'], 90)
        self.assertGreater(math.hypot(moving['position']['x'] - before['position']['x'],
                                      moving['position']['z'] - before['position']['z']), 40)
        self.assertGreater(moving['progress'], before['progress'] + 40)
        coasting = self.advance(0.4)
        self.assertGreater(coasting['speed'], 0)
        self.assertLess(coasting['speed'], moving['speed'])
        reverse = self.hold(['KeyS'], 1.3)
        self.assertLess(reverse['speed'], -10)
        self.assertGreaterEqual(reverse['speed'], -40.1)

    def test_boost_changes_acceleration_and_consumes_energy(self):
        normal = self.hold(['KeyW'], 0.9)
        self.reset()
        before = self.state()
        boosted = self.hold(['KeyW', 'ShiftLeft'], 0.9)
        self.assertTrue(boosted['boosting'])
        self.assertGreater(boosted['boostStrength'], 0.8)
        self.assertGreater(boosted['speed'], normal['speed'] * 1.4)
        self.assertLess(boosted['boostEnergy'], before['boostEnergy'] - 0.2)
        recovered = self.advance(0.5)
        self.assertFalse(recovered['boosting'])
        self.assertGreater(recovered['boostEnergy'], boosted['boostEnergy'])
        self.assertLess(recovered['boostStrength'], 0.1)

    def test_steering_banks_and_slides_in_both_directions(self):
        for key, sign in [('KeyA', 1), ('KeyD', -1)]:
            with self.subTest(direction=key):
                self.reset()
                before = self.hold(['KeyW'], 0.8)
                turning = self.hold(['KeyW', key], 0.55)
                self.assertGreater((turning['heading'] - before['heading']) * sign, 0.2)
                self.assertGreater(turning['yawRate'] * sign, 0.5)
                self.assertGreater(abs(turning['lateralVelocity']), 3)
                self.assertLess(turning['roll'] * sign, -0.15)
                self.assertLess(turning['visualRoll'] * sign, -0.1)
                if key == 'KeyA':
                    self.screenshot('banking.png')

    def test_offroad_and_barrier_remain_active(self):
        self.hold(['KeyW'], 0.9)
        self.page.keyboard.down('KeyW')
        self.page.keyboard.down('KeyA')
        try:
            self.page.wait_for_function('window.__example.offRoad', timeout=10000)
            off = self.state()
            self.assertGreater(abs(off['lateralOffset']), 30)
            state = self.advance(1)
            self.assertLessEqual(abs(state['lateralOffset']), 68.01)
            self.assertTrue(math.isfinite(state['speed']))
        finally:
            self.page.keyboard.up('KeyW')
            self.page.keyboard.up('KeyA')

    def test_slow_motion_helpers_and_reset(self):
        self.page.get_by_role('button', name='慢动作').click()
        self.page.wait_for_function('window.__example.timeScale === 0.25')
        before = self.state()['time']
        self.page.wait_for_timeout(800)
        elapsed = self.state()['time'] - before
        self.assertGreater(elapsed, 0.05)
        self.assertLess(elapsed, 0.4)
        self.page.get_by_role('button', name='显示方向').click()
        self.page.wait_for_function('window.__example.helpersVisible')
        self.hold(['KeyW', 'KeyD'], 0.7)
        self.screenshot('helpers.png')
        self.reset()
        self.assertAlmostEqual(self.state()['speed'], 0, delta=0.01)

    def test_input_inside_16_by_9_iframe(self):
        self.page.route('**/__iframe', lambda route: route.fulfill(
            content_type='text/html', body='<button>Outside frame</button><br><iframe name="technique" title="example" src="' + URL + '/" style="width:960px;height:540px;border:0"></iframe>'))
        self.page.goto(URL + '/__iframe', wait_until='load')
        self.view = self.page.frame(name='technique')
        self.assertIsNotNone(self.view)
        self.view.wait_for_function('window.__example?.ready', timeout=30000)
        self.view.locator('canvas').click()
        moving = self.hold(['ArrowUp', 'ArrowRight', 'Space'], 0.65)
        self.assertGreater(moving['speed'], 90)
        self.assertLess(moving['yawRate'], -0.5)
        self.assertTrue(moving['boosting'])
        self.screenshot('iframe.png')
        self.page.keyboard.down('ArrowUp')
        self.page.get_by_role('button', name='Outside frame').click()
        self.view.wait_for_function('window.__example.input.thr === 0')
        self.page.keyboard.up('ArrowUp')


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
