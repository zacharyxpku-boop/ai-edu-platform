#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const config = vercel.functions && vercel.functions['api/lobster-*.js'];

assert(config, 'vercel.json configures lobster serverless functions');
assert.strictEqual(typeof config.includeFiles, 'string', 'lobster function config uses includeFiles glob string');
[
  'src/lobster/**',
  'miniprogram/utils/**',
  'scripts/fixtures/**'
].forEach((entry) => {
  assert(config.includeFiles.includes(entry), `lobster function bundle includes ${entry}`);
});

console.log('Lobster Vercel bundle tests pass.');
