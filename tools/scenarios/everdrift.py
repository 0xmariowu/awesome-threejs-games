"""Castle gusts, a painting journey, and Top of the Toy Box platforming."""

import asyncio
import importlib.util
import time
from pathlib import Path

from record import Shot

# Reuse the verified real-input entry helpers without changing the playthrough.
_spec = importlib.util.spec_from_file_location(
    '_everdrift_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'everdrift.py')
_game = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_game)
hold = _game._hold
tap = _game._tap


async def prepare(page):
    # Visit both areas before capture so their first-load work is unrecorded.
    await _game._drift_select(page)
    await _game._select_mission(page, 'drift_isles', 0)
    await asyncio.sleep(3)
    # Disable the game's tutorial cards through its ordinary settings UI.
    await tap(page, 'p')
    await tap(page, 'ArrowDown')
    await tap(page, 'Space')
    await _game._wait_text(page, 'Show hints')
    await page.mouse.click(620, 334)
    await page.mouse.click(640, 652)
    await asyncio.sleep(.3)
    start = len(await _game._logs(page))
    await page.mouse.click(850, 440)  # Exit Course.
    await _game._wait_log(page, 'drift_isles -> castle', start)
    await asyncio.sleep(1)
    # Reset this disposable save through the title UI. The first visit has
    # warmed the renderer, while a fresh save restores the known foyer entry.
    await tap(page, 'p')
    await _game._wait_text(page, 'Title Screen')
    await page.mouse.click(850, 480)
    await _game._wait_text(page, 'New Game')
    await asyncio.sleep(1)
    await page.mouse.click(260, 414)
    await _game._wait_text(page, 'Start over')
    await page.mouse.click(240, 594)
    await _game._wait_text(page, 'Dear Monk')
    await _game._dialog(page, letter=True)
    await _game._wait_hud(page)
    await _game.castle(page, create_save=False, greeting=True)
    await asyncio.sleep(3)


async def overview(page, _cue):
    began = time.monotonic()
    # 0-16 s: moonlit foyer, coins, wind gusts and a measured camera turn.
    await hold(page, 'w', .8)
    await tap(page, 'l')
    await hold(page, 'Space', .4)
    await asyncio.sleep(.12)
    await hold(page, 'Space', .4)
    await asyncio.sleep(1.2)
    await hold(page, 's', .8)
    await tap(page, 'q')
    await asyncio.sleep(.7)
    await tap(page, 'e')
    await asyncio.sleep(.7)
    # Sweep across the moonlit room, then restore the entry camera.
    for key in ('q', 'q', 'e', 'e'):
        await tap(page, key)
        await asyncio.sleep(1)
    await tap(page, 'l')
    await hold(page, 'Space', .4)
    await asyncio.sleep(.12)
    await hold(page, 'Space', .4)
    await asyncio.sleep(1.3)

    # Walk around the foyer brazier into the west-wall painting.
    start = len(await _game._logs(page))
    await hold(page, 'w', 1.3)
    await hold(page, 'a', 1.2)
    await hold(page, 'w', .6)
    await hold(page, 'w+d', 1.27)
    await hold(page, 'w+Space', .5)
    await _game._wait_log(page, 'painting drift -> drift_isles', start, timeout=8)
    await asyncio.sleep(1.8)
    await _game._select_mission(page, 'drift_isles', 0)

    # Spring launch, hub rim and stepping stones to the Toy Box checkpoint.
    await hold(page, 'w', 2)
    await asyncio.sleep(.8)
    await hold(page, 'd', 1)
    await hold(page, 'w', 1.1)
    await tap(page, 'e')
    await asyncio.sleep(.4)
    await hold(page, 'w', .35)
    await hold(page, 'w+d+Space', .2)
    await hold(page, 'w+Space', .4)
    await asyncio.sleep(1)
    await hold(page, 'w+Space', .5)
    await asyncio.sleep(.1)
    await hold(page, 'w+Space', .55)
    await asyncio.sleep(.9)

    # Face the colourful blocks and use double jumps to climb the low tiers.
    await tap(page, 'q')
    await tap(page, 'q')
    await asyncio.sleep(.6)
    await hold(page, 'w+Space', .4)
    await asyncio.sleep(.12)
    await hold(page, 'w+Space', .35)
    await asyncio.sleep(1)
    await tap(page, 'e')
    await tap(page, 'e')
    await asyncio.sleep(.5)
    await hold(page, 'w+Space', .4)
    await asyncio.sleep(.12)
    await hold(page, 'w+Space', .35)
    await asyncio.sleep(1)

    # One paced full orbit with vertical double jumps reveals the windmill,
    # sea and toy platforms while returning to the exact climbing heading.
    for index in range(8):
        await tap(page, 'e')
        await asyncio.sleep(1.35)
        if index % 2 == 1:
            await hold(page, 'Space', .4)
            await asyncio.sleep(.12)
            await hold(page, 'Space', .4)
            await asyncio.sleep(1.2)
    # Keep the summit after 57 s without leaving a long stationary tail.
    while time.monotonic() - began < 57:
        await hold(page, 'Space', .4)
        await asyncio.sleep(.12)
        await hold(page, 'Space', .4)
        await asyncio.sleep(1.2)

    # Verified blue -> yellow -> pink climb, ending on the real star award.
    start = len(await _game._logs(page))
    await tap(page, 'e')
    await tap(page, 'e')
    await asyncio.sleep(.4)
    await hold(page, 'w+Space', .48)
    await asyncio.sleep(.65)
    await tap(page, 'e')
    await asyncio.sleep(.4)
    await hold(page, 'w+Space', .5)
    await _game._wait_log(page, 'STAR GET drift_1', start, timeout=3)
    await asyncio.sleep(1.8)


SHOTS = {
    'overview': Shot(
        url=_game.URL, module=None, serve=['everdrift'],
        prepare=prepare, run=overview, overlay=False, min_fps=45,
        poster_at=44, preview_at=28),
}
