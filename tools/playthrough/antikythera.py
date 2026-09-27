"""Complete discovery and natural air depletion, using native input only.

__ak is the original game's audit hook. All evaluations below are read-only;
projection operates on cloned vectors. No skip/step/place/debug mutators, clock
changes, pointer-lock shim, or air-failure bypass are used.
"""

import asyncio
import json
import math
import time

from playthrough import Mode

SERVE = ['antikythera']
URL = 'http://127.0.0.1:8104/index.html'
STAGES = ['title', 'begin-dive', 'dive', 'explore', 'sonar',
          'clean-1', 'found-1', 'clean-2', 'found-2', 'clean-3', 'found-3',
          'carry', 'assemble', 'fit-1', 'fit-2', 'fit-3', 'crank',
          '223-months', 'eclipse', 'end-card']


async def state(page):
    return await page.evaluate('''() => {
      const a = window.__ak, g = a.G, p = a.player;
      const screen = v => { const q = v.clone().project(a.camera);
        return [(q.x + 1) * innerWidth / 2, (1 - q.y) * innerHeight / 2]; };
      return {stage:g.state, stageSeconds:g.st, air:g.air, found:g.found,
        foundTime:g.foundT, months:g.months, sonar:g.sonarUsed,
        pos:p.pos.toArray(), yaw:p.yaw, enabled:p.enabled,
        auto:!!p.auto, blocked:p.dbg.blocked,
        fragments:(a.fragments?.items || []).map(i => ({index:i.i,
          pos:i.home.toArray(), state:i.state, progress:i.mask?.progress})),
        pile:g.site?.placed ? g.site.pile.toArray() : null,
        slot:g.puzzle?.slot, held:g.puzzle?.held?.idx, hover:g.puzzle?.hover,
        wheels:(a.wheels || []).map(w => ({index:w.idx, state:w.state,
          fitted:w.fitted, teeth:w.N, screen:screen(w.mesh.position)})),
        sockets:(a.mechanism?.sockets || []).map(s => ({visible:s.visible,
          screen:screen(s.position.clone().applyMatrix4(s.parent.matrixWorld))})),
        text:document.body.innerText};
    }''')


class Evidence:
    def __init__(self, page, name, expected):
        self.page, self.name, self.expected = page, name, expected
        self.start = time.monotonic()
        self.rows = []

    async def log(self, stage, shot=False, status='reached', reason=None):
        s = await state(self.page)
        row = dict(stage=stage, status=status,
                   seconds=round(time.monotonic() - self.start, 2), state=s)
        if reason:
            row['reason'] = reason
        if shot:
            row['screenshot'] = self.name + '-' + stage + '.png'
            await self.page.screenshot(path=str(
                self.page._playthrough_directory / row['screenshot']))
        self.rows.append(row)
        self.save()
        print('antikythera ' + json.dumps({k: v for k, v in row.items() if k != 'state'}), flush=True)
        return s

    def save(self):
        (self.page._playthrough_directory / (self.name + '-stages.json')).write_text(
            json.dumps(dict(mode=self.name, clock='wall seconds from play start',
                            expected=self.expected, stages=self.rows), indent=2) + '\n')

    async def unfinished(self, reason):
        reached = {r['stage'] for r in self.rows if r['status'] == 'reached'}
        for stage in self.expected:
            if stage not in reached:
                self.rows.append(dict(stage=stage, status='unverified', reason=reason))
        self.save()


async def enter(page):
    await page.wait_for_function('window.__ak?.G.state === "title"')
    await page.get_by_role('button', name='Begin the dive').wait_for()
    await page.locator('#loading').wait_for(state='hidden')
    await asyncio.sleep(1)


async def wait_state(page, target, seconds):
    await page.wait_for_function('(s) => __ak.G.state === s', arg=target,
                                 timeout=seconds * 1000)


async def begin(page, ev):
    await ev.log('title', True)
    await asyncio.sleep(5.2)
    await page.get_by_role('button', name='Begin the dive').click()
    await ev.log('begin-dive')
    await wait_state(page, 'dive', 30)
    await ev.log('dive', True)
    await wait_state(page, 'explore', 65)
    await ev.log('explore', True)


async def keys(page, wanted, active):
    for key in active - wanted:
        await page.keyboard.up(key)
    for key in wanted - active:
        await page.keyboard.down(key)
    return wanted


async def walk(page, target, cleaning=False):
    """Steer A/D and walk W; E may invoke the game's own short walk-in."""
    active = set()
    started = time.monotonic()
    last_pos, stuck = None, 0
    try:
        while time.monotonic() - started < 55:
            s = await state(page)
            if s['stage'] != 'explore':
                return
            assert s['air'] > 0, 'Air expired while walking to objective'
            dx, dz = target[0] - s['pos'][0], target[2] - s['pos'][2]
            distance = math.hypot(dx, dz)
            desired = math.atan2(-dx, -dz)
            angle = math.atan2(math.sin(desired - s['yaw']), math.cos(desired - s['yaw']))
            wanted = set()
            if abs(angle) > .09:
                wanted.add('a' if angle > 0 else 'd')
            if abs(angle) < .45:
                wanted.add('w')
            if cleaning and distance < 4.8 and abs(angle) < .25:
                active = await keys(page, set(), active)
                await page.keyboard.press('e', delay=100)
                await asyncio.sleep(.3)
                after = await state(page)
                if after['stage'] == 'clean':
                    return
                if after['auto']:
                    await wait_state(page, 'clean', 20)
                    return
            if last_pos and math.dist(last_pos, s['pos']) < .015 and 'w' in wanted:
                stuck += 1
            else:
                stuck = 0
            if stuck > 10:
                wanted.add('Space')  # Native jump/float for seabed obstacles.
            active = await keys(page, wanted, active)
            last_pos = s['pos']
            await asyncio.sleep(.15)
        raise AssertionError('Objective walk exceeded 55s: ' + json.dumps(await state(page)))
    finally:
        await keys(page, set(), active)


