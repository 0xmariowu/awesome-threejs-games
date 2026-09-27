"""Exercise every arena choice using the original menus and local spell parser.

Inventory: public/index.html and js/main.js expose Practice and Duel, with
easy/normal/hard rivals (js/bot.js). There are no further maps, vehicles,
campaign levels or minigames. Grimoire lists spells, not additional scenes.
Model and microphone options are recorded separately as unavailable features.

Only read-only game telemetry is evaluated. Movement, aiming, casting and
settings use browser input. Headless Chrome rejects native pointer lock here;
the runner's labelled shim enables mouse input without changing game state.
"""

import json
import math
import time
from pathlib import Path

from playthrough import Mode

SERVE = ['vox-arcana']
URL = 'http://127.0.0.1:8091/index.html'
OUT = Path(__file__).resolve().parents[2] / 'output/playthrough/vox-arcana'

STATE = """() => {
 const g = window.game, p = g.player, b = g.bots[0];
 return {mode:g.mode, difficulty:g.settings.diff, paused:g.paused,
   pointer_locked:document.pointerLockElement === document.querySelector('#c'),
   use_model:g.settings.useJev, rival_model:g.settings.botJev,
   pos:p.pos.toArray(), yaw:p.yaw, pitch:p.pitch, hp:p.hp, mana:p.mana,
   stamina:p.stamina, alive:p.alive, kills:p.kills, deaths:p.deaths,
   last_element:g.lastEl, score:{...g.score},
   enemy:{name:b.name, pos:b.pos.toArray(), hp:b.hp, alive:b.alive},
   spells:g.spells.active.map(s => ({caster:s.caster.id,
     element:s.spec.element, shape:s.spec.shape, basic:!!s.spec.basic})),
   feed:document.querySelector('#feed')?.textContent || '',
   microphone:document.querySelector('#menu-mic-message').textContent,
   offline_voice:document.querySelector('#voice-download-status').textContent};
}"""


def entry(mode, difficulty='normal'):
    async def enter(page):
        await page.locator('#loading').wait_for(state='hidden')
        await page.locator('#menu [data-action="settings"]').click()
        await page.locator('#settings .settings-advanced summary').click()
        await page.locator('#set-jev').uncheck()
        await page.locator('#set-botjev').uncheck()
        # Browser speech synthesis can use an OS/network voice. Keep combat
        # local, including the rival's original keyword-based spell generator.
        await page.locator('#set-botvoice').uncheck()
        await page.locator('#settings [data-action="quit"]').click()
        await page.locator('#menu [data-action="' + mode + '"]').click()
        if mode == 'duel':
            await page.locator('#set-diff').select_option(difficulty)
            await page.locator('[data-action="begin-duel"]').click()
        await page.wait_for_function(
            "([m,d]) => window.game?.mode === m && game.player?.alive && "
            "!game.paused && !game.settings.useJev && !game.settings.botJev && "
            "(m !== 'duel' || game.settings.diff === d) && "
            "document.pointerLockElement === document.querySelector('#c')",
            arg=[mode, difficulty])
        # Allow entry banners and the automatic, denied microphone request to
        # settle. Do not start recognition or download a voice language pack.
        await page.wait_for_timeout(2800)
    return enter


