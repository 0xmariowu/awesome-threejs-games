#!/usr/bin/env python3
"""Record local game and tool scenarios as timestamped CDP frames, video and WebVTT."""

import argparse
import asyncio
import base64
import hashlib
import importlib.util
import inspect
import json
import math
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, List, Optional, Tuple
from urllib.parse import quote, urlsplit
from urllib.request import urlopen

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
CHROME_ARGS = ['--use-angle=metal', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
Cue = Callable[[Optional[str]], None]
cue = Cue


@dataclass
class Shot:
    url: str
    module: Optional[str]
    serve: List[str]
    prepare: Callable[[Any], Awaitable[None]]
    run: Callable[[Any, Cue], Awaitable[None]]
    viewport: Tuple[int, int] = (1280, 720)
    scale: float = 1.5
    poster_at: float = 2.0
    overlay: bool = True
    overlay_position: str = 'top-left'
    init_script: Optional[str] = None
    min_fps: float = 45
    preview_at: Optional[float] = None


def local_url(url):
    """Match parsed origins, never a lookalike host or a URL's userinfo."""
    try:
        parsed = urlsplit(url)
        hosts = {'http': {'127.0.0.1', 'localhost'}, 'ws': {'127.0.0.1'}}
        return (parsed.hostname in hosts.get(parsed.scheme, set())
                and parsed.port is not None and parsed.port > 0
                and parsed.username is None and parsed.password is None)
    except ValueError:
        return False


def load_scenario(path):
    # CLI execution must share the same Shot class with `from record import Shot`.
    sys.path.insert(0, str(TOOLS))
    sys.modules.setdefault('record', sys.modules[__name__])
    spec = importlib.util.spec_from_file_location('_gameref_record_scenario', path)
    if spec is None or spec.loader is None:
        raise ValueError('Cannot import scenario: ' + str(path))
    scenario = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = scenario
    spec.loader.exec_module(scenario)
    return getattr(scenario, 'SHOTS', None)


def server_folder(root, folder):
    if not isinstance(folder, str) or not folder or Path(folder).is_absolute():
        raise ValueError('serve folders must be relative to --root')
    resolved = (root / folder).resolve()
    resolved.relative_to(root)
    return resolved


def server_port(folder):
    config = json.loads((folder / 'local.json').read_text(encoding='utf-8'))
    port = config.get('port')
    if type(port) is not int or not 0 < port < 65536:
        raise ValueError(str(folder / 'local.json') + ': invalid port')
    return port


def validate(shots, slug, root):
    errors = []
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', slug):
        errors.append('Invalid project slug')
    if not isinstance(shots, dict) or not shots:
        return errors + ['SHOTS must be a non-empty dict']
    candidates = json.loads((root / 'catalog/extraction-candidates.json').read_text(
        encoding='utf-8'))['candidates']
    ids = {item['id'] for item in candidates if item['project'] == slug}
    # Tools use the same local capture pipeline, but publish only an overview.
    tool_catalog = root / 'catalog/tools.json'
    if tool_catalog.exists():
        tools = json.loads(tool_catalog.read_text(encoding='utf-8'))['tools']
        if any(tool['slug'] == slug for tool in tools) and set(shots) != {'overview'}:
            errors.append('Tools must record only an overview shot')
    overview = shots.get('overview')
    if not isinstance(overview, Shot) or overview.module is not None:
        errors.append('An overview shot with module=None is required')
    for name, shot in shots.items():
        if not isinstance(name, str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', name):
            errors.append('Invalid shot name: ' + repr(name))
        if not isinstance(shot, Shot):
            errors.append(str(name) + ': expected a Shot')
            continue
        if shot.module is not None:
            if not isinstance(shot.module, str) or shot.module not in ids:
                errors.append(str(name) + ': unknown module ' + repr(shot.module))
        for field in ('prepare', 'run'):
            if not inspect.iscoroutinefunction(getattr(shot, field)):
                errors.append(str(name) + ': ' + field + ' must be a coroutine function')
        if not local_url(shot.url) or urlsplit(shot.url).scheme != 'http':
            errors.append(str(name) + ': url must be local HTTP with an explicit port')
        if not isinstance(shot.serve, list):
            errors.append(str(name) + ': serve must be a list')
        else:
            for folder in shot.serve:
                try:
                    server_port(server_folder(root, folder))
                except (OSError, ValueError, TypeError) as error:
                    errors.append(str(name) + ': invalid serve folder: ' + str(error))
        if shot.overlay_position not in ('top-left', 'top-right', 'bottom-left', 'bottom-right'):
            errors.append(str(name) + ': invalid overlay_position')
        if (not isinstance(shot.viewport, (tuple, list)) or len(shot.viewport) != 2
                or any(type(v) is not int or v <= 0 for v in shot.viewport)):
            errors.append(str(name) + ': viewport must contain two positive integers')
        for field in ('scale', 'min_fps', 'poster_at'):
            value = getattr(shot, field)
            if (not isinstance(value, (int, float)) or not math.isfinite(value)
                    or value < 0 or (field != 'poster_at' and value == 0)):
                errors.append(str(name) + ': invalid ' + field)
        if shot.init_script is not None and not isinstance(shot.init_script, str):
            errors.append(str(name) + ': init_script must be a string or None')
        if shot.preview_at is not None and (type(shot.preview_at) not in (int, float)
                or not math.isfinite(shot.preview_at) or shot.preview_at < 0):
            errors.append(str(name) + ': invalid preview_at')
    # Technique examples are runnable separately; gameplay needs only an overview.
    return errors


def overlay_script(position):
    vertical, horizontal = position.split('-')
    return r"""(() => {
      if (window !== window.top) return;
      const keys = new Map();
      let buttons = 0, wheel = false, timer;
      const host = document.createElement('div');
      host.style.cssText = 'all:initial;position:fixed;__POSITION__;z-index:2147483647;pointer-events:none';
      const shadow = host.attachShadow({mode:'closed'});
      shadow.innerHTML = `<style>
        :host, * { pointer-events:none !important; }
        .pill { display:flex;align-items:center;gap:7px;padding:9px 12px;
          border-radius:14px;background:rgba(12,18,28,.72);color:#f4f5f7;
          font:14px/1.4 system-ui,sans-serif;box-shadow:0 2px 12px #0003; }
        kbd { font:600 13px/1.4 system-ui,sans-serif;padding:3px 7px;
          border:1px solid #ffffff55;border-bottom-width:2px;border-radius:5px; }
      </style><div class="pill"></div>`;
      const pill = shadow.querySelector('.pill');
      const labels = {ShiftLeft:'Shift',ShiftRight:'Shift',Space:'Space',
        ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',
        ControlLeft:'Ctrl',ControlRight:'Ctrl',AltLeft:'Alt',AltRight:'Alt',
        MetaLeft:'Cmd',MetaRight:'Cmd',Escape:'Esc'};
      function render() {
        pill.replaceChildren();
        for (const label of new Set(keys.values())) {
          const cap = document.createElement('kbd'); cap.textContent = label; pill.append(cap);
        }
        const mouse = [];
        if (buttons & 1) mouse.push('左键拖动');
        if (buttons & 2) mouse.push('右键拖动');
        if (buttons & 4) mouse.push('中键拖动');
        if (wheel) mouse.push('滚轮');
        if (mouse.length) {
          const text = document.createElement('span'); text.textContent = mouse.join(' · '); pill.append(text);
        }
        pill.style.display = keys.size || mouse.length ? 'flex' : 'none';
      }
      const listen = (type, fn) => window.addEventListener(type, fn, {capture:true,passive:true});
      listen('keydown', e => {
        keys.set(e.code, labels[e.code] || e.code.replace(/^(Key|Digit)/, '') || e.key); render();
      });
      listen('keyup', e => { keys.delete(e.code); render(); });
      listen('pointerdown', e => { buttons = e.buttons; render(); });
      listen('pointerup', e => { buttons = e.buttons; render(); });
      listen('pointercancel', () => { buttons = 0; render(); });
      listen('blur', () => { keys.clear(); buttons = 0; wheel = false; render(); });
      listen('wheel', () => {
        wheel = true; clearTimeout(timer); render();
        timer = setTimeout(() => { wheel = false; render(); }, 350);
      });
      const mount = () => { document.documentElement.append(host); render(); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
      else mount();
    })();""".replace('__POSITION__', vertical + ':20px;' + horizontal + ':20px')


def port_answers(port):
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.2):
            return True
    except OSError:
        return False


def verify_server(folder, port):
    """Reuse only a server serving this folder's exact configured entry."""
    try:
        config = json.loads((folder / 'local.json').read_text(encoding='utf-8'))
        entry = config.get('entry', '/index.html').lstrip('/')
        expected = (folder / config.get('root', 'public') / entry).read_bytes()
        url = 'http://127.0.0.1:%d/%s' % (port, quote(entry, safe='/'))
        with urlopen(url, timeout=2) as response:
            if response.status != 200 or hashlib.sha256(response.read()).digest() != hashlib.sha256(expected).digest():
                raise ValueError('entry SHA-256 mismatch')
    except Exception as error:
        raise RuntimeError('Refusing to record: cannot verify existing server on port %d for %s (%s)' % (
            port, folder.name, error)) from error


@asynccontextmanager
async def servers(root, folders):
    started = []
    try:
        for name in dict.fromkeys(folders):
            folder = server_folder(root, name)
            port = server_port(folder)
            if port_answers(port):
                await asyncio.to_thread(verify_server, folder, port)
                continue
            log = tempfile.TemporaryFile()
            env = os.environ.copy()
            env.pop('PORT', None)  # local.json, not the caller's shell, owns the port.
            try:
                process = subprocess.Popen(['node', str(TOOLS / 'server.mjs'), str(folder)],
                                           stdout=log, stderr=log, env=env)
            except BaseException:
                log.close()
                raise
            started.append((process, log))
            deadline = time.monotonic() + 10
            while process.poll() is None and not port_answers(port):
                if time.monotonic() >= deadline:
                    raise RuntimeError('Server startup timed out: ' + name)
                await asyncio.sleep(0.05)
            if process.poll() is not None:
                log.seek(0)
                raise RuntimeError('Server failed: ' + log.read().decode('utf-8', errors='replace'))
        yield
    finally:
        for process, log in reversed(started):
            try:
                if process.poll() is None:
                    process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            finally:
                log.close()


@dataclass
class Capture:
    frames: List[Tuple[float, Path]]
    cues: List[Tuple[float, Optional[str]]]
    end: float
    dropped: int = 0

    @property
    def span(self):
        return self.frames[-1][0] - self.frames[0][0]

    @property
    def fps(self):
        return (len(self.frames) - 1) / self.span if self.span > 0 else 0.0

    @property
    def duration(self):
        return self.end - self.frames[0][0]


def filter_frames(frames, end):
    """Keep timestamp order and the first frame at each timestamp before the cutoff."""
    frames = [(stamp, path) for stamp, path in frames if stamp <= end]
    kept, dropped = [], 0
    for frame in sorted(frames, key=lambda frame: frame[0]):
        if kept and frame[0] <= kept[-1][0]:
            dropped += 1
        else:
            kept.append(frame)
    if len(kept) < 2:
        raise RuntimeError('Screencast requires at least two strictly increasing frame timestamps')
    return kept, dropped


async def capture(browser, shot, directory, label):
    context = await browser.new_context(
        viewport=dict(zip(('width', 'height'), shot.viewport)),
        device_scale_factor=shot.scale, service_workers='block')
    try:
        async def route(request):
            if local_url(request.request.url):
                await request.continue_()
            else:
                print(label + ' blocked: ' + request.request.url, flush=True)
                await request.abort()

        async def websocket(ws):
            if local_url(ws.url):
                ws.connect_to_server()
            else:
                print(label + ' blocked: ' + ws.url, flush=True)
                await ws.close()

        await context.route('**/*', route)
        await context.route_web_socket('**/*', websocket)
        # One script makes installation order deterministic for scenario init code.
        script = overlay_script(shot.overlay_position) if shot.overlay else ''
        if shot.init_script:
            script += '\n' + shot.init_script
        if script:
            await context.add_init_script(script=script)
        page = await context.new_page()
        page.on('pageerror', lambda error: print(label + ' page error: ' + str(error), flush=True))
        page.on('console', lambda message: print(label + ' console error: ' + message.text, flush=True)
                if message.type == 'error' else None)
        await page.goto(shot.url, wait_until='domcontentloaded', timeout=60000)
        await shot.prepare(page)
        session = await context.new_cdp_session(page)
        frames, cues, failures, acknowledgements = [], [], [], set()
        first_frame = asyncio.Event()

        async def ack(session_id):
            try:
                await session.send('Page.screencastFrameAck', {'sessionId': session_id})
            except Exception as error:
                failures.append(error)

        def frame(event):
            try:
                timestamp = float(event['metadata']['timestamp'])
                path = directory / ('frame-%06d.jpg' % len(frames))
                path.write_bytes(base64.b64decode(event['data']))
                frames.append((timestamp, path))
            except Exception as error:
                failures.append(error)
            finally:
                task = asyncio.create_task(ack(event['sessionId']))
                acknowledgements.add(task)
                task.add_done_callback(acknowledgements.discard)
                first_frame.set()

        def mark(text):
            if text is not None and not isinstance(text, str):
                raise TypeError('cue expects a string or None')
            cues.append((time.time(), text))

        session.on('Page.screencastFrame', frame)
        try:
            await session.send('Page.startScreencast', {
                'format': 'jpeg', 'quality': 90, 'maxWidth': 1920,
                'maxHeight': 1080, 'everyNthFrame': 1})
            await asyncio.wait_for(first_frame.wait(), timeout=10)
            await shot.run(page, mark)
            end = time.time()
        finally:
            try:
                await session.send('Page.stopScreencast')
            finally:
                session.remove_listener('Page.screencastFrame', frame)
                if acknowledgements:
                    await asyncio.gather(*acknowledgements)
        if failures:
            raise RuntimeError('Screencast frame/ack failed: ' + str(failures[0]))
        frames, dropped = filter_frames(frames, end)
        return Capture(frames, cues, end, dropped)
    finally:
        await context.close()


def vtt_time(seconds):
    millis = max(0, round(seconds * 1000))
    hours, millis = divmod(millis, 3600000)
    minutes, millis = divmod(millis, 60000)
    seconds, millis = divmod(millis, 1000)
    return '%02d:%02d:%02d.%03d' % (hours, minutes, seconds, millis)


def write_vtt(path, recording):
    lines = ['WEBVTT', '']
    origin = recording.frames[0][0]
    for index, (stamp, text) in enumerate(recording.cues):
        until = recording.cues[index + 1][0] if index + 1 < len(recording.cues) else recording.end
        start, end = max(0, stamp - origin), min(recording.duration, until - origin)
        if text is None or not text.strip() or round(end * 1000) <= round(start * 1000):
            continue
        # Cue text is plain text, not WebVTT markup; blank lines would end a cue.
        text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        text = re.sub(r'\n\s*\n', '\n', text.replace('\r', ''))
        lines.extend([vtt_time(start) + ' --> ' + vtt_time(end), text, ''])
    path.write_text('\n'.join(lines) + ('\n' if len(lines) > 2 else ''), encoding='utf-8')


def command(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(args[0] + ' failed: ' + result.stderr.strip())
    return result.stdout


def encode(recording, directory, video, poster, poster_at):
    concat = directory / 'frames.ffconcat'
    lines = ['ffconcat version 1.0']
    for index, (stamp, path) in enumerate(recording.frames):
        until = recording.frames[index + 1][0] if index + 1 < len(recording.frames) else recording.end
        # The image demuxer's default 25 Hz time base would quantize timestamps.
        lines.extend(["file '%s'" % path.name, 'option framerate 1000000',
                      'duration %.9f' % (until - stamp)])
    lines.extend(["file '%s'" % recording.frames[-1][1].name, 'option framerate 1000000'])
    concat.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    command(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
             '-f', 'concat', '-safe', '0', '-i', str(concat),
             '-t', '%.9f' % recording.duration,
             '-vf', 'fps=60,scale=1920:1080:flags=lanczos,format=yuv420p',
             '-c:v', 'libx264', '-crf', '20', '-preset', 'slow',
             '-color_range', 'tv',  # Convert JPEG full range to limited-range yuv420p.
             '-movflags', '+faststart', '-an', str(video)])
    metadata = json.loads(command([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:format=duration', '-of', 'json', str(video)]))
    duration = float(metadata['format']['duration'])
    # Short shots still need a poster even when poster_at exceeds their duration.
    position = min(poster_at, max(0, duration - 1 / 60))
    command(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(position),
             '-i', str(video), '-frames:v', '1', '-q:v', '2', '-update', '1', str(poster)])
    return duration, metadata['streams'][0]


def preview_window(video, preview_at=None):
    """Share the MP4 preview's start, including its eight-second end clamp."""
    if preview_at is not None and (type(preview_at) not in (int, float)
            or not math.isfinite(preview_at) or preview_at < 0):
        raise ValueError('Invalid preview_at')
    metadata = json.loads(command([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'format=duration', '-of', 'json', str(video)]))
    duration = float(metadata['format']['duration'])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('Invalid overview duration')
    length = min(8.0, duration)
    start = min(preview_at if preview_at is not None else duration * 0.2,
                max(0.0, duration - length))
    return start, length


def build_preview(video, preview, root, preview_at=None):
    """Encode a silent loop without modifying the full-length source."""
    if video.resolve() == preview.resolve():
        raise ValueError('Preview must not overwrite its source video')
    start, length = preview_window(video, preview_at)
    preview.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.preview-', dir=preview.parent) as temporary:
        staged = Path(temporary) / 'preview.mp4'
        command(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                 '-ss', str(start), '-i', str(video), '-t', str(length),
                 '-map', '0:v:0', '-vf', 'scale=854:480:flags=lanczos,setsar=1',
                 '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28',
                 '-an', '-movflags', '+faststart', str(staged)])
        staged.replace(preview)
    return {'preview': Path(os.path.relpath(preview, root)).as_posix(),
            'preview_sha256': hashlib.sha256(preview.read_bytes()).hexdigest(),
            'preview_bytes': preview.stat().st_size}


README_PREVIEW_MAX_BYTES = 3_000_000


def pillow_webp_available():
    try:
        from PIL import features
    except ImportError:
        return False
    return features.check('webp_anim')


def encode_readme_webp(frames, staged, fps, quality, img2webp=None):
    # Distribute fractional milliseconds so 12 fps still totals six seconds.
    durations = [round((index + 1) * 1000 / fps) - round(index * 1000 / fps)
                 for index in range(len(frames))]
    if img2webp:
        args = [img2webp, '-loop', '0', '-lossy', '-q', str(quality), '-m', '6']
        for frame, duration in zip(frames, durations):
            args.extend(['-d', str(duration), str(frame)])
        command([*args, '-o', str(staged)])
        return

    from PIL import Image
    images = []
    try:
        for frame in frames:
            with Image.open(frame) as image:
                images.append(image.convert('RGB'))
        images[0].save(staged, format='WEBP', save_all=True, append_images=images[1:],
                       duration=durations, loop=0, quality=quality, method=6)
    finally:
        for image in images:
            image.close()


def build_readme_preview(video, preview, root, preview_at=None):
    """Write a bounded loop using Pillow, img2webp, then GIF as available."""
    start, length = preview_window(video, preview_at)
    pillow = pillow_webp_available()
    img2webp = None if pillow else shutil.which('img2webp')
    webp = pillow or img2webp is not None
    preview = preview.with_suffix('.webp' if webp else '.gif')
    if video.resolve() == preview.resolve():
        raise ValueError('Preview must not overwrite its source video')
    preview.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.readme-preview-', dir=preview.parent) as temporary:
        staged = Path(temporary) / preview.name
        for fps, quality, colors in [(12, 60, 128), (10, 50, 96), (8, 40, 64),
                                     (6, 30, 48), (4, 20, 32), (2, 10, 16), (1, 5, 8)]:
            filters = 'fps=%d,scale=480:-2:flags=lanczos,setsar=1' % fps
            extract = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                       '-ss', str(start), '-t', str(min(6.0, length)), '-i', str(video)]
            if webp:
                # Each retry has its own directory so old frames cannot extend the loop.
                frames = Path(temporary) / str(fps)
                frames.mkdir()
                command([*extract, '-map', '0:v:0', '-vf', filters, '-c:v', 'png',
                         '-an', str(frames / '%04d.png')])
                encode_readme_webp(sorted(frames.glob('*.png')), staged, fps, quality, img2webp)
            else:
                encoding = ['-filter_complex', filters + ',split[a][b];'
                            '[a]palettegen=max_colors=%d[p];' % colors +
                            '[b][p]paletteuse=dither=bayer', '-c:v', 'gif']
                command([*extract, *encoding, '-an', '-loop', '0', str(staged)])
            if staged.stat().st_size <= README_PREVIEW_MAX_BYTES:
                staged.replace(preview)
                return {'readme_preview': Path(os.path.relpath(preview, root)).as_posix()}
    raise RuntimeError('README preview exceeds 3 MB after reducing frame rate and quality')


def upsert(manifest, entry):
    data = (json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists()
            else {'schema_version': 1, 'videos': []})
    data['videos'] = sorted([v for v in data['videos'] if v['id'] != entry['id']] + [entry],
                            key=lambda video: video['id'])
    write_manifest(manifest, data)


def write_manifest(manifest, data):
    manifest.parent.mkdir(parents=True, exist_ok=True)
    # An interrupted write must not truncate the existing catalog.
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=manifest.parent,
                                     delete=False) as temporary:
        temporary_path = Path(temporary.name)
        try:
            temporary.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
            temporary.close()
            temporary_path.replace(manifest)
        finally:
            temporary_path.unlink(missing_ok=True)


