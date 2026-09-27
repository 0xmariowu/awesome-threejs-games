#!/usr/bin/env python3
"""Validate archived bytes and report browser evidence without claiming full parity."""
import argparse,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def audit(slug,runtime=False):
 p=ROOT/slug;errors=[];manifest=json.loads((p/'provenance/manifest.json').read_text())
 config=json.loads((p/'local.json').read_text());archive_root=p/config.get('root','public')
 paths=set()
 for item in manifest['files']:
  rel=item['path'];file=archive_root/rel;paths.add(rel)
  if not file.is_file():errors.append('Missing: '+rel);continue
  digest=hashlib.sha256(file.read_bytes()).hexdigest()
  if digest!=item.get('local_sha256',item['sha256']):errors.append('Checksum mismatch: '+rel)
 if not(p/config['root']/config['entry'].lstrip('/')).is_file():errors.append('Missing entry')
 for file in ['README.md','TECHNICAL.md']:
  if not(p/file).exists():errors.append('Missing documentation: '+file)
 evidence=ROOT/'output/playwright'/slug
 report={'slug':slug,'unique_paths':len(paths),'bytes':sum((archive_root/v).stat().st_size for v in paths if (archive_root/v).exists()),'static_candidates_rejected':len(manifest.get('failed',{})),'errors':errors}
 if runtime:
  review=evidence/'visual-review.json'
  if review.exists():
   report['visual_issues']=json.loads(review.read_text()).get('issues',[])
   if report['visual_issues']:errors.append('Unresolved visual review issues')
  candidates=list(ROOT.glob(f'output/audit-*/{slug}/local/browser.json'))
  candidates.extend(ROOT.glob(f'output/library-*/{slug}/local/browser.json'))
  candidates.extend(ROOT.glob(f'output/library-*/{slug}/browser.json'))
  candidates.extend(p for p in [evidence/'gameplay/browser.json',evidence/'local/browser.json'] if p.exists())
  browser=max(candidates,key=lambda p:p.stat().st_mtime) if candidates else evidence/'local/browser.json'
  if not browser.exists():errors.append('Missing browser evidence')
  else:
   data=json.loads(browser.read_text());report['runtime_evidence']=str(browser.relative_to(ROOT));report['runtime_completed']=data.get('completed');report['page_errors']=data.get('errors',[]);report['http_errors']=data.get('http_errors',[r for r in data.get('responses',[]) if r['status']>=400]);report['external_requests']=data.get('external',data.get('failures',[]))
   if data.get('completed') is False:errors.append('Gameplay probe incomplete')
   if report['page_errors']:errors.append('Browser page errors')
   allowed = {'tableparty-kart': ['/kart-room'], 'vox-arcana': ['/api/status'], 'smartgame-town': ['/town/api.php','/town/bulletin-api.php','/account/api.php','/town/room-api.php','/town/announcements-api.php','/town/chat-api.php','/town/social-api.php','/town/state-api.php']}
   unexpected = [r for r in report['http_errors'] if not any(token in r['url'] for token in allowed.get(slug, []))]
   report['known_backend_gaps'] = len(report['http_errors']) - len(unexpected)
   if unexpected:errors.append('Unexpected runtime HTTP errors')
   if report['external_requests']:errors.append('External requests attempted during offline probe')
 print(json.dumps(report,ensure_ascii=False))
 return not errors

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('slug',nargs='?');ap.add_argument('--all',action='store_true');ap.add_argument('--runtime',action='store_true');args=ap.parse_args()
 slugs=sorted(p.parent.parent.name for p in ROOT.glob('*/provenance/manifest.json')) if args.all else [args.slug]
 if not all([audit(slug,args.runtime) for slug in slugs]):sys.exit(1)
