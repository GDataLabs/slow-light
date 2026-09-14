const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('orb.html','utf8');
function voiceFixture(){
  const nodes=new Map();let attempts=0,browser=0;
  const context={VoiceCfg:{load:()=>({engine:'eleven'})},elReady:()=>true,
    Eleven:{voiceId:()=> 'preferred',say:async()=>{if(++attempts===1)throw Error('ElevenLabs is busy.');},stop(){}},
    $:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};
  vm.createContext(context);
  const start=html.indexOf('const Voice = {'),end=html.indexOf('\n};',start)+3;
  vm.runInContext(html.slice(start,end)+';globalThis.voice=Voice;',context);
  context.voice.browserSay=async()=>{browser++;};
  return {voice:context.voice,nodes,attempts:()=>attempts,browser:()=>browser};
}
test('preferred voice failure waits for explicit choice and retry preserves the voice',async()=>{
  const f=voiceFixture(),pending=f.voice.say('Welcome');await new Promise(r=>setImmediate(r));
  assert.equal(f.browser(),0);assert.equal(f.nodes.get('#voiceRecovery').hidden,false);
  assert.match(f.nodes.get('#voiceError').textContent,/ElevenLabs is busy/);
  f.nodes.get('#voiceRetry').onclick();await pending;
  assert.equal(f.attempts(),2);assert.equal(f.browser(),0);assert.equal(f.nodes.get('#voiceRecovery').hidden,true);
});
test('browser speech requires a deliberate choice and applies only to this visit',async()=>{
  const f=voiceFixture(),pending=f.voice.say('Welcome');await new Promise(r=>setImmediate(r));
  f.nodes.get('#voiceBrowser').onclick();await pending;await f.voice.say('Next');
  assert.equal(f.browser(),2);assert.equal(f.voice.cfg.engine,'eleven');assert.equal(f.attempts(),1);
});
test('stopping during voice recovery releases the guide without browser speech',async()=>{
  const f=voiceFixture(),pending=f.voice.say('Welcome');await new Promise(r=>setImmediate(r));
  f.voice.stop();await pending;assert.equal(f.browser(),0);assert.equal(f.nodes.get('#voiceRecovery').hidden,true);
});
test('blocked preferred audio rejects and releases its media resources',async()=>{
  const revoked=[],audio=[];
  const context={setTimeout,clearTimeout,URL:{createObjectURL:()=> 'blob:voice',revokeObjectURL:u=>revoked.push(u)},
    Audio:class{constructor(){audio.push(this);}play(){return Promise.reject(Error('NotAllowedError'));}pause(){this.paused=true;}}};
  vm.createContext(context);
  const start=html.indexOf('const Eleven = {'),end=html.indexOf('\n};',start)+3;
  vm.runInContext(html.slice(start,end)+';globalThis.eleven=Eleven;',context);
  await assert.rejects(context.eleven.play({}),/browser blocked/);
  assert.deepEqual(revoked,['blob:voice']);assert.equal(audio[0].paused,true);assert.equal(context.eleven.audio,null);
});
