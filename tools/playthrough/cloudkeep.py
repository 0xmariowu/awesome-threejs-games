"""Original b28406d sanctuary, entered only through its real menu buttons.

README.md and upstream/src/{ui,main,input,simulation}.ts enumerate one world,
one airship, and Begin / Continue / Start fresh. The guide, workshop, pause,
and restoration congratulations are dialogs within that world, not levels.
There is no Arena, vehicle picker, account, multiplayer, or remote service.

Unlike the recording scenario, this module never seeds or writes localStorage.
Saved snapshots are read only to verify normal input, purchases, and persistence.
The long fresh flight earns all six workshop upgrades (including both levels
of engine, food, and magnet) and visits the restoration dialog via its button.
"""

import asyncio
import json
import math
import time

from playthrough import Mode

SERVE = ['cloudkeep']
URL = 'http://127.0.0.1:8101/index.html'
SAVE_KEY = 'cloudkeep.save.v1'


async def _saved(page):
    state = await page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', SAVE_KEY)
    assert state is not None, 'The game did not write its local save'
    return state


def _report(label, state):
    fields = ('time', 'pos', 'yaw', 'pitch', 'pearls', 'collected', 'totalFed',
              'totalCaptured', 'levels', 'birds', 'extraWhale', 'restored')
    print('cloudkeep ' + label + ': ' + json.dumps({key: state[key] for key in fields}),
          flush=True)


async def _hold(page, keys, seconds):
    try:
        for key in keys:
            await page.keyboard.down(key)
        await asyncio.sleep(seconds)
    finally:
        for key in reversed(keys):
            await page.keyboard.up(key)


async def _close(page):
    await page.get_by_role('button', name='Close dialog', exact=True).click()
    await page.locator('dialog[open]').wait_for(state='hidden')


async def _checkpoint(page):
    # Pause is a real save action; this avoids stale five-second autosave data.
    await page.get_by_role('button', name='Pause game', exact=True).click()
    await page.get_by_role('heading', name='The sky can wait.', exact=True).wait_for()
    state = await _saved(page)
    await page.get_by_role('button', name='Resume flight').click()
    return state


async def _start(page, label='Begin flight'):
    await page.get_by_role('button', name=label, exact=True).click()
    await page.locator('body.playing').wait_for()
    await page.locator('#world canvas').wait_for()
    assert await page.locator('.intro').is_hidden()


async def enter_fresh(page):
    await _start(page)
    state = await _saved(page)
    assert state['collected'] == state['totalCaptured'] == state['totalFed'] == 0


async def _earn_initial_progress(page):
    await enter_fresh(page)
    await _hold(page, ['Space'], 8)
    await _hold(page, ['q'], 4)
    await _hold(page, ['w'], 1)
    state = await _checkpoint(page)
    assert state['totalFed'] > 0 and state['totalCaptured'] > 0, 'Initial encounters failed'
    assert state['collected'] > 0, 'No encounter coins collected'
    return state


async def enter_continue(page):
    before = await _earn_initial_progress(page)
    # Freeze before reload so the exact persisted progress can be compared.
    await page.get_by_role('button', name='Pause game', exact=True).click()
    before = await _saved(page)
    await page.reload(wait_until='domcontentloaded')
    await page.get_by_role('button', name='Continue your flight', exact=True).wait_for()
    loaded = await _saved(page)
    for key in ('pos', 'pearls', 'collected', 'totalFed', 'totalCaptured', 'levels'):
        assert loaded[key] == before[key], 'Reload lost ' + key
    await _start(page, 'Continue your flight')
    _report('continued earned save', loaded)


