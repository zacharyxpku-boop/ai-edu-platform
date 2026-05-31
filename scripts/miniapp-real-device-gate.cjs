#!/usr/bin/env node
'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'five-entry-walkthrough');
const reportPath = path.join(outDir, 'REAL-DEVICE-GATE.md');
const jsonPath = path.join(outDir, 'real-device-gate.json');
const projectPath = path.join(root, 'miniprogram');
const defaultPort = Number(process.env.WECHAT_DEVTOOLS_PORT || 9420);
const cliCandidates = [
  process.env.WECHAT_DEVTOOLS_CLI,
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat'
].filter(Boolean);

const expectedScreenshots = [
  {
    name: 'tab-today.png',
    route: '/pages/home/home',
    action: 'Open Today tab directly',
    expected: 'Short entry screen only; no dense retired content below the first screen'
  },
  {
    name: 'tab-tutor.png',
    route: '/pages/tutor/tutor',
    action: 'Open homework coaching tab directly',
    expected: 'Short tutor entry screen; primary CTA jumps to child/detail flow'
  },
  {
    name: 'tab-review.png',
    route: '/pages/review/review',
    action: 'Open Review Island tab directly',
    expected: 'Short review/game entry screen; no dense mission list by default'
  },
  {
    name: 'tab-parent.png',
    route: '/pages/profile/profile',
    action: 'Open Parent tab directly',
    expected: 'Parent sees key progress entry screen, not a report wall'
  },
  {
    name: 'tab-upload.png',
    route: '/pages/upload/upload',
    action: 'Open Upload tab directly',
    expected: 'Upload entry screen focuses on material intake and learning pack'
  },
  {
    name: 'child-today-first-step.png',
    route: '/pages/entry-detail/entry-detail?scene=today',
    action: 'Today primary CTA -> entry detail -> primary action',
    expected: 'Returns to tutor with open=flow and visible first-step function area'
  },
  {
    name: 'child-tutor-flow.png',
    route: '/pages/entry-detail/entry-detail?scene=tutor',
    action: 'Tutor primary CTA -> entry detail -> primary action',
    expected: 'Returns to tutor with open=flow and visible conversation composer'
  },
  {
    name: 'child-review-recall.png',
    route: '/pages/entry-detail/entry-detail?scene=review',
    action: 'Review primary CTA -> entry detail -> primary action',
    expected: 'Opens recall/review child flow for memory and transfer validation'
  },
  {
    name: 'child-report-evidence.png',
    route: '/pages/entry-detail/entry-detail?scene=report',
    action: 'Report primary CTA -> entry detail -> primary action',
    expected: 'Returns to parent report/evidence area with report reasoning visible'
  },
  {
    name: 'child-parent-report.png',
    route: '/pages/entry-detail/entry-detail?scene=parent',
    action: 'Parent primary CTA -> entry detail -> primary action',
    expected: 'Returns to parent with open=flow and visible evidence/report function area'
  },
  {
    name: 'child-upload-material.png',
    route: '/pages/entry-detail/entry-detail?scene=upload',
    action: 'Upload primary CTA -> entry detail -> primary action',
    expected: 'Returns to upload with open=flow and visible material intake function area'
  },
  {
    name: 'entry-detail-today.png',
    route: '/pages/entry-detail/entry-detail?scene=today',
    action: 'Open Today child detail page before tapping primary action',
    expected: 'Graphical child page with brand mark, scene hero, three-step path, reference-image evidence cards, and cross-entry jump cards'
  },
  {
    name: 'entry-detail-tutor.png',
    route: '/pages/entry-detail/entry-detail?scene=tutor',
    action: 'Open Tutor child detail page before tapping primary action',
    expected: 'Graphical AI tutor child page with visual hero and clear next-action buttons'
  },
  {
    name: 'entry-detail-review.png',
    route: '/pages/entry-detail/entry-detail?scene=review',
    action: 'Open Review child detail page before tapping primary action',
    expected: 'Graphical review child page with memory/transfer explanation and cross-entry jump cards'
  },
  {
    name: 'entry-detail-report.png',
    route: '/pages/entry-detail/entry-detail?scene=report',
    action: 'Open Report child detail page before tapping primary action',
    expected: 'Graphical report child page focused on evidence, confidence, and method matching before parent handoff'
  },
  {
    name: 'entry-detail-parent.png',
    route: '/pages/entry-detail/entry-detail?scene=parent',
    action: 'Open Parent child detail page before tapping primary action',
    expected: 'Graphical parent child page focused on evidence, method reasoning, and next action'
  },
  {
    name: 'entry-detail-upload.png',
    route: '/pages/entry-detail/entry-detail?scene=upload',
    action: 'Open Upload child detail page before tapping primary action',
    expected: 'Graphical upload child page focused on material classification and stable SOP'
  }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function findCli() {
  return [
    process.env.WECHAT_DEVTOOLS_CLI,
    'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
    'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
    ...cliCandidates
  ].find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 1200 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

function readPngSize(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 24) return null;
  const signature = buffer.slice(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function latestMtimeMs(dir) {
  if (!fs.existsSync(dir)) return 0;
  let latest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'miniprogram_npm'].includes(entry.name)) continue;
      latest = Math.max(latest, latestMtimeMs(full));
    } else if (/\.(js|json|wxml|wxss|png|jpg|jpeg)$/i.test(entry.name)) {
      latest = Math.max(latest, fs.statSync(full).mtimeMs);
    }
  }
  return latest;
}

