"""A 72-second, input-only flight through the Basin at golden hour.

The entry and right-drag controls follow tools/playthrough/monolith-wilds.py.
__MW is read only: observe the camera and check readiness/runtime health.
No saves, discoveries, camera transforms or game files are changed.
"""

import asyncio
import math
import time

from record import Shot


async def enter_world(page):
    # Minimal copy of the verified playthrough entry helper.
    await page.wait_for_function('window.__MW?.ready === true')
    await page.get_by_role('button', name='Begin', exact=True).click()
    await page.wait_for_function(
        "__MW.ctx.hud.phase === 'world' && __MW.ctx.cam.mode === 'fly'")
    await page.locator('.mw-title').wait_for(state='hidden')
    assert not await page.evaluate('__MW.errors'), 'World boot reported errors'


async def position(page):
    return await page.evaluate('__MW.ctx.camera.position.toArray()')


async def aim(page, target, seconds):
    """Pace a real right-drag toward a landmark, without pointer lock."""
    px, py, pz = await position(page)
    x, y, z = target
    yaw = math.atan2(px - x, pz - z)
    pitch = math.atan2(y - py, math.hypot(x - px, z - pz))
    current = await page.evaluate('''() => {
        const m = __MW.ctx.camera.matrixWorld.elements;
        return [Math.atan2(m[8], m[10]), Math.asin(-m[9])];
    }''')
    # Same .0022 rad/pixel fallback as the verified look() helper. Split long
    # turns into canvas-sized drags, paced by a clock rather than RPC latency.
    dx = ((current[0] - yaw + math.pi) % (2 * math.pi) - math.pi) / .0022
    dy = (current[1] - pitch) / .0022
    chunks = max(1, math.ceil(abs(dx) / 400), math.ceil(abs(dy) / 240))
    began = time.monotonic()
    for chunk in range(chunks):
        await page.mouse.move(640 - dx / chunks / 2, 360 - dy / chunks / 2)
        await page.mouse.down(button='right')
        steps = max(2, round(seconds / chunks * 30))
        try:
            for step in range(1, steps + 1):
                t = step / steps
                await page.mouse.move(640 + dx / chunks * (t - .5),
                                      360 + dy / chunks * (t - .5))
                deadline = began + seconds * (chunk + t) / chunks
                await asyncio.sleep(max(0, deadline - time.monotonic()))
        finally:
            await page.mouse.up(button='right')


async def hold(page, keys, seconds):
    before = await position(page)
    try:
        for key in keys.split('+'):
            await page.keyboard.down(key)
        await asyncio.sleep(seconds)
    finally:
        for key in reversed(keys.split('+')):
            await page.keyboard.up(key)
    assert math.dist(before, await position(page)) > 1, 'Flight stopped moving'


STAIR = (-420, 330, 300)
OBSERVATORY = (330, 110, 180)
LOOM = (320, 350, -1750)


async def prepare(page):
    await enter_world(page)
    await page.get_by_role('button', name='Hide the interface (H)', exact=True).click()
    await aim(page, STAIR, 2)
    await asyncio.sleep(4)
    assert await page.locator('body').evaluate("e => e.classList.contains('mw-photo')")


async def overview(page, _cue):
    # 0-18: approach the suspended spiral stair over the forest and lake.
    await hold(page, 'w', 18)
    # 18-30: lateral parallax opens the view across the Basin.
    await hold(page, 'd', 12)
    # 30-50: turn deliberately, then glide toward the observatory's open dome.
    await aim(page, OBSERVATORY, 6)
    await hold(page, 'w', 14)
    # 50-72: climb and reveal the Wardens and the floating Loom of Hours.
    await hold(page, 'Space', 8)
    await aim(page, LOOM, 6)
    await hold(page, 'w', 8)
    assert not await page.evaluate('__MW.errors'), 'Runtime reported errors'
    assert await page.evaluate("__MW.ctx.cam.mode === 'fly'")


SHOTS = {
    'overview': Shot(
        url='http://127.0.0.1:8081/index.html', module=None,
        serve=['monolith-wilds'], prepare=prepare, run=overview,
        poster_at=40, preview_at=36, overlay=False, min_fps=45),
}
