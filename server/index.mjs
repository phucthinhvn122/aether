// Optional production server: serves the built app (dist/) and the same-origin proxy.
// Usage: npm run build && npm run serve
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROXY_PATH, handleProxy } from './proxy-core.mjs';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT) || 8787;
const host = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(root, pathname));
  if (!file.startsWith(root)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(root, 'index.html');
  }
  try {
    const data = await readFile(file);
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
    if (file.includes(`${join(root, 'assets')}`)) {
      res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    }
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found. Did you run `npm run build`?');
  }
}

createServer((req, res) => {
  if ((req.url ?? '').startsWith(PROXY_PATH)) {
    void handleProxy(req, res);
    return;
  }
  void serveStatic(req, res);
}).listen(port, host, () => {
  console.log(`Aether running at http://${host}:${port}`);
});
