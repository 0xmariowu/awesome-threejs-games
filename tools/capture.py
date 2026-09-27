#!/usr/bin/env python3
"""Archive public browser dependencies and retain a checksum/provenance manifest."""
import argparse
import concurrent.futures
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
EXT = re.compile(r'\.(?:html?|m?js|css|json|webmanifest|wasm|pck|png|jpe?g|webp|avif|svg|gif|ico|ktx2?|basis|hdr|exr|glb|gltf|bin|ogg|mp3|wav|m4a|mp4|webm|woff2?|ttf|otf|zip|txt)(?:[?#].*)?$', re.I)
TEXT = {'.html', '.htm', '.js', '.mjs', '.css', '.json', '.webmanifest', '.gltf'}
IGNORE = ('googletagmanager.com', 'google-analytics.com', 'doubleclick.net', 'static.cloudflareinsights.com', 'scaleout.jp', 'ad-generation.jp', 'adnxs.com', 'googlesyndication.com')
LITERAL = re.compile(r'''["'`]([^"'`\s<>]{1,500})["'`]''')

def normalize(url):
    p = urlsplit(html.unescape(url))
    return urlunsplit((p.scheme, p.netloc, p.path or '/', p.query, ''))

def local_path(url, origin):
    p = urlsplit(url)
    parts = [v for v in unquote(p.path).split('/') if v and v not in ('.', '..')]
    if not parts or p.path.endswith('/'):
        parts.append('index.html')
    path = '/'.join(parts)
    if p.netloc != urlsplit(origin).netloc:
        if p.query:
            pp = Path(path)
            path = str(pp.with_name(pp.stem + '-' + hashlib.sha256(p.query.encode()).hexdigest()[:12] + pp.suffix))
        path = '_external/' + p.netloc + '/' + path
    return path

def references(text, source, entry, imports=None):
    refs = set()
    literals = [m.group(1) for m in LITERAL.finditer(text)]
    literals += re.findall(r'url\(\s*["\']?([^\s)"\']+)', text)
    for value in literals:
        value = html.unescape(value).replace('\\/', '/')
        if value.startswith(('data:', 'blob:', '#')) or '${' in value or '\\' in value:
            continue
        if not EXT.search(value) and not value.startswith(('https://fonts.googleapis.com/css',)):
            continue
        if any(x in value for x in IGNORE):
            continue
        if value.startswith(('https://', 'http://', '//', '/')):
            target = urljoin(source, value)
        elif imports and any(value.startswith(k) for k in imports):
            key = max((k for k in imports if value.startswith(k)), key=len)
            target = urljoin(entry, imports[key] + value[len(key):])
        elif value.startswith(('./', '../')):
            target = urljoin(source, value)
        elif urlsplit(source).path.endswith(('.js', '.mjs')) and '/' in value:
            target = urljoin(entry, value)
        else:
            target = urljoin(source, value)
        if urlsplit(target).netloc != urlsplit(entry).netloc and Path(urlsplit(target).path).suffix.lower() in ('.html', '.htm', '.txt', '.zip'):
            continue
        if urlsplit(target).scheme in ('http', 'https'):
            refs.add(normalize(target))
    return refs

