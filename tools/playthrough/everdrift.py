"""Everdrift's real title, castle, and painting UI (Godot canvas, 1280x720).

Inventory: New Game opens Everdrift Valley; Continue returns to the castle
grounds. The castle contains Drift Isles and the two-star East Hall leading
to Gale Gorge. Each painting offers three sequentially unlocked missions.
The valley's three stars are objectives in one open world, not menu modes.
Settings/How to Play are overlays. There are no vehicles or online modes.

Evidence: extracted scripts game/{valley,level,areas/castle_interior,
areas/gale_gorge,shell/progress,shell/star_select,shell/controls_guide}.gdc.
Their token/string tables and the live UI agree about the six missions.
features.gdc enables GALE_GORGE/GORGE_M3 but disables SKY_KEEP_ROOM;
the sealed Sky Keep and unfinished paintings are not invented playable areas.

Uncleared progression gates deliberately fail entry rather than certifying
the wrong mission. No demo flags, saved-star injection, engine calls, or
pointer-lock shim are used. Menu synchronization uses locally installed Tesseract; navigation was
checked visually against PNGs. All input is ordinary Playwright keyboard/mouse
input. Each fresh context earns its own prerequisite stars; game STAR GET
events, not HUD guesses, certify awards. Per-mode entry budgets include the
fresh-context prerequisite routes as well as navigation.
"""

import asyncio
import io
import time
from pathlib import Path

from playthrough import Mode

SERVE = ['everdrift']
URL = 'http://127.0.0.1:8094/index.html'


async def _text(page):
    png = await page.screenshot()
    process = await asyncio.create_subprocess_exec(
        'tesseract', 'stdin', 'stdout', '--psm', '11',
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL)
    try:
        stdout, _ = await asyncio.wait_for(process.communicate(png), 5)
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
    if process.returncode:
        raise RuntimeError('Local Tesseract failed to read the Godot canvas')
    return ' '.join(stdout.decode().split())


async def _wait_text(page, text, timeout=25):
    deadline = time.monotonic() + timeout
    seen = ''
    while time.monotonic() < deadline:
        seen = await _text(page)
        if text.casefold() in seen.casefold():
            return seen
        await asyncio.sleep(.35)
    raise RuntimeError(f'Expected canvas text {text!r}; observed {seen!r}')


async def _wait_hud(page):
    from PIL import Image

    # The gold coin in the top-left is present in play, absent from the
    # letter/title/loading screen. OCR of the small bottom hint is unreliable.
    for _ in range(30):
        with Image.open(io.BytesIO(await page.screenshot())) as image:
            pixels = image.convert('RGB').crop((25, 15, 85, 90)).getdata()
            if sum(r > 180 and g > 125 and b < 130 for r, g, b in pixels) > 150:
                await asyncio.sleep(.6)
                return
        await asyncio.sleep(.2)
    raise RuntimeError('Gameplay coin HUD did not appear after the menu/dialogue')


async def _hold(page, keys, seconds):
    keys = keys.split('+')
    try:
        for key in keys:
            await page.keyboard.down(key)
        await asyncio.sleep(seconds)
    finally:
        for key in reversed(keys):
            await page.keyboard.up(key)


async def _tap(page, key):
    # Godot polls action edges: a zero-duration press can vanish between frames.
    await page.keyboard.press(key, delay=120)
    await asyncio.sleep(.12)


async def _logs(page):
    if not hasattr(page, '_everdrift_logs'):
        page._everdrift_logs = []
        page.on('console', lambda message: page._everdrift_logs.append(message.text))
    return page._everdrift_logs


async def _wait_log(page, text, start=0, timeout=25):
    log = await _logs(page)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if any(text in line for line in log[start:]):
            return
        await asyncio.sleep(.1)
    raise RuntimeError(f'Game did not report {text!r}; recent log: {log[-6:]}')


async def _dialog(page, letter=False):
    # The opening letter and Wisp use different panel positions.
    for _ in range(10):
        await page.mouse.click(1000, 450 if letter else 580)
        await asyncio.sleep(.35)


async def new_game(page):
    await _logs(page)
    await _wait_text(page, 'New Game', timeout=70)
    await page.mouse.click(260, 414)
    await _wait_text(page, 'Dear Monk')
    await _dialog(page, letter=True)
    await _wait_hud(page)


