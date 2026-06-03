#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('apps/web/src/routes.js');
const app = read('apps/web/src/app.js');
const manifest = JSON.parse(read('apps/web/surface-manifest.json'));

assert(routes.includes("id: 'lobster'"), 'web routes include lobster');
assert(routes.includes("path: '/lobster'"), 'web routes map lobster to /lobster');
assert(routes.includes("webOnly: true"), 'web routes mark lobster as web-only');

const lobsterEntry = manifest.primaryEntries.find((entry) => entry.id === 'lobster');
assert(lobsterEntry, 'web surface manifest includes lobster');
assert.strictEqual(lobsterEntry.webOnly, true, 'web surface manifest marks lobster as web-only');
assert(String(lobsterEntry.miniappParity || '').includes('web-only'), 'lobster manifest entry does not claim miniapp parity');
assert(/parent-device AI teacher/i.test(lobsterEntry.job), 'lobster manifest describes parent-device AI teacher job');
assert(/standalone lobster activation shell/i.test(lobsterEntry.webAdaptation), 'lobster manifest links to standalone activation shell');

[
  "['lobster', '龙虾 AI 教师', 'hero-mascot.png']",
  "if (state.active === 'lobster') return renderLobster();",
  'href="/lobster.html"',
  'data-action="lobster-configure"',
  'data-action="lobster-coview"',
  'lobster-parent-demo',
  'lobster-followup',
  "window.location.href = '/lobster.html'"
].forEach((needle) => {
  assert(app.includes(needle), `web app exposes lobster official entry: ${needle}`);
});

const miniprogramApp = read('miniprogram/app.json');
assert(!miniprogramApp.includes('lobster'), 'lobster official web entry does not add a miniapp tab/page');

console.log('Lobster official web entry tests pass.');
