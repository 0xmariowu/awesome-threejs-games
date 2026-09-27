"""Hanakawa's original river journey, driven with keyboard and menu input.

The eight Log entries are objectives in one continuous world, not separate
levels. Locked objectives must be unlocked by sailing and docking. Their play
budgets include that prerequisite travel; evidence records when the requested
objective actually becomes available and is selected. No debug completion,
teleport, save injection, graphics override, or startup workaround is used.

Source inventory: ui-Baa9W2Z_.js, game-DXv9Pcsb.js, camera-BZCFS0Jb.js and
model-Dg7Wwvrf.js. One boat, seven selectable finishes, follow/helm/photo,
optional time-lapse, eight objectives. No account or online-only menu exists.
The lazy-loaded tea-crate GLTF is absent from this archive. Loading tea still
works logically, but the runner must retain that local 404 and invisible cargo.
"""

import asyncio
import json
import math
import time
from pathlib import Path

from playthrough import Mode

SERVE = ['hanakawa']
URL = 'http://127.0.0.1:8082/index.html'
OUT = Path(__file__).resolve().parents[2] / 'output/playthrough/hanakawa'

# Read-only telemetry: the original river chart geometry supplies a centreline
# for steering; every state-changing action below is a real key or UI click.
STATE = """async ({goal, dock, gates, reverse}) => {
 const l = await import('/assets/layout-DtbcdJal.js');
 const c = window.__luma.ctx, b = c.boat, g = c.services.game;
 const p = l.f(b.position.x, b.position.z), q = b.quaternion;
 let end = goal == null ? l.a - 35 : goal;
 const berth = dock ? l.n.find(d => d.id === dock) : null;
 if (berth) end = berth.s;
 let t = l.p(reverse ? Math.max(end, p.s - 18) : Math.min(end, p.s + 18));
 let tx = t.x, tz = t.z;
 // Spectacles Bridge has a solid centre pier. Aim through its actual arch,
 // easing into the channel well before the bow reaches the masonry.
 const stone = c.services.bridges.bridges.find(b => b.id === 'stone-bridge');
 if (stone && Math.abs(p.s - 680) < 70) {
   const arch = stone.channel[0];
   const lane = l.f((arch.a[0]+arch.b[0])/2, (arch.a[1]+arch.b[1])/2).lateral;
   const weight = Math.min(1, Math.max(0, (70-Math.abs(p.s-680))/30));
   tx += t.nx * lane * weight; tz += t.nz * lane * weight;
 }
 if (berth && Math.abs(p.s - berth.s) < 40) {
   tx = berth.moorX; tz = berth.moorZ;
 }
 if (gates) {
   const route = g.routes[0], gate = route.gates[route.next];
   if (gate && p.s > gate.s - 45) {
     // A distant aim point cuts the alternating gates' corners. Cross close
     // to the centre before asking the rudder to turn toward the next gate.
     tx = gate.x + gate.dx * 2; tz = gate.z + gate.dz * 2;
   }
 }
 return {x:b.position.x, z:b.position.z, s:p.s, lateral:p.lateral,
   speed:b.speed, yaw:b.angularVelocity.y,
   heading:Math.atan2(-2*(q.x*q.z+q.w*q.y), 1-2*(q.x*q.x+q.y*q.y)),
   tx, tz, docked:g.dockedAt,
   distance:berth ? Math.hypot(b.position.x-berth.moorX,b.position.z-berth.moorZ) : null,
   camera:c.cameraRig.mode, camera_position:c.camera.position.toArray(),
   ui:window.__lumaUi.mode,
   objectives:g.objectives.map(o=>({id:o.id,status:o.status,progress:o.progress})),
   discovered:g.pois.filter(p=>p.discovered).map(p=>p.id),
   cargo:g.cargo, target:g.target, paint:g.paint,
   route:g.routes[0], stats:window.__luma.stats()};
}"""


async def state(page, goal=None, dock=None, gates=False, reverse=False):
    return await page.evaluate(STATE, dict(goal=goal, dock=dock, gates=gates, reverse=reverse))


async def ready(page):
    await page.bring_to_front()
    # HUD construction precedes shader warmup: it is not proof of readiness.
    await page.wait_for_function('window.__lumaReady === true && window.__lumaUi?.mode === "play"')
    await page.locator('#loading').wait_for(state='hidden')
    await page.locator('canvas').first.focus()


async def cast_off(page):
    if (await state(page))['docked']:
        await page.keyboard.press('e')
        await page.wait_for_function('window.__luma.ctx.services.game.dockedAt === null')


async def course(page, objective):
    await page.keyboard.press('m')
    await page.locator('.chart[data-open="true"]').wait_for()
    button = page.locator('[data-track="' + objective + '"]')
    if await button.count():
        await button.click()
    else:
        s = await state(page)
        item = next(o for o in s['objectives'] if o['id'] == objective)
        if item['status'] == 'locked':
            raise RuntimeError(objective + ': still locked after prerequisite sailing')
    await page.get_by_role('button', name='Close the river map', exact=True).click()
    await page.wait_for_function('window.__lumaUi.mode === "play"')


