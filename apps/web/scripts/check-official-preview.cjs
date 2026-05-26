#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

const checks = [
  {
    path: '/',
    type: 'text/html',
    includes: [
      '/apps/web/src/styles.css',
      '/apps/web/src/app.js',
      'name="web-app-asset-base" content="/apps/web/assets/brand"',
      'class="app-shell"'
    ]
  },
  {
    path: '/app',
    type: 'text/html',
    includes: [
      '/apps/web/src/styles.css',
      '/apps/web/src/app.js',
      'name="web-app-asset-base" content="/apps/web/assets/brand"'
    ]
  },
  {
    path: '/app/',
    type: 'text/html',
    includes: [
      '/apps/web/src/styles.css',
      '/apps/web/src/app.js',
      'name="web-app-asset-base" content="/apps/web/assets/brand"'
    ]
  },
  {
    path: '/apps/web/src/styles.css',
    type: 'text/css',
    includes: ['.app-shell', '.mobile-tabs']
  },
  {
    path: '/apps/web/src/app.js',
    type: 'javascript',
    includes: ['WEB_SURFACE_ROUTES', 'WEB_DEMO_STATE', 'web-app-asset-base']
  },
  {
    path: '/apps/web/src/routes.js',
    type: 'javascript',
    includes: ['WEB_SURFACE_ROUTES', 'WEB_ENTRY_FLOW']
  },
  {
    path: '/apps/web/src/view-model.js',
    type: 'javascript',
    includes: ['WEB_DEMO_STATE', 'WEB_PAGE_GUIDES', 'WEB_CONFIDENCE_BANDS']
  },
  {
    path: '/apps/web/assets/brand/family-report.png',
    type: 'image/png',
    minBytes: 10000
  },
  {
    path: '/apps/web/assets/brand/gudian-mascot-clean.png',
    type: 'image/png',
    minBytes: 1000
  },
  {
    path: '/apps/web/assets/brand/gudian-mascot-study-clean.png',
    type: 'image/png',
    minBytes: 1000
  }
];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function fail(message) {
  console.error(`Official preview check failed: ${message}`);
  process.exit(1);
}

function safeResolve(requestPath) {
  const parsed = new URL(requestPath || '/', 'http://127.0.0.1');
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/app') pathname = '/app/index.html';
  if (pathname === '/') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';
  const full = path.resolve(repoRoot, `.${pathname}`);
  if (!full.startsWith(repoRoot)) return null;
  return full;
}

function createServer() {
  return http.createServer((req, res) => {
    const file = safeResolve(req.url || '/');
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': mimeTypes[ext] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function fetchCheck(base, check) {
  const response = await fetch(`${base}${check.path}`);
  if (!response.ok) {
    fail(`${check.path} returned ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes(check.type)) {
    fail(`${check.path} returned unexpected content-type ${contentType}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (check.minBytes && buffer.length < check.minBytes) {
    fail(`${check.path} is too small: ${buffer.length} bytes`);
  }
  if (check.includes) {
    const text = buffer.toString('utf8');
    for (const snippet of check.includes) {
      if (!text.includes(snippet)) {
        fail(`${check.path} is missing ${snippet}`);
      }
    }
  }
}

async function main() {
  const server = createServer();
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;
  try {
    for (const check of checks) {
      await fetchCheck(base, check);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`Official preview check passed for ${checks.length} paths.`);
}

main().catch((error) => {
  fail(error.message || String(error));
});
