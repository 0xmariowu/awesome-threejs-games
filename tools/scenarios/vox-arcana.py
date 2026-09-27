"""A 75-second offline spellcraft and Apprentice duel gameplay trailer.

Entry and target-relative aiming follow tools/playthrough/vox-arcana.py.
The original pointer-lock shim supplies headless mouse input; no combat state,
spell parameters, health, mana, or game assets are changed. The unused backend
and microphone status widgets are hidden for this offline gameplay capture.
"""

import asyncio
import math
import time

from playthrough import POINTER_LOCK_SCRIPT
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from record import Shot


async def encounter(page):
    # A round can end between any two inputs. Never assume either actor exists.
    return await page.evaluate('''() => {
        const g = window.game, p = g?.player;
        const b = g?.bots?.find(bot => bot.alive);
        return {
            mode: g?.mode, pos: p?.pos.toArray(), yaw: p?.yaw,
            pitch: p?.pitch, target: b?.pos.toArray(),
            sensitivity: g?.settings.sens, alive: !!p?.alive,
            paused: !!g?.paused, typing: !!g?.typing,
            locked: document.pointerLockElement === document.querySelector('#c')
        };
    }''')


async def enter_encounter(page, mode):
    # Original menu actions in one browser task keep the cut free of menus.
    await page.evaluate('''mode => {
        document.querySelector('#pause [data-action="quit"]').click();
        document.querySelector(`#menu [data-action="${mode}"]`).click();
        if (mode === 'duel')
            document.querySelector('[data-action="begin-duel"]').click();
    }''', mode)


async def ready(page, mode, timeout=12):
    """Allow natural respawns, then recover a stalled encounter via its menus.

    Recording callers get a best-effort result, never a readiness exception.
    Keep casting while waiting if the player can still act without a target.
    """
    began = time.monotonic()
    restarted = False
    next_cast = began
    while time.monotonic() - began < timeout:
        state = await encounter(page)
        if state['mode'] != mode:
            if not restarted:
                await enter_encounter(page, mode)
                restarted = True
        elif state['paused'] or not state['locked']:
            await page.evaluate('''() =>
                document.querySelector('#pause [data-action="resume"]').click()
            ''')
        elif state['alive'] and state['target']:
            return True
        elif not restarted and time.monotonic() - began > 10:
            # Normal duel rounds respawn after 4.5s; allow ample load slack.
            await enter_encounter(page, mode)
            restarted = True
        if state['alive'] and time.monotonic() >= next_cast:
            await cast(page, 'homing fire ball')
            next_cast = time.monotonic() + 2
        await asyncio.sleep(.25)
    return False


async def hold(page, key, seconds):
    await page.keyboard.down(key)
    try:
        await asyncio.sleep(seconds)
    finally:
        await page.keyboard.up(key)


async def aim(page, seconds=.8):
    # Read-only target telemetry, as in the verified playthrough. Actual mouse
    # motion is spread over time instead of snapping to the target in one frame.
    state = await encounter(page)
    if (not state['alive'] or not state['target'] or state['paused']
            or not state['locked']):
        await asyncio.sleep(seconds)
        return None
    p, b = state['pos'], state['target']
    dx, dz = b[0] - p[0], b[2] - p[2]
    yaw = math.atan2(-dx, -dz)
    delta = math.atan2(math.sin(yaw - state['yaw']),
                       math.cos(yaw - state['yaw']))
    pitch = math.atan2(b[1] + 1 - (p[1] + 1.65), math.hypot(dx, dz))
    sensitivity = .0022 * state['sensitivity']
    x, y = page._vox_cursor
    # A respawn can put the rival behind us. A partial turn is still useful;
    # reaching the shim's edge must not abort an otherwise usable recording.
    end_x = max(30, min(1250, x - delta / sensitivity))
    end_y = max(30, min(690, y - (pitch - state['pitch']) / sensitivity))
    start = time.monotonic()
    steps = max(2, round(seconds * 30))
    for i in range(1, steps + 1):
        # Smoothstep eases both ends of each small camera turn.
        t = i / steps
        eased = t * t * (3 - 2 * t)
        await page.mouse.move(x + (end_x - x) * eased, y + (end_y - y) * eased)
        await asyncio.sleep(max(0, start + seconds * t - time.monotonic()))
    page._vox_cursor = [end_x, end_y]
    return math.hypot(dx, dz)


async def cast(page, spell):
    state = await encounter(page)
    if state['mode'] not in ('practice', 'duel') or state['paused']:
        return
    try:
        if not state['typing']:
            await page.keyboard.press('Enter')
        await page.locator('#type-input').fill(spell, timeout=3000)
        await page.keyboard.press('Enter')
    except PlaywrightTimeoutError:
        # A menu/round change may hide the input between Enter and fill.
        # Abandon this cast and let the next cycle recover the encounter.
        pass
    finally:
        if (await encounter(page))['typing']:
            await page.keyboard.press('Escape')


