#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const {
  SOURCE_REGISTRY,
  REAL_HOMEWORK_PRESSURE_SAMPLES,
  NEGATIVE_HOMEWORK_PRESSURE_SAMPLES,
  LONGITUDINAL_HOMEWORK_PRESSURE_SCENARIOS
} = require('./fixtures/real-homework-pressure-samples.cjs');

function loadCommonJsMiniappModule(relativePath, sandboxPatch = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const code = fs.readFileSync(file, 'utf8');
  const localRequire = (request) => {
    if (request.startsWith('.')) return require(path.resolve(path.dirname(file), request));
    return require(request);
  };
  const sandbox = Object.assign({
    module: { exports: {} },
    exports: {},
    require: localRequire,
    __filename: file,
    __dirname: path.dirname(file),
    console,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Array,
    Object,
    JSON
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
const realHomeworkCoverage = loadCommonJsMiniappModule('miniprogram/utils/real-homework-coverage.js');
const storage = loadCommonJsMiniappModule('miniprogram/utils/storage.js', {
  wx: global.wx,
  require(request) {
    if (request === './learning-priority') return {};
    if (request === './real-homework-coverage') return realHomeworkCoverage;
    return require(request);
  }
});
const learningReport = loadCommonJsMiniappModule('miniprogram/utils/learning-report.js');
const gameLogic = loadCommonJsMiniappModule('miniprogram/utils/game-logic.js');

assert.equal(typeof storage.normalizeTaskType, 'function', 'storage exposes centralized task type normalization');
[
  ['reading_inference', 'reading_question', '语文'],
  ['argument_reading', 'reading_question', '语文'],
  ['english_grammar', 'english_sentence', 'english'],
  ['dictation_sentence', 'english_sentence', 'english'],
  ['biology_concept', 'biology_process', 'biology'],
  ['biology_ecology_chain', 'biology_process', 'biology'],
  ['geography_spatial', 'geography_map', 'geography'],
  ['geography_region_analysis', 'geography_map', 'geography'],
  ['physics_graph', 'physics_diagram', 'physics'],
  ['physics_energy', 'physics_diagram', 'physics'],
  ['chemistry_equation', 'chemistry_experiment', 'chemistry'],
  ['chemistry_reaction', 'chemistry_experiment', 'chemistry'],
  ['data_table_reasoning', 'math_word_problem', 'math']
].forEach(([alias, expected, subject]) => {
  assert.equal(storage.normalizeTaskType(alias, subject), expected, `${alias} normalizes to ${expected}`);
  const depth = storage.buildSubjectSkillDepth({
    taskType: alias,
    subject,
    sourceText: `${subject} public K12 alias routing`
  });
  assert.equal(depth.taskType, expected, `${alias} subject depth keeps normalized task type`);
  assert.notEqual(depth.taskType, 'unknown', `${alias} never falls into unknown task depth`);
  assert.notEqual(depth.route, '/pages/tutor/tutor', `${alias} routes to executable repair loop instead of generic tutor fallback`);
  assert(depth.label && depth.evidenceRequired && depth.evidenceRequired.length, `${alias} keeps subject-depth label and evidence contract`);
});

const firstFixtureSample = REAL_HOMEWORK_PRESSURE_SAMPLES[0];
const subjectOnlyPressureSamples = realHomeworkCoverage.getRealHomeworkPressureSamples({
  subject: firstFixtureSample.subject
});
assert(subjectOnlyPressureSamples.length > 0, 'subject-only pressure sample lookup returns matching samples');
assert(subjectOnlyPressureSamples.every((sample) => sample.subject === firstFixtureSample.subject), 'subject-only pressure sample lookup no longer returns unrelated subjects');
const taskTypeOnlyPressureSamples = realHomeworkCoverage.getRealHomeworkPressureSamples({
  taskType: firstFixtureSample.taskType
});
assert(taskTypeOnlyPressureSamples.length > 0, 'task-type-only pressure sample lookup returns matching samples');
assert(taskTypeOnlyPressureSamples.every((sample) => sample.taskType === firstFixtureSample.taskType), 'task-type-only pressure sample lookup no longer returns unrelated task types');
const aliasPressureSamples = realHomeworkCoverage.getRealHomeworkPressureSamples({
  taskType: 'english_grammar'
});
assert(aliasPressureSamples.length > 0, 'task-type alias lookup returns normalized pressure samples');
assert(aliasPressureSamples.every((sample) => storage.normalizeTaskType(sample.taskType) === 'english_sentence'), 'task-type alias lookup does not fall through to unrelated samples');
const strictPressureSamples = realHomeworkCoverage.getRealHomeworkPressureSamples({
  subject: firstFixtureSample.subject,
  taskType: firstFixtureSample.taskType
});
assert(strictPressureSamples.every((sample) => sample.subject === firstFixtureSample.subject && sample.taskType === firstFixtureSample.taskType), 'subject + taskType lookup uses an AND match');
const coverageMatrix = realHomeworkCoverage.buildRealHomeworkCoverageMatrix();
assert.strictEqual(coverageMatrix.fixtureLoaded, true, 'coverage matrix proves the fixture was loaded before claiming runtime coverage');
assert.strictEqual(coverageMatrix.sampleSourceStatus, 'fixture_loaded', 'coverage matrix exposes runtime sample source status');
assert.strictEqual(coverageMatrix.loadedSampleCount, REAL_HOMEWORK_PRESSURE_SAMPLES.length, 'coverage matrix reports loaded fixture sample count');
assert.strictEqual(coverageMatrix.coverageConfidence, 'fixture_verified', 'coverage matrix does not confuse fallback static counts with verified fixture coverage');
assert(Array.isArray(coverageMatrix.contentExpansionQueue) && coverageMatrix.contentExpansionQueue.length >= 7, 'coverage matrix exposes a subject-level content expansion queue');
assert.strictEqual(coverageMatrix.totalContentExpansionQueue, coverageMatrix.contentExpansionQueue.length, 'coverage matrix reports content expansion queue size');
coverageMatrix.contentExpansionQueue.forEach((item) => {
  assert(item.localCodeOwns.includes('visual_primitive_contract') && item.localCodeOwns.includes('share_privacy_fields'), 'content expansion keeps product gates in local code');
  assert(item.aiBetterFor.includes('one_sentence_teacher_explanation') && item.aiBetterFor.includes('near_transfer_wording'), 'content expansion uses AI for wording depth only');
  assert(item.mustNotUseAiFor.includes('release_decision') && item.mustNotUseAiFor.includes('talent_label'), 'content expansion blocks AI from release and talent decisions');
  assert(item.releaseGate.includes('first_step') && item.releaseGate.includes('blocked_fields'), 'content expansion requires first-step and blocked-field evidence');
});
const moatWorkbench = storage.buildCompetitiveMoatWorkbench({ realHomeworkCoverageMatrix: coverageMatrix });
assert.strictEqual(moatWorkbench.status, 'local_moat_building', 'competitive moat workbench only opens after scale and verified sample quality both pass');
assert.strictEqual(moatWorkbench.qualityGateReady, true, 'competitive moat workbench exposes a passing quality gate');
assert.strictEqual(moatWorkbench.qualityGate.sampleSourceStatus, 'fixture_loaded', 'quality gate records fixture-backed sample source');
const fakeScaleWithoutFixture = storage.buildCompetitiveMoatWorkbench({
  realHomeworkCoverageMatrix: Object.assign({}, coverageMatrix, {
    fixtureLoaded: false,
    sampleSourceStatus: 'fallback_static',
    coverageConfidence: 'count_only'
  })
});
assert.strictEqual(fakeScaleWithoutFixture.status, 'needs_more_content_evidence', 'content scale alone cannot claim moat readiness without verified fixture samples');
assert.strictEqual(fakeScaleWithoutFixture.qualityGateReady, false, 'quality gate blocks fallback static counts');
const fakeScaleWithAuditRisk = storage.buildCompetitiveMoatWorkbench({
  realHomeworkCoverageMatrix: coverageMatrix,
  reportPressureTruthAudit: {
    pseudoThicknessRiskCount: 1,
    threeRoundSocraticRiskCount: 0,
    crossModuleConsistencyRiskCount: 0,
    sourceDecision: []
  }
});
assert.strictEqual(fakeScaleWithAuditRisk.status, 'needs_more_content_evidence', 'report pressure risks block moat readiness even when content counts pass');
assert.strictEqual(fakeScaleWithAuditRisk.qualityGate.pseudoThicknessRiskCount, 1, 'quality gate surfaces pseudo-thickness risk count');

storage.appendRealTrialSample({
  id: 'trial_math_ratio_dropoff',
  subject: '数学',
  taskType: 'math_word_problem',
  childTask: '孩子把折扣后的价格和折扣率混在一起，卡在第一步。',
  firstStep: '先圈出原价、折扣率和要求的量，不急着算。',
  wrongCause: '把比例关系当成具体金额。',
  boardUse: '小黑板只画原价到现价的一条比例箭头。',
  parentCheck: '家长问：你现在找的是比例还是金额？',
  revisitPlan: '明天换一个百分数场景复查。',
  neededHelp: true,
  confusedStep: '不知道先找单位一还是直接乘。',
  privacyConcern: false
});
const realTrialRecoveryLoop = storage.buildRealTrialRecoveryLoop();
assert.strictEqual(realTrialRecoveryLoop.id, 'real_trial_recovery_loop', 'real trial recovery loop exposes a stable id');
assert(realTrialRecoveryLoop.shouldPromoteCount >= 1, 'confusing real trial sample becomes a pressure-sample seed');
assert(realTrialRecoveryLoop.reviewCardCount >= 1, 'real trial recovery creates a revisit card instead of stopping at report analytics');
assert(storage.loadReviewCards().some((card) => card.type === 'real_trial_revisit' && card.sourceTrialId === 'trial_math_ratio_dropoff' && card.nextPracticePlan && card.nextPracticePlan.appRoute === '/pages/review/review'), 'real trial sample lands in review queue with next-practice plan');
assert(realTrialRecoveryLoop.nextPressureQueue[0].blockedFields.includes('full_answer'), 'real trial recovery blocks full answers from pressure/share payloads');
assert.strictEqual(realTrialRecoveryLoop.nextPressureQueue[0].aiUse, 'AI 只改写追问语气，不决定分类、放行和分享字段。', 'real trial recovery keeps AI out of release decisions');
assert(realTrialRecoveryLoop.localRuleLine.includes('本地代码负责样本清洗'), 'real trial recovery assigns sample recovery decisions to local code');
const realTrialPressureCandidateBoard = storage.buildRealTrialPressureCandidateBoard();
assert.strictEqual(realTrialPressureCandidateBoard.id, 'real_trial_pressure_candidate_board', 'real trial pressure candidates expose a stable board id');
assert(realTrialPressureCandidateBoard.ready, 'real trial failures become pressure candidate cards');
assert.strictEqual(realTrialPressureCandidateBoard.firstCandidate.sourceTrialId, 'trial_math_ratio_dropoff', 'pressure candidate keeps source trial identity');
assert(realTrialPressureCandidateBoard.firstCandidate.tutorRoute.includes('real_trial_pressure_candidate'), 'pressure candidate routes back into Socratic tutor');
assert(realTrialPressureCandidateBoard.firstCandidate.reviewRoute.includes('real_trial_pressure_candidate'), 'pressure candidate routes into review');
assert(realTrialPressureCandidateBoard.firstCandidate.arcadeRoute.includes('real_trial_pressure_candidate'), 'pressure candidate routes into arcade');
assert(realTrialPressureCandidateBoard.firstCandidate.blockedFields.includes('original_question') && realTrialPressureCandidateBoard.firstCandidate.blockedFields.includes('full_dialogue'), 'pressure candidate blocks original question and full dialogue');
assert(realTrialPressureCandidateBoard.aiUseLine.includes('AI') && realTrialPressureCandidateBoard.aiUseLine.includes('本地代码控制'), 'pressure candidate keeps AI to wording and local code to gates');
assert(realTrialRecoveryLoop.pressureCandidateBoard && realTrialRecoveryLoop.pressureCandidateBoard.ready, 'real trial recovery exposes pressure candidate board');
assert(realTrialRecoveryLoop.pressureCandidateCards[0].allowedFields.includes('first_step'), 'pressure candidate only releases first-step evidence fields');
const realTrialSocraticStressAudit = storage.buildRealTrialSocraticStressAudit({
  candidateBoard: realTrialPressureCandidateBoard
});
assert.strictEqual(realTrialSocraticStressAudit.id, 'real_trial_socratic_stress_audit', 'real trial Socratic stress audit exposes a stable id');
assert(realTrialSocraticStressAudit.ready && realTrialSocraticStressAudit.rows.length >= 1, 'real trial pressure candidates enter Socratic stress audit');
assert.strictEqual(realTrialSocraticStressAudit.rows[0].sourceTrialId, 'trial_math_ratio_dropoff', 'Socratic stress audit preserves source trial identity');
assert(realTrialSocraticStressAudit.rows[0].socraticProbe && realTrialSocraticStressAudit.rows[0].reportProbe && realTrialSocraticStressAudit.rows[0].revisitProbe, 'Socratic stress audit checks tutor, report, and revisit probes');
assert(realTrialSocraticStressAudit.rows[0].blockedFields.includes('original_question') && realTrialSocraticStressAudit.rows[0].blockedFields.includes('full_answer'), 'Socratic stress audit blocks original questions and answers');
assert(realTrialSocraticStressAudit.releaseGate.includes('不能进入长期画像'), 'Socratic stress audit blocks weak candidates from long-term portraits and sharing');
assert(realTrialRecoveryLoop.socraticStressAudit && realTrialRecoveryLoop.socraticStressRows[0].sourceTrialId === 'trial_math_ratio_dropoff', 'real trial recovery exposes Socratic stress audit rows');
const syntheticStressRepairQueue = storage.buildRealTrialStressRepairQueue({
  audit: {
    rows: [{
      id: 'synthetic_thin_stress',
      sourceTrialId: 'trial_math_ratio_dropoff',
      subject: '数学',
      taskType: 'math_word_problem',
      order: 1,
      risks: ['first_step_generic', 'blackboard_not_actionable', 'revisit_missing'],
      tutorRoute: '/pages/tutor/tutor?from=real_trial_pressure_candidate&trial_id=trial_math_ratio_dropoff',
      reviewRoute: '/pages/review/review?from=real_trial_pressure_candidate&trial_id=trial_math_ratio_dropoff',
      arcadeRoute: '/pages/arcade/arcade?from=real_trial_pressure_candidate&trial_id=trial_math_ratio_dropoff',
      blackboardProbe: '待补小黑板',
      revisitProbe: '待补回访'
    }]
  }
});
assert.strictEqual(syntheticStressRepairQueue.id, 'real_trial_stress_repair_queue', 'stress repair queue exposes a stable id');
assert.strictEqual(syntheticStressRepairQueue.repairCount, 3, 'stress repair queue turns every thin audit risk into a repair action');
assert(syntheticStressRepairQueue.firstRepair.tutorRoute.includes('repair=first_step_generic'), 'stress repair queue routes first-step repair back to tutor');
assert(syntheticStressRepairQueue.firstRepair.blockedFields.includes('original_question') && syntheticStressRepairQueue.firstRepair.blockedFields.includes('full_dialogue'), 'stress repair queue blocks original question and full dialogue');
assert(syntheticStressRepairQueue.releaseGate.includes('不进入长期画像'), 'stress repair queue blocks unrepaired items from long-term portrait release');
assert(realTrialRecoveryLoop.stressRepairQueue && realTrialRecoveryLoop.stressRepairCards.length >= 1, 'real trial recovery exposes stress repair cards');
const syntheticRuleWritebackPlan = storage.buildRealTrialRuleWritebackPlan({
  repairQueue: syntheticStressRepairQueue
});
assert.strictEqual(syntheticRuleWritebackPlan.id, 'real_trial_rule_writeback_plan', 'rule writeback plan exposes a stable id');
assert(syntheticRuleWritebackPlan.patches.some((item) => item.localTarget.includes('firstStepTemplatesForTaskType')), 'rule writeback maps first-step repairs to local first-step rules');
assert(syntheticRuleWritebackPlan.patches.some((item) => item.localTarget.includes('buildBlackboardHint')), 'rule writeback maps blackboard repairs to local blackboard rules');
assert(syntheticRuleWritebackPlan.patches.some((item) => item.localTarget.includes('generateReviewCard')), 'rule writeback maps revisit repairs to local review rules');
assert(syntheticRuleWritebackPlan.firstPatch.blockedFields.includes('full_answer') && syntheticRuleWritebackPlan.firstPatch.aiOwner === 'ai_wording_only', 'rule writeback keeps answers blocked and AI limited to wording');
assert(syntheticRuleWritebackPlan.releaseGate.includes('未完成回写与复测前'), 'rule writeback blocks release before retest');
assert(realTrialRecoveryLoop.ruleWritebackPlan && realTrialRecoveryLoop.ruleWritebackPatches.length >= 1, 'real trial recovery exposes rule writeback patches');
const syntheticRuleRetestDeck = storage.buildRealTrialRuleRetestDeck({
  writebackPlan: syntheticRuleWritebackPlan
});
assert.strictEqual(syntheticRuleRetestDeck.id, 'real_trial_rule_retest_deck', 'rule retest deck exposes a stable id');
assert(syntheticRuleRetestDeck.firstCard.cadence.some((item) => item.id === 'day7'), 'rule retest deck includes day-7 spaced review cadence');
assert.strictEqual(syntheticRuleRetestDeck.firstCard.gameMode, 'active_recall_no_rank', 'rule retest deck uses active recall without ranking');
assert(syntheticRuleRetestDeck.firstCard.xpRule.includes('不奖励速度') && syntheticRuleRetestDeck.firstCard.blockedFields.includes('ranking'), 'rule retest deck blocks score/ranking growth hooks');
assert(syntheticRuleRetestDeck.khanmigoLine.includes('长期画像必须等三段复测证据齐'), 'rule retest deck delays long-term portrait claims until evidence is ready');
assert(realTrialRecoveryLoop.ruleRetestDeck && realTrialRecoveryLoop.ruleRetestCards.length >= 1, 'real trial recovery exposes rule retest cards');
const syntheticRuleRetestReviewBridge = storage.ensureRealTrialRuleRetestReviewCards({
  retestDeck: syntheticRuleRetestDeck
});
assert.strictEqual(syntheticRuleRetestReviewBridge.id, 'real_trial_rule_retest_review_bridge', 'rule retest review bridge exposes a stable id');
assert(syntheticRuleRetestReviewBridge.ready && syntheticRuleRetestReviewBridge.reviewCards.length >= 1, 'rule retest deck becomes executable review cards');
assert(syntheticRuleRetestReviewBridge.firstReviewCard.type === 'real_trial_rule_retest', 'rule retest review card has a dedicated type');
assert(syntheticRuleRetestReviewBridge.firstReviewCard.sourceRetestId, 'rule retest review card preserves source retest identity');
assert(syntheticRuleRetestReviewBridge.firstReviewCard.nextPracticePlan.appRoute.includes('/pages/review/review'), 'rule retest review card routes into review');
assert(syntheticRuleRetestReviewBridge.firstReviewCard.nextPracticePlan.arcadeRoute.includes('/pages/arcade/arcade'), 'rule retest review card routes into arcade');
assert(syntheticRuleRetestReviewBridge.firstReviewCard.blockedFields.includes('full_answer') && syntheticRuleRetestReviewBridge.firstReviewCard.blockedFields.includes('ranking'), 'rule retest review cards block answers and ranking hooks');
const duplicateRuleRetestReviewBridge = storage.ensureRealTrialRuleRetestReviewCards({
  retestDeck: syntheticRuleRetestDeck
});
assert.strictEqual(duplicateRuleRetestReviewBridge.createdCount, 0, 'rule retest review bridge is idempotent and does not duplicate cards');
const refreshedRealTrialRecoveryLoop = storage.buildRealTrialRecoveryLoop();
assert(refreshedRealTrialRecoveryLoop.ruleRetestReviewBridge && refreshedRealTrialRecoveryLoop.ruleRetestReviewBridge.ready, 'real trial recovery exposes executable retest review bridge');
assert(refreshedRealTrialRecoveryLoop.ruleRetestReviewCards[0].type === 'real_trial_rule_retest', 'real trial recovery exposes rule retest review cards');

const realTrialGameChallengeBridge = storage.buildRealTrialGameChallengeBridge();
assert(realTrialGameChallengeBridge.ready, 'real trial review cards become playable challenge bridge cards');
assert(realTrialRecoveryLoop.gameChallengeBridge && realTrialRecoveryLoop.gameChallengeBridge.ready, 'real trial recovery exposes the playable challenge bridge');
assert.strictEqual(realTrialGameChallengeBridge.firstChallenge.sourceTrialId, 'trial_math_ratio_dropoff', 'real trial challenge preserves source trial identity');
assert(realTrialGameChallengeBridge.firstChallenge.route.includes('from=real_trial_revisit'), 'real trial challenge routes into arcade with revisit context');
assert(realTrialGameChallengeBridge.firstChallenge.blockedFields.includes('full_answer') && realTrialGameChallengeBridge.firstChallenge.blockedFields.includes('ranking'), 'real trial challenge blocks answers and ranking hooks');
const realTrialSharePlan = storage.buildShareChallengePlan();
assert(realTrialSharePlan.realTrialGameChallengeBridge && realTrialSharePlan.realTrialGameChallengeBridge.ready, 'share plan includes real trial game challenge bridge');
assert(realTrialSharePlan.query.real_trial_challenge && realTrialSharePlan.query.real_trial_route.includes('real_trial_revisit'), 'share query carries real trial challenge route without copying homework');
assert(realTrialSharePlan.realTrialPressureCandidateBoard && realTrialSharePlan.realTrialPressureCandidateBoard.ready, 'share plan includes real trial pressure candidate board');
assert(realTrialSharePlan.query.real_trial_pressure_candidate && realTrialSharePlan.query.real_trial_pressure_route.includes('real_trial_pressure_candidate'), 'share query carries pressure candidate recovery route without copying homework');
const realTrialCommunityBoard = storage.buildCommunityShareRelayBoard({ shareChallengePlan: realTrialSharePlan });
assert(realTrialCommunityBoard.realTrialGameChallengeBridge && realTrialCommunityBoard.realTrialGameChallengeBridge.ready, 'community relay board includes real trial challenge bridge');
assert(realTrialCommunityBoard.realTrialGameChallengeCards[0].blockedFields.includes('original_question'), 'community relay keeps original question blocked for real trial challenges');
assert(realTrialCommunityBoard.realTrialPressureCandidateBoard && realTrialCommunityBoard.realTrialPressureCandidateBoard.ready, 'community relay board includes real trial pressure candidates');
assert(realTrialCommunityBoard.realTrialPressureCandidateCards[0].blockedFields.includes('original_question'), 'community relay keeps original question blocked for pressure candidates');

const gradeChapterTeachingStrategyMap = storage.buildGradeChapterTeachingStrategyMap();
assert.strictEqual(gradeChapterTeachingStrategyMap.id, 'grade_chapter_teaching_strategy_map', 'grade/chapter teaching strategy map exposes a stable id');
assert(gradeChapterTeachingStrategyMap.subjectCount >= 7, 'grade/chapter teaching strategy map covers seven subjects');
assert(gradeChapterTeachingStrategyMap.unitCount >= 21, 'grade/chapter teaching strategy map covers the full course unit map');
assert(gradeChapterTeachingStrategyMap.strategyCount >= gradeChapterTeachingStrategyMap.unitCount * 3, 'every course unit expands into recognize/repair/transfer strategies');
assert(gradeChapterTeachingStrategyMap.strategies.every((item) => item.gradeBand && item.chapterLabel && item.taskType && item.firstStepPrompt && item.wrongCauseLabel && item.boardMove && item.parentCheckPrompt && item.nearTransferRule), 'every teaching strategy has grade, chapter, task, first step, wrong cause, board, parent check, and transfer');
assert(gradeChapterTeachingStrategyMap.strategies.every((item) => item.answerPolicy === 'first_step_only_no_full_answer' && item.releaseGate.includes('本地代码') && item.shareBoundary.includes('不带原题')), 'teaching strategies keep release gates local and answer/share safe');
assert(gradeChapterTeachingStrategyMap.localCodeOwns.includes('release_gate') && gradeChapterTeachingStrategyMap.aiOwns.includes('socratic_wording'), 'teaching strategy map separates local release decisions from AI wording');
const commercialRunway = storage.buildCommercialDepthRunway({
  gradeChapterTeachingStrategyMap
});
assert(commercialRunway.gradeChapterTeachingStrategyMap && commercialRunway.lanes.some((item) => item.id === 'grade_chapter_strategy'), 'commercial runway exposes grade/chapter strategy as a product-thickness lane');

const globalCourseUnitMap = storage.buildCourseUnitMap();
const globalQuestionBank = storage.buildCourseUnitQuestionBank({
  courseUnitMap: globalCourseUnitMap,
  realHomeworkPressureSamples: REAL_HOMEWORK_PRESSURE_SAMPLES
});
const equationBoundCourseUnitMap = storage.buildCourseUnitMap({
  subject: '数学',
  taskType: 'equation_setup',
  sourceText: '这道题卡在设未知数 x 和找等量关系，孩子不知道方程第一步怎么写。',
  expectedWrongCause: '未知量没设清',
  expectedFirstStep: '先写清谁是未知数'
});
assert.strictEqual(equationBoundCourseUnitMap.activeTaskType, 'equation_setup', 'course unit map preserves the current homework task type instead of falling back to subject only');
assert(Array.isArray(equationBoundCourseUnitMap.activeUnitIds) && equationBoundCourseUnitMap.activeUnitIds.length >= 1, 'course unit map exposes active unit ids for the current homework focus');
assert(equationBoundCourseUnitMap.active.units[0].unitLabel.includes('建模') || equationBoundCourseUnitMap.active.units[0].activeBindingScore > 0, 'equation homework binds to a scored active unit rather than the subject default');
assert(equationBoundCourseUnitMap.activeBindingLine.includes('当前作业卡点') && equationBoundCourseUnitMap.activeBindingLine.includes('题库和游戏优先'), 'active binding line explains that question bank and game are tied to the current homework');
const equationBoundQuestionBank = storage.buildCourseUnitQuestionBank({
  courseUnitMap: equationBoundCourseUnitMap,
  realHomeworkPressureSamples: REAL_HOMEWORK_PRESSURE_SAMPLES
});
assert(equationBoundQuestionBank.activeCards.length >= 1, 'current homework binding produces active question-bank cards');
assert(equationBoundQuestionBank.activeCards.every((card) => equationBoundCourseUnitMap.activeUnitIds.includes(card.unitId)), 'active question-bank cards come only from the current homework active units');
const equationPlayableCards = gameLogic.buildCourseUnitQuestionBankPlayableCards(equationBoundQuestionBank, {
  taskType: 'equation_setup',
  subject: '数学',
  firstStep: '先写清谁是未知数',
  wrongCauseLabel: '未知量没设清'
});
assert(equationPlayableCards.length >= 1, 'current homework binding produces playable question-bank cards');
assert(equationPlayableCards[0].unitId && equationBoundCourseUnitMap.activeUnitIds.includes(equationPlayableCards[0].unitId), 'first playable question-bank card stays inside active course units');
assert(equationPlayableCards[0].source === 'course_unit_question_bank' && equationPlayableCards[0].sourceUnitId, 'playable cards preserve source unit evidence for the arcade first card');
const sampleBackedCards = globalQuestionBank.cards.filter((card) => card.sourceBacked && card.sourceSampleId && card.sampleBackedEvidence);
assert.strictEqual(sampleBackedCards.length, globalQuestionBank.questionCount, 'every course-unit question-bank card is backed by a real/public pressure sample');
const reviewedPublicAssetCards = globalQuestionBank.cards.filter((card) => card.reviewedPublicAsset);
assert(reviewedPublicAssetCards.length >= 7, 'reviewed public curriculum assets enter the runtime question bank');
assert(new Set(reviewedPublicAssetCards.map((card) => card.subjectId)).size >= 7, 'reviewed public assets cover seven subjects');
assert(reviewedPublicAssetCards.every((card) => card.answerPolicy === 'first_step_only_no_full_answer' && card.sourceContentPolicy === 'no_source_text_no_source_image_no_source_answer'), 'reviewed public assets are structure-only and first-step-only');
assert(reviewedPublicAssetCards.every((card) => card.blockedFields.includes('original_question') && card.blockedFields.includes('full_solution') && card.blockedFields.includes('ranking')), 'reviewed public assets block original questions, full solutions, and ranking');
assert(reviewedPublicAssetCards.every((card) => card.sourceSampleFirstStep && card.sourceSampleWrongCause && card.sourceSampleBoardMove && card.sourceSampleParentCheck && card.sourceSampleNearTransfer), 'reviewed public assets carry first step, wrong cause, board, parent check, and near transfer');
assert(globalQuestionBank.sourceBackedSubjectCount >= 7, 'sample-backed course-unit cards cover seven subjects');
assert(globalQuestionBank.sourceBackedGradeBandCount >= 3, 'sample-backed course-unit cards cover multiple grade bands');
assert(globalQuestionBank.sourceBackedTaskTypeCount >= 7, 'sample-backed course-unit cards cover the major task types');
assert(sampleBackedCards.every((card) => card.sampleBackedEvidence.answerPolicy === 'first_step_only_no_full_answer'), 'sample-backed cards keep first-step-only answer policy');
assert(sampleBackedCards.every((card) => card.sampleBackedEvidence.blockedFields.includes('full_answer') && card.sampleBackedEvidence.blockedFields.includes('ranking')), 'sample-backed cards block answer/ranking leakage');
assert(sampleBackedCards.every((card) => card.sourceSampleFirstStep && card.sourceSampleWrongCause && card.sourceSampleBoardMove && card.sourceSampleParentCheck && card.sourceSampleNearTransfer), 'sample-backed cards expose first step, wrong cause, board move, parent check, and transfer');
assert(sampleBackedCards.every((card) => card.oerResourceId && card.derivedFrom === 'structure_only' && card.answerPolicy === 'first_step_only_no_full_answer'), 'question-bank cards inherit OER structure-only metadata and first-step answer policy');
assert(sampleBackedCards.every((card) => card.sourceRegistryId && card.sourceUrl && card.licenseSignal && card.commercialDecision && card.distributionPolicy === 'structure_index_only_no_source_content_distribution'), 'question-bank cards inherit source registry metadata and distribution policy');
assert(sampleBackedCards.every((card) => Array.isArray(card.allowedDerivedArtifacts) && card.allowedDerivedArtifacts.includes('first_step_card') && Array.isArray(card.mustNotSurface) && card.mustNotSurface.includes('source_answer')), 'question-bank cards explicitly allow only derived artifacts and block source answers');
assert(sampleBackedCards.every((card) => Array.isArray(card.blockedFields) && card.blockedFields.includes('original_question') && card.blockedFields.includes('full_answer')), 'question-bank cards block original question and full answer fields');
const sampleBlackboardBlueprint = storage.buildFirstStepBlackboardBlueprint({
  subject: '数学',
  taskType: 'relation'
});
assert.strictEqual(sampleBlackboardBlueprint.answerPolicy, 'first_step_only_no_full_answer', 'first-step blackboard exposes answer policy');
assert(Array.isArray(sampleBlackboardBlueprint.exitCriteria) && sampleBlackboardBlueprint.exitCriteria.includes('child_can_name_first_step'), 'first-step blackboard exposes exit criteria');
assert(Array.isArray(sampleBlackboardBlueprint.blockedFields) && sampleBlackboardBlueprint.blockedFields.includes('full_answer'), 'first-step blackboard blocks full answers');
const globalDepthAtlas = storage.buildCourseUnitDepthExpansionAtlas({
  courseUnitMap: globalCourseUnitMap,
  courseUnitQuestionBank: globalQuestionBank
});
assert.strictEqual(globalDepthAtlas.sourceBackedArchetypeCount, globalDepthAtlas.archetypeCount, 'depth atlas archetypes stay sample-backed instead of template-only');

const {
  PUBLIC_K12_SOURCE_LEDGER,
  PUBLIC_K12_USE_POLICY,
  PUBLIC_K12_ASSET_PIPELINE,
  PUBLIC_K12_CANDIDATE_POOL,
  PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER,
  PUBLIC_K12_USE_WORKBENCH,
  PUBLIC_K12_HOMEWORK_INTAKE_QUEUE,
  PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES,
  PUBLIC_K12_IMPLEMENTATION_PLAYBOOK,
  QUESTION_TYPE_CLUSTER_RUNWAY,
  K12_PUBLIC_IMPLEMENTATION_DECISION_MATRIX
} = realHomeworkCoverage;
const publicK12IntakeChallengeDeck = realHomeworkCoverage.buildPublicK12IntakeChallengeDeck
  ? realHomeworkCoverage.buildPublicK12IntakeChallengeDeck()
  : [];

function containsAny(text, tokens) {
  const source = String(text || '');
  return tokens.some((token) => token && source.includes(token));
}

function meaningfulChunks(text) {
  return String(text || '')
    .split(/[\uFF0C\u3002\uFF1B\u3001\uFF1A\uFF01\uFF1F,.!?;:\s"\u201C\u201D\u2018\u2019\-\/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 4);
}
function summarizeSample(sample) {
  const tutorReply = ladder.buildTutorReply(`${sample.stem} 我不会第一步，能不能直接告诉我答案？`, {
    selected: { text: sample.stem },
    currentHintLevel: 1
  });
  const socraticRun = ladder.simulateThreeRoundSocratic([
    `${sample.stem} 我不会`,
    '还是不会，下一步怎么写？',
    '能不能直接给答案'
  ], {
    selected: { text: sample.stem },
    currentHintLevel: 1
  });

  const pressureSignal = tutorReply.real_homework_pressure_signal || {};
  const courseUnitMap = storage.buildCourseUnitMap({ subject: sample.subject });
  const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank({ courseUnitMap });
  const courseUnitDepthExpansionAtlas = storage.buildCourseUnitDepthExpansionAtlas({
    courseUnitMap,
    courseUnitQuestionBank
  });
  const pressureCards = [
    {
      id: `${sample.id}_wrong_cause_card`,
      question: sample.stem,
      front: sample.stem,
      weakPoint: sample.expectedWrongCause,
      wrongCauseLabel: sample.expectedWrongCause,
      checkpoint: pressureSignal.firstStep || sample.expectedFirstStep,
      nextAction: pressureSignal.parentCheck || sample.parentCheck,
      next_practice: pressureSignal.reviewMove || sample.nearTransfer,
      next_review: '2026-05-18T20:00:00.000Z'
    },
    {
      id: `${sample.id}_transfer_card`,
      question: sample.nearTransfer,
      front: sample.nearTransfer,
      weakPoint: sample.expectedWrongCause,
      wrongCauseLabel: sample.expectedWrongCause,
      checkpoint: pressureSignal.firstStep || sample.expectedFirstStep,
      nextAction: sample.parentCheck,
      next_practice: sample.nearTransfer,
      next_review: '2026-05-19T20:00:00.000Z'
    }
  ];
  const highFrequencyLoop = gameLogic.buildHighFrequencyPracticeLoop(
    { xp: 30, streak: 1 },
    pressureCards,
    [
      { type: 'wrong_cause_resurface', key: sample.expectedWrongCause, created_at: '2026-05-18T20:00:00.000Z' },
      { type: 'revisit_failed', key: sample.expectedWrongCause, created_at: '2026-05-18T20:05:00.000Z' }
    ],
    { correct: 1, wrong: 2, accuracy: 34 },
    { targetAccuracy: 80, taskType: sample.taskType },
    { weakKey: sample.expectedWrongCause },
    {
      now: new Date('2026-05-18T20:10:00.000Z'),
      taskType: sample.taskType,
      subject: sample.subject,
      activeSampleId: sample.id,
      activeSample: sample,
      realHomeworkPressureSamples: REAL_HOMEWORK_PRESSURE_SAMPLES,
      courseUnitQuestionBank,
      socraticQualityEvaluationSuite: tutorReply.socratic_quality_evaluation_suite || {}
    }
  );
  const shareChallengePlan = storage.buildShareChallengePlan({
    focus: {
      title: sample.expectedWrongCause,
      issueType: sample.taskType,
      childArticulatedStep: sample.expectedFirstStep,
      repairStatus: 'in_progress'
    },
    capability: {
      id: `${sample.id}_capability_gap`,
      label: sample.expectedWrongCause,
      nextAction: sample.parentCheck,
      route: '/pages/review/review'
    },
    subjectSkillDepth: {
      label: `${sample.subject} ${sample.gradeBand}`,
      firstStep: sample.expectedFirstStep,
      parentQuestion: sample.parentCheck,
      reportSignal: sample.expectedWrongCause
    },
    parentNextAction: 'wrong_cause_revisit',
    actionLabel: sample.parentCheck,
    route: '/pages/arcade/arcade'
  });
  const report = learningReport.buildLearningReportDraft({
    profileBasics: { grade: sample.gradeBand, schoolType: '家庭作业压测' },
    scoreText: `${sample.subject}: ${sample.stem}`,
    behaviorSignals: {
      homeworkDelay: sample.expectedWrongCause,
      firstStep: sample.expectedFirstStep
    },
    gameEvidence: highFrequencyLoop ? { highFrequencyPracticeLoop: highFrequencyLoop } : {}
  });

  const replyText = [
    tutorReply.reply,
    tutorReply.first_prompt,
    tutorReply.next_action,
    pressureSignal.firstStep,
    pressureSignal.wrongCause,
    pressureSignal.boardMove,
    pressureSignal.parentCheck,
    pressureSignal.reviewMove,
    tutorReply.diagnostic_probe && tutorReply.diagnostic_probe.focus,
    tutorReply.question_type_socratic_path && tutorReply.question_type_socratic_path.pathLine,
    tutorReply.question_bank_visual_board_bridge && tutorReply.question_bank_visual_board_bridge.title
  ].filter(Boolean).join('\n');
  const reportText = JSON.stringify(report.reportDraft || {});
  const gameText = JSON.stringify(highFrequencyLoop || {});
  const pressureMemoryPrescription = highFrequencyLoop.realHomeworkPressureMemoryPrescription || {};
  const pressureMemoryText = JSON.stringify(pressureMemoryPrescription);
  const shareText = JSON.stringify(shareChallengePlan || {});
  const shareCoreText = JSON.stringify({
    wrongCauseViralChallengePack: shareChallengePlan.wrongCauseViralChallengePack,
    wrongCauseReplayPayload: shareChallengePlan.wrongCauseReplayPayload,
    parentDecisionPayload: shareChallengePlan.parentDecisionPayload,
    query: shareChallengePlan.query
  });
  const activeArchetypeText = JSON.stringify((courseUnitDepthExpansionAtlas.activeArchetypes || []).slice(0, 3));

  const findings = {
    sourceLinked: !!SOURCE_REGISTRY.find((item) => item.id === sample.sourceId),
    taskTypeMatched: tutorReply.task_type === sample.taskType,
    blocksDirectAnswer: tutorReply.mastery_signal && tutorReply.mastery_signal.status === 'blocked_answer_request',
    noFinalAnswerLeak: !/答案是|最终答案|结果是|直接算出|therefore the answer/i.test(replyText),
    visualBoundaryPresent: containsAny(replyText + activeArchetypeText, ['小黑板', '第一笔', '只画', '不做拍题完整解答', '不直接讲完整答案']),
    firstStepSpecific: containsAny(pressureSignal.firstStep, meaningfulChunks(sample.expectedFirstStep)),
    wrongCauseSpecific: containsAny(pressureSignal.wrongCause, meaningfulChunks(sample.expectedWrongCause)),
    boardMoveSpecific: containsAny(pressureSignal.boardMove, meaningfulChunks(sample.expectedBoardMove)),
    parentCheckSpecific: containsAny(pressureSignal.parentCheck, meaningfulChunks(sample.parentCheck)),
    transferSpecific: containsAny(pressureSignal.reviewMove, meaningfulChunks(sample.nearTransfer)),
    parentDecisionPresent: containsAny(reportText, ['家长', '今晚', '明天', '只问', '证据']),
    reviewLoopPresent: containsAny(reportText + activeArchetypeText, ['回访', '迁移', '隔天', '主动回忆', '复习']),
    safeShareBoundary: containsAny(reportText + activeArchetypeText + shareText + gameText, ['原题', '完整对话', '分数', '排名', '隐私']),
    memoryWrongCauseSpecific: containsAny(gameText, meaningfulChunks(sample.expectedWrongCause)),
    memoryRevisitSpecific: containsAny(gameText, ['明天', '第 7 天', '间隔', '回访']),
    memoryVariantSpecific: containsAny(gameText, meaningfulChunks(sample.nearTransfer).concat(['变式', '迁移'])),
    reportPortraitSpecific: containsAny(reportText, ['长期画像', '证据', '今晚决策', '家长', '回访']),
    reportCrossWeekSpecific: reportText.includes('cross_week_trend_board') && containsAny(reportText, meaningfulChunks(sample.expectedWrongCause).concat([sample.subject])),
    homeSchoolDigestSpecific: reportText.includes('home_school_collaboration_digest') && containsAny(reportText, meaningfulChunks(sample.expectedWrongCause).concat([sample.subject])),
    reportEvidenceReleaseSafe: reportText.includes('report_evidence_release_gate')
      && reportText.includes('singleSampleLock')
      && reportText.includes('twoWeekStabilityGate')
      && reportText.includes('homeSchoolSafeHandoff')
      && containsAny(reportText, ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', '本地代码决定']),
    shareRelaySpecific: containsAny(shareText, meaningfulChunks(sample.parentCheck).concat(['接收动作', '不排行', '安全接力'])),
    pressurePrescriptionReady: pressureMemoryPrescription.localDeterministic
      && pressureMemoryPrescription.totalSamples === REAL_HOMEWORK_PRESSURE_SAMPLES.length
      && pressureMemoryPrescription.sampleSpecificReady
      && Array.isArray(pressureMemoryPrescription.reviewQueue)
      && pressureMemoryPrescription.reviewQueue.length >= 4
      && pressureMemoryPrescription.dailyDose
      && pressureMemoryPrescription.dailyDose.newSamples === 0
      && pressureMemoryPrescription.reviewQueue[0]
      && pressureMemoryPrescription.reviewQueue[0].sampleId === sample.id
      && pressureMemoryPrescription.reviewQueue[0].firstStep === sample.expectedFirstStep
      && pressureMemoryPrescription.reviewQueue[0].wrongCause === sample.expectedWrongCause
      && pressureMemoryPrescription.sharePayload
      && pressureMemoryPrescription.sharePayload.blockedFields.includes('full_answer')
      && pressureMemoryPrescription.sharePayload.blockedFields.includes('ranking')
  };

  const weakSignals = [];
  if (!findings.taskTypeMatched) weakSignals.push(`taskType expected ${sample.taskType}, got ${tutorReply.task_type}`);
  if (!findings.firstStepSpecific) weakSignals.push('first step is not sample-specific');
  if (!findings.wrongCauseSpecific) weakSignals.push('wrong cause is not sample-specific');
  if (!findings.boardMoveSpecific) weakSignals.push('board move is not sample-specific');
  if (!findings.parentCheckSpecific) weakSignals.push('parent check is not sample-specific');
  if (!findings.transferSpecific) weakSignals.push('transfer is not sample-specific');
  if (!findings.visualBoundaryPresent) weakSignals.push('visual boundary missing');
  if (!findings.parentDecisionPresent) weakSignals.push('parent decision missing');
  if (!findings.reviewLoopPresent) weakSignals.push('review loop missing');
  if (!findings.safeShareBoundary) weakSignals.push('safe share boundary missing');
  if (!findings.memoryWrongCauseSpecific) weakSignals.push('memory wrong-cause missing');
  if (!findings.memoryRevisitSpecific) weakSignals.push('memory revisit missing');
  if (!findings.memoryVariantSpecific) weakSignals.push('memory variant missing');
  if (!findings.reportCrossWeekSpecific) weakSignals.push('cross-week report missing');
  if (!findings.homeSchoolDigestSpecific) weakSignals.push('home-school digest missing');
  if (!findings.shareRelaySpecific) weakSignals.push('share relay missing');
  if (!findings.pressurePrescriptionReady) weakSignals.push('real-homework memory prescription missing');
  const threeRoundProtocol = tutorReply.three_round_socratic_protocol || {};
  const threeRoundRounds = Array.isArray(threeRoundProtocol.rounds) ? threeRoundProtocol.rounds : [];
  const threeRoundText = JSON.stringify(threeRoundProtocol);
  const threeRoundFindings = {
    roundCount: threeRoundRounds.length === 3,
    round1Specific: containsAny(threeRoundRounds[0] && threeRoundRounds[0].coachMove, meaningfulChunks(sample.expectedFirstStep))
      && containsAny(threeRoundRounds[0] && threeRoundRounds[0].blackboardMove, meaningfulChunks(sample.expectedBoardMove)),
    round2WrongCauseSpecific: containsAny(threeRoundRounds[1] && threeRoundRounds[1].coachMove, meaningfulChunks(sample.expectedWrongCause))
      && containsAny(threeRoundRounds[1] && threeRoundRounds[1].blackboardMove, meaningfulChunks(sample.expectedWrongCause)),
    round3ParentSpecific: containsAny(threeRoundRounds[2] && threeRoundRounds[2].coachMove, meaningfulChunks(sample.parentCheck))
      && containsAny(threeRoundRounds[2] && threeRoundRounds[2].blackboardMove, meaningfulChunks(sample.nearTransfer)),
    blocksAnswer: containsAny(threeRoundText, ['拒绝捷径', '不展示完整答案', '不传对话全文']),
    noFinalAnswerLeak: !/答案是|最终答案|直接算出|therefore the answer/i.test(threeRoundText)
  };
  if (!threeRoundFindings.roundCount) weakSignals.push('three-round protocol missing');
  if (!threeRoundFindings.round1Specific) weakSignals.push('round 1 is not sample-specific');
  if (!threeRoundFindings.round2WrongCauseSpecific) weakSignals.push('round 2 wrong-cause micro-choice is not sample-specific');
  if (!threeRoundFindings.round3ParentSpecific) weakSignals.push('round 3 handoff is not sample-specific');
  if (!threeRoundFindings.blocksAnswer || !threeRoundFindings.noFinalAnswerLeak) weakSignals.push('three-round protocol leaks answer boundary');

  const consistencyFindings = {
    sameTaskAcrossTutorAndGame: tutorReply.task_type === sample.taskType
      && highFrequencyLoop
      && highFrequencyLoop.realHomeworkPressureMemoryPrescription
      && highFrequencyLoop.realHomeworkPressureMemoryPrescription.reviewQueue
      && highFrequencyLoop.realHomeworkPressureMemoryPrescription.reviewQueue[0]
      && highFrequencyLoop.realHomeworkPressureMemoryPrescription.reviewQueue[0].sampleId === sample.id,
    sameWrongCauseAcrossTutorGameReportShare: containsAny(pressureSignal.wrongCause, meaningfulChunks(sample.expectedWrongCause))
      && containsAny(gameText, meaningfulChunks(sample.expectedWrongCause))
      && containsAny(reportText, meaningfulChunks(sample.expectedWrongCause))
      && containsAny(shareCoreText, meaningfulChunks(sample.expectedWrongCause)),
    sameFirstStepAcrossTutorGameShare: containsAny(pressureSignal.firstStep, meaningfulChunks(sample.expectedFirstStep))
      && containsAny(gameText, meaningfulChunks(sample.expectedFirstStep))
      && containsAny(shareCoreText, meaningfulChunks(sample.expectedFirstStep)),
    parentCheckCarriesToShareAndReport: containsAny(pressureSignal.parentCheck, meaningfulChunks(sample.parentCheck))
      && containsAny(shareCoreText, meaningfulChunks(sample.parentCheck))
      && containsAny(reportText, ['家长', '只问', '证据', '今晚']),
    noGenericReportForSpecificSample: containsAny(reportText, meaningfulChunks(sample.expectedWrongCause).concat([sample.subject, sample.gradeBand]))
      && !/泛化判断|无法定位|样本不足|默认建议/.test(reportText),
    noGenericShareForSpecificSample: containsAny(shareCoreText, meaningfulChunks(sample.expectedWrongCause).concat(meaningfulChunks(sample.expectedFirstStep)))
      && !/同类错因"\}|同类错因,|同类错因。|默认/.test(shareCoreText)
  };
  if (!consistencyFindings.sameTaskAcrossTutorAndGame) weakSignals.push('cross-module task/sample id consistency missing');
  if (!consistencyFindings.sameWrongCauseAcrossTutorGameReportShare) weakSignals.push('wrong cause does not stay consistent across tutor/game/report/share');
  if (!consistencyFindings.sameFirstStepAcrossTutorGameShare) weakSignals.push('first step does not stay consistent across tutor/game/share');
  if (!consistencyFindings.parentCheckCarriesToShareAndReport) weakSignals.push('parent check does not carry into share/report');
  if (!consistencyFindings.noGenericReportForSpecificSample) weakSignals.push('report looks generic for a specific sample');
  if (!consistencyFindings.noGenericShareForSpecificSample) weakSignals.push('share looks generic for a specific sample');

  return {
    id: sample.id,
    subject: sample.subject,
    taskType: sample.taskType,
    pressureSignal,
    threeRoundProtocol,
    threeRoundFindings,
    consistencyFindings,
    findings,
    weakSignals,
    threeRoundNoAnswer: socraticRun && socraticRun.final && !containsAny(JSON.stringify(socraticRun.final), ['答案是', '最终答案'])
  };
}

function summarizeNegativeSample(sample) {
  const tutorReply = ladder.buildTutorReply(sample.input, {
    selected: { text: sample.input },
    currentHintLevel: 1
  });
  const replyText = JSON.stringify(tutorReply);
  return {
    id: sample.id,
    blocksAnswerShortcut: sample.expectBlockedAnswer
      ? tutorReply.mastery_signal && tutorReply.mastery_signal.status === 'blocked_answer_request'
      : true,
    noForbiddenLeak: !containsAny(replyText, sample.forbiddenTokens || []),
    keepsFirstStepBoundary: containsAny(replyText, ['第一步', '小黑板', '不直接', '只做思路', '先']),
    noFakeCapabilityClaim: !containsAny(replyText, ['已识别照片', '完整板书', '完整答案', '班级排名', '原题截图', '完整对话'])
  };
}

assert(REAL_HOMEWORK_PRESSURE_SAMPLES.length >= 464, 'real-homework pressure set covers at least four hundred sixty-four samples after public-K12 fifth-wave pressure expansion');
[
  'g7_math_negative_number_equation_sign',
  'g6_math_unit_rate_compare',
  'g9_math_similarity_ratio_area',
  'g7_chinese_narrative_clue_title',
  'g8_chinese_argument_evidence_type',
  'g6_chinese_composition_detail_scene',
  'g8_eng_nonfinite_to_do_purpose',
  'g9_eng_adverbial_clause_unless',
  'g8_eng_cloze_pronoun_reference',
  'g8_physics_pressure_area',
  'g9_physics_series_parallel_current',
  'g8_physics_heat_transfer_direction',
  'g8_chem_limestone_gas_test',
  'g9_chem_ion_coexistence_precipitate',
  'g8_chem_solubility_curve_cooling',
  'g7_bio_microscope_low_high_power',
  'g8_bio_genetics_dominant_recessive',
  'g8_bio_blood_circulation_path',
  'g7_geo_latitude_temperature_rule',
  'g7_geo_earth_rotation_time_difference',
  'g8_geo_contour_river_flow'
].forEach((id) => {
  assert(REAL_HOMEWORK_PRESSURE_SAMPLES.some((item) => item.id === id), `new public-K12 sample exists: ${id}`);
});
[
  'candidate_math_percent_base_recurrence',
  'candidate_math_unit_rate_profit_model',
  'candidate_physics_circuit_meter_position',
  'candidate_physics_motion_graph_variable',
  'candidate_chem_open_system_gas_loss',
  'candidate_chem_ph_indicator_start_direction',
  'candidate_english_pronoun_reference_context',
  'candidate_english_present_perfect_signal',
  'candidate_chinese_evidence_sentence_location',
  'candidate_chinese_argument_counterexample_role',
  'candidate_biology_microscope_direction_rule',
  'candidate_biology_reflex_arc_order',
  'candidate_geo_contour_valley_ridge',
  'candidate_geo_climate_precip_temperature'
].forEach((id) => {
  assert(REAL_HOMEWORK_PRESSURE_SAMPLES.some((item) => item.id === id), `A/A+ candidate-derived pressure sample exists: ${id}`);
});
[
  'confuse_math_function_physics_word',
  'confuse_math_probability_biology_word',
  'confuse_physics_graph_math_word',
  'confuse_physics_pressure_geography_word',
  'confuse_chem_solution_math_ratio_word',
  'confuse_chem_gas_biology_word',
  'confuse_english_reading_chinese_word',
  'confuse_english_grammar_math_word',
  'confuse_chinese_expository_science_word',
  'confuse_chinese_poem_geography_word',
  'confuse_biology_energy_physics_word',
  'confuse_biology_genetics_probability_word',
  'confuse_geo_industry_chemistry_word',
  'confuse_geo_population_math_word'
].forEach((id) => {
  assert(REAL_HOMEWORK_PRESSURE_SAMPLES.some((item) => item.id === id), `confusing cross-subject pressure sample exists: ${id}`);
});
[
  'triple_math_stats_geo_biology',
  'triple_math_geometry_physics_art',
  'triple_physics_electric_chem_math',
  'triple_physics_buoyancy_geo_biology',
  'triple_chem_solubility_math_physics',
  'triple_chem_metal_activity_geo_history',
  'triple_english_reading_science_math',
  'triple_english_grammar_geo_time',
  'triple_chinese_argument_science_data',
  'triple_chinese_narrative_geo_history',
  'triple_biology_photosynthesis_chem_physics',
  'triple_biology_circulation_math_physics',
  'triple_geo_climate_math_physics',
  'triple_geo_plate_physics_chem'
].forEach((id) => {
  assert(REAL_HOMEWORK_PRESSURE_SAMPLES.some((item) => item.id === id), `triple-distractor pressure sample exists: ${id}`);
});
assert(new Set(REAL_HOMEWORK_PRESSURE_SAMPLES.map((item) => item.subject)).size >= 7, 'pressure set covers seven subjects');

const taskTypeCounts = REAL_HOMEWORK_PRESSURE_SAMPLES.reduce((acc, item) => {
  acc[item.taskType] = (acc[item.taskType] || 0) + 1;
  return acc;
}, {});
assert(taskTypeCounts.equation_setup >= 16, 'equation setup pressure set covers sign-change patterns');
assert(taskTypeCounts.writing_process >= 22, 'writing process pressure set covers visible detail');
assert(taskTypeCounts.equation_setup >= 19, 'equation setup pressure set covers sign-change, piecewise, and two-time-point patterns');
assert(taskTypeCounts.writing_process >= 23, 'writing process pressure set covers visible detail and key-moment expansion');
assert(taskTypeCounts.math_word_problem >= 54, 'math pressure set covers unit-rate, weighted average, hidden unit, function, probability, percent-base recurrence, and second-order cross-subject confusion patterns');
assert(taskTypeCounts.english_sentence >= 46, 'English pressure set covers non-finite, subject-verb distance, negative inference, adverbial clauses, pronoun reference, perfect-tense signals, and second-order distractors');
assert(taskTypeCounts.reading_question >= 56, 'reading pressure set covers narrative title, evidence location, word-in-context, argument evidence, science text, poem imagery, and data distractors');
assert(taskTypeCounts.physics_diagram >= 55, 'physics pressure set covers pressure, force balance, refraction normal line, circuit meter position, series-parallel current, motion graphs, heat transfer, and second-order distractors');
assert(taskTypeCounts.chemistry_experiment >= 57, 'chemistry pressure set covers open systems, pH direction, gas test, ion coexistence, filtering sequence, solubility curves, and second-order distractors');
assert(taskTypeCounts.biology_process >= 55, 'biology pressure set covers microscope direction, reflex arc, genetics, energy/material, circulation, and second-order distractors');
assert(taskTypeCounts.geography_map >= 57, 'geography pressure set covers contour ridge-valley, river flow, climate graphs, latitude/season, industry factor, rotation, and second-order distractors');

[
  'deep_math_ratio_table_hidden_unit',
  'deep_math_average_weighted_trap',
  'deep_math_geometry_auxiliary_relation',
  'deep_equation_piecewise_fee_boundary',
  'deep_equation_inequality_sign_flip',
  'deep_equation_age_two_time_points',
  'deep_physics_force_balance_hidden_pair',
  'deep_physics_light_refraction_normal_line',
  'deep_physics_power_energy_time_trap',
  'deep_chem_ion_coexist_color_trap',
  'deep_chem_filter_evaporate_sequence',
  'deep_chem_solubility_curve_temperature',
  'deep_english_clause_subject_verb_distance',
  'deep_english_nonfinite_purpose_or_result',
  'deep_english_reading_inference_negative',
  'deep_chinese_explain_word_context',
  'deep_chinese_poem_image_emotion',
  'deep_chinese_writing_detail_not_plot',
  'deep_biology_ecosystem_energy_material',
  'deep_biology_genetics_trait_carrier',
  'deep_biology_human_circulation_double_loop',
  'deep_geo_latitude_temperature_season',
  'deep_geo_river_flow_contour_interference',
  'deep_geo_industry_location_factor_priority'
].forEach((id) => {
  assert(REAL_HOMEWORK_PRESSURE_SAMPLES.some((item) => item.id === id), `deep second-order pressure sample exists: ${id}`);
});
[
  'public_k12_math_function_image_intercept',
  'public_k12_math_geometry_congruence_correspondence',
  'public_k12_chinese_classical_subject_ellipsis',
  'public_k12_chinese_poem_technique_vs_emotion',
  'public_k12_english_cloze_context_logic',
  'public_k12_english_relative_clause_antecedent',
  'public_k12_physics_circuit_fault_path',
  'public_k12_physics_buoyancy_object_state',
  'public_k12_chem_ion_coexistence_hidden_precipitate',
  'public_k12_chem_mass_conservation_open_system',
  'public_k12_biology_microscope_direction_reverse',
  'public_k12_biology_reflex_arc_path_order',
  'public_k12_geo_climate_graph_axis_match',
  'public_k12_geo_population_density_unit'
].forEach((id) => {
  assert(REAL_HOMEWORK_PRESSURE_SAMPLES.some((item) => item.id === id), `public-K12 third-wave pressure sample exists: ${id}`);
});
[
  'public_k12_math_ratio_table_missing_total',
  'public_k12_math_probability_without_space_update',
  'public_k12_chinese_argument_data_role',
  'public_k12_chinese_classical_function_word_context',
  'public_k12_english_tense_time_anchor',
  'public_k12_english_reading_inference_not_copy',
  'public_k12_physics_density_float_sinks',
  'public_k12_physics_motion_graph_area',
  'public_k12_chem_reagent_excess_limiting',
  'public_k12_chem_lab_sequence_reason',
  'public_k12_biology_genetics_parent_child_trait',
  'public_k12_biology_ecology_food_web_direction',
  'public_k12_geo_monsoon_wind_direction_season',
  'public_k12_geo_population_density_area_unit',
  'public_k12_math_scale_drawing_actual_distance',
  'public_k12_math_profit_discount_equation',
  'public_k12_chinese_expository_method_effect',
  'public_k12_chinese_writing_scene_detail',
  'public_k12_english_passive_voice_receiver',
  'public_k12_english_cloze_contrast_signal',
  'public_k12_physics_pressure_area_relation',
  'public_k12_physics_refraction_normal_line',
  'public_k12_chem_solubility_curve_temperature',
  'public_k12_chem_ion_coexistence_filter',
  'public_k12_biology_photosynthesis_condition',
  'public_k12_biology_human_circulation_path',
  'public_k12_geo_latitude_temperature_rule',
  'public_k12_geo_industry_location_factor'
].forEach((id) => {
  assert(REAL_HOMEWORK_PRESSURE_SAMPLES.some((item) => item.id === id), `public-K12 fourth-wave pressure sample exists: ${id}`);
});
assert(REAL_HOMEWORK_PRESSURE_SAMPLES.every((item) => item.sourceId && item.stem && item.expectedFirstStep && item.expectedWrongCause && item.expectedBoardMove && item.parentCheck && item.nearTransfer), 'every sample has source, stem, first step, wrong cause, board move, parent check, and transfer variant');
assert(NEGATIVE_HOMEWORK_PRESSURE_SAMPLES.length >= 33, 'negative pressure set covers shortcut/privacy/fake-capability/false-mastery/overdiagnosis cases');
assert(PUBLIC_K12_SOURCE_LEDGER.length >= 4, 'public K12 source ledger covers official, homework, exam, and first-party observation sources');
assert(PUBLIC_K12_SOURCE_LEDGER.every((item) => item.productUse.length >= 3 && item.localRuleUse.length >= 3 && item.aiUse.length >= 1 && item.blockedUse.length >= 3 && item.miniappSurface.length >= 1), 'every public K12 source has product use, local rule use, AI use, blocked use, and miniapp surface');
assert(PUBLIC_K12_ASSET_PIPELINE.length >= 6, 'public K12 asset pipeline covers standards, homework, exams, family input, competitor mechanics, and classroom wrong-cause observation');
assert(PUBLIC_K12_ASSET_PIPELINE.every((item) => item.intakeFields.length >= 4 && item.directUse.length >= 3 && item.normalizeAsLocalCode.length >= 4 && item.aiExpressionUse.length >= 1 && item.discardFields.length >= 3 && item.miniappLanding.length >= 2 && item.acceptanceGate.length >= 3), 'every public K12 asset pipeline row has intake, direct use, local code, AI expression, discard fields, miniapp landing, and acceptance gates');
assert(PUBLIC_K12_ASSET_PIPELINE.every((item) => item.owner.includes('local_rule')), 'every public K12 asset pipeline keeps release-critical ownership in local rules');
assert(PUBLIC_K12_ASSET_PIPELINE.find((item) => item.id === 'competitor_mechanic_to_local_loop').discardFields.includes('全科动态板书承诺'), 'competitor mechanics are borrowed as loops, not fake full-blackboard claims');
assert(PUBLIC_K12_ASSET_PIPELINE.find((item) => item.id === 'family_input_to_evidence_ledger').discardFields.includes('分数排名'), 'family input pipeline blocks score/rank exposure');
assert(PUBLIC_K12_CANDIDATE_POOL.length >= 7, 'public K12 candidate pool gives concrete next assets to expand content scale');
assert(new Set(PUBLIC_K12_CANDIDATE_POOL.map((item) => item.qualityTier)).size >= 3, 'candidate pool separates A+, A, and B quality tiers');
assert(PUBLIC_K12_CANDIDATE_POOL.every((item) => item.usableAs.length >= 3 && item.localCodeFit.length >= 3 && item.aiFit.length >= 1 && item.rejectIf.length >= 3 && item.miniappLanding.length >= 2 && item.sampleSeed && item.nextAction), 'every candidate asset has use, local fit, AI fit, rejection criteria, landing surfaces, seed, and next action');
assert(PUBLIC_K12_CANDIDATE_POOL.every((item) => !item.aiFit.join('').includes('决定')), 'candidate assets keep AI out of release-critical decisions');
assert(PUBLIC_K12_CANDIDATE_POOL.some((item) => item.id === 'family_first_party_recurrence' && item.qualityTier === 'A+'), 'first-party recurrence is treated as the highest-confidence content asset');
assert(PUBLIC_K12_CANDIDATE_POOL.some((item) => item.id === 'qwen_visual_blackboard_observation' && item.rejectIf.includes('承诺全科动态板书')), 'Qwen-style visual learning is borrowed without fake full-blackboard claims');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length >= 12, 'open-source/OER resource ledger covers official, simulation, flexbook, open textbook, visual activity, inquiry, routines, and learning-design resources');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.every((item) => item.directUse.length >= 3 && item.localizeAsCode.length >= 3 && item.aiBetterFor.length >= 1 && item.mustNotUse.length >= 3 && item.miniappLanding.length >= 2 && item.acceptanceGate.length >= 3), 'every open-source/OER resource has direct use, local code fit, AI fit, rejected use, landing surfaces, and gates');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.every((item) => item.sourceUrl && item.licenseSignal && item.commercialDecision), 'every open-source/OER resource has source URL, license signal, and commercial-use decision');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.every((item) => /不复制|不搬运|不直接导入|不嵌入|不宣称/.test(item.commercialDecision)), 'every OER commercial decision blocks direct copying or fake partnership/capability claims');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.filter((item) => item.licenseCheckedAt && item.reuseLevel && item.derivedArtifact).length >= 3, 'new OER rows carry license check, reuse level, and derived artifact fields');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'openscied_science_inquiry_structure' && item.localizeAsCode.includes('evidence_chain_board')), 'OpenSciEd-style resources are localized into evidence-chain blackboard cards');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'illustrative_math_problem_based_structure' && item.mustNotUse.includes('复制 IM 任务文本')), 'IM-style resources are structure-only and block task text copying');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'phet_simulation_oer' && item.localizeAsCode.includes('visual_board_layer') && item.mustNotUse.includes('承诺全科动态板书')), 'PhET-style OER is borrowed as visual first-step rules, not fake full-board capability');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'ck12_flexbook_practice' && item.localizeAsCode.includes('adaptive_recall_policy')), 'CK-12-style OER informs local recall policy instead of external score import');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'geogebra_classroom_activity' && item.localizeAsCode.includes('geometry_board_move') && item.mustNotUse.includes('直接嵌入未授权交互')), 'GeoGebra-style visual resources become local geometry board moves, not embedded external activities');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'libretexts_stem_reference' && item.localizeAsCode.includes('concept_prerequisite_ladder')), 'LibreTexts-style open textbooks become prerequisite ladders instead of copied passages');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'khan_academy_learning_design' && item.localizeAsCode.includes('mastery_gate') && item.mustNotUse.includes('冒充 Khanmigo')), 'Khan Academy public learning design informs local mastery gates without copying content or claiming Khanmigo capability');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'oer_commons_cc_resource_pool' && item.localizeAsCode.includes('source_license_registry') && item.acceptanceGate.includes('license_checked')), 'OER Commons-style resources enter only through license registry and reuse gates');
assert(PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.some((item) => item.id === 'public_curriculum_standards_crosswalk' && item.localizeAsCode.includes('skill_verb') && item.acceptanceGate.includes('structure_only')), 'public curriculum standards become skill-verb crosswalks instead of copied standard text');
assert(PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length >= 14, 'public K12 homework intake queue covers at least two pressure shapes per core subject');
assert(new Set(PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.map((item) => item.subject)).size >= 7, 'public K12 intake queue covers seven subjects');
const intakeByFamily = PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.reduce((acc, item) => {
  const family = /math/i.test(item.id) ? 'math'
    : /chinese|语文/i.test(item.id) ? 'chinese'
      : /english/i.test(item.id) ? 'english'
        : /physics/i.test(item.id) ? 'physics'
          : /chem/i.test(item.id) ? 'chemistry'
            : /biology|ck12/i.test(item.id) ? 'biology'
              : /geo|geography/i.test(item.id) ? 'geography'
                : item.subject;
  acc[family] = Number(acc[family] || 0) + 1;
  return acc;
}, {});
assert(Object.keys(intakeByFamily).length >= 7 && Object.values(intakeByFamily).every((count) => count >= 3), 'public K12 intake queue covers at least three pressure shapes per core subject family');
assert(PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.every((item) => item.sourceId && item.sourceUrl && item.taskType && item.observedHomeworkShape && item.localPressureTransform && item.socraticProbe && item.reportUse && item.gameUse && item.shareHook), 'every public K12 intake row maps source to local pressure, Socratic, report, game, and share use');
assert(PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.every((item) => item.proofRequired.length >= 3 && item.blockedUse.length >= 3), 'every public K12 intake row has proof gates and blocked uses');
assert(PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.every((item) => /不搬|不复制|不嵌入|不导入|不展示|不刷|不靠|只练|转成|本地/.test(item.localPressureTransform + item.gameUse + item.blockedUse.join(''))), 'public K12 intake queue prevents fake content scale and answer-bank shortcuts');
assert(publicK12IntakeChallengeDeck.length >= 14, 'public K12 intake queue becomes playable challenge cards');
assert(publicK12IntakeChallengeDeck.every((item) => item.route.includes('/pages/tutor/tutor') && item.arcadeRoute.includes('/pages/arcade/arcade') && item.firstStepPrompt && item.gameUse && item.shareHook && item.answerBoundary.includes('不展示原题') && item.localOwner === 'local_rule' && item.aiOwner === 'ai_wording_only'), 'public K12 intake challenge cards are playable, answer-safe, local-owned, and share-ready');
assert(publicK12IntakeChallengeDeck.every((item) => item.route.includes('/pages/tutor/tutor') && item.reviewRoute.includes('/pages/review/review') && item.observableFirstMove && item.fallbackIfNoChildInput && item.receiverMustUseOwnMaterial === true), 'public K12 challenge cards route into tutor/review with first move, fallback, and own-material gates');
assert(publicK12IntakeChallengeDeck.every((item) => Array.isArray(item.shareSafeFields) && item.shareSafeFields.includes('observable_first_move') && Array.isArray(item.blockedFields) && item.blockedFields.includes('full_solution') && item.blockedFields.includes('ranking')), 'public K12 challenge cards expose share allowlist and block unsafe answer/ranking fields');
assert(publicK12IntakeChallengeDeck.every((item) => Array.isArray(item.localCodeOwns) && item.localCodeOwns.includes('share_safe_fields') && Array.isArray(item.aiBetterFor) && item.aiBetterFor.includes('socratic_prompt_wording') && Array.isArray(item.aiMustNotOwn) && item.aiMustNotOwn.includes('final_answer')), 'public K12 challenge cards separate local ownership from AI wording');
assert(publicK12IntakeChallengeDeck.every((item) => item.nextPracticePlan && item.nextPracticePlan.appRoute.includes('/pages/review/review') && item.nextPracticePlan.arcadeRoute.includes('/pages/arcade/arcade') && item.reviewCard && item.reviewCard.type === 'public_k12_homework_intake'), 'public K12 challenge cards carry review-card and next-practice bridges instead of stopping at ledger rows');
const arcadePageJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/arcade/arcade.js'), 'utf8');
assert(arcadePageJs.includes('buildPublicK12IntakeExecutableCards') && arcadePageJs.includes('publicK12IntakeChallengeDeck') && arcadePageJs.includes('publicK12IntakeChallenge'), 'arcade page consumes public K12 intake challenge deck as executable cards');
assert(PUBLIC_K12_USE_WORKBENCH.length >= 6, 'public K12 workbench separates curriculum, homework, exam, first-party, Socratic AI, and blackboard use cases');
assert(PUBLIC_K12_USE_WORKBENCH.every((item) => item.directUse.length >= 3 && item.localizeAsCode.length >= 3 && item.aiBetterFor.length >= 1 && item.mustNotUse.length >= 3 && item.productSurface.length >= 1 && item.evidenceGate.length >= 3), 'every K12 workbench row defines direct use, local code, AI use, blocked use, surfaces, and gates');
assert(PUBLIC_K12_USE_WORKBENCH.find((item) => item.id === 'socratic_ai_layer').productDecision.includes('怎么说'), 'Socratic AI layer is limited to phrasing');
assert(PUBLIC_K12_USE_WORKBENCH.find((item) => item.id === 'visual_blackboard_layer').productDecision.includes('第一步小黑板'), 'Visual blackboard layer avoids fake full dynamic blackboard claims');
assert(PUBLIC_K12_USE_POLICY.localCodeOwns.includes('错因分类') && PUBLIC_K12_USE_POLICY.aiOwns.includes('苏格拉底追问语气'), 'public-source policy separates deterministic local code from AI phrasing');
assert(PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES.length >= 6, 'anti-fake thickness gates cover source, Socratic, blackboard, memory, report, and share risks');
assert(PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES.every((item) => item.productRisk && item.localCodeMustOwn.length >= 4 && item.aiCanHelp.length >= 1 && item.proofRequired.length >= 3 && item.rejectIf.length >= 3), 'every anti-fake thickness gate names risk, local ownership, AI role, proof, and rejection conditions');
assert(PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES.find((item) => item.id === 'socratic_axis_gate').localCodeMustOwn.includes('追问轴'), 'Socratic anti-fake gate keeps the question axis local');
assert(PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES.find((item) => item.id === 'visual_blackboard_gate').rejectIf.includes('承诺拍照识题'), 'visual blackboard anti-fake gate blocks fake photo-question capability');
assert(PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES.find((item) => item.id === 'report_portrait_gate').rejectIf.includes('一题就贴长期标签'), 'report anti-fake gate blocks overdiagnosis from thin evidence');
assert(PUBLIC_K12_IMPLEMENTATION_PLAYBOOK.length >= 4, 'implementation playbook separates direct use, local-code-better, AI-better, and must-reject cases');
assert(PUBLIC_K12_IMPLEMENTATION_PLAYBOOK.find((item) => item.id === 'local_code_better').useFor.includes('XP 与解锁'), 'local-code playbook owns XP and unlock decisions');
assert(PUBLIC_K12_IMPLEMENTATION_PLAYBOOK.find((item) => item.id === 'ai_better').aiRole.includes('怎么说'), 'AI playbook limits AI to expression');
assert(PUBLIC_K12_IMPLEMENTATION_PLAYBOOK.find((item) => item.id === 'must_reject').useFor.includes('标准答案库'), 'must-reject playbook blocks answer-bank use');
const publicResourceTriageBoard = realHomeworkCoverage.buildK12PublicResourceTriageBoard();
assert.strictEqual(publicResourceTriageBoard.id, 'k12_public_resource_triage_board', 'public resource triage board exposes a stable id');
assert(publicResourceTriageBoard.lanes.some((item) => item.id === 'local_code_better' && item.use.includes('第一步小黑板')), 'public resource triage keeps blackboard and release decisions in local code');
assert(publicResourceTriageBoard.lanes.some((item) => item.id === 'ai_better' && item.owner === 'ai_wording_only'), 'public resource triage limits AI to wording');
assert(publicResourceTriageBoard.lanes.some((item) => item.id === 'must_reject' && item.use.includes('标准答案库')), 'public resource triage blocks answer-bank shortcuts');
assert(publicResourceTriageBoard.resourceCards.length >= PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length, 'public resource triage creates one decision card per OER/public source');
assert(publicResourceTriageBoard.sourceBackedChallengeSeeds.length >= PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length, 'public resource triage creates one source-backed challenge seed per OER/public source without copying source content');
assert(publicResourceTriageBoard.mustReject.includes('photo_search_claim') && publicResourceTriageBoard.mustReject.includes('fake_partner_claim'), 'public resource triage blocks fake photo-search and fake partnership claims');
const localAiRunway = realHomeworkCoverage.buildK12LocalAiImplementationRunway();
assert.strictEqual(localAiRunway.id, 'k12_local_ai_implementation_runway', 'local/AI implementation runway exposes a stable id');
assert(localAiRunway.moduleRows.length >= 7, 'local/AI runway covers content scale, Socratic, mini-lesson, game, report, share, and partner upload');
assert(localAiRunway.moduleRows.every((row) => row.localCodeOwns.length >= 4 && row.aiBetterFor.length >= 2 && row.acceptanceGate.length >= 4), 'every local/AI runway row separates local ownership, AI wording, and release gates');
assert(localAiRunway.moduleRows.some((row) => row.id === 'mini_lesson_visual_board' && row.localCodeOwns.includes('render_gate') && row.acceptanceGate.includes('child_exit_ticket_before_game')), 'mini-lesson runway keeps render and exit gates local');
assert(localAiRunway.moduleRows.some((row) => row.id === 'active_recall_game' && row.localCodeOwns.includes('xp_unlock') && row.acceptanceGate.includes('answer_hidden_before_self_grade')), 'Gizmo-style active recall keeps XP and answer reveal local');
assert(localAiRunway.moduleRows.some((row) => row.id === 'family_decision_report' && row.localCodeOwns.includes('portrait_release_gate') && row.acceptanceGate.includes('talent_label_blocked')), 'family report runway blocks talent labels and gates portrait release locally');
assert(localAiRunway.resourceCoverage.length >= PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length, 'local/AI runway maps every public/OER resource into target modules');
assert(localAiRunway.blockedClaims.includes('full_ai_classroom') && localAiRunway.blockedClaims.includes('guaranteed_improvement'), 'local/AI runway blocks classroom drift and outcome guarantees');
const profilePageJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/profile/profile.js'), 'utf8');
const profilePageWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/profile/profile.wxml'), 'utf8');
assert(profilePageJs.includes('realHomeworkLocalAiRunwayModules') && profilePageJs.includes('realHomeworkLocalAiResourceCoverage'), 'profile page exposes local/AI runway modules and resource coverage to the report view');
assert(profilePageWxml.includes('yd-parent-sources') && profilePageWxml.includes('yd-parent-decision') && profilePageWxml.includes('yd-parent-action-row'), 'profile report renders the new parent evidence preview and next-action copy');
const unifiedSourceRegistry = realHomeworkCoverage.buildUnifiedK12SourceRegistry();
const curriculumAssetSourceAudit = realHomeworkCoverage.buildCurriculumAssetSourceAudit({ registry: unifiedSourceRegistry });
assert(unifiedSourceRegistry.length >= PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length + 4, 'unified source registry includes OER/public rows plus textbook, learning-asset, generated-question, and family-upload sources');
assert(unifiedSourceRegistry.some((item) => item.sourceRegistryId === 'china_textbook_index_structure' && item.sourceKind === 'textbook_structure_index_only' && item.reuseScope.includes('structure')), 'textbook index is registered as structure-only, not distributable textbook content');
assert(unifiedSourceRegistry.some((item) => item.sourceRegistryId === 'learning_asset_index_structure' && item.distributionPolicy.includes('original_passages')), 'learning asset index blocks original passages and only feeds metadata/planning');
assert(unifiedSourceRegistry.some((item) => item.sourceRegistryId === 'generated_question_bank_structure' && item.releaseDecision.includes('first_step') && item.distributionPolicy.includes('hidden')), 'generated question bank is gated to reviewed first-step use and hidden answers');
assert(unifiedSourceRegistry.some((item) => item.sourceRegistryId === 'first_party_family_upload' && item.userRightsRequired && item.releaseDecision.includes('private_report_only')), 'family uploads stay private and report-only');
assert(unifiedSourceRegistry.every((item) => item.originalTextIncluded === false && item.answerVisibility === 'first_step_only_no_full_answer'), 'unified source registry blocks original text and full-answer visibility');
assert(unifiedSourceRegistry.every((item) => item.mustNotSurface.includes('source_question') && item.mustNotSurface.includes('source_answer') && item.mustNotSurface.includes('source_image') && item.mustNotSurface.includes('full_solution') && item.mustNotSurface.includes('answer_key')), 'every unified source row blocks source question, source answer, images, full solution, and answer key');
assert(unifiedSourceRegistry.every((item) => !item.allowedDerivedArtifacts.includes('full_solution') && !item.allowedDerivedArtifacts.includes('answer_key')), 'allowed derived artifacts never include full solution or answer key');
assert.strictEqual(curriculumAssetSourceAudit.ok, true, 'curriculum asset source audit passes unified rights and distribution gates');
assert(curriculumAssetSourceAudit.rowsByKind.textbook_structure_index_only >= 1 && curriculumAssetSourceAudit.rowsByKind.first_party_user_provided_material >= 1, 'curriculum asset source audit separates textbook structure from private family uploads');
const pressureFailureTypeAudit = realHomeworkCoverage.buildPressureSampleFailureTypeAudit({
  samples: REAL_HOMEWORK_PRESSURE_SAMPLES
});
assert.strictEqual(pressureFailureTypeAudit.id, 'pressure_sample_failure_type_audit', 'pressure sample failure audit exposes a stable id');
assert.strictEqual(pressureFailureTypeAudit.totalSamples, REAL_HOMEWORK_PRESSURE_SAMPLES.length, 'pressure failure audit covers every real-homework pressure sample');
assert(pressureFailureTypeAudit.subjectRows.length >= 7, 'pressure failure audit reports all subject lanes');
assert(pressureFailureTypeAudit.localRuleLine.includes('本地代码负责反向抽检'), 'pressure failure audit keeps weak-spot decisions local');
assert(pressureFailureTypeAudit.stopRule.includes('真实家庭失败样本'), 'pressure failure audit has a marginal-benefit stop rule');
assert(Array.isArray(pressureFailureTypeAudit.weakSamples) && pressureFailureTypeAudit.weakSamples.length <= 12, 'pressure failure audit returns a bounded repair queue');
assert(K12_PUBLIC_IMPLEMENTATION_DECISION_MATRIX.length >= 9, 'public-K12 implementation matrix separates source mining, Socratic, blackboard, report, share, memory, question bank, intake, and home-school decisions');
assert(QUESTION_TYPE_CLUSTER_RUNWAY.length >= 9, 'question-type cluster runway covers the major seven-subject pressure families');
assert(new Set(QUESTION_TYPE_CLUSTER_RUNWAY.map((item) => item.taskType)).size >= 8, 'question-type cluster runway spans supported task types');

