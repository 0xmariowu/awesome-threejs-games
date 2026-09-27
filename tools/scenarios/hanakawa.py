"""A 75-second river journey: village, temple waterfront and stone bridge.

Only ordinary boat controls and the follow/helm camera key change the world.
Startup and the approach to the village happen before capture. Read-only route
telemetry and entry helpers come from the verified playthrough, without its
Evidence writer or reset-on-grounding behavior.
"""

import asyncio
import importlib.util
import math
import time
from pathlib import Path

from record import Shot


# playthrough.py is a module, so its sibling scenario directory is not an
# importable package. Load the original helpers without copying their route.
_spec = importlib.util.spec_from_file_location(
    '_hanakawa_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'hanakawa.py',
)
_play = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_play)


async def sail(page, seconds, *, goal=None, helm_at=None):
    """Use the verified centreline/bridge-arch steering with a damped rudder."""
    held = set()
    began = time.monotonic()
    progress_at, progress_s = began, None
    switched = False
    try:
        while time.monotonic() - began < seconds:
            now = time.monotonic()
            state = await _play.state(page, goal=goal)
            if state['ui'] != 'play' or state['docked']:
                raise RuntimeError('River journey unexpectedly stopped')
            if goal is not None and state['s'] >= goal:
                return
            if helm_at is not None and not switched and now - began >= helm_at:
                await page.keyboard.press('c')
                await page.wait_for_function(
                    'window.__luma.ctx.cameraRig.mode === "helm"')
                switched = True

            angle = math.atan2(state['tx'] - state['x'],
                               -(state['tz'] - state['z']))
            error = (angle - state['heading'] + math.pi) % (2 * math.pi) - math.pi
            steering = error + state['yaw'] * 1.8
            keys = {'w'}
            if steering > .045:
                keys.add('d')
            elif steering < -.045:
                keys.add('a')
            for key in held - keys:
                await page.keyboard.up(key)
            for key in keys - held:
                await page.keyboard.down(key)
            held = keys

            if progress_s is None or abs(state['s'] - progress_s) > 3:
                progress_s, progress_at = state['s'], now
            elif now - progress_at > 8:
                raise RuntimeError('Boat stopped making progress; reject the take')
            await asyncio.sleep(min(.2, max(0, began + seconds - time.monotonic())))
        if goal is not None:
            raise RuntimeError('Village approach did not finish before capture')
    finally:
        for key in held:
            await page.keyboard.up(key)


async def prepare(page):
    await _play.ready(page)
    await _play.cast_off(page)
    await sail(page, 30, goal=250)
    await page.mouse.move(1270, 710)


async def overview(page, _cue):
    # 0-25s: village bridge and pagoda; 25-43s: temple and willow banks;
    # 43-75s: helm view through Spectacles Bridge and into the next reach.
    await sail(page, 75, helm_at=43)


SHOTS = {
    'overview': Shot(
        url=_play.URL, module=None, serve=_play.SERVE,
        prepare=prepare, run=overview,
        poster_at=18, preview_at=8, overlay=False, min_fps=45,
    ),
}
