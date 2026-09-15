/* Gemini's token-authenticated audio transport shares the live review UI. */
(function(root) {
  'use strict';
  class GeminiConnection extends root.OrbLive.Connection {
    constructor(options) { super(options); this.sources = new Set(); this.playAt = 0; this.fragments = 0; }
    async start() {
      if (this.state !== 'idle') return;
      this.state = 'connecting'; this.startedAt = Date.now();
      this.status('Connecting Gemini Live…');
      this.later(() => { if (this.state === 'connecting') this.fail('Gemini Live took too long to connect.'); }, 30000);
      try {
        // Resume playback in the initiating click before awaiting network I/O.
        this.context = new (root.AudioContext || root.webkitAudioContext)({sampleRate:16000});
        const resumed = this.context.resume().catch(() => { if(this.state === 'connecting')this.options.onPlaybackBlocked?.(); });
        const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
        if (this.state !== 'connecting') { stream.getTracks().forEach(t=>t.stop()); return; }
        this.stream = stream;
        await resumed;
        if (this.state !== 'connecting') return;
        if (this.context.state !== 'running') this.options.onPlaybackBlocked?.();
        stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{ if(this.state==='active')this.fail('Microphone access ended.'); }));
        await this.context.audioWorklet.addModule('orb-gemini-capture.js');
        if (this.state !== 'connecting') return;
        this.capture = new AudioWorkletNode(this.context, 'orb-gemini-capture');
        this.mic = this.context.createMediaStreamSource(stream);
        this.mic.connect(this.capture); this.capture.connect(this.context.destination);
        this.capture.port.onmessage = ({data}) => {
          if (this.state !== 'active' || this.muted || this.socket?.readyState !== 1) return;
          const ratio = this.context.sampleRate / 16000;
          const bytes = new Uint8Array(Math.floor(data.length / ratio) * 2), view = new DataView(bytes.buffer);
          for(let i=0;i<bytes.length/2;i++) {
            const sample = Math.max(-1,Math.min(1,data[Math.floor(i*ratio)]));
            view.setInt16(i*2,Math.round(sample*(sample<0?32768:32767)),true);
          }
          this.socket.send(JSON.stringify({realtimeInput:{audio:{data:btoa(String.fromCharCode(...bytes)),mimeType:'audio/pcm;rate=16000'}}}));
        };
        const response = await fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',provider:'gemini'}),signal:AbortSignal.timeout(20000)});
        const result = await response.json();
        if (this.state !== 'connecting') return;
        if (!response.ok) throw new Error(result.error || 'Gemini Live could not connect.');
        this.socket = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(result.token));
        this.socket.onopen = () => {
          if(this.state !== 'connecting')return;
          this.socket.send(JSON.stringify({setup:result.setup}));
        };
        // Blob conversion is asynchronous: serialize messages to preserve speech order.
        let incoming = Promise.resolve();
        this.socket.onmessage = ({data}) => {
          incoming = incoming.then(async()=>this.receiveGemini(JSON.parse(typeof data==='string'?data:await data.text()))).catch(()=>this.fail('Gemini Live sent an unreadable update.'));
        };
        this.socket.onerror = () => this.fail('Gemini Live could not connect.');
        this.socket.onclose = () => { if(!['closing','closed'].includes(this.state))this.fail('Gemini Live ended the connection.'); };
      } catch(error) {
        if(!['closing','closed'].includes(this.state))this.fail(error.name==='NotAllowedError'?'Microphone permission was not granted.':error.message || 'Gemini Live could not connect.');
      }
    }
    receiveGemini(event) {
      if(['closing','closed'].includes(this.state))return;
      if(event.error) { this.fail('Gemini Live could not continue. Check the website’s Gemini model access and quota.'); return; }
      if(event.setupComplete && this.state==='connecting') {
        this.state='active'; this.connectMs=Date.now()-this.startedAt;
        this.options.onConnected?.(); this.status('Microphone on · You can speak while the Orb speaks. Pauses are welcome.');
        this.socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'Please welcome me briefly and ask what I notice about my current feeling as a texture or movement. Then listen.'}]}],turnComplete:true}}));
        this.later(()=>{this.options.onEnded?.('This short live check-in has reached three minutes. Review your words when you are ready.');void this.close();},180000);
      }
      const content=event.serverContent;
      if(!content)return;
      if(content.interrupted)this.stopPlayback();
      for(const [role,transcript] of [['input',content.inputTranscription],['output',content.outputTranscription]]) {
        if(typeof transcript?.text !== 'string')continue;
        // Reuse accumulated safety checks and captions, without inventing turn timing.
        const n=++this.fragments;
        this.receive({type:'session.'+(role==='input'?'input':'output')+'_transcript.delta',delta:transcript.text,start_ms:n,end_ms:n});
        if(this.state!=='active')return;
      }
      for(const part of content.modelTurn?.parts || []) {
        if(part.inlineData?.mimeType?.startsWith('audio/pcm'))this.playPCM(part.inlineData);
      }
    }
    playPCM({data,mimeType}) {
      if(this.state!=='active')return;
      const binary=atob(data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      if(!bytes.length || bytes.length%2)throw new Error('Invalid PCM');
      const rate=Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000);
      const buffer=this.context.createBuffer(1,bytes.length/2,rate),view=new DataView(bytes.buffer),samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
      const source=this.context.createBufferSource(); source.buffer=buffer; source.connect(this.context.destination);
      this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();};
      this.playAt=Math.max(this.playAt,this.context.currentTime); source.start(this.playAt); this.playAt+=buffer.duration;
    }
    resumePlayback() { return this.context.resume(); }
    mute() {
      const muted = super.mute();
      if (muted && this.socket?.readyState === 1) this.socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));
      return muted;
    }
    stopPlayback() { this.sources.forEach(source=>{try{source.stop();source.disconnect();}catch{}});this.sources.clear();this.playAt=0; }
    close() { if(this.state!=='closed'){this.state='closing';this.cleanup();}return Promise.resolve(); }
    cleanup() {
      this.stopPlayback(); this.capture?.disconnect(); this.mic?.disconnect();
      if(this.capture)this.capture.port.onmessage=null;
      if(this.context && this.context.state!=='closed')void this.context.close().catch(()=>{});
      this.socket?.close(); super.cleanup();
    }
  }
  root.OrbLive.GeminiConnection=GeminiConnection;
})(typeof window === 'undefined' ? globalThis : window);
