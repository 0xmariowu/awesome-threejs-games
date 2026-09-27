#!/usr/bin/env python3
"""Run local game modes and collect evidence for human review.

Modules in tools/playthrough/<slug>.py export SERVE, URL and a list of Mode
objects. enter(page) uses game menus; play(page, ctl) supplies gameplay input.
Opt into test-only pointer lock emulation with POINTER_LOCK_SHIM = True on
the module or pointer_lock_shim=True on a Mode; results label its use.
Automatic verdicts are diagnostics, not a certification of complete gameplay.
"""

import argparse
import asyncio
import importlib.util
import inspect
import io
import json
import math
import re
import sys
import time
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

if __package__:
    from .record import CHROME_ARGS, ROOT, server_folder, server_port, servers, write_manifest
else:
    from record import CHROME_ARGS, ROOT, server_folder, server_port, servers, write_manifest

# Modules use this name both when the CLI is executed and when imported by tests.
sys.modules.setdefault('playthrough', sys.modules[__name__])
NAME = re.compile(r'[a-zA-Z0-9][a-zA-Z0-9_-]*\Z')
ENTER_TIMEOUT = 90.0
SHOT_INTERVAL = 5
SUMMARY_FIELDS = ('name', 'entered', 'seconds', 'enter_seconds', 'black', 'frozen', 'stall',
                  'errors', 'failed_requests', 'reason', 'auto_verdict',
                  'load_stall_seconds', 'harness')


@dataclass
class Mode:
    name: str
    enter: object
    play: object
    seconds: float = 30
    note: str = ''
    expect_dark: bool = False
    reachable: bool = True
    unreachable_reason: str = ''
    pointer_lock_shim: bool = False
    enter_seconds: float = field(default_factory=lambda: ENTER_TIMEOUT)


class RunnerCrash(RuntimeError):
    """The browser process failed; no game verdict can be inferred."""


class RunnerUnavailable(RuntimeError):
    """Chrome could not be launched; stop instead of labeling more games."""


def check_browser(browser):
    if not browser.is_connected():
        raise RunnerCrash('Browser disconnected')


class BrowserRunner:
    def __init__(self, chromium):
        self.chromium = chromium
        self.browser = None
        self.failures = []

    def failure(self, slug, mode, error):
        self.failures.append(dict(slug=slug, mode=mode, reason='runner-crash', error=str(error)))
        print(slug + ('/' + mode if mode else '') + ': runner-crash: ' + str(error), flush=True)

    async def launch(self, slug):
        try:
            self.browser = await self.chromium.launch(
                headless=True, channel='chrome', args=CHROME_ARGS)
            check_browser(self.browser)
        except Exception as error:
            self.failure(slug, None, error)
            raise RunnerUnavailable(str(error)) from error


def local_url(url):
    try:
        parsed = urlsplit(url)
        return (parsed.scheme in ('http', 'https', 'ws', 'wss')
                and parsed.hostname in ('127.0.0.1', 'localhost')
                and parsed.username is None and parsed.password is None
                and (parsed.port is None or 0 < parsed.port < 65536))
    except ValueError:
        return False


