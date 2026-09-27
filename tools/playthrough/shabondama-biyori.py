"""Eight starting scenes of the original, single bubble-riding experience.

index.html exposes Resume, Restart, Sound and Fullscreen, not a level picker.
sim/director.js makeSpots() lists these eight places; Restart randomly chooses
a different one. Entry therefore repeats that real menu action until the named
scene appears. No seeds, URL overrides, teleports or director mutations are used.
Read-only __app observations verify the result of native pointer/key input.

There are no account/online modes. The /api/video, /api/still and /api/log helpers
belong to the developer-only capture query, not to the game's reachable menu.
"""

import json
import math
import time

from playthrough import Mode

SERVE = ['shabondama-biyori']
URL = 'http://127.0.0.1:8098/'


async def _state(page):
    return await page.evaluate('''() => {
      const a = window.__app, d = a.director;
      return {spot: d.spot.id, state: d.state, pos: d.pos.toArray(),
        bubbles: d.bubbles.length, mainAge: d.main?.age ?? null,
        mainLife: d.main?.life ?? null, time: d.time, frames: a.frames,
        yaw: d.dispYaw, pitch: d.dispPitch, manual: d.manual.w,
        windStep: d.windStep, pops: a.pops, paused: a.paused};
    }''')


async def _menu(page):
    await page.keyboard.press('Escape')
    await page.locator('#menu').wait_for(state='visible')
    await page.wait_for_function('window.__app.paused === true')


def _entry(spot):
    async def enter(page):
        await page.wait_for_function('window.__app?.ready === true')
        await page.locator('#loading').wait_for(state='hidden')
        visited = []
        # Each restart includes the original 0.85 s fade and 1.6 s fade-in.
        # The runner's 90 s entry budget also bounds this random UI search.
        while True:
            current = await _state(page)
            visited.append(current['spot'])
            if current['spot'] == spot:
                break
            await _menu(page)
            await page.locator('#menu [data-act="restart"]').click()
            await page.wait_for_function('__app.director.state === "title"')
        print('shabondama entry: ' + json.dumps(
            {'target': spot, 'restart_visits': visited}), flush=True)

        # Exercise settings in the same experience, not as invented game modes.
        await _menu(page)
        if spot == 'engawa':
            sound = page.locator('#menu [data-act="sound"]')
            before = await sound.inner_text()
            await sound.click()
            assert await sound.inner_text() != before, 'Sound toggle did not change'
            await sound.click()
            assert await sound.inner_text() == before, 'Sound toggle did not restore'
        if spot == 'bridge' and await page.locator(
                '#menu [data-act="fullscreen"]').is_visible():
            await page.locator('#menu [data-act="fullscreen"]').click()
            await page.wait_for_function('!!document.fullscreenElement')
            await _menu(page)
            await page.locator('#menu [data-act="fullscreen"]').click()
            await page.wait_for_function('!document.fullscreenElement')
        await page.locator('#menu [data-act="resume"]').click()
        await page.wait_for_function('!__app.paused')
        # A click is the actual blow control. Leave the blow/follow transition
        # inside the recorded play window, rather than skipping to a ride.
        await page.locator('#c').click(position={'x': 640, 'y': 360})
        await page.wait_for_function('__app.director.state === "blow"')
        assert (await _state(page))['spot'] == spot
    return enter


def _driver(spot, seconds):
    async def play(page, ctl):
        initial = await _state(page)
        started = time.monotonic()
        states, places = set(), set()
        distance = 0
        bubbles = manual = 0
        cycle = 0
        validated = False
        while time.monotonic() - started < seconds - 4:
            current = await _state(page)
            states.add(current['state'])
            places.add(current['spot'])
            distance = max(distance, math.dist(initial['pos'], current['pos']))
            bubbles = max(bubbles, current['bubbles'])
            manual = max(manual, current['manual'])
            if cycle % 4 == 0:
                print('shabondama ' + spot + ': ' + json.dumps(current), flush=True)
            # At the next natural location, blow again via a real control.
            # While riding, travel is wind-driven; input controls the gaze.
            if current['state'] in ('title', 'ready'):
                await ctl.tap('Space' if cycle % 2 else 'Enter')
            sign = 1 if cycle % 2 == 0 else -1
            await ctl.drag(sign * 55, sign * 5, 0.65)
            await ctl.hold('ArrowLeft' if sign > 0 else 'ArrowRight', 0.3)
            await ctl.wait(1.4)
            cycle += 1
            # Assert during play so even cancellation at the runner deadline
            # cannot skip the basic input and movement checks.
            if not validated and time.monotonic() - started > 20:
                assert 'ride' in states, 'Never reached bubble riding: ' + str(states)
                assert bubbles >= 6, 'Blowing did not produce the companion bubbles'
                assert distance > 3, 'Camera did not travel with the bubble'
                assert manual > 0.2, 'Drag/arrow input did not engage manual gaze'
                validated = True
        final = await _state(page)
        if spot == 'engawa':
            # Main bubbles live 95-155 simulation seconds. This longer run
            # covers popping, relocation and another blow without shortening it.
            assert final['pops'], 'No natural bubble pop within the long run'
            assert len(places) > 1, 'Natural pop did not move to a new scene'
        print('shabondama evidence: ' + json.dumps({
            'start': spot, 'states': sorted(states), 'places': sorted(places),
            'distance': round(distance, 2), 'max_bubbles': bubbles,
            'max_manual_gaze': manual, 'validated': validated, 'final': final,
        }), flush=True)
        # Keep meaningful gaze input running through the runner's final shot.
        while True:
            await ctl.hold('ArrowLeft', 0.25)
            await ctl.wait(1)
            await ctl.hold('ArrowRight', 0.25)
            await ctl.wait(1)
    return play


_SCENES = [
    ('engawa', 'House veranda', 200),
    ('dote', 'Riverbank beside the cherry trees', 45),
    ('knoll', 'Hill with the solitary cherry tree', 45),
    ('shrine', 'Shrine steps overlooking the valley', 45),
    ('bridge', 'Bridge over the river', 45),
    ('pond', 'Pond embankment facing the waterfall', 100),
    ('taki', 'Waterfall pool and gorge', 45),
    ('toge', 'Mountain overlook', 45),
]

MODES = [
    Mode(name=spot, enter=_entry(spot), play=_driver(spot, seconds), seconds=seconds,
         note=description + '. A starting scene in the single bubble-riding mode; '
         'reached by the original random Restart menu. Click to blow, drag and '
         'arrow keys to look; the wind moves the bubble. '
         + ('Includes a full natural bubble lifetime, pop and relocation. '
            'Also checks the menu sound toggle.' if spot == 'engawa' else
            'Runs past the pond wind-plan change at 75 ride seconds.' if spot == 'pond' else
            'Also checks the fullscreen menu round trip.' if spot == 'bridge' else
            'No debug navigation or simulation changes.'))
    for spot, description, seconds in _SCENES
]
