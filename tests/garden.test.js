const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function bridge(create){
  const ctx={create,console:{warn(){}},Promise,App:{simple:false},G:{W:390,H:844,t:3,breath:{level:.5},quality:.7,cv:{dataset:{}}},REDUCED:false,document:{getElementById:()=>({checked:true})}};
  ctx.window=ctx;ctx.addEventListener=()=>{};
  const source=fs.readFileSync('garden-bridge.js','utf8').replace("import('./garden-3d.js')",'Promise.resolve({createGarden:create})');vm.runInNewContext(source,ctx);return ctx;
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('unavailable 3D assets select fallback without throwing into the session',async()=>{
  const ctx=bridge(async()=>{throw new Error('asset unavailable');});ctx.Garden3D.load();await settle();assert.equal(ctx.Garden3D.state,'fallback');assert.equal(ctx.Garden3D.draw({}),false);
});
test('a renderer failure returns control to the illustrated room',async()=>{
  let disposed=false;const ctx=bridge(async()=>({draw(){throw new Error('lost');},dispose(){disposed=true;}}));ctx.Garden3D.load();await settle();assert.equal(ctx.Garden3D.draw({}),false);assert.equal(ctx.Garden3D.state,'fallback');assert.equal(disposed,true);
});
test('ending while models load disposes the late renderer',async()=>{
  let resolve,disposed=false;const ctx=bridge(()=>new Promise(r=>resolve=r));ctx.Garden3D.load();await settle();ctx.Garden3D.release();resolve({dispose(){disposed=true;}});await settle();assert.equal(disposed,true);assert.equal(ctx.Garden3D.instance,null);
});
test('simple mode avoids rendering the 3D garden',async()=>{
  let draws=0;const ctx=bridge(async()=>({draw(){draws++;return true;},dispose(){}}));ctx.Garden3D.load();await settle();ctx.App.simple=true;assert.equal(ctx.Garden3D.draw({}),false);assert.equal(draws,0);
});
test('all glTF buffers and textures are bundled locally',()=>{
  for(const name of ['rock_moss_set_01','fern_02']){
    const base=path.join('assets/garden',name),gltf=JSON.parse(fs.readFileSync(path.join(base,name+'_1k.gltf'),'utf8'));
    for(const item of [...gltf.buffers,...gltf.images]){
      assert.ok(!item.uri.includes('..')&&!item.uri.includes('://'));const file=path.join(base,item.uri);assert.ok(fs.statSync(file).size>0);if(item.byteLength)assert.ok(fs.statSync(file).size>=item.byteLength);
    }
  }
});
test('vendored renderer only references bundled core modules',()=>{
  const code=fs.readFileSync('vendor/three/three.module.js','utf8');
  for(const match of code.matchAll(/from["'](\.\/[^"']+)["']/g))assert.ok(fs.existsSync(path.join('vendor/three',match[1])),match[1]);
  assert.ok(!code.includes('three.core.min.js'));
});