async def enter_restart(page):
    before = await _earn_initial_progress(page)
    await page.get_by_role('button', name='Pause game', exact=True).click()
    await page.get_by_role('button', name='Start a new sanctuary', exact=True).click()
    await page.get_by_role('heading', name='Start a new sanctuary?', exact=True).wait_for()
    await page.get_by_role('button', name='Keep my garden', exact=True).click()
    kept = await _checkpoint(page)
    assert kept['collected'] == before['collected'], 'Cancel restart lost progress'
    await page.get_by_role('button', name='Pause game', exact=True).click()
    await page.get_by_role('button', name='Start a new sanctuary', exact=True).click()
    await page.get_by_role('button', name='Start fresh').click()
    await page.locator('dialog[open]').wait_for(state='hidden')
    state = await _saved(page)
    assert state['pos'] == {'x': 0, 'y': 17, 'z': 28}
    assert state['collected'] == state['pearls'] == state['totalFed'] == state['totalCaptured'] == 0
    assert state['levels'] == {'engine': 0, 'food': 0, 'magnet': 0}
    assert not any(state[key] for key in ('birds', 'extraWhale', 'restored'))
    _report('confirmed fresh sanctuary', state)


async def _workshop(page):
    await page.get_by_role('button', name='Upgrades', exact=True).click()
    await page.get_by_role('heading', name='A little room to grow.', exact=True).wait_for()
    # All changes are purchases with earned coins. Disabled buttons are retained
    # as real progression requirements; never remove their disabled attributes.
    for kind in ('birds', 'food', 'magnet', 'restore', 'whale', 'food', 'magnet',
                 'engine', 'engine'):
        button = page.locator('[data-action="buy:' + kind + '"]')
        if await button.is_enabled():
            await button.click()
            if kind == 'restore':
                await page.get_by_role('heading', name='A light for every wanderer.', exact=True).wait_for()
                _report('restoration congratulations', await _saved(page))
                # Span a runner screenshot interval so the completion dialog is
                # in the evidence, then use its real Keep flying action.
                await asyncio.sleep(6)
                await page.get_by_role('button', name='Keep flying').click()
                await page.get_by_role('button', name='Upgrades', exact=True).click()
    state = await _saved(page)
    _report('workshop', state)
    await _close(page)
    return state


def _complete(state):
    return (all(level == 2 for level in state['levels'].values())
            and all(state[key] for key in ('birds', 'extraWhale', 'restored')))


async def _flight_lap(page, ctl):
    # A closed route around the current area, with visible thrust, strafe,
    # altitude, pitched flight, steering, orbit, zoom, and camera recentering.
    await ctl.tap('c')
    await _hold(page, ['w', 'Shift'], 2)
    await ctl.hold('r', 1)
    await ctl.drag(150, -40, 1.2)
    await ctl.hold('w', 2)
    await ctl.hold('a', 2)
    await ctl.hold('d', 2)
    await ctl.hold('ArrowUp', .3)
    await ctl.hold('s', 2)
    await ctl.tap('c')
    await ctl.hold('f', 1)
    await ctl.drag(-150, 0, 1.2)
    await _hold(page, ['s', 'Shift'], 2)
    await ctl.drag(180, -30, 1.5, button='right')
    await page.mouse.wheel(0, -160)
    await ctl.wait(.5)
    await ctl.tap('c')


async def _capture_nearby(page, ctl):
    """Aim through mouse input; a resumed creature may be beside/behind us."""
    before = await _checkpoint(page)
    for _ in range(4):
        state = await _checkpoint(page)
        if state['totalCaptured'] > before['totalCaptured']:
            return
        target = min(state['creatures'], key=lambda creature: math.dist(
            list(creature['pos'].values()), list(state['pos'].values())))
        dx = target['pos']['x'] - state['pos']['x']
        dz = target['pos']['z'] - state['pos']['z']
        desired = math.atan2(-dx, -dz)
        turn = math.atan2(math.sin(desired - state['yaw']),
                          math.cos(desired - state['yaw']))
        # input.ts: horizontal drag changes yaw by -0.004 radians per pixel.
        # Split large turns to keep every pointer coordinate in the viewport.
        pixels = -turn / .004
        steps = max(1, math.ceil(abs(pixels) / 300))
        await ctl.tap('c')
        for _ in range(steps):
            await ctl.drag(pixels / steps, 0, .2)
        if math.hypot(dx, dz) > 15:
            await _hold(page, ['w', 'Space'], 1)
        await _hold(page, ['q', 'Space'], 2)
    state = await _checkpoint(page)
    assert state['totalCaptured'] > before['totalCaptured'], 'Aimed Q input did not capture a creature'


