import contextlib,hashlib,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import audit

class ArchiveLayoutTests(unittest.TestCase):
 def check_layout(self,root_name,corrupt=False):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);p=root/'game';archive=p/root_name;archive.mkdir(parents=True);(p/'provenance').mkdir()
   body=b'<title>original</title>';(archive/'index.html').write_bytes(body if not corrupt else b'changed')
   (p/'local.json').write_text(json.dumps({'root':root_name,'entry':'/index.html'}))
   (p/'provenance/manifest.json').write_text(json.dumps({'files':[{'path':'index.html','sha256':hashlib.sha256(body).hexdigest()}]}))
   for name in ['README.md','TECHNICAL.md']:(p/name).write_text('test documentation')
   with patch.object(audit,'ROOT',root),contextlib.redirect_stdout(io.StringIO()) as output:passed=audit.audit('game')
   return passed,json.loads(output.getvalue())
 def test_public_snapshot(self):self.assertTrue(self.check_layout('public')[0])
 def test_legacy_root_snapshot(self):self.assertTrue(self.check_layout('.')[0])
 def test_changed_runtime_bytes_fail(self):
  passed,report=self.check_layout('.',True);self.assertFalse(passed);self.assertIn('Checksum mismatch: index.html',report['errors'])
 def test_new_failed_probe_is_not_hidden_by_old_success(self):
  self.check_new_probe('audit-test')
 def test_new_library_probe_is_not_hidden_by_old_success(self):
  self.check_new_probe('library-research-test')
 def test_direct_development_probe_is_not_hidden_by_old_success(self):
  self.check_new_probe('library-development-test',direct=True)
 def check_new_probe(self,folder,direct=False):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);p=root/'game';(p/'public').mkdir(parents=True);(p/'provenance').mkdir()
   body=b'original';(p/'public/index.html').write_bytes(body)
   (p/'local.json').write_text(json.dumps({'root':'public','entry':'/index.html'}))
   (p/'provenance/manifest.json').write_text(json.dumps({'files':[{'path':'index.html','sha256':hashlib.sha256(body).hexdigest()}]}))
   for name in ['README.md','TECHNICAL.md']:(p/name).write_text('test')
   old=root/'output/playwright/game/gameplay/browser.json';old.parent.mkdir(parents=True);old.write_text(json.dumps({'completed':True}));os.utime(old,(1,1))
   new=root/'output'/folder/('game/browser.json' if direct else 'game/local/browser.json');new.parent.mkdir(parents=True);new.write_text(json.dumps({'completed':False}))
   with patch.object(audit,'ROOT',root),contextlib.redirect_stdout(io.StringIO()) as output:passed=audit.audit('game',runtime=True)
   report=json.loads(output.getvalue());self.assertFalse(passed);self.assertEqual(report['runtime_evidence'],str(new.relative_to(root)));self.assertIn('Gameplay probe incomplete',report['errors'])

if __name__=='__main__':unittest.main()
