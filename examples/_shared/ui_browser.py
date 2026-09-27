"""Language/theme assertions shared by each example's real-browser tests."""
from pathlib import Path
from urllib.parse import urlsplit

HOST_UI = ('header, aside, nav, footer, .panel, .ui-panel, #status, #readout, '
           '#target-state, #history, #shot, #target, #labels, #hint, .hint, .setup, .sim, '
           '.save, details, h1, .intro, #message')
CJK = r'[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]'
READY = {
    'arkenfall-camera': 'window.__example?.time > .3',
    'cloudkeep-flight': 'Number.isFinite(window.__flight?.speed)',
    'cloudkeep-atmosphere': 'window.__example?.frames > 2',
    'monolith-terrain': 'window.__example?.state?.frame > 2',
    'monolith-tour': 'window.__example?.ready',
    'shabondama-director': 'window.__example?.frameCount > 2',
    'vox-reactions': 'window.__example?.hp === 600',
    'tidewater-fishing': 'document.querySelector("#time").textContent !== "0.0 s"',
}


def check_host_languages(case, browser, url, example):
    paths = ['/index.html', '/models.html'] if example == 'cloudkeep-flight' else ['/index.html']
    for path in paths:
        for language, color in [('en', 'dark'), ('zh', 'light')]:
            with case.subTest(host=example, path=path, language=language, theme=color):
                # Opposite browser defaults prove query precedence in both directions.
                context = browser.new_context(locale='zh-CN' if language == 'en' else 'en-US',
                                              color_scheme='light' if color == 'dark' else 'dark',
                                              viewport={'width': 1280, 'height': 1800}, service_workers='block')
                try:
                    context.route('**/*', lambda route: route.continue_()
                                  if urlsplit(route.request.url).hostname == '127.0.0.1' else route.abort())
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                    # Host canvas labels are UI too; original game canvas text is exempt.
                    page.add_init_script('''window.__hostCanvasText = [];
                        const fill = CanvasRenderingContext2D.prototype.fillText;
                        CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
                            if (['map', 'world'].includes(this.canvas.id)) {
                                window.__hostCanvasText.push(String(text));
                                if (window.__hostCanvasText.length > 500) window.__hostCanvasText.shift();
                            }
                            return fill.call(this, text, ...args);
                        };''')
                    page.goto(url.rstrip('/') + path + '?lang=' + language + '&theme=' + color)
                    ready = 'window.__models?.stats' if path == '/models.html' else READY.get(example, 'window.__example?.ready')
                    page.wait_for_function(ready, timeout=60000)
                    page.wait_for_function('document.documentElement.dataset.uiReady === "true"')
                    page.wait_for_timeout(350)

                    def assert_copy():
                        text = page.locator(HOST_UI).evaluate_all('''nodes => nodes.filter(n => n.getClientRects().length)
                            .map(n => n.innerText).join('\\n')''')
                        attributes = page.locator('[aria-label], [title]').evaluate_all('''nodes => nodes
                            .map(n => (n.getAttribute('aria-label') || '') + (n.getAttribute('title') || '')).join('\\n')''')
                        text += '\n' + attributes + '\n' + page.title()
                        if language == 'en':
                            case.assertNotRegex(text, CJK)
                            case.assertNotRegex(page.evaluate('window.__hostCanvasText.join("\\n")'), CJK)
                        else:
                            case.assertRegex(text, r'[\u3400-\u9fff]')
                        case.assertEqual(page.locator('html').get_attribute('lang'), language)
                        case.assertEqual(page.locator('html').get_attribute('data-theme'), color)
                        case.assertEqual(errors, [])
                    assert_copy()
                    panel = page.locator('.demo-controls')
                    expected_background = 'rgb(21, 29, 43)' if color == 'dark' else 'rgb(255, 255, 255)'
                    case.assertEqual(panel.evaluate('n => getComputedStyle(n).backgroundColor'), expected_background)
                    case.assertEqual(panel.evaluate('n => getComputedStyle(n).padding'), '12px')
                    for radius in panel.locator('button, input, select').evaluate_all('ns => ns.map(n => getComputedStyle(n).borderRadius)'):
                        case.assertEqual(radius, '5px')
                    picture = page.locator('[data-demo-picture]').bounding_box()
                    case.assertAlmostEqual(picture['width'] / picture['height'], 16 / 9, delta=.01)
                    card = page.locator('.demo-picture').bounding_box()
                    console = panel.bounding_box()
                    case.assertAlmostEqual(console['x'] - card['x'] - card['width'], 12, delta=1)
                    case.assertAlmostEqual(console['y'], card['y'], delta=1)
                    case.assertAlmostEqual(console['width'], 300, delta=1)
                    case.assertLessEqual(console['height'], card['height'] + 1)
                    case.assertEqual(panel.evaluate('n => getComputedStyle(n).borderRadius'), '10px')
                    for hint in page.locator('[data-demo-hint]').all():
                        bounds = hint.bounding_box()
                        case.assertGreaterEqual(bounds['y'], card['y'] + card['height'])
                        case.assertAlmostEqual(bounds['x'], card['x'], delta=1)
                        case.assertFalse(hint.evaluate('n => Boolean(n.closest(".demo-picture,.demo-controls"))'))
                    # Exercise dynamically updated buttons, helpers, telemetry and reactions.
                    for selector in ['#helpers', '#pause', '#manual', '#wireframe', '#vertex-colors']:
                        control = page.locator(selector)
                        if control.count() and control.is_visible() and control.is_enabled():
                            control.click()
                            page.wait_for_timeout(150)
                            assert_copy()
                    if example == 'vox-reactions':
                        for element in ['water', 'ice', 'earth', 'fire', 'lightning', 'arcane']:
                            page.locator('[data-element="' + element + '"]').click()
                            page.locator('#world').click(position={'x': 800, 'y': 200})
                            page.wait_for_timeout(300)
                            assert_copy()
                    output = Path(__file__).resolve().parents[2] / 'output/examples' / example
                    output.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(output / ('ui-' + Path(path).stem + '-' + language + '.png')))
                finally:
                    context.close()