def readme_preview_directory(args):
    if args.out.resolve() == (args.root / 'media').resolve():
        return args.root / 'previews'
    return args.out


def preview_only(args, scenario):
    data = json.loads(args.manifest.read_text(encoding='utf-8'))
    entries = [entry for entry in data['videos']
               if entry.get('project') == args.slug and entry.get('id') == args.slug + '/overview']
    if len(entries) != 1:
        raise ValueError('Expected one recorded overview in the manifest for ' + args.slug)
    entry = entries[0]
    relative = entry['file']
    if (not isinstance(relative, str) or '\\' in relative
            or not relative.startswith('media/' + args.slug + '/')
            or any(part in ('', '.', '..') for part in relative.split('/'))
            or Path(relative).suffix != '.mp4'):
        raise ValueError('Overview file must be an MP4 under media/' + args.slug + '/')
    video = (args.root / relative).resolve()
    video.relative_to((args.root / 'media' / args.slug).resolve())
    preview_at = None
    if scenario.exists():
        shots = load_scenario(scenario)
        overview = shots.get('overview') if isinstance(shots, dict) else None
        if isinstance(overview, Shot):
            preview_at = overview.preview_at
    preview = args.out / args.slug / 'overview-preview.mp4'
    entry.update(build_preview(video, preview, args.root, preview_at))
    entry.update(build_readme_preview(video, readme_preview_directory(args) / (args.slug + '.webp'),
                                     args.root, preview_at))
    write_manifest(args.manifest, data)
    print(args.slug + '/overview: preview=' + entry['preview'] +
          ' readme_preview=' + entry['readme_preview'], flush=True)
    return 0


