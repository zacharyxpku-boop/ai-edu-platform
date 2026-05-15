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
assert.strictEqual(typeof storage.growthMemoryCopyFor, 'function', 'growth memory copy helper exists');
assert.strictEqual(typeof storage.buildWeeklyGrowthMemory, 'function', 'weekly growth memory helper exists');
assert.strictEqual(typeof storage.getGrowthMemoryLine, 'function', 'human growth memory line helper exists');

const focus = storage.saveTodayFocus({
  id: 'focus_memory_step',
  title: '列式和下一步',
  issueType: '步骤断点',
  sourceText: '我不会列式',
  thought: '我不知道第一步怎么写',
  isStuck: true,
  repairStatus: 'not_started',
  hasMiniActionDone: false,
  reason: '孩子不是整题不会，只是卡在第一步。',
  recommendation: '先说第一步，再做一道小变式。'
});
storage.saveReviewCards([
  {
    id: 'rc_memory_1',
    source: 'today_focus',
    sourceFocusId: focus.id,
    issueType: '步骤断点',
    weakPoint: '列式和下一步',
    front: '这类题第一步应该找什么？',
    due: new Date(Date.now() - 1000).toISOString()
  }
]);

storage.saveCompanionPreference('anan');
const ananLine = storage.getGrowthMemoryLine(null, { selectedCompanion: 'anan' });
assert.strictEqual(JSON.stringify(ananLine.lines), JSON.stringify([
  '今天记录到：第一步怎么开始。咕点先帮你留住这一小步。',
  '明天用 2 分钟再看一眼。'
]), 'getGrowthMemoryLine returns honest single-record mascot lines');
assert.strictEqual(ananLine.empty, false, 'getGrowthMemoryLine knows when memory exists');
assert(!JSON.stringify(ananLine).includes('%'), 'growth memory line is not a percentage dashboard');
const ananMemory = storage.growthMemoryCopyFor('home');
assert.strictEqual(ananMemory, '今天记录到：第一步怎么开始。咕点先帮你留住这一小步。', 'home memory reason follows 咕点');
const ananPlan = storage.createTonightPlanFromInput('数学应用题 4 道，写完整过程');
assert(ananPlan.summaryLine.includes(ananMemory), 'tonightPlan summary line can reference remembered issue type');

storage.saveCompanionPreference('wenwen');
const wenwenLine = storage.getGrowthMemoryLine(null, { selectedCompanion: 'wenwen' });
assert(wenwenLine.oneLine.includes('今天记录到'), 'single-record memory line stays honest for legacy ids');
assert.strictEqual(
  storage.growthMemoryCopyFor('home'),
  '今天记录到：第一步怎么开始。咕点先帮你留住这一小步。',
  'home memory reason follows 咕点 after legacy id'
);
assert.strictEqual(
  storage.growthMemoryCopyFor('review'),
  '你不是整题不会，只是卡在第一步怎么开始。对应修法：先说第一步，再做一道小变式。',
  'review memory explains issue type with natural low-pressure repair action'
);
assert.strictEqual(
  storage.growthMemoryCopyFor('tools'),
  '咕点陪你轻轻回访一下，不用一次做很多。',
  'tools recall wording follows 咕点'
);

storage.saveCompanionPreference('aheng');
assert(storage.growthMemoryCopyFor('home').includes('今天记录到'), 'single-record legacy memory stays honest');
storage.saveCompanionPreference('tuantuan');
assert(!storage.growthMemoryCopyFor('profile').includes('阿衡'), 'profile memory does not force 阿衡');
assert(storage.growthMemoryCopyFor('profile').includes('今天记录到') && storage.growthMemoryCopyFor('profile').includes('咕点'), 'profile memory follows mascot voice');

storage.saveCompanionPreference('yueyue');
const weekly = storage.buildWeeklyGrowthMemory();
assert.strictEqual(weekly.title, '本周记得的一小步', 'profile has a light weekly memory card title');
assert.strictEqual(weekly.topIssueType, '第一步怎么开始', 'weekly memory records a natural top issue type from current loop');
assert(weekly.repeated.includes('列式和下一步'), 'weekly memory names recent repeated stuck point');
assert.strictEqual(weekly.oneLine, '今天记录到：第一步怎么开始。咕点先帮你留住这一小步。', 'weekly memory follows 咕点 honestly for one record');
assert.strictEqual(JSON.stringify(weekly.lines), JSON.stringify([
  '今天记录到：第一步怎么开始。咕点先帮你留住这一小步。',
  '明天用 2 分钟再看一眼。'
]), 'weekly memory stores short human lines');

storage.saveReviewCards([
  {
    id: 'rc_memory_2',
    source: 'today_focus',
    sourceFocusId: 'focus_memory_step_2',
    issueType: '步骤断点',
    weakPoint: '列式和下一步',
    due: new Date(Date.now() - 500).toISOString()
  },
  ...storage.loadReviewCards()
]);
const repeatedLine = storage.getGrowthMemoryLine(null, { selectedCompanion: 'wenwen' });
assert(repeatedLine.oneLine.includes('最近常卡在'), 'two same-kind records may say recently often stuck');

storage.clearLearningData();
storage.saveCompanionPreference('xiaoyuan');
const emptyWeekly = storage.buildWeeklyGrowthMemory();
assert.strictEqual(emptyWeekly.empty, true, 'weekly memory has an empty state');
assert.strictEqual(emptyWeekly.oneLine, '本周还在积累卡点，先从今晚这一小步开始。', 'weekly memory empty copy is gentle');
assert.strictEqual(JSON.stringify(emptyWeekly.lines), JSON.stringify(['本周还在积累卡点，先从今晚这一小步开始。']), 'empty weekly memory stays warm and short');

const homeJs = read('miniprogram/pages/home/home.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const toolsWxml = read('miniprogram/pages/tools/tools.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileViewModelJs = read('miniprogram/view-models/profile-view-model.js');
const visibleText = [homeJs, reviewWxml, toolsWxml, profileJs, profileWxml, profileViewModelJs].join('\n');

assert(homeJs.includes("growthMemoryCopyFor('home'"), 'home reads growth memory reason');
assert(!reviewWxml.includes('{{growthMemory.review}}'), 'review keeps growth memory out of the crowded first screen');
assert(!toolsWxml.includes('{{growthMemory.tools}}'), 'tools keeps growth memory out of the crowded first screen');
assert(homeJs.includes('getGrowthMemoryLine'), 'home uses human growth memory line helper');
assert(profileWxml.includes('profileViewModel.growthMemoryCard') && profileViewModelJs.includes('这几晚先看第一步'), 'profile renders light weekly memory card');
assert(profileViewModelJs.includes('再用几晚后'), 'profile memory card avoids fake trend claims when evidence is thin');
assert(profileWxml.indexOf('growth-memory-card') < profileWxml.indexOf('teacher-lite'), 'weekly memory card sits before teacher advice');
assert(profileJs.includes('buildWeeklyGrowthMemory'), 'profile builds weekly memory from shared helper');
assert(!profileJs.includes("selectedCompanion === 'aheng'") && !profileJs.includes("selectedCompanion === 'tuantuan'"), 'profile does not hard-bind memory to 阿衡 or 团团');
['近 7 天错误类型分布', '百分比', '系统诊断', '家长应监督', '严重薄弱', '落后', '完全本地运行', '秒解', '答案已生成', '拍照出答案'].forEach((term) => {
  assert(!visibleText.includes(term), `growth memory surfaces avoid unsafe wording: ${term}`);
});

console.log('All growth memory tests pass.');
