import * as THREE from 'three';
import type { GameEvent, Simulation, Vec } from './simulation';
import { SPECIES } from './simulation';

type Spark = {
  position: THREE.Vector3; velocity: THREE.Vector3; color: THREE.Color;
  life: number; duration: number; size: number; kind: number; gravity: number;
};
type Ripple = { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; life: number; duration: number; radius: number };
type CreatureVisual = { root: THREE.Group; left?: THREE.Object3D; right?: THREE.Object3D };

/** A bounded particle pool: the cost stays fixed during long feeding sessions. */
export class SkyEffects {
  readonly root = new THREE.Group();
  private readonly capacity = 1800;
  private cursor = 0;
  private sparks: Spark[] = [];
  private ripples: Ripple[] = [];
  private positions = new Float32Array(this.capacity * 3);
  private colors = new Float32Array(this.capacity * 3);
  private sizes = new Float32Array(this.capacity);
  private fades = new Float32Array(this.capacity);
  private kinds = new Float32Array(this.capacity);
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private emissionClock = 0;
  private lastPearls = new Map<number, THREE.Vector3>();
  private scratch = new THREE.Vector3();
  private flightRig = new THREE.Group();
  private jetMaterial: THREE.ShaderMaterial;
  private jets = new THREE.Group();
  private boostLight = new THREE.PointLight('#8ce5ef', 0, 8, 2);
  private thrust = 0;
  private tick = 0;
  private captureBeam: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  private beamDirection = new THREE.Vector3();
  private beamSide = new THREE.Vector3();
  private beamUp = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private shafts: THREE.Mesh[] = [];
  private captureHalo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private captureGlow = 0;

