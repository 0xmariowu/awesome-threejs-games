import{U as e,ar as t,pa as n,ro as r,ta as i}from"./three.core-DtjtRha-.js";async function a(a){let{env:o}=a,s={uZenith:{value:new e},uHorizon:{value:new e},uSunDir:{value:new r},uSunColor:{value:new e}},c=new i({uniforms:s,side:1,depthWrite:!1,vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,fragmentShader:`
      uniform vec3 uZenith, uHorizon, uSunDir, uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.45));
        if (d.y < 0.0) col = uHorizon * 0.8;
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 900.0) * 30.0 + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`}),l=new t(new n(1e4,32,16),c);l.frustumCulled=!1,l.renderOrder=-1,l.name=`sky`,a.scene.add(l),a.scene.background=null;let u=()=>{s.uZenith.value.copy(o.palette.zenith),s.uHorizon.value.copy(o.palette.horizon),s.uSunDir.value.copy(o.sunDir),s.uSunColor.value.copy(o.palette.sun)};return u(),o.onChange(u),{update(){l.position.copy(a.camera.position)}}}export{a as build};