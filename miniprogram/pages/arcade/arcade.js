const arcade = require('../../utils/arcade-engine');
const gameLogic = require('../../utils/game-logic');
const reviewCards = require('../../utils/review-cards');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const api = require('../../utils/api');
const tutorLadder = require('../../utils/tutor-ladder');
const realHomeworkCoverage = require('../../utils/real-homework-coverage');
const shareRelaySchema = require('../../utils/share-relay-schema');

function arcadeReadableRouteLine(route = '') {
  const value = String(route || '');
  if (value.indexOf('/pages/review/') >= 0) return '下一步：练后回到错因复盘，锁定明天回访。';
  if (value.indexOf('/pages/tutor/') >= 0) return '下一步：练后回到一对一点拨，只问第一步。';
  if (value.indexOf('/pages/profile/') >= 0) return '下一步：练后回到家长报告查看证据。';
  if (value.indexOf('/pages/upload/') >= 0) return '下一步：练后继续补材料证据。';
  return '下一步：练后回到同一条学习证据。';
}

Page({
  data: {
    summary: null,
    cards: [],
    classifications: [],
    recommendations: [],
    visibleRecommendations: [],
    selectedGame: 'whack',
    gameMode: 'whack',
    round: null,
    currentIndex: 0,
    currentQuestion: null,
    questNodes: [],
    revealed: false,
    quizRecallEvidence: null,
    snakeTrack: null,
    snakeTiles: [],
    snakeNextOrder: 0,
    snakeSegments: [],
    showSnakeBody: false,
    matchTiles: [],
    matchSelectedTile: null,
    matchPairsDone: 0,
    activeGame: null,
    moleHoles: [],
    lives: 3,
    combo: 0,
    bestCombo: 0,
    score: 0,
    startXp: 0,
    xpGained: 0,
    answers: [],
    reviewedCardIds: {},
    wrongAnswers: [],
    repairFocus: null,
    dailyQuestSet: null,
    adaptiveChallenge: null,
    questArcMission: null,
    challengeBrief: null,
    surfaceDepthPack: null,
    result: null,
    resultAdvice: null,
    gameRetentionLoop: null,
    highFrequencyPracticeLoop: null,
    publicK12IntakeChallengeDeck: [],
    publicK12IntakeExecutableCards: [],
    dailyReturnMission: null,
    dailyReturnContract: null,
    dailyPrimaryRecallAction: null,
    dailyPrimaryRecallEvidencePacket: null,
    ninetySecondRecallDeck: null,
    ninetySecondRecallState: null,
    reviewReturnSeed: null,
    nextDayReturnEvidence: null,
    spacedRecallPolicy: null,
    arcadeResultActionBridge: null,
    emptyGuide: null,
    feedbackText: '',
    expandedMatrix: false,
    recentTaskType: 'unknown',
    learningBoundLine: '',
    gameBlocked: false,
    reportSourceContext: null,
    reportSourcePanel: null
  },

  onLoad(query = {}) {
    this.setData({
      reportSourceContext: this.buildReportSourceContext(query)
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    const pendingRoute = navigation.consumePendingTabRouteContext
      ? navigation.consumePendingTabRouteContext('/pages/arcade/arcade')
      : null;
    this.setData({
      showLegacyEntryContent: false
    });
    this.refresh();
  },

  onHide() {
    this.clearNinetySecondRecallTimer();
  },

  onUnload() {
    this.clearNinetySecondRecallTimer();
  },

  buildReportSourceContext(query = {}) {
    const handoff = storage.get ? storage.get('upload.report.handoff.v1', null) : null;
    const context = Object.assign({}, handoff || {}, query || {});
    const fromUpload = context.from === 'upload_report_ready' || (handoff && handoff.status === 'ready');
    if (!fromUpload && !context.cardId && !context.sourceSchemaId) return null;
    return {
      reportId: context.reportId || '',
      sourceSchemaId: context.sourceSchemaId || '',
      cardId: context.cardId || '',
      title: context.title || '来自刚上传的资料',
      line: context.line || '这轮轻练习优先使用刚上传材料生成的卡。',
      blockedFields: Array.isArray(context.blockedFields) ? context.blockedFields : [],
      openMaicBridgeStatus: context.openMaicDecisionBridge && context.openMaicDecisionBridge.qualityGate
        ? context.openMaicDecisionBridge.qualityGate.status
        : '',
      returnRoute: context.returnRoute || context.actionRoute || '',
      flowTraceId: context.flowTraceId || ''
    };
  },

  prioritizeReportSourceCards(cards = [], context = null) {
    if (!context) return cards;
    const matched = [];
    const rest = [];
    cards.forEach((card) => {
      const hit = (context.cardId && (card.id === context.cardId || card.cardId === context.cardId))
        || (context.sourceSchemaId && card.sourceSchemaId === context.sourceSchemaId)
        || (context.sourceSchemaId && String(card.source || '').includes(context.sourceSchemaId));
      (hit ? matched : rest).push(card);
    });
    return matched.concat(rest);
  },

  prioritizeActiveUnitCards(cards = [], courseUnitMap = null) {
    const activeUnitIds = courseUnitMap && Array.isArray(courseUnitMap.activeUnitIds)
      ? courseUnitMap.activeUnitIds
      : [];
    if (!activeUnitIds.length) return cards;
    const active = [];
    const rest = [];
    (cards || []).forEach((card) => {
      const unitId = card && (card.unitId || card.sourceUnitId || card.courseUnitId);
      const hit = card && card.source === 'course_unit_question_bank' && activeUnitIds.includes(unitId);
      (hit ? active : rest).push(card);
    });
    return active.concat(rest);
  },

  buildReportSourcePanel(context = null, cards = []) {
    if (!context) return null;
    const matchedCount = cards.filter((card) => (
      (context.cardId && (card.id === context.cardId || card.cardId === context.cardId))
      || (context.sourceSchemaId && card.sourceSchemaId === context.sourceSchemaId)
      || (context.sourceSchemaId && String(card.source || '').includes(context.sourceSchemaId))
    )).length;
    const first = cards[0] || {};
    return {
      title: context.title || '来自刚上传的资料',
      line: context.line || '先把这份材料对应的卡做成轻练习，再回到普通复习。',
      sourceSchemaId: context.sourceSchemaId || '',
      reportId: context.reportId || '',
      cardId: first.cardId || first.id || context.cardId,
      firstQuestion: first.question || first.prompt || '',
      matchedCount,
      blockedFields: context.blockedFields || [],
      openMaicBridgeStatus: context.openMaicBridgeStatus || '',
      returnRoute: context.returnRoute || '',
      returnRouteLine: arcadeReadableRouteLine(context.returnRoute || '')
    };
  },

  refresh() {
    const summary = reviewCards.reviewSummary();
    const limit = (summary.deck && summary.deck.dailyLimit) || 8;
    const dueCards = reviewCards.sessionCards('smart', limit);
    const fallbackCards = reviewCards.cardBrowser({ status: 'all', limit: 12 });
    const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
    const todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
    const loopFocus = todaySession && todaySession.childArticulatedStep ? todaySession : todayFocus;
    const recentTaskType = (loopFocus && loopFocus.taskType) || 'unknown';
    const subjectSkillDepth = storage.buildSubjectSkillDepth
      ? storage.buildSubjectSkillDepth(Object.assign({}, loopFocus || {}, {
        taskType: recentTaskType,
        sourceText: loopFocus && (loopFocus.stuckPointText || loopFocus.sourceText || loopFocus.thought || loopFocus.title),
        firstStep: loopFocus && (loopFocus.childArticulatedStep || loopFocus.systemSuggestedStep)
      }))
      : null;
    const curriculumSpine = storage.buildCurriculumSpine
      ? storage.buildCurriculumSpine(Object.assign({}, loopFocus || {}, { subjectSkillDepth }))
      : null;
    const courseUnitMap = storage.buildCourseUnitMap
      ? storage.buildCourseUnitMap(Object.assign({}, loopFocus || {}, { subjectSeedLibrary: null }))
      : null;
    const courseUnitMasteryTrajectory = storage.buildCourseUnitMasteryTrajectory
      ? storage.buildCourseUnitMasteryTrajectory({ courseUnitMap })
      : null;
    const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank
      ? storage.buildCourseUnitQuestionBank({ courseUnitMap })
      : null;
    const commercialDepthRunway = storage.buildCommercialDepthRunway
      ? storage.buildCommercialDepthRunway({
        courseUnitMap,
        courseUnitMasteryTrajectory,
        courseUnitQuestionBank,
        subjectSkillDepth
      })
      : null;
    const sevenSubjectMasterySprint = storage.buildSevenSubjectMasterySprint
      ? storage.buildSevenSubjectMasterySprint({
        courseUnitMap,
        courseUnitMasteryTrajectory,
        courseUnitQuestionBank,
        commercialDepthRunway,
        subjectSkillDepth
      })
      : null;
    const taskBoundCards = this.cardsForRecentTaskType(recentTaskType, loopFocus);
    const questionBankPlayableCards = gameLogic.buildCourseUnitQuestionBankPlayableCards
      ? gameLogic.buildCourseUnitQuestionBankPlayableCards(courseUnitQuestionBank, {
        taskType: recentTaskType,
        subject: loopFocus && loopFocus.subject,
        firstStep: loopFocus && (loopFocus.childArticulatedStep || loopFocus.systemSuggestedStep),
        wrongCauseLabel: this.wrongCauseForLoop(loopFocus).wrongCauseLabel,
        rescueMode: !!(todaySession && todaySession.gamePlayed)
      })
      : [];
    const publicK12IntakeChallengeDeck = realHomeworkCoverage.buildPublicK12IntakeChallengeDeck
      ? realHomeworkCoverage.buildPublicK12IntakeChallengeDeck({ limit: 21 })
      : [];
    const publicK12IntakeExecutableCards = gameLogic.buildPublicK12IntakeExecutableCards
      ? gameLogic.buildPublicK12IntakeExecutableCards(publicK12IntakeChallengeDeck, { maxCards: 21 })
      : [];
    const reportSourceContext = this.data.reportSourceContext || this.buildReportSourceContext();
    const loopBoundCards = this.loopBoundCards(dueCards.concat(fallbackCards).concat(questionBankPlayableCards).concat(publicK12IntakeExecutableCards), taskBoundCards, loopFocus);
    const cards = this.prioritizeActiveUnitCards(this.prioritizeReportSourceCards(
      loopBoundCards.length ? loopBoundCards : (dueCards.length ? dueCards : (fallbackCards.length ? fallbackCards : taskBoundCards)),
      reportSourceContext
    ), courseUnitMap);
    const ruleRetestCards = cards.filter((card) => card && card.type === 'real_trial_rule_retest');
    const profile = storage.loadGameProfile ? storage.loadGameProfile() : {};
    const reviewEvents = storage.loadReviewEvents ? storage.loadReviewEvents() : [];
    const evidenceBias = storage.buildEvidenceRouteBias ? storage.buildEvidenceRouteBias() : null;
    const dailyQuestSet = gameLogic.buildDailyQuestSet(profile, cards, reviewEvents, { now: new Date(), evidenceBias });
    const adaptiveChallenge = gameLogic.buildAdaptiveChallenge(cards, reviewEvents, profile, { now: new Date(), evidenceBias });
    const socraticQualityEvaluationSuite = tutorLadder.buildSocraticQualityEvaluationSuite
      ? tutorLadder.buildSocraticQualityEvaluationSuite(recentTaskType || 'unknown')
      : null;
    const previewRetentionLoop = gameLogic.buildGameRetentionLoop
      ? gameLogic.buildGameRetentionLoop(profile, {}, adaptiveChallenge, dailyQuestSet, {
        weakKey: this.wrongCauseForLoop(loopFocus).wrongCauseLabel
      })
      : null;
    const previewHighFrequencyPracticeLoop = gameLogic.buildHighFrequencyPracticeLoop
      ? gameLogic.buildHighFrequencyPracticeLoop(
        profile,
        cards,
        reviewEvents,
        {},
        adaptiveChallenge,
        dailyQuestSet,
        {
          retentionLoop: previewRetentionLoop,
          weakKey: this.wrongCauseForLoop(loopFocus).wrongCauseLabel,
          taskType: recentTaskType || 'unknown',
          subject: loopFocus && loopFocus.subject,
          socraticQualityEvaluationSuite,
          courseUnitQuestionBank,
          realHomeworkPressureSamples: realHomeworkCoverage.getRealHomeworkPressureSamples
            ? realHomeworkCoverage.getRealHomeworkPressureSamples({ taskType: recentTaskType || 'unknown' })
            : []
        }
      )
      : null;
    const questArcMission = storage.buildQuestArcGameBridge
      ? storage.buildQuestArcGameBridge({ dailyQuestSet, adaptiveChallenge, evidenceBias })
      : null;
    const recommendations = arcade.recommendGames(cards);
    const selectedGame = (recommendations.find((item) => item.available) || recommendations[0] || {}).id || 'whack';
    const round = this.buildRoundForGame(selectedGame, cards, adaptiveChallenge);
    this.setData({
      summary,
      cards,
      reportSourceContext,
      reportSourcePanel: this.buildReportSourcePanel(reportSourceContext, cards),
      startXp: Number(profile.xp || 0),
      classifications: arcade.classifyCards(cards),
      recommendations,
      visibleRecommendations: this.visibleRecommendations(recommendations, false),
      selectedGame,
      gameMode: selectedGame,
      activeGame: recommendations.find((item) => item.id === selectedGame) || null,
      round,
      currentIndex: 0,
      currentQuestion: this.firstQuestionForRound(round, selectedGame),
      questNodes: this.buildQuestNodes(round, 0),
      revealed: false,
      snakeTrack: selectedGame === 'snake' ? this.firstQuestionForRound(round, selectedGame) : null,
      snakeTiles: selectedGame === 'snake' && round.tracks && round.tracks[0] ? round.tracks[0].tiles : [],
      snakeNextOrder: 0,
      snakeSegments: this.buildSnakeSegments(selectedGame === 'snake' && round.tracks && round.tracks[0], 0),
      showSnakeBody: false,
      matchTiles: selectedGame === 'match' && round.tiles ? round.tiles : [],
      matchSelectedTile: null,
      matchPairsDone: 0,
      moleHoles: this.buildHoles(round.questions && round.questions[0], round.holes),
      lives: Number(adaptiveChallenge.lives || 3),
      combo: 0,
      bestCombo: 0,
      score: 0,
      xpGained: 0,
      answers: [],
      reviewedCardIds: {},
      wrongAnswers: [],
      repairFocus: null,
      dailyQuestSet,
      adaptiveChallenge,
      questArcMission,
      challengeBrief: this.buildChallengeBrief(dailyQuestSet, adaptiveChallenge, questArcMission, evidenceBias, subjectSkillDepth, curriculumSpine, courseUnitMap, courseUnitMasteryTrajectory, courseUnitQuestionBank, commercialDepthRunway, sevenSubjectMasterySprint, questionBankPlayableCards, ruleRetestCards, publicK12IntakeChallengeDeck, publicK12IntakeExecutableCards),
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('arcade') : null,
      subjectSkillDepth,
      curriculumSpine,
      courseUnitMap,
      activeUnitFirstCard: cards[0] && cards[0].source === 'course_unit_question_bank' ? cards[0] : null,
      courseUnitMasteryTrajectory,
      courseUnitQuestionBank,
      commercialDepthRunway,
      sevenSubjectMasterySprint,
      result: null,
      resultAdvice: null,
      gameRetentionLoop: null,
      highFrequencyPracticeLoop: previewHighFrequencyPracticeLoop,
      publicK12IntakeChallengeDeck,
      publicK12IntakeExecutableCards,
      dailyReturnMission: previewHighFrequencyPracticeLoop && previewHighFrequencyPracticeLoop.dailyReturnMission
        ? previewHighFrequencyPracticeLoop.dailyReturnMission
        : null,
      dailyReturnContract: previewHighFrequencyPracticeLoop && previewHighFrequencyPracticeLoop.dailyReturnContract
        ? previewHighFrequencyPracticeLoop.dailyReturnContract
        : null,
      dailyPrimaryRecallAction: previewHighFrequencyPracticeLoop && previewHighFrequencyPracticeLoop.dailyPrimaryRecallAction
        ? previewHighFrequencyPracticeLoop.dailyPrimaryRecallAction
        : null,
      ninetySecondRecallDeck: previewHighFrequencyPracticeLoop && previewHighFrequencyPracticeLoop.ninetySecondPlayableDeck
        ? previewHighFrequencyPracticeLoop.ninetySecondPlayableDeck
        : null,
      ninetySecondRecallState: this.buildNinetySecondRecallState(
        previewHighFrequencyPracticeLoop && previewHighFrequencyPracticeLoop.ninetySecondPlayableDeck
      ),
      reviewReturnSeed: previewHighFrequencyPracticeLoop && previewHighFrequencyPracticeLoop.reviewReturnSeed
        ? previewHighFrequencyPracticeLoop.reviewReturnSeed
        : null,
      nextDayReturnEvidence: previewHighFrequencyPracticeLoop && previewHighFrequencyPracticeLoop.nextDayReturnEvidence
        ? previewHighFrequencyPracticeLoop.nextDayReturnEvidence
        : null,
      emptyGuide: this.emptyGuide(selectedGame, round),
      feedbackText: (round.questions || round.tracks || round.pairs || []).length ? this.openingHint(selectedGame) : '还没有适合游戏化的真实学习卡。'
      ,
      recentTaskType,
      learningBoundLine: todaySession && todaySession.gamePlayed
        ? '今天已经练过了，先去专注或复习吧'
        : this.learningBoundLine(recentTaskType, loopFocus),
      gameBlocked: !!(todaySession && todaySession.gamePlayed)
    });
  },

  wrongCauseForLoop(todayFocus = {}) {
    const plan = todayFocus && todayFocus.nextPracticePlan;
    if (plan && plan.wrongCauseBucket) return plan;
    if (todayFocus && todayFocus.wrongCauseBucket) {
      return {
        wrongCauseBucket: todayFocus.wrongCauseBucket,
        wrongCauseLabel: todayFocus.wrongCauseLabel || '第一步确认',
        checkpoint: todayFocus.checkpoint || '先说自己准备从哪里开始。',
        parentPrompt: todayFocus.parentPrompt || '你第一步先做了什么？',
        nextPracticeText: todayFocus.repairPlan || '把第一步写成一句话，再进入专注。'
      };
    }
    if (storage.wrongCauseFromFirstStep) {
      const cause = storage.wrongCauseFromFirstStep(
        todayFocus && (todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep || todayFocus.title),
        todayFocus && todayFocus.taskType
      );
      return {
        wrongCauseBucket: cause.id,
        wrongCauseLabel: cause.label,
        checkpoint: cause.checkpoint,
        parentPrompt: cause.parentPrompt,
        nextPracticeText: cause.nextPracticeText
      };
    }
    return {
      wrongCauseBucket: 'first_step',
      wrongCauseLabel: '第一步确认',
      checkpoint: '先说自己准备从哪里开始。',
      parentPrompt: '你第一步先做了什么？',
      nextPracticeText: '把第一步写成一句话，再进入专注。'
    };
  },

  loopBoundCards(reviewList = [], taskBoundCards = [], todayFocus = {}) {
    const cause = this.wrongCauseForLoop(todayFocus);
    const taskType = todayFocus && todayFocus.taskType;
    const seen = {};
    const matched = (reviewList || []).filter((card) => {
      if (!card || !card.id) return false;
      if (cause.wrongCauseBucket && card.wrongCauseBucket === cause.wrongCauseBucket) return true;
      if (taskType && taskType !== 'unknown' && card.taskType === taskType) return true;
      const text = [card.question, card.answer, card.weakPoint, card.checkpoint].join(' ');
      return cause.wrongCauseLabel && text.indexOf(cause.wrongCauseLabel) >= 0;
    });
    const bySourceWeight = (card) => {
      if (!card) return 0;
      if (card.source === 'course_unit_question_bank') return 40;
      if (card.source === 'public_k12_homework_intake_queue') return 32;
      if (card.source === 'real_homework_pressure_memory') return 30;
      if (card.due || card.dueReason) return 24;
      if (card.source === 'recent_task_type') return 8;
      return 16;
    };
    return matched.concat(taskBoundCards || [])
      .sort((a, b) => bySourceWeight(b) - bySourceWeight(a))
      .map((card) => Object.assign({}, card, {
        arcadeLoopSource: card.source === 'recent_task_type' ? 'fallback_recent_task_type' : (card.source || 'review_deck'),
        arcadeLoopReason: card.source === 'course_unit_question_bank'
          ? '题库驱动：先练第一步、错因和回访'
          : card.source === 'public_k12_homework_intake_queue'
            ? '公开 K12 入口：先转成可回忆卡'
            : card.source === 'recent_task_type'
              ? '兜底任务卡：没有更具体题库卡时使用'
              : '复习回流：跟随最近错因或到期卡'
      }))
      .filter((card) => {
      const id = card && card.id;
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    }).slice(0, 12);
  },

  cardsForRecentTaskType(taskType, todayFocus = {}) {
    const target = String((todayFocus && (todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep || todayFocus.title)) || '').trim();
    const cause = this.wrongCauseForLoop(todayFocus);
    const map = {
      math_word_problem: [
        { question: '应用题第一眼先找什么？', answer: '数字', hint: '先圈数字和问题句。' },
        { question: '题目问什么要先标哪里？', answer: '问号', hint: '先把问题句读慢一点。' }
      ],
      equation_setup: [
        { question: '列方程前先写什么？', answer: '未知数', hint: '先把未知量写成 x。' },
        { question: '方程中间要找什么？', answer: '等量关系', hint: '先问两边什么相等。' }
      ],
      reading_question: [
        { question: '阅读题先看什么？', answer: '题目问法', hint: '先看细节、主旨还是原因。' },
        { question: '回文定位先找什么？', answer: '关键词', hint: '先圈关键词再回原文。' }
      ],
      english_sentence: [
        { question: '英语句子先找什么？', answer: '主语', hint: '先找谁做动作。' },
        { question: '看时态前先找什么？', answer: '谓语', hint: '先找动作或 be 动词。' }
      ],
      writing_process: [
        { question: '写作开头先写什么？', answer: '一句话', hint: '先写最简单的一句。' },
        { question: '展开前先列什么？', answer: '要点', hint: '先列两个要点。' }
      ],
      unknown: [
        { question: '卡住时先说什么？', answer: '第一步', hint: '先说准备从哪里开始。' }
      ]
    };
    return (map[taskType] || map.unknown).map((item, index) => ({
      id: `task_${taskType}_${index}`,
      question: target ? `${target}：${item.question}` : item.question,
      answer: item.answer,
      hint: `${item.hint} ${cause.checkpoint}`,
      subject: taskType.indexOf('math') >= 0 || taskType.indexOf('equation') >= 0 ? '数学' : '',
      source: 'recent_task_type',
      taskType,
      wrongCauseBucket: cause.wrongCauseBucket,
      wrongCauseLabel: cause.wrongCauseLabel,
      checkpoint: cause.checkpoint,
      parentPrompt: cause.parentPrompt,
      nextPracticePlan: cause
    }));
  },

  learningBoundLine(taskType, todayFocus = {}) {
    const step = todayFocus && (todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep || todayFocus.title);
    const cause = this.wrongCauseForLoop(todayFocus);
    if (step) return `本局跟着最近这一步练：${step}。重点回访：${cause.wrongCauseLabel}`;
    if (taskType && taskType !== 'unknown') return `本局跟着最近题型练：${taskType}`;
    return '先完成一次点拨或错题修复，小游戏会跟着最近题型走。';
  },

  buildRoundForGame(gameId, cards, adaptiveChallenge = this.data.adaptiveChallenge) {
    const size = Math.max(3, Math.min(8, Number(adaptiveChallenge && adaptiveChallenge.roundSize) || 6));
    if (gameId === 'quiz') return arcade.buildQuestRound(cards, { limit: Math.min(size, 8) });
    if (gameId === 'snake') return arcade.buildSnakeRound(cards, { limit: Math.min(size, 6) });
    if (gameId === 'match') return arcade.buildMatchRound(cards, { limit: Math.min(size, 6) });
    return arcade.buildWhackRound(cards, { limit: size });
  },

  buildChallengeBrief(dailyQuestSet = {}, adaptiveChallenge = {}, questArcMission = null, evidenceBias = null, subjectSkillDepth = null, curriculumSpine = null, courseUnitMap = null, courseUnitMasteryTrajectory = null, courseUnitQuestionBank = null, commercialDepthRunway = null, sevenSubjectMasterySprint = null, questionBankPlayableCards = [], ruleRetestCards = [], publicK12IntakeChallengeDeck = [], publicK12IntakeExecutableCards = []) {
    const quests = Array.isArray(dailyQuestSet.quests) ? dailyQuestSet.quests : [];
    const activeQuest = quests.find((item) => item && item.progress < item.target) || quests[0] || {};
    const mode = adaptiveChallenge.mode || 'balanced';
    const labels = {
      repair: '修卡点局',
      balanced: '稳固局',
      stretch: '挑战局'
    };
    const activeCourseUnit = courseUnitMap && courseUnitMap.active && Array.isArray(courseUnitMap.active.units)
      ? courseUnitMap.active.units[0]
      : null;
    const trajectoryRows = courseUnitMasteryTrajectory && Array.isArray(courseUnitMasteryTrajectory.trajectories)
      ? courseUnitMasteryTrajectory.trajectories.slice(0, 3)
      : [];
    const questionBankShareRelayDeck = storage.buildQuestionBankShareRelayDeck
      ? storage.buildQuestionBankShareRelayDeck({
        courseUnitMap,
        courseUnitQuestionBank,
        subjectSkillDepth
      })
      : null;
    const ruleRetestChallenge = Array.isArray(ruleRetestCards) && ruleRetestCards.length ? {
      title: '规则复测挑战',
      line: `${ruleRetestCards.length} 张复测卡进入本局：只说第一步、错因和回访检查点。`,
      xpGate: 'XP 只奖励主动回忆和复测完成，不奖励速度、分数或排名。',
      parentLine: '家长只看三段证据：今晚能说、明天能换题、第 7 天能迁移。',
      cards: ruleRetestCards.slice(0, 3).map((card) => ({
        id: card.id,
        title: card.title || card.note || '复测卡',
        prompt: card.question || card.prompt,
        parentPrompt: card.parentPrompt,
        releaseGate: card.realTrialRuleRetest && card.realTrialRuleRetest.releaseGate
          ? card.realTrialRuleRetest.releaseGate
          : '三段复测证据齐之前，不写长期掌握结论。'
      }))
    } : null;
    const publicK12IntakeChallenge = Array.isArray(publicK12IntakeChallengeDeck) && publicK12IntakeChallengeDeck.length ? {
      id: 'public_k12_homework_intake_executable_loop',
      title: 'Public K12 homework intake challenge loop',
      challengeCount: publicK12IntakeChallengeDeck.length,
      executableCardCount: Array.isArray(publicK12IntakeExecutableCards) ? publicK12IntakeExecutableCards.length : 0,
      route: publicK12IntakeChallengeDeck[0].route || '/pages/arcade/arcade?from=public_k12_intake',
      reviewRoute: publicK12IntakeChallengeDeck[0].reviewRoute || '/pages/review/review?from=public_k12_intake',
      observableFirstMove: publicK12IntakeChallengeDeck[0].observableFirstMove || '',
      fallbackIfNoChildInput: publicK12IntakeChallengeDeck[0].fallbackIfNoChildInput || '',
      receiverMustUseOwnMaterial: publicK12IntakeChallengeDeck[0].receiverMustUseOwnMaterial !== false,
      shareSafeFields: Array.isArray(publicK12IntakeChallengeDeck[0].shareSafeFields) ? publicK12IntakeChallengeDeck[0].shareSafeFields : [],
      blockedFields: Array.isArray(publicK12IntakeChallengeDeck[0].blockedFields) ? publicK12IntakeChallengeDeck[0].blockedFields : [],
      localCodeOwns: Array.isArray(publicK12IntakeChallengeDeck[0].localCodeOwns) ? publicK12IntakeChallengeDeck[0].localCodeOwns : [],
      aiBetterFor: Array.isArray(publicK12IntakeChallengeDeck[0].aiBetterFor) ? publicK12IntakeChallengeDeck[0].aiBetterFor : [],
      aiMustNotOwn: Array.isArray(publicK12IntakeChallengeDeck[0].aiMustNotOwn) ? publicK12IntakeChallengeDeck[0].aiMustNotOwn : [],
      cards: publicK12IntakeChallengeDeck.slice(0, 3).map((card) => ({
        id: card.id,
        subject: card.subject,
        taskType: card.taskType,
        route: card.route,
        reviewRoute: card.reviewRoute,
        observableFirstMove: card.observableFirstMove,
        fallbackIfNoChildInput: card.fallbackIfNoChildInput,
        receiverMustUseOwnMaterial: card.receiverMustUseOwnMaterial !== false,
        blockedFields: Array.isArray(card.blockedFields) ? card.blockedFields : []
      }))
    } : null;
    const firstStepSprintWeakKey = subjectSkillDepth && subjectSkillDepth.firstStep
      ? subjectSkillDepth.firstStep
      : adaptiveChallenge && adaptiveChallenge.bossCard && adaptiveChallenge.bossCard.nextAction
        ? adaptiveChallenge.bossCard.nextAction
        : '同类题第一步';
    const firstStepSprintWrongCause = adaptiveChallenge && adaptiveChallenge.bossCard && adaptiveChallenge.bossCard.key
      ? adaptiveChallenge.bossCard.key
      : activeQuest.id === 'quest_boss_gap'
        ? '高频卡点'
        : '今晚错因';
    const firstStepSprint = {
      id: 'ninety_second_first_step_challenge',
      title: '90 秒同类第一步挑战',
      sourceLine: '来自错题 / 小讲堂 / 家长报告，只练今晚这一处。',
      totalSeconds: 90,
      weakKey: firstStepSprintWeakKey,
      wrongCause: firstStepSprintWrongCause,
      goalLine: `90 秒内完成：说出第一步、指出错因、换一个同类壳还能开口。`,
      rewardLine: 'XP 只记录学习证据，不奖励速度、分数、排行或抄答案。',
      parentLine: '家长只听第一步是否说清，不追问完整答案。',
      nextDayLine: '明天只回访同一第一步，过了再放小变式。',
      route: '/pages/arcade/arcade?from=90s_first_step_challenge',
      reviewRoute: '/pages/review/review?from=90s_first_step_challenge',
      safetyLine: '不带原题、完整答案、分数、排名或完整对话。',
      checkpoints: [
        { id: 'say_first_step', label: '说出第一步', evidence: 'student_first_step' },
        { id: 'name_wrong_cause', label: '指出错因', evidence: 'wrong_cause_named' },
        { id: 'near_transfer_open', label: '同类换壳能开口', evidence: 'near_transfer_first_move' }
      ]
    };
    return {
      mode,
      modeLabel: labels[mode] || labels.balanced,
      roundSize: Number(adaptiveChallenge.roundSize || 0),
      targetAccuracy: Number(adaptiveChallenge.targetAccuracy || 0),
      questTitle: activeQuest.id === 'quest_boss_gap'
        ? '先处理一个高频卡点'
        : activeQuest.id === 'quest_repair_due_cards'
          ? '先清一组待回访卡'
          : '先说清今晚第一步',
      questProgress: `${Number(activeQuest.progress || 0)} / ${Number(activeQuest.target || 1)}`,
      activeQuestId: activeQuest.id || '',
      activeQuestRoute: activeQuest.route || '',
      activeQuestLabel: activeQuest.id === 'quest_boss_gap'
        ? '先修这个 boss'
        : activeQuest.id === 'quest_repair_due_cards'
          ? '去修这组卡'
          : activeQuest.id === 'quest_focus_round'
            ? '去做 90 秒回流'
            : activeQuest.id === 'quest_arcade_precision'
              ? '去做一局精准练习'
              : '去完成这个 quest',
      questActions: quests.slice(0, 4).map((item) => ({
        id: item.id,
        label: item.id === 'quest_boss_gap'
          ? '先修 boss'
          : item.id === 'quest_repair_due_cards'
            ? '去修卡'
            : item.id === 'quest_focus_round'
              ? '去回流'
              : item.id === 'quest_arcade_precision'
                ? '去冲准确率'
                : '去完成',
        route: item.route || '/pages/tutor/tutor',
        evidenceRequired: Array.isArray(item.evidenceRequired) ? item.evidenceRequired : [],
        progressText: `${Number(item.progress || 0)} / ${Number(item.target || 1)}`
      })),
      rewardLine: activeQuest.rewardXp ? `完成后写入 ${activeQuest.rewardXp} 点学习记录` : '完成后写入学习记录',
      bossLine: adaptiveChallenge.bossCard
        ? `本局重点：${adaptiveChallenge.bossCard.nextAction || adaptiveChallenge.bossCard.key}`
        : '本局重点会跟随错因记录变化',
      storyTitle: questArcMission && questArcMission.title ? questArcMission.title : '',
      storyLine: questArcMission && questArcMission.missionLine ? questArcMission.missionLine : '',
      storyRule: questArcMission && questArcMission.playRule ? questArcMission.playRule : '',
      storyEvidence: questArcMission && Array.isArray(questArcMission.evidenceRequired)
        ? questArcMission.evidenceRequired.join(' / ')
        : '',
      publicK12IntakeChallenge,
      firstStepSprint,
      firstStepSprintCheckpoints: firstStepSprint.checkpoints,
      publicK12IntakeChallengeCount: publicK12IntakeChallenge ? publicK12IntakeChallenge.challengeCount : 0,
      publicK12IntakeExecutableCardCount: publicK12IntakeChallenge ? publicK12IntakeChallenge.executableCardCount : 0,
      evidenceBiasSource: evidenceBias && evidenceBias.source ? evidenceBias.source : '',
      evidenceBiasLine: evidenceBias && evidenceBias.reasonLine ? evidenceBias.reasonLine : '',
      subjectDepthLabel: subjectSkillDepth && subjectSkillDepth.label ? subjectSkillDepth.label : '',
      subjectDepthLine: subjectSkillDepth && subjectSkillDepth.firstStep
        ? `${subjectSkillDepth.label} · ${subjectSkillDepth.firstStep}`
        : '',
      subjectDepthGameDrills: subjectSkillDepth && Array.isArray(subjectSkillDepth.gameDrills)
        ? subjectSkillDepth.gameDrills.slice(0, 3)
        : [],
      subjectDepthGameLine: subjectSkillDepth && Array.isArray(subjectSkillDepth.gameDrills)
        ? subjectSkillDepth.gameDrills.slice(0, 3).join(' / ')
        : '',
      subjectDepthEvidenceLine: subjectSkillDepth && Array.isArray(subjectSkillDepth.evidenceRequired)
        ? subjectSkillDepth.evidenceRequired.join(' / ')
        : '',
      curriculumTitle: curriculumSpine && curriculumSpine.title ? curriculumSpine.title : '',
      curriculumLine: curriculumSpine && curriculumSpine.gameLine ? curriculumSpine.gameLine : '',
      curriculumProgression: curriculumSpine && Array.isArray(curriculumSpine.progression)
        ? curriculumSpine.progression
        : [],
      curriculumScaleLine: curriculumSpine && curriculumSpine.scaleLine ? curriculumSpine.scaleLine : '',
      courseUnitTitle: activeCourseUnit ? `${activeCourseUnit.subjectLabel} · ${activeCourseUnit.unitLabel}` : '',
      courseUnitLine: activeCourseUnit ? activeCourseUnit.practiceLoop.recall : '',
      courseUnitWrongCauseLine: activeCourseUnit && Array.isArray(activeCourseUnit.wrongCauseAtlas)
        ? activeCourseUnit.wrongCauseAtlas.slice(0, 3).join(' / ')
        : '',
      courseUnitQuestionTypes: activeCourseUnit && Array.isArray(activeCourseUnit.reusableQuestionTypes)
        ? activeCourseUnit.reusableQuestionTypes
        : [],
      courseUnitReportContract: activeCourseUnit ? activeCourseUnit.reportContract : '',
      courseUnitShareContract: activeCourseUnit ? activeCourseUnit.shareContract : '',
      courseUnitPracticeDeckTitle: courseUnitMasteryTrajectory ? courseUnitMasteryTrajectory.title : '',
      courseUnitPracticeDeckLine: courseUnitMasteryTrajectory ? courseUnitMasteryTrajectory.summary : '',
      courseUnitPracticeDeck: trajectoryRows.map((item) => ({
        id: item.id,
        label: item.unitLabel,
        masteryScore: item.masteryScore,
        risk: item.regressionRisk,
        nextEvidence: item.nextEvidence,
        action: item.parentInterventionLevel
      })),
      courseUnitQuestionBankTitle: courseUnitQuestionBank ? courseUnitQuestionBank.title : '',
      courseUnitQuestionBankLine: courseUnitQuestionBank ? courseUnitQuestionBank.summary : '',
      courseUnitQuestionBankCards: courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.activeCards)
        ? courseUnitQuestionBank.activeCards.slice(0, 6)
        : [],
      questionBankPlayableLine: questionBankPlayableCards.length
        ? `本局已接入 ${questionBankPlayableCards.length} 张题型卡：只练第一步、错因和回访，不新增完整答案。`
        : '',
      questionBankPlayableCards,
      ruleRetestChallengeTitle: ruleRetestChallenge ? ruleRetestChallenge.title : '',
      ruleRetestChallengeLine: ruleRetestChallenge ? ruleRetestChallenge.line : '',
      ruleRetestChallengeXpGate: ruleRetestChallenge ? ruleRetestChallenge.xpGate : '',
      ruleRetestChallengeParentLine: ruleRetestChallenge ? ruleRetestChallenge.parentLine : '',
      ruleRetestChallengeCards: ruleRetestChallenge ? ruleRetestChallenge.cards : [],
      questionBankShareRelayDeckTitle: questionBankShareRelayDeck ? questionBankShareRelayDeck.title : '',
      questionBankShareRelayDeckLine: questionBankShareRelayDeck ? questionBankShareRelayDeck.gameRule : '',
      questionBankShareRelayParentLine: questionBankShareRelayDeck ? questionBankShareRelayDeck.parentDecisionLine : '',
      questionBankShareRelayCards: questionBankShareRelayDeck && Array.isArray(questionBankShareRelayDeck.relayCards)
        ? questionBankShareRelayDeck.relayCards.slice(0, 4)
        : [],
      questionBankShareRelayWindows: questionBankShareRelayDeck && Array.isArray(questionBankShareRelayDeck.reviewWindows)
        ? questionBankShareRelayDeck.reviewWindows
        : [],
      commercialDepthRunwayTitle: commercialDepthRunway ? commercialDepthRunway.title : '',
      commercialDepthRunwayLine: commercialDepthRunway ? commercialDepthRunway.gameLine : '',
      commercialDepthRunwayBoundary: commercialDepthRunway ? commercialDepthRunway.boundary : '',
      commercialDepthRunwayLanes: commercialDepthRunway && Array.isArray(commercialDepthRunway.lanes)
        ? commercialDepthRunway.lanes
        : [],
      commercialDepthMemoryCadence: commercialDepthRunway && Array.isArray(commercialDepthRunway.memoryCadence)
        ? commercialDepthRunway.memoryCadence
        : [],
      sevenSubjectMasterySprintTitle: sevenSubjectMasterySprint ? sevenSubjectMasterySprint.title : '',
      sevenSubjectMasterySprintLine: sevenSubjectMasterySprint ? sevenSubjectMasterySprint.gameIntensityLine : '',
      sevenSubjectMasterySprintMoat: sevenSubjectMasterySprint ? sevenSubjectMasterySprint.moatLine : '',
      sevenSubjectMasterySprintLanes: sevenSubjectMasterySprint && Array.isArray(sevenSubjectMasterySprint.lanes)
        ? sevenSubjectMasterySprint.lanes
        : [],
      sevenSubjectMasterySprintSubjects: sevenSubjectMasterySprint && Array.isArray(sevenSubjectMasterySprint.subjects)
        ? sevenSubjectMasterySprint.subjects.slice(0, 3)
        : []
    };
  },

  goQuestRoute(event) {
    const route = event.currentTarget.dataset.route || '/pages/tutor/tutor';
    const questId = event.currentTarget.dataset.questId || 'daily_quest';
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'arcade',
        dimensionId: questId,
        label: event.currentTarget.dataset.label || 'daily quest',
        route,
        readiness: 'quest_entry'
      });
    }
    if (/^public_k12/.test(questId) && storage.appendReviewEvent) {
      const publicK12 = this.data.challengeBrief && this.data.challengeBrief.publicK12IntakeChallenge
        ? this.data.challengeBrief.publicK12IntakeChallenge
        : {};
      const sourceCard = {
        id: dataset.challengeId || '',
        subject: dataset.subject || '',
        taskType: dataset.taskType || '',
        route: dataset.route || route,
        reviewRoute: dataset.reviewRoute || '',
        observableFirstMove: dataset.firstStep || '',
        fallbackIfNoChildInput: dataset.fallback || ''
      };
      const fallbackCard = Array.isArray(publicK12.cards) && publicK12.cards.length ? publicK12.cards[0] : {};
      const selectedCard = Object.assign({}, fallbackCard, sourceCard.id || sourceCard.subject || sourceCard.taskType ? sourceCard : {});
      storage.appendReviewEvent({
        eventType: 'public_k12_challenge_selected',
        source: 'public_k12_homework_intake',
        sourceChallengeId: selectedCard.id || publicK12.id || questId,
        subject: selectedCard.subject || '',
        taskType: selectedCard.taskType || '',
        route,
        reviewRoute: selectedCard.reviewRoute || publicK12.reviewRoute || '/pages/review/review?from=public_k12_intake',
        firstStepRequired: selectedCard.observableFirstMove || publicK12.observableFirstMove || '先说出题目问什么和第一步入口',
        fallbackIfNoChildInput: selectedCard.fallbackIfNoChildInput || publicK12.fallbackIfNoChildInput || '回到苏格拉底追问，不给整题答案',
        due: true,
        dueWindow: questId === 'public_k12_review' ? '明天 5 分钟' : '本局后生成回访',
        releaseGate: 'child_can_say_first_step_before_reward',
        blockedFields: publicK12.blockedFields || ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue']
      });
      if (storage.set) {
        const reviewContext = {
          id: selectedCard.id || publicK12.id || questId,
          title: selectedCard.title || publicK12.title || '公开K12第一步回访',
          subject: selectedCard.subject || '',
          taskType: selectedCard.taskType || '',
          route,
          reviewRoute: selectedCard.reviewRoute || publicK12.reviewRoute || '/pages/review/review?from=public_k12_intake',
          firstStepRequired: selectedCard.observableFirstMove || publicK12.observableFirstMove || '先说出题目问什么和第一步入口',
          fallbackIfNoChildInput: selectedCard.fallbackIfNoChildInput || publicK12.fallbackIfNoChildInput || '回到苏格拉底追问，不给整题答案',
          blockedFields: publicK12.blockedFields || ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue'],
          selectedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          releaseGate: 'child_can_say_first_step_before_reward'
        };
        storage.set('arcade.publicK12.selectedChallenge.v1', {
          id: reviewContext.id,
          subject: reviewContext.subject,
          taskType: reviewContext.taskType,
          route,
          reviewRoute: reviewContext.reviewRoute,
          selectedAt: reviewContext.selectedAt,
          releaseGate: reviewContext.releaseGate
        });
        storage.set('publicK12.reviewContext.v1', reviewContext);
      }
    }
    navigation.navigateLearningRoute(route);
  },

  openingHint(gameId) {
    if (gameId === 'quiz') return '先在心里说一遍，再核对思路自评。不会的卡会回到复习队列。';
    if (gameId === 'snake') return '按正确顺序吃掉步骤块，吃错的步骤会回到复习队列。';
    if (gameId === 'match') return '先点一个题泡泡，再点对应泡泡。错配会回到复习队列。';
    return '今天只开一小局，答错的卡会回到复习队列。';
  },

  emptyGuide(gameId, round) {
    const total = Number((round && round.total) || 0);
    if (total > 0) return null;
    const guides = {
      whack: {
        title: '缺少短回忆卡',
        body: '打地鼠适合口算、单词、年代、符号这类能快速回答的卡。',
        cta: '去生成短卡',
        action: 'goTools'
      },
      quiz: {
        title: '缺少概念轻练卡',
        body: '轻练答题适合原因、定义、关系、应用题思路这类需要先回忆再解释的卡。',
        cta: '去生成概念卡',
        action: 'goTools'
      },
      snake: {
        title: '缺少顺序步骤卡',
        body: '贪吃蛇适合解题步骤、实验流程、历史时间线和操作顺序。',
        cta: '去生成步骤卡',
        action: 'goTools'
      },
      match: {
        title: '缺少短对应卡',
        body: '泡泡消适合单词-释义、年代-事件、符号-含义这类一问一答的短卡。',
        cta: '去生成对应卡',
        action: 'goTools'
      }
    };
    return guides[gameId] || {
      title: '还没有可玩的真实卡片',
      body: '先从作业、错题或教材章节生成学习卡，再回来轻回访。',
      cta: '去生成学习卡',
      action: 'goTools'
    };
  },

  firstQuestionForRound(round, gameId) {
    if (gameId === 'snake') return (round.tracks && round.tracks[0]) || null;
    if (gameId === 'match') return (round.pairs && round.pairs[0]) || null;
    return (round.questions && round.questions[0]) || null;
  },

  buildQuestNodes(round, currentIndex = 0) {
    return ((round && round.questions) || []).map((question, index) => ({
      id: question.id || question.cardId || `quest_${index}`,
      label: index + 1,
      stateClass: index < currentIndex ? 'done' : (index === currentIndex ? 'active' : '')
    }));
  },

  buildSnakeSegments(track, snakeNextOrder = 0) {
    return ((track && track.correctOrder) || []).map((item, index) => ({
      id: `${item}_${index}`,
      label: index + 1,
      stateClass: index < snakeNextOrder ? 'eaten' : ''
    }));
  },

  visibleRecommendations(recommendations, expanded) {
    const limit = expanded ? 9 : 4;
    const list = recommendations || [];
    const ready = list.filter((item) => item.status === 'ready');
    return ready.slice(0, limit);
  },

  buildHoles(question, holeCount = 9) {
    const total = Math.max(4, Math.min(9, Number(holeCount || 9)));
    if (!question) {
      return Array.from({ length: total }, (_, index) => ({ id: `empty_${index}`, label: '', active: false }));
    }
    const choices = (question.choices || []).slice(0, Math.min(4, total));
    const holeTargets = Array.isArray(question.holeTargets) && question.holeTargets.length >= choices.length
      ? question.holeTargets
      : arcade.buildHoleTargets(question.cardId || question.id, choices.length, total);
    const holes = Array.from({ length: total }, (_, index) => ({
      id: `hole_${question.id}_${index}`,
      label: '',
      active: false,
      correct: false,
      cardId: question.cardId
    }));
    choices.forEach((choice, idx) => {
      const target = Number(holeTargets[idx]);
      holes[target] = Object.assign({}, holes[target], {
        label: choice,
        active: true,
        correct: choice === question.answer
      });
    });
    return holes;
  },

  selectGame(event) {
    const gameId = event.currentTarget.dataset.id || 'whack';
    const game = this.data.recommendations.find((item) => item.id === gameId);
    if (!game || !game.available) {
      this.setData({ feedbackText: (game && game.lockedReason) || '先生成真实学习卡后再玩这个玩法。' });
      return;
    }
    const round = this.buildRoundForGame(gameId, this.data.cards, this.data.adaptiveChallenge);
    this.setData({
      selectedGame: gameId,
      gameMode: gameId,
      activeGame: game,
      round,
      currentIndex: 0,
      currentQuestion: this.firstQuestionForRound(round, gameId),
      questNodes: this.buildQuestNodes(round, 0),
      revealed: false,
      quizRecallEvidence: null,
      snakeTrack: gameId === 'snake' ? this.firstQuestionForRound(round, gameId) : null,
      snakeTiles: gameId === 'snake' && round.tracks && round.tracks[0] ? round.tracks[0].tiles : [],
      snakeNextOrder: 0,
      snakeSegments: this.buildSnakeSegments(gameId === 'snake' && round.tracks && round.tracks[0], 0),
      showSnakeBody: false,
      matchTiles: gameId === 'match' && round.tiles ? round.tiles : [],
      matchSelectedTile: null,
      matchPairsDone: 0,
      moleHoles: this.buildHoles(round.questions && round.questions[0], round.holes),
      lives: Number((this.data.adaptiveChallenge && this.data.adaptiveChallenge.lives) || 3),
      combo: 0,
      bestCombo: 0,
      score: 0,
      xpGained: 0,
      answers: [],
      reviewedCardIds: {},
      wrongAnswers: [],
      repairFocus: null,
      result: null,
      resultAdvice: null,
      emptyGuide: this.emptyGuide(gameId, round),
      feedbackText: this.openingHint(gameId)
    });
  },

  toggleMatrix() {
    const expandedMatrix = !this.data.expandedMatrix;
    this.setData({
      expandedMatrix,
      visibleRecommendations: this.visibleRecommendations(this.data.recommendations, expandedMatrix)
    });
  },

  canPlayGameAction(action = 'play') {
    const todaySession = storage.getTodaySession ? storage.getTodaySession() : {};
    const blocked = !!(this.data.gameBlocked || todaySession.gamePlayed);
    if (!blocked) return true;
    this.setData({
      gameBlocked: true,
      learningBoundLine: '今天的游戏奖励已经结算。继续学习请走回访卡或明天再来。',
      feedbackText: '今天的游戏奖励已经结算。继续学习请走回访卡或明天再来，避免重复刷奖励。'
    });
    if (storage.appendReviewEvent) {
      storage.appendReviewEvent({
        kind: 'arcade_blocked_repeat_action',
        action,
        game_type: this.data.selectedGame || '',
        result: 'blocked',
        xp: 0
      });
    }
    return false;
  },

  tapMatchTile(event) {
    if (!this.canPlayGameAction('tap_match_tile')) return;
    if (this.data.result || this.data.gameMode !== 'match') return;
    const tileId = event.currentTarget.dataset.id;
    const tile = (this.data.matchTiles || []).find((item) => item.id === tileId);
    if (!tile || tile.matched) return;
    const selected = this.data.matchSelectedTile;
    if (!selected) {
      this.setData({
        matchSelectedTile: tile,
        matchTiles: this.data.matchTiles.map((item) => Object.assign({}, item, {
          selected: item.id === tile.id,
          missed: false
        })),
        feedbackText: `泡泡发光了：${tile.text}。再点它的另一半。`
      });
      return;
    }
    if (selected.id === tile.id) {
      this.setData({
        matchSelectedTile: null,
        matchTiles: this.data.matchTiles.map((item) => Object.assign({}, item, { selected: false })),
        feedbackText: '已取消选择。'
      });
      return;
    }
    if (selected.side === tile.side) {
      this.setData({
        matchSelectedTile: tile,
        matchTiles: this.data.matchTiles.map((item) => Object.assign({}, item, {
          selected: item.id === tile.id,
          missed: false
        })),
        feedbackText: `已换成：${tile.text}。再点它的另一半。`
      });
      return;
    }
    const correct = selected.pairId === tile.pairId && selected.side !== tile.side;
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (correct ? 16 + Math.max(0, combo - 1) * 2 : 0);
    const answerRecord = arcade.buildMatchAnswerRecord(
      selected,
      tile,
      (this.data.round && this.data.round.pairs) || []
    );
    if (answerRecord.recordable === false) {
      this.setData({ matchSelectedTile: null });
      return;
    }
    const answers = this.data.answers.concat([answerRecord]);
    const xpAccepted = this.recordCardResult(answerRecord.cardId, correct, correct ? 'good' : 'again', 'match');
    const matchPairsDone = this.data.matchPairsDone + (correct ? 1 : 0);
    const nextTiles = this.data.matchTiles.map((item) => {
      const isPair = correct && item.pairId === tile.pairId;
      return Object.assign({}, item, {
        matched: item.matched || isPair,
        selected: false,
        missed: !correct && (item.id === tile.id || item.id === selected.id)
      });
    });

    if (lives <= 0 || matchPairsDone >= this.data.round.total) {
      this.setData({
        matchTiles: nextTiles,
        matchSelectedTile: null,
        matchPairsDone,
        answers
      });
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }

    this.setData({
      matchTiles: nextTiles,
      matchSelectedTile: null,
      matchPairsDone,
      lives,
      combo,
      bestCombo,
      score,
      xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
      answers,
      feedbackText: correct ? `啵，这一对留证成功。连续留证 ${combo}` : `这对没有粘住。正确关系：${answerRecord.answer}`
    });
  },

  revealAnswer() {
    if (!this.canPlayGameAction('reveal_answer')) return;
    if (!this.data.currentQuestion || this.data.result) return;
    const evidence = this.data.quizRecallEvidence || {};
    if (!evidence.student_first_step) {
      this.setData({ feedbackText: '先遮住答案，说出第一步，再核对思路。' });
      return;
    }
    this.setData({
      revealed: true,
      quizRecallEvidence: Object.assign({}, evidence, {
        answer_hidden: true,
        reveal_after_first_step: true
      }),
      feedbackText: '核对思路后，按真实掌握程度选择。'
    });
  },

  captureQuizFirstStep() {
    if (!this.canPlayGameAction('capture_quiz_first_step')) return;
    if (!this.data.currentQuestion || this.data.result || this.data.revealed) return;
    const current = this.data.currentQuestion || {};
    this.setData({
      quizRecallEvidence: {
        answer_hidden: true,
        student_first_step: true,
        wrong_cause_named: false,
        next_day_revisit_locked: false,
        cardId: current.cardId || current.id || '',
        evidenceMode: 'local_active_recall_before_reveal'
      },
      feedbackText: '已记录：先说第一步。现在可以核对思路。'
    });
  },

  gradeQuest(event) {
    if (!this.canPlayGameAction('grade_quest')) return;
    if (this.data.result || !this.data.currentQuestion || !this.data.revealed) return;
    const rating = event.currentTarget.dataset.rating || 'again';
    const current = this.data.currentQuestion;
    const correct = rating !== 'again';
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (rating === 'easy' ? 18 : rating === 'good' ? 14 : 0);
    const answers = this.data.answers.concat([{
      cardId: current.cardId,
      correct,
      selected: rating === 'easy' ? '记得' : rating === 'good' ? '模糊' : '忘记',
      answer: current.answer,
      rating,
      gameType: 'quiz',
      recallEvidence: Object.assign({}, this.data.quizRecallEvidence || {}, {
        wrong_cause_named: !correct,
        next_day_revisit_locked: true
      })
    }]);
    const xpAccepted = this.recordCardResult(current.cardId, correct, rating, 'quiz');
    const nextIndex = this.data.currentIndex + 1;
    if (lives <= 0 || nextIndex >= this.data.round.questions.length) {
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }
    const nextQuestion = this.data.round.questions[nextIndex];
    this.setData({
      currentIndex: nextIndex,
      currentQuestion: nextQuestion,
      questNodes: this.buildQuestNodes(this.data.round, nextIndex),
      revealed: false,
      quizRecallEvidence: null,
      lives,
      combo,
      bestCombo,
      score,
      xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
      answers,
      feedbackText: correct ? '继续下一关。先回忆，再核对思路。' : `参考思路：${current.answer}。这张卡会回到复习队列。`
    });
  },

  tapSnakeTile(event) {
    if (!this.canPlayGameAction('tap_snake_tile')) return;
    if (this.data.result || !this.data.snakeTrack) return;
    const tileId = event.currentTarget.dataset.id;
    const tile = (this.data.snakeTiles || []).find((item) => item.id === tileId);
    if (!tile || tile.eaten) return;
    const current = this.data.snakeTrack;
    const correct = Number(tile.order) === Number(this.data.snakeNextOrder || 0);
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (correct ? 12 + Math.max(0, combo - 1) : 0);
    const nextTiles = this.data.snakeTiles.map((item) => item.id === tile.id ? Object.assign({}, item, {
      eaten: correct,
      missed: !correct
    }) : item);
    const completedTrack = correct && Number(this.data.snakeNextOrder || 0) + 1 >= current.correctOrder.length;
    const answers = completedTrack || !correct
      ? this.data.answers.concat([{
        cardId: current.cardId,
        correct,
        selected: tile.text,
        answer: current.correctOrder.join(' -> '),
        gameType: 'snake'
      }])
      : this.data.answers;
    const xpAccepted = completedTrack || !correct
      ? this.recordCardResult(current.cardId, correct, correct ? 'good' : 'again', 'snake')
      : 0;

    if (!correct) {
      this.setData({ snakeTiles: nextTiles });
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }

    if (completedTrack) {
      const nextIndex = this.data.currentIndex + 1;
      if (nextIndex >= this.data.round.tracks.length) {
        this.finishRound(answers, bestCombo, score, lives);
        return;
      }
      const nextTrack = this.data.round.tracks[nextIndex];
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: nextTrack,
        snakeTrack: nextTrack,
        snakeTiles: nextTrack.tiles,
        snakeNextOrder: 0,
        snakeSegments: this.buildSnakeSegments(nextTrack, 0),
        showSnakeBody: false,
        lives,
        combo,
        bestCombo,
        score,
        xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
        answers,
        feedbackText: '小藤吃完整条顺序了，继续下一条。'
      });
      return;
    }

    this.setData({
      snakeTiles: nextTiles,
      snakeNextOrder: Number(this.data.snakeNextOrder || 0) + 1,
      snakeSegments: this.buildSnakeSegments(this.data.snakeTrack, Number(this.data.snakeNextOrder || 0) + 1),
      showSnakeBody: true,
      lives,
      combo,
      bestCombo,
      score,
      answers,
      feedbackText: `小藤吃对了：${tile.text}`
    });
  },

  tapHole(event) {
    if (!this.canPlayGameAction('tap_hole')) return;
    if (this.data.result || !this.data.currentQuestion) return;
    const index = Number(event.currentTarget.dataset.index || 0);
    const hole = this.data.moleHoles[index];
    if (!hole || !hole.active) return;

    const current = this.data.currentQuestion;
    const correct = !!hole.correct;
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (correct ? 10 + Math.max(0, combo - 1) * 2 : 0);
    const answers = this.data.answers.concat([{
      cardId: current.cardId,
      correct,
      selected: hole.label,
      answer: current.answer,
      gameType: 'whack'
    }]);

    const xpAccepted = this.recordCardResult(current.cardId, correct, correct ? 'good' : 'again', 'whack');

    const nextIndex = this.data.currentIndex + 1;
    if (lives <= 0 || nextIndex >= this.data.round.questions.length) {
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }

    const nextQuestion = this.data.round.questions[nextIndex];
    this.setData({
      currentIndex: nextIndex,
      currentQuestion: nextQuestion,
      questNodes: this.buildQuestNodes(this.data.round, nextIndex),
      moleHoles: this.buildHoles(nextQuestion, this.data.round.holes),
      lives,
      combo,
      bestCombo,
      score,
      xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
      answers,
      feedbackText: correct ? `芽锤敲中！连续留证 ${combo}` : `参考思路：${current.answer}。这张卡会回到复习队列。`
    });
  },

  xpEvidenceForCard(cardId, correct, gameType) {
    const card = (this.data.cards || []).find((item) => item && (item.id === cardId || item.cardId === cardId)) || {};
    const quizEvidence = this.data.quizRecallEvidence || {};
    const explicitFirstStep = !!(quizEvidence.student_first_step || quizEvidence.child_first_step || quizEvidence.first_step_spoken);
    const explicitWrongCause = !!(quizEvidence.wrong_cause_named || quizEvidence.child_wrong_cause || quizEvidence.wrong_cause_spoken);
    const explicitRevisit = !!(quizEvidence.next_day_revisit_locked || quizEvidence.next_revisit_locked || quizEvidence.revisit_committed);
    return Object.assign({}, quizEvidence, {
      student_first_step: explicitFirstStep,
      wrong_cause_named: explicitWrongCause,
      next_day_revisit_locked: explicitRevisit,
      hint_first_step_available: !!(card.checkpoint || card.answer || card.childArticulatedStep),
      hint_wrong_cause_available: !!(card.wrongCauseLabel || card.weakPoint || !correct),
      hint_revisit_available: !!(card.nextPracticePlan || card.next_practice || card.revisitWindow),
      card_id: cardId,
      game_type: gameType || this.data.selectedGame || 'whack'
    });
  },

  recordCardResult(cardId, correct, rating, gameType) {
    if (!this.canPlayGameAction('record_card_result')) return 0;
    if (!cardId) return 0;
    const reviewedCardIds = this.data.reviewedCardIds || {};
    if (reviewedCardIds[cardId]) {
      storage.appendReviewEvent({
        kind: 'arcade_attempt_duplicate',
        game_type: gameType || this.data.selectedGame || 'whack',
        card_id: cardId,
        review_rating: rating || (correct ? 'good' : 'again'),
        result: correct ? 'correct' : 'wrong',
        xp: 0
      });
      return 0;
    }
    const reviewRating = rating || (correct ? 'good' : 'again');
    const before = storage.loadGameProfile ? storage.loadGameProfile() : {};
    const xpEvidence = this.xpEvidenceForCard(cardId, correct, gameType);
    reviewCards.reviewCard(cardId, reviewRating, { xpEvidence });
    const after = storage.loadGameProfile ? storage.loadGameProfile() : before;
    const xpAccepted = Math.max(0, Number(after.xp || 0) - Number(before.xp || 0));
    storage.appendReviewEvent({
      kind: 'arcade_attempt',
      game_type: gameType || this.data.selectedGame || 'whack',
      card_id: cardId,
      review_rating: reviewRating,
      result: correct ? 'correct' : 'wrong',
      xp: xpAccepted,
      xp_evidence_gate: xpEvidence
    });
    this.setData({
      reviewedCardIds: Object.assign({}, reviewedCardIds, {
        [cardId]: true
      })
    });
    return xpAccepted;
  },

  buildQuestionProgressionSignal(result = {}, wrongAnswers = []) {
    const bank = this.data.courseUnitQuestionBank || {};
    const activeCards = Array.isArray(bank.activeCards) ? bank.activeCards : [];
    const progressionCards = activeCards.filter((card) => card && card.progression);
    const first = progressionCards[0] || {};
    const progression = first.progression || {};
    const accuracy = Number(result.accuracy || 0);
    const status = accuracy >= 80 && !wrongAnswers.length ? 'mastery_gate_ready' : 'needs_next_revisit';
    return {
      status,
      activeCardCount: progressionCards.length,
      stageCount: progressionCards.reduce((sum, card) => sum + Number(card.progression && card.progression.stageCount || 0), 0),
      masteryGateCount: progressionCards.filter((card) => card.progression && card.progression.masteryGate).length,
      nextDayRevisit: progression.nextDayRevisit || '明天只回访一张最不稳的题型卡。',
      masteryGate: progression.masteryGate || '第一步、错因、近迁移连续稳定两次再通过。',
      parentEvidence: progression.parentEvidence || '家长只看第一步、错因和回访证据，不看分数排名。',
      visualBoardStep: progression.visualBoardStep || '',
      safetyBoundary: progression.safetyBoundary || '不生成完整答案，不替孩子写过程。'
    };
  },

  finishRound(answers, bestCombo, score, lives) {
    if (!this.canPlayGameAction('finish_round')) return;
    const result = arcade.summarizeAttempt({
      gameType: this.data.selectedGame || 'whack',
      expectedTotal: this.data.round.total,
      bestCombo,
      answers
    });
    const profile = storage.loadGameProfile ? storage.loadGameProfile() : {};
    const xpGained = Math.max(0, Number(profile.xp || 0) - Number(this.data.startXp || 0));
    const recallEvidence = answers
      .map((item) => item && item.recallEvidence)
      .filter(Boolean);
    const savedResult = Object.assign({}, result, {
      xp: xpGained,
      recallEvidence,
      activeRecallEvidenceComplete: recallEvidence.some((item) => item.student_first_step && item.next_day_revisit_locked)
    });
    const wrongAnswers = arcade.uniqueWrongAnswers(answers);
    const repairFocus = wrongAnswers.length ? arcade.buildRepairFocus(wrongAnswers[0], this.data.cards) : null;
    const reportSourceContext = this.data.reportSourceContext || {};
    const gameRetention = storage.recordGameSessionResult
      ? storage.recordGameSessionResult(savedResult, {
        gameType: savedResult.gameType,
        reportId: reportSourceContext.reportId || '',
        flowTraceId: reportSourceContext.flowTraceId || '',
        route: reportSourceContext.returnRoute || '/pages/arcade/arcade',
        parentCheck: reportSourceContext.line || ''
      })
      : null;
    const gameRetentionLoop = gameLogic.buildGameRetentionLoop
      ? gameLogic.buildGameRetentionLoop(
        gameRetention && gameRetention.profile ? gameRetention.profile : profile,
        savedResult,
        this.data.adaptiveChallenge,
        this.data.dailyQuestSet,
        { weakKey: repairFocus && repairFocus.title ? repairFocus.title : '' }
      )
      : null;
    const socraticQualityEvaluationSuite = tutorLadder.buildSocraticQualityEvaluationSuite
      ? tutorLadder.buildSocraticQualityEvaluationSuite(this.data.recentTaskType || 'unknown')
      : null;
    const highFrequencyPracticeLoop = gameLogic.buildHighFrequencyPracticeLoop
      ? gameLogic.buildHighFrequencyPracticeLoop(
        gameRetention && gameRetention.profile ? gameRetention.profile : profile,
        this.data.cards,
        storage.loadReviewEvents ? storage.loadReviewEvents() : [],
        savedResult,
        this.data.adaptiveChallenge,
        this.data.dailyQuestSet,
        {
          retentionLoop: gameRetentionLoop,
          weakKey: repairFocus && repairFocus.title ? repairFocus.title : '',
          taskType: this.data.recentTaskType || 'unknown',
          socraticQualityEvaluationSuite,
          courseUnitQuestionBank: this.data.courseUnitQuestionBank,
          realHomeworkPressureSamples: realHomeworkCoverage.getRealHomeworkPressureSamples
            ? realHomeworkCoverage.getRealHomeworkPressureSamples({ taskType: this.data.recentTaskType || 'unknown' })
            : []
        }
      )
      : null;
    const socraticQualityMemoryBridge = highFrequencyPracticeLoop && highFrequencyPracticeLoop.socraticQualityMemoryBridge
      ? highFrequencyPracticeLoop.socraticQualityMemoryBridge
      : null;
    const questionBankMemoryBridge = highFrequencyPracticeLoop && highFrequencyPracticeLoop.questionBankMemoryBridge
      ? highFrequencyPracticeLoop.questionBankMemoryBridge
      : null;
    const questionBankRecallWorkout = highFrequencyPracticeLoop && highFrequencyPracticeLoop.questionBankRecallWorkout
      ? highFrequencyPracticeLoop.questionBankRecallWorkout
      : null;
    const dailyMemorySprintDeck = highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyMemorySprintDeck
      ? highFrequencyPracticeLoop.dailyMemorySprintDeck
      : null;
    const adaptiveRecallScheduler = highFrequencyPracticeLoop && highFrequencyPracticeLoop.adaptiveRecallScheduler
      ? highFrequencyPracticeLoop.adaptiveRecallScheduler
      : null;
    const memoryRiskReleaseModel = highFrequencyPracticeLoop && highFrequencyPracticeLoop.memoryRiskReleaseModel
      ? highFrequencyPracticeLoop.memoryRiskReleaseModel
      : null;
    const realHomeworkPressureMemoryPrescription = highFrequencyPracticeLoop && highFrequencyPracticeLoop.realHomeworkPressureMemoryPrescription
      ? highFrequencyPracticeLoop.realHomeworkPressureMemoryPrescription
      : null;
    const dailyReturnContract = highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyReturnContract
      ? highFrequencyPracticeLoop.dailyReturnContract
      : null;
    const reviewReturnSeed = highFrequencyPracticeLoop && highFrequencyPracticeLoop.reviewReturnSeed
      ? highFrequencyPracticeLoop.reviewReturnSeed
      : null;
    const nextDayReturnEvidence = highFrequencyPracticeLoop && highFrequencyPracticeLoop.nextDayReturnEvidence
      ? highFrequencyPracticeLoop.nextDayReturnEvidence
      : (dailyReturnContract && dailyReturnContract.nextDayReturnEvidence ? dailyReturnContract.nextDayReturnEvidence : null);
    const spacedRecallPolicy = highFrequencyPracticeLoop && highFrequencyPracticeLoop.spacedRecallPolicy
      ? highFrequencyPracticeLoop.spacedRecallPolicy
      : null;
    const miniLessonReturnCard = storage.ensureMiniLessonReturnReviewCard
      && (reviewReturnSeed || nextDayReturnEvidence)
      ? storage.ensureMiniLessonReturnReviewCard(
        Object.assign({}, nextDayReturnEvidence || {}, reviewReturnSeed || {}, {
          firstStep: repairFocus && repairFocus.firstStep ? repairFocus.firstStep : '',
          conceptGap: repairFocus && repairFocus.reason ? repairFocus.reason : '',
          parentCheck: repairFocus && repairFocus.parentLine ? repairFocus.parentLine : '',
          nextDayReview: repairFocus && repairFocus.nextPracticeText ? repairFocus.nextPracticeText : ''
        }),
        {
          source: 'arcade_finish_round',
          flowTraceId: savedResult.flowTraceId || savedResult.traceId || '',
          subject: this.data.subjectSkillDepth && this.data.subjectSkillDepth.subjectLabel ? this.data.subjectSkillDepth.subjectLabel : '',
          taskType: this.data.recentTaskType || ''
        }
      )
      : null;
    const questArcSignal = storage.recordQuestArcGameSignal
      ? storage.recordQuestArcGameSignal({
        mission: this.data.questArcMission,
        result: savedResult
      }, { gameType: savedResult.gameType })
      : null;
    const incomingShare = storage.loadIncomingShare ? storage.loadIncomingShare() : null;
    const questionProgressionSignal = this.buildQuestionProgressionSignal(savedResult, wrongAnswers);
    const courseUnitProgress = storage.recordCourseUnitProgress
      ? storage.recordCourseUnitProgress({
        cardId: repairFocus && repairFocus.cardId ? repairFocus.cardId : (answers[0] && answers[0].cardId) || '',
        unitId: this.data.courseUnitMap && this.data.courseUnitMap.active ? this.data.courseUnitMap.active.id : '',
        firstStep: repairFocus && repairFocus.firstStep ? repairFocus.firstStep : '',
        wrongCause: repairFocus && repairFocus.reason ? repairFocus.reason : '',
        nextDayRevisit: questionProgressionSignal.nextDayRevisit || '',
        nearTransfer: savedResult.activeRecallEvidenceComplete ? 'active_recall_evidence_complete' : '',
        status: questionProgressionSignal.status,
        source: 'arcade_finish_round'
      })
      : null;
    storage.appendSyncMutation('arcade_attempt', {
      game_type: savedResult.gameType,
      total: savedResult.total,
      correct: savedResult.correct,
      wrong: savedResult.wrong,
      accuracy: savedResult.accuracy,
      xp: savedResult.xp,
      best_combo: savedResult.bestCombo,
      subject_depth_task_type: this.data.subjectSkillDepth && this.data.subjectSkillDepth.taskType,
      subject_depth_label: this.data.subjectSkillDepth && this.data.subjectSkillDepth.label,
      curriculum_subject: this.data.curriculumSpine && this.data.curriculumSpine.subjectLabel,
      curriculum_node: this.data.curriculumSpine && this.data.curriculumSpine.currentNode && this.data.curriculumSpine.currentNode.label,
      course_unit_subject: this.data.courseUnitMap && this.data.courseUnitMap.active ? this.data.courseUnitMap.active.label : '',
      course_unit_count: this.data.courseUnitMap ? this.data.courseUnitMap.unitCount : 0,
      course_unit_question_types: this.data.courseUnitMap ? this.data.courseUnitMap.reusableQuestionTypeCount : 0,
      course_unit_trajectory_rows: this.data.courseUnitMasteryTrajectory && Array.isArray(this.data.courseUnitMasteryTrajectory.trajectories)
        ? this.data.courseUnitMasteryTrajectory.trajectories.length
        : 0,
      question_progression_status: questionProgressionSignal.status,
      question_progression_cards: questionProgressionSignal.activeCardCount,
      question_progression_stages: questionProgressionSignal.stageCount,
      question_progression_mastery_gates: questionProgressionSignal.masteryGateCount,
      question_progression_revisit: questionProgressionSignal.nextDayRevisit,
      course_unit_progress_id: courseUnitProgress && courseUnitProgress.id ? courseUnitProgress.id : '',
      course_unit_progress_status: courseUnitProgress && courseUnitProgress.status ? courseUnitProgress.status : '',
      retention_mode: gameRetentionLoop && gameRetentionLoop.mode,
      retention_next_route: gameRetentionLoop && gameRetentionLoop.nextRoute,
      retention_weak_key: gameRetentionLoop && gameRetentionLoop.weakKey,
      high_frequency_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.mode,
      high_frequency_next_route: highFrequencyPracticeLoop && highFrequencyPracticeLoop.nextRoute,
      memory_feedback_severity: highFrequencyPracticeLoop && highFrequencyPracticeLoop.memoryFeedbackController
        ? highFrequencyPracticeLoop.memoryFeedbackController.severity
        : '',
      memory_feedback_triggered: highFrequencyPracticeLoop && highFrequencyPracticeLoop.memoryFeedbackController
        ? highFrequencyPracticeLoop.memoryFeedbackController.triggered
        : false,
      recall_intensity_tier: highFrequencyPracticeLoop && highFrequencyPracticeLoop.recallIntensityPlan
        ? highFrequencyPracticeLoop.recallIntensityPlan.tier
        : '',
      wrong_cause_replay_count: highFrequencyPracticeLoop && highFrequencyPracticeLoop.wrongCauseReplayDeck
        ? highFrequencyPracticeLoop.wrongCauseReplayDeck.cards.length
        : 0,
      xp_feedback_policy: highFrequencyPracticeLoop && highFrequencyPracticeLoop.xpFeedbackPolicy
        ? highFrequencyPracticeLoop.xpFeedbackPolicy.title
        : '',
      quest_arc_runway_stages: highFrequencyPracticeLoop && highFrequencyPracticeLoop.questArcRunway
        ? highFrequencyPracticeLoop.questArcRunway.stages.length
        : 0,
      gizmo_memory_protocol_tier: highFrequencyPracticeLoop && highFrequencyPracticeLoop.gizmoLikeMemoryProtocol
        ? highFrequencyPracticeLoop.gizmoLikeMemoryProtocol.intensityTier
        : '',
      gizmo_memory_return_windows: highFrequencyPracticeLoop && highFrequencyPracticeLoop.gizmoLikeMemoryProtocol
        ? highFrequencyPracticeLoop.gizmoLikeMemoryProtocol.returnWindows.length
        : 0,
      gizmo_memory_anti_cram: highFrequencyPracticeLoop && highFrequencyPracticeLoop.gizmoLikeMemoryProtocol
        ? highFrequencyPracticeLoop.gizmoLikeMemoryProtocol.antiCramThrottle.active
        : false,
      socratic_quality_memory_scenarios: socraticQualityMemoryBridge
        ? socraticQualityMemoryBridge.scenarioCount
        : 0,
      socratic_quality_memory_actions: socraticQualityMemoryBridge && Array.isArray(socraticQualityMemoryBridge.memoryActions)
        ? socraticQualityMemoryBridge.memoryActions.length
        : 0,
      socratic_quality_memory_xp_gate: socraticQualityMemoryBridge
        ? socraticQualityMemoryBridge.xpGate
        : '',
      question_bank_memory_cards: questionBankMemoryBridge
        ? questionBankMemoryBridge.questionCardCount
        : 0,
      question_bank_memory_active: questionBankMemoryBridge
        ? questionBankMemoryBridge.activeDeck.length
        : 0,
      question_bank_memory_gate: questionBankMemoryBridge
        ? questionBankMemoryBridge.xpGate
        : '',
      question_bank_recall_workout_mode: questionBankRecallWorkout
        ? questionBankRecallWorkout.mode
        : '',
      question_bank_recall_workout_cards: questionBankRecallWorkout && Array.isArray(questionBankRecallWorkout.workoutCards)
        ? questionBankRecallWorkout.workoutCards.length
        : 0,
      question_bank_recall_workout_phases: questionBankRecallWorkout && Array.isArray(questionBankRecallWorkout.phases)
        ? questionBankRecallWorkout.phases.length
        : 0,
      question_bank_recall_workout_boundary: questionBankRecallWorkout
        ? questionBankRecallWorkout.shareBoundary
        : '',
      daily_memory_sprint_mode: dailyMemorySprintDeck
        ? dailyMemorySprintDeck.mode
        : '',
      daily_memory_sprint_cards: dailyMemorySprintDeck && Array.isArray(dailyMemorySprintDeck.sprintCards)
        ? dailyMemorySprintDeck.sprintCards.length
        : 0,
      daily_memory_sprint_locks: dailyMemorySprintDeck && Array.isArray(dailyMemorySprintDeck.lockRules)
        ? dailyMemorySprintDeck.lockRules.length
        : 0,
      daily_memory_sprint_streak_meters: dailyMemorySprintDeck && Array.isArray(dailyMemorySprintDeck.streakMeters)
        ? dailyMemorySprintDeck.streakMeters.length
        : 0,
      daily_memory_sprint_boundary: dailyMemorySprintDeck
        ? dailyMemorySprintDeck.shareBoundary
        : '',
      adaptive_recall_scheduler_mode: adaptiveRecallScheduler
        ? adaptiveRecallScheduler.mode
        : '',
      adaptive_recall_scheduler_boxes: adaptiveRecallScheduler && Array.isArray(adaptiveRecallScheduler.schedulerBoxes)
        ? adaptiveRecallScheduler.schedulerBoxes.length
        : 0,
      adaptive_recall_scheduler_queue: adaptiveRecallScheduler && Array.isArray(adaptiveRecallScheduler.reviewQueue)
        ? adaptiveRecallScheduler.reviewQueue.length
        : 0,
      adaptive_recall_scheduler_evidence: adaptiveRecallScheduler && Array.isArray(adaptiveRecallScheduler.evidenceRequired)
        ? adaptiveRecallScheduler.evidenceRequired.length
        : 0,
      memory_risk_release_level: memoryRiskReleaseModel ? memoryRiskReleaseModel.level : '',
      memory_risk_signals: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.riskSignals)
        ? memoryRiskReleaseModel.riskSignals.length
        : 0,
      memory_forgetting_warnings: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.forgettingWarnings)
        ? memoryRiskReleaseModel.forgettingWarnings.length
        : 0,
      memory_variant_release_gates: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.variantReleaseGates)
        ? memoryRiskReleaseModel.variantReleaseGates.length
        : 0,
      memory_risk_share_boundary: memoryRiskReleaseModel ? memoryRiskReleaseModel.shareBoundary : '',
      peer_memory_relay_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.peerMemoryRelayLeague
        ? highFrequencyPracticeLoop.peerMemoryRelayLeague.mode
        : '',
      peer_memory_relay_lanes: highFrequencyPracticeLoop && highFrequencyPracticeLoop.peerMemoryRelayLeague
        ? highFrequencyPracticeLoop.peerMemoryRelayLeague.lanes.length
        : 0,
      peer_memory_relay_blocked_fields: highFrequencyPracticeLoop && highFrequencyPracticeLoop.peerMemoryRelayLeague
        ? highFrequencyPracticeLoop.peerMemoryRelayLeague.blockedFields.length
        : 0,
      daily_memory_season_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyMemorySeasonPlan
        ? highFrequencyPracticeLoop.dailyMemorySeasonPlan.mode
        : '',
      daily_memory_season_missions: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyMemorySeasonPlan
        ? highFrequencyPracticeLoop.dailyMemorySeasonPlan.missions.length
        : 0,
      daily_memory_season_blocked_fields: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyMemorySeasonPlan
        ? highFrequencyPracticeLoop.dailyMemorySeasonPlan.sharePayload.blockedFields.join(',')
        : '',
      ninety_second_combo_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondRecallComboEngine
        ? highFrequencyPracticeLoop.ninetySecondRecallComboEngine.mode
        : '',
      ninety_second_combo_steps: highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondRecallComboEngine
        ? highFrequencyPracticeLoop.ninetySecondRecallComboEngine.comboSteps.length
        : 0,
      ninety_second_combo_rewards: highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondRecallComboEngine
        ? highFrequencyPracticeLoop.ninetySecondRecallComboEngine.rewardLadder.length
        : 0,
      real_homework_pressure_samples: realHomeworkPressureMemoryPrescription
        ? realHomeworkPressureMemoryPrescription.totalSamples
        : 0,
      real_homework_pressure_queue: realHomeworkPressureMemoryPrescription && Array.isArray(realHomeworkPressureMemoryPrescription.reviewQueue)
        ? realHomeworkPressureMemoryPrescription.reviewQueue.length
        : 0,
      real_homework_pressure_sample_specific: realHomeworkPressureMemoryPrescription
        ? realHomeworkPressureMemoryPrescription.sampleSpecificReady
        : false,
      real_homework_pressure_share_boundary: realHomeworkPressureMemoryPrescription && realHomeworkPressureMemoryPrescription.sharePayload
        ? realHomeworkPressureMemoryPrescription.sharePayload.blockedFields.join(',')
        : '',
      daily_return_contract_mode: dailyReturnContract ? dailyReturnContract.mode : '',
      daily_return_contract_loop: dailyReturnContract && Array.isArray(dailyReturnContract.loop)
        ? dailyReturnContract.loop.length
        : 0,
      daily_return_contract_blocked_fields: dailyReturnContract && dailyReturnContract.shareCard
        ? dailyReturnContract.shareCard.blockedFields.join(',')
        : '',
      next_day_return_agreed: nextDayReturnEvidence ? !!nextDayReturnEvidence.agreed : false,
      next_day_return_due_at: nextDayReturnEvidence ? nextDayReturnEvidence.dueAt : '',
      next_day_return_route: nextDayReturnEvidence ? nextDayReturnEvidence.route : '',
      next_day_return_blocked_fields: nextDayReturnEvidence && Array.isArray(nextDayReturnEvidence.blockedFields)
        ? nextDayReturnEvidence.blockedFields.join(',')
        : '',
      mini_lesson_review_card_id: miniLessonReturnCard && miniLessonReturnCard.id ? miniLessonReturnCard.id : '',
      review_return_seed_mode: reviewReturnSeed ? reviewReturnSeed.mode : '',
      review_return_seed_next_route: reviewReturnSeed ? reviewReturnSeed.nextRoute : '',
      review_return_seed_wrong_cards: reviewReturnSeed && Array.isArray(reviewReturnSeed.wrongCardIds)
        ? reviewReturnSeed.wrongCardIds.join(',')
        : '',
      spaced_recall_policy_gate: spacedRecallPolicy ? spacedRecallPolicy.releaseGate : '',
      spaced_recall_next_day_cards: spacedRecallPolicy && Array.isArray(spacedRecallPolicy.nextDayCardIds)
        ? spacedRecallPolicy.nextDayCardIds.join(',')
        : '',
      share_code: incomingShare && incomingShare.share_code ? incomingShare.share_code : ''
    });
    if (storage.saveTodaySession) {
      const session = storage.getTodaySession ? storage.getTodaySession() : {};
      const cause = this.wrongCauseForLoop(session);
      const rewardLine = savedResult.passed
        ? `完成一次${cause.wrongCauseLabel}轻练，学习记录已写回。`
        : `${cause.wrongCauseLabel}会回到下次复习，不算失败。`;
      storage.saveTodaySession({
        gamePlayed: true,
        gameEvidence: {
          taskType: session.taskType || this.data.recentTaskType || 'unknown',
          firstStep: session.childArticulatedStep || '',
          wrongCauseBucket: cause.wrongCauseBucket,
          wrongCauseLabel: cause.wrongCauseLabel,
          subjectSkillDepth: this.data.subjectSkillDepth,
          subjectDepthTaskType: this.data.subjectSkillDepth && this.data.subjectSkillDepth.taskType,
          subjectDepthLabel: this.data.subjectSkillDepth && this.data.subjectSkillDepth.label,
          curriculumSpine: this.data.curriculumSpine,
          courseUnitMap: this.data.courseUnitMap,
          courseUnitQuestionBank: this.data.courseUnitQuestionBank,
          questionProgressionSignal,
          nextPracticePlan: cause,
          score: Number(savedResult.accuracy || 0),
          adaptiveMode: this.data.adaptiveChallenge && this.data.adaptiveChallenge.mode,
          adaptiveBossCard: this.data.adaptiveChallenge && this.data.adaptiveChallenge.bossCard,
          questArcMission: this.data.questArcMission,
          questArcSignalId: questArcSignal && questArcSignal.id ? questArcSignal.id : '',
          dailyQuestIds: this.data.dailyQuestSet && Array.isArray(this.data.dailyQuestSet.quests)
            ? this.data.dailyQuestSet.quests.map((item) => item.id)
            : [],
          activeRecallEvidenceComplete: !!savedResult.activeRecallEvidenceComplete,
          activeRecallEvidence: Array.isArray(savedResult.recallEvidence) ? savedResult.recallEvidence : [],
          completed: true,
          streak: gameRetention && gameRetention.profile ? Number(gameRetention.profile.streak || 0) : 0,
          newlyUnlocked: gameRetention && gameRetention.newlyUnlocked ? gameRetention.newlyUnlocked.map((item) => item.id) : [],
          rewardLine,
          gameRetentionLoop,
          highFrequencyPracticeLoop,
          dailyReturnContract,
          reviewReturnSeed,
          nextDayReturnEvidence,
          miniLessonReturnCard,
          spacedRecallPolicy
        }
      });
    }
    if (incomingShare && incomingShare.share_code && storage.recordShareRelayCompletion) {
      const receiverFirstStep = this.pickReceiverOwnFirstStepEvidence(savedResult);
      if (receiverFirstStep) {
        storage.recordShareRelayCompletion({
          incomingShare,
          receiverFirstStep,
          receiverMaterial: this.pickReceiverOwnMaterialEvidence(),
          nextRevisit: '明天用自己的作业再回访同一个第一步',
          wrongCause: incomingShare.wrong_cause_label
            || incomingShare.capability_gap
            || (gameRetentionLoop && gameRetentionLoop.weakKey)
            || '',
          route: '/pages/arcade/arcade',
          evidence: savedResult.passed ? 'receiver_90_second_recall_passed' : 'receiver_90_second_recall_attempted',
          title: '接收者完成 90 秒回忆接力'
        });
      } else if (storage.appendReviewEvent) {
        storage.appendReviewEvent({
          type: 'share_relay_receiver_attempted',
          event: 'share_relay_receiver_attempted',
          source: 'arcade_share_relay',
          shareCode: incomingShare.share_code,
          status: 'attempted_without_receiver_first_step',
          firstStep: '',
          requiredNextEvidence: 'receiver_own_first_step',
          nextRoute: '/pages/tutor/tutor?from=share_relay_receiver_first_step',
          blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue'],
          created_at: new Date().toISOString()
        });
      }
    }
    api.submitEvent({
      event: 'arcade_completed',
      source: 'arcade',
      entity_id: savedResult.gameType,
      page: 'arcade',
      payload: {
        game_type: savedResult.gameType,
        total: savedResult.total,
        correct: savedResult.correct,
        wrong: savedResult.wrong,
        accuracy: savedResult.accuracy,
        xp: savedResult.xp,
        best_combo: savedResult.bestCombo,
        adaptive_mode: this.data.adaptiveChallenge && this.data.adaptiveChallenge.mode,
        subject_depth_task_type: this.data.subjectSkillDepth && this.data.subjectSkillDepth.taskType,
        subject_depth_label: this.data.subjectSkillDepth && this.data.subjectSkillDepth.label,
        curriculum_subject: this.data.curriculumSpine && this.data.curriculumSpine.subjectLabel,
        curriculum_node: this.data.curriculumSpine && this.data.curriculumSpine.currentNode && this.data.curriculumSpine.currentNode.label,
        course_unit_subject: this.data.courseUnitMap && this.data.courseUnitMap.active ? this.data.courseUnitMap.active.label : '',
        course_unit_count: this.data.courseUnitMap ? this.data.courseUnitMap.unitCount : 0,
        course_unit_question_types: this.data.courseUnitMap ? this.data.courseUnitMap.reusableQuestionTypeCount : 0,
        course_unit_trajectory_rows: this.data.courseUnitMasteryTrajectory && Array.isArray(this.data.courseUnitMasteryTrajectory.trajectories)
          ? this.data.courseUnitMasteryTrajectory.trajectories.length
          : 0,
        question_progression_status: questionProgressionSignal.status,
        question_progression_cards: questionProgressionSignal.activeCardCount,
        question_progression_stages: questionProgressionSignal.stageCount,
        question_progression_mastery_gates: questionProgressionSignal.masteryGateCount,
        question_progression_revisit: questionProgressionSignal.nextDayRevisit,
        quest_arc_stage: this.data.questArcMission && this.data.questArcMission.currentStage,
        quest_arc_mission: this.data.questArcMission && this.data.questArcMission.title,
        retention_mode: gameRetentionLoop && gameRetentionLoop.mode,
        retention_next_route: gameRetentionLoop && gameRetentionLoop.nextRoute,
        retention_evidence: gameRetentionLoop && Array.isArray(gameRetentionLoop.evidenceRequired)
          ? gameRetentionLoop.evidenceRequired.join(',')
          : '',
        high_frequency_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.mode,
      high_frequency_evidence: highFrequencyPracticeLoop && Array.isArray(highFrequencyPracticeLoop.evidenceRequired)
        ? highFrequencyPracticeLoop.evidenceRequired.join(',')
        : '',
        daily_return_contract_mode: dailyReturnContract ? dailyReturnContract.mode : '',
        daily_return_contract_loop: dailyReturnContract && Array.isArray(dailyReturnContract.loop)
          ? dailyReturnContract.loop.length
          : 0,
        daily_return_contract_blocked_fields: dailyReturnContract && dailyReturnContract.shareCard
          ? dailyReturnContract.shareCard.blockedFields.join(',')
          : '',
        next_day_return_agreed: nextDayReturnEvidence ? !!nextDayReturnEvidence.agreed : false,
        next_day_return_due_at: nextDayReturnEvidence ? nextDayReturnEvidence.dueAt : '',
        next_day_return_route: nextDayReturnEvidence ? nextDayReturnEvidence.route : '',
        next_day_return_blocked_fields: nextDayReturnEvidence && Array.isArray(nextDayReturnEvidence.blockedFields)
          ? nextDayReturnEvidence.blockedFields.join(',')
          : '',
        memory_feedback_severity: highFrequencyPracticeLoop && highFrequencyPracticeLoop.memoryFeedbackController
          ? highFrequencyPracticeLoop.memoryFeedbackController.severity
          : '',
        memory_feedback_triggered: highFrequencyPracticeLoop && highFrequencyPracticeLoop.memoryFeedbackController
          ? highFrequencyPracticeLoop.memoryFeedbackController.triggered
          : false,
        recall_intensity_tier: highFrequencyPracticeLoop && highFrequencyPracticeLoop.recallIntensityPlan
          ? highFrequencyPracticeLoop.recallIntensityPlan.tier
          : '',
        wrong_cause_replay_count: highFrequencyPracticeLoop && highFrequencyPracticeLoop.wrongCauseReplayDeck
          ? highFrequencyPracticeLoop.wrongCauseReplayDeck.cards.length
          : 0,
        xp_feedback_policy: highFrequencyPracticeLoop && highFrequencyPracticeLoop.xpFeedbackPolicy
          ? highFrequencyPracticeLoop.xpFeedbackPolicy.title
          : '',
        quest_arc_runway_stages: highFrequencyPracticeLoop && highFrequencyPracticeLoop.questArcRunway
          ? highFrequencyPracticeLoop.questArcRunway.stages.length
          : 0,
        gizmo_memory_protocol_tier: highFrequencyPracticeLoop && highFrequencyPracticeLoop.gizmoLikeMemoryProtocol
          ? highFrequencyPracticeLoop.gizmoLikeMemoryProtocol.intensityTier
          : '',
        gizmo_memory_return_windows: highFrequencyPracticeLoop && highFrequencyPracticeLoop.gizmoLikeMemoryProtocol
          ? highFrequencyPracticeLoop.gizmoLikeMemoryProtocol.returnWindows.length
          : 0,
        gizmo_memory_anti_cram: highFrequencyPracticeLoop && highFrequencyPracticeLoop.gizmoLikeMemoryProtocol
          ? highFrequencyPracticeLoop.gizmoLikeMemoryProtocol.antiCramThrottle.active
          : false,
        socratic_quality_memory_scenarios: socraticQualityMemoryBridge
          ? socraticQualityMemoryBridge.scenarioCount
          : 0,
        socratic_quality_memory_actions: socraticQualityMemoryBridge && Array.isArray(socraticQualityMemoryBridge.memoryActions)
          ? socraticQualityMemoryBridge.memoryActions.length
          : 0,
        socratic_quality_memory_xp_gate: socraticQualityMemoryBridge
          ? socraticQualityMemoryBridge.xpGate
          : '',
        question_bank_memory_cards: questionBankMemoryBridge
          ? questionBankMemoryBridge.questionCardCount
          : 0,
        question_bank_memory_active: questionBankMemoryBridge
          ? questionBankMemoryBridge.activeDeck.length
          : 0,
        question_bank_memory_gate: questionBankMemoryBridge
          ? questionBankMemoryBridge.xpGate
          : '',
        question_bank_recall_workout_mode: questionBankRecallWorkout
          ? questionBankRecallWorkout.mode
          : '',
        question_bank_recall_workout_cards: questionBankRecallWorkout && Array.isArray(questionBankRecallWorkout.workoutCards)
          ? questionBankRecallWorkout.workoutCards.length
          : 0,
        question_bank_recall_workout_phases: questionBankRecallWorkout && Array.isArray(questionBankRecallWorkout.phases)
          ? questionBankRecallWorkout.phases.length
          : 0,
        question_bank_recall_workout_boundary: questionBankRecallWorkout
          ? questionBankRecallWorkout.shareBoundary
          : '',
        daily_memory_sprint_mode: dailyMemorySprintDeck
          ? dailyMemorySprintDeck.mode
          : '',
        daily_memory_sprint_cards: dailyMemorySprintDeck && Array.isArray(dailyMemorySprintDeck.sprintCards)
          ? dailyMemorySprintDeck.sprintCards.length
          : 0,
        daily_memory_sprint_locks: dailyMemorySprintDeck && Array.isArray(dailyMemorySprintDeck.lockRules)
          ? dailyMemorySprintDeck.lockRules.length
          : 0,
        daily_memory_sprint_streak_meters: dailyMemorySprintDeck && Array.isArray(dailyMemorySprintDeck.streakMeters)
          ? dailyMemorySprintDeck.streakMeters.length
          : 0,
        daily_memory_sprint_boundary: dailyMemorySprintDeck
          ? dailyMemorySprintDeck.shareBoundary
          : '',
        adaptive_recall_scheduler_mode: adaptiveRecallScheduler
          ? adaptiveRecallScheduler.mode
          : '',
        adaptive_recall_scheduler_boxes: adaptiveRecallScheduler && Array.isArray(adaptiveRecallScheduler.schedulerBoxes)
          ? adaptiveRecallScheduler.schedulerBoxes.length
          : 0,
        adaptive_recall_scheduler_queue: adaptiveRecallScheduler && Array.isArray(adaptiveRecallScheduler.reviewQueue)
          ? adaptiveRecallScheduler.reviewQueue.length
          : 0,
        adaptive_recall_scheduler_evidence: adaptiveRecallScheduler && Array.isArray(adaptiveRecallScheduler.evidenceRequired)
          ? adaptiveRecallScheduler.evidenceRequired.length
          : 0,
        memory_risk_release_level: memoryRiskReleaseModel ? memoryRiskReleaseModel.level : '',
        memory_risk_signals: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.riskSignals)
          ? memoryRiskReleaseModel.riskSignals.length
          : 0,
        memory_forgetting_warnings: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.forgettingWarnings)
          ? memoryRiskReleaseModel.forgettingWarnings.length
          : 0,
        memory_variant_release_gates: memoryRiskReleaseModel && Array.isArray(memoryRiskReleaseModel.variantReleaseGates)
          ? memoryRiskReleaseModel.variantReleaseGates.length
          : 0,
        memory_risk_share_boundary: memoryRiskReleaseModel ? memoryRiskReleaseModel.shareBoundary : '',
        peer_memory_relay_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.peerMemoryRelayLeague
          ? highFrequencyPracticeLoop.peerMemoryRelayLeague.mode
          : '',
        peer_memory_relay_lanes: highFrequencyPracticeLoop && highFrequencyPracticeLoop.peerMemoryRelayLeague
          ? highFrequencyPracticeLoop.peerMemoryRelayLeague.lanes.length
          : 0,
        peer_memory_relay_blocked_fields: highFrequencyPracticeLoop && highFrequencyPracticeLoop.peerMemoryRelayLeague
          ? highFrequencyPracticeLoop.peerMemoryRelayLeague.blockedFields.length
          : 0,
        daily_memory_season_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyMemorySeasonPlan
          ? highFrequencyPracticeLoop.dailyMemorySeasonPlan.mode
          : '',
        daily_memory_season_missions: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyMemorySeasonPlan
          ? highFrequencyPracticeLoop.dailyMemorySeasonPlan.missions.length
          : 0,
        daily_memory_season_blocked_fields: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyMemorySeasonPlan
          ? highFrequencyPracticeLoop.dailyMemorySeasonPlan.sharePayload.blockedFields.join(',')
          : '',
        ninety_second_combo_mode: highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondRecallComboEngine
          ? highFrequencyPracticeLoop.ninetySecondRecallComboEngine.mode
          : '',
        ninety_second_combo_steps: highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondRecallComboEngine
          ? highFrequencyPracticeLoop.ninetySecondRecallComboEngine.comboSteps.length
          : 0,
        ninety_second_combo_rewards: highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondRecallComboEngine
          ? highFrequencyPracticeLoop.ninetySecondRecallComboEngine.rewardLadder.length
          : 0,
        real_homework_pressure_samples: realHomeworkPressureMemoryPrescription
          ? realHomeworkPressureMemoryPrescription.totalSamples
          : 0,
        real_homework_pressure_queue: realHomeworkPressureMemoryPrescription && Array.isArray(realHomeworkPressureMemoryPrescription.reviewQueue)
          ? realHomeworkPressureMemoryPrescription.reviewQueue.length
          : 0,
        real_homework_pressure_sample_specific: realHomeworkPressureMemoryPrescription
          ? realHomeworkPressureMemoryPrescription.sampleSpecificReady
          : false,
        real_homework_pressure_share_boundary: realHomeworkPressureMemoryPrescription && realHomeworkPressureMemoryPrescription.sharePayload
          ? realHomeworkPressureMemoryPrescription.sharePayload.blockedFields.join(',')
          : '',
        boss_gap: this.data.adaptiveChallenge && this.data.adaptiveChallenge.bossCard
          ? this.data.adaptiveChallenge.bossCard.key
          : '',
        wrong_count: wrongAnswers.length,
        share_code: incomingShare && incomingShare.share_code ? incomingShare.share_code : '',
        share_mode: incomingShare && incomingShare.mode ? incomingShare.mode : '',
        identity_tag: incomingShare && incomingShare.identity_tag ? incomingShare.identity_tag : ''
      }
    }).catch(() => {});
    api.submitQuiz({
      answers: arcade.uniqueReviewAnswers(answers),
      attempt_answers: answers,
      mode: `arcade_${savedResult.gameType}`,
      profile: storage.loadGameProfile ? storage.loadGameProfile() : {}
    }).catch(() => {});
    const arcadeResultActionBridge = this.buildArcadeResultActionBridge(savedResult, {
      repairFocus,
      gameRetentionLoop,
      highFrequencyPracticeLoop,
      questionProgressionSignal,
      wrongAnswers,
      incomingShare
    });
    this.setData({
      result: savedResult,
      resultAdvice: arcade.buildRoundAdvice(savedResult, savedResult.gameType),
      gameRetentionLoop,
      highFrequencyPracticeLoop,
      dailyReturnMission: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyReturnMission
        ? highFrequencyPracticeLoop.dailyReturnMission
        : this.data.dailyReturnMission,
      dailyReturnContract: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyReturnContract
        ? highFrequencyPracticeLoop.dailyReturnContract
        : this.data.dailyReturnContract,
      dailyPrimaryRecallAction: highFrequencyPracticeLoop && highFrequencyPracticeLoop.dailyPrimaryRecallAction
        ? highFrequencyPracticeLoop.dailyPrimaryRecallAction
        : this.data.dailyPrimaryRecallAction,
      ninetySecondRecallDeck: highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondPlayableDeck
        ? highFrequencyPracticeLoop.ninetySecondPlayableDeck
        : this.data.ninetySecondRecallDeck,
      ninetySecondRecallState: this.buildNinetySecondRecallState(
        highFrequencyPracticeLoop && highFrequencyPracticeLoop.ninetySecondPlayableDeck
          ? highFrequencyPracticeLoop.ninetySecondPlayableDeck
          : this.data.ninetySecondRecallDeck
      ),
      reviewReturnSeed: highFrequencyPracticeLoop && highFrequencyPracticeLoop.reviewReturnSeed
        ? highFrequencyPracticeLoop.reviewReturnSeed
        : this.data.reviewReturnSeed,
      nextDayReturnEvidence: highFrequencyPracticeLoop && highFrequencyPracticeLoop.nextDayReturnEvidence
        ? Object.assign({}, highFrequencyPracticeLoop.nextDayReturnEvidence, {
          routeLine: arcadeReadableRouteLine(highFrequencyPracticeLoop.nextDayReturnEvidence.route)
        })
        : (dailyReturnContract && dailyReturnContract.nextDayReturnEvidence
          ? Object.assign({}, dailyReturnContract.nextDayReturnEvidence, {
            routeLine: arcadeReadableRouteLine(dailyReturnContract.nextDayReturnEvidence.route)
          })
          : (this.data.nextDayReturnEvidence
            ? Object.assign({}, this.data.nextDayReturnEvidence, {
              routeLine: arcadeReadableRouteLine(this.data.nextDayReturnEvidence.route)
            })
            : null)),
      spacedRecallPolicy: highFrequencyPracticeLoop && highFrequencyPracticeLoop.spacedRecallPolicy
        ? highFrequencyPracticeLoop.spacedRecallPolicy
        : this.data.spacedRecallPolicy,
      questionProgressionSignal,
      arcadeResultActionBridge,
      challengeBrief: Object.assign({}, this.data.challengeBrief || {}, {
        resultLine: savedResult.accuracy >= Number((this.data.challengeBrief && this.data.challengeBrief.targetAccuracy) || 80)
          ? '本局达到目标，剧情线证据已写回。'
          : '本局未达到目标，错的卡会回到复习队列。'
      }),
      lives,
      score,
      bestCombo,
      xpGained,
      wrongAnswers,
      repairFocus,
      feedbackText: result.passed ? '通关了，错因会按间隔复习继续回访。' : '没关系，错因卡已经回到复习队列。'
    });
  },

  pickReceiverOwnFirstStepEvidence(savedResult = {}) {
    const session = storage.getTodaySession ? storage.getTodaySession() : {};
    const incomingShare = this.data.incomingShare || {};
    const senderSteps = [
      incomingShare.relay_first_step,
      incomingShare.question_bank_relay_first_step,
      incomingShare.wrong_cause_first_step,
      incomingShare.visual_board_relay_student_line
    ].map((item) => String(item || '').trim()).filter(Boolean);
    const candidates = [
      session && session.childArticulatedStep,
      this.data.todayFocus && this.data.todayFocus.childArticulatedStep,
      this.data.dailyPrimaryRecallEvidencePacket && this.data.dailyPrimaryRecallEvidencePacket.childFirstStep,
      this.data.quizRecallEvidence && this.data.quizRecallEvidence.childFirstStep
    ].concat(
      Array.isArray(savedResult.recallEvidence)
        ? savedResult.recallEvidence.map((item) => item && (item.childFirstStep || item.firstStepText || item.first_step_evidence))
        : []
    );
    return candidates
      .map((item) => String(item || '').trim())
      .find((text) => text.length >= 4 && !senderSteps.includes(text) && !/答案|直接|代写|帮我写|不会|不懂|不知道/.test(text)) || '';
  },

  pickReceiverOwnMaterialEvidence() {
    const session = storage.getTodaySession ? storage.getTodaySession() : {};
    const focus = this.data.todayFocus || {};
    return String(
      (session && (session.title || session.stuckPointText || session.taskTitle))
      || focus.title
      || focus.text
      || 'receiver_own_homework_material'
    ).trim();
  },

  restartRound() {
    if (!this.canPlayGameAction('restart_round')) return;
    const round = this.buildRoundForGame(this.data.selectedGame, this.data.cards, this.data.adaptiveChallenge);
    const next = this.firstQuestionForRound(round, this.data.selectedGame);
    this.setData({
      round,
      currentIndex: 0,
      currentQuestion: next,
      questNodes: this.buildQuestNodes(round, 0),
      revealed: false,
      quizRecallEvidence: null,
      snakeTrack: this.data.selectedGame === 'snake' ? next : null,
      snakeTiles: this.data.selectedGame === 'snake' && next ? next.tiles : [],
      snakeNextOrder: 0,
      snakeSegments: this.buildSnakeSegments(this.data.selectedGame === 'snake' ? next : null, 0),
      showSnakeBody: false,
      matchTiles: this.data.selectedGame === 'match' && round.tiles ? round.tiles : [],
      matchSelectedTile: null,
      matchPairsDone: 0,
      activeGame: this.data.recommendations.find((item) => item.id === this.data.selectedGame) || null,
      moleHoles: this.buildHoles(round.questions && round.questions[0], round.holes),
      lives: Number((this.data.adaptiveChallenge && this.data.adaptiveChallenge.lives) || 3),
      combo: 0,
      bestCombo: 0,
      score: 0,
      xpGained: 0,
      answers: [],
      reviewedCardIds: {},
      wrongAnswers: [],
      repairFocus: null,
      result: null,
      resultAdvice: null,
      arcadeResultActionBridge: null,
      highFrequencyPracticeLoop: null,
      dailyReturnMission: null,
      dailyReturnContract: null,
      dailyPrimaryRecallAction: null,
      ninetySecondRecallDeck: null,
      ninetySecondRecallState: this.buildNinetySecondRecallState(null),
      reviewReturnSeed: null,
      nextDayReturnEvidence: null,
      spacedRecallPolicy: null,
      emptyGuide: this.emptyGuide(this.data.selectedGame, round),
      feedbackText: '新一局开始。'
    });
  },

  buildArcadeResultActionBridge(result = {}, context = {}) {
    const wrongCount = Array.isArray(context.wrongAnswers) ? context.wrongAnswers.length : Number(result.wrong || 0);
    const retention = context.gameRetentionLoop || {};
    const highFrequency = context.highFrequencyPracticeLoop || {};
    const progression = context.questionProgressionSignal || {};
    const shareCode = context.incomingShare && context.incomingShare.share_code ? context.incomingShare.share_code : '';
    const headline = result.passed
      ? '这局可以收口：明天轻回看一张卡'
      : '这局没过也有价值：错卡已经回队列';
    const evidenceLine = [
      `正确 ${Number(result.correct || 0)}/${Number(result.total || 0)}`,
      wrongCount ? `错因 ${wrongCount} 条` : '没有新增错因',
      result.xp ? `写入 ${result.xp} 条奖励证据` : '已写入学习记录'
    ].join(' · ');
    const actions = [
      {
        id: 'peer_90s_relay',
        label: '发起90秒接力',
        route: '/pages/profile/profile?from=arcade_peer_relay',
        reason: '把本局第一步变成好友可复刻的安全挑战，不晒分、不晒答案。',
        capabilityId: 'share_return'
      },
      {
        id: 'review',
        label: wrongCount ? '先修错卡' : '明天回看',
        route: '/pages/review/review',
        reason: wrongCount ? '错题回到修卡点，先拆第一步。' : '把今天会的内容变成长期记忆。',
        capabilityId: 'game'
      },
      {
        id: 'profile',
        label: '给家长看',
        route: '/pages/profile/profile',
        reason: '把本局结果放进家长复盘，不只看分数。',
        capabilityId: 'parent_action'
      },
      {
        id: 'tutor',
        label: '再问一步',
        route: context.repairFocus ? '/pages/tutor/tutor?from=arcade_result_bridge' : '/pages/tutor/tutor?from=arcade_result_review',
        reason: '卡住时回到苏格拉底第一步，不直接照抄结果。',
        capabilityId: 'socratic'
      }
    ];
    return {
      title: '本局之后做什么',
      headline,
      evidenceLine,
      primaryShareLabel: '发起90秒回忆挑战',
      shareChallengeTitle: wrongCount ? '错因第一步接力' : '同类第一步接力',
      returnWindow: '今晚接力，明天只回看一张最不稳的卡',
      receiverRoute: '/pages/arcade/arcade?from=peer_90s_relay',
      shareChallengePayload: {
        share_intent: 'peer_90s_relay',
        relay_review: 'ninety_second_first_step',
        relay_next_revisit: 'tomorrow_one_card',
        relay_spread_status: 'no_ranking_no_score',
        relay_receiver_action: progression.receiverAction || retention.nextRoute || '/pages/review/review',
        relay_parent_check: progression.parentCheck || retention.parentLine || '',
        relay_first_step: retention.weakKey || highFrequency.weakKey || progression.weakKey || '',
        relay_allowed_fields: Array.isArray(retention.allowedFields) ? retention.allowedFields.slice(0, 6) : [],
        relay_blocked_fields: Array.isArray(retention.blockedFields) ? retention.blockedFields.slice(0, 8) : ['original_question', 'score', 'ranking'],
        openmaic_game_gate: progression.gameGate || retention.nextRoundLine || '',
        relay_return_path: '/pages/arcade/arcade?from=peer_90s_relay',
        source_challenge_route: '/pages/arcade/arcade?from=peer_90s_relay'
      },
      tomorrowLine: progression.nextDayRevisit || retention.tomorrowLine || highFrequency.parentShareLine || '明天只回看最不稳的一张卡。',
      masteryGateLine: progression.masteryGate || '',
      parentEvidenceLine: progression.parentEvidence || '',
      shareLine: shareCode ? `来自分享接力 ${shareCode}，本局结果会继续承接。` : '家长页会显示本局证据和下一步。',
      actions
    };
  },

  runGuideAction(event) {
    const action = event.currentTarget.dataset.action || 'goTools';
    if (action && typeof this[action] === 'function') this[action]();
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/home/home' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  openEntryDetail(event) {
    const scene = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.scene
      : 'review';
    wx.navigateTo({ url: `/pages/entry-detail/entry-detail?scene=${scene || 'review'}` });
  },

  goTools() {
    navigation.navigateLearningRoute('/pages/tools/tools');
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review');
  },

  clearNinetySecondRecallTimer() {
    if (this.ninetySecondRecallTimer) {
      clearInterval(this.ninetySecondRecallTimer);
      this.ninetySecondRecallTimer = null;
    }
  },

  buildNinetySecondRecallState(deck = null) {
    const interactions = Array.isArray(deck && deck.interactions) ? deck.interactions : [];
    const totalSeconds = Number(deck && deck.totalSeconds) || interactions.reduce((sum, item) => sum + Number(item.seconds || 0), 0) || 90;
    const state = {
      status: interactions.length >= 4 && (!deck || !deck.status || deck.status === 'ready') ? 'idle' : 'locked',
      deckId: deck && deck.id ? deck.id : '',
      weakKey: deck && deck.weakKey ? deck.weakKey : '第一步',
      totalSeconds,
      elapsedSeconds: 0,
      secondsLeft: totalSeconds,
      stepIndex: 0,
      currentStepId: interactions[0] ? interactions[0].id : '',
      interactions,
      completedStepIds: [],
      evidence: [],
      inputs: {},
      selectedChoices: {},
      localChecks: {},
      finished: false,
      canReleaseXp: false,
      blockedRewards: deck && Array.isArray(deck.localAiSplit && deck.localAiSplit.aiMustNotOwn)
        ? deck.localAiSplit.aiMustNotOwn.slice(0, 8)
        : ['final_answer', 'score', 'ranking'],
      shareBlockedFields: deck && deck.sharePayload && Array.isArray(deck.sharePayload.blockedFields)
        ? deck.sharePayload.blockedFields.slice(0, 10)
        : ['original_question', 'original_answer', 'score', 'ranking', 'full_dialogue']
    };
    return this.decorateNinetySecondRecallState(state);
  },

  decorateNinetySecondRecallState(state = {}) {
    const completed = Array.isArray(state.completedStepIds) ? state.completedStepIds : [];
    const interactions = Array.isArray(state.interactions) ? state.interactions : [];
    const decoratedInteractions = interactions.map((item, index) => {
      const isCompleted = completed.includes(item.id);
      const isCurrent = state.status === 'running' && index === Number(state.stepIndex || 0) && !state.finished;
      const isLocked = state.status !== 'running' || (!isCurrent && !isCompleted);
      const inputValue = state.inputs && state.inputs[item.id] ? state.inputs[item.id] : '';
      const selectedChoiceId = state.selectedChoices && state.selectedChoices[item.id] ? state.selectedChoices[item.id] : '';
      return Object.assign({}, item, {
        isCurrent,
        isCompleted,
        isLocked,
        inputValue,
        selectedChoiceId,
        localCheckPassed: !!(state.localChecks && state.localChecks[item.id]),
        uiClass: isCompleted ? 'completed' : isCurrent ? 'current' : isLocked ? 'locked' : ''
      });
    });
    return Object.assign({}, state, {
      interactions: decoratedInteractions,
      statusLabel: state.status === 'running'
        ? '进行中'
        : state.status === 'completed'
          ? '已完成'
          : state.status === 'timeout'
            ? '超时回访'
            : state.status === 'locked'
              ? '待生成'
              : '待开始',
      currentStepLabel: decoratedInteractions[state.stepIndex] && (decoratedInteractions[state.stepIndex].label || decoratedInteractions[state.stepIndex].prompt) || '',
      completionLine: completed.length
        ? `已完成 ${completed.length}/${decoratedInteractions.length} 步`
        : '还没有完成证据',
      failureDowngradeLine: state.status === 'timeout'
        ? '本轮不发奖励，自动降级为明天回访卡：只问第一步和错因，不继续加题。'
        : ''
    });
  },

  handleNinetySecondRecallInput(event) {
    const stepId = event.currentTarget.dataset.stepId || '';
    const value = event.detail && typeof event.detail.value === 'string' ? event.detail.value.slice(0, 80) : '';
    const state = this.data.ninetySecondRecallState || {};
    const inputs = Object.assign({}, state.inputs || {}, { [stepId]: value });
    this.setData({
      ninetySecondRecallState: this.decorateNinetySecondRecallState(Object.assign({}, state, { inputs }))
    });
  },

  selectNinetySecondRecallChoice(event) {
    const stepId = event.currentTarget.dataset.stepId || '';
    const choiceId = event.currentTarget.dataset.choiceId || '';
    const state = this.data.ninetySecondRecallState || {};
    const selectedChoices = Object.assign({}, state.selectedChoices || {}, { [stepId]: choiceId });
    this.setData({
      ninetySecondRecallState: this.decorateNinetySecondRecallState(Object.assign({}, state, { selectedChoices }))
    });
  },

  validateNinetySecondRecallStep(step = {}, state = {}) {
    if (step.inputType === 'short_text') {
      const value = String(state.inputs && state.inputs[step.id] || '').trim();
      return value.length >= 4;
    }
    if (step.inputType === 'two_choice') {
      return !!(state.selectedChoices && state.selectedChoices[step.id]);
    }
    return true;
  },

  persistNinetySecondRecallEvidence(reason = 'completed', stateOverride = null) {
    const deck = this.data.ninetySecondRecallDeck || {};
    const state = stateOverride || this.data.ninetySecondRecallState || {};
    const evidence = {
      reason,
      deckId: deck.id || '',
      weakKey: deck.weakKey || state.weakKey || '第一步',
      totalSeconds: Number(state.totalSeconds || deck.totalSeconds || 90),
      elapsedSeconds: Number(state.elapsedSeconds || 0),
      finished: !!state.finished,
      stepIds: Array.isArray(state.completedStepIds) ? state.completedStepIds.slice() : [],
      blockedRewards: Array.isArray(state.blockedRewards) ? state.blockedRewards.slice() : [],
      shareBlockedFields: Array.isArray(state.shareBlockedFields) ? state.shareBlockedFields.slice() : [],
      createdAt: new Date().toISOString()
    };
    if (storage.set) {
      storage.set('arcade.ninetySecondRecallEvidence.v1', evidence);
    }
    if (storage.appendReviewEvent) {
      storage.appendReviewEvent({
        kind: 'arcade_ninety_second_recall_evidence',
        deck_id: evidence.deckId,
        weak_key: evidence.weakKey,
        total_seconds: evidence.totalSeconds,
        elapsed_seconds: evidence.elapsedSeconds,
        completed_step_ids: evidence.stepIds,
        reason
      });
    }
    if (storage.appendSyncMutation) {
      storage.appendSyncMutation('arcade_ninety_second_recall_evidence', evidence);
    }
    if (reason === 'completed' && state.canReleaseXp && storage.recordGameSessionResult) {
      const recallEvidence = {
        event: 'ninety_second_recall_completed',
        deckId: evidence.deckId,
        weakKey: evidence.weakKey,
        student_first_step: true,
        wrong_cause_named: true,
        next_day_revisit_locked: true,
        child_first_step: (Array.isArray(state.evidence) ? state.evidence : [])
          .map((item) => item && item.childInput)
          .filter(Boolean)[0] || '',
        completed_step_ids: evidence.stepIds,
        source: 'arcade_ninety_second_recall'
      };
      storage.recordGameSessionResult({
        gameType: 'ninety_second_recall',
        total: Math.max(4, evidence.stepIds.length || 4),
        correct: Math.max(4, evidence.stepIds.length || 4),
        accuracy: 100,
        xp: 8,
        recallEvidence: [recallEvidence],
        activeRecallEvidenceComplete: true,
        streakEligible: true,
        nextDayRevisit: true
      }, {
        gameType: 'ninety_second_recall',
        xpReason: 'ninety_second_recall_completed',
        weakKey: evidence.weakKey,
        reportId: (this.data.reportSourceContext && this.data.reportSourceContext.reportId) || '',
        flowTraceId: (this.data.reportSourceContext && this.data.reportSourceContext.flowTraceId) || '',
        route: (this.data.reportSourceContext && this.data.reportSourceContext.returnRoute) || '/pages/arcade/arcade'
      });
    }
    if (api.submitEvent) {
      api.submitEvent({
        event: 'arcade_ninety_second_recall_evidence',
        source: 'arcade',
        entity_id: evidence.deckId || evidence.weakKey,
        page: 'arcade',
        payload: evidence
      }).catch(() => {});
    }
    return evidence;
  },

  startNinetySecondRecall() {
    if (!this.canPlayGameAction('start_ninety_second_recall')) return;
    const deck = this.data.ninetySecondRecallDeck || {};
    const state = this.buildNinetySecondRecallState(deck);
    if (!state.interactions.length || state.status === 'locked') {
      this.setData({ feedbackText: '先生成可执行的 90 秒牌组，再开始。' });
      return;
    }
    this.clearNinetySecondRecallTimer();
    this.setData({
      ninetySecondRecallState: this.decorateNinetySecondRecallState(Object.assign({}, state, {
        status: 'running',
        canReleaseXp: false
      })),
      feedbackText: '90 秒开始：先补关键词。'
    });
    this.ninetySecondRecallStartedAt = Date.now();
    this.ninetySecondRecallTimer = setInterval(() => {
      const current = this.data.ninetySecondRecallState || state;
      if (!current || current.finished) {
        this.clearNinetySecondRecallTimer();
        return;
      }
      const elapsedSeconds = Math.min(Number(current.totalSeconds || 90), Math.floor((Date.now() - this.ninetySecondRecallStartedAt) / 1000));
      const secondsLeft = Math.max(0, Number(current.totalSeconds || 90) - elapsedSeconds);
      if (secondsLeft <= 0 && !current.finished) {
        this.finishNinetySecondRecall('timeout', Object.assign({}, current, {
          elapsedSeconds,
          secondsLeft: 0
        }));
        return;
      }
      this.setData({
        ninetySecondRecallState: this.decorateNinetySecondRecallState(Object.assign({}, current, {
          elapsedSeconds,
          secondsLeft
        }))
      });
    }, 1000);
  },

  completeNinetySecondRecallStep(event) {
    if (!this.canPlayGameAction('complete_ninety_second_recall_step')) return;
    const deck = this.data.ninetySecondRecallDeck || {};
    const state = this.data.ninetySecondRecallState || this.buildNinetySecondRecallState(deck);
    if (state.status !== 'running' || state.finished) return;
    const stepId = event.currentTarget.dataset.stepId || '';
    const currentStep = state.interactions[state.stepIndex] || null;
    if (!currentStep || currentStep.id !== stepId) {
      this.setData({ feedbackText: '先按顺序完成当前一步。' });
      return;
    }
    if (!this.validateNinetySecondRecallStep(currentStep, state)) {
      this.setData({
        feedbackText: currentStep.inputType === 'short_text'
          ? '先写下孩子自己的第一步，至少 4 个字，再进入下一步。'
          : '先选择一个卡住原因，再继续。'
      });
      return;
    }
    const completedStepIds = state.completedStepIds.concat(stepId);
    const localChecks = Object.assign({}, state.localChecks || {}, { [stepId]: true });
    const evidence = state.evidence.concat([{
      stepId,
      proof: currentStep.passEvidence || currentStep.proof || '',
      localCheck: currentStep.localCheck || '',
      localCheckPassed: true,
      childInput: String(state.inputs && state.inputs[stepId] || '').trim().slice(0, 80),
      choiceId: state.selectedChoices && state.selectedChoices[stepId] || '',
      prompt: currentStep.prompt || currentStep.action || ''
    }]);
    const nextIndex = state.stepIndex + 1;
    const nextStep = state.interactions[nextIndex] || null;
    const nextState = this.decorateNinetySecondRecallState(Object.assign({}, state, {
      elapsedSeconds: Math.min(Number(state.totalSeconds || 90), Number(state.elapsedSeconds || 0) + Number(currentStep.seconds || 0)),
      secondsLeft: Math.max(0, Number(state.totalSeconds || 90) - (Number(state.elapsedSeconds || 0) + Number(currentStep.seconds || 0))),
      stepIndex: nextIndex,
      currentStepId: nextStep ? nextStep.id : currentStep.id,
      completedStepIds,
      evidence,
      localChecks,
      canReleaseXp: completedStepIds.length >= 4 && completedStepIds.every((id) => localChecks[id]),
      status: completedStepIds.length >= 4 ? 'completed' : 'running'
    }));
    this.setData({
      ninetySecondRecallState: nextState,
      feedbackText: nextStep ? `已完成第 ${completedStepIds.length} 步，继续下一步。` : '90 秒四步完成。'
    });
    if (completedStepIds.length >= 4) {
      this.finishNinetySecondRecall('completed', nextState);
    }
  },

  finishNinetySecondRecall(reason = 'completed', stateOverride = null) {
    const current = stateOverride || this.data.ninetySecondRecallState || this.buildNinetySecondRecallState(this.data.ninetySecondRecallDeck);
    const nextState = this.decorateNinetySecondRecallState(Object.assign({}, current, {
      status: reason === 'timeout' ? 'timeout' : 'completed',
      finished: true,
      canReleaseXp: reason !== 'timeout'
        && (Array.isArray(current.completedStepIds) ? current.completedStepIds.length >= 4 : false)
        && (Array.isArray(current.completedStepIds) ? current.completedStepIds.every((id) => current.localChecks && current.localChecks[id]) : false),
      secondsLeft: 0
    }));
    this.clearNinetySecondRecallTimer();
    this.setData({
      ninetySecondRecallState: nextState,
      feedbackText: reason === 'timeout' ? '90 秒到点，先回到复习卡。' : '90 秒完成，明天回访已锁定。'
    });
    this.persistNinetySecondRecallEvidence(reason, nextState);
  },

  resetNinetySecondRecall() {
    this.clearNinetySecondRecallTimer();
    const next = this.buildNinetySecondRecallState(this.data.ninetySecondRecallDeck || this.data.highFrequencyPracticeLoop && this.data.highFrequencyPracticeLoop.ninetySecondPlayableDeck);
    this.setData({
      ninetySecondRecallState: next,
      feedbackText: '90 秒牌组已重置。'
    });
  },

  buildDailyPrimaryRecallEvidencePacket(action = {}) {
    const weakKey = action.weakKey || (this.data.repairFocus && this.data.repairFocus.title) || '今晚最不稳的一步';
    const now = new Date().toISOString();
    return {
      id: `daily_primary_recall_${Date.now()}`,
      event: 'daily_primary_recall_evidence_ticket',
      cardId: action.cardId || action.weakKey || weakKey,
      weakKey,
      firstStepSpoken: false,
      wrongCauseReplay: false,
      nextDayRevisitLocked: true,
      day7VariantDue: true,
      student_first_step: false,
      wrong_cause_named: false,
      next_day_revisit_locked: true,
      day7_variant_due: true,
      evidenceStatus: 'locked_pending_child_first_step',
      route: action.route || '/pages/review/review?mode=recall_return',
      parentLine: action.parentLine || '家长只问第一步，不问完整答案。',
      rewardEvidence: action.rewardEvidence || ['student_first_step', 'wrong_cause_named', 'next_day_revisit'],
      blockedRewards: action.blockedRewards || ['speed', 'score', 'ranking', 'raw_volume'],
      sourceRoute: 'pages/arcade/arcade',
      createdAt: now
    };
  },

  persistDailyPrimaryRecallEvidence(action = {}) {
    const packet = this.buildDailyPrimaryRecallEvidencePacket(action);
    if (storage.appendReviewEvent) {
      storage.appendReviewEvent(packet);
    }
    if (storage.recordGameSessionResult) {
      storage.recordGameSessionResult({
        gameType: 'daily_primary_recall_ticket',
        total: 1,
        correct: 0,
        accuracy: 0,
        recallEvidence: [packet],
        activeRecallEvidenceComplete: false
      }, {
        gameType: 'daily_primary_recall_ticket',
        reportId: (this.data.reportSourceContext && this.data.reportSourceContext.reportId) || '',
        flowTraceId: (this.data.reportSourceContext && this.data.reportSourceContext.flowTraceId) || '',
        route: (this.data.reportSourceContext && this.data.reportSourceContext.returnRoute) || '/pages/arcade/arcade'
      });
    }
    return packet;
  },

  runDailyPrimaryRecallAction() {
    const action = this.data.dailyPrimaryRecallAction || {};
    const evidencePacket = this.persistDailyPrimaryRecallEvidence(action);
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'daily_primary_recall_action',
        sourceLabel: '每日主回忆动作',
        actionId: action.id || 'daily_primary_recall_action',
        actionLabel: action.title || '今天只做一个主回忆动作',
        route: action.route || '/pages/review/review?mode=recall_return',
        reasonLine: action.oneActionLine || '',
        evidenceLine: action.xpGate || ''
      });
    }
    this.setData({
      dailyPrimaryRecallEvidencePacket: evidencePacket,
      feedbackText: '已锁定明天回访。先去说第一步，完成后才释放奖励。'
    });
    navigation.navigateLearningRoute(action.route || '/pages/review/review?mode=recall_return');
  },

  runResultSecondary() {
    if (this.data.repairFocus) {
      this.repairWrongCard();
      return;
    }
    this.goReview();
  },

  runArcadeResultBridgeAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const bridge = this.data.arcadeResultActionBridge || {};
    const route = dataset.route || '/pages/review/review';
    const action = {
      source: 'arcade_result_bridge',
      sourceLabel: '轻练习结果行动桥',
      actionId: dataset.id || 'review',
      actionLabel: dataset.label || '明天回看',
      route,
      reasonLine: dataset.reason || bridge.headline || '',
      evidenceLine: bridge.evidenceLine || '',
      shareIntent: bridge.shareLine || ''
    };
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction(Object.assign({}, action, { surface: 'arcade' }));
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'arcade',
        dimensionId: action.actionId,
        label: action.actionLabel,
        route,
        readiness: 'arcade_result_bridge',
        capabilityId: dataset.capabilityId || 'game'
      });
    }
    if (storage.appendReviewEvent) {
      storage.appendReviewEvent({
        kind: 'arcade_result_bridge_action',
        action_id: action.actionId,
        route,
        evidence: action.evidenceLine
      });
    }
    api.submitEvent({
      event: 'arcade_result_bridge_action',
      source: 'arcade_result',
      entity_id: action.actionId,
      page: 'arcade',
      payload: {
        route,
        action_label: action.actionLabel,
        evidence: action.evidenceLine,
        reason: action.reasonLine
      }
    }).catch(() => {});
    navigation.navigateLearningRoute(route);
  },

  onShareAppMessage() {
    const bridge = this.data.arcadeResultActionBridge || {};
    const payload = bridge.shareChallengePayload || {};
    const shareCode = payload.share_code || payload.invite_code || `ARCADE_${Date.now()}`;
    const title = bridge.shareChallengeTitle || bridge.primaryShareLabel || '同类第一步接力';
    const safePayload = shareRelaySchema.buildSafeSharePayload({ code: shareCode, payload }, 'peer_90s_relay', {
      share: shareCode,
      share_code: shareCode,
      share_intent: 'peer_90s_relay',
      from: 'arcade_peer_relay',
      mode: 'receiver_own_material',
      challenge: 'arcade',
      next_challenge: 'arcade'
    });
    const path = shareRelaySchema.buildShareRelayQuery('/pages/home/home', safePayload);
    if (storage.appendShareRun) {
      storage.appendShareRun({
        share_code: shareCode,
        type: 'arcade_peer_90s_relay',
        title,
        path,
        share_intent: 'peer_90s_relay',
        payload: safePayload
      });
    }
    return {
      title,
      path
    };
  },

  repairWrongCard() {
    const focus = this.data.repairFocus;
    if (!focus || !focus.cardId) {
      this.goReview();
      return;
    }
    storage.set(storage.KEYS.selectedHomework, {
      id: focus.id,
      text: focus.text,
      reason: focus.reason,
      minutes: focus.minutes,
      evidence: {
        tags: focus.tags,
        decision: focus.decision,
        calibration_key: focus.calibrationKey,
        misconception_tags: [
          {
            id: focus.cardId,
            name: focus.knowledgeType,
            axis: focus.gameName,
            suggested_drill: focus.correctAnswer
          }
        ],
        arcade: {
          game_type: focus.gameType,
          selected: focus.selected,
          correct_answer: focus.correctAnswer
        }
      }
    });
    storage.set(storage.KEYS.selectedHomeworkSource, `arcade:${focus.gameType}:${focus.cardId}`);
    storage.appendReviewEvent({
      kind: 'arcade_repair_started',
      game_type: focus.gameType,
      card_id: focus.cardId,
      selected: focus.selected,
      answer: focus.correctAnswer
    });
    navigation.navigateLearningRoute('/pages/tutor/tutor?from=arcade');
  },
  runSurfaceDepthAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const pack = this.data.surfaceDepthPack || {};
    const route = dataset.route || pack.primaryRoute;
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: pack.surface || dataset.surface || '',
        dimensionId: dataset.dimensionId || '',
        label: dataset.label || '',
        route,
        readiness: pack.surfaceReadiness || ''
      });
    }
    navigation.navigateLearningRoute(route);
  },

});