def load_module(root, slug):
    if not NAME.fullmatch(slug):
        raise ValueError('Invalid project slug: ' + slug)
    path = root / 'tools/playthrough' / (slug + '.py')
    spec = importlib.util.spec_from_file_location('_gameref_playthrough_' + slug, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    validate(module, root)
    return module


def validate(module, root):
    errors, ports = [], []
    if type(getattr(module, 'POINTER_LOCK_SHIM', False)) is not bool:
        errors.append('POINTER_LOCK_SHIM must be a bool')
    folders = getattr(module, 'SERVE', None)
    if not isinstance(folders, list) or not folders:
        errors.append('SERVE must be a non-empty list')
    else:
        for folder in folders:
            try:
                ports.append(server_port(server_folder(root, folder)))
            except (OSError, ValueError, TypeError) as error:
                errors.append('Invalid SERVE folder: ' + str(error))
        if len(set(ports)) != len(ports):
            errors.append('SERVE folders must have distinct ports')
    url = getattr(module, 'URL', None)
    if not isinstance(url, str) or not local_url(url) or urlsplit(url).scheme != 'http':
        errors.append('URL must be local HTTP')
    elif urlsplit(url).port not in ports:
        errors.append('URL port must match a SERVE folder local.json port')
    modes = getattr(module, 'MODES', None)
    if not isinstance(modes, list) or not modes:
        errors.append('MODES must be a non-empty list')
    else:
        seen = set()
        for mode in modes:
            if not isinstance(mode, Mode):
                errors.append('Each mode must be a Mode')
                continue
            if not isinstance(mode.name, str) or not NAME.fullmatch(mode.name):
                errors.append('Invalid mode name: ' + repr(mode.name))
            elif mode.name in seen:
                errors.append('Duplicate mode name: ' + mode.name)
            else:
                seen.add(mode.name)
            for field in ('enter', 'play'):
                if not inspect.iscoroutinefunction(getattr(mode, field)):
                    errors.append(str(mode.name) + ': ' + field + ' must be a coroutine function')
            if (type(mode.seconds) not in (int, float) or not math.isfinite(mode.seconds)
                    or mode.seconds <= 0):
                errors.append(str(mode.name) + ': seconds must be positive and finite')
            if (type(mode.enter_seconds) not in (int, float)
                    or not math.isfinite(mode.enter_seconds)
                    or not 10 <= mode.enter_seconds <= 900):
                errors.append(str(mode.name) + ': enter_seconds must be finite and within 10..900')
            for field in ('reachable', 'expect_dark', 'pointer_lock_shim'):
                if type(getattr(mode, field)) is not bool:
                    errors.append(str(mode.name) + ': ' + field + ' must be a bool')
            for field in ('note', 'unreachable_reason'):
                if not isinstance(getattr(mode, field), str):
                    errors.append(str(mode.name) + ': ' + field + ' must be text')
            if not mode.reachable and not mode.unreachable_reason:
                errors.append(str(mode.name) + ': unreachable modes need a reason')
    if errors:
        raise ValueError('\n'.join(errors))


class Controls:
    def __init__(self, page):
        self.page = page

    async def wait(self, s):
        await asyncio.sleep(s)

    async def hold(self, key, s):
        await self.page.keyboard.down(key)
        try:
            await self.wait(s)
        finally:
            await self.page.keyboard.up(key)

    async def tap(self, key):
        await self.page.keyboard.press(key)

    async def click_text(self, text):
        await self.page.get_by_text(text, exact=True).click()

    async def drag(self, dx, dy, s, button='left'):
        """Drag from the viewport centre, interpolating over s seconds."""
        x, y = 640, 360
        await self.page.mouse.move(x, y)
        await self.page.mouse.down(button=button)
        start = time.monotonic()
        steps = max(1, math.ceil(s * 30))
        try:
            for step in range(1, steps + 1):
                await self.wait(max(0, start + s * step / steps - time.monotonic()))
                await self.page.mouse.move(x + dx * step / steps, y + dy * step / steps)
        finally:
            await self.page.mouse.up(button=button)


RAF_SCRIPT = """(() => {
  if (window !== window.top) return;
  const stamps = [performance.now()];
  window.__playthroughRAF = () => ({url: location.href,
    time_origin: performance.timeOrigin, timestamps_ms: stamps, end_ms: performance.now()});
  function frame(t) { stamps.push(t); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  addEventListener('pagehide', () => window.__playthroughFrames(window.__playthroughRAF()));
})();"""


POINTER_LOCK_SCRIPT = """(() => {
  // Test harness only: keep mouse movement supplied by Chrome's real input.
  let lockedElement = null;
  const changed = () => setTimeout(() => {
    document.dispatchEvent(new Event('pointerlockchange'));
  }, 0);
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get() { return lockedElement; }
  });
  Element.prototype.requestPointerLock = function() {
    lockedElement = this;
    changed();
    return Promise.resolve();
  };
  Document.prototype.exitPointerLock = function() {
    lockedElement = null;
    changed();
  };
})();"""


def image_metrics(png, previous=None):
    from PIL import Image, ImageChops, ImageStat

    with Image.open(io.BytesIO(png)) as image:
        luminance = image.convert('L')
    stats = ImageStat.Stat(luminance)
    difference = (ImageStat.Stat(ImageChops.difference(luminance, previous)).mean[0]
                  if previous is not None else None)
    return {'mean': stats.mean[0], 'std': stats.stddev[0], 'diff': difference}, luminance


def verdict(result, expect_dark=False):
    shots = result['shots']
    result['black'] = bool(shots) and not expect_dark and sum(
        shot['mean'] < 12 and shot['std'] < 6 for shot in shots) >= len(shots) / 2
    diffs = [shot['diff'] for shot in shots if shot['diff'] is not None]
    result['frozen'] = bool(diffs) and all(diff < 0.5 for diff in diffs)
    load_gap = play_gap = 0
    play_start = result.get('play_started_at_ms', math.inf)
    for document in result['raf']:
        stamps = document['timestamps_ms'] + [document['end_ms']]
        boundary = play_start - document['time_origin']
        gaps = list(zip(stamps, stamps[1:]))
        document['max_gap_ms'] = max((max(0, b - max(a, boundary))
                                      for a, b in gaps), default=0)
        load_gap = max(load_gap, max((max(0, min(b, boundary) - a)
                                     for a, b in gaps), default=0))
        play_gap = max(play_gap, document['max_gap_ms'])
    result['load_stall_seconds'] = load_gap / 1000
    result['stall'] = play_gap > 2000
    reasons = ([] if result['entered'] else ['enter failed'])
    reasons.extend(flag for flag in ('black', 'frozen', 'stall', 'errors') if result[flag])
    reasons.extend(flag for flag in ('screenshot-failed', 'crash')
                   if flag in result.get('reasons', []))
    result['reasons'] = reasons
    result['reason'] = '; '.join(reasons)
    result['auto_verdict'] = 'issue' if reasons else 'ok'


async def run_mode(browser, url, mode, directory):
    check_browser(browser)
    result = dict(name=mode.name, entered=False, seconds=mode.seconds,
                  enter_seconds=mode.enter_seconds, note=mode.note,
                  expect_dark=mode.expect_dark, reachable=mode.reachable,
                  unreachable_reason=mode.unreachable_reason, black=False, frozen=False,
                  stall=False, load_stall_seconds=0, errors=[], failed_requests=[],
                  blocked_requests=[], blocked_requests_count=0,
                  shots=[], raf=[], harness=[], reasons=[], reason='', auto_verdict='unreachable')
    if not mode.reachable:
        result.update(reason=mode.unreachable_reason, reasons=[mode.unreachable_reason])
        return result
    context = page = None
    task = None
    crashed = asyncio.Event()
    disconnected = asyncio.Event()

    def on_crash(*_):
        crashed.set()

    def on_disconnect(*_):
        disconnected.set()
        crashed.set()

    def check_crash():
        check_browser(browser)
        if crashed.is_set() or (page and page.is_closed()):
            if 'crash' not in result['reasons']:
                result['reasons'].append('crash')
            raise RuntimeError('Browser/page crashed or closed during ' + mode.name)

    def append(field, item):
        if len(result[field]) < 20:
            result[field].append(item)

    def blocked(url):
        result['blocked_requests_count'] += 1
        if len(result['blocked_requests']) < 50:
            result['blocked_requests'].append(url)
            print(mode.name + ' blocked: ' + url, flush=True)

    async def route(route):
        if local_url(route.request.url):
            await route.continue_()
        else:
            blocked(route.request.url)
            await route.abort()

    async def websocket(ws):
        if local_url(ws.url):
            ws.connect_to_server()
        else:
            blocked(ws.url)
            await ws.close()

    try:
        browser.on('disconnected', on_disconnect)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720},
                                            device_scale_factor=1, service_workers='block')
        await context.route('**/*', route)
        await context.route_web_socket('**/*', websocket)
        await context.expose_binding('__playthroughFrames',
                                     lambda source, data: result['raf'].append(data))
        await context.add_init_script(script=RAF_SCRIPT)
        if mode.pointer_lock_shim:
            await context.add_init_script(script=POINTER_LOCK_SCRIPT)
            result['harness'].append('pointer-lock-shim')
        page = await context.new_page()
        # Let module-specific diagnostic screenshots honor --out as well.
        page._playthrough_directory = directory
        page.on('crash', on_crash)
        page.on('close', on_crash)
        page.on('pageerror', lambda error: append('errors', str(error)))
        page.on('console', lambda message: append('errors', message.text)
                if message.type == 'error' else None)
        context.on('response', lambda response: append('failed_requests', {
            'url': response.url, 'status': response.status})
            if local_url(response.url) and not 200 <= response.status < 400 else None)
        context.on('requestfailed', lambda request: append('failed_requests', {
            'url': request.url, 'failure': request.failure}))
        # Include navigation and UI entry in one wall-clock budget. Playwright's
        # default 30-second action timeout must not shorten a slow game's entry.
        page.set_default_timeout(mode.enter_seconds * 1000)

        async def enter():
            await page.goto(url, wait_until='domcontentloaded', timeout=mode.enter_seconds * 1000)
            await mode.enter(page)

        try:
            await asyncio.wait_for(enter(), mode.enter_seconds)
            result['entered'] = True
            result['play_started_at_ms'] = time.time() * 1000
        except Exception as error:
            append('errors', 'enter: ' + (str(error) or type(error).__name__))

        previous = None

        async def shot(seconds):
            nonlocal previous
            check_crash()
            path = directory / ('%s-%02d.png' % (mode.name, len(result['shots'])))
            try:
                png = await page.screenshot(path=str(path), type='png', full_page=False, timeout=10000)
                metrics, previous = image_metrics(png, previous)
                result['shots'].append(dict(file=path.name, time=seconds, **metrics))
            except Exception as error:
                # Evidence collection must not stop the remaining shots or modes.
                result['errors'].append('screenshot: ' + (str(error) or type(error).__name__))
                if 'screenshot-failed' not in result['reasons']:
                    result['reasons'].append('screenshot-failed')
                check_crash()

        if result['entered']:
            await shot(0)

            async def play():
                try:
                    await mode.play(page, Controls(page))
                except Exception as error:
                    append('errors', 'play: ' + (str(error) or type(error).__name__))

            async def bounded_play():
                try:
                    await asyncio.wait_for(play(), mode.seconds)
                except asyncio.TimeoutError:
                    pass  # The runner owns the duration, including endless input loops.

            start = time.monotonic()
            task = asyncio.create_task(bounded_play())
            # Include the endpoint so short modes still have a meaningful diff.
            targets = [i * SHOT_INTERVAL for i in range(1, math.ceil(mode.seconds / SHOT_INTERVAL))]
            targets.append(mode.seconds)
            for target in targets:
                try:
                    await asyncio.wait_for(crashed.wait(), max(0, start + target - time.monotonic()))
                except asyncio.TimeoutError:
                    pass
                await shot(time.monotonic() - start)
            await task
            result['played_seconds'] = time.monotonic() - start
        else:
            await shot(0)
        try:
            data = await asyncio.wait_for(page.evaluate('window.__playthroughRAF?.()'), 5)
            if data:
                result['raf'].append(data)
            else:
                append('errors', 'rAF monitor unavailable')
        except Exception as error:
            append('errors', 'rAF readback: ' + (str(error) or type(error).__name__))
        check_crash()
    except Exception as error:
        if not browser.is_connected():
            raise RunnerCrash('Browser disconnected during ' + mode.name) from error
        if crashed.is_set():
            if 'crash' not in result['reasons']:
                result['reasons'].append('crash')
        result['errors'].append('mode: ' + (str(error) or type(error).__name__))
    finally:
        # Browser shutdown closes pages before emitting "disconnected". Let
        # that event arrive before canceling play() or publishing a page crash.
        if crashed.is_set() and browser.is_connected():
            try:
                await asyncio.wait_for(disconnected.wait(), 1)
            except asyncio.TimeoutError:
                pass
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        browser.remove_listener('disconnected', on_disconnect)
        if context is not None:
            try:
                await context.close()
            except Exception as error:
                result['errors'].append('context close: ' + str(error))
    check_browser(browser)
    verdict(result, mode.expect_dark)
    return result


