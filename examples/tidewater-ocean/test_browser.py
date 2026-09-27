#!/usr/bin/env python3
"""Run the original GPU ocean and boat with real Chrome input; own the server."""

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
EXAMPLE = ROOT / "examples/tidewater-ocean"
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import assert_picture_size, check_host_languages, available_port, install_frame_test_context

PORT = available_port(8128)
URL = f"http://127.0.0.1:{PORT}"
SHOTS = ROOT / "output/examples/tidewater-ocean"


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


class OceanBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if server_answers():
            raise RuntimeError(f"Port {PORT} is already in use; this test must own its server")
        cls.server = subprocess.Popen(
            ["node", "tools/server.mjs", "examples/tidewater-ocean"], cwd=ROOT,
            env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        cls.addClassCleanup(cls.stop_server)
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None or time.monotonic() >= deadline:
                raise RuntimeError("Example server did not start")
            time.sleep(0.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu"],
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
        self.context = self.browser.new_context(locale="zh-CN", viewport={"width": 1280, "height": 1800}, service_workers="block")
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.context.route("**/*", lambda route: route.continue_()
                           if urlsplit(route.request.url).hostname == "127.0.0.1" else route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", lambda message: self.errors.append(message.text) if message.type == "error" else None)
        self.page.on("response", lambda response: self.errors.append("HTTP %s %s" % (response.status, response.url)) if response.status >= 400 else None)
        self.addCleanup(self.assert_no_errors)
        self.page.goto(URL, wait_until="networkidle")
        self.page.wait_for_function("window.__example?.ready && window.__example.boat.hasWater", timeout=60000)

    def assert_no_errors(self):
        self.assertEqual(self.errors, [])

    def state(self):
        return self.page.evaluate("window.__example")

    def sample(self, seconds=3):
        return self.page.evaluate("""seconds => new Promise(resolve => {
          const samples = []; const start = performance.now(); let version = -1;
          function tick() {
            const s = window.__example;
            if (s.query.version !== version) { samples.push(s); version = s.query.version; }
            if (performance.now() - start >= seconds * 1000) resolve(samples);
            else requestAnimationFrame(tick);
          } tick();
        })""", seconds)

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "tidewater-ocean")

    def test_sea_state_changes_real_query_heights_and_buoyancy(self):
        self.page.get_by_label("海况", exact=True).select_option("calm")
        self.page.wait_for_timeout(1200)
        calm = self.sample()
        self.page.screenshot(path=str(SHOTS / "calm.png"))
        self.page.get_by_label("海况", exact=True).select_option("choppy")
        self.page.wait_for_timeout(1800)
        rough = self.sample(5)
        self.page.screenshot(path=str(SHOTS / "choppy.png"))
        self.assertGreater(len(calm), 10)
        self.assertGreater(len(rough), 10)
        rms = lambda states: math.sqrt(sum(b["height"] ** 2 for s in states for b in s["buoys"]) / (len(states) * 5))
        self.assertGreater(rms(rough), rms(calm) * 1.5)
        self.assertEqual(rough[-1]["windSpeed"], 12)
        self.assertGreater(rough[-1]["query"]["version"], calm[-1]["query"]["version"])
        heights = [s["boat"]["position"][1] for s in rough]
        self.assertGreater(max(heights) - min(heights), 0.08)
        for states in [calm, rough]:
            for state in states:
                self.assertLessEqual(state["query"]["resultTime"], state["time"])
                self.assertGreater(state["query"]["latency"], 0)
                self.assertLessEqual(state["boat"]["queryVersion"], state["query"]["version"])
                self.assertTrue(all(math.isfinite(h) for h in state["boat"]["heights"]))
                for buoy in state["buoys"]:
                    self.assertAlmostEqual(buoy["y"] + 0.18, buoy["height"], places=6)
        print("Sea-state RMS: calm=%.3f m, choppy=%.3f m; boat heave=%.3f m" %
              (rms(calm), rms(rough), max(heights) - min(heights)))

    def test_original_boat_input_moves_and_turns(self):
        self.page.locator("canvas").click()
        before = self.state()
        self.page.keyboard.down("KeyW")
        self.page.keyboard.down("ShiftLeft")
        try:
            self.page.wait_for_timeout(4000)
            moving = self.state()
            self.assertGreater(moving["boat"]["throttle"], 0.9)
            self.assertGreater(moving["boat"]["speed"], 1)
            self.assertGreater(math.dist(before["boat"]["position"], moving["boat"]["position"]), 3)
            self.page.keyboard.down("KeyA")
            try:
                self.page.wait_for_timeout(3000)
                turn = self.state()
                self.assertGreater(turn["boat"]["steer"], 0.8)
                self.assertGreater(abs(turn["boat"]["yaw"] - moving["boat"]["yaw"]), 0.05)
            finally:
                self.page.keyboard.up("KeyA")
        finally:
            self.page.keyboard.up("KeyW")
            self.page.keyboard.up("ShiftLeft")
        self.page.wait_for_timeout(1400)
        self.assertLess(self.state()["boat"]["throttle"], 0.1)

    def test_real_input_inside_16_by_9_iframe(self):
        # Serve a loopback host so the embedded WebGPU example stays secure.
        self.page.route(URL + "/iframe-test", lambda route: route.fulfill(
            content_type="text/html", body='<!doctype html><link rel="icon" href="data:,">'
            '<iframe name="ocean" title="Ocean" src="/" '
            'sandbox="allow-scripts allow-same-origin allow-pointer-lock" '
            'allow="fullscreen; autoplay" allowfullscreen '
            'style="border:0;width:960px;height:540px"></iframe>'))
        self.page.goto(URL + "/iframe-test", wait_until="networkidle")
        frame = self.page.frame(name="ocean")
        self.assertIsNotNone(frame)
        frame.wait_for_function("window.__example?.ready && window.__example.boat.hasWater", timeout=60000)
        size = frame.locator(".demo-picture").bounding_box()
        self.assertAlmostEqual(size["width"] / size["height"], 16 / 9)
        frame.get_by_label("海况", exact=True).select_option("calm")
        frame.wait_for_function("window.__example.windSpeed === 3.5")
        frame.locator("canvas").click()
        before = frame.evaluate("window.__example.boat.position")
        self.page.keyboard.down("KeyW")
        try:
            frame.wait_for_function("p => Math.hypot(...window.__example.boat.position.map((v,i) => v-p[i])) > 3",
                                    arg=before, timeout=15000)
            # W uses the original 0.7 cruise throttle; Shift enables full throttle.
            self.assertAlmostEqual(frame.evaluate("window.__example.boat.throttle"), 0.7, delta=0.05)
            # The historical > 0.9 assertion needs full-throttle input, not W alone.
            self.page.keyboard.down("ShiftLeft")
            try:
                frame.wait_for_function("window.__example.boat.throttle > 0.9")
                self.assertGreater(frame.evaluate("window.__example.boat.throttle"), 0.9)
            finally:
                self.page.keyboard.up("ShiftLeft")
        finally:
            self.page.keyboard.up("KeyW")
        frame.wait_for_function("window.__example.boat.throttle < 0.1")
        self.page.screenshot(path=str(SHOTS / "iframe.png"))

    def test_helpers_slow_motion_camera_and_resize(self):
        self.page.get_by_label("显示采样点", exact=True).uncheck()
        self.page.wait_for_function("!window.__example.helpersVisible")
        self.page.get_by_label("显示采样点", exact=True).check()
        self.page.wait_for_function("window.__example.helpersVisible")
        normal = self.sample(1.5)
        self.page.get_by_label("慢动作", exact=True).check()
        slow = self.sample(1.5)
        self.assertEqual(slow[-1]["timeScale"], 0.2)
        self.assertGreater(slow[-1]["time"] - slow[0]["time"], 0)
        self.assertLess(slow[-1]["time"] - slow[0]["time"], (normal[-1]["time"] - normal[0]["time"]) * 0.4)
        before = self.state()["camera"]
        self.page.mouse.move(600, 360)
        self.page.mouse.down()
        self.page.mouse.move(800, 390, steps=15)
        self.page.mouse.up()
        self.page.mouse.wheel(0, 300)
        self.page.wait_for_timeout(300)
        after = self.state()["camera"]
        self.assertGreater(abs(after["yaw"] - before["yaw"]), 0.3)
        self.assertGreater(after["distance"], before["distance"])
        version = self.state()["query"]["version"]
        self.page.set_viewport_size({"width": 800, "height": 1200})
        self.page.wait_for_function("v => window.__example.query.version > v + 3", arg=version)
        self.assertEqual(self.page.locator("canvas").evaluate("c => [c.width, c.height]"), assert_picture_size(self, self.page, 800))
        self.page.screenshot(path=str(SHOTS / "inline-800.png"))


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
