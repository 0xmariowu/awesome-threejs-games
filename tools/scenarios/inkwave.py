"""A continuous Tidewater turf-war round, driven by normal game controls.

Paint the approach, swim through the ink, throw bombs and earn a splashdown.
The menu/intro and camera settling happen before capture; no caption cues.
"""

import asyncio
import importlib.util
import json
import math
import time
from pathlib import Path

from record import Shot
from playthrough import POINTER_LOCK_SCRIPT


_spec = importlib.util.spec_from_file_location(
    '_inkwave_playthrough', Path(__file__).resolve().parents[1] / 'playthrough/inkwave.py')
_playthrough = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_playthrough)


async def hold(page, keys, seconds, fire=False):
    keys = keys.split('+') if keys else []
    try:
        for key in keys:
            await page.keyboard.down(key)
        if fire:
            await page.mouse.down()
        await asyncio.sleep(seconds)
    finally:
        await page.mouse.up()
        for key in reversed(keys):
            await page.keyboard.up(key)


async def prepare(page):
    await _playthrough._entry('tidewater', 'shooter', 'easy', 180)(page)
    # Centre the mouse first, then correct the resulting look with real input.
    await page.mouse.move(640, 360)
    await asyncio.sleep(.15)
    yaw, pitch = await page.evaluate('[__G.rig.yaw, __G.rig.pitch]')
    yaw = (yaw + math.pi) % (2 * math.pi) - math.pi
    await page.mouse.move(640 + yaw / .0021, 360 + (pitch + .24) / .0021)
    page._inkwave_mouse = [640 + yaw / .0021, 360 + (pitch + .24) / .0021]
    await hold(page, 'w', 1.5, fire=True)
    await asyncio.sleep(.5)
    assert (await _playthrough._state(page))['locked']


async def aim(page):
    """Track the nearest visible opponent with a slow, continuous mouse turn."""
    view = await page.evaluate('''() => {
      const g = __G, a = g.match.local, c = g.camera.position;
      const enemies = g.actors.filter(e => e.alive && e.team !== a.team
        && e.pos.distanceTo(a.pos) < 22
        && g.physics.los(c, e.pos.clone().setY(e.pos.y + 1)))
        .sort((a1, b) => a1.pos.distanceTo(a.pos) - b.pos.distanceTo(a.pos));
      const e = enemies[0];
      return {yaw: g.rig.yaw, pitch: g.rig.pitch,
        target: e ? [e.pos.x-c.x, e.pos.y+1-c.y, e.pos.z-c.z] : null};
    }''')
    yaw, pitch = 0, -.24
    if view['target']:
        x, y, z = view['target']
        yaw = math.atan2(x, z)
        pitch = math.atan2(y, math.hypot(x, z))
    delta = (yaw - view['yaw'] + math.pi) % (2 * math.pi) - math.pi
    dx = -max(-.065, min(.065, delta)) / .0021
    dy = -max(-.035, min(.035, pitch - view['pitch'])) / .0021
    mouse = page._inkwave_mouse
    mouse[0] += dx
    mouse[1] += dy
    await page.mouse.move(*mouse)
    return view['yaw']


async def travel(page, x, z, seconds, swim=False):
    """Follow a clear lane while gently aiming toward visible opponents.

    Read position only to release movement on arrival, avoiding wall-running.
    """
    until = time.monotonic() + seconds
    held = set()
    refilling = swim
    if swim:
        await page.keyboard.down('Shift')
    else:
        await page.mouse.down()
    try:
        while time.monotonic() < until:
            state = await _playthrough._state(page)
            assert state['alive'] and state['state'] == 'playing', state
            yaw = await aim(page)
            if not swim:
                if state['ink'] < 25 and not refilling:
                    await page.mouse.up()
                    await page.keyboard.down('Shift')
                    refilling = True
                elif state['ink'] > 95 and refilling:
                    await page.keyboard.up('Shift')
                    await page.mouse.down()
                    refilling = False
                if state['specialReady']:
                    await page.keyboard.up('Shift')
                    refilling = False
                    await page.keyboard.press('f', delay=180)
            px, _, pz = state['pos']
            dx, dz = x - px, z - pz
            forward = dx * math.sin(yaw) + dz * math.cos(yaw)
            right = -dx * math.cos(yaw) + dz * math.sin(yaw)
            wanted = set()
            if abs(right) > .7:
                wanted.add('d' if right > 0 else 'a')
            if abs(forward) > .7:
                wanted.add('w' if forward > 0 else 's')
            for key in held - wanted:
                await page.keyboard.up(key)
            for key in wanted - held:
                await page.keyboard.down(key)
            held = wanted
            await asyncio.sleep(.1)
    finally:
        await page.mouse.up()
        await page.keyboard.up('Shift')
        for key in held:
            await page.keyboard.up(key)


async def bomb(page):
    if (await _playthrough._state(page))['ink'] >= 70:
        await hold(page, 'e', .5)
        await asyncio.sleep(.3)


async def overview(page, _cue):
    began = time.monotonic()
    # 0–20 s: paint the approach, swim the trail, then take the left flank.
    for x, z in [(-3, -29), (-14, -25), (-18, -24), (-19, -17)]:
        await travel(page, x, z, 4)
    await travel(page, -19, -23, 3, swim=True)
    await bomb(page)
    # 20–44 s: cover the lane and its ramp; earned specials fire naturally.
    for x, z in [(-19, -16), (-21, -13), (-16, -13), (-19, -20)]:
        await travel(page, x, z, 5)
    await hold(page, 'Shift', 2)
    await bomb(page)
    # 44–62 s: paint a retreat through the back lane as the bots push forward.
    for x, z in [(-18, -25), (-4, -30), (1, -32)]:
        await travel(page, x, z, 5)
    await travel(page, -3, -32, max(0, 62 - (time.monotonic() - began)))
    state = await _playthrough._state(page)
    assert state['turf'] > 100 and state['deaths'] == 0 and state['specials'] > 0, state
    print('inkwave overview: ' + json.dumps(state), flush=True)


SHOTS = {
    'overview': Shot(
        url=_playthrough.URL, module=None, serve=['inkwave'],
        prepare=prepare, run=overview, init_script=POINTER_LOCK_SCRIPT,
        poster_at=26, preview_at=24, overlay=False, min_fps=45),
}
