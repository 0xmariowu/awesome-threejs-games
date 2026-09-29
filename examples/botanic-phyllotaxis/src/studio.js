import * as THREE from '../vendor/three/build/three.module.js';
import { theme } from './ui.js';
export { THREE };
export function studio(world) {
  const dark = theme() === 'dark';
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(dark ? '#263633' : '#e6ece5');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  world.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .05, 250);
  const target = new THREE.Vector3();
  const orbit = {yaw: .65, pitch: .42, distance: 14, top: false};
  scene.add(new THREE.HemisphereLight('#f5f6e8', '#66775a', 2.5));
  const light = new THREE.DirectionalLight('#fff2d7', 3.4);
  light.position.set(-5, 10, 6); light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {left:-12, right:12, top:12, bottom:-12, near:.1, far:45});
  light.shadow.bias = -.0003; light.shadow.normalBias = .035;
  scene.add(light);
  const fill = new THREE.DirectionalLight('#d9e9ff', 1.2); fill.position.set(6, 4, -8); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240,240), new THREE.MeshStandardMaterial({color: dark ? '#263633' : '#e6ece5', roughness: 1}));
  floor.rotation.x = -Math.PI/2; floor.position.y = -.26; floor.receiveShadow = true; scene.add(floor);
  function resize() { const w = world.clientWidth, h = world.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(world); resize();
  function view() {
    const pitch = orbit.top ? Math.PI/2-.001 : orbit.pitch;
    camera.position.set(target.x+Math.sin(orbit.yaw)*Math.cos(pitch)*orbit.distance, target.y+Math.sin(pitch)*orbit.distance, target.z+Math.cos(orbit.yaw)*Math.cos(pitch)*orbit.distance);
    camera.lookAt(target);
  }
  let drag;
  renderer.domElement.addEventListener('pointerdown', e => { drag=[e.clientX,e.clientY]; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointermove', e => { if (!drag) return; orbit.yaw-=(e.clientX-drag[0])*.007; orbit.pitch=THREE.MathUtils.clamp(orbit.pitch+(e.clientY-drag[1])*.006,.1,1.4); drag=[e.clientX,e.clientY]; });
  renderer.domElement.addEventListener('pointerup', () => drag=null);
  renderer.domElement.addEventListener('pointercancel', () => drag=null);
  renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); orbit.distance=THREE.MathUtils.clamp(orbit.distance*Math.exp(e.deltaY*.001),3,100); }, {passive:false});
  return {renderer,scene,camera,target,orbit,view};
}
export function release(group) {
  group.traverse(object => { object.dispose?.(); object.geometry?.dispose(); if(object.material) object.material.dispose(); if(object.customDepthMaterial) object.customDepthMaterial.dispose(); });
  group.clear();
}
export function material(color) { return new THREE.MeshStandardMaterial({color, roughness:.78, side:THREE.DoubleSide}); }
