/**
 * Adaptation of cloudkeep/upstream/src/scene.ts lines 273–289 at b28406d.
 * This is host code, not a byte-identical original file. The direct-follow
 * comparison bypasses extension smoothing; both modes retain island occlusion.
 */
import { MathUtils, PerspectiveCamera, Raycaster, Vector3, type Mesh } from 'three';
import type { FlightCamera } from '../original/flight-camera';
import type { Vec } from '../original/simulation';

export class CameraRig {
  readonly origin = new Vector3();
  readonly desired = new Vector3();
  readonly aim = new Vector3();
  armLength = 0;
  desiredArmLength = 0;
  occluded = false;
  private direction = new Vector3();
  private ray = new Raycaster();
  private initial = true;

  update(camera: PerspectiveCamera, flight: FlightCamera, pos: Vec, obstacles: Mesh[], dt: number, direct: boolean) {
    this.desired.copy(flight.position);
    this.origin.set(pos.x, pos.y + 1.5, pos.z);
    this.direction.subVectors(this.desired, this.origin);
    const length = this.direction.length();
    this.desiredArmLength = length;
    this.ray.set(this.origin, this.direction.normalize());
    this.ray.near = .1;
    this.ray.far = length + 1.5;
    const obstruction = this.ray.intersectObjects(obstacles, false)[0];
    const allowed = obstruction ? Math.min(length, Math.max(.5, obstruction.distance - 1.5)) : length;
    this.occluded = allowed < length;
    this.armLength = this.initial || direct || allowed < this.armLength
      ? allowed : MathUtils.lerp(this.armLength, allowed, 1 - Math.exp(-dt * 5));
    camera.position.copy(this.origin).addScaledVector(this.direction, this.armLength);
    this.aim.copy(flight.aim).lerp(flight.focus, length > 0 ? 1 - this.armLength / length : 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.aim);
    this.initial = false;
  }
}
