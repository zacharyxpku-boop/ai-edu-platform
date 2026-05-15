const priority = require('./learning-priority');
let learningReport = null;

try {
  learningReport = require('./learning-report');
} catch (error) {
  learningReport = null;
}

let gameLogic = null;
try {
  gameLogic = require('./game-logic');
} catch (error) {
  gameLogic = {
    updateStreak(profile = {}, options = {}) {
      const reviewedToday = Number(options.reviewedToday || 0);
      const today = new Date(options.now || new Date()).toISOString().slice(0, 10);
      if (reviewedToday <= 0) return profile;
      const last = profile.last_study_date || '';
      const streak = last === today ? Number(profile.streak || 1) : Number(profile.streak || 0) + 1;
      return Object.assign({}, profile, {
        streak,
        best_streak: Math.max(Number(profile.best_streak || 0), streak),
        last_study_date: today
      });
    },
    checkAndUnlockAchievements(stats = {}) {
      const current = Array.isArray(stats.achievements) ? stats.achievements : [];
      const next = Number(stats.review_count || 0) >= 1 && current.indexOf('first_review') < 0
        ? current.concat(['first_review'])
        : current;
      return { achievements: next, newlyUnlocked: next.length > current.length ? [{ id: 'first_review' }] : [], coinsAwarded: next.length > current.length ? 20 : 0 };
    }
  };
}

const KEYS = {
  state: 'ydzx.priority.state.v1',
  selectedHomework: 'ydzx.selected.homework.v1',
  selectedHomeworkSource: 'ydzx.selected.homework.source.v1',
  taskDraft: 'ydzx.task.draft.v1',
  profile: 'ydzx.profile.v1',
  consent: 'ydzx.guardian.consent.v1',
  session: 'ydzx.mini.session.v1',
  tutorMessages: 'ydzx.tutor.messages.v1',
  feedback: 'ydzx.feedback.v1',
  moduleEvents: 'ydzx.module.events.v1',
  moduleFeedback: 'ydzx.module.feedback.v1',
  tutorEvents: 'ydzx.tutor.events.v1',
  pilotRuns: 'ydzx.pilot.runs.v1',
  factoryEvents: 'ydzx.factory.events.v1',
  thinkingReceipts: 'ydzx.thinking.receipts.v1',
  reviewDeck: 'ydzx.review.deck.v1',
  reviewNotes: 'ydzx.review.notes.v1',
  reviewCards: 'ydzx.review.cards.v1',
  reviewEvents: 'ydzx.review.events.v1',
  gameProfile: 'ydzx.game.profile.v1',
  gamePurchases: 'ydzx.game.purchases.v1',
  shareRuns: 'ydzx.share.runs.v1',
  parentGoal: 'ydzx.parent.goal.v1',
  todayFocus: 'ydzx.today.focus.v1',
  tonightPlan: 'ydzx.tonight.plan.v1',
  incomingShare: 'ydzx.share.incoming.v1',
  clientIdentity: 'ydzx.client.identity.v1',
  syncState: 'ydzx.sync.state.v1',
  syncQueue: 'ydzx.sync.queue.v1',
  reviewLoop: 'ydzx.review.loop.v1',
  companionPreference: 'ydzx.companion.preference.v1',
  firstStepProfile: 'ydzx.first.step.profile.v1',
  taskTypePattern: 'ydzx.task.type.pattern.v1',
  parentInterventionLog: 'ydzx.parent.intervention.log.v1',
  scaffoldingChains: 'ydzx.scaffolding.chains.v1',
  lightFeatureEvents: 'ydzx.light.feature.events.v1',
  experienceChecklist: 'ydzx.experience.checklist.v1',
  validationSprint: 'ydzx.validation.sprint.v1',
  betaTester: 'ydzx.beta.tester.v1',
  localUserId: 'ydzx.local.user.id.v1',
  localAnalytics: 'ydzx.local.analytics.v1',
  firstRunGuide: 'ydzx.first.run.guide.v1',
  inviteLedger: 'ydzx.invite.ledger.v1',
  localFeedback: 'ydzx.local.feedback.v1',
  todaySession: 'ydzx.today.session.v1',
  learningReport: 'ydzx.learning.report.v1',
  localBackup: 'ydzx.local.backup.v1'
};

const COMPANION_OPTIONS = [
  {
    id: 'gudian',
    label: '咕点',
    short: '先动一小步',
    desc: '我懂你卡住了，我陪你先迈出第一步',
    copy: {
      home: '咕点陪你先找今晚第一步。',
      review: '咕点陪你只修这一小步，不讲完整答案。',
      tools: '咕点陪你轻轻回访昨天那一步。',
      profile: '咕点帮你整理成家长能看懂的一句话。'
    }
  }
];

const INTERNAL_LABELS = {
  home_xiaodian_entry: '作业点拨入口',
  home_route_cta: '今晚路线入口',
  home_top_must: '今晚关键任务',
  auto_first_must: '今晚第一项任务',
  quick_start_auto: '快速开始',
  radar_first_must: '今晚安排建议',
  needs_student_step: '等孩子先说第一步',
  thinking_started: '已经开始说想法',
  needs_repair: '需要修这一小步',
  blocked_answer_request: '先说第一步',
  ready_for_parent_review: '可以整理给家长看',
  method_summary_ready: '可以总结方法',
  read_problem: '读懂题目',
  write_first_step: '说第一步',
  find_direction: '找方向',
  find_conditions: '找条件',
  explain_misconception: '说错因',
  similar_example: '做小变式',
  method_summary: '总结方法',
  fast_mode: '快一点看方向',
  transfer: '举一反三',
  review: '轻回访',
  today_focus: '今天修过的卡点',
  thinking_receipt: '思路记录',
  homework_plan: '今晚路线',
  tutor: '作业点拨',
  module: '学习关卡',
  manual_import: '手动整理',
  remote_ai_content_engine_v1: '学习材料整理',
  rule_content_engine_v2: '本地材料整理'
};

const ROUTE_STAGE_LABELS = {
  plan: '排顺序',
  first_step: '说第一步',
  repair: '修卡点',
  review: '轻回访',
  parent: '整理给家长看'
};

const ISSUE_TYPE_LABELS = {
  '读题卡住': '读懂题目在问什么',
  '读题审题': '读懂题目在问什么',
  '概念不清': '概念和公式选择',
  '概念公式': '概念和公式选择',
  '步骤断点': '第一步怎么开始',
  '列式关系': '列式和关系',
  '计算粗心': '计算检查',
  '表达不完整': '写清解题过程',
  '思路卡点': '先说第一步',
  '卡点': '今天最卡的一步'
};

const COMPANION_STRIP_COPY = {
  gudian: '我懂你卡住了，我陪你先迈出第一步。'
};

const STAGE_ALIASES = {
  home: 'home_plan',
  plan: 'home_plan',
  stuck: 'home_stuck',
  review: 'review_focus',
  repair: 'review_repairing',
  completed: 'review_completed',
  tools: 'tools_recall',
  recall: 'tools_recall',
  profile: 'profile_summary',
  parent: 'parent_question'
};

const COMPANION_STAGE_COPY = {
  gudian: {
    home_plan: '咕点陪你先找今晚第一步。',
    home_stuck: '咕点懂你卡住了，我们先说清入口。',
    review_focus: '咕点陪你只修这一小步，不讲完整答案。',
    review_repairing: '咕点陪你先看第一眼，再说出自己的第一步。',
    review_completed: '咕点帮你记下这一小步，明天轻轻回访。',
    tools_recall: '咕点陪你轻轻回访昨天那一步。',
    tools_empty: '还没有回访卡。先修过一小步，明天咕点再来轻轻看。',
    profile_summary: '咕点帮你整理成家长能看懂的一句话。',
    profile_empty: '完成一次卡点修复后，咕点会整理给家长看。',
    parent_question: '咕点建议家长只问一句：这题第一步先看哪里？',
    next_step: '咕点陪你走下一步：先把当前这一步理顺。'
  }
};

function isInternalKey(value) {
  return /^[a-z]+(?:_[a-z0-9]+)+$/.test(String(value || ''));
}

function stripPrefixLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const colonIndex = text.indexOf(':');
  if (colonIndex > 0 && isInternalKey(text.slice(0, colonIndex))) {
    return text.slice(colonIndex + 1).trim();
  }
  if (text.indexOf('module:') === 0) return '学习关卡';
  if (text.indexOf('review:') === 0) return '复习回访';
  if (text.indexOf('arcade:') === 0) return '轻回访';
  if (text.indexOf('factory_') === 0 || text.indexOf('factory:') === 0) return '学习材料整理';
  return text;
}

function formatInternalLabel(value, fallback = '先说第一步') {
  const text = stripPrefixLabel(value);
  if (!text) return fallback;
  if (INTERNAL_LABELS[text]) return INTERNAL_LABELS[text];
  if (ISSUE_TYPE_LABELS[text]) return ISSUE_TYPE_LABELS[text];
  if (isInternalKey(text)) return fallback;
  return text;
}

function formatSourceLabel(value, fallback = '今晚路线') {
  return formatInternalLabel(value, fallback);
}

function formatIssueType(value, fallback = '今天最卡的一步') {
  const text = stripPrefixLabel(value);
  if (!text) return fallback;
  if (ISSUE_TYPE_LABELS[text]) return ISSUE_TYPE_LABELS[text];
  if (INTERNAL_LABELS[text]) return INTERNAL_LABELS[text];
  if (isInternalKey(text)) return fallback === '今天最卡的一步' ? '先说第一步' : fallback;
  return text;
}

function formatRouteStage(value, fallback = '今晚路线') {
  const text = stripPrefixLabel(value);
  if (!text) return fallback;
  return ROUTE_STAGE_LABELS[text] || formatInternalLabel(text, fallback);
}

function companionById(id) {
  return COMPANION_OPTIONS.find((item) => item.id === id) || COMPANION_OPTIONS[0];
}

function buildCompanionPreference(input) {
  const selectedId = typeof input === 'string' ? input : input && input.selectedCompanion;
  const companion = companionById(selectedId);
  return Object.assign({}, input && typeof input === 'object' ? input : {}, {
    selectedCompanion: companion.id,
    selectedLabel: companion.label,
    updated_at: input && input.updated_at ? input.updated_at : new Date().toISOString()
  });
}

const memoryStore = {};
let nativeStorageAvailable = true;

function rawGet(key, fallback) {
  if (!nativeStorageAvailable) {
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
  }
  try {
    const value = wx.getStorageSync(key);
    if (value !== undefined && value !== null && value !== '') {
      memoryStore[key] = value;
      return value;
    }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
  } catch (error) {
    nativeStorageAvailable = false;
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
  }
}

function rawSet(key, value) {
  memoryStore[key] = value;
  if (!nativeStorageAvailable) return value;
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    nativeStorageAvailable = false;
  }
  return value;
}

function rawRemove(key) {
  delete memoryStore[key];
  if (!nativeStorageAvailable) return;
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    nativeStorageAvailable = false;
  }
}

function createLocalUserId() {
  const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `user_${Date.now()}_${suffix}`;
}

function ensureLocalUserId() {
  const existing = rawGet(KEYS.localUserId, '');
  if (existing && String(existing).indexOf('user_') === 0) return existing;
  return rawSet(KEYS.localUserId, createLocalUserId());
}

function getLocalUserId() {
  return ensureLocalUserId();
}

function getUserKey(key) {
  const raw = String(key || '');
  if (!raw || raw === KEYS.localUserId) return raw;
  if (raw.indexOf('ydzx.') !== 0) return raw;
  return `${ensureLocalUserId()}:${raw}`;
}

function get(key, fallback) {
  return rawGet(getUserKey(key), fallback);
}

function set(key, value) {
  return rawSet(getUserKey(key), value);
}

function remove(key) {
  rawRemove(getUserKey(key));
}

function clearLearningData() {
  createLocalBackup('before_clear_learning_data');
  [
    KEYS.state,
    KEYS.selectedHomework,
    KEYS.selectedHomeworkSource,
    KEYS.taskDraft,
    KEYS.profile,
    KEYS.consent,
    KEYS.tutorMessages,
    KEYS.session,
    KEYS.feedback,
    KEYS.moduleEvents,
    KEYS.moduleFeedback,
    KEYS.tutorEvents,
    KEYS.pilotRuns,
    KEYS.factoryEvents,
    KEYS.thinkingReceipts,
    KEYS.reviewDeck,
    KEYS.reviewNotes,
    KEYS.reviewCards,
    KEYS.reviewEvents,
    KEYS.gameProfile,
    KEYS.gamePurchases,
    KEYS.shareRuns,
    KEYS.parentGoal,
    KEYS.todayFocus,
    KEYS.tonightPlan,
    KEYS.incomingShare,
    KEYS.syncState,
    KEYS.syncQueue,
    KEYS.reviewLoop,
    KEYS.companionPreference,
    KEYS.firstStepProfile,
    KEYS.taskTypePattern,
    KEYS.parentInterventionLog,
    KEYS.scaffoldingChains,
    KEYS.lightFeatureEvents,
    KEYS.experienceChecklist,
    KEYS.validationSprint,
    KEYS.betaTester,
    KEYS.localAnalytics,
    KEYS.firstRunGuide,
    KEYS.inviteLedger,
    KEYS.localFeedback,
    KEYS.todaySession,
    KEYS.learningReport
  ].forEach(remove);
}

function loadLocalAnalytics() {
  return Object.assign({ version: 1, events: [], counters: {} }, get(KEYS.localAnalytics, {}));
}

function recordLocalAnalytics(node, payload = {}) {
  const name = String(node || '').trim();
  if (!name) return null;
  const state = loadLocalAnalytics();
  const event = Object.assign({
    id: `analytics_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    node: name,
    createdAt: new Date().toISOString(),
    localUserId: getLocalUserId()
  }, payload || {});
  const counters = Object.assign({}, state.counters || {});
  counters[name] = Number(counters[name] || 0) + 1;
  const next = Object.assign({}, state, {
    events: [event].concat(state.events || []).slice(0, 800),
    counters,
    updatedAt: event.createdAt
  });
  set(KEYS.localAnalytics, next);
  return event;
}

function localAnalyticsDashboard() {
  const state = loadLocalAnalytics();
  const counters = state.counters || {};
  const nodes = [
    'light_entry_completed',
    'core_loop_entered',
    'first_step_confirmed',
    'focus_started',
    'focus_completed',
    'profile_viewed',
    'service_intent_clicked'
  ];
  return {
    localUserId: getLocalUserId(),
    totalEvents: (state.events || []).length,
    nodes: nodes.map((node) => ({ node, count: Number(counters[node] || 0) })),
    counters
  };
}

function isFirstTime() {
  return !get(KEYS.firstRunGuide, null);
}

function markFirstRunGuideSeen() {
  return set(KEYS.firstRunGuide, { seen: true, seenAt: new Date().toISOString() });
}

function loadInviteLedger() {
  return Object.assign({ invites: [], count: 0 }, get(KEYS.inviteLedger, {}));
}

function recordInvite(payload = {}) {
  const ledger = loadInviteLedger();
  const event = Object.assign({
    id: `invite_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ref: getLocalUserId(),
    path: `/pages/home/home?ref=${getLocalUserId()}`,
    createdAt: new Date().toISOString()
  }, payload || {});
  const invites = [event].concat(ledger.invites || []).slice(0, 100);
  return set(KEYS.inviteLedger, { invites, count: invites.length, updatedAt: event.createdAt });
}

function loadLocalFeedback() {
  const list = get(KEYS.localFeedback, []);
  return Array.isArray(list) ? list : [];
}

