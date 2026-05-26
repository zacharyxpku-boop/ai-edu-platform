#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredDirs = [
  'miniprogram',
  'apps/web',
  'apps/app',
  'packages/edu-core',
  'packages/ui-contracts'
];

const scanRoots = [
  'miniprogram',
  'apps',
  'packages'
];

const sourceExtensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx']);
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next']);

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function walk(dir, files = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return files;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      walk(rel, files);
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(rel);
    }
  }
  return files;
}

function hasForbiddenReference(content, patterns) {
  return patterns.find((pattern) => pattern.test(content));
}

const missing = requiredDirs.filter((dir) => !fs.existsSync(path.join(root, dir)));
if (missing.length) {
  throw new Error(`Missing product boundary directories: ${missing.join(', ')}`);
}

const rules = [
  {
    name: 'web must not import miniapp or app surfaces',
    applies: (file) => file.startsWith('apps/web/'),
    forbidden: [
      /from\s+['"][^'"]*miniprogram\//,
      /require\(['"][^'"]*miniprogram\//,
      /from\s+['"][^'"]*apps\/app\//,
      /require\(['"][^'"]*apps\/app\//
    ]
  },
  {
    name: 'app must not import miniapp or web surfaces',
    applies: (file) => file.startsWith('apps/app/'),
    forbidden: [
      /from\s+['"][^'"]*miniprogram\//,
      /require\(['"][^'"]*miniprogram\//,
      /from\s+['"][^'"]*apps\/web\//,
      /require\(['"][^'"]*apps\/web\//
    ]
  },
  {
    name: 'miniapp must not import web or app surfaces',
    applies: (file) => file.startsWith('miniprogram/'),
    forbidden: [
      /from\s+['"][^'"]*apps\/web\//,
      /require\(['"][^'"]*apps\/web\//,
      /from\s+['"][^'"]*apps\/app\//,
      /require\(['"][^'"]*apps\/app\//
    ]
  },
  {
    name: 'shared packages must stay platform neutral',
    applies: (file) => file.startsWith('packages/'),
    forbidden: [
      /from\s+['"][^'"]*miniprogram\//,
      /require\(['"][^'"]*miniprogram\//,
      /from\s+['"][^'"]*apps\//,
      /require\(['"][^'"]*apps\//,
      /\bwx\./,
      /\bdocument\./,
      /\bwindow\./
    ]
  }
];

const violations = [];
const files = scanRoots.flatMap((dir) => walk(dir));
for (const file of files) {
  const content = read(file);
  for (const rule of rules) {
    if (!rule.applies(file)) continue;
    const pattern = hasForbiddenReference(content, rule.forbidden);
    if (pattern) {
      violations.push(`${file}: violates "${rule.name}" via ${pattern}`);
    }
  }
}

if (violations.length) {
  console.error('Product boundary check failed:');
  violations.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Product boundary check passed for ${files.length} source files.`);
