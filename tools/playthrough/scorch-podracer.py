"""UI-entered offline SCORCH coverage, with real keyboard/pointer driving.

The archive has one circuit, three laps, six pods, five camera views, and
low/medium/high graphics. There are no alternate tracks or online races.
Read-only GAME telemetry guides digital steering; no game state, clock,
physics, lap count, or autopilot is changed. Results are earned by driving.
"""

import asyncio
import json
import time
from pathlib import Path

from playthrough import Mode

SERVE = ['scorch-podracer']
URL = 'http://127.0.0.1:8095/index.html'
EVIDENCE = Path(__file__).resolve().parents[2] / 'output/playthrough/scorch-podracer'
PODS = ('kraken', 'viper', 'titan', 'mantis', 'basalt', 'wasp')

# Read-only geometry/physics observations from public/index.html: TRACK,
# yawCap and cornerSpeed. Pure-pursuit steering anticipates the pod's turn
# inertia. Do not call the game's aiInput (it mutates racers).
OBSERVE = """() => {
  const r = GAME.player, t = GAME.TRACK, v = Math.max(0, r.vf);
  const look = 40 + v * .75, f = ((r.Q.s + look) % t.LEN + t.LEN) % t.LEN / t.ds;
  const i = Math.floor(f), j = (i + 1) % t.N, u = f - i;
  const x = t.P[i].x + (t.P[j].x - t.P[i].x) * u;
  const z = t.P[i].z + (t.P[j].z - t.P[i].z) * u;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const course = r.th + (Math.hypot(r.vx, r.vz) > 25
    ? wrap(Math.atan2(r.vx, r.vz) - r.th) * .7 : 0);
  const err = wrap(Math.atan2(x - r.x, z - r.z) - course - r.yawRate * .22);
  const yaw = 1.75 * r.def.stats.turn / (1 + (v / 300) ** 2 * .9)
    * Math.min(1, v / 14 + .15);
  const steer = Math.max(-1, Math.min(1,
    (2 * Math.max(20, v) * Math.sin(err) / look) / Math.max(.15, yaw)));
  let cv = 0;
  for (let k = 0; k < Math.ceil((60 + v * 1.7) / t.ds); k += 2)
    cv = Math.max(cv, Math.abs(t.CV[(r.Q.i + k) % t.N]));
  let corner = 520;
  while (corner > 50 && corner * cv >
    .80 * 1.75 * r.def.stats.turn / (1 + (corner / 300) ** 2 * .9)) corner -= 8;
  const target = Math.min(310, corner * .95);
  return {phase:G.phase, paused:G.paused, pod:r.def.id, time:G.raceT,
    lap:r.lap, progress:r.prog, x:r.x, z:r.z, speed:r.vf, lateral:r.lat,
    boost:r.boostE, energy:GAME.PICK.count, finished:r.finished, finishTime:r.ft,
    camera:G.camMode, auto:!!G.autoPlayer, steer, target,
    accelerate:v < target, brake:v > target * 1.06,
    useBoost:r.boostE > .6 && cv < .0012 && Math.abs(err) < .12 && v > 220};
}"""


def evidence_directory(page):
    directory = getattr(page, '_playthrough_directory', EVIDENCE)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def save(page, name, data):
    (evidence_directory(page) / (name + '.json')).write_text(json.dumps(data, indent=2) + '\n')


async def ready(page):
    await page.locator('#boot').wait_for(state='hidden')
    await page.locator('#go').wait_for(state='visible')


async def select(page, pod):
    await ready(page)
    # The chip row is hidden at the runner viewport; use the visible carousel.
    for _ in range(len(PODS)):
        if (await page.locator('#pname').inner_text()).strip().lower() == pod:
            break
        await page.locator('#next').click()
    assert (await page.locator('#pname').inner_text()).strip().lower() == pod


