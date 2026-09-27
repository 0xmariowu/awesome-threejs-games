import { describe, expect, it } from 'vitest';
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { FlightCamera } from '../src/flight-camera';
import { FLIGHT, vec } from '../src/simulation';

const view = { orbitYaw: 0, orbitPitch: 0, distanceScale: 1, recenterId: 0 };

describe('stable chase camera', () => {
  it('keeps its orbit distance through an abrupt 180-degree turn', () => {
    const rig = new FlightCamera(), pos = vec(0, 24, 0);
    rig.update(pos, 0, 0, view, 1 / 60, false);
    const initialArm = rig.position.distanceTo(rig.focus);
    for (let i = 0; i < 120; i++) {
      rig.update(pos, Math.PI, 0, view, 1 / 60, false);
      expect(rig.position.distanceTo(rig.focus)).toBeCloseTo(initialArm, 5);
    }
  });
  it('takes the short arc only when free-look is explicitly recentered', () => {
    const rig = new FlightCamera(), pos = vec(0, 24, 0);
    rig.update(pos, 0, 0, { ...view, orbitYaw: Math.PI * 2 - .1 }, 1 / 60, false);
    const before = rig.position.clone();
    rig.update(pos, 0, 0, { ...view, recenterId: 1 }, 1 / 60, false);
    expect(rig.position.distanceTo(before)).toBeLessThan(1);
  });
  it('honors the direction of long left and right mouse turns', () => {
    for (const direction of [-1, 1]) {
      const rig = new FlightCamera(), pos = vec(0, 24, 0);
      rig.update(pos, 0, 0, view, 1 / 60, false);
      rig.update(pos, direction * 4, 0, view, 1 / 60, false);
      expect(Math.sign(rig.position.x)).toBe(direction);
    }
  });
  it('keeps the balloon above the gondola throughout the supported view range', () => {
    for (const mobile of [false, true]) for (const height of [5, 17, 44])
      for (const pitch of [-FLIGHT.maxPitch, 0, FLIGHT.maxPitch]) for (const orbitPitch of [-1.2, 0, 1.2])
        for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (const orbitYaw of [-Math.PI / 2, 0, Math.PI])
          for (const zoom of [.68, 1.5]) {
            const rig = new FlightCamera(), pos = vec(0, height, 0);
            rig.update(pos, yaw, pitch, { orbitYaw, orbitPitch, distanceScale: zoom, recenterId: 0 }, 1 / 60, mobile);
            const camera = new PerspectiveCamera(46, mobile ? 390 / 844 : 1536 / 1024, .3, 900);
            camera.position.copy(rig.position); camera.lookAt(rig.aim); camera.updateMatrixWorld(true);
            for (const bank of [-FLIGHT.maxBank, FLIGHT.maxBank]) {
              const orientation = new Quaternion().setFromEuler(new Euler(Math.sign(pitch) * FLIGHT.maxBodyPitch, yaw, bank, 'YXZ'));
              const balloon = new Vector3(0, 3, 0).applyQuaternion(orientation).add(pos).project(camera);
              const gondola = new Vector3(0, -1, 0).applyQuaternion(orientation).add(pos).project(camera);
              expect(balloon.y).toBeGreaterThan(gondola.y);
              expect(Math.abs(balloon.x)).toBeLessThan(.95);
              expect(Math.abs(balloon.y)).toBeLessThan(.95);
              expect(Math.abs(gondola.y)).toBeLessThan(.95);
              expect(balloon.z).toBeGreaterThan(-1); expect(balloon.z).toBeLessThan(1);
            }
          }
  });
  it('settles consistently at 30 and 60 frames per second', () => {
    const a = new FlightCamera(), b = new FlightCamera(), pos = vec(0, 24, 0);
    a.update(pos, 0, 0, view, 0, false); b.update(pos, 0, 0, view, 0, false);
    for (let i = 0; i < 30; i++) a.update(pos, 2.6, .5, view, 1 / 30, false);
    for (let i = 0; i < 60; i++) b.update(pos, 2.6, .5, view, 1 / 60, false);
    expect(a.position.distanceTo(b.position)).toBeLessThan(.001);
  });
});
