"""Native 210-second film loop and camera/player controls; observations are read-only."""
import asyncio
import json
import time
from pathlib import Path
from playthrough import Mode

SERVE = ['tupi']
URL = 'http://127.0.0.1:8106/demos/tupi/index.html'
OBSERVE = """() => ({time:__tupi.getTime(), paused:__tupi.isPaused(),
  backend:__tupi.ctx.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2',
  camera:__tupi.ctx.camera.position.toArray(), fov:__tupi.ctx.camera.fov,
  modules:Object.keys(__tupi.ctx.modules),
  note:document.querySelector('.tp-note')?.innerText,
  titleOpacity:document.querySelector('.tp-title')?.style.opacity})"""


def save(page, name, data):
    directory = getattr(page, '_playthrough_directory',
                        Path(__file__).resolve().parents[2] / 'output/playthrough/tupi')
    directory.mkdir(parents=True, exist_ok=True)
    (directory / (name + '.json')).write_text(json.dumps(data, indent=2) + '\n')


async def enter(page):
    await page.wait_for_function('window.__tupi && __tupi.ctx.modules.overlay')
    await page.locator('#loading').wait_for(state='hidden')
    # The original app loads and compiles fauna after first paint. Treat that
    # work as entry, so full-loop evidence starts after all world modules exist.
    await page.wait_for_function("['fauna','birds','smoke'].every(k => __tupi.ctx.modules[k])")
    await asyncio.sleep(5)
    await page.locator('#stage canvas').click(position={'x':640, 'y':360})
    assert (await page.evaluate(OBSERVE))['backend'] == 'WebGPU'
    assert not await page.evaluate('__tupi.isPaused()')


async def cinematic(page, ctl):
    samples = []
    previous = await page.evaluate('__tupi.getTime()')
    progress = 0
    start = time.monotonic()
    try:
        while progress < 210:
            await ctl.wait(2)
            state = await page.evaluate(OBSERVE)
            assert not state['paused']
            progress += (state['time'] - previous) % 210
            previous = state['time']
            samples.append(state)
            assert time.monotonic() - start < 228, 'Film did not complete a natural loop'
        assert any(s['time'] >= 200 for s in samples), 'Closing title not reached'
        assert len({s['note'] for s in samples if s['note']}) >= 9, 'Missing caption beats'
    finally:
        save(page, 'cinematic-telemetry', {'natural_seconds':progress, 'samples':samples})


async def interactive(page, ctl):
    samples = [await page.evaluate(OBSERVE)]
    try:
        # Pause through the real keyboard so a camera movement can be measured
        # independently of the authored tracking shot.
        await ctl.tap('Space')
        assert await page.evaluate('__tupi.isPaused()')
        before = await page.evaluate(OBSERVE)
        await ctl.drag(180, -45, 2)
        await page.mouse.wheel(0, -280)
        await ctl.wait(2)
        after = await page.evaluate(OBSERVE)
        assert after['time'] == before['time']
        assert sum(abs(a-b) for a,b in zip(before['camera'],after['camera'])) > .1
        samples.extend([before,after])
        await page.mouse.dblclick(640,360)
        await ctl.wait(2)
        await ctl.tap('ArrowRight')
        assert abs(await page.evaluate('__tupi.getTime()') - before['time'] - 5) < .01
        await ctl.tap('ArrowLeft')
        await ctl.tap('Space')
        for dx, dy, wheel in [(100,25,160),(-160,-20,-160),(60,10,80)]:
            await ctl.drag(dx,dy,2)
            await page.mouse.wheel(0,wheel)
            await ctl.wait(7)
            samples.append(await page.evaluate(OBSERVE))
        await page.mouse.dblclick(640,360)
        await ctl.wait(3)
        assert not await page.evaluate('__tupi.isPaused()')
    finally:
        save(page,'interactive-camera-telemetry',samples)


MODES = [
    Mode('cinematic',enter,cinematic,seconds=235,
         note='Complete natural 210-second loop, all nine captions and closing title; click enables sound. The local views counter returns 405.',enter_seconds=180),
    Mode('interactive-camera',enter,interactive,seconds=45,
         note='Drag orbit, wheel zoom, double-click recenter, native pause/resume and +/-5-second seeking. No capture/debug query or state mutation.',enter_seconds=180),
]


def require_completion(play):
    async def checked(page,ctl):
        page.set_default_timeout(8000)
        try:
            await play(page,ctl)
        except asyncio.CancelledError as error:
            raise AssertionError('Input script did not finish within the mode budget') from error
    return checked


for mode in MODES:
    mode.play=require_completion(mode.play)
