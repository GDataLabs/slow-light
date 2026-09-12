const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function fixture({failPoll=false}={}) {
  const scheduled=new Set(),submissions=[],nodes=new Map();let plays=0,polls=0;
  const later=(fn,ms=0)=>{const t=setTimeout(()=>{scheduled.delete(t);fn();},ms<=1200?1:ms);scheduled.add(t);return t;};
  const node=()=>({hidden:false,textContent:'',classList:{add(){},remove(){},contains(){return false;}},style:{},setAttribute(){},click(){this.onclick?.();},appendChild(){}});
  const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  class Video {
    constructor(){Object.assign(this,node());this.duration=5;this.videoWidth=854;this.videoHeight=480;this.events={};this.ended=false;}
    load(){if(this.src)queueMicrotask(()=>{this.onloadeddata?.();this.oncanplay?.();});}
    set currentTime(t){this.time=t;queueMicrotask(()=>this.onseeked?.());}
    addEventListener(name,fn){this.events[name]=fn;}
    removeEventListener(name){delete this.events[name];}
    play(){plays++;this.ended=false;later(()=>{this.ended=true;this.events.ended?.();},1);return Promise.resolve();}
    pause(){} removeAttribute(){this.src='';} remove(){}
  }
  const document={hidden:false,body:node(),getElementById:get,addEventListener(){},createElement(tag){return tag==='video'?new Video():{width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,/9j/AA=='};}};
  const context=vm.createContext({window:{},document,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},setTimeout:later,clearTimeout,AbortController,AbortSignal,
    fetch:async (_url,options)=>{
      const body=JSON.parse(options.body);
      if(body.action==='submit'){submissions.push(body);return {ok:true,json:async()=>({ticket:'job-'+submissions.length,duration:5})};}
      if(body.action==='cancel')return {ok:true,json:async()=>({})};
      polls++;if(failPoll&&polls===2)throw Error('temporary network outage');
      return {ok:true,json:async()=>({status:'COMPLETED',url:'https://example.com/'+body.ticket+'.mp4',continuity:'continuity-'+body.ticket})};
    }});
  vm.runInContext(fs.readFileSync('orb-visual.js','utf8'),context);
  const view=context.window.OrbVisual;
  return {view,submissions,get,plays:()=>plays,cleanup(){view.stop();for(const t of scheduled)clearTimeout(t);}};
}
async function until(fn){const end=Date.now()+2000;while(!fn()){if(Date.now()>end)throw Error('Sequence did not advance');await new Promise(r=>setTimeout(r,5));}}
test('three clips chain automatically, retain endpoints and accept new conversation direction',async()=>{
  const f=fixture();try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.plays()>=1);
    f.view.update('new feeling');f.view.finish();
    await until(()=>f.plays()>=3);
    assert.equal(f.submissions[0].continuity,undefined);
    assert.equal(f.submissions[1].continuity,'continuity-job-1');
    assert.equal(f.submissions[2].continuity,'continuity-job-2');
    assert.match(f.submissions[2].frame,/^data:image\/jpeg/);
    assert.equal(f.submissions[2].ticket,'new feeling');
  }finally{f.cleanup();}
});
test('a transient status failure retries the existing job without duplicate submission',async()=>{
  const f=fixture({failPoll:true});try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.plays()>=2);
    assert.equal(f.submissions[1].continuity,'continuity-job-1');
    assert.ok(f.plays()>=2);
  }finally{f.cleanup();}
});
test('scene checkpoint resolves only when its own requested clip is displayed',async()=>{
  const f=fixture();try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.plays()>=1);
    f.view.update('confirmed sunrise');
    const displayed=await f.view.waitFor('confirmed sunrise');
    assert.equal(displayed,true);
    assert.ok(f.submissions.some(s=>s.ticket==='confirmed sunrise'));
  }finally{f.cleanup();}
});
test('stopping releases a waiting conversation checkpoint',async()=>{
  const f=fixture();try{
    f.view.start({enabled:true});
    const waiting=f.view.waitFor('not yet generated');f.view.stop();
    assert.equal(await waiting,false);
  }finally{f.cleanup();}
});