async def record_shot(browser, shot, name, args):
    label = args.slug + '/' + name
    with tempfile.TemporaryDirectory(prefix='gameref-record-') as temporary:
        directory = Path(temporary)
        async with servers(args.root, shot.serve):
            recording = await capture(browser, shot, directory, label)
        gaps = sum(b[0] - a[0] > 0.05 for a, b in zip(recording.frames, recording.frames[1:]))
        print('%s: frames=%d span=%.3fs fps=%.1f gaps>50ms=%d dropped=%d' %
              (label, len(recording.frames), recording.span, recording.fps, gaps,
               recording.dropped), flush=True)
        # Stage the artifacts so a rejected re-record cannot invalidate an old entry.
        video, poster, captions = [directory / (name + suffix) for suffix in ('.mp4', '.jpg', '.vtt')]
        duration, stream = encode(recording, directory, video, poster, shot.poster_at)
        write_vtt(captions, recording)
        if recording.fps < shot.min_fps and not args.allow_low_fps:
            print('%s: %.1f fps is below %.1f; manifest entry not written (use --allow-low-fps to override)'
                  % (label, recording.fps, shot.min_fps), file=sys.stderr)
            return False
        out = args.out / args.slug
        out.mkdir(parents=True, exist_ok=True)
        preview_fields = {}
        if name == 'overview':
            preview = directory / 'overview-preview.mp4'
            preview_fields = build_preview(video, preview, args.root, shot.preview_at)
            readme_fields = build_readme_preview(video, directory / (args.slug + '.webp'),
                                                directory, shot.preview_at)
            readme = directory / readme_fields['readme_preview']
            destination = readme_preview_directory(args) / readme.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(readme), str(destination))
            preview_fields['readme_preview'] = Path(os.path.relpath(destination, args.root)).as_posix()
            shutil.move(str(preview), str(out / preview.name))
            preview_fields['preview'] = Path(os.path.relpath(out / preview.name, args.root)).as_posix()
        for artifact in (video, poster, captions):
            shutil.move(str(artifact), str(out / artifact.name))
        video, poster, captions = [out / artifact.name for artifact in (video, poster, captions)]
        upsert(args.manifest, {
            'id': label, 'project': args.slug, 'module': shot.module,
            'file': Path(os.path.relpath(video, args.root)).as_posix(),
            'poster': Path(os.path.relpath(poster, args.root)).as_posix(),
            'captions': Path(os.path.relpath(captions, args.root)).as_posix(),
            'duration': round(duration, 2), 'fps': round(recording.fps, 1),
            'width': stream['width'], 'height': stream['height'],
            'bytes': video.stat().st_size, 'sha256': hashlib.sha256(video.read_bytes()).hexdigest(),
            'recorded_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'scenario': 'tools/scenarios/%s.py#%s' % (args.slug, name),
            'method': 'cdp-screencast',
            **preview_fields,
        })
        return True


