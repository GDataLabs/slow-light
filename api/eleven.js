/* Slow Light — ElevenLabs proxy (Vercel serverless function, Node runtime).
 *
 * vercel.json rewrites /api/eleven/<anything> to this function with the
 * remainder in ?path=. The API key is read from the ELEVENLABS_KEY
 * environment variable (Vercel → Settings → Environment Variables) — it is
 * never in git and never reaches the browser.
 *
 * Protections: endpoint allowlist, origin check, per-visitor rate limit.
 */

const ALLOW = [
  { m: "GET",  p: /^\/v1\/user$/ },
  { m: "GET",  p: /^\/v1\/voices$/ },
  { m: "GET",  p: /^\/v1\/shared-voices$/ },
  { m: "POST", p: /^\/v1\/voices\/add\/[^/]+\/[^/]+$/ },
  { m: "POST", p: /^\/v1\/text-to-speech\/[^/]+$/ },
  { m: "POST", p: /^\/v1\/speech-to-text$/ },
  { m: "POST", p: /^\/v1\/single-use-token\/realtime_scribe$/ },   // 15-min token for the realtime ear
  { m: "POST", p: /^\/v1\/sound-generation$/ },
  { m: "POST", p: /^\/v1\/flows\/(image|video)$/ },
  { m: "GET",  p: /^\/v1\/flows\/(image|video)\/[^/]+$/ },
];

/* Polling GETs (flow status checks) are cheap and frequent; generation POSTs
   spend credits. Budget them separately so a session's status polling can
   never crowd out its own voice. */
const RATE_LIMIT_GET_PER_MIN = 240;
const RATE_LIMIT_POST_PER_MIN = 60;
const bucket = new Map();

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  let sameHost = false;
  try { sameHost = origin ? new URL(origin).host === req.headers.host : false; } catch (e) {}
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const originOk = !origin || sameHost || allowed.includes(origin.replace(/\/+$/, ""));

  res.setHeader("Access-Control-Allow-Origin", originOk ? (origin || "*") : "null");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (!originOk) { res.status(403).send("This proxy only serves its own site."); return; }

  // best-effort per-visitor rate limit, budgeted by method
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const now = Date.now();
  const rec = bucket.get(ip) || { t: now, g: 0, p: 0 };
  if (now - rec.t > 60000) { rec.t = now; rec.g = 0; rec.p = 0; }
  if (req.method === "GET") rec.g++; else rec.p++;
  bucket.set(ip, rec);
  if (bucket.size > 5000) bucket.clear();
  const over = req.method === "GET" ? rec.g > RATE_LIMIT_GET_PER_MIN : rec.p > RATE_LIMIT_POST_PER_MIN;
  if (over) { res.status(429).send("Slow down a little."); return; }

  // path arrives via the rewrite as ?path=v1/...
  const raw = req.query.path;
  const path = "/" + (Array.isArray(raw) ? raw.join("/") : String(raw || "")).replace(/^\/+/, "");
  const ok = ALLOW.some(a => a.m === req.method && a.p.test(path));
  if (!ok) { res.status(403).send("Endpoint not allowed."); return; }

  const key = process.env.ELEVENLABS_KEY;
  if (!key) { res.status(500).send("Proxy has no key configured (set ELEVENLABS_KEY in Vercel)."); return; }

  // rebuild the query string minus our routing param
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "path") continue;
    for (const one of [].concat(v)) params.append(k, one);
  }
  const qs = params.toString();

  const headers = { "xi-api-key": key };
  const ct = req.headers["content-type"];
  if (ct) headers["Content-Type"] = ct;

  // req.body: Buffer for binary/multipart, object for JSON, string otherwise
  let body;
  if (req.method !== "GET" && req.body !== undefined) {
    body = Buffer.isBuffer(req.body) ? req.body
         : typeof req.body === "string" ? req.body
         : JSON.stringify(req.body);
  }

  // Speech-to-text: Vercel does not hand multipart uploads to functions (the
  // body arrives empty → ElevenLabs 422 "Field required"). The orb therefore
  // sends the raw recording as application/octet-stream with its fields in
  // the query string, and the multipart form is rebuilt here.
  let target = "https://api.elevenlabs.io" + path + (qs ? "?" + qs : "");
  if (path === "/v1/speech-to-text" && req.method === "POST" && !/multipart/i.test(ct || "")) {
    let audio = Buffer.isBuffer(req.body) ? req.body : null;
    if (!audio) { const parts = []; for await (const c of req) parts.push(Buffer.from(c)); audio = Buffer.concat(parts); }
    if (!audio.length) { res.status(400).send("No audio received."); return; }
    if (audio.length > 4_000_000) { res.status(413).send("Recording too long."); return; }
    const form = new FormData();
    const q = req.query || {};
    form.append("model_id", String(q.model_id || "scribe_v1"));
    for (const k of ["diarize", "language_code", "tag_audio_events"]) if (q[k] != null) form.append(k, String(q[k]));
    form.append("file", new Blob([audio], { type: String(q.mime || "audio/webm") }), "answer.webm");
    target = "https://api.elevenlabs.io/v1/speech-to-text";
    delete headers["Content-Type"];   // fetch sets the multipart boundary
    body = form;
  }

  try {
    const upstream = await fetch(target, {
      method: req.method, headers, body,
    });
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.status(502).send("Couldn't reach ElevenLabs.");
  }
};
