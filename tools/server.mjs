import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.glb':'model/gltf-binary','.gltf':'model/gltf+json'};
export async function sendFile(req, res, absolute, extraHeaders = {}) {
  const info = await stat(absolute);
  if (!info.isFile()) return false;
  const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}-${info.ctimeMs.toString(16)}"`;
  const headers = {'Content-Type': mime[path.extname(absolute)] || 'application/octet-stream', 'Cache-Control':'no-cache','ETag':etag,'Last-Modified':info.mtime.toUTCString(),'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  const validators = String(req.headers['if-none-match'] || '').split(',').map(value => value.trim().replace(/^W\//, ''));
  if (validators.includes('*') || validators.includes(etag.replace(/^W\//, ''))) {res.writeHead(304,{...headers,...extraHeaders});res.end();return true;}
  let start = 0, end = info.size - 1, status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      if (match[1]) {start = Number(match[1]);end = match[2] ? Math.min(Number(match[2]),end) : end;}
      else {start = Math.max(0, info.size - Number(match[2]));}
    }
    if (!match || !(match[1] || match[2]) || start > end || start >= info.size) {res.writeHead(416, {'Content-Range':`bytes */${info.size}`,...extraHeaders});res.end();return true;}
    status = 206;headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length'] = Math.max(0,end-start+1);
  res.writeHead(status, {...headers,...extraHeaders});
  if (req.method === 'HEAD' || info.size === 0) res.end();
  else createReadStream(absolute,{start,end}).on('error',()=>res.destroy()).pipe(res);
  return true;
}
export function createServer(root, entry = '/index.html') {
  const absoluteRoot = path.resolve(root);
  return http.createServer(async (req, res) => {
    const port = req.socket.localPort;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) {
      res.writeHead(403);res.end();return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (pathname.split('/').some((segment, index) => segment.startsWith('.') &&
        !(index === 1 && segment === '.well-known' && pathname.startsWith('/.well-known/')))) {
      res.writeHead(404);res.end();return;
    }
    if (pathname === '/' && entry !== '/index.html') { res.writeHead(302, {Location:entry});res.end();return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    try {
      const target = await realpath(path.resolve(absoluteRoot, '.' + pathname));
      const relative = path.relative(await realpath(absoluteRoot), target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {res.writeHead(403);res.end();return;}
      if (!mime[path.extname(target)] && relative.startsWith('_external/fonts.googleapis.com/css')) {
        // The archive CSS fallback never applied to error responses.
        const writeHead = res.writeHead;
        res.writeHead = function(status, headers) {
          if ([200,206,304].includes(status)) headers['Content-Type'] = 'text/css';
          return writeHead.call(this,status,headers);
        };
      }
      if (!await sendFile(req,res,target)) {res.writeHead(404);res.end();}
    } catch (error) {
      // Chrome probes this optional resource even when the archive has no icon.
      if (pathname === '/favicon.ico' && error.code === 'ENOENT') {
        res.writeHead(204); res.end(); return;
      }
      res.writeHead(404, {'Content-Type':'text/plain'});res.end('Not archived: '+pathname);
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = path.resolve(process.argv[2] || '.');
  const config = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(project,'local.json'),'utf8'));
  const port = Number(process.env.PORT || process.argv[3] || config.port);
  const server = createServer(path.join(project,config.root || 'public'),config.entry || '/index.html');
  server.listen(port,'127.0.0.1',()=>console.log(`Local game: http://127.0.0.1:${port}${config.entry || '/'}`));
}
