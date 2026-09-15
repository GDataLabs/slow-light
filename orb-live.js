/* Optional opening conversation; the journey only receives reviewed text. */
(function(root) {
  'use strict';
  class LiveConnection {
    constructor(options = {}) {
      this.options = options;
      this.endpoint = options.endpoint || '/api/orb-live';
      this.input = []; this.output = []; this.seen = new Set(); this.delegations = new Set();
      this.state = 'idle'; this.usage = null; this.finalized = false;
      this.timers = new Set(); this.tasks = new Set();
    }
    later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); return id; }
    text(role) { return this[role].slice().sort((a,b) => a.start_ms - b.start_ms).map(f => f.delta).join(''); }
    status(text) { this.options.onStatus?.(text); }
    send(event) {
      if (this.state !== 'active' || this.channel?.readyState !== 'open') return false;
      this.channel.send(JSON.stringify(event)); return true;
    }
    async start() {
      if (this.state !== 'idle') return;
      this.state = 'connecting'; this.startedAt = Date.now();
      this.status('Connecting GPT-Live voice… You can switch to the usual check-in at any time.');
      this.later(() => { if (this.state === 'connecting') this.fail('Live voice took too long to connect.'); }, 30000);
      try {
        // This runs directly from Begin's click, before any network request.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (this.state !== 'connecting') { stream.getTracks().forEach(t => t.stop()); return; }
        this.stream = stream;
        this.peer = new RTCPeerConnection();
        this.audio = new Audio(); this.audio.autoplay = true;
        this.peer.addEventListener('track', event => {
          if (['closing','closed'].includes(this.state)) return;
          this.audio.srcObject = new MediaStream([event.track]);
          this.audio.play().catch(() => this.options.onPlaybackBlocked?.());
        });
        stream.getAudioTracks().forEach(track => {
          this.peer.addTrack(track, stream);
          track.addEventListener('ended', () => { if (this.state === 'active') this.fail('Microphone access ended.'); });
        });
        this.peer.addEventListener('connectionstatechange', () => {
          if (['failed', 'disconnected'].includes(this.peer.connectionState) && !['closing','closed'].includes(this.state)) this.fail('The live connection was interrupted.');
        });
        this.channel = this.peer.createDataChannel('oai-events');
        this.channel.addEventListener('message', ({ data }) => {
          try { this.receive(JSON.parse(data)); } catch { this.fail('Live voice sent an unreadable update.'); }
        });
        this.channel.addEventListener('close', () => {
          if (!['closing','closed'].includes(this.state)) this.fail('The live connection ended.');
        });
        await this.peer.setLocalDescription(await this.peer.createOffer());
        if (this.state !== 'connecting') return;
        await this.gatherIce();
        if (this.state !== 'connecting') return;
        // Do not abort on a user cancellation: collect a late ticket and hang up
        // the session that was created, rather than losing its identity.
        const response = await fetch(this.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', sdp: this.peer.localDescription.sdp }),
          signal: AbortSignal.timeout(25000)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Live voice could not connect.');
        this.ticket = result.ticket;
        if (this.state !== 'connecting') { await this.hangup(); return; }
        await this.peer.setRemoteDescription({ type: 'answer', sdp: result.sdp });
      } catch (error) {
        if (['closing','closed'].includes(this.state)) return;
        const message = error.name === 'NotAllowedError' ? 'Microphone permission was not granted.' : error.message;
        this.fail(message || 'Live voice could not connect.');
      }
    }
    gatherIce() {
      if (this.peer.iceGatheringState === 'complete') return Promise.resolve();
      return new Promise((resolve, reject) => {
        const peer = this.peer;
        const done = () => { if (peer.iceGatheringState === 'complete') finish(); };
        const finish = error => {
          clearTimeout(timer); this.timers.delete(timer);
          peer.removeEventListener('icegatheringstatechange', done);
          this.cancelIce = null; error ? reject(error) : resolve();
        };
        const timer = this.later(() => finish(new Error('Connection setup timed out.')), 10000);
        this.cancelIce = () => finish(new Error('Connection cancelled.'));
        peer.addEventListener('icegatheringstatechange', done); done();
      });
    }
    receive(event) {
      if (this.state === 'closed') return;
      if (event.type === 'session.closed') {
        this.finalized = true;
        if (Number.isFinite(event.usage?.seconds)) this.usage = event.usage.seconds;
        if (this.state !== 'closing') this.options.onEnded?.('The live conversation has ended. Review your words or use the usual check-in.');
        this.cleanup(); return;
      }
      if (this.state === 'closing') return;
      if (event.event_id) {
        if (this.seen.has(event.event_id)) return;
        this.seen.add(event.event_id);
      }
      if (event.type === 'session.started' && this.state === 'connecting') {
        this.state = 'active'; this.connectMs = Date.now() - this.startedAt;
        this.options.onConnected?.();
        this.status('Microphone on · You can speak while the Orb speaks. Pauses are welcome.');
        this.send({ type: 'session.instructions.append', event_id: 'orb_greeting', delegation_id: null,
          content: 'Greet immediately in English without waiting for the visitor: welcome them briefly, invite them to imagine their current feeling as a texture or a movement, and ask what they notice. Then pause and listen.' });
        this.later(() => { this.options.onEnded?.('This short live check-in has reached three minutes. Take your time reviewing your words.'); void this.close(); }, 180000);
        return;
      }
      if (event.type === 'error') { this.fail('Live voice could not continue. Your words are still available to review.'); return; }
      if (event.type === 'session.usage.updated' && Number.isFinite(event.usage?.seconds)) this.usage = event.usage.seconds;
      const role = event.type === 'session.input_transcript.delta' ? 'input' : event.type === 'session.output_transcript.delta' ? 'output' : null;
      if (role && typeof event.delta === 'string' && Number.isFinite(event.start_ms) && Number.isFinite(event.end_ms)) {
        this[role].push({ delta: event.delta, start_ms: event.start_ms, end_ms: event.end_ms });
        const text = this.text(role);
        this.options.onTranscript?.(role, text);
        // Check accumulated fragments, including phrases split across events.
        const verdict = this.options.guard?.(text);
        if (verdict === 'crisis') { this.options.onSafety?.(); void this.close(); return; }
        if (verdict === 'dark') { this.fail('Let’s return to the guided check-in and choose a gentle direction.'); return; }
        if (text.length > 12000) { this.options.onEnded?.('Let’s review what you have shared so far.'); return; }
      }
      if (event.type === 'session.delegation.created' && event.delegation?.target === 'client') void this.delegate(event.delegation.id);
    }
    async delegate(id) {
      if (this.state !== 'active' || typeof id !== 'string' || this.delegations.has(id)) return;
      this.delegations.add(id);
      const snapshot = this.text('input');
      if (!snapshot.trim()) {
        this.send({ type: 'session.thinking.append', delegation_id: id, content: 'No usable transcript is available yet. Listen and ask for clarification; do not infer a feeling.' }); return;
      }
      const task = new AbortController(); this.tasks.add(task);
      try {
        // Keep speaker order for short replies and corrections; intervals may overlap.
        const fragments = [...this.input.map(f => ({ speaker:'visitor', ...f })), ...this.output.map(f => ({ speaker:'orb', ...f }))]
          .sort((a,b) => a.start_ms - b.start_ms);
        const context = fragments.map(f => `${f.speaker}: ${f.delta}`).join('\n').slice(-6000);
        const response = await fetch(this.options.brain || '/api/orb', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'live_reflect', visualEnabled: false, person: { rawAnswer: context } }),
          signal: AbortSignal.any([task.signal, AbortSignal.timeout(8000)])
        });
        if (!response.ok) throw new Error('Backend unavailable');
        const result = await response.json();
        if (this.state !== 'active') return;
        if (result.crisis === true || this.options.guard?.(result.line || '') === 'crisis') {
          this.options.onSafety?.(); void this.close(); return;
        }
        // A correction may arrive while the backend works; never speak a stale reflection.
        if (snapshot !== this.text('input')) {
          this.send({ type: 'session.thinking.append', delegation_id: id, content: 'The visitor added or corrected their words while the reflection was prepared. Discard the old reflection and listen to their latest words.' }); return;
        }
        const line = typeof result.line === 'string' && this.options.guard?.(result.line) !== 'dark' ? result.line.slice(0,1200) : '';
        this.send({ type: 'session.commentary.append', delegation_id: id, content: line || 'Ask gently which feeling is closest; do not guess.' });
      } catch {
        this.send({ type: 'session.thinking.append', delegation_id: id, content: 'The reflection service is unavailable. Listen gently without making claims; the visitor can review their words and continue.' });
      } finally { this.tasks.delete(task); }
    }
    mute() {
      if (this.state !== 'active') return;
      this.muted = !this.muted;
      this.stream?.getAudioTracks().forEach(track => { track.enabled = !this.muted; });
      this.status(this.muted ? 'Microphone paused · Review your words to end the live conversation.' : 'Microphone on · You can interrupt or take your time.');
      return this.muted;
    }
    fail(message) {
      if (['closing','closed'].includes(this.state)) return;
      this.options.onEnded?.(message + ' Review your words, or use the usual check-in.');
      void this.close();
    }
    async hangup() {
      if (!this.ticket || this.finalized) return;
      const ticket = this.ticket;
      try {
        const response = await fetch(this.endpoint, { method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', ticket }), signal: AbortSignal.timeout(9000) });
        if (response.ok) this.hangupConfirmed = true;
      } catch { /* Retain unconfirmed finalization in the local diagnostic result. */ }
    }
    close() {
      if (this.closing) return this.closing;
      if (this.state === 'closed') return Promise.resolve();
      this.closing = new Promise(resolve => { this.resolveClose = resolve; });
      const wasActive = this.state === 'active'; this.state = 'closing';
      // End capture and playback immediately; retain the event transport to drain usage.
      this.stream?.getTracks().forEach(track => track.stop());
      if (this.audio) { this.audio.pause(); this.audio.srcObject = null; }
      this.tasks.forEach(task => task.abort()); this.cancelIce?.();
      this.timers.forEach(clearTimeout); this.timers.clear();
      if (wasActive && this.channel?.readyState === 'open') {
        this.later(async () => { await this.hangup(); this.cleanup(); }, 3000);
        try { this.channel.send(JSON.stringify({ type: 'session.close' })); } catch { void this.hangup().finally(() => this.cleanup()); }
      } else { void this.hangup().finally(() => this.cleanup()); }
      return this.closing;
    }
    cleanup() {
      this.state = 'closed';
      this.timers.forEach(clearTimeout); this.timers.clear();
      this.tasks.forEach(task => task.abort()); this.cancelIce?.();
      this.stream?.getTracks().forEach(track => track.stop());
      if (this.audio) { this.audio.pause(); this.audio.srcObject = null; }
      this.channel?.close(); this.peer?.close(); this.resolveClose?.();
    }
    dispose() {
      // pagehide may not leave time for data-channel finalization.
      void this.hangup(); this.cleanup();
    }
  }

  const OrbLive = {
    Connection: LiveConnection,
    async availability() {
      const checkbox = document.getElementById('liveOptIn');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const response = await fetch(root.SLOWLIGHT_PUBLIC?.live || '/api/orb-live', { signal: AbortSignal.timeout(5000) });
        const result = await response.json();
        if (!response.ok || !result.enabled) throw new Error('unavailable');
        const providers=result.providers || {openai:result.enabled};
        const select=document.getElementById('liveProvider');
        const supported={openai:!!root.RTCPeerConnection,gemini:!!(root.WebSocket && root.AudioWorkletNode && (root.AudioContext || root.webkitAudioContext))};
        for(const option of select.options)option.disabled=!providers[option.value] || !supported[option.value];
        if(!Array.from(select.options).some(o=>!o.disabled))throw new Error('unavailable');
        if(select.selectedOptions[0].disabled)select.value=Array.from(select.options).find(o=>!o.disabled).value;
        checkbox.disabled = false;
        document.getElementById('liveAvailability').textContent = 'Choose a live voice to begin your session. Connection and account access are checked when you begin.';
      } catch {
        checkbox.checked = false; checkbox.disabled = true;
        document.getElementById('liveAvailability').textContent = location.hostname === '127.0.0.1' || location.hostname === 'localhost' ? 'Live voice is unavailable in this local preview. Your Vercel settings apply at slow-light.vercel.app/orb.html.' : 'Live voice isn’t available here yet. The usual check-in is ready.';
      }
    },
    begin({ guard }) {
      const get = id => document.getElementById(id);
      const provider = get('liveProvider')?.value || 'openai';
      const name = provider === 'gemini' ? 'Gemini Live' : 'GPT-Live 1';
      const Connection = provider === 'gemini' ? this.GeminiConnection : LiveConnection;
      const panel = get('liveCheckIn'); panel.hidden = false;
      get('voiceModeStatus').textContent = 'Connecting ' + name + ' · Not connected yet';
      get('orbLiveFallback').focus();
      document.body.classList.add('orb-live-active');
      let settle, finished = false, reviewing = false;
      const result = new Promise(resolve => { settle = resolve; });
      const connection = this.current = new Connection({
        endpoint: root.SLOWLIGHT_PUBLIC?.live || '/api/orb-live', brain: root.SLOWLIGHT_PUBLIC?.brain || '/api/orb', guard,
        onConnected: () => { get('voiceModeStatus').textContent = name + ' connected · Live conversation'; },
        onStatus: text => { get('orbLiveStatus').textContent = text; get('orbLiveMute').disabled = connection.state !== 'active'; },
        onTranscript: (role, text) => {
          get(role === 'input' ? 'orbLiveUser' : 'orbLiveAssistant').textContent = text;
        },
        onPlaybackBlocked: () => { if (!reviewing) { get('orbLivePlay').hidden = false; get('orbLiveStatus').textContent = 'Tap Hear the Orb to enable its voice. Your microphone is on.'; } },
        onEnded: message => { void review(message); },
        onSafety: () => { void finish({ crisis: true }); }
      });
      async function finish(value) {
        if (finished) return; finished = true;
        await connection.close();
        panel.hidden = true; document.body.classList.remove('orb-live-active');
        settle(value);
      }
      async function review(message = 'Microphone off. Edit these words so they say what you mean.') {
        if (reviewing || finished) return; reviewing = true;
        get('orbLiveStatus').textContent = message;
        get('voiceModeStatus').textContent = connection.connectMs == null ? name + ' did not connect' : name + ' ended · Microphone off';
        get('orbLiveReview').disabled = true; get('orbLiveMute').disabled = true; get('orbLivePlay').hidden = true;
        get('orbLiveReviewFields').hidden = false;
        // Only the reviewed, bounded answer enters the normal journey; no auto-submit.
        get('orbLiveWords').value = connection.text('input').slice(-300).trim();
        get('orbLiveUse').disabled = !get('orbLiveWords').value.trim();
        get('orbLiveWords').focus();
        await connection.close();
        if (finished) return;
        get('orbLiveMetrics').textContent = [
          connection.connectMs == null ? 'Voice did not connect.' : `Connected in ${(connection.connectMs/1000).toFixed(1)} seconds.`,
          connection.usage == null ? 'Voice duration unavailable.' : `Voice duration: ${Math.ceil(connection.usage)} seconds.`,
          provider === 'gemini' ? 'Microphone and audio connection closed.' : connection.finalized ? 'Session ending confirmed.' : connection.hangupConfirmed ? 'Hangup confirmed; final usage unavailable.' : 'Final session usage could not be confirmed.'
        ].join(' ');
      }
      get('orbLiveWords').oninput = () => { get('orbLiveUse').disabled = !get('orbLiveWords').value.trim(); };
      get('orbLiveUse').onclick = () => { const words = get('orbLiveWords').value.trim().slice(0,300); if (words) void finish({ words }); };
      get('orbLiveFallback').onclick = () => { void finish(null); };
      get('orbLiveReview').onclick = () => { void review(); };
      get('orbLiveMute').onclick = () => {
        const muted = connection.mute(); get('orbLiveMute').textContent = muted ? 'Resume microphone' : 'Pause microphone';
        get('orbLiveMute').setAttribute('aria-pressed', String(!!muted));
      };
      get('orbLivePlay').onclick = () => { (connection.resumePlayback ? connection.resumePlayback() : connection.audio.play()).then(() => { get('orbLivePlay').hidden = true; }).catch(() => { get('orbLiveStatus').textContent = 'Audio is blocked. You can read the captions or use the usual check-in.'; }); };
      this.onHidden = () => { if (document.hidden && !finished) void review('Microphone off because you left this page. Review your words when you are ready.'); };
      document.addEventListener('visibilitychange', this.onHidden);
      const onLeave = () => connection.dispose(); root.addEventListener('pagehide', onLeave, { once: true });
      void result.then(() => { document.removeEventListener('visibilitychange', this.onHidden); root.removeEventListener('pagehide', onLeave); });
      void connection.start();
      return result;
    }
  };
  root.OrbLive = OrbLive;
})(typeof window === 'undefined' ? globalThis : window);
