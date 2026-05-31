#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  }
};

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}) {
  const full = path.join(root, filePath);
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
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
  return module.exports;
}

const gameLogic = loadCommonJs('miniprogram/utils/game-logic.js');
const storage = loadCommonJs('miniprogram/utils/storage.js', {
  './learning-priority': {},
  './game-logic': gameLogic,
  './product-readiness': loadCommonJs('miniprogram/utils/product-readiness.js')
});
const tutorLadder = loadCommonJs('miniprogram/utils/tutor-ladder.js');

storage.clearLearningData();

storage.saveTodaySession({
  stuckPointText: '应用题列式卡住',
  taskType: 'math_word_problem',
  taskTypeConfirmed: true,
  tutorCompleted: true,
  childArticulatedStep: '我先圈条件和已知量',
  firstStepQuality: 'actionable',
  focusEvidence: {
    targetStep: '我先圈条件和已知量',
    duration: 900,
    completionType: 'completed',
    actualFocusSeconds: 900
  }
});
const card = storage.generateReviewCard(storage.getTodaySession());
assert.strictEqual(card.taskType, 'math_word_problem', 'review card keeps taskType');
assert(card.wrongCauseBucket, 'review card gets an organization bucket');
assert(card.repairPlan && card.repairPlan.includes('我先圈条件'), 'review card has concrete repair plan');

let queue = storage.loadSyncQueue();
assert(queue.some((item) => item.type === 'today_session'), 'todaySession writes a sync mutation');
assert(queue.some((item) => item.type === 'review_cards_snapshot'), 'review cards write a sync snapshot mutation');
assert(queue.some((item) => item.type === 'learning_state_snapshot'), 'review card generation queues a learning snapshot');

const snapshot = storage.queueLearningSyncSnapshot('production_hardening_test');
assert(snapshot.todaySession && snapshot.reviewCards && snapshot.gameProfile, 'learning snapshot contains loop state');

const backup = storage.createLocalBackup('before_manual_clear_test');
assert(backup.todaySession.childArticulatedStep, 'local backup contains the first step before clearing');
storage.clearLearningData();
const backupKey = `${storage.getLocalUserId()}:${storage.KEYS.localBackup}`;
assert(Array.isArray(storageMap[backupKey]) && storageMap[backupKey].length >= 1, 'clearLearningData preserves a local backup');

const rounds = tutorLadder.simulateThreeRoundSocratic([
  '直接告诉我答案',
  '我不会下一步怎么写',
  '我先圈条件和已知量'
], { selected: { text: '分数应用题' } });
assert.strictEqual(rounds.length, 3, 'three-round Socratic simulation returns three turns');
assert(rounds[0].directAnswerBlocked, 'direct answer request is blocked in round one');
assert(rounds.every((item) => item.noFinalAnswer), 'Socratic rounds do not leak a final answer');
assert(rounds.some((item) => item.asksForStudentStep), 'Socratic rounds keep asking for the student step');
storage.appendThinkingReceipt({
  score: 84,
  diagnostic_probe: { prompt: '先圈哪个条件？', goal: 'find_known_conditions' },
  transfer_prompt: '换一道同类题也先圈条件。',
  checks: [
    { id: 'first', done: true },
    { id: 'cause', done: true },
    { id: 'safe', done: true }
  ]
});
const thinkingSummary = storage.thinkingReceiptSummary();
assert.strictEqual(thinkingSummary.diagnosticProbes, 1, 'thinking summary counts diagnostic probes');
assert.strictEqual(thinkingSummary.transferPrompts, 1, 'thinking summary counts transfer prompts');

storage.clearLearningData();
storage.saveTodayFocusFromThought('数学应用题不会列式，先找条件', { source: 'daily_quest_signal_test' });
storage.saveChildArticulatedStep('我先圈条件和已知量');
let questProfile = storage.loadGameProfile();
assert.strictEqual(Number(questProfile.first_step_count || 0), 1, 'child first-step confirmation feeds daily quest progress');
storage.recordFocusSessionEvidence({
  focusTarget: { title: '我先圈条件和已知量', targetSource: 'child_articulated' },
  completionType: 'completed',
  completedSeconds: 900
});
questProfile = storage.loadGameProfile();
assert.strictEqual(Number(questProfile.focus_rounds_today || 0), 1, 'completed focus round feeds daily quest progress');
const learningQuestSet = gameLogic.buildDailyQuestSet(questProfile, [], [], { now: new Date() });
assert(learningQuestSet.quests.some((item) => item.id === 'quest_first_step' && item.progress === 1), 'daily quest sees confirmed first step from real storage signal');
assert(learningQuestSet.quests.some((item) => item.id === 'quest_focus_round' && item.progress === 1), 'daily quest sees completed focus round from real storage signal');

