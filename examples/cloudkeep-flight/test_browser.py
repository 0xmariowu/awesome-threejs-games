#!/usr/bin/env python3
"""Exercise the built Cloudkeep example through real browser input (Python 3.9)."""

import http.client
import math
import os
from pathlib import Path
import subprocess
import time
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / "examples" / "cloudkeep-flight"
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8103)
URL = f"http://127.0.0.1:{PORT}"
MODELS = (
    "airship", "bird", "cloud", "food", "island-distant", "island",
    "jelly", "koi", "lighthouse-distant", "lighthouse", "moth",
    "orchard-distant", "orchard", "pearl", "ray", "ruins-distant",
    "ruins", "whale",
)


def server_answers():
    connection = http.client.HTTPConnection("127.0.0.1", PORT, timeout=1)
    try:
        connection.request("HEAD", "/")
        connection.getresponse()
        return True
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


def local_requests_only(route):
    if urlsplit(route.request.url).hostname == "127.0.0.1":
        route.continue_()
    else:
        route.abort()


class CloudkeepBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if not (EXAMPLE / "public/index.html").is_file():
            raise RuntimeError('Build this example with node build.mjs before running browser tests')
        if not server_answers():
            # The server honors PORT before local.json; keep this fixture on 8103.
            environment = dict(os.environ, PORT=str(PORT))
            cls.server = subprocess.Popen(
                ["node", "tools/server.mjs", "examples/cloudkeep-flight"],
                cwd=ROOT, env=environment, stdout=subprocess.DEVNULL,
            )
            deadline = time.monotonic() + 15
            while True:
                if cls.server.poll() is not None:
                    raise RuntimeError("Example server exited before becoming ready")
                if server_answers():
                    break
                if time.monotonic() >= deadline:
                    raise RuntimeError(f"Example server did not answer on port {PORT}")
                time.sleep(0.1)

        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-angle=metal", "--ignore-gpu-blocklist"],
        )
        cls.addClassCleanup(cls.browser.close)

    @classmethod
    def stop_server(cls):
        if cls.server is not None:
            if cls.server.poll() is None:
                cls.server.terminate()
                try:
                    cls.server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    cls.server.kill()
                    cls.server.wait(timeout=5)
            cls.server = None

    @classmethod
    def tearDownClass(cls):
        cls.stop_server()

    def setUp(self):
        self.context = self.browser.new_context(locale="zh-CN",
            viewport={"width": 1280, "height": 1800}, device_scale_factor=1,
            service_workers="block",
        )
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.context.route("**/*", local_requests_only)
        self.page = self.context.new_page()
        self.page.set_default_timeout(30_000)
        self.page_errors = []
        self.console_errors = []
        self.page.on("pageerror", lambda error: self.page_errors.append(str(error)))
        self.page.on(
            "console",
            lambda message: self.console_errors.append(message.text)
            if message.type == "error" else None,
        )

    def tearDown(self):
        # Run these even when a behavior assertion fails; never suppress errors.
        with self.subTest(browser_errors="page"):
            self.assertEqual(self.page_errors, [])
        with self.subTest(browser_errors="console"):
            self.assertEqual(self.console_errors, [])

    def open_flight(self):
        self.page.goto(URL + "/", wait_until="domcontentloaded")
        self.page.wait_for_function(
            "window.__flight && Number.isFinite(window.__flight.speed)",
            timeout=30_000,
        )
        return self.flight()

    def flight(self):
        return self.page.evaluate("window.__flight")

    def wait_flight(self, field, value):
        self.page.wait_for_function(
            "([field, value]) => window.__flight[field] === value",
            arg=[field, value],
        )
        self.assertEqual(self.flight()[field], value)

    def wait_model(self, name):
        filename = name + ".glb"
        self.page.wait_for_function(
            "name => window.__models && window.__models.current === name "
            "&& window.__models.stats !== null",
            arg=filename,
        )
        state = self.page.evaluate("window.__models")
        self.assertEqual(state["current"], filename)
        self.assertGreater(state["stats"]["triangles"], 0, filename)
        expect(self.page.get_by_role("heading", name=filename, exact=True)).to_be_visible()
        return state

    def open_models(self):
        self.page.goto(URL + "/models.html?model=airship", wait_until="domcontentloaded")
        return self.wait_model("airship")

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "cloudkeep-flight")

    def test_flight_loads(self):
        state = self.open_flight()
        self.assertAlmostEqual(state["speed"], 0, delta=0.01)
        self.page.wait_for_timeout(250)
        self.assertAlmostEqual(self.flight()["speed"], 0, delta=0.01)

    def test_w_moves_and_shift_boosts(self):
        self.open_flight()
        self.page.locator("#world canvas").click()
        before = self.flight()
        # original/input.ts reads event.code: KeyW and ShiftLeft/ShiftRight.
        self.page.keyboard.down("KeyW")
        try:
            self.page.wait_for_timeout(2000)
            moving = self.flight()
            distance = math.sqrt(sum(
                (moving["position"][axis] - before["position"][axis]) ** 2
                for axis in ("x", "y", "z")
            ))
            self.assertGreater(distance, 5)
            self.assertGreater(moving["speed"], 5)
            self.assertFalse(moving["boosting"])
            self.page.keyboard.down("ShiftLeft")
            try:
                self.page.wait_for_timeout(2000)
                boosted = self.flight()
                self.assertTrue(boosted["boosting"])
                self.assertGreater(boosted["speed"], moving["speed"])
            finally:
                self.page.keyboard.up("ShiftLeft")
        finally:
            self.page.keyboard.up("KeyW")

    def test_drag_steers(self):
        before = self.open_flight()
        canvas = self.page.locator("#world canvas").bounding_box()
        self.assertIsNotNone(canvas)
        x, y = canvas["x"] + canvas["width"] / 2 - 150, canvas["y"] + canvas["height"] / 2
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        try:
            self.page.mouse.move(x + 300, y, steps=20)
        finally:
            self.page.mouse.up()
        self.page.wait_for_function(
            "yaw => Math.abs(window.__flight.yawDegrees - yaw) > 10",
            arg=before["yawDegrees"],
        )
        self.assertGreater(abs(self.flight()["yawDegrees"] - before["yawDegrees"]), 10)

    def test_slow_motion(self):
        self.open_flight()
        self.wait_flight("timeScale", 1)
        start = self.flight()["time"]
        self.page.wait_for_timeout(2000)
        normal_elapsed = self.flight()["time"] - start
        self.assertGreater(normal_elapsed, 1.5)
        self.page.get_by_role("button", name="0.1×", exact=True).click()
        self.wait_flight("timeScale", 0.1)
        start = self.flight()["time"]
        self.page.wait_for_timeout(2000)
        slow_elapsed = self.flight()["time"] - start
        self.assertGreater(slow_elapsed, 0, "Slow motion must still advance simulation time")
        self.assertLess(slow_elapsed, 0.4)

    def test_camera_mode(self):
        self.open_flight()
        self.wait_flight("cameraMode", "smooth")
        # The host's direct mode resets the original FlightCamera each frame.
        self.page.get_by_role("button", name="直接跟随", exact=True).click()
        self.wait_flight("cameraMode", "direct")
        self.page.get_by_role("button", name="原版平滑", exact=True).click()
        self.wait_flight("cameraMode", "smooth")

    def test_helpers_toggle(self):
        before = self.open_flight()["helpersVisible"]
        button = self.page.get_by_role("button", name="显示辅助线", exact=True)
        button.click()
        self.wait_flight("helpersVisible", not before)
        expect(button).to_have_attribute("aria-pressed", str(not before).lower())
        button.click()
        self.wait_flight("helpersVisible", before)

    def test_models_page(self):
        self.open_models()
        wireframe = self.page.get_by_role("button", name="线框", exact=True)
        expect(wireframe).to_have_attribute("aria-pressed", "false")
        wireframe.click()
        expect(wireframe).to_have_attribute("aria-pressed", "true")
        wireframe.click()
        expect(wireframe).to_have_attribute("aria-pressed", "false")
        self.page.locator('[data-model="island.glb"]').click()
        self.wait_model("island")
        distant = self.page.get_by_role("button", name="显示远景版本", exact=True)
        distant.click()
        self.wait_model("island-distant")
        expect(distant).to_have_attribute("aria-pressed", "true")

    def test_all_18_models_load(self):
        self.open_models()
        buttons = self.page.locator("[data-model]")
        expect(buttons).to_have_count(18)
        self.assertCountEqual(
            buttons.evaluate_all("buttons => buttons.map(button => button.dataset.model)"),
            [name + ".glb" for name in MODELS],
        )
        for name in MODELS:
            with self.subTest(model=name):
                self.page.locator('[data-model="%s.glb"]' % name).click()
                self.wait_model(name)


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
