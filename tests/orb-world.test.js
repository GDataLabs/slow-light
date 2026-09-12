const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/orb-world');
const {sign,verify}=require('../lib/orb-visual');
test('world creation carries frame and scene guidance privately; signed polling returns splats',async()=>{
  const oldFetch=global.fetch,oldWorld=process.env.WORLDLABS_KEY,oldFal=process.env.FAL_KEY;
  process.env.WORLDLABS_KEY='world-test';process.env.FAL_KEY='fal-test';
  const request=async body=>{let data,code;await handler({method:'POST',headers:{host:'example.com'},body},{setHeader(){},status(c){code=c;return this;},json(d){data=d;}});return {code,data};};
  try{
    let calls=0;
    global.fetch=async(url,options)=>{
      calls++;assert.equal(options.headers['WLT-Api-Key'],'world-test');
      if(url.endsWith('worlds:generate')){
        const input=JSON.parse(options.body);
        assert.equal(input.world_prompt.image_prompt.source,'data_base64');assert.equal(input.world_prompt.image_prompt.data_base64,'/9j/AA==');
        assert.match(input.world_prompt.text_prompt,/quiet meadow/);assert.equal(input.permission.public,false);
        return {ok:true,json:async()=>({operation_id:'operation-123'})};
      }
      assert.match(url,/operations\/operation-123$/);
      return {ok:true,json:async()=>({done:true,response:{assets:{splats:{spz_urls:{'100k':'https://example.com/world.spz'}}}}})};
    };
    assert.equal((await request({action:'submit',ticket:'fake'})).code,400);assert.equal(calls,0);
    const result=await request({action:'submit',ticket:sign({kind:'prompt',prompt:'A quiet meadow'},'fal-test'),frame:'data:image/jpeg;base64,/9j/AA=='});
    assert.equal(result.code,200);assert.equal(verify(result.data.ticket,'world-test').kind,'world-job');
    const ready=await request({action:'status',ticket:result.data.ticket});assert.equal(ready.data.url,'https://example.com/world.spz');
  }finally{global.fetch=oldFetch;for(const [key,value]of [['WORLDLABS_KEY',oldWorld],['FAL_KEY',oldFal]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('3D renderer imports local Three.js and controls compile',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  new vm.Script(fs.readFileSync('orb-world.js','utf8'));
  const code=fs.readFileSync('orb-world-viewer.js','utf8').replace(/^import .*;\n/gm,'').replace('export async function','async function');new vm.Script(code);
  assert.ok(fs.existsSync('vendor/three/three.module.js'));
});
