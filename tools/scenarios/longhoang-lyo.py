"""A 65-second factory overview: tracked driving, combat and pipe manipulation.

All movement and firing use real controls. The imported observer only reads
the world; the verified playthrough and archived game remain unchanged.
"""

import asyncio
import importlib.util
import math
import time
from pathlib import Path

from record import Shot


_spec = importlib.util.spec_from_file_location(
    '_lyo_playthrough', Path(__file__).resolve().parents[1] / 'playthrough/longhoang-lyo.py')
_play = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_play)


async def drive_to(page, target, distance=1.5):
    """Use the verified tank heading, holding each input through small checks."""
    until = time.monotonic() + 12
    held = None
    try:
        while time.monotonic() < until:
            state = await _play.read(page, """(() => {
              const p=w.robot.model.object3D.position;
              const v=p.clone().set(1,0,0).applyQuaternion(w.robot.model.object3D.quaternion);
              return {x:p.x,z:p.z,dx:v.x,dz:v.z};
            })()""")
            dx, dz = target[0] - state['x'], target[1] - state['z']
            if math.hypot(dx, dz) < distance:
                return
            angle = math.atan2(-dz, dx) - math.atan2(-state['dz'], state['dx'])
            angle = (angle + math.pi) % (2 * math.pi) - math.pi
            key = ('a' if angle > 0 else 'd') if abs(angle) > .18 else 'w'
            if key != held:
                if held:
                    await page.keyboard.up(held)
                await page.keyboard.down(key)
                held = key
            await asyncio.sleep(.06)
    finally:
        if held:
            await page.keyboard.up(held)
        await asyncio.sleep(.25)
    raise RuntimeError('Factory route obstructed at ' + str(target) + ' from ' + str(state))


async def prepare(page):
    await _play.enter_factory(page)
    # The reveal animation and its smoke must finish before the first frame.
    await asyncio.sleep(4)
    await _play.ready(page)
    await page.mouse.move(880, 300)


async def fight(page, enemy_id, seconds):
    """Track one real opponent with the mouse and fire deliberate bursts."""
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        target = await _play.read(page, '''(() => {
          const e=w.enemyManager.enemies.find(e=>e.id===''' + repr(enemy_id) + ''');
          if (!e || e.health<=0) return null;
          const v=e.mesh.position.clone(); v.y+=1; v.project(w.camera.instance);
          return {x:(v.x+1)*640,y:(1-v.y)*360,health:e.health};
        })()''')
        if target is None:
            await asyncio.sleep(1.4)
            return
        await page.mouse.move(max(20, min(1260, target['x'])),
                              max(80, min(660, target['y'])), steps=3)
        await page.keyboard.press('Space')
        await asyncio.sleep(.28)
    raise RuntimeError('Opponent survived the planned encounter: ' + enemy_id + ' ' + str(target))


async def place_pipes(page):
    """Demonstrate two placements using the verified grab/rotate/place inputs."""
    for _ in range(2):
        state = await _play.read(page, '''({won:w.pipeGame.isWon,
          pipes:w.pipeGame.pipes.map(p=>({name:p.name,tile:p.userData.targetTileIdx}))})''')
        if state['won']:
            return
        loose = [p for p in state['pipes'] if p.get('tile', -1) not in (0,3,4,5)]
        if not loose:
            raise RuntimeError('All pipes placed but circuit did not connect')
        name = loose[0]['name']
        if not await _play.read(page, 'w.grabMode.isActive'):
            await page.keyboard.press('g')
            await page.wait_for_timeout(550)
        xy = await _play.project(page, 'w.pipeGame.pipes.find(p=>p.name===' + repr(name) + ').position')
        await page.mouse.move(*xy)
        await page.wait_for_timeout(250)
        await page.mouse.click(*xy)
        await page.wait_for_timeout(400)
        grabbed = await _play.read(page, 'w.grabMode.grabbedObject?.mesh.name || null')
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
        }''', {'angle': angle, 'world': _play.WORLD})
        for key in keys:
            await page.keyboard.press(key)
            await page.wait_for_timeout(80)
        xy = await _play.project(page, f'w.pipeGame.virtualTiles[{tile}]', ground=True)
        await page.mouse.move(*xy, steps=12)
        await page.wait_for_timeout(1200)
        # Lower a tilted stack piece to board height using the real Q/E controls.
        height = await _play.read(page, 'w.grabMode.grabbedObject.mesh.position.y')
        if abs(height - 3.2) > .15:
            key = 'q' if height < 3.2 else 'e'
            await page.keyboard.down(key)
            await page.wait_for_timeout(min(900, abs(height-3.2)*250))
            await page.keyboard.up(key)
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(600)
        await page.keyboard.press('g')
        await page.wait_for_timeout(900)
        print('pipe placement:', grabbed, 'target', tile, await _play.read(page,
              'w.pipeGame.pipes.map(p=>({name:p.name,tile:p.userData.targetTileIdx,pos:p.position}))'), flush=True)


async def overview(page, _cue):
    began = time.monotonic()
    await drive_to(page, [12.5, 26], distance=1.5)
    await drive_to(page, [12.5, 19], distance=1.5)
    await fight(page, 'area_enemy003', 18)
    print('lyo first encounter: %.1fs' % (time.monotonic() - began), flush=True)
    await drive_to(page, [12.5, 8], distance=1.5)
    await drive_to(page, [12.5, -7], distance=1.5)
    await drive_to(page, [12.5, -10], distance=1.5)
    await fight(page, 'area_enemy002', 18)
    print('lyo second encounter: %.1fs' % (time.monotonic() - began), flush=True)
    for point in ([8, -13], [-2, -14], [-20, -14], [-20, -26], [-24, -26]):
        await drive_to(page, point, distance=1.5)
    await place_pipes(page)
    await _play.ready(page)
    print('lyo pipe demonstration: %.1fs' % (time.monotonic() - began), flush=True)
    await asyncio.sleep(2)
    for point in ([-20, -26], [-20, -14], [-13, -14], [-13, 0], [-13, 14], [-4, 20], [0, 26]):
        await drive_to(page, point, distance=1.5)
    await asyncio.sleep(max(0, 65 - (time.monotonic() - began)))
    if await _play.read(page, 'w.robot.isDead'):
        raise RuntimeError('The factory run must end with the player alive')


SHOTS = {
    'overview': Shot(
        url=_play.URL, module=None, serve=_play.SERVE,
        prepare=prepare, run=overview, overlay=False, scale=1,
        poster_at=3, preview_at=3, min_fps=45),
}