def contact_sheet(directory, modes):
    from PIL import Image, ImageDraw

    tiles = [(mode['name'], shot) for mode in modes for shot in mode['shots']]
    # Include an explanatory tile even when every mode is unreachable.
    width, height = 480, 298
    columns = min(5, max(1, len(tiles)))
    sheet = Image.new('RGB', (columns * width, max(1, math.ceil(len(tiles) / columns)) * height), '#202020')
    draw = ImageDraw.Draw(sheet)
    for index, (name, shot) in enumerate(tiles):
        x, y = index % columns * width, index // columns * height
        with Image.open(directory / shot['file']) as image:
            sheet.paste(image.convert('RGB').resize((width, 270)), (x, y))
        draw.text((x + 8, y + 276), '%s | %.1fs' % (name, shot['time']), fill='white')
    if not tiles:
        draw.text((8, 8), 'No screenshots: see run.json for mode reasons.', fill='white')
    sheet.save(directory / 'sheet.jpg', quality=90)


def worst(modes):
    """An observed issue outranks unreachable; unreachable outranks ok."""
    return max((mode['auto_verdict'] for mode in modes),
               key={'ok': 0, 'unreachable': 1, 'issue': 2}.__getitem__)


def upsert(manifest, report):
    data = (json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists()
            else {'schema_version': 1, 'games': []})
    entry = {key: report[key] for key in ('slug', 'run_at', 'auto_verdict')}
    entry['modes'] = [{key: mode[key] for key in SUMMARY_FIELDS} for mode in report['modes']]
    old = next((game for game in data['games'] if game['slug'] == entry['slug']), {})
    for key in ('reviewed_verdict', 'review_note', 'reviewed_run_at'):
        if key in old:
            entry[key] = old[key]
    if 'reviewed_run_at' in old:
        entry['review_stale'] = old['reviewed_run_at'] != entry['run_at']
    data['schema_version'] = 1
    data['games'] = sorted([game for game in data['games'] if game['slug'] != entry['slug']] + [entry],
                           key=lambda game: game['slug'])
    write_manifest(manifest, data)


