"""A 75-second continuous outing: catch a fish, then cruise from two cameras."""

import asyncio
import math
import time

from playthrough import Controls, load_module
from record import ROOT, Shot

# Reuse the verified entry route and read-only state observer unchanged.
game = load_module(ROOT, 'tidewater')


async def prepare(page):
    await game.enter_deck(page)
    await game.face(page, 0)
    await page.keyboard.press('r')
    await page.wait_for_function('__app.game.rod.equipped')
    await asyncio.sleep(2)


async def catch_one(page):
    """One real cast and tension fight; stop before starting another cast."""
    initial = (await game.state(page))['fish']
    deadline = time.monotonic() + 35
    reeling = False
    try:
        while time.monotonic() < deadline:
            s = await game.state(page)
            if s['fish'] > initial:
                return
            if s['fight']:
                want = s['fight']['tension'] < (0.86 if reeling else 0.60)
                if want != reeling:
                    await (page.mouse.down() if want else page.mouse.up())
                    reeling = want
            else:
                if reeling:
                    await page.mouse.up()
                    reeling = False
                if s['rod'] == 'idle':
                    await page.mouse.move(640, 360)
                    await page.mouse.down()
                    await asyncio.sleep(0.35)
                    await page.mouse.up()
                elif s['bite'] == 'take':
                    await page.mouse.down()
                    await asyncio.sleep(0.07)
                    await page.mouse.up()
            await asyncio.sleep(0.1)
        raise AssertionError('No real catch within the opening fishing sequence')
    finally:
        await page.mouse.up()


async def turn_to_helm(page):
    # The verified face() helper is ideal in prepare; spread the filmed turn
    # over four seconds instead, using the same unlocked right-drag controls.
    await page.keyboard.press('Escape')
    yaw = (await game.state(page))['yaw']
    delta = (math.pi - yaw + math.pi) % (2 * math.pi) - math.pi
    for _ in range(4):
        await Controls(page).drag(-delta / 0.0022 / 4, 0, 1, button='right')
    await Controls(page).hold('w', 0.9)
    await Controls(page).hold('d', 0.3)
    await page.wait_for_function('__app.player.prompt?.text === "Take the helm"', timeout=4000)
    await page.keyboard.press('e')
    await page.wait_for_function('__app.player.mode === "boat"')


async def overview(page, _cue):
    began = time.monotonic()
    ctl = Controls(page)
    await catch_one(page)
    await asyncio.sleep(3)
    await page.keyboard.press('Escape')
    await page.keyboard.press('r')
    await page.wait_for_function('!__app.game.rod.equipped')
    await turn_to_helm(page)

    # Leave the pier straight ahead. Hold a steady throttle through one broad
    # turn; the game's chase camera supplies its own gentle follow motion.
    origin = (await game.state(page))['boat']
    await page.keyboard.down('w')
    try:
        await asyncio.sleep(9)
        await ctl.hold('a', 2)
        # Keep the poster and eight-second preview entirely in the wake view,
        # independent of how long the randomly selected fish took to land.
        await asyncio.sleep(max(0, began + 57 - time.monotonic()))
        p = (await game.state(page))['boat']
        assert math.hypot(p['x'] - origin['x'], p['z'] - origin['z']) > 12
        await page.keyboard.press('v')
        await page.wait_for_function('__app.player.camMode === "first"')
        await asyncio.sleep(9)
        await page.keyboard.press('v')
        await page.wait_for_function('__app.player.camMode === "third"')
        await asyncio.sleep(max(0, began + 75 - time.monotonic()))
    finally:
        await page.keyboard.up('w')


SHOTS = {
    'overview': Shot(
        url=game.URL, module=None, serve=game.SERVE,
        prepare=prepare, run=overview, overlay=False, min_fps=45,
        poster_at=50, preview_at=48),
}