async def play_flight(page, ctl):
    started = time.monotonic()
    initial = await _checkpoint(page)
    await _hold(page, ['Space'], 8)
    await _capture_nearby(page, ctl)
    await _flight_lap(page, ctl)
    current = await _checkpoint(page)
    assert current['time'] - initial['time'] > 25, 'Simulation did not advance during input'
    assert current['totalCaptured'] > initial['totalCaptured'], 'Q did not capture a creature'
    assert math.dist(list(current['pos'].values()), list(initial['pos'].values())) > 1, 'Flight did not move'
    _report('flight input verified', current)
    # Finish native input before runner cancellation/context teardown.
    while time.monotonic() - started < 60:
        await _hold(page, ['Space', 'q'], 1)
        await ctl.hold('a' if int(time.monotonic() - started) % 2 else 'd', .5)


async def play_progression(page, ctl):
    started = time.monotonic()
    await ctl.tap('h')
    await page.get_by_role('heading', name='Follow your curiosity.', exact=True).wait_for()
    await page.get_by_role('button', name='Back to the sky').click()
    sound = page.locator('[data-action="sound"]')
    original = await sound.get_attribute('aria-label')
    await sound.click()
    await page.wait_for_function('(label) => document.querySelector(".sound-button").ariaLabel !== label', arg=original)
    await sound.click()
    await page.wait_for_function('(label) => document.querySelector(".sound-button").ariaLabel === label', arg=original)

    cycle = 0
    while time.monotonic() - started < 235:
        # Hovering with seeds is the game's lure mechanic. Nearby creatures
        # approach normally; Q captures them and the default magnet gathers
        # the released coins. Respawns and hunger keep the ecosystem active.
        await _hold(page, ['Space'], 8)
        await _hold(page, ['q'], 4)
        state = await _workshop(page)
        if cycle == 0:
            assert state['totalFed'] > 0 and state['totalCaptured'] > 0
            await ctl.hold('w', 2)
            await ctl.hold('r', 1)
        if _complete(state):
            break
        # Change the bait/capture direction without leaving the feeding area.
        await ctl.drag(100 if cycle % 2 == 0 else -100, 0, .6)
        cycle += 1

    state = await _checkpoint(page)
    _report('progression result', state)
    assert _complete(state), 'Workshop progression unfinished within the real-time input budget'
    assert state['totalFed'] > 0 and state['totalCaptured'] > 0
    # Continue playing the restored world for at least 60 seconds; this is the
    # original Keep flying path, not a different level or an injected save.
    while time.monotonic() - started < 285:
        await _flight_lap(page, ctl)
        await _hold(page, ['Space', 'q'], 4)


MODES = [
    Mode('begin-flight', enter_fresh, play_progression, seconds=320,
         note='Begin flight in the sole sanctuary. Earn coins by luring/capturing; '
              'buy all workshop upgrades, light the beacon, select Keep flying '
              'and explore the restored world. Guide, sound and pause/resume checked. '
              'No save seeding, simulation writes, pointer-lock shim or remote services.'),
    Mode('continue-flight', enter_continue, play_flight, seconds=65,
         note='Earn a save through normal feeding/capture/flight, reload and click '
              'Continue your flight. Assert persistence, then fly, boost, steer, '
              'strafe, change altitude, orbit, zoom, feed and capture.'),
    Mode('new-sanctuary', enter_restart, play_flight, seconds=65,
         note='Earn progress; Pause > Start a new sanctuary > Keep my garden; '
              'repeat and confirm Start fresh. Verify reset, then play the new world. '
              'Only the runner-owned isolated browser context is reset.'),
]
