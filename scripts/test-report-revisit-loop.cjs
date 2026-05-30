#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStorage() {
  const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'storage.js');
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === './learning-priority') return {};
    if (
      id === './learning-report'
      || id === './game-logic'
      || id === './product-readiness'
      || id === './real-homework-coverage'
      || id === './share-relay-schema'
    ) {
      throw new Error(`mocked optional dependency: ${id}`);
    }
    return require(id);
  };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Math
  }, { filename: file });
  return module.exports;
}

const storage = loadStorage();

const scoreReturnQueue = storage.buildReportDailyActionQueue({
  reportState: {
    reportId: 'score_return_unit',
    parsedScores: {
      '\u6570\u5b66': { subject: '\u6570\u5b66', score: 62 },
      '\u82f1\u8bed': { subject: '\u82f1\u8bed', score: 91 },
      '\u7269\u7406': { subject: '\u7269\u7406', score: 58 }
    },
    reportDraft: {
      id: 'score_return_unit',
      recommendationPlan: {
        primaryModule: 'review',
        sevenDayPlan: [
          { day: 1, task: '\u56de\u770b\u6700\u9700\u4fee\u590d\u7684\u9519\u56e0\u5361', module: 'review', path: '/pages/review/review?from=learning_report' },
          { day: 7, task: '\u7b2c 7 \u5929\u505a\u5c0f\u53d8\u5f0f', module: 'review', path: '/pages/review/review?from=learning_report_day7' }
        ]
      }
    },
    solutionMap: { nextEvidenceRequired: ['child_first_step'] }
  }
});
assert(scoreReturnQueue.scoreReportReturnCard, 'score report creates a daily return card');
assert.equal(scoreReturnQueue.scoreReportReturnCard.subject, '\u7269\u7406', 'score report prioritizes the lowest confirmed score subject for revisit');
assert(scoreReturnQueue.scoreReportReturnCard.blockedFields.includes('score') && scoreReturnQueue.scoreReportReturnCard.blockedFields.includes('ranking'), 'score return card blocks score and ranking from share/reward surfaces');
assert(scoreReturnQueue.scoreReportReturnCard.xpGate.includes('score/ranking never drives reward'), 'score return card prevents score-driven XP');
assert(scoreReturnQueue.evidenceLine.includes('wrong_cause_named') && scoreReturnQueue.evidenceLine.includes('next_day_revisit'), 'score return queue requires wrong-cause and next-day revisit evidence');
assert(scoreReturnQueue.route.includes('/pages/review/review'), 'score return queue routes back into review retention');

storage.saveLearningReportState({
  reportId: 'report_revisit_unit',
  reportDraft: {
    id: 'report_revisit_unit',
    recommendationPlan: {
      primaryModule: 'review',
      cta: { path: '/pages/review/review?from=learning_report' },
      sevenDayPlan: [
        { day: 1, task: '先说第一步', module: 'review' },
        { day: 7, task: '第 7 天小变式', module: 'review' }
      ]
    }
  },
  reportStatus: { state: 'ready' },
  reportCompleteness: 55,
  uploadedMaterialDecisionDossier: {
    id: 'uploaded_material_decision_dossier',
    servicePathwaySummary: { validationProgress: 'tonight_action_only' },
    methodCandidateCards: [
      { id: 'visual_first', label: '先看图', day7Evidence: '第 7 天换题验证' },
      { id: 'say_first', label: '先复述', day7Evidence: '第 7 天复述验证' }
    ],
    personalizedLearningSolutionBlueprint: {
      id: 'personalized_learning_solution_blueprint',
      recommendedMode: { id: 'socratic_private_tutor', label: '苏格拉底私教' }
    }
  },
  reportEvidenceReleaseGate: {
    actualLongitudinalEvidence: { nextDayRevisitCount: 0 },
    releaseDecision: 'action_only'
  }
}, { skipBuild: true, connectLoop: false });

const firstEvidence = storage.recordReportRevisitEvidence('report_revisit_unit', {
  status: 'review_completed',
  nextDayRevisit: true,
  firstStep: '先找题目要求比较的量',
  wrongCause: '没有先找基准量',
  parentCheck: '家长只听第一步',
  route: '/pages/review/review'
});

assert.equal(firstEvidence.validationStage, 'method_candidate', 'next-day revisit promotes report to method candidate');
assert.equal(firstEvidence.longTermPortraitRelease, 'blocked_until_day7', 'next-day revisit alone cannot release long-term portrait');
assert.equal(firstEvidence.nextDayRevisitCount, 1, 'next-day revisit count is recorded');

