"""A summer-town trailer: aerial map, Minato, eel netting and reef diving.

Full-size original game frames are booted in prepare(), so the two editorial
cuts never show title screens or loading. Only keyboard/mouse input plays the
games; evaluate() reads telemetry or switches the recording's frame wrapper.
The entry sequences are the minimal helpers from playthrough/moritsuki.py.
"""

import asyncio
import time

from record import Shot

URL = 'http://127.0.0.1:8096/moritsuki/index.html'


class View:
    """Keep real page input while targeting an original game document."""

    def __init__(self, page, frame):
        self.page = page
        self.frame = frame
        self.keyboard = page.keyboard
        self.mouse = page.mouse

    def __getattr__(self, name):
        return getattr(self.frame, name)


async def hold(page, keys, seconds):
    keys = keys.split('+')
    try:
        for key in keys:
            await page.keyboard.down(key)
        await asyncio.sleep(seconds)
    finally:
        for key in reversed(keys):
            await page.keyboard.up(key)


async def look(page, dx, dy, seconds=3):
    cursor = await page.evaluate('''() => ({
        x: game.input.cursor.x * innerWidth,
        y: game.input.cursor.y * innerHeight
    })''')
    await move_mouse(page, cursor['x'], cursor['y'], dx, dy, seconds)


async def move_mouse(page, x, y, dx, dy, seconds):
    began = time.monotonic()
    steps = round(seconds * 30)
    for step in range(1, steps + 1):
        t = step / steps
        ease = t * t * (3 - 2 * t)
        await page.mouse.move(x + dx * ease, y + dy * ease)
        await asyncio.sleep(max(0, began + seconds * t - time.monotonic()))


async def map_ready(page):
    await page.locator('#loading').wait_for(state='hidden')
    await page.locator('#travel.show').wait_for()
    await page.locator('#tv-pins .lb').first.wait_for()


async def select_pin(page, label):
    await page.locator('#tv-pins button').filter(has_text=label).locator('.lb').click()


async def enter_mini(page, label):
    await map_ready(page)
    await select_pin(page, label)
    await page.locator('#game-card.show').wait_for()
    await page.locator('.gc-go').click()
    await page.locator('#title.show [data-act="start"]').click()
    await page.mouse.move(640, 360)
    await page.locator('#intro.show').wait_for()
    await page.keyboard.press('Space')
    await page.wait_for_function('window.game?.mode === "play" && game.input.enabled')
    await page.wait_for_function('Number(getComputedStyle(document.querySelector("#fade")).opacity) < .05')
    await asyncio.sleep(.6)
    await page.locator('#c').click(position={'x': 640, 'y': 360})
    await page.wait_for_function('game.input.locked || game.input.freeLook')


async def show(page, name, *, discard=False):
    # An editorial cut between full-size live originals, without game patches.
    await page.evaluate('''({name, discard}) => {
        for (const el of document.querySelectorAll('iframe')) {
            if (discard && el.style.display !== 'none' && el.name !== name) el.remove();
            else el.style.display = el.name === name ? 'block' : 'none';
        }
        document.querySelector(`iframe[name="${name}"]`).contentWindow.focus();
    }''', dict(name=name, discard=discard))
    return View(page, page.frame(name=name))


