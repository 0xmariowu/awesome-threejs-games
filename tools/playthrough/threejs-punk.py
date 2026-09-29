"""Native city, walking, garage and menu coverage. No injected game state.

Read-only HUD observations guide keyboard driving. The four stock driving
cameras each receive 32 seconds. Locked garage cars remain locked; campaign
completion and every world mission are not claimed by this mode traversal.
"""
import asyncio
import json
import time
from pathlib import Path
from playthrough import Mode

SERVE = ['threejs-punk']
URL = 'http://127.0.0.1:8105/index.html'
OBSERVE = """() => ({speed:Number(document.querySelector('.drive-hud__speed')?.textContent),
  gear:document.querySelector('.drive-hud__gear')?.textContent,
  transmission:document.querySelector('.drive-hud__mode')?.textContent,
  toast:document.querySelector('.drive-toast')?.textContent,
  bodyClass:document.body.className,
  pointerLocked:!!document.pointerLockElement})"""


def save(page,name,data):
    directory = getattr(page,'_playthrough_directory',
        Path(__file__).resolve().parents[2] / 'output/playthrough/threejs-punk')
    directory.mkdir(parents=True,exist_ok=True)
    (directory / (name+'.json')).write_text(json.dumps(data,indent=2)+'\n')


async def enter(page):
    await page.get_by_role('button',name='ENTER',exact=True).click()
    await page.locator('.story-screen__skip').wait_for(state='visible')
    await page.keyboard.press('Escape')
    await page.locator('.story-screen__skip').wait_for(state='hidden')
    await page.wait_for_function("document.body.innerText.includes('DRIVE MODE')")
    await asyncio.sleep(2)


class Driver:
    def __init__(self,page):
        self.page=page
        self.samples=[]
        self.held=set()

    async def keys(self,wanted):
        for key in self.held-wanted: await self.page.keyboard.up(key)
        for key in wanted-self.held: await self.page.keyboard.down(key)
        self.held=wanted

    async def drive(self,seconds):
        start=time.monotonic()
        first_sample=len(self.samples)
        stuck=0
        recovery_until=0
        try:
            while time.monotonic()-start < seconds:
                elapsed=time.monotonic()-start
                state=await self.page.evaluate(OBSERVE)
                self.samples.append({'elapsed':round(elapsed,2),
                                     'keys':sorted(self.held),**state})
                if elapsed < recovery_until:
                    # Sample through reversing as well as forward travel.
                    # Reverse right, then countersteer while pulling away.
                    keys={'s','d'} if recovery_until-elapsed>2 else {'w','a'}
                    stuck=0
                else:
                    stuck=stuck+.25 if elapsed>3 and state['speed']<3 else 0
                    phase=elapsed%18
                    keys={'w'} if state['speed']<70 else set()
                    if 5<phase<5.25: keys|={'a','Space'}
                    if 5.25<=phase<5.5: keys|={'d'}
                    if 11<phase<11.5 and state['speed']<65: keys|={'Shift'}
                    if stuck>1.5:
                        recovery_until=elapsed+5
                        keys={'s','d'}
                        stuck=0
                await self.keys(keys)
                await asyncio.sleep(.25)
        finally:
            await self.keys(set())
        driven=self.samples[first_sample:]
        assert max(s['speed'] for s in driven)>15,'Car never accelerated'
        assert sum(s['speed']>5 for s in driven)>len(driven)/4,'Car stayed blocked for most of the run'


async def driving(page,ctl):
    driver=Driver(page)
    cameras=[]
    try:
        for camera in ['chase','chaseFar','hood','bumper']:
            if camera!='chase':
                await ctl.tap('c')
                await page.wait_for_function("name => document.querySelector('.drive-toast').textContent.toLowerCase() === name",arg=camera.lower())
            cameras.append(camera)
            await driver.drive(32)
        await ctl.tap('e')
        await page.wait_for_function("document.querySelector('.drive-hud__mode').textContent === 'MAN'")
        await ctl.tap('q')
        await ctl.tap('g')
        await ctl.tap('l')
        await ctl.tap('t')
        await ctl.tap('t')
    finally:
        save(page,'drive-telemetry',{'cameras':cameras,'samples':driver.samples})


