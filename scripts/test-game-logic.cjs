#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMiniappGameLogic() {
  const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'game-logic.js');
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console
  }, { filename: file });
  return module.exports;
}

function loadCommonJsMiniappModule(relativePath) {
  const file = path.join(__dirname, '..', relativePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request.startsWith('.')) return require(path.resolve(path.dirname(file), request));
    return require(request);
  };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Array,
    Object,
    JSON,
    encodeURIComponent
  }, { filename: file });
  return module.exports;
}

const game = loadMiniappGameLogic();
const realHomeworkCoverage = loadCommonJsMiniappModule('miniprogram/utils/real-homework-coverage.js');

let failed = 0;

function pass(label) {
  console.log(`  ok ${label}`);
}

function fail(label, error) {
  failed += 1;
  console.error(`  fail ${label}: ${error && error.message ? error.message : error}`);
}

console.log('case 1: XP and level');
try {
  assert.equal(game.calculateXP('new_card'), 10);
  assert.equal(game.calculateXP('quiz_correct'), 20);
  assert.equal(game.calculateXP('daily_review_complete'), 30);
  assert.equal(game.calculateXP('quiz_correct', 2), 40);
  const zeroLevel = game.getLevel(0);
  assert.equal(zeroLevel.level, 0);
  assert.equal(zeroLevel.currentXp, 0);
  assert.equal(zeroLevel.nextLevelXp, 100);
  assert.equal(zeroLevel.progress, 0);
  const level = game.getLevel(900);
  assert.equal(level.level, 3);
  assert.equal(level.title, '稳步掌握');
  assert.equal(level.progress, 0);
  pass('XP rewards and sqrt level formula');
} catch (error) {
  fail('XP and level', error);
}

console.log('case 2: SM-2 scheduling');
try {
  const base = {
    repetitions: 0,
    interval: 0,
    ease_factor: 2.5,
    next_review: '2026-05-01T00:00:00.000Z',
    last_review: ''
  };
  const remembered = game.applySM2(base, 'remembered', new Date('2026-05-01T00:00:00.000Z'));
  assert.equal(remembered.repetitions, 1);
  assert.equal(remembered.interval, 1);
  assert.equal(remembered.ease_factor, 2.6);
  assert.equal(remembered.next_review, '2026-05-02T00:00:00.000Z');

  const fuzzy = game.applySM2({ repetitions: 3, interval: 10, ease_factor: 2.4 }, 'fuzzy', new Date('2026-05-01T00:00:00.000Z'));
  assert.equal(fuzzy.repetitions, 3);
  assert.equal(fuzzy.interval, 5);
  assert.equal(fuzzy.ease_factor, 2.25);

  const forgotten = game.applySM2({ repetitions: 4, interval: 20, ease_factor: 2.1 }, 'forgotten', new Date('2026-05-01T00:00:00.000Z'));
  assert.equal(forgotten.repetitions, 0);
  assert.equal(forgotten.interval, 1);
  assert.equal(forgotten.ease_factor, 2.5);
  pass('SM-2 grades update interval and ease');
} catch (error) {
  fail('SM-2 scheduling', error);
}

console.log('case 3: streak update');
try {
  const today = new Date('2026-05-08T10:00:00.000Z');
  const fresh = game.updateStreak({ streak: 0, best_streak: 0, last_study_date: '' }, { reviewedToday: 10, now: today });
  assert.equal(fresh.streak, 1);
  assert.equal(fresh.best_streak, 1);
  assert.equal(fresh.last_study_date, '2026-05-08');

  const continued = game.updateStreak({ streak: 3, best_streak: 5, last_study_date: '2026-05-07' }, { reviewedToday: 10, now: today });
  assert.equal(continued.streak, 4);
  assert.equal(continued.best_streak, 5);

  const broken = game.updateStreak({ streak: 3, best_streak: 5, last_study_date: '2026-05-05' }, { reviewedToday: 10, now: today });
  assert.equal(broken.streak, 1);

  const protectedGap = game.updateStreak({
    streak: 3,
    best_streak: 5,
    last_study_date: '2026-05-05',
    streak_freezes: 2
  }, { reviewedToday: 10, now: today });
  assert.equal(protectedGap.streak, 4);
  assert.equal(protectedGap.streak_freezes, 0);
  pass('streak requires 10 cards and supports freeze cards');
} catch (error) {
  fail('streak update', error);
}

