import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const rootPrefix = root.endsWith(sep) ? root : root + sep;
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function sendFile(response, filePath, method) {
  const file = await stat(filePath);
  if (!file.isFile()) throw new Error('Not a file');
  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
    'Content-Length': file.size,
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (method === 'HEAD') response.end();
  else response.end(await readFile(filePath));
}

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  if (request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
    return;
  }

  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const candidate = resolve(root, '.' + pathname);
    if (candidate !== root && !candidate.startsWith(rootPrefix)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      await sendFile(response, candidate, method);
    } catch {
      await sendFile(response, resolve(root, 'index.html'), method);
    }
  } catch {
    response.writeHead(400).end('Bad Request');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Talesh Taxi web server listening on port ${port}`);
});
