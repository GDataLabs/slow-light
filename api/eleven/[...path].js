/* Slow Light — ElevenLabs proxy (Vercel Edge Function)
 *
 * Lives in the same repo as the site. When the repo is imported as a Vercel
 * project, this file automatically becomes https://<your-app>/api/eleven/...
 *
 * The API key is NOT in this file and never in git: set it once in
 * Vercel → Project → Settings → Environment Variables as ELEVENLABS_KEY
 * (exactly the .env workflow — Vercel keeps it server-side).
 *
 * Protections: endpoint allowlist, origin check, per-visitor rate limit.
 */

export const config = { runtime: "edge" };

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

const RATE_LIMIT_PER_MIN = 80;   // one session stays well under this
const bucket = new Map();        // best-effort, per-instance

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/eleven/, "") || "/";
  const origin = req.headers.get("Origin") || "";

  // Same-site requests are always fine; other origins must be listed in the
  // optional ALLOWED_ORIGINS env var (comma-separated). Requests without an
  // Origin header (same-origin GETs, curl) pass and rely on the rate limit.
  let sameHost = false;
  try { sameHost = origin ? new URL(origin).host === url.host : false; } catch (e) {}
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const originOk = !origin || sameHost || allowed.includes(origin.replace(/\/+$/, ""));
  const cors = corsHeaders(originOk ? (origin || "*") : "null");

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!originOk) return new Response("This proxy only serves its own site.", { status: 403, headers: cors });

  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const now = Date.now();
  const rec = bucket.get(ip) || { t: now, n: 0 };
  if (now - rec.t > 60000) { rec.t = now; rec.n = 0; }
  rec.n++; bucket.set(ip, rec);
  if (bucket.size > 5000) bucket.clear();
  if (rec.n > RATE_LIMIT_PER_MIN) return new Response("Slow down a little.", { status: 429, headers: cors });

  const ok = ALLOW.some(a => a.m === req.method && a.p.test(path));
  if (!ok) return new Response("Endpoint not allowed.", { status: 403, headers: cors });

  const key = process.env.ELEVENLABS_KEY;
  if (!key) return new Response("Proxy has no key configured (set ELEVENLABS_KEY in Vercel).", { status: 500, headers: cors });

  const headers = {};
  const ct = req.headers.get("Content-Type");
  if (ct) headers["Content-Type"] = ct;
  headers["xi-api-key"] = key;

  const body = req.method === "GET" ? undefined : await req.arrayBuffer();
  const upstream = await fetch("https://api.elevenlabs.io" + path + url.search, {
    method: req.method, headers, body,
  });

  const out = new Response(upstream.body, { status: upstream.status });
  out.headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}