const beforeGame = storage.loadGameProfile();
const gameResult = storage.recordGameSessionResult({
  gameType: 'whack',
  total: 4,
  correct: 4,
  accuracy: 100,
  activeRecallEvidenceComplete: true,
  recallEvidence: [{ student_first_step: true, wrong_cause_named: true, next_day_revisit_locked: true }]
}, { now: new Date('2026-05-15T20:00:00Z'), gameType: 'whack' });
assert(Number(gameResult.profile.streak || 0) >= Number(beforeGame.streak || 0), 'game completion updates retention streak');
assert((gameResult.profile.achievements || []).includes('first_review'), 'game completion can unlock a real achievement');
assert.strictEqual(Number(gameResult.profile.reviewed_today || 0), 4, 'game completion writes reviewed_today for adaptive quests');
assert.strictEqual(Number(gameResult.profile.correct_today || 0), 4, 'game completion writes correct_today for adaptive precision');
assert.strictEqual(Number(gameResult.profile.evidence_return_count || 0), 1, 'active recall evidence completion feeds evidence-return quest progress');
const nextQuestSet = gameLogic.buildDailyQuestSet(gameResult.profile, [
  { id: 'daily_counter_card', weakPoint: '列式', next_review: '2026-05-15T00:00:00.000Z' }
], [], { now: new Date('2026-05-15T20:00:00Z') });
assert(nextQuestSet.quests.some((item) => item.id === 'quest_arcade_precision' && item.progress === 100), 'daily counters feed the next adaptive quest set');
const nextDayResult = storage.recordGameSessionResult({
  gameType: 'quiz',
  total: 2,
  correct: 1,
  accuracy: 50
}, { now: new Date('2026-05-16T20:00:00Z'), gameType: 'quiz' });
assert.strictEqual(Number(nextDayResult.profile.reviewed_today || 0), 2, 'daily reviewed counter resets on a new local game day');
assert.strictEqual(Number(nextDayResult.profile.correct_today || 0), 1, 'daily correct counter resets on a new local game day');
assert.notStrictEqual(nextDayResult.profile.last_study_date, '2026-05-16', 'short game without active recall evidence does not extend streak');
const volumeOnlyResult = storage.recordGameSessionResult({
  gameType: 'quiz',
  total: 4,
  correct: 4,
  accuracy: 100,
  streakEligible: true
}, { now: new Date('2026-05-16T20:05:00Z'), gameType: 'quiz' });
assert.notStrictEqual(volumeOnlyResult.profile.last_study_date, '2026-05-16', 'volume-only review does not extend streak without first-step/wrong-cause/revisit evidence');
assert.strictEqual(Number(volumeOnlyResult.profile.evidence_return_count || 0), 0, 'volume-only review does not count as evidence return');
const blockedXpResult = storage.recordGameSessionResult({
  gameType: 'whack',
  total: 1,
  correct: 1,
  accuracy: 100,
  xp: 10
}, { now: new Date('2026-05-16T20:10:00Z'), gameType: 'whack' });
assert(blockedXpResult.xpRelease && blockedXpResult.xpRelease.blocked, 'game XP stays pending when first-step/wrong-cause/revisit evidence is incomplete');
const releasedXpResult = storage.recordGameSessionResult({
  gameType: 'whack',
  total: 1,
  correct: 1,
  accuracy: 100,
  xp: 10,
  recallEvidence: [{
    student_first_step: true,
    wrong_cause_named: true,
    next_day_revisit_locked: true
  }]
}, { now: new Date('2026-05-16T20:20:00Z'), gameType: 'whack' });
assert.strictEqual(releasedXpResult.xpRelease.accepted, 10, 'game XP releases only after first-step, wrong-cause, and revisit evidence');
const courseProgress = storage.recordCourseUnitProgress({
  cardId: 'course-card-1',
  unitId: 'math-unit-1',
  firstStep: '先圈条件',
  wrongCause: '等量关系',
  nextDayRevisit: '明天回看一张卡'
});
assert.strictEqual(courseProgress.status, 'needs_near_transfer', 'course progress writes evidence but waits for near-transfer before mastery');

