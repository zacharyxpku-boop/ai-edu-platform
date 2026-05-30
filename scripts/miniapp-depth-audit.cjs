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

const root = path.join(__dirname, '..');
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
  },
  showToast() {},
  navigateTo() {},
  switchTab() {}
};

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}) {
  const full = path.join(root, filePath);
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      if (request.indexOf('real-homework-pressure-samples.cjs') >= 0) {
        return require('./fixtures/real-homework-pressure-samples.cjs');
      }
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
    RegExp,
    JSON,
    Set
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

function includesAny(text, tokens) {
  const source = String(text || '');
  return tokens.some((token) => token && source.includes(token));
}

function compactHit(source, expected) {
  const compactSource = String(source || '').replace(/[\s，。；、：！？,.!?;:"'“”‘’《》（）()\-=/]+/g, '');
  const compactExpected = String(expected || '').replace(/[\s，。；、：！？,.!?;:"'“”‘’《》（）()\-=/]+/g, '');
  if (!compactExpected) return false;
  if (compactSource.includes(compactExpected)) return true;
  const anchors = [];
  for (let index = 0; index <= compactExpected.length - 4; index += 1) {
    anchors.push(compactExpected.slice(index, index + 4));
  }
  return anchors.some((anchor) => compactSource.includes(anchor));
}

const productReadiness = loadCommonJs(path.join('miniprogram', 'utils', 'product-readiness.js'));
const realHomeworkCoverage = loadCommonJs(path.join('miniprogram', 'utils', 'real-homework-coverage.js'));
const gameLogic = loadCommonJs(path.join('miniprogram', 'utils', 'game-logic.js'));
const learningReport = loadCommonJs(path.join('miniprogram', 'utils', 'learning-report.js'));
const tutorLadder = loadCommonJs(path.join('miniprogram', 'utils', 'tutor-ladder.js'));
const openMaicInspiredPlan = loadCommonJs(path.join('miniprogram', 'utils', 'openmaic-inspired-plan.js'));
const shareRelaySchema = loadCommonJs(path.join('miniprogram', 'utils', 'share-relay-schema.js'));
const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {},
  './share-relay-schema': shareRelaySchema,
  './product-readiness': productReadiness,
  './real-homework-coverage': realHomeworkCoverage
});

const app = JSON.parse(read('miniprogram/app.json'));
const pageToSurface = {
  'pages/home/home': 'home',
  'pages/review/review': 'review',
  'pages/arcade/arcade': 'arcade',
  'pages/entry-detail/entry-detail': 'home',
  'pages/tutor/tutor': 'tutor',
  'pages/profile/profile': 'profile',
  'pages/upload/upload': 'upload',
  'pages/legal/legal': 'legal'
};

assert(Array.isArray(app.pages) && app.pages.length === 8, 'Miniapp must expose only the eight active pages');
const missingSurface = app.pages.filter((page) => !pageToSurface[page]);
assert.strictEqual(missingSurface.length, 0, `Every page needs a product surface mapping: ${missingSurface.join(',')}`);

const surfaceResults = app.pages.map((page) => {
  const surface = pageToSurface[page];
  const pack = storage.buildSurfaceDepthPack(surface);
  assert(pack && pack.primaryRoute && pack.primaryRoute.indexOf('/pages/') === 0, `${surface} has a routeable surface depth pack`);
  assert(Array.isArray(pack.cards) && pack.cards.length >= 3, `${surface} has visible surface cards`);
  assert(Array.isArray(pack.capabilityCards) && pack.capabilityCards.length >= 3, `${surface} has capability ledger cards`);
  return { page, surface, pack };
});

const capabilityLedger = storage.buildCapabilityEvidenceLedger();
const capabilityQueue = storage.buildCapabilityMaturityQueue();
const acceptance = storage.buildAcceptanceReport({ now: new Date('2026-05-19T20:00:00Z') });
const gradeChapterTeachingStrategyMap = storage.buildGradeChapterTeachingStrategyMap();
const gradeChapterStrategyDensityAudit = storage.buildGradeChapterStrategyDensityAudit({ strategyMap: gradeChapterTeachingStrategyMap });
assert(capabilityLedger.rows.length >= 9, 'Capability ledger needs at least nine rows');
assert(capabilityQueue.items.length >= 8, 'Capability maturity queue needs at least eight benchmarked items');
assert(acceptance && acceptance.competitiveGapSummary && acceptance.readinessGateChecklist, 'Acceptance report exposes benchmark and readiness gates');
assert(read('scripts/verify.ps1').includes('Miniapp Depth Audit'), 'Verify script includes Miniapp Depth Audit gate');
assert(gradeChapterTeachingStrategyMap.strategyCount >= 63, 'Grade/chapter teaching strategy map needs at least 63 local strategies');
assert(gradeChapterTeachingStrategyMap.strategies.every((item) => item.answerPolicy === 'first_step_only_no_full_answer' && item.releaseGate.includes('本地代码')), 'Every grade/chapter strategy must stay local-gated and answer-safe');
assert(gradeChapterStrategyDensityAudit.strategyCount >= 63, 'Strategy density audit covers the grade/chapter strategy map');
assert(gradeChapterStrategyDensityAudit.subjectCount >= 7, 'Strategy density audit covers seven subjects');
assert.strictEqual(gradeChapterStrategyDensityAudit.stableStrategyCount, gradeChapterStrategyDensityAudit.strategyCount, 'Every grade/chapter strategy needs first-step, wrong-cause, board, parent, and transfer fields');
assert.strictEqual(gradeChapterStrategyDensityAudit.failureFallbackStrategyCount, gradeChapterStrategyDensityAudit.strategyCount, 'Every grade/chapter strategy needs a local failure fallback gate');
assert(gradeChapterStrategyDensityAudit.sampleBackedStrategyCount >= 63, 'At least 63 grade/chapter strategies need real-homework sample backing');

const sourceIds = new Set(SOURCE_REGISTRY.map((item) => item.id));
assert(REAL_HOMEWORK_PRESSURE_SAMPLES.length >= 464, 'Depth audit requires at least 464 real-homework pressure samples');
assert(NEGATIVE_HOMEWORK_PRESSURE_SAMPLES.length >= 20, 'Depth audit requires negative shortcut/privacy/fake-capability samples');
assert(LONGITUDINAL_HOMEWORK_PRESSURE_SCENARIOS.length >= 7, 'Depth audit requires seven-subject longitudinal pressure scenarios');
assert.strictEqual(new Set(LONGITUDINAL_HOMEWORK_PRESSURE_SCENARIOS.map((item) => item.subject)).size, 7, 'Longitudinal pressure scenarios cover seven subjects');

const pressureResults = REAL_HOMEWORK_PRESSURE_SAMPLES.map((sample) => {
  const reply = tutorLadder.buildTutorReply(`${sample.stem} 我不会第一步，能不能直接告诉我答案？`, {
    selected: { text: sample.stem },
    currentHintLevel: 1
  });
  const signal = reply.real_homework_pressure_signal || {};
  return {
    id: sample.id,
    subject: sample.subject,
    taskType: sample.taskType,
    sourceLinked: sourceIds.has(sample.sourceId),
    taskTypeMatched: reply.task_type === sample.taskType,
    answerBlocked: reply.mastery_signal && reply.mastery_signal.status === 'blocked_answer_request',
    firstStep: signal.firstStep,
    wrongCause: signal.wrongCause,
    boardMove: signal.boardMove,
    parentCheck: signal.parentCheck,
    reviewMove: signal.reviewMove,
    specificFirstStep: compactHit(signal.firstStep, sample.expectedFirstStep),
    specificWrongCause: compactHit(signal.wrongCause, sample.expectedWrongCause),
    specificBoardMove: compactHit(signal.boardMove, sample.expectedBoardMove),
    specificParentCheck: compactHit(signal.parentCheck, sample.parentCheck),
    specificTransfer: compactHit(signal.reviewMove, sample.nearTransfer)
  };
});

const failedPressure = pressureResults.filter((item) => !(
  item.sourceLinked
  && item.taskTypeMatched
  && item.answerBlocked
  && item.specificFirstStep
  && item.specificWrongCause
  && item.specificBoardMove
  && item.specificParentCheck
  && item.specificTransfer
));
assert.strictEqual(failedPressure.length, 0, `Every pressure sample must be source-linked, answer-safe, and sample-specific: ${JSON.stringify(failedPressure.slice(0, 8))}`);

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
  uniqueFirstSteps: uniqueCount(pressureResults, (item) => item.firstStep),
  uniqueWrongCauses: uniqueCount(pressureResults, (item) => item.wrongCause),
  uniqueBoardMoves: uniqueCount(pressureResults, (item) => item.boardMove),
  uniqueParentChecks: uniqueCount(pressureResults, (item) => item.parentCheck),
  topFirstStepRepeatRatio: topRepeatRatio(pressureResults, (item) => item.firstStep),
  topWrongCauseRepeatRatio: topRepeatRatio(pressureResults, (item) => item.wrongCause),
  topBoardMoveRepeatRatio: topRepeatRatio(pressureResults, (item) => item.boardMove),
  topParentCheckRepeatRatio: topRepeatRatio(pressureResults, (item) => item.parentCheck)
};
assert(pseudoThicknessRadar.uniqueFirstSteps >= 180 && pseudoThicknessRadar.uniqueWrongCauses >= 180, 'Pseudo-thickness radar blocks generic first-step and wrong-cause templates');
assert(pseudoThicknessRadar.uniqueBoardMoves >= 160 && pseudoThicknessRadar.uniqueParentChecks >= 160, 'Pseudo-thickness radar blocks generic board and parent templates');
assert(pseudoThicknessRadar.topFirstStepRepeatRatio <= 0.04 && pseudoThicknessRadar.topWrongCauseRepeatRatio <= 0.04, 'Pseudo-thickness radar caps repeated templates');

const threeRoundResults = REAL_HOMEWORK_PRESSURE_SAMPLES.map((sample) => {
  const reply = tutorLadder.buildTutorReply(`${sample.stem} 我不会第一步，能不能直接告诉我答案？`, {
    selected: { text: sample.stem },
    currentHintLevel: 1
  });
  const protocol = reply.three_round_socratic_protocol || {};
  const rounds = Array.isArray(protocol.rounds) ? protocol.rounds : [];
  const text = JSON.stringify(protocol);
  return {
    id: sample.id,
    round1: rounds[0] && rounds[0].coachMove,
    round2: rounds[1] && rounds[1].coachMove,
    round3: rounds[2] && rounds[2].coachMove,
    round1Specific: compactHit(rounds[0] && rounds[0].coachMove, sample.expectedFirstStep),
    round2Specific: compactHit(rounds[1] && rounds[1].coachMove, sample.expectedWrongCause),
    round3Specific: compactHit(rounds[2] && rounds[2].coachMove, sample.parentCheck),
    answerSafe: includesAny(text, ['拒绝捷径', '不展示完整答案', '不传对话全文']) && !includesAny(text, ['答案是', '最终答案', '直接算出', 'therefore the answer'])
  };
});
assert(threeRoundResults.every((item) => item.round1Specific && item.round2Specific && item.round3Specific && item.answerSafe), 'Three-round Socratic protocol stays sample-specific and answer-safe');
assert(uniqueCount(threeRoundResults, (item) => item.round2) >= 180 && topRepeatRatio(threeRoundResults, (item) => item.round2) <= 0.04, 'Three-round Socratic radar blocks repeated round-two templates');

const crossModuleConsistencyResults = REAL_HOMEWORK_PRESSURE_SAMPLES.map((sample) => {
  const reply = tutorLadder.buildTutorReply(`${sample.stem} 我不会第一步，能不能直接告诉我答案？`, {
    selected: { text: sample.stem },
    currentHintLevel: 1
  });
  const signal = reply.real_homework_pressure_signal || {};
  const courseUnitMap = storage.buildCourseUnitMap({ subject: sample.subject });
  const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank({ courseUnitMap });
  const cards = [{
    id: `${sample.id}_wrong_cause_card`,
    question: sample.stem,
    front: sample.stem,
    weakPoint: sample.expectedWrongCause,
    wrongCauseLabel: sample.expectedWrongCause,
    checkpoint: signal.firstStep || sample.expectedFirstStep,
    nextAction: signal.parentCheck || sample.parentCheck,
    next_practice: signal.reviewMove || sample.nearTransfer,
    next_review: '2026-05-18T20:00:00.000Z'
  }];
  const memoryLoop = gameLogic.buildHighFrequencyPracticeLoop(
    { xp: 30, streak: 1 },
    cards,
    [{ type: 'wrong_cause_resurface', key: sample.expectedWrongCause, created_at: '2026-05-18T20:00:00.000Z' }],
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
      courseUnitQuestionBank
    }
  );
  const sharePlan = storage.buildShareChallengePlan({
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
    gameEvidence: memoryLoop ? { highFrequencyPracticeLoop: memoryLoop } : {}
  });
  const reportText = JSON.stringify(report.reportDraft || {});
  const gameText = JSON.stringify(memoryLoop || {});
  const shareCoreText = JSON.stringify({
    wrongCauseViralChallengePack: sharePlan.wrongCauseViralChallengePack,
    wrongCauseReplayPayload: sharePlan.wrongCauseReplayPayload,
    parentDecisionPayload: sharePlan.parentDecisionPayload,
    query: sharePlan.query
  });
  return {
    id: sample.id,
    sameTaskAcrossTutorAndGame: reply.task_type === sample.taskType
      && memoryLoop.realHomeworkPressureMemoryPrescription
      && memoryLoop.realHomeworkPressureMemoryPrescription.reviewQueue
      && memoryLoop.realHomeworkPressureMemoryPrescription.reviewQueue[0]
      && memoryLoop.realHomeworkPressureMemoryPrescription.reviewQueue[0].sampleId === sample.id,
    sameWrongCauseAcrossTutorGameReportShare: compactHit(signal.wrongCause, sample.expectedWrongCause)
      && compactHit(gameText, sample.expectedWrongCause)
      && compactHit(reportText, sample.expectedWrongCause)
      && compactHit(shareCoreText, sample.expectedWrongCause),
    sameFirstStepAcrossTutorGameShare: compactHit(signal.firstStep, sample.expectedFirstStep)
      && compactHit(gameText, sample.expectedFirstStep)
      && compactHit(shareCoreText, sample.expectedFirstStep),
    parentCheckCarriesToShareAndReport: compactHit(signal.parentCheck, sample.parentCheck)
      && compactHit(shareCoreText, sample.parentCheck)
      && includesAny(reportText, ['家长', '只问', '证据', '今晚']),
    noGenericReportForSpecificSample: compactHit(reportText, sample.expectedWrongCause)
      && !includesAny(reportText, ['泛化判断', '无法定位', '样本不足', '默认建议']),
    noGenericShareForSpecificSample: compactHit(shareCoreText, sample.expectedWrongCause)
      && compactHit(shareCoreText, sample.expectedFirstStep)
      && !includesAny(shareCoreText, ['同类错因"}', '同类错因,', '同类错因。', '默认'])
  };
});
const failedConsistency = crossModuleConsistencyResults.filter((item) => !(
  item.sameTaskAcrossTutorAndGame
  && item.sameWrongCauseAcrossTutorGameReportShare
  && item.sameFirstStepAcrossTutorGameShare
  && item.parentCheckCarriesToShareAndReport
  && item.noGenericReportForSpecificSample
  && item.noGenericShareForSpecificSample
));
assert.strictEqual(failedConsistency.length, 0, `Cross-module consistency radar blocks thick-but-inaccurate tutor/game/report/share drift: ${JSON.stringify(failedConsistency.slice(0, 8))}`);

const negativeResults = NEGATIVE_HOMEWORK_PRESSURE_SAMPLES.map((sample) => {
  const reply = tutorLadder.buildTutorReply(sample.input, { selected: {}, currentHintLevel: 1 });
  const text = JSON.stringify(reply);
  return {
    shortcutBlocked: sample.expectBlockedAnswer ? reply.mastery_signal && reply.mastery_signal.status === 'blocked_answer_request' : true,
    forbiddenClean: !(sample.forbiddenTokens || []).some((token) => text.includes(token))
  };
});
assert(negativeResults.every((item) => item.shortcutBlocked && item.forbiddenClean), 'Negative pressure samples block shortcuts and forbidden fields');

const subjectSeedLibrary = storage.buildSubjectSeedLibrary({ subject: 'physics' });
const courseUnitMap = storage.buildCourseUnitMap({ subject: 'physics', subjectSeedLibrary });
const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank({
  courseUnitMap,
  realHomeworkPressureSamples: REAL_HOMEWORK_PRESSURE_SAMPLES
});
const sampleBackedQuestionBankCards = courseUnitQuestionBank.cards.filter((card) => card.sourceBacked && card.sourceSampleId && card.sampleBackedEvidence);
const reviewedPublicAssetCards = courseUnitQuestionBank.cards.filter((card) => card.reviewedPublicAsset);
const courseUnitDepthExpansionAtlas = storage.buildCourseUnitDepthExpansionAtlas({
  courseUnitMap,
  courseUnitQuestionBank
});
const courseUnitQuestionBankPlayableCards = gameLogic.buildCourseUnitQuestionBankPlayableCards(
  courseUnitQuestionBank,
  {
    taskType: 'physics_diagram',
    subject: 'physics',
    firstStep: '先画受力图',
    wrongCauseLabel: '图像关系没建好'
  }
);
const realHomeworkCoverageMatrix = storage.buildRealHomeworkCoverageMatrix({ subject: 'physics' });
const shareChallengePlan = storage.buildShareChallengePlan({
  focus: { title: '关系没标清', issueType: 'math_word_problem', childArticulatedStep: '先圈条件', repairStatus: 'in_progress' },
  capability: { id: 'depth_gap', label: '关系没标清', nextAction: '家长只问对应关系', route: '/pages/review/review' },
  subjectSkillDepth: { label: '数学', firstStep: '先圈条件', parentQuestion: '家长只问对应关系', reportSignal: '关系没标清' }
});
const communityShareRelayBoard = storage.buildCommunityShareRelayBoard({ subjectSkillDepth: { label: '数学', firstStep: '先圈条件' } });
const sampleReport = learningReport.buildLearningReportDraft({
  profileBasics: { grade: '小学高年级' },
  scoreText: '数学: 分数应用题',
  behaviorSignals: { homeworkDelay: '关系没标清', firstStep: '先圈条件' }
});
const openMaicTaskPlan = openMaicInspiredPlan.buildOpenMaicInspiredTaskPlan({
  taskType: 'physics_diagram',
  pressureSignal: {
    taskType: 'physics_diagram',
    firstStep: '先圈研究对象，再标方向和决定量。',
    wrongCause: '只看现象，没有先定决定量。',
    parentCheck: '你先比较哪一个量？方向和单位定了吗？',
    reviewMove: '明天换图，仍先复述对象、方向和决定量。'
  }
});
const openMaicTaskPlanAudit = openMaicInspiredPlan.evaluateOpenMaicInspiredTaskPlan(openMaicTaskPlan);
const openMaicMiniLessonAudit = openMaicInspiredPlan.evaluateThreeMinuteMiniLesson(openMaicTaskPlan.miniLesson);

assert(subjectSeedLibrary.subjectCount >= 7 && subjectSeedLibrary.seedCount >= 21, 'Seven-subject seed library is present');
assert(courseUnitMap.subjectCount >= 7 && courseUnitMap.unitCount >= 21, 'Course unit map is present');
assert(courseUnitQuestionBank.cards.length >= 63, 'Course unit question bank is present');
assert.strictEqual(sampleBackedQuestionBankCards.length, courseUnitQuestionBank.cards.length, 'Every course unit question-bank card must be backed by a real/public pressure sample');
assert(reviewedPublicAssetCards.length >= 7, 'Course unit question bank includes reviewed public curriculum asset cards');
assert(new Set(reviewedPublicAssetCards.map((card) => card.subjectId)).size >= 7, 'Reviewed public curriculum asset cards cover seven subjects');
assert(reviewedPublicAssetCards.every((card) => card.sourceContentPolicy === 'no_source_text_no_source_image_no_source_answer' && card.answerPolicy === 'first_step_only_no_full_answer' && card.blockedFields.includes('full_solution')), 'Reviewed public curriculum assets stay structure-only and answer-safe');
assert(courseUnitQuestionBank.sourceBackedSubjectCount >= 7, 'Sample-backed question-bank cards cover seven subjects');
assert(courseUnitQuestionBank.sourceBackedGradeBandCount >= 3, 'Sample-backed question-bank cards cover multiple grade bands');
assert(courseUnitQuestionBank.sourceBackedTaskTypeCount >= 7, 'Sample-backed question-bank cards cover major task types');
assert(sampleBackedQuestionBankCards.every((card) => card.sampleBackedEvidence.answerPolicy === 'first_step_only_no_full_answer' && card.sourceSampleFirstStep && card.sourceSampleWrongCause && card.sourceSampleBoardMove && card.sourceSampleParentCheck && card.sourceSampleNearTransfer), 'Sample-backed question-bank cards carry first step, wrong cause, board, parent check, transfer, and no-answer policy');
const matchedCourseUnitCards = courseUnitQuestionBank.cards.filter((card) => card.sampleBackedEvidence && card.sampleMatchScore);
assert(matchedCourseUnitCards.length >= 63, 'Course-unit cards carry explicit sample match scores');
assert(matchedCourseUnitCards.every((card) => card.sampleMatchScore >= 75 && card.sampleMatchTier !== 'fallback' && Array.isArray(card.sampleMatchReasons) && card.sampleMatchReasons.length >= 3), 'Course-unit sample matching must be strong enough to avoid weak content routing');
assert(Array.isArray(courseUnitQuestionBank.subjectDepthWeakQueue) && courseUnitQuestionBank.subjectDepthWeakQueue.length >= 21, 'Course-unit question bank exposes a per-unit weak queue');
assert(courseUnitQuestionBank.subjectDepthWeakQueue.every((unit) => Array.isArray(unit.weakCards) && unit.weakCards.length >= 3 && unit.weakCards.every((card) => card.sampleMatchScore >= 75)), 'Every unit weak queue covers recall, wrong-cause, and transfer with scored samples');
assert.strictEqual(courseUnitDepthExpansionAtlas.sourceBackedArchetypeCount, courseUnitDepthExpansionAtlas.archetypeCount, 'Depth atlas must use sample-backed archetypes');
assert(courseUnitQuestionBankPlayableCards.length >= 42, 'Course unit question bank feeds a deeper seven-subject playable arcade deck');
assert(new Set(courseUnitQuestionBankPlayableCards.map((card) => card.subjectId || card.subject)).size >= 7, 'Playable question-bank cards cover seven subjects');
assert(new Set(courseUnitQuestionBankPlayableCards.map((card) => card.wrongCauseBucket || card.type)).size >= 3, 'Playable question-bank cards cover recall, wrong-cause, and transfer modes');
assert(courseUnitQuestionBankPlayableCards.every((card) => card.source === 'course_unit_question_bank' && card.question && card.answer && card.parentPrompt && card.next_practice), 'Playable question-bank cards keep source, first-step, parent, and revisit fields');
assert(
  realHomeworkCoverageMatrix.totalSamples === 0 || realHomeworkCoverageMatrix.totalSamples === REAL_HOMEWORK_PRESSURE_SAMPLES.length,
  'Coverage matrix either loads the fixture-backed sample count or honestly reports unavailable samples'
);
assert(realHomeworkCoverageMatrix.totalHomeworkIntakeQueue >= 14, 'Coverage matrix tracks a public K12 homework intake queue');
assert(realHomeworkCoverageMatrix.totalIntakeChallengeCards >= 14, 'Coverage matrix turns public K12 intake queue into playable challenge cards');
assert(realHomeworkCoverageMatrix.publicK12AssetBoundaryAudit && realHomeworkCoverageMatrix.publicK12AssetBoundaryAudit.ok, 'Public K12 assets pass source/transform/blocked-use boundary audit');
assert(realHomeworkCoverageMatrix.publicK12IntakeChallengeDeck.every((card) => card.observableFirstMove && card.fallbackIfNoChildInput && card.receiverMustUseOwnMaterial && Array.isArray(card.shareSafeFields)), 'Public K12 challenge cards carry first-move, fallback, own-material, and share-safe gates');
assert(realHomeworkCoverageMatrix.publicK12IntakeChallengeDeck.every((card) => card.answerBoundary && card.releaseGate && card.blockedUse && card.blockedUse.length >= 2), 'Public K12 challenge cards block answer-bank behavior');
assert(realHomeworkCoverageMatrix.localAiImplementationRunway && realHomeworkCoverageMatrix.localAiImplementationRunway.moduleCount >= 7, 'K12 local/AI implementation runway covers the full miniapp moat stack');
assert(realHomeworkCoverageMatrix.localAiImplementationRunway.moduleRows.every((row) => row.localCodeOwns.length >= 4 && row.aiBetterFor.length >= 2 && row.acceptanceGate.length >= 4), 'Every runway row separates local code ownership, AI wording, and release gates');
assert(realHomeworkCoverageMatrix.localAiImplementationRunway.blockedClaims.includes('full_ai_classroom') && realHomeworkCoverageMatrix.localAiImplementationRunway.blockedClaims.includes('guaranteed_improvement'), 'Runway blocks classroom drift and guaranteed outcomes');
assert(realHomeworkCoverageMatrix.curriculumAssetSourceAudit && realHomeworkCoverageMatrix.curriculumAssetSourceAudit.ok, 'Unified K12 source registry passes curriculum/textbook/upload rights audit');
assert(realHomeworkCoverageMatrix.totalUnifiedSourceRegistryRows >= realHomeworkCoverageMatrix.totalOpenSourceResources + 4, 'Unified source registry includes public/OER plus textbook, learning asset, generated question, and family upload rows');
assert(realHomeworkCoverageMatrix.unifiedK12SourceRegistry.every((item) => item.originalTextIncluded === false && item.answerVisibility === 'first_step_only_no_full_answer'), 'Unified source registry blocks original text and full-answer visibility');
assert(realHomeworkCoverageMatrix.unifiedK12SourceRegistry.every((item) => item.mustNotSurface.includes('source_question') && item.mustNotSurface.includes('source_answer') && item.mustNotSurface.includes('source_image') && item.mustNotSurface.includes('full_solution') && item.mustNotSurface.includes('answer_key')), 'Unified source registry blocks source questions, answers, images, full solutions, and answer keys');
assert(shareChallengePlan.wrongCauseViralChallengePack && shareChallengePlan.wrongCauseViralChallengePack.hooks.length >= 3, 'Wrong-cause viral share pack is present');
assert(communityShareRelayBoard.wrongCauseViralChallengePack && communityShareRelayBoard.wrongCauseViralChallengePack.receiverSteps.length >= 4, 'Community relay exposes wrong-cause viral pack');
assert(sampleReport.reportDraft.homeworkPressureContext && sampleReport.reportDraft.homeworkPressureContext.wrongCause === '关系没标清', 'Report carries real-homework pressure context');
assert(openMaicTaskPlanAudit.ok, 'OpenMAIC-inspired miniapp task plan passes deterministic audit');
assert(openMaicTaskPlan.sourcePolicy.decision === 'reference_workflow_only' && openMaicTaskPlan.sourcePolicy.forbiddenUses.includes('copy_openmaic_code'), 'OpenMAIC is referenced as workflow only and never copied');
assert(openMaicTaskPlan.scenes.length >= 6 && openMaicTaskPlan.eventFlow.length === openMaicTaskPlan.scenes.length, 'OpenMAIC-inspired task plan has scene event flow');
assert(openMaicTaskPlan.localAiBoundary.localCodeOwns.includes('reward_release') && openMaicTaskPlan.localAiBoundary.localCodeOwns.includes('share_privacy_fields'), 'OpenMAIC-inspired plan keeps rewards and share privacy under local code');
assert(openMaicTaskPlan.localAiBoundary.aiMustNotDecide.includes('final_answer') && openMaicTaskPlan.localAiBoundary.aiMustNotDecide.includes('talent_label'), 'OpenMAIC-inspired plan blocks AI from answers and talent labels');
const openMaicDecisionBridge = openMaicInspiredPlan.buildOpenMaicInspiredDecisionBridge(openMaicTaskPlan);
assert(openMaicDecisionBridge.sourceUseDecision && openMaicDecisionBridge.sourceUseDecision.decision === 'structure_only_clean_room_rewrite', 'OpenMAIC-inspired decision bridge uses clean-room source policy');
assert(openMaicDecisionBridge.sourceUseDecision.blockedUses.includes('copy_public_source_text') && openMaicDecisionBridge.sourceUseDecision.blockedUses.includes('ranking'), 'OpenMAIC-inspired source policy blocks copied public text and rankings');
assert(openMaicDecisionBridge.miniLessonReport.sourceUseDecision && openMaicDecisionBridge.shareRelayPayload.sourceUseDecision && openMaicDecisionBridge.gameReturnEvidence.sourceUseDecision, 'OpenMAIC-inspired source policy flows through report, share, and game return');
assert(openMaicTaskPlan.miniLesson && openMaicMiniLessonAudit.ok, 'OpenMAIC-inspired mini-lesson passes deterministic audit');
assert(openMaicTaskPlan.miniLesson.trigger.blockedMode === 'full_ai_classroom', 'Mini-lesson blocks full classroom mode');
assert(openMaicTaskPlan.miniLesson.localAiBoundary.localCodeOwns.includes('trigger') && openMaicTaskPlan.miniLesson.localAiBoundary.localCodeOwns.includes('exit_gate'), 'Mini-lesson keeps trigger and exit gate under local code');
assert(openMaicTaskPlan.miniLesson.executionContract && openMaicTaskPlan.miniLesson.executionContract.localCodeOwns.includes('portrait_release_gate'), 'Mini-lesson carries a local execution contract for report and portrait release');
assert(Array.isArray(openMaicTaskPlan.miniLesson.recoveryBranches) && openMaicTaskPlan.miniLesson.recoveryBranches.length >= 4, 'Mini-lesson has stuck-state recovery branches');
assert(openMaicInspiredPlan.MINI_LESSON_TOPIC_CARDS.length >= 35, 'Mini-lesson has five topic-level cards across seven subjects');
['math', 'physics', 'chemistry', 'english', 'chinese', 'biology', 'geography'].forEach((subject) => {
  const cards = openMaicInspiredPlan.MINI_LESSON_TOPIC_CARDS.filter((item) => item.subject === subject);
  assert(cards.length >= 5, `Mini-lesson subject ${subject} has five topic cards`);
  assert(new Set(cards.map((item) => item.clusterId)).size >= 2, `Mini-lesson subject ${subject} covers at least two clusters`);
});
assert(new Set(openMaicInspiredPlan.MINI_LESSON_TOPIC_CARDS.map((item) => item.clusterId)).size >= 3, 'Mini-lesson topic cards cover multiple question-type clusters');
assert(openMaicInspiredPlan.MINI_LESSON_TOPIC_CARDS.every((item) => item.clusterId && item.distractorType && Array.isArray(item.exitEvidence) && item.exitEvidence.length >= 4), 'Mini-lesson topic cards carry cluster, distractor, and exit evidence metadata');
assert(openMaicInspiredPlan.MINI_LESSON_VISUAL_TEMPLATES.every((item) => Array.isArray(item.visualPrimitives) && item.visualPrimitives.length >= 3), 'Mini-lesson visual templates carry subject-specific drawing primitives');
const primitiveContractIds = new Set(openMaicInspiredPlan.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.map((item) => item.id));
assert(openMaicInspiredPlan.MINI_LESSON_VISUAL_TEMPLATES.flatMap((item) => item.visualPrimitives || []).every((id) => primitiveContractIds.has(id)), 'Every mini-lesson visual primitive has a local render contract');
assert(openMaicInspiredPlan.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.every((item) => item.owner === 'local_code' && item.aiAllowed === 'rewrite_short_hint_only'), 'Mini-lesson primitive render decisions stay local-code owned');
assert(openMaicTaskPlan.miniLesson.executionContract.visualSchema.renderContractReady, 'Mini-lesson visual schema proves render contract readiness');
assert(openMaicTaskPlan.miniLesson.topicCard && openMaicTaskPlan.miniLesson.topicPractice && openMaicTaskPlan.miniLesson.teacherSchoolBridge, 'Mini-lesson carries topic card, practice gate, and teacher bridge');
assert(Array.isArray(openMaicTaskPlan.miniLesson.blackboard.frames) && openMaicTaskPlan.miniLesson.blackboard.frames.length === 3, 'Mini-lesson blackboard carries renderable frames');
assert(Array.isArray(realHomeworkCoverageMatrix.contentExpansionQueue) && realHomeworkCoverageMatrix.contentExpansionQueue.length >= 7, 'Real homework matrix exposes subject-level content expansion queue');

[
  'parent-report-preview',
  'parent-dash-evidence-grid',
  'tutor-ladder',
  'tutor-entry-card',
  'mini-report-card',
  'upload-material-grid',
  'arcade-map-card',
  'ux-kit-subcheck'
].forEach((needle) => {
  const visible = read('miniprogram/pages/profile/profile.wxml').includes(needle)
    || read('miniprogram/pages/tutor/tutor.wxml').includes(needle)
    || read('miniprogram/pages/home/home.wxml').includes(needle)
    || read('miniprogram/pages/upload/upload.wxml').includes(needle)
    || read('miniprogram/pages/arcade/arcade.wxml').includes(needle);
  assert(visible, `Visible miniapp surface must include ${needle}`);
});

const summary = {
  ok: true,
  pages: app.pages.length,
  surfaces: surfaceResults.length,
  surfaceCards: surfaceResults.reduce((sum, item) => sum + item.pack.cards.length, 0),
  surfaceCapabilityCards: surfaceResults.reduce((sum, item) => sum + item.pack.capabilityCards.length, 0),
  capabilityLedgerRows: capabilityLedger.rows.length,
  capabilityMaturityItems: capabilityQueue.items.length,
  curriculumSubjects: subjectSeedLibrary.subjectCount,
  courseUnitCards: courseUnitMap.unitCount,
  courseUnitQuestionBankCards: courseUnitQuestionBank.cards.length,
  sampleBackedQuestionBankCards: sampleBackedQuestionBankCards.length,
  reviewedPublicAssetCards: reviewedPublicAssetCards.length,
  sampleBackedQuestionBankSubjects: courseUnitQuestionBank.sourceBackedSubjectCount,
  sampleBackedQuestionBankGradeBands: courseUnitQuestionBank.sourceBackedGradeBandCount,
  sampleBackedQuestionBankTaskTypes: courseUnitQuestionBank.sourceBackedTaskTypeCount,
  sampleBackedDepthArchetypes: courseUnitDepthExpansionAtlas.sourceBackedArchetypeCount,
  sampleMatchedQuestionBankCards: matchedCourseUnitCards.length,
  courseUnitWeakQueueRows: Array.isArray(courseUnitQuestionBank.subjectDepthWeakQueue) ? courseUnitQuestionBank.subjectDepthWeakQueue.length : 0,
  courseUnitQuestionBankPlayableCards: courseUnitQuestionBankPlayableCards.length,
  gradeChapterTeachingStrategies: gradeChapterTeachingStrategyMap.strategyCount,
  gradeChapterStableStrategies: gradeChapterStrategyDensityAudit.stableStrategyCount,
  gradeChapterSampleBackedStrategies: gradeChapterStrategyDensityAudit.sampleBackedStrategyCount,
  gradeChapterFallbackStrategies: gradeChapterStrategyDensityAudit.failureFallbackStrategyCount,
  realHomeworkPressureSamples: REAL_HOMEWORK_PRESSURE_SAMPLES.length,
  publicK12HomeworkIntakeQueue: realHomeworkCoverageMatrix.totalHomeworkIntakeQueue,
  publicK12IntakeChallengeCards: realHomeworkCoverageMatrix.totalIntakeChallengeCards,
  publicK12BoundaryReady: realHomeworkCoverageMatrix.publicK12AssetBoundaryAudit.readyCount,
  localAiRunwayModules: realHomeworkCoverageMatrix.totalLocalAiRunwayModules,
  localAiRunwayResourceCoverage: realHomeworkCoverageMatrix.totalLocalAiRunwayResourceCoverage,
  unifiedK12SourceRegistryRows: realHomeworkCoverageMatrix.totalUnifiedSourceRegistryRows,
  curriculumAssetSourceReady: realHomeworkCoverageMatrix.totalCurriculumAssetSourceReady,
  openMaicInspiredScenes: openMaicTaskPlan.scenes.length,
  openMaicInspiredEventFlow: openMaicTaskPlan.eventFlow.length,
  openMaicInspiredQualityGates: openMaicTaskPlan.qualityGate.gates.length,
  openMaicMiniLessonQualityGates: openMaicMiniLessonAudit.gateCount,
  openMaicMiniLessonVisualTemplates: openMaicInspiredPlan.MINI_LESSON_VISUAL_TEMPLATES.length,
  openMaicMiniLessonPrimitiveContracts: openMaicInspiredPlan.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.length,
  openMaicMiniLessonTopicCards: openMaicInspiredPlan.MINI_LESSON_TOPIC_CARDS.length,
  openMaicMiniLessonTopicClusters: new Set(openMaicInspiredPlan.MINI_LESSON_TOPIC_CARDS.map((item) => item.clusterId)).size,
  openMaicPublicK12DecisionRows: openMaicTaskPlan.publicK12ResourceDecisions.length,
  realHomeworkPressureSubjects: new Set(REAL_HOMEWORK_PRESSURE_SAMPLES.map((item) => item.subject)).size,
  realHomeworkPressureSources: SOURCE_REGISTRY.length,
  realHomeworkContentExpansionQueue: realHomeworkCoverageMatrix.totalContentExpansionQueue,
  realHomeworkPressureTaskMatched: pressureResults.filter((item) => item.taskTypeMatched).length,
  realHomeworkPressureSampleSpecific: pressureResults.filter((item) => item.specificFirstStep && item.specificWrongCause && item.specificBoardMove && item.specificParentCheck && item.specificTransfer).length,
  realHomeworkPressureAnswerBlocked: pressureResults.filter((item) => item.answerBlocked).length,
  pseudoThicknessUniqueFirstSteps: pseudoThicknessRadar.uniqueFirstSteps,
  pseudoThicknessUniqueWrongCauses: pseudoThicknessRadar.uniqueWrongCauses,
  threeRoundSocraticUniqueRound2: uniqueCount(threeRoundResults, (item) => item.round2),
  threeRoundSocraticAnswerSafe: threeRoundResults.filter((item) => item.answerSafe).length,
  realHomeworkCrossModuleConsistent: crossModuleConsistencyResults.length - failedConsistency.length,
  negativePressureSamples: NEGATIVE_HOMEWORK_PRESSURE_SAMPLES.length,
  negativePressureShortcutBlocked: negativeResults.filter((item) => item.shortcutBlocked).length,
  wrongCauseViralHooks: shareChallengePlan.wrongCauseViralChallengePack.hooks.length,
  wrongCauseViralReceiverSteps: shareChallengePlan.wrongCauseViralChallengePack.receiverSteps.length,
  wrongCauseViralBlockedFields: shareChallengePlan.wrongCauseViralChallengePack.blockedFields.length,
  externalLaunchBlocked: true
};

console.log(JSON.stringify(summary, null, 2));