function writeReports(result) {
  ensureDir(outDir);
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const lines = [
    '# Real Device Gate',
    '',
    `Generated: ${result.generatedAt}`,
    '',
    `Status: ${result.ok ? 'PASS' : 'BLOCKED'}`,
    '',
    '## Checks',
    '',
    `- WeChat DevTools CLI: ${result.cliPath || 'not found'}`,
    `- Service port ${result.port}: ${result.portOpen ? 'open' : 'closed'}`,
    `- Project path: ${projectPath}`,
    `- Latest miniapp source mtime: ${result.latestSourceMtimeIso}`,
    '',
    '## Required Screenshots',
    '',
    ...result.expectedScreenshots.map((item) => [
      `- ${item.name}: ${item.valid ? 'valid' : item.exists ? 'invalid' : 'missing'}`,
      `  - route: ${item.route}`,
      `  - action: ${item.action}`,
      `  - expected: ${item.expected}`,
      `  - size: ${item.size ? `${item.size.width}x${item.size.height}` : 'n/a'}`,
      `  - captured: ${item.mtimeIso || 'n/a'}`,
      `  - freshness: ${item.fresh ? 'fresh' : 'stale or missing'}`
    ].join('\n')),
    '',
    '## Rule',
    '',
    'Static HTML previews and desktop screenshots do not satisfy this gate. This file only passes when WeChat DevTools service port is reachable and all required simulator/phone screenshots are present and newer than the current miniapp source files.',
    '',
    '## Unblock Steps',
    '',
    '1. Open WeChat DevTools.',
    '2. Settings -> Security Settings -> enable service port.',
    `3. Confirm 127.0.0.1:${result.port} is reachable.`,
    '4. Capture the listed simulator/phone screenshots under `docs/five-entry-walkthrough/real-device/` with the exact file names above.',
    '5. Run `npm run miniapp:real-device-gate` again.',
    ''
  ];
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
}

(async () => {
  const cliPath = findCli();
  const portOpen = await checkPort(defaultPort);
  const latestSourceMtime = Math.max(
    latestMtimeMs(path.join(projectPath, 'pages')),
    latestMtimeMs(path.join(projectPath, 'custom-tab-bar')),
    latestMtimeMs(path.join(projectPath, 'assets', 'reference')),
    fs.existsSync(path.join(projectPath, 'app.json')) ? fs.statSync(path.join(projectPath, 'app.json')).mtimeMs : 0,
    fs.existsSync(path.join(projectPath, 'app.wxss')) ? fs.statSync(path.join(projectPath, 'app.wxss')).mtimeMs : 0
  );
  let cliProbe = null;
  if (cliPath && portOpen) {
    const probe = spawnSync(cliPath, ['preview', '--project', projectPath, '--port', String(defaultPort)], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000
    });
    cliProbe = {
      status: probe.status,
      stdout: probe.stdout || '',
      stderr: probe.stderr || ''
    };
  }
  const screenshotDir = path.join(outDir, 'real-device');
  const screenshots = expectedScreenshots.map((item) => {
    const file = path.join(screenshotDir, item.name);
    const size = readPngSize(file);
    const stat = fs.existsSync(file) ? fs.statSync(file) : null;
    const exists = !!(stat && stat.size > 0);
    const fresh = !!(stat && stat.mtimeMs >= latestSourceMtime);
    const valid = !!(exists && fresh && size && size.width >= 300 && size.height >= 600);
    return {
      name: item.name,
      route: item.route,
      action: item.action,
      expected: item.expected,
      path: file,
      exists,
      size,
      mtimeIso: stat ? stat.mtime.toISOString() : '',
      fresh,
      valid
    };
  });
  const result = {
    ok: !!(cliPath && portOpen && screenshots.every((item) => item.valid)),
    generatedAt: new Date().toISOString(),
    cliPath,
    port: defaultPort,
    portOpen,
    projectPath,
    latestSourceMtime,
    latestSourceMtimeIso: latestSourceMtime ? new Date(latestSourceMtime).toISOString() : '',
    cliProbe,
    expectedScreenshots: screenshots
  };
  writeReports(result);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
})();
