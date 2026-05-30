const priority = require('./learning-priority');
function createShareRelaySchemaFallback() {
  const allowlist = [
    'code',
    'share_intent',
    'share',
    'from',
    'mode',
    'challenge',
    'share_code',
    'invite_code',
    'identity_tag',
    'tonight_action',
    'parent_question',
    'tomorrow_check',
    'report_daily_action',
    'unified_next_action',
    'unified_next_action_route',
    'parent_next_action',
    'next_challenge',
    'share_challenge_goal',
    'share_challenge_rule',
    'share_challenge_route',
    'share_privacy_boundary',
    'share_return_contract',
    'safe_relay_allowed_fields',
    'safe_relay_blocked_fields',
    'relay_id',
    'relay_first_step',
    'relay_receiver_action',
    'relay_parent_check',
    'relay_next_revisit',
    'relay_allowed_fields',
    'relay_blocked_fields',
    'relay_completion_signal',
    'relay_return_path',
    'wrong_cause_label',
    'wrong_cause_first_step',
    'wrong_cause_parent_check',
    'wrong_cause_receiver_action',
    'wrong_cause_next_revisit',
    'wrong_cause_allowed_fields',
    'wrong_cause_blocked_fields',
    'receiver_material_required',
    'receiver_first_step_required',
    'receiver_wrong_cause_required',
    'receiver_revisit_required',
    'receiver_evidence_contract',
    'openmaic_bridge_status',
    'openmaic_next_action',
    'openmaic_share_boundary',
    'openmaic_game_gate',
    'openmaic_blocked_fields',
    'openmaic_evidence',
    'openmaic_return_path'
  ];
  const denylist = ['original_question', 'original_answer', 'photo', 'raw_text', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'private_comment', 'classmate_comparison', 'teacher_private_comment', 'complete_transcript', 'talent_label', 'personality_label', 'fixed_learning_style', 'score_ranking', 'guaranteed_result', 'child_name', 'parent_phone', 'parent_wechat', 'contact_info'];
  function isAllowed(key) {
    return allowlist.indexOf(key) >= 0
      && denylist.indexOf(key) < 0
      && !/answer|solution|photo|score|rank|transcript|talent|personality|guarantee|child_name|parent_phone|parent_wechat|contact/i.test(String(key || ''));
  }
  function isDenied(key) {
    return denylist.indexOf(key) >= 0 || /answer|solution|photo|score|rank|transcript|child_name|parent_phone|parent_wechat|contact/i.test(String(key || ''));
  }
  function toText(value) {
    return String(value == null ? '' : value).trim();
  }
  function parseShareRelayQuery(query = {}) {
    const safe = {};
    Object.keys(query || {}).forEach((key) => {
      if (isAllowed(key) && !isDenied(key)) safe[key] = toText(query[key]);
    });
    return safe;
  }
  function buildSafeSharePayload(card = {}, intent = 'peer_challenge', extra = {}) {
    return Object.assign({
      share_intent: intent,
      from: 'profile',
      mode: 'safe_relay'
    }, parseShareRelayQuery(Object.assign({}, card.payload || {}, extra || {})));
  }
  return { buildSafeSharePayload, parseShareRelayQuery };
}

let shareRelaySchema = null;
try {
  shareRelaySchema = require('./share-relay-schema');
} catch (error) {
  try {
    shareRelaySchema = require('./share-relay-schema.cjs');
  } catch (fallbackError) {
    shareRelaySchema = createShareRelaySchemaFallback();
  }
}
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

let productReadiness = null;
try {
  productReadiness = require('./product-readiness');
} catch (error) {
  productReadiness = null;
}

let realHomeworkCoverage = null;
try {
  realHomeworkCoverage = require('./real-homework-coverage');
} catch (error) {
  realHomeworkCoverage = null;
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
  realTrialSamples: 'ydzx.real.trial.samples.v1',
  factoryEvents: 'ydzx.factory.events.v1',
  thinkingReceipts: 'ydzx.thinking.receipts.v1',
  reviewDeck: 'ydzx.review.deck.v1',
  reviewNotes: 'ydzx.review.notes.v1',
  reviewCards: 'ydzx.review.cards.v1',
  activeMiniLessonResumeContext: 'ydzx.mini.lesson.resume.context.v1',
  reviewEvents: 'ydzx.review.events.v1',
  gameProfile: 'ydzx.game.profile.v1',
  gamePurchases: 'ydzx.game.purchases.v1',
  shareRuns: 'ydzx.share.runs.v1',
  shareFollowUpQueue: 'ydzx.share.follow.up.queue.v1',
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
  courseUnitProgress: 'ydzx.course.unit.progress.v1',
  surfaceDepthEvents: 'ydzx.surface.depth.events.v1',
  unifiedActionEvents: 'ydzx.unified.action.events.v1',
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
    KEYS.realTrialSamples,
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

function reportRouteTarget(path = '') {
  const value = String(path || '');
  if (value.indexOf('/pages/review/review') === 0) return 'review';
  if (value.indexOf('/pages/entry-detail/entry-detail?scene=today') === 0) return 'focus';
  if (value.indexOf('/pages/profile/profile') === 0) return 'profile';
  if (value.indexOf('/pages/arcade/arcade') === 0) return 'arcade';
  if (value.indexOf('/pages/entry-detail/entry-detail?scene=today') === 0) return 'tools';
  return 'tutor';
}

function firstReportWeakSubject(reportState = {}) {
  const matrix = (reportState.reportDraft && reportState.reportDraft.diagnosisMatrix)
    || reportState.diagnosisMatrix
    || [];
  return matrix.find((item) => item && item.mainCause && item.evidence)
    || matrix[0]
    || {};
}

function safeScoreSubjectId(subject = '') {
  return String(subject || 'subject').replace(/[^\w\u4e00-\u9fa5]+/g, '_').slice(0, 28) || 'subject';
}

function buildScoreReportReturnDeck(reportState = {}) {
  const draft = reportState.reportDraft || {};
  const parsedScores = reportState.parsedScores || draft.parsedScores || {};
  const scoreCards = Object.keys(parsedScores || {})
    .map((key) => {
      const row = parsedScores[key] || {};
      const score = Number(row.score);
      if (!Number.isFinite(score)) return null;
      return {
        subject: row.subject || key,
        score,
        scoreBand: score < 60 ? 'urgent_repair' : score < 75 ? 'weak_foundation' : score < 90 ? 'needs_stability' : 'maintenance',
        source: 'confirmed_score_sheet'
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
  const matrix = (draft.diagnosisMatrix || reportState.diagnosisMatrix || [])
    .filter((item) => item && item.subject);
  const base = scoreCards.length
    ? scoreCards
    : matrix.slice(0, 3).map((item) => ({
      subject: item.subject,
      score: null,
      scoreBand: 'diagnosis_weak_signal',
      source: 'diagnosis_matrix',
      mainCause: item.mainCause || '',
      evidence: item.evidence || ''
    }));
  return base.slice(0, 3).map((item, index) => {
    const subject = item.subject || '\u5f53\u524d\u5361\u70b9';
    const weakCause = item.mainCause || (index === 0 ? '\u6700\u9700\u5148\u56de\u6765\u7684\u5b66\u79d1\u5361\u70b9' : '\u9700\u8981\u7a33\u5b9a\u56de\u8bbf\u7684\u5b66\u79d1\u5361\u70b9');
    return {
      id: `score_return_${safeScoreSubjectId(subject)}_${index + 1}`,
      subject,
      source: item.source,
      priority: index + 1,
      scoreBand: item.scoreBand,
      privateParentScore: Number.isFinite(item.score) ? item.score : null,
      weakCause,
      dailyTask: `\u5148\u56de\u6765\u505a${subject}\u4e00\u5f20\u9519\u56e0\u56de\u8bbf\u5361`,
      publicSignalLine: `\u4eca\u5929\u5148\u4fee${subject}\u7684\u4e00\u4e2a\u9519\u56e0\uff0c\u4e0d\u6652\u5206\u3001\u4e0d\u6392\u540d\u3001\u4e0d\u7528\u5206\u6570\u53d1 XP\u3002`,
      parentLine: `\u5bb6\u957f\u53ea\u95ee\uff1a${subject}\u8fd9\u5f20\u5361\u7b2c\u4e00\u6b65\u5148\u770b\u54ea\u91cc\uff1f`,
      route: `/pages/review/review?from=score_report_return&subject=${safeScoreSubjectId(subject)}`,
      evidenceRequired: ['child_first_step', 'wrong_cause_named', 'next_day_revisit'],
      xpGate: 'XP only releases after first-step recall, wrong-cause naming, and next-day revisit; score/ranking never drives reward.',
      blockedFields: ['score', 'ranking', 'full_answer', 'original_question', 'full_dialogue'],
      shareSafeFields: ['subject', 'wrong_cause_label', 'first_step', 'next_day_revisit_window']
    };
  });
}

function reportFirstStepText(reportState = {}) {
  const plan = reportState.recommendationPlan
    || (reportState.reportDraft && reportState.reportDraft.recommendationPlan)
    || {};
  const weak = firstReportWeakSubject(reportState);
  const subject = weak.subject || '\u5f53\u524d\u5361\u70b9';
  const cause = weak.mainCause || '';
  if (/review|wrong|card/.test(plan.primaryModule || '') || /\u65ad\u5c42|\u9519\u56e0/.test(cause)) return `\u5148\u56de\u770b${subject}\u7684\u4e00\u5f20\u9519\u56e0\u5361`;
  if (/focus/.test(plan.primaryModule || '') || /\u4e13\u6ce8|\u4e60\u60ef/.test(cause)) return `\u5148\u56f4\u7ed5${subject}\u575015\u5206\u949f`;
  if (/profile/.test(plan.primaryModule || '') || /\u60c5\u7eea|\u6c9f\u901a/.test(cause)) return `\u5148\u7528\u4e00\u53e5\u4f4e\u538b\u95ee\u9898\u627f\u63a5${subject}`;
  const dayOne = (plan.sevenDayPlan || [])[0];
  return dayOne && dayOne.task ? String(dayOne.task).slice(0, 58) : `\u5148\u8bf4\u6e05${subject}\u7684\u7b2c\u4e00\u6b65`;
}

function buildReportDailyActionQueue(options = {}) {
  const reportState = options.reportState || loadLearningReportState();
  const draft = reportState.reportDraft || {};
  const plan = reportState.recommendationPlan || draft.recommendationPlan || {};
  const solutionMap = reportState.solutionMap || draft.solutionMap || {};
  const tonightPlan = options.tonightPlan || loadTonightPlan() || {};
  const reportSolution = tonightPlan.reportSolution || {};
  const sevenDayPlan = (
    Array.isArray(plan.sevenDayPlan) && plan.sevenDayPlan.length
      ? plan.sevenDayPlan
      : Array.isArray(reportSolution.sevenDayPlan)
        ? reportSolution.sevenDayPlan
        : []
  ).slice(0, 7);
  const reportId = draft.id || reportState.reportId || reportSolution.reportId || '';
  const dayIndex = Math.max(1, Math.min(7, Number(options.day || options.dayIndex || 1)));
  const fallbackRoute = (plan.cta && plan.cta.path) || reportSolution.ctaPath || '/pages/tutor/tutor?from=learning_report';
  const nextEvidence = Array.isArray(solutionMap.nextEvidenceRequired) && solutionMap.nextEvidenceRequired.length
    ? solutionMap.nextEvidenceRequired
    : ['child_first_step', 'focus_or_review_record', 'next_day_revisit'];
  const scoreReportReturnDeck = buildScoreReportReturnDeck(reportState);
  const scoreReportReturnCard = scoreReportReturnDeck[0] || null;
  const queue = sevenDayPlan.map((item, index) => {
    const day = Number(item.day || index + 1);
    const route = item.path || fallbackRoute;
    return {
      id: `report_day_${reportId || 'local'}_${day}`,
      day,
      task: item.task || (day === 7 ? (solutionMap.reviewTrigger || '第 7 天做一次结果复核。') : '完成今天的一小步。'),
      minutes: Number(item.minutes || 10),
      module: item.module || plan.primaryModule || reportSolution.primaryModule || reportRouteTarget(route),
      route,
      checkpoint: item.checkpoint || item.parentPrompt || solutionMap.parentScript || plan.parentLine || '家长只问一句：这一步你准备先看哪里？',
      evidenceRequired: scoreReportReturnCard && day === dayIndex
        ? Array.from(new Set([].concat(nextEvidence, scoreReportReturnCard.evidenceRequired || [])))
        : nextEvidence,
      scoreReportReturnCard: scoreReportReturnCard && day === dayIndex ? scoreReportReturnCard : null,
      status: day < dayIndex ? 'done' : day === dayIndex ? 'active' : 'next'
    };
  });
  const active = queue.find((item) => item.status === 'active') || queue[0] || null;
  const tomorrow = queue.find((item) => item.day === Math.min(7, dayIndex + 1)) || queue[1] || null;
  const finalReview = queue.find((item) => item.day === 7) || queue[queue.length - 1] || null;
  return {
    id: `report_daily_queue_${reportId || 'local'}`,
    reportId,
    ready: queue.length > 0,
    dayIndex,
    source: 'learning_report',
    active,
    tomorrow,
    finalReview,
    queue,
    scoreReportReturnDeck,
    scoreReportReturnCard,
    scoreReportReturnLine: scoreReportReturnCard
      ? scoreReportReturnCard.publicSignalLine
      : '\u6682\u65e0\u6210\u7ee9\u5355\u56de\u8bbf\u5361\uff1b\u7ee7\u7eed\u6309\u7b2c\u4e00\u6b65\u548c\u9519\u56e0\u8bc1\u636e\u63a8\u8fdb\u3002',
    actionLine: active ? active.task : (scoreReportReturnCard ? scoreReportReturnCard.dailyTask : '先生成学习画像，再进入 7 天行动板。'),
    parentLine: active ? active.checkpoint : (scoreReportReturnCard ? scoreReportReturnCard.parentLine : '家长先问一句：这一步你准备先看哪里？'),
    evidenceLine: Array.from(new Set([].concat(nextEvidence, scoreReportReturnCard ? scoreReportReturnCard.evidenceRequired : []))).join(' / '),
    route: scoreReportReturnCard && scoreReportReturnCard.route ? scoreReportReturnCard.route : (active && active.route ? active.route : fallbackRoute)
  };
}

function connectLearningReportToLocalLoop(reportState = {}, options = {}) {
  if (options.connectLoop === false) return null;
  const draft = reportState.reportDraft || {};
  const plan = reportState.recommendationPlan || draft.recommendationPlan || {};
  const solutionMap = reportState.solutionMap || draft.solutionMap || {};
  const appHandoff = solutionMap.appHandoff || {};
  const cta = plan.cta || {};
  const weak = firstReportWeakSubject(reportState);
  const reportId = draft.id || `learning_report_${localDateString(options.now || new Date())}`;
  const firstStep = reportFirstStepText(reportState);
  const routeTarget = reportRouteTarget(cta.path || '');
  const focus = saveTodayFocusFromThought(firstStep, {
    id: `focus_${reportId}`,
    source: 'learning_report',
    title: weak.subject ? `${weak.subject}\u5b66\u4e60\u753b\u50cf\u627f\u63a5` : '\u5b66\u4e60\u753b\u50cf\u627f\u63a5',
    issueType: weak.mainCause || '\u65b9\u6cd5\u5339\u914d\u5ea6',
    systemSuggestedStep: firstStep,
    recommendation: cta.reason || (plan.sevenDayPlan && plan.sevenDayPlan[0] && plan.sevenDayPlan[0].task) || '\u5148\u8bf4\u6e05\u7b2c\u4e00\u6b65\uff0c\u518d\u8fdb\u5165\u7ec3\u4e60\u3002',
    reportId,
    reportCompleteness: reportState.reportCompleteness,
    solutionRoute: cta.path || '/pages/tutor/tutor?from=learning_report',
    solutionModule: plan.primaryModule || routeTarget,
    nextPracticePlan: {
      reportId,
      module: plan.primaryModule || routeTarget,
      route: cta.path || '/pages/tutor/tutor?from=learning_report',
      sevenDayPlan: (plan.sevenDayPlan || []).slice(0, 7),
      parentLine: plan.parentLine || '',
      childLine: plan.childLine || '',
      solutionMap,
      appHandoff,
      parentScript: solutionMap.parentScript || plan.parentLine || '',
      childScript: solutionMap.childScript || plan.childLine || '',
      nextEvidenceRequired: solutionMap.nextEvidenceRequired || [],
      reviewTrigger: solutionMap.reviewTrigger || '',
      evidence: plan.evidence || weak.evidence || [],
      confidence: plan.confidence || weak.confidence || '\u4f4e',
      missing: plan.missing || weak.missing || []
    }
  });
  saveTodaySession({
    stuckPointText: firstStep,
    taskType: detectTaskType(firstStep, weak.subject || ''),
    taskTypeConfirmed: false,
    learningReportId: reportId,
    learningReportMode: draft.mode || (reportState.reportProgress && reportState.reportProgress.mode) || 'fast',
    learningReportCompleteness: Number(reportState.reportCompleteness || 0),
    recommendationPlan: {
      primaryModule: plan.primaryModule || routeTarget,
      ctaPath: cta.path || '',
      ctaLabel: cta.label || '',
      sevenDayPlan: (plan.sevenDayPlan || []).slice(0, 7),
      solutionMap,
      appHandoff,
      parentScript: solutionMap.parentScript || plan.parentLine || '',
      childScript: solutionMap.childScript || plan.childLine || '',
      nextEvidenceRequired: solutionMap.nextEvidenceRequired || [],
      reviewTrigger: solutionMap.reviewTrigger || ''
    }
  }, { now: options.now || new Date() });
  const route = saveTonightPlan(Object.assign({}, loadTonightPlan() || buildTonightPlan(firstStep, {}), {
    id: `route_${reportId}`,
    source: 'learning_report',
    reportId,
    focusId: focus && focus.id,
    routeStatus: routeTarget === 'review' ? 'review_scheduled' : 'focus_created',
    summaryLine: cta.reason || `\u5b66\u4e60\u753b\u50cf\u5df2\u751f\u6210\uff0c\u4eca\u665a\u5148\u505a\uff1a${firstStep}`,
    parentAdvice: plan.parentLine || '\u5bb6\u957f\u53ea\u95ee\u4e00\u53e5\uff1a\u8fd9\u4e00\u6b65\u4f60\u51c6\u5907\u5148\u770b\u54ea\u91cc\uff1f',
    reportSolution: {
      primaryModule: plan.primaryModule || routeTarget,
      ctaPath: cta.path || '',
      ctaLabel: cta.label || '',
      sevenDayPlan: (plan.sevenDayPlan || []).slice(0, 7),
      solutionMap,
      appHandoff,
      nextEvidenceRequired: solutionMap.nextEvidenceRequired || [],
      reviewTrigger: solutionMap.reviewTrigger || ''
    }
  }));
  const session = getTodaySession(options);
  const card = generateReviewCard(Object.assign({}, session, {
    reviewCardId: `report_review_${reportId}`,
    stuckPointText: firstStep,
    childArticulatedStep: session.childArticulatedStep || firstStep,
    firstStepQuality: childStepQuality(session.childArticulatedStep || firstStep)
  }));
  appendReviewEvent({
    type: 'learning_report_solution_connected',
    reportId,
    focusId: focus && focus.id,
    cardId: card && card.id,
    routeTarget,
    nextEvidenceRequired: solutionMap.nextEvidenceRequired || [],
    reviewTrigger: solutionMap.reviewTrigger || ''
  });
  const dailyQueue = buildReportDailyActionQueue({ reportState, tonightPlan: route });
  appendSyncMutation('report_daily_action_queue', {
    id: dailyQueue.id,
    report_id: reportId,
    active_day: dailyQueue.active && dailyQueue.active.day,
    active_task: dailyQueue.active && dailyQueue.active.task,
    route: dailyQueue.route,
    score_return_subject: dailyQueue.scoreReportReturnCard && dailyQueue.scoreReportReturnCard.subject,
    score_return_gate: dailyQueue.scoreReportReturnCard && dailyQueue.scoreReportReturnCard.xpGate,
    evidence_required: dailyQueue.evidenceLine,
    created_at: new Date().toISOString()
  });
  return { reportId, focus, route, card, routeTarget, dailyQueue };
}

function saveLearningReportState(nextState = {}, options = {}) {
  const nowInput = options.now || new Date();
  const normalized = normalizeLearningReportState(nextState, nowInput);
  if (learningReport && learningReport.buildLearningReportDraft && !options.skipBuild) {
    const built = learningReport.buildLearningReportDraft(Object.assign({}, normalized, options.input || {}, {
      spacedReviewEvidenceLedger: buildSpacedReviewEvidenceLedger()
    }));
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
  if ((normalized.reportStatus && normalized.reportStatus.state === 'ready') || Number(normalized.reportCompleteness || 0) >= 28) {
    const connection = connectLearningReportToLocalLoop(normalized, options);
    if (connection) {
      saved.localLoopConnection = {
        reportId: connection.reportId,
        focusId: connection.focus && connection.focus.id,
        reviewCardId: connection.card && connection.card.id,
        routeTarget: connection.routeTarget
      };
      set(KEYS.learningReport, saved);
    }
  }
  return saved;
}

function recordReportRevisitEvidence(reportId = '', evidence = {}) {
  const current = loadLearningReportState();
  const draft = current.reportDraft || {};
  const resolvedReportId = String(reportId || evidence.reportId || current.reportId || draft.id || '').trim();
  if (!resolvedReportId && !(current && current.reportDraft)) return null;
  const now = new Date().toISOString();
  const previous = current.reportRevisitEvidence && typeof current.reportRevisitEvidence === 'object'
    ? current.reportRevisitEvidence
    : {};
  const events = Array.isArray(previous.events) ? previous.events.slice(0, 20) : [];
  const nextDayIncrement = evidence.nextDayRevisit || evidence.nextDayRevisitStatus === 'passed' || evidence.status === 'review_completed' ? 1 : 0;
  const day7Ready = !!(evidence.day7VariantResult || evidence.day7VariantStatus === 'passed' || previous.day7VariantReady);
  const parentChecked = !!(evidence.parentChecked || evidence.parentCheck || previous.parentChecked);
  const nextDayRevisitCount = Number(previous.nextDayRevisitCount || 0) + nextDayIncrement;
  const validationStage = day7Ready
    ? 'day7_candidate'
    : nextDayRevisitCount > 0
      ? 'method_candidate'
      : 'tonight_action_only';
  const longTermPortraitRelease = day7Ready && parentChecked ? 'candidate_after_day7' : 'blocked_until_day7';
  const event = {
    id: evidence.id || `report_revisit_${Date.now()}_${randomPart()}`,
    type: 'report_revisit_evidence',
    reportId: resolvedReportId,
    status: evidence.status || 'review_completed',
    route: evidence.route || '/pages/review/review',
    firstStep: String(evidence.firstStep || evidence.childFirstStep || '').slice(0, 120),
    wrongCause: String(evidence.wrongCause || '').slice(0, 120),
    parentCheck: String(evidence.parentCheck || '').slice(0, 120),
    createdAt: now
  };
  const reportRevisitEvidence = {
    id: `report_revisit_${resolvedReportId || 'local'}`,
    reportId: resolvedReportId,
    nextDayRevisitCount,
    day7VariantReady: day7Ready,
    day7VariantResult: evidence.day7VariantResult || previous.day7VariantResult || '',
    parentChecked,
    validationStage,
    longTermPortraitRelease,
    latestStatus: event.status,
    updatedAt: now,
    events: [event].concat(events).slice(0, 20),
    localRule: '回访证据只能推进方法候选和家庭行动；没有第 7 天小变式与家长确认，不升级长期画像。',
    blockedClaims: ['talent_label', 'fixed_learning_style', 'score_ranking', 'guaranteed_result']
  };
  const uploadedMaterialDecisionDossier = current.uploadedMaterialDecisionDossier
    ? Object.assign({}, current.uploadedMaterialDecisionDossier)
    : null;
  if (uploadedMaterialDecisionDossier) {
    uploadedMaterialDecisionDossier.servicePathwaySummary = Object.assign({}, uploadedMaterialDecisionDossier.servicePathwaySummary || {}, {
      revisitEvidence: reportRevisitEvidence,
      validationProgress: validationStage,
      longTermPortraitRelease
    });
    uploadedMaterialDecisionDossier.methodCandidateCards = Array.isArray(uploadedMaterialDecisionDossier.methodCandidateCards)
      ? uploadedMaterialDecisionDossier.methodCandidateCards.map((card, index) => Object.assign({}, card, {
        validationStatus: index === 0 ? validationStage : (card.validationStatus || 'waiting_evidence'),
        nextEvidence: index === 0 && !day7Ready ? 'day7_variant_result' : (card.nextEvidence || card.day7Evidence || '')
      }))
      : uploadedMaterialDecisionDossier.methodCandidateCards;
    if (uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint) {
      uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint = Object.assign({}, uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint, {
        reportRevisitEvidence,
        longTermPortraitRelease
      });
    }
  }
  const reportEvidenceReleaseGate = Object.assign({}, current.reportEvidenceReleaseGate || (draft && draft.reportEvidenceReleaseGate) || {});
  reportEvidenceReleaseGate.actualLongitudinalEvidence = Object.assign({}, reportEvidenceReleaseGate.actualLongitudinalEvidence || {}, {
    nextDayRevisitCount,
    day7VariantReady: day7Ready,
    parentChecked
  });
  reportEvidenceReleaseGate.revisitValidationStage = validationStage;
  reportEvidenceReleaseGate.longTermPortraitRelease = longTermPortraitRelease;
  const next = Object.assign({}, current, {
    reportId: resolvedReportId || current.reportId,
    reportRevisitEvidence,
    reportEvidenceReleaseGate,
    uploadedMaterialDecisionDossier,
    behaviorSignals: Object.assign({}, current.behaviorSignals || {}, {
      nextDayRevisitCount,
      day7VariantReady: day7Ready,
      parentChecked
    })
  });
  if (next.reportDraft) {
    next.reportDraft = Object.assign({}, next.reportDraft, {
      reportRevisitEvidence,
      reportEvidenceReleaseGate,
      uploadedMaterialDecisionDossier
    });
  }
  const saved = saveLearningReportState(next, { skipBuild: true, connectLoop: false });
  appendReviewEvent({
    type: 'report_revisit_evidence_recorded',
    event: 'report_revisit_evidence_recorded',
    reportId: resolvedReportId,
    validationStage,
    longTermPortraitRelease,
    firstStep: event.firstStep,
    wrongCause: event.wrongCause,
    parentChecked
  });
  appendSyncMutation('report_revisit_evidence', {
    id: event.id,
    report_id: resolvedReportId,
    validation_stage: validationStage,
    next_day_revisit_count: nextDayRevisitCount,
    day7_variant_ready: day7Ready,
    parent_checked: parentChecked,
    long_term_portrait_release: longTermPortraitRelease,
    created_at: now
  });
  return saved.reportRevisitEvidence || reportRevisitEvidence;
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
    createdAt: source.createdAt || new Date().toISOString(),
    sourceSchemaId: source.sourceSchemaId || source.schemaId || source.type || '',
    sourceSchemaLabel: source.sourceSchemaLabel || source.schemaLabel || source.label || '',
    inputChannel: source.inputChannel || source.channel || '',
    imageCount: Number.isFinite(Number(source.imageCount)) ? Number(source.imageCount) : 0,
    releaseScope: source.releaseScope || '',
    portraitConfidenceWeight: Number.isFinite(Number(source.portraitConfidenceWeight)) ? Number(source.portraitConfidenceWeight) : undefined,
    evidenceGap: Array.isArray(source.evidenceGap) ? source.evidenceGap : [],
    requiredNextEvidence: Array.isArray(source.requiredNextEvidence) ? source.requiredNextEvidence : [],
    nextEvidenceUnlockPlan: source.nextEvidenceUnlockPlan || '',
    blockedFields: Array.isArray(source.blockedFields) ? source.blockedFields : []
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
  const current = loadLearningReportState();
  const incoming = input || {};
  const incomingSources = Array.isArray(incoming.reportSources) ? incoming.reportSources : [];
  const currentSources = Array.isArray(current.reportSources) ? current.reportSources : [];
  const mergedSources = incomingSources.concat(currentSources).filter((source, index, list) => {
    const key = `${source && (source.id || source.sourceSchemaId || source.type) || 'source'}::${source && (source.text || source.rawText || source.content) || ''}`;
    return list.findIndex((item) => `${item && (item.id || item.sourceSchemaId || item.type) || 'source'}::${item && (item.text || item.rawText || item.content) || ''}` === key) === index;
  }).slice(0, 30);
  return learningReport.buildLearningReportDraft(Object.assign({}, current, incoming, {
    reportSources: mergedSources,
    spacedReviewEvidenceLedger: buildSpacedReviewEvidenceLedger()
  }));
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

function normalizeRealTrialSample(item = {}) {
  const subject = String(item.subject || item.subjectLabel || '未标注学科').trim();
  const taskType = String(item.taskType || item.task_type || 'unknown_task').trim();
  const childTask = String(item.childTask || item.task || item.stem || '').trim();
  const firstStep = String(item.firstStep || item.childFirstStep || item.expectedFirstStep || '').trim();
  const wrongCause = String(item.wrongCause || item.expectedWrongCause || '').trim();
  const boardUse = String(item.boardUse || item.boardMove || item.blackboardUse || '').trim();
  const parentCheck = String(item.parentCheck || item.parentQuestion || '').trim();
  const revisitPlan = String(item.revisitPlan || item.nextReview || '').trim();
  const privacyConcern = !!item.privacyConcern;
  const neededHelp = !!item.neededHelp;
  const droppedOff = !!item.droppedOff;
  const confusedStep = String(item.confusedStep || item.confusion || '').trim();
  const sourceUrl = String(item.sourceUrl || item.source_url || '').trim();
  const sourceId = String(item.sourceId || item.source_id || 'family_trial').trim();
  const createdAt = item.createdAt || item.created_at || new Date().toISOString();
  const answerText = String(item.answer || item.fullAnswer || '').trim();
  const originalQuestion = String(item.originalQuestion || '').trim();
  const blockedFields = ['original_question', 'full_answer', 'photo', 'ranking', 'full_dialogue'];
  const evidenceReady = !!(childTask && firstStep && wrongCause && parentCheck);
  const shouldBecomePressureSample = evidenceReady && (neededHelp || droppedOff || confusedStep || privacyConcern);
  const zeroHelp = evidenceReady && !neededHelp && !droppedOff && !privacyConcern;
  const riskTags = []
    .concat(!firstStep ? ['missing_first_step'] : [])
    .concat(!wrongCause ? ['missing_wrong_cause'] : [])
    .concat(!boardUse ? ['missing_board_use'] : [])
    .concat(!parentCheck ? ['missing_parent_check'] : [])
    .concat(neededHelp ? ['needs_human_help'] : [])
    .concat(droppedOff ? ['dropoff'] : [])
    .concat(confusedStep ? ['confusing_step'] : [])
    .concat(privacyConcern ? ['privacy_concern'] : [])
    .concat(answerText || originalQuestion ? ['private_or_answer_field_blocked'] : []);
  return {
    id: item.id || `real_trial_${createdAt.replace(/[^0-9A-Za-z]/g, '').slice(0, 14)}_${Math.floor(Math.random() * 1000)}`,
    subject,
    taskType,
    childTask,
    firstStep,
    wrongCause,
    boardUse,
    parentCheck,
    revisitPlan,
    sourceId,
    sourceUrl,
    evidenceReady,
    zeroHelp,
    neededHelp,
    droppedOff,
    confusedStep,
    privacyConcern,
    shouldBecomePressureSample,
    riskTags,
    blockedFields,
    localOwner: 'local_rule',
    aiOwner: 'ai_wording_only',
    releaseRule: 'Only release report/share/game actions after first step, wrong cause, parent check, and revisit evidence exist.',
    created_at: createdAt
  };
}

function loadRealTrialSamples() {
  const list = get(KEYS.realTrialSamples, []);
  return Array.isArray(list) ? list : [];
}

function buildRealTrialReviewCard(record = {}) {
  const now = new Date(record.created_at || Date.now());
  const due = addDaysIso(1, now);
  const id = `real_trial_review_${record.id || `${now.getTime()}_${randomPart()}`}`;
  const firstStep = record.firstStep || '先说出第一步';
  const wrongCause = record.wrongCause || record.confusedStep || '待确认错因';
  const parentCheck = record.parentCheck || '家长只问：你第一步先看哪里？';
  return {
    id,
    noteId: `note_${id}`,
    deckId: 'ydzx-real-trial',
    template: 'active_recall',
    type: 'real_trial_revisit',
    source: 'real_trial_sample',
    sourceTrialId: record.id,
    subject: record.subject,
    taskType: record.taskType,
    weakPoint: wrongCause,
    wrongCauseBucket: record.taskType,
    wrongCauseLabel: wrongCause,
    childArticulatedStep: firstStep,
    checkpoint: firstStep,
    parentPrompt: parentCheck,
    front: `回看这次真实卡点：${firstStep}`,
    backPrompt: `${parentCheck}｜错因：${wrongCause}`,
    question: `下次遇到同类题，第一步先做什么？${firstStep}`,
    answer: firstStep,
    sourceText: record.childTask,
    blackboardHint: {
      title: '真实试用小黑板',
      hint: record.boardUse || '只画第一步，不写最终答案。',
      parentPrompt: parentCheck
    },
    nextPracticePlan: {
      wrongCauseBucket: record.taskType,
      wrongCauseLabel: wrongCause,
      checkpoint: firstStep,
      parentPrompt: parentCheck,
      nextPracticeText: record.revisitPlan || '明天换一道同类小题，只检查第一步。',
      appRoute: '/pages/review/review',
      transferPracticeSet: buildTransferPracticeSet({
        taskType: record.taskType,
        childArticulatedStep: firstStep,
        wrongCauseBucket: record.taskType,
        wrongCauseLabel: wrongCause,
        stuckPointText: record.childTask
      })
    },
    repairPlan: record.revisitPlan || '明天换一道同类小题，只检查第一步。',
    parentRecapLine: `真实试用回收：${parentCheck}`,
    due,
    dueDate: due,
    intervalLevel: 1,
    status: 'new',
    isRevisited: false,
    suspended: false,
    leech: false,
    realTrialRecovery: {
      shouldBecomePressureSample: record.shouldBecomePressureSample,
      riskTags: record.riskTags,
      blockedFields: record.blockedFields,
      localOwner: record.localOwner,
      aiOwner: record.aiOwner
    },
    created_at: now.toISOString(),
    updated_at: new Date().toISOString()
  };
}

function ensureRealTrialReviewCard(record = {}) {
  if (!record || !record.evidenceReady) return null;
  const cards = loadReviewCards();
  const existing = cards.find((card) => card && card.sourceTrialId === record.id);
  if (existing) return existing;
  const card = buildRealTrialReviewCard(record);
  saveReviewCards([card].concat(cards).slice(0, 260));
  appendReviewEvent({
    type: 'real_trial_review_card_created',
    cardId: card.id,
    sourceTrialId: record.id,
    rating: record.zeroHelp ? 'zero_help' : 'needs_revisit'
  });
  return card;
}

function buildRealTrialGameChallengeBridge(options = {}) {
  const cards = (options.reviewCards || loadReviewCards())
    .filter((card) => card && card.type === 'real_trial_revisit')
    .slice(0, Number(options.limit || 6));
  const challengeCards = cards.map((card, index) => ({
    id: `${card.id}_game_bridge`,
    order: index + 1,
    title: `${card.subject || '真实作业'}卡点复练`,
    prompt: card.question || card.front || '下次遇到同类题，第一步先做什么？',
    firstStep: card.childArticulatedStep || card.checkpoint || '先说出第一步',
    wrongCause: card.wrongCauseLabel || card.weakPoint || '待确认错因',
    parentCheck: card.parentPrompt || (card.nextPracticePlan && card.nextPracticePlan.parentPrompt) || '家长只问第一步',
    sourceTrialId: card.sourceTrialId || '',
    route: `/pages/arcade/arcade?from=real_trial_revisit&trial_id=${encodeURIComponent(card.sourceTrialId || card.id)}`,
    reviewRoute: '/pages/review/review?from=real_trial_revisit',
    gameRule: '90 秒内只说第一步和错因，不看最终答案，不比较速度。',
    shareHook: '把这次真实卡点变成同类第一步挑战，对方必须用自己的材料复刻。',
    allowedFields: ['subject', 'task_type', 'first_step', 'wrong_cause', 'parent_check', 'revisit_route'],
    blockedFields: ['original_question', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue']
  }));
  return {
    id: 'real_trial_game_challenge_bridge',
    title: '真实试用游戏接力',
    ready: challengeCards.length > 0,
    count: challengeCards.length,
    reportLine: challengeCards.length
      ? `已把 ${challengeCards.length} 张真实试用回访卡接到轻挑战：只练第一步、错因和明天回访。`
      : '真实试用回访卡生成后，会自动接到轻挑战和安全分享接力。',
    gameMode: 'first_step_revisit',
    localRuleLine: '本地代码决定哪些真实试用卡能进入游戏、分享和回访；AI 只负责把追问改得更自然。',
    shareBoundary: '分享只带第一步、错因、家长检查和回访路线；不带原题、答案、照片、分数、排名和完整对话。',
    challengeCards,
    firstChallenge: challengeCards[0] || null,
    query: challengeCards[0] ? {
      real_trial_challenge: challengeCards[0].id,
      real_trial_first_step: challengeCards[0].firstStep,
      real_trial_wrong_cause: challengeCards[0].wrongCause,
      real_trial_parent_check: challengeCards[0].parentCheck,
      real_trial_route: challengeCards[0].route,
      real_trial_blocked: challengeCards[0].blockedFields.join(','),
      real_trial_allowed: challengeCards[0].allowedFields.join(',')
    } : {}
  };
}

function appendRealTrialSample(item) {
  const record = normalizeRealTrialSample(item || {});
  const next = [record].concat(loadRealTrialSamples()).slice(0, 160);
  set(KEYS.realTrialSamples, next);
  const reviewCard = ensureRealTrialReviewCard(record);
  const ruleRetestReviewBridge = ensureRealTrialRuleRetestReviewCards({
    samples: next,
    limit: 6
  });
  appendFeedback({
    rating: record.zeroHelp ? 'accurate' : 'off',
    calibration_key: record.riskTags[0] || record.taskType,
    subject: record.subject,
    note: record.confusedStep || record.wrongCause || record.firstStep,
    source: 'real_trial_sample'
  });
  appendSyncMutation('real_trial_sample', {
    id: record.id,
    subject: record.subject,
    taskType: record.taskType,
    riskTags: record.riskTags,
    shouldBecomePressureSample: record.shouldBecomePressureSample,
    blockedFields: record.blockedFields,
    reviewCardId: reviewCard && reviewCard.id ? reviewCard.id : '',
    ruleRetestReviewCreated: ruleRetestReviewBridge && ruleRetestReviewBridge.createdCount ? ruleRetestReviewBridge.createdCount : 0
  });
  return next;
}

function buildRealTrialPressureCandidateBoard(options = {}) {
  const samples = (options.samples || loadRealTrialSamples())
    .map(normalizeRealTrialSample)
    .filter((item) => item && (
      item.shouldBecomePressureSample
      || item.neededHelp
      || item.droppedOff
      || item.confusedStep
      || item.privacyConcern
    ));
  const limit = Number(options.limit || 8);
  const cards = samples.slice(0, limit).map((item, index) => {
    const auditReasons = []
      .concat(item.neededHelp ? ['需要额外提示'] : [])
      .concat(item.droppedOff ? ['流程中断'] : [])
      .concat(item.confusedStep ? [`卡在：${item.confusedStep}`] : [])
      .concat(item.privacyConcern ? ['含隐私顾虑'] : [])
      .concat(!item.evidenceReady ? ['证据未齐'] : []);
    return {
      id: `${item.id}_pressure_candidate`,
      order: index + 1,
      title: `${item.subject || '家庭作业'}压力样本候选`,
      sourceTrialId: item.id,
      subject: item.subject,
      taskType: item.taskType,
      childTask: item.childTask,
      firstStep: item.firstStep || '先补孩子自己说出的第一步',
      wrongCause: item.wrongCause || item.confusedStep || '先补错因',
      boardUse: item.boardUse || '小黑板只画第一步，不写答案',
      parentCheck: item.parentCheck || '家长只问：第一步先看哪里？',
      revisitPlan: item.revisitPlan || '明天换一道同类小题复查第一步',
      auditReasons,
      status: item.evidenceReady ? 'ready_for_pressure_audit' : 'needs_evidence_before_pressure_audit',
      localOwner: 'local_rule',
      aiOwner: 'ai_wording_only',
      localRule: '本地代码负责清洗、分型、错因命中、小黑板动作、回访节奏、报告放行和分享字段。',
      aiBoundary: 'AI 只能改写追问语气和解释角度，不能补原题、给答案、决定掌握度或放行分享。',
      tutorRoute: `/pages/tutor/tutor?from=real_trial_pressure_candidate&trial_id=${encodeURIComponent(item.id)}`,
      reviewRoute: `/pages/review/review?from=real_trial_pressure_candidate&trial_id=${encodeURIComponent(item.id)}`,
      arcadeRoute: `/pages/arcade/arcade?from=real_trial_pressure_candidate&trial_id=${encodeURIComponent(item.id)}`,
      allowedFields: ['subject', 'task_type', 'first_step', 'wrong_cause', 'board_use', 'parent_check', 'revisit_plan'],
      blockedFields: ['original_question', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue']
    };
  });
  const readyCount = cards.filter((item) => item.status === 'ready_for_pressure_audit').length;
  return {
    id: 'real_trial_pressure_candidate_board',
    title: '真实试用压力候选板',
    ready: cards.length > 0,
    total: cards.length,
    readyCount,
    cards,
    firstCandidate: cards[0] || null,
    reportLine: cards.length
      ? `已从真实试用里抓出 ${cards.length} 个压力样本候选，${readyCount} 个证据已齐；下一步压测苏格拉底、报告、回访和游戏。`
      : '还没有真实试用失败样本；继续堆公开资料的边际效益低，先回收家庭卡住点。',
    localRuleLine: '候选能否进入压力库由本地规则决定；标准是来源清楚、第一步具体、错因具体、小黑板可画、家长可检查、明天可回访。',
    aiUseLine: '苏格拉底问答可以用 AI 润色，但候选入库、答案拦截、隐私字段和分享字段必须本地代码控制。',
    stopRule: '连续两轮没有新增真实试用失败样本时，停止扩充静态资料，转向家长试用和真机观察。'
  };
}

function buildRealTrialSocraticStressAudit(options = {}) {
  const candidateBoard = options.candidateBoard || buildRealTrialPressureCandidateBoard({
    samples: options.samples,
    limit: options.limit || 8
  });
  const candidates = Array.isArray(candidateBoard.cards) ? candidateBoard.cards : [];
  const genericFirstSteps = ['先读题', '认真审题', '看关键词', '按步骤做', '先理解题意', '先说出第一步'];
  const genericWrongCauses = ['不会做', '粗心', '没理解', '待确认错因', '知识点不熟'];
  const visualSignals = ['画', '圈', '标', '线', '表', '箭头', '模型', '对照', '拆成', '流程'];
  const rows = candidates.map((item, index) => {
    const firstStep = String(item.firstStep || '');
    const wrongCause = String(item.wrongCause || '');
    const boardUse = String(item.boardUse || '');
    const parentCheck = String(item.parentCheck || '');
    const revisitPlan = String(item.revisitPlan || '');
    const risks = []
      .concat(firstStep.length < 10 || genericFirstSteps.some((token) => firstStep.includes(token)) ? ['first_step_generic'] : [])
      .concat(wrongCause.length < 8 || genericWrongCauses.some((token) => wrongCause.includes(token)) ? ['wrong_cause_generic'] : [])
      .concat(!visualSignals.some((token) => boardUse.includes(token)) ? ['blackboard_not_actionable'] : [])
      .concat(parentCheck.length < 10 || !/[？?]/.test(parentCheck) ? ['parent_check_not_question'] : [])
      .concat(revisitPlan.length < 10 || !/(明天|第 2 天|第2天|回访|复查|换一道|同类)/.test(revisitPlan) ? ['revisit_missing'] : []);
    const score = Math.max(0, 100 - risks.length * 18);
    return {
      id: `${item.id}_socratic_stress`,
      order: index + 1,
      sourceTrialId: item.sourceTrialId,
      subject: item.subject,
      taskType: item.taskType,
      score,
      status: risks.length ? 'needs_repair_before_release' : 'stress_ready',
      risks,
      socraticProbe: risks.includes('first_step_generic')
        ? '不要问“你会了吗”，改问：你第一眼先圈哪一个量？'
        : `追问孩子复述第一步：${firstStep}`,
      reportProbe: risks.includes('wrong_cause_generic')
        ? '报告暂不写掌握结论，只写待查错因和下一次证据。'
        : `报告只记录错因：${wrongCause}`,
      blackboardProbe: risks.includes('blackboard_not_actionable')
        ? '小黑板补一个可画动作：圈量、画线、列表或箭头。'
        : `小黑板动作：${boardUse}`,
      revisitProbe: risks.includes('revisit_missing')
        ? '补明天同类小题回访，不把今晚一次表现当长期画像。'
        : `回访：${revisitPlan}`,
      localRepair: risks.length
        ? '先由本地规则补第一步、错因、小黑板和回访，再允许 AI 改写语气。'
        : '可进入苏格拉底、报告、回访和游戏的下一轮压测。',
      tutorRoute: item.tutorRoute,
      reviewRoute: item.reviewRoute,
      arcadeRoute: item.arcadeRoute,
      allowedFields: item.allowedFields,
      blockedFields: item.blockedFields
    };
  });
  const riskCounter = rows.reduce((acc, row) => {
    row.risks.forEach((risk) => { acc[risk] = (acc[risk] || 0) + 1; });
    return acc;
  }, {});
  const topRisks = Object.keys(riskCounter)
    .sort((a, b) => riskCounter[b] - riskCounter[a])
    .map((risk) => ({
      id: risk,
      label: risk,
      count: riskCounter[risk],
      repair: {
        first_step_generic: '补成孩子能开口的第一步，不要泛泛审题。',
        wrong_cause_generic: '错因必须绑定题型和卡住位置。',
        blackboard_not_actionable: '小黑板必须有可画动作。',
        parent_check_not_question: '家长检查必须是一句今晚能问的问题。',
        revisit_missing: '必须补明天同类回访。'
      }[risk] || '补齐证据后再放行。'
    }));
  const passCount = rows.filter((row) => row.status === 'stress_ready').length;
  return {
    id: 'real_trial_socratic_stress_audit',
    title: '真实试用苏格拉底压测',
    ready: rows.length > 0,
    total: rows.length,
    passCount,
    repairCount: Math.max(0, rows.length - passCount),
    rows,
    topRisks,
    reportLine: rows.length
      ? `真实试用压测：${passCount}/${rows.length} 个候选可放行，${rows.length - passCount} 个先修第一步/错因/小黑板/回访。`
      : '还没有可压测的真实试用候选；下一步先回收家庭卡住样本。',
    localRuleLine: '本地代码先判定“厚而不准”的位置：第一步、错因、小黑板、家长检查、回访；AI 只在通过后改写追问语气。',
    releaseGate: '没有通过压测的候选不能进入长期画像、分享传播或掌握结论。',
    stopRule: '若新增公开资料不能提高压测通过率，就停止扩表，转向真实家庭样本。'
  };
}

function buildRealTrialStressRepairQueue(options = {}) {
  const audit = options.audit || buildRealTrialSocraticStressAudit({
    candidateBoard: options.candidateBoard,
    samples: options.samples,
    limit: options.limit || 8
  });
  const rows = Array.isArray(audit.rows) ? audit.rows : [];
  const repairCopy = {
    first_step_generic: {
      label: '第一步待修',
      action: '改成孩子能立刻开口的一步：先圈量、先画关系、先标单位或先复述条件。',
      probe: '你第一眼先圈哪一个量？为什么先看它？'
    },
    wrong_cause_generic: {
      label: '错因待修',
      action: '错因必须绑定题型和卡住位置，不能只写粗心、不会、没理解。',
      probe: '你卡住的是量的关系、条件顺序，还是单位/概念混了？'
    },
    blackboard_not_actionable: {
      label: '小黑板待修',
      action: '补一个可画动作：圈、线、表、箭头、模型或对照图。',
      probe: '这一步能不能画成一条线或一个表？'
    },
    parent_check_not_question: {
      label: '家长检查待修',
      action: '改成家长今晚能问出口的一句话，不追完整答案。',
      probe: '你第一步先看哪里？你怎么知道先看这里？'
    },
    revisit_missing: {
      label: '回访待修',
      action: '补明天同类小题回访和第 7 天小变式，不把一次表现当掌握。',
      probe: '明天换一道同类小题，你还能先说出这一步吗？'
    },
    stress_ready: {
      label: '可放行',
      action: '保留当前第一步、错因、小黑板和回访，进入下一轮真实变式验证。',
      probe: '换一道同类小题，只说第一步。'
    }
  };
  const cards = rows.flatMap((row) => {
    const risks = row.risks && row.risks.length ? row.risks : ['stress_ready'];
    return risks.map((risk, riskIndex) => {
      const copy = repairCopy[risk] || repairCopy.stress_ready;
      return {
        id: `${row.id}_${risk}_repair`,
        sourceStressId: row.id,
        sourceTrialId: row.sourceTrialId,
        subject: row.subject,
        taskType: row.taskType,
        risk,
        label: copy.label,
        status: risk === 'stress_ready' ? 'ready_for_next_variant' : 'needs_local_repair',
        repairAction: copy.action,
        socraticProbe: copy.probe,
        reportRule: risk === 'stress_ready'
          ? '可进入下一轮变式，但仍不写长期掌握结论。'
          : '报告只写待修动作，不写掌握结论。',
        blackboardRule: risk === 'blackboard_not_actionable'
          ? '必须补可画动作后再进入小黑板。'
          : row.blackboardProbe,
        revisitRule: risk === 'revisit_missing'
          ? '必须补明天同类回访。'
          : row.revisitProbe,
        tutorRoute: `${row.tutorRoute || '/pages/tutor/tutor'}&repair=${encodeURIComponent(risk)}`,
        reviewRoute: `${row.reviewRoute || '/pages/review/review'}&repair=${encodeURIComponent(risk)}`,
        arcadeRoute: `${row.arcadeRoute || '/pages/arcade/arcade'}&repair=${encodeURIComponent(risk)}`,
        order: row.order * 10 + riskIndex,
        localOwner: 'local_rule',
        aiOwner: 'ai_wording_only',
        allowedFields: ['subject', 'task_type', 'risk', 'repair_action', 'socratic_probe', 'revisit_rule'],
        blockedFields: ['original_question', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue']
      };
    });
  }).slice(0, Number(options.limit || 12));
  const repairCount = cards.filter((item) => item.status === 'needs_local_repair').length;
  const readyCount = cards.filter((item) => item.status === 'ready_for_next_variant').length;
  return {
    id: 'real_trial_stress_repair_queue',
    title: '真实试用压测修复队列',
    ready: cards.length > 0,
    total: cards.length,
    repairCount,
    readyCount,
    cards,
    firstRepair: cards[0] || null,
    reportLine: cards.length
      ? `压测修复：${repairCount} 条先本地修，${readyCount} 条进下一轮变式；不再只堆资料。`
      : '暂无压测修复项；优先继续回收真实家庭卡住样本。',
    localRuleLine: '本地代码把压测风险转成修复动作，AI 只改写追问语气。',
    releaseGate: '待修项未完成前，不进入长期画像、分享传播或掌握结论。',
    stopRule: '如果修复队列连续两轮没有新增失败项，边际收益降低，应转向真机试用和家庭样本回收。'
  };
}

function buildRealTrialRuleWritebackPlan(options = {}) {
  const repairQueue = options.repairQueue || buildRealTrialStressRepairQueue({
    audit: options.audit,
    candidateBoard: options.candidateBoard,
    samples: options.samples,
    limit: options.limit || 12
  });
  const repairCards = Array.isArray(repairQueue.cards) ? repairQueue.cards : [];
  const laneByRisk = {
    first_step_generic: {
      id: 'first_step_rule_patch',
      label: '第一步规则回写',
      localTarget: 'firstStepTemplatesForTaskType / suggestedStepForTaskType',
      retest: '同一题型换一个家庭作业材料，只检查孩子是否能开口说第一步。'
    },
    wrong_cause_generic: {
      id: 'wrong_cause_rule_patch',
      label: '错因规则回写',
      localTarget: 'wrongCauseFromFirstStep / report wrong-cause labels',
      retest: '同一错因换一道小变式，检查是否仍能命中卡住位置。'
    },
    blackboard_not_actionable: {
      id: 'blackboard_rule_patch',
      label: '小黑板规则回写',
      localTarget: 'buildBlackboardHint / buildFirstStepBlackboardBlueprint',
      retest: '小黑板必须能画出圈、线、表、箭头或对照图。'
    },
    parent_check_not_question: {
      id: 'parent_check_rule_patch',
      label: '家长检查规则回写',
      localTarget: 'parentQuestionFromFirstStep / parent report lines',
      retest: '家长只用一句话检查第一步，不追完整答案。'
    },
    revisit_missing: {
      id: 'revisit_rule_patch',
      label: '回访规则回写',
      localTarget: 'generateReviewCard / nextPracticePlan / review cadence',
      retest: '明天同类小题和第 7 天小变式都必须有入口。'
    },
    stress_ready: {
      id: 'variant_retest_patch',
      label: '变式复测',
      localTarget: 'transferPracticeSet / arcade challenge',
      retest: '不写掌握结论，先进入下一轮真实变式验证。'
    }
  };
  const patches = repairCards.map((card, index) => {
    const lane = laneByRisk[card.risk] || laneByRisk.stress_ready;
    return {
      id: `${card.id}_rule_writeback`,
      order: index + 1,
      sourceRepairId: card.id,
      sourceTrialId: card.sourceTrialId,
      subject: card.subject,
      taskType: card.taskType,
      risk: card.risk,
      laneId: lane.id,
      laneLabel: lane.label,
      localTarget: lane.localTarget,
      localPatch: card.repairAction,
      retestScenario: lane.retest,
      socraticProbe: card.socraticProbe,
      reportGate: card.status === 'needs_local_repair'
        ? '修复并复测前，报告只写待修动作，不写掌握结论。'
        : '只允许进入下一轮变式复测，不直接写长期画像。',
      nextRoutes: {
        tutor: card.tutorRoute,
        review: card.reviewRoute,
        arcade: card.arcadeRoute
      },
      localOwner: 'local_rule',
      aiOwner: 'ai_wording_only',
      allowedFields: ['subject', 'task_type', 'risk', 'local_patch', 'retest_scenario', 'report_gate'],
      blockedFields: ['original_question', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue']
    };
  }).slice(0, Number(options.limit || 12));
  const laneMap = patches.reduce((acc, patch) => {
    acc[patch.laneId] = acc[patch.laneId] || {
      id: patch.laneId,
      label: patch.laneLabel,
      localTarget: patch.localTarget,
      count: 0,
      firstRetest: patch.retestScenario
    };
    acc[patch.laneId].count += 1;
    return acc;
  }, {});
  const lanes = Object.keys(laneMap).map((key) => laneMap[key]);
  return {
    id: 'real_trial_rule_writeback_plan',
    title: '真实试用规则回写计划',
    ready: patches.length > 0,
    total: patches.length,
    laneCount: lanes.length,
    lanes,
    patches,
    firstPatch: patches[0] || null,
    reportLine: patches.length
      ? `规则回写：${patches.length} 条修复动作已映射到 ${lanes.length} 类本地规则，下一轮按复测场景验证。`
      : '暂无可回写规则；先继续收集真实试用失败样本。',
    localRuleLine: '本地规则负责回写题型、错因、小黑板、家长检查、回访和报告放行；AI 只润色已确定的追问。',
    releaseGate: '未完成回写与复测前，不进入长期画像、分享传播、掌握结论或题库扩张。',
    marginalRule: '若回写计划没有新增本地规则命中率，只停止加资料，转向真机家庭试用。'
  };
}

function buildRealTrialRuleRetestDeck(options = {}) {
  const writebackPlan = options.writebackPlan || buildRealTrialRuleWritebackPlan({
    repairQueue: options.repairQueue,
    audit: options.audit,
    candidateBoard: options.candidateBoard,
    samples: options.samples,
    limit: options.limit || 12
  });
  const patches = Array.isArray(writebackPlan.patches) ? writebackPlan.patches : [];
  const cards = patches.slice(0, Number(options.limit || 12)).map((patch, index) => ({
    id: `${patch.id}_retest_card`,
    order: index + 1,
    sourcePatchId: patch.id,
    sourceTrialId: patch.sourceTrialId,
    subject: patch.subject,
    taskType: patch.taskType,
    risk: patch.risk,
    title: `${patch.laneLabel}复测卡`,
    prompt: patch.socraticProbe || '换一道同类小题，只说第一步。',
    retestScenario: patch.retestScenario,
    localPatch: patch.localPatch,
    cadence: [
      { id: 'tonight', label: '今晚', action: '只复测第一步和错因，不看答案。' },
      { id: 'tomorrow', label: '明天', action: '换一道同类材料，确认还能开口。' },
      { id: 'day7', label: '第 7 天', action: '用小变式确认是否迁移，仍不写长期掌握结论。' }
    ],
    gameMode: 'active_recall_no_rank',
    xpRule: '只奖励复述第一步、说清错因和完成回访，不奖励速度、分数或排名。',
    reportGate: patch.reportGate,
    releaseGate: '今晚、明天、第 7 天三段证据齐之前，不进入长期画像和分享传播。',
    tutorRoute: patch.nextRoutes && patch.nextRoutes.tutor ? `${patch.nextRoutes.tutor}&retest=1` : '/pages/tutor/tutor?from=rule_retest',
    reviewRoute: patch.nextRoutes && patch.nextRoutes.review ? `${patch.nextRoutes.review}&retest=1` : '/pages/review/review?from=rule_retest',
    arcadeRoute: patch.nextRoutes && patch.nextRoutes.arcade ? `${patch.nextRoutes.arcade}&retest=1` : '/pages/arcade/arcade?from=rule_retest',
    localOwner: 'local_rule',
    aiOwner: 'ai_wording_only',
    allowedFields: ['subject', 'task_type', 'risk', 'prompt', 'cadence', 'report_gate'],
    blockedFields: ['original_question', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue']
  }));
  return {
    id: 'real_trial_rule_retest_deck',
    title: '真实试用规则复测卡组',
    ready: cards.length > 0,
    total: cards.length,
    cards,
    firstCard: cards[0] || null,
    reportLine: cards.length
      ? `规则复测：${cards.length} 张卡进入今晚/明天/第 7 天节奏，只奖励第一步、错因和回访。`
      : '暂无复测卡；先生成规则回写计划。',
    gizmoLine: '高频记忆只做主动回忆和间隔回访，不做排行榜、晒分或速度刺激。',
    khanmigoLine: '长期画像必须等三段复测证据齐，再写稳定模式。',
    localRuleLine: '本地代码决定复测节奏、奖励、报告放行和分享边界；AI 只润色提示语。',
    releaseGate: '复测卡未完成前，不进入掌握结论、长期画像、自然裂变或平台题库扩张。'
  };
}

function buildRealTrialRuleRetestReviewCard(card = {}, index = 0) {
  const now = new Date();
  const due = addDaysIso(index === 0 ? 0 : 1, now);
  const title = card.title || `${card.subject || '家庭作业'}复测卡`;
  const prompt = card.prompt || card.retestScenario || '换一道同类小题，只说第一步和错因，不写答案。';
  const firstStep = card.localPatch || card.retestScenario || prompt;
  const wrongCause = card.risk || '待复测错因';
  return {
    id: `real_trial_rule_retest_${card.id || card.sourcePatchId || index}`,
    type: 'real_trial_rule_retest',
    source: 'real_trial_rule_retest',
    sourceRetestId: card.id || '',
    sourcePatchId: card.sourcePatchId || '',
    sourceTrialId: card.sourceTrialId || '',
    subject: card.subject || '家庭作业',
    taskType: card.taskType || 'unknown',
    front: prompt,
    question: prompt,
    answer: '只说第一步、错因和下一次检查点，不写最终答案。',
    note: title,
    prompt,
    title,
    childArticulatedStep: firstStep,
    wrongCauseBucket: wrongCause,
    wrongCauseLabel: wrongCause,
    weakPoint: wrongCause,
    checkpoint: card.reportGate || '先确认孩子能不能自己说出第一步。',
    parentPrompt: '家长只问：这次第一步是什么？为什么先做这一步？',
    blackboardHint: card.retestScenario || '小黑板只画第一步关系，不画完整解法。',
    due,
    dueDate: due,
    intervalLevel: 1,
    status: 'new',
    isRevisited: false,
    suspended: false,
    leech: false,
    gameMode: card.gameMode || 'active_recall_no_rank',
    xpRule: card.xpRule || '奖励说清第一步、错因和回访，不奖励速度、分数或排名。',
    nextPracticePlan: {
      appRoute: '/pages/review/review?from=rule_retest',
      arcadeRoute: card.arcadeRoute || '/pages/arcade/arcade?from=rule_retest',
      tutorRoute: card.tutorRoute || '/pages/tutor/tutor?from=rule_retest',
      parentPrompt: '今晚只复测第一步；明天换材料；第 7 天再看迁移。',
      transferPracticeSet: buildTransferPracticeSet({
        taskType: card.taskType,
        subject: card.subject,
        stuckPointText: prompt,
        childArticulatedStep: firstStep,
        wrongCauseBucket: wrongCause
      })
    },
    realTrialRuleRetest: {
      sourceRetestId: card.id || '',
      sourcePatchId: card.sourcePatchId || '',
      sourceTrialId: card.sourceTrialId || '',
      cadence: card.cadence || [],
      reportGate: card.reportGate || '',
      releaseGate: card.releaseGate || '',
      localOwner: card.localOwner || 'local_rule',
      aiOwner: card.aiOwner || 'ai_wording_only'
    },
    allowedFields: card.allowedFields || ['subject', 'task_type', 'prompt', 'cadence', 'report_gate'],
    blockedFields: card.blockedFields || ['original_question', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue'],
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function buildRealTrialRuleRetestReviewBridge(options = {}) {
  const retestDeck = options.retestDeck || buildRealTrialRuleRetestDeck(options);
  const retestCards = Array.isArray(retestDeck.cards) ? retestDeck.cards : [];
  const existingCards = options.reviewCards || loadReviewCards();
  const existingIds = {};
  (Array.isArray(existingCards) ? existingCards : []).forEach((card) => {
    if (!card) return;
    if (card.sourceRetestId) existingIds[card.sourceRetestId] = true;
    if (card.id) existingIds[card.id] = true;
  });
  const reviewCards = retestCards.slice(0, Number(options.limit || 12)).map(buildRealTrialRuleRetestReviewCard);
  const newCards = reviewCards.filter((card) => card && !existingIds[card.sourceRetestId] && !existingIds[card.id]);
  const challengeCards = reviewCards.map((card, index) => ({
    id: `${card.id}_challenge`,
    order: index + 1,
    title: `${card.subject || '家庭作业'}复测挑战`,
    prompt: card.prompt,
    firstStep: card.childArticulatedStep,
    wrongCause: card.wrongCauseLabel,
    parentCheck: card.parentPrompt,
    sourceRetestId: card.sourceRetestId,
    sourceTrialId: card.sourceTrialId,
    route: card.nextPracticePlan.arcadeRoute,
    reviewRoute: card.nextPracticePlan.appRoute,
    gameRule: '只做主动回忆：说第一步、错因和下一次检查点，不比速度、不晒分。',
    shareHook: '把这张复测卡分享出去，对方只能接力第一步，不能看到原题或答案。',
    allowedFields: card.allowedFields,
    blockedFields: card.blockedFields
  }));
  return {
    id: 'real_trial_rule_retest_review_bridge',
    title: '规则复测入队',
    ready: reviewCards.length > 0,
    total: reviewCards.length,
    createdCount: newCards.length,
    existingCount: reviewCards.length - newCards.length,
    reviewCards,
    newCards,
    challengeCards,
    firstReviewCard: reviewCards[0] || null,
    reportLine: reviewCards.length
      ? `复测入队：${reviewCards.length} 张规则复测卡已可进入轻回访，其中 ${newCards.length} 张等待写入。`
      : '复测入队：暂无可执行复测卡，先回到真实试用失败样本。' ,
    releaseGate: '复测卡没有进入轻回访和挑战前，不写长期画像、不扩题库、不做分享传播。',
    localRuleLine: '本地代码负责入队、去重、节奏、XP、报告放行和分享边界；AI 只润色追问语气。'
  };
}

function ensureRealTrialRuleRetestReviewCards(options = {}) {
  const bridge = buildRealTrialRuleRetestReviewBridge(options);
  if (!bridge.ready || !bridge.newCards.length) return bridge;
  const existing = loadReviewCards();
  saveReviewCards(bridge.newCards.concat(existing).slice(0, 260));
  appendReviewEvent({
    type: 'real_trial_rule_retest_cards_created',
    count: bridge.newCards.length,
    source: 'real_trial_rule_retest'
  });
  return Object.assign({}, bridge, {
    persisted: true,
    reportLine: `复测入队：已写入 ${bridge.newCards.length} 张规则复测卡到轻回访。`
  });
}

function buildRealTrialRecoveryLoop(options = {}) {
  const samples = loadRealTrialSamples().map(normalizeRealTrialSample);
  const pressureMatrix = options.realHomeworkCoverageMatrix || buildRealHomeworkCoverageMatrix();
  const total = samples.length;
  const evidenceReady = samples.filter((item) => item.evidenceReady).length;
  const zeroHelp = samples.filter((item) => item.zeroHelp).length;
  const shouldPromote = samples.filter((item) => item.shouldBecomePressureSample);
  const realTrialReviewCards = loadReviewCards().filter((card) => card && card.type === 'real_trial_revisit');
  const realTrialGameChallengeBridge = buildRealTrialGameChallengeBridge({
    reviewCards: realTrialReviewCards,
    limit: options.gameChallengeLimit || 6
  });
  const pressureCandidateBoard = buildRealTrialPressureCandidateBoard({
    samples,
    limit: options.pressureCandidateLimit || 8
  });
  const socraticStressAudit = buildRealTrialSocraticStressAudit({
    candidateBoard: pressureCandidateBoard,
    limit: options.pressureCandidateLimit || 8
  });
  const stressRepairQueue = buildRealTrialStressRepairQueue({
    audit: socraticStressAudit,
    limit: options.stressRepairLimit || 12
  });
  const ruleWritebackPlan = buildRealTrialRuleWritebackPlan({
    repairQueue: stressRepairQueue,
    limit: options.ruleWritebackLimit || 12
  });
  const ruleRetestDeck = buildRealTrialRuleRetestDeck({
    writebackPlan: ruleWritebackPlan,
    limit: options.ruleRetestLimit || 12
  });
  const ruleRetestReviewBridge = buildRealTrialRuleRetestReviewBridge({
    retestDeck: ruleRetestDeck,
    reviewCards: loadReviewCards(),
    limit: options.ruleRetestLimit || 12
  });
  const riskCounter = {};
  const subjectCounter = {};
  samples.forEach((item) => {
    subjectCounter[item.subject] = (subjectCounter[item.subject] || 0) + 1;
    item.riskTags.forEach((tag) => {
      riskCounter[tag] = (riskCounter[tag] || 0) + 1;
    });
  });
  const topRisks = Object.keys(riskCounter)
    .sort((a, b) => riskCounter[b] - riskCounter[a])
    .slice(0, 5)
    .map((tag) => ({ id: tag, label: tag, count: riskCounter[tag] }));
  const nextQueue = shouldPromote.slice(0, 6).map((item) => ({
    id: `${item.id}_pressure_seed`,
    subject: item.subject,
    taskType: item.taskType,
    firstStep: item.firstStep || '补孩子自己的第一步',
    wrongCause: item.wrongCause || item.confusedStep || '补错因',
    parentCheck: item.parentCheck || '家长只问孩子卡在哪一步',
    localTransform: '转成不含原题和答案的压力样本，再压测苏格拉底、报告、游戏、分享。',
    aiUse: 'AI 只改写追问语气，不决定分类、放行和分享字段。',
    blockedFields: item.blockedFields
  }));
  const readiness = total >= 12 && evidenceReady / Math.max(total, 1) >= 0.8 && shouldPromote.length <= Math.ceil(total * 0.35)
    ? 'real_trial_learning_loop_ready'
    : total >= 4
      ? 'needs_more_family_trials'
      : 'collect_real_family_trials';
  const subjectCoverage = Object.keys(subjectCounter).length;
  const pressureSampleCount = Number((pressureMatrix && pressureMatrix.totalSamples) || 0);
  const targetGap = {
    familyHomeworkLoop: Math.min(92, 82 + Math.floor(Math.min(total, 20) / 2)),
    commercialFirstVersion: Math.min(76, 62 + Math.floor(Math.min(evidenceReady, 20) / 2)),
    gizmoMemoryDepth: Math.min(62, 48 + Math.floor(Math.min(shouldPromote.length, 20) / 3)),
    khanmigoPortraitDepth: Math.min(60, 46 + Math.floor(Math.min(subjectCoverage * 2, 14))),
    platformContentScale: Math.min(55, 38 + Math.floor(Math.min(pressureSampleCount, 500) / 40))
  };
  return {
    id: 'real_trial_recovery_loop',
    title: '真实试用回收闭环',
    summary: total
      ? `已回收 ${total} 次家庭试用，${zeroHelp} 次可零帮助完成，${shouldPromote.length} 条需要转成新压力样本。`
      : '还没有真实家庭试用回收；下一步不是继续堆资料，而是回收孩子真实卡住点。',
    readiness,
    total,
    evidenceReady,
    zeroHelp,
    zeroHelpRate: total ? Math.round((zeroHelp / total) * 100) : 0,
    shouldPromoteCount: shouldPromote.length,
    reviewCardCount: realTrialReviewCards.length,
    pressureCandidateBoard,
    pressureCandidateLine: pressureCandidateBoard.reportLine,
    pressureCandidateCards: pressureCandidateBoard.cards,
    socraticStressAudit,
    socraticStressLine: socraticStressAudit.reportLine,
    socraticStressRows: socraticStressAudit.rows,
    stressRepairQueue,
    stressRepairLine: stressRepairQueue.reportLine,
    stressRepairCards: stressRepairQueue.cards,
    ruleWritebackPlan,
    ruleWritebackLine: ruleWritebackPlan.reportLine,
    ruleWritebackPatches: ruleWritebackPlan.patches,
    ruleWritebackLanes: ruleWritebackPlan.lanes,
    ruleRetestDeck,
    ruleRetestLine: ruleRetestDeck.reportLine,
    ruleRetestCards: ruleRetestDeck.cards,
    ruleRetestReviewBridge,
    ruleRetestReviewLine: ruleRetestReviewBridge.reportLine,
    ruleRetestReviewCards: ruleRetestReviewBridge.reviewCards,
    ruleRetestChallengeCards: ruleRetestReviewBridge.challengeCards,
    gameChallengeBridge: realTrialGameChallengeBridge,
    gameChallengeLine: realTrialGameChallengeBridge.reportLine,
    gameChallengeCards: realTrialGameChallengeBridge.challengeCards,
    topRisks,
    nextPressureQueue: nextQueue,
    latest: samples.slice(0, 3),
    subjectCoverage,
    pressureSampleCount,
    localRuleLine: '本地代码负责样本清洗、风险打标、是否进入压力库、报告放行、分享字段和回访节奏。',
    aiUseLine: '苏格拉底问答可用 AI 改写语气和解释角度，但不能让模型临场决定答案、排名、隐私字段或掌握结论。',
    reportLine: total
      ? `真实试用：${evidenceReady}/${total} 条证据完整，零帮助率 ${total ? Math.round((zeroHelp / total) * 100) : 0}%，待转压力样本 ${shouldPromote.length} 条，已生成 ${realTrialReviewCards.length} 张回访卡。`
      : '真实试用：待回收 12 个家庭夜间作业样本后，才放行更强的长期画像和传播判断。',
    reviewQueueLine: realTrialReviewCards.length
      ? `已把 ${realTrialReviewCards.length} 次真实试用接入轻回访，下一轮只检查第一步、错因和迁移。`
      : '真实试用记录完整后会自动生成轻回访卡，避免只写报告不复练。',
    shareBoundary: '分享只带第一步、错因、家长检查和回访动作；不带原题、照片、完整答案、完整对话和排行。',
    marginalRule: '若连续两轮只增加静态资料、没有新增真实试用样本或失败样本，停止加厚并汇报差距。',
    targetGap
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

function loadSurfaceDepthEvents() {
  const list = get(KEYS.surfaceDepthEvents, []);
  return Array.isArray(list) ? list : [];
}

function inferSurfaceDepthCapability(input = {}) {
  const surface = String(input.surface || '').trim() || 'home';
  const dimensionId = String(input.dimensionId || input.id || '').trim();
  const route = String(input.route || '').trim();
  const pack = buildSurfaceDepthPack(surface, { capabilityEvidenceLedger: input.capabilityEvidenceLedger || null });
  const capabilityCards = Array.isArray(pack.capabilityCards) ? pack.capabilityCards : [];
  const picked = capabilityCards.find((item) => item && item.id && dimensionId && item.id === dimensionId)
    || capabilityCards.find((item) => item && item.route && route && item.route === route)
    || (pack.capabilityLedgerSummary && pack.capabilityLedgerSummary.nextCapability)
    || capabilityCards[0]
    || {};
  return {
    capability_id: picked.id || '',
    capability_label: picked.label || '',
    capability_route: picked.route || '',
    capability_evidence_line: picked.evidenceLine || '',
    capability_next_action: picked.nextAction || ''
  };
}

function recordSurfaceDepthAction(input = {}) {
  const surface = String(input.surface || '').trim() || 'unknown';
  const dimensionId = String(input.dimensionId || input.id || '').trim() || 'next_action';
  const capability = inferSurfaceDepthCapability(Object.assign({}, input, { surface, dimensionId }));
  const item = {
    id: input.eventId || `surface_${Date.now()}_${randomPart()}`,
    event: 'surface_depth_action',
    surface,
    dimension_id: dimensionId,
    capability_id: input.capabilityId || capability.capability_id,
    capability_label: input.capabilityLabel || capability.capability_label,
    capability_route: input.capabilityRoute || capability.capability_route,
    capability_evidence_line: input.capabilityEvidenceLine || capability.capability_evidence_line,
    capability_next_action: input.capabilityNextAction || capability.capability_next_action,
    label: input.label || input.displayLabel || '',
    route: input.route || '',
    readiness: input.readiness || '',
    source: input.source || 'surface_depth_card',
    created_at: input.created_at || new Date().toISOString()
  };
  const next = [item].concat(loadSurfaceDepthEvents()).slice(0, 200);
  set(KEYS.surfaceDepthEvents, next);
  appendSyncMutation('surface_depth_action', item);
  return item;
}

function buildSurfaceDepthActionSummary() {
  const list = loadSurfaceDepthEvents();
  const surfaceCounts = {};
  const dimensionCounts = {};
  const capabilityCounts = {};
  list.forEach((item) => {
    if (item.surface) surfaceCounts[item.surface] = (surfaceCounts[item.surface] || 0) + 1;
    if (item.dimension_id) dimensionCounts[item.dimension_id] = (dimensionCounts[item.dimension_id] || 0) + 1;
    if (item.capability_id) capabilityCounts[item.capability_id] = (capabilityCounts[item.capability_id] || 0) + 1;
  });
  const topSurface = topCountKey(surfaceCounts);
  const topDimension = topCountKey(dimensionCounts);
  const topCapability = topCountKey(capabilityCounts);
  const recent = list.slice(0, 5).map((item) => Object.assign({}, item, {
    displayLabel: item.label || item.dimension_id || item.surface || '下一步'
  }));
  const latest = recent[0] || null;
  return {
    total: list.length,
    latest,
    topSurface,
    topDimension,
    topCapability,
    capabilityCounts,
    recent,
    routeEvidenceLabel: '路线证据',
    latestActionLabel: '最近一步',
    label: list.length ? `已记录 ${list.length} 次模块下一步行动` : '还没有模块下一步行动记录',
    parentLine: latest
      ? `最近从 ${latest.surface} 进入 ${latest.label || latest.dimension_id}`
      : '先从任一厚度卡进入下一步，家长页会留下路线证据。'
  };
}

function loadUnifiedActionEvents() {
  const list = get(KEYS.unifiedActionEvents, []);
  return Array.isArray(list) ? list : [];
}

function recordUnifiedNextAction(input = {}) {
  const source = String(input.source || '').trim() || 'unified_next_action';
  const item = {
    id: input.eventId || `unified_${Date.now()}_${randomPart()}`,
    event: 'unified_next_action',
    source,
    source_label: input.sourceLabel || '',
    label: input.actionLabel || input.label || '',
    route: input.route || '',
    reason_line: input.reasonLine || '',
    evidence_line: input.evidenceLine || '',
    surface: input.surface || '',
    candidate_count: Number(input.candidateCount || 0),
    created_at: input.created_at || new Date().toISOString()
  };
  const next = [item].concat(loadUnifiedActionEvents()).slice(0, 200);
  set(KEYS.unifiedActionEvents, next);
  appendSyncMutation('unified_next_action', item);
  return item;
}

function buildUnifiedNextActionSummary() {
  const list = loadUnifiedActionEvents();
  const sourceCounts = {};
  list.forEach((item) => {
    if (item.source) sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
  });
  const recent = list.slice(0, 5).map((item) => Object.assign({}, item, {
    displayLabel: item.label || item.source_label || item.source || '下一步'
  }));
  const latest = recent[0] || null;
  return {
    total: list.length,
    latest,
    topSource: topCountKey(sourceCounts),
    recent,
    label: list.length ? `已执行 ${list.length} 次建议下一步` : '还没有执行建议下一步',
    parentLine: latest
      ? `最近一次执行：${latest.source_label || latest.source} - ${latest.label || latest.route}`
      : '先从建议下一步进入，后续报告会记录真实执行路径。'
  };
}

function buildGlobalEvidenceBrief(options = {}) {
  const thinking = thinkingReceiptSummary();
  const surface = buildSurfaceDepthActionSummary();
  const unified = buildUnifiedNextActionSummary();
  const light = buildLightFeatureEvidenceSummary(options);
  const gameProfile = loadGameProfile();
  const shareRuns = loadShareRuns();
  const reviewEvents = loadReviewEvents();
  const reportState = loadLearningReportState();
  const questSignals = loadReviewEvents().filter((item) => item && item.event === 'quest_arc_game_signal');
  const reportConnected = !!(
    reportState.localLoopConnection
    || reportState.solutionMap
    || (reportState.reportDraft && reportState.reportDraft.solutionMap)
  );
  const gameCount = Number(gameProfile.reviewed_today || gameProfile.reviewedToday || gameProfile.review_count || 0);
  const cards = [
    {
      id: 'socratic',
      label: '追问证据',
      ready: Number(thinking.total || 0) > 0,
      line: thinking.latest && thinking.latest.shareLine
        ? thinking.latest.shareLine
        : thinking.label,
      route: '/pages/tutor/tutor'
    },
    {
      id: 'light_entry',
      label: '轻入口',
      ready: !!light.ready,
      line: light.ready ? light.parentLine : light.summary,
      route: light.route || '/pages/entry-detail/entry-detail?scene=today'
    },
    {
      id: 'game',
      label: '练习回流',
      ready: gameCount > 0 || questSignals.length > 0,
      line: questSignals.length
        ? `已有 ${questSignals.length} 条故事任务回流`
        : gameCount
          ? `已有 ${gameCount} 次练习记录`
          : '先完成一局轻练习，把结果写回学习记录',
      route: '/pages/arcade/arcade'
    },
    {
      id: 'surface_action',
      label: '模块行动',
      ready: Number(surface.total || 0) > 0,
      line: surface.parentLine,
      route: surface.latest && surface.latest.route ? surface.latest.route : '/pages/home/home'
    },
    {
      id: 'unified_action',
      label: '建议下一步',
      ready: Number(unified.total || 0) > 0,
      line: unified.parentLine,
      route: unified.latest && unified.latest.route ? unified.latest.route : '/pages/home/home'
    },
    {
      id: 'share',
      label: '分享回流',
      ready: shareRuns.length > 0,
      line: shareRuns.length ? `已有 ${shareRuns.length} 条分享或回流记录` : '先整理一张家庭行动卡',
      route: '/pages/profile/profile'
    },
    {
      id: 'report',
      label: '报告落地',
      ready: reportConnected,
      line: reportConnected ? '学习画像已接入今晚路线或 7 天行动板' : '先把报告结论接到今晚第一步',
      route: '/pages/profile/profile'
    }
  ];
  const readyCount = cards.filter((item) => item.ready).length;
  const next = cards.find((item) => !item.ready) || cards[0] || null;
  return {
    title: '全局证据简报',
    summary: readyCount >= cards.length
      ? '追问、练习、行动、分享和报告已经能互相喂数据。'
      : `已闭合 ${readyCount}/${cards.length} 条关键证据线。`,
    reportLine: cards.filter((item) => item.ready).map((item) => item.label).join(' / ') || '先补一条真实学习证据',
    shareLine: next ? `下一步：${next.label} - ${next.line}` : '下一步已经闭合',
    parentLine: surface.total
      ? surface.parentLine
      : (thinking.total ? thinking.label : '先让孩子说出第一步，再沉淀到报告和家庭行动卡。'),
    readyCount,
    totalCount: cards.length,
    progress: cards.length ? Math.round((readyCount / cards.length) * 100) : 0,
    cards,
    lightFeatureEvidence: light,
    recentSurfaceActions: surface.recent,
    recentUnifiedActions: unified.recent,
    latestUnifiedAction: unified.latest,
    latestRoute: next && next.route ? next.route : '/pages/home/home',
    reviewEventCount: reviewEvents.length,
    generatedAt: options.now ? new Date(options.now).toISOString() : new Date().toISOString()
  };
}

function buildCapabilityEvidenceLedger(options = {}) {
  const globalEvidenceBrief = options.globalEvidenceBrief || buildGlobalEvidenceBrief(options);
  const learningDepthMap = options.learningDepthMap || buildLearningDepthMap(options);
  const learningQuestArc = options.learningQuestArc || buildLearningQuestArc(options);
  const moduleFlowCompass = options.moduleFlowCompass || buildModuleFlowCompass(options);
  const surfaceDepthActionSummary = options.surfaceDepthActionSummary || buildSurfaceDepthActionSummary();
  const unifiedSummary = options.unifiedSummary || buildUnifiedNextActionSummary();
  const lightFeatureEvidence = options.lightFeatureEvidence || buildLightFeatureEvidenceSummary(options);
  const thinking = options.thinkingSummary || thinkingReceiptSummary();
  const gameProfile = loadGameProfile();
  const shareRuns = loadShareRuns();
  const reportState = loadLearningReportState();
  const reviewEvents = loadReviewEvents();
  const parentDimension = learningDepthMap && Array.isArray(learningDepthMap.dimensions)
    ? learningDepthMap.dimensions.find((item) => item && (item.id === 'parent_coaching' || item.id === 'parent_reflection'))
    : null;
  const reportConnected = !!(
    reportState.localLoopConnection
    || reportState.solutionMap
    || reportState.reportDraft
    || (reportState.reportProgress && Number(reportState.reportProgress.completeness || 0) > 0)
  );
  const gameCount = Number(gameProfile.reviewed_today || gameProfile.reviewedToday || gameProfile.review_count || 0);
  const questSignals = reviewEvents.filter((item) => item && item.event === 'quest_arc_game_signal');
  const moduleReady = moduleFlowCompass && Number(moduleFlowCompass.readyCount || 0);
  const moduleTotal = moduleFlowCompass && Number(moduleFlowCompass.totalCount || 0);
  const rows = [
    {
      id: 'socratic',
      label: '点拨证据',
      ready: Number(thinking.total || 0) > 0 || Number(thinking.diagnosticProbes || 0) > 0,
      evidenceLine: thinking.latest && thinking.latest.shareLine ? thinking.latest.shareLine : (thinking.label || '还缺一次孩子自己说第一步的点拨回执'),
      nextAction: '让孩子先说出第一步，再判断卡点',
      route: '/pages/tutor/tutor'
    },
    {
      id: 'game',
      label: '游戏回流',
      ready: gameCount > 0 || questSignals.length > 0,
      evidenceLine: questSignals.length
        ? `已有 ${questSignals.length} 条剧情闯关证据`
        : gameCount
          ? `今日轻练 ${gameCount} 次`
          : '还缺一局能写回学习记录的轻练',
      nextAction: '打一小局，把错因或迁移结果写回复习队列',
      route: '/pages/arcade/arcade'
    },
    {
      id: 'report',
      label: '报告落地',
      ready: reportConnected,
      evidenceLine: reportConnected
        ? (globalEvidenceBrief.reportLine || '学习画像已经接到今晚路线')
        : '还缺把报告结论接到今晚第一步或 7 天行动',
      nextAction: '把报告从描述变成今日可执行动作',
      route: '/pages/profile/profile'
    },
    {
      id: 'share',
      label: '分享回流',
      ready: shareRuns.length > 0,
      evidenceLine: shareRuns.length ? `已有 ${shareRuns.length} 条分享或回流记录` : '还缺一张可转发的家庭行动卡',
      nextAction: '整理今日复盘卡，带上下一个动作',
      route: '/pages/profile/profile'
    },
    {
      id: 'light_entry',
      label: '轻入口证据',
      ready: !!(lightFeatureEvidence && lightFeatureEvidence.ready),
      evidenceLine: lightFeatureEvidence && (lightFeatureEvidence.parentLine || lightFeatureEvidence.summary)
        ? (lightFeatureEvidence.parentLine || lightFeatureEvidence.summary)
        : '口算、听写、手动诊断还缺回到核心链路的证据',
      nextAction: lightFeatureEvidence && lightFeatureEvidence.nextAction ? lightFeatureEvidence.nextAction : '从一个轻入口补一条第一步记录',
      route: lightFeatureEvidence && lightFeatureEvidence.route ? lightFeatureEvidence.route : '/pages/entry-detail/entry-detail?scene=today'
    },
    {
      id: 'module_flow',
      label: '模块流转',
      ready: moduleReady >= Math.max(4, Math.ceil(moduleTotal * 0.6)),
      evidenceLine: moduleFlowCompass ? moduleFlowCompass.summary : '还缺跨模块流转罗盘',
      nextAction: moduleFlowCompass ? moduleFlowCompass.currentNextAction : '先补齐一个模块到下一模块的真实动作',
      route: moduleFlowCompass && moduleFlowCompass.currentRoute ? moduleFlowCompass.currentRoute : '/pages/home/home'
    },
    {
      id: 'parent_action',
      label: '家长动作',
      ready: !!(parentDimension && parentDimension.ready),
      evidenceLine: parentDimension ? parentDimension.evidence : (learningQuestArc && learningQuestArc.parentHook) || '还缺家长一问一答的回执',
      nextAction: '家长只问一句，确认孩子能复述第一步',
      route: '/pages/profile/profile'
    },
    {
      id: 'surface_action',
      label: '页面行动',
      ready: Number(surfaceDepthActionSummary.total || 0) > 0,
      evidenceLine: surfaceDepthActionSummary.parentLine || '还缺一次从页面深度卡触发的真实跳转',
      nextAction: '从当前页面深度卡执行一个下一步',
      route: surfaceDepthActionSummary.latest && surfaceDepthActionSummary.latest.route ? surfaceDepthActionSummary.latest.route : '/pages/home/home'
    },
    {
      id: 'next_action',
      label: '统一下一步',
      ready: Number(unifiedSummary.total || 0) > 0,
      evidenceLine: unifiedSummary.parentLine || (globalEvidenceBrief.shareLine || '还缺一次统一下一步执行记录'),
      nextAction: unifiedSummary.latest && unifiedSummary.latest.label ? unifiedSummary.latest.label : '执行系统推荐的下一步',
      route: unifiedSummary.latest && unifiedSummary.latest.route ? unifiedSummary.latest.route : (globalEvidenceBrief.latestRoute || '/pages/home/home')
    }
  ];
  const readyCount = rows.filter((item) => item.ready).length;
  const next = rows.find((item) => !item.ready) || rows[0] || null;
  const grouped = {
    child: rows.filter((item) => ['socratic', 'game', 'light_entry'].includes(item.id)),
    family: rows.filter((item) => ['report', 'share', 'parent_action'].includes(item.id)),
    system: rows.filter((item) => ['module_flow', 'surface_action', 'next_action'].includes(item.id))
  };
  return {
    title: '能力证据账本',
    summary: readyCount >= rows.length
      ? '孩子思考、游戏练习、家长动作、报告和分享已经能互相交账。'
      : `已闭合 ${readyCount}/${rows.length} 条能力证据，下一条先补：${next ? next.label : '继续积累真实记录'}`,
    readyCount,
    totalCount: rows.length,
    progress: rows.length ? Math.round((readyCount / rows.length) * 100) : 0,
    rows,
    grouped,
    nextCapability: next,
    parentLine: next
      ? `${next.label}：${next.nextAction}`
      : '继续沉淀真实学习材料，保持次日回看。',
    moatLine: '护城河不靠功能堆叠，而靠每次学习都留下可复用证据：思路、练习、复盘、分享和下一步互相回流。',
    generatedAt: options.now ? new Date(options.now).toISOString() : new Date().toISOString()
  };
}

function buildCapabilityMaturityQueue(options = {}) {
  const globalEvidenceBrief = options.globalEvidenceBrief || buildGlobalEvidenceBrief(options);
  const learningQuestArc = options.learningQuestArc || buildLearningQuestArc(options);
  const moduleFlowCompass = options.moduleFlowCompass || buildModuleFlowCompass(options);
  const capabilityLedger = options.capabilityEvidenceLedger || buildCapabilityEvidenceLedger(Object.assign({}, options, {
    globalEvidenceBrief,
    learningQuestArc,
    moduleFlowCompass
  }));
  const ledgerRows = Array.isArray(capabilityLedger.rows) ? capabilityLedger.rows : [];
  const surfaceSpecs = [
    {
      id: 'socratic_depth',
      label: '苏格拉底点拨',
      surface: 'tutor',
      route: '/pages/tutor/tutor',
      capabilities: ['socratic', 'module_flow', 'parent_action', 'next_action'],
      competitorLine: '对标 Khanmigo：不追求替孩子整题讲完，而是持续追问第一步、误区、迁移证据。',
      nextAction: '先完成一轮带误区判断的追问，并把回执接到修卡点。'
    },
    {
      id: 'game_retention',
      label: '游戏化回忆',
      surface: 'arcade',
      route: '/pages/arcade/arcade',
      capabilities: ['game', 'socratic', 'parent_action', 'next_action'],
      competitorLine: '对标 Gizmo：主动回忆和间隔复习要成为主循环，不只是小游戏外壳。',
      nextAction: '打一局后必须写回错因、第一步和下一次回访。'
    },
    {
      id: 'report_decision',
      label: '家长决策报告',
      surface: 'profile',
      route: '/pages/profile/profile',
      capabilities: ['report', 'parent_action', 'share', 'next_action'],
      competitorLine: '对标 Khanmigo 家长/教师视角：报告必须变成今晚行动和 7 天复核规则。',
      nextAction: '把报告结论执行成一条今日行动，并生成家长只问一句。'
    },
    {
      id: 'repair_to_recall',
      label: '修卡到回忆',
      surface: 'review',
      route: '/pages/review/review',
      capabilities: ['socratic', 'game', 'report', 'module_flow', 'next_action'],
      competitorLine: '对标成熟错题系统：错因不是静态标签，要回到同类变式和隔天回看。',
      nextAction: '先修一张真实卡点，再进入轻练或家长复盘。'
    },
    {
      id: 'light_entry_scale',
      label: '轻入口题型库',
      surface: 'light_diagnosis',
      route: '/pages/entry-detail/entry-detail?scene=today',
      capabilities: ['light_entry', 'socratic', 'module_flow', 'next_action'],
      competitorLine: '借鉴千问可视化方向，但只做第一步种子库和错因图解，不承诺全科自动板书讲题。',
      nextAction: '从口算、听写或手动诊断补一条可复用第一步模型。'
    },
    {
      id: 'share_return_loop',
      label: '分享回流',
      surface: 'profile',
      route: '/pages/profile/profile',
      capabilities: ['share', 'parent_action', 'next_action', 'surface_action'],
      competitorLine: '分享不是拉新按钮，而是把家庭行动卡带回下一次学习。',
      nextAction: '发一张带能力缺口和下一步的家庭行动卡。'
    },
    {
      id: 'material_factory',
      label: '材料到资产',
      surface: 'tools',
      route: '/pages/entry-detail/entry-detail?scene=today',
      capabilities: ['light_entry', 'module_flow', 'game', 'next_action'],
      competitorLine: '对标 Gizmo 的导入能力：现阶段先把本地材料稳定转成复习资产。',
      nextAction: '把一段材料或错题转成可回访卡，而不是停在输入框。'
    },
    {
      id: 'trust_boundary',
      label: '信任边界',
      surface: 'legal',
      route: '/pages/legal/legal',
      capabilities: ['parent_action', 'report', 'share', 'next_action'],
      competitorLine: '商用前信任边界必须清楚：未成年人、隐私、AI 边界和家长控制都要可解释。',
      nextAction: '确认边界后回到家长复盘或补一条真实材料。'
    }
  ];
  const maturityContracts = {
    socratic_depth: {
      acceptanceCriteria: ['孩子先说出自己的第一步', '系统只追问误区和证据', '点拨回执能转成修卡点或轻练'],
      fallbackPlan: ['沉默时给 A/B 微选择', '直接要答案时退回第一步小黑板', '连续卡住时交给家长只问一句'],
      evidenceRequired: ['child_first_step', 'diagnostic_probe', 'handoff_to_review']
    },
    game_retention: {
      acceptanceCriteria: ['每局先主动回忆再核对', '错误回到错因修复', 'XP 只奖励可复述的第一步'],
      fallbackPlan: ['连续错两次降级到小黑板', '疲劳时减少题量不清空成就', '隔天从同一错因再回访'],
      evidenceRequired: ['active_recall_cards', 'wrong_cause_return', 'memory_feedback_controller']
    },
    report_decision: {
      acceptanceCriteria: ['报告给出长期画像', '报告给出课堂级观察', '报告落到今晚动作和 7 天复核'],
      fallbackPlan: ['证据不足时只给观察假设', '不输出学习结果承诺', '先补一条真实材料再更新判断'],
      evidenceRequired: ['long_term_portrait', 'classroom_observation', 'seven_day_action']
    },
    repair_to_recall: {
      acceptanceCriteria: ['卡点有明确错因', '修复后生成同类变式', '结果进入轻练或家长复盘'],
      fallbackPlan: ['错因不清先回点拨', '同类题失败时降级到第一步', '次日未记住则重新排入回忆'],
      evidenceRequired: ['wrong_cause_label', 'near_transfer_attempt', 'next_day_recall']
    },
    light_entry_scale: {
      acceptanceCriteria: ['每个轻入口至少 5 个可复用种子', '种子有第一步和错因', '轻入口能回到核心链路'],
      fallbackPlan: ['无法识别时手动选择科目和卡点', '不生成完整答案', '只保存第一步证据'],
      evidenceRequired: ['light_seed_model', 'first_step_blackboard', 'light_to_core_transition']
    },
    share_return_loop: {
      acceptanceCriteria: ['分享卡带能力缺口', '回流页保留下一步', '分享不做排行和虚假社交'],
      fallbackPlan: ['缺证据时只分享家庭行动', '回流失败时落到首页下一步', '不展示同学比较'],
      evidenceRequired: ['capability_gap_share', 'share_landing_next_action', 'no_ranking_boundary']
    },
    material_factory: {
      acceptanceCriteria: ['材料变成复习卡', '卡片能进入轻练', '材料来源可追溯'],
      fallbackPlan: ['材料太薄时要求补一句卡点', '外部识别不可用时本地手动录入', '不把输入框伪装成自动导入'],
      evidenceRequired: ['material_to_card', 'source_trace', 'practice_asset']
    },
    trust_boundary: {
      acceptanceCriteria: ['未成年人和隐私边界清楚', 'AI 只做学习建议', '家长能看到可控范围'],
      fallbackPlan: ['涉及隐私时提示边界', '配置缺失时保留本地可用链路', '无法确认时回到人工/家长判断'],
      evidenceRequired: ['privacy_boundary', 'ai_suggestion_boundary', 'parent_control']
    }
  };
  const items = surfaceSpecs.map((spec) => {
    const pack = buildSurfaceDepthPack(spec.surface, Object.assign({}, options, {
      globalEvidenceBrief,
      learningQuestArc,
      moduleFlowCompass,
      capabilityEvidenceLedger: capabilityLedger
    }));
    const rows = spec.capabilities
      .map((id) => ledgerRows.find((row) => row && row.id === id))
      .filter(Boolean);
    const readyRows = rows.filter((row) => row.ready);
    const score = rows.length ? Math.round((readyRows.length / rows.length) * 100) : 0;
    const missing = rows.find((row) => !row.ready) || rows[0] || {};
    const contract = maturityContracts[spec.id] || {
      acceptanceCriteria: ['完成真实学习动作', '留下证据', '能进入下一步'],
      fallbackPlan: ['证据不足时先收窄动作', '无法自动判断时给家长可执行问题'],
      evidenceRequired: ['real_action', 'evidence_saved', 'next_action']
    };
    return {
      id: spec.id,
      label: spec.label,
      displayLabel: spec.label,
      surface: spec.surface,
      route: spec.route,
      ready: score >= 75 && pack.surfaceReadiness !== 'thin',
      score,
      readiness: pack.surfaceReadiness,
      evidenceLine: pack.evidenceLine || (missing.evidenceLine || ''),
      nextAction: missing.ready ? spec.nextAction : (missing.nextAction || spec.nextAction),
      nextCapability: missing.label || spec.label,
      competitorLine: spec.competitorLine,
      acceptanceCriteria: contract.acceptanceCriteria,
      fallbackPlan: contract.fallbackPlan,
      evidenceRequired: contract.evidenceRequired,
      acceptanceLine: `验收：${contract.acceptanceCriteria[0]}；${contract.acceptanceCriteria[1]}；${contract.acceptanceCriteria[2]}。`,
      fallbackLine: `兜底：${contract.fallbackPlan[0]}；${contract.fallbackPlan[1]}。`,
      evidenceContractLine: `证据：${contract.evidenceRequired.join(' / ')}`,
      parentCheckLine: `家长只看：${contract.acceptanceCriteria[0]}，不看完整答案或分数刺激。`,
      moatLine: `${spec.label} 的护城河不是功能名，而是：动作 -> 证据 -> 回访 -> 家长决策持续复利。`,
      visibleProof: rows.map((row) => ({
        id: row.id,
        label: row.label,
        ready: !!row.ready,
        evidenceLine: row.evidenceLine,
        route: row.route
      })),
      actionPayload: {
        source: 'capability_maturity_queue',
        actionLabel: spec.nextAction,
        reasonLine: spec.competitorLine,
        evidenceLine: pack.evidenceLine || '',
        route: spec.route
      }
    };
  }).sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? 1 : -1;
    return a.score - b.score;
  });
  const readyCount = items.filter((item) => item.ready).length;
  const next = items.find((item) => !item.ready) || items[0] || null;
  return {
    title: '全局能力厚度队列',
    summary: `已达标 ${readyCount}/${items.length} 个关键能力面。先补 ${next ? next.label : '真实学习证据'}，再谈更大范围竞品能力。`,
    benchmarkLine: '方向：家庭晚间作业闭环 + 第一手证据账本 + 家长低压行动板；借鉴竞品机制，不复制竞品定位。',
    positioningLine: '方向：家庭晚间作业闭环 + 第一手证据账本 + 家长低压行动板；借鉴竞品机制，不复制竞品定位。',
    readyCount,
    totalCount: items.length,
    progress: items.length ? Math.round((readyCount / items.length) * 100) : 0,
    next,
    items,
    reportLine: next ? `${next.label}：${next.nextAction}` : '关键能力面已经闭合，继续沉淀真实学习数据。',
    generatedAt: options.now ? new Date(options.now).toISOString() : new Date().toISOString()
  };
}

function buildCapabilityStructuralReadinessLedger(options = {}) {
  const runtimeLedger = options.capabilityEvidenceLedger || buildCapabilityEvidenceLedger(options);
  const maturityQueue = options.capabilityMaturityQueue || buildCapabilityMaturityQueue(Object.assign({}, options, {
    capabilityEvidenceLedger: runtimeLedger
  }));
  const routeRe = /^\/pages\/[a-z0-9-]+\/[a-z0-9-]+$/i;
  const runtimeRows = Array.isArray(runtimeLedger.rows) ? runtimeLedger.rows : [];
  const maturityItems = Array.isArray(maturityQueue.items) ? maturityQueue.items : [];
  const capabilityRows = runtimeRows.map((row) => {
    const checks = {
      route: routeRe.test(String(row.route || '')),
      emptyStateCta: !!row.nextAction,
      localFallback: !!row.evidenceLine,
      evidenceContract: !!row.id && !!row.label,
      parentSafeLine: !!(row.nextAction || row.evidenceLine),
      nextModuleHandoff: routeRe.test(String(row.route || ''))
    };
    return Object.assign({}, row, {
      structuralReady: Object.keys(checks).every((key) => checks[key]),
      structuralChecks: checks,
      emptyStateLine: row.nextAction || '先完成一条真实学习动作',
      structuralEvidenceLine: `${row.label} 有入口、空状态动作、证据说明和下一模块承接。`
    });
  });
  const maturityRows = maturityItems.map((item) => {
    const checks = {
      route: routeRe.test(String(item.route || '')),
      emptyStateCta: !!item.nextAction,
      localFallback: Array.isArray(item.fallbackPlan) && item.fallbackPlan.length >= 2,
      evidenceContract: Array.isArray(item.evidenceRequired) && item.evidenceRequired.length >= 3,
      parentSafeLine: !!item.parentCheckLine,
      nextModuleHandoff: !!(item.actionPayload && routeRe.test(String(item.actionPayload.route || item.route || '')))
    };
    return {
      id: item.id,
      label: item.label,
      surface: item.surface,
      route: item.route,
      structuralReady: Object.keys(checks).every((key) => checks[key]),
      structuralChecks: checks,
      emptyStateLine: item.nextAction,
      localFallbackLine: Array.isArray(item.fallbackPlan) ? item.fallbackPlan.join(' / ') : '',
      evidenceContractLine: item.evidenceContractLine || (Array.isArray(item.evidenceRequired) ? item.evidenceRequired.join(' / ') : ''),
      parentSafeLine: item.parentCheckLine || '',
      nextModuleHandoff: item.actionPayload || { route: item.route, actionLabel: item.nextAction }
    };
  });
  const capabilityStructuralReady = capabilityRows.filter((item) => item.structuralReady).length;
  const maturityStructuralReady = maturityRows.filter((item) => item.structuralReady).length;
  return {
    id: 'capability_structural_readiness_ledger',
    title: '空状态结构就绪账本',
    summary: `结构就绪 ${capabilityStructuralReady}/${capabilityRows.length} 条能力、${maturityStructuralReady}/${maturityRows.length} 个成熟面；运行时证据仍按真实记录计算。`,
    boundary: '结构就绪只证明新用户无历史时也有入口、空状态动作、兜底、证据契约和下一步，不伪造已发生的学习证据。',
    capabilityStructuralReady,
    capabilityStructuralTotal: capabilityRows.length,
    maturityStructuralReady,
    maturityStructuralTotal: maturityRows.length,
    capabilityRows,
    maturityRows,
    requiredChecks: ['route', 'emptyStateCta', 'localFallback', 'evidenceContract', 'parentSafeLine', 'nextModuleHandoff'],
    runtimeEvidenceLine: `运行时账本仍为 ${runtimeLedger.readyCount}/${runtimeLedger.totalCount}，成熟度仍为 ${maturityQueue.readyCount}/${maturityQueue.totalCount}。`,
    generatedAt: options.now ? new Date(options.now).toISOString() : new Date().toISOString()
  };
}

function buildEvidenceRouteBias(options = {}) {
  const brief = options.globalEvidenceBrief || buildGlobalEvidenceBrief(options);
  const incomingShare = options.incomingShare || loadIncomingShare() || null;
  const reportState = options.reportState || loadLearningReportState();
  const thinking = options.thinkingSummary || thinkingReceiptSummary();
  const reviewCards = options.reviewCards || loadReviewCards();
  const dueCount = reviewCards.filter((card) => card && (card.due || card.dueDate) && !card.isRevisited).length;
  const reportConnected = !!(
    reportState.localLoopConnection
    || reportState.solutionMap
    || (reportState.reportDraft && reportState.reportDraft.solutionMap)
  );
  const knownRoutes = {
    tutor: '/pages/tutor/tutor',
    review: '/pages/review/review',
    arcade: '/pages/arcade/arcade',
    profile: '/pages/profile/profile',
    focus: '/pages/entry-detail/entry-detail?scene=today',
    home: '/pages/home/home'
  };
  let nextRoute = brief.latestRoute || knownRoutes.tutor;
  let gameModeBias = 'balanced';
  let weakKey = 'first_step';
  let questBias = 'socratic';
  let source = 'global_evidence';
  let reasonLine = brief.shareLine || brief.parentLine || '';
  let evidenceLine = brief.reportLine || '';

  if (incomingShare && incomingShare.parent_next_action) {
    source = 'incoming_share';
    weakKey = incomingShare.parent_next_action;
    questBias = 'parent';
    gameModeBias = incomingShare.parent_next_action.indexOf('wrong_cause') >= 0 ? 'repair' : 'balanced';
    nextRoute = incomingShare.parent_next_action.indexOf('revisit') >= 0 ? knownRoutes.review : knownRoutes.tutor;
    reasonLine = incomingShare.action_detail || incomingShare.action_label || reasonLine;
    evidenceLine = incomingShare.action_label || evidenceLine;
    if (incomingShare.capability_gap) {
      weakKey = incomingShare.capability_gap;
      questBias = incomingShare.capability_gap;
      nextRoute = incomingShare.capability_route || nextRoute;
      reasonLine = incomingShare.capability_next_action || reasonLine;
      evidenceLine = incomingShare.capability_label || evidenceLine;
    }
  } else if (dueCount > 0) {
    source = 'due_review';
    nextRoute = knownRoutes.review;
    gameModeBias = 'repair';
    weakKey = 'due_review';
    questBias = 'review';
    reasonLine = `有 ${dueCount} 张回访卡到期，先把昨天的方法接回来。`;
  } else if (!reportConnected && Number(brief.readyCount || 0) >= 2) {
    source = 'report_gap';
    nextRoute = knownRoutes.profile;
    gameModeBias = 'balanced';
    weakKey = 'report_connection';
    questBias = 'parent';
    reasonLine = '已有学习证据，但还没有接到家长能执行的报告动作。';
    evidenceLine = '补上报告到行动的连接';
  } else if (Number(thinking.total || 0) > 0 && Number(brief.reviewEventCount || 0) === 0) {
    source = 'socratic_to_game';
    nextRoute = knownRoutes.arcade;
    gameModeBias = 'stretch';
    weakKey = 'first_step';
    questBias = 'arcade';
    reasonLine = '孩子已经留下第一步，下一步需要一小局练习把结果写回记录。';
    evidenceLine = '把追问证据接到轻练习';
  }

  if (!Object.values(knownRoutes).includes(nextRoute)) nextRoute = knownRoutes.tutor;

  return {
    source,
    nextRoute,
    gameModeBias,
    weakKey,
    questBias,
    reasonLine,
    evidenceLine,
    progress: Number(brief.progress || 0),
    readyCount: Number(brief.readyCount || 0),
    totalCount: Number(brief.totalCount || 0)
  };
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
    diagnostic_probe: receipt.diagnostic_probe || null,
    question_type_socratic_path: receipt.question_type_socratic_path || null,
    socratic_contract: receipt.socratic_contract || null,
    socratic_fallback_plan: receipt.socratic_fallback_plan || null,
    visual_socratic_recovery: receipt.visual_socratic_recovery || null,
    fallback_recovery_bridge: receipt.fallback_recovery_bridge || null,
    three_round_socratic_protocol: receipt.three_round_socratic_protocol || null,
    socratic_prompt_quality_judge: receipt.socratic_prompt_quality_judge || receipt.socraticPromptQualityJudge || null,
    allowed_moves: Array.isArray(receipt.allowed_moves) ? receipt.allowed_moves.slice(0, 6) : [],
    transfer_prompt: receipt.transfer_prompt || '',
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
  const diagnosticProbes = list.filter((item) => item.diagnostic_probe).length;
  const transferPrompts = list.filter((item) => item.transfer_prompt).length;
  const latest = list[0] || null;
  return {
    total,
    avgScore,
    studentFirst: countDone('first'),
    wrongCauseNamed: countDone('cause'),
    answerCopyAvoided: countDone('safe'),
    proofSentence: countDone('proof'),
    blocked,
    diagnosticProbes,
    transferPrompts,
    latest,
    label: total
      ? `Thinking ledger has ${total} parent-visible tutor receipts, ${diagnosticProbes} diagnostic probes, and ${transferPrompts} transfer prompts.`
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
  const reportDailyActionQueue = buildReportDailyActionQueue();
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
  if (reportDailyActionQueue && reportDailyActionQueue.ready && reportDailyActionQueue.active) {
    planItems.unshift({
      homeworkId: reportDailyActionQueue.active.id || 'report_daily_action',
      title: reportDailyActionQueue.active.task,
      subject: '学习画像',
      priorityLabel: '先做',
      reason: '来自学习画像的 7 天行动板，先把今天这一小步接到今晚路线。',
      suggestedAction: reportDailyActionQueue.active.task,
      parentPrompt: reportDailyActionQueue.active.checkpoint,
      estimatedMinutes: reportDailyActionQueue.active.minutes,
      requiredLevel: '建议',
      relatedIssueType: reportDailyActionQueue.active.module,
      route: reportDailyActionQueue.active.route,
      reportDailyActionId: reportDailyActionQueue.active.id,
      evidenceRequired: reportDailyActionQueue.active.evidenceRequired
    });
  }
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
    reportDailyAction: reportDailyActionQueue && reportDailyActionQueue.ready ? reportDailyActionQueue.active : null,
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
  physics_diagram: [
    '先画研究对象和方向。',
    '先标出已知量和要求量。'
  ],
  chemistry_experiment: [
    '先写清反应物和现象。',
    '先判断颜色、气体或沉淀来自哪里。'
  ],
  biology_process: [
    '先说结构对应的功能。',
    '先按过程顺序排三步。'
  ],
  geography_map: [
    '先在图上定位方向和位置。',
    '先说这一现象的第一条原因链。'
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
  if (/物理|受力|电路|光路|运动|速度|压强|浮力|杠杆|透镜|physics|force|circuit/.test(value)) return 'physics_diagram';
  if (/化学|反应|方程式|溶液|气体|沉淀|颜色|酸碱|离子|chemistry/.test(value)) return 'chemistry_experiment';
  if (/生物|细胞|植物|人体|遗传|生态|光合|消化|对照组|biology/.test(value)) return 'biology_process';
  if (/地理|地图|经纬|气候|公转|自转|昼夜|季风|地形|geography|map/.test(value)) return 'geography_map';
  if (/方程|等量|未知数|x|列方程|解方程/.test(value)) return 'equation_setup';
  if (/应用题|题干|条件|已知|问什么|关键词|数量关系|单位/.test(value)) return 'math_word_problem';
  if (/阅读|读不懂|主旨|细节|原因|文章|段落|题目问/.test(value)) return 'reading_question';
  if (/英语|英文|句子|主语|谓语|单词|语法|sentence|subject|verb/.test(value)) return 'english_sentence';
  if (/作文|写作|开头|过程|表达|写不出来|怎么写/.test(value)) return 'writing_process';
  return 'unknown';
}

const TASK_TYPE_ALIAS_MAP = {
  reading_inference: 'reading_question',
  argument_reading: 'reading_question',
  english_grammar: 'english_sentence',
  dictation_sentence: 'english_sentence',
  biology_concept: 'biology_process',
  biology_ecology_chain: 'biology_process',
  geography_spatial: 'geography_map',
  geography_region_analysis: 'geography_map',
  physics_graph: 'physics_diagram',
  physics_energy: 'physics_diagram',
  chemistry_equation: 'chemistry_experiment',
  chemistry_reaction: 'chemistry_experiment',
  data_table_reasoning: 'math_word_problem'
};

function normalizeTaskType(taskType = 'unknown', subject = '') {
  const raw = String(taskType || '').trim();
  const lower = raw.toLowerCase();
  if (raw && SUBJECT_SKILL_DEPTH[raw]) return raw;
  if (lower && SUBJECT_SKILL_DEPTH[lower]) return lower;
  if (lower && TASK_TYPE_ALIAS_MAP[lower]) return TASK_TYPE_ALIAS_MAP[lower];
  const subjectTaskType = taskTypeForSubject(subject);
  if (subjectTaskType) return subjectTaskType;
  return raw || 'unknown';
}

function firstStepTemplatesForTaskType(taskType = 'unknown') {
  const normalized = normalizeTaskType(taskType);
  return (FIRST_STEP_TEMPLATES[normalized] || FIRST_STEP_TEMPLATES.unknown).slice();
}

function suggestedStepForTaskType(taskType = 'unknown') {
  return firstStepTemplatesForTaskType(taskType)[0] || FIRST_STEP_TEMPLATES.unknown[0];
}

const SUBJECT_SKILL_DEPTH = {
  math_word_problem: {
    label: '数学应用题',
    blackboard: ['圈已知条件', '标问题句', '说数量关系'],
    socratic: ['题目问的到底是什么？', '哪两个量之间有关系？', '换一个数字时第一步还一样吗？'],
    game: ['找关键词', '配数量关系', '说第一步'],
    report: '应用题先看读题、关系、单位三处证据。',
    parent: '你先圈了哪一句？为什么先看这句？',
    evidenceRequired: ['known_conditions', 'question_sentence', 'relation_sentence']
  },
  equation_setup: {
    label: '方程建模',
    blackboard: ['写未知数', '找等量关系', '再列式'],
    socratic: ['你准备用什么表示未知量？', '左右两边什么相等？', '如果单位变了要先检查什么？'],
    game: ['未知数卡', '等量关系卡', '变式检查卡'],
    report: '方程题重点看未知量、等量关系和变式迁移。',
    parent: '这题你设的 x 表示什么？两边为什么相等？',
    evidenceRequired: ['unknown_defined', 'equation_relation', 'transfer_check']
  },
  reading_question: {
    label: '阅读理解',
    blackboard: ['判断题型', '回文定位', '证据句复述'],
    socratic: ['这题问细节、主旨还是原因？', '原文哪一句能做证据？', '答案有没有超出原文？'],
    game: ['题型分类', '关键词定位', '证据句匹配'],
    report: '阅读题重点看题型判断、回文定位和答案边界。',
    parent: '你凭原文哪一句判断？这句能不能直接支持答案？',
    evidenceRequired: ['question_type', 'text_evidence', 'answer_boundary']
  },
  english_sentence: {
    label: '英语句法',
    blackboard: ['找主语', '找谓语', '看时态/修饰'],
    socratic: ['谁在做动作？', '真正的谓语在哪里？', '时态线索是哪一个词？'],
    game: ['主谓配对', '时态判断', '句子骨架'],
    report: '英语句子重点看主谓骨架、时态线索和修饰边界。',
    parent: '这句话谁做动作？动作词是哪一个？',
    evidenceRequired: ['subject_found', 'verb_found', 'tense_signal']
  },
  physics_diagram: {
    label: '物理图解',
    blackboard: ['定研究对象', '标方向/状态', '匹配规律'],
    socratic: ['研究对象是谁？', '图上先标哪个方向或状态？', '这一步对应哪条物理规律？'],
    game: ['对象卡', '方向卡', '规律匹配卡'],
    report: '物理题重点看对象、图示第一笔和规律匹配。不能只看公式有没有背。 ',
    parent: '你先画的是哪个对象？箭头或状态为什么先标这里？',
    evidenceRequired: ['object_selected', 'diagram_first_mark', 'law_match']
  },
  chemistry_experiment: {
    label: '化学实验',
    blackboard: ['列物质状态', '看实验现象', '回到守恒/条件'],
    socratic: ['反应前有哪些物质？', '现象是颜色、气体还是沉淀？', '这一步和守恒或条件有什么关系？'],
    game: ['物质状态卡', '现象原因卡', '守恒复核卡'],
    report: '化学题重点看物质状态、实验现象和守恒条件。不能只背方程式。',
    parent: '你先说反应前后分别有什么，再说现象从哪里来。',
    evidenceRequired: ['substance_state', 'phenomenon_reason', 'conservation_check']
  },
  biology_process: {
    label: '生物过程',
    blackboard: ['找结构', '说功能', '排过程顺序'],
    socratic: ['这个结构负责什么功能？', '过程先后顺序是什么？', '哪一个现象能支持结论？'],
    game: ['结构功能卡', '过程排序卡', '证据解释卡'],
    report: '生物题重点看结构功能、过程顺序和证据解释。不能只背名词。',
    parent: '你先说这个结构有什么用，再排前后三步。',
    evidenceRequired: ['structure_function', 'process_order', 'evidence_reason']
  },
  geography_map: {
    label: '地理读图',
    blackboard: ['读方向/图例', '定位区域', '串因果链'],
    socratic: ['图上先看方向还是图例？', '这个区域的位置特征是什么？', '地形、气候或人类活动哪条先影响结果？'],
    game: ['图例定位卡', '区域特征卡', '因果链卡'],
    report: '地理题重点看读图定位、区域特征和因果链。不能只背结论。',
    parent: '你先在图上指出位置，再说第一条原因。',
    evidenceRequired: ['map_reading', 'region_position', 'cause_chain']
  },
  writing_process: {
    label: '写作表达',
    blackboard: ['一句话立意', '列两个要点', '补例子'],
    socratic: ['你最想说明哪一句？', '第一个理由是什么？', '有没有一个具体例子？'],
    game: ['开头句', '要点排序', '例子补全'],
    report: '写作重点看开头句、要点结构和例子支撑。',
    parent: '你先说一句最简单的中心句，后面只补两个理由。',
    evidenceRequired: ['topic_sentence', 'two_points', 'example_support']
  },
  unknown: {
    label: '通用卡点',
    blackboard: ['说题目问什么', '说第一步', '说检查点'],
    socratic: ['这题第一步先看哪里？', '你现在卡在哪一句？', '下一次先检查什么？'],
    game: ['第一步卡', '检查点卡', '复述卡'],
    report: '通用卡点先看第一步是否能说清楚。',
    parent: '你先说第一步，不急着说答案。',
    evidenceRequired: ['child_first_step', 'stuck_sentence', 'next_check']
  }
};

const SOCRATIC_ASSESSMENT_MATRIX = {
  math_word_problem: {
    misconceptionChecks: ['把问题句当条件', '数量关系没说清', '单位没统一'],
    probeSequence: ['先圈问题句', '再说两个量怎么连起来', '最后检查单位'],
    recoveryMoves: ['只保留一个数字和问题句', '让孩子补一句数量关系', '换一个更小数字再问第一步'],
    transferCheck: '换一组数字后，孩子还能先说数量关系。',
    evidenceTag: 'math_relation_probe'
  },
  equation_setup: {
    misconceptionChecks: ['未知数含义不清', '等量关系错位', '式子和题意脱节'],
    probeSequence: ['先问 x 表示什么', '再问左右两边什么相等', '最后让孩子读回方程含义'],
    recoveryMoves: ['把 x 写成一句中文', '画出等量两边', '只列关系不急着求解'],
    transferCheck: '换一个未知量后，孩子还能说清 x 的含义。',
    evidenceTag: 'equation_model_probe'
  },
  reading_question: {
    misconceptionChecks: ['题型没判断', '证据句找错', '答案超出原文'],
    probeSequence: ['先判断问法', '再回文找证据句', '最后删掉无依据的话'],
    recoveryMoves: ['只读题干关键词', '给出两个候选证据句让孩子选', '让孩子复述原文一句'],
    transferCheck: '换一段文本后，孩子还能先定位证据句。',
    evidenceTag: 'reading_evidence_probe'
  },
  english_sentence: {
    misconceptionChecks: ['主语找错', '谓语找错', '时态线索忽略'],
    probeSequence: ['先问谁做动作', '再找真正谓语', '最后看时间或修饰线索'],
    recoveryMoves: ['遮住修饰语只看主干', '把句子拆成主语和动作', '只检查一个时态信号'],
    transferCheck: '换一句话后，孩子还能先找主谓骨架。',
    evidenceTag: 'english_sentence_probe'
  },
  physics_diagram: {
    misconceptionChecks: ['研究对象没定', '方向或状态漏标', '公式和图示脱节'],
    probeSequence: ['先问研究对象是谁', '再标第一根箭头或初末状态', '最后说对应哪条规律'],
    recoveryMoves: ['只画一个对象', '只标一个方向或状态', '把公式翻译成图上的一句话'],
    transferCheck: '换一个物理情境后，孩子还能先画对象和第一笔标注。',
    evidenceTag: 'physics_diagram_probe'
  },
  chemistry_experiment: {
    misconceptionChecks: ['只背方程式', '现象和原因断开', '守恒或条件没检查'],
    probeSequence: ['先列反应前后物质', '再说看到的现象', '最后回到守恒或条件'],
    recoveryMoves: ['把物质分成反应前/反应后', '只问颜色/气体/沉淀来自哪里', '先查一个守恒点'],
    transferCheck: '换一个实验现象后，孩子还能先说物质和现象来源。',
    evidenceTag: 'chemistry_experiment_probe'
  },
  biology_process: {
    misconceptionChecks: ['结构功能混淆', '过程顺序错', '现象不能支持结论'],
    probeSequence: ['先找结构', '再说功能', '最后按过程顺序解释现象'],
    recoveryMoves: ['只连一个结构和一个功能', '把过程排成三步', '让孩子指出支持结论的现象'],
    transferCheck: '换一个生命过程后，孩子还能先说结构功能关系。',
    evidenceTag: 'biology_process_probe'
  },
  geography_map: {
    misconceptionChecks: ['没读图例方向', '区域位置没定', '因果链跳步'],
    probeSequence: ['先看方向和图例', '再定位区域', '最后串第一条因果链'],
    recoveryMoves: ['遮住题干只看图例', '只找一个位置特征', '把原因链缩成两段'],
    transferCheck: '换一张图后，孩子还能先定位并说第一条原因链。',
    evidenceTag: 'geography_map_probe'
  },
  writing_process: {
    misconceptionChecks: ['中心句不清', '理由堆叠无顺序', '例子不能支撑观点'],
    probeSequence: ['先说中心句', '再列两个理由', '最后补一个具体例子'],
    recoveryMoves: ['只写一句最短中心句', '删掉和中心无关的理由', '用生活例子补证据'],
    transferCheck: '换一个题目后，孩子还能先写中心句。',
    evidenceTag: 'writing_structure_probe'
  },
  unknown: {
    misconceptionChecks: ['没有说题目问什么', '第一步太大', '不知道下次检查点'],
    probeSequence: ['先说题目问什么', '再说第一步', '最后说下次检查点'],
    recoveryMoves: ['把任务缩成一句话', '只问从哪里开始', '让孩子说一个可检查动作'],
    transferCheck: '换一个任务后，孩子还能先说第一步。',
    evidenceTag: 'general_first_step_probe'
  }
};

function buildSocraticAssessmentMatrix(input = {}) {
  const sourceText = input.sourceText || input.stuckPointText || input.thought || input.title || input.text || '';
  const detectedType = detectTaskType(sourceText, input.subject || input.issueType || '');
  const taskType = normalizeTaskType(
    input.taskType || (detectedType !== 'unknown' ? detectedType : taskTypeForSubject(input.subject)) || 'unknown',
    input.subject
  );
  const spec = SOCRATIC_ASSESSMENT_MATRIX[taskType] || SOCRATIC_ASSESSMENT_MATRIX.unknown;
  return {
    id: `socratic_assessment_${taskType}`,
    taskType,
    title: '题型追问评测',
    misconceptionChecks: spec.misconceptionChecks.map((text, index) => ({
      id: `${taskType}_mis_${index + 1}`,
      order: index + 1,
      text
    })),
    probeSequence: spec.probeSequence.map((text, index) => ({
      id: `${taskType}_probe_${index + 1}`,
      order: index + 1,
      text,
      stopRule: index === 0 ? '孩子能说出第一步就停，不继续代讲。' : '只追问证据，不直接给答案。'
    })),
    recoveryMoves: spec.recoveryMoves.map((text, index) => ({
      id: `${taskType}_recovery_${index + 1}`,
      order: index + 1,
      text
    })),
    transferCheck: spec.transferCheck,
    questionTypeRubric: spec.misconceptionChecks.map((text, index) => ({
      id: `${taskType}_rubric_${index + 1}`,
      order: index + 1,
      misconception: text,
      probe: spec.probeSequence[index] || spec.probeSequence[0],
      recovery: spec.recoveryMoves[index] || spec.recoveryMoves[0],
      evidence: index === 0 ? spec.evidenceTag : `${spec.evidenceTag}_${index + 1}`
    })),
    visualExplanationSteps: spec.probeSequence.slice(0, 3).map((text, index) => ({
      id: `${taskType}_visual_probe_${index + 1}`,
      order: index + 1,
      boardMove: `小黑板只画第 ${index + 1} 笔：${text}`,
      childReply: index === 0 ? '孩子先说第一步' : '孩子补一句证据',
      avoid: '不写完整答案'
    })),
    fallbackLadder: [
      { id: 'silent', label: '沉默', move: spec.recoveryMoves[0], route: '/pages/tutor/tutor' },
      { id: 'answer_request', label: '要答案', move: '只给第一步小黑板和一个追问，不给完整答案。', route: '/pages/tutor/tutor' },
      { id: 'wrong_again', label: '同错因再错', move: spec.recoveryMoves[2] || spec.recoveryMoves[0], route: '/pages/review/review' }
    ],
    fallbackPolicy: {
      whenSilent: spec.recoveryMoves[0],
      whenAsksAnswer: '只给第一步小黑板和一个追问，不给完整答案。',
      whenWrongAgain: spec.recoveryMoves[2] || spec.recoveryMoves[0]
    },
    evidenceContractLine: `证据合同：${spec.evidenceTag} + child_first_step + fallback_trigger + next_day_revisit。`,
    parentCheckLine: '家长只问第一步和证据，不追完整答案。',
    evidenceRequired: ['misconception_check', 'probe_sequence', spec.evidenceTag, 'transfer_check'],
    evidenceTag: spec.evidenceTag,
    route: '/pages/tutor/tutor'
  };
}

function buildSubjectSkillDepth(input = {}) {
  const sourceText = input.sourceText || input.stuckPointText || input.thought || input.title || input.text || '';
  const detectedType = detectTaskType(sourceText, input.subject || input.issueType || '');
  const taskType = normalizeTaskType(
    input.taskType || (detectedType !== 'unknown' ? detectedType : taskTypeForSubject(input.subject)) || 'unknown',
    input.subject
  );
  const spec = SUBJECT_SKILL_DEPTH[taskType] || SUBJECT_SKILL_DEPTH.unknown;
  const firstStep = sanitizeMiniActionText(input.childArticulatedStep || input.systemSuggestedStep || input.firstStep || suggestedStepForTaskType(taskType));
  const socraticAssessment = buildSocraticAssessmentMatrix(Object.assign({}, input, { taskType }));
  return {
    id: `subject_depth_${taskType}`,
    taskType,
    label: spec.label,
    firstStep,
    blackboard: spec.blackboard.map((text, index) => ({ order: index + 1, text })),
    blackboardBlueprint: buildFirstStepBlackboardBlueprint({
      subjectSkillDepth: {
        taskType,
        label: spec.label,
        firstStep,
        evidenceRequired: spec.evidenceRequired.slice(),
        route: taskType === 'writing_process' ? '/pages/entry-detail/entry-detail?scene=today' : taskType === 'unknown' ? '/pages/tutor/tutor' : '/pages/arcade/arcade'
      },
      subject: input.subject || '',
      sourceText,
      firstStep
    }),
    socraticQuestions: spec.socratic.slice(),
    gameDrills: spec.game.slice(),
    reportSignal: spec.report,
    parentQuestion: spec.parent,
    evidenceRequired: spec.evidenceRequired.slice(),
    socraticAssessment,
    gameBias: taskType === 'unknown' ? 'balanced' : 'repair',
    route: taskType === 'writing_process' ? '/pages/entry-detail/entry-detail?scene=today' : taskType === 'unknown' ? '/pages/tutor/tutor' : '/pages/arcade/arcade',
    shareLine: `${spec.label}：先做「${firstStep}」，再留下 ${spec.evidenceRequired[0]} 证据。`
  };
}

const CURRICULUM_SPINE = {
  math: {
    label: '数学',
    route: '/pages/entry-detail/entry-detail?scene=today',
    nodes: [
      { id: 'read_problem', label: '读题', evidence: '圈已知、问题句、单位' },
      { id: 'model_relation', label: '建模', evidence: '写数量关系或等量关系' },
      { id: 'solve_check', label: '求解复核', evidence: '检查单位、答句和变式' }
    ]
  },
  chinese: {
    label: '语文',
    route: '/pages/tutor/tutor',
    nodes: [
      { id: 'question_type', label: '判断问法', evidence: '细节、主旨、原因、推断' },
      { id: 'text_evidence', label: '回文找证据', evidence: '原文证据句' },
      { id: 'answer_boundary', label: '组织答案', evidence: '答案不越界' }
    ]
  },
  english: {
    label: '英语',
    route: '/pages/entry-detail/entry-detail?scene=today',
    nodes: [
      { id: 'sentence_frame', label: '句子骨架', evidence: '主语、谓语、时态线索' },
      { id: 'word_use', label: '词汇用法', evidence: '词义、搭配、语境' },
      { id: 'output_check', label: '表达复核', evidence: '一句话复述或造句' }
    ]
  },
  physics: {
    label: '物理',
    route: '/pages/tutor/tutor',
    nodes: [
      { id: 'object_state', label: '对象和状态', evidence: '研究对象、初末状态' },
      { id: 'diagram_first', label: '图示第一步', evidence: '受力/电路/光路的第一笔' },
      { id: 'law_match', label: '规律匹配', evidence: '用哪条规律解释现象' }
    ]
  },
  chemistry: {
    label: '化学',
    route: '/pages/tutor/tutor',
    nodes: [
      { id: 'substance_state', label: '物质和状态', evidence: '反应物、生成物、状态变化' },
      { id: 'phenomenon_reason', label: '现象到原因', evidence: '颜色、气体、沉淀背后的原因' },
      { id: 'equation_check', label: '方程式复核', evidence: '守恒和条件' }
    ]
  },
  biology: {
    label: '生物',
    route: '/pages/tutor/tutor',
    nodes: [
      { id: 'structure_function', label: '结构和功能', evidence: '结构对应的功能' },
      { id: 'process_order', label: '过程顺序', evidence: '步骤、变量、对照组' },
      { id: 'evidence_reason', label: '证据解释', evidence: '用现象说明结论' }
    ]
  },
  geography: {
    label: '地理',
    route: '/pages/tutor/tutor',
    nodes: [
      { id: 'map_reading', label: '读图定位', evidence: '方向、位置、图例' },
      { id: 'cause_chain', label: '因果链', evidence: '地形、气候、人类活动关系' },
      { id: 'space_transfer', label: '空间迁移', evidence: '换地区仍能解释' }
    ]
  }
};

const SUBJECT_TASK_TYPE_MAP = {
  math: 'math_word_problem',
  chinese: 'reading_question',
  english: 'english_sentence',
  physics: 'physics_diagram',
  chemistry: 'chemistry_experiment',
  biology: 'biology_process',
  geography: 'geography_map',
  数学: 'math_word_problem',
  语文: 'reading_question',
  英语: 'english_sentence',
  物理: 'physics_diagram',
  化学: 'chemistry_experiment',
  生物: 'biology_process',
  地理: 'geography_map'
};

function taskTypeForSubject(subject = '') {
  const raw = String(subject || '').trim();
  if (!raw) return '';
  if (SUBJECT_TASK_TYPE_MAP[raw]) return SUBJECT_TASK_TYPE_MAP[raw];
  const lower = raw.toLowerCase();
  return SUBJECT_TASK_TYPE_MAP[lower] || '';
}

function inferCurriculumSubject(input = {}, subjectSkillDepth = null) {
  const text = `${input.subject || ''} ${input.sourceText || ''} ${input.stuckPointText || ''} ${input.thought || ''} ${input.title || ''} ${(subjectSkillDepth && subjectSkillDepth.label) || ''}`;
  if (/物理|受力|电路|光路|速度|压强|浮力|physics/i.test(text)) return 'physics';
  if (/化学|方程式|反应|溶液|气体|沉淀|chemistry/i.test(text)) return 'chemistry';
  if (/生物|细胞|植物|人体|对照组|biology/i.test(text)) return 'biology';
  if (/地理|地图|经纬|气候|公转|自转|geography/i.test(text)) return 'geography';
  if (/英语|英文|单词|语法|句子|english|sentence|verb/i.test(text)) return 'english';
  if (/语文|阅读|作文|文章|段落|主旨|chinese/i.test(text)) return 'chinese';
  return 'math';
}

function buildCurriculumSpine(input = {}) {
  const subjectDepth = input.subjectSkillDepth || buildSubjectSkillDepth(input);
  const subjectId = inferCurriculumSubject(input, subjectDepth);
  const subject = CURRICULUM_SPINE[subjectId] || CURRICULUM_SPINE.math;
  const evidenceKey = subjectDepth && Array.isArray(subjectDepth.evidenceRequired)
    ? subjectDepth.evidenceRequired[0]
    : subject.nodes[0].id;
  const matchedIndex = subject.nodes.findIndex((node) => node.id === evidenceKey);
  const currentIndex = matchedIndex >= 0 ? matchedIndex : 0;
  const currentNode = subject.nodes[currentIndex] || subject.nodes[0];
  const nextNode = subject.nodes[Math.min(subject.nodes.length - 1, currentIndex + 1)] || currentNode;
  const firstStep = subjectDepth.firstStep || suggestedStepForTaskType(subjectDepth.taskType);
  const progression = subject.nodes.map((node, index) => ({
    id: node.id,
    order: index + 1,
    label: node.label,
    evidence: node.evidence,
    active: node.id === currentNode.id,
    done: index < currentIndex
  }));
  return {
    id: `curriculum_${subjectId}_${subjectDepth.taskType || 'unknown'}`,
    subjectId,
    subjectLabel: subject.label,
    taskType: subjectDepth.taskType,
    title: `${subject.label}学习骨架`,
    currentNode,
    nextNode,
    progression,
    firstStep,
    route: subjectDepth.route || subject.route,
    visualBoardLine: `${subject.label}小黑板：先做「${firstStep}」，只画第一步，不直接给完整答案。`,
    reportLine: `${subject.label}不是只看做对没有，先看「${currentNode.label}」是否留下证据：${currentNode.evidence}。`,
    parentDecisionLine: `今晚家长只判断一件事：孩子能否说清「${currentNode.label}」这一小步。`,
    gameLine: `轻练习优先练「${currentNode.label}」，下一关再看「${nextNode.label}」。`,
    shareLine: `${subject.label}闭环：${currentNode.label} -> ${nextNode.label}，保留证据再进入下一步。`,
    scaleLine: `七科课程骨架已覆盖：${Object.keys(CURRICULUM_SPINE).map((key) => CURRICULUM_SPINE[key].label).join(' / ')}；当前只落到第一步图解和证据闭环。`,
    lightEntrySeeds: subject.nodes.map((node) => ({
      id: `${subjectId}_${node.id}`,
      label: node.label,
      prompt: `先说${node.label}：${node.evidence}`,
      route: subject.route
    }))
  };
}

function buildVisualSocraticMatrix(input = {}) {
  const subjectDepth = input.subjectSkillDepth || buildSubjectSkillDepth(input);
  const curriculum = input.curriculumSpine || buildCurriculumSpine(Object.assign({}, input, { subjectSkillDepth: subjectDepth }));
  const socraticAssessment = input.socraticAssessment || subjectDepth.socraticAssessment || buildSocraticAssessmentMatrix(Object.assign({}, input, { taskType: subjectDepth.taskType }));
  const progression = Array.isArray(curriculum.progression) ? curriculum.progression : [];
  const boardMoves = progression.slice(0, 3).map((node) => ({
    id: node.id,
    order: node.order,
    label: node.label,
    drawAction: `在小黑板只标出「${node.label}」这一笔`,
    evidence: node.evidence,
    prompt: `你能先指出${node.label}在哪里吗？`
  }));
  const socraticQuestions = (subjectDepth.socraticQuestions || []).slice(0, 3).map((question, index) => ({
    id: `probe_${index + 1}`,
    order: index + 1,
    question,
    intent: index === 0 ? '定位卡点' : index === 1 ? '要求证据' : '检查迁移',
    stopRule: '孩子能说出自己的第一步就停，不继续代讲完整答案。'
  }));
  const fallback = {
    whenSilent: `如果孩子说不出来，退回到「${curriculum.currentNode.label}」：${curriculum.currentNode.evidence}`,
    whenAsksAnswer: '如果孩子直接要答案，只给第一笔小黑板和一个追问，不给完整过程。',
    whenWrongAgain: `如果同类题又错，下一轮游戏只练「${curriculum.currentNode.label}」。`
  };
  return {
    id: `visual_socratic_${curriculum.subjectId}_${subjectDepth.taskType || 'unknown'}`,
    title: `${curriculum.subjectLabel}第一步图解`,
    subjectLabel: curriculum.subjectLabel,
    taskType: subjectDepth.taskType,
    boardMoves,
    blackboardBlueprint: buildFirstStepBlackboardBlueprint(Object.assign({}, input, {
      subjectSkillDepth: subjectDepth,
      curriculumSpine: curriculum,
      boardMoves
    })),
    socraticQuestions,
    socraticAssessment,
    fallback,
    visualBoundary: '这是第一步小黑板，不是全科自动板书讲题。',
    parentLine: curriculum.parentDecisionLine,
    reportLine: curriculum.reportLine,
    shareLine: curriculum.shareLine,
    route: curriculum.route
  };
}

function buildFirstStepBlackboardBlueprint(input = {}) {
  const subjectDepth = input.subjectSkillDepth || buildSubjectSkillDepth(input);
  const curriculum = input.curriculumSpine || buildCurriculumSpine(Object.assign({}, input, { subjectSkillDepth: subjectDepth }));
  const boardMoves = Array.isArray(input.boardMoves) && input.boardMoves.length
    ? input.boardMoves
    : (Array.isArray(curriculum.progression) ? curriculum.progression : []).slice(0, 3).map((node) => ({
      id: node.id,
      order: node.order,
      label: node.label,
      evidence: node.evidence,
      drawAction: `只标出「${node.label}」这一笔`
    }));
  const firstMove = boardMoves[0] || { label: '第一步', evidence: subjectDepth.firstStep || '孩子自己的第一步' };
  return {
    id: `first_step_blackboard_${curriculum.subjectId}_${subjectDepth.taskType || 'unknown'}`,
    title: `${curriculum.subjectLabel}第一步小黑板`,
    boundary: '只画第一笔和证据点，不讲完整答案。',
    openingQuestion: `先看第一步小黑板这一笔：${firstMove.label}在哪里？`,
    firstStroke: {
      label: firstMove.label,
      drawAction: firstMove.drawAction || `只标出「${firstMove.label}」这一笔`,
      evidence: firstMove.evidence || subjectDepth.firstStep,
      childReply: `孩子要能说出：我先处理「${firstMove.label}」。`
    },
    layers: boardMoves.slice(0, 3).map((move, index) => ({
      id: move.id || `layer_${index + 1}`,
      order: index + 1,
      label: move.label,
      drawAction: move.drawAction || `只标出「${move.label}」这一笔`,
      evidence: move.evidence,
      parentQuestion: index === 0
        ? `你第一步先看「${move.label}」吗？`
        : `这一笔有什么证据？`
    })),
    stopRule: '孩子能说出第一步就停；说不出时退回更小的一笔。',
    wrongCauseReturn: `如果同类题又错，先回到「${firstMove.label}」这一笔，不加题量。`,
    reportLine: `${curriculum.subjectLabel}报告只记录第一笔证据：${firstMove.evidence || subjectDepth.firstStep}。`,
    gameHook: `轻练习优先生成 3 张「${firstMove.label}」主动回忆卡。`,
    shareLine: `分享时只带走第一步小黑板和家长追问，不带完整答案。`,
    answerPolicy: 'first_step_only_no_full_answer',
    evidenceRequired: ['first_stroke_marked', 'child_first_step', 'parent_one_question', 'next_day_revisit'],
    exitCriteria: [
      'child_can_name_first_step',
      'child_can_point_to_evidence',
      'parent_can_repeat_one_question',
      'next_day_revisit_scheduled'
    ],
    blockedFields: ['full_answer', 'original_question_photo', 'score', 'ranking', 'full_dialogue'],
    localCodeOwns: ['board_layer_choice', 'stop_rule', 'answer_policy', 'exit_gate'],
    aiRole: 'explain_the_same_first_step_in_child_friendly_words',
    route: curriculum.route || subjectDepth.route || '/pages/tutor/tutor'
  };
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

const FIRST_STEP_PROMPT_CARDS = {
  math: {
    subjectLabel: '数学',
    title: '数学第一步卡',
    body: '先圈题目问什么，再找数量关系，不急着算最终结果。',
    structure: '问题 → 条件 → 关系',
    firstMove: '圈出问题里的目标量和已知量。',
    childPrompt: '我第一步先找题目问的量和相关条件。',
    parentPrompt: '你先看哪里，才能知道这题在求什么？',
    avoid: '不要直接套公式或抄完整答案。'
  },
  physics: {
    subjectLabel: '物理',
    title: '物理第一步卡',
    body: '先画对象和方向，分清已知量、过程和单位，再决定用哪个关系。',
    structure: '对象 → 方向/过程 → 公式',
    firstMove: '先画研究对象，标出力、运动方向或电路路径。',
    childPrompt: '我第一步先确定研究对象和方向。',
    parentPrompt: '这题先看哪个物体、哪个方向或哪个过程？',
    avoid: '不要先代数字，也不要直接跳到公式。'
  },
  chemistry: {
    subjectLabel: '化学',
    title: '化学第一步卡',
    body: '先分清反应前后有什么、现象说明什么，再看方程式或实验条件。',
    structure: '物质 → 现象 → 原理',
    firstMove: '先列出反应物、生成物或实验变量。',
    childPrompt: '我第一步先分清反应前后有什么变化。',
    parentPrompt: '这题先看物质变化，还是实验现象？',
    avoid: '不要只背结论，也不要把现象当原因。'
  },
  geography: {
    subjectLabel: '地理',
    title: '地理第一步卡',
    body: '先看图、方向和位置关系，再说因果，不急着背结论。',
    structure: '图表 → 位置/方向 → 因果',
    firstMove: '先找图例、方向、经纬度或运动关系。',
    childPrompt: '我第一步先看图上的方向和位置关系。',
    parentPrompt: '这题先看图里的哪个方向、位置或变化？',
    avoid: '不要脱离图表直接背答案。'
  },
  chinese: {
    subjectLabel: '语文',
    title: '语文第一步卡',
    body: '先看题目问法，再回原文找依据，最后组织一句自己的话。',
    structure: '问法 → 原文依据 → 表达',
    firstMove: '先圈题干关键词，回到原文找对应句。',
    childPrompt: '我第一步先看题目到底问什么，再回原文找依据。',
    parentPrompt: '题目让你回答什么？原文哪一句能支持？',
    avoid: '不要凭感觉空写。'
  },
  english: {
    subjectLabel: '英语',
    title: '英语第一步卡',
    body: '先找句子主干或题目关键词，再看时态、指代和上下文。',
    structure: '关键词 → 句子主干 → 上下文',
    firstMove: '先找主语、谓语或题目关键词。',
    childPrompt: '我第一步先找句子主干和题目关键词。',
    parentPrompt: '这句话先找谁做什么，还是先看上下文？',
    avoid: '不要逐词硬翻，也不要直接猜选项。'
  },
  biology: {
    subjectLabel: '生物',
    title: '生物第一步卡',
    body: '先分清结构、功能和过程，再看图示或实验变量。',
    structure: '结构 → 功能/过程 → 证据',
    firstMove: '先找图中的结构或实验变量。',
    childPrompt: '我第一步先分清结构和它对应的功能。',
    parentPrompt: '这题先看结构、过程，还是实验变量？',
    avoid: '不要只背名词，先说清它在图里起什么作用。'
  }
};

const FIRST_STEP_CARD_VARIANTS = [
  {
    subjectKey: 'physics',
    pattern: /受力|力|摩擦|压力|浮力|重力/,
    patch: {
      title: '物理受力第一步卡',
      body: '先确定研究对象，再把受到的力一个个标出来。',
      structure: '研究对象 → 受力方向 → 平衡/运动',
      firstMove: '先画出研究对象，标出重力、支持力、拉力或摩擦力方向。',
      childPrompt: '我第一步先画研究对象和受力方向。',
      parentPrompt: '这题先看哪个物体受了哪些力？'
    }
  },
  {
    subjectKey: 'physics',
    pattern: /电路|电流|电压|电阻|串联|并联/,
    patch: {
      title: '物理电路第一步卡',
      body: '先看电路路径，再判断串联、并联和测量对象。',
      structure: '电源 → 路径 → 元件/表',
      firstMove: '先沿电流路径走一遍，圈出电流表或电压表测的是谁。',
      childPrompt: '我第一步先看电流怎么走。',
      parentPrompt: '这题先看电流路径，还是先看表测谁？'
    }
  },
  {
    subjectKey: 'chemistry',
    pattern: /方程式|配平|反应/,
    patch: {
      title: '化学方程式第一步卡',
      body: '先写清反应物和生成物，再检查元素守恒。',
      structure: '反应物 → 生成物 → 守恒',
      firstMove: '先把反应前后物质写在两边，不急着配系数。',
      childPrompt: '我第一步先分清反应物和生成物。',
      parentPrompt: '反应前有什么，反应后生成了什么？'
    }
  },
  {
    subjectKey: 'chemistry',
    pattern: /实验|现象|变量|溶液|沉淀|气体/,
    patch: {
      title: '化学实验第一步卡',
      body: '先看实验目的和变量，再把现象和原因分开。',
      structure: '目的 → 变量 → 现象/原因',
      firstMove: '先圈实验在比较什么条件，观察到什么现象。',
      childPrompt: '我第一步先找实验变量和现象。',
      parentPrompt: '这个实验改变了什么，观察到了什么？'
    }
  },
  {
    subjectKey: 'geography',
    pattern: /自转|公转|昼夜|四季|五带/,
    patch: {
      title: '地理运动第一步卡',
      body: '先判断是自转还是公转，再说它带来的现象。',
      structure: '运动方式 → 位置变化 → 现象',
      firstMove: '先圈题目问的是昼夜、四季还是太阳高度。',
      childPrompt: '我第一步先判断这是自转还是公转带来的变化。',
      parentPrompt: '这题先看地球哪种运动？'
    }
  },
  {
    subjectKey: 'geography',
    pattern: /经纬|地图|方向|比例尺|等高线/,
    patch: {
      title: '地理读图第一步卡',
      body: '先看图例、方向和比例，再读位置关系。',
      structure: '图例 → 方向/比例 → 位置',
      firstMove: '先找方向标、图例、比例尺或经纬线。',
      childPrompt: '我第一步先看图例和方向。',
      parentPrompt: '这张图先看哪个标记才能定位？'
    }
  },
  {
    subjectKey: 'math',
    pattern: /几何|角|三角形|圆|辅助线|面积/,
    patch: {
      title: '数学图形第一步卡',
      body: '先把已知条件标到图上，再找相等、平行或比例关系。',
      structure: '图形 → 已知标记 → 关系',
      firstMove: '先在图上标出已知量和要求的量。',
      childPrompt: '我第一步先把条件标到图上。',
      parentPrompt: '图上哪些量是已知的，题目要求哪一个？'
    }
  },
  {
    subjectKey: 'math',
    pattern: /方程|等量|应用题|列式|单位1|比例/,
    patch: {
      title: '数学关系第一步卡',
      body: '先找谁和谁在比较，再写出等量关系。',
      structure: '对象 → 比较 → 等量关系',
      firstMove: '先圈两个比较对象和题目要求的未知量。',
      childPrompt: '我第一步先找比较对象和等量关系。',
      parentPrompt: '谁和谁在比？未知量是哪一个？'
    }
  },
  {
    subjectKey: 'english',
    pattern: /时态|语法|主语|谓语|从句/,
    patch: {
      title: '英语语法第一步卡',
      body: '先找主谓，再看时间词和句子结构。',
      structure: '主谓 → 时间词 → 结构',
      firstMove: '先划出主语和谓语，再看时态线索。',
      childPrompt: '我第一步先找主语、谓语和时间词。',
      parentPrompt: '这句话是谁做什么？时间线索在哪里？'
    }
  },
  {
    subjectKey: 'chinese',
    pattern: /阅读|原文|依据|段落|理解/,
    patch: {
      title: '语文阅读第一步卡',
      body: '先读清题目问法，再回原文找依据句。',
      structure: '问法 → 定位 → 依据',
      firstMove: '先圈题干关键词，再回原文定位相关段落。',
      childPrompt: '我第一步先圈题干关键词，回原文找依据。',
      parentPrompt: '题目问的关键词是什么？原文哪一段能支持？'
    }
  },
  {
    subjectKey: 'biology',
    pattern: /实验|变量|对照|观察/,
    patch: {
      title: '生物实验第一步卡',
      body: '先找实验变量和对照组，再判断结论来自哪条证据。',
      structure: '变量 → 对照 → 证据',
      firstMove: '先圈自变量、因变量和对照条件。',
      childPrompt: '我第一步先找变量和对照组。',
      parentPrompt: '这个实验改变了什么，观察了什么？'
    }
  }
];

const LOCAL_SCENARIO_LOOP_CASES = [
  {
    id: 'math_relation_apples',
    subject: 'math',
    subjectLabel: '数学',
    issueType: '列式关系',
    tag: '应用题',
    title: '数学应用题先找关系',
    inputText: '数学应用题：小明有一些苹果，给妹妹 8 个后还剩 15 个。我知道要算总数，但不知道第一步怎么列式。',
    systemSuggestedStep: '先圈出“给出 8 个后还剩 15 个”，判断原来数量 = 给出的 + 剩下的。',
    childFirstStep: '我第一步先圈出原来的苹果数是未知量，再找 8 个和 15 个的关系。',
    parentPrompt: '原来的数量、给出的数量、剩下的数量，谁和谁合起来？',
    nearTransferPrompt: '把“给出 8 个”换成“吃掉 6 个”，第一步还是先找什么关系？',
    outcomeStandard: '孩子能说出“原来 = 给出或减少的 + 剩下的”，再开始列式。'
  },
  {
    id: 'math_geometry_angle',
    subject: 'math',
    subjectLabel: '数学',
    issueType: '几何图形',
    tag: '几何',
    title: '几何题先把条件标到图上',
    inputText: '数学几何：图里有平行线和一个三角形，题目让求角度。我看图很乱，不知道先看哪两个角。',
    systemSuggestedStep: '先把已知角和平行线标记到图上，再找同位角、内错角或三角形内角和。',
    childFirstStep: '我第一步先把已知角标到图上，再看平行线能推出哪两个角相等。',
    parentPrompt: '图上哪些是已知，哪条线告诉你角之间有关系？',
    nearTransferPrompt: '换一张有平行线的角度图，先标已知还是先算？为什么？',
    outcomeStandard: '孩子能先标图，再说出一个可用的角关系。'
  },
  {
    id: 'physics_force_block',
    subject: 'physics',
    subjectLabel: '物理',
    issueType: '受力分析',
    tag: '受力',
    title: '物理受力先定对象',
    inputText: '物理受力题：木块在水平桌面上被拉着匀速运动，问摩擦力。我总是先套公式，但不知道力怎么画。',
    systemSuggestedStep: '先确定研究对象是木块，再标重力、支持力、拉力和摩擦力方向。',
    childFirstStep: '我第一步先画木块这个研究对象，再标出重力、支持力、拉力和摩擦力方向。',
    parentPrompt: '这题先研究哪个物体？它受到哪些力？',
    nearTransferPrompt: '如果木块改成斜面上的小车，第一步还是先做什么？',
    outcomeStandard: '孩子能先说研究对象和力的方向，不直接代公式。'
  },
  {
    id: 'physics_circuit_path',
    subject: 'physics',
    subjectLabel: '物理',
    issueType: '电路路径',
    tag: '电路',
    title: '电路题先沿电流走一遍',
    inputText: '物理电路：有两个灯泡和一个电流表，问串联还是并联。我看图会乱，不知道电流怎么走。',
    systemSuggestedStep: '先从电源正极沿电流路径走一遍，圈出分叉点和电流表测量对象。',
    childFirstStep: '我第一步先从电源开始沿电流路径走一遍，找有没有分叉。',
    parentPrompt: '电流从哪里出发？有没有分成两条路？',
    nearTransferPrompt: '换成多一个开关的电路图，第一步先找什么？',
    outcomeStandard: '孩子能用“有没有分叉”判断串并联的第一步。'
  },
  {
    id: 'chem_equation_balance',
    subject: 'chemistry',
    subjectLabel: '化学',
    issueType: '方程式配平',
    tag: '方程式',
    title: '化学方程式先分清前后',
    inputText: '化学方程式：铁和氧气反应生成四氧化三铁。我知道要配平，但总是先乱填系数。',
    systemSuggestedStep: '先写清反应物和生成物，再检查每种元素左右各有几个。',
    childFirstStep: '我第一步先把反应物和生成物分清，再数左右两边每种元素的个数。',
    parentPrompt: '反应前有什么，反应后生成什么？左右两边哪种元素先不相等？',
    nearTransferPrompt: '把反应换成氢气燃烧，第一步还是先做什么？',
    outcomeStandard: '孩子能先分反应物/生成物，再数元素守恒。'
  },
  {
    id: 'chem_experiment_variable',
    subject: 'chemistry',
    subjectLabel: '化学',
    issueType: '实验变量',
    tag: '实验',
    title: '化学实验先看变量',
    inputText: '化学实验题：比较不同溶液和金属反应快慢。我看现象很多，不知道哪个才是原因。',
    systemSuggestedStep: '先找实验目的和改变的条件，再把现象与原因分开。',
    childFirstStep: '我第一步先找这个实验在比较什么条件，再看观察到了什么现象。',
    parentPrompt: '这个实验改变了什么？观察到什么？两件事要分开说。',
    nearTransferPrompt: '如果实验变成比较温度影响反应快慢，第一步看什么？',
    outcomeStandard: '孩子能说出变量、现象、结论之间的顺序。'
  },
  {
    id: 'geo_earth_motion',
    subject: 'geography',
    subjectLabel: '地理',
    issueType: '地球运动',
    tag: '自转公转',
    title: '地理先判断运动方式',
    inputText: '地理：题目问昼夜更替和四季变化。我总把自转和公转弄混，不知道先判断哪一个。',
    systemSuggestedStep: '先圈题目问的是昼夜、季节还是太阳高度，再判断自转或公转。',
    childFirstStep: '我第一步先看题目问的是昼夜还是四季，再判断是自转还是公转。',
    parentPrompt: '这题问的是一天里的变化，还是一年里的变化？',
    nearTransferPrompt: '如果题目问五带划分，第一步先看哪类变化？',
    outcomeStandard: '孩子能按现象区分自转和公转。'
  },
  {
    id: 'english_grammar_tense',
    subject: 'english',
    subjectLabel: '英语',
    issueType: '语法时态',
    tag: '语法',
    title: '英语句子先找主谓和时间',
    inputText: '英语语法题：句子里有 yesterday 和 several times，我不确定用过去时还是现在完成时。',
    systemSuggestedStep: '先找主语、谓语和时间线索，再判断动作发生和现在是否有关。',
    childFirstStep: '我第一步先找主语、谓语和时间词，再判断这个动作和现在有没有关系。',
    parentPrompt: '这句话是谁做什么？时间线索在哪里？',
    nearTransferPrompt: '如果时间词换成 already，第一步还是先找什么？',
    outcomeStandard: '孩子能先找句子主干和时间线索，再选时态。'
  },
  {
    id: 'chinese_reading_evidence',
    subject: 'chinese',
    subjectLabel: '语文',
    issueType: '阅读证据',
    tag: '阅读',
    title: '语文阅读先回原文找依据',
    inputText: '语文阅读：题目问人物为什么这么做。我能感觉到答案，但写不出依据。',
    systemSuggestedStep: '先圈题干关键词，再回原文找能支撑判断的句子。',
    childFirstStep: '我第一步先圈题目问的关键词，再回原文找对应句子当依据。',
    parentPrompt: '题目问的关键词是什么？原文哪一句能支持你的判断？',
    nearTransferPrompt: '如果题目问“表达了什么情感”，第一步先找什么？',
    outcomeStandard: '孩子能用原文一句话支撑自己的回答。'
  },
  {
    id: 'biology_control_group',
    subject: 'biology',
    subjectLabel: '生物',
    issueType: '实验变量',
    tag: '对照实验',
    title: '生物实验先找变量和对照',
    inputText: '生物实验：探究光照对植物生长的影响。我分不清自变量、因变量和对照组。',
    systemSuggestedStep: '先找实验改变的条件、观察的结果和保持不变的条件。',
    childFirstStep: '我第一步先找改变的是光照，观察的是植物生长情况，对照组是不改变光照的那组。',
    parentPrompt: '实验改变了什么？观察了什么？哪一组用来对照？',
    nearTransferPrompt: '如果换成探究水分影响植物生长，第一步怎么找变量？',
    outcomeStandard: '孩子能说清自变量、因变量和对照组。'
  }
];

function firstStepVariantFor(subjectKey, focus = {}) {
  const text = [
    focus.subject,
    focus.subjectLabel,
    focus.title,
    focus.issueType,
    focus.sourceText,
    focus.thought,
    focus.stuckPointText
  ].filter(Boolean).join(' ');
  return FIRST_STEP_CARD_VARIANTS.find((item) => item.subjectKey === subjectKey && item.pattern.test(text)) || null;
}

function inferFirstStepSubjectKey(focus = {}) {
  const text = [
    focus.subject,
    focus.subjectLabel,
    focus.title,
    focus.issueType,
    focus.sourceText,
    focus.thought,
    focus.stuckPointText
  ].filter(Boolean).join(' ');
  if (/物理|受力|电路|光路|透镜|速度|功|能量|压强|浮力/.test(text)) return 'physics';
  if (/化学|反应|方程式|溶液|气体|沉淀|实验|酸|碱|盐|分子|原子/.test(text)) return 'chemistry';
  if (/地理|经纬|地图|地球|自转|公转|昼夜|四季|气候|地形|河流/.test(text)) return 'geography';
  if (/英语|英文|单词|阅读|语法|句子|时态|主语|谓语/.test(text)) return 'english';
  if (/语文|阅读理解|作文|古诗|文言|段落|原文|修辞/.test(text)) return 'chinese';
  if (/生物|细胞|植物|动物|消化|遗传|生态|实验变量/.test(text)) return 'biology';
  if (/数学|方程|几何|函数|应用题|单位1|等量|列式|分数|比例/.test(text)) return 'math';
  return '';
}

function buildFirstStepPromptCard(focus = {}) {
  const subjectKey = inferFirstStepSubjectKey(focus);
  const card = FIRST_STEP_PROMPT_CARDS[subjectKey] || null;
  if (!card) return null;
  const variant = firstStepVariantFor(subjectKey, focus);
  return Object.assign({}, card, variant ? variant.patch : {}, {
    subjectKey,
    variant: variant ? variant.patch.title : '',
    noFinalAnswer: true,
    cardType: 'first_step_prompt',
    safetyLine: '只提示第一步，不生成完整答案。'
  });
}

function buildLocalScenarioLoopCases() {
  return LOCAL_SCENARIO_LOOP_CASES.map((item) => {
    const firstStepCard = buildFirstStepPromptCard({
      subject: item.subject,
      subjectLabel: item.subjectLabel,
      title: item.title,
      issueType: `${item.issueType} ${item.inputText}`,
      sourceText: item.inputText,
      thought: item.inputText,
      stuckPointText: item.inputText
    });
    return Object.assign({}, item, {
      label: `${item.subjectLabel} · ${item.tag}`,
      displayLabel: `${item.subjectLabel} · ${item.tag}`,
      firstStepCard,
      previewLine: item.childFirstStep,
      nextAction: '走一遍：第一步提示 → 回访卡 → 迁移练习 → 家长追问'
    });
  });
}

function applyLocalScenarioLoopCase(caseId) {
  const cases = buildLocalScenarioLoopCases();
  const selected = cases.find((item) => item.id === caseId) || cases[0];
  if (!selected) return null;
  const focus = saveTodayFocusFromThought(selected.inputText, {
    id: `focus_local_scenario_loop_${selected.id}`,
    source: 'local_scenario_loop',
    title: selected.title,
    subject: selected.subject,
    subjectLabel: selected.subjectLabel,
    issueType: `${selected.issueType} ${selected.tag}`,
    systemSuggestedStep: selected.systemSuggestedStep,
    recommendation: selected.nearTransferPrompt,
    helper: selected.parentPrompt,
    isStuck: true
  });
  saveChildArticulatedStep(selected.childFirstStep, {
    repairStatus: 'in_progress',
    progress: 78,
    source: 'local_scenario_loop',
    skipNextDaySeed: true
  });
  const repairedFocus = updateTodayFocusRepair({
    repairStatus: 'completed',
    progress: 100,
    hasMiniActionDone: true,
    miniActionText: selected.childFirstStep,
    childArticulatedStep: selected.childFirstStep,
    childStepSentence: selected.childFirstStep,
    source: 'local_scenario_loop'
  });
  const reviewCard = ensureTodayFocusReviewCard(repairedFocus || focus);
  if (reviewCard && reviewCard.id) {
    recordTransferPracticeAttempt({
      cardId: reviewCard.id,
      promptId: 'near_transfer',
      result: 'attempted',
      childExplanation: selected.nearTransferPrompt,
      parentChecked: false
    });
    recordTransferPracticeAttempt({
      cardId: reviewCard.id,
      promptId: 'teach_back',
      result: 'parent_checked',
      childExplanation: selected.childFirstStep,
      parentChecked: true
    });
    recordOutcomeCheck({
      cardId: reviewCard.id,
      masteryStage: 'first_step_ready',
      childCanExplain: true,
      transferWorked: false,
      nextDayRemembered: false,
      parentVerified: true
    });
  }
  const parentReceipt = recordParentReflectionReceipt({
    source: 'local_scenario_loop',
    parentAskedOneQuestion: true,
    childRecalledFirstStep: true,
    nextDayRevisit: false,
    phrase: selected.parentPrompt,
    childArticulatedStep: selected.childFirstStep
  });
  appendReviewEvent({
    type: 'local_scenario_loop_applied',
    caseId: selected.id,
    cardId: reviewCard && reviewCard.id,
    subject: selected.subject,
    rating: 'created'
  });
  return {
    case: selected,
    focus: repairedFocus || focus,
    card: reviewCard,
    firstStepCard: buildFirstStepPromptCard(repairedFocus || focus),
    parentReceipt,
    parentPrompt: selected.parentPrompt,
    outcomeStandard: selected.outcomeStandard,
    flowSteps: [
      { id: 'first_step_card', displayLabel: '第一步提示', done: true },
      { id: 'review_card', displayLabel: '回访卡', done: !!reviewCard },
      { id: 'transfer_practice', displayLabel: '迁移练习', done: !!reviewCard },
      { id: 'parent_question', displayLabel: '家长一句话', done: !!parentReceipt },
      { id: 'outcome_check', displayLabel: '结果复核', done: !!reviewCard }
    ],
    nextRoutes: [
      { id: 'review', label: '去修这张卡', path: '/pages/review/review' },
      { id: 'profile', label: '看家长复盘', path: '/pages/profile/profile' }
    ],
    nextAction: '已生成回访卡、迁移练习和家长追问；下一步去“今晚只修一个卡点”复核。'
  };
}

function buildBlackboardHint(focus = {}) {
  if (!focus || !focus.id && !focus.issueType && !focus.title && !focus.sourceText) return null;
  const issueType = focus.issueType || '';
  const hint = BLACKBOARD_HINTS[issueType] || null;
  const firstStepCard = buildFirstStepPromptCard(focus);
  if (!hint && !firstStepCard) return null;
  return Object.assign({}, firstStepCard || {}, hint || {}, {
    issueType,
    firstStepCard,
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

function buildSpacedCadenceReviewCards(focus = {}) {
  if (!focus || !focus.id) return [];
  const now = new Date();
  const focusId = focus.id;
  const baseTitle = formatInternalLabel(focus.title || focus.sourceText || focus.issueType || '', '今晚修过的卡点');
  const base = {
    deckId: 'ydzx-core',
    template: 'active_recall',
    source: 'today_focus_cadence',
    sourceFocusId: focusId,
    subject: focus.subject || '',
    issueType: focus.issueType || '思路卡点',
    weakPoint: focus.title || focus.issueType || '今晚修过的卡点',
    wrongCauseBucket: focus.issueType || focus.wrongCause || '第一步不清',
    quality: 80,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    state: 'new',
    suspended: false,
    leech: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  return [
    {
      id: `focus_cadence_next_day_${focusId}`,
      type: 'spaced_cadence_review',
      cadenceMarker: 'next_day_revisit',
      evidenceTag: 'next_day_revisit',
      front: `明天回访「${baseTitle}」：不看答案，先说第一步。`,
      backPrompt: '能说出第一步就停，不加题量。',
      due: addDaysIso(1, now),
      dueDate: addDaysIso(1, now),
      interval: 1,
      intervalLevel: 1,
      status: 'new'
    },
    {
      id: `focus_cadence_day7_${focusId}`,
      type: 'spaced_cadence_review',
      cadenceMarker: 'day7_variant',
      evidenceTag: 'day7_variant_result',
      front: `第7天小变式「${baseTitle}」：只换一个条件，看第一步能否迁移。`,
      backPrompt: '能迁移才进入画像候选，不能迁移就回小黑板。',
      due: addDaysIso(7, now),
      dueDate: addDaysIso(7, now),
      interval: 7,
      intervalLevel: 3,
      status: 'locked_until_due'
    },
    {
      id: `focus_cadence_two_week_${focusId}`,
      type: 'spaced_cadence_review',
      cadenceMarker: 'two_week_stability_check',
      evidenceTag: 'two_week_stability_check',
      front: `两周稳定检查「${baseTitle}」：同一方法是否还有效？`,
      backPrompt: '两周稳定才升级策略，不稳定就继续观察。',
      due: addDaysIso(14, now),
      dueDate: addDaysIso(14, now),
      interval: 14,
      intervalLevel: 4,
      status: 'locked_until_due'
    }
  ].map((item) => Object.assign({}, base, item, {
    noteId: `note_${item.id}`,
    question: item.front,
    answer: item.backPrompt,
    stability: 0,
    retrievability: 0,
    elapsed_days: 0
  }));
}

function ensureSpacedCadenceReviewCards(focus = {}) {
  if (!focus || !focus.id || focus.repairStatus !== 'completed' || !focus.hasMiniActionDone) return [];
  const cards = loadReviewCards();
  const nextCards = buildSpacedCadenceReviewCards(focus);
  const missing = nextCards.filter((card) => !cards.some((item) => item && item.id === card.id));
  if (!missing.length) return cards.filter((card) => card && card.sourceFocusId === focus.id && card.source === 'today_focus_cadence');
  saveReviewCards(missing.concat(cards).slice(0, 260));
  missing.forEach((card) => appendReviewEvent({
    type: 'spaced_cadence_review_card_created',
    cardId: card.id,
    sourceFocusId: focus.id,
    cadence_marker: card.cadenceMarker,
    evidence: card.evidenceTag,
    rating: 'created'
  }));
  return missing;
}

function ensureTodayFocusReviewCard(focus = {}) {
  if (!focus || !focus.id || focus.repairStatus !== 'completed' || !focus.hasMiniActionDone) return null;
  const cards = loadReviewCards();
  const existing = cards.find((card) => card && ((card.source === 'today_focus' && card.sourceFocusId === focus.id) || card.id === `focus_review_${focus.id}`));
  if (existing) {
    ensureSpacedCadenceReviewCards(focus);
    return existing;
  }
  const card = buildTodayFocusReviewCard(focus);
  saveReviewCards([card].concat(cards).slice(0, 260));
  ensureSpacedCadenceReviewCards(focus);
  appendReviewEvent({
    type: 'today_focus_review_card_created',
    cardId: card.id,
    sourceFocusId: focus.id,
    rating: 'created'
  });
  return card;
}

function ensureFirstStepNextDaySeed(focus = {}) {
  if (!focus || !focus.id || !focus.hasMiniActionDone) return null;
  const cards = loadReviewCards();
  const id = `first_step_next_day_${focus.id}`;
  const existing = cards.find((card) => card && card.id === id);
  if (existing) return existing;
  const now = new Date();
  const firstStep = focus.childArticulatedStep || focus.childStepSentence || focus.miniActionText || focus.systemSuggestedStep || '先说出第一步';
  const card = {
    id,
    noteId: `note_${id}`,
    deckId: 'ydzx-core',
    template: 'active_recall',
    type: 'first_step_next_day_seed',
    source: 'tutor_first_step',
    sourceFocusId: focus.id,
    subject: focus.subject || '',
    taskType: focus.taskType || '',
    weakPoint: focus.title || focus.issueType || '第一步回访',
    wrongCauseBucket: focus.issueType || focus.taskType || 'first_step',
    wrongCauseLabel: focus.wrongCause || focus.issueType || '第一步不稳定',
    childArticulatedStep: firstStep,
    checkpoint: firstStep,
    front: `明天只回这一张：${firstStep}`,
    question: `不看答案，先说这类题第一步：${firstStep}`,
    answer: firstStep,
    backPrompt: '能说出第一步就停，不加题量；说不出就回小黑板。',
    nextPracticePlan: {
      wrongCauseBucket: focus.issueType || focus.taskType || 'first_step',
      wrongCauseLabel: focus.wrongCause || focus.issueType || '第一步不稳定',
      checkpoint: firstStep,
      parentPrompt: '家长只问：这类题明天第一步先看哪里？',
      nextPracticeText: '明天换一题，只验证第一步能不能迁移。'
    },
    due: addDaysIso(1, now),
    dueDate: addDaysIso(1, now),
    interval: 1,
    intervalLevel: 1,
    quality: 80,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    state: 'new',
    status: 'new',
    suspended: false,
    leech: false,
    recallEvidence: {
      student_first_step: true,
      wrong_cause_named: true,
      next_day_revisit_locked: true,
      source: 'tutor_first_step'
    },
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  saveReviewCards([card].concat(cards).slice(0, 260));
  appendReviewEvent({
    type: 'first_step_next_day_seed_created',
    cardId: card.id,
    sourceFocusId: focus.id,
    taskType: focus.taskType,
    dueDate: card.dueDate
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
  const today = localDateString();
  const sessionBefore = loadRawTodaySession();
  const childStepSentence = sanitizeMiniActionText(text);
  const quality = childStepQuality(childStepSentence);
  const hasConcreteStep = quality === 'partial' || quality === 'actionable';
  const alreadyConfirmedToday = !!(
    sessionBefore
    && sessionBefore.date === today
    && childStepQuality(sessionBefore.childArticulatedStep || '') !== 'empty'
    && childStepQuality(sessionBefore.childArticulatedStep || '') !== 'vague'
  );
  if (hasConcreteStep) {
    recordLocalAnalytics('first_step_confirmed', { quality });
    if (!alreadyConfirmedToday) {
      recordDailyLearningQuestSignal({ firstStepConfirmed: true });
    }
  }
  const saved = saveTodayFocus(Object.assign({}, current, patch || {}, {
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
  if (hasConcreteStep && !patch.skipNextDaySeed) {
    ensureFirstStepNextDaySeed(saved);
  }
  return saved;
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
  if (/physics_diagram|物理|受力|电路|光路|方向|状态|研究对象/.test(text)) {
    return {
      id: 'visual_modeling',
      label: '图示建模',
      checkpoint: '先定研究对象，再画第一根方向、力或状态。',
      parentPrompt: '你先画的是哪个对象？第一根标记为什么放这里？',
      nextPracticeText: '做 1 道同类题，只画对象和第一根标记，不急着套公式。'
    };
  }
  if (/chemistry_experiment|化学|反应|物质|现象|气体|沉淀|守恒/.test(text)) {
    return {
      id: 'phenomenon_reason',
      label: '现象归因',
      checkpoint: '先列反应前后物质，再说现象来自哪里。',
      parentPrompt: '你看到的现象是颜色、气体还是沉淀？它从哪里来？',
      nextPracticeText: '做 1 道同类题，只说物质和现象来源。'
    };
  }
  if (/biology_process|生物|结构|功能|过程|对照组/.test(text)) {
    return {
      id: 'structure_process',
      label: '结构过程',
      checkpoint: '先把结构和功能连起来，再排过程顺序。',
      parentPrompt: '这个结构有什么用？这一步前后分别是什么？',
      nextPracticeText: '做 1 道同类题，只连一个结构和一个功能。'
    };
  }
  if (/geography_map|地理|地图|图例|区域|原因链|方向/.test(text)) {
    return {
      id: 'map_cause_chain',
      label: '读图因果',
      checkpoint: '先看方向、图例和位置，再说第一条原因链。',
      parentPrompt: '你先在图上定位哪里？第一条原因是什么？',
      nextPracticeText: '换一张图，只做定位和一句原因。'
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
      transferPracticeSet: buildTransferPracticeSet({
        taskType,
        childArticulatedStep: step,
        wrongCauseBucket: wrongCause.id,
        wrongCauseLabel: wrongCause.label,
        stuckPointText: session.stuckPointText || ''
      }),
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
  const current = loadRawTodaySession();
  if (!current || current.date === session.date) {
    saveTodaySession({
      reviewCardGenerated: true,
      reviewCardId: card.id
    }, {
      now: new Date(`${session.date}T00:00:00`),
      skipCreate: true
    });
  }
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
  const completedFocusRound = completionType === 'completed' || completionType === 'manual_done';
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
  if (completedFocusRound) {
    recordDailyLearningQuestSignal({ focusRoundCompleted: true }, { now: record.now || new Date() });
  }
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

function buildSpacedReviewEvidenceLedger(options = {}) {
  const cards = Array.isArray(options.reviewCards) ? options.reviewCards : loadReviewCards();
  const events = Array.isArray(options.reviewEvents) ? options.reviewEvents : loadReviewEvents();
  const markerOf = (item = {}) => item.cadenceMarker || item.cadence_marker || item.evidenceTag || item.evidence_tag || item.type || item.event || '';
  const hasMarker = (marker) => cards.some((card) => markerOf(card) === marker)
    || events.some((event) => markerOf(event) === marker || event.evidence === marker || event.releaseEvidence === marker);
  const nextDayEvents = events.filter((event) => markerOf(event) === 'next_day_revisit' || event.evidence === 'next_day_revisit');
  const day7Ready = hasMarker('day7_variant') || events.some((event) => event.day7VariantStatus === 'passed' || event.transfer_result === 'passed');
  const twoWeekReady = hasMarker('two_week_stability_check') || events.some((event) => event.twoWeekStabilityStatus === 'stable' || event.method_transfer_success === true);
  const wrongCauseBuckets = {};
  cards.concat(events).forEach((item) => {
    const key = item.wrongCauseBucket || item.wrongCause || item.issueType || item.weakPoint || '';
    if (!key) return;
    wrongCauseBuckets[key] = (wrongCauseBuckets[key] || 0) + 1;
  });
  const sameWrongCauseRecurrence = Object.keys(wrongCauseBuckets).reduce((max, key) => Math.max(max, wrongCauseBuckets[key]), 0);
  const rows = [
    {
      id: 'next_day_revisit',
      label: '明天回访',
      status: nextDayEvents.length || hasMarker('next_day_revisit') ? 'ready' : 'missing',
      evidence: 'next_day_revisit',
      blockedReason: nextDayEvents.length || hasMarker('next_day_revisit') ? '' : '还没有隔天回访证据'
    },
    {
      id: 'day7_variant',
      label: '第7天小变式',
      status: day7Ready ? 'ready' : 'locked',
      evidence: 'day7_variant_result',
      blockedReason: day7Ready ? '' : '没有第7天迁移证据，不写长期画像'
    },
    {
      id: 'two_week_stability_check',
      label: '两周稳定',
      status: twoWeekReady ? 'ready' : 'locked',
      evidence: 'two_week_stability_check',
      blockedReason: twoWeekReady ? '' : '没有两周稳定证据，不升级学习策略'
    }
  ];
  return {
    id: 'spaced_review_evidence_ledger',
    title: '间隔复习证据账本',
    evidenceWindow: 'tonight_next_day_day7_two_week',
    rows,
    evidence: {
      nextDayRevisitCount: Math.max(nextDayEvents.length, hasMarker('next_day_revisit') ? 1 : 0),
      day7VariantReady: day7Ready,
      twoWeekStabilityReady: twoWeekReady,
      sameWrongCauseRecurrence,
      next_day_revisit_status: rows[0].status === 'ready' ? 'passed' : 'missing',
      day7_variant_status: rows[1].status === 'ready' ? 'passed' : 'locked',
      two_week_stability_status: rows[2].status === 'ready' ? 'stable' : 'locked'
    },
    releaseGate: day7Ready && twoWeekReady ? 'portrait_candidate' : hasMarker('next_day_revisit') ? 'tonight_action_only' : 'collect_more_evidence',
    blockedReason: rows.filter((row) => row.status !== 'ready').map((row) => row.blockedReason).filter(Boolean).join(' / '),
    localRule: '本地复习事件决定 day7/two-week 放行；AI 只改写回访提示。'
  };
}

function recordAnswerBoundaryEvidence(evidence = {}, context = {}) {
  if (!evidence || evidence.eventType !== 'answer_request_blocked') return null;
  const now = new Date().toISOString();
  const reviewSeed = evidence.reviewSeed || {};
  const card = {
    id: `answer_boundary_review_${Date.now()}_${randomPart()}`,
    source: 'tutor_answer_boundary',
    title: reviewSeed.title || '先不拿答案，复查第一步',
    prompt: reviewSeed.prompt || evidence.firstStepRequired || '先说第一步',
    wrongCause: reviewSeed.wrongCause || evidence.wrongCauseBucket || '直接要答案',
    revisit: reviewSeed.revisit || evidence.nextRevisitWindow || '明天复查第一步',
    due: reviewSeed.due !== false,
    dueWindow: reviewSeed.dueWindow || evidence.nextRevisitWindow || '明天 5 分钟',
    taskType: evidence.taskType || '',
    sampleId: evidence.sampleId || '',
    parentLine: evidence.parentLine || '',
    shareBoundary: evidence.shareBoundary || '',
    created_at: now
  };
  const cards = [card].concat(loadReviewCards()).slice(0, 120);
  set(KEYS.reviewCards, cards);
  const event = {
    type: 'answer_boundary_review_seeded',
    source: 'tutor',
    evidenceId: evidence.id || '',
    cardId: card.id,
    taskType: evidence.taskType || '',
    firstStepRequired: evidence.firstStepRequired || '',
    wrongCauseBucket: evidence.wrongCauseBucket || '',
    nextRoute: evidence.nextRoute || '/pages/review/review?from=answer_boundary',
    selected_id: context.selected_id || '',
    selected_text: context.selected_text || '',
    created_at: now
  };
  appendReviewEvent(event);
  appendSyncMutation('answer_boundary_evidence', {
    id: evidence.id || card.id,
    card_id: card.id,
    task_type: evidence.taskType || '',
    first_step_required: evidence.firstStepRequired || '',
    wrong_cause_bucket: evidence.wrongCauseBucket || '',
    next_revisit_window: evidence.nextRevisitWindow || '',
    share_boundary: evidence.shareBoundary || '',
    created_at: now
  });
  return { card, event };
}

function ensureMiniLessonReturnReviewCard(seed = {}, context = {}) {
  if (!seed || typeof seed !== 'object') return null;
  const now = new Date();
  const sourceSeedId = seed.id || seed.eventId || seed.turnId || context.turnId || '';
  const flowTraceId = seed.flowTraceId || context.flowTraceId || '';
  const stableKey = flowTraceId || sourceSeedId || seed.cardId || seed.topicLabel || seed.conceptGap || `mini_lesson_${now.getTime()}_${randomPart()}`;
  const safeKey = String(stableKey).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 72) || `${now.getTime()}_${randomPart()}`;
  const cardId = seed.reviewCardId || `mini_lesson_return_${safeKey}`;
  const cards = loadReviewCards();
  const existing = cards.find((card) => card && (
    card.id === cardId
    || (flowTraceId && card.flowTraceId === flowTraceId && card.source === 'three_minute_mini_lesson')
    || (sourceSeedId && card.sourceSeedId === sourceSeedId && card.source === 'three_minute_mini_lesson')
  ));
  if (existing) return existing;

  const firstStep = seed.firstStep
    || seed.blackboardLine
    || seed.firstStepRequired
    || (seed.reviewSeed && seed.reviewSeed.prompt)
    || context.firstStep
    || '先说出这类题的第一步，不看完整答案';
  const conceptGap = seed.conceptGap
    || seed.wrongCause
    || seed.wrongCauseBucket
    || context.conceptGap
    || '第一步还没有稳定说清楚';
  const nextDayReview = seed.nextDayReview
    || seed.revisit
    || seed.dueWindow
    || (seed.reviewReturnSeed && seed.reviewReturnSeed.revisit)
    || '明天换一题，只复述第一步和错因';
  const parentLine = seed.parentCheck
    || seed.parentLine
    || context.parentLine
    || '家长只问：这题第一步先看什么？不要追完整答案。';
  const miniLessonDefaultBlockedFields = ['original_question', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'talent_label', 'child_name', 'parent_phone', 'parent_wechat', 'contact_info'];
  const blockedFields = Array.from(new Set(miniLessonDefaultBlockedFields.concat(
    Array.isArray(seed.blockedFields) ? seed.blockedFields : []
  )));
  const evidenceThread = seed.evidenceThread && typeof seed.evidenceThread === 'object'
    ? seed.evidenceThread
    : {
      id: `evidence_thread_${safeKey}`,
      sourceSchemaId: seed.sourceSchemaId || seed.topicCardId || seed.taskType || 'three_minute_mini_lesson',
      flowTraceId,
      taskType: seed.taskType || context.taskType || seed.topicLabel || '',
      subject: seed.subject || context.subject || '',
      topicCardId: seed.topicCardId || seed.sourceSchemaId || '',
      topicLabel: seed.topicLabel || '',
      firstStep,
      wrongCause: conceptGap,
      parentCheck: parentLine,
      nextDayReview,
      day7Gate: seed.day7Gate || 'day7_variant_first_step_evidence',
      releaseGates: ['child_can_say_first_step', 'wrong_cause_named', 'next_day_revisit_locked', seed.day7Gate || 'day7_variant_first_step_evidence'],
      routes: {
        tutor: '/pages/tutor/tutor',
        review: '/pages/review/review',
        arcade: '/pages/arcade/arcade',
        profile: '/pages/profile/profile'
      },
      blockedFields
    };
  const dueDate = seed.dueAt || seed.dueDate || addDaysIso(1, now);
  const card = {
    id: cardId,
    noteId: `note_${cardId}`,
    deckId: 'ydzx-core',
    template: 'active_recall',
    type: 'three_minute_mini_lesson_return',
    source: 'three_minute_mini_lesson',
    sourceSeedId,
    flowTraceId,
    subject: seed.subject || context.subject || '',
    taskType: seed.taskType || context.taskType || seed.topicLabel || '',
    title: seed.title || '3 分钟小讲堂回访卡',
    prompt: firstStep,
    front: `明天只回访第一步：${firstStep}`,
    question: seed.checkQuestion || `不看答案，说出第一步：${firstStep}`,
    answer: firstStep,
    backPrompt: parentLine,
    wrongCause: conceptGap,
    wrongCauseBucket: conceptGap,
    weakPoint: seed.topicLabel || conceptGap,
    revisit: nextDayReview,
    nextPracticePlan: {
      wrongCauseBucket: conceptGap,
      wrongCauseLabel: conceptGap,
      checkpoint: firstStep,
      parentPrompt: parentLine,
      nextPracticeText: nextDayReview
    },
    blackboardLine: seed.blackboardLine || firstStep,
    blackboardFrames: Array.isArray(seed.blackboardFrames) ? seed.blackboardFrames : [],
    exitGate: seed.exitGate || 'child_can_say_first_step',
    evidenceThread,
    blockedFields,
    due: dueDate,
    dueDate,
    interval: 1,
    intervalLevel: 1,
    state: 'new',
    status: 'new',
    suspended: false,
    recallEvidence: {
      student_first_step: false,
      wrong_cause_named: false,
      next_day_revisit_locked: true,
      source: 'three_minute_mini_lesson'
    },
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  saveReviewCards([card].concat(cards).slice(0, 260));
  const event = {
    type: 'three_minute_mini_lesson_review_card_created',
    source: seed.source || context.source || 'three_minute_mini_lesson',
    cardId: card.id,
    sourceSeedId,
    flowTraceId,
    conceptGap,
    firstStep,
    nextDayReview,
    exitGate: card.exitGate,
    blockedFields,
    evidenceThread,
    route: seed.route || '/pages/review/review?from=mini_lesson_return_card',
    created_at: now.toISOString()
  };
  appendReviewEvent(event);
  appendSyncMutation('three_minute_mini_lesson_review_card', {
    id: card.id,
    source_seed_id: sourceSeedId,
    flow_trace_id: flowTraceId,
    evidence_thread_id: evidenceThread.id || '',
    source_schema_id: evidenceThread.sourceSchemaId || '',
    topic_card_id: evidenceThread.topicCardId || '',
    concept_gap: conceptGap,
    first_step: firstStep,
    next_day_review: nextDayReview,
    blocked_fields: blockedFields.join(','),
    created_at: event.created_at
  });
  return card;
}

function setActiveMiniLessonResumeContext(input = {}) {
  const now = new Date();
  const context = {
    from: input.from || 'home_mini_lesson_resume',
    type: 'three_minute_mini_lesson_return',
    cardId: input.cardId || input.id || '',
    flowTraceId: input.flowTraceId || '',
    evidenceThreadId: input.evidenceThreadId || (input.evidenceThread && input.evidenceThread.id) || '',
    topicCardId: input.topicCardId || (input.evidenceThread && input.evidenceThread.topicCardId) || '',
    sourceSchemaId: input.sourceSchemaId || 'three_minute_mini_lesson',
    route: input.route || '/pages/review/review?from=home_mini_lesson_resume',
    blockedFields: Array.isArray(input.blockedFields) ? input.blockedFields : [],
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 20 * 60 * 1000).toISOString()
  };
  set(KEYS.activeMiniLessonResumeContext, context);
  return context;
}

function loadActiveMiniLessonResumeContext() {
  const context = get(KEYS.activeMiniLessonResumeContext, null);
  if (!context || !context.expiresAt) return context;
  if (Date.parse(context.expiresAt) < Date.now()) {
    remove(KEYS.activeMiniLessonResumeContext);
    return null;
  }
  return context;
}

function clearActiveMiniLessonResumeContext() {
  remove(KEYS.activeMiniLessonResumeContext);
}

function buildMiniLessonParentAssistCard(input = {}, event = {}, card = null) {
  const evidenceThread = input.evidenceThread && typeof input.evidenceThread === 'object'
    ? input.evidenceThread
    : {};
  const parentCheck = input.parentCheck
    || input.parentLine
    || evidenceThread.parentCheck
    || (card && (card.parentCheck || card.parentPrompt))
    || '家长只问：这题第一步先看哪里？';
  const firstStep = input.firstStep
    || evidenceThread.firstStep
    || (card && card.firstStep)
    || '先说出第一步';
  const nextDayReview = input.nextDayReview
    || input.revisit
    || evidenceThread.nextDayReview
    || (card && (card.nextReview || card.revisit))
    || '明天只回访同一个第一步。';
  return {
    id: `parent_assist_${event.flowTraceId || event.cardId || Date.now()}`,
    type: 'parent_handoff_required',
    title: '家长协助卡',
    status: 'needs_support',
    cardId: event.cardId || (card && card.id) || '',
    flowTraceId: event.flowTraceId || '',
    topicCardId: event.topicCardId || '',
    firstStep,
    parentCheck,
    cannotAnswerFallback: '孩子说不出来时，不讲完整答案，只让他圈一个条件、读一句题干或指出图上的一个对象。',
    stopRule: '今晚不加题、不讲整套过程、不比较分数；只拿到一句孩子自己的第一步。',
    nextDayReview,
    route: '/pages/profile/profile?from=mini_lesson_parent_assist',
    reviewRoute: '/pages/review/review?from=mini_lesson_parent_assist',
    blockedFields: event.blockedFields || ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label'],
    allowedFields: ['first_step', 'parent_check', 'cannot_answer_fallback', 'next_day_review']
  };
}

function recordMiniLessonExitGate(input = {}, context = {}) {
  const now = new Date();
  const childExitTicketText = String(input.childExitTicketText || input.receiverFirstStep || input.childFirstStep || '').trim();
  const evidenceThread = input.evidenceThread && typeof input.evidenceThread === 'object'
    ? input.evidenceThread
    : {};
  const exitTicketQuality = childStepQuality(childExitTicketText);
  const hasChildExitTicket = childExitTicketText.length >= 4
    && !/答案|直接|代写|帮我写|带我|提示|讲一下|不会|不懂|不知道/.test(childExitTicketText)
    && ['partial', 'actionable'].includes(exitTicketQuality);
  const alignmentSource = [
    input.firstStep,
    input.firstStepEvidence,
    evidenceThread.firstStep,
    evidenceThread.wrongCause,
    evidenceThread.parentCheck,
    evidenceThread.topicLabel,
    evidenceThread.topicCardId
  ].concat((Array.isArray(input.blackboardFrames) ? input.blackboardFrames : []).reduce((acc, frame) => acc.concat([
    frame.draw,
    frame.say,
    frame.evidence,
    frame.localGate
  ]), [])).join(' ');
  const alignmentTokens = String(alignmentSource || '')
    .split(/[\s，。；、：:,.!?/|\->]+/)
    .map((item) => item.trim())
    .filter((item) => item && item.length >= 2 && !/child|first|step|gate|frame|board|evidence|local|topic|card/.test(item))
    .slice(0, 24);
  const alignedWithFirstStep = !alignmentTokens.length
    || alignmentTokens.some((token) => childExitTicketText.indexOf(token) >= 0)
    || /先|第一步|圈|找|看|写|列|读|标|画/.test(childExitTicketText);
  const status = input.status === 'passed' && hasChildExitTicket && alignedWithFirstStep ? 'passed' : 'needs_support';
  const topicCardId = input.topicCardId || evidenceThread.topicCardId || '';
  const flowTraceId = input.flowTraceId || evidenceThread.flowTraceId || context.flowTraceId || '';
  const firstStepEvidence = status === 'passed'
    ? (childExitTicketText || input.firstStepEvidence || input.firstStep || '')
    : '';
  const miniLessonDefaultBlockedFields = ['original_question', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'talent_label'];
  const blockedFields = Array.from(new Set(miniLessonDefaultBlockedFields.concat(
    Array.isArray(evidenceThread.blockedFields) ? evidenceThread.blockedFields : [],
    Array.isArray(input.blockedFields) ? input.blockedFields : []
  )));
  const nextRoute = status === 'passed'
    ? (input.passRoute || '/pages/review/review?from=mini_lesson_exit_passed')
    : (input.failRoute || '/pages/tutor/tutor?from=mini_lesson_exit_needs_support');
  const card = ensureMiniLessonReturnReviewCard(Object.assign({}, input, {
    flowTraceId,
    topicCardId,
    firstStep: firstStepEvidence,
    evidenceThread,
    blockedFields,
    route: nextRoute,
    status: status === 'passed' ? 'exit_gate_passed' : 'exit_gate_needs_support'
  }), Object.assign({}, context, {
    source: input.source || context.source || 'mini_lesson_exit_gate'
  }));
  const event = {
    type: 'mini_lesson_exit_gate_recorded',
    source: input.source || context.source || 'mini_lesson_exit_gate',
    status,
    turnId: input.turnId || context.turnId || '',
    cardId: card && card.id ? card.id : '',
    flowTraceId,
    evidenceThreadId: evidenceThread.id || '',
    topicCardId,
    firstStepEvidence,
    childExitTicketText,
    exitTicketQuality,
    alignedWithFirstStep,
    childAuthoredEvidence: status === 'passed',
    exitGate: input.exitGate || 'child_can_say_first_step',
    nextRoute,
    blockedFields,
    created_at: now.toISOString()
  };
  appendReviewEvent(event);
  appendSyncMutation('mini_lesson_exit_gate', {
    status,
    card_id: event.cardId,
    flow_trace_id: flowTraceId,
    evidence_thread_id: event.evidenceThreadId,
    topic_card_id: topicCardId,
    first_step_evidence: firstStepEvidence,
    child_exit_ticket_text: childExitTicketText,
    exit_ticket_quality: exitTicketQuality,
    aligned_with_first_step: alignedWithFirstStep,
    child_authored_evidence: status === 'passed',
    next_route: nextRoute,
    blocked_fields: blockedFields.join(','),
    created_at: event.created_at
  });
  let parentAssistCard = null;
  if (status !== 'passed') {
    parentAssistCard = buildMiniLessonParentAssistCard(input, event, card);
    appendReviewEvent(Object.assign({}, parentAssistCard, {
      event: 'parent_handoff_required',
      source: input.source || context.source || 'mini_lesson_exit_gate',
      created_at: event.created_at
    }));
    appendSyncMutation('parent_handoff_required', {
      id: parentAssistCard.id,
      card_id: parentAssistCard.cardId,
      flow_trace_id: parentAssistCard.flowTraceId,
      topic_card_id: parentAssistCard.topicCardId,
      parent_check: parentAssistCard.parentCheck,
      next_day_review: parentAssistCard.nextDayReview,
      route: parentAssistCard.route,
      review_route: parentAssistCard.reviewRoute,
      blocked_fields: parentAssistCard.blockedFields.join(','),
      created_at: event.created_at
    });
  }
  if (card && card.id) {
    const cards = loadReviewCards();
    const updated = cards.map((item) => {
      if (!item || item.id !== card.id) return item;
      return Object.assign({}, item, {
        status: status === 'passed' ? 'exit_gate_passed' : 'exit_gate_needs_support',
        recallEvidence: Object.assign({}, item.recallEvidence || {}, {
          student_first_step: status === 'passed',
          mini_lesson_exit_gate: status,
          first_step_evidence: firstStepEvidence,
          child_exit_ticket_text: childExitTicketText,
          exit_ticket_quality: exitTicketQuality,
          aligned_with_first_step: alignedWithFirstStep,
          child_authored_evidence: status === 'passed'
        }),
        updated_at: event.created_at
      });
    });
    saveReviewCards(updated);
  }
  return { event, card, parentAssistCard, nextRoute, status };
}

function recordMiniLessonReviewResult(input = {}, context = {}) {
  const now = new Date();
  const cardId = input.cardId || (input.card && input.card.id) || '';
  if (!cardId) return null;
  const rating = ['again', 'hard', 'good', 'easy'].includes(input.rating) ? input.rating : 'good';
  const passed = rating === 'good' || rating === 'easy';
  const cards = loadReviewCards();
  let updatedCard = null;
  const next = cards.map((card) => {
    if (!card || card.id !== cardId) return card;
    const evidenceThread = input.evidenceThread && typeof input.evidenceThread === 'object'
      ? input.evidenceThread
      : card.evidenceThread && typeof card.evidenceThread === 'object'
        ? card.evidenceThread
        : {};
    const completedGates = Array.from(new Set([].concat(
      Array.isArray(evidenceThread.completedGates) ? evidenceThread.completedGates : [],
      passed ? ['child_can_say_first_step', 'next_day_revisit_completed'] : ['next_day_revisit_attempted']
    )));
    const nextEvidenceThread = Object.assign({}, evidenceThread, {
      completedGates,
      latestReviewRating: rating,
      latestReviewAt: now.toISOString(),
      day7GateStatus: passed ? 'pending_day7_variant' : 'needs_parent_support_before_day7'
    });
    updatedCard = Object.assign({}, card, {
      isRevisited: true,
      miniLessonReviewResult: {
        rating,
        passed,
        reviewEvidence: passed ? 'child_recalled_first_step' : 'child_still_needs_support',
        day7GateStatus: nextEvidenceThread.day7GateStatus,
        recordedAt: now.toISOString()
      },
      recallEvidence: Object.assign({}, card.recallEvidence || {}, {
        student_first_step: passed || !!((card.recallEvidence || {}).student_first_step),
        wrong_cause_named: passed || !!((card.recallEvidence || {}).wrong_cause_named),
        next_day_revisit_completed: passed,
        next_day_revisit_attempted: true,
        day7_variant_pending: passed,
        mini_lesson_review_rating: rating
      }),
      evidenceThread: nextEvidenceThread,
      updated_at: now.toISOString()
    });
    return updatedCard;
  });
  if (!updatedCard) return null;
  saveReviewCards(next);
  const event = {
    type: 'mini_lesson_review_result_recorded',
    source: input.source || context.source || 'review_mini_lesson_return',
    cardId,
    rating,
    passed,
    flowTraceId: updatedCard.flowTraceId || (updatedCard.evidenceThread && updatedCard.evidenceThread.flowTraceId) || '',
    evidenceThreadId: updatedCard.evidenceThread && updatedCard.evidenceThread.id ? updatedCard.evidenceThread.id : '',
    topicCardId: updatedCard.evidenceThread && updatedCard.evidenceThread.topicCardId ? updatedCard.evidenceThread.topicCardId : '',
    completedGates: updatedCard.evidenceThread && Array.isArray(updatedCard.evidenceThread.completedGates)
      ? updatedCard.evidenceThread.completedGates
      : [],
    day7GateStatus: updatedCard.evidenceThread ? updatedCard.evidenceThread.day7GateStatus : '',
    blockedFields: Array.isArray(updatedCard.blockedFields) ? updatedCard.blockedFields : ['original_question', 'full_answer', 'score', 'ranking', 'talent_label'],
    created_at: now.toISOString()
  };
  appendReviewEvent(event);
  appendSyncMutation('mini_lesson_review_result', {
    card_id: cardId,
    rating,
    passed,
    flow_trace_id: event.flowTraceId,
    evidence_thread_id: event.evidenceThreadId,
    topic_card_id: event.topicCardId,
    completed_gates: event.completedGates.join(','),
    day7_gate_status: event.day7GateStatus,
    blocked_fields: event.blockedFields.join(','),
    created_at: event.created_at
  });
  return { event, card: updatedCard, passed, rating };
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

function recordDailyLearningQuestSignal(signal = {}, options = {}) {
  const current = loadGameProfile();
  const nowInput = options.now || new Date();
  const today = localDateString(nowInput);
  const sameLearningDay = current.last_learning_day === today;
  const firstStepBase = sameLearningDay
    ? Number(current.first_step_count || current.firstStepCount || 0)
    : 0;
  const focusRoundBase = sameLearningDay
    ? Number(current.focus_rounds_today || current.focusRoundsToday || 0)
    : 0;
  const firstStepDelta = signal.firstStepConfirmed ? 1 : 0;
  const focusRoundDelta = signal.focusRoundCompleted ? 1 : 0;
  if (!firstStepDelta && !focusRoundDelta) return current;
  const saved = saveGameProfile({
    first_step_count: firstStepBase + firstStepDelta,
    firstStepCount: firstStepBase + firstStepDelta,
    focus_rounds_today: focusRoundBase + focusRoundDelta,
    focusRoundsToday: focusRoundBase + focusRoundDelta,
    last_learning_day: today
  });
  appendSyncMutation('daily_learning_quest_signal', {
    id: `daily_learning_quest_${today}`,
    date: today,
    first_step_count: Number(saved.first_step_count || 0),
    focus_rounds_today: Number(saved.focus_rounds_today || 0),
    first_step_confirmed: !!signal.firstStepConfirmed,
    focus_round_completed: !!signal.focusRoundCompleted,
    created_at: new Date().toISOString()
  });
  return saved;
}

function normalizeXpEvidenceGate(evidence = {}) {
  const safe = evidence && typeof evidence === 'object' ? evidence : {};
  const hasFirstStep = !!(safe.student_first_step || safe.first_step_recall || safe.child_first_step || safe.childArticulatedStep);
  const hasWrongCause = !!(safe.wrong_cause_named || safe.wrong_cause_replay || safe.wrongCauseLabel || safe.wrongCause);
  const hasRevisit = !!(safe.next_day_revisit_locked || safe.next_day_revisit || safe.revisit_locked || safe.revisitWindow);
  const pass = !!safe.allowEvidenceGateBypass || (hasFirstStep && hasWrongCause && hasRevisit);
  return {
    pass,
    hasFirstStep,
    hasWrongCause,
    hasRevisit,
    reason: pass ? 'evidence_ready' : 'first_step_wrong_cause_revisit_required'
  };
}

function addGameXP(amount, reason = '', evidence = {}) {
  const current = loadGameProfile();
  const today = new Date().toISOString().slice(0, 10);
  const daily = Object.assign({}, current.daily_xp || {});
  const delta = Math.max(0, Number(amount || 0));
  const gate = normalizeXpEvidenceGate(evidence);
  if (delta > 0 && !gate.pass) {
    appendReviewEvent({
      kind: 'game_xp_blocked_by_evidence_gate',
      reason,
      requested_xp: delta,
      xp: 0,
      gate
    });
    return { profile: current, accepted: 0, capped: false, blocked: true, gate };
  }
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
      evidence_gate: gate,
      daily_total: daily[today],
      created_at: new Date().toISOString()
    });
  }
  return { profile: saved, accepted, capped: accepted < delta, gate };
}

function buildGameSessionXpEvidence(result = {}, context = {}) {
  const recallEvidence = Array.isArray(result.recallEvidence) ? result.recallEvidence : [];
  const recallHasFirstStep = recallEvidence.some((item) => item && (item.student_first_step || item.first_step_recall || item.child_first_step));
  const recallHasWrongCause = recallEvidence.some((item) => item && (item.wrong_cause_named || item.wrong_cause_replay || item.wrongCauseLabel || item.wrongCause));
  const recallHasRevisit = recallEvidence.some((item) => item && (item.next_day_revisit_locked || item.next_day_revisit || item.revisit_locked || item.revisitWindow));
  return {
    student_first_step: recallHasFirstStep || !!(result.firstStep || result.childFirstStep || context.firstStep),
    wrong_cause_named: recallHasWrongCause || !!(result.wrongCause || result.wrongCauseLabel || context.wrongCause || context.weakKey),
    next_day_revisit_locked: recallHasRevisit || !!(result.nextDayReturnEvidence || result.nextDayRevisit || context.nextDayReturnEvidence)
  };
}

function buildGameSessionReportRevisitEvidence(result = {}, context = {}) {
  const recallEvidence = Array.isArray(result.recallEvidence) ? result.recallEvidence : [];
  const first = recallEvidence.find((item) => item && (item.child_first_step || item.childFirstStep || item.student_first_step || item.first_step_recall)) || {};
  const wrong = recallEvidence.find((item) => item && (item.wrongCause || item.wrongCauseLabel || item.wrong_cause_named || item.wrong_cause_replay)) || {};
  return {
    status: 'active_recall_completed',
    nextDayRevisit: true,
    firstStep: first.child_first_step || first.childFirstStep || result.childFirstStep || result.firstStep || context.firstStep || '孩子已完成一次主动回忆第一步',
    wrongCause: wrong.wrongCause || wrong.wrongCauseLabel || result.wrongCause || result.wrongCauseLabel || context.wrongCause || context.weakKey || '主动回忆中已回到错因',
    parentCheck: result.parentCheck || context.parentCheck || '家长只问第一步，不追完整答案。',
    route: context.route || result.route || '/pages/arcade/arcade',
    source: context.gameType || result.gameType || 'arcade'
  };
}

function loadCourseUnitProgress() {
  const list = get(KEYS.courseUnitProgress, []);
  return Array.isArray(list) ? list : [];
}

function recordCourseUnitProgress(progress = {}) {
  const firstStep = String(progress.firstStep || progress.childFirstStep || '').trim();
  const wrongCause = String(progress.wrongCause || progress.wrongCauseLabel || '').trim();
  const nextDayRevisit = String(progress.nextDayRevisit || progress.revisitWindow || '').trim();
  const nearTransfer = String(progress.nearTransfer || progress.nearTransferEvidence || '').trim();
  const evidenceReady = !!(firstStep && wrongCause && nextDayRevisit);
  const status = progress.status || (evidenceReady && nearTransfer ? 'mastery_gate_ready' : evidenceReady ? 'needs_near_transfer' : 'needs_next_revisit');
  const entry = {
    id: progress.id || `course_progress_${Date.now()}`,
    cardId: progress.cardId || '',
    unitId: progress.unitId || '',
    source: progress.source || 'arcade_finish_round',
    firstStep,
    wrongCause,
    nextDayRevisit,
    nearTransfer,
    status,
    evidenceReady,
    blockedFields: ['original_question', 'full_answer', 'score', 'ranking'],
    created_at: new Date().toISOString()
  };
  const next = [entry].concat(loadCourseUnitProgress()).slice(0, 120);
  set(KEYS.courseUnitProgress, next);
  appendSyncMutation('course_unit_progress', entry);
  return entry;
}

function recordGameSessionResult(result = {}, context = {}) {
  const current = loadGameProfile();
  const total = Number(result.total || 0);
  const correct = Number(result.correct || 0);
  const accuracy = Number(result.accuracy || 0);
  const reviewedToday = Math.max(1, total || correct || 1);
  const nowInput = context.now || new Date();
  const today = localDateString(nowInput);
  const sameGameDay = current.last_game_day === today;
  const previousReviewedToday = sameGameDay
    ? Number(current.reviewed_today || current.reviewedToday || 0)
    : 0;
  const previousCorrectToday = sameGameDay
    ? Number(current.correct_today || current.correctToday || 0)
    : 0;
  const previousEvidenceReturnToday = sameGameDay
    ? Number(current.evidence_return_count || current.evidenceReturnCount || 0)
    : 0;
  const nextReviewedToday = previousReviewedToday + reviewedToday;
  const nextCorrectToday = previousCorrectToday + Math.max(0, correct);
  const xpEvidence = buildGameSessionXpEvidence(result, context);
  const evidenceGate = normalizeXpEvidenceGate(xpEvidence);
  const activeRecallEvidenceComplete = evidenceGate.pass;
  const nextEvidenceReturnToday = previousEvidenceReturnToday + (activeRecallEvidenceComplete ? 1 : 0);
  const streakEligible = activeRecallEvidenceComplete;
  const streaked = streakEligible ? gameLogic.updateStreak(current, {
    reviewedToday: Math.max(1, reviewedToday),
    threshold: 1,
    now: nowInput
  }) : current;
  const recentQuiz = (Array.isArray(streaked.recent_quiz_accuracy) ? streaked.recent_quiz_accuracy : [])
    .concat([accuracy])
    .slice(-7);
  const stats = Object.assign({}, streaked, {
    review_count: Number(streaked.review_count || 0) + reviewedToday,
    correct_count: Number(streaked.correct_count || 0) + correct,
    reviewed_today: nextReviewedToday,
    correct_today: nextCorrectToday,
    evidence_return_count: nextEvidenceReturnToday,
    reviewedToday: nextReviewedToday,
    correctToday: nextCorrectToday,
    evidenceReturnCount: nextEvidenceReturnToday,
    last_game_day: today,
    recent_quiz_accuracy: recentQuiz,
    achievements: streaked.achievements || []
  });
  const achievementResult = gameLogic.checkAndUnlockAchievements(stats);
  const saved = saveGameProfile(Object.assign({}, stats, {
    achievements: achievementResult.achievements,
    coins: Number(stats.coins || 0) + Number(achievementResult.coinsAwarded || 0)
  }));
  const requestedXp = Math.max(0, Number(result.xp || result.pendingXp || 0));
  const xpRelease = requestedXp > 0
    ? addGameXP(requestedXp, context.xpReason || `game_session_${context.gameType || result.gameType || 'arcade'}`, xpEvidence)
    : { profile: saved, accepted: 0, gate: normalizeXpEvidenceGate(xpEvidence), blocked: false };
  let reportRevisitEvidence = null;
  const reportState = loadLearningReportState();
  const reportId = context.reportId
    || result.reportId
    || reportState.reportId
    || (reportState.reportDraft && reportState.reportDraft.id)
    || '';
  if (activeRecallEvidenceComplete && reportId) {
    reportRevisitEvidence = recordReportRevisitEvidence(reportId, buildGameSessionReportRevisitEvidence(result, context));
  }
  appendSyncMutation('game_session_result', {
    id: `game_session_${today}_${String(context.gameType || result.gameType || 'arcade')}`,
    game_type: context.gameType || result.gameType || 'arcade',
    total,
    correct,
    accuracy,
    reviewed_today: nextReviewedToday,
    correct_today: nextCorrectToday,
    evidence_return_count: nextEvidenceReturnToday,
    active_recall_evidence_complete: activeRecallEvidenceComplete,
    streak_eligible: streakEligible,
    pending_xp: requestedXp,
    released_xp: xpRelease.accepted || 0,
    report_revisit_linked: !!reportRevisitEvidence,
    xp_release_blocked: !!xpRelease.blocked,
    xp_release_gate: xpRelease.gate,
    streak: Number(saved.streak || 0),
    achievements: saved.achievements || [],
    newly_unlocked: achievementResult.newlyUnlocked.map((item) => item.id),
    created_at: new Date().toISOString()
  });
  return {
    profile: xpRelease && xpRelease.profile ? xpRelease.profile : saved,
    newlyUnlocked: achievementResult.newlyUnlocked,
    coinsAwarded: achievementResult.coinsAwarded,
    pendingXp: requestedXp,
    reportRevisitEvidence,
    xpRelease
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

function parentNextActionLabel(action = '') {
  if (action === 'wrong_cause_revisit') return '明天先回看这张错因卡';
  if (action === 'due_card_revisit') return '明天先清一张待回访卡';
  if (action === 'first_step_revisit') return '明天继续说出第一步';
  return '先用自己的材料完成一组轻回访';
}

function parentNextActionDetail(action = '') {
  if (action === 'wrong_cause_revisit') return '先让孩子说出这张错因卡的第一步，再做一道同类小题。';
  if (action === 'due_card_revisit') return '先回忆再核对，忘了就回到第一步提示卡。';
  if (action === 'first_step_revisit') return '家长只问一句，不接管答案：你第一步先看哪里？';
  return '用自己的作业或错题生成一张卡，再完成一次 5 分钟轻回访。';
}

const SHARE_RELAY_ALLOWED_FIELDS = [
  'share_code',
  'relay_id',
  'receiver_material',
  'first_step',
  'wrong_cause',
  'receiver_action',
  'parent_check',
  'next_revisit',
  'review_evidence',
  'event_evidence',
  'sync_evidence'
];

const SHARE_RELAY_BLOCKED_FIELDS = [
  'original_question',
  'original_answer',
  'full_answer',
  'photo',
  'original_photo',
  'full_dialogue',
  'score',
  'ranking',
  'private_comment',
  'child_name',
  'parent_phone',
  'parent_wechat',
  'contact_info'
];

function relayBlockedFieldLine(value = '') {
  const incoming = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(incoming.concat(SHARE_RELAY_BLOCKED_FIELDS))).join(',');
}

function relayOwnMaterialValue(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildSafeRelayChallengePacket(input = {}) {
  const focus = input.focus || loadTodayFocus() || {};
  const capability = input.capability || {};
  const subjectDepth = input.subjectSkillDepth || null;
  const route = input.route || capability.route || '/pages/arcade/arcade';
  const firstStep = input.firstStep
    || (subjectDepth && subjectDepth.firstStep)
    || focus.childArticulatedStep
    || focus.systemSuggestedStep
    || '先说清第一步';
  const relayId = input.relayId || `relay_${Date.now()}`;
  const receiverAction = input.receiverAction || `用自己的材料复刻这一步：${firstStep}`;
  const parentCheck = input.parentCheck || '家长只看第一步、错因回退和明天回访，不看完整对话。';
  const nextDayRevisit = input.nextDayRevisit || '明天只回看 1 张最不稳的卡，再做 1 个小变式。';
  const allowedFields = ['relay_id', 'first_step', 'receiver_action', 'parent_check', 'next_day_revisit', 'capability_gap'];
  const blockedFields = ['original_photo', 'full_dialogue', 'score', 'ranking', 'private_comment', 'original_answer'];
  return {
    id: 'safe_relay_challenge_packet',
    relayId,
    title: '安全接力包',
    starterAction: `发起者只留下第一步：${firstStep}`,
    receiverAction,
    parentCheck,
    nextDayRevisit,
    evidenceContract: '接力成立要留下：自己的第一步、一次错因回退、一次明日回访预约。',
    allowedFields,
    blockedFields,
    returnPath: route,
    completionSignal: '接收者完成 1 次主动回忆，并写下明天要回看的那张卡。',
    noRankingRule: '不排行、不晒分、不比较速度，只看有没有把第一步说清楚。',
    query: {
      relay_id: relayId,
      relay_receiver_action: receiverAction,
      relay_parent_check: parentCheck,
      relay_next_revisit: nextDayRevisit,
      relay_allowed_fields: allowedFields.join(','),
      relay_blocked_fields: blockedFields.join(','),
      relay_completion_signal: 'active_recall_next_revisit',
      relay_return_path: route
    }
  };
}

function buildPeerRelayChallengeLadder(input = {}) {
  const firstStep = input.firstStep || '先说清第一步';
  const route = input.route || '/pages/arcade/arcade';
  const reviewLine = input.reviewLine || '明天回访同一张错因卡，第 7 天再做一个小变式。';
  const blockedFields = ['original_question', 'original_photo', 'full_answer', 'score', 'ranking', 'full_dialogue', 'private_comment'];
  const stages = [
    {
      id: 'understand_no_answer_card',
      label: '看懂这不是答案卡',
      visibleLine: '这张卡只接力一个学习动作，不展示原题和完整答案。',
      receiverAction: '先确认自己要复刻的是“第一步”，不是抄对方的题。',
      proofRequired: '接收者说出：我只用自己的材料做同类第一步。',
      route,
      localReleaseGate: 'share_privacy_and_return',
      blockedFields
    },
    {
      id: 'own_material_first_step',
      label: '用自己的材料说第一步',
      visibleLine: `90 秒内只说第一步：${firstStep}`,
      receiverAction: '打开自己的作业或错题，复刻同一类第一步。',
      proofRequired: '留下孩子自己的第一步句子，不留下原题答案。',
      route,
      localReleaseGate: 'child_first_step',
      blockedFields
    },
    {
      id: 'wrong_cause_echo',
      label: '复述错因',
      visibleLine: '说清刚才为什么卡住，只说错因，不贴标签。',
      receiverAction: '从条件漏看、单位错配、图像误读、题干关键词里选一个错因。',
      proofRequired: '留下一个错因标签和一句家长检查句。',
      route: '/pages/review/review?from=peer_relay_ladder',
      localReleaseGate: 'wrong_cause_return',
      blockedFields
    },
    {
      id: 'day7_transfer_return',
      label: '明天/第7天回访',
      visibleLine: reviewLine,
      receiverAction: '明天先回访同一错因，第 7 天再用小变式确认迁移。',
      proofRequired: '留下明天回访预约和第 7 天迁移检查。',
      route,
      localReleaseGate: 'next_day_and_day7_revisit',
      blockedFields
    }
  ];
  const copyableChallengeTemplates = [
    {
      id: 'ninety_second_first_step',
      title: '90 秒只说第一步',
      copy: `不用看答案，只用自己的题说第一步：${firstStep}`,
      receiverPrompt: '你也用自己的材料试一次，只说第一步。',
      proofRequired: '孩子自己的第一步句子'
    },
    {
      id: 'same_wrong_cause_no_question',
      title: '同类错因不晒题',
      copy: '我不发原题，只发一个同类错因，你用自己的题接一下。',
      receiverPrompt: '找出你自己题里的同类错因。',
      proofRequired: '错因标签和家长检查句'
    },
    {
      id: 'day7_still_counts',
      title: '第 7 天还会才算稳',
      copy: '今晚会不算结束，第 7 天还能说出来才算稳。',
      receiverPrompt: '接力后预约一个第 7 天小变式。',
      proofRequired: '第 7 天迁移检查'
    },
    {
      id: 'parent_one_question',
      title: '家长只问一句',
      copy: `家长只问一句：${firstStep}`,
      receiverPrompt: '家长不讲答案，只听孩子说第一步。',
      proofRequired: '家长检查句'
    }
  ];
  const localSpreadReleaseGate = {
    id: 'peer_ladder_release_gate',
    localDeterministic: true,
    status: stages.every((item) => item.visibleLine && item.receiverAction && item.proofRequired && item.blockedFields.includes('full_answer'))
      ? 'peer_ladder_ready'
      : 'parent_only',
    requiredEvidence: stages.map((item) => item.localReleaseGate),
    blockedFields,
    rule: '只有第一步、错因、回访和隐私字段全部通过本地门禁，才允许同伴接力；AI 只能改写表达，不能决定放行。'
  };
  return {
    id: 'peer_relay_challenge_ladder',
    title: '同伴接力挑战阶梯',
    stages,
    copyableChallengeTemplates,
    localSpreadReleaseGate,
    boundary: '接力的是学习动作，不是原题、答案、分数、排名或完整对话。'
  };
}

function buildPeerRelaySeasonArc(input = {}) {
  const firstStep = input.firstStep || '先说清第一步';
  const route = input.route || '/pages/arcade/arcade';
  const readiness = input.spreadReadinessGate || {};
  const ladder = input.peerRelayChallengeLadder || {};
  const safePacket = input.safeRelayChallengePacket || {};
  const blockedFields = safePacket.blockedFields || ['original_question', 'original_answer', 'original_photo', 'score', 'ranking', 'full_dialogue'];
  const ready = readiness.status === 'peer_relay_ready'
    || (ladder.localSpreadReleaseGate && ladder.localSpreadReleaseGate.status === 'peer_ladder_ready');
  const milestones = [
    {
      id: 'season_d0_first_step',
      day: 'D0',
      title: '90 秒第一步',
      action: `只说第一步：${firstStep}`,
      evidence: 'receiver_first_step',
      reward: '只记录行动勋章，不发排名。'
    },
    {
      id: 'season_d1_wrong_cause',
      day: 'D1',
      title: '明天错因回放',
      action: '接收者用自己的材料复述同类错因。',
      evidence: 'wrong_cause_echo',
      reward: '错因说清后，才允许继续接力。'
    },
    {
      id: 'season_d3_near_transfer',
      day: 'D3',
      title: '小变式接力',
      action: '只换条件或图像，不换成刷题量。',
      evidence: 'near_transfer_with_own_material',
      reward: '通过后解锁下一张同类动作卡。'
    },
    {
      id: 'season_d7_return_gate',
      day: 'D7',
      title: '第 7 天回看',
      action: '第 7 天仍能说第一步，才写入长期画像候选。',
      evidence: 'day7_transfer_check',
      reward: '只释放家庭复盘徽章，不显示分数排行。'
    }
  ];
  const badgeRules = [
    { id: 'first_step_badge', open: true, rule: '孩子自己说出第一步才点亮。' },
    { id: 'wrong_cause_badge', open: ready, rule: '错因回到卡片后才点亮。' },
    { id: 'relay_badge', open: ready, rule: '接收者必须用自己的材料完成，不能复制原题。' },
    { id: 'day7_badge', open: false, rule: '第 7 天回看前保持锁定。' }
  ];
  return {
    id: 'peer_relay_season_arc',
    title: '7 天安全接力赛季',
    localDeterministic: true,
    status: ready ? 'season_ready' : 'parent_only_until_evidence',
    route,
    headline: '把分享做成 7 天动作接力，不做答案传播。',
    seasonLine: ready
      ? '可以开放给同伴：只接力第一步、错因和回访，不接力原题答案。'
      : '证据不足时只给家长复盘，不开放同伴传播。',
    milestones,
    badgeRules,
    localReleaseGate: {
      id: 'peer_relay_season_local_gate',
      status: ready ? 'open_safe_relay' : 'hold_parent_only',
      requiredEvidence: milestones.map((item) => item.evidence),
      rule: '本地规则决定赛季、徽章、接力和第 7 天画像放行；AI 只允许改写邀请话术。'
    },
    safeSharePayload: {
      allowedFields: ['season_id', 'first_step', 'wrong_cause_label', 'receiver_action', 'return_window', 'parent_check'],
      blockedFields
    },
    aiBoundary: 'AI may rewrite the invitation copy; local code decides season status, rewards, share fields, day-7 release, and privacy blocks.'
  };
}

function buildWrongCauseViralChallengePack(input = {}) {
  const firstStep = input.firstStep || '先说清第一步';
  const wrongCause = input.wrongCause || (input.capability && input.capability.label) || (input.focus && input.focus.title) || '同类错因';
  const parentCheck = input.parentCheck || input.actionLabel || (input.capability && input.capability.nextAction) || `家长只问：这一步为什么会卡在「${wrongCause}」？`;
  const route = input.route || (input.capability && input.capability.route) || '/pages/arcade/arcade';
  const blockedFields = ['original_question', 'original_answer', 'original_photo', 'full_dialogue', 'score', 'ranking', 'private_comment'];
  const allowedFields = ['wrong_cause_label', 'first_step', 'parent_check', 'receiver_action', 'next_day_revisit', 'return_path'];
  const hooks = [
    {
      id: 'same_mistake_no_question',
      title: '同错因，不同题',
      copy: `我不发原题，只发一个错因挑战：${wrongCause}。你用自己的题说出第一步：${firstStep}`,
      whyItSpreads: '朋友可以用自己的作业复刻，不需要看到原题和答案。',
      proof: 'receiver_own_first_step'
    },
    {
      id: 'ninety_second_wrong_cause',
      title: '90 秒错因接力',
      copy: `90 秒内只做一件事：说清「${wrongCause}」这类题第一步，不比谁做得快。`,
      whyItSpreads: '低门槛、可复制、无排名压力。',
      proof: 'wrong_cause_echo'
    },
    {
      id: 'day7_truth_check',
      title: '第 7 天才算稳',
      copy: '今晚会不算结束，第 7 天还能迁移才算稳。',
      whyItSpreads: '把一次分享变成一次回访，而不是一次性邀请。',
      proof: 'day7_transfer_check'
    }
  ];
  const receiverSteps = [
    { id: 'accept_boundary', label: '先确认边界', action: '不用看发起者原题，用自己的材料做同类第一步。', evidence: 'no_original_question_needed' },
    { id: 'say_first_step', label: '说第一步', action: firstStep, evidence: 'receiver_first_step' },
    { id: 'echo_wrong_cause', label: '复述错因', action: `说出自己是否也卡在「${wrongCause}」。`, evidence: 'receiver_wrong_cause_echo' },
    { id: 'book_revisit', label: '约回访', action: '明天回访同一错因，第 7 天做一个小变式。', evidence: 'receiver_revisit_window' }
  ];
  const localReleaseGate = {
    id: 'wrong_cause_viral_release_gate',
    localDeterministic: true,
    status: firstStep && wrongCause && parentCheck ? 'wrong_cause_relay_ready' : 'parent_only',
    requiredEvidence: ['wrong_cause_label', 'child_first_step', 'parent_check', 'next_day_revisit'],
    blockedFields,
    rule: '只有错因、第一步、家长检查句和回访窗口都存在时，才允许做同伴传播；AI 只可改写文案，不决定放行。'
  };
  return {
    id: 'wrong_cause_viral_challenge_pack',
    title: '错因挑战传播包',
    wrongCause,
    firstStep,
    parentCheck,
    receiverAction: `用自己的材料复刻这个错因的第一步：${firstStep}`,
    nextDayRevisit: '明天只回访同一错因，第 7 天再做小变式。',
    hooks,
    receiverSteps,
    allowedFields,
    blockedFields,
    localReleaseGate,
    noRankingLine: '不排行、不晒分、不比较速度，只看有没有说清第一步和错因。',
    privacyBoundary: '不传原题、原答案、照片、完整对话、分数、排名或隐私评价。',
    returnPath: route,
    query: {
      wrong_cause_pack: '1',
      wrong_cause_label: wrongCause,
      wrong_cause_first_step: firstStep,
      wrong_cause_parent_check: parentCheck,
      wrong_cause_receiver_action: `用自己的材料复刻：${firstStep}`,
      wrong_cause_next_revisit: 'next_day_same_wrong_cause',
      wrong_cause_allowed_fields: allowedFields.join(','),
      wrong_cause_blocked_fields: blockedFields.join(','),
      wrong_cause_return_path: route,
      wrong_cause_gate: localReleaseGate.status
    }
  };
}

function buildShareChallengePlan(input = {}) {
  const focus = input.focus || loadTodayFocus() || {};
  const capability = input.capability || {};
  const realTrialGameChallengeBridge = input.realTrialGameChallengeBridge || buildRealTrialGameChallengeBridge({
    limit: 3
  });
  const realTrialPressureCandidateBoard = input.realTrialPressureCandidateBoard || buildRealTrialPressureCandidateBoard({
    limit: 3
  });
  const subjectDepth = input.subjectSkillDepth || null;
  const actionLabel = input.actionLabel || capability.nextAction || parentNextActionLabel(input.parentNextAction || '');
  const subjectLabel = subjectDepth && subjectDepth.label ? subjectDepth.label : (focus.title ? '当前卡点' : '第一步');
  const firstStep = subjectDepth && subjectDepth.firstStep
    ? subjectDepth.firstStep
    : (focus.childArticulatedStep || focus.systemSuggestedStep || '先说清第一步');
  const route = capability.route || input.route || '/pages/arcade/arcade';
  const goal = `用自己的材料完成一次「${subjectLabel}」轻挑战`;
  const steps = [
    { id: 'recall', label: '主动回忆', text: `先不看答案，说出：${firstStep}` },
    { id: 'repair', label: '错因修复', text: actionLabel || '错了也只退回第一步提示卡。' },
    { id: 'revisit', label: '次日回访', text: '明天只回看 1 张卡，确认还能开口。' }
  ];
  const reviewCadence = [
    { id: 'tonight', label: '今晚', text: '完成 3 张主动回忆卡，只奖励说清第一步。' },
    { id: 'tomorrow', label: '明天', text: '只回访最不稳的 1 张卡，不扩题量。' },
    { id: 'day_7', label: '第 7 天', text: '用 1 道小变式确认能不能迁移。' }
  ];
  const privacyBoundary = '分享只带轻挑战、第一步、能力缺口和回访动作，不带孩子完整对话、分数、原题照片。';
  const peerSafeLine = '同伴只接同类动作，不比较速度、不比较正确率。';
  const returnPathContract = [
    { id: 'land', label: '落地页', text: '先解释这不是排行榜，而是一张可复用的学习动作卡。' },
    { id: 'choose', label: '选动作', text: '从修卡点、轻挑战、给家长看三条路里选一条。' },
    { id: 'persist', label: '留证据', text: '完成后写入分享接力、统一下一步和页面能力账本。' }
  ];
  const relayChain = [
    { id: 'sender', label: '发起者', text: `留下「${subjectLabel}」的第一步证据。` },
    { id: 'receiver', label: '接收者', text: '用自己的材料复刻同一类第一步，不复制作业答案。' },
    { id: 'parent', label: '家长', text: '只检查今晚动作和明天回访，不追排名。' }
  ];
  const communityChallengeCard = {
    title: '家庭轻接力卡',
    promise: '把一次分享变成一次可复用的学习动作，而不是邀请链接。',
    firstStep,
    noRankingLine: '不排行、不晒分、不暴露原题，只留行动证据。',
    doneSignal: '接收者完成 1 次主动回忆、1 次错因回退、1 次明天回访预约。'
  };
  const shareHookDeck = [
    {
      id: 'ninety_second_recall',
      title: '90 秒回忆挑战',
      visibleLine: `不看答案，说出这类题第一步：${firstStep}`,
      receiverPrompt: '你也用自己的作业试一次，只说第一步。',
      proofSignal: '留下 1 句孩子自己的第一步。'
    },
    {
      id: 'wrong_cause_snap',
      title: '错因快照',
      visibleLine: actionLabel || '今天只修同一个错因。',
      receiverPrompt: '接力者只找自己的同类错因，不比较谁做得快。',
      proofSignal: '留下错因标签和明天回访卡。'
    },
    {
      id: 'day7_return',
      title: '第 7 天回访',
      visibleLine: '现在会不算结束，第 7 天还能说出来才算稳。',
      receiverPrompt: '接收后自动带回轻回访，不进入题海。',
      proofSignal: '留下回访时间，不晒分数。'
    }
  ];
  const naturalSpreadTriggers = [
    { id: 'parent_reassurance', trigger: '家长想知道今晚怎么帮', hook: '转发的是一句可照做的话，不是成绩单。' },
    { id: 'peer_copyable', trigger: '同学也卡同类题', hook: '对方用自己的材料复刻第一步，不复制原题。' },
    { id: 'weekly_return', trigger: '一周后还想确认', hook: '第 7 天自动回到同一错因的小变式。' }
  ];
  const naturalSpreadLoop = {
    id: 'privacy_safe_growth_loop',
    title: '安全接力裂变',
    inviteLine: `我只发一个可复用的第一步：${firstStep}`,
    receiverPrompt: '你不用看我的题，用自己的作业复刻同类第一步。',
    parentReassuranceLine: '这张卡不带原题、照片、答案、分数、排名或完整对话，家长只看行动证据。',
    day7ReturnLine: '第 7 天回到同一错因，用一道小变式确认是否真的会迁移。',
    proofOfLifeSignal: '接收者留下自己的第一步、错因回退和明日回访预约，才算接力完成。',
    oneTapAction: {
      label: '接力这一小步',
      route,
      evidence: 'privacy_safe_growth_relay'
    },
    viralGuardrails: [
      '不传播原题照片',
      '不传播完整答案',
      '不传播孩子完整对话',
      '不晒分数排名',
      '不比较速度',
      '不暴露孩子隐私'
    ],
    spreadScore: {
      copyable: true,
      safe: true,
      returnable: true,
      reason: '能被朋友复刻的是学习动作，不是题目、答案或成绩。'
    }
  };
  const communityRipplePlan = {
    id: 'safe_learning_ripple',
    title: '安全学习涟漪',
    rule: '一个分享最多带出一个同类第一步挑战，不扩散原题、不扩散答案、不扩散排名。',
    loop: ['发起者留第一步', '接收者用自己的材料复刻', '家长只问一句', '明天回访同一错因'],
    conversionLine: '自然裂变只建立在可复用动作上，不建立在晒成绩或制造焦虑上。'
  };
  const receiverOnboardingDeck = [
    {
      id: 'understand',
      label: '先看懂',
      visibleLine: '这不是答案卡，是第一步动作卡。',
      receiverAction: '用自己的题说出同类第一步。',
      evidence: 'receiver_understands_no_answer'
    },
    {
      id: 'try',
      label: '试一次',
      visibleLine: '90 秒内只说第一步，不看答案。',
      receiverAction: '完成 1 张主动回忆卡。',
      evidence: 'receiver_first_step_attempt'
    },
    {
      id: 'return',
      label: '明天回访',
      visibleLine: '明天还能说出来，才算接力完成。',
      receiverAction: '预约明天同一错因回访。',
      evidence: 'receiver_next_day_revisit'
    }
  ];
  const viralProofLedger = [
    { id: 'first_step_only', label: '只晒第一步', safe: true, blocked: 'final_answer' },
    { id: 'own_material', label: '用自己的材料', safe: true, blocked: 'original_question' },
    { id: 'no_rank', label: '不排行不晒分', safe: true, blocked: 'ranking_score' },
    { id: 'day7_return', label: '第 7 天回流', safe: true, blocked: 'one_shot_invite' }
  ];
  const oerResources = realHomeworkCoverage && Array.isArray(realHomeworkCoverage.PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER)
    ? realHomeworkCoverage.PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER
    : [];
  const sourceBackedChallengeDeck = oerResources.slice(0, 8).map((resource, index) => ({
    id: `source_backed_${resource.id || index}`,
    title: `${resource.label || '公开资料'} · 90 秒同类挑战`,
    sourceLabel: resource.label || '',
    sourceUrl: resource.sourceUrl || '',
    licenseSignal: resource.licenseSignal || '使用前检查来源边界',
    commercialDecision: resource.commercialDecision || '只借鉴结构，不复制原文或答案',
    receiverPrompt: `用自己的作业材料，借这个来源的「${(resource.directUse || ['概念结构'])[0]}」做一次同类第一步：${firstStep}`,
    localRule: `本地代码只接收 ${((resource.localizeAsCode || ['task_type'])[0])}，AI 只改写提示语气。`,
    aiLine: (resource.aiBetterFor || ['把提示改写成孩子听得懂的一句话'])[0],
    shareLine: `来源只做结构参考：${resource.commercialDecision || '不复制原文、不搬运答案。'}`,
    evidenceRequired: ['receiver_own_material', 'first_step_only', 'wrong_cause_echo', 'next_day_revisit'],
    blockedFields: ['original_question', 'original_answer', 'copied_paragraph', 'score', 'ranking', 'full_dialogue', 'private_comment'],
    route
  }));
  const parentDecisionPayload = {
    tonightQuestion: `今晚只问一句：${firstStep}`,
    evidenceToCheck: ['孩子自己的第一步', '错因是否回到卡片', '明天是否能复述'],
    stopRule: '孩子说不出来就停在小黑板提示，不继续补完整答案。'
  };
  const wrongCauseReplayPayload = {
    entry: '/pages/review/review?from=share_relay&mode=wrong_cause',
    replayRule: '先复述错因，再做 1 道同类小变式。',
    fallback: '错因说不清时回到第一步卡，不进入刷题。'
  };
  const sevenDayReviewPayload = {
    day1: '今晚完成主动回忆。',
    day2: '明天只回访最不稳的 1 张卡。',
    day7: '第 7 天用小变式确认迁移。'
  };
  const peerRelayChallengeLadder = buildPeerRelayChallengeLadder({
    firstStep,
    route,
    reviewLine: sevenDayReviewPayload.day7
  });
  const wrongCauseViralChallengePack = buildWrongCauseViralChallengePack({
    focus,
    capability,
    firstStep,
    wrongCause: capability.label || focus.title || actionLabel,
    parentCheck: actionLabel,
    route
  });
  const shareRelayActions = [
    { id: 'repair', label: '修卡点', route: wrongCauseReplayPayload.entry, evidence: 'wrong_cause_relay' },
    { id: 'challenge', label: '做轻挑战', route, evidence: 'active_recall_relay' },
    { id: 'parent', label: '给家长看', route: '/pages/profile/profile?from=share_relay', evidence: 'parent_decision_relay' }
  ];
  const safeRelayChallengePacket = buildSafeRelayChallengePacket({
    focus,
    capability,
    subjectSkillDepth: subjectDepth,
    route,
    firstStep,
    receiverAction: `用自己的材料做同类第一步：${firstStep}`,
    parentCheck: parentDecisionPayload.tonightQuestion,
    nextDayRevisit: sevenDayReviewPayload.day7
  });
  const spreadReadinessGate = buildShareSpreadReadinessGate({
    focus,
    capability,
    subjectSkillDepth: subjectDepth,
    firstStep,
    safeRelayChallengePacket,
    shareHookDeck,
    naturalSpreadLoop,
    evidenceRequired: ['active_recall_cards', 'child_first_step', 'wrong_cause_return', 'next_day_revisit'],
    reviewCadence,
    route
  });
  const peerRelaySeasonArc = buildPeerRelaySeasonArc({
    firstStep,
    route,
    spreadReadinessGate,
    peerRelayChallengeLadder,
    safeRelayChallengePacket
  });
  const familyRelayGrowthProtocol = {
    id: 'family_relay_growth_protocol',
    localDeterministic: true,
    senderReason: 'share_a_reusable_first_step_not_an_answer',
    receiverOwnMaterialAction: `receiver_uses_own_material_to_repeat_first_step:${firstStep}`,
    parentSafeReassurance: 'no_original_question_no_answer_no_score_no_ranking_no_full_dialogue',
    returnWindows: [
      { id: 'tonight', action: '90_second_first_step_recall', evidence: 'receiver_first_step' },
      { id: 'day3', action: 'near_transfer_with_own_material', evidence: 'receiver_near_transfer' },
      { id: 'day7', action: 'confirm_transfer_before_portrait_release', evidence: 'day7_transfer_check' }
    ],
    proofOfLifeEvents: ['receiver_first_step', 'wrong_cause_echo', 'next_day_revisit_locked', 'day7_transfer_check'],
    blockedFields: ['original_question', 'original_answer', 'original_photo', 'score', 'ranking', 'full_dialogue', 'private_comment'],
    noRankingRule: 'No ranking, score, speed comparison, original question, original answer, or screenshot can be used as a growth hook.',
    peerRelayGate: {
      status: spreadReadinessGate.status,
      open: spreadReadinessGate.status === 'peer_relay_ready',
      rule: 'Local readiness gate opens peer relay only after first-step, wrong-cause, review-window, and safe-packet checks pass.'
    },
    aiBoundary: 'AI may rewrite the card copy; local code decides share fields, relay status, return windows, and privacy blocks.'
  };
  return {
    id: 'share_challenge_plan',
    title: '同伴轻挑战',
    goal,
    route,
    noRankingLine: '不排行、不晒分，只看有没有说清第一步。',
    modeLine: input.mode === 'parent_recap'
      ? '家庭模式：另一位家长只照着一句话追问。'
      : '同伴模式：对方用自己的材料做同一类第一步。',
    steps,
    reviewCadence,
    relayChain,
    communityChallengeCard,
    shareHookDeck,
    naturalSpreadTriggers,
    naturalSpreadLoop,
    familyRelayGrowthProtocol,
    realTrialGameChallengeBridge,
    realTrialPressureCandidateBoard,
    sourceBackedChallengeDeck,
    wrongCauseViralChallengePack,
    communityRipplePlan,
    receiverOnboardingDeck,
    viralProofLedger,
    peerRelayChallengeLadder,
    peerRelaySeasonArc,
    copyableChallengeTemplates: peerRelayChallengeLadder.copyableChallengeTemplates,
    localSpreadReleaseGate: peerRelayChallengeLadder.localSpreadReleaseGate,
    returnPathContract,
    privacyBoundary,
    peerSafeLine,
    parentDecisionPayload,
    wrongCauseReplayPayload,
    sevenDayReviewPayload,
    safeRelayChallengePacket,
    spreadReadinessGate,
    evidenceContractLine: '接力成立必须同时有：第一步、错因回退、明天回访；缺一项就只算邀请，不算学习闭环。',
    shareRelayActions,
    parentEvidenceLine: '家长只看三件事：孩子是否自己说第一步、错因是否回到卡片、明天是否还能复述。',
    successRule: '完成 3 张主动回忆卡，并留下孩子自己的第一步。',
    failureFallback: '如果说不出来，退回第一步小黑板，不继续讲完整答案。',
    evidenceRequired: ['active_recall_cards', 'child_first_step', 'wrong_cause_return', 'next_day_revisit'],
    query: {
      challenge_goal: goal,
      challenge_rule: '三张主动回忆卡，不排行，只留第一步证据',
      challenge_route: route,
      relay_privacy: privacyBoundary,
      relay_review: sevenDayReviewPayload.day7,
      relay_first_step: firstStep,
      relay_hook: shareHookDeck[0].title,
      relay_spread_trigger: naturalSpreadTriggers[0].id,
      relay_invite_line: naturalSpreadLoop.inviteLine,
      relay_receiver_prompt: naturalSpreadLoop.receiverPrompt,
      relay_parent_reassurance: naturalSpreadLoop.parentReassuranceLine,
      relay_day7_return: naturalSpreadLoop.day7ReturnLine,
      relay_proof_signal: naturalSpreadLoop.proofOfLifeSignal,
      relay_guardrail: naturalSpreadLoop.viralGuardrails.join(','),
      relay_receiver_onboarding: receiverOnboardingDeck.map((item) => item.id).join(','),
      relay_proof_ledger: viralProofLedger.map((item) => item.id).join(','),
      source_challenge_count: String(sourceBackedChallengeDeck.length),
      source_challenge_first: sourceBackedChallengeDeck[0] ? sourceBackedChallengeDeck[0].sourceLabel : '',
      source_challenge_prompt: sourceBackedChallengeDeck[0] ? sourceBackedChallengeDeck[0].receiverPrompt : '',
      source_challenge_license: sourceBackedChallengeDeck[0] ? sourceBackedChallengeDeck[0].licenseSignal : '',
      source_challenge_decision: sourceBackedChallengeDeck[0] ? sourceBackedChallengeDeck[0].commercialDecision : '',
      source_challenge_local_rule: sourceBackedChallengeDeck[0] ? sourceBackedChallengeDeck[0].localRule : '',
      source_challenge_blocked: sourceBackedChallengeDeck[0] ? sourceBackedChallengeDeck[0].blockedFields.join(',') : '',
      source_challenge_route: sourceBackedChallengeDeck[0] ? sourceBackedChallengeDeck[0].route : route,
      relay_id: safeRelayChallengePacket.query.relay_id,
      relay_receiver_action: safeRelayChallengePacket.query.relay_receiver_action,
      relay_parent_check: safeRelayChallengePacket.query.relay_parent_check,
      relay_next_revisit: safeRelayChallengePacket.query.relay_next_revisit,
      relay_allowed_fields: safeRelayChallengePacket.query.relay_allowed_fields,
      relay_blocked_fields: safeRelayChallengePacket.query.relay_blocked_fields,
      relay_completion_signal: safeRelayChallengePacket.query.relay_completion_signal,
      relay_return_path: safeRelayChallengePacket.query.relay_return_path,
      relay_spread_status: spreadReadinessGate.status,
      relay_growth_protocol: familyRelayGrowthProtocol.id,
      relay_growth_gate: familyRelayGrowthProtocol.peerRelayGate.status,
      real_trial_challenge: realTrialGameChallengeBridge.query.real_trial_challenge || '',
      real_trial_first_step: realTrialGameChallengeBridge.query.real_trial_first_step || '',
      real_trial_wrong_cause: realTrialGameChallengeBridge.query.real_trial_wrong_cause || '',
      real_trial_parent_check: realTrialGameChallengeBridge.query.real_trial_parent_check || '',
      real_trial_route: realTrialGameChallengeBridge.query.real_trial_route || '',
      real_trial_allowed: realTrialGameChallengeBridge.query.real_trial_allowed || '',
      real_trial_blocked: realTrialGameChallengeBridge.query.real_trial_blocked || '',
      real_trial_pressure_candidate: realTrialPressureCandidateBoard.firstCandidate ? realTrialPressureCandidateBoard.firstCandidate.id : '',
      real_trial_pressure_route: realTrialPressureCandidateBoard.firstCandidate ? realTrialPressureCandidateBoard.firstCandidate.tutorRoute : '',
      real_trial_pressure_review: realTrialPressureCandidateBoard.firstCandidate ? realTrialPressureCandidateBoard.firstCandidate.reviewRoute : '',
      real_trial_pressure_arcade: realTrialPressureCandidateBoard.firstCandidate ? realTrialPressureCandidateBoard.firstCandidate.arcadeRoute : '',
      real_trial_pressure_blocked: realTrialPressureCandidateBoard.firstCandidate ? realTrialPressureCandidateBoard.firstCandidate.blockedFields.join(',') : '',
      relay_spread_score: String(spreadReadinessGate.score),
      relay_spread_line: spreadReadinessGate.shareModeLine,
      relay_spread_fallback: spreadReadinessGate.fallbackLine,
      relay_spread_reason: spreadReadinessGate.reasons.join(' / '),
      relay_spread_required: spreadReadinessGate.requiredEvidence.join(','),
      relay_ladder: peerRelayChallengeLadder.stages.map((item) => item.id).join(','),
      relay_attraction_hook: peerRelayChallengeLadder.copyableChallengeTemplates.map((item) => item.title).join(' / '),
      relay_local_gate: peerRelayChallengeLadder.localSpreadReleaseGate.status,
      relay_season: peerRelaySeasonArc.id,
      relay_season_status: peerRelaySeasonArc.status,
      relay_season_line: peerRelaySeasonArc.seasonLine,
      relay_season_days: peerRelaySeasonArc.milestones.map((item) => item.day).join(','),
      relay_season_gate: peerRelaySeasonArc.localReleaseGate.status,
      wrong_cause_pack: wrongCauseViralChallengePack.query.wrong_cause_pack,
      wrong_cause_label: wrongCauseViralChallengePack.query.wrong_cause_label,
      wrong_cause_first_step: wrongCauseViralChallengePack.query.wrong_cause_first_step,
      wrong_cause_parent_check: wrongCauseViralChallengePack.query.wrong_cause_parent_check,
      wrong_cause_receiver_action: wrongCauseViralChallengePack.query.wrong_cause_receiver_action,
      wrong_cause_next_revisit: wrongCauseViralChallengePack.query.wrong_cause_next_revisit,
      wrong_cause_allowed_fields: wrongCauseViralChallengePack.query.wrong_cause_allowed_fields,
      wrong_cause_blocked_fields: wrongCauseViralChallengePack.query.wrong_cause_blocked_fields,
      wrong_cause_return_path: wrongCauseViralChallengePack.query.wrong_cause_return_path,
      wrong_cause_gate: wrongCauseViralChallengePack.query.wrong_cause_gate
    }
  };
}

function buildShareSpreadReadinessGate(input = {}) {
  const safePacket = input.safeRelayChallengePacket || null;
  const blockedFields = safePacket && Array.isArray(safePacket.blockedFields)
    ? safePacket.blockedFields
    : [];
  const allowedFields = safePacket && Array.isArray(safePacket.allowedFields)
    ? safePacket.allowedFields
    : ['share_code', 'first_step', 'capability_gap', 'receiver_action', 'parent_check', 'next_day_revisit'];
  const evidenceRequired = Array.isArray(input.evidenceRequired) && input.evidenceRequired.length
    ? input.evidenceRequired
    : ['child_first_step', 'wrong_cause_return', 'next_day_revisit'];
  const firstStep = input.firstStep || (input.subjectSkillDepth && input.subjectSkillDepth.firstStep) || '';
  const subjectLabel = input.subjectSkillDepth && input.subjectSkillDepth.label ? input.subjectSkillDepth.label : '当前卡点';
  const hasSafeBlocks = ['original_answer', 'ranking', 'score', 'full_dialogue', 'original_photo']
    .every((field) => blockedFields.includes(field));
  const signals = [
    {
      id: 'has_first_step',
      ready: !!firstStep,
      reason: firstStep ? '已有可复刻的第一步' : '缺少孩子能复述的第一步'
    },
    {
      id: 'has_wrong_cause_or_action',
      ready: !!(input.capability && input.capability.nextAction) || evidenceRequired.includes('wrong_cause_return'),
      reason: '有错因回退或下一步动作'
    },
    {
      id: 'has_review_return',
      ready: Array.isArray(input.reviewCadence) && input.reviewCadence.length >= 3,
      reason: '有明天和第 7 天回访'
    },
    {
      id: 'has_safe_packet',
      ready: !!safePacket && hasSafeBlocks,
      reason: hasSafeBlocks ? '隐私字段已被本地规则拦截' : '分享字段边界不足'
    },
    {
      id: 'has_receiver_hook',
      ready: Array.isArray(input.shareHookDeck) && input.shareHookDeck.length >= 3,
      reason: '接收者有可执行动作'
    }
  ];
  const score = Math.round(signals.filter((item) => item.ready).length / signals.length * 100);
  const missing = signals.filter((item) => !item.ready).map((item) => item.reason);
  const status = score >= 80 ? 'peer_relay_ready' : score >= 60 ? 'needs_evidence' : 'parent_only';
  const shareModeLine = status === 'peer_relay_ready'
    ? `可发同伴接力：只传${subjectLabel}的第一步、错因回访和明天动作。`
    : status === 'needs_evidence'
      ? '先补齐第一步、错因回退和回访证据，再开放同伴接力。'
      : '当前只建议家长内用，不做同伴传播。';
  const fallbackLine = status === 'peer_relay_ready'
    ? '如果接收者要答案，自动退回小黑板第一步，不展示完整解法。'
    : '证据不足时降级为家长复盘卡，只保留今晚行动和明天回访。';
  return {
    id: 'share_spread_readiness_gate',
    status,
    score,
    signals,
    reasons: signals.filter((item) => item.ready).map((item) => item.reason),
    missing,
    requiredEvidence: evidenceRequired,
    allowedFields,
    blockedFields,
    shareModeLine,
    fallbackLine,
    noRankingRule: '不晒分、不排名、不传原题照片、不传完整对话、不传最终答案。',
    route: input.route || '/pages/arcade/arcade'
  };
}

function buildCommunityShareRelayBoard(input = {}) {
  const plan = input.shareChallengePlan || buildShareChallengePlan(input);
  const realTrialGameChallengeBridge = plan.realTrialGameChallengeBridge || buildRealTrialGameChallengeBridge({
    limit: 3
  });
  const realTrialPressureCandidateBoard = plan.realTrialPressureCandidateBoard || buildRealTrialPressureCandidateBoard({
    limit: 3
  });
  const publicK12IntakeChallengeDeck = realHomeworkCoverage && typeof realHomeworkCoverage.buildPublicK12IntakeChallengeDeck === 'function'
    ? realHomeworkCoverage.buildPublicK12IntakeChallengeDeck({ limit: 6 })
    : [];
  const shareRuns = loadShareRuns();
  const incoming = loadIncomingShare();
  const recentRuns = shareRuns.slice(0, 5);
  const relayEvidenceCount = recentRuns.filter((item) => item && (item.share_intent || item.type || item.payload)).length;
  const receiverCompletionCount = shareRuns.filter((item) => item && item.type === 'share_relay_receiver_completion').length;
  const challengeCompletions = shareRuns.filter((item) => item && (
    item.type === 'share_relay_receiver_completion'
    || item.type === 'share_receiver_completion'
    || item.completion_kind
  )).slice(0, 6);
  const returnRateLabel = shareRuns.length
    ? `接力完成 ${challengeCompletions.length}/${shareRuns.length}，只看动作闭环，不做分数排名。`
    : '还没有接力样本，先发起一张90秒第一步挑战。';
  const lanes = [
    {
      id: 'sender',
      label: '发起者',
      action: plan.communityChallengeCard ? plan.communityChallengeCard.firstStep : plan.goal,
      evidence: '只分享第一步和回访动作',
      route: '/pages/profile/profile?from=community_relay'
    },
    {
      id: 'receiver',
      label: '接收者',
      action: incoming && incoming.share_code ? (incoming.action_label || '用自己的材料复刻同类第一步') : '等待一张可接力的学习动作卡',
      evidence: receiverCompletionCount
        ? `已完成 ${receiverCompletionCount} 次接收者第一步回写`
        : incoming && incoming.share_code ? `已接到 ${incoming.share_code}` : '还没有回流记录',
      route: '/pages/home/home?from=community_relay'
    },
    {
      id: 'parent',
      label: '家长',
      action: plan.parentEvidenceLine || '只看今晚动作、错因和明天回访',
      evidence: '不看排名、不看完整对话、不晒分',
      route: '/pages/profile/profile?from=community_parent'
    }
  ];
  const visualRelayProtocol = [
    {
      id: 'starter_board',
      label: '发起者小黑板',
      action: plan.communityChallengeCard ? `只画第一步：${plan.communityChallengeCard.firstStep}` : '只画第一步，不画答案。',
      evidence: 'starter_first_step_board',
      blocked: '不上传原题照片、不晒答案。'
    },
    {
      id: 'receiver_rebuild',
      label: '接收者复刻',
      action: plan.safeRelayChallengePacket ? plan.safeRelayChallengePacket.receiverAction : '用自己的材料复刻同类第一步。',
      evidence: 'receiver_rebuilt_first_step',
      blocked: '不复制发起者作业，不比较速度。'
    },
    {
      id: 'parent_check',
      label: '家长检查',
      action: plan.safeRelayChallengePacket ? plan.safeRelayChallengePacket.parentCheck : '只问孩子第一步先看哪里。',
      evidence: 'parent_checked_first_step',
      blocked: '不追问完整解法，不贴标签。'
    },
    {
      id: 'return_visit',
      label: '回访闭环',
      action: plan.safeRelayChallengePacket ? plan.safeRelayChallengePacket.nextDayRevisit : '明天只回访一张最不稳的卡。',
      evidence: 'next_day_relay_revisit',
      blocked: '不把一次做对当长期画像结论。'
    }
  ];
  const visualRelayProofChecklist = [
    '发起者留下第一步小黑板',
    '接收者用自己的材料复刻',
    '家长只检查第一步',
    '明天完成一次回访'
  ];
  return {
    id: 'community_share_relay_board',
    title: '社区轻接力看板',
    summary: relayEvidenceCount
      ? `已有 ${relayEvidenceCount} 条分享或回流证据，继续按第一步接力，不比较分数。`
      : '先把分享做成学习动作卡，不做邀请链接和排行榜。',
    ready: relayEvidenceCount > 0 || !!(incoming && incoming.share_code),
    noRankingLine: plan.noRankingLine || '不排行、不晒分，只看有没有说清第一步。',
    privacyBoundary: plan.privacyBoundary,
    peerSafeLine: plan.peerSafeLine,
    safeRelayChallengePacket: plan.safeRelayChallengePacket,
    realTrialGameChallengeBridge,
    realTrialGameChallengeCards: realTrialGameChallengeBridge.challengeCards || [],
    realTrialGameChallengeLine: realTrialGameChallengeBridge.reportLine || '',
    realTrialPressureCandidateBoard,
    realTrialPressureCandidateCards: realTrialPressureCandidateBoard.cards || [],
    realTrialPressureCandidateLine: realTrialPressureCandidateBoard.reportLine || '',
    shareHookDeck: plan.shareHookDeck || [],
    sourceBackedChallengeDeck: plan.sourceBackedChallengeDeck || [],
    publicK12IntakeChallengeDeck,
    naturalSpreadTriggers: plan.naturalSpreadTriggers || [],
    naturalSpreadLoop: plan.naturalSpreadLoop || {},
    spreadReadinessGate: plan.spreadReadinessGate || buildShareSpreadReadinessGate({
      safeRelayChallengePacket: plan.safeRelayChallengePacket,
      shareHookDeck: plan.shareHookDeck,
      naturalSpreadLoop: plan.naturalSpreadLoop,
      evidenceRequired: plan.evidenceRequired,
      reviewCadence: plan.reviewCadence,
      route: plan.route
    }),
    communityRipplePlan: plan.communityRipplePlan || {},
    wrongCauseViralChallengePack: plan.wrongCauseViralChallengePack || {},
    peerRelayChallengeLadder: plan.peerRelayChallengeLadder || buildPeerRelayChallengeLadder({
      firstStep: plan.safeRelayChallengePacket && plan.safeRelayChallengePacket.starterAction,
      route: plan.route
    }),
    peerRelaySeasonArc: plan.peerRelaySeasonArc || {},
    copyableChallengeTemplates: plan.copyableChallengeTemplates || [],
    localSpreadReleaseGate: plan.localSpreadReleaseGate || {},
    visualRelayProtocol,
    visualRelayProofChecklist,
    visualRelayBoundary: '社区小黑板接力只传第一步、复刻动作、家长检查和回访安排；不传原题、答案、分数、排名或完整对话。',
    relayEvidenceCount,
    receiverCompletionCount,
    challengeCompletions,
    returnRateLabel,
    receiverCompletionLine: receiverCompletionCount
      ? `接收者已用自己的材料完成 ${receiverCompletionCount} 次第一步回写，已写入分享/回流证据。`
      : '接收者还需用自己的材料完成 1 次第一步回写，才算接力闭环。',
    lanes,
    recentRuns: recentRuns.map((item) => ({
      id: item.id || item.share_code || item.code,
      label: item.share_intent || item.type || 'share',
      code: item.share_code || item.code || '',
      evidence: item.path || item.title || '分享/回流记录'
    })),
    actions: plan.shareRelayActions || [],
    contractLine: plan.evidenceContractLine,
    returnPathLine: Array.isArray(plan.returnPathContract)
      ? plan.returnPathContract.map((item) => `${item.label}:${item.text}`).join(' / ')
      : ''
  };
}

function buildQuestionBankShareRelayDeck(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const courseUnitQuestionBank = options.courseUnitQuestionBank || buildCourseUnitQuestionBank({ courseUnitMap });
  const weeklyEvidenceFlywheel = options.weeklyEvidenceFlywheel || buildWeeklyEvidenceFlywheel({
    courseUnitMap,
    courseUnitQuestionBank
  });
  const communityShareRelayBoard = options.communityShareRelayBoard || buildCommunityShareRelayBoard(options);
  const activeCards = courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.activeCards)
    ? courseUnitQuestionBank.activeCards
    : [];
  const sourceCards = activeCards.length
    ? activeCards
    : (courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.cards) ? courseUnitQuestionBank.cards.slice(0, 5) : []);
  const reviewWindows = [
    { id: 'tonight', label: '今晚', action: '只做 3 张主动回忆卡，必须说出第一步。' },
    { id: 'tomorrow', label: '明天', action: '只回访 1 张最不稳的卡，不增加题量。' },
    { id: 'day_7', label: '第 7 天', action: '用 1 道小变式验证迁移，不看单次分数。' }
  ];
  const relayCards = sourceCards.slice(0, 5).map((card, index) => ({
    id: card.id || `question_bank_share_${index + 1}`,
    label: card.label || `题型接力卡 ${index + 1}`,
    subjectLabel: card.subjectLabel || '',
    type: card.type || 'active_recall',
    challengePrompt: card.prompt || card.sampleStem || '用自己的材料说出第一步。',
    firstStep: card.firstStepHint || (card.progression && card.progression.entryTask) || '先说出第一步。',
    visualMove: card.visualMove || '在小黑板只画第一笔，不展开完整答案。',
    parentCheck: card.progression && card.progression.masteryGate
      ? card.progression.masteryGate
      : '家长只看孩子能否自己说出第一步。',
    shareCopy: `接力「${card.label || '题型卡'}」：用自己的材料说第一步，不晒原题和答案。`,
    route: '/pages/arcade/arcade?from=question_bank_relay',
    evidenceRequired: [card.evidenceRequired || 'child_first_step', 'active_recall_done', 'next_day_revisit']
  }));
  const allowedFields = ['subjectLabel', 'type', 'firstStep', 'reviewWindow', 'parentCheck', 'route'];
  const blockedFields = ['original_photo', 'full_dialogue', 'score', 'ranking', 'private_comment', 'original_answer'];
  return {
    id: 'question_bank_share_relay_deck',
    title: '题型题库接力牌组',
    status: relayCards.length >= 3 ? 'ready' : 'waiting_question_bank',
    questionCardCount: Number(courseUnitQuestionBank && (courseUnitQuestionBank.questionCount || courseUnitQuestionBank.cards && courseUnitQuestionBank.cards.length) || 0),
    activeRelayCount: relayCards.length,
    relayCards,
    reviewWindows,
    gameRule: '游戏只抽题型卡做主动回忆、错因回放和近迁移；没有第一步证据不发 XP。',
    parentDecisionLine: '家长只判断三件事：第一步是否能说出、错因是否复现、明天是否能回访。',
    reportLine: `报告把 ${relayCards.length} 张题型接力卡写入本周证据，不用单次分数更新长期画像。`,
    shareLine: '分享只带题型、第一步、回访窗口和家长检查句，不带原题照片、完整对话、分数或排名。',
    communityLine: communityShareRelayBoard && communityShareRelayBoard.noRankingLine
      ? communityShareRelayBoard.noRankingLine
      : '社区接力不排行、不晒分，只复用学习动作。',
    weeklyLine: weeklyEvidenceFlywheel && weeklyEvidenceFlywheel.memoryLine
      ? weeklyEvidenceFlywheel.memoryLine
      : '主动回忆、错因回放、间隔回看形成记忆反馈。',
    safeSharePayload: {
      allowed_fields: allowedFields,
      blocked_fields: blockedFields,
      relay_card_count: relayCards.length,
      review_windows: reviewWindows.map((item) => item.id)
    },
    evidenceRequired: ['question_bank_card', 'active_recall_done', 'wrong_cause_return', 'next_day_revisit', 'safe_share_payload', 'parent_check_line']
  };
}

function buildQuestionBankVisualShareRelayDeck(options = {}) {
  const questionBankShareRelayDeck = options.questionBankShareRelayDeck || buildQuestionBankShareRelayDeck(options);
  const relayCards = questionBankShareRelayDeck && Array.isArray(questionBankShareRelayDeck.relayCards)
    ? questionBankShareRelayDeck.relayCards
    : [];
  const activeCard = relayCards[0] || {};
  const boardLayers = [
    {
      id: 'locate',
      label: '定位',
      drawAction: activeCard.visualMove || '小黑板只画题目问什么，不抄原题答案。',
      studentLine: activeCard.firstStep || '我先说出第一步。'
    },
    {
      id: 'wrong_cause',
      label: '错因',
      drawAction: '只标出卡住点：看错条件、不会建模、步骤跳过。',
      studentLine: activeCard.challengePrompt || '我说出自己卡在哪里。'
    },
    {
      id: 'revisit',
      label: '回访',
      drawAction: '明天只换一个同类小变式，确认方法能不能迁移。',
      studentLine: '我用自己的材料再说一次第一步。'
    }
  ];
  const exitCriteria = [
    activeCard.parentCheck || '孩子能自己说出第一步。',
    '不看完整答案也能指出卡住点。',
    '明天能用同类小变式复述一次。'
  ];
  const blockedFields = ['original_photo', 'full_dialogue', 'score', 'ranking', 'private_comment', 'original_answer'];
  return {
    id: 'question_bank_visual_share_relay_deck',
    title: '题型小黑板接力卡',
    status: boardLayers.length >= 3 && exitCriteria.length >= 3 ? 'ready' : 'needs_visual_layers',
    relayTitle: activeCard.label || '同类题型第一步',
    route: activeCard.route || '/pages/arcade/arcade?from=visual_board_relay',
    boardLayers,
    relayLayer: boardLayers[0].label,
    studentLine: boardLayers[0].studentLine,
    parentLine: activeCard.parentCheck || '家长只看孩子能不能复述第一步，不追问完整答案。',
    exitCriteria,
    exitLine: exitCriteria[0],
    shareBoundary: '小黑板分享只带题型、第一步、卡住点、家长检查句和回访窗口；不带原题、答案、分数、排名或完整对话。',
    allowedFields: ['relayTitle', 'relayLayer', 'studentLine', 'parentLine', 'exitLine', 'route'],
    blockedFields,
    safeQuery: {
      visual_board_relay_title: activeCard.label || '同类题型第一步',
      visual_board_relay_layer: boardLayers[0].drawAction,
      visual_board_relay_student_line: boardLayers[0].studentLine,
      visual_board_relay_parent_line: activeCard.parentCheck || '家长只看孩子能不能复述第一步，不追问完整答案。',
      visual_board_relay_exit: exitCriteria[0],
      visual_board_relay_route: activeCard.route || '/pages/arcade/arcade?from=visual_board_relay',
      visual_board_relay_boundary: '不带原题、答案、分数、排名或完整对话'
    },
    evidenceRequired: ['question_type_visual_board', 'child_first_step', 'parent_check_line', 'safe_share_payload', 'next_day_revisit']
  };
}

function relayText(value, fallback = '') {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim() || fallback;
}

function inferReceiverChallengeType(incoming = {}) {
  const text = [
    incoming.question_bank_relay_label,
    incoming.wrong_cause_label,
    incoming.capability_gap,
    incoming.challenge_goal,
    incoming.course_unit_label,
    incoming.relay_receiver_action,
    incoming.source_challenge_prompt
  ].filter(Boolean).join(' ');
  if (/方程|等量|应用题|数量|单位|几何|函数|数学/.test(text)) return 'math_first_step';
  if (/阅读|作文|文言|语文|关键词|证据句/.test(text)) return 'chinese_evidence';
  if (/英语|单词|语法|句子|时态/.test(text)) return 'english_sentence';
  if (/物理|受力|电路|光路|压强|浮力|变量/.test(text)) return 'physics_diagram';
  if (/化学|实验|反应|溶液|气体|酸碱/.test(text)) return 'chemistry_experiment';
  if (/生物|结构|功能|生态|遗传|过程/.test(text)) return 'biology_process';
  if (/地理|地图|经纬|气候|地形/.test(text)) return 'geography_map';
  return 'same_type_first_step';
}

function buildReceiverOwnMaterialChallenge(incoming = {}) {
  const shareCode = incoming.share_code || incoming.code || '';
  const taskType = inferReceiverChallengeType(incoming);
  const label = relayText(
    incoming.question_bank_relay_label || incoming.wrong_cause_label || incoming.capability_label || incoming.course_unit_label,
    '同题型第一步挑战'
  );
  const receiverAction = relayText(
    incoming.relay_receiver_action || incoming.wrong_cause_receiver_action || incoming.source_challenge_prompt,
    `打开自己的作业，找一题和「${label}」相似的题，只说第一步。`
  );
  const parentCheck = relayText(
    incoming.relay_parent_check || incoming.wrong_cause_parent_check || incoming.question_bank_relay_parent_check,
    '家长只听孩子自己的第一步，不看发送者答案，也不追完整过程。'
  );
  const nextRevisit = relayText(
    incoming.relay_next_revisit || incoming.wrong_cause_next_revisit || incoming.relay_review,
    '明天用接收者自己的材料再说一次第一步。'
  );
  const firstStepHint = relayText(
    incoming.question_bank_relay_first_step || incoming.visual_board_relay_student_line || incoming.challenge_goal,
    '先说题目要你找什么，再说第一步看哪里。'
  );
  const route = `/pages/tutor/tutor?from=receiver_own_material&share=${encodeURIComponent(shareCode)}&task_type=${encodeURIComponent(taskType)}&relay_label=${encodeURIComponent(label)}&receiver_action=${encodeURIComponent(receiverAction)}&parent_check=${encodeURIComponent(parentCheck)}&next_revisit=${encodeURIComponent(nextRevisit)}`;
  return {
    id: 'receiver_own_material_challenge',
    title: '用自己的题接力',
    status: shareCode ? 'ready' : 'waiting_share_code',
    taskType,
    label,
    route,
    receiverAction,
    firstStepHint,
    parentCheck,
    nextRevisit,
    completionRoute: incoming.relay_return_path || incoming.question_bank_relay_route || incoming.wrong_cause_return_path || '/pages/review/review?from=receiver_own_material',
    evidenceContract: {
      required: ['receiver_own_material', 'receiver_own_first_step', 'receiver_own_wrong_cause', 'receiver_next_revisit'],
      senderFirstStepNotAccepted: true,
      completionEvent: 'share_relay_receiver_completion',
      localCodeOwns: ['route', 'required_evidence', 'blocked_fields', 'completion_gate'],
      aiMayRewrite: ['receiver_prompt_copy', 'parent_check_copy'],
      aiMustNotOwn: ['sender_payload_reuse', 'final_answer', 'xp_release', 'share_fields']
    },
    allowedFields: ['share_code', 'task_type', 'relay_label', 'receiver_action', 'parent_check', 'next_revisit'],
    blockedFields: ['original_question', 'original_answer', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue'],
    shareBoundary: '接收者必须使用自己的作业材料完成第一步挑战；不复用发送者原题、答案、照片、分数、排名或完整对话。'
  };
}

function saveIncomingShare(share = {}) {
  const normalized = shareRelaySchema.parseShareRelayQuery ? shareRelaySchema.parseShareRelayQuery(share) : share;
  const code = normalized.share_code || normalized.code || '';
  if (!code) return null;
  const parentNextAction = normalized.parent_next_action || normalized.action || '';
  const record = {
    code,
    share_code: code,
    from: normalized.from || '',
    challenge: normalized.challenge || '',
    mode: normalized.mode || '',
    identity_tag: normalized.identity_tag || normalized.identity || '',
    parent_next_action: parentNextAction,
    action_label: normalized.action_label || parentNextActionLabel(parentNextAction),
    action_detail: normalized.action_detail || parentNextActionDetail(parentNextAction),
    capability_gap: normalized.capability_gap || '',
    capability_label: normalized.capability_label || '',
    capability_next_action: normalized.capability_next_action || '',
    capability_route: normalized.capability_route || '',
    challenge_goal: normalized.challenge_goal || '',
    challenge_rule: normalized.challenge_rule || '',
    challenge_route: normalized.challenge_route || '',
    relay_privacy: normalized.relay_privacy || '',
    relay_review: normalized.relay_review || '',
    relay_first_step: normalized.relay_first_step || '',
    relay_invite_line: normalized.relay_invite_line || '',
    relay_receiver_prompt: normalized.relay_receiver_prompt || '',
    relay_parent_reassurance: normalized.relay_parent_reassurance || '',
    relay_day7_return: normalized.relay_day7_return || '',
    relay_proof_signal: normalized.relay_proof_signal || '',
    relay_guardrail: normalized.relay_guardrail || '',
    relay_id: normalized.relay_id || '',
    relay_receiver_action: normalized.relay_receiver_action || '',
    relay_parent_check: normalized.relay_parent_check || '',
    relay_next_revisit: normalized.relay_next_revisit || '',
    relay_allowed_fields: normalized.relay_allowed_fields || '',
    relay_blocked_fields: relayBlockedFieldLine(normalized.relay_blocked_fields),
    relay_completion_signal: normalized.relay_completion_signal || '',
    relay_return_path: normalized.relay_return_path || '',
    relay_ladder: normalized.relay_ladder || '',
    relay_attraction_hook: normalized.relay_attraction_hook || '',
    relay_local_gate: normalized.relay_local_gate || '',
    relay_spread_status: normalized.relay_spread_status || '',
    relay_spread_score: normalized.relay_spread_score || '',
    relay_spread_line: normalized.relay_spread_line || '',
    relay_spread_fallback: normalized.relay_spread_fallback || '',
    relay_spread_reason: normalized.relay_spread_reason || '',
    relay_spread_required: normalized.relay_spread_required || '',
    relay_season: normalized.relay_season || '',
    relay_season_status: normalized.relay_season_status || '',
    relay_season_line: normalized.relay_season_line || '',
    relay_season_days: normalized.relay_season_days || '',
    relay_season_gate: normalized.relay_season_gate || '',
    course_unit_label: normalized.course_unit_label || '',
    course_unit_subject: normalized.course_unit_subject || '',
    course_unit_tier: normalized.course_unit_tier || '',
    course_unit_parent_decision: normalized.course_unit_parent_decision || '',
    course_unit_report_contract: normalized.course_unit_report_contract || '',
    course_unit_share_contract: normalized.course_unit_share_contract || '',
    course_unit_blackboard: normalized.course_unit_blackboard || '',
    course_unit_recall_route: normalized.course_unit_recall_route || '',
    course_unit_game_route: normalized.course_unit_game_route || '',
    question_bank_relay_label: normalized.question_bank_relay_label || '',
    question_bank_relay_first_step: normalized.question_bank_relay_first_step || '',
    question_bank_relay_parent_check: normalized.question_bank_relay_parent_check || '',
    question_bank_relay_route: normalized.question_bank_relay_route || '',
    question_bank_relay_boundary: normalized.question_bank_relay_boundary || '',
    visual_board_relay_title: normalized.visual_board_relay_title || '',
    visual_board_relay_layer: normalized.visual_board_relay_layer || '',
    visual_board_relay_student_line: normalized.visual_board_relay_student_line || '',
    visual_board_relay_parent_line: normalized.visual_board_relay_parent_line || '',
    visual_board_relay_exit: normalized.visual_board_relay_exit || '',
    visual_board_relay_route: normalized.visual_board_relay_route || '',
    visual_board_relay_boundary: normalized.visual_board_relay_boundary || '',
    socratic_report_status: normalized.socratic_report_status || '',
    socratic_report_action: normalized.socratic_report_action || '',
    socratic_report_decision: normalized.socratic_report_decision || '',
    socratic_report_no_increase: normalized.socratic_report_no_increase || '',
    socratic_report_parent_proof: normalized.socratic_report_parent_proof || '',
    socratic_report_boundary: normalized.socratic_report_boundary || '',
    tonight_decision: normalized.tonight_decision || '',
    tonight_parent_question: normalized.tonight_parent_question || '',
    tonight_tomorrow: normalized.tonight_tomorrow || '',
    tonight_release_gate: normalized.tonight_release_gate || '',
    tonight_share_boundary: normalized.tonight_share_boundary || '',
    source_challenge_count: normalized.source_challenge_count || '',
    source_challenge_first: normalized.source_challenge_first || '',
    source_challenge_prompt: normalized.source_challenge_prompt || '',
    source_challenge_license: normalized.source_challenge_license || '',
    source_challenge_decision: normalized.source_challenge_decision || '',
    source_challenge_local_rule: normalized.source_challenge_local_rule || '',
    source_challenge_blocked: normalized.source_challenge_blocked || '',
    source_challenge_route: normalized.source_challenge_route || '',
    wrong_cause_pack: normalized.wrong_cause_pack || '',
    wrong_cause_label: normalized.wrong_cause_label || '',
    wrong_cause_first_step: normalized.wrong_cause_first_step || '',
    wrong_cause_parent_check: normalized.wrong_cause_parent_check || '',
    wrong_cause_receiver_action: normalized.wrong_cause_receiver_action || '',
    wrong_cause_next_revisit: normalized.wrong_cause_next_revisit || '',
    wrong_cause_allowed_fields: normalized.wrong_cause_allowed_fields || '',
    wrong_cause_blocked_fields: relayBlockedFieldLine(normalized.wrong_cause_blocked_fields),
    wrong_cause_return_path: normalized.wrong_cause_return_path || '',
    wrong_cause_gate: normalized.wrong_cause_gate || '',
    openmaic_bridge_status: normalized.openmaic_bridge_status || '',
    openmaic_next_action: normalized.openmaic_next_action || '',
    openmaic_share_boundary: normalized.openmaic_share_boundary || '',
    openmaic_game_gate: normalized.openmaic_game_gate || '',
    openmaic_blocked_fields: relayBlockedFieldLine(normalized.openmaic_blocked_fields),
    openmaic_evidence: normalized.openmaic_evidence || '',
    openmaic_return_path: normalized.openmaic_return_path || '',
    receiver_material_required: normalized.receiver_material_required || 'receiver_own_material',
    receiver_first_step_required: normalized.receiver_first_step_required || 'receiver_own_first_step',
    receiver_wrong_cause_required: normalized.receiver_wrong_cause_required || 'receiver_own_wrong_cause',
    receiver_revisit_required: normalized.receiver_revisit_required || 'receiver_next_revisit_evidence',
    receiver_evidence_contract: normalized.receiver_evidence_contract || 'own_material_first_step_wrong_cause_revisit',
    created_at: normalized.created_at || new Date().toISOString()
  };
  const receiverOwnChallenge = buildReceiverOwnMaterialChallenge(record);
  record.receiver_own_challenge_status = receiverOwnChallenge.status;
  record.receiver_own_challenge_route = receiverOwnChallenge.route;
  record.receiver_own_challenge_label = receiverOwnChallenge.label;
  record.receiver_own_challenge_task_type = receiverOwnChallenge.taskType;
  record.receiver_own_challenge_action = receiverOwnChallenge.receiverAction;
  record.receiver_own_challenge_parent_check = receiverOwnChallenge.parentCheck;
  record.receiver_own_challenge_next_revisit = receiverOwnChallenge.nextRevisit;
  record.receiver_own_challenge_boundary = receiverOwnChallenge.shareBoundary;
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
  appendShareFollowUpQueue(record);
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

function loadShareFollowUpQueue() {
  return get(KEYS.shareFollowUpQueue, []);
}

function appendShareFollowUpQueue(record = {}) {
  const shareCode = record.share_code || record.code || '';
  if (!shareCode) return loadShareFollowUpQueue();
  const queue = loadShareFollowUpQueue();
  const nextAction = record.type === 'invite_parent_view'
    ? '明天只问一句：孩子第一步先看哪里？'
    : '明天回看一张同类卡，先说第一步再核对。';
  const followUp = {
    id: `follow_${record.id || shareCode}`,
    share_code: shareCode,
    source_type: record.type || 'share_run',
    share_intent: record.share_intent || '',
    due: 'tomorrow',
    action: nextAction,
    route: `/pages/review/review?from=share_follow_up&share=${encodeURIComponent(shareCode)}`,
    evidence_contract: '只记录接力码、下一步和回访动作；不带原题、答案、分数或排名。',
    created_at: record.created_at || new Date().toISOString()
  };
  const next = [followUp]
    .concat(queue.filter((item) => item && item.id !== followUp.id && item.share_code !== shareCode))
    .slice(0, 40);
  set(KEYS.shareFollowUpQueue, next);
  appendSyncMutation('share_follow_up', followUp);
  return next;
}

function recordShareRelayCompletion(input = {}) {
  const incoming = input.incomingShare || loadIncomingShare() || {};
  const shareCode = input.share_code || incoming.share_code || incoming.code || '';
  if (!shareCode) return null;
  const senderFirstSteps = [
    incoming.relay_first_step,
    incoming.question_bank_relay_first_step,
    incoming.wrong_cause_first_step,
    incoming.visual_board_relay_student_line
  ].filter(Boolean);
  const rawFirstStep = input.receiverFirstStep || input.childFirstStep || input.firstStep || '';
  const firstStep = senderFirstSteps.includes(rawFirstStep)
    ? 'receiver_own_first_step_required'
    : relayOwnMaterialValue(rawFirstStep, 'receiver_own_first_step_required');
  const wrongCause = relayOwnMaterialValue(input.receiverWrongCause || input.wrongCause, incoming.wrong_cause_label || incoming.capability_gap || 'receiver_own_wrong_cause_required');
  const receiverMaterial = relayOwnMaterialValue(input.receiverMaterial || input.materialEvidence, 'receiver_own_material_required');
  const nextRevisit = relayOwnMaterialValue(input.nextRevisit || input.revisitEvidence, incoming.relay_next_revisit || incoming.wrong_cause_next_revisit || 'receiver_next_revisit_required');
  const route = input.route || incoming.relay_return_path || incoming.question_bank_relay_route || incoming.wrong_cause_return_path || '/pages/review/review';
  const blockedFields = relayBlockedFieldLine(incoming.relay_blocked_fields || incoming.wrong_cause_blocked_fields || incoming.openmaic_blocked_fields);
  const evidenceContract = {
    required: ['receiver_material', 'first_step', 'wrong_cause', 'next_revisit'],
    receiver_material: receiverMaterial,
    first_step: firstStep,
    wrong_cause: wrongCause,
    next_revisit: nextRevisit,
    review_evidence: 'share_relay_receiver_completion',
    event_evidence: 'share_relay_receiver_completion',
    sync_evidence: 'share_run_and_review_event_mutations',
    openmaic_bridge_status: incoming.openmaic_bridge_status || '',
    openmaic_next_action: incoming.openmaic_next_action || '',
    openmaic_game_gate: incoming.openmaic_game_gate || ''
  };
  const relayQualityScore = buildRelayQualityScore({
    receiverMaterial,
    firstStep,
    wrongCause,
    nextRevisit,
    blockedFields,
    senderFirstSteps
  });
  const completionReady = relayQualityScore.checks
    .filter((item) => ['receiver_own_material', 'receiver_own_first_step', 'receiver_wrong_cause', 'next_day_revisit'].includes(item.id))
    .every((item) => item.pass);
  if (!completionReady) {
    const attempted = {
      share_code: shareCode,
      type: 'share_relay_receiver_attempted_needs_receiver_evidence',
      title: input.title || 'receiver relay needs own evidence',
      path: route,
      share_intent: 'receiver_own_material_first_step',
      payload: {
        role: 'receiver',
        receiver_material: receiverMaterial,
        first_step: firstStep,
        wrong_cause: wrongCause,
        next_revisit: nextRevisit,
        relay_quality_score: relayQualityScore.score,
        relay_quality_level: relayQualityScore.level,
        relay_quality_line: relayQualityScore.line,
        relay_quality_checks: relayQualityScore.checks,
        evidence_contract: evidenceContract,
        allowed_fields: SHARE_RELAY_ALLOWED_FIELDS,
        blocked_fields: blockedFields,
        source: 'incoming_share_attempt_needs_evidence'
      }
    };
    appendShareRun(attempted);
    appendReviewEvent({
      type: 'share_relay_receiver_attempted_needs_receiver_evidence',
      event: 'share_relay_receiver_attempted_needs_receiver_evidence',
      result: 'needs_receiver_evidence',
      card_id: `share_relay_${shareCode}`,
      weakPoint: wrongCause || firstStep,
      firstStep,
      wrongCause,
      route,
      share_code: shareCode,
      receiverMaterial,
      nextRevisit,
      relayQualityScore,
      evidenceContract
    });
    return loadShareRuns()[0];
  }
  const record = {
    share_code: shareCode,
    type: 'share_relay_receiver_completion',
    title: input.title || 'receiver completed own-material first step',
    path: route,
    share_intent: 'receiver_own_material_first_step',
    payload: {
      role: 'receiver',
      relay_id: input.relayId || incoming.relay_id || '',
      receiver_material: receiverMaterial,
      first_step: firstStep,
      wrong_cause: wrongCause,
      receiver_action: input.receiverAction || incoming.relay_receiver_action || incoming.wrong_cause_receiver_action || '',
      parent_check: input.parentCheck || incoming.relay_parent_check || incoming.wrong_cause_parent_check || '',
      next_revisit: nextRevisit,
      evidence: input.evidence || 'receiver_own_material_first_step_wrong_cause_revisit',
      relay_quality_score: relayQualityScore.score,
      relay_quality_level: relayQualityScore.level,
      relay_quality_line: relayQualityScore.line,
      relay_quality_checks: relayQualityScore.checks,
      evidence_contract: evidenceContract,
      allowed_fields: SHARE_RELAY_ALLOWED_FIELDS,
      blocked_fields: blockedFields,
      source: 'incoming_share_completion'
    }
  };
  appendShareRun(record);
  appendReviewEvent({
    type: 'share_relay_receiver_completion',
    event: 'share_relay_receiver_completion',
    result: 'completed',
    rating: 'good',
    card_id: `share_relay_${shareCode}`,
    weakPoint: wrongCause || firstStep,
    firstStep,
    wrongCause,
    route,
    share_code: shareCode,
    receiverMaterial,
    nextRevisit,
    relayQualityScore,
    evidenceContract
  });
  return loadShareRuns()[0];
}

function buildRelayQualityScore(input = {}) {
  const firstStep = String(input.firstStep || '');
  const wrongCause = String(input.wrongCause || '');
  const receiverMaterial = String(input.receiverMaterial || '');
  const nextRevisit = String(input.nextRevisit || '');
  const senderFirstSteps = Array.isArray(input.senderFirstSteps) ? input.senderFirstSteps.filter(Boolean) : [];
  const blockedFields = Array.isArray(input.blockedFields) ? input.blockedFields : [];
  const checks = [
    {
      id: 'receiver_own_material',
      label: '接收者使用自己的材料',
      pass: !!receiverMaterial && !/required|发送者|sender/.test(receiverMaterial)
    },
    {
      id: 'receiver_own_first_step',
      label: '接收者写出自己的第一步',
      pass: !!firstStep && !/required|sender/.test(firstStep) && !senderFirstSteps.includes(firstStep)
    },
    {
      id: 'receiver_wrong_cause',
      label: '接收者说出自己的错因',
      pass: !!wrongCause && !/required|sender/.test(wrongCause)
    },
    {
      id: 'next_day_revisit',
      label: '锁定明天回访',
      pass: !!nextRevisit && !/required/.test(nextRevisit)
    },
    {
      id: 'privacy_safe',
      label: '不奖励转发量、分数、排名或答案',
      pass: blockedFields.includes('score') || blockedFields.includes('ranking') || blockedFields.includes('full_answer')
    }
  ];
  const score = checks.reduce((sum, item) => sum + (item.pass ? 20 : 0), 0);
  const level = score >= 80 ? 'strong' : score >= 60 ? 'usable' : 'weak';
  return {
    id: 'relay_quality_score',
    score,
    level,
    checks,
    rewardPolicy: '只奖励自有材料、第一步、错因和回访证据；不奖励转发量、分数、排名或答案。',
    line: level === 'strong'
      ? '接力有效：对方用了自己的材料，并留下第一步、错因和明天回访。'
      : level === 'usable'
        ? '接力可用：已有部分自有证据，还需要补齐第一步/错因/回访。'
        : '接力未放行：不能靠转发或复制发送者内容获得学习记录。'
  };
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

function buildProductReadiness(options = {}) {
  if (!productReadiness || !productReadiness.buildProductReadiness) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      score: 0,
      verdict: 'unavailable',
      friendTrialReady: false,
      commercialCodeReady: false,
      launchBlockedByExternalConfig: true,
      dimensions: [],
      workflow: [],
      gaps: [{ id: 'readiness_engine', label: 'readiness engine', fix: 'Product readiness evaluator is unavailable.' }],
      externalBlockers: []
    };
  }
  return productReadiness.buildProductReadiness(module.exports, options);
}

function buildAcceptanceReport(options = {}) {
  const readiness = buildProductReadiness(options);
  if (!productReadiness || !productReadiness.buildAcceptanceReport) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      overallConclusion: 'fail',
      localReadinessScore: readiness.score || 0,
      friendTrialReady: false,
      commercialCodeReady: false,
      launchBlockedByExternalConfig: true,
      competitiveGapSummary: [],
      functionalityChecklist: [],
      storyLoop: [],
      workflowBreakpoints: [],
      technicalBreakpoints: [],
      friendTrialRisk: [{ risk: 'high', scenario: 'acceptance report unavailable', description: 'readiness report generator is unavailable', mitigation: 'restore product-readiness module' }],
      fixPriorityQueue: [{ priority: 'P0', owner: 'code', id: 'acceptance_report', action: 'restore product readiness acceptance report generator' }],
      finalRecommendation: 'fix_local_p0_before_friend_trial'
    };
  }
  return productReadiness.buildAcceptanceReport(readiness, options);
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
  const normalized = normalizeTaskType(type);
  return {
    math_word_problem: '数学应用题',
    equation_setup: '列方程',
    reading_question: '阅读题',
    english_sentence: '英语句子',
    physics_diagram: '物理图解',
    chemistry_experiment: '化学实验',
    biology_process: '生物过程',
    geography_map: '地理读图',
    writing_process: '写作',
    dictation: '听写',
    daily_math: '口算',
    light_diagnosis: '手动选题型',
    unknown: '当前题型'
  }[normalized] || '当前题型';
}

function deepScaffoldingTemplates(type = 'unknown') {
  const normalized = normalizeTaskType(type);
  const map = {
    math_word_problem: ['先把题干里的已知条件圈出来。', '现在把两个条件连起来，问一句：它们有什么关系？', '最后再想：这个关系能不能写成一个式子？'],
    equation_setup: ['先把未知数写成 x。', '再找一句能表示相等关系的话。', '最后把两边分别写出来，不急着算。'],
    reading_question: ['先看题目问的是细节、主旨还是原因。', '再回到对应段落，找到题目里重复或相近的词。', '最后用自己的话说出这一句为什么相关。'],
    english_sentence: ['先找主语和谓语。', '再看动作发生在什么时候。', '最后看句子里有没有固定结构或连接词。'],
    physics_diagram: ['先定研究对象。', '再画第一根方向、力或状态标记。', '最后说这一笔对应哪条规律。'],
    chemistry_experiment: ['先列反应前后物质。', '再说看到的现象来自哪里。', '最后检查守恒或实验条件。'],
    biology_process: ['先找结构。', '再说结构对应的功能。', '最后把过程排成三步。'],
    geography_map: ['先看方向和图例。', '再定位区域特征。', '最后说第一条原因链。'],
    writing_process: ['先写一句最简单的开头。', '再补一个具体例子或画面。', '最后检查这一段是不是围绕同一个意思。'],
    dictation: ['先听清第一个词。', '再确认你先看的是拼音、字形还是意思。', '最后把不确定的那一笔圈出来。'],
    daily_math: ['先看清符号。', '再看有没有进位或退位。', '最后只检查这一步，不急着重做整题。'],
    light_diagnosis: ['先判断这道题像哪一类。', '再圈出题目真正问的内容。', '最后只写准备开始的第一步。'],
    unknown: ['先说清楚题目问什么。', '再找一个能下手的位置。', '最后把这一步写成一句话。']
  };
  return (map[normalized] || map.unknown).slice();
}

function buildSecondStepHint(type = 'unknown', firstStep = '') {
  const normalized = normalizeTaskType(type);
  const steps = deepScaffoldingTemplates(type);
  return {
    taskType: normalized,
    firstStep: firstStep || steps[0],
    secondStep: steps[1],
    thirdStep: steps[2],
    boundary: '这不是答案，是下一小步提示。'
  };
}

function updateTaskTypePatternForEvent(event = {}) {
  const type = normalizeTaskType(event.taskType || 'unknown', event.subject || '');
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

function ensureFocusReviewCard(record = {}, options = {}) {
  if (!record || !loadReviewCards || !saveReviewCards) return null;
  const target = record.focusTarget || {};
  const focusId = target.focusId || record.id || record.startedAt || Date.now();
  const safeId = String(focusId).replace(/[^\w-]+/g, '_').slice(0, 80);
  const cardId = `focus_review_${safeId}`;
  const cards = loadReviewCards();
  const existing = cards.find((card) => card && card.id === cardId);
  if (existing) return existing;
  const firstStep = record.linkedChildArticulatedStep || record.linkedSystemSuggestedStep || target.title || '先说昨天坐住的第一步。';
  const card = {
    id: cardId,
    type: 'focus_cabin_return',
    source: 'focus',
    title: '专注舱明天回访',
    question: `遮住答案，先说昨天那一步：${firstStep}`,
    answer: '',
    weakPoint: target.title || record.linkedStuckPointText || '专注第一步',
    firstStep,
    revisit: '明天只确认第一步是否还说得出，再决定是否进入第二步。',
    due: true,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    releaseGate: 'focus_first_step_recalled_before_second_step',
    blockedFields: ['score', 'ranking', 'full_answer'],
    focusEvidence: {
      completionType: record.completionType || '',
      completedSeconds: record.completedSeconds || record.actualFocusSeconds || 0,
      taskBound: !!record.taskBound
    },
    nextRoute: options.nextRoute || '/pages/review/review?from=focus_return'
  };
  saveReviewCards([card].concat(cards).slice(0, 80));
  appendReviewEvent({
    type: 'focus_review_card_created',
    cardId,
    source: 'focus',
    focusTitle: target.title || '',
    createdAt: new Date().toISOString()
  });
  appendSyncMutation('focus_review_card', {
    id: cardId,
    source: 'focus',
    release_gate: card.releaseGate,
    blocked_fields: card.blockedFields,
    next_route: card.nextRoute
  });
  return card;
}

function loadLightFeatureEvents() {
  const events = get(KEYS.lightFeatureEvents, []);
  return Array.isArray(events) ? events : [];
}

function buildLightFeatureEvidenceSummary(options = {}) {
  const events = loadLightFeatureEvents();
  const labels = {
    daily_math: '口算',
    dictation: '听写',
    light_diagnosis: '手动选题'
  };
  const byFeature = events.reduce((acc, event) => {
    const feature = event && event.feature ? event.feature : 'unknown';
    if (!acc[feature]) {
      acc[feature] = {
        id: feature,
        label: labels[feature] || taskTypeLabel(event && event.taskType) || '轻入口',
        count: 0,
        actionable: 0,
        latestStep: '',
        latestStuckPoint: '',
        latestAt: ''
      };
    }
    acc[feature].count += 1;
    if (event && (event.childStepQuality === 'actionable' || event.childStepQuality === 'partial')) {
      acc[feature].actionable += 1;
    }
    if (!acc[feature].latestAt || String(event && event.createdAt || '') > acc[feature].latestAt) {
      acc[feature].latestAt = event && event.createdAt || '';
      acc[feature].latestStep = event && (event.childArticulatedStep || event.systemSuggestedStep) || '';
      acc[feature].latestStuckPoint = event && event.stuckPointText || '';
    }
    return acc;
  }, {});
  const cards = Object.keys(byFeature).map((key) => byFeature[key])
    .sort((a, b) => b.count - a.count || String(b.latestAt).localeCompare(String(a.latestAt)));
  const total = events.length;
  const actionable = events.filter((event) => event && (event.childStepQuality === 'actionable' || event.childStepQuality === 'partial')).length;
  const top = cards[0] || null;
  const latest = events.slice().sort((a, b) => String(b && b.createdAt || '').localeCompare(String(a && a.createdAt || '')))[0] || null;
  return {
    title: '轻入口证据',
    ready: total > 0,
    total,
    actionable,
    featureCount: cards.length,
    cards,
    latest,
    summary: total
      ? `轻入口已留下 ${total} 条第一步记录，${actionable} 条能直接回到核心学习链路。`
      : '口算、听写和手动选题还没有留下第一步记录。',
    parentLine: top
      ? `${top.label}最近留下的第一步：${top.latestStep || top.latestStuckPoint || '先确认从哪里开始'}`
      : '先从口算、听写或手动选题里留下一条第一步。',
    nextAction: total
      ? '把最近一条轻入口记录带回修卡点或专注舱。'
      : '先完成一次口算、听写或手动选题。',
    route: top && top.id === 'dictation'
      ? '/pages/entry-detail/entry-detail?scene=today'
      : top && top.id === 'light_diagnosis'
        ? '/pages/entry-detail/entry-detail?scene=today'
        : '/pages/entry-detail/entry-detail?scene=today',
    generatedAt: options.now ? new Date(options.now).toISOString() : rcNowIso()
  };
}

const LIGHT_ENTRY_SEED_BANK = {
  daily_math: {
    label: '口算',
    route: '/pages/entry-detail/entry-detail?scene=today',
    taskSeeds: [
      { id: 'symbol_scan', label: '符号先看清', taskType: 'daily_math', wrongCause: '漏看符号', firstStep: '先圈加减乘除符号。' },
      { id: 'carry_check', label: '进退位检查', taskType: 'daily_math', wrongCause: '进退位漏掉', firstStep: '先标出需要进位或退位的位置。' },
      { id: 'estimate_guard', label: '估算护栏', taskType: 'daily_math', wrongCause: '结果量级不对', firstStep: '先估一个大概范围。' },
      { id: 'unit_place', label: '位值对齐', taskType: 'daily_math', wrongCause: '数位没对齐', firstStep: '先把个位、十位、小数点对齐。' },
      { id: 'reverse_check', label: '反向验算', taskType: 'daily_math', wrongCause: '算完不检查', firstStep: '先用反向运算验一遍。' }
    ]
  },
  dictation: {
    label: '听写',
    route: '/pages/entry-detail/entry-detail?scene=today',
    taskSeeds: [
      { id: 'sound_shape', label: '音形对应', taskType: 'dictation', wrongCause: '听到音但字形不稳', firstStep: '先说这个词最容易错的那一笔。' },
      { id: 'meaning_anchor', label: '意思锚点', taskType: 'dictation', wrongCause: '词义不清', firstStep: '先用这个词说一句短句。' },
      { id: 'repeat_rhythm', label: '复听节奏', taskType: 'dictation', wrongCause: '听一次就下笔', firstStep: '先听两遍，再写第一个字。' },
      { id: 'shape_part', label: '部件拆字', taskType: 'dictation', wrongCause: '偏旁部件混淆', firstStep: '先把这个字拆成偏旁和剩下部分。' },
      { id: 'sentence_memory', label: '句中记忆', taskType: 'dictation', wrongCause: '孤立背词不稳', firstStep: '先把词放进一句自己能说的话。' }
    ]
  },
  light_diagnosis: {
    label: '手动选题',
    route: '/pages/entry-detail/entry-detail?scene=today',
    taskSeeds: [
      { id: 'type_confirm', label: '先判题型', taskType: 'unknown', wrongCause: '题型没确认', firstStep: '先说这题像哪一类。' },
      { id: 'ask_sentence', label: '问题句定位', taskType: 'math_word_problem', wrongCause: '没看清问什么', firstStep: '先圈题目真正问的句子。' },
      { id: 'start_position', label: '下手位置', taskType: 'unknown', wrongCause: '第一步太大', firstStep: '先写一个能马上做的小动作。' },
      { id: 'known_unknown', label: '已知未知', taskType: 'equation_setup', wrongCause: '未知量没设清', firstStep: '先写清谁是未知数。' },
      { id: 'evidence_sentence', label: '证据句', taskType: 'reading_question', wrongCause: '回答没有依据', firstStep: '先找一句能支撑回答的原文。' }
    ]
  }
};

function buildLightEntrySeedBank(feature = 'daily_math', options = {}) {
  const bank = LIGHT_ENTRY_SEED_BANK[feature] || LIGHT_ENTRY_SEED_BANK.light_diagnosis;
  const events = loadLightFeatureEvents().filter((event) => !feature || event.feature === feature);
  const latest = events[0] || null;
  const seeds = bank.taskSeeds.map((seed, index) => {
    const depth = buildSubjectSkillDepth({
      taskType: seed.taskType,
      sourceText: seed.wrongCause,
      firstStep: seed.firstStep
    });
    return {
      id: `${feature}_${seed.id}`,
      order: index + 1,
      label: seed.label,
      taskType: seed.taskType,
      wrongCause: seed.wrongCause,
      firstStep: seed.firstStep,
      parentQuestion: depth.parentQuestion,
      evidenceRequired: depth.evidenceRequired,
      modelLine: `${taskTypeLabel(seed.taskType)} · ${seed.wrongCause}`,
      blackboardLine: `${bank.label}小黑板：${seed.label} -> ${seed.firstStep}`,
      evidenceLine: `留下 ${depth.evidenceRequired.slice(0, 2).join(' / ')} 证据`,
      loopLine: `完成后回到${feature === 'dictation' ? '听写回访' : feature === 'daily_math' ? '口算轻练' : '修卡点'}，再给家长看一句第一步。`,
      route: bank.route
    };
  });
  return {
    id: `light_seed_${feature}`,
    feature,
    label: bank.label,
    title: `${bank.label}题型种子`,
    summary: latest
      ? `最近记录会优先回到「${latest.childArticulatedStep || latest.systemSuggestedStep || latest.stuckPointText || bank.label}」。`
      : `先从 ${seeds.length} 个可复用小题型里选一个，留下第一步证据。`,
    seeds,
    reusableCount: seeds.length,
    modelLine: `${bank.label}已沉淀 ${seeds.length} 条题型 / 错因 / 第一动作模型。`,
    evidenceLine: '每条种子都会进入题型评测、错因卡、轻练习和家长复盘。',
    routeLine: `回流路线：${bank.label} -> 第一手证据 -> 修卡点 / 轻练习 -> 家长行动板。`,
    latestEvidence: latest,
    route: bank.route,
    nextAction: latest ? '带着最近第一步回到修卡点' : '先完成一条轻入口第一步'
  };
}

function buildSubjectSeedLibrary(options = {}) {
  const subjectIds = ['math', 'chinese', 'english', 'physics', 'chemistry', 'biology', 'geography'];
  const tiers = ['入门', '核心', '迁移'];
  const gradeBands = ['小学高段', '小初衔接', '初中'];
  const subjects = subjectIds.map((subjectId) => {
    const curriculum = CURRICULUM_SPINE[subjectId] || CURRICULUM_SPINE.math;
    const taskType = taskTypeForSubject(subjectId) || 'unknown';
    const depth = buildSubjectSkillDepth({
      taskType,
      subject: curriculum.label,
      firstStep: suggestedStepForTaskType(taskType),
      sourceText: `${curriculum.label} 七科第一步种子`
    });
    const seeds = curriculum.nodes.map((node, index) => {
      const firstStep = index === 0 ? depth.firstStep : `先处理「${node.label}」：${node.evidence}`;
      const wrongCause = index === 0 ? '不知道从哪里下手' : `${node.label}证据不足`;
      const evidenceRequired = index === 0 ? depth.evidenceRequired : [node.id, 'child_first_step', 'next_day_revisit'];
      const tier = tiers[index] || '迁移';
      const gradeBand = gradeBands[index] || '初中';
      return {
        id: `${subjectId}_${node.id}`,
        order: index + 1,
        tier,
        gradeBand,
        subjectId,
        subjectLabel: curriculum.label,
        label: node.label,
        taskType,
        firstStep,
        wrongCause,
        wrongCauseModel: `${curriculum.label}/${node.label}：先判是不是「${wrongCause}」，再只补一个可观察动作。`,
        parentQuestion: index === 0 ? depth.parentQuestion : `你能先说清「${node.label}」这一小步吗？`,
        parentCheckLine: `家长只检查：孩子是否能说出「${firstStep}」，不替孩子讲完整答案。`,
        evidenceRequired,
        evidenceContractLine: `证据契约：留下 ${evidenceRequired.slice(0, 2).join(' + ')}，明天回访同类一题。`,
        visualPrompt: `${curriculum.label}可视化：画出「${node.label}」和「${node.evidence}」的关系，不画最终答案。`,
        boardMove: `小黑板动作：先写「${node.label}」，旁边标一条证据「${node.evidence}」。`,
        blackboardLine: `${curriculum.label}小黑板：${node.label} -> ${node.evidence}`,
        transferPrompt: `迁移题：换一道同类题，仍然先做「${firstStep}」。`,
        recallPrompt: `主动回忆：合上题目，说出这张卡的错因和第一步。`,
        loopLine: `流转闭环：轻诊断 -> ${curriculum.route} -> 复习回访 -> 家长复盘。`,
        recallRoute: '/pages/review/review',
        gameRoute: '/pages/arcade/arcade',
        route: curriculum.route
      };
    });
    return {
      id: subjectId,
      label: curriculum.label,
      taskType,
      route: curriculum.route,
      depthLine: depth.reportSignal,
      visualBoundary: '只做第一步小黑板，不做全科自动板书讲题。',
      progressionLine: `${curriculum.label}按「入门-核心-迁移」三层沉淀，不追求大而全。`,
      seeds
    };
  });
  const activeSubject = options.subject ? String(options.subject) : '';
  const active = subjects.find((item) => item.id === activeSubject || item.label === activeSubject) || subjects[0];
  return {
    id: 'subject_seed_library',
    title: '七科第一步种子库',
    summary: '每科沉淀题型、错因模型、第一步小黑板、迁移题、回忆路线、家长检查和证据契约，不承诺自动给完整答案。',
    subjects,
    active,
    subjectCount: subjects.length,
    seedCount: subjects.reduce((sum, item) => sum + item.seeds.length, 0),
    nextAction: active ? `先选 ${active.label} 的一张第一步种子` : '先选一张第一步种子',
    generatedAt: options.now ? new Date(options.now).toISOString() : rcNowIso()
  };
}

function normalizeCourseBindingText(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function collectCourseBindingText(options = {}) {
  const parts = [
    options.subject,
    options.issueType,
    options.taskType,
    options.title,
    options.text,
    options.sourceText,
    options.stuckPointText,
    options.thought,
    options.childArticulatedStep,
    options.childStepSentence,
    options.systemSuggestedStep,
    options.suggestedFirstStep,
    options.firstStep,
    options.wrongCause,
    options.wrongCauseBucket,
    options.expectedWrongCause,
    options.expectedFirstStep,
    options.expectedBoardMove,
    options.parentCheck,
    options.nearTransfer
  ];
  const nested = [
    options.selected,
    options.selectedHomework,
    options.activeSample,
    options.pressureSample,
    options.todayFocus,
    options.loopFocus
  ];
  nested.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    [
      'id',
      'subject',
      'taskType',
      'title',
      'text',
      'stem',
      'sourceText',
      'stuckPointText',
      'thought',
      'expectedWrongCause',
      'expectedFirstStep',
      'expectedBoardMove',
      'parentCheck',
      'nearTransfer'
    ].forEach((key) => {
      if (item[key]) parts.push(item[key]);
    });
  });
  return parts.filter(Boolean).join(' ');
}

function scoreCourseUnitBinding(unit = {}, bindingText = '', activeTaskType = '', options = {}) {
  const normalizedActiveTaskType = normalizeTaskType(activeTaskType, options.subject || unit.subjectId || unit.subjectLabel || '');
  const normalizedUnitTaskType = normalizeTaskType(unit.taskType, unit.subjectId || unit.subjectLabel || options.subject || '');
  const raw = collectCourseBindingText(Object.assign({}, options, { text: bindingText }));
  const text = normalizeCourseBindingText(raw);
  const unitText = normalizeCourseBindingText([
    unit.id,
    unit.subjectId,
    unit.subjectLabel,
    unit.unitLabel,
    unit.taskType,
    unit.parentAction,
    unit.blackboardBlueprint && unit.blackboardBlueprint.firstStroke,
    unit.blackboardBlueprint && unit.blackboardBlueprint.visualPrompt,
    unit.practiceLoop && unit.practiceLoop.recall,
    unit.practiceLoop && unit.practiceLoop.repair,
    unit.practiceLoop && unit.practiceLoop.transfer,
    (unit.reusableQuestionTypes || []).join(' '),
    (unit.wrongCauseAtlas || []).join(' '),
    (unit.evidenceRequired || []).join(' ')
  ].filter(Boolean).join(' '));
  let score = 0;
  if (options.activeUnitId && unit.id === options.activeUnitId) score += 160;
  if (options.courseUnitId && unit.id === options.courseUnitId) score += 160;
  if (normalizedActiveTaskType && normalizedUnitTaskType === normalizedActiveTaskType) score += 80;
  if (options.subject && (unit.subjectId === options.subject || unit.subjectLabel === options.subject)) score += 40;
  if (text && unitText) {
    [
      '读题', '问题句', '条件', '单位', '建模', '关系', '等量', '方程', '未知数', '求解', '复核',
      '证据', '原文', '主旨', '推断', '句子', '时态', '词汇', '搭配',
      '对象', '状态', '受力', '电路', '光路', '规律', '物质', '现象', '方程式',
      '结构', '过程', '变量', '对照', '地图', '图例', '因果', '空间'
    ].forEach((token) => {
      if (text.includes(token) && unitText.includes(token)) score += 18;
    });
  }
  const taskHints = {
    equation_setup: ['方程', '未知数', '等量', '关系', '设x', '设未知数'],
    math_word_problem: ['问题句', '已知', '单位', '数量关系', '建模', '关系'],
    reading_question: ['原文', '证据', '主旨', '细节', '推断', '原因'],
    english_sentence: ['主语', '谓语', '时态', '词汇', '搭配', '从句'],
    physics_diagram: ['对象', '状态', '受力', '电路', '光路', '方向', '规律'],
    chemistry_experiment: ['物质', '状态', '现象', '气体', '沉淀', '方程式', '守恒'],
    biology_process: ['结构', '功能', '过程', '变量', '对照', '生态'],
    geography_map: ['地图', '图例', '方向', '位置', '因果', '空间', '地形']
  };
  (taskHints[normalizedActiveTaskType] || []).forEach((token) => {
    if (text.includes(token) && unitText.includes(token)) score += 30;
  });
  return score;
}

function buildCourseUnitMap(options = {}) {
  const subjectLibrary = options.subjectSeedLibrary || buildSubjectSeedLibrary(options);
  const activeSubject = options.subject ? String(options.subject) : '';
  const bindingText = collectCourseBindingText(options);
  const detectedTaskType = detectTaskType(bindingText, `${options.subject || ''} ${options.issueType || ''}`);
  const activeTaskType = normalizeTaskType(options.taskType
    || (detectedTaskType !== 'unknown' ? detectedTaskType : '')
    || taskTypeForSubject(activeSubject)
    || (subjectLibrary.active && subjectLibrary.active.taskType)
    || 'unknown', activeSubject);
  const subjects = (subjectLibrary.subjects || []).map((subject) => {
    const units = (subject.seeds || []).map((seed, index) => ({
      id: `${subject.id}_unit_${seed.id}`,
      order: index + 1,
      subjectId: subject.id,
      subjectLabel: subject.label,
      unitLabel: seed.label,
      tier: seed.tier,
      gradeBand: seed.gradeBand,
      taskType: seed.taskType,
      reusableQuestionTypes: [
        `${seed.label}第一步判断`,
        `${seed.label}错因复述`,
        `${seed.label}同类小变式`
      ],
      wrongCauseAtlas: [
        seed.wrongCause,
        `${seed.label}证据不足`,
        '会做一次但隔天不能复述'
      ],
      diagnosticProbes: [
        seed.parentQuestion,
        `这题先看「${seed.label}」还是先算答案？`,
        `换一道题时，第一步还会是「${seed.firstStep}」吗？`
      ],
      blackboardBlueprint: {
        title: `${subject.label} · ${seed.label}小黑板`,
        firstStroke: seed.boardMove,
        visualPrompt: seed.visualPrompt,
        stopRule: '只画第一笔和证据点，孩子能说出第一步就停。'
      },
      practiceLoop: {
        recall: seed.recallPrompt,
        repair: seed.wrongCauseModel,
        transfer: seed.transferPrompt,
        nextDay: '明天只回访 1 道同类小变式。'
      },
      reportContract: `${subject.label}/${seed.label}进入报告时，只写第一步证据、错因和下一次回访，不写分数排名。`,
      parentAction: seed.parentCheckLine,
      shareContract: `分享只带「${seed.label}」第一步和回访动作，不带完整答案。`,
      evidenceRequired: seed.evidenceRequired || [],
      route: seed.route,
      recallRoute: seed.recallRoute,
      gameRoute: seed.gameRoute
    }));
    return {
      id: subject.id,
      label: subject.label,
      route: subject.route,
      visualBoundary: subject.visualBoundary,
      unitCount: units.length,
      modelLine: `${subject.label}已沉淀 ${units.length} 个课程单元，每个单元都有题型、错因、小黑板、游戏回流和报告口径。`,
      units
    };
  });
  const activeBase = subjects.find((item) => item.id === activeSubject || item.label === activeSubject)
    || subjects.find((item) => item.taskType === activeTaskType)
    || (subjectLibrary.active && subjects.find((item) => item.id === subjectLibrary.active.id))
    || subjects[0];
  const candidateUnits = activeBase && Array.isArray(activeBase.units) ? activeBase.units : [];
  const scoredUnits = candidateUnits
    .map((unit) => Object.assign({}, unit, {
      activeBindingScore: scoreCourseUnitBinding(unit, bindingText, activeTaskType, options)
    }))
    .sort((a, b) => b.activeBindingScore - a.activeBindingScore || a.order - b.order);
  const positiveUnits = scoredUnits.filter((unit) => unit.activeBindingScore > 0);
  const taskMatchedUnits = scoredUnits.filter((unit) => normalizeTaskType(unit.taskType, unit.subjectId || unit.subjectLabel) === activeTaskType);
  const activeUnits = (positiveUnits.length ? positiveUnits : taskMatchedUnits.length ? taskMatchedUnits : scoredUnits).slice(0, 3);
  const activeUnitIds = activeUnits.map((unit) => unit.id);
  const activeBindingEvidence = activeUnits.map((unit) => ({
    unitId: unit.id,
    unitLabel: unit.unitLabel,
    subjectLabel: unit.subjectLabel,
    taskType: unit.taskType,
    score: unit.activeBindingScore || 0,
    route: unit.route,
    gameRoute: unit.gameRoute,
    recallRoute: unit.recallRoute
  }));
  const active = activeBase ? Object.assign({}, activeBase, {
    units: activeUnits,
    activeUnitCount: activeUnits.length,
    activeTaskType,
    activeUnitIds,
    activeBindingEvidence,
    activeBindingLine: activeUnits[0]
      ? `当前作业卡点已绑定到 ${activeUnits[0].subjectLabel}/${activeUnits[0].unitLabel}，题库和游戏优先出这条主线。`
      : '当前作业卡点暂未命中具体单元，先用本学科第一步卡兜底。'
  }) : null;
  const totalUnits = subjects.reduce((sum, subject) => sum + subject.unitCount, 0);
  const totalQuestionTypes = subjects.reduce((sum, subject) => sum + subject.units.reduce((unitSum, unit) => unitSum + unit.reusableQuestionTypes.length, 0), 0);
  return {
    id: 'course_unit_map',
    title: '七科课程单元地图',
    summary: '把每科第一步种子升级为课程单元：题型、错因、小黑板、练习回流、报告和家长动作都能复用。',
    boundary: '这是课程能力地图，不承诺拍题自动板书讲完整答案。',
    subjects,
    active,
    activeTaskType,
    activeUnitIds,
    activeBindingEvidence,
    activeBindingLine: active && active.activeBindingLine ? active.activeBindingLine : '',
    subjectCount: subjects.length,
    unitCount: totalUnits,
    reusableQuestionTypeCount: totalQuestionTypes,
    wrongCauseModelCount: totalUnits * 3,
    reportLine: `当前课程地图覆盖 ${subjects.length} 科、${totalUnits} 个单元、${totalQuestionTypes} 条可复用题型动作。`,
    parentLine: active ? `今晚家长只看 ${active.label} 的一个单元：孩子能不能说第一步、错因和明天回访。` : '',
    gameLine: '游戏只奖励主动回忆和错因回退，不奖励刷题数量。',
    generatedAt: options.now ? new Date(options.now).toISOString() : rcNowIso()
  };
}

function buildGradeChapterTeachingStrategyMap(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const subjects = courseUnitMap && Array.isArray(courseUnitMap.subjects) ? courseUnitMap.subjects : [];
  const units = subjects.reduce((list, subject) => list.concat(Array.isArray(subject.units) ? subject.units : []), []);
  const strategyModes = [
    {
      id: 'recognize',
      label: '识别题型',
      evidence: 'question_type_recognized',
      localGate: '孩子能说出这题属于哪一类，才进入下一步。',
      aiRole: '把题型入口改写成孩子能听懂的一句话。'
    },
    {
      id: 'repair',
      label: '修错因',
      evidence: 'wrong_cause_named',
      localGate: '错因没有命名时，不加题量，只回到小黑板。',
      aiRole: '把错因解释得更温和，但不替孩子下结论。'
    },
    {
      id: 'transfer',
      label: '近迁移',
      evidence: 'near_transfer_attempted',
      localGate: '没有隔天回访和小变式证据，不写入长期画像。',
      aiRole: '把同错因小变式换一种表述，不生成完整答案。'
    }
  ];
  const strategies = units.reduce((list, unit) => {
    const rows = strategyModes.map((mode, index) => ({
      id: `${unit.id}_${mode.id}_strategy`,
      subjectId: unit.subjectId,
      subjectLabel: unit.subjectLabel,
      gradeBand: unit.gradeBand || '当前年级段',
      tier: unit.tier || '',
      chapterLabel: unit.unitLabel,
      taskType: unit.taskType,
      strategyMode: mode.id,
      strategyLabel: mode.label,
      skillVerb: mode.id === 'recognize' ? '识别' : mode.id === 'repair' ? '解释' : '迁移',
      knowledgePoint: `${unit.subjectLabel}/${unit.unitLabel}`,
      firstStepPrompt: index === 0
        ? (unit.practiceLoop && unit.practiceLoop.recall) || unit.parentAction
        : index === 1
          ? (unit.diagnosticProbes && unit.diagnosticProbes[0]) || unit.parentAction
          : (unit.practiceLoop && unit.practiceLoop.transfer) || unit.shareContract,
      misconceptionCode: `${unit.subjectId}.${String(unit.taskType || 'unknown').replace(/[^a-z0-9_]/gi, '_')}.${mode.id}`,
      wrongCauseLabel: (unit.wrongCauseAtlas && unit.wrongCauseAtlas[index]) || `${unit.unitLabel}证据不足`,
      boardMove: index === 0
        ? unit.blackboardBlueprint && unit.blackboardBlueprint.firstStroke
        : index === 1
          ? unit.blackboardBlueprint && unit.blackboardBlueprint.visualPrompt
          : unit.blackboardBlueprint && unit.blackboardBlueprint.stopRule,
      parentCheckPrompt: index === 0
        ? unit.parentAction
        : index === 1
          ? `家长只问：这次错因是不是「${(unit.wrongCauseAtlas && unit.wrongCauseAtlas[index]) || unit.unitLabel}」？`
          : `家长只问：换一道题时，第一步有没有搬过去？`,
      nearTransferRule: (unit.practiceLoop && unit.practiceLoop.transfer) || `换一个条件，仍然先说 ${unit.unitLabel} 的第一步。`,
      answerPolicy: 'first_step_only_no_full_answer',
      evidenceRequired: [mode.evidence, 'child_first_step', 'next_day_revisit'],
      localGate: mode.localGate,
      aiRole: mode.aiRole,
      releaseGate: '本地代码决定题型、错因、回访、画像和分享放行；AI 只负责话术。',
      shareBoundary: '不带原题、完整答案、完整对话、分数、排名或隐私评价。',
      route: unit.route || '/pages/tutor/tutor'
    }));
    return list.concat(rows);
  }, []);
  const bySubject = strategies.reduce((acc, item) => {
    if (!acc[item.subjectId]) {
      acc[item.subjectId] = {
        id: item.subjectId,
        label: item.subjectLabel,
        strategyCount: 0,
        gradeBands: {},
        taskTypes: {}
      };
    }
    acc[item.subjectId].strategyCount += 1;
    acc[item.subjectId].gradeBands[item.gradeBand] = true;
    acc[item.subjectId].taskTypes[item.taskType] = true;
    return acc;
  }, {});
  const subjectRows = Object.keys(bySubject).map((key) => {
    const row = bySubject[key];
    return Object.assign({}, row, {
      gradeBandCount: Object.keys(row.gradeBands).length,
      taskTypeCount: Object.keys(row.taskTypes).length,
      gradeBands: Object.keys(row.gradeBands),
      taskTypes: Object.keys(row.taskTypes)
    });
  });
  return {
    id: 'grade_chapter_teaching_strategy_map',
    title: '年级章节题型教学策略图',
    summary: `已把 ${subjects.length} 科、${units.length} 个课程单元扩展为 ${strategies.length} 条“识别题型-修错因-近迁移”教学策略。`,
    boundary: '这是本地课程策略，不是外部题库、原题答案库或全科自动讲题承诺。',
    subjectCount: subjects.length,
    unitCount: units.length,
    strategyCount: strategies.length,
    subjectRows,
    strategies,
    localCodeOwns: ['grade_band', 'chapter_label', 'task_type', 'wrong_cause', 'board_move', 'release_gate', 'share_boundary'],
    aiOwns: ['socratic_wording', 'parent_explanation', 'encouragement_copy'],
    mustReject: ['copied_original_question', 'standard_answer_bank', 'score_ranking_claim', 'fake_full_blackboard'],
    reportLine: `报告可按年级段、章节、题型和错因定位下一证据；不靠一次分数或排名更新画像。`,
    gameLine: '游戏抽卡按教学策略走：先识别题型，再修错因，最后做近迁移。',
    parentLine: '家长只看一个章节的一条策略是否有证据，不把整科一次性铺开。',
    shareLine: '分享只带策略名、第一步、小黑板和回访窗口。'
  };
}

function buildGradeChapterStrategyDensityAudit(options = {}) {
  const strategyMap = options.strategyMap || buildGradeChapterTeachingStrategyMap(options);
  const strategies = Array.isArray(strategyMap.strategies) ? strategyMap.strategies : [];
  const samples = getRealHomeworkPressureSamplePool();
  const bySubject = strategies.reduce((acc, item) => {
    const key = item.subjectId || item.subjectLabel || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        id: key,
        label: item.subjectLabel || key,
        strategyCount: 0,
        stableStrategyCount: 0,
        sampleBackedCount: 0,
        failureFallbackCount: 0,
        aiBoundaryReadyCount: 0
      };
    }
    const sampleHit = samples.some((sample) => sample && sample.subject === item.subjectLabel && normalizeTaskType(sample.taskType || '', sample.subject || '') === normalizeTaskType(item.taskType || '', item.subjectLabel || item.subjectId || ''));
    const stable = Boolean(item.firstStepPrompt && item.wrongCauseLabel && item.boardMove && item.parentCheckPrompt && item.nearTransferRule);
    const fallbackReady = Boolean(item.localGate && item.releaseGate && item.answerPolicy === 'first_step_only_no_full_answer');
    const aiBoundaryReady = Boolean(item.aiRole && item.shareBoundary && String(item.shareBoundary).includes('full') === false);
    acc[key].strategyCount += 1;
    if (stable) acc[key].stableStrategyCount += 1;
    if (sampleHit) acc[key].sampleBackedCount += 1;
    if (fallbackReady) acc[key].failureFallbackCount += 1;
    if (aiBoundaryReady) acc[key].aiBoundaryReadyCount += 1;
    return acc;
  }, {});
  const subjectRows = Object.keys(bySubject).map((key) => {
    const row = bySubject[key];
    return Object.assign({}, row, {
      stableRatio: row.strategyCount ? Number((row.stableStrategyCount / row.strategyCount).toFixed(2)) : 0,
      sampleBackedRatio: row.strategyCount ? Number((row.sampleBackedCount / row.strategyCount).toFixed(2)) : 0,
      failureFallbackRatio: row.strategyCount ? Number((row.failureFallbackCount / row.strategyCount).toFixed(2)) : 0,
      aiBoundaryReadyRatio: row.strategyCount ? Number((row.aiBoundaryReadyCount / row.strategyCount).toFixed(2)) : 0
    });
  });
  const total = strategies.length;
  const stable = subjectRows.reduce((sum, row) => sum + row.stableStrategyCount, 0);
  const sampleBacked = subjectRows.reduce((sum, row) => sum + row.sampleBackedCount, 0);
  const fallback = subjectRows.reduce((sum, row) => sum + row.failureFallbackCount, 0);
  const aiBoundary = subjectRows.reduce((sum, row) => sum + row.aiBoundaryReadyCount, 0);
  return {
    id: 'grade_chapter_strategy_density_audit',
    title: 'Grade chapter strategy density audit',
    subjectCount: subjectRows.length,
    strategyCount: total,
    stableStrategyCount: stable,
    sampleBackedStrategyCount: sampleBacked,
    failureFallbackStrategyCount: fallback,
    aiBoundaryReadyStrategyCount: aiBoundary,
    pressureSampleCount: samples.length,
    subjectRows,
    stable: total > 0 && stable === total && fallback === total && aiBoundary === total && sampleBacked >= Math.min(total, 63),
    minimumCommercialBar: {
      strategies: 63,
      pressureSamples: 400,
      subjectRows: 7,
      requiredPerStrategy: ['first_step_prompt', 'wrong_cause_label', 'board_move', 'parent_check', 'near_transfer', 'local_fallback', 'ai_boundary']
    },
    localCodeOwns: ['strategy_density', 'sample_match', 'fallback_gate', 'answer_policy', 'release_gate'],
    aiMayRewrite: ['prompt_wording', 'parent_copy', 'mini_lesson_copy'],
    aiMustNotOwn: ['strategy_release', 'answer_policy', 'score_claim', 'talent_label'],
    nextHardeningQueue: subjectRows
      .filter((row) => row.stableRatio < 1 || row.failureFallbackRatio < 1 || row.aiBoundaryReadyRatio < 1)
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        label: row.label,
        action: 'add_missing_first_step_wrong_cause_board_parent_transfer_or_boundary'
      }))
  };
}

function buildCourseUnitMasteryTrajectory(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const active = courseUnitMap && courseUnitMap.active ? courseUnitMap.active : null;
  const reviewCards = loadReviewCards();
  const thinkingReceipts = loadThinkingReceipts();
  const gameProfile = loadGameProfile();
  const parentReflection = buildParentReflectionSummary();
  const reviewedToday = Number(gameProfile.reviewed_today || gameProfile.reviewedToday || 0);
  const totalEvidence = reviewCards.length + thinkingReceipts.length + reviewedToday + Number(parentReflection.childRecalledFirstStep || 0);
  const subjectEvidence = active
    ? reviewCards.filter((card) => {
      const text = `${card.subject || ''} ${card.stuckPointText || ''} ${card.prompt || ''} ${card.taskType || ''}`;
      return text.indexOf(active.id) >= 0 || text.indexOf(active.label) >= 0;
    }).length
    : 0;
  const subjects = courseUnitMap && Array.isArray(courseUnitMap.subjects) ? courseUnitMap.subjects : [];
  const units = subjects.reduce((list, subject) => list.concat(Array.isArray(subject.units) ? subject.units : []), []);
  const activeUnits = active && Array.isArray(active.units) ? active.units : [];
  const trajectories = units.map((unit, index) => {
    const evidenceCount = subjectEvidence + Math.max(0, totalEvidence - index);
    const masteryScore = Math.max(12, Math.min(96, 28 + evidenceCount * 7 + reviewedToday * 3 - index * 4));
    const regressionRisk = masteryScore >= 75 ? '低' : masteryScore >= 52 ? '中' : '高';
    const parentInterventionLevel = regressionRisk === '高' ? '陪问一句' : regressionRisk === '中' ? '明天复核' : '只看证据';
    const nextEvidence = masteryScore >= 75
      ? unit.practiceLoop.transfer
      : masteryScore >= 52
        ? unit.practiceLoop.nextDay
        : unit.diagnosticProbes[0];
    return {
      id: unit.id,
      unitLabel: unit.unitLabel,
      subjectLabel: unit.subjectLabel,
      masteryScore,
      masteryLine: `${unit.subjectLabel}/${unit.unitLabel} 当前掌握度 ${masteryScore}，风险 ${regressionRisk}。`,
      regressionRisk,
      parentInterventionLevel,
      nextEvidence,
      evidenceContract: unit.reportContract,
      route: unit.recallRoute || unit.route || '/pages/review/review'
    };
  });
  const weakest = trajectories.slice().sort((a, b) => a.masteryScore - b.masteryScore)[0] || null;
  const strongest = trajectories.slice().sort((a, b) => b.masteryScore - a.masteryScore)[0] || null;
  return {
    id: 'course_unit_mastery_trajectory',
    title: '单元级长期画像轨迹',
    subjectLabel: active ? active.label : '',
    ready: trajectories.length > 0,
    evidenceCount: totalEvidence,
    summary: weakest
      ? `先看 ${weakest.unitLabel}：${weakest.parentInterventionLevel}，下一证据是「${weakest.nextEvidence}」。`
      : '先选择一个课程单元，再沉淀第一步、错因和回访证据。',
    weakest,
    strongest,
    trajectories,
    parentLine: weakest
      ? `家长今晚只管 ${weakest.unitLabel}：${weakest.parentInterventionLevel}，不扩到整科刷题。`
      : '',
    reportLine: `报告按单元跟踪掌握度、回退风险、下一证据和家长介入等级，不做排名。`
  };
}

function getRealHomeworkPressureSamplePool() {
  if (realHomeworkCoverage && typeof realHomeworkCoverage.getRealHomeworkPressureSamples === 'function') {
    const samples = realHomeworkCoverage.getRealHomeworkPressureSamples();
    return Array.isArray(samples) ? samples : [];
  }
  return [];
}

function normalizeCourseSampleText(value = '') {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

let pressureSampleIndexCache = null;

function buildPressureSampleIndex(samples = []) {
  const signature = `${samples.length}:${samples[0] && samples[0].id || ''}:${samples[samples.length - 1] && samples[samples.length - 1].id || ''}`;
  if (pressureSampleIndexCache && pressureSampleIndexCache.signature === signature) return pressureSampleIndexCache;
  const bySubject = {};
  const bySubjectTask = {};
  samples.forEach((sample) => {
    if (!sample) return;
    const subjectKey = sample.subject || '';
    const taskKey = normalizeTaskType(sample.taskType || '', subjectKey);
    if (subjectKey) {
      if (!bySubject[subjectKey]) bySubject[subjectKey] = [];
      bySubject[subjectKey].push(sample);
    }
    if (subjectKey && taskKey) {
      const key = `${subjectKey}::${taskKey}`;
      if (!bySubjectTask[key]) bySubjectTask[key] = [];
      bySubjectTask[key].push(sample);
    }
  });
  pressureSampleIndexCache = { signature, bySubject, bySubjectTask, all: samples };
  return pressureSampleIndexCache;
}

function scorePressureSampleForUnit(sample = {}, unit = {}, type = 'active_recall') {
  const sampleTaskType = normalizeTaskType(sample.taskType || '', sample.subject || '');
  const unitTaskType = normalizeTaskType(unit.taskType || '', unit.subjectLabel || unit.subjectId || '');
  const subjectHit = sample.subject && unit.subjectLabel && sample.subject === unit.subjectLabel ? 40 : 0;
  const taskHit = sampleTaskType && unitTaskType && sampleTaskType === unitTaskType ? 35 : 0;
  const gradeHit = sample.gradeBand && unit.gradeBand && normalizeCourseSampleText(sample.gradeBand) === normalizeCourseSampleText(unit.gradeBand) ? 12 : 0;
  const unitText = normalizeCourseSampleText(`${unit.unitLabel || ''} ${(unit.reusableQuestionTypes || []).join(' ')}`);
  const sampleText = normalizeCourseSampleText(`${sample.stem || ''} ${sample.expectedWrongCause || ''} ${sample.expectedFirstStep || ''}`);
  const unitHit = unitText && sampleText && unitText.split('').some((char) => char && sampleText.indexOf(char) >= 0) ? 6 : 0;
  const typeBias = type === 'wrong_cause'
    ? (sample.expectedWrongCause ? 4 : 0)
    : type === 'near_transfer'
      ? (sample.nearTransfer ? 4 : 0)
      : (sample.expectedFirstStep ? 4 : 0);
  return subjectHit + taskHit + gradeHit + unitHit + typeBias;
}

function explainPressureSampleMatch(sample = {}, unit = {}, type = 'active_recall') {
  const score = scorePressureSampleForUnit(sample, unit, type);
  const reasons = [];
  const weaknesses = [];
  if (sample.subject && unit.subjectLabel && sample.subject === unit.subjectLabel) reasons.push('subject_match');
  else weaknesses.push('subject_fallback');
  if (sample.taskType && unit.taskType && normalizeTaskType(sample.taskType, sample.subject || '') === normalizeTaskType(unit.taskType, unit.subjectLabel || unit.subjectId || '')) reasons.push('task_type_match');
  else weaknesses.push('task_type_fallback');
  if (sample.gradeBand && unit.gradeBand && normalizeCourseSampleText(sample.gradeBand) === normalizeCourseSampleText(unit.gradeBand)) reasons.push('grade_band_match');
  else weaknesses.push('grade_band_unverified');
  if (type === 'wrong_cause' && sample.expectedWrongCause) reasons.push('wrong_cause_evidence');
  if (type === 'near_transfer' && sample.nearTransfer) reasons.push('near_transfer_evidence');
  if (type === 'active_recall' && sample.expectedFirstStep) reasons.push('first_step_evidence');
  return {
    sampleMatchScore: score,
    sampleMatchReasons: reasons,
    sampleMatchWeaknesses: weaknesses,
    sampleMatchTier: score >= 87 ? 'strong' : score >= 75 ? 'usable' : 'fallback',
    sampleMatchReleaseGate: score >= 75
      ? 'sample_specific_release_allowed'
      : 'fallback_requires_parent_or_child_confirmation'
  };
}

function findPressureSampleForUnit(unit = {}, type = 'active_recall', index = 0, samplesInput) {
  const samples = Array.isArray(samplesInput) ? samplesInput : getRealHomeworkPressureSamplePool();
  if (!samples.length) return null;
  const sampleIndex = buildPressureSampleIndex(samples);
  const subjectTaskKey = `${unit.subjectLabel || ''}::${normalizeTaskType(unit.taskType || '', unit.subjectLabel || unit.subjectId || '')}`;
  const candidatePool = sampleIndex.bySubjectTask[subjectTaskKey]
    || sampleIndex.bySubject[unit.subjectLabel || '']
    || samples;
  const ranked = candidatePool
    .map((sample, sampleIndex) => ({
      sample,
      sampleIndex,
      score: scorePressureSampleForUnit(sample, unit, type)
    }))
    .filter((item) => item.score >= 35)
    .sort((a, b) => b.score - a.score || a.sampleIndex - b.sampleIndex);
  if (ranked.length) {
    return ranked[(index + (type === 'wrong_cause' ? 1 : type === 'near_transfer' ? 2 : 0)) % ranked.length].sample;
  }
  const subjectMatches = samples.filter((sample) => sample.subject && unit.subjectLabel && sample.subject === unit.subjectLabel);
  if (subjectMatches.length) return subjectMatches[index % subjectMatches.length];
  return samples[index % samples.length];
}

function buildPressureSampleEvidence(sample = {}, unit = {}, type = 'active_recall') {
  if (!sample || !sample.id) return null;
  const match = explainPressureSampleMatch(sample, unit, type);
  return {
    sourceSampleId: sample.id,
    sourceId: sample.sourceId || '',
    sourceType: sample.sourceType || '',
    provenanceKind: sample.provenanceKind || 'rewritten_public_pattern',
    originalTextIncluded: false,
    gradeBand: sample.gradeBand || unit.gradeBand || '',
    taskType: sample.taskType || unit.taskType || '',
    sampleStem: sample.stem || '',
    firstStepHint: sample.expectedFirstStep || '',
    wrongCauseProbe: sample.expectedWrongCause || '',
    blackboardMove: sample.expectedBoardMove || '',
    parentCheck: sample.parentCheck || '',
    nearTransferStem: sample.nearTransfer || '',
    sampleMatchScore: match.sampleMatchScore,
    sampleMatchReasons: match.sampleMatchReasons,
    sampleMatchWeaknesses: match.sampleMatchWeaknesses,
    sampleMatchTier: match.sampleMatchTier,
    sampleMatchReleaseGate: match.sampleMatchReleaseGate,
    sampleBackedEvidence: {
      id: `${sample.id}_${type}_course_evidence`,
      sourceSampleId: sample.id,
      unitId: unit.id || '',
      subjectLabel: sample.subject || unit.subjectLabel || '',
      gradeBand: sample.gradeBand || unit.gradeBand || '',
      taskType: sample.taskType || unit.taskType || '',
      releaseScope: 'course_unit_first_step_only',
      sampleMatchScore: match.sampleMatchScore,
      sampleMatchTier: match.sampleMatchTier,
      sampleMatchReasons: match.sampleMatchReasons,
      sampleMatchWeaknesses: match.sampleMatchWeaknesses,
      localGate: 'local_rule_requires_first_step_wrong_cause_board_parent_check_revisit',
      answerPolicy: 'first_step_only_no_full_answer',
      evidenceRequired: [
        'sample_specific_first_step',
        'sample_specific_wrong_cause',
        'visual_board_move',
        'parent_check_line',
        'near_transfer_variant'
      ],
      blockedFields: ['original_question', 'source_original_text', 'source_question', 'source_answer', 'full_answer', 'answer_key', 'score', 'ranking', 'full_dialogue'],
      aiRole: 'socratic_wording_only',
      localCodeOwns: ['sample_match', 'release_gate', 'share_boundary', 'portrait_writeback']
    }
  };
}

function pickOerResourceForUnit(unit = {}, type = 'active_recall', index = 0) {
  const ledger = realHomeworkCoverage && Array.isArray(realHomeworkCoverage.PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER)
    ? realHomeworkCoverage.PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER
    : [];
  if (!ledger.length) return null;
  const subjectText = `${unit.subjectId || ''} ${unit.subjectLabel || ''} ${unit.unitLabel || ''} ${unit.taskType || ''}`.toLowerCase();
  const typeText = String(type || '').toLowerCase();
  const scored = ledger.map((resource, resourceIndex) => {
    const haystack = [
      resource.id,
      resource.label,
      resource.sourceType,
      (resource.localizeAsCode || []).join(' '),
      (resource.directUse || []).join(' ')
    ].join(' ').toLowerCase();
    let score = 0;
    if (/math|数学|代数|几何|函数|图形/.test(subjectText) && /math|geogebra|illustrative|openup/.test(haystack)) score += 8;
    if (/physics|物理|science|科学|化学|生物/.test(subjectText) && /phet|openscied|stax|libretexts|science/.test(haystack)) score += 8;
    if (/english|英语|语文|language/.test(subjectText) && /standard|khan|oer/.test(haystack)) score += 4;
    if (typeText.includes('recall') && /recall|practice|warmup|adaptive/.test(haystack)) score += 4;
    if (typeText.includes('wrong') && /misconception|evidence|diagnostic|wrong/.test(haystack)) score += 4;
    if (typeText.includes('transfer') && /routine|visual|activity|problem/.test(haystack)) score += 4;
    return { resource, resourceIndex, score };
  }).sort((a, b) => b.score - a.score || a.resourceIndex - b.resourceIndex);
  return scored.length ? scored[(index % Math.min(scored.length, 6))].resource : null;
}

function buildRightsBoundaryEnvelope(resource = null, sourceEvidence = null) {
  const needsLicenseCheck = !resource || !resource.sourceUrl || !resource.licenseSignal || !resource.commercialDecision;
  const releaseDecision = needsLicenseCheck ? 'needs_license_check' : 'allow_structure_only';
  return {
    rightsBoundaryEnvelope: {
      sourceRegistryId: resource && resource.id ? resource.id : '',
      sourceUrl: resource && resource.sourceUrl ? resource.sourceUrl : '',
      licenseSignal: resource && resource.licenseSignal ? resource.licenseSignal : '',
      licenseCheckedAt: resource && resource.licenseCheckedAt ? resource.licenseCheckedAt : '',
      releaseDecision,
      reuseScope: 'structure_signal_only',
      sourceContentPolicy: 'no_source_text_no_source_image_no_source_answer',
      answerVisibility: 'first_step_only_no_full_answer',
      originalTextIncluded: false,
      sourceSampleId: sourceEvidence && sourceEvidence.sourceSampleId ? sourceEvidence.sourceSampleId : '',
      allowedDerivedArtifacts: ['first_step_card', 'wrong_cause_probe', 'visual_board_move', 'revisit_window', 'parent_check_line'],
      mustNotSurface: ['source_original_text', 'source_question', 'source_answer', 'source_image', 'full_solution', 'answer_key', 'brand_claim', 'official_partnership_claim']
    }
  };
}

function buildQuestionSampleCard(unit = {}, type = 'active_recall', index = 0, options = {}) {
  const subject = unit.subjectLabel || '学科';
  const label = unit.unitLabel || '当前单元';
  const samples = {
    active_recall: {
      sampleStem: `${subject}小题：看到“${label}”相关题目时，先判断题目要你找什么，再说出第一步。`,
      firstStepHint: unit.practiceLoop && unit.practiceLoop.recall ? unit.practiceLoop.recall : `先说出${label}的第一步。`,
      blackboardMove: unit.blackboardBlueprint && unit.blackboardBlueprint.firstStroke ? unit.blackboardBlueprint.firstStroke : `小黑板只写：${label} -> 第一条已知条件。`,
      wrongCauseProbe: unit.wrongCauseAtlas && unit.wrongCauseAtlas[0] ? unit.wrongCauseAtlas[0] : '没有先说第一步，直接想答案。',
      nearTransferStem: `把数字、材料或语境换一下，仍然先复述${label}的第一步。`,
      parentCheck: '家长只问：这题第一步你先看哪里？不追完整答案。',
      flashcardFront: `看到 ${label} 时先看哪里？`,
      flashcardBack: unit.practiceLoop && unit.practiceLoop.recall ? unit.practiceLoop.recall : `先说出${label}的第一步。`,
      quizPrompt: `把 ${label} 换一个数字或语境，第一步还一样吗？`,
      spacedReviewWindow: '今晚 / 明天 / 第 7 天',
      activeRecallPrompt: `不看答案，说出 ${label} 的第一步。`
    },
    wrong_cause: {
      sampleStem: `${subject}错题：孩子说“我会一点但卡住”，先定位卡在${label}的哪一环。`,
      firstStepHint: unit.diagnosticProbes && unit.diagnosticProbes[0] ? unit.diagnosticProbes[0] : `先命名${label}的卡点。`,
      blackboardMove: unit.blackboardBlueprint && unit.blackboardBlueprint.visualPrompt ? unit.blackboardBlueprint.visualPrompt : `画出${label}和卡点之间的关系线。`,
      wrongCauseProbe: unit.wrongCauseAtlas && unit.wrongCauseAtlas[1] ? unit.wrongCauseAtlas[1] : `${label}证据不足。`,
      nearTransferStem: '换一道同类错题，只要求说出同一个错因是否还出现。',
      parentCheck: '家长只听错因名称，不用当场讲解完整过程。',
      flashcardFront: `这类 ${label} 错题卡在哪？`,
      flashcardBack: unit.diagnosticProbes && unit.diagnosticProbes[0] ? unit.diagnosticProbes[0] : `先命名${label}的卡点。`,
      quizPrompt: `换一道同类错题，错因还会出现吗？`,
      spacedReviewWindow: '今晚 / 明天 / 第 7 天',
      activeRecallPrompt: '先说出这道题卡住的位置。'
    },
    near_transfer: {
      sampleStem: `${subject}小变式：保留${label}的方法，换一个条件，检查孩子能不能迁移。`,
      firstStepHint: unit.practiceLoop && unit.practiceLoop.transfer ? unit.practiceLoop.transfer : `做一题${label}的小变式。`,
      blackboardMove: unit.blackboardBlueprint && unit.blackboardBlueprint.stopRule ? unit.blackboardBlueprint.stopRule : '小黑板画到方法迁移点就停。',
      wrongCauseProbe: unit.wrongCauseAtlas && unit.wrongCauseAtlas[2] ? unit.wrongCauseAtlas[2] : '会做一次，但换题不能复述。',
      nearTransferStem: '同类题只换一个条件，让孩子先说“哪里没变，哪里变了”。',
      parentCheck: '家长只判断方法能不能搬家，不用看刷题数量。',
      flashcardFront: `换条件后，${label} 先看哪里没变？`,
      flashcardBack: unit.practiceLoop && unit.practiceLoop.transfer ? unit.practiceLoop.transfer : `做一题${label}的小变式。`,
      quizPrompt: '换一个条件，方法还能搬过去吗？',
      spacedReviewWindow: '今晚 / 明天 / 第 7 天',
      activeRecallPrompt: '先说哪里没变，哪里变了。'
    }
  };
  const sample = samples[type] || samples.active_recall;
  const sourceSample = findPressureSampleForUnit(unit, type, index, options.realHomeworkPressureSamples);
  const sourceEvidence = buildPressureSampleEvidence(sourceSample, unit, type);
  const oerResource = pickOerResourceForUnit(unit, type, index);
  const rightsBoundaryEnvelope = buildRightsBoundaryEnvelope(oerResource, sourceEvidence);
  return Object.assign({}, sample, rightsBoundaryEnvelope, {
    sourceContentPolicy: 'no_source_text_no_source_image_no_source_answer',
    answerVisibility: 'first_step_only_no_full_answer',
    oerResourceId: oerResource && oerResource.id,
    sourceRegistryId: oerResource && oerResource.id,
    sourceUrl: oerResource && oerResource.sourceUrl,
    licenseSignal: oerResource && oerResource.licenseSignal,
    commercialDecision: oerResource && oerResource.commercialDecision,
    distributionPolicy: 'structure_index_only_no_source_content_distribution',
    licenseCheckedAt: oerResource && oerResource.licenseCheckedAt,
    rightsBoundary: '只使用公开资料的结构信号、能力轴和教学活动形态，不复制原文、图片、题目、答案或品牌素材。',
    allowedDerivedArtifacts: ['first_step_card', 'wrong_cause_probe', 'visual_board_move', 'revisit_window', 'parent_check_line'],
    mustNotSurface: ['source_original_text', 'source_question', 'source_answer', 'source_image', 'brand_claim', 'official_partnership_claim'],
    oerReuseLevel: oerResource && (oerResource.reuseLevel || 'structure_only'),
    oerDerivedArtifact: oerResource && (oerResource.derivedArtifact || 'localized_question_type_action_card'),
    oerAttributionRequired: !!(oerResource && oerResource.attributionRequired),
    derivedFrom: 'structure_only',
    answerPolicy: 'first_step_only_no_full_answer',
    blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue'],
    aiRole: 'socratic_wording_only',
    localCodeOwns: ['source_match', 'question_type_route', 'answer_policy', 'xp_unlock', 'share_boundary'],
    sourceBacked: !!sourceEvidence,
    sourceSampleId: sourceEvidence && sourceEvidence.sourceSampleId,
    sourceId: sourceEvidence && sourceEvidence.sourceId,
    sourceType: sourceEvidence && sourceEvidence.sourceType,
    gradeBand: sourceEvidence && sourceEvidence.gradeBand ? sourceEvidence.gradeBand : unit.gradeBand,
    sourceSampleStem: sourceEvidence && sourceEvidence.sampleStem,
    sourceSampleFirstStep: sourceEvidence && sourceEvidence.firstStepHint,
    sourceSampleWrongCause: sourceEvidence && sourceEvidence.wrongCauseProbe,
    sourceSampleBoardMove: sourceEvidence && sourceEvidence.blackboardMove,
    sourceSampleParentCheck: sourceEvidence && sourceEvidence.parentCheck,
    sourceSampleNearTransfer: sourceEvidence && sourceEvidence.nearTransferStem,
    sampleMatchScore: sourceEvidence && sourceEvidence.sampleMatchScore,
    sampleMatchReasons: sourceEvidence && sourceEvidence.sampleMatchReasons,
    sampleMatchWeaknesses: sourceEvidence && sourceEvidence.sampleMatchWeaknesses,
    sampleMatchTier: sourceEvidence && sourceEvidence.sampleMatchTier,
    sampleMatchReleaseGate: sourceEvidence && sourceEvidence.sampleMatchReleaseGate,
    sampleBackedEvidence: sourceEvidence && sourceEvidence.sampleBackedEvidence,
    sampleStem: sourceEvidence && sourceEvidence.sampleStem ? sourceEvidence.sampleStem : sample.sampleStem,
    firstStepHint: sourceEvidence && sourceEvidence.firstStepHint ? sourceEvidence.firstStepHint : sample.firstStepHint,
    blackboardMove: sourceEvidence && sourceEvidence.blackboardMove ? sourceEvidence.blackboardMove : sample.blackboardMove,
    wrongCauseProbe: sourceEvidence && sourceEvidence.wrongCauseProbe ? sourceEvidence.wrongCauseProbe : sample.wrongCauseProbe,
    nearTransferStem: sourceEvidence && sourceEvidence.nearTransferStem ? sourceEvidence.nearTransferStem : sample.nearTransferStem,
    parentCheck: sourceEvidence && sourceEvidence.parentCheck ? sourceEvidence.parentCheck : sample.parentCheck,
    flashcardFront: sample.flashcardFront,
    flashcardBack: sourceEvidence && sourceEvidence.firstStepHint ? sourceEvidence.firstStepHint : sample.flashcardBack,
    quizPrompt: sample.quizPrompt,
    spacedReviewWindow: sample.spacedReviewWindow,
    activeRecallPrompt: sourceEvidence && sourceEvidence.firstStepHint ? `不看答案，说出：${sourceEvidence.firstStepHint}` : sample.activeRecallPrompt,
    memoryLoopMode: 'flashcard_quiz_active_recall_spaced_review',
    sampleId: `${unit.id || 'unit'}_${type}_sample_${index + 1}`,
    classroomUse: '适合晚间作业 3 分钟低压练习，不作为考试押题。',
    evidenceRubric: [
      '孩子能说出第一步',
      '孩子能命名错因',
      '孩子能做一次近迁移或隔天回看'
    ],
    safetyBoundary: '不展示完整答案、不替孩子写过程、不用分数或排名证明能力。'
  });
}

function buildQuestionProgressionCard(unit = {}, card = {}, index = 0) {
  const subject = unit.subjectLabel || card.subjectLabel || '学科';
  const label = unit.unitLabel || '当前单元';
  const visualMove = card.sourceSampleBoardMove || card.blackboardMove || card.visualMove || (unit.blackboardBlueprint && unit.blackboardBlueprint.firstStroke) || `小黑板只写 ${label} 的第一步`;
  const wrongCause = card.sourceSampleWrongCause || card.wrongCauseProbe || card.wrongCause || (unit.wrongCauseAtlas && unit.wrongCauseAtlas[0]) || `${label} 的错因还没有命名`;
  const evidence = card.evidenceRequired || 'child_first_step';
  const typeText = {
    active_recall: '主动回忆',
    wrong_cause: '错因修复',
    near_transfer: '近迁移'
  }[card.type] || '题型练习';
  const entryTask = card.type === 'wrong_cause'
    ? `先让孩子把 ${label} 卡住的位置说成一句话。`
    : card.type === 'near_transfer'
      ? `先保留 ${label} 的方法，只替换一个条件。`
      : `先让孩子不看答案复述 ${label} 的第一步。`;
  const repairTask = card.type === 'wrong_cause'
    ? `用小黑板标出“已知、目标、卡点”，只修 ${wrongCause}。`
    : `如果说不出第一步，退回小黑板：${visualMove}。`;
  const nearTransferTask = card.type === 'near_transfer'
    ? `再换一个数字、材料或语境，让孩子说“哪里没变，哪里变了”。`
    : `做一道同类小变式，只检查方法能不能搬家。`;
  const nextDayRevisit = `明天只回访 1 次：遮住答案，让孩子先说 ${label} 的第一步和错因名。`;
  const masteryGate = `连续两次做到“第一步说清 + 错因命名 + 近迁移不慌”，才算 ${typeText} 通过。`;
  const parentEvidence = `家长只记录 ${evidence}，不记录原题答案、分数、完整对话或排名。`;
  return {
    id: `${card.id || unit.id || 'question'}_progression_${index + 1}`,
    stageCount: 6,
    entryTask,
    repairTask,
    nearTransferTask,
    nextDayRevisit,
    masteryGate,
    parentEvidence,
    flashcardMode: card.flashcardFront && card.flashcardBack ? `${card.flashcardFront} → ${card.flashcardBack}` : '',
    quizMode: card.quizPrompt || '',
    recallMode: card.activeRecallPrompt || entryTask,
    spacedReviewWindows: card.spacedReviewWindow ? String(card.spacedReviewWindow).split(' / ') : ['今晚', '明天', '第 7 天'],
    visualBoardStep: visualMove,
    safetyBoundary: '只沉淀第一步、错因、近迁移和回访证据；不生成完整答案，不替孩子写过程。',
    classroomBridge: `${subject} 老师可用这张卡观察孩子是否真正会迁移，而不是只看今晚刷了几题。`
  };
}

function buildQuestionTypeTransferLadder(unit = {}, cards = []) {
  const subject = unit.subjectLabel || '学科';
  const label = unit.unitLabel || '当前单元';
  const recallCard = cards.find((card) => card.type === 'active_recall') || cards[0] || {};
  const wrongCauseCard = cards.find((card) => card.type === 'wrong_cause') || cards[1] || recallCard;
  const transferCard = cards.find((card) => card.type === 'near_transfer') || cards[2] || recallCard;
  const visualMove = transferCard.visualMove
    || wrongCauseCard.visualMove
    || recallCard.visualMove
    || (unit.blackboardBlueprint && unit.blackboardBlueprint.firstStroke)
    || `小黑板只画 ${label} 的第一步`;
  const wrongCause = wrongCauseCard.wrongCause
    || (unit.wrongCauseAtlas && unit.wrongCauseAtlas[0])
    || `${label} 错因未命名`;
  const rungs = [
    {
      id: 'recognize',
      label: '认出题型',
      task: recallCard.sampleStem || `${subject}：先判断这题是不是 ${label}。`,
      evidence: 'question_type_recognized',
      exit: `孩子能用一句话说“这是 ${label} 的哪一类”。`
    },
    {
      id: 'name_wrong_cause',
      label: '命名错因',
      task: wrongCauseCard.firstStepHint || `先说卡在 ${label} 的哪一步。`,
      evidence: 'wrong_cause_named',
      exit: `孩子能说出错因：${wrongCause}。`
    },
    {
      id: 'near_transfer',
      label: '近迁移',
      task: transferCard.nearTransferStem || `换一个条件，仍然先说 ${label} 的第一步。`,
      evidence: 'near_transfer_attempted',
      exit: '孩子能说出“哪里没变，哪里变了”。'
    },
    {
      id: 'next_day_revisit',
      label: '隔日回访',
      task: transferCard.progression && transferCard.progression.nextDayRevisit
        ? transferCard.progression.nextDayRevisit
        : `明天只回访一次 ${label} 的第一步和错因名。`,
      evidence: 'next_day_revisit_scheduled',
      exit: '隔天遮住答案仍能先开口。'
    }
  ];
  return {
    id: `${unit.id || 'unit'}_transfer_ladder`,
    unitId: unit.id || '',
    subjectId: unit.subjectId || '',
    subjectLabel: subject,
    unitLabel: label,
    title: `${subject}/${label} 题型迁移路径`,
    summary: `从认出题型到隔日回访，共 ${rungs.length} 步，只沉淀第一步、错因和迁移证据。`,
    rungs,
    blockerRules: [
      '不能说出题型时，不进入讲解，只退回读题和圈目标。',
      '不能命名错因时，不加新题，只用小黑板画卡点。',
      '近迁移失败时，不刷题量，只保留一个变化条件重来。'
    ],
    visualBoardPath: [
      visualMove,
      wrongCauseCard.blackboardMove || wrongCauseCard.visualMove || `标出 ${label} 的卡点。`,
      transferCard.blackboardMove || transferCard.visualMove || '只画变化条件，不画完整答案。',
      '回访时只遮答案复述第一步。'
    ],
    parentDecisionRule: `家长只看 ${label} 是否走完“认题型、说错因、近迁移、隔日回访”，不看分数或排名。`,
    shareBoundary: '分享只带题型路径、第一步、小黑板动作和回访计划；不带原题、答案、分数、排名或完整对话。',
    evidenceRequired: ['question_type_recognized', 'wrong_cause_named', 'near_transfer_attempted', 'next_day_revisit_scheduled', 'parent_decision_rule', 'safe_share_boundary']
  };
}

const REVIEWED_PUBLIC_CURRICULUM_ASSET_CARDS = [
  {
    id: 'reviewed_public_math_equation_first_step',
    subjectId: 'math',
    type: 'active_recall',
    sourceAssetId: 'public_curriculum_standards_crosswalk',
    sourceAssetType: 'skill_verb_crosswalk',
    label: '数学等量关系第一步',
    prompt: '看到应用题，先把“已知量、目标量、关系词”各圈一次，再写一个等量关系。',
    firstStepHint: '先圈目标量和关系词，不急着列式。',
    blackboardMove: '小黑板只画：已知量 -> 关系词 -> 目标量。',
    wrongCauseProbe: '常见卡点是先套公式，没说清等量关系从哪里来。',
    nearTransferStem: '把数字换掉，只检查孩子能不能重新圈出关系词。',
    parentCheck: '家长只问：你先找的是目标量还是关系词？',
    taskType: 'math_word_problem',
    gradeBand: 'primary_to_junior'
  },
  {
    id: 'reviewed_public_chinese_argument_evidence',
    subjectId: 'chinese',
    type: 'wrong_cause',
    sourceAssetId: 'public_curriculum_standards_crosswalk',
    sourceAssetType: 'reading_skill_structure',
    label: '语文论证证据第一步',
    prompt: '读论述类材料时，先分清观点句和证据句，不直接写“说明了中心”。',
    firstStepHint: '先标出作者正在证明的观点。',
    blackboardMove: '小黑板画两栏：观点 / 证据。',
    wrongCauseProbe: '常见卡点是把例子当结论，没说出它服务哪个观点。',
    nearTransferStem: '换一段材料，只让孩子指出“这句话是在证明什么”。',
    parentCheck: '家长只问：这句材料是在帮哪个观点说话？',
    taskType: 'reading_inference',
    gradeBand: 'primary_to_junior'
  },
  {
    id: 'reviewed_public_english_time_anchor',
    subjectId: 'english',
    type: 'active_recall',
    sourceAssetId: 'public_curriculum_standards_crosswalk',
    sourceAssetType: 'grammar_skill_structure',
    label: '英语时态时间锚点',
    prompt: '做时态题时，先找时间锚点和动作是否已经发生，不直接凭语感选。',
    firstStepHint: '先圈时间词，再判断动作发生在过去、现在还是将来。',
    blackboardMove: '小黑板写：time word -> action state -> verb form。',
    wrongCauseProbe: '常见卡点是只看中文意思，没用时间锚点约束动词形式。',
    nearTransferStem: '换一句话，只保留时间词，让孩子先判断动作状态。',
    parentCheck: '家长只问：你圈到的时间词是什么？',
    taskType: 'english_grammar',
    gradeBand: 'primary_to_junior'
  },
  {
    id: 'reviewed_public_physics_force_diagram',
    subjectId: 'physics',
    type: 'near_transfer',
    sourceAssetId: 'phet_simulation_oer',
    sourceAssetType: 'visual_board_structure',
    label: '物理受力图第一笔',
    prompt: '遇到受力题，先画研究对象和接触面，不直接代公式。',
    firstStepHint: '先圈研究对象，再标接触面。',
    blackboardMove: '小黑板只画一个物体框和接触面箭头。',
    wrongCauseProbe: '常见卡点是把所有力都写上，却没确认研究对象。',
    nearTransferStem: '换一个场景，只检查研究对象有没有重新圈准。',
    parentCheck: '家长只问：你研究的是哪个物体？',
    taskType: 'physics_diagram',
    gradeBand: 'junior'
  },
  {
    id: 'reviewed_public_chem_experiment_sequence',
    subjectId: 'chemistry',
    type: 'wrong_cause',
    sourceAssetId: 'openscied_science_inquiry_structure',
    sourceAssetType: 'evidence_chain_board',
    label: '化学实验顺序证据链',
    prompt: '做实验现象题时，先写“操作 -> 现象 -> 说明”，不直接背结论。',
    firstStepHint: '先把题目里的操作顺序排出来。',
    blackboardMove: '小黑板三格：操作 / 现象 / 说明。',
    wrongCauseProbe: '常见卡点是只记现象，不知道现象对应哪一步操作。',
    nearTransferStem: '换一个实验，只保留三格证据链。',
    parentCheck: '家长只问：这个现象是哪一步操作后出现的？',
    taskType: 'chemistry_experiment',
    gradeBand: 'junior'
  },
  {
    id: 'reviewed_public_biology_structure_function',
    subjectId: 'biology',
    type: 'active_recall',
    sourceAssetId: 'libretexts_stem_reference',
    sourceAssetType: 'concept_prerequisite_ladder',
    label: '生物结构功能对应',
    prompt: '遇到结构功能题，先说结构位置和功能关键词，不直接背整段定义。',
    firstStepHint: '先说这个结构在哪里，再说它服务什么功能。',
    blackboardMove: '小黑板写：结构位置 -> 功能关键词。',
    wrongCauseProbe: '常见卡点是背了名词，但不能把结构和功能连起来。',
    nearTransferStem: '换一个结构，只要求说出位置和功能关键词。',
    parentCheck: '家长只问：这个结构帮身体完成什么事？',
    taskType: 'biology_concept',
    gradeBand: 'junior'
  },
  {
    id: 'reviewed_public_geo_space_relation',
    subjectId: 'geography',
    type: 'near_transfer',
    sourceAssetId: 'geogebra_classroom_activity',
    sourceAssetType: 'spatial_reasoning_structure',
    label: '地理空间关系第一步',
    prompt: '做地理图题时，先找方向、位置、变化量，不直接猜结论。',
    firstStepHint: '先确定方向和参照物。',
    blackboardMove: '小黑板画：方向箭头 + 参照物 + 变化量。',
    wrongCauseProbe: '常见卡点是看到了图，却没说参照物和方向。',
    nearTransferStem: '换一张图，只检查方向和参照物是否先说清。',
    parentCheck: '家长只问：你是相对哪个地方判断方向的？',
    taskType: 'geography_spatial',
    gradeBand: 'junior'
  }
];

function buildReviewedPublicCurriculumAssetCards(units = []) {
  return REVIEWED_PUBLIC_CURRICULUM_ASSET_CARDS.map((asset, index) => {
    const unit = units.find((item) => item.subjectId === asset.subjectId) || units[index % Math.max(units.length, 1)] || {};
    const baseCard = {
      id: asset.id,
      unitId: unit.id || `${asset.subjectId}_reviewed_public_unit`,
      subjectId: asset.subjectId,
      subjectLabel: unit.subjectLabel || asset.subjectId,
      type: asset.type,
      label: asset.label,
      prompt: asset.prompt,
      answerBoundary: '只使用公开资料的结构信号生成第一步练习，不展示原题、原文、图片、答案或标准解析。',
      wrongCause: asset.wrongCauseProbe,
      visualMove: asset.blackboardMove,
      evidenceRequired: 'reviewed_public_asset_first_step',
      sourceContentPolicy: 'no_source_text_no_source_image_no_source_answer',
      answerVisibility: 'first_step_only_no_full_answer',
      oerResourceId: asset.sourceAssetId,
      sourceRegistryId: asset.sourceAssetId,
      sourceAssetId: asset.sourceAssetId,
      sourceAssetType: asset.sourceAssetType,
      sourceUrl: `structure-only://${asset.sourceAssetId}`,
      licenseSignal: 'structure_signal_only_reviewed_before_use',
      commercialDecision: '只借鉴题型结构、能力动词和课堂活动形态；不复制、不搬运、不导入原题原文，不宣称官方合作。',
      distributionPolicy: 'structure_index_only_no_source_content_distribution',
      licenseCheckedAt: '2026-05-20',
      rightsBoundary: '只使用结构信号、能力轴和教学活动形态，不复制原文、图片、题目、答案或品牌素材。',
      allowedDerivedArtifacts: ['first_step_card', 'wrong_cause_probe', 'visual_board_move', 'near_transfer_prompt', 'parent_check_line'],
      mustNotSurface: ['source_original_text', 'source_question', 'source_answer', 'source_image', 'brand_claim', 'official_partnership_claim', 'full_solution', 'answer_key'],
      oerReuseLevel: 'structure_only',
      oerDerivedArtifact: 'reviewed_public_curriculum_asset_card',
      oerAttributionRequired: false,
      derivedFrom: 'structure_only',
      answerPolicy: 'first_step_only_no_full_answer',
      blockedFields: ['original_question', 'original_answer', 'source_image', 'full_answer', 'full_solution', 'score', 'ranking', 'full_dialogue'],
      aiRole: 'socratic_wording_only',
      localCodeOwns: ['source_match', 'license_boundary', 'question_type_route', 'answer_policy', 'xp_unlock', 'share_boundary'],
      sourceBacked: true,
      reviewedPublicAsset: true,
      sourceSampleId: asset.id,
      sourceId: asset.sourceAssetId,
      sourceType: asset.sourceAssetType,
      gradeBand: asset.gradeBand,
      sourceSampleStem: asset.prompt,
      sourceSampleFirstStep: asset.firstStepHint,
      sourceSampleWrongCause: asset.wrongCauseProbe,
      sourceSampleBoardMove: asset.blackboardMove,
      sourceSampleParentCheck: asset.parentCheck,
      sourceSampleNearTransfer: asset.nearTransferStem,
      sampleBackedEvidence: {
        sourceSampleId: asset.id,
        sourceId: asset.sourceAssetId,
        sourceType: asset.sourceAssetType,
        taskType: asset.taskType,
        answerPolicy: 'first_step_only_no_full_answer',
        sourceContentPolicy: 'no_source_text_no_source_image_no_source_answer',
        blockedFields: ['original_question', 'original_answer', 'source_image', 'full_answer', 'full_solution', 'score', 'ranking']
      },
      sampleStem: asset.prompt,
      firstStepHint: asset.firstStepHint,
      blackboardMove: asset.blackboardMove,
      wrongCauseProbe: asset.wrongCauseProbe,
      nearTransferStem: asset.nearTransferStem,
      parentCheck: asset.parentCheck,
      flashcardFront: asset.label,
      flashcardBack: asset.firstStepHint,
      quizPrompt: asset.nearTransferStem,
      spacedReviewWindow: '今晚 / 明天 / 第 7 天',
      activeRecallPrompt: `不看答案，说出：${asset.firstStepHint}`,
      memoryLoopMode: 'flashcard_quiz_active_recall_spaced_review',
      sampleId: `${asset.id}_sample`,
      classroomUse: '适合家庭晚间作业 3 分钟小黑板，不作为全科课堂或押题服务。',
      evidenceRubric: [
        '孩子能说出第一步',
        '孩子能命名错因',
        '孩子能做一次近迁移或隔天回看'
      ],
      safetyBoundary: '不展示完整答案、不替孩子写过程、不用分数或排名证明能力。'
    };
    return Object.assign({}, baseCard, {
      progression: buildQuestionProgressionCard(unit, baseCard, index)
    });
  });
}

function buildCourseUnitQuestionBank(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const active = courseUnitMap && courseUnitMap.active ? courseUnitMap.active : null;
  const subjects = courseUnitMap && Array.isArray(courseUnitMap.subjects) ? courseUnitMap.subjects : [];
  const units = subjects.reduce((list, subject) => list.concat(Array.isArray(subject.units) ? subject.units : []), []);
  const activeUnits = active && Array.isArray(active.units) ? active.units : [];
  const realHomeworkPressureSamples = Array.isArray(options.realHomeworkPressureSamples)
    ? options.realHomeworkPressureSamples
    : getRealHomeworkPressureSamplePool();
  const baseQuestionCards = units.reduce((list, unit) => {
    const base = `${unit.subjectLabel}/${unit.unitLabel}`;
    const cards = [
      {
        id: `${unit.id}_recall`,
        unitId: unit.id,
        subjectId: unit.subjectId,
        subjectLabel: unit.subjectLabel,
        type: 'active_recall',
        label: `${base}主动回忆`,
        prompt: unit.practiceLoop.recall,
        answerBoundary: '只要求说出第一步，不要求完整答案。',
        wrongCause: unit.wrongCauseAtlas[0],
        visualMove: unit.blackboardBlueprint.firstStroke,
        evidenceRequired: 'child_first_step'
      },
      {
        id: `${unit.id}_diagnose`,
        unitId: unit.id,
        subjectId: unit.subjectId,
        subjectLabel: unit.subjectLabel,
        type: 'wrong_cause',
        label: `${base}错因诊断`,
        prompt: unit.diagnosticProbes[0],
        answerBoundary: '只定位卡点，不讲完整解法。',
        wrongCause: unit.wrongCauseAtlas[1],
        visualMove: unit.blackboardBlueprint.visualPrompt,
        evidenceRequired: 'wrong_cause_named'
      },
      {
        id: `${unit.id}_transfer`,
        unitId: unit.id,
        subjectId: unit.subjectId,
        subjectLabel: unit.subjectLabel,
        type: 'near_transfer',
        label: `${base}同类小变式`,
        prompt: unit.practiceLoop.transfer,
        answerBoundary: '只检查方法能不能迁移，不追求刷题数量。',
        wrongCause: unit.wrongCauseAtlas[2],
        visualMove: unit.blackboardBlueprint.stopRule,
        evidenceRequired: 'near_transfer_attempted'
      }
    ];
    return list.concat(cards.map((card, cardIndex) => {
      const sample = buildQuestionSampleCard(unit, card.type, cardIndex, { realHomeworkPressureSamples });
      const mergedCard = Object.assign({}, card, sample);
      return Object.assign({}, mergedCard, {
        progression: buildQuestionProgressionCard(unit, mergedCard, cardIndex)
      });
    }));
  }, []);
  const reviewedPublicAssetCards = buildReviewedPublicCurriculumAssetCards(units);
  const questionCards = baseQuestionCards.concat(reviewedPublicAssetCards);
  const subjectDepthWeakQueue = units.map((unit) => ({
    unitId: unit.id,
    unitLabel: unit.unitLabel,
    subjectLabel: unit.subjectLabel,
    weakCards: ['active_recall', 'wrong_cause', 'near_transfer'].map((type, index) => {
      const sample = buildQuestionSampleCard(unit, type, index, { realHomeworkPressureSamples });
      return {
        type,
        sampleId: sample.sampleId,
        sampleMatchScore: sample.sampleMatchScore || 0,
        sampleMatchTier: sample.sampleMatchTier || 'fallback',
        sampleMatchReasons: Array.isArray(sample.sampleMatchReasons) ? sample.sampleMatchReasons : [],
        sampleMatchWeaknesses: Array.isArray(sample.sampleMatchWeaknesses) ? sample.sampleMatchWeaknesses : []
      };
    })
  }));
  const activeUnitIds = activeUnits.reduce((acc, unit) => {
    acc[unit.id] = true;
    return acc;
  }, {});
  const activeCards = questionCards.filter((card) => activeUnitIds[card.unitId]).slice(0, 9);
  const byType = questionCards.reduce((acc, card) => {
    acc[card.type] = Number(acc[card.type] || 0) + 1;
    return acc;
  }, {});
  const transferLadders = units.map((unit) => buildQuestionTypeTransferLadder(
    unit,
    questionCards.filter((card) => card.unitId === unit.id)
  ));
  const activeTransferLadders = transferLadders.filter((ladder) => activeUnitIds[ladder.unitId]).slice(0, 3);
  return {
    id: 'course_unit_question_bank',
    title: '课程单元题库包',
    subjectLabel: active ? active.label : '',
    summary: `当前单元题库含 ${questionCards.length} 张可复用练习卡，覆盖主动回忆、错因诊断和同类迁移。`,
    boundary: '题库只沉淀第一步、错因和迁移证据，不提供拍题出完整答案。',
    unitCount: units.length,
    subjectCount: subjects.length,
    questionCount: questionCards.length,
    reviewedPublicAssetCount: reviewedPublicAssetCards.length,
    reviewedPublicAssetSubjectCount: new Set(reviewedPublicAssetCards.map((card) => card.subjectId).filter(Boolean)).size,
    sourceBackedCount: questionCards.filter((card) => card.sourceBacked && card.sourceSampleId && card.sampleBackedEvidence).length,
    sourceBackedSubjectCount: new Set(questionCards.filter((card) => card.sourceBacked).map((card) => card.subjectLabel)).size,
    sourceBackedGradeBandCount: new Set(questionCards.filter((card) => card.sourceBacked).map((card) => card.gradeBand).filter(Boolean)).size,
    sourceBackedTaskTypeCount: new Set(questionCards.filter((card) => card.sourceBacked).map((card) => card.sampleBackedEvidence && card.sampleBackedEvidence.taskType || card.taskType).filter(Boolean)).size,
    sampleCount: questionCards.filter((card) => card.sampleStem && card.firstStepHint && card.nearTransferStem).length,
    progressionCount: questionCards.filter((card) => card.progression && card.progression.entryTask && card.progression.masteryGate).length,
    progressionStageCount: questionCards.reduce((sum, card) => sum + Number(card.progression && card.progression.stageCount || 0), 0),
    masteryGateCount: questionCards.filter((card) => card.progression && card.progression.masteryGate).length,
    transferLadderCount: transferLadders.length,
    transferLadderRungCount: transferLadders.reduce((sum, ladder) => sum + (Array.isArray(ladder.rungs) ? ladder.rungs.length : 0), 0),
    transferLadderBlockerCount: transferLadders.reduce((sum, ladder) => sum + (Array.isArray(ladder.blockerRules) ? ladder.blockerRules.length : 0), 0),
    byType,
    cards: questionCards,
    activeCards,
    transferLadders,
    activeTransferLadders,
    subjectDepthWeakQueue,
    reportLine: `报告可追踪 ${units.length} 个单元、${questionCards.length} 张题库卡的下一证据。`,
    gameLine: '游戏优先抽主动回忆和错因诊断卡，迁移卡只做小变式。',
    shareLine: '分享只带题库动作和证据合同，不带原题答案。'
  };
}

function buildCourseUnitDepthExpansionAtlas(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const courseUnitQuestionBank = options.courseUnitQuestionBank || buildCourseUnitQuestionBank({ courseUnitMap });
  const active = courseUnitMap && courseUnitMap.active ? courseUnitMap.active : null;
  const subjects = courseUnitMap && Array.isArray(courseUnitMap.subjects) ? courseUnitMap.subjects : [];
  const units = subjects.reduce((list, subject) => list.concat(Array.isArray(subject.units) ? subject.units : []), []);
  const cards = courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.cards) ? courseUnitQuestionBank.cards : [];
  const cardsByUnit = cards.reduce((acc, card) => {
    if (!acc[card.unitId]) acc[card.unitId] = [];
    acc[card.unitId].push(card);
    return acc;
  }, {});
  const unitAtlases = units.map((unit) => {
    const unitCards = cardsByUnit[unit.id] || [];
    const archetypes = (unit.reusableQuestionTypes || []).map((questionType, index) => {
      const card = unitCards[index] || unitCards[0] || {};
      const wrongCause = card.sourceSampleWrongCause || card.wrongCauseProbe || (unit.wrongCauseAtlas || [])[index] || card.wrongCause || `${unit.unitLabel}错因未命名`;
      const probe = card.sourceSampleFirstStep || (unit.diagnosticProbes || [])[index] || card.firstStepHint || `先说 ${unit.unitLabel} 的第一步`;
      const boardMove = index === 0
        ? (unit.blackboardBlueprint && unit.blackboardBlueprint.firstStroke)
        : index === 1
          ? (unit.blackboardBlueprint && unit.blackboardBlueprint.visualPrompt)
          : (unit.blackboardBlueprint && unit.blackboardBlueprint.stopRule);
      const sampleStem = card.sourceSampleStem || card.sampleStem || `${unit.subjectLabel}：围绕 ${unit.unitLabel} 做一题小练习。`;
      const sampleWrongCause = card.sourceSampleWrongCause || wrongCause;
      const sampleTransfer = card.sourceSampleNearTransfer || card.nearTransferStem || `${unit.unitLabel}换一个条件后，仍然先复述第一步。`;
      return {
        id: `${unit.id}_depth_archetype_${index + 1}`,
        unitId: unit.id,
        subjectId: unit.subjectId,
        subjectLabel: unit.subjectLabel,
        unitLabel: unit.unitLabel,
        label: questionType,
        sampleStem,
        sourceBacked: !!card.sourceBacked,
        sourceSampleId: card.sourceSampleId || '',
        sourceId: card.sourceId || '',
        sampleBackedEvidence: card.sampleBackedEvidence || null,
        diagnosticProbe: probe,
        misconceptionVariants: [
          sampleWrongCause,
          `${unit.unitLabel}只记住题面词，没说出第一步依据。`,
          sampleTransfer
        ],
        visualBoardTemplate: {
          title: `${unit.subjectLabel}/${unit.unitLabel} 第一笔小黑板`,
          opening: card.sourceSampleBoardMove || card.blackboardMove || boardMove || `只画 ${unit.unitLabel} 的第一步关系。`,
          drawSteps: [
            `圈出目标：${unit.unitLabel}`,
            `标一条证据：${probe}`,
            '停在第一步，让孩子自己说下一句'
          ],
          stopRule: '孩子能说出第一步和错因名就停，不补完整答案。'
        },
        parentCheckScript: `家长只问：这题属于「${questionType}」吗？你第一步先看哪里？`,
        recallRoute: unit.recallRoute || '/pages/review/review',
        gameHook: card.progression && card.progression.nextDayRevisit
          ? card.progression.nextDayRevisit
          : '明天用 1 道同类小题遮答案回访。',
        reportEvidence: card.progression && card.progression.parentEvidence
          ? card.progression.parentEvidence
          : unit.reportContract,
        shareSafeLine: `分享只带「${unit.unitLabel}」的题型名、第一步和回访动作，不带原题、完整答案、分数或排名。`,
        noFullAnswerBoundary: '只做第一步图解、错因命名和近迁移，不做拍题完整解答。'
      };
    });
    return {
      id: `${unit.id}_depth_atlas`,
      unitId: unit.id,
      subjectId: unit.subjectId,
      subjectLabel: unit.subjectLabel,
      unitLabel: unit.unitLabel,
      title: `${unit.subjectLabel}/${unit.unitLabel} 题型深度图谱`,
      archetypeCount: archetypes.length,
      misconceptionCount: archetypes.reduce((sum, item) => sum + item.misconceptionVariants.length, 0),
      boardMoveCount: archetypes.reduce((sum, item) => sum + item.visualBoardTemplate.drawSteps.length, 0),
      parentCheckCount: archetypes.length,
      archetypes,
      reportLine: `${unit.subjectLabel}/${unit.unitLabel} 已拆成 ${archetypes.length} 类原型题、${archetypes.length * 3} 条误区变体和第一步小黑板。`,
      parentLine: `家长今晚只检查 ${unit.unitLabel} 的一类原型题，不扩成整科刷题。`,
      gameLine: `游戏只抽 ${unit.unitLabel} 的主动回忆、错因修复和近迁移，不按刷题数量奖励。`,
      shareBoundary: `分享只带 ${unit.unitLabel} 的题型动作、回访计划和安全接力口径。`
    };
  });
  const activeUnitIds = active && Array.isArray(active.units)
    ? active.units.reduce((acc, unit) => {
      acc[unit.id] = true;
      return acc;
    }, {})
    : {};
  const activeAtlases = unitAtlases.filter((item) => activeUnitIds[item.unitId]).slice(0, 3);
  const activeArchetypes = activeAtlases.reduce((list, atlas) => list.concat(atlas.archetypes || []), []).slice(0, 9);
  return {
    id: 'course_unit_depth_expansion_atlas',
    title: '题型深度扩展图谱',
    subjectLabel: active ? active.label : '',
    summary: `已把 ${unitAtlases.length} 个单元扩展为原型题、误区变体、第一步小黑板、家长检查、游戏回访和安全分享。`,
    boundary: '这是题型级内容厚度，不是全科拍题讲完整答案。',
    unitCount: unitAtlases.length,
    archetypeCount: unitAtlases.reduce((sum, item) => sum + item.archetypeCount, 0),
    sourceBackedArchetypeCount: unitAtlases.reduce((sum, item) => sum + (item.archetypes || []).filter((archetype) => archetype.sourceBacked && archetype.sourceSampleId).length, 0),
    misconceptionVariantCount: unitAtlases.reduce((sum, item) => sum + item.misconceptionCount, 0),
    visualBoardMoveCount: unitAtlases.reduce((sum, item) => sum + item.boardMoveCount, 0),
    parentCheckScriptCount: unitAtlases.reduce((sum, item) => sum + item.parentCheckCount, 0),
    shareBoundaryCount: unitAtlases.filter((item) => item.shareBoundary).length,
    atlases: unitAtlases,
    activeAtlases,
    activeArchetypes,
    reportLine: `报告可引用 ${unitAtlases.length} 个单元、${unitAtlases.reduce((sum, item) => sum + item.archetypeCount, 0)} 类原型题和 ${unitAtlases.reduce((sum, item) => sum + item.misconceptionCount, 0)} 条误区变体。`,
    tutorLine: '点拨先选原型题，再用 A/B 微选择定位错因，最后只画第一步小黑板。',
    gameLine: '游戏按“认题型-说错因-近迁移-隔日回访”抽卡，不做刷题瀑布流。',
    parentLine: '家长看到的是可执行检查话术和下一次证据，不是题库清单。'
  };
}

function buildCommercialDepthRunway(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const courseUnitQuestionBank = options.courseUnitQuestionBank || buildCourseUnitQuestionBank({ courseUnitMap });
  const courseUnitDepthExpansionAtlas = options.courseUnitDepthExpansionAtlas || buildCourseUnitDepthExpansionAtlas({ courseUnitMap, courseUnitQuestionBank });
  const gradeChapterTeachingStrategyMap = options.gradeChapterTeachingStrategyMap || buildGradeChapterTeachingStrategyMap({ courseUnitMap });
  const courseUnitMasteryTrajectory = options.courseUnitMasteryTrajectory || buildCourseUnitMasteryTrajectory({ courseUnitMap });
  const subjectSkillDepth = options.subjectSkillDepth || buildSubjectSkillDepth(options);
  const activeUnit = courseUnitMap && courseUnitMap.active && Array.isArray(courseUnitMap.active.units)
    ? courseUnitMap.active.units[0]
    : null;
  const activeCards = Array.isArray(courseUnitQuestionBank.activeCards) ? courseUnitQuestionBank.activeCards : [];
  const weakest = courseUnitMasteryTrajectory && courseUnitMasteryTrajectory.weakest
    ? courseUnitMasteryTrajectory.weakest
    : null;
  const lanes = [
    {
      id: 'grade_chapter_strategy',
      label: '年级章节教学策略',
      route: '/pages/entry-detail/entry-detail?scene=tutor',
      evidenceLine: `已沉淀 ${gradeChapterTeachingStrategyMap.strategyCount || 0} 条年级/章节/题型策略，覆盖识别题型、修错因和近迁移。`,
      nextAction: '今晚只选一条策略落到第一步小黑板。',
      proof: ['年级段', '章节', '题型', '错因', '本地放行']
    },
    {
      id: 'question_type_depth',
      label: '题型级内容深度',
      route: '/pages/entry-detail/entry-detail?scene=today',
      evidenceLine: `已有 ${activeCards.length} 张单元题库卡，外加 ${courseUnitDepthExpansionAtlas.archetypeCount || 0} 类原型题和 ${courseUnitDepthExpansionAtlas.misconceptionVariantCount || 0} 条误区变体。`,
      nextAction: activeCards[0] ? activeCards[0].prompt : '先补一张主动回忆卡',
      proof: (courseUnitDepthExpansionAtlas.activeArchetypes || []).slice(0, 3).map((item) => `${item.label}：${item.parentCheckScript}`)
    },
    {
      id: 'memory_feedback',
      label: '游戏记忆反馈',
      route: '/pages/arcade/arcade',
      evidenceLine: weakest
        ? `${weakest.unitLabel} 当前掌握度 ${weakest.masteryScore}，先用低压回忆修 ${weakest.regressionRisk}。`
        : '先完成一局主动回忆，再生成错因回放和间隔回访。',
      nextAction: '今天只打 3 张回忆卡，错因卡自动回到下一轮',
      proof: ['首轮主动回忆', '错因回放', '明日轻回看']
    },
    {
      id: 'parent_decision_trust',
      label: '家长报告可信度',
      route: '/pages/profile/profile',
      evidenceLine: weakest
        ? `家长只看 ${weakest.unitLabel} 的下一证据：${weakest.nextEvidence}`
        : '报告先说明证据够不够，再建议家长是否介入。',
      nextAction: weakest ? weakest.parentInterventionLevel : '先收集孩子第一步、错因、次日回看三类证据',
      proof: ['不展示排名', '不承诺提分', '只给下一步家庭动作']
    }
  ];
  const readyCount = lanes.filter((lane) => lane.proof && lane.proof.length >= 3).length;
  return {
    id: 'commercial_depth_runway',
    title: '三线加厚作战板',
    summary: `策略、题型、记忆、家长决策 ${readyCount}/${lanes.length} 条线已有可执行证据。`,
    boundary: '只做第一步小黑板、错因图解、近迁移和家长行动判断；不承诺全科拍题自动板书或直接答案。',
    lanes,
    gradeChapterTeachingStrategyMap,
    visualBoardMoves: [
      activeUnit && activeUnit.blackboardBlueprint ? activeUnit.blackboardBlueprint.firstStroke : subjectSkillDepth.firstStep,
      activeUnit && activeUnit.blackboardBlueprint ? activeUnit.blackboardBlueprint.visualPrompt : subjectSkillDepth.parentQuestion,
      activeUnit && activeUnit.blackboardBlueprint ? activeUnit.blackboardBlueprint.stopRule : '画到第一步就停，不替孩子完成答案'
    ].filter(Boolean),
    memoryCadence: [
      { id: 'today', label: '今天', action: '3 张主动回忆卡，只问第一步' },
      { id: 'tomorrow', label: '明天', action: '错因卡轻回看，答错不扣信心' },
      { id: 'day7', label: '第 7 天', action: '做 1 张近迁移卡，确认方法能搬家' }
    ],
    parentDecisionRubric: [
      '孩子能说第一步：家长只确认，不加讲解',
      '孩子只说不会：回到小黑板第一笔',
      '同类小变式仍错：报告标记为需要陪伴修卡点'
    ],
    reportLine: '报告不只汇总结果，而是给出下一证据、介入等级和一周观察口径。',
    gameLine: '游戏不只给 XP，而是把主动回忆、错因回放、间隔回看接成记忆反馈。',
    tutorLine: '点拨不讲完整答案，只暴露题型轴、小黑板第一笔和失败兜底。',
    shareLine: '分享只带行动卡和证据合同，不带原题、完整对话、分数或排名。'
  };
}

function buildWeeklyEvidenceFlywheel(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const courseUnitQuestionBank = options.courseUnitQuestionBank || buildCourseUnitQuestionBank({ courseUnitMap });
  const courseUnitMasteryTrajectory = options.courseUnitMasteryTrajectory || buildCourseUnitMasteryTrajectory({ courseUnitMap });
  const commercialDepthRunway = options.commercialDepthRunway || buildCommercialDepthRunway({
    courseUnitMap,
    courseUnitQuestionBank,
    courseUnitMasteryTrajectory,
    subjectSkillDepth: options.subjectSkillDepth
  });
  const communityShareRelayBoard = options.communityShareRelayBoard || buildCommunityShareRelayBoard(options);
  const activeCards = Array.isArray(courseUnitQuestionBank.activeCards) ? courseUnitQuestionBank.activeCards : [];
  const weakest = courseUnitMasteryTrajectory && courseUnitMasteryTrajectory.weakest
    ? courseUnitMasteryTrajectory.weakest
    : {};
  const lanes = Array.isArray(commercialDepthRunway.lanes) ? commercialDepthRunway.lanes : [];
  const days = [
    {
      day: 1,
      label: '说出第一步',
      childAction: activeCards[0] ? activeCards[0].prompt : '先说第一步',
      evidence: 'child_first_step',
      parentDecision: '能说出第一步就收口，不继续讲完整答案',
      gameReturn: '主动回忆 3 张'
    },
    {
      day: 2,
      label: '命名错因',
      childAction: activeCards[1] ? activeCards[1].prompt : '说出卡在哪里',
      evidence: 'wrong_cause_named',
      parentDecision: '只问错因，不追问分数',
      gameReturn: '错因回放 1 轮'
    },
    {
      day: 3,
      label: '近迁移',
      childAction: activeCards[2] ? activeCards[2].prompt : '做一张小变式',
      evidence: 'near_transfer_attempted',
      parentDecision: '看方法能不能搬家，不用刷题量证明',
      gameReturn: '小变式轻挑战'
    },
    {
      day: 4,
      label: '隔天回看',
      childAction: weakest.nextEvidence || '回看昨天错因卡',
      evidence: 'next_day_revisit',
      parentDecision: weakest.parentInterventionLevel || '证据不足时先陪孩子复述第一步',
      gameReturn: '间隔回访'
    },
    {
      day: 5,
      label: '小黑板复述',
      childAction: '把第一笔、小图、停止点各说一句',
      evidence: 'visual_board_replay',
      parentDecision: '能复述图解就不补课式讲解',
      gameReturn: '视觉步骤排序'
    },
    {
      day: 6,
      label: '家庭判断',
      childAction: '说出下次先检查哪里',
      evidence: 'parent_decision_receipt',
      parentDecision: '家长只决定明天陪不陪，不做情绪评价',
      gameReturn: '错因标签回收'
    },
    {
      day: 7,
      label: '周复盘',
      childAction: '选一张最有用的行动卡',
      evidence: 'weekly_action_card',
      parentDecision: '只看证据是否变稳定，不做排名比较',
      gameReturn: '近迁移验收'
    }
  ];
  return {
    id: 'weekly_evidence_flywheel',
    title: '7 天证据飞轮',
    summary: `用 ${days.length} 天把题型卡、游戏回忆、家长判断和安全分享连成长期画像。`,
    readiness: days.length >= 7 && lanes.length >= 3 ? 'closed_loop' : 'building',
    days,
    lanes,
    parentTrustLine: weakest.unitLabel
      ? `本周家长只盯 ${weakest.unitLabel}：${weakest.nextEvidence || '下一证据'}。`
      : '本周家长只盯第一步、错因、隔天回看三类证据。',
    portraitLine: '长期画像来自连续证据，不来自一次测评或一次聊天。',
    memoryLine: commercialDepthRunway.gameLine || '主动回忆、错因回放、间隔回看形成记忆反馈。',
    shareLine: communityShareRelayBoard.noRankingLine || '分享只做行动接力，不做排名比较。',
    privacyBoundary: '不分享原题照片、完整对话、孩子分数、排名或隐私评价。',
    sharePayload: {
      flywheel_id: 'weekly_evidence_flywheel',
      evidence_days: days.length,
      allowed_fields: ['day_label', 'child_action', 'evidence', 'parent_decision'],
      blocked_fields: ['original_photo', 'full_dialogue', 'score', 'ranking', 'private_comment']
    },
    acceptanceLine: '一周后必须能回答：孩子第一步是否更稳定、错因是否更具体、同类小变式是否能迁移。',
    moatLine: '护城河不是题量，而是家庭证据连续沉淀后形成的低压学习画像。'
  };
}

function buildSevenSubjectMasterySprint(options = {}) {
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const courseUnitQuestionBank = options.courseUnitQuestionBank || buildCourseUnitQuestionBank({ courseUnitMap });
  const courseUnitMasteryTrajectory = options.courseUnitMasteryTrajectory || buildCourseUnitMasteryTrajectory({ courseUnitMap });
  const commercialDepthRunway = options.commercialDepthRunway || buildCommercialDepthRunway({
    courseUnitMap,
    courseUnitQuestionBank,
    courseUnitMasteryTrajectory,
    subjectSkillDepth: options.subjectSkillDepth
  });
  const weeklyEvidenceFlywheel = options.weeklyEvidenceFlywheel || buildWeeklyEvidenceFlywheel({
    courseUnitMap,
    courseUnitQuestionBank,
    courseUnitMasteryTrajectory,
    commercialDepthRunway,
    subjectSkillDepth: options.subjectSkillDepth
  });
  const subjects = courseUnitMap && Array.isArray(courseUnitMap.subjects) ? courseUnitMap.subjects : [];
  const safeSharePayload = weeklyEvidenceFlywheel && weeklyEvidenceFlywheel.sharePayload
    ? weeklyEvidenceFlywheel.sharePayload
    : {
      allowed_fields: ['subject', 'first_step', 'wrong_cause', 'next_action'],
      blocked_fields: ['original_photo', 'full_dialogue', 'score', 'ranking', 'private_comment']
    };
  const sprintSubjects = subjects.map((subject, index) => {
    const units = Array.isArray(subject.units) ? subject.units : [];
    const firstUnit = units[0] || {};
    const secondUnit = units[1] || firstUnit;
    const thirdUnit = units[2] || secondUnit;
    return {
      id: subject.id || `subject_${index + 1}`,
      label: subject.label || `学科 ${index + 1}`,
      displayTitle: subject.label || `学科 ${index + 1}`,
      route: subject.route || '/pages/tutor/tutor',
      contentScaleTarget: `${units.length || 3} 个单元 / 每单元 3 类题卡 / 每类保留第一步、错因、近迁移`,
      tutorDepthTarget: firstUnit.diagnosticProbes && firstUnit.diagnosticProbes[0]
        ? firstUnit.diagnosticProbes[0]
        : '先问题型轴，再问第一步，不直接讲完整答案。',
      visualBoardTarget: firstUnit.blackboardBlueprint && firstUnit.blackboardBlueprint.firstStroke
        ? firstUnit.blackboardBlueprint.firstStroke
        : '只画第一笔、关系线或检查点，画到孩子能开口就停。',
      memoryGameTarget: secondUnit.practiceLoop && secondUnit.practiceLoop.recall
        ? secondUnit.practiceLoop.recall
        : '每天 3 张主动回忆卡，错因卡隔天回看。',
      parentDecisionTarget: thirdUnit.parentAction || firstUnit.parentAction || '家长只判断孩子能否说出第一步和下一次先查什么。',
      shareRelayTarget: thirdUnit.shareContract || firstUnit.shareContract || '分享只带行动卡和证据合同，不带原题答案、完整对话、分数或排名。',
      evidenceKeys: ['child_first_step', 'wrong_cause_named', 'near_transfer_attempted', 'next_day_revisit'],
      readinessGate: '至少连续 7 天出现第一步、错因、回看、近迁移四类证据，才进入长期画像。'
    };
  });
  const totalUnitCount = subjects.reduce((sum, subject) => sum + Number(subject.unitCount || (subject.units ? subject.units.length : 0)), 0);
  const totalQuestionCards = courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.cards)
    ? courseUnitQuestionBank.cards.length
    : sprintSubjects.length * 3;
  return {
    id: 'seven_subject_mastery_sprint',
    title: '七科掌握冲刺',
    summary: `把 ${sprintSubjects.length} 科从入口文案加厚成题型、点拨、小黑板、游戏回忆、家长证据和安全分享的同一套闭环。`,
    readiness: sprintSubjects.length >= 7 && totalQuestionCards >= 9 ? 'cross_module_ready' : 'building',
    subjectCount: sprintSubjects.length,
    unitCount: totalUnitCount,
    questionCardCount: totalQuestionCards,
    subjects: sprintSubjects,
    activeSubject: sprintSubjects[0] || null,
    lanes: [
      { id: 'content_scale', label: '内容规模', target: '每科至少 3 个单元、9 张可复用题卡，先覆盖高频家庭作业题型。' },
      { id: 'ai_depth', label: 'AI 点拨深度', target: '题型轴 + 第一问 + 小黑板第一笔 + 失败兜底，不走直接答案。' },
      { id: 'memory_game', label: '游戏记忆反馈', target: '主动回忆、错因回放、隔天回看、近迁移挑战进入同一条 quest。' },
      { id: 'parent_trust', label: '家长报告可信度', target: '报告只给家庭动作、证据是否足够、是否需要陪做，不给排名焦虑。' },
      { id: 'safe_share', label: '安全分享接力', target: '分享只传行动、证据、下一步，屏蔽原图、完整对话、分数、排名和私密评论。' }
    ],
    parentDecisionLine: '家长看到的是“今晚陪不陪、问哪一句、明天看什么证据”，不是一堵数据墙。',
    gameIntensityLine: '游戏强度按 3 张回忆卡、1 张错因卡、1 个近迁移动作推进，避免空刷 XP。',
    tutorBoundaryLine: '点拨只做到孩子能说第一步，不替孩子完成整题。',
    shareBoundaryLine: safeSharePayload.blocked_fields && safeSharePayload.blocked_fields.length
      ? `安全分享禁止：${safeSharePayload.blocked_fields.join(' / ')}`
      : '安全分享禁止原图、完整对话、分数、排名和私密评论。',
    moatLine: '护城河不是七科都能讲，而是每科都沉淀家庭证据、错因画像和下一次行动。',
    nextBuildLine: '下一轮优先补真实题型样本：数学应用题、英语听写、物理图像题三类先打穿。',
    generatedAt: options.now ? new Date(options.now).toISOString() : rcNowIso()
  };
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
    parentAskedOneQuestion: !!input.parentAskedOneQuestion,
    childRecalledFirstStep: !!input.childRecalledFirstStep,
    nextDayRevisit: !!input.nextDayRevisit,
    reflectionResult: input.reflectionResult || '',
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

function buildTransferPracticeSet(input = {}) {
  const taskType = input.taskType || detectTaskType(input.stuckPointText || '', input.subject || '');
  const step = input.childArticulatedStep || input.firstStep || suggestedStepForTaskType(taskType);
  const cause = input.wrongCauseBucket
    ? {
      id: input.wrongCauseBucket,
      label: input.wrongCauseLabel || input.wrongCauseBucket,
      parentPrompt: input.parentPrompt || parentQuestionFromFirstStep(step),
      nextPracticeText: input.nextPracticeText || ''
    }
    : wrongCauseFromFirstStep(step, taskType);
  const scaffolds = deepScaffoldingTemplates(taskType);
  const base = {
    taskType,
    wrongCauseBucket: cause.id,
    wrongCauseLabel: cause.label,
    sourceFirstStep: step,
    noFinalAnswer: true,
    safetyLine: '只练迁移方法，不给最终答案。',
    parentPrompt: cause.parentPrompt,
    nextEvidenceRequired: ['near_transfer_attempted', 'far_transfer_attempted', 'child_explains_back']
  };
  const prompts = [
    {
      id: 'near_transfer',
      label: '同类小变式',
      prompt: `换一个数字或条件，第一步仍然先做：${step || scaffolds[0]}`,
      check: scaffolds[1] || cause.nextPracticeText
    },
    {
      id: 'far_transfer',
      label: '换场景迁移',
      prompt: `换成另一道${taskTypeLabel(taskType)}，先说这次第一步和刚才哪里一样。`,
      check: scaffolds[2] || '只说方法相同点，不急着算结果。'
    },
    {
      id: 'teach_back',
      label: '教家长一句',
      prompt: `用一句话教家长：这类题下次第一步先看什么？`,
      check: cause.parentPrompt
    }
  ];
  return Object.assign({}, base, { prompts });
}

function recordParentReflectionReceipt(input = {}) {
  const childStep = input.childArticulatedStep || (loadRawTodaySession() || {}).childArticulatedStep || '';
  const record = appendParentInterventionLog({
    source: input.source || 'parent_reflection',
    usedProductPhrase: input.usedProductPhrase !== false,
    gaveDirectAnswer: !!input.gaveDirectAnswer,
    parentAskedOneQuestion: input.parentAskedOneQuestion !== false,
    childRecalledFirstStep: !!input.childRecalledFirstStep,
    nextDayRevisit: !!input.nextDayRevisit,
    reflectionResult: input.reflectionResult || (childStep ? 'child_recalled_or_rephrased_first_step' : 'parent_question_used'),
    phrase: input.phrase || parentQuestionFromFirstStep(childStep),
    emotionLevel: input.emotionLevel || 3
  });
  appendValidationEvent('parent_reflection_receipt', {
    parentAskedOneQuestion: record.parentAskedOneQuestion,
    childRecalledFirstStep: record.childRecalledFirstStep,
    nextDayRevisit: record.nextDayRevisit,
    gaveDirectAnswer: record.gaveDirectAnswer
  });
  return record;
}

function buildParentReflectionSummary() {
  const logs = loadParentInterventionLog();
  const reflectionLogs = logs.filter((item) => item && (
    item.source === 'parent_reflection'
    || item.parentAskedOneQuestion
    || item.childRecalledFirstStep
    || item.nextDayRevisit
  ));
  const asked = reflectionLogs.filter((item) => item.parentAskedOneQuestion).length;
  const recalled = reflectionLogs.filter((item) => item.childRecalledFirstStep).length;
  const revisited = reflectionLogs.filter((item) => item.nextDayRevisit).length;
  const direct = reflectionLogs.filter((item) => item.gaveDirectAnswer).length;
  return {
    title: '家长追问回执',
    total: reflectionLogs.length,
    askedOneQuestion: asked,
    childRecalledFirstStep: recalled,
    nextDayRevisit: revisited,
    directAnswerCount: direct,
    ready: reflectionLogs.length > 0 && asked > 0 && direct === 0,
    line: reflectionLogs.length
      ? `已记录 ${asked} 次只问一句，${recalled} 次孩子复述第一步，${revisited} 次次日回访。`
      : '今晚用一句话追问后，可以留下是否复述、是否次日回访的回执。'
  };
}

function recordTransferPracticeAttempt(input = {}) {
  const cardId = input.cardId || input.card_id || '';
  const promptId = input.promptId || input.prompt_id || 'near_transfer';
  const cards = loadReviewCards();
  let target = null;
  const nextCards = cards.map((card) => {
    if (!card || (cardId && card.id !== cardId)) return card;
    if (!cardId && target) return card;
    const plan = Object.assign({}, card.nextPracticePlan || {});
    const set = Object.assign({}, plan.transferPracticeSet || buildTransferPracticeSet({
      taskType: card.taskType,
      childArticulatedStep: card.childArticulatedStep,
      wrongCauseBucket: card.wrongCauseBucket,
      wrongCauseLabel: card.wrongCauseLabel,
      stuckPointText: card.stuckPointText,
      parentPrompt: card.parentPrompt
    }));
    const attempts = Array.isArray(set.attempts) ? set.attempts.slice() : [];
    const attempt = {
      id: input.id || `transfer_attempt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      promptId,
      result: input.result || 'attempted',
      childExplanation: input.childExplanation || input.explanation || '',
      parentChecked: !!input.parentChecked,
      createdAt: input.createdAt || rcNowIso()
    };
    set.attempts = [attempt].concat(attempts).slice(0, 20);
    set.completedPromptIds = Array.from(new Set(set.attempts.map((item) => item.promptId).filter(Boolean)));
    set.completedCount = set.completedPromptIds.length;
    set.readyForParentTeachBack = set.completedPromptIds.includes('teach_back');
    target = Object.assign({}, card, {
      nextPracticePlan: Object.assign({}, plan, { transferPracticeSet: set }),
      transferPracticeStatus: {
        completedCount: set.completedCount,
        latestResult: attempt.result,
        readyForParentTeachBack: set.readyForParentTeachBack
      },
      updated_at: rcNowIso()
    });
    return target;
  });
  if (target) {
    saveReviewCards(nextCards);
    appendReviewEvent({
      type: 'transfer_practice_attempt',
      cardId: target.id,
      promptId,
      result: input.result || 'attempted'
    });
    appendValidationEvent('transfer_practice_attempt', {
      cardId: target.id,
      promptId,
      result: input.result || 'attempted'
    });
  }
  return target;
}

function buildWeeklyPatternSynthesis(options = {}) {
  const recent = buildRecentLearningSummary(options.now || new Date());
  const firstStepProfile = loadUserFirstStepProfile();
  const taskPattern = loadTaskTypePattern();
  const reviewCards = loadReviewCards();
  const parentReflection = buildParentReflectionSummary();
  const typeCounter = {};
  (firstStepProfile.events || []).slice(0, 14).forEach((event) => {
    const type = event && event.taskType ? event.taskType : 'unknown';
    typeCounter[type] = Number(typeCounter[type] || 0) + 1;
  });
  reviewCards.slice(0, 14).forEach((card) => {
    const type = card && card.taskType ? card.taskType : 'unknown';
    typeCounter[type] = Number(typeCounter[type] || 0) + 1;
  });
  const dominantType = topCountKey(typeCounter) || 'unknown';
  const dominantPattern = ((taskPattern.byTaskType || {})[dominantType]) || {};
  const wrongCauseCounter = {};
  reviewCards.slice(0, 14).forEach((card) => {
    const key = card && (card.wrongCauseBucket || card.wrongCauseLabel);
    if (key) wrongCauseCounter[key] = Number(wrongCauseCounter[key] || 0) + 1;
  });
  const dominantCause = topCountKey(wrongCauseCounter) || 'first_step';
  const transferAttempts = reviewCards.reduce((total, card) => {
    const attempts = card && card.nextPracticePlan && card.nextPracticePlan.transferPracticeSet
      ? card.nextPracticePlan.transferPracticeSet.attempts || []
      : [];
    return total + attempts.length;
  }, 0);
  const enoughEvidence = (recent.latest3 || []).length >= 3 || reviewCards.length >= 3 || (firstStepProfile.events || []).length >= 3;
  const firstStepQualityCounts = Object.assign({ empty: 0, vague: 0, partial: 0, actionable: 0 }, dominantPattern.firstStepQualityCounts || {});
  const intervention = dominantPattern.total
    ? `下周先修 ${taskTypeLabel(dominantType)} 的第一步：${(deepScaffoldingTemplates(dominantType) || [])[0] || '先说清从哪里开始。'}`
    : '先连续留下 3 晚第一步、专注和回访记录。';
  return {
    title: '一周模式判断',
    ready: !!enoughEvidence,
    dominantTaskType: dominantType,
    dominantTaskLabel: taskTypeLabel(dominantType),
    dominantWrongCause: dominantCause,
    firstStepQualityCounts,
    transferAttempts,
    parentReflectionReady: !!(parentReflection && parentReflection.ready),
    summary: enoughEvidence
      ? `最近最常出现的是${taskTypeLabel(dominantType)}，优先观察「${dominantCause}」这类卡点。`
      : '证据还不够，先连续记录 3 晚再判断模式。',
    intervention,
    nextEvidence: transferAttempts > 0
      ? '继续完成一次教家长一句，确认迁移不是只会原题。'
      : '从一张错因卡开始，完成同类小变式和教家长一句。'
  };
}

function buildLearningDecisionPath(options = {}) {
  const weekly = buildWeeklyPatternSynthesis(options);
  const evidenceBias = buildEvidenceRouteBias(options);
  const reviewCards = loadReviewCards();
  const dueCards = reviewCards.filter((card) => card && (card.due || card.dueDate) && !card.isRevisited);
  const todaySession = loadRawTodaySession() || getTodaySession(options);
  const parentReflection = buildParentReflectionSummary();
  const hasTransferPractice = reviewCards.some((card) => (
    card
    && card.nextPracticePlan
    && card.nextPracticePlan.transferPracticeSet
    && Array.isArray(card.nextPracticePlan.transferPracticeSet.prompts)
    && card.nextPracticePlan.transferPracticeSet.prompts.length >= 3
  ));
  let route = '/pages/tutor/tutor';
  let action = '先说第一步';
  let reason = '还需要孩子先留下自己的第一步。';
  if (dueCards.length) {
    route = '/pages/review/review';
    action = '先清一张回访卡';
    reason = '已有到期卡，先确认昨天的方法还记得。';
  } else if (!hasTransferPractice && reviewCards.length) {
    route = '/pages/review/review';
    action = '做一个同类小变式';
    reason = '已有错因卡，但迁移练习还没有完成。';
  } else if (todaySession.childArticulatedStep && !todaySession.gamePlayed) {
    route = '/pages/arcade/arcade';
    action = '玩一小局轻回访';
    reason = '孩子已经说出第一步，下一步让轻练结果写回记录。';
  } else if (!parentReflection.ready) {
    route = '/pages/profile/profile';
    action = '留下家长追问回执';
    reason = '家长侧还没有确认是否只问一句、孩子是否复述。';
  } else if (weekly.ready) {
    route = '/pages/profile/profile';
    action = '看一周模式判断';
    reason = weekly.intervention;
  }
  if (evidenceBias && evidenceBias.nextRoute && evidenceBias.source !== 'global_evidence') {
    route = evidenceBias.nextRoute;
    action = evidenceBias.evidenceLine || action;
    reason = evidenceBias.reasonLine || reason;
  }
  return {
    title: '下一步决策路径',
    route,
    action,
    reason,
    weeklyPattern: weekly.summary,
    evidenceBias,
    evidence: [
      dueCards.length ? `${dueCards.length} due cards` : '',
      hasTransferPractice ? 'transfer practice available' : '',
      weekly.ready ? `weekly: ${weekly.dominantTaskType}` : ''
    ].filter(Boolean)
  };
}

function buildMasteryRubric(options = {}) {
  const reviewCards = loadReviewCards();
  const thinkingReceipts = loadThinkingReceipts();
  const gameProfile = loadGameProfile();
  const parentReflection = buildParentReflectionSummary();
  const transferAttemptCount = reviewCards.reduce((total, card) => {
    const attempts = card && card.nextPracticePlan && card.nextPracticePlan.transferPracticeSet
      ? card.nextPracticePlan.transferPracticeSet.attempts || []
      : [];
    return total + attempts.length;
  }, 0);
  const reviewedCards = reviewCards.filter((card) => card && (card.isRevisited || card.transferPracticeStatus)).length;
  const levels = [
    {
      id: 'first_step',
      label: '能说第一步',
      ready: reviewCards.some((card) => card && card.childArticulatedStep) || !!((loadRawTodaySession() || {}).childArticulatedStep),
      evidence: '孩子能把第一步说成一句话'
    },
    {
      id: 'diagnosis',
      label: '能说卡因',
      ready: reviewCards.some((card) => card && (card.wrongCauseBucket || card.wrongCauseLabel))
        || thinkingReceipts.some((item) => item && item.diagnostic_probe),
      evidence: '能把卡点归到审题、建模、计算、表达等原因'
    },
    {
      id: 'near_transfer',
      label: '能做同类变式',
      ready: transferAttemptCount > 0,
      evidence: `${transferAttemptCount} 次迁移练习尝试`
    },
    {
      id: 'teach_back',
      label: '能教家长一句',
      ready: parentReflection.childRecalledFirstStep > 0
        || reviewCards.some((card) => card && card.transferPracticeStatus && card.transferPracticeStatus.readyForParentTeachBack),
      evidence: parentReflection.line
    },
    {
      id: 'next_day_recall',
      label: '隔天还能回访',
      ready: reviewedCards > 0 || parentReflection.nextDayRevisit > 0 || Number(gameProfile.reviewed_today || gameProfile.reviewedToday || 0) > 0,
      evidence: reviewedCards ? `${reviewedCards} 张卡已有复核痕迹` : parentReflection.line
    }
  ];
  const readyCount = levels.filter((item) => item.ready).length;
  const stage = readyCount >= 5 ? 'transfer_stable'
    : readyCount >= 4 ? 'teach_back_ready'
      : readyCount >= 3 ? 'transfer_started'
        : readyCount >= 2 ? 'diagnosis_ready'
          : readyCount >= 1 ? 'first_step_ready'
            : 'needs_first_step';
  return {
    title: '掌握度量尺',
    stage,
    readyCount,
    totalCount: levels.length,
    score: Math.round((readyCount / levels.length) * 100),
    levels,
    nextLevel: (levels.find((item) => !item.ready) || null),
    line: readyCount >= 5
      ? '这类卡点已经从第一步、错因、迁移到隔天回访形成闭环。'
      : `当前到第 ${readyCount} 层，下一层要补：${(levels.find((item) => !item.ready) || {}).label || '继续真实回访'}。`
  };
}

function buildInterventionPlaybook(options = {}) {
  const weekly = buildWeeklyPatternSynthesis(options);
  const decision = buildLearningDecisionPath(options);
  const rubric = buildMasteryRubric(options);
  const taskType = weekly.dominantTaskType || 'unknown';
  const scaffolds = deepScaffoldingTemplates(taskType);
  const parentQuestion = parentQuestionFromFirstStep((loadRawTodaySession() || {}).childArticulatedStep || scaffolds[0]);
  const actions = [
    {
      id: 'tonight_first_step',
      label: '今晚先降到一小步',
      route: '/pages/tutor/tutor',
      script: scaffolds[0] || '先说清从哪里开始。',
      evidence: 'child_first_step_sentence'
    },
    {
      id: 'repair_one_card',
      label: '只修一张卡',
      route: '/pages/review/review',
      script: weekly.intervention || '先修出现最多的那类卡点。',
      evidence: 'wrong_cause_card_repaired'
    },
    {
      id: 'transfer_once',
      label: '做一次迁移',
      route: '/pages/review/review',
      script: '同类小变式只换一个条件，先说第一步哪里一样。',
      evidence: 'near_transfer_attempted'
    },
    {
      id: 'parent_teach_back',
      label: '教家长一句',
      route: '/pages/profile/profile',
      script: parentQuestion,
      evidence: 'child_explains_back'
    }
  ];
  return {
    title: '干预作战单',
    ready: !!(weekly.ready && decision.action && rubric.readyCount >= 2),
    summary: weekly.ready
      ? `围绕${weekly.dominantTaskLabel}，先按「${decision.action}」推进。`
      : '证据还不够，先连续 3 晚留下第一步和回访记录。',
    priorityAction: decision,
    masteryStage: rubric.stage,
    actions,
    exitCriteria: [
      '孩子能说第一步',
      '能说这次卡因',
      '能做一次同类变式',
      '能教家长一句',
      '隔天能回访一次'
    ]
  };
}

function recordOutcomeCheck(input = {}) {
  const event = appendValidationEvent('learning_outcome_check', {
    cardId: input.cardId || input.card_id || '',
    masteryStage: input.masteryStage || input.stage || '',
    childCanExplain: !!input.childCanExplain,
    transferWorked: !!input.transferWorked,
    nextDayRemembered: !!input.nextDayRemembered,
    parentVerified: !!input.parentVerified
  });
  appendReviewEvent({
    type: 'learning_outcome_check',
    cardId: input.cardId || input.card_id || '',
    masteryStage: input.masteryStage || input.stage || '',
    transferWorked: !!input.transferWorked,
    nextDayRemembered: !!input.nextDayRemembered
  });
  return event;
}

function buildOutcomeReviewSummary() {
  const events = validationEventsByType('learning_outcome_check');
  const success = events.filter((item) => item && item.childCanExplain && item.transferWorked && item.nextDayRemembered).length;
  return {
    title: '结果复核',
    total: events.length,
    success,
    ready: events.length > 0,
    line: events.length
      ? `已复核 ${events.length} 次，其中 ${success} 次同时满足会解释、能迁移、隔天记得。`
      : '还没有结果复核，完成一次迁移和次日回访后再判断。'
  };
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
  const parentReflectionSummary = buildParentReflectionSummary();
  const weeklyPatternSynthesis = buildWeeklyPatternSynthesis(input);
  const learningDecisionPath = buildLearningDecisionPath(input);
  const masteryRubric = buildMasteryRubric(input);
  const interventionPlaybook = buildInterventionPlaybook(input);
  const outcomeReviewSummary = buildOutcomeReviewSummary();
  const profile = loadUserFirstStepProfile();
  const recentEvents = (profile.events || []).slice(0, 7);
  const latestType = (recentEvents[0] && recentEvents[0].taskType) || 'unknown';
  const latestPattern = ((pattern.byTaskType || {})[latestType]) || {};
  const todaySession = loadRawTodaySession() || getTodaySession();
  const todayFocus = loadTodayFocus();
  const childStep = todaySession.childArticulatedStep
    || (todayFocus && (todayFocus.childArticulatedStep || todayFocus.miniActionText))
    || '';
  const taskLabel = taskTypeLabel(latestType);
  const parentQuestion = parentQuestionFromFirstStep(childStep);
  const repeatedLine = latestPattern.total
    ? `${taskLabel}里已经出现 ${latestPattern.total} 次第一步记录，先观察同一类卡点是不是重复出现。`
    : '本周模式还不够，先连续记录 3 晚。';
  const tonightScript = childStep
    ? `先复述孩子的话：“你刚才说第一步是${childStep}。”再问：“这一步下次先查什么？”`
    : `先问一句：“${parentQuestion}”如果孩子说不出来，就让他只圈一个条件或读第一句。`;
  const cannotAnswerFallback = '孩子答不上来时，不讲完整过程，只缩小到一个动作：圈条件、读第一句、找两个量、写第一句。';
  const praiseLine = childStep
    ? '先肯定他能说出自己的第一步，再决定要不要继续练。'
    : '先肯定他愿意停下来想一步，不急着评价对错。';
  const nextEvidence = childStep
    ? ['child_first_step_recalled', 'same_type_try_once', 'next_day_revisit']
    : ['parent_question_used', 'child_first_step_attempted', 'next_day_revisit'];
  const sevenDayParentPlan = [
    { day: 1, action: '只问第一步', script: parentQuestion, evidence: 'child_first_step_attempted' },
    { day: 2, action: '回看同一张卡', script: '昨天那一步，今天还记得先看哪里吗？', evidence: 'next_day_revisit' },
    { day: 3, action: '做 1 道同类题', script: '这道同类题，第一步和昨天一样吗？', evidence: 'same_type_try_once' },
    { day: 4, action: '检查错因', script: '这次卡住，是读题、列式、步骤还是检查？', evidence: 'wrong_cause_named' },
    { day: 5, action: '让孩子教家长', script: '你用一句话教我：这类题第一步看什么？', evidence: 'child_explains_back' },
    { day: 6, action: '轻练小游戏', script: '玩一小局后，说一张错卡为什么回来。', evidence: 'arcade_wrong_card_returned' },
    { day: 7, action: '形成周小结', script: '这一周最常卡的是哪一步？下周先修哪一类？', evidence: 'weekly_pattern_named' }
  ];
  return {
    tonightRecap: input.tonightRecap || '今晚先看孩子有没有说出自己的第一步。',
    weekPattern: repeatedLine,
    monthSuggestion: '接下来 7 天，每晚只做一件事：让孩子先说出自己的第一步，再用一张卡轻轻回访。',
    parentPhraseTraining: {
      title: '7 天家长陪伴脚本',
      preview: '先练“少讲答案，多问对一句”。',
      tonightScript,
      cannotAnswerFallback,
      praiseLine,
      avoid: ['别直接讲完整答案', '别追问排名和输赢', '别一次加太多题'],
      nextEvidence
    },
    sevenDayParentPlan,
    parentReflectionSummary,
    weeklyPatternSynthesis,
    learningDecisionPath,
    masteryRubric,
    interventionPlaybook,
    outcomeReviewSummary,
    usedPhraseCount: parentLogs.filter((item) => item && item.usedProductPhrase).length,
    experienceChecklist: buildExperienceChecklist()
  };
}

function buildLearningDepthMap(options = {}) {
  const todaySession = loadRawTodaySession() || getTodaySession(options);
  const todayFocus = loadTodayFocus();
  const reportState = loadLearningReportState();
  const tonightPlan = loadTonightPlan();
  const reviewCards = loadReviewCards();
  const reviewEvents = loadReviewEvents();
  const tutorEvents = loadTutorEvents();
  const thinkingReceipts = loadThinkingReceipts();
  const gameProfile = loadGameProfile();
  const shareRuns = loadShareRuns();
  const parentReflectionSummary = buildParentReflectionSummary();
  const weeklyPatternSynthesis = buildWeeklyPatternSynthesis(options);
  const learningDecisionPath = buildLearningDecisionPath(options);
  const masteryRubric = buildMasteryRubric(options);
  const interventionPlaybook = buildInterventionPlaybook(options);
  const outcomeReviewSummary = buildOutcomeReviewSummary();
  const transferPracticeCards = reviewCards.filter((card) => (
    card
    && card.nextPracticePlan
    && card.nextPracticePlan.transferPracticeSet
    && Array.isArray(card.nextPracticePlan.transferPracticeSet.prompts)
    && card.nextPracticePlan.transferPracticeSet.prompts.length >= 3
  ));
  const sync = syncDiagnostics();
  const parentGuide = buildParentActionGuide({
    tonightRecap: todaySession.childArticulatedStep
      ? `今晚孩子已经说出第一步：${todaySession.childArticulatedStep}`
      : ''
  });
  const hasDiagnostic = thinkingReceipts.some((item) => item && (item.diagnostic_probe || item.transfer_prompt))
    || tutorEvents.some((event) => event && event.event === 'tutor_diagnostic_probe')
    || !!(todaySession && (todaySession.childArticulatedStep || todaySession.tutorCompleted || todaySession.taskTypeConfirmed))
    || !!(todayFocus && (todayFocus.systemSuggestedStep || todayFocus.childArticulatedStep));
  const hasReportPlan = !!(
    reportState.localLoopConnection
    || reportState.solutionMap
    || (tonightPlan && tonightPlan.reportSolution)
  );
  const dueCards = reviewCards.filter((card) => card && (card.due || card.dueDate));
  const wrongCauseCards = reviewCards.filter((card) => card && (card.wrongCauseBucket || card.nextPracticePlan || card.repairPlan));
  const hasPracticeFeedback = !!(
    todaySession.gamePlayed
    || Number(gameProfile.reviewed_today || gameProfile.reviewedToday || gameProfile.review_count || 0) > 0
  );
  const hasParentScript = !!(
    parentGuide
    && Array.isArray(parentGuide.sevenDayParentPlan)
    && parentGuide.sevenDayParentPlan.length >= 7
    && parentGuide.parentPhraseTraining
    && parentGuide.parentPhraseTraining.cannotAnswerFallback
  );
  const hasTransferPractice = transferPracticeCards.length > 0;
  const hasParentReflection = (parentReflectionSummary && parentReflectionSummary.ready) || hasParentScript;
  const hasMisconceptionMap = hasDiagnostic || thinkingReceipts.some((item) => item && item.diagnostic_probe && item.diagnostic_probe.misconception);
  const hasWeeklyPattern = weeklyPatternSynthesis && weeklyPatternSynthesis.ready;
  const hasDecisionPath = learningDecisionPath && learningDecisionPath.action && learningDecisionPath.route;
  const hasMasteryRubric = masteryRubric && masteryRubric.readyCount >= 3;
  const hasInterventionPlaybook = interventionPlaybook && interventionPlaybook.ready && Array.isArray(interventionPlaybook.actions);
  const hasOutcomeReview = outcomeReviewSummary && outcomeReviewSummary.ready;
  const hasContinuity = !!(
    shareRuns.length
    || (sync && (Number(sync.queueLength || sync.pending || 0) >= 0))
  );
  const dimensions = [
    {
      id: 'guided_followup',
      label: '追问有层次',
      ready: hasDiagnostic,
      evidence: hasDiagnostic ? '已有诊断追问和迁移提示记录' : '先完成一次咕点追问'
    },
    {
      id: 'misconception_map',
      label: '误区能定位',
      ready: hasMisconceptionMap,
      evidence: hasMisconceptionMap ? '导师回执里已经记录误区判断和下一步证据' : '先完成一轮带误区判断的追问'
    },
    {
      id: 'action_plan',
      label: '报告能落地',
      ready: hasReportPlan,
      evidence: hasReportPlan ? '学习画像已接到今晚路线或 7 天方案' : '先录入成绩/测评并生成方案'
    },
    {
      id: 'active_recall',
      label: '错题会回访',
      ready: dueCards.length > 0 || wrongCauseCards.length > 0 || reviewEvents.length > 0,
      evidence: dueCards.length || wrongCauseCards.length
        ? `${dueCards.length} 张待回访卡，${wrongCauseCards.length} 张错因卡`
        : '先修一个卡点生成回访卡'
    },
    {
      id: 'transfer_practice',
      label: '会举一反三',
      ready: hasTransferPractice,
      evidence: hasTransferPractice ? `${transferPracticeCards.length} 张卡带同类变式、换场景和教家长练习` : '先从错因卡生成 3 个迁移练习'
    },
    {
      id: 'practice_feedback',
      label: '轻练会反哺',
      ready: hasPracticeFeedback,
      evidence: hasPracticeFeedback
        ? `今日练习 ${Number(gameProfile.reviewed_today || gameProfile.reviewedToday || 0)} 次，正确 ${Number(gameProfile.correct_today || gameProfile.correctToday || 0)} 次`
        : '先玩一小局，让结果写回学习记录'
    },
    {
      id: 'parent_coaching',
      label: '家长能接上',
      ready: hasParentScript,
      evidence: hasParentScript ? '已有 7 天家长陪伴脚本和答不上来兜底话术' : '先生成家长陪伴脚本'
    },
    {
      id: 'parent_reflection',
      label: '家长有回执',
      ready: hasParentReflection,
      evidence: parentReflectionSummary ? parentReflectionSummary.line : '今晚追问后记录一次回执'
    },
    {
      id: 'weekly_pattern',
      label: '一周能归因',
      ready: hasWeeklyPattern,
      evidence: weeklyPatternSynthesis ? weeklyPatternSynthesis.summary : '先积累 3 晚记录'
    },
    {
      id: 'decision_path',
      label: '下一步会决策',
      ready: hasDecisionPath,
      evidence: hasDecisionPath ? `${learningDecisionPath.action}：${learningDecisionPath.reason}` : '先生成下一步路径'
    },
    {
      id: 'mastery_rubric',
      label: '掌握有分层',
      ready: hasMasteryRubric,
      evidence: masteryRubric ? masteryRubric.line : '先形成掌握度量尺'
    },
    {
      id: 'intervention_playbook',
      label: '干预有打法',
      ready: hasInterventionPlaybook,
      evidence: interventionPlaybook ? interventionPlaybook.summary : '先形成干预作战单'
    },
    {
      id: 'outcome_review',
      label: '结果会复核',
      ready: hasOutcomeReview,
      evidence: outcomeReviewSummary ? outcomeReviewSummary.line : '先完成一次结果复核'
    },
    {
      id: 'continuity',
      label: '离开能回来',
      ready: hasContinuity,
      evidence: shareRuns.length
        ? `已留下 ${shareRuns.length} 条分享/回流记录`
        : '本地队列可恢复今晚路线、回访卡和学习小结'
    }
  ];
  const readyCount = dimensions.filter((item) => item.ready).length;
  const depthScore = Math.round((readyCount / dimensions.length) * 100);
  const nextDimension = dimensions.find((item) => !item.ready) || null;
  return {
    title: '能力厚度地图',
    summary: depthScore >= 84
      ? '追问、回访、轻练、家长陪伴和回流已经连成一条可复用路线。'
      : '核心路线能跑，继续补齐追问、回访或家长陪伴证据。',
    depthScore,
    readyCount,
    totalCount: dimensions.length,
    dimensions,
    transferPlan: parentGuide.sevenDayParentPlan || [],
    nextBestAction: nextDimension
      ? `${nextDimension.label}：${nextDimension.evidence}`
      : '继续用真实材料积累 3/7 晚记录。',
    benchmarkDepthLine: '对标成熟学习产品：不是只给一次提示，而是把追问、练习、回访、家长一句话和下一次行动连起来。'
  };
}

function buildLearningQuestArc(options = {}) {
  const todayFocus = loadTodayFocus();
  const tonightPlan = loadTonightPlan();
  const reviewCards = loadReviewCards();
  const outcome = buildOutcomeReviewSummary();
  const parentReflection = buildParentReflectionSummary();
  const decision = buildLearningDecisionPath(options);
  const mastery = buildMasteryRubric(options);
  const shareRuns = loadShareRuns();
  const dueCount = reviewCards.filter((card) => card && (card.due || card.dueDate) && !card.isRevisited).length;
  const transferCount = reviewCards.reduce((total, card) => {
    const attempts = card && card.nextPracticePlan && card.nextPracticePlan.transferPracticeSet
      ? card.nextPracticePlan.transferPracticeSet.attempts || []
      : [];
    return total + attempts.length;
  }, 0);
  const stages = [
    {
      id: 'plan',
      displayLabel: '今晚开局',
      title: tonightPlan && tonightPlan.summaryLine ? tonightPlan.summaryLine : '先排今晚第一步',
      body: '先把材料排顺序，再让孩子说出第一步。',
      action: 'goTutor',
      actionLabel: '去作业点拨',
      done: !!tonightPlan
    },
    {
      id: 'first_step',
      displayLabel: '苏格拉底',
      title: '先问一步，不直接给答案',
      body: '只追问诊断问题、第一步和卡点，不越过孩子的思考。',
      action: 'goReview',
      actionLabel: '看小黑板',
      done: !!(todayFocus && todayFocus.childArticulatedStep)
    },
    {
      id: 'repair',
      displayLabel: '修卡点',
      title: todayFocus && todayFocus.title ? todayFocus.title : '把一个真实卡点修完',
      body: '只修一个最卡的点，再把它写成回访卡。',
      action: 'goReview',
      actionLabel: '去修卡点',
      done: !!(todayFocus && todayFocus.repairStatus === 'completed')
    },
    {
      id: 'transfer',
      displayLabel: '迁移练习',
      title: '换题也能说出同一步',
      body: transferCount > 0 ? `已经写回 ${transferCount} 次迁移尝试。` : '先做一次同类变式，再看能不能换场景。',
      action: 'goReview',
      actionLabel: '做小变式',
      done: transferCount > 0
    },
    {
      id: 'parent',
      displayLabel: '家长追问',
      title: parentReflection.ready ? parentReflection.line : '家长只问一句',
      body: '家长只确认孩子能不能复述第一步，不直接接管答案。',
      action: 'goProfile',
      actionLabel: '看家长复盘',
      done: !!(parentReflection && parentReflection.ready)
    },
    {
      id: 'next_day',
      displayLabel: '次日回看',
      title: outcome.ready ? outcome.line : '隔天再回看一张卡',
      body: dueCount > 0 ? `当前还有 ${dueCount} 张待回访。` : '次日回看会把今天的动作变成长期记忆。',
      action: 'goReview',
      actionLabel: '去回看',
      done: outcome.success > 0 || reviewCards.some((card) => card && (card.isRevisited || card.due))
    }
  ];
  const doneCount = stages.filter((item) => item.done).length;
  const current = stages.find((item) => !item.done) || stages[stages.length - 1];
  return {
    title: '学习剧情线',
    summary: todayFocus
      ? `围绕${todayFocus.title || '今晚卡点'}，把苏格拉底、修卡点、迁移、家长和次日回看连成一条线。`
      : '把今晚的第一步、复盘和家长追问连成一条线。',
    currentStage: current.id,
    currentLabel: current.displayLabel,
    currentTitle: current.title,
    currentBody: current.body,
    currentAction: current.action,
    currentActionLabel: current.actionLabel,
    doneCount,
    totalCount: stages.length,
    progress: Math.round((doneCount / stages.length) * 100),
    stages,
    parentHook: parentReflection.ready ? parentReflection.line : '家长入口会先确认第一步，不接管答案。',
    gameHook: shareRuns.length
      ? `已有 ${shareRuns.length} 次分享或回流记录，可把复盘卡继续推到下一步。`
      : '分享后会保留下一步动作，而不是只发一张卡。',
    reportHook: outcome.ready ? outcome.line : '结果复核看迁移和次日记忆，不看最终答案。',
    decisionHook: decision.action,
    benchmarkHook: mastery.line
  };
}

function buildQuestArcGameBridge(options = {}) {
  const arc = buildLearningQuestArc(options);
  const dailyQuestSet = options.dailyQuestSet || {};
  const adaptiveChallenge = options.adaptiveChallenge || {};
  const evidenceBias = options.evidenceBias || dailyQuestSet.evidenceBias || adaptiveChallenge.evidenceBias || null;
  const activeQuest = Array.isArray(dailyQuestSet.quests)
    ? dailyQuestSet.quests.find((item) => item && item.progress < item.target) || dailyQuestSet.quests[0]
    : null;
  const bossKey = adaptiveChallenge && adaptiveChallenge.bossCard
    ? adaptiveChallenge.bossCard.key
    : dailyQuestSet.weakKey || '';
  const stageMap = {
    plan: {
      title: '先接上今晚路线',
      missionLine: '这一局只确认：孩子知道今晚从哪一步开始。',
      playRule: '答题前先在心里说出第一步，再点选；不会就回到点拨。',
      evidenceRequired: ['tonight_first_step', 'game_attempt']
    },
    first_step: {
      title: '第一步闯关',
      missionLine: '这一局不抢答案，只练“先说第一步”。',
      playRule: '每张卡先说准备从哪里开始，再核对思路。',
      evidenceRequired: ['student_first_step', 'no_final_answer']
    },
    repair: {
      title: bossKey ? `修补 ${bossKey}` : '修补一个真卡点',
      missionLine: bossKey ? `本局围绕高频卡点：${bossKey}` : '本局围绕最近的真实卡点。',
      playRule: '错了不扣成就感，直接回到复习队列生成下一步。',
      evidenceRequired: ['wrong_cause_returned', 'repair_card']
    },
    transfer: {
      title: '变式迁移关',
      missionLine: '同一个方法，换一道题也要能开口说第一步。',
      playRule: '只看方法能不能迁移，不追求一次给出完整答案。',
      evidenceRequired: ['near_transfer_attempted', 'same_method_new_context']
    },
    parent: {
      title: '教家长一句话',
      missionLine: '通关后让孩子用一句话教家长：我第一步先做什么。',
      playRule: '家长只追问一句，不接管解题。',
      evidenceRequired: ['child_explains_back', 'parent_one_question']
    },
    next_day: {
      title: '隔天回看关',
      missionLine: '隔天再看一张卡，确认不是当场会、转身忘。',
      playRule: '先回忆，再核对；忘了就回到轻量复习。',
      evidenceRequired: ['next_day_recall', 'review_card']
    }
  };
  const stage = stageMap[arc.currentStage] || stageMap.first_step;
  return Object.assign({
    id: `quest_arc_game_${arc.currentStage || 'first_step'}`,
    currentStage: arc.currentStage,
    currentLabel: arc.currentLabel,
    noFinalAnswer: true,
    source: 'learning_quest_arc',
    activeQuestId: activeQuest && activeQuest.id ? activeQuest.id : '',
    adaptiveMode: adaptiveChallenge.mode || 'balanced',
    evidenceBiasSource: evidenceBias && evidenceBias.source ? evidenceBias.source : '',
    evidenceBiasRoute: evidenceBias && evidenceBias.nextRoute ? evidenceBias.nextRoute : '',
    route: '/pages/arcade/arcade',
    completionWrites: ['quest_arc_game_signal', 'review_event', 'game_session_result']
  }, stage);
}

function recordQuestArcGameSignal(input = {}, context = {}) {
  const mission = input.mission || input.questArcMission || {};
  const result = input.result || {};
  const event = appendValidationEvent('quest_arc_game_signal', {
    currentStage: mission.currentStage || '',
    currentLabel: mission.currentLabel || '',
    missionTitle: mission.title || '',
    activeQuestId: mission.activeQuestId || '',
    adaptiveMode: mission.adaptiveMode || '',
    gameType: context.gameType || result.gameType || '',
    accuracy: Number(result.accuracy || 0),
    total: Number(result.total || 0),
    correct: Number(result.correct || 0),
    passed: !!result.passed,
    noFinalAnswer: mission.noFinalAnswer !== false,
    evidenceRequired: mission.evidenceRequired || []
  });
  appendSyncMutation('quest_arc_game_signal', {
    id: event.id,
    current_stage: event.currentStage,
    active_quest_id: event.activeQuestId,
    adaptive_mode: event.adaptiveMode,
    game_type: event.gameType,
    accuracy: event.accuracy,
    passed: event.passed,
    no_final_answer: event.noFinalAnswer,
    created_at: event.createdAt
  });
  if (event.passed && event.currentStage === 'first_step') {
    recordDailyLearningQuestSignal({ firstStepConfirmed: true }, { now: context.now || new Date() });
  }
  if (event.passed && ['repair', 'transfer', 'next_day'].includes(event.currentStage)) {
    recordDailyLearningQuestSignal({ focusRoundCompleted: true }, { now: context.now || new Date() });
  }
  return event;
}

function buildModuleFlowCompass(options = {}) {
  const todayFocus = loadTodayFocus();
  const tonightPlan = loadTonightPlan();
  const reviewCards = loadReviewCards();
  const thinking = thinkingReceiptSummary();
  const parentReflection = buildParentReflectionSummary();
  const outcome = buildOutcomeReviewSummary();
  const reportState = loadLearningReportState();
  const gameProfile = loadGameProfile();
  const shareRuns = loadShareRuns();
  const dueReviewCount = reviewCards.filter((card) => card && (card.due || card.dueDate) && !card.isRevisited).length;
  const transferAttemptCount = reviewCards.reduce((total, card) => {
    const attempts = card && card.nextPracticePlan && card.nextPracticePlan.transferPracticeSet
      ? card.nextPracticePlan.transferPracticeSet.attempts || []
      : [];
    return total + attempts.length;
  }, 0);
  const modules = [
    {
      id: 'plan',
      label: '今晚路线',
      route: '/pages/home/home',
      ready: !!tonightPlan,
      evidence: tonightPlan ? (tonightPlan.summaryLine || '已排今晚第一步') : '还缺今晚任务顺序',
      nextAction: tonightPlan ? '接到第一步点拨' : '先录入今晚任务',
      action: 'goHome'
    },
    {
      id: 'tutor',
      label: '苏格拉底点拨',
      route: '/pages/tutor/tutor',
      ready: !!(thinking && (thinking.diagnosticProbes || thinking.transferPrompts || thinking.total)),
      evidence: thinking && thinking.total ? `${thinking.total} 条思路记录` : '还缺一次第一步追问',
      nextAction: '让孩子先说第一步',
      action: 'goTutor'
    },
    {
      id: 'repair',
      label: '修卡点',
      route: '/pages/review/review',
      ready: !!(todayFocus && todayFocus.repairStatus === 'completed'),
      evidence: todayFocus ? `${todayFocus.title || '今日卡点'} · ${todayFocus.repairStatus || 'not_started'}` : '还缺一张真实卡点卡',
      nextAction: todayFocus && todayFocus.repairStatus === 'completed' ? '进入迁移或回访' : '完成一个小动作',
      action: 'goReview'
    },
    {
      id: 'review',
      label: '轻回访',
      route: '/pages/review/review',
      ready: dueReviewCount > 0 || reviewCards.some((card) => card && card.isRevisited),
      evidence: dueReviewCount ? `${dueReviewCount} 张待回访` : `${reviewCards.length} 张本地学习卡`,
      nextAction: dueReviewCount ? '先清一张待回访卡' : '生成或回看一张卡',
      action: 'goReview'
    },
    {
      id: 'arcade',
      label: '游戏化轻练',
      route: '/pages/arcade/arcade',
      ready: Number(gameProfile.reviewed_today || gameProfile.reviewedToday || 0) > 0,
      evidence: Number(gameProfile.reviewed_today || gameProfile.reviewedToday || 0)
        ? `今日轻练 ${Number(gameProfile.reviewed_today || gameProfile.reviewedToday || 0)} 题`
        : '还没把轻练写回证据',
      nextAction: '打一小局，错卡回队列',
      action: 'goArcade'
    },
    {
      id: 'transfer',
      label: '迁移练习',
      route: '/pages/review/review',
      ready: transferAttemptCount > 0,
      evidence: transferAttemptCount ? `${transferAttemptCount} 次迁移尝试` : '还缺同类变式或教家长',
      nextAction: '做一个同类变式',
      action: 'goReview'
    },
    {
      id: 'report',
      label: '报告到行动',
      route: '/pages/profile/profile',
      ready: !!(reportState && reportState.reportDraft),
      evidence: reportState && reportState.reportDraft ? `${Number(reportState.reportCompleteness || 0)}% 资料完整度` : '还缺学习画像',
      nextAction: '生成报告行动板',
      action: 'goProfile'
    },
    {
      id: 'parent',
      label: '家长复核',
      route: '/pages/profile/profile',
      ready: !!(parentReflection && parentReflection.ready),
      evidence: parentReflection && parentReflection.ready ? parentReflection.line : '还缺家长一句话回执',
      nextAction: '家长只问一句',
      action: 'goProfile'
    },
    {
      id: 'outcome',
      label: '次日结果',
      route: '/pages/review/review',
      ready: !!(outcome && outcome.ready),
      evidence: outcome && outcome.ready ? outcome.line : '还缺次日回看证据',
      nextAction: '隔天回看一张卡',
      action: 'goReview'
    },
    {
      id: 'share',
      label: '分享回流',
      route: '/pages/profile/profile',
      ready: shareRuns.length > 0,
      evidence: shareRuns.length ? `${shareRuns.length} 条分享/回流记录` : '还缺可转发行动卡',
      nextAction: '整理家庭行动卡',
      action: 'goProfile'
    }
  ];
  modules.forEach((item) => {
    item.displayLabel = item.label;
  });
  const readyCount = modules.filter((item) => item.ready).length;
  const current = modules.find((item) => !item.ready) || modules[modules.length - 1];
  return {
    title: '模块流转罗盘',
    summary: `已闭合 ${readyCount}/${modules.length} 个关键节点，下一步：${current.nextAction}`,
    readyCount,
    totalCount: modules.length,
    progress: Math.round((readyCount / modules.length) * 100),
    currentModule: current.id,
    currentLabel: current.label,
    currentAction: current.action,
    currentRoute: current.route,
    currentNextAction: current.nextAction,
    currentEvidence: current.evidence,
    modules,
    readiness: readyCount >= modules.length ? 'closed' : readyCount >= 7 ? 'nearly_closed' : readyCount >= 4 ? 'building' : 'thin',
    benchmarkLine: '对标成熟产品，不是单点功能强，而是每个模块都能把证据交给下一个模块。'
  };
}

function buildSurfaceDepthPack(surface = 'home', options = {}) {
  const acceptance = buildAcceptanceReport(options);
  const readiness = buildProductReadiness(options);
  const moduleFlowCompass = buildModuleFlowCompass(options);
  const globalEvidenceBrief = options.globalEvidenceBrief || buildGlobalEvidenceBrief(options);
  const learningQuestArc = options.learningQuestArc || buildLearningQuestArc(options);
  const capabilityLedger = options.capabilityEvidenceLedger || buildCapabilityEvidenceLedger(Object.assign({}, options, {
    globalEvidenceBrief,
    learningQuestArc,
    moduleFlowCompass
  }));
  const checklist = Array.isArray(acceptance.functionalityChecklist) ? acceptance.functionalityChecklist : [];
  const map = checklist.reduce((acc, item) => {
    if (item && item.id) acc[item.id] = item;
    return acc;
  }, {});
  const surfaces = {
    home: {
      title: '首页厚度包',
      summary: '把今晚第一步、点拨、修卡点、轻练和家长证据串成一个入口。',
      focusIds: ['guided_tutor', 'light_entry_evidence', 'material_to_review', 'game_retention', 'parent_evidence', 'local_resilience'],
      nextAction: '先把今晚第一步说清，再去点拨 / 修卡点 / 轻练。',
      benchmark: '首页不只是入口，要能把孩子推进到下一步证据。'
    },
    tutor: {
      title: '点拨厚度包',
      summary: '点拨必须留住第一步、错因、迁移提示和停止规则。',
      focusIds: ['guided_tutor', 'material_to_review', 'depth_compounding', 'parent_evidence'],
      nextAction: '先说第一步，再补错因和迁移检查。',
      benchmark: '点拨不是讲答案，是让孩子能复述下一步。'
    },
    review: {
      title: '修卡厚度包',
      summary: '修卡点必须能回到卡点、转成回访、再回到迁移。',
      focusIds: ['material_to_review', 'spaced_recall', 'report_to_solution', 'decision_path'],
      nextAction: '先修一个真卡点，再生成同类变式和回访。',
      benchmark: '修卡不是做完一张卡，而是把错因写回系统。'
    },
    arcade: {
      title: '游戏厚度包',
      summary: '轻练必须写回学习证据，而不是只给一个好玩外壳。',
      focusIds: ['game_retention', 'spaced_recall', 'parent_evidence', 'depth_compounding'],
      nextAction: '先打一局，再看它把哪张卡写回复习。',
      benchmark: '游戏不是装饰入口，是证据回流的动力层。'
    },
    profile: {
      title: '家长厚度包',
      summary: '家长页要能看见报告、周模式、掌握度、干预和分享回流。',
      focusIds: ['report_to_solution', 'parent_evidence', 'share_return', 'weekly_pattern', 'decision_path', 'mastery_rubric', 'intervention_playbook', 'outcome_review'],
      nextAction: '先看一条家长行动，再看周模式和掌握度。',
      benchmark: '家长页不是报表墙，是可执行的家庭决策台。'
    },
    legal: {
      title: '信任边界厚度包',
      summary: '法律与隐私页要讲清楚数据、未成年人保护、AI 边界和可回到的学习动作。',
      focusIds: ['local_resilience', 'parent_evidence', 'guided_tutor', 'decision_path'],
      nextAction: '确认边界后，回到家长复盘或补一条真实材料。',
      benchmark: '信任页不是静态条款，是让家庭敢试用的边界说明。'
    },
    tools: {
      title: '工具厚度包',
      summary: '工具页要把材料、错题、轻练习和回访都导回学习资产。',
      focusIds: ['light_entry_evidence', 'material_to_review', 'spaced_recall', 'game_retention', 'depth_compounding'],
      nextAction: '先把一段材料或错题变成可回访卡。',
      benchmark: '工具不是功能货架，是把输入转成复习资产的工厂。'
    },
    upload: {
      title: '材料入口厚度包',
      summary: '上传/录入要把作业、错题和材料分流到今晚路线。',
      focusIds: ['report_to_solution', 'material_to_review', 'guided_tutor', 'local_resilience'],
      nextAction: '先录入今晚任务，再确认第一项必须做。',
      benchmark: '材料入口不是收集框，是学习路线的源头。'
    },
    diagnosis: {
      title: '诊断厚度包',
      summary: '诊断要先判断卡点，再导向第一步、修卡点和迁移。',
      focusIds: ['guided_tutor', 'decision_path', 'mastery_rubric', 'intervention_playbook'],
      nextAction: '先回答三个小问题，确认今晚先修哪一点。',
      benchmark: '诊断不是贴标签，是把不清楚变成可执行一步。'
    },
    focus: {
      title: '专注厚度包',
      summary: '专注舱要绑定孩子说出的第一步，并在结束后留下证据。',
      focusIds: ['guided_tutor', 'parent_evidence', 'spaced_recall', 'depth_compounding'],
      nextAction: '先确认第一步，再围绕这一步坐一段。',
      benchmark: '专注不是计时器，是把开始过的证据留下来。'
    },
    module: {
      title: '学习小局厚度包',
      summary: '学习模块要能进入点拨、留下掌握标准，并变成复习卡。',
      focusIds: ['guided_tutor', 'material_to_review', 'mastery_rubric', 'spaced_recall'],
      nextAction: '先完成一个小局，再把方法加入回访。',
      benchmark: '模块不是内容页，是一个可沉淀的小学习闭环。'
    },
    radar: {
      title: '决策雷达厚度包',
      summary: '雷达要把弱点、优先级和下一步行动放在同一张图里。',
      focusIds: ['decision_path', 'weekly_pattern', 'parent_evidence', 'intervention_playbook'],
      nextAction: '先执行当前最高优先级的一步。',
      benchmark: '雷达不是分析图，是今晚下一步的决策台。'
    },
    daily_math: {
      title: '口算厚度包',
      summary: '轻口算要先看第一步，并在卡住时导回核心学习链路。',
      focusIds: ['light_entry_evidence', 'guided_tutor', 'game_retention', 'parent_evidence', 'depth_compounding'],
      nextAction: '先提交一轮，再决定是否进入诊断。',
      benchmark: '口算不是孤立练习，是核心链路的轻入口。'
    },
    dictation: {
      title: '听写厚度包',
      summary: '听写要记录孩子先看拼音、字形或意思的第一步。',
      focusIds: ['light_entry_evidence', 'guided_tutor', 'parent_evidence', 'depth_compounding'],
      nextAction: '先确认听写前的第一步，再进入核心链路。',
      benchmark: '听写不是报词工具，是留下学习方法的一步。'
    },
    light_diagnosis: {
      title: '手动选题厚度包',
      summary: '手动诊断要诚实承认边界，并让孩子确认第一步。',
      focusIds: ['light_entry_evidence', 'guided_tutor', 'local_resilience', 'decision_path'],
      nextAction: '先手动确认科目和卡点，再保存第一步。',
      benchmark: '轻诊断不是自动识别答案，是低风险定位入口。'
    }
  };
  const current = surfaces[surface] || surfaces.home;
  const routeMap = {
    guided_tutor: '/pages/tutor/tutor',
    material_to_review: '/pages/review/review',
    game_retention: '/pages/arcade/arcade',
    parent_evidence: '/pages/profile/profile',
    local_resilience: '/pages/upload/upload',
    spaced_recall: '/pages/review/review',
    report_to_solution: '/pages/entry-detail/entry-detail?scene=parent',
    decision_path: '/pages/entry-detail/entry-detail?scene=parent',
    weekly_pattern: '/pages/profile/profile',
    mastery_rubric: '/pages/profile/profile',
    intervention_playbook: '/pages/entry-detail/entry-detail?scene=parent',
    outcome_review: '/pages/profile/profile',
    depth_compounding: '/pages/entry-detail/entry-detail?scene=tutor',
    light_entry_evidence: '/pages/entry-detail/entry-detail?scene=today',
    share_return: '/pages/profile/profile'
  };
  const surfaceCapabilityMap = {
    home: ['socratic', 'light_entry', 'game', 'parent_action', 'next_action'],
    tutor: ['socratic', 'module_flow', 'parent_action', 'next_action'],
    review: ['socratic', 'game', 'report', 'module_flow', 'next_action'],
    arcade: ['game', 'socratic', 'parent_action', 'next_action'],
    profile: ['report', 'share', 'parent_action', 'surface_action', 'next_action'],
    legal: ['parent_action', 'report', 'share', 'next_action'],
    tools: ['light_entry', 'module_flow', 'game', 'next_action'],
    upload: ['report', 'socratic', 'module_flow', 'next_action'],
    diagnosis: ['socratic', 'report', 'module_flow', 'next_action'],
    focus: ['socratic', 'parent_action', 'surface_action', 'next_action'],
    module: ['module_flow', 'socratic', 'game', 'next_action'],
    radar: ['report', 'parent_action', 'module_flow', 'next_action'],
    daily_math: ['light_entry', 'game', 'socratic', 'next_action'],
    dictation: ['light_entry', 'socratic', 'parent_action', 'next_action'],
    light_diagnosis: ['light_entry', 'socratic', 'module_flow', 'next_action']
  };
  const ledgerRows = capabilityLedger && Array.isArray(capabilityLedger.rows) ? capabilityLedger.rows : [];
  const capabilityCards = (surfaceCapabilityMap[surface] || surfaceCapabilityMap.home)
    .map((id) => ledgerRows.find((item) => item && item.id === id))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      label: item.label,
      displayLabel: item.label,
      ready: !!item.ready,
      evidenceLine: item.evidenceLine,
      nextAction: item.nextAction,
      route: item.route
    }));
  const cards = current.focusIds.map((id) => {
    const item = map[id] || {};
    const flow = (moduleFlowCompass.modules || []).find((entry) => entry.id === id) || {};
    return {
      id,
      label: item.name || item.label || id,
      displayLabel: item.name || item.label || id,
      ready: !!(item.status === 'implemented' || item.ready),
      statusLine: item.status === 'implemented' ? '已具备证据' : '还缺证据',
      evidenceLine: Array.isArray(item.evidence) ? item.evidence.filter(Boolean).slice(0, 2).join(' / ') : '',
      gapLine: item.fix || item.gap || '先补本地证据',
      route: flow.route || routeMap[id] || '/pages/home/home',
      moduleLabel: flow.label || ''
    };
  });
  const functionCards = cards;
  const visibleCards = functionCards.concat(capabilityCards.map((item) => ({
    id: item.id,
    label: item.label,
    displayLabel: `能力·${item.label}`,
    ready: !!item.ready,
    statusLine: item.ready ? '已有能力证据' : '能力证据待补',
    evidenceLine: item.evidenceLine,
    gapLine: item.nextAction,
    route: item.route,
    moduleLabel: '能力账本',
    cardType: 'capability'
  })));
  const readyCount = visibleCards.filter((item) => item.ready).length;
  const currentModule = visibleCards.find((item) => !item.ready) || visibleCards[0] || null;
  const storyLine = learningQuestArc && learningQuestArc.currentLabel
    ? `当前剧情：${learningQuestArc.currentLabel} - ${learningQuestArc.currentTitle || learningQuestArc.currentBody || ''}`
    : '当前剧情：先留下第一步，再把练习、家长复盘和隔天回看接起来。';
  const evidenceLine = globalEvidenceBrief && globalEvidenceBrief.reportLine
    ? `证据线：${globalEvidenceBrief.reportLine}`
    : '证据线：先补一条真实学习证据。';
  const routeLine = globalEvidenceBrief && globalEvidenceBrief.shareLine
    ? `流转线：${globalEvidenceBrief.shareLine}`
    : `流转线：下一步进入 ${currentModule && currentModule.displayLabel ? currentModule.displayLabel : current.nextAction}`;
  const capabilityLine = capabilityLedger && capabilityLedger.nextCapability
    ? `能力账本：${capabilityLedger.readyCount}/${capabilityLedger.totalCount}，先补 ${capabilityLedger.nextCapability.label}。${capabilityLedger.nextCapability.evidenceLine || capabilityLedger.nextCapability.nextAction}`
    : '能力账本：继续沉淀孩子思路、练习、家长动作和下一步证据。';
  const capabilityRoute = capabilityLedger && capabilityLedger.nextCapability && capabilityLedger.nextCapability.route
    ? capabilityLedger.nextCapability.route
    : (currentModule && currentModule.route ? currentModule.route : '/pages/home/home');
  const surfaceLoop = {
    title: '入口闭环',
    entry: current.title,
    action: current.nextAction,
    evidence: currentModule && currentModule.ready
      ? (currentModule.evidenceLine || evidenceLine)
      : (currentModule && currentModule.gapLine ? currentModule.gapLine : evidenceLine),
    parent: capabilityLedger && capabilityLedger.parentLine
      ? capabilityLedger.parentLine
      : (learningQuestArc && learningQuestArc.parentHook) || '家长只问一句，确认孩子能不能说出第一步。',
    next: capabilityLedger && capabilityLedger.nextCapability
      ? capabilityLedger.nextCapability.nextAction
      : (currentModule && currentModule.route ? `继续到 ${currentModule.displayLabel}` : current.nextAction),
    route: currentModule && currentModule.route ? currentModule.route : capabilityRoute
  };
  const loopLine = `闭环：进入${surfaceLoop.entry} → ${surfaceLoop.action} → 留下证据：${surfaceLoop.evidence} → 家长看：${surfaceLoop.parent} → 下一步：${surfaceLoop.next}`;
  const familyLine = `${current.benchmark} ${storyLine} ${evidenceLine} ${capabilityLine} ${loopLine}`;
  return {
    surface,
    title: current.title,
    summary: current.summary,
    nextAction: current.nextAction,
    benchmarkLine: current.benchmark,
    storyLine,
    evidenceLine,
    routeLine,
    capabilityLine,
    capabilityRoute,
    surfaceLoop,
    loopLine,
    familyLine,
    readyCount,
    totalCount: visibleCards.length,
    progress: visibleCards.length ? Math.round((readyCount / visibleCards.length) * 100) : 0,
    currentModule,
    primaryRoute: currentModule && currentModule.route ? currentModule.route : '/pages/home/home',
    ledgerPrimaryRoute: capabilityRoute,
    capabilityLedgerSummary: capabilityLedger ? {
      readyCount: capabilityLedger.readyCount,
      totalCount: capabilityLedger.totalCount,
      progress: capabilityLedger.progress,
      nextCapability: capabilityLedger.nextCapability,
      moatLine: capabilityLedger.moatLine
    } : null,
    capabilityCards,
    functionCards,
    cards: visibleCards,
    surfaceReadiness: readyCount >= visibleCards.length ? 'closed' : readyCount >= Math.max(2, Math.ceil(visibleCards.length / 2)) ? 'building' : 'thin',
    acceptanceSignal: readiness && readiness.score ? Number(readiness.score || 0) : 0
  };
}

function buildUnifiedNextActionController(options = {}) {
  const safeRoutes = [
    '/pages/home/home',
    '/pages/tutor/tutor',
    '/pages/review/review',
    '/pages/arcade/arcade',
    '/pages/profile/profile',
    '/pages/entry-detail/entry-detail?scene=today',
    '/pages/entry-detail/entry-detail?scene=today',
    '/pages/upload/upload',
    '/pages/entry-detail/entry-detail?scene=upload',
    '/pages/entry-detail/entry-detail?scene=parent',
    '/pages/entry-detail/entry-detail?scene=tutor',
    '/pages/entry-detail/entry-detail?scene=today',
    '/pages/entry-detail/entry-detail?scene=today',
    '/pages/entry-detail/entry-detail?scene=today'
  ];
  function normalizeRoute(route, fallback = '/pages/tutor/tutor') {
    const value = typeof route === 'string' && route.trim() ? route.trim() : fallback;
    const normalized = value.charAt(0) === '/' ? value : `/${value}`;
    const base = normalized.split('?')[0];
    return safeRoutes.includes(base) ? normalized : fallback;
  }
  function pushCandidate(list, item) {
    if (!item || !item.source) return;
    list.push(Object.assign({}, item, {
      route: normalizeRoute(item.route),
      actionLabel: item.actionLabel || item.action || '\u5148\u5b8c\u6210\u8fd9\u4e00\u6b65',
      reasonLine: item.reasonLine || item.reason || '',
      evidenceLine: item.evidenceLine || item.evidence || ''
    }));
  }

  const reportDailyActionQueue = options.reportDailyActionQueue || buildReportDailyActionQueue(options);
  const evidenceBias = options.evidenceBias || buildEvidenceRouteBias(options);
  const decisionPath = options.learningDecisionPath || buildLearningDecisionPath(options);
  const questArc = options.learningQuestArc || buildLearningQuestArc(options);
  const moduleFlowCompass = options.moduleFlowCompass || buildModuleFlowCompass(options);
  const surfaceDepthPack = options.surfaceDepthPack || buildSurfaceDepthPack(options.surface || 'home', options);
  const candidates = [];

  if (reportDailyActionQueue && reportDailyActionQueue.ready && reportDailyActionQueue.active) {
    pushCandidate(candidates, {
      source: 'report_daily_action',
      sourceLabel: '\u62a5\u544a\u4eca\u65e5\u884c\u52a8',
      route: reportDailyActionQueue.active.route || reportDailyActionQueue.route,
      actionLabel: reportDailyActionQueue.active.task || reportDailyActionQueue.actionLine,
      reasonLine: reportDailyActionQueue.parentLine,
      evidenceLine: reportDailyActionQueue.evidenceLine,
      priority: 95
    });
  }
  if (evidenceBias && evidenceBias.nextRoute && evidenceBias.source && evidenceBias.source !== 'global_evidence') {
    pushCandidate(candidates, {
      source: evidenceBias.source,
      sourceLabel: evidenceBias.source === 'incoming_share' ? '\u5206\u4eab\u56de\u6d41' : evidenceBias.source === 'due_review' ? '\u5230\u671f\u56de\u8bbf' : '\u8bc1\u636e\u504f\u7f6e',
      route: evidenceBias.nextRoute,
      actionLabel: evidenceBias.evidenceLine || '\u5148\u5904\u7406\u6700\u65b0\u8bc1\u636e',
      reasonLine: evidenceBias.reasonLine,
      evidenceLine: evidenceBias.evidenceLine,
      priority: evidenceBias.source === 'incoming_share' ? 100 : 90
    });
  }
  if (decisionPath && decisionPath.route) {
    pushCandidate(candidates, {
      source: 'decision_path',
      sourceLabel: '\u5b66\u4e60\u51b3\u7b56\u8def\u5f84',
      route: decisionPath.route,
      actionLabel: decisionPath.action,
      reasonLine: decisionPath.reason,
      evidenceLine: decisionPath.weeklyPattern,
      priority: 80
    });
  }
  if (questArc && questArc.currentActionLabel) {
    pushCandidate(candidates, {
      source: 'quest_arc',
      sourceLabel: '\u5b66\u4e60\u5267\u60c5\u7ebf',
      route: decisionPath && decisionPath.route ? decisionPath.route : '/pages/tutor/tutor',
      actionLabel: questArc.currentActionLabel,
      reasonLine: questArc.currentBody || questArc.summary,
      evidenceLine: questArc.currentTitle,
      priority: 70
    });
  }
  if (moduleFlowCompass && moduleFlowCompass.currentRoute) {
    pushCandidate(candidates, {
      source: 'module_flow',
      sourceLabel: '\u6a21\u5757\u6d41\u8f6c\u7f57\u76d8',
      route: moduleFlowCompass.currentRoute,
      actionLabel: moduleFlowCompass.currentNextAction,
      reasonLine: moduleFlowCompass.currentEvidence,
      evidenceLine: moduleFlowCompass.currentLabel,
      priority: 60
    });
  }
  if (surfaceDepthPack && surfaceDepthPack.primaryRoute) {
    pushCandidate(candidates, {
      source: 'surface_depth',
      sourceLabel: '\u677f\u5757\u539a\u5ea6\u5305',
      route: surfaceDepthPack.primaryRoute,
      actionLabel: surfaceDepthPack.nextAction,
      reasonLine: surfaceDepthPack.familyLine || surfaceDepthPack.summary,
      evidenceLine: surfaceDepthPack.currentModule && surfaceDepthPack.currentModule.displayLabel,
      priority: 50
    });
  }

  const sorted = candidates
    .filter((item) => item.route)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const primary = sorted[0] || {
    source: 'fallback_first_step',
    sourceLabel: '\u7b2c\u4e00\u6b65',
    route: '/pages/tutor/tutor',
    actionLabel: '\u5148\u8ba9\u5b69\u5b50\u8bf4\u51fa\u7b2c\u4e00\u6b65',
    reasonLine: '\u8bc1\u636e\u8fd8\u4e0d\u8db3\uff0c\u4e0d\u731c\u6d4b\u7b54\u6848\uff0c\u5148\u7559\u4e0b\u4e00\u6761\u771f\u5b9e\u601d\u8def\u3002',
    evidenceLine: '\u5f85\u8865\u7b2c\u4e00\u6b65\u8bc1\u636e',
    priority: 40
  };
  return Object.assign({}, primary, {
    title: '\u5f53\u524d\u7cfb\u7edf\u5efa\u8bae\u4e0b\u4e00\u6b65',
    summary: `${primary.sourceLabel}\uff1a${primary.actionLabel}`,
    candidates: sorted.slice(0, 5),
    candidateCount: sorted.length,
    route: normalizeRoute(primary.route),
    readinessLine: sorted.length >= 5
      ? '\u62a5\u544a\u3001\u8bc1\u636e\u3001\u5267\u60c5\u3001\u6e38\u620f\u548c\u6a21\u5757\u6d41\u8f6c\u5df2\u8fdb\u5165\u540c\u4e00\u4e2a\u8c03\u5ea6\u5668\u3002'
      : '\u8fd8\u6709\u6a21\u5757\u9700\u8981\u8865\u8bc1\u636e\uff0c\u4f46\u5f53\u524d\u4e0b\u4e00\u6b65\u5df2\u53ef\u6267\u884c\u3002'
  });
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

function buildRealHomeworkCoverageMatrix(options = {}) {
  if (realHomeworkCoverage && realHomeworkCoverage.buildRealHomeworkCoverageMatrix) {
    return realHomeworkCoverage.buildRealHomeworkCoverageMatrix(options);
  }
  return {
    id: 'real_homework_coverage_matrix',
    title: '真实作业压力覆盖矩阵',
    summary: '真实作业压力样本暂不可用，先按第一步、错因、小黑板和家长回访继续收证据；不可冒充已接入完整样本矩阵。',
    boundary: '不做拍题答案库，不展示原题答案，不分享完整对话、分数或排名。',
    sourceLine: '等待本地样本资产加载后展示覆盖科目和题型。',
    activeSubject: { id: 'math', label: '数学', count: 0, nextGap: '继续补真实题型样本。' },
    subjectRows: [],
    typeRows: [],
    sampleClusters: [],
    totalSamples: 0,
    totalSubjects: 0,
    totalTypes: 0,
    reportLine: '报告只引用可验证的第一步、错因和回访证据。',
    parentLine: '家长侧只看下一步动作，不看孩子完整对话、分数或排名。',
    nextExpansionLine: '继续补真实题型样本。',
    evidenceRequired: [
      'sample_specific_first_step',
      'sample_specific_wrong_cause',
      'visual_board_move',
      'parent_check_line',
      'next_day_revisit'
    ]
  };
}

function buildReportPressureTruthAudit(coverageMatrix = {}, options = {}) {
  const subjectRows = Array.isArray(coverageMatrix.subjectRows) ? coverageMatrix.subjectRows : [];
  const typeRows = Array.isArray(coverageMatrix.typeRows) ? coverageMatrix.typeRows : [];
  const clusters = Array.isArray(coverageMatrix.sampleClusters) ? coverageMatrix.sampleClusters : [];
  const totalSamples = Number(coverageMatrix.totalSamples || subjectRows.reduce((sum, item) => sum + Number(item.count || 0), 0));
  const totalSubjects = Number(coverageMatrix.totalSubjects || subjectRows.length);
  const totalTypes = Number(coverageMatrix.totalTypes || typeRows.length);
  const topSubjects = subjectRows
    .slice()
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .slice(0, 4);
  const weakestSubject = subjectRows
    .slice()
    .sort((a, b) => Number(a.count || 0) - Number(b.count || 0))[0] || {};
  const pressureRows = clusters.slice(0, 6).map((item) => ({
    id: item.id,
    label: item.label,
    sampleCount: item.count || 0,
    firstStep: item.firstStep || '',
    wrongCauseGate: item.pressure || '',
    boardMove: item.boardMove || '',
    reportUse: item.revisit || '',
    parentCheck: item.parentCheck || '',
    localOwner: '本地规则判定题型、错因、小黑板动作和回访窗口；AI 只改写追问语气。',
    falseThickRisk: '如果只出现通用鼓励、直接答案、没有隔日回访或没有样本级错因，报告必须降级。'
  }));
  const failureTraps = [
    {
      id: 'generic_wrong_cause',
      label: '错因太泛',
      risk: '只说“基础不牢”或“审题不清”，没有命中题型里的具体误区。',
      localGate: '必须出现 sample_specific_wrong_cause。',
      fallback: '退回第一步小黑板，不写入长期画像。'
    },
    {
      id: 'board_not_visual',
      label: '小黑板不成图',
      risk: '只有文字讲解，没有关系箭头、变量格、证据链或图像读法。',
      localGate: '必须出现 visual_board_move。',
      fallback: '只给一笔图解动作，不给完整解法。'
    },
    {
      id: 'no_revisit',
      label: '没有回访',
      risk: '今晚会了就升级画像，缺少明天和第 7 天复核。',
      localGate: '必须出现 next_day_revisit 和 day7_variant。',
      fallback: '保持观察态，只进入明天回访。'
    },
    {
      id: 'unsafe_handoff',
      label: '家校交接泄露',
      risk: '把原题、答案、分数、排名或完整对话发出去。',
      localGate: '只允许 evidence_packet、parent_action、teacher_question。',
      fallback: '降级为家长私有复盘卡。'
    },
    {
      id: 'ai_over_decision',
      label: 'AI 越权判断',
      risk: 'AI 根据一次对话判断能力、排名、长期标签或加题量。',
      localGate: '长期画像必须由本地证据门控制。',
      fallback: 'AI 只生成一句追问或家长解释，不生成决策。'
    }
  ];
  const reportGates = [
    { id: 'sample_specific', label: '样本级命中', evidence: `${totalSamples} 个压力样本必须命中题型、错因、板书、家长检查、迁移。` },
    { id: 'seven_subject', label: '七科覆盖', evidence: `${totalSubjects} 科都要有可回访的真实作业压力样本。` },
    { id: 'question_type', label: '题型簇覆盖', evidence: `${totalTypes} 类题型必须有本地第一步入口。` },
    { id: 'privacy', label: '隐私边界', evidence: '报告、分享、家校交接都不带原题、答案、分数、排名、完整对话。' },
    { id: 'local_ai_boundary', label: '本地/AI 分工', evidence: '本地管路由、错因、放行、分享字段；AI 管语气和解释变体。' },
    { id: 'teacher_handoff', label: '老师可读', evidence: '家校交接只给问题清单、证据包和下一步观察，不给结论标签。' }
  ];
  const sourceDecision = [
    { id: 'use_public_k12', label: '公开资料直接可用', use: '课标能力、题型方向、常见错因、作业压力场景。' },
    { id: 'local_code_better', label: '本地代码更好', use: '题型路由、错因分类、长期画像放行、分享字段、隐私阻断、回访节奏。' },
    { id: 'ai_better', label: 'AI 更好', use: '苏格拉底追问语气、家长可读解释、同一第一步的多种说法。' },
    { id: 'do_not_use', label: '不能直接用', use: '原题答案库、拍题搜答案承诺、全科动态板书承诺、排名传播。' }
  ];
  const readiness = totalSamples >= 254 && totalSubjects >= 7 && totalTypes >= 9
    ? 'report_pressure_ready'
    : 'collect_more_samples';
  return {
    id: 'report_pressure_truth_audit',
    title: '报告抗虚胖审计',
    readiness,
    sampleLine: `当前报告接入 ${totalSamples} 个真实作业压力样本、${totalSubjects} 科、${totalTypes} 类题型；不足时不写长期画像。`,
    summary: readiness === 'report_pressure_ready'
      ? '报告不只展示结论，必须能追溯到样本级错因、小黑板动作、隔日回访和家校交接边界。'
      : '样本规模或题型覆盖不足，报告只能给今晚动作，不能给长期判断。',
    topSubjects,
    weakestSubject,
    pressureRows,
    failureTraps,
    reportGates,
    sourceDecision,
    localRuleLine: '本地规则拥有最终决策权：题型、错因、小黑板、回访、长期画像、分享字段、家校交接。',
    aiUseLine: 'AI 只负责把本地规则产物说得更像老师追问和家长说明，不负责最终答案或放行。',
    handoffLine: '老师侧只看证据包和问题清单：孩子第一步、错因复现、明天回访、第 7 天迁移。',
    shareBoundary: '不分享原题照片、完整答案、完整对话、分数、排名、孩子隐私评价。',
    nextExpansionLine: weakestSubject && weakestSubject.label
      ? `下一轮优先补 ${weakestSubject.label} 的真实作业压力样本和第 7 天迁移证据。`
      : '下一轮继续补真实作业压力样本和第 7 天迁移证据。',
    evidenceRequired: [
      'sample_specific_wrong_cause',
      'visual_board_move',
      'next_day_revisit',
      'day7_variant',
      'home_school_evidence_packet',
      'safe_share_boundary',
      'local_ai_decision_boundary'
    ]
  };
}

function buildCompetitiveMoatWorkbench(options = {}) {
  const coverageMatrix = options.realHomeworkCoverageMatrix || buildRealHomeworkCoverageMatrix(options);
  const courseUnitMap = options.courseUnitMap || buildCourseUnitMap(options);
  const courseUnitQuestionBank = options.courseUnitQuestionBank || buildCourseUnitQuestionBank({ courseUnitMap });
  const sevenSubjectMasterySprint = options.sevenSubjectMasterySprint || buildSevenSubjectMasterySprint({
    courseUnitMap,
    courseUnitQuestionBank
  });
  const reportPressureTruthAudit = options.reportPressureTruthAudit || buildReportPressureTruthAudit(coverageMatrix, options);
  const resources = Array.isArray(coverageMatrix.publicK12OpenSourceResourceLedger)
    ? coverageMatrix.publicK12OpenSourceResourceLedger
    : [];
  const challenges = Array.isArray(coverageMatrix.publicK12IntakeChallengeDeck)
    ? coverageMatrix.publicK12IntakeChallengeDeck
    : [];
  const sourceDecision = Array.isArray(reportPressureTruthAudit.sourceDecision)
    ? reportPressureTruthAudit.sourceDecision
    : [];
  const localDecision = sourceDecision.find((item) => item.id === 'local_code_better') || {};
  const aiDecision = sourceDecision.find((item) => item.id === 'ai_better') || {};
  const doNotUse = sourceDecision.find((item) => item.id === 'do_not_use') || {};
  const subjects = courseUnitMap && Array.isArray(courseUnitMap.subjects) ? courseUnitMap.subjects : [];
  const questionCards = courseUnitQuestionBank && Array.isArray(courseUnitQuestionBank.cards)
    ? courseUnitQuestionBank.cards
    : [];
  const contentScaleReady = resources.length >= 10 && subjects.length >= 7 && questionCards.length >= 21;
  const qualityGate = {
    fixtureLoaded: coverageMatrix.fixtureLoaded === true,
    sampleSourceStatus: coverageMatrix.sampleSourceStatus || 'unknown',
    coverageConfidence: coverageMatrix.coverageConfidence || 'unknown',
    pseudoThicknessRiskCount: reportPressureTruthAudit.pseudoThicknessRiskCount || 0,
    threeRoundSocraticRiskCount: reportPressureTruthAudit.threeRoundSocraticRiskCount || 0,
    crossModuleConsistencyRiskCount: reportPressureTruthAudit.crossModuleConsistencyRiskCount || 0
  };
  const qualityGateReady = qualityGate.fixtureLoaded
    && qualityGate.sampleSourceStatus === 'fixture_loaded'
    && qualityGate.coverageConfidence === 'fixture_verified'
    && qualityGate.pseudoThicknessRiskCount === 0
    && qualityGate.threeRoundSocraticRiskCount === 0
    && qualityGate.crossModuleConsistencyRiskCount === 0;
  const highLeverageLanes = [
    {
      id: 'content_depth',
      label: '内容规模',
      target: '七科课程单元、题型轴、错因轴、小黑板动作、近迁移和回访窗口全部本地化。',
      currentEvidence: `${subjects.length} 科 / ${courseUnitMap.unitCount || 0} 单元 / ${questionCards.length} 张题型卡`,
      localCodeOwns: ['course_unit_map', 'question_type_axis', 'wrong_cause_atlas', 'license_gate'],
      aiBetterFor: ['把已通过许可门的第一步提示改写成儿童可懂问法'],
      nextAction: '继续扩充真实作业压力样本，不复制公开原题和答案。'
    },
    {
      id: 'ai_tutor_depth',
      label: 'AI点拨深度',
      target: 'AI 只负责苏格拉底追问、家长解释和小黑板话术；答案边界、停止条件、本地兜底必须可跑。',
      currentEvidence: `${reportPressureTruthAudit.threeRoundSocraticRiskCount || 0} 个三轮追问风险 / 本地答案边界已接入`,
      localCodeOwns: ['answer_boundary', 'hint_level', 'stop_condition', 'fallback_recovery'],
      aiBetterFor: ['child_friendly_socratic_wording', 'parent_explanation', 'blackboard_prompt_variant'],
      nextAction: '用真实错题压测沉默、求答案、错因泛化、迁移失败四类兜底。'
    },
    {
      id: 'gizmo_memory_game',
      label: '高频游戏留存',
      target: '每天只有一个主回忆动作：90秒遮答案说第一步、错因回声、明日回访、第7天迁移。',
      currentEvidence: sevenSubjectMasterySprint.gameIntensityLine || 'Review/Arcade 已接主动回忆和错因回流。',
      localCodeOwns: ['spaced_recall_scheduler', 'xp_gate', 'streak_rescue', 'non_ranking_board'],
      aiBetterFor: ['鼓励语和挑战卡文案改写'],
      nextAction: '把每日回访从“可见面板”继续压成首页第一行动。'
    },
    {
      id: 'parent_decision_report',
      label: '家长决策书',
      target: '天赋/学习偏好只做方法候选；错题、试卷、老师反馈和回访证据共同决定下一步。',
      currentEvidence: reportPressureTruthAudit.sampleLine || '报告接入样本级错因、小黑板、家长检查和回访证据。',
      localCodeOwns: ['portrait_release_gate', 'method_candidate_only', 'home_school_allowed_fields', 'evidence_ledger'],
      aiBetterFor: ['把证据账本改写成家长能执行的一句话'],
      nextAction: '继续把上传材料变成“今晚做什么/不做什么/缺什么证据”。'
    },
    {
      id: 'safe_share_relay',
      label: '安全分享接力',
      target: '分享只带第一步、错因、回访窗口和接收者动作，不带原题、答案、照片、分数、排名。',
      currentEvidence: '分享回流已接 home/profile/review/arcade 路由和 blockedFields。',
      localCodeOwns: ['allowlist_payload', 'denylist_payload', 'return_route', 'relay_completion'],
      aiBetterFor: ['邀请语改写'],
      nextAction: '把接收者自己的材料接入同题型第一步挑战。'
    }
  ];
  const sourcePolicyRows = [
    {
      id: 'openmaic',
      label: 'OpenMAIC',
      decision: '只借机制，不接代码',
      use: '两阶段任务计划、事件流、动作引擎、质量门。',
      blocked: '不复制 AGPL 代码、prompt、素材；不部署成闭源服务端；不承诺完整 AI 课堂。'
    },
    {
      id: 'public_k12',
      label: '公开K12/OER',
      decision: '先过来源许可账本',
      use: '课标结构、题型方向、常见错因、教学活动形态。',
      blocked: '不搬原题、答案、解析、教材图、课件截图、视频逐字稿。'
    },
    {
      id: 'family_upload',
      label: '家庭上传材料',
      decision: '只用于本家庭报告',
      use: '错题/试卷进错因与回访；天赋测评进方法候选；老师反馈进家校摘要。',
      blocked: '不外传孩子材料；不根据一次测评贴天赋标签。'
    }
  ];
  const sourceLicenseGateRows = [
    {
      id: 'public_domain',
      label: 'public_domain / cc_by',
      status: 'can_seed_structure',
      productUse: '可以进入题型轴、错因轴、小黑板模板和回访窗口，但仍要保留来源记录和去相似化检查。',
      blockedUse: '不能暗示官方背书，不能搬运原题答案包。'
    },
    {
      id: 'cc_by_sa',
      label: 'cc_by_sa / share_alike',
      status: 'structure_reference_only',
      productUse: '只做结构参考：题型、课堂活动、板书顺序、教师提问方式。',
      blockedUse: '不把原文、改编题、解析或图片放进闭源商业运行包。'
    },
    {
      id: 'cc_by_nc',
      label: 'cc_by_nc / nc_sa',
      status: 'commercial_blocked_until_license',
      productUse: '只记录为研究来源，帮助我们设计原创题型和错因分类。',
      blockedUse: '商业小程序内不得直接复用内容、讲义、题目、答案或素材。'
    },
    {
      id: 'unknown_or_proprietary',
      label: 'unknown / proprietary',
      status: 'blocked',
      productUse: '不进入运行包，只能作为人工研究线索。',
      blockedUse: '不抓取、不改写、不生成近似题，不做公开分享。'
    }
  ];
  const openMaicScenePack = [
    {
      id: 'outline',
      label: '大纲',
      localCodeOwns: '把输入材料拆成题型、错因、第一步、回访窗口。',
      aiBetterFor: '把第一步改写成孩子能回答的一句话。'
    },
    {
      id: 'scene',
      label: '场景',
      localCodeOwns: '生成小黑板、主动回忆卡、轻练习、家长回执和安全分享。',
      aiBetterFor: '生成不同语气的追问和家长解释。'
    },
    {
      id: 'playback',
      label: '回放',
      localCodeOwns: '记录事件流、完成证据、XP 放行、次日回访和第 7 天迁移。',
      aiBetterFor: '总结过程，但不能改写证据事实。'
    },
    {
      id: 'quality_gate',
      label: '质量门',
      localCodeOwns: '答案边界、license gate、隐私字段、长期画像放行和分享字段。',
      aiBetterFor: '只做可读性润色。'
    }
  ];
  const competitiveExecutionBoard = [
    {
      id: 'gizmo_loop',
      label: 'Gizmo式记忆循环',
      tonightAction: '90 秒遮答案说第一步；错因回声；明天同类回访；第 7 天小变式。',
      evidenceRequired: ['active_recall', 'wrong_cause_replay', 'next_day_revisit', 'day7_transfer'],
      blockedFields: ['ranking', 'score_compare', 'full_answer']
    },
    {
      id: 'khanmigo_tutor',
      label: 'Khanmigo式引导点拨',
      tonightAction: '三轮苏格拉底：看题目问什么、选第一步入口、交给家长一句检查。',
      evidenceRequired: ['child_first_step', 'hint_level', 'parent_receipt', 'safe_share_boundary'],
      blockedFields: ['final_answer', 'mastery_claim', 'talent_label']
    },
    {
      id: 'openmaic_board',
      label: 'OpenMAIC式小黑板',
      tonightAction: '只画关系入口，不画完整解法；每一层都要求孩子说证据。',
      evidenceRequired: ['board_entry_not_solution', 'student_says_evidence', 'exit_ticket'],
      blockedFields: ['copied_prompt', 'copied_asset', 'full_ai_classroom_claim']
    },
    {
      id: 'parent_book',
      label: '家庭决策书',
      tonightAction: '天赋测评只给方法候选；错题试卷决定先修哪一步；老师材料生成家校摘要。',
      evidenceRequired: ['source_type', 'method_candidate', 'wrong_paper_card', 'home_school_digest'],
      blockedFields: ['fixed_talent_label', 'private_comment', 'original_photo']
    }
  ];
  const reportInputLanes = [
    {
      id: 'talent_assessment',
      label: '天赋/学习偏好',
      acceptedInput: '第三方测评摘要或小程序内 15 题偏好测评',
      output: '学习方法候选、验证计划、家长观察句',
      releaseRule: '没有错题、隔天回访和第 7 天迁移，不更新长期画像。'
    },
    {
      id: 'wrong_question_paper',
      label: '错题/试卷',
      acceptedInput: '错题描述、试卷错因、老师批注、孩子第一步',
      output: '题型定位、错因卡、小黑板入口、轻练习和回访卡',
      releaseRule: '不生成整卷答案、不自动判分、不做排名刺激。'
    },
    {
      id: 'school_material',
      label: '学校/老师材料',
      acceptedInput: '老师反馈、课堂观察、作业要求',
      output: '家校沟通摘要、老师可看证据包、家庭配合动作',
      releaseRule: '只带观察问题和下一步动作，不带原题照片、答案、分数或完整对话。'
    }
  ];
  const reportInputReadableLanes = reportInputLanes.map((item) => Object.assign({}, item, {
    releaseLine: item.releaseRule || '先补齐孩子自己的第一步、错因和回访证据，再生成家庭方案。'
  }));
  return {
    id: 'competitive_moat_workbench',
    title: '竞品级加厚工作台',
    summary: '对标 Gizmo 的主动回忆与游戏留存、Khanmigo 的引导式点拨、OpenMAIC 的事件流与质量门，但产品仍聚焦家庭晚间作业闭环。',
    status: contentScaleReady && qualityGateReady ? 'local_moat_building' : 'needs_more_content_evidence',
    statusReason: contentScaleReady && qualityGateReady ? 'content_scale_and_sample_quality_verified' : 'content_scale_or_sample_quality_not_verified',
    qualityGate,
    qualityGateReady,
    progressPercent: Math.min(92, Math.round((resources.length * 2 + subjects.length * 5 + questionCards.length + challenges.length) / 1.4)),
    sourcePolicyRows,
    sourceLicenseGateRows,
    openMaicScenePack,
    competitiveExecutionBoard,
    reportInputLanes: reportInputReadableLanes,
    highLeverageLanes,
    aiLocalDecision: {
      id: 'ai_local_decision',
      localBetter: localDecision.use || '本地代码负责题型路由、错因分类、长期画像放行、分享字段、隐私阻断、回访节奏。',
      aiBetter: aiDecision.use || 'AI 更适合苏格拉底追问语气、家长可读解释、同一第一步的多种说法。',
      doNotUse: doNotUse.use || '不能直接使用原题答案库、拍题搜答案承诺、全科动态板书承诺、排名传播。'
    },
    nextOneDayBuild: [
      '把每日记忆回流压成一个主行动，而不是多个面板。',
      '继续把公开K12资料登记为结构资产，不把原题和答案放进运行包。',
      '把天赋/学习偏好入口保持为方法候选，必须用错题、次日回访、第7天迁移验证。',
      '每个新能力都同时写清 localCodeOwns、aiBetterFor、blockedFields、evidenceRequired。'
    ],
    blockedClaims: [
      '拍题自动出答案',
      '完整AI课堂生成',
      '天赋定性',
      '分数排名比较',
      '复制开源或公开题库内容',
      '未验证就写长期画像'
    ],
    evidenceRequired: [
      'source_license_gate',
      'local_ai_decision_boundary',
      'course_unit_question_bank',
      'daily_memory_return',
      'parent_report_release_gate',
      'safe_share_relay'
    ],
    sourceCounts: {
      publicK12Resources: resources.length,
      intakeChallengeCards: challenges.length,
      subjects: subjects.length,
      courseUnits: courseUnitMap.unitCount || 0,
      questionCards: questionCards.length
    }
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
  buildSubjectSkillDepth,
  buildSocraticAssessmentMatrix,
  buildCurriculumSpine,
  buildVisualSocraticMatrix,
  buildFirstStepBlackboardBlueprint,
  buildLightEntrySeedBank,
  buildSubjectSeedLibrary,
  buildCourseUnitMap,
  buildGradeChapterTeachingStrategyMap,
  buildGradeChapterStrategyDensityAudit,
  buildCourseUnitMasteryTrajectory,
  buildCourseUnitQuestionBank,
  buildCourseUnitDepthExpansionAtlas,
  buildCommercialDepthRunway,
  buildWeeklyEvidenceFlywheel,
  buildSevenSubjectMasterySprint,
  childStepQuality,
  normalizeFirstStepEvidence,
  saveChildArticulatedStep,
  formatIssueType,
  formatRouteStage,
  formatSourceLabel,
  formatInternalLabel,
  normalizeTaskType,
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
  recordReportRevisitEvidence,
  buildLearningReportFromInput,
  buildReportDailyActionQueue,
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
  buildFirstStepPromptCard,
  buildLocalScenarioLoopCases,
  applyLocalScenarioLoopCase,
  buildBlackboardHint,
  ensureTodayFocusReviewCard,
  buildSpacedCadenceReviewCards,
  ensureSpacedCadenceReviewCards,
  buildSpacedReviewEvidenceLedger,
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
  loadRealTrialSamples,
  appendRealTrialSample,
  buildRealTrialGameChallengeBridge,
  buildRealTrialPressureCandidateBoard,
  buildRealTrialSocraticStressAudit,
  buildRealTrialStressRepairQueue,
  buildRealTrialRuleWritebackPlan,
  buildRealTrialRuleRetestDeck,
  buildRealTrialRuleRetestReviewBridge,
  ensureRealTrialRuleRetestReviewCards,
  buildRealTrialRecoveryLoop,
  loadFactoryEvents,
  appendFactoryEvent,
  factoryEventSummary,
  loadModuleEvents,
  trackModuleEvent,
  moduleEventSummary,
  loadModuleFeedback,
  appendModuleFeedback,
  moduleFeedbackMap,
  loadSurfaceDepthEvents,
  inferSurfaceDepthCapability,
  recordSurfaceDepthAction,
  buildSurfaceDepthActionSummary,
  loadUnifiedActionEvents,
  recordUnifiedNextAction,
  buildUnifiedNextActionSummary,
  buildEvidenceRouteBias,
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
  recordAnswerBoundaryEvidence,
  ensureMiniLessonReturnReviewCard,
  setActiveMiniLessonResumeContext,
  loadActiveMiniLessonResumeContext,
  clearActiveMiniLessonResumeContext,
  recordMiniLessonExitGate,
  recordMiniLessonReviewResult,
  loadGameProfile,
  saveGameProfile,
  recordDailyLearningQuestSignal,
  addGameXP,
  recordGameSessionResult,
  loadCourseUnitProgress,
  recordCourseUnitProgress,
  loadGamePurchases,
  saveGamePurchase,
  loadShareRuns,
  loadShareFollowUpQueue,
  loadIncomingShare,
  buildSafeRelayChallengePacket,
  buildShareSpreadReadinessGate,
  buildShareChallengePlan,
  buildWrongCauseViralChallengePack,
  buildCommunityShareRelayBoard,
  buildQuestionBankShareRelayDeck,
  buildQuestionBankVisualShareRelayDeck,
  saveIncomingShare,
  appendShareRun,
  appendShareFollowUpQueue,
  recordShareRelayCompletion,
  buildReceiverOwnMaterialChallenge,
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
  buildProductReadiness,
  buildAcceptanceReport,
  buildRealHomeworkCoverageMatrix,
  buildRightsBoundaryEnvelope,
  buildReportPressureTruthAudit,
  buildCompetitiveMoatWorkbench,
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
  ensureFocusReviewCard,
  loadLightFeatureEvents,
  buildLightFeatureEvidenceSummary,
  detectAvoidancePattern,
  loadParentInterventionLog,
  appendParentInterventionLog,
  loadScaffoldingChains,
  saveScaffoldingChains,
  createScaffoldingChain,
  appendScaffoldingStep,
  buildTransferPracticeSet,
  recordTransferPracticeAttempt,
  recordParentReflectionReceipt,
  buildParentReflectionSummary,
  buildWeeklyPatternSynthesis,
  buildLearningDecisionPath,
  buildMasteryRubric,
  buildInterventionPlaybook,
  recordOutcomeCheck,
  buildOutcomeReviewSummary,
  buildParentActionGuide,
  buildLearningDepthMap,
  buildGlobalEvidenceBrief,
  buildCapabilityEvidenceLedger,
  buildCapabilityMaturityQueue,
  buildCapabilityStructuralReadinessLedger,
  buildUnifiedNextActionController,
  buildLearningQuestArc,
  buildQuestArcGameBridge,
  buildModuleFlowCompass,
  buildSurfaceDepthPack,
  recordQuestArcGameSignal,
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