async def continue_game(page, create_save=True):
    # Returning through the title preserves legitimately collected stars.
    if create_save:
        await new_game(page)
    await _tap(page, 'p')
    await _wait_text(page, 'Title Screen')
    start = len(await _logs(page))
    await page.mouse.click(850, 480)
    # The title becomes visible before the fade releases input. Waiting for
    # its transition event avoids losing the Continue click during that fade.
    await _wait_log(page, '[shell] transition fade', start)
    await _wait_text(page, 'New Game')
    start = len(await _logs(page))
    await page.mouse.click(260, 336)
    await _wait_log(page, 'continue -> overworld @ castle_gate', start)
    await _wait_hud(page)
    await asyncio.sleep(.5)


async def castle(page, create_save=True, greeting=None):
    await continue_game(page, create_save=create_save)
    start = len(await _logs(page))
    # Continue faces out of the castle. Back up into its real entrance.
    await _hold(page, 's', 1.35)
    await _wait_log(page, 'transition iris overworld -> castle', start)
    if greeting is None:
        greeting = create_save
    if greeting:
        await _wait_text(page, 'Wisp')
        await _dialog(page)
    await asyncio.sleep(.4)


async def _drift_select(page, create_save=True):
    await castle(page, create_save=create_save, greeting=True)
    start = len(await _logs(page))
    # Walk around the foyer brazier and jump into the west-wall painting.
    await _hold(page, 'w', 1.3)
    await _hold(page, 'a', 1.2)
    await _hold(page, 'w', 1.5)
    await _hold(page, 'w+Space', .5)
    await asyncio.sleep(.8)
    await _hold(page, 'd', .9)
    await _hold(page, 'w+Space', .5)
    await _wait_log(page, 'painting drift -> drift_isles', start, timeout=8)
    # Painting entry is logged before its iris finishes. The selector title
    # is not OCR-safe over the animated panorama; exact mission logs below
    # verify selection after this observed transition duration.
    await asyncio.sleep(1.8)


async def _evidence(page, label):
    directory = getattr(page, '_playthrough_directory',
                        Path(__file__).resolve().parents[2] / 'output/playthrough/everdrift')
    directory.mkdir(parents=True, exist_ok=True)
    page._everdrift_stage = label
    name = getattr(page, '_everdrift_mission', 'exploration')
    await page.screenshot(path=str(directory / f'{name}-{label}.png'))


async def _select_mission(page, area, index):
    # A mouse choice is enough. Mixing it with ArrowRight skips a mission once
    # that mission is unlocked. The game's event verifies the actual choice.
    page._everdrift_stage = f'selecting {area} mission {index}'
    await page.mouse.click((490, 640, 790)[index], 310)
    start = len(await _logs(page))
    await _tap(page, 'Space')
    await _wait_log(page, f'star select {area} -> mission {index}', start, timeout=4)
    await _wait_log(page, f'transition painting castle -> {area}', start)
    await asyncio.sleep(.8)


async def _toybox_star(page):
    start = len(await _logs(page))
    # Spring, hub rim, first stepping stone, then double-jump to the flag.
    await _hold(page, 'w', 2)
    await asyncio.sleep(.8)
    await _hold(page, 'd', 1)
    await _hold(page, 'w', 1.1)
    await _tap(page, 'e')
    await asyncio.sleep(.4)
    await _hold(page, 'w', .35)
    await _hold(page, 'w+d+Space', .2)
    await _hold(page, 'w+Space', .4)
    await asyncio.sleep(1)
    await _hold(page, 'w+Space', .5)
    await asyncio.sleep(.1)
    await _hold(page, 'w+Space', .55)
    await asyncio.sleep(.9)
    await _evidence(page, 'toybox-checkpoint')
    # An ordinary long-jump fall returns to the earned checkpoint with a
    # repeatable position and camera. No teleport or save manipulation.
    await _hold(page, 'w', .45)
    await page.keyboard.down('c')
    try:
        await _hold(page, 'Space', .4)
    finally:
        await page.keyboard.up('c')
    await _hold(page, 'w+Space', .45)
    await asyncio.sleep(2.5)
    for _ in range(4):
        await _tap(page, 'q')
    await asyncio.sleep(.4)
    await _hold(page, 'w+d', .16)
    await _hold(page, 'w+Space', .4)
    await asyncio.sleep(.12)
    await _hold(page, 'w+Space', .35)
    await asyncio.sleep(.8)
    await _evidence(page, 'toybox-blue-block')
    for _ in range(2):
        await _tap(page, 'e')
    await asyncio.sleep(.4)
    await _hold(page, 'w+Space', .48)
    await asyncio.sleep(.65)
    await _tap(page, 'e')
    await asyncio.sleep(.4)
    await _hold(page, 'w+Space', .5)
    await asyncio.sleep(.7)
    await _evidence(page, 'toybox-star')
    try:
        await _wait_log(page, 'STAR GET drift_1', start, timeout=1)
    except RuntimeError as error:
        raise RuntimeError('Unlock failed: Toy Box stepping-stone crossing / '
                           'blue-yellow-pink block climb did not earn drift_1. '
                           'See toybox-checkpoint, toybox-blue-block and '
                           'toybox-star PNGs; dependent mission NOT entered.') from error
    await _wait_log(page, 'transition painting drift_isles -> castle', start)


