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
EXAMPLE = ROOT / 'examples/scorch-race-ai'
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8118)
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
            ['node', 'tools/server.mjs', 'examples/scorch-race-ai'], cwd=ROOT,
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
        self.page.locator('#world').click()

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
        # Capture one coherent first-frame snapshot before browser round trips let
        # the live race accelerate again. Keep exercising the real reset button.
        self.view.evaluate('''() => {
            window.__resetSnapshot = null;
            document.querySelector('#reset').addEventListener('click', () => {
                requestAnimationFrame(() => window.__resetSnapshot = structuredClone(window.__example));
            }, {once: true});
        }''')
        self.view.get_by_role('button', name='重新出发').click()
        self.view.wait_for_function('window.__example.time < 0.5')
        self.view.wait_for_function('window.__resetSnapshot !== null')
        return self.view.evaluate('window.__resetSnapshot')

    def screenshot(self, name):
        folder = ROOT / "output/examples/scorch-race-ai"
        folder.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(folder / name))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "scorch-race-ai")

    def test_ai_races_and_targets_extend_with_speed(self):
        self.reset()
        before = self.state()
        moving = self.advance(3)
        self.assertEqual(len(moving['racers']), 6)
        self.assertEqual(moving['visibleTargets'], 6)
        for start, racer in zip(before['racers'], moving['racers']):
            self.assertGreater(racer['speed'], 100)
            self.assertGreater(racer['progress'] - start['progress'], 150)
            self.assertGreater(racer['target']['look'], 65)
            self.assertTrue(all(math.isfinite(v) for v in racer['position'].values()))
            self.assertGreater(math.hypot(racer['target']['x'] - racer['position']['x'],
                                          racer['target']['z'] - racer['position']['z']), 50)
        self.screenshot('racing-targets.png')

    def test_takeover_uses_original_keyboard_inputs_then_ai_resumes(self):
        self.advance(1)
        self.page.get_by_role('button', name='接管飞梭').click()
        speed_before_braking = self.state()['racers'][0]['speed']
        braking = self.hold(['KeyS'], 1.2)
        self.assertTrue(braking['manual'])
        self.assertEqual(braking['visibleTargets'], 5)
        self.assertEqual(braking['racers'][0]['input']['brk'], 1)
        self.assertLess(braking['racers'][0]['speed'], 15)
        self.assertLess(braking['racers'][0]['speed'], speed_before_braking - 50)
        before = braking['racers'][0]
        driving = self.hold(['KeyW', 'KeyA', 'ShiftLeft'], 0.8)
        pod = driving['racers'][0]
        self.assertGreater(pod['speed'], 80)
        self.assertGreater(pod['heading'] - before['heading'], 0.2)
        self.assertTrue(pod['boosting'])
        self.assertLess(pod['boostEnergy'], before['boostEnergy'])
        self.assertTrue(all(r['target'] for r in driving['racers'][1:]))
        self.page.get_by_role('button', name='接管飞梭').click()
        self.page.wait_for_function('!window.__example.manual && window.__example.visibleTargets === 6')
        resumed = self.advance(1)
        self.assertIsNotNone(resumed['racers'][0]['target'])
        self.assertGreater(resumed['racers'][0]['progress'], pod['progress'] + 50)
        self.assertNotEqual(resumed['racers'][0]['heading'], pod['heading'])

    def test_slow_motion_helpers_follow_and_reset(self):
        self.page.get_by_role('button', name='慢动作').click()
        self.page.wait_for_function('window.__example.timeScale === 0.25')
        before = self.state()['time']
        self.page.wait_for_timeout(800)
        elapsed = self.state()['time'] - before
        self.assertGreater(elapsed, 0.05)
        self.assertLess(elapsed, 0.4)
        self.page.get_by_role('button', name='目标点', exact=True).click()
        self.page.wait_for_function('window.__example.visibleTargets === 0')
        self.page.get_by_role('button', name='目标点', exact=True).click()
        self.page.wait_for_function('window.__example.visibleTargets === 6')
        self.page.get_by_role('button', name='跟随 4 号飞梭').click()
        self.page.wait_for_function('window.__example.selected === 3')
        reset_state = self.reset()
        self.assertLess(reset_state['time'], 0.5)
        self.assertTrue(all(r['speed'] < 30 for r in reset_state['racers']))

    def test_input_inside_16_by_9_iframe(self):
        self.page.route('**/__iframe', lambda route: route.fulfill(
            content_type='text/html', body='<button>Outside frame</button><br><iframe name="technique" title="example" src="' + URL + '/" style="width:960px;height:540px;border:0"></iframe>'))
        self.page.goto(URL + '/__iframe', wait_until='load')
        self.view = self.page.frame(name='technique')
        self.assertIsNotNone(self.view)
        self.view.wait_for_function('window.__example?.ready', timeout=30000)
        self.advance(1.5)
        self.screenshot('iframe.png')
        self.view.get_by_role('button', name='接管飞梭').click()
        moving = self.hold(['ArrowUp', 'ArrowRight', 'Space'], 0.6)
        self.assertEqual(moving['racers'][0]['input']['steer'], -1)
        self.assertTrue(moving['racers'][0]['boosting'])
        self.page.keyboard.down('ArrowUp')
        self.page.get_by_role('button', name='Outside frame').click()
        self.view.wait_for_function('window.__example.racers[0].input.thr === 0')
        self.page.keyboard.up('ArrowUp')


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
