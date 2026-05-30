#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'storage.js');
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
  Math
};
vm.runInNewContext(code, sandbox, { filename: file });
const storage = sandbox.module.exports;

storage.clearLearningData();

const firstScenario = storage.saveTodayFocusFromThought('我不知道下一步怎么写。', { source: 'test' });
assert.strictEqual(firstScenario.isStuck, true, 'scenario 1: stuck wording creates a focus');
assert.strictEqual(firstScenario.issueType, '步骤断点', 'scenario 1: next-step wording is typed as a step break');
assert.strictEqual(firstScenario.title, '列式和下一步', 'scenario 1: child-facing focus title is actionable');

storage.clearLearningData();

const stuck = storage.saveTodayFocusFromThought('我知道要找条件，但不知道下一步怎么列式', { source: 'test' });
assert.strictEqual(stuck.isStuck, true, 'stuck input creates a repair focus');
assert.strictEqual(stuck.issueType, '步骤断点', 'stuck input gets an issue type');
assert.strictEqual(stuck.repairStatus, 'not_started', 'stuck focus starts as not started');
assert.ok(stuck.sourceText.includes('不知道下一步'), 'focus keeps source text');

const supplemented = storage.saveTodayFocusFromThought('我觉得应该先找单位1。', { source: 'test' });
assert.strictEqual(supplemented.id, stuck.id, 'non-stuck supplement does not replace active stuck focus');
assert.strictEqual(supplemented.issueType, '步骤断点', 'active issue type is preserved after supplement');
assert.ok((supplemented.thoughtHistory || []).length >= 2, 'supplement is appended to thought history');
assert.ok((supplemented.thoughtHistory || [])[0].text.includes('单位1'), 'latest supplement is first in thought history');
assert.strictEqual(supplemented.isStuck, true, 'supplement does not downgrade the active stuck focus');

const blocked = storage.updateTodayFocusRepair({ repairStatus: 'completed' });
assert.strictEqual(blocked.repairStatus, 'in_progress', 'completion is blocked without mini action');
assert.strictEqual(blocked.blockedReason, 'mini_action_required', 'blocked completion records reason');
assert.strictEqual(storage.loadReviewCards().filter((card) => card.source === 'today_focus').length, 0, 'blocked completion does not create a review card');

const miniDone = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  hasMiniActionDone: true,
  miniActionText: '我知道第一步找什么'
});
assert.strictEqual(miniDone.hasMiniActionDone, true, 'mini action is saved');

const completed = storage.updateTodayFocusRepair({ repairStatus: 'completed' });
assert.strictEqual(completed.repairStatus, 'completed', 'completion succeeds after mini action');
assert.strictEqual(completed.progress, 100, 'completed focus reaches 100 progress');
const focusReviewCards = storage.loadReviewCards().filter((card) => card.source === 'today_focus');
assert.strictEqual(focusReviewCards.length, 1, 'completed focus creates one local review card');
assert.strictEqual(focusReviewCards[0].sourceFocusId, completed.id, 'review card links back to today focus');
assert.ok((focusReviewCards[0].front || focusReviewCards[0].question || '').includes('我知道第一步找什么'), 'review card front references the saved mini action evidence');
assert.ok((focusReviewCards[0].backPrompt || focusReviewCards[0].answer || '').includes('先用自己的话说出第一步'), 'review card back keeps a method prompt');
assert.ok(!/最终答案是|答案是|结果是/.test([focusReviewCards[0].front, focusReviewCards[0].backPrompt, focusReviewCards[0].question, focusReviewCards[0].answer].join(' ')), 'review card does not contain a final answer');
assert.ok(focusReviewCards[0].dueDate && new Date(focusReviewCards[0].dueDate).getTime() > Date.now() - 1000, 'review card has a future due date');
storage.updateTodayFocusRepair({ repairStatus: 'completed' });
assert.strictEqual(storage.loadReviewCards().filter((card) => card.source === 'today_focus' && card.sourceFocusId === completed.id).length, 1, 'completed focus does not duplicate review cards');

const dueFocusCard = Object.assign({}, focusReviewCards[0], { due: new Date(Date.now() - 1000).toISOString(), dueDate: new Date(Date.now() - 1000).toISOString() });
storage.saveReviewCards([dueFocusCard]);
assert.strictEqual(storage.loadReviewCards().filter((card) => card.source === 'today_focus' && new Date(card.due || card.dueDate || 0).getTime() <= Date.now()).length, 1, 'knowledge playground can read a due today-focus review card from local storage');

const second = storage.saveTodayFocusFromThought('这道题我又不会列式了。', { source: 'test' });
assert.notStrictEqual(second.id, completed.id, 'new stuck input after completed creates a new focus');
assert.strictEqual(second.issueType, '列式关系', 'new focus gets fresh issue type');
assert.strictEqual(second.repairStatus, 'not_started', 'new focus becomes latest pending item');
assert.strictEqual(second.hasMiniActionDone, false, 'new focus resets the mini action gate');
assert.ok(!second.completed_at, 'new pending focus does not inherit the previous completion timestamp');
assert.ok((second.thoughtHistory || []).some((item) => item.text.includes('不知道下一步')), 'completed focus history is still locally traceable');

