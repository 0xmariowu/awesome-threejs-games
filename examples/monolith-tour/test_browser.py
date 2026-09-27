#!/usr/bin/env python3
"""Exercise unchanged camera modules with real input in installed headless Chrome."""

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
EXAMPLE = ROOT / "examples" / "monolith-tour"
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import assert_picture_size, check_host_languages, available_port, install_frame_test_context

PORT = available_port(8122)
URL = f"http://127.0.0.1:{PORT}"
SHOTS = ROOT / "output/examples/monolith-tour"


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


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def angle(a, b):
    return 2 * math.acos(min(1, abs(sum(x * y for x, y in zip(a, b)))))


class MonolithTourBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if server_answers():
            raise RuntimeError(f"Port {PORT} is occupied; this test must own its server")
        cls.server = subprocess.Popen(
            ["node", "tools/server.mjs", "examples/monolith-tour"],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None:
                raise RuntimeError("Example server exited before becoming ready")
            if time.monotonic() > deadline:
                raise RuntimeError(f"Example server did not answer on port {PORT}")
            time.sleep(0.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-angle=metal", "--ignore-gpu-blocklist"],
        )
        cls.addClassCleanup(cls.browser.close)
        SHOTS.mkdir(parents=True, exist_ok=True)

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

    def setUp(self):
        self.context = self.browser.new_context(locale="zh-CN",
            viewport={"width": 1280, "height": 1800}, device_scale_factor=1,
            service_workers="block",
        )
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.errors = []
        self.requests = []

        def route_request(route):
            self.requests.append(route.request.url)
            if urlsplit(route.request.url).hostname == "127.0.0.1":
                route.continue_()
            else:
                self.errors.append("External request: " + route.request.url)
                route.abort()

        self.context.route("**/*", route_request)
        self.page = self.context.new_page()
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", lambda message: self.errors.append(message.text)
                     if message.type == "error" else None)
        self.page.on("response", lambda response: self.errors.append(
            "HTTP %d: %s" % (response.status, response.url)) if response.status >= 400 else None)
        # Virtual time preserves every original rAF update; it does not fast-forward
        # state or call the controls directly. All actions remain keyboard/pointer input.
        self.page.clock.install()
        self.page.goto(URL, wait_until="load")
        self.page.wait_for_function("window.__example?.state?.frame > 0")

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.assertFalse(any("index-DGqtqlWq.js" in url for url in self.requests),
                         "The full game's boot must not load")

    def state(self):
        return self.page.evaluate("window.__example.state")

    def advance(self, milliseconds):
        self.page.clock.run_for(milliseconds)
        return self.state()

    def press(self, code):
        self.page.keyboard.press(code)
        return self.advance(32)

    def screenshot(self, name):
        self.page.screenshot(path=str(SHOTS / (name + ".png")))

    def click_to_capture(self, target, x, y):
        # Headless Chrome on this host rejects native capture with
        # WrongDocumentError. Observe the real browser result; never mock capture.
        target.evaluate("""() => {
            window.__lockRejected = false;
            document.addEventListener('pointerlockerror', () => {
                window.__lockRejected = true;
            }, {once: true});
        }""")
        target.locator("canvas").click()
        target.wait_for_function("document.pointerLockElement !== null || window.__lockRejected")
        self.page.clock.run_for(32)
        captured = target.evaluate("document.pointerLockElement !== null")
        self.assertEqual(target.evaluate("window.__example.state.locked"), captured)
        if not captured:
            self.assertTrue(target.evaluate("window.__lockRejected"))
            print("  Native capture rejected by headless Chrome; drag fallback tested", flush=True)
        return captured

    def assert_continuous(self, since_frame, turning=False):
        samples = self.page.evaluate(
            "frame => window.__example.samples.filter(s => s.frame >= frame)", since_frame)
        self.assertGreater(len(samples), 2)
        for previous, current in zip(samples, samples[1:]):
            self.assertTrue(all(math.isfinite(v) for v in current["position"] + current["quaternion"]))
            self.assertGreaterEqual(current["position"][1], 0.5)
            self.assertLess(distance(previous["position"], current["position"]),
                            230 * current["dt"] + 0.2, "Camera position snapped")
            if turning:
                self.assertLessEqual(angle(previous["quaternion"], current["quaternion"]),
                                     math.radians(32) * current["dt"] + 0.0001)
            self.assertLess(abs(previous["fov"] - current["fov"]), 0.8)

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "monolith-tour")

    def test_flight_input_look_boost_and_pointer_lock(self):
        initial = self.state()
        self.assertEqual(initial["mode"], "fly")
        self.screenshot("fly")
        self.page.keyboard.down("KeyW")
        moved = self.advance(1500)
        self.assertGreater(distance(initial["position"], moved["position"]), 20)
        self.page.keyboard.down("ShiftLeft")
        boosted = self.advance(1500)
        self.assertGreater(distance([0, 0, 0], boosted["velocity"]),
                           distance([0, 0, 0], moved["velocity"]) * 2)
        self.page.keyboard.up("ShiftLeft")
        self.page.keyboard.up("KeyW")
        self.advance(2500)
        self.page.keyboard.down("Space")
        risen = self.advance(1000)
        self.page.keyboard.up("Space")
        self.assertGreater(risen["position"][1], boosted["position"][1] + 8)
        self.advance(2000)
        before = self.state()
        self.page.keyboard.down("KeyQ")
        sunk = self.advance(1000)
        self.page.keyboard.up("KeyQ")
        self.assertLess(sunk["position"][1], before["position"][1] - 8)

        before = self.state()
        self.page.mouse.move(500, 360)
        self.page.mouse.down()
        self.page.mouse.move(690, 390, steps=12)
        self.page.mouse.up()
        looked = self.advance(500)
        self.assertGreater(angle(before["quaternion"], looked["quaternion"]), 0.2)
        self.click_to_capture(self.page, 640, 360)
        self.press("KeyC")
        self.page.wait_for_function("document.pointerLockElement === null")
        self.assertFalse(self.advance(32)["locked"])
        self.assertTrue(self.state()["tourActive"])
        self.advance(1000)
        self.press("KeyW")
        self.assertEqual(self.state()["mode"], "fly")
        self.assertFalse(self.state()["tourActive"])

    def test_walk_lands_smoothly_moves_jumps_and_returns_to_flight(self):
        before = self.state()
        switched = self.press("KeyF")
        self.assertEqual(switched["mode"], "walk")
        self.assertFalse(switched["grounded"])
        self.assertLess(distance(before["position"], switched["position"]), 1)
        landed = self.advance(9000)
        self.assertTrue(landed["grounded"])
        self.assertAlmostEqual(landed["position"][1], 1.7, delta=0.15)
        self.assert_continuous(before["frame"])
        self.screenshot("walk")
        self.page.keyboard.down("KeyW")
        moved = self.advance(1500)
        self.page.keyboard.up("KeyW")
        self.assertGreater(distance(landed["position"], moved["position"]), 5)
        self.page.keyboard.down("Space")
        jumped = self.advance(240)
        self.page.keyboard.up("Space")
        self.assertFalse(jumped["grounded"])
        self.assertGreater(jumped["position"][1], moved["position"][1] + 0.7)
        self.advance(1200)
        self.assertTrue(self.state()["grounded"])
        before = self.state()
        flying = self.press("KeyF")
        self.assertEqual(flying["mode"], "fly")
        self.assertLess(distance(before["position"], flying["position"]), 1)
        self.page.keyboard.down("Space")
        risen = self.advance(1000)
        self.page.keyboard.up("Space")
        self.assertGreater(risen["position"][1], flying["position"][1] + 8)

    def test_tour_blends_and_hands_momentum_back_to_user(self):
        self.page.keyboard.down("KeyW")
        self.advance(1000)
        self.page.keyboard.up("KeyW")
        before = self.state()
        self.press("KeyC")
        middle = self.advance(1800)
        self.assertEqual(middle["tour"]["type"], "transit")
        self.assertGreater(distance(before["position"], middle["position"]), 1)
        self.assert_continuous(before["frame"], turning=True)
        self.screenshot("tour-transit")
        handoff = self.press("KeyC")
        self.assertEqual(handoff["mode"], "fly")
        self.assertFalse(handoff["tourActive"])
        self.assertGreater(distance([0, 0, 0], handoff["velocity"]), 0.1)
        self.advance(400)
        self.assert_continuous(middle["frame"])
        self.press("KeyC")
        self.advance(1500)
        self.page.mouse.move(600, 360)
        self.page.mouse.wheel(0, 100)
        self.assertEqual(self.advance(32)["mode"], "fly")
        self.press("KeyC")
        self.advance(1200)
        self.page.mouse.move(740, 360, steps=6)
        self.assertEqual(self.advance(32)["mode"], "fly")
        self.press("KeyC")
        self.advance(1200)
        self.assertEqual(self.press("KeyF")["mode"], "walk")
        self.assertFalse(self.state()["tourActive"])

    def test_every_authored_tour_move_can_be_interrupted(self):
        self.press("KeyC")
        expected = {"push", "pull", "orbit", "truck", "crane"}
        self.assertEqual({stop["move"] for stop in self.state()["stops"]}, expected)
        seen = set()
        fovs = []
        for _ in range(190):
            before = self.state()
            state = self.advance(3000)
            self.assert_continuous(before["frame"], turning=True)
            fovs.append(state["fov"])
            if state["tour"]["type"] != "stop" or state["move"] in seen:
                continue
            move = state["move"]
            self.screenshot("tour-" + move)
            self.page.keyboard.down("KeyW")
            interrupted = self.advance(32)
            self.assertEqual(interrupted["mode"], "fly", move)
            self.assertFalse(interrupted["tourActive"], move)
            response = self.advance(400)
            self.page.keyboard.up("KeyW")
            self.assertGreater(distance(interrupted["position"], response["position"]), 0.1, move)
            self.assert_continuous(state["frame"])
            seen.add(move)
            print("  Interrupted original %s move (%d/5)" % (move, len(seen)), flush=True)
            if seen == expected:
                break
            self.press("KeyC")
        self.assertEqual(seen, expected, "Every authored move must actually run")
        self.assertGreater(max(fovs) - min(fovs), 3, "Original FOV blending must run")

    def test_mode_buttons_slow_motion_and_embedded_viewport(self):
        self.page.get_by_role("button", name="自动导览 · C", exact=True).click()
        self.assertEqual(self.advance(200)["mode"], "tour")
        self.page.get_by_role("button", name="步行 · F", exact=True).click()
        self.assertEqual(self.advance(200)["mode"], "walk")
        self.page.get_by_role("button", name="飞行 · F", exact=True).click()
        self.assertEqual(self.advance(200)["mode"], "fly")
        start = self.state()["time"]
        self.advance(2000)
        normal = self.state()["time"] - start
        self.page.get_by_role("button", name="慢动作", exact=True).click()
        start = self.state()["time"]
        slowed = self.advance(2000)
        self.assertEqual(slowed["timeScale"], 0.25)
        self.assertAlmostEqual((slowed["time"] - start) / normal, 0.25, delta=0.03)
        self.page.set_viewport_size({"width": 960, "height": 540})
        self.advance(100)
        box = self.page.locator("canvas").bounding_box()
        assert_picture_size(self, self.page if self.page.locator('[data-demo-picture]').count() else self.page.frames[1], 960)
        self.assertFalse(self.page.evaluate("document.documentElement.scrollWidth > innerWidth"))
        self.screenshot("embedded-size")

    def test_inline_iframe_accepts_real_input(self):
        self.page.route(URL + "/embed-test", lambda route: route.fulfill(
            content_type="text/html", body='''<!doctype html><html lang="zh-CN">
            <head><link rel="icon" href="data:,"></head>
            <body style="margin:0;background:#203435;display:grid;place-items:center;height:100vh">
            <iframe name="demo" title="镜头交接" src="/" allow="fullscreen; pointer-lock; autoplay"
              style="width:960px;height:540px;border:0"></iframe></body></html>'''))
        self.page.goto(URL + "/embed-test", wait_until="load")
        frame = self.page.frame(name="demo")
        frame.wait_for_function("window.__example?.state?.frame > 0")
        canvas = frame.locator("canvas")
        self.click_to_capture(frame, 480, 270)
        before = frame.evaluate("window.__example.state")
        self.page.keyboard.down("KeyW")
        self.page.clock.run_for(1200)
        self.page.keyboard.up("KeyW")
        moved = frame.evaluate("window.__example.state")
        self.assertGreater(distance(before["position"], moved["position"]), 15)
        self.page.keyboard.press("KeyC")
        self.page.clock.run_for(1000)
        self.assertTrue(frame.evaluate("window.__example.state.tourActive"))
        frame.wait_for_function("document.pointerLockElement === null")
        self.page.keyboard.press("KeyF")
        self.page.clock.run_for(1000)
        self.assertEqual(frame.evaluate("window.__example.state.mode"), "walk")
        box = canvas.bounding_box()
        assert_picture_size(self, self.page if self.page.locator('[data-demo-picture]').count() else self.page.frames[1], 960)
        self.screenshot("inline-iframe")


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