class Evidence:
    def __init__(self, name):
        self.name = name
        self.start = time.monotonic()
        self.selected = None
        self.rows = []
        self.last = -10

    async def record(self, page, event, snapshot=None):
        snapshot = snapshot or await state(page)
        self.rows.append(dict(seconds=round(time.monotonic()-self.start, 2),
                             event=event, **snapshot))
        directory = getattr(page, '_playthrough_directory', OUT)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / (self.name + '-input.json')).write_text(
            json.dumps(self.rows, indent=2) + '\n', encoding='utf-8')

    async def select(self, page):
        self.selected = time.monotonic()
        await self.record(page, 'requested-mode-selected')

    async def check(self, page):
        elapsed = 0 if self.selected is None else time.monotonic()-self.selected
        await self.record(page, 'input-end')
        if elapsed < 30:
            raise RuntimeError('%s: requested mode received only %.1fs after entry; '
                               'prerequisite travel does not count' % (self.name, elapsed))
        selected = next(row for row in self.rows if row['event']=='requested-mode-selected')
        later = [row for row in self.rows if row['seconds'] >= selected['seconds']]
        if self.name == 'photo':
            origin = selected['camera_position']
            moved = max(math.dist(origin, row['camera_position']) for row in later)
        else:
            moved = max(math.hypot(row['x']-selected['x'], row['z']-selected['z']) for row in later)
        if moved < 10:
            raise RuntimeError('Input did not move the boat/camera at least 10 metres')
        objective = next((o for o in self.rows[-1]['objectives'] if o['id']==self.name), None)
        if objective and objective['status'] != 'done':
            raise RuntimeError(self.name + ': objective remains incomplete: ' + str(objective))


async def sail(page, evidence, seconds, goal=None, dock=None, gates=False, reverse=False):
    """Closed-loop steering, with reverse braking and E at a real landing."""
    held = set()
    start = time.monotonic()
    progress_at, progress_s = start, None
    resets = 0
    try:
        while time.monotonic()-start < seconds:
            s = await state(page, goal, dock, gates, reverse)
            if s['ui'] != 'play':
                raise RuntimeError('Gameplay unexpectedly left play: ' + s['ui'])
            if time.monotonic()-evidence.last > 5:
                await evidence.record(page, 'steering', s)
                evidence.last = time.monotonic()
            if dock and s['docked'] == dock:
                await evidence.record(page, 'docked-' + dock, s)
                return
            if goal is not None and (s['s'] <= goal if reverse else s['s'] >= goal):
                return
            if gates and next(o for o in s['objectives'] if o['id']=='lanterns')['status']=='done':
                await evidence.record(page, 'six-lantern-gates-complete', s)
                return
            distance = s['distance']
            if dock and distance < 13 and abs(s['speed']) < 1.05:
                for key in held:
                    await page.keyboard.up(key)
                held.clear()
                await page.keyboard.press('e')
                await asyncio.sleep(.4)
                continue
            angle = math.atan2(s['tx']-s['x'], -(s['tz']-s['z']))
            if reverse:
                angle += math.pi
            error = (angle-s['heading']+math.pi) % (2*math.pi)-math.pi
            steering = (error+s['yaw']*1.8) * (-1 if reverse else 1)
            keys = set()
            if not dock or distance > 30 or (distance > 12 and s['speed'] < 1.5):
                keys.add('w')
            elif s['speed'] > .7:
                keys.add('s')
            if reverse:
                keys = {'s'}
            # The six lake gates zigzag. Cruising speed (~7.5 m/s) carries the
            # hull past the narrow openings; feather the throttle before them.
            if gates and s['s'] > 1580:
                keys.discard('w')
                if s['speed'] < 3.6:
                    keys.add('w')
                elif s['speed'] > 4.4:
                    keys.add('s')
            if steering > .045:
                keys.add('d')
            elif steering < -.045:
                keys.add('a')
            for key in held-keys:
                await page.keyboard.up(key)
            for key in keys-held:
                await page.keyboard.down(key)
            held = keys
            if progress_s is None or abs(s['s']-progress_s) > 3:
                progress_s, progress_at = s['s'], time.monotonic()
            elif time.monotonic()-progress_at > 18 and not s['docked']:
                resets += 1
                await evidence.record(page, 'aground-reset-key', s)
                if resets > 2:
                    raise RuntimeError('Repeatedly aground; see input telemetry and PNGs')
                await page.keyboard.press('r')
                progress_at = time.monotonic()
            await asyncio.sleep(.2)
        if dock or goal is not None or gates:
            raise RuntimeError('Sailing budget exhausted before ' + str(dock or goal or 'lantern gates'))
    finally:
        for key in held:
            await page.keyboard.up(key)


async def cruise(page, evidence):
    await cast_off(page)
    # Each mode runs independently from a new village start. Stay in the river,
    # using short reverse manoeuvres if a long run reaches its upstream end.
    while True:
        s = await state(page)
        if s['s'] > 2035:
            await page.keyboard.down('s')
            try:
                await asyncio.sleep(8)
            finally:
                await page.keyboard.up('s')
        await sail(page, evidence, 8)


