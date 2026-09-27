"""Exercise every destination and locomotion mode advertised by the original HUD.

Inventory: public/index.html and public/src/main.js VIEWS (1--5), plus
core/player.js (F flight, E/Q altitude, native drag-look fallback). This is one
continuous walking world, not a campaign: graphics quality, mute and hide-UI
are settings; shops are geometry in Street, not separately selectable levels.
Trains/vehicles have no player driving/boarding mode or remote service. The
train collider is a solid moving box even when its decorative doors are open.

All entry and movement uses the real Start button, keyboard and mouse. Reading
the game's existing __ctx diagnostics only verifies input and records evidence;
we never set player poses, advance simulation time, or replace pointer lock.
"""

import asyncio
import json
import math
from pathlib import Path

from playthrough import Mode


SERVE = ["sakuragaoka-station"]
URL = "http://127.0.0.1:8092/index.html"
OUT = Path(__file__).resolve().parents[2] / "output/playthrough/sakuragaoka-station"


async def state(page):
    return await page.evaluate("""() => {
      const c = window.__ctx, p = c.playerObj;
      return {position: p.pos.toArray(), yaw: p.yaw, pitch: p.pitch,
        distance: p.distance, fly: p.fly, time: c.time,
        trains: c.services.rail.trains.map(t => ({id: t.id, x: t.x,
          speed: t.speed, doors: t.doorsOpen, visible: t.visible})),
        barrier: c.services.crossing.barrierDown,
        buildErrors: window.__errors};
    }""")


async def look(page, yaw, pitch=0):
    """Turn to degrees using native mouse input, including drag-look fallback."""
    for _ in range(8):
        current = await state(page)
        dyaw = (math.radians(yaw) - current["yaw"] + math.pi) % (2 * math.pi) - math.pi
        dpitch = math.radians(pitch) - current["pitch"]
        if abs(dyaw) < 0.012 and abs(dpitch) < 0.012:
            return
        locked = await page.evaluate("!!document.pointerLockElement")
        sensitivity = 0.0022 * (1 if locked else 1.4)
        dx = max(-480, min(480, -dyaw / sensitivity))
        dy = max(-260, min(260, -dpitch / sensitivity))
        await page.mouse.move(640, 340)
        if not locked:
            await page.mouse.down()
        try:
            await page.mouse.move(640 + dx, 340 + dy, steps=12)
        finally:
            if not locked:
                await page.mouse.up()
        await asyncio.sleep(0.08)
    raise AssertionError("Native mouse look did not reach the requested direction")


def entrance(key, *, flight=False):
    async def enter(page):
        await page.locator("#go:enabled").wait_for()
        await page.get_by_role("button", name="散策をはじめる · Start walking").click()
        await page.locator("#intro").wait_for(state="hidden")
        await page.wait_for_function("window.__ctx?.playerObj.enabled === true")
        await page.keyboard.press(key)
        await asyncio.sleep(0.25)
        if flight:
            await page.keyboard.press("f")
        current = await state(page)
        assert current["fly"] is flight, "Location/flight shortcut did not take effect"
        assert not current["buildErrors"], current["buildErrors"]
        # Check the destination selected by the genuine 1--5 HUD shortcuts.
        x, _, z = current["position"]
        expected = {"1": (1.6, 34), "2": (9.5, -9), "3": (20, -37.6),
                    "4": (-12.8, -31.5), "5": (-20, -92.8)}[key]
        assert math.hypot(x - expected[0], z - expected[1]) < 0.5
    return enter


class Evidence:
    """Small read-only input/rail log alongside the runner's frame evidence."""

    def __init__(self, name):
        self.filename = name + "-input.json"
        self.samples = []

    async def sample(self, page, action):
        current = await state(page)
        self.samples.append(dict(action=action, **current))
        directory = getattr(page, '_playthrough_directory', OUT)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / self.filename).write_text(json.dumps(self.samples, indent=2) + "\n", encoding="utf-8")
        assert not current["buildErrors"], current["buildErrors"]
        return current

    async def move(self, page, ctl, key, seconds, *, run=False):
        before = await self.sample(page, "before " + key)
        if run:
            await page.keyboard.down("Shift")
        try:
            await ctl.hold(key, seconds)
        finally:
            if run:
                await page.keyboard.up("Shift")
        after = await self.sample(page, "after " + key)
        displacement = math.dist(before["position"], after["position"])
        assert displacement > 0.3, f"{key}: player failed to move ({displacement:.3f} m)"


