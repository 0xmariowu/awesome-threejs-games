#!/usr/bin/env python3
"""Real pointer input, original CPU ownership and WebGL atlas readback."""
import http.client
import os
from pathlib import Path
import subprocess
import time
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / 'examples/inkwave-paint'
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8119)
URL = f'http://127.0.0.1:{PORT}/'


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


class PaintBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if not (ROOT / 'examples' / Path(__file__).parent.name / 'public/index.html').is_file():
            raise RuntimeError('Build this example with node build.mjs before running browser tests')
        if server_answers():
            raise RuntimeError(f'Port {PORT} is occupied; this test must own its server')
        cls.server = subprocess.Popen(
            ['node', 'tools/server.mjs', 'examples/inkwave-paint'],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
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
        if cls.server and cls.server.poll() is None:
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
        self.context.route('**/*', lambda route: route.continue_()
                           if urlsplit(route.request.url).hostname == '127.0.0.1' else route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(20_000)
        self.errors, self.failed_requests = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text)
                     if message.type == 'error' else None)
        self.page.on('requestfailed', lambda request: self.failed_requests.append(request.url))
        self.page.on('response', lambda response: self.failed_requests.append(str(response.status) + ' ' + response.url)
                     if response.status >= 400 else None)
        self.page.goto(URL, wait_until='networkidle')
        self.page.wait_for_function('window.__example?.ready')

    def tearDown(self):
        with self.subTest(browser_errors=True):
            self.assertEqual(self.errors, [])
            self.assertEqual(self.failed_requests, [])

    def state(self):
        return self.page.evaluate('({...window.__example, probe: undefined, project: undefined})')

    def aim(self, point):
        screen = self.page.evaluate('p => window.__example.project(p)', point)
        self.page.mouse.move(screen['x'], screen['y'])
        self.assertIsNotNone(self.state()['aim'], point)

    def shoot(self, point, milliseconds=450):
        self.aim(point)
        before = self.state()['shots']
        self.page.mouse.down()
        try:
            self.page.wait_for_function('n => window.__example.shots > n', arg=before)
            self.page.wait_for_timeout(milliseconds)
        finally:
            self.page.mouse.up()
        self.page.wait_for_function('window.__example.projectiles === 0 && window.__example.growing === 0')
        self.assertGreater(self.state()['impacts'], 0)

    def probe(self, face_id, point):
        return self.page.evaluate('([id, p]) => window.__example.probe(id, p)', [face_id, point])

    def assert_team_pixel(self, probe, team):
        self.assertEqual(probe['cpu'], team + 1, probe)
        self.assertGreater(probe['gpu'][team], 200, probe)
        self.assertLess(probe['gpu'][1 - team], 40, probe)
        self.assertGreater(probe['gpu'][3], 200, probe)

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "inkwave-paint")

    def test_floor_shots_repaint_cpu_and_gpu_and_clear(self):
        initial = self.state()
        self.assertEqual(initial['coverage'], [0, 0])
        point = [-2, 0, 1]
        before = self.page.locator('#world canvas').screenshot()
        self.shoot(point)
        orange = self.state()
        self.assertGreater(orange['shots'], 1, 'Holding the original trigger repeats shots')
        self.assertGreater(orange['coverage'][0], 0.01)
        self.assertEqual(orange['coverage'][1], 0)
        self.assertAlmostEqual(orange['coverage'][0], orange['counts'][0] / orange['turfTotal'])
        self.assert_team_pixel(self.probe(orange['floor']['id'], point), 0)
        self.assertNotEqual(before, self.page.locator('#world canvas').screenshot())
        self.page.get_by_role('button', name='蓝队', exact=True).click()
        self.shoot(point, 700)
        blue = self.state()
        self.assertGreater(blue['coverage'][1], 0.01)
        self.assertLess(blue['counts'][0], orange['counts'][0])
        self.assert_team_pixel(self.probe(blue['floor']['id'], point), 1)
        self.page.get_by_role('button', name='清空涂色').click()
        self.page.wait_for_function('window.__example.counts.every(n => n === 0)')
        self.assertEqual(self.probe(blue['floor']['id'], point), {'cpu': 0, 'gpu': [0, 0, 0, 0]})
        self.assertEqual(self.state()['wall']['counts'], [0, 0])
        self.page.wait_for_timeout(300)
        self.assertEqual(self.state()['shots'], 0, 'Reset cancels in-flight and held input')

    def test_wall_drips_corner_wrapping_and_screenshot(self):
        self.shoot([2, 2.5, -4.6], 500)
        state = self.state()
        self.assertGreater(state['wall']['counts'][0], 10)
        self.assert_team_pixel(self.probe(state['wall']['id'], [2, 2.5, -4.6]), 0)
        self.page.get_by_role('button', name='蓝队', exact=True).click()
        self.shoot([-3, 0.35, -4.6], 650)
        state = self.state()
        self.assertGreater(state['wall']['counts'][1], 0)
        self.assertGreater(state['floor']['counts'][1], 0)
        self.assert_team_pixel(self.probe(state['wall']['id'], [-3, 0.35, -4.6]), 1)
        self.assert_team_pixel(self.probe(state['floor']['id'], [-3, 0, -4.15]), 1)
        self.shoot([0, 0, 0], 400)
        self.page.get_by_role('button', name='橙队', exact=True).click()
        self.shoot([-4, 0, 1], 450)
        self.shoot([3, 0, 2], 450)
        evidence = ROOT / "output/examples/inkwave-paint"
        evidence.mkdir(parents=True, exist_ok=True)
        self.page.mouse.move(30, 690)
        self.page.screenshot(path=str(evidence / 'paint.png'))

    def test_release_and_pointer_cancel_stop_firing_at_inline_size(self):
        self.page.set_viewport_size({'width': 800, 'height': 1200})
        self.shoot([0, 0, 0], 250)
        count = self.state()['shots']
        self.page.wait_for_timeout(350)
        self.assertEqual(self.state()['shots'], count)
        self.aim([1, 0, 1])
        self.page.mouse.down()
        self.page.wait_for_function('n => window.__example.shots > n', arg=count)
        self.page.locator('#world canvas').dispatch_event('pointercancel')
        count = self.state()['shots']
        self.page.wait_for_timeout(350)
        self.assertEqual(self.state()['shots'], count)
        self.page.mouse.up()
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
