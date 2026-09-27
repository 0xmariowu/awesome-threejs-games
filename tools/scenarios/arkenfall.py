"""An 82-second, input-only journey from Kettle Ford into Whisperpine.

The verified playthrough supplies entry, navigation and reactive combat.
Only read-only game telemetry is used; no saves or game state are injected.
The shared headless pointer-lock shim retains Chrome's actual mouse input.
"""

import asyncio
import importlib.util
import time
from pathlib import Path

from playthrough import POINTER_LOCK_SCRIPT
from record import Shot

_spec = importlib.util.spec_from_file_location(
    '_arkenfall_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'arkenfall.py')
_play = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_play)


async def prepare(page):
    await _play.begin(page)
    for x, z in [(-61, 302), (-40, 280), (-35, 248)]:
        await _play.navigate(page, x, z, radius=1.5)
    await asyncio.sleep(2)
    assert not (await _play.state(page))['engaged']


async def overview(page, _cue):
    began = time.monotonic()
    # 0-7s: the village vista and the original waystone rethreading ritual.
    await asyncio.sleep(2)
    await _play.tap(page, 'e')
    await page.wait_for_function('__game.gameplay.snapshot().lit.includes("kettleford")')
    await asyncio.sleep(3)
    print('  waystone: %.1fs' % (time.monotonic() - began), flush=True)
    # 7-42s: cross the ford and flower meadow toward the monumental hand.
    for x, z in [(-80, 258), (-140, 210), (-210, 154)]:
        await _play.navigate(page, x, z, radius=3)
    print('  hand: %.1fs' % (time.monotonic() - began), flush=True)
    await asyncio.sleep(2)
    # 42-62s: approach the three fraylings, lock on, lash, cleave and parry.
    camp_alive = '''() => __game.enemies.active.filter(e => e.alive &&
        Math.hypot(e.position.x + 228, e.position.z - 88) < 35).length'''
    before = await page.evaluate(camp_alive)
    assert before >= 3, 'The frayling encounter is missing'
    await _play.navigate(page, -228, 88, radius=3)
    await _play.clear_combat(page)
    assert await page.evaluate(camp_alive) < before, 'No frayling was defeated'
    print('  combat: %.1fs' % (time.monotonic() - began), flush=True)
    # Finish with a steady walk into the fern-covered forest, then settle.
    await _play.navigate(page, -255, 78, radius=3)
    remaining = 82 - (time.monotonic() - began)
    assert remaining >= 0, 'Campaign route exceeded its recording budget'
    await _play.hold(page, 'w', max(0, remaining - 2))
    await asyncio.sleep(2)
    status = await _play.state(page)
    assert status['alive'] and status['control'] and not status['failed']


SHOTS = {
    'overview': Shot(
        url=_play.URL, module=None, serve=_play.SERVE,
        prepare=prepare, run=overview, overlay=False,
        init_script=POINTER_LOCK_SCRIPT,
        poster_at=29, preview_at=52, min_fps=45),
}
