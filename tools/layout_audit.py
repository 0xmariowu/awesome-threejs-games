#!/usr/bin/env python3
"""Audit the real library at six widths, two languages, all games/categories and five live demos."""
import argparse
import json
import math
from pathlib import Path
import sys
from urllib.request import urlopen
from PIL import Image, ImageDraw
import test_library_ui as harness

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/layout-audit'
WIDTHS = (390, 768, 1024, 1280, 1440, 1920)
DEMOS = ('example:cloudkeep-atmosphere', 'example:tidewater-fishing',
         'example:cloudkeep-flight', 'demo:crowd', 'demo:inkwave-paint')
CHECK = r'''() => {
  const failures = [];
  const visible = e => {const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const name = e => e.id ? '#'+e.id : e.tagName.toLowerCase()+'.'+String(e.className).split(' ').join('.');
  if(document.documentElement.scrollWidth>innerWidth) failures.push(`Page overflow: ${document.documentElement.scrollWidth} > ${innerWidth}`);
  for(const e of document.querySelectorAll('body *')) {
    if(!visible(e) || e.closest('.code-scroll,[role=tablist]') || e.matches('script,style,option')) continue;
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
    if(r.right>innerWidth+.5 || r.left<-.5) failures.push(`Outside viewport: ${name(e)} [${r.left.toFixed(1)},${r.right.toFixed(1)}]`);
    if(e.matches('a,button,label,h1,h2,h3,small,select,[role=tab]') &&
       (s.whiteSpace==='nowrap' || r.height<=32) && e.scrollWidth>e.clientWidth+1)
      failures.push(`Clipped label: ${name(e)} ${e.textContent.trim().slice(0,70)}`);
  }
  for(const e of document.querySelectorAll('.topbar nav a')) {
    const r=e.getBoundingClientRect();
    if(r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight) failures.push(`Nav clipped: ${e.textContent}`);
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    if(!e.contains(hit)) failures.push(`Nav obscured: ${e.textContent}`);
  }
  const tabs=[...document.querySelectorAll('.demo-segments [role=tab]')];
  if(tabs.length) {
    if(tabs.filter(e=>e.getAttribute('aria-selected')==='true').length!==1) failures.push('Selected tab count is not one');
    if(new Set(tabs.map(e=>Math.round(e.getBoundingClientRect().top))).size!==1) failures.push('Tabs wrap');
    for(const e of tabs.filter(e=>e.getAttribute('aria-selected')!=='true')) {
      if(!['transparent','rgba(0, 0, 0, 0)'].includes(getComputedStyle(e).backgroundColor)) failures.push(`Unselected tab has fill: ${e.textContent}`);
      if(parseFloat(getComputedStyle(e).borderBottomWidth)>0) failures.push(`Unselected tab has border: ${e.textContent}`);
    }
    const r=tabs.find(e=>e.getAttribute('aria-selected')==='true')?.getBoundingClientRect();
    if(r&&(r.left<0||r.right>innerWidth)) failures.push('Selected tab is outside viewport');
  }
  for(const e of document.querySelectorAll('.demo-player iframe,.example-viewport iframe')) {
    const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();
    if(r.left<p.left-.5||r.right>p.right+.5) failures.push('Iframe outside its column');
  }
  return [...new Set(failures)];
}'''


