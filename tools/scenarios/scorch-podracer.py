"""72 seconds of uninterrupted Wasp racing, using the verified keyboard driver.

Chase, low-angle and elevated views reveal the pod, canyon bends and rivals.
Only read-only telemetry guides input; no autopilot or race state is changed.
"""

import importlib.util
from pathlib import Path

from record import Shot


# The runner is a module, so load its sibling scenario by file path. Reuse
# only entry/input helpers: its evidence-writing play functions are not called.
_spec = importlib.util.spec_from_file_location(
    '_scorch_playthrough',
    Path(__file__).resolve().parents[1] / 'playthrough' / 'scorch-podracer.py')
_game = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_game)


async def prepare(page):
    await _game.entry('wasp', camera=1, quality='med')(page)
    # Clear the countdown and accelerate before the first recorded frame.
    await _game.Driver(page).drive(3)


async def overview(page, _cue):
    driver = _game.Driver(page)
    # Long, settled views; the game's camera eases between presets. Steering,
    # braking and straight-line boosts all use the verified real-key driver.
    for camera, seconds in ((1, 24), (2, 18), (5, 18), (1, 12)):
        await page.keyboard.press(str(camera))
        state = await driver.drive(seconds)
        assert state['phase'] == 'race' and not state['paused']
        assert state['camera'] == camera - 1


SHOTS = {
    'overview': Shot(
        url=_game.URL, module=None, serve=['scorch-podracer'],
        prepare=prepare, run=overview, overlay=False, min_fps=45,
        # Canyon straight for the poster; pickups, boost and the sunlit bend
        # stay in one settled chase view throughout the eight-second preview.
        poster_at=10, preview_at=14),
}
