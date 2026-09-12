import * as THREE from 'three';
import {SparkRenderer,SplatMesh} from 'https://sparkjs.dev/releases/spark/2.1.0/spark.module.js';
export async function mount(host,url,signal){
  const renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.05,100);
  const spark=new SparkRenderer({renderer});scene.add(spark);
  const splats=new SplatMesh({url});scene.add(splats);
  let disposed=false,drag=null,yaw=0,pitch=0,last=performance.now();
  const keys=new Set(),listeners=[];
  const listen=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
  const clear=()=>keys.clear();
  const dispose=()=>{
    if(disposed)return;disposed=true;renderer.setAnimationLoop(null);listeners.forEach(f=>f());
    splats.dispose();spark.dispose?.();renderer.dispose();renderer.domElement.remove();
  };
  signal.addEventListener('abort',dispose,{once:true});
  try{
    await splats.initialized;
    if(signal.aborted){dispose();throw Error('Closed');}
    host.prepend(renderer.domElement);
    const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};
    resize();listen(window,'resize',resize);listen(window,'blur',clear);
    listen(document,'visibilitychange',clear);
    const moves=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
    listen(window,'keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(moves.includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase());}});
    listen(window,'keyup',e=>keys.delete(e.key.toLowerCase()));
    const cv=renderer.domElement;cv.style.touchAction='none';
    listen(cv,'pointerdown',e=>{drag={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId);});
    listen(cv,'pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.003;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag.y)*.003,-.8,.8);drag={x:e.clientX,y:e.clientY};});
    listen(cv,'pointerup',()=>drag=null);listen(cv,'pointercancel',()=>drag=null);
    host.querySelectorAll('[data-move]').forEach(button=>{
      listen(button,'pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.move);});
      for(const ev of ['pointerup','pointercancel','lostpointercapture'])listen(button,ev,()=>keys.delete(button.dataset.move));
    });
    renderer.setAnimationLoop(()=>{
      const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
      if(document.hidden)return;
      const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      const z=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
      const step=new THREE.Vector3(x,0,z).normalize().multiplyScalar(dt*.65).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
      camera.position.add(step);
      // Keep exploration near the source viewpoint; reset is always available.
      if(camera.position.length()>3)camera.position.setLength(3);
      camera.rotation.set(pitch,yaw,0,'YXZ');renderer.render(scene,camera);
    });
    listen(host.querySelector('[data-reset]'),'click',()=>{camera.position.set(0,0,0);yaw=pitch=0;clear();});
    return dispose;
  }catch(e){dispose();throw e;}
}
