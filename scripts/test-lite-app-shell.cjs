#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app-lite.html'), 'utf8');

assert(html.includes('data-retired-page="app-lite"'), 'lite app is explicitly retired');
assert(html.includes('data-redirect-target="/app"'), 'lite app points to the current web app shell');
assert(html.includes('http-equiv="refresh"') && html.includes('url=/app'), 'lite app has an HTML fallback redirect');
assert(html.includes("window.location.replace('/app')"), 'lite app has a JS redirect');

[
  'data-lite-app="yuandian"',
  'data-module-map="miniapp-full"',
  'data-module="daily-math"',
  'data-module="dictation"',
  'data-module="light-diagnosis"',
  'data-module="focus"',
  'data-module="tools"',
  'data-module="radar"',
  'data-module="diagnosis"',
  '鍘熺偣鏅哄杞?App'
].forEach((legacyMarker) => {
  assert(!html.includes(legacyMarker), `retired lite app must not retain legacy marker: ${legacyMarker}`);
});

console.log('Lite app retirement check passed.');