const afterFirst = storage.loadLearningReportState();
assert.equal(afterFirst.uploadedMaterialDecisionDossier.servicePathwaySummary.validationProgress, 'method_candidate', 'uploaded-material pathway summary reflects revisit validation progress');
assert.equal(afterFirst.uploadedMaterialDecisionDossier.methodCandidateCards[0].validationStatus, 'method_candidate', 'primary method candidate receives validation status');
assert.equal(afterFirst.reportEvidenceReleaseGate.actualLongitudinalEvidence.nextDayRevisitCount, 1, 'report evidence release gate receives revisit count');
assert.equal(afterFirst.reportEvidenceReleaseGate.longTermPortraitRelease, 'blocked_until_day7', 'report gate still blocks long-term portrait before day 7');
assert(storage.loadReviewEvents().some((event) => event.event === 'report_revisit_evidence_recorded' && event.validationStage === 'method_candidate'), 'report revisit writes review event');
assert(storage.loadSyncQueue().some((item) => item.type === 'report_revisit_evidence' && item.payload && item.payload.validation_stage === 'method_candidate'), 'report revisit queues sync mutation');

const day7Evidence = storage.recordReportRevisitEvidence('report_revisit_unit', {
  status: 'day7_variant_passed',
  day7VariantResult: '小变式能说第一步',
  parentChecked: true,
  firstStep: '换题后仍先找基准量',
  wrongCause: '基准量稳定'
});

assert.equal(day7Evidence.validationStage, 'day7_candidate', 'day-7 evidence promotes report to day-7 candidate');
assert.equal(day7Evidence.longTermPortraitRelease, 'candidate_after_day7', 'day-7 evidence plus parent check can become portrait candidate');
assert.equal(storage.loadLearningReportState().reportEvidenceReleaseGate.actualLongitudinalEvidence.day7VariantReady, true, 'day-7 readiness is reflected in release gate');

storage.saveLearningReportState({
  reportId: 'report_game_revisit_unit',
  reportDraft: { id: 'report_game_revisit_unit' },
  reportEvidenceReleaseGate: {
    actualLongitudinalEvidence: { nextDayRevisitCount: 0 },
    releaseDecision: 'action_only'
  }
}, { skipBuild: true, connectLoop: false });

const gameLinked = storage.recordGameSessionResult({
  gameType: 'ninety_second_recall',
  total: 4,
  correct: 4,
  accuracy: 100,
  recallEvidence: [{
    child_first_step: '先说题目问什么，再说已知量',
    wrongCause: '急着算完整答案',
    student_first_step: true,
    wrong_cause_named: true,
    next_day_revisit_locked: true
  }],
  activeRecallEvidenceComplete: true,
  nextDayRevisit: true
}, {
  gameType: 'ninety_second_recall',
  parentCheck: '家长只问第一步'
});

assert(gameLinked.reportRevisitEvidence, 'active recall game result links back to report revisit evidence');
assert.equal(gameLinked.reportRevisitEvidence.validationStage, 'method_candidate', 'active recall promotes report to method candidate without releasing long-term portrait');
assert.equal(storage.loadLearningReportState().reportEvidenceReleaseGate.actualLongitudinalEvidence.nextDayRevisitCount, 1, 'active recall increments report revisit count');
assert(storage.loadSyncQueue().some((item) => item.type === 'game_session_result' && item.payload && item.payload.report_revisit_linked === true), 'game session sync payload records report revisit linkage');

const profileJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.js'), 'utf8');
const profileWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxml'), 'utf8');
const reviewJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.js'), 'utf8');
const arcadeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'arcade', 'arcade.js'), 'utf8');

assert(profileJs.includes('reportRevisitEvidence') && profileWxml.includes('报告回访验证'), 'profile exposes report revisit validation state');
assert(reviewJs.includes('recordReportRevisitEvidence') && reviewJs.includes('nextDayRevisit'), 'review completion writes report revisit evidence');
assert(reviewJs.includes('resolveReportRevisitContext') && reviewJs.includes('reportSourceContext.reportId') && reviewJs.includes('evidenceThread.reportId'), 'review report revisit evidence keeps upload/report context even when focus lacks reportId');
assert(reviewJs.includes('readyHandoff') && reviewJs.includes("handoff.status === 'ready'"), 'review tab route can resume upload report handoff even when switchTab drops query');
assert(reviewJs.includes('flowTraceId: reportRevisitContext.flowTraceId'), 'review report revisit evidence preserves flow trace id');
assert(arcadeJs.includes('reportId: reportSourceContext.reportId') && arcadeJs.includes('flowTraceId: reportSourceContext.flowTraceId'), 'arcade game result keeps explicit report and flow trace context');
assert(arcadeJs.includes("gameType: 'ninety_second_recall'") && arcadeJs.includes('flowTraceId: (this.data.reportSourceContext && this.data.reportSourceContext.flowTraceId)'), 'ninety-second recall evidence keeps report flow context');

console.log('All report revisit loop tests pass.');