function saveLocalFeedback(payload = {}) {
  const text = String(payload.text || '').trim();
  const event = Object.assign({
    id: `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    page: payload.page || 'unknown',
    text,
    createdAt: new Date().toISOString()
  }, payload || {}, { text });
  return set(KEYS.localFeedback, [event].concat(loadLocalFeedback()).slice(0, 100));
}

function loadCompanionPreference() {
  return buildCompanionPreference(get(KEYS.companionPreference, {
    selectedCompanion: 'gudian',
    selectedLabel: '咕点',
    updated_at: ''
  }));
}

function saveCompanionPreference(input) {
  return set(KEYS.companionPreference, buildCompanionPreference(input));
}

function normalizeCompanionStage(stage) {
  const text = String(stage || '').trim();
  return STAGE_ALIASES[text] || text || 'home_plan';
}

function resolveCompanionStageArgs(first, second) {
  const firstText = String(first || '').trim();
  const secondText = String(second || '').trim();
  if (companionById(firstText).id === firstText && secondText) {
    return {
      stage: secondText,
      preference: buildCompanionPreference(firstText)
    };
  }
  return {
    stage: firstText,
    preference: second
  };
}

function companionCopyFor(stage, preference) {
  const normalizedStage = normalizeCompanionStage(stage);
  const pref = preference || loadCompanionPreference();
  const companion = companionById(pref.selectedCompanion);
  const voice = COMPANION_STAGE_COPY[companion.id] || COMPANION_STAGE_COPY.gudian;
  return voice[normalizedStage] || voice.home_plan;
}

function getCompanionStageCopy(stageOrCompanion, preferenceOrStage) {
  const args = resolveCompanionStageArgs(stageOrCompanion, preferenceOrStage);
  return companionCopyFor(args.stage, args.preference);
}

function formatCompanionLine(preference) {
  const pref = typeof preference === 'string'
    ? buildCompanionPreference(preference)
    : (preference || loadCompanionPreference());
  const companion = companionById(pref.selectedCompanion);
  return `${companion.label}：${COMPANION_STRIP_COPY[companion.id] || COMPANION_STRIP_COPY.gudian}`;
}

function currentGrowthMemory() {
  const focus = loadTodayFocus && loadTodayFocus();
  const cards = loadReviewCards && loadReviewCards();
  const focusCards = (Array.isArray(cards) ? cards : []).filter((card) => {
    return card && (card.source === 'today_focus' || card.sourceFocusId || card.issueType || card.weakPoint);
  });
  const latestCard = focusCards[0] || {};
  const rawIssueType = (focus && focus.issueType) || latestCard.issueType || latestCard.calibrationKey || '';
  const rawStuckPoint = (focus && focus.title) || latestCard.weakPoint || latestCard.title || latestCard.front || '';
  const issueType = formatIssueType(rawIssueType, '卡点');
  const stuckPoint = formatInternalLabel(rawStuckPoint, '第一步');
  return {
    hasMemory: !!(rawIssueType || rawStuckPoint || focusCards.length),
    issueType: issueType || '卡点',
    stuckPoint: stuckPoint || '第一步',
    sourceText: focus && (focus.sourceText || focus.thought),
    cardCount: focusCards.length
  };
}

function normalizeGrowthMemory(memory) {
  if (memory && typeof memory === 'object') {
    return Object.assign({
      hasMemory: !!(memory.issueType || memory.stuckPoint || memory.repeated || memory.topIssueType),
      issueType: formatIssueType(memory.issueType || memory.topIssueType || '', '第一步怎么开始'),
      stuckPoint: formatInternalLabel(memory.stuckPoint || memory.repeated || '', '第一步')
    }, memory);
  }
  return currentGrowthMemory();
}

function getGrowthMemoryLine(memory, companionInput) {
  const remembered = normalizeGrowthMemory(memory);
  if (!remembered.hasMemory) {
    return {
      empty: true,
      topIssueType: '积累中',
      repeated: '还没有重复卡点',
      oneLine: '本周还在积累卡点，先从今晚这一小步开始。',
      lines: ['本周还在积累卡点，先从今晚这一小步开始。'],
      tomorrowLine: ''
    };
  }
  const cardCount = Number(remembered.cardCount || 0);
  const isRepeated = cardCount >= 2 || remembered.repeatedCount >= 2 || remembered.hasRepeated === true;
  const companion = companionById((typeof companionInput === 'string'
    ? buildCompanionPreference(companionInput)
    : (companionInput || loadCompanionPreference())).selectedCompanion);
  const issue = formatIssueType(remembered.issueType, '先说第一步');
  const oneLine = isRepeated
    ? `最近常卡在：${issue}。咕点陪你先回来看这一小步。`
    : `今天记录到：${issue}。咕点先帮你留住这一小步。`;
  const tomorrowLine = '明天用 2 分钟再看一眼。';
  return {
    empty: false,
    topIssueType: formatIssueType(remembered.issueType, '第一步怎么开始'),
    repeated: formatInternalLabel(remembered.stuckPoint, '最近卡住的一步'),
    isRepeated,
    oneLine,
    lines: [oneLine, tomorrowLine],
    tomorrowLine
  };
}

function growthMemoryCopyFor(stage, preference) {
  const memory = currentGrowthMemory();
  if (!memory.hasMemory) {
    return '';
  }
  const companion = companionById((preference || loadCompanionPreference()).selectedCompanion);
  const id = companion.id;
  if (stage === 'home') {
    return getGrowthMemoryLine(memory, preference).oneLine;
  }
  if (stage === 'review') {
    return `你不是整题不会，只是卡在${memory.issueType}。对应修法：先说第一步，再做一道小变式。`;
  }
  if (stage === 'tools') {
    return '咕点陪你轻轻回访一下，不用一次做很多。';
  }
  if (stage === 'profile') {
    return getGrowthMemoryLine(memory, preference).oneLine;
  }
  return '';
}

function buildWeeklyGrowthMemory(preference) {
  const memory = currentGrowthMemory();
  const memoryLine = getGrowthMemoryLine(memory, preference);
  if (!memory.hasMemory) {
    return {
      title: '本周记得的一小步',
      topIssueType: memoryLine.topIssueType,
      repeated: memoryLine.repeated,
      oneLine: memoryLine.oneLine,
      lines: memoryLine.lines,
      tomorrowLine: memoryLine.tomorrowLine,
      empty: true,
      privacyLine: '只记录学习闭环需要的信息：今晚路线、卡点、回访卡和学习小结。'
    };
  }
  return {
    title: '本周记得的一小步',
    topIssueType: memoryLine.topIssueType,
    repeated: memoryLine.repeated,
    oneLine: memoryLine.oneLine,
    lines: memoryLine.lines,
    tomorrowLine: memoryLine.tomorrowLine,
    empty: false,
    privacyLine: '只记录学习闭环需要的信息：今晚路线、卡点、回访卡和学习小结。'
  };
}

function emptyLearningState() {
  return {
    source: '',
    grade: '',
    subject: '',
    score: 0,
    total_score: 0,
    weak_points: [],
    axes: [],
    homework_text: '',
    homework_plan: {
      must_do: [],
      flexible: [],
      can_skip: [],
      summary: {
        must_minutes: 0,
        saved_minutes: 0,
        misconception_count: 0
      }
    },
    weekly_review: null
  };
}

function loadState() {
  return get(KEYS.state, null) || emptyLearningState();
}

function saveState(state) {
  const saved = set(KEYS.state, Object.assign({}, state, { updated_at: new Date().toISOString() }));
  if (state) {
    appendSyncMutation('learning_state', {
      source: saved.source || '',
      grade: saved.grade || '',
      subject: saved.subject || '',
      weak_points: (saved.weak_points || []).slice(0, 8),
      homework_summary: saved.homework_plan && saved.homework_plan.summary
    });
  }
  return saved;
}

function loadProfile() {
  return get(KEYS.profile, {
    name: '',
    grade: '五年级',
    subject: '数学',
    minutes: 35
  });
}

function loadParentGoal() {
  return get(KEYS.parentGoal, {
    id: 'understand',
    label: '先讲懂',
    strategy: '先确认孩子是否理解，再决定要不要加练。',
    tutorMode: 'hint',
    reviewBias: 'balanced'
  });
}

function saveParentGoal(goal) {
  const saved = set(KEYS.parentGoal, Object.assign({
    id: 'understand',
    label: '先讲懂',
    strategy: '先确认孩子是否理解，再决定要不要加练。',
    tutorMode: 'hint',
    reviewBias: 'balanced'
  }, goal || {}));
  appendSyncMutation('parent_goal', {
    id: saved.id || '',
    label: saved.label || '',
    strategy: saved.strategy || '',
    tutor_mode: saved.tutorMode || '',
    review_bias: saved.reviewBias || ''
  });
  return saved;
}

function saveProfile(profile) {
  const saved = set(KEYS.profile, profile || {});
  appendSyncMutation('profile_update', {
    name: saved.name || '',
    grade: saved.grade || '',
    subject: saved.subject || '',
    minutes: Number(saved.minutes || 0)
  });
  return saved;
}

function defaultLearningReportState(nowInput = new Date()) {
  const now = new Date(sessionNowMs(nowInput));
  const iso = now.toISOString();
  return {
    reportDraft: {
      id: `learning_report_${iso.slice(0, 10).replace(/-/g, '')}`,
      title: '快速版学习画像',
      mode: 'fast',
      overview: {
        title: '学习画像总览',
        line: '先补一张成绩单或一段测评描述，咕点会先给出快速版画像。',
        evidence: ['当前还没有足够输入'],
        confidence: '低',
        missing: ['成绩单或手动分数']
      },
      capabilityTendencies: [],
      diagnosisMatrix: [],
      learningStyle: {
        id: 'style_tendency',
        label: '学习风格待确认',
        description: '补充一段测评或快测后，再看更合适的学习方式。',
        evidence: [],
        confidence: '低',
        missing: ['快速测评问卷']
      },
      rootCauses: [],
      recommendationPlan: {
        primaryModule: 'tutor',
        cta: {
          label: '先用咕点追问第一步',
          path: '/pages/tutor/tutor?from=learning_report',
          reason: '当前资料还不足，先从第一步开始最稳'
        },
        sevenDayPlan: [],
        parentLine: '家长先问一句：这一步你准备先看哪里？',
        childLine: '先把第一步说清楚。'
      },
      generatedAt: iso,
      missingItems: ['成绩单或手动分数', '年级/年龄/学校类型']
    },
    reportSources: [],
    recognitionDraft: null,
    reportProgress: {
      mode: 'fast',
      completeness: 0,
      label: '0% · 快速版',
      nextAction: '先补充一张成绩单或一段测评描述'
    },
    parsedScores: {},
    parsedRanks: {
      totalScore: null,
      totalRank: null,
      classRank: null,
      namedRanks: [],
      note: ''
    },
    profileBasics: {},
    behaviorSignals: {},
    emotionSignals: {},
    interestSignals: {},
    assessmentAnswers: [],
    capabilityTendencies: [],
    diagnosisMatrix: [],
    recommendationPlan: {
      primaryModule: 'tutor',
      cta: {
        label: '先用咕点追问第一步',
        path: '/pages/tutor/tutor?from=learning_report',
        reason: '当前资料还不足，先从第一步开始最稳'
      },
      sevenDayPlan: [],
      parentLine: '家长先问一句：这一步你准备先看哪里？',
      childLine: '先把第一步说清楚。',
      evidence: [],
      confidence: '低',
      missing: ['成绩单或手动分数']
    },
    reportCompleteness: 0,
    reportStatus: {
      state: 'draft',
      label: '可生成快速版',
      requiresConfirmation: true
    },
    lastSavedAt: iso
  };
}

function normalizeLearningReportState(input = {}, nowInput = new Date()) {
  const now = new Date(sessionNowMs(nowInput));
  const fallback = defaultLearningReportState(nowInput);
  const report = Object.assign({}, fallback, input || {});
  report.reportDraft = Object.assign({}, fallback.reportDraft, report.reportDraft || {});
  report.reportSources = Array.isArray(report.reportSources) ? report.reportSources : [];
  report.recognitionDraft = report.recognitionDraft && typeof report.recognitionDraft === 'object' ? report.recognitionDraft : null;
  report.reportProgress = Object.assign({}, fallback.reportProgress, report.reportProgress || {});
  report.parsedScores = Object.assign({}, report.parsedScores || {});
  report.parsedRanks = Object.assign({}, fallback.parsedRanks, report.parsedRanks || {});
  report.profileBasics = Object.assign({}, report.profileBasics || {});
  report.behaviorSignals = Object.assign({}, report.behaviorSignals || {});
  report.emotionSignals = Object.assign({}, report.emotionSignals || {});
  report.interestSignals = Object.assign({}, report.interestSignals || {});
  report.assessmentAnswers = Array.isArray(report.assessmentAnswers) ? report.assessmentAnswers : [];
  report.capabilityTendencies = Array.isArray(report.capabilityTendencies) ? report.capabilityTendencies : [];
  report.diagnosisMatrix = Array.isArray(report.diagnosisMatrix) ? report.diagnosisMatrix : [];
  report.recommendationPlan = Object.assign({}, fallback.recommendationPlan, report.recommendationPlan || {});
  report.reportCompleteness = Math.max(0, Math.min(100, Number(report.reportCompleteness || 0)));
  report.reportStatus = Object.assign({}, fallback.reportStatus, report.reportStatus || {});
  report.lastSavedAt = report.lastSavedAt || now.toISOString();
  return report;
}

function loadLearningReportState() {
  const state = get(KEYS.learningReport, null);
  return normalizeLearningReportState(state || {}, new Date());
}

function saveLearningReportState(nextState = {}, options = {}) {
  const nowInput = options.now || new Date();
  const normalized = normalizeLearningReportState(nextState, nowInput);
  if (learningReport && learningReport.buildLearningReportDraft && !options.skipBuild) {
    const built = learningReport.buildLearningReportDraft(Object.assign({}, normalized, options.input || {}));
    Object.assign(normalized, built);
    normalized.reportDraft = built.reportDraft || normalized.reportDraft;
  }
  normalized.lastSavedAt = nowInput.toISOString();
  const saved = set(KEYS.learningReport, normalized);
  appendSyncMutation('learning_report', {
    id: normalized.reportDraft && normalized.reportDraft.id ? normalized.reportDraft.id : `learning_report_${localDateString(nowInput)}`,
    completeness: Number(normalized.reportCompleteness || 0),
    mode: normalized.reportProgress && normalized.reportProgress.mode ? normalized.reportProgress.mode : 'fast',
    state: normalized.reportStatus && normalized.reportStatus.state ? normalized.reportStatus.state : 'draft',
    updated_at: normalized.lastSavedAt
  });
  return saved;
}

function saveLearningReportSource(source = {}, options = {}) {
  const current = loadLearningReportState();
  const normalizedSource = {
    id: source.id || `report_source_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: source.type || 'manual_text',
    label: source.label || '家长补充资料',
    text: String(source.text || source.rawText || source.content || '').trim(),
    confidence: Number.isFinite(Number(source.confidence)) ? Math.max(0.2, Math.min(0.98, Number(source.confidence))) : 0.72,
    status: source.status || '待家长确认',
    createdAt: source.createdAt || new Date().toISOString()
  };
  const next = Object.assign({}, current, {
    reportSources: [normalizedSource].concat(current.reportSources || []).slice(0, 30)
  });
  return saveLearningReportState(next, options);
}

function buildLearningReportFromInput(input = {}, options = {}) {
  if (!learningReport || !learningReport.buildLearningReportDraft) {
    return normalizeLearningReportState(input, options.now || new Date());
  }
  return learningReport.buildLearningReportDraft(Object.assign({}, loadLearningReportState(), input || {}));
}

function loadFeedback() {
  const list = get(KEYS.feedback, []);
  return Array.isArray(list) ? list : [];
}

function appendFeedback(item) {
  const next = [Object.assign({ created_at: new Date().toISOString() }, item || {})]
    .concat(loadFeedback())
    .slice(0, 80);
  set(KEYS.feedback, next);
  appendSyncMutation('homework_feedback', next[0]);
  return next;
}

function feedbackSummary() {
  const list = loadFeedback();
  const accurate = list.filter((item) => item.rating === 'accurate').length;
  const off = list.filter((item) => item.rating === 'off').length;
  return {
    total: list.length,
    accurate,
    off,
    label: list.length ? `已记录 ${list.length} 条校准` : '还没有校准记录'
  };
}

function loadPilotRuns() {
  const list = get(KEYS.pilotRuns, []);
  return Array.isArray(list) ? list : [];
}

function appendPilotRun(item) {
  const record = Object.assign({
    family: '',
    minutes_saved: 0,
    confidence: 3,
    review_returned: false,
    answer_blocks: 0,
    note: '',
    created_at: new Date().toISOString()
  }, item || {});
  const next = [record].concat(loadPilotRuns()).slice(0, 120);
  set(KEYS.pilotRuns, next);
  appendSyncMutation('pilot_run', record);
  return next;
}

function pilotRunSummary() {
  const list = loadPilotRuns();
  const total = list.length;
  const saved = list.reduce((sum, item) => sum + Number(item.minutes_saved || 0), 0);
  const confidence = total
    ? Math.round((list.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / total) * 10) / 10
    : 0;
  const returned = list.filter((item) => !!item.review_returned).length;
  const blocks = list.reduce((sum, item) => sum + Number(item.answer_blocks || 0), 0);
  return {
    total,
    minutesSaved: saved,
    avgMinutesSaved: total ? Math.round(saved / total) : 0,
    avgConfidence: confidence,
    reviewReturned: returned,
    returnRate: total ? Math.round((returned / total) * 100) : 0,
    answerBlocks: blocks,
    latest: list[0] || null,
    label: total
      ? `${total} pilot nights logged, ${saved} minutes saved, ${returned} review returns.`
      : 'No pilot evidence logged yet.'
  };
}

function loadFactoryEvents() {
  const list = get(KEYS.factoryEvents, []);
  return Array.isArray(list) ? list : [];
}

function appendFactoryEvent(item) {
  const record = Object.assign({
    event: 'factory_generated',
    input_type: '',
    provider: 'local',
    card_count: 0,
    quality_score: 0,
    imported: 0,
    created_at: new Date().toISOString()
  }, item || {});
  const next = [record].concat(loadFactoryEvents()).slice(0, 160);
  set(KEYS.factoryEvents, next);
  appendSyncMutation('factory_event', record);
  return next;
}

function factoryEventSummary() {
  const list = loadFactoryEvents();
  const generated = list.filter((item) => item.event === 'factory_generated').length;
  const imported = list.reduce((sum, item) => sum + Number(item.imported || 0), 0);
  const remote = list.filter((item) => String(item.provider || '').indexOf('remote') >= 0).length;
  const quality = list.length
    ? Math.round(list.reduce((sum, item) => sum + Number(item.quality_score || 0), 0) / list.length)
    : 0;
  const latest = list[0] || null;
  return {
    total: list.length,
    generated,
    imported,
    remote,
    local: Math.max(0, generated - remote),
    quality,
    latest,
    label: list.length
      ? `${generated} factory runs, ${imported} cards imported, quality ${quality}/100.`
      : 'No content factory runs yet.'
  };
}

function loadModuleEvents() {
  const list = get(KEYS.moduleEvents, []);
  return Array.isArray(list) ? list : [];
}

function trackModuleEvent(eventName, module, props = {}) {
  const item = {
    event: eventName,
    module_id: module && module.id,
    module_title: module && module.title,
    subject: module && module.subject,
    type: module && module.type,
    source: props.source || '',
    reason: props.reason || '',
    recommendation: props.recommendation || null,
    created_at: new Date().toISOString()
  };
  const next = [item].concat(loadModuleEvents()).slice(0, 120);
  set(KEYS.moduleEvents, next);
  appendSyncMutation('module_event', item);
  return next;
}

function moduleEventSummary() {
  const list = loadModuleEvents();
  const started = list.filter((item) => item.event === 'module_started').length;
  const viewed = list.filter((item) => item.event === 'module_viewed').length;
  const completed = list.filter((item) => item.event === 'module_completed').length;
  const subjects = {};
  list.forEach((item) => {
    if (!item.subject) return;
    subjects[item.subject] = (subjects[item.subject] || 0) + 1;
  });
  const topSubject = Object.keys(subjects).sort((a, b) => subjects[b] - subjects[a])[0] || '';
  return {
    total: list.length,
    viewed,
    started,
    completed,
    topSubject,
    feedback: loadModuleFeedback().length,
    useful: loadModuleFeedback().filter((item) => item.rating === 'useful').length,
    notUseful: loadModuleFeedback().filter((item) => item.rating === 'not_useful').length,
    label: list.length ? `已记录 ${list.length} 次模块行为` : '还没有模块行为记录'
  };
}

function loadModuleFeedback() {
  const list = get(KEYS.moduleFeedback, []);
  return Array.isArray(list) ? list : [];
}

function appendModuleFeedback(module, rating, props = {}) {
  const item = {
    module_id: module && module.id,
    module_title: module && module.title,
    subject: module && module.subject,
    type: module && module.type,
    rating,
    source: props.source || '',
    reason: props.reason || '',
    created_at: new Date().toISOString()
  };
  const next = [item].concat(loadModuleFeedback()).slice(0, 120);
  set(KEYS.moduleFeedback, next);
  appendSyncMutation('module_feedback', item);
  return next;
}

function moduleFeedbackMap() {
  const map = {};
  loadModuleFeedback().forEach((item) => {
    if (!item.module_id) return;
    if (!map[item.module_id]) map[item.module_id] = { useful: 0, notUseful: 0 };
    if (item.rating === 'useful') map[item.module_id].useful += 1;
    if (item.rating === 'not_useful') map[item.module_id].notUseful += 1;
  });
  return map;
}

function loadTutorEvents() {
  const list = get(KEYS.tutorEvents, []);
  return Array.isArray(list) ? list : [];
}

function trackTutorEvent(eventName, payload = {}) {
  const selected = get(KEYS.selectedHomework, null);
  const source = get(KEYS.selectedHomeworkSource, '');
  const item = {
    event: eventName,
    selected_id: selected && selected.id,
    selected_text: selected && selected.text,
    source,
    module_id: source && source.indexOf('module:') === 0 ? source.replace('module:', '') : '',
    coach_step: payload.coach_step || '',
    mastery_status: payload.mastery_status || '',
    blocked: !!payload.blocked,
    created_at: new Date().toISOString()
  };
  const next = [item].concat(loadTutorEvents()).slice(0, 160);
  set(KEYS.tutorEvents, next);
  appendSyncMutation('tutor_event', item);
  return next;
}

function tutorEventSummary() {
  const list = loadTutorEvents();
  const completed = list.filter((item) => item.event === 'tutor_mastery_ready').length;
  const blocked = list.filter((item) => item.blocked || item.mastery_status === 'blocked_answer_request').length;
  const moduleRuns = list.filter((item) => item.module_id).length;
  return {
    total: list.length,
    completed,
    blocked,
    moduleRuns,
    label: list.length ? `已记录 ${list.length} 次作业点拨信号` : '还没有作业点拨记录'
  };
}

function loadThinkingReceipts() {
  const list = get(KEYS.thinkingReceipts, []);
  return Array.isArray(list) ? list : [];
}

function appendThinkingReceipt(receipt = {}) {
  const selected = get(KEYS.selectedHomework, null);
  const source = get(KEYS.selectedHomeworkSource, '');
  const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
  const item = {
    id: receipt.id || `think_${Date.now()}_${randomPart()}`,
    title: receipt.title || 'THINKING RECEIPT',
    score: Math.max(0, Math.min(100, Number(receipt.score || 0))),
    status: receipt.status || '',
    focus: receipt.focus || (selected && selected.text) || '',
    selected_id: receipt.selected_id || (selected && selected.id) || '',
    selected_text: receipt.selected_text || (selected && selected.text) || '',
    source,
    coach_step: receipt.coach_step || receipt.activeStep || '',
    mastery_status: receipt.mastery_status || '',
    risk: receipt.risk || '',
    shareLine: receipt.shareLine || '',
    checks: checks.map((check) => ({
      id: check.id || '',
      label: check.label || '',
      done: !!check.done,
      detail: check.detail || ''
    })),
    created_at: receipt.created_at || new Date().toISOString()
  };
  const next = [item].concat(loadThinkingReceipts()).slice(0, 120);
  set(KEYS.thinkingReceipts, next);
  appendSyncMutation('thinking_receipt', item);
  return next;
}

function thinkingReceiptSummary() {
  const list = loadThinkingReceipts();
  const countDone = (id) => list.filter((receipt) => {
    const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
    return checks.some((check) => check.id === id && check.done);
  }).length;
  const total = list.length;
  const avgScore = total
    ? Math.round(list.reduce((sum, item) => sum + Number(item.score || 0), 0) / total)
    : 0;
  const blocked = list.filter((item) => item.status === 'answer shortcut blocked' || item.risk === 'high').length;
  const latest = list[0] || null;
  return {
    total,
    avgScore,
    studentFirst: countDone('first'),
    wrongCauseNamed: countDone('cause'),
    answerCopyAvoided: countDone('safe'),
    proofSentence: countDone('proof'),
    blocked,
    latest,
    label: total
      ? `Thinking ledger has ${total} parent-visible tutor receipts.`
      : 'No thinking receipts yet.'
  };
}

const ISSUE_RULES = [
  {
    type: '列式关系',
    patterns: [
      /不会列式/,
      /不知道怎么列式/,
      /不知道用哪个关系/,
      /条件用不上/,
      /信息太多不知道怎么用/,
      /不知道单位\s*1/,
      /单位\s*1\s*(找不到|不确定|是谁|是哪个)?/,
      /等量关系找不到/,
      /不知道谁除以谁/,
      /不知道设什么/
    ]
  },
  {
    type: '读题审题',
    patterns: [
      /读不懂题/,
      /题目看不懂/,
      /不知道题目问什么/,
      /题目?条件太多.*不知道怎么用/,
      /条件太多.*不知道怎么用/,
      /关键词找不到/,
      /条件看漏/,
      /题意不清楚/
    ]
  },
  {
    type: '表达不完整',
    patterns: [
      /不知道怎么写过程/,
      /会想不会写/,
      /不会组织答案/,
      /不知道怎么答/,
      /写不完整/,
      /说不清/
    ]
  },
  {
    type: '概念公式',
    patterns: [
      /概念不清/,
      /公式想不起来/,
      /不知道用哪个公式/,
      /这个知识点忘了/,
      /定义不懂/,
      /概念/,
      /公式/
    ]
  },
  {
    type: '计算粗心',
    patterns: [
      /算错了?/,
      /老算错/,
      /计算错/,
      /符号错/,
      /单位错/,
      /抄错数/,
      /粗心/,
      /马虎/,
      /计算乱了/
    ]
  },
  {
    type: '步骤断点',
    patterns: [
      /不知道下一步/,
      /写到第[一二三四五六七八九十\d]+步就乱/,
      /做到一半不知道接着干什么/,
      /不知道先干什么/,
      /后面不会接/,
      /不知道从哪里开始/,
      /不知道第一步/,
      /第一步不会/,
      /下一步卡了?/,
      /不会下一步/,
      /步骤/,
      /下一步/
    ]
  }
];

function classifyIssueType(text = '') {
  const value = String(text || '').trim();
  if (!value) return '思路卡点';
  const hit = ISSUE_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(value)));
  return hit ? hit.type : '思路卡点';
}

