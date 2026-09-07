import * as THREE from 'three';
import { Reflector } from './vendor/three/addons/objects/Reflector.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';

const root=new URL('./assets/garden/',import.meta.url);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function seeded(seed=91){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const river=z=>Math.sin(z*.105)*1.65;
const ground=(x,z)=>{
  const bank=clamp((Math.abs(x-river(z))-1.2)/1.7,0,1);
  return -.28+bank*(.65+Math.sin(x*.34+z*.21)*.16+Math.sin(z*.6)*.05);
};
function texture(kind){
  const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d'),r=seeded(43);
  if(kind==='foliage'){
    for(let i=0;i<1600;i++){
      const a=r()*Math.PI*2,rr=Math.sqrt(r()),x=128+Math.cos(a)*rr*118,y=128+Math.sin(a)*rr*111;
      c.fillStyle=`hsl(${95+r()*30} ${22+r()*20}% ${18+r()*27}%)`;
      c.beginPath();c.ellipse(x,y,1+r()*5,1+r()*2,a,0,Math.PI*2);c.fill();
    }
  }else{
    c.fillStyle=kind==='bark'?'#635e48':'#4b5a3b';c.fillRect(0,0,256,256);
    for(let i=0;i<15000;i++){
      const shade=kind==='bark'?35+r()*55:30+r()*55;
      c.fillStyle=`rgba(${shade},${shade+(kind==='bark'?0:14)},${shade*.63},${.15+r()*.35})`;
      c.fillRect(r()*256,r()*256,kind==='bark'?1+r()*2:1+r()*5,kind==='bark'?8+r()*60:1+r()*5);
    }
  }
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  if(kind!=='foliage'){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='bark'?2:18,kind==='bark'?4:20);}
  return t;
}
function instantiate(scene,geometry,material,placements,cast=true){
  const mesh=new THREE.InstancedMesh(geometry,material,placements.length),dummy=new THREE.Object3D();
  placements.forEach((p,i)=>{dummy.position.set(...p.pos);dummy.rotation.set(...(p.rot||[0,p.yaw||0,0]));dummy.scale.set(...(p.scale||[1,1,1]));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh;
}
function normalizedModels(gltf){
  const models=[];
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    const geo=o.geometry.clone();geo.computeBoundingBox();const box=geo.boundingBox,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    geo.translate(-center.x,-box.min.y,-center.z);
    models.push({geo,material:o.material,size});
  });return models;
}
export async function createGarden(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  let lost=false;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});
  const scene=new THREE.Scene();scene.background=new THREE.Color('#81978c');scene.fog=new THREE.FogExp2('#81978c',.021);
  const camera=new THREE.PerspectiveCamera(52,1,.1,180);camera.position.set(0,2.8,10);camera.lookAt(.1,1.4,-12);
  const hemi=new THREE.HemisphereLight('#e6f2df','#384332',2.2);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#ffdda0',3.2);sun.position.set(-14,23,-15);sun.target.position.set(0,0,-7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-22,right:22,top:24,bottom:-24,near:1,far:75});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight('#a5cdd6',.65);fill.position.set(12,8,8);scene.add(fill);

  const sky=new THREE.Mesh(new THREE.SphereGeometry(130,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vPosition; void main(){ vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:`varying vec3 vPosition;
    void main(){vec3 d=normalize(vPosition);float h=max(d.y,0.0);vec3 col=mix(vec3(.68,.73,.57),vec3(.20,.37,.42),pow(h,.55));float s=pow(max(dot(d,normalize(vec3(-.25,.32,-1.))),0.),90.);col+=vec3(.48,.34,.14)*s;gl_FragColor=vec4(col,1.);}`}));scene.add(sky);
  const earthGeo=new THREE.PlaneGeometry(110,120,96,112);earthGeo.rotateX(-Math.PI/2);earthGeo.translate(0,0,-35);
  const pos=earthGeo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,ground(x,z));}earthGeo.computeVertexNormals();
  const earth=new THREE.Mesh(earthGeo,new THREE.MeshStandardMaterial({map:texture('ground'),roughness:1,color:'#a3aa82'}));earth.receiveShadow=true;scene.add(earth);

  const waterGeo=new THREE.PlaneGeometry(1,1,1,1),vertices=[],indices=[];
  for(let i=0;i<=160;i++){const z=14-i*.55,w=1.48;vertices.push(river(z)-w,.055,z,river(z)+w,.055,z);if(i<160){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}
  waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));waterGeo.setIndex(indices);waterGeo.computeVertexNormals();
  // A half-resolution reflection captures the actual trees, rocks, and sky.
  // The mesh is local XY because Reflector's plane normal is local +Z.
  const wp=waterGeo.attributes.position;
  for(let i=0;i<wp.count;i++)wp.setXYZ(i,wp.getX(i),-wp.getZ(i),0);
  const wi=waterGeo.index.array;for(let i=0;i<wi.length;i+=3){const tmp=wi[i+1];wi[i+1]=wi[i+2];wi[i+2]=tmp;}waterGeo.computeVertexNormals();
  const water=new Reflector(waterGeo,{color:0x899b8f,textureWidth:512,textureHeight:512,clipBias:.003,multisample:0});
  water.rotation.x=-Math.PI/2;water.position.y=.055;
  const waterMaterial=water.material;waterMaterial.uniforms.time={value:0};
  waterMaterial.vertexShader='varying vec2 vSurface;\n'+waterMaterial.vertexShader.replace('vUv = textureMatrix','vSurface=position.xy; vUv = textureMatrix');
  waterMaterial.fragmentShader='uniform float time; varying vec2 vSurface;\n'+waterMaterial.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec4 uv=vUv;
    uv.x+=(sin(vSurface.y*1.2+time*.4)+sin(vSurface.x*2.9-time*.25))*.0015*uv.w;
    uv.y+=sin(vSurface.y*2.4+vSurface.x+time*.3)*.0007*uv.w;
    vec4 base=texture2DProj(tDiffuse,uv);base.rgb=mix(base.rgb,vec3(.055,.12,.09),.24);`);
  scene.add(water);

  const r=seeded(782),trunks=[],crowns=[];
  // Shared meshes and cutout foliage keep the distant forest inexpensive.
  for(let i=0;i<86;i++){
    const z=-r()*83+5,x=(i%2?-1:1)*(4+r()*39),h=8+r()*13,w=.18+r()*.34,y=ground(x,z);
    trunks.push({pos:[x,y+h*.43,z],scale:[w,h*.86,w],yaw:r()*6.28});
    const layers=6;
    for(let k=0;k<layers;k++){
      const yy=y+h*(.48+k*.10),rad=(1-k/layers)*2.9+.6;
      for(let j=0;j<3;j++)crowns.push({pos:[x,yy,z],rot:[.10,j*Math.PI/3+r()*.3,0],scale:[rad*2.2,rad*1.4,1]});
    }
  }
  const bark=texture('bark');instantiate(scene,new THREE.CylinderGeometry(.6,1,1,8),new THREE.MeshStandardMaterial({map:bark,roughness:1,color:'#d0c5aa'}),trunks);
  const leafMat=new THREE.MeshLambertMaterial({map:texture('foliage'),alphaTest:.5,side:THREE.DoubleSide,color:'#becfa1'});
  instantiate(scene,new THREE.PlaneGeometry(1,1),leafMat,crowns,false);

  let sources;
  try{sources=await Promise.all(['rock_moss_set_01','fern_02'].map(name=>new GLTFLoader().loadAsync(new URL(`${name}/${name}_1k.gltf`,root).href)));}
  catch(error){dispose();throw error;}
  const rocks=normalizedModels(sources[0]),ferns=normalizedModels(sources[1]);
  rocks.forEach((model,index)=>{
    model.material.roughness=1;const places=[];
    for(let i=0;i<7;i++){const z=7-r()*43,side=(i+index)%2?1:-1,x=river(z)+side*(1.6+r()*2.4),s=(.5+r()*1.2)/Math.max(model.size.x,model.size.z);places.push({pos:[x,ground(x,z)-.13,z],scale:[s,s,s],yaw:r()*6.28});}
    instantiate(scene,model.geo,model.material,places);
  });
  ferns.forEach((model,index)=>{
    model.material.side=THREE.DoubleSide;model.material.alphaTest=.45;model.material.roughness=.85;const places=[];
    for(let i=0;i<13;i++){const z=8-r()*36,side=(i+index)%2?1:-1,x=river(z)+side*(2.3+r()*5),s=(.65+r()*.9)/Math.max(model.size.x,model.size.z);places.push({pos:[x,ground(x,z)-.02,z],scale:[s,s,s],yaw:r()*6.28});}
    instantiate(scene,model.geo,model.material,places,false);
  });
  // Ground-cover blades use one draw call rather than hundreds of objects.
  const blades=[];for(let i=0;i<4200;i++){const z=9-r()*58,x=(r()-.5)*40;if(Math.abs(x-river(z))<2)continue;const h=.12+r()*.35;blades.push({pos:[x,ground(x,z)+h/2,z],scale:[.035+r()*.05,h,1],rot:[0,r()*Math.PI*2,(r()-.5)*.35]});}
  const bladeGeo=new THREE.BufferGeometry();bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.25,.15,.08,.25,.15,.08,.32,.5,.2],3));bladeGeo.setIndex([0,1,2,1,3,2,2,3,4]);bladeGeo.computeVertexNormals();
  instantiate(scene,bladeGeo,new THREE.MeshLambertMaterial({color:'#627848',side:THREE.DoubleSide}),blades,false);
  const motesGeo=new THREE.BufferGeometry(),motes=[];for(let i=0;i<100;i++)motes.push((r()-.5)*30,.5+r()*8,4-r()*40);motesGeo.setAttribute('position',new THREE.Float32BufferAttribute(motes,3));
  const dust=new THREE.Points(motesGeo,new THREE.PointsMaterial({color:'#ffe8a6',size:.045,transparent:true,opacity:.55,depthWrite:false}));scene.add(dust);
  renderer.compile(scene,camera);
  let width=0,height=0,ratio=0;
  function draw(ctx,options){
    if(lost)return false;
    const {width:w,height:h,time,level,reduced,quality}=options;
    const desiredRatio=clamp(quality<.65?.85:Math.min(devicePixelRatio||1,1.4),.75,1.4);
    if(w!==width||h!==height||desiredRatio!==ratio){width=w;height=h;ratio=desiredRatio;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    const t=reduced?0:time;
    waterMaterial.uniforms.time.value=t;dust.position.y=Math.sin(t*.12)*.18;
    camera.position.x=reduced?0:Math.sin(t*.025)*.10;camera.lookAt(.1,1.4,-12);
    renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,w,h);return true;
  }
  function dispose(){
    const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
    materials.forEach(m=>{for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());water.dispose();renderer.dispose();
  }
  return {draw,dispose,stats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
}
