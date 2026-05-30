#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const tabContracts = [
  {
    id: 'tutor',
    wxml: 'miniprogram/pages/tutor/tutor.wxml',
    wxss: 'miniprogram/pages/tutor/tutor.wxss',
    launchShell: 'tutor-hero-shell',
    safeAreaOwner: 'main-inner',
    safeAreaProp: 'padding',
    primaryAction: 'tutor-primary'
  },
  {
    id: 'arcade',
    wxml: 'miniprogram/pages/arcade/arcade.wxml',
    wxss: 'miniprogram/pages/arcade/arcade.wxss',
    launchShell: 'arcade-hero-shell',
    safeAreaOwner: 'arcade-hero-shell',
    safeAreaProp: 'margin',
    primaryAction: 'arcade-primary'
  },
  {
    id: 'parent',
    wxml: 'miniprogram/pages/profile/profile.wxml',
    wxss: 'miniprogram/pages/profile/profile.wxss',
    launchShell: 'parent-hero-shell',
    safeAreaOwner: 'profile-shell',
    safeAreaProp: 'padding',
    primaryAction: 'parent-primary'
  },
  {
    id: 'upload',
    wxml: 'miniprogram/pages/upload/upload.wxml',
    wxss: 'miniprogram/pages/upload/upload.wxss',
    launchShell: 'upload-hero-shell',
    safeAreaOwner: 'upload-content',
    safeAreaProp: 'padding',
    primaryAction: 'upload-dash-primary'
  }
];

function focusedLaunchSlice(wxml, launchShell) {
  const legacyStart = wxml.indexOf('<block wx:if="{{showLegacyEntryContent}}">');
  const shellStart = wxml.indexOf(launchShell);
  assert(shellStart >= 0, `missing launch shell: ${launchShell}`);
  return wxml.slice(shellStart, legacyStart > shellStart ? legacyStart : undefined);
}

function assertRuleContains(css, selector, prop, value, message) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`\\.${escaped}\\s*\\{[\\s\\S]*?\\}`, 'g');
  const matches = css.match(rule) || [];
  assert(
    matches.some((match) => match.includes(`${prop}:`) && match.includes(value)),
    `${message}; expected .${selector} ${prop} to include ${value}`
  );
}

tabContracts.forEach((tab) => {
  const wxml = read(tab.wxml);
  const wxss = read(tab.wxss);
  const launch = focusedLaunchSlice(wxml, tab.launchShell);

  assert(launch.includes(tab.launchShell), `${tab.id} renders the new focused launch shell before legacy content`);
  assert.strictEqual((launch.match(/ux-kit-jump-card/g) || []).length, 3, `${tab.id} launch screen keeps exactly 3 jump cards`);
  assert((launch.match(/bindtap="openEntryDetail"/g) || []).length >= 3, `${tab.id} launch cards jump to child/detail pages`);
  assert(launch.includes(tab.primaryAction), `${tab.id} launch screen keeps one obvious primary action`);
  assert(wxml.includes('ux-kit-subcheck'), `${tab.id} keeps a compact child-flow preview under the launch shell`);
  assert((wxml.match(/class="[^"]*ux-kit-subcheck/g) || []).length >= 1, `${tab.id} subcheck preview is present`);
  assert(wxml.includes('subcheck-art'), `${tab.id} subcheck preview includes a visual asset, not just text boxes`);
  assertRuleContains(
    wxss,
    tab.safeAreaOwner,
    tab.safeAreaProp,
    'calc(108rpx + env(safe-area-inset-top))',
    `${tab.id} direct tab entry reserves WeChat capsule/status safe area`
  );
  assert(wxss.includes('env(safe-area-inset-bottom)'), `${tab.id} keeps bottom safe-area spacing above the custom tab bar`);
  assertRuleContains(wxss, tab.launchShell, '', 'border-radius: 34rpx', `${tab.id} launch shell uses compact rounded app-card styling`);
});

