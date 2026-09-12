const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../orb-language');
function storage(initial={}) { const data=new Map(Object.entries(initial)); return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}; }
test('successive visits vary familiar stage wording without storing personal text',()=>{
  const s=storage(),first=create(s,()=>0),second=create(s,()=>0),third=create(s,()=>0);
  assert.equal(new Set([first.line('ask_feelings',''),second.line('ask_feelings',''),third.line('ask_feelings','')]).size,3);
  assert.deepEqual([...s.data.keys()],['slowlight.orbLanguage']);
});
test('repeated invitations rotate while contextual and crisis responses remain intact',()=>{
  const language=create(storage(),()=>0);
  assert.notEqual(language.line('release_response',''),language.line('release_response',''));
  assert.equal(language.line('close','From 7 to 6.'),'From 7 to 6.');
  assert.equal(language.line('acknowledge',null),null);
  assert.equal(language.line('care','Reach a person.'),'Reach a person.');
});
test('saving disabled and blocked storage still allow fresh wording',()=>{
  const s=storage({'slowlight.remember':'false'});create(s,()=>.9);
  assert.equal(s.data.has('slowlight.orbLanguage'),false);
  const language=create({getItem(){throw Error('Blocked');}},()=>0);
  assert.match(language.line('breathe',''),/breath/);
});
