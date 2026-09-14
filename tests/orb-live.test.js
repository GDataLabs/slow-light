const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('orb-live.js','utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}) {
  const sent = [], calls = [], timers = new Map(), nodes = new Map(); let next = 0;
  class Target {
    constructor(){ this.events = {}; }
    addEventListener(type, fn){ (this.events[type] ||= new Set()).add(fn); }
    removeEventListener(type, fn){ this.events[type]?.delete(fn); }
    emit(type, event={}){ for(const fn of this.events[type] || []) fn(event); }
  }
  const track = new Target(); track.enabled = true; track.stop = () => { track.stopped = true; };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class Peer extends Target {
    constructor(){ super(); this.iceGatheringState='complete'; this.connectionState='connected'; }
    addTrack(){}
    createDataChannel(label){
      assert.equal(label,'oai-events');
      this.channel = new Target(); this.channel.readyState='open';
      this.channel.send = data => sent.push(JSON.parse(data));
      this.channel.close = () => { this.channel.readyState='closed'; this.channel.emit('close'); };
      return this.channel;
    }
    async createOffer(){ return {type:'offer',sdp:'v=0\r\n'}; }
    async setLocalDescription(offer){ this.localDescription=offer; }
    async setRemoteDescription(answer){ this.answer=answer; }
    close(){this.closed=true;}
  }
  const get = id => {
    if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,value:'',textContent:'',classList:{add(){},remove(){}},setAttribute(){},focus(){}});
    return nodes.get(id);
  };
  const document = new Target(); document.getElementById=get; document.body=get('body');
  const window = new Target(); window.RTCPeerConnection=Peer;
  const context = vm.createContext({window,document,Date,AbortController,AbortSignal,
    navigator:{mediaDevices:{getUserMedia:async()=>stream}},RTCPeerConnection:Peer,MediaStream:class {},
    Audio:class {play(){return Promise.resolve();}pause(){this.paused=true;}},
    setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({sdp:'v=0 answer',ticket:'signed-ticket'})};},
    ...overrides
  });
  vm.runInContext(source,context);
  const live = new window.OrbLive.Connection({guard:()=> 'ok'});
  const emit = (type, rest={}) => live.receive({type,...rest});
  return {live,emit,sent,calls,track,stream,context,timers,get,window,document};
}

