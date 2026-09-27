"""Check literal local references without installing runtime dependencies."""

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
errors = []
checked = 0


def check(base, reference):
    global checked
    url = urlsplit(reference)
    if url.scheme or url.netloc or not url.path:
        return
    path = base / unquote(url.path)
    checked += 1
    if not path.is_file():
        errors.append(f"Missing local file: {path.relative_to(ROOT)}")


html = (ROOT / "index.html").read_text()
imports = json.loads(re.search(
    r'<script type="importmap">\s*(.*?)\s*</script>', html, re.S
).group(1))["imports"]


class Assets(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("src", "href") and value:
                check(ROOT, value)


Assets().feed(html)
# Covers static imports/exports, literal dynamic imports, and this project's
# loadModule wrapper. Computed module paths require browser verification.
pattern = re.compile(
    r'''(?:\bfrom\s*|\b(?:import|loadModule)\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]'''
)
for folder in ("src", "vendor"):
    for file in (ROOT / folder).rglob("*.js"):
        # The independent garden entry uses npm/Vite resolution, not index.html's
        # vendored import map. Its module/assets graph is checked by vite build.
        if file.is_relative_to(ROOT / "src" / "garden"):
            continue
        for reference in pattern.findall(file.read_text()):
            if reference.startswith("."):
                check(file.parent, reference)
            elif reference in imports:
                check(ROOT, imports[reference])
            else:
                prefix = next((key for key in imports if key.endswith("/")
                               and reference.startswith(key)), None)
                if prefix:
                    check(ROOT, imports[prefix] + reference[len(prefix):])
                else:
                    errors.append(f"Unmapped import in {file.relative_to(ROOT)}: {reference}")

for file in (ROOT / "styles").glob("*.css"):
    for reference in re.findall(r'url\(\s*[\'"]?([^\'"\s)]+)', file.read_text()):
        check(file.parent, reference)

for file in (ROOT / "assets").rglob("*.json"):
    json.loads(file.read_text())
    if file.parent.name == "lightmaps":
        check(file.parent, file.with_suffix(".png").name)

if errors:
    raise SystemExit("\n".join(errors))
print(f"Local references passed: {checked}. Asset JSON passed.")
