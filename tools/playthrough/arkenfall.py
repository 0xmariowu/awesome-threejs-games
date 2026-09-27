"""Play the original offline campaign and all nine map travel destinations.

Inventory: ui-CiP_B0YL.js title/pause/map screens; Game-BmRmdldn.js
waystone definitions; gameplay-CAzCU-vf.js rethread/rest/travel/save logic.
There is one continuous world, no vehicle/minigame/difficulty selector and
no account or remote service. Settings/Controls are panels, not game modes.
The intro is included unskipped in begin. Continue earns its own save.

Each waystone journey starts with Begin. Discovery/rethreading and the map's
Travel confirmation happen during play (distant journeys exceed the runner's
90-second entry limit). 'entered' thus means campaign entry; the mandatory
travel-arrived observation additionally proves destination entry. A bounded
journey must finish with at least 40 seconds left for destination gameplay.
No debug scenarios, teleports, API-driven actions or fabricated saves are used.
__game is read only, for navigation feedback and assertions.
"""
import argparse
import asyncio
import json
import math
import time
from pathlib import Path

from playthrough import Mode

SERVE = ['arkenfall']
URL = 'http://127.0.0.1:8099/index.html'
# Keep optional observations beside the runner's evidence, including focused
# reruns using --out; separate processes must not overwrite each other's log.
_output_parser = argparse.ArgumentParser(add_help=False)
_output_parser.add_argument('--out', type=Path,
                            default=Path(__file__).resolve().parents[2] / 'output/playthrough')
_output_options, _ = _output_parser.parse_known_args()
OUT = _output_options.out.resolve() / 'arkenfall'


async def state(page):
    return await page.evaluate('''() => ({
        position: __game.player.actor.position.toArray(),
        yaw: __game.cameraRig.yaw, alive: __game.player.actor.alive,
        stamina: __game.player.stamina, playerState: __game.player.state,
        control: __game.player.control, paused: __game.ui.menuOpen,
        engaged: __game.enemies.engagedCount, failed: __game.failed,
        ui: __game.ui.debugStats(), progress: __game.gameplay.snapshot()
    })''')


async def observe(page, name, step):
    value = await state(page)
    path = OUT / ('observations-' + name + '.json')
    data = json.loads(path.read_text()) if path.exists() and step != 'start' else []
    data.append(dict(step=step, **value))
    OUT.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + '\n')
    print(f'  {name}/{step}: {value["position"]}; '
          f'lit={value["progress"]["lit"]}', flush=True)


async def tap(page, key):
    # Input is consumed once per rendered frame. Separate menu transitions.
    await page.keyboard.press(key)
    await asyncio.sleep(.25)


async def hold(page, key, seconds):
    await page.keyboard.down(key)
    try:
        await asyncio.sleep(seconds)
    finally:
        await page.keyboard.up(key)


async def title(page):
    await page.wait_for_function('window.__ready === true')
    await page.keyboard.press('Enter')
    await page.get_by_text('Begin', exact=True).wait_for(state='visible')
    assert not await page.evaluate('__game.failed'), 'Subsystem loading failed'


async def begin(page, skip=True):
    await title(page)
    await page.get_by_text('Begin', exact=True).click()
    await page.wait_for_function('__game.ui.debugStats().intro.length > 0')
    if skip:
        await hold(page, 'Space', 2)
    await page.wait_for_function('__game.started && __game.player.control')
    await asyncio.sleep(1)
    # Native headless pointer lock fails; the original input's fallback allows
    # attacks after lockUnavailable. Navigation uses camera-relative WASD.
    await page.mouse.click(640, 360)
    await asyncio.sleep(.3)


async def enter_begin(page):
    await title(page)
    await page.get_by_text('Begin', exact=True).click()
    await page.wait_for_function('__game.ui.debugStats().intro.length > 0')
    await observe(page, 'begin', 'start')


