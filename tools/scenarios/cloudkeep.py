"""One 65-second pure gameplay overview; only prepare() seeds the save.

Flight, clouds, feeding, capture and an orbit use normal game controls.
Event waits fail if an interaction does not happen. No archive files change.
"""

import asyncio
import math
import time

from record import Shot

GAME = 'http://127.0.0.1:8101/'
SAVE_KEY = 'cloudkeep.save.v1'


def vec(x, y, z):
    return dict(x=x, y=y, z=z)


def snapshot(pos, yaw=0, residents=None):
    # simulation.ts snapshot()/restore(): v2 avoids legacy redistribution.
    homes = residents or [
        ('ray', (-8, 22, 15)), ('ray', (-65, 25, 38)),
        ('whale', (-50, 28, -28)), ('moth', (-28, 30, -64)),
        ('moth', (63, 32, -40)), ('koi', (15, 19, 6)),
        ('koi', (61, 17, 47)), ('jelly', (-29, 13, 72)),
        ('jelly', (32, 33, -76)),
    ]
    return dict(
        version=1, ecosystemVersion=2, time=0, pos=vec(*pos), yaw=yaw,
        pitch=0, pearls=0, collected=0, totalFed=0, totalCaptured=0,
        levels=dict(engine=0, food=0, magnet=0), birds=False,
        extraWhale=False, restored=False, foodStock=12, seed=8128,
        creatures=[dict(species=species, pos=vec(*p), home=vec(*p),
                        fed=0, hunger=.85, yaw=0, phase=i * .6, spawn=1)
                   for i, (species, p) in enumerate(homes)],
        foods=[], drops=[], respawns=[],
    )


async def hold(page, key, seconds):
    keys = key.split('+')
    try:
        for item in keys:
            await page.keyboard.down(item)
        await asyncio.sleep(seconds)
    finally:
        for item in reversed(keys):
            await page.keyboard.up(item)


async def drag(page, dx, dy, seconds, button='left', surface='#world'):
    box = await page.locator(surface).bounding_box()
    x = box['x'] + box['width'] / 2 - dx / 2
    y = box['y'] + box['height'] / 2 - dy / 2
    await page.mouse.move(x, y)
    await page.mouse.down(button=button)
    start = time.monotonic()
    steps = max(2, round(seconds * 60))
    try:
        for step in range(1, steps + 1):
            await page.mouse.move(x + dx * step / steps, y + dy * step / steps)
            await asyncio.sleep(max(0, start + seconds * step / steps - time.monotonic()))
    finally:
        await page.mouse.up(button=button)


async def wait_ready(page):
    await page.locator('[data-action="start"]:enabled').wait_for(timeout=45000)
    await page.locator('#world canvas').wait_for()


async def start(page):
    await page.locator('[data-action="start"]').click()
    await page.locator('body.playing').wait_for()


def prepare_save(state):
    async def prepare(page):
        # Finish the initial boot before reloading, avoiding aborted asset loads.
        await wait_ready(page)
        await page.evaluate('([key, state]) => localStorage.setItem(key, JSON.stringify(state))',
                            [SAVE_KEY, state])
        await page.reload(wait_until='domcontentloaded')
        await wait_ready(page)
        await start(page)
        # Let the intro transition and the temporary controls toast clear.
        await page.wait_for_function("!document.querySelector('#toast').classList.contains('visible')")
    return prepare


async def saved(page):
    return await page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', SAVE_KEY)


async def wait_counter(page, field, previous, timeout=8000):
    await page.wait_for_function('''([key, field, previous]) =>
        JSON.parse(localStorage.getItem(key))[field] > previous''',
        arg=[SAVE_KEY, field, previous], timeout=timeout)


async def feed(page):
    before = (await saved(page))['totalFed']
    await hold(page, 'Space', .12)
    await wait_counter(page, 'totalFed', before)
    await asyncio.sleep(2)


async def capture_one(page):
    await page.locator('.capture-target:not([hidden])').wait_for(timeout=6000)
    before = (await saved(page))['totalCaptured']
    await page.keyboard.down('q')
    try:
        await wait_counter(page, 'totalCaptured', before, timeout=4000)
    finally:
        await page.keyboard.up('q')
    await asyncio.sleep(2.7)


async def overview(page, _cue):
    began = time.monotonic()
    await asyncio.sleep(3)
    await hold(page, 'w', 6)
    await drag(page, -120, 0, 3)
    await drag(page, 120, 0, 3)
    await hold(page, 's+Shift', 7)
    await hold(page, 'w', 3.5)
    await asyncio.sleep(2)
    await feed(page)
    await capture_one(page)
    await asyncio.sleep(5)
    await drag(page, 650, -35, 8, button='right')
    await asyncio.sleep(3)
    await hold(page, 'c', .12)
    await asyncio.sleep(3)
    await hold(page, 'w', max(5, 65 - (time.monotonic() - began)))


# The encounter saves retain the normal population counts and legal bounds.
ENCOUNTER = [('ray', (-38, 25, -50)), ('ray', (-55, 27, -55)),
             ('whale', (-44, 31, -57)), ('moth', (-28, 30, -64)),
             ('moth', (63, 32, -40)), ('koi', (-40, 21, -42)),
             ('koi', (61, 17, 47)), ('jelly', (-29, 13, 72)),
             ('jelly', (-46, 28, -47))]


SHOTS = {
    'overview': Shot(
        url=GAME, module=None, serve=['cloudkeep'],
        prepare=prepare_save(snapshot((-50, 26, -50), -math.pi / 2, ENCOUNTER)),
        run=overview, poster_at=7, overlay=False, min_fps=45),
}
