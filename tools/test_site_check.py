"""Keep documented backend exceptions narrow in both browser checkers."""
import unittest
from types import SimpleNamespace

from experience_check import known_missing_backend
from site_check import Checker, PREFIX


class MissingBackendTests(unittest.TestCase):
    def test_experience_counter_exception_is_exact_and_slug_scoped(self):
        self.assertTrue(known_missing_backend('tupi', 'http://localhost/api/views'))
        self.assertTrue(known_missing_backend('tupi', 'http://localhost/api/views?count=1'))
        for slug, path in [('tupi', '/api/views/other'), ('tupi', '/api/views.js'),
                           ('tupi', '/api/other'), ('everdrift', '/api/views'),
                           (None, '/api/views')]:
            with self.subTest(slug=slug, path=path):
                self.assertFalse(known_missing_backend(slug, 'http://localhost'+path))

    def test_existing_backend_exceptions_still_apply(self):
        for slug, path in [('vox-arcana', '/api/status'),
                           ('smartgame-town', '/account/api.php'),
                           ('smartgame-town', '/town/room-api.php'),
                           ('tableparty-kart', '/kart-room')]:
            with self.subTest(slug=slug, path=path):
                self.assertTrue(known_missing_backend(slug, 'http://localhost'+path))

    def setUp(self):
        self.checker = Checker(None, 'http://localhost:8000'+PREFIX)
        self.checker.current = {'slug': 'tupi', 'errors': [], 'expected': [],
                                'external_failures': [], 'console_errors': []}
        self.events = {}
        self.checker.watch(SimpleNamespace(on=self.events.__setitem__))

    def test_pages_counter_405_and_501_are_expected(self):
        url = self.checker.base+'games/tupi/api/views'
        for status in (405, 501):
            self.events['response'](SimpleNamespace(url=url, status=status))
        self.assertEqual(self.checker.current['expected'], ['405 '+url, '501 '+url])
        self.assertEqual(self.checker.current['errors'], [])

    def test_pages_exception_does_not_hide_other_routes_or_origins(self):
        paths = ['games/tupi/api/views.js', 'games/tupi/api/views/other',
                 'games/tupi/api/other', 'games/everdrift/api/views']
        urls = [self.checker.base+path for path in paths]
        urls.append('https://elsewhere.example'+PREFIX+'games/tupi/api/views')
        for url in urls:
            with self.subTest(url=url):
                self.assertFalse(self.checker.expected(url))
                self.events['response'](SimpleNamespace(url=url, status=501))
        self.assertEqual(len(self.checker.current['errors']), len(urls))
        self.assertEqual(self.checker.current['expected'], [])
        self.checker.current['slug'] = 'everdrift'
        self.assertFalse(self.checker.expected(self.checker.base+'games/tupi/api/views'))

    def test_counter_network_failure_is_expected_but_javascript_errors_fail(self):
        self.events['requestfailed'](SimpleNamespace(
            url=self.checker.base+'games/tupi/api/views', failure='net::ERR_CONNECTION_RESET'))
        page_events = {}
        self.events['page'](SimpleNamespace(on=page_events.__setitem__))
        page_events['console'](SimpleNamespace(type='error', text='Counter code crashed',
                                              location={'url': self.checker.base+'games/tupi/'}))
        self.assertEqual(len(self.checker.current['expected']), 1)
        self.assertEqual(self.checker.current['errors'], ['Counter code crashed'])


if __name__ == '__main__':
    unittest.main()