class Capture:
    def __init__(self, slug, entry):
        self.folder = ROOT / slug
        self.public = self.folder / 'public'
        self.evidence = self.folder / 'provenance'
        self.entry = normalize(entry)
        self.records = {}
        self.failed = {}
        self.imports = {}
        self.public.mkdir(parents=True, exist_ok=True)
        self.evidence.mkdir(parents=True, exist_ok=True)
        manifest = self.evidence / 'manifest.json'
        if manifest.exists():
            data = json.loads(manifest.read_text())
            self.records = {r['url']: r for r in data['files']}
            self.failed = data.get('failed', {})

    def fetch(self, url):
        rel = local_path(url, self.entry)
        dest = self.public / rel
        if url in self.records and dest.exists():
            original = self.evidence / 'original-text' / rel
            return url, (original if original.exists() else dest).read_bytes(), self.records[url].get('content_type', '')
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + '.' + hashlib.sha256(url.encode()).hexdigest()[:12] + '.download')
        result = subprocess.run(['curl', '-L', '--retry', '2', '--max-time', '30', '-sS',
            '-A', 'Mozilla/5.0', '-o', str(tmp), '-w', '%{http_code}\n%{content_type}', url], capture_output=True, text=True)
        status, _, ctype = result.stdout.partition('\n')
        if result.returncode or status != '200':
            tmp.unlink(missing_ok=True)
            return url, None, f'HTTP {status}; {result.stderr[:160]}'
        body = tmp.read_bytes()
        if 'text/html' in ctype and dest.suffix not in ('.html', '.htm'):
            tmp.unlink(missing_ok=True)
            return url, None, 'Unexpected HTML instead of asset'
        tmp.replace(dest)
        self.records[url] = {'url': url, 'path': rel, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'content_type': ctype}
        if dest.suffix in TEXT or ctype.startswith('text/') or 'javascript' in ctype:
            original = self.evidence / 'original-text' / rel
            original.parent.mkdir(parents=True, exist_ok=True)
            original.write_bytes(body)
        return url, body, ctype

    def run(self, extra=()):
        pending = {self.entry, *extra}
        seen = set()
        while pending:
            batch = sorted(pending - seen)
            if not batch:
                break
            if len(seen) + len(batch) > 3500:
                raise RuntimeError('Capture safety limit reached; inspect scope')
            seen.update(batch)
            pending = set()
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                for url, body, ctype in pool.map(self.fetch, batch):
                    if body is None:
                        self.failed[url] = ctype
                        continue
                    self.failed.pop(url, None)
                    if Path(urlsplit(url).path).suffix in TEXT or ctype.startswith('text/') or 'javascript' in ctype:
                        source = body.decode('utf-8', errors='replace')
                        if url == self.entry:
                            for match in re.finditer(r'<script[^>]*type=["\']importmap["\'][^>]*>(.*?)</script>', source, re.S):
                                self.imports.update(json.loads(match.group(1)).get('imports', {}))
                            pending.update(normalize(urljoin(url, v)) for v in self.imports.values() if not v.endswith('/'))
                        pending.update(references(source, url, self.entry, self.imports))
            self.save()
            print(json.dumps({'slug': self.folder.name, 'files': len(self.records), 'failed': len(self.failed), 'next': len(pending-seen)}), flush=True)
        self.rewrite()
        self.save()

    def rewrite(self):
        replacements = {url: '/' + rec['path'] for url, rec in self.records.items() if urlsplit(url).netloc != urlsplit(self.entry).netloc}
        for key, value in self.imports.items():
            if value.endswith('/') and urlsplit(value).netloc:
                replacements[value] = '/' + local_path(value + '__prefix__', self.entry).rsplit('/', 1)[0] + '/'
        for original in (self.evidence / 'original-text').rglob('*'):
            if not original.is_file():
                continue
            rel = original.relative_to(self.evidence / 'original-text')
            text = original.read_bytes().decode('utf-8', errors='replace')
            for url, dest in sorted(replacements.items(), key=lambda p: -len(p[0])):
                text = text.replace(url, dest).replace(html.escape(url, quote=False), dest)
            text = re.sub(r'<script\b[^>]*src=["\'][^"\']*(?:googletagmanager\.com|/\.netlify/scripts/hud)[^"\']*["\'][^>]*>\s*</script>', '', text)
            (self.public / rel).write_text(text)

    def save(self):
        for rec in self.records.values():
            p = self.public / rec['path']
            if p.exists():
                rec['local_sha256'] = hashlib.sha256(p.read_bytes()).hexdigest()
        (self.evidence / 'manifest.json').write_text(json.dumps({'source': self.entry, 'entry_path': '/' + local_path(self.entry, self.entry), 'files': sorted(self.records.values(), key=lambda r:r['path']), 'failed': self.failed}, indent=2) + '\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('slug')
    parser.add_argument('url')
    parser.add_argument('--extra-file')
    args = parser.parse_args()
    extra = json.loads(Path(args.extra_file).read_text()) if args.extra_file else []
    Capture(args.slug, args.url).run(extra)
