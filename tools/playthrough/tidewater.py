"""Exercise the archived island through its own controls and settings.

Inventory: Guide.js/UI.js list walking, swimming, fishing, boarding/helm,
free camera and photo mode. AppUI.js adds four sea presets and a time dial.
There are no level selectors, other vehicles, accounts or network game modes.
The two vendors and cooler are also covered. Evaluations below only observe
state: no teleporting, injected catches/money, save edits or game-method calls.
"""

import asyncio
import math
import time

from playthrough import Controls, Mode

SERVE = ['tidewater']
URL = 'http://127.0.0.1:8097/tidewater/index.html'


async def state(page):
    return await page.evaluate('''() => {
      const a = __app, p = a.player, g = a.game;
      return {pos: p.position, yaw: p.yaw, pitch: p.pitch, mode: p.mode,
        deck: p.deckPos, deckYaw: p.deckYaw, prompt: p.prompt?.text,
        rod: g.rod.state, equipped: g.rod.equipped, bite: g.bite?.phase,
        fight: g.fight && {tension: g.fight.tension, distance: g.fight.distance},
        catchOpen: g.hud.catchOpen, fish: g.state.inventory.length,
        money: g.state.money, boat: a.boatCtl.position, speed: a.boatCtl.speed};
    }''')


async def enter_world(page):
    await page.get_by_text('Click to explore', exact=True).click()
    await page.get_by_role('button', name='Next', exact=True).click()
    await page.get_by_role('button', name='Next', exact=True).click()
    await page.get_by_role('button', name="Let's fish", exact=True).click()
    await page.locator('.gm-guide.is-on').wait_for(state='hidden')
    await page.mouse.move(640, 360)
    await page.wait_for_function('window.__app?.game?.hud && !__app.game.guide.open')


async def face(page, yaw, pitch=-0.05):
    """Use unlocked right drags; mouse sensitivity comes from Player.js."""
    await page.keyboard.press('Escape')
    for _ in range(8):
        s = await state(page)
        delta = (yaw - s['yaw'] + math.pi) % (2 * math.pi) - math.pi
        dy = pitch - s['pitch']
        if abs(delta) < 0.015 and abs(dy) < 0.015:
            return
        dx = max(-450, min(450, -delta / 0.0022))
        my = max(-250, min(250, -dy / 0.0022))
        await page.mouse.move(640, 360)
        await page.mouse.down(button='right')
        await page.mouse.move(640 + dx, 360 + my, steps=8)
        await page.mouse.up(button='right')
        await asyncio.sleep(0.08)
    raise AssertionError('Mouse look did not reach the requested heading')


async def walk_to(page, x, z, tolerance=0.45, timeout=28):
    ctl = Controls(page)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        s = await state(page)
        dx, dz = x - s['pos']['x'], z - s['pos']['z']
        distance = math.hypot(dx, dz)
        if distance < tolerance:
            return
        await face(page, math.atan2(-dx, -dz))
        sprint = distance > 5
        if sprint:
            await page.keyboard.down('Shift')
        try:
            await ctl.hold('w', min(1.5, distance / (6.2 if sprint else 3)))
        finally:
            await page.keyboard.up('Shift')
    raise AssertionError(f'Walking route blocked before ({x}, {z}): {await state(page)}')


async def pier(page):
    # Center before the first support: straight ahead from spawn hits its post.
    await walk_to(page, 55, -77)
    await walk_to(page, 55, 36, timeout=30)
    await face(page, math.pi)
    assert (await state(page))['mode'] == 'walk'


async def enter_pier(page):
    await enter_world(page)
    await pier(page)
    await page.keyboard.press('r')
    await page.wait_for_function('__app.game.rod.equipped')


async def fish_for(page, seconds, require_catch=True):
    """React to actual bites/tension, without changing the random fish rolls."""
    deadline = time.monotonic() + seconds
    initial = (await state(page))['fish']
    caught = False
    reeling = False
    last_card = 0
    try:
        while time.monotonic() < deadline:
            s = await state(page)
            caught |= s['fish'] > initial
            if s['fight']:
                want = s['fight']['tension'] < (0.86 if reeling else 0.60)
                if want != reeling:
                    await (page.mouse.down() if want else page.mouse.up())
                    reeling = want
            else:
                if reeling:
                    await page.mouse.up()
                    reeling = False
                if s['catchOpen']:
                    if not last_card:
                        last_card = time.monotonic()
                    elif time.monotonic() - last_card > 5:
                        await page.keyboard.press('e')
                        last_card = 0
                elif s['rod'] == 'idle':
                    await page.mouse.move(640, 360)
                    await page.mouse.down()
                    await asyncio.sleep(0.35)
                    await page.mouse.up()
                elif s['bite'] == 'take':
                    await page.mouse.down()
                    await asyncio.sleep(0.07)
                    await page.mouse.up()
            await asyncio.sleep(0.10)
    finally:
        await page.mouse.up()
    if require_catch and not caught:
        raise AssertionError('No fish caught during real casts and tension fights')


