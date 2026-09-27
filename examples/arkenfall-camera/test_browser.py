#!/usr/bin/env python3
"""Real-input tests of Arkenfall's unchanged camera in installed Chrome."""

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
EXAMPLE = ROOT / "examples" / "arkenfall-camera"
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8112)
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


class CameraBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if server_answers():
            raise RuntimeError(f"Port {PORT} is occupied; this test must own its server")
        cls.server = subprocess.Popen(
            ["node", "tools/server.mjs", "examples/arkenfall-camera"],
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
        (ROOT / "output/examples/arkenfall-camera").mkdir(parents=True, exist_ok=True)

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
        self.page.on("response", lambda response: self.failed_requests.append(response.url)
                     if response.status >= 400 else None)
        self.page.goto(URL, wait_until="networkidle")
        self.page.wait_for_function("window.__example && window.__example.time > 0.3")

    def tearDown(self):
        with self.subTest(browser_errors=True):
            self.assertEqual(self.errors, [])
            self.assertEqual(self.failed_requests, [])

    def state(self):
        return self.page.evaluate("window.__example")

    def focus(self):
        self.page.locator("#world").click()

    def lock(self):
        self.focus()
        self.page.keyboard.press("Tab")
        self.page.wait_for_function("window.__example.locked")
        self.page.wait_for_timeout(1500)

    def screenshot(self, name):
        self.page.screenshot(path=str(ROOT / "output/examples/arkenfall-camera" / (name + ".png")))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "arkenfall-camera")

    def test_lock_unlock_drag_and_movement(self):
        self.assertFalse(self.state()["locked"])
        self.focus()
        before = self.state()
        self.page.mouse.move(500, 400)
        self.page.mouse.down()
        self.page.mouse.move(800, 420, steps=20)
        self.page.mouse.up()
        self.page.wait_for_function("yaw => Math.abs(window.__example.yaw-yaw) > 0.4", arg=before["yaw"])
        self.assertGreater(abs(self.state()["pitch"] - before["pitch"]), 0.01)
        self.page.get_by_role("button", name="回到起点").click()
        self.lock()
        self.screenshot("locked")
        self.assertTrue(self.state()["locked"])
        before_move = self.state()["player"]
        self.page.keyboard.down("KeyW")
        try:
            self.page.wait_for_timeout(650)
        finally:
            self.page.keyboard.up("KeyW")
        after_move = self.state()["player"]
        # Locked W moves toward the target at 3 units/s; only strafing is circular.
        self.assertGreater(math.dist(before_move, after_move), 1.0)
        self.assertLess(math.hypot(after_move[0], after_move[2]),
                        math.hypot(before_move[0], before_move[2]) - 1.0)
        self.assertTrue(self.state()["locked"])
        self.page.mouse.click(600, 380, button="middle")
        self.page.wait_for_function("!window.__example.locked")
        self.assertFalse(self.state()["locked"])

    def test_circle_wall_tree_and_recovery(self):
        self.lock()
        initial = self.state()
        samples = []
        captured = set()
        self.page.keyboard.down("KeyD")
        try:
            # One full circuit of the radius-six fixture; collect real camera state.
            deadline = time.monotonic() + 22
            while self.state()["time"] - initial["time"] < 13:
                self.page.wait_for_timeout(80)
                state = self.state()
                samples.append(state)
                if "wall" not in captured and state["desiredArmLength"] - state["armLength"] > 2:
                    self.screenshot("wall")
                    captured.add("wall")
                if "tree" not in captured and abs(state["lockDodge"]) > 0.1:
                    self.screenshot("tree")
                    captured.add("tree")
                if time.monotonic() > deadline:
                    self.fail("Circle did not complete within the real-time budget")
        finally:
            self.page.keyboard.up("KeyD")
        self.assertGreater(len(samples), 50)
        self.assertEqual(captured, {"wall", "tree"})
        self.screenshot("recovered")
        shortened = [s for s in samples if s["desiredArmLength"] - s["armLength"] > 1]
        self.assertTrue(shortened, "The wall must shorten the original camera arm")
        self.assertTrue(any(abs(s["lockDodge"]) > 0.03 for s in samples), "The original trunk solver must change the locked camera angle")
        self.assertLess(samples[-1]["desiredArmLength"] - samples[-1]["armLength"], 0.2)
        self.assertLess(abs(samples[-1]["lockDodge"]), 0.01)
        tree_index = next(i for i, s in enumerate(samples) if abs(s["lockDodge"]) > 0.1)
        self.assertTrue(any(0.3 < s["desiredArmLength"] - s["armLength"] < 1.5
                            for s in samples[tree_index + 1:]), "The arm must extend through intermediate distances")
        # At 80 ms sampling intervals, recovery must not teleport the camera.
        self.assertLess(max(math.dist(a["camera"], b["camera"])
                            for a, b in zip(samples[tree_index:], samples[tree_index + 1:])), 2)
        self.assertEqual(samples[-1]["recoveries"], 0, "No non-finite state recovery should be needed")
        self.assertGreater(max(s["player"][0] for s in samples), 5)
        self.assertLess(min(s["player"][0] for s in samples), -5)
        self.assertGreater(max(s["player"][2] for s in samples), 5)
        for state in samples:
            self.assertTrue(state["locked"])
            self.assertTrue(all(math.isfinite(v) for v in state["camera"]))
            self.assertLess(abs(state["targetNDC"][0]), 0.95)
            self.assertLess(abs(state["targetNDC"][1]), 0.95)
            self.assertLess(state["targetNDC"][2], 1)
            self.assertGreater(state["targetNDC"][2], -1)
            # Keep the camera's 0.08 near plane outside the visible wall/trunk.
            x, y, z = state["camera"]
            wall_clearance = math.hypot(max(abs(x + 8.4) - 0.3, 0),
                                        max(abs(z + 7) - 3, 0))
            self.assertGreater(wall_clearance, 0.08)
            self.assertGreater(math.hypot(x + 10, z - 2), 0.65 + 0.08)

    def test_helpers_reset_and_small_frame(self):
        self.page.set_viewport_size({"width": 800, "height": 1200})
        self.lock()
        self.page.keyboard.down("KeyD")
        self.page.wait_for_timeout(700)
        self.page.keyboard.up("KeyD")
        self.page.get_by_role("button", name="俯视辅助").click()
        self.page.wait_for_function("!window.__example.helpers")
        self.assertFalse(self.page.locator("#map").is_visible())
        self.page.get_by_role("button", name="回到起点").click()
        self.page.wait_for_function("!window.__example.locked && window.__example.player[0] === 0")
        self.assertEqual(self.state()["player"], [0, 0, -6])
        self.assertEqual(self.page.evaluate("document.documentElement.scrollWidth"), 800)
        self.screenshot("small-frame")


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