async def discover(page, ev):
    await begin(page, ev)
    await page.keyboard.press('q')
    await asyncio.sleep(1.5)
    assert (await state(page))['sonar'], 'Q did not activate sonar'
    await ev.log('sonar', True)
    for number in range(1, 4):
        s = await state(page)
        candidates = [f for f in s['fragments'] if f['state'] == 'buried']
        target = min(candidates, key=lambda f: math.dist(f['pos'], s['pos']))
        await walk(page, target['pos'], cleaning=True)
        await wait_state(page, 'clean', 10)
        await ev.log('clean-' + str(number), True)
        try:
            await page.keyboard.down('e')
            await page.wait_for_function('(n) => __ak.G.found >= n', arg=number, timeout=45000)
            s = await ev.log('found-' + str(number), True)
            assert s['fragments'][target['index']]['progress'] >= .70
            await wait_state(page, 'explore', 30)
        finally:
            await page.keyboard.up('e')
        await page.keyboard.press('q')
    await ev.log('carry', True)
    await page.wait_for_function('__ak.G.site?.placed', timeout=10000)
    await walk(page, (await state(page))['pile'])
    await wait_state(page, 'assemble', 10)
    await ev.log('assemble', True)
    for number in range(1, 4):
        await page.wait_for_function('''() => {
          const a=__ak, i=a.G.puzzle?.slot;
          return i >= 0 && a.wheels[i].state === 'rest' && !a.wheels[i].fitted;
        }''', timeout=65000)
        await asyncio.sleep(2)
        s = await state(page)
        slot = s['slot']
        await page.mouse.move(*s['wheels'][slot]['screen'])
        await page.mouse.down()
        try:
            await asyncio.sleep(.3)
            assert (await state(page))['held'] == slot, 'Mouse did not pick up wheel'
            # Re-read the socket projection while the assembly camera settles.
            for _ in range(5):
                s = await state(page)
                await page.mouse.move(*s['sockets'][slot]['screen'], steps=12)
                await asyncio.sleep(.25)
                if (await state(page))['hover'] == slot:
                    break
            assert (await state(page))['hover'] == slot, 'Drag did not reach lit socket'
        finally:
            await page.mouse.up()
        await page.wait_for_function('(i) => __ak.wheels[i].fitted', arg=slot, timeout=15000)
        await ev.log('fit-' + str(number), True)
    await wait_state(page, 'crank', 60)
    await ev.log('crank', True)
    # Clockwise mouse circles exercise the advertised crank gesture.
    await page.wait_for_function('__ak.G.ckGrip > .6', timeout=20000)
    started = time.monotonic()
    await page.mouse.move(800, 360)
    await page.mouse.down()
    try:
        step = 0
        while (await state(page))['months'] < 223 and time.monotonic() - started < 45:
            angle = step * math.pi / 12
            await page.mouse.move(640 + 160 * math.cos(angle), 360 + 160 * math.sin(angle))
            await asyncio.sleep(.025)
            step += 1
    finally:
        await page.mouse.up()
    assert (await state(page))['months'] == 223, 'Crank did not reach 223 months'
    await ev.log('223-months', True)
    await wait_state(page, 'eclipse', 30)
    await ev.log('eclipse', True)
    await wait_state(page, 'end', 80)
    await page.get_by_text('You discovered the world’s first computer', exact=False).wait_for(timeout=10000)
    await page.get_by_text('All three found in', exact=False).wait_for(timeout=10000)
    await asyncio.sleep(3)
    await ev.log('end-card', True)


async def air_out(page, ev):
    await begin(page, ev)
    await page.keyboard.press('q')
    # The 120-second air timer must expire naturally; no fake clock or steps.
    await page.get_by_text('Hauled up to the boat.', exact=True).wait_for(timeout=155000)
    s = await ev.log('air-out', True)
    assert s['air'] <= 0 and s['found'] == 0
    await page.wait_for_event('domcontentloaded', timeout=15000)
    await wait_state(page, 'title', 60)
    await page.locator('#loading').wait_for(state='hidden')
    await asyncio.sleep(1)
    await ev.log('returned-title', True)


def driver(name, expected, action, budget):
    async def play(page, ctl):
        ev = Evidence(page, name, expected)
        try:
            # Finish diagnostics before the runner's cancellation deadline.
            await asyncio.wait_for(action(page, ev), budget)
        except BaseException as error:
            print('antikythera ' + name + ' unverified: ' +
                  (str(error) or type(error).__name__), flush=True)
            await ev.unfinished(str(error) or type(error).__name__)
            raise
        finally:
            for key in ('w', 'a', 's', 'd', 'e', 'Space'):
                await page.keyboard.up(key)
            await page.mouse.up()
    return play


MODES = [
    Mode('discovery', enter, driver('discovery', STAGES, discover, 230), seconds=240,
         note='Real Begin button, WASD navigation from read-only positions, Q sonar, '
              'E brushing, three mouse drags, clockwise mouse crank to 223, eclipse and timed end card.'),
    Mode('air-out', enter, driver('air-out', ['title', 'begin-dive', 'dive', 'explore',
         'air-out', 'returned-title'], air_out, 170), seconds=180,
         note='Fresh dive; let the native 120-second air timer expire, read hauled-up '
              'message and observe automatic reload to title. No timer or state writes.'),
]
