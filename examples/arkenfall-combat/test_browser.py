#!/usr/bin/env python3
"""Real-input tests of Arkenfall's original combat in installed Chrome."""

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
EXAMPLE = ROOT / "examples" / "arkenfall-combat"
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8116)
URL = f"http://127.0.0.1:{PORT}"


def server_answers():
    connection = http.client.HTTPConnection("127.0.0.1", PORT, timeout=0.5)
    try:
        connection.request("HEAD", "/")
        connection.getresponse()
        return True
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


class CombatBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if server_answers():
            raise RuntimeError(f"Port {PORT} is occupied; this test must own its server")
        cls.server = subprocess.Popen(
            ["node", "tools/server.mjs", "examples/arkenfall-combat"],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None:
                raise RuntimeError("Example server exited before becoming ready")
            if time.monotonic() >= deadline:
                raise RuntimeError("Example server failed to start")
            time.sleep(0.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-angle=metal", "--ignore-gpu-blocklist"],
        )
        # Contexts close after each test. Playwright.stop owns final browser cleanup;
        # its driver closes all browsers with a bounded process-exit fallback.
        (ROOT / "output/examples/arkenfall-combat").mkdir(parents=True, exist_ok=True)

    @classmethod
    def stop_server(cls):
        if cls.server is not None and cls.server.poll() is None:
            cls.server.terminate()
            try:
                cls.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.server.kill()
                cls.server.wait(timeout=5)

    @classmethod
    def tearDownClass(cls):
        # Release the reserved port before Chrome shutdown, which can stall on macOS.
        cls.stop_server()

    def setUp(self):
        self.context = self.browser.new_context(locale="zh-CN",
            viewport={"width": 1280, "height": 1800}, device_scale_factor=1,
            service_workers="block",
        )
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.errors = []
        self.failed_requests = []
        self.context.route("**/*", lambda route: route.continue_()
                           if urlsplit(route.request.url).hostname == "127.0.0.1"
                           else route.abort())
        self.page = self.context.new_page()
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", lambda message: self.errors.append(message.text)
                     if message.type == "error" else None)
        self.page.on("requestfailed", lambda request: self.failed_requests.append(request.url))
        self.page.on("response", lambda response: self.failed_requests.append(f"{response.status} {response.url}")
                     if response.status >= 400 and urlsplit(response.url).hostname == "127.0.0.1" else None)
        self.page.goto(URL, wait_until="networkidle")
        self.page.wait_for_function("window.__example?.ready", timeout=15000)

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failed_requests, [])

    def state(self):
        return self.page.evaluate("window.__example")

    def wait(self, expression, timeout=12000):
        self.page.wait_for_function("() => " + expression, timeout=timeout)
        return self.state()

    def click_scene(self, button="left"):
        self.page.locator("#world").click(button=button)

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "arkenfall-combat")

    def test_load_and_swing(self):
        before = self.state()
        self.assertEqual(before["hitCount"], 0)
        self.assertTrue(before["mount"])
        self.page.get_by_role("button", name="慢动作", exact=True).click()
        self.click_scene()
        hit = self.wait("window.__example.hitCount === 1")
        self.assertEqual(hit["hits"][0]["tag"], "light1")
        self.assertLess(hit["targetHealth"], before["targetHealth"])
        self.assertNotEqual(hit["bladeTip"], before["bladeTip"])
        self.page.screenshot(path=str(ROOT / "output/examples/arkenfall-combat" / "swing.png"))
        self.wait("window.__example.move === '-'")
        self.assertEqual(self.state()["hitCount"], 1, "A sweep must hit this target only once")

    def test_buffered_four_hit_chain_and_grace_expiry(self):
        self.page.get_by_role("button", name="慢动作", exact=True).click()
        self.click_scene()
        for combo in range(1, 4):
            self.wait(f"window.__example.combo === {combo} && window.__example.progress > .36")
            self.assertFalse(self.state()["canCancel"])
            self.click_scene()
            queued = self.wait("window.__example.buffer?.intent === 'attack'")
            self.assertFalse(queued["canCancel"])
            self.wait(f"window.__example.combo === {combo + 1}")
        self.wait("window.__example.hitCount === 4")
        self.page.screenshot(path=str(ROOT / "output/examples/arkenfall-combat" / "combo.png"))
        self.wait("window.__example.move === '-' && window.__example.combo === 0")
        state = self.state()
        self.assertEqual([hit["tag"] for hit in state["hits"]], ["light1", "light2", "light3", "light4"])
        self.assertEqual(len({hit["attack"] for hit in state["hits"]}), 4)
        self.assertIn("staggered", [hit["outcome"] for hit in state["hits"]])
        self.assertTrue(any(abs(v) > 0 for v in state["hits"][1]["velocity"]))
        self.assertGreater(state["playerPosition"][2], -1, "Original root motion must move the player")
        self.click_scene()
        self.wait("window.__example.move === 'light1'")

    def test_input_buffer_expires_when_pressed_too_early(self):
        self.page.get_by_role("button", name="慢动作", exact=True).click()
        self.click_scene()
        # light1 cannot cancel until .2808 s. Queue within its first 25 ms,
        # so the original .25 s buffer expires before cancellation opens.
        self.wait("window.__example.move === 'light1'")
        self.page.mouse.click(650, 360)
        queued = self.wait("window.__example.buffer !== null")
        self.assertLess(queued["progress"], .05)
        self.wait("window.__example.move === '-'")
        self.assertEqual(len(self.state()["attacks"]), 1)

    def test_heavy_charge_releases_original_level_three_move(self):
        self.page.mouse.move(650, 360)
        self.page.mouse.down(button="right")
        try:
            self.wait("window.__example.chargeLevel === 3")
            self.assertEqual(self.state()["move"], "heavyCharge")
            self.assertEqual(self.state()["hitCount"], 0)
        finally:
            self.page.mouse.up(button="right")
        self.wait("window.__example.hits.some(hit => hit.tag === 'heavy')")
        state = self.state()
        self.assertGreater(state["hits"][0]["amount"], 12)
        self.assertEqual(state["attacks"][-1]["charge"], 1)

    def test_parry_timing_miss_success_and_riposte(self):
        self.page.get_by_role("button", name="招架练习", exact=True).click()
        # Button returns keyboard focus to the scene. F is the original binding.
        self.page.keyboard.press("KeyF")
        early = self.wait("window.__example.parryWindow > 0")
        self.assertLessEqual(early["parryWindow"], .18)
        self.wait("window.__example.misses === 1")
        self.assertEqual(self.state()["parries"], 0)
        self.page.get_by_role("button", name="慢动作", exact=True).click()
        self.wait("window.__example.strikeIn < .12")
        self.page.keyboard.press("KeyF")
        self.wait("window.__example.parries === 1")
        self.page.screenshot(path=str(ROOT / "output/examples/arkenfall-combat" / "parry.png"))
        self.assertEqual(self.state()["misses"], 1)
        self.assertGreater(self.state()["riposte"], 0)
        self.wait("window.__example.canCancel || window.__example.move === '-'")
        self.click_scene()
        self.wait("window.__example.move === 'riposte'")
        self.wait("window.__example.hits.some(hit => hit.tag === 'riposte')")

    def test_helpers_time_scale_and_small_viewport(self):
        self.page.get_by_role("button", name="挥击轨迹", exact=True).click()
        self.wait("!window.__example.helpers")
        before = self.state()["time"]
        self.page.wait_for_timeout(600)
        normal = self.state()["time"] - before
        self.page.get_by_role("button", name="慢动作", exact=True).click()
        self.wait("window.__example.timeScale === .25")
        before = self.state()["time"]
        self.page.wait_for_timeout(600)
        slow = self.state()["time"] - before
        self.assertGreater(slow, .05)
        self.assertLess(slow, normal * .5)
        self.page.set_viewport_size({"width": 800, "height": 1200})
        self.page.get_by_role("button", name="重新站位", exact=True).click()
        self.assertAlmostEqual(self.state()["playerPosition"][2], -1, delta=.01)
        self.assertEqual(self.page.evaluate("document.documentElement.scrollWidth"), 800)
        self.page.screenshot(path=str(ROOT / "output/examples/arkenfall-combat" / "inline-size.png"))

    def test_real_input_inside_16_by_9_iframe(self):
        self.page.goto(URL + "/test/iframe.html", wait_until="networkidle")
        frame = self.page.frame(name="technique")
        self.assertIsNotNone(frame)
        frame.wait_for_function("window.__example?.ready")
        frame.get_by_role("button", name="慢动作", exact=True).click()
        frame.locator("#world").click()
        frame.wait_for_function("window.__example.hitCount === 1")
        size = frame.locator(".demo-picture").bounding_box()
        self.assertAlmostEqual(size["width"] / size["height"], 16 / 9)
        self.page.screenshot(path=str(ROOT / "output/examples/arkenfall-combat" / "iframe.png"))


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
