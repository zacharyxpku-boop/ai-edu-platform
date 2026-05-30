#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app-lite.html'), 'utf8');

const miniappModules = [
  'home',
  'daily-math',
  'dictation',
  'light-diagnosis',
  'focus',
  'tools',
  'module',
  'review',
  'arcade',
  'tutor',
  'radar',
  'profile',
  'diagnosis',
  'upload',
  'legal'
];

assert(html.includes('data-lite-app="yuandian"'), 'lite app root is present');
assert(html.includes('原点智学轻 App'), 'lite app names the product');
assert(html.includes('家庭作业私教闭环'), 'lite app keeps the family private tutor positioning');
assert(html.includes('manifest.json'), 'lite app is ready for PWA/Capacitor wrapping');
assert(html.includes('data-module-map="miniapp-full"'), 'lite app exposes a full miniapp module map');

['home', 'learn', 'upload', 'tutor', 'parent'].forEach((tab) => {
  assert(html.includes(`data-tab="${tab}"`), `lite app exposes ${tab} tab`);
});

miniappModules.forEach((name) => {
  assert(html.includes(`data-module="${name}"`), `lite app carries miniapp module: ${name}`);
});

assert(html.includes('materialType') && html.includes('materialText') && html.includes('analyzeBtn'), 'lite app can accept uploaded material text');
assert(html.includes('buildPlan()') && html.includes('detectSubject') && html.includes('detectCause'), 'lite app has local material-to-plan logic');
assert(html.includes('modeTutorBtn') && html.includes('modeClassBtn'), 'lite app lets the child choose Socratic or classroom mode');
assert(html.includes('小黑板') && html.includes('classroom'), 'lite app includes blackboard/classroom fallback');
assert(html.includes('child_first_step') && html.includes('错因') && html.includes('第 7 天'), 'lite app requires learning evidence and review cadence');
assert(html.includes('XP 只奖励证据') && html.includes('不做排名'), 'lite app blocks score/ranking reward hooks');
assert(html.includes('不拍照出答案') && html.includes('不自动判分') && html.includes('不天赋定性') && html.includes('不承诺提分'), 'lite app states the forbidden claims');
assert(html.includes('localStorage') && html.includes('ydzx_lite_app_state'), 'lite app persists local trial state without a backend dependency');
assert(!/AppSecret|API Key|sk-[A-Za-z0-9]/.test(html), 'lite app does not expose secrets or internal API-key setup');

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert(scriptMatch, 'lite app includes executable client script');
assert.doesNotThrow(() => new Function(scriptMatch[1]), 'lite app client script is syntactically valid');

console.log('All lite app shell tests pass.');
