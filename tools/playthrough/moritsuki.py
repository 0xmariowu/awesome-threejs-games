"""All normal Moritsuki map destinations, entered through the original UI.

Inventory: town/hud.js NAMED/GAMES, town/travel.js, the five index.html
menus, and their game/player/input modules. The map has two walking sites
and five minigames; it also supports panning, rotation and zoom. There is no
vehicle, difficulty or level selector. Repeated days regenerate the same
minigames. Quest building upgrades are progression, not selectable stages;
the stage picker and planting editor require debug URL flags, not menus.
No online-only gameplay menu exists. Credits are external links, not modes.

Only real keyboard/mouse input changes game state. window.game is read for
telemetry; no debug flags, save injection, renderer patches or lock shim.
The native free-look fallback works in headless Chrome. Black scene checks
exclude HUD areas: changing HUD text must not turn an invisible game green.
"""

import io
import json
import math
import time
from pathlib import Path

from playthrough import Mode

SERVE = ['moritsuki']
URL = 'http://127.0.0.1:8096/moritsuki/index.html'
OUT = Path(__file__).resolve().parents[2] / 'output/playthrough/moritsuki'
PINS = {
    'hamaguri': 'ハマグリ突き', 'gazami': 'ガザミ拾い',
    'kusafugu': 'クサフグ拾い', 'unagi': 'ウナギ掬い', 'mori': 'モリ突き',
}


async def map_ready(page):
    await page.bring_to_front()
    await page.locator('#loading').wait_for(state='hidden')
    await page.locator('#travel.show').wait_for()
    await page.locator('#tv-pins .lb').first.wait_for()


async def select_pin(page, label):
    # The button itself is 0 x 0; its absolutely positioned label is the UI.
    await page.locator('#tv-pins button').filter(has_text=label).locator('.lb').click()


def enter_site(label):
    async def enter(page):
        await map_ready(page)
        await select_pin(page, label)
        await page.wait_for_function('!document.body.classList.contains("sky")')
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(500)
    return enter


def enter_mini(slug):
    async def enter(page):
        await map_ready(page)
        await select_pin(page, PINS[slug])
        await page.locator('#game-card.show').wait_for()
        await page.locator('.gc-go').click()
        await page.wait_for_url('**/' + slug + '/**')
        await page.locator('#title.show [data-act="start"]').click()
        # Centre the mouse while input is disabled, avoiding an accidental
        # camera turn from the title button to the first gameplay click.
        await page.mouse.move(640, 360)
        await page.locator('#intro.show').wait_for()
        await page.keyboard.press('Space')
        await page.wait_for_function('window.game?.mode === "play" && game.input.enabled')
        await page.wait_for_function('Number(getComputedStyle(document.querySelector("#fade")).opacity) < 0.05')
        await page.wait_for_timeout(600)
        await page.locator('#c').click(position={'x': 640, 'y': 360})
        await page.wait_for_function('game.input.locked || game.input.freeLook')
    return enter


async def snapshot(page):
    return await page.evaluate("""() => {
      const g = game, p = g.player;
      return {mode:g.mode, position:p.pos.toArray(), pitch:p.pitch, yaw:p.yaw,
        locked:g.input.locked, freeLook:g.input.freeLook,
        enabled:g.input.enabled, fade:g.post.u.uFade.value,
        stabs:g.stabsToday, hits:g.hits, scoops:g.scoops,
        plunges:g.plunges, grabs:g.grabs, catches:g.catches?.length,
        net:g.net?.state, spear:g.spear?.state, charge:g.spear?.charge,
        depth:p.depth, breath:p.breath, contact:!!g.contact,
        maxDepth:g.maxDepth, bag:g.bag?.length};
    }""")