async def enter_walk(page):
    await enter(page)
    # Headless Chrome rejects native pointer lock on this page. Use Chrome's
    # native touchscreen input path, which the original walking controller
    # supports, instead of patching requestPointerLock or game state.
    session=await page.context.new_cdp_session(page)
    await session.send('Emulation.setTouchEmulationEnabled',
                       {'enabled':True,'maxTouchPoints':1})
    page._walk_touch=session
    await page.keyboard.press('f')
    await page.get_by_role('button',name='Drag to look around',exact=True).wait_for()
    await touch_look(page,100,-20)
    await page.get_by_role('button',name='Drag to look around',exact=True).wait_for(state='hidden')


async def touch_look(page,dx,dy):
    session=page._walk_touch
    await session.send('Input.dispatchTouchEvent',{'type':'touchStart',
        'touchPoints':[{'x':640,'y':320}]})
    try:
        for step in range(1,21):
            await session.send('Input.dispatchTouchEvent',{'type':'touchMove',
                'touchPoints':[{'x':640+dx*step/20,'y':320+dy*step/20}]})
            await asyncio.sleep(.025)
    finally:
        await session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})


async def walking(page,ctl):
    samples=[]
    try:
        for key,seconds,dx in [('w',5,80),('a',4,-45),('s',5,-80),('d',4,45),('w',5,60),('s',5,-60)]:
            await ctl.hold(key,seconds)
            await touch_look(page,dx,0)
            samples.append(await page.evaluate(OBSERVE))
        await ctl.wait(3)
        assert await page.evaluate('navigator.maxTouchPoints > 0')
    finally:
        save(page,'walk-telemetry',{'input':'native Chrome touch emulation + keyboard',
                                  'samples':samples})


async def enter_garage(page):
    await enter(page)
    await page.get_by_role('button',name='Garage',exact=True).click()
    await page.locator('.garage__name').filter(has_text='QUADRA').wait_for()
    await page.locator('.garage-transit.is-active').wait_for(state='hidden')


async def garage(page,ctl):
    cars=[]
    try:
        for index in range(7):
            save(page,'garage-progress',{'index':index,'stage':'observe'})
            name=await page.locator('.garage__name').inner_text()
            cars.append({'name':name,'locked':await page.locator('.garage').evaluate("e=>e.classList.contains('is-locked')")})
            save(page,'garage-progress',{'index':index,'stage':'orbit'})
            await ctl.drag(130,-20,1.5)
            await page.mouse.wheel(0,120 if index%2 else -120)
            await ctl.wait(3)
            save(page,'garage-progress',{'index':index,'stage':'next-car','name':name})
            await page.keyboard.press('ArrowRight')
            await page.wait_for_function('old => document.querySelector(".garage__name").innerText !== old',arg=name)
            await page.locator('.garage-transit.is-active').wait_for(state='hidden')
        assert len({c['name'] for c in cars})==7
        # The current car's YOUR RIDE button is intentionally disabled.
        # Escape returns with that car through the documented garage UI.
        await page.keyboard.press('Escape')
        await page.locator('.garage').wait_for(state='hidden')
        await Driver(page).drive(5)
    finally:
        save(page,'garage-cars',cars)


def panel_entry(key,selector):
    async def open_panel(page):
        await enter(page)
        await page.keyboard.press(key)
        await page.locator(selector).wait_for(state='visible')
    return open_panel


async def map_play(page,ctl):
    for _ in range(4):
        await page.get_by_role('button',name='Zoom in',exact=True).click()
        await ctl.drag(110,40,1)
        await ctl.wait(3)
        await page.get_by_role('button',name='Zoom out',exact=True).click()
        await page.get_by_role('button',name='Center on player',exact=True).click()
        await ctl.wait(3)
    await page.locator('.citymap__canvas').click(position={'x':700,'y':330})
    await ctl.wait(3)
    save(page,'map-ui',await page.locator('.citymap').inner_text())
    await ctl.tap('Tab')
    await Driver(page).drive(3)


