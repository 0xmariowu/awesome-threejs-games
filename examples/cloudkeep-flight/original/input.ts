import { IDLE, type Input } from './simulation';

export type FlightView = { orbitYaw: number; orbitPitch: number; distanceScale: number; recenterId: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class Controls {
  readonly view: FlightView = { orbitYaw: 0, orbitPitch: 0, distanceScale: 1, recenterId: 0 };
  private keys = new Set<string>();
  private touches = new Map<number, string>();
  private queuedFeed = false;
  private queuedRecenter = false;
  private pointerCapture = false;
  private lookX = 0;
  private lookY = 0;
  private drag?: { id: number; x: number; y: number; orbit: boolean };
  private world = document.querySelector<HTMLElement>('#world')!;
  private wasLocked = false;
  private ignoreEscapeUntil = 0;
  enabled = false;

  constructor(onShortcut: (key: string) => void) {
    window.addEventListener('keydown', event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.code === 'Escape' && performance.now() < this.ignoreEscapeUntil) return;
      if (['Escape', 'KeyE', 'KeyH'].includes(event.code) && !event.repeat) {
        event.preventDefault(); onShortcut(event.code); return;
      }
      if (!this.enabled) return;
      if ((event.target as HTMLElement)?.tagName === 'BUTTON' && ['Space', 'Enter'].includes(event.code)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.code === 'KeyC') {
        this.centerView(); this.queuedRecenter = true; this.lookX = 0; this.lookY = 0;
        return;
      }
      this.keys.add(event.code);
      if (event.code === 'Space' && !event.repeat) this.queuedFeed = true;
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    document.addEventListener('pointerdown', event => {
      if (!this.enabled) return;
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLElement>('[data-control]');
      if (button) {
        event.preventDefault(); button.setPointerCapture(event.pointerId);
        this.touches.set(event.pointerId, button.dataset.control!); button.classList.add('pressed');
        if (button.dataset.control === 'feed') this.queuedFeed = true;
        return;
      }
      if (!this.world.contains(target)) return;
      if (document.pointerLockElement === this.world) {
        if (event.button === 0) this.pointerCapture = true;
        return;
      }
      if (this.drag || ![0, 2].includes(event.button)) return;
      event.preventDefault(); this.world.setPointerCapture(event.pointerId);
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, orbit: event.button === 2 || event.altKey };
      document.body.classList.add(this.drag.orbit ? 'orbiting' : 'steering');
    });
    document.addEventListener('pointermove', event => {
      if (!this.enabled) return;
      if (document.pointerLockElement === this.world) {
        this.rotate(event.movementX, event.movementY, event.altKey || (event.buttons & 2) !== 0);
      } else if (this.drag?.id === event.pointerId) {
        this.rotate(event.clientX - this.drag.x, event.clientY - this.drag.y, this.drag.orbit);
        this.drag.x = event.clientX; this.drag.y = event.clientY;
      }
    });
    const release = (event: PointerEvent) => {
      this.touches.delete(event.pointerId);
      (event.target as HTMLElement).closest('[data-control]')?.classList.remove('pressed');
      if (event.button === 0 || event.type === 'pointercancel') this.pointerCapture = false;
      if (this.drag?.id === event.pointerId) {
        this.drag = undefined; document.body.classList.remove('steering', 'orbiting');
      }
    };
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    document.addEventListener('lostpointercapture', release);
    this.world.addEventListener('contextmenu', event => { if (this.enabled) event.preventDefault(); });
    this.world.addEventListener('wheel', event => {
      if (!this.enabled) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      this.view.distanceScale = clamp(this.view.distanceScale * Math.exp(pixels * .0012), .68, 1.5);
    }, { passive: false });
    this.world.addEventListener('dblclick', () => {
      if (!this.enabled || !matchMedia('(pointer: fine)').matches || !this.world.requestPointerLock) return;
      this.centerView();
      // Drag steering remains available if browser mouse capture is declined.
      void Promise.resolve(this.world.requestPointerLock()).catch(() => {});
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.world;
      document.body.classList.toggle('mouse-captured', locked);
      this.drag = undefined; this.pointerCapture = false;
      document.body.classList.remove('steering', 'orbiting');
      if (this.wasLocked && !locked && this.enabled) {
        // Some browsers consume the first Escape before dispatching keydown.
        this.ignoreEscapeUntil = performance.now() + 200;
        onShortcut('Escape');
      }
      this.wasLocked = locked;
    });
  }

  private rotate(dx: number, dy: number, orbit: boolean) {
    if (orbit) {
      this.view.orbitYaw -= dx * .004;
      this.view.orbitPitch = clamp(this.view.orbitPitch - dy * .003, -1.2, 1.2);
      document.body.classList.add('view-detached');
    } else {
      if (this.view.orbitYaw !== 0 || this.view.orbitPitch !== 0) {
        this.view.orbitYaw = 0; this.view.orbitPitch = 0; this.view.recenterId++;
        document.body.classList.remove('view-detached');
      }
      this.lookX += dx * .004;
      this.lookY += dy * .003;
    }
  }

  centerView() {
    this.view.orbitYaw = 0; this.view.orbitPitch = 0; this.view.distanceScale = 1;
    this.view.recenterId++;
    document.body.classList.remove('view-detached');
  }

  clear() {
    this.keys.clear(); this.touches.clear(); this.queuedFeed = false; this.pointerCapture = false;
    this.queuedRecenter = false;
    this.lookX = 0; this.lookY = 0;
    if (this.drag && this.world.hasPointerCapture(this.drag.id)) this.world.releasePointerCapture(this.drag.id);
    this.drag = undefined;
    document.body.classList.remove('steering', 'orbiting');
    document.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
    if (document.pointerLockElement === this.world) document.exitPointerLock();
  }

  read(): Input {
    if (!this.enabled) return { ...IDLE };
    const actions = new Set(this.touches.values());
    const has = (code: string, action: string) => this.keys.has(code) || actions.has(action);
    const queuedFeed = this.queuedFeed; this.queuedFeed = false;
    const recenter = this.queuedRecenter; this.queuedRecenter = false;
    const lookX = this.lookX, lookY = this.lookY; this.lookX = 0; this.lookY = 0;
    return {
      throttle: Number(has('KeyW', 'forward')) - Number(has('KeyS', 'back')),
      strafe: Number(has('KeyD', 'right')) - Number(has('KeyA', 'left')),
      turn: Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft')),
      pitchTurn: Number(this.keys.has('ArrowUp')) - Number(this.keys.has('ArrowDown')),
      lookX, lookY, recenter,
      altitude: Number(has('KeyR', 'up')) - Number(has('KeyF', 'down')),
      boost: has('ShiftLeft', 'boost') || this.keys.has('ShiftRight'),
      feed: has('Space', 'feed') || queuedFeed,
      capture: has('KeyQ', 'capture') || this.pointerCapture,
    };
  }
}