storage.clearLearningData();
const localCases = storage.buildLocalScenarioLoopCases();
assert.ok(localCases.length >= 10, 'local scenario loop gives enough real starting cases');
assert.ok(localCases.some((item) => item.id === 'physics_circuit_path'), 'local scenario loop covers physics circuit path');
assert.ok(localCases.every((item) => item.firstStepCard && item.firstStepCard.noFinalAnswer), 'local scenario cases produce first-step cards with no-answer boundary');
const loopResult = storage.applyLocalScenarioLoopCase('physics_circuit_path');
assert.ok(loopResult && loopResult.focus && loopResult.card, 'applying a local scenario creates a focus and review card');
assert.strictEqual(loopResult.focus.repairStatus, 'completed', 'local scenario walks through the repair gate');
assert.ok(loopResult.firstStepCard && loopResult.firstStepCard.subjectKey === 'physics', 'local scenario keeps the subject-specific first-step card');
const scenarioCards = storage.loadReviewCards().filter((card) => card.sourceFocusId === loopResult.focus.id);
assert.strictEqual(scenarioCards.length, 4, 'local scenario creates one primary review card plus three spaced cadence cards');
assert(scenarioCards.some((card) => card.source === 'today_focus' && card.sourceFocusId === loopResult.focus.id), 'local scenario creates one primary linked review card');
assert(['next_day_revisit', 'day7_variant', 'two_week_stability_check'].every((marker) => scenarioCards.some((card) => card.cadenceMarker === marker)), 'local scenario creates next-day/day-7/two-week cadence cards');
const scenarioUpdatedPrimary = storage.loadReviewCards().find((card) => card.id === loopResult.card.id) || loopResult.card;
const scenarioTransferSet = scenarioUpdatedPrimary.nextPracticePlan && scenarioUpdatedPrimary.nextPracticePlan.transferPracticeSet;
assert.ok(scenarioTransferSet && scenarioTransferSet.completedPromptIds.includes('near_transfer'), 'local scenario records near-transfer practice');
assert.ok(scenarioTransferSet.completedPromptIds.includes('teach_back'), 'local scenario records teach-back practice');
assert.ok(storage.buildParentReflectionSummary().ready, 'local scenario records a parent reflection receipt');
assert.ok(storage.buildOutcomeReviewSummary().ready, 'local scenario records an outcome check');
assert.ok(storage.loadReviewEvents().some((event) => event.type === 'local_scenario_loop_applied'), 'local scenario appends a review event');
assert.ok(loopResult.flowSteps && loopResult.flowSteps.length >= 5 && loopResult.flowSteps.every((step) => step.done), 'local scenario returns a visible done-path');
assert.ok(loopResult.nextRoutes && loopResult.nextRoutes.some((route) => route.path === '/pages/review/review'), 'local scenario returns a review route');
assert.ok(loopResult.nextRoutes.some((route) => route.path === '/pages/profile/profile'), 'local scenario returns a parent recap route');
const questArc = storage.buildLearningQuestArc();
assert.ok(questArc && questArc.stages && questArc.stages.length >= 6, 'learning quest arc connects the full loop');
assert.ok(questArc.stages.some((stage) => stage.id === 'transfer' && stage.done), 'learning quest arc reflects transfer completion');
assert.ok(questArc.stages.some((stage) => stage.id === 'parent' && stage.done), 'learning quest arc reflects parent follow-up');
assert.ok(questArc.currentAction && questArc.currentActionLabel, 'learning quest arc gives a concrete next action');
const questArcGameBridge = storage.buildQuestArcGameBridge({
  dailyQuestSet: { weakKey: '电路路径', quests: [{ id: 'quest_boss_gap', progress: 0, target: 1 }] },
  adaptiveChallenge: { mode: 'repair', bossCard: { key: '电路路径' } }
});
assert.strictEqual(questArcGameBridge.noFinalAnswer, true, 'quest arc game bridge keeps the no-answer boundary');
assert.ok(questArcGameBridge.completionWrites.includes('quest_arc_game_signal'), 'quest arc game bridge declares evidence writeback');
const questArcGameSignal = storage.recordQuestArcGameSignal({
  mission: questArcGameBridge,
  result: { gameType: 'quiz', total: 3, correct: 3, accuracy: 100, passed: true }
}, { gameType: 'quiz' });
assert.ok(questArcGameSignal && questArcGameSignal.noFinalAnswer, 'arcade quest signal records the no-answer boundary');
assert.ok(storage.validationEventsByType('quest_arc_game_signal').length >= 1, 'arcade writes quest arc game evidence into validation events');

console.log('All today focus behavior tests pass.');
