#!/usr/bin/env python3
"""Search source-inspected candidates; does not launch or modify a game."""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('query',nargs='?',default='')
ap.add_argument('--project')
ap.add_argument('--category')
ap.add_argument('--priority',choices=['P0','P1','P2'])
a=ap.parse_args()
d=json.loads((ROOT/'catalog/extraction-candidates.json').read_text())
terms=a.query.lower().split()
rows=[r for r in d['candidates'] if (not a.project or r['project']==a.project) and (not a.category or a.category in r['category']) and (not a.priority or a.priority==r['priority']) and all(t in json.dumps(r,ensure_ascii=False).lower() for t in terms)]
print(json.dumps({'count':len(rows),'scope':d['scope'],'candidates':rows},ensure_ascii=False,indent=2))
