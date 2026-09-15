/* A session-only reference photo. No camera access until the visitor asks. */
(function(root){
  'use strict';
  let stream=null, epoch=0, draft=null, reference=null;
  const $=id=>document.getElementById(id);
  function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('portraitCamera').srcObject=null;}
  function close(){epoch++;stopCamera();draft=null;$('portraitDraft').removeAttribute('src');$('portraitDialog').close();}
  async function open(){
    const current=++epoch;stopCamera();draft=null;
    $('portraitDraft').hidden=true;$('portraitDraft').removeAttribute('src');$('portraitCamera').hidden=false;
    $('portraitCapture').hidden=false;$('portraitCapture').disabled=true;$('portraitUse').hidden=true;$('portraitRetake').hidden=true;
    $('portraitStatus').textContent='Opening your camera…';
    if(!$('portraitDialog').open)$('portraitDialog').showModal();
    try{
      const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:1280}},audio:false});
      if(current!==epoch){camera.getTracks().forEach(t=>t.stop());return;}
      stream=camera;$('portraitCamera').srcObject=camera;
      await $('portraitCamera').play();
      if(current!==epoch)return;
      $('portraitCapture').disabled=false;$('portraitStatus').textContent='Find comfortable light and look toward the camera. Take the photo when you’re ready.';
      camera.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(current===epoch){$('portraitCapture').disabled=true;$('portraitRetake').hidden=false;$('portraitStatus').textContent='The camera stopped. You can try again.';}}));
    }catch{
      if(current!==epoch)return;stopCamera();$('portraitRetake').hidden=false;
      $('portraitStatus').textContent='The camera couldn’t open. Allow camera access in your browser, then try again. You can also continue without a photo.';
    }
  }
  function capture(){
    const video=$('portraitCamera');if(!stream || !video.videoWidth)return;
    const canvas=document.createElement('canvas'),scale=Math.min(1,768/Math.max(video.videoWidth,video.videoHeight));
    canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    draft=canvas.toDataURL('image/jpeg',.8);
    if(draft.length>450000)draft=canvas.toDataURL('image/jpeg',.5);
    if(draft.length>450000){draft=null;$('portraitStatus').textContent='That photo is too large. Please try again.';return;}
    epoch++;stopCamera();$('portraitCamera').hidden=true;$('portraitDraft').src=draft;$('portraitDraft').hidden=false;
    $('portraitCapture').hidden=true;$('portraitCapture').disabled=true;$('portraitUse').hidden=false;$('portraitRetake').hidden=false;
    $('portraitStatus').textContent='Camera off. Does this look like the reference you want to use?';
  }
  function clear(){
    reference=null;$('portraitSelected').removeAttribute('src');$('portraitSelected').hidden=true;$('portraitRemove').hidden=true;
    $('portraitSummary').textContent='No reference photo selected.';
  }
  root.OrbPortrait={get reference(){return reference;},stopCamera:close,clear};
  $('portraitOpen').onclick=open;$('portraitRetake').onclick=open;$('portraitCapture').onclick=capture;
  $('portraitCancel').onclick=close;$('portraitDialog').addEventListener('cancel',event=>{event.preventDefault();close();});
  $('portraitUse').onclick=()=>{
    if(!draft)return;reference=draft;$('portraitSelected').src=reference;$('portraitSelected').hidden=false;
    $('portraitRemove').hidden=false;$('portraitSummary').textContent='Your photo is ready for this visit. You can remove or retake it.';
    $('livingOptIn').checked=true;close();
  };
  $('portraitRemove').onclick=clear;
  $('portraitStop').onclick=()=>{root.OrbVisual.stop();clear();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden && $('portraitDialog').open)close();});
  root.addEventListener('pagehide',()=>{close();clear();});
})(window);
