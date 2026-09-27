#!/usr/bin/env python3
"""Exercise the bilingual fishing host with real browser input."""
import http.client
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context
PORT = available_port(8102)
URL = f'http://127.0.0.1:{PORT}'


class FishingBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = subprocess.Popen(['node', 'tools/server.mjs', 'examples/tidewater-fishing'],
                                      cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL)
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 15
        while True:
            connection = http.client.HTTPConnection('127.0.0.1', PORT, timeout=1)
            try:
                connection.request('HEAD', '/')
                connection.getresponse()
                break
            except OSError:
                if cls.server.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('Fishing server did not start')
                time.sleep(.1)
            finally:
                connection.close()
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

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, 'tidewater-fishing')

    def test_reel_pause_and_reset(self):
        page = self.browser.new_page()
        self.addCleanup(page.close)
        page.goto(URL + '?lang=en')
        page.locator('#reel').focus()
        page.keyboard.down('Space')
        page.wait_for_timeout(500)
        self.assertEqual(page.locator('#reel').get_attribute('aria-pressed'), 'true')
        page.keyboard.up('Space')
        self.assertEqual(page.locator('#reel').get_attribute('aria-pressed'), 'false')
        page.locator('#pause').click()
        before = page.locator('#time').inner_text()
        page.wait_for_timeout(200)
        self.assertEqual(page.locator('#time').inner_text(), before)
        self.assertEqual(page.locator('#outcome').inner_text(), 'Paused')
        page.locator('#reset').click()
        self.assertIn('New fight', page.locator('#message').inner_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
