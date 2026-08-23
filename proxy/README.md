# Slow Light — ElevenLabs proxy

A tiny Cloudflare Worker that holds the ElevenLabs API key as an **encrypted
secret** so the public site (GitHub Pages) gets full voice, listening, and
scenery — while the key never appears in git, in the browser, or on the page.

## One-time deploy (~10 minutes)

1. Make a free Cloudflare account at dash.cloudflare.com (no card needed).
2. In a terminal:

       npm install -g wrangler
       cd ~/Documents/g-data/slow-light/proxy
       wrangler login              # opens the browser once
       wrangler deploy             # prints your URL, e.g. https://slow-light-proxy.YOURNAME.workers.dev
       wrangler secret put ELEVENLABS_KEY
                                   # paste the API key when prompted — this is
                                   # the only place it ever lives server-side

3. Open `site-config.js` (in the folder above this one) and set:

       proxy: "https://slow-light-proxy.YOURNAME.workers.dev"

4. Commit and push. site-config.js is meant to be public — the proxy URL is
   not a secret; the worker only answers your site and only for the orb's
   endpoints, with a per-visitor rate cap.

## Afterwards

- Strangers on the Pages site get the full ElevenLabs experience; the worker
  adds the key on their behalf and they can never see it.
- Your local voice-config.js (gitignored) still works and takes precedence
  when present — local testing goes straight to ElevenLabs with your key.
- To change which sites may use the proxy, edit ALLOWED_ORIGINS in
  wrangler.toml and run `wrangler deploy` again.
- To revoke everything at once, delete the worker in the Cloudflare dashboard
  (or rotate the key in ElevenLabs and update the secret).

Free-tier limits (100,000 requests/day) are far beyond what the orb uses.
