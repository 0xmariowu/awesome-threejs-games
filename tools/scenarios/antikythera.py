"""A continuous, native-input dive finale: sonar, brush, gears and eclipse.

Preparation plays the entry and first two discoveries off camera. Read-only
audit projections guide normal keys and mouse gestures; no game state is set.
"""

import asyncio
import importlib.util
import math
import time
from pathlib import Path

from record import Shot


# The playthrough directory shares its name with tools/playthrough.py.
_spec = importlib.util.spec_from_file_location(
    '_antikythera_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'antikythera.py')
_play = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_play)
enter, state, wait_state, walk, keys = (
    _play.enter, _play.state, _play.wait_state, _play.walk, _play.keys)


async def nearest(page):
    s = await state(page)
    return min((f for f in s['fragments'] if f['state'] == 'buried'),
               key=lambda f: math.dist(f['pos'], s['pos']))['pos']


async def brush(page, number):
    await wait_state(page, 'clean', 10)
    try:
        await page.keyboard.down('e')
        await page.wait_for_function('(n) => __ak.G.found >= n',
                                     arg=number, timeout=45000)
        await wait_state(page, 'explore', 30)
    finally:
        await page.keyboard.up('e')


async def prepare(page):
    await enter(page)
    await page.get_by_role('button', name='Begin the dive').click()
    await wait_state(page, 'explore', 90)
    for number in (1, 2):
        await page.keyboard.press('q')
        await walk(page, await nearest(page), cleaning=True)
        await brush(page, number)

    # Stage the opening along the final approach, still outside the mound.
    target, active = await nearest(page), set()
    started = time.monotonic()
    try:
        while time.monotonic() - started < 40:
            s = await state(page)
            assert s['stage'] == 'explore' and s['air'] > 0
            dx, dz = target[0] - s['pos'][0], target[2] - s['pos'][2]
            angle = math.atan2(-dx, -dz) - s['yaw']
            angle = math.atan2(math.sin(angle), math.cos(angle))
            if math.hypot(dx, dz) < 4.8 and abs(angle) < .08:
                break
            wanted = set()
            if abs(angle) > .06:
                wanted.add('a' if angle > 0 else 'd')
            if abs(angle) < .3 and math.hypot(dx, dz) >= 4.8:
                wanted.add('w')
            active = await keys(page, wanted, active)
            await asyncio.sleep(.05)
        else:
            raise AssertionError('Could not frame the final fragment approach')
    finally:
        await keys(page, set(), active)
    await asyncio.sleep(1)


async def fit_wheel(page):
    await page.wait_for_function('''() => {
      const a = __ak, i = a.G.puzzle?.slot;
      return i >= 0 && a.wheels[i].state === 'rest' && !a.wheels[i].fitted;
    }''', timeout=30000)
    await asyncio.sleep(.6)
    s = await state(page)
    slot = s['slot']
    await page.mouse.move(*s['wheels'][slot]['screen'])
    await page.mouse.down()
    try:
        await asyncio.sleep(.3)
        assert (await state(page))['held'] == slot, 'Wheel was not picked up'
        start = s['wheels'][slot]['screen']
        # Reproject the glowing socket as the original assembly camera settles.
        for step in range(1, 61):
            target = (await state(page))['sockets'][slot]['screen']
            u = step / 60
            ease = u * u * (3 - 2 * u)
            await page.mouse.move(*(a + (b - a) * ease for a, b in zip(start, target)))
            await asyncio.sleep(1 / 60)
        assert (await state(page))['hover'] == slot, 'Wheel missed the lit socket'
    finally:
        await page.mouse.up()
    await page.wait_for_function('(i) => __ak.wheels[i].fitted',
                                 arg=slot, timeout=15000)


async def overview(page, _cue):
    started = time.monotonic()

    async def milestone(name):
        print('antikythera shot: %.2fs %s' % (time.monotonic() - started, name),
              flush=True)

    await milestone('sonar / seabed')
    await page.keyboard.press('q')
    await asyncio.sleep(1.8)
    assert (await state(page))['sonar']
    await walk(page, await nearest(page), cleaning=True)
    await milestone('brush')
    await brush(page, 3)
    await milestone('carry to mechanism')
    await page.wait_for_function('__ak.G.site?.placed', timeout=10000)
    await walk(page, (await state(page))['pile'])
    await wait_state(page, 'assemble', 10)
    await milestone('assemble')
    for _ in range(3):
        await fit_wheel(page)
        await milestone('wheel fitted')
    await wait_state(page, 'crank', 60)
    await milestone('crank')
    await page.wait_for_function('__ak.G.ckGrip > .6', timeout=20000)
    await page.mouse.move(800, 360)
    await page.mouse.down()
    try:
        crank_started, step = time.monotonic(), 0
        while (await state(page))['months'] < 223:
            assert time.monotonic() - crank_started < 40, 'Crank timed out'
            angle = step * math.pi / 12
            await page.mouse.move(640 + 160 * math.cos(angle),
                                  360 + 160 * math.sin(angle))
            await asyncio.sleep(.025)
            step += 1
    finally:
        await page.mouse.up()
    await wait_state(page, 'eclipse', 30)
    await milestone('eclipse')
    # Include the native camera's rise above the sea and the eclipse sky.
    await asyncio.sleep(14)
    assert (await state(page))['stage'] == 'eclipse'
    elapsed = time.monotonic() - started
    assert 60 <= elapsed <= 90, 'Overview outside 60–90 seconds: %.2f' % elapsed


SHOTS = {
    'overview': Shot(
        url=_play.URL, module=None, serve=['antikythera'],
        prepare=prepare, run=overview, overlay=False,
        poster_at=65, preview_at=60, min_fps=45),
}
