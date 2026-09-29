"""72 seconds of the original moving fleet; native input, no recording overlay."""
import asyncio
import importlib.util
from pathlib import Path
from record import Shot

_spec = importlib.util.spec_from_file_location('_tupi_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough/tupi.py')
_game = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_game)

async def prepare(page):
    page.set_default_timeout(180000)
    await _game.enter(page)
    await page.wait_for_function('__tupi.getTime() >= 14')

async def overview(page, _cue):
    await asyncio.sleep(30)
    await page.mouse.move(640,360)
    await page.mouse.down()
    await page.mouse.move(700,350,steps=40)
    await page.mouse.up()
    await asyncio.sleep(12)
    await page.mouse.dblclick(640,360)
    await asyncio.sleep(30)

SHOTS = {'overview': Shot(url=_game.URL,module=None,serve=_game.SERVE,
    prepare=prepare,run=overview,overlay=False,poster_at=8,preview_at=8)}
