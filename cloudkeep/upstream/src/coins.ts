import * as THREE from 'three';

/** Shared geometry: a thick gold coin with a raised rim and sun stamp. */
export function coinTemplate(environment: THREE.Texture | null) {
  const root = new THREE.Group(); root.name = 'Sky coin';
  const gold = new THREE.MeshStandardMaterial({ color: '#ffc653', metalness: .72, roughness: .24, envMap: environment, envMapIntensity: .7 });
  const face = new THREE.MeshStandardMaterial({ color: '#ffe5a1', metalness: .56, roughness: .27, envMap: environment, envMapIntensity: .65 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.46, .46, .12, 40), gold);
  body.rotation.x = Math.PI / 2; root.add(body);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .11 : .255;
    if (i === 0) star.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else star.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  star.closePath();
  const stampGeometry = new THREE.ExtrudeGeometry(star, { depth: .016, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .007, bevelThickness: .007 });
  const rimGeometry = new THREE.TorusGeometry(.397, .026, 6, 40);
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeometry, face); rim.position.z = side * .07; root.add(rim);
    const stamp = new THREE.Mesh(stampGeometry, face); stamp.position.z = side * .068;
    if (side < 0) stamp.rotation.y = Math.PI;
    root.add(stamp);
  }
  return root;
}
