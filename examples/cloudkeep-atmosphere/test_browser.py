#!/usr/bin/env python3
"""Build and exercise the original atmosphere in installed headless Chrome."""

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
EXAMPLE = Path(__file__).resolve().parent
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import assert_picture_size, check_host_languages, available_port, install_frame_test_context

PORT = available_port(8111)
URL = f"http://127.0.0.1:{PORT}"


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


class AtmosphereBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if server_answers():
            raise RuntimeError(f"Port {PORT} is occupied; this test must own its server")
        if not (ROOT / 'examples' / Path(__file__).parent.name / 'public/index.html').is_file():
            raise RuntimeError('Build this example with node build.mjs before running browser tests')
        cls.server = subprocess.Popen(
            ["node", "tools/server.mjs", "examples/cloudkeep-atmosphere"],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError(f"Example server did not start on port {PORT}")
            time.sleep(.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-angle=metal", "--ignore-gpu-blocklist"],
        )
        cls.addClassCleanup(cls.browser.close)
        (ROOT / "output/examples/cloudkeep-atmosphere").mkdir(parents=True, exist_ok=True)

    @classmethod
    def stop_server(cls):
        if cls.server is not None and cls.server.poll() is None:
            cls.server.terminate()
            try:
                cls.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.server.kill()
                cls.server.wait(timeout=5)

    def setUp(self):
        self.context = self.browser.new_context(locale="zh-CN",
            viewport={"width": 1280, "height": 1800}, device_scale_factor=1,
            service_workers="block",
        )
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.errors = []
        self.context.route("**/*", lambda route: route.continue_()
                           if urlsplit(route.request.url).hostname == "127.0.0.1" else route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(30_000)
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", lambda message: self.errors.append(message.text)
                     if message.type == "error" else None)
        self.page.on("requestfailed", lambda request: self.errors.append(f"{request.url}: {request.failure}"))
        self.page.on("response", lambda response: self.errors.append(f"HTTP {response.status}: {response.url}")
                     if response.status >= 400 else None)

    def tearDown(self):
        self.assertEqual(self.errors, [])

    def open(self):
        self.page.goto(URL, wait_until="domcontentloaded")
        self.page.wait_for_function("window.__example?.frames > 2")
        return self.state()

    def state(self):
        return self.page.evaluate("window.__example")

    def hold_until(self, keys, predicate, timeout=15_000):
        for key in keys:
            self.page.keyboard.down(key)
        try:
            self.page.wait_for_function(predicate, timeout=timeout)
        finally:
            for key in reversed(keys):
                self.page.keyboard.up(key)

    def screenshot(self, name):
        self.page.screenshot(path=str(ROOT / "output/examples/cloudkeep-atmosphere" / f"{name}.png"))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "cloudkeep-atmosphere")

    def test_01_fly_into_and_out_of_cloud_with_fog_comparison(self):
        start = self.open()
        self.assertEqual(start["bankCount"], 6)
        self.assertEqual(start["localMist"], 0)
        self.assertEqual(start["fogFar"], 390)
        self.screenshot("outside")
        self.page.locator("#world canvas").click()
        self.hold_until(["KeyW", "ShiftLeft"], "window.__example.localMist > .98")
        self.page.wait_for_function("window.__example.immersion > .95")
        inside = self.state()
        self.assertGreater(math.dist(inside["position"], start["position"]), 40)
        self.assertLess(inside["fogNear"], 8)
        self.assertLess(inside["fogFar"], 92)
        self.screenshot("inside")
        self.page.get_by_role("button", name="入云雾效", exact=True).click()
        self.page.wait_for_function("!window.__example.fogEnabled && window.__example.fogFar === 390")
        self.assertGreater(self.state()["localMist"], .95)
        self.screenshot("inside-fog-off")
        self.page.get_by_role("button", name="入云雾效", exact=True).click()
        self.page.wait_for_function("window.__example.fogEnabled && window.__example.fogFar < 92")
        self.hold_until(["KeyS", "ShiftLeft"], "window.__example.localMist === 0")
        self.page.wait_for_function("window.__example.fogFar > 385")
        self.assertLess(self.state()["immersion"], .02)

    def test_02_all_six_banks_have_real_mist_and_render(self):
        self.open()
        for index in range(6):
            with self.subTest(bank=index + 1):
                self.page.get_by_label("选择云团").select_option(str(index))
                self.page.wait_for_function("i => window.__example.selectedBank === i", arg=index)
                self.assertEqual(self.state()["localMist"], 0)
                self.hold_until(["KeyW", "ShiftLeft"], "window.__example.localMist > .98")
                self.page.wait_for_function("window.__example.immersion > .8")
                state = self.state()
                expected = max(max(0, min(1, (1 - math.sqrt(sum(
                    ((state["position"][axis] - bank["center"][axis]) / bank["radius"][axis]) ** 2
                    for axis in range(3)))) * 2.6)) for bank in state["banks"])
                self.assertAlmostEqual(state["localMist"], expected, places=8)
                self.assertLess(state["fogFar"], 140)

    def test_03_original_drag_orbit_zoom_and_recenter(self):
        self.open()
        self.page.mouse.move(500, 360)
        self.page.mouse.down()
        self.page.mouse.move(700, 400, steps=12)
        self.page.mouse.up()
        self.page.wait_for_function("Math.abs(window.__example.yaw) > .5")
        self.assertLess(self.state()["pitch"], -.2)
        yaw = self.state()["yaw"]
        self.page.mouse.down(button="right")
        self.page.mouse.move(820, 400, steps=12)
        self.page.mouse.up(button="right")
        self.page.wait_for_function("Math.abs(window.__example.orbitYaw) > .3")
        self.assertAlmostEqual(self.state()["yaw"], yaw)
        self.page.mouse.wheel(0, 250)
        self.page.wait_for_function("window.__example.fov > 50")
        self.page.keyboard.press("KeyC")
        self.page.wait_for_function("window.__example.orbitYaw === 0 && window.__example.pitch === 0 && window.__example.fov === 46")

    def test_04_helpers_and_vertical_movement(self):
        start = self.open()
        button = self.page.get_by_role("button", name="云团边界", exact=True)
        button.click()
        expect(button).to_have_attribute("aria-pressed", "true")
        self.page.wait_for_function("window.__example.helpersVisible")
        self.screenshot("boundaries")
        y = start["position"][1]
        self.hold_until(["KeyR"], f"window.__example.position[1] > {y + 8}")
        self.hold_until(["KeyF"], f"window.__example.position[1] < {y}")
        button.click()
        self.page.wait_for_function("!window.__example.helpersVisible")

    def test_05_runs_inside_resizable_16_by_9_iframe(self):
        # Serve the parent fixture on localhost, matching the library's address
        # space, without leaving an example running in the parent document.
        self.page.route(URL + "/iframe-fixture", lambda route: route.fulfill(
            content_type="text/html", body='<iframe title="云海示例" src="' + URL +
            '" style="border:0;width:960px;height:540px"></iframe>'))
        self.page.goto(URL + "/iframe-fixture")
        frame = self.page.frames[1]
        frame.wait_for_function("window.__example?.frames > 2")
        size = assert_picture_size(self, frame, 960)
        self.assertEqual(frame.evaluate("window.__example.viewport"), dict(zip(('width', 'height'), size)))
        frame.locator("#world canvas").click()
        start = frame.evaluate("window.__example.position[0]")
        self.page.keyboard.down("KeyD")
        try:
            frame.wait_for_function("x => window.__example.position[0] > x + 5", arg=start)
        finally:
            self.page.keyboard.up("KeyD")
        self.page.locator("iframe").evaluate("element => { element.style.width = '640px'; element.style.height = '360px'; }")
        frame.wait_for_function("window.__example.viewport.width === 638 && window.__example.viewport.height === 358")
        assert_picture_size(self, frame, 640)
        expect(frame.get_by_role("button", name="回到云外")).to_be_visible()


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