async def navigate(page, x, z, radius=2.6, timeout=100):
    deadline = time.monotonic() + timeout
    last = None
    stuck = 0
    while time.monotonic() < deadline:
        s = await state(page)
        assert s['alive'], 'Player died during the route; not proof of an archive defect'
        assert not s['paused'], 'Navigation unexpectedly paused'
        assert not s['failed'], 'Subsystem loading failed'
        if s['engaged'] and await page.evaluate('''__game.enemies.active.some(e =>
                e.engaged && e.position.distanceTo(__game.player.actor.position) < 7)'''):
            combat_start = time.monotonic()
            await clear_combat(page)
            if (x, z) == (-60, -258):
                # The stair-foot guards can knock us below the retaining wall.
                # Re-enter at the arch rather than aim uphill through that wall.
                for rx, rz in [(-130, -236), (-120, -244)]:
                    await navigate(page, rx, rz, radius=1.1, timeout=35)
            deadline += time.monotonic() - combat_start
            continue
        px, _, pz = s['position']
        dx, dz = x - px, z - pz
        distance = math.hypot(dx, dz)
        if distance < radius:
            print(f'  route ({x}, {z}): {s["position"]}', flush=True)
            return
        forward = dx * math.sin(s['yaw']) + dz * math.cos(s['yaw'])
        right = -dx * math.cos(s['yaw']) + dz * math.sin(s['yaw'])
        octant = round(math.atan2(right, forward) / (math.pi / 4)) % 8
        keys = [['w'], ['w', 'd'], ['d'], ['s', 'd'], ['s'],
                ['s', 'a'], ['a'], ['w', 'a']][octant].copy()
        if distance > 6 and s['stamina'] > 20:
            keys.append('Shift')
        if last is not None and math.hypot(last[0] - px, last[2] - pz) < .35:
            stuck += 1
            await tap(page, 'Space')
            if stuck > 3:
                keys = ['w', 'a' if stuck % 8 < 4 else 'd', 'Space']
        else:
            stuck = 0
        last = s['position']
        for key in keys:
            await page.keyboard.down(key)
        try:
            await asyncio.sleep(min(.3, max(.08, (distance - radius) / 9)))
        finally:
            for key in keys:
                await page.keyboard.up(key)
    raise AssertionError(f'Route did not reach ({x}, {z}); last state: {s}')


async def clear_combat(page, timeout=65):
    """Use lock-on, charged cleaves, lash, burst and reactive parry/dodge."""
    deadline = time.monotonic() + timeout
    charged_at = None
    last_lash = -100
    try:
        while time.monotonic() < deadline:
            status = await page.evaluate("""() => {
                const p = __game.player.actor;
                return {alive:p.alive, health:p.health, thread:__game.player.thread,
                    maxThread:__game.player.maxThread, engaged:__game.enemies.engagedCount,
                    spire:p.position.z < -430, riposte:__game.combat.riposte,
                    locked:!!__game.combat.lockTarget,
                    foes:__game.enemies.active.filter(e=>e.engaged).map(e=>({
                        distance:e.position.distanceTo(p.position), health:e.health,
                        state:e.state, attack:e.currentAttack ? {
                            until:e.currentAttack.windup-e.attackTime,
                            unblockable:!!e.currentAttack.unblockable} : null
                    })).sort((a,b)=>a.distance-b.distance)};
            }""")
            assert status['alive'], 'Player died fighting; route remains unverified'
            if not status['engaged']:
                return
            near = status['foes'][0]
            # A distant patrol loses sight after eight seconds. Do not chase it
            # away from the stone and draw more enemies into the encounter.
            if near['distance'] > 10:
                await asyncio.sleep(.5)
                continue
            if not status['locked']:
                await tap(page, 'Tab')
            threat = next((e for e in status['foes'] if e['distance'] < 4
                           and e['attack'] and -.04 < e['attack']['until'] < .14), None)
            if threat:
                await page.keyboard.press('q' if threat['attack']['unblockable'] else 'f')
                await asyncio.sleep(.04)
                if charged_at is not None:
                    await page.mouse.up(button='right')
                    charged_at = None
                await asyncio.sleep(.08)
                continue
            now = time.monotonic()
            if status['spire']:
                # Three guards attack at once here. Keep polling their windups
                # rather than blocking on a charged attack's recovery frames.
                if status['thread'] >= status['maxThread'] - .01:
                    await page.keyboard.press('c')
                elif status['riposte'] > 0 or near['distance'] < 2.8:
                    await page.mouse.click(640, 360)
                elif now - last_lash > 1.2:
                    await page.keyboard.press('r')
                    last_lash = now
                else:
                    await hold(page, 'w', .08)
                await asyncio.sleep(.045)
                continue
            if status['thread'] >= status['maxThread'] - .01:
                await tap(page, 'c')
            elif now - last_lash > 3:
                await tap(page, 'r')
                last_lash = now
            elif near['distance'] > 2.4:
                await hold(page, 'w', .2)
            elif charged_at is None:
                await page.mouse.down(button='right')
                charged_at = now
            elif now - charged_at > .9:
                await page.mouse.up(button='right')
                charged_at = None
                await asyncio.sleep(.65)
                await page.mouse.click(640, 360)
            await asyncio.sleep(.06)
        raise AssertionError('Combat did not clear before the route budget expired')
    finally:
        if charged_at is not None:
            await page.mouse.up(button='right')
        if await page.evaluate('!!__game.combat.lockTarget'):
            await tap(page, 'Tab')


