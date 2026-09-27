"""Exercise the archived portfolio through its menus and physical controls.

Source map: BeAPK0YT.js lists the two experiences, four work cards and controls;
CnN2HCEA.js builds four travel destinations; B-Z8xTec.js implements the tutorial,
combat and four-piece desktop pipe puzzle. Boss/fodder models have no vehicle
selector. External store/social links are destinations, not extra game modes.

The passive controller observer only reads positions/readiness. It never emits
engine events, changes saves, teleports, or calls gameplay mutation methods.
"""

import asyncio
import math
import time

from playthrough import Mode

SERVE = ['longhoang-lyo']
URL = 'http://127.0.0.1:8090/'
WORLD = '(window.__lyoController || window.__observeController).world'
OBSERVER = """import('/assets/BW6YWG0R.js').then(({a}) => {
  a.on('controller-ready', controller => { window.__lyoController = controller; });
});"""


async def read(page, expression):
    return await page.evaluate('() => { const w = ' + WORLD + '; return (' + expression + '); }')


async def ready(page):
    await page.wait_for_function('''() => {
      const c = window.__lyoController || window.__observeController;
      return c?.inputEnabled && c.world?.isBootstrapped &&
        !c.world.transitionScreen.isFastTraveling && !c.world.revealScreen.isActive;
    }''')


async def boot(page):
    # The upstream skip card requires visit_count >= 2. A normal reload creates
    # that second visit; do not manufacture saved progress in localStorage.
    await page.get_by_role('button', name="LET'S GO", exact=True).wait_for(state='visible')
    await page.add_init_script(OBSERVER)
    await page.reload(wait_until='domcontentloaded')
    await page.get_by_role('button', name="LET'S GO", exact=True).click()
    await page.wait_for_function('window.__lyoController?.inputEnabled')


async def enter_tutorial(page):
    await boot(page)
    await page.locator('.tutorial-card--move').wait_for(state='visible')


async def enter_factory(page):
    await boot(page)
    await page.get_by_role('button', name='Skip tutorial and fast travel to factory').click()
    await page.wait_for_function(WORLD + '.tutorial.hasBypassed')
    await ready(page)
    # The factory reveal starts shortly after the teleport.
    await page.wait_for_timeout(800)
    await ready(page)


async def enter_view(page):
    await enter_factory(page)
    await page.get_by_role('button', name='Open settings', exact=True).click()
    await page.locator('[data-mode="view"]').click()
    await page.wait_for_function(WORLD + '.setting.currentMode === "view"')
    await ready(page)


async def travel(page, destination):
    await page.keyboard.press('m')
    await page.get_by_role('button', name='Fast travel to ' + destination, exact=True).click()
    await page.wait_for_timeout(500)
    await ready(page)


async def steer_to(page, target, seconds=12, distance=2):
    """Tank steering: W drives along positive local X (the input cache swaps forward/backward); A/D change heading."""
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        state = await read(page, '''(() => {
          const p = w.robot.model.object3D.position;
          const q = w.robot.model.object3D.quaternion;
          const v = p.clone().set(1,0,0).applyQuaternion(q);
          return {x:p.x,z:p.z,dx:v.x,dz:v.z};
        })()''')
        dx, dz = target[0] - state['x'], target[1] - state['z']
        if math.hypot(dx, dz) < distance:
            return
        angle = math.atan2(-dz, dx) - math.atan2(-state['dz'], state['dx'])
        angle = (angle + math.pi) % (2 * math.pi) - math.pi
        key = ('a' if angle > 0 else 'd') if abs(angle) > .18 else 'w'
        await page.keyboard.down(key)
        try:
            await asyncio.sleep(.16 if key != 'w' else .28)
        finally:
            await page.keyboard.up(key)
    raise RuntimeError('Could not drive to interaction point ' + str(target))


