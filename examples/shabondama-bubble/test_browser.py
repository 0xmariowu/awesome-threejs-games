#!/usr/bin/env python3
"""Real-input checks of the unmodified bubble renderer in installed Chrome."""

import http.client
from io import BytesIO
import math
import os
from pathlib import Path
import subprocess
import time
import unittest
from urllib.parse import urlsplit

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / "examples/shabondama-bubble"
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import assert_picture_size, check_host_languages, available_port, install_frame_test_context

PORT = available_port(8120)
URL = f"http://127.0.0.1:{PORT}"


def server_answers():
    connection = http.client.HTTPConnection("127.0.0.1", PORT, timeout=0.3)
    try:
        connection.request("HEAD", "/")
        return connection.getresponse().status == 200
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


class BubbleBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if server_answers():
            raise RuntimeError(f"Port {PORT} is occupied; this test must own its server")
        cls.server = subprocess.Popen(
            ["node", "tools/server.mjs", "examples/shabondama-bubble"],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None:
                raise RuntimeError("Example server exited before becoming ready")
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
        (ROOT / "output/examples/shabondama-bubble").mkdir(parents=True, exist_ok=True)

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
        self.page = self.context.new_page()
        self.errors = []
        self.context.route("**/*", self.route)
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", lambda message: self.errors.append(message.text)
                     if message.type == "error" else None)
        self.page.on("requestfailed", lambda request: self.errors.append(request.url))
        self.page.on("response", lambda response: self.errors.append(str(response.status) + " " + response.url)
                     if response.status >= 400 else None)
        self.page.goto(URL, wait_until="networkidle")
        self.page.wait_for_function("window.__example?.frame > 5")

    def route(self, route):
        if urlsplit(route.request.url).netloc == f"127.0.0.1:{PORT}":
            route.continue_()
        else:
            self.errors.append("External request: " + route.request.url)
            route.abort()

    def tearDown(self):
        self.assertEqual(self.errors, [])

    def state(self):
        return self.page.evaluate("window.__example")

    def settle(self):
        self.page.wait_for_function("f => window.__example.frame > f + 3", arg=self.state()["frame"])

    def pause(self):
        self.page.get_by_role("button", name="暂停流动").click()
        self.page.wait_for_function("window.__example.paused")
        self.settle()

    def snapshot(self, name=None):
        image = self.page.screenshot(path=str(ROOT / "output/examples/shabondama-bubble" / name) if name else None)
        return Image.open(BytesIO(image)).convert("RGB")

    def bubble_pixels(self):
        box = self.page.locator('[data-demo-picture]').bounding_box()
        x, y = round(box['x'] + box['width'] / 2), round(box['y'] + box['height'] / 2)
        return self.snapshot().crop((x - 160, y - 160, x + 160, y + 160))

    def assert_visible_change(self, before, after, minimum=3):
        delta = sum(ImageStat.Stat(ImageChops.difference(before, after)).mean) / 3
        self.assertGreater(delta, minimum, "Rendered pixels must respond, not only host state")

    def drag(self, dx, dy=0):
        self.page.mouse.move(420, 380)
        self.page.mouse.down()
        try:
            self.page.mouse.move(420 + dx, 380 + dy, steps=24)
        finally:
            self.page.mouse.up()
        self.settle()

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "shabondama-bubble")

    def test_visible_original_film_and_time_pause(self):
        state = self.state()
        self.assertEqual(state["instances"], 1)
        self.assertEqual(state["filmNoise"], [32, 32, 32])
        self.assertEqual(state["environment"], [256, 128])
        self.assertTrue(state["depthBound"])
        self.assertEqual(state["resolution"], assert_picture_size(self, self.page, 1280))
        before = self.bubble_pixels()
        colored = sum(max(pixel) - min(pixel) > 45 and max(pixel) > 80 for pixel in before.getdata())
        self.assertGreater(colored, 15000, "A substantial iridescent surface must be visible")
        self.page.wait_for_timeout(800)
        self.assertGreater(self.state()["time"], state["time"] + 0.2)
        self.assert_visible_change(before, self.bubble_pixels())
        self.pause()
        frozen = self.state()["time"]
        before = self.bubble_pixels()
        self.page.wait_for_timeout(300)
        self.assertEqual(self.state()["time"], frozen)
        self.assertIsNone(ImageChops.difference(before, self.bubble_pixels()).getbbox())
        self.snapshot("bubble.png")
        self.page.get_by_role("button", name="暂停流动").click()
        self.page.wait_for_function("t => window.__example.time > t + 0.1", arg=frozen)

    def test_thickness_changes_original_instance_data_and_color(self):
        self.pause()
        before = self.bubble_pixels()
        slider = self.page.get_by_role("slider", name="膜厚")
        slider.focus()
        self.page.keyboard.press("Home")
        self.page.wait_for_function("window.__example.film === 80")
        self.settle()
        thin = self.bubble_pixels()
        self.assert_visible_change(before, thin, 10)
        self.snapshot("thin-film.png")
        self.page.keyboard.press("End")
        self.page.wait_for_function("window.__example.film === 900")
        self.settle()
        self.assert_visible_change(thin, self.bubble_pixels(), 10)
        self.snapshot("thick-film.png")

    def test_orbit_zoom_and_reset_at_fixed_film_time(self):
        self.pause()
        state = self.state()
        before = self.bubble_pixels()
        self.drag(290, -80)
        after = self.state()
        self.assertGreater(math.dist(after["camera"], state["camera"]), 3)
        self.assertEqual(after["time"], state["time"])
        self.assertEqual(after["film"], state["film"])
        self.assert_visible_change(before, self.bubble_pixels(), 10)
        self.snapshot("orbit.png")
        self.page.mouse.wheel(0, -250)
        self.page.wait_for_function("d => window.__example.distance < d - 0.5", arg=after["distance"])
        self.page.get_by_role("button", name="重置视角").click()
        self.page.wait_for_function("window.__example.yaw === 0 && window.__example.distance === 6.2")

    def test_overlap_sorting_and_foreground_depth(self):
        self.pause()
        self.page.get_by_role("button", name="重叠泡泡").click()
        self.page.wait_for_function("window.__example.instances === 2")
        self.settle()

        def assert_sorted():
            state = self.state()
            instances = [state["positions"][i:i + 3] for i in (0, 4)]
            self.assertGreater(math.dist(instances[0], state["camera"]), math.dist(instances[1], state["camera"]))
            return instances

        initial = assert_sorted()
        self.snapshot("overlap.png")
        self.drag(750)
        self.assertEqual(assert_sorted(), initial[::-1], "Original far-to-near ordering must reverse with the camera")
        self.page.get_by_role("button", name="重置视角").click()
        self.page.get_by_role("button", name="重叠泡泡").click()
        self.page.get_by_role("button", name="前景遮挡").click()
        self.page.wait_for_function("window.__example.depthEnabled && window.__example.instances === 1 && window.__example.yaw === 0")
        self.settle()
        blocked = self.snapshot("depth.png")
        box = self.page.locator('[data-demo-picture]').bounding_box()
        def point(x, y):
            return round(box['x'] + x / 1280 * box['width']), round(box['y'] + y / 720 * box['height'])
        self.assertGreater(min(blocked.getpixel(point(640, 360))), 150)
        self.page.get_by_role("slider", name="膜厚").focus()
        self.page.keyboard.press("Home")
        self.page.wait_for_function("window.__example.film === 80")
        self.settle()
        changed = self.snapshot()
        # The opaque strip stays identical while the exposed film changes.
        strip = (*point(635, 320), *point(645, 400))
        self.assertIsNone(ImageChops.difference(blocked.crop(strip), changed.crop(strip)).getbbox())
        side = (*point(490, 240), *point(600, 480))
        self.assert_visible_change(blocked.crop(side), changed.crop(side), 10)
        self.page.get_by_role("button", name="前景遮挡").click()
        self.page.wait_for_function("!window.__example.depthEnabled")
        self.settle()
        self.assert_visible_change(changed.crop(strip), self.snapshot().crop(strip), 10)

    def test_inline_frame_resize_and_original_dpr_cap(self):
        # Serve the wrapper from a test-only route; the embedded example is unchanged.
        self.page.route(URL + "/iframe-test", lambda route: route.fulfill(
            content_type="text/html", body='<style>body{margin:0}iframe{width:960px;aspect-ratio:16/9;border:0}</style>'
            '<iframe title="泡泡薄膜虹彩" src="/index.html"></iframe>',
        ))
        self.page.goto(URL + "/iframe-test")
        frame = self.page.frame_locator("iframe")
        frame.locator("#pause").click()
        child = self.page.frames[1]
        child.wait_for_function("window.__example?.paused")
        self.assertEqual(child.evaluate("window.__example.resolution"), assert_picture_size(self, child, 960))
        frame.get_by_role("slider", name="膜厚").focus()
        self.page.keyboard.press("End")
        child.wait_for_function("window.__example.film === 900")
        self.page.screenshot(path=str(ROOT / "output/examples/shabondama-bubble/iframe.png"))
        # Native Retina density still follows the original 1.25 cap.
        retina = self.browser.new_context(locale="zh-CN", viewport={"width": 960, "height": 1800}, device_scale_factor=2)
        self.addCleanup(retina.close)
        retina.route("**/*", self.route)
        page = retina.new_page()
        page.on("pageerror", lambda error: self.errors.append(str(error)))
        page.on("console", lambda message: self.errors.append(message.text) if message.type == "error" else None)
        page.goto(URL)
        page.wait_for_function("window.__example?.frame > 5")
        state = page.evaluate("window.__example")
        self.assertEqual(state["dpr"], 1.25)
        self.assertEqual(state["resolution"], [math.floor(value * 1.25) for value in assert_picture_size(self, page, 960)])


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
