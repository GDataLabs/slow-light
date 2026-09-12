/* World Labs image-to-world gateway. Provider keys stay on the server. */
const { sign, verify } = require('../lib/orb-visual');
const buckets = new Map();
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
  const key = process.env.WORLDLABS_KEY;
  if (!key) return res.status(503).json({ error: '3D worlds are not connected yet.' });
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid request.' }); }
  if (!body || !['submit', 'status'].includes(body.action)) return res.status(400).json({ error: 'Invalid action.' });
  const call = async (path, input) => {
    const r = await fetch('https://api.worldlabs.ai/marble/v1/' + path, {
      method: input ? 'POST' : 'GET', signal: AbortSignal.timeout(25000),
      headers: {'WLT-Api-Key':key,'Content-Type':'application/json'},
      ...(input ? {body:JSON.stringify(input)} : {})
    });
    if(!r.ok) throw Error('World service unavailable');
    return r.json();
  };
  try {
    if(body.action==='submit') {
      let direction;
      try { direction=verify(body.ticket,process.env.FAL_KEY); if(direction.kind!=='prompt') throw Error(); }
      catch { return res.status(400).json({error:'A current Orb scene is required.'}); }
      if(typeof body.frame!=='string' || body.frame.length>1500000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.frame))
        return res.status(400).json({error:'A video frame is required.'});
      const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];
      const now=Date.now();
      for(const [id,b] of buckets) if(now-b.time>3600000) buckets.delete(id);
      const b=buckets.get(ip)||{time:now,count:0};
      if(b.count>=2) return res.status(429).json({error:'Please rest this world builder for a while.'});
      b.count++;buckets.set(ip,b);
      const operation=await call('worlds:generate',{
        display_name:'Slow Light — your place',model:process.env.WORLDLABS_MODEL||'marble-1.1',
        permission:{public:false,allow_id_access:false},
        world_prompt:{type:'image',image_prompt:{source:'data_base64',data_base64:body.frame.split(',')[1],extension:'jpg'},
          text_prompt:'Build an explorable calm environment matching this image: preserve its visible layout, landmarks, colors and viewpoint. Extend coherently beyond the frame with accessible open space. No people, frightening content, text or hazards. Scene direction: '+direction.prompt}
      });
      if(!/^[\w-]+$/.test(operation.operation_id)) throw Error();
      return res.status(200).json({ticket:sign({kind:'world-job',id:operation.operation_id},key)});
    }
    let job;
    try {job=verify(body.ticket,key);if(job.kind!=='world-job'||!/^[\w-]+$/.test(job.id))throw Error();}
    catch{return res.status(400).json({error:'This world request has expired.'});}
    const operation=await call('operations/'+job.id);
    if(operation.error) throw Error();
    if(!operation.done) return res.status(200).json({status:'GENERATING'});
    const world=operation.response;
    const url=world?.assets?.splats?.spz_urls?.['100k']||world?.assets?.splats?.spz_urls?.['500k'];
    if(!url || new URL(url).protocol!=='https:') throw Error();
    return res.status(200).json({status:'READY',url});
  } catch {return res.status(502).json({error:'This world could not be completed. Your video is still available.'});}
};
