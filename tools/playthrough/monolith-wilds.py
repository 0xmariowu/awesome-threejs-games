"""Exercise the unmodified, entirely offline Basin through keyboard/mouse/UI.

Inventory: assets/hud-D2WSdXqL.js, controls-DX7CeMlr.js,
index-DGqtqlWq.js (LANDMARKS), ruins-CgovKSWO.js (named places), and
tour-Do76daLD.js. There are no vehicles, combat, accounts or multiplayer.
Quality/audio/accessibility settings are not levels. Time presets, time-lapse
and photo view are included as scene variants. __MW is READ ONLY: readiness,
navigation observations and assertions. Never inject discoveries or cameras.
"""
import asyncio
import math
import re
from playthrough import Mode

SERVE = ['monolith-wilds']
URL = 'http://127.0.0.1:8081/index.html'


async def enter_world(page):
    await page.wait_for_function('window.__MW?.ready === true')
    await page.get_by_role('button', name='Begin', exact=True).click()
    await page.wait_for_function("__MW.ctx.hud.phase === 'world' && __MW.ctx.cam.mode === 'fly'")
    await page.locator('.mw-title').wait_for(state='hidden')
    assert not await page.evaluate('__MW.errors'), 'World boot reported module errors'


async def position(page):
    return await page.evaluate('__MW.ctx.camera.position.toArray()')


async def look(page, yaw, pitch=0):
    """Aim with the original right-drag fallback, without pointer lock."""
    for _ in range(8):
        current = await page.evaluate('''() => {
            const m = __MW.ctx.camera.matrixWorld.elements;
            return [Math.atan2(m[8], m[10]), Math.asin(-m[9])];
        }''')
        dx = (current[0] - yaw + math.pi) % (2 * math.pi) - math.pi
        dy = current[1] - pitch
        if abs(dx) + abs(dy) < .01:
            return
        # Original sensitivity: .0022 rad/pixel. Keep each drag on the canvas.
        dx = max(-240, min(240, dx / .0022))
        dy = max(-160, min(160, dy / .0022))
        await page.mouse.move(640, 360)
        await page.mouse.down(button='right')
        try:
            await page.mouse.move(640 + dx, 360 + dy, steps=8)
        finally:
            await page.mouse.up(button='right')
        await asyncio.sleep(.18)


async def discover(page, x, z, radius, name):
    await page.mouse.move(640, 360)
    await page.mouse.wheel(0, -1500)
    await asyncio.sleep(.2)
    slow = False
    for _ in range(70):
        px, _, pz = await position(page)
        dx, dz = x - px, z - pz
        distance = math.hypot(dx, dz)
        if radius <= 150 and distance < 400 and not slow:
            await page.mouse.move(640, 360)
            await page.mouse.wheel(0, 1500)
            slow = True
        await look(page, math.atan2(-dx, -dz))
        # Turning takes time, during which flight inertia continues to move us.
        px, _, pz = await position(page)
        distance = math.hypot(x - px, z - pz)
        if distance < radius * .65:
            await asyncio.sleep(.4)
            found = await page.evaluate('''name => {
                const c = __MW.ctx;
                const major = c.layout.LANDMARKS.find(s => s.name === name);
                if (major) return c.hud.discovered().includes(major.id);
                const id = 'place:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                return JSON.parse(localStorage.getItem('mw.discovered.minor') || '[]').includes(id);
            }''', name)
            if found:
                break
        boost = distance > 700
        if boost:
            await page.keyboard.down('Shift')
        await page.keyboard.down('w')
        try:
            await asyncio.sleep(min(.7, max(.12, (distance - radius * .5)
                                           / (1000 if boost else 70 if slow else 350))))
        finally:
            await page.keyboard.up('w')
            if boost:
                await page.keyboard.up('Shift')
        await asyncio.sleep(.15)
    else:
        raise AssertionError('Could not discover destination using flight controls')
    await asyncio.sleep(.7)
    if not slow:
        await page.mouse.wheel(0, 1500)
    await asyncio.sleep(.3)