async def _reenter_drift(page, index):
    start = len(await _logs(page))
    await _hold(page, 'w', .6)
    for _ in range(4):
        await _tap(page, 'q')
    await asyncio.sleep(.5)
    await _hold(page, 'w+a+Space', .55)
    await _wait_log(page, 'painting drift -> drift_isles', start, timeout=4)
    await asyncio.sleep(1.8)
    await _evidence(page, f'drift-selector-{index}')
    await _select_mission(page, 'drift_isles', index)


async def _windmill_star(page):
    start = len(await _logs(page))
    # Board the purple shuttle, ride it up, then jump onto the stopped wheel.
    await _hold(page, 'd', .6)
    await _hold(page, 'w', .65)
    await asyncio.sleep(.3)
    await _hold(page, 'w', .3)
    await asyncio.sleep(2.5)
    for _ in range(2):
        await _tap(page, 'e')
    await asyncio.sleep(.35)
    await _hold(page, 'w+Space', .7)
    await asyncio.sleep(.6)
    await _tap(page, 'q')
    await asyncio.sleep(.35)
    await _hold(page, 'w', .45)
    await _hold(page, 'w+Space', .55)
    await asyncio.sleep(.7)
    await _hold(page, 'a+Space', .27)
    await _hold(page, 'w', .16)
    await asyncio.sleep(.65)
    await _evidence(page, 'windmill-plank')
    await _tap(page, 'l')
    await asyncio.sleep(6.1)
    await _evidence(page, 'windmill-wheel-top')
    await _hold(page, 'w+Space', .55)
    await asyncio.sleep(.6)
    await _evidence(page, 'windmill-star')
    try:
        await _wait_log(page, 'STAR GET drift_2', start, timeout=1)
    except RuntimeError as error:
        raise RuntimeError('Unlock failed: Windmill shuttle / moving plank '
                           'transfer to the high star deck did not earn drift_2. '
                           'See windmill-plank, windmill-wheel-top and '
                           'windmill-star PNGs; dependent mission NOT entered.') from error
    await _wait_log(page, 'transition painting drift_isles -> castle', start)


async def _earn_drift_stars(page, count):
    page._everdrift_stage = 'New Game / castle / Drift Isles selector'
    await _drift_select(page)
    await _select_mission(page, 'drift_isles', 0)
    await _toybox_star(page)
    if count == 2:
        await _reenter_drift(page, 1)
        await _windmill_star(page)


async def _earn_gorge_stars(page):
    # East Hall counts overworld stars too. The nearby crate star avoids a
    # second painting trip and the Windmill wheel's timed ride.
    page._everdrift_stage = 'New Game / village crate star'
    await new_game(page)
    start = len(await _logs(page))
    await _hold(page, 'w', 4.7)
    await _hold(page, 'w+Space', .45)
    await _hold(page, 'd+Space', .25)
    await asyncio.sleep(.6)
    await _hold(page, 'w+a+Space', .4)
    await _hold(page, 'w+Space', .2)
    await asyncio.sleep(.7)
    await _evidence(page, 'valley-crate-star')
    await _wait_log(page, '[shell] star valley_crates', start, timeout=1)
    await _drift_select(page, create_save=False)
    await _select_mission(page, 'drift_isles', 0)
    await _toybox_star(page)