def objective_mode(objective, title, seconds):
    async def enter(page):
        await ready(page)
        await page.keyboard.press('m')
        await page.locator('.log-name').filter(has_text=title).wait_for()
        await page.get_by_role('button', name='Close the river map', exact=True).click()
        await cast_off(page)

    async def play(page, ctl):
        evidence = Evidence(objective)
        try:
            await evidence.record(page, 'world-entered-prerequisites-start')
            if objective == 'landmarks':
                # Old Weir (s=8, discovery radius=60) is below the village.
                # Back down the channel, then use the normal upstream route.
                await sail(page, evidence, 100, goal=50, reverse=True)
                if 'weir' not in (await state(page))['discovered']:
                    raise RuntimeError('Reached downstream approach but Old Weir did not register')
                await evidence.record(page, 'old-weir-visited')
            if objective == 'temple-steps':
                await sail(page, evidence, 50, goal=310)
            elif objective in ('tea', 'rice', 'lanterns', 'bridges', 'landmarks'):
                await sail(page, evidence, 85, dock='temple')
                if objective == 'rice':
                    await cast_off(page)
                    await sail(page, evidence, 240, dock='teahouse')
            await course(page, objective)
            await evidence.select(page)
            await cast_off(page)
            if objective in ('temple-steps', 'incense'):
                await sail(page, evidence, 85, dock='temple')
            elif objective == 'tea':
                await sail(page, evidence, 240, dock='teahouse')
            elif objective == 'rice':
                await sail(page, evidence, 90, dock='mill')
            elif objective == 'lanterns':
                await sail(page, evidence, 300, gates=True)
            await cruise(page, evidence)
        finally:
            await evidence.check(page)

    return Mode(objective, enter, play, seconds=seconds,
                note=title + '. Log objective in the shared river world. Play includes '
                'real prerequisite sailing; *-input.json records requested-mode-selected '
                'and enforces at least 30s afterwards. Fresh launch retains startup stalls.')


def variant_mode(name, *, camera=None, paint=None, timelapse=False, new_game=False):
    async def enter(page):
        await ready(page)
        if paint or timelapse or new_game:
            await page.keyboard.press('Escape')
            if paint:
                await page.get_by_role('tab', name='Boat finish', exact=True).click()
                await page.locator('.paints input[value="' + paint + '"]').check()
            if timelapse:
                await page.get_by_role('tab', name='Settings', exact=True).click()
                await page.get_by_role('switch', name='Time-lapse: a full day every 20 seconds', exact=True).check()
            if new_game:
                await page.get_by_role('tab', name='Controls', exact=True).click()
                await page.get_by_role('tab', name='New game', exact=True).click()
                await page.get_by_role('button', name='Start a new journey', exact=True).click()
                await page.get_by_role('button', name='Start over', exact=True).click()
            else:
                await page.get_by_role('button', name='Resume', exact=True).click()
        if camera:
            for _ in range({'helm': 1, 'photo': 2}[camera]):
                await page.keyboard.press('c')
            await page.wait_for_function('mode => window.__luma.ctx.cameraRig.mode === mode', arg=camera)
        if camera != 'photo':
            await cast_off(page)

    async def play(page, ctl):
        evidence = Evidence(name)
        try:
            await evidence.select(page)
            if camera == 'photo':
                # C enters the actual free camera; WASD/Space/Q move it.
                while True:
                    for key, duration in [('Space', 3), ('w', 7), ('d', 3), ('q', 2), ('a', 3), ('s', 5)]:
                        await ctl.hold(key, duration)
                        await evidence.record(page, 'photo-' + key)
                    await page.mouse.wheel(0, -120)
            else:
                await cruise(page, evidence)
        finally:
            await evidence.check(page)

    note = 'Original UI selection; sail with W/S and A/D, no state injection.'
    if camera == 'photo':
        note = 'C twice selects photo; WASD, Space/Q and wheel move and zoom the free camera.'
    if timelapse:
        note += ' World setting cycles dawn, rain, thunderstorm and starry night every 20s; '
        note += 'night is intentionally dark but the mixed daylight run is not exempted from black detection.'
    return Mode(name, enter, play, seconds=65 if timelapse else 45, note=note)


MODES = [
    objective_mode('cast-off', 'Cast off', 60),
    objective_mode('temple-steps', 'Temple Steps', 110),
    objective_mode('incense', 'Incense for the temple', 100),
    objective_mode('tea', 'Tea for the teahouse', 320),
    objective_mode('rice', 'Rice for the mill', 430),
    objective_mode('lanterns', 'Floating lanterns', 390),
    objective_mode('bridges', 'Under every bridge', 270),
    objective_mode('landmarks', 'Sights of the valley', 460),
    variant_mode('helm', camera='helm'),
    variant_mode('photo', camera='photo'),
    *[variant_mode('finish-' + paint, paint=paint) for paint in (
        'natural', 'dark', 'vermilion', 'reed', 'indigo', 'lantern-white', 'lantern-red')],
    variant_mode('time-lapse', timelapse=True),
    variant_mode('new-journey', new_game=True),
]
