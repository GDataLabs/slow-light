const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('orb-visual.js','utf8');
function fixture(blocked=false){
  let time,drawn=false,cleared=false;
  const decoder={duration:5,videoWidth:854,videoHeight:480,pause(){},removeAttribute(){cleared=true;},
    set currentTime(value){time=value;queueMicrotask(()=>this.onseeked?.());},
    load(){if(!cleared)queueMicrotask(()=>this.onloadeddata?.());}};
  const canvas={getContext:()=>({drawImage(video){assert.equal(video,decoder);drawn=true;}}),toDataURL:()=>{if(blocked)throw Error('CORS');return 'data:image/jpeg;base64,/9j/AA==';}};
  const context=vm.createContext({document:{createElement:tag=>tag==='video'?decoder:canvas},setTimeout,clearTimeout,Error});
  vm.runInContext(source.slice(source.indexOf('  async function extractFinalFrame'),source.indexOf('  async function play('))+';globalThis.extract=extractFinalFrame;',context);
  return {context,decoder,read:()=>({time,drawn,cleared})};
}
test('endpoint extraction seeks the last decoded frame without moving the visible player',async()=>{
  const f=fixture();
  assert.match(await f.context.extract('https://example.com/clip.mp4',new AbortController().signal),/^data:image\/jpeg/);
  assert.equal(f.decoder.crossOrigin,'anonymous');
  assert.deepEqual(f.read(),{time:4.999,drawn:true,cleared:true});
});
test('unreadable endpoint fails and releases its decoder',async()=>{
  const f=fixture(true);
  await assert.rejects(f.context.extract('https://example.com/clip.mp4',new AbortController().signal),/could not be read/);
  assert.equal(f.read().cleared,true);
});