storage.saveTodaySession({
  date: '2026-05-13',
  childArticulatedStep: '第一晚先读题',
  firstStepQuality: 'actionable',
  focusEvidence: { duration: 300, completionType: 'completed' }
}, { now: '2026-05-13 20:00' });
storage.generateReviewCard(storage.getTodaySession({ now: '2026-05-13 20:00' }));
storage.saveTodaySession({
  date: '2026-05-14',
  childArticulatedStep: '第二晚先圈条件',
  firstStepQuality: 'actionable',
  focusEvidence: { duration: 420, completionType: 'completed' }
}, { now: '2026-05-14 20:00' });
storage.generateReviewCard(storage.getTodaySession({ now: '2026-05-14 20:00' }));
storage.saveTodaySession({
  childArticulatedStep: '第三晚先找等量关系',
  firstStepQuality: 'actionable',
  focusEvidence: { duration: 600, completionType: 'completed' }
});
const summary = storage.buildRecentLearningSummary();
assert(summary.threeNightText.includes('最近 3 晚'), 'profile summary is based on real 3-night records');
assert(summary.sevenNightText.includes('7 晚'), 'profile has an honest 7-night readiness line');
const transferSet = storage.buildTransferPracticeSet({
  taskType: 'math_word_problem',
  childArticulatedStep: '先圈条件和问题句',
  wrongCauseBucket: 'reading_conditions',
  wrongCauseLabel: '审题条件'
});
assert.strictEqual(transferSet.noFinalAnswer, true, 'transfer practice set keeps the no-final-answer boundary');
assert.strictEqual(transferSet.prompts.length, 3, 'transfer practice set gives near, far, and teach-back prompts');
assert(transferSet.nextEvidenceRequired.includes('child_explains_back'), 'transfer practice asks for teach-back evidence');
const reflectionReceipt = storage.recordParentReflectionReceipt({
  childArticulatedStep: '先圈条件和问题句',
  parentAskedOneQuestion: true,
  childRecalledFirstStep: true,
  nextDayRevisit: true
});
const reflectionSummary = storage.buildParentReflectionSummary();
assert(reflectionReceipt.parentAskedOneQuestion && reflectionSummary.ready, 'parent reflection receipt closes the parent-child follow-up loop');
const transferAttemptCard = storage.recordTransferPracticeAttempt({
  promptId: 'teach_back',
  result: 'child_explained_back',
  childExplanation: '这类题先圈条件。',
  parentChecked: true
});
assert(transferAttemptCard.transferPracticeStatus.readyForParentTeachBack, 'transfer practice attempt writes teach-back status back to the review card');
const weeklyPattern = storage.buildWeeklyPatternSynthesis();
assert(weeklyPattern.ready && weeklyPattern.intervention, 'weekly pattern synthesis turns repeated evidence into an intervention');
const decisionPath = storage.buildLearningDecisionPath();
assert(decisionPath.route && decisionPath.action && decisionPath.reason, 'learning decision path gives a concrete next action from current evidence');
const routeBias = storage.buildEvidenceRouteBias({
  incomingShare: {
    code: 'family_card_001',
    parent_next_action: 'wrong_cause_revisit',
    action_label: 'wrong-cause revisit',
    action_detail: 'ask the child to say the first step on this card'
  }
});
assert.strictEqual(routeBias.source, 'incoming_share', 'incoming family card becomes the active route source');
assert.strictEqual(routeBias.nextRoute, '/pages/review/review', 'incoming wrong-cause card routes back to review');
assert.strictEqual(routeBias.gameModeBias, 'repair', 'incoming wrong-cause card biases the next game toward repair');
const unifiedFromShare = storage.buildUnifiedNextActionController({
  incomingShare: {
    code: 'family_card_002',
    parent_next_action: 'wrong_cause_revisit',
    action_label: 'wrong-cause revisit',
    action_detail: 'ask the child to say the first step on this card'
  }
});
assert.strictEqual(unifiedFromShare.source, 'incoming_share', 'unified controller prioritizes incoming share evidence');
assert.strictEqual(unifiedFromShare.route, '/pages/review/review', 'unified controller routes incoming share evidence to a real review page');
assert(unifiedFromShare.candidates.some((item) => item.source === 'decision_path'), 'unified controller keeps decision-path candidate visibility');
const unifiedFromReport = storage.buildUnifiedNextActionController({
  reportDailyActionQueue: {
    ready: true,
    active: { task: '今天只复述一个错因', route: '/pages/profile/profile' },
    parentLine: '家长只问这一句',
    evidenceLine: 'report_daily_action_ready'
  },
  evidenceBias: { source: 'global_evidence' },
  learningDecisionPath: { route: '/pages/tutor/tutor', action: '先说第一步', reason: 'fallback decision' },
  learningQuestArc: { currentActionLabel: '打一小局', currentBody: '轻练习' },
  moduleFlowCompass: { currentRoute: '/pages/review/review', currentNextAction: '清一张卡', currentEvidence: 'due card' }
});
assert.strictEqual(unifiedFromReport.source, 'report_daily_action', 'unified controller prioritizes ready report daily action over lower-priority candidates');
assert.strictEqual(unifiedFromReport.route, '/pages/profile/profile', 'report daily action routes to a safe real page');
assert(unifiedFromReport.candidates.some((item) => item.source === 'quest_arc') && unifiedFromReport.candidates.some((item) => item.source === 'module_flow'), 'unified controller keeps quest and module candidates visible');
const unifiedFromUnsafeRoute = storage.buildUnifiedNextActionController({
  reportDailyActionQueue: { ready: false },
  evidenceBias: { source: 'global_evidence' },
  learningDecisionPath: { route: '/pages/private/answer-bank', action: 'unsafe route', reason: 'should normalize' },
  surfaceDepthPack: { primaryRoute: '/pages/home/home', nextAction: 'fallback route', summary: 'safe fallback' }
});
assert.strictEqual(unifiedFromUnsafeRoute.route, '/pages/tutor/tutor', 'unified controller normalizes unsafe routes to the tutor fallback');
const unifiedReceipt = storage.recordUnifiedNextAction(unifiedFromShare);
assert.strictEqual(unifiedReceipt.event, 'unified_next_action', 'unified next action writes its own execution receipt');
const unifiedEvidenceBrief = storage.buildGlobalEvidenceBrief();
assert(unifiedEvidenceBrief.cards.some((item) => item.id === 'unified_action' && item.ready), 'global evidence brief includes unified next-action execution evidence');
const masteryRubric = storage.buildMasteryRubric();
assert(masteryRubric.readyCount >= 3 && masteryRubric.levels.some((item) => item.id === 'near_transfer' && item.ready), 'mastery rubric grades first-step, diagnosis, transfer, teach-back, and recall layers');
const interventionPlaybook = storage.buildInterventionPlaybook();
assert(interventionPlaybook.ready && interventionPlaybook.actions.length >= 4, 'intervention playbook turns pattern and mastery evidence into a concrete action plan');
storage.recordOutcomeCheck({
  masteryStage: masteryRubric.stage,
  childCanExplain: true,
  transferWorked: true,
  nextDayRemembered: true,
  parentVerified: true
});
const outcomeSummary = storage.buildOutcomeReviewSummary();
assert(outcomeSummary.ready && outcomeSummary.success >= 1, 'outcome review verifies explain-transfer-next-day success');

