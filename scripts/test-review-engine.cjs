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
    store.reviewEvents = [Object.assign({ created_at: new Date().toISOString() }, event)].concat(store.reviewEvents);
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

  const importedDeck = review.importTextToDeck('分数乘法: 先约分再相乘\n应用题 -> 先找等量关系', {
    subject: '数学'
  });
  assert(importedDeck.imported >= 2, 'imports and expands text notes');
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
  assert(importedSummary.sync.diagnostics && importedSummary.sync.diagnostics.byType.length >= 1, 'summary exposes sync diagnostics');
  assert(importedSummary.loop && importedSummary.loop.maxLives >= 1, 'summary exposes life loop');
  assert(Array.isArray(importedSummary.loop.leaderboard) && importedSummary.loop.leaderboard[0].isSelf, 'summary exposes local leaderboard');
  assert(importedSummary.comeback && Array.isArray(importedSummary.comeback.plan), 'summary includes comeback recovery plan');
  assert(importedSummary.maturity && importedSummary.maturity.overall >= 0 && importedSummary.maturity.overall <= 100, 'summary includes bounded maturity score');
  assert.strictEqual(importedSummary.maturity.dimensions.length, 8, 'maturity score covers eight moat dimensions');
  assert(importedSummary.maturity.dimensions.some((item) => item.id === 'memory_scheduler'), 'maturity covers scheduler quality');
  assert(importedSummary.maturity.dimensions.some((item) => item.id === 'content_engine'), 'maturity covers content engine quality');
  assert(importedSummary.maturity.dimensions.some((item) => item.id === 'miniapp_production'), 'maturity covers miniapp production readiness');
  assert(importedSummary.benchmark && importedSummary.benchmark.average >= 0 && importedSummary.benchmark.average <= 100, 'summary includes bounded competitor benchmark');
  assert(importedSummary.benchmark.products.some((item) => item.id === 'gizmo'), 'benchmark includes Gizmo');
  assert(importedSummary.benchmark.products.some((item) => item.id === 'anki'), 'benchmark includes Anki');
  assert(importedSummary.benchmark.products.every((item) => item.biggestGap), 'benchmark exposes biggest gap for each competitor');
  assert(importedSummary.benchmark.moonshot.length >= 3, 'benchmark includes moonshot roadmap');
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
  assert(importedSummary.quiz && importedSummary.quiz.count >= 1, 'summary includes Gizmo-style quiz pack');
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
  assert(importedSummary.retentionLab && importedSummary.retentionLab.scenarios.length === 4, 'summary includes Anki FSRS retention lab');
  assert(importedSummary.contentPipeline && importedSummary.contentPipeline.channels.length >= 8, 'summary includes multi-format content pipeline');
  assert(importedSummary.gameEconomy && importedSummary.gameEconomy.quests.length >= 4, 'summary includes Gizmo game economy');
  assert(importedSummary.outcomeSimulator && importedSummary.outcomeSimulator.mode === 'estimated_not_guaranteed', 'summary includes non-guaranteed outcome simulator');
  assert(importedSummary.moatConsole && importedSummary.moatConsole.average >= 90, 'summary includes reference-design moat console');
  assert(importedSummary.benchmarkArena && importedSummary.benchmarkArena.average >= 95, 'summary includes benchmark arena');
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
  assert(store.reviewNotes.some((note) => note.source === 'ai_content_factory'), 'factory pack stores source for moat analytics');
  const reviewPack = learningModules.toReviewPack(moduleItem);
  assert(reviewPack && reviewPack.text.includes(moduleItem.title), 'learning module exports review pack text');
  const packPreview = review.previewImport(reviewPack.text, reviewPack.options);
  assert(packPreview.some((item) => item.cardType === 'concept'), 'module review pack creates concept card');
  assert(packPreview.some((item) => item.cardType === 'step'), 'module review pack creates step card');
  assert(packPreview.some((item) => item.cardType === 'trap'), 'module review pack creates trap card');
  assert(packPreview.some((item) => item.cardType === 'cloze'), 'module review pack creates cloze card');
  const packImport = review.importTextToDeck(reviewPack.text, reviewPack.options);
  assert(packImport.imported >= 4, 'module review pack imports into review deck');
  assert(store.reviewNotes.some((note) => note.source === 'module_content_engine'), 'module pack stores source for moat analytics');
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

  const reviewWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.wxml'), 'utf8');
  assert(reviewWxml.includes('summary.comeback'), 'review page exposes comeback loop');
  assert(reviewWxml.includes('DAILY REVIEW PLAYBOOK'), 'review page exposes daily review playbook');
  assert(reviewWxml.includes('LOCAL CHALLENGE CARD'), 'review page exposes local challenge card');
  assert(reviewWxml.includes('Copy share text'), 'review page exposes challenge card copy action');
  assert(reviewWxml.includes('DAILY MISSION CENTER'), 'review page exposes daily mission center');
  assert(reviewWxml.includes('summary.maturity'), 'review page exposes north-star maturity score');
  assert(reviewWxml.includes('NORTH STAR 100'), 'review page labels maturity target');
  assert(reviewWxml.includes('summary.benchmark'), 'review page exposes competitor benchmark');
  assert(reviewWxml.includes('GIZMO / ANKI BENCHMARK'), 'review page labels benchmark panel');
  assert(reviewWxml.includes('summary.workload'), 'review page exposes 30-day workload');
  assert(reviewWxml.includes('ANKI EXAM PLANNER'), 'review page exposes exam planner');
  assert(reviewWxml.includes('GIZMO QUIZ PACK'), 'review page exposes quiz pack');
  assert(reviewWxml.includes('startQuiz'), 'review page can start a quiz');
  assert(reviewWxml.includes('answerQuiz'), 'review page can finish quiz questions');
  assert(reviewWxml.includes('summary.quizLoop'), 'review page exposes quiz loop stats');
  assert(reviewWxml.includes('GIZMO DECK LIBRARY'), 'review page exposes deck library');
  assert(reviewWxml.includes('WEEKLY SEASON PASS'), 'review page exposes weekly season pass');
  assert(reviewWxml.includes('STUDY HUB'), 'review page exposes study hub');
  assert(reviewWxml.includes('PUBLIC DECK TEMPLATES'), 'review page exposes public deck templates');
  assert(reviewWxml.includes('FSRS COACH'), 'review page exposes FSRS coach');
  assert(reviewWxml.includes('ANKI FSRS RETENTION LAB'), 'review page exposes retention lab');
  assert(reviewWxml.includes('SOCIAL CHALLENGE SHELL'), 'review page exposes social challenge shell');
  assert(reviewWxml.includes('GIZMO GAME ECONOMY'), 'review page exposes game economy');
  assert(reviewWxml.includes('DIFFICULTY LADDER'), 'review page exposes difficulty ladder');
  assert(reviewWxml.includes('MULTI-FORMAT CONTENT PIPELINE'), 'review page exposes content pipeline');
  assert(reviewWxml.includes('LEARNING OUTCOME SIMULATOR'), 'review page exposes outcome simulator');
  assert(reviewWxml.includes('MOAT CONSOLE'), 'review page exposes moat console');
  assert(reviewWxml.includes('BENCHMARK ARENA'), 'review page exposes benchmark arena');
  assert(reviewWxml.includes('SYNTHETIC COHORT LAB'), 'review page exposes synthetic cohort lab');
  assert(reviewWxml.includes('ASSET COMPOUNDING MAP'), 'review page exposes asset compounding map');
  assert(reviewWxml.includes('DECK MAINTENANCE'), 'review page exposes deck maintenance');
  assert(reviewWxml.includes('CONTENT ENGINE SHELL'), 'review page exposes content engine shell');
  assert(reviewWxml.includes('importPlan.coreCoverage'), 'review page exposes import coverage diagnostics');
  assert(reviewWxml.includes('importPlan.qualityBands'), 'review page exposes import quality bands');
  assert(reviewWxml.includes('repairSuggestion'), 'review page exposes repair suggestions');
  assert(reviewWxml.includes('repairActions'), 'review page exposes repair actions');
  assert(reviewWxml.includes('sessionFeedback.xpGained'), 'review page exposes session recap XP');
  const reviewJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.js'), 'utf8');
  assert(reviewJs.includes('buildReviewPlaybook'), 'review page builds review playbook');
  assert(reviewJs.includes('thinking_receipt') || fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'review-cards.js'), 'utf8').includes('generatedFromThinkingReceipts'), 'review engine converts thinking receipts into review assets');
  assert(reviewJs.includes('buildChallengeCard'), 'review page builds local challenge card');
  assert(reviewJs.includes('copyChallengeCard'), 'review page can copy challenge card share text');
  assert(reviewJs.includes('runPlaybookAction'), 'review page can run playbook actions');
  assert(reviewJs.includes('repairNote(noteId)'), 'review page can trigger auto repair');
  assert(reviewJs.includes('finishQuizAttempt'), 'review page submits quiz attempts into review engine');
  assert(reviewJs.includes('runMission'), 'review page can run mission-center actions');
  assert(reviewJs.includes('contentEnginePlan'), 'review page builds content engine plan while typing');
  assert(reviewJs.includes('importTemplateDeck'), 'review page can import public deck templates');
  const homeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.js'), 'utf8');
  const homeWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.wxml'), 'utf8');
  assert(homeJs.includes('buildTodayActions'), 'home page builds actionable daily plan');
  assert(homeJs.includes('installDemoMode'), 'home page can install investor demo mode');
  assert(homeJs.includes('buildDemoStory'), 'home page builds demo narrative');
  assert(homeJs.includes('buildDemoReplay'), 'home page builds demo replay walkthrough');
  assert(homeJs.includes('buildInvestorTour'), 'home page builds 5-minute investor tour');
  assert(homeJs.includes('buildExecutiveBrief'), 'home page builds product runway executive brief');
  assert(homeJs.includes('buildQuickDock'), 'home page builds sticky quick dock');
  assert(homeJs.includes('goProfile'), 'home page can route to parent report');
  assert(homeJs.includes('buildPathRouter'), 'home page builds user path router');
  assert(homeJs.includes('buildReturnLoop'), 'home page builds 7-day return loop');
  assert(homeJs.includes('learningModules.buildAdaptivePath'), 'home page connects study cockpit recommendation');
  assert(homeWxml.includes('TODAY COMMAND CENTER'), 'home page exposes command center');
  assert(homeWxml.includes('PATH ROUTER'), 'home page exposes path router');
  assert(homeWxml.includes('7-DAY RETURN LOOP'), 'home page exposes return loop');
  assert(homeWxml.includes('TONIGHT SPRINT'), 'home page exposes tonight sprint');
  assert(homeWxml.includes('PARENT HANDOFF'), 'home page exposes parent handoff');
  assert(homeWxml.includes('INVESTOR DEMO MODE'), 'home page exposes investor demo mode');
  assert(homeWxml.includes('DEMO REPLAY'), 'home page exposes demo replay');
  assert(homeWxml.includes('5-MIN INVESTOR TOUR'), 'home page exposes 5-minute investor tour');
  assert(homeWxml.includes('PRODUCT RUNWAY'), 'home page exposes product runway executive brief');
  assert(homeWxml.includes('quick-dock'), 'home page exposes sticky quick dock');
  assert(homeWxml.includes('todayActions'), 'home page renders actionable next moves');
  assert(homeWxml.includes('STUDY COCKPIT'), 'home page links cockpit');
  assert(homeWxml.includes('Spaced review and quiz'), 'home page exposes review and quiz loop');
  const diagnosisJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'diagnosis', 'diagnosis.js'), 'utf8');
  const diagnosisWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'diagnosis', 'diagnosis.wxml'), 'utf8');
  assert(diagnosisJs.includes('buildQuickSnap'), 'diagnosis page builds 3-question quick snap');
  assert(diagnosisJs.includes('quick_snap'), 'diagnosis stores quick snap into radar state');
  assert(diagnosisWxml.includes('3-QUESTION WEAKNESS SNAP'), 'diagnosis page exposes three-question weakness snap');
  assert(diagnosisWxml.includes('Quick verdict'), 'diagnosis page exposes quick verdict');
  const toolsJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tools', 'tools.js'), 'utf8');
  const toolsWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tools', 'tools.wxml'), 'utf8');
  assert(toolsJs.includes('buildAdaptivePath'), 'tools cockpit reads adaptive module path');
  assert(toolsJs.includes('reviewSummary'), 'tools cockpit reads review summary');
  assert(toolsJs.includes('startCurrentModule'), 'tools cockpit can start current module');
  assert(toolsJs.includes('addCurrentReviewPack'), 'tools cockpit can import review pack');
  assert(toolsJs.includes('contentFactoryPacks'), 'tools cockpit builds AI content factory packs');
  assert(toolsJs.includes('importFactoryPack'), 'tools cockpit can import a factory pack');
  assert(toolsJs.includes('buildFactoryStudioPlan'), 'tools cockpit builds content factory studio');
  assert(toolsJs.includes('buildStudioStudyPack'), 'tools cockpit builds full study pack output');
  assert(toolsJs.includes('buildContentQualityGate'), 'tools cockpit builds content quality gate');
  assert(toolsJs.includes('buildAutomationBoard'), 'tools cockpit builds production automation board');
  assert(toolsJs.includes('importFactoryStudioPreview'), 'tools cockpit can import preview pack directly');
  assert(toolsJs.includes('runFactoryStudioRemote'), 'tools cockpit can call remote/local content engine');
  assert(toolsWxml.includes('AI STUDY COCKPIT'), 'tools page exposes study cockpit');
  assert(toolsWxml.includes('NEXT BEST MODULE'), 'tools page exposes next best module');
  assert(toolsWxml.includes('GIZMO + ANKI LOOP'), 'tools page exposes review loop dashboard');
  assert(toolsWxml.includes('CUSTOMER-READY STUDY PACK'), 'tools page exposes customer-ready study pack');
  assert(toolsJs.includes('buildLearningRevolutionBoard'), 'tools page builds AI learning revolution board');
  assert(toolsJs.includes('runRevolutionAction'), 'tools page can run AI learning revolution actions');
  assert(toolsWxml.includes('AI LEARNING REVOLUTION BOARD'), 'tools page exposes AI learning revolution board');
  assert(toolsWxml.includes('3-QUESTION WEAKNESS SNAP'), 'tools page exposes three-question weakness snap');
  assert(toolsWxml.includes('MULTI-FORMAT LEARNING INPUTS'), 'tools page exposes multi-format learning inputs');
  assert(toolsWxml.includes('THINKING SAFETY LAYER'), 'tools page exposes anti-dependence thinking safety layer');
  assert(toolsWxml.includes('AI CONTENT FACTORY'), 'tools page exposes AI content factory');
  assert(toolsWxml.includes('CONTENT FACTORY STUDIO'), 'tools page exposes content factory studio');
  assert(toolsWxml.includes('STUDY PACK OUTPUT'), 'tools page exposes full study pack output');
  assert(toolsWxml.includes('CONTENT QUALITY GATE'), 'tools page exposes content quality gate');
  assert(toolsWxml.includes('PRODUCTION AUTOMATION'), 'tools page exposes production automation board');
  assert(toolsWxml.includes('Import preview'), 'tools page exposes preview import action');
  assert(toolsWxml.includes('Share-ready decks'), 'tools page exposes deck library');
  const uploadJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.js'), 'utf8');
  const uploadWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.wxml'), 'utf8');
  assert(uploadJs.includes('updatePreview'), 'upload page builds live triage preview');
  assert(uploadJs.includes('buildUploadPlaybook'), 'upload page builds upload playbook');
  assert(uploadJs.includes('buildMaterialPreview'), 'upload page builds material-to-memory preview');
  assert(uploadJs.includes('importMaterialPack'), 'upload page can import material pack into review');
  assert(uploadWxml.includes('UPLOAD TO TRIAGE LOOP'), 'upload page exposes upload-to-triage loop');
  assert(uploadWxml.includes('MATERIAL TO MEMORY ENGINE'), 'upload page exposes material-to-memory engine');
  assert(uploadWxml.includes('Import to review'), 'upload page exposes material import action');
  assert(uploadWxml.includes('Tonight preview'), 'upload page exposes tonight preview');
  const radarJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'radar', 'radar.js'), 'utf8');
  const radarWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'radar', 'radar.wxml'), 'utf8');
  assert(radarJs.includes('buildDecisionBoard'), 'radar page builds decision board');
  assert(radarJs.includes('buildWeaknessLoop'), 'radar page builds weakness proof loop');
  assert(radarJs.includes('thinkingReceiptSummary'), 'radar page reads thinking receipt summary');
  assert(radarJs.includes('reviewCards.reviewSummary'), 'radar page reads review asset summary');
  assert(radarJs.includes('runDecisionAction'), 'radar page can run decision-board actions');
  assert(radarWxml.includes('TONIGHT DECISION BOARD'), 'radar page exposes tonight decision board');
  assert(radarWxml.includes('WEAKNESS PROOF LOOP'), 'radar page exposes weakness proof loop');

  const tutorJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tutor', 'tutor.js'), 'utf8');
  const tutorWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'tutor', 'tutor.wxml'), 'utf8');
  const storageJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'storage.js'), 'utf8');
  assert(tutorJs.includes('PEDAGOGY_LADDER'), 'tutor defines Khanmigo-style pedagogy ladder');
  assert(tutorJs.includes('TUTOR_GUARDRAILS'), 'tutor defines anti-answer guardrails');
  assert(tutorJs.includes('pasteRiskSignal'), 'tutor detects copy-paste risk signals');
  assert(tutorJs.includes('coachConsole'), 'tutor builds Socratic coach console');
  assert(tutorJs.includes('buildThinkingReceipt'), 'tutor builds thinking receipt');
  assert(tutorJs.includes('appendThinkingReceipt'), 'tutor persists thinking receipts');
  assert(tutorWxml.includes('TUTOR PEDAGOGY LAYER'), 'tutor page exposes pedagogy layer');
  assert(tutorWxml.includes('THINKING RECEIPT'), 'tutor page exposes thinking receipt');
  assert(tutorWxml.includes('SOCRATIC COACH CONSOLE'), 'tutor page exposes Socratic coach console');
  assert(tutorWxml.includes('COPY-PASTE RISK GATE'), 'tutor page exposes copy-paste risk gate');
  assert(storageJs.includes('thinkingReceiptSummary'), 'storage summarizes thinking receipts');
  assert(storageJs.includes('pilotRunSummary'), 'storage summarizes pilot evidence');
  assert(storageJs.includes('factoryEventSummary'), 'storage summarizes content factory runs');
  assert(storageJs.includes('loadThinkingReceipts'), 'storage can load thinking receipts');
  assert(storageJs.includes('appendThinkingReceipt'), 'storage can persist thinking receipts');
  assert(storageJs.includes('appendPilotRun'), 'storage can persist pilot evidence');
  assert(storageJs.includes('appendFactoryEvent'), 'storage can persist content factory runs');
  assert(storageJs.includes('function installInvestorDemo'), 'storage defines investor demo installer');
  assert(storageJs.includes('demo_card_modeling_first_step'), 'investor demo seeds review proof events');
  const moduleJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'module', 'module.js'), 'utf8');
  const moduleWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'module', 'module.wxml'), 'utf8');
  assert(moduleJs.includes('buildSessionSteps'), 'module page builds customer session steps');
  assert(moduleJs.includes('completeAndReview'), 'module page can complete and add review pack');
  assert(moduleJs.includes('evidenceText'), 'module page stores completion evidence');
  assert(moduleWxml.includes('MODULE SESSION'), 'module page exposes usable session');
  assert(moduleWxml.includes('Evidence to capture'), 'module page asks for evidence');
  assert(moduleWxml.includes('Complete + review'), 'module page exposes complete and review action');
  assert(moduleWxml.includes('Turn method into cards'), 'module page exposes content engine card conversion');
  const profileWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxml'), 'utf8');
  const profileJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.js'), 'utf8');
  assert(profileJs.includes('buildParentReport'), 'profile page builds parent weekly report');
  assert(profileJs.includes('buildSyncReadiness'), 'profile page builds sync readiness panel');
  assert(profileJs.includes('buildCommercializationPlan'), 'profile page builds commercial entry plan');
  assert(profileJs.includes('buildPilotSop'), 'profile page builds 10-family pilot SOP');
  assert(profileJs.includes('buildLaunchChecklist'), 'profile page builds miniapp production checklist');
  assert(profileJs.includes('buildDataFlywheel'), 'profile page builds data flywheel');
  assert(profileJs.includes('buildBenchmarkPosition'), 'profile page builds competitor parity map');
  assert(profileJs.includes('buildFlywheelCoach'), 'profile page builds flywheel coach');
  assert(profileJs.includes('submitPilotRun'), 'profile page can save pilot evidence');
  assert(profileJs.includes('pilotRunSummary'), 'profile page reads pilot evidence summary');
  assert(profileJs.includes('thinkingReceiptSummary'), 'profile page reads thinking receipt ledger');
  assert(profileJs.includes('runParentReportAction'), 'profile page can route parent report actions');
  assert(profileWxml.includes('PARENT WEEKLY REPORT'), 'profile page exposes parent weekly report');
  assert(profileWxml.includes('SYNC READINESS'), 'profile page exposes sync readiness');
  assert(profileWxml.includes('COMMERCIAL ENTRY'), 'profile page exposes commercial entry plan');
  assert(profileWxml.includes('10-FAMILY PILOT SOP'), 'profile page exposes pilot SOP');
  assert(profileWxml.includes('MINIAPP PRODUCTION CHECKLIST'), 'profile page exposes launch checklist');
  assert(profileWxml.includes('DATA FLYWHEEL'), 'profile page exposes data flywheel');
  assert(profileWxml.includes('FLYWHEEL COACH'), 'profile page exposes flywheel coach');
  assert(profileWxml.includes('COMPETITOR PARITY MAP'), 'profile page exposes competitor parity map');
  assert(profileWxml.includes('PILOT EVIDENCE LOG'), 'profile page exposes pilot evidence log');
  assert(profileWxml.includes('THINKING PROOF LEDGER'), 'profile page exposes thinking proof ledger');
  assert(profileWxml.includes('FAMILY LEARNING ASSET CENTER'), 'profile page exposes family learning asset center');
  assert(profileWxml.includes('NEXT FAMILY ACTIONS'), 'profile page exposes next family actions');
  assert(profileWxml.includes('syncDiagnostics.localSeq'), 'profile page exposes sync diagnostics');

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
