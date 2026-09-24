const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function fixture({failPoll=false,manualFrames=false,holdContinuation=false,failFirstSubmit=false,failDrift=false}={}) {
  const scheduled=new Set(),submissions=[],cancels=[],nodes=new Map(),playback=[];let plays=0,polls=0,attempts=0;
  const later=(fn,ms=0)=>{const t=setTimeout(()=>{scheduled.delete(t);fn();},ms<=1200?1:ms);scheduled.add(t);return t;};
  const node=()=>({hidden:false,textContent:'',classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);},contains(v){return this.values.has(v);}},style:{},remove(){},setAttribute(){},click(){this.onclick?.();},children:[],appendChild(child){this.children.push(child);}});
  const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  class Video {
    constructor(){Object.assign(this,node());this.duration=5;this.videoWidth=854;this.videoHeight=480;this.events={};this.ended=false;
      if(manualFrames){this.requestVideoFrameCallback=fn=>{this.firstFrame=fn;return 1;};this.cancelVideoFrameCallback=()=>{};}
    }
    load(){if(this.src)queueMicrotask(()=>{this.onloadeddata?.();this.oncanplay?.();});}
    set currentTime(t){this.time=t;queueMicrotask(()=>this.onseeked?.());}
    addEventListener(name,fn){this.events[name]=fn;}
    removeEventListener(name){delete this.events[name];}
    play(){plays++;playback.push(this);this.ended=false;if(!manualFrames)later(()=>{this.ended=true;this.events.ended?.();this.onended?.();},1);return Promise.resolve();}
    pause(){} removeAttribute(){this.src='';} remove(){}
  }
  const document={hidden:false,body:node(),getElementById:get,addEventListener(){},createElement(tag){return tag==='video'?new Video():tag==='img'?node():{width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,/9j/AA=='};}};
  const context=vm.createContext({window:{},document,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},setTimeout:later,clearTimeout,AbortController,AbortSignal,
    fetch:async (_url,options)=>{
      const body=JSON.parse(options.body);
      if(body.action==='submit'){if(failDrift && body.drift)return {ok:false,status:429,json:async()=>({error:'Visuals are resting.'})};if(failFirstSubmit && ++attempts===1)return {ok:false,status:503,json:async()=>({error:'Living visuals are not connected yet.'})};submissions.push(body);return {ok:true,json:async()=>({ticket:'job-'+submissions.length,duration:5})};}
      if(body.action==='cancel'){cancels.push(body.ticket);}if(body.action==='cancel')return {ok:true,json:async()=>({})};
      if(holdContinuation && submissions.length>1)return {ok:true,json:async()=>({status:'PENDING'})};
      polls++;if(failPoll&&polls===2)throw Error('temporary network outage');
      return {ok:true,json:async()=>({status:'COMPLETED',url:'https://example.com/'+body.ticket+'.mp4',continuity:'continuity-'+body.ticket})};
    }});
  vm.runInContext(fs.readFileSync('orb-visual.js','utf8'),context);
  const view=context.window.OrbVisual;
  return {view,submissions,cancels,get,playback,plays:()=>plays,cleanup(){view.stop();for(const t of scheduled)clearTimeout(t);}};
}
async function until(fn){const end=Date.now()+2000;while(!fn()){if(Date.now()>end)throw Error('Sequence did not advance');await new Promise(r=>setTimeout(r,5));}}
test('playback reports the exact displayed ticket so ambience follows the visible clip',async()=>{
  const f=fixture(),shown=[];
  try{
    f.view.start({enabled:true,onShow:ticket=>shown.push(ticket)});
    f.view.update('water');await until(()=>shown.includes('water'));
    f.view.update('clouds');await until(()=>shown.includes('clouds'));
    assert.equal(shown[0],'water');assert.equal(shown.at(-1),'clouds');
  }finally{f.cleanup();}
});
test('with flow off, clips follow requested changes only and retain endpoints',async()=>{
  const f=fixture();try{
    f.view.start({enabled:true});f.view.flow=false;f.view.update('opening');
    await until(()=>f.plays()>=1);
    f.view.update('new feeling');f.view.finish();
    assert.equal(await f.view.waitFor('new feeling'),true);
    await new Promise(r=>setTimeout(r,30));
    assert.equal(f.submissions.length,2,'finishing and reflecting must not buy extra clips');
    f.view.update('new feeling');
    await new Promise(r=>setTimeout(r,30));
    assert.equal(f.submissions.length,2,'the displayed request must not be generated twice');
    f.view.update('warmer light');
    assert.equal(await f.view.waitFor('warmer light'),true);
    assert.equal(f.submissions[0].continuity,undefined);
    assert.equal(f.submissions[1].continuity,'continuity-job-1');
    assert.equal(f.submissions[2].continuity,'continuity-job-2');
    assert.match(f.submissions[2].frame,/^data:image\/jpeg/);
    assert.equal(f.submissions[2].ticket,'warmer light');
  }finally{f.cleanup();}
});
test('a transient status failure retries the existing job without duplicate submission',async()=>{
  const f=fixture({failPoll:true});try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.plays()>=1);
    f.view.update('next');
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

test('a slow next generation keeps the scene moving over its held final frame, never black or frozen',async()=>{
  const f=fixture({holdContinuation:true});
  try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.playback[0]?.loopPass);
    const first=f.playback[0],hold=f.get('backdrop').children[0];
    assert.ok(hold.classList.contains('on'));
    assert.match(hold.src,/^data:image\/jpeg/);
    assert.equal(first.time,0,'the clip restarts rather than freezing');
    assert.equal(first.playbackRate,.8);
    await until(()=>first.style.opacity==='');
    assert.ok(f.playback.filter(v=>v===first).length>=2);
    assert.equal(f.view.showing,true);
  }finally{f.cleanup();}
});
test('replacement is not shown or reported until its first decoded frame',async()=>{
  const f=fixture({manualFrames:true}),shown=[];
  try{
    f.view.start({enabled:true,onShow:ticket=>shown.push(ticket)});f.view.update('opening');
    await until(()=>f.playback.length===1);
    assert.equal(f.view.showing,false);assert.equal(shown.length,0);
    f.playback[0].firstFrame();await until(()=>shown.length===1);
    f.playback[0].ended=true;f.playback[0].events.ended?.();f.playback[0].onended();
    const hold=f.get('backdrop').children[0];
    f.view.update('next');
    await until(()=>f.playback.length===2);
    assert.ok(hold.classList.contains('on'));assert.equal(shown.length,1);
    assert.equal(f.playback[1].classList.contains('on'),false);
    f.playback[1].firstFrame();await until(()=>shown.length===2);
    assert.equal(f.playback[1].classList.contains('on'),true);
  }finally{f.cleanup();}
});
test('video journey builds its fallback without a full-screen black veil',async()=>{
  const html=fs.readFileSync('orb.html','utf8');let built=0,cleared=0;
  const start=html.indexOf('function fadeSwap(build){');const end=html.indexOf('\nfunction ',start+10);
  const code=html.slice(start,end);
  const context=vm.createContext({window:{OrbVisual:{enabled:true,showing:true}},T:null,clearScene:()=>cleared++,Promise,
    document:{createElement(){throw Error('A black veil should not be created');}}});
  vm.runInContext(code,context);await context.fadeSwap(()=>built++);
  assert.equal(built,1);assert.equal(cleared,1);
});