async def record_all(shots, names, args):
    from playwright.async_api import async_playwright

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, channel='chrome', args=CHROME_ARGS)
        try:
            passed = True
            for name in names:
                if not await record_shot(browser, shots[name], name, args):
                    passed = False
            return 0 if passed else 3
        finally:
            await browser.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('slug')
    parser.add_argument('shots', nargs='*')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--preview-only', action='store_true')
    parser.add_argument('--scenario-file', type=Path)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--allow-low-fps', action='store_true')
    args = parser.parse_args(argv)
    args.root = args.root.resolve()
    args.out = (args.out or args.root / 'media').resolve()
    args.manifest = (args.manifest or args.root / 'catalog/videos.json').resolve()
    try:
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', args.slug):
            raise ValueError('Invalid project slug')
        scenario = args.scenario_file or args.root / 'tools/scenarios' / (args.slug + '.py')
        if args.preview_only:
            if args.shots:
                raise ValueError('--preview-only does not accept shot names')
            return preview_only(args, scenario)
        shots = load_scenario(scenario)
        errors = validate(shots, args.slug, args.root)
        names = args.shots or list(shots or {})
        errors.extend('Unknown shot: ' + name for name in names if isinstance(shots, dict) and name not in shots)
        if errors:
            for error in errors:
                print('Error: ' + error, file=sys.stderr)
            return 1
        if args.dry_run:
            for name in names:
                print(args.slug + '/' + name + ': module=' + str(shots[name].module))
            return 0
        missing = [name for name in ('ffmpeg', 'ffprobe') if shutil.which(name) is None]
        if missing:
            print('Error: required executable missing from PATH: ' + ', '.join(missing), file=sys.stderr)
            return 2
        return asyncio.run(record_all(shots, names, args))
    except KeyboardInterrupt:
        return 130
    except Exception as error:
        print('Error: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
