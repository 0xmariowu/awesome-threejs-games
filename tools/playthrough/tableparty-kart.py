"""Real-menu coverage of the archived Sunsprint client, without network stubs.

Menu/source inventory: Casual -> eight racers, Single Race / Grand Prix,
Sunrise / Comet cups (four courses each), Easy / Normal / Hard; Battle ->
Sunbreak Bowl; Ranked; Invite friends; Join with a code; Watch trailer.
There is no separate vehicle selector or time-trial mode. Each racer has its
own kart. Course/racer coverage is paired rather than a redundant 8 x 8 grid.
The two Grand Prix entries exercise the cup rules; they do not certify four
completed races. Help/settings/pause are overlays, not extra game worlds.

Sources: README.md, TECHNICAL.md, local.json, catalog/games.json and the
preserved kart-7vz70Zig.js / StartingGrid-Kt6Wgcbh.js / Trailer-BfFtlItL.js.
FULL-AUDIT.md predates this game and has no Tableparty row. The requested
gameplay.py, scenarios, and browser_check.py contain no Tableparty driver.
"""

import re
import math

from playthrough import Mode


SERVE = ['tableparty-kart']
URL = 'http://127.0.0.1:8100/kart/index.html'

# Exact labels and cup membership observed in the actual course selector.
COURSES = [
    ('coast', 'Sunbreak Circuit', 'Sunrise Cup', 'Pip', 'Easy'),
    ('canyon', 'Copper Canyon', 'Sunrise Cup', 'Luma', 'Normal'),
    ('garden', 'Moonpetal Pass', 'Sunrise Cup', 'Bruno', 'Hard'),
    ('cosmos', 'Starlight Speedway', 'Sunrise Cup', 'Nova', 'Easy'),
    ('candy', 'Gumdrop Gorge', 'Comet Cup', 'Dash', 'Normal'),
    ('cloud', 'Cloudhop Isles', 'Comet Cup', 'Tess', 'Hard'),
    ('snow', 'Frostbite Summit', 'Comet Cup', 'Rocco', 'Easy'),
    ('forge', 'Cinder Forge', 'Comet Cup', 'Poppy', 'Normal'),
]


async def starting_grid(page):
    await page.get_by_role('heading', name='Starting Grid', exact=True).wait_for()


async def ready_to_drive(page):
    await page.get_by_role('button', name='Pause race', exact=True).wait_for()
    # The race HUD appears before the 3.5-second countdown finishes. Start
    # the runner's gameplay budget only once real driving is possible.
    await page.wait_for_function("""() => {
        const clock = document.querySelector('.kart-lap');
        return clock && !document.querySelector('.kart-countdown')
            && !document.querySelector('.kart-loading-screen');
    }""")


def race_entry(course, cup, racer, difficulty, grand_prix=False):
    async def enter(page):
        await starting_grid(page)
        await page.get_by_role('button', name='Casual', exact=True).click()
        await page.get_by_role('button', name='Change racer or course').click()
        await page.get_by_role('button', name=racer, exact=True).click()
        await page.locator('.console-next').click()
        await page.get_by_role('button', name=(
            'Grand Prix' if grand_prix else 'Single Race'), exact=True).click()
        await page.get_by_role('group', name='Computer difficulty').get_by_role(
            'button', name=difficulty, exact=True).click()
        await page.get_by_role('group', name='Cup', exact=True).get_by_role(
            'button', name=re.compile('^' + re.escape(cup))).click()
        await page.get_by_role('button', name=course, exact=True).click()
        await page.locator('.console-next').click()
        await ready_to_drive(page)
    return enter


