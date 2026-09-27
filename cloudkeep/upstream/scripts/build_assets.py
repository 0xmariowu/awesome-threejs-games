"""Author Cloudkeep's detailed, editable Blender asset library."""
import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from sky_creatures import build_sky_creatures
from modeling import TAU, linear, mix, material, mesh, sphere, tube, ring, box, parent, batch
OUT=ROOT/'public'/'assets'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(21)
M={
 'skin':material('Porcelain skin',roughness=.36), 'fin':material('Silken fins',roughness=.43),
 'canvas':material('Woven canvas',roughness=.72), 'wood':material('Oiled cedar',roughness=.43),
 'paint':material('Enamel',roughness=.28), 'brass':material('Brushed brass','#d4a85f',.26,.72),
 'rope':material('Hemp rigging','#b99766',.8), 'eye':material('Deep ink','#142d38',.12),
 'glass':material('Cabin glass','#7dbfc9',.1,.3), 'glow':material('Amber lantern','#ffe2a0',.2,.15,2.4),
 'stone':material('Warm limestone',roughness=.86), 'foliage':material('Garden foliage',roughness=.8),
 'petal':material('Flower petals',roughness=.61)
}
collections={}
def begin(name):
 print('AUTHORING',name,flush=True)
 c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
 bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[c.name]
 collections[name]=c

def eye(x,y,z,size):
 before=set(bpy.context.collection.objects)
 side=1 if x>0 else -1
 sphere('Eye cushion',(x,y,z),(size*1.18,size*.86,size*1.16),M['skin'],'#edf4de')
 p=(x+side*size*.34,y+size*.72,z+size*.1)
 sphere('Lagoon iris',p,(size*.90,size*.48,size*.94),M['paint'],'#497d7d')
 sphere('Wide pupil',(p[0]+side*size*.1,p[1]+size*.26,p[2]),(size*.60,size*.25,size*.67),M['eye'])
 sphere('Eye catchlight',(p[0]-size*.2,p[1]+size*.48,p[2]+size*.32),(size*.19,size*.07,size*.2),M['glow'],segments=12,rings=8)
 sphere('Small catchlight',(p[0]+size*.26,p[1]+size*.46,p[2]-size*.25),(size*.07,size*.05,size*.07),M['skin'],'#ffffff',10,6)
 parent('eye_left' if side<0 else 'eye_right',[o for o in bpy.context.collection.objects if o not in before],(x,y,z))