async def panels(page):
    await tap(page, 'm')
    await page.locator('.m-map.open').wait_for()
    await page.wait_for_function('__game.ui.debugStats().mapPainted')
    await page.mouse.move(640, 360)
    await page.mouse.wheel(0, 180)
    await asyncio.sleep(1)
    await tap(page, 'Escape')
    await tap(page, 'i')
    await page.wait_for_function('__game.ui.debugStats().inventory !== false')
    await asyncio.sleep(1)
    await tap(page, 'ArrowRight')
    await tap(page, 'ArrowLeft')
    await tap(page, 'Escape')
    assert not await page.evaluate('__game.ui.menuOpen')


async def exercise(page, ctl):
    while True:
        before = (await state(page))['position']
        await ctl.hold('w', 1.4)
        moved = (await state(page))['position']
        assert math.dist(before, moved) > .2, 'Movement produced no displacement'
        await tap(page, 'Space')
        await ctl.hold('s', 1.4)
        after = await state(page)
        assert after['alive'], 'Player died during destination gameplay'
        await page.mouse.click(640, 360)
        await asyncio.sleep(.2)
        await page.mouse.down(button='right')
        try:
            await ctl.wait(.9)
        finally:
            await page.mouse.up(button='right')
        await ctl.wait(.6)
        await tap(page, 'q')
        await tap(page, 'f')
        await tap(page, 'r')
        await ctl.hold('a', 1)
        await ctl.hold('d', 1)


async def play_begin(page, ctl):
    await page.wait_for_function('__game.started && __game.player.control')
    await observe(page, 'begin', 'intro-finished')
    await page.mouse.click(640, 360)
    await ctl.hold('w', 13)
    await page.wait_for_function('__game.gameplay.stage >= 1')
    await observe(page, 'begin', 'ford-autosave')
    await panels(page)
    await exercise(page, ctl)


async def enter_continue(page):
    await begin(page)
    await hold(page, 'w', 13)
    await page.wait_for_function('__game.gameplay.stage >= 1')
    await observe(page, 'continue', 'start')
    assert await page.evaluate('JSON.parse(localStorage.getItem("arkenfall.save.v1")).reachedFord')
    await page.reload(wait_until='domcontentloaded')
    await title(page)
    await page.get_by_text('Continue', exact=True).click()
    await page.wait_for_function('__game.started && __game.player.control')
    assert await page.evaluate('__game.gameplay.snapshot().reachedFord')
    await observe(page, 'continue', 'restored-through-menu')
    await asyncio.sleep(1)
    await page.mouse.click(640, 360)


# Original map definitions. Routes follow the deployed roads/bridge, avoiding
# enemy camps where possible; reaching a stone does not unlock it automatically.
WAYSTONES = [
    ('kettleford', 'Kettle Ford', -35, 248, [(-61, 302), (-40, 280)], 100),
    ('hand', "Weaver's Hand", -214, 152, [(-140, 210)], 110),
    ('weald', 'Whisperpine', -398, -28,
     [(-140, 210), (-214, 152), (-320, 60), (-410, 20)], 230),
    ('fen', 'Mirelight Edge', 338, 208,
     [(-61, 302), (-30, 280), (40, 240), (200, 240)], 170),
    ('chorus', 'Chorusmere Shore', 118, 2,
     [(-61, 302), (-30, 280), (-45, 172), (12, 118), (110, 60)], 180),
    ('cliffbase', 'Chalk Stair', -134, -232,
     [(-140, 210), (-210, 140), (-230, 0), (-185, -150)], 200),
    ('plateau', 'Chalkreach Heights', 60, -372,
     [(-61, 302), (-30, 280), (-45, 172), (12, 118), (96, 30),
      (70, -80), (0, -170), (-70, -222), (-120, -244),
      (-60, -258), (0, -272), (40, -283), (74, -298), (88, -318)], 320),
    ('spire', 'Spire Approach', 40, -470,
     [(-61, 302), (-30, 280), (-45, 172), (12, 118), (96, 30),
      (70, -80), (0, -170), (-70, -222), (-120, -244),
      (-60, -258), (0, -272), (40, -283), (74, -298), (88, -318),
      (70, -380), (48, -440)], 420),
    ('strand', 'Saltglass', 60, 596,
     [(-61, 302), (-30, 340), (-20, 420), (10, 520)], 160),
]


