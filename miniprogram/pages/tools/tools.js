const learningModules = require('../../utils/learning-modules');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const reviewCards = require('../../utils/review-cards');
const api = require('../../utils/api');
const arcadeEngine = require('../../utils/arcade-engine');
const focusCabin = require('../../utils/focus-cabin');
const { buildToolsViewModel } = require('../../view-models/tools-view-model');

const ALL_FILTER = 'all';
const DEFAULT_CHALLENGE_HUB = {
  title: '先做第一关',
  body: '粘贴作业、错题或笔记，先生成回访卡，再选一个 5 分钟轻练习。',
  primaryLabel: '先试玩一关',
  primaryAction: 'generate',
  reviewLabel: '查看复习卡',
  cardCount: 0,
  due: 0,
  xp: 0,
  level: 1,
  lives: 0,
  maxLives: 5,
  streak: 0,
  rewardsReady: 0
};

function visibleLearningState() {
  return storage.loadState();
}

Page({
  data: {
    mainEntrances: [
      {
        key: 'mistake',
        title: '错题整理',
        badge: '回访入口',
        desc: '把错题、孩子步骤和老师批注整理成可复习的卡点卡。',
        prompt: '请按“题目/我的步骤/卡在哪里/下次先检查什么”整理这道错题，不要直接讲最终结果。',
        input: '题目 + 孩子的错误步骤 + 老师批注',
        output: '卡点卡 / 修复题 / 复盘句 / 复习卡',
        proof: '孩子不再只说粗心，而能说清哪一步想错。',
        next: '导入轻回访，再用作业点拨只讲关键一步。',
        action: '错题入库',
        target: 'wrong_cause'
      },
      {
        key: 'homework',
        title: '作业取舍',
        badge: '减负入口',
        desc: '把今晚作业分成必交先做、灵活安排、可以后置，先保住最关键的。',
        prompt: '请根据今晚卡点，把今晚作业分成必交先做、灵活安排、可以后置，并说明每一类理由。',
        input: '今晚作业清单 + 可用时间 + 孩子卡点',
        output: '必交先做 / 灵活安排 / 可以后置 / 今晚第一步',
        proof: '不是少做，而是先做最有帮助的作业。',
        next: '必交任务进入作业点拨，后置任务留下安排理由。',
        action: '录入作业',
        path: '/pages/upload/upload'
      },
      {
        key: 'material',
        title: '轻练习生成',
        badge: '材料入口',
        desc: '粘贴笔记、PPT、视频摘要，生成知识卡、测验、复习计划。',
        prompt: '请把这段学习材料生成：知识点卡、易错点卡、3 道小测、7 天复习计划、复盘摘要。',
        input: '笔记 / PPT 提纲 / 视频字幕 / 手写整理',
        output: '知识卡 / 小测验 / 7 天复习 / 复盘摘要',
        proof: '材料不是看过就忘，而是进入长期复习。',
        next: '导入复习，变成每日轻回访和间隔复习。',
        action: '生成关卡',
        target: 'class_notes'
      },
      {
        key: 'stuck',
        title: '不会问的问题',
        badge: '点拨入口',
        desc: '孩子只要说“我卡在哪”，咕点用追问和最小提示带下一步。',
        prompt: '请先问我题目在问什么，再让我写第一步，不要直接讲最终结果。',
        input: '我不会 / 我卡住的步骤 / 我写到这里',
        output: '追问 / 最小提示 / 卡点镜头 / 思路记录',
        proof: '孩子先思考，再接受提示，而不是复制结果。',
        next: '形成思考证据，进入成长记录。',
        action: '找作业点拨',
        path: '/pages/tutor/tutor'
      },
      {
        key: 'review',
        title: '轻回访',
        badge: '长期记忆',
        desc: '把卡点和知识卡进入每日复习、测验、修复练习和连续打卡。',
        prompt: '请把今天的卡点变成明天、3 天后、7 天后的复习卡，并安排小测和复盘句。',
        input: '卡点卡 / 知识卡 / 小测结果',
        output: '今日待复习 / 修复题 / 连续打卡',
        proof: '孩子在变熟，而不是每天重新学一遍。',
        next: '回访结果会更新下一轮必须做。',
        action: '开始复习',
        path: '/pages/review/review'
      }
    ],
    precisionModes: [
      {
        key: 'exam_diagnosis',
        title: '考后复盘',
        badge: '常用',
        verdict: '先定位',
        desc: '上传错题和简短描述，从知识漏洞和做题过程两条线定位卡点。',
        why: '适合考试后、单元测后使用，先知道最该补哪里。',
        prompt: '请结合错题和卡点记录，找出今晚最该先修的 3 个知识漏洞，并按优先级排序。',
        action: '去复盘',
        path: '/pages/diagnosis/diagnosis'
      },
      {
        key: 'study_plan',
        title: '学习计划',
        badge: '常用',
        verdict: '接下来做什么',
        desc: '基于卡点结果生成 7 天任务清单和时间分配。',
        why: '适合把本周学习拆成每天能完成的小步。',
        prompt: '请基于当前卡点、可用时间和复习负荷，生成 7 天学习计划：今天做什么、复习什么、怎么验收。',
        action: '看计划',
        target: 'study_plan'
      },
      {
        key: 'mistake_drill',
        title: '错题专练',
        badge: '常用',
        verdict: '把错题练会',
        desc: '围绕卡住的知识点生成同类题强化训练。',
        why: '适合做完一道错题后立刻巩固，避免只订正不迁移。',
        prompt: '请基于这道错题和卡点，生成 3 道同类强化题，难度逐级提升，并告诉我每道题在练什么。',
        target: 'wrong_cause',
        action: '去专练'
      },
      {
        key: 'knowledge_playground',
        title: '轻练一下',
        badge: '可选',
        verdict: '学累了再轻练',
        desc: '把知识点变成 5 分钟轻练习。',
        why: '适合孩子学累后确认一下，不替代今晚主任务。',
        prompt: '请把这个知识点变成 5 分钟轻练习，按孩子当前水平出题。',
        action: '轻练一下'
      },
      {
        key: 'practice_paper',
        title: '自测小卷',
        badge: '周末',
        verdict: '阶段自测',
        desc: '选择章节和难度，生成一套模拟试卷。',
        why: '适合周末或考前自测，平时晚上不建议先做。',
        prompt: '请按当前章节和难度生成一套小测卷，含基础题、易错题和压轴题。',
        action: '周末再用'
      },
      {
        key: 'knowledge_visual',
        title: '知识可视化',
        badge: '结构',
        verdict: '看懂结构',
        desc: '把知识点变成流程图或结构图，帮助自己看清卡在哪。',
        why: '适合复盘时讲清结构。',
        prompt: '请把这个知识点画成学习流程图：先理解什么，再练什么，常错在哪。',
        action: '做解释层'
      }
    ],
    pathSummary: [
      { title: '先看卡点', desc: '把错题和作业变成第一版卡点记录。' },
      { title: '再排序', desc: '拆成必交先做、灵活安排、可以后置。' },
      { title: '作业点拨', desc: '只在必须做和关键卡点上启用点拨。' },
      { title: '最后复习', desc: '把真实错误变成复习卡、测验题和修复卡。' }
    ],
    tools: [
      {
        key: 'diagnosis',
        name: '卡点复盘',
        desc: '根据错题和简短描述，生成第一版卡点记录。',
        action: '开始复盘',
        path: '/pages/diagnosis/diagnosis'
      },
      {
        key: 'upload',
        name: '作业三分类',
        desc: '粘贴今晚作业，拆成必交先做、灵活安排、可以后置。',
        action: '填写作业',
        path: '/pages/upload/upload'
      },
      {
        key: 'radar',
        name: '今晚留痕',
        desc: '看清每项任务为什么重要、打在哪个卡点上。',
        action: '打开留痕',
        path: '/pages/radar/radar'
      },
      {
        key: 'tutor',
        name: '作业点拨',
        desc: '引导第一步和卡点，不替孩子写结果。',
        action: '开始辅导',
        path: '/pages/tutor/tutor'
      },
      {
        key: 'review',
        name: '间隔复习',
        desc: '做长期记忆复习、主动回忆测验、卡点修复和卡组管理。',
        action: '开始复习',
        path: '/pages/review/review'
      }
    ],
    moduleFilters: [
      { value: ALL_FILTER, label: '全部' },
      { value: 'Math', label: '数学' },
      { value: 'English', label: '英语' },
      { value: 'Chinese', label: '语文' },
      { value: 'General', label: '通用' }
    ],
    activeFilter: ALL_FILTER,
    modules: learningModules.listModules(),
    visibleModules: learningModules.listModules(),
    adaptivePath: null,
    currentModule: null,
    reviewSummary: null,
    focusDueReviewCards: [],
    focusReviewTitle: '修过的卡点',
    focusCabinSummary: focusCabin.progressSummary ? focusCabin.progressSummary() : null,
    latestFocusSession: null,
    reviewStats: null,
    cramPlan: null,
    deckLibrary: [],
    launchPlaybook: null,
    revolutionBoard: null,
    automationBoard: null,
    cockpitMessage: '',
    factoryPacks: [],
    factoryStudioInput: '',
    factoryStudioMode: 'text',
    factoryStudioType: 'class_notes',
    factoryStudioRemotePlan: null,
    factoryStudioPlan: null,
    packLoop: null,
    challengeHub: DEFAULT_CHALLENGE_HUB,
    gameModes: [],
    setupGameModes: [],
    playgroundGames: [],
    tonightPlan: null,
    routeStrip: null,
    companionPreference: null,
    companionCopy: { tools: '咕点陪你轻轻回访昨天那一步。' },
    companionLine: '咕点：我懂你卡住了，我陪你先迈出第一步。',
    growthMemory: { tools: '' },
    toolsViewModel: buildToolsViewModel(),
    factoryStudioOutputs: [
      { id: 'knowledge', icon: '卡', title: '知识卡', desc: '把要点变成可回忆的问题。' },
      { id: 'quiz', icon: '测', title: '小测验', desc: '按材料生成由易到难的小测。' },
      { id: 'plan', icon: '复', title: '复习计划', desc: '按生成结果安排后续回访。' },
      { id: 'cause', icon: '点', title: '卡点卡', desc: '记录下次先检查什么。' }
    ],
    factoryStudioStatus: '粘贴课堂笔记、PPT 提纲、视频字幕或卡点总结。',
    surfaceDepthPack: null,
    publicK12ContentOps: null,
    competitiveMoatWorkbench: null,
    showAdvancedTools: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.refresh();
  },

  refresh() {
    const state = visibleLearningState();
    const tonightPlan = storage.loadTonightPlan ? storage.loadTonightPlan() : null;
    const companionPreference = storage.loadCompanionPreference ? storage.loadCompanionPreference() : null;
    const moduleEvents = storage.loadModuleEvents ? storage.loadModuleEvents() : [];
    const feedbackMap = storage.moduleFeedbackMap ? storage.moduleFeedbackMap() : {};
    const storedCards = storage.loadReviewCards ? storage.loadReviewCards() : [];
    const adaptivePath = learningModules.buildAdaptivePath(state, feedbackMap, moduleEvents, 5, storedCards);
    const reviewSummary = reviewCards.reviewSummary();
    const focusDueReviewCards = reviewCards.cardBrowser({ source: 'today_focus', status: 'due', limit: 3 });
    const focusReviewCards = focusDueReviewCards.length
      ? focusDueReviewCards
      : reviewCards.cardBrowser({ source: 'today_focus', status: 'all', limit: 3 });
    const firstFocusReviewCard = focusReviewCards[0] || {};
    const focusHistory = focusCabin.loadHistory ? focusCabin.loadHistory() : [];
    const factorySummary = storage.factoryEventSummary ? storage.factoryEventSummary() : null;
    const factoryPacks = learningModules.contentFactoryPacks(state, reviewSummary);
    const filter = this.data.activeFilter || ALL_FILTER;
    const all = learningModules.listModules();
    const visibleModules = filter === ALL_FILTER ? all : all.filter((item) => item.subject === filter);
    const basePlan = this.buildFactoryStudioPlan(this.data.factoryStudioInput, this.data.factoryStudioType, state);
    const remotePlan = this.data.factoryStudioRemotePlan;
    const factoryStudioPlan = remotePlan
      && remotePlan.rawText === String(this.data.factoryStudioInput || '').trim()
      && remotePlan.inputType === this.data.factoryStudioType
      ? remotePlan
      : basePlan;
    const arcadeCards = this.challengeCards();
    const recommendedGames = arcadeEngine.recommendGames(arcadeCards);
    const gameModes = this.coreGameModes(recommendedGames);
    const setupGameModes = this.setupGameModes(recommendedGames);
    const playgroundGames = this.buildPlaygroundGames(recommendedGames);
    const realHomeworkCoverageMatrix = storage.buildRealHomeworkCoverageMatrix
      ? storage.buildRealHomeworkCoverageMatrix()
      : null;
    this.setData({
      modules: all,
      visibleModules,
      adaptivePath,
      currentModule: adaptivePath.current || null,
      reviewSummary,
      focusDueReviewCards: focusReviewCards,
      focusReviewTitle: firstFocusReviewCard.front || firstFocusReviewCard.title || '修过的卡点',
      focusCabinSummary: focusCabin.progressSummary ? focusCabin.progressSummary(focusHistory) : null,
      latestFocusSession: focusHistory[0] || null,
      reviewStats: {
        due: reviewSummary.due || 0,
        quiz: reviewSummary.quiz ? reviewSummary.quiz.count : 0,
        quizAccuracy: reviewSummary.quizLoop ? reviewSummary.quizLoop.accuracy : 0,
        maturity: reviewSummary.maturity ? reviewSummary.maturity.overall : 0,
        readiness: reviewSummary.commercialReadiness ? reviewSummary.commercialReadiness.average : 0
      },
      cramPlan: reviewSummary.cramPlan || null,
      deckLibrary: (reviewSummary.deckLibrary || []).slice(0, 3),
      launchPlaybook: this.buildLaunchPlaybook(adaptivePath, reviewSummary, factoryPacks),
      revolutionBoard: this.buildLearningRevolutionBoard(state, reviewSummary, factoryPacks),
      automationBoard: this.buildAutomationBoard(state, reviewSummary, factorySummary),
      cockpitMessage: adaptivePath.reason || '选一个聚焦模块，把它变成点拨提示和复习卡。',
      factoryPacks,
      factoryStudioPlan,
      packLoop: this.buildPackLoop(reviewSummary, factoryStudioPlan, factorySummary),
      challengeHub: this.buildChallengeHub(reviewSummary, arcadeCards, gameModes),
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('tools') : null,
      publicK12ContentOps: this.buildPublicK12ContentOps(realHomeworkCoverageMatrix, reviewSummary, factorySummary),
      competitiveMoatWorkbench: storage.buildCompetitiveMoatWorkbench
        ? storage.buildCompetitiveMoatWorkbench({ realHomeworkCoverageMatrix })
        : null,
      gameModes,
      setupGameModes,
      playgroundGames,
      tonightPlan,
      routeStrip: this.buildRouteStrip('review', tonightPlan),
      companionPreference,
      companionCopy: {
        tools: storage.getCompanionStageCopy ? storage.getCompanionStageCopy('tools_recall', companionPreference) : '咕点陪你轻轻回访昨天那一步。'
      },
      companionLine: storage.formatCompanionLine ? storage.formatCompanionLine(companionPreference) : '咕点：我懂你卡住了，我陪你先迈出第一步。',
      growthMemory: {
        tools: storage.growthMemoryCopyFor ? storage.growthMemoryCopyFor('tools', companionPreference) : ''
      },
      toolsViewModel: buildToolsViewModel({
        companionPreference,
        reviewCards: focusReviewCards,
        reviewCard: firstFocusReviewCard,
        latestFocusSession: focusHistory[0] || null,
        focusHistory
      })
    });
  },

  buildPublicK12ContentOps(coverageMatrix, reviewSummary, factorySummary) {
    const matrix = coverageMatrix || {};
    const triage = matrix.publicResourceTriageBoard || {};
    const lanes = Array.isArray(triage.lanes) ? triage.lanes : [];
    const resources = Array.isArray(matrix.publicK12OpenSourceResourceLedger)
      ? matrix.publicK12OpenSourceResourceLedger
      : [];
    const challenges = Array.isArray(matrix.publicK12IntakeChallengeDeck)
      ? matrix.publicK12IntakeChallengeDeck
      : [];
    const implementationRows = Array.isArray(matrix.implementationDecisionMatrix)
      ? matrix.implementationDecisionMatrix
      : [];
    const factoryImported = Number((factorySummary && factorySummary.imported) || 0);
    const dueCards = Number((reviewSummary && reviewSummary.due) || 0);
    const firstLocalLane = lanes.find((item) => item.id === 'local_code_better') || lanes[0] || {};
    const aiLane = lanes.find((item) => item.id === 'ai_better') || {};
    const rejectLane = lanes.find((item) => item.id === 'must_reject') || {};
    return {
      title: 'K12公开资料处理台',
      summary: `已接入 ${resources.length} 类公开/OER/官方结构，先转成本地题型、错因、小黑板和复习规则，再让 AI 改写追问语气。`,
      evidenceLine: matrix.openSourceResourceLine || '',
      sourceLine: matrix.publicSourceBlockedLine || '不复制原题、答案、教材段落或外部交互，不承诺拍题出答案。',
      localLine: firstLocalLane.use || '本地代码负责题型、错因、回访窗口、XP、解锁、报告放行和分享字段。',
      aiLine: aiLane.use || 'AI 负责把已通过本地门槛的追问、解释和家长话术说清楚。',
      rejectLine: rejectLane.use || '拒绝标准答案库、排名晒分、未授权题库导入和全科动态板书承诺。',
      actionLine: factoryImported || dueCards
        ? '已有材料或到期卡，先做一轮90秒回忆，再决定是否扩内容。'
        : '先贴一段自己的作业卡点，系统只生成第一步挑战，不生成答案库。',
      metrics: [
        { id: 'resource', label: '可借鉴来源', value: resources.length },
        { id: 'challenge', label: '公开形态挑战', value: challenges.length },
        { id: 'decision', label: 'AI/本地决策', value: implementationRows.length },
        { id: 'due', label: '当前回访', value: dueCards }
      ],
      lanes: [
        { id: 'local', label: '本地代码更好', body: firstLocalLane.use || '规则、门槛、奖励、分享字段都用本地代码。' },
        { id: 'ai', label: 'AI更好', body: aiLane.use || '苏格拉底追问、解释改写、家长可读话术交给 AI。' },
        { id: 'reject', label: '必须拒绝', body: rejectLane.use || '不做原题答案库、拍照识题承诺、排名晒分。' }
      ],
      challengeSeeds: challenges.slice(0, 4).map((item) => Object.assign({}, item, {
        route: item.route || `/pages/tutor/tutor?from=public_k12_seed&challenge_id=${encodeURIComponent(item.id || 'public_k12')}`,
        reviewRoute: item.reviewRoute || `/pages/review/review?from=public_k12_seed&challenge_id=${encodeURIComponent(item.id || 'public_k12')}`,
        sourceChallengeId: item.id || '',
        firstStepGate: item.observableFirstMove || item.firstStepPrompt || '孩子能说出第一步'
      })),
      primaryRoute: '/pages/upload/upload',
      secondaryRoute: '/pages/arcade/arcade?from=public_k12_intake'
    };
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
      text: '今晚路线：修过的卡点，用小关卡确认一下。',
      steps: steps.map((step) => Object.assign({}, step, { active: step.id === active }))
    };
  },

  challengeCards() {
    const sessionCards = reviewCards.sessionCards('smart', 16);
    if (sessionCards.length) return sessionCards;
    return reviewCards.cardBrowser({ status: 'all', limit: 16 });
  },

  coreGameModes(recommendedGames) {
    const coreOrder = { whack: 0, quiz: 1, snake: 2 };
    return (Array.isArray(recommendedGames) ? recommendedGames : [])
      .filter((item) => Object.prototype.hasOwnProperty.call(coreOrder, item.id))
      .sort((a, b) => coreOrder[a.id] - coreOrder[b.id])
      .map((item) => Object.assign({}, item, {
        statusLabel: item.available ? '可玩' : '待卡片'
      }));
  },

  buildPlaygroundGames(recommendedGames) {
    const byId = {};
    (Array.isArray(recommendedGames) ? recommendedGames : []).forEach((item) => {
      byId[item.id] = item;
    });
    const configs = [
      {
        id: 'whack',
        name: '地鼠快答',
        fit: '记不牢的，先快练',
        tone: 'gold',
        icon: 'mole'
      },
      {
        id: 'snake',
        name: '路径贪吃蛇',
        fit: '步骤题，一步一步走',
        tone: 'green',
        icon: 'snake'
      },
      {
        id: 'quiz',
        name: '概念探险',
        fit: '先想，再看提示',
        tone: 'blue',
        icon: 'map'
      },
      {
        id: 'match',
        name: '配对泡泡',
        fit: '概念和含义，先配一配',
        tone: 'orange',
        icon: 'lab'
      }
    ];
    return configs.map((config) => {
      const mode = byId[config.id] || {};
      const readyCount = Number(mode.readyCount || 0);
      const available = !!mode.available;
      return Object.assign({}, config, {
        available,
        readyCount,
        statusLabel: available ? `${readyCount} 关可玩` : '补材料后可玩',
        action: available ? 'play' : 'material'
      });
    });
  },

  setupGameModes(recommendedGames) {
    return (Array.isArray(recommendedGames) ? recommendedGames : [])
      .filter((item) => item.status !== 'ready')
      .map((item) => Object.assign({}, item, {
        statusLabel: '补材料后开放'
      }))
      .slice(0, 1);
  },

  buildChallengeHub(reviewSummary, cards, gameModes) {
    const summary = reviewSummary || {};
    const modes = Array.isArray(gameModes) ? gameModes : [];
    const playable = modes.filter((item) => item.available);
    const primary = playable[0] || modes[0] || {};
    const progress = summary.progress || {};
    const loop = summary.loop || {};
    const rewards = Array.isArray(summary.rewards) ? summary.rewards : [];
    return {
      title: playable.length ? '今天玩哪一关' : '先做第一关',
      body: playable.length
        ? `${primary.shortName || primary.name || '轻练习'}已经就绪。来自 ${Array.isArray(cards) ? cards.length : 0} 张真实学习卡，答完会写回复习和卡点。`
        : '先写一句或贴一题，咕点会把真实材料整理成可练的小卡。',
      primaryLabel: playable.length ? '去轻练一下' : '先生成练习',
      primaryAction: 'arcade',
      reviewLabel: Number(summary.due || 0) ? '复习回访' : '查看复习卡',
      cardCount: Array.isArray(cards) ? cards.length : 0,
      due: Number(summary.due || 0),
      xp: Number(progress.xp || 0),
      level: Number(progress.level || 1),
      lives: Number(loop.lives || 0),
      maxLives: Number(loop.maxLives || 5),
      streak: Number(loop.currentStreak || progress.streak || 0),
      rewardsReady: rewards.filter((item) => item.canClaim).length
    };
  },

  buildPackLoop(reviewSummary, factoryStudioPlan, factorySummary) {
    const summary = reviewSummary || {};
    const plan = factoryStudioPlan || {};
    const cards = Array.isArray(plan.cards) ? plan.cards : [];
    const imported = Number((factorySummary && factorySummary.imported) || 0);
    const generated = Number((factorySummary && factorySummary.generated) || 0);
    const due = Number(summary.due || 0);
    const quiz = Number((summary.quiz && summary.quiz.count) || 0);
    const total = Number(summary.total || 0);
    return {
      title: total ? '学习卡已经可回访' : '先把材料变成轻练习',
      status: cards.length
        ? `当前材料可生成 ${cards.length} 张预览卡`
        : total
          ? `已沉淀 ${total} 张复习卡`
          : '粘贴真实材料后生成回忆卡和小测',
      stats: [
        { id: 'generated', label: '生成次数', value: generated },
        { id: 'imported', label: '已导入', value: imported },
        { id: 'due', label: '待回访', value: due },
        { id: 'quiz', label: '小测', value: quiz }
      ],
      actionLabel: total || cards.length ? '去 5 分钟轻回访' : '先生成练习',
      action: total || cards.length ? 'review' : 'generate'
    };
  },

  runPackLoopAction() {
    const loop = this.data.packLoop || {};
    if (loop.action === 'review') {
      this.goReview();
      return;
    }
    if (!String(this.data.factoryStudioInput || '').trim()) {
      wx.showToast({ title: '先写一句想练什么', icon: 'none' });
      return;
    }
    this.runFactoryStudioRemote();
  },

  runChallengeHubAction() {
    const hub = this.data.challengeHub || {};
    if (hub.primaryAction === 'arcade') {
      navigation.navigateLearningRoute('/pages/arcade/arcade?from=tools_challenge_hub');
      return;
    }
    if (!String(this.data.factoryStudioInput || '').trim()) {
      wx.showToast({ title: '先写一句想练什么', icon: 'none' });
      return;
    }
    this.runFactoryStudioRemote();
  },

  openPlaygroundGame(event) {
    const id = event.currentTarget.dataset.id;
    const game = (this.data.playgroundGames || []).find((item) => item.id === id);
    if (game && game.available) {
      navigation.navigateLearningRoute(`/pages/arcade/arcade?game=${id}&from=tools`);
      return;
    }
    wx.showToast({ title: '先补一条真实材料，再开始轻练习', icon: 'none' });
  },

  toggleAdvancedTools() {
    this.setData({ showAdvancedTools: !this.data.showAdvancedTools });
  },

  openMainEntrance(event) {
    const key = event.currentTarget.dataset.key;
    const item = (this.data.mainEntrances || []).find((entry) => entry.key === key);
    if (!item) return;
    if (item.target) {
      const state = visibleLearningState();
      this.setData({
        factoryStudioType: item.target,
        factoryStudioInput: '',
        factoryStudioRemotePlan: null,
        factoryStudioPlan: this.buildFactoryStudioPlan('', item.target, state),
        factoryStudioStatus: '请粘贴真实作业、错题或笔记后再生成轻练习。'
      });
      wx.pageScrollTo({ scrollTop: 0, duration: 220 });
      return;
    }
    navigation.navigateLearningRoute(item.path);
  },

  openPrecisionMode(event) {
    const key = event.currentTarget.dataset.key;
    const item = (this.data.precisionModes || []).find((entry) => entry.key === key);
    if (!item) return;
    if (item.path) {
      navigation.navigateLearningRoute(item.path);
      return;
    }
    const state = visibleLearningState();
    const type = item.target || 'class_notes';
    this.setData({
      factoryStudioType: type,
      factoryStudioInput: '',
      factoryStudioRemotePlan: null,
      factoryStudioPlan: this.buildFactoryStudioPlan('', type, state),
      factoryStudioStatus: '请粘贴真实材料，咕点会基于当前输入生成轻练习。'
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },

  buildAutomationBoard(state, reviewSummary, factorySummary) {
    const weak = ((state.weak_points || [])[0] || {}).name || '当前卡点';
    const summary = factorySummary || { total: 0, imported: 0, quality: 0, remote: 0, label: '还没有内容工厂记录。' };
    return {
      title: '轻练习生产线',
      label: '把材料送进最合适的内容流程，先看质量，再决定要不要进入回访和作业点拨。',
      cards: [
        { id: 'weak', label: '当前卡点', value: weak, body: '轻练习必须始终绑定一个具体卡点。' },
        { id: 'runs', label: '生成次数', value: summary.total || 0, body: summary.label },
        { id: 'quality', label: '平均质量', value: summary.quality || 0, body: '正式内容必须稳定高于质量门。' },
        { id: 'imported', label: '导入卡片', value: summary.imported || 0, body: '只导入真正有助于辅导和复习的卡。' }
      ],
      nextAction: summary.quality >= 85
        ? '这套关卡质量已够：导入复习，再做一次短测。'
        : '质量还不稳定：补更具体的卡点和一道迁移题。'
    };
  },

  buildFactoryStudioPlan(text, type, state) {
    const raw = String(text || '').trim();
    const labels = {
      class_notes: '课堂笔记',
      ppt: 'PPT 提纲',
      video: '视频文字',
      wrong_cause: '卡点总结'
    };
    if (!raw) {
      return {
      title: '轻练习生成器',
        label: '粘贴学习材料，先生成今晚能闯的关卡：知识卡、测验、复习计划和复盘摘要。',
        type: labels[type] || '课堂笔记',
        provider: '本地引擎',
        score: 0,
        readyLabel: '待输入',
        cards: [],
        diagnostics: [],
        studyPack: this.buildStudioStudyPack([], raw, type, 0),
        qualityGate: this.buildContentQualityGate([], [], 0),
        recommendation: '先粘贴 3-8 行真实学习材料。'
      };
    }
    const profile = storage.loadProfile();
    const weakPoint = (((state || {}).weak_points || [])[0] || {}).name || type;
    const plan = reviewCards.contentEnginePlan(raw, {
      subject: profile.subject || '',
      weakPoint,
      calibrationKey: `studio:${type}`,
      source: `factory_studio_${type}`
    });
    return {
      title: '轻回访工作台',
      label: '先把材料变成今晚能学的内容，再决定要不要导入长期复习。',
      type: labels[type] || '课堂笔记',
      provider: '本地引擎',
      score: plan.score || 0,
      readyLabel: (plan.score || 0) >= 70 ? '可导入' : '继续补充',
      cards: (plan.cards || []).slice(0, 6),
      diagnostics: plan.coreCoverage || [],
      qualityBands: plan.qualityBands || [],
      studyPack: this.buildStudioStudyPack(plan.cards || [], raw, type, plan.score || 0),
      qualityGate: this.buildContentQualityGate(plan.cards || [], plan.coreCoverage || [], plan.score || 0),
      recommendation: plan.recommendation || '再补充更具体的卡点、步骤或变式，关卡会更有用。'
    };
  },

  buildContentQualityGate(cards, coverage, score) {
    const list = cards || [];
    const hasQuestion = list.filter((card) => String(card.question || '').length >= 10).length;
    const hasAnswer = list.filter((card) => String(card.answer || '').length >= 8).length;
    const hasTransfer = list.filter((card) => /transfer|变式|迁移|similar|changed/i.test(`${card.question || ''} ${card.answer || ''}`)).length;
    const hasWrongCause = list.filter((card) => /wrong|cause|错因|误区|trap|careless/i.test(`${card.cardType || ''} ${card.question || ''} ${card.answer || ''}`)).length;
    const checks = [
      { id: 'question', label: '回忆题明确', ready: hasQuestion >= 2, value: hasQuestion },
      { id: 'answer', label: '核对内容可用', ready: hasAnswer >= 2, value: hasAnswer },
      { id: 'wrong_cause', label: '看到了卡点', ready: hasWrongCause >= 1, value: hasWrongCause },
      { id: 'transfer', label: '有迁移检查', ready: hasTransfer >= 1, value: hasTransfer },
      { id: 'coverage', label: '核心覆盖', ready: (coverage || []).length >= 2, value: (coverage || []).length }
    ];
    const ready = checks.filter((item) => item.ready).length;
    return {
      title: '关卡质量门',
      score: Math.min(100, Math.round((ready / checks.length) * 70) + Math.round((score || 0) * 0.3)),
      readyCount: ready,
      totalCount: checks.length,
      statusLabel: ready >= 4 ? '可导入复习' : '继续补材料',
      label: ready >= 4
        ? '这套关卡可以导入复习，并生成本机学习记录。'
        : '材料还不够稳定，先别当成正式关卡。',
      checks,
      next: ready >= 4
        ? '导入复习，再做一次小测和复盘摘要。'
        : '补上具体错步、一个对比例题和一道举一反三。'
    };
  },

  buildStudioStudyPack(cards, raw, type, score) {
    const lines = String(raw || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      return {
        title: '轻练习输出',
        summary: '粘贴真实学习材料后，这里会显示生成结果。',
        outputs: [],
        proofLine: '还没有材料，暂不生成复盘摘要。'
      };
    }
    const first = lines[0];
    const second = lines[1] || first;
    const cardCount = (cards || []).length;
    const quizCount = cardCount ? Math.min(8, cardCount + 2) : 0;
    const typeLabel = {
      class_notes: '课堂笔记',
      ppt: 'PPT 提纲',
      video: '视频文字',
      wrong_cause: '卡点记录'
    }[type] || '学习材料';
    return {
      title: '轻练习输出',
      summary: `${typeLabel} -> ${cardCount} 张卡 -> ${quizCount} 道小测 -> 后续复习 -> 复盘摘要。`,
      outputs: [
        {
          id: 'knowledge',
          title: '知识卡',
          value: cardCount,
          body: `提炼核心方法：${first.slice(0, 42)}`
        },
        {
          id: 'wrong_cause',
          title: '卡点卡',
          value: Math.ceil(cardCount / 2),
          body: `追问具体错步，而不是只说粗心：${second.slice(0, 38)}`
        },
        {
          id: 'quiz',
          title: '小测验',
          value: quizCount,
          body: '混合回忆、填空、迁移和一次闭卷解释。'
        },
        {
          id: 'review',
          title: '复习计划',
          value: cardCount ? '已排' : '待排',
          body: '根据导入的卡片安排后续复习，负担保持小。'
        },
        {
          id: 'proof',
          title: '复盘摘要',
          value: score || 0,
          body: '记录今晚学了什么、别怎么错、什么算掌握证据。'
        }
      ],
      proofLine: `复盘摘要：这套关卡应帮助孩子讲清一个方法、说出一个卡点、完成一次小测，并进入间隔复习。已具备 ${cardCount ? Math.min(5, Math.max(1, Math.ceil(cardCount / 2))) : 0}/5 个导入条件。`
    };
  },

  buildLearningRevolutionBoard(state, reviewSummary, factoryPacks) {
    const subject = state.subject || 'Math';
    const weak = ((state.weak_points || [])[0] || {}).name || 'first weak point';
    const due = Number(reviewSummary.due || 0);
    return {
      title: '家庭作业卡点闭环',
      label: '晚间作业的参考路径：先看卡点、材料转回忆、先保护思考再给帮助。',
      promise: '不承诺结果，只承诺更紧的学习闭环：更少盲目任务、更多主动回忆、更安全的辅导。',
      quickDiagnostic: {
        title: '三问先看第一步',
        body: `围绕 ${subject} 做三次检查：前置基础、方法步骤、迁移应用。结果直接进入今晚安排和必须做。`,
        metric: weak,
        action: 'diagnosis'
      },
      materialEngine: [
        { id: 'youtube', name: '视频/讲解', status: '可接 API', output: '摘要 -> 卡片 -> 测验' },
        { id: 'pdf', name: 'PDF/教材', status: '可接 API', output: '考点 -> 陷阱 -> 复习' },
        { id: 'ppt', name: 'PPT/课堂笔记', status: '可接 API', output: '重点 -> 卡组' },
        { id: 'handwriting', name: '手写笔记', status: '当前手动', output: '照片笔记 -> 结构化卡片' }
      ],
      antiDependence: [
        '先问后讲：孩子必须先给出第一想法。',
        '先看卡点：不能只用“粗心”当结论。',
        '阻断抄答：一旦直接要最终结果，就退回检查点。',
        '只看掌握证据：展示自己能复述什么，不展示长聊天记录。'
      ],
      actions: [
        { id: 'snap', label: '开始3题快照', action: 'diagnosis' },
        { id: 'pack', label: '粘贴真实材料', action: 'focus_factory_input' },
        { id: 'review', label: '开始回忆循环', action: 'review' },
        { id: 'tutor', label: '使用安全辅导', action: 'tutor' }
      ],
      scorecard: [
        { id: 'speed', label: '定位速度', value: '3 次检查' },
        { id: 'material', label: '材料格式', value: '4 条路径' },
        { id: 'memory', label: '复习负载', value: `${due} 张到期` },
        { id: 'safety', label: '思考保护', value: '开启' }
      ],
      factoryReady: (factoryPacks || []).length
    };
  },

  buildLaunchPlaybook(adaptivePath, reviewSummary, factoryPacks) {
    const current = adaptivePath.current || null;
    const firstPack = (factoryPacks || [])[0] || null;
    return {
      title: '可交付轻练习',
      label: '首次体验就跑通：一个卡点、一轮作业点拨、一组知识卡、一周轻回访。',
      score: reviewSummary.maturity ? reviewSummary.maturity.overall : 0,
      cards: [
        {
          id: 'method',
          title: '学习方法',
          body: current ? current.title : '先从方法库里选一个聚焦模块。',
          metric: current ? `适配 ${current.score}` : '可用'
        },
        {
          id: 'content',
          title: '内容回访包',
          body: firstPack ? firstPack.title : '从作业、试卷或学习反馈生成卡片。',
          metric: firstPack ? `${firstPack.minutes} 分钟` : '本地'
        },
        {
          id: 'memory',
          title: '长期记忆安排',
          body: reviewSummary.cramPlan ? reviewSummary.cramPlan.label : '到期卡、主动回忆和卡点修复已经串起来。',
          metric: `${reviewSummary.due || 0} 张到期`
        },
        {
          id: 'proof',
          title: '学习验收证据',
          body: '用完成证据和小测表现生成自己能看懂的周报。',
          metric: `${reviewSummary.quizLoop ? reviewSummary.quizLoop.accuracy : 0}% 准度`
        }
      ]
    };
  },

  openTool(event) {
    const index = event.currentTarget.dataset.index;
    const item = this.data.tools[index];
    if (!item) return;
    navigation.navigateLearningRoute(item.path);
  },

  setFilter(event) {
    const filter = event.currentTarget.dataset.filter || ALL_FILTER;
    const all = learningModules.listModules();
    this.setData({
      activeFilter: filter,
      visibleModules: filter === ALL_FILTER ? all : all.filter((item) => item.subject === filter)
    });
  },

  openModule(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/module/module?id=${id}&source=tools_library` });
  },

  startCurrentModule() {
    const item = this.data.currentModule;
    const homework = learningModules.toHomework(item);
    if (!item || !homework) {
      wx.showToast({ title: '还没有可用关卡', icon: 'none' });
      return;
    }
    const next = storage.trackModuleEvent('module_started', item, { source: 'tools_cockpit' });
    api.submitEvent(next[0]).catch(() => {});
    storage.set(storage.KEYS.selectedHomework, homework);
    storage.set(storage.KEYS.selectedHomeworkSource, `module:${item.id}`);
    storage.set(storage.KEYS.tutorMessages, [
      {
        role: 'assistant',
        text: `开始轻练习：${item.title}。${item.tutorPrompt}`
      }
    ]);
    navigation.navigateLearningRoute('/pages/tutor/tutor?from=tools_module');
  },

  addCurrentReviewPack() {
    const item = this.data.currentModule;
    const pack = learningModules.toReviewPack(item);
    if (!item || !pack) {
      wx.showToast({ title: '还没有复习包', icon: 'none' });
      return;
    }
    const result = reviewCards.importTextToDeck(pack.text, pack.options);
    const next = storage.trackModuleEvent('module_review_pack_imported', item, {
      source: 'tools_cockpit',
      imported: result.imported || 0,
      skipped: result.skipped || 0
    });
    api.submitEvent(next[0]).catch(() => {});
    this.setData({
      cockpitMessage: result.imported
        ? `已导入 ${result.imported} 张复习卡。`
        : '这组关卡已经有复习卡。'
    });
    this.refresh();
  },

  importFactoryPack(event) {
    const id = event.currentTarget.dataset.id;
    const pack = (this.data.factoryPacks || []).find((item) => item.id === id);
    if (!pack) return;
    const result = reviewCards.importTextToDeck(pack.text, pack.options);
    this.setData({
      cockpitMessage: result.imported
        ? `已从「${pack.title}」导入 ${result.imported} 张卡。`
        : `「${pack.title}」已经在复习队列里。`
    });
    this.refresh();
  },

  onFactoryStudioInput(event) {
    const factoryStudioInput = event.detail.value;
    const state = visibleLearningState();
    this.setData({
      factoryStudioInput,
      factoryStudioRemotePlan: null,
      factoryStudioPlan: this.buildFactoryStudioPlan(factoryStudioInput, this.data.factoryStudioType, state)
    });
  },

  setFactoryStudioType(event) {
    const factoryStudioType = event.currentTarget.dataset.type || 'class_notes';
    const state = visibleLearningState();
    this.setData({
      factoryStudioType,
      factoryStudioRemotePlan: null,
      factoryStudioPlan: this.buildFactoryStudioPlan(this.data.factoryStudioInput, factoryStudioType, state)
    });
  },

  setFactoryStudioMode(event) {
    const factoryStudioMode = event.currentTarget.dataset.mode || 'text';
    this.setData({ factoryStudioMode });
  },

  chooseFactoryMaterial() {
    const applyFiles = (files) => {
      const count = (files || []).length;
      if (!count) return;
      const hint = `已选择 ${count} 份材料。请在这里补一句：这份材料主要讲什么、孩子卡在哪里。`;
      const factoryStudioInput = this.data.factoryStudioInput || hint;
      this.setData({
        factoryStudioInput,
        factoryStudioMode: 'text',
        factoryStudioRemotePlan: null,
        factoryStudioPlan: this.buildFactoryStudioPlan(factoryStudioInput, this.data.factoryStudioType, visibleLearningState()),
        factoryStudioStatus: '材料已放入轻回访入口，补一句卡点后生成更准。'
      });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 4,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => applyFiles(res.tempFiles || [])
      });
      return;
    }
    wx.chooseImage({
      count: 4,
      sourceType: ['album', 'camera'],
      success: (res) => applyFiles((res.tempFilePaths || []).map((item) => ({ tempFilePath: item })))
    });
  },

  runFactoryStudioRemote() {
    const text = String(this.data.factoryStudioInput || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴学习材料', icon: 'none' });
      return;
    }
    const state = visibleLearningState();
    const profile = storage.loadProfile();
    this.setData({ factoryStudioStatus: '正在生成轻练习...' });
    api.buildContentCards({
      text,
      subject: profile.subject || '',
      weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
      calibrationKey: `studio:${this.data.factoryStudioType}`,
      inputType: this.data.factoryStudioType
    }).then((result) => {
      if (!result || !Array.isArray(result.cards)) throw new Error('content_engine_failed');
      const imported = reviewCards.importGeneratedCards(result.cards, {
        source: `factory_remote_${this.data.factoryStudioType}`,
        subject: profile.subject || '',
        weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
        calibrationKey: `studio:${this.data.factoryStudioType}`
      });
      if (storage.appendFactoryEvent) {
        storage.appendFactoryEvent({
          event: 'factory_generated',
          input_type: this.data.factoryStudioType,
          provider: result.provider || 'remote_ai_content_engine_v1',
          card_count: result.count || result.cards.length || 0,
          quality_score: result.quality_gate ? Number(result.quality_gate.score || 0) : 0,
          imported: imported.imported || 0
        });
      }
      const remotePlan = Object.assign({}, this.data.factoryStudioPlan || {}, {
        rawText: text,
        inputType: this.data.factoryStudioType,
        provider: result.provider || 'remote_ai_content_engine_v1',
        score: result.quality_gate ? Number(result.quality_gate.score || 0) : (this.data.factoryStudioPlan && this.data.factoryStudioPlan.score) || 0,
        cards: (result.cards || []).slice(0, 6),
        diagnostics: (result.coveredTypes || []).map((type) => ({ type, label: type, count: 1 })),
        studyPack: result.study_pack || (this.data.factoryStudioPlan && this.data.factoryStudioPlan.studyPack),
        qualityGate: result.quality_gate || (this.data.factoryStudioPlan && this.data.factoryStudioPlan.qualityGate)
      });
      this.setData({
        factoryStudioStatus: imported.imported
          ? `远程引擎已导入 ${imported.imported} 张卡。`
          : '远程引擎没有发现新卡。',
        factoryStudioRemotePlan: remotePlan,
        factoryStudioPlan: remotePlan,
        cockpitMessage: imported.imported
          ? `已从远程内容引擎导入 ${imported.imported} 张卡。`
          : '远程内容引擎没有返回新卡。'
      });
      this.refresh();
    }).catch(() => {
      const imported = reviewCards.importTextToDeck(text, {
        subject: profile.subject || '',
        weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
        calibrationKey: `studio:${this.data.factoryStudioType}`,
        source: `factory_studio_${this.data.factoryStudioType}`
      });
      if (storage.appendFactoryEvent) {
        storage.appendFactoryEvent({
          event: 'factory_generated',
          input_type: this.data.factoryStudioType,
          provider: 'rule_content_engine_v2',
          card_count: (this.data.factoryStudioPlan && this.data.factoryStudioPlan.cards && this.data.factoryStudioPlan.cards.length) || 0,
          quality_score: (this.data.factoryStudioPlan && this.data.factoryStudioPlan.qualityGate && this.data.factoryStudioPlan.qualityGate.score) || 0,
          imported: imported.imported || 0
        });
      }
      this.setData({
        factoryStudioStatus: imported.imported
          ? `本地引擎已导入 ${imported.imported} 张卡。`
          : '本地引擎没有发现新卡。'
      });
      this.refresh();
    });
  },

  importFactoryStudioPreview() {
    const text = String(this.data.factoryStudioInput || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴学习材料', icon: 'none' });
      return;
    }
    const state = visibleLearningState();
    const profile = storage.loadProfile();
    const plan = this.data.factoryStudioPlan || this.buildFactoryStudioPlan(text, this.data.factoryStudioType, state);
    const imported = reviewCards.importTextToDeck(text, {
      subject: profile.subject || '',
      weakPoint: (((state || {}).weak_points || [])[0] || {}).name || this.data.factoryStudioType,
      calibrationKey: `studio:${this.data.factoryStudioType}`,
      source: `factory_preview_${this.data.factoryStudioType}`
    });
    if (storage.appendFactoryEvent) {
      storage.appendFactoryEvent({
        event: 'factory_generated',
        input_type: this.data.factoryStudioType,
        provider: 'local_preview_import',
        card_count: (plan.cards && plan.cards.length) || 0,
        quality_score: (plan.qualityGate && plan.qualityGate.score) || plan.score || 0,
        imported: imported.imported || 0
      });
    }
    this.setData({
      factoryStudioStatus: imported.imported
        ? `轻练习已导入 ${imported.imported} 张卡。`
        : '轻练习已经在复习里。',
      cockpitMessage: imported.imported
        ? `轻练习已导入 ${imported.imported} 张复习卡。`
        : '轻练习已经导入过。'
    });
    this.refresh();
  },

  importFactoryStudioAndReview() {
    const text = String(this.data.factoryStudioInput || '').trim();
    if (text) {
      this.importFactoryStudioPreview();
    }
    navigation.navigateLearningRoute('/pages/review/review?from=tools');
  },

  importFactoryStudioAndArcade() {
    const text = String(this.data.factoryStudioInput || '').trim();
    if (text) {
      this.importFactoryStudioPreview();
    }
    navigation.navigateLearningRoute('/pages/arcade/arcade?from=tools_pack');
  },

  runRevolutionAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'diagnosis') {
      wx.navigateTo({ url: '/pages/diagnosis/diagnosis' });
      return;
    }
    if (action === 'review') {
      navigation.navigateLearningRoute('/pages/review/review?from=tools');
      return;
    }
    if (action === 'tutor') {
      navigation.navigateLearningRoute('/pages/tutor/tutor?from=tools_revolution');
      return;
    }
    if (action === 'focus_factory_input') {
      this.setData({
        factoryStudioMode: 'text',
        factoryStudioInput: '',
        factoryStudioRemotePlan: null,
        factoryStudioStatus: '请粘贴真实学习材料后再生成轻练习。'
      });
      wx.pageScrollTo({ scrollTop: 0, duration: 220 });
    }
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review?from=tools');
  },

  goArcade() {
    navigation.navigateLearningRoute('/pages/arcade/arcade?from=tools');
  },

  goFirstStep() {
    navigation.navigateLearningRoute('/pages/tutor/tutor?from=tools_empty_revisit');
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goTools() {
    navigation.navigateLearningRoute('/pages/tools/tools');
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
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

  runPublicK12ContentOps(event) {
    const dataset = event.currentTarget.dataset || {};
    const panel = this.data.publicK12ContentOps || {};
    const route = dataset.route || panel.primaryRoute || '/pages/upload/upload';
    navigation.navigateLearningRoute(route);
  },

  runPublicK12ChallengeSeed(event) {
    const dataset = event.currentTarget.dataset || {};
    const route = dataset.route || '/pages/tutor/tutor?from=public_k12_seed';
    if (storage.appendReviewEvent) {
      storage.appendReviewEvent({
        eventType: 'public_k12_seed_selected',
        source: 'tools_public_k12_content_ops',
        sourceChallengeId: dataset.challengeId || '',
        subject: dataset.subject || '',
        taskType: dataset.taskType || '',
        route,
        reviewRoute: dataset.reviewRoute || '/pages/review/review?from=public_k12_seed',
        firstStepRequired: dataset.firstStepGate || '孩子能说出第一步',
        releaseGate: 'own_material_first_step_before_ai_rewrite',
        blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue']
      });
    }
    navigation.navigateLearningRoute(route);
  },

});
