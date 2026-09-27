#!/usr/bin/env python3
"""Check every catalog demo through the library's real launch and iframe flow."""
import argparse
import json
import math
from pathlib import Path
import sys
from urllib.request import urlopen
from PIL import Image, ImageDraw
import test_library_ui as harness

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/demo-frames'
CHECK = r'''() => {
  const visible = node => {
    const s = getComputedStyle(node), r = node.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 && r.width > 0 && r.height > 0;
  };
  const canvases = [...document.querySelectorAll('canvas')].filter(visible)
    .sort((a,b) => b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight);
  const picture = document.querySelector('.demo-picture, #lab-picture, [data-demo-picture]') || canvases[0];
  if (!picture) return {failures: ['No picture element'], height: document.documentElement.scrollHeight};
  const box = picture.getBoundingClientRect(), failures = [], overlaps = [];
  const intersects = r => r.left < box.right-1 && r.right > box.left+1 && r.top < box.bottom-1 && r.bottom > box.top+1;
  for (const node of document.querySelectorAll('body *')) {
    if (!visible(node) || node.closest('script,style') || node === picture) continue;
    // Canvas HUDs are usually sibling DOM layers, not canvas descendants.
    // Exempt only explicitly marked original UI contained in the picture bounds.
    const r = node.getBoundingClientRect();
    if (node.closest('[data-original-hud]') && r.left >= box.left-1 && r.top >= box.top-1 &&
        r.right <= box.right+1 && r.bottom <= box.bottom+1) continue;
    const control = node.matches('button,input,select,textarea,meter,progress,[role="button"],[role="slider"]');
    if (control && intersects(node.getBoundingClientRect())) overlaps.push(node.id || node.tagName);
    for (const text of node.childNodes) {
      if (text.nodeType !== Node.TEXT_NODE || !text.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      if ([...range.getClientRects()].some(intersects)) overlaps.push(`${node.id || node.tagName}: ${text.textContent.trim().slice(0,60)}`);
    }
  }
  if (overlaps.length) failures.push('Picture overlaps host UI: ' + [...new Set(overlaps)].join('; '));
  // A selected control must look selected: pressed buttons differ from unpressed ones.
  const pressed = [...document.querySelectorAll('button[aria-pressed="true"]')].filter(visible);
  const plain = [...document.querySelectorAll('button[aria-pressed="false"]')].filter(visible)[0];
  if (plain) for (const b of pressed) {
    const a = getComputedStyle(b), c = getComputedStyle(plain);
    if (a.backgroundColor === c.backgroundColor && a.borderColor === c.borderColor && a.color === c.color)
      failures.push(`Pressed button looks unpressed: ${b.textContent.trim().slice(0,30)}`);
  }
  const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  if (height > innerHeight + 1) failures.push(`Document scrolls: ${height} > ${innerHeight}`);
  if (/GAMEREF|提取示例|技术库|Technique library/i.test(document.body.innerText)) failures.push('Site chrome inside frame');
  if (Math.abs(box.width / box.height - 16/9) > .02) failures.push(`Picture aspect ${box.width}/${box.height}`);
  const consoleCard = document.querySelector('[data-demo-console], #lab-console');
  const hasConsole = consoleCard && visible(consoleCard);
  const hostControls = [...document.querySelectorAll('button,input,select,textarea,meter,progress')]
    .filter(node => visible(node) && !node.closest('[data-original-hud]'));
  if (hostControls.length && !hasConsole) failures.push('Controls exist without a console card');
  if (hasConsole) {
    const c = consoleCard.getBoundingClientRect();
    if (intersects(c)) failures.push('Console card overlaps picture card');
    if (innerWidth >= 760) {
      if (Math.abs(c.left - box.right - 12) > 1 || Math.abs(c.top - box.top) > 1)
        failures.push('Desktop cards are not side by side with a 12px gap');
      if (Math.abs(c.width - 300) > 1) failures.push('Console width is not 300px');
      if (c.height > box.height + 1) failures.push('Console exceeds picture height');
    } else if (c.top < box.bottom + 11 || Math.abs(c.width - innerWidth) > 2) {
      failures.push('Narrow console is not stacked at full width');
    }
    for (const node of hostControls) if (!consoleCard.contains(node)) failures.push('Host control outside console: ' + (node.id || node.tagName));
  } else if (Math.abs(box.width-innerWidth) > 2) failures.push('Picture without console is not full width');
  for (const hint of document.querySelectorAll('[data-demo-hint], .lab-frame-hint')) {
    const h = hint.getBoundingClientRect();
    if (picture.contains(hint) || consoleCard?.contains(hint) || h.top < box.bottom - 1 ||
        h.left < box.left - 1 || h.right > box.right + 1)
      failures.push('Hint is not outside and below the picture card');
  }
  const layout = document.querySelector('.demo-frame-layout, .lab-frame');
  if (layout) {
    const bottoms = [box.bottom, ...[...document.querySelectorAll('[data-demo-hint], .lab-frame-hint')].map(e => e.getBoundingClientRect().bottom)];
    if (hasConsole) bottoms.push(consoleCard.getBoundingClientRect().bottom);
    if (layout.getBoundingClientRect().bottom > Math.max(...bottoms) + 2) failures.push('Frame has unused height below its cards');
  }
  if (document.documentElement.scrollWidth > innerWidth) failures.push('Frame has horizontal overflow');
  return {failures, height, picture: {width: box.width, height: box.height}};
}'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', choices=['examples', 'lab'])
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    print(f"{'Demo':42} {'State':5} {'Height':>5} Reason", flush=True)
    harness.setUpModule()
    try:
        with urlopen(harness.BASE_URL + '/api/demos') as response:
            data = json.load(response)
        demos = [d for d in data['demos'] if not args.only or
                 (d['kind'] == 'example') == (args.only == 'examples')]
        if data.get('lab_error') and args.only != 'examples':
            results.append({'id': 'lab-catalog', 'status': 'SKIP', 'reason': data['lab_error']})
        for demo in demos:
            context = harness.BROWSER.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN', color_scheme='light')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            launches = []
            page.on('response', lambda response: launches.append(response) if response.url.endswith('/api/launch') else None)
            # Observe actual messages independently of the parent's diagnostic attribute.
            page.add_init_script('''window.__frameMessages=[];addEventListener('message', event => {
                const f=document.querySelector('.demo-player iframe');
                if (f && event.source===f.contentWindow && event.origin===new URL(f.src).origin && event.data?.type==='gameref:frame-height')
                    window.__frameMessages.push(event.data.height);
            });''')
            result = {'id': demo['id'], 'status': 'FAIL', 'reason': ''}
            try:
                page.goto(harness.BASE_URL + '/demos?lang=zh&theme=light#' + demo['id'])
                iframe = page.locator('.demo-player iframe')
                iframe.wait_for(timeout=60000)
                frame = iframe.element_handle().content_frame()
                frame.wait_for_selector('[data-demo-picture], canvas', timeout=60000)
                page.wait_for_function('() => document.querySelector("iframe")?.dataset.frameHeight', timeout=30000)
                # Wait for the host's real ready state when it exposes one.
                ready = {'cloudkeep-flight': 'Number.isFinite(window.__flight?.speed)',
                         'cloudkeep-models': 'window.__models?.stats',
                         'tidewater-fishing': 'document.querySelector("#time")?.textContent !== "0.0 s"',
                         'vox-reactions': 'window.__example?.hp === 600',
                         'arkenfall-camera': 'window.__example?.time > .3',
                         'cloudkeep-atmosphere': 'window.__example?.frames > 2',
                         'monolith-terrain': 'window.__example?.state?.frame > 2',
                         'shabondama-director': 'window.__example?.frameCount > 2'}
                if demo['kind'] == 'example':
                    frame.wait_for_function(ready.get(demo['id'].split(':')[-1], 'window.__example?.ready'), timeout=60000)
                page.wait_for_timeout(2500)
                # Late-loading scenes post their final height after first paint; measure
                # only once the parent has applied the latest frame-height message.
                try:
                    page.wait_for_function('''() => {
                        const m = window.__frameMessages, f = document.querySelector('.demo-player iframe');
                        return m && m.length && f && Math.abs(f.getBoundingClientRect().height - Math.max(200, Math.min(4000, m[m.length-1]))) <= 1;
                    }''', timeout=10000)
                except Exception:
                    pass  # reported below as 'Iframe height not set from a frame-height message'
                checked = frame.evaluate(CHECK)
                failures = checked['failures']
                messages = page.evaluate('window.__frameMessages')
                height = iframe.evaluate('e => e.getBoundingClientRect().height')
                if not messages or abs(height - max(200, min(4000, messages[-1]))) > 1:
                    failures.append('Iframe height not set from a frame-height message')
                if errors: failures.append('Console: ' + '; '.join(dict.fromkeys(errors)))
                result.update(status='FAIL' if failures else 'PASS', reason=' | '.join(failures), height=round(height))
            except Exception as error:
                result['reason'] = str(error).split('Call log:')[0].strip()
                # Only an unavailable Lab launch is skippable, never layout/runtime failures.
                if demo['kind'] != 'example' and launches:
                    response = launches[-1]
                    if not response.ok:
                        result.update(status='SKIP', reason='Lab launch unavailable: ' + response.text())
            finally:
                filename = demo['id'].replace(':', '-') + '.png'
                try:
                    # The primary shot is the requested 1440x1000 library view.
                    page.screenshot(path=str(OUT / filename))
                    locator = page.locator('.demo-player iframe')
                    if locator.count():
                        # A second shot includes all controls for visual review. Hide only
                        # parent chrome that could cover a scrolled locator screenshot.
                        page.evaluate("""() => {
                            for (const node of document.querySelectorAll('.demo-toolbar, .topbar')) node.style.visibility='hidden';
                            const content=document.querySelector('.demo-content');
                            Object.assign(content.style, {position:'static',maxHeight:'none',overflow:'visible'});
                        }""")
                        frame_filename = filename.replace('.png', '-frame.png')
                        locator.screenshot(path=str(OUT / frame_filename), timeout=10000)
                        result['frame_screenshot'] = frame_filename
                    result['screenshot'] = filename
                except Exception as error:
                    result['status'] = 'FAIL'
                    result['reason'] += ' | screenshot: ' + str(error)
                if errors and result['status'] == 'PASS':
                    result.update(status='FAIL', reason='Console: ' + '; '.join(dict.fromkeys(errors)))
                results.append(result)
                print(f"{result['id']:42} {result['status']:5} {result.get('height', '-'):>5} {result['reason']}", flush=True)
                context.close()
        tiles = []
        for row in results:
            if not row.get('screenshot'): continue
            picture = Image.open(OUT / row.get('frame_screenshot', row['screenshot'])).convert('RGB')
            picture.thumbnail((350, 330))
            tile = Image.new('RGB', (370, 370), '#e3e7ed')
            tile.paste(picture, ((370-picture.width)//2, 28))
            ImageDraw.Draw(tile).text((10, 7), row['id'] + ' ' + row['status'], fill='black')
            tiles.append(tile)
        if tiles:
            sheet = Image.new('RGB', (370*4, 370*math.ceil(len(tiles)/4)), 'white')
            for i, tile in enumerate(tiles): sheet.paste(tile, ((i%4)*370,(i//4)*370))
            sheet.save(OUT/'sheet.jpg', quality=90)
        (OUT / ('summary-' + (args.only or 'all') + '.json')).write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print('\nSummary:', ', '.join(f'{status}={sum(r["status"] == status for r in results)}' for status in ['PASS','FAIL','SKIP']))
        return int(any(row['status']=='FAIL' for row in results))
    finally:
        harness.tearDownModule()


if __name__ == '__main__':
    sys.exit(main())