async def play_fishing(page, ctl):
    await fish_for(page, 78)
    await ctl.tap('Escape')
    await ctl.tap('i')
    await ctl.wait(6)
    await ctl.tap('i')
    await ctl.tap('r')
    await walk_to(page, 55, -70, timeout=30)
    await walk_to(page, 53, -74.6)
    await ctl.tap('e')
    sell = page.locator('[data-all]')
    await sell.wait_for(state='visible')
    assert await sell.is_enabled(), 'Caught fish did not reach the buyer'
    await ctl.wait(5)
    await sell.click()
    assert (await state(page))['money'] > 0, 'Selling did not credit the wallet'
    await ctl.wait(5)
    await page.get_by_text('Leave (E)', exact=True).click()
    # Keep playing for the remaining runner budget after completing the sale.
    await play_walk(page, ctl)


async def enter_deck(page):
    await enter_world(page)
    await pier(page)
    await walk_to(page, 61.2, 36)
    await page.wait_for_function('__app.player.prompt?.text === "Board boat"')
    await page.keyboard.press('e')
    await page.wait_for_function('__app.player.mode === "deck"')


async def enter_boat(page):
    await enter_deck(page)
    await face(page, math.pi)
    # Board point (0, -1.75), helm seat (-0.55, 0.22), in boat coordinates.
    ctl = Controls(page)
    await ctl.hold('w', 0.9)
    await ctl.hold('d', 0.3)
    await page.wait_for_function('__app.player.prompt?.text === "Take the helm"', timeout=4000)
    await ctl.tap('e')
    await page.wait_for_function('__app.player.mode === "boat"')


async def enter_first_person(page):
    await enter_boat(page)
    await page.keyboard.press('v')
    await page.wait_for_function('__app.player.camMode === "first"')


async def play_boat(page, ctl):
    origin = (await state(page))['boat']
    await ctl.hold('w', 9)
    await ctl.hold('a', 2)
    await ctl.hold('w', 7)
    await ctl.hold('d', 3)
    p = (await state(page))['boat']
    assert math.hypot(p['x'] - origin['x'], p['z'] - origin['z']) > 12, 'Boat did not leave its mooring'
    while True:
        await ctl.hold('w', 6)
        await ctl.hold('a', 1.2)
        await ctl.hold('d', 1.2)


async def play_deck(page, ctl):
    await ctl.hold('s', 0.7)
    await face(page, 0)
    await ctl.tap('r')
    await fish_for(page, 65)
    await ctl.tap('i')
    await ctl.wait(5)
    await ctl.tap('i')


async def play_walk(page, ctl):
    while True:
        for x, z in ((55, -77), (55, -70), (60, -68), (55, -70)):
            await walk_to(page, x, z)
            await ctl.tap('Space')
            await ctl.wait(0.4)


async def enter_swim(page):
    await enter_deck(page)
    # The starboard rail has no pier: the real E prompt jumps overboard.
    await face(page, math.pi)
    await Controls(page).hold('a', 1.4)
    await page.wait_for_function('__app.player.prompt?.text === "Jump overboard"', timeout=4000)
    await page.keyboard.press('e')
    await page.wait_for_function('__app.player.mode === "swim"')


async def play_swim(page, ctl):
    while True:
        await ctl.hold('w', 6)
        await ctl.hold('c', 3)
        await ctl.hold('a', 2)
        await ctl.hold('Space', 4)
        assert (await state(page))['mode'] == 'swim'


async def enter_free(page):
    await enter_world(page)
    await page.get_by_role('button', name='Camera', exact=True).click()
    await page.get_by_role('button', name='Free camera (F)', exact=True).click()
    await page.keyboard.press('h')
    await page.mouse.move(640, 360)
    await page.wait_for_function('__app.freeCam')


async def enter_photo(page):
    await enter_free(page)
    await page.keyboard.press('p')
    await page.wait_for_function('__app.ui.ui.photoMode')