async def radio_play(page,ctl):
    tracks=[]
    for _ in range(4):
        await page.get_by_role('button',name='Play',exact=True).click()
        await ctl.wait(6)
        tracks.append(await page.locator('.radio__title').inner_text())
        await page.get_by_role('button',name='Next',exact=True).click()
        await ctl.wait(2)
    assert len(set(tracks))>1
    save(page,'radio-tracks',tracks)
    await ctl.tap('Escape')
    await Driver(page).drive(3)


async def achievements_play(page,ctl):
    # Scroll the real panel, then return to driving. This is a menu, not an
    # assertion that locked achievements or progression have been completed.
    for delta in [320,320,-320,-320]:
        await page.locator('.achievements').hover()
        await page.mouse.wheel(0,delta)
        await ctl.wait(8)
    save(page,'achievements-ui',await page.locator('.achievements').inner_text())
    await ctl.tap('Escape')
    await Driver(page).drive(3)


async def messages_play(page,ctl):
    await ctl.wait(8)
    save(page,'messages-ui',await page.locator('.phone').inner_text())
    for key in ['ArrowDown','ArrowUp','Enter']:
        await ctl.tap(key)
        await ctl.wait(8)
    await ctl.tap('Escape')
    await Driver(page).drive(3)


async def enter_settings(page):
    await enter(page)
    await page.get_by_role('button',name='Settings',exact=True).click()
    await page.locator('.settings-close').wait_for(state='visible')


async def settings_play(page,ctl):
    for look in ['Neutral','Neon Noir','Magenta Rain','Teal Dusk','Silent Hill','Sin City']:
        await page.get_by_role('button',name=look,exact=True).click()
        await ctl.wait(5.2)
    await page.get_by_role('button',name='Neon Noir',exact=True).click()
    await page.locator('.settings-close').click()
    await ctl.tap('h')
    await page.locator('.drive-controls').wait_for(state='visible')
    save(page,'driving-controls-ui',await page.locator('.drive-controls').inner_text())
    await ctl.wait(3)
    await ctl.tap('Escape')
    await Driver(page).drive(3)


MODES=[
    Mode('drive',enter,driving,seconds=136,note='32 seconds in each of chase, chaseFar, hood and bumper cameras; acceleration, steering, drift, nitro, gears, lights and assists.'),
    Mode('walk',enter_walk,walking,seconds=38,note='Exit with F; native Chrome touch emulation supplies drag-to-look alongside WASD. Headless desktop pointer lock is unavailable; no API shim.'),
    Mode('garage',enter_garage,garage,seconds=90,enter_seconds=180,note='Browse all seven cars with native orbit/zoom; locked cars remain locked; return to the city with the starter car.'),
    Mode('city-map',panel_entry('Tab','.citymap.is-open'),map_play,seconds=44,note='Native map zoom, pan, recenter and waypoint selection, then resume driving.'),
    Mode('radio',panel_entry('m','.radio'),radio_play,seconds=38,note='Play and switch local radio tracks, then resume driving.'),
    Mode('achievements',panel_entry('j','.achievements'),achievements_play,seconds=38,note='Browse achievement progress for at least 30 seconds, then resume driving.'),
    Mode('messages',panel_entry('i','.phone'),messages_play,seconds=38,note='Read dispatch inbox and set GPS using Enter, then resume driving.'),
    Mode('settings',enter_settings,settings_play,seconds=42,note='Exercise all six visual looks, restore Neon Noir and inspect native driving help.'),
]


def require_completion(play):
    async def checked(page,ctl):
        page.set_default_timeout(8000)
        try:
            await play(page,ctl)
        except asyncio.CancelledError as error:
            raise AssertionError('Input script did not finish within the mode budget') from error
    return checked


for mode in MODES:
    mode.play=require_completion(mode.play)