async def start(page, pod='kraken', camera=1):
    await select(page, pod)
    await page.locator('#go').click()
    await page.wait_for_function('G.phase === "race"')
    await page.keyboard.press(str(camera))
    assert await page.evaluate('GAME.player.def.id') == pod
    assert not await page.evaluate('!!G.autoPlayer')


def entry(pod, camera=1, quality=None):
    async def enter(page):
        await ready(page)
        if quality:
            for _ in range(3):
                if (await page.locator('#qbtn').inner_text()) == 'GFX: ' + quality.upper():
                    break
                await page.locator('#qbtn').click()
                await page.wait_for_load_state('domcontentloaded')
                await ready(page)
            assert await page.locator('#qbtn').inner_text() == 'GFX: ' + quality.upper()
        await start(page, pod, camera)
    return enter


class Driver:
    def __init__(self, page):
        self.page = page
        self.held = set()
        self.duty = 0
        self.samples = []

    async def keys(self, wanted):
        for key in self.held - wanted:
            await self.page.keyboard.up(key)
        for key in wanted - self.held:
            await self.page.keyboard.down(key)
        self.held = wanted

    async def drive(self, seconds, until_results=False):
        deadline = time.monotonic() + seconds
        next_sample = 0
        first = await self.page.evaluate(OBSERVE)
        try:
            while time.monotonic() < deadline:
                state = await self.page.evaluate(OBSERVE)
                assert not state['auto'], 'Unexpected game autopilot'
                if time.monotonic() >= next_sample:
                    self.samples.append(state)
                    next_sample = time.monotonic() + 2
                if state['phase'] == 'results':
                    assert state['finished'], 'Results without a completed player race'
                    return state
                # Pulse-density modulation turns an analog steering estimate into
                # actual ArrowLeft/ArrowRight presses, with no injected inputs.
                self.duty += state['steer']
                turn = 1 if self.duty > .5 else -1 if self.duty < -.5 else 0
                self.duty -= turn
                keys = set()
                if state['accelerate']:
                    keys.add('ArrowUp')
                if state['brake']:
                    keys.add('ArrowDown')
                if turn:
                    keys.add('ArrowLeft' if turn > 0 else 'ArrowRight')
                if state['useBoost']:
                    keys.add('Shift')
                await self.keys(keys)
                await asyncio.sleep(.075)
            last = await self.page.evaluate(OBSERVE)
            self.samples.append(last)
            assert last['progress'] - first['progress'] > seconds * 70, (
                'Insufficient forward race progress', first, last)
            if until_results:
                raise AssertionError('Three-lap finish did not arrive within the driving budget')
            return last
        finally:
            await self.keys(set())


def playing(name, seconds=40):
    async def play(page, ctl):
        driver = Driver(page)
        try:
            await driver.drive(seconds)
        finally:
            save(page, name + '-telemetry', driver.samples)
    return play


async def full_race(page, ctl, change=False):
    driver = Driver(page)
    evidence = {'samples': driver.samples}
    try:
        result = await driver.drive(195, until_results=True)
        assert result['finished'] and result['lap'] == 4
        await page.locator('#results').wait_for(state='visible')
        evidence['results'] = await page.locator('#results').inner_text()
        evidence['finish'] = result
        prefix = 'results-change-pod' if change else 'kraken'
        await page.screenshot(path=str(evidence_directory(page) / (prefix + '-results.png')))
        await ctl.wait(5.5)
        if change:
            await page.locator('#change').click()
            await start(page, 'wasp')
        else:
            await page.locator('#again').click()
            await page.wait_for_function('G.phase === "race"')
        restarted = await page.evaluate(OBSERVE)
        assert restarted['pod'] == ('wasp' if change else 'kraken') and restarted['lap'] == 0
        evidence['change_pod' if change else 'race_again'] = restarted
        await driver.drive(32)
        evidence['restarted_play_seconds'] = 32
        await page.screenshot(path=str(evidence_directory(page) / (prefix + '-restarted.png')))
        # Keep racing for the rest of the runner budget. A second finish is
        # harmless; this driver explicitly restarts through the results UI.
        while True:
            state = await page.evaluate(OBSERVE)
            if state['phase'] == 'results':
                await page.locator('#again').click()
                await page.wait_for_function('G.phase === "race"')
            await driver.drive(1)
    finally:
        save(page, 'results-change-pod-telemetry' if change else 'kraken-full-race-telemetry', evidence)
        assert evidence.get('restarted_play_seconds', 0) >= 32, (
            'Full race/results/restarted gameplay did not complete; see telemetry')