test('native sound follows the displayed video and respects mute and narration duck',async()=>{
  const f=fixture({manualFrames:true});
  try{
    f.view.start({enabled:true});f.view.setAudio({enabled:true});f.view.update('opening');
    await until(()=>f.playback.length===1);
    const first=f.playback[0];assert.equal(first.muted,true);
    first.firstFrame();await until(()=>f.view.showing);
    assert.equal(first.muted,false);assert.equal(first.volume,.22);
    f.view.setAudio({ducked:true});assert.equal(first.volume,.045);
    f.view.setAudio({muted:true});assert.equal(first.muted,true);
    f.view.setAudio({muted:false,ducked:false});assert.equal(first.muted,false);
    first.ended=true;first.events.ended?.();first.onended();
    f.view.update('next');
    await until(()=>f.playback.some(v=>v!==first));
    const next=f.playback.find(v=>v!==first);assert.equal(next.muted,true);
    next.firstFrame();await until(()=>next.muted===false);
    assert.equal(first.muted,true);assert.equal(first.volume,0);
    f.view.setAudio({enabled:false});assert.equal(next.muted,true);
  }finally{f.cleanup();}
});

test('video failure reaches waiting UI with an honest no-video message and can be retried',async()=>{
  const f=fixture({failFirstSubmit:true}),messages=[];
  try{
    f.view.start({enabled:true});const unsubscribe=f.view.subscribe(text=>messages.push(text));f.view.update('opening');
    assert.equal(await f.view.waitFor('opening'),false);
    assert.equal(f.view.failed,true);assert.equal(f.view.showing,false);
    assert.match(f.view.message,/No video has appeared yet/);assert.match(messages.at(-1),/not connected/);
    assert.equal(f.view.retry(),true);assert.equal(await f.view.waitFor('opening'),true);
    assert.equal(f.view.showing,true);unsubscribe();
  }finally{f.cleanup();}
});

