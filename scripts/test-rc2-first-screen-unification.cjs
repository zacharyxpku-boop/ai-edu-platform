#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

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

function between(text, start, end) {
  const startIndex = text.indexOf(start);
  assert(startIndex >= 0, `missing first-screen start marker: ${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `missing first-screen end marker: ${end}`);
  return text.slice(startIndex, endIndex);
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
    const labels = {
      xiaoyuan: 'Xiao Yuan',
      wenwen: 'Wen Wen',
      anan: 'An An',
      aheng: 'A Heng',
      tuantuan: 'Tuan Tuan',
      yueyue: 'Yue Yue'
    };
    return { selectedCompanion, selectedLabel: labels[selectedCompanion] || 'Xiao Yuan' };
  },
  formatIssueType(value, fallback) {
    const map = {
      step_break: 'step break',
      relation_setup: 'relation setup'
    };
    return map[value] || fallback || 'first step';
  },
  formatInternalLabel(value, fallback) {
    if (!value || /[a-z]+_[a-z0-9_]+/.test(String(value))) return fallback || 'first step';
    return String(value);
  },
  getCompanionStageCopy(stage, preference) {
    const selected = (preference && preference.selectedCompanion) || 'xiaoyuan';
    return `${selected} companion line`;
  },
  getGrowthMemoryLine() {
    return { empty: false, oneLine: 'recorded today: first step', lines: ['recorded today: first step'] };
  }
};

const pages = {
  home: {
    wxml: read('miniprogram/pages/home/home.wxml'),
    vm: loadModule('miniprogram/view-models/home-view-model.js', { '../utils/storage': storageStub }),
    build: (mod) => mod.buildHomeViewModel({ companionPreference: { selectedCompanion: 'anan' } }),
    start: 'rc14-home-first-screen-top',
    end: 'rc14-home-after-first-screen-card',
    binding: 'homeViewModel',
    primaryCardBinding: 'homeViewModel.inputCard'
  },
  review: {
    wxml: read('miniprogram/pages/review/review.wxml'),
    vm: loadModule('miniprogram/view-models/review-view-model.js', { '../utils/storage': storageStub }),
    build: (mod) => mod.buildReviewViewModel({
      companionPreference: { selectedCompanion: 'wenwen' },
      todayFocus: { title: 'second step got messy', issueType: 'step_break', repairStatus: 'in_progress' }
    }),
    start: 'rc14-review-first-screen',
    end: 'rc14-review-after-first-screen',
    binding: 'reviewViewModel',
    primaryCardBinding: 'reviewViewModel.primaryCard'
  },
  tools: {
    wxml: read('miniprogram/pages/tools/tools.wxml'),
    vm: loadModule('miniprogram/view-models/tools-view-model.js', { '../utils/storage': storageStub }),
    build: (mod) => mod.buildToolsViewModel({ companionPreference: { selectedCompanion: 'yueyue' } }),
    start: 'rc14-tools-first-screen',
    end: 'rc14-tools-after-first-screen',
    binding: 'toolsViewModel',
    primaryCardBinding: 'toolsViewModel.primaryCard'
  },
  profile: {
    wxml: read('miniprogram/pages/profile/profile.wxml'),
    vm: loadModule('miniprogram/view-models/profile-view-model.js', { '../utils/storage': storageStub }),
    build: (mod) => mod.buildProfileViewModel({
      companionPreference: { selectedCompanion: 'tuantuan' },
      todayFocus: { title: 'unit one unsure', issueType: 'relation_setup', miniActionText: 'find unit one first' },
      reviewCard: { front: 'unit one recall card' }
    }),
    start: 'rc14-profile-first-screen',
    end: 'rc14-profile-after-first-screen',
    binding: 'profileViewModel',
    primaryCardBinding: 'profileSafeSummary'
  }
};

Object.entries(pages).forEach(([name, page]) => {
  const firstScreen = between(page.wxml, page.start, page.end);
  const viewModel = page.build(page.vm);
  const visibleText = collectStrings(viewModel).join('\n');

  assert(firstScreen.includes(`${page.binding}.routePill`), `${name} first screen binds routePill from viewModel`);
  assert(firstScreen.includes(`${page.binding}.companionStrip`), `${name} first screen binds companionStrip from viewModel`);
  assert(firstScreen.includes(`${page.binding}.title`), `${name} first screen binds title from viewModel`);
  assert(firstScreen.includes(`${page.binding}.subtitle`) || name === 'home', `${name} first screen binds subtitle from viewModel`);
  assert(firstScreen.includes(page.primaryCardBinding), `${name} first screen binds primary card from viewModel`);
  assert(firstScreen.includes('primaryCta'), `${name} first screen binds primary CTA from viewModel`);

  assert(viewModel.routePill, `${name} viewModel outputs routePill`);
  assert(viewModel.companionStrip, `${name} viewModel outputs companionStrip`);
  assert(viewModel.title, `${name} viewModel outputs title`);

  ['issueType', 'sourceText', 'routeStatus', 'companionLine', 'companionCopy.', 'growthMemory.', 'todayFocus.repairStatus'].forEach((raw) => {
    assert(!firstScreen.includes(raw), `${name} first screen does not directly bind raw ${raw}`);
  });

  [
    /[a-z]+_[a-z0-9_]+/,
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

const firstScreens = Object.fromEntries(Object.entries(pages).map(([name, page]) => [name, between(page.wxml, page.start, page.end)]));

assert(firstScreens.home.includes('wx:if="{{!homeViewModel.nextStep}}"'), 'home shows secondaryAction only when no nextStep exists');
assert(firstScreens.review.includes('reviewViewModel.miniAction'), 'review in-progress mini action is controlled by reviewViewModel');
assert(firstScreens.tools.includes('{{toolsViewModel.subtitle}}'), 'tools first screen keeps one subtitle through viewModel');

['wrongCauseSummary', 'gameProfileCard', 'commercialUnlockCard', 'dataFlywheel', 'benchmarkPosition', 'parentReport', 'proofScore'].forEach((term) => {
  assert(!firstScreens.profile.includes(term), `profile first screen keeps legacy module out: ${term}`);
});

const visibleWxml = Object.values(pages).map((page) => page.wxml).join('\n');
[
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
