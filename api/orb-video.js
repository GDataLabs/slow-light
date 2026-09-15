/* Fixed fal route; signed prompts and job URLs prevent an open generation proxy. */
const { createHash } = require('node:crypto');
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
    if (!r.ok) { const error=Error('Video service returned '+r.status);error.upstreamStatus=r.status;throw error; }
    return r.status === 204 ? {} : r.json();
  };
  try {
    if (body.action === 'submit') {
      if (ticket.kind !== 'prompt' || typeof ticket.prompt !== 'string') return res.status(400).json({ error: 'Invalid prompt.' });
      const personalized=ticket.includePortrait===true;
      let reference=null, referenceHash=null;
      if(personalized){
        reference=body.referencePhoto;
        if(typeof reference!=='string' || reference.length>450000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(reference))
          return res.status(400).json({error:'Please take and approve a reference photo before generating your video.'});
        const bytes=Buffer.from(reference.split(',')[1],'base64');
        if(bytes.length<4 || bytes[0]!==255 || bytes[1]!==216 || bytes.at(-2)!==255 || bytes.at(-1)!==217)
          return res.status(400).json({error:'The reference photo must be a JPEG image.'});
        referenceHash=createHash('sha256').update(reference).digest('hex');
      }else if(body.referencePhoto!=null)return res.status(400).json({error:'This scene was prepared without a photo. Begin a new visualization to include yourself.'});
      let continuity = null;
      if (body.continuity != null) {
        try {
          continuity = verify(body.continuity, key);
          if (continuity.kind !== 'continuity' || typeof continuity.anchor !== 'string' ||
              ![continuity.first, continuity.latest].every(u => typeof u === 'string' && new URL(u).protocol === 'https:')) throw Error();
        } catch { return res.status(400).json({ error: 'This place cannot be continued. Please keep the current scene.' }); }
      }
      if(continuity && (continuity.referenceHash || null)!==referenceHash)
        return res.status(400).json({error:'The reference photo changed. Begin a new visualization to use a different photo.'});
      if (continuity && (typeof body.frame !== 'string' || body.frame.length > 1500000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.frame)))
        return res.status(400).json({ error: 'The previous final frame is required to continue.' });
      const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0];
      const now = Date.now();
      for (const [id, b] of buckets) if (now - b.time > 600000) buckets.delete(id);
      const b = buckets.get(ip) || { time: now, count: 0 };
      if (b.count >= 48) return res.status(429).json({ error: 'Visuals are resting. Please try again later.' });
      b.count++; buckets.set(ip, b);
      const duration = [5, 10, 15].includes(ticket.duration) ? ticket.duration : 5;
      const anchor = continuity ? continuity.anchor : ticket.prompt;

      const direction = continuity
        ? `Start exactly from ${personalized ? "Image 2" : "the supplied image"}, the final frame of the previous segment. Advance the action forward from this moment; never replay or reverse the previous action. Preserve the exact terrain, landmarks, vegetation, viewing direction and slow forward camera speed. Continue one unhurried forward glide from the supplied frame; never return to an earlier camera position. Include visible gentle natural movement, with no turns, roll, zoom or acceleration. No new location, scene reset, cut or camera jump. Original place (spatial reference only; old lighting and time of day do not override the current direction): ${anchor} Gently advance swaying vegetation, drifting mist, flowing water or moving sand along with the slow camera glide in response to this direction, allowing explicitly requested gradual changes to sunlight, weather, palette or time of day while preserving the terrain. The latest requested change takes priority over old atmospheric descriptions: ${ticket.prompt}`
        : ticket.prompt;
      const j = await call(queue + 'minimax/h3-max/' + (personalized ? 'reference-to-video' : continuity ? 'image-to-video' : 'text-to-video'), 'POST', {
        ...(personalized ? {reference_image_urls:continuity ? [reference,body.frame] : [reference],aspect_ratio:'16:9'} : continuity ? { image_url: body.frame } : { aspect_ratio: '16:9' }),
        prompt: direction + (personalized ? " Image 1 is the visitor’s approved appearance reference. Show that same person with consistent facial features, hairstyle and clothing; do not infer their mood or health from the photo. " + (continuity ? "Image 2 is the final frame of the preceding clip. Begin from its composition and preserve both the person and environment while continuing the requested action." : "Place the person naturally within the requested scene, seen from an external viewpoint.") : "") + " Audio: quiet natural environmental sounds synchronized with what is visible. Gentle restrained volume, no sudden loud sounds. No speech, dialogue, narration, singing, or music. Do not carry water sounds into an aerial or dry environment.", duration, resolution: '480P',
        enable_safety_checker: true, prompt_expansion_mode: 'balanced'
      });
      const job = { kind: 'job', referenceHash, anchor, first: continuity?.first || null, status: safeURL(j.status_url), result: safeURL(j.response_url), cancel: safeURL(j.cancel_url) };
      return res.status(200).json({ ticket: sign(job, key), duration });
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
      continuity: sign({ kind: 'continuity', referenceHash: ticket.referenceHash || null, anchor: ticket.anchor, first: ticket.first || url.href, latest: url.href }, key)
    });
  } catch (error) {
    return res.status(502).json({ error: error.upstreamStatus ? `The video provider returned ${error.upstreamStatus} during ${body.action}.` : 'The video provider could not complete this request.' });
  }
};
