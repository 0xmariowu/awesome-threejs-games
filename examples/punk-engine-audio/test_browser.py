#!/usr/bin/env python3
"""Exercise unchanged worklets and real controls in installed Chrome."""
import http.client
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'examples/_shared'))
import ui_browser
from ui_browser import available_port, check_host_languages, install_frame_test_context
PORT = available_port(8130)
URL = f'http://127.0.0.1:{PORT}'
SHOT = Path('/private/tmp/claude-501/-Users-vimala/5258cabc-626a-402d-b921-71f034ba10e0/scratchpad/shots/punk-engine-audio.png')


def answers():
    c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=1)
    try:
        c.request('HEAD', '/')
        return c.getresponse().status == 200
    except (OSError, http.client.HTTPException):
        return False
    finally:
        c.close()


class EngineBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if answers():
            raise RuntimeError('Test must own its server')
        cls.server = subprocess.Popen(['node', 'tools/server.mjs', 'examples/punk-engine-audio'],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL)
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 15
        while not answers():
            if cls.server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Server failed to start')
            time.sleep(.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(channel='chrome', headless=True)
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
        self.context = self.browser.new_context(locale='en-US', viewport={'width':1280,'height':800}, service_workers='block')
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.errors, self.failed, self.external, self.requests = [], [], [], []
        def local(route):
            if urlsplit(route.request.url).hostname == '127.0.0.1':
                route.continue_()
            else:
                self.external.append(route.request.url)
                route.abort()
        self.context.route('**/*', local)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('console', lambda m: self.errors.append(m.text) if m.type == 'error' else None)
        self.page.on('response', lambda r: self.failed.append(r.url) if r.status >= 400 else None)
        self.page.on('requestfailed', lambda r: self.failed.append(r.url))
        self.page.on('request', lambda r: self.requests.append(r.url))
        self.page.goto(URL+'/?lang=en&theme=dark')
        self.page.wait_for_function('window.__example?.ready')

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failed, [])
        self.assertEqual(self.external, [])
        self.assertFalse(any('/assets/index-' in url for url in self.requests))
        self.assertIsNone(self.state().get('audio', {}).get('error') if self.state().get('audio') else None)

    def state(self):
        return self.page.evaluate('window.__example')

    def start(self):
        self.page.locator('#start').click()
        self.page.wait_for_function('window.__example.running && window.__example.audio?.worklets.sampler.rms > .001 && window.__example.audio.rms > .001')

    def test_languages_themes(self):
        with patch.object(ui_browser, '__file__', str(SHOT.parent / 'ui/examples/_shared/ui_browser.py')):
            check_host_languages(self, self.browser, URL, 'punk-engine-audio')
        # Exercise dynamic translations and audio in all four combinations.
        for lang in ['zh','en']:
            for theme in ['light','dark']:
                self.page.goto(URL+f'/?lang={lang}&theme={theme}')
                self.start()
                self.assertEqual(self.page.locator('#start').inner_text(), '暂停声音' if lang == 'zh' else 'Pause audio')
                self.page.locator('#start').click()
                self.page.wait_for_function('!window.__example.running')

    def test_worklets_rpm_load_and_turbo_output(self):
        self.assertFalse(self.state()['running'])
        self.assertGreater(self.page.locator('#voice').bounding_box()['width'], 140)
        self.assertFalse(any('worklet-' in u for u in self.requests))
        self.start()
        self.page.wait_for_timeout(400)
        idle = self.state()['audio']
        self.page.keyboard.down('KeyW')
        self.page.wait_for_function('window.__example.rpm > 6500 && window.__example.spin > .6')
        high = self.state()
        for voice in ['sampler','synth']:
            before, after = idle['worklets'][voice], high['audio']['worklets'][voice]
            self.assertGreater(after['parameters']['rpm'], before['parameters']['rpm']+4000)
            self.assertGreater(after['parameters']['load'], .9)
            self.assertGreater(after['parameters']['throttle'], .9)
            self.assertGreater(after['rms'], .001)
        self.assertGreater(high['audio']['worklets']['sampler']['rms'], idle['worklets']['sampler']['rms']*1.3)
        self.assertGreater(high['audio']['rms'], idle['rms']*1.3)
        SHOT.parent.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(SHOT))
        self.page.keyboard.up('KeyW')
        self.page.wait_for_function('window.__example.audio.releases === 1 && window.__example.audio.turboRms > .001')
        lift = self.state()
        self.page.wait_for_function('window.__example.audio.worklets.sampler.parameters.load < .05')
        print('\nAudio evidence: '+json.dumps({'idleRms':idle['rms'],'loadedRms':high['audio']['rms'],
            'idleSamplerRms':idle['worklets']['sampler']['rms'],'loadedSamplerRms':high['audio']['worklets']['sampler']['rms'],
            'loadedParameters':high['audio']['worklets']['sampler']['parameters'],'turboRms':lift['audio']['turboRms']}))
        self.assertEqual(set(high['audio']['worklets']), {'sampler', 'synth'})
        self.page.locator('#voice').select_option('synth')
        self.page.wait_for_function('window.__example.audio.mode === "synth" && window.__example.audio.rms > .001')

    def test_gear_buttons_keyboard_and_limiter(self):
        self.start()
        self.page.keyboard.down('KeyW')
        self.page.wait_for_function('window.__example.rpm > 5500')
        before = self.state()['rpm']
        self.page.keyboard.press('KeyE')
        self.page.wait_for_function('window.__example.gear === 2')
        self.assertLess(self.state()['rpm'], before*.85)
        self.page.wait_for_timeout(180)
        self.page.locator('#down').click()
        self.page.wait_for_function('window.__example.gear === 1')
        self.page.wait_for_function('window.__example.limiterCuts >= 4')
        self.assertLessEqual(self.state()['rpm'], 7860)
        self.assertGreater(self.state()['rpm'], 7400)
        self.page.keyboard.up('KeyW')
        self.page.locator('#start').click()
        self.page.wait_for_function('!window.__example.running && window.__example.audio.context === "suspended"')
        self.assertEqual(self.state()['throttle'], 0)
        self.start()

    def test_slider_drive_and_mobile(self):
        self.start()
        self.page.locator('#throttle').focus()
        self.page.keyboard.press('End')
        self.page.wait_for_function('window.__example.throttle === 1 && window.__example.rpm > 1800')
        self.page.keyboard.press('Home')
        self.page.wait_for_function('window.__example.throttle === 0')
        self.page.locator('#drive').click()
        self.page.wait_for_function('window.__example.gear >= 3', timeout=15000)
        self.assertTrue(self.state()['auto'])
        self.page.locator('#drive').click()
        self.page.wait_for_function('!window.__example.auto && window.__example.throttle === 0')
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.assertTrue(self.page.locator('#start').is_visible())
        self.page.screenshot(path=str(SHOT.with_name('punk-engine-audio-mobile.png')), full_page=True)

    def assert_throttle_display(self):
        sample = self.page.evaluate("""() => ({effective: window.__example.throttle,
            slider: Number(document.querySelector('#throttle').value),
            label: document.querySelector('#throttle-value').textContent})""")
        self.assertAlmostEqual(sample['slider'], sample['effective'], places=2)
        self.assertEqual(sample['label'], f"{round(sample['effective'] * 100)}%")

    def test_effective_throttle_display_and_drag(self):
        self.assert_throttle_display()
        self.page.keyboard.down('KeyW')
        self.page.wait_for_function('window.__example.throttle === 1')
        self.assert_throttle_display()
        self.page.keyboard.up('KeyW')
        self.page.wait_for_function('window.__example.throttle === 0')
        self.assert_throttle_display()
        self.page.locator('#drive').click()
        self.page.wait_for_function('window.__example.auto && window.__example.throttle === 1')
        self.assert_throttle_display()
        self.page.wait_for_function('window.__example.coast && window.__example.throttle === 0', timeout=30000)
        self.assert_throttle_display()
        # Actual pointer drag takes over from the automatic sweep.
        box = self.page.locator('#throttle').bounding_box()
        self.page.mouse.move(box['x'] + 8, box['y'] + box['height']/2)
        self.page.mouse.down()
        self.page.mouse.move(box['x'] + box['width']*.6, box['y'] + box['height']/2, steps=8)
        self.page.mouse.up()
        self.page.wait_for_function('!window.__example.auto && window.__example.throttle > .45 && window.__example.throttle < .75')
        self.assert_throttle_display()
        manual = self.state()['throttle']
        self.page.keyboard.down('KeyW')
        self.page.wait_for_function('window.__example.throttle === 1')
        self.assert_throttle_display()
        self.page.keyboard.up('KeyW')
        self.page.wait_for_function('value => window.__example.throttle === value', arg=manual)
        self.assert_throttle_display()

    def test_iframe_focus_loss_releases_throttle(self):
        self.page.route('**/__iframe', lambda route: route.fulfill(content_type='text/html',
            body='<button id="outside">Outside</button><iframe name="demo" src="'+URL+'/?lang=en" style="width:960px;height:540px;border:0"></iframe>'))
        self.page.goto(URL+'/__iframe')
        frame = self.page.frame(name='demo')
        frame.wait_for_function('window.__example?.ready')
        frame.locator('#start').click()
        frame.wait_for_function('window.__example.running')
        frame.locator('#instrument').click()
        self.page.keyboard.down('KeyW')
        frame.wait_for_function('window.__example.rpm > 2000')
        self.page.locator('#outside').click()
        frame.wait_for_function('window.__example.throttle === 0 && !window.__example.auto')
        self.page.keyboard.up('KeyW')
        # Restore the regular host for the common error/telemetry checks.
        self.page.goto(URL)
        self.page.wait_for_function('window.__example?.ready')


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
