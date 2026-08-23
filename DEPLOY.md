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

`voice-config.js` (gitignored) next to orb.html holds your key for local
testing; with it present the orb calls ElevenLabs directly and ignores the
proxy. `.env`, `.env.*`, and `.vercel/` are gitignored too.