def journey(stone_id, label, x, z, route, seconds):
    name = 'waystone-' + stone_id

    async def enter(page):
        await begin(page)
        await observe(page, name, 'start')

    async def travel(page):
        for px, pz in route:
            await navigate(page, px, pz, radius=1.4 if stone_id in {'plateau', 'spire'} else 4, timeout=70)
            if stone_id == 'spire' and (px, pz) == (88, -318):
                # The north road has two guard encounters. Rest at the actual
                # intermediate waystone to heal before facing the Spire guards.
                await navigate(page, 60, -372, radius=3.3, timeout=45)
                await clear_combat(page)
                await asyncio.sleep(1)
                for _ in range(5):
                    await tap(page, 'e')
                    await asyncio.sleep(4)
                    if 'plateau' in (await state(page))['progress']['lit']:
                        break
                assert 'plateau' in (await state(page))['progress']['lit']
                await observe(page, name, 'plateau-rest')
        yaw = await page.evaluate(
            'id => __game.structures.anchors.get("waystone:" + id).yaw', stone_id)
        if stone_id == 'spire':
            # Its carved facing points down a steep slope. Approach from the
            # flat north-west shoulder (ground normals verified in the client).
            await navigate(page, 37, -464, radius=1.1, timeout=50)
        else:
            await navigate(page, x + math.sin(yaw) * 6,
                           z + math.cos(yaw) * 6, radius=1.5, timeout=50)
        await navigate(page, x, z, radius=3.3, timeout=35)
        await observe(page, name, 'stone-reached')
        await asyncio.sleep(1)
        await clear_combat(page)
        # E can be ignored while landing or while a patrol is still returning.
        for attempt in range(5):
            await tap(page, 'e')
            await asyncio.sleep(4)
            if stone_id in (await state(page))['progress']['lit']:
                break
            await clear_combat(page, timeout=20)
        assert stone_id in (await state(page))['progress']['lit'], 'Waystone did not rethread'
        await observe(page, name, 'stone-lit')
        await asyncio.sleep(1)
        # Leave interaction range, then actually use the map confirmation.
        away_x, away_z = route[-1]
        length = math.hypot(away_x - x, away_z - z)
        await navigate(page, x + (away_x - x) / length * 22,
                       z + (away_z - z) / length * 22, timeout=35)
        pos = (await state(page))['position']
        assert math.hypot(pos[0] - x, pos[2] - z) > 12, 'Did not leave the waystone'
        await tap(page, 'm')
        await page.locator('.m-map.open').wait_for()
        await page.wait_for_function('__game.ui.debugStats().mapPainted')
        zoom = 720 / 1850 * 2.1
        mx = 640 + (x - max(-700, min(700, pos[0]))) * zoom
        my = 360 + (z - max(-760, min(760, pos[2]))) * zoom
        await page.mouse.move(mx, my)
        await asyncio.sleep(.7)
        await page.mouse.click(mx, my)
        await page.get_by_text('Travel to ' + label + '?', exact=True).wait_for(timeout=5000)
        await page.get_by_text('Travel', exact=True).click()
        await asyncio.sleep(3)
        s = await state(page)
        assert not s['paused'] and s['control']
        assert s['progress']['checkpoint']['id'] == stone_id
        assert math.hypot(s['position'][0] - x, s['position'][2] - z) < 6
        await observe(page, name, 'travel-arrived')

    async def play(page, ctl):
        try:
            await asyncio.wait_for(travel(page), seconds - 45)
        except asyncio.TimeoutError as error:
            await observe(page, name, 'route-timeout')
            raise AssertionError('UI journey exceeded its budget; destination unverified') from error
        except Exception as error:
            await observe(page, name, 'journey-failed')
            print(f'  {name}: {error}', flush=True)
            raise
        await exercise(page, ctl)

    return Mode(name, enter, play, seconds=seconds,
                note=f'Begin > walk to {label} > E to rethread > Map > Travel. '
                     'entered records campaign entry; observations must include travel-arrived. '
                     'At least 40 seconds of input after successful travel; no injected progress.')


MODES = [
    Mode('begin', enter_begin, play_begin, seconds=100,
         note='Begin, watch all three original intro shots, walk to Kettle Ford, '
              'earn the quest autosave, use map/inventory and exercise combat/movement.'),
    Mode('continue', enter_continue, exercise, seconds=45,
         note='Earn reachedFord through Begin and walking, reload, select Continue, '
              'assert restored quest progress and exercise movement/combat.'),
    *(journey(*stone) for stone in WAYSTONES),
]
