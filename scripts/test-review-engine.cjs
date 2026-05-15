#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = {
  reviewDeck: null,
  reviewNotes: [],
  reviewCards: [],
  reviewEvents: [],
  tutorEvents: [],
  thinkingReceipts: [],
  moduleEvents: [],
  syncQueue: [],
  syncState: null,
  clientIdentity: null,
  reviewLoop: null,
  gameProfile: null,
  gamePurchases: [],
  profile: { name: 'Test Learner' },
  state: null
};

const storage = {
  loadState() {
    return store.state;
  },
  loadTutorEvents() {
    return store.tutorEvents;
  },
  loadThinkingReceipts() {
    return store.thinkingReceipts;
  },
  appendThinkingReceipt(receipt) {
    store.thinkingReceipts = [Object.assign({ created_at: new Date().toISOString() }, receipt)].concat(store.thinkingReceipts);
    this.appendSyncMutation('thinking_receipt', store.thinkingReceipts[0]);
    return store.thinkingReceipts;
  },
  thinkingReceiptSummary() {
    return {
      total: store.thinkingReceipts.length,
      avgScore: store.thinkingReceipts.length ? Math.round(store.thinkingReceipts.reduce((sum, item) => sum + Number(item.score || 0), 0) / store.thinkingReceipts.length) : 0,
      proofSentence: store.thinkingReceipts.filter((item) => (item.checks || []).some((check) => check.id === 'proof' && check.done)).length,
      answerCopyAvoided: store.thinkingReceipts.filter((item) => (item.checks || []).some((check) => check.id === 'safe' && check.done)).length,
      label: 'test thinking ledger'
    };
  },
  loadModuleEvents() {
    return store.moduleEvents;
  },
  loadReviewDeck() {
    return store.reviewDeck;
  },
  saveReviewDeck(deck) {
    store.reviewDeck = deck;
  },
  loadReviewNotes() {
    return store.reviewNotes;
  },
  saveReviewNotes(notes) {
    store.reviewNotes = notes;
  },
  loadReviewCards() {
    return store.reviewCards;
  },
  saveReviewCards(cards) {
    store.reviewCards = cards;
  },
  loadReviewEvents() {
    return store.reviewEvents;
  },
  appendReviewEvent(event) {
    const record = Object.assign({ created_at: new Date().toISOString() }, event);
    store.reviewEvents = [record].concat(store.reviewEvents);
    this.appendSyncMutation('review_event', record);
  },
  loadGameProfile() {
    return store.gameProfile || {
      xp: 0,
      coins: 0,
      streak: 0,
      best_streak: 0,
      last_study_date: '',
      streak_freezes: 1,
      lives: 5,
      achievements: [],
      inventory: [],
      recent_quiz_accuracy: [],
      daily_xp: {}
    };
  },
  saveGameProfile(profile) {
    store.gameProfile = Object.assign({}, this.loadGameProfile(), profile || {});
    return store.gameProfile;
  },
  addGameXP(amount) {
    const current = this.loadGameProfile();
    const accepted = Math.max(0, Number(amount || 0));
    return {
      accepted,
      capped: false,
      profile: this.saveGameProfile(Object.assign({}, current, {
        xp: Number(current.xp || 0) + accepted
      }))
    };
  },
  loadGamePurchases() {
    return store.gamePurchases;
  },
  saveGamePurchase(purchase) {
    store.gamePurchases = [purchase].concat(store.gamePurchases);
    return store.gamePurchases;
  },
  loadProfile() {
    return store.profile;
  },
  loadClientIdentity() {
    if (!store.clientIdentity) {
      store.clientIdentity = { client_id: 'local_test', user_id: '', auth_mode: 'local' };
    }
    return store.clientIdentity;
  },
  loadSyncState() {
    return store.syncState || { enabled: false, mode: 'local_queue', last_success_at: '', last_error: '' };
  },
  saveSyncState(patch) {
    store.syncState = Object.assign({}, this.loadSyncState(), patch);
    return store.syncState;
  },
  loadSyncQueue() {
    return store.syncQueue;
  },
  appendSyncMutation(type, payload) {
    const mutation = {
      id: `mut_${store.syncQueue.length + 1}`,
      type,
      payload,
      schema_version: 1,
      local_seq: store.syncQueue.length + 1,
      entity_type: type.split('_')[0],
      entity_id: payload && (payload.card_id || payload.note_id || payload.module_id || payload.reward_id || payload.deck_id || ''),
      status: 'pending',
      created_at: new Date().toISOString()
    };
    store.syncQueue = [mutation].concat(store.syncQueue);
    return mutation;
  },
  syncDiagnostics() {
    const byType = {};
    store.syncQueue.forEach((item) => {
      const type = item.type || 'unknown';
      if (!byType[type]) byType[type] = { type, pending: 0, total: 0 };
      byType[type].total += 1;
      if ((item.status || 'pending') === 'pending') byType[type].pending += 1;
    });
    return {
      schemaVersion: 1,
      localSeq: store.syncQueue.length,
      pending: store.syncQueue.filter((item) => (item.status || 'pending') === 'pending').length,
      duplicates: 0,
      byType: Object.keys(byType).map((key) => byType[key]),
      label: 'test sync diagnostics'
    };
  },
  loadReviewLoop() {
    return store.reviewLoop || {
      lives: 5,
      max_lives: 5,
      streak_freeze: 1,
      longest_streak: 0,
      leaderboard: []
    };
  },
  saveReviewLoop(loop) {
    store.reviewLoop = loop;
    return store.reviewLoop;
  },
  updateReviewLoopForRating(rating, streak) {
    const current = this.loadReviewLoop();
    const next = Object.assign({}, current, {
      lives: Math.max(0, Math.min(current.max_lives, current.lives + (rating === 'easy' ? 1 : 0) - (rating === 'again' ? 1 : 0))),
      longest_streak: Math.max(current.longest_streak || 0, streak || 0)
    });
    return this.saveReviewLoop(next);
  },
  claimReviewReward(reward) {
    const current = this.loadReviewLoop();
    const id = reward && reward.id;
    const claimed = current.claimed_rewards || {};
    if (!id || claimed[id]) return { claimed: false, loop: current };
    const next = Object.assign({}, current, {
      bonus_xp: Number(current.bonus_xp || 0) + Number(reward.xp || 0),
      lives: Math.max(0, Math.min(current.max_lives || 5, Number(current.lives || 5) + Number(reward.lives || 0))),
      streak_freeze: Number(current.streak_freeze || 0) + Number(reward.streakFreeze || 0),
      claimed_rewards: Object.assign({}, claimed, { [id]: reward })
    });
    return { claimed: true, loop: this.saveReviewLoop(next) };
  },
  localLeaderboardSnapshot(profile, progress) {
    return [{
      rank: 1,
      name: profile.name || 'Local learner',
      xp: progress.xp || 0,
      streak: progress.streak || 0,
      isSelf: true
    }];
  }
};

function loadReviewModule() {
  const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'review-cards.js');
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    require(spec) {
      if (spec === './storage') return storage;
      if (spec === './game-logic') return require(path.join(__dirname, '..', 'src', 'lib', 'game-logic.cjs'));
      throw new Error(`Unexpected require: ${spec}`);
    },
    module,
    exports: module.exports,
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

function loadLearningModules() {
  const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'learning-modules.js');
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

function seedState() {
  store.state = {
    grade: '五年级',
    subject: '数学',
    weak_points: [
      { key: 'modeling', name: '审题建模', score: 54, reason: '应用题不能稳定列关系。' }
    ],
    homework_plan: {
      must_do: [
        {
          id: 'hw1',
          text: '应用题 4 道，写完整过程',
          reason: '命中审题建模弱点',
          evidence: {
            calibration_key: 'math:modeling',
            decision: '先列已知、未知和等量关系。',
            weak_point: { name: '审题建模', score: 54 },
            misconception_tags: [
              { id: 'relation', name: '等量关系不清' }
            ]
          }
        }
      ]
    }
  };
}

function reset() {
  store.reviewDeck = null;
  store.reviewNotes = [];
  store.reviewCards = [];
  store.reviewEvents = [];
  store.tutorEvents = [];
  store.thinkingReceipts = [];
  store.moduleEvents = [];
  store.syncQueue = [];
  store.syncState = null;
  store.clientIdentity = null;
  store.reviewLoop = null;
  store.gameProfile = null;
  store.gamePurchases = [];
  seedState();
}