console.log('case 4: achievements');
try {
  const unlocked = game.checkAndUnlockAchievements({
    achievements: ['first_review'],
    review_count: 120,
    correct_count: 101,
    streak: 7,
    recent_quiz_accuracy: [92, 94, 91],
    completed_books: 1
  });
  const ids = unlocked.newlyUnlocked.map((item) => item.id);
  assert(ids.includes('hundred_correct'));
  assert(ids.includes('seven_day_streak'));
  assert(ids.includes('quiz_master_3'));
  assert(ids.includes('whole_book'));
  assert(!ids.includes('first_review'));
  pass('achievement unlocks are idempotent');
} catch (error) {
  fail('achievements', error);
}

console.log('case 5: decorative catalog');
try {
  const listed = game.listShopItems([
    { item_id: 'theme_green' }
  ]);
  assert(Array.isArray(listed));

  const blocked = game.purchaseShopItem(
    { recordPoints: 120, coins: 120, inventory: [] },
    { id: 'theme_green', recordCost: 80, type: 'theme', title: '妫灄涓婚' }
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'catalog_only');
  assert.equal(blocked.user.recordPoints, 120);
  pass('catalog is decorative and does not transact');
} catch (error) {
  fail('decorative catalog', error);
}

console.log('case 6: high-frequency review pressure');
try {
  assert.equal(typeof game.buildHighFrequencyPracticeLoop, 'function');

  const dueLoop = game.buildHighFrequencyPracticeLoop(
    { xp: 10, streak: 1 },
    [
      { id: 'future', weakPoint: 'future_card', question: 'future card', dueDate: '2026-05-20T00:00:00.000Z' },
      { id: 'past', weakPoint: 'past_card', question: 'past card', dueDate: '2026-05-01T00:00:00.000Z' }
    ],
    [],
    { correct: 1, wrong: 0, accuracy: 90 },
    { targetAccuracy: 80 },
    {},
    { now: new Date('2026-05-08T00:00:00.000Z') }
  );
  assert.equal(dueLoop.recallCards[0].id, 'past');

  const pressureLoop = game.buildHighFrequencyPracticeLoop(
    { xp: 10, streak: 1 },
    [
      { id: 'steady', weakPoint: 'steady_recall', question: 'steady recall', dueDate: '2026-05-01T00:00:00.000Z' },
      { id: 'stuck', weakPoint: 'stuck_recall', question: 'stuck recall', dueDate: '2026-05-01T00:00:00.000Z' }
    ],
    [
      { card_id: 'steady', result: 'correct', rating: 'good' },
      { card_id: 'stuck', result: 'wrong', rating: 'again' }
    ],
    { correct: 1, wrong: 1, accuracy: 50 },
    { targetAccuracy: 80 },
    {},
    { now: new Date('2026-05-08T00:00:00.000Z') }
  );
  assert.equal(pressureLoop.recallCards[0].id, 'stuck');
  assert(pressureLoop.reviewEventPressure.stuck.pressure > pressureLoop.reviewEventPressure.steady.pressure);
  assert(pressureLoop.evidenceRequired.includes('memory_feedback_controller'));
  assert.equal(pressureLoop.dailyReturnContract.id, 'daily_return_contract');
  assert.equal(pressureLoop.dailyReturnContract.loop.length, 4);
  assert(pressureLoop.dailyReturnContract.loop.some((item) => item.id === 'day7_transfer_gate'));
  assert(pressureLoop.dailyReturnContract.shareCard.blockedFields.includes('full_solution'));
  assert(pressureLoop.dailyReturnContract.localAiBoundary.localCodeOwns.includes('xp_gate'));
  assert(pressureLoop.dailyReturnContract.localAiBoundary.aiMustNotOwn.includes('final_answer'));
  assert.equal(pressureLoop.dailyPrimaryRecallAction.id, 'daily_primary_recall_action');
  assert(pressureLoop.dailyPrimaryRecallAction.route.includes('/pages/review/review'));
  assert(pressureLoop.dailyPrimaryRecallAction.rewardEvidence.includes('student_first_step'));
  assert(pressureLoop.dailyPrimaryRecallAction.rewardEvidence.includes('wrong_cause_named'));
  assert(pressureLoop.dailyPrimaryRecallAction.rewardEvidence.includes('next_day_revisit'));
  assert(pressureLoop.dailyPrimaryRecallAction.blockedRewards.includes('speed'));
  assert(pressureLoop.dailyPrimaryRecallAction.blockedRewards.includes('score'));
  assert(pressureLoop.dailyPrimaryRecallAction.blockedRewards.includes('ranking'));
  assert(pressureLoop.dailyPrimaryRecallAction.blockedRewards.includes('raw_volume'));
  assert.equal(pressureLoop.dailyReturnContract.nextDayReturnEvidence.dueAt, '2026-05-09T00:00:00.000Z');
  assert.equal(pressureLoop.dailyReturnContract.nextDayReturnEvidence.route, '/pages/review/review?mode=recall_return');
  assert(pressureLoop.dailyReturnContract.nextDayReturnEvidence.blockedFields.includes('full_solution'));
  assert.equal(pressureLoop.dailyReturnContract.nextDayReturnEvidence.reviewReturnSeed.id, 'review_return_seed');
  assert.equal(pressureLoop.reviewReturnSeed.id, 'review_return_seed');
  assert.equal(pressureLoop.reviewReturnSeed.mode, 'repair_return');
  assert(pressureLoop.reviewReturnSeed.wrongCardIds.includes('stuck'));
  assert(pressureLoop.reviewReturnSeed.blockedFields.includes('full_solution'));
  assert.equal(pressureLoop.nextDayReturnEvidence.dueAt, '2026-05-09T00:00:00.000Z');
  assert.equal(pressureLoop.nextDayReturnEvidence.route, pressureLoop.reviewReturnSeed.nextRoute);
  assert(pressureLoop.nextDayReturnEvidence.blockedFields.includes('full_solution'));
  assert.equal(pressureLoop.nextDayReturnEvidence.reviewReturnSeed.id, 'review_return_seed');
  assert.equal(pressureLoop.spacedRecallPolicy.id, 'spaced_recall_policy');
  assert(pressureLoop.spacedRecallPolicy.nextDayCardIds.includes('stuck'));
  assert.equal(pressureLoop.greenWordClozeProtocol.id, 'green_word_cloze_protocol');
  assert.equal(pressureLoop.greenWordClozeProtocol.status, 'ready');
  assert(pressureLoop.greenWordClozeProtocol.clozeCards.length >= 2);
  assert(pressureLoop.greenWordClozeProtocol.progressiveQuizModes.some((item) => item.id === 'wrong_cause_choice'));
  assert(pressureLoop.greenWordClozeProtocol.localCodeOwns.includes('reward_gate'));
  assert(pressureLoop.greenWordClozeProtocol.aiMustNotOwn.includes('xp_release'));
  assert(pressureLoop.evidenceRequired.includes('green_word_cloze_protocol'));
  assert.equal(pressureLoop.ninetySecondPlayableDeck.id, 'ninety_second_playable_deck');
  assert.equal(pressureLoop.ninetySecondPlayableDeck.status, 'ready');
  assert.equal(pressureLoop.ninetySecondPlayableDeck.totalSeconds, 90);
  assert.equal(
    pressureLoop.ninetySecondPlayableDeck.interactions.map((item) => item.id).join('|'),
    'cloze_keyword|typed_first_step|wrong_cause_choice|lock_next_day_revisit'
  );
  assert.equal(pressureLoop.ninetySecondPlayableDeck.interactions.map((item) => item.order).join('|'), '1|2|3|4');
  assert(pressureLoop.ninetySecondPlayableDeck.interactions.every((item) => item.passEvidence && item.localCheck && item.failTo));
  assert(pressureLoop.ninetySecondPlayableDeck.interactions.some((item) => item.inputType === 'two_choice'));
  const wrongCauseChoice = pressureLoop.ninetySecondPlayableDeck.interactions.find((item) => item.id === 'wrong_cause_choice');
  assert.equal(wrongCauseChoice.choices.find((item) => item.id === 'primary_wrong_cause').next, 'lock_next_day_revisit');
  assert.equal(wrongCauseChoice.choices.find((item) => item.id === 'answer_peeking').next, 'first_step_blackboard');
  assert(pressureLoop.ninetySecondPlayableDeck.rewardGate.includes('XP'));
  assert(pressureLoop.ninetySecondPlayableDeck.sharePayload.blockedFields.includes('original_question'));
  assert(pressureLoop.ninetySecondPlayableDeck.sharePayload.blockedFields.includes('score'));
  assert(pressureLoop.ninetySecondPlayableDeck.sharePayload.blockedFields.includes('ranking'));
  assert(pressureLoop.ninetySecondPlayableDeck.localAiSplit.localCodeOwns.includes('reward_gate'));
  assert(pressureLoop.ninetySecondPlayableDeck.localAiSplit.aiMustNotOwn.includes('mastery_claim'));
  assert(pressureLoop.ninetySecondPlayableDeck.evidenceRequired.includes('next_day_revisit_locked'));
  assert.equal(pressureLoop.ninetySecondPlayableDeck.playableExperience.loop.length, 4);
  assert(pressureLoop.ninetySecondPlayableDeck.playableExperience.releaseChecklist.includes('第一步有孩子输入'));
  assert(pressureLoop.ninetySecondPlayableDeck.playableExperience.stopRule.includes('不发 XP'));
  assert(pressureLoop.ninetySecondPlayableDeck.playableExperience.moatLine.includes('本地代码管节奏'));
  assert(pressureLoop.evidenceRequired.includes('ninety_second_playable_deck'));
  const emptyPlayableDeck = game.buildNinetySecondPlayableDeck(
    { id: 'ninety_second_recall_combo_engine', weakKey: '第一步', mode: 'steady_combo' },
    { workoutCards: [] },
    { sprintCards: [] },
    { greenWordClozeProtocol: { clozeCards: [] } },
    { correct: 0, wrong: 0, accuracy: 0 },
    { weakKey: '第一步' }
  );
  assert.equal(emptyPlayableDeck.sourceCardIds.length, 0);
  assert.equal(emptyPlayableDeck.status, 'waiting_cards');
  const syntheticOnlyLoop = game.buildHighFrequencyPracticeLoop(
    { xp: 10, streak: 1 },
    [],
    [],
    { correct: 0, wrong: 0, accuracy: 0 },
    { targetAccuracy: 80 },
    {},
    { now: new Date('2026-05-08T00:00:00.000Z') }
  );
  assert.equal(syntheticOnlyLoop.hasRealRecallSource, false);
  assert.equal(syntheticOnlyLoop.ninetySecondPlayableDeck.status, 'waiting_real_recall_source');
  assert.equal(syntheticOnlyLoop.ninetySecondPlayableDeck.interactions.length, 0);
  assert.equal(syntheticOnlyLoop.ninetySecondPlayableDeck.sourceCardIds.length, 0);
  assert(syntheticOnlyLoop.ninetySecondPlayableDeck.rewardGate.includes('XP'));
  assert(syntheticOnlyLoop.ninetySecondPlayableDeck.rewardGate.includes('90'));
  assert(syntheticOnlyLoop.ninetySecondPlayableDeck.sharePayload.blockedFields.includes('peer_relay'));
  assert.equal(syntheticOnlyLoop.peerMemoryRelayLeague.mode, 'blocked_until_real_recall_source');
  assert.equal(syntheticOnlyLoop.peerMemoryRelayLeague.relayOpen, false);
  assert.equal(syntheticOnlyLoop.peerMemoryRelayLeague.lanes.length, 0);
  assert.equal(syntheticOnlyLoop.dailyPrimaryRecallAction.status, 'waiting_real_recall_source');
  assert.equal(syntheticOnlyLoop.dailyPrimaryRecallAction.sourceGate, 'waiting_real_recall_source_no_xp_no_share_no_90s');
  assert.equal(syntheticOnlyLoop.dailyPrimaryRecallAction.xpReleaseAllowed, false);
  assert.equal(syntheticOnlyLoop.dailyPrimaryRecallAction.playableReleaseAllowed, false);
  assert.equal(syntheticOnlyLoop.dailyPrimaryRecallAction.peerShareReleaseAllowed, false);
  assert.equal(syntheticOnlyLoop.dailyComebackDecisionEngine.status, 'waiting_real_recall_source');
  assert.equal(syntheticOnlyLoop.dailyComebackDecisionEngine.primaryCard.id, 'real_recall_source_gate');
  assert(syntheticOnlyLoop.dailyComebackDecisionEngine.rewardGate.includes('No XP'));
  assert.equal(syntheticOnlyLoop.reviewReturnSeed.status, 'waiting_real_recall_card');
  assert.equal(syntheticOnlyLoop.reviewReturnSeed.spacedRecallPolicy.sameDayCardIds.length, 0);
  assert.equal(syntheticOnlyLoop.reviewReturnSeed.spacedRecallPolicy.nextDayCardIds.length, 0);
  assert.equal(pressureLoop.reviewReturnSeed.localCodeOwns.includes('queue_order'), true);
  assert.equal(pressureLoop.reviewReturnSeed.aiMayRewrite.includes('prompt_copy'), true);
  assert.equal(pressureLoop.reviewReturnSeed.spacedRecallPolicy.releaseGate, 'first_step_and_wrong_cause_before_xp_or_share');
  assert(pressureLoop.evidenceRequired.includes('daily_return_contract'));
  assert(pressureLoop.evidenceRequired.includes('daily_primary_recall_action'));
  assert(pressureLoop.evidenceRequired.includes('review_return_seed'));
  assert(pressureLoop.evidenceRequired.includes('spaced_recall_policy'));
  assert.equal(pressureLoop.dailyMemorySeasonPlan.id, 'daily_memory_season_plan');
  assert.equal(pressureLoop.dailyMemorySeasonPlan.missions.length, 4);
  assert(pressureLoop.dailyMemorySeasonPlan.nonRankingBoard.some((item) => item.id === 'relay_open'));
  assert(pressureLoop.dailyMemorySeasonPlan.sharePayload.blockedFields.includes('ranking'));
  assert(pressureLoop.dailyMemorySeasonPlan.evidenceRequired.includes('day7_transfer_gate'));
  assert(pressureLoop.evidenceRequired.includes('daily_memory_season_plan'));
  assert.equal(pressureLoop.healthyReturnHabitEngine.id, 'healthy_return_habit_engine');
  assert.equal(pressureLoop.healthyReturnHabitEngine.returnLoops.length, 4);
  assert.equal(pressureLoop.healthyReturnHabitEngine.antiAddictionPolicy.noRankingPressure, true);
  assert.equal(pressureLoop.healthyReturnHabitEngine.antiAddictionPolicy.noInfiniteScroll, true);
  assert(pressureLoop.healthyReturnHabitEngine.localCodeOwns.includes('xp_release_gate'));
  assert(pressureLoop.healthyReturnHabitEngine.aiMustNotOwn.includes('reward_release'));
  assert(pressureLoop.healthyReturnHabitEngine.blockedFields.includes('ranking'));
  assert(pressureLoop.evidenceRequired.includes('healthy_return_habit_engine'));
  assert.equal(pressureLoop.familyCoCreationReturnLoop.id, 'family_co_creation_return_loop');
  assert.equal(pressureLoop.familyCoCreationReturnLoop.dailyComebackCard.id, 'daily_most_worth_return_card');
  assert.equal(pressureLoop.familyCoCreationReturnLoop.returnStory.length, 3);
  assert.equal(pressureLoop.familyCoCreationReturnLoop.weeklyChallenge.id, 'family_weekly_no_ranking_challenge');
  assert(pressureLoop.familyCoCreationReturnLoop.weeklyChallenge.notAllowed.includes('leaderboard'));
  assert(pressureLoop.familyCoCreationReturnLoop.shareCard.blockedFields.includes('ranking'));
  assert(pressureLoop.familyCoCreationReturnLoop.antiAddictionPolicy.noInfiniteScroll);
  assert(pressureLoop.familyCoCreationReturnLoop.localCodeOwns.includes('xp_gate'));
  assert(pressureLoop.familyCoCreationReturnLoop.aiMustNotOwn.includes('infinite_return_trigger'));
  assert(pressureLoop.evidenceRequired.includes('family_co_creation_return_loop'));
  assert.equal(pressureLoop.dailyComebackDecisionEngine.id, 'daily_comeback_decision_engine');
  assert.equal(pressureLoop.dailyComebackDecisionEngine.status, 'ready');
  assert.equal(pressureLoop.dailyComebackDecisionEngine.primaryCard.id, 'rescue_wrong_cause');
  assert(pressureLoop.dailyComebackDecisionEngine.candidateCards.length >= 4);
  assert.equal(pressureLoop.dailyComebackDecisionEngine.antiAddictionPolicy.onePrimaryCardOnly, true);
  assert.equal(pressureLoop.dailyComebackDecisionEngine.antiAddictionPolicy.noInfiniteScroll, true);
  assert(pressureLoop.dailyComebackDecisionEngine.blockedFields.includes('ranking'));
  assert(pressureLoop.dailyComebackDecisionEngine.localCodeOwns.includes('primary_card_selection'));
  assert(pressureLoop.dailyComebackDecisionEngine.aiMustNotOwn.includes('reward_release'));
  assert(pressureLoop.evidenceRequired.includes('daily_comeback_decision_engine'));
  assert.equal(pressureLoop.healthyCommercialReturnGuard.id, 'healthy_commercial_return_guard');
  assert.equal(pressureLoop.healthyCommercialReturnGuard.stopRules.length, 3);
  assert(pressureLoop.healthyCommercialReturnGuard.serviceHandoffLine.includes('7 天证据'));
  assert(pressureLoop.healthyCommercialReturnGuard.blockedRewards.includes('infinite_return_trigger'));
  assert(pressureLoop.healthyCommercialReturnGuard.localAiBoundary.localCodeOwns.includes('service_review_release_gate'));
  assert(pressureLoop.healthyCommercialReturnGuard.localAiBoundary.aiMustNotOwn.includes('service_upgrade_decision'));
  assert(pressureLoop.evidenceRequired.includes('healthy_commercial_return_guard'));
  pass('failed review cards are promoted before completed due cards');
} catch (error) {
  fail('high-frequency review pressure', error);
}

