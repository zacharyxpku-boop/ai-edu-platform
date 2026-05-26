#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const webRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'docs', 'web-app-preview');
const requestedPort = process.env.WEB_PREVIEW_PORT ? Number(process.env.WEB_PREVIEW_PORT) : 0;
const requestedDebugPort = process.env.WEB_PREVIEW_DEBUG_PORT ? Number(process.env.WEB_PREVIEW_DEBUG_PORT) : 0;
let activeDebugPort = requestedDebugPort;
const captureOfficialSite = process.argv.includes('--site') || process.env.WEB_PREVIEW_SITE === '1';
const serveRoot = captureOfficialSite ? repoRoot : webRoot;
const routeBasePath = captureOfficialSite ? '/app' : '';
const outputPrefix = captureOfficialSite ? 'site-' : '';
const screenshotTimeoutMs = process.env.WEB_PREVIEW_SCREENSHOT_TIMEOUT_MS
  ? Number(process.env.WEB_PREVIEW_SCREENSHOT_TIMEOUT_MS)
  : 20000;
const headlessMode = process.env.WEB_PREVIEW_HEADLESS || '--headless=new';

const defaultPages = ['home', 'upload', 'report', 'tutor', 'review', 'parent'];
const requestedPages = process.env.WEB_PREVIEW_PAGES
  ? process.env.WEB_PREVIEW_PAGES.split(',').map((page) => page.trim()).filter(Boolean)
  : defaultPages;
const desktopPages = requestedPages;
const mobilePages = requestedPages;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function chromeCandidates() {
  const env = process.env;
  const candidates = [
    env.CHROME_PATH,
    env.GOOGLE_CHROME_SHIM,
    path.join(env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'google-chrome',
    'chrome',
    'chromium',
    'msedge'
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function findChrome() {
  for (const candidate of chromeCandidates()) {
    if (candidate.includes(path.sep) && fs.existsSync(candidate)) return candidate;
    if (!candidate.includes(path.sep)) return candidate;
  }
  throw new Error('Chrome or Edge was not found. Set CHROME_PATH to enable screenshot capture.');
}

function safeResolve(requestPath) {
  const parsed = new URL(requestPath || '/', 'http://127.0.0.1');
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/app') pathname = '/app/index.html';
  if (pathname === '/') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';
  const full = path.resolve(serveRoot, `.${pathname}`);
  if (!full.startsWith(serveRoot)) return null;
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAvailablePort(preferredPort = 0) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(preferredPort, '127.0.0.1', () => {
      const address = probe.address();
      const foundPort = typeof address === 'object' && address ? address.port : preferredPort;
      probe.close(() => resolve(foundPort));
    });
  });
}

async function waitForExit(child, timeoutMs = 3000) {
  if (child.exitCode !== null || child.killed) return;
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    wait(timeoutMs)
  ]);
}

async function stopChrome(child) {
  if (!child) return;
  if (process.platform === 'win32' && child.pid) {
    try {
      childProcess.execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });
    } catch (_) {
      if (child.exitCode === null) child.kill();
    }
  } else if (child.exitCode === null) {
    child.kill();
  }
  await waitForExit(child);
  await wait(500);
}

async function removeDirWithRetries(dir) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      if (!fs.existsSync(dir)) return;
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 23) {
        console.warn(`Warning: could not remove temporary Chrome profile ${dir}: ${error.message}`);
        return;
      }
      await wait(750);
    }
  }
}

async function waitForJson(endpoint, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
    } catch (_) {
      // Chrome is still starting.
    }
    await wait(150);
  }
  throw new Error(`Timed out waiting for ${endpoint}`);
}

function startChrome(chrome, userDataDir, debugPort) {
  const args = [
    headlessMode,
    '--no-sandbox',
    '--single-process',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-features=UseSkiaRenderer,Vulkan',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    '--single-process',
    '--hide-scrollbars',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];
  return childProcess.spawn(chrome, args, {
    stdio: 'ignore',
    windowsHide: true
  });
}

async function newTarget(targetUrl) {
  const response = await fetch(`http://127.0.0.1:${activeDebugPort}/json/new?${encodeURIComponent(targetUrl)}`, {
    method: 'PUT'
  });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}

function cdpSocket(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let counter = 0;

  function failPending(error) {
    for (const { reject } of pending.values()) {
      reject(error);
    }
    pending.clear();
  }

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
      else resolve(message.result || {});
    }
  });

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('close', () => {
    failPending(new Error('Chrome DevTools socket closed before command completed'));
  });
  socket.addEventListener('error', () => {
    failPending(new Error('Chrome DevTools socket errored before command completed'));
  });

  async function send(method, params = {}) {
    await opened;
    const id = ++counter;
    let timeoutId;
    const result = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for Chrome DevTools command ${method}`));
      }, cdpCommandTimeoutMs);
      pending.set(id, { resolve, reject });
    }).finally(() => clearTimeout(timeoutId));
    socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  return {
    send,
    close: () => socket.close()
  };
}

async function capturePage(chrome, base, page, viewport, suffix) {
  const targetUrl = `${base}${routeBasePath}/#${page}`;
  const filename = `${outputPrefix}${page}-${suffix}-current.png`;
  const outputPath = path.join(outDir, filename);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuandian-web-capture-'));
  const args = [
    headlessMode,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-gpu-compositing',
    '--disable-accelerated-2d-canvas',
    '--disable-accelerated-video-decode',
    '--disable-features=UseSkiaRenderer,VizDisplayCompositor,GpuRasterization,Vulkan',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--disable-dev-shm-usage',
    `--window-size=${viewport.width},${viewport.height}`,
    `--screenshot=${outputPath}`,
    `--user-data-dir=${userDataDir}`,
    targetUrl
  ];

  try {
    await new Promise((resolve, reject) => {
      const child = childProcess.spawn(chrome, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true
      });
      let stderr = '';
      const timeoutId = setTimeout(() => {
        if (child.exitCode === null) {
          stopChrome(child).catch(() => {});
        }
        reject(new Error(`Timed out capturing ${page} ${suffix} screenshot`));
      }, screenshotTimeoutMs);

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.once('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timeoutId);
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
          return;
        }
        reject(new Error(`Chrome screenshot failed for ${page} ${suffix}: ${stderr.trim() || `exit ${code}`}`));
      });
    });
  } finally {
    await removeDirWithRetries(userDataDir);
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const chrome = findChrome();
  const server = createServer();
  const activePort = await getAvailablePort(requestedPort);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(activePort, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${activePort}`;

  try {
    for (const page of desktopPages) {
      await capturePage(chrome, base, page, { width: 1536, height: 1024, mobile: false }, 'desktop');
    }

    for (const page of mobilePages) {
      await capturePage(chrome, base, page, { width: 390, height: 844, mobile: true }, 'mobile');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const files = fs.readdirSync(outDir)
    .filter((file) => {
      if (!file.endsWith('-current.png')) return false;
      if (!requestedPages.some((page) => file.includes(`-${page}-`))) return false;
      return captureOfficialSite ? file.startsWith(outputPrefix) : !file.startsWith('site-');
    })
    .sort();
  const label = captureOfficialSite ? 'official /app Web preview' : 'Web preview';
  console.log(`Captured ${files.length} ${label} screenshots to ${path.relative(repoRoot, outDir)}.`);
  files.forEach((file) => console.log(`- ${file}`));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