const results = REAL_HOMEWORK_PRESSURE_SAMPLES.map(summarizeSample);
const negativeResults = NEGATIVE_HOMEWORK_PRESSURE_SAMPLES.map(summarizeNegativeSample);
const longitudinalResults = LONGITUDINAL_HOMEWORK_PRESSURE_SCENARIOS.map((scenario) => {
  const text = JSON.stringify(scenario);
  const aiText = (scenario.aiBetter || []).join('\n');
  const blockedText = (scenario.reportMustNotSay || []).join('\n');
  return {
    id: scenario.id,
    subject: scenario.subject,
    hasEvidenceWindow: Array.isArray(scenario.evidenceWindow) && scenario.evidenceWindow.length >= 3,
    localRuleOwned: Array.isArray(scenario.localRuleBetter) && scenario.localRuleBetter.length >= 3,
    aiExpressionOnly: Array.isArray(scenario.aiBetter) && scenario.aiBetter.length >= 1
      && /话术|解释|改写|提醒|问题|说成/.test(aiText)
      && !/决定|判断|发放|解锁|释放/.test(aiText),
    reportSafe: !!scenario.reportMustSay && !scenario.reportMustSay.includes('已掌握') && blockedText.length > 0,
    releaseGateSafe: !!scenario.releaseGate && !scenario.releaseGate.includes('AI') && containsAny(scenario.releaseGate, ['不能', '只能', '不写', '不判断']),
    handoffSafe: !!scenario.parentHandoff && !!scenario.shareSafeHook
      && containsAny(scenario.shareSafeHook, ['不显示', '不带'])
      && !containsAny(scenario.shareSafeHook, ['排名', '分数', '正确率'])
  };
});
const count = (predicate) => results.filter(predicate).length;
const weakSignalCount = results.reduce((sum, item) => sum + item.weakSignals.length, 0);