async def move(page, ctl, key, seconds):
    before = await position(page)
    await ctl.hold(key, seconds)
    distance = math.dist(before, await position(page))
    assert distance > .5, f'{key}: camera moved only {distance:.3f} m'
    assert not await page.evaluate('__MW.errors'), 'Runtime reported errors'


def destination(name, x, z, radius, occurrence=0):
    async def enter(page):
        await enter_world(page)
        await discover(page, x, z, radius, name)
        await page.get_by_role('button', name='Map (M)', exact=True).click()
        button = page.get_by_role('button', name='Travel to ' + name, exact=True).nth(occurrence)
        await button.wait_for(state='visible')
        # Equal names share discovery IDs but have distinct real map buttons.
        marker = await button.evaluate('(e) => [parseFloat(e.style.left), parseFloat(e.style.top)]')
        assert abs(marker[0] - (x + 3500) / 70) < .01
        assert abs(marker[1] - (z + 3500) / 70) < .01
        await button.click()
        await page.wait_for_function('__MW.ctx.cam.flying')
        await page.wait_for_function('!__MW.ctx.cam.flying')
        await page.wait_for_function('__MW.ctx.hud.panel === null')
        await asyncio.sleep(.5)
        if name == 'The Stair to Nowhere':
            # The original first stair viewpoint lies among the Wardens, which
            # obscure it. Leave that viewpoint with normal flight controls.
            px, _, pz = await position(page)
            await look(page, math.atan2(px - x, pz - z))
            await page.keyboard.down('Space')
            await page.keyboard.down('w')
            try:
                await asyncio.sleep(6)
            finally:
                await page.keyboard.up('Space')
                await page.keyboard.up('w')
            px, py, pz = await position(page)
            await look(page, math.atan2(px - x, pz - z),
                       math.atan2(330 - py, math.hypot(x - px, z - pz)))
        if (name, occurrence) in {('The Sagging Gate', 1), ('The Narrowing Arches', 1),
                                  ('A Wheel of the Land', 2), ('The Descent', 1)}:
            # These arrival views sit behind trees or a ridge. Rise above them
            # and approach using the same controls available to a player.
            px, _, pz = await position(page)
            await look(page, math.atan2(px - x, pz - z))
            await page.keyboard.down('Space')
            try:
                await asyncio.sleep(8 if name == 'A Wheel of the Land' else 4)
            finally:
                await page.keyboard.up('Space')
            await page.keyboard.down('w')
            try:
                await asyncio.sleep(1.6)
            finally:
                await page.keyboard.up('w')
            px, py, pz = await position(page)
            ground = await page.evaluate('([x,z]) => __MW.ctx.heightAt(x,z)', [x, z])
            await look(page, math.atan2(px - x, pz - z),
                       math.atan2(ground + 35 - py, math.hypot(x - px, z - pz)))
        await page.mouse.move(640, 360)
        await page.mouse.wheel(0, 700)
        await asyncio.sleep(.3)
        print(f'  reached {name} ({x}, {z}): {await position(page)}', flush=True)

    async def play(page, ctl):
        while True:
            for key, duration in [('a', 4), ('d', 4), ('w', 2), ('s', 2)]:
                await move(page, ctl, key, duration)
                px, py, pz = await position(page)
                ground = await page.evaluate('([x,z]) => __MW.ctx.heightAt(x,z)', [x, z])
                height = 330 if name == 'The Stair to Nowhere' else ground + 35
                await look(page, math.atan2(px - x, pz - z),
                           math.atan2(height - py, math.hypot(x - px, z - pz)))
    return enter, play


async def play_flight(page, ctl):
    while True:
        for key, duration in [('w', 5), ('a', 3), ('Space', 2), ('d', 3), ('q', 2), ('s', 4)]:
            await move(page, ctl, key, duration)
        await ctl.drag(110, -12, 1, button='right')
        await page.keyboard.down('Shift')
        try:
            await move(page, ctl, 'w', 3)
        finally:
            await page.keyboard.up('Shift')


