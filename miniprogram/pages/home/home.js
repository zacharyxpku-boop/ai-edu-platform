const storage = require('../../utils/storage');
const reviewCards = require('../../utils/review-cards');
const learningModules = require('../../utils/learning-modules');

Page({
  data: {
    state: null,
    weakPoints: [],
    topMust: null,
    isDemo: false,
    stats: { must: 0, flexible: 0, skip: 0 },
    proofStats: [
      { label: 'Must-do time', value: '0 min' },
      { label: 'Time saved', value: '0 min' },
      { label: 'Wrong-cause hits', value: '0' }
    ],
    topMustProof: null,
    reviewSummary: null,
    loopSummary: null,
    syncSummary: null,
    todayActions: [],
    cockpit: null,
    executiveBrief: null,
    demoStory: null,
    demoReplay: null,
    investorTour: null,
    pathRouter: [],
    returnLoop: null,
    tonightSprint: null,
    parentHandoff: null,
    quickDock: [],
    gameHero: null,
    missionCards: [],
    contentEntry: null,
    parentSnapshot: null,
    showInternalPanels: false,
    updatedText: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const state = storage.loadState();
    const plan = state.homework_plan || {};
    const mustDo = plan.must_do || [];
    const summary = plan.summary || {};
    const topMust = mustDo[0] || null;
    const evidence = (topMust && topMust.evidence) || {};
    const weakPoint = evidence.weak_point || null;
    const tags = (evidence.tags || []).slice(0, 3);
    const reviewSummary = reviewCards.reviewSummary();
    const thinkingSummary = storage.thinkingReceiptSummary ? storage.thinkingReceiptSummary() : null;
    const modulePath = learningModules.buildAdaptivePath(
      state,
      storage.moduleFeedbackMap ? storage.moduleFeedbackMap() : {},
      storage.loadModuleEvents ? storage.loadModuleEvents() : [],
      3,
      storage.loadReviewCards ? storage.loadReviewCards() : []
    );
    const todayActions = this.buildTodayActions(topMust, reviewSummary, modulePath);
    this.setData({
      state,
      weakPoints: (state.weak_points || []).slice(0, 2),
      topMust,
      isDemo: String(state.source || '').indexOf('demo') >= 0,
      stats: {
        must: mustDo.length,
        flexible: (plan.flexible || []).length,
        skip: (plan.can_skip || []).length
      },
      proofStats: [
        { label: 'Must-do time', value: `${summary.must_minutes || 0} min` },
        { label: 'Time saved', value: `${summary.saved_minutes || 0} min` },
        { label: 'Wrong-cause hits', value: `${summary.misconception_count || 0}` }
      ],
      topMustProof: topMust ? {
        weak: weakPoint ? `${weakPoint.name} ${weakPoint.score}` : 'Current weak point',
        tags,
        decision: evidence.decision || topMust.reason || 'Do this first because it has the highest learning value.',
        calibration: evidence.calibration_key || 'general:task'
      } : null,
      reviewSummary,
      loopSummary: reviewSummary.loop,
      syncSummary: reviewSummary.sync,
      todayActions,
      cockpit: {
        title: modulePath.current ? modulePath.current.title : 'Open study cockpit',
        reason: modulePath.reason || 'Pick one focused method and turn it into tutor plus review cards.',
        score: modulePath.current ? modulePath.current.score : 0,
        maturity: reviewSummary.maturity ? reviewSummary.maturity.overall : 0,
        benchmark: reviewSummary.benchmark ? reviewSummary.benchmark.average : 0
      },
      executiveBrief: this.buildExecutiveBrief(state, topMust, reviewSummary, thinkingSummary, modulePath),
      demoStory: this.buildDemoStory(reviewSummary),
      demoReplay: this.buildDemoReplay(state, topMust, reviewSummary, thinkingSummary, modulePath),
      investorTour: this.buildInvestorTour(state, topMust, reviewSummary, thinkingSummary, modulePath),
      pathRouter: this.buildPathRouter(),
      returnLoop: this.buildReturnLoop(reviewSummary),
      tonightSprint: this.buildTonightSprint(topMust, reviewSummary, modulePath),
      parentHandoff: this.buildParentHandoff(topMust, reviewSummary, state),
      quickDock: this.buildQuickDock(topMust, reviewSummary, modulePath),
      gameHero: this.buildGameHero(topMust, reviewSummary, modulePath),
      missionCards: this.buildMissionCards(topMust, reviewSummary, modulePath),
      contentEntry: this.buildContentEntry(modulePath, reviewSummary),
      parentSnapshot: this.buildParentSnapshot(state, topMust, reviewSummary, thinkingSummary),
      updatedText: state.updated_at ? state.updated_at.slice(5, 16).replace('T', ' ') : 'just now'
    });
  },

  buildGameHero(topMust, reviewSummary, modulePath) {
    const loop = reviewSummary.loop || {};
    const progress = reviewSummary.progress || {};
    const goal = reviewSummary.goal || {};
    const quiz = reviewSummary.quiz || {};
    const season = reviewSummary.season || {};
    const challenge = reviewSummary.challenge || {};
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const hasTask = !!topMust;
    const lives = Number(loop.lives || 5);
    const maxLives = Number(loop.maxLives || 5);
    return {
      title: hasTask ? '开始今日学习挑战' : '把学习材料变成挑战',
      subtitle: hasTask
        ? topMust.text
        : '粘贴作业、笔记或错题，生成知识卡、测验、复习计划和原小点提示。',
      primaryLabel: hasTask ? '开始挑战' : '生成学习包',
      primaryAction: hasTask ? 'startTopMust' : 'goTools',
      secondaryLabel: hasTask ? '先做 5 分钟复习' : '录入今晚作业',
      secondaryAction: hasTask ? 'goReview' : 'goUpload',
      streak: Number(loop.currentStreak || reviewSummary.streak || 0),
      lives,
      maxLives,
      hearts: Array.from({ length: maxLives }, (_, index) => ({
        id: `life_${index}`,
        alive: index < lives
      })),
      xp: Number(progress.xp || 0),
      level: Number(progress.level || 1),
      levelProgress: Number(progress.progress || 0),
      tier: season.tier || 'Bronze',
      due: Number(reviewSummary.due || 0),
      quiz: Number(quiz.count || 0),
      goalText: goal.completed >= goal.target
        ? '今日目标已完成'
        : `今日进度 ${goal.completed || 0}/${goal.target || 5}`,
      challengeText: challenge.title || (currentModule ? currentModule.title : '完成一轮：学习卡 -> 测验 -> 修复错因'),
      nextMeta: hasTask ? `${topMust.minutes || 10} 分钟` : '约 3 分钟生成'
    };
  },

  buildMissionCards(topMust, reviewSummary, modulePath) {
    const quiz = reviewSummary.quiz || {};
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    return [
      {
        id: 'challenge',
        label: '今日挑战',
        title: topMust ? '先攻克必须做任务' : '先生成一个学习包',
        body: topMust ? topMust.text : '粘贴材料后，系统会拆成卡片、测验和复习计划。',
        value: topMust ? `${topMust.minutes || 10}m` : 'NEW',
        action: topMust ? 'startTopMust' : 'goTools',
        tone: 'hot'
      },
      {
        id: 'review',
        label: '记忆训练',
        title: '5 分钟复习闯关',
        body: `${reviewSummary.due || 0} 张到期，${quiz.count || 0} 张测验卡。错了会自动进修复。`,
        value: `${reviewSummary.due || 0}`,
        action: 'goReview',
        tone: 'calm'
      },
      {
        id: 'pack',
        label: 'AI 学习包',
        title: currentModule ? currentModule.title : '把任意材料变成卡片',
        body: currentModule ? currentModule.scene : '支持作业、笔记、错题和课堂重点，先做本地预览。',
        value: currentModule ? currentModule.score : 'AI',
        action: 'goTools',
        tone: 'dark'
      }
    ];
  },

  buildContentEntry(modulePath, reviewSummary) {
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    return {
      title: 'AI 内容工厂',
      label: '粘贴任何学习材料，直接产出学习卡、闭卷测验、错因修复和 7 天复习计划。',
      cards: [
        { id: 'input', value: '1', label: '粘贴材料', body: '作业、笔记、PPT 要点、错题说明' },
        { id: 'pack', value: currentModule ? currentModule.score : 'AI', label: '生成学习包', body: currentModule ? currentModule.title : '知识卡 + 测验 + 原小点提示' },
        { id: 'loop', value: reviewSummary.maturity ? reviewSummary.maturity.overall : 0, label: '进入复习循环', body: '每天自动回访最该复习的内容' }
      ]
    };
  },

  buildParentSnapshot(state, topMust, reviewSummary, thinkingSummary) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const thinking = thinkingSummary || {};
    return {
      title: '家长只看结果和证据',
      body: topMust
        ? `今晚优先看：${topMust.text}`
        : '孩子先完成挑战，家长再看弱点、错因和复习证据。',
      metrics: [
        { label: '当前弱点', value: weak.name || '待诊断' },
        { label: '复习资产', value: reviewSummary.total || 0 },
        { label: '思考凭证', value: thinking.total || 0 }
      ]
    };
  },

  buildPathRouter() {
    return [
      {
        id: 'parent',
        role: 'Parent',
        promise: '10 seconds to know what matters tonight.',
        action: 'goRadar',
        label: 'See radar'
      },
      {
        id: 'kid',
        role: 'Child',
        promise: '3 minutes to start the first useful step.',
        action: 'startTopMust',
        label: 'Start tutor'
      },
      {
        id: 'investor',
        role: 'Investor',
        promise: 'One tap to see the whole moat story.',
        action: 'installDemoMode',
        label: 'Run demo'
      }
    ];
  },

  buildQuickDock(topMust, reviewSummary, modulePath) {
    return [
      {
        id: 'must',
        label: topMust ? 'Start must-do' : 'Enter homework',
        meta: topMust ? `${topMust.minutes || 10} min` : '3 min',
        action: topMust ? 'startTopMust' : 'goUpload'
      },
      {
        id: 'review',
        label: 'Review',
        meta: `${reviewSummary.due || 0} due`,
        action: 'goReview'
      },
      {
        id: 'tools',
        label: modulePath.current ? 'Open pack' : 'Open tools',
        meta: modulePath.current ? `${modulePath.current.score} fit` : 'factory',
        action: 'goTools'
      }
    ];
  },

  buildExecutiveBrief(state, topMust, reviewSummary, thinkingSummary, modulePath) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const thinking = thinkingSummary || {};
    const module = modulePath && modulePath.current ? modulePath.current : null;
    const proofAssets = Number(reviewSummary.total || 0) + Number(thinking.total || 0) + (topMust ? 1 : 0);
    return {
      title: 'PRODUCT RUNWAY',
      label: 'One screen for the real product thesis: reduce blind homework, protect thinking, and compound learning assets.',
      northStar: Math.min(100, 74 + Math.min(10, proofAssets) + Math.min(8, reviewSummary.due || 0) + Math.min(8, thinking.proofSentence || 0)),
      cards: [
        {
          id: 'tonight',
          label: 'Tonight decision',
          value: topMust ? 'locked' : 'needed',
          body: topMust ? topMust.text : 'Enter homework to split must-do, flexible and can-skip.'
        },
        {
          id: 'weak',
          label: 'Weak-point signal',
          value: weak.score || '--',
          body: weak.name || 'Run diagnosis or demo mode.'
        },
        {
          id: 'assets',
          label: 'Learning assets',
          value: proofAssets,
          body: `${reviewSummary.total || 0} memory cards + ${thinking.total || 0} thinking receipts.`
        },
        {
          id: 'next',
          label: 'Next engine',
          value: module ? module.score : 0,
          body: module ? module.title : 'Open tools to generate a study pack.'
        }
      ]
    };
  },

  buildReturnLoop(reviewSummary) {
    const due = reviewSummary.due || 0;
    const quiz = reviewSummary.quiz ? reviewSummary.quiz.count : 0;
    const repair = reviewSummary.qualityQueue ? reviewSummary.qualityQueue.length : 0;
    return {
      title: '7-DAY RETURN LOOP',
      label: 'A lightweight return path: review a few cards, repair one wrong cause, then keep the weekly season alive.',
      days: [
        { day: 'Day 1', task: 'Lock must-do and first wrong cause', value: 'tonight' },
        { day: 'Day 2', task: 'Recall yesterday without notes', value: `${due} due` },
        { day: 'Day 3', task: 'Run a closed-book quiz', value: `${quiz} quiz` },
        { day: 'Day 5', task: 'Repair one sticky card', value: `${repair} repair` },
        { day: 'Day 7', task: 'Parent check-in and next sprint', value: 'weekly' }
      ]
    };
  },

  buildDemoStory(reviewSummary) {
    return {
      title: 'INVESTOR DEMO MODE',
      label: 'One tap seeds a representative family and shows the full learning loop in action.',
      steps: [
        'Radar identifies the weak point.',
        'Homework triage marks the must-do task.',
        'Tutor asks for the first step instead of giving the answer.',
        'Review turns wrong causes into long-term memory assets.'
      ],
      scores: [
        { label: 'loop', value: 100 },
        { label: 'memory', value: reviewSummary.retentionLab ? 100 : 95 },
        { label: 'content', value: reviewSummary.contentPipeline ? 100 : 95 },
        { label: 'tutor', value: 96 }
      ]
    };
  },

  buildDemoReplay(state, topMust, reviewSummary, thinkingSummary, modulePath) {
    const weak = ((state && state.weak_points) || [])[0] || null;
    const thinking = thinkingSummary || {};
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const cards = [
      {
        id: 'diagnosis',
        title: 'Diagnosis',
        value: weak ? `${weak.score}` : '--',
        body: weak ? `${weak.name}: ${weak.reason}` : 'Run a diagnosis or use demo mode.'
      },
      {
        id: 'homework',
        title: 'Homework decision',
        value: topMust ? `${topMust.minutes || 10}m` : '--',
        body: topMust ? topMust.text : 'No must-do item yet.'
      },
      {
        id: 'tutor',
        title: 'Tutor proof',
        value: thinking.total ? `${thinking.avgScore}` : '0',
        body: thinking.total ? `${thinking.total} thinking receipts, ${thinking.proofSentence || 0} proof lines.` : 'Tutor receipts appear after a coaching turn.'
      },
      {
        id: 'memory',
        title: 'Review assets',
        value: reviewSummary.total || 0,
        body: `${reviewSummary.due || 0} due, ${reviewSummary.mastered || 0} mastered, ${reviewSummary.leeches || 0} sticky.`
      },
      {
        id: 'method',
        title: 'Next method',
        value: currentModule ? currentModule.score : 0,
        body: currentModule ? currentModule.title : 'Open study cockpit for the next module.'
      }
    ];
    return {
      title: 'DEMO REPLAY',
      label: 'A full investor/parent walkthrough: diagnose, triage, coach, prove thinking, and turn the mistake into memory.',
      cards,
      shareLine: `Demo replay: ${weak ? weak.name : 'weak point'} -> ${topMust ? 'must-do locked' : 'homework needed'} -> ${thinking.total || 0} thinking receipts -> ${reviewSummary.total || 0} review assets.`,
      actions: [
        { id: 'install', label: 'Reset demo', action: 'installDemoMode' },
        { id: 'radar', label: 'Open radar', action: 'goRadar' },
        { id: 'tutor', label: 'Open tutor', action: 'startTopMust' },
        { id: 'report', label: 'Parent report', action: 'goProfile' }
      ]
    };
  },

  buildInvestorTour(state, topMust, reviewSummary, thinkingSummary, modulePath) {
    const weak = ((state && state.weak_points) || [])[0] || null;
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const thinking = thinkingSummary || {};
    const memoryAssets = Number(reviewSummary.total || 0);
    const proofAssets = memoryAssets + Number(thinking.total || 0) + (topMust ? 1 : 0);
    return {
      title: '5-MIN INVESTOR TOUR',
      label: 'A tight demo script: China family anxiety -> homework decision -> safe tutor -> memory engine -> parent proof -> data moat.',
      proofAssets,
      moatScore: Math.min(100, 72 + Math.min(12, memoryAssets) + Math.min(8, thinking.total || 0) + (topMust ? 8 : 0)),
      steps: [
        {
          id: 'pain',
          minute: '0:00',
          title: 'Pain: too much homework, too little signal',
          body: weak ? `Start with ${weak.name}: parents see why tonight cannot be solved by blind extra practice.` : 'Seed demo mode to show a realistic weak-point case.',
          action: 'installDemoMode',
          cta: 'Seed demo'
        },
        {
          id: 'loop',
          minute: '1:00',
          title: 'Loop: radar decides what matters tonight',
          body: topMust ? `The system chooses one must-do task: ${topMust.text}` : 'Homework triage splits must-do, flexible and can-skip work.',
          action: 'goRadar',
          cta: 'Open radar'
        },
        {
          id: 'tutor',
          minute: '2:00',
          title: 'Tutor: protect thinking before explanation',
          body: 'Yuan Xiao Dian asks for the first step and wrong cause, then leaves a thinking receipt.',
          action: 'startTopMust',
          cta: 'Open tutor'
        },
        {
          id: 'engine',
          minute: '3:00',
          title: 'Engine: any material becomes cards, quiz and repair',
          body: currentModule ? `${currentModule.title} can launch tutor mode and become review assets.` : 'Content Factory Studio turns notes into a usable learning pack.',
          action: 'goTools',
          cta: 'Open tools'
        },
        {
          id: 'business',
          minute: '4:00',
          title: 'Business: parent report and paid learning packs',
          body: 'The weekly proof report is the wedge for trials, monthly packs, diagnosis and teacher/agency versions.',
          action: 'goProfile',
          cta: 'Parent report'
        }
      ],
      metrics: [
        { label: 'proof assets', value: proofAssets },
        { label: 'review cards', value: memoryAssets },
        { label: 'thinking receipts', value: thinking.total || 0 },
        { label: 'moat design', value: `${Math.min(100, 72 + Math.min(12, memoryAssets) + Math.min(8, thinking.total || 0) + (topMust ? 8 : 0))}` }
      ]
    };
  },

  buildTonightSprint(topMust, reviewSummary, modulePath) {
    const currentModule = modulePath.current || null;
    return {
      title: 'TONIGHT SPRINT',
      label: 'A family can finish one useful cycle in about 15 minutes: pick the right task, coach the first move, then lock the mistake into memory.',
      steps: [
        {
          id: 'task',
          kicker: '1 / Priority',
          title: topMust ? 'Start the one task that matters tonight' : 'Enter homework and let the system choose',
          desc: topMust
            ? topMust.text
            : 'Paste tonight homework first so the system can split must-do, flexible and can-skip work.',
          proof: topMust ? `${topMust.minutes || 10} min / must-do` : '3 min setup',
          action: topMust ? 'startTopMust' : 'goUpload',
          cta: topMust ? 'Start tutor' : 'Enter homework'
        },
        {
          id: 'coach',
          kicker: '2 / Coaching',
          title: currentModule ? currentModule.title : 'Use tutor for the first useful step',
          desc: currentModule
            ? currentModule.scene
            : 'Yuan Xiao Dian asks for the first step and the wrong cause instead of writing the answer.',
          proof: currentModule ? `${currentModule.minutes} min module` : '3-5 min',
          action: currentModule ? 'goTools' : 'goTutor',
          cta: currentModule ? 'Open cockpit' : 'Open tutor'
        },
        {
          id: 'memory',
          kicker: '3 / Memory',
          title: 'Close the loop with review and quiz',
          desc: `Turn tonight's wrong cause into spaced review, quiz and repair instead of hoping it sticks.`,
          proof: `${reviewSummary.due || 0} due / ${reviewSummary.quiz ? reviewSummary.quiz.count : 0} quiz`,
          action: 'goReview',
          cta: 'Start review'
        }
      ]
    };
  },

  buildParentHandoff(topMust, reviewSummary, state) {
    const weakPoint = ((state && state.weak_points) || [])[0] || null;
    const firstTag = (((topMust || {}).evidence || {}).misconception_tags || [])[0] || null;
    return {
      title: 'PARENT HANDOFF',
      label: 'This is the exact parent-facing story for tonight: what to watch, what not to do, and what counts as evidence.',
      cards: [
        {
          id: 'watch',
          title: 'Watch for one thing',
          body: weakPoint
            ? `${weakPoint.name}: do they know the first move without prompting?`
            : 'Watch whether the child can start independently before you explain.',
          tone: 'focus'
        },
        {
          id: 'avoid',
          title: 'Do not over-help',
          body: 'Do not replace the child’s thinking. Ask for the next step, not the final answer.',
          tone: 'guardrail'
        },
        {
          id: 'evidence',
          title: 'Collect one proof sentence',
          body: firstTag
            ? `Ask the child to explain how they avoided "${firstTag.name}".`
            : 'Ask the child to say one corrected idea out loud, then send it into review.',
          tone: 'evidence'
        }
      ]
    };
  },

  buildTodayActions(topMust, reviewSummary, modulePath) {
    const actions = [];
    if (topMust) {
      actions.push({
        id: 'must',
        title: 'Do the must-do task',
        desc: topMust.text,
        meta: `${topMust.minutes || 10} min`,
        action: 'startTopMust',
        primary: true
      });
    } else {
      actions.push({
        id: 'upload',
        title: 'Enter tonight homework',
        desc: 'Paste the list and get must-do, flexible and can-skip buckets.',
        meta: '3 min',
        action: 'goUpload',
        primary: true
      });
    }
    actions.push({
      id: 'review',
      title: 'Run review or quiz',
      desc: `${reviewSummary.due || 0} due, ${reviewSummary.quiz ? reviewSummary.quiz.count : 0} quiz cards`,
      meta: '5 min',
      action: 'goReview'
    });
    actions.push({
      id: 'cockpit',
      title: 'Open learning cockpit',
      desc: modulePath.current ? modulePath.current.title : 'Pick an AI learning method',
      meta: '10-20 min',
      action: 'goTools'
    });
    return actions;
  },

  runTodayAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action && typeof this[action] === 'function') this[action]();
  },

  runPath(event) {
    const action = event.currentTarget.dataset.action;
    if (action && typeof this[action] === 'function') this[action]();
  },

  toggleInternalPanels() {
    this.setData({ showInternalPanels: !this.data.showInternalPanels });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  goDiagnosis() {
    wx.navigateTo({ url: '/pages/diagnosis/diagnosis' });
  },

  goReviewSample() {
    wx.navigateTo({ url: '/pages/upload/upload?sample=review' });
  },

  installDemoMode() {
    storage.installInvestorDemo();
    const state = storage.loadState();
    const pack = learningModules.contentFactoryPacks(state, reviewCards.reviewSummary())[0];
    if (pack) {
      reviewCards.importTextToDeck(pack.text, pack.options);
    }
    this.refresh();
    wx.showToast({ title: 'Demo ready', icon: 'success' });
  },

  goTutor() {
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  goTools() {
    wx.switchTab({ url: '/pages/tools/tools' });
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' });
  },

  startTopMust() {
    if (this.data.topMust) {
      storage.set(storage.KEYS.selectedHomework, this.data.topMust);
      storage.set(storage.KEYS.selectedHomeworkSource, 'home_top_must');
    }
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  goRadar() {
    wx.switchTab({ url: '/pages/radar/radar' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