function uniqueCount(items, selector) {
  return new Set(items.map(selector).filter(Boolean)).size;
}

function topRepeatRatio(items, selector) {
  const counts = items.reduce((acc, item) => {
    const key = selector(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const max = Object.keys(counts).reduce((highest, key) => Math.max(highest, counts[key]), 0);
  return items.length ? max / items.length : 0;
}

const pseudoThicknessRadar = {
  id: 'real_homework_pseudo_thickness_radar',
  sampleCount: results.length,
  subjectCount: new Set(results.map((item) => item.subject)).size,
  taskTypeCount: new Set(results.map((item) => item.taskType)).size,
  uniqueFirstSteps: uniqueCount(results, (item) => item.pressureSignal.firstStep),
  uniqueWrongCauses: uniqueCount(results, (item) => item.pressureSignal.wrongCause),
  uniqueBoardMoves: uniqueCount(results, (item) => item.pressureSignal.boardMove),
  uniqueParentChecks: uniqueCount(results, (item) => item.pressureSignal.parentCheck),
  uniqueReviewMoves: uniqueCount(results, (item) => item.pressureSignal.reviewMove),
  topFirstStepRepeatRatio: topRepeatRatio(results, (item) => item.pressureSignal.firstStep),
  topWrongCauseRepeatRatio: topRepeatRatio(results, (item) => item.pressureSignal.wrongCause),
  topBoardMoveRepeatRatio: topRepeatRatio(results, (item) => item.pressureSignal.boardMove),
  topParentCheckRepeatRatio: topRepeatRatio(results, (item) => item.pressureSignal.parentCheck),
  riskChecks: [
    { id: 'first_step_not_generic', pass: uniqueCount(results, (item) => item.pressureSignal.firstStep) >= 180 },
    { id: 'wrong_cause_not_generic', pass: uniqueCount(results, (item) => item.pressureSignal.wrongCause) >= 180 },
    { id: 'board_move_not_generic', pass: uniqueCount(results, (item) => item.pressureSignal.boardMove) >= 160 },
    { id: 'parent_check_not_generic', pass: uniqueCount(results, (item) => item.pressureSignal.parentCheck) >= 160 },
    { id: 'no_single_first_step_template', pass: topRepeatRatio(results, (item) => item.pressureSignal.firstStep) <= 0.04 },
    { id: 'no_single_wrong_cause_template', pass: topRepeatRatio(results, (item) => item.pressureSignal.wrongCause) <= 0.04 },
    { id: 'no_single_board_template', pass: topRepeatRatio(results, (item) => item.pressureSignal.boardMove) <= 0.05 },
    { id: 'no_single_parent_template', pass: topRepeatRatio(results, (item) => item.pressureSignal.parentCheck) <= 0.05 }
  ]
};
const pseudoThicknessRiskCount = pseudoThicknessRadar.riskChecks.filter((item) => !item.pass).length;
const threeRoundSocraticRadar = {
  id: 'three_round_socratic_anti_template_radar',
  round1Ready: count((item) => item.threeRoundFindings.round1Specific),
  round2Ready: count((item) => item.threeRoundFindings.round2WrongCauseSpecific),
  round3Ready: count((item) => item.threeRoundFindings.round3ParentSpecific),
  answerSafe: count((item) => item.threeRoundFindings.blocksAnswer && item.threeRoundFindings.noFinalAnswerLeak),
  uniqueRound1CoachMoves: uniqueCount(results, (item) => item.threeRoundProtocol.rounds && item.threeRoundProtocol.rounds[0] && item.threeRoundProtocol.rounds[0].coachMove),
  uniqueRound2CoachMoves: uniqueCount(results, (item) => item.threeRoundProtocol.rounds && item.threeRoundProtocol.rounds[1] && item.threeRoundProtocol.rounds[1].coachMove),
  uniqueRound3CoachMoves: uniqueCount(results, (item) => item.threeRoundProtocol.rounds && item.threeRoundProtocol.rounds[2] && item.threeRoundProtocol.rounds[2].coachMove),
  topRound2RepeatRatio: topRepeatRatio(results, (item) => item.threeRoundProtocol.rounds && item.threeRoundProtocol.rounds[1] && item.threeRoundProtocol.rounds[1].coachMove),
  riskChecks: [
    { id: 'round1_sample_specific', pass: count((item) => item.threeRoundFindings.round1Specific) === results.length },
    { id: 'round2_wrong_cause_specific', pass: count((item) => item.threeRoundFindings.round2WrongCauseSpecific) === results.length },
    { id: 'round3_parent_handoff_specific', pass: count((item) => item.threeRoundFindings.round3ParentSpecific) === results.length },
    { id: 'three_round_answer_safe', pass: count((item) => item.threeRoundFindings.blocksAnswer && item.threeRoundFindings.noFinalAnswerLeak) === results.length },
    { id: 'round2_not_generic_template', pass: uniqueCount(results, (item) => item.threeRoundProtocol.rounds && item.threeRoundProtocol.rounds[1] && item.threeRoundProtocol.rounds[1].coachMove) >= 180 },
    { id: 'round2_repeat_under_cap', pass: topRepeatRatio(results, (item) => item.threeRoundProtocol.rounds && item.threeRoundProtocol.rounds[1] && item.threeRoundProtocol.rounds[1].coachMove) <= 0.04 }
  ]
};
const threeRoundSocraticRiskCount = threeRoundSocraticRadar.riskChecks.filter((item) => !item.pass).length;
const crossModuleConsistencyRadar = {
  id: 'real_homework_cross_module_consistency_radar',
  sameTaskAcrossTutorAndGame: count((item) => item.consistencyFindings.sameTaskAcrossTutorAndGame),
  sameWrongCauseAcrossTutorGameReportShare: count((item) => item.consistencyFindings.sameWrongCauseAcrossTutorGameReportShare),
  sameFirstStepAcrossTutorGameShare: count((item) => item.consistencyFindings.sameFirstStepAcrossTutorGameShare),
  parentCheckCarriesToShareAndReport: count((item) => item.consistencyFindings.parentCheckCarriesToShareAndReport),
  noGenericReportForSpecificSample: count((item) => item.consistencyFindings.noGenericReportForSpecificSample),
  noGenericShareForSpecificSample: count((item) => item.consistencyFindings.noGenericShareForSpecificSample),
  riskChecks: [
    { id: 'same_task_and_sample_id', pass: count((item) => item.consistencyFindings.sameTaskAcrossTutorAndGame) === results.length },
    { id: 'same_wrong_cause_cross_module', pass: count((item) => item.consistencyFindings.sameWrongCauseAcrossTutorGameReportShare) === results.length },
    { id: 'same_first_step_cross_module', pass: count((item) => item.consistencyFindings.sameFirstStepAcrossTutorGameShare) === results.length },
    { id: 'parent_check_cross_module', pass: count((item) => item.consistencyFindings.parentCheckCarriesToShareAndReport) === results.length },
    { id: 'report_not_generic', pass: count((item) => item.consistencyFindings.noGenericReportForSpecificSample) === results.length },
    { id: 'share_not_generic', pass: count((item) => item.consistencyFindings.noGenericShareForSpecificSample) === results.length }
  ]
};
const crossModuleConsistencyRiskCount = crossModuleConsistencyRadar.riskChecks.filter((item) => !item.pass).length;
const summary = {
  ok: true,
  sampleCount: results.length,
  subjectCount: new Set(results.map((item) => item.subject)).size,
  sourceCount: SOURCE_REGISTRY.length,
  publicSourceLedgerCount: PUBLIC_K12_SOURCE_LEDGER.length,
  publicK12AssetPipelineRows: PUBLIC_K12_ASSET_PIPELINE.length,
  publicK12CandidateAssets: PUBLIC_K12_CANDIDATE_POOL.length,
  publicK12OpenSourceResources: PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length,
  publicK12HomeworkIntakeQueue: PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length,
  publicK12IntakeChallengeCards: publicK12IntakeChallengeDeck.length,
  publicK12WorkbenchRows: PUBLIC_K12_USE_WORKBENCH.length,
  antiFakeThicknessGates: PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES.length,
  implementationPlaybookRows: PUBLIC_K12_IMPLEMENTATION_PLAYBOOK.length,
  implementationDecisionRows: K12_PUBLIC_IMPLEMENTATION_DECISION_MATRIX.length,
  questionTypeClusterCount: QUESTION_TYPE_CLUSTER_RUNWAY.length,
  questionTypeClusterTaskTypes: new Set(QUESTION_TYPE_CLUSTER_RUNWAY.map((item) => item.taskType)).size,
  taskTypeMatched: `${count((item) => item.findings.taskTypeMatched)}/${results.length}`,
  answerSafe: `${count((item) => item.findings.blocksDirectAnswer && item.findings.noFinalAnswerLeak)}/${results.length}`,
  boardReady: `${count((item) => item.findings.visualBoundaryPresent)}/${results.length}`,
  parentReady: `${count((item) => item.findings.parentDecisionPresent)}/${results.length}`,
  reviewReady: `${count((item) => item.findings.reviewLoopPresent)}/${results.length}`,
  safeShareReady: `${count((item) => item.findings.safeShareBoundary)}/${results.length}`,
  memoryWrongCauseReady: `${count((item) => item.findings.memoryWrongCauseSpecific)}/${results.length}`,
  memoryRevisitReady: `${count((item) => item.findings.memoryRevisitSpecific)}/${results.length}`,
  memoryVariantReady: `${count((item) => item.findings.memoryVariantSpecific)}/${results.length}`,
  reportPortraitReady: `${count((item) => item.findings.reportPortraitSpecific)}/${results.length}`,
  reportCrossWeekReady: `${count((item) => item.findings.reportCrossWeekSpecific)}/${results.length}`,
  homeSchoolDigestReady: `${count((item) => item.findings.homeSchoolDigestSpecific)}/${results.length}`,
  reportEvidenceReleaseReady: `${count((item) => item.findings.reportEvidenceReleaseSafe)}/${results.length}`,
  shareRelayReady: `${count((item) => item.findings.shareRelaySpecific)}/${results.length}`,
  negativeShortcutSafe: `${negativeResults.filter((item) => item.blocksAnswerShortcut).length}/${negativeResults.length}`,
  negativeNoForbiddenLeak: `${negativeResults.filter((item) => item.noForbiddenLeak).length}/${negativeResults.length}`,
  negativeBoundaryReady: `${negativeResults.filter((item) => item.keepsFirstStepBoundary).length}/${negativeResults.length}`,
  negativeNoFakeClaim: `${negativeResults.filter((item) => item.noFakeCapabilityClaim).length}/${negativeResults.length}`,
  longitudinalScenarioCount: longitudinalResults.length,
  longitudinalEvidenceReady: `${longitudinalResults.filter((item) => item.hasEvidenceWindow).length}/${longitudinalResults.length}`,
  longitudinalLocalRuleReady: `${longitudinalResults.filter((item) => item.localRuleOwned).length}/${longitudinalResults.length}`,
  longitudinalReportSafe: `${longitudinalResults.filter((item) => item.reportSafe && item.releaseGateSafe).length}/${longitudinalResults.length}`,
  longitudinalShareSafe: `${longitudinalResults.filter((item) => item.handoffSafe).length}/${longitudinalResults.length}`,
  sampleSpecificFirstStep: `${count((item) => item.findings.firstStepSpecific)}/${results.length}`,
  sampleSpecificWrongCause: `${count((item) => item.findings.wrongCauseSpecific)}/${results.length}`,
  sampleSpecificBoardMove: `${count((item) => item.findings.boardMoveSpecific)}/${results.length}`,
  sampleSpecificParentCheck: `${count((item) => item.findings.parentCheckSpecific)}/${results.length}`,
  sampleSpecificTransfer: `${count((item) => item.findings.transferSpecific)}/${results.length}`,
  pseudoThicknessRiskCount,
  pseudoThicknessRadar,
  threeRoundSocraticRiskCount,
  threeRoundSocraticRadar,
  crossModuleConsistencyRiskCount,
  crossModuleConsistencyRadar,
  weakSignalCount,
  topWeakSignals: results.filter((item) => item.weakSignals.length).slice(0, 12).map((item) => ({
    id: item.id,
    subject: item.subject,
    weakSignals: item.weakSignals
  }))
};

if (weakSignalCount > 0) {
  console.error(JSON.stringify(summary, null, 2));
}

assert.strictEqual(count((item) => item.findings.taskTypeMatched), results.length, 'task type detection should pass every real sample');
assert.strictEqual(
  count((item) => item.findings.blocksDirectAnswer && item.findings.noFinalAnswerLeak),
  results.length,
  `every pressure sample blocks direct answers and avoids final-answer leakage: ${JSON.stringify(results.filter((item) => !(item.findings.blocksDirectAnswer && item.findings.noFinalAnswerLeak)).map((item) => item.id).slice(0, 8))}`
);
assert.strictEqual(count((item) => item.findings.visualBoundaryPresent), results.length, 'first-step blackboard boundary should be visible for every sample');
assert.strictEqual(count((item) => item.findings.parentDecisionPresent), results.length, 'parent decision report should be visible for every sample');
assert.strictEqual(count((item) => item.findings.reviewLoopPresent), results.length, 'review loop should be visible for every sample');
assert.strictEqual(count((item) => item.findings.safeShareBoundary), results.length, 'safe share boundary should be visible for every sample');
assert.strictEqual(count((item) => item.findings.firstStepSpecific), results.length, 'every pressure sample should map to a sample-specific first step');
assert.strictEqual(count((item) => item.findings.wrongCauseSpecific), results.length, 'every pressure sample should map to a sample-specific wrong cause');
assert.strictEqual(count((item) => item.findings.boardMoveSpecific), results.length, 'every pressure sample should map to a sample-specific board move');
assert.strictEqual(count((item) => item.findings.parentCheckSpecific), results.length, 'every pressure sample should map to a sample-specific parent check');
assert.strictEqual(count((item) => item.findings.transferSpecific), results.length, 'every pressure sample should map to a sample-specific transfer move');
assert.strictEqual(count((item) => item.findings.memoryWrongCauseSpecific), results.length, 'every pressure sample should enter memory loop with sample-specific wrong cause');
assert.strictEqual(count((item) => item.findings.memoryRevisitSpecific), results.length, 'every pressure sample should enter tomorrow/day-7 spaced revisit');
assert.strictEqual(count((item) => item.findings.memoryVariantSpecific), results.length, 'every pressure sample should enter variant unlock or transfer practice');
assert.strictEqual(count((item) => item.findings.reportPortraitSpecific), results.length, 'every pressure sample should enter report portrait or tonight decision evidence');
assert.strictEqual(count((item) => item.findings.reportCrossWeekSpecific), results.length, 'every pressure sample should enter cross-week trend evidence');
assert.strictEqual(count((item) => item.findings.homeSchoolDigestSpecific), results.length, 'every pressure sample should enter home-school digest');
assert.strictEqual(count((item) => item.findings.reportEvidenceReleaseSafe), results.length, 'every pressure sample should carry deterministic report evidence release gates');
assert.strictEqual(count((item) => item.findings.shareRelaySpecific), results.length, 'every pressure sample should create a safe relay action');
assert.strictEqual(pseudoThicknessRiskCount, 0, `pseudo-thickness radar should not find generic cross-sample templates: ${JSON.stringify(pseudoThicknessRadar)}`);
assert.strictEqual(threeRoundSocraticRiskCount, 0, `three-round Socratic radar should not find generic or unsafe prompts: ${JSON.stringify(threeRoundSocraticRadar)}`);
assert.strictEqual(crossModuleConsistencyRiskCount, 0, `cross-module consistency radar should not find thick-but-inaccurate module drift: ${JSON.stringify(crossModuleConsistencyRadar)}`);
assert.strictEqual(negativeResults.filter((item) => item.blocksAnswerShortcut).length, negativeResults.length, 'negative samples that ask for shortcuts should be blocked');
assert.strictEqual(negativeResults.filter((item) => item.noForbiddenLeak).length, negativeResults.length, 'negative samples should not echo forbidden private/fake/full-answer fields');
assert.strictEqual(negativeResults.filter((item) => item.keepsFirstStepBoundary).length, negativeResults.length, 'negative samples should keep first-step tutoring boundary');
assert.strictEqual(negativeResults.filter((item) => item.noFakeCapabilityClaim).length, negativeResults.length, 'negative samples should not claim fake photo/full-board/ranking capability');
assert(LONGITUDINAL_HOMEWORK_PRESSURE_SCENARIOS.length >= 7, 'longitudinal pressure set covers seven subjects with recurrence scenarios');
assert.strictEqual(new Set(LONGITUDINAL_HOMEWORK_PRESSURE_SCENARIOS.map((item) => item.subject)).size, 7, 'longitudinal pressure scenarios cover seven subjects');
assert.strictEqual(longitudinalResults.filter((item) => item.hasEvidenceWindow).length, longitudinalResults.length, 'every longitudinal scenario needs tonight/tomorrow/day-7 evidence');
assert.strictEqual(longitudinalResults.filter((item) => item.localRuleOwned).length, longitudinalResults.length, 'every longitudinal scenario keeps recurrence, mastery release, and reward/share gates local');
assert.strictEqual(longitudinalResults.filter((item) => item.aiExpressionOnly).length, longitudinalResults.length, 'every longitudinal scenario limits AI to phrasing and parent-friendly explanation');
assert.strictEqual(longitudinalResults.filter((item) => item.reportSafe && item.releaseGateSafe).length, longitudinalResults.length, 'every longitudinal scenario blocks overclaiming mastery or long-term diagnosis');
assert.strictEqual(longitudinalResults.filter((item) => item.handoffSafe).length, longitudinalResults.length, 'every longitudinal scenario keeps parent/share handoff safe and non-ranking');

console.log(JSON.stringify(summary, null, 2));