async def interact(page, panel):
    # Travel markers stop just outside some interaction radii.
    for _ in range(3):
        if await page.locator(panel).is_visible():
            return
        anchor = {'.about-page__panel': 'StatueActionAnchor',
                  '.email-popup__form': 'mail_ref',
                  '.aboutproject-popup__title': 'PowerCoreMonitorAnchor',
                  '.power-core': 'PowerCoreRefAnchor',
                  '.bts-page__scroll-container': 'EB_Transition_Anchor'}[panel]
        target = await read(page, """(() => {
          const entries=[...w.interactionSystem.interactables.entries()];
          const entry=entries.find(([o,d])=>o.name===""" + repr(anchor) + """);
          if(!entry) return null;
          const [o,d]=entry, p=w.robot.model.object3D.position;
          const dy=o.position.y-p.y;
          return {x:o.position.x,z:o.position.z,near:d.isNear,
                  radius:Math.sqrt(Math.max(1,d.distance*d.distance-dy*dy))-.3};
        })()""")
        if not target:
            raise RuntimeError('Missing interaction anchor: ' + anchor)
        if not target['near']:
            await steer_to(page, [target['x'],target['z']], distance=target['radius'])
        await page.keyboard.press('f')
        await page.wait_for_timeout(1200)
    await page.locator(panel).wait_for(state='visible', timeout=5000)


async def enter_power_core(page):
    await enter_factory(page)
    # Go west of the statue and tanks; the eastern road enters enemy range.
    for waypoint in ([-4,20], [-4,8]):
        await steer_to(page, waypoint, seconds=12, distance=1)
    await interact(page, '.power-core')


async def power_core(page, ctl):
    # The skipped tutorial legitimately awards one gear; inventory requirements
    # still apply. Exercise the real drag/drop gate without fabricating items.
    if await page.get_by_role('button', name='Expand Item Counter', exact=True).is_visible():
        await page.get_by_role('button', name='Expand Item Counter', exact=True).click()
    await page.locator('.item-slot[data-type="gear"]').drag_to(page.locator('.power-core__dropzone'))
    await ctl.wait(3)
    await ctl.tap('Escape')
    await ctl.tap('Escape')
    await ready(page)
    await drive(page, ctl)


async def enter_about(page):
    await enter_view(page)
    await travel(page, 'About')


async def enter_contact(page):
    await enter_view(page)
    await travel(page, 'Contact')


async def enter_work(page):
    await enter_view(page)
    await travel(page, 'Work')


async def enter_pipes(page):
    await enter_view(page)
    await travel(page, '??????')


async def tutorial(page, ctl):
    # Follow the path, turn, boost when its card unlocks, and fire once taught.
    while True:
        for key, duration in [('w', 6), ('d', .65), ('w', 4), ('a', .65), ('s', 2)]:
            await ctl.hold(key, duration)
            await ctl.tap('Space')
        await page.keyboard.down('Shift')
        try:
            await ctl.hold('w', 3)
        finally:
            await page.keyboard.up('Shift')


async def drive(page, ctl):
    while True:
        for key, duration in [('w', 2.5), ('a', .8), ('w', 2), ('d', 1), ('s', 1.5)]:
            await page.keyboard.down(key)
            try:
                end = time.monotonic() + duration
                while time.monotonic() < end:
                    # Aim at a real enemy when visible; repeated taps fire bursts.
                    xy = await read(page, '''(() => {
                      const p=w.robot.model.object3D.position;
                      const es=w.enemyManager.enemies.filter(e=>e.health>0 && e.mesh);
                      es.sort((a,b)=>p.distanceTo(a.mesh.position)-p.distanceTo(b.mesh.position));
                      if(!es.length) return [900,300];
                      const v=es[0].mesh.position.clone(); v.y+=1; v.project(w.camera.instance);
                      return [(v.x+1)*640,(1-v.y)*360];
                    })()''')
                    await page.mouse.move(max(40,min(1240,xy[0])), max(80,min(650,xy[1])))
                    await ctl.tap('Space')
                    await ctl.wait(.3)
            finally:
                await page.keyboard.up(key)
        await ctl.tap('1')
        await ctl.tap('2')