console.log('case 7: public K12 intake executable cards');
try {
  assert.equal(typeof game.buildPublicK12IntakeExecutableCards, 'function');
  const challengeDeck = realHomeworkCoverage.buildPublicK12IntakeChallengeDeck({ limit: 3 });
  const executableCards = game.buildPublicK12IntakeExecutableCards(challengeDeck, { maxCards: 3 });
  assert.equal(executableCards.length, 3);
  assert(executableCards.every((card) => card.type === 'public_k12_homework_intake'));
  assert(executableCards.every((card) => card.route.includes('/pages/tutor/tutor') && card.reviewRoute.includes('/pages/review/review')));
  assert(executableCards.every((card) => card.observableFirstMove && card.fallbackIfNoChildInput && card.receiverMustUseOwnMaterial === true));
  assert(executableCards.every((card) => card.shareSafeFields.includes('observable_first_move')));
  assert(executableCards.every((card) => card.blockedFields.includes('full_solution') && card.blockedFields.includes('ranking')));
  assert(executableCards.every((card) => card.nextPracticePlan.appRoute.includes('/pages/review/review') && card.nextPracticePlan.arcadeRoute.includes('/pages/arcade/arcade')));
  assert(executableCards.every((card) => card.localCodeOwns.includes('share_safe_fields') && card.aiBetterFor.includes('socratic_prompt_wording') && card.aiMustNotOwn.includes('final_answer')));
  pass('public K12 intake deck becomes tutor/review executable cards');
} catch (error) {
  fail('public K12 intake executable cards', error);
}

