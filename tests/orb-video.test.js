const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { sign, verify } = require('../lib/orb-visual');
const handler = require('../api/orb-video');
const frame = 'data:image/jpeg;base64,/9j/AA==';
const originalFetch = global.fetch, originalKey = process.env.FAL_KEY;
afterEach(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = originalKey; });
async function request(body, origin = 'https://example.com') {
  let code, data;
  const res = { setHeader() {}, status(c) { code = c; return this; }, json(d) { data = d; }, end() {} };
  await handler({ method: 'POST', headers: { origin, host: 'example.com' }, body }, res);
  return { code, data };
}
test('prompt tickets reject tampering and expiry', () => {
  const t = sign({kind:'prompt', prompt:'A quiet lake'}, 'secret');
  assert.equal(verify(t, 'secret').prompt, 'A quiet lake');
  assert.throws(() => verify(t + 'x', 'secret'));
  assert.throws(() => verify(t, 'other'));
  const original = Date.now;
  try { Date.now = () => original() + 16 * 60000; assert.throws(() => verify(t, 'secret')); } finally { Date.now = original; }
});
test('unconfigured video route fails without a provider call', async () => {
  delete process.env.FAL_KEY;
  global.fetch = () => { throw Error('Must not call'); };
  assert.equal((await request({action:'submit'})).code, 503);
});
test('rejects foreign origins and unsigned prompts', async () => {
  process.env.FAL_KEY = 'test';
  global.fetch = () => { throw Error('Must not call'); };
  assert.equal((await request({action:'submit'}, 'https://elsewhere.test')).code, 403);
  assert.equal((await request({action:'submit', ticket:'fake'})).code, 400);
});
test('submit uses fixed safe settings and signed provider job URLs', async () => {
  process.env.FAL_KEY = 'test';
  let input;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://queue.fal.run/minimax/h3-max/text-to-video');
    input = JSON.parse(options.body);
    return {ok:true, json:async()=>({status_url:'https://queue.fal.run/minimax/h3-max/requests/123/status', response_url:'https://queue.fal.run/minimax/h3-max/requests/123', cancel_url:'https://queue.fal.run/minimax/h3-max/requests/123/cancel'})};
  };
  const result = await request({action:'submit', ticket:sign({kind:'prompt',prompt:'Soft moonlight'}, 'test')});
  assert.equal(result.code, 200); assert.equal(input.duration, 5); assert.equal(input.enable_safety_checker,true);
  assert.equal(verify(result.data.ticket, 'test').kind, 'job');
});
test('provider failures and unsafe job URLs never reach the browser as clips', async () => {
  process.env.FAL_KEY = 'test';
  global.fetch = async () => ({ok:true, json:async()=>({status_url:'https://evil.test/steal'})});
  assert.equal((await request({action:'submit',ticket:sign({kind:'prompt',prompt:'Lake'},'test')})).code,502);
});
test('completed job retrieves its signed result URL', async () => {
  process.env.FAL_KEY = 'test';
  const job = sign({kind:'job',status:'https://queue.fal.run/minimax/job/status',result:'https://queue.fal.run/minimax/job/result'},'test');
  global.fetch = async url => ({ok:true,json:async()=>url.endsWith('status')?{status:'COMPLETED'}:{video:{url:'https://v3.fal.media/scene.mp4'}}});
  const result = await request({action:'status',ticket:job});
  assert.equal(result.data.url,'https://v3.fal.media/scene.mp4');
});
test('Orb page and playback scripts compile', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  new vm.Script(fs.readFileSync('orb-visual.js','utf8'));
  for (const m of fs.readFileSync('orb.html','utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) { if(m[1].includes('importmap')) JSON.parse(m[2]); else new vm.Script(m[2]); }
});
test('continuations keep the opening anchor and start from the supplied endpoint frame', async () => {
  process.env.FAL_KEY = 'test';
  const first = 'https://v3.fal.media/first.mp4', latest = 'https://v3.fal.media/latest.mp4';
  const continuity = sign({kind:'continuity',anchor:'One meadow with a willow on the left',first,latest},'test');
  global.fetch = async (url, options) => {
    assert.equal(url,'https://queue.fal.run/minimax/h3-max/image-to-video');
    const input = JSON.parse(options.body);
    assert.equal(input.image_url,frame); assert.equal(input.reference_video_urls,undefined);
    assert.match(input.prompt,/willow on the left/);
    assert.match(input.prompt,/mist settles/);
    assert.match(input.prompt,/No new location/);
    return {ok:true,json:async()=>({status_url:'https://queue.fal.run/minimax/job/status',response_url:'https://queue.fal.run/minimax/job/result',cancel_url:'https://queue.fal.run/minimax/job/cancel'})};
  };
  const result = await request({action:'submit',ticket:sign({kind:'prompt',prompt:'The mist settles'},'test'),continuity,frame});
  assert.equal(result.code,200);
  const job = verify(result.data.ticket,'test');
  assert.equal(job.anchor,'One meadow with a willow on the left');
  assert.equal(job.first,first);
});
test('continuation requires a frame and rejects unsigned continuity', async () => {
  process.env.FAL_KEY = 'test';
  const first = 'https://v3.fal.media/first.mp4';
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).image_url,frame);
    return {ok:true,json:async()=>({status_url:'https://queue.fal.run/minimax/job/status',response_url:'https://queue.fal.run/minimax/job/result',cancel_url:'https://queue.fal.run/minimax/job/cancel'})};
  };
  const ticket = sign({kind:'prompt',prompt:'Soft light'},'test');
  assert.equal((await request({action:'submit',ticket,continuity:'tampered'})).code,400);
  assert.equal(calls,0);
  assert.equal((await request({action:'submit',ticket,continuity:sign({kind:'continuity',anchor:'Meadow',first,latest:first},'test'),frame})).code,200);
});
test('completed continuation advances latest clip while preserving the original place', async () => {
  process.env.FAL_KEY = 'test';
  const first = 'https://v3.fal.media/first.mp4', latest = 'https://v3.fal.media/next.mp4';
  const ticket = sign({kind:'job',anchor:'A single meadow',first,status:'https://queue.fal.run/minimax/job/status',result:'https://queue.fal.run/minimax/job/result'},'test');
  global.fetch = async url => ({ok:true,json:async()=>url.endsWith('status')?{status:'COMPLETED'}:{video:{url:latest}}});
  const result = await request({action:'status',ticket});
  const continuity = verify(result.data.continuity,'test');
  assert.equal(continuity.first,first); assert.equal(continuity.latest,latest); assert.equal(continuity.anchor,'A single meadow');
});