def _entry_budget(enter, title, enter_seconds):
    async def bounded(page):
        try:
            # Reserve time for navigation and a diagnostic PNG before the
            # runner's per-mode navigation + entry budget cancels us.
            await asyncio.wait_for(enter(page), enter_seconds - 10)
        except asyncio.TimeoutError as error:
            phase = getattr(page, '_everdrift_stage', 'loading')
            awarded = [star for star in ('valley_crates', 'drift_1', 'drift_2', 'gorge_1', 'gorge_2')
                       if any(('STAR GET ' + star in line or
                               '[shell] star ' + star in line)
                              for line in await _logs(page))]
            await _evidence(page, 'entry-budget')
            raise RuntimeError(
                f'{title} NOT entered: fresh-context unlocking exceeded the '
                f'entry budget at {phase}; earned stars: {awarded}. Runner '
                f'allows {enter_seconds:g} s including navigation.') from error
    return bounded


def drift_entry(index, title, enter_seconds):
    async def enter(page):
        page._everdrift_mission = f'drift-{index}'
        if index:
            await _earn_drift_stars(page, index)
            await _reenter_drift(page, index)
        else:
            await _drift_select(page)
            await _select_mission(page, 'drift_isles', 0)
    return _entry_budget(enter, title, enter_seconds)


async def _east_hall(page):
    await castle(page, create_save=False)
    await _hold(page, 'w', 1.1)
    for _ in range(3):
        await _tap(page, 'q')
    await asyncio.sleep(.4)
    await _hold(page, 'w', 3.8)
    await asyncio.sleep(.5)


def gorge_entry(index, title, enter_seconds):
    async def enter(page):
        page._everdrift_mission = f'gorge-{index}'
        await _earn_gorge_stars(page)
        await _east_hall(page)
        start = len(await _logs(page))
        await _hold(page, 'w', 2)
        await _hold(page, 'w+Space', .6)
        await asyncio.sleep(1)
        # The hall approach reaches the painting's side. Back off its frame,
        # face the canvas and jump through its centre.
        await _hold(page, 's', .65)
        await _hold(page, 'a', .65)
        for _ in range(2):
            await _tap(page, 'q')
        await asyncio.sleep(.4)
        await _hold(page, 'w+d+Space', .55)
        await asyncio.sleep(.8)
        await _hold(page, 'w+Space', .4)
        await _wait_log(page, 'painting gorge -> gale_gorge', start, timeout=5)
        await asyncio.sleep(1.8)
        await _evidence(page, 'gorge-selector')
        await _select_mission(page, 'gale_gorge', 0)
        if index:
            # Prerequisite attempts must never certify the requested later
            # mission. Chimney Climb requires alternating wall kicks.
            earned = await _chimney_attempt(page)
            detail = ('Chimney star earned, but the later mission route is '
                      'not verified' if earned else
                      'Chimney star not earned: alternating wall kicks and '
                      'the transfer onto the high star ledge are unreliable')
            raise RuntimeError(f'{title} NOT entered: {detail}. '
                               'See chimney-gap and chimney-attempt PNGs.')
    return _entry_budget(enter, title, enter_seconds)


async def _chimney_attempt(page):
    # Visually reviewed: three double jumps reach the checkpoint and the
    # narrow channel. Wall-kick timing is not yet a reliable star route.
    start = len(await _logs(page))
    await _hold(page, 'w+d', .35)
    await _hold(page, 'w', 1)
    for duration in (.55, .55, .65):
        await _hold(page, 'w+Space', .45)
        await asyncio.sleep(.12)
        await _hold(page, 'w+Space', duration)
        await asyncio.sleep(.7)
    await _tap(page, 'e')
    await asyncio.sleep(.4)
    await _hold(page, 'w', .55)
    await _evidence(page, 'chimney-gap')
    for index in range(6):
        await _hold(page, ('d' if index % 2 == 0 else 'a') + '+Space', .45)
        await asyncio.sleep(.12)
    await asyncio.sleep(.6)
    await page.keyboard.down('a')
    try:
        await _tap(page, 'Space')
        await asyncio.sleep(.2)
        await _tap(page, 'Space')
    finally:
        await page.keyboard.up('a')
    for index in range(8):
        key = 'd' if index % 2 == 0 else 'a'
        await page.keyboard.down(key)
        try:
            await asyncio.sleep(.35)
            await _tap(page, 'Space')
        finally:
            await page.keyboard.up(key)
    await _evidence(page, 'chimney-high-transfer')
    await _hold(page, 'a+Space', .55)
    await asyncio.sleep(.12)
    await _hold(page, 'a+Space', .4)
    await asyncio.sleep(.5)
    await _evidence(page, 'chimney-attempt')
    return any('STAR GET gorge_1' in line for line in (await _logs(page))[start:])


