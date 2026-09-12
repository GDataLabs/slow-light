/* Fixed fal route; signed prompts and job URLs prevent an open generation proxy. */
const { sign, verify } = require('../lib/orb-visual');
const buckets = new Map();
const queue = 'https://queue.fal.run/';
function safeURL(value) {
  const u = new URL(value);
  if (u.origin !== 'https://queue.fal.run' || !u.pathname.startsWith('/minimax/') || u.username || u.password) throw Error('Invalid queue URL');
  return u.href;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, ''));
  let same = false;
  try { same = new URL(origin).host === req.headers.host; } catch {}
  if (origin && !same && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) && !allowed.includes(origin)) return res.status(403).json({ error: 'Origin not allowed.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  const key = process.env.FAL_KEY;
  if (!key) return res.status(503).json({ error: 'Living visuals are not connected yet.' });
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid request.' }); }
  if (!body || !['submit', 'status', 'cancel'].includes(body.action)) return res.status(400).json({ error: 'Invalid action.' });
  let ticket;
  try { ticket = verify(body.ticket, key); } catch { return res.status(400).json({ error: 'This visualization has expired.' }); }
  const call = async (url, method, input) => {
    const r = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Authorization: 'Key ' + key, 'Content-Type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) });
    if (!r.ok) throw Error('Video service unavailable');
    return r.status === 204 ? {} : r.json();
  };
  try {
    if (body.action === 'submit') {
      if (ticket.kind !== 'prompt' || typeof ticket.prompt !== 'string') return res.status(400).json({ error: 'Invalid prompt.' });
      let continuity = null;
      if (body.continuity != null) {
        try {
          continuity = verify(body.continuity, key);
          if (continuity.kind !== 'continuity' || typeof continuity.anchor !== 'string' ||
              ![continuity.first, continuity.latest].every(u => typeof u === 'string' && new URL(u).protocol === 'https:')) throw Error();
        } catch { return res.status(400).json({ error: 'This place cannot be continued. Please keep the current scene.' }); }
      }
      const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0];
      const now = Date.now();
      for (const [id, b] of buckets) if (now - b.time > 600000) buckets.delete(id);
      const b = buckets.get(ip) || { time: now, count: 0 };
      if (b.count >= 24) return res.status(429).json({ error: 'Visuals are resting. Please try again later.' });
      b.count++; buckets.set(ip, b);
      const anchor = continuity ? continuity.anchor : ticket.prompt;
      const references = continuity ? [...new Set([continuity.first, continuity.latest])] : [];
      const direction = continuity
        ? `Continue the same place shown in Video ${references.length}, from its ending. Video 1 anchors the original location and visual identity. Preserve the exact terrain, landmarks, vegetation, palette, time of day, camera position and viewing direction. One continuous nearly still shot. No new location, scene reset, cut or camera jump. Original place: ${anchor} Only gently evolve light, mist, water or drifting particles in response to this direction, ignoring any proposed change of setting: ${ticket.prompt}`
        : ticket.prompt;
      const j = await call(queue + 'minimax/h3-max/' + (continuity ? 'reference-to-video' : 'text-to-video'), 'POST', {
        ...(continuity ? { reference_video_urls: references } : {}),
        prompt: direction, duration: 5, resolution: '480P', aspect_ratio: '16:9',
        enable_safety_checker: true, prompt_expansion_mode: 'balanced'
      });
      const job = { kind: 'job', anchor, first: continuity?.first || null, status: safeURL(j.status_url), result: safeURL(j.response_url), cancel: safeURL(j.cancel_url) };
      return res.status(200).json({ ticket: sign(job, key) });
    }
    if (ticket.kind !== 'job') return res.status(400).json({ error: 'Invalid job.' });
    if (body.action === 'cancel') {
      await call(safeURL(ticket.cancel), 'PUT');
      return res.status(200).json({ cancelled: true });
    }
    const status = await call(safeURL(ticket.status), 'GET');
    if (status.error) throw Error('Generation failed');
    if (status.status !== 'COMPLETED') return res.status(200).json({ status: status.status });
    const result = await call(safeURL(ticket.result), 'GET');
    const url = new URL(result.video.url);
    if (url.protocol !== 'https:') throw Error('Invalid video');
    return res.status(200).json({ status: 'COMPLETED', url: url.href,
      continuity: sign({ kind: 'continuity', anchor: ticket.anchor, first: ticket.first || url.href, latest: url.href }, key)
    });
  } catch {
    return res.status(502).json({ error: 'The visualization could not finish. Your Orb is still here.' });
  }
};
