import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { Reflector } from './vendor/three/addons/objects/Reflector.js';

// One renderer is shared by the three rooms; the exercise owns its clock.
export async function createScenes(){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  let lost=false,disposed=false;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});
  const rooms={},extras=[];
  const camera=new THREE.PerspectiveCamera(55,1,.1,240);
  let seed=409;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const mat=(color,more={})=>new THREE.MeshStandardMaterial({color,roughness:.85,...more});
  function mesh(scene,geo,material,x,y,z,s=1){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.setScalar(s);scene.add(m);return m;}
  function base(color,density){const s=new THREE.Scene();s.background=new THREE.Color(color);s.fog=new THREE.FogExp2(color,density);s.add(new THREE.HemisphereLight('#c6e4e1','#203538',2));return s;}
  function particles(scene,count,color,size,spread){const p=[];for(let i=0;i<count;i++)p.push((random()-.5)*spread,(random()-.5)*spread,-random()*spread);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color,size,transparent:true,opacity:.65,depthWrite:false}));scene.add(m);return m;}
  function water(scene,y,color){
    const w=new Reflector(new THREE.PlaneGeometry(180,180),{color,textureWidth:1024,textureHeight:1024,multisample:0,clipBias:.003});
    w.rotation.x=-Math.PI/2;w.position.set(0,y,-45);
    w.material.uniforms.time={value:0};
    // Surface-space ripples avoid the bands caused by using projected coordinates.
    w.material.vertexShader='varying vec2 surface;\n'+w.material.vertexShader.replace('vUv = textureMatrix','surface=position.xy; vUv = textureMatrix');
    w.material.fragmentShader='uniform float time; varying vec2 surface;\n'+w.material.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );',`
      vec2 uv=vUv.xy/vUv.w;
      vec2 ripple=vec2(sin(surface.y*2.1+time*.45)+sin(surface.x*1.8+surface.y*.8-time*.3),cos(surface.y*3.2+time*.35));
      uv+=ripple*vec2(.00065,.0003);
      vec4 base=texture2D(tDiffuse,uv)*.5;
      base+=texture2D(tDiffuse,uv+vec2(.0008,0.))*.25;
      base+=texture2D(tDiffuse,uv-vec2(.0008,0.))*.25;
      base.rgb=mix(base.rgb,vec3(.045,.10,.095),.12);`);
    scene.add(w);extras.push(w);return w;
  }
  const dawn=base('#83949e',.009),under=base('#073b4a',.037),space=base('#050b1c',.004);
  rooms.weather={scene:dawn};rooms.descent={scene:under};rooms.resonance={scene:space};
  const sunlight=new THREE.DirectionalLight('#ffdba1',3);sunlight.position.set(-20,15,-70);dawn.add(sunlight);
  const sun=mesh(dawn,new THREE.SphereGeometry(3.5,32,24),new THREE.MeshBasicMaterial({color:'#fff3ca',toneMapped:false,fog:false}),-20,5,-100);
  const lake=water(dawn,-.4,0x9bafa9);
  const sunCanvas=document.createElement('canvas');sunCanvas.width=sunCanvas.height=256;
  const sc=sunCanvas.getContext('2d'),halo=sc.createRadialGradient(128,128,0,128,128,128);
  halo.addColorStop(0,'rgba(255,249,219,1)');halo.addColorStop(.13,'rgba(255,238,185,.85)');halo.addColorStop(.25,'rgba(255,216,139,.34)');halo.addColorStop(.52,'rgba(255,201,117,.10)');halo.addColorStop(1,'rgba(255,190,100,0)');
  sc.fillStyle=halo;sc.fillRect(0,0,256,256);
  const sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sunCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false}));
  sunGlow.scale.set(40,40,1);dawn.add(sunGlow);
  const hillHeight=(x,z,layer)=>Math.max(0,Math.sin(x*.045+layer*2)*6+Math.sin(x*.11+layer)*2+Math.sin(x*.51+z*.42)*.25+6)*Math.max(0,1-Math.abs(z)/17)-.8;

  // Broad, wind-stretched cloud banks give the lake a recognizable weather front.
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{clearing:{value:0},time:{value:0}},vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
    varying vec3 direction; uniform float clearing; uniform float time;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){
      vec3 d=normalize(direction);float h=max(d.y,0.);
      vec3 horizon=mix(vec3(.40,.48,.48),vec3(.96,.72,.43),clearing);
      vec3 zenith=mix(vec3(.085,.19,.25),vec3(.17,.38,.52),clearing);
      vec3 c=mix(horizon,zenith,pow(h,.5));
      vec2 uv=vec2(d.x*3.5+time*.006,d.y*12.+d.z*2.);
      float n=noise(uv)*.62+noise(uv*2.1)*.26+noise(uv*4.3)*.12;
      float cloud=smoothstep(.36,.72,n)*smoothstep(.015,.13,h)*(1.-smoothstep(.55,.9,h));
      c=mix(c,mix(vec3(.45,.53,.55),vec3(.91,.81,.65),clearing),cloud*(.85-clearing*.4));
      float light=pow(max(dot(d,normalize(vec3(-.20,.07+clearing*.4,-1.))),0.),32.);
      c+=vec3(.42,.24,.09)*light*(.25+clearing*.75);
      gl_FragColor=vec4(c,1.);
    }`});
  mesh(dawn,new THREE.SphereGeometry(210,32,24),skyMaterial,0,0,0);
  const terrainCanvas=document.createElement('canvas');terrainCanvas.width=terrainCanvas.height=256;const tc=terrainCanvas.getContext('2d');tc.fillStyle='#9ca08c';tc.fillRect(0,0,256,256);
  for(let i=0;i<14000;i++){const v=80+random()*110;tc.fillStyle=`rgba(${v},${v},${v*.85},.3)`;tc.fillRect(random()*256,random()*256,1+random()*3,1+random()*3);}
  const terrainMap=new THREE.CanvasTexture(terrainCanvas);terrainMap.colorSpace=THREE.SRGBColorSpace;terrainMap.wrapS=terrainMap.wrapT=THREE.RepeatWrapping;terrainMap.repeat.set(14,8);
  // Real terrain contours, with layers of mountains extending behind the lake.
  for(let layer=0;layer<3;layer++){
    const g=new THREE.PlaneGeometry(220,34,110,18);g.rotateX(-Math.PI/2);const p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,hillHeight(x,z,layer));}g.computeVertexNormals();
    mesh(dawn,g,mat(['#536657','#71847a','#96a299'][layer],{map:terrainMap,side:THREE.DoubleSide}),0,0,-37-layer*26);
  }
  // Reeds frame the open water without filling the horizon with rocks.
  const reedMaterial=mat('#485d43',{side:THREE.DoubleSide}),reedTipMaterial=mat('#756449');
  const reeds=new THREE.Group();dawn.add(reeds);
  for(let i=0;i<70;i++){
    const side=i%2?1:-1,x=side*(7+random()*8),z=2-random()*12,h=.7+random()*1.5;
    const stem=mesh(reeds,new THREE.CylinderGeometry(.012,.025,h,4),reedMaterial,x,h/2-.4,z);
    stem.rotation.z=side*(.08+random()*.13);
    mesh(reeds,new THREE.CylinderGeometry(.065,.06,.32,6),reedTipMaterial,x-side*h*.08,h-.48,z);
  }
  const rain=particles(dawn,500,'#d8e8e5',.045,65);
  const seabedGeo=new THREE.PlaneGeometry(130,130,60,60);seabedGeo.rotateX(-Math.PI/2);const sandPos=seabedGeo.attributes.position;
  for(let i=0;i<sandPos.count;i++)sandPos.setY(i,Math.sin(sandPos.getX(i)*.23)*.3+Math.cos(sandPos.getZ(i)*.34)*.18);seabedGeo.computeVertexNormals();mesh(under,seabedGeo,mat('#668c82',{map:terrainMap}),0,-4,-35);
  const oceanLight=new THREE.DirectionalLight('#b4f9ec',3);oceanLight.position.set(-10,25,-20);under.add(oceanLight);
  const kelps=[];
  const kelpMaterial=mat('#508b68',{side:THREE.DoubleSide,roughness:.6});
  const kelpTime={value:0};
  kelpMaterial.onBeforeCompile=shader=>{shader.uniforms.kelpTime=kelpTime;shader.vertexShader='uniform float kelpTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    transformed.x+=sin(position.y*1.7+kelpTime*.5)*position.y*.07;
    transformed.z+=sin(position.y*2.2-kelpTime*.35)*position.y*.035;`);};
  function frond(length,width,phase){
    const vertices=[],uvs=[],indices=[];
    for(let j=0;j<=24;j++){const t=j/24,w=Math.sin(Math.PI*Math.pow(t,.7))*width;
      for(const side of [-1,1]){vertices.push(Math.sin(t*2.6+phase)*t*.5+side*w*(1+.14*Math.sin(t*35)),t*length,Math.sin(t*5+phase)*t*.24+side*Math.sin(t*9)*.07);uvs.push((side+1)/2,t);}
      if(j<24){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  for(let i=0;i<62;i++){
    const x=(i%2?1:-1)*(3+random()*20),z=7-random()*60,plant=new THREE.Group();plant.position.set(x,-4,z);under.add(plant);
    for(let j=0;j<5;j++){const leaf=mesh(plant,frond(1.6+random()*5,.12+random()*.2,random()*6),kelpMaterial,(random()-.5)*.35,0,(random()-.5)*.35);leaf.rotation.y=random()*6.28;leaf.rotation.z=(random()-.5)*.4;}
    kelps.push(plant);
  }
  const jellies=[];
  for(let i=0;i<7;i++){
    const group=new THREE.Group();group.position.set((random()-.5)*23,random()*7,-7-random()*33);under.add(group);
    const jellyMat=mat('#9de7df',{transparent:true,opacity:.35,emissive:'#2a7e89',emissiveIntensity:.6,side:THREE.DoubleSide,depthWrite:false});
    mesh(group,new THREE.SphereGeometry(.6,24,16,0,Math.PI*2,0,Math.PI/2),jellyMat,0,0,0);
    for(let j=0;j<7;j++){const a=j/7*Math.PI*2;const path=new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a)*.4,0,Math.sin(a)*.4),new THREE.Vector3(Math.cos(a)*.3,-.8,Math.sin(a)*.5),new THREE.Vector3(Math.cos(a)*.5,-1.7,Math.sin(a)*.3)]);mesh(group,new THREE.TubeGeometry(path,16,.012,4,false),jellyMat,0,0,0);}
    group.userData.homeY=group.position.y;jellies.push(group);
  }
  const bubbles=particles(under,350,'#a7dbd7',.04,55);
  // Feathered light columns disappear at their edges instead of reading as cones.
  const beamCanvas=document.createElement('canvas');beamCanvas.width=64;beamCanvas.height=256;
  const bc=beamCanvas.getContext('2d'),beamPixels=bc.createImageData(64,256);
  for(let y=0;y<256;y++)for(let x=0;x<64;x++){
    const i=(y*64+x)*4,edge=Math.sin(x/63*Math.PI)**3,fade=Math.sin(y/255*Math.PI)**.8;
    beamPixels.data[i]=beamPixels.data[i+1]=beamPixels.data[i+2]=255;beamPixels.data[i+3]=edge*fade*255;
  }
  bc.putImageData(beamPixels,0,0);const beamTexture=new THREE.CanvasTexture(beamCanvas);
  const shafts=[];
  for(let i=0;i<5;i++){const beam=mesh(under,new THREE.PlaneGeometry(8,25),new THREE.MeshBasicMaterial({map:beamTexture,color:'#b2f4df',transparent:true,opacity:.022,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),-13+i*7,6,-15-i*4);beam.rotation.z=-.22;shafts.push(beam);}
  // A pearl-like moon and inclined orbital arcs anchor the celestial room.
  const moon=mesh(space,new THREE.SphereGeometry(4.2,48,32),mat('#b3c3da',{roughness:.95,emissive:'#22334e',emissiveIntensity:.25}),9,5,-42);
  const moonLight=new THREE.DirectionalLight('#ecd9bb',3);moonLight.position.set(-15,12,5);space.add(moonLight);
  const orbits=new THREE.Group();orbits.position.copy(moon.position);orbits.rotation.set(.65,-.3,-.35);space.add(orbits);
  for(const radius of [6.2,7,9.5])mesh(orbits,new THREE.TorusGeometry(radius,.016,4,160),new THREE.MeshBasicMaterial({color:'#afc8df',transparent:true,opacity:radius===7?.30:.13}),0,0,0);
  const stars=particles(space,2200,'#c7dbff',.055,120);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const gc=glowCanvas.getContext('2d'),grad=gc.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(138,185,246,.35)');grad.addColorStop(.3,'rgba(107,99,190,.12)');grad.addColorStop(1,'rgba(50,70,140,0)');gc.fillStyle=grad;gc.fillRect(0,0,128,128);const glowTexture=new THREE.CanvasTexture(glowCanvas);
  for(let i=0;i<12;i++){const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:i%2?'#9680ca':'#63b8c9',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));cloud.position.set((random()-.5)*45,(random()-.5)*22,-25-random()*25);cloud.scale.set(25,18,1);space.add(cloud);}
  try{
    const treeSource=await new GLTFLoader().loadAsync(new URL('./assets/trees/pines.gltf',import.meta.url).href);
    treeSource.scene.updateMatrixWorld(true);
    treeSource.scene.children.forEach((variant,variantIndex)=>{
      const box=new THREE.Box3().setFromObject(variant),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      const placements=Array.from({length:24},()=>{const x=(random()-.5)*160,z=-25-random()*13,scale=(3.8+random()*4.4)/size.y;return {x,z,scale,y:hillHeight(x,z+37,0),yaw:random()*6.28};});
      variant.traverse(original=>{if(!original.isMesh)return;
        const geometry=original.geometry.clone().applyMatrix4(original.matrixWorld);geometry.translate(-center.x,-box.min.y,-center.z);
        const material=original.material;material.roughness=.9;
        const forest=new THREE.InstancedMesh(geometry,material,placements.length),dummy=new THREE.Object3D();
        placements.forEach((p,i)=>{dummy.position.set(p.x,p.y-.08,p.z);dummy.scale.setScalar(p.scale);dummy.rotation.y=p.yaw;dummy.updateMatrix();forest.setMatrixAt(i,dummy.matrix);});
        forest.computeBoundingSphere();dawn.add(forest);original.geometry.dispose();
      });
    });
    const source=await new GLTFLoader().loadAsync(new URL('./assets/garden/rock_moss_set_01/rock_moss_set_01_1k.gltf',import.meta.url).href);
    const models=[];source.scene.traverse(o=>{if(o.isMesh)models.push(o);});
    for(const s of [dawn,under])for(let i=0;i<18;i++){
      const original=models[i%models.length],geo=original.geometry.clone();geo.computeBoundingBox();const box=geo.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());geo.translate(-center.x,-box.min.y,-center.z);
      const rockMat=original.material.clone();if(s===under)rockMat.color.set('#7ea99b');
      const rock=mesh(s,geo,rockMat,(i%2?1:-1)*(3+random()*13),s===under?-4:-.5,5-random()*22,(1+random()*2)/Math.max(size.x,size.y,size.z));rock.rotation.y=random()*6.28;
    }
    models.forEach(o=>{o.geometry.dispose();o.material.dispose();});
  }catch(e){dispose();throw e;}
  let width=0,height=0,ratio=0;
  function draw(ctx,o){
    if(lost||disposed)return false;
    const room=rooms[o.room];if(!room)return false;
    const q=Math.min(devicePixelRatio||1,o.quality<.65?.85:1.4);
    if(width!==o.width||height!==o.height||q!==ratio){width=o.width;height=o.height;ratio=q;renderer.setPixelRatio(q);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
    const t=o.reduced?0:o.time,p=Math.max(0,Math.min(1,o.progress||0));
    // A closed, minute-long drift keeps the viewer within the composed clearing.
    const drift=Math.sin(t*.035),travel=1-Math.cos(t*.025);
    camera.position.set(drift*1.25,2+Math.sin(t*.045)*.08,11-travel*1.4);camera.lookAt(drift*.35,1,-25);
    if(o.room==='weather'){
      const c=Math.max(0,Math.min(1,o.clearing||0));sun.position.y=2+c*40;sunGlow.position.copy(sun.position);sunGlow.material.opacity=.55+c*.45;skyMaterial.uniforms.clearing.value=c;skyMaterial.uniforms.time.value=t;sunlight.position.y=sun.position.y+8;
      dawn.background.setRGB(.25+c*.38,.34+c*.30,.40+c*.12);dawn.fog.color.copy(dawn.background);sunlight.intensity=1+c*3;
      const weather=o.weather||{n:.6,spd:520,haze:.16,hazeCol:'180,190,200'};rain.material.opacity=(1-c)*weather.n*.6;rain.material.color.set(`rgb(${weather.hazeCol})`);dawn.fog.density=.006+weather.haze*.05*(1-c);rain.position.y=-(t*weather.spd/650%12);lake.material.uniforms.time.value=t;
    }else if(o.room==='descent'){
      // Descend continuously from the surface to a safe height above the sand.
      // The session clock pauses with the exercise; reduced motion holds the view.
      const depth=o.reduced?0:1-Math.pow(1-p,2);
      const eyeY=9-depth*10.5,eyeZ=11-depth*8;
      camera.position.set(drift*.65,eyeY,eyeZ);
      camera.lookAt(drift*.2,eyeY-2.2,-22-depth*5);
      under.fog.color.setRGB(.025-depth*.012,.23-depth*.10,.29-depth*.10);
      under.background.copy(under.fog.color);under.fog.density=.025+depth*.014;
      oceanLight.intensity=3.8-depth*2;
      shafts.forEach((beam,i)=>{beam.material.opacity=.12-depth*.065;beam.rotation.z=-.22+Math.sin(t*.06+i)*.025;});
      kelpTime.value=t;kelps.forEach((k,i)=>k.rotation.z=Math.sin(t*.22+i)*.035);
      jellies.forEach((j,i)=>{j.position.y=j.userData.homeY+Math.sin(t*.12+i)*.35;j.rotation.z=Math.sin(t*.2+i)*.08;j.scale.setScalar(.9+Math.sin(t*.45+i)*.06);});bubbles.position.y=t*.18%8;
    }else{
      camera.position.set(drift*.7,1+Math.sin(t*.025)*.3,11-travel);camera.lookAt(drift*.2,1,-25);stars.rotation.y=t*.0008;
      space.children.forEach(child=>{if(child.isSprite){child.material.opacity=.7+(o.reduced?0:o.level*.15);}});
    }
    renderer.render(room.scene,camera);ctx.drawImage(renderer.domElement,0,0,width,height);return true;
  }
  function dispose(){if(disposed)return;disposed=true;const gs=new Set(),ms=new Set(),ts=new Set();Object.values(rooms).forEach(({scene})=>scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);}));ms.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)ts.add(v);});m.dispose();});gs.forEach(g=>g.dispose());ts.forEach(t=>t.dispose());extras.forEach(e=>e.dispose());renderer.dispose();}
  return {draw,dispose};
}