function isStuckThought(text = '') {
  const value = String(text || '');
  if (/我(觉得|想|会)?应该先|我先|先找|先看|先圈|先列|先写/.test(value)
    && !/不知道|不会|卡|乱|不确定|找不到|用不上|想不起来|忘了|写不出|接不上/.test(value)) {
    return false;
  }
  return classifyIssueType(value) !== '思路卡点'
    || /卡住|不知道|不会|没思路|不懂|乱了|找不到|不确定|用不上|想不起来|忘了|写不出|接不上/.test(value);
}

function issueTypeFromThought(text = '') {
  return classifyIssueType(text);
}

function focusNameFromThought(text = '') {
  const value = String(text || '').trim();
  const compact = value.replace(/\s+/g, '');
  const snippets = [
    { pattern: /写到第[一二三四五六七八九十\d]+步就乱了?/, title: (match) => match[0].replace(/了$/, '了') },
    { pattern: /做到一半不知道接着干什么/, title: () => '做到一半不知道接着干什么' },
    { pattern: /不知道从哪里开始/, title: () => '不知道从哪里开始' },
    { pattern: /不知道第一步|第一步不会|下一步卡了?/, title: () => '第一步不知道怎么开始' },
    { pattern: /单位\s*1\s*(不确定|找不到|是谁|是哪个)?/, title: () => /不确定/.test(compact) ? '单位1不确定' : '单位1找不到' },
    { pattern: /条件太多.*不知道怎么用|信息太多.*不知道怎么用/, title: () => '条件太多不知道怎么用' },
    { pattern: /条件用不上/, title: () => '条件用不上' },
    { pattern: /等量关系找不到/, title: () => '等量关系找不到' },
    { pattern: /不会列式|不知道怎么列式/, title: () => '不知道怎么列式' },
    { pattern: /不知道题目问什么/, title: () => '不知道题目问什么' },
    { pattern: /读不懂题|题目看不懂/, title: () => '题目读不懂' },
    { pattern: /公式想不起来|不知道用哪个公式/, title: () => '公式想不起来' },
    { pattern: /概念不清|定义不懂/, title: () => '概念和定义不清楚' },
    { pattern: /计算乱了|老算错|算错了?/, title: () => '计算乱了' },
    { pattern: /符号错|单位错|抄错数/, title: (match) => match[0] },
    { pattern: /会想不会写/, title: () => '会想但写不出过程' },
    { pattern: /不知道怎么写过程|写不完整/, title: () => '过程写不完整' },
    { pattern: /不会组织答案|不知道怎么答/, title: () => '不知道怎么组织答案' }
  ];
  const found = snippets.find((item) => item.pattern.test(compact));
  if (found) {
    const match = compact.match(found.pattern) || [''];
    return found.title(match);
  }
  const issueType = issueTypeFromThought(value);
  if (issueType === '读题审题') return '读懂题目在问什么';
  if (issueType === '概念公式') return '概念和公式选择';
  if (issueType === '列式关系') return '列式和关系';
  if (issueType === '步骤断点') return '列式和下一步';
  if (issueType === '计算粗心') return '计算检查';
  if (issueType === '表达不完整') return '写清解题过程';
  if (/单词|拼写|年代|元素/.test(value)) return '记不牢的知识点';
  return isStuckThought(value) ? '不会下一步' : '先说清第一步';
}

function shouldCreateNewFocus(current, text = '') {
  if (!current || !current.id) return true;
  const today = new Date().toISOString().slice(0, 10);
  const currentDay = current.date || String(current.created_at || '').slice(0, 10);
  return currentDay !== today || (current.repairStatus === 'completed' && isStuckThought(text));
}

function addDaysIso(days, date = new Date()) {
  return new Date(date.getTime() + Number(days || 0) * 24 * 60 * 60 * 1000).toISOString();
}

function todayDueReviewCards(limit = 4) {
  const now = Date.now();
  return loadReviewCards()
    .filter((card) => {
      const dueTime = new Date(card.due || card.dueDate || card.created_at || 0).getTime();
      return !card.suspended && (card.source === 'today_focus' || card.sourceFocusId) && dueTime <= now;
    })
    .slice(0, limit);
}

function parseAvailableMinutes(text, fallback = 45) {
  const match = String(text || '').match(/(\d{1,3})\s*(分钟|分|min|mins|m)/i);
  if (!match) return Math.max(20, Math.min(90, Number(fallback || 45)));
  return Math.max(20, Math.min(120, Number(match[1] || fallback)));
}

function splitTonightHomework(text = '') {
  const value = String(text || '').trim();
  const lines = value
    .split(/\n|；|;|。/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^\d{1,3}\s*(分钟|分|min|mins|m)$/i.test(item));
  const fallback = [
    '数学应用题 3 道，明天必交',
    '英语单词 10 分钟，明天听写',
    '整理今天卡住的一步',
    '数学拓展题 2 道'
  ];
  return (lines.length ? lines : fallback).slice(0, 8);
}

function issueKeywords(issueType = '') {
  const value = String(issueType || '');
  if (value.indexOf('读题') >= 0) return /题意|读题|审题|条件|单位|问什么|应用题/;
  if (value.indexOf('概念') >= 0) return /概念|公式|定义|性质|原理|关系/;
  if (value.indexOf('步骤') >= 0) return /列式|步骤|下一步|应用题|方程|等量关系|过程/;
  if (value.indexOf('计算') >= 0) return /计算|运算|口算|竖式|符号|分数|小数/;
  if (value.indexOf('表达') >= 0) return /过程|表达|证明|写清|说明|复盘/;
  return /卡点|不会|错题|订正|应用题|条件|步骤/;
}

function normalizeHomeworkItem(line, index) {
  const text = String(line || '').trim();
  const subjectMatch = text.match(/^(数学|语文|英语|物理|化学|科学|历史|地理|生物)[:：]\s*(.*)$/);
  const subject = subjectMatch ? subjectMatch[1] : (/单词|英语|听写/.test(text) ? '英语' : /课文|作文|语文/.test(text) ? '语文' : /数学|应用题|列式|方程|计算|拓展题/.test(text) ? '数学' : '学习');
  const title = subjectMatch ? (subjectMatch[2] || text) : text;
  const estimated = (text.match(/(\d{1,3})\s*(分钟|分|min)/i) || [])[1];
  const isRequired = /必交|明天|老师|课堂|作业|听写|考试|测验/.test(text);
  const isExtension = /拓展|选做|提高|挑战|附加/.test(text);
  return {
    id: `hw_${Date.now()}_${index + 1}_${randomPart()}`,
    subject,
    title,
    dueText: /明天|必交|听写|测验/.test(text) ? '明天相关' : '今晚安排',
    estimatedMinutes: estimated ? Number(estimated) : (/单词|听写|抄写/.test(text) ? 10 : /拓展|选做/.test(text) ? 12 : 15),
    requiredLevel: isExtension ? '拓展' : isRequired ? '必交' : '建议',
    relatedIssueType: '',
    sourceText: text
  };
}

function scoreHomeworkForRoute(item, todayFocus, remainingMinutes) {
  const text = [item.subject, item.title, item.sourceText].join(' ');
  const required = item.requiredLevel === '必交';
  const extension = item.requiredLevel === '拓展';
  const related = todayFocus && todayFocus.issueType ? issueKeywords(todayFocus.issueType).test(text) : false;
  const shortNecessary = item.estimatedMinutes <= 10 && required;
  let score = 20;
  if (required) score += 36;
  if (related) score += 32;
  if (shortNecessary) score += 12;
  if (extension) score -= 22;
  if (/明天|必交|听写|测验/.test(text)) score += 10;
  if (remainingMinutes < item.estimatedMinutes) score -= 16;
  return { score, related, shortNecessary, extension, required };
}

function priorityLabelForRoute(meta, spent, availableMinutes) {
  if (spent >= availableMinutes) return '明天问老师';
  if (meta.extension || spent + 6 > availableMinutes) return '后置';
  if (meta.related && meta.required) return '先做';
  if (meta.related || meta.required) return '认真做';
  if (meta.shortNecessary) return '快速做';
  return '后置';
}

function buildRouteSteps(activeId) {
  const steps = [
    { id: 'plan', label: '排顺序' },
    { id: 'first_step', label: '说第一步' },
    { id: 'repair', label: '修卡点' },
    { id: 'review', label: '轻回访' },
    { id: 'parent', label: '家长看' }
  ];
  return steps.map((step) => Object.assign({}, step, { active: step.id === activeId }));
}

