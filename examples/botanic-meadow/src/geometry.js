import { THREE } from './studio.js';
// All plant meshes are assembled here from mathematical surfaces and primitives.
export function speciesGeometry(species) {
  const positions=[], colors=[], matrix=new THREE.Matrix4(), q=new THREE.Quaternion();
  function add(g, position, scale, color, rotation=[0,0,0]) {
    q.setFromEuler(new THREE.Euler(...rotation)); matrix.compose(new THREE.Vector3(...position),q,new THREE.Vector3(...scale));
    const copy=(g.index?g.toNonIndexed():g.clone()).applyMatrix4(matrix), p=copy.getAttribute('position'), c=new THREE.Color(color);
    for(let i=0;i<p.count;i++) { positions.push(p.getX(i),p.getY(i),p.getZ(i)); colors.push(c.r,c.g,c.b); }
    copy.dispose();g.dispose();
  }
  function stem(x,z,height) {add(new THREE.CylinderGeometry(.009,.015,height,5),[x,height/2,z],[1,1,1],'#567d35');}
  function blade(angle,length,width,spread,color) {
    const p=[];
    const v=(t,side) => {const r=spread*t*t; return [Math.cos(angle)*r-Math.sin(angle)*side*width*Math.sin(Math.PI*t), length*t-.14*t*t, Math.sin(angle)*r+Math.cos(angle)*side*width*Math.sin(Math.PI*t)];};
    for(let i=0;i<7;i++) {const t=i/7,u=(i+1)/7;for(const s of [-1,1])for(const a of [v(t,0),v(t,s),v(u,s),v(t,0),v(u,s),v(u,0)])p.push(...a);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));add(g,[0,0,0],[1,1,1],color);
  }
  if(species==='grass') {
    for(let i=0;i<8;i++) blade(i*2.399,.45+(i%3)*.17,.017,.18+(i%2)*.12,i%2?'#8c9f4c':'#5f813a');
  } else if(species==='broadleaf') {
    for(let i=0;i<7;i++) blade(i*2.399,.28+(i%3)*.10,.085,.29,i%2?'#6b9244':'#477445');
  } else if(species==='clover') {
    for(let j=0;j<3;j++) {
      const x=Math.cos(j*2.1)*.08,z=Math.sin(j*2.1)*.08,h=.22+j*.055; stem(x,z,h);
      for(let k=0;k<3;k++) {const a=k*Math.PI*2/3+j;add(new THREE.SphereGeometry(1,7,4),[x+Math.cos(a)*.075,h,z+Math.sin(a)*.075],[.10,.019,.065],k%2?'#649457':'#3f7546',[0,-a,0]);}
    }
  } else if(species==='flowers') {
    for(let j=0;j<2;j++) {
      const x=j*.14-.07,z=j*.10-.05,h=.45+j*.23;stem(x,z,h);
      for(let k=0;k<7;k++) {const a=k*Math.PI*2/7;add(new THREE.SphereGeometry(1,6,4),[x+Math.cos(a)*.085,h,z+Math.sin(a)*.085],[.105,.018,.041],j?'#e7d7eb':'#fff6d7',[0,-a,0]);}
      add(new THREE.SphereGeometry(1,8,5),[x,h+.024,z],[.048,.03,.048],'#d4a137');
      blade(j*2.5,.32,.037,.11,'#719148');
    }
  } else {
    add(new THREE.IcosahedronGeometry(1,1),[0,.048,0],[.12,.075,.085],'#9c9989',[.1,.4,.2]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
export function windMaterial(uniforms, depth=false) {
  const m=depth?new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,side:THREE.DoubleSide});
  m.onBeforeCompile=shader => {
    shader.uniforms.windTime=uniforms.time;shader.uniforms.windStrength=uniforms.strength;
    shader.vertexShader='uniform float windTime; uniform float windStrength;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 root = instanceMatrix[3].xz;
      float phase = dot(root, vec2(0.73, 0.51));
      float bend = sin(windTime * 1.35 + phase) + 0.35 * sin(windTime * 2.1 - phase * 1.7);
      float weight = max(position.y, 0.0);
      transformed.x += bend * weight * weight * windStrength * 0.24;
      transformed.z += cos(windTime + phase) * weight * weight * windStrength * 0.10;
    `);
  };
  m.customProgramCacheKey=()=>depth?'meadow-wind-depth-v1':'meadow-wind-v1';return m;
}
