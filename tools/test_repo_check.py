"""Exercise the import gate only against disposable Git repositories."""

import contextlib
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from tools import repo_check


class RepoCheckTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.git("init", "-q")
        # Keep host-wide ignore rules from removing intentional test fixtures.
        self.git("config", "core.excludesFile", os.devnull)

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def write(self, relative, body):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body.encode("utf-8") if isinstance(body, str) else body)
        return path

    def check(self, *options):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = repo_check.main(["--root", str(self.root), *options])
        return status, output.getvalue()

    def test_clean_repo_and_cli_pass(self):
        self.write("README.md", "A clean archive.\n")
        self.git("add", "README.md")
        self.write("untracked.txt", "also clean\n")
        self.assertEqual(self.check(), (0, "repo_check: 0 errors, 0 warnings\n"))
        result = subprocess.run(
            [sys.executable, str(Path(repo_check.__file__).resolve()),
             "--root", str(self.root)], cwd=self.root,
            text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "repo_check: 0 errors, 0 warnings\n")

    def test_nested_git_directory(self):
        self.write("game/readme.txt", "archive")
        self.git("-C", "game", "init", "-q")
        status, output = self.check()
        self.assertEqual(status, 1)
        self.assertIn("game/.git:1: nested-git", output)
        self.assertIn("repo_check: 1 errors, 0 warnings", output)

    def test_nested_git_beside_already_tracked_file(self):
        self.write("game/readme.txt", "archive")
        self.git("add", "game/readme.txt")
        (self.root / "game/.git").mkdir()
        self.assertIn("game/.git:1: nested-git", self.check()[1])

    def test_git_component_in_file_list(self):
        # Git itself normally refuses these names; test the explicit guard.
        self.write("archive/.git/config", "metadata")
        with patch.object(repo_check.Checker, "candidate_files",
                          return_value=["archive/.git/config"]):
            status, output = self.check()
        self.assertEqual(status, 1)
        self.assertIn("archive/.git:1: nested-git", output)

    def test_ignored_files_and_repositories_are_excluded(self):
        self.write(".gitignore", "ignored/\n")
        self.write("ignored/.env", "do not scan")
        self.git("-C", "ignored", "init", "-q")
        self.assertEqual(self.check()[0], 0)

    def test_cached_files_are_checked_even_if_now_ignored(self):
        self.write("tracked.txt", "AKIA" + "A" * 16)
        self.git("add", "tracked.txt")
        self.write(".gitignore", "tracked.txt\n")
        self.assertIn("tracked.txt:1: aws-access-key", self.check()[1])

    def sparse(self, relative, size):
        with (self.root / relative).open("wb") as stream:
            stream.truncate(size)

    def test_96_mb_sparse_file_is_error(self):
        self.sparse("large.bin", 96 * repo_check.MB)
        status, output = self.check()
        self.assertEqual(status, 1)
        self.assertIn("large.bin:1: file-size: exceeds 95 MB", output)

    def test_size_boundaries(self):
        self.sparse("fifty.bin", 50 * repo_check.MB)
        self.sparse("warning.bin", 50 * repo_check.MB + 1)
        self.sparse("ninety-five.bin", 95 * repo_check.MB)
        status, output = self.check()
        self.assertEqual(status, 0)
        self.assertIn("repo_check: 0 errors, 2 warnings", output)

    def test_each_secret_rule_is_detected_and_masked(self):
        samples = [
            ("pem-private-key", "-----BEGIN " + "RSA PRIVATE KEY-----"),
            ("aws-access-key", "AKIA" + "A" * 16),
            ("openai-key", "sk-" + "B" * 24),
            ("github-token", "ghp_" + "C" * 30),
            ("slack-token", "xoxb-" + "D" * 12),
            ("google-api-key", "AIza" + "E" * 35),
            ("stripe-live-key", "sk_live_" + "F" * 20),
            ("generic-assignment", "ABCD" + "G" * 16),
        ]
        for rule, value in samples:
            with self.subTest(rule=rule):
                body = 'API_KEY = "' + value + '"' if rule == "generic-assignment" else value
                self.write("sample.txt", "safe first line\n" + body + "\n")
                status, output = self.check()
                self.assertEqual(status, 1)
                self.assertIn("sample.txt:2: " + rule, output)
                self.assertIn(value[:4] + "…", output)
                self.assertNotIn(value[:5], output)
                self.assertNotIn(value, output)
                self.assertIn("repo_check: 1 errors, 0 warnings", output)

    def test_sensitive_filenames(self):
        names = [".env", ".env.local", "key.pem", "id_rsa", "id_rsa.pub", "private.key",
                 "cert.p12", "cert.pfx", "store.jks", "store.keystore", ".npmrc", ".netrc",
                 "credentials.json", "credentials-dev.json", "service-account.json",
                 "service-account-dev.json", "google-services.json", "GoogleService-Info.plist"]
        for name in names:
            self.write("config/" + name, "")
        status, output = self.check()
        self.assertEqual(status, 1)
        self.assertEqual(output.count(": sensitive-filename:"), len(names))

    def test_allowlist_requires_reason_and_matches_only_path_and_rule(self):
        first = "AKIA" + "H" * 16
        second = "sk-" + "I" * 24
        self.write("one.txt", first + "\n" + second)
        self.write("two.txt", first)
        self.write(repo_check.ALLOWLIST, "one.txt:aws-access-key:1 # Reviewed fixture\n")
        status, output = self.check()
        self.assertEqual(status, 1)
        self.assertNotIn("one.txt:1: aws-access-key", output)
        self.assertIn("one.txt:2: openai-key", output)
        self.assertIn("two.txt:1: aws-access-key", output)
        self.assertIn("repo_check: 2 errors, 0 warnings", output)
        for entry in ["one.txt:aws-access-key", "one.txt:aws-access-key #   "]:
            with self.subTest(entry=entry):
                self.write(repo_check.ALLOWLIST, entry)
                status, output = self.check()
                self.assertEqual(status, 1)
                self.assertIn("one.txt:1: aws-access-key", output)
                self.assertIn(": allowlist:", output)
                self.assertNotIn(first, output)

    def test_reviewed_single_finding_passes(self):
        self.write("web.js", "AIza" + "J" * 35)
        self.write(repo_check.ALLOWLIST,
                   "# Reviewed public configuration\nweb.js:google-api-key:1 # Public Firebase identifier\n")
        self.assertEqual(self.check(), (0, "repo_check: 0 errors, 0 warnings\n"))

    def test_binary_skip(self):
        self.write("image.bin", b"\0" + b"AKIA" + b"K" * 16)
        self.assertEqual(self.check()[0], 0)

    def test_secret_after_first_read_has_line_number_and_mask(self):
        value = 'AKIA' + 'Q' * 16
        self.write('late.txt', ('safe line\n' * 1000) + value + '\n')
        status, output = self.check()
        self.assertEqual(status, 1)
        self.assertIn('late.txt:1001: aws-access-key: matched AKIA…', output)
        self.assertNotIn(value[:5], output)

    def test_allowlist_counts_extra_missing_and_removed_file(self):
        value = 'AKIA' + 'R' * 16
        self.write(repo_check.ALLOWLIST, 'sample.txt:aws-access-key:2 # Reviewed fixture\n')
        for count in (2, 3, 1, 0):
            with self.subTest(count=count):
                self.write('sample.txt', (value + '\n') * count)
                status, output = self.check()
                self.assertEqual(status, int(count != 2))
                if count > 2:
                    self.assertIn('sample.txt:3: aws-access-key: extra match (expected 2)', output)
                elif count < 2:
                    self.assertIn(f'missing {2 - count} matches (expected 2, found {count})', output)
                self.assertNotIn(value[:5], output)
        (self.root / 'sample.txt').unlink()
        self.assertIn('missing 2 matches', self.check()[1])

    def test_legacy_allowlist_warns(self):
        self.write('sample.txt', 'AKIA' + 'S' * 16)
        self.write(repo_check.ALLOWLIST, 'sample.txt:aws-access-key # Reviewed fixture\n')
        status, output = self.check()
        self.assertEqual(status, 0)
        self.assertIn('WARNING tools/repo_check_allow.txt:1: allowlist: add :count', output)

    def test_invalid_allowlist_counts_are_errors(self):
        for count in ('-1', '1.5', 'many', ''):
            with self.subTest(count=count):
                self.write(repo_check.ALLOWLIST, f'sample.txt:aws-access-key:{count} # Fixture\n')
                status, output = self.check()
                self.assertEqual(status, 1)
                self.assertIn('count must be a nonnegative integer', output)

    def test_home_pattern_does_not_match_checker_source(self):
        self.assertIsNone(repo_check.HOME_PATH.search(Path(repo_check.__file__).read_text()))
        self.assertIsNone(repo_check.HOME_PATH.search("'/" + "home/fixture', '/assets/'"))

    def test_large_content_is_skipped_but_filename_is_checked(self):
        self.write('large.txt', b'a' * (5 * repo_check.MB + 1))
        status, output = self.check()
        self.assertEqual(status, 0)
        self.assertIn('WARNING large.txt:1: not-scanned: text file over 5 MB', output)
        (self.root / "large.txt").rename(self.root / ".env")
        self.assertIn("sensitive-filename", self.check()[1])

    def test_home_path_warning_and_strict_error(self):
        self.write("notes.txt", "line one\n" + "/Users/" + "x/project/\n")
        status, output = self.check()
        self.assertEqual(status, 0)
        self.assertIn("WARNING notes.txt:2: absolute-home-path", output)
        self.assertIn("repo_check: 0 errors, 1 warnings", output)
        status, output = self.check("--strict")
        self.assertEqual(status, 1)
        self.assertIn("ERROR notes.txt:2: absolute-home-path", output)
        self.assertIn("repo_check: 1 errors, 0 warnings", output)

    def test_claude_exemption_is_only_for_home_paths(self):
        self.write(".claude/plan.md", "/Users/" + "x/project/\n" + "AKIA" + "M" * 16)
        status, output = self.check("--strict")
        self.assertEqual(status, 1)
        self.assertNotIn("absolute-home-path", output)
        self.assertIn("aws-access-key", output)

    def test_symlink_scans_link_text_without_following_target(self):
        self.write(".git/private.txt", "AKIA" + "N" * 16)
        os.symlink(".git/private.txt", self.root / "link.txt")
        self.assertEqual(self.check()[0], 0)

    def test_missing_cached_file_fails_closed(self):
        path = self.write("missing.txt", "content")
        self.git("add", "missing.txt")
        path.unlink()
        status, output = self.check()
        self.assertEqual(status, 1)
        self.assertIn("read-error", output)

    def test_non_repository_fails_with_summary(self):
        with tempfile.TemporaryDirectory() as other:
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                status = repo_check.main(["--root", other])
            self.assertEqual(status, 1)
            self.assertIn("repo_check: 1 errors, 0 warnings", output.getvalue())

    def test_public_rejects_private_inkwave_paths_even_when_force_tracked(self):
        paths = [
            'inkwave/docs/garden/README.md',
            'inkwave/src/garden/shared/runtime/main.js',
            'inkwave/tests/garden/combat.test.mjs',
            'inkwave/assets/garden/audio/rifle.mp3',
            'inkwave/garden.html',
            'inkwave/scripts/garden-audio.py',
            'inkwave/scripts/garden-check.mjs',
            'inkwave/package.json',
            'inkwave/package-lock.json',
            'inkwave/vite.config.js',
        ]
        self.write('.gitignore', '/inkwave/\n')
        for relative in paths:
            self.write(relative, b'\x00private asset')
        self.git('add', '-f', *paths)
        status, output = self.check('--public')
        self.assertEqual(status, 1)
        for relative in paths:
            self.assertIn(relative + ':1: private-inkwave-file:', output)
        self.assertEqual(output.count('private-inkwave-file:'), len(paths))
        self.assertEqual(self.check()[0], 0)
        self.git('rm', '-r', '--cached', 'inkwave')
        self.assertEqual(self.check('--public')[0], 0)
        self.assertTrue(all((self.root / relative).exists() for relative in paths))

    def test_public_allows_original_inkwave_and_unrelated_gardens(self):
        for relative in ['inkwave/index.html', 'inkwave/src/main.js',
                         'inkwave/scripts/check-assets.py',
                         'cloudkeep/assets/floating-gardens.js',
                         'tableparty-kart/garden.html']:
            self.write(relative, 'public game')
        self.git('add', '.')
        self.assertEqual(self.check('--public')[0], 0)

    def test_public_rejects_private_tree_even_when_ignored(self):
        names = ['.claude/plan.md', 'experience/note.md', 'catalog/reviews/review.md',
                 'nested/.claude/plan.md', 'nested/experience/note.md', '.codex/config',
                 'nested/.codex/config', 'AGENTS.md', 'CLAUDE.md', 'output/run.txt', 'media/a.txt']
        for name in names:
            self.write(name, 'internal')
        self.git('add', '.')
        self.write('.gitignore', '\n'.join(names))
        status, output = self.check('--public')
        self.assertEqual(status, 1)
        self.assertEqual(output.count(': private-file:'), len(names))
        self.assertNotIn('WARNING', output)

    def test_public_scans_all_text_including_large_files_and_private_notes(self):
        username = 'fixture' + '_owner'
        for prefix in ('Users', 'home'):
            self.write('.claude/note.txt', '/' + prefix + '/' + username + '/project')
            with patch.object(repo_check, 'OWNER_USERNAME', username):
                status, output = self.check('--public')
            self.assertEqual(status, 1)
            self.assertIn('absolute-home-path', output)
            self.assertIn('owner-username', output)
            self.assertNotIn('WARNING', output)
        self.write('large.txt', 'a' * (6 * repo_check.MB) + '\n' + 'AKIA' + 'Z' * 16)
        status, output = self.check('--public')
        self.assertEqual(status, 1)
        self.assertIn('large.txt:2: aws-access-key', output)
        self.assertNotIn('not-scanned', output)

    def test_public_owner_identity_in_text_and_filename(self):
        username = 'fixture' + '_owner'
        self.write(username + '.txt', username.upper())
        with patch.object(repo_check, 'OWNER_USERNAME', username):
            status, output = self.check('--public')
        self.assertEqual(status, 1)
        self.assertEqual(output.count(': owner-username:'), 2)

    def test_public_keeps_secret_allowlist_but_never_allows_private_paths(self):
        self.write('.claude/note.txt', 'AKIA' + 'Z' * 16)
        self.write(repo_check.ALLOWLIST, '.claude/note.txt:aws-access-key:1 # Synthetic fixture\n')
        status, output = self.check('--public')
        self.assertEqual(status, 1)
        self.assertIn('private-file', output)
        self.assertNotIn('aws-access-key:', output)

    def test_history_all_refs_and_blob_aliases_without_worktree_or_allowlist(self):
        # Synthetic read-only Git protocol: no commits or refs are created.
        blob = 'b' * 40
        first, second = '1' * 40, '2' * 40
        payload = ('\0' + 'AKIA' + 'Z' * 16 + '\n/' + 'home/' + 'fixture/project/').encode()
        commands = []
        def git(*args):
            commands.append(args)
            if args == ('rev-list', '--all'):
                return (first + '\n' + second + '\n').encode()
            if args[:3] == ('ls-tree', '-r', '-z'):
                name = 'deleted.txt' if args[3] == first else 'renamed.txt'
                return f'100644 blob {blob}\t{name}\0'.encode()
            if args == ('rev-list', '--objects', '--all', '--no-object-names'):
                return (blob + '\n').encode()
            self.fail(str(args))
        from unittest.mock import MagicMock
        process = MagicMock()
        process.__enter__.return_value = process
        process.stdin = io.BytesIO()
        process.stdout = io.BytesIO(f'{blob} blob {len(payload)}\n'.encode() + payload + b'\n')
        process.wait.return_value = 0
        with patch.object(repo_check.Checker, 'git', side_effect=git), \
                patch.object(repo_check.subprocess, 'Popen', return_value=process), \
                patch.object(repo_check.Checker, 'candidate_files', return_value=[]):
            status, output = self.check('--history')
        self.assertEqual(status, 1)
        self.assertIn(first + ':deleted.txt:1: aws-access-key', output)
        self.assertIn(second + ':renamed.txt:2: absolute-home-path', output)
        self.assertIn('2 commits, 1 unique blobs', output)
        self.assertNotIn('Z' * 16, output)
        self.assertIn(('rev-list', '--all'), commands)


if __name__ == "__main__":
    unittest.main()
