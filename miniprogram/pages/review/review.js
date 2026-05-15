const reviewCards = require('../../utils/review-cards');
const storage = require('../../utils/storage');
const api = require('../../utils/api');
const reviewViewModels = require('../../view-models/review-view-model');

const DEFAULT_GAME_RUNWAY = {
  due: 0,
  level: 1,
  xp: 0,
  streak: 0,
  hearts: [],
  percent: 0,
  missionTitle: '完成今日复习目标',
  missionProgress: 0,
  missionHint: '先完成今天这一轮复习',
  rewards: [],
  primaryLabel: '录入错题',
  primaryAction: 'import'
};
const DEFAULT_MISTAKE_HUB = {
  totalMistakes: 0,
  appMistakes: 0,
  manualMistakes: 0,
  repairReady: 0,
  wrongToday: 0,
  weakSpot: null,
  repairItems: []
};

Page({
  data: {
    summary: null,
    cards: [],
    current: null,
    index: 0,
    showAnswer: false,
    done: false,
    progressText: '0/0',
    feedbackText: '',
    importText: '',
    importPreview: [],
    importPlan: null,
    dailyLimit: 5,
    desiredRetention: 90,
    editQuestion: '',
    editAnswer: '',
    editOpen: false,
    suspendedCards: [],
    buriedCards: [],
    browserQuery: '',
    browserStatus: 'all',
    browserSource: 'all',
    browserType: 'all',
    browserTemplate: 'all',
    browserCards: [],
    deckSnapshotText: '',
    sessionMode: 'smart',
    sessionFeedback: null,
    quizRunning: false,
    quizIndex: 0,
    quizCurrent: null,
    quizAnswers: [],
    quizShowAnswer: false,
    quizFeedback: null,
    reviewPlaybook: null,
    challengeCard: null,
    gameRunway: DEFAULT_GAME_RUNWAY,
    mistakeHub: DEFAULT_MISTAKE_HUB,
    reviewViewModel: reviewViewModels.buildReviewViewModel(),
    todayFocus: null,
    miniActionText: '',
    tonightPlan: null,
    routeStrip: null,
    companionPreference: null,
    companionCopy: { review: '咕点陪你只修这一小步，不讲完整答案。' },
    companionLine: '咕点：我懂你卡住了，我陪你先迈出第一步。',
    growthMemory: { review: '' },
    showAdvancedReview: false,
    lastWrongCard: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    const yesterday = storage.getYesterdayReview ? storage.getYesterdayReview() : null;
    if (yesterday && storage.markReviewCardRevisited) storage.markReviewCardRevisited(yesterday.id);
    this.refresh();
    this.refreshServerGameState();
  },

  refresh() {
    const summary = reviewCards.reviewSummary();
    const todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
    const tonightPlan = storage.loadTonightPlan ? storage.loadTonightPlan() : null;
    const companionPreference = storage.loadCompanionPreference ? storage.loadCompanionPreference() : null;
    const limit = (summary.deck && summary.deck.dailyLimit) || 5;
    const cards = reviewCards.sessionCards(this.data.sessionMode, limit);
    const gameRunway = this.buildGameRunway(summary, cards);
    const focusProgress = todayFocus ? Number(todayFocus.progress || 0) : gameRunway.percent;
    const reviewViewModel = reviewViewModels.buildReviewViewModel({
      companionPreference,
      todayFocus,
      tonightPlan
    });
    this.setData({
      summary,
      cards,
      current: cards[0] || null,
      index: 0,
      showAnswer: false,
      done: !cards.length,
      progressText: cards.length ? `1/${cards.length}` : '0/0',
      feedbackText: '',
      editQuestion: cards[0] ? cards[0].question : '',
      editAnswer: cards[0] ? cards[0].answer : '',
      editOpen: false,
      dailyLimit: (summary.deck && summary.deck.dailyLimit) || 5,
      desiredRetention: Math.round(((summary.deck && summary.deck.desiredRetention) || 0.9) * 100),
      suspendedCards: reviewCards.suspendedCards(6),
      buriedCards: reviewCards.buriedCards(6),
      browserCards: reviewCards.cardBrowser(this.browserPayload()),
      lastWrongCard: null,
      quizRunning: false,
      quizIndex: 0,
      quizCurrent: null,
      quizAnswers: [],
      quizShowAnswer: false,
      gameRunway: Object.assign({}, gameRunway, {
        percent: Math.max(Number(gameRunway.percent || 0), Math.max(0, Math.min(100, focusProgress || 0)))
      }),
      mistakeHub: this.buildMistakeHub(summary, todayFocus),
      reviewViewModel,
      todayFocus,
      miniActionText: todayFocus && todayFocus.miniActionText ? todayFocus.miniActionText : this.data.miniActionText,
      tonightPlan,
      routeStrip: this.buildRouteStrip('repair', tonightPlan),
      companionPreference,
      companionCopy: {
        review: storage.getCompanionStageCopy ? storage.getCompanionStageCopy('review_focus', companionPreference) : '咕点陪你只修这一小步，不讲完整答案。'
      },
      companionLine: storage.formatCompanionLine ? storage.formatCompanionLine(companionPreference) : '咕点：我懂你卡住了，我陪你先迈出第一步。',
      growthMemory: {
        review: storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('review', companionPreference) : ''
      },
      reviewPlaybook: this.buildReviewPlaybook(summary, cards),
      challengeCard: this.buildChallengeCard(summary)
    });
  },

  buildRouteStrip(active, tonightPlan) {
    const steps = (tonightPlan && tonightPlan.routeSteps) || [
      { id: 'plan', label: '排顺序' },
      { id: 'first_step', label: '说第一步' },
      { id: 'repair', label: '修卡点' },
      { id: 'review', label: '轻回访' },
      { id: 'parent', label: '家长看' }
    ];
    return {
      text: '今晚路线：这里承接最值得修的一个卡点。',
      steps: steps.map((step) => Object.assign({}, step, { active: step.id === active }))
    };
  },

  refreshServerGameState() {
    api.reviewToday({
      cards: storage.loadReviewCards ? storage.loadReviewCards() : [],
      events: storage.loadReviewEvents ? storage.loadReviewEvents() : [],
      profile: storage.loadGameProfile ? storage.loadGameProfile() : {}
    }).then((result) => {
      if (!result || !result.ok) return;
      this.setData({
        summary: Object.assign({}, this.data.summary || reviewCards.reviewSummary(), {
          serverToday: result
        })
      });
    }).catch(() => {});
  },

  buildGameRunway(summary, cards) {
    const safe = summary || {};
    const loop = safe.loop || {};
    const progress = safe.progress || {};
    const season = safe.season || {};
    const quiz = safe.quiz || {};
    const goal = safe.goal || {};
    const qualityQueue = safe.qualityQueue || [];
    const maxLives = Number(loop.maxLives || season.maxLives || 5);
    const lives = Math.max(0, Math.min(maxLives, Number(loop.lives || season.lives || maxLives)));
    const due = safe.due || cards.length || 0;
    const percent = goal.progress !== undefined
      ? Math.max(0, Math.min(100, Number(goal.progress || 0)))
      : Math.max(0, Math.min(100, Math.round(((safe.reviewedToday || 0) / Math.max(1, safe.reviewedToday + due)) * 100)));
    return {
      eyebrow: '今日回访',
      title: due ? '今天先赢这一关' : '今天保持手感',
      subtitle: due
        ? `咕点只推 ${due} 张最该复习的卡，卡住再回作业点拨拆一步。`
        : '没有到期卡时，不硬塞任务。可以先做一轮轻练习。',
      season: season.tier || '青铜',
      level: progress.level || 1,
      xp: progress.xp || 0,
      roundLabel: due ? '今日到期' : '保持手感',
      memoryLabel: due ? `${due} 张待复习` : '暂无到期卡',
      streak: safe.streak || loop.currentStreak || 0,
      lives,
      maxLives,
      hearts: Array.from({ length: maxLives }, (_, index) => ({
        id: `heart_${index}`,
        alive: index < lives
      })),
      percent,
      due,
      quiz: quiz.count || 0,
      repair: qualityQueue.length || 0,
      mastered: safe.mastered || 0,
      missionTitle: (safe.challenge && safe.challenge.title) || (goal.achieved ? '今日目标已完成' : '完成今日复习目标'),
      missionProgress: safe.challenge ? safe.challenge.progress : (goal.progress || 0),
      missionHint: safe.challenge
        ? `${safe.challenge.current || 0}/${safe.challenge.target || 1} · 完成后明天再看`
        : goal.label || '先完成今天这一轮复习',
      rewards: (safe.rewards || []).slice(0, 2).map((reward) => Object.assign({}, reward, {
        stateLabel: reward.claimed ? '已记录' : reward.canClaim ? '可记录' : '未完成'
      })),
      primaryLabel: due ? '开始轻回访' : '先轻练一下',
      primaryAction: due ? 'review' : 'import',
      secondaryLabel: quiz.count ? '做 3 分钟测验' : '找卡点',
      secondaryAction: quiz.count ? 'quiz' : 'repair',
      lanes: [
        { id: 'review', title: '轻回访', value: due, label: '到期卡', action: 'review' },
        { id: 'quiz', title: '主动回忆', value: quiz.count || 0, label: '测验卡', action: 'quiz' },
        { id: 'repair', title: '卡点修复', value: qualityQueue.length || 0, label: '待修复', action: 'repair' }
      ]
    };
  },

  buildMistakeHub(summary, todayFocus) {
    const safe = summary || {};
    const sources = Array.isArray(safe.sources) ? safe.sources : [];
    const qualityQueue = Array.isArray(safe.qualityQueue) ? safe.qualityQueue : [];
    const reviewEvents = storage.loadReviewEvents ? storage.loadReviewEvents() : [];
    const appSources = ['tutor', 'thinking_receipt', 'homework_plan', 'module', 'radar', 'review_grade', 'review_quiz'];
    const appMistakes = sources
      .filter((item) => appSources.includes(item.source))
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    const manualMistakes = sources
      .filter((item) => item.source === 'manual_import' || item.source === 'remote_ai_content_engine_v1' || item.source === 'rule_content_engine_v2')
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    const wrongToday = reviewEvents.filter((event) => {
      const day = String(event.created_at || '').slice(0, 10);
      return day === new Date().toISOString().slice(0, 10) && (event.rating === 'again' || event.rating === 'hard');
    }).length;
    return {
      totalMistakes: Number(safe.total || 0),
      appMistakes,
      manualMistakes: Number(safe.imported || 0) || manualMistakes,
      repairReady: qualityQueue.length,
      wrongToday,
      weakSpot: this.buildWeakSpot(safe, qualityQueue, reviewEvents, todayFocus),
      repairItems: qualityQueue.slice(0, 3).map((item) => Object.assign({}, item, {
        question: item.question || '这道错题需要补一句卡在哪',
        reason: item.reason || '建议补充卡住的一步',
        repairPreviewQuestion: item.repairPreviewQuestion || ''
      }))
    };
  },

  buildWeakSpot(summary, qualityQueue, reviewEvents, todayFocus) {
    if (todayFocus && todayFocus.title) {
      const progress = Number(todayFocus.progress || 0);
      return {
        name: todayFocus.title || (todayFocus.issueType ? storage.formatIssueType(todayFocus.issueType) : '今晚先修这一处'),
        evidence: todayFocus.reason || (todayFocus.isStuck ? '你不是整题不会，只是卡在第一步。' : '来自今天的第一步想法。'),
        cause: todayFocus.sourceText || todayFocus.thought ? `原话：${String(todayFocus.sourceText || todayFocus.thought).slice(0, 42)}` : '先把卡住点说清楚。',
        next: todayFocus.issueType ? `对应修法：先说第一步，再做一道小变式。` : (todayFocus.recommendation || '先说清第一步，再做一道小变式'),
        helper: todayFocus.helper || '原小点会先问一步，不直接讲最终结果。',
        status: todayFocus.repairStatus || 'not_started',
        statusText: todayFocus.repairStatus === 'completed' ? '明天回访' : todayFocus.repairStatus === 'in_progress' ? '进行中' : '未开始',
        confidence: Math.max(62, Math.min(96, progress ? progress + 28 : 72))
      };
    }
    const state = storage.loadState ? storage.loadState() : {};
    const weak = ((state.weak_points || [])[0]) || {};
    const thinking = storage.thinkingReceiptSummary ? storage.thinkingReceiptSummary() : {};
    const review = summary || {};
    const queue = Array.isArray(qualityQueue) ? qualityQueue : [];
    const repeatedWrong = queue.length;
    const wrongEvents = (Array.isArray(reviewEvents) ? reviewEvents : [])
      .filter((event) => event.rating === 'again' || event.rating === 'hard').length;
    const name = weak.name
      || (queue[0] && (storage.formatInternalLabel ? storage.formatInternalLabel(queue[0].weakPoint || queue[0].reason, '') : (queue[0].weakPoint || queue[0].reason)))
      || '先定位一个卡点';
    const evidence = [
      weak.score !== undefined ? `卡点 ${weak.score} 分` : '',
      repeatedWrong ? `${repeatedWrong} 个卡点待修` : '',
      wrongEvents ? `${wrongEvents} 次复习卡住` : '',
      thinking.total ? `${thinking.total} 条思路记录` : ''
    ].filter(Boolean);
    const cause = /单位|条件|审题/.test(name)
      ? '更像审题和条件识别问题'
      : /步骤|方法|建模|关系/.test(name)
        ? '更像步骤断点或建模问题'
        : /概念|定义|原理/.test(name)
          ? '更像概念没有讲清'
          : repeatedWrong ? '需要先说清卡在哪，再练同类题' : '先录入一道真实错题，咕点会继续判断';
    const next = /单位|条件|审题/.test(name)
      ? '先练圈条件和单位，再做同类题'
      : /概念|定义|原理/.test(name)
        ? '先用一句话解释概念，再做题'
        : '先说清第一步，再做一道小变式';
    return {
      name,
      evidence: evidence.length ? evidence.join(' · ') : '等待更多真实记录',
      cause,
      next,
      helper: wrongEvents || repeatedWrong ? '先回作业点拨拆卡点，再生成一道同类题。' : '先录入一道真实错题，再用作业点拨问清卡点。',
      confidence: Math.min(96, 52 + Math.min(18, repeatedWrong * 6) + Math.min(18, wrongEvents * 3) + Math.min(8, Number(thinking.total || 0) * 2))
    };
  },

  buildReviewPlaybook(summary, cards) {
    const safe = summary || {};
    const nextStep = safe.nextStep || { mode: 'smart', message: '先复习价值最高的一组卡。' };
    const quiz = safe.quiz || { count: 0, estimatedMinutes: 0 };
    const qualityQueue = safe.qualityQueue || [];
    const sources = safe.sources || [];
    const loop = safe.loop || {};
    return {
      title: '今日复习路线',
      label: '先复习最该看的卡，再做一次主动回忆，最后只修一个关键卡点。',
      primary: {
        title: nextStep.message,
        meta: `${nextStep.mode || 'smart'} 模式 / ${cards.length || safe.due || 0} 张卡`,
        action: 'review'
      },
      stats: [
        { label: '到期', value: safe.due || 0 },
        { label: '测验', value: quiz.count || 0 },
        { label: '修复', value: qualityQueue.length || 0 },
        { label: '生命', value: `${loop.lives || 0}/${loop.maxLives || 0}` }
      ],
      actions: [
        {
          id: 'review',
          title: '复习最佳队列',
          desc: '只看调度器认为最该看的卡，不把所有内容重新刷一遍。',
          action: 'review',
          cta: '开始复习'
        },
        {
          id: 'quiz',
          title: '做一次测验',
          desc: `主动回忆检查，大约 ${quiz.estimatedMinutes || 3} 分钟。`,
          action: 'quiz',
          cta: '开始测验'
        },
        {
          id: 'repair',
          title: '修一个卡点',
          desc: qualityQueue[0] ? qualityQueue[0].reason : '当前没有紧急修复项。',
          action: 'repair',
          cta: '去修复'
        },
        {
          id: 'tutor',
          title: '回作业点拨',
          desc: '如果又卡住，先回作业点拨拆一步，再继续加卡。',
          action: 'tutor',
          cta: '打开作业点拨'
        }
      ],
      longTermRecord: {
        title: '长期记忆资产',
        label: `${sources.length} 类来源汇入同一套卡组：今晚安排、作业、作业点拨、学习模块和导入材料都会沉淀。`,
        score: safe.assetCompounding ? safe.assetCompounding.score : (safe.maturity ? safe.maturity.overall : 0)
      }
    };
  },

  buildChallengeCard(summary) {
    const safe = summary || {};
    const social = safe.socialChallenge || {};
    const progress = safe.progress || {};
    const season = safe.season || {};
    const quiz = safe.quiz || {};
    const goal = safe.goal || {};
    const firstMission = (social.missions || [])[0] || {};
    const name = (storage.loadProfile() && storage.loadProfile().name) || '同学';
    return {
      title: '今日复盘卡',
      label: '可以分享自己的今日复盘卡，当前只展示个人复盘，不展示同学榜或好友挑战。',
      headline: `${name} 今天正在完成 ${season.tier || '青铜'} 复习冲刺。`,
      inviteCode: social.inviteCode || '本地复盘',
      shareCopy: `${name} 今天完成 ${goal.completed || 0}/${goal.target || 0} 个复习目标，回访了 ${quiz.count || 0} 张卡。`,
      prompts: [
        `任务：${firstMission.title || '完成一次专注回忆冲刺'}`,
        `检查点：${season.checkpoint || '完成今日任务'}`,
        `今日提示：${social.dailyPrompt || '守住一个卡点'}`
      ],
      stats: [
        { id: 'goal', label: '目标', value: `${goal.completed || 0}/${goal.target || 0}` },
        { id: 'quiz', label: '测验', value: quiz.count || 0 },
        { id: 'xp', label: '回访', value: progress.xp || 0 },
        { id: 'tier', label: '段位', value: season.tier || '青铜' }
      ]
    };
  },

  runPlaybookAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'review') {
      const currentFocus = this.data.todayFocus || (storage.loadTodayFocus ? storage.loadTodayFocus() : null);
      const blackboardHint = storage.buildBlackboardHint ? storage.buildBlackboardHint(currentFocus || {}) : null;
      const blackboardUsedAt = blackboardHint ? new Date().toISOString() : '';
      const focus = storage.updateTodayFocusRepair ? storage.updateTodayFocusRepair({
        repairStatus: 'in_progress',
        progress: Math.max(56, Number((this.data.todayFocus && this.data.todayFocus.progress) || 0)),
        blackboardHint: blackboardHint ? Object.assign({}, blackboardHint, { usedAt: blackboardUsedAt }) : undefined,
        blackboardUsedAt
      }) : null;
      this.setData({
        todayFocus: focus || this.data.todayFocus,
        feedbackText: '已进入 5 分钟修复：先说清第一步，再做一道小变式。'
      });
      this.refresh();
      return;
    }
    if (action === 'import') {
      this.setData({ showAdvancedReview: true });
      wx.pageScrollTo({ selector: '.import-panel', duration: 220 });
      return;
    }
    if (action === 'quiz') {
      this.startQuiz();
      return;
    }
    if (action === 'repair') {
      this.runMission({ currentTarget: { dataset: { action: 'repair' } } });
      return;
    }
    if (action === 'tutor') {
      this.goTutor();
      return;
    }
    const mode = (this.data.summary && this.data.summary.nextStep && this.data.summary.nextStep.mode) || 'smart';
    this.setData({ sessionMode: mode });
    this.refresh();
  },

  toggleAdvancedReview() {
    this.setData({ showAdvancedReview: !this.data.showAdvancedReview });
  },

  openImportPanel() {
    this.setData({ showAdvancedReview: true });
    wx.pageScrollTo({ selector: '.import-panel', duration: 220 });
  },

  copyChallengeCard() {
    const card = this.data.challengeCard;
    if (!card) return;
    const text = [card.headline, card.shareCopy].concat(card.prompts || []).join('\n');
    wx.setClipboardData({
      data: text,
      success: () => {
        this.setData({ feedbackText: '复盘卡已复制，可以发给家长或留作今天的学习记录。' });
      }
    });
  },

  browserPayload(patch = {}) {
    return {
      query: patch.query !== undefined ? patch.query : this.data.browserQuery,
      status: patch.status !== undefined ? patch.status : this.data.browserStatus,
      source: patch.source !== undefined ? patch.source : this.data.browserSource,
      type: patch.type !== undefined ? patch.type : this.data.browserType,
      template: patch.template !== undefined ? patch.template : this.data.browserTemplate,
      limit: 8
    };
  },

  setSessionMode(event) {
    this.setData({ sessionMode: event.currentTarget.dataset.mode || 'smart' });
    this.refresh();
  },

  runMission(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'quiz') {
      this.startQuiz();
      return;
    }
    if (action === 'repair') {
      const first = this.data.summary && this.data.summary.qualityQueue && this.data.summary.qualityQueue[0];
      if (first && first.noteId) {
        this.editQueueItem({ currentTarget: { dataset: { noteId: first.noteId } } });
      }
      return;
    }
    if (action === 'maintain') {
      this.setData({
        browserStatus: 'leech',
        browserCards: reviewCards.cardBrowser(this.browserPayload({ status: 'leech' })),
        feedbackText: '已筛出最需要维护的高优先级卡片。'
      });
      return;
    }
    this.setData({ sessionMode: 'smart' });
    this.refresh();
  },

  importTemplateDeck(event) {
    const templateId = event.currentTarget.dataset.id;
    const templates = (this.data.summary && this.data.summary.publicDeckTemplates) || [];
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const result = reviewCards.importTextToDeck(template.text, {
      source: 'public_template_deck',
      subject: template.subject || ''
    });
    this.setData({
      feedbackText: `已从「${template.title}」导入 ${result.imported || 0} 张卡。`
    });
    this.syncQuietly();
    this.refresh();
  },

  reveal() {
    if (!this.data.current) return;
    this.setData({ showAnswer: true });
  },

  startQuiz() {
    const quiz = this.data.summary && this.data.summary.quiz;
    if (!quiz || !quiz.questions || !quiz.questions.length) {
      wx.showToast({ title: '还没有测验卡', icon: 'none' });
      return;
    }
    this.setData({
      quizRunning: true,
      quizIndex: 0,
      quizCurrent: quiz.questions[0],
      quizAnswers: [],
      quizShowAnswer: false,
      quizFeedback: null
    });
    api.generateQuiz({
      cards: (this.data.cards || []).slice(0, 8),
      limit: 6
    }).then((result) => {
      if (!result || !result.ok || !result.questions || !result.questions.length) return;
      this.setData({
        summary: Object.assign({}, this.data.summary || {}, {
          serverQuiz: result
        })
      });
    }).catch(() => {});
  },

  revealQuizAnswer() {
    if (!this.data.quizRunning) return;
    this.setData({ quizShowAnswer: true });
  },

  answerQuiz(event) {
    const correct = event.currentTarget.dataset.correct === 'true';
    const quiz = this.data.summary && this.data.summary.quiz;
    const questions = (quiz && quiz.questions) || [];
    const question = questions[this.data.quizIndex];
    if (!question) return;
    const nextAnswers = this.data.quizAnswers.concat([{
      cardId: question.cardId,
      correct,
      rating: correct ? 'good' : 'again'
    }]);
    const nextIndex = this.data.quizIndex + 1;
    if (nextIndex >= questions.length) {
      const result = reviewCards.finishQuizAttempt(nextAnswers, { mode: quiz.mode });
      this.setData({
        quizRunning: false,
        quizIndex: 0,
        quizCurrent: null,
        quizAnswers: [],
        quizShowAnswer: false,
        quizFeedback: result,
        feedbackText: `测验 ${result.correct}/${result.count}，新增修复 ${result.repair_drills || 0}`
      });
      api.submitQuiz({
        answers: nextAnswers,
        profile: storage.loadGameProfile ? storage.loadGameProfile() : {}
      }).then((serverResult) => {
        if (serverResult && serverResult.ok && serverResult.event) {
          api.submitEvent({
            event: 'review_completed',
            source: 'review_quiz',
            entity_id: serverResult.attempt_id || result.attemptId || '',
            page: 'review',
            payload: serverResult.event
          }).catch(() => {});
        }
      }).catch(() => {});
      this.syncQuietly();
      this.refresh();
      return;
    }
    this.setData({
      quizIndex: nextIndex,
      quizCurrent: questions[nextIndex],
      quizAnswers: nextAnswers,
      quizShowAnswer: false
    });
  },

  syncQuietly() {
    api.flushLocalSyncQueue().then(() => {
      this.setData({ summary: reviewCards.reviewSummary() });
    });
  },

  claimReward(event) {
    const rewardId = event.currentTarget.dataset.id;
    if (!rewardId) return;
    const result = reviewCards.claimReward(rewardId, this.data.summary);
    if (!result.ok) {
      wx.showToast({ title: '这条记录还没完成', icon: 'none' });
      return;
    }
    this.setData({
      feedbackText: `已记下这一小步${result.reward.lives ? `，今天还能继续 ${result.reward.lives} 次` : ''}`
    });
    this.syncQuietly();
    this.refresh();
  },

  rate(event) {
    const rating = event.currentTarget.dataset.rating || 'good';
    const current = this.data.current;
    if (!current) return;
    reviewCards.reviewCard(current.id, rating);
    api.gradeReview({
      card: current,
      rating,
      profile: storage.loadGameProfile ? storage.loadGameProfile() : {}
    }).then((serverResult) => {
      if (serverResult && serverResult.ok && serverResult.event) {
        api.submitEvent({
          event: 'review_completed',
          source: 'review_grade',
          entity_id: serverResult.card_id || current.id,
          page: 'review',
          payload: serverResult.event
        }).catch(() => {});
      }
    }).catch(() => {});
    const nextIndex = this.data.index + 1;
    const cards = this.data.cards;
    const done = nextIndex >= cards.length;
    const summary = reviewCards.reviewSummary();
    const lastEvent = (storage.loadReviewEvents ? storage.loadReviewEvents()[0] : null) || {};
    const xpText = lastEvent.xp ? '，已记进今天回访' : '';
    const feedbackText = (rating === 'again'
      ? '已安排明天再看，先回作业点拨拆一步。'
      : rating === 'hard'
        ? '已缩短间隔，后面还会更快出现。'
        : rating === 'easy'
          ? '已拉长间隔。'
          : '已记录掌握。') + xpText;
    this.setData({
      index: nextIndex,
      current: done ? null : cards[nextIndex],
      showAnswer: false,
      done,
      progressText: done ? `${cards.length}/${cards.length}` : `${nextIndex + 1}/${cards.length}`,
      summary,
      gameRunway: this.buildGameRunway(summary, done ? [] : cards.slice(nextIndex)),
      feedbackText,
      editQuestion: done ? '' : cards[nextIndex].question,
      editAnswer: done ? '' : cards[nextIndex].answer,
      editOpen: false,
      lastWrongCard: rating === 'again' ? current : this.data.lastWrongCard,
      sessionFeedback: done ? reviewCards.userSessionFeedback(this.data.sessionMode, cards.slice(0, nextIndex)) : this.data.sessionFeedback
    });
    this.syncQuietly();
    if (done) this.refresh();
  },

  completeTodayRepair() {
    const miniActionText = String(this.data.miniActionText || (this.data.todayFocus && (this.data.todayFocus.childArticulatedStep || this.data.todayFocus.childStepSentence)) || '').trim();
    const quality = storage.childStepQuality ? storage.childStepQuality(miniActionText) : (miniActionText.length >= 3 ? 'partial' : 'empty');
    if (!(this.data.todayFocus && (this.data.todayFocus.childArticulatedStep || this.data.todayFocus.hasMiniActionDone)) || ['empty', 'vague'].includes(quality)) {
      this.setData({
        feedbackText: '先用自己的话补一句第一步，再完成修复。说不完整也没关系。'
      });
      return;
    }
    const focus = storage.updateTodayFocusRepair ? storage.updateTodayFocusRepair({
      repairStatus: 'completed',
      progress: 100,
      hasMiniActionDone: true,
      miniActionText,
      childArticulatedStep: miniActionText,
      childStepSentence: miniActionText,
      childStepQuality: quality,
      firstStepStatus: 'revisited',
      firstStepSource: 'child_articulated'
    }) : null;
    if (storage.appendReviewEvent) {
      storage.appendReviewEvent({
        kind: 'today_focus_repaired',
        rating: 'good',
        focus_id: focus && focus.id,
        focus_title: focus && focus.title
      });
    }
    this.setData({
      todayFocus: focus || this.data.todayFocus,
      gameRunway: Object.assign({}, this.data.gameRunway || {}, { percent: 100 }),
      feedbackText: '今天这个卡点先修到这里。明天只轻轻回看这一步。'
    });
  },

  markMiniActionDone() {
    const miniActionText = String(this.data.miniActionText || '').trim();
    const savedStep = storage.saveChildArticulatedStep
      ? storage.saveChildArticulatedStep(miniActionText, {
          repairStatus: 'in_progress',
          progress: 78,
          mini_action_required: false
        })
      : null;
    const focus = storage.updateTodayFocusRepair ? storage.updateTodayFocusRepair({
      repairStatus: 'in_progress',
      progress: 78,
      hasMiniActionDone: true,
      miniActionText: savedStep && savedStep.childArticulatedStep ? savedStep.childArticulatedStep : miniActionText,
      mini_action_required: false
    }) : savedStep;
    if (focus && focus.blockedReason === 'mini_action_required') {
      this.setData({
        todayFocus: focus,
        miniActionText,
        feedbackText: '先用自己的话说一句第一步，再完成修复。'
      });
      return;
    }
    this.setData({
      todayFocus: focus || this.data.todayFocus,
      miniActionText: focus && (focus.childArticulatedStep || focus.miniActionText) ? (focus.childArticulatedStep || focus.miniActionText) : miniActionText,
      feedbackText: '小动作记下来了：这是你自己准备开始的第一步。'
    });
    this.refresh();
  },

  chooseMiniAction(event) {
    const text = event.currentTarget.dataset.text || '';
    this.setData({ miniActionText: text });
    const focus = storage.saveChildArticulatedStep ? storage.saveChildArticulatedStep(text, {
      repairStatus: 'in_progress',
      progress: 78
    }) : null;
    this.setData({
      todayFocus: focus || this.data.todayFocus,
      feedbackText: '咕点记下来了。这不是答案，只是你准备开始的第一步。'
    });
    this.refresh();
  },

  onMiniActionInput(event) {
    this.setData({ miniActionText: event.detail.value });
  },

  onImportInput(event) {
    const importText = event.detail.value;
    const importPlan = reviewCards.contentEnginePlan(importText, {
      subject: (this.data.summary && this.data.summary.deck && this.data.summary.deck.subject) || ''
    });
    this.setData({
      importText,
      importPreview: importPlan.cards.slice(0, 5),
      importPlan
    });
  },

  importCards() {
    const text = String(this.data.importText || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴笔记或卡点', icon: 'none' });
      return;
    }
    this.setData({ feedbackText: '正在调用内容引擎生成卡片...' });
    api.buildContentCards({
      text,
      subject: (this.data.summary && this.data.summary.deck && this.data.summary.deck.subject) || ''
    }).then((engineResult) => {
      const result = reviewCards.importGeneratedCards(engineResult.cards || [], {
        source: engineResult.provider || 'remote_ai_content_engine_v1'
      });
      this.setData({
        importText: '',
        importPreview: [],
        importPlan: null,
        feedbackText: `内容引擎已导入 ${result.imported || 0} 张，跳过重复 ${result.skipped || 0} 张`
      });
      this.syncQuietly();
      this.refresh();
    }).catch(() => {
      const result = reviewCards.importTextToDeck(text, { source: 'manual_import' });
      this.setData({
        importText: '',
        importPreview: [],
        importPlan: null,
        feedbackText: `本地内容引擎已导入 ${result.imported || 0} 张，跳过重复 ${result.skipped || 0} 张`
      });
      this.syncQuietly();
      this.refresh();
    });
  },

  onSettingInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  onBrowserInput(event) {
    const query = event.detail.value;
    this.setData({
      browserQuery: query,
      browserCards: reviewCards.cardBrowser(this.browserPayload({ query }))
    });
  },

  setBrowserStatus(event) {
    const status = event.currentTarget.dataset.status || 'all';
    this.setData({ browserStatus: status, browserCards: reviewCards.cardBrowser(this.browserPayload({ status })) });
  },

  setBrowserSource(event) {
    const source = event.currentTarget.dataset.source || 'all';
    this.setData({ browserSource: source, browserCards: reviewCards.cardBrowser(this.browserPayload({ source })) });
  },

  setBrowserType(event) {
    const type = event.currentTarget.dataset.type || 'all';
    this.setData({ browserType: type, browserCards: reviewCards.cardBrowser(this.browserPayload({ type })) });
  },

  setBrowserTemplate(event) {
    const template = event.currentTarget.dataset.template || 'all';
    this.setData({ browserTemplate: template, browserCards: reviewCards.cardBrowser(this.browserPayload({ template })) });
  },

  exportDeck() {
    const text = JSON.stringify(reviewCards.exportDeckSnapshot());
    this.setData({
      deckSnapshotText: text,
      feedbackText: `已生成牌组快照，包含 ${reviewCards.reviewSummary().total} 张卡`
    });
  },

  onSnapshotInput(event) {
    this.setData({ deckSnapshotText: event.detail.value });
  },

  importDeckSnapshot() {
    const text = String(this.data.deckSnapshotText || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴牌组 JSON', icon: 'none' });
      return;
    }
    try {
      const result = reviewCards.importDeckSnapshot(JSON.parse(text));
      this.setData({ feedbackText: `已合并 ${result.imported || 0} 张卡片` });
      this.syncQuietly();
      this.refresh();
    } catch (error) {
      wx.showToast({ title: 'JSON 格式不对', icon: 'none' });
    }
  },

  saveSettings() {
    const deck = reviewCards.updateDeckSettings({
      dailyLimit: Number(this.data.dailyLimit || 5),
      desiredRetention: Number(this.data.desiredRetention || 90) / 100
    });
    this.setData({
      feedbackText: `已更新：每日 ${deck.dailyLimit} 张，目标记忆率 ${Math.round(deck.desiredRetention * 100)}%`
    });
    this.refresh();
  },

  toggleEdit() {
    const current = this.data.current;
    this.setData({
      editOpen: !this.data.editOpen,
      editQuestion: current ? current.question : '',
      editAnswer: current ? current.answer : ''
    });
  },

  onEditInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  saveEdit() {
    const current = this.data.current;
    if (!current) return;
    reviewCards.updateNote(current.noteId, {
      question: this.data.editQuestion,
      answer: this.data.editAnswer
    });
    this.setData({ feedbackText: '已更新卡片', editOpen: false });
    this.syncQuietly();
    this.refresh();
  },

  suspendCurrent() {
    const current = this.data.current;
    if (!current) return;
    reviewCards.setCardSuspended(current.id, true);
    this.setData({ feedbackText: '已暂停这张卡' });
    this.refresh();
  },

  resumeCard(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    reviewCards.setCardSuspended(id, false);
    this.setData({ feedbackText: '已恢复卡片' });
    this.refresh();
  },

  unburyCard(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    reviewCards.unburyCard(id);
    this.setData({ feedbackText: '已恢复兄弟卡' });
    this.refresh();
  },

  editQueueItem(event) {
    const noteId = event.currentTarget.dataset.noteId;
    if (!noteId) return;
    const result = reviewCards.repairNote(noteId);
    if (result && result.ok) {
      this.setData({
        feedbackText: `已自动修复卡片。质量 ${result.updated.quality}，新增练习 ${result.drillImported || 0}`
      });
      this.syncQuietly();
      this.refresh();
      return;
    }
    const card = reviewCards.cardByNote(noteId);
    if (!card) {
      wx.showToast({ title: '未找到对应卡片', icon: 'none' });
      return;
    }
    this.setData({
      current: card,
      showAnswer: true,
      editOpen: true,
      editQuestion: card.question || '',
      editAnswer: card.answer || '',
      feedbackText: '已定位到待修卡片'
    });
  },

  goTutor() {
    const current = this.data.lastWrongCard || this.data.current;
    if (current) {
      storage.set(storage.KEYS.selectedHomework, {
        id: `review_${current.id}`,
        text: current.question,
        reason: current.answer,
        minutes: 8,
        evidence: {
          tags: ['复习', current.type],
          decision: '来自原点复习，先拆卡点再继续。',
          calibration_key: current.calibrationKey || `review:${current.id}`,
          misconception_tags: [
            {
              id: current.id,
              name: current.weakPoint || current.type,
              axis: current.subject || '复习',
              suggested_drill: current.answer
            }
          ]
        }
      });
      storage.set(storage.KEYS.selectedHomeworkSource, `review:${current.id}`);
    }
    wx.navigateTo({ url: '/pages/tutor/tutor' });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goTools() {
    wx.switchTab({ url: '/pages/tools/tools' });
  },

  goFocus() {
    wx.switchTab({ url: '/pages/focus/focus' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
