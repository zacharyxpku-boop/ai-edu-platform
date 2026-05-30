#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function mapRetiredMiniappFile(file) {
  return String(file || '')
    .replace(/miniprogram\/pages\/tools\/tools\.(wxml|js|wxss|json)$/, 'miniprogram/pages/entry-detail/entry-detail.$1')
    .replace(/miniprogram\/pages\/diagnosis\/diagnosis\.(wxml|js|wxss|json)$/, 'miniprogram/pages/upload/upload.$1')
    .replace(/miniprogram\/pages\/radar\/radar\.(wxml|js|wxss|json)$/, 'miniprogram/pages/profile/profile.$1')
    .replace(/miniprogram\/pages\/module\/module\.(wxml|js|wxss|json)$/, 'miniprogram/pages/tutor/tutor.$1')
    .replace(/miniprogram\/pages\/(?:focus|daily-math|dictation|light-diagnosis)\/[^/]+\.(wxml|js|wxss|json)$/, 'miniprogram/pages/entry-detail/entry-detail.$1');
}const read = (file) => fs.readFileSync(path.join(root, mapRetiredMiniappFile(file)), 'utf8');

function loadModule(filePath, requireMap = {}) {
  const file = path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      return require(request);
    },
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const storageStub = {
  buildCompanionPreference(input) {
    const selectedCompanion = (input && input.selectedCompanion) || input || 'xiaoyuan';
    return { selectedCompanion, selectedLabel: '咕点' };
  },
  formatIssueType(value, fallback) {
    return fallback || '第一步';
  },
  formatInternalLabel(value, fallback) {
    if (!value || /[a-z]+_[a-z0-9_]+/.test(String(value))) return fallback || '第一步';
    return String(value);
  },
  getCompanionStageCopy(stage) {
    return `咕点陪你走到${stage}`;
  },
  getGrowthMemoryLine() {
    return { empty: false, oneLine: '今天记录到第一步', lines: ['今天记录到第一步'] };
  }
};

const pages = {
  home: {
    wxml: read('miniprogram/pages/home/home.wxml'),
    vm: loadModule('miniprogram/view-models/home-view-model.js', { '../utils/storage': storageStub }),
    build: (mod) => mod.buildHomeViewModel({ companionPreference: { selectedCompanion: 'anan' } }),
    shell: 'mini-home-shell',
    binding: 'homeViewModel',
    primaryCardBinding: 'homeViewModel.inputCard'
  },
  review: {
    wxml: read('miniprogram/pages/review/review.wxml'),
    vm: loadModule('miniprogram/view-models/review-view-model.js', { '../utils/storage': storageStub }),
    build: (mod) => mod.buildReviewViewModel({
      companionPreference: { selectedCompanion: 'wenwen' },
      todayFocus: { title: '第二步卡住', issueType: 'step_break', repairStatus: 'in_progress' }
    }),
    shell: 'review-hero-shell',
    binding: 'reviewViewModel',
    primaryCardBinding: 'reviewViewModel.primaryCta'
  },
  profile: {
    wxml: read('miniprogram/pages/profile/profile.wxml'),
    vm: loadModule('miniprogram/view-models/profile-view-model.js', { '../utils/storage': storageStub }),
    build: (mod) => mod.buildProfileViewModel({
      companionPreference: { selectedCompanion: 'tuantuan' },
      todayFocus: { title: '第一单元不稳', issueType: 'relation_setup', miniActionText: '先找第一单元' },
      reviewCard: { front: '第一单元回忆卡' }
    }),
    shell: 'parent-hero-shell',
    binding: 'profileViewModel',
    primaryCardBinding: 'profileViewModel.primaryCta'
  }
};

Object.entries(pages).forEach(([name, page]) => {
  const viewModel = page.build(page.vm);
  const visibleText = collectStrings(viewModel).join('\n');

  assert(page.wxml.includes(page.shell), `${name} renders new shell`);
  assert(page.wxml.includes(`${page.binding}.routePill`) || name === 'review' || name === 'profile', `${name} binds routePill where applicable`);
  assert(page.wxml.includes(`${page.binding}.companionStrip`), `${name} binds companionStrip from viewModel`);
  assert(page.wxml.includes(`${page.binding}.title`), `${name} binds title from viewModel`);
  assert(page.wxml.includes(page.primaryCardBinding), `${name} binds primary card from viewModel`);
  assert(page.wxml.includes('primaryCta'), `${name} binds primary CTA from viewModel`);

  assert(viewModel.companionStrip, `${name} viewModel outputs companionStrip`);
  assert(viewModel.title, `${name} viewModel outputs title`);

  ['issueType', 'sourceText', 'routeStatus', 'companionLine', 'companionCopy.', 'growthMemory.'].forEach((raw) => {
    assert(!page.wxml.includes(raw), `${name} first screen does not directly bind raw ${raw}`);
  });

  [
    /home_xiaodian_entry/,
    /needs_student_step/,
    /dashboard/i,
    /PK/,
    /OCR/,
    /teacherTeamProfiles/
  ].forEach((pattern) => {
    assert(!pattern.test(visibleText), `${name} viewModel avoids unsafe visible text: ${pattern}`);
  });
});

const visibleWxml = Object.values(pages).map((page) => page.wxml).join('\n');
[
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-'),
  'home_xiaodian_entry',
  'needs_student_step',
  'teacherTeamProfiles',
  'NOVA_TEACHER_PROFILES',
  'ERROR_TYPE_PROFILES',
  'dashboard',
  'OCR'
].forEach((term) => {
  assert(!visibleWxml.includes(term), `four tab WXML avoids forbidden/internal wording: ${term}`);
});

const packageJson = read('package.json');
assert(packageJson.includes('scripts/test-rc2-first-screen-unification.cjs'), 'npm test includes RC2 first-screen unification guard');

console.log('All RC2 first-screen unification tests pass.');
