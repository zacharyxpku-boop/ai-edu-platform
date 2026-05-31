#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const reviewPageCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.js'), 'utf8');
assert(!reviewPageCode.includes('遮住答案，先说：${String(card.answer)'), 'active recall prescription does not leak answer before reveal');

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
  addGameXP(amount, reason = '', evidence = {}) {
    const current = this.loadGameProfile();
    const gatePass = !!(evidence.student_first_step && evidence.wrong_cause_named && evidence.next_day_revisit_locked);
    const accepted = Math.max(0, Number(amount || 0));
    return {
      accepted: gatePass ? accepted : 0,
      capped: false,
      gate: { pass: gatePass },
      profile: this.saveGameProfile(Object.assign({}, current, {
        xp: Number(current.xp || 0) + (gatePass ? accepted : 0)
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
  },
  recordAnswerBoundaryEvidence(evidence = {}, context = {}) {
    if (!evidence || evidence.eventType !== 'answer_request_blocked') return null;
    const card = {
      id: `answer_boundary_review_${store.reviewCards.length + 1}`,
      source: 'tutor_answer_boundary',
      title: evidence.reviewSeed && evidence.reviewSeed.title ? evidence.reviewSeed.title : '先不拿答案，复查第一步',
      prompt: evidence.firstStepRequired || '',
      wrongCause: evidence.wrongCauseBucket || '',
      revisit: evidence.nextRevisitWindow || '',
      due: true
    };
    store.reviewCards = [card].concat(store.reviewCards);
    const event = {
      type: 'answer_boundary_review_seeded',
      source: 'tutor',
      cardId: card.id,
      firstStepRequired: evidence.firstStepRequired || '',
      selected_id: context.selected_id || ''
    };
    this.appendReviewEvent(event);
    this.appendSyncMutation('answer_boundary_evidence', {
      id: evidence.id || card.id,
      card_id: card.id,
      first_step_required: evidence.firstStepRequired || '',
      wrong_cause_bucket: evidence.wrongCauseBucket || ''
    });
    return { card, event };
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
  assert(importedCauseCard.sourceMaterialType && importedCauseCard.highFrequency && importedCauseCard.nextRevisitWindow, 'imported review cards carry material source, high-frequency recall, and revisit metadata');
  assert(importedCauseCard.highFrequency.releaseGate.includes('不奖励速度、分数或排名'), 'imported high-frequency metadata blocks score/ranking rewards');
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
  assert(importedSummary.materialMemoryBridge && importedSummary.materialMemoryBridge.importedCardCount >= 1, 'summary exposes material-to-memory bridge');
  assert(importedSummary.materialMemoryBridge.nextRevisitWindow && importedSummary.materialMemoryBridge.releaseGate.includes('不抓链接'), 'material bridge carries revisit window and import boundary');
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
  const pageJson = ['home', 'tutor', 'review', 'profile', 'upload'].map((page) => JSON.parse(readMini('pages', page, page + '.json')));
  assert(pageJson.every((json) => json.navigationStyle === 'custom'), 'V1 key pages use custom navigation instead of double top bars');
  const customTabWxml = readMini('custom-tab-bar', 'index.wxml');
  const customTabJs = readMini('custom-tab-bar', 'index.js');
  assert(customTabWxml.includes('yd-tabbar') && customTabWxml.includes('今天') && customTabWxml.includes('AI私教') && customTabWxml.includes('复习岛') && customTabWxml.includes('家长') && customTabWxml.includes('上传'), 'custom tabbar mirrors the five-entry child-parent shell');
  assert(customTabJs.includes('getCurrentPages') && customTabJs.includes('selected'), 'custom tabbar syncs selected page state');
  const reviewWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.wxml'), 'utf8');
  const reviewJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.js'), 'utf8');
  assert(reviewWxml.includes('yd-review-screen') && reviewWxml.includes('review-challenge-grid'), 'review page uses the new reference-style challenge shell');
  const retiredDeviceChromePattern = new RegExp([
    ['v', '1-statusbar'].join(''),
    ['v', '1-time'].join(''),
    ['v', '1-system-icons'].join(''),
    ['v', '1-signal'].join(''),
    ['v', '1-wifi'].join(''),
    ['v', '1-battery'].join(''),
    '9:41'
  ].join('|'));
  assert(!retiredDeviceChromePattern.test(reviewWxml), 'review page does not render fake device status UI');
  assert(customTabJs.includes('/pages/review/review') && !customTabJs.includes('/pages/arcade/arcade'), 'main review tab opens the current review island shell instead of the legacy arcade tab');
  assert(reviewWxml.includes('review-challenge-grid') && reviewWxml.includes('开始挑战'), 'review page keeps recall as compact first-screen challenge cards instead of the old after-repair panel');
  assert(reviewWxml.includes('class="yd-review-title"'), 'review page exposes quest title');
  assert(reviewWxml.includes('class="yd-review-pill"'), 'review page exposes due-card pill');
  assert(reviewWxml.includes('review-map-node') && reviewWxml.includes('review-map-icon'), 'review page challenge map uses visual game-map nodes instead of number-only boxes');
  ['entry-tutor.png', 'entry-review.png', 'entry-map.png', 'entry-parent.png'].forEach((asset) => {
    assert(reviewWxml.includes(asset), `review map uses reference asset: ${asset}`);
  });
  assert(!reviewWxml.includes('<view class="done"><text>1</text>'), 'review map never regresses to the number-only route boxes');
  assert(reviewWxml.includes('class="review-challenge-card primary"'), 'review page exposes recall entry card');
  assert(reviewWxml.includes('bindtap="reveal"'), 'review page exposes reveal action');
  assert(reviewWxml.includes('data-rating="good"'), 'review page exposes rating action');
  assert(reviewJs.includes('buildMemoryPrescriptionPanel') && reviewJs.includes('buildHighFrequencyPracticeLoop'), 'review page builds today memory prescription from the local high-frequency loop');
  assert(reviewWxml.includes('3 张回忆卡') && reviewWxml.includes('主动回忆'), 'review page visibly exposes the daily active-recall entry without rendering the old prescription wall');
  assert(reviewWxml.includes('明天只回看') && reviewWxml.includes('看是否真的迁移'), 'review compact copy covers revisit windows and transfer checks');
  assert(reviewJs.includes('activeRecallProtocol') && reviewJs.includes('todayMustCards') && reviewJs.includes('ratingScale') && reviewJs.includes('tomorrowReturnCard') && reviewJs.includes('day7VariantCard'), 'review builds a Gizmo-style local active-recall protocol with today, tomorrow, and day-7 cards');
  assert(reviewWxml.includes('奖励来自真实回忆') && reviewWxml.includes('不奖励速度或分数比较'), 'review visibly exposes the active-recall local release gate without raw protocol fields');
  assert(reviewWxml.includes('不奖励速度或分数比较') || reviewJs.includes('不奖励速度或分数比较'), 'review prescription blocks score-comparison-driven rewards');
  assert(reviewJs.includes('不带原题、答案、分数或完整对话'), 'review prescription keeps share payload privacy-safe');
  assert(reviewWxml.includes('class="review-main-cta"'), 'review page exposes primary quest CTA');
  assert(!reviewWxml.includes('toggleAdvancedReview'), 'review page removes the retired advanced toggle from the visible WXML');
  assert(reviewJs.includes('buildReviewPlaybook'), 'review page builds review playbook');
  assert(reviewJs.includes('thinking_receipt') || fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'review-cards.js'), 'utf8').includes('generatedFromThinkingReceipts'), 'review engine converts thinking receipts into review assets');
  assert(reviewJs.includes('runPlaybookAction'), 'review page can run playbook actions');
  assert(reviewJs.includes('markMiniActionDone') && reviewWxml.includes('review-challenge-grid'), 'review page keeps tiny learning-action logic behind the compact challenge grid');
  assert(reviewJs.includes('hasMiniActionDone') && reviewJs.includes('mini_action_required'), 'review page blocks completed status before the mini action');
  assert(reviewWxml.includes('明天回访') || reviewJs.includes('明天回访'), 'review completion tells the learner how tomorrow follow-up works');
  ['答案', '秒解', '拍照出答案'].forEach((term) => {
    assert(!reviewWxml.includes(term), `review page avoids answer-tool wording: ${term}`);
  });
  assert(reviewJs.includes('repairNote(noteId)'), 'review page can trigger auto repair');
  assert(reviewJs.includes('finishQuizAttempt'), 'review page submits quiz attempts into review engine');
  assert(reviewJs.includes('contentEnginePlan'), 'review page builds content engine plan while typing');
  assert(!reviewJs.includes('toggleAdvancedReview') && !reviewJs.includes('showAdvancedReview'), 'review page no longer carries retired advanced review controls');
  const homeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.js'), 'utf8');
  const homeWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.wxml'), 'utf8');
  const homeViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'home-view-model.js'), 'utf8');
  const importIntakeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'import-intake.js'), 'utf8');
  const entryDetailWxmlForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'entry-detail', 'entry-detail.wxml'), 'utf8');
  const entryDetailJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'entry-detail', 'entry-detail.js'), 'utf8');
  const revisitViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'revisit-view-model.js'), 'utf8');
  const reviewViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'review-view-model.js'), 'utf8');
  const profileJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.js'), 'utf8');
  const profileWxmlForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxml'), 'utf8');
  const profileWxml = profileWxmlForCta;
  const profileViewModelJsForCta = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'view-models', 'profile-view-model.js'), 'utf8');
  const homeWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'home.wxss'), 'utf8');
  const entryDetailWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'entry-detail', 'entry-detail.wxss'), 'utf8');
  const reviewWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'review', 'review.wxss'), 'utf8');
  const profileWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxss'), 'utf8');
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'app.json'), 'utf8'));
  const pageDirs = fs.readdirSync(path.join(__dirname, '..', 'miniprogram', 'pages'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepStrictEqual(pageDirs, ['arcade', 'entry-detail', 'home', 'legal', 'profile', 'review', 'tutor', 'upload'], 'retired miniapp page directories are physically removed');
  assert(homeJs.includes('buildTodayActions'), 'home page builds actionable daily plan');
  assert(homeJs.includes('saveTodayFocusFromThought'), 'home page stores a local focus when the learner shares a stuck first step');
  assert(homeJs.includes('classifyImportInput'), 'home page classifies manual import input before routing');
  assert(homeWxml.includes('placeholder="{{homeViewModel.inputCard.placeholder}}"') && homeViewModelJsForCta.includes('placeholder'), 'home page input explains paste-question and stuck-point import through homeViewModel');
  assert(homeJs.includes('appendThinkingReceipt'), 'home page writes a thought record before handing off to tutor');
  assert(!homeJs.includes('installDemoMode') && !homeJs.includes('buildDemoStory') && !homeJs.includes('buildInvestorTour'), 'home page cannot seed demo or investor-tour data from the miniapp UI');
  assert(homeJs.includes('goProfile'), 'home page can route to learner profile');
  assert(homeWxml.includes('mini-main-cta') && homeWxml.includes('homeViewModel.inputCard.placeholder') && entryDetailWxmlForCta.includes('entry-jump-grid') && reviewWxml.includes('review-main-cta') && profileWxmlForCta.includes('parent-primary'), 'active surfaces keep obvious first-screen CTAs in the new reference shells');
  assert([homeWxss, entryDetailWxss, reviewWxss, profileWxss].every((css) => css.includes('env(safe-area-inset-bottom)')), 'active shells reserve bottom safe-area space for the custom tabbar');
  assert(homeWxml.includes('yd-home-hero-card') && homeWxml.includes('mini-title'), 'home page exposes the new reference-style child hero');
  assert(homeWxml.includes('mini-route-card') && homeViewModelJsForCta.includes('title:'), 'home page leads with the Tonight Route entry in the new compact route card');
  assert(/class="[^"]*\bmini-main-cta\b/.test(homeWxml), 'home page exposes one primary CTA');
  assert((homeWxml.match(/class="[^"]*\bmini-main-cta\b/g) || []).length === 1, 'home page keeps only one highest-priority CTA');
  assert(homeWxml.includes('mini-entry-grid') && homeWxml.includes('openEntryDetail'), 'home page keeps visual quick entrances without text clutter');
  assert(!homeWxml.includes(['mole', 'grid'].join('-')), 'home page does not render arcade gameplay directly');
  assert(homeWxml.includes('yd-home-hero-mascot') && homeViewModelJsForCta.includes('routePill'), 'home page keeps the mascot and compact route state in the new shell');
  assert(homeWxml.includes('mini-route-input') && homeWxml.includes('homeViewModel.inputCard.placeholder'), 'home page keeps stuck-point input as a compact route detail');
  assert(homeJs.includes('todayActions'), 'home page still computes actionable next moves');
  assert.deepStrictEqual(appJson.tabBar.list.map((item) => item.pagePath), ['pages/home/home', 'pages/tutor/tutor', 'pages/review/review', 'pages/profile/profile', 'pages/upload/upload'], 'miniapp tabBar keeps the five active product entries without the legacy arcade tab');
  assert(appJson.pages.includes('pages/entry-detail/entry-detail'), 'entry-detail child scene page is registered');
  assert(entryDetailJsForCta.includes('const SCENES') && entryDetailWxmlForCta.includes('bindtap="openScene"'), 'entry-detail owns the child-scene jump system');
  assert(entryDetailJsForCta.includes("primaryRoute: '/pages/review/review") && entryDetailJsForCta.includes("primaryRoute: '/pages/tutor/tutor"), 'entry-detail routes review and tutor scenes to active pages');
  const arcadeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'arcade', 'arcade.js'), 'utf8');
  const arcadeWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'arcade', 'arcade.wxml'), 'utf8');
  const arcadeEngineJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'arcade-engine.js'), 'utf8');
  assert(arcadeJs.includes('reviewCards.sessionCards') && arcadeJs.includes('reviewCards.reviewCard'), 'arcade uses real review cards and writes back review results');
  assert(reviewJs.includes('buildReportSourceContext') && reviewJs.includes('prioritizeReportSourceCards') && reviewJs.includes('reportSourcePanel'), 'review page prioritizes uploaded-material source cards from a persisted handoff');
  assert(arcadeJs.includes('appendSyncMutation') && arcadeJs.includes('arcade_attempt'), 'arcade queues learning evidence for sync');
  assert(arcadeJs.includes('activeGame'), 'arcade tracks active game metadata for explainable recommendations');
  assert(arcadeWxml.includes('yd-arcade-screen') && arcadeWxml.includes('开始这一关'), 'arcade subpage exposes the playable knowledge arcade through the compact shell');
  assert(arcadeWxml.includes('回忆') && arcadeWxml.includes('核对'), 'arcade exposes active recall without answer-tool wording');
  ['看答案', '参考答案', '正确答案'].forEach((term) => {
    assert(!arcadeWxml.includes(term) && !arcadeJs.includes(term) && !arcadeEngineJs.includes(term), `arcade avoids answer-tool wording: ${term}`);
  });
  const uploadJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.js'), 'utf8');
  const uploadWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.wxml'), 'utf8');
  const uploadWxss = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.wxss'), 'utf8');
  assert(uploadJs.includes('updatePreview'), 'upload page builds live triage preview');
  assert(uploadJs.includes('buildUploadPlaybook'), 'upload page builds upload playbook');
  assert(uploadJs.includes('buildMaterialPreview'), 'upload page builds material-to-memory preview');
  assert(uploadJs.includes('importMaterialPack'), 'upload page can import material pack into review');
  assert(uploadWxml.includes('yd-upload-screen') && uploadWxml.includes('upload-material-grid'), 'upload page exposes upload-to-triage loop through the compact shell');
  assert(uploadWxml.includes('家长报告') && uploadWxml.includes('今晚路线'), 'upload page exposes material report and route handoff actions');
  assert(uploadJs.includes('wechat_article') && uploadJs.includes('web_article') && uploadJs.includes('pdf_excerpt'), 'upload page recognizes Chinese/web/PDF material types');
  assert(uploadWxss.includes('.upload-type-strip') && uploadWxss.includes('.yd-upload-proof'), 'upload page styles source chips and boundary note in the new shell');
  assert(profileJs.includes('buildParentReport'), 'profile page builds learner progress report');
  assert(profileJs.includes('buildTutorProcessSummary'), 'profile page builds parent-visible tutor process summary');
  assert(profileJs.includes('runParentReportAction'), 'profile page can route learner profile actions');
  assert(profileWxml.includes('yd-parent-screen') && profileWxml.includes('yd-parent-sources'), 'profile page uses the new parent evidence shell');
  assert(!retiredDeviceChromePattern.test(profileWxml), 'profile page does not render fake device status UI');
  assert(profileWxml.includes('yd-parent-action-row') && profileWxml.includes('yd-parent-decision'), 'profile page offers parent recap and evidence review entry buttons');
  assert(!profileWxml.includes('parent-report-capability-panel'), 'profile page does not render the retired detailed report ledger panel');
  const activePageCopy = [homeWxml, entryDetailWxmlForCta, reviewWxml, arcadeWxml, uploadWxml, profileWxml].join('\n');
  ['秒解', '拍照出答案', '核对答案', '拍题', '答案已生成', '直接答案'].forEach((term) => {
    assert(!activePageCopy.includes(term), `active pages avoid unsafe answer-tool wording: ${term}`);
  });
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