storage.saveLearningReportState({
  reportDraft: {
    id: 'readiness_report_1',
    mode: 'full',
    diagnosisMatrix: [{
      subject: '数学',
      status: '需要支持',
      mainCause: '知识点断层',
      evidence: ['数学 82']
    }],
    recommendationPlan: {
      primaryModule: 'review',
      cta: { label: '去修错因卡', path: '/pages/review/review', reason: '当前主因更像知识点断层' },
      sevenDayPlan: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, minutes: 15, module: day === 1 ? 'review' : 'focus', task: `第 ${day} 天小任务`, path: '/pages/review/review' }))
    }
  },
  reportProgress: { mode: 'full', completeness: 88 },
  reportCompleteness: 88,
  reportStatus: { state: 'ready', requiresConfirmation: false },
  solutionMap: {
    appHandoff: { module: 'review', path: '/pages/review/review', reason: 'local loop handoff' },
    parentScript: '今晚只问错因卡第一步',
    childScript: '我先说出第一步',
    nextEvidenceRequired: ['child_first_step', 'wrong_cause_card', 'next_day_revisit'],
    reviewTrigger: '7 天后补一次新错题'
  },
  recommendationPlan: {
    primaryModule: 'review',
    cta: { label: '去修错因卡', path: '/pages/review/review', reason: '当前主因更像知识点断层' },
    sevenDayPlan: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, minutes: 15, module: day === 1 ? 'review' : 'focus', task: `第 ${day} 天小任务`, path: '/pages/review/review' }))
  }
}, { skipBuild: true, now: new Date('2026-05-15T20:00:00Z') });
const connectedFocus = storage.loadTodayFocus();
const connectedSession = storage.buildLearningSyncSnapshot('after_report_solution_test').todaySession;
assert(connectedFocus.nextPracticePlan.nextEvidenceRequired.includes('wrong_cause_card'), 'learning report solution map is carried into today focus evidence plan');
assert(connectedSession.recommendationPlan.nextEvidenceRequired.includes('next_day_revisit'), 'learning report solution map is carried into today session handoff');
storage.saveTodaySession({
  childArticulatedStep: '先回看数学的一张错因卡',
  firstStepQuality: 'actionable',
  gamePlayed: true,
  gameEvidence: { score: 80, completed: true },
  parentRecapViewed: true
});
storage.recordLightFeatureFirstStep('daily_math', {
  childArticulatedStep: '先看清符号，再算第一步',
  systemSuggestedStep: '先看清符号',
  childStepQuality: 'actionable',
  stuckPointText: '口算容易漏看符号'
});
storage.appendShareRun({
  code: 'family_card_readiness',
  title: '今晚家庭行动卡',
  path: '/pages/home/home?share=family_card_readiness&action=first_step_revisit',
  payload: {
    share_intent: 'parent_recap',
    parent_next_action: 'first_step_revisit',
    action_label: '明天继续说出第一步'
  }
});
storage.saveIncomingShare({
  code: 'receiver_relay_readiness',
  relay_first_step: '用自己的错题先说第一步',
  wrong_cause_label: '条件漏看',
  relay_receiver_action: '用自己的材料复刻同类第一步',
  relay_parent_check: '家长只听第一步',
  relay_next_revisit: '明天回访同一错因'
});
const receiverCompletion = storage.recordShareRelayCompletion({
  firstStep: '我先圈出已知条件',
  wrongCause: '条件漏看',
  receiverMaterial: '自己的错题本',
  nextRevisit: '明天回访同一错因',
  evidence: 'receiver_first_step_unit_test'
});
assert(receiverCompletion && receiverCompletion.type === 'share_relay_receiver_completion', 'receiver completion writes to shareRuns');
assert(storage.loadReviewEvents().some((item) => item.type === 'share_relay_receiver_completion'), 'receiver completion also writes review event evidence');
storage.recordLocalAnalytics('core_loop_entered');
storage.queueLearningSyncSnapshot('readiness_test');
const readiness = storage.buildProductReadiness({ now: new Date('2026-05-15T20:00:00Z') });
assert(readiness.score >= 85, 'product readiness evaluator returns high local readiness after full loop evidence');
assert.strictEqual(readiness.friendTrialReady, true, 'product readiness marks friend trial ready when local dimensions pass');
assert(readiness.dimensions.every((item) => item.ready), 'all local readiness dimensions are backed by evidence');
assert(readiness.workflow.includes('learning_report_solution'), 'readiness workflow includes report-to-solution closure');
assert(readiness.workflow.includes('learning_depth_map'), 'readiness workflow includes multi-layer learning depth');
assert(readiness.workflow.includes('weekly_pattern') && readiness.workflow.includes('next_best_action'), 'readiness workflow includes pattern-to-decision closure');
const depthMap = storage.buildLearningDepthMap({ now: new Date('2026-05-15T20:00:00Z') });
assert(depthMap.depthScore >= 80 && depthMap.readyCount >= 5, 'learning depth map passes after the full local evidence chain');
assert(depthMap.dimensions.some((item) => item.id === 'parent_coaching' && item.ready), 'learning depth map includes parent coaching depth');
assert(depthMap.dimensions.some((item) => item.id === 'practice_feedback' && item.ready), 'learning depth map includes practice feedback depth');
assert(depthMap.dimensions.some((item) => item.id === 'weekly_pattern' && item.ready), 'learning depth map includes weekly pattern synthesis');
assert(depthMap.dimensions.some((item) => item.id === 'decision_path' && item.ready), 'learning depth map includes next-action decisioning');
assert(depthMap.dimensions.some((item) => item.id === 'mastery_rubric' && item.ready), 'learning depth map includes mastery rubric');
assert(depthMap.dimensions.some((item) => item.id === 'intervention_playbook' && item.ready), 'learning depth map includes intervention playbook');
assert(depthMap.dimensions.some((item) => item.id === 'outcome_review' && item.ready), 'learning depth map includes outcome review');
assert(readiness.externalBlockers.some((item) => item.id === 'real_appid' && item.blockingLaunch), 'readiness still separates external AppID blocker');
assert(readiness.externalBlockers.some((item) => item.id === 'production_ai_provider'), 'readiness still separates production AI/API blocker');
assert(readiness.gaps.length === 0, 'no local readiness gaps remain after full evidence chain');
const acceptance = storage.buildAcceptanceReport({ now: new Date('2026-05-15T20:00:00Z') });
assert.strictEqual(acceptance.overallConclusion, 'conditional_pass', 'acceptance report passes local code while separating external launch blockers');
assert.strictEqual(acceptance.friendTrialReady, true, 'acceptance report marks local friend trial ready');
assert.strictEqual(acceptance.commercialCodeReady, true, 'acceptance report marks local commercial code ready');
assert(acceptance.storyLoop.includes('learning_report_solution'), 'acceptance report includes the report-to-solution story loop');
assert(acceptance.competitiveGapSummary.every((item) => item.status === 'ready'), 'acceptance report compares mature capability dimensions against local evidence');
assert(acceptance.functionalityChecklist.every((item) => item.status === 'implemented'), 'acceptance report has no local pseudo-function entries after full loop evidence');
assert(acceptance.moduleFlowMap.every((item) => item.status === 'closed'), 'acceptance report confirms each module handoff is closed');
assert(acceptance.moduleFlowMap.some((item) => item.id === 'report_to_plan' && item.output === 'review_card_and_seven_day_plan'), 'acceptance report checks report-to-plan module flow');
assert(acceptance.moduleFlowMap.some((item) => item.id === 'weekly_pattern_to_next_action' && item.status === 'closed'), 'acceptance report checks weekly-pattern-to-next-action flow');
assert(acceptance.moduleFlowMap.some((item) => item.id === 'mastery_to_intervention' && item.status === 'closed'), 'acceptance report checks mastery-to-intervention flow');
assert(acceptance.userTrialSimulation.every((item) => item.zeroHelpReady), 'acceptance report simulates zero-help friend trial scenarios');
assert(acceptance.userTrialSimulation.some((item) => item.id === 'weak_network_return_visit'), 'acceptance report covers weak-network return visit');
assert(acceptance.userTrialSimulation.some((item) => item.id === 'parent_weekly_decision'), 'acceptance report covers parent weekly decision scenario');
assert(acceptance.userTrialSimulation.some((item) => item.id === 'parent_mastery_intervention'), 'acceptance report covers parent mastery intervention scenario');
assert.strictEqual(acceptance.pseudoFunctionScan.allDisplayedLocalFunctionsBackedByEvidence, true, 'acceptance report scans for local pseudo-functions');
assert.strictEqual(acceptance.pseudoFunctionScan.localPseudoFunctions.length, 0, 'acceptance report has no local pseudo-function after full evidence chain');
assert(acceptance.competitiveMaturityDelta.every((item) => item.localStatus === 'local_ready'), 'acceptance report quantifies maturity deltas with no local gap');
assert(acceptance.competitiveMaturityDelta.some((item) => item.gapLevel === 'external_only'), 'acceptance report marks remaining competitive gap as external-only');
assert(acceptance.readinessGateChecklist.filter((item) => item.id !== 'external_launch_config_clear').every((item) => item.passed), 'all local launch gates pass');
assert(acceptance.readinessGateChecklist.some((item) => item.id === 'external_launch_config_clear' && !item.passed), 'external launch config gate remains explicit');
assert.strictEqual(acceptance.iterationBoundary.canContinueLocally, true, 'acceptance report still has high-leverage local stretch work');
assert(['local_acceptance_gaps_remain', 'high_leverage_local_stretch_until_external_boundary'].includes(acceptance.iterationBoundary.stopReason), 'iteration boundary now points to local gaps or local stretch before external-only work');
assert(Array.isArray(acceptance.iterationBoundary.localStretchBacklog) && acceptance.iterationBoundary.localStretchBacklog.some((item) => item.id === 'k12_content_system_scale'), 'iteration boundary exposes local stretch backlog');
assert(acceptance.iterationBoundary.localStretchBacklog.some((item) => item.id === 'parent_talent_decision_report'), 'iteration boundary keeps parent decision report stretch visible');
assert(acceptance.competitiveMoatBoard && acceptance.competitiveMoatBoard.id === 'competitive_moat_board', 'acceptance report exposes a competitive moat board');
assert(acceptance.competitiveMoatBoard.rows.some((item) => item.id === 'k12_content_system_scale'), 'competitive moat board tracks K12 content depth');
assert(acceptance.competitiveMoatBoard.rows.some((item) => item.id === 'gizmo_level_daily_play'), 'competitive moat board tracks Gizmo-level daily play');
assert(acceptance.competitiveMoatBoard.rows.some((item) => item.id === 'parent_talent_decision_report'), 'competitive moat board tracks parent/talent decision report');
assert(acceptance.competitiveMoatBoard.rows.some((item) => item.id === 'community_safe_share_relay'), 'competitive moat board tracks safe community share relay');
assert(acceptance.workflowBreakpoints.every((item) => item.status === 'normal'), 'acceptance report has no local workflow breakpoints after full loop evidence');
assert(acceptance.technicalBreakpoints.some((item) => item.id === 'real_appid' && item.status === 'external_config_required'), 'acceptance report keeps AppID as an external launch blocker');
assert(acceptance.fixPriorityQueue.some((item) => item.priority === 'P0_EXTERNAL' && item.id === 'production_ai_provider'), 'acceptance report keeps production AI/API as external P0');

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const reviewJs = read('miniprogram/pages/review/review.js');
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');
const storageJs = read('miniprogram/utils/storage.js');
const gameLogicJs = read('miniprogram/utils/game-logic.js');
const apiJs = read('miniprogram/utils/api.js');
const sessionApi = read('api/mini/session.js');
const tutorApi = read('api/mini/tutor-message.js');
assert(profileJs.includes('buildRecentLearningSummary'), 'profile page reads real 3/7-night summary');
assert(!profileWxml.includes('threeNightSummary') && !profileWxml.includes('sevenNightSummary') && profileWxml.includes('yd-parent-sources'), 'profile page keeps real summaries in logic without rendering dense summary panels');
assert(storageJs.includes('function recordGameSessionResult') && storageJs.includes('activeRecallEvidenceComplete') && storageJs.includes('evidence_return_count'), 'storage owns game retention evidence and evidence-return counters');
assert(storageJs.includes('getTodaySession') && storageJs.includes('gamePlayed'), 'today-session persistence still tracks completed review/game evidence');
assert(gameLogicJs.includes('quest_arcade_precision') && gameLogicJs.includes('rewardXp'), 'adaptive quest logic still converts review precision into a reward-gated quest');
assert(reviewJs.includes('finishQuizAttempt') && reviewJs.includes('source: \'review_quiz\''), 'review owns active-recall quiz completion and sync evidence');
assert(reviewJs.includes('reviewCards.reviewCard') && reviewJs.includes('source: \'review_grade\''), 'review owns card grading evidence after retiring the playable arcade page');
assert(arcadeJs.includes("wx.switchTab({ url: '/pages/review/review' })") && arcadeJs.includes('legacy_arcade_redirect'), 'legacy arcade page is a redirect shell into review');
assert(arcadeWxml.includes('旧入口已合并到复习岛') && arcadeWxml.includes('data-scene="review"') && arcadeWxml.includes('data-scene="tutor"') && arcadeWxml.includes('data-scene="parent"'), 'legacy arcade shell exposes only current review/tutor/parent exits');
assert(!arcadeJs.includes('canPlayGameAction') && !arcadeJs.includes('recordGameSessionResult') && !arcadeWxml.includes('arcade-map-card') && !arcadeWxml.includes('arcade-stats-grid'), 'legacy arcade shell does not retain retired playable arcade implementation');
assert(apiJs.includes('saveClientIdentity') && sessionApi.includes('openid_hash'), 'account/session path stores cloud identity when available');
assert(tutorApi.includes('sanitizeTutorReply'), 'tutor API sanitizes upstream model replies');
assert(tutorApi.includes('replyLooksLikeDirectAnswer'), 'tutor API detects direct-answer leakage');
assert(tutorApi.includes('output_sanitized'), 'tutor API reports when unsafe model output was sanitized');

console.log('All production hardening tests pass.');