READ_RACE = """() => {
    // Read the original React ref only. Never call stepDriver/botInput or
    // modify the race, its clock, the selected mode, or any input object.
    let element = document.querySelector('canvas'), key;
    while (element && !key) {
        key = Object.keys(element).find(k => k.startsWith('__reactFiber$'));
        if (!key) element = element.parentElement;
    }
    for (let fiber = element?.[key]; fiber; fiber = fiber.return) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const race = hook.memoizedState?.current;
            if (!race?.track || !race?.drivers || !race?.player) continue;
            const p = race.player, track = race.track;
            const box = race.pickups.filter(b => b.kind === 'box' && b.cooldown <= 0)
                .map(b => ({lane: b.lane, gap: track.delta(b.s, p.s)}))
                .filter(b => b.gap > 0 && b.gap < 45)
                .sort((a, b) => Math.abs(a.lane-p.lane)-Math.abs(b.lane-p.lane))[0];
            return {track: track.spec.id, battle: race.battle,
                time: race.time, length: track.length,
                s: p.s, lane: p.lane, heading: p.heading, speed: p.speed,
                curve: track.at(p.s).curve, width: track.spec.width,
                lap: p.lap, finish: p.finish, coins: p.coins, item: p.item,
                points: p.points, balloons: p.balloons,
                airborne: p.airborne, rescue: p.rescue,
                drifting: p.drifting, driftDirection: p.driftDirection,
                target: box && !p.item ? box.lane : 0};
        }
    }
    throw new Error('Original race ref unavailable for read-only steering feedback');
}"""


async def drive(page, ctl):
    """Steer with Chrome keyboard events using read-only position feedback.

    Track-relative heading still needs countersteering on bends. The controller
    aims at nearby item boxes or the road centre; it never invokes the bot AI.
    Fractional steering is supplied as short real left/right key pulses.
    """
    await page.keyboard.down('ArrowUp')
    pulse = 0
    held = None
    tick = 0
    drift_until = -1
    try:
        while True:
            state = await page.evaluate(READ_RACE)
            if tick % 100 == 0:
                print('tableparty-kart/race feedback: ' + str(state), flush=True)
            desired = max(-0.35, min(0.35, math.atan(
                (state['target'] - state['lane']) * 0.12)))
            curve_force = state['curve'] * state['speed'] / max(
                0.55, min(1.6, 1 - state['curve'] * state['lane']))
            if state['battle']:
                error = (desired - state['heading'] + math.pi) % (2 * math.pi) - math.pi
                # The arena's free heading uses ef=1.9 in stepDriver.
                steer = (curve_force + 3 * error) / 1.9
            elif state['drifting']:
                steer = (curve_force + 1.05 * desired +
                         3 * (desired - state['heading']) -
                         0.55 * state['driftDirection']) / 0.7
            else:
                steer = curve_force + 2.6 * desired + 3 * (desired - state['heading'])
            pulse += max(-1, min(1, steer))
            # The game's Qo(qe) negates screen-space keys into track-space.
            key = 'ArrowLeft' if pulse >= 0.5 else 'ArrowRight' if pulse <= -0.5 else None
            if key:
                pulse -= 1 if key == 'ArrowLeft' else -1
            if held != key:
                if held:
                    await page.keyboard.up(held)
                if key:
                    await page.keyboard.down(key)
                held = key
            if (not state['battle'] and tick % 70 == 20
                    and abs(state['lane']) < state['width'] / 4):
                await page.keyboard.down('Shift')
                drift_until = tick + 7
            if tick == drift_until:
                await page.keyboard.up('Shift')
            if tick % 15 == 0:
                await ctl.tap('Space')
            if state['finish'] is not None:
                labels = ('BATTLE AGAIN',) if state['battle'] else ('NEXT COURSE', 'NEXT RACE')
                for label in labels:
                    button = page.get_by_role('button', name=re.compile('^' + label))
                    if await button.is_visible():
                        for control in ('ArrowUp', 'ArrowLeft', 'ArrowRight', 'Shift'):
                            await page.keyboard.up(control)
                        held, pulse = None, 0
                        if state['battle']:
                            print('tableparty-kart/battle result: ' +
                                  await page.locator('.kart-results').inner_text(), flush=True)
                            await ctl.wait(6)
                        await button.click()
                        await ready_to_drive(page)
                        await page.keyboard.down('ArrowUp')
            tick += 1
            await ctl.wait(0.1)
    finally:
        for key in ('ArrowUp', 'ArrowLeft', 'ArrowRight', 'Shift'):
            await page.keyboard.up(key)


async def enter_battle(page):
    await starting_grid(page)
    await page.get_by_role('button', name=re.compile('^Battle')).click()
    await page.get_by_role('button', name='Hard', exact=True).click()
    await page.get_by_role('button', name=re.compile('^Change racer')).click()
    await page.get_by_role('button', name='Poppy', exact=True).click()
    await page.locator('.console-next').click()
    await ready_to_drive(page)