async def combat(page, ctl):
    while True:
        enemies = await read(page, "w.enemyManager.enemies.filter(e=>e.health>0).map(e=>({id:e.id,type:e.type,x:e.mesh.position.x,z:e.mesh.position.z,health:e.health}))")
        if not enemies:
            await drive(page, ctl)
        pos = await read(page, 'w.robot.model.object3D.position')
        enemy = min(enemies, key=lambda e: math.hypot(e['x']-pos['x'],e['z']-pos['z']))
        try:
            # The central north/south road avoids the crane's support columns.
            await steer_to(page, [12.5,pos['z']], seconds=8, distance=2)
            await steer_to(page, [12.5,enemy['z']], seconds=12, distance=2)
            await steer_to(page, [enemy['x'],enemy['z']], seconds=12, distance=8)
        except RuntimeError:
            # Obstacles are physical: reverse and turn, then continue firing.
            await ctl.hold('s', 1)
            await ctl.hold('d', .7)
        for _ in range(45):
            target = await read(page, "w.enemyManager.enemies.find(e=>e.id===" + repr(enemy['id']) + ")?.mesh.position || null")
            if target is None:
                break
            xy = await project(page, "w.enemyManager.enemies.find(e=>e.id===" + repr(enemy['id']) + ").mesh.position.clone().add(w.robot.model.object3D.position.clone().set(0,1,0))")
            await page.mouse.move(max(20,min(1260,xy[0])), max(80,min(660,xy[1])))
            await ctl.tap('Space')
            await ctl.tap('f')
            await ctl.wait(.3)
        print('combat health:', await read(page, "w.enemyManager.enemies.map(e=>({id:e.id,health:e.health}))"), flush=True)


async def about(page, ctl):
    await interact(page, '.about-page__panel')
    # Desktop uses a cursor-following photo trail; the carousel dots belong to
    # the mobile layout and are hidden at the runner's 1280px viewport.
    for x,y in [(260,240),(800,300),(450,180),(1000,400),(640,280)]:
        await page.mouse.move(x,y,steps=20)
        await ctl.wait(1)
    for _ in range(6):
        await page.mouse.move(950, 500)
        await page.mouse.wheel(0, 520)
        await ctl.wait(1)
    for label in ['WEB/APP DESIGN', '3D DESIGN', 'PRODUCT DESIGN', 'DEVELOPMENT']:
        await page.get_by_role('tab', name=label, exact=True).click()
        await ctl.wait(1)
    await ctl.tap('Escape')
    await drive(page, ctl)


async def contact(page, ctl):
    await interact(page, '.email-popup__form')
    # Exercise local validation only. A valid submit would contact the relay.
    await page.get_by_role('button', name='SUBMIT', exact=True).click()
    for name, value in [('name', 'Local playthrough'), ('email', 'offline@example.invalid'),
                        ('budget', 'Offline review')]:
        await page.locator(f'.email-popup__form [name="{name}"]').fill(value)
        await ctl.wait(1)
    await page.locator('.email-popup__form [name="message"]').fill('Local form preview; not sent.')
    await ctl.wait(2)
    await ctl.tap('Escape')
    await drive(page, ctl)


def work_entry(index):
    async def enter(page):
        await enter_work(page)
        await interact(page, '.aboutproject-popup__title')
        for _ in range(index):
            await page.locator('.aboutproject-popup__nav-button--next').click()
            await page.wait_for_timeout(500)
    return enter


async def work_play(page, ctl):
    await ctl.wait(3)
    await ctl.tap('Escape')
    await ready(page)
    await drive(page, ctl)


async def enter_case_study(page):
    await work_entry(0)(page)
    await page.get_by_role('button', name='SEE MORE for Hanzii', exact=True).click()
    await page.locator('.case-study-page__layout').wait_for(state='visible')


async def scroll_case_study(page, ctl):
    for label in ['Overview', 'Phase 1: Discover', 'Phase 2: Define', 'Phase 3: Develop',
                  'Phase 4: Deliver', 'Key Features', 'Business Impact']:
        await page.locator('.case-study-page__toc-btn').filter(has_text=label).first.click()
        await ctl.wait(3)
        await page.mouse.move(500, 500)
        await page.mouse.wheel(0, 550)
        await ctl.wait(2)
    while True:
        await page.mouse.wheel(0, -700)
        await ctl.wait(2)


