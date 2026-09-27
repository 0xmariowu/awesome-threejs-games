"""Original INKWAVE: all three stages and four menu-selectable weapons.

Only DOM clicks and keyboard/mouse input drive the game. The existing __G and
__inkwave audit hooks are read, never changed. Garden is a separate project,
not reachable from this entry's menus. There is no online/account menu.
"""

import json
import math
import time

from playthrough import Mode

SERVE = ['inkwave']
# Headless Chrome denies Pointer Lock; primary fire needs it (harness-only emulation).
POINTER_LOCK_SHIM = True
URL = 'http://127.0.0.1:8088/index.html'


async def _screen(page, name):
    await page.locator('.iw-ui[data-screen="%s"]' % name).wait_for()
    # Cards exist during the outgoing screen's ink wipe; wait for it to clear.
    await page.wait_for_timeout(1300)


async def _state(page):
    return await page.evaluate('''() => {
      const g = window.__G, m = g.match, a = m.local;
      return {state: m.state, paused: m.paused, attract: m.attract,
        map: __inkwave.mapDef.id, weapon: a.weaponId,
        difficulty: m.opts.difficulty, duration: m.duration, time: m.time,
        pos: a.pos.toArray(), alive: a.alive, ink: a.ink,
        turf: a.stats.turf, splats: a.stats.splats, deaths: a.stats.deaths,
        specials: a.stats.specials, specialReady: a.specialReady(),
        locked: g.input.locked, firing: a.intent.fire,
        screen: g.menus.current, focus: document.hasFocus()};
    }''')


async def _resume_if_unlocked(page):
    if not await page.evaluate('!!document.pointerLockElement'):
        # Start requests lock inside an asynchronous wipe. Resume is a direct
        # real user gesture, and also exercises the game's pause/resume path.
        if not await page.evaluate('__G.match.paused'):
            await page.keyboard.press('p')
        await _screen(page, 'pause')
        await page.locator('.iw-pause [data-id="resume"]').click()
        await page.wait_for_function('!__G.match.paused && !__G.menus.current')
        await page.wait_for_timeout(400)


def _entry(stage, weapon, difficulty, duration):
    async def enter(page):
        await _screen(page, 'title')
        await page.keyboard.press('Enter')
        await _screen(page, 'main')
        await page.locator('.iw-main [data-id="loadout"]').click()
        await _screen(page, 'loadout')
        await page.locator('[data-id="w-%s"]' % weapon).click()
        await page.locator('[data-id="w-%s"].is-equipped' % weapon).wait_for()
        await page.locator('.iw-loadout .iw-backbtn').click()
        await _screen(page, 'main')
        await page.locator('.iw-main [data-id="play"]').click()
        await _screen(page, 'setup')
        await page.locator('[data-id="map-%s"]' % stage).click()
        await page.locator('[data-id="difficulty"] .iw-seg__opt').nth(
            ('easy', 'normal', 'hard').index(difficulty)).click()
        await page.locator('[data-id="length"] .iw-seg__opt').nth(
            0 if duration == 90 else 1).click()
        await page.locator('.iw-setup [data-id="start"]').click()
        await page.wait_for_function(
            'window.__G?.match?.state === "playing" && !__G.match.attract')
        await _resume_if_unlocked(page)
        state = await _state(page)
        assert (state['map'], state['weapon'], state['difficulty'], state['duration']) == (
            stage, weapon, difficulty, duration), state
        print('inkwave entry: ' + json.dumps(state), flush=True)
    return enter