function buildTonightPlan(inputText = '', options = {}) {
  const todayFocus = loadTodayFocus();
  const companionPreference = loadCompanionPreference();
  const memoryReason = growthMemoryCopyFor('home', companionPreference);
  const availableMinutes = Number(options.availableMinutes || parseAvailableMinutes(inputText, (loadProfile() || {}).minutes || 45));
  const dueCards = todayDueReviewCards(3);
  const homeworkItems = splitTonightHomework(inputText).map(normalizeHomeworkItem);
  const ranked = homeworkItems.map((item) => {
    const meta = scoreHomeworkForRoute(item, todayFocus, availableMinutes);
    return Object.assign({}, item, {
      relatedIssueType: meta.related && todayFocus ? todayFocus.issueType : '',
      routeScore: meta.score,
      routeMeta: meta
    });
  }).sort((a, b) => b.routeScore - a.routeScore);
  let spent = dueCards.length ? 8 : 0;
  const planItems = ranked.map((item, index) => {
    const label = index === 0 && !item.routeMeta.extension ? '先做' : priorityLabelForRoute(item.routeMeta, spent, availableMinutes);
    if (!['后置', '明天问老师'].includes(label)) spent += Number(item.estimatedMinutes || 0);
    const actionMap = {
      '先做': '先认真完成这一项，卡住时说出第一步。',
      '认真做': '按步骤慢一点做，遇到卡点先说一句。',
      '快速做': '用短时间完成，不拖到主任务后面。',
      '后置': '先放到后面，等必须任务和回访完成后再看。',
      '明天问老师': '今晚先记录问题，明天带着第一步去问老师。'
    };
    let reason = '安排在主任务后，保持今晚节奏。';
    if (item.relatedIssueType) {
      reason = memoryReason
        ? `${memoryReason} 最近“${item.relatedIssueType}”卡点会优先照顾。`
        : `和最近“${item.relatedIssueType}”卡点相关，值得先认真做。`;
    } else if (memoryReason && index === 0) {
      reason = memoryReason;
    } else if (item.requiredLevel === '必交') {
      reason = '这是学校任务里更需要先完成的一项。';
    } else if (item.requiredLevel === '拓展') {
      reason = '拓展题不抢今晚主线，先后置。';
    }
    return {
      homeworkId: item.id,
      title: item.title,
      subject: item.subject,
      priorityLabel: label,
      reason,
      suggestedAction: actionMap[label],
      parentPrompt: '你觉得这题第一步应该找什么？',
      estimatedMinutes: item.estimatedMinutes,
      requiredLevel: item.requiredLevel,
      relatedIssueType: item.relatedIssueType,
      sourceText: item.sourceText
    };
  });
  if (dueCards.length) {
    planItems.push({
      homeworkId: 'review_today_focus',
      title: '回访今天修过的卡点',
      subject: '复习',
      priorityLabel: '认真做',
      reason: '留 5-10 分钟回访，确认不是只看懂，而是真的会说第一步。',
      suggestedAction: '用一张回访卡轻轻确认。',
      parentPrompt: '这类题下次第一步先查什么？',
      estimatedMinutes: 8,
      requiredLevel: '建议',
      relatedIssueType: todayFocus && todayFocus.issueType,
      reviewCardIds: dueCards.map((card) => card.id)
    });
  }
  const first = planItems[0] || null;
  return {
    id: options.id || `route_${Date.now()}_${randomPart()}`,
    date: new Date().toISOString().slice(0, 10),
    availableMinutes,
    homeworkItems,
    planItems,
    focusId: todayFocus && todayFocus.id,
    reviewCardIds: dueCards.map((card) => card.id),
    parentAdvice: '家长只问一句：你觉得这题第一步应该找什么？不要直接讲最终结果。',
    parentPrompt: '你觉得这题第一步应该找什么？',
    routeStatus: todayFocus && todayFocus.repairStatus === 'completed'
      ? 'review_scheduled'
      : todayFocus && todayFocus.id
        ? 'focus_created'
        : 'needs_input',
    summaryLine: first
      ? `今晚建议顺序：先做${first.title}，再留 5-10 分钟回访卡点。${memoryReason ? ` ${memoryReason}` : ''}`
      : '今晚建议顺序：先排学校任务，再留 5-10 分钟轻回访。',
    routeSteps: buildRouteSteps('plan'),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function loadTonightPlan() {
  const plan = get(KEYS.tonightPlan, null);
  if (!plan || typeof plan !== 'object') return null;
  return plan;
}

function saveTonightPlan(plan = {}) {
  const saved = set(KEYS.tonightPlan, Object.assign({}, plan || {}, {
    updated_at: new Date().toISOString()
  }));
  appendSyncMutation('tonight_route', {
    id: saved.id,
    date: saved.date,
    available_minutes: Number(saved.availableMinutes || 0),
    route_status: saved.routeStatus || '',
    focus_id: saved.focusId || '',
    review_card_ids: saved.reviewCardIds || []
  });
  return saved;
}

function createTonightPlanFromInput(text = '', options = {}) {
  return saveTonightPlan(buildTonightPlan(text, options));
}

function updateTonightRouteStatus(status, patch = {}) {
  const current = loadTonightPlan() || buildTonightPlan('', {});
  const activeMap = {
    needs_input: 'plan',
    focus_created: 'first_step',
    repaired: 'repair',
    review_scheduled: 'review',
    parent_ready: 'parent'
  };
  return saveTonightPlan(Object.assign({}, current, patch || {}, {
    routeStatus: status || current.routeStatus || 'needs_input',
    routeSteps: buildRouteSteps(activeMap[status] || 'plan')
  }));
}

function isValidMiniActionText(text = '') {
  const value = String(text || '').trim();
  if (!value) return false;
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 3) return false;
  if (/^(不知道|不会|随便|没有|无|求答案|直接看答案|看答案|答案)$/.test(compact)) return false;
  if (/求答案|直接看答案|拍照出答案|答案已生成/.test(compact)) return false;
  return /[\u4e00-\u9fa5]{3,}|[a-zA-Z0-9]{5,}/.test(compact);
}

function sanitizeMiniActionText(text = '') {
  return String(text || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

const FIRST_STEP_QUICK_CHOICES = [
  '我先圈出题干条件',
  '我先找关键词',
  '我先写出已知量',
  '我先把第一句话读慢一点',
  '我先找等量关系'
];

const FIRST_STEP_TEMPLATES = {
  math_word_problem: [
    '先把题干里的已知条件圈出来。',
    '先找题目问的是什么。'
  ],
  equation_setup: [
    '先把未知数写成 x。',
    '先找等量关系。'
  ],
  reading_question: [
    '先看题目问的是细节、主旨还是原因。'
  ],
  english_sentence: [
    '先找主语和谓语。'
  ],
  writing_process: [
    '先写一句最简单的开头。'
  ],
  unknown: [
    '先把题目问什么说出来。'
  ]
};

function detectTaskType(text = '', extra = '') {
  const value = `${text || ''} ${extra || ''}`.toLowerCase();
  if (/方程|等量|未知数|x|列方程|解方程/.test(value)) return 'equation_setup';
  if (/应用题|题干|条件|已知|问什么|关键词|数量关系|单位/.test(value)) return 'math_word_problem';
  if (/阅读|读不懂|主旨|细节|原因|文章|段落|题目问/.test(value)) return 'reading_question';
  if (/英语|英文|句子|主语|谓语|单词|语法|sentence|subject|verb/.test(value)) return 'english_sentence';
  if (/作文|写作|开头|过程|表达|写不出来|怎么写/.test(value)) return 'writing_process';
  return 'unknown';
}

function firstStepTemplatesForTaskType(taskType = 'unknown') {
  return (FIRST_STEP_TEMPLATES[taskType] || FIRST_STEP_TEMPLATES.unknown).slice();
}

function suggestedStepForTaskType(taskType = 'unknown') {
  return firstStepTemplatesForTaskType(taskType)[0] || FIRST_STEP_TEMPLATES.unknown[0];
}

function childStepQuality(text = '') {
  const value = String(text || '').trim();
  const compact = value.replace(/\s+/g, '');
  if (!compact) return 'empty';
  if (/^(不会|不知道|看题|做题|学一下|再看看|随便|没有)$/.test(compact)) return 'vague';
  if (/圈出|圈条件|找关键词|写已知量|读第一句|列未知数|找等量关系|主语|谓语|写开头|题目问什么|先看|先找|先写|先圈|先读|先列/.test(value)) return 'actionable';
  if (/条件|关键词|已知|未知数|等量|第一句|题干|主旨|细节|原因|开头|主语|谓语|关系/.test(value)) return 'partial';
  if (/先|找|看|写|圈|读|列/.test(value) && compact.length >= 5) return 'partial';
  return compact.length >= 12 ? 'partial' : 'vague';
}

function normalizeFirstStepEvidence(focus = {}) {
  const stuckPointText = focus.stuckPointText || focus.sourceText || focus.thought || '';
  const taskType = focus.taskType || detectTaskType(stuckPointText, focus.issueType || focus.title || '');
  const systemSuggestedStep = sanitizeMiniActionText(
    focus.systemSuggestedStep || focus.suggestedFirstStep || focus.miniActionText || suggestedStepForTaskType(taskType)
  );
  const childArticulatedStep = sanitizeMiniActionText(focus.childArticulatedStep || focus.childStepSentence || '');
  const childStepSentence = childArticulatedStep || sanitizeMiniActionText(focus.childStepSentence || '');
  const quality = childStepQuality(childStepSentence);
  const firstStepSource = childArticulatedStep
    ? 'child_articulated'
    : systemSuggestedStep
      ? 'system_suggested'
      : 'manual';
  let firstStepStatus = focus.firstStepStatus || 'suggested';
  if (childArticulatedStep && firstStepStatus === 'suggested') firstStepStatus = 'child_confirmed';
  return {
    stuckPointText,
    taskType,
    systemSuggestedStep,
    childArticulatedStep,
    childStepSentence,
    childStepQuality: quality,
    firstStepSource,
    firstStepStatus,
    quickChoices: FIRST_STEP_QUICK_CHOICES.slice(),
    firstStepTemplates: firstStepTemplatesForTaskType(taskType),
    updatedAt: new Date().toISOString()
  };
}

const BLACKBOARD_HINTS = {
  '列式关系': {
    title: '关系小黑板',
    body: '先找：题目问谁？谁是整体？谁和谁在比较？',
    structure: '整体 → 部分 → 关系'
  },
  '读题审题': {
    title: '审题小黑板',
    body: '先圈问题，再找相关条件，暂时放下无关信息。',
    structure: '问题 → 条件 → 第一步'
  },
  '步骤断点': {
    title: '步骤小黑板',
    body: '先说第一步，再决定下一步，不要一下子想完整题。',
    structure: '第一步 → 下一步 → 检查'
  },
  '概念公式': {
    title: '概念小黑板',
    body: '先说这个概念在问什么，再想用哪个公式。',
    structure: '概念 → 条件 → 公式'
  }
};

function buildBlackboardHint(focus = {}) {
  if (!focus || !focus.id && !focus.issueType && !focus.title && !focus.sourceText) return null;
  const issueType = focus.issueType || '';
  const hint = BLACKBOARD_HINTS[issueType] || null;
  if (!hint) return null;
  return Object.assign({}, hint, {
    issueType,
    used: !!(focus.blackboardUsedAt || focus.blackboardHint),
    usedAt: focus.blackboardUsedAt || (focus.blackboardHint && focus.blackboardHint.usedAt) || ''
  });
}

function reviewPromptForIssueType(focus = {}) {
  const issueType = formatIssueType(focus.issueType || '', '思路卡点');
  const blackboardHint = buildBlackboardHint(focus);
  const blackboardLine = blackboardHint && (focus.blackboardUsedAt || focus.blackboardHint)
    ? `昨天小黑板提醒你先看：${blackboardHint.structure}。`
    : '';
  const childFirstStep = sanitizeMiniActionText(focus.childArticulatedStep || focus.childStepSentence || '');
  if (childFirstStep) {
    return {
      front: `你昨天说的第一步是：「${childFirstStep}」。今天还记得为什么先这样做吗？${blackboardLine}`,
      backPrompt: '先用自己的话说出第一步，再看是否需要提示。'
    };
  }
  const title = formatInternalLabel(focus.title || focus.sourceText || '', '昨天修过的卡点');
  if (issueType === '步骤断点' || issueType === '第一步怎么开始') {
    return {
      front: `你昨天卡在「${title}」。下次先问自己：第一步要找什么？`,
      backPrompt: '先说出第一步，再决定下一步，不要一下子想完整题。'
    };
  }
  if (issueType === '列式关系' || issueType === '列式和关系') {
    return {
      front: `你昨天卡在「${title}」。下次先问自己：谁是单位1或等量关系？`,
      backPrompt: '先找题目中的比较对象，再判断谁是单位1或等量关系。'
    };
  }
  if (issueType === '读题审题' || issueType === '读懂题目在问什么') {
    return {
      front: `你昨天卡在「${title}」。下次先圈出题目问什么。`,
      backPrompt: '先看问题，再回头找相关条件，暂时放下无关信息。'
    };
  }
  if (issueType === '概念公式' || issueType === '概念和公式选择') {
    return {
      front: `你昨天卡在「${title}」。下次先想：这个知识点或公式是什么？`,
      backPrompt: '先说出概念边界或公式用途，再决定怎么用。'
    };
  }
  if (issueType === '计算粗心' || issueType === '计算检查') {
    return {
      front: `你昨天卡在「${title}」。下次算完第一步先检查什么？`,
      backPrompt: '先检查符号、单位和抄数，再继续下一步。'
    };
  }
  if (issueType === '表达不完整' || issueType === '写清解题过程') {
    return {
      front: `你昨天卡在「${title}」。下次先把第一句话怎么写说出来。`,
      backPrompt: '先说清第一步和理由，再写完整过程。'
    };
  }
  return {
    front: '昨天修过的卡点，今天先回想第一步。',
    backPrompt: '先用自己的话说出第一步，再看是否需要提示。'
  };
}

function buildTodayFocusReviewCard(focus = {}) {
  const now = new Date();
  const due = addDaysIso(1, now);
  const focusId = focus.id || `focus_${Date.now()}_${randomPart()}`;
  const prompt = reviewPromptForIssueType(focus);
  const front = prompt.front;
  const backPrompt = prompt.backPrompt;
  return {
    id: `focus_review_${focusId}`,
    noteId: `note_focus_${focusId}`,
    deckId: 'ydzx-core',
    template: 'active_recall',
    type: 'today_focus_recall',
    source: 'today_focus',
    sourceFocusId: focusId,
    front,
    backPrompt,
    question: front,
    answer: backPrompt,
    subject: focus.subject || '',
    issueType: focus.issueType || '思路卡点',
    weakPoint: focus.title || focus.issueType || '今晚修过的卡点',
    miniActionText: sanitizeMiniActionText(focus.miniActionText || ''),
    blackboardHint: buildBlackboardHint(focus),
    blackboardUsedAt: focus.blackboardUsedAt || '',
    sourceText: focus.sourceText || focus.thought || '',
    calibrationKey: focus.issueType || '',
    quality: 82,
    dueDate: due,
    due,
    intervalLevel: 1,
    status: 'new',
    stability: 0,
    difficulty: 5,
    retrievability: 0,
    elapsed_days: 0,
    interval: 1,
    reps: 0,
    lapses: 0,
    state: 'new',
    suspended: false,
    leech: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function ensureTodayFocusReviewCard(focus = {}) {
  if (!focus || !focus.id || focus.repairStatus !== 'completed' || !focus.hasMiniActionDone) return null;
  const cards = loadReviewCards();
  const existing = cards.find((card) => card && (card.sourceFocusId === focus.id || card.id === `focus_review_${focus.id}`));
  if (existing) return existing;
  const card = buildTodayFocusReviewCard(focus);
  saveReviewCards([card].concat(cards).slice(0, 260));
  appendReviewEvent({
    type: 'today_focus_review_card_created',
    cardId: card.id,
    sourceFocusId: focus.id,
    rating: 'created'
  });
  return card;
}

function loadTodayFocus() {
  const focus = get(KEYS.todayFocus, null);
  if (!focus || typeof focus !== 'object') return null;
  return focus;
}

function saveTodayFocus(focus = {}) {
  const current = loadTodayFocus() || {};
  const isNewFocus = !!(focus && focus.id && current.id && focus.id !== current.id);
  const baseFocus = isNewFocus ? {} : current;
  const evidence = normalizeFirstStepEvidence(Object.assign({}, baseFocus, focus || {}));
  const saved = set(KEYS.todayFocus, Object.assign({
    id: `focus_${Date.now()}_${randomPart()}`,
    date: new Date().toISOString().slice(0, 10),
    source: 'local',
    title: '先说清第一步',
    thought: '',
    sourceText: '',
    thoughtHistory: [],
    relatedThoughts: [],
    issueType: '思路卡点',
    isStuck: false,
    repairStatus: 'not_started',
    progress: 0,
    hasMiniActionDone: false,
    miniActionText: '',
    miniActionAt: '',
    recommendation: '先做 1 道同类题 + 1 道小变式',
    helper: '原小点会先问一步，不直接给答案。',
    created_at: new Date().toISOString()
  }, baseFocus, focus || {}, evidence, {
    miniActionText: evidence.childArticulatedStep || evidence.systemSuggestedStep || (focus && focus.miniActionText) || current.miniActionText || '',
    hasMiniActionDone: !!evidence.childArticulatedStep || !!((focus && focus.hasMiniActionDone) || (!isNewFocus && current.hasMiniActionDone)),
    updated_at: new Date().toISOString()
  }));
  syncTodaySessionFromFocus(saved);
  appendSyncMutation('today_focus', {
    id: saved.id,
    date: saved.date,
    title: saved.title,
    issue_type: saved.issueType || '',
    is_stuck: !!saved.isStuck,
    repair_status: saved.repairStatus,
    has_mini_action_done: !!saved.hasMiniActionDone,
    progress: Number(saved.progress || 0),
    source: saved.source || '',
    created_at: saved.created_at,
    updated_at: saved.updated_at
  });
  return saved;
}

function saveTodayFocusFromThought(text = '', props = {}) {
  const thought = String(text || '').trim();
  const stuck = isStuckThought(thought);
  const taskType = detectTaskType(thought, `${props.issueType || ''} ${props.title || ''}`);
  const systemSuggestedStep = props.systemSuggestedStep || suggestedStepForTaskType(taskType);
  const current = loadTodayFocus();
  const historyItem = {
    text: thought,
    issueType: issueTypeFromThought(thought),
    isStuck: stuck,
    source: props.source || 'homework_tutor',
    created_at: new Date().toISOString()
  };
  if (current && !shouldCreateNewFocus(current, thought)) {
    const nextHistory = [historyItem].concat(current.thoughtHistory || current.relatedThoughts || []).slice(0, 8);
    const patch = {
      thoughtHistory: nextHistory,
      relatedThoughts: nextHistory,
      updatedAt: new Date().toISOString()
    };
    if (!stuck && current.isStuck && current.repairStatus !== 'completed') {
      return saveTodayFocus(Object.assign({}, patch, props || {}));
    }
  }
  const currentAfterHistory = loadTodayFocus();
  return saveTodayFocus(Object.assign({
    id: shouldCreateNewFocus(currentAfterHistory, thought) ? `focus_${Date.now()}_${randomPart()}` : (currentAfterHistory && currentAfterHistory.id),
    source: 'homework_tutor',
    title: focusNameFromThought(thought),
    stuckPointText: thought,
    taskType,
    systemSuggestedStep,
    firstStepStatus: 'suggested',
    firstStepSource: 'system_suggested',
    thought,
    sourceText: thought,
    thoughtHistory: [historyItem].concat((currentAfterHistory && currentAfterHistory.thoughtHistory) || []).slice(0, 8),
    relatedThoughts: [historyItem].concat((currentAfterHistory && currentAfterHistory.relatedThoughts) || []).slice(0, 8),
    issueType: issueTypeFromThought(thought),
    isStuck: stuck,
    hasMiniActionDone: false,
    repairStatus: stuck ? 'not_started' : 'noted',
    progress: stuck ? 12 : 8,
    reason: stuck ? '孩子刚刚说到这里卡住了。' : '孩子已经留下第一步想法。',
    recommendation: '先做 1 道同类题 + 1 道小变式',
    helper: '原小点会先问一步，不直接给答案。'
  }, shouldCreateNewFocus(currentAfterHistory, thought) ? { completed_at: '' } : {}, props || {}));
}

function saveChildArticulatedStep(text = '', patch = {}) {
  const current = loadTodayFocus() || saveTodayFocusFromThought('', { source: 'child_step_default' });
  const childStepSentence = sanitizeMiniActionText(text);
  const quality = childStepQuality(childStepSentence);
  const hasConcreteStep = quality === 'partial' || quality === 'actionable';
  if (hasConcreteStep) recordLocalAnalytics('first_step_confirmed', { quality });
  return saveTodayFocus(Object.assign({}, current, patch || {}, {
    childArticulatedStep: childStepSentence,
    childStepSentence,
    childStepQuality: quality,
    firstStepSource: childStepSentence ? 'child_articulated' : current.firstStepSource || 'system_suggested',
    firstStepStatus: hasConcreteStep ? 'child_confirmed' : current.firstStepStatus || 'suggested',
    hasMiniActionDone: hasConcreteStep,
    miniActionText: childStepSentence || current.systemSuggestedStep || current.miniActionText || '',
    miniActionAt: hasConcreteStep ? new Date().toISOString() : current.miniActionAt || '',
    updatedAt: new Date().toISOString()
  }));
}

function updateTodayFocusRepair(patch = {}) {
  const current = loadTodayFocus() || saveTodayFocusFromThought('我不会下一步怎么写', {
    source: 'review_default'
  });
  const status = patch.repairStatus || patch.status || current.repairStatus || 'not_started';
  const existingChildStep = sanitizeMiniActionText(current.childArticulatedStep || current.childStepSentence || '');
  const incomingMiniActionText = patch.miniActionText !== undefined
    ? sanitizeMiniActionText(patch.miniActionText)
    : existingChildStep;
  const incomingQuality = childStepQuality(incomingMiniActionText);
  const miniActionValid = isValidMiniActionText(incomingMiniActionText) && incomingQuality !== 'empty' && incomingQuality !== 'vague';
  const existingChildValid = isValidMiniActionText(existingChildStep) && childStepQuality(existingChildStep) !== 'vague';
  const nextHasMiniAction = miniActionValid || (!!patch.hasMiniActionDone && existingChildValid);
  if ((patch.hasMiniActionDone || status === 'completed') && !miniActionValid && !existingChildValid) {
    return saveTodayFocus(Object.assign({}, current, patch || {}, {
      hasMiniActionDone: false,
      miniActionText: incomingMiniActionText,
      repairStatus: 'in_progress',
      progress: Math.max(56, Number(current.progress || 0)),
      blockedReason: 'mini_action_required',
      feedbackText: '先用自己的话说一句第一步，再完成修复。'
    }));
  }
  const completedPatch = { repairStatus: 'completed' };
  if (status === 'completed' && !nextHasMiniAction) {
    return saveTodayFocus(Object.assign({}, current, patch || {}, {
      repairStatus: 'in_progress',
      progress: Math.max(56, Number(current.progress || 0)),
      blockedReason: 'mini_action_required'
    }));
  }
  const fallbackProgress = status === 'completed' ? 100 : status === 'in_progress' ? Math.max(56, Number(current.progress || 0)) : Number(current.progress || 0);
  const saved = saveTodayFocus(Object.assign({}, current, status === 'completed' ? completedPatch : {}, patch || {}, {
    repairStatus: status,
    hasMiniActionDone: nextHasMiniAction || !!current.hasMiniActionDone,
    miniActionText: incomingMiniActionText || current.miniActionText || '',
    childArticulatedStep: incomingMiniActionText || current.childArticulatedStep || '',
    childStepSentence: incomingMiniActionText || current.childStepSentence || '',
    childStepQuality: childStepQuality(incomingMiniActionText || current.childStepSentence || current.childArticulatedStep || ''),
    firstStepSource: (incomingMiniActionText || current.childArticulatedStep) ? 'child_articulated' : current.firstStepSource || 'system_suggested',
    firstStepStatus: status === 'completed' ? 'revisited' : (nextHasMiniAction ? 'child_confirmed' : current.firstStepStatus || 'suggested'),
    miniActionAt: nextHasMiniAction ? (patch.miniActionAt || current.miniActionAt || new Date().toISOString()) : (current.miniActionAt || ''),
    blockedReason: '',
    progress: Math.max(0, Math.min(100, Number(patch.progress !== undefined ? patch.progress : fallbackProgress))),
    completed_at: status === 'completed' ? (patch.completed_at || new Date().toISOString()) : current.completed_at
  }));
  if (saved.repairStatus === 'completed' && saved.hasMiniActionDone) {
    ensureTodayFocusReviewCard(saved);
    updateTonightRouteStatus('review_scheduled', {
      focusId: saved.id
    });
  } else if (saved.repairStatus === 'in_progress') {
    updateTonightRouteStatus('focus_created', {
      focusId: saved.id
    });
  }
  return saved;
}

function localDateString(input = new Date()) {
  const date = input instanceof Date ? input : new Date(String(input).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function sessionNowMs(input) {
  if (!input) return Date.now();
  const date = input instanceof Date ? input : new Date(String(input).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function isYesterday(dateInput, nowInput = new Date()) {
  const dateText = localDateString(dateInput);
  const now = new Date(sessionNowMs(nowInput));
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return dateText === yesterday.toISOString().slice(0, 10);
}

function defaultTodaySession(nowInput = new Date()) {
  const nowMs = sessionNowMs(nowInput);
  return {
    date: localDateString(nowInput),
    status: 'active',
    stuckPointText: '',
    taskType: 'unknown',
    taskTypeConfirmed: false,
    tutorCompleted: false,
    childArticulatedStep: '',
    firstStepQuality: 'empty',
    firstStepSource: 'manual',
    focusBound: false,
    focusEvidence: {
      targetStep: '',
      targetSource: 'manual',
      duration: 0,
      completionType: '',
      interruptedAt: null,
      actualFocusSeconds: 0
    },
    reviewCardGenerated: false,
    reviewCardId: '',
    gamePlayed: false,
    gameEvidence: {
      taskType: '',
      firstStep: '',
      score: 0,
      completed: false
    },
    parentRecapViewed: false,
    createdAt: nowMs,
    updatedAt: nowMs
  };
}

function normalizeTodaySession(input = {}, nowInput = new Date()) {
  const base = defaultTodaySession(nowInput);
  const session = Object.assign({}, base, input || {});
  session.focusEvidence = Object.assign({}, base.focusEvidence, (input && input.focusEvidence) || {});
  session.gameEvidence = Object.assign({}, base.gameEvidence, (input && input.gameEvidence) || {});
  session.taskType = session.taskType || 'unknown';
  session.firstStepQuality = session.firstStepQuality || childStepQuality(session.childArticulatedStep || '');
  session.firstStepSource = session.firstStepSource || (session.childArticulatedStep ? 'child_articulated' : 'manual');
  session.updatedAt = Number(session.updatedAt || Date.now());
  session.createdAt = Number(session.createdAt || session.updatedAt);
  return session;
}

function loadRawTodaySession() {
  const session = get(KEYS.todaySession, null);
  if (!session || typeof session !== 'object') return null;
  return normalizeTodaySession(session);
}

function getTodaySession(options = {}) {
  const nowInput = options.now || new Date();
  const today = localDateString(nowInput);
  const current = loadRawTodaySession();
  if (current && current.date === today) return current;
  const session = defaultTodaySession(nowInput);
  set(KEYS.todaySession, session);
  return session;
}

function saveTodaySession(patch = {}, options = {}) {
  const current = options.skipCreate ? loadRawTodaySession() : getTodaySession(options);
  const base = current || defaultTodaySession(options.now || new Date());
  const next = normalizeTodaySession(Object.assign({}, base, patch || {}, {
    focusEvidence: Object.assign({}, base.focusEvidence || {}, (patch && patch.focusEvidence) || {}),
    gameEvidence: Object.assign({}, base.gameEvidence || {}, (patch && patch.gameEvidence) || {}),
    updatedAt: sessionNowMs(options.now || new Date())
  }), options.now || new Date());
  set(KEYS.todaySession, next);
  appendSyncMutation('today_session', {
    id: `today_session_${next.date}`,
    date: next.date,
    status: next.status,
    stuckPointText: next.stuckPointText || '',
    taskType: next.taskType || 'unknown',
    taskTypeConfirmed: !!next.taskTypeConfirmed,
    tutorCompleted: !!next.tutorCompleted,
    childArticulatedStep: next.childArticulatedStep || '',
    firstStepQuality: next.firstStepQuality || 'empty',
    focusEvidence: next.focusEvidence || {},
    reviewCardGenerated: !!next.reviewCardGenerated,
    reviewCardId: next.reviewCardId || '',
    gamePlayed: !!next.gamePlayed,
    gameEvidence: next.gameEvidence || {},
    parentRecapViewed: !!next.parentRecapViewed,
    updatedAt: next.updatedAt
  });
  return next;
}

function syncTodaySessionFromFocus(focus = {}, options = {}) {
  const evidence = normalizeFirstStepEvidence(focus || {});
  const patch = {
    stuckPointText: evidence.stuckPointText || focus.stuckPointText || '',
    taskType: evidence.taskType || focus.taskType || 'unknown',
    taskTypeConfirmed: !!(focus.taskTypeConfirmed || focus.source === 'diagnosis' || focus.source === 'light_diagnosis'),
    childArticulatedStep: evidence.childArticulatedStep || '',
    firstStepQuality: evidence.childStepQuality || childStepQuality(evidence.childArticulatedStep || ''),
    firstStepSource: evidence.firstStepSource || (evidence.childArticulatedStep ? 'child_articulated' : 'system_suggested')
  };
  if (patch.childArticulatedStep && patch.firstStepQuality !== 'empty') patch.tutorCompleted = true;
  return saveTodaySession(patch, options);
}

function canStartFocusFromTodaySession(session = getTodaySession()) {
  const quality = session.firstStepQuality || childStepQuality(session.childArticulatedStep || '');
  return !!(session.childArticulatedStep && quality !== 'empty');
}

function parentQuestionFromFirstStep(step = '') {
  const text = String(step || '');
  if (/圈条件|关键词|已知量|已知|条件/.test(text)) return '你第一步圈了哪些条件？';
  if (/读题|读第一句|先读/.test(text)) return '你读题时先看了哪句话？';
  if (/找等量关系|等量关系|关系/.test(text)) return '你找了哪两个量之间的关系？';
  if (/写开头|列提纲|第一句/.test(text)) return '你写的第一句是什么？';
  return '你第一步先做了什么？';
}

function wrongCauseFromFirstStep(step = '', taskType = 'unknown') {
  const text = `${step || ''} ${taskType || ''}`;
  if (/圈条件|关键词|已知量|已知|条件|读题|问号/.test(text)) {
    return {
      id: 'reading_conditions',
      label: '审题条件',
      checkpoint: '先圈题目问什么、已知条件和单位。',
      parentPrompt: '你第一步圈了哪些条件？',
      nextPracticeText: '做 1 道同类题，只圈条件和问题句，不急着算。'
    };
  }
  if (/等量关系|关系|方程|列式|未知数/.test(text)) {
    return {
      id: 'modeling_relation',
      label: '关系建模',
      checkpoint: '先写出两个量之间的关系，再列式。',
      parentPrompt: '你找了哪两个量之间的关系？',
      nextPracticeText: '把题目里的两个关键量写成一句关系话。'
    };
  }
  if (/计算|粗心|检查|符号|小数点/.test(text)) {
    return {
      id: 'calculation_check',
      label: '计算检查',
      checkpoint: '先复算关键一步，再查符号和单位。',
      parentPrompt: '你准备先检查哪一步计算？',
      nextPracticeText: '只复算上次错的那一步，再做 2 个同类小练。'
    };
  }
  if (/写|提纲|作文|句|阅读|概括/.test(text)) {
    return {
      id: 'expression_planning',
      label: '表达组织',
      checkpoint: '先写一句主干，再补理由或例子。',
      parentPrompt: '你写的第一句是什么？',
      nextPracticeText: '只写开头一句和两个要点，不追求整篇。'
    };
  }
  return {
    id: 'first_step',
    label: '第一步确认',
    checkpoint: '先说自己准备从哪里开始。',
    parentPrompt: parentQuestionFromFirstStep(step),
    nextPracticeText: step ? `把「${step}」写成一句话，再进入专注。` : '把第一步写成一句话，再进入专注。'
  };
}

function reviewCardFromSession(session = getTodaySession()) {
  const focusEvidence = session.focusEvidence || {};
  const id = session.reviewCardId || `session_review_${session.date}_${randomPart()}`;
  const step = session.childArticulatedStep || focusEvidence.targetStep || '';
  const taskType = session.taskType || 'unknown';
  const wrongCause = wrongCauseFromFirstStep(step, taskType);
  return {
    id,
    date: session.date,
    stuckPointText: session.stuckPointText || '',
    taskType,
    wrongCauseBucket: wrongCause.id,
    wrongCauseLabel: wrongCause.label,
    checkpoint: wrongCause.checkpoint,
    parentPrompt: wrongCause.parentPrompt,
    nextPracticePlan: {
      wrongCauseBucket: wrongCause.id,
      wrongCauseLabel: wrongCause.label,
      checkpoint: wrongCause.checkpoint,
      parentPrompt: wrongCause.parentPrompt,
      nextPracticeText: wrongCause.nextPracticeText,
      appRoute: wrongCause.id === 'first_step' ? '/pages/tutor/tutor' : '/pages/review/review'
    },
    childArticulatedStep: step,
    firstStepQuality: session.firstStepQuality || childStepQuality(step),
    focusDuration: Number(focusEvidence.duration || focusEvidence.actualFocusSeconds || 0),
    focusCompletionType: focusEvidence.completionType || '',
    gameScore: Number((session.gameEvidence && session.gameEvidence.score) || 0),
    repairPlan: step ? `明天先回看：${step}。${wrongCause.nextPracticeText}` : wrongCause.nextPracticeText,
    gameEvidence: session.gameEvidence || {},
    parentRecapLine: step ? `今晚只问一句：${parentQuestionFromFirstStep(step)}` : '今晚先看孩子有没有说出第一步。',
    isRevisited: !!session.isRevisited,
    source: 'today_session',
    sourceFocusId: session.reviewCardId || id,
    front: step ? `回看这一步：${step}` : '回看昨晚第一步',
    backPrompt: session.stuckPointText || '说说昨晚卡在哪里。',
    question: step ? `昨晚第一步是什么？${step}` : '昨晚第一步是什么？',
    answer: step || session.stuckPointText || '',
    due: addDaysIso(1, new Date(`${session.date}T00:00:00`)),
    dueDate: addDaysIso(1, new Date(`${session.date}T00:00:00`)),
    created_at: new Date(session.updatedAt || Date.now()).toISOString(),
    updated_at: new Date().toISOString()
  };
}

function generateReviewCard(sessionInput) {
  const session = normalizeTodaySession(sessionInput || getTodaySession());
  const card = reviewCardFromSession(session);
  const cards = loadReviewCards();
  const next = [card].concat(cards.filter((item) => item && item.id !== card.id)).slice(0, 260);
  saveReviewCards(next);
  saveTodaySession({
    reviewCardGenerated: true,
    reviewCardId: card.id
  });
  appendReviewEvent({
    type: 'today_session_review_card_created',
    cardId: card.id,
    sourceFocusId: card.sourceFocusId
  });
  queueLearningSyncSnapshot('review_card_generated');
  return card;
}

function recordFocusSessionEvidence(record = {}) {
  const target = record.focusTarget || {};
  const targetStep = target.linkedChildArticulatedStep || target.title || '';
  const completionType = record.completionType || (record.status === 'interrupted' ? 'interrupted' : 'completed');
  const session = saveTodaySession({
    status: completionType === 'interrupted' ? 'active' : 'completed',
    focusBound: true,
    focusEvidence: {
      targetStep,
      targetSource: target.targetSource || 'child_articulated',
      duration: Number(record.completedSeconds || record.actualFocusSeconds || 0),
      completionType,
      interruptedAt: record.interruptedAt || null,
      actualFocusSeconds: Number(record.actualFocusSeconds || record.completedSeconds || 0)
    }
  });
  return generateReviewCard(session);
}

function markReviewCardRevisited(cardId) {
  const cards = loadReviewCards();
  const targetId = cardId || (cards[0] && cards[0].id);
  const next = cards.map((card) => (
    card && card.id === targetId ? Object.assign({}, card, { isRevisited: true, updated_at: new Date().toISOString() }) : card
  ));
  saveReviewCards(next);
  return next.find((card) => card && card.id === targetId) || null;
}

function getYesterdayReview(nowInput = new Date()) {
  return loadReviewCards().find((card) => card && !card.isRevisited && isYesterday(card.date || card.created_at, nowInput)) || null;
}

function archiveYesterdaySession(options = {}) {
  const nowInput = options.now || new Date();
  const current = loadRawTodaySession();
  if (!current || current.date === localDateString(nowInput)) return null;
  const completionType = current.focusEvidence && current.focusEvidence.completionType;
  const status = completionType === 'completed' || completionType === 'manual_done' ? 'completed' : 'abandoned';
  const archived = normalizeTodaySession(Object.assign({}, current, { status, updatedAt: sessionNowMs(nowInput) }), nowInput);
  const card = generateReviewCard(archived);
  set(KEYS.todaySession, defaultTodaySession(nowInput));
  return { session: archived, card };
}

function loadReviewCards() {
  const list = get(KEYS.reviewCards, []);
  return Array.isArray(list) ? list : [];
}

function loadReviewDeck() {
  return get(KEYS.reviewDeck, null);
}

function saveReviewDeck(deck) {
  return set(KEYS.reviewDeck, deck || null);
}

function loadReviewNotes() {
  const list = get(KEYS.reviewNotes, []);
  return Array.isArray(list) ? list : [];
}

function saveReviewNotes(notes) {
  return set(KEYS.reviewNotes, Array.isArray(notes) ? notes : []);
}

function saveReviewCards(cards) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const saved = set(KEYS.reviewCards, safeCards);
  appendSyncMutation('review_cards_snapshot', {
    id: `review_cards_${localDateString()}`,
    total: safeCards.length,
    cards: safeCards.slice(0, 40),
    updated_at: new Date().toISOString()
  });
  return saved;
}

function loadReviewEvents() {
  const list = get(KEYS.reviewEvents, []);
  return Array.isArray(list) ? list : [];
}

function appendReviewEvent(item) {
  const record = Object.assign({ created_at: new Date().toISOString() }, item || {});
  const next = [record]
    .concat(loadReviewEvents())
    .slice(0, 240);
  set(KEYS.reviewEvents, next);
  appendSyncMutation('review_event', record);
  return next;
}

function loadGameProfile() {
  return get(KEYS.gameProfile, {
    xp: 0,
    coins: 0,
    streak: 0,
    best_streak: 0,
    last_study_date: '',
    streak_freezes: 1,
    lives: 5,
    max_lives: 5,
    achievements: [],
    inventory: [],
    recent_quiz_accuracy: [],
    daily_xp: {},
    updated_at: ''
  });
}

function saveGameProfile(profile = {}) {
  const current = loadGameProfile();
  const saved = set(KEYS.gameProfile, Object.assign({}, current, profile || {}, {
    updated_at: new Date().toISOString()
  }));
  appendSyncMutation('game_profile', {
    xp: Number(saved.xp || 0),
    coins: Number(saved.coins || 0),
    streak: Number(saved.streak || 0),
    best_streak: Number(saved.best_streak || 0),
    achievements: saved.achievements || [],
    inventory_count: (saved.inventory || []).length
  });
  return saved;
}

function addGameXP(amount, reason = '') {
  const current = loadGameProfile();
  const today = new Date().toISOString().slice(0, 10);
  const daily = Object.assign({}, current.daily_xp || {});
  const delta = Math.max(0, Number(amount || 0));
  const nextDaily = Number(daily[today] || 0) + delta;
  daily[today] = Math.min(500, nextDaily);
  const accepted = Math.max(0, daily[today] - Number((current.daily_xp || {})[today] || 0));
  const saved = saveGameProfile(Object.assign({}, current, {
    xp: Number(current.xp || 0) + accepted,
    daily_xp: daily
  }));
  if (accepted > 0) {
    appendSyncMutation('game_xp', {
      xp: accepted,
      reason,
      daily_total: daily[today],
      created_at: new Date().toISOString()
    });
  }
  return { profile: saved, accepted, capped: accepted < delta };
}

function recordGameSessionResult(result = {}, context = {}) {
  const current = loadGameProfile();
  const total = Number(result.total || 0);
  const correct = Number(result.correct || 0);
  const accuracy = Number(result.accuracy || 0);
  const reviewedToday = Math.max(1, total || correct || 1);
  const streaked = gameLogic.updateStreak(current, {
    reviewedToday,
    threshold: 1,
    now: context.now || new Date()
  });
  const recentQuiz = (Array.isArray(streaked.recent_quiz_accuracy) ? streaked.recent_quiz_accuracy : [])
    .concat([accuracy])
    .slice(-7);
  const stats = Object.assign({}, streaked, {
    review_count: Number(streaked.review_count || 0) + reviewedToday,
    correct_count: Number(streaked.correct_count || 0) + correct,
    recent_quiz_accuracy: recentQuiz,
    achievements: streaked.achievements || []
  });
  const achievementResult = gameLogic.checkAndUnlockAchievements(stats);
  const saved = saveGameProfile(Object.assign({}, stats, {
    achievements: achievementResult.achievements,
    coins: Number(stats.coins || 0) + Number(achievementResult.coinsAwarded || 0)
  }));
  appendSyncMutation('game_session_result', {
    id: `game_session_${localDateString(context.now || new Date())}_${String(context.gameType || result.gameType || 'arcade')}`,
    game_type: context.gameType || result.gameType || 'arcade',
    total,
    correct,
    accuracy,
    streak: Number(saved.streak || 0),
    achievements: saved.achievements || [],
    newly_unlocked: achievementResult.newlyUnlocked.map((item) => item.id),
    created_at: new Date().toISOString()
  });
  return {
    profile: saved,
    newlyUnlocked: achievementResult.newlyUnlocked,
    coinsAwarded: achievementResult.coinsAwarded
  };
}

function saveGamePurchase(purchase = {}) {
  const next = [Object.assign({ created_at: new Date().toISOString() }, purchase || {})]
    .concat(loadGamePurchases())
    .slice(0, 120);
  set(KEYS.gamePurchases, next);
  appendSyncMutation('game_purchase', next[0]);
  return next;
}

function loadGamePurchases() {
  const list = get(KEYS.gamePurchases, []);
  return Array.isArray(list) ? list : [];
}

function loadShareRuns() {
  const list = get(KEYS.shareRuns, []);
  return Array.isArray(list) ? list : [];
}

function loadIncomingShare() {
  return get(KEYS.incomingShare, null);
}

function saveIncomingShare(share = {}) {
  const code = share.share_code || share.code || '';
  if (!code) return null;
  const record = {
    code,
    share_code: code,
    from: share.from || '',
    challenge: share.challenge || '',
    mode: share.mode || '',
    identity_tag: share.identity_tag || share.identity || '',
    created_at: share.created_at || new Date().toISOString()
  };
  set(KEYS.incomingShare, record);
  return record;
}

function appendShareRun(event = {}) {
  const list = loadShareRuns();
  const shareCode = event.share_code || event.code || (event.payload && (event.payload.share_code || event.payload.code)) || '';
  const record = {
    id: event.id || `share_${Date.now()}`,
    type: event.type || 'daily_learning_card',
    code: shareCode,
    share_code: shareCode,
    title: event.title || '',
    path: event.path || '',
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
    share_intent: event.share_intent || (event.payload && event.payload.share_intent) || '',
    created_at: event.created_at || new Date().toISOString()
  };
  const next = [record].concat(list).slice(0, 80);
  set(KEYS.shareRuns, next);
  appendSyncMutation('share_run', {
    id: record.id,
    type: record.type,
    code: record.code,
    share_code: record.share_code,
    title: record.title,
    path: record.path,
    share_intent: record.share_intent,
    payload: record.payload,
    created_at: record.created_at
  });
  return next;
}

function randomPart() {
  return Math.random().toString(36).slice(2, 10);
}

function loadClientIdentity() {
  const existing = get(KEYS.clientIdentity, null);
  if (existing && existing.client_id) return existing;
  return set(KEYS.clientIdentity, {
    client_id: `local_${Date.now()}_${randomPart()}`,
    user_id: '',
    auth_mode: 'local',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

function saveClientIdentity(patch = {}) {
  const current = loadClientIdentity();
  return set(KEYS.clientIdentity, Object.assign({}, current, patch, {
    updated_at: new Date().toISOString()
  }));
}

function loadSyncState() {
  return get(KEYS.syncState, {
    enabled: false,
    cursor: '',
    version: 1,
    last_success_at: '',
    last_attempt_at: '',
    last_error: '',
    mode: 'local_queue'
  });
}

function saveSyncState(patch = {}) {
  const current = loadSyncState();
  return set(KEYS.syncState, Object.assign({}, current, patch, {
    updated_at: new Date().toISOString()
  }));
}

function loadSyncQueue() {
  const list = get(KEYS.syncQueue, []);
  return Array.isArray(list) ? list : [];
}

function mutationEntity(type, payload = {}) {
  const entityId = payload.id
    || payload.target_id
    || payload.module_id
    || payload.card_id
    || payload.note_id
    || payload.reward_id
    || payload.deck_id
    || '';
  const family = String(type || '').split('_')[0] || 'learning';
  return {
    entity_type: payload.entity_type || family,
    entity_id: String(entityId || '')
  };
}

function appendSyncMutation(type, payload = {}) {
  const identity = loadClientIdentity();
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const entity = mutationEntity(type, safePayload);
  const state = loadSyncState();
  const seq = Number(state.local_seq || 0) + 1;
  const dedupeKey = [
    type,
    entity.entity_id,
    safePayload.created_at || '',
    JSON.stringify(safePayload).slice(0, 120)
  ].join('|');
  const existing = loadSyncQueue();
  if (existing.some((item) => item.dedupe_key === dedupeKey && item.status === 'pending')) {
    return existing.find((item) => item.dedupe_key === dedupeKey && item.status === 'pending');
  }
  const mutation = {
    id: `mut_${Date.now()}_${randomPart()}`,
    type,
    schema_version: 1,
    base_version: Number(safePayload.base_version || safePayload.version || 0),
    local_seq: seq,
    payload: safePayload,
    client_id: identity.client_id,
    entity_type: entity.entity_type,
    entity_id: entity.entity_id,
    dedupe_key: dedupeKey,
    created_at: new Date().toISOString(),
    status: 'pending'
  };
  const next = [mutation].concat(existing).slice(0, 300);
  set(KEYS.syncQueue, next);
  saveSyncState({
    local_seq: seq,
    pending: next.filter((item) => item.status === 'pending').length,
    last_mutation_at: mutation.created_at
  });
  return mutation;
}

function markSyncAttempt(result = {}) {
  const ok = !!result.ok;
  const acknowledged = Array.isArray(result.acknowledged) ? result.acknowledged : [];
  const acknowledgedSet = new Set(acknowledged);
  const queue = loadSyncQueue();
  const now = new Date().toISOString();
  const next = ok
    ? queue.map((item) => (acknowledgedSet.has(item.id) || acknowledgedSet.has(item.mutation_id || '')
      ? Object.assign({}, item, { status: 'synced', synced_at: now })
      : item)).slice(0, 300)
    : queue;
  if (ok) set(KEYS.syncQueue, next);
  const lastState = loadSyncState();
  return saveSyncState({
    last_attempt_at: now,
    last_success_at: ok ? now : lastState.last_success_at,
    last_error: ok ? '' : (result.error || 'sync_not_available'),
    last_mode: result.mode || lastState.last_mode || '',
    pending: next.filter((item) => item.status === 'pending').length
  });
}

function syncDiagnostics() {
  const queue = loadSyncQueue();
  const state = loadSyncState();
  const byType = {};
  const byEntity = {};
  let pending = 0;
  let synced = 0;
  let failed = 0;
  queue.forEach((item) => {
    const status = item.status || 'pending';
    const type = item.type || 'unknown';
    const entityKey = `${item.entity_type || 'unknown'}:${item.entity_id || ''}`;
    if (!byType[type]) byType[type] = { type, pending: 0, synced: 0, failed: 0, total: 0 };
    byType[type].total += 1;
    byType[type][status] = Number(byType[type][status] || 0) + 1;
    if (!byEntity[entityKey]) byEntity[entityKey] = { entity: entityKey, pending: 0, total: 0 };
    byEntity[entityKey].total += 1;
    if (status === 'pending') {
      pending += 1;
      byEntity[entityKey].pending += 1;
    } else if (status === 'synced') {
      synced += 1;
    } else {
      failed += 1;
    }
  });
  const duplicates = queue.length - Object.keys(queue.reduce((map, item) => {
    map[item.dedupe_key || item.id] = true;
    return map;
  }, {})).length;
  const conflictedEntities = Object.keys(byEntity).filter((key) => byEntity[key].pending > 1);
  return {
    schemaVersion: 1,
    localSeq: Number(state.local_seq || 0),
    pending,
    synced,
    failed,
    duplicates,
    conflictedEntities,
    conflictSafe: duplicates === 0,
    lastSuccessAt: state.last_success_at || '',
    lastAttemptAt: state.last_attempt_at || '',
    lastError: state.last_error || '',
    byType: Object.keys(byType).map((key) => byType[key]).sort((a, b) => b.pending - a.pending || b.total - a.total),
    label: pending
      ? `Local queue has ${pending} pending mutations across ${Object.keys(byType).length} types.`
      : 'Local sync queue is clean.'
  };
}

function loadFocusCabinHistory() {
  const list = get('ydzx.focus.cabin.history.v1', []);
  return Array.isArray(list) ? list : [];
}

function buildLearningSyncSnapshot(reason = 'manual_snapshot') {
  const identity = loadClientIdentity();
  const todaySession = loadRawTodaySession() || getTodaySession();
  const reviewCards = loadReviewCards().slice(0, 40);
  const reviewEvents = loadReviewEvents().slice(0, 80);
  const tutorEvents = loadTutorEvents().slice(0, 80);
  const tutorMessages = get(KEYS.tutorMessages, []);
  const thinkingReceipts = loadThinkingReceipts ? loadThinkingReceipts().slice(0, 40) : [];
  const focusHistory = loadFocusCabinHistory().slice(0, 40);
  const gameProfile = loadGameProfile();
  return {
    version: 1,
    reason,
    identity,
    created_at: new Date().toISOString(),
    todaySession,
    reviewCards,
    reviewEvents,
    tutorEvents,
    tutorMessages: Array.isArray(tutorMessages) ? tutorMessages.slice(-20) : [],
    thinkingReceipts,
    focusHistory,
    gameProfile,
    syncDiagnostics: syncDiagnostics()
  };
}

function createLocalBackup(reason = 'manual_backup') {
  const snapshot = buildLearningSyncSnapshot(reason);
  const list = get(KEYS.localBackup, []);
  const next = [snapshot].concat(Array.isArray(list) ? list : []).slice(0, 3);
  set(KEYS.localBackup, next);
  return snapshot;
}

function queueLearningSyncSnapshot(reason = 'learning_state_snapshot') {
  const snapshot = buildLearningSyncSnapshot(reason);
  appendSyncMutation('learning_state_snapshot', {
    id: `learning_snapshot_${snapshot.todaySession && snapshot.todaySession.date ? snapshot.todaySession.date : localDateString()}`,
    reason,
    snapshot,
    created_at: snapshot.created_at
  });
  saveSyncState({
    enabled: true,
    last_snapshot_at: snapshot.created_at,
    ready_for_cloud: true
  });
  return snapshot;
}

function buildRecentLearningSummary(nowInput = new Date()) {
  const cards = loadReviewCards();
  const focusHistory = loadFocusCabinHistory();
  const todaySession = loadRawTodaySession() || getTodaySession({ now: nowInput });
  const byDate = {};
  cards.forEach((card) => {
    const date = String(card.date || card.created_at || '').slice(0, 10);
    if (!date) return;
    if (!byDate[date]) {
      byDate[date] = {
        date,
        firstSteps: 0,
        completedFocus: 0,
        interruptedFocus: 0,
        gamePlayed: 0,
        gameScoreTotal: 0,
        gameScoreCount: 0,
        steps: []
      };
    }
    if (card.childArticulatedStep) {
      byDate[date].firstSteps += 1;
      byDate[date].steps.push(card.childArticulatedStep);
    }
    if (card.focusCompletionType === 'completed' || card.focusCompletionType === 'manual_done') byDate[date].completedFocus += 1;
    if (card.focusCompletionType === 'interrupted') byDate[date].interruptedFocus += 1;
    if (Number(card.gameScore || 0) > 0) {
      byDate[date].gamePlayed += 1;
      byDate[date].gameScoreTotal += Number(card.gameScore || 0);
      byDate[date].gameScoreCount += 1;
    }
  });
  focusHistory.forEach((item) => {
    const date = String(item.completedAt || item.interruptedAt || item.startedAt || '').slice(0, 10);
    if (!date) return;
    if (!byDate[date]) byDate[date] = { date, firstSteps: 0, completedFocus: 0, interruptedFocus: 0, gamePlayed: 0, gameScoreTotal: 0, gameScoreCount: 0, steps: [] };
    if (item.completionType === 'completed' || item.completionType === 'manual_done') byDate[date].completedFocus += 1;
    if (item.completionType === 'interrupted') byDate[date].interruptedFocus += 1;
    if (item.linkedChildArticulatedStep) byDate[date].steps.push(item.linkedChildArticulatedStep);
  });
  if (todaySession && todaySession.date) {
    if (!byDate[todaySession.date]) byDate[todaySession.date] = { date: todaySession.date, firstSteps: 0, completedFocus: 0, interruptedFocus: 0, gamePlayed: 0, gameScoreTotal: 0, gameScoreCount: 0, steps: [] };
    if (todaySession.childArticulatedStep) {
      byDate[todaySession.date].firstSteps += 1;
      byDate[todaySession.date].steps.push(todaySession.childArticulatedStep);
    }
    if (todaySession.gamePlayed) {
      byDate[todaySession.date].gamePlayed += 1;
      byDate[todaySession.date].gameScoreTotal += Number((todaySession.gameEvidence && todaySession.gameEvidence.score) || 0);
      byDate[todaySession.date].gameScoreCount += 1;
    }
  }
  const days = Object.keys(byDate).sort().reverse().map((date) => {
    const item = byDate[date];
    return Object.assign({}, item, {
      representativeStep: item.steps[0] || '',
      gameAvg: item.gameScoreCount ? Math.round(item.gameScoreTotal / item.gameScoreCount) : 0
    });
  });
  const latest3 = days.slice(0, 3);
  const latest7 = days.slice(0, 7);
  const firstStepDays = latest7.filter((item) => item.firstSteps > 0).length;
  const focusDays = latest7.filter((item) => item.completedFocus > 0 || item.interruptedFocus > 0).length;
  const gameDays = latest7.filter((item) => item.gamePlayed > 0).length;
  return {
    days,
    latest3,
    latest7,
    threeNightText: latest3.length >= 3
      ? `最近 3 晚有 ${latest3.filter((item) => item.firstSteps > 0).length} 晚说出了第一步，${latest3.filter((item) => item.completedFocus > 0).length} 晚完成了专注。`
      : '再用两晚后，咕点会帮你看见模式。',
    sevenNightText: latest7.length >= 7
      ? `最近 7 晚有 ${firstStepDays} 晚确认第一步、${focusDays} 晚留下专注记录、${gameDays} 晚做了轻练。`
      : '用满 7 晚后，咕点再整理一条更稳的复盘线索。',
    firstStepDays,
    focusDays,
    gameDays
  };
}

function loadReviewLoop() {
  return get(KEYS.reviewLoop, {
    lives: 5,
    max_lives: 5,
    streak_freeze: 1,
    current_streak: 0,
    longest_streak: 0,
    bonus_xp: 0,
    claimed_rewards: {},
    last_review_day: '',
    last_life_refill_day: '',
    leaderboard: [],
    updated_at: ''
  });
}

function claimReviewReward(reward = {}) {
  const id = reward.id || '';
  if (!id) return { claimed: false, reason: 'missing_reward_id', loop: loadReviewLoop() };
  const current = loadReviewLoop();
  const claimed = current.claimed_rewards || {};
  if (claimed[id]) return { claimed: false, reason: 'already_claimed', loop: current };
  const maxLives = Math.max(1, Number(current.max_lives || 5));
  const xp = Number(reward.xp || reward.rewardXp || 0);
  const lives = Math.max(0, Math.min(maxLives, Number(current.lives || maxLives) + Number(reward.lives || 0)));
  const next = saveReviewLoop(Object.assign({}, current, {
    lives,
    bonus_xp: Number(current.bonus_xp || 0) + Math.max(0, xp),
    streak_freeze: Number(current.streak_freeze || 0) + Number(reward.streakFreeze || 0),
    claimed_rewards: Object.assign({}, claimed, {
      [id]: Object.assign({}, reward, {
        claimed_at: new Date().toISOString()
      })
    })
  }));
  appendSyncMutation('review_reward_claimed', {
    reward_id: id,
    xp,
    lives: Number(reward.lives || 0),
    streakFreeze: Number(reward.streakFreeze || 0)
  });
  return { claimed: true, loop: next };
}

function saveReviewLoop(loop) {
  return set(KEYS.reviewLoop, Object.assign({}, loop || {}, {
    updated_at: new Date().toISOString()
  }));
}

function updateReviewLoopForRating(rating, streak = 0) {
  const today = new Date().toISOString().slice(0, 10);
  const current = loadReviewLoop();
  const maxLives = Math.max(1, Number(current.max_lives || 5));
  const refill = current.last_life_refill_day === today ? Number(current.lives || maxLives) : maxLives;
  const lost = rating === 'again' ? 1 : 0;
  const gained = rating === 'easy' ? 1 : 0;
  const lives = Math.max(0, Math.min(maxLives, refill - lost + gained));
  const lastDay = current.last_review_day || '';
  const gapDays = lastDay ? Math.floor((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${lastDay}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000)) : 0;
  const missedDays = Math.max(0, gapDays - 1);
  const freeze = Math.max(0, Number(current.streak_freeze || 0));
  const freezeUsed = missedDays ? Math.min(freeze, missedDays) : 0;
  const protectedGap = missedDays > 0 && freezeUsed >= missedDays;
  const baseStreak = Number(current.current_streak || streak || 0);
  const currentStreak = !lastDay
    ? 1
    : lastDay === today
      ? Math.max(1, baseStreak, Number(streak || 0))
      : gapDays <= 1 || protectedGap
        ? Math.max(1, baseStreak + 1)
        : 1;
  return saveReviewLoop(Object.assign({}, current, {
    lives,
    max_lives: maxLives,
    current_streak: currentStreak,
    streak_freeze: Math.max(0, freeze - freezeUsed),
    last_freeze_used_at: freezeUsed ? new Date().toISOString() : current.last_freeze_used_at,
    longest_streak: Math.max(Number(current.longest_streak || 0), currentStreak, Number(streak || 0)),
    last_review_day: today,
    last_life_refill_day: today
  }));
}

function localLeaderboardSnapshot(profile = {}, progress = {}) {
  const loop = loadReviewLoop();
  const name = profile.name || 'Local learner';
  const self = {
    rank: 1,
    name,
    xp: Number(progress.xp || 0),
    streak: Number(progress.streak || 0),
    isSelf: true
  };
  const peers = Array.isArray(loop.leaderboard) ? loop.leaderboard : [];
  return [self].concat(peers).sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0)).slice(0, 8)
    .map((item, index) => Object.assign({}, item, { rank: index + 1 }));
}

function rcNowIso() {
  return new Date().toISOString();
}

function rcTodayKey() {
  return rcNowIso().slice(0, 10);
}

function loadUserFirstStepProfile() {
  const profile = get(KEYS.firstStepProfile, { version: 1, events: [], qualityTimeline: [] });
  return Object.assign({ version: 1, events: [], qualityTimeline: [] }, profile || {});
}

function saveUserFirstStepProfile(profile = {}) {
  const next = Object.assign({ version: 1, events: [], qualityTimeline: [] }, profile || {}, {
    updatedAt: rcNowIso()
  });
  next.events = Array.isArray(next.events) ? next.events.slice(0, 240) : [];
  next.qualityTimeline = Array.isArray(next.qualityTimeline) ? next.qualityTimeline.slice(0, 240) : [];
  return set(KEYS.firstStepProfile, next);
}

function loadTaskTypePattern() {
  const pattern = get(KEYS.taskTypePattern, { version: 1, byTaskType: {}, latestIntervention: null });
  return Object.assign({ version: 1, byTaskType: {}, latestIntervention: null }, pattern || {});
}

function saveTaskTypePattern(pattern = {}) {
  return set(KEYS.taskTypePattern, Object.assign({ version: 1, byTaskType: {}, latestIntervention: null }, pattern || {}, {
    updatedAt: rcNowIso()
  }));
}

function taskTypeLabel(type) {
  return {
    math_word_problem: '数学应用题',
    equation_setup: '列方程',
    reading_question: '阅读题',
    english_sentence: '英语句子',
    writing_process: '写作',
    dictation: '听写',
    daily_math: '口算',
    light_diagnosis: '手动选题型',
    unknown: '当前题型'
  }[type] || '当前题型';
}

function deepScaffoldingTemplates(type = 'unknown') {
  const map = {
    math_word_problem: ['先把题干里的已知条件圈出来。', '现在把两个条件连起来，问一句：它们有什么关系？', '最后再想：这个关系能不能写成一个式子？'],
    equation_setup: ['先把未知数写成 x。', '再找一句能表示相等关系的话。', '最后把两边分别写出来，不急着算。'],
    reading_question: ['先看题目问的是细节、主旨还是原因。', '再回到对应段落，找到题目里重复或相近的词。', '最后用自己的话说出这一句为什么相关。'],
    english_sentence: ['先找主语和谓语。', '再看动作发生在什么时候。', '最后看句子里有没有固定结构或连接词。'],
    writing_process: ['先写一句最简单的开头。', '再补一个具体例子或画面。', '最后检查这一段是不是围绕同一个意思。'],
    dictation: ['先听清第一个词。', '再确认你先看的是拼音、字形还是意思。', '最后把不确定的那一笔圈出来。'],
    daily_math: ['先看清符号。', '再看有没有进位或退位。', '最后只检查这一步，不急着重做整题。'],
    light_diagnosis: ['先判断这道题像哪一类。', '再圈出题目真正问的内容。', '最后只写准备开始的第一步。'],
    unknown: ['先说清楚题目问什么。', '再找一个能下手的位置。', '最后把这一步写成一句话。']
  };
  return (map[type] || map.unknown).slice();
}

function buildSecondStepHint(type = 'unknown', firstStep = '') {
  const steps = deepScaffoldingTemplates(type);
  return {
    taskType: type,
    firstStep: firstStep || steps[0],
    secondStep: steps[1],
    thirdStep: steps[2],
    boundary: '这不是答案，是下一小步提示。'
  };
}

function updateTaskTypePatternForEvent(event = {}) {
  const type = event.taskType || 'unknown';
  const pattern = loadTaskTypePattern();
  const byTaskType = Object.assign({}, pattern.byTaskType || {});
  const current = Object.assign({
    taskType: type,
    total: 0,
    firstStepQualityCounts: { empty: 0, vague: 0, partial: 0, actionable: 0 },
    secondStepIndependentCount: 0,
    recentQualities: [],
    recentFirstSteps: []
  }, byTaskType[type] || {});
  const quality = event.childStepQuality || childStepQuality(event.childArticulatedStep || event.childStepSentence || event.firstStepText || '');
  current.total += 1;
  current.firstStepQualityCounts[quality] = Number(current.firstStepQualityCounts[quality] || 0) + 1;
  if (event.secondStepStatus === 'independent') current.secondStepIndependentCount += 1;
  current.recentQualities = [quality].concat(current.recentQualities || []).slice(0, 7);
  current.recentFirstSteps = [event.childArticulatedStep || event.childStepSentence || event.firstStepText || ''].concat(current.recentFirstSteps || []).filter(Boolean).slice(0, 7);
  current.updatedAt = rcNowIso();
  byTaskType[type] = current;
  const next = Object.assign({}, pattern, { byTaskType });
  const intervention = detectAvoidancePattern(next);
  if (intervention.triggered) next.latestIntervention = intervention;
  return saveTaskTypePattern(next);
}

function recordFirstStepEvent(event = {}) {
  const taskType = event.taskType || detectTaskType(event.stuckPointText || event.prompt || event.sourceText || '', event.feature || '');
  const sentence = event.childArticulatedStep || event.childStepSentence || event.firstStepText || '';
  const quality = event.childStepQuality || childStepQuality(sentence);
  const normalized = {
    id: event.id || `first_step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    day: event.day || rcTodayKey(),
    source: event.source || event.feature || 'first_step',
    taskType,
    stuckPointText: event.stuckPointText || event.prompt || '',
    systemSuggestedStep: event.systemSuggestedStep || suggestedStepForTaskType(taskType),
    childArticulatedStep: sentence,
    childStepSentence: sentence,
    childStepQuality: quality,
    secondStepStatus: event.secondStepStatus || '',
    createdAt: event.createdAt || rcNowIso()
  };
  const profile = loadUserFirstStepProfile();
  saveUserFirstStepProfile(Object.assign({}, profile, {
    events: [normalized].concat(profile.events || []).slice(0, 240),
    qualityTimeline: [{
      day: normalized.day,
      taskType,
      quality,
      source: normalized.source
    }].concat(profile.qualityTimeline || []).slice(0, 240)
  }));
  updateTaskTypePatternForEvent(normalized);
  if (quality === 'partial' || quality === 'actionable') recordLocalAnalytics('first_step_confirmed', { source: normalized.source, quality });
  return normalized;
}

function recordLightFeatureFirstStep(feature, payload = {}) {
  const taskType = payload.taskType || (feature === 'daily_math' ? 'daily_math' : feature === 'dictation' ? 'dictation' : feature === 'light_diagnosis' ? 'light_diagnosis' : 'unknown');
  const event = recordFirstStepEvent(Object.assign({}, payload, { source: feature, feature, taskType }));
  const events = get(KEYS.lightFeatureEvents, []);
  set(KEYS.lightFeatureEvents, [Object.assign({}, event, { feature })].concat(Array.isArray(events) ? events : []).slice(0, 240));
  return event;
}

function loadLightFeatureEvents() {
  const events = get(KEYS.lightFeatureEvents, []);
  return Array.isArray(events) ? events : [];
}

function detectAvoidancePattern(patternInput = loadTaskTypePattern()) {
  const byTaskType = (patternInput && patternInput.byTaskType) || {};
  const candidates = Object.keys(byTaskType).map((type) => {
    const item = byTaskType[type] || {};
    const avoidCount = (item.recentQualities || []).slice(0, 3).filter((quality) => quality === 'empty' || quality === 'vague').length;
    return { type, avoidCount };
  }).filter((candidate) => candidate.avoidCount >= 3);
  if (!candidates.length) return { triggered: false, reason: 'insufficient_pattern' };
  const selected = candidates.sort((a, b) => b.avoidCount - a.avoidCount)[0];
  return {
    triggered: true,
    taskType: selected.type,
    title: `${taskTypeLabel(selected.type)}第一步微训练`,
    prompt: `连续几次都停在“不会/先看题”，今天只做 3 分钟：先把${taskTypeLabel(selected.type)}的第一步说成一句话。`,
    durationMinutes: 3,
    createdAt: rcNowIso()
  };
}

function loadParentInterventionLog() {
  const list = get(KEYS.parentInterventionLog, []);
  return Array.isArray(list) ? list : [];
}

function appendParentInterventionLog(input = {}) {
  const item = {
    id: input.id || `parent_intervention_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    day: input.day || rcTodayKey(),
    usedProductPhrase: !!input.usedProductPhrase,
    gaveDirectAnswer: !!input.gaveDirectAnswer,
    emotionLevel: Math.max(1, Math.min(5, Number(input.emotionLevel || 3))),
    phrase: input.phrase || '你第一步先看了哪里？',
    source: input.source || 'parent_pause',
    createdAt: input.createdAt || rcNowIso()
  };
  set(KEYS.parentInterventionLog, [item].concat(loadParentInterventionLog()).slice(0, 180));
  return item;
}

function loadScaffoldingChains() {
  const chains = get(KEYS.scaffoldingChains, []);
  return Array.isArray(chains) ? chains : [];
}

function saveScaffoldingChains(chains = []) {
  return set(KEYS.scaffoldingChains, Array.isArray(chains) ? chains.slice(0, 180) : []);
}

function createScaffoldingChain(input = {}) {
  const taskType = input.taskType || detectTaskType(input.stuckPointText || '', input.subject || '');
  const firstStep = input.firstStep || input.childArticulatedStep || suggestedStepForTaskType(taskType);
  const hint = buildSecondStepHint(taskType, firstStep);
  const chain = {
    id: input.id || `chain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    taskType,
    stuckPointText: input.stuckPointText || '',
    firstStepSuggestion: input.systemSuggestedStep || hint.firstStep,
    firstStepChild: input.childArticulatedStep || '',
    secondStepSuggestion: input.secondStepSuggestion || hint.secondStep,
    thirdStepSuggestion: input.thirdStepSuggestion || hint.thirdStep,
    steps: [
      { order: 1, type: 'suggestion', text: input.systemSuggestedStep || hint.firstStep },
      { order: 1, type: 'child_action', text: input.childArticulatedStep || '' },
      { order: 2, type: 'suggestion', text: input.secondStepSuggestion || hint.secondStep }
    ],
    createdAt: rcNowIso(),
    updatedAt: rcNowIso()
  };
  saveScaffoldingChains([chain].concat(loadScaffoldingChains()).slice(0, 180));
  return chain;
}

function appendScaffoldingStep(chainId, step = {}) {
  const next = loadScaffoldingChains().map((chain) => {
    if (chain.id !== chainId) return chain;
    return Object.assign({}, chain, {
      steps: (chain.steps || []).concat(Object.assign({
        order: Number(step.order || (chain.steps || []).length + 1),
        type: step.type || 'child_action',
        text: step.text || '',
        createdAt: rcNowIso()
      }, step || {})),
      updatedAt: rcNowIso()
    });
  });
  saveScaffoldingChains(next);
  return next.find((chain) => chain.id === chainId) || null;
}

function buildExperienceChecklist() {
  const lightEvents = loadLightFeatureEvents();
  const profile = loadUserFirstStepProfile();
  const parentLogs = loadParentInterventionLog();
  const chains = loadScaffoldingChains();
  const checklist = [
    { id: 'light_daily_active', label: '轻功能日活', field: 'light_feature_daily_active', done: lightEvents.length >= 3 },
    { id: 'deep_service_started', label: '深度服务启动率', field: 'deep_service_started', done: chains.length > 0 },
    { id: 'parent_phrase_used', label: '家长话术实际使用率', field: 'parent_phrase_used', done: parentLogs.some((item) => item.usedProductPhrase) },
    { id: 'second_step_success', label: '孩子第二步成功率', field: 'child_second_step_status', done: (profile.events || []).some((item) => item.secondStepStatus) }
  ];
  set(KEYS.experienceChecklist, checklist);
  return checklist;
}

function loadValidationSprintState() {
  const state = get(KEYS.validationSprint, { version: 1, events: [], counters: {} });
  return Object.assign({ version: 1, events: [], counters: {} }, state || {});
}

function saveValidationSprintState(state = {}) {
  const next = Object.assign({ version: 1, events: [], counters: {} }, state || {}, {
    updatedAt: rcNowIso()
  });
  next.events = Array.isArray(next.events) ? next.events.slice(0, 500) : [];
  next.counters = next.counters || {};
  return set(KEYS.validationSprint, next);
}

function appendValidationEvent(type, payload = {}) {
  const state = loadValidationSprintState();
  const event = Object.assign({
    id: `validation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    createdAt: rcNowIso()
  }, payload || {});
  const counters = Object.assign({}, state.counters || {});
  counters[type] = Number(counters[type] || 0) + 1;
  saveValidationSprintState(Object.assign({}, state, {
    events: [event].concat(state.events || []).slice(0, 500),
    counters
  }));
  return event;
}

function recordLightEntryCompletion(feature, payload = {}) {
  const key = feature === 'daily_math' ? 'mathCompletionTime' : feature === 'dictation' ? 'dictationCompletionTime' : 'lightDiagnosisCompletionTime';
  recordLocalAnalytics('light_entry_completed', { feature });
  return appendValidationEvent('light_entry_completed', Object.assign({
    feature,
    [key]: payload.completionTime || rcNowIso()
  }, payload || {}));
}

function recordLightToCoreTransition(feature, clicked, payload = {}) {
  const clickKey = feature === 'daily_math' ? 'mathToDiagnosisClick' : feature === 'dictation' ? 'dictationToDiagnosisClick' : 'lightDiagnosisToDiagnosisClick';
  return appendValidationEvent('light_to_core_transition', Object.assign({
    feature,
    clicked: !!clicked,
    [clickKey]: !!clicked,
    transitionTime: rcNowIso()
  }, payload || {}));
}

function recordCoreLoopEntry(source = 'unknown', payload = {}) {
  recordLocalAnalytics('core_loop_entered', { source });
  return appendValidationEvent('core_loop_entered', Object.assign({
    source,
    enteredAt: rcNowIso()
  }, payload || {}));
}

function recordProfileVisit(payload = {}) {
  recordLocalAnalytics('profile_viewed', payload);
  return appendValidationEvent('profile_visit', Object.assign({
    visitedAt: rcNowIso()
  }, payload || {}));
}

function recordServiceIntent(source = 'profile_warning', payload = {}) {
  recordLocalAnalytics('service_intent_clicked', { source });
  return appendValidationEvent('service_intent_clicked', Object.assign({
    source,
    clickedAt: rcNowIso()
  }, payload || {}));
}

function recordParentPauseUsed(payload = {}) {
  return appendValidationEvent('parent_pause_used', Object.assign({
    parentUsedPause: true,
    usedAt: rcNowIso()
  }, payload || {}));
}

function recordParentPostPauseBehavior(behavior, payload = {}) {
  const normalized = ['direct_answer', 'asked_one_question', 'let_child_think', 'left_alone'].includes(behavior)
    ? behavior
    : 'unknown';
  appendParentInterventionLog({
    source: 'post_pause_survey',
    usedProductPhrase: normalized === 'asked_one_question',
    gaveDirectAnswer: normalized === 'direct_answer',
    emotionLevel: payload.emotionLevel || 3,
    phrase: payload.phrase || '你第一步先看了哪里？'
  });
  return appendValidationEvent('parent_post_pause_behavior', Object.assign({
    parentPostPauseBehavior: normalized,
    answeredAt: rcNowIso()
  }, payload || {}));
}

function saveBetaTester(value = true) {
  return set(KEYS.betaTester, { isBetaTester: !!value, updatedAt: rcNowIso() });
}

function isBetaTester() {
  const beta = get(KEYS.betaTester, { isBetaTester: true });
  return beta && beta.isBetaTester !== false;
}

function validationEventsByType(type) {
  return (loadValidationSprintState().events || []).filter((event) => event && event.type === type);
}

function withinHours(later, earlier, hours) {
  const laterTime = new Date(later || 0).getTime();
  const earlierTime = new Date(earlier || 0).getTime();
  if (!laterTime || !earlierTime) return false;
  return laterTime >= earlierTime && laterTime - earlierTime <= hours * 60 * 60 * 1000;
}

function calculateValidationDashboard() {
  const validationEvents = loadValidationSprintState().events || [];
  const lightEvents = loadLightFeatureEvents();
  const firstProfile = loadUserFirstStepProfile();
  const chains = loadScaffoldingChains();
  const parentLogs = loadParentInterventionLog();
  const today = rcTodayKey();

  const completedLight = validationEvents.filter((event) => event.type === 'light_entry_completed');
  const lightToday = completedLight.filter((event) => String(event.createdAt || '').slice(0, 10) === today).length
    || lightEvents.filter((event) => String(event.createdAt || '').slice(0, 10) === today).length;
  const coreEntries = validationEvents.filter((event) => event.type === 'core_loop_entered' || (event.type === 'light_to_core_transition' && event.clicked));
  const converted = completedLight.filter((complete) => coreEntries.some((entry) => (
    entry.feature === complete.feature && withinHours(entry.createdAt || entry.transitionTime || entry.enteredAt, complete.createdAt, 24)
  ))).length;

  const qualityCounts = { empty: 0, vague: 0, partial: 0, actionable: 0 };
  (firstProfile.qualityTimeline || []).slice(0, 7).forEach((item) => {
    const quality = item && item.quality;
    if (Object.prototype.hasOwnProperty.call(qualityCounts, quality)) qualityCounts[quality] += 1;
  });

  const firstStepDone = chains.length;
  const secondStepAttempt = chains.filter((chain) => (chain.steps || []).some((step) => Number(step.order) === 2)).length;
  const secondStepDone = chains.filter((chain) => (chain.steps || []).some((step) => Number(step.order) === 2 && step.completed)).length;

  const directAnswer = parentLogs.filter((item) => item.gaveDirectAnswer).length;
  const usedPhrase = parentLogs.filter((item) => item.usedProductPhrase).length;
  const pauseUsed = validationEvents.filter((event) => event.type === 'parent_pause_used').length;
  const profileVisits = validationEvents.filter((event) => event.type === 'profile_visit').length;
  const serviceClicks = validationEvents.filter((event) => event.type === 'service_intent_clicked').length;

  return {
    lightEntryDAU: lightToday,
    coreLoopEntryRate: completedLight.length ? Math.round((converted / completedLight.length) * 100) : 0,
    firstStepQualityTrend: qualityCounts,
    scaffoldingCompletionRate: {
      firstStepDone,
      secondStepAttempt,
      secondStepDone,
      attemptRate: firstStepDone ? Math.round((secondStepAttempt / firstStepDone) * 100) : 0,
      completionRate: secondStepAttempt ? Math.round((secondStepDone / secondStepAttempt) * 100) : 0
    },
    parentInterventionRate: {
      directAnswer,
      usedPhrase,
      pauseUsed,
      directAnswerRate: parentLogs.length ? Math.round((directAnswer / parentLogs.length) * 100) : 0
    },
    serviceIntentRate: {
      serviceClicks,
      profileVisits,
      rate: profileVisits ? Math.round((serviceClicks / profileVisits) * 100) : 0
    }
  };
}

function buildParentActionGuide(input = {}) {
  const pattern = loadTaskTypePattern();
  const parentLogs = loadParentInterventionLog();
  const profile = loadUserFirstStepProfile();
  const recentEvents = (profile.events || []).slice(0, 7);
  const latestType = (recentEvents[0] && recentEvents[0].taskType) || 'unknown';
  const latestPattern = ((pattern.byTaskType || {})[latestType]) || {};
  return {
    tonightRecap: input.tonightRecap || '今晚先看孩子有没有说出自己的第一步。',
    weekPattern: latestPattern.total ? `本周先观察：${taskTypeLabel(latestType)}里，孩子第一步记录 ${latestPattern.total} 次。` : '本周模式还不够，先连续记录 3 晚。',
    monthSuggestion: '接下来 7 天，每晚只问这一句：你第一步先看了哪里？',
    parentPhraseTraining: {
      title: '21 天家长话术训练营',
      unlockedBySubscription: true,
      preview: '先练“少讲答案，多问对一句”。'
    },
    usedPhraseCount: parentLogs.filter((item) => item && item.usedProductPhrase).length,
    experienceChecklist: buildExperienceChecklist()
  };
}

function topCountKey(counter) {
  return Object.keys(counter || {}).sort((a, b) => counter[b] - counter[a])[0] || '';
}

function familyCalibrationProfile() {
  const feedbackList = loadFeedback();
  const moduleEvents = loadModuleEvents();
  const moduleFeedback = loadModuleFeedback();
  const tutorEvents = loadTutorEvents();
  const reviewEvents = loadReviewEvents();
  const reviewCards = loadReviewCards();
  const reviewNotes = loadReviewNotes();
  const profile = loadProfile();
  const state = loadState() || {};

  const accurate = feedbackList.filter((item) => item.rating === 'accurate').length;
  const off = feedbackList.filter((item) => item.rating === 'off').length;
  const viewed = moduleEvents.filter((item) => item.event === 'module_viewed').length;
  const started = moduleEvents.filter((item) => item.event === 'module_started').length;
  const useful = moduleFeedback.filter((item) => item.rating === 'useful').length;
  const notUseful = moduleFeedback.filter((item) => item.rating === 'not_useful').length;
  const tutorCompleted = tutorEvents.filter((item) => item.event === 'tutor_mastery_ready').length;
  const tutorBlocked = tutorEvents.filter((item) => item.blocked || item.mastery_status === 'blocked_answer_request').length;
  const reviewed = reviewEvents.length;
  const reviewGood = reviewEvents.filter((item) => ['good', 'easy'].includes(item.rating)).length;

  const subjectCounter = {};
  moduleEvents.concat(moduleFeedback).forEach((item) => {
    if (!item.subject) return;
    subjectCounter[item.subject] = (subjectCounter[item.subject] || 0) + 1;
  });

  const calibrationCounter = {};
  feedbackList.forEach((item) => {
    if (!item.calibration_key) return;
    calibrationCounter[item.calibration_key] = (calibrationCounter[item.calibration_key] || 0) + 1;
  });

  const topSubject = topCountKey(subjectCounter) || profile.subject || '';
  const topCalibrationKey = topCountKey(calibrationCounter);
  const topWeakPoint = (((state.weak_points || [])[0] || {}).name) || '';
  const homeworkTotal = accurate + off;
  const moduleFeedbackTotal = useful + notUseful;
  const accuracyRate = homeworkTotal ? Math.round((accurate / homeworkTotal) * 100) : 0;
  const fitRate = moduleFeedbackTotal ? Math.round((useful / moduleFeedbackTotal) * 100) : 0;
  const startRate = viewed ? Math.round((started / viewed) * 100) : 0;
  const moduleCompletionRate = started ? Math.round((tutorCompleted / started) * 100) : 0;

  const signals = [];

  if (homeworkTotal >= 3) {
    signals.push(
      accuracyRate >= 70 ? '作业判断开始贴近真实情况' : '作业判断还需要继续校准'
    );
  } else if (homeworkTotal > 0) {
    signals.push('已开始积累作业判断校准记录');
  }

  if (moduleFeedbackTotal >= 3) {
    signals.push(
      fitRate >= 60 ? '学习模块适配度开始收敛' : '学习模块仍在探索更适合的练法'
    );
  } else if (viewed || started) {
    signals.push('已开始积累学习模块适配反馈');
  }

  if (topSubject) {
    signals.push(`高频学科：${topSubject}`);
  }

  if (tutorCompleted) {
    signals.push(`作业点拨已形成 ${tutorCompleted} 次掌握记录`);
  }

  if (tutorBlocked) {
    signals.push(`出现 ${tutorBlocked} 次直接要答案倾向`);
  }

  if (reviewed) {
    signals.push(`已完成 ${reviewed} 次错因复习`);
  }

  if (topWeakPoint) {
    signals.push(`当前高频卡点：${topWeakPoint}`);
  }

  if (topCalibrationKey) {
    signals.push(`最常出现的校准点：${topCalibrationKey}`);
  }

  let label = '还没有足够记录形成画像';
  if (homeworkTotal || viewed || started || moduleFeedbackTotal) {
    label = '正在形成家庭校准画像';
  }
  if (homeworkTotal >= 3 && moduleFeedbackTotal >= 3) {
    label = accuracyRate >= 70 && fitRate >= 60
      ? '已形成初步家庭校准画像'
      : '已有画像雏形，仍需继续校准';
  }

  return {
    homework: {
      total: homeworkTotal,
      accurate,
      off,
      accuracyRate,
      topCalibrationKey
    },
    modules: {
      viewed,
      started,
      useful,
      notUseful,
      fitRate,
      startRate,
      completed: tutorCompleted,
      completionRate: moduleCompletionRate,
      topSubject
    },
    tutor: tutorEventSummary(),
    review: {
      totalCards: reviewCards.length,
      totalNotes: reviewNotes.length,
      reviewed,
      accuracyRate: reviewed ? Math.round((reviewGood / reviewed) * 100) : 0
    },
    weakPoint: topWeakPoint,
    signals: signals.slice(0, 5),
    label
  };
}

module.exports = {
  KEYS,
  ensureLocalUserId,
  getLocalUserId,
  getUserKey,
  COMPANION_OPTIONS,
  get,
  set,
  remove,
  clearLearningData,
  loadLocalAnalytics,
  recordLocalAnalytics,
  localAnalyticsDashboard,
  isFirstTime,
  markFirstRunGuideSeen,
  loadInviteLedger,
  recordInvite,
  loadLocalFeedback,
  saveLocalFeedback,
  loadCompanionPreference,
  saveCompanionPreference,
  companionCopyFor,
  getCompanionStageCopy,
  formatCompanionLine,
  classifyIssueType,
  isValidMiniActionText,
  detectTaskType,
  firstStepTemplatesForTaskType,
  suggestedStepForTaskType,
  childStepQuality,
  normalizeFirstStepEvidence,
  saveChildArticulatedStep,
  formatIssueType,
  formatRouteStage,
  formatSourceLabel,
  formatInternalLabel,
  getGrowthMemoryLine,
  growthMemoryCopyFor,
  buildWeeklyGrowthMemory,
  loadState,
  saveState,
  loadProfile,
  saveProfile,
  loadLearningReportState,
  saveLearningReportState,
  saveLearningReportSource,
  buildLearningReportFromInput,
  loadParentGoal,
  saveParentGoal,
  loadTodayFocus,
  saveTodayFocus,
  saveTodayFocusFromThought,
  updateTodayFocusRepair,
  getTodaySession,
  saveTodaySession,
  archiveYesterdaySession,
  getYesterdayReview,
  generateReviewCard,
  recordFocusSessionEvidence,
  markReviewCardRevisited,
  canStartFocusFromTodaySession,
  parentQuestionFromFirstStep,
  wrongCauseFromFirstStep,
  isYesterday,
  buildBlackboardHint,
  ensureTodayFocusReviewCard,
  loadTonightPlan,
  saveTonightPlan,
  createTonightPlanFromInput,
  updateTonightRouteStatus,
  loadFeedback,
  appendFeedback,
  feedbackSummary,
  loadPilotRuns,
  appendPilotRun,
  pilotRunSummary,
  loadFactoryEvents,
  appendFactoryEvent,
  factoryEventSummary,
  loadModuleEvents,
  trackModuleEvent,
  moduleEventSummary,
  loadModuleFeedback,
  appendModuleFeedback,
  moduleFeedbackMap,
  loadTutorEvents,
  trackTutorEvent,
  tutorEventSummary,
  loadThinkingReceipts,
  appendThinkingReceipt,
  thinkingReceiptSummary,
  loadReviewDeck,
  saveReviewDeck,
  loadReviewNotes,
  saveReviewNotes,
  loadReviewCards,
  saveReviewCards,
  loadReviewEvents,
  appendReviewEvent,
  loadGameProfile,
  saveGameProfile,
  addGameXP,
  recordGameSessionResult,
  loadGamePurchases,
  saveGamePurchase,
  loadShareRuns,
  loadIncomingShare,
  saveIncomingShare,
  appendShareRun,
  loadClientIdentity,
  saveClientIdentity,
  loadSyncState,
  saveSyncState,
  loadSyncQueue,
  appendSyncMutation,
  markSyncAttempt,
  syncDiagnostics,
  buildLearningSyncSnapshot,
  createLocalBackup,
  queueLearningSyncSnapshot,
  buildRecentLearningSummary,
  loadReviewLoop,
  saveReviewLoop,
  updateReviewLoopForRating,
  claimReviewReward,
  localLeaderboardSnapshot,
  loadUserFirstStepProfile,
  saveUserFirstStepProfile,
  loadTaskTypePattern,
  saveTaskTypePattern,
  taskTypeLabel,
  deepScaffoldingTemplates,
  buildSecondStepHint,
  recordFirstStepEvent,
  recordLightFeatureFirstStep,
  loadLightFeatureEvents,
  detectAvoidancePattern,
  loadParentInterventionLog,
  appendParentInterventionLog,
  loadScaffoldingChains,
  saveScaffoldingChains,
  createScaffoldingChain,
  appendScaffoldingStep,
  buildParentActionGuide,
  buildExperienceChecklist,
  loadValidationSprintState,
  saveValidationSprintState,
  appendValidationEvent,
  recordLightEntryCompletion,
  recordLightToCoreTransition,
  recordCoreLoopEntry,
  recordProfileVisit,
  recordServiceIntent,
  recordParentPauseUsed,
  recordParentPostPauseBehavior,
  saveBetaTester,
  isBetaTester,
  validationEventsByType,
  calculateValidationDashboard,
  familyCalibrationProfile
};
