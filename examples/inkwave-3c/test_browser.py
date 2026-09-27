#!/usr/bin/env python3
"""Real input acceptance for the unchanged INKWAVE locomotion/camera modules."""
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
EXAMPLE = ROOT / 'examples/inkwave-3c'
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import assert_picture_size, check_host_languages, available_port, install_frame_test_context

PORT = available_port(8124)
URL = f'http://127.0.0.1:{PORT}'


def server_answers():
    connection = http.client.HTTPConnection('127.0.0.1', PORT, timeout=.5)
    try:
        connection.request('HEAD', '/')
        connection.getresponse()
        return True
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


class InkwaveBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if server_answers():
            raise RuntimeError(f'Port {PORT} is occupied; this test must own its server')
        cls.server = subprocess.Popen(
            ['node', 'tools/server.mjs', 'examples/inkwave-3c'], cwd=ROOT,
            env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Example server failed to start')
            time.sleep(.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel='chrome', headless=True,
            args=['--use-angle=metal', '--ignore-gpu-blocklist'],
        )
        cls.addClassCleanup(cls.browser.close)

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        try:
            cls.server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait(timeout=5)

    def setUp(self):
        self.context = self.browser.new_context(locale="zh-CN", viewport={'width': 1280, 'height': 1800}, service_workers='block')
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.page.set_default_timeout(15_000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda msg: self.errors.append(msg.text) if msg.type == 'error' else None)
        self.page.on('requestfailed', lambda req: self.errors.append(req.url + ': ' + str(req.failure)))
        self.page.on('response', lambda response: self.errors.append(f'HTTP {response.status}: {response.url}') if response.status >= 400 else None)
        self.context.route('**/*', lambda route: route.continue_() if urlsplit(route.request.url).hostname == '127.0.0.1' else route.abort())
        self.addCleanup(self.assert_no_errors)

    def assert_no_errors(self):
        self.assertEqual(self.errors, [], '\n'.join(self.errors))

    def open(self):
        self.page.goto(URL)
        self.page.wait_for_function('window.__example?.time > .7')
        self.assertTrue(self.page.locator('#error').is_hidden())
        return self.state()

    def state(self):
        return self.page.evaluate('window.__example')

    def wait(self, predicate):
        self.page.wait_for_function('() => { const s = window.__example; return s && (' + predicate + '); }')
        return self.state()

    def screenshot(self, name):
        directory = ROOT / "output/examples/inkwave-3c"
        directory.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(directory / (name + '.png')))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "inkwave-3c")

    def test_run_jump_land_and_brake(self):
        before = self.open()
        self.assertTrue(before['grounded'])
        self.assertLess(before['speed'], .01)
        self.screenshot('idle')
        self.page.keyboard.down('KeyW')
        moving = self.wait('s.position.z > 0 && s.speed > 5.5')
        self.assertGreater(moving['camera']['z'] - before['camera']['z'], 3)
        self.assertLess(abs(moving['projected']['x']), .5)
        self.assertLess(abs(moving['projected']['y']), 1)
        self.screenshot('run')
        self.page.keyboard.down('Space')
        jumping = self.wait('!s.grounded && s.position.y > .8 && s.velocity.y > 0')
        self.assertEqual(jumping['jumps'], 1)
        self.screenshot('jump')
        self.page.keyboard.up('Space')
        self.page.keyboard.up('KeyW')
        landed = self.wait('s.grounded && s.speed < .05')
        self.assertAlmostEqual(landed['position']['y'], 0, delta=.02)

    def test_dry_squid_swim_and_emerge(self):
        self.open()
        self.page.keyboard.down('ShiftLeft')
        self.page.keyboard.down('KeyW')
        dry = self.wait('s.animation === "squid" && s.speed > 2.5')
        self.assertFalse(dry['submerged'])
        self.assertLess(dry['speed'], 3.1)
        swimming = self.wait('s.animation === "swim" && s.submerged && s.speed > 10.5')
        self.assertEqual(swimming['groundTeam'], 1)
        self.assertGreater(swimming['speed'], dry['speed'] * 3)
        self.assertLess(abs(swimming['projected']['y']), 1)
        self.screenshot('swim')
        self.page.keyboard.up('ShiftLeft')
        emerged = self.wait('s.form === "kid" && s.speed < 6.2')
        self.assertFalse(emerged['submerged'])
        self.page.keyboard.up('KeyW')

    def test_mouse_look_and_camera_relative_movement(self):
        self.open()
        self.page.locator('canvas').click()
        capture = self.wait('s.locked || s.pointerLockUnavailable')
        before = self.state()
        if not capture['locked']:
            self.page.mouse.down()
        self.page.mouse.move(940, 380, steps=12)
        if not capture['locked']:
            self.page.mouse.up()
        turned = self.wait(f'Math.abs(s.cameraYaw - {before["cameraYaw"]}) > .3')
        self.assertNotEqual(turned['cameraPitch'], before['cameraPitch'])
        self.page.keyboard.down('KeyW')
        moved = self.wait('s.speed > 5.5 && s.position.z > -1')
        self.page.keyboard.up('KeyW')
        self.assertGreater(abs(moved['position']['x']), 1)
        self.assertGreater(math.dist(list(moved['camera'].values()), list(before['camera'].values())), 2)
        self.assertLess(abs(moved['projected']['x']), .5)
        self.page.keyboard.press('Escape')
        self.wait('!s.locked')

    def test_original_camera_retracts_at_wall_and_recovers(self):
        before = self.open()
        self.page.keyboard.down('KeyS')
        close = self.wait('s.position.z < -10.5 && s.cameraDistance < 2')
        self.page.keyboard.up('KeyS')
        self.assertGreater(close['position']['z'], -12)
        self.assertGreater(close['camera']['z'], -12.2)
        self.assertLess(close['cameraDistance'], before['cameraDistance'] - 2)
        self.screenshot('camera-wall')
        self.page.keyboard.down('KeyW')
        self.wait('s.position.z > -4 && s.cameraDistance > 4')
        self.page.keyboard.up('KeyW')

    def test_slow_motion_and_reset(self):
        self.open()
        start = self.state()['time']
        self.page.wait_for_timeout(1000)
        normal = self.state()['time'] - start
        self.page.get_by_role('button', name='慢动作').click()
        self.wait('s.timeScale === .25')
        start = self.state()['time']
        self.page.wait_for_timeout(1000)
        slow = self.state()['time'] - start
        self.assertGreater(normal, .6)
        self.assertGreater(slow, .05)
        self.assertLess(slow, normal * .5)
        self.page.keyboard.down('KeyW')
        self.wait('s.position.z > -3')
        self.page.keyboard.up('KeyW')
        self.page.get_by_role('button', name='回到起点').click()
        reset = self.wait('s.position.z < -3.9 && s.speed < .05')
        self.assertAlmostEqual(reset['position']['x'], 0, delta=.02)

    def test_inline_16_by_9_iframe(self):
        self.page.route(URL + '/embed-test', lambda route: route.fulfill(content_type='text/html',
            body='<iframe title="移动示例" src="' + URL + '" width="960" height="540" allow="pointer-lock"></iframe>'))
        self.page.goto(URL + '/embed-test')
        frame = self.page.frame_locator('iframe')
        frame.locator('canvas').wait_for()
        child = self.page.frames[1]
        child.wait_for_function('window.__example?.time > .7')
        assert_picture_size(self, child, 960)
        self.assertTrue(child.evaluate('document.documentElement.scrollHeight <= innerHeight + 1'))
        frame.locator('canvas').click()
        child.wait_for_function('window.__example.locked || window.__example.pointerLockUnavailable')
        self.page.keyboard.down('KeyW')
        child.wait_for_function('window.__example.position.z > -1')
        self.page.keyboard.up('KeyW')
        self.assertGreater(child.evaluate('window.__example.speed'), 5)
        self.screenshot('iframe')


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
