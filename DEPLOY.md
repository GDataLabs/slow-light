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
