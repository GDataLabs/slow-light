const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('orb.html','utf8');
function fixture(){
  const pending=new Map(),audio=[],revoked=[];
  const mixes=[];
  const context={window:{OrbVisual:{setAudio:state=>mixes.push(state)}},Voice:{cfg:{ambience:true}},elReady:()=>true,AbortController,AbortSignal,
    TTSCache:{get:key=>new Promise(resolve=>pending.set(key,resolve)),put(){}},
    Audio:class{constructor(src){this.src=src;this.paused=true;audio.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}},
    URL:{createObjectURL:b=>b.name,revokeObjectURL:u=>revoked.push(u)},
    setInterval:()=>1,clearInterval(){},$:()=>({classList:{add(){},toggle(){}}})};
  vm.createContext(context);
  const start=html.indexOf('const AMBIENCE=');
  const end=html.indexOf('  /* ---- generated backdrops',start);
  vm.runInContext(html.slice(start,end)+'};globalThis.media=Media;',context);
  return {media:context.media,pending,audio,revoked,context,mixes};
}
test('water stops when the cloud clip starts, before replacement sound finishes loading',async()=>{
  const f=fixture();const water=f.media.soundscape('underwater');
  f.pending.get('amb2|underwater')({name:'water'});await water;
  f.media.queueSound('cloud-ticket','sky');
  assert.equal(f.audio[0].paused,false);
  const clouds=f.media.showSound('cloud-ticket');assert.equal(f.audio[0].paused,true);
  f.pending.get('amb2|sky')({name:'air'});await clouds;
  assert.equal(f.audio.at(-1).src,'air');assert.deepEqual(f.revoked,['water']);
});
test('late water generation cannot replace a newer sky ambience',async()=>{
  const f=fixture();const water=f.media.soundscape('underwater');const sky=f.media.soundscape('sky');
  f.pending.get('amb2|sky')({name:'air'});await sky;
  f.pending.get('amb2|underwater')({name:'water'});await water;
  assert.equal(f.audio.length,1);assert.equal(f.audio[0].src,'air');
});
test('matching environment does not restart audio on every continuation clip',async()=>{
  const f=fixture();const start=f.media.soundscape('sky');f.pending.get('amb2|sky')({name:'air'});await start;
  f.media.queueSound('next','sky');f.media.showSound('next');
  assert.equal(f.audio.length,1);assert.equal(f.audio[0].paused,false);
});
test('user mute and listening duck survive changes of environment',async()=>{
  const f=fixture();f.media.ambMuted=true;f.media.duck(true);
  const start=f.media.soundscape('sky');f.pending.get('amb2|sky')({name:'air'});await start;
  assert.equal(f.audio[0].paused,true);assert.equal(f.media.ambDucked,true);
  assert.equal(f.mixes.at(-1).ducked,true);assert.equal(f.mixes.at(-1).muted,true);
});
test('unknown ambience leaves silence instead of replaying the previous setting',async()=>{
  const f=fixture();const start=f.media.soundscape('underwater');f.pending.get('amb2|underwater')({name:'water'});await start;
  f.media.queueSound('new','untrusted');f.media.showSound('new');
  assert.equal(f.audio[0].paused,true);assert.equal(f.media.amb,null);
});