async def project(page, expression, ground=False):
    return await read(page, '''(() => {
      const v=(''' + expression + ''').clone();
      ''' + ('v.y=w.robot.model.object3D.position.y;' if ground else '') + '''
      v.project(w.camera.instance); return [(v.x+1)*640,(1-v.y)*360];
    })()''')


async def solve_pipes(page):
    """Grab four real pieces, rotate with arrow keys, and place with the mouse."""
    for _ in range(12):
        state = await read(page, '''({won:w.pipeGame.isWon,
          pipes:w.pipeGame.pipes.map(p=>({name:p.name,tile:p.userData.targetTileIdx}))})''')
        if state['won']:
            return
        loose = [p for p in state['pipes'] if p.get('tile', -1) not in (0,3,4,5)]
        if not loose:
            raise RuntimeError('All pipes placed but circuit did not connect')
        name = loose[0]['name']
        if not await read(page, 'w.grabMode.isActive'):
            await page.keyboard.press('g')
            await page.wait_for_timeout(550)
        xy = await project(page, 'w.pipeGame.pipes.find(p=>p.name===' + repr(name) + ').position')
        await page.mouse.move(*xy)
        await page.wait_for_timeout(250)
        await page.mouse.click(*xy)
        await page.wait_for_timeout(400)
        grabbed = await read(page, 'w.grabMode.grabbedObject?.mesh.name || null')
        if not grabbed:
            continue
        # Lift clear of neighbouring pieces before rotating the physical body.
        await page.keyboard.down('q')
        await page.wait_for_timeout(350)
        await page.keyboard.up('q')
        await page.wait_for_timeout(600)
        filled = [p.get('tile') for p in state['pipes']]
        tile = 4 if grabbed == 'Straight' else next(t for t in (0,3,5) if t not in filled)
        angle = {0: math.pi/2, 3: math.pi, 4: 0, 5: 0}[tile]
        # Search rotations on cloned quaternions only, mirroring the documented
        # 45-degree arrow controls. No mesh/body/target rotations are assigned.
        keys = await page.evaluate('''({angle, world}) => {
          const w=eval(world), g=w.grabMode, p=g.grabbedObject.mesh;
          const axis=p.position.clone().set(1,0,0).applyQuaternion(w.camera.instance.quaternion);
          const up=axis.clone().set(0,1,0), tilt=axis.clone().set(0,0,0);
          if(Math.abs(axis.x)>Math.abs(axis.z)) tilt.x=Math.sign(axis.x); else tilt.z=Math.sign(axis.z);
          const goal=g.targetRotation.clone().setFromAxisAngle(up,angle);
          const offset=p.userData.collisionRotOffset;
          if(offset) goal.multiply(offset.clone().invert());
          const queue=[[g.targetRotation.clone(),[]]], seen=new Set();
          while(queue.length && seen.size<16000) {
            const [q,path]=queue.shift();
            if(q.angleTo(goal)<.01) return path;
            if(path.length>=8) continue;
            for(const [key,a,sign] of [['ArrowLeft',up,1],['ArrowRight',up,-1],
                                        ['ArrowUp',tilt,1],['ArrowDown',tilt,-1]]) {
              const r=q.clone().premultiply(q.clone().setFromAxisAngle(a,sign*Math.PI/4));
              const e=p.rotation.clone().setFromQuaternion(r);
              for(const k of ['x','y','z']) e[k]=Math.round(e[k]/(Math.PI/4))*(Math.PI/4);
              r.setFromEuler(e).normalize();
              const id=[r.x,r.y,r.z,r.w].map(v=>Math.round(v*1000)).join(',');
              if(!seen.has(id)){seen.add(id);queue.push([r,[...path,key]]);}
            }
          }
          throw Error('No arrow-key pipe rotation found');
        }''', {'angle': angle, 'world': WORLD})
        for key in keys:
            await page.keyboard.press(key)
            await page.wait_for_timeout(80)
        xy = await project(page, f'w.pipeGame.virtualTiles[{tile}]', ground=True)
        await page.mouse.move(*xy, steps=12)
        await page.wait_for_timeout(1200)
        # Lower a tilted stack piece to board height using the real Q/E controls.
        height = await read(page, 'w.grabMode.grabbedObject.mesh.position.y')
        if abs(height - 3.2) > .15:
            key = 'q' if height < 3.2 else 'e'
            await page.keyboard.down(key)
            await page.wait_for_timeout(min(900, abs(height-3.2)*250))
            await page.keyboard.up(key)
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(600)
        await page.keyboard.press('g')
        await page.wait_for_timeout(900)
        print('pipe placement:', grabbed, 'target', tile, await read(page,
              'w.pipeGame.pipes.map(p=>({name:p.name,tile:p.userData.targetTileIdx,pos:p.position}))'), flush=True)
    raise RuntimeError('Pipe puzzle did not connect after real grab/rotate/place attempts')


