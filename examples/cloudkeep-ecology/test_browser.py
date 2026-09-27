#!/usr/bin/env python3
"""Real-input acceptance for the original ecosystem; Python 3.9 + Chrome."""
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
EXAMPLE = ROOT / "examples/cloudkeep-ecology"
import sys
sys.path.insert(0, str(ROOT / 'examples/_shared'))
from ui_browser import check_host_languages, available_port, install_frame_test_context

PORT = available_port(8110)
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


class EcologyBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = None
        cls.addClassCleanup(cls.stop_server)
        if server_answers():
            raise RuntimeError(f"Port {PORT} is occupied; this test must own its server")
        if not (ROOT / 'examples' / Path(__file__).parent.name / 'public/index.html').is_file():
            raise RuntimeError('Build this example with node build.mjs before running browser tests')
        cls.server = subprocess.Popen(
            ["node", "tools/server.mjs", "examples/cloudkeep-ecology"],
            cwd=ROOT, env=dict(os.environ, PORT=str(PORT)), stdout=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 15
        while not server_answers():
            if cls.server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError("Example server failed to start")
            time.sleep(.1)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(
            channel="chrome", headless=True,
            args=["--use-angle=metal", "--ignore-gpu-blocklist"],
        )
        cls.addClassCleanup(cls.browser.close)
        (ROOT / "output/examples/cloudkeep-ecology").mkdir(parents=True, exist_ok=True)

    @classmethod
    def stop_server(cls):
        if cls.server is not None:
            cls.server.terminate()
            try:
                cls.server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.server.kill()
                cls.server.wait(timeout=5)
            cls.server = None

    def setUp(self):
        self.context = self.browser.new_context(locale="zh-CN",
            viewport={"width": 1280, "height": 1800}, device_scale_factor=1, service_workers="block",
        )
        install_frame_test_context(self.context)
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.errors = []
        self.failed = []
        self.context.route("**/*", lambda route: route.continue_()
                           if urlsplit(route.request.url).netloc == f"127.0.0.1:{PORT}" else route.abort())
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("console", lambda message: self.errors.append(message.text) if message.type == "error" else None)
        self.page.on("requestfailed", lambda request: self.failed.append(request.url))
        self.page.on("response", lambda response: self.failed.append(f"{response.status} {response.url}") if response.status >= 400 else None)
        self.page.goto(URL, wait_until="networkidle")
        self.wait("s.ready === true")

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failed, [])

    def state(self):
        return self.page.evaluate("window.__example")

    def wait(self, expression, timeout=30000):
        self.page.wait_for_function(f"() => {{ const s = window.__example; return s && ({expression}); }}", timeout=timeout)

    def reset(self):
        self.page.get_by_role("button", name="重新开始").click()
        self.wait("s.time < .5 && s.totalCaptured === 0 && s.totalFed === 0")

    def screenshot(self, name):
        self.page.screenshot(path=str(ROOT / "output/examples/cloudkeep-ecology" / f"{name}.png"))

    def test_host_languages_and_themes(self):
        check_host_languages(self, self.browser, URL, "cloudkeep-ecology")

    def test_roaming_flocking_and_feeding(self):
        before = self.state()
        self.wait("s.creatures.some(c => c.mode === 'flock') && s.creatures.some(c => c.mode === 'roam')")
        self.page.wait_for_timeout(650)
        after = self.state()
        self.assertEqual(len(after["creatures"]), 9)
        moved = sum(math.dist(list(c["pos"].values()), list(before["creatures"][i]["pos"].values())) > .2
                    for i, c in enumerate(after["creatures"]))
        self.assertGreater(moved, 5)
        self.screenshot("roaming")
        self.page.keyboard.down("Space")
        try:
            self.wait("s.foods.length > 0 && s.creatures.some(c => c.mode === 'forage')")
            state = self.state()
            self.assertLessEqual(sum(c.get("target") is not None for c in state["creatures"]), 3)
            self.screenshot("foraging")
            self.wait("s.totalFed > 0 && s.events.eat > 0", timeout=15000)
        finally:
            self.page.keyboard.up("Space")
        self.assertGreater(self.state()["events"]["feed"], 0)

    def test_boost_flee_and_recovery(self):
        self.reset()
        before = self.state()
        self.page.keyboard.down("KeyW")
        self.page.keyboard.down("ShiftLeft")
        try:
            self.wait("s.boosting && s.creatures.some(c => c.mode === 'flee') && s.speed > 3")
            self.screenshot("fleeing")
        finally:
            self.page.keyboard.up("ShiftLeft")
            self.page.keyboard.up("KeyW")
        self.wait("!s.boosting && s.creatures.every(c => c.mode !== 'flee')")
        self.assertGreater(math.dist(list(self.state()["position"].values()), list(before["position"].values())), .2)

    def test_capture_cancel_coins_reload_and_respawn(self):
        self.reset()
        self.page.keyboard.down("KeyQ")
        try:
            self.wait("s.creatures.some(c => c.capture > .2)")
        finally:
            self.page.keyboard.up("KeyQ")
        self.wait("s.captureTarget === null && s.creatures.every(c => c.capture === 0)")
        self.assertEqual(self.state()["totalCaptured"], 0)
        self.assertEqual(self.state()["drops"], [])
        self.assertEqual(self.state()["respawns"], [])
        self.reset()
        self.page.keyboard.down("KeyQ")
        try:
            self.wait("s.creatures.some(c => c.capture > .25)")
            self.screenshot("capturing")
            self.wait("s.totalCaptured === 1")
        finally:
            self.page.keyboard.up("KeyQ")
        captured = self.state()
        self.assertEqual(len(captured["creatures"]), 8)
        self.assertEqual(len(captured["drops"]), 3)
        self.assertEqual(len(captured["respawns"]), 1)
        self.assertGreater(captured["respawns"][0]["delay"], 8)
        self.assertEqual(captured["pearls"], 0)
        self.screenshot("coins")
        self.page.reload(wait_until="domcontentloaded")
        self.wait("s.ready && s.totalCaptured === 1")
        restored = self.state()
        self.assertEqual(len(restored["respawns"]), 1)
        self.assertEqual(sum(d["value"] for d in restored["drops"]) + restored["pearls"], 12)
        self.wait("s.pearls === 12")
        self.wait("s.respawns.length === 0 && s.creatures.length === 9 && s.events.respawn === 1", timeout=20000)
        self.assertEqual(self.state()["totalCaptured"], 1)
        self.assertEqual(self.state()["pearls"], 12)
        self.screenshot("respawned")
        self.page.reload(wait_until="domcontentloaded")
        self.wait("s.ready && s.pearls === 12 && s.creatures.length === 9")
        self.assertEqual(self.state()["totalCaptured"], 1)

    def test_observation_controls_and_reset(self):
        self.page.get_by_role("button", name="慢动作").click()
        self.wait("s.timeScale === .25")
        before = self.state()["time"]
        self.page.wait_for_timeout(1000)
        elapsed = self.state()["time"] - before
        self.assertGreater(elapsed, .1)
        self.assertLess(elapsed, .5)
        self.page.get_by_role("button", name="显示状态").click()
        self.wait("!s.helpers")
        self.assertEqual(self.page.locator(".label:visible").count(), 0)
        yaw = self.state()["yaw"]
        self.page.mouse.move(500, 400)
        self.page.mouse.down()
        self.page.mouse.move(700, 400, steps=12)
        self.page.mouse.up()
        self.wait(f"Math.abs(s.yaw - ({yaw})) > .2")
        self.reset()
        self.assertEqual(self.state()["pearls"], 0)
        self.assertEqual(len(self.state()["creatures"]), 9)


if __name__ == "__main__":
    program = unittest.main(verbosity=2, exit=False)
    raise SystemExit(0 if program.result.testsRun > 0 and program.result.wasSuccessful() else 1)
