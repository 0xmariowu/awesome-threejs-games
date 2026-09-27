"""75 seconds of Sunbreak Circuit: pack racing, drifting and item combat.

Menus, asset loading and the countdown finish before capture. The verified
playthrough supplies both menu entry and keyboard driving; its race feedback
is read-only. No bots, race state, camera or archive assets are modified.
"""

import asyncio
from contextlib import suppress
import importlib.util
from pathlib import Path

from record import Shot


spec = importlib.util.spec_from_file_location(
    '_tableparty_kart_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'tableparty-kart.py')
playthrough = importlib.util.module_from_spec(spec)
spec.loader.exec_module(playthrough)


class Controls:
    """The small input interface consumed by the verified driving helper."""

    def __init__(self, page):
        self.page = page

    async def tap(self, key):
        await self.page.keyboard.press(key, delay=60)

    async def wait(self, seconds):
        await asyncio.sleep(seconds)


async def drive_for(page, seconds):
    task = asyncio.create_task(playthrough.drive(page, Controls(page)))
    try:
        done, _ = await asyncio.wait({task}, timeout=seconds)
        if done:
            # Propagate actual input/page failures instead of hiding them as
            # the normal end of this timed recording.
            await task
            raise RuntimeError('Driving ended before the shot was complete')
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


async def prepare(page):
    await playthrough.race_entry(
        'Sunbreak Circuit', 'Sunrise Cup', 'Pip', 'Easy')(page)
    # Begin already accelerating with the pack; no idle grid or countdown.
    await drive_for(page, 2)
    await page.mouse.move(1270, 710)


async def overview(page, _cue):
    # Continuous chase camera: opening pack, coastal bends, boost strips,
    # item boxes and drift releases, then another lap through the scenery.
    await drive_for(page, 75)


SHOTS = {
    'overview': Shot(
        url=playthrough.URL, module=None, serve=playthrough.SERVE,
        prepare=prepare, run=overview, overlay=False,
        poster_at=18, preview_at=16, min_fps=45),
}
