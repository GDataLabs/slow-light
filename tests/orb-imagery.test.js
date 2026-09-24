const {test}=require('node:test');
const assert=require('node:assert/strict');
const {findImagery,anchorVisual}=require('../lib/orb-imagery');
const {verify}=require('../lib/orb-visual');
test('named places in the first answer are found; feelings alone are not',()=>{
  assert.equal(findImagery('I feel like I am up in the clouds').key,'clouds');
  assert.equal(findImagery('floating, weightless').key,'sky');
  assert.equal(findImagery('clouds over the ocean').key,'clouds','the earliest named image leads');
  assert.equal(findImagery('by the ocean; hoping for calm').key,'ocean');
  assert.equal(findImagery('heavy, tight in my chest'),null);
  assert.equal(findImagery('I need some space'),null);
});
test('the opening prompt is anchored to the named place if the model drifted',()=>{
  const clouds=findImagery('up in the clouds');
  assert.match(anchorVisual('Close view of soft green moss on a granite rock.',clouds),/^Drifting slowly high above and through soft, luminous white clouds/);
  const ok='Above a sea of soft clouds at golden hour.';
  assert.equal(anchorVisual(ok,clouds),ok);
});
test('"up in the clouds" opens in the clouds even when the model returns moss',async()=>{
  const handler=require('../api/orb');
  const oldFetch=global.fetch,oldKey=process.env.ANTHROPIC_KEY,oldFal=process.env.FAL_KEY;
  process.env.ANTHROPIC_KEY='k';process.env.FAL_KEY='k';let ctx,system;
  global.fetch=async(_u,o)=>{const p=JSON.parse(o.body);system=p.system;ctx=JSON.parse(p.messages[0].content.split('\n').slice(1).join('\n'));
    return {ok:true,json:async()=>({content:[{text:JSON.stringify({line:'x',visual:'Close view of soft green moss on a granite rock in diffused light.',soundscape:'forest',clipSeconds:5,crisis:false})}]})};};
  try{
    let out;
    await handler({method:'POST',headers:{host:'e.com'},body:{stage:'scene_intro',visualEnabled:true,person:{initialWords:'I feel up in the clouds',rawAnswer:'I feel up in the clouds; hoping for calmer'}}},
      {setHeader(){},status(){return this;},json(d){out=d;}});
    assert.equal(ctx.openingVariation,null,'no random nudge toward small ground-level details');
    assert.match(ctx.openingImagery,/clouds/);
    assert.match(system,/OPENING IMAGE MATCHES THEIR WORDS/);
    assert.match(verify(out.visual,'k').prompt,/^Drifting slowly high above and through soft, luminous white clouds/);
    assert.equal(out.soundscape,'sky');
  }finally{global.fetch=oldFetch;for(const [n,v] of [['ANTHROPIC_KEY',oldKey],['FAL_KEY',oldFal]]){if(v===undefined)delete process.env[n];else process.env[n]=v;}}
});
