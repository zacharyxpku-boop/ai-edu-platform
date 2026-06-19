#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts', 'capture-miniapp-runtime-walkthrough.cjs'), 'utf8');
const fullcheck = fs.readFileSync(path.join(root, 'scripts', 'miniapp-fullcheck.cjs'), 'utf8');

[
  'runtime-walkthrough',
  'tab-tutor.png',
  'tab-review.png',
  'tab-parent.png',
  'tab-upload.png',
  'entry-tutor-read-problem.png',
  'entry-tutor-first-step.png',
  'entry-tutor-input.png',
  'tutor-read-problem',
  'tutor-first-step',
  'backFromEntryDetail',
  'wechat-real-runtime-window-coordinate-walkthrough',
  'SetProcessDPIAware',
  'clickRelative'
].forEach((token) => {
  assert(script.includes(token), `runtime walkthrough capture keeps ${token}`);
});

assert(
  fullcheck.includes('scripts/test-miniapp-runtime-walkthrough-capture-contract.cjs'),
  'miniapp fullcheck runs the runtime walkthrough capture contract'
);

console.log('Miniapp runtime walkthrough capture contract passed.');
