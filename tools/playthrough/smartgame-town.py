"""UI-only coverage of the archived Smartgame Town client.

The localhost-only __town export is used for observations/navigation feedback,
never to move, grant currency/items, change the clock, or invoke game actions.
All entry, purchases, rewards, interaction and movement use real UI input.
Linked arcade applications are enumerated from the archived game's catalog.
"""
import asyncio
import math
import re
import time
from pathlib import Path

from playthrough import Mode

SERVE = ['smartgame-town']
URL = 'http://127.0.0.1:8093/town/index.html'
ROOT = Path(__file__).resolve().parents[2]
DESTINATIONS = {
    'plaza': '広場', 'gacha': 'ガチャ広場', 'room': 'マイルーム',
    'arcade': 'ゲームセンター', 'livehouse': 'ライブハウス LUMIERE',
    'building': 'スマゲービルディング', 'realestate': 'スマゲ不動産',
    'takamatsu': '高松商店', 'boutique': 'しろくま洋品店',
    'salon': '美容室 ミモザ', 'petshop': 'ペットショップ こむぎ',
    'library': 'こもれび図書館', 'cafe': 'カフェ ひだまり',
    'bar': '月あかりバー', 'toolshop': '道具屋 かわせみ', 'farm': 'スマゲー農場',
}
LOCAL_NOTE = ('Fresh guest; real menu entry and keyboard walking. Missing local PHP '
              'services can produce console errors even while the offline scene plays.')


async def wait_state(page, expression, timeout=5000):
    # Poll with evaluate: wait_for_function's internal eval conflicts with this
    # archive's CSP. No CSP bypass or script injection is needed.
    deadline = time.monotonic() + timeout / 1000
    while time.monotonic() < deadline:
        if await page.evaluate(expression):
            return
        await asyncio.sleep(.1)
    raise RuntimeError('Timed out observing: ' + expression)


async def onboarding(page):
    await page.get_by_text('この見た目でタウンへ！', exact=True).wait_for()
    await page.get_by_text('なまえ', exact=True).click()
    await page.locator('#tw-name').fill('GameRef')
    await page.get_by_text('この見た目でタウンへ！', exact=True).click()
    # Dialog keyboard shortcuts ignore focused buttons; click its actual next button.
    for _ in range(8):
        if await page.get_by_text('うけとる', exact=True).is_visible():
            await page.get_by_text('うけとる', exact=True).click()
            break
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(150)
        if await page.evaluate('Boolean(window.__town && __town.UI.dialogOpen)'):
            await page.locator('.tw-dialog').click()
    await wait_state(page, 'window.__town && !__town.UI.isBusy()')


async def close_panel(page):
    close = page.locator('.tw-panel').get_by_role('button', name='閉じる', exact=True)
    if await close.count():
        await close.first.click()
    elif await page.locator('.tw-panel .tw-x').count():
        await page.locator('.tw-panel .tw-x').click()


async def warp(page, destination):
    await page.get_by_role('button', name='いまいる場所（タップで移動する場所をえらぶ）', exact=True).click()
    await page.get_by_role('button', name=DESTINATIONS[destination] + 'へ移動', exact=True).click()
    expected = 'town' if destination in ('plaza', 'gacha') else destination
    await page.wait_for_timeout(250)
    if destination != 'farm':
        actual = await page.evaluate('__town.area')
        if actual != expected:
            raise RuntimeError(f'{destination} UI did not enter: area={actual}; '
                               + (await page.locator('#ui-root').inner_text())[-1000:])