async def play_free(page, ctl):
    await ctl.hold('e', 2)
    while True:
        for key, seconds in (('w', 5), ('a', 3), ('s', 5), ('d', 3)):
            await ctl.hold(key, seconds)


def sea_entry(preset):
    async def enter(page):
        await enter_boat(page)
        await page.get_by_role('button', name='Ocean', exact=True).click()
        await page.get_by_role('radio', name=preset, exact=True).click()
        await page.keyboard.press('h')
        await page.mouse.move(640, 360)
        await page.wait_for_function('__app.ui.ui._panelOpen === false')
    return enter


async def enter_night(page):
    await enter_world(page)
    await page.get_by_role('button', name='Sky', exact=True).click()
    await page.locator('.tw-clock').click()
    await page.get_by_role('textbox', name='Time of day').fill('22:00')
    await page.get_by_role('textbox', name='Time of day').press('Enter')
    await page.keyboard.press('h')
    await page.mouse.move(640, 360)
    await page.keyboard.press('l')
    await page.wait_for_function('__app.settings.timeOfDay === 22')


async def enter_joe(page):
    await enter_world(page)
    await walk_to(page, 53, -74.6)
    await page.keyboard.press('e')
    await page.locator('[data-all]').wait_for(state='visible')


async def enter_marta(page):
    await enter_world(page)
    await walk_to(page, 55, -70)
    # The direct diagonal hits the raised beach hut. Go around its seaward side.
    for x, z in ((60, -66), (60, -47), (84, -47), (83.7, -60.5)):
        await walk_to(page, x, z)
    await page.keyboard.press('e')
    await page.locator('[data-buy="line"]').wait_for(state='visible')


async def play_trader(page, ctl):
    # Starting money is $0; disabled upgrades/empty selling are legitimate UI.
    # The fishing mode separately proves earning money through a real catch.
    while True:
        if await page.locator('[data-buy="lights"]').count():
            # The last upgrade row is below the fold at the runner's 720p size.
            await page.mouse.move(800, 440)
            await page.mouse.wheel(0, 500)
        await ctl.wait(5)
        await page.get_by_text('Leave (E)', exact=True).click()
        await ctl.tap('i')
        await ctl.wait(3)
        await ctl.tap('i')
        await ctl.hold('s', 0.2)
        await ctl.hold('w', 0.2)
        await ctl.tap('e')
        await page.get_by_text('Leave (E)', exact=True).wait_for(state='visible')


MODES = [
    Mode('island-walk', enter_world, play_walk, seconds=35,
         note='First-play guide, boardwalk, beach movement and jumping.'),
    Mode('pier-fishing-catch-sale', enter_pier, play_fishing, seconds=145,
         note='Real casts, bite strikes, tension fights, catch cards, cooler/fish log and sale to Joe. Random catches are not seeded.'),
    Mode('boat-deck-fishing', enter_deck, play_deck, seconds=75,
         note='E boards from the pier; walk the deck and fish astern.'),
    Mode('boat-first-person', enter_first_person, play_boat, seconds=45,
         note='Walk to the helm, E takes it; V selects the cabin view. Throttle and steering.'),
    *[Mode('sea-' + preset.lower(), sea_entry(preset), play_boat, seconds=40,
           note=f'Ocean > {preset}; drive the single boat in its third-person view. Sea presets affect waves, not separate worlds.')
      for preset in ('Calm', 'Breezy', 'Choppy', 'Storm')],
    Mode('swimming-diving', enter_swim, play_swim, seconds=40,
         note='Board, use Jump overboard, swim/dive/rise beside the pier.'),
    Mode('free-camera', enter_free, play_free, seconds=35,
         note='Camera settings > Free camera; fly over the beach using WASD/E.'),
    Mode('photo-mode', enter_photo, play_free, seconds=35,
         note='P hides the UI; compose moving aerial views with the real free-camera controls.'),
    Mode('night-walk', enter_night, play_walk, seconds=35, expect_dark=True,
         note='Sky time dial at 22:00; night is deliberately dark. Walk with the L flashlight and village lamps.'),
    Mode('joe-fish-stand', enter_joe, play_trader, seconds=35,
         note='Approach Joe and use E; inspect empty cooler, fish log and selling UI. Actual sale is covered by pier-fishing-catch-sale.'),
    Mode('marta-chandlery', enter_marta, play_trader, seconds=35,
         note='Approach Marta and use E; inspect diesel and every upgrade row. Fresh saves have $0, so purchases are disabled.'),
]