async def results_change(page, ctl):
    await full_race(page, ctl, change=True)


async def pause_resume(page, ctl):
    driver = Driver(page)
    evidence = {'samples': driver.samples}
    try:
        await driver.drive(8)
        await ctl.tap('Escape')
        await page.locator('#pause').wait_for(state='visible')
        before = await page.evaluate(OBSERVE)
        await page.screenshot(path=str(evidence_directory(page) / 'pause-before.png'))
        await ctl.wait(5.5)
        after = await page.evaluate(OBSERVE)
        await page.screenshot(path=str(evidence_directory(page) / 'pause-after.png'))
        evidence.update(before=before, after=after)
        await page.locator('#resume').click()
        await page.locator('#pause').wait_for(state='hidden')
        await driver.drive(32)
        # Preserve the archive failure, but first prove Resume still allows play.
        assert after['time'] - before['time'] < .2, (
            'Archive pause bug: race timer advanced %.2fs while PAUSED was visible'
            % (after['time'] - before['time']))
    finally:
        save(page, 'pause-resume-telemetry', evidence)


async def pause_quit(page, ctl):
    driver = Driver(page)
    try:
        await driver.drive(5)
        await ctl.tap('p')
        await page.locator('#quit').click()
        await page.locator('#menu').wait_for(state='visible')
        await start(page, 'wasp', 1)
        await driver.drive(33)
    finally:
        save(page, 'pause-quit-telemetry', driver.samples)


async def touch_enter(page):
    # Use Chrome's real device emulation before reloading, so the game's own
    # TOUCH detection reveals its controls. Do not patch DOM or input state.
    session = await page.context.new_cdp_session(page)
    await session.send('Emulation.setTouchEmulationEnabled',
                       {'enabled': True, 'maxTouchPoints': 5})
    await page.reload(wait_until='domcontentloaded')
    await start(page, 'wasp')
    await page.locator('#touch').wait_for(state='visible')
    await session.detach()


async def touch_play(page, ctl):
    session = await page.context.new_cdp_session(page)
    samples, active, duty = [], frozenset(), 0
    points = {}
    for index, name in enumerate(('tl', 'tr', 'tbrk', 'tbst', 'tcam')):
        box = await page.locator('#' + name).bounding_box()
        assert box, 'Touch control not visible: ' + name
        points[name] = dict(id=index + 1, x=box['x'] + box['width'] / 2,
                            y=box['y'] + box['height'] / 2)

    async def touch(names):
        nonlocal active
        names = frozenset(names)
        if names == active:
            return
        # End before starting a new multi-touch combination. The game binds
        # pointerdown/up, so these travel through Chrome's native input path.
        if active:
            await session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        if names:
            await session.send('Input.dispatchTouchEvent',
                               {'type': 'touchStart', 'touchPoints': [points[n] for n in sorted(names)]})
        active = names

    started = time.monotonic()
    next_sample, changed_camera = 0, False
    first = await page.evaluate(OBSERVE)
    try:
        while time.monotonic() - started < 40:
            state = await page.evaluate(OBSERVE)
            if time.monotonic() >= next_sample:
                samples.append(state)
                next_sample = time.monotonic() + 2
            duty += state['steer']
            turn = 1 if duty > .5 else -1 if duty < -.5 else 0
            duty -= turn
            wanted = set()
            if turn:
                wanted.add('tl' if turn > 0 else 'tr')
            if state['speed'] > state['target']:
                wanted.add('tbrk')
            if state['useBoost']:
                wanted.add('tbst')
            if not changed_camera and time.monotonic() - started > 18:
                await touch({'tcam'})
                await ctl.wait(.1)
                await touch(set())
                changed_camera = True
            await touch(wanted)
            await ctl.wait(.075)
        last = await page.evaluate(OBSERVE)
        samples.append(last)
        assert last['progress'] - first['progress'] > 2800, 'Touch driving did not advance'
        assert last['camera'] == 1, 'Touch CAM control did not switch to LOW ANGLE'
    finally:
        await touch(set())
        save(page, 'touch-controls-telemetry', samples)
        await session.detach()


