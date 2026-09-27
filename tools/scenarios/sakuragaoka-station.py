"""A quiet, roughly 75-second walk through the town and its working railway.

Entry and mouse sensitivity follow tools/playthrough/sakuragaoka-station.py.
Only native controls change the world; __ctx is read for timing/input checks.
The train's real timetable is awaited before capture, never advanced by script.
"""

import asyncio
import math
import time

from record import Shot


async def state(page):
    return await page.evaluate("""() => {
        const c = window.__ctx, p = c.playerObj;
        return {position: p.pos.toArray(), yaw: p.yaw, pitch: p.pitch,
                fly: p.fly, time: c.time, errors: window.__errors};
    }""")


async def hold(page, keys, seconds):
    keys = keys.split('+')
    try:
        for key in keys:
            await page.keyboard.down(key)
        await asyncio.sleep(seconds)
    finally:
        for key in reversed(keys):
            await page.keyboard.up(key)


async def look(page, yaw, pitch=0, seconds=3):
    """The verified native drag-look input, paced with a gentle ease in/out."""
    current = await state(page)
    dyaw = (math.radians(yaw) - current['yaw'] + math.pi) % (2 * math.pi) - math.pi
    dpitch = math.radians(pitch) - current['pitch']
    locked = await page.evaluate('!!document.pointerLockElement')
    sensitivity = .0022 * (1 if locked else 1.4)
    dx, dy = -dyaw / sensitivity, -dpitch / sensitivity
    # Keep every drag inside the canvas; reposition only with the button up.
    chunks = max(1, math.ceil(abs(dx) / 800), math.ceil(abs(dy) / 450))
    for _ in range(chunks):
        x, y = 640 - dx / chunks / 2, 360 - dy / chunks / 2
        if not locked:
            await page.mouse.move(x, y)
            await page.mouse.down()
        else:
            mouse = await page.evaluate('({x: innerWidth / 2, y: innerHeight / 2})')
            x, y = mouse['x'], mouse['y']
        began = time.monotonic()
        steps = max(2, round(seconds / chunks * 60))
        try:
            for step in range(1, steps + 1):
                u = step / steps
                eased = u * u * (3 - 2 * u)
                await page.mouse.move(x + dx / chunks * eased, y + dy / chunks * eased)
                await asyncio.sleep(max(0, began + seconds / chunks * u - time.monotonic()))
        finally:
            if not locked:
                await page.mouse.up()
    await asyncio.sleep(.05)
    current = await state(page)
    error = (math.radians(yaw) - current['yaw'] + math.pi) % (2 * math.pi) - math.pi
    assert abs(error) < .025 and abs(math.radians(pitch) - current['pitch']) < .025


async def prepare(page):
    # Minimal entry helper copied from the verified playthrough.
    await page.locator('#go:enabled').wait_for()
    await page.get_by_role('button', name='散策をはじめる · Start walking').click()
    await page.locator('#intro').wait_for(state='hidden')
    await page.wait_for_function('window.__ctx?.playerObj.enabled === true')
    await page.keyboard.press('1')
    await asyncio.sleep(.25)
    current = await state(page)
    x, _, z = current['position']
    assert math.hypot(x - 1.6, z - 34) < .5 and not current['fly']
    assert not current['errors'], current['errors']
    # H is the game's own hide-UI control (including its location toast).
    await page.keyboard.press('h')
    await look(page, 0, 0, seconds=.5)
    # Start at t=18: A closes its doors at clip ~26 s and departs at ~30 s.
    await page.wait_for_function(
        'window.__ctx.time % 120 >= 18 && window.__ctx.time % 120 < 18.15',
        timeout=125000, polling='raf')


async def overview(page, _cue):
    # 0--16 s: shops, falling petals and the cherry-lined main street.
    await hold(page, 'w', 5)
    await look(page, -30, seconds=3)
    await hold(page, 's', 2)
    await look(page, 12, seconds=3)
    await hold(page, 'w', 3)

    # 16--34 s: walk the platform, watch open doors close and A depart.
    await page.keyboard.press('3')
    await hold(page, 'w', 2)
    await look(page, 30, seconds=4)
    await asyncio.sleep(1)
    await hold(page, 'a', 2)
    await asyncio.sleep(1)
    await look(page, 0, seconds=2)
    await asyncio.sleep(6)

    # 34--44 s: the same departing train passes the active level crossing.
    await page.keyboard.press('4')
    await hold(page, 's', .6)
    await look(page, 0, seconds=2)
    await asyncio.sleep(5)
    await look(page, -18, seconds=2)

    # 44--60 s: stroll the blossom-covered levee and reveal the river.
    await page.keyboard.press('5')
    await look(page, 90, -2, seconds=4)
    await hold(page, 'w', 5)
    await look(page, 0, -8, seconds=4)
    await hold(page, 'd', 3)

    # 60--75 s: the original F/E flight controls lift us above the trees.
    await page.keyboard.press('f')
    await hold(page, 'e', 2.2)
    await look(page, -150, -25, seconds=7)
    await hold(page, 'w', 4)
    await asyncio.sleep(2)
    current = await state(page)
    assert current['fly'] and not current['errors'], current


SHOTS = {
    'overview': Shot(
        url='http://127.0.0.1:8092/index.html', module=None,
        serve=['sakuragaoka-station'], prepare=prepare, run=overview,
        poster_at=4, preview_at=34, overlay=False, min_fps=45,
    ),
}
