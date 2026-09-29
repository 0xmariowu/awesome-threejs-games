"""72 seconds of driving in the original rainy city, with native camera changes."""
import importlib.util
from pathlib import Path
from record import Shot

_spec=importlib.util.spec_from_file_location('_punk_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough/threejs-punk.py')
_game=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_game)

async def prepare(page):
    page.set_default_timeout(180000)
    await _game.enter(page)
    await _game.Driver(page).drive(3)

async def overview(page,_cue):
    driver=_game.Driver(page)
    await driver.drive(30)
    await page.keyboard.press('c')
    await driver.drive(24)
    await page.keyboard.press('c')
    await driver.drive(18)

SHOTS={'overview':Shot(url=_game.URL,module=None,serve=_game.SERVE,
    prepare=prepare,run=overview,overlay=False,poster_at=6,preview_at=8)}