async def prepare(page):
    await page.bring_to_front()
    await map_ready(page)
    # Replace only the capture container; every iframe loads untouched originals.
    # A local origin is required: Chrome blocks localhost frames in about:blank.
    wrapper = URL.replace('index.html', '__recording__.html')
    async def container(route):
        await route.fulfill(content_type='text/html', body=(
            '<style>html,body{margin:0;overflow:hidden}iframe{position:fixed;'
            'inset:0;width:100%;height:100%;border:0}</style>'))
    await page.route(wrapper, container)
    await page.goto(wrapper)
    for name, label in [('unagi', 'ウナギ掬い'), ('mori', 'モリ突き'), ('town', None)]:
        await page.evaluate('''({name, url}) => {
            for (const el of document.querySelectorAll('iframe')) el.style.display = 'none';
            const el = document.createElement('iframe');
            el.name = name; el.src = url; document.body.append(el);
        }''', dict(name=name, url=URL))
        await page.locator(f'iframe[name="{name}"]').wait_for()
        frame = await page.locator(f'iframe[name="{name}"]').element_handle()
        view = View(page, await frame.content_frame())
        if label:
            await enter_mini(view, label)
            if name == 'mori':
                # Clear the one-time dive hint, then wait safely at the surface.
                await hold(view, 'c', 2)
                await hold(view, 'Space', 3)
                await view.locator('#hint.show').wait_for(state='hidden')
        else:
            await map_ready(view)
    await show(page, 'town')
    await asyncio.sleep(1)


async def cast(page):
    await page.wait_for_function('game.player.submerged && game.spear.state === "ready"', timeout=3000)
    await page.mouse.down()
    try:
        await asyncio.sleep(1.2)
        await page.wait_for_function('game.spear.state === "charging" && game.spear.charge > .9', timeout=3000)
    finally:
        await page.mouse.up()
    await asyncio.sleep(1.3)


async def overview(page, _cue):
    town = View(page, page.frame(name='town'))
    # 0-11 s: the playable summer-town map and its native flight into Minato.
    await hold(town, 'd', 2)
    await hold(town, 'a', 2)
    await hold(town, 'q', .45)
    await asyncio.sleep(1)
    await select_pin(town, '定食 みなと')
    await town.wait_for_function('!document.body.classList.contains("sky")')
    await page.mouse.click(640, 360)
    await asyncio.sleep(.5)

    # Approach Natsumi, then keep walking past the shop, cars and canal.
    # The NPC's native proximity prompt verifies that we actually reach her.
    for _ in range(8):
        if await town.locator('#talk-prompt.show').count():
            break
        await hold(town, 'w', .22)
    await town.locator('#talk-prompt.show').wait_for(timeout=3000)
    await hold(town, 's', 2)
    await hold(town, 'd', 3)
    await move_mouse(town, 640, 360, 110, 0, 3)
    await hold(town, 'a', 3)
    await move_mouse(town, 750, 360, -110, 0, 3)
    await hold(town, 'a', 2)
    await hold(town, 'd', 2)

    # A headlamp-lit ditch: advance, lower the net, sweep and lift twice.
    eel = await show(page, 'unagi', discard=True)
    await page.mouse.move(640, 360)
    for _ in range(2):
        await hold(eel, 'w', 2.5)
        await eel.mouse.down()
        try:
            await asyncio.sleep(.7)
            await look(eel, 90, 0, 1.5)
            await look(eel, -180, 0, 2)
        finally:
            await eel.mouse.up()
        await asyncio.sleep(.8)
        if await eel.evaluate('game.mode === "show"'):
            await eel.mouse.click(550, 360)
        await look(eel, 90, 0, 1)
    assert await eel.evaluate('game.scoops >= 2'), 'Both net lifts must register'

    # Finish in clear blue water: reef patrol, spear casts and an island view.
    reef = await show(page, 'mori', discard=True)
    await page.mouse.move(640, 360)
    await hold(reef, 'c', 1.15)
    await look(reef, 0, 45, 1)
    await hold(reef, 'w', 3)
    await hold(reef, 'd', 3)
    await cast(reef)
    await look(reef, -160, 0, 3)
    await hold(reef, 's', 2)
    # Shallow-water buoyancy lifts the swimmer; descend again before casting.
    await hold(reef, 'c', 1)
    await cast(reef)
    await hold(reef, 'Space', 3)
    await look(reef, 0, -90, 2)
    await hold(reef, 'a', 2)


SHOTS = {
    'overview': Shot(
        url=URL, module=None, serve=['moritsuki'], prepare=prepare, run=overview,
        overlay=False, poster_at=16, preview_at=12, min_fps=45,
    ),
}