async def unavailable(page):
    pass


async def unavailable_play(page, ctl):
    pass


MODES = [
    Mode('kraken-three-laps-replay', entry('kraken'), full_race, seconds=245,
         note='Default medium graphics; all three laps earned with keyboard input; '
              'finish/results and RACE AGAIN, followed by at least 32s of another race. '
              'No autopilot, query shortcuts, time acceleration or state mutation.'),
    Mode('viper-low-angle', entry('viper', 2), playing('viper'), seconds=45,
         note='VIPER via visible pod carousel; camera 2 LOW ANGLE; throttle, steering, brake and boost.'),
    Mode('titan-cockpit', entry('titan', 3), playing('titan'), seconds=45,
         note='TITAN via carousel; camera 3 COCKPIT intentionally hides the player pod geometry.'),
    Mode('mantis-hero', entry('mantis', 4), playing('mantis'), seconds=45,
         note='MANTIS via carousel; camera 4 HERO faces the front of the moving pod.'),
    Mode('basalt-high', entry('basalt', 5), playing('basalt'), seconds=45,
         note='BASALT via carousel; camera 5 HIGH gives an elevated view of the same circuit.'),
    Mode('wasp-chase', entry('wasp'), playing('wasp'), seconds=45,
         note='WASP via carousel; camera 1 CHASE; fastest-handling pod.'),
    Mode('results-change-pod', entry('mantis'), results_change, seconds=245,
         note='Drive MANTIS through the full three-lap circuit to RESULTS; click CHANGE POD; '
              'choose WASP via the carousel and drive at least 32s. Results are never injected.'),
    Mode('pause-resume', entry('mantis'), pause_resume, seconds=52,
         note='Attempt Escape -> PAUSED -> RESUME and over 30s resumed driving. '
              'Known archive bug: the loop pause guard is commented out on index.html:2095; '
              'assert the timer stops after preserving evidence and exercising Resume.'),
    Mode('pause-quit-change-pod', entry('kraken'), pause_quit, seconds=50,
         note='P -> QUIT -> visible carousel -> WASP -> CHOOSE -> 33s driving.'),
    Mode('graphics-low', entry('kraken', quality='low'), playing('graphics-low'), seconds=45,
         note='Select GFX: LOW using the menu control and its real reload, then race.'),
    Mode('graphics-high', entry('kraken', quality='high'), playing('graphics-high'), seconds=45,
         note='Select GFX: HIGH using the menu control and its real reload, then race.'),
    Mode('touch-controls', touch_enter, touch_play, seconds=45,
         note='Chrome touch-device emulation enables the archive touch UI after reload. '
              'Native CDP touch events steer, brake, boost and switch camera; auto-throttle '
              'is the original touch behavior. No keyboard driving or state injection.'),
    Mode('share-result-external', unavailable, unavailable_play, reachable=False,
         unreachable_reason='Results SHARE invokes the native Web Share service, or opens '
                            'https://twitter.com/intent/tweet when navigator.share is absent. '
                            'Neither is a local gameplay path; external sharing is not attempted. '
                            'Offline results and RACE AGAIN are covered by kraken-three-laps-replay.'),
]
