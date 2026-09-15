# Deploying Slow Light with full ElevenLabs features

The key never goes in git. It lives in the host's environment variables —
the same idea as a .env file, entered once in the dashboard.

## Vercel (recommended — everything in this one repo)

1. vercel.com → **Add New… → Project** → import `GDataLabs/slow-light`.
   Framework preset: **Other**. Deploy.
2. Project → **Settings → Environment Variables** → add
   `ELEVENLABS_KEY` = your ElevenLabs API key, and
   `ANTHROPIC_KEY` = your Anthropic (Claude) API key from console.anthropic.com —
   this powers the orb's mind (`api/orb.js`), which writes every spoken line
   fresh instead of repeating a script. Optional: `ANTHROPIC_MODEL` to pick a
   model (default `claude-haiku-4-5`). Redeploy (Deployments → ⋯ → Redeploy).
   Without `ANTHROPIC_KEY` the orb still works, using its scripted lines.
3. Done. The site is at `https://<project>.vercel.app`; the proxy in
   `api/eleven/` deploys with it automatically, and `site-config.js` already
   points the orb at `/api/eleven`. Every future `git push` redeploys both.

Optional hardening: add `ALLOWED_ORIGINS` env var (comma-separated origins)
if other sites should be allowed to use the proxy; same-site requests are
always allowed.

## GitHub Pages

Pages can't run functions, so by default the orb there uses the browser
voice. To give Pages the full experience, set `proxy` in `site-config.js`
to your full Vercel URL (`https://<project>.vercel.app/api/eleven`) and add
`https://<yourname>.github.io` to the Vercel `ALLOWED_ORIGINS` variable.

## Cloudflare Worker (alternative)

`proxy/` contains an equivalent standalone worker — see `proxy/README.md`.

## Local development

### GPT-Live opening check-in (optional prototype)

Add `OPENAI_API_KEY` (a project key with `gpt-live-1` access) and
`ORB_LIVE_ENABLED=true` to the server environment, then redeploy. Keep both in
the hosting dashboard or a gitignored `.env.local`, never in `site-config.js`
or `voice-config.js`. The intro's **Try a live voice check-in** option becomes
available when `/api/orb-live` reports it is configured. This availability check
does not prove the account has model access; the first real connection does.
The existing `ANTHROPIC_KEY` powers optional delegated reflections.

For a local trial, put those settings in `.env.local` and run `npm run dev`,
then open `http://127.0.0.1:8765/orb.html`. This runs the local live endpoint.
The public brain configuration still points local visits at the existing Vercel
backend; change `brain` in `site-config.js` to `/api/orb` to test a local
Anthropic key too. `npm start` remains a static preview without API functions.

Live session creation accepts only its own origin and origins explicitly in
`ALLOWED_ORIGINS`. For GitHub Pages, add its exact HTTPS origin to that variable.
Unlike older endpoints, localhost is not automatically allowed on a remote host.
The route fixes the model, voice, storage, and event permissions server-side;
clients cannot supply arbitrary session configuration. Close requests require a
short-lived signed ticket for the created session. Startup is limited to three
requests per IP per minute per running function instance. This is a small pilot,
not a distributed quota or authenticated public-service boundary; add host-level
access protection and durable usage controls before opening a larger trial.

The prototype covers the opening feelings conversation only. **Review my words**
ends microphone capture and voice playback immediately, then drains the close
event, with a server hangup fallback. Only a visitor-reviewed answer enters the
existing journey; the numeric and destination questions remain app-controlled.
It also ends on page hiding, navigation, errors, a detected crisis, and after
three minutes. The three-minute limit is a browser lifecycle control, not a
server-enforced spending limit. Transcript safety checks happen concurrently
with playback and cannot approve every spoken word in advance.

No live recording is requested (`store: false`), and transcripts and diagnostic
timings are not written to browser storage. Provider retention policies still
apply. Optional delegated reflections send up to 6,000 characters of conversation
to the existing brain endpoint. The reviewed answer may participate in existing
journey processing and opt-in visualization requests.

