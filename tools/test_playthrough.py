"""Playthrough contract tests using installed Chrome and the real Node server."""

import asyncio
import contextlib
import io
import json
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from tools import playthrough


PAGE = """<!doctype html><meta charset="utf-8"><title>Synthetic game</title>
<link rel="icon" href="data:,">
<style>html,body{margin:0;overflow:hidden}canvas{display:block}</style>
<button id="start">Start</button><div id="menu" hidden>
<button>bright</button><button>black</button><button>frozen</button><button>error</button>
<button>dim</button>
</div><canvas hidden></canvas>
<script>
const start = document.querySelector('#start'), menu = document.querySelector('#menu');
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
canvas.width = 1280; canvas.height = 720;
let mode = '', held = false;
window.inputs = {w: false, tap: false, drag: false, released: false};
start.onclick = () => { start.hidden = true; menu.hidden = false; };
for (const button of menu.querySelectorAll('button')) button.onclick = () => {
  mode = button.textContent; menu.hidden = true; canvas.hidden = false;
  if (mode === 'error') {
    console.error('synthetic console error');
    setTimeout(() => { throw Error('synthetic page error'); }, 0);
  }
};
onkeydown = e => {
  if (e.key === 'w') { held = true; inputs.w = true; }
  if (e.key === 'ArrowUp') inputs.tap = true;
};
onkeyup = e => { if (e.key === 'w') { held = false; inputs.released = true; } };
onpointermove = e => { if (e.buttons === 1) inputs.drag = true; };
function frame(t) {
  if (mode) {
    ctx.fillStyle = mode === 'black' ? '#000' : '#ddd';
    ctx.fillRect(0, 0, 1280, 720);
    if (mode === 'dim') {
      const pixels = ctx.createImageData(1280, 720);
      let seed = 12345;
      for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const value = seed >>> 31 ? 22 : 0;
        pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = value;
        pixels.data[i+3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
    }
    if (mode === 'bright' || mode === 'error') {
      ctx.fillStyle = `hsl(${t / 37 % 360} 85% 55%)`;
      ctx.fillRect(0, 0, 800, 720);
      ctx.fillStyle = held ? '#fff' : '#394880';
      ctx.fillRect(800, 0, 480, 720);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script>"""

MODULE = '''from playthrough import Mode, Controls
SERVE = ['synthetic']
URL = URL_VALUE

async def choose(page, name):
    assert await page.evaluate("innerWidth === 1280 && innerHeight === 720 && devicePixelRatio === 1")
    assert await page.evaluate("localStorage.getItem('visited') === null")
    await page.evaluate("localStorage.setItem('visited', 'yes')")
    await Controls(page).click_text('Start')
    await page.get_by_role('button', name=name, exact=True).click()
    await page.wait_for_function("document.querySelector('canvas').hidden === false")
    await page.wait_for_timeout(60)

async def bright(page): await choose(page, 'bright')
async def black(page): await choose(page, 'black')
async def frozen(page): await choose(page, 'frozen')
async def error(page): await choose(page, 'error')
async def dim(page): await choose(page, 'dim')

async def slow_enter(page):
    await bright(page)
    await page.evaluate("() => { const end = performance.now() + 2200; while (performance.now() < end) {} }")

async def block(page, ctl):
    await page.evaluate("() => { const end = performance.now() + 16000; while (performance.now() < end) {} }")

async def crash(page, ctl):
    session = await page.context.new_cdp_session(page)
    await session.send('Page.crash')

async def play(page, ctl):
    await ctl.tap('ArrowUp')
    await ctl.drag(80, 20, .08, 'left')
    await ctl.hold('w', .08)
    assert await page.evaluate('inputs.w && inputs.tap && inputs.drag && inputs.released')
    await ctl.hold('w', 60)

async def idle(page, ctl): await ctl.wait(.02)

async def forbidden(*args): raise AssertionError('UNREACHABLE WAS RUN')

async def stall(page, ctl):
    await ctl.wait(.1)
    await page.evaluate("() => { const end = performance.now() + 2200; while (performance.now() < end) {} }")

async def network(page, ctl):
    await page.evaluate("""async () => {
      fetch('/missing-file').catch(() => {});
      await fetch('https://example.invalid/blocked').catch(() => {});
      await new Promise(resolve => {
        const ws = new WebSocket('wss://example.invalid/socket');
        ws.onclose = resolve; ws.onerror = resolve;
      });
      for (let i = 0; i < 60; i++) fetch('https://example.invalid/' + i).catch(() => {});
      for (let i = 0; i < 30; i++) console.error('network-error-' + i);
    }""")
    await ctl.wait(.2)

async def missing(page): await page.get_by_text('Absent button', exact=True).click()

MODES = [Mode('bright', bright, play, seconds=5.2),
         Mode('black', black, idle, seconds=.3),
         Mode('frozen', frozen, idle, seconds=.3),
         Mode('error', error, idle, seconds=.3),
         Mode('unreachable', forbidden, forbidden, reachable=False,
              unreachable_reason='Missing multiplayer server'),
         Mode('dark', black, idle, seconds=.3, expect_dark=True),
         Mode('stall', bright, stall, seconds=2.8),
         Mode('network', bright, network, seconds=.4),
         Mode('dim-textured', dim, idle, seconds=.3),
         Mode('slow-enter', slow_enter, idle, seconds=.3),
         Mode('crashed', bright, crash, seconds=30),
         Mode('blocked', bright, block, seconds=17),
         Mode('after-block', bright, idle, seconds=.3),
         Mode('missing', missing, idle, seconds=.1)]
'''


class PlaythroughTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='gameref-playthrough-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        self.game = self.root / 'synthetic'
        (self.game / 'public').mkdir(parents=True)
        (self.game / 'public/index.html').write_text(PAGE, encoding='utf-8')
        (self.game / 'local.json').write_text(json.dumps({'port': self.port}), encoding='utf-8')
        self.module = self.root / 'tools/playthrough/synthetic.py'
        self.module.parent.mkdir(parents=True)
        self.source = MODULE.replace('URL_VALUE', repr('http://127.0.0.1:%d/' % self.port))
        self.module.write_text(self.source, encoding='utf-8')
        self.out = self.root / 'evidence'
        self.manifest = self.root / 'reports/runnability.json'

    def cli(self, *args):
        return subprocess.run([sys.executable, str(Path(playthrough.__file__)), *args,
                               '--root', str(self.root), '--out', str(self.out),
                               '--manifest', str(self.manifest)],
                              capture_output=True, text=True, timeout=90)

    def assert_exit(self, result, code):
        self.assertEqual(result.returncode, code, result.stdout + result.stderr)

    def report(self, slug='synthetic'):
        return json.loads((self.out / slug / 'run.json').read_text())

    def test_pointer_lock_shim_is_opt_in_and_preserves_errors(self):
        (self.game / 'public/index.html').write_text('''<!doctype html>
<link rel="icon" href="data:,"><button>Lock</button><script>
window.state = {shots: 0, changes: 0, errors: 0, movement: false};
const button = document.querySelector('button');
document.addEventListener('pointerlockchange', () => state.changes++);
document.addEventListener('pointerlockerror', () => {
  state.errors++;
  console.error('pointerlockerror');
});
button.onclick = () => {
  const changes = state.changes;
  const request = button.requestPointerLock();
  state.promise = request instanceof Promise;
  state.asyncChange = state.changes === changes;
};
document.addEventListener('mousedown', () => {
  if (document.pointerLockElement) state.shots++;
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement && e.isTrusted && e.movementX && e.movementY)
    state.movement = true;
});
</script>''', encoding='utf-8')
        source = self.source + '''
import json
from pathlib import Path
async def lock(page):
    await page.get_by_role('button', name='Lock').click()
    await page.wait_for_function('state.changes > 0 || state.errors > 0')

async def fire(page, ctl):
    await page.mouse.move(200, 200)
    await page.mouse.move(240, 220)
    await page.mouse.down()
    await page.mouse.up()
    await page.evaluate("""() => {
      state.locked = document.pointerLockElement === document.querySelector('button');
      document.exitPointerLock();
      state.unlocked = document.pointerLockElement === null;
    }""")
    await page.wait_for_function('state.errors > 0 || state.changes === 2')
    await page.mouse.down()
    await page.mouse.up()
    Path(__file__).with_suffix('.json').write_text(json.dumps(
        await page.evaluate('state')))
    await page.evaluate("""() => {
      console.error('unrelated console error');
      setTimeout(() => { throw Error('unrelated page error'); }, 0);
    }""")
    await page.wait_for_timeout(50)

MODES = [Mode('pointer', lock, fire, seconds=1 MODE_OPTION)]
MODULE_OPTION
'''
        for setting in ('native', 'mode', 'module'):
            with self.subTest(setting=setting):
                self.module.write_text(source.replace(
                    'MODE_OPTION', ', pointer_lock_shim=True' if setting == 'mode' else ''
                ).replace('MODULE_OPTION', 'POINTER_LOCK_SHIM = True\n'
                          if setting == 'module' else ''), encoding='utf-8')
                self.assert_exit(self.cli('synthetic'), 0)
                mode, = self.report()['modes']
                self.assertTrue(mode['entered'], mode['errors'])
                state = json.loads(self.module.with_suffix('.json').read_text())
                enabled = setting != 'native'
                self.assertEqual(state['shots'], 1 if enabled else 0)
                self.assertEqual(state['changes'], 2 if enabled else 0)
                self.assertEqual(state['locked'], enabled)
                self.assertEqual(state['movement'], enabled)
                self.assertTrue(state['unlocked'])
                self.assertTrue(state['promise'])
                self.assertTrue(state['asyncChange'])
                errors = '\n'.join(mode['errors'])
                if enabled:
                    self.assertEqual(state['errors'], 0)
                    self.assertNotIn('pointerlock', errors.lower())
                else:
                    self.assertGreater(state['errors'], 0)
                    self.assertIn('pointerlockerror', errors)
                self.assertIn('unrelated console error', errors)
                self.assertIn('unrelated page error', errors)
                self.assertIn('errors', mode['reasons'])
                expected = ['pointer-lock-shim'] if enabled else []
                self.assertEqual(mode['harness'], expected)
                summary, = json.loads(self.manifest.read_text())['games'][0]['modes']
                self.assertEqual(summary['harness'], expected)

    def test_real_chrome_modes_and_evidence(self):
        self.manifest.parent.mkdir()
        self.manifest.write_text(json.dumps({'schema_version': 1, 'games': [
            {'slug': 'zzz', 'auto_verdict': 'ok'},
            {'slug': 'synthetic', 'reviewed_verdict': 'partial', 'review_note': 'Keep human review',
             'reviewed_run_at': '2026-01-01T00:00:00Z'},
        ]}))
        result = self.cli('synthetic', 'bright', 'black', 'frozen', 'error',
                          'unreachable', 'dark', 'stall', 'network', 'dim-textured', 'slow-enter')
        self.assert_exit(result, 0)  # Issues are evidence, not runner crashes.
        report = self.report()
        modes = {mode['name']: mode for mode in report['modes']}
        self.assertEqual(modes['bright']['auto_verdict'], 'ok', modes['bright']['errors'])
        self.assertEqual(modes['bright']['failed_requests'], [])
        self.assertGreaterEqual(modes['bright']['played_seconds'], 5.2)
        self.assertEqual(len(modes['bright']['shots']), 3)
        self.assertEqual(modes['bright']['shots'][0]['time'], 0)
        self.assertAlmostEqual(modes['bright']['shots'][1]['time'], 5, delta=.8)
        self.assertTrue(modes['black']['black'])
        for name, reason in [('black', 'black'), ('frozen', 'frozen'), ('error', 'errors')]:
            self.assertEqual(modes[name]['auto_verdict'], 'issue')
            self.assertIn(reason, modes[name]['reasons'])
        self.assertFalse(modes['dim-textured']['black'])
        self.assertFalse(modes['dim-textured']['expect_dark'])
        for shot in modes['dim-textured']['shots']:
            self.assertLess(shot['mean'], 12)
            self.assertGreaterEqual(shot['std'], 6)
        self.assertGreater(modes['slow-enter']['load_stall_seconds'], 2)
        self.assertFalse(modes['slow-enter']['stall'])
        self.assertEqual(modes['slow-enter']['auto_verdict'], 'ok')
        self.assertTrue(modes['frozen']['frozen'])
        self.assertFalse(modes['frozen']['black'])
        self.assertFalse(modes['dark']['black'])
        self.assertTrue(modes['dark']['frozen'])  # expect_dark only exempts black.
        self.assertTrue(modes['stall']['stall'])
        self.assertIn('stall', modes['stall']['reasons'])
        errors = '\n'.join(modes['error']['errors'])
        self.assertIn('synthetic page error', errors)
        self.assertIn('synthetic console error', errors)
        self.assertEqual(modes['unreachable']['auto_verdict'], 'unreachable')
        self.assertFalse(modes['unreachable']['entered'])
        self.assertEqual(modes['unreachable']['reason'], 'Missing multiplayer server')
        self.assertEqual(modes['unreachable']['shots'], [])
        self.assertEqual(modes['unreachable']['errors'], [])
        self.assertEqual(len(modes['network']['errors']), 20)
        self.assertIn('https://example.invalid/blocked', modes['network']['blocked_requests'])
        self.assertIn('wss://example.invalid/socket', modes['network']['blocked_requests'])
        self.assertEqual(len(modes['network']['blocked_requests']), 50)
        self.assertEqual(modes['network']['blocked_requests_count'], 62)
        failures = modes['network']['failed_requests']
        self.assertTrue(any(failure.get('status') == 404 for failure in failures))
        self.assertTrue(any('failure' in failure and 'example.invalid' in failure['url']
                            for failure in failures))
        self.assertEqual(report['auto_verdict'], 'issue')
        for mode in report['modes']:
            for shot in mode['shots']:
                with Image.open(self.out / 'synthetic' / shot['file']) as image:
                    self.assertEqual(image.size, (1280, 720))
                    self.assertEqual(image.format, 'PNG')
            for document in mode['raf']:
                self.assertGreater(len(document['timestamps_ms']), 1)
        with Image.open(self.out / 'synthetic/sheet.jpg') as sheet:
            self.assertEqual(sheet.format, 'JPEG')
            self.assertLessEqual(sheet.width, 2400)
            self.assertGreater(sheet.height, 298)
        games = json.loads(self.manifest.read_text())['games']
        self.assertEqual([game['slug'] for game in games], ['synthetic', 'zzz'])
        self.assertEqual(games[0]['reviewed_verdict'], 'partial')
        self.assertEqual(games[0]['review_note'], 'Keep human review')
        self.assertEqual(games[0]['reviewed_run_at'], '2026-01-01T00:00:00Z')
        self.assertTrue(games[0]['review_stale'])
        self.assertEqual(len(games[0]['modes']), 10)
        self.assertFalse((self.root / 'output').exists())
        self.assertFalse((self.root / 'catalog').exists())

    def test_dry_run_validates_without_browser_or_artifacts(self):
        with patch('playwright.async_api.async_playwright', side_effect=AssertionError('browser opened')):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(playthrough.main(['synthetic', '--dry-run', '--root', str(self.root)]), 0)
        self.assert_exit(self.cli('--all', '--dry-run'), 0)
        self.assertFalse(self.manifest.exists())
        self.assertFalse(self.out.exists())

    def test_blocked_main_thread_records_failure_and_continues(self):
        result = self.cli('synthetic', 'blocked', 'after-block')
        self.assert_exit(result, 0)
        blocked, following = self.report()['modes']
        self.assertEqual(blocked['auto_verdict'], 'issue')
        self.assertIn('screenshot-failed', blocked['reasons'])
        self.assertTrue(any(error.startswith('screenshot: ') for error in blocked['errors']))
        self.assertGreater(len(blocked['shots']), 1)  # A later shot recovered.
        self.assertEqual(following['name'], 'after-block')
        self.assertTrue(following['entered'])
        self.assertTrue(following['shots'])
        self.assertEqual(len(json.loads(self.manifest.read_text())['games'][0]['modes']), 2)
        self.assertTrue((self.out / 'synthetic/sheet.jpg').exists())

    def test_page_crash_is_recorded_and_next_mode_runs(self):
        result = self.cli('synthetic', 'crashed', 'after-block')
        self.assert_exit(result, 0)
        crashed, following = self.report()['modes']
        self.assertEqual(crashed['auto_verdict'], 'issue')
        self.assertIn('crash', crashed['reasons'])
        self.assertTrue(crashed['errors'])
        self.assertTrue(following['entered'])
        self.assertTrue(self.manifest.exists())

    def browser_crash_modules(self, *, recover=False, partial=False):
        self.module.write_text(self.source + "\nMODES = [MODES[12]]\n")
        crash = '''
from pathlib import Path
async def close_browser(page, ctl):
    attempts = Path(__file__).with_suffix('.attempts')
    count = int(attempts.read_text()) if attempts.exists() else 0
    attempts.write_text(str(count + 1))
    if not RECOVER or count == 0:
        await page.context.browser.close()
MODES = PREFIX[Mode('runner', bright, close_browser, seconds=.3)]
'''.replace('RECOVER', repr(recover)).replace(
            'PREFIX', '[MODES[12]] + ' if partial else '')
        (self.module.parent / 'a-crash.py').write_text(self.source + crash)
        self.seed = dict(slug='a-crash', run_at='old', auto_verdict='ok',
                         modes=[{'name': 'previous-good-mode'}], review_note='Keep this')
        self.manifest.parent.mkdir()
        self.manifest.write_text(json.dumps({'schema_version': 1, 'games': [self.seed]}))

    def test_all_browser_disconnect_discards_retry_and_preserves_manifest(self):
        self.browser_crash_modules()
        result = self.cli('--all')
        self.assert_exit(result, 1)
        self.assertIn('runner-crash', result.stdout)
        self.assertIn('Not run: a-crash', result.stdout)
        self.assertEqual((self.module.parent / 'a-crash.attempts').read_text(), '2')
        games = json.loads(self.manifest.read_text())['games']
        self.assertEqual(games[0], self.seed)
        self.assertEqual(games[1]['slug'], 'synthetic')
        self.assertEqual(self.report('a-crash')['modes'], [])
        self.assertEqual(self.report('a-crash')['status'], 'failed')
        self.assertIn('runner-crash', self.report('a-crash')['reasons'])
        self.assertTrue(self.report()['modes'][0]['entered'])
        self.assertNotIn('crash', self.report()['modes'][0]['reasons'])
        run = json.loads((self.out / 'run.json').read_text())
        self.assertEqual(run['status'], 'failed')
        self.assertEqual(run['not_run'], ['a-crash'])
        self.assertIn('runner-crash', run['reasons'])

    def test_browser_disconnect_successful_retry_still_fails_run(self):
        self.browser_crash_modules(recover=True)
        result = self.cli('--all')
        self.assert_exit(result, 1)
        self.assertEqual((self.module.parent / 'a-crash.attempts').read_text(), '2')
        self.assertEqual(json.loads(self.manifest.read_text())['games'][0], self.seed)
        mode, = self.report('a-crash')['modes']
        self.assertTrue(mode['entered'])
        self.assertNotIn('crash', mode['reasons'])
        self.assertTrue(self.report()['modes'][0]['entered'])
        self.assertEqual(json.loads((self.out / 'run.json').read_text())['not_run'], [])

    def test_browser_disconnect_restores_manifest_after_completed_mode(self):
        self.browser_crash_modules(partial=True)
        result = self.cli('--all')
        self.assert_exit(result, 1)
        self.assertEqual(json.loads(self.manifest.read_text())['games'][0], self.seed)
        modes = self.report('a-crash')['modes']
        self.assertEqual([mode['name'] for mode in modes], ['after-block'])
        self.assertNotIn('crash', modes[0]['reasons'])

    def test_browser_relaunch_failure_stops_and_lists_remaining_games(self):
        from playwright.async_api import BrowserType

        self.browser_crash_modules()
        original_launch = BrowserType.launch
        launches = 0

        async def launch(browser_type, **kwargs):
            nonlocal launches
            launches += 1
            if launches > 1:
                raise RuntimeError('synthetic relaunch failure')
            return await original_launch(browser_type, **kwargs)

        output = io.StringIO()
        with patch.object(BrowserType, 'launch', new=launch), \
                contextlib.redirect_stdout(output):
            code = playthrough.main(['--all', '--root', str(self.root),
                                     '--out', str(self.out), '--manifest', str(self.manifest)])
        self.assertEqual(code, 1)
        self.assertEqual(launches, 2)
        self.assertEqual(json.loads(self.manifest.read_text())['games'], [self.seed])
        self.assertFalse((self.out / 'synthetic/run.json').exists())
        self.assertIn('Not run: a-crash, synthetic', output.getvalue())
        run = json.loads((self.out / 'run.json').read_text())
        self.assertEqual(run['status'], 'failed')
        self.assertEqual(run['not_run'], ['a-crash', 'synthetic'])
        self.assertIn('synthetic relaunch failure', run['runner_failures'][-1]['error'])

    def test_browser_disconnected_before_game_preserves_entry(self):
        self.browser_crash_modules()
        (self.module.parent / 'a-crash.py').write_text(
            self.source + '\nMODES = [MODES[12]]\n')
        skipped = dict(slug='synthetic', auto_verdict='ok', modes=[{'name': 'old'}])
        self.manifest.write_text(json.dumps({'games': [self.seed, skipped]}))
        original_run = playthrough.run_game

        async def run_game(runner, module, slug, names, args):
            report = await original_run(runner, module, slug, names, args)
            await runner.browser.close()
            return report

        output = io.StringIO()
        with patch.object(playthrough, 'run_game', side_effect=run_game), \
                contextlib.redirect_stdout(output):
            code = playthrough.main(['--all', '--root', str(self.root),
                                     '--out', str(self.out), '--manifest', str(self.manifest)])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(self.manifest.read_text())['games'][1], skipped)
        self.assertFalse((self.out / 'synthetic/run.json').exists())
        self.assertIn('synthetic: runner-crash', output.getvalue())
        self.assertIn('Not run: synthetic', output.getvalue())

    def test_metric_failure_recovers_and_results_are_written_after_each_mode(self):
        original_metrics = playthrough.image_metrics
        original_run = playthrough.run_mode
        calls = 0

        def metrics(*args):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise ValueError('synthetic metric failure')
            return original_metrics(*args)

        async def run_mode(browser, url, mode, directory):
            if mode.name == 'frozen':
                partial = self.report()['modes']
                self.assertEqual([entry['name'] for entry in partial], ['black'])
                self.assertEqual(partial[0]['auto_verdict'], 'issue')
                self.assertIn('screenshot-failed', partial[0]['reasons'])
                self.assertEqual(len(json.loads(self.manifest.read_text())['games'][0]['modes']), 1)
                self.assertTrue((directory / 'sheet.jpg').exists())
            return await original_run(browser, url, mode, directory)

        with patch.object(playthrough, 'image_metrics', side_effect=metrics), \
                patch.object(playthrough, 'run_mode', side_effect=run_mode), \
                contextlib.redirect_stdout(io.StringIO()):
            code = playthrough.main(['synthetic', 'black', 'frozen', '--root', str(self.root),
                                     '--out', str(self.out), '--manifest', str(self.manifest)])
        self.assertEqual(code, 0)
        first, second = self.report()['modes']
        self.assertIn('screenshot: synthetic metric failure', first['errors'])
        self.assertEqual(len(first['shots']), 1)
        self.assertEqual(len(second['shots']), 2)

    def test_dry_run_rejects_duplicate_names(self):
        self.module.write_text(self.source + '\nMODES.append(MODES[0])\n')
        result = self.cli('synthetic', '--dry-run')
        self.assert_exit(result, 1)
        self.assertIn('Duplicate mode name', result.stderr)

    def test_dry_run_rejects_missing_local_json(self):
        (self.game / 'local.json').unlink()
        result = self.cli('synthetic', '--dry-run')
        self.assert_exit(result, 1)
        self.assertIn('local.json', result.stderr)

    def test_dry_run_rejects_other_invalid_contracts(self):
        cases = [("\nURL = 'http://127.0.0.1:1/'", 'URL port'),
                 ("\nURL = 'http://localhost.evil:1234/'", 'local HTTP'),
                 ("\nMODES = []", 'non-empty list'),
                 ("\nMODES[0].play = lambda p, c: None", 'coroutine function'),
                 ("\nMODES[0].name = '../escape'", 'Invalid mode name'),
                 ("\nMODES[0].seconds = float('nan')", 'positive and finite'),
                 ("\nMODES[0].pointer_lock_shim = 'yes'", 'pointer_lock_shim must be a bool'),
                 ("\nPOINTER_LOCK_SHIM = 'yes'", 'POINTER_LOCK_SHIM must be a bool'),
                 ("\nSERVE = ['../outside']", 'Invalid SERVE folder')]
        for suffix, error in cases:
            with self.subTest(error=error):
                self.module.write_text(self.source + suffix)
                result = self.cli('synthetic', '--dry-run')
                self.assert_exit(result, 1)
                self.assertIn(error, result.stderr)
        self.module.write_text(self.source)
        result = self.cli('synthetic', 'nonexistent', '--dry-run')
        self.assert_exit(result, 1)
        self.assertIn('Unknown modes', result.stderr)

    def test_dry_run_validates_entry_budgets(self):
        for index, value in enumerate(('10', '12.5', '90', '900', '9.9', '900.1',
                                       "float('nan')", "float('inf')", "float('-inf')",
                                       'True', 'None', "'120'")):
            valid = value in ('10', '12.5', '90', '900')
            with self.subTest(value=value):
                # Distinct file sizes invalidate bytecode even when these
                # subprocess imports occur within the same timestamp second.
                self.module.write_text(self.source + '\nMODES[0].enter_seconds = '
                                       + value + '\n' + '#' * (index * 32))
                result = self.cli('synthetic', '--dry-run')
                self.assert_exit(result, 0 if valid else 1)
                if not valid:
                    self.assertIn('enter_seconds must be finite and within 10..900', result.stderr)
        self.assertFalse(self.out.exists())
        self.assertFalse(self.manifest.exists())

    def test_entry_budget_override_allows_slow_entry(self):
        self.assertEqual(playthrough.Mode('default', None, None).enter_seconds, 90)
        self.module.write_text(self.source + '''
import asyncio
async def long_entry(page):
    await bright(page)
    await asyncio.sleep(11)
MODES = [Mode('default-budget', long_entry, play, seconds=.3),
         Mode('extended-budget', long_entry, play, seconds=.3, enter_seconds=12)]
''')
        # Scale the default down while retaining the production validation
        # bounds: the identical eleven-second route exceeds 10 but fits in 12.
        with patch.object(playthrough, 'ENTER_TIMEOUT', 10):
            with contextlib.redirect_stdout(io.StringIO()):
                code = playthrough.main(['synthetic', '--root', str(self.root),
                                        '--out', str(self.out), '--manifest', str(self.manifest)])
        self.assertEqual(code, 0)
        mode, extended = self.report()['modes']
        self.assertFalse(mode['entered'])
        self.assertEqual(mode['enter_seconds'], 10)
        self.assertEqual(mode['auto_verdict'], 'issue')
        self.assertIn('enter failed', mode['reasons'])
        self.assertIn('enter: TimeoutError', mode['errors'])
        self.assertTrue(extended['entered'])
        self.assertEqual(extended['enter_seconds'], 12)
        self.assertEqual(extended['auto_verdict'], 'ok')
        self.assertGreaterEqual(extended['played_seconds'], .3)
        self.assertEqual(extended['errors'], [])
        summary = json.loads(self.manifest.read_text())['games'][0]['modes']
        self.assertEqual([entry['enter_seconds'] for entry in summary], [10, 12])

    def test_all_continues_after_crashed_module(self):
        (self.module.parent / 'a-broken.py').write_text("raise RuntimeError('broken module')")
        self.module.write_text(self.source + "\nMODES = [MODES[4]]\n")
        result = self.cli('--all')
        self.assert_exit(result, 1)
        self.assertIn('a-broken: run crashed: broken module', result.stderr)
        self.assertEqual(self.report()['auto_verdict'], 'unreachable')
        self.assertTrue((self.out / 'synthetic/sheet.jpg').exists())
        result = self.cli('synthetic')
        self.assert_exit(result, 0)
        self.assertEqual(len(json.loads(self.manifest.read_text())['games']), 1)

    def test_existing_server_identity_is_checked(self):
        other = self.root / 'other'
        (other / 'public').mkdir(parents=True)
        (other / 'local.json').write_text(json.dumps({'port': self.port}))
        (other / 'public/index.html').write_text('Different game')
        self.module.write_text(self.source.replace("SERVE = ['synthetic']", "SERVE = ['other']"))

        async def run():
            async with playthrough.servers(self.root, ['synthetic']):
                return await asyncio.to_thread(self.cli, 'synthetic', 'unreachable')

        result = asyncio.run(run())
        self.assert_exit(result, 1)
        self.assertIn('SHA-256 mismatch', result.stderr)
        self.assertFalse(self.manifest.exists())

    def test_metrics_and_origin_boundaries(self):
        png = io.BytesIO()
        Image.new('RGB', (4, 4), 'black').save(png, format='PNG')
        first, previous = playthrough.image_metrics(png.getvalue())
        self.assertEqual(first, {'mean': 0, 'std': 0, 'diff': None})
        png = io.BytesIO()
        Image.new('RGB', (4, 4), 'white').save(png, format='PNG')
        second, _ = playthrough.image_metrics(png.getvalue(), previous)
        self.assertEqual(second, {'mean': 255, 'std': 0, 'diff': 255})
        for url in ('http://127.0.0.1:4000/', 'http://localhost:4000/', 'ws://localhost:4000/'):
            self.assertTrue(playthrough.local_url(url))
        for url in ('http://localhost.evil:4000/', 'http://localhost@evil:4000/',
                    'http://evil@localhost:4000/', 'file:///etc/passwd',
                    'http://127.0.0.1:99999/', 'https://example.com/'):
            self.assertFalse(playthrough.local_url(url))


