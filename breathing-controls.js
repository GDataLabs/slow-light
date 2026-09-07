/* One shared rhythm editor, available before and during a journey. */
(() => {
  const limits={inS:[2,7],holdS:[0,8],outS:[3,9],restS:[0,4]};
  const labels={inS:'Inhale',holdS:'Hold',outS:'Exhale',restS:'Rest'};
  const original={inS:'bpIn',holdS:'bpHold',outS:'bpOut',restS:'bpRest'};
  let fixed=true;
  try{fixed=localStorage.getItem('slowlight.breathFixed')!=='false';}catch{}
  App.breathFixed=fixed;
  const panel=document.createElement('dialog');panel.className='sl-dialog rhythm-dialog';panel.setAttribute('aria-labelledby','rhythmTitle');document.body.append(panel);
  let opener;
  function open(){
    opener=document.activeElement;
    const draft={...App.breathShape};
    panel.innerHTML=`<div class="dialog-top"><span class="eyebrow">YOUR BREATHING FLOW</span><button class="plain-link" data-dismiss>Close ✕</button></div><h2 id="rhythmTitle">Find your own rhythm.</h2><p>Choose a pace that feels comfortable. Holds are optional; zero skips that part.</p><div class="rhythm-presets"><button class="chip" data-preset="gentle">Gentle · 3.5 / 4.5</button><button class="chip" data-preset="even">Even · 4 / 4</button><button class="chip" data-preset="long">Longer exhale · 4 / 6</button></div><div class="rhythm-sliders">${Object.keys(labels).map(k=>`<label for="live-${k}">${labels[k]} <output id="out-${k}"></output><input id="live-${k}" type="range" min="${limits[k][0]}" max="${limits[k][1]}" step="0.5" value="${draft[k]}"></label>`).join('')}</div><div class="rhythm-timeline" aria-hidden="true"></div><p id="rhythmSummary" class="small" aria-live="polite"></p><label class="rhythm-mode"><input type="checkbox" id="exactRhythm" ${App.breathFixed?'checked':''}><span>Follow these exact timings<br><small>Turn off to gradually approach this rhythm.</small></span></label><div class="ground-tools"><button class="btn" data-apply>Apply rhythm</button><button class="plain-link" data-dismiss>Cancel</button></div><p class="small">${App.running?(App.paused?'The session is paused. Changes begin with the next breath after you resume.':'Changes begin with the next breath. The exercise keeps running while you choose.'):'This rhythm will be used when your journey begins.'} You can breathe naturally or stop at any time.</p>`;
    function paint(){
      const sum=Object.values(draft).reduce((a,b)=>a+b,0);
      for(const k in draft){panel.querySelector('#live-'+k).value=draft[k];panel.querySelector('#out-'+k).textContent=draft[k]===0?'Skip':draft[k]+'s';}
      panel.querySelector('#rhythmSummary').textContent=`${sum} seconds per breath · ${(60/sum).toFixed(1)} breaths per minute`;
      panel.querySelector('.rhythm-timeline').innerHTML=Object.keys(draft).filter(k=>draft[k]>0).map(k=>`<span class="phase-${k}" style="flex:${draft[k]}">${labels[k]}</span>`).join('');
    }
    for(const k in draft)panel.querySelector('#live-'+k).oninput=e=>{draft[k]=Number(e.target.value);paint();};
    panel.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{Object.assign(draft,{inS:b.dataset.preset==='gentle'?3.5:4,holdS:0,outS:b.dataset.preset==='gentle'?4.5:b.dataset.preset==='even'?4:6,restS:0});paint();});
    panel.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=()=>panel.close());
    panel.querySelector('[data-apply]').onclick=()=>{
      App.breathShape={...draft};App.breathFixed=panel.querySelector('#exactRhythm').checked;
      for(const k in draft){const el=document.getElementById(original[k]);el.value=draft[k];el.dispatchEvent(new Event('input',{bubbles:true}));}
      try{localStorage.setItem('slowlight.breathFixed',String(App.breathFixed));}catch{}
      if(App.running){G.breath.queueShape(draft,App.breathFixed);App.toast('Your new rhythm will begin with the next breath.');}
      panel.close();
    };
    paint();panel.showModal();
  }
  panel.addEventListener('close',()=>opener?.focus());
  document.getElementById('btnRhythm').onclick=open;
  document.getElementById('setupRhythm').onclick=open;
})();
