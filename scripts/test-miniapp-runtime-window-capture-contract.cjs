#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts', 'capture-miniapp-runtime-window.cjs'), 'utf8');

[
  'RuntimeDesktopCapture',
  'SetProcessDPIAware',
  'runtime-miniapp-window.png',
  'wechat-real-runtime-miniapp-window-crop',
  'detectRuntimeMiniappBounds',
  'isGreenBadgePixel',
  'rightPanelX',
  'vConsole badge',
  'PNG.bitblt'
].forEach((token) => {
  assert(script.includes(token), `runtime miniapp window capture keeps ${token}`);
});

assert(
  script.includes('crop.width < 420') && script.includes('crop.height < 780'),
  'runtime miniapp window capture rejects whole-window or right-panel crops'
);

console.log('Miniapp runtime window capture contract passed.');