async def run_game(runner, module, slug, names, args):
    directory = args.out / slug
    directory.mkdir(parents=True, exist_ok=True)
    report = dict(schema_version=1, slug=slug,
                  run_at=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                  url=module.URL, serve=module.SERVE, modes=[],
                  viewport={'width': 1280, 'height': 720}, device_scale_factor=1,
                  chrome_args=CHROME_ARGS, screenshot_interval=SHOT_INTERVAL,
                  sheet='sheet.jpg', selected_modes=names, status='running', reasons=[],
                  runner_failures=[])
    original = (json.loads(args.manifest.read_text(encoding='utf-8'))
                if args.manifest.exists() else {'games': []})
    previous = [game for game in original['games'] if game['slug'] == slug]

    def runner_failure(mode, error):
        runner.failure(slug, mode.name, error)
        report['status'] = 'failed'
        report['reasons'] = ['runner-crash']
        report['runner_failures'].append(runner.failures[-1])
        write_manifest(directory / 'run.json', report)
        # Earlier modes may already have published incremental evidence. Restore
        # only this game's entry and retain updates for every other game.
        if args.manifest.exists():
            data = json.loads(args.manifest.read_text(encoding='utf-8'))
            data['games'] = sorted(
                [game for game in data['games'] if game['slug'] != slug] + previous,
                key=lambda game: game['slug'])
            write_manifest(args.manifest, data)

    async with servers(args.root, module.SERVE):
        for mode in module.MODES:
            if mode.name in names:
                if getattr(module, 'POINTER_LOCK_SHIM', False):
                    mode = replace(mode, pointer_lock_shim=True)
                try:
                    check_browser(runner.browser)
                except RunnerCrash as error:
                    runner_failure(mode, error)
                    raise
                for attempt in range(2):
                    try:
                        result = await run_mode(runner.browser, module.URL, mode, directory)
                        check_browser(runner.browser)
                        break
                    except RunnerCrash as error:
                        runner_failure(mode, error)
                        if attempt:
                            raise
                        await runner.launch(slug)
                report['modes'].append(result)
                report['auto_verdict'] = worst(report['modes'])
                write_manifest(directory / 'run.json', report)
                contact_sheet(directory, report['modes'])
                if not report['runner_failures']:
                    upsert(args.manifest, report)
                print(slug + '/' + mode.name + ': ' + result['auto_verdict'], flush=True)
    if not report['runner_failures']:
        report['status'] = 'completed'
    write_manifest(directory / 'run.json', report)
    return report