async def battle(page, ctl):
    await drive(page, ctl)


async def enter_trailer(page):
    await starting_grid(page)
    await page.get_by_role('button', name='Watch the Sunsprint trailer').click()
    await page.locator('video').wait_for()
    await page.wait_for_function("""() => {
        const video = document.querySelector('video');
        return video && video.readyState >= 2 && video.currentTime > 0;
    }""")


async def watch_trailer(page, ctl):
    # This menu-reachable scene is a film, not an interactive driving mode.
    # Native video keyboard controls exercise pause/resume; playback then runs
    # through the full archived 61-second trailer, without Share/network use.
    await page.locator('video').focus()
    await ctl.tap('Space')
    await ctl.wait(0.5)
    await ctl.tap('Space')
    while True:
        await ctl.wait(5)
        status = await page.locator('video').evaluate(
            '(v) => ({error: v.error?.code, paused: v.paused, ended: v.ended})')
        if status.get('error'):
            raise RuntimeError('Trailer media error: ' + str(status['error']))
        if status['paused'] and not status['ended']:
            raise RuntimeError('Trailer remained paused after native resume input')


async def unavailable_enter(page):
    raise RuntimeError('Online modes require the unavailable /kart-room server')


async def unavailable_play(page, ctl):
    raise RuntimeError('No local online-gameplay implementation exists')


MODES = [
    Mode('race-' + slug + '-' + racer.lower(),
         race_entry(course, cup, racer, difficulty), drive, seconds=45,
         note=f'Single Race: {course}; {racer} and their kart; {difficulty}; '
              'three-lap rules. Real keyboard acceleration, steering, drift, '
              'tricks and item input; this sample does not certify a finish.')
    for slug, course, cup, racer, difficulty in COURSES
]
MODES += [
    Mode('grand-prix-sunrise',
         race_entry('Sunbreak Circuit', 'Sunrise Cup', 'Pip', 'Normal', True),
         drive, seconds=60,
         note='Grand Prix -> Sunrise Cup. Starts on Sunbreak Circuit; subsequent '
              'courses are Copper Canyon, Moonpetal Pass, Starlight Speedway. '
              'All four courses also have separate Single Race Modes. '
              'Full cup completion is not certified by this timed sample.'),
    Mode('grand-prix-comet',
         race_entry('Gumdrop Gorge', 'Comet Cup', 'Dash', 'Hard', True),
         drive, seconds=60,
         note='Grand Prix -> Comet Cup. Starts on Gumdrop Gorge; subsequent '
              'courses are Cloudhop Isles, Frostbite Summit, Cinder Forge. '
              'All four courses also have separate Single Race Modes. '
              'Full cup completion is not certified by this timed sample.'),
    Mode('battle-sunbreak-bowl', enter_battle, battle, seconds=140,
         note='Offline Balloon Battle: Sunbreak Bowl, Poppy, Hard, 11 CPUs. '
              'Run through the two-minute match and attempt a rematch. Known '
              'sky-arena.webp prefetch 404 is retained; actual arena uses coast.'),
    Mode('trailer', enter_trailer, watch_trailer, seconds=65,
         note='Non-gameplay menu scene: full 61-second film with native '
              'pause/resume input. Missing AV1 source may log 404; the original '
              'video element falls back to the archived H.264 file.'),
]
for name, reason in [
    ('online-host', 'Invite friends -> name -> GO cannot create a room: the '
     'archive has no /kart-room WebSocket server. The local UI reports '
     '"Could not connect to the race server. Retry when it is available."'),
    ('online-join', 'Join with a code -> JOIN requires an existing room/session '
     'on the missing /kart-room WebSocket server; a local test code cannot '
     'establish a connection. No multiplayer success response is fabricated.'),
    ('ranked-knockout', 'Ranked needs profile/matchmaking, knockout rooms, '
     'rankings and result persistence from the missing /kart-room service. '
     'The local Ranked UI reports the race-server connection failure; '
     'NEXT remains disabled. Casual and Battle are the separate offline paths.'),
]:
    MODES.append(Mode(name, unavailable_enter, unavailable_play,
                      reachable=False, unreachable_reason=reason))