async def play_valley(page, ctl):
    deadline = time.monotonic() + 48
    await _hold(page, 'w', 4.7)
    await _hold(page, 'w+Space', .45)
    await _hold(page, 'd+Space', .25)
    await asyncio.sleep(.6)
    while time.monotonic() < deadline:
        await _hold(page, 'w', 1.1)
        await _hold(page, 'Space', .4)
        await asyncio.sleep(.12)
        await _hold(page, 'Space', .4)
        await _tap(page, 'l')
        await _hold(page, 's', .9)
        await _hold(page, 'a', .6)
        await _hold(page, 'd', .6)
        await _hold(page, 'c', .6)
        await asyncio.sleep(.4)
        await _tap(page, 'Shift')
        await _tap(page, 'q')
        await _tap(page, 'e')


async def play_grounds(page, ctl):
    deadline = time.monotonic() + 35
    # Wisp's courtyard conversation is reached by movement, then dismissed.
    await _hold(page, 'w', .5)
    await _dialog(page)
    while time.monotonic() < deadline:
        await _hold(page, 'd', .7)
        await _hold(page, 'Space', .45)
        await _tap(page, 'l')
        await _hold(page, 'a', .7)
        await _hold(page, 'w+Space', .4)
        await _hold(page, 's', .4)
        await asyncio.sleep(.6)
        await _tap(page, 'q')
        await _tap(page, 'e')


async def play_castle(page, ctl):
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        await _hold(page, 'w', .8)
        await _hold(page, 'Space', .4)
        await _tap(page, 'l')
        await _hold(page, 's', .8)
        await _hold(page, 'd', .45)
        await _hold(page, 'a', .45)
        await _tap(page, 'q')
        await _tap(page, 'e')
        await asyncio.sleep(.6)


async def play_course(page, ctl):
    # Spring launch, double jump, dash, gust, crouch charge, and camera input.
    # Short movement legs keep retries active after an ordinary fall/respawn.
    deadline = time.monotonic() + 48
    while time.monotonic() < deadline:
        await _hold(page, 'w', 1.5)
        await _hold(page, 'w+Space', .45)
        await asyncio.sleep(.12)
        await _hold(page, 'w+Space', .5)
        await _tap(page, 'l')
        await _tap(page, 'Shift')
        await _hold(page, 'a', .6)
        await _hold(page, 'c', .7)
        await asyncio.sleep(.6)
        await _hold(page, 'd', .6)
        await _tap(page, 'q')
        await _tap(page, 'e')


MODES = [
    Mode('new-game-valley', new_game, play_valley, seconds=60,
         note='New Game, opening letter, Everdrift Valley; three overworld '
              'star objectives share this world. Does not certify all stars.'),
    Mode('continue-castle-grounds', continue_game, play_grounds, seconds=45,
         note='UI-created local save; Pause > Title Screen > Continue.'),
    Mode('castle-of-four-winds', castle, play_castle, seconds=45,
         note='Real courtyard door and Wisp dialogue; moonlit foyer with '
              'visible geometry. No dark-frame exemption.'),
    *[Mode(name, drift_entry(index, title, budget), play_course, seconds=60,
           enter_seconds=budget,
           note='Castle painting > Drift Isles > ' + title + '. '
                'Fresh-context prerequisite play earns Toy Box, then Windmill '
                'as needed. STAR GET and exact mission events are required.')
      for index, name, title, budget in [
          (0, 'drift-isles-toy-box', 'Top of the Toy Box', 90),
          (1, 'drift-isles-windmill', 'Wake the Windmill', 180),
          (2, 'drift-isles-rail', 'Rail to the Sky', 240)]],
    *[Mode(name, gorge_entry(index, title, budget), play_course, seconds=60,
           enter_seconds=budget,
           note='Gale Gorge: ' + title + '. Enabled in the archived resource '
                'tables. Entry earns the village crate and Toy Box stars, '
                'then crosses East Hall. Later missions require Gorge stars; '
                'failed prerequisites remain issues.')
      for index, name, title, budget in [
          (0, 'gale-gorge-chimney', 'Chimney Climb', 240),
          (1, 'gale-gorge-rail', 'Grind the Gale', 300),
          (2, 'gale-gorge-windmills', 'Three Windmills', 360)]],
]