async def run_all(args, slugs):
    from playwright.async_api import async_playwright

    failed = False
    not_run, completed = [], []
    async with async_playwright() as playwright:
        runner = BrowserRunner(playwright.chromium)
        try:
            await runner.launch(slugs[0])
            for slug in slugs:
                try:
                    try:
                        check_browser(runner.browser)
                    except RunnerCrash as error:
                        runner.failure(slug, None, error)
                        raise
                    module = load_module(args.root, slug)
                    names = select_modes(module, args.modes)
                    await run_game(runner, module, slug, names, args)
                    completed.append(slug)
                except RunnerCrash:
                    not_run.append(slug)
                    # This game exhausted its retry (or had no live browser at
                    # its boundary). Recover once for the following game.
                    await runner.launch(slug)
                except RunnerUnavailable:
                    raise
                except Exception as error:
                    failed = True
                    not_run.append(slug)
                    print(slug + ': run crashed: ' + str(error), file=sys.stderr)
        except RunnerUnavailable:
            not_run.extend(slug for slug in slugs if slug not in completed and slug not in not_run)
        finally:
            if runner.browser is not None:
                await runner.browser.close()
            failed = failed or bool(runner.failures)
            write_manifest(args.out / 'run.json', dict(
                status='failed' if failed else 'completed',
                reasons=['runner-crash'] if runner.failures else [],
                runner_failures=runner.failures, completed=completed, not_run=not_run))
            print('Not run: ' + (', '.join(not_run) if not_run else 'none'), flush=True)
    return int(failed)


def select_modes(module, requested):
    names = [mode.name for mode in module.MODES]
    unknown = set(requested) - set(names)
    if unknown:
        raise ValueError('Unknown modes: ' + ', '.join(sorted(unknown)))
    return requested or names


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('slug', nargs='?')
    parser.add_argument('modes', nargs='*')
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--manifest', type=Path)
    args = parser.parse_args(argv)
    if args.all == bool(args.slug):
        parser.error('Provide either a slug or --all')
    args.root = args.root.resolve()
    args.out = (args.out or args.root / 'output/playthrough').resolve()
    args.manifest = (args.manifest or args.root / 'catalog/runnability.json').resolve()
    try:
        slugs = ([path.stem for path in sorted((args.root / 'tools/playthrough').glob('*.py'))
                  if not path.name.startswith('_')] if args.all else [args.slug])
        if not slugs:
            raise ValueError('No playthrough modules found')
        if args.dry_run:
            for slug in slugs:
                module = load_module(args.root, slug)
                for name in select_modes(module, args.modes):
                    print(slug + '/' + name + ': valid')
            return 0
        return asyncio.run(run_all(args, slugs))
    except KeyboardInterrupt:
        return 130
    except Exception as error:
        print('Error: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
