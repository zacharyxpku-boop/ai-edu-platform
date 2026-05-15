#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCommonJsMiniappModule(relativePath, sandboxPatch = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = Object.assign({
    module: { exports: {} },
    exports: {},
    require,
    console,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Array,
    Object
  }, sandboxPatch);
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

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

const ladder = loadCommonJsMiniappModule('miniprogram/utils/tutor-ladder.js');
const storage = loadCommonJsMiniappModule('miniprogram/utils/storage.js', {
  wx: global.wx,
  require(request) {
    if (request === './learning-priority') return {};
    return require(request);
  }
});

assert.strictEqual(ladder.HINT_LADDER.length, 5, 'hint ladder has five levels');

[
  '直接告诉我答案',
  '求答案',
  '不想写过程',
  '拍照出答案',
  '直接给结果'
].forEach((text) => {
  const result = ladder.buildTutorReply(text);
  assert.strictEqual(result.mastery_signal.status, 'blocked_answer_request', `blocks answer request: ${text}`);
  assert(result.reply.includes('我不能直接替你写答案'), 'blocked reply keeps no-answer boundary');
  assert(result.reply.includes('第 1 步'), 'blocked reply still shows the current Socratic step');
  assert(!/最终答案是|答案是|结果是/.test(result.reply), 'blocked reply does not leak direct answer wording');
});

const nextStep = ladder.buildTutorReply('我不会下一步怎么写', { currentHintLevel: 1 });
assert(nextStep.hint_level === 2 || nextStep.hint_level === 3, 'next-step stuck input enters level 2 or 3');
assert(nextStep.reply.includes('第一步'), 'next-step stuck input asks for first step');
assert(/^第 \d 步：/.test(nextStep.reply), 'local tutor reply starts with an explicit step label');

const repeated = ladder.buildTutorReply('我还是不会', {
  currentHintLevel: 2,
  messages: [
    { role: 'user', text: '我不会下一步怎么写' },
    { role: 'assistant', text: '提示 2/5：你觉得第一步应该做什么？' },
    { role: 'user', text: '还是卡住了' }
  ],
  selected: { text: '分数应用题' }
});
assert(repeated.hint_level >= 4, 'three stuck turns lower the threshold to level 4');
assert(repeated.reply.includes('A') && repeated.reply.includes('B') && repeated.reply.includes('相似例子'), 'repeated stuck reply gives two-choice low-threshold prompt');

const rounds = ladder.simulateThreeRoundSocratic([
  '我不会下一步怎么写',
  '还是卡住了',
  '直接告诉我答案'
], { selected: { text: '应用题' } });
assert.strictEqual(rounds.length, 3, 'three-round simulation returns three turns');
assert(rounds.every((item) => item.noFinalAnswer), 'three-round simulation never produces final answer phrasing');
assert(rounds.every((item) => item.asksForStudentStep), 'three-round simulation keeps asking for the learner first step');
assert(rounds.every((item) => /^第 \d 步：/.test(item.reply)), 'three-round simulation shows current step each round');

const mathPrompt = ladder.buildTutorReply('应用题不会列式', {
  selected: { text: '分数应用题' }
});
assert.strictEqual(mathPrompt.task_type, 'math_word_problem', 'math word problem is detected');
assert(mathPrompt.first_prompt.includes('已知条件') || mathPrompt.first_prompt.includes('题干'), 'math prompt starts with known conditions');

const englishPrompt = ladder.buildTutorReply('英语阅读题看不懂', {
  selected: { text: '英语阅读' }
});
assert.strictEqual(englishPrompt.task_type, 'reading_question', 'english reading gets reading_question type');
assert(englishPrompt.first_prompt.includes('细节') || englishPrompt.first_prompt.includes('主旨') || englishPrompt.first_prompt.includes('原因'), 'reading prompt keeps question-type orientation');

const focus = storage.saveTodayFocusFromThought('我不知道下一步怎么写', {
  source: 'tutor_ladder_test'
});
assert(focus && focus.issueType, 'todayFocus still records issue type while tutor ladder exists');
const blocked = storage.updateTodayFocusRepair({ repairStatus: 'completed' });
assert.strictEqual(blocked.repairStatus, 'in_progress', 'todayFocus mini-action gate still blocks direct completion');

console.log('All tutor ladder tests pass.');
