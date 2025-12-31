#!/usr/bin/env node
/* eslint-disable no-console */

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function parseArgs(argv) {
  const args = { port: 4173 };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--port') {
      args.port = Number(argv[i + 1] || args.port);
      i += 1;
    }
  }
  if (process.env.PORT) args.port = Number(process.env.PORT);
  return args;
}

function safeResolve(rootDir, urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const normalized = decoded.replace(/\\/g, '/');
  const stripped = normalized.replace(/^\/+/, '');
  const resolved = path.resolve(rootDir, stripped);
  const rootResolved = path.resolve(rootDir);
  if (!resolved.startsWith(rootResolved)) return null;
  return resolved;
}

async function main() {
  const { port } = parseArgs(process.argv);
  const rootDir = process.cwd();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
      const filePath = safeResolve(rootDir, pathname);

      if (!filePath) {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Bad request');
        return;
      }

      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'content-type': contentType,
        'cache-control': 'no-store',
      });
      res.end(data);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Static server running at http://127.0.0.1:${port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