def airship():
 begin('airship')
 v,f,c=[],[],[]; n,nr=96,48
 for j in range(nr+1):
  t=math.pi*j/nr; y=-4.5*math.cos(t); r=max(.006,math.sin(t))
  for i in range(n):
   a=TAU*i/n; bulge=1+.009*math.sin(a*12)**2
   v.append((2.04*r*math.cos(a)*bulge,y,3+1.96*r*math.sin(a)*bulge))
   base=linear('#fff0c9' if (i//8)%3==1 else '#e9aa43'); edge=.91+.09*math.sin(math.pi*(i%8)/8)
   c.append(tuple(k*edge for k in base))
 for j in range(nr):
  for i in range(n):
   a,b=j*n+i,j*n+(i+1)%n; f.append((a,a+n,b+n,b))
 mesh('Twelve sewn balloon panels',v,f,M['canvas'],c)
 for i in range(12):
  a=TAU*i/12
  tube('Canvas piping',[(2.057*math.sin(math.pi*j/48)*math.cos(a),-4.505*math.cos(math.pi*j/48),3+1.977*math.sin(math.pi*j/48)*math.sin(a)) for j in range(49)],.020,M['rope'],sides=6)
  for j in range(5,44,3):
   t=math.pi*j/48
   tube('Hand sewn stitch',[(2.065*math.sin(t)*math.cos(a+d),-4.51*math.cos(t),3+1.985*math.sin(t)*math.sin(a+d)) for d in (-.012,.012)],.007,M['canvas'],'#fff2d6',5)
 for y in (-1.65,1.65):
  r=math.sqrt(1-(y/4.5)**2)
  tube('Load strap',[(2.07*r*math.cos(TAU*i/72),y,3+1.99*r*math.sin(TAU*i/72)) for i in range(73)],.045,M['rope'])
  for side in (-1,1): box('Strap buckle',(side*1.89,y,2.45),(.13,.25,.30),M['brass'])
 for k in range(7):
  z=-1.28+k*.14; rx=.50+.062*k; ry=1.60+.094*k; v,f=[],[]
  for dz,dr in [(0,-.012),(.025,.013),(.13,.013),(.15,-.006)]:
   for i in range(64):
    a=TAU*i/64; v.append(((rx+dr)*math.cos(a),(ry+dr)*math.sin(a),z+dz))
  for j in range(3):
   for i in range(64):
    a,b=j*64+i,j*64+(i+1)%64; f.append((a,b,b+64,a+64))
  mesh('Rounded cedar strake',v,f,M['wood'],[linear(['#925b30','#a26c39','#b17a43','#aa713b'][k%4])]*len(v))
 for i in range(9):
  x=(i-4)*.194; length=math.sqrt(max(.1,1-(x/.98)**2))*4.26
  box('Deck board',(x,0,-.39),(.185,length,.10),M['wood'],'#b88951',.017)
 for z in (-.22,.17): tube('Teal handrail',[(math.cos(TAU*i/64),2.22*math.sin(TAU*i/64),z) for i in range(65)],.055,M['paint'],'#386d6b')
 for i in range(16):
  a=TAU*i/16; x,y=math.cos(a),2.22*math.sin(a)
  tube('Rail upright',[(x,y,-.24),(x,y,.17)],.022,M['brass'])
  sphere('Timber rivet',(x*.86,y*.87,-.67),(.025,.025,.025),M['brass'],segments=8,rings=6)
 for side in (-1,1):
  for y in (-1.6,1.6):
   tube('Load bearing ropes',[(side*.9,y,-.2),(side*1.15,y,.65),(side*1.74,y,2)],.038,M['rope'])
   ring('Rigging eyelet',(side*.95,y,-.13),.10,.018,M['brass'],'XZ',20)
 box('Painted cabin',(0,.7,.07),(1.12,1.22,.89),M['paint'],'#2c6468',.15)
 box('Cabin cap',(0,.7,.59),(1.25,1.32,.17),M['wood'],'#b78245',.09)
 for side in (-1,1):
  ring('Porthole rim',(side*.578,.62,.20),.25,.041,M['brass'],'YZ')
  sphere('Round window',(side*.575,.62,.20),(.025,.22,.22),M['glass'])
  for j in range(8):
   a=TAU*j/8; sphere('Porthole rivet',(side*.614,.62+.25*math.cos(a),.20+.25*math.sin(a)),(.016,.016,.016),M['brass'],segments=8,rings=5)
 for x in (-.50,.45):
  sphere('Seed sack',(x,1.67,-.02),(.25,.32,.37),M['canvas'],'#d9c795'); ring('Sack tie',(x,1.67,.22),.13,.02,M['rope'])
 sphere('Pilot coat',(0,-.65,.07),(.30,.26,.43),M['paint'],'#277a78')
 sphere('Pilot head',(0,-.63,.62),(.225,.21,.255),M['skin'],'#dbaa7d')
 sphere('Sun hat brim',(0,-.63,.82),(.42,.37,.045),M['canvas'],'#ecd49a')
 sphere('Sun hat crown',(0,-.63,.93),(.245,.23,.15),M['canvas'],'#d7b26b')
 tube('Hat ribbon',[(.25*math.cos(TAU*i/32),-.63+.23*math.sin(TAU*i/32),.87) for i in range(33)],.024,M['paint'],'#2b6667')
 for side in (-1,1):
  tube('Pilot sleeve',[(side*.20,-.58,.30),(side*.33,-.25,.24)],.10,M['paint'],'#348785')
  sphere('Pilot glove',(side*.32,-.20,.22),(.10,.12,.10),M['skin'],'#deb887',12,8)
 ring('Steering wheel',(0,-.13,.27),.29,.027,M['wood'],'XZ',color='#9b6233')
 tube('Wheel stand',[(0,-.1,-.3),(0,-.13,.27)],.045,M['brass'])
 for side in (-1,1):
  x,y,z=side*1.57,-.55,-.38
  tube('Engine strut',[(side*.83,y,-.4),(x,y,z)],.09,M['brass'])
  sphere('Engine nacelle',(x,y,z),(.32,.61,.32),M['paint'],'#2a6767')
  ring('Radial engine band',(x,y-.36,z),.33,.06,M['brass'],'XZ')
  for j in range(8):
   a=TAU*j/8; tube('Cooling fin',[(x+.27*math.cos(a),y-.30,z+.27*math.sin(a)),(x+.27*math.cos(a),y+.18,z+.27*math.sin(a))],.025,M['brass'])
  parts=[sphere('Propeller spinner',(x,y-.79,z),(.17,.15,.17),M['brass'])]
  for j in range(3):
   a=TAU*j/3; v,f=[],[]
   for k in range(13):
    t=k/12; r=.14+t*.89; w=.12*math.sin(math.pi*t)+.028; angle=a+.25*t
    for edge in (-1,1): v.append((x+r*math.cos(angle)+edge*w*math.sin(angle),y-.72+edge*.055,z+r*math.sin(angle)-edge*w*math.cos(angle)))
   for k in range(12): f.append((k*2,k*2+1,k*2+3,k*2+2))
   parts.append(mesh('Swept walnut blade',v,f,M['wood'],[linear('#b48249')]*len(v)))
  parent('rotor_left' if side<0 else 'rotor_right',parts,(x,y-.72,z))
 for side in (-1,1):
  v,f=[],[]
  for j in range(13):
   t=j/12
   for i in range(9):
    u=i/8; v.append((side*(.20+t*1.48),-3.22-1.52*t-u*(.65+.28*math.sin(t*math.pi)),3+.26*math.sin(t*math.pi)+.08*math.sin(u*math.pi)))
  for j in range(12):
   for i in range(8):
    a=j*9+i; f.append((a,a+1,a+10,a+9))
  mesh('Canvas tail vane',v,f,M['canvas'],[linear('#f3dfab')]*len(v))
  for j in (0,4,8,12): tube('Tail vane ribs',[v[j*9+i] for i in range(9)],.018,M['brass'],sides=6)
 mesh('Upright rudder',[(0,-3.5,3),(0,-4.25,4.72),(0,-5.08,4.50),(0,-4.70,2.9)],[(0,1,2,3)],M['paint'],[linear('#346f72')]*4)
 tube('Rudder edge',[(0,-3.5,3),(0,-4.25,4.72),(0,-5.08,4.50),(0,-4.70,2.9)],.03,M['brass'])
 for side in (-1,1):
  x=side*1.10
  tube('Lantern arm',[(side*.94,.9,.15),(x,.9,.10),(x,.9,-.1)],.024,M['brass'])
  sphere('Lantern glass',(x,.9,-.34),(.12,.12,.21),M['glow'],segments=16,rings=10)
  for z in (-.53,-.16): ring('Lantern ferrule',(x,.9,z),.13,.025,M['brass'],segments=20)
  for j in range(4):
   a=TAU*j/4; tube('Lantern cage',[(x+.125*math.cos(a),.9+.125*math.sin(a),-.53),(x+.125*math.cos(a),.9+.125*math.sin(a),-.16)],.012,M['brass'],sides=5)

def ray_wing(side):
 objects,v,f,c=[],[],[],[]; nx,ny=72,48
 rng=random.Random(81+side)
 spots=[(rng.uniform(.08,.64),rng.uniform(.16,.88),rng.uniform(.035,.065),rng.uniform(.045,.09)) for _ in range(14)]
 def point(t,u,bottom=False):
  chord=2.20*max(0,1-t**1.5)**.70+.012
  center=-.10-.76*t**1.35
  front=center+chord*.51; back=center-chord*.49
  z=.02+.22*math.sin(t*math.pi*.95)+.62*t**3+.11*math.sin(u*math.pi)*(1-t)
  if bottom: z-=.07*(1-t)*math.sin(math.pi*u)+.015
  return side*(.52+t*3.18),back+(front-back)*u,z
 for bottom in (False,True):
  for j in range(nx+1):
   t=j/nx
   for i in range(ny+1):
    u=i/ny; v.append(point(t,u,bottom))
    coral=max(0,1-t*1.8)*.68+max(0,abs(u-.5)*2-.85)*2.8
    base=mix(linear('#fff0cf'),linear('#e69878'),min(.86,coral))
    if not bottom:
     for st,su,rt,ru in spots:
      distance=((t-st)/rt)**2+((u-su)/ru)**2
      if distance<1: base=mix(base,linear('#c78864'),min(.8,(1-distance)*3))
    c.append(mix(base,linear('#ffe8c0'),.42) if bottom else base)
 count=(nx+1)*(ny+1)
 for k in range(2):
  for j in range(nx):
   for i in range(ny):
    a=k*count+j*(ny+1)+i; face=(a,a+ny+1,a+ny+2,a+1); f.append(tuple(reversed(face)) if bool(k) != (side<0) else face)
 objects.append(mesh('Curved silk wing',v,f,M['fin'],c))
 for i in range(1,10):
  points=[point(.06+j/18*.94,i/10) for j in range(19)]
  objects.append(tube('Delicate wing rays',[(x,y,z+.012) for x,y,z in points],.0045,M['fin'],'#f0cda8',5))
 parent('wing_left' if side<0 else 'wing_right',objects,(side*.52,0,0))

def ray():
 begin('ray')
 sphere('Continuous ray body',(0,.06,.03),(.77,1.34,.39),M['skin'],segments=40,rings=24,tint=lambda u,p:mix(linear('#ffeecb'),linear('#e2a076'),max(0,u[2])**1.2*.9))
 for side in (-1,1):
  ray_wing(side); eye(side*.53,.91,.24,.16)
  sphere('Soft cheek',(side*.57,1.02,.06),(.10,.08,.045),M['skin'],'#e6ad86',14,8)
  tube('Curled cephalic lobe',[(side*.32,1.1,.01),(side*.32,1.39,-.03),(side*.43,1.48,.035),(side*.47,1.38,.13)],[.09,.07,.044,.018],M['skin'],'#ffedc9',10)
 tube('Ray smile',[(x*.28,1.365-.08*x*x,-.045-.06*(1-x*x)) for x in [i/8 for i in range(-8,9)]],.019,M['skin'],'#a77452')
 tube('Ribbon tail',[(0,-1.05,.02),(0,-1.7,.03),(.10,-2.4,.19),(.34,-3.2,.44),(.22,-3.8,.58)],[.11,.085,.050,.024,.006],M['fin'],'#dda776',10)

def whale():
 begin('whale'); v,f,c=[],[],[]; n,nr=64,64
 for j in range(nr+1):
  t=j/nr; y=-3.23+5.7*t
  radius=1.15*math.sin(math.pi*t/.7/2)**1.4 if t<.7 else 1.15*math.sqrt(max(0,1-((t-.7)/.3)**2))
  for i in range(n):
   a=TAU*i/n; x=radius*math.cos(a); z=radius*.79*math.sin(a)+.08*math.sin(t*math.pi); v.append((x,y,z))
   belly=max(0,min(1,(-math.sin(a)-.05)*3.3))
   top=mix(linear('#509aae'),linear('#91c8d4'),.25+.25*math.sin(a))
   pattern=math.sin(x*4+y*3)*math.sin(y*5-z*6); fleck=max(0,pattern-.50)*.75*max(0,math.sin(a))
   c.append(mix(mix(top,linear('#d1e6df'),fleck),linear('#fff0cf'),belly*.98))
 for j in range(nr):
  for i in range(n):
   a,b=j*n+i,j*n+(i+1)%n; f.append((a,a+n,b+n,b))
 mesh('Sculpted whale body',v,f,M['skin'],c)
 for side in (-1,1):
  eye(side*.92,1.40,.18,.205)
  v,f,c=[],[],[]
  for layer in (1,-1):
   for j in range(25):
    t=j/24
    for i in range(13):
     u=(i/12-.5)*2; width=.46*max(0,1-t*t)**.65+.005
     v.append((side*(.85+math.sin(t*math.pi/2)*1.58),-.10-.70*t**1.4+u*width,-.31-.28*math.sin(t*1.9)+layer*.065*math.sin(math.pi*i/12)*(1-t)))
     c.append(linear('#86c3ce' if layer==1 else '#dceae0'))
  for k in range(2):
   for j in range(24):
    for i in range(12):
     a=k*325+j*13+i; face=(a,a+13,a+14,a+1); f.append(tuple(reversed(face)) if bool(k)!=(side<0) else face)
  fin=mesh('Sculpted whale flipper',v,f,M['fin'],c); parent('wing_left' if side<0 else 'wing_right',[fin],(side*.8,-.1,-.31))
 smile=[]
 for i in range(-16,17):
  x=i/16*.83; z=-.29+.15*(x/.83)**2
  y=.76+1.71*math.sqrt(max(0,1-(x/1.15)**2-((z-.04)/(.79*1.15))**2))+.018
  smile.append((x,y,z))
 tube('Gentle whale smile',smile,.014,M['skin'],'#4b8790',8)
 for i in range(-3,4):
  x=i*.125; tube('Throat pleat',[(x,2.04-j*.14,-.37-.32*math.sin(j/13*math.pi*.8)) for j in range(14)],.009,M['skin'],'#c5d9ca',5)
 tail=[]
 for side in (-1,1):
  v,f,c=[],[],[]
  for j in range(25):
   t=j/24
   for i in range(13):
    u=i/12; chord=.26*(1-t)+.72*math.sin(t*math.pi)**.9+.015
    v.append((side*(.04+t*1.49),-2.88-.60*math.sin(t*math.pi*.9)+(u-.5)*chord,.04+.28*t*t+.08*math.sin(u*math.pi)))
    c.append(mix(linear('#6baaba'),linear('#bcddd8'),u*.6))
  for j in range(24):
   for i in range(12):
    a=j*13+i; face=(a,a+13,a+14,a+1); f.append(face if side>0 else tuple(reversed(face)))
  tail.append(mesh('Swept whale fluke',v,f,M['fin'],c))
 parent('tail',tail,(0,-2.7,0))
 sphere('Blowhole',(0,1,.945),(.12,.19,.018),M['skin'],'#4c8997',16,8)

def bird():
 begin('bird')
 sphere('Lantern bird body',(0,-.03,.05),(.39,.68,.43),M['skin'],segments=32,rings=20,tint=lambda u,p:mix(linear('#fff1cd'),linear('#d9a958'),max(0,-u[1])*.82))
 sphere('Round bird head',(0,.50,.35),(.33,.37,.31),M['skin'],'#ffefc9')
 for side in (-1,1):
  eye(side*.24,.69,.40,.093); parts=[]
  for j in range(8):
   t=j/7; parts.append(sphere('Overlapping flight feather',(side*(.47+t*1.35),-.1-t*.56,.10+.26*t),(.23,.58-.14*t,.055),M['fin'],['#efc770','#f3d591','#fae5ba'][j%3],18,10))
  parent('wing_left' if side<0 else 'wing_right',parts,(side*.35,-.1,.1))
 tube('Tiny beak',[(0,.81,.32),(0,1.08,.29)],[.105,.006],M['skin'],'#bb8545',10)
 tube('Long tail filament',[(0,-.61,-.02),(.06,-1.1,-.28),(-.1,-1.7,-.48)],[.05,.03,.01],M['fin'],'#c39552')
 sphere('Tail lantern pearl',(-.1,-1.7,-.48),(.11,.12,.16),M['glow'],segments=18,rings=12)

def leaves(v,f,c,center,scale,color,rng,count=28):
 base=linear(color)
 for _ in range(count):
  az,h=rng.random()*TAU,rng.uniform(-1,1); r=math.sqrt(1-h*h)
  p=(center[0]+math.cos(az)*r*scale[0],center[1]+math.sin(az)*r*scale[1],center[2]+h*scale[2])
  yaw=rng.random()*TAU; length,width=rng.uniform(.12,.25),rng.uniform(.055,.11); tint=mix(base,linear('#b1bd68'),rng.uniform(0,.26)); off=len(v)
  for u,w,z in [(-1,0,0),(-.3,.8,.015),(.6,.65,.035),(1,0,0),(.6,-.65,.035),(-.3,-.8,.015),(0,0,.055)]:
   v.append((p[0]+u*length*math.cos(yaw)-w*width*math.sin(yaw),p[1]+u*length*math.sin(yaw)+w*width*math.cos(yaw),p[2]+z)); c.append(tint)
  for k in range(6): f.append((off+k,off+(k+1)%6,off+6))

def canopy(center,scale,rng):
 v,f,c=[],[],[]; segments,rings=24,16; phase=rng.random()*TAU
 for j in range(rings+1):
  t=math.pi*j/rings
  for i in range(segments):
   a=TAU*i/segments; u=(math.sin(t)*math.cos(a),math.sin(t)*math.sin(a),math.cos(t))
   lobes=1+.13*math.sin(a*5+phase)*math.sin(t)**2+.11*math.sin(t*7+a*3)+rng.uniform(-.065,.065)
   v.append(tuple(center[k]+u[k]*scale[k]*lobes for k in range(3)))
   sunlight=.16+max(0,u[2])*.48+rng.random()*.17
   c.append(mix(linear('#3c6941'),linear('#a6b45d'),sunlight))
 for j in range(rings):
  for i in range(segments):
   a,b=j*segments+i,j*segments+(i+1)%segments
   f.append((a,a+segments,b+segments,b))
 mesh('Lobed olive canopy',v,f,M['foliage'],c)

def tree(x,y,z,size,rng):
 tube('Twisting olive trunk',[(x,y,z),(x+.15*size,y+.12*size,z+1.2*size),(x-.03*size,y+.05*size,z+2.3*size),(x+.27*size,y,z+3*size)],[.23*size,.17*size,.11*size,.028*size],M['wood'],'#807254',9)
 v,f,c=[],[],[]
 for j in range(13):
  a=j*2.399; r=rng.uniform(.25,1.38)*size; cx,cy,cz=x+math.cos(a)*r,y+math.sin(a)*r,z+rng.uniform(2.55,3.48)*size
  tube('Branch fork',[(x+.1*size,y,z+1.65*size),(x+math.cos(a)*r*.6,y+math.sin(a)*r*.6,cz-.3*size),(cx,cy,cz)],[.085*size,.048*size,.011*size],M['wood'],'#817357',7)
  canopy((cx,cy,cz),(.72*size,.63*size,.52*size),rng)
  leaves(v,f,c,(cx,cy,cz),(.72*size,.64*size,.53*size),'#779353',rng,int(28*size))
 mesh('Olive leaf sprays',v,f,M['foliage'],c)
 for i in range(5):
  a=i*TAU/5; tube('Exposed root',[(x,y,z+.25),(x+.35*size*math.cos(a),y+.35*size*math.sin(a),z+.05),(x+.65*size*math.cos(a),y+.65*size*math.sin(a),z)],[.1*size,.06*size,.01],M['wood'],'#837456',7)

def cypress(x,y,z,size):
 tube('Cypress stem',[(x,y,z),(x,y,z+size*3.1)],[.085*size,.012],M['wood'],'#857257',7)
 for j in range(8):
  t=j/7; r=(.48*math.sin(math.pi*(t*.83+.13))+.04)*size
  sphere('Layered cypress bough',(x+.09*size*math.sin(j),y,z+(.48+t*2.8)*size),(r,r*.88,.40*size),M['foliage'],['#476f52','#5d8155','#78945a'][j%3],12,8)

def flowers(rng,radius,count):
 v,f,c=[],[],[]
 for _ in range(count):
  a,r=rng.random()*TAU,math.sqrt(rng.random())*radius; x,y=math.cos(a)*r,math.sin(a)*r
  if abs(x)<.45 and y>0: continue
  h=rng.uniform(.14,.38); off=len(v)
  for dx,dy,z in [(-.02,0,.18),(.02,0,.18),(.008,.02,.18+h),(-.008,.02,.18+h)]: v.append((x+dx,y+dy,z)); c.append(linear('#6a8f50'))
  f.append(tuple(off+i for i in range(4))); color=linear(rng.choice(['#fff0bc','#fff9dc','#edb393','#ecc180','#d6cbd6']))
  for k in range(5):
   b=TAU*k/5; off=len(v)
   for u,w,z in [(0,0,0),(.07,.045,.018),(.13,0,.025),(.07,-.045,.018)]: v.append((x+math.cos(b)*u-math.sin(b)*w,y+math.sin(b)*u+math.cos(b)*w,.18+h+z)); c.append(color)
   f.append(tuple(off+i for i in range(4)))
 mesh('Meadow wildflowers',v,f,M['petal'],c)

def arch(x,y,z,r,depth=.4):
 for side in (-1,1):
  for k in range(4): box('Cut stone pier',(x+side*r,y,z+.2+k*.4),(.37,depth,.39),M['stone'],'#ebe0c1',.025)
 for i in range(13):
  a0,a1=i*math.pi/13,(i+1)*math.pi/13
  v=[(x+rr*math.cos(a),y+d,z+1.61+rr*math.sin(a)) for d in (-depth/2,depth/2) for rr,a in [(r-.18,a0),(r+.18,a0),(r+.18,a1),(r-.18,a1)]]
  mesh('Individual arch voussoir',v,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],M['stone'],[linear('#ebe0c1')]*8,False)

def garden(name,seed,theme):
 begin(name); rng=random.Random(seed); n,levels=96,36; v,f,c=[],[],[]; phase=rng.random()*TAU
 def outline(a): return 5.25+.55*math.sin(3*a+phase)+.37*math.sin(7*a+.3)+.19*math.sin(13*a)
 for j in range(levels):
  t=j/(levels-1); taper=max(.012,(1-t)**.72*(1+.34*t-.12*t*t))
  for i in range(n):
   a=TAU*i/n+.009*math.sin(i*1.7+j*.8)*math.sin(t*math.pi); flutes=(.13*math.sin(9*a+t*3)+.045*math.sin(17*a+t*2))*math.sin(t*math.pi); r=outline(a)*taper+flutes
   v.append((math.cos(a)*r+t*t*.85,math.sin(a)*r*.86-t*.42,-.02-t*8.5+(.55*math.sin(a*3+phase)+.08*math.sin(a*7+t*5))*math.sin(t*math.pi)))
   strata=.023*math.sin(t*11+math.sin(a*3))+.009*math.sin(a*9)
   c.append(mix(mix(linear('#aa9878'),linear('#ebd8af'),.52+strata),linear('#768854'),max(0,.17-t)*2.1))
 for j in range(levels-1):
  for i in range(n):
   a,b=j*n+i,j*n+(i+1)%n; f.append((a,a+n,b+n,b))
 mesh('Smooth weathered limestone',v,f,M['stone'],c,True)
 # Rounded, continuous buttresses soften the cliff without a faceted color grid.
 for k in range(18):
  angle=TAU*k/18+.10*rng.random(); reach=outline(angle)*rng.uniform(.82,.92)
  cx,cy=math.cos(angle)*reach,math.sin(angle)*reach*.86
  height=rng.uniform(3.0,7.4); width=rng.uniform(.48,.87); vv,ff,cc=[],[],[]
  lean=rng.uniform(.045,.10); sides,rows=20,18
  tint=.53+.06*math.sin(angle*3)
  for j in range(rows+1):
   t=j/rows; z=-.12-height*t; scale=max(.025,(1-t*t)**.72)
   for i in range(sides):
    a=TAU*i/sides
    vv.append((cx*(1+z*lean)+math.cos(a)*width*scale,cy*(1+z*lean)+math.sin(a)*width*scale,z))
    cc.append(mix(linear('#b6a384'),linear('#ead9b7'),tint+.025*math.cos(a)*math.sin(t*math.pi)))
  for j in range(rows):
   for i in range(sides):
    a,b=j*sides+i,j*sides+(i+1)%sides; ff.append((a,a+sides,b+sides,b))
  mesh('Rounded limestone buttress',vv,ff,M['stone'],cc,True)
 v,c,f=[(0,0,.18)],[linear('#86a16a')],[]
 for j in range(1,11):
  t=j/10
  for i in range(n):
   a=TAU*i/n; r=outline(a)*t
   v.append((math.cos(a)*r,math.sin(a)*r*.86,.15+.055*math.sin(i*1.7)*t)); c.append(mix(linear('#79985b'),linear('#b5b983'),t**6*.8+rng.random()*.1))
 for i in range(n): f.append((0,1+i,1+(i+1)%n))
 for j in range(9):
  for i in range(n):
   a,b=1+j*n+i,1+j*n+(i+1)%n; f.append((a,a+n,b+n,b))
 mesh('Living meadow',v,f,M['foliage'],c)
 for i in range(24):
  a=rng.random()*TAU; r=rng.uniform(3.2,4.8)
  sphere('Weathered garden rock',(math.cos(a)*r,math.sin(a)*r*.83,.25),(rng.uniform(.16,.48),rng.uniform(.18,.4),rng.uniform(.12,.32)),M['stone'],rng.choice(['#d1c9a9','#e2d6b5','#bbb894']),16,10)
 for i in range(15):
  y=-3.4+i*.44; box('Stepping stone',(.30*math.sin(y*.8),y,.22),(.71+rng.random()*.25,.34,.1),M['stone'],'#e4d9ba',.04)
 for i in range(24):
  a=rng.random()*TAU; r=outline(a)*rng.uniform(.94,1.015); x,y=math.cos(a)*r,math.sin(a)*r*.87; length=rng.uniform(1.2,4.2)
  canopy((x,y,.17),(.43,.38,.23),rng)
  tube('Hanging vine',[(x*(1-t*.10),y*(1-t*.10),.17-t*length) for t in [j/6 for j in range(7)]],.024,M['foliage'],'#749057',5)
  v,f,c=[],[],[]
  for j in range(12):
   t=j/12; leaves(v,f,c,(x*(1-t*.10)+math.sin(j)*.08,y*(1-t*.10),-t*length),(.25*(1-t)+.06,.18,.14),'#7d9b55',rng,7)
  mesh('Trailing ivy leaves',v,f,M['foliage'],c)
 tree(-2,-.5,.16,1.06 if theme!='orchard' else .88,rng); tree(2.9,-2.1,.17,.58,rng)
 for x,y,s in [(2.8,1.9,.75),(-3.4,2.1,.65),(-.8,-3.3,.46)]: cypress(x,y,.16,s)
 flowers(rng,4.7,230)
 if theme=='lighthouse':
  x,y=1.45,.25
  for z,r in [(.25,.97),(.42,.90),(4.30,.72),(4.43,.86)]: tube('Lighthouse cornice',[(x,y,z),(x,y,z+.14)],r,M['stone'],'#e9dfc0',32)
  tube('Lighthouse tower',[(x,y,.55),(x,y,4.30)],[.70,.53],M['stone'],'#f1e7cc',40)
  for z in (1.4,2.8,3.7):
   for side in (-1,1): box('Tower window',(x+side*.58,y,z),(.03,.19,.38),M['paint'],'#427a7c',.035)
  for j in range(8):
   a=TAU*j/8; tube('Lantern brass mullion',[(x+.54*math.cos(a),y+.54*math.sin(a),4.5),(x+.54*math.cos(a),y+.54*math.sin(a),5.22)],.023,M['brass'])
  sphere('Fresnel lantern',(x,y,4.83),(.32,.32,.36),M['glow'])
  for z in (4.50,5.24): ring('Lantern gallery',(x,y,z),.78,.050,M['brass'])
  tube('Copper spire',[(x,y,5.26),(x,y,6.18)],[.90,.015],M['paint'],'#467b78',32)
  sphere('Spire ornament',(x,y,6.18),(.07,.07,.14),M['brass']); arch(-.25,2.8,.2,.92)
  for side in (-1,1):
   for j in range(4): box('Balustrade',(side*(1.65+j*.48),2.8,.52),(.42,.28,.57),M['stone'],'#e2d9ba',.02)
 elif theme=='ruins':
  arch(1.2,.9,.2,1.35,.58); arch(-1.3,2.5,.2,.82)
  for j in range(4): box('Weathered stair',(1.2,-.4-j*.33,.22+(4-j)*.12),(2.3,.36,.14),M['stone'],'#ded4b4',.03)
  for x,y in [(-3,-2),(3.7,.1)]: tube('Broken column',[(x,y,.2),(x,y,1.4)],.29,M['stone'],'#eee2bf',16)
 elif theme=='orchard':
  tree(1.4,1.8,.16,.77,rng)
  for x in (-1,1): box('Bench leg',(x,2,.43),(.14,.44,.48),M['paint'],'#568582',.03)
  for y in (1.82,2,2.18): box('Bench slat',(0,y,.72),(2.35,.15,.09),M['wood'],'#b68d54',.02)
 else:
  arch(1.15,2.3,.2,.82)
  for z in (.3,.53): tube('Old fountain',[(1.5,0,z),(1.5,0,z+.14)],.74 if z<.4 else .61,M['stone'],'#ded5b3',24)
  sphere('Fountain water',(1.5,0,.66),(.54,.54,.025),M['glass'])

airship(); ray(); whale(); bird(); build_sky_creatures(M,begin,eye)
garden('island',21,'garden'); garden('lighthouse',73,'lighthouse'); garden('ruins',41,'ruins'); garden('orchard',98,'orchard')
begin('pearl'); sphere('Golden sky pearl',(0,0,0),(.22,.22,.22),M['glow'],segments=28,rings=18); ring('Orbit of light',(0,0,0),.29,.012,M['brass'],'XZ',32)
begin('food'); sphere('Floating seed',(0,0,0),(.10,.13,.14),M['canvas'],'#f5d497',16,10); tube('Seed stem',[(0,0,.09),(.05,0,.23)],.012,M['foliage'],'#8fa56c',6); sphere('Seed leaf',(.08,0,.23),(.10,.036,.017),M['foliage'],'#a6b47b',12,6)
manifest={}
for name,collection in collections.items():
 print('BATCHING',name,flush=True)
 bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[collection.name]
 batch(collection); bpy.ops.object.select_all(action='DESELECT')
 for o in collection.all_objects: o.select_set(True)
 bpy.context.view_layer.objects.active=next(iter(collection.objects))
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_vertex_color='ACTIVE')
 manifest[name]={'file':f'{name}.glb','objects':len(collection.all_objects),'bytes':(OUT/f'{name}.glb').stat().st_size,'vertices':sum(len(o.data.vertices) for o in collection.all_objects if o.type=='MESH')}
 print('ASSET_READY',name,manifest[name],flush=True)
 if name in ('island','lighthouse','ruins','orchard'):
  # Distant scenery keeps the same authored silhouette with a smaller budget.
  bpy.ops.object.select_all(action='DESELECT'); distant=[]
  for original in list(collection.objects):
   if original.type!='MESH': continue
   duplicate=original.copy(); duplicate.data=original.data.copy(); collection.objects.link(duplicate)
   duplicate.name=f'{original.name}_distant'; duplicate.select_set(True); distant.append(duplicate)
   modifier=duplicate.modifiers.new('Distant detail reduction','DECIMATE'); modifier.ratio=.23
  bpy.context.view_layer.objects.active=distant[0]
  distant_name=f'{name}-distant'
  bpy.ops.export_scene.gltf(filepath=str(OUT/f'{distant_name}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
  manifest[distant_name]={'file':f'{distant_name}.glb','bytes':(OUT/f'{distant_name}.glb').stat().st_size,'lod':True}
  for duplicate in distant: bpy.data.objects.remove(duplicate,do_unlink=True)
for i,(name,c) in enumerate(collections.items()):
 offset=Vector(((i%3)*19,(i//3)*23,0))
 for o in c.objects:
  if o.parent is None: o.location+=offset
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/'cloudkeep.blend'))
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('CLOUDKEEP_ASSETS_COMPLETE',flush=True)