async def cross_dais(page, destination, seconds):
    # Read-only navigation telemetry; choose ordinary WASD input toward a
    # point on the unobstructed rune dais, never teleport or steer the AI.
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        state = await encounter(page)
        if not state['pos'] or not state['alive'] or state['paused']:
            await asyncio.sleep(min(.25, max(0, end - time.monotonic())))
            continue
        x, _, z = state['pos']
        dx, dz = destination[0] - x, destination[1] - z
        yaw = state['yaw']
        forward = -math.sin(yaw) * dx - math.cos(yaw) * dz
        right = math.cos(yaw) * dx - math.sin(yaw) * dz
        key = ('w' if forward > 0 else 's') if abs(forward) > abs(right) else (
            'd' if right > 0 else 'a')
        moving = math.hypot(dx, dz) > 1.5
        if moving:
            await page.keyboard.down(key)
        try:
            await aim(page, min(.65, max(.1, end - time.monotonic())))
        finally:
            if moving:
                await page.keyboard.up(key)


async def prepare(page):
    # Minimal copy of the verified offline entry; all menus precede recording.
    page.set_default_timeout(60000)
    await page.locator('#loading').wait_for(state='hidden')
    await page.locator('#menu [data-action="settings"]').click()
    await page.locator('#settings .settings-advanced summary').click()
    for selector in ('#set-jev', '#set-botjev', '#set-botvoice'):
        await page.locator(selector).uncheck()
    # The original sensitivity slider gives the pointer-lock shim enough
    # viewport travel to follow a moving rival without clipping or recentering.
    await page.locator('#set-sens').focus()
    await page.keyboard.press('End')
    await page.locator('#settings [data-action="quit"]').click()
    await page.locator('#menu [data-action="duel"]').click()
    await page.locator('#set-diff').select_option('easy')
    await page.locator('#duel-setup [data-back]').click()
    # Track the menu click's actual pointer position; recentering after lock
    # would turn the camera before the first deliberate aiming motion.
    button = page.locator('#menu [data-action="practice"]')
    box = await button.bounding_box()
    page._vox_cursor = [box['x'] + box['width'] / 2,
                        box['y'] + box['height'] / 2]
    await button.click()
    await page.wait_for_function('''() => game.mode === 'practice' &&
        game.player.alive && !game.paused && !game.settings.useJev &&
        !game.settings.botJev && document.pointerLockElement ===
        document.querySelector('#c')''', timeout=90000)
    if not await ready(page, 'practice', timeout=60):
        raise RuntimeError('Practice did not become ready before recording')
    await asyncio.sleep(2.8)
    await page.add_style_tag(content='''
        #jev-status, #chant-hint, #voice-wave { display: none !important; }
    ''')
    await aim(page)
    await hold(page, 'w', 2.6)
    await aim(page)
    await asyncio.sleep(.5)


async def play_overview(page):
    # 0-24s: water/ice reactions, a tornado, then a meteor. Long strafes
    # reveal the landscape while eased turns keep the golem in view.
    began = time.monotonic()
    for index, spell in enumerate(('homing water ball', 'homing ice ball',
                                   'wind tornado', 'fire meteor')):
        await ready(page, 'practice')
        await cast(page, spell)
        await asyncio.sleep(1.2)
        await page.keyboard.down('a' if index % 2 == 0 else 'd')
        try:
            for _ in range(3):
                await aim(page, .65)
        finally:
            await page.keyboard.up('a' if index % 2 == 0 else 'd')
        await aim(page)
        await asyncio.sleep(max(0, began + (index + 1) * 6 - time.monotonic()))

    # Use the original menu buttons in one browser task for a clean cut:
    # no menu/loading frames, debug startMode call, or combat-state edits.
    # Difficulty and offline settings were already selected in prepare().
    await enter_encounter(page, 'duel')
    await ready(page, 'duel', timeout=20)
    await hold(page, 'w', 2.8)
    await aim(page)

    # 28-75s: a real, moving Apprentice rival. Alternate sustained lateral
    # movement, defensive magic and homing attacks; track with eased mouse
    # input instead of snapping. All damage, mana and AI remain original.
    duel_began = time.monotonic()
    for index, spell in enumerate(('fire shield', 'homing water ball',
                                   'homing ice ball', 'light heal',
                                   'lightning chain', 'fire shield',
                                   'homing fire ball', 'light heal',
                                   'arcane barrage')):
        await ready(page, 'duel')
        await aim(page, .55)
        await cast(page, spell)
        destination = ((-6, 4), (5, 3), (5, -5), (-5, -5))[index % 4]
        await cross_dais(page, destination, 3.3)
        await page.mouse.down()
        try:
            await aim(page, .45)
        finally:
            await page.mouse.up()
        await asyncio.sleep(max(0, duel_began + (index + 1) * 5.25 - time.monotonic()))


async def overview(page, _cue):
    # Recovery shares the shot's budget instead of adding unbounded waits.
    try:
        await asyncio.wait_for(play_overview(page), timeout=85)
    except asyncio.TimeoutError:
        pass
    finally:
        for key in ('w', 'a', 's', 'd'):
            await page.keyboard.up(key)
        await page.mouse.up()
        if (await encounter(page))['typing']:
            await page.keyboard.press('Escape')


SHOTS = {
    'overview': Shot(
        url='http://127.0.0.1:8091/index.html', module=None,
        serve=['vox-arcana'], prepare=prepare, run=overview,
        init_script=POINTER_LOCK_SCRIPT, scale=1,
        poster_at=14, preview_at=12, overlay=False, min_fps=45,
    ),
}
