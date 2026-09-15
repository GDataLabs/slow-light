const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(file,'utf8');

test('spoken scene confirmations accept explicit choices and leave ambiguous replies pending',()=>{
  const c=vm.createContext({});vm.runInContext(read('orb-choices.js'),c);
  const choices=['Yes, that’s close','Let me change that','Let’s stay here'];
  for(const text of ['yes','That’s correct.','that feels right'])assert.equal(c.OrbChoices.match(text,choices),0);
  for(const text of ['no','not quite','change that please'])assert.equal(c.OrbChoices.match(text,choices),1);
  assert.equal(c.OrbChoices.match('stay here',choices),2);
  for(const text of ['yes but no','not sure','yes change it','I said yes before',''])assert.equal(c.OrbChoices.match(text,choices),-1);
  assert.equal(c.OrbChoices.match('continue',['Wait for my scene','Continue with this view']),1);
  assert.equal(c.OrbChoices.match('continue',['I’m ready to continue']),0);
});

function server(env,upstream){
  const c=vm.createContext({module:{exports:{}},require,Buffer,URL,AbortSignal,process:{env},console:{warn(){}},fetch:upstream});
  vm.runInContext(read('api/orb-live.js'),c);
  return async(body,origin='https://example.com',method='POST')=>{
    const result={headers:{}};
    await c.module.exports({method,headers:{host:'example.com',origin},body}, {setHeader(k,v){result.headers[k]=v;},status(code){result.code=code;return this;},json(body){result.body=body;}});return result;
  };
}
test('Gemini tokens constrain the model, expire quickly, and never expose the project key',async()=>{
  let payload,headers,calls=0;
  const request=server({GEMINI_API_KEY:'private-project-key',ORB_GEMINI_LIVE_ENABLED:'true'},async(url,options)=>{
    calls++; assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/auth_tokens');payload=JSON.parse(options.body);headers=options.headers;
    return {ok:true,json:async()=>({name:'temporary-token'})};
  });
  const availability=await request(null,undefined,'GET');assert.equal(availability.body.providers.gemini,true);assert.equal(availability.body.providers.openai,false);
  assert.equal((await request({action:'start',provider:'gemini'},'https://other.test')).code,403);assert.equal(calls,0);
  const result=await request({action:'start',provider:'gemini',model:'untrusted-model'});
  assert.equal(result.code,201);assert.equal(result.body.token,'temporary-token');assert.equal(headers['x-goog-api-key'],'private-project-key');
  assert.equal(payload.uses,1);assert.equal(payload.bidiGenerateContentSetup.model,'models/gemini-3.1-flash-live-preview');
  assert.ok(Date.parse(payload.expireTime)-Date.now()<=240000);assert.ok(Date.parse(payload.newSessionExpireTime)-Date.now()<=60000);
  assert.equal(payload.bidiGenerateContentSetup.generationConfig.responseModalities[0],'AUDIO');
  assert.doesNotMatch(JSON.stringify(result),/private-project-key/);
});
test('GPT credit exhaustion is actionable instead of being called a temporary rate limit',async()=>{
  const request=server({OPENAI_API_KEY:'private',ORB_LIVE_ENABLED:'true'},async()=>({ok:false,status:429,json:async()=>({error:{code:'credit_balance_exhausted'}})}));
  const result=await request({action:'start',sdp:'v=0'});
  assert.match(result.body.error,/Add credits to that project/);assert.doesNotMatch(result.body.error,/temporarily limited/);
});
test('unconfigured Gemini never contacts the provider',async()=>{
  const request=server({},async()=>{throw Error('Must not fetch');});
  assert.equal((await request({action:'start',provider:'gemini'})).code,503);
});

function geminiFixture(){
  const timers=new Map(),sent=[],tracks=[{enabled:true,stop(){this.stopped=true;},addEventListener(){}}];let next=0;
  class AC {
    constructor(){this.state='running';this.sampleRate=16000;this.currentTime=0;this.destination={};this.audioWorklet={addModule:async()=>{}};}
    resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createBuffer(channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};}
  }
  class WS {constructor(){this.readyState=1;}send(data){sent.push(JSON.parse(data));}close(){this.closed=true;}}
  const c=vm.createContext({Date,AbortSignal,AbortController,AudioContext:AC,WebSocket:WS,
    AudioWorkletNode:class{constructor(){this.port={};}connect(){}disconnect(){}},
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>tracks,getAudioTracks:()=>tracks})}},
    btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id),
    fetch:async()=>({ok:true,json:async()=>({token:'temporary',setup:{model:'models/gemini-3.1-flash-live-preview',generationConfig:{responseModalities:['AUDIO']},inputAudioTranscription:{}}})})});
  vm.runInContext(read('orb-live.js'),c);vm.runInContext(read('orb-gemini.js'),c);
  return {live:new c.OrbLive.GeminiConnection({guard:()=> 'ok'}),sent,tracks,timers};
}
test('Gemini waits for setup, streams PCM, handles interruption, and releases all audio on close',async()=>{
  const f=geminiFixture();await f.live.start();f.live.socket.onopen();
  assert.equal(f.sent[0].setup.generationConfig.responseModalities[0],'AUDIO');assert.equal(f.live.state,'connecting');
  f.live.capture.port.onmessage({data:new Float32Array(2048)});assert.equal(f.sent.length,1);
  f.live.receiveGemini({setupComplete:{}});assert.equal(f.live.state,'active');
  f.live.capture.port.onmessage({data:new Float32Array(2048)});assert.equal(f.sent.at(-1).realtimeInput.audio.mimeType,'audio/pcm;rate=16000');
  f.live.receiveGemini({serverContent:{inputTranscription:{text:'I feel calm'},modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]}}});
  assert.equal(f.live.text('input'),'I feel calm');const source=[...f.live.sources][0];assert.ok(source);
  f.live.receiveGemini({serverContent:{interrupted:true}});assert.equal(source.stopped,true);assert.equal(f.live.sources.size,0);
  f.live.mute();const count=f.sent.length;f.live.capture.port.onmessage({data:new Float32Array(2048)});assert.equal(f.sent.length,count);
  await f.live.close();assert.equal(f.tracks[0].stopped,true);assert.equal(f.live.context.state,'closed');assert.equal(f.live.socket.closed,true);assert.equal(f.timers.size,0);
  f.live.receiveGemini({setupComplete:{}});assert.equal(f.live.state,'closed');
});
test('Gemini closes at the time limit even without a review UI callback',async()=>{
  const f=geminiFixture();await f.live.start();f.live.receiveGemini({setupComplete:{}});
  [...f.timers.values()].find(t=>t.ms===180000).fn();assert.equal(f.live.state,'closed');assert.equal(f.tracks[0].stopped,true);
});
