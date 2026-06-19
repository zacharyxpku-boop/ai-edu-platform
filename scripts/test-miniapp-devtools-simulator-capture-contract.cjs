#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const scriptPath = path.join(root, 'scripts', 'capture-miniapp-devtools-simulator.cjs');
const fullcheckPath = path.join(root, 'scripts', 'miniapp-fullcheck.cjs');
const script = fs.readFileSync(scriptPath, 'utf8');
const fullcheck = fs.readFileSync(fullcheckPath, 'utf8');

[
  'SetProcessDPIAware',
  'GetSystemMetrics(78)',
  'GetProcessesByName("wechatdevtools")',
  'SetForegroundWindow',
  'keybd_event(0x1B',
  'devtools-simulator',
  'current-phone.png',
  'detectPhoneBounds',
  'isPhoneLightPixel',
  'PNG.bitblt'
].forEach((token) => {
  assert(script.includes(token), `DevTools simulator capture script keeps ${token}`);
});

assert(
  script.includes('Windows PowerShell') && script.includes('Windows-only'),
  'DevTools simulator capture script documents its Windows-only path'
);
assert(
  fullcheck.includes('scripts/test-miniapp-devtools-simulator-capture-contract.cjs'),
  'miniapp fullcheck runs the DevTools simulator capture contract'
);

console.log('Miniapp DevTools simulator capture contract passed.');
