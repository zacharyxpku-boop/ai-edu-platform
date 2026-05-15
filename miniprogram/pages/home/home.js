const storage = require('../../utils/storage');
const reviewCards = require('../../utils/review-cards');
const learningModules = require('../../utils/learning-modules');
const arcadeEngine = require('../../utils/arcade-engine');
const api = require('../../utils/api');
const tutorLadder = require('../../utils/tutor-ladder');
const importIntake = require('../../utils/import-intake');
const { buildHomeViewModel } = require('../../view-models/home-view-model');

Page({
  data: {
    state: null,
    weakPoints: [],
    topMust: null,
    stats: { must: 0, flexible: 0, skip: 0 },
    proofStats: [
      { label: '必须做时间', value: '0 分钟' },
      { label: '预计少做', value: '0 分钟' },
      { label: '卡点命中', value: '0' }
    ],
    topMustProof: null,
    reviewSummary: null,
    loopSummary: null,
    syncSummary: null,
    todayActions: [],
    cockpit: null,
    executiveBrief: null,
    pathRouter: [],
    returnLoop: null,
    tonightSprint: null,
    parentHandoff: null,
    quickDock: [],
    gameHero: {
      title: '今晚从哪一步开始？',
      subtitle: '学校作业多，先排顺序；卡住时，先说第一步。',
      primaryLabel: '帮我安排今晚学习',
      primaryAction: 'planTonight',
      secondaryLabel: '生成轻练习',
      secondaryAction: 'goTools',
      nextGate: '下一关：先生成学习卡'
    },
    missionCards: [],
    contentEntry: null,
    parentSnapshot: null,
    weaknessVerdict: null,
    arcadeEntry: {
      body: '没有材料时先生成第一关，有真实卡片后再进入游戏。',
      cta: '去轻回访',
      action: 'goTools'
    },
    wrongbookEntry: {
      body: '把题目、原想法和卡住的一步放进来，整理成可回访的小卡。',
      label: '放一题',
      action: 'goReviewInput'
    },
    firstRunGuide: null,
    dashboardHeader: null,
    aiDraft: '',
    packTab: 'text',
    promptChips: [],
    categoryFilters: [],
    activeToolCategory: 'featured',
    toolCards: [],
    visibleToolCards: [],
    progressStrip: null,
    parentSupportCards: [],
    suggestedNextStep: null,
    learningStages: [],
    focusFeedback: '',
    todayFocus: null,
    tonightPlan: null,
    routeStrip: null,
    routeDisplayText: '今晚路线 · 第 1 步：排顺序',
    companionPreference: { selectedCompanion: 'gudian', selectedLabel: '咕点' },
    companionCopy: { home: '咕点陪你先找今晚第一步。' },
    companionLine: '咕点：我懂你卡住了，我陪你先迈出第一步。',
    growthMemory: { home: '' },
    companionOptions: [],
    homeViewModel: buildHomeViewModel(),
    showCompanionPicker: false,
    showWeakVerdict: false,
    planSummaryText: '',
    incomingShare: null,
    updatedText: '',
    legacyStuckAnchor: { title: '卡住了，先说想法' },
    showFirstRunOverlay: false,
    showLightTools: false,
    yesterdayReviewCard: null,
    focusEntryReady: false,
    learningLoopCards: [
      {
        id: 'socratic',
        title: '今晚作业没思路',
        body: '先不急着给答案，咕点陪你问三步。',
        action: 'goTutor',
        cta: '找咕点追问'
      },
      {
        id: 'focus',
        title: '坐不住，想分心',
        body: '只围绕一个小目标，安静坐一段。静音模式可用。',
        action: 'goFocus',
        cta: '进专注舱'
      },
      {
        id: 'repair',
        title: '之前错题又卡了',
        body: '昨天那一步，今天轻轻接一下。',
        action: 'goReview',
        cta: '修卡点'
      },
      {
        id: 'practice',
        title: '想练一小会',
        body: '用 3 分钟，把第一步练熟。',
        action: 'goArcade',
        cta: '玩一小局'
      }
    ],
    parentClassroom: [
      { title: '为什么不要直接给答案', body: '先问第一步，孩子才会开始整理自己的思路。' },
      { title: '每晚只问这一句', body: '刚才你第一步先看了什么？这句足够轻。' },
      { title: '卡住时先稳住', body: '先坐下来一小段，比立刻讲完整过程更重要。' }
    ]
  },

  onLoad(query = {}) {
    if (storage.isFirstTime && storage.isFirstTime()) {
      this.setData({ showFirstRunOverlay: true });
      setTimeout(() => {
        this.setData({ showFirstRunOverlay: false });
      }, 3000);
    }
    if (query && query.share) {
      const incoming = storage.saveIncomingShare ? storage.saveIncomingShare({
        code: query.share,
        from: query.from || '',
        challenge: query.challenge || '',
        mode: query.mode || '',
        identity_tag: query.identity || ''
      }) : {
        code: query.share,
        share_code: query.share,
        challenge: query.challenge || '',
        from: query.from || '',
        mode: query.mode || '',
        identity_tag: query.identity || ''
      };
      if (storage.appendShareRun) {
        storage.appendShareRun({
          share_code: query.share,
          type: 'share_clicked',
          path: '/pages/home/home',
          title: 'incoming_share',
          payload: {
            share_code: query.share,
            from: query.from || '',
            challenge: query.challenge || '',
            mode: query.mode || '',
            identity_tag: query.identity || ''
          }
        });
      }
      api.submitEvent({
        event: 'share_clicked',
        source: query.from || 'share',
        entity_id: query.share,
        page: 'home',
        payload: {
          code: query.share,
          share_code: query.share,
          challenge: query.challenge || '',
          mode: query.mode || '',
          identity_tag: query.identity || ''
        }
      }).catch(() => {});
      this.setData({
        incomingShare: incoming
      });
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    setTimeout(() => {
      this.refresh();
    }, 0);
  },

  closeFirstRunOverlay() {
    storage.markFirstRunGuideSeen && storage.markFirstRunGuideSeen();
    this.setData({ showFirstRunOverlay: false });
  },

  toggleLightTools() {
    this.setData({ showLightTools: !this.data.showLightTools });
  },

  contactSupport() {
    wx.showModal({
      title: '反馈建议',
      editable: true,
      placeholderText: '哪里卡住了？写一句就行。',
      success: (res) => {
        if (res.confirm && storage.saveLocalFeedback) {
          storage.saveLocalFeedback({
            page: 'home',
            text: res.content || '',
            source: 'friend_safe_shell'
          });
          wx.showToast({ title: '已记录反馈', icon: 'none' });
        }
      }
    });
  },

  copySupportWechat() {
    if (wx.setClipboardData) {
      wx.setClipboardData({ data: 'yuandian-support' });
    } else {
      wx.showToast({ title: '请联系 yuandian-support', icon: 'none' });
    }
  },

  onShareAppMessage() {
    const profile = storage.loadProfile ? storage.loadProfile() : {};
    const name = profile.name || '我家孩子';
    return {
      title: `${name} 今晚确认了第一步`,
      path: `/pages/home/home?ref=${storage.getLocalUserId ? storage.getLocalUserId() : ''}`
    };
  },

  refresh() {
    const loadedState = storage.loadState();
    const state = loadedState;
    const plan = state.homework_plan || {};
    const mustDo = plan.must_do || [];
    const summary = plan.summary || {};
    const topMust = mustDo[0] || null;
    const evidence = (topMust && topMust.evidence) || {};
    const weakPoint = evidence.weak_point || null;
    const tags = (evidence.tags || []).slice(0, 3);
    const reviewSummary = reviewCards.reviewSummary();
    const thinkingSummary = storage.thinkingReceiptSummary ? storage.thinkingReceiptSummary() : null;
    const tonightPlan = storage.loadTonightPlan ? storage.loadTonightPlan() : null;
    const todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
    const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
    const focusEntryReady = storage.canStartFocusFromTodaySession
      ? storage.canStartFocusFromTodaySession(todaySession)
      : !!(todaySession && todaySession.childArticulatedStep);
    const yesterdayReviewCard = storage.getYesterdayReview ? storage.getYesterdayReview() : null;
    const companionPreference = storage.loadCompanionPreference ? storage.loadCompanionPreference() : null;
    const growthMemoryLine = storage.getGrowthMemoryLine ? storage.getGrowthMemoryLine(null, companionPreference) : null;
    const modulePath = learningModules.buildAdaptivePath(
      state,
      storage.moduleFeedbackMap ? storage.moduleFeedbackMap() : {},
      storage.loadModuleEvents ? storage.loadModuleEvents() : [],
      3,
      storage.loadReviewCards ? storage.loadReviewCards() : []
    );
    const todayActions = this.buildTodayActions(topMust, reviewSummary, modulePath);
    const incomingShare = (storage.loadIncomingShare && storage.loadIncomingShare()) || this.data.incomingShare || null;
    this.setData({
      state,
      weakPoints: (state.weak_points || []).slice(0, 2),
      topMust,
      stats: {
        must: mustDo.length,
        flexible: (plan.flexible || []).length,
        skip: (plan.can_skip || []).length
      },
      proofStats: [
        { label: '必须做时间', value: `${summary.must_minutes || 0} 分钟` },
        { label: '预计少做', value: `${summary.saved_minutes || 0} 分钟` },
        { label: '卡点命中', value: `${summary.misconception_count || 0}` }
      ],
      topMustProof: topMust ? {
        weak: weakPoint ? `${weakPoint.name} ${weakPoint.score}` : '当前卡点',
        tags,
        decision: evidence.decision || topMust.reason || '先做它，因为它对今晚最有学习价值。',
        calibration: evidence.calibration_key || 'general:task'
      } : null,
      reviewSummary,
      loopSummary: reviewSummary.loop,
      syncSummary: reviewSummary.sync,
      todayActions,
      cockpit: {
        title: modulePath.current ? modulePath.current.title : '打开轻练习',
        reason: modulePath.reason || '选一个最聚焦的方法，把它变成点拨提示和复习卡。',
        score: modulePath.current ? modulePath.current.score : 0,
        maturity: reviewSummary.maturity ? reviewSummary.maturity.overall : 0,
        readiness: reviewSummary.commercialReadiness ? reviewSummary.commercialReadiness.average : 0
      },
      executiveBrief: this.buildExecutiveBrief(state, topMust, reviewSummary, thinkingSummary, modulePath),
      pathRouter: this.buildPathRouter(),
      returnLoop: this.buildReturnLoop(reviewSummary),
      tonightSprint: this.buildTonightSprint(topMust, reviewSummary, modulePath),
      parentHandoff: this.buildParentHandoff(topMust, reviewSummary, state),
      quickDock: this.buildQuickDock(topMust, reviewSummary, modulePath),
      incomingShare,
      todaySession,
      focusEntryReady,
      yesterdayReviewCard: yesterdayReviewCard ? Object.assign({}, yesterdayReviewCard, {
        noticeText: yesterdayReviewCard.focusCompletionType === 'interrupted'
          ? `昨晚我们停在“${yesterdayReviewCard.childArticulatedStep || '第一步'}”这一步，今天轻轻接一下？`
          : '昨晚这一步你已经坐过一段，今晚有新卡住的题吗？'
      }) : null,
      gameHero: this.buildGameHero(topMust, reviewSummary, modulePath),
      missionCards: this.buildMissionCards(topMust, reviewSummary, modulePath),
      contentEntry: this.buildContentEntry(modulePath, reviewSummary),
      parentSnapshot: this.buildParentSnapshot(state, topMust, reviewSummary, thinkingSummary),
      weaknessVerdict: this.buildWeaknessVerdict(state, topMust, reviewSummary, thinkingSummary, modulePath),
      arcadeEntry: this.buildArcadeEntry(reviewSummary),
      wrongbookEntry: this.buildWrongbookEntry(reviewSummary),
      firstRunGuide: this.buildFirstRunGuide(topMust, reviewSummary, state),
      dashboardHeader: this.buildDashboardHeader(topMust, reviewSummary, modulePath, state),
      promptChips: this.buildPromptChips(),
      categoryFilters: this.buildCategoryFilters(),
      toolCards: this.buildToolCards(topMust, reviewSummary, modulePath, state),
      visibleToolCards: this.filterToolCards(this.buildToolCards(topMust, reviewSummary, modulePath, state), 'featured'),
      progressStrip: this.buildProgressStrip(topMust, reviewSummary, modulePath),
      parentSupportCards: this.buildParentSupportCards(topMust, reviewSummary, state),
      suggestedNextStep: this.buildSuggestedNextStep(topMust, reviewSummary),
      learningStages: this.buildLearningStages(reviewSummary, topMust),
      todayFocus,
      tonightPlan,
      routeStrip: this.buildRouteStrip('plan', tonightPlan),
      routeDisplayText: '今晚路线 · 第 1 步：排顺序',
      companionPreference,
      companionCopy: {
        home: storage.getCompanionStageCopy ? storage.getCompanionStageCopy('home_plan', companionPreference) : '咕点陪你先找今晚第一步。'
      },
      companionLine: storage.formatCompanionLine ? storage.formatCompanionLine(companionPreference) : '咕点：我懂你卡住了，我陪你先迈出第一步。',
      homeViewModel: buildHomeViewModel({
        companionPreference,
        tonightPlan,
        todayFocus,
        growthMemory: growthMemoryLine
      }),
      growthMemory: {
        home: growthMemoryLine && !growthMemoryLine.empty
          ? growthMemoryLine.oneLine
          : (storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('home', companionPreference) : '')
      },
      companionOptions: storage.COMPANION_OPTIONS || [],
      showWeakVerdict: !!(tonightPlan || todayFocus || this.data.focusFeedback),
      planSummaryText: tonightPlan && tonightPlan.summaryLine
        ? tonightPlan.summaryLine
        : (growthMemoryLine && !growthMemoryLine.empty
          ? growthMemoryLine.oneLine
          : (storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('home', companionPreference) : '')),
      updatedText: state.updated_at ? state.updated_at.slice(5, 16).replace('T', ' ') : '刚刚'
    });
  },

  buildRouteStrip(active, tonightPlan) {
    const plan = tonightPlan || {};
    return {
      text: plan.summaryLine || '今晚路线：排顺序 → 说第一步 → 修卡点 → 轻回访 → 家长看',
      shortText: '今晚路线 · 第 1 步：排顺序',
      steps: (plan.routeSteps || [
        { id: 'plan', label: '排顺序' },
        { id: 'first_step', label: '说第一步' },
        { id: 'repair', label: '修卡点' },
        { id: 'review', label: '轻回访' },
        { id: 'parent', label: '家长看' }
      ]).map((step) => Object.assign({}, step, { active: step.id === active || step.active && step.id === active }))
    };
  },

  buildDashboardHeader(topMust, reviewSummary, modulePath, state) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    const quiz = Number((reviewSummary && reviewSummary.quiz && reviewSummary.quiz.count) || 0);
    return {
      brand: '原点智学',
      subtitle: '作业点拨',
      status: topMust ? '已找到下一步' : '等待学习上下文',
      weak: weak.name || '先找到卡点',
      pack: currentModule ? currentModule.title : '可生成轻练习',
      review: `${due} 张复习 · ${quiz} 道小测`,
      actions: [
        { id: 'arcade', label: '轻回访', action: 'goTools' },
        { id: 'profile', label: '我的', action: 'goProfile' }
      ]
    };
  },

  buildPromptChips() {
    const keep = ['read_question', 'write_equation', 'review_this'];
    return importIntake.IMPORT_CHIPS
      .filter((item) => keep.includes(item.id))
      .slice(0, 3)
      .map((item, index) => Object.assign({}, item, { warmClass: index === 1 ? 'warm' : '' }));
  },

  buildWeaknessVerdict(state, topMust, reviewSummary, thinkingSummary, modulePath) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const evidence = (topMust && topMust.evidence) || {};
    const tag = ((evidence.misconception_tags || [])[0]) || {};
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    const thinking = thinkingSummary || {};
    const module = modulePath && modulePath.current ? modulePath.current : null;
    const name = weak.name || tag.name || tag.label || '先说第一步';
    const why = topMust
      ? (evidence.decision || topMust.reason || '它最可能影响今晚作业是否做得下去。')
      : due
        ? `有 ${due} 张内容该回忆，先看有没有真的记住。`
        : '还没有足够记录，先用一道真实题开始判断。';
    const tonight = topMust
      ? `先做「${topMust.text}」，只做第一步和卡住点。`
      : module
        ? `先把材料做成「${module.title}」。`
        : '先发题目和你想到的一步，点拨会继续追问。';
    const helper = topMust
      ? '先用作业点拨拆下一步，做错了再去修卡点。'
      : due
        ? '先去复习；错了再回作业点拨拆卡点。'
        : '先问一个小问题，不急着讲最终结果。';
    const confidence = Math.min(96, 48
      + (weak.score ? Math.round(Number(weak.score || 0) / 5) : 0)
      + Math.min(16, due * 3)
      + Math.min(12, Number(thinking.total || 0) * 3)
      + (topMust ? 12 : 0));
    return {
      title: '今晚先修这一处',
      name,
      why,
      tonight,
      helper,
      confidence,
      primaryLabel: topMust ? '去作业点拨' : due ? '先复习一轮' : '先发一道题',
      primaryAction: topMust ? 'startTopMust' : due ? 'goReview' : 'goTutor',
      secondaryLabel: '去修卡点',
      secondaryAction: 'goReview'
    };
  },

  buildLearningStages(reviewSummary, topMust) {
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    const repair = Number((reviewSummary && reviewSummary.qualityQueue && reviewSummary.qualityQueue.length) || 0);
    return [
      {
        id: 'preview',
        label: '预习',
        title: '先猜主线，再看要点',
        body: '把课本标题或课堂要点发来，先说你觉得会讲什么，再生成一组轻练习。',
        action: 'goTools',
        meta: '先想'
      },
      {
        id: 'learn',
        label: '学习',
        title: '先讲思路，再给提示',
        body: topMust ? topMust.text : '题目、作业、知识点都可以问；先说你想到哪一步，再一起往下走。',
        action: topMust ? 'startTopMust' : 'goTutor',
        meta: '只提示'
      },
      {
        id: 'review',
        label: '复习',
        title: due ? `${due} 张今天该回忆` : '没有到期卡也能保持手感',
        body: '先主动回忆，再看提示；会进入回访记录、连续天和间隔复习。',
        action: 'goReview',
        meta: '5 分钟'
      },
      {
        id: 'wrong',
        label: '错题',
        title: repair ? `${repair} 张需要修卡点` : '把错题变成复习线索',
        body: '写下题目、原想法和卡住的一步，整理成卡点卡和变式卡。',
        action: 'goReviewInput',
        meta: '闭环'
      }
    ];
  },

  buildCategoryFilters() {
    return [
      { id: 'featured', label: '常用' },
      { id: 'generate', label: '轻练习' },
      { id: 'review', label: '复习' },
      { id: 'profile', label: '我的' },
      { id: 'all', label: '全部' }
    ];
  },

  buildToolCards(topMust, reviewSummary, modulePath, state) {
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const weak = ((state && state.weak_points) || [])[0] || {};
    const due = Number((reviewSummary && reviewSummary.due) || 0);
    return [
      {
        id: 'pack',
        category: 'generate',
        tone: 'sky',
        title: '生成轻练习',
        desc: currentModule ? currentModule.title : '把作业、笔记或材料变成卡片、小测和回访提示。',
        status: currentModule ? `已推荐 ${currentModule.score}` : '材料入口',
        cta: '打开',
        action: 'goTools',
        featured: true
      },
      {
        id: 'review',
        category: 'review',
        tone: 'violet',
        title: '5 分钟轻回访',
        desc: `今天 ${due} 张到期，先回忆再核对思路。`,
        status: '5 分钟一关',
        cta: '开始',
        action: 'goReview',
        featured: true
      },
      {
        id: 'tutor',
        category: 'today',
        tone: 'mint',
        title: '作业点拨',
        desc: '不会直接代写结果，只陪你说清题目和第一步。',
        status: '思路引导',
        cta: '提问',
        action: 'goTutor',
        featured: false
      },
      {
        id: 'upload',
        category: 'generate',
        tone: 'cream',
        title: '今晚作业',
        desc: '题型、数量、卡住哪里，写三行也能开始。',
        status: '手动录入',
        cta: '录入作业',
        action: 'goUpload',
        featured: false
      },
      {
        id: 'radar',
        category: 'profile',
        tone: 'deep',
        title: '我的学习档案',
        desc: weak.name ? `当前先看 ${weak.name}。` : '只看今晚优先做什么。',
        status: weak.score ? `卡点 ${weak.score}` : '成长记录',
        cta: '查看',
        action: 'goProfile',
        featured: true
      },
      {
        id: 'report',
        category: 'profile',
        tone: 'paper',
        title: '本周进展',
        desc: '看回访、小卡和今天修过的卡点。',
        status: `${reviewSummary.total || 0} 张复习卡`,
        cta: '查看',
        action: 'goProfile',
        featured: false
      }
    ];
  },

  filterToolCards(cards, category) {
    if (category === 'all') return cards;
    if (category === 'featured') return (cards || []).filter((item) => item.featured);
    return (cards || []).filter((item) => item.category === category);
  },

  buildProgressStrip(topMust, reviewSummary, modulePath) {
    const goal = reviewSummary.goal || {};
    const progress = Number((reviewSummary.progress && reviewSummary.progress.progress) || 0);
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    return {
      percent: Math.max(8, Math.min(100, progress || (topMust ? 42 : 18))),
      label: topMust ? '建议先做这个' : '等待你的作业清单',
      time: topMust ? `${topMust.minutes || 10} 分钟` : '约 3 分钟规划',
      lives: goal.completed >= goal.target ? '已完成' : '今晚',
      pack: currentModule ? '可生成轻练习' : '先做作业点拨'
    };
  },

  buildSuggestedNextStep(topMust, reviewSummary) {
    if (topMust) {
      return {
        title: '建议先做这个',
        body: topMust.text || '先完成今晚最关键的一小步。',
        meta: `${topMust.minutes || 10} 分钟`,
        primaryLabel: '开始这一小步',
        primaryAction: 'startTopMust',
        secondaryLabel: '换一个建议',
        secondaryAction: 'goRadar'
      };
    }
    return {
      title: '建议先做这个',
      body: '先把任务拆成 3 步，再从最容易开始的一步做起。',
      meta: `${reviewSummary.due || 0} 张复习待回访`,
      primaryLabel: '开始这一小步',
      primaryAction: 'submitAiDraft',
      secondaryLabel: '换一个建议',
      secondaryAction: 'goUpload'
    };
  },

  buildParentSupportCards(topMust, reviewSummary, state) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    return [
      {
        id: 'decision',
        title: '看今晚优先做什么',
        body: topMust ? `先看：${topMust.text}` : '先生成作业三分类，再看为什么先做它。',
        cta: '看我的决策',
        action: 'goRadar'
      },
      {
        id: 'weekly',
        title: '看本周一句话进展',
        body: weak.name ? `本周重点：${weak.name}。复习记录 ${reviewSummary.total || 0} 张。` : '用复习和卡点记录生成自己的进展。',
        cta: '看我的进展',
        action: 'goProfile'
      }
    ];
  },

  buildFirstRunGuide(topMust, reviewSummary, state) {
    const hasRealHomework = !!(state && state.homework_text);
    const totalCards = Number((reviewSummary && reviewSummary.total) || 0);
    return {
      title: hasRealHomework ? '今晚按这个顺序走' : '第一次打开，先做这 3 步',
      label: hasRealHomework
        ? '先做最高价值任务，再把卡点沉淀成复习卡。'
        : '直接填今晚作业，我会分出必交先做、灵活安排、可以后置。',
      steps: [
        {
          id: 'upload',
          value: '1',
          title: '填作业',
          body: hasRealHomework ? '已拿到今晚作业。' : '粘贴题号、数量和孩子卡住的位置。',
          action: 'goUpload',
          cta: hasRealHomework ? '更新作业' : '开始填写'
        },
        {
          id: 'tutor',
          value: '2',
          title: '只辅导必须做',
          body: topMust ? topMust.text : '我会挑出最值得今晚先做的任务。',
          action: topMust ? 'startTopMust' : 'goUpload',
          cta: topMust ? '去点拨' : '先分类'
        },
        {
          id: 'review',
          value: '3',
          title: '卡点进复习',
          body: totalCards ? `${totalCards} 张复习卡已在长期队列。` : '做完后生成复习卡，明天自动回访。',
          action: 'goReview',
          cta: '看复习'
        }
      ]
    };
  },

  buildArcadeEntry(reviewSummary) {
    const cards = reviewCards.sessionCards('smart', 8);
    const fallback = cards.length ? cards : reviewCards.cardBrowser({ status: 'all', limit: 8 });
    return arcadeEngine.buildHomeArcadeEntry(reviewSummary || {}, fallback);
  },

  buildWrongbookEntry(reviewSummary) {
    const types = (reviewSummary && reviewSummary.types) || [];
    const typeCount = (type) => {
      const item = types.find((entry) => entry.type === type);
      return Number((item && item.total) || 0);
    };
    const total = Number((reviewSummary && reviewSummary.total) || 0);
    const repair = Number((reviewSummary && reviewSummary.qualityQueue && reviewSummary.qualityQueue.length) || 0);
    const transfer = typeCount('transfer');
    return {
      title: '错题本整理',
      body: total
        ? `复习卡 ${total} 张，待修卡点 ${repair} 张，举一反三 ${transfer} 张。`
        : '把题目、原想法和卡住的一步放进来，先追问一步，再安排回访。',
      label: total ? '修卡点' : '放一题',
      action: total ? 'goReview' : 'goReviewInput'
    };
  },

  buildGameHero(topMust, reviewSummary, modulePath) {
    const goal = reviewSummary.goal || {};
    const quiz = reviewSummary.quiz || {};
    const challenge = reviewSummary.challenge || {};
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    const hasTask = !!topMust;
    return {
      title: '今晚从哪一步开始？',
      subtitle: '学校作业很多时，先排顺序；遇到卡点时，我陪你先说出第一步。',
      primaryLabel: '帮我安排今晚学习',
      primaryAction: 'planTonight',
      secondaryLabel: '生成轻练习',
      secondaryAction: 'goTools',
      taskStatus: hasTask ? '今晚任务' : '材料入口',
      packStatus: currentModule ? '可练' : (reviewSummary.total ? '已沉淀' : '待生成'),
      due: Number(reviewSummary.due || 0),
      quiz: Number(quiz.count || 0),
      xp: Number((reviewSummary.progress && reviewSummary.progress.xp) || 0),
      level: Number((reviewSummary.progress && reviewSummary.progress.level) || 1),
      streak: Number((reviewSummary.loop && reviewSummary.loop.currentStreak) || (reviewSummary.progress && reviewSummary.progress.streak) || 0),
      lives: Number((reviewSummary.loop && reviewSummary.loop.lives) || 0),
      maxLives: Number((reviewSummary.loop && reviewSummary.loop.maxLives) || 5),
      rewardsReady: (reviewSummary.rewards || []).filter((item) => item.canClaim).length,
      goalText: goal.completed >= goal.target
        ? '今日目标已完成'
        : `今日进度 ${goal.completed || 0}/${goal.target || 5}`,
      challengeText: challenge.title || (currentModule ? currentModule.title : '完成一轮：想法 -> 提示 -> 轻练习 -> 修卡点'),
      nextMeta: hasTask ? `${topMust.minutes || 10} 分钟` : '先说第一步',
      nextGate: reviewSummary.due
        ? '下一关：5 分钟回忆'
        : reviewSummary.total
          ? '下一关：保持手感'
          : '下一关：先生成学习卡'
    };
  },

  buildMissionCards(topMust, reviewSummary, modulePath) {
    const quiz = reviewSummary.quiz || {};
    return [
      {
        id: 'input',
        label: '先说想法',
        title: '把第一步写出来',
        body: topMust ? '已找到今晚关键任务，先说你会怎么开始。' : '作业、错题、知识点都可以，重点是写下你的想法。',
        value: '1',
        action: topMust ? 'startTopMust' : 'submitAiDraft',
        tone: 'hot'
      },
      {
        id: 'first_step',
        label: '只给提示',
        title: '作业点拨问下一步',
        body: topMust ? topMust.text : '不会直接讲最终结果，只帮你检查思路和下一步。',
        value: '2',
        action: topMust ? 'startTopMust' : 'submitAiDraft',
        tone: 'calm'
      },
      {
        id: 'finish',
        label: '进入练习',
        title: '做完再去轻练习',
        body: topMust ? '做完这一小步，再把卡住点送进轻练习。' : '把提示后的内容变成可回访的小练习。',
        value: '3',
        action: topMust ? 'startTopMust' : 'submitAiDraft',
        tone: 'calm'
      },
      {
        id: 'review',
        label: '复习闭环',
        title: '5 分钟回忆一下',
        body: `${reviewSummary.due || 0} 张到期，${quiz.count || 0} 道小测。`,
        value: '4',
        action: 'goReview',
        tone: 'dark'
      },
      {
        id: 'profile',
        label: '我的进展',
        title: '收尾问自己一句',
        body: '我能不能说清自己的想法、卡点和下一步。',
        value: '5',
        action: 'goProfile',
        tone: 'calm'
      }
    ];
  },

  buildContentEntry(modulePath, reviewSummary) {
    const currentModule = modulePath && modulePath.current ? modulePath.current : null;
    return {
      title: '轻练习工坊',
      label: '粘贴学习材料，先变成学习卡、小测和 7 天回访。',
      cards: [
        { id: 'input', value: '1', label: '粘贴材料', body: '作业、笔记、PPT 要点、错题说明' },
        { id: 'pack', value: currentModule ? currentModule.score : '卡', label: '生成轻练习', body: currentModule ? currentModule.title : '知识卡 + 测验 + 点拨提示' },
        { id: 'loop', value: reviewSummary.maturity ? reviewSummary.maturity.overall : 0, label: '进入复习', body: '每天自动回访最该复习的内容' }
      ]
    };
  },

  buildParentSnapshot(state, topMust, reviewSummary, thinkingSummary) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const thinking = thinkingSummary || {};
    return {
      title: '看得见为什么这样安排',
      body: topMust
        ? `今晚优先看：${topMust.text}`
        : '先完成第一步，再看卡点和复习记录。',
      metrics: [
        { label: '当前卡点', value: weak.name || '待观察' },
        { label: '复习资产', value: reviewSummary.total || 0 },
        { label: '思路记录', value: thinking.total || 0 }
      ]
    };
  },

  buildPathRouter() {
    return [
      {
        id: 'parent',
        role: '我的',
        promise: '看见回访记录和今晚修过哪一步。',
        action: 'goRadar',
        label: '看留痕'
      },
      {
        id: 'kid',
        role: '孩子',
        promise: '3分钟开始第一个有用步骤。',
        action: 'startTopMust',
        label: '开始辅导'
      },
      {
        id: 'pack',
        role: '轻练习',
        promise: '把真实材料变成可复习内容。',
        action: 'goTools',
        label: '去生成'
      }
    ];
  },

  buildQuickDock(topMust, reviewSummary, modulePath) {
    return [
      {
        id: 'must',
        label: '今晚',
        meta: topMust ? `${topMust.minutes || 10} 分钟` : '规划',
        action: topMust ? 'startTopMust' : 'submitAiDraft'
      },
      {
        id: 'tools',
        label: '轻回访',
        meta: modulePath.current ? '已推荐' : '材料',
        action: 'goTools'
      },
      {
        id: 'parent',
        label: '我的',
        meta: '进展',
        action: 'goRadar'
      }
    ];
  },

  buildExecutiveBrief(state, topMust, reviewSummary, thinkingSummary, modulePath) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const thinking = thinkingSummary || {};
    const module = modulePath && modulePath.current ? modulePath.current : null;
    const proofRecords = Number(reviewSummary.total || 0) + Number(thinking.total || 0) + (topMust ? 1 : 0);
    return {
      title: '产品闭环成熟度',
      label: '一屏看清产品主线：减少陪写冲突，保护孩子思考，把卡点沉淀成长期复习记录。',
      northStar: Math.min(100, 74 + Math.min(10, proofRecords) + Math.min(8, reviewSummary.due || 0) + Math.min(8, thinking.proofSentence || 0)),
      cards: [
        {
          id: 'tonight',
          label: '今晚决策',
          value: topMust ? '已锁定' : '待输入',
          body: topMust ? topMust.text : '先填作业，再拆成必交先做、灵活安排、可以后置。'
        },
        {
          id: 'weak',
          label: '卡点信号',
          value: weak.score || '--',
          body: weak.name || '先说今晚卡在哪。'
        },
        {
          id: 'records',
          label: '学习记录',
          value: proofRecords,
          body: `${reviewSummary.total || 0} 张记忆卡 + ${thinking.total || 0} 条思路记录。`
        },
        {
          id: 'next',
          label: '下一步引擎',
          value: module ? module.score : 0,
          body: module ? module.title : '打开轻练习生成器。'
        }
      ]
    };
  },

  buildReturnLoop(reviewSummary) {
    const due = reviewSummary.due || 0;
    const quiz = reviewSummary.quiz ? reviewSummary.quiz.count : 0;
    const repair = reviewSummary.qualityQueue ? reviewSummary.qualityQueue.length : 0;
    return {
      title: '7天回访节奏',
      label: '每天只做一小步：复习少量卡、修一个卡点、保持本周回访不断档。',
      days: [
        { day: '第1天', task: '锁定必须做和第一个卡点', value: '今晚' },
        { day: '第2天', task: '不看笔记回忆昨天方法', value: `${due} 张` },
        { day: '第3天', task: '做一次闭卷小测', value: `${quiz} 题` },
        { day: '第5天', task: '修复一张顽固卡', value: `${repair} 项` },
        { day: '第7天', task: '复盘本周进展并开启下轮冲刺', value: '进展' }
      ]
    };
  },

  buildTonightSprint(topMust, reviewSummary, modulePath) {
    const currentModule = modulePath.current || null;
    return {
      title: '今晚15分钟冲刺',
      label: '一个家庭今晚就能跑完一次有用闭环：选对任务、陪孩子说第一步、把卡点沉淀到复习。',
      steps: [
        {
          id: 'task',
          kicker: '1 / 优先级',
          title: topMust ? '先做今晚最关键的一题' : '填作业，让咕点选择',
          desc: topMust
            ? topMust.text
            : '先粘贴今晚作业，我会拆成必交先做、灵活安排、可以后置。',
          proof: topMust ? `${topMust.minutes || 10} 分钟 / 必须做` : '3分钟设置',
          action: topMust ? 'startTopMust' : 'goUpload',
          cta: topMust ? '去点拨' : '填作业'
        },
        {
          id: 'coach',
          kicker: '2 / 辅导',
          title: currentModule ? currentModule.title : '用作业点拨迈出第一步',
          desc: currentModule
            ? currentModule.scene
            : '先听你想到哪一步，再问一个能帮你继续想的问题。',
          proof: currentModule ? `${currentModule.minutes} 分钟模块` : '3-5分钟',
          action: currentModule ? 'goTools' : 'goTutor',
          cta: currentModule ? '打开轻练习' : '打开作业点拨'
        },
        {
          id: 'memory',
          kicker: '3 / 记忆',
          title: '用复习和测验闭环',
          desc: `把今晚卡点变成间隔复习、测验和修复，不再靠临时记住。`,
          proof: `${reviewSummary.due || 0} 张到期 / ${reviewSummary.quiz ? reviewSummary.quiz.count : 0} 题测验`,
          action: 'goReview',
          cta: '开始复习'
        }
      ]
    };
  },

  buildParentHandoff(topMust, reviewSummary, state) {
    const weakPoint = ((state && state.weak_points) || [])[0] || null;
    const firstTag = (((topMust || {}).evidence || {}).misconception_tags || [])[0] || null;
    return {
      title: '学习收尾卡',
      label: '今天只看三件事：盯什么、别怎么学、什么算真的会了。',
      cards: [
        {
          id: 'watch',
          title: '只盯一件事',
          body: weakPoint
            ? `${weakPoint.name}: 孩子能不能不靠提示说出第一步？`
            : '先看孩子能不能独立开始，再决定要不要解释。',
          tone: 'focus'
        },
        {
          id: 'avoid',
          title: '不要过度帮忙',
          body: '不要替孩子思考。先问下一步怎么做，不要直接问最终结果。',
          tone: 'guardrail'
        },
        {
          id: 'evidence',
          title: '说出下次先查什么',
          body: firstTag
            ? `让孩子说清楚：这次如何避开「${firstTag.name}」。`
            : '让孩子把修正后的想法说出来，再送进复习。',
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
        title: '先做必须做',
        desc: topMust.text,
        meta: `${topMust.minutes || 10} 分钟`,
        action: 'startTopMust',
        primary: true
      });
    } else {
      actions.push({
        id: 'upload',
        title: '填今晚作业',
        desc: '粘贴清单，分出必交先做、灵活安排、可以后置。',
        meta: '3 分钟',
        action: 'goUpload',
        primary: true
      });
    }
    actions.push({
      id: 'review',
      title: '轻回访',
      desc: `${reviewSummary.due || 0} 张到期，${reviewSummary.quiz ? reviewSummary.quiz.count : 0} 张测验卡`,
      meta: '5 分钟',
      action: 'goReview'
    });
    actions.push({
      id: 'cockpit',
      title: '打开轻练习',
      desc: modulePath.current ? modulePath.current.title : '选一个练习方法',
      meta: '10-20 分钟',
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

  onAiDraftInput(event) {
    this.setData({ aiDraft: event.detail.value });
  },

  setPackTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab) this.setData({ packTab: tab });
  },

  setToolCategory(event) {
    const category = event.currentTarget.dataset.category || 'all';
    this.setData({
      activeToolCategory: category,
      visibleToolCards: this.filterToolCards(this.data.toolCards, category)
    });
  },

  applyPromptChip(event) {
    const id = event.currentTarget.dataset.id;
    const chip = (this.data.promptChips || []).find((item) => item.id === id);
    if (!chip) return;
    this.setData({ aiDraft: chip.text });
  },

  toggleCompanionPicker() {
    this.setData({ showCompanionPicker: !this.data.showCompanionPicker });
  },

  selectCompanion(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || !storage.saveCompanionPreference) return;
    const companionPreference = storage.saveCompanionPreference(id);
    const growthMemoryLine = storage.getGrowthMemoryLine ? storage.getGrowthMemoryLine(null, companionPreference) : null;
    this.setData({
      companionPreference,
      homeViewModel: buildHomeViewModel({
        companionPreference,
        tonightPlan: this.data.tonightPlan,
        todayFocus: this.data.todayFocus,
        growthMemory: growthMemoryLine
      }),
      companionCopy: {
        home: storage.getCompanionStageCopy ? storage.getCompanionStageCopy('home_plan', companionPreference) : ''
      },
      companionLine: storage.formatCompanionLine ? storage.formatCompanionLine(companionPreference) : '',
      growthMemory: {
        home: growthMemoryLine && !growthMemoryLine.empty
          ? growthMemoryLine.oneLine
          : (storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('home', companionPreference) : '')
      },
      showCompanionPicker: false
    });
  },

  routeImportDraft(route) {
    if (route === 'review') {
      this.goTools();
      return;
    }
    this.openTutorFromHome('/pages/tutor/tutor?from=home_import');
  },

  startStuck() {
    const text = String(this.data.aiDraft || '').trim();
    if (text) {
      this.submitAiDraft();
      return;
    }
    this.setData({
      aiDraft: '我卡住了。\n题目是：\n我先想到的是：\n我不知道下一步怎么写。'
    }, () => {
      this.submitAiDraft();
    });
  },

  planTonight() {
    const text = String(this.data.aiDraft || '').trim();
    const draft = text || '数学应用题 3 道，明天必交\n英语单词 10 分钟\n整理今天卡住的一步\n数学拓展题 2 道';
    if (/不会|卡住|不知道|不会列式|读不懂|算错|说不清/.test(draft)) {
      this.submitAiDraft();
      return;
    }
    const plan = storage.createTonightPlanFromInput ? storage.createTonightPlanFromInput(draft, {
      source: 'home_route_cta'
    }) : null;
    this.setData({
      aiDraft: draft,
      tonightPlan: plan,
      homeViewModel: buildHomeViewModel({
        companionPreference: this.data.companionPreference,
        tonightPlan: plan,
        todayFocus: this.data.todayFocus
      }),
      routeStrip: this.buildRouteStrip('plan', plan),
      focusFeedback: plan ? '已排好今晚路线，按今晚路线开始就行。' : '先写今晚作业清单，我来帮你排顺序。'
    });
  },

  noop() {},

  submitAiDraft() {
    const text = String(this.data.aiDraft || '').trim();
    if (!text) {
      wx.showToast({ title: '先说一句卡在哪', icon: 'none' });
      return;
    }
    const importRoute = importIntake.classifyImportInput(text);
    this.trackShareActivation('material_started', {
      text_length: text.length,
      next: importRoute.route || 'tutor'
    });
    storage.set(storage.KEYS.taskDraft, {
      text,
      source: 'home_xiaodian_entry',
      created_at: new Date().toISOString()
    });
    storage.set(storage.KEYS.selectedHomework, {
      id: `home_ai_${Date.now()}`,
      text,
      minutes: 5,
      evidence: {
        calibration_key: 'home:xiaodian:first_step',
        tags: ['first_step']
      },
      created_at: new Date().toISOString()
    });
    storage.set(storage.KEYS.selectedHomeworkSource, 'home_xiaodian_entry');
    const todayFocus = storage.saveTodayFocusFromThought && importRoute.shouldCreateFocus ? storage.saveTodayFocusFromThought(text, {
      source: 'home_xiaodian_entry'
    }) : null;
    if (todayFocus && todayFocus.isStuck && storage.updateTonightRouteStatus) {
      storage.updateTonightRouteStatus('focus_created', { focusId: todayFocus.id });
    }
    const hint = tutorLadder.buildTutorReply(text, {
      currentHintLevel: todayFocus && todayFocus.isStuck ? 2 : 1
    });
    if (storage.appendThinkingReceipt) {
      storage.appendThinkingReceipt({
        title: '孩子先说了一步',
        score: todayFocus && todayFocus.isStuck ? 72 : 78,
        status: todayFocus && todayFocus.isStuck ? 'stuck point recorded' : 'first step recorded',
        focus: todayFocus && todayFocus.title ? todayFocus.title : text.slice(0, 48),
        selected_text: text,
        source: 'home_xiaodian_entry',
        coach_step: 'write_first_step',
        mastery_status: todayFocus && todayFocus.isStuck ? 'needs_repair' : 'thinking_started',
        risk: 'low',
        shareLine: todayFocus && todayFocus.isStuck ? '我记下来了，等下我们就修这个卡点。' : '这一步有用，我帮你记到思路里。',
        checks: [
          { id: 'first', label: '先说第一步', done: true, detail: text.slice(0, 80) },
          { id: 'safe', label: '不直接讲结果', done: true, detail: hint.hint_label || '先问一步，再给最小提示' },
          { id: 'cause', label: todayFocus && todayFocus.issueType ? todayFocus.issueType : '卡点待修', done: !!(todayFocus && todayFocus.isStuck), detail: todayFocus && todayFocus.title ? todayFocus.title : '' }
        ]
      });
    }
    storage.set(storage.KEYS.tutorMessages, [
      {
        role: 'assistant',
        hint_label: hint.hint_label,
        text: todayFocus && todayFocus.isStuck
          ? `${hint.reply}`
          : '这一步有用，我帮你记到思路里。接下来我只问一个小问题，帮你继续想。'
      },
      {
        role: 'user',
        text
      }
    ]);
    this.setData({
      todayFocus,
      homeViewModel: buildHomeViewModel({
        companionPreference: this.data.companionPreference,
        tonightPlan: this.data.tonightPlan,
        todayFocus
      }),
      showWeakVerdict: !!(todayFocus && todayFocus.isStuck),
      focusFeedback: todayFocus && todayFocus.isStuck
        ? `${importRoute.feedback} 去修这个卡点。`
        : importRoute.feedback
    });
    this.routeImportDraft(importRoute.route);
  },

  openTutorFromHome(url = '/pages/tutor/tutor?from=home') {
    if (url === '/pages/tutor/tutor?from=home') {
      wx.navigateTo({ url: '/pages/tutor/tutor?from=home' });
      return;
    }
    wx.navigateTo({ url });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  goDiagnosis() {
    wx.navigateTo({ url: '/pages/diagnosis/diagnosis' });
  },

  goReviewInput() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  goTutor() {
    this.openTutorFromHome('/pages/tutor/tutor?from=home');
  },

  goTools() {
    this.trackShareActivation('challenge_started', {
      next: 'tools'
    });
    wx.switchTab({ url: '/pages/tools/tools' });
  },

  goDailyMath() {
    wx.navigateTo({ url: '/pages/daily-math/daily-math' });
  },

  goDictation() {
    wx.navigateTo({ url: '/pages/dictation/dictation' });
  },

  goLightDiagnosis() {
    wx.navigateTo({ url: '/pages/light-diagnosis/light-diagnosis' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goReview() {
    wx.switchTab({ url: '/pages/review/review' });
  },

  goFocus() {
    const session = storage.getTodaySession ? storage.getTodaySession() : null;
    const canStart = storage.canStartFocusFromTodaySession
      ? storage.canStartFocusFromTodaySession(session)
      : !!(session && session.childArticulatedStep);
    if (!canStart) {
      wx.showToast({ title: '先回咕点确认今晚第一步，才能进专注舱。', icon: 'none' });
      return;
    }
    wx.switchTab({ url: '/pages/focus/focus' });
  },

  continueYesterdayReview() {
    const card = this.data.yesterdayReviewCard || (storage.getYesterdayReview && storage.getYesterdayReview());
    if (card && storage.markReviewCardRevisited) storage.markReviewCardRevisited(card.id);
    wx.switchTab({ url: '/pages/review/review' });
  },

  goArcade() {
    this.trackShareActivation('challenge_started', {
      next: 'arcade'
    });
    const incoming = this.data.incomingShare || (storage.loadIncomingShare && storage.loadIncomingShare()) || {};
    const query = incoming.share_code
      ? `?from=share&share=${incoming.share_code}&mode=${incoming.mode || ''}&identity=${encodeURIComponent(incoming.identity_tag || '')}`
      : '';
    wx.navigateTo({ url: `/pages/arcade/arcade${query}` });
  },

  startTopMust() {
    if (this.data.topMust) {
      storage.set(storage.KEYS.selectedHomework, this.data.topMust);
      storage.set(storage.KEYS.selectedHomeworkSource, 'home_top_must');
    }
    this.openTutorFromHome('/pages/tutor/tutor?from=home_top_must');
  },

  goRadar() {
    wx.navigateTo({ url: '/pages/radar/radar' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  trackShareActivation(event, payload = {}) {
    const incoming = this.data.incomingShare || (storage.loadIncomingShare && storage.loadIncomingShare());
    if (!incoming || !incoming.share_code) return;
    api.submitEvent({
      event,
      source: incoming.from || 'share',
      entity_id: incoming.share_code,
      page: 'home',
      payload: Object.assign({
        share_code: incoming.share_code,
        challenge: incoming.challenge || '',
        mode: incoming.mode || '',
        identity_tag: incoming.identity_tag || ''
      }, payload || {})
    }).catch(() => {});
  }
});