  constructor(private reduced: boolean) {
    this.root.name = 'Sky effects';
    for (let i = 0; i < this.capacity; i++) this.sparks.push({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), color: new THREE.Color(),
      life: 0, duration: 1, size: 0, kind: 0, gravity: 0,
    });
    for (const [name, array, count] of [
      ['position', this.positions, 3], ['sparkColor', this.colors, 3],
      ['sparkSize', this.sizes, 1], ['sparkFade', this.fades, 1], ['sparkKind', this.kinds, 1],
    ] as const) this.geometry.setAttribute(name, new THREE.BufferAttribute(array, count).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { viewportHeight: { value: 1024 }, time: { value: 0 } },
      vertexShader: `attribute vec3 sparkColor; attribute float sparkSize; attribute float sparkFade; attribute float sparkKind;
        uniform float viewportHeight; varying vec3 tint; varying float fade; varying float kind;
        void main(){tint=sparkColor;fade=sparkFade;kind=sparkKind;
          vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(sparkSize*viewportHeight/max(.2,-mv.z),1.0,96.0);}`,
      fragmentShader: `varying vec3 tint; varying float fade; varying float kind; uniform float time;
        void main(){vec2 p=gl_PointCoord*2.0-1.0;float radius=length(p);
          float glow=exp(-radius*radius*5.0)*smoothstep(1.0,.65,radius);
          if(kind>.5 && kind<1.5){
            float a=time*.65; p=mat2(cos(a),-sin(a),sin(a),cos(a))*p;
            float cross=max(exp(-abs(p.x)*35.0-abs(p.y)*3.0),exp(-abs(p.y)*35.0-abs(p.x)*3.0));
            glow=glow*.22+cross*.9;
          }
          if(kind>1.5 && kind<2.5)glow*=.35;
          if(kind>2.5){
            vec2 q=p*1.35;q.y=-q.y+.15;
            float k=dot(q,q)-1.0;
            float heart=k*k*k-q.x*q.x*q.y*q.y*q.y;
            glow=1.0-smoothstep(-.09,.09,heart);
          }
          gl_FragColor=vec4(tint,glow*fade);}`,
    });
    const points = new THREE.Points(this.geometry, this.material);
    points.frustumCulled = false; points.renderOrder = 12; this.root.add(points);
    const ringGeometry = new THREE.RingGeometry(.94, 1, 64);
    for (let i = 0; i < 12; i++) {
      const material = new THREE.MeshBasicMaterial({ color: '#ffda92', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(ringGeometry, material); mesh.visible = false;
      this.root.add(mesh); this.ripples.push({ mesh, life: 0, duration: 1, radius: 1 });
    }
    this.jetMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, thrust: { value: 0 } },
      vertexShader: `varying vec2 jetUV;uniform float time;uniform float thrust;
        void main(){jetUV=uv;vec3 p=position;
          p.x+=sin(uv.y*18.0-time*28.0)*.045*uv.y;
          p.y*=.65+thrust*.65;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader: `varying vec2 jetUV;uniform float time;uniform float thrust;
        void main(){float t=jetUV.y;float x=abs(jetUV.x-.5)*2.0;
          float width=pow(max(.001,1.0-t),.68)*(.68+.13*sin(t*23.0-time*36.0));
          float core=exp(-pow(x/max(.02,width),2.0)*5.0);
          float feather=smoothstep(1.0,.55,t)*smoothstep(0.0,.06,t);
          vec3 color=mix(vec3(3.2,2.4,1.0),vec3(.14,1.4,2.0),smoothstep(.02,.27,t));
          color=mix(color,vec3(.08,.40,.85),t*.7);
          gl_FragColor=vec4(color,core*feather*thrust*.62);}`,
    });
    const jetGeometry = new THREE.PlaneGeometry(.9, 3.4, 4, 24);
    jetGeometry.translate(0, 1.7, 0);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const jet = new THREE.Mesh(jetGeometry, this.jetMaterial);
      const roll = new THREE.Group(); roll.rotation.z = i * Math.PI / 3;
      jet.rotation.x = Math.PI / 2; roll.add(jet);
      roll.position.set(side * 1.57, -.38, 1.4); this.jets.add(roll);
    }
    this.flightRig.scale.setScalar(1.13); this.flightRig.add(this.jets, this.boostLight);
    this.boostLight.position.set(0, -.15, 1.8);
    this.root.add(this.flightRig);
    const beamMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { time: this.material.uniforms.time, progress: { value: 0 } },
      vertexShader: 'varying vec2 vBeam;void main(){vBeam=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec2 vBeam;uniform float time;uniform float progress;
        void main(){float spiral=pow(.5+.5*sin(vBeam.x*18.8496-vBeam.y*21.0-time*18.0),10.0);
          float ends=smoothstep(0.0,.12,vBeam.y)*smoothstep(1.0,.65,vBeam.y);
          float rings=pow(.5+.5*sin(vBeam.y*40.0+time*24.0),20.0);
          gl_FragColor=vec4(mix(vec3(.20,1.15,1.05),vec3(1.4,1.15,.50),progress),ends*(.025+spiral*.25+rings*.04));}`,
    });
    this.captureBeam = new THREE.Mesh(new THREE.CylinderGeometry(1, .12, 1, 36, 1, true), beamMaterial);
    this.captureBeam.visible = false; this.root.add(this.captureBeam);
    this.captureHalo = new THREE.Mesh(new THREE.TorusGeometry(.72, .027, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#b6f5ce').multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.captureHalo);
    const shaftMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { time: this.material.uniforms.time },
      vertexShader: 'varying vec2 vShaft;void main(){vShaft=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec2 vShaft;uniform float time;
        void main(){float edge=exp(-pow((vShaft.x-.5)*3.7,2.0));
          float veil=sin(vShaft.y*3.14159);float drift=.8+.2*sin(vShaft.y*8.0+time*.16);
          gl_FragColor=vec4(1.4,1.22,.82,edge*veil*veil*drift*.032);}`,
    });
    for (const [x, z] of [[-32, -35], [35, -70], [65, 35], [-55, 30], [0, 58]]) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(12, 95), shaftMaterial);
      shaft.position.set(x, 22, z); shaft.rotation.z = -.5;
      this.root.add(shaft); this.shafts.push(shaft);
    }
  }

  resize(height: number, pixelRatio: number) { this.material.uniforms.viewportHeight.value = height * pixelRatio; }

  private emit(pos: Vec, velocity: Vec, color: string, size: number, duration: number, kind = 0, gravity = 0) {
    const spark = this.sparks[this.cursor++ % this.capacity];
    spark.position.set(pos.x, pos.y, pos.z); spark.velocity.set(velocity.x, velocity.y, velocity.z);
    spark.color.set(color).multiplyScalar(kind === 2 ? 1 : kind === 3 ? 1.3 : 2.4);
    spark.size = size; spark.life = spark.duration = duration; spark.kind = kind; spark.gravity = gravity;
  }

  event(event: GameEvent) {
    if (this.reduced) return;
    const meal = event.type === 'eat';
    const color = event.type === 'respawn' ? '#bcebe2' : event.type === 'collision' ? '#ddd0ab' : meal ? '#ffd0a3' : event.type === 'feed' ? '#fff0c8' : '#ffc96c';
    const count = event.type === 'complete' ? 100 : event.type === 'capture' ? 68 : event.type === 'respawn' ? 50 : event.type === 'upgrade' ? 44 : event.type === 'collision' ? 32 : meal ? 25 : event.type === 'collect' ? 15 : 7;
    for (let i = 0; i < count; i++) {
      const a = i * 2.399; const spread = event.type === 'capture' || event.type === 'respawn' ? 4.5 : event.type === 'feed' ? .8 : meal ? 2.2 : 1.6;
      this.emit(event.pos, { x: Math.sin(a) * spread * (.3 + Math.random()), y: .6 + Math.random() * 2.0, z: Math.cos(a) * spread * (.3 + Math.random()) },
        color, event.type === 'collision' ? .7 : i % 4 === 0 ? .35 : .11, .5 + Math.random() * .95, event.type === 'collision' ? 2 : i % 4 === 0 ? 1 : 0, -.35);
    }
    if (meal) for (let i = 0; i < 3; i++) {
      this.emit({ x: event.pos.x + (i - 1) * .55, y: event.pos.y + 1.5, z: event.pos.z },
        { x: (i - 1) * .32, y: 1.4 + i * .18, z: 0 }, '#ff9d8a', .48 + i * .07, 1.65, 3);
    }
    if (event.type !== 'feed') {
      const ripple = this.ripples.find(r => r.life <= 0) ?? this.ripples[0];
      ripple.life = ripple.duration = event.type === 'respawn' ? 1.2 : meal ? .75 : .55; ripple.radius = event.type === 'capture' || event.type === 'respawn' ? 4.0 : meal ? 2.0 : 1.25;
      ripple.mesh.position.set(event.pos.x, event.pos.y + .35, event.pos.z);
      ripple.mesh.material.color.set(color); ripple.mesh.visible = true;
    }
  }

  update(game: Simulation, dt: number, camera: THREE.Camera, creatures: ReadonlyMap<number, CreatureVisual>) {
    this.material.uniforms.time.value = game.time;
    if (this.reduced) { this.root.visible = false; return; }
    for (const shaft of this.shafts) shaft.rotation.y = Math.atan2(camera.position.x - shaft.position.x, camera.position.z - shaft.position.z);
    const target = game.creatures.find(c => c.id === game.captureTarget);
    this.captureBeam.visible = !!target;
    const intake = game.intake;
    this.captureGlow += (Number(game.capturing) - this.captureGlow) * (1 - Math.exp(-dt * 12));
    this.captureHalo.position.copy(intake); this.captureHalo.quaternion.copy(camera.quaternion);
    this.captureHalo.material.opacity = this.captureGlow * .85;
    this.captureHalo.scale.setScalar(1 + Math.sin(game.time * 8) * .035);
    this.captureHalo.visible = this.captureGlow > .01;
    if (target) {
      this.beamDirection.set(target.pos.x - intake.x, target.pos.y - intake.y, target.pos.z - intake.z);
      const length = this.beamDirection.length(); this.beamDirection.normalize();
      this.beamSide.crossVectors(this.beamDirection, this.up).normalize(); this.beamUp.crossVectors(this.beamSide, this.beamDirection).normalize();
      this.captureBeam.position.copy(target.pos).add(intake).multiplyScalar(.5);
      this.captureBeam.quaternion.setFromUnitVectors(this.up, this.beamDirection);
      this.captureBeam.scale.set(1.6, Math.max(.01, length), 1.6);
      this.captureBeam.material.uniforms.progress.value = target.capture;
    }
    this.thrust += ((game.boosting ? 1 : 0) - this.thrust) * (1 - Math.exp(-dt * (game.boosting ? 11 : 5)));
    this.jetMaterial.uniforms.time.value = game.time;
    this.jetMaterial.uniforms.thrust.value = this.thrust;
    this.jets.visible = this.thrust > .01;
    this.boostLight.intensity = this.thrust * 7;
    this.flightRig.position.set(game.pos.x, game.pos.y, game.pos.z);
    this.flightRig.rotation.set(game.bodyPitch, game.yaw, game.bank, 'YXZ');
    this.emissionClock += dt;
    if (this.emissionClock > .045) {
      this.emissionClock = 0;
      this.tick++;
      if (game.capturing) for (let i = 0; i < 3; i++) {
        const a = game.time * 7 + i * 2.1;
        this.emit({ x: intake.x + Math.sin(a) * .75, y: intake.y + Math.cos(a) * .75, z: intake.z }, { x: 0, y: .1, z: 0 }, '#c2ffdc', .18, .22, 1);
      }
      // A sparse field of nearby motes gives motion and parallax to clear air.
      for (let i = 0; i < 2; i++) this.emit({ x: game.pos.x + (Math.random() - .5) * 60, y: game.pos.y + (Math.random() - .5) * 28, z: game.pos.z + (Math.random() - .5) * 60 },
        { x: .12, y: .06, z: -.08 }, i ? '#f4dc9c' : '#d6f3e7', .065 + Math.random() * .055, 4 + Math.random() * 3, this.tick % 9 === 0 ? 1 : 0);
      if (target) for (let i = 0; i < 10; i++) {
        const t = Math.random(), a = t * 14 - game.time * 12;
        const radius = Math.sin(t * Math.PI) * (1.8 - target.capture * .8);
        this.scratch.copy(intake).lerp(target.pos, t).addScaledVector(this.beamSide, Math.sin(a) * radius).addScaledVector(this.beamUp, Math.cos(a) * radius);
        this.emit(this.scratch, { x: (intake.x - this.scratch.x) * 4, y: (intake.y - this.scratch.y) * 4, z: (intake.z - this.scratch.z) * 4 },
          i % 3 ? '#a5f1df' : '#ffe5a6', i % 3 ? .15 : .27, .3 + t * .12, i % 3 ? 0 : 1);
      }
      const active = new Set(game.drops.map(drop => drop.id));
      for (const [id] of this.lastPearls) if (!active.has(id)) this.lastPearls.delete(id);
      for (const drop of game.drops) {
        const previous = this.lastPearls.get(drop.id);
        if (previous) {
          const distance = previous.distanceTo(drop.pos);
          for (let i = 0; i < Math.min(8, Math.ceil(distance / .16)); i++) {
            this.scratch.copy(previous).lerp(drop.pos, i / Math.max(1, Math.ceil(distance / .16)));
            this.emit(this.scratch, { x: 0, y: .1, z: 0 }, '#ffd477', .14, .40);
          }
          previous.set(drop.pos.x, drop.pos.y, drop.pos.z);
        } else this.lastPearls.set(drop.id, new THREE.Vector3(drop.pos.x, drop.pos.y, drop.pos.z));
        this.emit(drop.pos, { x: 0, y: 0, z: 0 }, '#ffd78d', .85, .07);
        this.emit(drop.pos, { x: 0, y: 0, z: 0 }, '#fff0c6', .9, .07, 1);
      }
      if (game.speed > 2) for (const side of [-1, 1]) {
        this.scratch.set(side * 1.57, -.38, 1.4); this.flightRig.localToWorld(this.scratch);
        this.emit(this.scratch, { x: Math.sin(game.yaw) * Math.cos(game.bodyPitch) * 1.8, y: -Math.sin(game.bodyPitch) * 1.8 - .06, z: Math.cos(game.yaw) * Math.cos(game.bodyPitch) * 1.8 }, '#d1e9ee', .38 + this.thrust * .45, 1.2, 2);
        if (this.thrust > .1) for (let i = 0; i < 5; i++) {
          const spread = () => (Math.random() - .5) * .8;
          this.emit(this.scratch, { x: Math.sin(game.yaw) * Math.cos(game.bodyPitch) * 5 + spread(), y: -Math.sin(game.bodyPitch) * 5 + spread() * .7, z: Math.cos(game.yaw) * Math.cos(game.bodyPitch) * 5 + spread() },
            i % 3 === 0 ? '#ffe0a0' : '#93ecf2', i % 3 === 0 ? .15 : .26, .45 + Math.random() * .65, i % 3 === 0 ? 1 : 0);
        }
      }
      for (const creature of game.creatures) {
        const visual = creatures.get(creature.id);
        if (!visual || creature.mode === 'capturing' || Math.hypot(creature.pos.x - game.pos.x, creature.pos.z - game.pos.z) > 65) continue;
        if (creature.mode === 'flee' && this.tick % 2 === 0) this.emit(creature.pos, { x: 0, y: .2, z: 0 }, '#d8f3e6', .4, .8, 2);
        if (creature.spawn < 1) for (let i = 0; i < 3; i++) {
          const a = game.time * 5 + i * 2.1;
          this.emit({ x: creature.pos.x + Math.sin(a) * 2, y: creature.pos.y + (1 - creature.spawn) * 3, z: creature.pos.z + Math.cos(a) * 2 }, { x: 0, y: .4, z: 0 }, '#c6f3df', .2, .7, 1);
        }
        if (creature.species === 'ray' && this.tick % 2 === 0) for (const side of [-1, 1]) {
          const wing = side < 0 ? visual.left : visual.right;
          if (!wing) continue;
          this.scratch.set(side * 3.16, .69 + Math.sin(game.time * 2 - 3.16 * 1.6) * .52, .86);
          wing.localToWorld(this.scratch);
          this.emit(this.scratch, { x: 0, y: -.06, z: 0 }, '#ffe6be', .11, 1.25, this.tick % 6 === 0 ? 1 : 0);
        }
        if (creature.species === 'bird') {
          this.scratch.set(-.1, -.48, 1.7); visual.root.localToWorld(this.scratch);
          this.emit(this.scratch, { x: 0, y: -.15, z: 0 }, '#ffd276', this.tick % 3 === 0 ? .24 : .09, 1.0, this.tick % 3 === 0 ? 1 : 0);
        }
        if (creature.species === 'moth' && this.tick % 2 === 0) for (const side of [-1, 1]) {
          this.scratch.set(side * 1.2, .3, .1); visual.root.localToWorld(this.scratch);
          this.emit(this.scratch, { x: side * .12, y: -.16, z: .08 }, '#ffdc98', .15, 1.5, this.tick % 6 === 0 ? 1 : 0);
        }
        if (creature.species === 'koi' && this.tick % 3 === 0) {
          this.scratch.set(0, .1, 2.5); visual.root.localToWorld(this.scratch);
          this.emit(this.scratch, { x: 0, y: .14, z: 0 }, '#dcf5eb', .23, 1.2, 0);
        }
        if (creature.species === 'jelly' && this.tick % 2 === 0) {
          const a = game.time * 2.1 + creature.phase;
          this.emit({ x: creature.pos.x + Math.sin(a), y: creature.pos.y - 1.4, z: creature.pos.z + Math.cos(a) }, { x: 0, y: -.2, z: 0 }, '#bcf5dc', .18, 2.0, this.tick % 6 === 0 ? 1 : 0);
        }
        if (creature.species === 'whale' && (game.time + creature.phase * 3) % 9 < 1.1) {
          this.scratch.set(0, .96, -1); visual.root.localToWorld(this.scratch);
          this.emit(this.scratch, { x: (Math.random() - .5) * .5, y: 2.6, z: .15 }, '#d7edf0', .65, 1.6, 2);
        }
        if (creature.happy > 0 && this.tick % 5 === 0) {
          const angle = game.time * 2.2;
          const radius = SPECIES[creature.species].scale * 1.7;
          this.emit({ x: creature.pos.x + Math.sin(angle) * radius, y: creature.pos.y + 1.2, z: creature.pos.z + Math.cos(angle) * radius },
            { x: 0, y: .3, z: 0 }, '#ffe2ab', .2, .8, 1);
        }
      }
    }
    for (let i = 0; i < this.capacity; i++) {
      const spark = this.sparks[i]; spark.life = Math.max(0, spark.life - dt);
      if (spark.life > 0) {
        spark.velocity.y += spark.gravity * dt;
        spark.position.addScaledVector(spark.velocity, dt);
        spark.position.toArray(this.positions, i * 3); spark.color.toArray(this.colors, i * 3);
      }
      const remaining = spark.life / spark.duration;
      this.fades[i] = Math.min(1, remaining * 2.2);
      this.sizes[i] = spark.size * (spark.kind === 2 ? 1 + (1 - remaining) * 2 : .65 + remaining * .35);
      this.kinds[i] = spark.kind;
    }
    for (const attr of Object.values(this.geometry.attributes)) attr.needsUpdate = true;
    for (const ripple of this.ripples) {
      ripple.life = Math.max(0, ripple.life - dt); ripple.mesh.visible = ripple.life > 0;
      if (!ripple.mesh.visible) continue;
      const progress = 1 - ripple.life / ripple.duration;
      ripple.mesh.scale.setScalar(ripple.radius * (.24 + Math.sin(progress * Math.PI / 2) * .76));
      ripple.mesh.quaternion.copy(camera.quaternion);
      ripple.mesh.material.opacity = (1 - progress) ** 2 * .55;
    }
  }
}
