import './i18n.js';
import { THREE,studio,material,release } from './studio.js';
import { scatter,SPECIES,noise } from './model.mjs';
import { speciesGeometry,windMaterial } from './geometry.js';
const $=id=>document.getElementById(id);
const {scene,renderer,camera,target,orbit,view}=studio($('world'));
const patch=new THREE.Group();scene.add(patch);
const params={size:8,density:24,clumping:.65,gaps:.3,mix:[65,35,20,40,12],seed:42,wind:.65};
const uniforms={time:{value:0},strength:{value:params.wind}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let points=[],version=0,counts=[],quadrants=[],distance=0;
const dummy=new THREE.Object3D(),color=new THREE.Color();
function rebuild(){
  release(patch);({points,distance}=scatter(params));counts=SPECIES.map((_,i)=>points.filter(p=>p.species===i).length);
  quadrants=Array(4).fill(0);for(const p of points)if(p.species!==4)quadrants[Number(p.x>=0)+2*Number(p.z>=0)]++;
  const soil=new THREE.Mesh(new THREE.BoxGeometry(params.size+.12,.26,params.size+.12),material('#7e7860'));soil.position.y=-.14;soil.receiveShadow=true;soil.castShadow=true;patch.add(soil);
  const ground=new THREE.PlaneGeometry(params.size,params.size,40,40);ground.rotateX(-Math.PI/2);
  const colors=[],position=ground.getAttribute('position');
  for(let i=0;i<position.count;i++){const h=noise(position.getX(i)*.6+17,position.getZ(i)*.6+31,params.seed);color.setHSL(.18+h*.045,.20+h*.08,.29+h*.12);colors.push(color.r,color.g,color.b);}
  ground.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const turf=new THREE.Mesh(ground,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));turf.receiveShadow=true;patch.add(turf);
  SPECIES.forEach((name,index)=>{
    if(!counts[index])return;
    const m=index===4?new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}):windMaterial(uniforms);
    const batch=new THREE.InstancedMesh(speciesGeometry(name),m,counts[index]);
    if(index!==4)batch.customDepthMaterial=windMaterial(uniforms,true);
    let i=0;
    for(const p of points.filter(p=>p.species===index)){
      dummy.position.set(p.x,.012,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);
      color.setHSL(.15+p.tone*.08,.09,.76+p.tone*.19);batch.setColorAt(i,color);i++;
    }
    batch.castShadow=true;batch.receiveShadow=true;batch.frustumCulled=false;patch.add(batch);
  });
  target.set(0,.1,0);orbit.distance=params.size*2.2+1;orbit.pitch=.57;
  $('seed-value').textContent=params.seed;
  for(const id of ['size','density','clumping','gaps','wind'])$(id+'-value').value=params[id];
  SPECIES.forEach((id,i)=>$(id+'-value').value=params.mix[i]);
  $('empty').hidden=points.length>0;version++;
}
for(const id of ['size','density','clumping','gaps'])$(id).addEventListener('input',e=>{params[id]=Number(e.target.value);rebuild();});
SPECIES.forEach((id,i)=>$(id).addEventListener('input',e=>{params.mix[i]=Number(e.target.value);rebuild();}));
$('wind').addEventListener('input',e=>{params.wind=Number(e.target.value);uniforms.strength.value=params.wind;$('wind-value').value=params.wind;});
$('new-seed').addEventListener('click',()=>{params.seed=(params.seed+7919)%1000000;rebuild();});
rebuild();let previous=performance.now(),elapsed=0;
function frame(now){const delta=Math.min((now-previous)/1000,.05);previous=now;if(!reduced.matches)elapsed+=delta;uniforms.time.value=elapsed;view();renderer.render(scene,camera);
  const plants=points.length-(counts[4]||0),triangles=renderer.info.render.triangles,drawCalls=renderer.info.render.calls;
  $('plant-count').textContent=plants.toLocaleString();$('triangles').textContent=triangles.toLocaleString();$('draw-calls').textContent=drawCalls;$('stone-count').textContent=counts[4]||0;
  $('field-label').textContent=`${params.size} × ${params.size} m`;
  window.__example={ready:true,version,params:{...params,mix:[...params.mix]},counts,quadrants,plants,total:points.length,distance,triangles,drawCalls,time:elapsed,wind:uniforms.strength.value,geometries:renderer.info.memory.geometries};requestAnimationFrame(frame);
}requestAnimationFrame(frame);
