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

// Inject script to disable service worker in dev mode
const DEV_SW_DISABLE_SCRIPT = `
<script>
  // DEV MODE: Unregister service worker for instant CSS/JS updates
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(r => r.unregister());
    });
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    console.log('[DEV] Service worker disabled, caches cleared');
  }
</script>
`;

// Legacy/static mode asset injection (used by `npm run test:serve` and `npm run dev:legacy`).
// Replaces the Vite dev entrypoint with the precompiled esbuild outputs in /dist.
const LEGACY_ASSET_INJECTION = `
<link rel="stylesheet" href="/dist/app.css" />
<script src="/dist/app.js"></script>
`;

async function main() {
  const { port } = parseArgs(process.argv);
  const rootDir = process.cwd();

  console.log('\n🌱 Garden Fence Dev Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✓ Service worker disabled for instant updates');
  console.log('✓ All caches cleared on page load');
  console.log('✓ No-store headers on all responses\n');

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

      let data = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Inject SW disable script into HTML
      if (ext === '.html') {
        let html = data.toString('utf-8');
        // Insert right after <head> tag
        html = html.replace(/<head>/i, `<head>${DEV_SW_DISABLE_SCRIPT}`);
        // Swap Vite entrypoint for compiled assets when serving statically.
        html = html.replace(
          /<script\s+type=["']module["']\s+src=["']\/src\/app\.ts["']\s*><\/script>/i,
          LEGACY_ASSET_INJECTION,
        );
        data = Buffer.from(html, 'utf-8');
      }

      // Aggressive no-cache headers
      res.writeHead(200, {
        'content-type': contentType,
        'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'pragma': 'no-cache',
        'expires': '0',
        'surrogate-control': 'no-store',
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
    console.log(`🚀 Server: http://127.0.0.1:${port}`);
    console.log('\n💡 Tip: Just refresh the page to see CSS/JS changes!\n');
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