async def enter_walk(page):
    await enter_world(page)
    await page.keyboard.press('f')
    await page.wait_for_function('__MW.ctx.cam.grounded')


async def play_walk(page, ctl):
    while True:
        await move(page, ctl, 'w', 4)
        await ctl.tap('Space')
        await move(page, ctl, 'a', 3)
        await ctl.drag(140, -35, 1, button='right')
        await move(page, ctl, 's', 4)
        await page.keyboard.down('Shift')
        try:
            await move(page, ctl, 'd', 3)
        finally:
            await page.keyboard.up('Shift')


async def settings(page):
    await page.get_by_role('button', name='Settings (Esc)', exact=True).click()
    await page.locator('.mw-settings').wait_for(state='visible')


def atmosphere(label, hour):
    async def enter(page):
        await enter_world(page)
        await settings(page)
        await page.get_by_role('button', name=label, exact=True).click()
        assert abs(await page.evaluate('__MW.ctx.env.hour') - hour) < .01
        await page.get_by_role('button', name='Resume', exact=True).click()
        await asyncio.sleep(.4)
    return enter


async def enter_lapse(page):
    await atmosphere('Dawn', 6.5)(page)
    await settings(page)
    await page.locator('.mw-row').filter(has=page.get_by_text('Time-lapse', exact=True)).get_by_role('switch').click()
    assert await page.evaluate('__MW.ctx.env.speed') > 0
    await page.get_by_role('button', name='Resume', exact=True).click()


async def enter_tour(page):
    await enter_world(page)
    await settings(page)
    await page.get_by_role('button', name='Watch the cinematic tour', exact=True).click()
    await page.wait_for_function("__MW.ctx.tour.active && __MW.ctx.cam.mode === 'tour'")


async def play_tour(page, ctl):
    # Tour is passive by design; movement exits it. These supported controls
    # change the light and interface while the original camera route continues.
    for key in [']', '[', 'h', 'h']:
        before = await position(page)
        await ctl.tap(key)
        await ctl.wait(15)
        assert await page.evaluate('__MW.ctx.tour.active')
        assert math.dist(before, await position(page)) > 1, 'Tour camera stopped'
    await ctl.tap('c')
    await page.wait_for_function("__MW.ctx.cam.mode === 'fly'")
    await move(page, ctl, 'a', 4)
    await ctl.tap('c')
    await page.wait_for_function('__MW.ctx.tour.active')
    while True:
        before = await position(page)
        await ctl.wait(5)
        assert math.dist(before, await position(page)) > 1, 'Restarted tour camera stopped'


async def enter_photo(page):
    await enter_world(page)
    await page.get_by_role('button', name='Hide the interface (H)', exact=True).click()
    assert await page.locator('body').evaluate("e => e.classList.contains('mw-photo')")
    async with page.expect_download() as event:
        await page.keyboard.press('p')
    download = await event.value
    assert download.suggested_filename.startswith('monolith-wilds-')
    assert await download.failure() is None, 'Photograph export failed'


MODES = [
    Mode('free-flight', enter_world, play_flight, seconds=45,
         note='Begin; WASD, rise/sink, right-drag look, Shift boost. Default quality and golden-hour light.'),
    Mode('walking', enter_walk, play_walk, seconds=40,
         note='Begin then F; wait for the real descent to ground, walk, jump, turn and sprint.'),
    Mode('cinematic-tour', enter_tour, play_tour, seconds=90,
         note='Settings > Watch the cinematic tour; automated travel, light controls, hide/show HUD, C to exit and restart.'),
]
LANDMARKS = [
    ('loom', 'The Loom of Hours', 320, -1750, 1300),
    ('wardens', 'The Kneeling Wardens', -250, -900, 900),
    ('observatory', 'The Drowned Observatory', 330, 180, 700),
    ('stair', 'The Stair to Nowhere', -420, 300, 800),
    ('choir', 'The Choir of Monoliths', -1750, -150, 1100),
    ('needles', 'The Needle City', 1350, -1150, 1400),
    ('span', 'The Vertebral Span', 1720, 0, 1000),
    ('temple', 'The Descending Temple', -450, 1650, 1200),
    ('orrery', 'The Stone Orrery', -1800, 1150, 1300),
    ('monastery', 'The Honeycomb Cloister', -1250, -1440, 1100),
    ('isles', 'The Unmoored Isles', 1350, 1650, 1300),
]

