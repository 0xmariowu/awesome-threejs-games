import { MathUtils, Vector3 } from 'three';
import type { FlightView } from './input';
import type { Vec } from './simulation';

/** Smooth the orbit, never a chord through the airship. All vertical offsets use world-up. */
export class FlightCamera {
  readonly position = new Vector3();
  readonly aim = new Vector3();
  readonly focus = new Vector3();
  private forward = new Vector3();
  private yaw = 0;
  private pitch = 0;
  private zoom = 1;
  private recenterId = 0;
  private initial = true;

  reset() { this.initial = true; }

  update(pos: Vec, yaw: number, pitch: number, view: FlightView, dt: number, mobile: boolean) {
    const alpha = this.initial ? 1 : 1 - Math.exp(-dt * 12);
    const targetYaw = yaw + view.orbitYaw;
    // Input angles are unwrapped. A >180-degree left drag must still turn left.
    // Only an explicit recenter takes the shortest arc back from free-look.
    if (this.initial) this.yaw = targetYaw;
    else if (this.recenterId !== view.recenterId) this.yaw = targetYaw + Math.atan2(Math.sin(this.yaw - targetYaw), Math.cos(this.yaw - targetYaw));
    this.recenterId = view.recenterId;
    this.yaw = MathUtils.lerp(this.yaw, targetYaw, alpha);
    this.pitch = MathUtils.lerp(this.pitch, MathUtils.clamp(pitch + view.orbitPitch, -.90, .75), alpha);
    this.zoom = MathUtils.lerp(this.zoom, view.distanceScale, alpha);
    const follow = this.initial ? 1 : 1 - Math.exp(-dt * 10);
    this.focus.x = MathUtils.lerp(this.focus.x, pos.x, follow);
    this.focus.y = MathUtils.lerp(this.focus.y, pos.y + 2.4, follow);
    this.focus.z = MathUtils.lerp(this.focus.z, pos.z, follow);
    this.initial = false;

    const elevation = MathUtils.clamp(.44 - this.pitch, -.30, 1.0);
    const arm = (mobile ? 31 : 28) * this.zoom;
    this.position.set(Math.sin(this.yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(this.yaw) * Math.cos(elevation))
      .multiplyScalar(arm).add(this.focus);
    this.position.y = Math.max(2, this.position.y);
    this.forward.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.aim.copy(this.focus).addScaledVector(this.forward, 8);
  }
}