def _driver(weapon, seconds, complete_round=False):
    async def play(page, ctl):
        initial = await _state(page)
        origin = initial['pos']
        max_distance = 0
        painted = False
        primary_fired = False
        rematched_at = None
        started = time.monotonic()
        cycle = 0
        try:
            # Reserve time for the last input sequence and diagnostic assertions
            # before the runner cancels play at the mode's wall-clock deadline.
            while time.monotonic() - started < seconds - 7:
                state = await _state(page)
                if state['screen'] == 'results':
                    print('inkwave results: ' + json.dumps(state), flush=True)
                    # Keep the real score/XP screen visible for a runner shot.
                    await ctl.wait(6)
                    await page.locator('.iw-results [data-id="rematch"]').click()
                    await page.wait_for_function(
                        '__G.match.state === "playing" && !__G.match.attract')
                    await _resume_if_unlocked(page)
                    rematched_at = time.monotonic()
                    cycle = 0
                    continue
                if state['state'] != 'playing':
                    await ctl.wait(0.25)
                    continue
                if state['paused']:
                    await _resume_if_unlocked(page)

                # Native mouse events are intentionally not replaced by writes
                # to debug.fire/input state if headless Chrome denies lock.
                # Shoot, charge/release, or roll while leaving spawn/strafe cover.
                key = ('w', 'd', 'w', 'a', 's', 'd')[cycle % 6]
                await page.keyboard.down(key)
                await page.mouse.down()
                await ctl.wait(1.25 if weapon == 'charger' else 2)
                during = await _state(page)
                primary_fired |= during['firing'] and during['locked']
                await page.mouse.up()
                await ctl.wait(0.4)  # Charger's beam is fired on release.
                await page.keyboard.up(key)
                max_distance = max(max_distance, math.dist(origin, during['pos']))
                painted |= during['turf'] > 0

                if during['specialReady']:
                    await ctl.hold('f', 0.2)
                if during['ink'] >= 70:
                    await ctl.hold('e', 0.5)  # Aim the bomb, release to throw.
                    # The release must reach a simulation frame before squid
                    # form masks subReleased and cancels the throw.
                    await ctl.wait(0.25)
                await page.keyboard.down('Shift')
                await ctl.hold(key, 1.2)
                await page.keyboard.up('Shift')
                await ctl.hold('Space', 0.25)
                # The actual map UI and super-jump input, with no teleport API.
                if cycle % 4 == 3:
                    await page.keyboard.down('Tab')
                    await ctl.wait(0.5)
                    await ctl.tap('1')
                    await page.keyboard.up('Tab')
                state = await _state(page)
                painted |= state['turf'] > 0
                print('inkwave input: ' + json.dumps(state), flush=True)
                cycle += 1

            problems = []
            if max_distance < 2:
                problems.append('Local player did not move at least 2 world units')
            if not painted:
                problems.append('Local player earned no turf despite fire/bomb input')
            if not primary_fired:
                problems.append('Headless Chrome did not grant pointer lock through '
                                'START or Pause/Resume; native primary-fire input '
                                'was ignored (movement and keyboard bombs still attempted)')
            if complete_round and (rematched_at is None or time.monotonic() - rematched_at < 30):
                problems.append('Full results/rematch flow did not yield 30 seconds of rematch play')
            if problems:
                raise AssertionError('; '.join(problems))
        finally:
            await page.mouse.up()
            for key in ('w', 'a', 's', 'd', 'Shift', 'Space', 'Tab', 'e', 'f'):
                await page.keyboard.up(key)
    return play


# Stage x loadout coverage; difficulty and round length are rules/settings, not
# additional worlds. Every value is selected through setup across this matrix.
# The first mode continues through the 90-second timer, results and rematch.
MODES = []
for stage_index, stage in enumerate(('tidewater', 'kelpline', 'sunset')):
    for weapon_index, weapon in enumerate(('shooter', 'roller', 'charger', 'blaster')):
        full_round = stage_index == weapon_index == 0
        difficulty = ('easy', 'normal', 'hard')[(stage_index + weapon_index) % 3]
        duration = 90 if (stage_index + weapon_index) % 2 == 0 else 180
        seconds = 165 if full_round else 40
        MODES.append(Mode(
            name=stage + '-' + weapon,
            enter=_entry(stage, weapon, difficulty, duration),
            play=_driver(weapon, seconds, full_round), seconds=seconds,
            note=('Offline Turf War, 1 player + 7 bots; %s; %s; %s; %ds round. '
                  'Real UI loadout/setup/pause/resume; movement, primary fire '
                  '(charger release / roller hold), bombs, swim/refill, jump, '
                  'map/super jump and earned specials. Pointer-lock failure is '
                  'reported as a play error, never bypassed with debug input. '
                  '%s%s' % (stage, weapon, difficulty, duration,
                            'Includes natural results and >=30s rematch. ' if full_round else '',
                            'Dusk remains visibly lit; expect_dark is false.' if stage == 'sunset' else '')),
        ))
