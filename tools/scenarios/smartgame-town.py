"""A pure-play town trailer: makeover, streets, insects, cafe and home.

The verified playthrough owns entry, purchases and keyboard navigation. All
__town reads below are observations; every change uses ordinary UI input.
"""

import asyncio
import importlib.util
import math
import time
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from record import Shot


_spec = importlib.util.spec_from_file_location(
    'smartgame_town_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'smartgame-town.py')
town = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(town)


async def camera(page, yaw, pitch, seconds=3):
    """Ease one deliberate mouse drag to a useful camera angle."""
    current = await page.evaluate('__town.cam')
    delta = (yaw - current['yaw'] + math.pi) % (2 * math.pi) - math.pi
    dx, dy = -delta / .006, (pitch - current['pitch']) / .004
    x, y = 640 - dx / 2, 360 - dy / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    began = time.monotonic()
    steps = round(seconds * 30)
    try:
        for step in range(1, steps + 1):
            t = step / steps
            eased = t * t * (3 - 2 * t)
            await page.mouse.move(x + dx * eased, y + dy * eased)
            await asyncio.sleep(max(0, began + seconds * t - time.monotonic()))
    finally:
        await page.mouse.up()


async def catch_prompt(page, equip=False):
    """A disappearing insect is an optional beat, not a recording failure."""
    prompt = page.locator('.tw-prompt').filter(has_text='つかまえる')
    if not await prompt.is_visible():
        return False
    if equip and await page.evaluate('__town.app.state.avatar.hand === "hand_net"'):
        return True
    try:
        await prompt.click(timeout=400)
    except PlaywrightTimeoutError:
        return False
    return await prompt.is_visible() if equip else True


async def approach_bug(page, seconds=4, radius=14):
    """Refresh moving targets and approach from the avatar's side of the bug."""
    deadline = time.monotonic() + seconds
    tried = set()
    while time.monotonic() < deadline:
        bugs = await page.evaluate("""() => __town.bugs.bugs
          .filter(b => b.state === 'idle' && b.mat.map)
          .map(b => ({id:b.id,x:b.x,z:b.z,
            d:Math.hypot(b.x-__town.pos.x,b.z-__town.pos.z)}))
          .sort((a,b) => a.d-b.d)""")
        bug = next((b for b in bugs if b['id'] not in tried and b['d'] < radius), None)
        if bug is None:
            return False
        tried.add(bug['id'])
        pos = await page.evaluate('({x:__town.pos.x,z:__town.pos.z})')
        distance = max(bug['d'], .01)
        # Catch radius is 2.1; avoid standing inside the insect's alarm radius.
        x = bug['x'] + (pos['x'] - bug['x']) / distance * 1.8
        z = bug['z'] + (pos['z'] - bug['z']) / distance * 1.8
        try:
            await town.walk(page, x, z, tolerance=.2,
                            timeout=max(.1, min(2, deadline - time.monotonic())))
        except RuntimeError:
            continue  # Trees, walls and riverbanks can block an otherwise close spawn.
        if await catch_prompt(page, equip=True):
            return True
    return False


async def hide_log(page):
    log = page.get_by_text('▼ ログ', exact=True)
    if await log.is_visible():
        await log.click()


async def prepare(page):
    await town.enter_bugs(page)
    await hide_log(page)
    deadline = time.monotonic() + 40
    # Search the plaza banks and west-side habitats, then reroll once by reloading
    # the saved scene. Movement and equipment changes still use ordinary UI input.
    for attempt in range(2):
        if attempt:
            await page.reload(wait_until='domcontentloaded', timeout=10000)
            await town.wait_state(page, 'window.__town && __town.bugs && !__town.UI.isBusy()',
                                  timeout=10000)
            await hide_log(page)
        await town.warp(page, 'plaza')
        await camera(page, .7, .65, 2)
        search_until = min(deadline, time.monotonic() + 17)
        spots = iter([(-2, 10), (-2, 15), (-12, 10), (-19.5, 0)])
        while time.monotonic() < search_until:
            if await approach_bug(page, seconds=min(4, search_until - time.monotonic())):
                print('smartgame-town prepare: live catch ready', flush=True)
                return
            spot = next(spots, None)
            if spot:
                try:
                    await town.walk(page, *spot, timeout=max(.1, min(
                        2, search_until - time.monotonic())))
                except RuntimeError:
                    pass
            await asyncio.sleep(min(1, max(0, search_until - time.monotonic())))
        if time.monotonic() >= deadline:
            break
    await town.warp(page, 'plaza')
    print('smartgame-town prepare: avatar opening; insects optional later', flush=True)


async def makeover(page):
    await page.get_by_role('button', name='メニュー', exact=True).click()
    await page.get_by_role('button', name='アバター', exact=True).click()
    await page.get_by_text('かみ', exact=True).click()
    await asyncio.sleep(1)
    await page.get_by_role('button', name='ポニーテール', exact=True).click()
    await asyncio.sleep(2)
    await page.get_by_text('ふく', exact=True).click()
    await page.get_by_role('button', name='カーディガン', exact=True).click()
    await asyncio.sleep(2)
    await page.get_by_role('button', name='決定', exact=True).click()


async def catch_bug(page):
    # Equip if necessary, then swing promptly: a camera hold can scare the bug off.
    if not await catch_prompt(page, equip=True) or not await catch_prompt(page):
        return False
    await asyncio.sleep(1.5)
    okay = page.get_by_role('button', name='OK', exact=True)
    if await okay.is_visible():
        await asyncio.sleep(1.2)
        await okay.click()
    await camera(page, .1, .65, 2)
    return True


async def decorate(page):
    await town.warp(page, 'room')
    await page.get_by_role('button', name='模様替えをする', exact=True).click()
    # The editor picks the table's ground footprint, below its visible top.
    await asyncio.sleep(1.5)
    before = await page.evaluate('JSON.stringify(__town.app.state.room.items)')
    await page.mouse.click(787, 386)
    await page.get_by_role('button', name='↻ 回転', exact=True).click()
    await asyncio.sleep(1.5)
    await page.mouse.click(740, 370)
    await page.get_by_role('button', name='📦 しまう', exact=True).click()
    await asyncio.sleep(.7)
    await page.locator('.tw-item:enabled').filter(has_text='テーブル').click()
    await page.mouse.move(550, 370, steps=30)
    await asyncio.sleep(1)
    await page.mouse.click(550, 370)
    after = await page.evaluate('JSON.stringify(__town.app.state.room.items)')
    if before == after:
        raise RuntimeError('Room furniture did not change')
    await asyncio.sleep(1.5)
    await page.get_by_role('button', name='おわる', exact=True).click()
    await camera(page, .2, .72, 4)


async def overview(page, _cue):
    began = time.monotonic()

    def beat(label):
        print(f'smartgame-town beat {time.monotonic() - began:.1f}s: {label}', flush=True)

    caught = await catch_bug(page)
    if caught:
        beat('bug catching')
        await town.warp(page, 'plaza')
    beat('avatar editor')
    await makeover(page)
    beat('plaza, southern bridge and cafe street')
    await town.warp(page, 'plaza')
    await camera(page, .2, .62, 2)
    # The west edge avoids the bench at (3, 16); cross on the actual bridge.
    for x, z in [(-2, 15), (0, 21), (16, 21)]:
        await town.walk(page, x, z, tolerance=.4)
    await camera(page, 1.5, .65, 3)
    await town.walk(page, 29, 21)
    await town.walk(page, 29, 16)
    beat('cafe interior')
    await town.warp(page, 'cafe')
    await town.walk(page, .5, 0)
    await camera(page, -.2, .68, 4)
    await town.walk(page, .5, 2.5)
    beat('room decoration')
    await decorate(page)
    beat('closing plaza walk')
    await town.warp(page, 'plaza')
    # One short opportunistic detour; never wait for random spawns on camera.
    if not caught and time.monotonic() - began < 60:
        if await approach_bug(page, seconds=2, radius=5):
            beat('late bug catching')
            await catch_bug(page)
        await town.warp(page, 'plaza')
    await town.walk(page, -2, 15)
    await town.walk(page, 0, 21)
    await town.walk(page, 16, 21)
    await camera(page, 1.5, .65, 2)
    await town.walk(page, 26, 21)
    # Finish on an eased fountain/river view, never a static padding hold.
    remaining = 65 - (time.monotonic() - began)
    if remaining > 0:
        await camera(page, 1.15, .65, remaining)
    if time.monotonic() - began > 90:
        raise RuntimeError('Town trailer exceeded 90 seconds')


SHOTS = {
    'overview': Shot(
        url=town.URL, module=None, serve=town.SERVE,
        prepare=prepare, run=overview,
        poster_at=21, preview_at=17, overlay=False, min_fps=45),
}
