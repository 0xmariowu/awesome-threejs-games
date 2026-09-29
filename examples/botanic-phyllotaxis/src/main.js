import { tr } from './i18n.js';
import { THREE, studio, material, release } from './studio.js';
import { arrangement, packingDistance } from './model.mjs';
import { leafGeometry } from './geometry.js';
document.querySelector('.demo-performance h3').textContent=tr({en:'Seed packing',zh:'种子排列'});
const $=id=>document.getElementById(id), world=$('world');
const {scene,renderer,camera,target,orbit,view}=studio(world);
const specimen=new THREE.Group();scene.add(specimen);
const params={type:'spiral',count:34,angle:137.5,spacing:.15,taper:.65,seed:42};
let version=0, points=[], packing=0;
const dummy=new THREE.Object3D(), color=new THREE.Color();
function mesh(g,m,x=0,y=0,z=0) {const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;specimen.add(o);return o;}
function rebuild() {
  release(specimen);points=arrangement(params);const head=params.type==='sunflower';
  const height=head?1:points.at(-1).y, radius=head?.105*Math.sqrt(params.count):1.65;
  mesh(new THREE.CylinderGeometry(radius*1.13,radius*1.14,.16,80),material('#b8bea7'),0,-.11,0);
  mesh(new THREE.CylinderGeometry(radius*1.09,radius*1.09,.035,80),material('#d0d2bb'),0,-.015,0);
  if(head) {
    mesh(new THREE.CylinderGeometry(radius*1.015,radius*.96,.16,80),material('#6d7040'),0,.55,0);
    const seeds=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),material('#b99b48'),points.length);
    points.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,-p.theta,0);dummy.scale.set(.040*(1-params.taper*.25*i/points.length),.040,.068);dummy.updateMatrix();seeds.setMatrixAt(i,dummy.matrix);color.setHSL(.095+.026*p.tone,.53,.30+.16*p.tone);seeds.setColorAt(i,color);});
    seeds.castShadow=true;seeds.receiveShadow=true;specimen.add(seeds);
    const petal=new THREE.InstancedMesh(leafGeometry(),new THREE.MeshStandardMaterial({color:'#efbf40',roughness:.7,side:THREE.DoubleSide}),34);
    for(let i=0;i<34;i++){const a=i*Math.PI*2/34;dummy.position.set(Math.cos(a)*radius*.91,.55,Math.sin(a)*radius*.91);dummy.rotation.set(0,-a,-.06);dummy.scale.set(.45,.8,.60);dummy.updateMatrix();petal.setMatrixAt(i,dummy.matrix);}petal.castShadow=true;specimen.add(petal);
    packing=packingDistance(points);
  } else {
    mesh(new THREE.CylinderGeometry(.024,.05,height+.12,10),material('#648346'),0,height/2,0);
    const leaves=new THREE.InstancedMesh(leafGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74,side:THREE.DoubleSide}),points.length);
    points.forEach((p,i)=>{dummy.position.set(0,p.y,0);dummy.rotation.set(0,-p.theta,.18);dummy.scale.setScalar(p.size);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);color.setHSL(.23,.12,.75+p.tone*.14);leaves.setColorAt(i,color);});
    leaves.castShadow=true;leaves.receiveShadow=true;specimen.add(leaves);
    // A tiny terminal bud makes the growth direction visible.
    mesh(new THREE.SphereGeometry(.085,12,8),material('#a4b765'),0,height+.1,0).scale.set(.6,1.6,.6);
    packing=0;
  }
  target.set(0,head?.5:height*.47,0);orbit.distance=head?radius*5+3:Math.max(9,height*2.8+2);
  const fixed={alternate:180,opposite:180,decussate:90,whorled:120};
  $('angle').disabled=!!fixed[params.type];$('spacing').disabled=head;
  $('angle-value').value=`${(fixed[params.type]??params.angle).toFixed(1)}°`;
  $('hero-angle').textContent=$('angle-value').value;
  $('organ-total').textContent=params.count;
  $('specimen-name').textContent=$('type').selectedOptions[0].textContent;
  $('caption').textContent=head?tr({en:'Vogel head · r = c√n',zh:'向日葵花盘 · r = c√n'}):tr({en:'Leaves along a single stem',zh:'沿着一根茎排列的叶片'});
  $('packing').textContent=head?`${tr({en:'Mean seed spacing',zh:'平均种子间距'})} ${packing.toFixed(3)}`:tr({en:'Switch to sunflower to compare packing.',zh:'切换向日葵，比较种子的排列。'});
  for(const id of ['count','spacing','taper','seed'])$(id+'-value').value=params[id];
  for(const button of document.querySelectorAll('[data-angle]')) {button.disabled=!!fixed[params.type];button.setAttribute('aria-pressed',String(Number(button.dataset.angle)===params.angle&&!fixed[params.type]));}
  version++;
}
for(const id of ['angle','count','spacing','taper','seed'])$(id).addEventListener('input',e=>{params[id]=Number(e.target.value);rebuild();});
$('type').addEventListener('change',e=>{params.type=e.target.value;const head=params.type==='sunflower';$('count').max=head?900:100;params.count=head?610:34;$('count').value=params.count;rebuild();});
$('top').addEventListener('change',e=>orbit.top=e.target.checked);
for(const button of document.querySelectorAll('[data-angle]'))button.addEventListener('click',()=>{params.angle=Number(button.dataset.angle);$('angle').value=params.angle;rebuild();});
rebuild();
function frame(){view();renderer.render(scene,camera);window.__example={ready:true,version,params:{...params},points,packing,top:orbit.top,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries};requestAnimationFrame(frame);}frame();
