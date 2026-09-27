// キーボード・マウス入力
// 基本はポインターロック。ロックが使えない環境では「フリールック」に切り替え、
// マウスの移動量で見回し、カーソルを画面端に寄せると回り続ける。
const EDGE = 0.07; // 画面端の回転ゾーン（幅の割合）

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.edges = new Set();
    this.mdx = 0; this.mdy = 0;
    this.left = false; this.right = false;
    this.leftPressed = false; this.leftReleased = false;
    this.locked = false;
    this.enabled = false;
    this.onLockChange = null;
    this.onFreeLook = null;
    this.freeLook = !('requestPointerLock' in el);
    this.cursor = { x: 0.5, y: 0.5, inside: false };

    addEventListener('keydown', (e) => {
      if (['Space', 'Tab', 'ControlLeft', 'KeyC'].includes(e.code) && this.enabled) e.preventDefault();
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.left = this.right = false; this.cursor.inside = false; });
    addEventListener('mousemove', (e) => {
      this.cursor.x = e.clientX / innerWidth;
      this.cursor.y = e.clientY / innerHeight;
      // 操作できない間（導入の文字など）の動きはためない（始まった瞬間に向きが飛ばないように）
      if (this.locked) { if (this.enabled) { this.mdx += e.movementX; this.mdy += e.movementY; } }
      else if (this.freeLook && this.enabled) { this.mdx += e.movementX || 0; this.mdy += e.movementY || 0; }
      else if (this.dragLook && (e.buttons & 4)) { this.mdx += e.movementX; this.mdy += e.movementY; }
    });
    el.addEventListener('mouseenter', () => (this.cursor.inside = true));
    el.addEventListener('mouseleave', () => (this.cursor.inside = false));
    el.addEventListener('mousedown', (e) => {
      this.cursor.inside = true;
      if (!this.enabled) return;
      // マウス固定前のクリックは「固定するため」のもの（フリールック中は銛に使う）
      if (!this.locked && !this.freeLook) return;
      if (e.button === 0) { this.left = true; this.leftPressed = true; }
      if (e.button === 2) this.right = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.left) { this.left = false; this.leftReleased = true; }
      if (e.button === 2) this.right = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // ロックが拒否された（非対応の環境・解除直後の再要求など）→ フリールックへ
    document.addEventListener('pointerlockerror', () => { if (!(performance.now() < this.softUntil)) this.enableFreeLook(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) { this.left = false; this.right = false; }
      this.onLockChange?.(this.locked);
    });
  }

  enableFreeLook() {
    if (this.freeLook) return;
    this.freeLook = true;
    this.onFreeLook?.();
  }

  // soft: 失敗してもフリールックに切り替えない（自分で解除した直後の再要求など、一時的に断られうるとき）
  lock({ soft = false } = {}) {
    if (!('requestPointerLock' in this.el)) { this.enableFreeLook(); return; }
    const fail = () => { if (!soft) this.enableFreeLook(); };
    try {
      // 失敗時の再要求はクリック直後の文脈を失うので、最初から素直に要求する
      if (soft) this.softUntil = performance.now() + 1500;
      const p = this.el.requestPointerLock();
      if (p && p.catch) p.catch(fail);
    } catch (e) {
      fail();
    }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.edges.has(code); }

  consumeMouse(dt = 0) {
    // フリールック中は、画面の端にカーソルがある間ずっと回る
    if (this.freeLook && !this.locked && this.enabled && this.cursor.inside && dt > 0) {
      const edge = (v) => (v < EDGE ? -(EDGE - v) / EDGE : v > 1 - EDGE ? (v - (1 - EDGE)) / EDGE : 0);
      this.mdx += edge(this.cursor.x) * 620 * dt;
      this.mdy += edge(this.cursor.y) * 380 * dt;
    }
    const r = [this.mdx, this.mdy];
    this.mdx = 0; this.mdy = 0;
    return r;
  }
  endFrame() { this.edges.clear(); this.leftPressed = false; this.leftReleased = false; }
}
