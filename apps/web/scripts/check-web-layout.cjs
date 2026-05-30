#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const serveRoot = repoRoot;
const routeBasePath = '/app';
const pages = ['home', 'upload', 'report', 'tutor', 'review', 'parent', 'map'];
const commandTimeoutMs = 8000;

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
  return [
    env.CHROME_PATH,
    env.GOOGLE_CHROME_SHIM,
    path.join(env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'google-chrome',
    'chrome',
    'chromium',
    'msedge'
  ].filter(Boolean);
}

function findChrome() {
  for (const candidate of chromeCandidates()) {
    if (candidate.includes(path.sep) && fs.existsSync(candidate)) return candidate;
    if (!candidate.includes(path.sep)) return candidate;
  }
  throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run Web layout checks.');
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
    process.env.WEB_PREVIEW_HEADLESS || '--headless=new',
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
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];
  return childProcess.spawn(chrome, args, { stdio: 'ignore', windowsHide: true });
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
  await wait(300);
}

async function removeDirWithRetries(dir) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      if (!fs.existsSync(dir)) return;
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (_) {
      await wait(300);
    }
  }
}

async function newTarget(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about%3Ablank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
}

function cdpSocket(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let counter = 0;

  function failPending(error) {
    for (const { reject } of pending.values()) reject(error);
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

  socket.addEventListener('close', () => failPending(new Error('Chrome DevTools socket closed')));
  socket.addEventListener('error', () => failPending(new Error('Chrome DevTools socket errored')));

  async function send(method, params = {}) {
    await opened;
    const id = ++counter;
    let timeoutId;
    const result = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for Chrome DevTools command ${method}`));
      }, commandTimeoutMs);
      pending.set(id, { resolve, reject });
    }).finally(() => clearTimeout(timeoutId));
    socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  return { send, close: () => socket.close() };
}

async function waitForApp(cdp, page) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    const result = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `Boolean(document.querySelector('h1')) && location.hash === '#${page}'`
    });
    if (result.result && result.result.value) return;
    await wait(150);
  }
  throw new Error(`Timed out waiting for #${page} to render`);
}

async function inspectPage(debugPort, base, page, viewport) {
  const target = await newTarget(debugPort);
  const cdp = cdpSocket(target.webSocketDebuggerUrl);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile
    });
    await cdp.send('Page.navigate', { url: `${base}${routeBasePath}/#${page}` });
    await waitForApp(cdp, page);
    await wait(350);

    const evaluation = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const viewportWidth = window.innerWidth;
        const required = {
          h1: Boolean(document.querySelector('h1')),
          content: Boolean(document.querySelector('#appContent > *')),
          activeNav: Boolean(document.querySelector('.mobile-tabs a.active, .nav-list a.active'))
        };
        const scroll = {
          html: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          viewport: viewportWidth
        };
        const offenders = Array.from(document.querySelectorAll('body *')).map((el) => {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return null;
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return null;
          const inHorizontalScroller = Boolean(el.closest('.game-map'));
          const offLeft = rect.left < -1;
          const offRight = rect.right > viewportWidth + 1;
          if ((!offLeft && !offRight) || inHorizontalScroller) return null;
          return {
            tag: el.tagName.toLowerCase(),
            className: String(el.className || '').slice(0, 80),
            text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          };
        }).filter(Boolean).slice(0, 8);
        const inertControls = Array.from(document.querySelectorAll('button, a')).map((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 1 || rect.height < 1) return null;
          const hasRoute = el.hasAttribute('data-route');
          const hasAction = el.hasAttribute('data-action');
          const hasHref = el.tagName.toLowerCase() === 'a' && el.hasAttribute('href');
          if (hasRoute || hasAction || hasHref) return null;
          return {
            tag: el.tagName.toLowerCase(),
            className: String(el.className || '').slice(0, 80),
            text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80)
          };
        }).filter(Boolean).slice(0, 8);
        return {
          title: document.querySelector('h1')?.textContent.trim() || '',
          required,
          scroll,
          offenders,
          inertControls,
          mobileTabs: document.querySelectorAll('.mobile-tabs a').length,
          activeHash: location.hash
        };
      })()`
    });

    return evaluation.result.value;
  } finally {
    cdp.close();
  }
}

async function inspectNavigation(debugPort, base) {
  const target = await newTarget(debugPort);
  const cdp = cdpSocket(target.webSocketDebuggerUrl);
  const routes = ['upload', 'report', 'tutor', 'review', 'parent', 'home'];
  const failures = [];

  async function navigateHome() {
    await cdp.send('Page.navigate', { url: `${base}${routeBasePath}/#home` });
    await waitForApp(cdp, 'home');
    await wait(150);
  }

  async function clickAndWait(selector, expectedHash, label) {
    const clickResult = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
        const target = nodes.find((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
        });
        if (!target) return false;
        target.click();
        return true;
      })()`
    });
    if (!clickResult.result.value) {
      failures.push(`${label}: clickable target not found (${selector})`);
      return;
    }
    await waitForApp(cdp, expectedHash);
    const hashResult = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: 'location.hash'
    });
    if (hashResult.result.value !== `#${expectedHash}`) {
      failures.push(`${label}: expected #${expectedHash}, got ${hashResult.result.value}`);
    }
  }

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });

    for (const route of routes.filter((route) => route !== 'home')) {
      await navigateHome();
      await clickAndWait(`[data-route="${route}"]`, route, `home entry to ${route}`);
      console.log(`OK mobile navigation: home -> ${route}`);
    }

    for (const route of routes) {
      await cdp.send('Page.navigate', { url: `${base}${routeBasePath}/#report` });
      await waitForApp(cdp, 'report');
      await clickAndWait(`.mobile-tabs a[href="#${route}"]`, route, `mobile tab to ${route}`);
      console.log(`OK mobile tab: report -> ${route}`);
    }
  } finally {
    cdp.close();
  }

  return failures;
}

