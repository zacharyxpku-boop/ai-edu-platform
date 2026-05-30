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
const files = {
  packageJson: read('package.json'),
  storageJs: read('miniprogram/utils/storage.js'),
  homeJs: read('miniprogram/pages/home/home.js'),
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
  reviewJs: read('miniprogram/pages/review/review.js'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  reviewViewModelJs: read('miniprogram/view-models/review-view-model.js'),
  tutorJs: read('miniprogram/pages/tutor/tutor.js'),
  tutorWxml: read('miniprogram/pages/tutor/tutor.wxml'),
  arcadeJs: read('miniprogram/pages/arcade/arcade.js'),
  arcadeWxml: read('miniprogram/pages/arcade/arcade.wxml'),
  profileJs: read('miniprogram/pages/profile/profile.js'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  profileViewModelJs: read('miniprogram/view-models/profile-view-model.js')
};

const visibleTabCopy = [files.homeWxml, files.reviewWxml, files.tutorWxml, files.arcadeWxml, files.profileWxml].join('\n');
const pageCode = [files.homeJs, files.reviewJs, files.tutorJs, files.arcadeJs, files.profileJs].join('\n');

['formatIssueType', 'formatRouteStage', 'formatSourceLabel', 'formatInternalLabel', 'formatCompanionLine', 'getCompanionStageCopy'].forEach((name) => {
  assert.strictEqual(typeof storage[name], 'function', `${name} remains exported`);
});

assert.strictEqual(storage.formatCompanionLine('anan'), '咕点：我懂你卡住了，我陪你先迈出第一步。', 'formatCompanionLine resolves retired ids to mascot');
assert.strictEqual(storage.formatSourceLabel('home_xiaodian_entry'), '作业点拨入口', 'source key still maps to Chinese');
assert.strictEqual(storage.formatInternalLabel('needs_student_step'), '等孩子先说第一步', 'student-step status still maps to Chinese');

[
  '今日老师接手',
  '6 位老师怎么分工',
  '当前演示判断',
  '近 7 天错误类型分布',
  '系统诊断',
  '家长应监督',
  '严重薄弱',
  '孩子问题',
  'home_xiaodian_entry',
  'needs_student_step',
  '小满',
  '数学老师',
  '英语老师',
  '语文老师',
  '科学老师',
  '秒解',
  '答案已生成',
  '拍照出答案',
  '排行榜',
  'PK',
  '冲榜'
].forEach((term) => {
  assert(!visibleTabCopy.includes(term), `visible tab copy avoids ${term}`);
});

[
  'teacherHandoff',
  'teacherTeamProfiles',
  'NOVA_TEACHER_PROFILES',
  'ERROR_TYPE_PROFILES',
  'MEMORY_PLAY_MODES',
  'recommendedErrorType',
  'errorTypeProfiles',
  'parentReviewSummary'
].forEach((term) => {
  assert(!pageCode.includes(term), `page code no longer binds pseudo-Nova module: ${term}`);
  assert(!files.storageJs.includes(term), `storage no longer exports pseudo-Nova module: ${term}`);
});

assert(files.homeWxml.includes('homeViewModel.teacherPickerLabel') && files.homeViewModelJs.includes('teacherPickerLabel'), 'home keeps the mascot entry through homeViewModel');
assert(files.homeWxml.includes('homeViewModel.teacherPickerHint') && files.homeViewModelJs.includes('teacherPickerHint'), 'home keeps a light mascot explanation through homeViewModel');
assert(files.homeWxml.includes('{{homeViewModel.companionStrip}}'), 'home shows the mascot strip through homeViewModel');
assert(files.homeWxml.includes('{{homeViewModel.primaryCta}}') && files.homeViewModelJs.includes('primaryCta'), 'home main CTA remains through homeViewModel');

assert(files.reviewWxml.includes("{{reviewViewModel.primaryCta.text}}") && files.reviewViewModelJs.includes("subtitle:"), "review keeps the low-pressure issue line in the view model and exposes one CTA");
assert(files.reviewViewModelJs.includes("buildPrimaryCard") && files.reviewViewModelJs.includes("primaryCta"), "review shows one first-look and first-step line");
assert(!files.reviewWxml.includes("reviewViewModel.emptyState") && files.reviewViewModelJs.includes("emptyState"), "review empty state remains clear in logic without adding another visible panel");
assert(files.reviewWxml.includes("data-scene=\"tutor\"") && files.reviewViewModelJs.includes("emptyState"), "review empty state can still route to the first-step flow");

assert(files.tutorWxml.includes("tutor-hero-shell") && files.tutorWxml.includes("tutor-entry-grid"), "tutor keeps the first-step title shell");
assert(files.arcadeWxml.includes("arcade-hero-shell") && files.arcadeWxml.includes("ux-kit-jump-grid"), "arcade keeps review as jump cards");
assert(files.arcadeWxml.includes("data-scene=\"tutor\""), "arcade routes empty recall back to stuck-point repair");
assert(!files.arcadeWxml.includes("鎻愬彇璁板繂") && !files.arcadeWxml.includes("姝ラ椤哄簭") && !files.arcadeWxml.includes("姒傚康杈圭晫"), "arcade avoids heavy memory taxonomy");

assert(files.profileWxml.includes("{{profileViewModel.title}}") && files.profileViewModelJs.includes("title:"), "profile keeps the parent one-question heading");
assert(files.profileWxml.includes("parent-hero-shell") && files.profileWxml.includes("parent-dash-evidence") && files.profileWxml.includes("profileViewModel.title") && files.profileViewModelJs.includes("title:"), "profile main card keeps the parent recap shell");
assert(!files.profileWxml.includes("profileViewModel.growthMemoryCard") && files.profileViewModelJs.includes("proofSummary"), "profile memory stays in logic instead of becoming another visible card");
assert(!files.profileWxml.includes('error-distribution'), 'profile removes dashboard-style error distribution');

['anan', 'wenwen', 'yueyue'].forEach((id) => {
  storage.saveCompanionPreference(id);
  const preference = storage.loadCompanionPreference();
  const copy = [
    storage.formatCompanionLine(preference),
    storage.getCompanionStageCopy('home', preference),
    storage.getCompanionStageCopy('review', preference),
    storage.getCompanionStageCopy('tools', preference),
    storage.getCompanionStageCopy('profile', preference)
  ].join('\n');
  assert.strictEqual(preference.selectedCompanion, 'gudian', `${id} resolves to the single mascot`);
  assert(copy.includes('咕点'), '咕点 appears across the global mascot route copy');
});

assert(files.packageJson.includes('scripts/test-rc13-nova-system-alignment.cjs'), 'npm test includes RC1.3 correction guard');

console.log('All RC1.3 global companion route correction tests pass.');
