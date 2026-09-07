/* Keep the illustrated rooms available while loading or if WebGL fails. */
window.Scenes3D={state:'idle',instance:null,generation:0,
  load(){
    if(this.state!=='idle')return;
    this.state='loading';const generation=++this.generation;
    import('./scenes-3d.js').then(m=>m.createScenes()).then(instance=>{
      if(this.generation!==generation){instance.dispose();return;}
      this.instance=instance;this.state='ready';
    }).catch(error=>{if(this.generation!==generation)return;this.state='fallback';console.warn('Using illustrated scenery.',error);});
  },
  release(){this.generation++;this.state='idle';this.instance?.dispose();this.instance=null;},
  draw(ctx,room,progress,clearing,weather,hue){
    G.cv.dataset.sceneRenderer='illustrated';
    if(App.simple||!document.getElementById('opt3D').checked)return false;
    if(this.state==='idle')this.load();
    if(this.state!=='ready')return false;
    try{
      const ok=this.instance.draw(ctx,{room,progress,clearing,weather,hue,width:G.W,height:G.H,time:G.t,level:G.breath.level,reduced:REDUCED,quality:G.quality});
      if(!ok){this.instance.dispose();this.instance=null;this.state='fallback';}
      G.cv.dataset.sceneRenderer=ok?'3d':'illustrated';return ok;
    }catch(error){this.instance?.dispose();this.instance=null;this.state='fallback';return false;}
  }
};
window.addEventListener('pagehide',()=>Scenes3D.release());
