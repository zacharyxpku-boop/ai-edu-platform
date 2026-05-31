#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const automator = require('miniprogram-automator');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'five-entry-walkthrough', 'real-device');
const port = Number(process.env.WECHAT_DEVTOOLS_PORT || 9420);
const projectPath = path.join(root, 'miniprogram');

const cliPathResolved = [
  process.env.WECHAT_DEVTOOLS_CLI,
  path.join(root, 'scripts', 'wechat-devtools-cli.cmd'),
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat'
].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || '';

const directShots = [
  ['/pages/home/home', 'tab-today.png'],
  ['/pages/tutor/tutor', 'tab-tutor.png'],
  ['/pages/review/review', 'tab-review.png'],
  ['/pages/profile/profile', 'tab-parent.png'],
  ['/pages/upload/upload', 'tab-upload.png']
];

const childFlows = [
  ['today', 'child-today-first-step.png'],
  ['tutor', 'child-tutor-flow.png'],
  ['review', 'child-review-recall.png'],
  ['report', 'child-report-evidence.png'],
  ['parent', 'child-parent-report.png'],
  ['upload', 'child-upload-material.png']
];

const childEntryShots = [
  ['today', 'entry-detail-today.png'],
  ['tutor', 'entry-detail-tutor.png'],
  ['review', 'entry-detail-review.png'],
  ['report', 'entry-detail-report.png'],
  ['parent', 'entry-detail-parent.png'],
  ['upload', 'entry-detail-upload.png']
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function screenshotWithRetry(app, filePath) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await wait(attempt === 1 ? 0 : 900);
      await withTimeout(app.screenshot({ path: filePath }), 12000, `screenshot ${path.basename(filePath)}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function launchOrConnect() {
  if (process.env.WECHAT_DEVTOOLS_CONNECT_ONLY === '1') {
    return withTimeout(
      automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }),
      20000,
      `connect ws://127.0.0.1:${port}`
    );
  }
  if (!cliPathResolved) {
    throw new Error('WeChat DevTools cli.bat was not found. Set WECHAT_DEVTOOLS_CLI to the correct path.');
  }
  return withTimeout(
    automator.launch({
      cliPath: cliPathResolved,
      projectPath,
      port,
      trustProject: true,
      timeout: 45000
    }),
    65000,
    `launch WeChat DevTools on port ${port}`
  );
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const app = await launchOrConnect();

  try {
    for (const [route, name] of directShots) {
      await withTimeout(app.reLaunch(route), 16000, `reLaunch ${route}`);
      await wait(1800);
      await screenshotWithRetry(app, path.join(outDir, name));
      console.log(`shot ${name} ${route}`);
    }

    for (const [scene, name] of childFlows) {
      const page = await withTimeout(
        app.reLaunch(`/pages/entry-detail/entry-detail?scene=${scene}`),
        16000,
        `reLaunch entry-detail ${scene}`
      );
      await wait(1200);
      const primary = await withTimeout(page.$('.entry-primary'), 6000, `find entry primary ${scene}`);
      if (!primary) throw new Error(`Missing entry primary button for scene: ${scene}`);
      await withTimeout(primary.tap(), 8000, `tap entry primary ${scene}`);
      await wait(2600);
      const current = await withTimeout(app.currentPage(), 8000, `currentPage after ${scene}`);
      await screenshotWithRetry(app, path.join(outDir, name));
      console.log(`flow ${name} ${current && current.path}`);
    }

    for (const [scene, name] of childEntryShots) {
      await withTimeout(
        app.reLaunch(`/pages/entry-detail/entry-detail?scene=${scene}`),
        16000,
        `reLaunch entry-detail visual ${scene}`
      );
      await wait(1600);
      await screenshotWithRetry(app, path.join(outDir, name));
      console.log(`entry ${name} ${scene}`);
    }
  } finally {
    if (app && app.disconnect) app.disconnect();
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