test('WebRTC startup waits for session.started and sends a greeting without a second start',async()=>{
  const f=fixture();let connected=0;f.live.options.onConnected=()=>connected++;await f.live.start();
  assert.equal(connected,0);assert.equal(f.sent.length,0);assert.equal(f.live.peer.answer.type,'answer');
  f.emit('session.started',{session:{id:'opaque'}});
  assert.equal(connected,1);assert.equal(f.sent[0].type,'session.instructions.append');assert.equal(f.live.state,'active');
  const closing=f.live.close();assert.equal(f.track.stopped,true);assert.equal(f.live.peer.closed,undefined);
  assert.equal(f.sent.at(-1).type,'session.close');
  f.emit('session.closed',{usage:{seconds:17}});await closing;
  assert.equal(f.live.peer.closed,true);assert.equal(f.live.usage,17);assert.equal(f.live.finalized,true);
});
test('late microphone permission after cancellation stops tracks without opening a connection',async()=>{
  let grant;const f=fixture({navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>grant=r)}}});
  const start=f.live.start();await f.live.close();grant(f.stream);await start;
  assert.equal(f.track.stopped,true);assert.equal(f.live.peer,undefined);assert.equal(f.calls.length,0);
});
test('a session created after cancellation is explicitly hung up',async()=>{
  let respond;const requests=[];
  const f=fixture({fetch:async(url,opts)=>{
    const body=JSON.parse(opts.body);requests.push(body);
    if(body.action==='start')return new Promise(r=>respond=r);
    return {ok:true};
  }});
  const start=f.live.start();await tick();await f.live.close();
  respond({ok:true,json:async()=>({sdp:'answer',ticket:'late-ticket'})});await start;
  assert.equal(requests.at(-1).action,'close');assert.equal(requests.at(-1).ticket,'late-ticket');
  assert.equal(f.live.peer.answer,undefined);assert.equal(f.track.stopped,true);
});
test('transcripts preserve spaces, overlap, ordering and repeated words without duplicate events',()=>{
  const f=fixture();f.live.state='active';
  f.emit('session.input_transcript.delta',{event_id:'b',delta:' very tired.',start_ms:1000,end_ms:1300});
  f.emit('session.output_transcript.delta',{event_id:'c',delta:'I hear you.',start_ms:500,end_ms:1200});
  f.emit('session.input_transcript.delta',{event_id:'a',delta:'I am very',start_ms:0,end_ms:999});
  f.emit('session.input_transcript.delta',{event_id:'a',delta:'I am very',start_ms:0,end_ms:999});
  assert.equal(f.live.text('input'),'I am very very tired.');assert.equal(f.live.text('output'),'I hear you.');
  assert.equal(f.sent.length,0);f.live.dispose();
});
test('split crisis phrases stop both microphone and playback',async()=>{
  const f=fixture();let care=0;f.live.options.guard=text=>text.includes('hurt myself')?'crisis':'ok';f.live.options.onSafety=()=>care++;
  await f.live.start();f.emit('session.started');
  f.emit('session.input_transcript.delta',{delta:'I want to hurt ',start_ms:0,end_ms:100});
  f.emit('session.input_transcript.delta',{delta:'myself',start_ms:100,end_ms:200});
  assert.equal(care,1);assert.equal(f.track.stopped,true);assert.equal(f.live.audio.paused,true);
  f.emit('session.closed');await f.live.close();
});
test('backend reflection is discarded when a correction arrives during delegated work',async()=>{
  let answer;const f=fixture({fetch:()=>new Promise(r=>answer=r)});
  f.live.state='active';f.live.channel={readyState:'open',send:data=>f.sent.push(JSON.parse(data)),close(){}};
  f.emit('session.input_transcript.delta',{delta:'I am sad.',start_ms:0,end_ms:100});
  const pending=f.live.delegate('opaque-item');
  f.emit('session.input_transcript.delta',{delta:' Actually, more angry.',start_ms:120,end_ms:220});
  answer({ok:true,json:async()=>({line:'That sounds sad.',crisis:false})});await pending;
  assert.equal(f.sent.at(-1).type,'session.thinking.append');assert.match(f.sent.at(-1).content,/Discard/);
  assert.equal(f.sent.at(-1).delegation_id,'opaque-item');f.live.dispose();
});
test('closed sessions ignore late backend responses and do not mutate journey state',async()=>{
  let answer;const f=fixture({fetch:()=>new Promise(r=>answer=r)});f.live.state='active';
  f.live.input.push({delta:'Tired',start_ms:0,end_ms:1});
  const pending=f.live.delegate('request');f.live.cleanup();
  answer({ok:true,json:async()=>({line:'A reply',crisis:true})});await pending;
  assert.equal(f.sent.length,0);
});
test('muting changes the actual microphone track while leaving the live session open',async()=>{
  const f=fixture();await f.live.start();f.emit('session.started');
  f.live.mute();assert.equal(f.track.enabled,false);assert.equal(f.live.state,'active');
  f.live.mute();assert.equal(f.track.enabled,true);f.live.dispose();
});
test('missing microphone permission offers recovery without making a paid request',async()=>{
  const denied=Object.assign(new Error('denied'),{name:'NotAllowedError'});
  const f=fixture({navigator:{mediaDevices:{getUserMedia:async()=>{throw denied;}}}});let message;
  f.live.options.onEnded=text=>message=text;await f.live.start();await tick();
  assert.match(message,/permission was not granted/);assert.equal(f.calls.length,0);assert.equal(f.live.state,'closed');
});
test('a failed session request releases capture and exposes a fallback',async()=>{
  const f=fixture({fetch:async()=>({ok:false,json:async()=>({error:'Live voice could not connect.'})})});let message;
  f.live.options.onEnded=text=>message=text;await f.live.start();await tick();
  assert.equal(f.track.stopped,true);assert.equal(f.live.peer.closed,true);assert.match(message,/usual check-in/);
});
test('close timeout uses the signed server hangup and does not claim final usage',async()=>{
  const f=fixture();await f.live.start();f.emit('session.started');
  const closing=f.live.close();const timeout=[...f.timers.values()].find(t=>t.ms===3000);await timeout.fn();await closing;
  assert.equal(f.calls.at(-1).body.action,'close');assert.equal(f.live.hangupConfirmed,true);
  assert.equal(f.live.finalized,false);assert.equal(f.live.peer.closed,true);
});
test('late remote audio during close cannot restart playback',async()=>{
  const f=fixture();await f.live.start();f.emit('session.started');const closing=f.live.close();
  f.live.peer.emit('track',{track:{}});assert.equal(f.live.audio.srcObject,null);
  f.emit('session.closed');await closing;
});
test('review stops capture and waits for explicit edited-word confirmation',async()=>{
  const f=fixture();const promise=f.window.OrbLive.begin({guard:()=> 'ok'});await tick();
  const live=f.window.OrbLive.current;live.receive({type:'session.started'});
  live.receive({type:'session.input_transcript.delta',delta:'I feel tired.',start_ms:0,end_ms:100});
  let settled=false;promise.then(()=>settled=true);
  f.get('orbLiveReview').onclick();await tick();
  assert.equal(f.track.stopped,true);assert.equal(settled,false);assert.equal(f.get('orbLiveWords').value,'I feel tired.');
  live.receive({type:'session.closed',usage:{seconds:12}});
  f.get('orbLiveWords').value='Actually, I feel hopeful.';f.get('orbLiveUse').onclick();
  assert.equal((await promise).words,'Actually, I feel hopeful.');assert.equal(f.get('liveCheckIn').hidden,true);
});
test('hiding the page ends live capture and offers review without advancing',async()=>{
  const f=fixture();const promise=f.window.OrbLive.begin({guard:()=> 'ok'});await tick();
  const live=f.window.OrbLive.current;live.receive({type:'session.started'});
  f.document.hidden=true;f.document.emit('visibilitychange');assert.equal(f.track.stopped,true);
  assert.equal(f.get('orbLiveReviewFields').hidden,false);
  live.receive({type:'session.closed'});f.get('orbLiveFallback').onclick();assert.equal(await promise,null);
});
test('three-minute cap ends the conversation through the review screen',async()=>{
  const f=fixture();const promise=f.window.OrbLive.begin({guard:()=> 'ok'});await tick();
  const live=f.window.OrbLive.current;live.receive({type:'session.started'});
  [...f.timers.values()].find(t=>t.ms===180000).fn();assert.equal(f.track.stopped,true);
  assert.match(f.get('orbLiveStatus').textContent,/three minutes/);
  live.receive({type:'session.closed'});f.get('orbLiveFallback').onclick();await promise;
});
test('orb inline scripts compile with the optional opening branch',()=>{
  for(const match of fs.readFileSync('orb.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});

test('session endpoint fixes startup settings, protects close tickets, validates origins, and hides credentials',async()=>{
  const previous={key:process.env.OPENAI_API_KEY,enabled:process.env.ORB_LIVE_ENABLED,fetch:global.fetch};
  process.env.OPENAI_API_KEY='test-private-key';process.env.ORB_LIVE_ENABLED='true';
  delete require.cache[require.resolve('../api/orb-live')];const handler=require('../api/orb-live');
  const upstream=[];
  global.fetch=async(url,opts)=>{upstream.push({url,opts});return {ok:true,status:200,json:async()=>({session:{id:'opaque/session'},transport:{sdp:'v=0 answer'}})};};
  async function request(body,headers={host:'example.com',origin:'https://example.com'},method='POST'){
    const result={headers:{}};await handler({body,headers,method},{setHeader(k,v){result.headers[k]=v;},status(code){result.code=code;return this;},json(value){result.body=value;},end(){}});return result;
  }
  try {
    let result=await request({},undefined,'GET');assert.equal(result.body.enabled,true);
    result=await request({action:'start',sdp:'v=0\r\n',session:{model:'other',store:true}});
    assert.equal(result.code,201);assert.ok(!JSON.stringify(result.body).includes('test-private-key'));
    const payload=JSON.parse(upstream[0].opts.body);
    assert.equal(payload.session.model,'gpt-live-1');assert.equal(payload.session.store,false);
    assert.equal(payload.session.delegation.type,'client');assert.ok(payload.session.client.data_channel.allowed_client_events.includes('session.close'));
    const ticket=result.body.ticket;
    result=await request({action:'close',ticket});assert.equal(result.code,200);assert.match(upstream.at(-1).url,/opaque%2Fsession\/hangup$/);
    result=await request({action:'close',ticket:ticket+'tampered'});assert.equal(result.code,403);
    result=await request({action:'start',sdp:'v=0'}, {host:'example.com',origin:'https://unrelated.test'});assert.equal(result.code,403);
    result=await request({action:'start',sdp:'v=0'}, {host:'example.com'});assert.equal(result.code,403);
    result=await request({action:'start',sdp:'x'.repeat(65000)});assert.equal(result.code,400);
    process.env.ORB_LIVE_ENABLED='false';result=await request({action:'start',sdp:'v=0'});assert.equal(result.code,503);
    result=await request({action:'close',ticket});assert.equal(result.code,200);
  } finally {
    global.fetch=previous.fetch;
    if(previous.key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.key;
    if(previous.enabled===undefined)delete process.env.ORB_LIVE_ENABLED;else process.env.ORB_LIVE_ENABLED=previous.enabled;
  }
});
