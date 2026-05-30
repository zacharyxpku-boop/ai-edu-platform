const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const storageMap = {};
global.wx = {
  store: {},
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
    Array
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const storage = loadStorage();

assert(storage.KEYS.companionPreference === 'ydzx.companion.preference.v1', 'companion preference has a local storage key');
assert(Array.isArray(storage.COMPANION_OPTIONS) && storage.COMPANION_OPTIONS.length === 1, 'single mascot option is defined');
assert(typeof storage.loadCompanionPreference === 'function', 'can load companion preference');
assert(typeof storage.saveCompanionPreference === 'function', 'can save companion preference');
assert(typeof storage.companionCopyFor === 'function', 'can read mascot stage copy');

const defaultPreference = storage.loadCompanionPreference();
assert.strictEqual(defaultPreference.selectedCompanion, 'gudian', 'default mascot is gudian');
assert.strictEqual(defaultPreference.selectedLabel, '咕点', 'default mascot label is 咕点');

const expectedOptions = [
  ['gudian', '咕点', '先动一小步', '我懂你卡住了，我陪你先迈出第一步']
];
expectedOptions.forEach(([id, label, short, desc]) => {
  const option = storage.COMPANION_OPTIONS.find((item) => item.id === id);
  assert(option, `mascot option exists: ${id}`);
  assert.strictEqual(option.label, label, `${label} label remains the mascot identity`);
  assert.strictEqual(option.short, short, `${label} option names the small-step role`);
  assert.strictEqual(option.desc, desc, `${label} option explains mascot promise`);
});

const stageNames = ['home', 'review', 'revisit', 'profile'];
storage.COMPANION_OPTIONS.forEach((option) => {
  storage.saveCompanionPreference(option.id);
  const current = storage.loadCompanionPreference();
  assert.strictEqual(current.selectedCompanion, option.id, `${option.label} remains the global mascot`);
  stageNames.forEach((stage) => {
    const copy = storage.companionCopyFor(stage);
    assert(copy.includes(option.label), `${stage} copy follows mascot ${option.label}`);
  });
});

storage.saveCompanionPreference('anan');
const retiredPreference = storage.loadCompanionPreference();
assert.strictEqual(retiredPreference.selectedCompanion, 'gudian', 'retired six-teacher ids resolve to 咕点');
assert.strictEqual(storage.companionCopyFor('home'), '咕点陪你先找今晚第一步。', 'home copy follows 咕点');
assert.strictEqual(storage.companionCopyFor('review'), '咕点陪你只修这一小步，不讲完整答案。', 'review copy follows 咕点');
assert.strictEqual(storage.companionCopyFor('revisit'), '咕点陪你轻轻回访昨天那一步。', 'revisit copy follows 咕点');
assert.strictEqual(storage.companionCopyFor('profile'), '咕点帮你整理成家长能看懂的一句话。', 'profile copy follows 咕点');

const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
const homeViewModelJs = read('miniprogram/view-models/home-view-model.js');
const homeWxss = read('miniprogram/pages/home/home.wxss');
const reviewJs = read('miniprogram/pages/review/review.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const reviewViewModelJs = read('miniprogram/view-models/review-view-model.js');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const entryDetailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
const revisitViewModelJs = read('miniprogram/view-models/revisit-view-model.js');
const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileViewModelJs = read('miniprogram/view-models/profile-view-model.js');
const teacherDoc = read('docs/teacher-companion-system.md');

assert(homeWxml.includes('mini-hero-mascot') && homeViewModelJs.includes('teacherPickerLabel'), 'home has a mascot entry in the new reference shell');
assert(!homeWxml.includes('companion-picker') && !homeWxml.includes('teacher-grid'), 'home no longer renders a teacher selector');
assert(!homeWxml.includes('{{item.short}}') && !homeWxml.includes('{{item.desc}}'), 'home no longer renders companion style cards');
[
  ['home', homeWxml, '{{companionCopy.home}}', 'mini-hero-mascot'],
  ['review', reviewWxml, '{{companionCopy.review}}', 'review-hero-shell'],
  ['entryDetail', entryDetailWxml, '{{companionCopy.revisit}}', 'entry-jump-grid'],
  ['profile', profileWxml, '{{companionCopy.profile}}', 'parent-hero-shell']
].forEach(([name, wxml, stackedCopy, companionBinding]) => {
  assert(wxml.includes(companionBinding || '{{companionLine}}'), `${name} renders one mascot strip`);
  assert(!wxml.includes(stackedCopy), `${name} does not stack an extra companion explanation`);
});

[
  [homeJs + homeViewModelJs, 'home'],
  [reviewJs, 'review'],
  [entryDetailJs, 'entryDetail'],
  [profileJs, 'profile']
].forEach(([text, name]) => {
  if (name === 'entryDetail') {
    assert(text.includes('SCENES') && text.includes('openScene'), `${name} keeps child scene compatibility`);
    return;
  }
  assert(text.includes('loadCompanionPreference') || text.includes('buildHomeViewModel'), `${name} keeps companion compatibility`);
  assert(text.includes('getCompanionStageCopy') || text.includes('companionCopyFor') || text.includes('COMPANION_HOME_COPY'), `${name} reads mascot copy`);
});

assert(homeJs.includes('saveCompanionPreference'), 'home keeps retired companion save compatibility');
assert(homeJs.includes('companionOptions'), 'home keeps retired companion options data compatibility');
assert(teacherDoc.includes('companionPreference') && teacherDoc.includes('selectedCompanion'), 'teacher doc explains companionPreference');
assert(teacherDoc.includes('孩子今天选择谁，谁就陪孩子走完整条 Tonight Route'), 'retired teacher doc still documents prior companion behavior');
assert(!teacherDoc.includes('作业点拨默认用小原或问问'), 'teacher doc no longer describes page-fixed teachers');
assert(!teacherDoc.includes('我的页家长复盘使用团团'), 'teacher doc no longer forces 团团 on profile');

const tabPages = [homeWxml, homeViewModelJs, reviewWxml, reviewViewModelJs, entryDetailWxml, revisitViewModelJs, profileWxml].join('\n');
['帮我安排今晚学习', '先去说第一步'].forEach((cta) => {
  assert(tabPages.includes(cta), `main CTA remains: ${cta}`);
});
assert(reviewWxml.includes('review-main-cta') && reviewViewModelJs.includes('primaryCta'), 'review main CTA remains in the new shell');
assert(tabPages.includes('parent-primary') && profileViewModelJs.includes('primaryCta'), 'profile main CTA remains in the new shell');
['数学老师', '英语老师', '语文老师', '科学老师', '小满', '秒解', '答案已生成', '拍照出答案', '排行榜', 'PK', '冲榜'].forEach((term) => {
  assert(!tabPages.includes(term), `front-stage tab pages avoid forbidden wording: ${term}`);
});

const optionText = JSON.stringify(storage.COMPANION_OPTIONS);
['小原', '问问', '安安', '阿衡', '团团', '跃跃', '作业规划', '错题修复', '记忆复习', '家长复盘', '数学老师', '英语老师'].forEach((term) => {
  assert(!optionText.includes(term), `mascot options avoid teacher-matrix wording: ${term}`);
});

console.log('All companion preference tests pass.');
