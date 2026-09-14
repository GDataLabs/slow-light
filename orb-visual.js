/* Optional buffered clips of varying duration. No transcripts or media are stored here. */
(() => {
  const MAX_CLIPS = 24;
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let epoch = 0, busy = false, prompt = null, continuity = null, job = null;
  let finalFrame = null, displayedPrompt=null;
  const waiters=new Set();
  const notify=(ticket)=>{for(const fn of [...waiters])fn(ticket);};
  let hold, retireTimer, retireDone, retired=Promise.resolve();
  let audioEnabled=false,audioMuted=false,audioDucked=false,audioBlocked=false;
  function mixAudio(){
    for(const v of videos){v.volume=v===videos[active] ? (audioDucked?.045:.22) : 0;v.muted=!audioEnabled || audioMuted || audioBlocked || v!==videos[active];}
  }
  function startAudio(){
    mixAudio();
    const v=videos[active];
    if(!v || v.ended || paused || document.hidden || !audioEnabled || audioMuted || audioBlocked)return;
    v.play().catch(()=>{if(v!==videos[active])return;audioBlocked=true;mixAudio();v.play().catch(()=>{});status("Environmental audio was blocked. Tap the sound button to try again.");});
  }
  let timer, controller, videos = [], active = -1, count = 0, paused = false, ended = false, onShow;
  const status = text => { $('livingStatus').textContent = text; };
  const api = async (action, ticket, signal, previous, frame) => {
    const r = await fetch(window.SLOWLIGHT_PUBLIC?.video || '/api/orb-video', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ticket, ...(previous ? { continuity: previous, frame } : {}) }), signal: signal || AbortSignal.timeout(15000)
    });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) { const error=Error(data.error || `Video service returned ${r.status}.`); error.status=r.status; throw error; }
    return data;
  };
  const cancel = ticket => { if (ticket) api('cancel', ticket).catch(() => {}); };
  function invalidate() {
    epoch++; clearTimeout(timer); controller?.abort(); cancel(job); job = null;
  }
  function schedule() {
    clearTimeout(timer);
    if (view.enabled && !paused && !ended && prompt && count < MAX_CLIPS)
      timer = setTimeout(pump, 0);
  }
  async function extractFinalFrame(url, signal) {
    const decoder = document.createElement('video');
    decoder.crossOrigin = 'anonymous'; decoder.muted = true; decoder.preload = 'auto';
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => done(Error('The final frame could not load.')), 20000);
        const abort = () => done(Error('Stopped'));
        const done = (error, data) => {
          clearTimeout(timeout); signal.removeEventListener('abort', abort);
          decoder.onloadeddata = decoder.onseeked = decoder.onerror = null;
          error ? reject(error) : resolve(data);
        };
        signal.addEventListener('abort', abort, {once:true});
        if(signal.aborted) { abort(); return; }
        decoder.onerror = () => done(Error('The final frame could not load.'));
        decoder.onloadeddata = () => {
          decoder.onloadeddata = null;
          if(!Number.isFinite(decoder.duration) || decoder.duration <= 0) return done(Error('Invalid clip duration.'));
          decoder.currentTime = Math.max(0, decoder.duration - .001);
        };
        decoder.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 960 / decoder.videoWidth);
            canvas.width = Math.round(decoder.videoWidth * scale);
            canvas.height = Math.round(decoder.videoHeight * scale);
            if(!canvas.width || !canvas.height) throw Error('No final frame.');
            canvas.getContext('2d').drawImage(decoder, 0, 0, canvas.width, canvas.height);
            done(null, canvas.toDataURL('image/jpeg', .9));
          } catch(e) { done(Error('The final frame could not be read.')); }
        };
        decoder.src = url; decoder.load();
      });
    } finally { decoder.pause(); decoder.removeAttribute('src'); decoder.load(); }
  }
  async function prepareClip(url, generation) {
    await retired;
    if(epoch!==generation)throw Error("Stopped");
    const next = (active + 1) % 2;
    const video = videos[next];
    video.classList.remove("on");video.style.opacity="";
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => done(Error('The clip could not load.')), 20000);
      const done = error => {
        clearTimeout(timeout); video.oncanplay = video.onerror = null;
        controller.signal.removeEventListener('abort', abort);
        error ? reject(error) : resolve();
      };
      const abort = () => done(Error('Stopped'));
      controller.signal.addEventListener('abort', abort, { once: true });
      video.oncanplay = () => done(); video.onerror = () => done(Error('The clip could not load.'));
      video.src = url; video.load();
    });
    return {video,next};
  }
  async function play(prepared, generation, ticket, frame) {
    const {video,next}=prepared;
    if (epoch !== generation) return;
    const previous = videos[active];
    if (previous && !previous.ended) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => done(Error('Playback did not finish.')), Math.max(20000, (previous.duration + 10) * 1000));
        const done = error => {
          clearTimeout(timeout);
          previous.removeEventListener('ended', complete);
          controller.signal.removeEventListener('abort', abort);
          error ? reject(error) : resolve();
        };
        const complete = () => done();
        const abort = () => done(Error('Stopped'));
        previous.addEventListener('ended', complete, { once: true });
        controller.signal.addEventListener('abort', abort, { once: true });
      });
    }
    if (epoch !== generation) return;
    // Do not uncover the old view until the replacement has a decoded frame.
    const signal=controller.signal;
    await new Promise((resolve,reject)=>{
      let callback, settled=false;
      const timeout=setTimeout(()=>done(Error('The next video did not produce a frame.')),15000);
      const abort=()=>done(Error('Stopped'));
      function done(error){
        if(settled)return;settled=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);
        if(callback!==undefined)video.cancelVideoFrameCallback?.(callback);
        error?reject(error):resolve();
      }
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted){abort();return;}
      if(video.requestVideoFrameCallback)callback=video.requestVideoFrameCallback(()=>done());
      video.play().then(()=>{if(!video.requestVideoFrameCallback)done();},done);
    });
    if (epoch !== generation) { video.pause(); return; }
    clearTimeout(retireTimer);
    const old=videos[active];
    // Keep the outgoing layer fully opaque under the incoming fade. Fading
    // both at once exposes the black page, especially when reusing layer zero.
    if(old)old.style.zIndex='1';
    video.style.zIndex='2';
    video.poster=frame;
    video.classList.add('on');
    active=next;view.showing=true;
    mixAudio();
    video.onended=()=>{
      if(!view.enabled || videos[active]!==video)return;
      hold.src=frame;hold.classList.add('on');
      video.style.opacity='0';
    };
    document.body.classList.add('living-video');
    onShow?.(ticket);
    startAudio();
    if(old)retired=new Promise(resolve=>{
      retireDone=resolve;
      retireTimer=setTimeout(()=>{
        if(videos[active]!==old){old.classList.remove('on');old.pause();}
        retireDone=null;resolve();
      },750);
    });
  }
  async function pump() {
    if (busy || !view.enabled || paused || ended || !prompt || count >= MAX_CLIPS || document.hidden) return;
    busy = true;
    const generation = epoch, ticket = prompt;
    controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 120000);
    let phase="submitting the next clip";
    try {
      status(view.showing ? 'Your next scene is taking shape…' : 'Making a place from your answers…');
      count++;
      // Do not abort submission: retain its job ticket so stop can cancel it.
      const submitted = await api('submit', ticket, undefined, continuity, finalFrame);
      if (epoch !== generation) { cancel(submitted.ticket); return; }
      job = submitted.ticket;
      status(`Creating clip ${count} of ${MAX_CLIPS} · ${submitted.duration || 5} seconds`);
      phase="waiting for generation";
      let result, pollFailures=0;
      do {
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (epoch !== generation) return;
        try { result = await api('status', job, controller.signal); pollFailures=0; }
        catch(error) {
          if(controller.signal.aborted || (error.status && error.status<500) || ++pollFailures>2) throw error;
          status(`Clip ${count}: connection interrupted; checking the same request again…`);
          result={status:'PENDING'};
        }
      } while (result.status !== 'COMPLETED');
      job = null;
      if (epoch !== generation) return;
      if (!result.continuity) throw Error("The place could not be continued.");
      phase="reading the final frame";
      status(`Preparing clip ${count} · preserving its final frame…`);
      const [frame,prepared] = await Promise.all([
        extractFinalFrame(result.url, controller.signal),
        prepareClip(result.url, generation)
      ]);
      if(epoch !== generation) return;
      phase="playing the next clip";
      await play(prepared, generation, ticket, frame);
      if (epoch === generation) { continuity = result.continuity; finalFrame = frame; displayedPrompt=ticket; notify(ticket); }
      if (epoch === generation) status(count >= MAX_CLIPS ? `${MAX_CLIPS}-clip session limit reached · holding the final view` : 'Living scene · moving forward from the previous frame');
    } catch (e) {
      if (epoch === generation) {
        cancel(job); job = null; ended = true; notify(null);
        status(`Stopped while ${phase}: ${e.name==='AbortError' ? 'The request timed out.' : e.message} Your current view is held.`);
        $('livingRetry').hidden=false;
      }
    } finally {
      clearTimeout(deadline); busy = false; schedule();
    }
  }
  const view = window.OrbVisual = {
    enabled: false, showing: false,
    get audioBlocked(){return audioBlocked;},
    setAudio({enabled=audioEnabled,muted=audioMuted,ducked=audioDucked,retry=false}={}){
      const activating=enabled && !muted && (!audioEnabled || audioMuted);
      audioEnabled=enabled;audioMuted=muted;audioDucked=ducked;
      if(retry)audioBlocked=false;
      mixAudio();if(retry || activating)startAudio();
    },
    waitFor(ticket) {
      if(!ticket || !this.enabled || ended || count>=MAX_CLIPS && !busy) return Promise.resolve(false);
      if(displayedPrompt===ticket) return Promise.resolve(true);
      return new Promise(resolve=>{
        const done=value=>{clearTimeout(timeout);waiters.delete(check);resolve(value);};
        const check=value=>{if(value===ticket)done(true);else if(value===null)done(false);};
        const timeout=setTimeout(()=>done(false),60000);waiters.add(check);
      });
    },
    snapshot() {
      if(active<0 || !prompt) throw Error('Wait for a video to appear first.');
      const v=videos[active], canvas=document.createElement('canvas');
      canvas.width=v.videoWidth; canvas.height=v.videoHeight;
      canvas.getContext('2d').drawImage(v,0,0);
      const frame=canvas.toDataURL('image/jpeg',.85);
      if(!paused) $('livingPause').click();
      return {frame,ticket:prompt};
    },
    start(options) {
      onShow = options.onShow;
      if (!options.enabled) return;
      $('livingControls').hidden = false;
      if (reduced.matches) { status('Still scenery follows your reduced-motion preference.'); $('livingPause').hidden = true; return; }
      this.enabled = true;
      hold=document.createElement('img');hold.alt='';hold.setAttribute('aria-hidden','true');
      hold.style.cssText='z-index:0;transition:none;filter:none';$('backdrop').appendChild(hold);
      videos = [0, 1].map(() => {
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous'; v.muted = true; v.loop = false; v.style.transition = 'opacity .7s ease'; v.playsInline = true; v.preload = 'auto';
        v.setAttribute('aria-hidden', 'true'); $('backdrop').appendChild(v); return v;
      });
      $('livingRetry').onclick=()=>{
        if(count>=MAX_CLIPS) {status(`${MAX_CLIPS}-clip session limit reached · holding the final view`);return;}
        ended=false;$('livingRetry').hidden=true;schedule();
      };
      $('livingPause').onclick = () => {
        paused = !paused;
        $('livingPause').textContent = paused ? 'Resume visuals' : 'Pause visuals';
        $('livingPause').setAttribute('aria-pressed', String(paused));
        if (paused) { invalidate(); videos.forEach(v => v.pause()); status('Visuals paused'); }
        else { if (active >= 0 && !videos[active].ended) videos[active].play().catch(() => {}); status('Living scene'); schedule(); }
      };
    },
    update(ticket) { if (!this.enabled || ended || count>=MAX_CLIPS) return false; prompt = ticket; schedule(); return true; },
    unavailable() { if (this.enabled && !prompt) status("Living visuals are unavailable. Your Orb can continue."); },
    finish() {
      // The conversation can finish while the environment continues evolving.
      // Only pause, stop, reduced motion, errors or the clip budget halt it.
      schedule();
    },
    stop() {
      document.body.classList.remove("living-video");
      this.enabled = false; this.showing = false; ended = true; invalidate(); notify(null);
      clearTimeout(retireTimer);retireDone?.();retireDone=null;hold?.remove();hold=null;
      videos.forEach(v => { v.onended=null;v.pause(); v.removeAttribute('src'); v.load(); v.remove(); });
      videos = []; active = -1; continuity = null; finalFrame = null; $('livingControls').hidden = true;
    }
  };
  // Controls are later in the parsed page; wire them after DOM completion.
  document.addEventListener('DOMContentLoaded', () => { $('livingStop').onclick = () => view.stop(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && view.enabled) { invalidate(); videos.forEach(v => v.pause()); }
    else if (view.enabled && !paused) { if (active >= 0 && !videos[active].ended) videos[active].play().catch(() => {}); schedule(); }
  });
  reduced.addEventListener('change', e => { if (e.matches) view.stop(); });
  addEventListener('pagehide', () => view.stop());
})();
