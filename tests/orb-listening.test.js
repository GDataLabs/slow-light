const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const html = fs.readFileSync('orb.html','utf8');
function fixture() {
  const nodes = new Map();
  const node = id => { if(!nodes.has(id)) nodes.set(id,{textContent:'',style:{},classList:{add(){},remove(){},toggle(){}}}); return nodes.get(id); };
  class SR { start() {} stop() {} }
  const context = vm.createContext({window:{SpeechRecognition:SR},navigator:{},$:node,Media:{duck(){}},elReady:()=>false});
  vm.runInContext(html.slice(html.indexOf('const Ears = {'),html.indexOf('/* "about seven"'))+';globalThis.ears=Ears;',context);
  return {ears:context.ears,context,node};
}
test('browser speech submits the recognized answer before invalidating callbacks',()=>{
  const {ears}=fixture(); let answer;
  ears._token=1; ears._webListen(text=>answer=text,1);
  ears.rec.onresult({results:[[{transcript:'I feel overwhelmed'}]]});
  assert.equal(answer,'I feel overwhelmed'); assert.equal(ears.listening,false);
});
test('cancelled or superseded speech cannot answer the next question',()=>{
  const {ears}=fixture(); let count=0;
  ears._token=1; ears._webListen(()=>count++,1); const old=ears.rec;
  ears.cancel(); const token=++ears._token; ears._webListen(()=>count++,token);
  old.onresult({results:[[{transcript:'old answer'}]]}); old.onend();
  assert.equal(count,0); assert.equal(ears.listening,true);
});
test('speech permission errors leave a readable retry instruction',()=>{
  const {ears,node}=fixture(); ears._token=1; ears._webListen(()=>{},1);
  ears.rec.onerror({error:'not-allowed'});
  assert.match(node('#micStatus').textContent,/Allow microphone access/);
});
test('video rendering excludes scenery and large Orb but restores visibility for fallback',()=>{
  const orb={visible:true},stars={visible:false},dunes={visible:true},exercise={visible:true};
  let drawn=false;
  const T={orbGroup:orb,stars,sceneObjs:[{obj:dunes}],scene:{background:'sky'},camera:{},renderer:{render(scene){
    drawn=true; assert.equal(orb.visible,false);assert.equal(dunes.visible,false);
    assert.equal(exercise.visible,true);assert.equal(scene.background,null);
  }}};
  const start=html.indexOf('  const hidden = window.OrbVisual.showing');
  const end=html.indexOf('  T.scene.background=background;',start)+'  T.scene.background=background;'.length;
  vm.runInNewContext(html.slice(start,end),{T,window:{OrbVisual:{showing:true}}});
  assert.equal(drawn,true);assert.equal(orb.visible,true);assert.equal(dunes.visible,true);assert.equal(stars.visible,false);assert.equal(T.scene.background,'sky');
});
