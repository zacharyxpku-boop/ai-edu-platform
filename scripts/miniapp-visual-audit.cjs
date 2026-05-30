#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'visual-audit');
const externalReferenceDir = path.join('C:', 'Users', '86136', 'Desktop', '小程序', 'assets', 'img');
const internalReferenceDir = path.join(root, 'apps', 'web', 'design-references', 'screenshots', 'prototype');

fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ['01-miniapp-home', '小程序主入口参考', 'miniapp-home.png'],
  ['02-mobile-home', '移动端首页参考', 'mobile-home.png'],
  ['03-mobile-report', '移动端报告参考', 'mobile-report.png'],
  ['04-upload-desktop', '资料上传页参考', 'upload-desktop.png'],
  ['05-report-desktop', '报告页参考', 'report-desktop.png'],
  ['06-tutor-desktop', 'AI 私教页参考', 'tutor-desktop.png'],
  ['07-review-desktop', '复习游戏页参考', 'review-desktop.png'],
  ['08-parent-desktop', '家长中心页参考', 'parent-desktop.png'],
  ['09-map-desktop', '学习地图页参考', 'map-desktop.png']
];

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, '/').replace(/ /g, '%20')}`;
}

function sourceFor(fileName) {
  const external = path.join(externalReferenceDir, fileName);
  if (fs.existsSync(external)) return external;
  const internal = path.join(internalReferenceDir, fileName);
  if (fs.existsSync(internal)) return internal;
  throw new Error(`Missing reference image: ${fileName}`);
}

function css() {
  return `
    *{box-sizing:border-box}
    body{margin:0;background:#f7faf3;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#10231b}
    .page{width:1440px;min-height:100vh;padding:28px;background:#f7faf3}
    .audit-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px}
    .eyebrow{color:#16a34a;font-size:14px;font-weight:900;letter-spacing:.08em}
    h1{margin:6px 0 0;font-size:34px;line-height:1.12;letter-spacing:0}
    .note{max-width:560px;color:#5f6b63;font-size:15px;font-weight:700;line-height:1.5;text-align:right}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
    .card{min-width:0;padding:14px;border:1px solid #e8eee6;border-radius:24px;background:#fff;box-shadow:0 18px 40px rgba(34,58,42,.08)}
    .meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:#203127;font-size:15px;font-weight:950}
    .tag{padding:6px 10px;border-radius:999px;background:#effaf0;color:#16a34a;font-size:12px;font-weight:900}
    .shot{display:flex;align-items:center;justify-content:center;min-height:360px;overflow:hidden;border:1px solid #e8eee6;border-radius:18px;background:#fbfaf5}
    .shot img{display:block;max-width:100%;max-height:520px;object-fit:contain}
    .single{width:100vw;min-height:100vh;padding:26px;background:#f7faf3}
    .single .card{max-width:1320px;margin:0 auto}
    .single .shot{min-height:760px}
    .single .shot img{max-height:860px}
  `;
}

function imagePage(target) {
  const [id, label, fileName] = target;
  const source = sourceFor(fileName);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(label)}</title>
  <style>${css()}</style>
</head>
<body>
  <main class="single">
    <section class="card">
      <div class="meta"><span>${esc(label)}</span><span class="tag">${esc(fileName)}</span></div>
      <div class="shot"><img src="${fileUrl(source)}" alt="${esc(label)}"></div>
    </section>
  </main>
</body>
</html>`;
}

function galleryPage() {
  const cards = targets.map(([id, label, fileName]) => {
    const source = sourceFor(fileName);
    return `<section class="card">
      <div class="meta"><span>${esc(label)}</span><span class="tag">${esc(fileName)}</span></div>
      <div class="shot"><img src="${fileUrl(source)}" alt="${esc(label)}"></div>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>原点智学参考 UI 审计</title>
  <style>${css()}</style>
</head>
<body>
  <main class="page">
    <header class="audit-head">
      <div>
        <div class="eyebrow">REFERENCE UI ONLY</div>
        <h1>原点智学新 UI 参考板</h1>
      </div>
      <div class="note">本审计图只展示参考资产库和目标设计，不再生成历史代理 UI。小程序、网页和 APP 的实现都以这些图作为视觉基准。</div>
    </header>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`;
}

function findChrome() {
  return [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function capture(chrome, htmlPath, pngPath, viewport) {
  if (!chrome) return { status: 0, skipped: true };
  return spawnSync(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${viewport}`,
    `--screenshot=${pngPath}`,
    fileUrl(htmlPath)
  ], { encoding: 'utf8' });
}

const chrome = findChrome();
const generated = [];

for (const target of targets) {
  const [id] = target;
  const htmlPath = path.join(outDir, `${id}.html`);
  const pngPath = path.join(outDir, `${id}.png`);
  fs.writeFileSync(htmlPath, imagePage(target));
  const result = capture(chrome, htmlPath, pngPath, '1440,1000');
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to capture ${id}`);
  }
  generated.push(`${id}.png`);
}

const galleryHtml = path.join(outDir, 'gallery.html');
const galleryPng = path.join(outDir, 'gallery.png');
fs.writeFileSync(galleryHtml, galleryPage());
const galleryResult = capture(chrome, galleryHtml, galleryPng, '1440,1850');
if (galleryResult.status !== 0) {
  throw new Error(galleryResult.stderr || galleryResult.stdout || 'Failed to capture gallery');
}

const report = [
  '# Miniapp Visual Audit',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  'Status: reference-only audit generated.',
  '',
  'Rule: historical proxy UI is not allowed here. This folder now shows the approved reference screenshots only.',
  '',
  'Files:',
  '- docs/visual-audit/gallery.html',
  '- docs/visual-audit/gallery.png',
  ...targets.map(([id]) => `- docs/visual-audit/${id}.html`),
  ...generated.map((name) => `- docs/visual-audit/${name}`)
].join('\n');

fs.writeFileSync(path.join(outDir, 'REPORT.md'), report);
console.log(report);