class VerdictTests(unittest.TestCase):
    def result(self, shots=None, errors=None, raf=None, start=1000):
        return dict(entered=True, shots=shots or [], errors=errors or [],
                    raf=raf or [], play_started_at_ms=start)

    def shot(self, mean=100, std=10, diff=None):
        return dict(mean=mean, std=std, diff=diff)

    def test_each_issue_has_matching_reason(self):
        cases = {
            'black': self.result(shots=[self.shot(0, 0)]),
            'frozen': self.result(shots=[self.shot(diff=.1)]),
            'errors': self.result(errors=['synthetic error']),
            'stall': self.result(raf=[dict(time_origin=0, timestamps_ms=[1000, 4001], end_ms=4010)]),
        }
        for reason, result in cases.items():
            with self.subTest(reason=reason):
                playthrough.verdict(result)
                self.assertEqual(result['auto_verdict'], 'issue')
                self.assertEqual(result['reasons'], [reason])

    def test_black_majority_and_texture_boundaries(self):
        for shots, black in [([self.shot(0, 0), self.shot()], True),
                             ([self.shot(0, 0), self.shot(), self.shot()], False),
                             ([self.shot(8, 10)], False)]:
            with self.subTest(shots=shots):
                result = self.result(shots=shots)
                playthrough.verdict(result)
                self.assertEqual(result['black'], black)
                self.assertEqual(result['auto_verdict'], 'issue' if black else 'ok')

    def test_frozen_requires_all_diffs_below_threshold(self):
        for diffs, frozen in [([.1, 5], False), ([0, .1, .49], True), ([.1, .5], False)]:
            with self.subTest(diffs=diffs):
                result = self.result(shots=[self.shot()] + [self.shot(diff=diff) for diff in diffs])
                playthrough.verdict(result)
                self.assertEqual(result['frozen'], frozen)
                self.assertEqual(result['auto_verdict'], 'issue' if frozen else 'ok')

    def test_loading_gap_is_informational_and_boundary_is_clipped(self):
        result = self.result(start=4000, raf=[
            dict(time_origin=0, timestamps_ms=[0, 3000], end_ms=3500),
            dict(time_origin=3500, timestamps_ms=[0, 1000, 1100], end_ms=1200)])
        playthrough.verdict(result)
        self.assertEqual(result['load_stall_seconds'], 3)
        self.assertEqual(result['raf'][1]['max_gap_ms'], 500)
        self.assertFalse(result['stall'])
        self.assertEqual(result['auto_verdict'], 'ok')

    def test_review_staleness_tracks_reviewed_run(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'runnability.json'
            for reviewed_at, stale in [('old', True), ('new', False)]:
                manifest.write_text(json.dumps({'games': [dict(slug='game', reviewed_verdict='ok',
                    review_note='Human review', reviewed_run_at=reviewed_at, review_stale=True)]}))
                playthrough.upsert(manifest, dict(slug='game', run_at='new', auto_verdict='ok', modes=[]))
                entry = json.loads(manifest.read_text())['games'][0]
                self.assertEqual(entry['reviewed_verdict'], 'ok')
                self.assertEqual(entry['review_note'], 'Human review')
                self.assertEqual(entry['reviewed_run_at'], reviewed_at)
                self.assertEqual(entry['review_stale'], stale)


if __name__ == '__main__':
    unittest.main()
