import { THREE } from './studio.js';
// A folded, curved lanceolate surface. The midrib is a geometric fold, not a texture.
export function leafGeometry() {
  const vertices=[], colors=[], color=new THREE.Color();
  const point=(t,side) => [1.45*t, .27*Math.sin(t*Math.PI)-.14*t*t + (side===0?.035:0), side*.34*Math.sin(Math.PI*t)**.8];
  for(let i=0;i<10;i++) for(const side of [-1,1]) {
    const a=point(i/10,0), b=point(i/10,side), c=point((i+1)/10,side), d=point((i+1)/10,0);
    for(const p of [a,b,c,a,c,d]) { vertices.push(...p); color.set(side<0?'#4f823b':'#699c48'); colors.push(color.r,color.g,color.b); }
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