function run() {
  reset();
  const review = loadReviewModule();
  const learningModules = loadLearningModules();
  const deck = review.ensureReviewDeck();
  assert(deck.notes.length >= 3, 'generates notes from radar/homework/misconception');
  assert(deck.cards.length > deck.notes.length, 'one note can generate multiple card templates');
  assert(deck.notes.every((note) => note.quality >= 50), 'generated notes have usable quality score');
  assert(deck.cards.some((card) => card.template === 'reverse' || card.template === 'context'), 'deck includes derived templates');

  const due = review.dueCards(5);
  assert(due.length > 0, 'has due cards');
  const reviewed = review.reviewCard(due[0].id, 'again');
  assert.strictEqual(reviewed.state, 'relearning');
  assert.strictEqual(reviewed.interval, 1);
  assert.strictEqual(reviewed.lapses, 1);
  const buriedAfterReview = review.buriedCards(10);
  assert(buriedAfterReview.every((card) => card.noteId === reviewed.noteId && card.id !== reviewed.id), 'review buries sibling cards from same note');

  const reviewedAgain = review.reviewCard(due[0].id, 'again');
  assert.strictEqual(reviewedAgain.leech, true, 'two lapses marks leech');

  const nextDue = review.dueCards(5)[0] || store.reviewCards.find((item) => item.id !== due[0].id);
  const easyCard = review.reviewCard(nextDue.id, 'easy');
  assert(easyCard.interval >= 7, 'easy schedules farther out');
  assert(easyCard.stability > 0, 'scheduling stores stability');
  assert(easyCard.difficulty < 5.1, 'easy lowers difficulty');
  assert.strictEqual(easyCard.fsrs_state_version, review.FSRS_STATE_VERSION, 'scheduling stores FSRS state version');
  assert(typeof easyCard.retrievability === 'number', 'scheduling stores retrievability');
  assert(typeof easyCard.elapsed_days === 'number', 'scheduling stores elapsed days');

  const summary = review.reviewSummary();
  assert(summary.total >= 3, 'summary includes total cards');
  assert(summary.notes >= 3, 'summary includes notes');
  assert(summary.leeches >= 1, 'summary includes leeches');
  assert(summary.avgQuality >= 50, 'summary includes quality');
  assert(summary.wrongCause && summary.wrongCause.cards.length >= 1, 'summary includes local wrong-cause breakdown');
  assert(summary.wrongCause.nextPracticePlan && summary.wrongCause.nextPracticePlan.checkpoint, 'wrong-cause summary provides next practice plan');

  const importedDeck = review.importTextToDeck('分数乘法: 先约分再相乘\n应用题 -> 先找等量关系', {
    subject: '数学'
  });
  assert(importedDeck.imported >= 2, 'imports and expands text notes');
  const importedCauseCard = store.reviewCards.find((card) => card.question && card.question.includes('应用题'));
  assert(importedCauseCard && importedCauseCard.wrongCauseBucket, 'imported review cards carry wrong-cause bucket');
  assert(importedCauseCard.nextPracticePlan && importedCauseCard.nextPracticePlan.nextPracticeText, 'imported review cards carry next practice plan');
  const preview = review.previewImport('单位换算: 先统一单位', { subject: '数学' });
  assert(preview.length >= 1, 'previews imports before saving');
  assert(preview[0].quality >= 50, 'preview includes quality');
  const enginePreview = review.previewImport('应用题步骤: 先找已知再列等量关系\n单位换算不要混厘米和米', { subject: '数学' });
  assert(enginePreview.length >= 3, 'content engine expands one passage into multiple card types');
  assert(enginePreview.some((item) => item.cardType === 'step'), 'content engine creates step cards');
  assert(enginePreview.some((item) => item.cardType === 'trap'), 'content engine creates trap cards');
  assert(enginePreview.some((item) => item.cardType === 'cloze'), 'content engine creates cloze cards');
  assert(enginePreview.every((item) => item.reason), 'content engine explains why each card exists');
  assert(new Set(enginePreview.map((item) => item.question)).size === enginePreview.length, 'content engine deduplicates questions');
  const enginePlan = review.contentEnginePlan('应用题步骤: 先找已知再列等量关系\n单位换算不要混厘米和米', { subject: '数学' });
  assert(enginePlan.score >= 60, 'content engine plan scores import readiness');
  assert(enginePlan.coreCoverage.length === 4, 'content engine plan checks four core card types');
  assert(enginePlan.coreCoverage.some((item) => item.type === 'trap' && item.ready), 'content engine plan detects trap coverage');
  assert(enginePlan.extensionCoverage.some((item) => item.type === 'transfer'), 'content engine plan reports transfer extension coverage');
  assert(enginePlan.transferCount >= 1, 'wrong-question-like input creates transfer cards');
  assert(enginePlan.qualityBands.reduce((sum, item) => sum + item.count, 0) === enginePlan.cards.length, 'content engine plan buckets all cards by quality');
  assert(enginePlan.recommendation && enginePlan.importLabel, 'content engine plan gives product-facing guidance');
  const richerPreview = review.previewImport('应用题步骤: 先圈已知条件，然后列等量关系，最后检查单位不要混用厘米和米', { subject: '数学' });
  const richerStep = richerPreview.find((item) => item.cardType === 'step');
  const richerTrap = richerPreview.find((item) => item.cardType === 'trap');
  const richerCloze = richerPreview.find((item) => item.cardType === 'cloze');
  assert(richerStep && /圈|已知|条件/.test(richerStep.answer), 'content engine extracts first actionable step');
  assert(richerTrap && /单位/.test(richerTrap.answer), 'content engine detects unit trap');
  assert(richerCloze && richerCloze.answer !== '先', 'content engine avoids weak cloze keyword');

  const expandedImport = review.importTextToDeck('应用题步骤: 先找已知再列等量关系\n单位换算不要混厘米和米', { subject: '数学' });
  assert(expandedImport.imported >= 3, 'expanded import stores generated cards');
  const repeatImport = review.importTextToDeck('应用题步骤: 先找已知再列等量关系\n单位换算不要混厘米和米', { subject: '数学' });
  assert.strictEqual(repeatImport.imported, 0, 'repeat import skips duplicates');
  assert(repeatImport.skipped >= expandedImport.imported, 'repeat import reports skipped duplicates');
  assert(store.reviewNotes.some((note) => note.type === 'step'), 'import stores step note type');
  assert(store.reviewNotes.some((note) => note.type === 'trap'), 'import stores trap note type');
  assert(store.reviewNotes.some((note) => note.type === 'cloze'), 'import stores cloze note type');
  assert(store.reviewNotes.some((note) => note.type === 'transfer'), 'wrongbook import stores transfer note type');

  const generatedWithMeta = review.importGeneratedCards([{
    id: 'ai_wrong_meta',
    question: '举一反三：应用题换条件时先检查什么？',
    answer: '先圈条件，再写等量关系。',
    context: '错题订正',
    cardType: 'transfer',
    subject: '数学',
    weakPoint: '审题建模',
    calibrationKey: 'modeling:wrongbook'
  }], { source: 'remote_ai_content_engine_v1' });
  assert(generatedWithMeta.imported >= 1, 'generated wrongbook card imports');
  const generatedMetaNote = store.reviewNotes.find((note) => note.fields && note.fields.question === '举一反三：应用题换条件时先检查什么？');
  assert(generatedMetaNote && generatedMetaNote.subject === '数学', 'generated import preserves item subject');
  assert(generatedMetaNote.weakPoint === '审题建模', 'generated import preserves item weak point');
  assert(generatedMetaNote.calibrationKey === 'modeling:wrongbook', 'generated import preserves item calibration key');

  const deckSettings = review.updateDeckSettings({ dailyLimit: 9, desiredRetention: 0.95 });
  assert.strictEqual(deckSettings.dailyLimit, 9, 'updates daily limit');
  assert.strictEqual(deckSettings.desiredRetention, 0.95, 'updates desired retention');

  const importedSummary = review.reviewSummary();
  assert(importedSummary.imported >= 2, 'summary counts imported notes');
  assert(importedSummary.queue.due >= 1, 'summary includes queue stats');
  assert(typeof importedSummary.queue.buried === 'number', 'summary includes buried queue stats');
  assert(importedSummary.progress && importedSummary.progress.level >= 1, 'summary includes XP progress profile');
  assert(importedSummary.challenge && importedSummary.challenge.target >= 1, 'summary includes daily challenge');
  assert(Array.isArray(importedSummary.trainingPlan) && importedSummary.trainingPlan.length >= 1, 'summary includes training plan');
  assert(Array.isArray(importedSummary.types) && importedSummary.types.length >= 1, 'summary includes type breakdown');
  assert(importedSummary.types.some((item) => item.type === 'concept'), 'type breakdown includes concept cards');
  assert(importedSummary.types.some((item) => item.type === 'step'), 'type breakdown includes step cards');
  assert(Array.isArray(importedSummary.templates) && importedSummary.templates.some((item) => item.template === 'qa'), 'summary includes template breakdown');
  assert(importedSummary.templates.some((item) => item.template === 'reverse'), 'summary includes reverse template cards');
  assert(importedSummary.contentEngine && importedSummary.contentEngine.generated >= 3, 'summary includes content engine status');
  assert(importedSummary.contentEngine.provider === review.CONTENT_ENGINE_PROVIDERS.local, 'summary exposes content engine provider');
  assert(importedSummary.contentEngine.endpointReady && importedSummary.contentEngine.endpoint === '/api/mini/content-engine', 'summary exposes content engine endpoint');
  assert(importedSummary.sync && importedSummary.sync.pending >= 1, 'summary exposes local sync queue');
  assert(store.syncQueue.some((item) => item.type === 'review_event'), 'review events queue sync mutations');
  assert(importedSummary.sync.diagnostics && importedSummary.sync.diagnostics.byType.length >= 1, 'summary exposes sync diagnostics');
  assert(importedSummary.loop && importedSummary.loop.maxLives >= 1, 'summary exposes life loop');
  assert(Array.isArray(importedSummary.loop.leaderboard) && importedSummary.loop.leaderboard[0].isSelf, 'summary exposes local leaderboard');
  assert(importedSummary.comeback && Array.isArray(importedSummary.comeback.plan), 'summary includes comeback recovery plan');
  assert(importedSummary.maturity && importedSummary.maturity.overall >= 0 && importedSummary.maturity.overall <= 100, 'summary includes bounded maturity score');
  assert.strictEqual(importedSummary.maturity.dimensions.length, 8, 'maturity score covers eight readiness dimensions');
  assert(importedSummary.maturity.dimensions.some((item) => item.id === 'memory_scheduler'), 'maturity covers scheduler quality');
  assert(importedSummary.maturity.dimensions.some((item) => item.id === 'content_engine'), 'maturity covers content engine quality');
  assert(importedSummary.maturity.dimensions.some((item) => item.id === 'miniapp_production'), 'maturity covers miniapp production readiness');
  assert(importedSummary.commercialReadiness && importedSummary.commercialReadiness.average >= 0 && importedSummary.commercialReadiness.average <= 100, 'summary includes bounded commercial readiness');
  assert(importedSummary.commercialReadiness.products.some((item) => item.id === 'content_loop'), 'commercial readiness includes content loop');
  assert(importedSummary.commercialReadiness.products.some((item) => item.id === 'memory_loop'), 'commercial readiness includes memory loop');
  assert(importedSummary.commercialReadiness.products.every((item) => item.biggestGap), 'commercial readiness exposes biggest gap for each loop');
  assert(importedSummary.commercialReadiness.roadmap.length >= 3, 'commercial readiness includes roadmap');
  assert(importedSummary.goal.target === 9, 'summary includes daily goal target');
  assert(Array.isArray(importedSummary.achievements), 'summary includes achievements');
  assert(importedSummary.achievements.some((item) => item.id === 'leech_watch' && item.unlocked), 'achievements surface leech signal');
  assert(importedSummary.health.total >= 1, 'summary includes deck health');
  assert(['steady', 'healthy', 'fragile', 'overloaded'].includes(importedSummary.health.status), 'deck health has stable status');
  assert.strictEqual(importedSummary.forecast.length, 7, 'summary includes 7-day due forecast');
  assert(importedSummary.forecastAdvice.message, 'summary includes forecast advice');
  assert(importedSummary.workload && importedSummary.workload.horizonDays === 30, 'summary includes 30-day workload forecast');
  assert(importedSummary.longWorkload && importedSummary.longWorkload.horizonDays === 90, 'summary includes 90-day workload forecast');
  assert(typeof importedSummary.workload.safeNewCards === 'number', 'workload forecast recommends safe new cards');
  assert(['low', 'medium', 'high'].includes(importedSummary.workload.risk), 'workload forecast has risk state');
  assert(importedSummary.cramPlan && importedSummary.cramPlan.phases.length === 3, 'summary includes exam cram planner');
  assert(typeof importedSummary.cramPlan.dailyTarget === 'number', 'exam planner recommends daily target');
  assert(importedSummary.quiz && importedSummary.quiz.count >= 1, 'summary includes quiz pack');
  assert(Array.isArray(importedSummary.quiz.questions), 'quiz pack includes questions');
  assert(importedSummary.dailyCenter && importedSummary.dailyCenter.missions.length === 4, 'summary includes daily mission center');
  assert(importedSummary.season && importedSummary.season.title === 'WEEKLY SEASON PASS', 'summary includes weekly season pass');
  assert(importedSummary.studyHub && importedSummary.studyHub.title === 'STUDY HUB', 'summary includes study hub');
  assert(importedSummary.fsrsCoach && importedSummary.fsrsCoach.title === 'FSRS COACH', 'summary includes FSRS coach');
  assert(importedSummary.difficultyLadder && importedSummary.difficultyLadder.steps.length === 5, 'summary includes difficulty ladder');
  assert(Array.isArray(importedSummary.publicDeckTemplates) && importedSummary.publicDeckTemplates.length >= 3, 'summary includes public deck templates');
  assert(importedSummary.publicDeckTemplates.every((item) => item.text && item.importAction === 'importTemplateDeck'), 'public deck templates are importable');
  assert(importedSummary.socialChallenge && importedSummary.socialChallenge.missions.length >= 3, 'summary includes social challenge shell');
  assert(importedSummary.socialChallenge.mode === 'local_preview_cloud_ready', 'social challenge shell is clearly local preview');
  assert(importedSummary.retentionLab && importedSummary.retentionLab.scenarios.length === 4, 'summary includes retention lab');
  assert(importedSummary.contentPipeline && importedSummary.contentPipeline.channels.length >= 8, 'summary includes multi-format content pipeline');
  assert(importedSummary.gameEconomy && importedSummary.gameEconomy.quests.length >= 4, 'summary includes local game loop');
  assert(importedSummary.outcomeSimulator && importedSummary.outcomeSimulator.mode === 'estimated_not_guaranteed', 'summary includes non-guaranteed outcome simulator');
  assert(importedSummary.loopReadinessConsole && importedSummary.loopReadinessConsole.average >= 90, 'summary includes loop readiness console');
  assert(importedSummary.loopCapabilityBoard && importedSummary.loopCapabilityBoard.average >= 95, 'summary includes loop capability board');
  assert(importedSummary.syntheticCohort && importedSummary.syntheticCohort.mode === 'simulated_assumptions', 'summary includes synthetic cohort lab');
  assert(importedSummary.assetCompounding && importedSummary.assetCompounding.nodes.length >= 5, 'summary includes asset compounding map');
  assert(importedSummary.maintenance && Array.isArray(importedSummary.maintenance.urgent), 'summary includes deck maintenance plan');
  assert(importedSummary.quizLoop && importedSummary.quizLoop.attempts === 0, 'summary includes quiz loop stats');
  const quizQuestion = importedSummary.quiz.questions[0];
  const quizResult = review.finishQuizAttempt([{
    cardId: quizQuestion.cardId,
    correct: false
  }], { mode: importedSummary.quiz.mode });
  assert.strictEqual(quizResult.count, 1, 'quiz attempt reviews one question');
  assert.strictEqual(quizResult.missed, 1, 'quiz miss is recorded');
  assert(quizResult.repair_drills >= 0, 'quiz attempt reports repair drills');
  assert(store.reviewEvents.some((item) => item.kind === 'quiz_attempt'), 'quiz attempt is stored as review event');
  assert(store.syncQueue.some((item) => item.type === 'review_quiz_attempt'), 'quiz attempt queues sync mutation');
  const quizSummary = review.reviewSummary();
  assert(quizSummary.quizLoop.attempts >= 1, 'quiz loop stats count attempts');
  assert(quizSummary.quizLoop.missed >= 1, 'quiz loop stats count misses');
  assert(Array.isArray(importedSummary.qualityQueue), 'summary includes quality queue');
  if (importedSummary.qualityQueue.length) {
    assert(importedSummary.qualityQueue[0].repairSuggestion, 'quality queue includes repair suggestion');
    assert(Array.isArray(importedSummary.qualityQueue[0].repairActions), 'quality queue includes repair actions');
    assert(importedSummary.qualityQueue[0].repairPreviewQuestion, 'quality queue includes repair preview question');
    assert(importedSummary.qualityQueue[0].repairPreviewAnswer, 'quality queue includes repair preview answer');
  }
  assert(review.qualityQueue(store.reviewNotes, 6).length <= 6, 'quality queue respects limit');
  assert(review.dueForecast(store.reviewCards, 7).some((item) => item.due >= 1), 'due forecast buckets cards');
  assert(review.workloadForecast(store.reviewCards, importedSummary.deck, 30).horizonDays === 30, 'workload forecast supports 30 days');
  assert(review.cramPlanner(store.reviewCards, importedSummary.deck, 21).phases.length === 3, 'cram planner builds three phases');
  assert(review.quizBuilder(store.reviewCards, { limit: 5 }).questions.length >= 1, 'quiz builder creates questions');
  assert(review.deckLibrary(store.reviewNotes, store.reviewCards, { limit: 6 }).length >= 1, 'deck library groups review content');
  assert(review.loadForecastAdvice(importedSummary.forecast, importedSummary.deck).limit === importedSummary.deck.dailyLimit, 'forecast advice uses deck limit');
  assert(importedSummary.sources.some((item) => item.source === 'manual_import'), 'summary includes source breakdown');
  assert(importedSummary.nextStep && importedSummary.nextStep.mode, 'summary includes next step recommendation');
  assert(review.sessionCards('smart', 5).length >= 1, 'smart session builds a queue');
  assert(review.sessionCards('leech', 5).some((card) => card.leech), 'leech session prioritizes leeches');
  assert(review.sessionCards('reverse', 5).every((card) => card.template === 'reverse'), 'reverse session filters reverse templates');
  assert(review.sessionCards('cloze', 5).every((card) => card.type === 'cloze' || card.template === 'cloze_context'), 'cloze session filters cloze practice');
  assert(review.sessionFeedback('leech', review.sessionCards('leech', 5)).message, 'session feedback returns a message');
  assert(review.progressProfile(store.reviewEvents, store.reviewCards).xp > 0, 'progress profile scores reviewed cards');
  assert(review.syncStatus().pending >= 1, 'sync status tracks pending mutations');
  assert(review.loopStatus(importedSummary.progress).lives <= review.loopStatus(importedSummary.progress).maxLives, 'loop status tracks lives');
  assert(review.contentEngineAdapter('鍗曚綅鎹㈢畻: 鍏堢粺涓€鍗曚綅').requiredEndpoint, 'content engine adapter declares remote endpoint');
  assert(review.dailyChallenge(importedSummary).rewardXp > 0, 'daily challenge has reward');
  assert(review.trainingPlan(importedSummary).some((item) => item.mode), 'training plan recommends modes');
  assert(Array.isArray(importedSummary.missions) && importedSummary.missions.length >= 3, 'summary includes mission board');
  assert(Array.isArray(importedSummary.rewards) && importedSummary.rewards.length >= 1, 'summary includes reward board');

  const earnedSummary = Object.assign({}, importedSummary, {
    goal: Object.assign({}, importedSummary.goal, {
      completed: importedSummary.goal.target,
      remaining: 0,
      progress: 100,
      achieved: true
    })
  });
  earnedSummary.challenge = review.dailyChallenge(earnedSummary);
  earnedSummary.rewards = review.rewardBoard(earnedSummary);
  const goalReward = earnedSummary.rewards.find((item) => item.id && item.id.indexOf('goal:') === 0);
  assert(goalReward, 'goal reward exists');
  assert(goalReward.canClaim, 'earned goal reward can be claimed');
  const claimedReward = review.claimReward(goalReward.id, earnedSummary);
  assert.strictEqual(claimedReward.ok, true, 'can claim earned reward');
  const duplicateClaim = review.claimReward(goalReward.id, review.reviewSummary());
  assert.strictEqual(duplicateClaim.ok, false, 'cannot claim same reward twice');
  assert(review.progressProfile(store.reviewEvents, store.reviewCards).xp >= claimedReward.reward.xp, 'bonus reward xp flows into progress profile');

  const moduleItem = learningModules.getModule('math_route_problem');
  const factoryPacks = learningModules.contentFactoryPacks(store.state, importedSummary);
  assert(factoryPacks.length >= 3, 'learning modules expose AI content factory packs');
  assert(factoryPacks.every((item) => item.text && item.prompt && item.options && item.options.source === 'ai_content_factory'), 'factory packs are importable and prompt-backed');
  const factoryImport = review.importTextToDeck(factoryPacks[0].text, factoryPacks[0].options);
  assert(factoryImport.imported >= 3, 'factory pack imports review cards');
  assert(store.reviewNotes.some((note) => note.source === 'ai_content_factory'), 'factory pack stores source for readiness analytics');
  const reviewPack = learningModules.toReviewPack(moduleItem);
  assert(reviewPack && reviewPack.text.includes(moduleItem.title), 'learning module exports review pack text');
  const packPreview = review.previewImport(reviewPack.text, reviewPack.options);
  assert(packPreview.some((item) => item.cardType === 'concept'), 'module review pack creates concept card');
  assert(packPreview.some((item) => item.cardType === 'step'), 'module review pack creates step card');
  assert(packPreview.some((item) => item.cardType === 'trap'), 'module review pack creates trap card');
  assert(packPreview.some((item) => item.cardType === 'cloze'), 'module review pack creates cloze card');
  const packImport = review.importTextToDeck(reviewPack.text, reviewPack.options);
  assert(packImport.imported >= 4, 'module review pack imports into review deck');
  assert(store.reviewNotes.some((note) => note.source === 'module_content_engine'), 'module pack stores source for readiness analytics');
  const startedPath = learningModules.buildAdaptivePath(store.state, {}, [
    { module_id: moduleItem.id, event: 'module_started', created_at: new Date().toISOString() }
  ], 3);
  assert(startedPath.current && startedPath.current.id === moduleItem.id, 'adaptive path prioritizes unfinished started module');
  assert.strictEqual(startedPath.current.nextAction.action, 'complete', 'started module asks for completion evidence');
  const completedPath = learningModules.buildAdaptivePath(store.state, {}, [
    { module_id: moduleItem.id, event: 'module_started', created_at: new Date().toISOString() },
    { module_id: moduleItem.id, event: 'module_completed', created_at: new Date().toISOString() }
  ], 3);
  assert.strictEqual(completedPath.current.nextAction.action, 'review_pack', 'completed module asks to create review pack');
  const importedPath = learningModules.buildAdaptivePath(store.state, {}, [
    { module_id: moduleItem.id, event: 'module_started', created_at: new Date().toISOString() },
    { module_id: moduleItem.id, event: 'module_completed', created_at: new Date().toISOString() },
    { module_id: moduleItem.id, event: 'module_review_pack_imported', created_at: new Date().toISOString() }
  ], 3);
  assert(importedPath.stats.reviewReady === 0, 'adaptive path clears review-ready count after import');
  assert(importedPath.current && importedPath.current.nextAction.action !== 'review_pack', 'adaptive path moves past imported pack');
  const reviewDrivenPath = learningModules.buildAdaptivePath(store.state, {}, [], 3, [
    { calibrationKey: `module:${moduleItem.id}`, leech: true, lapses: 2, due: new Date().toISOString() }
  ]);
  assert.strictEqual(reviewDrivenPath.current.nextAction.action, 'remediate', 'review leeches route back to module remediation');
  assert.strictEqual(reviewDrivenPath.stats.reviewRemediation, 1, 'adaptive path counts review remediation needs');

  const importedCard = store.reviewCards.find((card) => card.source === 'manual_import');
  assert(importedCard, 'manual import creates card');
  const updated = review.updateNote(importedCard.noteId, {
    question: '分数乘法第一步是什么？',
    answer: '先观察能否约分，再相乘。'
  });
  assert(updated.quality >= importedCard.quality, 'editing recalculates quality');
  const editedCard = store.reviewCards.find((card) => card.id === importedCard.id);
  assert.strictEqual(editedCard.question, '分数乘法第一步是什么？', 'editing updates card question');

  const reverseSibling = store.reviewCards.find((card) => card.noteId === importedCard.noteId && card.template === 'reverse');
  assert(reverseSibling && reverseSibling.answer === updated.fields.question, 'editing syncs reverse sibling card');
  const poorImport = review.importGeneratedCards([{
    id: 'poor_card',
    question: 'x',
    answer: '',
    context: '',
    cardType: 'concept'
  }], { source: 'manual_import', subject: 'Math' });
  assert(poorImport.imported >= 1, 'can import low quality card for repair');
  const poorNote = store.reviewNotes.find((note) => note.fields && note.fields.question === 'x');
  assert(poorNote && poorNote.quality < 68, 'poor card enters repair queue');
  const repair = review.repairNote(poorNote.id);
  assert.strictEqual(repair.ok, true, 'auto repair succeeds');
  assert(repair.updated.quality > poorNote.quality, 'auto repair improves quality score');
  assert(repair.wrongCauseBucket && repair.nextPracticePlan && repair.checkpoint, 'auto repair returns wrong-cause plan and checkpoint');
  assert(store.reviewNotes.some((note) => note.source === 'repair_engine'), 'auto repair creates repair-engine drill note');
  assert(store.syncQueue.some((item) => item.type === 'review_auto_repair'), 'auto repair queues sync mutation');

  const suspended = review.setCardSuspended(importedCard.id, true);
  assert.strictEqual(suspended.suspended, true, 'can suspend card');
  assert(!review.dueCards(50).some((card) => card.id === importedCard.id), 'suspended card is excluded from due queue');
  assert(review.suspendedCards(10).some((card) => card.id === importedCard.id), 'suspended card appears in suspended list');
  const resumed = review.setCardSuspended(importedCard.id, false);
  assert.strictEqual(resumed.suspended, false, 'can resume card');
  const buriedCard = review.buriedCards(10)[0];
  if (buriedCard) {
    const unburied = review.unburyCard(buriedCard.id);
    assert(unburied && !unburied.buried_until, 'can unbury sibling card');
  }
  assert(review.reviewStreak() >= 1, 'review streak counts reviewed days');

  const searchableCard = store.reviewCards.find((card) => card.source === 'manual_import' && card.question);
  const browserHits = review.cardBrowser({ query: searchableCard.question.slice(0, 4), status: 'all', limit: 20 });
  assert(browserHits.some((card) => card.id === searchableCard.id), 'card browser searches card content');
  assert(review.cardBrowser({ status: 'leech', limit: 10 }).some((card) => card.leech), 'card browser filters leeches');
  assert(review.cardBrowser({ source: 'manual_import', limit: 10 }).every((card) => card.source === 'manual_import'), 'card browser filters source');
  assert(review.cardBrowser({ type: 'cloze', limit: 10 }).every((card) => card.type === 'cloze'), 'card browser filters card type');
  assert(review.cardBrowser({ template: 'reverse', limit: 10 }).every((card) => card.template === 'reverse'), 'card browser filters template');
  assert(review.cardBrowser({ status: 'buried', limit: 10 }).every((card) => card.buried_until), 'card browser filters buried cards');
  assert(review.cardByNote(importedCard.noteId).id === importedCard.id, 'can locate card by note id');
  assert(review.noteCardTemplates(updated).length >= 2, 'note can expand to multiple templates');

  const readMini = (...parts) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', ...parts), 'utf8');
  const pageJson = ['home', 'tools', 'review', 'profile'].map((page) => JSON.parse(readMini('pages', page, page + '.json')));
  assert(pageJson.every((json) => json.navigationStyle === 'custom'), 'V1 key pages use custom navigation instead of double top bars');
  const customTabWxml = readMini('custom-tab-bar', 'index.wxml');
  const customTabJs = readMini('custom-tab-bar', 'index.js');
  assert(customTabWxml.includes('v1-tabbar') && customTabWxml.includes('作业点拨') && customTabWxml.includes('轻回访') && customTabWxml.includes('修卡点') && customTabWxml.includes('我的'), 'custom tabbar mirrors the four-story shell');
  assert(customTabJs.includes('getCurrentPages') && customTabJs.includes('selected'), 'custom tabbar syncs selected page state');
  const reviewWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.wxml'), 'utf8');
  assert(reviewWxml.includes('class="v1-topbar"'), 'review page keeps V1 top bar shell');
  assert(!/v1-statusbar|v1-time|v1-system-icons|v1-signal|v1-wifi|v1-battery|9:41/.test(reviewWxml), 'review page does not render fake device status UI');
  assert(customTabJs.includes('/pages/review/review'), 'wrong-question loop is available as a first-class tab');
  assert(reviewWxml.includes('5 分钟轻回访') && reviewWxml.includes('quest-panel rc-after-repair') && reviewWxml.includes("repairStatus === 'completed'"), 'review page keeps the 5-minute recall after repair instead of as a competing first-screen center');
  assert(reviewWxml.includes('class="review-title"'), 'review page exposes quest title');
  assert(reviewWxml.includes('class="review-due-pill"'), 'review page exposes due-card pill');
  assert(reviewWxml.includes('class="review-question-card"'), 'review page exposes recall card');
  assert(reviewWxml.includes('bindtap="reveal"'), 'review page exposes reveal action');
  assert(reviewWxml.includes('data-rating="good"'), 'review page exposes rating action');
  assert(reviewWxml.includes('class="pack-primary review-main-cta"'), 'review page exposes primary quest CTA');
  assert(reviewWxml.includes('toggleAdvancedReview'), 'review page keeps advanced controls behind a toggle');
  const reviewJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.js'), 'utf8');
  assert(reviewJs.includes('buildReviewPlaybook'), 'review page builds review playbook');
  assert(reviewJs.includes('thinking_receipt') || fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'review-cards.js'), 'utf8').includes('generatedFromThinkingReceipts'), 'review engine converts thinking receipts into review assets');
  assert(reviewJs.includes('runPlaybookAction'), 'review page can run playbook actions');
  assert(reviewJs.includes('markMiniActionDone') && reviewWxml.includes('reviewViewModel.miniAction.saveCta') && reviewWxml.includes('mini-repair-input'), 'review page requires a tiny learning action before completing repair through reviewViewModel');
  assert(reviewJs.includes('hasMiniActionDone') && reviewJs.includes('mini_action_required'), 'review page blocks completed status before the mini action');
  assert(reviewWxml.includes('明天回访') || reviewJs.includes('明天回访'), 'review completion tells the learner how tomorrow follow-up works');
  ['答案', '秒解', '拍照出答案'].forEach((term) => {
    assert(!reviewWxml.includes(term), `review page avoids answer-tool wording: ${term}`);
  });
  assert(reviewJs.includes('repairNote(noteId)'), 'review page can trigger auto repair');
  assert(reviewJs.includes('finishQuizAttempt'), 'review page submits quiz attempts into review engine');
  assert(reviewJs.includes('contentEnginePlan'), 'review page builds content engine plan while typing');
  assert(reviewJs.includes('toggleAdvancedReview'), 'review page can reveal advanced review controls');
  const homeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.js'), 'utf8');
  const homeWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.wxml'), 'utf8');
  const homeViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'home-view-model.js'), 'utf8');
  const importIntakeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'import-intake.js'), 'utf8');
  const toolsWxmlForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tools', 'tools.wxml'), 'utf8');
  const toolsViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'tools-view-model.js'), 'utf8');
  const reviewViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'review-view-model.js'), 'utf8');
  const profileWxmlForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxml'), 'utf8');
  const profileViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'profile-view-model.js'), 'utf8');
  const homeWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.wxss'), 'utf8');
  const toolsWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tools', 'tools.wxss'), 'utf8');
  const reviewWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.wxss'), 'utf8');
  const profileWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxss'), 'utf8');
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'app.json'), 'utf8'));
  assert(homeJs.includes('buildTodayActions'), 'home page builds actionable daily plan');
  assert(homeJs.includes('saveTodayFocusFromThought'), 'home page stores a local focus when the learner shares a stuck first step');
  assert(homeJs.includes('classifyImportInput'), 'home page classifies manual import input before routing');
  assert(homeWxml.includes('placeholder="{{homeViewModel.inputCard.placeholder}}"') && homeViewModelJsForCta.includes('placeholder'), 'home page input explains paste-question and stuck-point import through homeViewModel');
  ['我读不懂题', '我不会列式', '我想复习这个', '我想做同类题'].forEach((label) => {
    assert(importIntakeJs.includes(label), `home page keeps import MVP chip: ${label}`);
  });
  assert(homeJs.includes('appendThinkingReceipt'), 'home page writes a thought record before handing off to tutor');
  assert(homeJs.includes('todayFocus.issueType'), 'home page keeps issue type visible to the local thought receipt');
  assert(!homeJs.includes('installDemoMode'), 'home page cannot seed demo data from the miniapp UI');
  assert(!homeJs.includes('buildDemoStory'), 'home page does not build demo narrative data');
  assert(!homeJs.includes('buildDemoReplay'), 'home page does not build demo replay data');
  assert(!homeJs.includes('buildInvestorTour'), 'home page does not build pitch/demo data');
  assert(homeJs.includes('buildExecutiveBrief'), 'home page still builds executive brief data outside default UI');
  assert(homeJs.includes('goProfile'), 'home page can route to learner profile');
  assert(homeWxml.includes('{{homeViewModel.primaryCta}}') && homeViewModelJsForCta.includes('primaryCta') && homeWxml.includes('{{homeViewModel.secondaryAction}}') && homeViewModelJsForCta.includes('secondaryAction') && toolsWxmlForCta.includes('{{toolsViewModel.primaryCta.text}}') && toolsViewModelJsForCta.includes('primaryCta') && reviewWxml.includes('{{reviewViewModel.primaryCta.text}}') && reviewViewModelJsForCta.includes('primaryCta') && profileWxmlForCta.includes('{{profileViewModel.primaryCta}}') && profileViewModelJsForCta.includes('primaryCta'), 'four tabs keep one obvious first-screen primary CTA and home keeps first-step as secondary through viewModels');
  assert([homeWxss, toolsWxss, reviewWxss, profileWxss].every((css) => css.includes('env(safe-area-inset-bottom)')), 'four tabs reserve bottom safe-area space for the custom tabbar');
  assert(homeJs.includes('buildPathRouter'), 'home page builds user path router');
  assert(homeJs.includes('buildReturnLoop'), 'home page builds 7-day return loop');
  assert(homeJs.includes('learningModules.buildAdaptivePath'), 'home page connects study cockpit recommendation');
  assert(homeJs.includes('buildGameHero'), 'home page builds gamified challenge hero');
  assert(homeJs.includes('buildLearningStages'), 'home page builds scientific learning stages');
  assert(homeJs.includes('buildArcadeEntry'), 'home page builds one compact knowledge arcade entry');
  assert(homeJs.includes('buildWrongbookEntry'), 'home page builds a dedicated wrongbook story entry');
  assert(homeJs.includes("wx.navigateTo({ url: `/pages/arcade/arcade${query}` })"), 'home page opens knowledge arcade as a subpage with share attribution when present');
  assert(homeJs.includes('buildMissionCards'), 'home page builds V1 mission flow');
  assert(homeJs.includes('buildContentEntry'), 'home page builds learning pack entry');
  assert(homeJs.includes('buildParentSnapshot'), 'home page builds parent evidence snapshot');
  assert(homeJs.includes('buildDashboardHeader'), 'home page builds learning cockpit header');
  assert(homeJs.includes('buildToolCards'), 'home page builds grouped tool center');
  assert(homeJs.includes('buildProgressStrip'), 'home page builds progress strip');
  assert(homeJs.includes('buildParentSupportCards'), 'home page builds parent support cards');
  assert(homeWxml.includes('class="home-header"'), 'home page keeps Xiaodian top identity shell');
  assert(!/v1-statusbar|v1-time|v1-system-icons|v1-signal|v1-wifi|v1-battery|9:41/.test(homeWxml), 'home page does not render fake device status UI');
  assert(homeWxml.includes('class="hero-title"'), 'home page exposes homework-stuck hero');
  assert(homeWxml.includes('{{homeViewModel.title}}') && homeViewModelJsForCta.includes('title:'), 'home page leads with the Tonight Route entry through homeViewModel');
  assert(homeJs.includes('buildLearningStages'), 'home page still defines preview/learn/review/wrong-question stages for downstream use');
  assert(['预习', '学习', '复习', '错题'].every((label) => homeJs.includes(`label: '${label}'`)), 'home page defines preview/learn/review/wrong-question stages');
  assert(/class="[^"]*\bcoach-button\b/.test(homeWxml), 'home page exposes one primary CTA');
  assert((homeWxml.match(/class="[^"]*\bcoach-button\b/g) || []).length === 1, 'home page keeps only one highest-priority CTA');
  assert(homeWxml.includes('quick-actions') && homeWxml.includes('promptChips'), 'home page keeps quick entrances without card clutter');
  assert(!homeWxml.includes('mole-grid'), 'home page does not render arcade gameplay directly');
  assert(homeWxml.includes('flow-pill compact') && homeWxml.includes('{{homeViewModel.routePill}}') && homeViewModelJsForCta.includes('routePill') && homeWxml.includes('mascot-wrap'), 'home page keeps the mascot but compresses Tonight Route into a unified small-screen status pill through homeViewModel');
  assert(homeWxml.includes('weak-verdict-card') && homeWxml.includes('今晚先修') && homeWxml.includes('为什么是它') && homeWxml.includes('谁来点拨') && homeWxml.includes('showWeakVerdict'), 'home page keeps stuck-point verdict as a result-state detail, not default first-screen clutter');
  assert(homeJs.includes('buildPromptChips'), 'home page keeps lightweight input-assist chips in logic');
  assert(homeJs.includes('buildMissionCards'), 'home page keeps mission flow data in logic');
  assert(!homeWxml.includes('产品闭环'), 'home page hides internal product-loop copy from default UI');
  assert(!homeWxml.includes('showInternalPanels'), 'home page removes internal cockpit toggle from default UI');
  assert(homeJs.includes('todayActions'), 'home page still computes actionable next moves');
  assert(homeJs.includes('goTools') && homeJs.includes('buildContentEntry'), 'home page links light-review cockpit');
  assert(homeJs.includes('5 分钟轻回访') && homeJs.includes('featured'), 'home page keeps review as a lower-priority tool path');
  assert.deepStrictEqual(appJson.tabBar.list.map((item) => item.text), ['作业点拨', '修卡点', '专注舱', '轻回访', '我的'], 'miniapp tabBar keeps Homework Help / Repair / Focus Cabin / Light Review / My');
  assert(homeJs.includes("wx.switchTab({ url: '/pages/review/review' })"), 'home page opens wrong-question loop as a tab');
  assert(appJson.pages.includes('pages/arcade/arcade'), 'knowledge arcade is registered as a miniapp subpage');
  const arcadeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'arcade', 'arcade.js'), 'utf8');
  const arcadeWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'arcade', 'arcade.wxml'), 'utf8');
  const arcadeEngineJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'arcade-engine.js'), 'utf8');
  assert(arcadeJs.includes('reviewCards.sessionCards') && arcadeJs.includes('reviewCards.reviewCard'), 'arcade uses real review cards and writes back review results');
  assert(arcadeJs.includes('appendSyncMutation') && arcadeJs.includes('arcade_attempt'), 'arcade queues learning evidence for sync');
  assert(arcadeJs.includes('visibleRecommendations'), 'arcade precomputes visible recommendations for miniapp templates');
  assert(arcadeJs.includes('activeGame'), 'arcade tracks active game metadata for explainable recommendations');
  assert(arcadeJs.includes('loopBoundCards') && arcadeJs.includes('wrongCauseForLoop'), 'arcade prioritizes today task type and wrong-cause cards');
  assert(arcadeJs.includes('wrongCauseBucket') && arcadeJs.includes('rewardLine'), 'arcade writes wrong-cause reward evidence back to todaySession');
  assert(arcadeJs.includes('buildRoundForGame') && arcadeJs.includes('arcade.buildQuestRound'), 'arcade can route to the concept-quest game');
  assert(arcadeJs.includes('arcade.buildSnakeRound') && arcadeJs.includes('tapSnakeTile'), 'arcade can route to the sequence snake game');
  assert(arcadeJs.includes('revealAnswer') && arcadeJs.includes('gradeQuest'), 'quest game uses active recall before self-grading');
  assert(arcadeJs.includes('review_rating') && !/\n\s+rating:\s*correct \? 'good' : 'again',/.test(arcadeJs), 'arcade attempt events do not double-count as normal review rating events');
  assert(arcadeJs.includes('xpGained') && arcadeJs.includes('startXp'), 'arcade result uses actual accepted XP from the review engine');
  assert(arcadeWxml.includes('轻练习') && arcadeWxml.includes('mole-grid'), 'arcade subpage exposes the playable knowledge arcade');
  assert(arcadeWxml.includes('quest-stage') && arcadeWxml.includes('我想好了，核对思路'), 'arcade exposes active recall without answer-tool wording');
  assert(arcadeWxml.includes('mode-brief') && arcadeWxml.includes('game-chip-pitch'), 'arcade explains why each game fits the current knowledge type');
  assert(arcadeWxml.includes('snake-stage') && arcadeWxml.includes('下一口') && arcadeWxml.includes('已经吃掉'), 'arcade exposes a sequence snake stage for step knowledge');
  assert(arcadeJs.includes('wrongAnswers') && arcadeWxml.includes('本局错题') && arcadeWxml.includes('应选'), 'arcade gives corrective feedback after a game round');
  assert(arcadeWxml.includes('先补材料'), 'arcade labels unavailable game modes as material-gated, not trials');
  assert(!arcadeWxml.includes('排行榜') && !arcadeWxml.includes('好友挑战'), 'arcade does not expose fake social competition');
  ['看答案', '参考答案', '正确答案'].forEach((term) => {
    assert(!arcadeWxml.includes(term) && !arcadeJs.includes(term) && !arcadeEngineJs.includes(term), `arcade avoids answer-tool wording: ${term}`);
  });
  assert(arcadeEngineJs.includes("id: 'whack'") && arcadeEngineJs.includes("status: 'ready'"), 'arcade engine marks whack mode as the first playable game');
  assert(arcadeEngineJs.includes("id: 'quiz'") && arcadeEngineJs.includes("status: 'ready'"), 'arcade engine marks quest mode ready only after integration');
  assert(arcadeEngineJs.includes("id: 'snake'") && arcadeEngineJs.includes("status: 'ready'"), 'arcade engine marks sequence snake mode ready only after integration');
  assert(arcadeEngineJs.includes("id: 'match'") && arcadeEngineJs.includes("status: 'needs_material'"), 'arcade engine keeps low-fun matching mode material-gated until enough evidence exists');
  assert(arcadeEngineJs.includes('isQuickRecallCard') && arcadeEngineJs.includes('answer.length > 14'), 'arcade keeps whack-a-mole for short active-recall cards');
  assert(arcadeEngineJs.includes('isQuestCard') && arcadeEngineJs.includes('buildQuestRound'), 'arcade has a separate concept-quest pipeline');
  assert(arcadeEngineJs.includes('isSequenceCard') && arcadeEngineJs.includes('buildSnakeRound'), 'arcade has a separate sequence-game pipeline');
  assert(arcadeEngineJs.includes('pitch:'), 'arcade recommendations include player-facing fit explanation');
  const tabRoutes = ['home', 'tools', 'review', 'profile'];
  const subpageRoutes = ['arcade', 'tutor', 'radar', 'upload', 'diagnosis', 'module', 'legal'];
  const jsFiles = fs.readdirSync(path.join(__dirname, '..', 'miniprogram', 'pages'))
    .flatMap((dir) => {
      const file = path.join(__dirname, '..', 'miniprogram', 'pages', dir, `${dir}.js`);
      return fs.existsSync(file) ? [fs.readFileSync(file, 'utf8')] : [];
    }).join('\n');
  for (const route of tabRoutes) {
    assert(jsFiles.includes(`wx.switchTab({ url: '/pages/${route}/${route}' })`), `${route} tab route can be opened with switchTab`);
  }
  for (const route of subpageRoutes) {
    assert(!jsFiles.includes(`wx.switchTab({ url: '/pages/${route}/${route}' })`), `${route} subpage is not opened with switchTab`);
  }
  const diagnosisJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'diagnosis', 'diagnosis.js'), 'utf8');
  const diagnosisWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'diagnosis', 'diagnosis.wxml'), 'utf8');
  assert(diagnosisJs.includes('buildQuickSnap'), 'diagnosis page builds 3-question quick snap');
  assert(diagnosisJs.includes('quick_snap'), 'diagnosis stores quick snap into radar state');
  assert(diagnosisWxml.includes('3 个问题先定位'), 'diagnosis page exposes three-question weakness snap');
  assert(diagnosisWxml.includes('先修这个卡点'), 'diagnosis page exposes quick verdict');
  const toolsJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tools', 'tools.js'), 'utf8');
  const toolsWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tools', 'tools.wxml'), 'utf8');
  const toolsViewModelJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'tools-view-model.js'), 'utf8');
  const toolsWxssForLayout = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tools', 'tools.wxss'), 'utf8');
  const visualAudit = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'miniapp-visual-audit.cjs'), 'utf8');
  ['05-upload-homework', '06-tutor-xiaodian', '07-learning-radar', '08-diagnosis-snap', '09-module-session'].forEach((screenId) => {
    assert(visualAudit.includes(screenId), `visual audit covers ${screenId}`);
  });
  assert(visualAudit.includes('子页 / 轻回访') && visualAudit.includes('subpage: true'), 'visual audit treats review as a subpage, not a fourth tab');
  assert(toolsJs.includes('buildAdaptivePath'), 'tools cockpit reads adaptive module path');
  assert(toolsJs.includes('reviewSummary'), 'tools page reads review summary');
  assert(toolsJs.includes('focusDueReviewCards') && toolsJs.includes("source: 'today_focus'"), 'tools page reads due cards generated from repaired today focus');
  assert(toolsJs.includes('buildFactoryStudioPlan'), 'tools cockpit builds content factory studio');
  assert(toolsJs.includes('setFactoryStudioMode'), 'tools page supports study-pack mode switching');
  assert(toolsJs.includes('importFactoryStudioPreview'), 'tools cockpit can import preview pack directly');
  assert(toolsJs.includes('runFactoryStudioRemote'), 'tools cockpit can call remote/local content engine');
  assert(toolsWxml.includes('class="arcade-header"'), 'tools page keeps miniapp-safe arcade header shell');
  assert(!/v1-statusbar|v1-time|v1-system-icons|v1-signal|v1-wifi|v1-battery|9:41/.test(toolsWxml), 'tools page does not render fake device status UI');
  assert(toolsWxml.includes('也可以轻松练一下') && toolsWxml.includes('playgroundGames'), 'tools page keeps playground secondary and lightweight');
  assert(toolsJs.includes('buildPlaygroundGames') && toolsJs.includes('arcadeEngine.recommendGames'), 'tools page maps real cards into playground games');
  assert(['地鼠快答', '路径贪吃蛇', '概念探险', '配对泡泡'].every((label) => toolsJs.includes(label)), 'tools page defines the four flagship game types');
  assert(toolsWxml.includes('tools-secondary-games') && toolsWxml.includes('class="material-panel"'), 'tools page sinks games and material input below the main recall card');
  assert(toolsWxml.includes('data-mode="text"') && toolsWxml.includes('data-mode="upload"'), 'tools page still exposes text and upload modes');
  assert(toolsWxssForLayout.includes('grid-template-columns: repeat(3, minmax(0, 1fr))') && toolsWxssForLayout.includes('flex-direction: column') && toolsWxssForLayout.includes('word-break: keep-all'), 'tools source chips stack icon above text to avoid overlap on narrow screens');
  assert(toolsWxml.includes('runFactoryStudioRemote'), 'tools page exposes primary generate CTA');
  assert(toolsWxml.includes('{{toolsViewModel.primaryCta.text}}') && toolsViewModelJs.includes('先去说第一步') && !toolsWxml.includes('wx:if="{{false}}"') && toolsWxml.includes('secondary-generate'), 'tools page routes empty recall back to a real stuck point and exposes material generation as a real loop');
  assert(toolsWxml.includes('{{toolsViewModel.primaryCard.title}}') && toolsViewModelJs.includes('回看昨天那一步') && toolsViewModelJs.includes('昨天你第一步先看了哪里？') && toolsViewModelJs.includes('轻轻回看'), 'tools page exposes one lightweight concrete entry for repaired focus recall cards');
  assert(toolsWxml.includes('goReview'), 'tools page exposes wrong-question source path');
  assert(toolsJs.includes("wx.switchTab({ url: '/pages/review/review' })") || toolsJs.includes('importFactoryStudioAndReview'), 'tools page routes review through tab flow');
  assert(!toolsWxml.includes('专项工具'), 'tools page removes internal-special-tool wording');
  assert(!toolsWxml.includes('预留') && !toolsWxml.includes('示例'), 'tools page removes placeholder wording from V1 UI');
  const uploadJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.js'), 'utf8');
  const uploadWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.wxml'), 'utf8');
  assert(uploadJs.includes('updatePreview'), 'upload page builds live triage preview');
  assert(uploadJs.includes('buildUploadPlaybook'), 'upload page builds upload playbook');
  assert(uploadJs.includes('buildMaterialPreview'), 'upload page builds material-to-memory preview');
  assert(uploadJs.includes('importMaterialPack'), 'upload page can import material pack into review');
  assert(uploadWxml.includes('作业分流') || uploadWxml.includes('UPLOAD TO TRIAGE LOOP'), 'upload page exposes upload-to-triage loop');
  assert(uploadWxml.includes('学习包') || uploadWxml.includes('知识关卡') || uploadWxml.includes('MATERIAL TO MEMORY ENGINE'), 'upload page exposes material-to-memory engine');
  assert(uploadWxml.includes('导入轻回访') || uploadWxml.includes('Import to review'), 'upload page exposes material import action');
  assert(uploadWxml.includes('今晚预览') || uploadWxml.includes('Tonight preview'), 'upload page exposes tonight preview');
  const radarJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'radar', 'radar.js'), 'utf8');
  const radarWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'radar', 'radar.wxml'), 'utf8');
  assert(radarJs.includes('buildDecisionBoard'), 'radar page builds decision board');
  assert(radarJs.includes('buildWeaknessLoop'), 'radar page builds weakness proof loop');
  assert(radarJs.includes('thinkingReceiptSummary'), 'radar page reads thinking receipt summary');
  assert(radarJs.includes('reviewCards.reviewSummary'), 'radar page reads review asset summary');
  assert(radarJs.includes('runDecisionAction'), 'radar page can run decision-board actions');
  assert(radarWxml.includes('下一步安排') || radarWxml.includes('TONIGHT DECISION BOARD'), 'radar page exposes next-step decision board');
  assert(radarJs.includes('今晚学习留痕') || radarWxml.includes('WEAKNESS PROOF LOOP'), 'radar page exposes tonight learning proof loop');

  assert(reviewWxml.includes('{{reviewViewModel.title}}') && reviewWxml.includes('reviewViewModel.primaryCard.sections') && reviewViewModelJsForCta.includes('今晚只修一个卡点') && reviewViewModelJsForCta.includes('今天卡在哪') && reviewViewModelJsForCta.includes('咕点建议你先看') && reviewViewModelJsForCta.includes('你自己的第一步'), 'review page compresses weak-point diagnosis into an actionable verdict');

  const tutorJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tutor', 'tutor.js'), 'utf8');
  const tutorWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tutor', 'tutor.wxml'), 'utf8');
  const storageJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'storage.js'), 'utf8');
  assert(tutorJs.includes('PEDAGOGY_LADDER'), 'tutor defines Khanmigo-style pedagogy ladder');
  assert(tutorJs.includes('TUTOR_GUARDRAILS'), 'tutor defines anti-answer guardrails');
  assert(tutorJs.includes("require('../../utils/tutor-ladder')"), 'tutor page uses the local hint ladder');
  assert(tutorJs.includes('currentHintLevel') && tutorJs.includes('hint_level'), 'tutor page tracks the current hint level in local session state');
  assert(tutorJs.includes('isAnswerRequest') && tutorJs.includes('buildTutorReply'), 'tutor page blocks answer requests before normal chat');
  assert(tutorJs.includes('提示 1/5') && tutorJs.includes('提示 5/5'), 'tutor page exposes a five-level hint ladder');
  assert(tutorJs.includes('pasteRiskSignal'), 'tutor detects copy-paste risk signals');
  assert(tutorJs.includes('coachConsole'), 'tutor builds Socratic coach console');
  assert(tutorJs.includes('buildThinkingReceipt'), 'tutor builds thinking receipt');
  assert(tutorJs.includes('appendThinkingReceipt'), 'tutor persists thinking receipts');
  assert(tutorWxml.includes('带学原则') || tutorWxml.includes('TUTOR PEDAGOGY LAYER'), 'tutor page exposes pedagogy layer');
  assert(tutorWxml.includes('思路记录') || tutorWxml.includes('THINKING RECEIPT'), 'tutor page exposes thinking receipt');
  assert(tutorWxml.includes('今晚先看') || tutorWxml.includes('SOCRATIC COACH CONSOLE'), 'tutor page exposes Socratic coach console');
  assert(tutorWxml.includes('别急着要答案') || tutorWxml.includes('COPY-PASTE RISK GATE'), 'tutor page exposes copy-paste risk gate');
  assert(storageJs.includes('loadTodayFocus') && storageJs.includes('saveTodayFocusFromThought') && storageJs.includes('updateTodayFocusRepair'), 'storage links tutor thoughts, review repair, and family recap through today focus');
  assert(storageJs.includes('ensureTodayFocusReviewCard') && storageJs.includes('sourceFocusId') && storageJs.includes('reviewPromptForIssueType'), 'completed today focus generates a linked active-recall review card');
  assert(storageJs.includes('issueTypeFromThought') && storageJs.includes('thoughtHistory') && storageJs.includes('shouldCreateNewFocus'), 'today focus handles issue typing, repeated thoughts, and new stuck focus after completion');
  assert(storageJs.includes("repairStatus: 'completed'") && storageJs.includes('hasMiniActionDone'), 'today focus completion is gated by mini action');
  assert(storageJs.includes('thinkingReceiptSummary'), 'storage summarizes thinking receipts');
  assert(storageJs.includes('pilotRunSummary'), 'storage summarizes pilot evidence');
  assert(storageJs.includes('factoryEventSummary'), 'storage summarizes content factory runs');
  assert(storageJs.includes('loadThinkingReceipts'), 'storage can load thinking receipts');
  assert(storageJs.includes('appendThinkingReceipt'), 'storage can persist thinking receipts');
  assert(storageJs.includes('appendShareRun'), 'storage can persist local share/referral events');
  assert(storageJs.includes('appendPilotRun'), 'storage can persist pilot evidence');
  assert(storageJs.includes('appendFactoryEvent'), 'storage can persist content factory runs');
  assert(!storageJs.includes('function installInvestorDemo'), 'storage does not expose a demo installer in the miniapp bundle');
  assert(!storageJs.includes('demo_card_modeling_first_step'), 'storage does not seed fake review proof events');
  const apiJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'api.js'), 'utf8');
  assert(apiJs.includes('shouldUseLocalSession') && apiJs.includes('touristappid'), 'miniapp startup skips wx.login for tourist AppID so the first screen can render in DevTools');
  const moduleJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'module', 'module.js'), 'utf8');
  const moduleWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'module', 'module.wxml'), 'utf8');
  assert(moduleJs.includes('buildSessionSteps'), 'module page builds customer session steps');
  assert(moduleJs.includes('completeAndReview'), 'module page can complete and add review pack');
  assert(moduleJs.includes('evidenceText'), 'module page stores completion evidence');
  assert(moduleWxml.includes('学习小局'), 'module page exposes usable session');
  assert(moduleWxml.includes('这一步留下什么证据'), 'module page asks for evidence');
  assert(moduleWxml.includes('完成并加入复习'), 'module page exposes complete and review action');
  assert(moduleWxml.includes('把这个方法变成复习卡'), 'module page exposes content engine card conversion');
  const profileWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxml'), 'utf8');
  const profileJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.js'), 'utf8');
  assert(profileJs.includes('buildParentReport'), 'profile page builds learner progress report');
  assert(profileJs.includes('buildTutorProcessSummary'), 'profile page builds parent-visible tutor process summary');
  assert(profileJs.includes('buildSyncReadiness'), 'profile page builds sync readiness panel');
  assert(profileJs.includes('buildDailyShareCard'), 'profile page builds daily viral share card');
  assert(profileJs.includes('onShareAppMessage') && profileJs.includes('onShareTimeline'), 'profile page wires WeChat share and timeline hooks');
  assert(profileJs.includes('appendShareRun'), 'profile page records local share attempts without fake social data');
  assert(profileJs.includes('shareIntent') && profileJs.includes('parent_card') && profileJs.includes('peer_challenge'), 'profile page uses native WeChat share intent instead of a fake social graph');
  assert(profileJs.includes('buildParentTonightItems'), 'profile page builds today priority list');
  assert(profileJs.includes('thinkingReceiptSummary'), 'profile page reads thinking receipt ledger');
  assert(profileJs.includes('loadTodayFocus'), 'profile page reads the shared today focus');
  assert(profileJs.includes('runParentReportAction'), 'profile page can route learner profile actions');
  assert(profileWxml.includes('class="v1-topbar"'), 'profile page keeps V1 top bar shell');
  assert(!/v1-statusbar|v1-time|v1-system-icons|v1-signal|v1-wifi|v1-battery|9:41/.test(profileWxml), 'profile page does not render fake device status UI');
  assert(profileWxml.includes('class="parent-hero"') && profileWxml.includes('parent-hero-actions'), 'profile page keeps CTA inside the hero card');
  const profileHeroStart = profileWxml.indexOf('<view class="parent-hero">');
  const profileHeroEnd = profileWxml.indexOf('<view class="family-summary-card teacher-lite profile-subtle-card">');
  const profileHero = profileWxml.slice(profileHeroStart, profileHeroEnd);
  assert(profileHero.includes('{{profileViewModel.primaryCta}}') && profileHero.includes('今晚卡住') && profileHero.includes('只问一句') && profileHero.includes('最近小结') && !profileHero.includes('老师建议') && !profileHero.includes('今日成长卡') && !profileHero.includes('profile-main-share'), 'profile first screen keeps one primary CTA and friend-safe parent summary inside the hero');
  assert((profileHero.match(/parent-hero-primary/g) || []).length === 1 && !profileHero.includes('parent-hero-secondary'), 'profile hero keeps only one strong action');
  assert(profileWxml.includes('今晚学习记录'), 'profile page preserves a low-pressure learner record anchor');
  assert(profileWxml.includes('{{profileViewModel.title}}') && profileViewModelJsForCta.includes('今晚家长只问这一句'), 'profile page frames progress in family-readable language');
  assert(profileWxml.includes('今晚卡住') && profileWxml.includes('只问一句') && profileWxml.includes('最近小结') && profileViewModelJsForCta.includes('今晚孩子卡在') && profileViewModelJsForCta.includes('家长只问一句') && profileViewModelJsForCta.includes('信任边界'), 'profile page exposes a three-block five-second parent conclusion card');
  assert(profileJs.includes('今天咕点没有直接给答案，而是让孩子先说第一步') && profileWxml.includes('profile-secondary-process'), 'profile parent recap keeps the no-direct-answer process summary folded behind advanced state');
  assert(profileJs.includes('孩子原话') && profileJs.includes('咕点追问') && profileWxml.includes('tutorProcessSummary.items'), 'profile parent recap can show child utterance and tutor prompt evidence');
  assert(profileWxml.includes('process-summary-lite'), 'profile process summary stays weak/collapsible instead of becoming a dashboard module');
  assert(profileJs.includes('已生成明日回访') && profileJs.includes('明天回访'), 'profile logic still tracks next-day recall cards without crowding the hero');
  assert(profileJs.includes('parentTonightItems'), 'profile page still builds today priority data without crowding the hero');
  assert(profileWxml.includes('weekly-quote'), 'profile page exposes progress summary card');
  assert(profileWxml.includes('daily-share-card') && profileWxml.includes('open-type="share"'), 'profile page exposes native daily learning share card');
  assert(profileWxml.indexOf('申请人工复盘') > profileWxml.indexOf('完成今日回访') && profileWxml.indexOf('今日复盘卡') > profileWxml.indexOf('完成今日回访') && profileWxml.indexOf('profile-main-share') > profileWxml.indexOf('今日复盘卡'), 'profile page sinks manual recap, recap card, and share entry after the main recap action');
  assert(profileWxml.includes('发给家长看') && profileWxml.includes('继续轻回访'), 'profile page offers parent recap and peer same-challenge WeChat share buttons');
  assert(profileWxml.includes('我的卡点修复'), 'profile page exposes stuck-point repair snapshot');
  assert(profileWxml.includes('不直接讲最终结果'), 'profile page keeps the learning companion framed as guidance, not result search');
  ['1v1复盘', '首个付费点', '高信任加购', '可包装成付费体验'].forEach((term) => {
    assert(!profileJs.includes(term) && !profileWxml.includes(term), `profile avoids pilot-stage commercialization wording: ${term}`);
  });
  const tabPageCopy = [homeWxml, toolsWxml, reviewWxml, profileWxml].join('\n');
  ['秒解', '拍照出答案', '核对答案', '拍题'].forEach((term) => {
    assert(!tabPageCopy.includes(term), `four tab pages avoid answer-tool wording: ${term}`);
  });
  ['答案已生成', '直接答案'].forEach((term) => {
    assert(!tabPageCopy.includes(term), `four tab pages avoid unsafe answer wording: ${term}`);
  });
  assert(homeWxml.includes('{{homeViewModel.subtitle}}') && homeWxml.includes('{{homeViewModel.secondaryAction}}') && homeViewModelJsForCta.includes('subtitle') && homeViewModelJsForCta.includes('secondaryAction'), 'home page keeps first-step homework-stuck positioning through homeViewModel');
  assert(profileWxml.includes('今晚卡住') && profileWxml.includes('只问一句') && profileWxml.includes('最近小结') && profileViewModelJsForCta.includes('家长 5 秒看懂'), 'profile page keeps parent-readable recap');
  assert(!profileWxml.includes('排行榜') && !profileWxml.includes('好友挑战') && !profileWxml.includes('好友榜'), 'profile page does not expose fake leaderboards or fake friend challenges');
  assert(homeJs.includes('incomingShare') && homeWxml.includes('学习复盘卡'), 'home page can receive a shared recap link');
  assert(profileWxml.includes('toggleAdvancedProfile'), 'profile page keeps account and sync behind advanced section');
  assert(!profileWxml.includes('内测设置'), 'profile page removes beta-language from default UI');

  const snapshot = review.exportDeckSnapshot();
  assert.strictEqual(snapshot.version, 2, 'exports versioned deck snapshot');
  assert(snapshot.identity && snapshot.identity.client_id, 'snapshot contains local identity');
  assert(snapshot.sync && snapshot.sync.mode, 'snapshot contains sync metadata');
  assert(snapshot.cards.length >= store.reviewCards.length, 'snapshot contains cards');
  reset();
  const fresh = loadReviewModule();
  const merged = fresh.importDeckSnapshot(snapshot);
  assert(merged.imported >= snapshot.cards.length, 'imports deck snapshot cards');
  assert(fresh.cardBrowser({ query: searchableCard.question.slice(0, 4), limit: 20 }).length >= 1, 'imported snapshot is searchable');

  console.log('All review engine tests pass.');
}

run();
