import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requested = pathname === '/' ? '/index.html' : pathname;
    if (requested.split('/').some(part => part.startsWith('.')) || !contentTypes[extname(requested)]) {
      throw new Error('Not a public asset');
    }
    const filename = await realpath(resolve(root, `.${requested}`));
    const fromRoot = relative(root, filename);
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot) || !(await stat(filename)).isFile()) {
      throw new Error('Not a public asset');
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filename).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.on('error', error => {
  console.error(`Could not start the preview: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`The generative model essay is ready at http://127.0.0.1:${port}`);
  console.log('Press Ctrl+C to stop. Rebuild after editing TypeScript; refresh after editing the page.');
});
