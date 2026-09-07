/* Failure to load 3D never interrupts the breathing exercise. */
window.Garden3D={
  state:'idle',instance:null,error:null,
  load(){
    if(this.state!=='idle')return;
    this.state='loading';
    import('./garden-3d.js').then(m=>m.createGarden()).then(instance=>{if(this.state!=='loading'){instance.dispose();return;}this.instance=instance;this.state='ready';}).catch(error=>{this.state='fallback';this.error=String(error);console.warn('The 3D garden is unavailable; using the illustrated garden.',error);});
  },
  release(){this.state="idle";if(this.instance){this.instance.dispose();this.instance=null;}},
  draw(ctx){
    if(this.state!=='ready'||App.simple||!document.getElementById('opt3D').checked)return false;
    try{
      const ok=this.instance.draw(ctx,{width:G.W,height:G.H,time:G.t,level:G.breath.level,reduced:REDUCED,quality:G.quality});
      if(!ok)this.state='fallback';G.cv.dataset.gardenRenderer=ok?'3d':'illustrated';return ok;
    }catch(error){this.error=String(error);this.state='fallback';this.instance.dispose();return false;}
  }
};

window.addEventListener("pagehide",()=>Garden3D.release());