test('a missing or remote endpoint frame never starts a fresh scene',async()=>{
  process.env.FAL_KEY='test';
  global.fetch=()=>{throw Error('Must not generate');};
  const continuity=sign({kind:'continuity',anchor:'Meadow',first:'https://v3.fal.media/a.mp4',latest:'https://v3.fal.media/a.mp4'},'test');
  const ticket=sign({kind:'prompt',prompt:'Mist lifts'},'test');
  for(const frame of [undefined,'https://example.com/image.jpg','data:image/jpeg;base64,broken!']) {
    assert.equal((await request({action:'submit',ticket,continuity,frame})).code,400);
  }
});
test('opening and continuation support signed durations while rejecting arbitrary overrides',async()=>{
  process.env.FAL_KEY='test';
  const continuity=sign({kind:'continuity',anchor:'Meadow',first:'https://v3.fal.media/a.mp4',latest:'https://v3.fal.media/a.mp4'},'test');
  for(const continued of [false,true]) {
    for(const duration of [5,10,15,999]) {
      const expected=duration===999?5:duration;
      global.fetch=async (_url,options)=>{
        assert.equal(JSON.parse(options.body).duration,expected);
        return {ok:true,json:async()=>({status_url:'https://queue.fal.run/minimax/job/status',response_url:'https://queue.fal.run/minimax/job/result',cancel_url:'https://queue.fal.run/minimax/job/cancel'})};
      };
      const result=await request({action:'submit',ticket:sign({kind:'prompt',prompt:'Mist lifts',duration},'test'),duration:999,...(continued?{continuity,frame}:{})});
      assert.equal(result.code,200);assert.equal(result.data.duration,expected);
    }
  }
});
test('sunrise direction is not overridden by the original nighttime anchor',async()=>{
  process.env.FAL_KEY='test';
  const continuity=sign({kind:'continuity',anchor:'A meadow at night under moonlight',first:'https://v3.fal.media/a.mp4',latest:'https://v3.fal.media/a.mp4'},'test');
  global.fetch=async(_url,options)=>{
    const prompt=JSON.parse(options.body).prompt;
    assert.match(prompt,/sun visibly rises/);
    assert.match(prompt,/old lighting and time of day do not override/);
    assert.doesNotMatch(prompt,/Preserve the exact[^.]*time of day/);
    return {ok:true,json:async()=>({status_url:'https://queue.fal.run/minimax/job/status',response_url:'https://queue.fal.run/minimax/job/result',cancel_url:'https://queue.fal.run/minimax/job/cancel'})};
  };
  assert.equal((await request({action:'submit',ticket:sign({kind:'prompt',prompt:'The sun visibly rises over the same meadow horizon.',duration:15},'test'),continuity,frame})).code,200);
});