At the documented $0.05/minute, a three-minute voice connection costs about $0.15,
plus backend usage. WebRTC initialization bills 15 seconds, credited once running.
See the [official model pricing](https://developers.openai.com/api/docs/models/gpt-live-1)
and [WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live).

Before enabling beyond a pilot, compare live and usual check-ins on actual desktop
and mobile devices: interrupt mid-sentence, correct a feeling, pause for 20 seconds,
deny the microphone, switch tabs, cut the network, review/edit the transcript, and
continue through the intensity slider. Check echo, caption accuracy, perceived
response delay, pause comfort, actual microphone release, and provider usage.
The review panel reports startup time and final voice duration; it does not claim
to measure end-of-turn latency from transcript fragments.

`voice-config.js` (gitignored) next to orb.html holds your key for local
testing; with it present the orb calls ElevenLabs directly and ignores the
proxy. `.env`, `.env.*`, and `.vercel/` are gitignored too.

### Gemini Live and spoken scene choices

The opening check-in now has a provider selector for **GPT-Live 1** and
**Gemini Live**. Each option is available only when its server configuration and
browser audio support are present. The existing guided ElevenLabs voice continues
through the rest of the journey. Scene confirmations and continue/wait choices
listen automatically after the Orb finishes speaking. Visitors can say “yes”,
“not quite”, “change that”, “stay here”, or “continue” where applicable. Unclear
answers leave the question open; the buttons and **Speak an answer** retry remain
available. This uses the existing speech recognition service.

For Gemini, set these server environment variables and redeploy:

- `GEMINI_API_KEY`: your Google Gemini API key, with Live API access and quota.
- `ORB_GEMINI_LIVE_ENABLED=true`.
- Optional `GEMINI_LIVE_MODEL`: defaults to `gemini-3.1-flash-live-preview`.

No permanent Gemini key is sent to the browser. `/api/orb-live` issues a one-use
token constrained to the server's model and conversation configuration. The token
allows a new connection for one minute and expires after four minutes. The browser
ends the conversation after three minutes, when hidden, or when reviewing words.
Gemini streams microphone PCM over a token-authenticated WebSocket, supports
interruptions, and supplies input/output captions for the same review flow as GPT.
Audio capture runs in an AudioWorklet; playback sources, microphone tracks, and the
socket close together. HTTPS (or localhost), WebSockets and AudioWorklet support
are required. Google processes this optional live audio; existing journey processing
applies to the words the visitor reviews and chooses to use.

GPT Live troubleshooting: `credit_balance_exhausted` means the OpenAI project
behind this website's `OPENAI_API_KEY` needs API credits. It is not a temporary
rate limit, and a ChatGPT subscription does not configure this website's API
billing. Keep the existing `ORB_LIVE_ENABLED=true` setting. The app now explains
this distinction instead of suggesting an immediate retry.

References: [OpenAI Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live),
[Gemini WebSocket setup](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket),
and [Gemini ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens).

Validation: `npm test` covers token constraints, origin checks, provider availability,
credit errors, spoken-choice matching, Gemini setup, PCM streaming, interruption,
mute and resource cleanup. Test both providers with real microphone audio after
credentials are configured; mocked transports cannot verify voice quality, echo,
account access or provider-side behavior.

### Optional camera reference

In the intro, expand **See myself in the visualization**, then select **Take my
photo**. Camera permission is requested only from that button; microphone audio
is not requested. Capture shuts the camera off and shows a preview. **Use photo
and enable video** approves the reference and enables living visuals; canceling
or retaking does not upload a draft.

Approved photos are resized and re-encoded as bounded JPEG data in memory for the
current visit. They are not added to browser storage, conversation requests, or
signed job tickets. Video submissions send the approved reference through the
existing server route to fal. The existing `FAL_KEY` is used; no additional key is
required. Provider retention policies apply. Removing the photo during the journey
stops visuals, cancels outstanding generation where possible, and clears the local
reference; it does not promise deletion of data already processed by fal.

When a photo is approved, signed scene prompts opt into
`minimax/h3-max/reference-to-video`. The first reference is always the approved
photo; subsequent clips also include the preceding final frame as Image 2. Signed
continuity includes a hash of the reference so changing or removing it cannot
silently reuse an incompatible sequence. Nature-only requests retain their existing
text-to-video / image-to-video routes. The conversation model receives only the
photo-mode flag, not the photo, and does not infer personal attributes from it.

The feature requires HTTPS or localhost and a browser with camera access. Camera
capture, late permission cancellation, tab hiding, approval/removal, reference
validation and continuity are covered by tests. Browser checks use a simulated
camera and no real photo upload. Actual likeness and motion quality still need a
visitor-approved photo test; identity consistency is not guaranteed.
