import * as THREE from 'three';

export function waterfall(height: number, clock: { value: number }) {
  const geometry = new THREE.PlaneGeometry(1.1, height, 5, 26);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: clock, fallHeight: { value: height } },
    vertexShader: `varying vec2 waterUV; varying float waterDistance; uniform float time;
      void main(){waterUV=uv;vec3 p=position;p.x+=sin(uv.y*12.0+time*.8)*.10;
      vec4 mv=modelViewMatrix*vec4(p,1.0);waterDistance=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec2 waterUV; varying float waterDistance; uniform float time; uniform float fallHeight;
      void main(){vec2 u=waterUV;float threads=sin(u.x*76.0+sin(u.y*19.0-time*3.0)*1.5)*.5+.5;
      float edge=smoothstep(0.0,.22,u.x)*smoothstep(1.0,.78,u.x);
      float foam=.55+.45*sin(u.y*fallHeight*3.0+time*8.0);
      float alpha=edge*(.36+threads*.32+foam*.12)*smoothstep(0.0,.30,u.y);
      vec3 color=mix(vec3(.54,.77,.80),vec3(1.18,1.22,1.10),threads*.65+foam*.2);
      color=mix(color,vec3(.68,.78,.77),smoothstep(90.0,300.0,waterDistance));
      gl_FragColor=vec4(color,alpha);}`,
  });
  const root = new THREE.Group();
  for (const turn of [0, Math.PI / 2]) {
    const curtain = new THREE.Mesh(geometry, material);
    curtain.position.y = -height / 2;
    curtain.rotation.y = turn;
    root.add(curtain);
  }
  return root;
}