async def walk(page, x, z, tolerance=.55, timeout=12):
    """Steer camera-relative WASD using read-only position feedback."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        p = await page.evaluate('({x:__town.pos.x,z:__town.pos.z,yaw:__town.cam.yaw})')
        dx, dz = x - p['x'], z - p['z']
        distance = math.hypot(dx, dz)
        if distance < tolerance:
            await page.wait_for_timeout(120)
            return
        right = dx * math.cos(p['yaw']) - dz * math.sin(p['yaw'])
        forward = -dx * math.sin(p['yaw']) - dz * math.cos(p['yaw'])
        keys = []
        if abs(right) > distance * .38:
            keys.append('d' if right > 0 else 'a')
        if abs(forward) > distance * .38:
            keys.append('w' if forward > 0 else 's')
        try:
            for key in keys:
                await page.keyboard.down(key)
            await asyncio.sleep(min(.18, distance * .11))
        finally:
            for key in keys:
                await page.keyboard.up(key)
    raise RuntimeError(f'Walking blocked: target=({x}, {z}), actual={p}')


async def trigger(page, action=None, ident=None, kind=None):
    t = await page.evaluate('''([action,id,kind]) => {
      const t=__town.worlds[__town.area].triggers.find(t =>
        (!action || t.action===action) && (!id || t.id===id) && (!kind || t.kind===kind));
      return t && {x:t.x,z:t.z,r:t.r,label:t.label};
    }''', [action, ident, kind])
    if not t:
        raise RuntimeError(f'No UI trigger: {action}, {ident}, {kind}')
    # Stop on the near edge of NPC interaction radii, outside counters/colliders.
    p = await page.evaluate('({x:__town.pos.x,z:__town.pos.z})')
    dx, dz = p['x'] - t['x'], p['z'] - t['z']
    length = math.hypot(dx, dz) or 1
    radius = t['r'] * (.7 if action in ('npc', 'instrument') or (ident and ident.startswith('instrument:')) else .4)
    await walk(page, t['x'] + dx / length * radius, t['z'] + dz / length * radius,
               tolerance=max(.2, min(.5, t['r'] - radius - .2)))
    prompt = page.locator('.tw-prompt')
    await prompt.filter(has_text=t['label']).click(timeout=3000)


def scene_entry(destination):
    async def enter(page):
        await onboarding(page)
        await warp(page, destination)
    return enter


async def explore(page, ctl):
    """Walk at the native camera angle and assert actual avatar displacement."""
    origin = await page.evaluate('({x:__town.pos.x,z:__town.pos.z})')
    moved = False
    while True:
        for key in ('w', 'd', 's', 'a'):
            await ctl.hold(key, 1.1)
            p = await page.evaluate('({x:__town.pos.x,z:__town.pos.z})')
            moved |= math.hypot(p['x'] - origin['x'], p['z'] - origin['z']) > .5
        if not moved:
            raise RuntimeError('WASD produced no avatar displacement')
        await ctl.wait(.2)


async def enter_avatar(page):
    await page.get_by_text('この見た目でタウンへ！', exact=True).wait_for()


async def play_avatar(page, ctl):
    while True:
        for tab in ('はだ', 'かみ', 'かお', 'ふく', 'もちもの', 'なまえ'):
            await page.get_by_text(tab, exact=True).click()
            if tab == 'なまえ':
                await page.locator('#tw-name').fill('GameRef')
            else:
                await page.get_by_text('🎲 ランダム', exact=True).click()
            await ctl.wait(2)


async def enter_darts(page):
    await scene_entry('bar')(page)
    await walk(page, 3.8, 1.5)
    await page.locator('.tw-prompt').filter(has_text='ダーツを投げる').wait_for()


async def play_darts(page, ctl):
    while True:
        await page.locator('.tw-prompt').filter(has_text='ダーツを投げる').click()
        await ctl.wait(.9)


async def claim_rewards(page):
    await page.get_by_role('button', name='メニュー', exact=True).click()
    await page.get_by_text('ミッション', exact=True).click()
    for tab in ('デイリー', 'ウィークリー', 'マンスリー', '実績'):
        await page.get_by_role('button', name=tab, exact=True).click()
        for _ in range(15):
            button = page.locator('.tw-panel button').filter(has_text='まとめてうけとる')
            if not await button.count():
                button = page.locator('.tw-panel').get_by_role('button', name='うけとる', exact=True)
            if not await button.count():
                break
            await button.first.click()
    await close_panel(page)


async def earn_coins(page):
    # Earn tools from existing offline achievements, without save/state edits.
    for destination in ('cafe', 'salon', 'boutique', 'library', 'petshop', 'bar'):
        await warp(page, destination)
    await walk(page, 3.8, 1.5)
    deadline = time.monotonic() + 65
    while await page.evaluate('__town.app.state.stats.darts') < 30:
        if time.monotonic() > deadline:
            raise RuntimeError('Could not finish the 30-dart tool-funding mission')
        await page.locator('.tw-prompt').filter(has_text='ダーツを投げる').click(force=True)
        await wait_state(page, '!__town.worlds.bar.darts.flying', timeout=5000)
        await page.wait_for_timeout(80)
    await claim_rewards(page)


async def buy_tool(page, item):
    await earn_coins(page)
    await warp(page, 'toolshop')
    await trigger(page, action='tool-shop')
    await page.get_by_role('button', name=re.compile('^' + item + '（')).click()
    await page.get_by_role('button', name=re.compile('で買う$')).click()
    await close_panel(page)
    owned = await page.evaluate('__town.app.state.inv')
    if not owned.get('hand_rod' if item == '釣り竿' else 'hand_net'):
        raise RuntimeError('Tool purchase did not grant ' + item)


async def enter_fishing(page):
    await onboarding(page)
    await buy_tool(page, '釣り竿')
    await warp(page, 'plaza')
    await walk(page, 3, 8)
    await trigger(page, ident='fish:4')
    await wait_state(page, '__town.fishing.on')
    await page.mouse.move(640, 360)
    await page.mouse.down()
    await page.mouse.move(870, 350, steps=20)
    await page.mouse.up()


async def play_fishing(page, ctl):
    while True:
        okay = page.get_by_role('button', name='OK', exact=True)
        if await okay.is_visible():
            await okay.click()
        state = await page.evaluate('({on:__town.fishing.on,phase:__town.fishing.phase})')
        prompt = page.locator('.tw-prompt')
        if state['on'] and state['phase'] == 'bite':
            await prompt.click(force=True)
        elif not state['on'] and await prompt.is_visible():
            if '釣りをする' in await prompt.inner_text():
                await prompt.click(force=True)
        await ctl.wait(.08)


async def enter_bugs(page):
    await onboarding(page)
    await buy_tool(page, '虫取り網')
    await warp(page, 'plaza')


async def play_bugs(page, ctl):
    while True:
        bugs = await page.evaluate('''() => __town.bugs.bugs.filter(b=>b.state==='idle')
          .map(b=>({x:b.x,z:b.z,d:Math.hypot(b.x-__town.pos.x,b.z-__town.pos.z)}))
          .sort((a,b)=>a.d-b.d).slice(0,12)''')
        for bug in bugs:
            okay = page.get_by_role('button', name='OK', exact=True)
            if await okay.is_visible():
                await okay.click()
            try:
                await walk(page, bug['x'], bug['z'], tolerance=1.1, timeout=4)
            except RuntimeError:
                continue  # A wandering insect may be behind a tree/wall.
            prompt = page.locator('.tw-prompt')
            if await prompt.is_visible() and 'つかまえる' in await prompt.inner_text():
                await prompt.click()
                await ctl.wait(.25)
                if await prompt.is_visible() and 'つかまえる' in await prompt.inner_text():
                    await prompt.click()
                await ctl.wait(1.2)
        await ctl.hold('s', .5)


async def enter_pet(page):
    await onboarding(page)
    await earn_coins(page)
    await warp(page, 'petshop')
    await trigger(page, action='npc')
    await page.locator('.tw-dialog').click()
    await page.locator('.tw-item').filter(has_text='ミドリガメ').click()
    await page.locator('#tw-pet-name').fill('River')
    await page.get_by_role('button', name=re.compile('でおむかえする$')).click()
    await page.get_by_role('button', name='🐾 いっしょに歩く', exact=True).click()
    await warp(page, 'plaza')
    await wait_state(page, 'Boolean(__town.follower)')


async def enter_floor(page, roof=False):
    await scene_entry('building')(page)
    await trigger(page, action='building-elevator')
    await page.get_by_role('button', name=re.compile('屋上テラス' if roof else '展望フロア SKY DECK')).click()
    await wait_state(page, '__town.app.onRoof' if roof else '__town.area === "skydeck"')


async def enter_skydeck(page):
    await enter_floor(page)


async def enter_roof(page):
    await enter_floor(page, True)


async def enter_athletic(page):
    await scene_entry('bar')(page)
    await trigger(page, action='exit-shop')
    # Go around the bar and the southwest building, not through their walls.
    for x, z in [(-29, 27), (-44, 27), (-44, 43), (-38.5, 43), (-38.5, 47.6)]:
        await walk(page, x, z, timeout=15)
    await trigger(page, action='athletic-start')


async def play_athletic(page, ctl):
    while True:
        for x, z in [(-45.2, 47.6), (-51.5, 47.6), (-56.4, 47.6),
                     (-56.4, 53.6), (-48.6, 53.6), (-44.85, 55.1)]:
            try:
                await walk(page, x, z, tolerance=.2, timeout=5)
            except RuntimeError:
                break
        await page.get_by_role('button', name='はじめから', exact=True).click()
        await ctl.wait(.3)


def instrument_entry(instrument):
    async def enter(page):
        await scene_entry('cafe')(page)
        await trigger(page, action='exit-shop')
        for x, z in [(29, 16), (29, 28)]:
            await walk(page, x, z)
        await trigger(page, ident='instrument:' + instrument)
        # Look through the open front, underneath the opaque stage roof.
        camera = await page.evaluate('__town.cam')
        delta = (math.pi - camera['yaw'] + math.pi) % (2 * math.pi) - math.pi
        await page.mouse.move(640, 360)
        await page.mouse.down()
        await page.mouse.move(640 - delta / .006, 360 + (.24 - camera['pitch']) / .004, steps=20)
        await page.mouse.up()
        await page.wait_for_timeout(250)
    return enter


async def play_instrument(page, ctl):
    while True:
        await page.locator('.tw-prompt').filter(has_text='演奏する').click()
        await ctl.wait(.7)


def gacha_entry(kind):
    async def enter(page):
        await scene_entry('boutique' if kind == 'hat' else 'arcade' if kind == 'cab' else 'gacha')(page)
        await trigger(page, action='gacha', kind=kind)
    return enter


async def play_gacha(page, ctl):
    # kf() refuses to open without api.php lineups; preserve real attempts.
    for _ in range(10):
        await page.locator('.tw-prompt').filter(has_text='ガチャ').click()
        await ctl.wait(3.1)
    raise RuntimeError('Gacha refused: 現在のラインナップを取得できません; '
                       'api.php lineups service is absent')


async def enter_decorate(page):
    await scene_entry('room')(page)
    await page.get_by_role('button', name='模様替えをする', exact=True).click()


async def play_decorate(page, ctl):
    # Starter furniture is already placed, so its inventory tiles are disabled.
    # Drag the visible table, then use the live surface tabs.
    while True:
        await page.get_by_role('button', name='家具', exact=True).click()
        await page.mouse.click(738, 358)
        rotate = page.get_by_role('button', name='↻ 回転', exact=True)
        if await rotate.is_visible():
            await rotate.click()
        await page.mouse.move(738, 358)
        await page.mouse.down()
        await page.mouse.move(700, 430, steps=20)
        await page.mouse.up()
        await ctl.wait(2)
        for label in ('壁掛け', '筐体', '壁紙', '床'):
            await page.get_by_role('button', name=label, exact=True).click()
            items = page.locator('.tw-item:visible:enabled')
            if await items.count():
                await items.first.click()
            await ctl.wait(2)


async def absent(page):
    raise RuntimeError('This missing archive/service mode must not be executed')


def unavailable(name, reason):
    return Mode(name, absent, absent, reachable=False, unreachable_reason=reason)


MODES = [Mode('avatar-editor', enter_avatar, play_avatar, seconds=35,
              note='Six real avatar tabs, random appearance and nickname input.')]
for destination in DESTINATIONS:
    if destination == 'farm':
        continue
    MODES.append(Mode(destination, scene_entry(destination), explore,
                      seconds=60 if destination in ('plaza', 'arcade') else 35,
                      note=LOCAL_NOTE + (' Takamatsu opens 06:00–23:00 JST; a closed-shop refusal is recorded, never bypassed.' if destination == 'takamatsu' else '')))
MODES += [
    Mode('skydeck', enter_skydeck, explore, seconds=35, note='1F elevator → public 10F observation floor. ' + LOCAL_NOTE),
    Mode('roof', enter_roof, explore, seconds=40, note='1F elevator → RF terrace; remains in town at rooftop elevation. ' + LOCAL_NOTE),
    Mode('room-decoration', enter_decorate, play_decorate, seconds=35, note='Local starter-room furniture, wallpaper and flooring editor.'),
    Mode('bar-darts', enter_darts, play_darts, seconds=40, note='Repeated real throws at the bar throw line; score bubbles and scoreboard. Neon bar is intentionally dim.'),
    Mode('fishing', enter_fishing, play_fishing, seconds=65, note='Earn coins through 30 darts and six shop visits, claim missions, buy rod, walk to river and react to bite prompt.'),
    Mode('bug-catching', enter_bugs, play_bugs, seconds=90, note='Earn coins and buy net through UI; walk to observed insects and swing using catch prompt. Spawns depend on season/time.'),
    Mode('pet-companion', enter_pet, explore, seconds=45, note='Earn local coins, adopt and name a turtle, then walk with the follower. Premium gem pets require the absent wallet.'),
    Mode('athletic-course', enter_athletic, play_athletic, seconds=65, note='Walk to southwest obstacle course; start UI, steer across stairs/platforms and retry falls.'),
    Mode('keyboard-stage', instrument_entry('keyboard'), play_instrument, seconds=35, note='Outdoor live stage keyboard; repeated performance interaction.'),
    Mode('drums-stage', instrument_entry('drums'), play_instrument, seconds=35, note='Outdoor live stage drum kit; repeated performance interaction.'),
]
for kind in ('furn', 'hand', 'acc', 'hat', 'cab', 'moon'):
    MODES.append(Mode('gacha-' + kind + '-attempt', gacha_entry(kind), play_gacha, seconds=35,
                      note='Attempt the actual ' + kind + ' machine for 35 seconds. Missing api.php lineups blocks the draw panel; moon is seasonal September 21–October 4.'))
    MODES.append(unavailable('gacha-' + kind, 'Draw panel requires successful api.php lineups response before opening (kf/u4); PHP service is absent. Separate attempt Mode records the machine and refusal.'))
MODES += [
    unavailable('takamatsu-stock', 'Limited shared stock and purchases call the missing town/api.php service; shop also enforces 06:00–23:00 JST. The interior entry is attempted separately.'),
    unavailable('farm', 'Move menu links /farm/; smartgame-town/public/farm is absent. Separate farm application was not captured.'),
    unavailable('office-wapon', 'Elevator 8F 株式会社wapon requires api.php office_get access/layout and an authorized account; PHP backend is absent. Public 1F/10F/RF have separate offline Modes.'),
    unavailable('livehouse-video', 'LUMIERE interior is local, but shared video needs missing api.php synchronization and non-local YouTube iframe/media. No external connection allowed.'),
    unavailable('online-players-chat', 'api.php registration/poll/chat service is absent (local POST 405); client falls back to オフライン（ひとりで散歩中）.'),
    unavailable('voice', 'Voice requires online peers and missing town signaling service; offline client has nobody to call.'),
    unavailable('account-cloud-save', '/account/api.php account/login and server saves are absent (404); guest localStorage saves work offline.'),
    unavailable('friends-room-visits', 'Friend lookup and room_of/farm_of require absent PHP services and remote users; own room has an offline Mode.'),
    unavailable('letters', 'Original help explicitly says postboxes are broken and DM send/receive suspended (s6=false); backend also absent.'),
    unavailable('announcements-rankings', 'Town announcements-api.php and online fishing/ranking boards require missing PHP responses.'),
    unavailable('gems-room-upgrades-design-tickets', 'Paid gems, premium pets, larger room tiers and eye/mouth/clothing design tickets require an account wallet and absent payment/API services; no local guest purchase path.'),
]
# Each arcade destination shown by the original catalog gets its own Mode.
# Parse only the archive's data file; importing this module never fetches a URL.
_catalog = (ROOT / 'smartgame-town/public/js/games.js').read_text(encoding='utf-8')
for directory in dict.fromkeys(re.findall(r"^\s*'([^']+)'\s*:\s*\{\s*name:", _catalog, re.M)):
    if directory in ('town', 'farm'):
        continue
    MODES.append(unavailable('arcade-' + directory,
        f'Arcade catalog links /{directory}/; this separate game is absent from smartgame-town/public/{directory}/. The captured arcade interior is tested separately.'))


def diagnosed(name, phase, action):
    async def run(page, *args):
        try:
            await action(page, *args)
        except Exception as error:
            # Repeated missing-PHP console errors can exhaust the runner's
            # 20-error cap; keep the actual automation failure in its stdout.
            print(f'{name} {phase}: {type(error).__name__}: {error}', flush=True)
            raise
    return run


for _mode in MODES:
    _mode.enter = diagnosed(_mode.name, 'enter', _mode.enter)
    _mode.play = diagnosed(_mode.name, 'play', _mode.play)
