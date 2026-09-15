const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const jpeg='data:image/jpeg;base64,/9j/2Q==';
function cameraFixture({pending=false,denied=false}={}){
  const nodes=new Map(),listeners={},tracks=[{stop(){this.stopped=true;},addEventListener(){}}];let grant,requests=[];
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,open:false,videoWidth:1280,videoHeight:720,
    showModal(){this.open=true;},close(){this.open=false;},removeAttribute(k){delete this[k];},addEventListener(name,fn){this[name]=fn;},play:async()=>{}});return nodes.get(id);};
  const stream={getTracks:()=>tracks,getVideoTracks:()=>tracks};
  const window={addEventListener:(type,fn)=>listeners[type]=fn,OrbVisual:{stop(){window.stopped=true;}}};
  const document={getElementById:get,addEventListener:(type,fn)=>listeners[type]=fn,createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=>jpeg})};
  const context=vm.createContext({window,document,navigator:{mediaDevices:{getUserMedia:opts=>{requests.push(opts);if(denied)return Promise.reject(Error('denied'));return pending?new Promise(r=>grant=r):Promise.resolve(stream);}}}});
  vm.runInContext(fs.readFileSync('orb-portrait.js','utf8'),context);
  return {portrait:window.OrbPortrait,get,tracks,requests,grant:()=>grant(stream),listeners,document};
}
test('camera is optional; captured photo is not approved until Use, and microphone is never requested',async()=>{
  const f=cameraFixture();assert.equal(f.requests.length,0);assert.equal(f.portrait.reference,null);
  await f.get('portraitOpen').onclick();assert.equal(f.requests[0].audio,false);
  f.get('portraitCapture').onclick();assert.equal(f.tracks[0].stopped,true);assert.equal(f.portrait.reference,null);
  f.get('portraitUse').onclick();assert.equal(f.portrait.reference,jpeg);assert.equal(f.get('livingOptIn').checked,true);assert.equal(f.get('portraitDialog').open,false);
  f.get('portraitRemove').onclick();assert.equal(f.portrait.reference,null);assert.equal(f.get('portraitSelected').src,undefined);
});
test('late permission after cancelling releases the camera without a preview',async()=>{
  const f=cameraFixture({pending:true}),opening=f.get('portraitOpen').onclick();
  f.get('portraitCancel').onclick();f.grant();await opening;
  assert.equal(f.tracks[0].stopped,true);assert.equal(f.get('portraitCamera').srcObject,null);assert.equal(f.portrait.reference,null);
});
test('denied camera offers retry; hiding the page shuts down an open camera',async()=>{
  const denied=cameraFixture({denied:true});await denied.get('portraitOpen').onclick();assert.match(denied.get('portraitStatus').textContent,/couldn’t open/);assert.equal(denied.get('portraitRetake').hidden,false);
  const f=cameraFixture();await f.get('portraitOpen').onclick();f.document.hidden=true;f.listeners.visibilitychange();assert.equal(f.tracks[0].stopped,true);
});
test('leaving the page discards the approved reference',async()=>{
  const f=cameraFixture();await f.get('portraitOpen').onclick();f.get('portraitCapture').onclick();f.get('portraitUse').onclick();
  f.listeners.pagehide();assert.equal(f.portrait.reference,null);assert.equal(f.get('portraitSelected').src,undefined);
});
const {sign,verify}=require('../lib/orb-visual'),handler=require('../api/orb-video');
async function request(body){let code,out;await handler({method:'POST',headers:{host:'example.com',origin:'https://example.com'},body},{setHeader(){},status(n){code=n;return this;},json(value){out=value;}});return {code,out};}
test('approved portrait uses reference-to-video and is never embedded in signed job tickets',async()=>{
  const previous=global.fetch,oldKey=process.env.FAL_KEY;process.env.FAL_KEY='test';const calls=[];
  try{
    global.fetch=async(url,options)=>{calls.push({url,input:JSON.parse(options.body)});return {ok:true,json:async()=>({status_url:'https://queue.fal.run/minimax/job/status',response_url:'https://queue.fal.run/minimax/job/result',cancel_url:'https://queue.fal.run/minimax/job/cancel'})};};
    const ticket=sign({kind:'prompt',includePortrait:true,prompt:'Float gently above the clouds.'},'test');
    assert.equal((await request({action:'submit',ticket})).code,400);assert.equal(calls.length,0);
    const result=await request({action:'submit',ticket,referencePhoto:jpeg});assert.equal(result.code,200);
    assert.match(calls[0].url,/reference-to-video$/);assert.deepEqual(calls[0].input.reference_image_urls,[jpeg]);
    const job=verify(result.out.ticket,'test');assert.equal(job.referenceHash.length,64);assert.doesNotMatch(JSON.stringify(job),/data:image/);
    const continuity=sign({kind:'continuity',referenceHash:job.referenceHash,anchor:'Clouds',first:'https://example.com/first.mp4',latest:'https://example.com/last.mp4'},'test');
    const continued=await request({action:'submit',ticket,referencePhoto:jpeg,continuity,frame:jpeg});assert.equal(continued.code,200);assert.deepEqual(calls[1].input.reference_image_urls,[jpeg,jpeg]);assert.match(calls[1].input.prompt,/Image 2 is the final frame/);
    const changed='data:image/jpeg;base64,/9j/AP/Z';assert.equal((await request({action:'submit',ticket,referencePhoto:changed,continuity,frame:jpeg})).code,400);
    const plain=sign({kind:'prompt',prompt:'Clouds'},'test');assert.equal((await request({action:'submit',ticket:plain,referencePhoto:jpeg})).code,400);
  }finally{global.fetch=previous;if(oldKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=oldKey;}
});