def available_port(preferred):
    """Keep test-owned servers independent of examples already open in the library."""
    import socket
    with socket.socket() as listener:
        try:
            listener.bind(('127.0.0.1', preferred))
        except OSError:
            listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def install_frame_test_context(context):
    """Test parents implement the same source/origin-checked height contract."""
    context.add_init_script('''addEventListener('message', event => {
        for (const frame of document.querySelectorAll('iframe')) {
            if (event.source === frame.contentWindow && event.origin === new URL(frame.src).origin &&
                event.data?.type === 'gameref:frame-height' && Number.isInteger(event.data.height)) {
                frame.style.height = Math.max(200, Math.min(4000, event.data.height)) + 'px';
                frame.dataset.frameHeight = event.data.height;
            }
        }
    });''')


def assert_picture_size(case, target, frame_width):
    """The card is 16:9; its one-pixel border surrounds the renderer."""
    expected = frame_width - 312 if frame_width >= 760 else frame_width
    card = target.locator('.demo-picture').bounding_box()
    picture = target.locator('[data-demo-picture]').bounding_box()
    case.assertAlmostEqual(card['width'], expected, delta=1)
    case.assertAlmostEqual(card['height'], expected * 9 / 16, delta=1)
    case.assertAlmostEqual(picture['width'], expected - 2, delta=1)
    case.assertAlmostEqual(picture['height'], expected * 9 / 16 - 2, delta=1)
    console = target.locator('.demo-controls').bounding_box()
    if frame_width >= 760:
        case.assertAlmostEqual(console['x'] - card['x'] - card['width'], 12, delta=1)
        case.assertAlmostEqual(console['width'], 300, delta=1)
    else:
        case.assertGreaterEqual(console['y'], card['y'] + card['height'] + 12)
    return target.locator('[data-demo-picture]').evaluate('e => [e.clientWidth, e.clientHeight]')
