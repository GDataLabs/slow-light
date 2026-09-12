(() => {
  const $=id=>document.getElementById(id);
  let job=null,url=null,busy=false,generation=0,controller,dispose,closeWait=[];
  const status=text=>$('worldStatus').textContent=text;
  const call=async body=>{
    const r=await fetch(window.SLOWLIGHT_PUBLIC?.world||'/api/orb-world',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    const data=await r.json();if(!r.ok)throw Error(data.error||'World creation is unavailable.');return data;
  };
  const world=window.OrbWorld={active:false,waitUntilClosed(){return this.active?new Promise(r=>closeWait.push(r)):Promise.resolve();},close(){
    this.active=false;controller?.abort();dispose?.();dispose=null;$('worldView').hidden=true;
    document.body.classList.remove('world-active');closeWait.splice(0).forEach(r=>r());$('worldEnter').focus();
  }};
  document.addEventListener('DOMContentLoaded',()=>{
    $('worldCreate').onclick=async()=>{
      if(busy||url)return;
      const current=++generation;busy=true;$('worldCreate').disabled=true;
      try{
        if(!job){const snapshot=window.OrbVisual.snapshot();status('Creating your 3D place. You can keep talking while it grows…');job=(await call({action:'submit',...snapshot})).ticket;}
        const started=Date.now();
        while(current===generation && Date.now()-started<10*60000){
          const result=await call({action:'status',ticket:job});
          if(result.status==='READY'){url=result.url;status('Your place is ready to explore.');$('worldEnter').hidden=false;return;}
          await new Promise(r=>setTimeout(r,5000));
        }
        status('Still creating. Check again in a moment.');
      }catch(e){status(e.message);}finally{busy=false;$('worldCreate').disabled=!!url;$('worldCreate').textContent=job?'Check world progress':'Create my 3D place';}
    };
    $('worldEnter').onclick=async()=>{
      if(!url||world.active)return;world.active=true;controller=new AbortController();
      const opening=controller;
      $('worldView').hidden=false;document.body.classList.add('world-active');
      window.dispatchEvent(new Event('orb-world-enter'));$('worldLoading').textContent='Opening your place…';
      try{
        const {mount}=await import('./orb-world-viewer.js');
        if(opening.signal.aborted)return;
        dispose=await mount($('worldView'),url,opening.signal);
        $('worldLoading').textContent='WASD / arrows to move · drag to look · hold a direction below';$('worldExit').focus();
      }catch(e){if(opening.signal.aborted)return;world.close();status('The 3D view could not load on this device. Your video is still here.');}
    };
    $('worldExit').onclick=()=>world.close();
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&world.active)world.close();});
  });
  window.addEventListener('pagehide',()=>{generation++;world.close();});
})();
