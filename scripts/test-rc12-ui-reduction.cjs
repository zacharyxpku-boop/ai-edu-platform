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
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  reviewViewModelJs: read('miniprogram/view-models/review-view-model.js'),
  tutorWxml: read('miniprogram/pages/tutor/tutor.wxml'),
  arcadeWxml: read('miniprogram/pages/arcade/arcade.wxml'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  profileViewModelJs: read('miniprogram/view-models/profile-view-model.js'),
  packageJson: read('package.json')
};

const tabWxml = [files.homeWxml, files.reviewWxml, files.tutorWxml, files.arcadeWxml, files.profileWxml].join('\n');

assert(files.homeWxml.includes('{{homeViewModel.title}}') && files.homeViewModelJs.includes('title:'), 'home keeps one main question through homeViewModel');
assert(files.homeWxml.includes('{{homeViewModel.primaryCta}}') && files.homeViewModelJs.includes('primaryCta'), 'home main CTA remains through homeViewModel');
assert(files.homeWxml.includes('homeViewModel.emptyState') && files.homeViewModelJs.includes('emptyState'), 'home keeps the first-run empty state inside the compact input card through homeViewModel');
assert.strictEqual((files.homeWxml.match(/route-next-lite/g) || []).length, 1, 'home has one compact next-step hint');
assert(!files.homeWxml.includes('{{companionCopy.home}}'), 'home does not stack a second companion explanation');

assert(files.reviewWxml.includes('{{reviewViewModel.title}}') && files.reviewViewModelJs.includes('今晚只修一个卡点'), 'review keeps one main question');
assert(files.reviewWxml.includes('{{reviewViewModel.primaryCta.text}}') && files.reviewViewModelJs.includes('开始 5 分钟修复'), 'review main CTA remains');
assert(files.reviewWxml.includes("{{reviewViewModel.primaryCta.text}}") && files.reviewViewModelJs.includes("emptyState"), "review empty state stays in view-model logic without adding a second first-screen CTA");
assert(!files.reviewWxml.includes('{{companionCopy.review}}'), 'review does not stack a second companion explanation');
assert(!files.reviewWxml.includes('growthMemory.review'), 'review growth memory is not stacked in the hero');

assert(files.tutorWxml.includes("tutor-hero-shell") && files.tutorWxml.includes("tutor-entry-grid"), "tutor keeps one first-step jump shell");
assert(files.arcadeWxml.includes("arcade-hero-shell") && files.arcadeWxml.includes("ux-kit-jump-grid"), "arcade keeps one review island jump shell");
assert(!files.tutorWxml.includes("{{companionCopy.revisit}}") && !files.arcadeWxml.includes("{{companionCopy.revisit}}"), "retired tools companion explanation is not stacked on active tabs");
assert(!files.tutorWxml.includes("growthMemory.revisit") && !files.arcadeWxml.includes("growthMemory.revisit"), "retired tools growth memory is not stacked on active tabs");

assert(files.profileWxml.includes('parent-hero-shell') && files.profileWxml.includes('parent-dash-evidence') && files.profileWxml.includes('profileViewModel.title') && files.profileViewModelJs.includes('title:'), 'profile first screen includes the parent one-question shell');
assert(files.profileViewModelJs.includes('今晚孩子卡在'), 'profile hero card keeps current stuck point');
assert(files.profileViewModelJs.includes('信任边界'), 'profile hero card keeps trust boundary');
assert(files.profileWxml.includes('{{profileViewModel.primaryCta}}') && files.profileViewModelJs.includes('完成今日复盘'), 'profile main CTA remains');
assert(!files.profileWxml.includes('{{companionCopy.profile}}'), 'profile does not stack a second companion explanation');
assert(files.profileWxml.includes("parent-subcheck") && files.profileWxml.includes("parent-dash-route"), "profile keeps secondary process as compact jump cards below the parent launch shell");
assert(!files.profileWxml.includes("parent-report-capability-panel"), "profile does not render retired detailed report ledger");

[
  ['home', files.homeWxml, 'homeViewModel.routePill'],
  ['review', files.reviewWxml, 'route-note short'],
  ['tutor', files.tutorWxml, 'tutor-entry-grid'],
  ['arcade', files.arcadeWxml, 'arcade-subcheck'],
  ['profile', files.profileWxml, 'route-strip compact']
].forEach(([name, text, marker]) => {
  assert(text.includes(marker), `${name} keeps one route marker`);
  if (name === 'home' || name === 'review' || name === 'profile') {
    assert.strictEqual((text.match(/companion-route-strip/g) || []).length, 1, `${name} has exactly one companion strip`);
  }
});

[
  ['anan', ['咕点：我懂你卡住了，我陪你先迈出第一步。', '咕点陪你先找今晚第一步。', '咕点陪你只修这一小步', '咕点陪你轻轻回访', '咕点帮你整理']],
  ['wenwen', ['咕点：我懂你卡住了，我陪你先迈出第一步。', '咕点陪你先找今晚第一步。', '咕点陪你只修这一小步', '咕点陪你轻轻回访', '咕点帮你整理']],
  ['yueyue', ['咕点：我懂你卡住了，我陪你先迈出第一步。', '咕点陪你先找今晚第一步。', '咕点陪你只修这一小步', '咕点陪你轻轻回访', '咕点帮你整理']]
].forEach(([id, expectations]) => {
  storage.saveCompanionPreference(id);
  const preference = storage.loadCompanionPreference();
  const actual = [
    storage.formatCompanionLine(preference),
    storage.getCompanionStageCopy('home', preference),
    storage.getCompanionStageCopy('review', preference),
    storage.getCompanionStageCopy('revisit', preference),
    storage.getCompanionStageCopy('profile', preference)
  ].join('\n');
  expectations.forEach((copy) => {
    assert(actual.includes(copy), `${id} keeps a consistent companion voice: ${copy}`);
  });
});

[
  'home_xiaodian_entry',
  'needs_student_step',
  '系统诊断',
  '家长应监督',
  '严重薄弱',
  '孩子问题',
  '管理建议',
  '请家长加强',
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
  assert(!tabWxml.includes(term), `RC1.2 first-stage tab copy avoids ${term}`);
});

assert(files.packageJson.includes('scripts/test-rc12-ui-reduction.cjs'), 'npm test includes RC1.2 UI reduction guard');

console.log('All RC1.2 UI reduction tests pass.');
