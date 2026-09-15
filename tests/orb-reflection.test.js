const {test}=require('node:test'),assert=require('node:assert/strict');
const handler=require('../api/orb');
const {steps}=require('../orb-guidance');
test('reflection stages replace scenic monologues with a real inward question',async()=>{
  const oldFetch=global.fetch,oldKey=process.env.ANTHROPIC_KEY;process.env.ANTHROPIC_KEY='test';
  try{
    for(const stage of ['imagery_place','imagery_senses','scene_intro']){
      global.fetch=async()=>({ok:true,json:async()=>({content:[{text:JSON.stringify({line:'Everything here holds still.',crisis:false,moods:[]})}]})});
      let out;
      await handler({method:'POST',headers:{host:'example.com',origin:'https://example.com'},body:{stage,visualEnabled:true,person:{goalWords:'grounded'}}},
        {setHeader(){},status(){return this;},json(value){out=value;}});
      if(stage==='scene_intro'){assert.match(out.line,/prepare an image/);assert.doesNotMatch(out.line,/holds still/);}
      else{assert.equal(out.line,steps.find(s=>s.id===stage).question);assert.match(out.line,/\?$/);}
    }
  }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.ANTHROPIC_KEY;else process.env.ANTHROPIC_KEY=oldKey;}
});
const fs=require('node:fs'),vm=require('node:vm');
function checkpointFixture({shown=false,failed=false,choice='Continue without video'}={}){
  const lines=[],contexts=[],messages=[];
  const c=vm.createContext({Cap:{show:async(...text)=>lines.push(text)},$:()=>({}),
    UI:{hide(){},chips(list,unused,context){contexts.push(context);return context?.waiting?new Promise(()=>{}):Promise.resolve(choice);}},
    window:{OrbVisual:{showing:false,failed,message:'Video unavailable: example failure. No video has appeared yet.',
      subscribe(fn){fn(this.message);return ()=>messages.push('unsubscribed');},waitFor:async()=>shown,retry:()=>false}}});
  const html=fs.readFileSync('orb.html','utf8');
  vm.runInContext(html.slice(html.indexOf('async function sceneCheckpoint('),html.indexOf('async function guideScene(')),c);
  return {run:()=>c.sceneCheckpoint('ticket'),lines,contexts,messages};
}
test('video failure gives a visible retry-or-continue question instead of pretending a scene exists',async()=>{
  const f=checkpointFixture({failed:true});await f.run();
  assert.match(f.lines[0][0],/still being prepared/);assert.match(f.lines[1][0],/retry it/);assert.match(f.lines[1][1],/No video has appeared/);
  assert.equal(f.contexts[0].waiting,true);assert.deepEqual(f.messages,['unsubscribed']);
});
test('successful video arrival releases the checkpoint without a needless response prompt',async()=>{
  const f=checkpointFixture({shown:true});await f.run();assert.equal(f.lines.length,1);assert.equal(f.contexts.length,1);
});
test('slow video offers an honest wait choice instead of claiming failure',async()=>{
  const f=checkpointFixture();await f.run();assert.match(f.lines[1][0],/taking longer/);assert.doesNotMatch(f.lines[1][0],/couldn’t appear/);
});
