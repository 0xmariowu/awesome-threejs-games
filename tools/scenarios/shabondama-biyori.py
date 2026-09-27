"""72 seconds of live bubble rides: cherry river, shrine, bridge, waterfall.

Restart randomly picks a place. Prepare four original game frames through that
menu before recording; native pause keeps the waiting rides still. Cut between
full-viewport frames, with only one unpaused game except during the brief cut.
No game state, wind, lifetime, random seed or camera is assigned by the scenario.
"""

import asyncio
import importlib.util
import math
from pathlib import Path
import time

from record import Shot


_spec = importlib.util.spec_from_file_location(
    '_shabondama_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'shabondama-biyori.py')
_playthrough = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_playthrough)

PLACES = ('dote', 'shrine', 'bridge', 'taki')


async def menu(frame):
    # The playthrough's native Escape/menu sequence, scoped to a game frame.
    await (await frame.frame_element()).focus()
    await frame.page.keyboard.press('Escape')
    await frame.locator('#menu').wait_for(state='visible')
    await frame.wait_for_function('__app.paused === true')


async def enter(frame, spot):
    """Minimal _entry: random Restart search and click-to-blow, no settings tour."""
    await frame.wait_for_function('window.__app?.ready === true')
    await frame.locator('#loading').wait_for(state='hidden')
    visited = []
    while True:
        current = await _playthrough._state(frame)
        visited.append(current['spot'])
        if current['spot'] == spot:
            break
        await menu(frame)
        await frame.locator('#menu [data-act="restart"]').click()
        await frame.wait_for_function('__app.director.state === "title"')
    print(f'shabondama entry: {spot}: {visited}', flush=True)
    await frame.locator('#c').click(position={'x': 640, 'y': 360})
    await frame.wait_for_function('__app.director.state === "follow"')
    await frame.wait_for_function('__app.director.uiTitle < 0.005')
    if spot in ('shrine', 'bridge'):
        # Drift past the landmark, then look back with normal pointer input.
        # Otherwise both default cameras soon face anonymous rice fields.
        await frame.wait_for_function('__app.director.state === "ride"')
        await asyncio.sleep(6)
        for _ in range(3):
            await landmark_look(frame, 1)
    await menu(frame)


async def prepare(page):
    # Unload the initial game, then use the same unmodified URL in each frame.
    # The outer document only selects the live shot; it adds no visible content.
    wrapper = _playthrough.URL + '__record_montage__'
    async def shell(route):
        await route.fulfill(content_type='text/html', body=(
            '<style>html,body{margin:0;overflow:hidden}'
            'iframe{position:fixed;inset:0;width:100%;height:100%;'
            'border:0;opacity:0;pointer-events:none}'
            'iframe.active{opacity:1;pointer-events:auto}</style><body></body>'))
    await page.route(wrapper, shell)
    await page.goto(wrapper)
    for spot in PLACES:
        await page.evaluate('''({spot, url}) => {
            document.querySelectorAll('iframe').forEach(f => f.className = '');
            const f = document.createElement('iframe');
            f.name = spot; f.src = url; f.className = 'active';
            document.body.append(f);
        }''', {'spot': spot, 'url': _playthrough.URL})
        await page.locator(f'iframe[name="{spot}"]').wait_for()
        frame = await page.locator(f'iframe[name="{spot}"]').element_handle()
        frame = await frame.content_frame()
        await asyncio.wait_for(enter(frame, spot), timeout=90)
    await activate(page, 'dote')


async def activate(page, spot):
    frame = page.frame(name=spot)
    # Keyboard activation also works behind the current shot. Wait for a fresh
    # rendered frame before revealing it, so the paused menu never enters video.
    frames = (await _playthrough._state(frame))['frames']
    await frame.locator('#menu [data-act="resume"]').press('Enter')
    await frame.wait_for_function('n => !__app.paused && __app.frames > n + 1',
                                  arg=frames)
    await page.evaluate('''spot => document.querySelectorAll('iframe').forEach(
        f => f.className = f.name === spot ? 'active' : '')''', spot)
    return frame


async def look(page, dx, dy, seconds):
    """The verified centre drag, with eased endpoints for a gentle gaze."""
    x, y = 640, 360
    await page.mouse.move(x, y)
    await page.mouse.down()
    start = time.monotonic()
    steps = math.ceil(seconds * 60)
    try:
        for step in range(1, steps + 1):
            await asyncio.sleep(max(0, start + seconds * step / steps - time.monotonic()))
            t = step / steps
            eased = t * t * (3 - 2 * t)
            await page.mouse.move(x + dx * eased, y + dy * eased)
    finally:
        await page.mouse.up()


async def landmark_look(frame, seconds):
    # Read geometry only. Match director.look's radians-per-pixel conversion,
    # then turn through real drags instead of assigning the camera or director.
    dx, dy = await frame.evaluate('''() => {
        const d = __app.director, s = d.spot.pos;
        const shrine = d.spot.id === 'shrine';
        const x = s.x - (shrine ? 0.4 : 0.8);
        const z = s.z - (shrine ? 20 : 2);
        const y = shrine ? d.groundAt(x, z) + 4 : d.world.bridgeDeck + 1;
        const vx = x - d.pos.x, vz = z - d.pos.z;
        const yaw = Math.atan2(vx, vz);
        const pitch = Math.atan2(y - d.pos.y, Math.hypot(vx, vz));
        const delta = Math.atan2(Math.sin(yaw - d.dispYaw), Math.cos(yaw - d.dispYaw));
        const k = d.camera.fov * Math.PI / 180 / document.querySelector('#c').clientHeight;
        return [delta / k, (pitch - d.dispPitch) / k];
    }''')
    # Keep every drag inside the viewport, including the unrecorded turn-around.
    pieces = max(1, math.ceil(abs(dx) / 450), math.ceil(abs(dy) / 250))
    for _ in range(pieces):
        await look(frame.page, dx / pieces, dy / pieces, seconds / pieces)


async def overview(page, _cue):
    began = time.monotonic()
    for index, spot in enumerate(PLACES):
        frame = page.frame(name=spot)
        if index:
            await activate(page, spot)
            await menu(page.frame(name=PLACES[index - 1]))
        initial = await _playthrough._state(frame)
        if spot in ('shrine', 'bridge'):
            # Track the gate/bridge as the bubble carries us away, revealing
            # its setting instead of losing the defining landmark behind us.
            for _ in range(4):
                await landmark_look(frame, 4.3)
        else:
            await frame.wait_for_function('__app.director.state === "ride"')
            await look(page, 150 if spot != 'taki' else -100, -12, 7)
            await asyncio.sleep(2)
            await look(page, -90 if spot != 'taki' else 65, 8, 5)
        assert (await _playthrough._state(frame))['manual'] > 0.9
        await asyncio.sleep(max(0, began + (index + 1) * 18 - time.monotonic()))
        final = await _playthrough._state(frame)
        assert final['state'] == 'ride', f'{spot}: ride ended early'
        assert final['spot'] == spot, f'{spot}: unexpected relocation'
        assert math.dist(initial['pos'], final['pos']) > 3, f'{spot}: no travel'
        assert final['bubbles'] >= 6, f'{spot}: missing companion bubbles'
        print(f'shabondama segment: {spot}, end={time.monotonic() - began:.2f}s',
              flush=True)


SHOTS = {
    'overview': Shot(
        url=_playthrough.URL, module=None, serve=_playthrough.SERVE,
        prepare=prepare, run=overview, poster_at=45, preview_at=0,
        overlay=False, min_fps=45),
}