# Source order matters: equal names share a discovery ID but have separate map buttons.
LESSER_PLACES = [
    ('The Long Conduit', -1500, -690, 500),
    ('The Processional Way', -860, -715, 300),
    ('The Sagging Gate', -820, 760, 132),
    ('The Snapped Monolith', 707, -1182, 120),
    ('The Narrowing Arches', -300, 1130, 210),
    ('The Unclosed Ring', 615, 1220, 120),
    ('The Sagging Gate', 2260, -683, 132),
    ('The Snapped Monolith', -2350, 250, 120),
    ('The Unclosed Ring', -770, -1251, 120),
    ('The Narrowing Arches', 2031, 1262, 210),
    ('A Wheel of the Land', -2600, 620, 195),
    ('A Wheel of the Land', 1612, -1838, 195),
    ('A Wheel of the Land', 631, 2297, 195),
    ('A Wheel of the Land', 2482, -311, 195),
    ('The Descent', 508, 763, 210),
    ('The Descent', 1760, 880, 210),
    ('The Turning Doors', -1520, -1080, 270),
    ('The Turning Doors', 520, -820, 270),
    ('The Turning Doors', -1585, 490, 270),
    ('The Mirror-Faced', -760, -250, 120),
    ('The Mirror-Faced', 1680, 1033, 120),
    ('The Mirror-Faced', -2020, -1020, 120),
    ('The Open Hand', -1504, 1612, 120),
    ('The Open Hand', 971, 162, 120),
    ('The Court of Stumps', 1201, -146, 186),
]

for slug, name, x, z, radius in LANDMARKS:
    enter, play = destination(name, x, z, radius)
    MODES.append(Mode(slug, enter, play, seconds=35,
                      note=f'{name} ({x}, {z}). Fly to discover, click map Travel, then inspect with WASD and mouse.'))

_occurrences = {}
for name, x, z, radius in LESSER_PLACES:
    occurrence = _occurrences.get(name, 0)
    _occurrences[name] = occurrence + 1
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    enter, play = destination(name, x, z, radius, occurrence)
    MODES.append(Mode(f'{slug}-{occurrence + 1}', enter, play, seconds=35,
                      note=f'{name} ({x}, {z}), map instance {occurrence + 1}. '
                           'Discover via flight, select its map marker, then inspect using WASD/mouse. '
                           'Repeated names share the original discovery ID but expose distinct Travel buttons.'))

for label, hour in [('Dawn', 6.5), ('Noon', 13), ('Golden hour', 17.6), ('Dusk', 18.6), ('Night', 22)]:
    MODES.append(Mode('light-' + label.lower().replace(' ', '-'), atmosphere(label, hour),
                      play_flight, seconds=30, expect_dark=label == 'Night',
                      note=f'Settings > {label}; fly, ascend/descend and steer. '
                           + ('Night intentionally uses moonlight and dark terrain; silhouettes must still move.'
                              if label == 'Night' else 'Original time-of-day scene preset.')))

MODES.extend([
    Mode('time-lapse', enter_lapse, play_flight, seconds=90,
         note='Settings > Dawn > Time-lapse; explore while the original five-minute day advances.'),
    Mode('photo-view', enter_photo, play_flight, seconds=30,
         note='Hide the interface button, P to export a PNG, then fly and frame the landscape without the HUD.'),
])
