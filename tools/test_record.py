"""Exercise recorder validation and a real local Chrome/CDP/ffmpeg round trip."""

import asyncio
import contextlib
import hashlib
import io
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from PIL import Image

from tools import record


PAGE = """<!doctype html><meta charset="utf-8"><title>Synthetic motion</title>
<style>html,body{margin:0;overflow:hidden}canvas{display:block}</style><canvas></canvas>
<script>
const canvas = document.querySelector('canvas');
canvas.width = innerWidth; canvas.height = innerHeight;
const ctx = canvas.getContext('2d');
window.held = false;
window.addEventListener('keydown', e => {
  if (e.code === 'KeyW') { window.held = true; window.inputPrevented = e.defaultPrevented; }
});
window.addEventListener('keyup', e => { if (e.code === 'KeyW') window.held = false; });
function frame(t) {
  ctx.fillStyle = '#142030'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = window.held ? '#30ef60' : '#ef6030';
  window.squareX = 100 + Math.floor((t / 6) % (canvas.width - 220));
  ctx.fillRect(window.squareX, 300, 100, 100);
  window.squarePixel = Array.from(ctx.getImageData(window.squareX + 50, 350, 1, 1).data);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script>"""

SCENARIO = '''from record import Shot

async def prepare(page):
    await page.wait_for_function("window.squarePixel && window.recorderInit === true")
    assert not await page.evaluate("window.held")

async def run(page, cue):
    cue("方块持续移动")
    # Exercise both error reporting and the external-request guard.
    await page.evaluate("""() => {
      console.error('synthetic console diagnostic');
      setTimeout(() => { throw new Error('synthetic page diagnostic'); }, 0);
      fetch('http://example.invalid:9999/blocked').catch(() => {});
      new WebSocket('ws://example.invalid:9999/blocked');
    }""")
    await page.wait_for_timeout(1000)
    cue("按住 W 变为绿色")
    await page.keyboard.down('w')
    await page.wait_for_timeout(1000)
    assert await page.evaluate("window.held && !window.inputPrevented")
    assert await page.evaluate("window.squarePixel[1] > window.squarePixel[0]")
    await page.keyboard.up('w')
    cue("松开 W 恢复橙色")
    await page.wait_for_timeout(800)
    assert await page.evaluate("!window.held && window.squarePixel[0] > window.squarePixel[1]")
    cue(None)
    await page.wait_for_timeout(200)

async def overview(page, cue):
    await page.wait_for_timeout(3000)

SHOTS = {
    'overview': Shot(URL, None, ['synthetic'], prepare, overview,
                     overlay=False, init_script='window.recorderInit = true;'),
    'motion': Shot(URL, 'synthetic.motion', ['synthetic'], prepare, run,
                   overlay_position='bottom-right', init_script='window.recorderInit = true;'),
}
'''


class RecorderTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='gameref-record-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        (self.root / 'catalog').mkdir()
        self.candidates = self.root / 'catalog/extraction-candidates.json'
        self.candidates.write_text(json.dumps({'schema_version': 1, 'candidates': [
            {'id': 'synthetic.motion', 'project': 'synthetic'}]}), encoding='utf-8')
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            self.port = listener.getsockname()[1]
        game = self.root / 'synthetic'
        (game / 'public').mkdir(parents=True)
        (game / 'local.json').write_text(json.dumps({
            'port': self.port, 'root': 'public', 'entry': '/index.html'}), encoding='utf-8')
        (game / 'public/index.html').write_text(PAGE, encoding='utf-8')
        self.scenario = self.root / 'tools/scenarios/synthetic.py'
        self.scenario.parent.mkdir(parents=True)
        self.source = SCENARIO.replace('URL', repr('http://127.0.0.1:%d/' % self.port))
        self.scenario.write_text(self.source, encoding='utf-8')

    def cli(self, *args):
        return subprocess.run([
            sys.executable, str(record.TOOLS / 'record.py'), 'synthetic',
            *args, '--root', str(self.root), '--scenario-file', str(self.scenario),
        ], capture_output=True, text=True, timeout=120)

    def dry_run(self, expected, message=None):
        result = self.cli('--dry-run')
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        if message:
            self.assertIn(message, result.stdout + result.stderr)
        return result

    def test_dry_run_valid(self):
        result = self.dry_run(0)
        self.assertLess(result.stdout.index('synthetic/overview'), result.stdout.index('synthetic/motion'))
        self.assertFalse(record.port_answers(self.port))
        self.assertFalse((self.root / 'media').exists())

    def test_dry_run_missing_overview(self):
        self.scenario.write_text(self.source + "\ndel SHOTS['overview']\n", encoding='utf-8')
        self.dry_run(1, 'overview')

    def test_dry_run_overview_only_with_candidates(self):
        self.scenario.write_text(self.source + "\ndel SHOTS['motion']\n", encoding='utf-8')
        self.dry_run(0)

    def test_dry_run_unknown_module(self):
        self.scenario.write_text(self.source + "\nSHOTS['motion'].module = 'other.motion'\n", encoding='utf-8')
        self.dry_run(1, 'unknown module')

    def test_dry_run_no_candidates_needs_no_coverage(self):
        self.candidates.write_text('{"candidates": []}', encoding='utf-8')
        self.scenario.write_text(self.source + "\ndel SHOTS['motion']\n", encoding='utf-8')
        self.dry_run(0)

    def test_dry_run_rejects_invalid_contract(self):
        for suffix, message in [
            ('\nSHOTS = {}\n', 'non-empty'),
            ("\nSHOTS['motion'].prepare = lambda page: None\n", 'prepare must be a coroutine'),
            ("\nSHOTS['motion'].run = lambda page, cue: None\n", 'run must be a coroutine'),
            ("\nSHOTS['motion'].serve = ['missing']\n", 'invalid serve folder'),
            ("\nSHOTS['overview'].preview_at = -1\n", 'invalid preview_at'),
            ("\nSHOTS['overview'].preview_at = float('nan')\n", 'invalid preview_at'),
        ]:
            with self.subTest(message=message):
                self.scenario.write_text(self.source + suffix, encoding='utf-8')
                self.dry_run(1, message)

    def test_missing_encoders_exit_two_but_dry_run_needs_neither(self):
        args = ['synthetic', '--root', str(self.root)]
        output = io.StringIO()
        with patch.object(record.shutil, 'which', return_value=None), contextlib.redirect_stderr(output):
            self.assertEqual(record.main(args), 2)
            with contextlib.redirect_stdout(io.StringIO()), patch.object(record, 'record_all') as run:
                self.assertEqual(record.main(args + ['--dry-run']), 0)
                run.assert_not_called()
        self.assertIn('ffmpeg, ffprobe', output.getvalue())

    def test_origin_allowlist(self):
        for url in ['http://127.0.0.1:8000/', 'http://localhost:8000/a', 'ws://127.0.0.1:8000/a']:
            self.assertTrue(record.local_url(url), url)
        for url in ['https://127.0.0.1:8000/', 'ws://localhost:8000/', 'wss://127.0.0.1:8000/',
                    'http://localhost.evil:8000/', 'http://127.0.0.1:8000@evil/',
                    'http://evil@localhost:8000/', 'http://localhost/', 'file:///tmp/index.html',
                    'http://localhost:invalid/', 'http://localhost:99999/']:
            self.assertFalse(record.local_url(url), url)

    def test_filter_frames_duplicate_and_out_of_order(self):
        frames = [
            (100.0, Path('z-first')),
            (101.0, Path('z-second')),
            (101.0, Path('a-duplicate')),
            (102.0, Path('third')),
            (100.0, Path('a-out-of-order-repeat')),
            (103.0, Path('last')),
        ]
        original = frames.copy()
        kept, dropped = record.filter_frames(frames, 103.0)
        self.assertTrue(all(b[0] > a[0] for a, b in zip(kept, kept[1:])))
        self.assertEqual(kept, [frames[0], frames[1], frames[3], frames[5]])
        self.assertEqual(dropped, 2)
        self.assertEqual(frames, original)

    def test_filter_frames_preserves_unique_out_of_order_and_cutoff(self):
        frames = [(stamp, Path(str(stamp))) for stamp in (102.0, 100.0, 104.0, 101.0)]
        kept, dropped = record.filter_frames(frames, 102.0)
        self.assertEqual(kept, [frames[1], frames[3], frames[0]])
        self.assertEqual(dropped, 0)

    def test_filter_frames_requires_two_distinct_timestamps(self):
        for stamps in ([], [100.0], [100.0, 100.0], [100.0, 102.0]):
            with self.subTest(stamps=stamps):
                frames = [(stamp, Path(str(index))) for index, stamp in enumerate(stamps)]
                with self.assertRaisesRegex(RuntimeError, 'at least two strictly increasing'):
                    record.filter_frames(frames, 101.0)

    def test_captions_use_first_frame_and_clear_at_none(self):
        output = self.root / 'cues.vtt'
        capture = record.Capture([(100.0, Path('unused'))], [
            (99.8, '开场'), (100.5, None), (101.2, '继续 <W>'), (103.0, '结束之后'),
        ], 102.0)
        record.write_vtt(output, capture)
        self.assertEqual(output.read_text(encoding='utf-8'),
                         'WEBVTT\n\n00:00:00.000 --> 00:00:00.500\n开场\n\n'
                         '00:00:01.200 --> 00:00:02.000\n继续 &lt;W&gt;\n\n')
        self.assertEqual(record.vtt_time(3661.007), '01:01:01.007')

    def test_no_cues_write_empty_webvtt(self):
        output = self.root / 'empty.vtt'
        for cues in ([], [(100.0, None)], [(100.0, '   ')]):
            with self.subTest(cues=cues):
                record.write_vtt(output, record.Capture([(100.0, Path('unused'))], cues, 103.0))
                self.assertEqual(output.read_bytes(), b'WEBVTT\n')

    def test_manifest_upsert_preserves_other_entries_and_sorts(self):
        path = self.root / 'catalog/videos.json'
        record.upsert(path, {'id': 'z/overview', 'fps': 60})
        record.upsert(path, {'id': 'synthetic/motion', 'fps': 50})
        record.upsert(path, {'id': 'synthetic/motion', 'fps': 60})
        data = json.loads(path.read_text())
        self.assertEqual(data, {'schema_version': 1, 'videos': [
            {'id': 'synthetic/motion', 'fps': 60}, {'id': 'z/overview', 'fps': 60}]})
        self.assertTrue(path.read_bytes().endswith(b'\n'))

    def test_servers_cleanup_after_failure_and_preserve_existing(self):
        async def fail_after_start():
            async with record.servers(self.root, ['synthetic']):
                self.assertTrue(record.port_answers(self.port))
                raise RuntimeError('scenario failed')

        with self.assertRaisesRegex(RuntimeError, 'scenario failed'):
            asyncio.run(fail_after_start())
        self.assertFalse(record.port_answers(self.port))

        async def reuse():
            async with record.servers(self.root, ['synthetic']):
                self.assertTrue(record.port_answers(self.port))

        async def reuse_owned():
            async with record.servers(self.root, ['synthetic']):
                with patch.object(record.subprocess, 'Popen') as start:
                    await reuse()
                    start.assert_not_called()
                self.assertTrue(record.port_answers(self.port))

        asyncio.run(reuse_owned())
        self.assertFalse(record.port_answers(self.port))

    def test_servers_verify_configured_entry_and_reject_foreign_or_failed_http(self):
        folder = self.root / 'synthetic'
        (folder / 'site/nested').mkdir(parents=True)
        (folder / 'site/nested/entry.html').write_bytes(b'expected entry')
        requests = []

        class Handler(BaseHTTPRequestHandler):
            status = 200
            body = b'expected entry'

            def do_GET(self):
                requests.append(self.path)
                self.send_response(self.status)
                self.end_headers()
                self.wfile.write(self.body)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        port = server.server_address[1]
        (folder / 'local.json').write_text(json.dumps({
            'port': port, 'root': 'site', 'entry': '/nested/entry.html'}))

        async def reuse():
            async with record.servers(self.root, ['synthetic']):
                return True

        with patch.object(record.subprocess, 'Popen') as start:
            self.assertTrue(asyncio.run(reuse()))
            self.assertEqual(requests, ['/nested/entry.html'])
            for status, body in [(200, b'foreign server'), (404, b'expected entry'), (500, b'expected entry')]:
                with self.subTest(status=status):
                    Handler.status, Handler.body = status, body
                    with self.assertRaisesRegex(RuntimeError, 'Refusing to record: cannot verify existing server'):
                        asyncio.run(reuse())
                    self.assertTrue(record.port_answers(port))
            with patch.object(record, 'urlopen', side_effect=TimeoutError('timed out')):
                with self.assertRaisesRegex(RuntimeError, 'cannot verify existing server.*timed out'):
                    asyncio.run(reuse())
            start.assert_not_called()

    def test_low_fps_does_not_register_unless_overridden(self):
        shot = record.load_scenario(self.scenario)['motion']
        shot.serve = []
        capture = record.Capture([(100.0, Path('one')), (100.1, Path('two'))], [], 100.2,
                                 dropped=2)
        args = SimpleNamespace(slug='synthetic', root=self.root, out=self.root / 'media',
                               manifest=self.root / 'catalog/videos.json', allow_low_fps=False)

        def encode(recording, directory, video, poster, poster_at):
            video.write_bytes(b'synthetic video')
            poster.write_bytes(b'synthetic poster')
            return 0.2, {'width': 1920, 'height': 1080}

        with patch.object(record, 'capture', new=AsyncMock(return_value=capture)), \
                patch.object(record, 'encode', side_effect=encode), \
                contextlib.redirect_stdout(io.StringIO()) as output, \
                contextlib.redirect_stderr(io.StringIO()):
            self.assertFalse(asyncio.run(record.record_shot(None, shot, 'motion', args)))
            self.assertRegex(output.getvalue(), r'synthetic/motion: frames=2 .* dropped=2\n')
            self.assertFalse(args.manifest.exists())
            args.allow_low_fps = True
            self.assertTrue(asyncio.run(record.record_shot(None, shot, 'motion', args)))
            args.allow_low_fps = False
            old_manifest = args.manifest.read_bytes()
            video = args.out / 'synthetic/motion.mp4'
            video.write_bytes(b'previous accepted recording')
            self.assertFalse(asyncio.run(record.record_shot(None, shot, 'motion', args)))
            self.assertEqual(args.manifest.read_bytes(), old_manifest)
            self.assertEqual(video.read_bytes(), b'previous accepted recording')
        self.assertEqual(json.loads(args.manifest.read_text())['videos'][0]['fps'], 10.0)

    def assert_preview(self, entry, duration):
        preview = self.root / entry['preview']
        self.assertEqual(entry['preview'], 'media/synthetic/overview-preview.mp4')
        self.assertEqual(entry['preview_sha256'], hashlib.sha256(preview.read_bytes()).hexdigest())
        self.assertEqual(entry['preview_bytes'], preview.stat().st_size)
        probe = json.loads(record.command([
            'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(preview)]))
        self.assertEqual(len(probe['streams']), 1, 'Preview must contain only video')
        stream = probe['streams'][0]
        self.assertEqual((stream['width'], stream['height']), (854, 480))
        self.assertEqual((stream['codec_name'], stream['pix_fmt']), ('h264', 'yuv420p'))
        self.assertAlmostEqual(float(probe['format']['duration']), duration, delta=0.1)
        content = preview.read_bytes()
        self.assertLess(content.index(b'moov'), content.index(b'mdat'))

    def synthetic_video(self, duration):
        video = self.root / 'media/synthetic/recorded-overview.mp4'
        video.parent.mkdir(parents=True, exist_ok=True)
        record.command(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                        'testsrc2=size=320x180:rate=30', '-f', 'lavfi', '-i',
                        'sine=frequency=440', '-t', str(duration), '-c:v', 'libx264',
                        '-preset', 'ultrafast', '-c:a', 'aac', str(video)])
        return video

    def assert_readme_preview(self, entry, duration, suffix=None):
        preview = self.root / entry['readme_preview']
        if suffix is None:
            suffix = '.webp' if record.pillow_webp_available() or shutil.which('img2webp') else '.gif'
        self.assertEqual(preview.suffix, suffix)
        self.assertEqual(entry['readme_preview'], 'previews/synthetic' + preview.suffix)
        self.assertLessEqual(preview.stat().st_size, 3_000_000)
        with Image.open(preview) as animation:
            self.assertEqual(animation.size, (480, 270))
            self.assertTrue(animation.is_animated)
            self.assertGreater(animation.n_frames, 1)
            self.assertEqual(animation.info['loop'], 0)
            elapsed = 0
            frames = set()
            for index in range(animation.n_frames):
                animation.seek(index)
                animation.load()
                elapsed += animation.info['duration'] / 1000
                frames.add(hashlib.sha256(animation.convert('RGB').tobytes()).digest())
            self.assertGreater(len(frames), 1, 'Preview must show changing frames')
            self.assertAlmostEqual(elapsed, duration, delta=0.15)

    @unittest.skipUnless(record.pillow_webp_available() or shutil.which('img2webp'),
                         'Pillow webp_anim or img2webp required')
    def test_readme_preview_animation_timing_and_size(self):
        preview = self.root / 'previews/synthetic.webp'
        for duration, override, expected_start in [(12, None, 2.4), (12, 1.0, 1.0),
                                                    (12, 99.0, 4.0), (3, None, 0.0)]:
            with self.subTest(duration=duration, override=override):
                video = self.synthetic_video(duration)
                original = video.read_bytes()
                with patch.object(record, 'command', wraps=record.command) as commands, \
                        patch.object(Image.Image, 'save', autospec=True,
                                     side_effect=Image.Image.save) as saves:
                    entry = record.build_readme_preview(video, preview, self.root, override)
                encode = next(call.args[0] for call in commands.call_args_list if '-ss' in call.args[0])
                self.assertAlmostEqual(float(encode[encode.index('-ss') + 1]), expected_start)
                self.assertIn('fps=12,scale=480:', encode[encode.index('-vf') + 1])
                self.assertEqual(encode[encode.index('-c:v') + 1], 'png')
                self.assertFalse(any('-encoders' in call.args[0] for call in commands.call_args_list))
                if record.pillow_webp_available():
                    saves.assert_called_once()
                    self.assertEqual(saves.call_args.kwargs['quality'], 60)
                    self.assertEqual(saves.call_args.kwargs['method'], 6)
                    self.assertTrue(saves.call_args.kwargs['save_all'])
                    self.assertFalse(any(Path(call.args[0][0]).name == 'img2webp'
                                         for call in commands.call_args_list))
                self.assert_readme_preview(entry, min(6, duration), '.webp')
                self.assertEqual(video.read_bytes(), original)

    def test_readme_preview_without_pillow_prefers_img2webp(self):
        video = self.synthetic_video(8)
        suffix = '.webp' if shutil.which('img2webp') else '.gif'
        with patch.object(record, 'pillow_webp_available', return_value=False):
            entry = record.build_readme_preview(video, self.root / 'previews/synthetic.webp', self.root)
        self.assert_readme_preview(entry, 6, suffix)

    def test_readme_preview_gif_fallback(self):
        video = self.synthetic_video(8)
        with patch.object(record, 'pillow_webp_available', return_value=False), \
                patch.object(record.shutil, 'which', return_value=None):
            entry = record.build_readme_preview(video, self.root / 'previews/synthetic.webp', self.root)
        self.assert_readme_preview(entry, 6, '.gif')

    @unittest.skipUnless(record.pillow_webp_available() or shutil.which('img2webp'),
                         'Pillow webp_anim or img2webp required')
    def test_readme_preview_reduces_size_and_preserves_previous_on_failure(self):
        video = self.synthetic_video(8)
        preview = self.root / 'previews/synthetic.webp'
        original_encode = record.encode_readme_webp
        attempts = []

        def oversized_first(frames, staged, fps, quality, img2webp):
            original_encode(frames, staged, fps, quality, img2webp)
            attempts.append((fps, quality, len(frames)))
            if len(attempts) == 1:
                with staged.open('ab') as output:
                    output.truncate(3_000_001)

        with patch.object(record, 'encode_readme_webp', side_effect=oversized_first):
            entry = record.build_readme_preview(video, preview, self.root)
        self.assertEqual(attempts, [(12, 60, 72), (10, 50, 60)])
        self.assert_readme_preview(entry, 6)
        output = self.root / entry['readme_preview']
        original = output.read_bytes()

        def always_oversized(frames, staged, fps, quality, img2webp):
            with staged.open('wb') as output:
                output.truncate(3_000_001)

        with patch.object(record, 'encode_readme_webp', side_effect=always_oversized) as encode:
            with self.assertRaisesRegex(RuntimeError, 'exceeds 3 MB'):
                record.build_readme_preview(video, preview, self.root)
        self.assertEqual(encode.call_count, 7)
        self.assertEqual(output.read_bytes(), original)
        self.assertFalse(list(preview.parent.glob('.readme-preview-*')))

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg/ffprobe required')
    def test_preview_length_default_start_override_and_short_clips(self):
        preview = self.root / 'media/synthetic/overview-preview.mp4'
        for duration, override, expected_start in [(12, None, 2.4), (12, 1.0, 1.0),
                                                    (12, 99.0, 4.0), (3, None, 0.0)]:
            with self.subTest(duration=duration, override=override):
                video = self.synthetic_video(duration)
                original = video.read_bytes()
                with patch.object(record, 'command', wraps=record.command) as commands:
                    entry = record.build_preview(video, preview, self.root, override)
                encode = next(call.args[0] for call in commands.call_args_list if call.args[0][0] == 'ffmpeg')
                self.assertAlmostEqual(float(encode[encode.index('-ss') + 1]), expected_start)
                self.assertEqual(encode[encode.index('-crf') + 1], '28')
                self.assert_preview(entry, min(8, duration))
                self.assertEqual(video.read_bytes(), original)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg/ffprobe required')
    def test_preview_only_updates_only_preview_fields(self):
        video = self.synthetic_video(12)
        original = video.read_bytes()
        manifest = self.root / 'catalog/videos.json'
        data = {'schema_version': 1, 'custom': 'keep', 'videos': [
            {'id': 'z/overview', 'project': 'z', 'file': 'missing.mp4'},
            {'id': 'synthetic/overview', 'project': 'synthetic',
             'file': video.relative_to(self.root).as_posix(), 'sha256': 'unchanged-main-hash',
             'bytes': 123, 'duration': 999, 'custom': 'keep'},
            {'id': 'synthetic/motion', 'project': 'synthetic', 'file': 'missing.mp4'}]}
        manifest.write_text(json.dumps(data))
        # A preview rebuild must not need candidate validation or browser recording.
        self.candidates.unlink()
        self.scenario.write_text(self.source + "\nSHOTS['overview'].preview_at = 1.0\n")
        for has_scenario in [True, False]:
            with self.subTest(has_scenario=has_scenario):
                if not has_scenario:
                    self.scenario.unlink()
                result = self.cli('--preview-only')
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                updated = json.loads(manifest.read_text())
                self.assert_preview(updated['videos'][1], 8)
                self.assert_readme_preview(updated['videos'][1], 6)
                # Corrupt only the disposable fixture to prove the next run rebuilds it.
                (self.root / updated['videos'][1]['readme_preview']).write_bytes(b'rebuild me')
                for field in ('preview', 'preview_sha256', 'preview_bytes', 'readme_preview'):
                    del updated['videos'][1][field]
                self.assertEqual(updated, data)
                self.assertEqual(video.read_bytes(), original)
                self.assertFalse(record.port_answers(self.port))

    def assert_custom_readme_preview(self, manifest, out):
        self.assertFalse((self.root / 'previews').exists(),
                         'Custom --out must not create <root>/previews')
        entry = json.loads(manifest.read_text())['videos'][0]
        preview = out / 'synthetic.webp'
        self.assertTrue(preview.is_file())
        self.assertEqual(entry['readme_preview'],
                         Path(os.path.relpath(preview, self.root)).as_posix())
        with Image.open(preview) as animation:
            self.assertTrue(animation.is_animated)
            self.assertGreater(animation.n_frames, 1)

    def test_record_overview_custom_out_keeps_readme_preview_outside_root(self):
        with tempfile.TemporaryDirectory(prefix='gameref-record-output-') as temporary:
            out = Path(temporary).resolve() / 'takes'
            manifest = Path(temporary) / 'videos.json'
            result = self.cli('overview', '--allow-low-fps', '--out', str(out),
                              '--manifest', str(manifest))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue((out / 'synthetic/overview.mp4').is_file())
            self.assert_custom_readme_preview(manifest, out)

    def test_preview_only_custom_out_keeps_readme_preview_outside_root(self):
        video = self.synthetic_video(3)
        with tempfile.TemporaryDirectory(prefix='gameref-record-output-') as temporary:
            out = Path(temporary).resolve() / 'takes'
            manifest = Path(temporary) / 'videos.json'
            manifest.write_text(json.dumps({'schema_version': 1, 'videos': [
                {'id': 'synthetic/overview', 'project': 'synthetic',
                 'file': video.relative_to(self.root).as_posix()}]}))
            result = self.cli('--preview-only', '--out', str(out),
                              '--manifest', str(manifest))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue((out / 'synthetic/overview-preview.mp4').is_file())
            self.assert_custom_readme_preview(manifest, out)

    def test_record_synthetic(self):
        if not shutil.which('ffmpeg'):
            self.skipTest('ffmpeg is unavailable on PATH')

        async def check_chrome():
            from playwright.async_api import async_playwright, Error

            async with async_playwright() as playwright:
                try:
                    browser = await playwright.chromium.launch(
                        headless=True, channel='chrome', args=record.CHROME_ARGS)
                except Error as error:
                    if 'not found' in str(error) or "doesn't exist" in str(error):
                        self.skipTest('Installed Chrome is unavailable: ' + str(error).splitlines()[0])
                    raise
                await browser.close()

        asyncio.run(check_chrome())
        # The default test checks output integrity on slower CI; E2E enforces fps.
        extra = [] if os.environ.get('RECORD_E2E') == '1' else ['--allow-low-fps']
        result = self.cli(*extra)
        print('\n' + result.stdout, end='', flush=True)
        if result.stderr:
            print(result.stderr, end='', flush=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        out = self.root / 'media/synthetic'
        video = out / 'motion.mp4'
        self.assertTrue(video.is_file())
        probe = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
            '-show_entries', 'stream=width,height,nb_read_frames,avg_frame_rate,codec_name,pix_fmt:format=duration',
            '-of', 'json', str(video),
        ], text=True))
        duration = float(probe['format']['duration'])
        self.assertAlmostEqual(duration, 3.0, delta=0.6)
        stream = probe['streams'][0]
        self.assertGreaterEqual(int(stream['nb_read_frames']), 60)
        self.assertEqual((stream['width'], stream['height']), (1920, 1080))
        self.assertEqual(stream['avg_frame_rate'], '60/1')
        self.assertEqual((stream['codec_name'], stream['pix_fmt']), ('h264', 'yuv420p'))
        captions = (out / 'motion.vtt').read_text(encoding='utf-8')
        self.assertTrue(captions.startswith('WEBVTT'))
        for text in ['方块持续移动', '按住 W 变为绿色', '松开 W 恢复橙色']:
            self.assertIn(text, captions)
        times = re.findall(r'(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})', captions)
        self.assertEqual(len(times), 3)
        self.assertLess(times[-1][1], '00:00:03.000')
        self.assertTrue((out / 'motion.jpg').read_bytes().startswith(b'\xff\xd8'))
        manifest = json.loads((self.root / 'catalog/videos.json').read_text())
        self.assertEqual(manifest['schema_version'], 1)
        self.assertEqual([v['id'] for v in manifest['videos']], ['synthetic/motion', 'synthetic/overview'])
        self.assert_preview(manifest['videos'][1], manifest['videos'][1]['duration'])
        self.assert_readme_preview(manifest['videos'][1], manifest['videos'][1]['duration'])
        self.assertEqual((out / 'overview.vtt').read_bytes(), b'WEBVTT\n')
        entry = manifest['videos'][0]
        self.assertEqual(set(entry), {'id', 'project', 'module', 'file', 'poster', 'captions',
                                     'duration', 'fps', 'width', 'height', 'bytes', 'sha256',
                                     'recorded_at', 'scenario', 'method'})
        self.assertEqual(entry['sha256'], hashlib.sha256(video.read_bytes()).hexdigest())
        self.assertEqual(entry['bytes'], video.stat().st_size)
        self.assertEqual(entry['module'], 'synthetic.motion')
        self.assertEqual(entry['duration'], round(duration, 2))
        self.assertEqual((entry['width'], entry['height']), (1920, 1080))
        for field, suffix in [('file', 'mp4'), ('poster', 'jpg'), ('captions', 'vtt')]:
            self.assertEqual(entry[field], 'media/synthetic/motion.' + suffix)
        self.assertEqual(entry['scenario'], 'tools/scenarios/synthetic.py#motion')
        self.assertEqual(entry['method'], 'cdp-screencast')
        self.assertRegex(entry['recorded_at'], r'^\d{4}-\d\d-\d\dT.*Z$')
        self.assertIn('synthetic/motion blocked: http://example.invalid:9999/blocked', result.stdout)
        self.assertIn('synthetic/motion blocked: ws://example.invalid:9999/blocked', result.stdout)
        self.assertIn('console error: synthetic console diagnostic', result.stdout)
        self.assertIn('page error: synthetic page diagnostic', result.stdout)
        self.assertFalse(record.port_answers(self.port), 'Recorder left its server running')
        if os.environ.get('RECORD_E2E') == '1':
            for entry in manifest['videos']:
                self.assertGreaterEqual(entry['fps'], 45, entry['id'])


if __name__ == '__main__':
    unittest.main()
