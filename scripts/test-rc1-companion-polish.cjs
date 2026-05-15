const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const storageMap = {};
global.wx = {
  getStorageSync(key) {
    return storageMap[key];
  },
  setStorageSync(key, value) {
    storageMap[key] = value;
  },
  removeStorageSync(key) {
    delete storageMap[key];
  }
};

function loadStorage() {
  const file = path.join(root, 'miniprogram', 'utils', 'storage.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(request) {
      if (request === './learning-priority') return {};
      return require(request);
    },
    console,
    wx: global.wx,
    Date,
    Math,
    String,
    Number,
    Object,
    Array,
    RegExp
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const storage = loadStorage();

['formatIssueType', 'formatRouteStage', 'formatSourceLabel', 'formatInternalLabel', 'formatCompanionLine', 'getCompanionStageCopy'].forEach((name) => {
  assert.strictEqual(typeof storage[name], 'function', `${name} is exported`);
});

assert.strictEqual(storage.formatSourceLabel('home_xiaodian_entry'), '作业点拨入口', 'home source key maps to Chinese');
assert.strictEqual(storage.formatInternalLabel('needs_student_step'), '等孩子先说第一步', 'student-step status maps to Chinese');
assert.strictEqual(storage.formatInternalLabel('write_first_step'), '说第一步', 'coach step maps to Chinese');
assert.strictEqual(storage.formatIssueType('blocked_answer_request'), '先说第一步', 'unknown/internal issue key does not leak');
assert.strictEqual(storage.formatRouteStage('parent'), '整理给家长看', 'parent route stage uses final route wording');
assert(!/[a-z]+_[a-z_]+/.test(storage.formatSourceLabel('home_xiaodian_entry')), 'source label never returns snake_case');
assert(!/[a-z]+_[a-z_]+/.test(storage.formatInternalLabel('needs_student_step')), 'internal label never returns snake_case');

const strip = storage.formatCompanionLine('anan');
assert.strictEqual(strip, '咕点：我懂你卡住了，我陪你先迈出第一步。', 'legacy companion strip resolves to mascot');

storage.saveCompanionPreference('wenwen');
assert.strictEqual(storage.getCompanionStageCopy('home'), '咕点陪你先找今晚第一步。', 'stage copy follows mascot');
assert.strictEqual(storage.formatCompanionLine(), '咕点：我懂你卡住了，我陪你先迈出第一步。', 'companion strip follows mascot');

const files = {
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  homeJs: read('miniprogram/pages/home/home.js'),
  homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  reviewJs: read('miniprogram/pages/review/review.js'),
  reviewViewModelJs: read('miniprogram/view-models/review-view-model.js'),
  toolsWxml: read('miniprogram/pages/tools/tools.wxml'),
  toolsJs: read('miniprogram/pages/tools/tools.js'),
  toolsViewModelJs: read('miniprogram/view-models/tools-view-model.js'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  profileJs: read('miniprogram/pages/profile/profile.js'),
  profileViewModelJs: read('miniprogram/view-models/profile-view-model.js'),
  tutorWxml: read('miniprogram/pages/tutor/tutor.wxml'),
  tutorJs: read('miniprogram/pages/tutor/tutor.js'),
  reviewCardsJs: read('miniprogram/utils/review-cards.js')
};

const tabWxml = [files.homeWxml, files.reviewWxml, files.toolsWxml, files.profileWxml].join('\n');
assert.strictEqual((tabWxml.match(/\{\{homeViewModel\.companionStrip\}\}/g) || []).length + (tabWxml.match(/\{\{companionLine\}\}/g) || []).length + (tabWxml.match(/\{\{reviewViewModel\.companionStrip\}\}/g) || []).length + (tabWxml.match(/\{\{toolsViewModel\.companionStrip\}\}/g) || []).length + (tabWxml.match(/\{\{profileViewModel\.companionStrip\}\}/g) || []).length, 4, 'four tabs show a shared mascot strip');
assert(files.homeWxml.includes('{{homeViewModel.companionStrip}}'), 'home renders mascot strip through homeViewModel');
assert(files.reviewWxml.includes('{{reviewViewModel.companionStrip}}'), 'review renders mascot strip');
assert(files.toolsWxml.includes('{{toolsViewModel.companionStrip}}'), 'tools renders mascot strip');
assert(files.profileWxml.includes('{{profileViewModel.companionStrip}}'), 'profile renders mascot strip');

const tabRenderSource = [tabWxml, files.homeJs, files.homeViewModelJs, files.reviewJs, files.reviewViewModelJs, files.toolsJs, files.toolsViewModelJs, files.profileJs, files.profileViewModelJs].join('\n');
['今晚路线 · 第 1 步：排顺序', '今晚路线 · 第 3 步：修卡点', '今晚路线 · 第 4 步：明天轻轻回访', '今晚路线 · 第 5 步：家长 5 秒复盘'].forEach((routeText) => {
  assert(tabRenderSource.includes(routeText), `current route stage is visible: ${routeText}`);
});

[
  [files.homeJs + files.homeViewModelJs, 'home'],
  [files.reviewJs, 'review'],
  [files.toolsJs, 'tools'],
  [files.profileJs, 'profile']
].forEach(([text, name]) => {
  assert(text.includes('formatCompanionLine') || text.includes('buildHomeViewModel') || text.includes('COMPANION_HOME_COPY'), `${name} uses shared/viewModel companion strip logic`);
  assert(text.includes('getCompanionStageCopy') || text.includes('buildHomeViewModel') || text.includes('COMPANION_HOME_COPY'), `${name} uses shared/viewModel stage copy logic`);
});

assert(files.tutorJs.includes('formatInternalLabel'), 'tutor maps mastery/step labels before display');
assert(files.reviewCardsJs.includes('formatInternalLabel'), 'review cards map internal labels before generating user-facing cards');
assert(files.profileJs.includes('formatIssueType'), 'profile maps issue type before display');

const visibleSource = [
  files.homeWxml,
  files.reviewWxml,
  files.toolsWxml,
  files.profileWxml,
  files.tutorWxml
].join('\n');

['home_xiaodian_entry', 'needs_student_step', '系统诊断', '家长应监督', '严重薄弱', '小满', '秒解', '答案已生成', '拍照出答案', '数学老师', '英语老师', '语文老师', '科学老师'].forEach((term) => {
  assert(!visibleSource.includes(term), `visible WXML avoids forbidden/internal wording: ${term}`);
});

const userFacingStringPattern = /['"`]([^'"`]*(?:home_xiaodian_entry|needs_student_step)[^'"`]*)['"`]/g;
[files.homeJs, files.reviewJs, files.toolsJs, files.profileJs, files.tutorJs, files.reviewCardsJs].forEach((text) => {
  let hit;
  while ((hit = userFacingStringPattern.exec(text))) {
    const snippet = hit[1];
    const nearby = text.slice(Math.max(0, hit.index - 80), hit.index + snippet.length + 80);
    assert(/formatInternalLabel|formatSourceLabel|source:|source,|mastery_status|masterySignal|status:|coach_step|selectedHomeworkSource|appendThinkingReceipt|saveTodayFocusFromThought/.test(nearby), `raw key must not be in user-facing string: ${snippet}`);
  }
});

console.log('All RC1 companion polish tests pass.');
