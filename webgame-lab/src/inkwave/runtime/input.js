/** Local input ownership; no listeners survive dispose. Drag or pointer-lock to look. */
export class LabInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.padPressed = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false };
    this.lastDevice = "mouse";
    this.pad = null;
    this.abort = new AbortController();
    const opts = { signal: this.abort.signal };
    const editable = (e) =>
      e.target?.closest?.("input,select,textarea,[contenteditable=true]");
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          editable(e) ||
          (e.target?.closest?.("button") && ["Space", "Enter"].includes(e.code))
        )
          return;
        if (
          [
            "Space",
            "Tab",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
          ].includes(e.code)
        )
          e.preventDefault();
        if (!this.keys.has(e.code)) this.pressed.add(e.code);
        this.keys.add(e.code);
      },
      opts,
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), opts);
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        this.drag = true;
        if (e.button === 0) this.mouse.left = true;
        if (e.button === 2) this.mouse.right = true;
      },
      opts,
    );
    window.addEventListener(
      "pointerup",
      () => {
        this.drag = false;
        this.mouse.left = this.mouse.right = false;
      },
      opts,
    );
    window.addEventListener(
      "pointermove",
      (e) => {
        if (this.drag || document.pointerLockElement === canvas) {
          this.mouse.dx += e.movementX;
          this.mouse.dy += e.movementY;
          this.lastDevice = "mouse";
        }
      },
      opts,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opts);
    window.addEventListener("blur", () => this.clear(), opts);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.clear();
      },
      opts,
    );
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.left = this.mouse.right = false;
    this.drag = false;
  }
  down(k) {
    return this.keys.has(k);
  }
  wasPressed(k) {
    return this.pressed.has(k);
  }
  pollPad() {
    const old = this.pad;
    this.pad =
      Array.from(navigator.getGamepads?.() || []).find(Boolean) || null;
    this.padPressed.clear();
    if (this.pad) {
      this.pad.buttons.forEach((b, i) => {
        if (b.pressed && !old?.buttons[i]?.pressed) this.padPressed.add(i);
      });
      if (
        this.pad.axes.some((x) => Math.abs(x) > 0.2) ||
        this.pad.buttons.some((b) => b.pressed)
      )
        this.lastDevice = "pad";
    }
  }
  padButton(i) {
    return !!this.pad?.buttons[i]?.pressed;
  }
  padValue(i) {
    return this.pad?.buttons[i]?.value || 0;
  }
  padStick(x, y, out, dead = 0.14, max = 0.95) {
    let a = this.pad?.axes[x] || 0,
      b = this.pad?.axes[y] || 0,
      m = Math.hypot(a, b);
    const k = Math.max(0, Math.min(1, (m - dead) / (max - dead)));
    out.x = m ? (a / m) * k : 0;
    out.y = m ? (b / m) * k : 0;
    out.mag = k;
    return out;
  }
  rumble(strong, weak, ms) {
    this.pad?.vibrationActuator
      ?.playEffect("dual-rumble", {
        duration: ms,
        strongMagnitude: strong,
        weakMagnitude: weak,
      })
      ?.catch(() => {});
  }
  requestLock() {
    return this.canvas.requestPointerLock?.();
  }
  endFrame() {
    this.mouse.dx = this.mouse.dy = 0;
    this.pressed.clear();
    this.padPressed.clear();
  }
  dispose() {
    this.abort.abort();
    this.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
}