async def pipes(page, ctl):
    await solve_pipes(page)
    await ready(page)
    await drive(page, ctl)


async def enter_behind_scene(page):
    await enter_pipes(page)
    await solve_pipes(page)
    await ready(page)
    await interact(page, '.bts-page__scroll-container')


async def behind_scene(page, ctl):
    for _ in range(10):
        await page.mouse.move(950,500)
        await page.mouse.wheel(0,600)
        await ctl.wait(1.5)
    # The footer is a Matter.js playground: drag the technology cards.
    area = page.locator('#bts-physic-area')
    await area.scroll_into_view_if_needed()
    box = await area.bounding_box()
    while True:
        for fraction in (.25,.5,.7):
            x,y=box['x']+box['width']*fraction, min(650,box['y']+box['height']*.6)
            await page.mouse.move(x,y)
            await page.mouse.down()
            try:
                await page.mouse.move(x+100,y-100,steps=20)
                await ctl.wait(.5)
            finally:
                await page.mouse.up()
            await ctl.wait(1)


async def unavailable(page):
    pass


async def no_play(page, ctl):
    pass


MODES = [
    Mode('tutorial', enter_tutorial, tutorial, seconds=45,
         note='Unskipped desktop tutorial: tank movement, steering, boost and shooting as unlocked.'),
    Mode('game-factory', enter_factory, combat, seconds=150,
         note='Game mode via the repeat-visit Skip Tutorial card; combat, movement and destruction.'),
    Mode('power-core', enter_power_core, power_core, seconds=45,
         note='Game mode > drive to the Power Core console > F; inventory drag/drop and locked activation, then driving.'),
    Mode('view-about', enter_about, about, seconds=60,
         note='Settings > View mode > Map > About; drive, open the profile, photo trail and skill tabs.'),
    Mode('view-contact', enter_contact, contact, seconds=45,
         note='View mode > Map > Contact; local form validation and robot driving. No message sent.'),
    *[Mode('view-work-' + name, work_entry(index), work_play, seconds=40,
           note='Map > Work > ' + name.title() + '; preview then drive. ' +
                ('SEE MORE opens the Hanzii case study.' if index==0 else
                 'Upstream marks this detail card LOCKED; the preview itself is reachable.'))
      for index,name in enumerate(['hanzii','niubii','mazii','todaii'])],
    Mode('hanzii-case-study', enter_case_study, scroll_case_study, seconds=40,
         note='Work > Hanzii > SEE MORE; scroll the table of contents. Only six of 35 referenced case-study assets are archived; later images and videos are missing.'),
    Mode('pipe-puzzle', enter_pipes, pipes, seconds=75,
         note='Map > ??????; desktop G grab, arrow rotation and mouse placement connect four pipes.'),
    Mode('behind-the-scene', enter_behind_scene, behind_scene, seconds=40,
         note='Solve pipes, open the electrical cabinet with F, scroll BTS and drag its physics cards. Both formats of the hero video are missing from the archive.'),
    Mode('contact-submit', unavailable, no_play, reachable=False,
         unreachable_reason='CakUKh2G.js sends contact forms to an external script.google.com Apps Script relay; '
                            'the archive contains no local relay. The form UI is covered by view-contact.'),
]
