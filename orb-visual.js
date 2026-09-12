/* Optional buffered five-second clips. No transcripts or media are stored here. */
(() => {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let epoch = 0, busy = false, prompt = null, continuity = null, job = null;
  let perMoment = 0;
  let timer, controller, videos = [], active = -1, count = 0, paused = false, ended = false, onShow;
  const status = text => { $('livingStatus').textContent = text; };
  const api = async (action, ticket, signal, previous) => {
    const r = await fetch(window.SLOWLIGHT_PUBLIC?.video || '/api/orb-video', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ticket, ...(previous ? { continuity: previous } : {}) }), signal: signal || AbortSignal.timeout(15000)
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'Visuals are unavailable.');
    return data;
  };
  const cancel = ticket => { if (ticket) api('cancel', ticket).catch(() => {}); };
  function invalidate() {
    epoch++; clearTimeout(timer); controller?.abort(); cancel(job); job = null;
  }
  function schedule() {
    clearTimeout(timer);
    if (view.enabled && !paused && !ended && prompt && count < 12 && perMoment < 3)
      timer = setTimeout(pump, 1200);
  }
  async function play(url, generation) {
    const next = (active + 1) % 2;
    const video = videos[next];
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
    if (epoch !== generation) return;
    const previous = videos[active];
    if (previous && !previous.ended) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => done(Error('Playback did not finish.')), 20000);
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
    await video.play();
    if (epoch !== generation) { video.pause(); return; }
    onShow?.();
    video.classList.add('on');
    if (active >= 0) {
      const old = videos[active]; old.classList.remove('on');
      setTimeout(() => { if (!old.classList.contains('on')) old.pause(); }, 3500);
    }
    active = next; view.showing = true;
  }
  async function pump() {
    if (busy || !view.enabled || paused || ended || !prompt || count >= 12 || document.hidden) return;
    busy = true;
    const generation = epoch, ticket = prompt;
    controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 120000);
    try {
      status(view.showing ? 'Your next scene is taking shape…' : 'Making a place from your answers…');
      count++; perMoment++;
      // Do not abort submission: retain its job ticket so stop can cancel it.
      const submitted = await api('submit', ticket, undefined, continuity);
      if (epoch !== generation) { cancel(submitted.ticket); return; }
      job = submitted.ticket;
      let result;
      do {
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (epoch !== generation) return;
        result = await api('status', job, controller.signal);
      } while (result.status !== 'COMPLETED');
      job = null;
      if (epoch !== generation) return;
      if (!result.continuity) throw Error("The place could not be continued.");
      await play(result.url, generation);
      if (epoch === generation) continuity = result.continuity;
      if (epoch === generation) status(count >= 12 ? 'Your place is ready. Rest here as long as you like.' : 'Living scene · shaped by your answers');
    } catch (e) {
      if (epoch === generation) {
        cancel(job); job = null; ended = true;
        status('Visuals are resting. Your Orb can continue.');
      }
    } finally {
      clearTimeout(deadline); busy = false; schedule();
    }
  }
  const view = window.OrbVisual = {
    enabled: false, showing: false,
    start(options) {
      onShow = options.onShow;
      if (!options.enabled) return;
      $('livingControls').hidden = false;
      if (reduced.matches) { status('Still scenery follows your reduced-motion preference.'); $('livingPause').hidden = true; return; }
      this.enabled = true;
      videos = [0, 1].map(() => {
        const v = document.createElement('video');
        v.muted = true; v.loop = false; v.style.transition = 'opacity .7s ease'; v.playsInline = true; v.preload = 'auto';
        v.setAttribute('aria-hidden', 'true'); $('backdrop').appendChild(v); return v;
      });
      $('livingPause').onclick = () => {
        paused = !paused;
        $('livingPause').textContent = paused ? 'Resume visuals' : 'Pause visuals';
        $('livingPause').setAttribute('aria-pressed', String(paused));
        if (paused) { invalidate(); videos.forEach(v => v.pause()); status('Visuals paused'); }
        else { if (active >= 0 && !videos[active].ended) videos[active].play().catch(() => {}); status('Living scene'); schedule(); }
      };
    },
    update(ticket) { if (!this.enabled || ended) return; prompt = ticket; perMoment = 0; schedule(); },
    unavailable() { if (this.enabled && !prompt) status("Living visuals are unavailable. Your Orb can continue."); },
    finish() { ended = true; invalidate(); status('Your place is ready. Rest here as long as you like.'); },
    stop() {
      this.enabled = false; this.showing = false; ended = true; invalidate();
      videos.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); });
      videos = []; active = -1; continuity = null; $('livingControls').hidden = true;
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