console.log('case 8: active course-unit playable cards stay first');
try {
  const balancedCards = Array.from({ length: 49 }).map((_, index) => ({
    id: `balanced_${index + 1}`,
    unitId: `unit_${index + 1}`,
    subjectId: ['math', 'chinese', 'english', 'physics', 'chemistry', 'biology', 'geography'][index % 7],
    subjectLabel: ['鏁板', '璇枃', '鑻辫', '鐗╃悊', '鍖栧', '鐢熺墿', '鍦扮悊'][index % 7],
    type: ['active_recall', 'wrong_cause', 'near_transfer'][index % 3],
    label: `样本卡 ${index + 1}`,
    firstStepHint: `先说第 ${index + 1} 张的第一步`,
    wrongCause: `错因 ${index + 1}`
  }));
  const expandedPlayable = game.buildCourseUnitQuestionBankPlayableCards({ activeCards: [], cards: balancedCards }, {});
  assert.equal(expandedPlayable.length, 42, 'default playable question-bank deck should expand beyond the old 21-card ceiling');
  assert(new Set(expandedPlayable.map((card) => card.subjectId || card.subject)).size >= 7, 'expanded playable question-bank deck preserves seven-subject coverage');

  const playable = game.buildCourseUnitQuestionBankPlayableCards({
    activeCards: [
      { id: 'math_active_recall', unitId: 'math_unit_model_relation', subjectId: 'math', subjectLabel: '数学', type: 'active_recall', label: '方程第一步', firstStepHint: '先写清谁是未知数', wrongCause: '未知量没设清' }
    ],
    cards: [
      { id: 'geo_balanced', unitId: 'geo_unit_map', subjectId: 'geography', subjectLabel: '地理', type: 'active_recall', label: '读图定位', firstStepHint: '先看图例' },
      { id: 'math_active_recall', unitId: 'math_unit_model_relation', subjectId: 'math', subjectLabel: '数学', type: 'active_recall', label: '方程第一步', firstStepHint: '先写清谁是未知数', wrongCause: '未知量没设清' }
    ]
  }, {
    taskType: 'equation_setup',
    subject: '数学',
    firstStep: '先写清谁是未知数',
    wrongCauseLabel: '未知量没设清'
  });
  assert.equal(playable[0].unitId, 'math_unit_model_relation');
  assert.equal(playable[0].source, 'course_unit_question_bank');
  assert.equal(playable[0].sourceUnitId, 'math_unit_model_relation');
  pass('active unit cards are kept ahead of balanced filler cards');
} catch (error) {
  fail('active course-unit playable cards stay first', error);
}

if (failed) {
  console.error(`\nFAIL ${failed}`);
  process.exit(1);
}

console.log('\nAll game logic tests pass.');