async def street(page, ctl):
    evidence = Evidence("street")
    while True:
        await ctl.tap("1")
        await look(page, 0)
        await evidence.move(page, ctl, "w", 5)
        await look(page, -65)
        await evidence.move(page, ctl, "s", 0.7)
        await look(page, 0)
        await evidence.move(page, ctl, "s", 5)
        await ctl.tap("Space")
        await look(page, 65)
        await evidence.move(page, ctl, "s", 0.7)
        # Walk south past the bookshop, ramen shop and bicycle workshop too.
        await ctl.tap("1")
        await look(page, 180)
        await evidence.move(page, ctl, "w", 4, run=True)
        await look(page, 120)
        await evidence.move(page, ctl, "s", 0.7)


async def plaza(page, ctl):
    evidence = Evidence("plaza")
    while True:
        await ctl.tap("2")
        await look(page, 12)
        await evidence.move(page, ctl, "w", 2.5)
        await look(page, -45)
        await evidence.move(page, ctl, "s", 1)
        await look(page, 12)
        await evidence.move(page, ctl, "s", 2)
        await look(page, 75)
        await evidence.move(page, ctl, "w", 1.4)
        await ctl.tap("Space")
        await evidence.move(page, ctl, "s", 1.4)


async def railway(page, ctl, name):
    evidence = Evidence(name)
    first = await evidence.sample(page, "start timetable observation")
    checked_cycle = False
    while True:
        # Stay on the platform / south approach while actively walking and
        # looking at the railway. Short strafes avoid tracks and closing gates.
        await ctl.tap("3" if name == "platform" else "4")
        await look(page, 0)
        duration = 2.2 if name == "platform" else 0.45
        for yaw in (-22, 22):
            await look(page, yaw)
            await evidence.move(page, ctl, "a", duration)
            await evidence.move(page, ctl, "d", duration)
        current = await evidence.sample(page, "timetable observation")
        if not checked_cycle and current["time"] - first["time"] >= 120:
            for train in ("A", "B"):
                states = [t for s in evidence.samples for t in s["trains"] if t["id"] == train]
                assert any(t["speed"] > 1 for t in states), train + " never moved"
                assert any(t["doors"] > 0.9 for t in states), train + " doors never opened"
                assert any(t["doors"] < 0.1 for t in states), train + " doors never closed"
            assert min(s["barrier"] for s in evidence.samples) < 0.1
            assert max(s["barrier"] for s in evidence.samples) > 0.9
            checked_cycle = True
            await evidence.sample(page, "verified full 120-second train/barrier cycle")


async def platform(page, ctl):
    await railway(page, ctl, "platform")


async def crossing(page, ctl):
    await railway(page, ctl, "crossing")


async def levee(page, ctl):
    evidence = Evidence("levee")
    while True:
        await ctl.tap("5")
        await look(page, 90)
        await evidence.move(page, ctl, "w", 4)
        await look(page, 0, -8)
        await evidence.move(page, ctl, "d", 4)
        await look(page, 180)
        await evidence.move(page, ctl, "a", 3)
        await look(page, 90)
        await evidence.move(page, ctl, "w", 3)


async def flight(page, ctl):
    evidence = Evidence("flight")
    await evidence.move(page, ctl, "e", 2.8)
    while True:
        # A square over the town, with real ascent and descent controls.
        for yaw in (0, -90, 180, 90):
            await look(page, yaw, -20)
            await evidence.move(page, ctl, "w", 3)
        await evidence.move(page, ctl, "q", 0.7)
        await evidence.move(page, ctl, "e", 0.7)


MODES = [
    Mode("street", entrance("1"), street, seconds=50,
         note="Start walking → 1 Street; walk/run both directions past the shops, look, jump."),
    Mode("plaza", entrance("2"), plaza, seconds=40,
         note="Start walking → 2 Plaza; walk around the station forecourt, turn and jump."),
    Mode("platform", entrance("3"), platform, seconds=150,
         note="Start walking → 3 Platform; walk/strafe and look for longer than the 120 s train loop. "
              "Read-only input log verifies both trains moving, doors opening/closing and barrier cycling. "
              "Trains are solid moving colliders, not boardable or drivable vehicles."),
    Mode("crossing", entrance("4"), crossing, seconds=150,
         note="Start walking → 4 Crossing; walk and look on the south approach through a full "
              "120 s cycle of both trains, warning lights and moving barriers."),
    Mode("levee", entrance("5"), levee, seconds=45,
         note="Start walking → 5 Levee; walk the embankment and look across the river and town."),
    Mode("flight", entrance("1", flight=True), flight, seconds=45,
         note="Start walking → F Fly; E ascent, WASD flight, mouse look and Q descent. "
              "This is the original noclip flight control, without a pointer-lock shim."),
]