const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const entryDetailWxss = read('miniprogram/pages/entry-detail/entry-detail.wxss');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const homeWxml = read('miniprogram/pages/home/home.wxml');
const parentWxml = read('miniprogram/pages/profile/profile.wxml');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');
const uploadWxml = read('miniprogram/pages/upload/upload.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const reviewWxss = read('miniprogram/pages/review/review.wxss');
['today', 'tutor', 'review', 'parent', 'upload'].forEach((scene) => {
  assert(entryDetailJs.includes(`${scene}: {`), `entry-detail supports child scene: ${scene}`);
});
assert(fs.existsSync(path.join(root, 'miniprogram/assets/brand/gudian-reader.png')), 'high-quality Gudian reader asset is available');
assert(homeWxml.includes('class="mini-brand-mark" mode="aspectFit" src="/assets/reference/brand-house.png"'), 'home top brand uses the reference brand-house image, not a text placeholder');
assert.strictEqual((homeWxml.match(/class="mini-entry-visual" mode="aspectFill"/g) || []).length, 6, 'home six entry illustrations fill their cards like the reference UI');
assert(tutorWxml.includes('/assets/brand/gudian-reader.png'), 'AI tutor uses the Gudian learning companion instead of a generic robot as the main guide');
assert(tutorWxml.includes('class="tutor-dash-mark" mode="aspectFit" src="/assets/reference/brand-house.png"'), 'AI tutor tab brand mark uses the visual reference asset instead of a robot emoji placeholder');
assert(!tutorWxml.includes('<view class="tutor-dash-mark">🤖</view>'), 'AI tutor tab never regresses to the generic robot emoji mark');
assert(arcadeWxml.includes('class="arcade-dash-mark" mode="aspectFit" src="/assets/reference/brand-house.png"'), 'review island tab brand mark uses the visual reference asset instead of a text placeholder');
assert(!arcadeWxml.includes('<view class="arcade-dash-mark">岛</view>'), 'review island tab never regresses to the text-only island mark');
assert(reviewWxml.includes('review-hero-shell ux-entry ux-entry-review ux-kit-screen'), 'review child flow uses the focused launch shell before legacy review content');
assert(reviewWxml.includes('review-subcheck ux-kit-subcheck'), 'review child flow keeps a compact subcheck preview under the launch shell');
assert(reviewWxss.includes('.v1-topbar') && reviewWxss.includes('display: none'), 'review child flow hides the old topbar that caused clipped screenshots');
assert(uploadWxml.includes('class="upload-dash-mark" mode="aspectFit" src="/assets/reference/brand-house.png"'), 'upload tab brand mark uses the visual reference asset instead of an arrow placeholder');
assert(!uploadWxml.includes('<view class="upload-dash-mark">↑</view>'), 'upload tab never regresses to the text-only arrow mark');
assert(parentWxml.includes('class="parent-dash-mark" mode="aspectFit" src="/assets/reference/brand-house.png"'), 'parent tab brand mark uses the visual reference asset instead of a text placeholder');
assert(parentWxml.includes('parent-report-preview'), 'parent tab evidence section includes a compact report preview visual card');
assert(parentWxml.includes('class="parent-report-thumb" mode="aspectFill" src="/assets/reference/entry-report.png"'), 'parent tab report preview uses the report reference illustration');
['entry-map.png', 'entry-tutor.png', 'entry-review.png', 'entry-parent.png', 'entry-upload.png'].forEach((asset) => {
  assert(entryDetailJs.includes(`/assets/reference/${asset}`), `entry-detail child scene uses reference illustration ${asset}`);
});
assert(entryDetailWxss.includes('env(safe-area-inset-top)'), 'entry-detail child page reserves top safe area');
assert(entryDetailWxss.includes('env(safe-area-inset-bottom)'), 'entry-detail child page reserves bottom safe area');
assert(entryDetailWxss.includes('grid-template-columns: 1fr'), 'entry-detail child page uses readable evidence rows instead of cramped mini cards');
assert(entryDetailWxss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'entry-detail child page cross-entry jumps render as a two-column visual grid');
assert(entryDetailWxss.includes('-webkit-line-clamp: 3'), 'entry-detail child page clamps hero copy to avoid a text wall');
assert(read('miniprogram/pages/entry-detail/entry-detail.wxml').includes('entry-proof-strip'), 'entry-detail child page shows a compact three-step proof strip');

const appWxss = read('miniprogram/app.wxss');
const tabbarWxss = read('miniprogram/custom-tab-bar/index.wxss');
assert(appWxss.includes('.ux-kit-screen ~ .ux-kit-subcheck'), 'focused tab screens allow the compact subcheck preview to render');
assert(appWxss.includes('grid-template-columns: minmax(0, 1fr)'), 'subcheck preview avoids squeezed two-column mobile composition');
assert(appWxss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'subcheck side actions stay as two compact jump cards');
assert(appWxss.includes('.subcheck-art'), 'subcheck preview styles a dedicated image asset block');
assert(!tabbarWxss.includes('scale(0.88)'), 'custom tabbar labels render at real size instead of being visually scaled down');
assert(tabbarWxss.includes('position: absolute') && tabbarWxss.includes('bottom: 6rpx'), 'custom tabbar active indicator does not take layout space from labels');

const realDeviceGate = read('scripts/miniapp-real-device-gate.cjs');
[
  'tab-today.png',
  'tab-tutor.png',
  'tab-arcade.png',
  'tab-parent.png',
  'tab-upload.png',
  'child-today-first-step.png',
  'child-tutor-flow.png',
  'child-review-recall.png',
  'child-parent-report.png',
  'child-upload-material.png'
].forEach((name) => {
  assert(realDeviceGate.includes(name), `real-device gate requires screenshot: ${name}`);
});

console.log('All miniapp tab layout contract tests pass.');
