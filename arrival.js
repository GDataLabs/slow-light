/* A self-paced grounding path. No sensors, network calls, or automatic progress. */
(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'sl-dialog';
  dialog.setAttribute('aria-labelledby', 'dialogTitle');
  document.body.append(dialog);
  let opener, step = 0;
  const steps = [
    ['5', 'Find five things you can see.', 'Let your eyes settle on ordinary things around you. Notice a color, an edge, or the way light falls. Name them quietly, if you like.'],
    ['4', 'Notice four things you can feel.', 'The floor beneath your feet. Fabric against your skin. The support of a chair. Choose sensations that feel comfortable.'],
    ['3', 'Listen for three sounds.', 'A nearby hum, something in the distance, or a sound you make yourself. There is no need to search hard.'],
    ['2', 'Notice two things you can smell.', 'If nothing comes to mind, think of two familiar scents you enjoy. You can also use another sense.'],
    ['1', 'Notice one thing you can taste.', 'Perhaps a sip of water, or a familiar flavor you can imagine. Let your breathing find its own comfortable pace.']
  ];
  function open() {
    opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
  }
  function shell(label, content) {
    dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">${label}</span><button class="plain-link dialog-close" data-close aria-label="Close dialog">Close ✕</button></div>${content}`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
  }
  dialog.addEventListener('close', () => { if(opener?.isConnected) opener.focus(); });
  function ground() { step=0; renderGround(); open(); }
  function renderGround() {
    const [number, title, body] = steps[step];
    shell('A GROUNDING MOMENT', `<div class="ground-progress" aria-label="Step ${step+1} of 5">${steps.map((_,i)=>`<i class="${i<=step?'done':''}"></i>`).join('')}</div><div class="ground-mark" aria-hidden="true">${number}</div><h2 id="dialogTitle" tabindex="-1">${title}</h2><p>${body}</p><p class="small">Take as long as you need. Skip any sense that isn’t available or comfortable for you.</p><div class="ground-tools"><button class="btn" data-next>${step===4?'Finish this moment':'I’m ready for the next step'} →</button><button class="plain-link" data-skip>Skip this step</button>${step?'<button class="plain-link" data-back>Back</button>':''}</div>`);
    const next=()=>{if(step<4){step++;renderGround();}else complete();};
    dialog.querySelector('[data-next]').onclick=next;
    dialog.querySelector('[data-skip]').onclick=next;
    const back=dialog.querySelector('[data-back]'); if(back) back.onclick=()=>{step--;renderGround();};
    dialog.querySelector('h2').focus();
  }
  function complete() {
    shell('02 / NOTICE AGAIN', '<div class="ground-mark" aria-hidden="true">◌</div><h2 id="dialogTitle" tabindex="-1">Where are you now?</h2><p>There’s no feeling you’re supposed to arrive at. Just notice what’s here.</p><div class="ground-feedback"><button class="btn ghost" data-feeling="easier">A little more settled</button><button class="btn ghost" data-feeling="same">About the same</button><button class="btn ghost" data-feeling="harder">More unsettled</button></div><p class="small">This grounding moment is not saved to your history.</p>');
    dialog.querySelectorAll('[data-feeling]').forEach(b=>b.onclick=()=>{
      const harder=b.dataset.feeling==='harder';
      shell('ONE SMALL NEXT STEP', `<h2 id="dialogTitle" tabindex="-1">${harder?'You can stop here.':b.dataset.feeling==='same'?'You haven’t done it wrong.':'Make a little room for that.'}</h2><p>${harder?'Return to something familiar around you. You don’t need to keep practicing. Consider reaching out to someone you trust.':b.dataset.feeling==='same'?'A practice doesn’t have to change your feelings to count as time you gave yourself. You can rest, get a drink of water, or reach out to someone.':'Before moving on, choose one small thing: a sip of water, a stretch if comfortable, or a message to someone you trust.'}</p><div class="ground-tools"><button class="btn" data-return>Return to my check-in</button><button class="plain-link" data-help>Find human support ↗</button></div>`);
      dialog.querySelector('[data-return]').onclick=()=>dialog.close();
      dialog.querySelector('[data-help]').onclick=support;
      dialog.querySelector('h2').focus();
    });
    dialog.querySelector('h2').focus();
  }
  function support() {
    shell('YOU DON’T HAVE TO DO THIS ALONE', '<h2 id="dialogTitle" tabindex="-1">A person can help.</h2><p>You can reach out before things become a crisis. Consider someone you trust or a qualified mental health professional.</p><p>In the US, the 988 Lifeline offers free, confidential support, 24/7.</p><div class="support-links"><a href="tel:988">Call 988</a><a href="sms:988">Text 988</a><a href="https://988lifeline.org/chat/" target="_blank" rel="noopener noreferrer">Chat with 988 ↗</a><a href="https://findahelpline.com/" target="_blank" rel="noopener noreferrer">Find support in your country ↗</a></div><p class="small">If you are in immediate danger, contact your local emergency services. Slow Light is a self-guided wellbeing tool, not treatment or an emergency service.</p>');
    if(!dialog.open) open();
    dialog.querySelector('h2').focus();
  }
  function privacy() {
    let remember=true;
    try{remember=localStorage.getItem('slowlight.remember')!=='false';}catch{}
    shell('YOUR SPACE, YOUR CHOICE', `<h2 id="dialogTitle" tabindex="-1">Your words belong to you.</h2><p>The check-in and sensory journey run in your browser. Optional microphone and camera signals are processed here, without recording or uploading them.</p><p>Saved reflections are stored in this browser, not an account. Other people using the same browser may be able to see them.</p><label><input type="checkbox" id="rememberSessions" ${remember?'checked':''}><span>Keep future session reflections on this device.</span></label><p class="small">Turning this off also stops saving future goals. It does not remove previous reflections. Manage those from <a href="history.html">Your reflections</a>.</p><p class="small">The separate Orb experience uses external AI and voice services. This page also loads fonts from Google. Avoid entering identifying details in the Orb.</p><p class="status" role="status" id="privacyStatus"></p>`);
    open();
    dialog.querySelector('#rememberSessions').onchange=e=>{
      try {localStorage.setItem('slowlight.remember',String(e.target.checked));document.querySelector('#saveNotice').textContent=e.target.checked?'This session is kept in this browser only. You can manage saving from Privacy & your data on the check-in page.':'Saving is off. This session and its notes will not be kept after you leave.';dialog.querySelector('#privacyStatus').textContent='Preference saved.';}
      catch{dialog.querySelector('#privacyStatus').textContent='This browser could not save your preference.';}
    };
  }
  window.Arrival={updateSuggestion(keys, intensity){
    const title=document.querySelector('#suggestionTitle'),body=document.querySelector('#suggestionText');
    if(intensity>=8){title.textContent='Start with something around you.';body.textContent='When things feel intense, a simple grounding moment may be easier than following a breathing rhythm. You can also reach out to a person.';}
    else if(keys.some(k=>['numb','heavy','sad'].includes(k))){title.textContent='A little contact with the present.';body.textContent='Notice the support beneath you or a familiar sound. Choose a grounding moment, or explore the rooms at your own pace.';}
    else if(keys.length){title.textContent='Give this feeling a little space.';body.textContent='Your journey moves through weather, a slow garden, grounding, and light. Sound and sensors are optional. You can stop at any time.';}
    else{title.textContent='You can start without the words.';body.textContent='Choose what feels closest, or take a grounding moment first. You don’t need to explain how you feel.';}
  }};
  document.querySelectorAll('[data-ground]').forEach(b=>b.onclick=ground);
  document.querySelectorAll('[data-support]').forEach(b=>b.onclick=support);
  document.querySelector('#privacyBtn').onclick=privacy;
  document.querySelector('#unsureBtn').onclick=()=>{App.clearStates();App.begin();};
  document.querySelector('#suds').addEventListener('input',()=>Arrival.updateSuggestion(App.orderedKeys(),+document.querySelector('#suds').value));
  const lt=document.querySelector('#listToggle');lt.setAttribute('aria-controls','quickChips');lt.setAttribute('aria-expanded','false');lt.addEventListener('click',()=>lt.setAttribute('aria-expanded',String(!document.querySelector('#quickChips').classList.contains('hide'))));
  Arrival.updateSuggestion(App.orderedKeys(),+document.querySelector('#suds').value);
  try{if(localStorage.getItem('slowlight.remember')==='false')document.querySelector('#saveNotice').textContent='Saving is off. This session and its notes will not be kept after you leave.';}catch{}
})();