def sheet(rows, target, columns=4, size=(320, 260)):
    tiles = []
    for row in rows:
        path = OUT / row['screenshot']
        if not path.exists():
            continue
        with Image.open(path) as source:
            picture = source.convert('RGB')
            picture = picture.crop((0, 0, picture.width, min(picture.height, 1000)))
            picture.thumbnail((size[0]-12, size[1]-30))
        tile = Image.new('RGB', size, '#e8edf2')
        tile.paste(picture, ((size[0]-picture.width)//2, 26))
        ImageDraw.Draw(tile).text((6, 6), row['page'] + (' FAIL' if row['failures'] else ''), fill='black')
        tiles.append(tile)
    result = Image.new('RGB', (columns*size[0], math.ceil(len(tiles)/columns)*size[1]), 'white')
    for i, tile in enumerate(tiles):
        result.paste(tile, ((i % columns)*size[0], (i//columns)*size[1]))
    result.save(target, quality=90)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--width', type=int, action='append', choices=WIDTHS)
    parser.add_argument('--lang', action='append', choices=('zh-CN', 'en-US'))
    parser.add_argument('--page', help='Only page names containing this string (diagnostic run)')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    harness.setUpModule()
    results = []
    try:
        with urlopen(harness.BASE_URL + '/api/pages') as response:
            games = json.load(response)['pages']
        with urlopen(harness.BASE_URL + '/api/demos') as response:
            demos = json.load(response)
        known = {demo['id'] for demo in demos['demos']}
        assert set(DEMOS) <= known, 'The five audit demos must exist in the real catalog'
        cases = [('home', '/'), *[(f'project-{g["slug"]}', f'/p/{g["slug"]}') for g in games],
                 ('category-all', '/demos?cat=all'),
                 *[(f'category-{c["key"]}', f'/demos?cat={c["key"]}') for c in demos['categories']],
                 *[(id.replace(':', '-'), '/demos#' + id) for id in DEMOS]]
        if args.page:
            cases = [(name, url) for name, url in cases if args.page in name]
        for lang in args.lang or ('zh-CN', 'en-US'):
            for width in args.width or WIDTHS:
                context = harness.BROWSER.new_context(viewport={'width': width, 'height': 1000}, locale=lang, color_scheme='light')
                batch = []
                try:
                    for name, route in cases:
                        page = context.new_page()
                        row = {'page': name, 'lang': lang, 'width': width, 'failures': [],
                               'screenshot': f'{name}-{lang}-{width}.png'}
                        try:
                            page.goto(harness.BASE_URL + route)
                            page.wait_for_selector('.game-card' if name == 'home' else '.project-head' if name.startswith('project-') else '.demo-player iframe', timeout=60000)
                            if not name.startswith(('project-', 'home')):
                                page.wait_for_function('() => Boolean(document.querySelector("iframe")?.dataset.frameHeight)', timeout=60000)
                                frame = page.locator('iframe').element_handle().content_frame()
                                frame.wait_for_selector('canvas', timeout=60000)
                                page.wait_for_timeout(1000)
                                # Exercise keyboard focus on an unselected tab without changing selection.
                                page.locator('[role=tab][aria-selected=false]').first.focus()
                                page.keyboard.press('Shift')
                                page.locator('[role=tab][aria-selected=true]').evaluate("e => e.scrollIntoView({block:'nearest',inline:'nearest'})")
                            page.evaluate('window.scrollTo(0,0)')
                            row['failures'] = page.evaluate(CHECK)
                            if page.locator('iframe').count():
                                frame = page.locator('iframe').element_handle().content_frame()
                                row['failures'].extend(frame.evaluate(r"""() => {
                                  const errors=[];
                                  for(const e of document.querySelectorAll('.demo-controls button,.demo-controls label,#lab-console button,#lab-console label')) {
                                    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
                                    if(!r.width||!r.height||s.display==='none'||s.visibility==='hidden') continue;
                                    if((s.whiteSpace==='nowrap'||r.height<=32)&&e.scrollWidth>e.clientWidth+1)
                                      errors.push('Frame clipped label: '+e.textContent.trim());
                                    if(e.tagName==='BUTTON'&&e.scrollHeight>e.clientHeight+1)
                                      errors.push('Frame clipped button height: '+e.textContent.trim());
                                  }
                                  return errors;
                                }"""))
                            page.screenshot(path=str(OUT / row['screenshot']), full_page=True)
                        except Exception as error:
                            row['failures'].append(str(error).split('Call log:')[0].strip())
                            page.screenshot(path=str(OUT / row['screenshot']))
                        finally:
                            page.close()
                        results.append(row)
                        batch.append(row)
                        print(f'{lang} {width:4} {name:40} ' + ('FAIL ' + ' | '.join(row['failures']) if row['failures'] else 'PASS'), flush=True)
                finally:
                    context.close()
                sheet(batch, OUT / f'sheet-{lang}-{width}.jpg')
        sheet(results, OUT / 'sheet.jpg', columns=12, size=(180, 150))
        (OUT / 'summary.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
        count = sum(bool(row['failures']) for row in results)
        print(f'\nAudited {len(results)} pages; {count} failures. Sheets: {OUT}', flush=True)
        return int(count > 0)
    finally:
        harness.tearDownModule()


if __name__ == '__main__':
    sys.exit(main())