async function inspectActions(debugPort, base) {
  const target = await newTarget(debugPort);
  const cdp = cdpSocket(target.webSocketDebuggerUrl);
  const failures = [];

  async function navigate(page) {
    await cdp.send('Page.navigate', { url: `${base}${routeBasePath}/#${page}` });
    await waitForApp(cdp, page);
    await wait(150);
  }

  async function clickAction(page, selector, label, beforeClickExpression = '') {
    await navigate(page);
    if (beforeClickExpression) {
      await cdp.send('Runtime.evaluate', { expression: beforeClickExpression });
    }
    const clickResult = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const target = document.querySelector(${JSON.stringify(selector)});
        if (!target) return { clicked: false, reason: 'missing target' };
        const rect = target.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return { clicked: false, reason: 'target has no visible size' };
        target.click();
        return { clicked: true };
      })()`
    });
    if (!clickResult.result.value.clicked) {
      failures.push(`${label}: ${clickResult.result.value.reason}`);
      return;
    }
    await wait(350);
    const toastResult = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const toast = document.querySelector('#webToast.show');
        return toast ? toast.textContent.trim() : '';
      })()`
    });
    if (!toastResult.result.value) {
      failures.push(`${label}: expected visible toast feedback`);
      return;
    }
    console.log(`OK action ${label}: ${toastResult.result.value}`);
  }

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });

    await clickAction('upload', '[data-action="mock-upload"]', 'upload mock');
    await clickAction('upload', '[data-action="select-material"]', 'select material');
    await clickAction('report', '[data-action="share-report"]', 'share report');
    await clickAction('tutor', '[data-action="send-tutor"]', 'send tutor thought', "document.querySelector('#tutorInput').value = '先算每组多少根'");
    await clickAction('tutor', '[data-action="tutor-hint"]', 'tutor hint');
    await clickAction('review', '[data-action="review-map-info"]', 'review map info');
    await clickAction('review', '[data-action="review-level"][data-level="变式挑战"]', 'review level');
    await clickAction('review', '[data-action="review-challenge"][data-level="变式挑战"]', 'review challenge');
    await clickAction('review', '[data-action="start-review"]', 'start review');
    await clickAction('parent', '[data-action="parent-question"]', 'parent question');
    await clickAction('parent', '[data-action="parent-evidence"]', 'parent evidence');
    await clickAction('parent', '[data-action="parent-evidence-all"]', 'parent evidence all');
    await clickAction('parent', '[data-action="parent-methods"]', 'parent methods');
  } finally {
    cdp.close();
  }

  return failures;
}

async function main() {
  const chrome = findChrome();
  const server = createServer();
  const activePort = await getAvailablePort(0);
  const activeDebugPort = await getAvailablePort(0);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuandian-web-layout-'));
  let chromeProcess;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(activePort, '127.0.0.1', resolve);
  });

  try {
    chromeProcess = startChrome(chrome, userDataDir, activeDebugPort);
    await waitForJson(`http://127.0.0.1:${activeDebugPort}/json/version`);
    const base = `http://127.0.0.1:${activePort}`;
    const failures = [];
    const viewports = [
      { name: 'mobile', width: 390, height: 844, mobile: true },
      { name: 'desktop', width: 1365, height: 900, mobile: false }
    ];

    for (const viewport of viewports) {
      for (const page of pages) {
        const result = await inspectPage(activeDebugPort, base, page, viewport);
        const prefix = `${viewport.name} #${page}`;
        if (result.activeHash !== `#${page}`) failures.push(`${prefix}: wrong hash ${result.activeHash}`);
        for (const [key, ok] of Object.entries(result.required)) {
          if (!ok) failures.push(`${prefix}: missing ${key}`);
        }
        if (viewport.mobile && result.mobileTabs !== 6) {
          failures.push(`${prefix}: expected 6 mobile tabs, found ${result.mobileTabs}`);
        }
        const allowedScroll = viewport.width + 1;
        if (viewport.mobile && (result.scroll.html > allowedScroll || result.scroll.body > allowedScroll)) {
          failures.push(`${prefix}: horizontal scroll html=${result.scroll.html} body=${result.scroll.body} viewport=${viewport.width}`);
        }
        if (viewport.mobile && result.offenders.length) {
          failures.push(`${prefix}: horizontal overflow ${JSON.stringify(result.offenders)}`);
        }
        if (result.inertControls.length) {
          failures.push(`${prefix}: inert controls ${JSON.stringify(result.inertControls)}`);
        }
        console.log(`OK ${prefix}: ${result.title}`);
      }
    }

    failures.push(...await inspectNavigation(activeDebugPort, base));
    failures.push(...await inspectActions(activeDebugPort, base));

    if (failures.length) {
      console.error('Web layout check failed:');
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exit(1);
    }

    console.log(`Web layout check passed for ${pages.length} pages across ${viewports.length} viewports.`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await stopChrome(chromeProcess);
    await removeDirWithRetries(userDataDir);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