def gameplay(name, seconds):
    async def play(page, ctl):
        rows = []
        started = time.monotonic()
        cursor = [640.0, 360.0]

        async def observe(event):
            state = await page.evaluate(STATE)
            rows.append(dict(seconds=round(time.monotonic() - started, 3),
                             event=event, **state))
            if state['paused'] or not state['pointer_locked']:
                raise RuntimeError('Gameplay lost focus or pointer lock')
            return state

        async def aim():
            # Read the opponent's position; turn only through real mouse input.
            # Keeping a medium combat distance avoids circling beyond the
            # shim's finite viewport. No debug face/teleport helpers are used.
            state = await page.evaluate(STATE)
            p, b = state['pos'], state['enemy']['pos']
            dx, dz = b[0] - p[0], b[2] - p[2]
            yaw = math.atan2(-dx, -dz)
            delta = math.atan2(math.sin(yaw - state['yaw']),
                               math.cos(yaw - state['yaw']))
            pitch = math.atan2(b[1] + 1.0 - (p[1] + 1.65),
                               max(1, math.hypot(dx, dz)))
            cursor[0] = max(30, min(1250, cursor[0] - delta / 0.0022))
            cursor[1] = max(30, min(690, cursor[1] - (pitch - state['pitch']) / 0.0022))
            await page.mouse.move(*cursor, steps=5)
            await ctl.wait(0.12)
            return math.hypot(dx, dz)

        spells = ('homing fire ball', 'homing water ball', 'homing ice ball',
                  'lightning chain', 'earth spikes', 'fire shield',
                  'homing fire ball', 'light heal')
        try:
            await observe('start')
            await page.mouse.move(*cursor)
            await ctl.wait(0.15)
            await aim()
            await ctl.hold('w', 1.8)
            moved = await observe('approach')
            if math.dist(rows[0]['pos'], moved['pos']) < 2:
                raise RuntimeError('Forward input did not move the player')
            cycle = 0
            # Finish a complete input cycle before the runner's hard cutoff,
            # avoiding cancellation in the middle of a Playwright command.
            while time.monotonic() - started < seconds - 8:
                state = await observe('cycle')
                if not state['alive']:
                    await ctl.wait(0.5)  # Original round/respawn logic owns this.
                    continue
                distance = await aim()
                if distance > 26:
                    await ctl.hold('w', 0.6)
                elif distance < 13:
                    await ctl.hold('s', 0.6)
                await aim()
                spell = spells[cycle % len(spells)]
                await ctl.tap('Enter')
                await page.locator('#type-input').fill(spell)
                await ctl.tap('Enter')
                await ctl.wait(1.25)  # Let typed chanting produce the actual spell.
                await observe('cast: ' + spell)
                await aim()
                await page.mouse.down()
                try:
                    await ctl.wait(0.55)
                finally:
                    await page.mouse.up()
                await observe('mana bolts')
                direction = 'a' if cycle % 2 == 0 else 'd'
                await page.keyboard.down(direction)
                try:
                    if cycle % 4 == 0:
                        await ctl.tap('e')
                    if cycle % 4 == 1:
                        await ctl.hold('Space', 0.7)
                    if cycle % 4 == 2:
                        await ctl.hold('Shift', 0.7)
                    await ctl.wait(0.7)
                finally:
                    await page.keyboard.up(direction)
                await aim()
                await ctl.wait(1.2)  # Mana regeneration while the projectile lands.
                await observe('after attack')
                cycle += 1
            await observe('finished input')
        finally:
            # Preserve evidence on normal completion and on runner cancellation.
            directory = getattr(page, '_playthrough_directory', OUT)
            directory.mkdir(parents=True, exist_ok=True)
            (directory / (name + '-telemetry.json')).write_text(
                json.dumps(rows, indent=2) + '\n', encoding='utf-8')
    return play


async def unavailable(page, ctl=None):
    raise RuntimeError('Unreachable features must be skipped by the runner')


LOCAL_NOTE = (
    'Original local keyword parser selected through Settings; rival model and '
    'spoken rival voice disabled. WASD, mouse aim/bolts, Enter spell casting, '
    'dash, jump/glide and sprint. Pointer-lock shim required by headless Chrome. '
    'Default graphics preserved. The unconditional /api/status 404 remains '
    'visible in runner errors; it does not prevent offline combat. '
    'Supplementary read-only state is in <mode>-telemetry.json.'
)

MODES = [
    Mode('practice', entry('practice'), gameplay('practice', 45), seconds=45,
         pointer_lock_shim=True, note='Training Grounds and regenerating golem. ' + LOCAL_NOTE),
    *[Mode('duel-' + difficulty, entry('duel', difficulty),
           gameplay('duel-' + difficulty, 60), seconds=60, pointer_lock_shim=True,
           note=label + '; original best-of-three rounds and automatic rematch. ' + LOCAL_NOTE)
      for difficulty, label in [('easy', 'Apprentice'), ('normal', 'Archmage'),
                                ('hard', 'Sage of Ruin')]],
    Mode('jev-spells', unavailable, unavailable, reachable=False,
         unreachable_reason='Settings > Jev (API) requires the unarchived server: '
         'GET /api/status returns 404 and POST /api/spell returns 405 locally. '
         'UI casting was attempted and displayed "Spell service error". '
         'Practice and all three Duel modes above use the offline keyword fallback.'),
    Mode('local-minilm', unavailable, unavailable, reachable=False,
         unreachable_reason='Settings > Local MiniLM is a server-backed model, '
         'not browser inference. The UI load button was attempted: '
         'POST /api/local/load returns 405; GET /api/status returns 404. '
         'No backend/model files are archived; no model download was attempted.'),
    Mode('rival-model', unavailable, unavailable, reachable=False,
         unreachable_reason='Settings > Rival uses selected model calls the same '
         'missing /api/spell endpoint through bot.js. Neither Jev nor MiniLM '
         'inference is archived. All Duel difficulties above exercise the '
         'original offline rival with this option disabled.'),
    Mode('voice-casting', unavailable, unavailable, reachable=False,
         unreachable_reason='Microphone entry reports "Microphone blocked. Enter '
         'to type incantations" in this headless environment. Default Web Speech '
         'recognition is not certified offline; the browser offers to download '
         'the selected offline language pack, which is not installed or archived. No recognition '
         'service or download is contacted. Typed casting is exercised above.'),
]