test('between answers the place keeps flowing: each clip is continued from its final frame',async()=>{
  const f=fixture();try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.submissions.length>=3);
    assert.equal(f.submissions[0].drift,undefined);
    assert.equal(f.submissions[1].ticket,'opening');assert.equal(f.submissions[1].drift,true);
    assert.equal(f.submissions[1].continuity,'continuity-job-1');
    assert.equal(f.submissions[2].continuity,'continuity-job-2');
    assert.match(f.submissions[2].frame,/^data:image\/jpeg/);
    assert.match(f.view.message,/keeps moving/);
  }finally{f.cleanup();}
});
test('a new answer takes priority over a drift clip that is still generating',async()=>{
  const f=fixture({holdContinuation:true});try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.submissions.length>=2 && f.submissions[1].drift);
    await new Promise(r=>setTimeout(r,20));
    f.view.update('clouds');
    await until(()=>f.submissions.some(s=>s.ticket==='clouds'));
    assert.deepEqual(f.cancels,['job-2'],'the pending drift job is cancelled');
    const next=f.submissions.find(s=>s.ticket==='clouds');
    assert.equal(next.drift,undefined);assert.equal(next.continuity,'continuity-job-1');
  }finally{f.cleanup();}
});
test('closing stops buying drift clips; the last scene loops',async()=>{
  const f=fixture();try{
    f.view.start({enabled:true});f.view.update('opening');f.view.finish();
    await until(()=>f.plays()>=3);
    await new Promise(r=>setTimeout(r,30));
    assert.equal(f.submissions.length,1);
    assert.ok(f.playback.every(v=>v===f.playback[0]),'only the one clip replays');
  }finally{f.cleanup();}
});
test('a failed drift clip never interrupts the person or shows retry; the view keeps looping',async()=>{
  const f=fixture({failDrift:true});try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>/holding this place/.test(f.view.message));
    assert.equal(f.view.failed,false);
    f.view.update('clouds');assert.equal(await f.view.waitFor('clouds'),true,'the next answer still makes its clip');
  }finally{f.cleanup();}
});
test('only the person\'s own pause can stop the playing scene',async()=>{
  const f=fixture({manualFrames:true});try{
    f.view.start({enabled:true});f.view.update('opening');
    await until(()=>f.playback.length===1);
    const first=f.playback[0];first.firstFrame();await until(()=>f.view.showing);
    const before=f.plays();first.paused=true;first.events.pause();
    await until(()=>f.plays()>before);
    f.get('livingPause').click();const after=f.plays();first.events.pause();
    await new Promise(r=>setTimeout(r,20));assert.equal(f.plays(),after);
  }finally{f.cleanup();}
});
