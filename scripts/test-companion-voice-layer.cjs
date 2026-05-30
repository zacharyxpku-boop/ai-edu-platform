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
const stages = [
  'home_plan',
  'home_stuck',
  'review_focus',
  'review_repairing',
  'review_completed',
  'tools_recall',
  'tools_empty',
  'profile_summary',
  'profile_empty',
  'parent_question',
  'next_step'
];

assert.strictEqual(typeof storage.getCompanionStageCopy, 'function', 'voice layer formatter is exported');
assert(Array.isArray(storage.COMPANION_OPTIONS) && storage.COMPANION_OPTIONS.length === 1, 'single global mascot remains');

storage.COMPANION_OPTIONS.forEach((companion) => {
  stages.forEach((stage) => {
    const byPreference = storage.getCompanionStageCopy(stage, { selectedCompanion: companion.id });
    const byCompanionFirst = storage.getCompanionStageCopy(companion.id, stage);
    assert(byPreference && byPreference.includes(companion.label), `${companion.label} has ${stage} copy`);
    assert.strictEqual(byCompanionFirst, byPreference, `companion-first signature works for ${companion.id}/${stage}`);
  });
});

stages.forEach((stage) => {
  const copies = storage.COMPANION_OPTIONS.map((companion) => storage.getCompanionStageCopy(stage, {
    selectedCompanion: companion.id
  }));
  assert.strictEqual(new Set(copies).size, storage.COMPANION_OPTIONS.length, `${stage} resolves through the single mascot`);
});

[
  ['home', 'home_plan'],
  ['review', 'review_focus'],
  ['tools', 'tools_recall'],
  ['profile', 'profile_summary']
].forEach(([retired, modern]) => {
  storage.COMPANION_OPTIONS.forEach((companion) => {
    assert.strictEqual(
      storage.getCompanionStageCopy(retired, { selectedCompanion: companion.id }),
      storage.getCompanionStageCopy(modern, { selectedCompanion: companion.id }),
      `${retired} remains compatible with ${modern} for ${companion.id}`
    );
  });
});

const anan = [
  storage.getCompanionStageCopy('home_plan', { selectedCompanion: 'anan' }),
  storage.getCompanionStageCopy('review_focus', { selectedCompanion: 'anan' }),
  storage.getCompanionStageCopy('tools_recall', { selectedCompanion: 'anan' }),
  storage.getCompanionStageCopy('profile_summary', { selectedCompanion: 'anan' })
].join('\n');
assert(anan.includes('咕点') && anan.includes('第一步'), 'retired 安安 id resolves to mascot voice across tabs');

const wenwen = [
  storage.getCompanionStageCopy('home_plan', { selectedCompanion: 'wenwen' }),
  storage.getCompanionStageCopy('review_focus', { selectedCompanion: 'wenwen' }),
  storage.getCompanionStageCopy('tools_recall', { selectedCompanion: 'wenwen' }),
  storage.getCompanionStageCopy('profile_summary', { selectedCompanion: 'wenwen' })
].join('\n');
assert(wenwen.includes('咕点') && wenwen.includes('第一步'), 'retired 问问 id resolves to mascot first-step voice');

const yueyue = [
  storage.getCompanionStageCopy('home_plan', { selectedCompanion: 'yueyue' }),
  storage.getCompanionStageCopy('review_focus', { selectedCompanion: 'yueyue' }),
  storage.getCompanionStageCopy('tools_recall', { selectedCompanion: 'yueyue' }),
  storage.getCompanionStageCopy('profile_summary', { selectedCompanion: 'yueyue' })
].join('\n');
assert(yueyue.includes('咕点') && !/排行榜|PK|冲榜|一小关/.test(yueyue), 'retired 跃跃 id no longer exposes challenge framing');

const allVoiceCopy = storage.COMPANION_OPTIONS
  .flatMap((companion) => stages.map((stage) => storage.getCompanionStageCopy(stage, { selectedCompanion: companion.id })))
  .join('\n');
['答案已生成', '拍照出答案', '秒解', '家长应监督', '系统诊断', '严重薄弱'].forEach((term) => {
  assert(!allVoiceCopy.includes(term), `voice layer avoids forbidden wording: ${term}`);
});

const homeJs = read('miniprogram/pages/home/home.js');
const reviewJs = read('miniprogram/pages/review/review.js');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const profileJs = read('miniprogram/pages/profile/profile.js');
[
  ['home', homeJs, 'home_plan'],
  ['review', reviewJs, 'review_focus'],
  ['entryDetail', entryDetailJs, 'entry-detail-scenes'],
  ['profile', profileJs, 'profile_summary']
].forEach(([name, text, stage]) => {
  if (name === 'entryDetail') {
    assert(text.includes('SCENES') && text.includes('openScene'), `${name} uses child scene routing`);
    return;
  }
  assert(text.includes('getCompanionStageCopy'), `${name} uses shared companion voice formatter`);
  assert(text.includes(stage), `${name} uses detailed companion stage ${stage}`);
});

const tabCode = [homeJs, reviewJs, entryDetailJs, profileJs].join('\n');
[
  /page\s*===\s*['"]home['"]/,
  /page\s*===\s*['"]review['"]/,
  /page\s*===\s*['"]tools['"]/,
  /page\s*===\s*['"]profile['"]/
].forEach((pattern) => {
  assert(!pattern.test(tabCode), `no page-fixed teacher branch: ${pattern}`);
});

assert(read('package.json').includes('scripts/test-companion-voice-layer.cjs'), 'npm test includes companion voice layer guard');

console.log('All companion voice layer tests pass.');