class Evidence:
    def __init__(self, name):
        self.name = name
        self.started = time.monotonic()
        self.rows = []

    async def record(self, page, event, mini=False):
        row = dict(seconds=round(time.monotonic() - self.started, 2), event=event)
        if mini:
            from PIL import Image
            row.update(await snapshot(page))
            png = await page.screenshot()
            # Two empty-of-HUD scene windows, away from the crosshair and
            # central catch announcements. Night scenes still contain lit
            # terrain here; the broken WaterPass output is exactly black.
            with Image.open(io.BytesIO(png)) as im:
                values = []
                for box in [(160, 180, 480, 500), (800, 180, 1120, 500)]:
                    crop = im.convert('RGB').crop(box)
                    values.append(sum(max(p) <= 2 for p in crop.getdata()) / (320 * 320))
            row['scene_black_fraction'] = min(values)
        else:
            row['body_class'] = await page.locator('body').get_attribute('class')
            row['dialogue'] = await page.locator('#talk').inner_text()
        self.rows.append(row)
        directory = getattr(page, '_playthrough_directory', OUT)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / (self.name + '-input.json')).write_text(
            json.dumps(self.rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return row

    def check(self):
        rows = self.rows
        problems = []
        if max(math.dist(rows[0]['position'], r['position']) for r in rows) < 1:
            problems.append('gameplay input did not move the player by one metre')
        if len(rows) >= 4 and all(r['scene_black_fraction'] > 0.995 for r in rows):
            problems.append('3D scene stayed black after the intro fade and >=30s of gameplay input; '
                            'both HUD-free scene windows were >99.5% black in every sample')
        counter = {'hamaguri': 'stabs', 'gazami': 'plunges',
                   'kusafugu': 'grabs', 'unagi': 'scoops'}.get(self.name)
        if counter and max(r.get(counter) or 0 for r in rows) < 2:
            problems.append('fewer than two registered ' + counter)
        if self.name == 'mori' and not any(r.get('spear') == 'charging' for r in rows):
            problems.append('no underwater spear charge registered')
        if problems:
            raise RuntimeError('; '.join(problems))


async def play_map(page, ctl):
    evidence = Evidence('town-map')
    await evidence.record(page, 'map-entry')
    while time.monotonic() - evidence.started < 31:
        for key in ('a', 'd', 'w', 's', 'q', 'e'):
            await ctl.hold(key, 3)
            await evidence.record(page, 'map-' + key)
            if time.monotonic() - evidence.started >= 31:
                return
        await page.mouse.wheel(0, -240)
        await ctl.drag(120, 30, 2)
        await page.mouse.wheel(0, 240)


def play_site(name):
    async def play(page, ctl):
        evidence = Evidence(name)
        await evidence.record(page, 'walking-entry')
        # Arrival faces the building/NPC. Approach in small physical steps
        # until the game's own E prompt appears, then follow its dialogue.
        for _ in range(8):
            if await page.locator('#talk-prompt.show').count():
                break
            await ctl.hold('w', 0.22)
        if await page.locator('#talk-prompt.show').count():
            await ctl.tap('e')
            await page.locator('#talk.show').wait_for()
            await evidence.record(page, 'npc-conversation')
            for _ in range(24):
                if not await page.locator('#talk.show').count():
                    break
                await ctl.wait(0.55)
                await ctl.tap('e')
            await evidence.record(page, 'conversation-progress')
        # Walk around each actual destination, jump, and rotate the camera.
        while time.monotonic() - evidence.started < 50:
            if await page.locator('#talk.show').count():
                await ctl.tap('e')
                await ctl.wait(0.6)
                continue
            for key in ('s', 'd', 'w', 'a'):
                await page.keyboard.down(key)
                try:
                    await ctl.tap('Space')
                    await ctl.wait(2)
                finally:
                    await page.keyboard.up(key)
                await evidence.record(page, 'walk-' + key)
                if time.monotonic() - evidence.started >= 50:
                    return
            await ctl.hold('q', 0.35)
    return play


async def point_down(page, pitch):
    # Read the camera; apply its documented mouse sensitivity through real
    # mouse movement. No assignments to the player or Input object.
    s = await page.evaluate('({pitch:game.player.pitch, y:game.input.cursor.y * innerHeight, '
                            'x:game.input.cursor.x * innerWidth, sens:game.player.sens})')
    y = max(80, min(630, s['y'] + (s['pitch'] - pitch) / (0.0022 * s['sens'])))
    await page.mouse.move(s['x'], y, steps=8)


def play_mini(slug, duration):
    async def play(page, ctl):
        evidence = Evidence(slug)
        await evidence.record(page, 'input-start', mini=True)
        # Allow a complete final input cycle and validation before the runner
        # cancels play(). Even the shortest mode receives over 30s of input.
        end = time.monotonic() + duration - 12
        cycle = 0
        try:
            while time.monotonic() < end:
                if slug == 'mori':
                    if cycle % 4 == 0:
                        await ctl.hold('q', 2)
                        await ctl.wait(2)
                        await ctl.hold('c', 2)
                    # Patrol the reef instead of swimming north onto the
                    # island, where the spear correctly cannot be charged.
                    await ctl.hold('w' if cycle % 4 < 2 else 's', 1.8)
                    await page.mouse.down()
                    await ctl.wait(1.2)
                    await evidence.record(page, 'underwater-spear-charge', mini=True)
                    await page.mouse.up()
                    await ctl.wait(0.7)
                    await ctl.tap('e')
                    await ctl.hold('d' if cycle % 2 else 'a', 0.8)
                elif slug == 'unagi':
                    await ctl.hold('w', 2.5)
                    await page.mouse.down()
                    await ctl.wait(0.7)
                    y = await page.evaluate('game.input.cursor.y * innerHeight')
                    await page.mouse.move(730, y, steps=24)
                    await ctl.wait(0.5)
                    await page.mouse.move(550, y, steps=36)
                    await evidence.record(page, 'net-sweep', mini=True)
                    await page.mouse.up()
                    await ctl.wait(0.8)
                    if await page.evaluate('game.mode === "show"'):
                        await page.mouse.click(550, y)
                    await page.mouse.move(640, y, steps=18)
                else:
                    await point_down(page, -1.05)
                    await ctl.hold('w' if cycle < 2 else ('a' if cycle % 2 else 'd'), 1.5)
                    if slug in ('hamaguri', 'gazami'):
                        await page.mouse.down()
                        await ctl.wait(2)
                        if slug == 'gazami':
                            await ctl.tap('Space')
                        await page.mouse.up()
                    else:
                        await page.mouse.down(button='right')
                        await ctl.wait(0.6)
                        await ctl.tap('Space')
                        await page.mouse.up(button='right')
                        await ctl.wait(1.4)
                    if slug == 'hamaguri' and await page.evaluate('!!game.contact'):
                        await ctl.tap('e')
                        for _ in range(5):
                            await ctl.tap('a')
                            await ctl.wait(0.12)
                            await ctl.tap('d')
                            await ctl.wait(0.12)
                        await page.mouse.click(640, 500)
                        await ctl.tap('e')
                    await ctl.wait(0.8)
                await evidence.record(page, 'cycle-' + str(cycle), mini=True)
                cycle += 1
            evidence.check()
        finally:
            await page.mouse.up()
            await page.mouse.up(button='right')
    return play


MODES = [
    Mode('town-map', map_ready, play_map, seconds=35,
         note='Original aerial travel scene: pan, rotate, drag and zoom; all seven destination pins.'),
    Mode('town-minato', enter_site('定食 みなと'), play_site('town-minato'), seconds=55,
         note='Restaurant map pin; walk/jump around Minato and approach Natsumi for quest dialogue.'),
    Mode('town-lab', enter_site('水産研究所'), play_site('town-lab'), seconds=55,
         note='Research lab map pin; walk/jump around the lab and speak to Dr Isogai. Story is unfinished upstream.'),
]
for _slug, _seconds, _note in [
    ('hamaguri', 45, 'South beach: walk, probe sand and attempt digging on contact. Known black scene is attempted, not excused.'),
    ('gazami', 45, 'Inner beach: crouch, stroke sand and plunge for crabs. Night setting should still show lit hands/terrain.'),
    ('kusafugu', 45, 'Outer beach: walk, crouch and grab pufferfish. Night setting does not explain a completely black scene.'),
    ('unagi', 90, 'Night ditch: walk upstream, lower/sweep/lift the net and store any catch; headlamp-lit terrain must remain visible.'),
    ('mori', 75, 'Island: swim, dive, charge/release the spear, try E gathering and surface for air; original town-linked game.'),
]:
    MODES.append(Mode(_slug, enter_mini(_slug), play_mini(_slug, _seconds),
                      seconds=_seconds, note=_note))
