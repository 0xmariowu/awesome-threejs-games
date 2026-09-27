#!/usr/bin/env python3
"""Exercise original terrain streaming with real keyboard and pointer input."""
import http.client
import json
import math
import os
from pathlib import Path
import subprocess
import time
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / 'examples/monolith-terrain'
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8123)
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


class TerrainBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if server_answers():
            raise RuntimeError(f'Port {PORT} is occupied; this test must own its server')
        cls.server = subprocess.Popen(
            ['node', 'tools/server.mjs', 'examples/monolith-terrain'],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
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
        cls.server.terminate()
        try:
            cls.server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait(timeout=5)

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "monolith-terrain")

    def test_iframe_flight(self):
        context = self.browser.new_context(locale="zh-CN", viewport={'width': 1100, 'height': 1800}, service_workers='block')
        self.addCleanup(context.close)
        errors, failures = [], []
        context.route('**/*', lambda route: route.continue_()
                      if urlsplit(route.request.url).hostname == '127.0.0.1'
                      else route.abort())
        page = context.new_page()
        page.on('requestfailed', lambda request: failures.append(request.url))
        page.on('response', lambda response: failures.append(f'{response.status} {response.url}')
                if response.status >= 400 and urlsplit(response.url).hostname == '127.0.0.1' else None)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text)
                if message.type == 'error' else None)
        # A local parent fixture matches the library's 16:9 iframe and permissions.
        page.route(URL + '/frame-test', lambda route: route.fulfill(
            content_type='text/html', body='<!doctype html><link rel="icon" href="data:,">'
            '<iframe title="Terrain" src="/index.html" '
            'sandbox="allow-scripts allow-same-origin allow-pointer-lock" '
            'allow="fullscreen; autoplay" allowfullscreen '
            'style="width:960px;height:540px;border:0"></iframe>'))
        page.goto(URL + '/frame-test')
        frame = page.frames[1]
        frame.wait_for_function('window.__example?.state?.terrain.workers > 0', timeout=120000)
        frame.get_by_role('button', name='回到起点', exact=True).click()
        frame.wait_for_timeout(200)
        before = frame.evaluate('window.__example.state.position')
        page.keyboard.down('Space')
        try:
            frame.wait_for_function('y => window.__example.state.position[1] > y + 40',
                                    arg=before[1], timeout=10000)
        finally:
            page.keyboard.up('Space')
        self.assertGreater(frame.evaluate('window.__example.state.frame'), 0)
        self.assertEqual(frame.evaluate('window.__example.state.errors'), [])
        self.assertEqual(errors, [])
        self.assertEqual(failures, [])

    def test_original_worker_streaming_and_controls(self):
        context = self.browser.new_context(locale="zh-CN",
            viewport={'width': 1280, 'height': 1800}, device_scale_factor=1,
            service_workers='block',
        )
        self.addCleanup(context.close)
        errors, failures, requests = [], [], []
        context.route('**/*', lambda route: route.continue_()
                      if urlsplit(route.request.url).hostname == '127.0.0.1'
                      else route.abort())
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text)
                if message.type == 'error' else None)
        page.on('requestfailed', lambda request: failures.append(request.url))
        page.on('response', lambda response: failures.append(f'{response.status} {response.url}')
                if response.status >= 400 else None)
        page.on('request', lambda request: requests.append(request.url))
        page.goto(URL, wait_until='domcontentloaded')
        page.wait_for_function('window.__example?.state?.terrain.workers > 0', timeout=120000)
        # Let the original scheduler refine the host's starting camera position.
        page.wait_for_timeout(1500)
        page.wait_for_function('window.__example.state.jobs.pending === 0', timeout=60000)
        state = lambda: page.evaluate('window.__example.state')
        before = state()
        self.assertEqual(sorted(before['modules']), ['controls', 'terrain'])
        self.assertGreater(before['terrain']['drawnChunks'], 0)
        self.assertGreater(before['terrain']['computedSamples'], 0)
        self.assertGreater(before['jobs']['chunkCompleted'], 0)
        self.assertEqual(len(before['tiles']), before['terrain']['displayed'])
        shots = ROOT / "output/examples/monolith-terrain"
        shots.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(shots / 'terrain.png'))

        page.get_by_role('button', name='慢速任务', exact=True).click()
        page.wait_for_function('window.__example.state.slowJobs')
        page.keyboard.down('KeyW')
        page.keyboard.down('ShiftLeft')
        try:
            page.wait_for_function(
                'p => Math.hypot(...window.__example.state.position.map((v,i) => v-p[i])) > 500',
                arg=before['position'], timeout=30000,
            )
            page.wait_for_function(
                'n => window.__example.state.jobs.chunkCompleted > n + 8',
                arg=before['jobs']['chunkCompleted'], timeout=30000,
            )
            page.wait_for_function('window.__example.state.jobs.pending > 0', timeout=30000)
            page.screenshot(path=str(shots / 'streaming.png'))
            page.wait_for_timeout(1500)
            moving = state()
        finally:
            page.keyboard.up('KeyW')
            page.keyboard.up('ShiftLeft')
        self.assertGreater(math.dist(before['position'], moving['position']), 100)
        self.assertGreater(moving['speed'], 100)
        self.assertGreater(moving['terrain']['jobs'], before['terrain']['jobs'])
        self.assertNotEqual(before['tiles'], moving['tiles'])
        self.assertGreater(moving['terrain']['drawnChunks'], 0)
        page.wait_for_function('window.__example.state.jobs.pending === 0', timeout=60000)

        page.mouse.move(470, 330)
        page.mouse.down()
        try:
            page.mouse.move(710, 360, steps=24)
        finally:
            page.mouse.up()
        page.wait_for_function(
            'q => window.__example.state.quaternion.some((v,i) => Math.abs(v-q[i]) > .05)',
            arg=moving['quaternion'],
        )
        page.get_by_role('button', name='地形线框', exact=True).click()
        page.wait_for_function('window.__example.state.wireframe')
        page.screenshot(path=str(shots / 'wireframe.png'))
        page.get_by_role('button', name='地形线框', exact=True).click()
        page.wait_for_function('!window.__example.state.wireframe')
        page.get_by_role('button', name='慢速任务', exact=True).click()
        page.wait_for_function('!window.__example.state.slowJobs')
        page.get_by_role('button', name='回到起点', exact=True).click()
        page.wait_for_function(
            'p => window.__example.state.position.every((v,i) => Math.abs(v-p[i]) < .1)',
            arg=before['position'],
        )
        page.wait_for_function('window.__example.state.jobs.pending === 0', timeout=60000)
        after = state()
        self.assertGreater(after['frame'], moving['frame'])
        self.assertEqual(after['jobs']['failed'], 0)
        self.assertEqual(after['jobs']['submitted'], after['jobs']['completed'])
        self.assertEqual(after['errors'], [])
        self.assertEqual(errors, [])
        self.assertEqual(failures, [])
        loaded = {urlsplit(url).path.rsplit('/', 1)[-1] for url in requests if '/original/' in url}
        self.assertTrue({'index-DGqtqlWq.js', 'terrain-MmovLCQt.js',
                         'controls-DX7CeMlr.js'} <= loaded)
        self.assertFalse(any(name.startswith(('water-', 'sky-', 'hud-', 'tour-', 'postfx-')) for name in loaded))
        print(json.dumps({'distance': math.dist(before['position'], moving['position']),
                          'worker_chunks_before': before['jobs']['chunkCompleted'],
                          'worker_chunks_after': after['jobs']['chunkCompleted'],
                          'workers': after['terrain']['workers'],
                          'displayed_chunks': after['terrain']['displayed'],
                          'errors': errors}))


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
