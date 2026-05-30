#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'miniprogram', 'pages', 'home'),
  path.join(ROOT, 'miniprogram', 'pages', 'profile'),
  path.join(ROOT, 'miniprogram', 'pages', 'entry-detail'),
  path.join(ROOT, 'miniprogram', 'pages', 'arcade'),
  path.join(ROOT, 'miniprogram', 'pages', 'tutor'),
  path.join(ROOT, 'miniprogram', 'pages', 'upload'),
  path.join(ROOT, 'miniprogram', 'pages', 'review'),
  path.join(ROOT, 'miniprogram', 'pages', 'legal'),
  path.join(ROOT, 'miniprogram', 'custom-tab-bar'),
  path.join(ROOT, 'miniprogram', 'utils', 'api.js'),
  path.join(ROOT, 'miniprogram', 'utils', 'review-cards.js'),
  path.join(ROOT, 'miniprogram', 'utils', 'storage.js'),
  path.join(ROOT, 'scripts', 'miniapp-real-device-gate.cjs'),
  path.join(ROOT, 'scripts', 'capture-miniapp-real-device.cjs'),
  path.join(ROOT, 'package.json')
];

const MOJIBAKE_TOKENS = [
  '鍘', '鐐', '閿', '澶', '绋', '寮', '杩', '宸', '瑙', '鏃',
  '棰', '鐩', '涓', '姝', '瀹', '缂', '璺', '闆', '鈥', '鈫', '锘', '????'
];

function walk(file, output = []) {
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(file)) walk(path.join(file, child), output);
  } else if (/\.(js|wxml|json|wxss)$/.test(file)) {
    output.push(file);
  }
  return output;
}

function hasMojibake(line) {
  return MOJIBAKE_TOKENS.some((token) => line.includes(token));
}

const files = TARGETS.flatMap((target) => fs.existsSync(target) ? walk(target) : []);
const hits = [];

files.forEach((file) => {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (hasMojibake(line)) {
      hits.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
    }
  });
});

if (hits.length) {
  console.error('Miniapp encoding check failed. Mojibake-like text found:');
  hits.slice(0, 60).forEach((hit) => console.error(hit));
  process.exit(1);
}

console.log(`Miniapp encoding check passed across ${files.length} files.`);
