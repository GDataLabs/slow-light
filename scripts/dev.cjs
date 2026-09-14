/* Local static site plus API functions. Node 22+, no dependencies. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const name of ['.env', '.env.local']) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.mp4':'video/mp4' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const match = url.pathname.match(/^\/api\/(orb-live|orb|orb-video|orb-world|eleven)(?:\/(.*))?$/);
      if (!match || (match[2] && match[1] !== 'eleven')) { res.writeHead(404).end(); return; }
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 2 * 1024 * 1024) { res.writeHead(413).end(); return; }
      }
      req.body = body;
      req.query = Object.fromEntries(url.searchParams);
      if (match[2]) req.query.path = match[2];
      res.status = code => { res.statusCode = code; return res; };
      res.json = value => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(value)); };
      res.send = value => res.end(value);
      await require(path.join(root,'api',match[1]+'.js'))(req,res); return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    const parts = relative.split('/');
    if (!file.startsWith(root + path.sep) || parts.some(p => p.startsWith('.')) || ['api','lib','scripts','tests','node_modules','proxy'].includes(parts[0]) || ['voice-config.js','package.json','package-lock.json'].includes(relative)) {
      res.writeHead(404).end(); return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
}).listen(8765, '127.0.0.1', () => console.log('Slow Light: http://127.0.0.1:8765/orb.html'));
