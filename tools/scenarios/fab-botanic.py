"""Observe the local FABOTANIC capture without exporting or saving assets."""
import asyncio
import time
from record import Shot


async def prepare(page):
    await page.locator('#viewport').wait_for(state='visible')
    await page.wait_for_timeout(2500)
    await page.locator('[data-species="tree"]').click()
    await page.wait_for_timeout(1500)
    await page.locator('#windQuick').click()


async def rotate(page, dx=170):
    box = await page.locator('#viewport').bounding_box()
    x, y = box['x'] + box['width'] * .48, box['y'] + box['height'] * .42
    await page.mouse.move(x, y)
    await page.mouse.down()
    for step in range(45):
        await page.mouse.move(x + dx * (step + 1) / 45, y + 18 * (step + 1) / 45)
        await asyncio.sleep(.04)
    await page.mouse.up()


async def overview(page, cue):
    started = time.monotonic()
    cue('Choose a tree and watch the wind move its leaves.')
    await asyncio.sleep(5)
    await rotate(page)
    await page.locator('#shuffleShape').click()
    await asyncio.sleep(5)
    await page.locator('#randomBtn').click()
    await asyncio.sleep(5)
    cue('Compare shaded, solid and wireframe views.')
    for mode in ['1', '2', '0']:
        await page.locator('button[data-mode="'+mode+'"]').click()
        await asyncio.sleep(4)
    cue('Pick a flowering tree; rotate the specimen.')
    await page.locator('[data-species="cherry"]').click()
    await asyncio.sleep(6)
    await rotate(page, -210)
    await asyncio.sleep(4)
    cue('Switch to a mixed wild field and grow a new variation.')
    await page.locator('[data-species="field"]').click()
    await asyncio.sleep(6)
    await page.locator('#shuffleShape').click()
    await asyncio.sleep(5)
    if await page.locator('#windQuick').get_attribute('aria-pressed') != 'true':
        await page.locator('#windQuick').click()
    await rotate(page)
    await asyncio.sleep(max(0, 70 - (time.monotonic() - started)))


SHOTS = {'overview': Shot(url='http://127.0.0.1:8107/tl/fab-botanic/index.html',
    module=None, serve=['fab-botanic'], prepare=prepare, run=overview,
    overlay=False, poster_at=8, preview_at=8)}
