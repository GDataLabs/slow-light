/* Slow Light — ElevenLabs proxy (Cloudflare Worker)
 *
 * The API key lives HERE, as an encrypted Cloudflare secret — never in git,
 * never in the browser. The orb calls this worker; the worker adds the key
 * and forwards the request to ElevenLabs.
 *
 * Protections:
 *   · endpoint allowlist — only the calls the orb actually makes
 *   · origin check      — only your site(s) may call it (ALLOWED_ORIGINS)
 *   · rate limit        — per-visitor requests/minute cap (best effort)
 *
 * Deploy (once):
 *   1. npm install -g wrangler          (or: npm create cloudflare@latest)
 *   2. cd proxy && wrangler deploy
 *   3. wrangler secret put ELEVENLABS_KEY     ← paste the key when prompted
 *   4. put the printed workers.dev URL into site-config.js as `proxy`
 */

const ALLOW = [
  { m: "GET",  p: /^\/v1\/user$/ },
  { m: "GET",  p: /^\/v1\/voices$/ },
  { m: "GET",  p: /^\/v1\/shared-voices$/ },
  { m: "POST", p: /^\/v1\/voices\/add\/[^/]+\/[^/]+$/ },
  { m: "POST", p: /^\/v1\/text-to-speech\/[^/]+$/ },
  { m: "POST", p: /^\/v1\/speech-to-text$/ },
  { m: "POST", p: /^\/v1\/sound-generation$/ },
  { m: "POST", p: /^\/v1\/flows\/(image|video)$/ },
  { m: "GET",  p: /^\/v1\/flows\/(image|video)\/[^/]+$/ },
];

const RATE_LIMIT_PER_MIN = 80;      // one session speaks well under this
const bucket = new Map();           // best-effort, per-isolate

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin.replace(/\/+$/, ""));
    const cors = corsHeaders(originOk ? origin : "null");

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!originOk) return new Response("This proxy only serves its own site.", { status: 403, headers: cors });

    // best-effort per-visitor rate limit
    const ip = req.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    const rec = bucket.get(ip) || { t: now, n: 0 };
    if (now - rec.t > 60000) { rec.t = now; rec.n = 0; }
    rec.n++; bucket.set(ip, rec);
    if (bucket.size > 5000) bucket.clear();
    if (rec.n > RATE_LIMIT_PER_MIN) return new Response("Slow down a little.", { status: 429, headers: cors });

    const ok = ALLOW.some(a => a.m === req.method && a.p.test(url.pathname));
    if (!ok) return new Response("Endpoint not allowed.", { status: 403, headers: cors });

    if (!env.ELEVENLABS_KEY) return new Response("Proxy has no key configured.", { status: 500, headers: cors });

    const headers = new Headers();
    const ct = req.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    headers.set("xi-api-key", env.ELEVENLABS_KEY);

    const upstream = await fetch("https://api.elevenlabs.io" + url.pathname + url.search, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : req.body,
    });

    const out = new Response(upstream.body, { status: upstream.status });
    out.headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
