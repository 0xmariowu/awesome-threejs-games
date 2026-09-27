#!/usr/bin/env python3
"""Check Git's candidate files before import/push (Python 3.9+, stdlib only).

Sizes use binary MB (1024 * 1024 bytes). Content is read from the working tree;
run this before staging/pushing the same files. --public checks the whole tracked
tree without private-note exemptions. --history independently scans all reachable
blobs, including deleted files, without modifying refs or the working tree.
Reviewed secret false positives may be suppressed in tools/repo_check_allow.txt:
    relative/path.js:google-api-key:1 # Public client-side identifier, reviewed.
Entries match an exact path and secret rule, not other rules or other paths.
"""

import argparse
from collections import Counter
from fnmatch import fnmatchcase
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys


MB = 1024 * 1024
ALLOWLIST = "tools/repo_check_allow.txt"
SECRET_RULES = (
    ("pem-private-key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("aws-access-key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("openai-key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("github-token", re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}")),
    ("slack-token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("google-api-key", re.compile(r"AIza[0-9A-Za-z_-]{35}")),
    ("stripe-live-key", re.compile(r"sk_live_[0-9A-Za-z]{20,}")),
    ("generic-assignment", re.compile(
        r'''(?i)(api[_-]?key|secret|password|token)["']?\s*[:=]\s*["'](?P<value>[^"'\s]{16,})["']'''
    )),
)
SECRET_NAMES = {name for name, _ in SECRET_RULES} | {"sensitive-filename"}
HOME_PATH = re.compile(r"/(?:Users|home)/" + r'''[^/\s"'<>`]+/''')
# Split the local identity so the checker does not flag its own rule definition.
OWNER_USERNAME = "vi" + "mala"
SENSITIVE_FILENAMES = ('*.pem', 'id_rsa*', '*.key', '*.p12', '*.pfx', '*.jks',
                       '*.keystore', '.npmrc', '.netrc', 'credentials*.json',
                       'service-account*.json', 'google-services.json', 'GoogleService-Info.plist')
# Owner's 2026-09-27 public-release boundary; these stay on disk, outside Git.
PRIVATE_INKWAVE_PATHS = (
    'inkwave/docs/garden/*', 'inkwave/src/garden/*',
    'inkwave/tests/garden/*', 'inkwave/assets/garden/*',
    'inkwave/garden.html', 'inkwave/scripts/garden-*.py',
    'inkwave/scripts/garden-*.mjs', 'inkwave/package.json',
    'inkwave/package-lock.json', 'inkwave/vite.config.js',
)


class Checker:
    def __init__(self, root, strict=False, public=False, history=False):
        self.root = Path(root).resolve()
        self.strict = strict or public or history
        self.public = public
        self.history = history
        self.errors = 0
        self.warnings = 0
        self.allowed = {}
        self.matches = Counter()

    def report(self, path, line, rule, message, warning=False):
        if warning:
            self.warnings += 1
        else:
            self.errors += 1
        level = "WARNING" if warning else "ERROR"
        # Escape control characters in filenames to keep diagnostics on one line.
        location = ascii(str(path))[1:-1]
        print(f"{level} {location}:{line}: {rule}: {message}")

    def secret(self, path, line, rule, value):
        key = (path, rule)
        self.matches[key] += 1
        expected = self.allowed.get(key, 0)
        if expected is None or self.matches[key] <= expected:
            return
        masked = ascii(value[:4])[1:-1] + "…"
        prefix = f"extra match (expected {expected}): " if key in self.allowed else ""
        self.report(path, line, rule, f"{prefix}matched {masked}")

    def load_allowlist(self):
        path = self.root / ALLOWLIST
        if not path.exists():
            return
        if path.is_symlink():
            self.report(ALLOWLIST, 1, "allowlist", "must be a regular file")
            return
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeError):
            self.report(ALLOWLIST, 1, "allowlist", "cannot read UTF-8 allowlist")
            return
        for number, line in enumerate(lines, 1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            entry, marker, reason = line.partition("#")
            fields = entry.strip().split(":")
            if len(fields) not in (2, 3):
                self.report(ALLOWLIST, number, "allowlist", "expected path:secret-rule:count # reason")
                continue
            relative, rule = fields[:2]
            count = None
            if len(fields) == 3:
                if not re.fullmatch(r"[0-9]+", fields[2]):
                    self.report(ALLOWLIST, number, "allowlist", "count must be a nonnegative integer")
                    continue
                count = int(fields[2])
            parts = PurePosixPath(relative).parts
            if (not marker or not reason.strip()
                    or not relative or relative.startswith("/")
                    or ".." in parts or str(PurePosixPath(relative)) != relative
                    or rule not in SECRET_NAMES):
                self.report(ALLOWLIST, number, "allowlist", "expected path:secret-rule:count # reason")
                continue
            if (relative, rule) in self.allowed:
                self.report(ALLOWLIST, number, "allowlist", "duplicate path and rule")
                continue
            if count is None:
                self.report(ALLOWLIST, number, "allowlist", "add :count", warning=True)
            self.allowed[(relative, rule)] = count

    def candidate_files(self):
        # Reject a --root that would silently scan a surrounding repository.
        top = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], cwd=self.root,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
        )
        if Path(os.fsdecode(top.stdout).rstrip("\n")).resolve() != self.root:
            raise ValueError("--root must be the repository root")
        result = subprocess.run(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=self.root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
        )
        return sorted({os.fsdecode(path).rstrip("/")
                       for path in result.stdout.split(b"\0") if path})

    def nested_repositories(self, paths):
        directories = set()
        nested = set()
        for relative in paths:
            parts = PurePosixPath(relative).parts
            if ".git" in parts:
                nested.add("/".join(parts[:parts.index(".git") + 1]))
            path = self.root / relative
            directories.update(parent for parent in path.parents
                               if parent != self.root and self.root in parent.parents)
            if path.is_dir() and not path.is_symlink():
                # Git reports embedded repositories/gitlinks as directory entries.
                for current, children, _ in os.walk(path, followlinks=False,
                                                    onerror=self.walk_error):
                    directories.add(Path(current))
                    if ".git" in children:
                        children.remove(".git")
        for directory in directories:
            marker = directory / ".git"
            if marker.is_dir() or marker.is_file():
                nested.add(marker.relative_to(self.root).as_posix())
        for relative in sorted(nested):
            self.report(relative, 1, "nested-git", "nested Git metadata")

    def walk_error(self, error):
        self.report(".", 1, "read-error", "cannot inspect candidate directory")

    def scan_file(self, relative):
        path = self.root / relative
        parts = PurePosixPath(relative).parts
        if self.public:
            if any(fnmatchcase(relative, pattern) for pattern in PRIVATE_INKWAVE_PATHS):
                self.report(relative, 1, 'private-inkwave-file',
                            'private project file cannot be published')
            if (any(part in {'.claude', '.codex', 'experience'} for part in parts)
                    or parts[:2] == ('catalog', 'reviews')
                    or parts[0] in {'output', 'media'}
                    or relative in {'AGENTS.md', 'CLAUDE.md'}):
                self.report(relative, 1, 'private-file', 'internal file cannot be published')
            self.scan_identity(relative, relative, 1)
        name = path.name
        if (name == ".env" or name.startswith(".env.")
                or any(fnmatchcase(name, pattern) for pattern in SENSITIVE_FILENAMES)):
            self.secret(relative, 1, "sensitive-filename", name)
        try:
            # Never traverse links to files outside the candidate tree.
            if any(parent.is_symlink() for parent in path.parents
                   if parent != self.root and self.root in parent.parents):
                self.report(relative, 1, "read-error", "candidate parent is a symlink")
                return
            info = path.lstat()
            if stat.S_ISDIR(info.st_mode):
                return  # Embedded repository already checked above.
            if not (stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode)):
                self.report(relative, 1, "read-error", "candidate is not a regular file")
                return
            if info.st_size > 95 * MB:
                self.report(relative, 1, "file-size", "exceeds 95 MB")
            elif info.st_size > 50 * MB:
                self.report(relative, 1, "file-size", "exceeds 50 MB", warning=True)
            if stat.S_ISLNK(info.st_mode):
                data = os.fsencode(os.readlink(path))  # Git tracks the link text.
            else:
                with path.open("rb") as stream:
                    data = stream.read(8192)
                    if b"\0" in data:
                        return
                    if info.st_size > 5 * MB and not self.public:
                        self.report(relative, 1, "not-scanned", "text file over 5 MB", warning=True)
                        return
                    data += stream.read() if self.public else stream.read(5 * MB + 1 - len(data))
                if len(data) > 5 * MB and not self.public:
                    self.report(relative, 1, "read-error", "file changed during scan; retry")
                    return
        except OSError:
            self.report(relative, 1, "read-error", "cannot read candidate file")
            return
        text = data.decode("utf-8", errors="replace")
        for rule, pattern in SECRET_RULES:
            for match in pattern.finditer(text):
                value = match.group("value") if rule == "generic-assignment" else match.group()
                self.secret(relative, text.count("\n", 0, match.start()) + 1, rule, value)
        if self.public or PurePosixPath(relative).parts[0] != ".claude":
            for match in HOME_PATH.finditer(text):
                self.report(relative, text.count("\n", 0, match.start()) + 1,
                            "absolute-home-path", "absolute home path",
                            warning=not self.strict)
        if self.public:
            self.scan_identity(relative, text)

    def scan_identity(self, relative, text, line=None):
        for match in re.finditer(re.escape(OWNER_USERNAME), text, re.IGNORECASE):
            self.report(relative, line or text.count('\n', 0, match.start()) + 1,
                        'owner-username', 'local owner username')

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.root, check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

    def scan_history(self):
        # Enumerate every commit tree rather than rev-list --objects' single
        # guessed pathname, which loses aliases and renamed copies of blobs.
        commits = self.git('rev-list', '--all').decode('ascii').splitlines()
        blobs = {}
        for commit in commits:
            for entry in self.git('ls-tree', '-r', '-z', commit).split(b'\0'):
                if not entry:
                    continue
                metadata, filename = entry.split(b'\t', 1)
                _, kind, oid = metadata.decode('ascii').split()
                if kind == 'blob':
                    blobs.setdefault(oid, {}).setdefault(os.fsdecode(filename), commit)
        # Include blobs reached directly through tags/refs as well as commits.
        for entry in self.git('rev-list', '--objects', '--all', '--no-object-names').splitlines():
            oid = entry.decode('ascii')
            blobs.setdefault(oid, {})
        count = 0
        # One cat-file process avoids a subprocess per asset. Read binary payloads
        # too: no extension, size or private-directory exemptions in history.
        with subprocess.Popen(['git', 'cat-file', '--batch'], cwd=self.root,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE) as process:
            for oid, locations in blobs.items():
                process.stdin.write((oid + '\n').encode('ascii'))
                process.stdin.flush()
                header = process.stdout.readline().split()
                if len(header) != 3:
                    raise ValueError('cannot read history object')
                _, kind, size = header
                data = process.stdout.read(int(size))
                if len(data) != int(size) or process.stdout.read(1) != b'\n':
                    raise ValueError('truncated history object')
                if kind != b'blob':
                    continue
                count += 1
                text = data.decode('utf-8', errors='replace')
                findings = []
                for rule, pattern in (*SECRET_RULES, ('absolute-home-path', HOME_PATH)):
                    for match in pattern.finditer(text):
                        findings.append((text.count('\n', 0, match.start()) + 1, rule))
                for relative, commit in (locations or {'(direct blob ref)': oid}).items():
                    for line, rule in findings:
                        self.report(f'{commit}:{relative}', line, rule,
                                    'historical pattern match; value redacted')
            process.stdin.close()
            if process.wait() != 0:
                raise ValueError('history object reader failed')
        print(f'history: {len(commits)} commits, {count} unique blobs; '
              'findings deduplicated by blob/path, one containing commit shown; '
              'no allowlist suppression')

    def run(self):
        try:
            paths = self.candidate_files()
        except (OSError, subprocess.CalledProcessError, ValueError):
            self.report(".", 1, "git-files", "cannot list files; --root must be a Git repository root")
        else:
            if self.history:
                try:
                    self.scan_history()
                except (OSError, subprocess.CalledProcessError, ValueError):
                    self.report('.', 1, 'history-read', 'cannot complete history scan')
                print(f'repo_check: {self.errors} errors, {self.warnings} warnings')
                return int(self.errors > 0)
            self.load_allowlist()
            self.nested_repositories(paths)
            for relative in paths:
                self.scan_file(relative)
            for (relative, rule), expected in self.allowed.items():
                actual = self.matches[(relative, rule)]
                if expected is not None and actual < expected:
                    self.report(relative, 1, rule,
                                f"missing {expected - actual} matches (expected {expected}, found {actual})")
        print(f"repo_check: {self.errors} errors, {self.warnings} warnings")
        return int(self.errors > 0)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--strict", action="store_true", help="treat home paths as errors")
    parser.add_argument("--public", action="store_true", help="reject private files and identities; scan all tracked text")
    parser.add_argument("--history", action="store_true", help="scan all reachable blobs for secrets and home paths (read only)")
    args = parser.parse_args(argv)
    return Checker(args.root, args.strict, args.public, args.history).run()


if __name__ == "__main__":
    sys.exit(main())
