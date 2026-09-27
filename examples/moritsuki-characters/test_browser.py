#!/usr/bin/env python3
"""Run original workers in installed headless Chrome; own the local server."""
import http.client
import os
from pathlib import Path
import subprocess
import time
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8127)
URL = f'http://127.0.0.1:{PORT}'
SHOTS = ROOT / 'output/examples/moritsuki-characters'


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


class CharacterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if server_answers():
            raise RuntimeError(f'Port {PORT} is occupied; test must own its server')
        cls.server = subprocess.Popen(
            ['node', 'tools/server.mjs', 'examples/moritsuki-characters'],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
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
        SHOTS.mkdir(parents=True, exist_ok=True)

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
            viewport={'width': 960, 'height': 1800}, device_scale_factor=1,
            service_workers='block',
        )
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.context.route('**/*', lambda route: route.continue_()
                           if urlsplit(route.request.url).hostname == '127.0.0.1'
                           else route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(120_000)
        self.errors, self.workers, self.failed_requests = [], [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text)
                     if message.type in ('error', 'warning') else None)
        self.page.on('worker', lambda worker: self.workers.append(worker.url))
        self.page.on('requestfailed', lambda request: self.failed_requests.append(request.url))
        self.page.on('response', lambda response: self.failed_requests.append(f'{response.status} {response.url}')
                     if response.status >= 400 and urlsplit(response.url).hostname == '127.0.0.1' else None)

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failed_requests, [])

    def state(self):
        return self.page.evaluate('window.__example')

    def wait_ready(self):
        self.page.wait_for_function('window.__example?.ready || window.__example?.error')
        state = self.state()
        self.assertIsNone(state['error'])
        self.assertGreater(state['triangles'], 1000)
        self.assertGreater(state['bytes'], 10000)
        self.assertEqual(state['workerCompleted'], state['workerStarted'])
        self.assertEqual(state['activeWorkers'], 0)
        self.assertGreater(state['framesDuringBuild'], 2)
        self.assertEqual(state['workerErrors'], [])
        for low, high in zip(state['bounds']['min'], state['bounds']['max']):
            self.assertLess(low, high)
            self.assertGreater(low, -3)
            self.assertLess(high, 3)
        return state

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "moritsuki-characters")

    def test_original_designs_repeat_and_interact(self):
        self.page.goto(URL)
        initial = self.wait_ready()
        self.assertEqual(initial['workerStarted'], 7)
        self.assertEqual(initial['character'], 'natsumi')
        self.page.screenshot(path=str(SHOTS / 'natsumi.png'))
        self.page.get_by_role('button', name='重新生成').click()
        repeated = self.wait_ready()
        self.assertEqual(repeated['generation'], initial['generation'] + 1)
        self.assertEqual(repeated['parts'], initial['parts'])
        self.assertEqual(repeated['bounds'], initial['bounds'])
        for character, jobs in [('isogai', 7), ('kid', 4)]:
            self.page.get_by_label('选择角色').select_option(character)
            state = self.wait_ready()
            self.assertEqual(state['character'], character)
            self.assertEqual(state['workerStarted'], jobs)
            self.assertNotEqual(state['parts'], initial['parts'])
            self.page.screenshot(path=str(SHOTS / f'{character}.png'))
        before = self.state()
        self.page.mouse.move(420, 270)
        self.page.mouse.down()
        self.page.mouse.move(590, 270, steps=12)
        self.page.mouse.up()
        self.assertGreater(abs(self.state()['yaw'] - before['yaw']), 1)
        self.page.mouse.wheel(0, -160)
        self.page.wait_for_function('d => window.__example.distance < d', arg=before['distance'])
        self.page.get_by_role('button', name='显示线框').click()
        self.assertTrue(self.state()['wireframe'])
        self.assertGreater(self.state()['wireframeMeshes'], 0)
        self.page.wait_for_function('f => window.__example.frames > f + 2', arg=self.state()['frames'])
        self.page.screenshot(path=str(SHOTS / 'wireframe.png'))
        self.assertEqual(len(self.workers), 25)
        self.assertTrue(all('/original/' in url and url.endswith('.worker.js') for url in self.workers))

    def test_cancel_restart_while_main_thread_responds(self):
        self.page.goto(URL)
        self.page.wait_for_function('window.__example?.activeWorkers > 0')
        before = self.state()
        self.page.get_by_role('button', name='显示线框').click()
        self.assertTrue(self.state()['wireframe'])
        self.page.get_by_label('选择角色').select_option('isogai')
        self.page.wait_for_function('window.__example.character === "isogai"')
        self.assertGreater(self.state()['cancelledWorkers'], 0)
        self.page.screenshot(path=str(SHOTS / 'generating.png'))
        final = self.wait_ready()
        self.assertEqual(final['generation'], before['generation'] + 1)
        self.assertEqual(final['character'], 'isogai')
        self.assertGreater(final['frames'], before['frames'])
        self.assertTrue(final['wireframe'])

    def test_inline_iframe(self):
        # A localhost parent matches the library's secure context. An about:blank
        # parent disables SubtleCrypto even in a localhost child iframe.
        self.page.route(URL + '/iframe-test', lambda route: route.fulfill(
            content_type='text/html', body=f'<iframe title="角色工坊" src="{URL}" '
            'style="border:0;width:960px;height:540px"></iframe>'))
        self.page.goto(URL + '/iframe-test')
        self.page.wait_for_function('document.querySelector("iframe").contentWindow !== null')
        frame = self.page.locator('iframe').element_handle().content_frame()
        frame.wait_for_function('window.__example?.ready')
        self.assertEqual(frame.evaluate('window.__example.character'), 'natsumi')
        frame.get_by_label('选择角色').select_option('kid')
        frame.wait_for_function('window.__example?.ready && window.__example.character === "kid"')
        self.assertEqual(frame.evaluate('window.__example.workerCompleted'), 4)
        self.assertGreater(frame.evaluate('window.__example.triangles'), 1000)


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
