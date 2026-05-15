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
  toolsWxml: read('miniprogram/pages/tools/tools.wxml'),
  toolsViewModelJs: read('miniprogram/view-models/tools-view-model.js'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  profileViewModelJs: read('miniprogram/view-models/profile-view-model.js'),
  packageJson: read('package.json')
};

const tabWxml = [files.homeWxml, files.reviewWxml, files.toolsWxml, files.profileWxml].join('\n');

assert(files.homeWxml.includes('{{homeViewModel.title}}') && files.homeViewModelJs.includes('title:'), 'home keeps one main question through homeViewModel');
assert(files.homeWxml.includes('{{homeViewModel.primaryCta}}') && files.homeViewModelJs.includes('primaryCta'), 'home main CTA remains through homeViewModel');
assert(files.homeWxml.includes('homeViewModel.emptyState') && files.homeViewModelJs.includes('emptyState'), 'home keeps the first-run empty state inside the compact input card through homeViewModel');
assert.strictEqual((files.homeWxml.match(/route-next-lite/g) || []).length, 1, 'home has one compact next-step hint');
assert(!files.homeWxml.includes('{{companionCopy.home}}'), 'home does not stack a second companion explanation');

assert(files.reviewWxml.includes('{{reviewViewModel.title}}') && files.reviewViewModelJs.includes('今晚只修一个卡点'), 'review keeps one main question');
assert(files.reviewWxml.includes('{{reviewViewModel.primaryCta.text}}') && files.reviewViewModelJs.includes('开始 5 分钟修复'), 'review main CTA remains');
assert(files.reviewWxml.includes('{{reviewViewModel.emptyState.cta}}') && files.reviewViewModelJs.includes('去说第一步'), 'review empty state has one clear action');
assert(!files.reviewWxml.includes('{{companionCopy.review}}'), 'review does not stack a second companion explanation');
assert(!files.reviewWxml.includes('growthMemory.review'), 'review growth memory is not stacked in the hero');

assert(files.toolsWxml.includes('{{toolsViewModel.title}}') && files.toolsViewModelJs.includes('今天只回看这一小步'), 'tools keeps one recall question');
assert(files.toolsWxml.includes('{{toolsViewModel.primaryCta.text}}') && files.toolsViewModelJs.includes('先去说第一步'), 'tools fallback CTA routes back to stuck-point repair');
assert(files.toolsWxml.includes('{{toolsViewModel.primaryCta.text}}') && files.toolsViewModelJs.includes('轻轻回看'), 'tools review-card CTA is visible when there is a card');
assert(!files.toolsWxml.includes('quick-play-panel featured'), 'tools avoids a second primary trial recommendation below the main card');
assert(!files.toolsWxml.includes('wx:if="{{false}}"') && files.toolsWxml.includes('tools-secondary-games') && files.toolsWxml.includes('class="material-panel"'), 'tools secondary practice is available below the main recall card');
assert(!files.toolsWxml.includes('{{companionCopy.tools}}'), 'tools does not stack a second companion explanation');
assert(!files.toolsWxml.includes('growthMemory.tools'), 'tools growth memory is not stacked in the hero');

assert(files.profileWxml.includes('{{profileViewModel.title}}') && files.profileViewModelJs.includes('今晚家长只问这一句'), 'profile main question is the parent one-question moment');
assert(files.profileWxml.includes('今晚卡住') && files.profileWxml.includes('只问一句') && files.profileWxml.includes('最近小结') && files.profileViewModelJs.includes('家长只问一句'), 'profile first screen includes the friend-safe one-question shell');
assert(files.profileViewModelJs.includes('今晚孩子卡在'), 'profile hero card keeps current stuck point');
assert(files.profileViewModelJs.includes('信任边界'), 'profile hero card keeps trust boundary');
assert(files.profileWxml.includes('{{profileViewModel.primaryCta}}') && files.profileViewModelJs.includes('完成今日复盘'), 'profile main CTA remains');
assert(!files.profileWxml.includes('{{companionCopy.profile}}'), 'profile does not stack a second companion explanation');
assert(files.profileWxml.includes('profile-secondary-process') && files.profileWxml.includes('showAdvancedProfile'), 'profile process summary is folded behind advanced profile');

[
  ['home', files.homeWxml, 'homeViewModel.routePill'],
  ['review', files.reviewWxml, 'route-note short'],
  ['tools', files.toolsWxml, 'toolsViewModel.routePill'],
  ['profile', files.profileWxml, 'route-strip compact']
].forEach(([name, text, marker]) => {
  assert(text.includes(marker), `${name} keeps one route marker`);
  assert.strictEqual((text.match(/companion-route-strip/g) || []).length, 1, `${name} has exactly one companion strip`);
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
    storage.getCompanionStageCopy('tools', preference),
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
