import unittest
from capture import references, local_path, normalize, Capture
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

class CaptureTests(unittest.TestCase):
    def test_rewrite_preserves_original_line_endings(self):
        with TemporaryDirectory() as temp, patch('capture.ROOT', Path(temp)):
            c=Capture('game','https://a.test/')
            original=c.evidence/'original-text'/'main.js'
            original.parent.mkdir()
            body=b'const a = 1;\r\nconst b = 2;\r\n'
            original.write_bytes(body)
            c.rewrite()
            self.assertEqual((c.public/'main.js').read_bytes(),body)
    def test_recapture_reads_original_not_localized_text(self):
        with TemporaryDirectory() as temp, patch('capture.ROOT', Path(temp)):
            c=Capture('game','https://a.test/')
            (c.public/'index.html').write_text('localized')
            (c.evidence/'original-text').mkdir()
            (c.evidence/'original-text'/'index.html').write_text('original')
            c.records[c.entry]={'content_type':'text/html'}
            self.assertEqual(c.fetch(c.entry)[1], b'original')
    def test_external_document_is_not_a_dependency(self):
        self.assertEqual(references('<a href="https://map.test/credits.html">Credits</a>','https://a.test/','https://a.test/'),set())
    def test_module_and_document_paths(self):
        refs = references('import "./world.js"; const a="assets/ship.glb"; const b="/sky.hdr";', 'https://a.test/js/main.js', 'https://a.test/')
        self.assertEqual(refs, {'https://a.test/js/world.js','https://a.test/assets/ship.glb','https://a.test/sky.hdr'})
    def test_external_query_unique(self):
        self.assertNotEqual(local_path('https://fonts.test/css?family=A','https://a.test/'),local_path('https://fonts.test/css?family=B','https://a.test/'))
    def test_prefix_import(self):
        self.assertEqual(references('import "three/addons/Foo.js";', 'https://a.test/main.js','https://a.test/', {'three/':'https://cdn.test/three/'}), {'https://cdn.test/three/addons/Foo.js'})
    def test_no_template_or_inline(self):
        self.assertEqual(references('"data:image/a.png"; `models/${name}.glb`; "#test.png"','https://a.test/','https://a.test/'),set())
    def test_css_relative(self):
        self.assertEqual(references('a{background:url(../sky.jpg)}','https://a.test/css/app.css','https://a.test/'),{'https://a.test/sky.jpg'})
    def test_path_stays_relative(self):
        self.assertEqual(local_path('https://a.test/../../a.js','https://a.test/'),'a.js')
    def test_entity_and_fragment(self):
        self.assertEqual(normalize('https://a.test/a.js?a=1&amp;b=2#x'),'https://a.test/a.js?a=1&b=2')

if __name__ == '__main__': unittest.main()
