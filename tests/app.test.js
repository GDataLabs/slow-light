const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
function fixture() {
  const data = new Map(), fields = new Map();
  const context = vm.createContext({
    document: { querySelector(id) { if(!fields.has(id)) fields.set(id,{value:'',textContent:''}); return fields.get(id); } },
    localStorage: {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
    STATES:{neutral:{key:'neutral',label:'Neutral'},sad:{label:'Sad'}}, INTENSITY_DEFAULT:.5,
    G:{st:{keys:['sad'],labelFull:'Sad'},breath:{cycles:12}},
    navigator:{clipboard:{writeText:async text=>{context.copied=text;}}},setTimeout:()=>{},
    performance:{now:()=>999999},
  });
  vm.runInContext('const $=s=>document.querySelector(s);'+html.slice(html.indexOf('const App = {'),html.indexOf('/* ---------------- pointer ---------------- */'))+';globalThis.app=App;',context);
  const app=context.app;
  Object.assign(app,{_sid:'test-session',finishedDuration:120,suds:6,stateKey:'sad',weights:{sad:.5},startedAt:0});
  fields.set('#carry',{value:'A small next step'});fields.set('#goal',{value:''});fields.set('#suds2',{value:'4'});
  return {app,data,fields,context};
}
test('session duration is frozen while reflection notes change',()=>{
  const {app,data,fields}=fixture();app.saveSession();fields.get('#carry').value='A later note';app.saveSession();
  const rows=JSON.parse(data.get('slowlight.history'));assert.equal(rows.length,1);assert.equal(rows[0].mins,2);assert.equal(rows[0].carry,'A later note');
});
test('unanswered closing intensity is not recorded as a result',()=>{
  const {app,data}=fixture();app.saveSession();assert.equal(JSON.parse(data.get('slowlight.history'))[0].after,null);
  app._suds2Touched=true;app.saveSession();assert.equal(JSON.parse(data.get('slowlight.history'))[0].after,4);
});
test('privacy preference blocks session and goal writes',()=>{
  const {app,data}=fixture();data.set('slowlight.remember','false');app.saveSession();app.saveGoal('Private goal');assert.equal(data.has('slowlight.history'),false);assert.equal(data.has('slowlight.goal'),false);
});
test('not sure is not silently classified as wired',()=>{
  const {app}=fixture();app.selectedStates.clear();assert.equal(app.getBlendedState().labelFull,'Not sure');assert.equal(app.getBlendedState().key,'neutral');
});
test('malformed history container does not prevent future saves',()=>{
  const {app,data}=fixture();data.set('slowlight.history','{}');app.saveSession();assert.equal(JSON.parse(data.get('slowlight.history')).length,1);
});
test('history renders written markup as text',()=>{
  const history=fs.readFileSync('history.html','utf8');const source=history.slice(history.indexOf('const escapeHTML ='),history.indexOf('const dayKey ='));
  const escape=vm.runInNewContext(source+'escapeHTML');assert.equal(escape('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.ok(history.includes('${escapeHTML(r.carry)}'));assert.ok(history.includes('${escapeHTML(r.goal)}'));
});
test('inline page scripts compile',()=>{for(const file of ['index.html','history.html'])for(const match of fs.readFileSync(file,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);});
function breathFixture(shape={inS:4,holdS:0,outS:6,restS:0}){
  const U={clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),lerp:(a,b,t)=>a+(b-a)*t,approach:(a,b,t,dt)=>b+(a-b)*Math.exp(-dt/t),inv:(a,b,v)=>a===b?0:(v-a)/(b-a),smoother:t=>t*t*t*(t*(t*6-15)+10)};
  const source=html.slice(html.indexOf('class Breath {'),html.indexOf('/* =====================================================================\n   AUDIO'));
  const Breath=vm.runInNewContext(source+';Breath',{U});const b=new Breath();b.setShape(shape);b.fixed=true;b.start(.7,360);return b;
}
test('exact rhythm uses chosen seconds from the start and skips zero holds',()=>{
  const b=breathFixture();assert.equal(b.rate,6);
  const phases={in:0,out:0,hold:0,rest:0};for(let i=0;i<1000;i++){b.update(.01,i/36000);phases[b.segment]++;}
  assert.ok(Math.abs(phases.in-400)<=1);assert.ok(Math.abs(phases.out-600)<=1);assert.equal(phases.hold,0);assert.equal(phases.rest,0);
});
test('live rhythm change waits for the cycle boundary',()=>{
  const b=breathFixture();b.update(2,0);b.queueShape({inS:4,holdS:2,outS:4,restS:2},true);
  assert.equal(b.target,6);assert.ok(b.pendingShape);for(let i=0;i<801;i++)b.update(.01,.1);
  assert.equal(b.target,5);assert.equal(b.pendingShape,null);assert.equal(b.fixed,true);assert.ok(Math.abs(b.shape.h1-1/6)<1e-10);
});
test('sensors cannot override a chosen exact rhythm',()=>{
  const b=breathFixture();b.observe(18,1,3);assert.equal(b.rate,6);
});

test('switching to gradual mode late in a session does not snap to the new tempo',()=>{
  const b=breathFixture();b.phase=.999;b.queueShape({inS:3,holdS:0,outS:3,restS:0},false);b.update(.02,.8);
  assert.equal(b.rate,6);b.update(.02,.8001);assert.ok(b.rate>6 && b.rate<6.1);
});

test('sunlight shifts from upward at the horizon to downward as the sun rises',()=>{
  const scene=vm.runInNewContext(fs.readFileSync('scene-detail.js','utf8')+';SceneDetail');
  function energy(sunY){return scene.rayGeometry(sunY,600,800).reduce((sum,r)=>{sum[Math.sin(r.angle)>0?'down':'up']+=r.weight;return sum;},{up:0,down:0});}
  const low=energy(600),high=energy(300);assert.ok(low.up>low.down);assert.ok(high.down>high.up);
});

test('breathing guide draws every phase legibly on a phone',()=>{
  const {app,context}=fixture(),labels=[];
  context.G.W=390;context.G.H=844;context.G.breath.level=.5;
  context.U={lerp:(a,b,t)=>a+(b-a)*t,approach:(a,b)=>b};
  context.TAU=Math.PI*2;context.radial=()=>'';context.getComputedStyle=()=>({fontFamily:'sans-serif'});
  const canvas={save(){},restore(){},beginPath(){},arc(){},fill(){},stroke(){},roundRect(){},measureText:s=>({width:s.length*9}),fillText(text){labels.push({text,font:this.font,color:this.fillStyle});}};
  for(const phase of ['in','hold','out','rest']){context.G.breath.segment=phase;app.drawOrb(canvas);}
  assert.deepEqual(labels.map(l=>l.text),['breathe in','hold','let it out','rest']);
  assert.ok(labels.every(l=>l.font.includes('16px')&&l.color==='#f0faf6'));
  assert.ok(!html.includes('if(this.simple || !(this.room instanceof Resonance)) this.drawOrb'));
});
